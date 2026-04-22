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
        try {
          await client.end();
        } catch {}
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

      const text = await response.text();
      if (!text.includes('"1"') && !text.includes("1")) {
        throw new Error(`Unexpected ClickHouse response: ${text}`);
      }
    },
  },
  {
    name: "Redis",
    run: async () => {
      const tlsEnabled = process.env.REDIS_TLS_ENABLED === "true";
      if (process.env.REDIS_CLUSTER_ENABLED === "true") {
        const nodes = (process.env.REDIS_CLUSTER_NODES || "")
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            const [host, port] = n.split(":");
            return { host, port: Number(port) };
          });

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

        const cluster = new Redis.Cluster(nodes, {
          dnsLookup: (address, cb) => cb(null, address),
          ...(Object.keys(natMap).length > 0 ? { natMap } : {}),
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
      } else {
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
      }
    },
  },
];

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
    console.log(
      `[FAIL] ${check.name}: ${errDetails}`,
    );
  }
}

if (hasError) {
  process.exitCode = 1;
  console.log("Backend health check failed.");
} else {
  console.log("Backend health check passed.");
}
