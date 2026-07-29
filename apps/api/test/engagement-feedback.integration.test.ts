import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// R1 Fase3 (S988) — engagement feedback API module (/v1/engagement-feedback/*). Real login +
// live DB (SSH tunnel). Reads need engagement_feedback:read (6 HRMS roles); writes need
// engagement_feedback:{create,update,delete} (admins + HR). Live data = the RTL engagement import:
// feedback 400 (anonymous) / action_plans 6.

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let admin: S;        // PLATFORM_ADMIN — sees all
let tenantAdmin: S;  // TENANT_ADMIN RTL — read + write in tenant
let plainUser: S;    // USER — no engagement_feedback perms
const createdFeedbackIds: string[] = [];
const createdActionPlanIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  for (const id of createdFeedbackIds) {
    try { await pool.query("DELETE FROM sys.sys_engagement_feedback WHERE feedback_id = $1", [id]); } catch { /* ignore */ }
  }
  for (const id of createdActionPlanIds) {
    try { await pool.query("DELETE FROM sys.sys_engagement_action_plans WHERE action_plan_id = $1", [id]); } catch { /* ignore */ }
  }
  await suite.app.close();
});

describe("engagement-feedback API", () => {
  it("GET / — admin lists the imported RTL feedback (400)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback?limit=1", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(400);
  });

  it("GET / — TENANT_ADMIN sees only its own tenant (also 400, single-tenant RTL)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback?limit=1", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(400);
  });

  it("GET / — plain USER lacks engagement_feedback:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("GET / filter category=concern returns the 100 RTL concern rows", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback?category=concern&limit=1", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(100);
  });

  it("imported feedback is anonymous (no submitter field) but reviewers resolve to real users (I14)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback?status=reviewed&limit=200", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: Record<string, unknown>[] }).items;
    // schema carries NO submitter/author field — anonymity is structural
    expect(items.every((x) => !("submitterUserId" in x) && !("authorUserId" in x))).toBe(true);
    // at least one reviewed feedback resolved its reviewer to a real sys_users row (45 reviewed across RTL)
    const reviewed = items.filter((x) => x.reviewedByUserId !== null);
    expect(reviewed.length).toBeGreaterThan(0);
  });

  it("GET /action-plans — l'amministratore vede tutti i piani d'azione del tenant", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/engagement-feedback/action-plans?limit=50", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { ownerUserId: string | null }[]; total: number };
    // Il numero non è un invariante: la storia C8 aggiunge un piano per ogni
    // rilevazione andata sotto soglia. L'invariante è che l'elenco contenga
    // esattamente i piani del tenant, contati alla fonte.
    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_engagement_action_plans
        WHERE action_plan_tenant_id = $1`,
      [(await pool.query<{ t: string }>(
        `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_email = 'federica.marchetti@rtl-bank.org'`,
      )).rows[0]!.t],
    );
    expect(body.total).toBe(Number(atteso.rows[0]!.n));
    // owners/creators resolved (0 unresolved on the RTL slice)
    expect(body.items.every((x) => x.ownerUserId !== null)).toBe(true);
  });

  it("POST / without CSRF -> rejected; with token -> 201 (create feedback)", async () => {
    const payload = { category: "suggestion", message: "IT_EFB_TestFeedback message" };
    const noCsrf = await suite.app.inject({ method: "POST", url: "/v1/engagement-feedback",
      headers: { cookie: ch(tenantAdmin.cookies), "content-type": "application/json" }, payload });
    expect(noCsrf.statusCode).toBeGreaterThanOrEqual(400);
    const ok = await suite.app.inject({ method: "POST", url: "/v1/engagement-feedback",
      headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" }, payload });
    expect(ok.statusCode).toBe(201);
    const created = ok.json() as { feedbackId: string; category: string; status: string };
    createdFeedbackIds.push(created.feedbackId);
    expect(created.category).toBe("suggestion");
    expect(created.status).toBe("new");
  });

  it("full CRUD round-trip on a feedback (create -> get -> patch status -> delete -> 404)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/engagement-feedback", headers: hdrW, payload: { category: "concern", message: "IT_EFB_Crud" } });
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { feedbackId: string }).feedbackId;
    const g = await suite.app.inject({ method: "GET", url: `/v1/engagement-feedback/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(g.statusCode).toBe(200);
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/engagement-feedback/${id}`, headers: hdrW, payload: { status: "reviewed" } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string }).status).toBe("reviewed");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/engagement-feedback/${id}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
    const gone = await suite.app.inject({ method: "GET", url: `/v1/engagement-feedback/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(gone.statusCode).toBe(404);
  });

  it("full CRUD round-trip on an action plan (create -> patch -> delete)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/engagement-feedback/action-plans", headers: hdrW,
      payload: { sourceType: "feedback", title: "IT_EAP_Crud", priority: "high", dueDate: "2026-12-31" } });
    expect(c.statusCode).toBe(201);
    const created = c.json() as { actionPlanId: string; priority: string; dueDate: string | null };
    createdActionPlanIds.push(created.actionPlanId);
    expect(created.priority).toBe("high");
    expect(created.dueDate).toBe("2026-12-31");
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/engagement-feedback/action-plans/${created.actionPlanId}`, headers: hdrW, payload: { status: "in_progress" } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string }).status).toBe("in_progress");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/engagement-feedback/action-plans/${created.actionPlanId}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
  });

  it("USER cannot create (no engagement_feedback:create) -> 403", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/engagement-feedback",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken, "content-type": "application/json" },
      payload: { category: "other", message: "IT_EFB_Nope" } });
    expect(r.statusCode).toBe(403);
  });
});
