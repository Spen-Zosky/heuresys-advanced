/**
 * packages/shared/src/schemas/job-roles.ts
 * Schemas for /v1/job-roles/* (sys.sys_job_roles).
 * Platform-level reference. References sys.sys_job_families.
 */

import { z } from "zod";

export const JOB_ROLE_SENIORITY_VALUES = [
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "EXECUTIVE",
] as const;
export const JobRoleSenioritySchema = z.enum(JOB_ROLE_SENIORITY_VALUES);

export const JobRoleSchema = z.object({
  jobRoleId: z.string().uuid(),
  jobFamilyId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seniorityLevel: JobRoleSenioritySchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type JobRole = z.infer<typeof JobRoleSchema>;

export const JobRoleListQuerySchema = z.object({
  jobFamilyId: z.string().uuid().optional(),
  seniorityLevel: JobRoleSenioritySchema.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type JobRoleListQuery = z.infer<typeof JobRoleListQuerySchema>;

export const JobRoleListResponseSchema = z.object({
  items: z.array(JobRoleSchema),
  total: z.number().int().min(0),
});

export const CreateJobRoleBodySchema = z.object({
  jobFamilyId: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  seniorityLevel: JobRoleSenioritySchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateJobRoleBody = z.infer<typeof CreateJobRoleBodySchema>;

export const UpdateJobRoleBodySchema = z.object({
  jobFamilyId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  seniorityLevel: JobRoleSenioritySchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateJobRoleBody = z.infer<typeof UpdateJobRoleBodySchema>;

export const JobRoleIdParamSchema = z.object({ id: z.string().uuid() });
