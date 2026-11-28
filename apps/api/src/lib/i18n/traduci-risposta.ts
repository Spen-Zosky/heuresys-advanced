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

import type { FastifyInstance, FastifyRequest, onResponseAsyncHookHandler, preValidationAsyncHookHandler } from "fastify";
import type { Pool } from "pg";
import {
  campiDellaRiga,
  campiAccettati,
  idDellaRisorsa,
  leggiRegistroRighe,
  scriviTraduzioni,
  separaModifiche,
  tabellaDellaRotta,
  tenantDellaRiga,
  type CampoDellaRiga,
  type ModificaInglese,
} from "./traduzione-della-riga.js";

/** Quanto serve per tradurre: cercare un testo. Una Map lo è, e lo è la vista di un tenant. */
export interface Glossario {
  get(testo: string): string | undefined;
  readonly size: number;
}

/**
 * Il glossario a strati: le traduzioni delle righe di catalogo (senza tenant) valgono per tutti,
 * quelle delle righe di un tenant solo per lui. Una traduzione `MANUAL` scritta da una persona
 * di un tenant non compare mai nelle pagine di un altro tenant per lo stesso testo italiano.
 */
export interface GlossarioStrati {
  comune: Map<string, string>;
  perTenant: Map<string, Map<string, string>>;
}

/** La vista di un tenant: prima le sue traduzioni, poi quelle comuni. Senza tenant, le comuni. */
export function glossarioDi(strati: GlossarioStrati, tenantId: string | null | undefined): Glossario {
  const proprio = tenantId ? strati.perTenant.get(tenantId) : undefined;
  if (!proprio || proprio.size === 0) return strati.comune;
  return {
    get: (testo) => proprio.get(testo) ?? strati.comune.get(testo),
    size: proprio.size + strati.comune.size,
  };
}

/** Le voci della vista di un tenant, per rovesciarla. */
export function vociDi(strati: GlossarioStrati, tenantId: string | null | undefined): Map<string, string> {
  const unite = new Map(strati.comune);
  const proprio = tenantId ? strati.perTenant.get(tenantId) : undefined;
  if (proprio) for (const [it, en] of proprio) unite.set(it, en);
  return unite;
}

const CHIAVE_ESCLUSA =
  /^(id|ids|code|codes|email|slug|url|href|locale|password|token|secret|otp)$|(Id|Ids|Code|Codes|Email|Url|Href|Slug|Password|Token|Secret|Otp)$/;
const SCRITTURE = new Set(["POST", "PATCH", "PUT"]);
// Il corpo di una scrittura arriva dalla persona: le chiavi del prototipo non si traducono.
const CHIAVE_PROTOTIPO = new Set(["__proto__", "constructor", "prototype"]);
const LUNGHEZZA_MIN = 2;
const DURATA_MS = 5 * 60 * 1000;

/**
 * Costruisce il glossario italiano → inglese dai campi registrati, separato per il tenant della
 * riga (la sua colonna `<chiave>_tenant_id`; una riga senza tenant è di catalogo, comune).
 * Se uno stesso testo italiano ha più traduzioni nello stesso strato, vince la più frequente
 * (poi l'ordine alfabetico): la scelta è deterministica a ogni costruzione.
 */
