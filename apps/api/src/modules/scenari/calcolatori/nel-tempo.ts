/**
 * apps/api/src/modules/scenari/calcolatori/nel-tempo.ts — il calcolatore della famiglia NEL TEMPO,
 * voce F3b-3 del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md (ADR-0063 D5).
 *
 * Serve la voce S-T3 del catalogo (resistenza): nei prossimi 6, 12 e 36 mesi le persone escono con
 * la probabilità stimata sulla storia del tenant (F3c), le posizioni si liberano, i successori le
 * coprono quando sono pronti, e il calcolatore dice che cosa resta scoperto a ogni orizzonte e quali
 * unità cedono per prime. Il risultato non è un numero solo: è la distribuzione di molte estrazioni,
 * riassunta con la mediana e la banda centrale al 90%.
 *
 * Logica PURA: niente database e niente orologio; il caso viene da un generatore a seme fisso
 * (mulberry32 di probabilita.ts), quindi lo stesso ingresso dà sempre lo stesso esito.
 *
 * Regole, scritte una volta (il servizio le dichiara come politiche dello scenario):
 *   1. Il tempo va a trimestri. In ogni trimestre ogni persona titolare PRIMARY esce con probabilità
 *      q, la stessa per tutti; l'uscita cade a metà del trimestre. Con una stima della storia, q si
 *      estrae a ogni estrazione dalla Beta a posteriori (incertezza sul tasso, oltre al caso); con un
 *      tasso imposto (prova di resistenza) q è quello.
 *   2. Chi esce non torna e non è più candidabile. Le persone nuove (assunte da fuori) possono a loro
 *      volta uscire con lo stesso q, ma non sono nelle tavole di successione.
 *   3. Copertura NESSUNA: le posizioni liberate restano scoperte fino all'orizzonte.
 *      Copertura INTERNA: a ogni trimestre le uscite si coprono a cascata con il calcolatore della
 *      successione (stesse regole di scelta); il successore copre quando è pronto (READY_NOW subito,
 *      READY_6_MONTHS dopo 6 mesi, …) e lascia la sua posizione in quel momento, che da lì è
 *      scoperta. Una posizione che non trova un successore resta scoperta.
 *      Copertura INTERNA_ED_ESTERNA: come INTERNA, e ciò che resta scoperto si copre da fuori dopo
 *      una durata di selezione estratta fra quelle osservate nella storia del tenant.
 *   4. Le assegnazioni SECONDARY, INTERIM e ACTING non coprono e non liberano (come in successione.ts).
 *   5. Le estrazioni condividono il caso fra le opzioni: la stessa estrazione fa uscire le stesse
 *      persone della fotografia in ogni opzione finché sono titolari, così le opzioni si confrontano
 *      sulle stesse uscite e non su sorti diverse.
 *   6. Il tasso può essere dato per persona (`tassoPerPersona`): vale al posto di q per chi c'è.
 *   7. Approssimazione dichiarata: dal trimestre in cui è scelto, il successore conta come titolare
 *      della posizione nuova (se esce prima di essere pronto, la libera di nuovo); la sua posizione
 *      vecchia si conta scoperta dal momento in cui si sposta.
 */
import { betaQuantile, generatore, quantileEmpirico } from "../../insights/probabilita.js";
import {
  calcolaSuccessione,
  CRITICITA_ALTE,
  PROFONDITA_CASCATA,
  type PosizioneOmbra,
  type Successore,
  type TitolareOmbra,
} from "./successione.js";

export const CALCOLATORE_NEL_TEMPO = "nel-tempo@0.1.0" as const;

export const COPERTURE = ["NESSUNA", "INTERNA", "INTERNA_ED_ESTERNA"] as const;
export type Copertura = (typeof COPERTURE)[number];

/** Livello della banda dei risultati: dal 5° al 95° percentile delle estrazioni. */
export const LIVELLO_BANDA = 0.9;
/** Un'unità «cede» quando a un orizzonte ha scoperto almeno questa quota delle sue posizioni. */
export const SOGLIA_CEDIMENTO = 0.25;
/** Le unità troppo piccole cedono per costruzione: si guardano solo quelle con almeno tante posizioni. */
export const POSIZIONI_MINIME_UNITA = 3;
/** Giorni medi di un mese, per portare i giorni di selezione sulla scala dei mesi. */
export const GIORNI_PER_MESE = 365.25 / 12;

export interface PosizioneNelTempo extends PosizioneOmbra {
  unitaId: string | null;
}

