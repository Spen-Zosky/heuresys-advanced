/**
 * apps/api/src/modules/dashboard/repository.ts
 * Aggregate read-only queries for GET /v1/dashboard/widgets.
 * No writes; composed at request time from existing sys.* tables.
 */

import type { Pool, PoolClient } from "pg";
import type {
  DashboardCounters,
  DashboardLearningDeadline,
  DashboardRecentActivity,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

export interface ScopeFilter {
  /** When set, all counters are filtered to this tenant. */
  tenantId: string | null;
  /** When set, counters are further constrained to positions in this set (MANAGER team scope). */
  teamPositionIds: string[];
  /** Include cross-tenant counters (tenants/blueprints) only for PLATFORM. */
  isPlatformScope: boolean;
}

function tenantClause(scope: ScopeFilter, paramOffset: number): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  if (scope.tenantId) {
    params.push(scope.tenantId);
    return { sql: `$${paramOffset}`, params };
  }
  return { sql: "NULL", params };
}

export async function getDashboardCounters(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<DashboardCounters> {
  // Use 1 query per counter (clear + tenant-isolated). The aggregate is
  // small (158 positions in test seed) so this is fine for MVP.
  let userCount: number;
  let positionCount: number;
  let ouCount: number;
  let learningPathCount: number;
  let learningGapCount: number;

  if (scope.teamPositionIds.length > 0) {
    // MANAGER scope: only the subordinate positions' incumbents + learning content tied to those positions.
    const r1 = await q.query<{ c: string }>(
      `SELECT count(DISTINCT a.user_position_assignment_user_id)::text AS c
         FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_position_id = ANY($1::uuid[])
          AND a.user_position_assignment_status = 'ACTIVE'`,
      [scope.teamPositionIds],
    );
    userCount = Number(r1.rows[0]?.c ?? 0);

    positionCount = scope.teamPositionIds.length;

    const r3 = await q.query<{ c: string }>(
      `SELECT count(DISTINCT position_organization_unit_id)::text AS c
         FROM sys.sys_positions
        WHERE position_id = ANY($1::uuid[])
          AND position_organization_unit_id IS NOT NULL`,
      [scope.teamPositionIds],
    );
    ouCount = Number(r3.rows[0]?.c ?? 0);

    const r4 = await q.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM sys.sys_learning_paths
        WHERE learning_path_tenant_id = $1`,
      [scope.tenantId],
    );
    learningPathCount = Number(r4.rows[0]?.c ?? 0);

    const r5 = await q.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM sys.sys_learning_gaps lg
         JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_user_id = lg.learning_gap_user_id
        WHERE a.user_position_assignment_position_id = ANY($1::uuid[])
          AND a.user_position_assignment_status = 'ACTIVE'`,
      [scope.teamPositionIds],
    );
    learningGapCount = Number(r5.rows[0]?.c ?? 0);
  } else if (scope.tenantId) {
    // TENANT / HRMS_MANAGER / BLUEPRINT_MANAGER scope: own-tenant counters.
    const r = await q.query<{
      users: string;
      positions: string;
      ous: string;
      learning_paths: string;
      learning_gaps: string;
    }>(
      `SELECT
         (SELECT count(*) FROM sys.sys_users WHERE user_tenant_id = $1)::text AS users,
         (SELECT count(*) FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_is_active = true)::text AS positions,
         (SELECT count(*) FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1)::text AS ous,
         (SELECT count(*) FROM sys.sys_learning_paths WHERE learning_path_tenant_id = $1)::text AS learning_paths,
         (SELECT count(*) FROM sys.sys_learning_gaps WHERE learning_gap_tenant_id = $1)::text AS learning_gaps`,
      [scope.tenantId],
    );
    const row = r.rows[0]!;
    userCount = Number(row.users);
    positionCount = Number(row.positions);
    ouCount = Number(row.ous);
    learningPathCount = Number(row.learning_paths);
    learningGapCount = Number(row.learning_gaps);
  } else {
    // PLATFORM scope: cross-tenant counters.
    const r = await q.query<{
      users: string;
      positions: string;
      ous: string;
      learning_paths: string;
      learning_gaps: string;
    }>(
      `SELECT
         (SELECT count(*) FROM sys.sys_users)::text AS users,
         (SELECT count(*) FROM sys.sys_positions WHERE position_is_active = true)::text AS positions,
         (SELECT count(*) FROM sys.sys_organization_units)::text AS ous,
         (SELECT count(*) FROM sys.sys_learning_paths)::text AS learning_paths,
         (SELECT count(*) FROM sys.sys_learning_gaps)::text AS learning_gaps`,
    );
    const row = r.rows[0]!;
    userCount = Number(row.users);
    positionCount = Number(row.positions);
    ouCount = Number(row.ous);
    learningPathCount = Number(row.learning_paths);
    learningGapCount = Number(row.learning_gaps);
  }

  // Platform-only counters.
  let tenantsCount: number | null = null;
  let blueprintsCount: number | null = null;
  if (scope.isPlatformScope) {
    const r = await q.query<{ tenants: string; blueprints: string }>(
      `SELECT
         (SELECT count(*) FROM sys.sys_tenancies)::text AS tenants,
         (SELECT count(*) FROM sys.sys_blueprint_variants)::text AS blueprints`,
    );
    tenantsCount = Number(r.rows[0]?.tenants ?? 0);
    blueprintsCount = Number(r.rows[0]?.blueprints ?? 0);
  } else if (scope.tenantId) {
    // Tenant-scoped blueprints: count active blueprint activations for this tenant.
    const r = await q.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM sys.sys_blueprint_activations
        WHERE blueprint_activation_tenant_id = $1`,
      [scope.tenantId],
    );
    blueprintsCount = Number(r.rows[0]?.c ?? 0);
  }

  // HRMS_MANAGER+ tenant-scoped: pending compensation recommendations.
  let pendingRecommendations: number | null = null;
  if (scope.tenantId) {
    const r = await q.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM sys.sys_compensation_recommendations
        WHERE compensation_recommendation_tenant_id = $1
          AND compensation_recommendation_signal = 'PROPOSED'`,
      [scope.tenantId],
    );
    pendingRecommendations = Number(r.rows[0]?.c ?? 0);
  }

  return {
    tenants: tenantsCount,
    users: userCount,
    positions: positionCount,
    organizationUnits: ouCount,
    learningPaths: learningPathCount,
    learningGaps: learningGapCount,
    blueprints: blueprintsCount,
    pendingRecommendations,
  };
}

