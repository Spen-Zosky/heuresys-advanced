/**
 * apps/api/src/modules/agent-signals/repository.ts — ADR-0063, voce F4a (E6).
 *
 * SQL dei segnalatori. Le query di rilevazione LEGGONO soltanto le tabelle di business; l'unica
 * tabella in cui si scrive è `sys.sys_agent_signals` (000522), la cui guardia nel database
 * rifiuta ogni destinatario fuori perimetro.
 */
import type { Pool, PoolClient } from "pg";

export type Db = Pool | PoolClient;

/** Ruoli con il mandato HR sul tenant: lo stesso insieme di HR_MANDATED_ROLES (lib/scope/resolver.ts) e della guardia 000522. */
export const RUOLI_MANDATO_HR = ["TENANT_ADMIN", "HRMS_MANAGER", "PEOPLE_MANAGER"] as const;

export interface PosizioneCriticaSenzaSuccessore {
  tenant_id: string;
  position_id: string;
  position_title: string;
  unit_id: string | null;
  unit_name: string | null;
  candidates: number;
  ready_6_months: number;
  holder_ids: string[];
}

/** Posizioni attive critiche (colonna o registro delle critiche) senza un successore pronto ora. */
export async function posizioniCriticheSenzaSuccessore(db: Db): Promise<PosizioneCriticaSenzaSuccessore[]> {
  const r = await db.query<PosizioneCriticaSenzaSuccessore>(
    `WITH crit AS (
       SELECT p.position_id, p.position_tenant_id, p.position_title, p.position_organization_unit_id
         FROM sys.sys_positions p
        WHERE p.position_is_active
          AND (p.position_criticality = 'CRITICAL'
               OR EXISTS (SELECT 1 FROM sys.sys_critical_positions c WHERE c.critical_position_position_id = p.position_id))
     ), cand AS (
       SELECT sp.succession_pool_position_id AS position_id,
              count(*)::int AS candidates,
              count(*) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_NOW')::int AS ready_now,
              count(*) FILTER (WHERE sc.successor_candidate_readiness_level = 'READY_6_MONTHS')::int AS ready_6_months
         FROM sys.sys_succession_pools sp
         JOIN sys.sys_successor_candidates sc ON sc.successor_candidate_pool_id = sp.succession_pool_id
        WHERE sp.succession_pool_status = 'ACTIVE'
          AND sc.successor_candidate_status IN ('CANDIDATE', 'CONFIRMED')
        GROUP BY sp.succession_pool_position_id
     )
     SELECT crit.position_tenant_id::text AS tenant_id, crit.position_id::text AS position_id,
            crit.position_title, crit.position_organization_unit_id::text AS unit_id, ou.organization_unit_name AS unit_name,
            COALESCE(cand.candidates, 0) AS candidates, COALESCE(cand.ready_6_months, 0) AS ready_6_months,
            COALESCE((SELECT array_agg(a.user_position_assignment_user_id::text ORDER BY 1)
                        FROM sys.sys_user_position_assignments a
                       WHERE a.user_position_assignment_position_id = crit.position_id
                         AND a.user_position_assignment_status = 'ACTIVE'), '{}') AS holder_ids
       FROM crit
       LEFT JOIN cand ON cand.position_id = crit.position_id
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = crit.position_organization_unit_id
      WHERE COALESCE(cand.ready_now, 0) = 0
      ORDER BY 1, crit.position_title, 2`,
  );
  return r.rows;
}

export interface AmpiezzaDiControllo {
  tenant_id: string;
  position_id: string;
  position_title: string;
  unit_id: string | null;
  unit_name: string | null;
  direct_reports: number;
}

/**
 * Posizioni di chi dirige un'unità attiva con più riporti diretti della soglia. Si conta per
 * posizione del capo, non per unità: chi guida due unità con la stessa posizione conta una volta.
 * Riporto diretto = assegnazione ACTIVE su una posizione attiva che riporta alla posizione del capo.
 */
export async function ampiezzeDiControllo(db: Db, soglia: number): Promise<AmpiezzaDiControllo[]> {
  const r = await db.query<AmpiezzaDiControllo>(
    `WITH capi AS (
       SELECT DISTINCT mp.position_id, mp.position_tenant_id, mp.position_title, mp.position_organization_unit_id
         FROM sys.sys_organization_units u
         JOIN sys.sys_user_position_assignments ma
           ON ma.user_position_assignment_user_id = u.organization_unit_manager_user_id
          AND ma.user_position_assignment_status = 'ACTIVE'
         JOIN sys.sys_positions mp ON mp.position_id = ma.user_position_assignment_position_id AND mp.position_is_active
        WHERE u.organization_unit_is_active
     )
     SELECT c.position_tenant_id::text AS tenant_id, c.position_id::text AS position_id, c.position_title,
            c.position_organization_unit_id::text AS unit_id, ou.organization_unit_name AS unit_name,
            count(DISTINCT a.user_position_assignment_id)::int AS direct_reports
       FROM capi c
       JOIN sys.sys_positions rp ON rp.position_reports_to_position_id = c.position_id AND rp.position_is_active
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_position_id = rp.position_id AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = c.position_organization_unit_id
      GROUP BY c.position_tenant_id, c.position_id, c.position_title, c.position_organization_unit_id, ou.organization_unit_name
     HAVING count(DISTINCT a.user_position_assignment_id) > $1
      ORDER BY 1, 6 DESC, 2`,
    [soglia],
  );
  return r.rows;
}

