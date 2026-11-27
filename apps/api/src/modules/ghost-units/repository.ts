/**
 * apps/api/src/modules/ghost-units/repository.ts
 * SQL per sys.sys_ghost_units (mig 000523, ADR-0063 D2). Le righe le scrive solo la funzione
 * sys.sys_ghost_riforma: qui si legge e si chiama la riforma, mai un INSERT diretto.
 */

import type { Pool, PoolClient } from "pg";
import type { GhostUnit } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  ghost_unit_id: string;
  ghost_unit_tenant_id: string;
  ghost_unit_source_unit_id: string | null;
  ghost_unit_source_parent_id: string | null;
  ghost_unit_level: number;
  ghost_unit_kind: GhostUnit["kind"];
  ghost_unit_code: string;
  ghost_unit_name: string;
  ghost_unit_source_type: string | null;
  manager_user_id: string | null;
  manager_name: string | null;
  ghost_unit_opened_reason: GhostUnit["openedReason"];
  ghost_unit_valid_from: Date;
  ghost_unit_valid_to: Date | null;
  ghost_unit_closed_reason: GhostUnit["closedReason"];
}

const SELECT = `
  SELECT g.ghost_unit_id, g.ghost_unit_tenant_id, g.ghost_unit_source_unit_id,
         g.ghost_unit_source_parent_id, g.ghost_unit_level, g.ghost_unit_kind,
         g.ghost_unit_code, g.ghost_unit_name, g.ghost_unit_source_type,
         u.organization_unit_manager_user_id AS manager_user_id,
         CASE WHEN m.user_id IS NULL THEN NULL
              WHEN m.user_last_name IS NOT NULL AND m.user_first_name IS NOT NULL
                THEN m.user_last_name || ', ' || m.user_first_name
              ELSE m.user_display_name END AS manager_name,
         g.ghost_unit_opened_reason, g.ghost_unit_valid_from, g.ghost_unit_valid_to,
         g.ghost_unit_closed_reason
    FROM sys.sys_ghost_units g
    LEFT JOIN sys.sys_organization_units u
           ON u.organization_unit_id = g.ghost_unit_source_unit_id
          AND u.organization_unit_tenant_id = g.ghost_unit_tenant_id
    LEFT JOIN sys.sys_users m
           ON m.user_id = u.organization_unit_manager_user_id
          AND m.user_tenant_id = g.ghost_unit_tenant_id`;

function toGhost(r: Row): GhostUnit {
  return {
    ghostUnitId: r.ghost_unit_id,
    tenantId: r.ghost_unit_tenant_id,
    sourceUnitId: r.ghost_unit_source_unit_id,
    sourceParentId: r.ghost_unit_source_parent_id,
    level: r.ghost_unit_level,
    kind: r.ghost_unit_kind,
    code: r.ghost_unit_code,
    name: r.ghost_unit_name,
    sourceType: r.ghost_unit_source_type,
    managerUserId: r.manager_user_id,
    managerName: r.manager_name,
    openedReason: r.ghost_unit_opened_reason,
    validFrom: r.ghost_unit_valid_from.toISOString(),
    validTo: r.ghost_unit_valid_to ? r.ghost_unit_valid_to.toISOString() : null,
    closedReason: r.ghost_unit_closed_reason,
  };
}

/** Le unità ghost attive del tenant, dal vertice in giù. */
export async function listActive(q: DbConnector, tenantId: string): Promise<GhostUnit[]> {
  const r = await q.query<Row>(
    `${SELECT}
      WHERE g.ghost_unit_tenant_id = $1 AND g.ghost_unit_valid_to IS NULL
      ORDER BY g.ghost_unit_level, g.ghost_unit_kind DESC, g.ghost_unit_code`,
    [tenantId],
  );
  return r.rows.map(toGhost);
}

/** Tutta la storia del tenant, dalla più recente. */
export async function listHistory(q: DbConnector, tenantId: string): Promise<GhostUnit[]> {
  const r = await q.query<Row>(
    `${SELECT}
      WHERE g.ghost_unit_tenant_id = $1
      ORDER BY g.ghost_unit_valid_from DESC, g.ghost_unit_level, g.ghost_unit_code`,
    [tenantId],
  );
  return r.rows.map(toGhost);
}

/** Quante differenze ci sono fra la storia aperta e l'albero vivo (0 = allineata). */
export async function countDrift(q: DbConnector, tenantId: string): Promise<number> {
  const r = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM (
       (SELECT source_unit_id, source_parent_id, ghost_level, ghost_kind, ghost_code, ghost_name, source_type
          FROM sys.v_ghost_units_derivate WHERE tenant_id = $1
        EXCEPT
        SELECT ghost_unit_source_unit_id, ghost_unit_source_parent_id, ghost_unit_level, ghost_unit_kind,
               ghost_unit_code, ghost_unit_name, ghost_unit_source_type
          FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = $1 AND ghost_unit_valid_to IS NULL)
       UNION ALL
       (SELECT ghost_unit_source_unit_id, ghost_unit_source_parent_id, ghost_unit_level, ghost_unit_kind,
               ghost_unit_code, ghost_unit_name, ghost_unit_source_type
          FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = $1 AND ghost_unit_valid_to IS NULL
        EXCEPT
        SELECT source_unit_id, source_parent_id, ghost_level, ghost_kind, ghost_code, ghost_name, source_type
          FROM sys.v_ghost_units_derivate WHERE tenant_id = $1)
     ) d`,
    [tenantId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

/** Chiama la riforma: chiude ciò che non corrisponde più all'albero e apre il nuovo. */
export async function riforma(
  q: DbConnector,
  tenantId: string,
): Promise<{ aperte: number; chiuse: number; attive: number }> {
  const r = await q.query<{ aperte: number; chiuse: number }>(
    `SELECT aperte, chiuse FROM sys.sys_ghost_riforma($1)`,
    [tenantId],
  );
  const a = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_ghost_units
      WHERE ghost_unit_tenant_id = $1 AND ghost_unit_valid_to IS NULL`,
    [tenantId],
  );
  return {
    aperte: r.rows[0]?.aperte ?? 0,
    chiuse: r.rows[0]?.chiuse ?? 0,
    attive: Number(a.rows[0]?.n ?? 0),
  };
}

export async function tenantExists(q: DbConnector, tenantId: string): Promise<boolean> {
  const r = await q.query(`SELECT 1 FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]);
  return (r.rowCount ?? 0) > 0;
}
