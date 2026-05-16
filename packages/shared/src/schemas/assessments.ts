/**
 * packages/shared/src/schemas/assessments.ts
 * Tenant-scoped assessments. No DELETE — use status='CANCELLED'.
 * kind: MANAGER/THREE_SIXTY/PEER/SELF/EXTERNAL.
 * status: OPEN/IN_PROGRESS/COMPLETED/CANCELLED.
 */

import { z } from "zod";

export const AssessmentKindSchema = z.enum([
  "MANAGER",
  "THREE_SIXTY",
  "PEER",
  "SELF",
  "EXTERNAL",
]);
export type AssessmentKind = z.infer<typeof AssessmentKindSchema>;

export const AssessmentStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type AssessmentStatus = z.infer<typeof AssessmentStatusSchema>;

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const AssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  methodId: z.string().uuid().nullable(),
  kind: AssessmentKindSchema,
  periodStart: DateOnlySchema.nullable(),
  periodEnd: DateOnlySchema.nullable(),
  status: AssessmentStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const AssessmentListQuerySchema = z.object({
  subjectUserId: z.string().uuid().optional(),
  methodId: z.string().uuid().optional(),
  kind: AssessmentKindSchema.optional(),
  status: AssessmentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type AssessmentListQuery = z.infer<typeof AssessmentListQuerySchema>;

export const AssessmentListResponseSchema = z.object({
  items: z.array(AssessmentSchema),
  total: z.number().int().min(0),
});

export const CreateAssessmentBodySchema = z.object({
  subjectUserId: z.string().uuid(),
  methodId: z.string().uuid().nullable().optional(),
  kind: AssessmentKindSchema.optional().default("MANAGER"),
  periodStart: DateOnlySchema.nullable().optional(),
  periodEnd: DateOnlySchema.nullable().optional(),
  status: AssessmentStatusSchema.optional().default("OPEN"),
  /** PLATFORM_ADMIN may override; non-platform actors pinned to own tenant. */
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateAssessmentBody = z.infer<typeof CreateAssessmentBodySchema>;

export const UpdateAssessmentBodySchema = z.object({
  methodId: z.string().uuid().nullable().optional(),
  kind: AssessmentKindSchema.optional(),
  periodStart: DateOnlySchema.nullable().optional(),
  periodEnd: DateOnlySchema.nullable().optional(),
  status: AssessmentStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateAssessmentBody = z.infer<typeof UpdateAssessmentBodySchema>;

export const AssessmentIdParamSchema = z.object({ id: z.string().uuid() });