export async function getUpcomingLearningDeadlines(
  q: DbConnector,
  scope: ScopeFilter,
  limit: number,
): Promise<DashboardLearningDeadline[]> {
  const where: string[] = ["lg.learning_gap_severity IN ('HIGH', 'CRITICAL')"];
  const params: unknown[] = [];
  if (scope.tenantId) {
    params.push(scope.tenantId);
    where.push(`lg.learning_gap_tenant_id = $${params.length}`);
  }
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    where.push(`a.user_position_assignment_position_id = ANY($${params.length}::uuid[])`);
  }
  params.push(limit);
  const limIdx = params.length;

  const r = await q.query<{
    learning_gap_id: string;
    user_id: string;
    user_display_name: string;
    position_id: string | null;
    position_title: string | null;
    skill_id: string | null;
    skill_name: string | null;
    severity: string;
    detected_at: Date;
  }>(
    `SELECT
       lg.learning_gap_id,
       lg.learning_gap_user_id   AS user_id,
       u.user_display_name,
       COALESCE(lg.learning_gap_position_id, a.user_position_assignment_position_id) AS position_id,
       p.position_title,
       lg.learning_gap_skill_id AS skill_id,
       s.skill_name,
       lg.learning_gap_severity AS severity,
       lg.learning_gap_detected_at AS detected_at
     FROM sys.sys_learning_gaps lg
     JOIN sys.sys_users u ON u.user_id = lg.learning_gap_user_id
     LEFT JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = lg.learning_gap_user_id
      AND a.user_position_assignment_status = 'ACTIVE'
      AND a.user_position_assignment_kind = 'PRIMARY'
     LEFT JOIN sys.sys_positions p
       ON p.position_id = COALESCE(lg.learning_gap_position_id, a.user_position_assignment_position_id)
     LEFT JOIN sys.sys_skills s
       ON s.skill_id = lg.learning_gap_skill_id
     WHERE ${where.join(" AND ")}
     ORDER BY
       CASE lg.learning_gap_severity WHEN 'CRITICAL' THEN 0 ELSE 1 END,
       lg.learning_gap_detected_at DESC
     LIMIT $${limIdx}`,
    params,
  );

  return r.rows.map((row) => ({
    learningGapId: row.learning_gap_id,
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    positionId: row.position_id,
    positionTitle: row.position_title,
    skillId: row.skill_id,
    skillName: row.skill_name,
    severity: row.severity,
    detectedAt: row.detected_at.toISOString(),
  }));
}

export async function getRecentActivity(
  q: DbConnector,
  scope: ScopeFilter,
  limit: number,
): Promise<DashboardRecentActivity[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (scope.tenantId) {
    params.push(scope.tenantId);
    where.push(`tenant_id = $${params.length}`);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  params.push(limit);
  const limIdx = params.length;

  const r = await q.query<{
    kind: string;
    occurred_at: Date;
    summary: string;
    resource_id: string;
  }>(
    `WITH events AS (
       SELECT 'USER_CREATED'::text AS kind,
              created_at AS occurred_at,
              'User created: ' || user_display_name AS summary,
              user_id AS resource_id,
              user_tenant_id AS tenant_id
         FROM sys.sys_users
       UNION ALL
       SELECT 'POSITION_CREATED'::text AS kind,
              created_at AS occurred_at,
              'Position created: ' || position_title AS summary,
              position_id AS resource_id,
              position_tenant_id AS tenant_id
         FROM sys.sys_positions
     )
     SELECT kind, occurred_at, summary, resource_id
       FROM events
       ${whereSql}
       ORDER BY occurred_at DESC
       LIMIT $${limIdx}`,
    params,
  );

  return r.rows.map((row) => ({
    kind: row.kind as DashboardRecentActivity["kind"],
    occurredAt: row.occurred_at.toISOString(),
    summary: row.summary,
    resourceId: row.resource_id,
  }));
}

export async function findOwnedPositionIds(
  q: DbConnector,
  ownerUserId: string,
): Promise<string[]> {
  const r = await q.query<{ position_id: string }>(
    `SELECT position_id FROM sys.sys_positions
      WHERE position_owner_user_id = $1
        AND position_is_active = true`,
    [ownerUserId],
  );
  return r.rows.map((x) => x.position_id);
}
