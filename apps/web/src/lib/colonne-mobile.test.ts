import { describe, expect, it } from "vitest";
import { COLONNE_SU_MOBILE, visibiliSuMobile } from "./colonne-mobile";

/*
 * K18 (giro forense del 23/11/2026): a 390 px una tabella con sei colonne restava tabella, e le
 * ultime colonne uscivano dallo schermo. Sotto md restano le prime colonne con un titolo; le
 * altre si leggono nella scheda della riga, che le mostra tutte.
 */
describe("K18: colonne di una tabella sotto i 768 px", () => {
  it("restano le prime tre colonne con un titolo", () => {
    expect(COLONNE_SU_MOBILE).toBe(3);
    expect(visibiliSuMobile(["Nome", "Unità", "Ruolo", "Inizio", "Fine", "Stato"])).toEqual([true, true, true, false, false, false]);
  });

  it("la colonna dei comandi (intestazione vuota) resta sempre", () => {
    expect(visibiliSuMobile(["Nome", "Unità", "Ruolo", "Stato", ""])).toEqual([true, true, true, false, true]);
  });

  it("una tabella corta non perde niente", () => {
    expect(visibiliSuMobile(["Nome", "Stato"])).toEqual([true, true]);
  });

  it("con una scheda della riga assente non si nasconde niente", () => {
    expect(visibiliSuMobile(["A", "B", "C", "D", "E"], { conScheda: false })).toEqual([true, true, true, true, true]);
  });
});

describe("K18: tabelle della scheda processo ripiegabili", () => {
  it("sotto md la tabella è un blocco e l'intestazione si nasconde; da md torna tabella", async () => {
    const { RIPIEGABILE } = await import("./colonne-mobile");
    expect(RIPIEGABILE.tabella).toMatch(/\bblock\b.*\bmd:table\b/);
    expect(RIPIEGABILE.intestazione).toMatch(/\bhidden\b.*\bmd:table-header-group\b/);
    expect(RIPIEGABILE.riga).toMatch(/\bmd:table-row\b/);
    expect(RIPIEGABILE.cella).toMatch(/\bgrid\b.*\bmd:table-cell\b/);
    expect(RIPIEGABILE.etichetta).toMatch(/\bmd:hidden\b/);
  });

  it("la scheda processo e la classificazione usano la tabella ripiegabile", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const radice = path.resolve(__dirname, "..");
    for (const f of ["app/(authenticated)/tenant-processes/[id]/page.tsx", "components/processo/classificazione-processo.tsx"]) {
      const sorgente = fs.readFileSync(path.join(radice, f), "utf8");
      expect(sorgente, f).toContain("RIPIEGABILE.tabella");
      expect(sorgente, f).not.toMatch(/<table className="w-full text-sm"/);
    }
  });
});
