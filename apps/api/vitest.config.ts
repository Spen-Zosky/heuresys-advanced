/**
 * apps/api/vitest.config.ts
 * Single config for both unit and integration tests. Integration tests rely
 * on the live OCI VM database via tunnel :5433 — the same .env that `pnpm dev`
 * uses. To run only fast unit tests, filter by name pattern.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share a single DB pool — serial avoids
    // refresh-rotation race conditions across tests.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    setupFiles: ["./test/helpers/setup.ts"],
  },
});
