/**
 * apps/web/src/lib/modale.ts — le finestre modali scorrono e si ridimensionano.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N5). Enzo, 15/11/2026: una modale
 * deve adattarsi alla lunghezza del contenuto: oltre a scorrere, si deve poter ridimensionare.
 * Una sola classe per tutte le `DialogContent` di apps/web: larghezza iniziale per tipo, mai oltre
 * lo schermo, scorrimento quando il contenuto supera l'altezza, maniglia di ridimensionamento
 * nell'angolo in basso a destra (CSS `resize`, che chiede `overflow` diverso da visible).
 * `DialogContent` unisce le classi con tailwind-merge: `max-w-*` qui sostituisce il `max-w-lg` di base.
 */
const BASE = "max-h-[92vh] max-w-[96vw] min-h-[8rem] min-w-[18rem] overflow-auto resize";

export const MODALE = {
  /** Conferme e moduli brevi. */
  piccola: `${BASE} w-[min(32rem,96vw)]`,
  /** Schede e cronologie. */
  media: `${BASE} w-[min(42rem,96vw)]`,
  /** Schede con un organigramma dentro. */
  grande: `${BASE} w-[min(64rem,96vw)]`,
} as const;
