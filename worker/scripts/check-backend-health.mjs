import Redis from "ioredis";
import pg from "pg";

const withTimeout = async (promise, ms, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const parseRedisNodes = (raw) =>
  raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => {
      const [host, port] = n.split(":");
      return { host, port: Number(port) };
    });

const buildNatMap = () => {
  const natMap = Object.fromEntries(
    (process.env.REDIS_CLUSTER_NAT_MAP || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [src, dst] = entry.split("=");
        const [host, port] = (dst || "").split(":");
        return [src?.trim(), { host, port: Number(port) }];
      })
      .filter(([src]) => Boolean(src)),
  );

  if (process.env.REDIS_CLUSTER_FORCE_ENDPOINT !== "true") {
    return Object.keys(natMap).length > 0 ? natMap : undefined;
  }

  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    throw new Error(
      "REDIS_HOST and REDIS_PORT are required when REDIS_CLUSTER_FORCE_ENDPOINT=true",
    );
  }

  return (nodeKey) =>
    natMap[nodeKey] ?? {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    };
};

const checks = [
  {
    name: "Postgres",
    run: async () => {
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });
      try {
        await withTimeout(client.connect(), 12000, "Postgres connect");
        await withTimeout(client.query("select 1 as ok"), 12000, "Postgres query");
      } finally {
        await client.end().catch(() => {});
      }
    },
  },
  {
    name: "Migrations",
    run: async () => {
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });
      try {
        await withTimeout(client.connect(), 12000, "Migrations connect");
        const result = await withTimeout(
          client.query(
            `select migration_name, finished_at, rolled_back_at
             from "_prisma_migrations"
             where finished_at is null and rolled_back_at is null`,
          ),
          12000,
          "Migrations query",
        );

        if (result.rows.length > 0) {
          const names = result.rows.map((r) => r.migration_name).join(", ");
          throw new Error(`Pending/failed Prisma migrations detected: ${names}`);
        }
      } finally {
        await client.end().catch(() => {});
      }
    },
  },
  {
    name: "ClickHouse",
    run: async () => {
      const timeoutMs = Number(process.env.CLICKHOUSE_REQUEST_TIMEOUT_MS || 15000);
      const authHeader = Buffer.from(
        `${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`,
      ).toString("base64");

      const response = await withTimeout(
        fetch(process.env.CLICKHOUSE_URL, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "text/plain",
          },
          body: "SELECT 1 FORMAT JSONEachRow",
        }),
        timeoutMs + 5000,
        "ClickHouse query",
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`ClickHouse HTTP ${response.status}: ${text}`);
      }
    },
  },
  {
    name: "ClickHouse Tables",
    run: async () => {
      const authHeader = Buffer.from(
        `${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`,
      ).toString("base64");

      const sql = `
        SELECT name FROM system.tables
        WHERE database = currentDatabase()
          AND name IN ('traces','observations','scores')
      `;

      const response = await withTimeout(
        fetch(process.env.CLICKHOUSE_URL, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "text/plain",
          },
          body: `${sql} FORMAT JSON`,
        }),
        20000,
        "ClickHouse table check",
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`ClickHouse table check failed: ${response.status} ${text}`);
      }

      const json = await response.json();
      const names = new Set((json?.data || []).map((r) => r.name));
      for (const required of ["traces", "observations", "scores"]) {
        if (!names.has(required)) {
          throw new Error(`Missing required ClickHouse table: ${required}`);
        }
      }
    },
  },
  {
    name: "Redis",
    run: async () => {
      const tlsEnabled = process.env.REDIS_TLS_ENABLED === "true";

      if (process.env.REDIS_CLUSTER_ENABLED === "true") {
        const nodesRaw = process.env.REDIS_CLUSTER_NODES || "";
        const nodes =
          nodesRaw.trim().length > 0
            ? parseRedisNodes(nodesRaw)
            : process.env.REDIS_HOST && process.env.REDIS_PORT
              ? [
                  {
                    host: process.env.REDIS_HOST,
                    port: Number(process.env.REDIS_PORT),
                  },
                ]
              : [];

        if (nodes.length === 0) {
          throw new Error(
            "REDIS_CLUSTER_ENABLED=true but no REDIS_CLUSTER_NODES/REDIS_HOST seed node configured",
          );
        }

        const cluster = new Redis.Cluster(nodes, {
          dnsLookup: (address, cb) => cb(null, address),
          natMap: buildNatMap(),
          clusterRetryStrategy: () => null,
          enableOfflineQueue: false,
          lazyConnect: true,
          redisOptions: {
            password: process.env.REDIS_AUTH || undefined,
            username: process.env.REDIS_USERNAME || undefined,
            tls: tlsEnabled
              ? {
                  servername:
                    process.env.REDIS_TLS_SERVERNAME || process.env.REDIS_HOST,
                }
              : undefined,
            connectTimeout: 10000,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
          },
        });

        try {
          await withTimeout(cluster.connect(), 15000, "Redis cluster connect");
          await withTimeout(cluster.ping(), 15000, "Redis cluster ping");
        } finally {
          cluster.disconnect();
        }

        return;
      }

      const redis = new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_AUTH || undefined,
        username: process.env.REDIS_USERNAME || undefined,
        tls: tlsEnabled
          ? {
              servername:
                process.env.REDIS_TLS_SERVERNAME || process.env.REDIS_HOST,
            }
          : undefined,
        connectTimeout: 10000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        lazyConnect: true,
      });
      try {
        await withTimeout(redis.connect(), 15000, "Redis connect");
        await withTimeout(redis.ping(), 15000, "Redis ping");
      } finally {
        redis.disconnect();
      }
    },
  },
];

if (process.env.LANGFUSE_REQUIRE_WORKER_HEALTHCHECK === "true") {
  checks.push({
    name: "Worker HTTP",
    run: async () => {
      const workerPort = process.env.WORKER_PORT || process.env.PORT || "3030";
      const response = await withTimeout(
        fetch(`http://localhost:${workerPort}/health`),
        12000,
        "Worker /health",
      );

      if (!response.ok) {
        throw new Error(`Worker /health returned ${response.status}`);
      }
    },
  });
}

if (process.env.LANGFUSE_INIT_PROJECT_ID) {
  checks.push({
    name: "Project API Keys",
    run: async () => {
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });
      try {
        await withTimeout(client.connect(), 12000, "Project key check connect");
        const result = await withTimeout(
          client.query(
            `select count(*)::int as key_count
             from api_keys
             where project_id = $1`,
            [process.env.LANGFUSE_INIT_PROJECT_ID],
          ),
          12000,
          "Project key check query",
        );

        if ((result.rows[0]?.key_count || 0) === 0) {
          console.log(
            `[WARN] No API keys found for project ${process.env.LANGFUSE_INIT_PROJECT_ID}`,
          );
        }
      } finally {
        await client.end().catch(() => {});
      }
    },
  });
}

let hasError = false;
for (const check of checks) {
  try {
    await check.run();
    console.log(`[PASS] ${check.name}`);
  } catch (err) {
    hasError = true;
    const errDetails =
      err instanceof Error
        ? err.message && err.message.trim().length > 0
          ? err.message
          : JSON.stringify({
              name: err.name,
              code: err.code,
              cause: err.cause?.message ?? err.cause,
            })
        : String(err);
    console.log(`[FAIL] ${check.name}: ${errDetails}`);
  }
}

if (hasError) {
  process.exitCode = 1;
  console.log("Backend health check failed.");
} else {
  console.log("Backend health check passed.");
}
