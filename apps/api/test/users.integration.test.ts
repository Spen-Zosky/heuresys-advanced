/**
 * apps/api/test/users.integration.test.ts
 * Integration tests for /v1/users/*. Validates the 4 scope tiers
 * (PLATFORM_ADMIN / TENANT_ADMIN / MANAGER team / USER self) at runtime
 * using the personas seeded by pnpm db:seed-test-admin.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import {
  unSottopostoOrganizzativo,
  unEstraneoOrganizzativo,
  preparaUnRiportoSotto,
} from "./helpers/org-actors.js";

import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — fuori dalla cache delle sessioni. Questo file o ragiona sulla SESSIONE stessa
// (elenco/revoca delle famiglie), oppure MUTA i ruoli dell'attore: in entrambi i casi una
// sessione presa da un altro file risponderebbe con un assetto che non e' quello che il
// test ha appena costruito. Misurato: senza questa riga, 6 file rossi in corsa integrale.
senzaCacheDiSessione();

const PWD = TEST_PERSONA_PASSWORD;
const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";
const TENANT_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";
const MANAGER_EMAIL = "paolo.caputo@rtl-bank.org";
/**
 * [S1045] Il dipendente e l'estraneo non hanno piu' un nome fisso: erano
 * `tommaso.fiore` e `antonio.parisi`, e la ricostruzione dell'organigramma ha
 * INVERTITO i due ruoli (tommaso dirige un'altra filiale, antonio e' finito dentro
 * la divisione di paolo). Ora li sceglie l'albero delle unita' — struttura
 * indipendente da quella che il resolver percorre — e vengono riempiti in beforeAll.
 */
let EMPLOYEE_EMAIL: string;
let OUTSIDER_EMAIL: string;

const SUITE_PREFIX = `IT_USR_${randomUUID().slice(0, 8).toUpperCase()}`;

