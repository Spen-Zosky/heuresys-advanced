/**
 * apps/api/test/unit/hierarchy-levels.unit.test.ts — #265, il principio gerarchia-livelli.
 * Ogni caso e' uno scenario detto da Enzo il 2026-10-05: un QD2 puo' guidare altri QD2, non un QD3 ne' un QD4.
 */
import { describe, it, expect } from "vitest";
import { rango, verifica, type Scala, type Unita } from "../../src/modules/hierarchy-levels/logic.js";

const SCALA: Scala = {
  ordine: [
    "CCNL_CREDITO_3AREA_L1", "CCNL_CREDITO_3AREA_L2", "CCNL_CREDITO_QD1", "CCNL_CREDITO_QD2",
    "CCNL_CREDITO_QD3", "CCNL_CREDITO_QD4", "CCNL_CREDITO_DIRIGENTI_DIR",
  ],
};
const persona = (id: string, livello: string | null) => ({ id, posto: `posto ${id}`, livello });
const unita = (id: string, padreId: string | null, responsabile: string | null, livelloResp: string | null, persone: Array<[string, string | null]>): Unita => ({
  id, nome: `unita ${id}`, padreId,
  responsabile: responsabile ? persona(responsabile, livelloResp) : null,
  persone: persone.map(([i, l]) => persona(i, l)),
});

describe("rango", () => {
  it("riconosce il vocabolario corto del tenant sul contratto caricato", () => {
    expect(rango("QD3", SCALA)).toBe(4);
    expect(rango("3A1L", SCALA)).toBe(0);
    expect(rango("Dirigente", SCALA)).toBe(6);
  });
  it("un livello generico o assente non ha posto: non si indovina", () => {
    expect(rango("Quadro", SCALA)).toBeNull();
    expect(rango(null, SCALA)).toBeNull();
    expect(rango("  ", SCALA)).toBeNull();
  });
  it("QD4 sta sopra QD3 perche' lo dice la scala, non il nome", () => {
    expect(rango("QD4", SCALA)!).toBeGreaterThan(rango("QD3", SCALA)!);
  });
});

describe("verifica", () => {
  it("un QD2 che guida altri QD2 e' ammesso", () => {
    const r = verifica([unita("u1", null, "capo", "QD2", [["a", "QD2"], ["b", "QD1"]])], SCALA);
    expect(r.avvisi).toEqual([]);
  });
  it("un QD2 che guida un QD3 produce un avviso con motivazione scritta", () => {
    const r = verifica([unita("u1", null, "capo", "QD2", [["a", "QD3"]])], SCALA);
    expect(r.avvisi).toHaveLength(1);
    expect(r.avvisi[0]!.motivazione).toContain("QD2");
    expect(r.avvisi[0]!.motivazione).toContain("QD3");
    expect(r.avvisi[0]!.sottopostoId).toBe("a");
  });
  it("vale lungo la catena: il capo di una direzione non sta sotto il responsabile di una filiale sottostante", () => {
    const r = verifica([
      unita("dir", null, "d", "QD3", []),
      unita("div", "dir", "v", "QD3", []),
      unita("fil", "div", "f", "QD4", [["x", "3A2L"]]),
    ], SCALA);
    const coppie = r.avvisi.map((a) => `${a.responsabileId}>${a.sottopostoId}`).sort();
    expect(coppie).toEqual(["d>f", "v>f"]);
  });
  it("le catene sorelle non si confrontano fra loro", () => {
    const r = verifica([
      unita("radice", null, "r", "Dirigente", []),
      unita("a", "radice", "ca", "QD1", []),
      unita("b", "radice", "cb", "QD4", []),
    ], SCALA);
    expect(r.avvisi).toEqual([]);
  });
  it("chi ha un livello fuori scala o assente non produce avvisi ma viene detto", () => {
    const r = verifica([unita("u1", null, "capo", "QD2", [["a", "Quadro"], ["b", null]])], SCALA);
    expect(r.avvisi).toEqual([]);
    expect(r.nonValutabili.map((n) => `${n.id}:${n.ragione}`).sort()).toEqual(["a:LIVELLO_FUORI_SCALA", "b:LIVELLO_ASSENTE"]);
  });
  it("un ciclo nell'albero non ferma il controllo", () => {
    const r = verifica([unita("a", "b", "ca", "QD1", []), unita("b", "a", "cb", "QD3", [])], SCALA);
    expect(r.avvisi.map((x) => x.responsabileId)).toEqual(["ca"]);
  });
  it("unita senza responsabile: nessun avviso", () => {
    expect(verifica([unita("u", null, null, null, [["a", "QD4"]])], SCALA).avvisi).toEqual([]);
  });
});
