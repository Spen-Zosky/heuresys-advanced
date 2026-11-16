/**
 * apps/api/test/unit/distanza.unit.test.ts — il riconoscimento della misura della distanza (ADR-0059 D7).
 *
 * Senza database: la somiglianza è quella del confronto dell'11/11 (`costruisci.py`), l'abbinamento è
 * uno a uno con i nomi uguali per primi, l'ambito separa le voci, il livello CCNL si normalizza nella
 * forma di RTL.
 */
import { describe, expect, it } from "vitest";
import { abbina, livelloNormale, normalizza, somiglianza } from "../../src/modules/tenant-consolidation/distanza.js";

describe("misura della distanza: riconoscimento", () => {
  it("normalizza minuscole, accenti e punteggiatura", () => {
    expect(normalizza("  Unità  Crediti, PMI ")).toBe("unita crediti pmi");
    expect(normalizza(null)).toBe("");
  });

  it("la somiglianza vale 1 sui nomi uguali e scarta parole vuote e generiche", () => {
    expect(somiglianza("Direzione Crediti", "direzione crediti")).toBe(1);
    expect(somiglianza("Ufficio Crediti PMI", "Direzione Crediti PMI")).toBeCloseTo(2 * 2 / 6, 5);
    expect(somiglianza("Tempo medio", "Numero totale")).toBe(0);
  });

  it("abbina uno a uno, i nomi uguali prima dei simili, dentro lo stesso ambito", () => {
    const m = [{ etichetta: "Direzione Crediti" }, { etichetta: "Ufficio Crediti PMI" }, { etichetta: "Cassa", ambito: "x" }];
    const t = [{ etichetta: "Direzione Crediti PMI" }, { etichetta: "Direzione Crediti" }, { etichetta: "Cassa" }];
    const a = abbina(m, t);
    expect(a.coppie.map((c) => `${c.m.etichetta}=${c.t.etichetta}`)).toEqual([
      "Direzione Crediti=Direzione Crediti",
      "Ufficio Crediti PMI=Direzione Crediti PMI",
    ]);
    expect(a.soloModello.map((v) => v.etichetta)).toEqual(["Cassa"]);
    expect(a.soloTenant.map((v) => v.etichetta)).toEqual(["Cassa"]);
  });

  it("porta i livelli CCNL nella forma di RTL", () => {
    expect(livelloNormale("CCNL_CREDITO_3AREA_L3")).toBe("3A3L");
    expect(livelloNormale("CCNL_CREDITO_QD4")).toBe("QD4");
    expect(livelloNormale("CCNL_CREDITO_DIRIGENTI_DIR")).toBe("Dirigente");
    expect(livelloNormale("3A2L")).toBe("3A2L");
    expect(livelloNormale(null)).toBeNull();
  });
});
