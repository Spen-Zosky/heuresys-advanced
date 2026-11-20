/**
 * apps/api/src/modules/faldone/service.ts — il Faldone dell'Utente: tutti i dati di una persona.
 *
 * Tre letture, la stessa regola di accesso:
 *   indice   — ogni sezione del catalogo con il numero di righe di questa persona (una query sola);
 *   sezione  — le righe di una sezione, a pagine, con le etichette leggibili dei riferimenti;
 *   completo — l'indice più le righe di ogni sezione con dati, per gli agenti (una chiamata sola).
 *
 * L'ACCESSO non è una regola nuova: è quella del dossier (`users/service.ts`, #81, #124, D11,
 * ADR-0050 D5), applicata a ogni sezione secondo la sua classe di dati.
 *   - Chi non può leggere la persona riceve 404 (come il dossier: un 403 confermerebbe che esiste).
 *   - PERSONAL privata: in chiaro a sé stessi, ai mandati HR, al perimetro mascherato e alla piattaforma.
 *   - COMPENSATION / EVALUATION: {omissis} quando il dossier le maschera (mandato tecnico, DPO,
 *     retribuzione di un vertice, conferma del secondo fattore mancante).
 *   - CREDENTIAL: in chiaro a sé stessi e alla piattaforma; i segreti non escono MAI, per nessuno.
 *   - SPECIAL_CATEGORY e le sezioni `soloSe`: in chiaro solo alla persona stessa.
 *   - relazione: la persona vi compare per ciò che ha fatto su un altro oggetto; se ne danno chiave,
 *     legame e date, il resto si apre dal modulo di quell'oggetto, con i suoi permessi.
 *
 *
 * TRE REGOLE IN PIÙ, che il dossier non conosceva perché non legge tutto (revisione del 2026-11-19):
 *   - valutazioni comunicate: una valutazione della prestazione (e ciò che ne discende) esiste nel
 *     faldone solo dopo che è stata comunicata (ADR-0036 §5, shared_at OPPURE acknowledged_at), per
 *     chiunque; il feedback continuo privato lo leggono solo l'autore e il mandato HR;
 *   - dati di talento riservati (`nonASe`): rischio di uscita, calibrazione, successione, previsioni
 *     non si comunicano alla persona; il feedback a 360 alla persona arriva solo aggregato dal suo modulo;
 *   - persone terze: le colonne che indicano un'altra persona (chiave esterna verso sys_users o legame
 *     implicito) escono solo al mandato HR, e mai nelle tabelle anonime per costruzione; il loro nome
 *     non si risolve. È la stessa proiezione dell'esportazione GDPR (gdpr/repository.ts, Z-259).
 *
 * {omissis} è un VALORE DICHIARATO, non un vuoto: il campo resta nella riga con la stringa
 * `{omissis}`, e la sezione dice quali campi e perché. È la stessa forma dell'assistente di pagina,
 * così un agente che legge il faldone non può confondere «nascosto» con «assente».
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import { canReadOrgTarget, haPerimetroTenantMascherato } from "../../lib/scope/resolver.js";
import { haMandatoHr, haMandatoPiattaforma } from "../../lib/scope/mandati.js";
import { masksSensitiveClass, masksTopOfChainPay } from "../../lib/scope/mask.js";
import { chainLevelOf } from "../../lib/scope/org.js";
import { serveConferma } from "../../lib/scope/conferma.js";
import {
  FALDONE_OMISSIS,
  type FaldoneCompleto, type FaldoneIndice, type FaldoneRighe, type FaldoneSezione,
} from "@heuresys/shared";
import { catalogo, ident, identQualificato, type Catalogo, type LegameCatalogo, type TabellaCatalogo } from "./catalogo.js";
import {
  classificazioneDi, legameSoggetto, ruoloDiRelazione, CAPITOLI, COLONNE_PERSONA_IMPLICITE, type Classificazione,
} from "./classi.js";

/** I nomi di colonna che portano un segreto: non escono per nessuno, nemmeno per sé stessi. */
const SEGRETO = /(password|passwd|_hash$|hash_|secret|totp|token(?!_id)|salt|otp_code|recovery_code(?!_id|_user)|private_key|api_key|_cipher|encrypted)/;
/** Le colonne che restano visibili anche in una riga {omissis}: chiavi, legami, date, stato. */
const STRUTTURA_RE = /(_id$|^id$|_at$|_date$|_from$|_to$|_on$|_period(_start|_end)?$|_year$|_month$|_status$|_state$|^created_by$|^updated_by$)/;

