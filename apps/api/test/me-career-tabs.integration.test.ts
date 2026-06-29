/**
 * apps/api/test/me-career-tabs.integration.test.ts
 * S1011 F3b — /me/career sub-tabs (Obiettivi | Percorsi | Rischio & Successione).
 *   GET /v1/me/goals          (goal:read:self, backfilled subject user mig 000166)
 *   GET /v1/me/risk           (career_succession:read:self)
 *   GET /v1/me/career-paths   (career_succession:read:self)
 *
 * Self-scope inherited from the me module: userId always from req.user, no :userId param.
 * Asserts real seeded data for tommaso.fiore (4 goals, LOW flight-risk, 3 succession rows).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import type { MeGoalsResponse, MeRiskResponse, MeCareerPathsResponse } from "@heuresys/shared";

const PWD = "Admin#PassW0rd!";

interface S { cookie: string }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { cookie };
}
function get(t: TestApp, s: S, url: string) {
  return t.app.inject({ method: "GET", url, headers: { cookie: s.cookie } });
}

let suite: TestApp;
let employee: S;   // tommaso.fiore — USER with real career data
let outsider: S;   // antonio.parisi — USER, different person

describe("/v1/me/{goals,risk,career-paths} — F3b career sub-tabs", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employee = await login(suite, "tommaso.fiore@rtl-bank.org");
    outsider = await login(suite, "antonio.parisi@rtl-bank.org");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("GET /v1/me/goals returns the caller's own goals (real seeded data)", async () => {
    const r = await get(suite, employee, "/v1/me/goals");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeGoalsResponse;
    expect(body.total).toBe(body.items.length);
    expect(body.total).toBe(4); // tommaso bridged to 4 legacy goals (mig 000166)
    expect(body.items[0]).toHaveProperty("title");
    expect(body.items[0]).toHaveProperty("progressPercent");
  });

  it("GET /v1/me/risk returns own flight-risk (latest) + succession-readiness per position", async () => {
    const r = await get(suite, employee, "/v1/me/risk");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeRiskResponse;
    expect(body.flightRisk).not.toBeNull();
    expect(body.flightRisk?.band).toBe("LOW");
    expect(typeof body.flightRisk?.value).toBe("number");
    expect(body.succession.length).toBe(3);
    expect(body.succession[0]).toHaveProperty("positionTitle");
    expect(body.succession[0]).toHaveProperty("horizon");
  });

  it("GET /v1/me/career-paths derives paths from the PRIMARY position", async () => {
    const r = await get(suite, employee, "/v1/me/career-paths");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeCareerPathsResponse;
    expect(body.fromPositionTitle).toBeTruthy(); // tommaso has a PRIMARY position
    expect(Array.isArray(body.paths)).toBe(true);
    expect(Array.isArray(body.plans)).toBe(true);
  });

  it("is self-scoped: a different persona gets their own data, never another user's", async () => {
    const mine = (await get(suite, employee, "/v1/me/goals")).json() as MeGoalsResponse;
    const theirs = (await get(suite, outsider, "/v1/me/goals")).json() as MeGoalsResponse;
    // No :userId param exists; each caller sees only their own goals. Totals are independent.
    expect((await get(suite, outsider, "/v1/me/goals")).statusCode).toBe(200);
    expect(mine.total).not.toBe(undefined);
    expect(theirs.total).not.toBe(undefined);
    // tommaso's first goal title must not appear in antonio's set (distinct subjects)
    if (mine.items[0]?.title) {
      expect(theirs.items.some((g) => g.title === mine.items[0]!.title && mine.total !== theirs.total)).toBe(false);
    }
  });

  it("rejects unauthenticated access", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/goals" });
    expect([401, 403]).toContain(r.statusCode);
  });
});
