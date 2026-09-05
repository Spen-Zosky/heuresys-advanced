/**
 * apps/api/src/modules/job-requisitions/repository.ts
 * SQL parametrizzato su `sys.sys_job_requisitions` (#54 F2, mig 000364).
 *
 * Il titolo della posizione arriva da una LEFT JOIN e non da una colonna copiata: I1 dice
 * che si copre un POSTO, e il posto ha un nome solo — il suo. Duplicarlo qui sarebbe la
 * prima riga di un disallineamento.
 */

import type { Pool, PoolClient } from "pg";

import type {
  JobRequisition,
  JobRequisitionCreateBody,
  JobRequisitionListQuery,
  JobRequisitionUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  requisition_id: string;
  requisition_tenant_id: string;
  requisition_code: string;
  requisition_position_id: string;
  position_title: string | null;
  requisition_headcount: number;
  requisition_status: string;
  requisition_reason: string | null;
  requisition_opened_on: string | null;
  requisition_target_start: string | null;
  requisition_closed_on: string | null;
  requisition_notes: string | null;
  requisition_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mappa(r: Row): JobRequisition {
  return {
    requisitionId: r.requisition_id,
    tenantId: r.requisition_tenant_id,
    code: r.requisition_code,
    positionId: r.requisition_position_id,
    positionTitle: r.position_title,
    headcount: r.requisition_headcount,
    status: r.requisition_status as JobRequisition["status"],
    reason: r.requisition_reason as JobRequisition["reason"],
    openedOn: r.requisition_opened_on,
    targetStart: r.requisition_target_start,
    closedOn: r.requisition_closed_on,
    notes: r.requisition_notes,
    metadata: r.requisition_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Le date arrivano da PostgreSQL come `Date` o stringa: si normalizzano a `YYYY-MM-DD`. */
const SELECT_BASE = `
  SELECT r.requisition_id, r.requisition_tenant_id, r.requisition_code,
         r.requisition_position_id, p.position_title AS position_title,
         r.requisition_headcount, r.requisition_status, r.requisition_reason,
         to_char(r.requisition_opened_on,    'YYYY-MM-DD') AS requisition_opened_on,
         to_char(r.requisition_target_start, 'YYYY-MM-DD') AS requisition_target_start,
         to_char(r.requisition_closed_on,    'YYYY-MM-DD') AS requisition_closed_on,
         r.requisition_notes, r.requisition_metadata, r.created_at, r.updated_at
    FROM sys.sys_job_requisitions r
    LEFT JOIN sys.sys_positions p ON p.position_id = r.requisition_position_id`;

export interface ListArgs extends JobRequisitionListQuery {
  /** Filtro tenant — `undefined` = nessun filtro (PLATFORM_ADMIN cross-tenant). */
  tenantId?: string;
}

export async function listRequisitions(
  db: Db,
  args: ListArgs,
): Promise<{ items: JobRequisition[]; total: number }> {
  // $1 tenant, $2 status, $3 positionId, $4 limit, $5 offset
  const dove = `
    WHERE ($1::uuid IS NULL OR r.requisition_tenant_id = $1)
      AND ($2::varchar IS NULL OR r.requisition_status = $2)
      AND ($3::uuid IS NULL OR r.requisition_position_id = $3)`;
  const parametri = [args.tenantId ?? null, args.status ?? null, args.positionId ?? null];

  const righe = await db.query<Row>(
    `${SELECT_BASE} ${dove}
      ORDER BY r.created_at DESC, r.requisition_code ASC
      LIMIT $4 OFFSET $5`,
    [...parametri, args.limit, args.offset],
  );
  const totale = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM sys.sys_job_requisitions r ${dove}`,
    parametri,
  );
  return {
    items: righe.rows.map(mappa),
    total: Number.parseInt(totale.rows[0]?.count ?? "0", 10),
  };
}

export async function findRequisitionById(db: Db, id: string): Promise<JobRequisition | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE r.requisition_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Unicita' del codice DENTRO il tenant (specchio di `sys_job_requisitions_code_unique`). */
export async function findRequisitionByCode(
  db: Db,
  tenantId: string,
  code: string,
): Promise<{ requisitionId: string } | null> {
  const r = await db.query<{ requisition_id: string }>(
    `SELECT requisition_id FROM sys.sys_job_requisitions
      WHERE requisition_tenant_id = $1 AND requisition_code = $2`,
    [tenantId, code],
  );
  return r.rows[0] ? { requisitionId: r.rows[0].requisition_id } : null;
}

/** La posizione esiste, ed e' DI QUEL TENANT: senza la seconda meta' si aprirebbe una
 *  richiesta su un posto di un'altra azienda, che I5 vieta. */
export async function positionBelongsToTenant(
  db: Db,
  positionId: string,
  tenantId: string,
): Promise<boolean> {
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_positions
      WHERE position_id = $1 AND position_tenant_id = $2`,
    [positionId, tenantId],
  );
  return Number.parseInt(r.rows[0]?.n ?? "0", 10) > 0;
}

export async function insertRequisition(
  db: Db,
  tenantId: string,
  body: JobRequisitionCreateBody,
  actorUserId: string,
): Promise<JobRequisition> {
  const r = await db.query<{ requisition_id: string }>(
    `INSERT INTO sys.sys_job_requisitions
       (requisition_tenant_id, requisition_code, requisition_position_id,
        requisition_headcount, requisition_status, requisition_reason,
        requisition_opened_on, requisition_target_start, requisition_notes,
        requisition_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, coalesce($4, 1), 'DRAFT', $5, $6, $7, $8,
             coalesce($9::jsonb, '{}'::jsonb), $10, $10)
     RETURNING requisition_id`,
    [
      tenantId,
      body.code,
      body.positionId,
      body.headcount ?? null,
      body.reason ?? null,
      body.openedOn ?? null,
      body.targetStart ?? null,
      body.notes ?? null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      actorUserId,
    ],
  );
  const creata = await findRequisitionById(db, r.rows[0]!.requisition_id);
  if (!creata) throw new Error("job-requisitions: la riga appena creata non si rilegge");
  return creata;
}

/**
 * Aggiornamento parziale: si costruisce l'elenco delle sole colonne presenti nel patch.
 * `positionId` non compare di proposito — lo schema non lo ammette, e ripeterlo qui
 * sarebbe l'unico punto da cui potrebbe rientrare.
 */
export async function updateRequisitionPartial(
  db: Db,
  id: string,
  patch: JobRequisitionUpdateBody,
  actorUserId: string,
): Promise<JobRequisition | null> {
  const set: string[] = [];
  const val: unknown[] = [];
  const aggiungi = (colonna: string, valore: unknown, cast = "") => {
    val.push(valore);
    set.push(`${colonna} = $${val.length}${cast}`);
  };

  if (patch.headcount !== undefined) aggiungi("requisition_headcount", patch.headcount);
  if (patch.status !== undefined) aggiungi("requisition_status", patch.status);
  if (patch.reason !== undefined) aggiungi("requisition_reason", patch.reason);
  if (patch.openedOn !== undefined) aggiungi("requisition_opened_on", patch.openedOn, "::date");
  if (patch.targetStart !== undefined)
    aggiungi("requisition_target_start", patch.targetStart, "::date");
  if (patch.closedOn !== undefined) aggiungi("requisition_closed_on", patch.closedOn, "::date");
  if (patch.notes !== undefined) aggiungi("requisition_notes", patch.notes);
  if (patch.metadata !== undefined)
    aggiungi("requisition_metadata", JSON.stringify(patch.metadata), "::jsonb");

  if (set.length === 0) return findRequisitionById(db, id);

  val.push(actorUserId);
  const iAttore = val.length;
  val.push(id);
  const iId = val.length;

  const r = await db.query<{ requisition_id: string }>(
    `UPDATE sys.sys_job_requisitions
        SET ${set.join(", ")}, updated_by = $${iAttore}, updated_at = now()
      WHERE requisition_id = $${iId}
      RETURNING requisition_id`,
    val,
  );
  if (!r.rows[0]) return null;
  return findRequisitionById(db, id);
}
