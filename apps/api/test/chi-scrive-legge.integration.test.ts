/**
 * apps/api/test/chi-scrive-legge.integration.test.ts
 *
 * S-8 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md; analisi V2 INC-03).
 *
 * La regola: un ruolo che CREA, MODIFICA o ELIMINA una risorsa la LEGGE anche, quando il
 * catalogo ha un permesso `<risorsa>:read`. Senza lettura il ruolo scrive alla cieca: la
 * pagina non si apre (403) e la modifica non si puo' controllare. Il caso che l'ha fatta
 * nascere: PEOPLE_MANAGER scriveva persone, unita', competenze e altre 11 risorse senza
 * poterle leggere.
 *
 * Si legge dalle concessioni VIVE (revoked_at nullo), non dai file. Un'eccezione voluta va
 * scritta qui sotto con la sua ragione, o la prova la nomina.
 */
import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";

/** Coppie ruolo/risorsa in cui scrivere senza leggere e' voluto, con la ragione. */
const ECCEZIONI: Record<string, string> = {};

afterAll(async () => {
  await closePool();
});

describe("S-8 — chi scrive una risorsa la legge", () => {
  it("nessun ruolo ha create/update/delete su una risorsa senza il suo :read", async () => {
    const { rows } = await pool.query<{ ruolo: string; risorsa: string; scritture: string }>(
      `WITH vive AS (
         SELECT r.auth_role_code AS ruolo, p.auth_permission_code AS codice
           FROM sys.sys_auth_role_permissions rp
           JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
           JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
          WHERE rp.revoked_at IS NULL
       ), scritture AS (
         SELECT ruolo, split_part(codice, ':', 1) AS risorsa, codice
           FROM vive
          WHERE codice ~ '^[a-z_]+:(create|update|delete)$'
       )
       SELECT s.ruolo, s.risorsa, string_agg(s.codice, ',' ORDER BY s.codice) AS scritture
         FROM scritture s
        WHERE EXISTS (SELECT 1 FROM sys.sys_auth_permissions p
                       WHERE p.auth_permission_code = s.risorsa || ':read')
          AND NOT EXISTS (SELECT 1 FROM vive v
                           WHERE v.ruolo = s.ruolo AND v.codice = s.risorsa || ':read')
        GROUP BY s.ruolo, s.risorsa
        ORDER BY 1, 2`,
    );
    const ciechi = rows
      .filter((r) => !(`${r.ruolo}/${r.risorsa}` in ECCEZIONI))
      .map((r) => `${r.ruolo} scrive ${r.risorsa} (${r.scritture}) senza ${r.risorsa}:read`);
    expect(ciechi).toEqual([]);
  });
});
