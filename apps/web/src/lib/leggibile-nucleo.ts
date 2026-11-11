/**
 * apps/web/src/lib/leggibile-nucleo.ts — il nucleo puro della rete di leggibilità
 * (vedi lib/leggibile.tsx). Separato perché si prova senza renderer (vitest in ambiente node).
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { RubricaResponse } from "@heuresys/shared";
import type { Formati } from "./format";
import { codiceInParole } from "./enum-labels";
import { FRASI_IT, chiaveFrase, frasiComposte } from "./valori-leggibili";

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ISO_ISTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const NUMERO = /^-?\d+(?:\.\d+)?$/;
const CODICE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$|^[a-z]+(?:_[a-z]+)+$|^[A-Z]{3,}$/;

export interface Leggi {
  testo: (s: string) => string;
  nodo: (n: ReactNode) => ReactNode;
  persona: (idOEmail: string | null | undefined) => string | null;
}

export type TipoRiferimento = "persona" | "posizione" | "unita";
/** Rende un nome che apre la sua scheda (classe C12); senza, il nome resta testo. */
export type Riferisci = (tipo: TipoRiferimento, id: string, etichetta: string) => ReactNode;

export function costruisci(fmt: Formati, enumi: Map<string, string>, rubrica: RubricaResponse | undefined, italiano: boolean, riferisci?: Riferisci): Leggi {
  const perId = new Map<string, string>();
  const perEmail = new Map<string, string>();
  /* chiave esatta (id o email in minuscolo) → a che cosa porta */
  const bersaglio = new Map<string, { tipo: TipoRiferimento; id: string }>();
  for (const p of rubrica?.persone ?? []) {
    perId.set(p.id, p.etichetta);
    bersaglio.set(p.id, { tipo: "persona", id: p.id });
    if (p.email) {
      perEmail.set(p.email.toLowerCase(), p.etichetta);
      bersaglio.set(p.email.toLowerCase(), { tipo: "persona", id: p.id });
    }
  }
  for (const p of rubrica?.posizioni ?? []) {
    perId.set(p.id, p.titolare ? `${p.titolo} (${p.titolare})` : p.titolo);
    bersaglio.set(p.id, { tipo: "posizione", id: p.id });
  }
  for (const u of rubrica?.unita ?? []) {
    perId.set(u.id, u.nome);
    bersaglio.set(u.id, { tipo: "unita", id: u.id });
  }

  const voce = (k: string): string | undefined => {
    const e = enumi.get(k) ?? enumi.get(k.toUpperCase());
    if (e) return e;
    return italiano ? FRASI_IT[chiaveFrase(k)] : undefined;
  };

  const testo = (s: string): string => {
    const t = s.trim();
    if (!t) return s;
    if (NUMERO.test(t)) {
      // «1.234» è già un migliaio in forma italiana (l'ha scritto la pagina): rileggerlo come
      // decimale lo farebbe diventare «1,23». Un decimale grezzo con tre cifre dopo il punto e
      // parte intera diversa da zero è raro; il migliaio formattato no.
      if (/^-?[1-9]\d{0,2}\.\d{3}$/.test(t)) return s;
      // «00123» è un codice (matricola, CAP), non un numero
      if (/^0\d/.test(t)) return s;
      const n = Number(t);
      if (Number.isInteger(n) && n >= 1900 && n <= 2100) return s; // un anno resta un anno
      const decimali = t.includes(".") ? Math.min(2, t.split(".")[1]!.length) : 0;
      return fmt.numero(n, decimali);
    }
    if (ISO_DATA.test(t)) return fmt.data(t);
    if (ISO_ISTANTE.test(t) && !Number.isNaN(Date.parse(t))) return fmt.dataOra(t);
    if (CODICE.test(t)) return voce(t) ?? (italiano ? codiceInParole(t) : t);
    const frase = voce(t) ?? (italiano ? frasiComposte(t, voce) : undefined);
    if (frase) return frase;
    // Dentro una frase, una quantità con il punto decimale accanto alla sua unità («8.00 giorni»,
    // «indice 71.4», «57.1 su 100», «12.5%») si scrive all'italiana. Solo accanto a un'unità:
    // versioni, indirizzi e stringhe tecniche restano come sono.
    const conQuantita = italiano
      ? s.replace(
          /(^|[\s(])(\d+)\.(\d+)(?=\s*(?:%|giorn|or[ae]\b|anni|mes[ei]|settiman|punt|su\s+100)|\))/g,
          (_m, prima: string, intera: string, dec: string) => `${prima}${fmt.numero(Number(`${intera}.${dec}`), Math.min(2, dec.replace(/0+$/, "").length))}`,
        )
      : s;
    // Un importo accanto alla sua valuta: «4,069 EUR» (migliaia all'inglese) e «37467.00 EUR»
    // (decimale col punto) si scrivono «4.069 EUR» e «37.467 EUR».
    const conImporti = italiano
      ? conQuantita
          .replace(/(^|[\s(])(\d{1,3}(?:,\d{3})+)(\.\d+)?(?=\s*(?:EUR|€|USD|GBP|CHF)\b)/g, (_m, prima: string, intera: string, dec?: string) =>
            `${prima}${fmt.numero(Number(intera.replace(/,/g, "") + (dec ?? "")), dec ? 2 : 0)}`)
          .replace(/(^|[\s(])(\d{4,})\.(\d{1,2})(?=\s*(?:EUR|€|USD|GBP|CHF)\b)/g, (_m, prima: string, intera: string, dec: string) =>
            `${prima}${fmt.numero(Number(`${intera}.${dec}`), /^0+$/.test(dec) ? 0 : 2)}`)
      : conQuantita;
    if (!t.includes("@") && !/[0-9a-f]{8}-/i.test(t)) return conImporti;
    s = conImporti;
    return s
      .replace(EMAIL, (m) => perEmail.get(m.toLowerCase()) ?? m)
      .replace(UUID, (m) => perId.get(m.toLowerCase()) ?? perId.get(m) ?? m);
  };

  const nodo = (n: ReactNode): ReactNode => {
    if (typeof n === "string") {
      const b = riferisci ? bersaglio.get(n.trim().toLowerCase()) : undefined;
      if (b && riferisci) return riferisci(b.tipo, b.id, testo(n));
      return testo(n);
    }
    if (typeof n === "number") return Number.isFinite(n) ? testo(String(n)) : "—";
    if (Array.isArray(n)) return Children.map(n, nodo);
    if (isValidElement(n)) {
      const el = n as ReactElement<{ children?: ReactNode; "data-grezzo"?: unknown }>;
      if (el.props["data-grezzo"] !== undefined) return el;
      const figli = el.props.children;
      if (figli === undefined || typeof figli === "function") return el;
      return cloneElement(el, undefined, nodo(figli));
    }
    return n;
  };

  const persona = (k: string | null | undefined) =>
    !k ? null : perId.get(k) ?? perEmail.get(k.toLowerCase()) ?? null;

  return { testo, nodo, persona };
}

