/**
 * apps/api/src/server.ts
 * Heuresys Advanced API entry point.
 *
 * Binds the Fastify app to env.HOST:env.PORT and wires graceful shutdown
 * (SIGINT/SIGTERM) to close the DB pool before exit.
 */

import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./db/client.js";
import { closeInboxListener } from "./lib/inbox-stream.js";
import { loadRolePermissionCacheWithRetry } from "./modules/auth/cache-loader.js";

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down API");
    try {
      await app.close();
      // #38 B6: la connessione dedicata in LISTEN non appartiene al pool, quindi
      // closePool() non la tocca — senza questa riga resterebbe aperta a ogni riavvio.
      await closeInboxListener();
      await closePool();
      process.exit(0);
    } catch (err) {
      app.log.fatal({ err }, "Error during shutdown");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    // Populate RBAC cache before opening the port: the first request must
    // never hit requirePermission() with an unloaded cache. Retried (D-20):
    // transient tunnel/OCI jitter at pool establishment must not kill the boot.
    const cacheStats = await loadRolePermissionCacheWithRetry(app.log);
    app.log.info(cacheStats, "RBAC permission cache loaded");

    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ host: env.HOST, port: env.PORT, env: env.NODE_ENV }, "API listening");
  } catch (err) {
    app.log.fatal({ err }, "API failed to start");
    process.exit(1);
  }
}

start();
