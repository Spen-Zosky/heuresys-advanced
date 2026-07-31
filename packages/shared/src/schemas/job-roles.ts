/**
 * packages/shared/src/schemas/job-roles.ts
 * Schemas for /v1/job-roles/* (sys.sys_job_roles).
 * Platform-level reference. References sys.sys_job_families.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const JOB_ROLE_SENIORITY_VALUES = [
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "EXECUTIVE",
] as const;
/** Esportato come i pari (UserStatus, PositionCriticality): apps/web importa
 *  TIPI, non valori, e senza questo dovrebbe riscrivere l'unione a mano. */
export type JobRoleSeniority = (typeof JOB_ROLE_SENIORITY_VALUES)[number];
export const JobRoleSenioritySchema = z.enum(JOB_ROLE_SENIORITY_VALUES);

export const JobRoleSchema = z.object({
  jobRoleId: z.uuid(),
  // ADR-0015: nullable for legacy-imported job_roles lacking canonical family
  // (CW-B26 Semantic FK Phantom). Migration 000038 made the DB column nullable.
  jobFamilyId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seniorityLevel: JobRoleSenioritySchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobRole = z.infer<typeof JobRoleSchema>;

export const JobRoleListQuerySchema = z.object({
  jobFamilyId: z.uuid().optional(),
  seniorityLevel: JobRoleSenioritySchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type JobRoleListQuery = z.infer<typeof JobRoleListQuerySchema>;

export const JobRoleListResponseSchema = z.object({
  items: z.array(JobRoleSchema),
  total: z.number().int().min(0),
});

export const CreateJobRoleBodySchema = z.object({
  // ADR-0015: nullable + optional. Clients can omit OR pass null when family
  // is unknown (legacy import semantic per CW-B26).
  jobFamilyId: z.uuid().nullable().optional(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  seniorityLevel: JobRoleSenioritySchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateJobRoleBody = z.infer<typeof CreateJobRoleBodySchema>;

export const UpdateJobRoleBodySchema = z.object({
  jobFamilyId: z.uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  seniorityLevel: JobRoleSenioritySchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateJobRoleBody = z.infer<typeof UpdateJobRoleBodySchema>;

export const JobRoleIdParamSchema = z.object({ id: z.uuid() });
