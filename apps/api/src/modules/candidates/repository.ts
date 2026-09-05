/**
 * apps/api/src/modules/candidates/repository.ts
 * SQL parametrizzato su `sys.sys_candidates` (#54 F2, mig 000364).
 */

import type { Pool, PoolClient } from "pg";

import type {
  Candidate,
  CandidateCreateBody,
  CandidateListQuery,
  CandidateUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  candidate_id: string;
  candidate_tenant_id: string;
  candidate_external_code: string | null;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  candidate_source: string;
  candidate_status: string;
  candidate_consent_given_on: string | null;
  candidate_retention_until: string | null;
  candidate_hired_user_id: string | null;
  candidate_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mappa(r: Row): Candidate {
  return {
    candidateId: r.candidate_id,
    tenantId: r.candidate_tenant_id,
    externalCode: r.candidate_external_code,
    firstName: r.candidate_first_name,
    lastName: r.candidate_last_name,
    email: r.candidate_email,
    phone: r.candidate_phone,
    source: r.candidate_source as Candidate["source"],
    status: r.candidate_status as Candidate["status"],
    consentGivenOn: r.candidate_consent_given_on,
    retentionUntil: r.candidate_retention_until,
    hiredUserId: r.candidate_hired_user_id,
    metadata: r.candidate_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT c.candidate_id, c.candidate_tenant_id, c.candidate_external_code,
         c.candidate_first_name, c.candidate_last_name, c.candidate_email,
         c.candidate_phone, c.candidate_source, c.candidate_status,
         to_char(c.candidate_consent_given_on, 'YYYY-MM-DD') AS candidate_consent_given_on,
         to_char(c.candidate_retention_until,  'YYYY-MM-DD') AS candidate_retention_until,
         c.candidate_hired_user_id, c.candidate_metadata, c.created_at, c.updated_at
    FROM sys.sys_candidates c`;

export interface ListArgs extends CandidateListQuery {
  /** Filtro tenant — `undefined` = nessun filtro (PLATFORM_ADMIN cross-tenant). */
  tenantId?: string;
}

export async function listCandidates(
  db: Db,
  args: ListArgs,
): Promise<{ items: Candidate[]; total: number }> {
  // $1 tenant, $2 status, $3 source, $4 limit, $5 offset
  const dove = `
    WHERE ($1::uuid IS NULL OR c.candidate_tenant_id = $1)
      AND ($2::varchar IS NULL OR c.candidate_status = $2)
      AND ($3::varchar IS NULL OR c.candidate_source = $3)`;
  const parametri = [args.tenantId ?? null, args.status ?? null, args.source ?? null];

  const righe = await db.query<Row>(
    `${SELECT_BASE} ${dove}
      ORDER BY c.created_at DESC, c.candidate_last_name ASC
      LIMIT $4 OFFSET $5`,
    [...parametri, args.limit, args.offset],
  );
  const totale = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM sys.sys_candidates c ${dove}`,
    parametri,
  );
  return {
    items: righe.rows.map(mappa),
    total: Number.parseInt(totale.rows[0]?.count ?? "0", 10),
  };
}

export async function findCandidateById(db: Db, id: string): Promise<Candidate | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE c.candidate_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Unicita' dell'indirizzo DENTRO il tenant (specchio di `sys_candidates_email_unique`). */
export async function findCandidateByEmail(
  db: Db,
  tenantId: string,
  email: string,
): Promise<{ candidateId: string } | null> {
  const r = await db.query<{ candidate_id: string }>(
    `SELECT candidate_id FROM sys.sys_candidates
      WHERE candidate_tenant_id = $1 AND lower(candidate_email) = lower($2)`,
    [tenantId, email],
  );
  return r.rows[0] ? { candidateId: r.rows[0].candidate_id } : null;
}

/** L'utente esiste ed e' di quel tenant — serve per l'assunzione (`HIRED`). */
export async function userBelongsToTenant(
  db: Db,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_users
      WHERE user_id = $1 AND user_tenant_id = $2`,
    [userId, tenantId],
  );
  return Number.parseInt(r.rows[0]?.n ?? "0", 10) > 0;
}

export async function insertCandidate(
  db: Db,
  tenantId: string,
  body: CandidateCreateBody,
  actorUserId: string,
): Promise<Candidate> {
  const r = await db.query<{ candidate_id: string }>(
    `INSERT INTO sys.sys_candidates
       (candidate_tenant_id, candidate_external_code, candidate_first_name,
        candidate_last_name, candidate_email, candidate_phone, candidate_source,
        candidate_status, candidate_consent_given_on, candidate_retention_until,
        candidate_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9,
             coalesce($10::jsonb, '{}'::jsonb), $11, $11)
     RETURNING candidate_id`,
    [
      tenantId,
      body.externalCode ?? null,
      body.firstName,
      body.lastName,
      body.email,
      body.phone ?? null,
      body.source,
      body.consentGivenOn ?? null,
      body.retentionUntil ?? null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      actorUserId,
    ],
  );
  const creato = await findCandidateById(db, r.rows[0]!.candidate_id);
  if (!creato) throw new Error("candidates: la riga appena creata non si rilegge");
  return creato;
}

/** `candidate_email` non compare: e' la chiave naturale, e non si modifica. */
export async function updateCandidatePartial(
  db: Db,
  id: string,
  patch: CandidateUpdateBody,
  actorUserId: string,
): Promise<Candidate | null> {
  const set: string[] = [];
  const val: unknown[] = [];
  const aggiungi = (colonna: string, valore: unknown, cast = "") => {
    val.push(valore);
    set.push(`${colonna} = $${val.length}${cast}`);
  };

  if (patch.firstName !== undefined) aggiungi("candidate_first_name", patch.firstName);
  if (patch.lastName !== undefined) aggiungi("candidate_last_name", patch.lastName);
  if (patch.phone !== undefined) aggiungi("candidate_phone", patch.phone);
  if (patch.source !== undefined) aggiungi("candidate_source", patch.source);
  if (patch.status !== undefined) aggiungi("candidate_status", patch.status);
  if (patch.externalCode !== undefined) aggiungi("candidate_external_code", patch.externalCode);
  if (patch.consentGivenOn !== undefined)
    aggiungi("candidate_consent_given_on", patch.consentGivenOn, "::date");
  if (patch.retentionUntil !== undefined)
    aggiungi("candidate_retention_until", patch.retentionUntil, "::date");
  if (patch.hiredUserId !== undefined) aggiungi("candidate_hired_user_id", patch.hiredUserId);
  if (patch.metadata !== undefined)
    aggiungi("candidate_metadata", JSON.stringify(patch.metadata), "::jsonb");

  if (set.length === 0) return findCandidateById(db, id);

  val.push(actorUserId);
  const iAttore = val.length;
  val.push(id);
  const iId = val.length;

  const r = await db.query<{ candidate_id: string }>(
    `UPDATE sys.sys_candidates
        SET ${set.join(", ")}, updated_by = $${iAttore}, updated_at = now()
      WHERE candidate_id = $${iId}
      RETURNING candidate_id`,
    val,
  );
  if (!r.rows[0]) return null;
  return findCandidateById(db, id);
}
