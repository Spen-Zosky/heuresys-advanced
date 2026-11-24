/**
 * apps/web/src/lib/matrice-e-grafici.test.ts — classi K12 e K17 del controllo forense del 23/11/2026.
 *
 * K12: il testo della matrice processi × unità era a 10-11 px. K17: nei grafici le etichette
 * dell'asse di «Persone per titolo di posizione» si sovrapponevano, il nome dell'asse verticale di
 * categorie finiva sopra le etichette, e le mappe di calore delle competenze avevano i numeri in
 * grigio illeggibili sulle celle chiare e le celle senza evidenze vuote invece che «0».
 *
 * Due parti, come `celle-tabella.test.ts`: le regole pure, e i punti del codice che le devono
 * usare, letti dal sorgente (l'ambiente di prova non monta React).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { contrasto, etichetteLeggibiliMappaDiCalore, leggiColore, sopra } from "./colori-grafico";
import { grigliaCompleta } from "./celle-tabella";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("K12 — matrice processi × unità", () => {
  it("nessun testo sotto i 12 px", () => {
    const s = leggi("components/processo/matrice-processi.tsx");
    const piccoli = [...s.matchAll(/text-\[(\d+)px\]/g)].filter((m) => Number(m[1]) < 12).map((m) => m[0]);
    expect(piccoli).toEqual([]);
    expect(s).toContain('className="border-collapse text-xs');
  });
});

// I token di @heuresys/ui 1.7 (theme-heuresys.css), chiaro e scuro, più il nero e il bianco puri come
// fa `_charts-client.tsx`, e la scala della mappa di calore.
const TEMI = {
  chiaro: { fondo: "#FFFFFF", testi: ["#0F1828", "#FAFBFD", "#000000", "#FFFFFF"] },
  scuro: { fondo: "#131720", testi: ["#F2F4F8", "#0D1017", "#000000", "#FFFFFF"] },
};
const SCALA = ["rgba(37, 99, 235, 0.12)", "#2563EB"];

function mappa(valori: number[]) {
  return {
    visualMap: { min: 0, max: Math.max(...valori), inRange: { color: SCALA } },
    series: [{ type: "heatmap", data: valori.map((v, i) => [0, i, v]), label: { show: true, color: "#9CA3AF" } }],
  };
}

describe("K17 — numeri leggibili nelle celle della mappa di calore", () => {
  for (const [nome, tema] of Object.entries(TEMI)) {
    it(`tema ${nome}: ogni cella, dalla più chiara alla più piena, ha il numero ad almeno 4,5:1`, () => {
      const valori = Array.from({ length: 41 }, (_, i) => i);
      const o = etichetteLeggibiliMappaDiCalore(mappa(valori), tema);
      const fondo = leggiColore(tema.fondo)!;
      const [chiara, piena] = [leggiColore(SCALA[0]!)!, leggiColore(SCALA[1]!)!];
      const data = o.series[0]!.data as unknown as Array<{ value: number[]; label: { color: string } }>;
      expect(data).toHaveLength(valori.length);
      for (const d of data) {
        const t = d.value[2]! / 40;
        const cella = sopra({ r: chiara.r + (piena.r - chiara.r) * t, g: chiara.g + (piena.g - chiara.g) * t, b: chiara.b + (piena.b - chiara.b) * t, a: chiara.a + (piena.a - chiara.a) * t }, fondo);
        expect(contrasto(leggiColore(d.label.color)!, cella)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("il grigio unico di prima non bastava: sulla cella piena del tema scuro sta sotto 4,5:1", () => {
    expect(contrasto(leggiColore("#9CA3AF")!, leggiColore("#2563EB")!)).toBeLessThan(4.5);
  });

  it("se la scala o i colori non si leggono, l'opzione resta com'è", () => {
    const o = mappa([1, 2]);
    expect(etichetteLeggibiliMappaDiCalore(o, { fondo: "", testi: ["#000000"] })).toBe(o);
    const senzaScala = { ...o, visualMap: { min: 0, max: 2 } };
    expect(etichetteLeggibiliMappaDiCalore(senzaScala, TEMI.scuro)).toBe(senzaScala);
  });

  it("le serie che non sono mappe di calore non si toccano", () => {
    const o = { visualMap: { min: 0, max: 1, inRange: { color: SCALA } }, series: [{ type: "bar", data: [1, 2] }] };
    expect(etichetteLeggibiliMappaDiCalore(o, TEMI.scuro).series[0]).toBe(o.series[0]);
  });
});

describe("K17 — celle a zero", () => {
  it("la griglia si completa: la coppia senza evidenze vale 0", () => {
    expect(grigliaCompleta(2, 2, [[1, 0, 5], [0, 1, 3]])).toEqual([[0, 0, 0], [1, 0, 5], [0, 1, 3], [1, 1, 0]]);
  });
  it("un indice -1 (valore non fra le colonne o le righe) non crea celle fuori griglia", () => {
    expect(grigliaCompleta(1, 1, [[-1, 0, 9]])).toEqual([[0, 0, 0]]);
  });
});

describe("K17 — i punti del codice", () => {
  it("le due mappe di calore delle competenze completano la griglia e non disegnano le bande", () => {
    for (const p of ["app/(authenticated)/analytics/skills/page.tsx", "app/(authenticated)/analytics/skills-by-category/page.tsx"]) {
      const s = leggi(p);
      expect(s).toContain("grigliaCompleta(x.length, y.length");
      expect(s).not.toContain("splitArea: { show: true }");
      expect(s).not.toMatch(/fontSize: (?:[0-9]|1[01])\b/);
    }
  });

  it("Persone per titolo di posizione: barre orizzontali, niente etichette ruotate", () => {
    const s = leggi("app/(authenticated)/analytics/workforce/page.tsx");
    expect(s).not.toContain("rotate:");
    expect(s).not.toContain("verticalBarOption");
    expect(s).toContain("horizontalBarOption(d.byJobRole");
  });

  it("il client dei grafici colora i numeri delle celle e mette in cima il nome di un asse verticale di categorie", () => {
    const s = leggi("app/(authenticated)/_charts-client.tsx");
    expect(s).toContain("etichetteLeggibiliMappaDiCalore(option");
    expect(s).toMatch(/verticale && ax\.type === "category"[\s\S]{0,200}nameLocation: "end"/);
  });
});
