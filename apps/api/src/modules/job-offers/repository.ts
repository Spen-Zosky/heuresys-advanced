/**
 * apps/api/src/modules/job-offers/repository.ts
 * SQL parametrizzato su `sys.sys_job_offers` (#54 F2/F3, settima e ultima fetta).
 *
 * ⚠ Insert e update fanno DUE statement — scrittura, poi rilettura. La forma compatta
 * `WITH n AS (INSERT … RETURNING) SELECT …` non funziona: la parte principale vede lo stesso
 * snapshot delle CTE di scrittura, quindi la riga appena inserita non c'è ancora.
 *
 * ⚠ Le date qui sono `date` e non `timestamptz` (RD-09): di un'offerta conta il giorno in
 * cui è stata mandata, non l'ora. Escono come `YYYY-MM-DD`, senza fuso — e non si
 * costruiscono mai in JavaScript, che ragiona in UTC mentre `current_date` è il fuso del
 * server.
 */

import type { Pool, PoolClient } from "pg";

import type {
  JobOffer,
  JobOfferCreateBody,
  JobOfferListQuery,
  JobOfferUpdateBody,
} from "@heuresys/shared";

type Db = Pool | PoolClient;

interface Row {
  offer_id: string;
  offer_tenant_id: string;
  offer_application_id: string;
  offer_status: string;
  offer_gross_annual_salary: string | null;
  offer_contract_type: string | null;
  offer_start_date: Date | string | null;
  offer_sent_on: Date | string | null;
  offer_responded_on: Date | string | null;
  offer_metadata: Record<string, unknown>;
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

function mappa(r: Row): JobOffer {
  return {
    offerId: r.offer_id,
    tenantId: r.offer_tenant_id,
    applicationId: r.offer_application_id,
    status: r.offer_status as JobOffer["status"],
    // `numeric` torna come stringa dal driver: senza la conversione il contratto,
    // che dichiara un numero, respingerebbe la propria stessa risposta.
    grossAnnualSalary:
      r.offer_gross_annual_salary === null ? null : Number(r.offer_gross_annual_salary),
    contractType: r.offer_contract_type,
    startDate: soloData(r.offer_start_date),
    sentOn: soloData(r.offer_sent_on),
    respondedOn: soloData(r.offer_responded_on),
    metadata: r.offer_metadata ?? {},
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SELECT_BASE = `
  SELECT o.offer_id, o.offer_tenant_id, o.offer_application_id, o.offer_status,
         o.offer_gross_annual_salary, o.offer_contract_type, o.offer_start_date,
         o.offer_sent_on, o.offer_responded_on, o.offer_metadata,
         o.created_at, o.updated_at
    FROM sys.sys_job_offers o`;

export interface ListArgs extends JobOfferListQuery {
  tenantId?: string | undefined;
}

export async function listOffers(
  db: Db,
  args: ListArgs,
): Promise<{ items: JobOffer[]; total: number }> {
  const cond: string[] = [];
  const params: unknown[] = [];
  const aggiungi = (sql: string, valore: unknown) => {
    params.push(valore);
    cond.push(sql.replace("$?", `$${params.length}`));
  };

  if (args.tenantId) aggiungi("o.offer_tenant_id = $?", args.tenantId);
  if (args.applicationId) aggiungi("o.offer_application_id = $?", args.applicationId);
  if (args.status) aggiungi("o.offer_status = $?", args.status);

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

  const conteggio = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_job_offers o ${where}`,
    params,
  );

  // Le bozze mai spedite in coda: non sono più recenti di ciò che è stato mandato davvero.
  const righe = await db.query<Row>(
    `${SELECT_BASE} ${where}
      ORDER BY o.offer_sent_on DESC NULLS LAST, o.offer_id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, args.limit, args.offset],
  );

  return { items: righe.rows.map(mappa), total: Number(conteggio.rows[0]!.n) };
}

export async function findOfferById(db: Db, id: string): Promise<JobOffer | null> {
  const r = await db.query<Row>(`${SELECT_BASE} WHERE o.offer_id = $1`, [id]);
  return r.rows[0] ? mappa(r.rows[0]) : null;
}

/** Il tenant della candidatura: serve a rifiutare un'offerta che scavalca l'azienda. */
export async function applicationTenant(db: Db, applicationId: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT application_tenant_id AS t FROM sys.sys_candidate_applications
      WHERE application_id = $1`,
    [applicationId],
  );
  return r.rows[0]?.t ?? null;
}

/**
 * Le offerte già VIVE su una candidatura: bozza, spedita o accettata. Servono a impedire
 * che la stessa persona riceva due proposte economiche contemporaneamente per lo stesso
 * posto — cosa che nessun vincolo del database impedisce.
 */
export async function offerteVive(db: Db, applicationId: string): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_job_offers
      WHERE offer_application_id = $1
        AND offer_status IN ('DRAFT','SENT','ACCEPTED')`,
    [applicationId],
  );
  return Number(r.rows[0]!.n);
}

