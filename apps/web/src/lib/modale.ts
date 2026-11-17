/**
 * apps/web/src/lib/modale.ts — le finestre modali scorrono e si ridimensionano.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N5). Enzo, 15/11/2026: una modale
 * deve adattarsi alla lunghezza del contenuto: oltre a scorrere, si deve poter ridimensionare.
 * Una sola classe per tutte le `DialogContent` di apps/web: larghezza iniziale per tipo, mai oltre
 * lo schermo, scorrimento quando il contenuto supera l'altezza, maniglia di ridimensionamento
 * nell'angolo in basso a destra (CSS `resize`, che chiede `overflow` diverso da visible).
 * `DialogContent` unisce le classi con tailwind-merge: le classi qui sostituiscono quelle di base.
 *
 * Ancoraggio (prova dal vivo del 15/11): `DialogContent` è centrata con translate(-50%, -50%), e una
 * finestra centrata cresce da due lati, quindi l'angolo trascinato si allargava di circa metà del
 * movimento e restava indietro rispetto al mouse (+105 px per 200 px trascinati). Qui la finestra
 * parte nella stessa posizione centrata, ma è fissata per l'angolo in alto a sinistra: crescendo,
 * l'angolo in basso a destra resta sotto il cursore.
 */
// `transition-none`: con la durata di 200 ms della base, larghezza e altezza inseguivano il mouse in
// ritardo durante il trascinamento. L'animazione di apertura è un'animazione, non una transizione: resta.
const BASE = "max-h-[92vh] max-w-[96vw] min-h-[8rem] min-w-[18rem] overflow-auto resize top-[4vh] translate-y-0 translate-x-0 transition-none";

export const MODALE = {
  /** Conferme e moduli brevi. */
  piccola: `${BASE} w-[min(32rem,96vw)] left-[max(2vw,calc(50vw-16rem))]`,
  /** Schede e cronologie. */
  media: `${BASE} w-[min(42rem,96vw)] left-[max(2vw,calc(50vw-21rem))]`,
  /** Schede con un organigramma dentro. */
  grande: `${BASE} w-[min(64rem,96vw)] left-[max(2vw,calc(50vw-32rem))]`,
} as const;
