/**
 * apps/api/test/me-interfaces.integration.test.ts
 * GET /v1/me/interfaces — the DB-driven sidebar registry (U1), filtered to the caller and
 * grouped into the 5 SECTIONS (S1009 IA redesign: OVERVIEW/GOVERNANCE/WORKFORCE/INTELLIGENCE/
 * PERSONAL, replacing the 3 PET perspectives). Faithfully replicates the web layout's hybrid
 * gate: ESS items always visible; admin items require an admin-class role AND the per-item
 * permission. Absorbed analytics pages (is_active=false, reached via the in-page tab bar) are
 * NOT returned here.
 *
 * Personas are the seed-test-admin set ONLY (login-capable in CI): admin (PLATFORM_ADMIN),
 * paolo.caputo (MANAGER), tommaso.fiore (pure USER). R2-seeded users are NOT used (their logins
 * are provisioned by seed-r2-personas.ts, which CI does not run).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";

const PWD = "Admin#PassW0rd!";
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, PWD);
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
function codes(b: Body, section: string): string[] {
  return (b.perspectives.find((p) => p.code === section)?.interfaces ?? []).map((i) => i.code);
}
function allCodes(b: Body): string[] {
  return b.perspectives.flatMap((p) => p.interfaces.map((i) => i.code));
}

// Pages folded into the 6 merge entries (is_active=false in the registry) — they must NOT
// appear in the sidebar anymore; their routes stay live and are reached via the tab bar.
const ABSORBED = [
  "gaps", "kpis", "comp", "analytics-overtime", "analytics-org-network",
  "analytics-skills-by-category", "analytics-skills-group-share",
  "insights-skill-gap", "insights-succession-readiness",
];

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

  it("always returns the 5 sections in display order (honest empty-state)", async () => {
    const b = await interfaces(suite, userC);
    expect(b.perspectives.map((p) => p.code)).toEqual([
      "OVERVIEW", "GOVERNANCE", "WORKFORCE", "INTELLIGENCE", "PERSONAL",
    ]);
  });

  it("PLATFORM_ADMIN sees the full registry incl. admin-only interfaces", async () => {
    const b = await interfaces(suite, adminC);
    expect(codes(b, "OVERVIEW")).toEqual(expect.arrayContaining(["dashboard", "system-health", "brownfield", "seeds", "approvals"]));
    expect(codes(b, "GOVERNANCE")).toEqual(expect.arrayContaining(["blueprints", "processes", "positions", "roles", "skills", "users"]));
    expect(codes(b, "WORKFORCE")).toEqual(expect.arrayContaining(["analytics-workforce", "org", "career-succession", "goals", "okrs"]));
    expect(codes(b, "INTELLIGENCE")).toEqual(expect.arrayContaining(["insights", "viz", "engagement", "content"]));
    expect(codes(b, "PERSONAL")).toEqual(expect.arrayContaining(["me-home", "me-inbox"]));
    // dashboard is the first item of the first section (Enzo req 1)
    expect(codes(b, "OVERVIEW")[0]).toBe("dashboard");
    // absorbed analytics pages are out of the sidebar
    const all = allCodes(b);
    for (const tab of ABSORBED) expect(all).not.toContain(tab);
  });

  it("pure USER sees ONLY the ESS items — no admin-nav leak", async () => {
    const b = await interfaces(suite, userC);
    expect(codes(b, "OVERVIEW")).toEqual([]);
    expect(codes(b, "GOVERNANCE")).toEqual([]);
    expect(codes(b, "WORKFORCE")).toEqual([]);
    expect(codes(b, "INTELLIGENCE")).toEqual([]);
    const personal = codes(b, "PERSONAL").sort();
    // exactly the ESS items (me-team R1b, me-matching AI ②, me-handbook cap④, me-surveys S995),
    // all always-visible self-service gated by perms every role incl. USER holds.
    expect(personal).toEqual(["me-career", "me-handbook", "me-home", "me-inbox", "me-learning", "me-matching", "me-skills", "me-surveys", "me-team"]);
  });

  it("MANAGER (admin-class) is per-permission filtered WITHIN the admin sections", async () => {
    const b = await interfaces(suite, managerC);
    const gov = codes(b, "GOVERNANCE");
    const over = codes(b, "OVERVIEW");
    // holds blueprint:read + bpm_process:read → sees those…
    expect(gov).toEqual(expect.arrayContaining(["blueprints", "processes"]));
    // …but lacks role:read → does NOT see roles
    expect(gov).not.toContain("roles");
    // admin reach → dashboard shows; lacks brownfield/seed perms → not in Overview
    expect(over).toEqual(expect.arrayContaining(["dashboard"]));
    expect(over).not.toContain("brownfield");
    expect(over).not.toContain("seeds");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/interfaces" });
    expect(r.statusCode).toBe(401);
  });
});
