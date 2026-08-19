/**
 * apps/api/src/modules/research/engine.ts
 *
 * IL MOTORE (#132 F4d) — cerca, legge, propone, e **decide cosa arriva al consulente**.
 *
 * Il giro completo (epica P2a §4.7):
 *   fascicolo con identita' compilata
 *     └─ si avvia una corsa (fascicolo + dominio)
 *          └─ si legge il web, e ogni lettura lascia indirizzo, data e impronta
 *               └─ N proposte, ognuna con chiave naturale, contenuto e fonti
 *                    └─ controlli: forma? fonti? doppione? testo grezzo?
 *                         ├─ no  → FAILED / WARNING, col motivo
 *                         └─ si' → PASSED, e arriva al consulente
 *
 * ⚠ LA VALUTAZIONE E' PURA, E NON E' UN VEZZO. `valutaProposte()` non tocca la rete e non
 * tocca il database: e' la parte che dice **no**, e una parte che dice no dev'essere provabile
 * su decine di casi limite in millisecondi. La corsa vera (`eseguiCorsa`) la usa; il servizio
 * ne persiste l'esito.
 *
 * ⚠ LA DIFESA DI §4.4 VIVE QUI, IN TRE PUNTI E NON IN UNO:
 *   1. **la forma** — da una pagina puo' nascere solo una proposta strutturata, validata
 *      contro lo schema dichiarato dal dominio. Una proposta malformata e' respinta, non
 *      corretta: correggerla vorrebbe dire indovinare cosa intendeva chi l'ha scritta, e chi
 *      l'ha scritta puo' essere la pagina;
 *   2. **il testo grezzo non entra** — `RAW_TEXT_LEAK` confronta i campi della proposta col
 *      testo delle pagine lette: un blocco lungo ricopiato di peso significa che la proposta
 *      sta **riportando** invece di **ricavare**, ed e' il veicolo con cui un'istruzione
 *      nascosta in una pagina arriverebbe dentro il modello del cliente;
 *   3. **niente si applica senza un umano** — questo motore non scrive mai nel modello: al
 *      massimo scrive una **proposta** in stato `PASSED`, e la decisione motivata resta
 *      l'atto di una persona (`sys_seed_approval_decisions`).
 */
import type { ContestoRicerca, DominioRicercabile, RisultatoControllo } from "./domain.js";
import type { FonteRegistrata } from "./sources.js";
import { fonteAmmessa } from "./sources.js";
import type { PaginaLetta, WebReader } from "./web-reader.js";
import { ErroreLettura } from "./web-reader.js";

/** Cio' che una sorgente di proposte consegna: un contenuto, e da dove viene. */
export interface PropostaGrezza {
  contenuto: unknown;
  /** Gli indirizzi da cui la proposta dice di venire. Vuoto = proposta senza fonti. */
  fonti: string[];
}

/**
 * Il mandato che il motore consegna a chi propone.
 *
 * ⚠ LA FIRMA E' LA DIFESA (§4.5, E15). Qui dentro non c'e' il fascicolo, non c'e' il tenant,
 * non c'e' un nome di azienda e non c'e' nessun modo di scrivere: solo le **domande** gia'
 * costruite dai parametri di categoria, il contesto di categoria, e `leggi` — che passa dal
 * lettore, quindi dalle guardie e dall'impronta. Chi propone non puo' aprire una pagina per
 * altre vie senza che si veda nel codice.
 */
export interface MandatoRicerca {
  dominio: string;
  contesto: ContestoRicerca;
  domande: string[];
  leggi(url: string): Promise<PaginaLetta>;
}

export interface ProposalSource {
  /** Chi ha proposto: finisce nei metadati della corsa, cosi' l'origine resta interrogabile. */
  chiave: string;
  proponi(mandato: MandatoRicerca): Promise<PropostaGrezza[]>;
}

export interface EvidenzaValutata {
  url: string;
  retrievedAt: string;
  sha256: string;
  byte: number;
}

