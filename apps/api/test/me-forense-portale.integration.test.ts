/**
 * apps/api/test/me-forense-portale.integration.test.ts
 * Controllo forense del portale personale (15/11/2026), rilievi D2-01, D2-03, D2-04, D2-05, D2-06, D2-07, D2-16.
 *
 * Ogni atteso si RICAVA dal database vivo (nessun valore scritto a mano): la prova deve poter
 * fallire, e prima delle correzioni falliva (responsabile vuoto, 773 giorni di ferie, conteggio
 * delle evidenze, KPI assegnato ma non richiesto assente, sondaggio compilato «da compilare»,
 * responsabile di squadra «Membro», avvisi aperti su un passo deciso).
 */
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool, withTransaction } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { decideStepGuarded } from "../src/modules/approvals/repository.js";
import { runApprovalSla } from "../src/modules/approvals/sla.js";

let suite: TestApp;
async function cookieOf(email: string): Promise<string> {
  const r = await loginRaw(suite.app, email, TEST_PERSONA_PASSWORD);
  return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
function get(c: string, url: string) {
  return suite.app.inject({ method: "GET", url, headers: { cookie: c } });
}

describe("portale personale: rilievi D2 del controllo forense", () => {
  beforeAll(async () => { suite = await buildTestApp(); });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("D2-01: il responsabile e' il TITOLARE della posizione di destinazione, in forma «Cognome, Nome»", async () => {
    // una persona la cui posizione risponde a una posizione tenuta da qualcuno e senza proprietario
    const { rows } = await pool.query<{ email: string; resp: string }>(
      `SELECT u.user_email AS email, (tu.user_last_name || ', ' || tu.user_first_name) AS resp
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
         JOIN sys.sys_positions mp ON mp.position_id = p.position_reports_to_position_id
         JOIN sys.sys_user_position_assignments ta ON ta.user_position_assignment_position_id = mp.position_id
              AND ta.user_position_assignment_kind = 'PRIMARY' AND ta.user_position_assignment_status = 'ACTIVE'
         JOIN sys.sys_users tu ON tu.user_id = ta.user_position_assignment_user_id
        WHERE a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'
          AND mp.position_owner_user_id IS NULL
          AND u.user_email LIKE '%@rtl-bank.org' AND u.user_status = 'ACTIVE'
        ORDER BY u.user_email LIMIT 1`,
    );
    const target = rows[0];
    expect(target, "serve almeno una persona con responsabile titolare e posizione senza proprietario").toBeDefined();
    const r = await get(await cookieOf(target!.email), "/v1/me/profile/full");
    expect(r.statusCode).toBe(200);
    expect((r.json() as { organization: { managerName: string | null } }).organization.managerName).toBe(target!.resp);
  });

  it("D2-03 e D2-16: analisi = ferie dell'anno in corso e competenze possedute", async () => {
    const email = "antonio.parisi@rtl-bank.org";
    const { rows } = await pool.query<{ ferie: string | null; comp: string }>(
      `SELECT (SELECT sum(b.balance_total_days + COALESCE(b.balance_carryover_days, 0) - COALESCE(b.balance_used_days, 0))
                 FROM sys.sys_time_off_balances b
                WHERE b.balance_subject_user_id = u.user_id AND b.balance_leave_type = 'VACATION'
                  AND b.balance_year = EXTRACT(year FROM CURRENT_DATE)::int)::text AS ferie,
              (SELECT count(*) FROM sys.sys_user_skills s WHERE s.user_skill_user_id = u.user_id)::text AS comp
         FROM sys.sys_users u WHERE u.user_email = $1`, [email]);
    const r = await get(await cookieOf(email), "/v1/me/analytics");
    expect(r.statusCode).toBe(200);
    const s = (r.json() as { summary: { leaveBalanceDays: number | null; skillsCount: number } }).summary;
    expect(s.leaveBalanceDays).toBe(rows[0]!.ferie === null ? null : Number(rows[0]!.ferie));
    expect(s.skillsCount).toBe(Number(rows[0]!.comp));
    // la malattia (180 giorni l'anno su piu' anni) non e' piu' dentro il numero
    const tot = await pool.query<{ t: string }>(
      `SELECT COALESCE(sum(b.balance_total_days - COALESCE(b.balance_used_days, 0)), 0)::text AS t
         FROM sys.sys_time_off_balances b JOIN sys.sys_users u ON u.user_id = b.balance_subject_user_id WHERE u.user_email = $1`, [email]);
    if (Number(tot.rows[0]!.t) > Number(rows[0]!.ferie ?? 0)) expect(s.leaveBalanceDays ?? 0).toBeLessThan(Number(tot.rows[0]!.t));
  });

  it("D2-04: un bersaglio assegnato compare anche se il KPI non e' richiesto dalla posizione", async () => {
    const { rows } = await pool.query<{ email: string; kpi: string }>(
      `SELECT u.user_email AS email, t.kpi_target_kpi_id::text AS kpi
         FROM sys.sys_kpi_targets t
         JOIN sys.sys_users u ON u.user_id = t.kpi_target_user_id
        WHERE u.user_email LIKE '%@rtl-bank.org' AND u.user_status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_position_assignments a
              JOIN sys.sys_position_kpi_requirements r ON r.position_id = a.user_position_assignment_position_id
             WHERE a.user_position_assignment_user_id = u.user_id
               AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'
               AND r.kpi_definition_id = t.kpi_target_kpi_id)
        ORDER BY u.user_email LIMIT 1`);
    const target = rows[0];
    expect(target, "serve una persona con un bersaglio non richiesto dalla sua posizione").toBeDefined();
    const r = await get(await cookieOf(target!.email), "/v1/me/kpis");
    expect(r.statusCode).toBe(200);
    const item = (r.json() as { items: Array<{ kpiDefinitionId: string; positionKpiRequirementId: string | null; assignedTarget: { targetValue: string | null } | null }> })
      .items.find((i) => i.kpiDefinitionId === target!.kpi);
    expect(item, "il KPI del bersaglio assegnato deve comparire").toBeDefined();
    expect(item!.positionKpiRequirementId).toBeNull();
    expect(item!.assignedTarget).not.toBeNull();
  });

  it("D2-05: un sondaggio con risposte proprie e' «completed» anche senza assegnazione chiusa", async () => {
    const { rows } = await pool.query<{ email: string; survey: string }>(
      `SELECT u.user_email AS email, r.survey_response_survey_id::text AS survey
         FROM sys.sys_survey_responses r
         JOIN sys.sys_users u ON u.user_id = r.survey_response_subject_user_id
        WHERE u.user_email LIKE '%@rtl-bank.org' AND u.user_status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_assignments a
                           WHERE a.survey_assignment_user_id = u.user_id
                             AND a.survey_assignment_survey_id = r.survey_response_survey_id
                             AND a.survey_assignment_completed_at IS NOT NULL)
        ORDER BY u.user_email LIMIT 1`);
    const target = rows[0];
    expect(target, "serve una persona con risposte e senza assegnazione completata").toBeDefined();
    const r = await get(await cookieOf(target!.email), "/v1/me/surveys");
    expect(r.statusCode).toBe(200);
    const item = (r.json() as { items: Array<{ surveyId: string; completed: boolean; answerCount: number }> })
      .items.find((i) => i.surveyId === target!.survey);
    expect(item).toBeDefined();
    expect(item!.answerCount).toBeGreaterThan(0);
    expect(item!.completed).toBe(true);
  });

  it("D2-06: il responsabile della squadra (team_lead_user_id) e' LEAD anche senza riga LEAD", async () => {
    const { rows } = await pool.query<{ email: string; uid: string; team: string }>(
      `SELECT u.user_email AS email, u.user_id::text AS uid, t.team_id::text AS team
         FROM sys.sys_teams t
         JOIN sys.sys_users u ON u.user_id = t.team_lead_user_id
         JOIN sys.sys_team_members m ON m.team_member_team_id = t.team_id AND m.team_member_user_id = u.user_id
        WHERE m.team_member_role <> 'LEAD' AND m.team_member_is_active AND t.team_is_active
          AND u.user_email LIKE '%@rtl-bank.org' AND u.user_status = 'ACTIVE'
        ORDER BY u.user_email LIMIT 1`);
    const target = rows[0];
    expect(target, "serve una squadra il cui responsabile ha la riga MEMBER").toBeDefined();
    const r = await get(await cookieOf(target!.email), "/v1/me/team");
    expect(r.statusCode).toBe(200);
    const team = (r.json() as { teams: Array<{ teamId?: string; id?: string; members: Array<{ userId: string; role: string }> }> })
      .teams.find((x) => (x.teamId ?? x.id) === target!.team);
    expect(team).toBeDefined();
    expect(team!.members.find((m) => m.userId === target!.uid)?.role).toBe("LEAD");
  });

  it("D2-14 e D2-07: la migrazione 000493 riscrive i titoli, chiude gli avvisi ed e' idempotente", async () => {
    const sql = readFileSync(new URL("../../../db/migrations/000493_titoli_e_avvisi_delle_approvazioni_in_italiano.sql", import.meta.url), "utf8")
      // l'utente dell'API non vede lo schema staging (lo usa il migratore): la prova gira sugli stessi
      // enunciati con funzione e giornale temporanei, che spariscono con la transazione annullata
      .replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, "").replaceAll("staging.", "pg_temp.");
    const u = await pool.query<{ id: string; tenant: string }>(
      `SELECT user_id::text AS id, user_tenant_id::text AS tenant FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org'`);
    const a = u.rows[0]!;
    const ins = (titolo: string) => pool.query<{ id: string }>(
      `INSERT INTO sys.sys_approval_requests (approval_request_tenant_id, approval_request_title, approval_request_status, created_by)
       VALUES ($1, $2, 'APPLIED', $3) RETURNING approval_request_id::text AS id`, [a.tenant, titolo, a.id]);
    const ferie = (await ins("Richiesta di ferie — 9.00 giorni dal 16/08/2026")).rows[0]!.id;
    const mezzo = (await ins("Richiesta di ferie — 10.50 giorni dal 01/09/2026")).rows[0]!.id;
    const comp = (await ins("Adeguamento retributivo — 1,158 EUR")).rows[0]!.id;
    const titolo = async (id: string) => (await pool.query<{ t: string }>(
      `SELECT approval_request_title AS t FROM sys.sys_approval_requests WHERE approval_request_id = $1`, [id])).rows[0]!.t;

    await pool.query(sql);
    expect(await titolo(ferie)).toBe("Richiesta di ferie — 9 giorni dal 16/08/2026");
    expect(await titolo(mezzo)).toBe("Richiesta di ferie — 10,5 giorni dal 01/09/2026");
    expect(await titolo(comp)).toBe("Adeguamento retributivo — 1.158 EUR");
    const aperti = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_inbox_notifications n
         JOIN sys.sys_approval_steps s ON s.approval_step_id = n.notification_resource_id
        WHERE n.notification_resource_type = 'APPROVAL_STEP' AND n.notification_type IN ('APPROVAL_REMINDER', 'APPROVAL_OVERDUE')
          AND n.notification_status <> 'DISMISSED' AND s.approval_step_status <> 'PENDING'`);
    expect(Number(aperti.rows[0]!.n)).toBe(0);

    const giornale = async () => Number((await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM pg_temp.approvazioni_italiano_undo`)).rows[0]!.n);
    const prima = await giornale();
    await pool.query(sql); // seconda passata: niente da riscrivere, niente di nuovo nel giornale
    expect(await giornale()).toBe(prima);
    expect(await titolo(ferie)).toBe("Richiesta di ferie — 9 giorni dal 16/08/2026");
  });

  it("D2-07: decidere un passo chiude gli avvisi di sollecito e di scadenza che lo riguardano", async () => {
    const u = await pool.query<{ id: string; tenant: string }>(
      `SELECT user_id::text AS id, user_tenant_id::text AS tenant FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org'`);
    const approver = u.rows[0]!;
    const req = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_approval_requests (approval_request_tenant_id, approval_request_title, approval_request_status, created_by)
       VALUES ($1, 'Prova forense D2-07', 'PENDING', $2) RETURNING approval_request_id::text AS id`,
      [approver.tenant, approver.id]);
    const st = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_approval_steps (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id,
          approval_step_status, approval_step_due_at)
       VALUES ($1, $2, $3, 'PENDING', now() - interval '2 hours') RETURNING approval_step_id::text AS id`,
      [req.rows[0]!.id, approver.tenant, approver.id]);
    const stepId = st.rows[0]!.id;
    await runApprovalSla(pool);
    const aperti = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_inbox_notifications
        WHERE notification_resource_id = $1 AND notification_status <> 'DISMISSED'`, [stepId]);
    expect(Number(aperti.rows[0]!.n), "prima della decisione l'avviso c'e'").toBeGreaterThan(0);

    await withTransaction(async (tx) => {
      const decided = await decideStepGuarded(tx, stepId, "APPROVED", null, approver.id);
      expect(decided).not.toBeNull();
    });
    const dopo = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_inbox_notifications
        WHERE notification_resource_id = $1 AND notification_status <> 'DISMISSED'`, [stepId]);
    expect(Number(dopo.rows[0]!.n), "dopo la decisione nessun avviso resta aperto").toBe(0);
  });
});