const ID_PERSONA = "sys.sys_users";

function segreto(n: string): boolean {
  return SEGRETO.test(n) && !/_id$/.test(n);
}
function struttura(n: string): boolean {
  return STRUTTURA_RE.test(n) && !segreto(n);
}

interface Persona { userId: string; nome: string; tenantId: string | null }

interface Diritti {
  self: boolean;
  /** Mandato HR: l'unico che vede in chiaro le persone terze nelle righe (mai nelle tabelle anonime). */
  hr: boolean;
  privata: boolean;
  credenziali: boolean;
  comp: boolean;
  eval: boolean;
  confermaRichiesta: ("COMPENSATION" | "EVALUATION")[];
}

interface Regola {
  visibilita: FaldoneSezione["visibilita"];
  campiOmessi: string[];
  motivo: string | null;
}

/** La sezione «persona» (la riga di sys_users) ha un legame suo: la chiave primaria. */
function legamePersona(cat: Catalogo): LegameCatalogo {
  return { id: ID_PERSONA, livello: "diretto", tabella: ID_PERSONA, colonna: cat.persona.chiave[0] ?? "user_id", madre: null };
}

function classificazione(l: LegameCatalogo): Classificazione {
  const propria = classificazioneDi(l.tabella);
  const madre = l.madre ? classificazioneDi(l.madre.tabella) : undefined;
  // Una figlia eredita le riserve della madre: i passi di una candidatura alla successione sono
  // riservati quanto la candidatura.
  const c = propria && madre
    ? { ...propria, ...(madre.nonASe ? { nonASe: true as const } : {}), ...(madre.anonima ? { anonima: true as const } : {}),
        ...(madre.soloSe ? { soloSe: true as const } : {}) }
    : propria ?? madre;
  // Una tabella senza classificazione è un rosso della prova del catalogo; in esercizio si tratta
  // come la più protetta, non come la più aperta.
  return c ?? { classe: "SPECIAL_CATEGORY", capitolo: "Archivi e registri tecnici", titolo: l.tabella };
}

function soggetto(l: LegameCatalogo): boolean {
  if (l.id === ID_PERSONA) return true;
  if (l.madre) return true; // i collegati discendono solo da legami soggetto
  return legameSoggetto(l.tabella, l.colonna);
}

function titolo(l: LegameCatalogo, c: Classificazione): string {
  return soggetto(l) ? c.titolo : `${c.titolo}: ${ruoloDiRelazione(l.colonna)}`;
}

/** Le colonne di una tabella che indicano un'altra persona: chiave esterna verso sys_users o legame
 *  implicito, tranne la colonna che lega questa sezione alla persona del faldone. */
function colonnePersona(l: LegameCatalogo, t: TabellaCatalogo): string[] {
  return t.colonne
    .filter((x) => x.nome !== l.colonna
      && (x.riferisce?.tabella === ID_PERSONA || COLONNE_PERSONA_IMPLICITE.has(`${t.nome}.${x.nome}`)))
    .map((x) => x.nome);
}

function regolaPer(l: LegameCatalogo, t: TabellaCatalogo, c: Classificazione, d: Diritti): Regola {
  const base = regolaBase(l, t, c, d);
  if (d.hr && !c.anonima) return base;
  const terze = colonnePersona(l, t).filter((n) => !base.campiOmessi.includes(n));
  if (!terze.length) return base;
  const motivo = c.anonima
    ? "anonimo per costruzione: chi compare oltre alla persona non esce per nessuno"
    : "persone terze: chi altro compare nella riga lo legge solo il mandato HR";
  return {
    visibilita: base.visibilita === "piena" ? "parziale" : base.visibilita,
    campiOmessi: [...base.campiOmessi, ...terze],
    motivo: base.motivo ? `${base.motivo}; ${motivo}` : motivo,
  };
}

