import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Classe «codice tecnico al posto del nome» in /admin/roles (giro del 20/11: «agent_request · decidere»).
 * Ogni risorsa dei permessi che l'API richiede con requirePermission("risorsa:azione") deve avere
 * la sua etichetta italiana in admin.json → roles.resources (la chiave è la risorsa con `:`, `.`, `-` → `_`),
 * e lo stesso per l'inglese.
 */
const RADICE = path.resolve(__dirname, "..", "..", "..", "..");
const chiave = (codice: string) => codice.replace(/[:.-]/g, "_");

function file(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "dist" ? [] : file(p);
    return /\.ts$/.test(e.name) ? [p] : [];
  });
}

const risorse = new Set<string>();
for (const p of file(path.join(RADICE, "apps", "api", "src"))) {
  for (const m of fs.readFileSync(p, "utf8").matchAll(/requirePermission\(\s*["']([a-z][a-z0-9_-]*):/g)) risorse.add(m[1]!);
}

describe("etichette delle risorse dei permessi", () => {
  it("l'estrazione trova le risorse (altrimenti il controllo sarebbe vuoto)", () => {
    expect(risorse.size).toBeGreaterThan(20);
  });
  for (const lingua of ["it", "en"]) {
    it(`ogni risorsa con requirePermission ha l'etichetta in ${lingua}`, () => {
      const d = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "locales", lingua, "admin.json"), "utf8")) as {
        roles: { resources: Record<string, string> };
      };
      const mancanti = [...risorse].filter((r) => !(chiave(r) in d.roles.resources)).sort();
      expect(mancanti).toEqual([]);
    });
  }
});
