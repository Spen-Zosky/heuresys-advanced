import { describe, expect, it } from "vitest";
import { cognomeNome, etichettaPersona } from "./person-label";

const enumLabel = (_d: string, v: string | null | undefined) => (v === "SERVICE" ? "Utenza di servizio" : String(v));

describe("R1 del repertorio interfacce: «Cognome, Nome»", () => {
  it("una persona con nome e cognome si scrive «Cognome, Nome»", () => {
    expect(cognomeNome({ displayName: "Marco Bruno", firstName: "Marco", lastName: "Bruno" })).toBe("Bruno, Marco");
  });

  it("senza cognome resta il nome com'è", () => {
    expect(cognomeNome({ displayName: "Integrazione paghe", firstName: null, lastName: null })).toBe("Integrazione paghe");
  });

  it("la casella di scelta usa lo stesso formato", () => {
    expect(etichettaPersona({ displayName: "Marco Bruno", firstName: "Marco", lastName: "Bruno" }, enumLabel)).toBe("Bruno, Marco");
  });

  it("chi non è una persona porta scritto che cosa è", () => {
    expect(etichettaPersona({ displayName: "Integrazione paghe", type: "SERVICE" }, enumLabel)).toBe(
      "Integrazione paghe (Utenza di servizio)",
    );
  });
});
