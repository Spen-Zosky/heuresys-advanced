/**
 * apps/web/src/lib/altezza-grafico.test.ts — K17 del controllo forense del 23/11/2026, resto della
 * classe dopo #452: l'altezza dei grafici con l'asse verticale di categorie.
 *
 * In /analytics/skills la mappa «Copertura per unità e livello di padronanza» ha 37 unità, e con 26 px
 * per unità le etichette che vanno a capo su due righe si sovrapponevano. Due parti, come
 * `matrice-e-grafici.test.ts`: le regole pure (il conto di `altezzaGrafico`), e i punti del codice
 * che le devono usare, letti dal sorgente (l'ambiente di prova non monta React): un caso per grafico.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALTEZZA_RIGA_ETICHETTA, altezzaGrafico, barreOrizzontali, righeEtichetta } from "./altezza-grafico";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

// Le 37 unità di RTL Bank come le mostra la mappa in produzione il 24/11/2026 (prime righe dalla
// schermata, le altre completate con nomi della stessa forma).
const UNITA = [
  "Divisione Finanza e Amministrazione", "Divisione Crediti", "Direzione Istruttoria ed Erogazione", "RTL Bank S.p.A.",
  "Divisione Risorse Umane e Organizzazione", "Divisione Retail Banking", "Divisione Operations", "Divisione IT & Digital",
  "Ufficio Sviluppo, Formazione e Organizzazione", "Direzione Compliance e Protezione Dati", "Direzione Antiriciclaggio",
  "Direzione Infrastrutture", "Divisione Marketing e Comunicazione", "Direzione Affari Legali e Societari",
  "Direzione Sviluppo Software e Canali Digitali", "Direzione Gestione dei Rischi", "Ufficio Crediti Retail", "Filiale Varese",
  "Direzione Pagamenti", "Direzione Internal Audit", "Direzione Tesoreria e Mercati", "Direzione Bilancio e Segnalazioni",
  "Filiale Dalmine", "Ufficio Crediti PMI", "Filiale Como", "Direzione Coordinamento Commerciale", "Filiale Monza",
  "Direzione Back Office", "Direzione Governo e Supporto Rete", "Filiale Sesto San Giovanni", "Filiale Brescia Centro",
  "Filiale Bergamo Centro", "Filiale Milano Centro", "Filiale Milano Porta Romana", "Filiale Milano Sempione",
  "Direzione Monitoraggio e Crediti Deteriorati", "Ufficio Amministrazione del Personale",
];

/** L'opzione della mappa di /analytics/skills come la vede EChartsCard dopo `rendiLeggibile`. */
function mappaUnita(larghezza = 160) {
  return {
    grid: { left: 8, right: 16, top: 12, bottom: 64, containLabel: true },
    xAxis: { type: "category", data: ["Base", "Intermedio", "Avanzato", "Esperto"] },
    yAxis: { type: "category", data: UNITA, axisLabel: { width: larghezza, overflow: "break", interval: 0, lineHeight: ALTEZZA_RIGA_ETICHETTA } },
    series: [{ type: "heatmap", data: [] }],
  };
}

describe("K17 — righe di un'etichetta che va a capo", () => {
  it("un nome corto sta su una riga, uno lungo ne prende due", () => {
    expect(righeEtichetta("Filiale Como", 160)).toBe(1);
    expect(righeEtichetta("Ufficio Sviluppo, Formazione e Organizzazione", 160)).toBeGreaterThanOrEqual(2);
  });
  it("una parola più larga della riga si spezza", () => {
    expect(righeEtichetta("x".repeat(60), 120)).toBeGreaterThan(1);
  });
  it("senza larghezza non va a capo", () => {
    expect(righeEtichetta("Ufficio Sviluppo, Formazione e Organizzazione", 0)).toBe(1);
  });
});

