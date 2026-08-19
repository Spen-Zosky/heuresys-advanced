/**
 * apps/api/src/modules/research/domains/index.ts
 *
 * IL REGISTRO DEI DOMINI RICERCABILI — l'unico posto in cui una chiave diventa un modo di
 * cercare (#132 F4b). Gemello di `resolveBuildSource()` (`#132` F2), che e' l'unico posto in
 * cui una chiave diventa un modo di **costruire**: due elenchi, due responsabilita', e in
 * nessuno dei due un `if` sparso da qualche altra parte nel codice.
 *
 * Oggi ne contiene **uno**: `research_sources`, il dominio pilota. I cinque domini di
 * contenuto — unita', posizioni, competenze, indicatori, processi — arrivano con `F5`, e
 * aggiungerli e' dichiarare un dominio, non toccare il motore. Se per farne entrare uno
 * servisse cambiare `engine.ts`, il contratto sarebbe sbagliato.
 */
import type { DominioRicercabile } from "../domain.js";
import { DominioSconosciutoError } from "../domain.js";
import { RESEARCH_SOURCES_DOMAIN } from "./research-sources.js";

const DOMINI: ReadonlyArray<DominioRicercabile<unknown>> = [
  RESEARCH_SOURCES_DOMAIN as unknown as DominioRicercabile<unknown>,
];

const PER_CHIAVE = new Map(DOMINI.map((d) => [d.chiave, d]));

/** Le chiavi dichiarate, in ordine. Serve ai messaggi d'errore e alla superficie API. */
export function chiaviDominio(): string[] {
  return [...PER_CHIAVE.keys()];
}

export function dominiDichiarati(): ReadonlyArray<DominioRicercabile<unknown>> {
  return DOMINI;
}

/**
 * Il dominio, o un errore che dice quali esistono. Mai un `undefined` che qualcuno piu' a
 * valle interpreta come «nessun controllo da applicare»: un dominio sconosciuto che passa
 * silenziosamente scriverebbe proposte che nessuna regola ha guardato.
 */
export function risolviDominio(chiave: string): DominioRicercabile<unknown> {
  const d = PER_CHIAVE.get(chiave);
  if (!d) throw new DominioSconosciutoError(chiave, chiaviDominio());
  return d;
}

export { RESEARCH_SOURCES_DOMAIN };
export type { FonteProposta } from "./research-sources.js";
