/**
 * apps/api/test/performance-reviews.integration.test.ts — #92 passo 3/7.
 * Le 548 valutazioni storiche reali sul filo: l'HR le legge tutte, il manager
 * di linea SOLO quelle del suo sotto-albero (I18, oracolo = albero delle
 * unita'), il platform le vede senza giudizio (ADR-0032), chi non ha il
 * permesso non entra. Ogni atteso deriva dal DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const HR_EMAIL = "federica.marchetti@rtl-bank.org";
const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";

const JUDGMENT = [
  "areasForImprovement", "calibratedRating", "calibrationNotes",
  "careerAspirations", "competencyRating", "developmentPlan",
  "employeeComments", "goalAchievementRating", "managerComments",
  "overallRating", "performanceBox", "potentialBox", "potentialRating",
  "preCalibrationRating", "selfComments", "selfRating", "strengths",
];

let t: TestApp;
const cookies: Record<string, string> = {};
let capoEmail = "";
let capoId = "";
let dbTotalRtl = 0;
let capoExpected = 0;

async function cookieOf(email: string): Promise<string> {
  const r = await loginRaw(t.app, email);
  return r.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
}

beforeAll(async () => {
  t = await buildTestApp();
  cookies.hr = await cookieOf(HR_EMAIL);
  cookies.platform = await cookieOf(PLATFORM_EMAIL);

  dbTotalRtl = Number((await pool.query(
    `SELECT count(*)::int AS n FROM sys.sys_performance_reviews r
      WHERE r.review_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1)`,
    [HR_EMAIL])).rows[0]!.n);

  // Un capo di linea autenticabile senza mandato HR/platform (derivato).
  const capo = (await pool.query<{ id: string; email: string }>(
    `SELECT u.user_id AS id, u.user_email AS email FROM sys.sys_users u
      WHERE EXISTS (SELECT 1 FROM sys.sys_organization_units ou
                     WHERE ou.organization_unit_manager_user_id = u.user_id AND ou.organization_unit_is_active)
        AND EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                     JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
                    WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
        AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f WHERE f.auth_mfa_factor_user_id = u.user_id)
        AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                     JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
                     JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
                    WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                      AND p.auth_permission_code = 'performance-review:read')
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                          JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur.user_auth_role_role_id
                         WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                           AND r2.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER','PLATFORM_ADMIN'))
      ORDER BY u.user_email LIMIT 1`)).rows[0];
  if (!capo) throw new Error("nessun capo di linea con performance-review:read: verifica cieca");
  capoEmail = capo.email;
  capoId = capo.id;
  cookies.capo = await cookieOf(capoEmail);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

async function listAs(who: string, qs = "limit=200"): Promise<{ raw: string; items: Record<string, unknown>[]; total: number }> {
  const res = await t.app.inject({ method: "GET", url: `/v1/performance-reviews/?${qs}`, headers: { cookie: cookies[who]! } });
  expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
  const j = res.json() as { items: Record<string, unknown>[]; total: number };
  return { raw: res.body, items: j.items, total: j.total };
}

describe("#92 passo 3/7 — /v1/performance-reviews", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(dbTotalRtl).toBeGreaterThan(0);
  });

  it("l'HR legge tutte le valutazioni del tenant, coi giudizi", async () => {
    const { items, total } = await listAs("hr");
    expect(total).toBe(dbTotalRtl);
    expect(items.length).toBeGreaterThan(0);
    const withRating = items.filter((r) => r["overallRating"] != null);
    expect(withRating.length, "nessun rating visibile all'HR: prova cieca").toBeGreaterThan(0);
    for (const r of items) expect(r["masked"]).toBeUndefined();
  });

  it("il capo di linea vede SOLO il suo sotto-albero (oracolo: albero delle unità)", async () => {
    // atteso derivato dall'albero delle unita' — struttura indipendente dal resolver
    capoExpected = Number((await pool.query(
      `WITH RECURSIVE sue(unita) AS (
         SELECT organization_unit_id FROM sys.sys_organization_units
          WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active
         UNION
         SELECT o.organization_unit_id FROM sys.sys_organization_units o JOIN sue ON o.organization_unit_parent_id = sue.unita
          WHERE o.organization_unit_is_active)
       SELECT count(*)::int AS n FROM sys.sys_performance_reviews r
        WHERE r.review_subject_user_id = $1
           OR r.review_subject_user_id IN (
             SELECT a.user_position_assignment_user_id
               FROM sue JOIN sys.sys_positions p ON p.position_organization_unit_id = sue.unita
               JOIN sys.sys_user_position_assignments a
                 ON a.user_position_assignment_position_id = p.position_id
                AND a.user_position_assignment_status = 'ACTIVE')`,
      [capoId])).rows[0]!.n);
    expect(capoExpected, `${capoEmail}: nessuna valutazione nel sotto-albero — universo vuoto`).toBeGreaterThan(0);

    const { items, total } = await listAs("capo");
    expect(total).toBe(capoExpected);
    expect(total).toBeLessThan(dbTotalRtl); // isolamento: il capo non e' l'HR
    for (const r of items) expect(r["masked"]).toBeUndefined(); // line_management legge (matrice)
  });

  it("platform: la riga resta, il giudizio no — e la CHIAVE non compare nel body", async () => {
    const { raw, items } = await listAs("platform", "limit=50");
    expect(items.length).toBeGreaterThan(0);
    for (const r of items) {
      expect(r["masked"]).toEqual([...JUDGMENT].sort());
      expect(r["subjectUserId"]).toBeTruthy();
      expect(r["status"], "lo stato resta (ADR-0032)").toBeTruthy();
    }
    // come per assessment-results: il giudizio e' tutto nei rating, quindi si
    // cerca la CHIAVE nel body grezzo, non il valore
    expect(raw.includes('"overallRating":')).toBe(false);
    expect(raw.includes('"calibratedRating":')).toBe(false);
  });

  it("un soggetto esplicito fuori portata risponde pagina vuota, non i dati altrui", async () => {
    // la CEO del tenant e' fuori dal sotto-albero di un capo intermedio
    const ceo = (await pool.query<{ id: string }>(
      `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`, [HR_EMAIL])).rows[0]!;
    const { items, total } = await listAs("capo", `limit=50&subjectUserId=${ceo.id}`);
    expect(total).toBe(0);
    expect(items).toEqual([]);
  });
});
