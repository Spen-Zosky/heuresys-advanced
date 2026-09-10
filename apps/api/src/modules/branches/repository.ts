/**
 * apps/api/src/modules/branches/repository.ts
 * SQL parametrizzato su `sys.sys_branches` (B14, 2026-09-10).
 *
 * ⚠ IL FILTRO PER CLIENTE NON E' OPZIONALE, ed è per questo che `tenantId` è un parametro
 * OBBLIGATORIO e non un `string | undefined` con un ramo che salta il `WHERE`. I5 dice che
 * l'isolamento è FK più filtro nel servizio, mai RLS: se il filtro può essere omesso da una
 * chiamata distratta, l'isolamento dipende da chi scrive la chiamata. Chi amministra la
 * piattaforma passa `null` esplicitamente, che è una decisione visibile nel codice chiamante.
 */

import type { Pool, PoolClient } from "pg";
import type { Branch, BranchListQuery } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  branch_id: string;
  branch_organization_unit_id: string;
  branch_code: string;
  branch_address_line1: string | null;
  branch_address_line2: string | null;
  branch_city: string | null;
  branch_postal_code: string | null;
  branch_country_code: string | null;
  branch_region_code: string | null;
  branch_opening_hours: Record<string, unknown>;
  branch_regulatory_zone: string | null;
  branch_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `branch_id, branch_organization_unit_id, branch_code,
  branch_address_line1, branch_address_line2, branch_city, branch_postal_code,
  branch_country_code, branch_region_code, branch_opening_hours,
  branch_regulatory_zone, branch_metadata, created_at, updated_at`;

function toBranch(r: Row): Branch {
  return {
    branchId: r.branch_id,
    organizationUnitId: r.branch_organization_unit_id,
    code: r.branch_code,
    addressLine1: r.branch_address_line1,
    addressLine2: r.branch_address_line2,
    city: r.branch_city,
    postalCode: r.branch_postal_code,
    countryCode: r.branch_country_code,
    regionCode: r.branch_region_code,
    openingHours: r.branch_opening_hours,
    regulatoryZone: r.branch_regulatory_zone,
    metadata: r.branch_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** `tenantId === null` = chi amministra la piattaforma: nessun filtro, dichiarato dal chiamante. */
export async function listBranches(
  q: DbConnector,
  tenantId: string | null,
  query: BranchListQuery,
): Promise<{ items: Branch[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (tenantId !== null) {
    params.push(tenantId);
    where.push(`branch_tenant_id = $${params.length}`);
  }
  if (query.city) {
    params.push(query.city);
    where.push(`branch_city ILIKE $${params.length}`);
  }
  if (query.regionCode) {
    params.push(query.regionCode);
    where.push(`branch_region_code = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(branch_code ILIKE $${params.length} OR branch_city ILIKE $${params.length}
                 OR branch_address_line1 ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_branches ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_branches ${whereClause}
      ORDER BY branch_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toBranch), total };
}

/**
 * Il filtro per cliente sta nella stessa query dell'identificativo, non in un controllo dopo:
 * una filiale di un altro cliente deve essere INTROVABILE, non «trovata e poi negata». La
 * differenza si vede nella risposta — 404 e non 403 — e un 403 direbbe che quella filiale
 * esiste.
 */
export async function findBranchById(
  q: DbConnector,
  id: string,
  tenantId: string | null,
): Promise<Branch | null> {
  const params: unknown[] = [id];
  let clausola = "";
  if (tenantId !== null) {
    params.push(tenantId);
    clausola = ` AND branch_tenant_id = $${params.length}`;
  }
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_branches WHERE branch_id = $1${clausola}`,
    params,
  );
  return res.rows[0] ? toBranch(res.rows[0]) : null;
}
