/**
 * apps/web/src/lib/enum-labels.ts — the enum label layer (census F4 S1026,
 * worklist P2 cluster 1: "layer label per gli enum di stato").
 *
 * Every status/kind/type enum the API returns is a SCREAMING_SNAKE (or
 * lowercase) machine code; rendering it raw leaks the wire format to the user
 * ("ON_TRACK", "MODERATE_GAP", "READY_NOW"...). This hook resolves a code to
 * its human label via the `common:enums.<domain>.<VALUE>` i18n map (IT/EN),
 * falling back to the code written in words when a value is unmapped (see
 * `codiceInParole` below).
 *
 * Domains mirror the Zod enums in @heuresys/shared (and, for free-string
 * fields, the DISTINCT values measured live on the DB — S1026). Add new
 * values to BOTH locale files (pnpm i18n:check enforces parity).
 */

import { useTranslation } from "react-i18next";

export type EnumLabelFn = (domain: string, value: string | null | undefined) => string;

/**
 * F-2 (piano interfacce, L6, 2026-11-04): un codice senza etichetta non si mostra piu' come
 * `MAIUSCOLO_CON_TRATTINO`, ma in parole («Mid year», «Zucchetti paghe»). E' una rete di
 * sicurezza, non il modo giusto: ogni valore deve avere la sua etichetta nei due file di
 * lingua, e questa forma serve solo a non lasciare il codice di macchina davanti a una
 * persona quando un valore nuovo arriva prima della sua traduzione.
 */
export function codiceInParole(value: string): string {
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(value)) return value;
  const parole = value.replace(/_+/g, " ").toLowerCase();
  return parole.charAt(0).toUpperCase() + parole.slice(1);
}

export function useEnumLabel(): EnumLabelFn {
  const { t } = useTranslation("common");
  return (domain, value) => {
    if (value === null || value === undefined || value === "") return "—";
    return t(`enums.${domain}.${value}`, { defaultValue: codiceInParole(value) });
  };
}
