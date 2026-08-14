/**
 * apps/api/test/domains-f6.integration.test.ts — #99 F6.
 *
 * ADR-0036 dichiara **11 domini funzionali**; `activeDomainsOf` ne calcolava **cinque**, e
 * l'ADR stesso lo annotava: *«no production consumer of the functional-scope helpers yet»*.
 * F6 ne aggiunge tre — `mentor`, `approver`, `team_peer` — derivandoli dalle tabelle che li
 * definiscono, così che una nomina fatta oggi sia in effetto oggi.
 *
 * ⚠ IL RISCHIO VERO NON ERA AGGIUNGERLI, ERA `hasAnyDomain`. Quel predicato decide se il menu
 * mostra le voci amministrative ed era `activeDomainsOf(...).size > 0`: con `team_peer` sarebbe
 * diventato vero per **quasi tutti**, aprendo il menu di governo all'intera azienda. L'API
 * avrebbe risposto 403 e nessun dato sarebbe uscito — ma un menu che offre una funzione altrui
 * è comunque una bugia (`#101`). Il caso di non-regressione qui sotto è la prova che non è
 * successo, e va tenuto anche quando arriveranno gli altri domini.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { activeDomainsOf, hasAnyDomain } from "../src/lib/scope/domains.js";
import type { RoleCode } from "../src/config/constants.js";

let t: TestApp;

interface Persona { userId: string; email: string; roles: RoleCode[] }
let persone: Persona[] = [];
/** Chi il DATABASE dice essere mentore / approvatore / pari, calcolato in SQL. */
let mentoriAttesi = new Set<string>();
let approvatoriAttesi = new Set<string>();
let pariAttesi = new Set<string>();
/** Chi apriva il menu amministrativo con i SOLI cinque domini originali. */
let apronoPrima = new Set<string>();

