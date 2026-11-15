/**
 * apps/web/src/lib/organigramma-nodi.ts — disposizione della vista a nodi.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N4). Enzo, 15/11/2026: la vista a
 * nodi mostrava un solo collegamento aperto e una struttura diversa dall'organigramma (la società
 * al vertice, le direzioni di staff al primo livello, le divisioni nascoste). Ora parte dagli
 * stessi dati dei blocchi passati per `conVertice`: il Direttore Generale al vertice, sotto di lui
 * prima le divisioni e poi le direzioni di staff, tutti i rami aperti.
 *
 * Un albero da sinistra a destra: un livello per colonna, una riga per foglia, ogni unità con figlie
 * all'altezza media delle sue figlie; nessun tratto si incrocia. Pura, provata da
 * `organigramma-nodi.test.ts`.
 */
import { conVertice, type UnitaBlocco } from "./organigramma-blocchi";

export interface NodoAlbero {
  u: UnitaBlocco;
  x: number;
  y: number;
  r: number;
  livello: number;
  figlie: number;
  chiuso: boolean;
  /** Nome con il numero delle persone, tagliato se lungo. */
  testo: string;
}
export interface Albero {
  larghezza: number;
  altezza: number;
  nodi: NodoAlbero[];
  linee: string[];
  etichetta: string | null;
  profondita: number;
}

export const COLONNA = 300;
export const RIGA = 40;
const MARGINE = 24, TESTO_MAX = 40, ETICHETTA = 32;

export function taglia(s: string, max = TESTO_MAX): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function disponiAlbero(tutte: UnitaBlocco[], chiusi: ReadonlySet<string> = new Set()): Albero {
  const { unita, etichetta } = conVertice(tutte);
  const ids = new Set(unita.map((u) => u.id));
  const figli = new Map<string, UnitaBlocco[]>();
  const radici: UnitaBlocco[] = [];
  for (const u of unita) {
    if (u.padreId && ids.has(u.padreId) && u.padreId !== u.id) {
      if (!figli.has(u.padreId)) figli.set(u.padreId, []);
      figli.get(u.padreId)!.push(u);
    } else radici.push(u);
  }
  const max = Math.max(1, ...unita.map((u) => u.addettiTotali));
  const nodi: NodoAlbero[] = [];
  const linee: string[] = [];
  const top = MARGINE + (etichetta ? ETICHETTA : 0);
  let riga = 0, profondita = 0;
  const visti = new Set<string>();

  const piazza = (u: UnitaBlocco, livello: number): NodoAlbero => {
    visti.add(u.id);
    profondita = Math.max(profondita, livello + 1);
    const f = (figli.get(u.id) ?? []).filter((k) => !visti.has(k.id));
    const chiuso = f.length > 0 && chiusi.has(u.id);
    const x = MARGINE + 120 + livello * COLONNA;
    const r = 5 + Math.round(9 * Math.sqrt(u.addettiTotali / max));
    let y: number;
    const sotto: NodoAlbero[] = [];
    if (!f.length || chiuso) y = top + 16 + riga++ * RIGA;
    else {
      for (const k of f) sotto.push(piazza(k, livello + 1));
      y = (sotto[0]!.y + sotto[sotto.length - 1]!.y) / 2;
    }
    const n: NodoAlbero = { u, x, y, r, livello, figlie: f.length, chiuso, testo: `${taglia(u.nome)} (${u.addettiTotali})` };
    nodi.push(n);
    if (sotto.length) {
      const mx = x + COLONNA / 2;
      linee.push(`M${x + r} ${y}H${mx}`);
      linee.push(`M${mx} ${Math.min(y, sotto[0]!.y)}V${Math.max(y, sotto[sotto.length - 1]!.y)}`);
      for (const c of sotto) linee.push(`M${mx} ${c.y}H${c.x - c.r}`);
    }
    return n;
  };
  for (const r of radici) piazza(r, 0);

  return {
    larghezza: MARGINE * 2 + 120 + Math.max(0, profondita - 1) * COLONNA + 280,
    altezza: top + 16 + Math.max(1, riga) * RIGA,
    nodi, linee, etichetta, profondita,
  };
}
