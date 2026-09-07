/**
 * apps/api/src/modules/interview-feedback/repository.ts
 * SQL parametrizzato su `sys.sys_interview_feedback` (#54 F2/F3, sesta fetta).
 *
 * ⚠ Insert e update fanno DUE statement — scrittura, poi rilettura. La forma compatta
 * `WITH n AS (INSERT … RETURNING) SELECT …` non funziona: la parte principale vede lo stesso
 * snapshot delle CTE di scrittura, quindi la riga appena inserita non c'è ancora. È costata
 * cinque rossi nella quarta fetta, e le fette successive nascono già con la forma giusta.
 *
 * ⚠ `feedback_submitted_on` la mette il DATABASE con `current_date` quando il chiamante non
 * la dichiara. Non è pigrizia: `toISOString()` è UTC, `current_date` è il fuso del server, e
 * dopo mezzanotte locale dicono giorni diversi.
 */

import type { Pool, PoolClient } from "pg";

import type {
  InterviewFeedback,
  InterviewFeedbackCreateBody,
  InterviewFeedbackListQuery,
  InterviewFeedbackUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  feedback_id: string;
  feedback_tenant_id: string;
  feedback_interview_id: string;
  feedback_interviewer_user_id: string;
  feedback_recommendation: string;
  feedback_score: string | null;
  feedback_notes: string | null;
  feedback_submitted_on: Date | string | null;
  feedback_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** `date` in uscita è una data e basta: `YYYY-MM-DD`, senza ora e senza fuso (RD-09). */
function soloData(v: Date | string | null): string | null {
  if (v === null) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, "0");
  const g = String(v.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

function mappa(r: Row): InterviewFeedback {
  return {
    feedbackId: r.feedback_id,
    tenantId: r.feedback_tenant_id,
    interviewId: r.feedback_interview_id,
    interviewerUserId: r.feedback_interviewer_user_id,
    recommendation: r.feedback_recommendation as InterviewFeedback["recommendation"],
    // `numeric` torna come stringa dal driver: senza la conversione il contratto,
    // che dichiara un numero, respingerebbe la propria stessa risposta.
    score: r.feedback_score === null ? null : Number(r.feedback_score),
    notes: r.feedback_notes,
    submittedOn: soloData(r.feedback_submitted_on),
    metadata: r.feedback_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT f.feedback_id, f.feedback_tenant_id, f.feedback_interview_id,
         f.feedback_interviewer_user_id, f.feedback_recommendation, f.feedback_score,
         f.feedback_notes, f.feedback_submitted_on, f.feedback_metadata,
         f.created_at, f.updated_at
    FROM sys.sys_interview_feedback f`;

export interface ListArgs extends InterviewFeedbackListQuery {
  tenantId?: string | undefined;
}

export async function listFeedback(
  db: Db,
  args: ListArgs,
): Promise<{ items: InterviewFeedback[]; total: number }> {
  const cond: string[] = [];
  const params: unknown[] = [];
  const aggiungi = (sql: string, valore: unknown) => {
    params.push(valore);
    cond.push(sql.replace("$?", `$${params.length}`));
  };

  if (args.tenantId) aggiungi("f.feedback_tenant_id = $?", args.tenantId);
  if (args.interviewId) aggiungi("f.feedback_interview_id = $?", args.interviewId);
  if (args.interviewerUserId) {
    aggiungi("f.feedback_interviewer_user_id = $?", args.interviewerUserId);
  }
  if (args.recommendation) aggiungi("f.feedback_recommendation = $?", args.recommendation);

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  const conteggio = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_interview_feedback f ${where}`,
    params,
  );

  // Le valutazioni non ancora datate in coda: «non consegnata» non è più recente di una
  // consegnata. Stessa scelta d'ordinamento dei colloqui senza data.
  const righe = await db.query<Row>(
    `${SELECT_BASE} ${where}
      ORDER BY f.feedback_submitted_on DESC NULLS LAST, f.feedback_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, args.limit, args.offset],
  );

  return { items: righe.rows.map(mappa), total: Number(conteggio.rows[0]!.n) };
}

export async function findFeedbackById(db: Db, id: string): Promise<InterviewFeedback | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE f.feedback_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Tenant e stato del colloquio: servono a rifiutare lo scavalco e la valutazione impossibile. */
export async function interviewInfo(
  db: Db,
  interviewId: string,
): Promise<{ tenantId: string; status: string } | null> {
  const r = await db.query<{ t: string; s: string }>(
    `SELECT interview_tenant_id AS t, interview_status AS s FROM sys.sys_interviews
      WHERE interview_id = $1`,
    [interviewId],
  );
  const riga = r.rows[0];
  return riga ? { tenantId: riga.t, status: riga.s } : null;
}

/** Il tenant dell'intervistatore: la FK verso `sys_users` guarda l'esistenza, non l'azienda. */
export async function userTenant(db: Db, userId: string): Promise<string | null> {
  const r = await db.query<{ t: string | null }>(
    `SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  return r.rows[0]?.t ?? null;
}

/** La valutazione già data da quella persona su quel colloquio, se c'è (vincolo di unicità). */
export async function findFeedbackByPair(
  db: Db,
  interviewId: string,
  interviewerUserId: string,
): Promise<InterviewFeedback | null> {
  const r = await db.query<Row>(
    `${SELECT_BASE}
      WHERE f.feedback_interview_id = $1 AND f.feedback_interviewer_user_id = $2`,
    [interviewId, interviewerUserId],
  );
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

export async function insertFeedback(
  db: Db,
  tenantId: string,
  body: InterviewFeedbackCreateBody,
  attore: string | undefined,
): Promise<InterviewFeedback> {
  const inserito = await db.query<{ feedback_id: string }>(
    `INSERT INTO sys.sys_interview_feedback
       (feedback_tenant_id, feedback_interview_id, feedback_interviewer_user_id,
        feedback_recommendation, feedback_score, feedback_notes, feedback_submitted_on,
        feedback_metadata, created_by, updated_by)
     VALUES ($1, $2, $3, coalesce($4, 'NEUTRAL'), $5, $6,
             coalesce($7::date, current_date),
             coalesce($8::jsonb, '{}'::jsonb), $9, $9)
     RETURNING feedback_id`,
    [
      tenantId,
      body.interviewId,
      body.interviewerUserId,
      body.recommendation ?? null,
      body.score ?? null,
      body.notes ?? null,
      body.submittedOn ?? null,
      JSON.stringify(body.metadata ?? {}),
      attore ?? null,
    ],
  );
  const creato = await findFeedbackById(db, inserito.rows[0]!.feedback_id);
  if (!creato) throw new Error("la valutazione appena inserita non si rilegge");
  return creato;
}

/**
 * Modifica parziale: si scrive SOLO ciò che il chiamante ha nominato. `undefined` significa
 * «non toccare», `null` significa «svuota» — due cose diverse che un `??` confonderebbe.
 */
export async function updateFeedbackPartial(
  db: Db,
  id: string,
  patch: InterviewFeedbackUpdateBody,
  attore: string | undefined,
): Promise<InterviewFeedback | null> {
  const set: string[] = [];
  const params: unknown[] = [];
  const scrivi = (sql: string, valore: unknown) => {
    params.push(valore);
    set.push(sql.replace("$?", `$${params.length}`));
  };

  if (patch.recommendation !== undefined) {
    scrivi("feedback_recommendation = $?", patch.recommendation);
  }
  if (patch.score !== undefined) scrivi("feedback_score = $?", patch.score);
  if (patch.notes !== undefined) scrivi("feedback_notes = $?", patch.notes);
  if (patch.submittedOn !== undefined) {
    scrivi("feedback_submitted_on = $?::date", patch.submittedOn);
  }
  if (patch.metadata !== undefined) {
    scrivi("feedback_metadata = $?::jsonb", JSON.stringify(patch.metadata));
  }
  if (set.length === 0) return findFeedbackById(db, id);

  params.push(attore ?? null);
  const attoreIdx = params.length;
  params.push(id);
  const idIdx = params.length;

  const agg = await db.query<{ feedback_id: string }>(
    `UPDATE sys.sys_interview_feedback
        SET ${set.join(", ")}, updated_at = now(), updated_by = $${attoreIdx}
      WHERE feedback_id = $${idIdx}
      RETURNING feedback_id`,
    params,
  );
  if (agg.rows.length === 0) return null;
  return findFeedbackById(db, agg.rows[0]!.feedback_id);
}
