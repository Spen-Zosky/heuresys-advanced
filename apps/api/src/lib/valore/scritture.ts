/**
 * apps/api/src/lib/valore/scritture.ts — piano interfacce L9, A-1 (migrazione 000477).
 *
 * Il registro di OGNI scrittura su /v1/* di chi è autenticato (`audit.registro_scritture`).
 * Lo chiama il gancio `onResponse` di registro.ts, dopo l'invio della risposta: non è una
 * rotta, non riceve richieste dall'esterno, e le rotte che lo alimentano sono tutte sotto il
 * limite di frequenza globale di app.ts.
 */
import type { FastifyReply, FastifyRequest } from "fastify";

import { pool } from "../../db/client.js";

const METODI_DI_SCRITTURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SQL_INSERIMENTO = `INSERT INTO audit.registro_scritture
       (registro_scrittura_tenant_id, registro_scrittura_attore_tipo, registro_scrittura_persona_user_id,
        registro_scrittura_agente_codice, registro_scrittura_agente_compito, registro_scrittura_gettone_jti,
        registro_scrittura_metodo, registro_scrittura_rotta, registro_scrittura_stato_http,
        registro_scrittura_richiesta_id, registro_scrittura_dettaglio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

/** Il modello di rotta senza barra finale, come nel catalogo delle decisioni. */
function senzaBarraFinale(rotta: string): string {
  return rotta.length > 1 && rotta.endsWith("/") ? rotta.slice(0, -1) : rotta;
}

async function inserisciScrittura(valori: unknown[]): Promise<void> {
  await pool.query(SQL_INSERIMENTO, valori);
}

/**
 * L9, A-1 (migrazione 000477): ogni scrittura su /v1/* di chi è autenticato, con qualunque
 * esito, in `audit.registro_scritture`: chi (persona o agente), per conto di chi, che cosa,
 * quando, con quale risposta. È un registro diverso dalle decisioni di registro.ts: quelle sono le
 * sole scritture del catalogo andate a buon fine, questo le tiene tutte.
 */
export async function registraScrittura(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!METODI_DI_SCRITTURA.has(req.method)) return;
  const user = req.user;
  if (!user) return;
  const modello = req.routeOptions?.url;
  if (!modello || !modello.startsWith("/v1/")) return;
  const agente = user.agente;
  await inserisciScrittura([
    user.tenantId,
    agente ? "agente" : "persona",
    user.userId,
    agente?.codice ?? null,
    agente?.compito ?? null,
    user.jti ?? null,
    req.method,
    senzaBarraFinale(modello),
    reply.statusCode,
    String(req.id),
    req.dettaglioScrittura ? JSON.stringify(req.dettaglioScrittura) : null,
  ]);
}