export async function insertOffer(
  db: Db,
  tenantId: string,
  body: JobOfferCreateBody,
  attore: string | undefined,
): Promise<JobOffer> {
  const inserito = await db.query<{ offer_id: string }>(
    `INSERT INTO sys.sys_job_offers
       (offer_tenant_id, offer_application_id, offer_status, offer_gross_annual_salary,
        offer_contract_type, offer_start_date, offer_metadata, created_by, updated_by)
     VALUES ($1, $2, 'DRAFT', $3, $4, $5::date,
             coalesce($6::jsonb, '{}'::jsonb), $7, $7)
     RETURNING offer_id`,
    [
      tenantId,
      body.applicationId,
      body.grossAnnualSalary ?? null,
      body.contractType ?? null,
      body.startDate ?? null,
      JSON.stringify(body.metadata ?? {}),
      attore ?? null,
    ],
  );
  const creato = await findOfferById(db, inserito.rows[0]!.offer_id);
  if (!creato) throw new Error("l'offerta appena inserita non si rilegge");
  return creato;
}

/**
 * Modifica parziale: si scrive SOLO ciò che il chiamante ha nominato. `undefined` significa
 * «non toccare», `null` significa «svuota» — due cose diverse che un `??` confonderebbe.
 */
export async function updateOfferPartial(
  db: Db,
  id: string,
  patch: JobOfferUpdateBody,
  /** Date decise dal service e scritte dal DATABASE: `null` = non toccare. */
  date: { sentOn?: "oggi"; respondedOn?: "oggi" },
  attore: string | undefined,
): Promise<JobOffer | null> {
  const set: string[] = [];
  const params: unknown[] = [];
  const scrivi = (sql: string, valore: unknown) => {
    params.push(valore);
    set.push(sql.replace("$?", `$${params.length}`));
  };

  if (patch.status !== undefined) scrivi("offer_status = $?", patch.status);
  if (patch.grossAnnualSalary !== undefined) {
    scrivi("offer_gross_annual_salary = $?", patch.grossAnnualSalary);
  }
  if (patch.contractType !== undefined) scrivi("offer_contract_type = $?", patch.contractType);
  if (patch.startDate !== undefined) scrivi("offer_start_date = $?::date", patch.startDate);
  if (patch.sentOn !== undefined) scrivi("offer_sent_on = $?::date", patch.sentOn);
  if (patch.respondedOn !== undefined) {
    scrivi("offer_responded_on = $?::date", patch.respondedOn);
  }
  if (patch.metadata !== undefined) {
    scrivi("offer_metadata = $?::jsonb", JSON.stringify(patch.metadata));
  }

  // ⚠ `current_date`, non una data costruita qui: `toISOString()` è UTC e il database
  // ragiona nel fuso del server. Dopo mezzanotte locale dicono giorni diversi, e il
  // `dates_check` respingerebbe una risposta «precedente» al proprio invio.
  if (date.sentOn === "oggi" && patch.sentOn === undefined) {
    set.push("offer_sent_on = current_date");
  }
  if (date.respondedOn === "oggi" && patch.respondedOn === undefined) {
    set.push("offer_responded_on = current_date");
  }

  if (set.length === 0) return findOfferById(db, id);

  params.push(attore ?? null);
  const attoreIdx = params.length;
  params.push(id);
  const idIdx = params.length;

  const agg = await db.query<{ offer_id: string }>(
    `UPDATE sys.sys_job_offers
        SET ${set.join(", ")}, updated_at = now(), updated_by = $${attoreIdx}
      WHERE offer_id = $${idIdx}
      RETURNING offer_id`,
    params,
  );
  if (agg.rows.length === 0) return null;
  return findOfferById(db, agg.rows[0]!.offer_id);
}
