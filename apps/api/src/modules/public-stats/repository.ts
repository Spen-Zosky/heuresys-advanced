/**
 * apps/api/src/modules/public-stats/repository.ts — aggregate-only counts for
 * the public GTM one-pager. No PII, no row data; every figure is a count(*).
 */
import { pool } from "../../db/client.js";
import type { PlatformStatsResponse } from "@heuresys/shared";

export async function fetchStats(): Promise<PlatformStatsResponse> {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM sys.sys_skills)                          AS skills,
      (SELECT count(*) FROM sys.sys_occupation_skill_requirements)   AS occupation_skill_edges,
      (SELECT count(*) FROM sys.sys_esco_occupation_mappings)        AS esco_occupation_mappings,
      (SELECT count(*) FROM sys.sys_users)                           AS users,
      (SELECT count(*) FROM sys.sys_positions)                       AS positions,
      (SELECT count(*) FROM sys.sys_organization_units)              AS organization_units,
      (SELECT count(*) FROM sys.sys_teams)                           AS teams,
      (SELECT count(*) FROM sys.sys_auth_roles)                      AS roles,
      (SELECT count(*) FROM sys.sys_auth_permissions)                AS permissions,
      (SELECT count(*) FROM sys.sys_auth_role_permissions)           AS role_permission_mappings,
      (SELECT count(*) FROM sys.sys_ui_interfaces)                   AS ui_interfaces,
      (SELECT count(DISTINCT user_tenant_id) FROM sys.sys_users)     AS active_tenancies
  `);
  const r = rows[0] as Record<string, string>;
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    skills: n("skills"),
    occupationSkillEdges: n("occupation_skill_edges"),
    escoOccupationMappings: n("esco_occupation_mappings"),
    users: n("users"),
    positions: n("positions"),
    organizationUnits: n("organization_units"),
    teams: n("teams"),
    roles: n("roles"),
    permissions: n("permissions"),
    rolePermissionMappings: n("role_permission_mappings"),
    uiInterfaces: n("ui_interfaces"),
    activeTenancies: n("active_tenancies"),
  };
}
