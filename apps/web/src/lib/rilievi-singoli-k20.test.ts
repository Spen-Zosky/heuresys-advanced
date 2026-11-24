/**
 * apps/web/src/lib/rilievi-singoli-k20.test.ts — classe K20 del controllo forense del 23/11/2026
 * (rilievi singoli di impaginazione e contenuto di pagina). Rigiudicati dal vivo il 24/11/2026 in
 * sola lettura; qui le tre cause ancora vere e con la causa nel codice di advanced.
 *
 *   · Decimali incoerenti (/insights, /insights/skill-gap, /gaps in inglese): la pagina scrive il
 *     punteggio con un decimale fisso («42.0»), poi la rete di leggibilità lo rilegge e, con il solo
 *     massimo dei decimali, toglie lo zero: «42» accanto a «46.2». Un numero scritto con N decimali
 *     (al più due) li tiene tutti.
 *   · IBAN che copre lo SWIFT/BIC (/me/profile, Dati bancari): la casella della griglia a due
 *     colonne non va a capo e l'IBAN, senza spazi, esce sulla colonna accanto.
 *   · «dati case-study sintetici» (/investors): un dato si descrive per ciò che è, senza etichette
 *     rassicuranti (CLAUDE.md del repo). RTL Bank è il cliente modello con il dataset popolato.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costruisci } from "./leggibile-nucleo";
import { formati } from "./format";

const SRC = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const vuota = { persone: [], posizioni: [], unita: [] };

describe("K20 — decimali coerenti in una colonna di punteggi", () => {
  it("in inglese «42.0» resta «42.0», accanto a «46.2»", () => {
    const en = costruisci(formati("en"), new Map(), vuota, false);
    expect(en.testo("42.0")).toBe("42.0");
    expect(en.testo("46.2")).toBe("46.2");
    expect(en.testo("39.0")).toBe("39.0");
  });

  it("in italiano un decimale grezzo tiene le sue cifre, fino a due", () => {
    const it_ = costruisci(formati("it"), new Map(), vuota, true);
    expect(it_.testo("42.0")).toBe("42,0");
    expect(it_.testo("0.850")).toBe("0,85");
    expect(it_.testo("883217")).toBe("883.217");
  });
});

describe("K20 — IBAN e SWIFT/BIC nei Dati bancari", () => {
  const field = leggi("app/(authenticated)/me/profile/_components/field.tsx");
  it("la casella può restringersi nella griglia (min-w-0)", () => {
    expect(field).toMatch(/<div className="[^"]*\bmin-w-0\b[^"]*"/);
  });
  it("il valore va a capo invece di uscire sulla colonna accanto", () => {
    expect(field).toMatch(/<dd className="[^"]*\bwrap-anywhere\b[^"]*"/);
  });
});

describe("K20 — pagina per gli investitori", () => {
  it("nessuna etichetta rassicurante «sintetici» / «synthetic» sui dati", () => {
    for (const l of ["it", "en"]) {
      expect(leggi(`locales/${l}/investors.json`)).not.toMatch(/sintetic|synthetic/i);
    }
  });
});
