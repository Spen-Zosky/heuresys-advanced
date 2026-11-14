/**
 * apps/web/src/lib/organigramma-blocchi.ts — disposizione dell'organigramma a blocchi.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V3). Porta in TypeScript
 * l'algoritmo del banco del datastore (`apps/banco/public/orgchart.mjs`, tab Organizzazione):
 *  - albero calcolato qui, senza librerie;
 *  - le figlie tutte «foglia» di un'unità si impilano in colonna sotto il padre, rientrate;
 *  - le altre si affiancano, ognuna al centro del proprio sottoalbero;
 *  - un organigramma per «sede» e uno solo per tutte le filiali, con al vertice l'unità da cui
 *    dipendono (in advanced la sede non esiste: sede centrale = le unità che non sono filiali).
 * Una differenza voluta: nel banco i riquadri hanno altezza fissa perché dicono solo «N addetti»;
 * qui portano i nomi delle persone, quindi l'altezza di ogni riquadro dipende da quante sono.
 * Pura: nessun DOM, provata da `organigramma-blocchi.test.ts`.
 */

export interface PersonaBlocco {
  etichetta: string;
  responsabile: boolean;
}
export interface UnitaBlocco {
  id: string;
  nome: string;
  padreId: string | null;
  filiale: boolean;
  persone: PersonaBlocco[];
  /** Persone dell'unità e di quelle sotto di lei. */
  addettiTotali: number;
}
export interface NodoDisposto {
  u: UnitaBlocco;
  x: number;
  y: number;
  w: number;
  h: number;
  radice: boolean;
  /** Righe del nome (al più due, l'ultima con «…» se tagliata). */
  titolo: string[];
  /** Nomi mostrati; `altri` quelli non mostrati. */
  nomi: PersonaBlocco[];
  altri: number;
}
export interface Disposizione {
  larghezza: number;
  altezza: number;
  nodi: NodoDisposto[];
  /** Comandi di percorso SVG («M x y V y H x»), uno per tratto. */
  linee: string[];
}

export const NW = 200;
const GX = 16, GY = 36, SP = 8, IND = 22, MARGINE = 8;
const RIGA_TITOLO = 14, RIGA_NOME = 13, TESTA = 8, PIEDE = 18;
export const MAX_NOMI = 12;
export const MAX_COLONNA = 5;

export function righe(testo: string, max = 28, n = 2): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of String(testo ?? "").split(/\s+/)) {
    if (!w) continue;
    if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > n) { out.length = n; out[n - 1] = out[n - 1]!.slice(0, max - 1) + "…"; }
  return out.length ? out : ["—"];
}

/** Taglia un nome lungo al bordo del riquadro. */
export function taglia(testo: string, max = 32): string {
  return testo.length > max ? testo.slice(0, max - 1) + "…" : testo;
}

