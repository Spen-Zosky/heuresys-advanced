/**
 * apps/api/src/modules/insights/probabilita.ts
 * F3c del piano AI-driven (ADR-0063 D5): le probabilità stimate sulla storia del
 * tenant, con l'incertezza dichiarata, per il motore degli scenari.
 *
 * Tutto qui è PURO: nessun accesso al database, nessun caso non riproducibile. Le
 * righe le legge `repository.ts` (`leggiStoriaPerStime`), questo file le trasforma in
 * stime con la loro banda. Ogni stima esce nella forma di un'ipotesi STIMA del
 * motore degli scenari (`ScenarioAssumption` di `@heuresys/shared`): valore, low,
 * high, unità e fonte di tipo STORIA. Il calcolatore di F3b la prende così com'è.
 *
 * I metodi, scelti perché reggono anche con pochi casi (la storia di RTL ha poche
 * uscite: una banda larga è la risposta onesta, non un difetto):
 *  - una frequenza k su n (uscire in un trimestre, passare alla posizione bersaglio,
 *    finire un corso entro la scadenza) si stima con la media a posteriori della Beta
 *    di Jeffreys, Beta(k + 1/2, n - k + 1/2), e la banda è il suo intervallo centrale;
 *    con zero casi la stima non è zero, e la banda lo dice;
 *  - la probabilità su più trimestri si ottiene dal tasso trimestrale con
 *    1 - (1 - q)^t, che è monotona: gli estremi della banda si trasformano allo stesso modo;
 *  - un tempo (giorni per chiudere una selezione, per finire un corso) si stima con il
 *    quantile empirico, e la banda è il bootstrap con un generatore a seme fisso, così
 *    due corse sugli stessi dati danno gli stessi numeri;
 *  - la prova su un periodo tenuto da parte stima il tasso sulla storia prima del
 *    taglio e confronta le uscite vere dopo il taglio con l'intervallo predittivo
 *    Beta-binomiale (che somma l'incertezza della stima e quella del caso).
 *
 * La regola lineare di `service.ts` (flight-risk-v1) resta dov'è finché la pagina la
 * usa: queste stime la sostituiscono nel motore degli scenari, dove serve una
 * probabilità con la sua banda e non un punteggio da 0 a 100.
 */

export const STIMATORE = "stima-storia@1.0.0";

/** Livello predefinito delle bande: intervallo centrale al 90%. */
export const LIVELLO_PREDEFINITO = 0.9;

/**
 * Ogni stima di questo file porta la dichiarazione: la storia da cui nasce è generata.
 * Per RTL Bank è vero (tenant dimostrativo, dati inventati per sviluppo e test); per un
 * tenant con storia vera `storiaGenerata` è false e la frase non compare.
 */
export const DICHIARAZIONE_STORIA_GENERATA =
  "La storia da cui nasce questa stima è generata: dati inventati per sviluppo e prova, non comportamenti osservati.";

export const FONTE_METODO = "doc:docs/piani/ai-driven_20261126/F3c_probabilita_dalla_storia.md";

// ── Funzioni speciali ──────────────────────────────────────────────────────────────────────

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Logaritmo della funzione Gamma (Lanczos, g = 7), per x > 0. */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = 0.99999999999980993;
  const t = z + 7.5;
  for (let i = 0; i < LANCZOS.length; i++) a += (LANCZOS[i] as number) / (z + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

function lnBeta(a: number, b: number): number {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b);
}

/** Frazione continua della Beta incompleta (Lentz modificato). */
function betaCf(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Funzione di ripartizione della Beta(a, b): la Beta incompleta regolarizzata I_x(a, b). */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) return (front * betaCf(x, a, b)) / a;
  return 1 - (front * betaCf(1 - x, b, a)) / b;
}

/** Quantile della Beta(a, b) per bisezione sulla ripartizione (monotona): errore < 1e-12. */
export function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Le stime ───────────────────────────────────────────────────────────────────────────────

export interface Stima {
  valore: number;
  low: number;
  high: number;
  /** Livello dell'intervallo, per esempio 0,9. */
  livello: number;
  /** Quanti casi la sostengono: n per una frequenza, numero di durate per un tempo. */
  casi: number;
}

function controllaLivello(livello: number): void {
  if (!(livello > 0 && livello < 1)) throw new RangeError(`livello fuori da (0, 1): ${livello}`);
}

/**
 * Frequenza k su n con la Beta di Jeffreys: media a posteriori e intervallo centrale.
 * n = 0 è ammesso: la stima è 1/2 e la banda va da quasi 0 a quasi 1, che è ciò che si sa.
 */
