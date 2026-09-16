/**
 * apps/api/test/role-codes-db-drift.integration.test.ts — mandato K, F4.0.
 *
 * Il confronto d'INTEGRAZIONE che `role-codes-drift.unit.test.ts` dichiara di non poter
 * fare: `ROLE_CODES` (il codice) contro `sys.sys_auth_roles` (il database vivo). Un ruolo
 * che compare solo nel codice non e' ancora un ruolo: nessuna migrazione lo ha fatto
 * nascere, e nessuna persona puo' riceverlo. Un ruolo che compare solo nel database e'
 * codice morto dal lato opposto: nessuna interfaccia sa che esiste. E' esattamente la
 * lacuna che I-F ha misurato (nessun test confronta `role-codes.ts` con `sys_auth_roles`)
 * ed e' la meta' "e nel database" della riparazione chiesta a F4.0.
 *
 * Uguaglianza stretta nei due sensi: oggi (baseline F0.3, prima di R-1) i due insiemi sono
 * identici — 14 codici, misurato con lo stesso comando qui sotto. Un ruolo RITIRATO (V5)
 * resta una riga in `sys_auth_roles` (ritirare non e' cancellare) e il suo codice resta
 * anche in `ROLE_CODES` (lo stesso principio, sul lato codice): l'uguaglianza stretta non
 * si rompe quando F4 comincera' a ritirare permessi, perche' nessuna voce di questo
 * mandato cancella una RIGA di `sys_auth_roles` ne' un CODICE da `ROLE_CODES`.
 */
import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { ROLE_CODES } from "@heuresys/shared";

afterAll(async () => {
  await closePool();
});

describe("mandato K F4.0 — role-codes.ts non diverge da sys.sys_auth_roles", () => {
  it("ogni codice di ROLE_CODES ha una riga in sys_auth_roles, e viceversa", async () => {
    const { rows } = await pool.query<{ auth_role_code: string }>(
      "select auth_role_code from sys.sys_auth_roles order by 1",
    );
    const nelDb = new Set(rows.map((r) => r.auth_role_code));
    const nelCodice = new Set(ROLE_CODES);

    const soloNelCodice = [...nelCodice].filter((c) => !nelDb.has(c));
    const soloNelDb = [...nelDb].filter((c) => !nelCodice.has(c as (typeof ROLE_CODES)[number]));

    expect(
      soloNelCodice,
      "codici dichiarati in ROLE_CODES senza riga in sys_auth_roles: un ruolo nato a meta', dichiarato ma mai migrato",
    ).toEqual([]);
    expect(
      soloNelDb,
      "righe in sys_auth_roles che ROLE_CODES non conosce: un ruolo nel database che nessuna interfaccia sa selezionare",
    ).toEqual([]);
  });

  it("la prova puo' fallire: un ruolo assente dal database viene segnalato", async () => {
    // Non serve sabotare il database per provare che il confronto sa fallire: la logica di
    // insieme e' pura e la si prova con dati finti, esattamente come il caso di I-F
    // (un codice aggiunto SOLO a ROLE_CODES, mai applicato con una migrazione).
    const nelCodiceFinto = new Set(["PLATFORM_ADMIN", "USER", "RUOLO_MAI_MIGRATO"]);
    const nelDbFinto = new Set(["PLATFORM_ADMIN", "USER"]);
    const soloNelCodice = [...nelCodiceFinto].filter((c) => !nelDbFinto.has(c));
    expect(soloNelCodice).toEqual(["RUOLO_MAI_MIGRATO"]);
  });
});
