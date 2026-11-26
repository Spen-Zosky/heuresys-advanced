/**
 * Traduzione del dato nella risposta (ADR-0062): la trasformazione pura.
 * La prova sul database vero è in test/traduci-risposta.integration.test.ts.
 */
import { describe, it, expect } from "vitest";
import { traduciValore } from "../../src/lib/i18n/traduci-risposta.js";

const g = new Map([
  ["Gestione del rischio", "Risk management"],
  ["Finanza", "Finance"],
]);

describe("traduciValore", () => {
  it("traduce le stringhe uguali a un testo del glossario, in profondità", () => {
    const r = traduciValore({ items: [{ name: "Gestione del rischio", unit: { name: "Finanza" } }], total: 1 }, g);
    expect(r).toEqual({ items: [{ name: "Risk management", unit: { name: "Finance" } }], total: 1 });
  });

  it("lascia com'è ciò che non è nel glossario, e un pezzo di testo non è il testo", () => {
    const v = { name: "Rossi, Mario", note: "Finanza e controllo" };
    expect(traduciValore(v, g)).toBe(v);
  });

  it("non modifica l'oggetto ricevuto: copia solo i rami che cambiano", () => {
    const fermo = { a: 1 };
    const v = { name: "Finanza", fermo };
    const r = traduciValore(v, g) as typeof v;
    expect(v.name).toBe("Finanza");
    expect(r.name).toBe("Finance");
    expect(r.fermo).toBe(fermo);
  });

  it("non tocca le chiavi di identificativi e codici", () => {
    const v = { id: "Finanza", unitCode: "Finanza", ownerEmail: "Finanza", slug: "Finanza", label: "Finanza" };
    expect(traduciValore(v, g)).toEqual({ ...v, label: "Finance" });
  });

  it("lascia stare date, numeri, null e oggetti non semplici", () => {
    const d = new Date(0);
    const v = { d, n: 3, z: null, b: true };
    expect(traduciValore(v, g)).toBe(v);
  });
});
