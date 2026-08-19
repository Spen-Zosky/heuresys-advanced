/**
 * apps/api/src/modules/research/sources.ts
 *
 * LA POLITICA DELLE FONTI (#132 F4b — epica P2a §4.3, decisione E14).
 *
 * Le fonti sono un **controllo**, non una raccomandazione: una proposta le cui fonti non
 * rispettano la politica viene respinta **prima di arrivare al consulente**, dicendo quale
 * fonte e perche'. Una proposta priva di qualunque fonte e' respinta come quelle con fonti
 * vietate — e' lo stesso difetto: un'opinione presentata come un risultato.
 *
 * ⚠ IL CONFRONTO E' PER SUFFISSO DI HOST, MAI PER SOTTOSTRINGA.
 *   `bancaditalia.it` copre `dati.bancaditalia.it`
 *   `bancaditalia.it` NON copre `bancaditalia.it.attaccante.example`
 * E' lo stesso errore — confine contro sottostringa — che ha gia' colpito il canale
 * lab→canonica. Qui e' evitato per costruzione: nessun `includes`, nessuna espressione
 * regolare costruita da un dato altrui, nessun carattere jolly. Solo un confronto di
 * uguaglianza e un `endsWith` su `"." + suffisso`.
 *
 * GEMELLO SQL: `sys.research_url_host(text)` e la vista
 * `sys.v_research_evidence_source_not_approved` (mig. `000333`) applicano la stessa regola
 * dentro il database. I due si provano sugli stessi casi limite, e la parita' e' verificata
 * da un test di integrazione: se divergessero, il codice ammetterebbe cio' che la sentinella
 * segnala come violazione — o peggio il contrario.
 */

/** Le quattro classi dell'epica §4.3. `USER_GENERATED` esiste per registrare un rifiuto. */
export type ClasseFonte = "INSTITUTIONAL" | "ACCREDITED" | "TOP_CONSULTING" | "USER_GENERATED";
export type StatoFonte = "PROPOSED" | "APPROVED" | "REJECTED" | "RETIRED";

export interface FonteRegistrata {
  hostSuffix: string;
  label: string;
  classe: ClasseFonte;
  stato: StatoFonte;
  /** Il dominio ricercabile per cui vale; `null` = vale per tutti. */
  dominio: string | null;
}

/** Le classi che la politica ammette. `USER_GENERATED` non c'e', ed e' il punto. */
export const CLASSI_AMMESSE: ReadonlySet<ClasseFonte> = new Set<ClasseFonte>([
  "INSTITUTIONAL",
  "ACCREDITED",
  "TOP_CONSULTING",
]);

/**
 * L'host di un indirizzo, normalizzato: minuscolo, senza credenziali, senza porta, senza
 * il punto finale della radice. `null` se non e' un indirizzo o non e' `http`/`https` —
 * e `null` non e' «va bene»: chi chiama deve trattarlo come «non valutabile», che per la
 * politica delle fonti significa **respinto**.
 */
export function hostOf(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const senzaPuntoFinale = host.endsWith(".") ? host.slice(0, -1) : host;
  return senzaPuntoFinale.length > 0 ? senzaPuntoFinale : null;
}

/**
 * Il suffisso copre l'host? Uguale, oppure sottodominio proprio.
 *
 * Scritto senza espressioni regolari di proposito: `suffisso` arriva da una tabella che
 * cresce nel tempo, e una regex costruita da un dato altrui e' il modo in cui questo
 * confine si buca. `endsWith("." + suffisso)` non ha caratteri speciali.
 */
export function suffissoCopre(suffisso: string, host: string): boolean {
  const s = suffisso.trim().toLowerCase();
  const h = host.trim().toLowerCase();
  if (s.length === 0 || h.length === 0) return false;
  return h === s || h.endsWith(`.${s}`);
}

export type EsitoFonte =
  | { ammessa: true; fonte: FonteRegistrata; host: string }
  | { ammessa: false; motivo: string; host: string | null };

/**
 * Un indirizzo e' ammesso per questo dominio di ricerca?
 *
 * Le quattro ragioni di rifiuto sono distinte di proposito: chi legge un rifiuto deve
 * sapere se la fonte e' sconosciuta (la si puo' proporre), respinta (decisione presa),
 * non ancora approvata (manca un umano), o di una classe che la politica non ammette.
 * Un unico «fonte non ammessa» renderebbe indistinguibili un lavoro da fare e una
 * decisione gia' presa.
 */
export function fonteAmmessa(
  url: string,
  registro: readonly FonteRegistrata[],
  dominio: string,
): EsitoFonte {
  const host = hostOf(url);
  if (host === null) {
    return { ammessa: false, motivo: `Non e' un indirizzo web http/https: ${url}`, host: null };
  }

  const candidate = registro.filter(
    (f) => (f.dominio === null || f.dominio === dominio) && suffissoCopre(f.hostSuffix, host),
  );
  if (candidate.length === 0) {
    return { ammessa: false, motivo: `Fonte sconosciuta al registro: ${host}`, host };
  }

  // Il suffisso piu' lungo vince: una regola su `dati.istat.it` e' piu' specifica di una
  // su `istat.it`, e chi l'ha scritta intendeva proprio quella.
  const scelte = [...candidate].sort((a, b) => b.hostSuffix.length - a.hostSuffix.length);
  const f = scelte[0]!;

  if (f.stato === "REJECTED") {
    return { ammessa: false, motivo: `Fonte respinta dal registro: ${f.hostSuffix} (${f.label})`, host };
  }
  if (f.stato !== "APPROVED") {
    return {
      ammessa: false,
      motivo: `Fonte non ancora approvata da un umano: ${f.hostSuffix} — stato ${f.stato}`,
      host,
    };
  }
  if (!CLASSI_AMMESSE.has(f.classe)) {
    return {
      ammessa: false,
      motivo: `Classe di fonte non ammessa: ${f.hostSuffix} e' ${f.classe}`,
      host,
    };
  }
  return { ammessa: true, fonte: f, host };
}
