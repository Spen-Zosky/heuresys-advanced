/**
 * apps/web/src/lib/barra-laterale-1440.test.ts — classe K21 del controllo forense del 23/11/2026
 * (barra laterale a 1440 px: etichette a capo lettera per lettera, «NAVIGATION», email spezzata).
 *
 * Rigiudicata dal vivo il 24/11/2026 (sola lettura, tre persone, barra aperta e compressa): le
 * etichette dei gruppi e l'intestazione non vanno più a capo né restano in inglese nella pagina
 * italiana; l'unica causa ancora vera era l'email nel piede della barra compressa a 72 px, scritta
 * con `break-all` e spezzata su quattro o cinque righe («federic / a.marc / hetti@r …»).
 *
 * Prove statiche sul sorgente, come `guscio-libreria.test.ts`: l'ambiente di prova non monta React.
 *   · a barra compressa l'email sparisce, come le altre etichette (`nav-label`, nascosta dal guscio);
 *   · a barra aperta va a capo solo se non ci sta (`break-words`, mai `break-all`) e non si taglia,
 *     per la regola «nessun testo troncato» (`nessun-testo-troncato.test.ts`); intera nel title.
 *   · l'intestazione della barra resta tradotta («Navigazione» in italiano) e i titoli dei gruppi
 *     stanno nel pulsante che il guscio nasconde a barra compressa.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const LAYOUT = leggi("app/(authenticated)/layout.tsx");

function tagEmail(): string {
  const i = LAYOUT.indexOf('data-testid="app-user-email"');
  expect(i).toBeGreaterThan(-1);
  const inizio = LAYOUT.lastIndexOf("<", i);
  return LAYOUT.slice(inizio, LAYOUT.indexOf(">", i) + 1);
}

describe("K21 — email nel piede della barra laterale", () => {
  it("non va a capo a ogni lettera (niente break-all): va a capo solo se non ci sta", () => {
    const tag = tagEmail();
    expect(tag).not.toMatch(/\bbreak-all\b/);
    expect(tag).toMatch(/\bbreak-words\b/);
  });

  it("non si taglia, e l'indirizzo intero sta nel title", () => {
    const tag = tagEmail();
    expect(tag).not.toMatch(/\b(truncate|line-clamp-\d|text-ellipsis)\b/);
    expect(tag).toMatch(/title=\{user\.email\}/);
  });

  it("a barra compressa si nasconde come le altre etichette (nav-label)", () => {
    expect(tagEmail()).toMatch(/\bnav-label\b/);
  });
});

describe("K21 — intestazione e titoli dei gruppi", () => {
  it("l'intestazione della barra è tradotta: «Navigazione» in italiano", () => {
    const it_ = JSON.parse(leggi("locales/it/shell.json")) as { ui: { navigation: string } };
    expect(it_.ui.navigation).toBe("Navigazione");
    expect(LAYOUT).toMatch(/title=\{t\("shell:ui\.navigation"\)\}/);
  });

  it("intestazione e titoli dei gruppi portano le classi che il guscio nasconde a barra compressa", () => {
    const barra = leggi("components/barra-laterale.tsx");
    expect(barra).toMatch(/className="sidebar-section-label[^"]*"/);
    expect(barra).toMatch(/className="sidebar-group-toggle[^"]*"/);
  });
});
