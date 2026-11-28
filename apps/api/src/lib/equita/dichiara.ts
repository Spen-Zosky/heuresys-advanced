/**
 * apps/api/src/lib/equita/dichiara.ts — dalla lista di una proposta alla sua dichiarazione di
 * equità (E12, ADR-0063, voce F6b). Una persona può comparire in più righe (una per posizione):
 * conta una volta, ed è favorevole se almeno una delle sue righe lo è. I tratti protetti si leggono
 * qui, sui valori veri, e ne esce solo l'aggregato.
 */
import type { EquitaDichiarazione } from "@heuresys/shared";
import type { DbConnector } from "./tratti.js";
import { leggiTrattiProtetti } from "./tratti.js";
import { valutaEquita } from "./valuta.js";

export async function dichiaraEquita<T extends { userId: string }>(
  q: DbConnector,
  righe: readonly T[],
  tenantId: string | null,
  favorevoleDi: (r: T) => boolean,
  esitoFavorevole: string,
  ingressi: readonly string[],
  oggi = new Date(),
): Promise<EquitaDichiarazione> {
  const favorevole = new Map<string, boolean>();
  for (const r of righe) favorevole.set(r.userId, (favorevole.get(r.userId) ?? false) || favorevoleDi(r));
  const tratti = await leggiTrattiProtetti(q, tenantId, [...favorevole.keys()]);
  return valutaEquita(
    [...favorevole.entries()].map(([userId, f]) => ({ userId, favorevole: f, tratti: tratti.get(userId) })),
    { esitoFavorevole, ingressi, oggi },
  );
}
