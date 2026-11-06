/**
 * In quante parti si divide, per ogni persona, il controllo di accessibilità su TUTTE le pagine di
 * prodotto (F-6, lotto L7). Lo leggono sia `a11y.spec.ts`, che dà a ogni parte il suo titolo, sia
 * `playwright.prod.config.ts`, che fa di ogni parte una fase con il suo re-login.
 *
 * Il vincolo è la sessione di 15 minuti: una parte deve finire prima che scada. Il numero è per
 * persona perché le durate sono diverse, misurate sul banco il 2026-11-04 con un solo login per
 * persona: tenantAdmin 13,6 min, platformAdmin 26,9 min (cinque pagine rosse per sessione
 * scaduta), employee 6,3 min (metà pagine fuori profilo, saltate subito).
 *
 * Il vincolo opposto è il tetto dei login (10 ogni 5 minuti per indirizzo, 6 per re-login): una
 * parte non deve durare meno di 5 minuti, o il re-login che segue prende un 429. Per questo non si
 * spezza tutto in parti piccole: con queste divisioni ogni parte sta fra i 6 e i 9 minuti.
 */
export const PARTI_A11Y_TUTTE = {
  tenantAdmin: 2,
  platformAdmin: 3,
  employee: 1,
} as const;

export type PersonaA11yTutte = keyof typeof PARTI_A11Y_TUTTE;

/** Il titolo del blocco: la config lo usa per scegliere i casi di ogni fase. */
export const titoloParte = (persona: PersonaA11yTutte, parte: number) =>
  `a11y di tutte le pagine di prodotto come ${persona}, parte ${parte} di ${PARTI_A11Y_TUTTE[persona]}`;

/** Divide l'elenco in `n` pezzi contigui il più possibile uguali. */
export function dividi<T>(voci: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(voci.slice(Math.floor((i * voci.length) / n), Math.floor(((i + 1) * voci.length) / n)));
  }
  return out;
}
