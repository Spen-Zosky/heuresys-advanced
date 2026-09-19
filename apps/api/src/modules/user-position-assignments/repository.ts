/**
 * apps/api/src/modules/user-position-assignments/repository.ts — Mandato K, G-1.
 * Sola lettura: list/get. Le scritture (assegna/termina/trasferisci) sono un EFFETTO di
 * approvazione (approvals/effects/position-assignment.ts), non passano da qui (D4=B).
 */
import type { Pool, PoolClient } from "pg";
import type { UserPositionAssignmentListQuery } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const SELECT = `
  SELECT a.user_position_assignment_id AS assignment_id,
         a.user_position_assignment_tenant_id AS tenant_id,
         a.user_position_assignment_user_id AS user_id,
         u.user_display_name AS user_display_name,
         a.user_position_assignment_position_id AS position_id,
         p.position_title AS position_title,
         a.user_position_assignment_kind AS kind,
         a.user_position_assignment_fte AS fte,
         a.user_position_assignment_start_date AS start_date,
         a.user_position_assignment_end_date AS end_date,
         a.user_position_assignment_status AS status,
         a.user_position_assignment_notes AS notes,
         a.origine_dato AS origine_dato,
         a.created_at AS created_at,
         a.updated_at AS updated_at
    FROM sys.sys_user_position_assignments a
    LEFT JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
    LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id`;

interface Row {
  assignment_id: string;
  tenant_id: string;
  user_id: string;
  user_display_name: string | null;
  position_id: string;
  position_title: string | null;
  kind: string;
  fte: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  origine_dato: string;
  created_at: string;
  updated_at: string;
}

function toDto(r: Row) {
  return {
    assignmentId: r.assignment_id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    userDisplayName: r.user_display_name,
    positionId: r.position_id,
    positionTitle: r.position_title,
    kind: r.kind,
    fte: Number(r.fte),
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    notes: r.notes,
    origineDato: r.origine_dato,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listAssignments(
  db: DbConnector,
  params: { tenantId?: string; query: UserPositionAssignmentListQuery },
) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.tenantId) { args.push(params.tenantId); where.push(`a.user_position_assignment_tenant_id = $${args.length}`); }
  if (params.query.userId) { args.push(params.query.userId); where.push(`a.user_position_assignment_user_id = $${args.length}`); }
  if (params.query.positionId) { args.push(params.query.positionId); where.push(`a.user_position_assignment_position_id = $${args.length}`); }
  if (params.query.status) { args.push(params.query.status); where.push(`a.user_position_assignment_status = $${args.length}`); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRes = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_user_position_assignments a ${clause}`,
    args,
  );
  args.push(params.query.limit, params.query.offset);
  const res = await db.query<Row>(
    `${SELECT} ${clause}
     ORDER BY a.created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );
  return { items: res.rows.map(toDto), total: Number(countRes.rows[0]?.n ?? 0) };
}

export async function findAssignmentById(db: DbConnector, id: string) {
  const res = await db.query<Row>(`${SELECT} WHERE a.user_position_assignment_id = $1`, [id]);
  return res.rows[0] ? toDto(res.rows[0]) : null;
}

/** Chi puo' approvare una proposta di assegnazione: titolare di `:update` nel tenant, mai il
 *  proponente stesso — "un approvatore approva" nel mandato presuppone una persona diversa. */
export async function findApproversInTenant(db: DbConnector, tenantId: string, excludeUserId: string): Promise<string[]> {
  const r = await db.query<{ user_id: string }>(
    `SELECT DISTINCT u.user_id
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'user_position_assignment:update'
        AND u.user_status = 'ACTIVE' AND u.user_tenant_id = $1 AND u.user_id <> $2
      ORDER BY u.user_id`,
    [tenantId, excludeUserId],
  );
  return r.rows.map((x) => x.user_id);
}

export async function findPositionTenant(db: DbConnector, positionId: string): Promise<string | null> {
  const r = await db.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  return r.rows[0]?.position_tenant_id ?? null;
}
