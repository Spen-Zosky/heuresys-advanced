/**
 * apps/api/test/dashboard-attivita-lingua.integration.test.ts
 * Giudizio qa-web 16/11, T-LINGUA: l'attività recente non porta più una frase italiana
 * («Nuova persona: …», «Nuova posizione: …»): porta il tipo e il soggetto separati e la frase
 * la compone il web nella lingua di chi guarda. Chiama il repository sul database vivo, senza
 * login (l'atteso si ricava da sys_users e sys_positions).
 */
import { describe, it, expect, afterAll } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { getRecentActivity } from "../src/modules/dashboard/repository.js";

afterAll(async () => {
  await closePool();
});

describe("dashboard: attività recente senza frasi nella lingua sbagliata", () => {
  it("ogni voce porta il soggetto (nome o titolo) e nessuna frase composta", async () => {
    const voci = await getRecentActivity(
      pool,
      { tenantId: null, teamPositionIds: [] } as unknown as Parameters<typeof getRecentActivity>[1],
      200,
    );
    expect(voci.length).toBeGreaterThan(0);
    for (const v of voci) {
      expect(JSON.stringify(v)).not.toMatch(/Nuova (persona|posizione)/);
      expect(v).toHaveProperty("subject");
      expect(v).not.toHaveProperty("summary");
    }
    const posizioni = voci.filter((v) => v.kind === "POSITION_CREATED");
    expect(posizioni.length).toBeGreaterThan(0);
    const atteso = await pool.query<{ id: string; titolo: string }>(
      `SELECT position_id AS id, position_title AS titolo FROM sys.sys_positions WHERE position_id = ANY($1::uuid[])`,
      [posizioni.map((p) => p.resourceId)],
    );
    const perId = new Map(atteso.rows.map((r) => [r.id, r.titolo]));
    for (const p of posizioni) expect(p.subject).toBe(perId.get(p.resourceId));
    const persone = voci.filter((v) => v.kind === "USER_CREATED");
    expect(persone.length).toBeGreaterThan(0);
    const att = await pool.query<{ id: string; nome: string }>(
      `SELECT user_id AS id,
              coalesce(nullif(concat_ws(', ', nullif(user_last_name, ''), nullif(user_first_name, '')), ''), user_display_name) AS nome
         FROM sys.sys_users WHERE user_id = ANY($1::uuid[])`,
      [persone.map((p) => p.resourceId)],
    );
    const nomi = new Map(att.rows.map((r) => [r.id, r.nome]));
    for (const p of persone) expect(p.subject).toBe(nomi.get(p.resourceId));
  });
});
