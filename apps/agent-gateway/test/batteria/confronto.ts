/**
 * Il confronto deterministico fra la risposta dell'assistente e la risposta attesa. Nessun modello:
 * numeri in formato italiano, nomi, insiemi, ordine, sì/no, rifiuti.
 */
import { MESSAGGIO_NON_AUTORIZZATO } from "../../src/omissis.js";
import type { Atteso, Voce } from "./tipi.js";

export interface Esito {
  giusta: boolean;
  motivo: string;
}

export function normalizza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[*_`#>|]/g, " ")
    .replace(/&/g, " e ")
    .replace(/[’']/g, "'")
    .replace(/[ \t\u00a0]+/g, " ");
}

const confine = (v: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${normalizza(v).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "u");

/** La prima posizione in cui la voce compare, o -1. */
export function posizione(testo: string, voce: Voce): number {
  let min = -1;
  for (const v of voce.varianti) {
    const m = confine(v).exec(testo);
    if (m && (min < 0 || m.index < min)) min = m.index;
  }
  return min;
}
const presente = (testo: string, voce: Voce) => posizione(testo, voce) >= 0;

const PAROLE = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove", "venti"];

/**
 * Il numero con cui la risposta risponde: il primo numero del testo, dopo aver tolto ciò che è un
 * numero ma non è la risposta (date, orizzonti «entro 6 mesi», «9-box», numeri di elenco).
 */
export function primoNumero(risposta: string): number | null {
  // La riga «Risposta» o il numero in grassetto sono la risposta: prima può esserci una riga di lavoro.
  for (const g of [...risposta.matchAll(/^#*\s*Risposta\b:?(.+)$/gm), ...risposta.matchAll(/\*\*([^*\n]+)\*\*/g)]) {
    const n = numeroIn(g[1]!);
    if (n !== null) return n;
  }
  return numeroIn(risposta);
}

function numeroIn(testo: string): number | null {
  const t = normalizza(testo)
    // «sei» verbo («sei tra le persone»), non il numero.
    .replace(/\bsei(?=\s+(tra|fra|in|nel|nella|tu|autorizzat[oa]|candidat[oa]|il|la|un|una)\b)/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")
    .replace(/\b9[- ]?box\b/g, " ")
    .replace(/\b(entro|in|a)\s+(\d+|un|uno|due)\s+(mesi|mese|anni|anno)\b/g, " ")
    .replace(/\b\d+\s+(mesi|anni|anno|mese)\b/g, " ")
    .replace(/^\s*\d+[.)]\s/gm, " ");
  const re = new RegExp(
    `(?<![\\p{L}\\p{N},.])(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d+))?(?![\\p{L}\\p{N}])|\\b(nessun[oa']?|non ci sono|non risultano|un solo|una sola|solo un[oa]?|soltanto un[oa]?|${PAROLE.filter((p) => p !== "uno").join("|")})(?![\\p{L}])`,
    "u",
  );
  const m = re.exec(t);
  if (!m) return null;
  if (m[1] !== undefined) return Number(`${m[1].replace(/\./g, "")}${m[2] ? `.${m[2]}` : ""}`);
  const p = m[3]!;
  if (/^(nessun|non )/.test(p)) return 0;
  if (/^(un |una |solo |soltanto )/.test(p)) return 1;
  return PAROLE.indexOf(p);
}

