/**
 * apps/api/src/modules/org-health/repository.ts
 * #57 F3 — raw parameterized SQL for the organizational health index.
 *
 * One pass per dimension, all aggregated to the org-unit through the unit's PRIMARY-ACTIVE
 * incumbents (maturity is already per-unit and comes straight from the Maturity engine).
 * Everything returns counts alongside values so the service can tell "scored 0" from
 * "no data", which the composite treats very differently.
 *
 * Engagement note — the answers payload is NOT uniform. Two shapes coexist in
 * sys_engagement_survey_responses.response_answers:
 *   A  {"value": 4, "question_id": "q1", "question_type": "rating"}   → value is 1..5 for
 *      EVERY question_type, nps included
 *   B  {"rating": 2, …} | {"nps": 6, …} | {"text": "…", …}            → rating is 1..5 but
 *      nps is 0..10
 * Reading only `value` would capture 1015 of 2794 ratings (36%) and quietly score the
 * organization on a third of its own survey. Each shape is normalized on its own scale;
 * free-text answers are excluded — in shape A they still carry a numeric `value`, which is
 * a leftover, not a measurement.
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
     engagement AS (
       -- normalize both payload shapes onto [0,1]; free text is not a measurement
       SELECT op.ou_id,
              avg(CASE
                    WHEN e.elem ? 'rating' THEN ((e.elem->>'rating')::numeric - 1) / 4.0
                    WHEN e.elem ? 'nps'    THEN (e.elem->>'nps')::numeric / 10.0
                    WHEN e.elem ? 'value' AND e.elem->>'question_type' IN ('rating','nps')
                                           THEN ((e.elem->>'value')::numeric - 1) / 4.0
                  END) AS score,
              count(*) FILTER (
                WHERE e.elem ? 'rating' OR e.elem ? 'nps'
                   OR (e.elem ? 'value' AND e.elem->>'question_type' IN ('rating','nps'))
              ) AS sample
         FROM ou_people op
         JOIN sys.sys_engagement_survey_responses r
              ON r.response_subject_user_id = op.user_id AND r.response_is_complete
         CROSS JOIN LATERAL jsonb_array_elements(r.response_answers) e(elem)
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
