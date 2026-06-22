/**
 * @heuresys/shared — public platform statistics (GTM one-pager live metrics).
 * Backs the PUBLIC GET /v1/public/platform-stats (no auth, aggregate-only, no PII).
 */
import { z } from "zod";

const count = z.number().int().nonnegative();

export const PlatformStatsResponseSchema = z.object({
  skills: count,
  occupationSkillEdges: count,
  escoOccupationMappings: count,
  users: count,
  positions: count,
  organizationUnits: count,
  teams: count,
  roles: count,
  permissions: count,
  rolePermissionMappings: count,
  uiInterfaces: count,
  activeTenancies: count,
});
export type PlatformStatsResponse = z.infer<typeof PlatformStatsResponseSchema>;
