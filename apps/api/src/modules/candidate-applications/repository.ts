/**
 * apps/api/src/modules/candidate-applications/repository.ts
 * SQL parametrizzato su `sys.sys_candidate_applications` (#54 F2/F3, quarta fetta).
 */

import type { Pool, PoolClient } from "pg";

import type {
  CandidateApplication,
  CandidateApplicationCreateBody,
  CandidateApplicationListQuery,
  CandidateApplicationUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  application_id: string;
  application_tenant_id: string;
  application_candidate_id: string;
  application_posting_id: string;
  application_stage: string;
  application_applied_on: string;
  application_closed_on: string | null;
  application_reject_reason: string | null;
  application_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mappa(r: Row): CandidateApplication {
  return {
    applicationId: r.application_id,
    tenantId: r.application_tenant_id,
    candidateId: r.application_candidate_id,
    postingId: r.application_posting_id,
    stage: r.application_stage as CandidateApplication["stage"],
    appliedOn: r.application_applied_on,
    closedOn: r.application_closed_on,
    rejectReason: r.application_reject_reason,
    metadata: r.application_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

// Le due date escono come testo `YYYY-MM-DD` e non come istante: sono `date` nel modello
// (RD-09), e passarle per un timestamp le farebbe scivolare di un giorno a seconda del fuso.
const SELECT_BASE = `
  SELECT a.application_id, a.application_tenant_id, a.application_candidate_id,
         a.application_posting_id, a.application_stage,
         to_char(a.application_applied_on, 'YYYY-MM-DD') AS application_applied_on,
         to_char(a.application_closed_on,  'YYYY-MM-DD') AS application_closed_on,
         a.application_reject_reason, a.application_metadata,
         a.created_at, a.updated_at
    FROM sys.sys_candidate_applications a`;

export interface ListArgs extends CandidateApplicationListQuery {
  tenantId?: string | undefined;
}

export async function listApplications(
  db: Db,
  args: ListArgs,
): Promise<{ items: CandidateApplication[]; total: number }> {
  const cond: string[] = [];
  const params: unknown[] = [];
  const aggiungi = (sql: string, valore: unknown) => {
    params.push(valore);
    cond.push(sql.replace("$?", `$${params.length}`));
  };

  if (args.tenantId) aggiungi("a.application_tenant_id = $?", args.tenantId);
  if (args.stage) aggiungi("a.application_stage = $?", args.stage);
  if (args.candidateId) aggiungi("a.application_candidate_id = $?", args.candidateId);
  if (args.postingId) aggiungi("a.application_posting_id = $?", args.postingId);

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  const conteggio = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_candidate_applications a ${where}`,
    params,
  );

  const righe = await db.query<Row>(
    `${SELECT_BASE} ${where}
      ORDER BY a.application_applied_on DESC, a.application_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, args.limit, args.offset],
  );

  return { items: righe.rows.map(mappa), total: Number(conteggio.rows[0]!.n) };
}

export async function findApplicationById(
  db: Db,
  id: string,
): Promise<CandidateApplication | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE a.application_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/**
 * La stessa persona non si candida due volte allo stesso annuncio. Non c'e' un indice
 * unico che lo impedisca: senza questa lettura, un doppio invio del modulo produrrebbe due
 * candidature identiche e nessuno saprebbe quale seguire.
 */
export async function findApplicationByPair(
  db: Db,
  candidateId: string,
  postingId: string,
): Promise<CandidateApplication | null> {
  const r = await db.query<Row>(
    `${SELECT_BASE}
      WHERE a.application_candidate_id = $1 AND a.application_posting_id = $2
      ORDER BY a.application_applied_on DESC LIMIT 1`,
    [candidateId, postingId],
  );
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Il tenant di un candidato: serve a rifiutare una candidatura che scavalca l'azienda. */
export async function candidateTenant(db: Db, candidateId: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT candidate_tenant_id AS t FROM sys.sys_candidates WHERE candidate_id = $1`,
    [candidateId],
  );
  return r.rows[0]?.t ?? null;
}

/** Il tenant di un annuncio, per la stessa ragione. */
export async function postingTenant(db: Db, postingId: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT posting_tenant_id AS t FROM sys.sys_job_postings WHERE posting_id = $1`,
    [postingId],
  );
  return r.rows[0]?.t ?? null;
}

export async function insertApplication(
  db: Db,
  tenantId: string,
  body: CandidateApplicationCreateBody,
  attore: string | undefined,
): Promise<CandidateApplication> {
  // ⚠ DUE statement, e non e' una svista. La forma compatta
  // `WITH n AS (INSERT … RETURNING) SELECT … WHERE id = (SELECT … FROM n)` NON funziona:
  // in PostgreSQL la parte principale di uno statement vede lo stesso snapshot delle CTE
  // di scrittura, quindi la riga appena inserita non c'e' ancora e il SELECT torna vuoto.
  // Misurato: la prima corsa di questa fetta ha dato cinque rossi, il primo dei quali un
  // 500 «Cannot read properties of undefined (reading 'application_id')», e gli altri
  // quattro erano la sua conseguenza — senza id, le PATCH successive chiedevano
  // `/undefined` e cadevano sulla validazione. Le tre fette precedenti usano gia' questa
  // forma: bastava guardarle.
  const inserita = await db.query<{ application_id: string }>(
    `INSERT INTO sys.sys_candidate_applications
       (application_tenant_id, application_candidate_id, application_posting_id,
        application_stage, application_applied_on, application_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, 'APPLIED', coalesce($4::date, current_date),
             coalesce($5::jsonb, '{}'::jsonb), $6, $6)
     RETURNING application_id`,
    [
      tenantId,
      body.candidateId,
      body.postingId,
      body.appliedOn ?? null,
      JSON.stringify(body.metadata ?? {}),
      attore ?? null,
    ],
  );
  const creata = await findApplicationById(db, inserita.rows[0]!.application_id);
  if (!creata) throw new Error("la candidatura appena inserita non si rilegge");
  return creata;
}

/**
 * Modifica parziale: si scrive SOLO ciò che il chiamante ha nominato. `undefined` significa
 * «non toccare», `null` significa «svuota» — due cose diverse che un `??` confonderebbe.
 */
export async function updateApplicationPartial(
  db: Db,
  id: string,
  patch: CandidateApplicationUpdateBody,
  attore: string | undefined,
): Promise<CandidateApplication | null> {
  const set: string[] = [];
  const params: unknown[] = [];
  const scrivi = (sql: string, valore: unknown) => {
    params.push(valore);
    set.push(sql.replace("$?", `$${params.length}`));
  };

  if (patch.stage !== undefined) scrivi("application_stage = $?", patch.stage);
  if (patch.closedOn !== undefined) scrivi("application_closed_on = $?::date", patch.closedOn);
  if (patch.rejectReason !== undefined) scrivi("application_reject_reason = $?", patch.rejectReason);
  if (patch.metadata !== undefined) {
    scrivi("application_metadata = $?::jsonb", JSON.stringify(patch.metadata));
  }
  if (set.length === 0) return findApplicationById(db, id);

  params.push(attore ?? null);
  const attoreIdx = params.length;
  params.push(id);
  const idIdx = params.length;

  const agg = await db.query<{ application_id: string }>(
    `UPDATE sys.sys_candidate_applications
        SET ${set.join(", ")}, updated_at = now(), updated_by = $${attoreIdx}
      WHERE application_id = $${idIdx}
      RETURNING application_id`,
    params,
  );
  if (agg.rows.length === 0) return null;
  return findApplicationById(db, agg.rows[0]!.application_id);
}