export interface PosizioneScoperta {
  tenant_id: string;
  position_id: string;
  position_title: string;
  unit_id: string | null;
  unit_name: string | null;
  vacant_since: string;
  days: number;
  ever_assigned: boolean;
}

/** Posizioni attive senza titolare da più di `giorni` (dall'ultima assegnazione finita, o dalla creazione). */
export async function posizioniScoperte(db: Db, giorni: number): Promise<PosizioneScoperta[]> {
  const r = await db.query<PosizioneScoperta>(
    `SELECT p.position_tenant_id::text AS tenant_id, p.position_id::text AS position_id, p.position_title,
            p.position_organization_unit_id::text AS unit_id, ou.organization_unit_name AS unit_name,
            to_char(x.since, 'YYYY-MM-DD') AS vacant_since, (current_date - x.since)::int AS days,
            x.ever_assigned
       FROM sys.sys_positions p
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
       CROSS JOIN LATERAL (
         SELECT COALESCE(max(a.user_position_assignment_end_date), p.created_at::date) AS since,
                count(a.user_position_assignment_id) > 0 AS ever_assigned
           FROM sys.sys_user_position_assignments a
          WHERE a.user_position_assignment_position_id = p.position_id
       ) x
      WHERE p.position_is_active
        AND (p.position_effective_from IS NULL OR p.position_effective_from <= current_date)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                         WHERE a.user_position_assignment_position_id = p.position_id
                           AND a.user_position_assignment_status = 'ACTIVE')
        AND current_date - x.since > $1
      ORDER BY 1, 7 DESC, 2`,
    [giorni],
  );
  return r.rows;
}

/** Chi dirige l'unità più vicina sopra (o uguale a) `unitId`, escludendo `esclusi`; persone attive. */
export async function capoPiuVicino(db: Db, unitId: string, esclusi: string[]): Promise<string | null> {
  const r = await db.query<{ user_id: string }>(
    `WITH RECURSIVE su AS (
       SELECT o.organization_unit_id, o.organization_unit_parent_id, 0 AS depth
         FROM sys.sys_organization_units o WHERE o.organization_unit_id = $1
       UNION ALL
       SELECT o.organization_unit_id, o.organization_unit_parent_id, su.depth + 1
         FROM sys.sys_organization_units o JOIN su ON o.organization_unit_id = su.organization_unit_parent_id
        WHERE su.depth < 64
     )
     SELECT o.organization_unit_manager_user_id::text AS user_id
       FROM su
       JOIN sys.sys_organization_units o ON o.organization_unit_id = su.organization_unit_id
       JOIN sys.sys_users u ON u.user_id = o.organization_unit_manager_user_id AND u.user_status = 'ACTIVE'
      WHERE o.organization_unit_is_active
        AND NOT (o.organization_unit_manager_user_id = ANY($2::uuid[]))
      ORDER BY su.depth
      LIMIT 1`,
    [unitId, esclusi],
  );
  return r.rows[0]?.user_id ?? null;
}

/** Le persone attive del tenant con il mandato HR. */
export async function personeConMandatoHr(db: Db, tenantId: string): Promise<string[]> {
  const r = await db.query<{ user_id: string }>(
    `SELECT DISTINCT u.user_id::text AS user_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE'
        AND (ur.user_auth_role_tenant_id IS NULL OR ur.user_auth_role_tenant_id = $1)
        AND r.auth_role_code = ANY($2::text[])
      ORDER BY 1`,
    [tenantId, [...RUOLI_MANDATO_HR]],
  );
  return r.rows.map((x) => x.user_id);
}

export interface SegnalazioneAperta {
  agent_signal_id: string;
  agent_signal_recipient_user_id: string;
  agent_signal_dedupe_key: string;
  agent_signal_expires_on: string;
}

export async function segnalazioniAperte(db: Db, segnalatori: readonly string[]): Promise<SegnalazioneAperta[]> {
  const r = await db.query<SegnalazioneAperta>(
    `SELECT agent_signal_id::text, agent_signal_recipient_user_id::text, agent_signal_dedupe_key,
            to_char(agent_signal_expires_on, 'YYYY-MM-DD') AS agent_signal_expires_on
       FROM sys.sys_agent_signals
      WHERE agent_signal_status = 'APERTA' AND agent_signal_signaler_code = ANY($1::text[])
      FOR UPDATE`,
    [segnalatori],
  );
  return r.rows;
}

