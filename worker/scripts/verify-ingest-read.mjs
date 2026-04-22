import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";

const HTTP_TIMEOUT_MS = 60000;

const loadEnvFile = (envPath) => {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const createFastHash = (secretKey, salt) => {
  const salted = sha256(salt);
  return createHash("sha256").update(secretKey).update(salted).digest("hex");
};

const authHeader = (publicKey, secretKey) =>
  `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;

const getJson = async (url, auth) => {
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const postJson = async (url, auth, payload) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const envPath = path.resolve(process.cwd(), "../.env");
  loadEnvFile(envPath);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const projectId = process.env.LANGFUSE_INIT_PROJECT_ID;
  const salt = process.env.SALT;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!projectId) throw new Error("LANGFUSE_INIT_PROJECT_ID is required");
  if (!salt) throw new Error("SALT is required");

  const marker = `shiftleft-live-marker-${Date.now()}`;
  const chatId = `shiftleft-chat-${randomUUID()}`;
  const traceId = randomUUID();
  const eventId = randomUUID();
  const nowIso = new Date().toISOString();

  const publicKey = `pk-lf-${randomUUID()}`;
  const secretKey = `sk-lf-${randomUUID()}`;
  const displaySecretKey = `${secretKey.slice(0, 6)}...${secretKey.slice(-4)}`;
  const fastHashedSecretKey = createFastHash(secretKey, salt);
  const hashedSecretKey = `sha256-${sha256(`${secretKey}-fallback`)}`;

  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });

  let keyId = null;
  try {
    await client.connect();

    const insert = await client.query(
      `insert into api_keys
       (id, public_key, hashed_secret_key, fast_hashed_secret_key, display_secret_key, project_id, scope, note)
       values ($1,$2,$3,$4,$5,$6,'PROJECT',$7)
       returning id`,
      [
        randomUUID(),
        publicKey,
        hashedSecretKey,
        fastHashedSecretKey,
        displaySecretKey,
        projectId,
        `codex-verify-${marker}`,
      ],
    );
    keyId = insert.rows[0]?.id;

    const auth = authHeader(publicKey, secretKey);

    const beforeRes = await getJson(
      `${baseUrl}/api/public/traces?page=1&limit=1`,
      auth,
    );
    const beforeCount =
      typeof beforeRes.body?.meta?.totalItems === "number"
        ? beforeRes.body.meta.totalItems
        : null;

    const ingestPayload = {
      batch: [
        {
          id: eventId,
          type: "trace-create",
          timestamp: nowIso,
          body: {
            id: traceId,
            timestamp: nowIso,
            name: "shiftleft-live-check",
            sessionId: chatId,
            environment: "default",
            input: `marker:${marker}`,
            output: "pipeline-check",
            metadata: {
              marker,
              chatId,
              source: "codex-verify-ingest-read",
            },
          },
        },
      ],
    };

    const ingestRes = await postJson(
      `${baseUrl}/api/public/ingestion`,
      auth,
      ingestPayload,
    );
    if (ingestRes.status !== 207) {
      throw new Error(
        `Ingestion failed (${ingestRes.status}): ${JSON.stringify(ingestRes.body)}`,
      );
    }

    const start = Date.now();
    let trace = null;
    while (Date.now() - start <= 30000) {
      const traceRes = await getJson(`${baseUrl}/api/public/traces/${traceId}`, auth);
      if (
        traceRes.status === 200 &&
        traceRes.body?.id === traceId &&
        traceRes.body?.metadata?.marker === marker
      ) {
        trace = traceRes.body;
        break;
      }
      await sleep(2000);
    }

    const afterRes = await getJson(
      `${baseUrl}/api/public/traces?page=1&limit=1`,
      auth,
    );
    const afterCount =
      typeof afterRes.body?.meta?.totalItems === "number"
        ? afterRes.body.meta.totalItems
        : null;

    if (!trace) {
      throw new Error(
        `Trace not visible within 30s (traceId=${traceId}, marker=${marker})`,
      );
    }

    const countDeltaOk =
      beforeCount === null || afterCount === null
        ? "unknown"
        : afterCount >= beforeCount + 1;

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          projectId,
          traceId,
          chatId,
          marker,
          observedInMs: Date.now() - start,
          beforeCount,
          afterCount,
          countDeltaOk,
          environment: trace.environment,
          sessionId: trace.sessionId,
        },
        null,
        2,
      ),
    );
  } finally {
    if (keyId) {
      await client
        .query("delete from api_keys where id = $1", [keyId])
        .catch(() => {});
    }
    await client.end().catch(() => {});
  }
};

main().catch((err) => {
  const asError = err instanceof Error ? err : null;
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: asError?.message ?? String(err),
        name: asError?.name ?? null,
        stack: asError?.stack ?? null,
        cause:
          asError && "cause" in asError
            ? String(asError.cause ?? "")
            : null,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