export type StatoProposta = "PASSED" | "FAILED" | "WARNING";

export interface PropostaValutata {
  chiaveNaturale: string;
  /** Il contenuto **validato** se la forma reggeva; quello grezzo altrimenti. */
  contenuto: unknown;
  stato: StatoProposta;
  controlli: RisultatoControllo[];
  evidenze: EvidenzaValutata[];
}

/** Quanti caratteri consecutivi di una pagina, ricopiati, fanno di una proposta un riporto. */
export const SOGLIA_TESTO_RICOPIATO = 200;

interface IngressoValutazione {
  dominio: DominioRicercabile<unknown>;
  contesto: ContestoRicerca;
  grezze: readonly PropostaGrezza[];
  /** Le pagine lette **davvero**, per indirizzo richiesto e finale. */
  letture: ReadonlyMap<string, PaginaLetta>;
  registroFonti: readonly FonteRegistrata[];
  /** Chiavi naturali gia' proposte, in questa corsa o in una precedente. */
  chiaviGiaPresenti: ReadonlySet<string>;
}

/** Le stringhe dentro un valore, a qualunque profondita'. */
function stringheDi(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringheDi(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) stringheDi(x, out);
  return out;
}

function normalizza(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Un campo della proposta ricopia un blocco lungo di una pagina letta?
 *
 * Non e' un controllo antiplagio: e' la difesa di §4.4. Chi ricava un dato da una pagina
 * scrive poche parole proprie; chi **riporta** trascina dentro il testo altrui — e in quel
 * testo puo' esserci un'istruzione scritta apposta. La soglia e' alta di proposito: il nome
 * di un ente o il titolo di una norma coincidono per forza, e non sono un riporto.
 */
export function testoRicopiato(
  contenuto: unknown,
  pagine: readonly PaginaLetta[],
  soglia = SOGLIA_TESTO_RICOPIATO,
): { ricopiato: true; frammento: string; url: string } | { ricopiato: false } {
  const campi = stringheDi(contenuto).filter((s) => s.length >= soglia);
  if (campi.length === 0) return { ricopiato: false };
  for (const p of pagine) {
    const testo = normalizza(p.testoNonFidato);
    if (testo.length === 0) continue;
    for (const campo of campi) {
      const n = normalizza(campo);
      // Basta che un blocco lungo del campo compaia nella pagina: chi riporta di solito
      // ricopia per intero, ma tagliare la coda non deve bastare per passare.
      const blocco = n.slice(0, soglia);
      if (testo.includes(blocco)) {
        return { ricopiato: true, frammento: campo.slice(0, 120), url: p.url };
      }
    }
  }
  return { ricopiato: false };
}

/**
 * I controlli, applicati a ogni proposta. Restituisce **tutte** le proposte, anche quelle
 * respinte: una proposta scartata in silenzio e' una proposta che nessuno puo' contestare,
 * e il registro esiste proprio per poter guardare dopo cosa era stato proposto e perche' non
 * e' passato.
 */
export function valutaProposte(i: IngressoValutazione): PropostaValutata[] {
  const dominio = i.dominio;
  const viste = new Set<string>(i.chiaviGiaPresenti);
  const esiti: PropostaValutata[] = [];

  for (const g of i.grezze) {
    const controlli: RisultatoControllo[] = [];

    // ① la forma. Se non regge, ci si ferma: i controlli successivi guarderebbero un
    //    oggetto che non e' quello che dicono di guardare.
    const analisi = dominio.forma.safeParse(g.contenuto);
    if (!analisi.success) {
      const perche = analisi.error.issues
        .slice(0, 4)
        .map((x) => `${x.path.join(".") || "(radice)"}: ${x.message}`)
        .join(" · ");
      controlli.push({ regola: "SHAPE_VALID", esito: "FAILED", messaggio: `Forma non valida — ${perche}` });
      for (const r of ["SOURCES_PRESENT", "SOURCES_POLICY", "NOT_DUPLICATE", "RAW_TEXT_LEAK"]) {
        controlli.push({ regola: r, esito: "SKIPPED", messaggio: "La forma non regge: non c'e' niente da controllare." });
      }
      esiti.push({
        chiaveNaturale: `MALFORMATA#${esiti.length + 1}`,
        contenuto: g.contenuto,
        stato: "FAILED",
        controlli,
        evidenze: [],
      });
      continue;
    }
    const contenuto = analisi.data;
    controlli.push({ regola: "SHAPE_VALID", esito: "PASSED" });

    // ② le fonti: contano solo quelle **lette davvero**. Un indirizzo dichiarato e mai
    //    aperto non e' una fonte, e' una citazione — e una citazione non ha impronta.
    const pagine: PaginaLetta[] = [];
    const nonLette: string[] = [];
    for (const url of g.fonti) {
      const p = i.letture.get(url);
      if (p) pagine.push(p);
      else nonLette.push(url);
    }
    const evidenze: EvidenzaValutata[] = pagine.map((p) => ({
      url: p.url,
      retrievedAt: p.retrievedAt,
      sha256: p.sha256,
      byte: p.byte,
    }));

    if (pagine.length < dominio.minimoFonti) {
      controlli.push({
        regola: "SOURCES_PRESENT",
        esito: "FAILED",
        messaggio:
          nonLette.length > 0
            ? `Servono ${dominio.minimoFonti} fonti lette, ce ne sono ${pagine.length}. Dichiarate ma mai aperte: ${nonLette.join(", ")}`
            : `Servono ${dominio.minimoFonti} fonti lette, ce ne sono ${pagine.length}.`,
      });
    } else {
      controlli.push({ regola: "SOURCES_PRESENT", esito: "PASSED" });
    }

    // ③ la politica delle fonti (§4.3). L'eccezione del dominio pilota si dichiara qui,
    //    e si vede nel registro delle validazioni: `SKIPPED` con la ragione scritta, mai
    //    un `PASSED` che farebbe credere che il controllo sia avvenuto.
    if (!dominio.fontiConfrontateColRegistro) {
      controlli.push({
        regola: "SOURCES_POLICY",
        esito: "SKIPPED",
        messaggio: `Il dominio "${dominio.chiave}" non confronta col registro: e' il dominio che il registro lo costruisce, e il filtro della prima ondata e' l'approvazione umana.`,
      });
    } else {
      const respinte = pagine
        .map((p) => fonteAmmessa(p.url, i.registroFonti, dominio.chiave))
        .filter((e) => !e.ammessa);
      if (respinte.length > 0) {
        controlli.push({
          regola: "SOURCES_POLICY",
          esito: "FAILED",
          messaggio: respinte.map((r) => (r.ammessa ? "" : r.motivo)).join(" · "),
        });
      } else {
        controlli.push({ regola: "SOURCES_POLICY", esito: pagine.length > 0 ? "PASSED" : "SKIPPED" });
      }
    }

    // ④ il doppione: non si duplica, si segnala.
    const chiave = dominio.chiaveNaturale(contenuto as never);
    if (viste.has(chiave)) {
      controlli.push({
        regola: "NOT_DUPLICATE",
        esito: "WARNING",
        messaggio: `"${chiave}" era gia' stata proposta: non la si scrive due volte.`,
      });
    } else {
      controlli.push({ regola: "NOT_DUPLICATE", esito: "PASSED" });
      viste.add(chiave);
    }

    // ⑤ §4.4 — il testo grezzo non entra in una proposta.
    const riporto = testoRicopiato(contenuto, pagine);
    controlli.push(
      riporto.ricopiato
        ? {
            regola: "RAW_TEXT_LEAK",
            esito: "FAILED",
            messaggio: `La proposta ricopia un blocco della pagina ${riporto.url}: "${riporto.frammento}...". Da una pagina si ricava un dato, non si riporta il testo.`,
          }
        : { regola: "RAW_TEXT_LEAK", esito: "PASSED" },
    );

    // ⑥ i controlli del dominio.
    for (const c of dominio.controlli) {
      controlli.push(c(contenuto as never, i.contesto, g.fonti));
    }

    const stato: StatoProposta = controlli.some((c) => c.esito === "FAILED")
      ? "FAILED"
      : controlli.some((c) => c.esito === "WARNING")
        ? "WARNING"
        : "PASSED";

    esiti.push({ chiaveNaturale: chiave, contenuto, stato, controlli, evidenze });
  }

  return esiti;
}

export interface EsitoCorsa {
  domande: string[];
  proposte: PropostaValutata[];
  /** Ogni pagina aperta, con impronta: e' il perimetro della corsa, non le fonti di una proposta. */
  letture: PaginaLetta[];
  /** Gli indirizzi che non si sono potuti leggere, col motivo. */
  letturenegate: Array<{ url: string; codice: string; motivo: string }>;
  sorgente: string;
}

export interface OpzioniCorsa {
  /** Quante pagine al massimo si aprono in una corsa. Un tetto, non una speranza. */
  paginemassime?: number;
}

/**
 * Esegue una corsa: costruisce le domande, lascia proporre, legge cio' che serve, valuta.
 *
 * **Non scrive niente**: restituisce l'esito, e chi lo persiste e' il servizio. Cosi' questa
 * funzione si prova per intero con una sorgente finta e un lettore finto, e la parte che
 * tocca il database si prova contro il database — senza che nessuna delle due debba fingere
 * l'altra.
 */
export async function eseguiCorsa(input: {
  dominio: DominioRicercabile<unknown>;
  contesto: ContestoRicerca;
  lettore: WebReader;
  sorgente: ProposalSource;
  registroFonti: readonly FonteRegistrata[];
  chiaviGiaPresenti: ReadonlySet<string>;
  opzioni?: OpzioniCorsa;
}): Promise<EsitoCorsa> {
  const tetto = input.opzioni?.paginemassime ?? 40;
  const domande = input.dominio.domande(input.contesto);

  const letture = new Map<string, PaginaLetta>();
  const negate: Array<{ url: string; codice: string; motivo: string }> = [];

  const leggi = async (url: string): Promise<PaginaLetta> => {
    const gia = letture.get(url);
    if (gia) return gia; // la stessa pagina non si apre due volte nella stessa corsa
    if (letture.size >= tetto) {
      // ⚠ SI REGISTRA ANCHE QUESTO. Un tetto che taglia in silenzio fa sembrare «coperto»
      // cio' che non lo era: la corsa deve poter dire quali pagine non ha aperto e perche',
      // e «ho smesso di leggere» e' un perche' come gli altri.
      const e = new ErroreLettura("LETTURA_FALLITA", `Tetto di ${tetto} pagine raggiunto per questa corsa`, url);
      negate.push({ url, codice: e.codice, motivo: e.message });
      throw e;
    }
    try {
      const p = await input.lettore.leggi(url);
      letture.set(url, p);
      // Anche l'indirizzo finale, cosi' una proposta che cita la destinazione del redirect
      // trova la sua lettura invece di risultare «dichiarata e mai aperta».
      if (p.url !== url) letture.set(p.url, p);
      return p;
    } catch (e) {
      const err = e instanceof ErroreLettura ? e : null;
      negate.push({
        url,
        codice: err?.codice ?? "LETTURA_FALLITA",
        motivo: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };

  const grezze = await input.sorgente.proponi({
    dominio: input.dominio.chiave,
    contesto: input.contesto,
    domande,
    leggi,
  });

  const proposte = valutaProposte({
    dominio: input.dominio,
    contesto: input.contesto,
    grezze,
    letture,
    registroFonti: input.registroFonti,
    chiaviGiaPresenti: input.chiaviGiaPresenti,
  });

  return {
    domande,
    proposte,
    letture: [...new Set(letture.values())],
    letturenegate: negate,
    sorgente: input.sorgente.chiave,
  };
}
