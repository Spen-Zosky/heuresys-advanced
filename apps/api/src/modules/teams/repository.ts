/**
 * apps/api/src/modules/teams/repository.ts
 * Raw parameterized SQL against sys.sys_teams + sys.sys_team_members.
 * Reads (R1b) + the #75 lifecycle mutations (S1028, ex D-71): create/update
 * team, membership upsert/remove. Multi-statement mutations receive a
 * PoolClient from the service's withTransaction (auth repository pattern).
 */
import type { Pool, PoolClient } from "pg";
import type { Team, TeamDetail, TeamMember, TeamMemberRole } from "@heuresys/shared";

type Db = Pool | PoolClient;

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

/* --- #75 lifecycle mutations (S1028) ------------------------------------- */

/** Team code uniqueness probe within a tenant (mirror of sys_teams_code_uq). */
export async function findTeamByCode(db: Db, tenantId: string, code: string): Promise<{ teamId: string } | null> {
  const res = await db.query<{ team_id: string }>(
    `SELECT team_id FROM sys.sys_teams WHERE team_tenant_id = $1 AND team_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? { teamId: res.rows[0].team_id } : null;
}

/** Users' tenants for same-tenant guards (lead/member must belong to the team's tenant). */
export async function findUserTenant(db: Db, userId: string): Promise<string | null> {
  const res = await db.query<{ t: string | null }>(
    `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1 AND user_status = 'ACTIVE'`,
    [userId],
  );
  return res.rows[0]?.t ?? null;
}

export interface InsertTeamArgs {
  tenantId: string;
  code: string;
  name: string;
  organizationUnitId: string | null;
  leadUserId: string | null;
  isActive: boolean;
  actorUserId: string;
}

export async function insertTeam(db: Db, a: InsertTeamArgs): Promise<string> {
  const res = await db.query<{ team_id: string }>(
    `INSERT INTO sys.sys_teams
       (team_tenant_id, team_code, team_name, team_organization_unit_id,
        team_lead_user_id, team_is_active, team_metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7)
     RETURNING team_id`,
    [a.tenantId, a.code, a.name, a.organizationUnitId, a.leadUserId, a.isActive, a.actorUserId],
  );
  return res.rows[0]!.team_id;
}

export interface UpdateTeamArgs {
  name?: string;
  organizationUnitId?: string | null;
  leadUserId?: string | null;
  isActive?: boolean;
  actorUserId: string;
}

export async function updateTeam(db: Db, teamId: string, a: UpdateTeamArgs): Promise<void> {
  await db.query(
    `UPDATE sys.sys_teams SET
       team_name                 = COALESCE($2, team_name),
       team_organization_unit_id = CASE WHEN $3::boolean THEN $4::uuid ELSE team_organization_unit_id END,
       team_lead_user_id         = CASE WHEN $5::boolean THEN $6::uuid ELSE team_lead_user_id END,
       team_is_active            = COALESCE($7, team_is_active),
       updated_by = $8, updated_at = now()
     WHERE team_id = $1`,
    [
      teamId,
      a.name ?? null,
      a.organizationUnitId !== undefined, a.organizationUnitId ?? null,
      a.leadUserId !== undefined, a.leadUserId ?? null,
      a.isActive ?? null,
      a.actorUserId,
    ],
  );
}

/** Membership upsert (unique (team, user)); returns the resulting role. */
export async function upsertMember(
  db: Db,
  teamId: string,
  userId: string,
  role: TeamMemberRole,
  isActive: boolean,
  actorUserId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO sys.sys_team_members
       (team_member_team_id, team_member_user_id, team_member_role, team_member_is_active, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (team_member_team_id, team_member_user_id) DO UPDATE
       SET team_member_role = EXCLUDED.team_member_role,
           team_member_is_active = EXCLUDED.team_member_is_active,
           updated_by = $5, updated_at = now()`,
    [teamId, userId, role, isActive, actorUserId],
  );
}

/** Demote every LEAD membership row except (optionally) the given user — the
 *  single-lead model: team_lead_user_id and the LEAD row move together. */
export async function demoteOtherLeads(db: Db, teamId: string, keepUserId: string | null, actorUserId: string): Promise<void> {
  await db.query(
    `UPDATE sys.sys_team_members
        SET team_member_role = 'MEMBER', updated_by = $3, updated_at = now()
      WHERE team_member_team_id = $1
        AND team_member_role = 'LEAD'
        AND ($2::uuid IS NULL OR team_member_user_id <> $2)`,
    [teamId, keepUserId, actorUserId],
  );
}

export async function removeMember(db: Db, teamId: string, userId: string): Promise<boolean> {
  const res = await db.query(
    `DELETE FROM sys.sys_team_members WHERE team_member_team_id = $1 AND team_member_user_id = $2`,
    [teamId, userId],
  );
  return (res.rowCount ?? 0) === 1;
}

/** Clears the team lead pointer when the lead's membership is removed. */
export async function clearLeadIfUser(db: Db, teamId: string, userId: string, actorUserId: string): Promise<void> {
  await db.query(
    `UPDATE sys.sys_teams SET team_lead_user_id = NULL, updated_by = $3, updated_at = now()
      WHERE team_id = $1 AND team_lead_user_id = $2`,
    [teamId, userId, actorUserId],
  );
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
