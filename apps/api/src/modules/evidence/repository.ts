/**
 * apps/api/src/modules/evidence/repository.ts — #27 (S1018) evidence layer.
 *
 * Normalizes 9 fragmented per-domain evidence tables into ONE EvidenceItem via
 * UNION ALL, LEFT JOINs the ingestion lineage for a provenance footer, and
 * paginates over the merged, time-ordered set. Every branch filters by the
 * (fixed, already org-gated) subject user on an indexed column. Anonymous 360
 * responses null their reviewer id (deanonymization guard).
 */
import type { Pool, PoolClient } from "pg";
import type { EvidenceItem, EvidenceKind, EvidenceProvenance } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/**
 * One SQL fragment per kind → the normalized projection:
 *   (evidence_id, kind, subject_user_id, title, score, narrative, source,
 *    assessor_user_id, recorded_at, source_table, source_record_id, payload)
 * `$1` = subject user id. `includePrivate` gates CONTINUOUS_FEEDBACK is_private rows.
 */
function branch(kind: EvidenceKind, includePrivate: boolean): string {
  switch (kind) {
    case "ASSESSMENT":
      return `SELECT user_assessment_evidence_id AS evidence_id, 'ASSESSMENT' AS kind,
                     user_assessment_evidence_user_id AS subject_user_id,
                     coalesce(user_assessment_evidence_dimension, 'Assessment') AS title,
                     user_assessment_evidence_score AS score,
                     user_assessment_evidence_narrative AS narrative,
                     'ASSESSMENT'::text AS source,
                     user_assessment_evidence_assessor_user_id AS assessor_user_id,
                     coalesce(user_assessment_evidence_recorded_at, created_at) AS recorded_at,
                     'sys_user_assessment_evidence'::text AS source_table,
                     user_assessment_evidence_id AS source_record_id,
                     user_assessment_evidence_metadata AS payload
              FROM sys.sys_user_assessment_evidence WHERE user_assessment_evidence_user_id = $1`;
    case "SKILL":
      return `SELECT e.user_skill_evidence_id AS evidence_id, 'SKILL' AS kind,
                     e.user_skill_evidence_user_id AS subject_user_id,
                     coalesce(s.skill_name, 'Skill') AS title,
                     e.user_skill_evidence_score AS score,
                     e.user_skill_evidence_comment AS narrative,
                     e.user_skill_evidence_source AS source,
                     e.user_skill_evidence_assessor_user_id AS assessor_user_id,
                     coalesce(e.user_skill_evidence_assessed_at, e.created_at) AS recorded_at,
                     'sys_user_skill_evidence'::text AS source_table,
                     e.user_skill_evidence_id AS source_record_id,
                     e.user_skill_evidence_metadata AS payload
              FROM sys.sys_user_skill_evidence e
              LEFT JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id
              WHERE e.user_skill_evidence_user_id = $1`;
    case "LEARNING":
      return `SELECT e.user_learning_evidence_id AS evidence_id, 'LEARNING' AS kind,
                     e.user_learning_evidence_user_id AS subject_user_id,
                     coalesce(m.learning_module_title, 'Learning module') AS title,
                     e.user_learning_evidence_score AS score,
                     e.user_learning_evidence_certificate_uri AS narrative,
                     'LEARNING'::text AS source,
                     NULL::uuid AS assessor_user_id,
                     coalesce(e.user_learning_evidence_completed_at, e.created_at) AS recorded_at,
                     'sys_user_learning_evidence'::text AS source_table,
                     e.user_learning_evidence_id AS source_record_id,
                     e.user_learning_evidence_metadata AS payload
              FROM sys.sys_user_learning_evidence e
              LEFT JOIN sys.sys_learning_modules m ON m.learning_module_id = e.user_learning_evidence_module_id
              WHERE e.user_learning_evidence_user_id = $1`;
    case "CONTINUOUS_FEEDBACK":
      return `SELECT feedback_id AS evidence_id, 'CONTINUOUS_FEEDBACK' AS kind,
                     feedback_to_user_id AS subject_user_id,
                     coalesce(feedback_type, 'Feedback') AS title,
                     feedback_sentiment_score AS score,
                     feedback_message AS narrative,
                     feedback_category AS source,
                     feedback_from_user_id AS assessor_user_id,
                     created_at AS recorded_at,
                     'sys_continuous_feedback'::text AS source_table,
                     feedback_id AS source_record_id,
                     feedback_metadata AS payload
              FROM sys.sys_continuous_feedback
              WHERE feedback_to_user_id = $1${includePrivate ? "" : " AND feedback_is_private = false"}`;
    case "BEHAVIORAL":
      return `SELECT behavioral_assessment_id AS evidence_id, 'BEHAVIORAL' AS kind,
                     behavioral_assessment_user_id AS subject_user_id,
                     coalesce(behavioral_assessment_competency, 'Behavioral') AS title,
                     behavioral_assessment_score AS score,
                     NULL::text AS narrative,
                     'BEHAVIORAL'::text AS source,
                     NULL::uuid AS assessor_user_id,
                     coalesce(behavioral_assessment_recorded_at, created_at) AS recorded_at,
                     'sys_behavioral_assessments'::text AS source_table,
                     behavioral_assessment_id AS source_record_id,
                     behavioral_assessment_evidence_payload AS payload
              FROM sys.sys_behavioral_assessments WHERE behavioral_assessment_user_id = $1`;
    case "COMPETENCY_RATING":
      return `SELECT rating_id AS evidence_id, 'COMPETENCY_RATING' AS kind,
                     rating_subject_user_id AS subject_user_id,
                     coalesce(rating_competency_name, 'Competency') AS title,
                     rating_manager_rating AS score,
                     rating_manager_comment AS narrative,
                     rating_ksaba_dimension AS source,
                     NULL::uuid AS assessor_user_id,
                     created_at AS recorded_at,
                     'sys_performance_review_competency_ratings'::text AS source_table,
                     rating_id AS source_record_id,
                     rating_metadata AS payload
              FROM sys.sys_performance_review_competency_ratings WHERE rating_subject_user_id = $1`;
    case "FEEDBACK_360":
      return `SELECT response_id AS evidence_id, 'FEEDBACK_360' AS kind,
                     response_target_user_id AS subject_user_id,
                     coalesce(response_relationship_type, '360 response') AS title,
                     response_overall_rating AS score,
                     response_strengths AS narrative,
                     response_relationship_type AS source,
                     CASE WHEN response_is_anonymous THEN NULL ELSE response_reviewer_user_id END AS assessor_user_id,
                     coalesce(response_completed_at, created_at) AS recorded_at,
                     'sys_feedback_360_responses'::text AS source_table,
                     response_id AS source_record_id,
                     response_metadata AS payload
              FROM sys.sys_feedback_360_responses WHERE response_target_user_id = $1`;
    case "KPI_RESULT":
      return `SELECT r.kpi_assessment_result_id AS evidence_id, 'KPI_RESULT' AS kind,
                     r.kpi_assessment_result_user_id AS subject_user_id,
                     coalesce(k.kpi_definition_name, 'KPI result') AS title,
                     r.kpi_assessment_result_score AS score,
                     NULL::text AS narrative,
                     'KPI_RESULT'::text AS source,
                     NULL::uuid AS assessor_user_id,
                     coalesce(r.kpi_assessment_result_computed_at, r.created_at) AS recorded_at,
                     'sys_kpi_assessment_results'::text AS source_table,
                     r.kpi_assessment_result_id AS source_record_id,
                     r.kpi_assessment_result_payload AS payload
              FROM sys.sys_kpi_assessment_results r
              LEFT JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = r.kpi_assessment_result_kpi_id
              WHERE r.kpi_assessment_result_user_id = $1`;
    case "PERSON_RECORD":
      return `SELECT person_evidence_record_id AS evidence_id, 'PERSON_RECORD' AS kind,
                     person_evidence_record_user_id AS subject_user_id,
                     coalesce(person_evidence_type, 'Evidence record') AS title,
                     NULL::numeric AS score,
                     NULL::text AS narrative,
                     person_evidence_source AS source,
                     person_evidence_recorded_by AS assessor_user_id,
                     coalesce(person_evidence_recorded_at, created_at) AS recorded_at,
                     'sys_person_evidence_records'::text AS source_table,
                     person_evidence_record_id AS source_record_id,
                     person_evidence_payload AS payload
              FROM sys.sys_person_evidence_records WHERE person_evidence_record_user_id = $1`;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`unknown evidence kind: ${String(_exhaustive)}`);
    }
  }
}

