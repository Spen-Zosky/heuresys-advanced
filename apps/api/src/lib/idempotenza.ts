/**
 * apps/api/src/lib/idempotenza.ts — piano interfacce L10, voce A-10 (migrazione 000478).
 *
 * `Idempotency-Key` sulle scritture: un agente (o una persona) che riprova la stessa scrittura
 * non la duplica. La chiave è di chi chiama (persona, e agente se è un gettone d'agente) e vive
 * 24 ore in `audit.chiavi_idempotenza`.
 *
 *  - prima volta: si scrive la riga «in corso» con l'impronta della richiesta, la scrittura
 *    procede, e la risposta (stato, tipo, corpo) si conserva; una 5xx non si conserva e la riga
 *    si toglie, così si può ripetere;
 *  - stessa chiave, stessa richiesta: si ripete la risposta di allora, con
 *    `Idempotent-Replayed: true`, senza eseguire di nuovo la scrittura;
 *  - stessa chiave, richiesta diversa (metodo, percorso o corpo): 422 IDEMPOTENCY_KEY_REUSED;
 *  - stessa chiave mentre la prima è in corso: 409 IDEMPOTENCY_IN_PROGRESS.
 *
 * Fuori: le richieste senza la chiave (nulla cambia), quelle senza sessione e la superficie di
 * autenticazione (`/v1/auth/*`), dove una risposta ripetuta porterebbe credenziali.
 */
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { pool } from "../db/client.js";
import { ConflictError, UnprocessableEntityError, ValidationError } from "../errors/index.js";

export const INTESTAZIONE_IDEMPOTENZA = "idempotency-key";
export const INTESTAZIONE_RIPETUTA = "idempotent-replayed";

const METODI = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CHIAVE_VALIDA = /^[\x21-\x7e]{1,128}$/;

declare module "fastify" {
  interface FastifyRequest {
    /** La riga di audit.chiavi_idempotenza di questa richiesta, se la richiesta l'ha aperta. */
    chiaveIdempotenzaId?: string;
  }
}

interface RigaChiave {
  id: string;
  impronta: string;
  stato: "in_corso" | "conclusa";
  stato_http: number | null;
  tipo: string | null;
  corpo: string | null;
}

/** L'impronta della richiesta: metodo, percorso concreto (con la query) e corpo. */
export function improntaRichiesta(metodo: string, url: string, corpo: unknown): string {
  return createHash("sha256")
    .update(`${metodo}\n${url}\n${corpo === undefined ? "" : JSON.stringify(corpo)}`)
    .digest("hex");
}

function sottoChiave(req: FastifyRequest): { chiave: string } | null {
  if (!METODI.has(req.method)) return null;
  const grezza = req.headers[INTESTAZIONE_IDEMPOTENZA];
  if (grezza === undefined) return null;
  if (!req.user) return null;
  const rotta = req.routeOptions?.url ?? "";
  if (!rotta.startsWith("/v1/") || rotta.startsWith("/v1/auth/")) return null;
  const chiave = Array.isArray(grezza) ? grezza[0] : grezza;
  if (!chiave || !CHIAVE_VALIDA.test(chiave)) {
    throw new ValidationError(
      { header: "Idempotency-Key" },
      "Idempotency-Key must be 1 to 128 visible ASCII characters",
    );
  }
  return { chiave };
}

