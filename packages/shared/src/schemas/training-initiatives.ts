/**
 * packages/shared/src/schemas/training-initiatives.ts
 * Schemas for /v1/training-initiatives/* (sys.sys_training_initiatives).
 * Tenant-scoped only (training_initiative_tenant_id NOT NULL).
 * No DELETE — use status='CANCELLED' to retire an initiative.
 */

import { z } from "zod";

export const TrainingInitiativeStatusSchema = z.enum([
  "PLANNED",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type TrainingInitiativeStatus = z.infer<typeof TrainingInitiativeStatusSchema>;

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const TrainingInitiativeSchema = z.object({
  trainingInitiativeId: z.uuid(),
  tenantId: z.uuid(),
  moduleId: z.uuid(),
  code: z.string(),
  cohortName: z.string().nullable(),
  startDate: DateOnlySchema,
  endDate: DateOnlySchema.nullable(),
  facilitatorUserId: z.uuid().nullable(),
  status: TrainingInitiativeStatusSchema,
  capacity: z.number().int().nonnegative().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TrainingInitiative = z.infer<typeof TrainingInitiativeSchema>;

export const TrainingInitiativeListQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  moduleId: z.uuid().optional(),
  status: TrainingInitiativeStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TrainingInitiativeListQuery = z.infer<typeof TrainingInitiativeListQuerySchema>;

export const TrainingInitiativeListResponseSchema = z.object({
  items: z.array(TrainingInitiativeSchema),
  total: z.number().int().min(0),
});

export const CreateTrainingInitiativeBodySchema = z.object({
  moduleId: z.uuid(),
  code: z.string().min(1).max(128),
  cohortName: z.string().max(255).nullable().optional(),
  startDate: DateOnlySchema,
  endDate: DateOnlySchema.nullable().optional(),
  facilitatorUserId: z.uuid().nullable().optional(),
  status: TrainingInitiativeStatusSchema.optional().default("PLANNED"),
  capacity: z.number().int().min(0).max(10000).nullable().optional(),
  /** PLATFORM_ADMIN may override; non-platform actors are pinned to own tenant. */
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateTrainingInitiativeBody = z.infer<typeof CreateTrainingInitiativeBodySchema>;

export const UpdateTrainingInitiativeBodySchema = z.object({
  cohortName: z.string().max(255).nullable().optional(),
  startDate: DateOnlySchema.optional(),
  endDate: DateOnlySchema.nullable().optional(),
  facilitatorUserId: z.uuid().nullable().optional(),
  status: TrainingInitiativeStatusSchema.optional(),
  capacity: z.number().int().min(0).max(10000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateTrainingInitiativeBody = z.infer<typeof UpdateTrainingInitiativeBodySchema>;

export const TrainingInitiativeIdParamSchema = z.object({ id: z.uuid() });
