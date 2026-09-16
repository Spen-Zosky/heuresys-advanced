/**
 * apps/api/src/modules/platform-tenant-assignments/repository.ts — mandato K, R-0 (D9=B).
 *
 * SQL parametrizzato grezzo su `sys.sys_platform_user_tenant_assignments` (mig `000421`).
 * Ritirare = valorizzare `platform_user_tenant_assignment_revoked_at` (ADR-0035): nessuna
 * `DELETE` in questo repository.
 */
import type { Pool, PoolClient } from "pg";
import type {
  PlatformTenantAssignment,
  PlatformTenantAssignmentListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Riga {
  platform_user_tenant_assignment_id: string;
  platform_user_tenant_assignment_user_id: string;
  platform_user_tenant_assignment_tenant_id: string;
  platform_user_tenant_assignment_assigned_at: Date;
  platform_user_tenant_assignment_assigned_by: string | null;
  platform_user_tenant_assignment_revoked_at: Date | null;
}

const SELEZIONE = `
  platform_user_tenant_assignment_id, platform_user_tenant_assignment_user_id,
  platform_user_tenant_assignment_tenant_id, platform_user_tenant_assignment_assigned_at,
  platform_user_tenant_assignment_assigned_by, platform_user_tenant_assignment_revoked_at`;

function mappa(r: Riga): PlatformTenantAssignment {
  return {
    assignmentId: r.platform_user_tenant_assignment_id,
    userId: r.platform_user_tenant_assignment_user_id,
    tenantId: r.platform_user_tenant_assignment_tenant_id,
    assignedAt: r.platform_user_tenant_assignment_assigned_at.toISOString(),
    assignedBy: r.platform_user_tenant_assignment_assigned_by,
    revokedAt: r.platform_user_tenant_assignment_revoked_at
      ? r.platform_user_tenant_assignment_revoked_at.toISOString()
      : null,
  };
}

export async function listAssignments(
  q: DbConnector,
  filtro: PlatformTenantAssignmentListQuery,
): Promise<{ items: PlatformTenantAssignment[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filtro.userId) {
    params.push(filtro.userId);
    where.push(`platform_user_tenant_assignment_user_id = $${params.length}`);
  }
  if (filtro.tenantId) {
    params.push(filtro.tenantId);
    where.push(`platform_user_tenant_assignment_tenant_id = $${params.length}`);
  }
  if (filtro.activeOnly) {
    where.push(`platform_user_tenant_assignment_revoked_at IS NULL`);
  }
  const clausola = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const conteggio = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_platform_user_tenant_assignments ${clausola}`,
    params,
  );
  params.push(filtro.limit, filtro.offset);
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} FROM sys.sys_platform_user_tenant_assignments ${clausola}
      ORDER BY platform_user_tenant_assignment_assigned_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(mappa), total: Number(conteggio.rows[0]?.n ?? 0) };
}

export async function findAssignmentById(
  q: DbConnector,
  id: string,
): Promise<PlatformTenantAssignment | null> {
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} FROM sys.sys_platform_user_tenant_assignments
      WHERE platform_user_tenant_assignment_id = $1`,
    [id],
  );
  const r = res.rows[0];
  return r ? mappa(r) : null;
}

export async function findActiveAssignment(
  q: DbConnector,
  userId: string,
  tenantId: string,
): Promise<PlatformTenantAssignment | null> {
  const res = await q.query<Riga>(
    `SELECT ${SELEZIONE} FROM sys.sys_platform_user_tenant_assignments
      WHERE platform_user_tenant_assignment_user_id = $1
        AND platform_user_tenant_assignment_tenant_id = $2
        AND platform_user_tenant_assignment_revoked_at IS NULL`,
    [userId, tenantId],
  );
  const r = res.rows[0];
  return r ? mappa(r) : null;
}

export async function insertAssignment(
  q: DbConnector,
  dati: { userId: string; tenantId: string; assignedBy: string },
): Promise<PlatformTenantAssignment> {
  const ins = await q.query<{ id: string }>(
    `INSERT INTO sys.sys_platform_user_tenant_assignments
       (platform_user_tenant_assignment_user_id, platform_user_tenant_assignment_tenant_id,
        platform_user_tenant_assignment_assigned_by)
     VALUES ($1, $2, $3)
     RETURNING platform_user_tenant_assignment_id AS id`,
    [dati.userId, dati.tenantId, dati.assignedBy],
  );
  const id = ins.rows[0]?.id;
  if (!id) throw new Error("assegnazione creata ma senza identificativo");
  const creata = await findAssignmentById(q, id);
  if (!creata) throw new Error("assegnazione creata ma non rileggibile");
  return creata;
}

/**
 * Revoca. Lo stato di partenza è ri-verificato **nella WHERE**, non letto e poi scritto: due
 * revoche concorrenti non devono entrambe «riuscire».
 */
export async function revokeAssignment(
  q: DbConnector,
  id: string,
): Promise<{ revocata: boolean }> {
  const res = await q.query(
    `UPDATE sys.sys_platform_user_tenant_assignments
        SET platform_user_tenant_assignment_revoked_at = now(), updated_at = now()
      WHERE platform_user_tenant_assignment_id = $1
        AND platform_user_tenant_assignment_revoked_at IS NULL`,
    [id],
  );
  return { revocata: (res.rowCount ?? 0) > 0 };
}

/** Le due entità devono esistere: un'assegnazione verso un utente o un cliente inesistente non ha senso. */
export async function esistonoEntita(
  q: DbConnector,
  userId: string,
  tenantId: string,
): Promise<{ userExists: boolean; tenantExists: boolean }> {
  const [u, t] = await Promise.all([
    q.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_users WHERE user_id = $1`, [userId]),
    q.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]),
  ]);
  return {
    userExists: Number(u.rows[0]?.n ?? 0) === 1,
    tenantExists: Number(t.rows[0]?.n ?? 0) === 1,
  };
}
