import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// T1.2 — ESCO occupation -> skill requirements IMPORT. Hits the live DB (no mocks), consistent
// with the rest of the integration suite. Validates migration 000123 (new GLOBAL/tenant-less
// sys_occupation_skill_requirements table + bucket-A/IMPORT registry row) + seed 52 (the 126051-row
// import from the committed legacy dump wave1_eskap_esco_occupation_skills.sql, resolved to
// sys_skills via skill_code 'OLDDB::esco_skills::' || legacy_skill_id and occupation uri).
// Measured live S990 against the OCI VM DB via the tunnel — 100% resolution, 0 dropped:
//   - total 126051 = 67600 ESSENTIAL + 58451 OPTIONAL (== the legacy source split).
//   - FK integrity: every skill_id resolves to sys_skills; skill_esco_uri NOT NULL on all rows.
//   - is_global true on all rows (ESCO is a public, tenant-less catalog).
// The pool is shared across the suite (singleThread) so this file does NOT close it.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('T1.2 — ESCO occupation -> skill requirements (sys_occupation_skill_requirements)', () => {
  describe('import counts (relation split == legacy source)', () => {
    it('imported exactly 126051 relations = 67600 ESSENTIAL + 58451 OPTIONAL', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements`)).toBe(126051);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_relation = 'ESSENTIAL'`,
      )).toBe(67600);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_relation = 'OPTIONAL'`,
      )).toBe(58451);
    });

    it('the relation domain is exactly {ESSENTIAL, OPTIONAL} (RD-08 CHECK holds — no other values)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_relation NOT IN ('ESSENTIAL','OPTIONAL')`,
      )).toBe(0);
    });
  });

  describe('FK integrity + structural invariants', () => {
    it('every skill_id (when non-null) resolves to a real sys_skills row', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements r
          WHERE r.occupation_skill_req_skill_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_id = r.occupation_skill_req_skill_id)`,
      )).toBe(0);
    });

    it('skill_esco_uri is NOT NULL on every row (the durable ESCO catalog fact)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_skill_esco_uri IS NULL`,
      )).toBe(0);
    });

    it('occupation_uri is NOT NULL on every row', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_occupation_uri IS NULL`,
      )).toBe(0);
    });

    it('is GLOBAL / tenant-less: is_global true on all rows, no tenant column on the table (I5)', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_occupation_skill_requirements
          WHERE occupation_skill_req_is_global = true`,
      )).toBe(126051);
      expect(await count(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'sys' AND table_name = 'sys_occupation_skill_requirements'
            AND column_name ILIKE '%tenant%'`,
      )).toBe(0);
    });

    it('the (occupation_uri, skill_esco_uri) UNIQUE key has no duplicates', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM (
           SELECT 1 FROM sys.sys_occupation_skill_requirements
            GROUP BY occupation_skill_req_occupation_uri, occupation_skill_req_skill_esco_uri
           HAVING count(*) > 1
         ) d`,
      )).toBe(0);
    });
  });

  describe('a sample occupation returns its essential + optional skill list', () => {
    // "aviation ground systems engineer" — legacy occupation 3d2297fb-...,
    // ESCO uri http://data.europa.eu/esco/occupation/4daee8bd-8400-4da6-ba52-30d4c193d1a9.
    const SAMPLE_URI = 'http://data.europa.eu/esco/occupation/4daee8bd-8400-4da6-ba52-30d4c193d1a9';

    it('the sample occupation has both essential and optional skills, all resolved', async () => {
      const { rows } = await pool.query<{ rel: string; n: number; named: number }>(
        `SELECT r.occupation_skill_req_relation AS rel,
                count(*)::int AS n,
                count(s.skill_id)::int AS named
           FROM sys.sys_occupation_skill_requirements r
           JOIN sys.sys_skills s ON s.skill_id = r.occupation_skill_req_skill_id
          WHERE r.occupation_skill_req_occupation_uri = $1
          GROUP BY 1 ORDER BY 1`,
        [SAMPLE_URI],
      );
      const m = Object.fromEntries(rows.map((r) => [r.rel, r.n]));
      expect((m.ESSENTIAL ?? 0)).toBeGreaterThan(0);
      expect((m.OPTIONAL ?? 0)).toBeGreaterThan(0);
      // every relation for this occupation joins a real (named) skill
      expect(rows.every((r) => r.n === r.named)).toBe(true);
    });
  });

  describe('reconciliation registry — the IMPORT row is present (bucket A / IMPORT)', () => {
    it('sys_occupation_skill_requirements is registered bucket A / IMPORT with a legacy source', async () => {
      const { rows } = await pool.query<{ bucket: string; declared: string; source: string | null }>(
        `SELECT reconciliation_registry_bucket AS bucket,
                reconciliation_registry_declared_status AS declared,
                reconciliation_registry_legacy_source AS source
           FROM sys.sys_reconciliation_registry
          WHERE reconciliation_registry_table_name = 'sys_occupation_skill_requirements'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.bucket).toBe('A');
      expect(rows[0]?.declared).toBe('IMPORT');
      expect(rows[0]?.source).toBe('esco_occupation_skills');
    });

    it('the table resolves POPULATED in the reconciliation view', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
          WHERE table_name = 'sys_occupation_skill_requirements' AND resolved_status = 'POPULATED'`,
      )).toBe(1);
    });
  });
});
