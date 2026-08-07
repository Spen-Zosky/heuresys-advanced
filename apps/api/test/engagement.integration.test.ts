import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

// B-10b m2b — normalized engagement read-model (/v1/engagement/*). Real login + live DB.
// Read-only; permission reuses surveys:read (6 HRMS roles). RTL slice: 8 surveys / 3792
// responses / 733 pulse checks (all employee-resolved, I14).

const PWD = TEST_PERSONA_PASSWORD;
interface S { cookies: Map<string, string> }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

let suite: TestApp;
let admin: S;       // PLATFORM_ADMIN — unfiltered
let tenantAdmin: S; // TENANT_ADMIN (RTL) — surveys:read, own tenant
let user: S;        // USER — lacks surveys:read → 403

async function login(email: string): Promise<S> {
  const r = await loginRaw(suite.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}
const get = (url: string, s: S) => suite.app.inject({ method: "GET", url, headers: { cookie: ch(s.cookies) } });

beforeAll(async () => {
  suite = await buildTestApp();
  admin = await login("enzo.spenuso@heuresys.com");
  tenantAdmin = await login("federica.marchetti@rtl-bank.org");
  user = await login("tommaso.fiore@rtl-bank.org");
});
afterAll(async () => { await suite.app.close(); });

describe("engagement normalized read-model (m2b)", () => {
  it("RBAC: a USER lacking surveys:read is denied (403) on /surveys", async () => {
    expect((await get("/v1/engagement/surveys", user)).statusCode).toBe(403);
  });

  it("TENANT_ADMIN lists the RTL normalized surveys with derived counts", async () => {
    const r = await get("/v1/engagement/surveys", tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { surveyId: string; tenantId: string; questionCount: number; responseCount: number }[]; total: number };
    // Quante rilevazioni ci siano non è un invariante — la storia C8 ne
    // aggiunge una per semestre. L'invariante è che l'elenco le porti tutte.
    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_surveys s
        JOIN sys.sys_users u ON u.user_tenant_id = s.survey_tenant_id
       WHERE u.user_email = 'federica.marchetti@rtl-bank.org'`,
    );
    expect(b.total).toBe(Number(atteso.rows[0]!.n));
    expect(b.items.length).toBe(b.total);
    // i conteggi sono veri: si confrontano con la fonte, non con una fotografia
    const somme = await pool.query<{ risposte: string; domande: string }>(
      `SELECT (SELECT count(*) FROM sys.sys_survey_responses r
                JOIN sys.sys_surveys s2 ON s2.survey_id = r.survey_response_survey_id
               WHERE s2.survey_tenant_id = u.user_tenant_id)::text AS risposte,
              (SELECT count(*) FROM sys.sys_survey_questions q
                JOIN sys.sys_surveys s3 ON s3.survey_id = q.survey_question_survey_id
               WHERE s3.survey_tenant_id = u.user_tenant_id)::text AS domande
         FROM sys.sys_users u WHERE u.user_email = 'federica.marchetti@rtl-bank.org'`,
    );
    expect(b.items.reduce((s, x) => s + x.responseCount, 0)).toBe(Number(somme.rows[0]!.risposte));
    expect(b.items.reduce((s, x) => s + x.questionCount, 0)).toBe(Number(somme.rows[0]!.domande));
  });

  it("PLATFORM_ADMIN sees the same RTL surveys (only tenant with data)", async () => {
    const b = (await get("/v1/engagement/surveys", admin)).json() as { total: number };
    expect(b.total).toBeGreaterThanOrEqual(8);  // almeno quelle originarie
  });

  it("per-survey results aggregate by question (count + avg rating)", async () => {
    const list = (await get("/v1/engagement/surveys", tenantAdmin)).json() as {
      items: { surveyId: string; responseCount: number }[];
    };
    // una rilevazione CHE HA RISPOSTE: la prima dell'elenco può essere una
    // archiviata perché non si è mai svolta, e su quella non c'è niente da
    // aggregare — l'invariante riguarda le rilevazioni che hanno raccolto voti
    const conRisposte = list.items.find((x) => x.responseCount > 0);
    expect(conRisposte, "nessuna rilevazione con risposte").toBeDefined();
    const id = conRisposte!.surveyId;
    const r = await get(`/v1/engagement/surveys/${id}/results`, tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { surveyId: string; questions: { responseCount: number; avgRating: number | null }[] };
    expect(b.surveyId).toBe(id);
    expect(b.questions.length).toBeGreaterThan(0);
    expect(b.questions.some((q) => q.avgRating !== null && q.avgRating > 0)).toBe(true);
  });

  it("404 on unknown survey id results (no tenant enumeration)", async () => {
    const r = await get("/v1/engagement/surveys/00000000-0000-0000-0000-000000000000/results", tenantAdmin);
    expect(r.statusCode).toBe(404);
  });

  it("pulse aggregation buckets by week with averages (RTL, expected derived live)", async () => {
    // no-hardcoded-test-data: the expected total is derived from the same live
    // table the endpoint reads (733 native LEGACY_PC:: + the #47 D2 history —
    // LEGACY_CI:: check-in moods and LEGACY_WB:: wellbeing moods — and any
    // future ingest), scoped to the tenant admin's tenant like the service.
    const expected = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_pulse_checks
        WHERE pulse_check_tenant_id =
              (SELECT user_tenant_id FROM sys.sys_users
                WHERE user_email = 'federica.marchetti@rtl-bank.org')`,
    );
    const n = expected.rows[0]!.n;
    expect(n).toBeGreaterThan(0);

    const r = await get("/v1/engagement/pulse", tenantAdmin);
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: { weekNumber: number | null; count: number; avgMood: number | null }[]; totalChecks: number };
    expect(b.totalChecks).toBe(n);
    expect(b.items.length).toBeGreaterThan(0);
    expect(b.items.reduce((s, x) => s + x.count, 0)).toBe(n);
    expect(b.items.some((x) => x.avgMood !== null)).toBe(true);
  });

  /* --- survey templates mirror (#6/#10) --------------------------------- */

  it("RBAC: a USER lacking surveys:read is denied (403) on /templates", async () => {
    expect((await get("/v1/engagement/templates", user)).statusCode).toBe(403);
  });

  it("TENANT_ADMIN sees only the RTL template (tenant-scoped); PLATFORM_ADMIN sees both", async () => {
    const rtl = await get("/v1/engagement/templates", tenantAdmin);
    expect(rtl.statusCode).toBe(200);
    const rb = rtl.json() as { items: { tenantId: string; name: string; questionCount: number; type: string | null }[]; total: number };
    expect(rb.total).toBe(1); // legacy 0c54b84a -> RTL only
    expect(rb.items[0]!.name).toBe("Custom Engagement Survey");
    expect(rb.items[0]!.questionCount).toBe(5);
    expect(rb.items[0]!.type).toBe("custom");

    const all = (await get("/v1/engagement/templates", admin)).json() as { items: { tenantId: string }[]; total: number };
    // PLATFORM_ADMIN unfiltered: RTL + HEURESYS mapped templates.
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect(new Set(all.items.map((x) => x.tenantId)).size).toBeGreaterThanOrEqual(2);
  });
});
