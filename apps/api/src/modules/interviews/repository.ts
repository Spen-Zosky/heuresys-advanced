/**
 * apps/api/src/modules/interviews/repository.ts
 * SQL parametrizzato su `sys.sys_interviews` (#54 F2/F3, quinta fetta).
 *
 * ⚠ Insert e update fanno DUE statement — scrittura, poi rilettura. La forma compatta
 * `WITH n AS (INSERT … RETURNING) SELECT …` non funziona: la parte principale vede lo stesso
 * snapshot delle CTE di scrittura, quindi la riga appena inserita non c'è ancora. Costato
 * cinque rossi nella quarta fetta, un'ora prima di questa.
 */

import type { Pool, PoolClient } from "pg";

import type {
  Interview,
  InterviewCreateBody,
  InterviewListQuery,
  InterviewUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  interview_id: string;
  interview_tenant_id: string;
  interview_application_id: string;
  interview_kind: string;
  interview_status: string;
  interview_scheduled_at: Date | null;
  interview_duration_min: number | null;
  interview_location: string | null;
  interview_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mappa(r: Row): Interview {
  return {
    interviewId: r.interview_id,
    tenantId: r.interview_tenant_id,
    applicationId: r.interview_application_id,
    kind: r.interview_kind as Interview["kind"],
    status: r.interview_status as Interview["status"],
    // `timestamptz`, non `date`: qui l'ora conta (RD-09), e va restituita come istante.
    scheduledAt: r.interview_scheduled_at ? new Date(r.interview_scheduled_at).toISOString() : null,
    durationMin: r.interview_duration_min,
    location: r.interview_location,
    metadata: r.interview_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT i.interview_id, i.interview_tenant_id, i.interview_application_id,
         i.interview_kind, i.interview_status, i.interview_scheduled_at,
         i.interview_duration_min, i.interview_location, i.interview_metadata,
         i.created_at, i.updated_at
    FROM sys.sys_interviews i`;

export interface ListArgs extends InterviewListQuery {
  tenantId?: string | undefined;
}

export async function listInterviews(
  db: Db,
  args: ListArgs,
): Promise<{ items: Interview[]; total: number }> {
  const cond: string[] = [];
  const params: unknown[] = [];
  const aggiungi = (sql: string, valore: unknown) => {
    params.push(valore);
    cond.push(sql.replace("$?", `$${params.length}`));
  };

  if (args.tenantId) aggiungi("i.interview_tenant_id = $?", args.tenantId);
  if (args.applicationId) aggiungi("i.interview_application_id = $?", args.applicationId);
  if (args.kind) aggiungi("i.interview_kind = $?", args.kind);
  if (args.status) aggiungi("i.interview_status = $?", args.status);

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  const conteggio = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_interviews i ${where}`,
    params,
  );

  // I colloqui senza data in coda: «da fissare» non è più recente di ciò che è già fissato.
  const righe = await db.query<Row>(
    `${SELECT_BASE} ${where}
      ORDER BY i.interview_scheduled_at DESC NULLS LAST, i.interview_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, args.limit, args.offset],
  );

  return { items: righe.rows.map(mappa), total: Number(conteggio.rows[0]!.n) };
}

export async function findInterviewById(db: Db, id: string): Promise<Interview | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE i.interview_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Il tenant della candidatura: serve a rifiutare un colloquio che scavalca l'azienda. */
export async function applicationTenant(db: Db, applicationId: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT application_tenant_id AS t FROM sys.sys_candidate_applications
      WHERE application_id = $1`,
    [applicationId],
  );
  return r.rows[0]?.t ?? null;
}

export async function insertInterview(
  db: Db,
  tenantId: string,
  body: InterviewCreateBody,
  attore: string | undefined,
): Promise<Interview> {
  const inserito = await db.query<{ interview_id: string }>(
    `INSERT INTO sys.sys_interviews
       (interview_tenant_id, interview_application_id, interview_kind, interview_status,
        interview_scheduled_at, interview_duration_min, interview_location,
        interview_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, 'SCHEDULED', $4::timestamptz, $5, $6,
             coalesce($7::jsonb, '{}'::jsonb), $8, $8)
     RETURNING interview_id`,
    [
      tenantId,
      body.applicationId,
      body.kind,
      body.scheduledAt ?? null,
      body.durationMin ?? null,
      body.location ?? null,
      JSON.stringify(body.metadata ?? {}),
      attore ?? null,
    ],
  );
  const creato = await findInterviewById(db, inserito.rows[0]!.interview_id);
  if (!creato) throw new Error("il colloquio appena inserito non si rilegge");
  return creato;
}

/**
 * Modifica parziale: si scrive SOLO ciò che il chiamante ha nominato. `undefined` significa
 * «non toccare», `null` significa «svuota» — due cose diverse che un `??` confonderebbe.
 */
export async function updateInterviewPartial(
  db: Db,
  id: string,
  patch: InterviewUpdateBody,
  attore: string | undefined,
): Promise<Interview | null> {
  const set: string[] = [];
  const params: unknown[] = [];
  const scrivi = (sql: string, valore: unknown) => {
    params.push(valore);
    set.push(sql.replace("$?", `$${params.length}`));
  };

  if (patch.kind !== undefined) scrivi("interview_kind = $?", patch.kind);
  if (patch.status !== undefined) scrivi("interview_status = $?", patch.status);
  if (patch.scheduledAt !== undefined) {
    scrivi("interview_scheduled_at = $?::timestamptz", patch.scheduledAt);
  }
  if (patch.durationMin !== undefined) scrivi("interview_duration_min = $?", patch.durationMin);
  if (patch.location !== undefined) scrivi("interview_location = $?", patch.location);
  if (patch.metadata !== undefined) {
    scrivi("interview_metadata = $?::jsonb", JSON.stringify(patch.metadata));
  }
  if (set.length === 0) return findInterviewById(db, id);

  params.push(attore ?? null);
  const attoreIdx = params.length;
  params.push(id);
  const idIdx = params.length;

  const agg = await db.query<{ interview_id: string }>(
    `UPDATE sys.sys_interviews
        SET ${set.join(", ")}, updated_at = now(), updated_by = $${attoreIdx}
      WHERE interview_id = $${idIdx}
      RETURNING interview_id`,
    params,
  );
  if (agg.rows.length === 0) return null;
  return findInterviewById(db, agg.rows[0]!.interview_id);
}