export type TassoUscita =
  /** tasso trimestrale con la sua incertezza: Beta(a, b) a posteriori (Jeffreys: a = k + ½, b = n − k + ½) */
  | { tipo: "STIMA"; a: number; b: number }
  /** tasso trimestrale imposto, per una prova di resistenza */
  | { tipo: "IMPOSTO"; trimestrale: number };

export interface IngressoNelTempo {
  posizioni: readonly PosizioneNelTempo[];
  titolari: readonly TitolareOmbra[];
  successori: readonly Successore[];
  tasso: TassoUscita;
  /** giorni dall'apertura di una selezione all'ingresso, osservati nella storia; vuoto = nessuna selezione esterna possibile */
  giorniSelezione: readonly number[];
  /** orizzonti in mesi, multipli di 3, da 3 a 120 */
  orizzontiMesi: readonly number[];
  estrazioni: number;
  seme: number;
  /** tasso trimestrale di una persona, al posto di quello comune (le probabilità per persona di S-T3) */
  tassoPerPersona?: ReadonlyMap<string, number>;
}

export interface Distribuzione {
  mediana: number;
  low: number;
  high: number;
}

export interface MisureOrizzonte {
  mesi: number;
  uscite: Distribuzione;
  posizioniScoperte: Distribuzione;
  posizioniCriticheScoperte: Distribuzione;
  /** somma dei mesi di scopertura di tutte le posizioni fino all'orizzonte: il costo del vuoto */
  mesiDiScopertura: Distribuzione;
  personeSpostate: Distribuzione;
  assunzioniEsterne: Distribuzione;
  /** probabilità (0-1) che almeno una posizione critica o ad alta criticità sia scoperta */
  probabilitaCriticaScoperta: number;
}

export interface UnitaCheCede {
  unitaId: string;
  posizioni: number;
  /** quota delle estrazioni in cui l'unità ha scoperto almeno SOGLIA_CEDIMENTO delle sue posizioni */
  probabilita: number;
}

export interface EsitoNelTempo {
  copertura: Copertura;
  estrazioni: number;
  orizzonti: MisureOrizzonte[];
  /** per ogni orizzonte, le unità con probabilità di cedere maggiore di zero, dalla più esposta */
  unitaCheCedono: Record<number, UnitaCheCede[]>;
  /** il tasso trimestrale medio estratto, per la spiegazione */
  tassoTrimestraleMedio: number;
}

interface Intervallo {
  posizioneId: string;
  dal: number;
  al: number; // Infinity = non coperta
}

