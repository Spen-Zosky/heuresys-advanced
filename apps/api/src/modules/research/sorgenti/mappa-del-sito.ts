/**
 * apps/api/src/modules/research/sorgenti/mappa-del-sito.ts
 *
 * #205 F2 (S1097) — LA FASE «INDIRIZZI» DEVE SAPER CERCARE, NON INDOVINARE.
 *
 * Misurato in S1096, tre corse su tre: il modello *indovina* i percorsi delle fonti ammesse e
 * meta' sono 404; le pagine che indovina non descrivono come e' fatta una societa' di
 * consulenza; la corsa risponde vuoto (che e' il comportamento giusto quando non si trova
 * niente) e i domini di contenuto restano a zero proposte. Il difetto non e' del modello:
 * gli si chiede di conoscere a memoria l'albero di un sito istituzionale.
 *
 * Il rimedio sta QUI, nell'API, e non nel gateway — che per §4.4 non ha strumenti e non
 * deve averne. Per ogni fonte ammessa l'API legge la **mappa del sito** (`/sitemap.xml`, e le
 * sotto-mappe se e' un indice) attraverso lo stesso lettore delle pagine — stesse guardie,
 * stessi limiti, stessa impronta — ne estrae gli indirizzi reali, li ordina per attinenza
 * alle domande del mandato, e li passa al modello come CANDIDATI fra cui scegliere. Il
 * modello sceglie; non inventa piu'.
 *
 * ⚠ Cio' che NON cambia: nessuna interrogazione a motori terzi (§4.5: il nome del cliente non
 * esce, e nemmeno le sue domande, verso qualcuno che non sia una fonte ammessa); una mappa
 * che non c'e', che e' troppo grande per il lettore, o che non si apre, NON ferma la corsa —
 * si torna a chiedere al modello senza candidati, come prima, e il fatto si registra.
 */

/** Gli indirizzi in una mappa del sito, o in un suo indice. Legge XML come TESTO: il lettore
 *  ha gia' spogliato i tag, restano gli indirizzi — che e' tutto cio' che serve. */
export function indirizziDaMappa(testo: string): string[] {
  const visti = new Set<string>();
  for (const m of testo.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const url = m[0].replace(/[),.;]+$/, "");
    if (url.startsWith("https://")) visti.add(url);
  }
  return [...visti];
}

/**
 * Un indirizzo che e' una mappa, non una pagina. La coda di interrogazione e' ammessa:
 * misurato il 2026-09-13 (S1098) su `ilo.org`, il cui indice elenca 90 sotto-mappe come
 * `sitemap.xml?page=N` — senza questa tolleranza l'indice passava per una mappa di 90
 * PAGINE, il modello riceveva 90 «candidati» che erano tutti mappe, e sceglieva nulla.
 */
export const E_UNA_MAPPA = /sitemap[^/?]*\.xml(\.gz)?(\?[^/]*)?$/i;

/** Una mappa e' un INDICE se i suoi indirizzi sono, in maggioranza, altre mappe. */
export function eIndiceDiMappe(indirizzi: string[]): boolean {
  if (indirizzi.length === 0) return false;
  const mappe = indirizzi.filter((u) => E_UNA_MAPPA.test(u)).length;
  return mappe * 2 >= indirizzi.length;
}

const PAROLE_VUOTE = new Set([
  "quali", "quale", "come", "sono", "della", "delle", "degli", "dello", "nella", "nelle",
  "per", "con", "una", "uno", "che", "del", "dei", "gli", "le", "la", "il", "di", "da", "in",
  "un", "e", "ed", "a", "al", "ai", "alla", "alle", "su", "tra", "fra", "non", "si", "lo",
  "societa", "azienda", "aziende", "settore", "the", "and", "for", "of",
]);

/** Le parole che contano in una domanda: senza articoli e senza le parole di ogni domanda. */
export function paroleChiave(domande: string[]): string[] {
  const out = new Set<string>();
  for (const d of domande) {
    for (const p of d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/)) {
      if (p.length >= 4 && !PAROLE_VUOTE.has(p)) out.add(p);
    }
  }
  return [...out];
}

