/**
 * apps/api/test/unit/shared-exports-integrity.unit.test.ts
 * D-03 — coerenza fra gli schemi di `@heuresys/shared` e i suoi subpath export.
 *
 * PERCHÉ QUESTO INVECE DELLA POTATURA CHE IL RILIEVO CHIEDEVA.
 *
 * D-03 registrava «81/96 subpath export inutilizzati» e proponeva di rimuoverli.
 * Misurato prima di agire (2026-08-03): gli export sono **104 su 104 file**, nessuno
 * rotto, nessuno mancante, ognuno punta al proprio file. Il pattern scritto a mano non
 * ha prodotto un solo caso di deriva in tutta la storia del repository, e un export non
 * importato non costa nulla: non entra nei bundle, non allunga la compilazione, non
 * crea rischio. La premessa del rilievo — «inutilizzato quindi spreco» — non regge alla
 * verifica, e togliere 88 righe sane avrebbe reso il pattern dei moduli incoerente (il
 * CLAUDE.md prescrive di aggiungere il subpath a OGNI modulo nuovo) senza alcun guadagno
 * misurabile.
 *
 * Il rischio vero non è che ce ne siano troppi: è che uno resti indietro. Rinominare un
 * file schema, o aggiungerne uno dimenticando l'export, produce una rottura che nessun
 * typecheck vede — il subpath è una stringa dentro un JSON. Oggi la deriva è zero; nulla
 * la impediva domani. Questo test la rende impossibile, che è ciò che D-03 voleva
 * ottenere davvero.
 *
 * Gira nell'unit layer: nessun DB, nessuna rete, millisecondi.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sharedRoot = fileURLToPath(new URL("../../../../packages/shared/", import.meta.url));

interface SharedPkg {
  exports?: Record<string, { types?: string; "heuresys-source"?: string; default?: string }>;
}

function readPkg(): SharedPkg {
  return JSON.parse(readFileSync(`${sharedRoot}package.json`, "utf8")) as SharedPkg;
}

function schemaFiles(): string[] {
  return readdirSync(`${sharedRoot}src/schemas`)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => f.slice(0, -3))
    .sort();
}

function declaredSchemaSubpaths(pkg: SharedPkg): string[] {
  return Object.keys(pkg.exports ?? {})
    .filter((k) => k.startsWith("./schemas/"))
    .map((k) => k.slice("./schemas/".length))
    .sort();
}

describe("D-03 — i subpath export di @heuresys/shared restano allineati agli schemi", () => {
  it("ogni file schema ha il suo subpath export", () => {
    const mancanti = schemaFiles().filter((f) => !declaredSchemaSubpaths(readPkg()).includes(f));
    expect(
      mancanti,
      `schemi senza subpath export in packages/shared/package.json: ${mancanti.join(", ")}\n` +
        "Il pattern dei moduli (CLAUDE.md) prescrive di aggiungerlo insieme al file.",
    ).toEqual([]);
  });

  it("ogni subpath export punta a un file che esiste", () => {
    const files = schemaFiles();
    const rotti = declaredSchemaSubpaths(readPkg()).filter((s) => !files.includes(s));
    expect(
      rotti,
      `subpath export che puntano a schemi inesistenti: ${rotti.join(", ")}\n` +
        "Tipico dopo una rinomina: il file cambia nome, la stringa nel JSON no.",
    ).toEqual([]);
  });

  it("ogni subpath export punta al PROPRIO file, non a un altro", () => {
    // Un copia-incolla che lascia il percorso del vicino è la deriva più insidiosa:
    // l'import funziona, ma consegna gli schemi sbagliati.
    const pkg = readPkg();
    const sbagliati: string[] = [];
    for (const [key, value] of Object.entries(pkg.exports ?? {})) {
      if (!key.startsWith("./schemas/")) continue;
      const nome = key.slice("./schemas/".length);
      for (const [campo, atteso] of [
        ["types", `./dist/schemas/${nome}.d.ts`],
        ["heuresys-source", `./src/schemas/${nome}.ts`],
        ["default", `./dist/schemas/${nome}.js`],
      ] as const) {
        const reale = value[campo];
        if (reale && reale !== atteso) sbagliati.push(`${key} → ${campo}: ${reale} (atteso ${atteso})`);
      }
    }
    expect(sbagliati, `subpath export che puntano altrove:\n${sbagliati.join("\n")}`).toEqual([]);
  });

  it("il controllo sa accorgersi di una deriva — non passa a vuoto", () => {
    // Un test di integrità che non vedesse nulla passerebbe anche su un package vuoto.
    expect(schemaFiles().length).toBeGreaterThan(50);
    expect(declaredSchemaSubpaths(readPkg()).length).toBe(schemaFiles().length);
  });
});