const ALL_KINDS: EvidenceKind[] = [
  "ASSESSMENT", "SKILL", "LEARNING", "CONTINUOUS_FEEDBACK", "BEHAVIORAL",
  "COMPETENCY_RATING", "FEEDBACK_360", "KPI_RESULT", "PERSON_RECORD",
];

interface EvidenceRow {
  evidence_id: string; kind: string; subject_user_id: string; title: string;
  score: string | null; narrative: string | null; source: string | null;
  assessor_user_id: string | null; recorded_at: Date;
  source_table: string; source_record_id: string; payload: Record<string, unknown> | null;
  lin_system: string | null; lin_confidence: string | null; lin_validation: string | null;
  sdbi_confidence: string | null; sdbi_model: string | null; sdbi_approver: string | null;
}

function toItem(r: EvidenceRow): EvidenceItem {
  const provenance: EvidenceProvenance | null = r.lin_system === null ? null : {
    sourceSystem: r.lin_system,
    sourceTable: r.source_table,
    sourceRecordId: r.source_record_id,
    mappingConfidence: r.lin_confidence === null ? null : Number(r.lin_confidence),
    sdbiConfidence: r.sdbi_confidence === null ? null : Number(r.sdbi_confidence),
    sdbiAiModelId: r.sdbi_model,
    sdbiHumanApprover: r.sdbi_approver,
    validationStatus: r.lin_validation as EvidenceProvenance["validationStatus"],
  };
  return {
    evidenceId: r.evidence_id, kind: r.kind as EvidenceKind, subjectUserId: r.subject_user_id,
    title: r.title, score: r.score === null ? null : Number(r.score), narrative: r.narrative,
    source: r.source, assessorUserId: r.assessor_user_id, recordedAt: r.recorded_at.toISOString(),
    sourceTable: r.source_table, sourceRecordId: r.source_record_id,
    provenance, payload: r.payload ?? {},
  };
}

