/**
 * apps/api/src/modules/me/repository.ts
 * All queries are scoped to a single user_id supplied by the caller —
 * the route layer derives it from req.user.userId and never accepts it
 * from URL params or body.
 */
import type { Pool, PoolClient } from "pg";
import type {
  MeProfile, MeProfileFull, MeContract, UpdateMeProfileBody,
  MeSkillEvidenceSchema, CreateMeSelfAssessmentBody,
  CreateMeEnrollmentBody, CreateMeCareerTargetBody,
  MeInboxQuery, PatchMeInboxBody,
  MeKpiTarget, MeCertification, CreateMeCertificationBody, MeDocument,
  UserPreference, UpdateUserPreferenceBody,
} from "@heuresys/shared";
import { ME_PREFERENCE_DEFAULTS } from "@heuresys/shared";
import type { z } from "zod";

export type DbConnector = Pool | PoolClient;
type SkillEvidence = z.infer<typeof MeSkillEvidenceSchema>;

/* --- UI interfaces registry (U1) -------------------------------------- */

export interface UiInterfaceRow {
  code: string;
  label: string;
  route: string;
  icon: string | null;
  sidebarGroup: string;
  perspective: string;
  requiredResource: string | null;
  requiredAction: string | null;
  requiresAdmin: boolean;
  order: number;
}

/** All active sidebar interfaces (the DB-driven registry). Visibility/gating is applied in the
 *  service layer (per-permission + hasAdminRole), mirroring the web layout's hybrid gate. */
export async function loadActiveInterfaces(q: DbConnector): Promise<UiInterfaceRow[]> {
  const res = await q.query<UiInterfaceRow>(
    `SELECT ui_interface_code              AS code,
            ui_interface_label             AS label,
            ui_interface_route             AS route,
            ui_interface_icon              AS icon,
            ui_interface_sidebar_group     AS "sidebarGroup",
            ui_interface_perspective       AS perspective,
            ui_interface_required_resource AS "requiredResource",
            ui_interface_required_action   AS "requiredAction",
            ui_interface_requires_admin    AS "requiresAdmin",
            ui_interface_order             AS "order"
       FROM sys.sys_ui_interfaces
      WHERE ui_interface_is_active = true
      ORDER BY ui_interface_order, ui_interface_code`,
  );
  return res.rows;
}

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

/* --- extended profile (full aggregate — anagraphic satellites, mig 000164) -- */