export function frequenzaJeffreys(k: number, n: number, livello = LIVELLO_PREDEFINITO): Stima {
  controllaLivello(livello);
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || n < 0 || k > n) {
    throw new RangeError(`frequenza non valida: ${k} su ${n}`);
  }
  const a = k + 0.5;
  const b = n - k + 0.5;
  const coda = (1 - livello) / 2;
  return {
    valore: a / (a + b),
    low: betaQuantile(coda, a, b),
    high: betaQuantile(1 - coda, a, b),
    livello,
    casi: n,
  };
}

/** Da un tasso per periodo q alla probabilità di almeno un evento in t periodi: 1 - (1 - q)^t. */
export function suPiuPeriodi(s: Stima, periodi: number): Stima {
  if (!(periodi > 0)) throw new RangeError(`periodi non positivi: ${periodi}`);
  const f = (q: number): number => 1 - Math.pow(1 - q, periodi);
  return { ...s, valore: f(s.valore), low: f(s.low), high: f(s.high) };
}

/** Quantile empirico, interpolazione lineare (tipo 7, quello di R e di PostgreSQL percentile_cont). */
export function quantileEmpirico(valori: readonly number[], q: number): number {
  if (valori.length === 0) throw new RangeError("nessun valore");
  if (!(q >= 0 && q <= 1)) throw new RangeError(`quantile fuori da [0, 1]: ${q}`);
  const s = [...valori].sort((x, y) => x - y);
  const h = (s.length - 1) * q;
  const i = Math.floor(h);
  const lo = s[i] as number;
  const hi = s[Math.min(i + 1, s.length - 1)] as number;
  return lo + (h - i) * (hi - lo);
}

/** Generatore pseudo-casuale a seme fisso (mulberry32): la banda bootstrap si riproduce. */
export function generatore(seme: number): () => number {
  let t = seme >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Un tempo (in giorni) stimato con il quantile empirico q, banda bootstrap a percentili.
 * Con meno di due durate la stima non si fa: chi chiama lo dice, invece di inventare una banda.
 */
export function durataBootstrap(
  durate: readonly number[],
  q = 0.5,
  opzioni: { estrazioni?: number; seme?: number; livello?: number } = {},
): Stima | null {
  const livello = opzioni.livello ?? LIVELLO_PREDEFINITO;
  controllaLivello(livello);
  if (durate.length < 2) return null;
  const estrazioni = opzioni.estrazioni ?? 2000;
  const caso = generatore(opzioni.seme ?? 20261126);
  const n = durate.length;
  const ricampionati: number[] = new Array<number>(estrazioni);
  const campione: number[] = new Array<number>(n);
  for (let e = 0; e < estrazioni; e++) {
    for (let i = 0; i < n; i++) campione[i] = durate[Math.floor(caso() * n)] as number;
    ricampionati[e] = quantileEmpirico(campione, q);
  }
  const coda = (1 - livello) / 2;
  const valore = quantileEmpirico(durate, q);
  return {
    valore,
    low: Math.min(valore, quantileEmpirico(ricampionati, coda)),
    high: Math.max(valore, quantileEmpirico(ricampionati, 1 - coda)),
    livello,
    casi: n,
  };
}

// ── Le uscite per trimestre e la prova sul periodo tenuto da parte ──────────────────────────

/** Un trimestre della storia: chi era in forza all'inizio e quanti ne sono usciti dentro. */
export interface TrimestreStorico {
  /** Primo giorno del trimestre, AAAA-MM-GG. */
  inizio: string;
  esposti: number;
  uscite: number;
}

/** Tasso trimestrale di uscita su un insieme di trimestri: uscite totali su persone-trimestre. */
export function tassoTrimestraleUscita(trimestri: readonly TrimestreStorico[], livello = LIVELLO_PREDEFINITO): Stima {
  let k = 0;
  let n = 0;
  for (const t of trimestri) {
    if (t.uscite > t.esposti || t.uscite < 0) throw new RangeError(`trimestre ${t.inizio}: ${t.uscite} uscite su ${t.esposti}`);
    k += t.uscite;
    n += t.esposti;
  }
  return frequenzaJeffreys(k, n, livello);
}

/** Logaritmo della densità Beta-binomiale: k successi su n con p ~ Beta(a, b). */
function lnBetaBinomiale(k: number, n: number, a: number, b: number): number {
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1) + lnBeta(k + a, n - k + b) - lnBeta(a, b);
}

/**
 * Intervallo predittivo delle uscite su `esposti` persone-trimestre, dato il tasso
 * stimato su k uscite in n persone-trimestre (a posteriori Jeffreys): estremi interi.
 */
