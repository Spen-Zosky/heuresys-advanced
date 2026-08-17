/**
 * packages/shared/src/schemas/learning-modules.ts
 * Schemas for /v1/learning-modules/* (sys.sys_learning_modules).
 * Global+tenant visibility model (same as skills + kpi-definitions).
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
import { queryBoolean } from "./_query-boolean.js";
export const LEARNING_KIND_VALUES = [
  "COURSE",
  "MICRO_LESSON",
  "LAB",
  "WORKSHOP",
  "CERTIFICATION_PREP",
  "COACHING",
] as const;
export const LearningKindSchema = z.enum(LEARNING_KIND_VALUES);

export const LEARNING_DELIVERY_VALUES = [
  "SELF_PACED",
  "INSTRUCTOR_LED",
  "BLENDED",
  "ON_THE_JOB",
] as const;
/** Esportati come i pari (UserStatus, KpiPolarity, …): apps/web importa TIPI. */
export type LearningKind = (typeof LEARNING_KIND_VALUES)[number];
export type LearningDelivery = (typeof LEARNING_DELIVERY_VALUES)[number];
export const LearningDeliverySchema = z.enum(LEARNING_DELIVERY_VALUES);

export const LearningModuleSchema = z.object({
  learningModuleId: z.uuid(),
  tenantId: z.uuid().nullable(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  kind: LearningKindSchema,
  delivery: LearningDeliverySchema,
  durationMinutes: z.number().int().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LearningModule = z.infer<typeof LearningModuleSchema>;

export const LearningModuleListQuerySchema = z.object({
  isGlobal: queryBoolean().optional(),
  kind: LearningKindSchema.optional(),
  delivery: LearningDeliverySchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type LearningModuleListQuery = z.infer<typeof LearningModuleListQuerySchema>;

export const LearningModuleListResponseSchema = z.object({
  items: z.array(LearningModuleSchema),
  total: z.number().int().min(0),
});

export const CreateLearningModuleBodySchema = z.object({
  code: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  kind: LearningKindSchema.optional().default("COURSE"),
  delivery: LearningDeliverySchema.optional().default("SELF_PACED"),
  durationMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  isGlobal: z.boolean().optional().default(false),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateLearningModuleBody = z.infer<typeof CreateLearningModuleBodySchema>;

export const UpdateLearningModuleBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  kind: LearningKindSchema.optional(),
  delivery: LearningDeliverySchema.optional(),
  durationMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLearningModuleBody = z.infer<typeof UpdateLearningModuleBodySchema>;

export const LearningModuleIdParamSchema = z.object({ id: z.uuid() });
