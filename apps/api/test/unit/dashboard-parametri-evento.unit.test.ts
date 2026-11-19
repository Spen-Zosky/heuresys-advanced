/**
 * C22 del giro qa-web 18/11/2026 (G-RENDER): la frase di un evento era italiana in una pagina inglese.
 * L'API restituisce tipo e soggetto, il web compone la frase nella lingua di chi guarda.
 * Le frasi sono quelle vere del database (sys_user_timeline_events).
 */
import { describe, expect, it } from "vitest";
import { parametriEvento } from "../../src/modules/dashboard/blocchi.js";

describe("C22: tipo e soggetto di un evento", () => {
  it("corso completato", () => {
    expect(parametriEvento("COURSE_COMPLETED", "Corso completato: Analisi avanzata dei dati (competenze tecniche)"))
      .toEqual({ kind: "COURSE_COMPLETED", subject: "Analisi avanzata dei dati (competenze tecniche)" });
  });
  it("certificazione conseguita", () => {
    expect(parametriEvento("CERTIFICATION_EARNED", "Certificazione conseguita: BA Bank Teller Certificate (American Bankers Association)"))
      .toEqual({ kind: "CERTIFICATION_EARNED", subject: "BA Bank Teller Certificate (American Bankers Association)" });
  });
  it("assunzione", () => {
    expect(parametriEvento("HIRE", "Assunto come Analista Finanziario")).toEqual({ kind: "HIRE", subject: "Analista Finanziario" });
  });
  it("una frase che non comincia col prefisso del tipo non si inventa", () => {
    expect(parametriEvento("HIRE", "Trasferimento alla filiale di Torino")).toBeNull();
    expect(parametriEvento("SALARY_CHANGE", "Ricalcolo della retribuzione")).toBeNull();
    expect(parametriEvento("COURSE_COMPLETED", "Corso completato: ")).toBeNull();
  });
});
