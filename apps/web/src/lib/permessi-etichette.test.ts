import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chiaveEtichetta, risorsaEAzione } from "./permessi-etichette";

/**
 * Classe «codice tecnico al posto del nome» in /admin/roles (giro del 20/11: «agent_request · decidere»).
 * Ogni risorsa dei permessi che l'API richiede con requirePermission("risorsa:azione") deve avere
 * la sua etichetta italiana in admin.json → roles.resources (la chiave è la risorsa con `:`, `.`, `-` → `_`),
 * e lo stesso per l'inglese.
 */
const RADICE = path.resolve(__dirname, "..", "..", "..", "..");
const chiave = chiaveEtichetta;

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

// Classe «due righe con la stessa etichetta» in /admin/roles (28/11: due volte «Assenze · leggere»):
// la colonna azione della tabella dei permessi può essere più corta del codice (`leave:read:self` ha `read`).
// I codici sono quelli richiesti dall'API e quelli seminati dalle migrazioni, con la loro colonna risorsa/azione.
const codici = new Map<string, { risorsa: string; azione: string }>();
for (const p of file(path.join(RADICE, "apps", "api", "src"))) {
  for (const m of fs.readFileSync(p, "utf8").matchAll(/requirePermission\(\s*["']([a-z0-9_-]+):([a-z0-9_:-]+)["']/g)) {
    codici.set(`${m[1]}:${m[2]}`, { risorsa: m[1]!, azione: m[2]! });
  }
}
const dirMig = path.join(RADICE, "db", "migrations");
for (const f of fs.readdirSync(dirMig).filter((x) => x.endsWith(".sql"))) {
  for (const m of fs.readFileSync(path.join(dirMig, f), "utf8").matchAll(
    /\(\s*'([a-z][a-z0-9_-]*:[a-z0-9_:-]+)'\s*,\s*'[^']*'\s*,\s*'([a-z0-9_-]+)'\s*,\s*'([a-z0-9_:-]+)'/g,
  )) {
    codici.set(m[1]!, { risorsa: m[2]!, azione: m[3]! });
  }
}

describe("etichette dei permessi: una per permesso", () => {
  for (const lingua of ["it", "en"]) {
    const d = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "locales", lingua, "admin.json"), "utf8")) as {
      roles: { resources: Record<string, string>; actions: Record<string, string> };
    };
    it(`ogni azione ha il suo nome in ${lingua} e nessuna etichetta si ripete`, () => {
      expect(codici.size).toBeGreaterThan(100);
      const senzaAzione: string[] = [];
      const per = new Map<string, string[]>();
      for (const [codice, c] of codici) {
        const ra = risorsaEAzione(codice, c.risorsa, c.azione);
        const area = d.roles.resources[chiave(ra.risorsa)];
        const azione = d.roles.actions[chiave(ra.azione)];
        if (!azione) senzaAzione.push(codice);
        const etichetta = `${area ?? ra.risorsa} · ${azione ?? ra.azione}`;
        per.set(etichetta, [...(per.get(etichetta) ?? []), codice]);
      }
      expect(senzaAzione.sort()).toEqual([]);
      const doppie = [...per].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.sort().join(", ")}`);
      expect(doppie).toEqual([]);
    });
  }
});
