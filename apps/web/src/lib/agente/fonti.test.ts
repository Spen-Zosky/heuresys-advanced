import { describe, it, expect } from "vitest";
import { leggiFonti, percorsoAmmesso } from "./fonti";

describe("percorsoAmmesso", () => {
  it("accetta le pagine note, anche con segmento dinamico, query e ancora", () => {
    expect(percorsoAmmesso("/me/team")).toBe(true);
    expect(percorsoAmmesso("/approvals/8a1c0000-0000-4000-8000-000000000000")).toBe(true);
    expect(percorsoAmmesso("/analytics/kpi?periodo=2026")).toBe(true);
  });
  it("rifiuta indirizzi esterni, protocolli, doppie barre e pagine inventate", () => {
    for (const p of ["https://evil.example/me", "//evil.example", "javascript:alert(1)", "/pagina-che-non-esiste", "me/team", "/me/../x\\y", 5, null])
      expect(percorsoAmmesso(p)).toBe(false);
  });
});

describe("leggiFonti", () => {
  it("legge le tre famiglie e scarta le voci rotte", () => {
    const f = leggiFonti(
      JSON.stringify([
        { tipo: "dato", titolo: "Persone attive", dettaglio: "158 righe", percorso: "/me/team" },
        { tipo: "regola", titolo: "Perimetro", dettaglio: "Vedi solo la tua catena", percorso: "/me/team" },
        { tipo: "pagina", titolo: "Squadra", percorso: "/me/team" },
        { tipo: "pagina", titolo: "Senza indirizzo valido", percorso: "https://x.y" },
        { tipo: "altro", titolo: "x" },
        { tipo: "dato", titolo: "  " },
        "stringa",
      ]),
    );
    expect(f?.map((x) => x.tipo)).toEqual(["dato", "regola", "pagina"]);
    expect(f?.[1]?.percorso).toBeNull(); // una regola non porta indirizzi
    expect(f?.[2]?.dettaglio).toBeNull();
  });
  it("un dato con percorso sconosciuto resta, ma senza link", () => {
    const f = leggiFonti(JSON.stringify([{ tipo: "dato", titolo: "T", percorso: "/inventata" }]));
    expect(f).toEqual([{ tipo: "dato", titolo: "T", dettaglio: null, percorso: null }]);
  });
  it("al massimo sei voci; JSON rotto o non array = null", () => {
    const molte = Array.from({ length: 9 }, (_, i) => ({ tipo: "regola", titolo: "R" + i }));
    expect(leggiFonti(JSON.stringify(molte))).toHaveLength(6);
    expect(leggiFonti("[{")).toBeNull();
    expect(leggiFonti('{"a":1}')).toBeNull();
  });
});
