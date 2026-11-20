import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Classe «chiave grezza in pagina» (giro del 20/11: /positions/[id] mostrava
 * `positions.detail.edit.listTruncated` perché la chiave stava sotto `fields`, non sotto `edit`).
 * Ogni `t("chiave")` letterale nel codice deve esistere nel dizionario italiano, nel namespace
 * dichiarato dal file con `useTranslation("ns")` (il primo) o in uno degli altri che il file dichiara.
 * Un file senza `useTranslation` (funzione che riceve `t`) è cercato in tutti i namespace.
 * Le chiavi costruite a runtime (`t(\`a.${x}\`)`) non sono coperte.
 */
const SRC = path.resolve(__dirname, "..");
const IT = path.join(SRC, "locales", "it");

type Nodo = { [k: string]: string | Nodo };
const dizionari: Record<string, Nodo> = {};
for (const f of fs.readdirSync(IT)) {
  if (f.endsWith(".json")) dizionari[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(IT, f), "utf8")) as Nodo;
}

function esiste(ns: string, chiave: string): boolean {
  const cerca = (k: string): boolean => {
    let d: string | Nodo | undefined = dizionari[ns];
    for (const parte of k.split(".")) {
      if (typeof d !== "object" || d === null || !(parte in d)) return false;
      d = d[parte];
    }
    return true;
  };
  return cerca(chiave) || ["_zero", "_one", "_two", "_few", "_many", "_other"].some((s) => cerca(chiave + s));
}

function file(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "locales" || e.name === "node_modules" ? [] : file(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("chiavi i18n usate nel codice e presenti nel dizionario italiano", () => {
  it("nessun t(\"chiave\") letterale punta a una chiave che non esiste", () => {
    const mancanti: string[] = [];
    for (const p of file(SRC)) {
      const s = fs.readFileSync(p, "utf8");
      const nss = [...s.matchAll(/useTranslation\(\s*\[?\s*"(\w+)"/g)].map((m) => m[1]!);
      for (const m of s.matchAll(/\bt\(\s*"([A-Za-z0-9_:.-]+)"/g)) {
        let ns = nss[0];
        let chiave = m[1]!;
        if (chiave.includes(":")) [ns, chiave] = chiave.split(":", 2) as [string, string];
        const candidati = ns ? [ns, ...nss] : Object.keys(dizionari);
        if (!candidati.some((n) => esiste(n, chiave))) mancanti.push(`${path.relative(SRC, p)}: ${ns ?? "*"}:${chiave}`);
      }
    }
    expect(mancanti).toEqual([]);
  });
});