function regolaBase(l: LegameCatalogo, t: TabellaCatalogo, c: Classificazione, d: Diritti): Regola {
  const segreti = t.colonne.map((x) => x.nome).filter(segreto);
  const tutteTranneStruttura = (): string[] =>
    t.colonne.map((x) => x.nome).filter((n) => n !== l.colonna && !t.chiave.includes(n) && !struttura(n));
  const chiudi = (motivo: string): Regola => {
    const campi = tutteTranneStruttura();
    return campi.length ? { visibilita: "omissis", campiOmessi: campi, motivo } : { visibilita: "piena", campiOmessi: [], motivo: null };
  };

  if (!soggetto(l)) {
    if ((c.classe === "SPECIAL_CATEGORY" || c.classe === "CREDENTIAL") && !d.self && !d.credenziali) {
      return chiudi("dato riservato di un altro oggetto");
    }
    return chiudi("la persona vi compare per ciò che ha fatto: il contenuto si apre dalla pagina di quell'oggetto, con i suoi permessi");
  }
  if (c.soloSe && !d.self) return chiudi("lo legge solo la persona stessa");
  if (c.nonASe && d.self) return chiudi("dato di talento riservato: non si comunica alla persona");
  if (c.anonima && d.self && !c.soloSe) return chiudi("anonimo per costruzione: alla persona arriva aggregato dal suo modulo");
  if (c.classe === "SPECIAL_CATEGORY" && !d.self) return chiudi("categoria particolare: la legge solo la persona stessa");
  if (c.classe === "CREDENTIAL" && !d.self && !d.credenziali) return chiudi("credenziali: le legge solo la persona o il mandato tecnico");
  if (c.privata && !d.privata) return chiudi("sfera privata: non rientra nel tuo profilo");
  if (c.classe === "COMPENSATION" && d.comp) {
    return chiudi(d.confermaRichiesta.includes("COMPENSATION")
      ? "retribuzione: serve la conferma del secondo fattore" : "retribuzione: non rientra nel tuo profilo");
  }
  if (c.classe === "EVALUATION" && d.eval) {
    return chiudi(d.confermaRichiesta.includes("EVALUATION")
      ? "valutazioni: serve la conferma del secondo fattore" : "valutazioni: non rientrano nel tuo profilo");
  }
  if (segreti.length) return { visibilita: "parziale", campiOmessi: segreti, motivo: "segreti di accesso: non escono per nessuno" };
  return { visibilita: "piena", campiOmessi: [], motivo: null };
}

/** L'espressione SQL di una colonna: i tipi che non stanno in JSON escono come descrizione. */
function espressione(alias: string, nome: string, tipo: string): string {
  const col = `${alias}.${ident(nome)}`;
  if (tipo === "bytea") return `CASE WHEN ${col} IS NULL THEN NULL ELSE '[dato binario di ' || octet_length(${col}) || ' byte]' END AS ${ident(nome)}`;
  if (tipo.startsWith("vector")) return `CASE WHEN ${col} IS NULL THEN NULL ELSE '[impronta semantica]' END AS ${ident(nome)}`;
  if (tipo === "tsvector") return `NULL::text AS ${ident(nome)}`;
  if (tipo === "date") return `to_char(${col}, 'YYYY-MM-DD') AS ${ident(nome)}`;
  return `${col} AS ${ident(nome)}`;
}

const VALUTAZIONI = "sys.sys_performance_reviews";
const comunicata = (a: string): string =>
  `(${a}.review_shared_at IS NOT NULL OR ${a}.review_acknowledged_at IS NOT NULL)`;

/** Le righe che non esistono per chi legge: valutazioni non comunicate (per chiunque, ADR-0036 §5)
 *  e feedback continuo privato (solo l'autore e il mandato HR). */
function filtroRighe(cat: Catalogo, l: LegameCatalogo, d: Diritti): string {
  const parti: string[] = [];
  if (l.id === ID_PERSONA) return "";
  const t = cat.tabelle.get(l.tabella);
  if (l.tabella === VALUTAZIONI) parti.push(comunicata("f"));
  if (l.madre?.tabella === VALUTAZIONI) parti.push(comunicata("m"));
  for (const c of t?.colonne ?? []) {
    if (c.riferisce?.tabella !== VALUTAZIONI || l.madre?.tabella === VALUTAZIONI) continue;
    parti.push(`(f.${ident(c.nome)} IS NULL OR EXISTS (SELECT 1 FROM ${identQualificato(VALUTAZIONI)} v
                 WHERE v.${ident(c.riferisce.colonna)} = f.${ident(c.nome)} AND ${comunicata("v")}))`);
  }
  if (t?.colonne.some((c) => c.nome === "feedback_is_private") && !d.hr
      && !(d.self && l.colonna === "feedback_from_user_id")) {
    parti.push("f.feedback_is_private = false");
  }
  return parti.map((p) => ` AND ${p}`).join("");
}

