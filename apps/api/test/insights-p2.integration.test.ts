import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// Cap③ data-mining P2 — succession-readiness (slice B) + skill-gap (slice C).
// In-platform-derived over the ② embedding substrate; admin/manager-only (insights:view,
// D-6); recompute = insights:admin + CSRF. Real login + live DB.

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface Feature { feature: string; weight: number; normalized: number | null; contribution: number }
interface RItem { userId: string; tenantId: string; positionId: string; value: number; horizon: string; features: Feature[] }
interface GItem { userId: string; tenantId: string; positionId: string; value: number; segment: string; features: Feature[] }

const HORIZONS = ["READY_NOW", "READY_6_MONTHS", "READY_1_YEAR", "READY_2_YEARS", "NOT_READY"];
const SEGMENTS = ["ALIGNED", "MINOR_GAP", "MODERATE_GAP", "MAJOR_GAP"];

let suite: TestApp;
let admin: S, tenantAdmin: S, manager: S, plainUser: S;

function csrf(s: S) { return { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" }; }
function recompute(s: S, slice: "succession-readiness" | "skill-gap") {
  return suite.app.inject({ method: "POST", url: `/v1/insights/${slice}/recompute`, headers: csrf(s), payload: {} });
}
function list(s: S, slice: "succession-readiness" | "skill-gap") {
  return suite.app.inject({ method: "GET", url: `/v1/insights/${slice}`, headers: { cookie: ch(s.cookies) } });
}

describe("insights API P2 (cap③ succession-readiness + skill-gap)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite, "admin@heuresys.com");
    tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
    manager = await login(suite, "paolo.caputo@rtl-bank.org");
    plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
    // populate both slices once (PLATFORM scope)
    expect((await recompute(admin, "succession-readiness")).statusCode).toBe(200);
    expect((await recompute(admin, "skill-gap")).statusCode).toBe(200);
  });
  afterAll(async () => { await suite.app.close(); });

  it("RBAC: plain USER lacks insights:view → 403 on both lists", async () => {
    expect((await list(plainUser, "succession-readiness")).statusCode).toBe(403);
    expect((await list(plainUser, "skill-gap")).statusCode).toBe(403);
  });

  it("RBAC: MANAGER can view but NOT recompute (insights:admin)", async () => {
    expect((await list(manager, "succession-readiness")).statusCode).toBe(200);
    expect((await recompute(manager, "succession-readiness")).statusCode).toBe(403);
    expect((await recompute(manager, "skill-gap")).statusCode).toBe(403);
  });

  it("slice B: recompute scores subjects → list has valid horizon + explainable features, sorted desc", async () => {
    const rc = await recompute(admin, "succession-readiness");
    expect(rc.statusCode).toBe(200);
    expect((rc.json() as { scored: number }).scored).toBeGreaterThan(0);

    const b = (await list(admin, "succession-readiness")).json() as { items: RItem[]; total: number };
    expect(b.total).toBeGreaterThan(0);
    const it0 = b.items[0]!;
    expect(HORIZONS).toContain(it0.horizon);
    expect(it0.value).toBeGreaterThanOrEqual(0);
    expect(it0.value).toBeLessThanOrEqual(100);
    expect(it0.positionId).toBeTruthy();
    // explainability: position_fit always present, weights re-normalize to sum ~1
    const keys = it0.features.map((f) => f.feature);
    expect(keys).toContain("position_fit");
    const wsum = it0.features.filter((f) => f.normalized !== null).reduce((s, f) => s + f.weight, 0);
    expect(wsum).toBeGreaterThan(0.99);
    expect(wsum).toBeLessThan(1.01);
    // sorted highest readiness first
    expect(b.items[0]!.value).toBeGreaterThanOrEqual(b.items[b.items.length - 1]!.value);
  });

  it("slice B: deterministic — two recomputes yield the same active scores", async () => {
    await recompute(admin, "succession-readiness");
    const a = (await list(admin, "succession-readiness")).json() as { items: RItem[] };
    await recompute(admin, "succession-readiness");
    const c = (await list(admin, "succession-readiness")).json() as { items: RItem[] };
    const key = (i: RItem) => `${i.userId}:${i.positionId}=${i.value}`;
    expect(a.items.map(key).sort()).toEqual(c.items.map(key).sort());
  });

  it("slice C: recompute → list has valid segment + 2 explainable features (role_fit_gap, evidence_sparsity)", async () => {
    const rc = await recompute(admin, "skill-gap");
    expect(rc.statusCode).toBe(200);
    expect((rc.json() as { scored: number }).scored).toBeGreaterThan(0);

    const g = (await list(admin, "skill-gap")).json() as { items: GItem[]; total: number };
    expect(g.total).toBeGreaterThan(0);
    const it0 = g.items[0]!;
    expect(SEGMENTS).toContain(it0.segment);
    expect(it0.value).toBeGreaterThanOrEqual(0);
    expect(it0.value).toBeLessThanOrEqual(100);
    const keys = it0.features.map((f) => f.feature).sort();
    expect(keys).toEqual(["evidence_sparsity", "role_fit_gap"]);
  });

  it("D-18: recompute is bounded — one active row per (user[,position]), no accumulation", async () => {
    const stat = async (sql: string) => Number((await pool.query<{ n: string }>(sql)).rows[0]!.n);
    // slice B: one row per (user, target position); a 2nd recompute must not grow the table
    await recompute(admin, "succession-readiness");
    const srRows1 = await stat(`SELECT count(*)::int AS n FROM sys.sys_succession_readiness_scores`);
    const srKeys1 = await stat(
      `SELECT count(DISTINCT (succession_readiness_score_user_id, succession_readiness_score_position_id))::int AS n
         FROM sys.sys_succession_readiness_scores`,
    );
    expect(srRows1).toBe(srKeys1);
    await recompute(admin, "succession-readiness");
    expect(await stat(`SELECT count(*)::int AS n FROM sys.sys_succession_readiness_scores`)).toBe(srRows1);
    // slice C: one row per user
    await recompute(admin, "skill-gap");
    const sgRows1 = await stat(`SELECT count(*)::int AS n FROM sys.sys_skill_gap_scores`);
    const sgUsers1 = await stat(`SELECT count(DISTINCT skill_gap_score_user_id)::int AS n FROM sys.sys_skill_gap_scores`);
    expect(sgRows1).toBe(sgUsers1);
    await recompute(admin, "skill-gap");
    expect(await stat(`SELECT count(*)::int AS n FROM sys.sys_skill_gap_scores`)).toBe(sgRows1);
  });

  it("I5: TENANT_ADMIN sees only its own tenant's scores", async () => {
    const b = (await list(tenantAdmin, "succession-readiness")).json() as { scope: { kind: string }; items: RItem[] };
    expect(b.scope.kind).toBe("TENANT");
    const tenants = new Set(b.items.map((i) => i.tenantId));
    expect(tenants.size).toBeLessThanOrEqual(1); // own tenant only (or empty)
  });
});
