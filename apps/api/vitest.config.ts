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
    // D-64: gli unit test (test/unit/*.unit.test.ts) hanno la loro config
    // (vitest.unit.config.ts, no DB/setup) — esclusi qui per non girare due volte.
    exclude: ["test/unit/**", "**/node_modules/**"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share a single DB pool — serial avoids
    // refresh-rotation race conditions across tests.
    // Vitest 4 migration (2026-05-26): poolOptions removed; use top-level
    // fileParallelism + single worker to keep single-thread semantics.
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ["./test/helpers/setup.ts"],
  },
});
