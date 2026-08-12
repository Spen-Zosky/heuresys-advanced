/**
 * packages/shared/src/schemas/assessments.ts
 * Tenant-scoped assessments. No DELETE — use status='CANCELLED'.
 * kind: MANAGER/THREE_SIXTY/PEER/SELF/EXTERNAL.
 * status: OPEN/IN_PROGRESS/COMPLETED/CANCELLED.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
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
  assessmentId: z.uuid(),
  tenantId: z.uuid(),
  subjectUserId: z.uuid(),
  methodId: z.uuid().nullable(),
  kind: AssessmentKindSchema,
  periodStart: DateOnlySchema.nullable(),
  periodEnd: DateOnlySchema.nullable(),
  status: AssessmentStatusSchema,
  // Opzionale per la MASCHERATURA (#124). MISURATO 2026-08-12: **312 righe su
  // 615** portano `composite_score` qui dentro — il giudizio vive in un campo
  // non tipizzato, dove un mask per-campo non lo vedrebbe. Si toglie INTERO,
  // come gia' fatto per `payload` in compensation: un record libero che
  // dimostrabilmente porta il dato non si maschera a meta'. Stato, soggetto e
  // periodo restano visibili (I20).
  metadata: z.record(z.string(), z.unknown()).optional(),
  masked: z.array(z.string()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export const AssessmentListQuerySchema = z.object({
  subjectUserId: z.uuid().optional(),
  methodId: z.uuid().optional(),
  kind: AssessmentKindSchema.optional(),
  status: AssessmentStatusSchema.optional(),
  ...paginationFields(200, 50),
});
export type AssessmentListQuery = z.infer<typeof AssessmentListQuerySchema>;

export const AssessmentListResponseSchema = z.object({
  items: z.array(AssessmentSchema),
  total: z.number().int().min(0),
});

export const CreateAssessmentBodySchema = z.object({
  subjectUserId: z.uuid(),
  methodId: z.uuid().nullable().optional(),
  kind: AssessmentKindSchema.optional().default("MANAGER"),
  periodStart: DateOnlySchema.nullable().optional(),
  periodEnd: DateOnlySchema.nullable().optional(),
  status: AssessmentStatusSchema.optional().default("OPEN"),
  /** PLATFORM_ADMIN may override; non-platform actors pinned to own tenant. */
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateAssessmentBody = z.infer<typeof CreateAssessmentBodySchema>;

export const UpdateAssessmentBodySchema = z.object({
  methodId: z.uuid().nullable().optional(),
  kind: AssessmentKindSchema.optional(),
  periodStart: DateOnlySchema.nullable().optional(),
  periodEnd: DateOnlySchema.nullable().optional(),
  status: AssessmentStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateAssessmentBody = z.infer<typeof UpdateAssessmentBodySchema>;

export const AssessmentIdParamSchema = z.object({ id: z.uuid() });
