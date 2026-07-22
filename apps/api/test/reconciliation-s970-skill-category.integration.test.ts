import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// S970 #5 (hardened by mig 000196): skill-category heatmap prerequisite.
// Invariant-based (no pinned catalog counts — they change with dedup/seeding):
//   1. the 7th 'Technical / Domain Expertise' category exists (design contract);
//   2. DENSE — every evidence-referenced skill carries a category (mig 000196
//      restores the categories lost in the 000189 dedup repoint);
//   3. the technical/behavioral partition covers the whole referenced set.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

const REF_JOIN = `FROM sys.sys_user_skill_evidence e
  JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id`;

describe('reconciliation S970 #5 skill-category mapping', () => {
  it("the 7th 'Technical' category exists (design contract)", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_skill_categories WHERE skill_category_code='Technical'`)).toBe(1);
  });

  it('DENSE: every evidence-referenced skill is categorized (0 uncategorized)', async () => {
    expect(await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN} WHERE s.skill_category_id IS NULL`)).toBe(0);
  });

  it('the technical/behavioral partition covers the whole referenced set', async () => {
    const total = await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN} WHERE s.skill_category_id IS NOT NULL`);
    const tech = await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN}
      JOIN sys.sys_skill_categories c ON c.skill_category_id = s.skill_category_id
      WHERE c.skill_category_code='Technical'`);
    const behavioral = await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN}
      JOIN sys.sys_skill_categories c ON c.skill_category_id = s.skill_category_id
      WHERE c.skill_category_code<>'Technical'`);
    expect(total).toBeGreaterThan(0);
    expect(tech).toBeGreaterThan(0);
    expect(behavioral).toBeGreaterThan(0);
    expect(tech + behavioral).toBe(total);
  });
});
