import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

// S971 #2·m2 — surveys / engagement API module (/v1/surveys/*). Real login + live DB (SSH tunnel).
// Reads need surveys:read (6 HRMS roles); writes need surveys:{create,update,delete} (admins+HR).
// Live data = the RTL engagement import: templates 5 / surveys 6 / responses 862.

const PWD = "Admin#PassW0rd!";
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
let plainUser: S;    // USER — no surveys perms
const createdTemplateIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "admin@heuresys.com");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  plainUser = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  for (const id of createdTemplateIds) {
    try { await pool.query("DELETE FROM sys.sys_engagement_survey_templates WHERE template_id = $1", [id]); } catch { /* ignore */ }
  }
  await suite.app.close();
});

describe("surveys API", () => {
  it("GET / — admin lists the imported RTL surveys (6)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/surveys?limit=200", headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(6);
    expect(body.items.length).toBe(6);
  });

  it("GET / — TENANT_ADMIN sees only its own tenant (also 6, single-tenant RTL)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/surveys?limit=200", headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(6);
  });

  it("GET / — plain USER lacks surveys:read -> 403", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/surveys", headers: { cookie: ch(plainUser.cookies) } });
    expect(r.statusCode).toBe(403);
  });

  it("GET /templates returns the 5 imported RTL templates", async () => {
    const p = await suite.app.inject({ method: "GET", url: "/v1/surveys/templates?limit=200", headers: { cookie: ch(admin.cookies) } });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { total: number }).total).toBe(5);
  });

  it("GET /:id/responses — a survey returns its real responses (live event log)", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/surveys?limit=200", headers: { cookie: ch(admin.cookies) } });
    const surveys = (list.json() as { items: { surveyId: string; totalResponses: number }[] }).items;
    // pick the survey with the most responses to assert against a real, non-empty event log
    const target = surveys.reduce((a, b) => (b.totalResponses > a.totalResponses ? b : a), surveys[0]!);
    const r = await suite.app.inject({ method: "GET", url: `/v1/surveys/${target.surveyId}/responses?limit=500`, headers: { cookie: ch(admin.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { responseId: string; subjectUserId: string | null }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    // I14: imported responses resolve their subject to a real sys_users row (0 unresolved on the RTL slice)
    expect(body.items.every((x) => x.subjectUserId !== null)).toBe(true);
  });

  it("the whole RTL slice has 862 responses across surveys (live count via repo path)", async () => {
    const list = await suite.app.inject({ method: "GET", url: "/v1/surveys?limit=200", headers: { cookie: ch(admin.cookies) } });
    const surveys = (list.json() as { items: { surveyId: string }[] }).items;
    let total = 0;
    for (const s of surveys) {
      const r = await suite.app.inject({ method: "GET", url: `/v1/surveys/${s.surveyId}/responses?limit=1`, headers: { cookie: ch(admin.cookies) } });
      total += (r.json() as { total: number }).total;
    }
    expect(total).toBe(862);
  });

  it("POST /templates without CSRF token -> rejected; with token -> 201", async () => {
    const payload = { name: "IT_SURV_TestTemplate", category: "engagement", questions: [{ id: "q1", text: "Test?", type: "rating" }] };
    const noCsrf = await suite.app.inject({ method: "POST", url: "/v1/surveys/templates",
      headers: { cookie: ch(tenantAdmin.cookies), "content-type": "application/json" }, payload });
    expect(noCsrf.statusCode).toBeGreaterThanOrEqual(400);
    const ok = await suite.app.inject({ method: "POST", url: "/v1/surveys/templates",
      headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" }, payload });
    expect(ok.statusCode).toBe(201);
    const created = ok.json() as { templateId: string; name: string; category: string };
    createdTemplateIds.push(created.templateId);
    expect(created.name).toBe("IT_SURV_TestTemplate");
    expect(created.category).toBe("engagement");
  });

  it("full CRUD round-trip on a survey (create -> get -> patch -> delete)", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const c = await suite.app.inject({ method: "POST", url: "/v1/surveys", headers: hdrW, payload: { title: "IT_SURV_Crud", status: "draft", audienceType: "all" } });
    expect(c.statusCode).toBe(201);
    const id = (c.json() as { surveyId: string }).surveyId;
    const g = await suite.app.inject({ method: "GET", url: `/v1/surveys/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(g.statusCode).toBe(200);
    const patch = await suite.app.inject({ method: "PATCH", url: `/v1/surveys/${id}`, headers: hdrW, payload: { status: "active" } });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { status: string }).status).toBe("active");
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/surveys/${id}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(204);
    const gone = await suite.app.inject({ method: "GET", url: `/v1/surveys/${id}`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(gone.statusCode).toBe(404);
  });

  it("USER cannot create (no surveys:create) -> 403", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/surveys/templates",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken, "content-type": "application/json" },
      payload: { name: "IT_SURV_Nope" } });
    expect(r.statusCode).toBe(403);
  });
});
