/**
 * apps/web/src/lib/criterio-faccetta.test.ts — classe K08 del controllo forense del 23/11/2026:
 * «Proposta dell'agente (000511)» nella colonna Criterio della classificazione dei processi.
 *
 * Decisione di Enzo del 24/11/2026: il dato resta com'è, la pagina nasconde il prefisso con il
 * numero interno. Due parti: la regola pura di `criterio-faccetta.ts`, e il punto del codice che la
 * deve usare, letto dal sorgente (l'ambiente di prova non monta React).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { criterioDaMostrare } from "./criterio-faccetta";

const SRC = path.resolve(__dirname, "..");

describe("K08 — il prefisso con il numero interno non si mostra", () => {
  it("toglie «Proposta dell'agente (0005xx)» e lascia il resto del criterio", () => {
    expect(criterioDaMostrare("Proposta dell'agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: produce un servizio."))
      .toBe("Dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: produce un servizio.");
    expect(criterioDaMostrare("Proposta dell'agente (000512) dal nome di «Crediti»: mista."))
      .toBe("Dal nome di «Crediti»: mista.");
    expect(criterioDaMostrare("Proposta dell'agente (000510): su 8 attività, 3 svolte da persone."))
      .toBe("Su 8 attività, 3 svolte da persone.");
  });

  it("toglie il prefisso della verifica dal vivo di un rilascio", () => {
    expect(criterioDaMostrare("Verifica dal vivo del rilascio del passo 2 dell'ADR-0061: il processo serve al cliente."))
      .toBe("Il processo serve al cliente.");
    // se dopo il prefisso non resta un testo, la cella dice che il criterio non c'è
    expect(criterioDaMostrare("Verifica dal vivo del rilascio del passo 2 dell'ADR-0061, 22/11/2026.")).toBe("—");
  });

  it("non tocca un criterio scritto da una persona né i numeri dentro il testo", () => {
    expect(criterioDaMostrare("Il processo coinvolge 3 unità (000511 è il codice della pratica).")).toBe("Il processo coinvolge 3 unità (000511 è il codice della pratica).");
    expect(criterioDaMostrare("Proposta dell'agente approvata dopo la riunione del 12 novembre.")).toBe("Proposta dell'agente approvata dopo la riunione del 12 novembre.");
  });

  it("un criterio assente o vuoto è «—»", () => {
    expect(criterioDaMostrare(null)).toBe("—");
    expect(criterioDaMostrare(undefined)).toBe("—");
    expect(criterioDaMostrare("   ")).toBe("—");
  });

  it("la colonna Criterio della classificazione passa da criterioDaMostrare", () => {
    const s = fs.readFileSync(path.join(SRC, "components/processo/classificazione-processo.tsx"), "utf8");
    expect(s).toContain("criterioDaMostrare(valori[0]?.criterion)");
    expect(s).not.toMatch(/\{valori\[0\]\?\.criterion \|\| VUOTO\}/);
  });
});