describe("K17 — altezza di un grafico con l'asse verticale di categorie", () => {
  it("le 37 unità di /analytics/skills hanno ciascuna lo spazio delle sue righe di testo", () => {
    const o = mappaUnita();
    const h = altezzaGrafico(o, 360);
    const righe = Math.max(...UNITA.map((u) => righeEtichetta(u, 160)));
    const passo = (h - o.grid.top - o.grid.bottom - 24) / UNITA.length;
    expect(righe).toBeGreaterThanOrEqual(2);
    expect(passo).toBeGreaterThanOrEqual(righe * ALTEZZA_RIGA_ETICHETTA + 8);
    // il conto a mano di prima (26 px per unità) non bastava
    expect(h).toBeGreaterThan(UNITA.length * 26);
  });
  it("cresce con il numero delle righe", () => {
    const poche = { ...mappaUnita(), yAxis: { ...mappaUnita().yAxis, data: UNITA.slice(0, 10) } };
    expect(altezzaGrafico(mappaUnita(), 0)).toBeGreaterThan(altezzaGrafico(poche, 0));
  });
  it("non scende sotto il minimo della pagina", () => {
    const una = { ...mappaUnita(), yAxis: { ...mappaUnita().yAxis, data: ["Filiale Como"] } };
    expect(altezzaGrafico(una, 280)).toBe(280);
  });
  it("un grafico senza asse verticale di categorie resta al minimo", () => {
    expect(altezzaGrafico({ xAxis: { type: "category", data: UNITA }, yAxis: { type: "value" }, series: [] }, 320)).toBe(320);
    expect(altezzaGrafico({ series: [{ type: "pie", data: [] }] }, 260)).toBe(260);
  });
  it("le barre orizzontali mettono le categorie sull'asse verticale, la prima in cima", () => {
    const o = barreOrizzontali({ y: ["a", "b"], series: [{ name: "s", values: [1, 2] }] });
    expect(o.yAxis).toMatchObject({ type: "category", data: ["a", "b"], inverse: true });
    expect(o.xAxis.type).toBe("value");
  });
});

describe("K17 — EChartsCard fa crescere l'altezza", () => {
  const s = leggi("app/(authenticated)/_charts-client.tsx");
  it("l'altezza passata al grafico è quella di altezzaGrafico", () => {
    expect(s).toMatch(/altezzaGrafico\(rendiLeggibile\(conNomiDegliAssi\(props\.option, assi\), locale, stretto\), props\.height, misura \?\? undefined\)/);
    // la misura vera del browser, con il carattere di ECharts
    expect(s).toContain("ctx.font = `${corpo}px sans-serif`");
    expect(s).toContain("<RawEChartsCard {...props} height={altezza} option={option} />");
  });
  it("sull'asse verticale di categorie ogni etichetta si scrive, con l'interlinea del conto", () => {
    expect(s).toContain("label.interval = 0");
    expect(s).toContain("label.lineHeight = ALTEZZA_RIGA_ETICHETTA");
  });
});

// Un caso per grafico con l'asse di categorie a molte righe: l'altezza della pagina è un minimo
// fisso (la crescita la fa EChartsCard, un conto solo) e le categorie stanno sull'asse verticale.
const GRAFICI: { pagina: string; opzione: string; costruttore?: RegExp }[] = [
  { pagina: "analytics/skills/page.tsx", opzione: "coverageHeatmapOption(" },
  { pagina: "analytics/skills-by-category/page.tsx", opzione: "categoryHeatmapOption(" },
  { pagina: "analytics/attendance/page.tsx", opzione: "ouBarOption(d.byOrgUnit)" },
  { pagina: "analytics/overtime/page.tsx", opzione: "ouBarOption(d.byOrgUnit)" },
  { pagina: "analytics/workforce/page.tsx", opzione: "horizontalBarOption(d.byOrgUnit)" },
  { pagina: "analytics/workforce/page.tsx", opzione: "horizontalBarOption(d.byJobRole" },
  { pagina: "analytics/compensation/page.tsx", opzione: "bandingBoxplotOption(" },
  { pagina: "analytics/kpi/page.tsx", opzione: "barOption}", costruttore: /barOption = barreOrizzontali\(\{\s*y: scored/ },
  { pagina: "analytics/skills-group-share/page.tsx", opzione: "barOption}", costruttore: /barOption = barreOrizzontali\(\{\s*y: barX/ },
  { pagina: "engagement/[surveyId]/page.tsx", opzione: "ratingsBarOption(", costruttore: /yAxis: \{ type: "category" as const, data: rated\.map\(\(q\) => q\.text\), inverse: true \}/ },
];

describe("K17 — ogni grafico a molte categorie", () => {
  it.each(GRAFICI)("$pagina · $opzione", ({ pagina, opzione, costruttore }) => {
    const s = leggi(`app/(authenticated)/${pagina}`);
    const i = s.indexOf(`option={${opzione}`);
    expect(i, "il grafico c'è").toBeGreaterThan(-1);
    const altezza = /height=\{([^}]*)\}/.exec(s.slice(i, i + 400))?.[1];
    expect(altezza, "altezza fissa, la crescita la fa EChartsCard").toMatch(/^\d+$/);
    expect(s).not.toMatch(/height=\{Math\.max\([^}]*\.length \*/);
    // le barre verticali del preset restano dove le categorie sono poche (i quattro livelli di padronanza)
    if (costruttore) {
      expect(s).toMatch(costruttore);
      expect(s).not.toContain("echartsPresets.bar(");
    }
  });
});
