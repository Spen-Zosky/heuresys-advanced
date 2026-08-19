/**
 * apps/api/test/insights-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the INSIGHTS module (ADR-0027, closes D-50).
 *
 * The insights module exposes three cross-user, SENSITIVE (EVALUATION-class) per-person
 * slices — flight-risk, succession-readiness, skill-gap — each keyed on a subject
 * *_user_id column (flight_risk_score_user_id / succession_readiness_score_user_id /
 * skill_gap_score_user_id). Today reads are gated by insights:view + a PLATFORM/TENANT/TEAM
 * scope (service.ts buildScope), but with NO org-chart validation: the repo filters lists by
 * tenant (+ the MANAGER's OWNED positions) only, and the per-subject read
 * (GET /users/:userId/flight-risk) trusts that same scope. So a tenant-scoped actor without an
 * HR mandate can read ANOTHER user's sensitive score tenant-wide, regardless of org-chart
 * position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList layered onto the repo
 *                 ScopeFilter, filtering `<subject>_user_id = ANY($n::uuid[])`.
 *   - GET-by-id → canReadOrgTarget(pool, actor, userId, row.tenantId) after the fetch,
 *                 NotFoundError (404, not 403) when false to avoid existence enumeration.
 *
 * WHY paolo carries an inline PROCESS_OWNER grant here (and NOT in the assessments/users
 * suites): insights already sub-scopes a plain MANAGER to the positions he OWNS
 * (findOwnedPositionIds), which — for these seed personas — already excludes the outsider
 * antonio, so a plain-MANAGER paolo does NOT currently leak. The D-50 leak the fix actually
 * closes is a TENANT-scoped actor WITHOUT an HR mandate reading across the org chart. We model
 * exactly that class by granting paolo PROCESS_OWNER (a TENANT-scope role in insights' scopeKind,
 * NON-HR-mandated in the resolver): his CURRENT scope resolves tenant-wide (leaky → the test is
 * RED), while post-fix his ORGANIZATIONAL scope (resolveOrgReadScope → subtree via his MANAGER
 * role) still excludes org peers (antonio denied → GREEN). The grant is created BEFORE login
 * (roles are minted into the JWT at login) and hard-deleted in afterAll. Every user id comes
 * from the live login response; no data count is hardcoded — assertions are INVARIANTS
 * (outsider rows absent / outsider get-by-id blocked), per Enzo's rule.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships:
 *   - il capo (ATTORI.capo)       MANAGER (+PROCESS_OWNER fixture) → org sub-tree; tommaso is his report
 *   - il sottoposto (ATTORI.sottoposto)      USER          → IN paolo's sub-tree (report); no insights:view
 *   - l'estraneo (ATTORI.estraneo)     USER          → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - il mandato HR (ATTORI.hr) TENANT_ADMIN  → HR-mandated, tenant-wide (I20)
 *   - la piattaforma (ATTORI.piattaforma)              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * insights:view is admin/manager-only (D-6, no ESS self-view). A plain USER (tommaso/antonio)
 * has NO insights:view at all — the strongest self-floor: no cross-user read surface exists for
 * them (asserted as 403).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";
import { attoriDiScena } from "./helpers/attori-di-scena.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — fuori dalla cache delle sessioni. Questo file o ragiona sulla SESSIONE stessa
// (elenco/revoca delle famiglie), oppure MUTA i ruoli dell'attore: in entrambi i casi una
// sessione presa da un altro file risponderebbe con un assetto che non e' quello che il
// test ha appena costruito. Misurato: senza questa riga, 6 file rossi in corsa integrale.
senzaCacheDiSessione();

/**
 * I cinque ruoli di scena, derivati dal dato di oggi invece che scritti a mano (#147).
 * Non sono cinque persone: sono cinque CARATTERISTICHE, e ognuna e' verificata alla
 * risoluzione — se domani non esiste piu' un capo con sottoposti, questo file si ferma
 * dicendo cosa manca, invece di misurare un caso limite in silenzio.
 */
const ATTORI = await attoriDiScena();


const PWD = TEST_PERSONA_PASSWORD;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

interface ListItem {
  userId: string;
  tenantId: string;
}
interface ListBody {
  scope: { kind: string; tenantId: string | null };
  items: ListItem[];
  total: number;
}
interface SingleScore {
  userId: string;
  tenantId: string;
  score: number;
  band: string;
}

let suite: TestApp;
let paolo: S; // MANAGER + PROCESS_OWNER fixture — tenant-scoped now, org sub-tree post-fix
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let processOwnerGrantId: string; // fixture role grant — hard-deleted in afterAll

async function recompute(s: S, path: string): Promise<{ statusCode: number }> {
  return suite.app.inject({
    method: "POST",
    url: `/v1/insights/${path}`,
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: {},
  });
}
async function listFlightRisk(s: S) {
  return suite.app.inject({ method: "GET", url: "/v1/insights/flight-risk", headers: { cookie: ch(s.cookies) } });
}
async function getFlightRisk(s: S, userId: string) {
  return suite.app.inject({
    method: "GET",
    url: `/v1/insights/users/${userId}/flight-risk`,
    headers: { cookie: ch(s.cookies) },
  });
}
async function listReadiness(s: S) {
  return suite.app.inject({ method: "GET", url: "/v1/insights/succession-readiness", headers: { cookie: ch(s.cookies) } });
}
async function listSkillGap(s: S) {
  return suite.app.inject({ method: "GET", url: "/v1/insights/skill-gap", headers: { cookie: ch(s.cookies) } });
}

