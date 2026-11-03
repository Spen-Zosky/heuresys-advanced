/**
 * apps/api/src/lib/valore/registro.ts — F0-3, il test del valore come misura.
 *
 * Dopo ogni risposta l'API scrive in `audit.valore_eventi` (migrazione 000469):
 *  - una DECISIONE per ogni risposta 2xx su una rotta del catalogo
 *    `audit.valore_rotte_decisione`, con chi, che cosa, su quale oggetto, l'esito
 *    se la rotta lo porta, e la superficie (pagina, agente o `api` se manca);
 *  - un USO per ogni lettura 2xx che arriva da una pagina o da un agente, al più
 *    uno per persona, superficie e ora (il denominatore della misura).
 *
 * CHI ha agito viene dal token (`req.user`), mai dall'intestazione: la superficie è
 * contesto dichiarato dal client, non identità. Una richiesta senza tenant (un
 * mandato di piattaforma) non è una decisione di un tenant e non si registra.
 *
 * Il registro non deve mai rompere una risposta: tutto gira in `onResponse`, dopo
 * l'invio, dentro un try/catch, e un errore finisce nel log come avviso.
 *
 * Il catalogo è DATI nel database, non codice: la definizione di decisione
 * tracciabile è una sola, e si interroga con una query. Qui si legge con una cache
 * di cinque minuti, così un tipo nuovo entra con la sua migrazione senza riavvio.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SUPERFICIE_HEADER, leggiSuperficie, type Superficie } from "@heuresys/shared";

import { pool } from "../../db/client.js";
import { estraiValori } from "./estrai.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Corpo della risposta così come è partito (testo JSON), tenuto da onSend per onResponse. */
    valoreRispostaGrezza?: string;
  }
}

export interface RottaDecisione {
  codice: string;
  oggettoTipo: string;
  oggettoDa: string;
  esitoDa: string | null;
}

const TTL_MS = 5 * 60_000;
const SCRITTURE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let cache: { letto: number; mappa: Map<string, RottaDecisione> } | null = null;
let inCorso: Promise<Map<string, RottaDecisione>> | null = null;

/** Chiave del catalogo: metodo e modello di rotta senza barra finale. */
export function chiaveRotta(metodo: string, rotta: string): string {
  const r = rotta.length > 1 && rotta.endsWith("/") ? rotta.slice(0, -1) : rotta;
  return `${metodo.toUpperCase()} ${r}`;
}

/** Svuota la cache: la usano le prove dopo aver cambiato il catalogo. */
export function invalidaCatalogoValore(): void {
  cache = null;
}

async function leggiCatalogo(): Promise<Map<string, RottaDecisione>> {
  const r = await pool.query<{ metodo: string; rotta: string; codice: string; oggetto_tipo: string; oggetto_da: string; esito_da: string | null }>(
    `SELECT r.metodo, r.rotta, r.codice, r.oggetto_tipo, r.oggetto_da, r.esito_da
       FROM audit.valore_rotte_decisione r
       JOIN audit.valore_tipi_decisione t ON t.codice = r.codice
      WHERE t.attivo`,
  );
  const mappa = new Map<string, RottaDecisione>();
  for (const x of r.rows) {
    mappa.set(chiaveRotta(x.metodo, x.rotta), {
      codice: x.codice,
      oggettoTipo: x.oggetto_tipo,
      oggettoDa: x.oggetto_da,
      esitoDa: x.esito_da,
    });
  }
  return mappa;
}

/** Il catalogo, dalla cache se fresca. Un database senza la migrazione dà un catalogo vuoto. */
export async function catalogoValore(req: FastifyRequest): Promise<Map<string, RottaDecisione>> {
  if (cache && Date.now() - cache.letto < TTL_MS) return cache.mappa;
  if (!inCorso) {
    inCorso = leggiCatalogo()
      .then((mappa) => {
        cache = { letto: Date.now(), mappa };
        return mappa;
      })
      .catch((err: unknown) => {
        req.log.warn({ err }, "valore: catalogo delle decisioni non leggibile, registro sospeso per 5 minuti");
        const vuota = new Map<string, RottaDecisione>();
        cache = { letto: Date.now(), mappa: vuota };
        return vuota;
      })
      .finally(() => {
        inCorso = null;
      });
  }
  return inCorso;
}

// L'uso si conta una volta per persona, superficie e ora: questa memoria evita una
// scrittura per ogni lettura di una pagina. L'indice unico nel database resta la
// garanzia vera (più processi, riavvii); qui si risparmiano solo i viaggi.
let oraMemoria = "";
const usiVisti = new Set<string>();
const MAX_USI_IN_MEMORIA = 50_000;

function inizioOra(d: Date): Date {
  const o = new Date(d);
  o.setUTCMinutes(0, 0, 0);
  return o;
}

function superficieDi(req: FastifyRequest): Superficie | null {
  return leggiSuperficie(req.headers[SUPERFICIE_HEADER]);
}

