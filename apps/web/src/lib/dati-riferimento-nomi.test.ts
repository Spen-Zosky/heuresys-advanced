import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Ogni fonte di sincronizzazione dei dati di riferimento ha il nome italiano (e inglese) in admin.json: l'etichetta tecnica dell'API è in inglese. */
const schema = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "packages", "shared", "src", "schemas", "reference-sync.ts"), "utf8");
const fonti = [...(/ReferenceSyncSourceKeyEnum = z\.enum\(\[([^\]]+)\]/.exec(schema)?.[1] ?? "").matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]!);

describe("nomi delle fonti dei dati di riferimento", () => {
  it("l'estrazione trova le fonti", () => expect(fonti.length).toBeGreaterThanOrEqual(3));
  for (const lingua of ["it", "en"]) {
    it(`ogni fonte ha il nome in ${lingua}`, () => {
      const d = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "locales", lingua, "admin.json"), "utf8")) as { datiRiferimento: { nomiFonti: Record<string, string> } };
      expect(fonti.filter((f) => !d.datiRiferimento.nomiFonti[f])).toEqual([]);
    });
  }
});
