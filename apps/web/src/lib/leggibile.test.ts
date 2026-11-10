import { describe, it, expect } from "vitest";
import { costruisci } from "./leggibile-nucleo";
import { formati } from "./format";

const rubrica = {
  persone: [{ id: "2208f6e5-3d60-47cc-9664-42e45c196bae", email: "xenia.leone@rtl-bank.org", etichetta: "Leone, Xenia", posizione: null, unita: null }],
  posizioni: [{ id: "08dfa814-de0a-4d93-b1c9-87b9badf1fff", codice: "POS-1", titolo: "Cassiere", unita: "Filiale Monza", titolare: null }],
  unita: [],
};
const l = costruisci(formati("it"), new Map([["APPROVED", "Approvata"]]), rubrica, true);

describe("rete di leggibilità (C1, C2, C4)", () => {
  it("numeri in forma italiana, anni intatti", () => {
    expect(l.testo("883217")).toBe("883.217");
    expect(l.testo("0.5")).toBe("0,5");
    expect(l.testo("4.06")).toBe("4,06");
    expect(l.testo("2026")).toBe("2026");
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
  it("attraversa gli elementi", () => {
    const n = l.nodo(["883217", 12693]) as string[];
    expect(n).toEqual(["883.217", "12.693"]);
  });
});
