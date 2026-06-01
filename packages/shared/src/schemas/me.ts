/**
 * packages/shared/src/schemas/me.ts
 * Employee Self-Service Portal schemas — every action implicitly scopes to
 * req.user.userId at the route level (no :userId in any URL).
 */
import { z } from "zod";

/* --- profile ---------------------------------------------------------- */

export const MeProfileSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  email: z.string().email(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

/* --- permissions (RBAC -> UI gating; reflects the caller's OWN grants) ---- */

export const MePermissionsResponseSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type MePermissionsResponse = z.infer<typeof MePermissionsResponseSchema>;

/* --- UI interfaces registry (U1) — DB-driven sidebar, PET perspectives --- */
export const PerspectiveCodeSchema = z.enum(["PROCESS", "ENTERPRISE", "TALENT"]);
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
  userPositionAssignmentId: z.string().uuid(),
  positionId: z.string().uuid(),
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
  userSkillEvidenceId: z.string().uuid(),
  skillId: z.string().uuid(),
  skillCode: z.string(),
  skillName: z.string(),
  declaredProficiency: z.string(),
  source: z.string(),
  assessedAt: z.string().datetime(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
});
export const MeSkillsResponseSchema = z.object({
  items: z.array(MeSkillEvidenceSchema), total: z.number().int().min(0),
});

export const CreateMeSelfAssessmentBodySchema = z.object({
  skillId: z.string().uuid(),
  declaredProficiency: z.string().min(1).max(32),
  score: z.number().min(0).max(100).nullable().optional(),
  comment: z.string().max(4096).nullable().optional(),
});
export type CreateMeSelfAssessmentBody = z.infer<typeof CreateMeSelfAssessmentBodySchema>;

/* --- learning -------------------------------------------------------- */

export const MeLearningAssignmentSchema = z.object({
  userLearningAssignmentId: z.string().uuid(),
  moduleId: z.string().uuid().nullable(),
  initiativeId: z.string().uuid().nullable(),
  pathId: z.string().uuid().nullable(),
  isMandatory: z.boolean(),
  status: z.string(),
  deadline: z.string().nullable(),
});
export const MeLearningResponseSchema = z.object({
  items: z.array(MeLearningAssignmentSchema), total: z.number().int().min(0),
});

export const CreateMeEnrollmentBodySchema = z.object({
  moduleId: z.string().uuid().nullable().optional(),
  pathId: z.string().uuid().nullable().optional(),
  initiativeId: z.string().uuid().nullable().optional(),
}).refine(
  (b) => b.moduleId || b.pathId || b.initiativeId,
  { message: "At least one of moduleId / pathId / initiativeId required" },
);
export type CreateMeEnrollmentBody = z.infer<typeof CreateMeEnrollmentBodySchema>;

/* --- gaps + assessments --------------------------------------------- */

export const MeGapSchema = z.object({
  learningGapId: z.string().uuid(),
  skillId: z.string().uuid().nullable(),
  positionId: z.string().uuid().nullable(),
  severity: z.string(),
  score: z.number().nullable(),
  detectedAt: z.string().datetime(),
});
export const MeGapsResponseSchema = z.object({
  items: z.array(MeGapSchema), total: z.number().int().min(0),
});

export const MeAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  kind: z.string(),
  status: z.string(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const MeAssessmentsResponseSchema = z.object({
  items: z.array(MeAssessmentSchema), total: z.number().int().min(0),
});

/* --- career targets -------------------------------------------------- */

export const MeCareerTargetSchema = z.object({
  userTargetPositionId: z.string().uuid(),
  positionId: z.string().uuid(),
  horizon: z.string().nullable(),
  reviewStatus: z.string(),
  reviewNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const MeCareerResponseSchema = z.object({
  items: z.array(MeCareerTargetSchema), total: z.number().int().min(0),
});

export const CreateMeCareerTargetBodySchema = z.object({
  positionId: z.string().uuid(),
  horizon: z.string().max(32).nullable().optional(),
});
export type CreateMeCareerTargetBody = z.infer<typeof CreateMeCareerTargetBodySchema>;

/* --- inbox ----------------------------------------------------------- */

export const MeInboxNotificationSchema = z.object({
  notificationId: z.string().uuid(),
  type: z.string(),
  subject: z.string(),
  body: z.string().nullable(),
  actionUrl: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().uuid().nullable(),
  priority: z.string(),
  status: z.string(),
  readAt: z.string().datetime().nullable(),
  dismissedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export const MeInboxResponseSchema = z.object({
  items: z.array(MeInboxNotificationSchema), total: z.number().int().min(0),
});

export const MeInboxQuerySchema = z.object({
  status: z.enum(["UNREAD", "READ", "DISMISSED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type MeInboxQuery = z.infer<typeof MeInboxQuerySchema>;

export const PatchMeInboxBodySchema = z.object({
  status: z.enum(["READ", "DISMISSED"]),
});
export type PatchMeInboxBody = z.infer<typeof PatchMeInboxBodySchema>;

export const NotificationIdParamSchema = z.object({ notificationId: z.string().uuid() });

/* --- kpis (ESS-8) ---------------------------------------------------- */

export const MeKpiTargetSchema = z.object({
  positionKpiRequirementId: z.string().uuid(),
  positionId: z.string().uuid(),
  kpiDefinitionId: z.string().uuid(),
  kpiCode: z.string(),
  kpiName: z.string(),
  unit: z.string().nullable(),
  polarity: z.string(),
  targetTemplate: z.record(z.string(), z.unknown()),
  weight: z.string(),
  latestMeasuredValue: z.string().nullable(),
  latestTargetValue: z.string().nullable(),
  latestRecordedAt: z.string().datetime().nullable(),
});
export type MeKpiTarget = z.infer<typeof MeKpiTargetSchema>;

export const MeKpisResponseSchema = z.object({
  items: z.array(MeKpiTargetSchema),
  total: z.number().int().min(0),
});

/* --- certifications (ESS-11) ----------------------------------------- */

export const MeCertificationSchema = z.object({
  userCertificationId: z.string().uuid(),
  name: z.string(),
  issuer: z.string(),
  issuedDate: z.string().nullable(),
  expiresDate: z.string().nullable(),
  credentialId: z.string().nullable(),
  documentUri: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
  userDocumentId: z.string().uuid(),
  kind: z.enum(ME_DOCUMENT_KINDS),
  title: z.string(),
  uri: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MeDocument = z.infer<typeof MeDocumentSchema>;

export const MeDocumentsResponseSchema = z.object({
  items: z.array(MeDocumentSchema),
  total: z.number().int().min(0),
});
