import { describe, expect, it } from "vitest";
import { areeDellaRotta } from "./quadro-aree";

/* K09 del controllo forense del 23/11/2026: l'avviso «Hai N giorni di ferie e permessi da godere»
 * compariva in cima a ogni pagina personale (Deleghe, Documenti, Manuale, Catalogo corsi). Le
 * lenti sulle assenze di chi guarda stanno nell'area «mie-assenze», che apre solo il cruscotto
 * personale e la pagina delle assenze. */
describe("aree del quadro per rotta: le assenze di chi guarda solo dove c'entrano", () => {
  it("il cruscotto personale apre le lenti personali e le assenze", () => {
    expect(areeDellaRotta("/me")).toEqual(["personale", "mie-assenze"]);
  });

  it("la pagina delle assenze personali apre le assenze", () => {
    expect(areeDellaRotta("/me/time-off")).toContain("mie-assenze");
  });

  it.each(["/me/delegations", "/me/documents", "/me/handbook", "/me/learning/catalogue", "/me/career/target", "/me/inbox", "/me/kpis"])(
    "%s non apre le assenze di chi guarda",
    (rotta) => {
      expect(areeDellaRotta(rotta)).toEqual(["personale"]);
    },
  );

  it("le pagine di governo non aprono le assenze di chi guarda", () => {
    for (const rotta of ["/dashboard", "/time-off", "/analytics/attendance", "/organization"]) {
      expect(areeDellaRotta(rotta)).not.toContain("mie-assenze");
    }
  });
});