function confronta(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function controlla(x: IngressoNelTempo): void {
  if (!Number.isInteger(x.estrazioni) || x.estrazioni < 1) throw new Error(`estrazioni non valide: ${x.estrazioni}`);
  if (x.orizzontiMesi.length === 0) throw new Error("serve almeno un orizzonte");
  for (const h of x.orizzontiMesi) {
    if (!Number.isInteger(h) || h < 3 || h > 120 || h % 3 !== 0) throw new Error(`orizzonte non valido: ${h}`);
  }
  if (x.tasso.tipo === "IMPOSTO" && !(x.tasso.trimestrale >= 0 && x.tasso.trimestrale < 1)) {
    throw new Error(`tasso imposto fuori da [0, 1): ${x.tasso.trimestrale}`);
  }
  if (x.tasso.tipo === "STIMA" && !(x.tasso.a > 0 && x.tasso.b > 0)) throw new Error("parametri della Beta non positivi");
}

/** Dal tasso annuo al tasso trimestrale equivalente: 1 − (1 − p)^(1/4). */
export function trimestraleDaAnnuo(annuo: number): number {
  if (!(annuo >= 0 && annuo < 1)) throw new Error(`tasso annuo fuori da [0, 1): ${annuo}`);
  return 1 - Math.pow(1 - annuo, 1 / 4);
}

function distribuzione(valori: number[]): Distribuzione {
  const coda = (1 - LIVELLO_BANDA) / 2;
  return {
    mediana: quantileEmpirico(valori, 0.5),
    low: quantileEmpirico(valori, coda),
    high: quantileEmpirico(valori, 1 - coda),
  };
}

/** Una corsa dall'oggi all'orizzonte più lontano: gli intervalli di scopertura e i movimenti nel tempo. */
function unaCorsa(
  x: IngressoNelTempo,
  copertura: Copertura,
  estrazione: number,
  trimestri: number,
): { q: number; uscite: number[]; spostamenti: number[]; assunzioni: number[]; scoperture: Intervallo[] } {
  const casoUscite = generatore((x.seme + Math.imul(estrazione + 1, 0x9e3779b1)) >>> 0);
  const casoEsterni = generatore((x.seme ^ Math.imul(estrazione + 1, 0x85ebca6b)) >>> 0);
  const q = x.tasso.tipo === "IMPOSTO" ? x.tasso.trimestrale : betaQuantile(casoUscite(), x.tasso.a, x.tasso.b);

  const posizioni = new Map(x.posizioni.map((p) => [p.id, p]));
  // stato corrente: titolari PRIMARY per posizione
  const titolari: TitolareOmbra[] = x.titolari.filter((t) => t.tipo === "PRIMARY" && t.userId !== null && posizioni.has(t.posizioneId));
  const persone0 = [...new Set(titolari.map((t) => t.userId as string))].sort(confronta);
  const usciti = new Set<string>();
  let contatoreEsterni = 0;

  const uscite: number[] = [];
  const spostamenti: number[] = [];
  const assunzioni: number[] = [];
  const scoperture: Intervallo[] = [];

  for (let t = 1; t <= trimestri; t++) {
    const istante = 3 * (t - 1) + 1.5;
    // (5) caso condiviso: un'estrazione per persona della fotografia e per trimestre, sempre consumata
    const inCarica = new Set(titolari.map((a) => a.userId as string));
    const escono: string[] = [];
    for (const u of persone0) {
      const r = casoUscite();
      if (inCarica.has(u) && !usciti.has(u) && r < (x.tassoPerPersona?.get(u) ?? q)) escono.push(u);
    }
    // le persone assunte da fuori, in ordine di assunzione, con il loro caso
    const esterni = [...inCarica].filter((u) => u.startsWith("esterno:")).sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)));
    for (const u of esterni) if (casoEsterni() < q) escono.push(u);
    if (escono.length === 0) continue;
    for (const u of escono) {
      usciti.add(u);
      uscite.push(istante);
    }

    const profondita = copertura === "NESSUNA" ? 0 : PROFONDITA_CASCATA;
    const successori = x.successori.filter((s) => !usciti.has(s.userId));
    const esito = calcolaSuccessione(
      { posizioni: x.posizioni, titolari, successori, uscite: escono },
      profondita,
    );

    // istanti: una posizione lasciata da chi esce si scopre adesso; da un successore, quando si sposta
    const sposta = new Map<string, number>();
    const vacanzaDal = (lasciataDa: string): number => sposta.get(lasciataDa) ?? istante;
    const scoperteOra = new Set(esito.scoperte);
    for (const p of esito.passi) {
      const dal = vacanzaDal(p.lasciataDa);
      if (p.successoreUserId === null) continue;
      const al = dal + (p.mesi ?? 0);
      sposta.set(p.successoreUserId, al);
      spostamenti.push(al);
      if (al > dal) scoperture.push({ posizioneId: p.posizioneId, dal, al });
    }
    // le posizioni che restano scoperte: ognuna con l'istante in cui si è liberata
    const liberazione = new Map<string, number>();
    for (const p of esito.passi) if (!liberazione.has(p.posizioneId)) liberazione.set(p.posizioneId, vacanzaDal(p.lasciataDa));
    // oltre il limite (o con profondità 0) una posizione liberata non ha passo: si è liberata da chi la teneva
    const titolarePrima = new Map<string, string>();
    for (const a of titolari) if (!titolarePrima.has(a.posizioneId)) titolarePrima.set(a.posizioneId, a.userId as string);

    // aggiorna lo stato: escono le uscite e i successori spostati lasciano la vecchia posizione
    const lasciano = new Set([...escono, ...esito.spostati]);
    const nuovi: TitolareOmbra[] = titolari.filter((a) => !lasciano.has(a.userId as string));
    for (const p of esito.passi) {
      if (p.successoreUserId !== null) nuovi.push({ id: `nuova:${p.posizioneId}:${p.successoreUserId}`, posizioneId: p.posizioneId, userId: p.successoreUserId, tipo: "PRIMARY" });
    }
    for (const posId of [...scoperteOra].sort(confronta)) {
      const dal = liberazione.get(posId) ?? vacanzaDal(titolarePrima.get(posId) ?? "");
      let al = Infinity;
      if (copertura === "INTERNA_ED_ESTERNA" && x.giorniSelezione.length > 0) {
        const giorni = x.giorniSelezione[Math.floor(casoEsterni() * x.giorniSelezione.length)] as number;
        al = dal + giorni / GIORNI_PER_MESE;
        const id = `esterno:${contatoreEsterni++}`;
        assunzioni.push(al);
        nuovi.push({ id: `nuova:${posId}:${id}`, posizioneId: posId, userId: id, tipo: "PRIMARY" });
      }
      scoperture.push({ posizioneId: posId, dal, al });
    }
    titolari.length = 0;
    titolari.push(...nuovi);
  }
  return { q, uscite, spostamenti, assunzioni, scoperture };
}

