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
 *   - `x-localize: off` lo spegne per una richiesta.
 * Il ritorno (passo 5 di ADR-0062): un modulo di modifica in una pagina inglese si precompila
 * con il testo inglese e, salvando, lo rimanderebbe al posto dell'italiano canonico. Un secondo
 * hook, sulle scritture `/v1/*` in inglese, riporta all'italiano ogni stringa del corpo uguale a
 * una traduzione del glossario, solo quando quella traduzione viene da un testo italiano solo;
 * un testo nuovo scritto dalla persona passa com'è. Vale per tutti i moduli, come l'andata.
 * I nomi delle persone non sono in nessun campo registrato, quindi non si traducono.
 */

import type { FastifyInstance, preValidationHookHandler } from "fastify";
import type { Pool } from "pg";

export type Glossario = ReadonlyMap<string, string>;

const IDENT = /^[a-z_][a-z0-9_]*$/;
const CHIAVE_ESCLUSA =
  /^(id|ids|code|codes|email|slug|url|href|locale|password|token|secret|otp)$|(Id|Ids|Code|Codes|Email|Url|Href|Slug|Password|Token|Secret|Otp)$/;
const SCRITTURE = new Set(["POST", "PATCH", "PUT"]);
// Il corpo di una scrittura arriva dalla persona: le chiavi del prototipo non si traducono.
const CHIAVE_PROTOTIPO = new Set(["__proto__", "constructor", "prototype"]);
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
export function traduciValore(valore: unknown, g: Glossario, profondita = 0, sostituite?: string[]): unknown {
  if (typeof valore === "string") {
    const t = g.get(valore);
    if (t === undefined) return valore;
    sostituite?.push(valore);
    return t;
  }
  if (valore === null || typeof valore !== "object" || profondita > 40) return valore;
  if (valore instanceof Date || Buffer.isBuffer(valore)) return valore;
  if (Array.isArray(valore)) {
    let copia: unknown[] | null = null;
    for (let i = 0; i < valore.length; i++) {
      const v = traduciValore(valore[i], g, profondita + 1, sostituite);
      if (v !== valore[i]) {
        copia ??= valore.slice();
        copia[i] = v;
      }
    }
    return copia ?? valore;
  }
  const proto = Object.getPrototypeOf(valore);
  if (proto !== Object.prototype && proto !== null) return valore;
  // La copia si ricostruisce con Object.fromEntries, che crea proprietà proprie: nessuna chiave
  // del corpo (nemmeno `__proto__`) può cambiare il prototipo della copia.
  let cambiato = false;
  const voci = Object.entries(valore as Record<string, unknown>).map(([k, v0]): [string, unknown] => {
    if (CHIAVE_ESCLUSA.test(k) || CHIAVE_PROTOTIPO.has(k)) return [k, v0];
    const v = traduciValore(v0, g, profondita + 1, sostituite);
    if (v !== v0) cambiato = true;
    return [k, v];
  });
  return cambiato ? Object.fromEntries(voci) : valore;
}

/**
 * Il glossario rovesciato, inglese → italiano, per le scritture. Una traduzione che viene da più
 * testi italiani diversi non si rovescia: non si saprebbe quale rimettere.
 */
export function rovescia(g: Glossario): Map<string, string> {
  const inverso = new Map<string, string>();
  const doppi = new Set<string>();
  for (const [it, en] of g) {
    if (inverso.has(en) && inverso.get(en) !== it) doppi.add(en);
    else inverso.set(en, it);
  }
  for (const en of doppi) inverso.delete(en);
  return inverso;
}

/**
 * Glossario in memoria con rinfresco a intervalli; una sola costruzione in volo.
 * `attuale()` è sincrono e non aspetta mai: se il glossario è scaduto avvia il rinfresco in
 * background e intanto restituisce quello di prima (o null se non ce n'è ancora uno).
 */
