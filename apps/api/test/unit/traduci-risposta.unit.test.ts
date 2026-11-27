/**
 * Traduzione del dato nella risposta (ADR-0062): la trasformazione pura.
 * La prova sul database vero è in test/traduci-risposta.integration.test.ts.
 */
import { describe, it, expect } from "vitest";
import { traduciValore, rovescia, riceveRitorno } from "../../src/lib/i18n/traduci-risposta.js";
import { separaModifiche, idDellaRisorsa } from "../../src/lib/i18n/traduzione-della-riga.js";

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

describe("rovescia", () => {
  it("rovescia le traduzioni che vengono da un testo italiano solo", () => {
    const r = rovescia(new Map([["Finanza", "Finance"], ["Finanze", "Finance"], ["Gestione del rischio", "Risk management"]]));
    expect([...r.entries()]).toEqual([["Risk management", "Gestione del rischio"]]);
  });

  it("le chiavi di segreti non si toccano", () => {
    const v = { password: "Finance", resetToken: "Finance", label: "Finance" };
    expect(traduciValore(v, rovescia(g))).toEqual({ ...v, label: "Finanza" });
  });

  it("un'ambiguità resta com'è e ogni sostituzione si conta", () => {
    const inv = rovescia(new Map([["Finanza", "Finance"], ["Finanze", "Finance"], ["Gestione del rischio", "Risk management"]]));
    const tracce: string[] = [];
    const r = traduciValore({ a: "Finance", b: ["Risk management"], c: "A new English text" }, inv, 0, tracce);
    expect(r).toEqual({ a: "Finance", b: ["Gestione del rischio"], c: "A new English text" });
    expect(tracce).toEqual(["Risk management"]);
  });

  it("una chiave __proto__ nel corpo non cambia il prototipo della copia", () => {
    const corpo = JSON.parse('{"__proto__": {"name": "Finance"}, "label": "Finance"}') as Record<string, unknown>;
    const r = traduciValore(corpo, rovescia(g)) as Record<string, unknown>;
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
    expect(r.label).toBe("Finanza");
  });
});

describe("riceveRitorno", () => {
  it("solo le scritture /v1/* fuori dall'accesso ricevono il ritorno", () => {
    expect(riceveRitorno("/v1/skills/:id", "PATCH")).toBe(true);
    expect(riceveRitorno("/v1/positions", ["POST", "PUT"])).toBe(true);
    expect(riceveRitorno("/v1/skills/:id", "GET")).toBe(false);
    expect(riceveRitorno("/v1/auth/login", "POST")).toBe(false);
    expect(riceveRitorno("/v1/auth/agent-tokens", "POST")).toBe(false);
    expect(riceveRitorno("/v1/auth", "POST")).toBe(false);
    expect(riceveRitorno("/healthz", "POST")).toBe(false);
  });
});


describe("modifiche fatte in inglese (3b)", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const trovati = [
    { tabella: "sys_skills", campo: "name", it: "Gestione del rischio", en: "Risk management" },
    { tabella: "sys_skills", campo: "description", it: "Descrizione italiana", en: "English description" },
  ];

  it("un testo non cambiato torna all'italiano; uno cambiato va nella traduzione e l'italiano resta", () => {
    const r = separaModifiche({ name: "Risk management", description: "A new English description", level: 3 }, id, trovati);
    expect(r.corpo).toEqual({ name: "Gestione del rischio", description: "Descrizione italiana", level: 3 });
    expect(r.modifiche).toEqual([
      { tabella: "sys_skills", id, campo: "description", testo: "A new English description", it: "Descrizione italiana" },
    ]);
    expect([...r.campi].sort()).toEqual(["description", "name"]);
  });

  it("senza italiano nella riga il testo resta com'è; null e numeri non si toccano", () => {
    const r = separaModifiche({ name: "Brand new", description: null }, id, [{ tabella: "t", campo: "name", it: null, en: null }]);
    expect(r.corpo).toEqual({ name: "Brand new", description: null });
    expect(r.modifiche).toEqual([]);
  });

  it("l'id è il parametro dell'ultimo segmento, solo se è un uuid", () => {
    expect(idDellaRisorsa("/v1/skills/:id", { id })).toBe(id);
    expect(idDellaRisorsa("/v1/positions/:positionId/skills", { positionId: id })).toBeNull();
    expect(idDellaRisorsa("/v1/skills/:id", { id: "abc" })).toBeNull();
  });
});
