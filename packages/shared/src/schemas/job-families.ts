/**
 * packages/shared/src/schemas/job-families.ts
 * Schemas for /v1/job-families/* (sys.sys_job_families).
 * Platform-level reference (no tenant_id) — PLATFORM_ADMIN manages.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const JobFamilySchema = z.object({
  jobFamilyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobFamily = z.infer<typeof JobFamilySchema>;

export const JobFamilyListQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type JobFamilyListQuery = z.infer<typeof JobFamilyListQuerySchema>;

export const JobFamilyListResponseSchema = z.object({
  items: z.array(JobFamilySchema),
  total: z.number().int().min(0),
});

export const CreateJobFamilyBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateJobFamilyBody = z.infer<typeof CreateJobFamilyBodySchema>;

export const UpdateJobFamilyBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateJobFamilyBody = z.infer<typeof UpdateJobFamilyBodySchema>;

export const JobFamilyIdParamSchema = z.object({ id: z.uuid() });