export async function chiudi(db: Db, id: string, stato: "RISOLTA" | "SCADUTA" | "RITIRATA"): Promise<void> {
  await db.query(
    `UPDATE sys.sys_agent_signals SET agent_signal_status = $2, agent_signal_closed_at = now()
      WHERE agent_signal_id = $1 AND agent_signal_status = 'APERTA'`,
    [id, stato],
  );
}

export async function rivista(db: Db, id: string, severity: string, evidence: Record<string, unknown>): Promise<void> {
  await db.query(
    `UPDATE sys.sys_agent_signals
        SET agent_signal_last_seen_at = now(), agent_signal_severity = $2, agent_signal_evidence = $3::jsonb
      WHERE agent_signal_id = $1`,
    [id, severity, JSON.stringify(evidence)],
  );
}

export interface NuovaSegnalazione {
  tenantId: string;
  signalerCode: string;
  domain: string;
  subjectType: "POSITION" | "ORGANIZATION_UNIT";
  subjectId: string;
  recipientUserId: string;
  recipientBasis: "CATENA" | "MANDATO_HR";
  severity: string;
  dedupeKey: string;
  evidence: Record<string, unknown>;
  sourceUrl: string | null;
  validDays: number;
}

export async function inserisci(db: Db, s: NuovaSegnalazione): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO sys.sys_agent_signals (
       agent_signal_tenant_id, agent_signal_signaler_code, agent_signal_domain, agent_signal_subject_type,
       agent_signal_subject_id, agent_signal_recipient_user_id, agent_signal_recipient_basis, agent_signal_severity,
       agent_signal_dedupe_key, agent_signal_evidence, agent_signal_source_url, agent_signal_expires_on
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11, current_date + $12::int)
     RETURNING agent_signal_id::text AS id`,
    [s.tenantId, s.signalerCode, s.domain, s.subjectType, s.subjectId, s.recipientUserId, s.recipientBasis,
      s.severity, s.dedupeKey, JSON.stringify(s.evidence), s.sourceUrl, s.validDays],
  );
  return r.rows[0]!.id;
}

export async function collegaAvviso(db: Db, id: string, notificationId: string): Promise<void> {
  await db.query(`UPDATE sys.sys_agent_signals SET agent_signal_notification_id = $2 WHERE agent_signal_id = $1`, [id, notificationId]);
}

export async function fuoriPerimetro(db: Db): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM sys.v_agent_signals_fuori_perimetro`);
  return r.rows[0]?.n ?? 0;
}

export interface RigaSegnalazione {
  agent_signal_id: string;
  agent_signal_signaler_code: string;
  agent_signal_domain: string;
  agent_signal_severity: string;
  agent_signal_status: string;
  agent_signal_recipient_basis: string;
  agent_signal_subject_type: string;
  agent_signal_subject_id: string;
  position_title: string | null;
  unit_name: string | null;
  agent_signal_evidence: Record<string, string | number | boolean | null>;
  agent_signal_source_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  expires_on: string;
  closed_at: string | null;
}

/** Le segnalazioni di UNA persona: il destinatario è sempre chi chiede. */
export async function diUnaPersona(db: Db, userId: string, stato: string): Promise<RigaSegnalazione[]> {
  const r = await db.query<RigaSegnalazione>(
    `SELECT s.agent_signal_id::text, s.agent_signal_signaler_code, s.agent_signal_domain, s.agent_signal_severity,
            s.agent_signal_status, s.agent_signal_recipient_basis, s.agent_signal_subject_type,
            s.agent_signal_subject_id::text,
            p.position_title,
            COALESCE(ou.organization_unit_name, ou2.organization_unit_name) AS unit_name,
            s.agent_signal_evidence, s.agent_signal_source_url,
            s.agent_signal_first_seen_at::text AS first_seen_at, s.agent_signal_last_seen_at::text AS last_seen_at,
            to_char(s.agent_signal_expires_on, 'YYYY-MM-DD') AS expires_on, s.agent_signal_closed_at::text AS closed_at
       FROM sys.sys_agent_signals s
       LEFT JOIN sys.sys_positions p ON s.agent_signal_subject_type = 'POSITION' AND p.position_id = s.agent_signal_subject_id
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
       LEFT JOIN sys.sys_organization_units ou2
              ON s.agent_signal_subject_type = 'ORGANIZATION_UNIT' AND ou2.organization_unit_id = s.agent_signal_subject_id
      WHERE s.agent_signal_recipient_user_id = $1 AND s.agent_signal_status = $2
      ORDER BY CASE s.agent_signal_severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
               s.agent_signal_first_seen_at DESC
      LIMIT 200`,
    [userId, stato],
  );
  return r.rows;
}