/** Ordina gli indirizzi per attinenza: quante parole chiave compaiono nel PERCORSO (non nel
 *  dominio, che e' uguale per tutti). A parita', il percorso piu' corto prima — una pagina di
 *  sezione dice piu' di una di dettaglio. Chi non combacia con niente resta in coda.
 *  Il confronto e' sulla RADICE (i primi sei caratteri): «organizzata» deve trovare
 *  «organizzazione» e «impresa» deve trovare «imprese» — il primo test lo ha detto subito,
 *  con «news» davanti a «organizzazione» per pura brevita'. */
export function ordinaPerAttinenza(indirizzi: string[], domande: string[]): string[] {
  const chiavi = paroleChiave(domande).map((k) => k.slice(0, 6));
  const punteggio = (u: string): number => {
    let percorso: string;
    try { percorso = new URL(u).pathname.toLowerCase(); } catch { return -1; }
    const norm = percorso.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return chiavi.reduce((n, k) => n + (norm.includes(k) ? 1 : 0), 0);
  };
  return [...indirizzi]
    .map((u) => ({ u, p: punteggio(u), l: u.length }))
    .sort((a, b) => b.p - a.p || a.l - b.l)
    .map((x) => x.u);
}

export interface EsitoMappa {
  /** I candidati, gia' ordinati e tagliati al tetto. */
  candidati: string[];
  /** Cosa e' successo per ciascuna fonte: si registra, non si tace. */
  fonti: Array<{ host: string; mappe: number; indirizzi: number; esito: "letta" | "assente" | "vuota" }>;
}

/**
 * Raccoglie i candidati dalle mappe delle fonti ammesse. `leggi` e' quello del mandato: passa
 * dal lettore con le sue guardie e conta nel tetto delle pagine della corsa — una mappa e'
 * una lettura come le altre, e come le altre lascia l'impronta.
 */
export async function candidatiDalleMappe(
  fontiAmmesse: string[],
  domande: string[],
  leggi: (url: string) => Promise<{ testoNonFidato: string }>,
  opzioni: { tettoCandidati?: number; sottoMappeMassime?: number; mappeMassime?: number } = {},
): Promise<EsitoMappa> {
  const tetto = opzioni.tettoCandidati ?? 120;
  const sottoMax = opzioni.sottoMappeMassime ?? 2;
  // Le mappe contano nel tetto delle pagine della corsa (40): un limite proprio, cosi' otto
  // fonti con indici profondi non consumano da sole il budget delle pagine vere.
  const mappeMax = opzioni.mappeMassime ?? 12;
  let mappeLette = 0;
  const tutti: string[] = [];
  const fonti: EsitoMappa["fonti"] = [];
  for (const host of fontiAmmesse) {
    if (mappeLette >= mappeMax) break;
    const h = host.replace(/^\*\./, "").replace(/^\./, "");
    let mappe = 0;
    const trovati: string[] = [];
    const daLeggere = [`https://${h}/sitemap.xml`, `https://www.${h}/sitemap.xml`];
    let letta = false;
    for (const url of daLeggere) {
      let testo: string;
      try { testo = (await leggi(url)).testoNonFidato; } catch { continue; }
      letta = true; mappe += 1; mappeLette += 1;
      const ind = indirizziDaMappa(testo);
      if (eIndiceDiMappe(ind)) {
        // le sotto-mappe piu' attinenti, poche: un indice puo' averne centinaia
        for (const sotto of ordinaPerAttinenza(ind.filter((u) => /sitemap/i.test(u)), domande).slice(0, sottoMax)) {
          if (mappeLette >= mappeMax) break;
          try {
            const t2 = (await leggi(sotto)).testoNonFidato;
            mappe += 1; mappeLette += 1;
            trovati.push(...indirizziDaMappa(t2).filter((u) => !E_UNA_MAPPA.test(u)));
          } catch { /* una sotto-mappa che non si apre non ferma le altre */ }
        }
      } else {
        trovati.push(...ind);
      }
      break; // la prima mappa che si apre basta: www e non-www sono lo stesso sito
    }
    // solo indirizzi del suo host (o sottodomini): una mappa che punta altrove non allarga il perimetro
    const propri = trovati.filter((u) => {
      try { const uh = new URL(u).hostname; return uh === h || uh.endsWith(`.${h}`); } catch { return false; }
    });
    fonti.push({ host: h, mappe, indirizzi: propri.length, esito: !letta ? "assente" : propri.length === 0 ? "vuota" : "letta" });
    tutti.push(...propri);
  }
  return { candidati: ordinaPerAttinenza([...new Set(tutti)], domande).slice(0, tetto), fonti };
}