export async function costruisciGlossario(
  db: Pick<Pool, "query">,
  registro?: readonly CampoDellaRiga[],
): Promise<GlossarioStrati> {
  const campi = registro ?? (await leggiRegistroRighe(db));
  const parti: string[] = [];
  const parametri: string[] = [];
  for (const c of campi) {
    parametri.push(c.entity_table, c.field);
    const t = parametri.length - 1;
    // I nomi vengono dal registro e sono già passati per IDENT (leggiRegistroRighe).
    parti.push(
      `SELECT (${tenantDellaRiga(c)})::text AS tenant, e.${c.entity_field_column}::text AS it, x.text AS en
         FROM sys.${c.entity_table} e
         JOIN sys.sys_reference_translations x
           ON x.entity_table = $${t} AND x.field = $${t + 1} AND x.locale = 'en'
          AND x.entity_id = e.${c.entity_pk_column}`,
    );
  }
  const strati: GlossarioStrati = { comune: new Map(), perTenant: new Map() };
  if (parti.length === 0) return strati;
  const res = await db.query<{ tenant: string | null; it: string; en: string }>(
    `SELECT tenant, it, en FROM (
       SELECT tenant, it, en,
              row_number() OVER (PARTITION BY tenant, it ORDER BY count(*) DESC, en) AS n
         FROM (${parti.join("\n UNION ALL \n")}) u
        WHERE it IS NOT NULL AND length(trim(it)) >= ${LUNGHEZZA_MIN} AND en <> it
        GROUP BY tenant, it, en
     ) s WHERE n = 1`,
    parametri,
  );
  for (const r of res.rows) {
    if (r.tenant === null) {
      strati.comune.set(r.it, r.en);
      continue;
    }
    let proprio = strati.perTenant.get(r.tenant);
    if (!proprio) strati.perTenant.set(r.tenant, (proprio = new Map()));
    proprio.set(r.it, r.en);
  }
  return strati;
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
export function rovescia(g: ReadonlyMap<string, string>): Map<string, string> {
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
  let valore: GlossarioStrati | null = null;
  let registro: CampoDellaRiga[] | null = null;
  // Il glossario rovesciato di ogni tenant si calcola alla prima scrittura e vale fino al rinfresco.
  let inversi = new Map<string, Glossario>();
  let scade = 0;
  let inVolo: Promise<GlossarioStrati | null> | null = null;
  function rinfresca(): Promise<GlossarioStrati | null> {
    inVolo ??= leggiRegistroRighe(db)
      .then(async (r) => {
        const g = await costruisciGlossario(db, r);
        valore = g;
        registro = r;
        inversi = new Map();
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
  function attuale(tenantId: string | null): Glossario | null {
    if (Date.now() >= scade) void rinfresca();
    return valore ? glossarioDi(valore, tenantId) : null;
  }
  function attualeInverso(tenantId: string | null): Glossario | null {
    if (Date.now() >= scade) void rinfresca();
    if (!valore) return null;
    const chiave = tenantId && valore.perTenant.has(tenantId) ? tenantId : "";
    let inv = inversi.get(chiave);
    if (!inv) inversi.set(chiave, (inv = rovescia(vociDi(valore, chiave || null))));
    return inv;
  }
  function registroRighe(): readonly CampoDellaRiga[] | null {
    return registro;
  }
  /** Una modifica inglese appena scritta vale subito, per il solo tenant della riga. */
  function aggiorna(modifiche: readonly ModificaInglese[]): void {
    if (!valore) return;
    for (const m of modifiche) {
      if (!m.tenant) {
        valore.comune.set(m.it, m.testo);
        continue;
      }
      let proprio = valore.perTenant.get(m.tenant);
      if (!proprio) valore.perTenant.set(m.tenant, (proprio = new Map()));
      proprio.set(m.it, m.testo);
    }
    inversi = new Map();
  }
  return { attuale, attualeInverso, rinfresca, registroRighe, aggiorna };
}

/** Le modifiche inglesi della richiesta, sopra il glossario: la risposta le mostra già. */
export function conModifiche(g: Glossario | null, modifiche: readonly ModificaInglese[] | undefined): Glossario | null {
  if (!modifiche || modifiche.length === 0) return g;
  const proprie = new Map(modifiche.filter((m) => m.testo.trim() !== "").map((m) => [m.it, m.testo] as const));
  return { get: (testo) => proprie.get(testo) ?? g?.get(testo), size: proprie.size + (g?.size ?? 0) };
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
  // Le modifiche inglesi della richiesta, dal ritorno (prima dell'handler) alla risposta e alla
  // scrittura della traduzione (dopo).
  const pendenti = new WeakMap<FastifyRequest, ModificaInglese[]>();
  // L'andata vale per le letture e per la risposta delle scritture: una modifica fatta in una
  // pagina inglese risponde con il testo inglese (anche quello appena scritto), così il modulo
  // non torna all'italiano finché non si ricarica la pagina. Le rotte di accesso restano fuori.
  app.addHook("preSerialization", (req, reply, payload, done) => {
    if (
      req.locale !== "en" ||
      !(req.method === "GET" || SCRITTURE.has(req.method)) ||
      !req.url.startsWith("/v1/") ||
      (req.method !== "GET" && !riceveRitorno(req.routeOptions.url ?? req.url, req.method)) ||
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
      const g = conModifiche(glossario.attuale(req.user?.tenantId ?? null), pendenti.get(req));
      if (g && g.size > 0) uscita = traduciValore(payload, g);
    } catch {
      uscita = payload; // la traduzione non rompe mai una risposta
    }
    done(null, uscita);
  });
  // Il ritorno: il corpo di una scrittura in inglese torna all'italiano canonico prima della
  // validazione, e una modifica fatta in inglese va nella traduzione inglese (3b).
  // Non è un hook globale: si aggancia rotta per rotta, alla registrazione, alle sole scritture
  // `/v1/*` fuori da `/v1/auth/`. Le rotte di accesso (credenziali, secondo fattore) non lo
  // ricevono proprio, invece di saltarlo a runtime: il loro corpo non passa mai di qui.
  // È asincrono perché legge la riga: prima dell'handler non c'è la finestra di «Reply was
  // already sent», che riguarda i hook dopo l'handler.
  const ritorno: preValidationAsyncHookHandler = async (req) => {
    if (req.locale !== "en" || req.headers["x-localize"] === "off" || req.body === null || typeof req.body !== "object") return;
    let corpo = req.body;
    let gestiti = new Set<string>();
    try {
      const registro = glossario.registroRighe();
      const id = req.method === "GET" || Array.isArray(corpo) ? null : idDellaRisorsa(req.routeOptions.url, req.params);
      const tabella = tabellaDellaRotta(req.routeOptions.url);
      const utente = req.user;
      if (registro && id && tabella && utente && (req.method === "PATCH" || req.method === "PUT")) {
        const piatto = corpo as Record<string, unknown>;
        // Solo i campi che la rotta accetta: una chiave che la validazione scarterebbe non
        // riceve una traduzione che l'handler non ha mai autorizzato.
        const accettati = campiAccettati(req.routeOptions.schema?.body);
        const chiavi = new Set(Object.keys(piatto).filter((k) => accettati.has(k)));
        const scrivente = { tenantId: utente.tenantId ?? null };
        const trovati = await campiDellaRiga(db, registro, tabella, id, chiavi, scrivente);
        if (trovati.length > 0) {
          const s = separaModifiche(piatto, id, trovati);
          corpo = s.corpo;
          gestiti = s.campi;
          if (s.modifiche.length > 0) pendenti.set(req, s.modifiche);
        }
      }
    } catch (err) {
      req.log.warn({ err, url: req.url }, "ADR-0062: campi della riga non letti, resta il solo glossario");
    }
    try {
      const g = glossario.attualeInverso(req.user?.tenantId ?? null);
      if (g && g.size > 0) {
        const sostituite: string[] = [];
        if (gestiti.size === 0) {
          corpo = traduciValore(corpo, g, 0, sostituite) as typeof corpo;
        } else {
          // I campi già decisi per riga non ripassano dal glossario.
          const piatto = corpo as Record<string, unknown>;
          const resto = Object.fromEntries(Object.entries(piatto).filter(([k]) => !gestiti.has(k)));
          const tradotto = traduciValore(resto, g, 0, sostituite) as Record<string, unknown>;
          corpo = Object.fromEntries(Object.entries(piatto).map(([k, v]) => [k, gestiti.has(k) ? v : tradotto[k]]));
        }
        // La traccia di ogni ritorno: quali testi inglesi sono tornati all'italiano, e dove.
        if (sostituite.length > 0) {
          req.log.info({ ritornoItaliano: sostituite, url: req.url, method: req.method }, "ADR-0062: testi inglesi riportati all'italiano canonico");
        }
      }
    } catch {
      // la traduzione non rompe mai una scrittura
    }
    req.body = corpo;
  };
  // Le modifiche inglesi si scrivono solo dopo che la scrittura è riuscita (l'handler ha
  // controllato permessi e perimetro); dopo la risposta, come il registro del valore.
  const dopo: onResponseAsyncHookHandler = async (req, reply) => {
    const modifiche = pendenti.get(req);
    if (!modifiche) return;
    pendenti.delete(req);
    if (reply.statusCode >= 300) return;
    try {
      await scriviTraduzioni(db, modifiche);
      glossario.aggiorna(modifiche);
      req.log.info(
        { traduzioneInglese: modifiche.map((m) => ({ tabella: m.tabella, id: m.id, campo: m.campo })), url: req.url },
        "ADR-0062: modifica fatta in inglese scritta nella traduzione inglese",
      );
    } catch (err) {
      req.log.error({ err, url: req.url }, "ADR-0062: traduzione inglese non scritta");
    }
  };
  app.addHook("onRoute", (r) => {
    if (!riceveRitorno(r.url, r.method)) return;
    const prima = r.preValidation === undefined ? [] : Array.isArray(r.preValidation) ? r.preValidation : [r.preValidation];
    r.preValidation = [ritorno, ...prima];
    const poi = r.onResponse === undefined ? [] : Array.isArray(r.onResponse) ? r.onResponse : [r.onResponse];
    r.onResponse = [...poi, dopo];
  });
}

/** Quali rotte ricevono il ritorno: le scritture `/v1/*`, mai quelle di accesso. */
export function riceveRitorno(url: string, metodo: string | readonly string[]): boolean {
  const metodi = typeof metodo === "string" ? [metodo] : metodo;
  if (!metodi.some((m) => SCRITTURE.has(m))) return false;
  if (!url.startsWith("/v1/")) return false;
  return !(url === "/v1/auth" || url.startsWith("/v1/auth/"));
}