export async function loadProfileFull(q: DbConnector, userId: string, roles: string[]): Promise<MeProfileFull | null> {
  const userRes = await q.query<{
    user_id: string; user_email: string; user_display_name: string | null;
    user_first_name: string | null; user_last_name: string | null;
  }>(
    `SELECT user_id, user_email, user_display_name, user_first_name, user_last_name
       FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const u = userRes.rows[0];
  if (!u) return null;

  const [demoRes, docsRes, addrRes, famRes, eduRes, bankRes, empRes, orgRes] = await Promise.all([
    q.query<{
      middle_name: string | null; birth_date: string | null; birth_place: string | null;
      gender: string | null; nationality: string | null; marital_status: string | null; tax_id: string | null;
      phone_mobile: string | null; phone_home: string | null; personal_email: string | null;
      emergency_name: string | null; emergency_phone: string | null; emergency_relationship: string | null;
    }>(
      `SELECT user_demographics_middle_name AS middle_name,
              to_char(user_demographics_birth_date,'YYYY-MM-DD') AS birth_date,
              user_demographics_birth_place AS birth_place,
              user_demographics_gender AS gender,
              user_demographics_nationality AS nationality,
              user_demographics_marital_status AS marital_status,
              user_demographics_tax_id AS tax_id,
              user_demographics_phone_mobile AS phone_mobile,
              user_demographics_phone_home AS phone_home,
              user_demographics_personal_email AS personal_email,
              user_demographics_emergency_name AS emergency_name,
              user_demographics_emergency_phone AS emergency_phone,
              user_demographics_emergency_relationship AS emergency_relationship
         FROM sys.sys_user_demographics WHERE user_demographics_user_id = $1`, [userId]),
    q.query<{ kind: string; number: string; expiry_date: string | null }>(
      `SELECT user_identity_document_kind AS kind, user_identity_document_number AS number,
              to_char(user_identity_document_expiry_date,'YYYY-MM-DD') AS expiry_date
         FROM sys.sys_user_identity_documents WHERE user_identity_document_user_id = $1
        ORDER BY user_identity_document_kind`, [userId]),
    q.query<{ kind: string; street: string | null; city: string | null; postal_code: string | null; country: string | null; region: string | null }>(
      `SELECT user_address_kind AS kind, user_address_street AS street, user_address_city AS city,
              user_address_postal_code AS postal_code, user_address_country AS country, user_address_region AS region
         FROM sys.sys_user_addresses WHERE user_address_user_id = $1
        ORDER BY user_address_is_primary DESC, user_address_kind`, [userId]),
    q.query<{ first_name: string | null; last_name: string | null; relationship: string | null; birth_date: string | null; gender: string | null; is_dependent: boolean }>(
      `SELECT user_family_member_first_name AS first_name, user_family_member_last_name AS last_name,
              user_family_member_relationship AS relationship,
              to_char(user_family_member_birth_date,'YYYY-MM-DD') AS birth_date,
              user_family_member_gender AS gender, user_family_member_is_dependent AS is_dependent
         FROM sys.sys_user_family_members WHERE user_family_member_user_id = $1
        ORDER BY user_family_member_birth_date NULLS LAST`, [userId]),
    q.query<{ degree: string; institution: string; field_of_study: string | null; start_date: string | null; end_date: string | null; grade: string | null }>(
      `SELECT user_education_degree AS degree, user_education_institution AS institution,
              user_education_field_of_study AS field_of_study,
              to_char(user_education_start_date,'YYYY-MM-DD') AS start_date,
              to_char(user_education_end_date,'YYYY-MM-DD') AS end_date,
              user_education_grade AS grade
         FROM sys.sys_user_education_records WHERE user_education_record_user_id = $1
        ORDER BY user_education_end_date DESC NULLS LAST`, [userId]),
    q.query<{ iban: string | null; swift_bic: string | null; bank_name: string | null; account_number: string | null }>(
      `SELECT user_bank_iban AS iban, user_bank_swift_bic AS swift_bic,
              user_bank_bank_name AS bank_name, user_bank_account_number AS account_number
         FROM sys.sys_user_bank_details WHERE user_bank_user_id = $1`, [userId]),
    q.query<{
      salary: string | null; currency: string | null; pay_scale_area: string | null; pay_scale_type: string | null;
      pay_scale_group: string | null; pay_scale_level: string | null; pay_periods_per_year: number | null; work_schedule_pct: string | null;
      pernr: string | null; company_code: string | null; personnel_area: string | null; personnel_subarea: string | null;
      hire_date: string | null; seniority_date: string | null; probation_end_date: string | null; contract_end_date: string | null;
      termination_date: string | null; termination_reason: string | null; status: string | null;
    }>(
      `SELECT user_employment_salary AS salary, user_employment_currency AS currency,
              user_employment_pay_scale_area AS pay_scale_area, user_employment_pay_scale_type AS pay_scale_type,
              user_employment_pay_scale_group AS pay_scale_group, user_employment_pay_scale_level AS pay_scale_level,
              user_employment_pay_periods_per_year AS pay_periods_per_year, user_employment_work_schedule_pct AS work_schedule_pct,
              user_employment_pernr AS pernr, user_employment_company_code AS company_code,
              user_employment_personnel_area AS personnel_area, user_employment_personnel_subarea AS personnel_subarea,
              to_char(user_employment_hire_date,'YYYY-MM-DD') AS hire_date,
              to_char(user_employment_seniority_date,'YYYY-MM-DD') AS seniority_date,
              to_char(user_employment_probation_end_date,'YYYY-MM-DD') AS probation_end_date,
              to_char(user_employment_contract_end_date,'YYYY-MM-DD') AS contract_end_date,
              to_char(user_employment_termination_date,'YYYY-MM-DD') AS termination_date,
              user_employment_termination_reason AS termination_reason, user_employment_status AS status
         FROM sys.sys_user_employment WHERE user_employment_user_id = $1`, [userId]),
    q.query<{ position_code: string | null; position_title: string | null; org_unit_name: string | null; manager_name: string | null }>(
      `SELECT p.position_code, p.position_title,
              ou.organization_unit_name AS org_unit_name,
              mu.user_display_name AS manager_name
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
         LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
         LEFT JOIN sys.sys_positions mp ON mp.position_id = p.position_reports_to_position_id
         LEFT JOIN sys.sys_users mu ON mu.user_id = mp.position_owner_user_id
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_kind = 'PRIMARY'
        ORDER BY a.user_position_assignment_start_date DESC NULLS LAST
        LIMIT 1`, [userId]),
  ]);

  const d = demoRes.rows[0];
  const bank = bankRes.rows[0];
  const emp = empRes.rows[0];
  const org = orgRes.rows[0];
  const num = (v: string | null | undefined): number | null => (v == null ? null : Number(v));

  return {
    userId: u.user_id,
    displayName: u.user_display_name,
    email: u.user_email,
    identity: {
      firstName: u.user_first_name, lastName: u.user_last_name,
      middleName: d?.middle_name ?? null, birthDate: d?.birth_date ?? null, birthPlace: d?.birth_place ?? null,
      gender: d?.gender ?? null, nationality: d?.nationality ?? null,
      maritalStatus: d?.marital_status ?? null, taxId: d?.tax_id ?? null,
    },
    documents: docsRes.rows.map((r) => ({ kind: r.kind, number: r.number, expiryDate: r.expiry_date })),
    addresses: addrRes.rows.map((r) => ({
      kind: r.kind, street: r.street, city: r.city, postalCode: r.postal_code, country: r.country, region: r.region,
    })),
    contacts: {
      phoneMobile: d?.phone_mobile ?? null, phoneHome: d?.phone_home ?? null, personalEmail: d?.personal_email ?? null,
    },
    emergency: {
      name: d?.emergency_name ?? null, phone: d?.emergency_phone ?? null, relationship: d?.emergency_relationship ?? null,
    },
    family: famRes.rows.map((r) => ({
      firstName: r.first_name, lastName: r.last_name, relationship: r.relationship,
      birthDate: r.birth_date, gender: r.gender, isDependent: r.is_dependent,
    })),
    education: eduRes.rows.map((r) => ({
      degree: r.degree, institution: r.institution, fieldOfStudy: r.field_of_study,
      startDate: r.start_date, endDate: r.end_date, grade: r.grade,
    })),
    banking: bank
      ? { iban: bank.iban, swiftBic: bank.swift_bic, bankName: bank.bank_name, accountNumber: bank.account_number }
      : null,
    organization: {
      jobTitle: org?.position_title ?? null,
      department: org?.org_unit_name ?? null,
      orgUnit: org?.org_unit_name ?? null,
      location: null,
      costCenter: null,
      managerName: org?.manager_name ?? null,
      positionCode: org?.position_code ?? null,
      positionTitle: org?.position_title ?? null,
    },
    employment: emp
      ? {
          salary: num(emp.salary), currency: emp.currency,
          payScaleArea: emp.pay_scale_area, payScaleType: emp.pay_scale_type,
          payScaleGroup: emp.pay_scale_group, payScaleLevel: emp.pay_scale_level,
          payPeriodsPerYear: emp.pay_periods_per_year, workSchedulePct: num(emp.work_schedule_pct),
          pernr: emp.pernr, companyCode: emp.company_code,
          personnelArea: emp.personnel_area, personnelSubarea: emp.personnel_subarea,
          hireDate: emp.hire_date, seniorityDate: emp.seniority_date,
          probationEndDate: emp.probation_end_date, contractEndDate: emp.contract_end_date,
          terminationDate: emp.termination_date, terminationReason: emp.termination_reason, status: emp.status,
        }
      : null,
    auth: { username: u.user_email, roles, lastLogin: null },
  };
}

/* --- contracts (S1010 F2, mig 000165) -------------------------------- */

export async function loadContracts(q: DbConnector, userId: string): Promise<MeContract[]> {
  const res = await q.query<{
    type: string | null; code: string | null; start_date: string | null; end_date: string | null;
    probation_end_date: string | null; ccnl_type: string | null; ccnl_level: string | null;
    gross_annual_salary: string | null; currency: string | null; salary_type: string | null;
    payment_frequency: string | null; work_hours_weekly: string | null; work_schedule_type: string | null;
    part_time_percentage: string | null; job_title: string | null; status: string | null;
    termination_date: string | null; termination_reason: string | null; notes: string | null;
  }>(
    `SELECT user_contract_type AS type, user_contract_code AS code,
            to_char(user_contract_start_date,'YYYY-MM-DD') AS start_date,
            to_char(user_contract_end_date,'YYYY-MM-DD') AS end_date,
            to_char(user_contract_probation_end_date,'YYYY-MM-DD') AS probation_end_date,
            user_contract_ccnl_type AS ccnl_type, user_contract_ccnl_level AS ccnl_level,
            user_contract_gross_annual_salary AS gross_annual_salary, user_contract_currency AS currency,
            user_contract_salary_type AS salary_type, user_contract_payment_frequency AS payment_frequency,
            user_contract_work_hours_weekly AS work_hours_weekly, user_contract_work_schedule_type AS work_schedule_type,
            user_contract_part_time_percentage AS part_time_percentage, user_contract_job_title AS job_title,
            user_contract_status AS status,
            to_char(user_contract_termination_date,'YYYY-MM-DD') AS termination_date,
            user_contract_termination_reason AS termination_reason, user_contract_notes AS notes
       FROM sys.sys_user_contracts WHERE user_contract_user_id = $1
      ORDER BY user_contract_start_date DESC NULLS LAST`, [userId],
  );
  const num = (v: string | null): number | null => (v == null ? null : Number(v));
  return res.rows.map((r) => ({
    type: r.type, code: r.code, startDate: r.start_date, endDate: r.end_date, probationEndDate: r.probation_end_date,
    ccnlType: r.ccnl_type, ccnlLevel: r.ccnl_level, grossAnnualSalary: num(r.gross_annual_salary), currency: r.currency,
    salaryType: r.salary_type, paymentFrequency: r.payment_frequency, workHoursWeekly: num(r.work_hours_weekly),
    workScheduleType: r.work_schedule_type, partTimePercentage: num(r.part_time_percentage), jobTitle: r.job_title,
    status: r.status, terminationDate: r.termination_date, terminationReason: r.termination_reason, notes: r.notes,
  }));
}

/* --- positions ------------------------------------------------------- */

export async function listMyPositions(q: DbConnector, userId: string): Promise<{ items: Array<{
  userPositionAssignmentId: string; positionId: string; positionCode: string; positionTitle: string;
  isPrimary: boolean; status: string; startDate: string | null; endDate: string | null;
}>; total: number; }> {
  const res = await q.query<{
    user_position_assignment_id: string;
    user_position_assignment_position_id: string;
    position_code: string;
    position_title: string;
    is_primary: boolean;
    user_position_assignment_status: string;
    user_position_assignment_start_date: Date | null;
    user_position_assignment_end_date: Date | null;
  }>(
    `SELECT a.user_position_assignment_id,
            a.user_position_assignment_position_id,
            p.position_code, p.position_title,
            (a.user_position_assignment_kind = 'PRIMARY') AS is_primary,
            a.user_position_assignment_status,
            a.user_position_assignment_start_date,
            a.user_position_assignment_end_date
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_user_id = $1
      ORDER BY is_primary DESC, a.user_position_assignment_start_date DESC NULLS LAST`,
    [userId],
  );
  const items = res.rows.map((r) => ({
    userPositionAssignmentId: r.user_position_assignment_id,
    positionId: r.user_position_assignment_position_id,
    positionCode: r.position_code,
    positionTitle: r.position_title,
    isPrimary: r.is_primary,
    status: r.user_position_assignment_status,
    startDate: r.user_position_assignment_start_date
      ? r.user_position_assignment_start_date.toISOString().slice(0, 10) : null,
    endDate: r.user_position_assignment_end_date
      ? r.user_position_assignment_end_date.toISOString().slice(0, 10) : null,
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

/* --- surveys (Surveys-M2 ESS self-response) -------------------------- */

export interface SurveyListItem {
  surveyId: string; title: string; status: string; isAnonymous: boolean;
  questionCount: number; assignedAt: string; completedAt: string | null;
}

/** Surveys ASSIGNED to the caller that are currently active (per-user M2 assignment + active
 *  status). questionCount is a correlated subquery so an unanswered survey still shows its size. */
export async function listMyAssignedSurveys(
  q: DbConnector, userId: string, tenantId: string,
): Promise<SurveyListItem[]> {
  const res = await q.query<{
    survey_id: string; survey_title: string; survey_status: string;
    survey_is_anonymous: boolean; question_count: string;
    survey_assignment_assigned_at: Date; survey_assignment_completed_at: Date | null;
  }>(
    `SELECT s.survey_id, s.survey_title, s.survey_status, s.survey_is_anonymous,
            (SELECT count(*) FROM sys.sys_survey_questions qq
              WHERE qq.survey_question_survey_id = s.survey_id)::text AS question_count,
            a.survey_assignment_assigned_at, a.survey_assignment_completed_at
       FROM sys.sys_survey_assignments a
       JOIN sys.sys_surveys s ON s.survey_id = a.survey_assignment_survey_id
      WHERE a.survey_assignment_user_id = $1
        AND a.survey_assignment_tenant_id = $2
        AND s.survey_status = 'active'
      ORDER BY a.survey_assignment_assigned_at DESC`,
    [userId, tenantId],
  );
  return res.rows.map((r) => ({
    surveyId: r.survey_id,
    title: r.survey_title,
    status: r.survey_status,
    isAnonymous: r.survey_is_anonymous,
    questionCount: Number(r.question_count),
    assignedAt: r.survey_assignment_assigned_at.toISOString(),
    completedAt: r.survey_assignment_completed_at
      ? r.survey_assignment_completed_at.toISOString() : null,
  }));
}

export interface SurveyAssignmentRow {
  completedAt: Date | null;
  surveyStatus: string;
  title: string;
  isAnonymous: boolean;
}

/** The caller's assignment for one survey (self-scope guard). Null = not assigned to me → 404
 *  no-leak (cross-tenant / cross-user surveys are indistinguishable from non-existent). */
export async function findMySurveyAssignment(
  q: DbConnector, userId: string, tenantId: string, surveyId: string,
): Promise<SurveyAssignmentRow | null> {
  const res = await q.query<{
    survey_assignment_completed_at: Date | null;
    survey_status: string; survey_title: string; survey_is_anonymous: boolean;
  }>(
    `SELECT a.survey_assignment_completed_at, s.survey_status,
            s.survey_title, s.survey_is_anonymous
       FROM sys.sys_survey_assignments a
       JOIN sys.sys_surveys s ON s.survey_id = a.survey_assignment_survey_id
      WHERE a.survey_assignment_user_id = $1
        AND a.survey_assignment_tenant_id = $2
        AND a.survey_assignment_survey_id = $3`,
    [userId, tenantId, surveyId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    completedAt: r.survey_assignment_completed_at,
    surveyStatus: r.survey_status,
    title: r.survey_title,
    isAnonymous: r.survey_is_anonymous,
  };
}

export interface SurveyQuestionRow {
  questionId: string; text: string; type: string;
  category: string | null; displayOrder: number | null; isRequired: boolean;
}

/** The ordered questions of a survey. */
export async function listSurveyQuestions(
  q: DbConnector, surveyId: string,
): Promise<SurveyQuestionRow[]> {
  const res = await q.query<{
    survey_question_id: string; survey_question_text: string;
    survey_question_type: string; survey_question_category: string | null;
    survey_question_display_order: number | null; survey_question_is_required: boolean;
  }>(
    `SELECT survey_question_id, survey_question_text, survey_question_type,
            survey_question_category, survey_question_display_order,
            survey_question_is_required
       FROM sys.sys_survey_questions
      WHERE survey_question_survey_id = $1
      ORDER BY survey_question_display_order NULLS LAST, survey_question_id`,
    [surveyId],
  );
  return res.rows.map((r) => ({
    questionId: r.survey_question_id,
    text: r.survey_question_text,
    type: r.survey_question_type,
    category: r.survey_question_category,
    displayOrder: r.survey_question_display_order === null
      ? null : Number(r.survey_question_display_order),
    isRequired: r.survey_question_is_required,
  }));
}

export interface SurveyAnswerRow {
  questionId: string; ratingValue: number | null;
  textValue: string | null; choiceValue: string | null;
}

/** The caller's OWN responses for one survey (subject_user_id = me), mapped to the answer shape. */
export async function listMySurveyAnswers(
  q: DbConnector, userId: string, tenantId: string, surveyId: string,
): Promise<SurveyAnswerRow[]> {
  const res = await q.query<{
    survey_response_question_id: string | null;
    survey_response_rating_value: number | null;
    survey_response_text_value: string | null;
    survey_response_choice_value: string | null;
  }>(
    `SELECT survey_response_question_id, survey_response_rating_value,
            survey_response_text_value, survey_response_choice_value
       FROM sys.sys_survey_responses
      WHERE survey_response_survey_id = $1
        AND survey_response_tenant_id = $2
        AND survey_response_subject_user_id = $3
      ORDER BY created_at`,
    [surveyId, tenantId, userId],
  );
  return res.rows
    .filter((r) => r.survey_response_question_id !== null)
    .map((r) => ({
      questionId: r.survey_response_question_id as string,
      ratingValue: r.survey_response_rating_value,
      textValue: r.survey_response_text_value,
      choiceValue: r.survey_response_choice_value,
    }));
}

/** INSERT one append-only response row (inside a tx). The natural key makes a re-submit collide on
 *  UNIQUE(tenant, natural_key) → the caller maps 23505 to 409 ALREADY_ANSWERED. */
export async function insertSurveyResponse(
  client: PoolClient,
  args: {
    surveyId: string; questionId: string; tenantId: string; userId: string;
    naturalKey: string; ratingValue: number | null;
    textValue: string | null; choiceValue: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO sys.sys_survey_responses (
        survey_response_survey_id, survey_response_question_id,
        survey_response_tenant_id, survey_response_subject_user_id,
        survey_response_natural_key, survey_response_rating_value,
        survey_response_text_value, survey_response_choice_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      args.surveyId, args.questionId, args.tenantId, args.userId,
      args.naturalKey, args.ratingValue, args.textValue, args.choiceValue,
    ],
  );
}

/** Stamp the assignment completed (inside the same tx as the response inserts). Returns the
 *  completion timestamp. user_id + tenant guarded → only the caller's own assignment. */
export async function markSurveyAssignmentCompleted(
  client: PoolClient, userId: string, tenantId: string, surveyId: string,
): Promise<string> {
  const res = await client.query<{ survey_assignment_completed_at: Date }>(
    `UPDATE sys.sys_survey_assignments
        SET survey_assignment_completed_at = now(), updated_at = now()
      WHERE survey_assignment_user_id = $1
        AND survey_assignment_tenant_id = $2
        AND survey_assignment_survey_id = $3
      RETURNING survey_assignment_completed_at`,
    [userId, tenantId, surveyId],
  );
  return res.rows[0]!.survey_assignment_completed_at.toISOString();
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

/* --- notification preferences (3.4) ----------------------------------- */

export async function getNotificationPreferenceRows(
  q: DbConnector,
  userId: string,
): Promise<{ type: string; in_app: boolean; email: boolean }[]> {
  const res = await q.query<{ type: string; in_app: boolean; email: boolean }>(
    `SELECT preference_notification_type AS type,
            preference_in_app_enabled    AS in_app,
            preference_email_enabled     AS email
       FROM sys.sys_notification_preferences
      WHERE preference_user_id = $1`,
    [userId],
  );
  return res.rows;
}

/** Upsert one (user,type) preference; partial — a null channel keeps the existing value. */
export async function upsertNotificationPreference(
  q: DbConnector,
  tenantId: string | null,
  userId: string,
  type: string,
  inApp: boolean | null,
  email: boolean | null,
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_notification_preferences (
       preference_tenant_id, preference_user_id, preference_notification_type,
       preference_in_app_enabled, preference_email_enabled
     ) VALUES ($1, $2, $3, COALESCE($4, true), COALESCE($5, false))
     ON CONFLICT (preference_user_id, preference_notification_type) DO UPDATE SET
       preference_in_app_enabled = COALESCE($4, sys.sys_notification_preferences.preference_in_app_enabled),
       preference_email_enabled  = COALESCE($5, sys.sys_notification_preferences.preference_email_enabled)`,
    [tenantId, userId, type, inApp, email],
  );
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

/* --- preferences (WS-4 P1) ------------------------------------------- */

interface PreferenceRow {
  user_preference_theme: UserPreference["theme"];
  user_preference_palette: UserPreference["palette"];
  user_preference_locale: UserPreference["locale"];
}

/** The caller's stored UI preferences, or the brand defaults when no row exists yet. */
export async function loadPreferences(q: DbConnector, userId: string): Promise<UserPreference> {
  const res = await q.query<PreferenceRow>(
    `SELECT user_preference_theme, user_preference_palette, user_preference_locale
       FROM sys.sys_user_preferences WHERE user_preference_user_id = $1`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) {
    return {
      theme: ME_PREFERENCE_DEFAULTS.theme,
      palette: ME_PREFERENCE_DEFAULTS.palette,
      locale: ME_PREFERENCE_DEFAULTS.locale,
    };
  }
  return {
    theme: row.user_preference_theme,
    palette: row.user_preference_palette,
    locale: row.user_preference_locale,
  };
}

/** Upsert the 1:1 preferences row. A field omitted from `patch` keeps its current stored value
 *  (or the default if no row exists). Returns the resulting full preference. */
export async function upsertPreferences(
  q: DbConnector, userId: string, tenantId: string | null, patch: UpdateUserPreferenceBody,
): Promise<UserPreference> {
  // $3/$4/$7 carry the raw patch (NULL when the field is omitted). On INSERT (no row yet) an omitted
  // field falls back to the brand default ($5/$6/$8); on UPDATE an omitted field keeps the stored value
  // (the NULL EXCLUDED value is COALESCE'd against the existing column). This makes PATCH a true
  // partial update — supplying only `theme` never resets `palette`/`locale`, and vice-versa.
  const res = await q.query<PreferenceRow>(
    `INSERT INTO sys.sys_user_preferences (
        user_preference_user_id, user_preference_tenant_id,
        user_preference_theme, user_preference_palette, user_preference_locale, created_by, updated_by
      ) VALUES ($1, $2, COALESCE($3, $5), COALESCE($4, $6), COALESCE($7, $8), $1, $1)
      ON CONFLICT (user_preference_user_id) DO UPDATE SET
        user_preference_theme   = COALESCE($3, sys.sys_user_preferences.user_preference_theme),
        user_preference_palette = COALESCE($4, sys.sys_user_preferences.user_preference_palette),
        user_preference_locale  = COALESCE($7, sys.sys_user_preferences.user_preference_locale),
        user_preference_tenant_id = COALESCE(sys.sys_user_preferences.user_preference_tenant_id, EXCLUDED.user_preference_tenant_id),
        updated_at = now(),
        updated_by = $1
      RETURNING user_preference_theme, user_preference_palette, user_preference_locale`,
    [
      userId,
      tenantId,
      patch.theme ?? null,
      patch.palette ?? null,
      ME_PREFERENCE_DEFAULTS.theme,
      ME_PREFERENCE_DEFAULTS.palette,
      patch.locale ?? null,
      ME_PREFERENCE_DEFAULTS.locale,
    ],
  );
  const r = res.rows[0]!;
  return {
    theme: r.user_preference_theme,
    palette: r.user_preference_palette,
    locale: r.user_preference_locale,
  };
}
