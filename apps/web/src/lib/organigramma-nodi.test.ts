import { describe, expect, it } from "vitest";
import { disponiAlbero, COLONNA } from "./organigramma-nodi";
import type { UnitaBlocco } from "./organigramma-blocchi";

const u = (id: string, padreId: string | null, n = 1, tipo: string | null = null): UnitaBlocco => ({
  id, nome: `Unità ${id}`, padreId, filiale: false, addettiTotali: n, tipo,
  persone: Array.from({ length: n }, (_, i) => ({ etichetta: `C${i}, N`, responsabile: i === 0 })),
});

// La forma di RTL: società con il Direttore Generale, staff e direzione generale con le divisioni.
const rtl = [
  u("SOC", null, 1, "HEADQUARTERS"), u("STAFF1", "SOC", 2, "DEPARTMENT"), u("DG", "SOC", 0, "GENERAL_MANAGEMENT"),
  u("DIV1", "DG", 4, "DIVISION"), u("DIV2", "DG", 5, "DIVISION"), u("UFF1", "DIV1", 2), u("UFF2", "DIV1", 3),
];

describe("disponiAlbero (vista a nodi)", () => {
  it("ha la stessa struttura dei blocchi: Direttore Generale al vertice, prima le divisioni, poi lo staff", () => {
    const a = disponiAlbero(rtl);
    expect(a.etichetta).toBe("Unità SOC");
    const per = new Map(a.nodi.map((n) => [n.u.id, n]));
    expect(per.has("SOC")).toBe(false);
    expect(per.get("DG")!.livello).toBe(0);
    for (const id of ["DIV1", "DIV2", "STAFF1"]) expect(per.get(id)!.livello).toBe(1);
    // ordine dall'alto: divisioni prima dello staff
    expect(per.get("DIV1")!.y).toBeLessThan(per.get("DIV2")!.y);
    expect(per.get("DIV2")!.y).toBeLessThan(per.get("STAFF1")!.y);
  });

  it("tutti i rami aperti: un collegamento per ogni unità sotto il vertice, nessuna riga condivisa", () => {
    const a = disponiAlbero(rtl);
    expect(a.nodi).toHaveLength(rtl.length - 1);
    const figlie = a.nodi.filter((n) => n.livello > 0).length;
    // per ogni padre: un tratto orizzontale in uscita e uno verticale; per ogni figlia un tratto in entrata
    const padri = a.nodi.filter((n) => n.figlie > 0).length;
    expect(a.linee).toHaveLength(padri * 2 + figlie);
    const foglie = a.nodi.filter((n) => n.figlie === 0);
    expect(new Set(foglie.map((n) => n.y)).size).toBe(foglie.length);
    for (const n of a.nodi) expect(n.x).toBe(a.nodi.find((m) => m.livello === 0)!.x + n.livello * COLONNA);
  });

  it("ogni unità con figlie sta fra la prima e l'ultima figlia", () => {
    const a = disponiAlbero(rtl);
    const per = new Map(a.nodi.map((n) => [n.u.id, n]));
    expect(per.get("DIV1")!.y).toBeGreaterThanOrEqual(per.get("UFF1")!.y);
    expect(per.get("DIV1")!.y).toBeLessThanOrEqual(per.get("UFF2")!.y);
  });

  it("un ramo chiuso nasconde le figlie e diventa una riga sola", () => {
    const a = disponiAlbero(rtl, new Set(["DIV1"]));
    const per = new Map(a.nodi.map((n) => [n.u.id, n]));
    expect(per.has("UFF1")).toBe(false);
    expect(per.get("DIV1")!.chiuso).toBe(true);
    expect(per.get("DIV1")!.figlie).toBe(2);
  });

  it("tutto il disegno sta dentro le sue misure", () => {
    const a = disponiAlbero(rtl);
    for (const n of a.nodi) {
      expect(n.y + n.r).toBeLessThanOrEqual(a.altezza);
      expect(n.x + n.r).toBeLessThanOrEqual(a.larghezza);
    }
  });
});
