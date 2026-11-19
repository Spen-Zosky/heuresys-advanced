/**
 * apps/api/test/tenant-process-levels.integration.test.ts
 *
 * 000498 — il processo del tenant ha un livello e un genitore. Le pagine contano «Processi» al primo
 * livello e i sottoprocessi dentro il loro processo (piano processi e progetti sistematici, V2).
 *
 * Come può fallire:
 *  - le colonne mancassero → l'INSERT del sottoprocesso fallisce;
 *  - il vincolo livello/genitore sparisse → il sottoprocesso senza genitore entra;
 *  - un sottoprocesso potesse fare da genitore → la sentinella non lo vede;
 *  - la sentinella guardasse il tenant sbagliato → il genitore di un altro tenant non compare.
 * Le scritture girano nella transazione del file e vengono annullate alla fine (D-52).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { pool, closePool } from "../src/db/client.js";

const PREFISSO = `T497_${randomUUID().slice(0, 8)}`;

async function nuovo(tenantId: string, code: string, parentId: string | null, level: number): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_processes
       (tenant_process_tenant_id, tenant_process_code, tenant_process_name, tenant_process_parent_id, tenant_process_level, origine_dato)
     VALUES ($1, $2, $3, $4, $5, 'NATIVO') RETURNING tenant_process_id AS id`,
    [tenantId, code, `Prova ${code}`, parentId, level],
  );
  return r.rows[0]!.id;
}

async function difetti(ids: string[]): Promise<string[]> {
  const r = await pool.query<{ difetto: string }>(
    `SELECT difetto FROM sys.v_tenant_processes_parent_defects WHERE riga = ANY($1::uuid[]) ORDER BY difetto`, [ids],
  );
  return r.rows.map((x) => x.difetto);
}

describe("000498 — livello e genitore del processo del tenant", () => {
  let tenantA = "";
  let tenantB = "";

  beforeAll(async () => {
    const t = await pool.query<{ id: string }>(`SELECT tenant_id AS id FROM sys.sys_tenancies ORDER BY tenant_id LIMIT 2`);
    tenantA = t.rows[0]!.id;
    tenantB = t.rows[1]?.id ?? t.rows[0]!.id;
  });

  afterAll(async () => {
    await closePool();
  });

  it("un processo nuovo nasce al primo livello, senza genitore", async () => {
    const id = await nuovo(tenantA, `${PREFISSO}_L1`, null, 1);
    const r = await pool.query<{ level: number; parent: string | null }>(
      `SELECT tenant_process_level AS level, tenant_process_parent_id AS parent FROM sys.sys_tenant_processes WHERE tenant_process_id = $1`, [id],
    );
    expect(r.rows[0]).toEqual({ level: 1, parent: null });
  });

  it("un sottoprocesso porta il genitore e la sentinella resta a zero", async () => {
    const padre = await nuovo(tenantA, `${PREFISSO}_P`, null, 1);
    const figlio = await nuovo(tenantA, `${PREFISSO}_F`, padre, 2);
    expect(await difetti([figlio])).toEqual([]);
  });

  it("il livello deve essere coerente con il genitore", async () => {
    await expect(nuovo(tenantA, `${PREFISSO}_SENZA`, null, 2)).rejects.toThrow(/sys_tenant_processes_level_ck/);
    const padre = await nuovo(tenantA, `${PREFISSO}_P2`, null, 1);
    await expect(nuovo(tenantA, `${PREFISSO}_L1CONP`, padre, 1)).rejects.toThrow(/sys_tenant_processes_level_ck/);
  });

  it("la sentinella vede un sottoprocesso usato come genitore", async () => {
    const padre = await nuovo(tenantA, `${PREFISSO}_N1`, null, 1);
    const figlio = await nuovo(tenantA, `${PREFISSO}_N2`, padre, 2);
    const nipote = await nuovo(tenantA, `${PREFISSO}_N3`, figlio, 2);
    expect(await difetti([nipote])).toEqual(["il genitore e' a sua volta un sottoprocesso"]);
  });

  it("la sentinella vede un genitore di un altro tenant", async () => {
    if (tenantA === tenantB) return;
    const padre = await nuovo(tenantB, `${PREFISSO}_X1`, null, 1);
    const figlio = await nuovo(tenantA, `${PREFISSO}_X2`, padre, 2);
    expect(await difetti([figlio])).toEqual(["genitore di un altro tenant"]);
  });
});
