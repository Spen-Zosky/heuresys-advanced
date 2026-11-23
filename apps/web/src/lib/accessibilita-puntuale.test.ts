/**
 * Classe K13 del controllo forense del 23/11/2026 (accessibilità puntuale) e campi senza nome di K10.
 * Prove statiche sul sorgente: la regola axe che le ha trovate gira solo nel giro dal vivo, qui si
 * tiene ferma la causa perché non torni.
 *   · A-heading-order: `CardTitle` di @heuresys/ui è un h3 se non si dice altro, e sotto l'h1 della
 *     pagina salta un livello. Ogni CardTitle dichiara il suo livello.
 *   · A-empty-table-header: nessuna intestazione di colonna vuota; la colonna dei comandi ha un nome
 *     per i lettori di schermo.
 *   · A-label, A-select-name: i campi della candidatura hanno un nome.
 *   · A-link-in-text-block: un collegamento dentro una frase è sottolineato, non solo colorato.
 *   · A-page-has-heading-one: le pagine hanno l'h1 anche mentre caricano o in errore.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const radice = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(radice, rel), "utf8");

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : n.endsWith(".tsx") ? [p] : [];
  });
}

describe("accessibilità puntuale (K13)", () => {
  const file = tsx(radice);

  it("ogni CardTitle dichiara il livello del titolo", () => {
    const colpe = file.flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(/<CardTitle(?=[\s>])[^>]*>/g)].filter((m) => !/\bas=/.test(m[0])).map(() => p.slice(radice.length)),
    );
    expect(colpe).toEqual([]);
  });

  it("le sezioni del faldone sono h2, sotto l'h1 della pagina", () => {
    expect(leggi("components/faldone-vista.tsx")).not.toMatch(/<CardTitle as="h[3-6]"/);
  });

  it("nessuna intestazione di colonna vuota", () => {
    const colpe = file.filter((p) => /<th(\s+className="[^"]*")?\s*\/>|<th(\s+className="[^"]*")?>\s*<\/th>/.test(readFileSync(p, "utf8")));
    expect(colpe.map((p) => p.slice(radice.length))).toEqual([]);
  });

  it("i campi della candidatura hanno un nome", () => {
    const s = leggi("app/(authenticated)/recruiting/applications/[id]/page.tsx");
    const colpe = [...s.matchAll(/<(select|Input|textarea)\b[^>]*>/g)].filter((m) => {
      if (/\baria-label=/.test(m[0])) return false;
      const prima = s.slice(0, m.index);
      return prima.lastIndexOf("<label") <= prima.lastIndexOf("</label>");
    }).map((m) => m[0].slice(0, 60));
    expect(colpe).toEqual([]);
  });

  it("il collegamento dentro la frase della visualizzazione è sottolineato", () => {
    const s = leggi("app/(authenticated)/visualizations/[graphId]/page.tsx");
    const link = s.match(/<Link href="\/organization\/org-chart" className="([^"]*)"/);
    expect((link?.[1] ?? "").split(/\s+/)).toContain("underline");
  });

  it("le pagine hanno l'h1 anche mentre caricano o in errore", () => {
    for (const rel of ["app/(authenticated)/analytics/skills-by-category/page.tsx", "app/(authenticated)/me/surveys/[surveyId]/page.tsx"]) {
      expect((leggi(rel).match(/<PageHeader\b/g) ?? []).length, rel).toBeGreaterThanOrEqual(3);
    }
  });
});
