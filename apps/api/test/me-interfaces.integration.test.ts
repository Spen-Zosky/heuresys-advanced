/**
 * apps/api/test/me-interfaces.integration.test.ts
 * GET /v1/me/interfaces — the DB-driven sidebar registry (U1), filtered to the caller and
 * grouped by the 3 PET perspectives. Faithfully replicates the web layout's hybrid gate:
 * ESS items always visible; admin items require an admin-class role AND the per-item permission.
 *
 * Personas are the seed-test-admin set ONLY (login-capable in CI): admin (PLATFORM_ADMIN),
 * paolo.caputo (MANAGER), tommaso.fiore (pure USER). R2-seeded users are NOT used (their logins
 * are provisioned by seed-r2-personas.ts, which CI does not run).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";

const PWD = "Admin#PassW0rd!";
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return cookies;
}

type Body = { perspectives: { code: string; label: string; interfaces: { code: string }[] }[] };
async function interfaces(t: TestApp, c: Map<string, string>): Promise<Body> {
  const r = await t.app.inject({ method: "GET", url: "/v1/me/interfaces", headers: { cookie: ch(c) } });
  expect(r.statusCode).toBe(200);
  return r.json() as Body;
}
function codes(b: Body, perspective: string): string[] {
  return (b.perspectives.find((p) => p.code === perspective)?.interfaces ?? []).map((i) => i.code);
}

let suite: TestApp;
let adminC: Map<string, string>;
let managerC: Map<string, string>;
let userC: Map<string, string>;

describe("/v1/me/interfaces", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    adminC = await login(suite, "admin@heuresys.com");
    managerC = await login(suite, "paolo.caputo@rtl-bank.org");
    userC = await login(suite, "tommaso.fiore@rtl-bank.org");
  });
  afterAll(async () => { await suite.app.close(); });

  it("always returns the 3 PET perspectives (honest empty-state)", async () => {
    const b = await interfaces(suite, userC);
    expect(b.perspectives.map((p) => p.code)).toEqual(["PROCESS", "ENTERPRISE", "TALENT"]);
  });

  it("PLATFORM_ADMIN sees the full registry incl. admin-only interfaces", async () => {
    const b = await interfaces(suite, adminC);
    // admin-only items (perms a pure USER lacks) are present
    expect(codes(b, "PROCESS")).toEqual(expect.arrayContaining(["blueprints", "processes", "brownfield", "seeds"]));
    expect(codes(b, "ENTERPRISE")).toEqual(expect.arrayContaining(["dashboard", "kpis", "comp", "roles", "system-health"]));
    // TALENT carries both the ESS items and the admin workforce items
    expect(codes(b, "TALENT")).toEqual(expect.arrayContaining(["me-home", "me-inbox", "positions", "gaps", "career-succession"]));
  });

  it("pure USER sees ONLY the ESS items — no admin-nav leak", async () => {
    const b = await interfaces(suite, userC);
    expect(codes(b, "PROCESS")).toEqual([]);       // no Process admin items
    expect(codes(b, "ENTERPRISE")).toEqual([]);    // no Enterprise admin items (incl. no dashboard)
    const talent = codes(b, "TALENT").sort();
    // exactly the ESS items (R1b added me-team; AI ② added me-matching as a TALENT self-service page).
    expect(talent).toEqual(["me-career", "me-home", "me-inbox", "me-learning", "me-matching", "me-skills", "me-team"]);
  });

  it("MANAGER (admin-class) is per-permission filtered WITHIN the admin section", async () => {
    const b = await interfaces(suite, managerC);
    const proc = codes(b, "PROCESS");
    const ent = codes(b, "ENTERPRISE");
    // holds blueprint:read + bpm_process:read → sees those…
    expect(proc).toEqual(expect.arrayContaining(["blueprints", "processes"]));
    // …but lacks brownfield_adaptation:read + seed_acquisition:read → does NOT see those
    expect(proc).not.toContain("brownfield");
    expect(proc).not.toContain("seeds");
    // has admin reach → dashboard + the perms it holds (kpi/viz/org/tenant/user) show…
    expect(ent).toEqual(expect.arrayContaining(["dashboard", "kpis"]));
    // …but lacks compensation_intelligence:read + role:read → no comp / roles
    expect(ent).not.toContain("comp");
    expect(ent).not.toContain("roles");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/interfaces" });
    expect(r.statusCode).toBe(401);
  });
});
