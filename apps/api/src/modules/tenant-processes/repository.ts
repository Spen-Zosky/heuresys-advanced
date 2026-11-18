/**
 * apps/api/src/modules/tenant-processes/repository.ts — SQL parametrizzato su `sys.sys_tenant_processes`.
 * ADR-0060, piano delle applet, voce P3.
 */
import type { Pool, PoolClient } from "pg";
import type { TenantProcess } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Riga {
  tenant_process_id: string;
  tenant_process_tenant_id: string;
  tenant_process_code: string;
  tenant_process_name: string;
  tenant_process_is_active: boolean;
  tenant_process_owner_position_id: string | null;
  position_title: string | null;
  owner_covered: boolean;
}

const SELECT_PROCESSO = `
  SELECT tp.tenant_process_id, tp.tenant_process_tenant_id, tp.tenant_process_code,
         tp.tenant_process_name, tp.tenant_process_is_active, tp.tenant_process_owner_position_id,
         p.position_title,
         (tp.tenant_process_owner_position_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM sys.sys_user_position_assignments a
             WHERE a.user_position_assignment_position_id = tp.tenant_process_owner_position_id
               AND a.user_position_assignment_status = 'ACTIVE')) AS owner_covered
    FROM sys.sys_tenant_processes tp
    LEFT JOIN sys.sys_positions p ON p.position_id = tp.tenant_process_owner_position_id`;

function mappa(r: Riga): TenantProcess {
  return {
    id: r.tenant_process_id,
    tenantId: r.tenant_process_tenant_id,
    code: r.tenant_process_code,
    name: r.tenant_process_name,
    isActive: r.tenant_process_is_active,
    ownerPositionId: r.tenant_process_owner_position_id,
    ownerPositionTitle: r.position_title,
    ownerCovered: r.owner_covered,
  };
}

export async function findProcessById(q: DbConnector, id: string): Promise<TenantProcess | null> {
  const r = await q.query<Riga>(`${SELECT_PROCESSO} WHERE tp.tenant_process_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Blocca la riga del processo per la durata della transazione e ne dà il responsabile attuale. */
export async function lockOwner(
  q: DbConnector, id: string,
): Promise<{ tenantId: string; isActive: boolean; ownerPositionId: string | null } | null> {
  const r = await q.query<{ t: string; a: boolean; o: string | null }>(
    `SELECT tenant_process_tenant_id AS t, tenant_process_is_active AS a,
            tenant_process_owner_position_id AS o
       FROM sys.sys_tenant_processes WHERE tenant_process_id = $1 FOR UPDATE`,
    [id],
  );
  const row = r.rows[0];
  return row ? { tenantId: row.t, isActive: row.a, ownerPositionId: row.o } : null;
}

export async function positionTenant(
  q: DbConnector, positionId: string,
): Promise<{ tenantId: string; isActive: boolean } | null> {
  const r = await q.query<{ t: string; a: boolean }>(
    `SELECT position_tenant_id AS t, position_is_active AS a FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  const row = r.rows[0];
  return row ? { tenantId: row.t, isActive: row.a } : null;
}

/** Vero se la persona regge oggi la posizione (assegnazione `ACTIVE`). */
export async function holdsPosition(q: DbConnector, userId: string, positionId: string): Promise<boolean> {
  const r = await q.query(
    `SELECT 1 FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_user_id = $1
        AND user_position_assignment_position_id = $2
        AND user_position_assignment_status = 'ACTIVE' LIMIT 1`,
    [userId, positionId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function setOwner(
  q: DbConnector, id: string, ownerPositionId: string | null, actorId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_tenant_processes
        SET tenant_process_owner_position_id = $2, updated_at = now(), updated_by = $3
      WHERE tenant_process_id = $1
        AND tenant_process_owner_position_id IS DISTINCT FROM $2`,
    [id, ownerPositionId, actorId],
  );
}