export function cacheGlossario(db: Pick<Pool, "query">, durataMs = DURATA_MS) {
  let valore: Glossario | null = null;
  let inverso: Glossario | null = null;
  let scade = 0;
  let inVolo: Promise<Glossario | null> | null = null;
  function rinfresca(): Promise<Glossario | null> {
    inVolo ??= costruisciGlossario(db)
      .then((g) => {
        valore = g;
        inverso = rovescia(g);
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
  }
  function attuale(): Glossario | null {
    if (Date.now() >= scade) void rinfresca();
    return valore;
  }
  function attualeInverso(): Glossario | null {
    if (Date.now() >= scade) void rinfresca();
    return inverso;
  }
  return { attuale, attualeInverso, rinfresca };
}

export function addTraduzioneRisposta(app: FastifyInstance, db: Pick<Pool, "query">): void {
  const glossario = cacheGlossario(db);
  // Il glossario si carica all'avvio (prima che il server ascolti) e poi si rinfresca in
  // background. Il hook è SINCRONO di proposito: un hook che aspetta una query su ogni risposta
  // lascia aperta la finestra in cui un handler `async (req, reply) => { reply.send(x) }` si
  // risolve prima che la risposta parta, e Fastify la riscrive («Reply was already sent»,
  // stessa classe di valore/registro.ts e della F-7).
  app.addHook("onReady", async () => {
    await glossario.rinfresca();
  });
  app.addHook("preSerialization", (req, reply, payload, done) => {
    if (
      req.locale !== "en" ||
      req.method !== "GET" ||
      !req.url.startsWith("/v1/") ||
      reply.statusCode >= 300 ||
      req.headers["x-localize"] === "off" ||
      payload === null ||
      typeof payload !== "object"
    ) {
      done(null, payload);
      return;
    }
    let uscita: unknown = payload;
    try {
      const g = glossario.attuale();
      if (g && g.size > 0) uscita = traduciValore(payload, g);
    } catch {
      uscita = payload; // la traduzione non rompe mai una risposta
    }
    done(null, uscita);
  });
  // Il ritorno: il corpo di una scrittura in inglese torna all'italiano canonico prima della
  // validazione. Sincrono come l'andata; senza glossario il corpo passa com'è.
  // Non è un hook globale: si aggancia rotta per rotta, alla registrazione, alle sole scritture
  // `/v1/*` fuori da `/v1/auth/`. Le rotte di accesso (credenziali, secondo fattore) non lo
  // ricevono proprio, invece di saltarlo a runtime: il loro corpo non passa mai di qui.
  const ritorno: preValidationHookHandler = (req, _reply, done) => {
    if (req.locale !== "en" || req.headers["x-localize"] === "off" || req.body === null || typeof req.body !== "object") {
      done();
      return;
    }
    try {
      const g = glossario.attualeInverso();
      if (g && g.size > 0) {
        const sostituite: string[] = [];
        req.body = traduciValore(req.body, g, 0, sostituite);
        // La traccia di ogni ritorno: quali testi inglesi sono tornati all'italiano, e dove.
        if (sostituite.length > 0) {
          req.log.info({ ritornoItaliano: sostituite, url: req.url, method: req.method }, "ADR-0062: testi inglesi riportati all'italiano canonico");
        }
      }
    } catch {
      // la traduzione non rompe mai una scrittura
    }
    done();
  };
  app.addHook("onRoute", (r) => {
    if (!riceveRitorno(r.url, r.method)) return;
    const prima = r.preValidation === undefined ? [] : Array.isArray(r.preValidation) ? r.preValidation : [r.preValidation];
    r.preValidation = [ritorno, ...prima];
  });
}

/** Quali rotte ricevono il ritorno: le scritture `/v1/*`, mai quelle di accesso. */
export function riceveRitorno(url: string, metodo: string | readonly string[]): boolean {
  const metodi = typeof metodo === "string" ? [metodo] : metodo;
  if (!metodi.some((m) => SCRITTURE.has(m))) return false;
  if (!url.startsWith("/v1/")) return false;
  return !(url === "/v1/auth" || url.startsWith("/v1/auth/"));
}
