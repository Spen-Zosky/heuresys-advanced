/**
 * apps/web/src/lib/variabili-css-grafico.test.ts — K17, tema chiaro (giro del 24/11/2026).
 *
 * Il difetto visto. In tema chiaro le mappe di calore di /analytics/skills e
 * /analytics/skills-by-category erano nere con i numeri quasi invisibili, e nell'anello «Richieste per
 * stato» di /analytics/overtime la fetta «Approvata» e la sua voce di legenda erano nere. In tema
 * scuro no. La causa: `applyPalette` di @heuresys/ui scrive in linea su <html> le `--palette-1..4`
 * come terne HSL nude («222 80% 50%»), mentre il foglio di stile le dà in esadecimale; in tema scuro
 * vince `.dark { --palette-1: #5E9DF5 !important }`, in chiaro resta la terna. `hsl(var(--palette-1))`
 * diventava così «222 80% 50%» e `hsl(var(--palette-1) / 0.12)` restava non valido: il canvas di
 * ECharts colora di nero (o del colore di prima) ciò che non legge.
 *
 * Dalla 1.7.2 di @heuresys/ui `applyPalette` scrive esadecimali `#RRGGBB` in entrambi i temi, e la
 * regola della libreria è una sola: `var(--palette-N)` diretta, o `color-mix(in oklab, var(--palette-N)
 * 12%, transparent)` per la trasparenza, mai dentro `hsl(...)`. Le pagine dei grafici sono state portate
 * a quella forma, e il risolutore legge anche `color-mix` (il canvas non lo capisce).
 *
 * La prova vale per la classe: ogni variabile che i grafici usano, nelle tre forme in cui le pagine la
 * scrivono, nei due temi e con ognuna delle quattro tavolozze, deve diventare un colore che si legge.
 * I valori vengono dalla libreria installata (foglio di stile e `PALETTES`), non ricopiati qui.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PALETTES } from "@heuresys/ui";
import { contrasto, etichetteLeggibiliMappaDiCalore, leggiColore, sopra } from "./colori-grafico";
import { risolviVariabiliCss } from "./variabili-css-grafico";

/** Le variabili di un blocco del foglio di stile della libreria, senza `!important`. */
function variabili(css: string, selettore: string): Record<string, string> {
  const i = css.indexOf(`\n${selettore} {`);
  const corpo = css.slice(i, css.indexOf("}", i));
  const out: Record<string, string> = {};
  for (const m of corpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.replace(/!important/, "").trim();
  return out;
}

const CSS = fs.readFileSync(createRequire(__filename).resolve("@heuresys/ui/theme"), "utf8");
const RADICE = variabili(CSS, ":root");
const SCURO = variabili(CSS, ".dark");

/** Il tema come lo vede il browser: in chiaro le `--palette-*` in linea vincono su `:root`; in scuro
 *  vince `.dark`, che le dichiara `!important`. */
function tema(nome: "chiaro" | "scuro", tavolozza: number): Record<string, string> {
  const inLinea = Object.fromEntries(PALETTES[tavolozza]!.vars.map((v, i) => [`--palette-${i + 1}`, v]));
  return nome === "chiaro" ? { ...RADICE, ...inLinea } : { ...RADICE, ...inLinea, ...SCURO };
}

/** Le variabili che le pagine dei grafici passano a ECharts (censite con grep in src/app). */
const USATE = ["--palette-1", "--palette-2", "--palette-3", "--palette-4", "--muted-foreground", "--border", "--muted", "--foreground", "--card", "--card-foreground", "--background", "--primary", "--success", "--warning", "--danger"];

const CASI = (["chiaro", "scuro"] as const).flatMap((t) => PALETTES.map((_, i) => [t, i] as const));

describe("K17 — ogni variabile dei grafici diventa un colore che il canvas legge", () => {
  it("dalla 1.7.2 la tavolozza in linea è un esadecimale in entrambi i temi, per le quattro tavolozze", () => {
    for (const [nome, tavolozza] of CASI) {
      for (let n = 1; n <= 4; n++) expect(tema(nome, tavolozza)[`--palette-${n}`], `${nome} ${tavolozza} --palette-${n}`).toMatch(/^#[0-9A-F]{6}$/i);
    }
    // «Cool ocean» in chiaro: la terna «178 75% 42%» della 1.7.1 è ora #1BBBB6 (me-preferences.spec.ts)
    expect(tema("chiaro", 1)["--palette-1"]).toBe("#1BBBB6");
  });

  it("la forma color-mix() con transparent diventa rgba() con la trasparenza data", () => {
    expect(risolviVariabiliCss("color-mix(in oklab, var(--palette-1) 12%, transparent)", () => "#1BBBB6")).toBe("rgba(27, 187, 182, 0.12)");
    expect(risolviVariabiliCss("color-mix(in srgb, var(--x) 50%, transparent)", () => "#000000")).toBe("rgba(0, 0, 0, 0.5)");
  });

  it.each(CASI)("tema %s, tavolozza %i: var(), hsl(var()), hsl(var() / 0.12) e color-mix()", (nome, tavolozza) => {
    const t = tema(nome, tavolozza);
    for (const v of USATE) {
      const [nuda, avvolta, chiara, mista] = risolviVariabiliCss(
        [`var(${v})`, `hsl(var(${v}))`, `hsl(var(${v}) / 0.12)`, `color-mix(in oklab, var(${v}) 12%, transparent)`],
        (n) => t[n] ?? "",
      );
      for (const c of [nuda, avvolta, chiara, mista]) expect(leggiColore(c!), `${v} → ${c}`).not.toBeNull();
      expect(leggiColore(chiara!)!.a, `${v} → ${chiara}`).toBeCloseTo(0.12);
      expect(leggiColore(mista!)!.a, `${v} → ${mista}`).toBeCloseTo(0.12);
    }
  });

  it("la terna diventa il colore giusto, con e senza trasparenza", () => {
    const leggi = () => "222 80% 50%";
    expect(risolviVariabiliCss("hsl(var(--palette-1))", leggi)).toBe("#1A57E6");
    expect(risolviVariabiliCss("hsl(var(--palette-1) / 0.12)", leggi)).toBe("rgba(26, 87, 230, 0.12)");
    expect(risolviVariabiliCss("var(--palette-1)", leggi)).toBe("#1A57E6");
  });

  it("anche le forme moderne della terna: gradi, virgole, trasparenza dentro", () => {
    expect(risolviVariabiliCss("hsl(var(--x))", () => "222deg 80% 50%")).toBe("#1A57E6");
    expect(risolviVariabiliCss("hsl(var(--x))", () => "222, 80%, 50%")).toBe("#1A57E6");
    expect(risolviVariabiliCss("hsl(var(--x))", () => "222 80% 50% / 0.5")).toBe("rgba(26, 87, 230, 0.5)");
    expect(risolviVariabiliCss("hsl(var(--x) / 20%)", () => "hsl(222 80% 50%)")).toBe("rgba(26, 87, 230, 0.2)");
  });

  it("ciò che è già un colore completo resta com'era", () => {
    expect(risolviVariabiliCss("hsl(var(--x))", () => "#5E9DF5")).toBe("#5E9DF5");
    expect(risolviVariabiliCss("hsl(var(--x) / 0.12)", () => "#5E9DF5")).toBe("rgba(94, 157, 245, 0.12)");
    expect(risolviVariabiliCss("var(--x)", () => "oklch(0.6 0.2 22)")).toBe("oklch(0.6 0.2 22)");
    expect(risolviVariabiliCss("var(--x)", () => "")).toBe("transparent");
  });
});

describe("K17 — mappa di calore in tema chiaro: scala visibile e numeri leggibili", () => {
  it.each(PALETTES.map((_, i) => i))("tavolozza %i", (tavolozza) => {
    const t = tema("chiaro", tavolozza);
    const leggi = (n: string) => t[n] ?? "";
    const valori = [0, 1, 2, 3, 4, 5];
    const opzione = risolviVariabiliCss(
      {
        visualMap: { min: 0, max: 5, inRange: { color: ["color-mix(in oklab, var(--palette-1) 12%, transparent)", "var(--palette-1)"] } },
        series: [{ type: "heatmap", data: valori.map((v, i) => [i, 0, v]) }],
      },
      leggi,
    );
    const fondo = leggiColore(t["--card"]!)!;
    // la cella piena ha il colore della tavolozza, non il nero
    const piena = sopra(leggiColore(opzione.visualMap.inRange.color[1]!)!, fondo);
    expect(Math.max(piena.r, piena.g, piena.b)).toBeGreaterThan(60);
    const conTesti = etichetteLeggibiliMappaDiCalore(opzione, { fondo: t["--card"]!, testi: [t["--foreground"]!, t["--background"]!, "#000000", "#FFFFFF"] });
    const dati = (conTesti.series[0] as unknown as { data: { label?: { color?: string } }[] }).data;
    dati.forEach((d, i) => {
      expect(d.label?.color, `cella ${i}`).toBeDefined();
      const tappe = opzione.visualMap.inRange.color.map((c) => leggiColore(c)!);
      const f = valori[i]! / 5;
      const mix = { r: tappe[0]!.r + (tappe[1]!.r - tappe[0]!.r) * f, g: tappe[0]!.g + (tappe[1]!.g - tappe[0]!.g) * f, b: tappe[0]!.b + (tappe[1]!.b - tappe[0]!.b) * f, a: tappe[0]!.a + (tappe[1]!.a - tappe[0]!.a) * f };
      expect(contrasto(leggiColore(d.label!.color!)!, sopra(mix, fondo))).toBeGreaterThanOrEqual(4.5);
    });
  });
});

/** Il codice dell'applicazione senza commenti, escluse le prove (che citano le forme vecchie apposta). */
function sorgenti(dir: string): { file: string; testo: string }[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return sorgenti(p);
    if (!/\.(tsx?|css)$/.test(d.name) || /\.test\.tsx?$/.test(d.name)) return [];
    // i commenti raccontano le forme vecchie: si guarda solo il codice
    const testo = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    return [{ file: path.relative(SRC, p), testo }];
  });
}
const SRC = path.resolve(__dirname, "..");

describe("@heuresys/ui 1.7.2 — le tavolozze si usano come esadecimali", () => {
  it("nessun sorgente avvolge una --palette-N in hsl(...)", () => {
    const fuori = sorgenti(SRC).filter((f) => /hsla?\(\s*var\(--palette-/.test(f.testo)).map((f) => f.file);
    expect(fuori).toEqual([]);
  });

  it("ogni --palette-N citata nei sorgenti esiste nel tema della libreria", () => {
    const citate = new Set(sorgenti(SRC).flatMap((f) => [...f.testo.matchAll(/--palette-(\d+)(?![\d-])/g)].map((m) => `--palette-${m[1]}`)));
    // la forma a modello `--palette-${n}` si espande sui valori che la pagina dei compensi usa
    const compensi = sorgenti(SRC).find((f) => f.file.endsWith(path.join("analytics", "compensation", "page.tsx")))!;
    const indici = /const PALETTE = \[([0-9, ]+)\]/.exec(compensi.testo)![1]!.split(",").map((x) => x.trim());
    for (const i of indici) citate.add(`--palette-${i}`);
    const mancanti = [...citate].filter((v) => !(v in RADICE));
    expect(mancanti).toEqual([]);
  });
});