export function intervalloPredittivoUscite(
  k: number,
  n: number,
  esposti: number,
  livello = LIVELLO_PREDEFINITO,
): { atteso: number; low: number; high: number } {
  controllaLivello(livello);
  const a = k + 0.5;
  const b = n - k + 0.5;
  const coda = (1 - livello) / 2;
  let cumulata = 0;
  let low = -1;
  let high = esposti;
  for (let x = 0; x <= esposti; x++) {
    cumulata += Math.exp(lnBetaBinomiale(x, esposti, a, b));
    if (low < 0 && cumulata >= coda) low = x;
    if (cumulata >= 1 - coda) {
      high = x;
      break;
    }
  }
  return { atteso: (esposti * a) / (a + b), low: Math.max(low, 0), high };
}

export interface ProvaTenutaDaParte {
  /** Primo trimestre tenuto da parte: la stima usa solo i trimestri prima di questo. */
  taglio: string;
  trimestriStima: number;
  trimestriProva: number;
  tasso: Stima;
  usciteVere: number;
  previste: { atteso: number; low: number; high: number };
  /** Le uscite vere stanno dentro l'intervallo predittivo. */
  dentro: boolean;
}

/**
 * La prova di F3c: stima sulla storia prima del taglio, confronto con le uscite vere dopo.
 * I trimestri sono in ordine qualsiasi; quelli con inizio >= taglio sono la prova.
 */
export function provaSuPeriodoTenutoDaParte(
  trimestri: readonly TrimestreStorico[],
  taglio: string,
  livello = LIVELLO_PREDEFINITO,
): ProvaTenutaDaParte {
  const stima = trimestri.filter((t) => t.inizio < taglio);
  const prova = trimestri.filter((t) => t.inizio >= taglio);
  if (stima.length === 0 || prova.length === 0) {
    throw new RangeError(`il taglio ${taglio} non lascia trimestri da entrambe le parti`);
  }
  const tasso = tassoTrimestraleUscita(stima, livello);
  const k = stima.reduce((s, t) => s + t.uscite, 0);
  const n = stima.reduce((s, t) => s + t.esposti, 0);
  const esposti = prova.reduce((s, t) => s + t.esposti, 0);
  const usciteVere = prova.reduce((s, t) => s + t.uscite, 0);
  const previste = intervalloPredittivoUscite(k, n, esposti, livello);
  return {
    taglio,
    trimestriStima: stima.length,
    trimestriProva: prova.length,
    tasso,
    usciteVere,
    previste,
    dentro: usciteVere >= previste.low && usciteVere <= previste.high,
  };
}

// ── Dalla stima all'ipotesi dello scenario ─────────────────────────────────────────────────

/** Un'ipotesi STIMA pronta per `sys.sys_scenario_assumptions` (l'id lo mette chi la scrive). */
export interface IpotesiStimata {
  kind: "STIMA";
  statement: string;
  value: number;
  unit: string;
  low: number;
  high: number;
  sources: { kind: "STORIA"; ref: string; label: string }[];
  /** Dettaglio per chi spiega: livello, casi, metodo, stimatore e dichiarazione. */
  dettaglio: {
    livello: number;
    casi: number;
    metodo: string;
    stimatore: string;
    storiaGenerata: boolean;
    dichiarazione: string | null;
  };
}

const arrotonda = (x: number, cifre: number): number => {
  const f = Math.pow(10, cifre);
  return Math.round(x * f) / f;
};

/**
 * Trasforma una stima in ipotesi. `unit` e `scala` dicono come si legge il numero:
 * per una probabilità `unit = "%"` e `scala = 100`; per un tempo `unit = "giorni"` e `scala = 1`.
 */
export function comeIpotesi(
  s: Stima,
  descrizione: {
    statement: string;
    unit: string;
    scala?: number;
    cifre?: number;
    metodo: string;
    fonte: { ref: string; label: string };
    storiaGenerata: boolean;
  },
): IpotesiStimata {
  const scala = descrizione.scala ?? 1;
  const cifre = descrizione.cifre ?? 2;
  const low = arrotonda(s.low * scala, cifre);
  const high = arrotonda(s.high * scala, cifre);
  const value = Math.min(high, Math.max(low, arrotonda(s.valore * scala, cifre)));
  const statement = descrizione.storiaGenerata
    ? `${descrizione.statement} ${DICHIARAZIONE_STORIA_GENERATA}`
    : descrizione.statement;
  return {
    kind: "STIMA",
    statement,
    value,
    unit: descrizione.unit,
    low,
    high,
    sources: [
      { kind: "STORIA", ref: descrizione.fonte.ref, label: descrizione.fonte.label },
      { kind: "STORIA", ref: FONTE_METODO, label: "Come si stimano le probabilità dalla storia (F3c)" },
    ],
    dettaglio: {
      livello: s.livello,
      casi: s.casi,
      metodo: descrizione.metodo,
      stimatore: STIMATORE,
      storiaGenerata: descrizione.storiaGenerata,
      dichiarazione: descrizione.storiaGenerata ? DICHIARAZIONE_STORIA_GENERATA : null,
    },
  };
}