async function apri(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
  const sotto = sottoChiave(req);
  if (!sotto) return undefined;
  const user = req.user!;
  const agente = user.agente?.codice ?? "";
  const impronta = improntaRichiesta(req.method, req.url, req.body);

  // Le chiavi scadute di chi chiama si tolgono qui: niente lavoro pianificato, e la tabella
  // resta piccola (24 ore di scritture con chiave, per persona).
  // Così anche una riga rimasta «in corso» da una richiesta interrotta (il processo è caduto a
  // metà) dopo cinque minuti non blocca più chi riprova.
  await pool.query(
    `DELETE FROM audit.chiavi_idempotenza
      WHERE chiave_idempotenza_user_id = $1
        AND (chiave_idempotenza_scade_il < now()
             OR (chiave_idempotenza_stato = 'in_corso' AND chiave_idempotenza_creata_il < now() - interval '5 minutes'))`,
    [user.userId],
  );
  const nuova = await pool.query<{ id: string }>(
    `INSERT INTO audit.chiavi_idempotenza
       (chiave_idempotenza_user_id, chiave_idempotenza_agente, chiave_idempotenza_chiave,
        chiave_idempotenza_impronta, chiave_idempotenza_metodo, chiave_idempotenza_rotta)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (chiave_idempotenza_user_id, chiave_idempotenza_agente, chiave_idempotenza_chiave) DO NOTHING
     RETURNING chiave_idempotenza_id::text AS id`,
    [user.userId, agente, sotto.chiave, impronta, req.method, (req.routeOptions?.url ?? "").slice(0, 200)],
  );
  if (nuova.rows[0]) {
    req.chiaveIdempotenzaId = nuova.rows[0].id;
    return undefined;
  }

  const r = await pool.query<RigaChiave>(
    `SELECT chiave_idempotenza_id::text AS id, chiave_idempotenza_impronta AS impronta,
            chiave_idempotenza_stato AS stato, chiave_idempotenza_stato_http AS stato_http,
            chiave_idempotenza_tipo AS tipo, chiave_idempotenza_corpo AS corpo
       FROM audit.chiavi_idempotenza
      WHERE chiave_idempotenza_user_id = $1 AND chiave_idempotenza_agente = $2
        AND chiave_idempotenza_chiave = $3`,
    [user.userId, agente, sotto.chiave],
  );
  const riga = r.rows[0];
  if (!riga) {
    // Tolta fra l'inserimento mancato e la lettura (una 5xx concorrente): si chiede di riprovare.
    throw new ConflictError("The request with this Idempotency-Key is being retried; repeat it", "IDEMPOTENCY_IN_PROGRESS");
  }
  if (riga.impronta !== impronta) {
    throw new UnprocessableEntityError(
      { header: "Idempotency-Key" },
      "This Idempotency-Key was used for a different request (method, path or body)",
      "IDEMPOTENCY_KEY_REUSED",
    );
  }
  if (riga.stato === "in_corso" || riga.stato_http === null) {
    throw new ConflictError("A request with this Idempotency-Key is still in progress", "IDEMPOTENCY_IN_PROGRESS");
  }
  reply.code(riga.stato_http).header(INTESTAZIONE_RIPETUTA, "true");
  if (riga.tipo) reply.type(riga.tipo);
  return reply.send(riga.corpo === null || riga.corpo === "" ? undefined : riga.corpo);
}

async function chiudi(req: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<void> {
  const id = req.chiaveIdempotenzaId;
  if (!id) return;
  const stato = reply.statusCode;
  const corpo = typeof payload === "string" ? payload : Buffer.isBuffer(payload) ? payload.toString("utf8") : null;
  // Una 5xx (o un flusso, che non si può ripetere) non si conserva: la riga si toglie e si riprova.
  if (stato >= 500 || (payload !== null && payload !== undefined && corpo === null)) {
    await pool.query("DELETE FROM audit.chiavi_idempotenza WHERE chiave_idempotenza_id = $1", [id]);
    req.chiaveIdempotenzaId = undefined;
    return;
  }
  const tipo = reply.getHeader("content-type");
  await pool.query(
    `UPDATE audit.chiavi_idempotenza
        SET chiave_idempotenza_stato = 'conclusa', chiave_idempotenza_stato_http = $2,
            chiave_idempotenza_tipo = $3, chiave_idempotenza_corpo = $4
      WHERE chiave_idempotenza_id = $1`,
    [id, stato, typeof tipo === "string" ? tipo.slice(0, 100) : null, corpo],
  );
  req.chiaveIdempotenzaId = undefined;
}

/**
 * Da chiamare prima di registrare le rotte (onRoute vede solo quelle dichiarate dopo). La chiave
 * si apre come ULTIMO preHandler della rotta: dopo il CSRF e il permesso, così una risposta si
 * ripete solo a chi può ancora fare quella scrittura.
 */
export function registraIdempotenza(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const metodi = Array.isArray(route.method) ? route.method : [route.method];
    if (!metodi.some((m) => METODI.has(m))) return;
    if (!route.url.startsWith("/v1/") || route.url.startsWith("/v1/auth/")) return;
    const pre = route.preHandler;
    const esistenti = pre === undefined ? [] : Array.isArray(pre) ? pre : [pre];
    route.preHandler = [...esistenti, async function chiaveDiIdempotenza(req: FastifyRequest, reply: FastifyReply) {
      return apri(req, reply);
    }];
  });
  app.addHook("onSend", async (req, reply, payload) => {
    try {
      await chiudi(req, reply, payload);
    } catch (err) {
      req.log.warn({ err }, "idempotenza: la risposta non si è potuta conservare");
      const id = req.chiaveIdempotenzaId;
      if (id) await pool.query("DELETE FROM audit.chiavi_idempotenza WHERE chiave_idempotenza_id = $1", [id]).catch(() => undefined);
    }
    return payload;
  });
}
