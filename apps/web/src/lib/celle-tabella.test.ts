/**
 * apps/web/src/lib/celle-tabella.test.ts — classe K15 del controllo forense del 23/11/2026:
 * «celle vuote senza segno nelle tabelle» (392 righe, cinque pagine principali).
 *
 * Due parti: le regole pure di `celle-tabella.ts`, e i punti del codice che le devono usare,
 * letti dal sorgente come fa `permessi-etichette.test.ts` (l'ambiente di prova non monta React).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { cellaVuota, colonnaVuotaOvunque, testoCellaGrafico } from "./celle-tabella";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
const numero = (n: number) => `n=${n}`;

describe("K15 — regole pure", () => {
  it("la tabella di un grafico scrive «—» per un valore assente o vuoto", () => {
    expect(testoCellaGrafico(null, numero)).toBe("—");
    expect(testoCellaGrafico(undefined, numero)).toBe("—");
    expect(testoCellaGrafico("", numero)).toBe("—");
    expect(testoCellaGrafico("  ", numero)).toBe("—");
    expect(testoCellaGrafico(Number.NaN, numero)).toBe("—");
    expect(testoCellaGrafico(1234.5, numero)).toBe("n=1234.5");
    expect(testoCellaGrafico("Marzo", numero)).toBe("Marzo");
  });

  it("una colonna di comandi vuota in ogni riga si toglie", () => {
    expect(colonnaVuotaOvunque([null, null, false])).toBe(true);
    expect(colonnaVuotaOvunque([null, "Togli"])).toBe(false);
    expect(colonnaVuotaOvunque([])).toBe(false);
    expect(cellaVuota("—")).toBe(true);
  });
});

describe("K15 — i punti del codice usano il segno", () => {
  it("la tabella equivalente dei grafici passa da testoCellaGrafico e si monta solo aperta", () => {
    const s = leggi("app/(authenticated)/_charts-client.tsx");
    expect(s).toContain("testoCellaGrafico(");
    // chiusa, la tabella non è in pagina: celle nascoste non sono celle vuote per chi legge
    expect(s).toMatch(/onToggle=/);
    expect(s).toMatch(/aperta\s*\?/);
  });

  it("EntityTable toglie anche la colonna dei comandi vuota e segna le celle grezze vuote", () => {
    const s = leggi("components/data-table-panel.tsx");
    expect(s).toContain("colonnaVuotaOvunque(");
    expect(s).not.toMatch(/c\.header !== "" && visibleRows\.every/);
    expect(s).toMatch(/cellaVuota\(c\.cell\(row\)\) \? VUOTO/);
  });

  it("requisiti di posizione: la colonna Togli c'è solo per chi può modificare", () => {
    for (const f of ["skills", "kpis"]) {
      const s = leggi(`app/(authenticated)/positions/[positionId]/${f}/page.tsx`);
      expect(s, f).toContain("usePuoModificarePosizione()");
      expect(s, f).toMatch(/\.\.\.\(puo\s*\?/);
    }
  });

  it("catalogo dei KPI: la colonna Togli c'è solo per chi può togliere", () => {
    const s = leggi("app/(authenticated)/admin/catalogo-kpi/page.tsx");
    expect(s).not.toMatch(/<th \/>/);
  });

  it("classificazione del processo: criterio e stato assenti si scrivono «—»", () => {
    const s = leggi("components/processo/classificazione-processo.tsx");
    expect(s).not.toContain('{valori[0]?.criterion ?? ""}</td>');
    expect(s).toContain("criterion || VUOTO");
    expect(s).not.toMatch(/valori\.length === 0 \? null/);
  });

  it("matrice processi × unità: la cella senza ruolo porta un segno e la sua spiegazione", () => {
    const s = leggi("components/processo/matrice-processi.tsx");
    expect(s).not.toMatch(/SIGLA\[r\] : ""/);
    expect(s).toContain('m("nessunRuolo"');
    expect(s).not.toMatch(/<td \/>/);
  });
});
