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

export const MeEmploymentSchema = z.object({
  salary: z.number().nullable(),
  currency: z.string().nullable(),
  payScaleArea: z.string().nullable(),
  payScaleType: z.string().nullable(),
  payScaleGroup: z.string().nullable(),
  payScaleLevel: z.string().nullable(),
  payPeriodsPerYear: z.number().int().nullable(),
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
  grossAnnualSalary: z.number().nullable(),
  currency: z.string().nullable(),
  salaryType: z.string().nullable(),
  paymentFrequency: z.string().nullable(),
  workHoursWeekly: z.number().nullable(),
  workScheduleType: z.string().nullable(),
  partTimePercentage: z.number().nullable(),
  jobTitle: z.string().nullable(),
  status: z.string().nullable(),
  terminationDate: z.string().nullable(),
  terminationReason: z.string().nullable(),
  notes: z.string().nullable(),
});
export type MeContract = z.infer<typeof MeContractSchema>;

export const MeContractsResponseSchema = z.object({
  items: z.array(MeContractSchema),
  total: z.number().int().min(0),
});
export type MeContractsResponse = z.infer<typeof MeContractsResponseSchema>;

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
  assignedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
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
});
export const MeLearningResponseSchema = z.object({
  items: z.array(MeLearningAssignmentSchema), total: z.number().int().min(0),
});

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