export function calcolaNelTempo(x: IngressoNelTempo, copertura: Copertura): EsitoNelTempo {
  controlla(x);
  const orizzonti = [...new Set(x.orizzontiMesi)].sort((a, b) => a - b);
  const trimestri = (orizzonti[orizzonti.length - 1] as number) / 3;
  const posizioni = new Map(x.posizioni.map((p) => [p.id, p]));
  const critiche = new Set(x.posizioni.filter((p) => CRITICITA_ALTE.has(p.criticita ?? "")).map((p) => p.id));

  const posizioniPerUnita = new Map<string, number>();
  for (const p of x.posizioni) if (p.unitaId) posizioniPerUnita.set(p.unitaId, (posizioniPerUnita.get(p.unitaId) ?? 0) + 1);
  const unitaGuardate = [...posizioniPerUnita].filter(([, n]) => n >= POSIZIONI_MINIME_UNITA).map(([u]) => u).sort(confronta);

  type Serie = { uscite: number[]; scoperte: number[]; critiche: number[]; mesi: number[]; spostate: number[]; esterne: number[]; conCritica: number };
  const serie = new Map<number, Serie>(orizzonti.map((h) => [h, { uscite: [], scoperte: [], critiche: [], mesi: [], spostate: [], esterne: [], conCritica: 0 }]));
  const cedimenti = new Map<number, Map<string, number>>(orizzonti.map((h) => [h, new Map()]));
  let sommaQ = 0;

  for (let e = 0; e < x.estrazioni; e++) {
    const c = unaCorsa(x, copertura, e, trimestri);
    sommaQ += c.q;
    for (const h of orizzonti) {
      const s = serie.get(h)!;
      const aperte = new Set<string>();
      let mesi = 0;
      for (const v of c.scoperture) {
        if (v.dal <= h && v.al > h) aperte.add(v.posizioneId);
        if (v.dal < h) mesi += Math.min(h, v.al) - v.dal;
      }
      const critScoperte = [...aperte].filter((p) => critiche.has(p)).length;
      s.uscite.push(c.uscite.filter((t) => t <= h).length);
      s.scoperte.push(aperte.size);
      s.critiche.push(critScoperte);
      s.mesi.push(Math.round(mesi * 10) / 10);
      s.spostate.push(c.spostamenti.filter((t) => t <= h).length);
      s.esterne.push(c.assunzioni.filter((t) => t <= h).length);
      if (critScoperte > 0) s.conCritica += 1;
      const perUnita = new Map<string, number>();
      for (const p of aperte) {
        const u = posizioni.get(p)?.unitaId;
        if (u) perUnita.set(u, (perUnita.get(u) ?? 0) + 1);
      }
      const ced = cedimenti.get(h)!;
      for (const u of unitaGuardate) {
        if ((perUnita.get(u) ?? 0) / (posizioniPerUnita.get(u) as number) >= SOGLIA_CEDIMENTO) ced.set(u, (ced.get(u) ?? 0) + 1);
      }
    }
  }

  const unitaCheCedono: Record<number, UnitaCheCede[]> = {};
  for (const h of orizzonti) {
    unitaCheCedono[h] = [...cedimenti.get(h)!]
      .map(([unitaId, n]) => ({ unitaId, posizioni: posizioniPerUnita.get(unitaId) as number, probabilita: n / x.estrazioni }))
      .sort((a, b) => b.probabilita - a.probabilita || confronta(a.unitaId, b.unitaId));
  }
  return {
    copertura,
    estrazioni: x.estrazioni,
    orizzonti: orizzonti.map((h) => {
      const s = serie.get(h)!;
      return {
        mesi: h,
        uscite: distribuzione(s.uscite),
        posizioniScoperte: distribuzione(s.scoperte),
        posizioniCriticheScoperte: distribuzione(s.critiche),
        mesiDiScopertura: distribuzione(s.mesi),
        personeSpostate: distribuzione(s.spostate),
        assunzioniEsterne: distribuzione(s.esterne),
        probabilitaCriticaScoperta: s.conCritica / x.estrazioni,
      };
    }),
    unitaCheCedono,
    tassoTrimestraleMedio: sommaQ / x.estrazioni,
  };
}

/** Per le prove: una corsa sola, con gli intervalli di scopertura, per confrontarla con un calcolo a mano. */
export function unaCorsaPerLeProve(x: IngressoNelTempo, copertura: Copertura, estrazione = 0) {
  controlla(x);
  const trimestri = Math.max(...x.orizzontiMesi) / 3;
  return unaCorsa(x, copertura, estrazione, trimestri);
}