describe("/v1/insights — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();

    // ── Fixture: elevate paolo with a TENANT-scoped, NON-HR-mandated role so the CURRENT
    // (leaky) insights scope resolves tenant-wide for him — the exact D-50 leak class the fix
    // closes. Granted BEFORE login (roles are read into the JWT at login) and hard-deleted in
    // afterAll. Idempotent: any leftover PROCESS_OWNER grant for paolo is cleared first.
    const pr = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [ATTORI.capo.email],
    );
    const paoloRow = pr.rows[0]!;
    await pool.query(
      `DELETE FROM sys.sys_user_auth_roles
         WHERE user_auth_role_user_id = $1
           AND user_auth_role_role_id = (SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'PROCESS_OWNER')`,
      [paoloRow.user_id],
    );
    const grant = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_user_auth_roles
         (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_by)
       VALUES ($1, (SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'PROCESS_OWNER'), $2, $1)
       RETURNING user_auth_role_id AS id`,
      [paoloRow.user_id, paoloRow.user_tenant_id],
    );
    processOwnerGrantId = grant.rows[0]!.id;

    paolo = await login(suite, ATTORI.capo.email);
    // [S1045] Il sottoposto e l'estraneo non sono piu' due nomi scritti a mano:
    // li sceglie l'albero delle unita' di oggi (helpers/org-actors.ts). La
    // ricostruzione aveva INVERTITO i due ruoli, e i nomi fissi descrivevano
    // l'azienda di ieri.
    const sottoposto = await unSottopostoOrganizzativo(pool, paolo.userId);
    const estraneo = await unEstraneoOrganizzativo(pool, paolo.userId);
    tommaso = await login(suite, sottoposto.email);
    antonio = await login(suite, estraneo.email);
    federica = await login(suite, ATTORI.hr.email);
    admin = await login(suite, ATTORI.piattaforma.email);

    // Guarantee derived rows exist for the whole active population (tommaso + antonio incl.)
    // so the positive/anti-leak assertions have real subjects. Flight-risk is the primary
    // per-target surface (asserted 200); readiness/skill-gap recompute is best-effort (their
    // subjects already have derived rows in the seed — the anti-leak invariant holds regardless).
    const rc = await recompute(admin, "recompute");
    expect(rc.statusCode).toBe(200);
    await recompute(admin, "succession-readiness/recompute");
    await recompute(admin, "skill-gap/recompute");
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_id = $1`, [processOwnerGrantId]);
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo CAN read his report tommaso's flight-risk via GET-by-id → 200", async () => {
    const r = await getFlightRisk(paolo, tommaso.userId);
    expect(r.statusCode).toBe(200);
    expect((r.json() as SingleScore).userId).toBe(tommaso.userId);
  });

  it("paolo's flight-risk LIST contains his report tommaso", async () => {
    const r = await listFlightRisk(paolo);
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(body.items.some((i) => i.userId === tommaso.userId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo MUST NOT read OUTSIDER antonio's flight-risk via GET-by-id → 404", async () => {
    const r = await getFlightRisk(paolo, antonio.userId);
    // Pre-fix (leaky): paolo's tenant-wide scope returns antonio's row → 200. Post-fix:
    // canReadOrgTarget(paolo, antonio) is false (antonio is an org peer, not in the sub-tree) →
    // NotFoundError. 404 hides existence across the org boundary.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio MUST NOT appear in paolo's flight-risk LIST", async () => {
    const r = await listFlightRisk(paolo);
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    // Core anti-leak invariant: not a single row belonging to the outsider may surface,
    // regardless of counts. Pre-fix (tenant-only filter) antonio leaks through; post-fix
    // (userIdAllowList = paolo's sub-tree, excludes antonio) the set omits him.
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
  });

  it("LEAK: OUTSIDER antonio MUST NOT appear in paolo's succession-readiness LIST", async () => {
    const r = await listReadiness(paolo);
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
  });

  it("LEAK: OUTSIDER antonio MUST NOT appear in paolo's skill-gap LIST", async () => {
    const r = await listSkillGap(paolo);
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17 / D-6) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — insights:view denied → 403 on list", async () => {
    // insights has no ESS self-view (D-6): a plain USER can enumerate NO other user's scores
    // (not even a scoped list) — the strongest self-floor.
    const r = await listFlightRisk(tommaso);
    expect(r.statusCode).toBe(403);
  });

  it("plain USER (tommaso) cannot read even his OWN flight-risk (no ESS self-view, D-6) → 403", async () => {
    const r = await getFlightRisk(tommaso, tommaso.userId);
    expect(r.statusCode).toBe(403);
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's flight-risk tenant-wide → 200", async () => {
    const byId = await getFlightRisk(federica, antonio.userId);
    expect(byId.statusCode).toBe(200);

    const list = await listFlightRisk(federica);
    expect(list.statusCode).toBe(200);
    expect((list.json() as ListBody).items.some((i) => i.userId === antonio.userId)).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's flight-risk cross-tenant → 200 (sanity)", async () => {
    const r = await getFlightRisk(admin, antonio.userId);
    expect(r.statusCode).toBe(200);
  });
});
