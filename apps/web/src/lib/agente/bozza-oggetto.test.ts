import { describe, expect, it } from "vitest";
import { BOZZA_VUOTA, eseguiSulFascicolo, salvata, vistaDelFascicolo, type ProcessoDelFascicolo } from "./bozza-oggetto";

const PROCESSI: ProcessoDelFascicolo[] = [
  { processId: "p1", processCode: "HR-01", processName: "Selezione", inclusion: null },
  { processId: "p2", processCode: "HR-02", processName: "Paghe", inclusion: "IN" },
];
const ctx = { processi: PROCESSI, modificabile: true };

describe("lavora sull'oggetto: il fascicolo (I5)", () => {
  it("un mandato costruisce, il successivo continua, un annulla torna a prima", () => {
    const a = eseguiSulFascicolo(BOZZA_VUOTA, "fascicolo.decidi", { processo: "HR-01", inclusione: "OUT", motivazione: "esternalizzata" }, ctx);
    expect(a.esito.stato).toBe("ok");
    expect(a.stato!.bozze).toEqual({ p1: { inclusion: "OUT", rationale: "esternalizzata" } });

    const b = eseguiSulFascicolo(a.stato!, "fascicolo.decidi", { processo: "paghe", inclusione: "PARTIAL", motivazione: "solo cedolini" }, ctx);
    expect(Object.keys(b.stato!.bozze)).toEqual(["p1", "p2"]);
    expect(b.stato!.passi).toHaveLength(2);

    const c = eseguiSulFascicolo(b.stato!, "fascicolo.annulla", {}, ctx);
    expect(c.esito.stato).toBe("ok");
    expect(c.stato!.bozze).toEqual(a.stato!.bozze);

    const d = eseguiSulFascicolo(c.stato!, "fascicolo.annulla", {}, ctx);
    expect(d.stato!.bozze).toEqual({});
    expect(eseguiSulFascicolo(d.stato!, "fascicolo.annulla", {}, ctx).esito.stato).toBe("rifiutata");
  });

  it("le regole del dominio rifiutano senza cambiare lo stato", () => {
    const casi: Array<[Record<string, unknown>, string]> = [
      [{ processo: "XX-99", inclusione: "IN", motivazione: "m" }, "non ha il processo"],
      [{ processo: "HR-01", inclusione: "FORSE", motivazione: "m" }, "IN, PARTIAL oppure OUT"],
      [{ processo: "HR-01", inclusione: "IN", motivazione: "   " }, "Senza motivazione"],
      [{ processo: "HR-01", inclusione: "IN", motivazione: "x".repeat(501) }, "supera"],
    ];
    for (const [arg, frase] of casi) {
      const r = eseguiSulFascicolo(BOZZA_VUOTA, "fascicolo.decidi", arg, ctx);
      expect(r.stato).toBeNull();
      expect(r.esito.stato).toBe("rifiutata");
      expect(r.esito.dettaglio).toContain(frase);
    }
    const firmato = eseguiSulFascicolo(BOZZA_VUOTA, "fascicolo.decidi", { processo: "HR-01", inclusione: "IN", motivazione: "m" }, { ...ctx, modificabile: false });
    expect(firmato.esito.dettaglio).toContain("non si può modificare");
    expect(eseguiSulFascicolo(BOZZA_VUOTA, "tabella.cerca", { testo: "x" }, ctx).esito.stato).toBe("rifiutata");
  });

  it("una decisione salvata esce dalla bozza e l'annulla non la ripropone", () => {
    const a = eseguiSulFascicolo(BOZZA_VUOTA, "fascicolo.decidi", { processo: "HR-01", inclusione: "OUT", motivazione: "m" }, ctx).stato!;
    const b = eseguiSulFascicolo(a, "fascicolo.decidi", { processo: "HR-02", inclusione: "IN", motivazione: "n" }, ctx).stato!;
    const s = salvata(b, "p1");
    expect(Object.keys(s.bozze)).toEqual(["p2"]);
    const indietro = eseguiSulFascicolo(s, "fascicolo.annulla", {}, ctx).stato!;
    expect(indietro.bozze).toEqual({});
  });

  it("la vista dichiara codici e decisioni, e quante restano fuori", () => {
    const a = eseguiSulFascicolo(BOZZA_VUOTA, "fascicolo.decidi", { processo: "HR-01", inclusione: "OUT", motivazione: "m" }, ctx).stato!;
    const v = vistaDelFascicolo(PROCESSI, a, true, 1);
    expect(v).toMatchObject({
      processiTotali: 2,
      altriProcessi: 1,
      passiAnnullabili: 1,
      processi: [{ codice: "HR-01", decisione: "come dice il modello", preparata: "OUT" }],
    });
    expect(JSON.stringify(v)).not.toContain("motivazione");
  });
});
