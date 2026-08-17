/**
 * #198 T4 — la sorgente parametrica, e la prova che il confine di E21 esista davvero.
 *
 * Due cose vanno dimostrate, e sono diverse:
 *  (a) il piano dice **le stesse righe** che l'archetipo diceva — un refactoring che cambia
 *      ciò che viene costruito non è un refactoring;
 *  (b) il motore **non conosce più la sorgente** — ed è una proprietà del file, non del
 *      comportamento: si misura leggendo l'import, perché un test funzionale resterebbe
 *      verde anche se il motore continuasse a importare l'archetipo.
 *
 * La (b) è un controllo sul sorgente, che di solito è un criterio debole. Qui misura
 * esattamente la cosa che E21 promette, e nient'altro.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getArchetype, archetypeUsers, synProficiency, synKpiValue } from "../../src/modules/tenant-materialization/blueprints.js";
import { ArchetypeBuildSource } from "../../src/modules/tenant-materialization/build-source.js";

const CHIAVE = "RETAIL_BANK_REFERENCE";
const qui = dirname(fileURLToPath(import.meta.url));
const MOTORE = join(qui, "..", "..", "src", "modules", "tenant-materialization", "repository.ts");

describe("#198 T4 — il piano dice le stesse righe dell'archetipo", () => {
  it("conteggi identici, tabella per tabella", async () => {
    const a = getArchetype(CHIAVE)!;
    const p = await new ArchetypeBuildSource(a).plan();
    expect(p.sourceKey).toBe(a.key);
    expect(p.orgUnits.length).toBe(a.orgUnits.length);
    expect(p.positions.length).toBe(a.positions.length);
    expect(p.skills.length).toBe(a.skills.length);
    expect(p.kpis.length).toBe(a.kpis.length);
    expect(p.incumbents.length).toBe(archetypeUsers(a).length);
  });

  it("le evidenze portano i valori DETERMINISTICI di prima, non altri", async () => {
    const a = getArchetype(CHIAVE)!;
    const p = await new ArchetypeBuildSource(a).plan();
    // il primo titolare, la prima competenza e il primo indicatore: se il refactoring
    // avesse cambiato la regola, questi tre numeri sarebbero altri
    expect(p.incumbents[0]!.skillEvidence[0]).toEqual({
      skillCode: a.skills[0]!.code,
      declaredProficiency: synProficiency(0, 0),
    });
    expect(p.incumbents[0]!.kpiEvidence[0]).toEqual({
      kpiCode: a.kpis[0]!.code,
      measuredValue: synKpiValue(0, 0),
      unit: a.kpis[0]!.unit,
    });
    // e ogni titolare ha una evidenza per ciascuna competenza e ciascun indicatore
    for (const inc of p.incumbents) {
      expect(inc.skillEvidence.length).toBe(a.skills.length);
      expect(inc.kpiEvidence.length).toBe(a.kpis.length);
    }
  });

  it("ogni riga pianificata porta la ragione che la giustifica (serve al registro di P3)", async () => {
    const p = await new ArchetypeBuildSource(getArchetype(CHIAVE)!).plan();
    const tutte = [...p.orgUnits, ...p.positions, ...p.skills, ...p.kpis, ...p.incumbents];
    expect(tutte.length).toBeGreaterThan(0);
    for (const r of tutte) {
      expect(r.justification, JSON.stringify(r).slice(0, 80)).toMatch(/archetipo RETAIL_BANK_REFERENCE/);
    }
  });

  it("una chiave ignota non si risolve — e non ripiega su un archetipo qualsiasi", () => {
    expect(ArchetypeBuildSource.fromKey("NON_ESISTE")).toBeUndefined();
    expect(ArchetypeBuildSource.fromKey(CHIAVE)?.key).toBe(CHIAVE);
  });
});

describe("#198 T4 — il motore non conosce più la sorgente (E21)", () => {
  it("repository.ts non importa l'archetipo", () => {
    const sorgente = readFileSync(MOTORE, "utf8");
    const importa = sorgente
      .split("\n")
      .filter((r) => /^\s*import\b/.test(r))
      .filter((r) => r.includes("blueprints"));
    expect(importa, `il motore importa ancora: ${importa.join(" | ")}`).toHaveLength(0);
  });

  it("CONTROPROVA: il controllo sa vedere un import che c'è davvero", () => {
    // Se il filtro fosse scritto male direbbe «zero» su qualunque file, e il caso sopra
    // sarebbe verde per sempre. Qui si misura su un file che l'archetipo lo importa DAVVERO.
    const sorgente = readFileSync(join(qui, "..", "..", "src", "modules", "tenant-materialization", "build-source.ts"), "utf8");
    const importa = sorgente
      .split("\n")
      .filter((r) => /^\s*import\b/.test(r))
      .filter((r) => r.includes("blueprints"));
    expect(importa.length).toBeGreaterThan(0);
  });
});
