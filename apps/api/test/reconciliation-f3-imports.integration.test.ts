import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F3 of the reconciliation-closure cycle: bridgeable imports across the job->position wall.
// Hits the live DB (no mocks). #1 + #2 imported; #3 (successor_candidates) is BLOCKED by a
// NOT NULL pool_id FK to the empty/dead-end sys_succession_pools — documented here, not imported.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation F3 imports', () => {
  describe('position_career_paths (#1) — employee bridge', () => {
    it('imported 40 rows, tenant-coherent, all FKs resolved', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_career_paths`)).toBe(40);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_career_paths pcp
           JOIN sys.sys_positions p ON p.position_id = pcp.position_id
          WHERE p.position_tenant_id <> pcp.position_career_path_tenant_id`,
      )).toBe(0);
    });
  });

  describe('position_learning_requirements (#2) — job_title->role->position 1:N', () => {
    it('imported 1791 fan-out rows across 158 positions, all resolving a learning_path', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_learning_requirements`)).toBe(1791);
      expect(await count(
        `SELECT count(DISTINCT position_id)::int AS n FROM sys.sys_position_learning_requirements`,
      )).toBe(158);
      // every row resolves a real learning_path (FK integrity beyond the constraint)
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_learning_requirements plr
          WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_paths lp WHERE lp.learning_path_id = plr.learning_path_id)`,
      )).toBe(0);
    });
  });

  describe('successor_candidates (#3) — BLOCKED by pool dependency', () => {
    it('stays empty: its NOT NULL pool_id targets the dead-end empty sys_succession_pools', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_successor_candidates`)).toBe(0);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBe(0);
    });
  });

  it('the 2 imported F3 tables read POPULATED in the view', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_position_career_paths','sys_position_learning_requirements')
          AND resolved_status = 'POPULATED'`,
    );
    expect(rows[0]?.n).toBe(2);
  });
});
