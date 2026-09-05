/**
 * apps/api/src/modules/job-postings/repository.ts
 * SQL parametrizzato su `sys.sys_job_postings` (#54 F2, mig 000364).
 */

import type { Pool, PoolClient } from "pg";

import type {
  JobPosting,
  JobPostingCreateBody,
  JobPostingListQuery,
  JobPostingUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  posting_id: string;
  posting_tenant_id: string;
  posting_requisition_id: string;
  requisition_code: string | null;
  posting_code: string;
  posting_title: string;
  posting_description: string | null;
  posting_visibility: string;
  posting_status: string;
  posting_published_on: string | null;
  posting_expires_on: string | null;
  posting_location: string | null;
  posting_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mappa(r: Row): JobPosting {
  return {
    postingId: r.posting_id,
    tenantId: r.posting_tenant_id,
    requisitionId: r.posting_requisition_id,
    requisitionCode: r.requisition_code,
    code: r.posting_code,
    title: r.posting_title,
    description: r.posting_description,
    visibility: r.posting_visibility as JobPosting["visibility"],
    status: r.posting_status as JobPosting["status"],
    publishedOn: r.posting_published_on,
    expiresOn: r.posting_expires_on,
    location: r.posting_location,
    metadata: r.posting_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT s.posting_id, s.posting_tenant_id, s.posting_requisition_id,
         r.requisition_code AS requisition_code,
         s.posting_code, s.posting_title, s.posting_description,
         s.posting_visibility, s.posting_status,
         to_char(s.posting_published_on, 'YYYY-MM-DD') AS posting_published_on,
         to_char(s.posting_expires_on,   'YYYY-MM-DD') AS posting_expires_on,
         s.posting_location, s.posting_metadata, s.created_at, s.updated_at
    FROM sys.sys_job_postings s
    LEFT JOIN sys.sys_job_requisitions r ON r.requisition_id = s.posting_requisition_id`;

export interface ListArgs extends JobPostingListQuery {
  /** Filtro tenant — `undefined` = nessun filtro (PLATFORM_ADMIN cross-tenant). */
  tenantId?: string;
}

export async function listPostings(
  db: Db,
  args: ListArgs,
): Promise<{ items: JobPosting[]; total: number }> {
  // $1 tenant, $2 status, $3 visibility, $4 requisitionId, $5 limit, $6 offset
  const dove = `
    WHERE ($1::uuid IS NULL OR s.posting_tenant_id = $1)
      AND ($2::varchar IS NULL OR s.posting_status = $2)
      AND ($3::varchar IS NULL OR s.posting_visibility = $3)
      AND ($4::uuid IS NULL OR s.posting_requisition_id = $4)`;
  const parametri = [
    args.tenantId ?? null,
    args.status ?? null,
    args.visibility ?? null,
    args.requisitionId ?? null,
  ];

  const righe = await db.query<Row>(
    `${SELECT_BASE} ${dove}
      ORDER BY s.created_at DESC, s.posting_code ASC
      LIMIT $5 OFFSET $6`,
    [...parametri, args.limit, args.offset],
  );
  const totale = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM sys.sys_job_postings s ${dove}`,
    parametri,
  );
  return {
    items: righe.rows.map(mappa),
    total: Number.parseInt(totale.rows[0]?.count ?? "0", 10),
  };
}

export async function findPostingById(db: Db, id: string): Promise<JobPosting | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE s.posting_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Unicita' del codice DENTRO il tenant (specchio di `sys_job_postings_code_unique`). */
export async function findPostingByCode(
  db: Db,
  tenantId: string,
  code: string,
): Promise<{ postingId: string } | null> {
  const r = await db.query<{ posting_id: string }>(
    `SELECT posting_id FROM sys.sys_job_postings
      WHERE posting_tenant_id = $1 AND posting_code = $2`,
    [tenantId, code],
  );
  return r.rows[0] ? { postingId: r.rows[0].posting_id } : null;
}

/** Il tenant dell'annuncio SI EREDITA dalla richiesta: e' l'unica fonte possibile. */
export async function tenantOfRequisition(db: Db, requisitionId: string): Promise<string | null> {
  const r = await db.query<{ requisition_tenant_id: string }>(
    `SELECT requisition_tenant_id FROM sys.sys_job_requisitions WHERE requisition_id = $1`,
    [requisitionId],
  );
  return r.rows[0]?.requisition_tenant_id ?? null;
}

export async function insertPosting(
  db: Db,
  tenantId: string,
  body: JobPostingCreateBody,
  actorUserId: string,
): Promise<JobPosting> {
  const r = await db.query<{ posting_id: string }>(
    `INSERT INTO sys.sys_job_postings
       (posting_tenant_id, posting_requisition_id, posting_code, posting_title,
        posting_description, posting_visibility, posting_status,
        posting_published_on, posting_expires_on, posting_location,
        posting_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, coalesce($6, 'INTERNAL'), 'DRAFT', $7, $8, $9,
             coalesce($10::jsonb, '{}'::jsonb), $11, $11)
     RETURNING posting_id`,
    [
      tenantId,
      body.requisitionId,
      body.code,
      body.title,
      body.description ?? null,
      body.visibility ?? null,
      body.publishedOn ?? null,
      body.expiresOn ?? null,
      body.location ?? null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      actorUserId,
    ],
  );
  const creato = await findPostingById(db, r.rows[0]!.posting_id);
  if (!creato) throw new Error("job-postings: la riga appena creata non si rilegge");
  return creato;
}

export async function updatePostingPartial(
  db: Db,
  id: string,
  patch: JobPostingUpdateBody,
  actorUserId: string,
): Promise<JobPosting | null> {
  const set: string[] = [];
  const val: unknown[] = [];
  const aggiungi = (colonna: string, valore: unknown, cast = "") => {
    val.push(valore);
    set.push(`${colonna} = $${val.length}${cast}`);
  };

  if (patch.title !== undefined) aggiungi("posting_title", patch.title);
  if (patch.description !== undefined) aggiungi("posting_description", patch.description);
  if (patch.visibility !== undefined) aggiungi("posting_visibility", patch.visibility);
  if (patch.status !== undefined) aggiungi("posting_status", patch.status);
  if (patch.publishedOn !== undefined) aggiungi("posting_published_on", patch.publishedOn, "::date");
  if (patch.expiresOn !== undefined) aggiungi("posting_expires_on", patch.expiresOn, "::date");
  if (patch.location !== undefined) aggiungi("posting_location", patch.location);
  if (patch.metadata !== undefined)
    aggiungi("posting_metadata", JSON.stringify(patch.metadata), "::jsonb");

  if (set.length === 0) return findPostingById(db, id);

  val.push(actorUserId);
  const iAttore = val.length;
  val.push(id);
  const iId = val.length;

  const r = await db.query<{ posting_id: string }>(
    `UPDATE sys.sys_job_postings
        SET ${set.join(", ")}, updated_by = $${iAttore}, updated_at = now()
      WHERE posting_id = $${iId}
      RETURNING posting_id`,
    val,
  );
  if (!r.rows[0]) return null;
  return findPostingById(db, id);
}
