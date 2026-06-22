import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { publicStatsService } from "../src/modules/public-stats/service.js";

let suite: TestApp;
beforeAll(async () => { suite = await buildTestApp(); publicStatsService._reset(); });
afterAll(async () => { await suite.app.close(); });

describe("GET /v1/public/platform-stats (public)", () => {
  it("returns live aggregate counts with no auth", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Record<string, number>;
    // moat metrics must be populated on the live DB
    expect(b.skills).toBeGreaterThan(1000);
    expect(b.occupationSkillEdges).toBeGreaterThan(1000);
    expect(b.activeTenancies).toBeGreaterThanOrEqual(1);
    // every field is a non-negative integer
    for (const v of Object.values(b)) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
  });

  it("is cached (second call returns the same object within TTL)", async () => {
    const a = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    const b = await suite.app.inject({ method: "GET", url: "/v1/public/platform-stats" });
    expect(a.json()).toEqual(b.json());
  });
});