interface Session {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: Session;
let tenantS: Session;
let managerS: Session;
let employeeS: Session;
let outsiderS: Session;
let employeeId: string;
let outsiderId: string;
const createdUserIds: string[] = [];

describe("/v1/users/* integration (4-tier scope)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, PLATFORM_EMAIL);
    tenantS = await login(suite, TENANT_ADMIN_EMAIL);
    managerS = await login(suite, MANAGER_EMAIL);

    const dipendente = await unSottopostoOrganizzativo(pool, managerS.userId);
    const estraneo = await unEstraneoOrganizzativo(pool, managerS.userId);
    EMPLOYEE_EMAIL = dipendente.email;
    OUTSIDER_EMAIL = estraneo.email;

    employeeS = await login(suite, EMPLOYEE_EMAIL);
    outsiderS = await login(suite, OUTSIDER_EMAIL);
    employeeId = employeeS.userId;
    outsiderId = outsiderS.userId;

    // Il vincolo F1 si prova solo su chi HA riporti senza avere un mandato. Nel dato
    // reale, dopo la ricostruzione, quel profilo non esiste piu' (zero persone su
    // 163): si prepara. D-52 lo annulla a fine file.
    await preparaUnRiportoSotto(pool, employeeId);
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_auth_credentials c USING sys.sys_auth_identities i WHERE c.auth_credential_identity_id = i.auth_identity_id AND i.auth_identity_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_auth_identities WHERE auth_identity_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_users WHERE user_id = $1`, [id]);
      } catch {
        /* ignore */
      }
    }
    await suite.app.close();
    await closePool();
  });

  /* -------------------------------------------------- list scope tiers */

  it("LIST: PLATFORM_ADMIN sees all users in DB (162 real users: 161 post-collapse + chiara.spenuso S988 #8b)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(162);
  });

  /**
   * C4 (#42): `search` lets approver/assignee pickers query the server instead of
   * filtering a `?limit=200` bulk fetch in the browser (which silently capped the
   * reachable set). Expectations derive from the live response — a term is taken
   * from a real row, never hardcoded.
   */
  it("LIST: `search` filters server-side on display name OR email, within scope", async () => {
    const all = await suite.app.inject({
      method: "GET", url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(all.statusCode).toBe(200);
    const items = (all.json() as { items: { userId: string; email: string; displayName: string | null }[] }).items;
    expect(items.length).toBeGreaterThan(0);

    // Take a discriminating fragment from a REAL row rather than inventing one.
    const sample = items.find((u) => (u.displayName ?? "").trim().length > 3);
    expect(sample).toBeDefined();
    const term = (sample!.displayName ?? "").trim().slice(0, 4);

    const r = await suite.app.inject({
      method: "GET", url: `/v1/users?search=${encodeURIComponent(term)}&limit=200`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const found = r.json() as { items: { userId: string; email: string; displayName: string | null }[]; total: number };

    expect(found.total).toBeGreaterThan(0);
    expect(found.total).toBeLessThanOrEqual(items.length); // a filter never widens the set
    expect(found.items.map((u) => u.userId)).toContain(sample!.userId);
    const needle = term.toLowerCase();
    for (const u of found.items) {
      expect(
        (u.displayName ?? "").toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
      ).toBe(true);
    }

    // A term that matches nothing yields an honest empty set, not everything.
    const none = await suite.app.inject({
      method: "GET", url: "/v1/users?search=zzzz-no-such-user-zzzz",
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(none.statusCode).toBe(200);
    expect((none.json() as { total: number }).total).toBe(0);
  });

  it("LIST: TENANT_ADMIN sees only own-tenant users", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { tenantId: string }[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(158); // RTL_BANK = 158 real rtl-bank.org users
    // All returned items must be in RTL tenant.
    const tenants = new Set(body.items.map((u) => u.tenantId));
    expect(tenants.size).toBe(1);
  });

  it("LIST: MANAGER sees only their team (self + direct reports, tenant-scoped)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string; email: string }[]; total: number };
    // paolo.caputo (manager persona) sees self + his TRANSITIVE org sub-tree (F1) — a
    // bounded set, NOT the whole tenant (163+). The exact-subtree assertion is the next test.
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.total).toBeLessThan(50);
    const emails = new Set(body.items.map((u) => u.email));
    expect(emails.has(MANAGER_EMAIL)).toBe(true); // self
    expect(emails.has(EMPLOYEE_EMAIL)).toBe(true); // a report (tommaso.fiore)
    expect(emails.has(OUTSIDER_EMAIL)).toBe(false); // different org branch (antonio, claudia's report)
  });

  it("LIST: MANAGER scope is the TRANSITIVE org sub-tree, not just direct reports (F1, ADR-0027)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const apiIds = new Set((r.json() as { items: { userId: string }[] }).items.map((u) => u.userId));
    const subtree = new Set(await orgSubtreeUserIds(pool, managerS.userId));
    // No leak: paolo never sees a user outside his transitive sub-tree. (The list may be a
    // subset of the sub-tree because listUsers also filters by user_status — that's expected.)
    for (const id of apiIds) expect(subtree.has(id)).toBe(true);
    // TRANSITIVA: paolo vede qualcuno che sta due livelli sotto — in un'unità NIPOTE, non
    // figlia diretta della sua. [#99 F3] L'atteso si derivava dai riporti di tommaso, che
    // l'albero delle unità non conosce più: ora si deriva dall'organigramma, che è la fonte.
    const nipoti = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT a.user_position_assignment_user_id AS user_id
         FROM sys.sys_organization_units mia
         JOIN sys.sys_organization_units figlia ON figlia.organization_unit_parent_id = mia.organization_unit_id
         JOIN sys.sys_organization_units nipote ON nipote.organization_unit_parent_id = figlia.organization_unit_id
         JOIN sys.sys_positions p ON p.position_organization_unit_id = nipote.organization_unit_id
         JOIN sys.sys_user_position_assignments a
              ON a.user_position_assignment_position_id = p.position_id
             AND a.user_position_assignment_status = 'ACTIVE'
        WHERE mia.organization_unit_manager_user_id = $1
          AND mia.organization_unit_is_active`,
      [managerS.userId],
    );
    expect(nipoti.rows.length).toBeGreaterThan(0); // il capo non dirige una foglia (verificato sul reale)
    expect(nipoti.rows.some((r) => apiIds.has(r.user_id))).toBe(true);
  });

  it("LIST: a NON-MANAGERIAL user sees ONLY self — even with reports in the chart (F1 constraint)", async () => {
    // Enzo's constraint: the org sub-tree applies only to explicit managerial roles. tommaso has
    // reports in the org chart but NO managerial role (USER/TEAM_MEMBER, not an OU manager) → he
    // sees just himself, not his reports.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]!.userId).toBe(employeeS.userId);
    // [#99 F3] Il cancello è dirigere un'unità, non l'assenza di riporti: costui HA riporti
    // nell'albero delle POSIZIONI — che dal 2026-08-14 non apre più alcun perimetro — e non
    // dirige alcuna unità. Senza questo controllo l'asserzione sopra non avrebbe nulla da negare.
    const riportiPosizionali = await pool.query<{ n: string }>(
      `WITH RECURSIVE mie AS (
         SELECT a.user_position_assignment_position_id AS pid
           FROM sys.sys_user_position_assignments a
          WHERE a.user_position_assignment_user_id = $1
            AND a.user_position_assignment_status = 'ACTIVE'
       ),
       sotto AS (
         SELECT p.position_id AS pid FROM sys.sys_positions p JOIN mie m ON p.position_reports_to_position_id = m.pid
         UNION
         SELECT p.position_id FROM sys.sys_positions p JOIN sotto s ON p.position_reports_to_position_id = s.pid
       )
       SELECT count(DISTINCT a.user_position_assignment_user_id)::text AS n
         FROM sys.sys_user_position_assignments a
         JOIN sotto s ON s.pid = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_status = 'ACTIVE'
          AND a.user_position_assignment_user_id <> $1`,
      [employeeS.userId],
    );
    expect(Number(riportiPosizionali.rows[0]!.n)).toBeGreaterThan(0);
    const dirige = await pool.query<{ hit: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM sys.sys_organization_units
                       WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active) AS hit`,
      [employeeS.userId],
    );
    expect(dirige.rows[0]!.hit).toBe(false);
  });

  /* -------------------------------------------------- get by id scope */

  it("GET :id MANAGER → 200 for team member, 404 for outsider", async () => {
    const teamOk = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${employeeId}`,
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(teamOk.statusCode).toBe(200);

    const blocked = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${outsiderId}`,
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(blocked.statusCode).toBe(404);
  });

  it("GET :id USER → 200 for self, 404 for any other", async () => {
    const self = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${employeeS.userId}`,
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(self.statusCode).toBe(200);

    const other = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${outsiderId}`,
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(other.statusCode).toBe(404);
  });

  /* -------------------------------------------------- create */

  it("CREATE: TENANT_ADMIN → 201; duplicate email → 409", async () => {
    const email = `${SUITE_PREFIX.toLowerCase()}_create@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "Created by Tenant Admin" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { userId: string; status: string; type: string };
    expect(body.status).toBe("PENDING_VERIFICATION");
    expect(body.type).toBe("STANDARD");
    createdUserIds.push(body.userId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "Duplicate" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("USER_EMAIL_CONFLICT");
  });

  it("CREATE: MANAGER → 403 (insufficient perm)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email: `${SUITE_PREFIX.toLowerCase()}_blocked@rtl-bank.test`, displayName: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- update field restrictions */

  it("PATCH: MANAGER updates allowed field (displayName) on team member; rejected on email", async () => {
    const okPatch = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { displayName: "Renamed by Manager" },
    });
    expect(okPatch.statusCode).toBe(200);

    const blocked = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email: "should-not-go-through@nope.test" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe("FIELD_NOT_ALLOWED");
  });

  it("PATCH /v1/users/:id from USER → 403 (admin endpoint; self-update lives in /v1/me/profile MVP-2b)", async () => {
    // Design split per AUTH §6.1 (ESS): USER role intentionally lacks
    // `user:update` in the seed; their self-service update path is the
    // separate /v1/me/profile endpoint (ADR-0011, MVP-2b). The /v1/users/*
    // module is admin-facing only.
    const r = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeS.userId}`,
      headers: {
        cookie: cookieHeader(employeeS.cookies),
        "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { displayName: "USER cannot update via admin endpoint" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- deactivate */

  it("DELETE: PLATFORM_ADMIN deactivates a created user; second DELETE → 409", async () => {
    // Create a fresh disposable user as target. PLATFORM_ADMIN supplies
    // tenantId explicitly (their JWT carries tenant_id=null).
    const tenantRow = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = tenantRow.rows[0]!.tenant_id;
    const email = `${SUITE_PREFIX.toLowerCase()}_dx@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "DeactivateMe", tenantId: rtlTenantId },
    });
    expect(created.statusCode).toBe(201);
    const { userId } = created.json() as { userId: string };
    createdUserIds.push(userId);

    const del1 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del1.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies) },
    });
    expect((after.json() as { status: string }).status).toBe("DEACTIVATED");

    const del2 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del2.statusCode).toBe(409);
    expect((del2.json() as { error: { code: string } }).error.code).toBe("USER_ALREADY_DEACTIVATED");
  });

  it("DELETE: self-deactivation → 409 SELF_DEACTIVATE", async () => {
    const r = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${platformS.userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SELF_DEACTIVATE");
  });

  /* -------------------------------------------------- purge (hard delete) */

  /** Crea un utente usa-e-getta dentro RTL Bank e ne restituisce l'id. */
  async function creaUsaEGetta(suffisso: string): Promise<string> {
    const tenantRow = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = tenantRow.rows[0]!.tenant_id;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        email: `${SUITE_PREFIX.toLowerCase()}_${suffisso}@rtl-bank.test`,
        displayName: `Purge ${suffisso}`,
        tenantId: rtlTenantId,
      },
    });
    expect(created.statusCode).toBe(201);
    const { userId } = created.json() as { userId: string };
    createdUserIds.push(userId);
    return userId;
  }

  it("PURGE: utente SENZA storia → 204 e la riga sparisce davvero", async () => {
    const userId = await creaUsaEGetta("px_pulito");

    const r = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/purge`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(204);

    // Non basta il 204: si guarda il database. Un 204 su una riga ancora
    // presente sarebbe il difetto peggiore possibile qui.
    const resta = await pool.query(`SELECT 1 FROM sys.sys_users WHERE user_id = $1`, [userId]);
    expect(resta.rowCount).toBe(0);
  });

  it("PURGE: basta UNA riga di storia operativa → 409 USER_HAS_HISTORY, e l'utente resta", async () => {
    const userId = await creaUsaEGetta("px_storia");
    const tenantRow = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );

    // UNA sola riga, nella più economica delle 10 tabelle che trattengono
    // (ON DELETE RESTRICT verso sys_users). Il caso limite è proprio questo:
    // non «tanta storia», ma il minimo indivisibile.
    await pool.query(
      `INSERT INTO audit.user_self_service_actions (action_user_id, action_tenant_id, action_type)
       VALUES ($1, $2, 'PROFILE_UPDATE')`,
      [userId, tenantRow.rows[0]!.tenant_id],
    );

    const r = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/purge`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    const body = r.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe("USER_HAS_HISTORY");
    // L'errore deve DIRE chi trattiene, o chi lo riceve non sa che farsene.
    expect(body.error.message).toContain("user_self_service_actions");

    const resta = await pool.query(`SELECT 1 FROM sys.sys_users WHERE user_id = $1`, [userId]);
    expect(resta.rowCount).toBe(1);

    // La via canonica resta percorribile sulla stessa persona.
    const soft = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(soft.statusCode).toBe(204);
    const dopo = await pool.query<{ user_status: string }>(
      `SELECT user_status FROM sys.sys_users WHERE user_id = $1`,
      [userId],
    );
    expect(dopo.rows[0]!.user_status).toBe("DEACTIVATED");
  });

  it("PURGE: su se stessi → 409 SELF_PURGE", async () => {
    const r = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${platformS.userId}/purge`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SELF_PURGE");
  });

  /* -------------------------------------------------- role grants */

  it("ROLE GRANTS: list/grant/revoke flow as TENANT_ADMIN on a freshly-created user", async () => {
    const email = `${SUITE_PREFIX.toLowerCase()}_roles@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "RolesTarget" },
    });
    const { userId } = created.json() as { userId: string };
    createdUserIds.push(userId);

    // 1. Initial: no role grants.
    const listEmpty = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}/roles`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(listEmpty.statusCode).toBe(200);
    expect((listEmpty.json() as { items: unknown[] }).items.length).toBe(0);

    // 2. Grant USER role (tenant-scoped, forced by TENANT_ADMIN policy).
    const grant = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "USER" },
    });
    expect(grant.statusCode).toBe(201);
    const grantBody = grant.json() as { grantId: string; roleCode: string; tenantId: string | null };
    expect(grantBody.roleCode).toBe("USER");
    expect(grantBody.tenantId).not.toBeNull();
    const grantId = grantBody.grantId;

    // 3. List again: 1 item.
    const listOne = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}/roles`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect((listOne.json() as { items: unknown[] }).items.length).toBe(1);

    // 4. Duplicate grant → 409 ROLE_GRANT_DUPLICATE.
    const dup = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "USER" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("ROLE_GRANT_DUPLICATE");

    // 5. TENANT_ADMIN attempting to grant PLATFORM_ADMIN → 403.
    const platBlocked = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "PLATFORM_ADMIN" },
    });
    expect(platBlocked.statusCode).toBe(403);
    expect((platBlocked.json() as { error: { code: string } }).error.code).toBe(
      "PLATFORM_GRANT_FORBIDDEN",
    );

    // 6. Revoke the grant.
    const revoke = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/roles/${grantId}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(revoke.statusCode).toBe(204);

    // 7. Second revoke → 404 (the grant is gone from the active-set lookup).
    const revoke2 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/roles/${grantId}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    // findGrantById returns the row regardless of revoked_at, so we get 409 not 404.
    expect(revoke2.statusCode).toBe(409);
    expect((revoke2.json() as { error: { code: string } }).error.code).toBe(
      "ROLE_GRANT_ALREADY_REVOKED",
    );
  });
});
