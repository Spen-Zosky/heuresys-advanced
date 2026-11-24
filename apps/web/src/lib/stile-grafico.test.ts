/**
 * apps/web/src/lib/stile-grafico.test.ts — K17 del controllo forense del 23/11/2026, resto della
 * classe dopo #459: lo stile dei grafici visto dal vivo il 24/11/2026.
 *
 * Tre difetti, con le schermate del giro: (1) i grafici di /analytics/kpi, /analytics/skills-group-share
 * e del risultato di un sondaggio avevano la griglia bianca piena e le etichette nel grigio di ECharts
 * (#6E7079, 3,6:1 sul fondo scuro), perché le loro opzioni non dichiarano colori e solo le pagine
 * che li scrivevano a mano erano nel tema; (2) nel sondaggio il nome dell'asse orizzontale «Media»
 * stava in fondo all'asse ed era tagliato al bordo destro; (3) in skills-group-share l'asse dei
 * conteggi segnava 0,5 e 1,5. Le regole sono una sola, in `EChartsCard`, per tutti i grafici: qui le
 * funzioni pure, e i punti del codice che le devono usare letti dal sorgente (l'ambiente di prova
 * non monta React).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { barreOrizzontali } from "./altezza-grafico";
import { contrasto, leggiColore } from "./colori-grafico";
import { CONTRASTO_MINIMO, assiInteri, conStileDelTema, nomiDegliAssiInVista, type ColoriTema } from "./stile-grafico";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** I token dei due temi letti dal foglio di stile della libreria, non ricopiati qui. */
function temi(): Record<"chiaro" | "scuro", ColoriTema> {
  const css = fs.readFileSync(createRequire(__filename).resolve("@heuresys/ui/theme"), "utf8");
  const blocco = (selettore: string) => {
    const i = css.indexOf(`\n${selettore} {`);
    const corpo = css.slice(i, css.indexOf("}", i));
    const v = (n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{3,6})`).exec(corpo)?.[1] ?? "";
    return { testo: v("foreground"), testoTenue: v("muted-foreground"), bordo: v("border"), fondo: v("background") };
  };
  return { chiaro: blocco(":root"), scuro: blocco(".dark") };
}

type Asse = { axisLabel?: { color?: string }; nameTextStyle?: { color?: string }; splitLine?: { lineStyle?: { color?: string } }; axisLine?: { lineStyle?: { color?: string } } };
const rapporto = (a: string | undefined, b: string) => contrasto(leggiColore(a ?? "")!, leggiColore(b)!);

describe("K17 — i grafici senza colori propri prendono quelli del tema", () => {
  const tutti = temi();
  it("i token dei due temi si leggono", () => {
    for (const t of Object.values(tutti)) for (const v of Object.values(t)) expect(v).toMatch(/^#/);
  });
  it.each(["chiaro", "scuro"] as const)("barre orizzontali (kpi, skills-group-share) nel tema %s", (nome) => {
    const tema = tutti[nome];
    const o = conStileDelTema(barreOrizzontali({ y: ["Produttività", "Qualità"], series: [{ name: "Raggiungimento", values: [83, 99] }] }), tema) as unknown as {
      xAxis: Asse; yAxis: Asse; legend: { textStyle?: { color?: string } };
    };
    // la griglia del tema, non il bianco di ECharts
    expect(o.xAxis.splitLine?.lineStyle?.color).toBe(tema.bordo);
    expect(o.yAxis.axisLine?.lineStyle?.color).toBe(tema.bordo);
    for (const testo of [o.xAxis.axisLabel?.color, o.yAxis.axisLabel?.color, o.legend.textStyle?.color]) {
      expect(testo).toBe(tema.testoTenue);
      expect(rapporto(testo, tema.fondo)).toBeGreaterThanOrEqual(CONTRASTO_MINIMO);
    }
  });
  it("il grigio di ECharts sul fondo scuro non arriva a 4,5:1: è il difetto visto", () => {
    expect(rapporto("#6E7079", temi().scuro.fondo)).toBeLessThan(CONTRASTO_MINIMO);
  });
  it("un testo che una pagina dichiara poco leggibile sul fondo passa al grigio tenue del tema", () => {
    const tema = temi().scuro;
    const o = conStileDelTema({ xAxis: { type: "value", axisLabel: { color: "#6E7079" }, nameTextStyle: { color: "#333333" } } }, tema) as { xAxis: Asse };
    expect(o.xAxis.axisLabel?.color).toBe(tema.testoTenue);
    expect(o.xAxis.nameTextStyle?.color).toBe(tema.testoTenue);
  });
  it("e al primo piano se nemmeno il grigio tenue arriva a 4,5:1", () => {
    const tema = { ...temi().scuro, testoTenue: "#3A3F4A" };
    const o = conStileDelTema({ xAxis: { type: "value" } }, tema) as { xAxis: Asse };
    expect(o.xAxis.axisLabel?.color).toBe(tema.testo);
  });
  it("un colore che la pagina dichiara e che si legge resta il suo", () => {
    const tema = temi().scuro;
    const o = conStileDelTema({ yAxis: { type: "value", axisLabel: { color: "#FFFFFF" }, splitLine: { lineStyle: { color: "#123456" } } } }, tema) as { yAxis: Asse };
    expect(o.yAxis.axisLabel?.color).toBe("#FFFFFF");
    expect(o.yAxis.splitLine?.lineStyle?.color).toBe("#123456");
  });
  it("anche gli assi in elenco, la legenda e la scala di una mappa di calore", () => {
    const tema = temi().chiaro;
    const o = conStileDelTema({ yAxis: [{ type: "value" }, { type: "value" }], legend: [{}], visualMap: { min: 0, max: 1 } }, tema) as unknown as {
      yAxis: Asse[]; legend: { textStyle?: { color?: string } }[]; visualMap: { textStyle?: { color?: string } };
    };
    expect(o.yAxis.map((a) => a.axisLabel?.color)).toEqual([tema.testoTenue, tema.testoTenue]);
    expect(o.legend[0]?.textStyle?.color).toBe(tema.testoTenue);
    expect(o.visualMap.textStyle?.color).toBe(tema.testoTenue);
  });
});

describe("K17 — i conteggi hanno tacche intere", () => {
  it("skills-group-share: conteggi 1 e 2, nessuna tacca a 0,5", () => {
    const o = assiInteri(barreOrizzontali({ y: ["a", "b", "c"], series: [{ name: "Competenze", values: [2, 1, 1] }] })) as { xAxis: { minInterval?: number } };
    expect(o.xAxis.minInterval).toBe(1);
  });
  it("valori con decimali (la media di un sondaggio) restano liberi", () => {
    const o = assiInteri({ xAxis: { type: "value" }, yAxis: { type: "category", data: ["a"] }, series: [{ type: "bar", data: [7.6, 8] }] }) as { xAxis: { minInterval?: number } };
    expect(o.xAxis.minInterval).toBeUndefined();
  });
  it("le coppie e gli oggetti con valore contano; l'asse di categorie no; un minInterval della pagina resta", () => {
    const o = assiInteri({
      xAxis: { type: "category", data: ["a"] },
      yAxis: [{ type: "value" }, { type: "value", minInterval: 5 }],
      series: [{ type: "line", data: [["a", 3], { value: 4 }, null] }],
    }) as { xAxis: { minInterval?: number }; yAxis: { minInterval?: number }[] };
    expect(o.xAxis.minInterval).toBeUndefined();
    expect(o.yAxis.map((a) => a.minInterval)).toEqual([1, 5]);
  });
  it("senza numeri non decide niente", () => {
    const o = assiInteri({ yAxis: { type: "value" }, series: [{ type: "bar", data: [] }] }) as { yAxis: { minInterval?: number } };
    expect(o.yAxis.minInterval).toBeUndefined();
  });
});

describe("K17 — il nome di un asse sta dentro il riquadro", () => {
  it("sondaggio: «Media» a metà dell'asse orizzontale, con il posto sotto", () => {
    const o = nomiDegliAssiInVista({
      grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "value", name: "Media", max: 10 },
      yAxis: { type: "category", data: ["Domanda"] },
    }) as { grid: { bottom: number }; xAxis: { nameLocation?: string; nameGap?: number } };
    expect(o.xAxis.nameLocation).toBe("middle");
    expect(o.xAxis.nameGap).toBeGreaterThan(0);
    expect(o.grid.bottom).toBeGreaterThanOrEqual(40);
  });
  it("il nome in cima a un asse verticale ha il posto sopra; una posizione scelta dalla pagina resta", () => {
    const o = nomiDegliAssiInVista({
      grid: { top: 8, bottom: "10%" },
      xAxis: { type: "category", name: "Mese", nameLocation: "middle", nameGap: 30 },
      yAxis: { type: "value", name: "Ore" },
    }) as { grid: { top: number; bottom: string }; xAxis: { nameGap?: number } };
    expect(o.grid.top).toBeGreaterThanOrEqual(28);
    expect(o.grid.bottom).toBe("10%");
    expect(o.xAxis.nameGap).toBe(30);
  });
});

describe("K17 — EChartsCard applica le tre regole a ogni grafico", () => {
  const s = leggi("app/(authenticated)/_charts-client.tsx");
  it("le regole di impaginazione entrano in rendiLeggibile, quella dei colori dopo la risoluzione delle variabili", () => {
    expect(s).toMatch(/assiInteri\(nomiDegliAssiInVista\(/);
    expect(s).toMatch(/conColoriDelTema\(resolveCssVars\(/);
    expect(s).toContain("return conStileDelTema(option, {");
    expect(s).toContain('testoTenue: v("--muted-foreground")');
    expect(s).toContain('fondo: v("--background")');
  });
  it("nessun grafico scrive a mano colori di griglia fuori dal tema", () => {
    const pagine = ["career-succession/page.tsx"];
    for (const p of pagine) expect(leggi(`app/(authenticated)/${p}`)).not.toMatch(/lineStyle: \{ color: "#/);
  });
});
