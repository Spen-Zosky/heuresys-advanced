/**
 * packages/shared/src/schemas/me.ts
 * Employee Self-Service Portal schemas — every action implicitly scopes to
 * req.user.userId at the route level (no :userId in any URL).
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
/* --- profile ---------------------------------------------------------- */

export const MeProfileSchema = z.object({
  userId: z.uuid(),
  tenantId: z.uuid().nullable(),
  email: z.email(),
  displayName: z.string().nullable(),
  locale: z.string().nullable(),
  timezone: z.string().nullable(),
  roles: z.array(z.string()),
  bio: z.string().nullable(),
  pictureUri: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUri: z.string().nullable(),
  contactPrefs: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MeProfile = z.infer<typeof MeProfileSchema>;

export const UpdateMeProfileBodySchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  locale: z.string().max(16).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  bio: z.string().max(4096).nullable().optional(),
  pictureUri: z.string().max(4096).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  linkedinUri: z.string().max(4096).nullable().optional(),
  contactPrefs: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateMeProfileBody = z.infer<typeof UpdateMeProfileBodySchema>;

/* --- extended profile (S1010 — anagraphic/employment satellites, mig 000164) --
 * Feeds the /me/profile tab UI (Panoramica + Organizzazione), mirroring the
 * legacy portal profile. Read-only aggregate; data is production (no-PII
 * abandoned, ADR-0023/0026). All scalar sections are nullable-by-field. */

export const MeIdentitySchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  middleName: z.string().nullable(),
  birthDate: z.string().nullable(),
  birthPlace: z.string().nullable(),
  gender: z.string().nullable(),
  nationality: z.string().nullable(),
  maritalStatus: z.string().nullable(),
  taxId: z.string().nullable(),
});

export const MeIdentityDocumentSchema = z.object({
  kind: z.string(),
  number: z.string(),
  expiryDate: z.string().nullable(),
});

export const MeAddressSchema = z.object({
  kind: z.string(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
});

export const MeContactsSchema = z.object({
  phoneMobile: z.string().nullable(),
  phoneHome: z.string().nullable(),
  personalEmail: z.string().nullable(),
});

export const MeEmergencyContactSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  relationship: z.string().nullable(),
});

export const MeFamilyMemberSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  relationship: z.string().nullable(),
  birthDate: z.string().nullable(),
  gender: z.string().nullable(),
  isDependent: z.boolean(),
});

export const MeEducationSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  fieldOfStudy: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  grade: z.string().nullable(),
});

export const MeBankingSchema = z.object({
  iban: z.string().nullable(),
  swiftBic: z.string().nullable(),
  bankName: z.string().nullable(),
  accountNumber: z.string().nullable(),
});

export const MeOrganizationSchema = z.object({
  jobTitle: z.string().nullable(),
  department: z.string().nullable(),
  orgUnit: z.string().nullable(),
  location: z.string().nullable(),
  costCenter: z.string().nullable(),
  managerName: z.string().nullable(),
  positionCode: z.string().nullable(),
  positionTitle: z.string().nullable(),
});

/** salary + fascia (payScale*) sono la retribuzione: optional perché il dossier
 *  li maschera sotto il mandato piattaforma (ADR-0032). I fatti del rapporto
 *  (date, sede, stato) restano sempre. */
export const MeEmploymentSchema = z.object({
  salary: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  payScaleArea: z.string().nullable().optional(),
  payScaleType: z.string().nullable().optional(),
  payScaleGroup: z.string().nullable().optional(),
  payScaleLevel: z.string().nullable().optional(),
  payPeriodsPerYear: z.number().int().nullable().optional(),
  workSchedulePct: z.number().nullable(),
  pernr: z.string().nullable(),
  companyCode: z.string().nullable(),
  personnelArea: z.string().nullable(),
  personnelSubarea: z.string().nullable(),
  hireDate: z.string().nullable(),
  seniorityDate: z.string().nullable(),
  probationEndDate: z.string().nullable(),
  contractEndDate: z.string().nullable(),
  terminationDate: z.string().nullable(),
  terminationReason: z.string().nullable(),
  status: z.string().nullable(),
  masked: z.array(z.string()).optional(),
});

