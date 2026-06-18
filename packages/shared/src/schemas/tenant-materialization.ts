/**
 * @heuresys/shared — #4 WI-C: tenant materialization generator.
 * Backs POST /v1/tenant-materialization (+ GET /archetypes). Given a deterministic
 * archetype, generate org-units + positions for a target tenant (Phase B instance),
 * idempotently (ON CONFLICT). PLATFORM_ADMIN-gated; the target tenant must exist and be
 * ACTIVE (M-1 tenant isolation: every row is tagged with the validated tenant_id, I5).
 * Slice-1 materializes org-units + positions only; users/assignments/skills/KPI = residuo.
 */
import { z } from "zod";

export const MaterializeModeEnum = z.enum(["plan", "apply"]);
export type MaterializeMode = z.infer<typeof MaterializeModeEnum>;

export const MaterializeRequestBodySchema = z.object({
  tenantId: z.uuid(),
  archetypeKey: z.string().min(1).max(64),
  mode: MaterializeModeEnum,
});
export type MaterializeRequestBody = z.infer<typeof MaterializeRequestBodySchema>;

const MaterializeCountsSchema = z.object({
  orgUnits: z.number().int(),
  positions: z.number().int(),
});
export type MaterializeCounts = z.infer<typeof MaterializeCountsSchema>;

export const MaterializeResultSchema = z.object({
  tenantId: z.uuid(),
  archetypeKey: z.string(),
  mode: MaterializeModeEnum,
  /** plan → would-create; apply → actually created (ON CONFLICT inserted). */
  created: MaterializeCountsSchema,
  /** already existed → skipped (idempotent re-run). */
  skipped: MaterializeCountsSchema,
  /** archetype size. created + skipped == total. */
  total: MaterializeCountsSchema,
});
export type MaterializeResult = z.infer<typeof MaterializeResultSchema>;

export const ArchetypeSummarySchema = z.object({
  key: z.string(),
  label: z.string(),
  orgUnitCount: z.number().int(),
  positionCount: z.number().int(),
});
export const ArchetypeListResponseSchema = z.object({
  items: z.array(ArchetypeSummarySchema),
});
export type ArchetypeListResponse = z.infer<typeof ArchetypeListResponseSchema>;
