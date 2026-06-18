/**
 * apps/api/src/modules/engagement/repository.ts
 * B-10b m2b — normalized engagement cluster read-model. Raw parameterized SQL over
 * sys_surveys / sys_survey_questions / sys_survey_responses / sys_pulse_checks. READ-ONLY.
 * Tenant scoping is applied by the service (PLATFORM_ADMIN unfiltered; others own tenant).
 */
import type { Pool } from "pg";
import type {
  EngagementSurvey,
  EngagementSurveyTemplate,
  EngagementQuestionResult,
  EngagementPulseWeek,
} from "@heuresys/shared";

const toDate = (d: Date | string | null): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

/** Surveys + derived question/response counts. `tenantId` undefined = no filter (PLATFORM_ADMIN). */
export async function listSurveys(pool: Pool, tenantId: string | undefined): Promise<EngagementSurvey[]> {
  const res = await pool.query(
    `SELECT s.survey_id, s.survey_tenant_id, s.survey_title, s.survey_description, s.survey_type,
            s.survey_status, s.survey_start_date, s.survey_end_date, s.survey_is_anonymous,
            s.survey_total_invitations,
            (SELECT count(*) FROM sys.sys_survey_questions q WHERE q.survey_question_survey_id = s.survey_id) AS question_count,
            (SELECT count(*) FROM sys.sys_survey_responses r WHERE r.survey_response_survey_id = s.survey_id) AS response_count
       FROM sys.sys_surveys s
      WHERE ($1::uuid IS NULL OR s.survey_tenant_id = $1)
      ORDER BY s.survey_start_date DESC NULLS LAST, s.survey_title
      LIMIT 5000`,
    [tenantId ?? null],
  );
  return res.rows.map((r) => ({
    surveyId: r.survey_id,
    tenantId: r.survey_tenant_id,
    title: r.survey_title,
    description: r.survey_description,
    type: r.survey_type,
    status: r.survey_status,
    startDate: toDate(r.survey_start_date),
    endDate: toDate(r.survey_end_date),
    isAnonymous: r.survey_is_anonymous,
    totalInvitations: numOrNull(r.survey_total_invitations),
    questionCount: Number(r.question_count),
    responseCount: Number(r.response_count),
  }));
}

/** Survey templates (mirror catalog, #6/#10). `tenantId` undefined = no filter (PLATFORM_ADMIN). */
export async function listTemplates(pool: Pool, tenantId: string | undefined): Promise<EngagementSurveyTemplate[]> {
  const res = await pool.query(
    `SELECT survey_template_id, survey_template_tenant_id, survey_template_natural_key,
            survey_template_name, survey_template_description, survey_template_type,
            jsonb_array_length(survey_template_questions) AS question_count,
            survey_template_is_anonymous, survey_template_estimated_minutes, survey_template_is_system
       FROM sys.sys_survey_templates
      WHERE ($1::uuid IS NULL OR survey_template_tenant_id = $1)
      ORDER BY survey_template_name
      LIMIT 5000`,
    [tenantId ?? null],
  );
  return res.rows.map((r) => ({
    templateId: r.survey_template_id,
    tenantId: r.survey_template_tenant_id,
    naturalKey: r.survey_template_natural_key,
    name: r.survey_template_name,
    description: r.survey_template_description,
    type: r.survey_template_type,
    questionCount: Number(r.question_count),
    isAnonymous: r.survey_template_is_anonymous,
    estimatedMinutes: numOrNull(r.survey_template_estimated_minutes),
    isSystem: r.survey_template_is_system,
  }));
}

/** Minimal survey row for visibility checks (tenant) + 404. */
export async function findSurveyMeta(
  pool: Pool,
  surveyId: string,
): Promise<{ surveyId: string; tenantId: string; title: string } | null> {
  const res = await pool.query(
    `SELECT survey_id, survey_tenant_id, survey_title FROM sys.sys_surveys WHERE survey_id = $1`,
    [surveyId],
  );
  const r = res.rows[0];
  return r ? { surveyId: r.survey_id, tenantId: r.survey_tenant_id, title: r.survey_title } : null;
}

/** Per-question aggregation (response count + avg rating) for one survey. */
export async function surveyResults(pool: Pool, surveyId: string): Promise<EngagementQuestionResult[]> {
  const res = await pool.query(
    `SELECT q.survey_question_id, q.survey_question_text, q.survey_question_type,
            q.survey_question_category, q.survey_question_display_order,
            count(r.survey_response_id) AS response_count,
            avg(r.survey_response_rating_value) FILTER (WHERE r.survey_response_rating_value IS NOT NULL) AS avg_rating
       FROM sys.sys_survey_questions q
       LEFT JOIN sys.sys_survey_responses r ON r.survey_response_question_id = q.survey_question_id
      WHERE q.survey_question_survey_id = $1
      GROUP BY q.survey_question_id, q.survey_question_text, q.survey_question_type,
               q.survey_question_category, q.survey_question_display_order
      ORDER BY q.survey_question_display_order NULLS LAST, q.survey_question_text`,
    [surveyId],
  );
  return res.rows.map((r) => ({
    questionId: r.survey_question_id,
    text: r.survey_question_text,
    type: r.survey_question_type,
    category: r.survey_question_category,
    displayOrder: numOrNull(r.survey_question_display_order),
    responseCount: Number(r.response_count),
    avgRating: r.avg_rating == null ? null : Math.round(Number(r.avg_rating) * 100) / 100,
  }));
}

/** Pulse-check aggregation bucketed by week_number. `tenantId` undefined = no filter. */
export async function pulseAggregation(
  pool: Pool,
  tenantId: string | undefined,
): Promise<{ items: EngagementPulseWeek[]; totalChecks: number }> {
  const res = await pool.query(
    `SELECT pulse_check_week_number AS week,
            count(*) AS n,
            avg(pulse_check_mood_score)          AS avg_mood,
            avg(pulse_check_workload_score)      AS avg_workload,
            avg(pulse_check_satisfaction_score)  AS avg_satisfaction
       FROM sys.sys_pulse_checks
      WHERE ($1::uuid IS NULL OR pulse_check_tenant_id = $1)
      GROUP BY pulse_check_week_number
      ORDER BY pulse_check_week_number NULLS LAST`,
    [tenantId ?? null],
  );
  const r2 = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) * 100) / 100);
  let total = 0;
  const items = res.rows.map((r) => {
    const n = Number(r.n);
    total += n;
    return {
      weekNumber: numOrNull(r.week),
      count: n,
      avgMood: r2(r.avg_mood),
      avgWorkload: r2(r.avg_workload),
      avgSatisfaction: r2(r.avg_satisfaction),
    };
  });
  return { items, totalChecks: total };
}
