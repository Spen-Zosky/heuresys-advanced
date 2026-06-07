import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";

// Cap③ data-mining — in-platform flight-risk scoring (/v1/insights/*). Real login + live DB.
// insights:view = 6 non-leaf HRMS roles (admin/manager-only, D-6; no ESS for USER/READ_ONLY).
// insights:admin (recompute, CSRF) = PLATFORM_ADMIN/TENANT_ADMIN/HRMS_MANAGER.
// The score is a DETERMINISTIC weighted-linear rule over live sys.* features.

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

interface Feature { feature: string; weight: number; normalized: number | null }
interface Item { userId: string; tenantId: string; score: number; band: string; modelVersion: string; features: Feature[] }
interface ListBody { scope: { kind: string; tenantId: string | null }; items: Item[]; total: number }

const BANDS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const FEATURE_KEYS = ["attendance", "comp", "engagement", "kpi", "promotion", "tenure"];

let suite: TestApp;
let admin: S;        // PLATFORM_ADMIN
let tenantAdmin: S;  // TENANT_ADMIN (RTL)
let manager: S;      // MANAGER (RTL) — view yes, admin no
let plainUser: S;    // USER — no insights perms

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => { await suite.app.close(); });

async function recompute(s: S) {
  return suite.app.inject({
    method: "POST", url: "/v1/insights/recompute",
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: {}, // recompute takes no body; send an empty JSON object so the parser is happy
  });
}
async function list(s: S) {
  return suite.app.inject({ method: "GET", url: "/v1/insights/flight-risk", headers: { cookie: ch(s.cookies) } });
}

describe("insights API (cap③ flight-risk)", () => {
  it("RBAC: plain USER lacks insights:view → 403 on list", async () => {
    expect((await list(plainUser)).statusCode).toBe(403);
  });

  it("RBAC: plain USER cannot recompute → 403", async () => {
    expect((await recompute(plainUser)).statusCode).toBe(403);
  });

  it("RBAC: MANAGER has insights:view but NOT insights:admin", async () => {
    expect((await list(manager)).statusCode).toBe(200);
    expect((await recompute(manager)).statusCode).toBe(403);
  });

  it("CSRF: admin recompute without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/insights/recompute",
      headers: { cookie: ch(admin.cookies), "content-type": "application/json" },
      payload: {}, // valid body so parsing passes → verifyCsrf runs (no token → CSRF_FAIL)
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("recompute (admin) scores the platform population in-platform", async () => {
    const r = await recompute(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { accepted: boolean; scored: number; modelVersion: string };
    expect(b.accepted).toBe(true);
    expect(b.scored).toBeGreaterThan(100);
    expect(b.modelVersion).toBe("flight-risk-v1");
  });

  it("list (admin): valid bands/scores, sorted desc, explainable (weights sum 1.0)", async () => {
    const r = await list(admin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as ListBody;
    expect(b.scope.kind).toBe("PLATFORM");
    expect(b.items.length).toBeGreaterThan(100);
    for (const it of b.items.slice(0, 20)) {
      expect(BANDS).toContain(it.band);
      expect(it.score).toBeGreaterThanOrEqual(0);
      expect(it.score).toBeLessThanOrEqual(100);
      expect(it.modelVersion).toBe("flight-risk-v1");
    }
    for (let i = 1; i < Math.min(b.items.length, 30); i++) {
      expect(b.items[i - 1]!.score).toBeGreaterThanOrEqual(b.items[i]!.score);
    }
    const top = b.items[0]!;
    const wsum = top.features.reduce((s, f) => s + f.weight, 0);
    expect(Math.abs(wsum - 1)).toBeLessThan(0.01);
    expect(top.features.map((f) => f.feature).sort()).toEqual(FEATURE_KEYS);
  });

  it("deterministic: recompute twice → identical active score for a subject", async () => {
    const top = ((await list(admin)).json() as ListBody).items[0]!;
    expect((await recompute(admin)).statusCode).toBe(200);
    const r = await suite.app.inject({
      method: "GET", url: `/v1/insights/users/${top.userId}/flight-risk`, headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const after = r.json() as Item;
    expect(after.score).toBe(top.score);
    expect(after.band).toBe(top.band);
  });

  it("single subject: 404 for an unknown user id", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/insights/users/00000000-0000-0000-0000-000000000000/flight-risk",
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });

  it("I5: TENANT_ADMIN sees only its own tenant's scores (platform is a superset)", async () => {
    const adminList = (await list(admin)).json() as ListBody;
    const taResp = await list(tenantAdmin);
    expect(taResp.statusCode).toBe(200);
    const ta = taResp.json() as ListBody;
    expect(ta.scope.kind).toBe("TENANT");
    expect(ta.items.length).toBeGreaterThan(0);
    expect(new Set(ta.items.map((i) => i.tenantId)).size).toBe(1);
    expect(adminList.total).toBeGreaterThanOrEqual(ta.total);
  });

  it("D-6: plain USER cannot read a single flight-risk (no ESS self-view) → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/insights/users/${plainUser.userId}/flight-risk`, headers: { cookie: ch(plainUser.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });
});
