/**
 * packages/shared/src/schemas/seed-acquisition-runs.ts
 * Tenant-scoped run records for AI-assisted seed data acquisition.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SEED_ACQUISITION_RUN_STATUS_VALUES = [
  "RUNNING", "COMPLETED", "FAILED", "CANCELLED",
] as const;
export const SeedAcquisitionRunStatusSchema = z.enum(SEED_ACQUISITION_RUN_STATUS_VALUES);
export type SeedAcquisitionRunStatus = z.infer<typeof SeedAcquisitionRunStatusSchema>;

export const SeedAcquisitionRunSchema = z.object({
  seedAcquisitionRunId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  promptTemplate: z.string().nullable(),
  sourceRegistryPayload: z.array(z.unknown()),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  status: SeedAcquisitionRunStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SeedAcquisitionRun = z.infer<typeof SeedAcquisitionRunSchema>;

export const SeedAcquisitionRunListQuerySchema = z.object({
  status: SeedAcquisitionRunStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type SeedAcquisitionRunListQuery = z.infer<typeof SeedAcquisitionRunListQuerySchema>;

export const SeedAcquisitionRunListResponseSchema = z.object({
  items: z.array(SeedAcquisitionRunSchema), total: z.number().int().min(0),
});

export const CreateSeedAcquisitionRunBodySchema = z.object({
  code: z.string().min(1).max(128),
  promptTemplate: z.string().max(16384).nullable().optional(),
  sourceRegistryPayload: z.array(z.unknown()).optional().default([]),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSeedAcquisitionRunBody = z.infer<typeof CreateSeedAcquisitionRunBodySchema>;

export const UpdateSeedAcquisitionRunBodySchema = z.object({
  status: SeedAcquisitionRunStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSeedAcquisitionRunBody = z.infer<typeof UpdateSeedAcquisitionRunBodySchema>;

export const SeedAcquisitionRunIdParamSchema = z.object({ id: z.uuid() });
