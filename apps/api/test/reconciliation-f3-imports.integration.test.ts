import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F3 of the reconciliation-closure cycle: bridgeable imports across the job->position wall.
// Hits the live DB (no mocks). #1 + #2 imported; #3 (successor_candidates) was BLOCKED by a
// NOT NULL pool_id FK to the then-empty sys_succession_pools — unblocked by the Wave-2 close
// (S982, mig 000106 + seed 49: incumbent-anchor pools import).

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation F3 imports', () => {
  describe('position_career_paths (#1) — employee bridge', () => {
    it('imported 40 rows, tenant-coherent, all FKs resolved', async () => {
      // I 40 sono il risultato dell'IMPORT. Il cluster storia36 C5 ha poi
      // ricostruito la giunzione per famiglia professionale (177 posizioni):
      // qui si verifica l'import, quindi si guarda la sua provenienza.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_position_career_paths
          WHERE position_career_path_metadata->>'storia36' IS NULL`,
      )).toBe(40);
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

  describe('successor_candidates (#3) — unblocked by Wave-2 close (S982)', () => {
    it('populated by seed 49: the pool dependency was resolved by the incumbent-anchor import', async () => {
      // F3 (S960) measured this as BLOCKED (NOT NULL pool_id on empty pools). The Wave-2
      // close (mig 000106 + seed 49, PM decisions D2/D3) imported 17 pools + 25 candidates.
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
          WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL`,
      )).toBe(25);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBe(17);
    });
  });

  describe('PARTIAL subset imports (closure)', () => {
    it('career_path_steps 35, critical_positions 8, position_succession_relevance 9, user_learning_assignments 1990', async () => {
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_career_path_steps`)).toBe(35);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_critical_positions`)).toBe(8);
      expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_succession_relevance`)).toBe(9);
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_assignments
          WHERE user_learning_assignment_metadata->>'storia36' IS NULL`,
      )).toBe(1990);
    });
    it('user_learning_assignments all resolve a real learning_path + valid status', async () => {
      expect(await count(
        `SELECT count(*)::int AS n FROM sys.sys_user_learning_assignments a
          WHERE a.user_learning_assignment_metadata->>'storia36' IS NULL
            AND (a.user_learning_assignment_path_id IS NULL
             OR a.user_learning_assignment_status NOT IN ('ASSIGNED','IN_PROGRESS','COMPLETED','OVERDUE','WAIVED','CANCELLED'))`,
      )).toBe(0);
    });
  });

  it('the 6 imported F3 tables read POPULATED in the view', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name IN ('sys_position_career_paths','sys_position_learning_requirements',
          'sys_career_path_steps','sys_critical_positions','sys_position_succession_relevance','sys_user_learning_assignments')
          AND resolved_status = 'POPULATED'`,
    );
    expect(rows[0]?.n).toBe(6);
  });
});