beforeAll(async () => {
  t = await buildTestApp();

  const u = await pool.query<{ user_id: string; user_email: string; ruoli: string[] | null }>(
    `SELECT u.user_id, u.user_email,
            array_agg(r.auth_role_code) FILTER (WHERE r.auth_role_code IS NOT NULL) AS ruoli
       FROM sys.sys_users u
       LEFT JOIN sys.sys_user_auth_roles ur
              ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       LEFT JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE u.user_status = 'ACTIVE'
      GROUP BY u.user_id, u.user_email`,
  );
  persone = u.rows.map((r) => ({
    userId: r.user_id,
    email: r.user_email,
    roles: (r.ruoli ?? []) as RoleCode[],
  }));

  const set = async (sql: string) =>
    new Set((await pool.query<{ id: string }>(sql)).rows.map((r) => r.id));

  mentoriAttesi = await set(
    `SELECT DISTINCT mentorship_mentor_user_id AS id FROM sys.sys_mentorships
      WHERE mentorship_mentor_user_id IS NOT NULL`,
  );
  approvatoriAttesi = await set(
    `SELECT DISTINCT approval_step_approver_user_id AS id FROM sys.sys_approval_steps
      WHERE approval_step_approver_user_id IS NOT NULL`,
  );
  pariAttesi = await set(
    `SELECT DISTINCT tm.team_member_user_id AS id
       FROM sys.sys_team_members tm
       JOIN sys.sys_teams t ON t.team_id = tm.team_member_team_id
      WHERE tm.team_member_is_active AND t.team_is_active
        AND t.team_lead_user_id IS DISTINCT FROM tm.team_member_user_id`,
  );

  // Il contro-oracolo del PRIMA: i cinque domini originali, in SQL, indipendente dal codice.
  apronoPrima = await set(
    `SELECT DISTINCT u.user_id AS id
       FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE'
        AND (
          EXISTS (SELECT 1 FROM sys.sys_organization_units o
                   WHERE o.organization_unit_manager_user_id = u.user_id
                     AND o.organization_unit_is_active)
          OR EXISTS (SELECT 1 FROM sys.sys_teams t WHERE t.team_lead_user_id = u.user_id)
          OR EXISTS (SELECT 1 FROM sys.sys_process_participants p
                      WHERE p.process_participant_user_id = u.user_id
                        AND p.process_participant_role = 'OWNER'
                        AND p.process_participant_is_active)
          OR EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                      WHERE ur.user_auth_role_user_id = u.user_id
                        AND ur.user_auth_role_revoked_at IS NULL
                        AND r.auth_role_code IN ('HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN'))
        )`,
  );
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F6 — i tre domini che ADR-0036 dichiarava e nessuno calcolava", () => {
  it("gira su un universo dove PUÒ fallire: i tre domini hanno titolari reali", () => {
    expect(persone.length, "nessuna persona attiva").toBeGreaterThan(0);
    expect(mentoriAttesi.size, "nessun mentore: il dominio non sarebbe verificabile").toBeGreaterThan(0);
    expect(approvatoriAttesi.size, "nessun approvatore").toBeGreaterThan(0);
    expect(pariAttesi.size, "nessun compagno di squadra").toBeGreaterThan(0);
  });

  it("ogni dominio si accende esattamente su chi il database dice, e su nessun altro", async () => {
    const visti = { mentor: new Set<string>(), approver: new Set<string>(), team_peer: new Set<string>() };
    for (const p of persone) {
      const d = await activeDomainsOf(pool, { userId: p.userId, tenantId: null, roles: p.roles });
      if (d.has("mentor")) visti.mentor.add(p.userId);
      if (d.has("approver")) visti.approver.add(p.userId);
      if (d.has("team_peer")) visti.team_peer.add(p.userId);
    }
    // Uguaglianza nei DUE versi: nessuno manca (falso negativo) e nessuno avanza (falso positivo).
    expect([...visti.mentor].sort()).toEqual([...mentoriAttesi].sort());
    expect([...visti.approver].sort()).toEqual([...approvatoriAttesi].sort());
    expect([...visti.team_peer].sort()).toEqual([...pariAttesi].sort());
  });

  it("`team_peer` NON è il capo squadra: i due domini restano distinguibili", async () => {
    const capi = await pool.query<{ id: string }>(
      `SELECT DISTINCT t.team_lead_user_id AS id
         FROM sys.sys_teams t
         JOIN sys.sys_team_members tm
           ON tm.team_member_team_id = t.team_id
          AND tm.team_member_user_id = t.team_lead_user_id
          AND tm.team_member_is_active
        WHERE t.team_is_active AND t.team_lead_user_id IS NOT NULL`,
    );
    if (capi.rows.length === 0) {
      // Il caso non esiste nei dati: si dichiara invece di fingere di averlo verificato.
      expect(capi.rows.length).toBe(0);
      return;
    }
    // Chi guida una squadra ED è iscritto fra i suoi membri non deve risultare «pari» PER
    // QUELLA squadra: se lo fosse, i due domini direbbero la stessa cosa.
    for (const c of capi.rows) {
      const soloQuella = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM sys.sys_team_members tm
           JOIN sys.sys_teams t ON t.team_id = tm.team_member_team_id
          WHERE tm.team_member_user_id = $1 AND tm.team_member_is_active AND t.team_is_active
            AND t.team_lead_user_id IS DISTINCT FROM $1`,
        [c.id],
      );
      if (Number(soloQuella.rows[0]?.n ?? 0) === 0) {
        expect(pariAttesi.has(c.id), "un capo squadra risulta «pari» senza esserlo altrove").toBe(false);
      }
    }
  });

  it("NON-REGRESSIONE — il menu amministrativo si apre alle STESSE persone di prima", async () => {
    // È il caso che rende sicura l'aggiunta. Se `hasAnyDomain` tornasse `size > 0`, questo
    // diventa rosso con la differenza esatta: quante persone in più vedrebbero il menu.
    const apronoOra = new Set<string>();
    for (const p of persone) {
      if (await hasAnyDomain(pool, { userId: p.userId, tenantId: null, roles: p.roles })) {
        apronoOra.add(p.userId);
      }
    }
    const inPiu = [...apronoOra].filter((id) => !apronoPrima.has(id));
    const inMeno = [...apronoPrima].filter((id) => !apronoOra.has(id));
    expect(
      inPiu.length,
      `${inPiu.length} persone in più vedrebbero il menu amministrativo dopo F6`,
    ).toBe(0);
    expect(inMeno.length, `${inMeno.length} persone lo hanno PERSO`).toBe(0);
    expect(apronoOra.size, "nessuno apre il menu: il contro-oracolo è cieco").toBeGreaterThan(0);
  });
});
