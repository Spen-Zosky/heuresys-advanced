/**
 * apps/api/src/modules/users/repository.ts
 * Raw parameterised SQL for sys.sys_users + sys.sys_user_auth_roles + the
 * MANAGER team lookup via sys.sys_user_position_assignments and
 * sys.sys_positions.position_reports_to_position_id.
 *
 * Per AUTH_SECURITY_PLAN §6 + TARGET_SCHEMA_DESIGN.
 */

import type { Pool, PoolClient } from "pg";
import type {
  User,
  UserListQuery,
  CreateUserBody,
  UpdateUserBody,
  RoleGrant,
  UserStatus,
  UserType,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface RawUserRow {
  user_id: string;
  user_tenant_id: string;
  user_email: string;
  user_display_name: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_external_code: string | null;
  user_status: string;
  user_type: string;
  user_locale: string | null;
  user_timezone: string | null;
  user_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function rowToUser(r: RawUserRow): User {
  return {
    userId: r.user_id,
    tenantId: r.user_tenant_id,
    email: r.user_email,
    displayName: r.user_display_name,
    firstName: r.user_first_name,
    lastName: r.user_last_name,
    externalCode: r.user_external_code,
    status: r.user_status as UserStatus,
    type: r.user_type as UserType,
    locale: r.user_locale,
    timezone: r.user_timezone,
    metadata: r.user_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const USER_COLS = `user_id, user_tenant_id, user_email, user_display_name,
       user_first_name, user_last_name, user_external_code,
       user_status, user_type,
       user_locale, user_timezone, user_metadata,
       created_at, updated_at`;

/* === Listing + scope ===================================================== */

export interface ListFilter {
  /** Restrict to this tenant (TENANT_ADMIN / MANAGER / USER). undefined = no tenant filter (PLATFORM_ADMIN). */
  tenantId?: string;
  /** Restrict to this set of userIds (MANAGER team, USER self). undefined = no id restriction. */
  userIdAllowList?: string[];
  query: UserListQuery;
}

export async function listUsers(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: User[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`user_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) {
      // Empty allow-list = nobody is visible. Short-circuit.
      return { items: [], total: 0 };
    }
    params.push(filter.userIdAllowList);
    where.push(`user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`user_status = $${params.length}`);
  }
  if (filter.query.type) {
    params.push(filter.query.type);
    where.push(`user_type = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_users ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limitIdx = params.length;
  params.push(filter.query.offset);
  const offsetIdx = params.length;

  const res = await q.query<RawUserRow>(
    `SELECT ${USER_COLS}
       FROM sys.sys_users
       ${whereClause}
      ORDER BY user_email
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  return { items: res.rows.map(rowToUser), total };
}

export async function findUserById(
  q: DbConnector,
  userId: string,
): Promise<User | null> {
  const res = await q.query<RawUserRow>(
    `SELECT ${USER_COLS} FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function findUserByEmailInTenant(
  q: DbConnector,
  tenantId: string,
  email: string,
): Promise<User | null> {
  const res = await q.query<RawUserRow>(
    `SELECT ${USER_COLS} FROM sys.sys_users
      WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
    [tenantId, email],
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

/* === MANAGER team lookup ================================================ */

/**
 * Returns the set of user_ids that are subordinates of `managerUserId` —
 * users assigned (PRIMARY ACTIVE) to a position whose
 * position_reports_to_position_id is one of the manager's own ACTIVE
 * positions.
 *
 * The manager themselves is always included in the returned set so
 * `MANAGER can read self via the same code path that handles team.
 */
export async function getManagerTeamUserIds(
  q: DbConnector,
  managerUserId: string,
): Promise<string[]> {
  const res = await q.query<{ user_id: string }>(
    `WITH mgr_positions AS (
       SELECT user_position_assignment_position_id AS position_id
         FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = $1
          AND user_position_assignment_status = 'ACTIVE'
     )
     SELECT DISTINCT upa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments upa
       JOIN sys.sys_positions p ON p.position_id = upa.user_position_assignment_position_id
      WHERE upa.user_position_assignment_status = 'ACTIVE'
        AND p.position_reports_to_position_id IN (SELECT position_id FROM mgr_positions)
     UNION
     SELECT $1::uuid AS user_id`,
    [managerUserId],
  );
  return res.rows.map((r) => r.user_id);
}

/* === Create ============================================================ */

export async function insertUser(
  q: DbConnector,
  tenantId: string,
  body: CreateUserBody,
): Promise<User> {
  const res = await q.query<RawUserRow>(
    `INSERT INTO sys.sys_users (
        user_tenant_id, user_email, user_display_name,
        user_first_name, user_last_name, user_external_code,
        user_status, user_type,
        user_locale, user_timezone, user_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING ${USER_COLS}`,
    [
      tenantId,
      body.email,
      body.displayName,
      body.firstName ?? null,
      body.lastName ?? null,
      body.externalCode ?? null,
      body.status,
      body.type,
      body.locale ?? null,
      body.timezone ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return rowToUser(res.rows[0]!);
}

/* === Update (partial) ================================================== */

export async function updateUserPartial(
  q: DbConnector,
  userId: string,
  patch: UpdateUserBody,
): Promise<User | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.email !== undefined) addSet("user_email", patch.email);
  if (patch.displayName !== undefined) addSet("user_display_name", patch.displayName);
  if (patch.firstName !== undefined) addSet("user_first_name", patch.firstName);
  if (patch.lastName !== undefined) addSet("user_last_name", patch.lastName);
  if (patch.externalCode !== undefined) addSet("user_external_code", patch.externalCode);
  if (patch.status !== undefined) addSet("user_status", patch.status);
  if (patch.type !== undefined) addSet("user_type", patch.type);
  if (patch.locale !== undefined) addSet("user_locale", patch.locale);
  if (patch.timezone !== undefined) addSet("user_timezone", patch.timezone);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`user_metadata = $${params.length}::jsonb`);
  }

  if (sets.length === 0) return findUserById(q, userId);

  sets.push(`updated_at = now()`);
  params.push(userId);
  const res = await q.query<RawUserRow>(
    `UPDATE sys.sys_users SET ${sets.join(", ")}
      WHERE user_id = $${params.length}
      RETURNING ${USER_COLS}`,
    params,
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

/* === Deactivate (soft delete) ========================================== */

export async function deactivateUser(
  q: DbConnector,
  userId: string,
): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_users
        SET user_status = 'DEACTIVATED', updated_at = now()
      WHERE user_id = $1 AND user_status <> 'DEACTIVATED'`,
    [userId],
  );
  return (res.rowCount ?? 0) === 1;
}

/* === Role grants ======================================================= */

interface RawGrantRow {
  user_auth_role_id: string;
  role_code: string;
  user_auth_role_tenant_id: string | null;
  user_auth_role_granted_at: Date;
  user_auth_role_granted_by: string | null;
}

function rowToGrant(r: RawGrantRow): RoleGrant {
  return {
    grantId: r.user_auth_role_id,
    roleCode: r.role_code as RoleGrant["roleCode"],
    tenantId: r.user_auth_role_tenant_id,
    grantedAt: r.user_auth_role_granted_at.toISOString(),
    grantedBy: r.user_auth_role_granted_by,
  };
}

export async function listRoleGrantsForUser(
  q: DbConnector,
  userId: string,
): Promise<RoleGrant[]> {
  const res = await q.query<RawGrantRow>(
    `SELECT uar.user_auth_role_id, r.auth_role_code AS role_code,
            uar.user_auth_role_tenant_id, uar.user_auth_role_granted_at,
            uar.user_auth_role_granted_by
       FROM sys.sys_user_auth_roles uar
       JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
      WHERE uar.user_auth_role_user_id = $1
        AND uar.user_auth_role_revoked_at IS NULL
      ORDER BY uar.user_auth_role_granted_at`,
    [userId],
  );
  return res.rows.map(rowToGrant);
}

export async function findRoleByCode(
  q: DbConnector,
  code: string,
): Promise<{ id: string; isPlatform: boolean } | null> {
  const res = await q.query<{ id: string; is_platform: boolean }>(
    `SELECT auth_role_id AS id, auth_role_is_platform AS is_platform
       FROM sys.sys_auth_roles WHERE auth_role_code = $1`,
    [code],
  );
  if (!res.rows[0]) return null;
  return { id: res.rows[0].id, isPlatform: res.rows[0].is_platform };
}

export async function findActiveGrant(
  q: DbConnector,
  userId: string,
  roleId: string,
  tenantId: string | null,
): Promise<{ grantId: string } | null> {
  const where =
    tenantId === null
      ? `user_auth_role_tenant_id IS NULL`
      : `user_auth_role_tenant_id = $3`;
  const params = tenantId === null ? [userId, roleId] : [userId, roleId, tenantId];
  const res = await q.query<{ user_auth_role_id: string }>(
    `SELECT user_auth_role_id FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = $1
        AND user_auth_role_role_id = $2
        AND ${where}
        AND user_auth_role_revoked_at IS NULL`,
    params,
  );
  return res.rows[0] ? { grantId: res.rows[0].user_auth_role_id } : null;
}

export async function insertRoleGrant(
  q: DbConnector,
  params: {
    userId: string;
    roleId: string;
    tenantId: string | null;
    grantedBy: string | null;
  },
): Promise<RoleGrant> {
  const res = await q.query<RawGrantRow>(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id,
         user_auth_role_tenant_id, user_auth_role_granted_by)
      VALUES ($1, $2, $3, $4)
      RETURNING user_auth_role_id,
                (SELECT auth_role_code FROM sys.sys_auth_roles WHERE auth_role_id = $2) AS role_code,
                user_auth_role_tenant_id, user_auth_role_granted_at,
                user_auth_role_granted_by`,
    [params.userId, params.roleId, params.tenantId, params.grantedBy],
  );
  return rowToGrant(res.rows[0]!);
}

export async function revokeRoleGrant(
  q: DbConnector,
  grantId: string,
): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_user_auth_roles
        SET user_auth_role_revoked_at = now()
      WHERE user_auth_role_id = $1 AND user_auth_role_revoked_at IS NULL`,
    [grantId],
  );
  return (res.rowCount ?? 0) === 1;
}

export async function findGrantById(
  q: DbConnector,
  grantId: string,
): Promise<{ grantId: string; userId: string; tenantId: string | null; revokedAt: Date | null } | null> {
  const res = await q.query<{
    user_auth_role_id: string;
    user_auth_role_user_id: string;
    user_auth_role_tenant_id: string | null;
    user_auth_role_revoked_at: Date | null;
  }>(
    `SELECT user_auth_role_id, user_auth_role_user_id,
            user_auth_role_tenant_id, user_auth_role_revoked_at
       FROM sys.sys_user_auth_roles WHERE user_auth_role_id = $1`,
    [grantId],
  );
  if (!res.rows[0]) return null;
  return {
    grantId: res.rows[0].user_auth_role_id,
    userId: res.rows[0].user_auth_role_user_id,
    tenantId: res.rows[0].user_auth_role_tenant_id,
    revokedAt: res.rows[0].user_auth_role_revoked_at,
  };
}
