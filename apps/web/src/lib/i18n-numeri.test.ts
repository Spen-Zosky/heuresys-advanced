import { describe, it, expect } from "vitest";
import { i18n as i18next, numeroNellaFrase, testoLeggibile } from "./i18n";

describe("numeri nelle frasi tradotte (C4)", () => {
  it("un numero interpolato prende i separatori italiani", () => {
    expect(numeroNellaFrase(14031, "it", "count")).toBe("14.031");
    expect(numeroNellaFrase(0.5, "it", "value")).toBe("0,5");
    expect(numeroNellaFrase(3, "it", "version")).toBe(3);
    expect(numeroNellaFrase("1652", "it", "count")).toBe("1652");
  });
  it("vale dentro t()", () => {
    const t = i18next.getFixedT("it", "hr");
    expect(t("orgHealth.sample", { count: 1652 })).toBe("campione di 1.652");
  });
});

describe("codici nelle frasi tradotte (C1)", () => {
  it("un codice interpolato prende la sua etichetta", () => {
    const t = i18next.getFixedT("it", "ess");
    const r = t("landing.rolesLabel", { roles: "BRANCH_MANAGER, TEAM_LEADER" });
    expect(r).not.toMatch(/BRANCH_MANAGER|TEAM_LEADER/);
    expect(numeroNellaFrase("ABC_XYZ", "it", "cosa")).toBe("Abc xyz");
    expect(numeroNellaFrase("Filiale Monza", "it", "name")).toBe("Filiale Monza");
    expect(numeroNellaFrase("POS_001", "it", "code")).toBe("POS_001");
  });
});

describe("perimetro nelle frasi (C1)", () => {
  it("«Ambito {{kind}}» si legge", () => {
    expect(numeroNellaFrase("TENANT", "it", "kind")).toBe("intera azienda");
  });
});

describe("testi composti dal servizio (C1)", () => {
  it("i codici dentro un testo prendono la loro etichetta, il resto resta", () => {
    const r = testoLeggibile("ACTIVE · settore Banche · dimensione media", "it");
    expect(r).not.toMatch(/ACTIVE/);
    expect(r).toContain("settore Banche · dimensione media");
    expect(testoLeggibile("Filiale Monza", "it")).toBe("Filiale Monza");
  });
});

describe("codici minuscoli conosciuti (C1)", () => {
  it("un motivo di variazione retributiva si scrive in parole, un codice ignoto resta", () => {
    expect(testoLeggibile("salary_recalculation: ricalcolo", "it")).toBe("Ricalcolo della retribuzione: ricalcolo");
    expect(testoLeggibile("verso CCNL_CRED_2024", "it")).toBe("verso CCNL Credito 2024");
    expect(testoLeggibile("campo ignoto_qui", "it")).toBe("campo ignoto_qui");
  });
});