/** FROM ... WHERE ... di una sezione, con la persona in $1 e i filtri di riga di chi legge. */
function daDove(cat: Catalogo, l: LegameCatalogo, d: Diritti): string {
  const t = identQualificato(l.tabella);
  const filtro = filtroRighe(cat, l, d);
  if (!l.madre) return `FROM ${t} f WHERE f.${ident(l.colonna)} = $1::uuid${filtro}`;
  return `FROM ${t} f JOIN ${identQualificato(l.madre.tabella)} m ON f.${ident(l.colonna)} = m.${ident(l.madre.colonnaRiferita)}
          WHERE m.${ident(l.madre.colonnaPersona)} = $1::uuid${filtro}`;
}

/** L'ordine delle righe: la data più recente prima, poi la chiave. */
function ordine(t: TabellaCatalogo): string {
  const data = t.colonne.find((c) => /_(date|at)$/.test(c.nome) && !/^(created|updated)_at$|_(created|updated)_at$/.test(c.nome))
    ?? t.colonne.find((c) => /(^|_)created_at$/.test(c.nome));
  const parti = [];
  if (data) parti.push(`f.${ident(data.nome)} DESC NULLS LAST`);
  for (const k of t.chiave) parti.push(`f.${ident(k)}`);
  if (!parti.length) parti.push("1");
  return parti.join(", ");
}

