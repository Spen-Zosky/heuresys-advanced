/**
 * apps/api/src/modules/org-health/repository.ts
 * #57 F3 — raw parameterized SQL for the organizational health index.
 *
 * One pass per dimension, all aggregated to the org-unit through the unit's PRIMARY-ACTIVE
 * incumbents (maturity is already per-unit and comes straight from the Maturity engine).
 * Everything returns counts alongside values so the service can tell "scored 0" from
 * "no data", which the composite treats very differently.
 *
 * Engagement — #187 (2026-08-14). Questo modulo leggeva `sys_engagement_survey_responses`,
 * che è la famiglia FERMA: sei sondaggi, tutti chiusi, l'ultimo il 2025-01-31. L'indice di
 * salute raccontava quindi un clima vecchio di diciannove mesi, mentre la rilevazione vera
 * andava avanti nell'altra famiglia. Il modulo era scritto bene sulla tabella sbagliata.
 *
 * Ora legge `sys_survey_responses` + `sys_survey_questions`, dove il clima vive davvero
 * (misurato 2026-08-14: 8.288 risposte, l'ultima rilevazione conclusa il 2026-06-26).
 *
 * DUE SCELTE, entrambe misurate prima di scriverle:
 *
 * 1. L'ULTIMA RILEVAZIONE CONCLUSA per tenant, non tutte le risposte. Mediare tre anni di
 *    rilevazioni smorza proprio ciò che un indice di clima deve mostrare: la curva della
 *    riorganizzazione (7,71 → 6,80 → 7,61) non arrivava all'indice. La rilevazione `active`
 *    esiste ma ha 0 risposte: entrerà da sé quando ne avrà, senza toccare questo codice.
 *
 * 2. LA SCALA È 1..10, NON 1..5. Qui i valori sono colonne tipizzate, non un payload JSON:
 *    `survey_response_rating_value` è intero e — misurato su tutte le rilevazioni con dati —
 *    sta fra 3 e 10, con la massa fra 6 e 8. Normalizzare come se fosse 1..5 (l'errore che
 *    la famiglia vecchia richiedeva) schiaccerebbe ogni risposta sopra il 5 a punteggio
 *    pieno. `rating` → (v-1)/9 · `nps` → v/10. Le risposte non numeriche (testo, scelta)
 *    non sono misurazioni e restano fuori.
 *
 * Delta dichiarato sull'indice di engagement, misurato sullo stesso DB il 2026-08-14:
 * 0,6576 su 3.980 risposte ferme → 0,7342 su 800 risposte della rilevazione 2026-H2.
 */
import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/client.js";

type Queryable = Pool | PoolClient;