export const MeAuthSummarySchema = z.object({
  username: z.string().nullable(),
  roles: z.array(z.string()),
  lastLogin: z.string().nullable(),
});

/** GET /v1/me/profile/full — aggregate profile feeding the tabbed /me/profile UI. */
export const MeProfileFullSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.email(),
  identity: MeIdentitySchema,
  documents: z.array(MeIdentityDocumentSchema),
  addresses: z.array(MeAddressSchema),
  contacts: MeContactsSchema,
  emergency: MeEmergencyContactSchema,
  family: z.array(MeFamilyMemberSchema),
  education: z.array(MeEducationSchema),
  banking: MeBankingSchema.nullable(),
  organization: MeOrganizationSchema,
  employment: MeEmploymentSchema.nullable(),
  auth: MeAuthSummarySchema,
});
export type MeProfileFull = z.infer<typeof MeProfileFullSchema>;

/* --- contracts (S1010 F2 — employment contract history, mig 000165) -------- */

export const MeContractSchema = z.object({
  type: z.string().nullable(),
  code: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  probationEndDate: z.string().nullable(),
  ccnlType: z.string().nullable(),
  ccnlLevel: z.string().nullable(),
  // retribuzione contrattuale: optional per il mask del dossier (ADR-0032);
  // l'inquadramento CCNL resta visibile, e' classificazione, non importo
  grossAnnualSalary: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  salaryType: z.string().nullable().optional(),
  paymentFrequency: z.string().nullable().optional(),
  workHoursWeekly: z.number().nullable(),
  workScheduleType: z.string().nullable(),
  partTimePercentage: z.number().nullable(),
  jobTitle: z.string().nullable(),
  status: z.string().nullable(),
  terminationDate: z.string().nullable(),
  terminationReason: z.string().nullable(),
  notes: z.string().nullable(),
  masked: z.array(z.string()).optional(),
});
export type MeContract = z.infer<typeof MeContractSchema>;

export const MeContractsResponseSchema = z.object({
  items: z.array(MeContractSchema),
  total: z.number().int().min(0),
});
export type MeContractsResponse = z.infer<typeof MeContractsResponseSchema>;

/* --- pay-slips (S1011 F4 — cedolini history, mig 000167) ------------------ */

/** I campi-denaro sono optional: sotto il mandato piattaforma (ADR-0032, #124 D1)
 *  il dossier li RIMUOVE e li dichiara in `masked`. Self-scope (I17) e mandato HR
 *  (I20) li ricevono sempre; /v1/me/* non maschera mai. */
export const MePaySlipSchema = z.object({
  period: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  grossPay: z.number().nullable().optional(),
  netPay: z.number().nullable().optional(),
  deductions: z.record(z.string(), z.number()).optional(),
  paymentDate: z.string().nullable(),
  status: z.string().nullable(),
  masked: z.array(z.string()).optional(),
});
export type MePaySlip = z.infer<typeof MePaySlipSchema>;

export const MePaySlipsResponseSchema = z.object({
  items: z.array(MePaySlipSchema),
  total: z.number().int().min(0),
});
export type MePaySlipsResponse = z.infer<typeof MePaySlipsResponseSchema>;

/* --- performance (S1010 F3a — review history, read-only consultation) ------ */

/** I campi-giudizio sono optional: EVALUATION sotto mandato piattaforma viene
 *  mascherata nel dossier (ADR-0032, #124 D1). Tipo, periodo e stato restano. */
export const MePerformanceReviewSchema = z.object({
  type: z.string().nullable(),
  status: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  overallRating: z.number().nullable().optional(),
  goalRating: z.number().nullable().optional(),
  competencyRating: z.number().nullable().optional(),
  potentialRating: z.string().nullable().optional(),
  performanceBox: z.number().int().nullable().optional(),
  potentialBox: z.number().int().nullable().optional(),
  masked: z.array(z.string()).optional(),
});
export type MePerformanceReview = z.infer<typeof MePerformanceReviewSchema>;
export const MePerformanceResponseSchema = z.object({
  items: z.array(MePerformanceReviewSchema),
  total: z.number().int().min(0),
});
export type MePerformanceResponse = z.infer<typeof MePerformanceResponseSchema>;

