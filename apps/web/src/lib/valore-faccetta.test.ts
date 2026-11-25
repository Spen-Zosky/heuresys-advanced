import { describe, expect, it } from "vitest";
import { nomeNellaLingua, spiegazioneNellaLingua } from "./valore-faccetta";

const v = { label: "Governo e indirizzo", labelEn: "Governance and direction", description: "Decide la rotta.", descriptionEn: "Sets the course." };

describe("valore di faccetta nella lingua della pagina (N2)", () => {
  it("in inglese dà il nome e la spiegazione inglesi", () => {
    expect(nomeNellaLingua(v, "en")).toBe("Governance and direction");
    expect(nomeNellaLingua(v, "en-GB")).toBe("Governance and direction");
    expect(spiegazioneNellaLingua(v, "en")).toBe("Sets the course.");
  });
  it("in italiano, e in ogni lingua che non conosce, dà quelli italiani", () => {
    expect(nomeNellaLingua(v, "it")).toBe("Governo e indirizzo");
    expect(nomeNellaLingua(v, undefined)).toBe("Governo e indirizzo");
    expect(spiegazioneNellaLingua(v, "fr")).toBe("Decide la rotta.");
  });
});
