/**
 * apps/api/src/modules/performance-reviews/repository.ts — #92 passo 3/7. READ-only.
 * SQL parametrizzato su sys.sys_performance_reviews (548 valutazioni storiche
 * reali). Lo scoping organizzativo (userIdAllowList) arriva dal service via
 * resolveOrgReadScope; qui solo tenant + allowlist.
 */
import type { Pool, PoolClient } from "pg";
import type { PerformanceReview, PerformanceReviewListQuery } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const COLS = `review_id, review_tenant_id, review_subject_user_id,
  (SELECT u.user_email FROM sys.sys_users u WHERE u.user_id = review_subject_user_id) AS subject_email,
  review_reviewer_user_id, review_cycle_id,
  review_period_start, review_period_end, review_type, review_status,
  review_self_assessment_status,
  review_self_submitted_at, review_manager_submitted_at, review_calibrated_at,
  review_finalized_at, review_shared_at, review_acknowledged_at,
  review_overall_rating, review_goal_achievement_rating, review_competency_rating,
  review_self_rating, review_calibrated_rating, review_pre_calibration_rating,
  review_potential_rating, review_performance_box, review_potential_box,
  review_strengths, review_areas_for_improvement, review_manager_comments,
  review_employee_comments, review_self_comments, review_development_plan,
  review_career_aspirations, review_calibration_notes,
  created_at, updated_at`;

const isoN = (d: unknown): string | null => (d == null ? null : (d as Date).toISOString());
const dateN = (d: unknown): string | null => {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
};
const numN = (v: unknown): number | null => (v == null ? null : Number(v));

function toReview(r: Record<string, unknown>): PerformanceReview {
  return {
    reviewId: r.review_id as string,
    tenantId: r.review_tenant_id as string,
    subjectUserId: (r.review_subject_user_id as string | null) ?? null,
    subjectEmail: (r.subject_email as string | null) ?? null,
    reviewerUserId: (r.review_reviewer_user_id as string | null) ?? null,
    reviewCycleId: (r.review_cycle_id as string | null) ?? null,
    periodStart: dateN(r.review_period_start),
    periodEnd: dateN(r.review_period_end),
    type: (r.review_type as string | null) ?? null,
    status: (r.review_status as string | null) ?? null,
    selfAssessmentStatus: (r.review_self_assessment_status as string | null) ?? null,
    selfSubmittedAt: isoN(r.review_self_submitted_at),
    managerSubmittedAt: isoN(r.review_manager_submitted_at),
    calibratedAt: isoN(r.review_calibrated_at),
    finalizedAt: isoN(r.review_finalized_at),
    sharedAt: isoN(r.review_shared_at),
    acknowledgedAt: isoN(r.review_acknowledged_at),
    overallRating: numN(r.review_overall_rating),
    goalAchievementRating: numN(r.review_goal_achievement_rating),
    competencyRating: numN(r.review_competency_rating),
    selfRating: numN(r.review_self_rating),
    calibratedRating: numN(r.review_calibrated_rating),
    preCalibrationRating: numN(r.review_pre_calibration_rating),
    potentialRating: (r.review_potential_rating as string | null) ?? null,
    performanceBox: numN(r.review_performance_box),
    potentialBox: numN(r.review_potential_box),
    strengths: (r.review_strengths as string | null) ?? null,
    areasForImprovement: (r.review_areas_for_improvement as string | null) ?? null,
    managerComments: (r.review_manager_comments as string | null) ?? null,
    employeeComments: (r.review_employee_comments as string | null) ?? null,
    selfComments: (r.review_self_comments as string | null) ?? null,
    developmentPlan: (r.review_development_plan as string | null) ?? null,
    careerAspirations: (r.review_career_aspirations as string | null) ?? null,
    calibrationNotes: (r.review_calibration_notes as string | null) ?? null,
    createdAt: isoN(r.created_at)!,
    updatedAt: isoN(r.updated_at)!,
  };
}

export async function listReviews(
  q: DbConnector,
  opts: { tenantId?: string; userIdAllowList?: string[]; query: PerformanceReviewListQuery },
): Promise<{ items: PerformanceReview[]; total: number }> {
  const { tenantId, userIdAllowList, query } = opts;
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`review_tenant_id = $${params.length}`); }
  if (userIdAllowList) { params.push(userIdAllowList); where.push(`review_subject_user_id = ANY($${params.length}::uuid[])`); }
  if (query.subjectUserId) { params.push(query.subjectUserId); where.push(`review_subject_user_id = $${params.length}`); }
  if (query.reviewCycleId) { params.push(query.reviewCycleId); where.push(`review_cycle_id = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`review_type = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`review_status = $${params.length}`); }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await q.query(`SELECT count(*)::int AS n FROM sys.sys_performance_reviews${clause}`, params);
  params.push(query.limit, query.offset);
  const res = await q.query(
    `SELECT ${COLS} FROM sys.sys_performance_reviews${clause}
      ORDER BY review_period_start DESC NULLS LAST, review_id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(toReview), total: (count.rows[0] as { n: number }).n };
}

export async function findReviewById(q: DbConnector, id: string): Promise<PerformanceReview | null> {
  const res = await q.query(`SELECT ${COLS} FROM sys.sys_performance_reviews WHERE review_id = $1`, [id]);
  return res.rows[0] ? toReview(res.rows[0]) : null;
}
