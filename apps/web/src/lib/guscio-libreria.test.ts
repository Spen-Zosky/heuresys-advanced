/**
 * apps/web/src/lib/guscio-libreria.test.ts — adozione di @heuresys/ui 1.7.1 (classi K03, K04, K05 e
 * la parte dei livelli dei titoli di K13 del controllo forense del 23/11/2026).
 *
 * Prove statiche sul sorgente, come `accessibilita-puntuale.test.ts`: l'ambiente di prova non monta
 * React e le regole axe girano solo nel giro dal vivo; qui si tiene ferma la causa.
 *   · K03: il `<main>` lo dà il guscio (`contentLandmark="main"`), una volta sola. Nessuna pagina e
 *     nessun componente montato dentro il guscio ne apre un secondo; il layout lo apre solo nei
 *     ritorni che stanno fuori dal guscio (caricamento ed errore della sessione).
 *   · K04: la dipendenza è almeno la 1.7.1, che dichiara la colonna del guscio e fa cedere l'header.
 *   · K05: il pulsante della ricerca e il collegamento del marchio ricevono testi tradotti; le
 *     etichette della tavolozza, tolta dall'header nella 1.7.1, non si passano più.
 *   · K13: gli stati vuoto ed errore subito sotto l'h1 della pagina, il pannello dell'agente e le
 *     colonne della pipeline sono h2.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const AUT = "app/(authenticated)";
const LAYOUT = `${AUT}/layout.tsx`;

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : n.endsWith(".tsx") ? [p] : [];
  });
}

const apreMain = (s: string) => /<main[\s>]/.test(s);

describe("K03 — un solo main, dato dal guscio", () => {
  it("il layout passa contentLandmark=\"main\" al guscio", () => {
    expect(leggi(LAYOUT)).toMatch(/<DashboardShell\s[^>]*contentLandmark="main"/);
  });

  it("dentro il guscio il layout non apre un altro main (accesso negato compreso)", () => {
    const s = leggi(LAYOUT);
    const guscio = s.slice(s.indexOf("<DashboardShell"));
    expect(apreMain(guscio)).toBe(false);
  });

  it("nessuna pagina autenticata apre un proprio main", () => {
    const colpe = tsx(join(SRC, AUT))
      .filter((p) => !p.endsWith("layout.tsx"))
      .filter((p) => apreMain(readFileSync(p, "utf8")))
      .map((p) => p.slice(SRC.length));
    expect(colpe).toEqual([]);
  });

  it("nessun componente condiviso apre un main", () => {
    const colpe = tsx(join(SRC, "components"))
      .filter((p) => apreMain(readFileSync(p, "utf8")))
      .map((p) => p.slice(SRC.length));
    expect(colpe).toEqual([]);
  });
});

describe("K04 — la libreria che non esce dai 390 px", () => {
  it("la dipendenza è @heuresys/ui ^1.7.1 o successiva", () => {
    const pkg = JSON.parse(readFileSync(join(SRC, "..", "package.json"), "utf8")) as { dependencies: Record<string, string> };
    const [maggiore, minore, correzione] = (pkg.dependencies["@heuresys/ui"] ?? "").replace(/^[\^~]/, "").split(".").map(Number);
    expect([maggiore, minore, correzione].every((n) => Number.isFinite(n))).toBe(true);
    const v = (maggiore ?? 0) * 1e6 + (minore ?? 0) * 1e3 + (correzione ?? 0);
    expect(v).toBeGreaterThanOrEqual(1_007_001);
  });
});

describe("K05 — testi dell'header tradotti", () => {
  const s = leggi(LAYOUT);

  it("il pulsante della ricerca ha il suo segnaposto tradotto", () => {
    expect(s).toMatch(/searchPlaceholder:\s*t\("shell:ui\.\w+"\)/);
    expect(s).toMatch(/commandPalettePlaceholder:\s*t\("shell:ui\.\w+"\)/);
  });

  it("il collegamento del marchio ha la destinazione tradotta", () => {
    expect(s).toMatch(/homeLabel=\{t\("shell:ui\.\w+"\)\}/);
  });

  it("nessuna etichetta della tavolozza, che dalla 1.7.1 non è più nell'header", () => {
    expect(s).not.toMatch(/\bpalette(List|Heading)?\s*:/);
  });
});

describe("K13 — livello dei titoli sotto l'h1 della pagina", () => {
  it("gli stati della pagina inoltrano il livello del titolo a EmptyState ed ErrorState", () => {
    const s = leggi("components/stato-pagina.tsx");
    expect((s.match(/headingLevel=\{livelloTitolo\}|headingLevel: livelloTitolo/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("l'elenco a pagina intera mette gli stati della tabella a h2", () => {
    const s = leggi("components/data-table-panel.tsx");
    const pannello = s.slice(s.indexOf("export function DataTablePanel"));
    expect(pannello).toMatch(/livelloTitoloStati="h2"/);
  });

  it.each([
    `${AUT}/me/inbox/page.tsx`,
    `${AUT}/analytics/skills-graph/page.tsx`,
    `${AUT}/recruiting/page.tsx`,
  ])("%s: gli stati sotto l'h1 sono h2", (rel) => {
    const s = leggi(rel);
    const stati = [...s.matchAll(/<Stato(Vuoto|Errore)\b[^>]*>/g)];
    expect(stati.length).toBeGreaterThan(0);
    expect(stati.filter((m) => !/livelloTitolo="h2"/.test(m[0])).map((m) => m[0].slice(0, 40))).toEqual([]);
  });

  it("/jobs: lo stato vuoto sotto l'h1 è h2", () => {
    expect(leggi("app/jobs/page.tsx")).toMatch(/<EmptyState\b[^>]*headingLevel="h2"/);
  });

  it("/dev/agent: il pannello dell'agente sotto l'h1 è h2", () => {
    expect(leggi(`${AUT}/dev/agent/page.tsx`)).toMatch(/<AgentPanel\b[\s\S]*?headingLevel="h2"/);
  });

  it("/recruiting: le colonne della pipeline sotto l'h1 sono h2", () => {
    expect(leggi(`${AUT}/recruiting/page.tsx`)).toMatch(/<KanbanBoard\b[^>]*columnHeadingLevel="h2"/);
  });
});