export function disponi(unita: UnitaBlocco[], opzioni: { conPersone: boolean }): Disposizione {
  const perId = new Map(unita.map((u) => [u.id, u]));
  const figli = new Map<string, UnitaBlocco[]>();
  for (const u of unita) {
    const k = u.padreId && perId.has(u.padreId) && u.padreId !== u.id ? u.padreId : "";
    if (!figli.has(k)) figli.set(k, []);
    figli.get(k)!.push(u);
  }
  // Un ciclo nei padri lascerebbe unità irraggiungibili dalle radici: diventano radici a sé.
  const raggiunte = new Set<string>();
  const segna = (id: string) => { if (raggiunte.has(id)) return; raggiunte.add(id); for (const f of figli.get(id) ?? []) segna(f.id); };
  for (const r of figli.get("") ?? []) segna(r.id);
  const radici = [...(figli.get("") ?? [])];
  for (const u of unita) if (!raggiunte.has(u.id)) { radici.push(u); segna(u.id); }
  const figliDi = (id: string) => (figli.get(id) ?? []).filter((f) => !radici.includes(f));

  const forma = new Map<string, { titolo: string[]; nomi: PersonaBlocco[]; altri: number; h: number }>();
  const formaDi = (u: UnitaBlocco) => {
    let f = forma.get(u.id);
    if (f) return f;
    const titolo = righe(u.nome);
    const nomi = opzioni.conPersone ? u.persone.slice(0, MAX_NOMI) : [];
    const altri = opzioni.conPersone ? Math.max(0, u.persone.length - nomi.length) : 0;
    const h = TESTA + titolo.length * RIGA_TITOLO + (nomi.length ? 6 + nomi.length * RIGA_NOME : 0) + (altri ? RIGA_NOME : 0) + PIEDE;
    f = { titolo, nomi, altri, h };
    forma.set(u.id, f);
    return f;
  };

  const misura = new Map<string, { w: number; colonna: boolean }>();
  const mis = (u: UnitaBlocco): { w: number; colonna: boolean } => {
    const m0 = misura.get(u.id);
    if (m0) return m0;
    const f = figliDi(u.id);
    let m: { w: number; colonna: boolean };
    if (!f.length) m = { w: NW, colonna: false };
    // Differenza dal banco: oltre MAX_COLONNA figlie foglia (le dieci filiali di RTL, senza uffici
    // sotto) la colonna diventa una torre illeggibile; allora si affiancano come le altre.
    else if (f.length <= MAX_COLONNA && f.every((k) => !figliDi(k.id).length)) m = { w: NW + IND, colonna: true };
    else m = { w: Math.max(NW, f.map((k) => mis(k).w).reduce((a, b) => a + b, 0) + GX * (f.length - 1)), colonna: false };
    misura.set(u.id, m);
    return m;
  };

  const pos = new Map<string, NodoDisposto & { colonna?: boolean }>();
  const metti = (u: UnitaBlocco, x: number, y: number, radice: boolean, colonna = false) => {
    const f = formaDi(u);
    pos.set(u.id, { u, x, y, w: NW, h: f.h, radice, titolo: f.titolo, nomi: f.nomi, altri: f.altri, colonna });
  };
  const piazza = (u: UnitaBlocco, x: number, y: number, radice: boolean): number => {
    const m = mis(u), f = figliDi(u.id);
    const cx = x + (m.colonna ? 0 : (m.w - NW) / 2);
    metti(u, cx, y, radice);
    const hu = formaDi(u).h;
    if (!f.length) return hu;
    if (m.colonna) {
      let yy = y + hu + SP;
      for (const k of f) { metti(k, cx + IND, yy, false, true); yy += formaDi(k).h + SP; }
      return yy - y - SP;
    }
    let xx = x, h = hu;
    for (const k of f) { h = Math.max(h, hu + GY + piazza(k, xx, y + hu + GY, false)); xx += mis(k).w + GX; }
    return h;
  };

  let X = MARGINE, H = 0;
  for (const r of radici) { H = Math.max(H, piazza(r, X, MARGINE, true)); X += mis(r).w + GX * 2; }

  const linee: string[] = [];
  for (const [id, p] of pos) {
    const f = figliDi(id).map((k) => pos.get(k.id)!).filter(Boolean);
    if (!f.length) continue;
    const py = p.y + p.h;
    if (f[0]!.colonna) {
      const vx = p.x + 12;
      const ultimo = f[f.length - 1]!;
      linee.push(`M${vx} ${py}V${ultimo.y + 18}`);
      for (const c of f) linee.push(`M${vx} ${c.y + 18}H${c.x}`);
    } else {
      const ym = py + GY / 2;
      linee.push(`M${p.x + NW / 2} ${py}V${ym}`);
      const xs = f.map((c) => c.x + NW / 2);
      linee.push(`M${Math.min(...xs)} ${ym}H${Math.max(...xs)}`);
      for (const c of f) linee.push(`M${c.x + NW / 2} ${ym}V${c.y}`);
    }
  }
  return {
    larghezza: Math.max(X - GX * 2, NW) + MARGINE * 2,
    altezza: H + MARGINE * 2,
    nodi: [...pos.values()].map((n) => ({ u: n.u, x: n.x, y: n.y, w: n.w, h: n.h, radice: n.radice, titolo: n.titolo, nomi: n.nomi, altri: n.altri })),
    linee,
  };
}

export interface Gruppo {
  chiave: "centrale" | "filiali";
  unita: UnitaBlocco[];
  /** Per le filiali: il vertice da cui dipendono (copia, senza padre). */
  vertice: UnitaBlocco | null;
  addetti: number;
  sedi: number;
}

/**
 * Come `organigrammiPerSede` + `gruppoFiliali` del banco: la sede centrale (tutte le unità che
 * non sono filiali né stanno sotto una filiale) e un solo organigramma per tutte le filiali, con al
 * vertice l'unità da cui dipendono se è una sola, altrimenti un vertice «Filiali».
 */
