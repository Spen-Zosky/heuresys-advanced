/**
 * apps/api/test/teams-functional-axis.integration.test.ts — #143 F3.
 *
 * `team` è dichiarato `ACTIVITY` in `data-classes.ts` («team membership: who works with
 * whom»), e la classe ACTIVITY è gattata dall'asse **funzionale** (ADR-0027 F4). Il modulo
 * usava invece `ORG_BROWSE_ROLES`, che è la composizione dell'asse **organizzativo** e
 * include i ruoli manageriali: due assi diversi sulla stessa risorsa, decisi in due posti che
 * non si parlano.
 *
 * ⚠ Misurato in produzione prima di toccare: **10** persone con ruolo manageriale, di cui
 * **6 non guidano alcuna squadra**, vedevano comunque tutte e **26** le squadre attive.
 *
 * ⭐ L'ASSERZIONE CHE CONTA È LA SECONDA. «Il mandato HR vede tutto» lo soddisferebbe anche
 * il codice di prima; è «chi ha un ruolo manageriale ma non guida squadre NON le vede tutte»
 * a poter fallire, ed è quella che fissa il cambiamento. Senza, il test sarebbe verde su
 * entrambe le versioni e non direbbe niente.
 *
 * Gli attori si derivano dal dato di oggi: un test che cabla un'email invecchia col dataset.
 * Se il caso non esiste più, ci si ferma dicendo cosa manca — non si misura in silenzio.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S {
  cookies: Map<string, string>;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
/**
 * ⚠ PER TENANT, e non in totale. La prima stesura contava TUTTE le squadre attive (26) e le
 * confrontava con una lista che il modulo filtra per tenant (RTL ne ha 25): `25 < 26` era
 * vero sempre, anche col criterio precedente. Il sondaggio l'ha scoperto — rimesso il vecchio
 * codice, il test restava verde. Una prova che non sa fallire non e' una prova.
 */
async function squadreAttiveDelTenantDi(email: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM sys.sys_teams t
      WHERE t.team_is_active
        AND t.team_tenant_id = (SELECT user_tenant_id FROM sys.sys_users
                                 WHERE lower(user_email) = lower($1))`,
    [email],
  );
  return Number(r.rows[0]!.n);
}

let mandatoHr: string | undefined;
let managerSenzaSquadra: string | undefined;

describe("#143 F3 — le squadre seguono l'asse FUNZIONALE, non quello organizzativo", () => {
  beforeAll(async () => {
    suite = await buildTestApp();

    // Chi ha un MANDATO (TENANT_ADMIN / HRMS_MANAGER): tiene la vista piena, in entrambi
    // gli assi. È il caso di controllo.
    const hr = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email
         FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                        AND ur.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
        WHERE u.user_status = 'ACTIVE'
          AND r.auth_role_code IN ('TENANT_ADMIN', 'HRMS_MANAGER')
        ORDER BY u.user_email LIMIT 1`,
    );
    mandatoHr = hr.rows[0]?.email;

    // ⭐ Il caso che decide: ruolo manageriale, NESSUNA squadra guidata, e nessun mandato.
    const mgr = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email
         FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                        AND ur.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
        WHERE u.user_status = 'ACTIVE'
          AND r.auth_role_code IN ('MANAGER', 'CEO')
          AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles u2
                            JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = u2.user_auth_role_role_id
                           WHERE u2.user_auth_role_user_id = u.user_id
                             AND u2.user_auth_role_revoked_at IS NULL
                             AND r2.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER'))
          AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t
                           WHERE t.team_is_active AND t.team_lead_user_id = u.user_id)
          AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members m
                           WHERE m.team_member_user_id = u.user_id
                             AND m.team_member_role = 'LEAD' AND m.team_member_is_active)
        ORDER BY u.user_email LIMIT 1`,
    );
    managerSenzaSquadra = mgr.rows[0]?.email;
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("il mandato HR tiene la vista piena sul tenant", async () => {
    if (!mandatoHr) throw new Error("nessun TENANT_ADMIN/HRMS_MANAGER attivo: verifica cieca");
    const s = await login(suite, mandatoHr);
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/teams?limit=200",
      headers: { cookie: ch(s.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { total: number };
    // Vede TUTTE le squadre attive del proprio tenant — uguaglianza, non «al piu'»:
    // un «<=» sarebbe vero anche vedendone una sola, e non direbbe niente.
    expect(b.total).toBe(await squadreAttiveDelTenantDi(mandatoHr));
  });

  it("⭐ chi ha un ruolo manageriale ma NON guida squadre non le vede tutte", async () => {
    // Questa e' l'asserzione che fissa il cambiamento: col criterio precedente
    // (ORG_BROWSE_ROLES, che include MANAGER e CEO) questa persona vedeva l'intero elenco.
    if (!managerSenzaSquadra) {
      throw new Error(
        "nessun MANAGER/CEO senza squadre guidate e senza mandato: il caso non esiste piu' " +
          "in questo dataset, e il test si ferma invece di misurare in silenzio",
      );
    }
    const s = await login(suite, managerSenzaSquadra);
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/teams?limit=200",
      headers: { cookie: ch(s.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { total: number; items: Array<{ teamId: string }> };
    const nelSuoTenant = await squadreAttiveDelTenantDi(managerSenzaSquadra);
    expect(nelSuoTenant).toBeGreaterThan(1); // o il confronto non discriminerebbe
    expect(b.total).toBeLessThan(nelSuoTenant);
  });
});