export interface OrgHealthUnitRow {
  orgUnitId: string;
  orgUnitName: string;
  headcount: number;
  engagementScore: number | null; // [0,1]
  engagementSample: number;
  executionScore: number | null;
  executionSample: number;
  retentionScore: number | null;
  retentionSample: number;
  stabilityScore: number | null;
  stabilitySample: number;
  performanceScore: number | null;
  performanceSample: number;
  maturityScore: number | null;
  maturitySample: number;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * Loads every org-unit that has at least one PRIMARY-ACTIVE incumbent, with its six
 * health dimensions. Units with no people are not organizational units in any meaningful
 * sense here — they would score nothing and only pad the scorecard.
 */
export async function loadOrgHealthInputs(
  tenantId: string | null,
  q: Queryable = pool,
): Promise<OrgHealthUnitRow[]> {
  const res = await q.query<{
    org_unit_id: string; org_unit_name: string; headcount: string;
    engagement_score: string | null; engagement_sample: string;
    execution_score: string | null; execution_sample: string;
    retention_score: string | null; retention_sample: string;
    stability_score: string | null; stability_sample: string;
    performance_score: string | null; performance_sample: string;
    maturity_score: string | null; maturity_sample: string;
  }>(
    `WITH ou_people AS (
       SELECT p.position_organization_unit_id AS ou_id,
              a.user_position_assignment_user_id AS user_id
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_kind = 'PRIMARY'
          AND a.user_position_assignment_status = 'ACTIVE'
          AND p.position_organization_unit_id IS NOT NULL
          AND ($1::uuid IS NULL OR p.position_tenant_id = $1::uuid)
     ),
     latest_survey AS (
       -- l'ultima rilevazione CON RISPOSTE per tenant: una aperta e ancora vuota non
       -- deve spegnere l'indice, e una archiviata senza dati non deve vincerla
       SELECT DISTINCT ON (s.survey_tenant_id) s.survey_id
         FROM sys.sys_surveys s
        WHERE ($1::uuid IS NULL OR s.survey_tenant_id = $1::uuid)
          AND EXISTS (SELECT 1 FROM sys.sys_survey_responses r
                       WHERE r.survey_response_survey_id = s.survey_id
                         AND r.survey_response_rating_value IS NOT NULL)
        ORDER BY s.survey_tenant_id, s.survey_end_date DESC NULLS LAST, s.created_at DESC
     ),
     engagement AS (
       -- scala 1..10 (misurata, vedi testata); testo e scelta non sono misurazioni
       SELECT op.ou_id,
              avg(CASE
                    WHEN q.survey_question_type = 'nps'
                      THEN r.survey_response_rating_value::numeric / 10.0
                    WHEN q.survey_question_type = 'rating'
                      THEN (r.survey_response_rating_value::numeric - 1) / 9.0
                  END) AS score,
              count(*) FILTER (
                WHERE q.survey_question_type IN ('rating', 'nps')
              ) AS sample
         FROM ou_people op
         JOIN sys.sys_survey_responses r
              ON r.survey_response_subject_user_id = op.user_id
             AND r.survey_response_rating_value IS NOT NULL
         JOIN latest_survey ls ON ls.survey_id = r.survey_response_survey_id
         JOIN sys.sys_survey_questions q
              ON q.survey_question_id = r.survey_response_question_id
        GROUP BY op.ou_id
     ),
     execution AS (
       -- a goal that is at risk or cancelled is the organization failing to execute
       SELECT op.ou_id,
              avg(CASE WHEN g.goal_status IN ('AT_RISK','CANCELLED') THEN 0.0 ELSE 1.0 END) AS score,
              count(*) AS sample
         FROM ou_people op
         JOIN sys.sys_goals g ON g.goal_subject_user_id = op.user_id
        GROUP BY op.ou_id
     ),
     retention AS (
       -- flight-risk is 0..100 where high = likely to leave; health is its complement
       SELECT op.ou_id,
              1.0 - (avg(f.flight_risk_score_value) / 100.0) AS score,
              count(*) AS sample
         FROM ou_people op
         JOIN sys.sys_flight_risk_scores f ON f.flight_risk_score_user_id = op.user_id
        GROUP BY op.ou_id
     ),
     stability AS (
       -- share of recorded days actually worked (on site, remote or in training)
       SELECT op.ou_id,
              avg(CASE WHEN att.attendance_status IN ('PRESENT','REMOTE','TRAINING') THEN 1.0 ELSE 0.0 END) AS score,
              count(*) AS sample
         FROM ou_people op
         JOIN sys.sys_attendance att ON att.attendance_subject_user_id = op.user_id
        GROUP BY op.ou_id
     ),
     performance AS (
       SELECT op.ou_id,
              avg((pr.review_overall_rating - 1) / 4.0) AS score,
              count(*) AS sample
         FROM ou_people op
         JOIN sys.sys_performance_reviews pr
              ON pr.review_subject_user_id = op.user_id AND pr.review_overall_rating IS NOT NULL
        GROUP BY op.ou_id
     ),
     maturity AS (
       -- latest composite per unit from the Maturity engine (already 0..100)
       SELECT DISTINCT ON (capability_maturity_score_org_unit_id)
              capability_maturity_score_org_unit_id AS ou_id,
              capability_maturity_score_composite / 100.0 AS score
         FROM sys.sys_capability_maturity_scores
        ORDER BY capability_maturity_score_org_unit_id, capability_maturity_score_computed_at DESC
     ),
     units AS (
       SELECT ou_id, count(*) AS headcount FROM ou_people GROUP BY ou_id
     )
     SELECT u.ou_id AS org_unit_id, o.organization_unit_name AS org_unit_name,
            u.headcount::text,
            eng.score::text  AS engagement_score,  COALESCE(eng.sample, 0)::text AS engagement_sample,
            exe.score::text  AS execution_score,   COALESCE(exe.sample, 0)::text AS execution_sample,
            ret.score::text  AS retention_score,   COALESCE(ret.sample, 0)::text AS retention_sample,
            sta.score::text  AS stability_score,   COALESCE(sta.sample, 0)::text AS stability_sample,
            perf.score::text AS performance_score, COALESCE(perf.sample, 0)::text AS performance_sample,
            mat.score::text  AS maturity_score,
            (CASE WHEN mat.score IS NULL THEN 0 ELSE 1 END)::text AS maturity_sample
       FROM units u
       JOIN sys.sys_organization_units o ON o.organization_unit_id = u.ou_id
       LEFT JOIN engagement  eng  ON eng.ou_id  = u.ou_id
       LEFT JOIN execution   exe  ON exe.ou_id  = u.ou_id
       LEFT JOIN retention   ret  ON ret.ou_id  = u.ou_id
       LEFT JOIN stability   sta  ON sta.ou_id  = u.ou_id
       LEFT JOIN performance perf ON perf.ou_id = u.ou_id
       LEFT JOIN maturity    mat  ON mat.ou_id  = u.ou_id
      ORDER BY o.organization_unit_name`,
    [tenantId],
  );

  return res.rows.map((r) => ({
    orgUnitId: r.org_unit_id,
    orgUnitName: r.org_unit_name,
    headcount: Number(r.headcount),
    engagementScore: num(r.engagement_score),
    engagementSample: Number(r.engagement_sample),
    executionScore: num(r.execution_score),
    executionSample: Number(r.execution_sample),
    retentionScore: num(r.retention_score),
    retentionSample: Number(r.retention_sample),
    stabilityScore: num(r.stability_score),
    stabilitySample: Number(r.stability_sample),
    performanceScore: num(r.performance_score),
    performanceSample: Number(r.performance_sample),
    maturityScore: num(r.maturity_score),
    maturitySample: Number(r.maturity_sample),
  }));
}