async function contesto(actor: ActorContext, userId: string): Promise<{ persona: Persona; diritti: Diritti }> {
  const r = await pool.query<{ user_id: string; tenant_id: string | null; nome: string }>(
    `SELECT user_id, user_tenant_id AS tenant_id,
            concat_ws(', ', nullif(user_last_name, ''), nullif(user_first_name, '')) AS nome
       FROM sys.sys_users WHERE user_id = $1::uuid`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError("User");
  const self = actor.userId === userId;
  // Anche per sé stessi: il risolutore registra l'asse che autorizza la lettura (F6, ADR-0027).
  if (!(await canReadOrgTarget(pool, actor, userId, row.tenant_id))) throw new NotFoundError("User");

  const [d5Comp, d5Eval, livelloAttore, livelloSoggetto] = await Promise.all([
    serveConferma(pool, actor, "COMPENSATION", userId),
    serveConferma(pool, actor, "EVALUATION", userId),
    chainLevelOf(pool, actor.userId),
    chainLevelOf(pool, userId),
  ]);
  const comp = masksSensitiveClass(actor, "COMPENSATION", userId)
    || masksTopOfChainPay(actor, userId, livelloAttore, livelloSoggetto) || d5Comp;
  const evalu = masksSensitiveClass(actor, "EVALUATION", userId) || d5Eval;
  const privata = self || haMandatoHr(actor) || haPerimetroTenantMascherato(actor) || haMandatoPiattaforma(actor);
  return {
    persona: { userId, nome: row.nome || "(senza nome)", tenantId: row.tenant_id },
    diritti: {
      self, hr: haMandatoHr(actor), privata, credenziali: haMandatoPiattaforma(actor), comp, eval: evalu,
      confermaRichiesta: [...(d5Comp ? ["COMPENSATION" as const] : []), ...(d5Eval ? ["EVALUATION" as const] : [])],
    },
  };
}

function legamiDi(cat: Catalogo): LegameCatalogo[] {
  return [legamePersona(cat), ...cat.legami];
}
function tabellaDi(cat: Catalogo, l: LegameCatalogo): TabellaCatalogo {
  const t = l.id === ID_PERSONA ? cat.persona : cat.tabelle.get(l.tabella);
  if (!t) throw new Error(`faldone: tabella assente dal catalogo: ${l.tabella}`);
  return t;
}

function sezioneDi(cat: Catalogo, l: LegameCatalogo, righe: number, d: Diritti): FaldoneSezione {
  const c = classificazione(l);
  const t = tabellaDi(cat, l);
  const r = regolaPer(l, t, c, d);
  return {
    id: l.id, titolo: titolo(l, c), capitolo: c.capitolo, tabella: l.tabella, colonnaLegame: l.colonna,
    livello: l.livello, legame: soggetto(l) ? "soggetto" : "relazione", classe: c.classe,
    righe, colonne: t.colonne.length, visibilita: r.visibilita, campiOmessi: r.campiOmessi, motivoOmissis: r.motivo,
  };
}

const ordineCapitoli = new Map<string, number>(CAPITOLI.map((c, i) => [c, i]));
function ordinaSezioni(s: FaldoneSezione[]): FaldoneSezione[] {
  return s.sort((a, b) =>
    (ordineCapitoli.get(a.capitolo) ?? 99) - (ordineCapitoli.get(b.capitolo) ?? 99)
    || Number(a.legame === "relazione") - Number(b.legame === "relazione")
    || a.titolo.localeCompare(b.titolo, "it"));
}

/** Conta le righe di ogni sezione per la persona: una sola query, un ramo per legame. */
async function conteggi(cat: Catalogo, userId: string, d: Diritti): Promise<Map<string, number>> {
  const legami = cat.legami;
  const out = new Map<string, number>([[ID_PERSONA, 1]]);
  // Si spezza in blocchi per non comporre un'unica istruzione da centinaia di rami.
  for (let i = 0; i < legami.length; i += 60) {
    const blocco = legami.slice(i, i + 60);
    const sql = blocco.map((l, k) => `SELECT ${i + k} AS k, count(*)::int AS n ${daDove(cat, l, d)}`).join("\nUNION ALL\n");
    const r = await pool.query<{ k: number; n: number }>(sql, [userId]);
    for (const row of r.rows) out.set(legami[row.k]!.id, row.n);
  }
  return out;
}

async function costruisciIndice(actor: ActorContext, userId: string): Promise<{
  indice: FaldoneIndice; cat: Catalogo; diritti: Diritti;
}> {
  const cat = await catalogo(pool);
  const { persona, diritti } = await contesto(actor, userId);
  const n = await conteggi(cat, userId, diritti);
  const sezioni = ordinaSezioni(legamiDi(cat).map((l) => sezioneDi(cat, l, n.get(l.id) ?? 0, diritti)));
  const campiCatalogo = sezioni.reduce((s, x) => s + x.colonne, 0);
  return {
    cat, diritti,
    indice: {
      persona,
      generatoIl: new Date().toISOString(),
      totali: {
        sezioni: sezioni.length,
        sezioniConDati: sezioni.filter((s) => s.righe > 0).length,
        righe: sezioni.reduce((s, x) => s + x.righe, 0),
        campiCatalogo,
        sezioniConOmissis: sezioni.filter((s) => s.visibilita !== "piena").length,
      },
      confermaRichiesta: diritti.confermaRichiesta,
      sezioni,
    },
  };
}

async function righeDi(
  cat: Catalogo, l: LegameCatalogo, sezione: FaldoneSezione, d: Diritti, userId: string, limit: number, offset: number,
): Promise<FaldoneRighe> {
  const t = tabellaDi(cat, l);
  const omessi = new Set(sezione.campiOmessi);
  // Ciò che è {omissis} non si legge nemmeno dal database: non attraversa il processo.
  const colonne = t.colonne;
  const sel = colonne.map((c) => omessi.has(c.nome) ? `NULL::text AS ${ident(c.nome)}` : espressione("f", c.nome, c.tipo)).join(", ");
  const dove = l.id === ID_PERSONA ? `FROM sys.sys_users f WHERE f.${ident(l.colonna)} = $1::uuid` : daDove(cat, l, d);
  const [righe, tot] = await Promise.all([
    pool.query<Record<string, unknown>>(`SELECT ${sel} ${dove} ORDER BY ${ordine(t)} LIMIT $2 OFFSET $3`, [userId, limit, offset]),
    pool.query<{ n: number }>(`SELECT count(*)::int AS n ${dove}`, [userId]),
  ]);
  const out = righe.rows.map((r) => {
    for (const c of omessi) r[c] = FALDONE_OMISSIS;
    return r;
  });
  if (!d.hr || classificazione(l).anonima) await nascondiPersoneTerze(out, userId, omessi);
  const etichette = await etichetteDi(cat, t, out, omessi);
  const totale = tot.rows[0]?.n ?? 0;
  return {
    sezione, colonne: colonne.map((c) => ({ nome: c.nome, tipo: c.tipo })), righe: out, etichette,
    totale, limit, offset, prossimo: offset + out.length < totale ? offset + out.length : null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Il secondo strato, per valore (come l'esportazione GDPR): una cella che contiene l'identificativo
 *  di un'altra persona, senza che la colonna lo dichiari, diventa {omissis}. */
async function nascondiPersoneTerze(righe: Record<string, unknown>[], userId: string, omessi: Set<string>): Promise<void> {
  const candidati = new Set<string>();
  for (const r of righe) {
    for (const [k, v] of Object.entries(r)) {
      if (!omessi.has(k) && typeof v === "string" && UUID_RE.test(v) && v !== userId) candidati.add(v);
    }
  }
  if (!candidati.size) return;
  const q = await pool.query<{ id: string }>(
    "SELECT user_id::text AS id FROM sys.sys_users WHERE user_id::text = ANY($1::text[])", [[...candidati]],
  );
  const persone = new Set(q.rows.map((x) => x.id));
  if (!persone.size) return;
  for (const r of righe) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "string" && persone.has(v)) r[k] = FALDONE_OMISSIS;
    }
  }
}

/** Le etichette leggibili dei riferimenti di ogni riga: «Cognome, Nome», il titolo della posizione... */
async function etichetteDi(
  cat: Catalogo, t: TabellaCatalogo, righe: Record<string, unknown>[], omessi: Set<string>,
): Promise<Record<string, string>[]> {
  const out = righe.map(() => ({} as Record<string, string>));
  const riferimenti = t.colonne.filter((c) => c.riferisce && !omessi.has(c.nome));
  await Promise.all(riferimenti.map(async (c) => {
    const rif = c.riferisce!;
    const valori = [...new Set(righe.map((r) => r[c.nome]).filter((v): v is string => typeof v === "string"))];
    if (!valori.length) return;
    let sql: string | null = null;
    if (rif.tabella === ID_PERSONA) {
      sql = `SELECT user_id::text AS k, concat_ws(', ', nullif(user_last_name, ''), nullif(user_first_name, '')) AS v
               FROM sys.sys_users WHERE user_id::text = ANY($1::text[])`;
    } else {
      const tr = cat.tabelle.get(rif.tabella);
      if (tr?.etichetta) {
        sql = `SELECT ${ident(rif.colonna)}::text AS k, ${ident(tr.etichetta)}::text AS v
                 FROM ${identQualificato(rif.tabella)} WHERE ${ident(rif.colonna)}::text = ANY($1::text[])`;
      }
    }
    if (!sql) return;
    const r = await pool.query<{ k: string; v: string | null }>(sql, [valori]);
    const m = new Map(r.rows.filter((x) => x.v).map((x) => [x.k, x.v as string]));
    righe.forEach((riga, i) => {
      const v = riga[c.nome];
      if (typeof v === "string" && m.has(v)) out[i]![c.nome] = m.get(v)!;
    });
  }));
  return out;
}

export const faldoneService = {
  async indice(actor: ActorContext, userId: string): Promise<FaldoneIndice> {
    return (await costruisciIndice(actor, userId)).indice;
  },

  async sezione(actor: ActorContext, userId: string, id: string, q: { limit: number; offset: number }): Promise<FaldoneRighe> {
    const cat = await catalogo(pool);
    const { diritti } = await contesto(actor, userId);
    const l = id === ID_PERSONA ? legamePersona(cat) : cat.perId.get(id);
    if (!l) throw new NotFoundError("Sezione del faldone");
    const conteggio = await pool.query<{ n: number }>(
      l.id === ID_PERSONA ? "SELECT 1 AS n" : `SELECT count(*)::int AS n ${daDove(cat, l, diritti)}`,
      l.id === ID_PERSONA ? [] : [userId],
    );
    const sezione = sezioneDi(cat, l, conteggio.rows[0]?.n ?? 0, diritti);
    return righeDi(cat, l, sezione, diritti, userId, q.limit, q.offset);
  },

  async completo(actor: ActorContext, userId: string, q: { righePerSezione: number }): Promise<FaldoneCompleto> {
    const { indice, cat, diritti } = await costruisciIndice(actor, userId);
    const conDati = indice.sezioni.filter((s) => s.righe > 0);
    const contenuto: FaldoneCompleto["contenuto"] = [];
    // A gruppi di otto: abbastanza in parallelo da essere svelto, non tanto da occupare il pool.
    for (let i = 0; i < conDati.length; i += 8) {
      const blocco = await Promise.all(conDati.slice(i, i + 8).map(async (s) => {
        const l = s.id === ID_PERSONA ? legamePersona(cat) : cat.perId.get(s.id)!;
        const r = await righeDi(cat, l, s, diritti, userId, q.righePerSezione, 0);
        return { ...r, troncata: r.prossimo !== null };
      }));
      contenuto.push(...blocco);
    }
    return { ...indice, contenuto };
  },
};
