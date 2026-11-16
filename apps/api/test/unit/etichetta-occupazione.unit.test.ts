/**
 * Giudizio qa-web 16/11, F4008: l'etichetta di una professione preferiva SEMPRE quella italiana,
 * anche per chi guarda in inglese. La colonna si sceglie per la lingua di chi chiede.
 */
import { describe, it, expect } from "vitest";
import { etichettaOccupazioneSql, linguaDellaRichiesta } from "../../src/modules/semantic-matching/etichetta.js";

describe("etichetta della professione per lingua", () => {
  it("in italiano preferisce l'etichetta italiana del catalogo e ripiega sul testo del vettore", () => {
    const sql = etichettaOccupazioneSql("it");
    expect(sql).toContain("esco_occupation_mapping_esco_label_it");
    expect(sql).toContain("v.label_text");
  });

  it("in inglese non guarda l'etichetta italiana: il testo del vettore e' quello inglese dell'ESCO", () => {
    const sql = etichettaOccupazioneSql("en");
    expect(sql).not.toContain("_label_it");
    expect(sql.trim()).toBe("v.label_text");
  });

  it("senza lingua si resta all'italiano (comportamento di prima)", () => {
    expect(linguaDellaRichiesta(undefined)).toBe("it");
    expect(linguaDellaRichiesta("en")).toBe("en");
    expect(linguaDellaRichiesta("it")).toBe("it");
  });
});
