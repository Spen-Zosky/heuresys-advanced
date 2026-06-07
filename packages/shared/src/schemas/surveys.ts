/**
 * @heuresys/shared — surveys / engagement schemas (SDBI B-10b m2, S971).
 * Backs /v1/surveys/* over sys.sys_engagement_survey_templates / sys_engagement_surveys /
 * sys_engagement_survey_responses.
 * Visibility: tenant-scoped (non-PLATFORM_ADMIN sees only own tenant; PLATFORM_ADMIN sees all).
 * responses are an immutable read-only event log; templates/surveys are full CRUD.
 * Zod v4 API (z.uuid()/z.iso.datetime()/z.record(z.string(), z.unknown())).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

// ─────────────────────────── Templates ───────────────────────────
export const SurveyTemplateCategoryEnum = z.enum([
  "engagement", "wellbeing", "exit", "onboarding", "custom",
]);

export const SurveyTemplateSchema = z.object({
  templateId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: SurveyTemplateCategoryEnum,
  questions: z.union([z.array(z.unknown()), META]),
  isSystem: z.boolean(),
  createdByUserId: z.uuid().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SurveyTemplate = z.infer<typeof SurveyTemplateSchema>;

export const SurveyTemplateListQuerySchema = z.object({
  category: SurveyTemplateCategoryEnum.optional(),
  isSystem: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SurveyTemplateListQuery = z.infer<typeof SurveyTemplateListQuerySchema>;

export const SurveyTemplateListResponseSchema = z.object({
  items: z.array(SurveyTemplateSchema),
  total: z.number().int().min(0),
});

export const CreateSurveyTemplateBodySchema = z.object({
  tenantId: z.uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  category: SurveyTemplateCategoryEnum.optional().default("custom"),
  questions: z.union([z.array(z.unknown()), META]).optional().default([]),
  isSystem: z.boolean().optional().default(false),
  createdByUserId: z.uuid().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateSurveyTemplateBody = z.infer<typeof CreateSurveyTemplateBodySchema>;

export const UpdateSurveyTemplateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  category: SurveyTemplateCategoryEnum.optional(),
  questions: z.union([z.array(z.unknown()), META]).optional(),
  isSystem: z.boolean().optional(),
  metadata: META.optional(),
});
export type UpdateSurveyTemplateBody = z.infer<typeof UpdateSurveyTemplateBodySchema>;

// ─────────────────────────── Surveys ───────────────────────────
export const SurveyStatusEnum = z.enum(["draft", "active", "closed"]);
export const SurveyAudienceTypeEnum = z.enum([
  "all", "department", "org_unit", "location", "custom",
]);

export const SurveySchema = z.object({
  surveyId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  templateId: z.uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  questions: z.union([z.array(z.unknown()), META]),
  status: SurveyStatusEnum,
  audienceType: SurveyAudienceTypeEnum,
  audienceIds: z.array(z.uuid()).nullable(),
  isAnonymous: z.boolean(),
  totalInvitations: z.number().int(),
  totalResponses: z.number().int(),
  createdByUserId: z.uuid().nullable(),
  startDate: z.iso.datetime().nullable(),
  endDate: z.iso.datetime().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Survey = z.infer<typeof SurveySchema>;

export const SurveyListQuerySchema = z.object({
  status: SurveyStatusEnum.optional(),
  audienceType: SurveyAudienceTypeEnum.optional(),
  templateId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SurveyListQuery = z.infer<typeof SurveyListQuerySchema>;

export const SurveyListResponseSchema = z.object({
  items: z.array(SurveySchema),
  total: z.number().int().min(0),
});

export const CreateSurveyBodySchema = z.object({
  tenantId: z.uuid().optional(),
  templateId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  questions: z.union([z.array(z.unknown()), META]).optional().default([]),
  status: SurveyStatusEnum.optional().default("draft"),
  audienceType: SurveyAudienceTypeEnum.optional().default("all"),
  audienceIds: z.array(z.uuid()).nullable().optional(),
  isAnonymous: z.boolean().optional().default(false),
  totalInvitations: z.number().int().min(0).optional().default(0),
  totalResponses: z.number().int().min(0).optional().default(0),
  createdByUserId: z.uuid().nullable().optional(),
  startDate: z.iso.datetime().nullable().optional(),
  endDate: z.iso.datetime().nullable().optional(),
  metadata: META.optional().default({}),
});
export type CreateSurveyBody = z.infer<typeof CreateSurveyBodySchema>;

export const UpdateSurveyBodySchema = z.object({
  templateId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  questions: z.union([z.array(z.unknown()), META]).optional(),
  status: SurveyStatusEnum.optional(),
  audienceType: SurveyAudienceTypeEnum.optional(),
  audienceIds: z.array(z.uuid()).nullable().optional(),
  isAnonymous: z.boolean().optional(),
  totalInvitations: z.number().int().min(0).optional(),
  totalResponses: z.number().int().min(0).optional(),
  startDate: z.iso.datetime().nullable().optional(),
  endDate: z.iso.datetime().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateSurveyBody = z.infer<typeof UpdateSurveyBodySchema>;

// ─────────────────────────── Responses (read-only event log) ───────────────────────────
export const SurveyResponseSchema = z.object({
  responseId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  surveyId: z.uuid(),
  subjectUserId: z.uuid().nullable(),
  answers: z.union([z.array(z.unknown()), META]),
  isComplete: z.boolean(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;

export const SurveyResponseListQuerySchema = z.object({
  subjectUserId: z.uuid().optional(),
  isComplete: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SurveyResponseListQuery = z.infer<typeof SurveyResponseListQuerySchema>;

export const SurveyResponseListResponseSchema = z.object({
  items: z.array(SurveyResponseSchema),
  total: z.number().int().min(0),
});

// ─────────────────────────── Shared params ───────────────────────────
export const SurveyIdParamSchema = z.object({ id: z.uuid() });