export function gruppi(unita: UnitaBlocco[], nomeVerticeFiliali: string): Gruppo[] {
  const perId = new Map(unita.map((u) => [u.id, u]));
  const figli = new Map<string, UnitaBlocco[]>();
  for (const u of unita) if (u.padreId && perId.has(u.padreId)) {
    if (!figli.has(u.padreId)) figli.set(u.padreId, []);
    figli.get(u.padreId)!.push(u);
  }
  const radiciFiliali = unita.filter((u) => u.filiale && !(u.padreId && perId.get(u.padreId)?.filiale));
  const inFiliale = new Set<string>();
  const visita = (u: UnitaBlocco) => { if (inFiliale.has(u.id)) return; inFiliale.add(u.id); (figli.get(u.id) ?? []).forEach(visita); };
  radiciFiliali.forEach(visita);

  const centrale = unita.filter((u) => !inFiliale.has(u.id));
  const out: Gruppo[] = [];
  if (centrale.length) {
    out.push({
      chiave: "centrale", unita: centrale, vertice: null, sedi: 1,
      addetti: centrale.reduce((s, u) => s + u.persone.length, 0),
    });
  }
  if (radiciFiliali.length) {
    const padri = [...new Set(radiciFiliali.map((u) => u.padreId).filter((p): p is string => !!p && perId.has(p)))];
    const vertice: UnitaBlocco = padri.length === 1
      ? { ...perId.get(padri[0]!)!, padreId: null }
      : { id: "__filiali", nome: nomeVerticeFiliali, padreId: null, filiale: false, persone: [], addettiTotali: 0 };
    const sotto = unita.filter((u) => inFiliale.has(u.id)).map((u) => (radiciFiliali.includes(u) ? { ...u, padreId: vertice.id } : u));
    out.push({
      chiave: "filiali", unita: [vertice, ...sotto], vertice, sedi: radiciFiliali.length,
      addetti: sotto.reduce((s, u) => s + u.persone.length, 0),
    });
  }
  return out;
}

/**
 * Le unità attive della rubrica come blocchi (scheda a cascata): le persone per l'unità della
 * loro posizione principale, il responsabile per primo, gli addetti totali sommati verso l'alto.
 */
export function daRubrica(r: {
  persone: Array<{ id: string; etichetta: string; unitaId: string | null; attiva: boolean }>;
  unita: Array<{ id: string; nome: string; tipo: string | null; padreId: string | null; responsabileId: string | null; attiva: boolean }>;
} | undefined): UnitaBlocco[] {
  if (!r) return [];
  const attive = r.unita.filter((u) => u.attiva);
  const ids = new Set(attive.map((u) => u.id));
  const perUnita = new Map<string, Array<{ id: string; etichetta: string }>>();
  for (const p of r.persone) if (p.attiva && p.unitaId && ids.has(p.unitaId)) {
    if (!perUnita.has(p.unitaId)) perUnita.set(p.unitaId, []);
    perUnita.get(p.unitaId)!.push(p);
  }
  const figli = new Map<string, string[]>();
  for (const u of attive) if (u.padreId && ids.has(u.padreId)) {
    if (!figli.has(u.padreId)) figli.set(u.padreId, []);
    figli.get(u.padreId)!.push(u.id);
  }
  const totali = new Map<string, number>();
  const tot = (id: string, cammino: Set<string>): number => {
    if (totali.has(id)) return totali.get(id)!;
    if (cammino.has(id)) return 0;
    cammino.add(id);
    const t = (perUnita.get(id)?.length ?? 0) + (figli.get(id) ?? []).reduce((s, f) => s + tot(f, cammino), 0);
    cammino.delete(id);
    totali.set(id, t);
    return t;
  };
  return attive.map((u) => {
    const pers = (perUnita.get(u.id) ?? []).map((p) => ({ etichetta: p.etichetta, responsabile: p.id === u.responsabileId }));
    pers.sort((a, b) => Number(b.responsabile) - Number(a.responsabile));
    return {
      id: u.id, nome: u.nome, padreId: u.padreId && ids.has(u.padreId) ? u.padreId : null,
      filiale: u.tipo === "BRANCH", persone: pers, addettiTotali: tot(u.id, new Set()),
    };
  });
}

/** L'unità e tutte quelle sotto di lei, con l'unità come radice (scheda «Struttura sotto di sé»). */
export function sottoalbero(unita: UnitaBlocco[], id: string): UnitaBlocco[] {
  const figli = new Map<string, UnitaBlocco[]>();
  for (const u of unita) if (u.padreId) {
    if (!figli.has(u.padreId)) figli.set(u.padreId, []);
    figli.get(u.padreId)!.push(u);
  }
  const radice = unita.find((u) => u.id === id);
  if (!radice) return [];
  const out: UnitaBlocco[] = [];
  const visti = new Set<string>();
  const visita = (u: UnitaBlocco) => {
    if (visti.has(u.id)) return;
    visti.add(u.id);
    out.push(u.id === id ? { ...u, padreId: null } : u);
    (figli.get(u.id) ?? []).forEach(visita);
  };
  visita(radice);
  return out;
}
