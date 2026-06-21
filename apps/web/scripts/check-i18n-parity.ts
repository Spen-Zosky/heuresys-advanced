/**
 * apps/web/scripts/check-i18n-parity.ts
 *
 * Verifica che ogni chiave i18n esista in ogni locale supportato.
 * Confronta le chiavi flatten-ate (dot-notation) tra i file JSON in
 * src/locales/<locale>/*.json. Exit code 1 se almeno una chiave è
 * mancante in almeno un locale; 0 se parity perfetta.
 *
 * Wired in package.json: "i18n:check": "tsx scripts/check-i18n-parity.ts"
 * Acceptance MVP-2a #4.
 */

import fs from "node:fs";
import path from "node:path";

const LOCALES = ["it", "en"] as const;
const NAMESPACES = ["common", "shell", "analytics", "admin", "blueprints", "hr", "ess", "landing"] as const;
const BASE = path.resolve(__dirname, "..", "src", "locales");

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [];
  const keys: string[] = [];
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[k];
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof value === "object" && value !== null) {
      keys.push(...flatten(value, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

let totalErrors = 0;
let totalKeys = 0;

for (const ns of NAMESPACES) {
  const sets: Record<string, Set<string>> = {};
  for (const loc of LOCALES) {
    const file = path.join(BASE, loc, `${ns}.json`);
    if (!fs.existsSync(file)) {
      console.error(`MISSING locale file: ${file}`);
      totalErrors++;
      sets[loc] = new Set();
      continue;
    }
    const json = JSON.parse(fs.readFileSync(file, "utf-8"));
    sets[loc] = new Set(flatten(json));
  }

  const allKeys = new Set<string>();
  for (const loc of LOCALES) {
    const s = sets[loc];
    if (s) for (const k of s) allKeys.add(k);
  }

  for (const key of allKeys) {
    const missingIn = LOCALES.filter((l) => !(sets[l]?.has(key) ?? false));
    if (missingIn.length > 0) {
      console.error(`[${ns}] MISSING in [${missingIn.join(", ")}]: ${key}`);
      totalErrors++;
    }
  }

  totalKeys += allKeys.size;
}

if (totalErrors > 0) {
  console.error(`\n✗ ${totalErrors} parity violations across ${LOCALES.length} locales`);
  process.exit(1);
}
console.log(`✓ Parity OK (${totalKeys} keys × ${LOCALES.length} locales × ${NAMESPACES.length} namespaces)`);
