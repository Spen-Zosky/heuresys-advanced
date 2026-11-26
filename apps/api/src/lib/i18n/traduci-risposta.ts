/**
 * apps/api/src/lib/i18n/traduci-risposta.ts
 * Traduzione del dato nella risposta (ADR-0062, che estende ADR-0029).
 *
 * Il dato canonico è in italiano, nella riga; l'inglese vive in
 * sys.sys_reference_translations per i campi del registro sys.sys_translatable_field.
 * L'overlay per id di ADR-0029 (`localize`) copre solo i moduli che lo chiamano: un campo
 * tradotto che arriva da un join di un altro modulo restava italiano nelle pagine inglesi
 * (censimento X3 del 26/11: skills, kpi_definitions, job_roles, activity_classifications).
 *
 * Qui un solo hook globale, per le letture `GET /v1/*` in inglese, sostituisce ogni stringa
 * della risposta uguale a un testo italiano canonico di un campo registrato con la sua
 * traduzione. Il glossario si costruisce dal registro, sta in memoria e si rinfresca a
 * intervalli. Regole:
 *   - in italiano non fa niente; senza glossario (errore di lettura) non tocca la risposta;
 *   - non modifica l'oggetto ricevuto (un modulo può tenerlo in una sua cache): copia solo
 *     i rami che cambiano;
 *   - non guarda le chiavi che portano identificativi o codici (`id`, `…Id`, `code`, `…Code`,
 *     `email`, `slug`, `url`), così un valore usato come chiave non cambia;
 *   - `x-localize: off` lo spegne per una richiesta: serve ai moduli di modifica, che devono
 *     precompilare il testo canonico italiano e non la traduzione.
 * I nomi delle persone non sono in nessun campo registrato, quindi non si traducono.
 */

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

export type Glossario = ReadonlyMap<string, string>;

const IDENT = /^[a-z_][a-z0-9_]*$/;
const CHIAVE_ESCLUSA = /^(id|ids|code|codes|email|slug|url|href|locale)$|(Id|Ids|Code|Codes|Email|Url|Href|Slug)$/;
const LUNGHEZZA_MIN = 2;
const DURATA_MS = 5 * 60 * 1000;

interface CampoRegistrato {
  entity_table: string;
  entity_pk_column: string;
  field: string;
  entity_field_column: string;
}

/**
 * Costruisce il glossario italiano → inglese dai campi registrati.
 * Se uno stesso testo italiano ha più traduzioni, vince la più frequente (poi l'ordine
 * alfabetico): la scelta è deterministica a ogni costruzione.
 */
export async function costruisciGlossario(db: Pick<Pool, "query">): Promise<Map<string, string>> {
  const reg = await db.query<CampoRegistrato>(
    `SELECT entity_table, entity_pk_column, field, entity_field_column
       FROM sys.sys_translatable_field
      WHERE canonical_locale = 'it'
      ORDER BY entity_table, field`,
  );
  const esistenti = await db.query<{ t: string }>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'sys'`,
  );
  const tabelle = new Set(esistenti.rows.map((r) => r.t));
  const parti: string[] = [];
  const parametri: string[] = [];
  for (const c of reg.rows) {
    if (![c.entity_table, c.entity_pk_column, c.entity_field_column].every((x) => IDENT.test(x))) continue;
    if (!tabelle.has(c.entity_table)) continue;
    parametri.push(c.entity_table, c.field);
    const t = parametri.length - 1;
    parti.push(
      `SELECT e.${c.entity_field_column}::text AS it, x.text AS en
         FROM sys.${c.entity_table} e
         JOIN sys.sys_reference_translations x
           ON x.entity_table = $${t} AND x.field = $${t + 1} AND x.locale = 'en'
          AND x.entity_id = e.${c.entity_pk_column}`,
    );
  }
  const glossario = new Map<string, string>();
  if (parti.length === 0) return glossario;
  const res = await db.query<{ it: string; en: string }>(
    `SELECT it, en FROM (
       SELECT it, en, row_number() OVER (PARTITION BY it ORDER BY count(*) DESC, en) AS n
         FROM (${parti.join("\n UNION ALL \n")}) u
        WHERE it IS NOT NULL AND length(trim(it)) >= ${LUNGHEZZA_MIN} AND en <> it
        GROUP BY it, en
     ) s WHERE n = 1`,
    parametri,
  );
  for (const r of res.rows) glossario.set(r.it, r.en);
  return glossario;
}

/**
 * Restituisce il valore con le stringhe tradotte. Lo stesso riferimento se niente cambia,
 * altrimenti una copia dei soli rami toccati.
 */
export function traduciValore(valore: unknown, g: Glossario, profondita = 0): unknown {
  if (typeof valore === "string") return g.get(valore) ?? valore;
  if (valore === null || typeof valore !== "object" || profondita > 40) return valore;
  if (valore instanceof Date || Buffer.isBuffer(valore)) return valore;
  if (Array.isArray(valore)) {
    let copia: unknown[] | null = null;
    for (let i = 0; i < valore.length; i++) {
      const v = traduciValore(valore[i], g, profondita + 1);
      if (v !== valore[i]) {
        copia ??= valore.slice();
        copia[i] = v;
      }
    }
    return copia ?? valore;
  }
  const proto = Object.getPrototypeOf(valore);
  if (proto !== Object.prototype && proto !== null) return valore;
  let copia: Record<string, unknown> | null = null;
  for (const [k, v0] of Object.entries(valore as Record<string, unknown>)) {
    if (CHIAVE_ESCLUSA.test(k)) continue;
    const v = traduciValore(v0, g, profondita + 1);
    if (v !== v0) {
      copia ??= { ...(valore as Record<string, unknown>) };
      copia[k] = v;
    }
  }
  return copia ?? valore;
}

/** Glossario in memoria con rinfresco a intervalli; una sola costruzione in volo. */
export function cacheGlossario(db: Pick<Pool, "query">, durataMs = DURATA_MS) {
  let valore: Glossario | null = null;
  let scade = 0;
  let inVolo: Promise<Glossario | null> | null = null;
  return async function leggi(): Promise<Glossario | null> {
    if (valore && Date.now() < scade) return valore;
    inVolo ??= costruisciGlossario(db)
      .then((g) => {
        valore = g;
        scade = Date.now() + durataMs;
        return g;
      })
      .catch(() => {
        // il prossimo tentativo fra un minuto; intanto vale il glossario di prima, se c'è
        scade = Date.now() + 60_000;
        return valore;
      })
      .finally(() => {
        inVolo = null;
      });
    return inVolo;
  };
}

export function addTraduzioneRisposta(app: FastifyInstance, db: Pick<Pool, "query">): void {
  const glossario = cacheGlossario(db);
  app.addHook("preSerialization", async (req, reply, payload) => {
    if (req.locale !== "en" || req.method !== "GET") return payload;
    if (!req.url.startsWith("/v1/") || reply.statusCode >= 300) return payload;
    if (req.headers["x-localize"] === "off") return payload;
    if (payload === null || typeof payload !== "object") return payload;
    try {
      const g = await glossario();
      return g && g.size > 0 ? traduciValore(payload, g) : payload;
    } catch {
      return payload; // la traduzione non rompe mai una risposta
    }
  });
}
