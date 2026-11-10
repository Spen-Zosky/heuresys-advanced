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

export function costruisci(fmt: Formati, enumi: Map<string, string>, rubrica: RubricaResponse | undefined, italiano: boolean): Leggi {
  const perId = new Map<string, string>();
  const perEmail = new Map<string, string>();
  for (const p of rubrica?.persone ?? []) {
    perId.set(p.id, p.etichetta);
    if (p.email) perEmail.set(p.email.toLowerCase(), p.etichetta);
  }
  for (const p of rubrica?.posizioni ?? []) perId.set(p.id, p.titolare ? `${p.titolo} (${p.titolare})` : p.titolo);
  for (const u of rubrica?.unita ?? []) perId.set(u.id, u.nome);

  const voce = (k: string): string | undefined => {
    const e = enumi.get(k) ?? enumi.get(k.toUpperCase());
    if (e) return e;
    return italiano ? FRASI_IT[chiaveFrase(k)] : undefined;
  };

  const testo = (s: string): string => {
    const t = s.trim();
    if (!t) return s;
    if (NUMERO.test(t)) {
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
    if (!t.includes("@") && !/[0-9a-f]{8}-/i.test(t)) return s;
    return s
      .replace(EMAIL, (m) => perEmail.get(m.toLowerCase()) ?? m)
      .replace(UUID, (m) => perId.get(m.toLowerCase()) ?? perId.get(m) ?? m);
  };

  const nodo = (n: ReactNode): ReactNode => {
    if (typeof n === "string") return testo(n);
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

