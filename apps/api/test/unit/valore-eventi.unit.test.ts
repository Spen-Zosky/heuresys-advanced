/**
 * test/unit/valore-eventi.unit.test.ts — F0-3, il test del valore come misura.
 *
 * Una decisione è tracciabile se porta chi, che cosa, su quale oggetto, quando e da
 * quale superficie (pagina o agente). Le due funzioni pure provate qui decidono la
 * superficie e l'oggetto: se sbagliano, la misura conta cose che non sono decisioni
 * oppure ne perde di vere, e nessun test sul database se ne accorgerebbe.
 */
import { describe, expect, it } from "vitest";

import { leggiSuperficie, normalizzaPercorsoPagina } from "@heuresys/shared";
import { estraiValori } from "../../src/lib/valore/estrai.js";

describe("superficie: da quale pagina o agente arriva una richiesta", () => {
  it("la pagina perde gli identificativi, così la superficie conta le pagine e non le righe", () => {
    expect(normalizzaPercorsoPagina("/positions/0b5e0c62-3f7a-4d0c-9a51-2b1f0b0e7c11/edit?tab=2#x")).toBe(
      "/positions/:id/edit",
    );
    expect(normalizzaPercorsoPagina("/approvals/123")).toBe("/approvals/:id");
    expect(normalizzaPercorsoPagina("/")).toBe("/");
    expect(normalizzaPercorsoPagina("")).toBe("/");
    expect(normalizzaPercorsoPagina("/a".repeat(200)).length).toBeLessThanOrEqual(200);
  });

  it("legge pagina e agente, e rifiuta tutto il resto invece di indovinare", () => {
    expect(leggiSuperficie("pagina:/approvals/:id")).toEqual({ tipo: "pagina", valore: "/approvals/:id" });
    expect(leggiSuperficie("pagina:/approvals/0b5e0c62-3f7a-4d0c-9a51-2b1f0b0e7c11")).toEqual({
      tipo: "pagina",
      valore: "/approvals/:id",
    });
    expect(leggiSuperficie("agente:consolidamento")).toEqual({ tipo: "agente", valore: "consolidamento" });
    expect(leggiSuperficie(undefined)).toBeNull();
    expect(leggiSuperficie("")).toBeNull();
    expect(leggiSuperficie("pagina:approvals")).toBeNull(); // senza la barra iniziale non è un percorso
    expect(leggiSuperficie("agente:Ha Spazi")).toBeNull();
    expect(leggiSuperficie("script:import")).toBeNull();
    expect(leggiSuperficie(["pagina:/a", "pagina:/b"])).toBeNull(); // un'intestazione ripetuta è ambigua
  });
});

describe("oggetto ed esito: su che cosa si è deciso, e come", () => {
  const ctx = {
    params: { id: "p-1", proposalId: "prop-9" },
    corpo: { decision: "APPROVE", proposalIds: ["a", "b", "a"], numero: 3 },
    risposta: { goalId: "g-7", approvalRequestId: "r-2" },
  };

  it("legge dal parametro di rotta, dal corpo e dalla risposta", () => {
    expect(estraiValori("param:proposalId", ctx)).toEqual(["prop-9"]);
    expect(estraiValori("risposta:goalId", ctx)).toEqual(["g-7"]);
    expect(estraiValori("corpo:decision", ctx)).toEqual(["APPROVE"]);
  });

  it("un elenco nel corpo dà una decisione per elemento, senza doppioni", () => {
    expect(estraiValori("corpo:proposalIds[]", ctx)).toEqual(["a", "b"]);
  });

  it("una specifica assente, malformata o che punta al vuoto non inventa un oggetto", () => {
    expect(estraiValori(null, ctx)).toEqual([]);
    expect(estraiValori("param:manca", ctx)).toEqual([]);
    expect(estraiValori("corpo:numero", ctx)).toEqual([]); // solo testo: un numero non è un identificativo
    expect(estraiValori("risposta:goalId", { ...ctx, risposta: null })).toEqual([]);
    expect(estraiValori("intestazione:x", ctx)).toEqual([]);
  });
});
