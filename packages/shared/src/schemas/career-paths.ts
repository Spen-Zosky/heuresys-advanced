/**
 * packages/shared/src/schemas/career-paths.ts
 * Curated mobility tracks. Global+tenant visibility.
 * kind: VERTICAL / LATERAL / SPECIALIST / MANAGERIAL / CROSS_FUNCTIONAL.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const CAREER_PATH_KIND_VALUES = [
  "VERTICAL",
  "LATERAL",
  "SPECIALIST",
  "MANAGERIAL",
  "CROSS_FUNCTIONAL",
] as const;
export const CareerPathKindSchema = z.enum(CAREER_PATH_KIND_VALUES);
export type CareerPathKind = z.infer<typeof CareerPathKindSchema>;

export const CareerPathSchema = z.object({
  careerPathId: z.uuid(),
  tenantId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  kind: CareerPathKindSchema,
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CareerPath = z.infer<typeof CareerPathSchema>;

export const CareerPathListQuerySchema = z.object({
  isGlobal: z.coerce.boolean().optional(),
  kind: CareerPathKindSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type CareerPathListQuery = z.infer<typeof CareerPathListQuerySchema>;

export const CareerPathListResponseSchema = z.object({
  items: z.array(CareerPathSchema),
  total: z.number().int().min(0),
});

export const CreateCareerPathBodySchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  kind: CareerPathKindSchema.optional().default("VERTICAL"),
  isGlobal: z.boolean().optional().default(false),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateCareerPathBody = z.infer<typeof CreateCareerPathBodySchema>;

export const UpdateCareerPathBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  kind: CareerPathKindSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateCareerPathBody = z.infer<typeof UpdateCareerPathBodySchema>;

export const CareerPathIdParamSchema = z.object({ id: z.uuid() });
