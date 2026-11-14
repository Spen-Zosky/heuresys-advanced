import { describe, it, expect } from "vitest";
import { costruisci } from "./leggibile-nucleo";
import { formati } from "./format";

const rubrica = {
  persone: [{ id: "2208f6e5-3d60-47cc-9664-42e45c196bae", email: "xenia.leone@rtl-bank.org", etichetta: "Leone, Xenia", posizione: null, unita: null, posizioneId: null, unitaId: null, attiva: true }],
  posizioni: [{ id: "08dfa814-de0a-4d93-b1c9-87b9badf1fff", codice: "POS-1", titolo: "Cassiere", unita: "Filiale Monza", titolare: null, unitaId: null, titolareId: null, riportaAId: null, criticita: null, attiva: true }],
  unita: [],
};
const l = costruisci(formati("it"), new Map([["APPROVED", "Approvata"], ["TENANT", "intera azienda"]]), rubrica, true);

describe("rete di leggibilità (C1, C2, C4)", () => {
  it("numeri in forma italiana, anni intatti", () => {
    expect(l.testo("883217")).toBe("883.217");
    expect(l.testo("0.5")).toBe("0,5");
    expect(l.testo("4.06")).toBe("4,06");
    expect(l.testo("2026")).toBe("2026");
    expect(l.testo("2023-08")).toBe("ago 2023");
    expect(l.testo("1.234")).toBe("1.234"); // già in forma italiana
    expect(l.testo("0.850")).toBe("0,85");
    expect(l.testo("Richiesta di ferie — 8.00 giorni dal 15/08/2026")).toBe("Richiesta di ferie — 8 giorni dal 15/08/2026");
    expect(l.testo("in coda (indice 71.4), a 57.1 su 100")).toBe("in coda (indice 71,4), a 57,1 su 100");
    expect(l.testo("Adeguamento retributivo — 4,069 EUR")).toBe("Adeguamento retributivo — 4.069 EUR");
    expect(l.testo("Salary set to 37467.00 EUR (hire)")).toContain("37.467 EUR");
    expect(l.testo("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Mozilla/5.0 (X11; Linux x86_64)");
  });
  it("codici e frasi inglesi in italiano", () => {
    expect(l.testo("APPROVED")).toBe("Approvata");
    expect(l.testo("COMPLETED")).toBe("Completato");
    expect(l.testo("Long term")).toBe("Lungo termine");
    expect(l.testo("Year-end adjustment")).toBe("Rettifica di fine anno");
    expect(l.testo("bereavement Accrual Policy")).toBe("Regola di maturazione: Lutto");
    expect(l.testo("leave_request")).toBe("Richiesta di assenza");
  });
  it("email e identificativi diventano nomi", () => {
    expect(l.testo("xenia.leone@rtl-bank.org")).toBe("Leone, Xenia");
    expect(l.testo("2208f6e5-3d60-47cc-9664-42e45c196bae")).toBe("Leone, Xenia");
    expect(l.testo("08dfa814-de0a-4d93-b1c9-87b9badf1fff")).toBe("Cassiere");
  });
  it("il testo italiano resta com'è", () => {
    expect(l.testo("Filiale Monza")).toBe("Filiale Monza");
    expect(l.testo("Non comunicata — eccezione")).toBe("Non comunicata — eccezione");
  });
  it("una parola con la maiuscola iniziale non è un codice", () => {
    expect(l.testo("Tenant")).toBe("Tenant");
    expect(l.testo("tenant")).toBe("intera azienda");
    expect(l.testo("TENANT")).toBe("intera azienda");
  });
  it("attraversa gli elementi", () => {
    const n = l.nodo(["883217", 12693]) as string[];
    expect(n).toEqual(["883.217", "12.693"]);
  });
});

describe("riferimenti cliccabili (C12)", () => {
  it("un identificativo o un'email esatti diventano un riferimento alla scheda", () => {
    const visti: string[] = [];
    const r = costruisci(formati("it"), new Map(), rubrica, true, (tipo, id, etichetta) => {
      visti.push(`${tipo}:${id}:${etichetta}`);
      return etichetta;
    });
    const p = rubrica.persone[0]!;
    r.nodo(p.id);
    r.nodo(p.email!.toUpperCase());
    r.nodo("testo qualunque");
    expect(visti).toEqual([`persona:${p.id}:${p.etichetta}`, `persona:${p.id}:${p.etichetta}`]);
  });
});