const PROV_JOIN = `LEFT JOIN sys.sys_source_lineage_records l
  ON l.source_lineage_target_table_name = ev.source_table
 AND l.source_lineage_target_record_id = ev.source_record_id`;
const PROV_COLS = `l.source_lineage_source_system AS lin_system,
  l.source_lineage_mapping_confidence AS lin_confidence,
  l.source_lineage_validation_status AS lin_validation,
  l.source_lineage_sdbi_confidence AS sdbi_confidence,
  l.source_lineage_sdbi_ai_model_id AS sdbi_model,
  l.source_lineage_sdbi_human_approver AS sdbi_approver`;

export async function listEvidenceForSubject(
  q: DbConnector, subjectUserId: string, kinds: EvidenceKind[],
  includePrivate: boolean, limit: number, offset: number,
): Promise<{ items: EvidenceItem[]; total: number }> {
  const effective = kinds.length ? kinds.filter((k) => ALL_KINDS.includes(k)) : ALL_KINDS;
  if (effective.length === 0) return { items: [], total: 0 };
  const union = effective.map((k) => branch(k, includePrivate)).join("\nUNION ALL\n");
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM (${union}) ev`, [subjectUserId]);
  const res = await q.query<EvidenceRow>(
    `WITH ev AS (${union})
     SELECT ev.*, ${PROV_COLS}
       FROM (SELECT * FROM ev ORDER BY recorded_at DESC, evidence_id LIMIT $2 OFFSET $3) ev
       ${PROV_JOIN}
      ORDER BY ev.recorded_at DESC, ev.evidence_id`,
    [subjectUserId, limit, offset]);
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toItem) };
}

// ── #27: for-score resolution — map a score row → its subject + explainable derivation ──
import type { EvidenceScoreType } from "@heuresys/shared";

export interface ResolvedScore {
  subjectUserId: string; tenantId: string; value: number | null; band: string | null;
  modelVersion: string | null; derivation: Record<string, unknown>; computedAt: string;
}

/** Config per score type: table + column names (all validated against live DDL, S1018). */
const SCORE_SOURCES: Record<EvidenceScoreType, {
  table: string; id: string; user: string; tenant: string;
  value: string; band: string | "NULL"; model: string | "NULL"; payload: string; at: string;
}> = {
  LEARNING_GAP: {
    table: "sys_learning_gaps", id: "learning_gap_id", user: "learning_gap_user_id",
    tenant: "learning_gap_tenant_id", value: "learning_gap_score", band: "learning_gap_severity",
    model: "NULL", payload: "learning_gap_metadata", at: "coalesce(learning_gap_detected_at, created_at)",
  },
  SKILL_GAP_SCORE: {
    table: "sys_skill_gap_scores", id: "skill_gap_score_id", user: "skill_gap_score_user_id",
    tenant: "skill_gap_score_tenant_id", value: "skill_gap_score_value", band: "skill_gap_score_segment",
    model: "skill_gap_score_model_version", payload: "skill_gap_score_payload", at: "skill_gap_score_computed_at",
  },
  SUCCESSION_READINESS_SCORE: {
    table: "sys_succession_readiness_scores", id: "succession_readiness_score_id",
    user: "succession_readiness_score_user_id", tenant: "succession_readiness_score_tenant_id",
    value: "succession_readiness_score_value", band: "succession_readiness_score_horizon",
    model: "succession_readiness_score_model_version", payload: "succession_readiness_score_payload",
    at: "succession_readiness_score_computed_at",
  },
  FLIGHT_RISK_SCORE: {
    table: "sys_flight_risk_scores", id: "flight_risk_score_id", user: "flight_risk_score_user_id",
    tenant: "flight_risk_score_tenant_id", value: "flight_risk_score_value", band: "flight_risk_score_band",
    model: "flight_risk_score_model_version", payload: "flight_risk_score_payload", at: "flight_risk_score_computed_at",
  },
};

interface ScoreRow {
  subject_user_id: string; tenant_id: string; value: string | null; band: string | null;
  model_version: string | null; derivation: Record<string, unknown> | null; computed_at: Date;
}
export async function resolveScore(
  q: DbConnector, scoreType: EvidenceScoreType, scoreId: string,
): Promise<ResolvedScore | null> {
  const s = SCORE_SOURCES[scoreType]!;
  const res = await q.query<ScoreRow>(
    `SELECT ${s.user} AS subject_user_id, ${s.tenant} AS tenant_id,
            ${s.value} AS value, ${s.band} AS band, ${s.model} AS model_version,
            ${s.payload} AS derivation, ${s.at} AS computed_at
       FROM sys.${s.table} WHERE ${s.id} = $1`, [scoreId]);
  const r = res.rows[0];
  if (!r) return null;
  return {
    subjectUserId: r.subject_user_id, tenantId: r.tenant_id,
    value: r.value === null ? null : Number(r.value), band: r.band,
    modelVersion: r.model_version, derivation: r.derivation ?? {},
    computedAt: r.computed_at.toISOString(),
  };
}

/** Which evidence kinds explain a given score type (drill-down relevance). */
export const SCORE_EVIDENCE_KINDS: Record<EvidenceScoreType, EvidenceKind[]> = {
  LEARNING_GAP: ["SKILL", "LEARNING"],
  SKILL_GAP_SCORE: ["SKILL", "LEARNING", "ASSESSMENT"],
  SUCCESSION_READINESS_SCORE: ["ASSESSMENT", "KPI_RESULT", "BEHAVIORAL", "COMPETENCY_RATING"],
  FLIGHT_RISK_SCORE: [], // all kinds (flight-risk composes broadly)
};

/** Subject's tenant (for the org-target check before running the union). */
export async function userTenant(q: DbConnector, userId: string): Promise<string | null> {
  const r = await q.query<{ t: string }>(
    `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`, [userId]);
  return r.rows[0]?.t ?? null;
}