/* --- attendance (S1010 F3a — imported attendance/overtime/leave, read-only) - */

export const MeAttendanceDaySchema = z.object({
  date: z.string().nullable(),
  clockIn: z.string().nullable(),
  clockOut: z.string().nullable(),
  hoursRegular: z.number().nullable(),
  hoursOvertime: z.number().nullable(),
  hoursTotal: z.number().nullable(),
  status: z.string().nullable(),
});
export const MeOvertimeEntrySchema = z.object({
  date: z.string().nullable(),
  type: z.string().nullable(),
  hours: z.number().nullable(),
  totalCompensation: z.number().nullable(),
  status: z.string().nullable(),
});
export const MeLeaveBalanceSchema = z.object({
  leaveType: z.string().nullable(),
  year: z.number().int().nullable(),
  totalDays: z.number().nullable(),
  usedDays: z.number().nullable(),
  pendingDays: z.number().nullable(),
  carryoverDays: z.number().nullable(),
});
export const MeAttendanceResponseSchema = z.object({
  recent: z.array(MeAttendanceDaySchema),
  overtime: z.array(MeOvertimeEntrySchema),
  leaveBalances: z.array(MeLeaveBalanceSchema),
});
export type MeAttendanceResponse = z.infer<typeof MeAttendanceResponseSchema>;

/* --- time-off request submission (B3 #34 — the first real approval flow) --- */

/** Mirrors the sys_time_off_requests leave_type CHECK (10 values). */
export const ME_LEAVE_TYPES = [
  "VACATION", "SICK", "PERSONAL", "MATERNITY", "PATERNITY",
  "BEREAVEMENT", "STUDY", "SABBATICAL", "UNPAID", "OTHER",
] as const;
export const MeLeaveTypeSchema = z.enum(ME_LEAVE_TYPES);
export type MeLeaveType = z.infer<typeof MeLeaveTypeSchema>;

export const CreateMeTimeOffRequestBodySchema = z.object({
  leaveType: MeLeaveTypeSchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  halfDayStart: z.boolean().optional(),
  halfDayEnd: z.boolean().optional(),
  reason: z.string().max(2000).nullable().optional(),
});
export type CreateMeTimeOffRequestBody = z.infer<typeof CreateMeTimeOffRequestBodySchema>;

/** The submission creates an APPROVAL request (TIME_OFF_REQUEST); the time-off
 *  row is written by the apply-effect handler only once the manager approves. */
export const MeTimeOffRequestSubmittedSchema = z.object({
  approvalRequestId: z.uuid(),
  title: z.string(),
  status: z.string(),
  daysRequested: z.number(),
  approverUserId: z.uuid(),
});
export type MeTimeOffRequestSubmitted = z.infer<typeof MeTimeOffRequestSubmittedSchema>;

/* --- permissions (RBAC -> UI gating; reflects the caller's OWN grants) ---- */

export const MePermissionsResponseSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type MePermissionsResponse = z.infer<typeof MePermissionsResponseSchema>;

/* --- UI interfaces registry (U1) — DB-driven sidebar, 5 SECTIONS (S1009 IA redesign) --- */
// The 3 PET perspectives (PROCESS/ENTERPRISE/TALENT) were replaced by 5 always-visible
// collapsible sections. The response key stays `perspectives` for continuity; the codes
// are the section ids, returned in display order.
export const PerspectiveCodeSchema = z.enum([
  "OVERVIEW", "GOVERNANCE", "WORKFORCE", "INTELLIGENCE", "PERSONAL",
]);
export type PerspectiveCode = z.infer<typeof PerspectiveCodeSchema>;

export const MeInterfaceSchema = z.object({
  code: z.string(),
  label: z.string(),
  route: z.string(),
  icon: z.string().nullable(),
  sidebarGroup: z.string(),
  order: z.number().int(),
});
export type MeInterface = z.infer<typeof MeInterfaceSchema>;

