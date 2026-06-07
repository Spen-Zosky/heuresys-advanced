import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";

// S973 #2·m3 — PredictionsML read-model API (/v1/predictions/*). Real login + live DB (SSH tunnel).
// READ-ONLY surface: reads need predictions:read (6 HRMS roles). No writes.
// Live data = the RTL predictive-analytics import: models 4 / predictions 468
//   (156 GENERIC + 156 PERFORMANCE + 156 TURNOVER). All subjects resolve to sys_users (0 unresolved).

const PWD = "Admin#PassW0rd!";
interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let admin: S;        // PLATFORM_ADMIN — sees all
let tenantAdmin: S;  // TENANT_ADMIN RTL — read in own tenant
let plainUser: S;    // USER — no predictions perms

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  await suite.app.close();
});

describe("predictions API (PredictionsML read-model)", () => {
  it("GET /models — admin lists the 4 imported RTL models", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions/models?limit=200", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { type: string }[]; total: number };
    expect(body.total).toBe(4);
    expect(body.items.length).toBe(4);
    // RD-08 typed model_type values come through unaltered
    expect(body.items.every((m) => ["classification", "regression", "clustering"].includes(m.type))).toBe(true);
  });

  it("GET /models — TENANT_ADMIN sees only its own tenant (also 4, single-tenant RTL)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions/models?limit=200", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(4);
  });

  it("GET / — admin lists the full 468-prediction RTL slice", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions?limit=1", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(468);
  });

  it("the 3 folded prediction types each landed 156 rows", async () => {
    for (const t of ["GENERIC", "PERFORMANCE", "TURNOVER"]) {
      const r = await suite.app.inject({ method: "GET", url: `/v1/predictions?type=${t}&limit=1`, headers: { cookie: ch(admin.cookies) } });
      expect(r.statusCode).toBe(200);
      expect((r.json() as { total: number }).total, `type=${t}`).toBe(156);
    }
  });

  it("I14: every imported prediction resolves its subject to a real sys_users row (0 unresolved on RTL slice)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions?limit=500", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { subjectUserId: string | null }[] };
    expect(body.items.length).toBe(468);
    expect(body.items.every((x) => x.subjectUserId !== null)).toBe(true);
  });

  it("provenance is preserved: computedAt + legacy id/source_table in metadata", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions?type=TURNOVER&limit=5", headers: { cookie: ch(admin.cookies) } });
    const items = (r.json() as { items: { computedAt: string | null; validUntil: string | null; metadata: Record<string, unknown> }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((x) => x.computedAt !== null)).toBe(true);
    expect(items.every((x) => x.validUntil !== null)).toBe(true); // turnover rows carry valid_until
    expect(items.every((x) => x.metadata["legacy_prediction_id"] !== undefined)).toBe(true);
    expect(items.every((x) => x.metadata["source_table"] === "turnover_risk_scores")).toBe(true);
  });

  it("GET /:id — fetch a single prediction by id", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/predictions?limit=1", headers: { cookie: ch(admin.cookies) } });
    const id = (list.json() as { items: { predictionId: string }[] }).items[0]!.predictionId;
    const r = await suite.app.inject({ method: "GET", url: `/v1/predictions/${id}`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { predictionId: string }).predictionId).toBe(id);
  });

  it("GET / — plain USER lacks predictions:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/predictions", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });
});
