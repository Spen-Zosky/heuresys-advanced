/**
 * apps/web/src/lib/menu-aperture.test.ts — apertura e chiusura di gruppi e rami della barra
 * laterale (rilievo di Enzo del 2026-11-28, vedi `menu-aperture.ts`).
 *
 * L'ambiente di prova non monta React: le funzioni pure si provano qui, i collegamenti nei
 * componenti e la regola CSS si provano sul sorgente, come `barra-laterale-1440.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catenaVersoPagina, eAperto, impostaTutti, leggiMemoria } from "./menu-aperture";
import type { Ramo } from "./menu-albero";

const SRC = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const voce = (href: string) => ({ id: href, label: href, href, icona: null, ordine: 0 });
const albero: Ramo = {
  chiave: "",
  ordine: 0,
  voci: [voce("/dashboard")],
  rami: [
    {
      chiave: "me_crescita",
      ordine: 1,
      voci: [voce("/me/goals")],
      rami: [{ chiave: "comp", ordine: 2, voci: [voce("/me/skills")], rami: [] }],
    },
  ],
};

describe("memoria delle aperture", () => {
  it("un id assente è aperto, false è chiuso, una memoria illeggibile vale vuota", () => {
    expect(eAperto({}, "nav-x")).toBe(true);
    expect(eAperto({ "nav-x": false }, "nav-x")).toBe(false);
    expect(leggiMemoria("{rotta")).toEqual({});
    expect(leggiMemoria("[1]")).toEqual({});
    expect(leggiMemoria(null)).toEqual({});
  });

  it("chiudi tutti: ogni gruppo principale chiuso, le altre voci intatte", () => {
    const m = impostaTutti({ "nav-a": true, altro: true }, ["nav-a", "nav-b"], false);
    expect(m).toEqual({ "nav-a": false, "nav-b": false, altro: true });
    expect(["nav-a", "nav-b"].every((id) => !eAperto(m, id))).toBe(true);
  });
});

describe("catena verso la pagina attiva", () => {
  it("voce diretta del gruppo: nessun ramo da aprire", () => {
    expect(catenaVersoPagina(albero, "nav-me", "/dashboard")).toEqual([]);
  });
  it("voce in un ramo di terzo livello: i due rami, dal più esterno, con gli id di RamoMenu", () => {
    expect(catenaVersoPagina(albero, "nav-me", "/me/skills")).toEqual(["nav-me/me_crescita", "nav-me/me_crescita/comp"]);
  });
  it("pagina fuori dal gruppo o assente: null", () => {
    expect(catenaVersoPagina(albero, "nav-me", "/altrove")).toBeNull();
    expect(catenaVersoPagina(albero, "nav-me", null)).toBeNull();
  });
});

describe("collegamenti nei componenti", () => {
  const ramo = leggi("components/menu-laterale.tsx");
  const barra = leggi("components/barra-laterale.tsx");
  const css = leggi("app/globals.css");

  it("il ramo della pagina attiva non è più aperto per forza", () => {
    expect(ramo).not.toMatch(/aperto\s*\|\|\s*dentro/);
    expect(ramo).toMatch(/const visibile = eAperto\(/);
  });

  it("il gruppo chiuso si nasconde con data-chiuso, non con la regola del guscio fra fratelli", () => {
    expect(barra).toMatch(/data-chiuso=\{aperto \? undefined : ""\}/);
    expect(css).toMatch(/\.sidebar-group\[data-chiuso\] > \.sidebar-group-content\s*\{\s*display: none;/);
    // a barra ridotta alle sole icone le voci restano tutte visibili
    expect(css).toMatch(/body\[data-sidebar="collapsed"\] aside \.sidebar-group\[data-chiuso\] > \.sidebar-group-content\s*\{\s*display: block;/);
  });

  it("c'è il comando che chiude o riapre tutti i gruppi, tradotto nelle due lingue", () => {
    expect(barra).toMatch(/data-testid="menu-chiudi-apri-tutti"/);
    for (const lingua of ["it", "en"]) {
      const ui = (JSON.parse(leggi(`locales/${lingua}/shell.json`)) as { ui: Record<string, string> }).ui;
      expect(ui.collapseAllGroups).toBeTruthy();
      expect(ui.expandAllGroups).toBeTruthy();
    }
  });
});
