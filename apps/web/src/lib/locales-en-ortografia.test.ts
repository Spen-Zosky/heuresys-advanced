import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Classe «varianti inglesi miste» (28/11: la linguetta diceva «Organization» e il menu «Organisation»).
 * Le stringhe in inglese usano l'ortografia americana, ovunque. I nomi propri ufficiali restano come sono.
 */
const BRITANNICHE = /\b(organis\w*|catalogue\w*|programme\w*|judgement\w*|behaviour\w*|colour\w*|centre\w*|modelling|enrolment\w*|visualis\w*|unrecognis\w*|summaris\w*|standardis\w*|recognis\w*|penalis\w*|maximis\w*|minimis\w*|authoris\w*|anonymis\w*|grey|favour\w*|normalis\w*|finalis\w*|prioritis\w*|optimis\w*|customis\w*)\b/gi;
const NOMI_PROPRI = ["International Labour Organization"];

const dir = path.resolve(__dirname, "..", "locales", "en");

function valori(x: unknown, fuori: string[]): void {
  if (typeof x === "string") fuori.push(x);
  else if (Array.isArray(x)) x.forEach((v) => valori(v, fuori));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => valori(v, fuori));
}

describe("locales/en: ortografia americana", () => {
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    it(`${f} non ha forme britanniche`, () => {
      const testi: string[] = [];
      valori(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), testi);
      const trovate = testi.flatMap((t) => {
        let pulito = t;
        for (const n of NOMI_PROPRI) pulito = pulito.split(n).join("");
        return pulito.match(BRITANNICHE) ?? [];
      });
      expect([...new Set(trovate.map((x) => x.toLowerCase()))].sort()).toEqual([]);
    });
  }
  it("il testo della guida Backstage in inglese usa «organization»", () => {
    const s = fs.readFileSync(path.resolve(__dirname, "..", "app", "(authenticated)", "organization", "backstage", "_components", "guida-testi.ts"), "utf8");
    expect(s.match(/organisation/gi)).toBeNull();
  });
});
