/**
 * Z-112 — il manifesto dei residui E2E non puo' restare indietro rispetto alla pulizia.
 *
 * `apps/web/tests/e2e/global-teardown.ts` cancella; `apps/web/tests/e2e/e2e-residue.ts`
 * conta e fa fallire la corsa se resta qualcosa. Se il primo impara a cancellare da una
 * tabella nuova e il secondo non lo sa, torna esattamente il difetto da cui Z-112 nasce:
 * un residuo che nessuno conta. E' successo davvero — i documenti `E2E %` sono rimasti
 * sul DB dal 10-11 giugno al 9 agosto 2026 senza che nulla lo segnalasse.
 *
 * Due asserzioni, per due modi diversi di rompersi:
 *   1. copertura — ogni tabella da cui il teardown cancella ha il suo marcatore;
 *   2. eseguibilita' — la query che il manifesto genera gira davvero sul DB reale,
 *      quindi ogni tabella e ogni colonna citate esistono. Un marcatore con un nome
 *      di colonna sbagliato fallirebbe dentro un `catch` del teardown, in silenzio.
 */
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closePool } from "../src/db/client.js";

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "tests", "e2e");
const TEARDOWN = readFileSync(resolve(E2E_DIR, "global-teardown.ts"), "utf8");
const MANIFEST = readFileSync(resolve(E2E_DIR, "e2e-residue.ts"), "utf8");

/**
 * Le tabelle da cui il teardown cancella davvero.
 *
 * Il sorgente e' un parametro, non una costante catturata: e' l'unico modo per
 * mostrare questa funzione mentre dice di NO. Un controllo che non si e' mai visto
 * rosso non e' un controllo, e con la lettura cablata nel corpo l'unico modo per
 * provarlo sarebbe stato rompere il repo a mano.
 */
function tabelleCancellateDalTeardown(src: string = TEARDOWN): string[] {
  const found = [...src.matchAll(/DELETE FROM (sys\.sys_\w+)/g)].map((m) => m[1]!);
  return [...new Set(found)].sort();
}

/** I marcatori dichiarati nel manifesto, letti dal sorgente (nessun import cross-app). */
function marcatori(src: string = MANIFEST): { table: string; where: string }[] {
  return [...src.matchAll(/table:\s*"(sys\.sys_\w+)",\s*where:\s*"((?:[^"\\]|\\.)+)"/g)].map((m) => ({
    table: m[1]!,
    where: m[2]!,
  }));
}

/** La differenza che l'asserzione di copertura misura: cancellate ma non contate. */
function scoperte(teardownSrc: string = TEARDOWN, manifestSrc: string = MANIFEST): string[] {
  const coperte = new Set(marcatori(manifestSrc).map((m) => m.table));
  return tabelleCancellateDalTeardown(teardownSrc).filter((t) => !coperte.has(t));
}

describe("Z-112 — manifesto dei residui E2E", () => {
  afterAll(async () => {
    await closePool();
  });

  it("le funzioni di estrazione trovano qualcosa (se no, le due asserzioni sotto sarebbero vuote e sempre verdi)", () => {
    expect(tabelleCancellateDalTeardown().length).toBeGreaterThan(5);
    expect(marcatori().length).toBeGreaterThan(5);
  });

  it("ogni tabella che il teardown ripulisce ha un marcatore che la conta", () => {
    const mancanti = scoperte();
    expect(mancanti, `tabelle cancellate dal teardown ma non contate da e2e-residue.ts: ${mancanti.join(", ")}`).toEqual(
      [],
    );
  });

  it("l'asserzione di copertura sa dire di NO — un teardown che cancella da una tabella non nel manifesto viene segnalato", () => {
    const teardownFinto = `
      DELETE FROM sys.sys_content_documents WHERE document_title LIKE 'E2E %';
      DELETE FROM sys.sys_tabella_mai_censita WHERE x = 1;
    `;
    expect(scoperte(teardownFinto)).toEqual(["sys.sys_tabella_mai_censita"]);
  });

  it("l'asserzione di copertura sa dire di NO anche quando e' il manifesto a essersi svuotato", () => {
    const manifestoFinto = `{ label: "solo questa", table: "sys.sys_leads", where: "lead_email LIKE '%@x'" },`;
    expect(scoperte(TEARDOWN, manifestoFinto)).toContain("sys.sys_content_documents");
  });

  it("la query generata dal manifesto gira sul DB reale — tabelle e colonne esistono tutte", async () => {
    const ms = marcatori();
    const sql = ms
      .map((m, i) => `SELECT ${i} AS ord, count(*) AS n FROM ${m.table} WHERE ${m.where}`)
      .join(" UNION ALL ")
      .concat(" ORDER BY ord");
    const res = await pool.query(sql);
    expect(res.rows).toHaveLength(ms.length);
    for (const row of res.rows) {
      expect(Number(row.n)).toBeGreaterThanOrEqual(0);
    }
  });
});
