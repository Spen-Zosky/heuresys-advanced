/**
 * apps/api/src/modules/teams/repository.ts
 * Raw parameterized SQL against sys.sys_teams + sys.sys_team_members.
 * Read-only in R1b (teams are derived from the org by the seed; no API mutations yet).
 */
import type { Pool } from "pg";
import type { Team, TeamDetail, TeamMember } from "@heuresys/shared";

interface TeamRow {
  team_id: string;
  team_tenant_id: string;
  team_code: string;
  team_name: string;
  team_organization_unit_id: string | null;
  team_lead_user_id: string | null;
  team_is_active: boolean;
  team_metadata: Record<string, unknown>;
  member_count: string;
  created_at: Date;
  updated_at: Date;
}

function mapTeam(r: TeamRow): Team {
  return {
    teamId: r.team_id,
    tenantId: r.team_tenant_id,
    code: r.team_code,
    name: r.team_name,
    organizationUnitId: r.team_organization_unit_id,
    leadUserId: r.team_lead_user_id,
    isActive: r.team_is_active,
    metadata: r.team_metadata ?? {},
    memberCount: Number(r.member_count),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const TEAM_SELECT = `
  SELECT t.team_id, t.team_tenant_id, t.team_code, t.team_name,
         t.team_organization_unit_id, t.team_lead_user_id, t.team_is_active, t.team_metadata,
         t.created_at, t.updated_at,
         (SELECT count(*) FROM sys.sys_team_members m
           WHERE m.team_member_team_id = t.team_id AND m.team_member_is_active) AS member_count
  FROM sys.sys_teams t`;

export interface ListTeamsArgs {
  /** Tenant filter — undefined = no filter (PLATFORM_ADMIN cross-tenant). */
  tenantId?: string;
  /** The "my team" 3rd scope axis — when set, only teams this user leads or belongs to. */
  memberUserId?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}

export async function listTeams(pool: Pool, args: ListTeamsArgs): Promise<{ items: Team[]; total: number }> {
  // $1 tenant, $2 isActive, $3 memberUserId, $4 limit, $5 offset
  const where = `
    WHERE ($1::uuid IS NULL OR t.team_tenant_id = $1)
      AND ($2::boolean IS NULL OR t.team_is_active = $2)
      AND ($3::uuid IS NULL OR (
            t.team_lead_user_id = $3
            OR EXISTS (SELECT 1 FROM sys.sys_team_members ms
                        WHERE ms.team_member_team_id = t.team_id
                          AND ms.team_member_user_id = $3
                          AND ms.team_member_is_active)
          ))`;
  const params = [
    args.tenantId ?? null,
    args.isActive ?? null,
    args.memberUserId ?? null,
  ];
  const itemsRes = await pool.query<TeamRow>(
    `${TEAM_SELECT} ${where} ORDER BY t.team_code LIMIT $4 OFFSET $5`,
    [...params, args.limit, args.offset],
  );
  const totalRes = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_teams t ${where}`,
    params,
  );
  return {
    items: itemsRes.rows.map(mapTeam),
    total: Number(totalRes.rows[0]?.n ?? 0),
  };
}

export async function findTeamById(pool: Pool, teamId: string): Promise<Team | null> {
  const res = await pool.query<TeamRow>(`${TEAM_SELECT} WHERE t.team_id = $1`, [teamId]);
  const row = res.rows[0];
  return row ? mapTeam(row) : null;
}

interface MemberRow {
  team_member_user_id: string;
  team_member_role: "LEAD" | "MEMBER";
  team_member_is_active: boolean;
  user_email: string | null;
  user_display_name: string | null;
}

export async function loadTeamMembers(pool: Pool, teamId: string): Promise<TeamMember[]> {
  const res = await pool.query<MemberRow>(
    `SELECT m.team_member_user_id, m.team_member_role, m.team_member_is_active,
            u.user_email, u.user_display_name
       FROM sys.sys_team_members m
       LEFT JOIN sys.sys_users u ON u.user_id = m.team_member_user_id
      WHERE m.team_member_team_id = $1
      ORDER BY (m.team_member_role = 'LEAD') DESC, u.user_display_name NULLS LAST`,
    [teamId],
  );
  return res.rows.map((r) => ({
    userId: r.team_member_user_id,
    role: r.team_member_role,
    email: r.user_email,
    fullName: r.user_display_name,
    isActive: r.team_member_is_active,
  }));
}

/** Whether a user leads or belongs to a given team (the "my team" membership check). */
export async function userInTeam(pool: Pool, teamId: string, userId: string): Promise<boolean> {
  const res = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sys.sys_teams t WHERE t.team_id = $1 AND t.team_lead_user_id = $2
       UNION ALL
       SELECT 1 FROM sys.sys_team_members m
         WHERE m.team_member_team_id = $1 AND m.team_member_user_id = $2 AND m.team_member_is_active
     ) AS ok`,
    [teamId, userId],
  );
  return res.rows[0]?.ok ?? false;
}

/** The caller's own teams (lead or member), each with its full member list — backs /v1/me/team. */
export async function findTeamsForUser(pool: Pool, userId: string): Promise<TeamDetail[]> {
  const res = await pool.query<TeamRow>(
    `${TEAM_SELECT}
      WHERE t.team_lead_user_id = $1
         OR EXISTS (SELECT 1 FROM sys.sys_team_members ms
                     WHERE ms.team_member_team_id = t.team_id
                       AND ms.team_member_user_id = $1
                       AND ms.team_member_is_active)
      ORDER BY t.team_code`,
    [userId],
  );
  if (res.rows.length === 0) return [];

  // Batched member load (was N+1: one loadTeamMembers() call per team). A single
  // query over all the caller's team ids, grouped in JS — keeping the identical
  // per-team member ordering ((role='LEAD') DESC, display_name NULLS LAST).
  const teamIds = res.rows.map((r) => r.team_id);
  const membersByTeam = await loadTeamMembersBatch(pool, teamIds);
  return res.rows.map((row) => ({
    ...mapTeam(row),
    members: membersByTeam.get(row.team_id) ?? [],
  }));
}

/**
 * Loads members for many teams in a single query (collapses the /v1/me/team N+1).
 * Returns a map team_id → ordered member list, each list ordered exactly like
 * loadTeamMembers() ((role='LEAD') DESC, display_name NULLS LAST). The SQL
 * orders by team first so JS grouping preserves per-team member order.
 */
async function loadTeamMembersBatch(
  pool: Pool,
  teamIds: string[],
): Promise<Map<string, TeamMember[]>> {
  const res = await pool.query<MemberRow & { team_member_team_id: string }>(
    `SELECT m.team_member_team_id, m.team_member_user_id, m.team_member_role, m.team_member_is_active,
            u.user_email, u.user_display_name
       FROM sys.sys_team_members m
       LEFT JOIN sys.sys_users u ON u.user_id = m.team_member_user_id
      WHERE m.team_member_team_id = ANY($1)
      ORDER BY m.team_member_team_id, (m.team_member_role = 'LEAD') DESC, u.user_display_name NULLS LAST`,
    [teamIds],
  );
  const byTeam = new Map<string, TeamMember[]>();
  for (const r of res.rows) {
    let list = byTeam.get(r.team_member_team_id);
    if (!list) {
      list = [];
      byTeam.set(r.team_member_team_id, list);
    }
    list.push({
      userId: r.team_member_user_id,
      role: r.team_member_role,
      email: r.user_email,
      fullName: r.user_display_name,
      isActive: r.team_member_is_active,
    });
  }
  return byTeam;
}
