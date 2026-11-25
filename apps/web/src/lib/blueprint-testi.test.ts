/**
 * Giro forense K32: il confronto e la costruzione di un fascicolo si leggono in parole.
 * Le traduzioni vengono dai dizionari veri (`locales/<lingua>/blueprints.json`), non da un doppio.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { etichettaInclusione, incoerenzaDelPiano, titoloIncoerenza, voceDecisione } from "./blueprint-testi";

type Nodo = { [k: string]: string | Nodo };

function traduttore(lingua: "it" | "en") {
  const d = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "locales", lingua, "blueprints.json"), "utf8"),
  ) as Nodo;
  return (chiave: string, opzioni?: Record<string, unknown>): string => {
    const count = opzioni?.count;
    const leggi = (k: string): unknown => k.split(".").reduce<unknown>((n, p) => (n as Nodo | undefined)?.[p], d);
    const valore = (count === 1 ? leggi(`${chiave}_one`) : undefined) ?? leggi(chiave);
    if (typeof valore !== "string") throw new Error(`chiave mancante in ${lingua}: ${chiave}`);
    return valore.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opzioni?.[n] ?? ""));
  };
}

const CODICI_INCLUSIONE = /\b(IN|PARTIAL|OUT)\b/;

describe("confronto: la decisione non mostra i codici dell'inclusione", () => {
  for (const lingua of ["it", "en"] as const) {
    const t = traduttore(lingua);
    it(`${lingua}: PARTIAL diventa un'etichetta tradotta, con il nome del processo`, () => {
      const voce = voceDecisione(
        { processName: "Consulenza patrimoniale", inclusion: "PARTIAL", rationale: "solo affluent" },
        t,
      );
      expect(voce).toBe(`Consulenza patrimoniale — ${t("dossier.decisions.partial")}: solo affluent`);
      expect(voce).not.toMatch(CODICI_INCLUSIONE);
    });
    it(`${lingua}: ogni inclusione ha la sua etichetta, e nessuna è il codice`, () => {
      for (const i of ["IN", "PARTIAL", "OUT"] as const) {
        expect(etichettaInclusione(i, t)).not.toMatch(CODICI_INCLUSIONE);
      }
    });
    it(`${lingua}: il motivo dell'impatto non calcolabile c'è, e senza apostrofi al posto degli accenti`, () => {
      expect(t("dossier.diff.notComputableReason")).not.toMatch(/\b(gia|e|perche|piu)'/);
    });
    it(`${lingua}: confronto e costruzione parlano a chi usa la pagina, non a chi la sviluppa (classi Q)`, () => {
      const testi = [
        t("dossier.diff.notComputable"),
        t("dossier.diff.notComputableReason"),
        t("dossier.build.incoherent.skillsWithoutCategory", { count: 2 }),
        t("dossier.build.incoherent.skillsWithoutCategory", { count: 1 }),
        t("dossier.build.incoherent.whatToDo"),
        t("dossier.unavailable.reason"),
      ];
      for (const x of testi) {
        expect(x).not.toMatch(/deploy|in questa parte|in this part|strato della struttura|structure layer|dossier\./i);
      }
    });
  }
});

describe("costruzione: il 409 incoerente si legge con numero ed elenco, non con i codici", () => {
  const errore = {
    status: 409,
    code: "BLUEPRINT_CONTENT_INCOHERENT",
    details: {
      reason: "SKILLS_WITHOUT_CATEGORY",
      count: 2,
      items: [
        { code: "ESCO::04f2751a-a017-4446-bc8e-7aaa733f2dc8", name: "Gestire il rischio di credito" },
        { code: "ESCO::058e4ee9-423d-41b9-a711-7892d0490512", name: "Analisi di bilancio" },
      ],
    },
  };

  it("riconosce i dettagli per forma", () => {
    expect(incoerenzaDelPiano(errore)?.count).toBe(2);
    expect(incoerenzaDelPiano({ status: 409, code: "CONFLICT" })).toBeNull();
    expect(incoerenzaDelPiano({ details: { reason: "ALTRO" } })).toBeNull();
  });

  for (const lingua of ["it", "en"] as const) {
    const t = traduttore(lingua);
    it(`${lingua}: il titolo dice il numero e nessun identificativo ESCO`, () => {
      const i = incoerenzaDelPiano(errore)!;
      const titolo = titoloIncoerenza(i, t);
      expect(titolo).toContain("2");
      expect(titolo).not.toMatch(/ESCO::|[0-9a-f]{8}-[0-9a-f]{4}/);
    });
    it(`${lingua}: con una sola riga si usa il singolare`, () => {
      const titolo = titoloIncoerenza({ reason: "POSITIONS_IN_MISSING_UNITS", count: 1, items: [] }, t);
      expect(titolo).toBe(t("dossier.build.incoherent.positionsInMissingUnits_one", { count: 1 }));
    });
  }
});
