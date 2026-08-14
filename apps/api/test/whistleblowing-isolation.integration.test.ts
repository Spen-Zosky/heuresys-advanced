/**
 * apps/api/test/whistleblowing-isolation.integration.test.ts — #99 F4.
 *
 * IL TERZO QUALIFICATORE DI CELLA: L'ISOLAMENTO ASSOLUTO.
 *
 * ADR-0036 §5, prima eccezione al mandato HR: le segnalazioni whistleblowing sono
 * accessibili **solo alla custodia — nemmeno al mandato tecnico**. È l'unico caso in cui
 * `PLATFORM_ADMIN` non vede *nulla*: non maschera, non vede la riga, non sa che esiste.
 *
 * Verificato il 2026-08-14: l'isolamento regge — i due permessi appartengono al solo
 * `WHISTLEBLOWING_CUSTODIAN` e nessun modulo fuori dal suo legge quelle tabelle. Ma non
 * aveva **una prova permanente**: reggeva per come il codice è fatto oggi, non per un
 * controllo che si accende domani. Questo file è quel controllo.
 *
 * Le segnalazioni reali sono 2. Un isolamento verificato su una tabella vuota non
 * proverebbe niente, quindi il primo test pretende che ci sia qualcosa da proteggere.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const SRC = join(import.meta.dirname, "..", "src");
/** Il solo modulo che può nominare quelle tabelle. */
const CASA = join("modules", "whistleblowing");

let t: TestApp;
let segnalazioni = 0;
let custodi: string[] = [];

function fileTs(dir: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) out.push(...fileTs(p));
    else if (voce.endsWith(".ts")) out.push(p);
  }
  return out;
}

beforeAll(async () => {
  t = await buildTestApp();
  segnalazioni = Number(
    (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_whistleblowing_reports`)).rows[0]!.n,
  );
  custodi = (
    await pool.query<{ code: string }>(
      `SELECT DISTINCT r.auth_role_code AS code
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE p.auth_permission_code LIKE 'whistleblowing:%'
        ORDER BY 1`,
    )
  ).rows.map((x) => x.code);
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F4 — isolamento assoluto delle segnalazioni", () => {
  it("gira su un universo dove PUÒ fallire: ci sono segnalazioni da proteggere", () => {
    expect(segnalazioni).toBeGreaterThan(0);
  });

  it("i permessi appartengono alla SOLA custodia — nessun altro ruolo, mandato tecnico incluso", () => {
    expect(custodi).toEqual(["WHISTLEBLOWING_CUSTODIAN"]);
  });

  it("LIVE: il mandato tecnico bussa alla console e non entra", async () => {
    const login = await loginRaw(t.app, "enzo.spenuso@heuresys.com");
    const cookie = login.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/whistleblowing/reports",
      headers: { cookie },
    });
    // Non 200-con-campi-mascherati: qui la maschera non basta e non si applica. 403.
    expect(r.statusCode).toBe(403);
  });

  it("nessun modulo fuori dalla custodia nomina quelle tabelle", () => {
    const colpevoli: string[] = [];
    for (const percorso of fileTs(SRC)) {
      const relativo = percorso.slice(SRC.length + 1);
      if (relativo.startsWith(CASA)) continue;
      const testo = readFileSync(percorso, "utf8");
      // solo il codice: un commento che NOMINA il tema non è una lettura
      for (const riga of testo.split("\n")) {
        const senzaCommento = riga.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        if (/sys_whistleblowing/.test(senzaCommento)) colpevoli.push(`${relativo}: ${riga.trim().slice(0, 70)}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  it("la prova può fallire: il rilevatore riconosce una lettura quando la vede", () => {
    const finta = "  const r = await q.query(`SELECT * FROM sys.sys_whistleblowing_reports`);";
    const senzaCommento = finta.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
    expect(/sys_whistleblowing/.test(senzaCommento)).toBe(true);

    const commento = "  // la console delle segnalazioni legge sys_whistleblowing_reports";
    expect(/sys_whistleblowing/.test(commento.replace(/\/\/.*$/, ""))).toBe(false);
  });
});
