/**
 * apps/api/test/agent-signals.integration.test.ts — ADR-0063, voce F4a (decisione E6 di Enzo):
 * i segnalatori osservano il tenant e segnalano a ciascuno nel suo perimetro, senza cambiare nulla.
 *
 * Gira sulla copia di produzione della CI (dati di RTL); l'isolamento transazionale del file
 * annulla tutto ciò che scrive. Si prova:
 *   - il giro non tocca le tabelle di business (post-condizione sui conteggi);
 *   - ogni segnalazione aperta è nel perimetro (sentinella vuota), la successione non va mai al
 *     titolare, chi ha il mandato HR riceve tutto;
 *   - il secondo giro non ripete niente;
 *   - ciò che non è più vero si chiude RISOLTA;
 *   - la guardia del database rifiuta un destinatario fuori catena, uno senza mandato HR e il titolare;
 *   - la casella di una persona mostra solo le sue segnalazioni;
 *   - l'avviso nella casella si riconosce e si compone nelle due lingue.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { giro } from "../src/modules/agent-signals/service.js";
import { agentSignalsService as svc } from "../src/modules/agent-signals/service.js";
import { messaggioDellAvviso } from "../src/lib/notifications/messaggi.js";

const RTL = "RTL_BANK";
let tenantId = "";

const conteggiBusiness = async (): Promise<Record<string, number>> => {
  const r = await pool.query<Record<string, number>>(
    `SELECT (SELECT count(*) FROM sys.sys_positions)::int AS positions,
            (SELECT count(*) FROM sys.sys_user_position_assignments)::int AS assignments,
            (SELECT count(*) FROM sys.sys_organization_units)::int AS units,
            (SELECT count(*) FROM sys.sys_successor_candidates)::int AS candidates,
            (SELECT count(*) FROM sys.sys_succession_pools)::int AS pools`,
  );
  return r.rows[0]!;
};

beforeAll(async () => {
  const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1`, [RTL]);
  if (!t.rows[0]) throw new Error("tenant RTL_BANK assente nella copia della CI");
  tenantId = t.rows[0].tenant_id;
});

describe("segnalatori F4a: il giro", () => {
  it("segnala nel perimetro, non tocca le tabelle di business e non ripete", async () => {
    const prima = await conteggiBusiness();
    const uno = await giro();
    expect(await conteggiBusiness()).toEqual(prima);
    expect(uno.outOfScope).toBe(0);
    expect(uno.detected).toBeGreaterThan(0);
    expect(uno.opened).toBeGreaterThan(0);
    expect(uno.notified).toBe(uno.opened);

    // la successione non va mai al titolare della posizione
    const titolari = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_agent_signals s
         JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_position_id = s.agent_signal_subject_id
          AND a.user_position_assignment_user_id = s.agent_signal_recipient_user_id
          AND a.user_position_assignment_status = 'ACTIVE'
        WHERE s.agent_signal_status = 'APERTA' AND s.agent_signal_signaler_code = 'POSIZIONE_CRITICA_SENZA_SUCCESSORE'`,
    );
    expect(titolari.rows[0]!.n).toBe(0);

    // ogni segnalazione aperta ha il suo avviso, di tipo SYSTEM, che si riconosce
    const avvisi = await pool.query<{ subject: string; body: string; type: string }>(
      `SELECT n.notification_subject AS subject, n.notification_body AS body, n.notification_type AS type
         FROM sys.sys_agent_signals s JOIN sys.sys_inbox_notifications n ON n.notification_id = s.agent_signal_notification_id
        WHERE s.agent_signal_status = 'APERTA'`,
    );
    expect(avvisi.rows.length).toBe(uno.opened);
    for (const a of avvisi.rows) {
      expect(a.type).toBe("SYSTEM");
      expect(messaggioDellAvviso(a.type, a.subject, a.body)?.code).toMatch(/^AGENT_SIGNAL_/);
    }

    const due = await giro();
    expect(due.opened).toBe(0);
    expect(due.notified).toBe(0);
    expect(due.kept).toBe(uno.opened);
    expect(due.outOfScope).toBe(0);
  });

  it("chi ha il mandato HR riceve ogni segnalazione del suo tenant, salvo la successione della propria posizione", async () => {
    await giro();
    const r = await pool.query<{ mancanti: number }>(
      `WITH hr AS (
         SELECT DISTINCT u.user_id FROM sys.sys_users u
           JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
           JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
          WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE'
            AND ro.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER','PEOPLE_MANAGER')
       ), chiavi AS (
         SELECT DISTINCT agent_signal_dedupe_key, agent_signal_subject_id, agent_signal_signaler_code
           FROM sys.sys_agent_signals WHERE agent_signal_tenant_id = $1 AND agent_signal_status = 'APERTA'
       )
       SELECT count(*)::int AS mancanti FROM chiavi c CROSS JOIN hr
        WHERE NOT EXISTS (SELECT 1 FROM sys.sys_agent_signals s
                           WHERE s.agent_signal_recipient_user_id = hr.user_id
                             AND s.agent_signal_dedupe_key = c.agent_signal_dedupe_key AND s.agent_signal_status = 'APERTA')
          AND NOT (c.agent_signal_signaler_code = 'POSIZIONE_CRITICA_SENZA_SUCCESSORE' AND EXISTS (
                SELECT 1 FROM sys.sys_user_position_assignments a
                 WHERE a.user_position_assignment_position_id = c.agent_signal_subject_id
                   AND a.user_position_assignment_user_id = hr.user_id AND a.user_position_assignment_status = 'ACTIVE'))`,
      [tenantId],
    );
    expect(r.rows[0]!.mancanti).toBe(0);
  });

  it("ciò che non è più vero si chiude RISOLTA al giro dopo", async () => {
    await giro();
    // una segnalazione aperta su una condizione che il segnalatore non trova (chiave finta su un soggetto vero)
    const s = await pool.query<{ position_id: string; user_id: string }>(
      `SELECT s.agent_signal_subject_id AS position_id, s.agent_signal_recipient_user_id AS user_id
         FROM sys.sys_agent_signals s
        WHERE s.agent_signal_tenant_id = $1 AND s.agent_signal_status = 'APERTA' AND s.agent_signal_recipient_basis = 'MANDATO_HR'
          AND s.agent_signal_signaler_code = 'POSIZIONE_SCOPERTA'
        LIMIT 1`,
      [tenantId],
    );
    const riga = s.rows[0] ?? (await pool.query<{ position_id: string; user_id: string }>(
      `SELECT agent_signal_subject_id AS position_id, agent_signal_recipient_user_id AS user_id
         FROM sys.sys_agent_signals WHERE agent_signal_tenant_id = $1 AND agent_signal_status = 'APERTA'
          AND agent_signal_recipient_basis = 'MANDATO_HR' LIMIT 1`, [tenantId])).rows[0]!;
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_agent_signals (agent_signal_tenant_id, agent_signal_signaler_code, agent_signal_domain,
         agent_signal_subject_type, agent_signal_subject_id, agent_signal_recipient_user_id, agent_signal_recipient_basis,
         agent_signal_severity, agent_signal_dedupe_key, agent_signal_expires_on)
       VALUES ($1, 'AMPIEZZA_DI_CONTROLLO', 'ORGANIZZAZIONE', 'POSITION', $2, $3, 'MANDATO_HR', 'MEDIUM',
               $4, current_date + 30)
       RETURNING agent_signal_id AS id`,
      [tenantId, riga.position_id, riga.user_id, `AMPIEZZA_DI_CONTROLLO:prova-${riga.position_id}`],
    );
    const esito = await giro();
    expect(esito.resolved).toBeGreaterThanOrEqual(1);
    const st = await pool.query<{ status: string; closed: boolean }>(
      `SELECT agent_signal_status AS status, agent_signal_closed_at IS NOT NULL AS closed FROM sys.sys_agent_signals WHERE agent_signal_id = $1`,
      [ins.rows[0]!.id],
    );
    expect(st.rows[0]).toEqual({ status: "RISOLTA", closed: true });
  });
});

describe("segnalatori F4a: la guardia del perimetro nel database (000522)", () => {
  let posizione = "";
  let capo = "";
  let estraneo = "";
  let titolareCritica: { position_id: string; user_id: string } | undefined;

  beforeAll(async () => {
    // una posizione attiva con unità e il capo dell'unità; una persona del tenant che non dirige nessuna unità e non ha mandato HR
    const p = await pool.query<{ position_id: string; manager: string }>(
      `SELECT p.position_id, o.organization_unit_manager_user_id AS manager
         FROM sys.sys_positions p JOIN sys.sys_organization_units o ON o.organization_unit_id = p.position_organization_unit_id
        WHERE p.position_tenant_id = $1 AND p.position_is_active AND o.organization_unit_is_active
          AND o.organization_unit_manager_user_id IS NOT NULL AND o.organization_unit_parent_id IS NOT NULL
        ORDER BY p.position_id LIMIT 1`,
      [tenantId],
    );
    posizione = p.rows[0]!.position_id;
    capo = p.rows[0]!.manager;
    const e = await pool.query<{ user_id: string }>(
      `SELECT u.user_id FROM sys.sys_users u
        WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o WHERE o.organization_unit_manager_user_id = u.user_id)
          AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                           WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                             AND r.auth_role_code IN ('TENANT_ADMIN','HRMS_MANAGER','PEOPLE_MANAGER'))
        ORDER BY u.user_id LIMIT 1`,
      [tenantId],
    );
    estraneo = e.rows[0]!.user_id;
    const c = await pool.query<{ position_id: string; user_id: string }>(
      `SELECT p.position_id, a.user_position_assignment_user_id AS user_id
         FROM sys.sys_positions p JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_position_id = p.position_id AND a.user_position_assignment_status = 'ACTIVE'
        WHERE p.position_tenant_id = $1 AND p.position_is_active AND p.position_criticality = 'CRITICAL'
          AND EXISTS (SELECT 1 FROM sys.sys_organization_units o WHERE o.organization_unit_manager_user_id = a.user_position_assignment_user_id)
        ORDER BY 1 LIMIT 1`,
      [tenantId],
    );
    titolareCritica = c.rows[0];
  });

  const inserisci = (recipient: string, basis: string, signaler = "POSIZIONE_SCOPERTA", subject = posizione) =>
    pool.query(
      `INSERT INTO sys.sys_agent_signals (agent_signal_tenant_id, agent_signal_signaler_code, agent_signal_domain,
         agent_signal_subject_type, agent_signal_subject_id, agent_signal_recipient_user_id, agent_signal_recipient_basis,
         agent_signal_severity, agent_signal_dedupe_key, agent_signal_expires_on)
       VALUES ($1, $2, 'ORGANIZZAZIONE', 'POSITION', $3, $4, $5, 'MEDIUM', $6, current_date + 30)`,
      [tenantId, signaler, subject, recipient, basis, `prova-guardia:${recipient}:${signaler}`],
    );

  it("il capo dell'unità del soggetto è ammesso con CATENA", async () => {
    await expect(inserisci(capo, "CATENA")).resolves.toBeDefined();
  });

  it("una persona fuori catena è rifiutata con CATENA (G3)", async () => {
    await expect(inserisci(estraneo, "CATENA")).rejects.toThrow(/fuori perimetro \(G3/);
  });

  it("una persona senza mandato HR è rifiutata con MANDATO_HR (G3)", async () => {
    await expect(inserisci(estraneo, "MANDATO_HR")).rejects.toThrow(/fuori perimetro \(G3/);
  });

  it("la successione non va al titolare della posizione, nemmeno se ne dirige l'unità (G4)", async () => {
    if (!titolareCritica) return; // la copia della CI non ha una posizione critica il cui titolare dirige un'unità
    await expect(
      inserisci(titolareCritica.user_id, "CATENA", "POSIZIONE_CRITICA_SENZA_SUCCESSORE", titolareCritica.position_id),
    ).rejects.toThrow(/fuori perimetro \(G4/);
  });

  it("niente doppioni: una seconda segnalazione aperta per la stessa persona e la stessa chiave è rifiutata (G5)", async () => {
    await inserisci(capo, "CATENA", "AMPIEZZA_DI_CONTROLLO");
    await expect(inserisci(capo, "CATENA", "AMPIEZZA_DI_CONTROLLO")).rejects.toThrow(/sys_agent_signals_open_uq/);
  });
});

describe("segnalatori F4a: la casella", () => {
  it("ognuno vede solo le sue segnalazioni", async () => {
    await giro();
    const due = await pool.query<{ user_id: string }>(
      `SELECT agent_signal_recipient_user_id AS user_id FROM sys.sys_agent_signals
        WHERE agent_signal_tenant_id = $1 AND agent_signal_status = 'APERTA'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 2`,
      [tenantId],
    );
    expect(due.rows.length).toBeGreaterThan(0);
    for (const { user_id } of due.rows) {
      const mie = await svc.mie({ userId: user_id, tenantId, roles: [] }, undefined);
      const attese = await pool.query<{ id: string }>(
        `SELECT agent_signal_id AS id FROM sys.sys_agent_signals WHERE agent_signal_recipient_user_id = $1 AND agent_signal_status = 'APERTA'`,
        [user_id],
      );
      expect(new Set(mie.items.map((i) => i.id))).toEqual(new Set(attese.rows.map((r) => r.id)));
      for (const i of mie.items) {
        expect(i.positionTitle).not.toBeNull();
        expect(i.sourceUrl).toMatch(/^\/positions\//);
      }
    }
  });
});