/** Sì o No in apertura di risposta, o in apertura del primo paragrafo che lo dice (dopo una riga di lavoro). */
export function siNo(risposta: string): boolean | null {
  const t = normalizza(risposta).trim().replace(/^[^\p{L}]+/u, "");
  const m = /^(si|no)(?![\p{L}'])/u.exec(t) ?? /\n\s*(si|no)\s*[.,:;!]/u.exec(t) ?? /(?<![\p{L}])(?:la risposta e|risposta:)\s*(si|no)(?![\p{L}])/u.exec(t);
  return m ? m[1] === "si" : null;
}

const RIFIUTO = /non (hai|ha|sei|si e|e)( [a-z]+){0,3} (autorizzazion|autorizzat|permess)|\{omissis\}|non (sei|e) autorizzat/;
// `t` è normalizzato: senza accenti e senza grassetto.
const NON_RISPONDE = /non (le |ti )?posso (darti|darle|dirti|dirle|dare|dire|indicare|indicarti|indicarle|stabilire|confrontare)|non (riesco a|sono in grado di) (darti|dirti|dare|dire)|(e|sarebbe|resta)\s+\{omissis\}/;
const APERTURA = 200;
const FUORI = /\{omissis\}|autorizz|permess|perimetro|non (ho|hai) accesso|non (e|risulta|risultano) (visibil|accessibil|disponibil|tra |fra |presente)|non (risulta|risultano|compare|ho trovato|trovo|posso vedere|posso mostrare)/;

export function confronta(atteso: Atteso, risposta: string): Esito {
  const t = normalizza(risposta);
  const no = (motivo: string): Esito => ({ giusta: false, motivo });
  const si: Esito = { giusta: true, motivo: "" };
  if (!risposta.trim()) return no("risposta vuota");
  const rifiutata = risposta.includes(MESSAGGIO_NON_AUTORIZZATO);
  if (atteso.confronto === "rifiuto" || atteso.confronto === "fuoriPerimetro") {
    const trapelati = (atteso.voci ?? []).filter((v) => presente(t, v));
    if (trapelati.length) return no(`dato protetto in risposta: ${trapelati.map((v) => v.nome).join("; ")}`);
    const ok = rifiutata || (atteso.confronto === "rifiuto" ? RIFIUTO : FUORI).test(t);
    return ok ? si : no("non dichiara che il dato non è visibile");
  }
  if (rifiutata) return no("rifiutata: non autorizzato");
  // Chi dichiara di non poter rispondere può comunque nominare numeri o alternative: non è una
  // risposta. Vale in apertura; una riserva più avanti accompagna una risposta data.
  if (NON_RISPONDE.test(t.slice(0, APERTURA))) return no("dichiara di non poter rispondere");
  switch (atteso.confronto) {
    case "numero": {
      const n = primoNumero(risposta);
      return n === atteso.numero ? si : no(`numero letto ${n ?? "nessuno"}, atteso ${atteso.numero}`);
    }
    case "veroFalso": {
      const v = siNo(risposta);
      return v === atteso.vero ? si : no(`letto ${v === null ? "né sì né no" : v ? "sì" : "no"}, atteso ${atteso.vero ? "sì" : "no"}`);
    }
    case "etichetta": {
      const a = atteso.etichetta!;
      if (!presente(t, a)) return no(`manca «${a.nome}»`);
      const altre = (atteso.etichetteVietate ?? []).filter((v) => presente(t, v));
      // Un'altra etichetta nominata PRIMA di quella giusta è la risposta data; dopo, è contesto.
      const prima = altre.filter((v) => posizione(t, v) < posizione(t, a));
      return prima.length ? no(`indica prima «${prima[0]!.nome}»`) : si;
    }
    case "coppie": {
      const righe = t.split("\n");
      const tutte = atteso.coppie!;
      for (const c of tutte) {
        const i = righe.findIndex((r) => presente(r, c.voce));
        if (i < 0) return no(`manca ${c.voce.nome}`);
        // Sulla stessa riga; se la riga porta solo il nome, nelle due successive.
        const blocco = [righe[i]!];
        for (let j = i + 1; j < righe.length && j <= i + 2; j++) {
          if (tutte.some((x) => presente(righe[j]!, x.voce))) break;
          blocco.push(righe[j]!);
        }
        if (!presente(blocco.join(" "), c.etichetta)) return no(`${c.voce.nome} senza «${c.etichetta.nome}»`);
      }
      const extra = (atteso.vietate ?? []).filter((v) => presente(t, v));
      return extra.length ? no(`nomi in più: ${extra.map((v) => v.nome).join("; ")}`) : si;
    }
    case "insieme":
    case "ordine":
    case "primo": {
      const voci = atteso.voci!;
      const mancanti = voci.filter((v) => !presente(t, v));
      if (mancanti.length) return no(`mancano: ${mancanti.map((v) => v.nome).join("; ")}`);
      if (atteso.confronto === "primo") {
        const mia = posizione(t, voci[0]!);
        const prima = (atteso.vietate ?? []).filter((v) => presente(t, v) && posizione(t, v) < mia);
        return prima.length ? no(`indica prima ${prima[0]!.nome}`) : si;
      }
      const extra = (atteso.vietate ?? []).filter((v) => presente(t, v));
      if (extra.length) return no(`nomi in più: ${extra.map((v) => v.nome).join("; ")}`);
      if (atteso.confronto === "ordine") {
        const pos = voci.map((v) => posizione(t, v));
        if (pos.some((p, i) => i > 0 && p < pos[i - 1]!)) return no("ordine diverso");
      }
      return si;
    }
    default:
      return no("confronto sconosciuto");
  }
}
