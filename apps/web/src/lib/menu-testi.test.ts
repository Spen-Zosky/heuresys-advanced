import { describe, expect, it } from "vitest";
import { applicaOrdine, inizialeMaiuscola, spostaPrima } from "./menu-testi";

describe("inizialeMaiuscola", () => {
  it("lascia solo l'iniziale maiuscola", () => {
    expect(inizialeMaiuscola("Piano Di Carriera")).toBe("Piano di carriera");
    expect(inizialeMaiuscola("console del CRM")).toBe("Console del CRM");
    expect(inizialeMaiuscola("IL MIO ASSISTENTE")).toBe("IL MIO ASSISTENTE");
  });
  it("tiene sigle, cifre e nomi propri", () => {
    expect(inizialeMaiuscola("Dashboard KPI e OKR 2026")).toBe("Dashboard KPI e OKR 2026");
    expect(inizialeMaiuscola("Contratti CCNL")).toBe("Contratti CCNL");
    expect(inizialeMaiuscola("Mappa Heuresys")).toBe("Mappa Heuresys");
  });
});

describe("ordine dei gruppi", () => {
  const base = ["a", "b", "c", "d"];
  it("senza scelta resta quello del registro", () => {
    expect(applicaOrdine(base, null)).toEqual(base);
  });
  it("scarta i gruppi spariti e accoda i nuovi", () => {
    expect(applicaOrdine(base, ["c", "x", "a", "c"])).toEqual(["c", "a", "b", "d"]);
  });
  it("sposta prima di un gruppo o in fondo", () => {
    expect(spostaPrima(base, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(spostaPrima(base, "a", null)).toEqual(["b", "c", "d", "a"]);
    expect(spostaPrima(base, "a", "b")).toEqual(base);
  });
});
