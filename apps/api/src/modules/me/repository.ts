/**
 * apps/api/src/modules/me/repository.ts
 * All queries are scoped to a single user_id supplied by the caller —
 * the route layer derives it from req.user.userId and never accepts it
 * from URL params or body.
 */
import type { Pool, PoolClient } from "pg";
import type {
  MeProfile, UpdateMeProfileBody,
  MeSkillEvidenceSchema, CreateMeSelfAssessmentBody,
  CreateMeEnrollmentBody, CreateMeCareerTargetBody,
  MeInboxQuery, PatchMeInboxBody,
  MeKpiTarget, MeCertification, CreateMeCertificationBody, MeDocument,
} from "@heuresys/shared";
import type { z } from "zod";

export type DbConnector = Pool | PoolClient;
type SkillEvidence = z.infer<typeof MeSkillEvidenceSchema>;

/* --- profile --------------------------------------------------------- */

interface UserRow {
  user_id: string; user_tenant_id: string | null; user_email: string;
  user_display_name: string | null; user_locale: string | null;
  user_timezone: string | null;
}

interface ProfileRow {
  user_profile_bio: string | null;
  user_profile_picture_uri: string | null;
  user_profile_phone: string | null;
  user_profile_linkedin_uri: string | null;
  user_profile_contact_prefs: Record<string, unknown>;
  user_profile_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

export async function loadProfile(q: DbConnector, userId: string, roles: string[]): Promise<MeProfile | null> {
  const userRes = await q.query<UserRow>(
    `SELECT user_id, user_tenant_id, user_email, user_display_name,
            user_locale, user_timezone
       FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const u = userRes.rows[0];
  if (!u) return null;
  const profRes = await q.query<ProfileRow>(
    `SELECT user_profile_bio, user_profile_picture_uri, user_profile_phone,
            user_profile_linkedin_uri, user_profile_contact_prefs,
            user_profile_metadata, created_at, updated_at
       FROM sys.sys_user_profiles WHERE user_profile_user_id = $1`, [userId],
  );
  const p = profRes.rows[0];
  const now = new Date().toISOString();
  return {
    userId: u.user_id,
    tenantId: u.user_tenant_id,
    email: u.user_email,
    displayName: u.user_display_name,
    locale: u.user_locale,
    timezone: u.user_timezone,
    roles,
    bio: p?.user_profile_bio ?? null,
    pictureUri: p?.user_profile_picture_uri ?? null,
    phone: p?.user_profile_phone ?? null,
    linkedinUri: p?.user_profile_linkedin_uri ?? null,
    contactPrefs: p?.user_profile_contact_prefs ?? {},
    metadata: p?.user_profile_metadata ?? {},
    createdAt: p?.created_at?.toISOString() ?? now,
    updatedAt: p?.updated_at?.toISOString() ?? now,
  };
}

export async function upsertProfile(
  q: DbConnector, userId: string, tenantId: string | null, patch: UpdateMeProfileBody,
): Promise<void> {
  if (patch.displayName !== undefined || patch.locale !== undefined || patch.timezone !== undefined) {
    const sets: string[] = []; const params: unknown[] = [];
    const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
    if (patch.displayName !== undefined) add("user_display_name", patch.displayName);
    if (patch.locale !== undefined) add("user_locale", patch.locale);
    if (patch.timezone !== undefined) add("user_timezone", patch.timezone);
    sets.push("updated_at = now()");
    params.push(userId);
    await q.query(`UPDATE sys.sys_users SET ${sets.join(", ")} WHERE user_id = $${params.length}`, params);
  }
  if (!tenantId) return;
  await q.query(
    `INSERT INTO sys.sys_user_profiles (
        user_profile_user_id, user_profile_tenant_id, user_profile_bio,
        user_profile_picture_uri, user_profile_phone, user_profile_linkedin_uri,
        user_profile_contact_prefs, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $1, $1)
      ON CONFLICT (user_profile_user_id) DO UPDATE SET
        user_profile_bio = COALESCE(EXCLUDED.user_profile_bio, sys.sys_user_profiles.user_profile_bio),
        user_profile_picture_uri = COALESCE(EXCLUDED.user_profile_picture_uri, sys.sys_user_profiles.user_profile_picture_uri),
        user_profile_phone = COALESCE(EXCLUDED.user_profile_phone, sys.sys_user_profiles.user_profile_phone),
        user_profile_linkedin_uri = COALESCE(EXCLUDED.user_profile_linkedin_uri, sys.sys_user_profiles.user_profile_linkedin_uri),
        user_profile_contact_prefs = CASE WHEN $8::boolean THEN EXCLUDED.user_profile_contact_prefs ELSE sys.sys_user_profiles.user_profile_contact_prefs END,
        updated_at = now(),
        updated_by = $1`,
    [
      userId, tenantId,
      patch.bio ?? null, patch.pictureUri ?? null,
      patch.phone ?? null, patch.linkedinUri ?? null,
      JSON.stringify(patch.contactPrefs ?? {}),
      patch.contactPrefs !== undefined,
    ],
  );
}

/* --- positions ------------------------------------------------------- */

export async function listMyPositions(q: DbConnector, userId: string): Promise<{ items: Array<{
  userPositionAssignmentId: string; positionId: string; positionCode: string; positionTitle: string;
  isPrimary: boolean; status: string; startDate: string | null; endDate: string | null;
}>; total: number; }> {
  const res = await q.query<{
    user_position_assignment_id: string; position_id: string;
    position_code: string; position_title: string;
    user_position_assignment_is_primary: boolean;
    user_position_assignment_status: string;
    user_position_assignment_effective_from: Date | null;
    user_position_assignment_effective_to: Date | null;
  }>(
    `SELECT a.user_position_assignment_id, a.position_id,
            p.position_code, p.position_title,
            a.user_position_assignment_is_primary,
            a.user_position_assignment_status,
            a.user_position_assignment_effective_from,
            a.user_position_assignment_effective_to
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.position_id
      WHERE a.user_position_assignment_user_id = $1
      ORDER BY a.user_position_assignment_is_primary DESC, a.user_position_assignment_effective_from DESC NULLS LAST`,
    [userId],
  );
  const items = res.rows.map((r) => ({
    userPositionAssignmentId: r.user_position_assignment_id,
    positionId: r.position_id,
    positionCode: r.position_code,
    positionTitle: r.position_title,
    isPrimary: r.user_position_assignment_is_primary,
    status: r.user_position_assignment_status,
    startDate: r.user_position_assignment_effective_from
      ? r.user_position_assignment_effective_from.toISOString().slice(0, 10) : null,
    endDate: r.user_position_assignment_effective_to
      ? r.user_position_assignment_effective_to.toISOString().slice(0, 10) : null,
  }));
  return { items, total: items.length };
}

/* --- skills + self-assessment --------------------------------------- */

export async function listMySkills(q: DbConnector, userId: string): Promise<{ items: SkillEvidence[]; total: number }> {
  const res = await q.query<{
    user_skill_evidence_id: string;
    user_skill_evidence_skill_id: string;
    skill_code: string; skill_name: string;
    user_skill_evidence_declared_proficiency: string;
    user_skill_evidence_source: string;
    user_skill_evidence_assessed_at: Date;
    user_skill_evidence_score: string | null;
    user_skill_evidence_comment: string | null;
  }>(
    `SELECT e.user_skill_evidence_id, e.user_skill_evidence_skill_id,
            s.skill_code, s.skill_name,
            e.user_skill_evidence_declared_proficiency,
            e.user_skill_evidence_source,
            e.user_skill_evidence_assessed_at,
            e.user_skill_evidence_score,
            e.user_skill_evidence_comment
       FROM sys.sys_user_skill_evidence e
       JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id
      WHERE e.user_skill_evidence_user_id = $1
      ORDER BY e.user_skill_evidence_assessed_at DESC`,
    [userId],
  );
  const items: SkillEvidence[] = res.rows.map((r) => ({
    userSkillEvidenceId: r.user_skill_evidence_id,
    skillId: r.user_skill_evidence_skill_id,
    skillCode: r.skill_code,
    skillName: r.skill_name,
    declaredProficiency: r.user_skill_evidence_declared_proficiency,
    source: r.user_skill_evidence_source,
    assessedAt: r.user_skill_evidence_assessed_at.toISOString(),
    score: r.user_skill_evidence_score === null ? null : Number(r.user_skill_evidence_score),
    comment: r.user_skill_evidence_comment,
  }));
  return { items, total: items.length };
}

export async function insertSelfAssessment(
  q: DbConnector, userId: string, tenantId: string, body: CreateMeSelfAssessmentBody,
): Promise<SkillEvidence> {
  const res = await q.query<{
    user_skill_evidence_id: string; user_skill_evidence_skill_id: string;
    skill_code: string; skill_name: string;
    user_skill_evidence_declared_proficiency: string;
    user_skill_evidence_assessed_at: Date;
    user_skill_evidence_score: string | null;
    user_skill_evidence_comment: string | null;
  }>(
    `WITH ins AS (
       INSERT INTO sys.sys_user_skill_evidence (
         user_skill_evidence_user_id, user_skill_evidence_tenant_id,
         user_skill_evidence_skill_id, user_skill_evidence_declared_proficiency,
         user_skill_evidence_source, user_skill_evidence_score,
         user_skill_evidence_comment, created_by
       ) VALUES ($1, $2, $3, $4, 'SELF_ASSESSMENT', $5, $6, $1)
       RETURNING user_skill_evidence_id, user_skill_evidence_skill_id,
                 user_skill_evidence_declared_proficiency,
                 user_skill_evidence_assessed_at, user_skill_evidence_score,
                 user_skill_evidence_comment
     )
     SELECT ins.*, s.skill_code, s.skill_name
       FROM ins JOIN sys.sys_skills s ON s.skill_id = ins.user_skill_evidence_skill_id`,
    [userId, tenantId, body.skillId, body.declaredProficiency, body.score ?? null, body.comment ?? null],
  );
  const r = res.rows[0]!;
  return {
    userSkillEvidenceId: r.user_skill_evidence_id,
    skillId: r.user_skill_evidence_skill_id,
    skillCode: r.skill_code,
    skillName: r.skill_name,
    declaredProficiency: r.user_skill_evidence_declared_proficiency,
    source: "SELF_ASSESSMENT",
    assessedAt: r.user_skill_evidence_assessed_at.toISOString(),
    score: r.user_skill_evidence_score === null ? null : Number(r.user_skill_evidence_score),
    comment: r.user_skill_evidence_comment,
  };
}

export async function skillVisibleToTenant(q: DbConnector, skillId: string, tenantId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_skills
      WHERE skill_id = $1 AND (skill_is_global = true OR skill_tenant_id = $2) LIMIT 1`,
    [skillId, tenantId],
  );
  return res.rows.length > 0;
}

/* --- learning ------------------------------------------------------- */

interface LearningRow {
  user_learning_assignment_id: string;
  user_learning_assignment_module_id: string | null;
  user_learning_assignment_initiative_id: string | null;
  user_learning_assignment_path_id: string | null;
  user_learning_assignment_is_mandatory: boolean;
  user_learning_assignment_status: string;
  user_learning_assignment_deadline: Date | null;
}

function toAssignment(r: LearningRow) {
  return {
    userLearningAssignmentId: r.user_learning_assignment_id,
    moduleId: r.user_learning_assignment_module_id,
    initiativeId: r.user_learning_assignment_initiative_id,
    pathId: r.user_learning_assignment_path_id,
    isMandatory: r.user_learning_assignment_is_mandatory,
    status: r.user_learning_assignment_status,
    deadline: r.user_learning_assignment_deadline
      ? r.user_learning_assignment_deadline.toISOString().slice(0, 10) : null,
  };
}

export async function listMyLearning(q: DbConnector, userId: string) {
  const res = await q.query<LearningRow>(
    `SELECT user_learning_assignment_id, user_learning_assignment_module_id,
            user_learning_assignment_initiative_id, user_learning_assignment_path_id,
            user_learning_assignment_is_mandatory, user_learning_assignment_status,
            user_learning_assignment_deadline
       FROM sys.sys_user_learning_assignments
      WHERE user_learning_assignment_user_id = $1
      ORDER BY user_learning_assignment_deadline NULLS LAST, created_at DESC`,
    [userId],
  );
  const items = res.rows.map(toAssignment);
  return { items, total: items.length };
}

export async function insertEnrollment(
  q: DbConnector, userId: string, tenantId: string, body: CreateMeEnrollmentBody,
) {
  const res = await q.query<LearningRow>(
    `INSERT INTO sys.sys_user_learning_assignments (
        user_learning_assignment_tenant_id, user_learning_assignment_user_id,
        user_learning_assignment_module_id, user_learning_assignment_path_id,
        user_learning_assignment_initiative_id, user_learning_assignment_is_mandatory,
        user_learning_assignment_status, user_learning_assignment_assigned_by
      ) VALUES ($1, $2, $3, $4, $5, false, 'ASSIGNED', $2)
      RETURNING user_learning_assignment_id, user_learning_assignment_module_id,
                user_learning_assignment_initiative_id, user_learning_assignment_path_id,
                user_learning_assignment_is_mandatory, user_learning_assignment_status,
                user_learning_assignment_deadline`,
    [tenantId, userId, body.moduleId ?? null, body.pathId ?? null, body.initiativeId ?? null],
  );
  return toAssignment(res.rows[0]!);
}

/* --- gaps + assessments --------------------------------------------- */

export async function listMyGaps(q: DbConnector, userId: string) {
  const res = await q.query<{
    learning_gap_id: string; learning_gap_skill_id: string | null;
    learning_gap_position_id: string | null;
    learning_gap_severity: string; learning_gap_score: string | null;
    learning_gap_detected_at: Date;
  }>(
    `SELECT learning_gap_id, learning_gap_skill_id, learning_gap_position_id,
            learning_gap_severity, learning_gap_score, learning_gap_detected_at
       FROM sys.sys_learning_gaps WHERE learning_gap_user_id = $1
       ORDER BY learning_gap_detected_at DESC`,
    [userId],
  );
  const items = res.rows.map((r) => ({
    learningGapId: r.learning_gap_id,
    skillId: r.learning_gap_skill_id,
    positionId: r.learning_gap_position_id,
    severity: r.learning_gap_severity,
    score: r.learning_gap_score === null ? null : Number(r.learning_gap_score),
    detectedAt: r.learning_gap_detected_at.toISOString(),
  }));
  return { items, total: items.length };
}

export async function listMyAssessments(q: DbConnector, userId: string) {
  const res = await q.query<{
    assessment_id: string; assessment_kind: string;
    assessment_status: string; assessment_period_start: Date | null;
    assessment_period_end: Date | null; created_at: Date;
  }>(
    `SELECT assessment_id, assessment_kind, assessment_status,
            assessment_period_start, assessment_period_end, created_at
       FROM sys.sys_assessments WHERE assessment_subject_user_id = $1
       ORDER BY created_at DESC`,
    [userId],
  );
  const items = res.rows.map((r) => ({
    assessmentId: r.assessment_id,
    kind: r.assessment_kind, status: r.assessment_status,
    periodStart: r.assessment_period_start
      ? `${r.assessment_period_start.getFullYear()}-${String(r.assessment_period_start.getMonth() + 1).padStart(2, "0")}-${String(r.assessment_period_start.getDate()).padStart(2, "0")}` : null,
    periodEnd: r.assessment_period_end
      ? `${r.assessment_period_end.getFullYear()}-${String(r.assessment_period_end.getMonth() + 1).padStart(2, "0")}-${String(r.assessment_period_end.getDate()).padStart(2, "0")}` : null,
    createdAt: r.created_at.toISOString(),
  }));
  return { items, total: items.length };
}

/* --- career targets ------------------------------------------------- */

export async function listMyCareerTargets(q: DbConnector, userId: string) {
  const res = await q.query<{
    user_target_position_id: string; user_target_position_position_id: string;
    user_target_position_horizon: string | null; user_target_position_review_status: string;
    user_target_position_review_notes: string | null; created_at: Date;
  }>(
    `SELECT user_target_position_id, user_target_position_position_id,
            user_target_position_horizon, user_target_position_review_status,
            user_target_position_review_notes, created_at
       FROM sys.sys_user_target_positions
      WHERE user_target_position_user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  const items = res.rows.map((r) => ({
    userTargetPositionId: r.user_target_position_id,
    positionId: r.user_target_position_position_id,
    horizon: r.user_target_position_horizon,
    reviewStatus: r.user_target_position_review_status,
    reviewNotes: r.user_target_position_review_notes,
    createdAt: r.created_at.toISOString(),
  }));
  return { items, total: items.length };
}

export async function positionInTenant(q: DbConnector, positionId: string, tenantId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_positions WHERE position_id = $1 AND position_tenant_id = $2 LIMIT 1`,
    [positionId, tenantId],
  );
  return res.rows.length > 0;
}

export async function insertCareerTarget(
  q: DbConnector, userId: string, tenantId: string, body: CreateMeCareerTargetBody,
) {
  const res = await q.query<{
    user_target_position_id: string; user_target_position_position_id: string;
    user_target_position_horizon: string | null; user_target_position_review_status: string;
    user_target_position_review_notes: string | null; created_at: Date;
  }>(
    `INSERT INTO sys.sys_user_target_positions (
        user_target_position_tenant_id, user_target_position_user_id,
        user_target_position_position_id, user_target_position_horizon,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $2, $2)
      RETURNING user_target_position_id, user_target_position_position_id,
                user_target_position_horizon, user_target_position_review_status,
                user_target_position_review_notes, created_at`,
    [tenantId, userId, body.positionId, body.horizon ?? null],
  );
  const r = res.rows[0]!;
  return {
    userTargetPositionId: r.user_target_position_id,
    positionId: r.user_target_position_position_id,
    horizon: r.user_target_position_horizon,
    reviewStatus: r.user_target_position_review_status,
    reviewNotes: r.user_target_position_review_notes,
    createdAt: r.created_at.toISOString(),
  };
}

/* --- inbox --------------------------------------------------------- */

interface NotificationRow {
  notification_id: string; notification_type: string; notification_subject: string;
  notification_body: string | null; notification_action_url: string | null;
  notification_resource_type: string | null; notification_resource_id: string | null;
  notification_priority: string; notification_status: string;
  notification_read_at: Date | null; notification_dismissed_at: Date | null;
  created_at: Date;
}

function toNotif(r: NotificationRow) {
  return {
    notificationId: r.notification_id,
    type: r.notification_type, subject: r.notification_subject,
    body: r.notification_body, actionUrl: r.notification_action_url,
    resourceType: r.notification_resource_type, resourceId: r.notification_resource_id,
    priority: r.notification_priority, status: r.notification_status,
    readAt: r.notification_read_at ? r.notification_read_at.toISOString() : null,
    dismissedAt: r.notification_dismissed_at ? r.notification_dismissed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listInbox(q: DbConnector, userId: string, query: MeInboxQuery) {
  const where: string[] = ["notification_user_id = $1"]; const params: unknown[] = [userId];
  if (query.status) { params.push(query.status); where.push(`notification_status = $${params.length}`); }
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_inbox_notifications WHERE ${where.join(" AND ")}`,
    params.slice(0, params.length - 2),
  );
  const res = await q.query<NotificationRow>(
    `SELECT notification_id, notification_type, notification_subject, notification_body,
            notification_action_url, notification_resource_type, notification_resource_id,
            notification_priority, notification_status, notification_read_at,
            notification_dismissed_at, created_at
       FROM sys.sys_inbox_notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toNotif), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findInboxNotification(q: DbConnector, userId: string, notificationId: string) {
  const res = await q.query<NotificationRow>(
    `SELECT notification_id, notification_type, notification_subject, notification_body,
            notification_action_url, notification_resource_type, notification_resource_id,
            notification_priority, notification_status, notification_read_at,
            notification_dismissed_at, created_at
       FROM sys.sys_inbox_notifications
      WHERE notification_id = $1 AND notification_user_id = $2`,
    [notificationId, userId],
  );
  return res.rows[0] ? toNotif(res.rows[0]) : null;
}

export async function patchInboxNotification(
  q: DbConnector, userId: string, notificationId: string, body: PatchMeInboxBody,
) {
  const tsCol = body.status === "READ" ? "notification_read_at" : "notification_dismissed_at";
  const res = await q.query<NotificationRow>(
    `UPDATE sys.sys_inbox_notifications SET
        notification_status = $1,
        ${tsCol} = COALESCE(${tsCol}, now())
      WHERE notification_id = $2 AND notification_user_id = $3
      RETURNING notification_id, notification_type, notification_subject, notification_body,
                notification_action_url, notification_resource_type, notification_resource_id,
                notification_priority, notification_status, notification_read_at,
                notification_dismissed_at, created_at`,
    [body.status, notificationId, userId],
  );
  return res.rows[0] ? toNotif(res.rows[0]) : null;
}

/* --- kpis (ESS-8) ---------------------------------------------------- */

export async function listMyKpis(
  q: DbConnector,
  userId: string,
): Promise<{ items: MeKpiTarget[]; total: number }> {
  const r = await q.query<{
    position_kpi_requirement_id: string;
    position_id: string;
    kpi_definition_id: string;
    kpi_code: string;
    kpi_name: string;
    kpi_unit: string | null;
    kpi_polarity: string;
    target_template: Record<string, unknown>;
    weight: string;
    latest_measured_value: string | null;
    latest_target_value: string | null;
    latest_recorded_at: Date | null;
  }>(
    `SELECT
       pkr.position_kpi_requirement_id,
       pkr.position_id,
       pkr.kpi_definition_id,
       k.kpi_definition_code      AS kpi_code,
       k.kpi_definition_name      AS kpi_name,
       k.kpi_definition_unit      AS kpi_unit,
       k.kpi_definition_polarity  AS kpi_polarity,
       pkr.target_template,
       pkr.weight::text,
       ev.user_kpi_evidence_measured_value::text AS latest_measured_value,
       ev.user_kpi_evidence_target_value::text   AS latest_target_value,
       ev.user_kpi_evidence_recorded_at          AS latest_recorded_at
     FROM sys.sys_user_position_assignments a
     JOIN sys.sys_position_kpi_requirements pkr
       ON pkr.position_id = a.user_position_assignment_position_id
     JOIN sys.sys_kpi_definitions k
       ON k.kpi_definition_id = pkr.kpi_definition_id
     LEFT JOIN LATERAL (
       SELECT * FROM sys.sys_user_kpi_evidence e
        WHERE e.user_kpi_evidence_user_id = $1
          AND e.user_kpi_evidence_kpi_id  = pkr.kpi_definition_id
        ORDER BY e.user_kpi_evidence_recorded_at DESC
        LIMIT 1
     ) ev ON true
     WHERE a.user_position_assignment_user_id = $1
       AND a.user_position_assignment_status  = 'ACTIVE'
       AND a.user_position_assignment_kind    = 'PRIMARY'
     ORDER BY k.kpi_definition_name`,
    [userId],
  );
  const items: MeKpiTarget[] = r.rows.map((row) => ({
    positionKpiRequirementId: row.position_kpi_requirement_id,
    positionId: row.position_id,
    kpiDefinitionId: row.kpi_definition_id,
    kpiCode: row.kpi_code,
    kpiName: row.kpi_name,
    unit: row.kpi_unit,
    polarity: row.kpi_polarity,
    targetTemplate: row.target_template,
    weight: row.weight,
    latestMeasuredValue: row.latest_measured_value,
    latestTargetValue: row.latest_target_value,
    latestRecordedAt: row.latest_recorded_at ? row.latest_recorded_at.toISOString() : null,
  }));
  return { items, total: items.length };
}

/* --- certifications (ESS-11) ----------------------------------------- */

interface CertRow {
  user_certification_id: string;
  user_certification_name: string;
  user_certification_issuer: string;
  user_certification_issued_date: Date | null;
  user_certification_expires_date: Date | null;
  user_certification_credential_id: string | null;
  user_certification_document_uri: string | null;
  user_certification_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function toCert(r: CertRow): MeCertification {
  return {
    userCertificationId: r.user_certification_id,
    name: r.user_certification_name,
    issuer: r.user_certification_issuer,
    issuedDate: r.user_certification_issued_date ? r.user_certification_issued_date.toISOString().slice(0, 10) : null,
    expiresDate: r.user_certification_expires_date ? r.user_certification_expires_date.toISOString().slice(0, 10) : null,
    credentialId: r.user_certification_credential_id,
    documentUri: r.user_certification_document_uri,
    metadata: r.user_certification_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const CERT_COLS = `user_certification_id, user_certification_name, user_certification_issuer,
  user_certification_issued_date, user_certification_expires_date, user_certification_credential_id,
  user_certification_document_uri, user_certification_metadata, created_at, updated_at`;

export async function listMyCertifications(
  q: DbConnector,
  userId: string,
): Promise<{ items: MeCertification[]; total: number }> {
  const r = await q.query<CertRow>(
    `SELECT ${CERT_COLS} FROM sys.sys_user_certifications
      WHERE user_certification_user_id = $1
      ORDER BY user_certification_issued_date DESC NULLS LAST, user_certification_name`,
    [userId],
  );
  const items = r.rows.map(toCert);
  return { items, total: items.length };
}

export async function insertMyCertification(
  q: DbConnector,
  userId: string,
  tenantId: string,
  body: CreateMeCertificationBody,
): Promise<MeCertification> {
  const r = await q.query<CertRow>(
    `INSERT INTO sys.sys_user_certifications (
       user_certification_user_id, user_certification_tenant_id,
       user_certification_name, user_certification_issuer,
       user_certification_issued_date, user_certification_expires_date,
       user_certification_credential_id, user_certification_document_uri,
       user_certification_metadata, created_by, updated_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $1, $1)
     RETURNING ${CERT_COLS}`,
    [
      userId,
      tenantId,
      body.name,
      body.issuer,
      body.issuedDate ?? null,
      body.expiresDate ?? null,
      body.credentialId ?? null,
      body.documentUri ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toCert(r.rows[0]!);
}

/* --- documents (ESS-12) ---------------------------------------------- */

interface DocRow {
  user_document_id: string;
  user_document_kind: string;
  user_document_title: string;
  user_document_uri: string;
  user_document_mime_type: string | null;
  user_document_size_bytes: string | null;
  user_document_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function toDoc(r: DocRow): MeDocument {
  return {
    userDocumentId: r.user_document_id,
    kind: r.user_document_kind as MeDocument["kind"],
    title: r.user_document_title,
    uri: r.user_document_uri,
    mimeType: r.user_document_mime_type,
    sizeBytes: r.user_document_size_bytes !== null ? Number(r.user_document_size_bytes) : null,
    metadata: r.user_document_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listMyDocuments(
  q: DbConnector,
  userId: string,
): Promise<{ items: MeDocument[]; total: number }> {
  const r = await q.query<DocRow>(
    `SELECT user_document_id, user_document_kind, user_document_title, user_document_uri,
            user_document_mime_type, user_document_size_bytes::text AS user_document_size_bytes,
            user_document_metadata, created_at, updated_at
       FROM sys.sys_user_documents
      WHERE user_document_user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  const items = r.rows.map(toDoc);
  return { items, total: items.length };
}
