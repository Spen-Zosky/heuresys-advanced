import { z } from "zod";

/**
 * B-10b m2b — normalized engagement cluster read-model (sys_surveys / _questions /
 * _responses / sys_pulse_checks). READ-ONLY analytical surface; the question-level
 * normalization is what distinguishes it from the m2 engagement_* JSONB cluster.
 */

// One normalized survey instance with derived counts.
export const EngagementSurveySchema = z.object({
  surveyId: z.uuid(),
  tenantId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string().nullable(),
  status: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isAnonymous: z.boolean(),
  totalInvitations: z.number().int().nullable(),
  questionCount: z.number().int(),
  responseCount: z.number().int(),
});
export type EngagementSurvey = z.infer<typeof EngagementSurveySchema>;

export const EngagementSurveyListResponseSchema = z.object({
  items: z.array(EngagementSurveySchema),
  total: z.number().int(),
});
export type EngagementSurveyListResponse = z.infer<typeof EngagementSurveyListResponseSchema>;

// Per-question aggregation for a single survey (the normalized value-add).
export const EngagementQuestionResultSchema = z.object({
  questionId: z.uuid(),
  text: z.string(),
  type: z.string().nullable(),
  category: z.string().nullable(),
  displayOrder: z.number().int().nullable(),
  responseCount: z.number().int(),
  avgRating: z.number().nullable(),
});
export type EngagementQuestionResult = z.infer<typeof EngagementQuestionResultSchema>;

export const EngagementSurveyResultsResponseSchema = z.object({
  surveyId: z.uuid(),
  title: z.string(),
  questions: z.array(EngagementQuestionResultSchema),
});
export type EngagementSurveyResultsResponse = z.infer<typeof EngagementSurveyResultsResponseSchema>;

// Pulse-check aggregation bucketed by ISO week.
export const EngagementPulseWeekSchema = z.object({
  weekNumber: z.number().int().nullable(),
  count: z.number().int(),
  avgMood: z.number().nullable(),
  avgWorkload: z.number().nullable(),
  avgSatisfaction: z.number().nullable(),
});
export type EngagementPulseWeek = z.infer<typeof EngagementPulseWeekSchema>;

export const EngagementPulseResponseSchema = z.object({
  items: z.array(EngagementPulseWeekSchema),
  totalChecks: z.number().int(),
});
export type EngagementPulseResponse = z.infer<typeof EngagementPulseResponseSchema>;

export const EngagementSurveyIdParamSchema = z.object({ surveyId: z.uuid() });
export type EngagementSurveyIdParam = z.infer<typeof EngagementSurveyIdParamSchema>;

/* --- survey templates mirror (#6/#10 S996, read-only) ------------------ */

export const EngagementSurveyTemplateSchema = z.object({
  templateId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string().nullable(),
  questionCount: z.number().int(),
  isAnonymous: z.boolean(),
  estimatedMinutes: z.number().int().nullable(),
  isSystem: z.boolean(),
});
export type EngagementSurveyTemplate = z.infer<typeof EngagementSurveyTemplateSchema>;

export const EngagementTemplateListResponseSchema = z.object({
  items: z.array(EngagementSurveyTemplateSchema),
  total: z.number().int(),
});
export type EngagementTemplateListResponse = z.infer<typeof EngagementTemplateListResponseSchema>;
