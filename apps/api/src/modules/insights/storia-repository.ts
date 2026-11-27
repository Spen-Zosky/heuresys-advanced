/**
 * apps/api/src/modules/insights/storia-repository.ts
 * F3c — lettura della storia del tenant da cui nascono le stime di probabilita.ts.
 *
 * Solo letture, SQL parametrizzato, sempre filtrate sul tenant (I5). Nomi delle colonne
 * e collegamenti misurati su heuresys_advanced il 2026-11-26 (tenant RTL Bank):
 *  - uscite: sys_user_employment (hire_date, termination_date); in forza all'inizio del
 *    trimestre chi è assunto prima e non è uscito prima;
 *  - selezione: offerta ACCEPTED → candidatura → annuncio → requisizione, giorni da
 *    requisition_opened_on a offer_start_date;
 *  - formazione: assegnazione con iniziativa → training_initiative_start_date, prima
 *    evidenza completed_at della stessa persona sullo stesso modulo dopo l'inizio;
 *  - prontezza: valutazioni successive dello stesso candidato in sys_successor_readiness.
 */
import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

export interface TrimestreLetto {
  inizio: string;
  esposti: number;
  uscite: number;
}

/**
 * Persone in forza all'inizio di ogni trimestre e uscite dentro il trimestre, dai
 * trimestri interi fra `dal` (incluso) e il trimestre in corso (escluso).
 */
export async function leggiTrimestriUscite(db: DbConnector, tenantId: string, dal: string): Promise<TrimestreLetto[]> {
  const { rows } = await db.query<{ inizio: string; esposti: number; uscite: number }>(
    `WITH q AS (
       SELECT gs::date AS inizio, (gs + interval '3 months')::date AS fine
         FROM generate_series(date_trunc('quarter', $2::date),
                              date_trunc('quarter', current_date) - interval '3 months',
                              interval '3 months') AS gs
     )
     SELECT to_char(q.inizio, 'YYYY-MM-DD') AS inizio,
            count(*) FILTER (WHERE e.user_employment_hire_date < q.inizio
                               AND (e.user_employment_termination_date IS NULL
                                    OR e.user_employment_termination_date >= q.inizio))::int AS esposti,
            count(*) FILTER (WHERE e.user_employment_hire_date < q.inizio
                               AND e.user_employment_termination_date >= q.inizio
                               AND e.user_employment_termination_date < q.fine)::int AS uscite
       FROM q
       LEFT JOIN sys.sys_user_employment e ON e.user_employment_tenant_id = $1
      GROUP BY q.inizio
      ORDER BY q.inizio`,
    [tenantId, dal],
  );
  return rows;
}

/** Giorni dall'apertura della requisizione all'ingresso della persona, per le offerte accettate. */
export async function leggiDurateSelezione(
  db: DbConnector,
  tenantId: string,
): Promise<{ motivo: string; giorni: number }[]> {
  const { rows } = await db.query<{ motivo: string; giorni: number }>(
    `SELECT r.requisition_reason AS motivo,
            (o.offer_start_date - r.requisition_opened_on)::int AS giorni
       FROM sys.sys_job_offers o
       JOIN sys.sys_candidate_applications a ON a.application_id = o.offer_application_id
       JOIN sys.sys_job_postings p ON p.posting_id = a.application_posting_id
       JOIN sys.sys_job_requisitions r ON r.requisition_id = p.posting_requisition_id
      WHERE o.offer_tenant_id = $1 AND r.requisition_tenant_id = $1
        AND o.offer_status = 'ACCEPTED'
        AND o.offer_start_date IS NOT NULL AND r.requisition_opened_on IS NOT NULL
        AND o.offer_start_date >= r.requisition_opened_on
      ORDER BY 2`,
    [tenantId],
  );
  return rows;
}

/**
 * Corsi con un inizio: giorni dall'inizio dell'iniziativa alla prima evidenza di
 * completamento, e se è arrivata entro la scadenza. `giorni` è null se l'evidenza non c'è.
 */
export async function leggiDurateFormazione(
  db: DbConnector,
  tenantId: string,
): Promise<{ giorni: number | null; entroScadenza: boolean | null }[]> {
  const { rows } = await db.query<{ giorni: number | null; entro_scadenza: boolean | null }>(
    `SELECT (ev.prima::date - ti.training_initiative_start_date)::int AS giorni,
            CASE WHEN ev.prima IS NULL OR a.user_learning_assignment_deadline IS NULL THEN NULL
                 ELSE ev.prima::date <= a.user_learning_assignment_deadline END AS entro_scadenza
       FROM sys.sys_user_learning_assignments a
       JOIN sys.sys_training_initiatives ti
         ON ti.training_initiative_id = a.user_learning_assignment_initiative_id
       LEFT JOIN LATERAL (
         SELECT min(e.user_learning_evidence_completed_at) AS prima
           FROM sys.sys_user_learning_evidence e
          WHERE e.user_learning_evidence_tenant_id = $1
            AND e.user_learning_evidence_user_id = a.user_learning_assignment_user_id
            AND e.user_learning_evidence_module_id = a.user_learning_assignment_module_id
            AND e.user_learning_evidence_completed_at::date >= ti.training_initiative_start_date
       ) ev ON true
      WHERE a.user_learning_assignment_tenant_id = $1
        AND ti.training_initiative_start_date IS NOT NULL
        AND a.user_learning_assignment_module_id IS NOT NULL`,
    [tenantId],
  );
  return rows.map((r) => ({ giorni: r.giorni, entroScadenza: r.entro_scadenza }));
}

/** Gradini di prontezza, dal più lontano al più vicino. */
export const GRADINI_PRONTEZZA = ["NOT_READY", "READY_2_YEARS", "READY_1_YEAR", "READY_6_MONTHS", "READY_NOW"] as const;

/** Coppie di valutazioni successive dello stesso candidato: gradino prima, gradino dopo, giorni fra le due. */
export async function leggiPassaggiProntezza(
  db: DbConnector,
  tenantId: string,
): Promise<{ prima: string; dopo: string; giorni: number }[]> {
  const { rows } = await db.query<{ prima: string; dopo: string; giorni: number }>(
    `SELECT prima, dopo, giorni FROM (
       SELECT r.successor_readiness_horizon AS prima,
              lead(r.successor_readiness_horizon) OVER w AS dopo,
              (lead(r.successor_readiness_assessed_at) OVER w::date - r.successor_readiness_assessed_at::date)::int AS giorni
         FROM sys.sys_successor_readiness r
        WHERE r.successor_readiness_tenant_id = $1
          AND r.successor_readiness_horizon IS NOT NULL
       WINDOW w AS (PARTITION BY r.successor_readiness_candidate_id ORDER BY r.successor_readiness_assessed_at)
     ) x
     WHERE dopo IS NOT NULL`,
    [tenantId],
  );
  return rows;
}

/**
 * La storia del tenant è generata? Sì se la storia36 vi ha lasciato il suo segno
 * (`metadata ? 'storia36'`) nelle requisizioni o nelle iniziative di formazione.
 */
export async function storiaGenerata(db: DbConnector, tenantId: string): Promise<boolean> {
  const { rows } = await db.query<{ generata: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM sys.sys_job_requisitions
                     WHERE requisition_tenant_id = $1 AND requisition_metadata ? 'storia36')
         OR EXISTS (SELECT 1 FROM sys.sys_training_initiatives
                     WHERE training_initiative_tenant_id = $1 AND training_initiative_metadata ? 'storia36')
            AS generata`,
    [tenantId],
  );
  return rows[0]?.generata ?? false;
}
