/**
 * apps/api/test/brownfield-engine-freeze.integration.test.ts
 * D-11 — BROWNFIELD_ENGINE_ENABLED=false must leave the 4 ETL surfaces
 * unregistered (404 route-not-found, before any auth/RBAC), and the default
 * (true) keeps them registered — the freeze is a registration-time gate, not
 * a per-request check.
 */
import { describe, it, expect, afterAll } from "vitest";
import { env } from "../src/config/env.js";
import { buildTestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const FROZEN_SURFACES = [
  "/v1/brownfield-source-exports",
  "/v1/brownfield-import-runs",
  "/v1/brownfield-table-mappings",
  "/v1/brownfield/wave-executor/runs",
];

describe("D-11 brownfield engine freeze flag", () => {
  afterAll(async () => {
    await closePool();
  });

  it("flag OFF: the 4 ETL surfaces are NOT registered (404 before auth)", async () => {
    const prev = env.BROWNFIELD_ENGINE_ENABLED;
    (env as { BROWNFIELD_ENGINE_ENABLED: boolean }).BROWNFIELD_ENGINE_ENABLED = false;
    try {
      const frozen = await buildTestApp();
      try {
        for (const url of FROZEN_SURFACES) {
          const r = await frozen.app.inject({ method: "GET", url });
          expect(r.statusCode, url).toBe(404);
        }
      } finally {
        await frozen.app.close();
      }
    } finally {
      (env as { BROWNFIELD_ENGINE_ENABLED: boolean }).BROWNFIELD_ENGINE_ENABLED = prev;
    }
  });

  it("flag ON (default): the surfaces ARE registered (auth gate answers, not 404)", async () => {
    const live = await buildTestApp();
    try {
      const r = await live.app.inject({ method: "GET", url: "/v1/brownfield-import-runs" });
      // unauthenticated -> 401/403 from the RBAC/auth layer, NEVER 404
      expect([401, 403]).toContain(r.statusCode);
    } finally {
      await live.app.close();
    }
  });
});
