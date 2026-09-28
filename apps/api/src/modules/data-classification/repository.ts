/**
 * apps/api/src/modules/data-classification/repository.ts — #262.
 * Raw SQL over sys.sys_classificazione_direzione_dato (252+ righe, I23/ADR-0041).
 * Registro platform-wide: nessun filtro tenant, la tabella non ha tenant_id.
 */
import type { Pool, PoolClient } from "pg";
import type { DataClassificationRow } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  tabella: string;
  stato: string;
  motivo: string;
  adr: string;
  ratificato_il: Date;
}

function toRow(r: Row): DataClassificationRow {
  return {
    tabella: r.tabella,
    stato: r.stato as DataClassificationRow["stato"],
    motivo: r.motivo,
    adr: r.adr,
    ratificatoIl: r.ratificato_il.toISOString().slice(0, 10),
  };
}

export async function listAll(q: DbConnector): Promise<DataClassificationRow[]> {
  const res = await q.query<Row>(
    `SELECT tabella, stato, motivo, adr, ratificato_il
       FROM sys.sys_classificazione_direzione_dato
      ORDER BY tabella`,
  );
  return res.rows.map(toRow);
}