async function registraUso(req: FastifyRequest, tenantId: string, userId: string, sup: Superficie, rotta: string): Promise<void> {
  const ora = inizioOra(new Date());
  const oraChiave = ora.toISOString();
  if (oraChiave !== oraMemoria || usiVisti.size > MAX_USI_IN_MEMORIA) {
    oraMemoria = oraChiave;
    usiVisti.clear();
  }
  const chiave = `${tenantId}|${userId}|${sup.tipo}|${sup.valore}`;
  if (usiVisti.has(chiave)) return;
  usiVisti.add(chiave);
  await pool.query(
    `INSERT INTO audit.valore_eventi
       (valore_evento_tenant_id, valore_evento_tipo, valore_evento_attore_user_id, valore_evento_attore_tipo,
        valore_evento_superficie_tipo, valore_evento_superficie, valore_evento_metodo, valore_evento_rotta,
        valore_evento_richiesta_id, valore_evento_ora_uso)
     VALUES ($1, 'uso', $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [tenantId, userId, sup.tipo === "agente" ? "agente" : "persona", sup.tipo, sup.valore, req.method, rotta, String(req.id), ora],
  );
}

/** Il corpo della risposta, letto solo se la rotta ne prende l'oggetto o l'esito. */
function leggiRisposta(req: FastifyRequest, voce: RottaDecisione): unknown {
  const serve = voce.oggettoDa.startsWith("risposta:") || (voce.esitoDa?.startsWith("risposta:") ?? false);
  if (!serve || req.valoreRispostaGrezza === undefined) return null;
  try {
    return JSON.parse(req.valoreRispostaGrezza) as unknown;
  } catch {
    return null;
  }
}

async function registraDecisioni(
  req: FastifyRequest,
  tenantId: string,
  userId: string,
  sup: Superficie | null,
  rotta: string,
  voce: RottaDecisione,
): Promise<void> {
  const ctx = { params: req.params, corpo: req.body, risposta: leggiRisposta(req, voce) };
  const oggetti = estraiValori(voce.oggettoDa, ctx);
  const esito = estraiValori(voce.esitoDa, ctx)[0] ?? null;
  // Senza oggetto la decisione si registra lo stesso: la vista la conta «senza traccia».
  const elenco: (string | null)[] = oggetti.length > 0 ? oggetti : [null];
  const attoreTipo = sup?.tipo === "agente" ? "agente" : "persona";
  const valori: unknown[] = [];
  const righe: string[] = [];
  for (const oggetto of elenco) {
    const b = valori.length;
    righe.push(
      `($${b + 1}, 'decisione', $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12})`,
    );
    valori.push(
      tenantId,
      userId,
      attoreTipo,
      sup?.tipo ?? "api",
      sup?.valore ?? null,
      voce.codice,
      oggetto === null ? null : voce.oggettoTipo,
      oggetto,
      esito !== null && esito.length <= 32 ? esito : null,
      req.method,
      rotta,
      String(req.id),
    );
  }
  await pool.query(
    `INSERT INTO audit.valore_eventi
       (valore_evento_tenant_id, valore_evento_tipo, valore_evento_attore_user_id, valore_evento_attore_tipo,
        valore_evento_superficie_tipo, valore_evento_superficie, valore_evento_decisione_codice,
        valore_evento_oggetto_tipo, valore_evento_oggetto_id, valore_evento_esito,
        valore_evento_metodo, valore_evento_rotta, valore_evento_richiesta_id)
     VALUES ${righe.join(", ")}`,
    valori,
  );
}

async function registra(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (reply.statusCode < 200 || reply.statusCode >= 300) return;
  const user = req.user;
  if (!user || !user.tenantId) return;
  const modello = req.routeOptions?.url;
  if (!modello || !modello.startsWith("/v1/")) return;
  const rotta = chiaveRotta(req.method, modello).slice(req.method.length + 1);
  const sup = superficieDi(req);

  if (req.method === "GET") {
    if (sup) await registraUso(req, user.tenantId, user.userId, sup, rotta);
    return;
  }
  if (!SCRITTURE.has(req.method)) return;
  const voce = (await catalogoValore(req)).get(chiaveRotta(req.method, modello));
  if (voce) await registraDecisioni(req, user.tenantId, user.userId, sup, rotta, voce);
}

/** Aggancia il registro all'app. Va chiamata prima della registrazione delle rotte. */
export function registraEventiDiValore(app: FastifyInstance): void {
  // Il corpo della risposta serve alle rotte che ne prendono l'oggetto, e in onResponse non
  // c'è più: qui se ne tiene solo il riferimento. Il hook è SINCRONO di proposito: un onSend
  // che aspetta (una query, anche solo il catalogo) lascia aperta una finestra in cui un
  // handler `async (req, reply) => { reply.code(201).send(x) }` si risolve con undefined
  // mentre la risposta non è ancora partita, e Fastify la rimanda vuota (misurato in CI
  // sulla #157: 84 prove con «Unexpected end of JSON input», tutte su POST che rispondono 201).
  app.addHook("onSend", (req, reply, payload, done) => {
    if (SCRITTURE.has(req.method) && reply.statusCode < 300 && typeof payload === "string" && req.user?.tenantId) {
      req.valoreRispostaGrezza = payload;
    }
    done(null, payload);
  });

  app.addHook("onResponse", async (req, reply) => {
    try {
      await registra(req, reply);
    } catch (err) {
      req.log.warn({ err, route: req.routeOptions?.url }, "valore: evento non registrato");
    }
  });
}
