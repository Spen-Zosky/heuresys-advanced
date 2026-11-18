import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// S971 #2·m2 — surveys / engagement API module (/v1/surveys/*). Real login + live DB (SSH tunnel).
// Reads need surveys:read (6 HRMS roles); writes need surveys:{create,update,delete} (admins+HR).
// Live data = the RTL engagement import: templates 5 / surveys 6 / responses 862.

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
let plainUser: S;    // USER — no surveys perms
const createdTemplateIds: string[] = [];

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login(suite, "platform-test-admin@collaudo.invalid");
  tenantAdmin = await login(suite, "governo@collaudo.invalid");
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

  // Ondata 5 (2026-11-18): resta un solo modello di sondaggio, quello di /engagement (000497).
  // Le scritture di /v1/surveys sono RITIRATE (lib/rotte-ritirate.ts): 410, e nessuna riga cambia.
  it("le scritture del modello vecchio rispondono 410 e non toccano le righe", async () => {
    const hdrW = { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken, "content-type": "application/json" };
    const s = await pool.query<{ id: string; status: string }>("SELECT survey_id AS id, survey_status AS status FROM sys.sys_engagement_surveys ORDER BY survey_id LIMIT 1");
    expect(s.rows.length, "nessun sondaggio del modello vecchio").toBe(1);
    const t = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sys.sys_engagement_survey_templates");
    const prove = [
      { method: "POST" as const, url: "/v1/surveys/templates", payload: { name: "IT_SURV_TestTemplate", category: "engagement", questions: [{ id: "q1", text: "Test?", type: "rating" }] } },
      { method: "POST" as const, url: "/v1/surveys", payload: { title: "IT_SURV_Crud", status: "draft", audienceType: "all" } },
      { method: "PATCH" as const, url: `/v1/surveys/${s.rows[0]!.id}`, payload: { status: "draft" } },
    ];
    for (const p of prove) {
      const r = await suite.app.inject({ ...p, headers: hdrW });
      expect(r.statusCode, `${p.method} ${p.url}`).toBe(410);
    }
    const del = await suite.app.inject({ method: "DELETE", url: `/v1/surveys/${s.rows[0]!.id}`, headers: { cookie: ch(tenantAdmin.cookies), "x-csrf-token": tenantAdmin.csrfToken } });
    expect(del.statusCode).toBe(410);
    const dopo = await pool.query<{ status: string }>("SELECT survey_status AS status FROM sys.sys_engagement_surveys WHERE survey_id = $1", [s.rows[0]!.id]);
    expect(dopo.rows[0]!.status).toBe(s.rows[0]!.status);
    const t2 = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM sys.sys_engagement_survey_templates");
    expect(t2.rows[0]!.n).toBe(t.rows[0]!.n);
  });

  it("USER cannot create (no surveys:create) -> 403", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/surveys/templates",
      headers: { cookie: ch(plainUser.cookies), "x-csrf-token": plainUser.csrfToken, "content-type": "application/json" },
      payload: { name: "IT_SURV_Nope" } });
    expect(r.statusCode).toBe(403);
  });
});
