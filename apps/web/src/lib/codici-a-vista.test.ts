/**
 * apps/web/src/lib/codici-a-vista.test.ts — classi K14 e K19 del controllo forense del 23/11/2026.
 *
 * K14: nella matrice dei ruoli (/admin/roles) i codici dei permessi («user_position_assignment:read»)
 * e dei ruoli («HRMS_MANAGER») stavano nel `title` delle celle, che è testo che una persona legge.
 * Il codice resta nella pagina per chi la controlla, ma in un attributo `data-`.
 *
 * K19: valori enumerati e codici tecnici mostrati come tali in campi e titoli.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { versioneModello } from "./celle-tabella";

const SRC = path.resolve(__dirname, "..");
const leggi = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
const json = (rel: string) => JSON.parse(leggi(rel)) as Record<string, unknown>;

describe("K14 — matrice dei ruoli senza codici a vista", () => {
  const s = leggi("app/(authenticated)/admin/roles/page.tsx");
  it("il codice del ruolo e del permesso non sta nel title", () => {
    expect(s).not.toMatch(/title=\{r\}/);
    expect(s).not.toMatch(/title=\{p\}/);
    expect(s).toContain("data-codice-ruolo={r}");
    expect(s).toContain("data-codice-permesso={p}");
  });
  it("ogni ruolo della matrice ha la sua etichetta nelle due lingue", () => {
    const it_ = (json("locales/it/shell.json").roles ?? {}) as Record<string, string>;
    const en = (json("locales/en/shell.json").roles ?? {}) as Record<string, string>;
    const mancanti = Object.keys(it_).filter((k) => !(k in en)).concat(Object.keys(en).filter((k) => !(k in it_)));
    expect(mancanti).toEqual([]);
  });
});

describe("K19 — codici tecnici in campi e titoli", () => {
  it("il tipo di orario del contratto passa da enumLabel e il codice non sta nel titolo", () => {
    const s = leggi("app/(authenticated)/me/profile/_components/contracts-tab.tsx");
    expect(s).toContain('enumLabel("workScheduleType", c.workScheduleType)');
    expect(s).not.toMatch(/c\.code \?/);
    for (const l of ["it", "en"]) {
      const e = (json(`locales/${l}/common.json`).enums as Record<string, Record<string, string>>).workScheduleType;
      expect(e?.full_time, l).toBeTruthy();
      expect(e?.part_time, l).toBeTruthy();
    }
  });

  it("tenant e visualizzazione non mostrano il codice accanto al nome", () => {
    expect(leggi("app/(authenticated)/tenants/[tenantId]/page.tsx")).not.toContain("{tn.tenantCode}");
    expect(leggi("app/(authenticated)/visualizations/[graphId]/page.tsx")).not.toContain("{g.code}</span>");
  });

  it("lo schema della classe d'attività si legge per nome («ATECO 2025», non «ATECO_2025»)", () => {
    const s = leggi("app/(authenticated)/tenants/[tenantId]/enterprise-typing/page.tsx");
    expect(s).not.toMatch(/\{c\.scheme\}/);
    expect(s).not.toMatch(/\$\{classeScelta\.data\.scheme\}/);
    expect(s).toContain('enumLabel("activityClassScheme"');
  });

  it("il codice ISCO resta testo, non diventa un numero con il separatore delle migliaia", () => {
    const s = leggi("app/(authenticated)/me/matching/page.tsx");
    expect(s).toMatch(/data-grezzo[^>]*>\{m\.iscoCode/);
  });

  it("la versione del modello si legge come versione, non come codice", () => {
    expect(versioneModello("flight-risk-v2")).toBe(2);
    expect(versioneModello("succession-readiness-v1")).toBe(1);
    expect(versioneModello("modello")).toBeNull();
    expect(versioneModello(null)).toBeNull();
    const s = leggi("app/(authenticated)/me/career/_components/risk-tab.tsx");
    expect(s).not.toMatch(/value=\{(flightRisk|s)\.modelVersion\}/);
  });

});
