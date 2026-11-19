/**
 * C14 del giro qa-web 18/11/2026: nelle viste «attività» la colonna Tipo ripeteva la frase
 * («Corso completato: …» con Tipo «Corso completato»). Le frasi sono quelle vere del database
 */
import { describe, expect, it } from "vitest";
import { tipoRipetuto } from "../../src/modules/dashboard/blocchi.js";

describe("C14: il tipo non si ripete quando la frase lo dice già", () => {
  it("«Corso completato: …» e COURSE_COMPLETED sono la stessa cosa", () => {
    expect(tipoRipetuto("Corso completato: Analisi avanzata dei dati (competenze tecniche)", "COURSE_COMPLETED")).toBe(true);
  });
  it("«Certificazione conseguita: …» e CERTIFICATION_EARNED sono la stessa cosa", () => {
    expect(tipoRipetuto("Certificazione conseguita: BA Bank Teller Certificate", "CERTIFICATION_EARNED")).toBe(true);
  });
  it("«Assunto come …» e HIRE sono la stessa cosa", () => {
    expect(tipoRipetuto("Assunto come Analista Finanziario", "HIRE")).toBe(true);
  });
  it("una frase che non dice il tipo lo lascia", () => {
    expect(tipoRipetuto("Trasferimento alla filiale di Torino", "HIRE")).toBe(false);
    expect(tipoRipetuto("", "HIRE")).toBe(false);
  });
});
