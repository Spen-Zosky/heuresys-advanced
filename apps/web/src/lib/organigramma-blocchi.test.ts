import { describe, it, expect } from "vitest";
import { disponi, gruppi, sottoalbero, NW, MAX_NOMI, type UnitaBlocco } from "./organigramma-blocchi";

const u = (id: string, padreId: string | null, n = 0, filiale = false): UnitaBlocco => ({
  id, nome: `Unità ${id}`, padreId, filiale, addettiTotali: n,
  persone: Array.from({ length: n }, (_, i) => ({ etichetta: `Cognome${i}, Nome`, responsabile: i === 0 })),
});

function sovrapposti(d: ReturnType<typeof disponi>): boolean {
  const n = d.nodi;
  for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) {
    const a = n[i]!, b = n[j]!;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return true;
  }
  return false;
}

describe("disponi (algoritmo del banco)", () => {
  // Radice con due rami: uno con figlie foglia (colonna), uno con un livello in più.
  const albero = [u("R", null, 3), u("A", "R", 2), u("A1", "A", 9), u("A2", "A", 1), u("B", "R", 1), u("B1", "B", 2), u("B11", "B1", 4)];

  it("ogni unità ha un riquadro, nessuno si sovrappone, ogni figlia sta sotto il padre", () => {
    const d = disponi(albero, { conPersone: true });
    expect(d.nodi).toHaveLength(albero.length);
    expect(sovrapposti(d)).toBe(false);
    const per = new Map(d.nodi.map((n) => [n.u.id, n]));
    for (const x of albero) if (x.padreId) expect(per.get(x.id)!.y).toBeGreaterThanOrEqual(per.get(x.padreId)!.y + per.get(x.padreId)!.h);
    for (const n of d.nodi) {
      expect(n.x + n.w).toBeLessThanOrEqual(d.larghezza);
      expect(n.y + n.h).toBeLessThanOrEqual(d.altezza);
    }
  });

  it("le figlie tutte foglia si impilano in colonna, rientrate sotto il padre", () => {
    const d = disponi(albero, { conPersone: true });
    const per = new Map(d.nodi.map((n) => [n.u.id, n]));
    expect(per.get("A1")!.x).toBe(per.get("A2")!.x);
    expect(per.get("A1")!.x).toBe(per.get("A")!.x + 22);
    expect(per.get("A2")!.y).toBeGreaterThan(per.get("A1")!.y + per.get("A1")!.h);
  });

  it("oltre cinque figlie foglia si affiancano invece di formare una torre", () => {
    const molte = [u("P", null), ...Array.from({ length: 10 }, (_, i) => u(`F${i}`, "P", 3, true))];
    const d = disponi(molte, { conPersone: true });
    const figlie = d.nodi.filter((n) => n.u.id !== "P");
    expect(new Set(figlie.map((n) => n.y)).size).toBe(1);
    expect(sovrapposti(d)).toBe(false);
  });

  it("con le persone il riquadro cresce con i nomi; senza, ha l'altezza minima", () => {
    const con = disponi([u("X", null, 9)], { conPersone: true }).nodi[0]!;
    const senza = disponi([u("X", null, 9)], { conPersone: false }).nodi[0]!;
    expect(con.nomi).toHaveLength(9);
    expect(con.h).toBeGreaterThan(senza.h);
    expect(senza.nomi).toHaveLength(0);
    const tanti = disponi([u("Y", null, MAX_NOMI + 3)], { conPersone: true }).nodi[0]!;
    expect(tanti.nomi).toHaveLength(MAX_NOMI);
    expect(tanti.altri).toBe(3);
  });

  it("un ciclo nei padri non perde unità e non va in loop", () => {
    const d = disponi([u("A", "B"), u("B", "A")], { conPersone: false });
    expect(d.nodi).toHaveLength(2);
    expect(d.larghezza).toBeGreaterThanOrEqual(NW);
  });
});

describe("gruppi (sede centrale e filiali, come il banco)", () => {
  it("le filiali stanno in un solo organigramma con al vertice l'unità da cui dipendono", () => {
    const g = gruppi([u("R", null, 1), u("Retail", "R", 2), u("F1", "Retail", 3, true), u("F2", "Retail", 4, true), u("F2a", "F2", 1)], "Filiali");
    expect(g.map((x) => x.chiave)).toEqual(["centrale", "filiali"]);
    expect(g[0]!.unita.map((x) => x.id).sort()).toEqual(["R", "Retail"]);
    const fil = g[1]!;
    expect(fil.vertice!.id).toBe("Retail");
    expect(fil.sedi).toBe(2);
    expect(fil.addetti).toBe(8);
    expect(fil.unita.find((x) => x.id === "F1")!.padreId).toBe("Retail");
    expect(fil.unita.find((x) => x.id === "F2a")!.padreId).toBe("F2");
  });

  it("con la sede del modello: un organigramma per sede, le unità senza sede stanno in quella del padre", () => {
    const s = (x: UnitaBlocco, sede: string | null) => ({ ...x, sede });
    const g = gruppi([
      s(u("R", null, 1), "SEDE_CENTRALE"), s(u("A", "R", 2), null),
      s(u("CO", "R", 3), "CENTRO_OPERATIVO"), s(u("CO1", "CO", 4), null),
      s(u("F1", "A", 2, true), "FILIALE_1"),
    ], "Filiali");
    expect(g.map((x) => x.chiave)).toEqual(["centrale", "sede-CENTRO_OPERATIVO", "filiali"]);
    expect(g[0]!.unita.map((x) => x.id).sort()).toEqual(["A", "R"]);
    expect(g[1]!.sede).toBe("CENTRO_OPERATIVO");
    expect(g[1]!.unita.map((x) => x.id).sort()).toEqual(["CO", "CO1"]);
    expect(g[1]!.addetti).toBe(7);
    // Senza sede su nessuna unità resta il comportamento di prima: centrale e filiali.
    expect(gruppi([u("R", null), u("F", "R", 1, true)], "Filiali").map((x) => x.chiave)).toEqual(["centrale", "filiali"]);
  });

  it("filiali con padri diversi: vertice «Filiali»", () => {
    const g = gruppi([u("R", null), u("A", "R"), u("B", "R"), u("F1", "A", 1, true), u("F2", "B", 1, true)], "Filiali");
    expect(g[1]!.vertice!.id).toBe("__filiali");
    expect(g[1]!.vertice!.nome).toBe("Filiali");
  });
});

describe("sottoalbero", () => {
  it("l'unità diventa radice e porta con sé tutto ciò che sta sotto", () => {
    const s = sottoalbero([u("R", null), u("A", "R"), u("A1", "A"), u("B", "R")], "A");
    expect(s.map((x) => x.id)).toEqual(["A", "A1"]);
    expect(s[0]!.padreId).toBeNull();
  });
});
