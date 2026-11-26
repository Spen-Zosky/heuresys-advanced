/**
 * Giudizio qa-web 16/11, T-LINGUA (API-NOTIF): gli avvisi salvati con testo italiano fisso
 * (promemoria e scadenza di un'approvazione, gap di competenze) portano anche un codice e i parametri,
 * ricavati in lettura dal dato esistente (niente riscrittura), cosi' il web compone il testo nella lingua
 * di chi guarda. Il testo che si scrive e quello che si riconosce vengono dalla stessa fonte.
 */
import { describe, it, expect } from "vitest";
import {
  testoPromemoriaApprovazione,
  testoScadenzaApprovazione,
  testoGapCompetenze,
  testoRiepilogoAgente,
  messaggioDellAvviso,
} from "../../src/lib/notifications/messaggi.js";

describe("messaggio strutturato degli avvisi", () => {
  it("promemoria di approvazione: codice e titolo", () => {
    const t = testoPromemoriaApprovazione("Adeguamento retributivo — 1.158 EUR");
    expect(messaggioDellAvviso("APPROVAL_REMINDER", t.subject, t.body)).toEqual({
      code: "APPROVAL_REMINDER",
      params: { title: "Adeguamento retributivo — 1.158 EUR" },
    });
  });

  it("scadenza di approvazione: codice, titolo e numero di cicli", () => {
    const t = testoScadenzaApprovazione("Richiesta di ferie — 9 giorni dal 16/08/2026", 3);
    expect(messaggioDellAvviso("APPROVAL_OVERDUE", t.subject, t.body)).toEqual({
      code: "APPROVAL_OVERDUE",
      params: { title: "Richiesta di ferie — 9 giorni dal 16/08/2026", cycles: 3 },
    });
  });

  it("gap di competenze: codice e segmento, anche per un segmento che non si conosce", () => {
    for (const segmento of ["MAJOR_GAP", "MODERATE_GAP", "MINOR_GAP", "ALIGNED"]) {
      const t = testoGapCompetenze(segmento);
      expect(messaggioDellAvviso("GAP_CLOSURE_DUE", t.subject, t.body)).toEqual({
        code: "GAP_CLOSURE_DUE",
        params: { segment: segmento },
      });
    }
    // il formato di prima, che portava il codice nella frase, esiste ancora nei dati salvati
    expect(
      messaggioDellAvviso(
        "GAP_CLOSURE_DUE",
        "Gap di competenze da colmare",
        "È stato rilevato un gap di competenze per la tua posizione (priorità MODERATE_GAP).",
      ),
    ).toEqual({ code: "GAP_CLOSURE_DUE", params: { segment: "MODERATE_GAP" } });
    const ignoto = testoGapCompetenze("BOH");
    expect(messaggioDellAvviso("GAP_CLOSURE_DUE", ignoto.subject, ignoto.body)).toEqual({
      code: "GAP_CLOSURE_DUE",
      params: { segment: "UNKNOWN" },
    });
  });

  it("il riepilogo settimanale dell'assistente (ADR-0063 D3) si riconosce con le sue cifre", () => {
    const t = testoRiepilogoAgente("2026-11-16", "2026-11-22", 7, 2, 0);
    expect(messaggioDellAvviso("SYSTEM", t.subject, t.body)).toEqual({
      code: "AGENT_WEEKLY_SUMMARY",
      params: { from: "2026-11-16", to: "2026-11-22", confirmed: 7, denied: 2, autonomous: 0 },
    });
    expect(messaggioDellAvviso("SYSTEM", t.subject, "testo cambiato a mano")).toBeNull();
  });

  it("un avviso di un altro tipo, o con un testo che non e' quello atteso, resta com'e' (null)", () => {
    expect(messaggioDellAvviso("SYSTEM", "Qualcosa", "altro")).toBeNull();
    expect(messaggioDellAvviso("APPROVAL_REMINDER", "Testo scritto a mano", null)).toBeNull();
    expect(messaggioDellAvviso("GAP_CLOSURE_DUE", "Gap di competenze da colmare", "testo libero")).toBeNull();
  });
});
