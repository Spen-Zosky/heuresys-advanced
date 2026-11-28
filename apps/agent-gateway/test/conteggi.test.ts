import { describe, it, expect } from "vitest";
import { contaBooleani } from "../src/conteggi.js";
import { ISTRUZIONI_ASSISTENTE } from "../src/istruzioni.js";

// Difetto del 2026-11-28: «10 posizioni critiche» su 21 righe, di cui 11 critiche e 10 non critiche.
describe("i conteggi per sottoinsieme li fa il sistema", () => {
  const righe = (critiche: number, altre: number) => ({
    items: [
      ...Array.from({ length: critiche }, (_, i) => ({ id: `c${i}`, isCritical: true, nota: "x" })),
      ...Array.from({ length: altre }, (_, i) => ({ id: `n${i}`, isCritical: false, nota: "x" })),
    ],
    total: critiche + altre,
  });

  it("conta le righe vere e false di un campo sì/no", () => {
    const c = contaBooleani(righe(11, 10));
    expect(c?.suRighe).toBe(21);
    expect(c?.perCampo["isCritical"]).toEqual({ true: 11, false: 10 });
    expect(c?.perCampo["nota"]).toBeUndefined();
  });

  it("non conta un campo che in qualche riga non è vero o falso", () => {
    const d = { items: [{ a: true }, { a: null }, { a: false }] };
    expect(contaBooleani(d)).toBeNull();
  });

  it("niente conteggi su ciò che non è un elenco di righe", () => {
    expect(contaBooleani({ id: "x", ok: true })).toBeNull();
    expect(contaBooleani("testo")).toBeNull();
    expect(contaBooleani({ items: [{ a: true }] })).toBeNull();
  });
});

describe("le istruzioni sui numeri e sui dati assenti", () => {
  it("il modello non conta a mente e usa total o conteggi", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("non si contano a mente");
    expect(ISTRUZIONI_ASSISTENTE).toContain("campo conteggi");
  });
  it("un null è «dato assente», mai {omissis}", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("«dato assente»");
    expect(ISTRUZIONI_ASSISTENTE).toMatch(/Mai \{omissis\} per un null/);
  });
});