export const MePerspectiveGroupSchema = z.object({
  code: PerspectiveCodeSchema,
  label: z.string(),
  interfaces: z.array(MeInterfaceSchema),
});
export type MePerspectiveGroup = z.infer<typeof MePerspectiveGroupSchema>;

/** GET /v1/me/interfaces — sidebar interfaces visible to the caller, grouped by the 3 PET
 *  perspectives (all 3 always present, so an empty perspective renders an honest empty-state). */
export const MeInterfacesResponseSchema = z.object({
  perspectives: z.array(MePerspectiveGroupSchema),
});
export type MeInterfacesResponse = z.infer<typeof MeInterfacesResponseSchema>;

/* --- positions -------------------------------------------------------- */

export const MePositionAssignmentSchema = z.object({
  userPositionAssignmentId: z.uuid(),
  positionId: z.uuid(),
  positionCode: z.string(),
  positionTitle: z.string(),
  isPrimary: z.boolean(),
  status: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});
export const MePositionsResponseSchema = z.object({
  items: z.array(MePositionAssignmentSchema), total: z.number().int().min(0),
});

/* --- skills + self-assessment ---------------------------------------- */

export const MeSkillEvidenceSchema = z.object({
  userSkillEvidenceId: z.uuid(),
  skillId: z.uuid(),
  skillCode: z.string(),
  skillName: z.string(),
  declaredProficiency: z.string(),
  source: z.string(),
  assessedAt: z.iso.datetime(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
});
export const MeSkillsResponseSchema = z.object({
  items: z.array(MeSkillEvidenceSchema), total: z.number().int().min(0),
});

/**
 * #46 D1 — CURRENT skill possession (sys_user_skills), distinct from the evidence trail
 * above: `MeSkillEvidence` is the append-only history of assessments (many rows per skill),
 * this is the one-row-per-skill snapshot that gap analysis and matching actually consume.
 */
export const MeSkillPossessionSchema = z.object({
  userSkillId: z.uuid(),
  skillId: z.uuid(),
  skillCode: z.string(),
  skillName: z.string(),
  proficiency: z.string(),
  proficiencyRank: z.number().int().nullable(),
  yearsExperience: z.number().nullable(),
  isPrimary: z.boolean(),
  isVerified: z.boolean(),
  source: z.string(),
  lastUsedOn: z.string().nullable(),
});
export type MeSkillPossession = z.infer<typeof MeSkillPossessionSchema>;

export const MeSkillPossessionResponseSchema = z.object({
  items: z.array(MeSkillPossessionSchema), total: z.number().int().min(0),
});
export type MeSkillPossessionResponse = z.infer<typeof MeSkillPossessionResponseSchema>;

export const CreateMeSelfAssessmentBodySchema = z.object({
  skillId: z.uuid(),
  declaredProficiency: z.string().min(1).max(32),
  score: z.number().min(0).max(100).nullable().optional(),
  comment: z.string().max(4096).nullable().optional(),
});
export type CreateMeSelfAssessmentBody = z.infer<typeof CreateMeSelfAssessmentBodySchema>;

/* --- surveys (Surveys-M2 ESS self-response) -------------------------- */

export const MeSurveyListItemSchema = z.object({
  surveyId: z.uuid(),
  title: z.string(),
  status: z.string(),
  isAnonymous: z.boolean(),
  questionCount: z.number().int(),
  /** Null when the survey is reachable only through one's own answers: no assignment row
   *  exists to date it, and inventing a date would state a fact nobody recorded. */
  assignedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  /** How many answers of MINE this survey holds — 0 means assigned but not answered yet. */
  answerCount: z.number().int().min(0),
});
export type MeSurveyListItem = z.infer<typeof MeSurveyListItemSchema>;
export const MeSurveysResponseSchema = z.object({
  items: z.array(MeSurveyListItemSchema), total: z.number().int().min(0),
});
export type MeSurveysResponse = z.infer<typeof MeSurveysResponseSchema>;

export const MeSurveyQuestionSchema = z.object({
  questionId: z.uuid(),
  text: z.string(),
  type: z.string(),
  category: z.string().nullable(),
  displayOrder: z.number().int().nullable(),
  isRequired: z.boolean(),
});
export const MeSurveyAnswerSchema = z.object({
  questionId: z.uuid(),
  ratingValue: z.number().int().nullable(),
  textValue: z.string().nullable(),
  choiceValue: z.string().nullable(),
});
export const MeSurveyDetailSchema = z.object({
  surveyId: z.uuid(),
  title: z.string(),
  status: z.string(),
  isAnonymous: z.boolean(),
  completedAt: z.iso.datetime().nullable(),
  questions: z.array(MeSurveyQuestionSchema),
  myAnswers: z.array(MeSurveyAnswerSchema),
});
export type MeSurveyDetail = z.infer<typeof MeSurveyDetailSchema>;

export const SubmitMeSurveyAnswerSchema = z.object({
  questionId: z.uuid(),
  ratingValue: z.number().int().min(0).max(10).nullable().optional(),
  textValue: z.string().max(4096).nullable().optional(),
  choiceValue: z.string().max(200).nullable().optional(),
});
export const SubmitMeSurveyResponseBodySchema = z.object({
  answers: z.array(SubmitMeSurveyAnswerSchema).min(1).max(100),
});
export type SubmitMeSurveyResponseBody = z.infer<typeof SubmitMeSurveyResponseBodySchema>;

export const SubmitMeSurveyResultSchema = z.object({
  submitted: z.number().int(),
  completedAt: z.iso.datetime(),
});
export type SubmitMeSurveyResult = z.infer<typeof SubmitMeSurveyResultSchema>;

export const MeSurveyIdParamSchema = z.object({ surveyId: z.uuid() });

/* --- learning -------------------------------------------------------- */

export const MeLearningAssignmentSchema = z.object({
  userLearningAssignmentId: z.uuid(),
  moduleId: z.uuid().nullable(),
  initiativeId: z.uuid().nullable(),
  pathId: z.uuid().nullable(),
  isMandatory: z.boolean(),
  status: z.string(),
  deadline: z.string().nullable(),
  /** Quale delle tre gambe è valorizzata (CHECK `sys_ula_scope_check`). */
  kind: z.enum(["MODULE", "INITIATIVE", "PATH"]),
  /** Il nome leggibile della cosa assegnata: chi la consulta ha bisogno di questo, non di un uuid. */
  title: z.string().nullable(),
  moduleTitle: z.string().nullable(),
  initiativeCode: z.string().nullable(),
  pathName: z.string().nullable(),
  /** Quando l'assegnazione è nata: è la data di iscrizione mostrata nel portale. */
  enrolledAt: z.string().nullable(),
});
export type MeLearningAssignment = z.infer<typeof MeLearningAssignmentSchema>;
export const MeLearningResponseSchema = z.object({
  items: z.array(MeLearningAssignmentSchema), total: z.number().int().min(0),
});
export type MeLearningResponse = z.infer<typeof MeLearningResponseSchema>;

export const CreateMeEnrollmentBodySchema = z.object({
  moduleId: z.uuid().nullable().optional(),
  pathId: z.uuid().nullable().optional(),
  initiativeId: z.uuid().nullable().optional(),
}).refine(
  (b) => b.moduleId || b.pathId || b.initiativeId,
  { error: "At least one of moduleId / pathId / initiativeId required" },
);
export type CreateMeEnrollmentBody = z.infer<typeof CreateMeEnrollmentBodySchema>;

/* --- gaps + assessments --------------------------------------------- */

export const MeGapSchema = z.object({
  learningGapId: z.uuid(),
  skillId: z.uuid().nullable(),
  positionId: z.uuid().nullable(),
  severity: z.string(),
  score: z.number().nullable(),
  detectedAt: z.iso.datetime(),
});
export const MeGapsResponseSchema = z.object({
  items: z.array(MeGapSchema), total: z.number().int().min(0),
});
export type MeGap = z.infer<typeof MeGapSchema>;
export type MeGapsResponse = z.infer<typeof MeGapsResponseSchema>;

export const MeAssessmentSchema = z.object({
  assessmentId: z.uuid(),
  kind: z.string(),
  status: z.string(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const MeAssessmentsResponseSchema = z.object({
  items: z.array(MeAssessmentSchema), total: z.number().int().min(0),
});

/* --- career targets -------------------------------------------------- */

export const MeCareerTargetSchema = z.object({
  userTargetPositionId: z.uuid(),
  positionId: z.uuid(),
  horizon: z.string().nullable(),
  reviewStatus: z.string(),
  reviewNotes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const MeCareerResponseSchema = z.object({
  items: z.array(MeCareerTargetSchema), total: z.number().int().min(0),
});

export const CreateMeCareerTargetBodySchema = z.object({
  positionId: z.uuid(),
  horizon: z.string().max(32).nullable().optional(),
});
export type CreateMeCareerTargetBody = z.infer<typeof CreateMeCareerTargetBodySchema>;

/* --- career sub-tabs (S1011 F3b — /me/career navtab) ------------------ */

// Obiettivi — the caller's own goals (sys_goals, subject-user backfilled mig 000166).
export const MeGoalSchema = z.object({
  goalId: z.uuid(), // #26 (S1018): enables the self activity-timeline drill-down
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: z.string().nullable(),
  category: z.string().nullable(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  progressPercent: z.number().nullable(),
  weight: z.number().nullable(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type MeGoal = z.infer<typeof MeGoalSchema>;
export const MeGoalsResponseSchema = z.object({
  items: z.array(MeGoalSchema),
  total: z.number().int().min(0),
});
export type MeGoalsResponse = z.infer<typeof MeGoalsResponseSchema>;

// Rischio & Successione — own flight-risk (latest) + succession-readiness per target position (latest).
export const MeFlightRiskSchema = z.object({
  value: z.number().nullable(),
  band: z.string().nullable(),
  modelVersion: z.string().nullable(),
  computedAt: z.string().nullable(),
});
export const MeSuccessionRowSchema = z.object({
  positionId: z.uuid(),
  positionTitle: z.string().nullable(),
  value: z.number().nullable(),
  horizon: z.string().nullable(),
  modelVersion: z.string().nullable(),
  computedAt: z.string().nullable(),
});
export const MeRiskResponseSchema = z.object({
  flightRisk: MeFlightRiskSchema.nullable(),
  succession: z.array(MeSuccessionRowSchema),
});
export type MeRiskResponse = z.infer<typeof MeRiskResponseSchema>;

// Percorsi — career paths reachable from the caller's PRIMARY position + own personal plans.
export const MeCareerPathStepSchema = z.object({
  ordinal: z.number().int(),
  originPositionTitle: z.string().nullable(),
  targetPositionTitle: z.string().nullable(),
  typicalDurationMonths: z.number().int().nullable(),
});
export const MeCareerPathSchema = z.object({
  careerPathId: z.uuid(),
  code: z.string().nullable(),
  name: z.string().nullable(),
  kind: z.string().nullable(),
  steps: z.array(MeCareerPathStepSchema),
});
/**
 * #161/S1048 — un piano di carriera dichiara un PERCORSO, non una posizione.
 *
 * Misurato sui 113 piani reali: `user_career_plan_path_id` è valorizzato su
 * 113/113, mentre `target_position_id` e `horizon_months` sono NULL su tutti.
 * Non è dato mancante: il legacy da cui provengono non porta affatto un bersaglio
 * (le sue chiavi sono source_id, notes, target_completion, status, started_at) —
 * il piano dice «sto seguendo il Risk Management Track», e il traguardo puntuale
 * vive semmai in `sys_user_target_positions`, che è un'altra cosa.
 *
 * `pathName` è quindi il campo che il piano possiede davvero. Gli altri due
 * restano nel contratto perché il modello li ammette e un piano futuro potrà
 * valorizzarli, ma la pagina non deve promettere una colonna che oggi è vuota
 * per costruzione.
 */
export const MeCareerPlanSchema = z.object({
  status: z.string().nullable(),
  pathName: z.string().nullable(),
  targetPositionTitle: z.string().nullable(),
  horizonMonths: z.number().int().nullable(),
});
export const MeCareerPathsResponseSchema = z.object({
  fromPositionTitle: z.string().nullable(),
  paths: z.array(MeCareerPathSchema),
  plans: z.array(MeCareerPlanSchema),
});
export type MeCareerPathsResponse = z.infer<typeof MeCareerPathsResponseSchema>;

/* --- personal analytics (S1011 F5.1 — /me/analytics) ------------------ */

export const MeAnalyticsMonthSchema = z.object({
  month: z.string(),            // 'YYYY-MM'
  regularHours: z.number(),
  overtimeHours: z.number(),
});
export const MeAnalyticsResponseSchema = z.object({
  attendanceTrend: z.array(MeAnalyticsMonthSchema),
  summary: z.object({
    goalsCount: z.number().int(),
    skillsCount: z.number().int(),
    latestPerformanceRating: z.number().nullable(),
    leaveBalanceDays: z.number().nullable(),
  }),
});
export type MeAnalyticsResponse = z.infer<typeof MeAnalyticsResponseSchema>;

/* --- personal approvals (S1011 F5.3 — /me/approvals, track-only) ------ */

export const MeApprovalRowSchema = z.object({
  title: z.string().nullable(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  resourceType: z.string().nullable(),
  createdAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
});
export const MeApprovalsResponseSchema = z.object({
  items: z.array(MeApprovalRowSchema),
  byStatus: z.object({ pending: z.number().int(), approved: z.number().int(), rejected: z.number().int() }),
  total: z.number().int().min(0),
});
export type MeApprovalsResponse = z.infer<typeof MeApprovalsResponseSchema>;

/* --- inbox ----------------------------------------------------------- */

export const MeInboxNotificationSchema = z.object({
  notificationId: z.uuid(),
  type: z.string(),
  subject: z.string(),
  body: z.string().nullable(),
  actionUrl: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.uuid().nullable(),
  priority: z.string(),
  status: z.string(),
  readAt: z.iso.datetime().nullable(),
  dismissedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const MeInboxResponseSchema = z.object({
  items: z.array(MeInboxNotificationSchema), total: z.number().int().min(0),
});

export const MeInboxQuerySchema = z.object({
  status: z.enum(["UNREAD", "READ", "DISMISSED"]).optional(),
  ...paginationFields(200, 50),
});
export type MeInboxQuery = z.infer<typeof MeInboxQuerySchema>;

export const PatchMeInboxBodySchema = z.object({
  status: z.enum(["READ", "DISMISSED"]),
});
export type PatchMeInboxBody = z.infer<typeof PatchMeInboxBodySchema>;

export const NotificationIdParamSchema = z.object({ notificationId: z.uuid() });

/* --- kpis (ESS-8) ---------------------------------------------------- */

export const MeKpiTargetSchema = z.object({
  positionKpiRequirementId: z.uuid(),
  positionId: z.uuid(),
  kpiDefinitionId: z.uuid(),
  kpiCode: z.string(),
  kpiName: z.string(),
  unit: z.string().nullable(),
  polarity: z.string(),
  targetTemplate: z.record(z.string(), z.unknown()),
  weight: z.string(),
  latestMeasuredValue: z.string().nullable(),
  latestTargetValue: z.string().nullable(),
  latestRecordedAt: z.iso.datetime().nullable(),
});
export type MeKpiTarget = z.infer<typeof MeKpiTargetSchema>;

export const MeKpisResponseSchema = z.object({
  items: z.array(MeKpiTargetSchema),
  total: z.number().int().min(0),
});

/* --- certifications (ESS-11) ----------------------------------------- */

export const MeCertificationSchema = z.object({
  userCertificationId: z.uuid(),
  name: z.string(),
  issuer: z.string(),
  issuedDate: z.string().nullable(),
  expiresDate: z.string().nullable(),
  credentialId: z.string().nullable(),
  documentUri: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MeCertification = z.infer<typeof MeCertificationSchema>;

export const MeCertificationsResponseSchema = z.object({
  items: z.array(MeCertificationSchema),
  total: z.number().int().min(0),
});

export const CreateMeCertificationBodySchema = z.object({
  name: z.string().min(1).max(255),
  issuer: z.string().min(1).max(255),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiresDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  credentialId: z.string().max(255).nullable().optional(),
  documentUri: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateMeCertificationBody = z.infer<typeof CreateMeCertificationBodySchema>;

/* --- documents (ESS-12) ---------------------------------------------- */

export const ME_DOCUMENT_KINDS = [
  "CV",
  "CERTIFICATE",
  "CONTRACT_REFERENCE",
  "TRAINING_RECORD",
  "EVIDENCE_PROOF",
  "OTHER",
] as const;

export const MeDocumentSchema = z.object({
  userDocumentId: z.uuid(),
  kind: z.enum(ME_DOCUMENT_KINDS),
  title: z.string(),
  uri: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MeDocument = z.infer<typeof MeDocumentSchema>;

export const MeDocumentsResponseSchema = z.object({
  items: z.array(MeDocumentSchema),
  total: z.number().int().min(0),
});

/** #26 (S1018): param for GET /v1/me/goals/:goalId/timeline. */
export const MeGoalIdParamSchema = z.object({ goalId: z.uuid() });

/* --- #59 F/F5 (ADR-0031, S1028): il mio sviluppo — score calcolati self ----- */

/** One scoring feature with its evidence (from the model's own derivation). */
export const MeScoreFactorSchema = z.object({
  feature: z.string(),
  weight: z.number(),
  raw: z.number().nullable(),
  normalized: z.number().nullable(),
  contribution: z.number(),
});
export type MeScoreFactor = z.infer<typeof MeScoreFactorSchema>;

export const MeFlightRiskSelfSchema = z.object({
  value: z.number(),
  band: z.enum(["LOW", "MEDIUM", "HIGH"]),
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
  factors: z.array(MeScoreFactorSchema),
});
export type MeFlightRiskSelf = z.infer<typeof MeFlightRiskSelfSchema>;

export const MeCapabilitySelfSchema = z.object({
  value: z.number(),
  coverage: z.number().nullable(),
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
});
export type MeCapabilitySelf = z.infer<typeof MeCapabilitySelfSchema>;

/** GET /v1/me/development — the caller's OWN computed intelligence, coach
 *  framing (ADR-0031 supersedes D-6). Either block is null when the platform
 *  has not computed a score for the caller yet (real empty-state). */
export const MeDevelopmentResponseSchema = z.object({
  flightRisk: MeFlightRiskSelfSchema.nullable(),
  capability: MeCapabilitySelfSchema.nullable(),
  generatedAt: z.iso.datetime(),
});
export type MeDevelopmentResponse = z.infer<typeof MeDevelopmentResponseSchema>;

/* --- esperienze professionali precedenti (esposizione C5-gate) --------- */

/**
 * Il curriculum di chi chiama: le esperienze precedenti all'ingresso in azienda.
 * Erano scritte nel database ma nessun endpoint le leggeva, quindi la carriera
 * di una persona restava invisibile nel portale.
 */
export const MeProfessionalExperienceSchema = z.object({
  professionalExperienceId: z.uuid(),
  employer: z.string(),
  roleTitle: z.string(),
  industry: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  description: z.string().nullable(),
  /** Durata in mesi, derivata: quello che un curriculum mostra davvero. */
  durationMonths: z.number().int().nullable(),
});
export type MeProfessionalExperience = z.infer<typeof MeProfessionalExperienceSchema>;

export const MeProfessionalExperiencesResponseSchema = z.object({
  items: z.array(MeProfessionalExperienceSchema),
  total: z.number().int().min(0),
});
export type MeProfessionalExperiencesResponse =
  z.infer<typeof MeProfessionalExperiencesResponseSchema>;
