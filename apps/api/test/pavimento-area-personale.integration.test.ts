import { describe, it, expect } from "vitest";
import { pool } from "../src/db/client.js";

// A-4 del piano interfacce (migrazione 000472). La sentinella del pavimento dell'area personale
// si vede rossa su un ruolo nuovo senza i 9 permessi :self e verde quando li ha. Tutto dentro una
// transazione annullata: il database non cambia. Il pool è condiviso dalla suite: non si chiude.

const PAVIMENTO = [
  "consent:manage:self", "gdpr:export:self", "leave:request:self",
  "me:content:read", "me:preferences:read", "me:preferences:update",
  "me:sessions:manage", "surveys:respond:self", "team:read:self",
];

describe("A-4 — sentinella del pavimento dell'area personale", () => {
  it("un ruolo di tenant nuovo senza pavimento compare, con i permessi mancanti; con il pavimento sparisce", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const codice = `A4_PROVA_${process.pid}`;
      const { rows: [ruolo] } = await client.query<{ id: string }>(
        `INSERT INTO sys.sys_auth_roles (auth_role_code, auth_role_name, auth_role_is_platform)
         VALUES ($1, 'prova A-4', false) RETURNING auth_role_id AS id`,
        [codice],
      );
      const leggi = async () =>
        (await client.query<{ dettaglio: string }>(
          `SELECT dettaglio FROM sys.v_pavimento_area_personale_mancante
            WHERE specie = 'ruolo' AND soggetto = $1`,
          [codice],
        )).rows;

      const prima = await leggi();
      expect(prima).toHaveLength(1);
      for (const p of PAVIMENTO) expect(prima[0]?.dettaglio).toContain(p);

      await client.query(
        `INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
         SELECT $1, auth_permission_id FROM sys.sys_auth_permissions
          WHERE auth_permission_code = ANY($2::text[])`,
        [ruolo?.id, PAVIMENTO],
      );
      expect(await leggi()).toHaveLength(0);

      // Un permesso revocato conta come mancante, come nella cache dei permessi.
      await client.query(
        `UPDATE sys.sys_auth_role_permissions rp SET revoked_at = now()
           FROM sys.sys_auth_permissions p
          WHERE p.auth_permission_id = rp.auth_permission_id
            AND rp.auth_role_id = $1 AND p.auth_permission_code = 'team:read:self'`,
        [ruolo?.id],
      );
      const revocato = await leggi();
      expect(revocato).toHaveLength(1);
      expect(revocato[0]?.dettaglio).toBe("mancano: team:read:self");

      // Un ruolo ritirato esce dalla sentinella.
      await client.query(`UPDATE sys.sys_auth_roles SET retired_at = now() WHERE auth_role_id = $1`, [ruolo?.id]);
      expect(await leggi()).toHaveLength(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("un ruolo di piattaforma senza pavimento non compare", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const codice = `A4_PIATTAFORMA_${process.pid}`;
      await client.query(
        `INSERT INTO sys.sys_auth_roles (auth_role_code, auth_role_name, auth_role_is_platform)
         VALUES ($1, 'prova A-4', true)`,
        [codice],
      );
      const { rows } = await client.query(
        `SELECT 1 FROM sys.v_pavimento_area_personale_mancante WHERE soggetto = $1`,
        [codice],
      );
      expect(rows).toHaveLength(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
