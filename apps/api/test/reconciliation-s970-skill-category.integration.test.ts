import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// S970 #5: skill-category heatmap prerequisite (Enzo decision b). A 7th 'Technical / Domain Expertise'
// category is added; the 31 referenced skills are mapped (23 clean behavioral fits + 8 technical/domain).
// Only the referenced skills are categorized (the rest of the skill catalog is otherwise untouched).

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

const REF_JOIN = `FROM sys.sys_user_skill_evidence e
  JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id`;

describe('reconciliation S970 #5 skill-category mapping', () => {
  it('7th category exists and all 31 referenced skills are categorized', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_skill_categories WHERE skill_category_code='Technical'`)).toBe(1);
    expect(await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN} WHERE s.skill_category_id IS NOT NULL`)).toBe(31);
  });

  it('distribution: 8 technical + 23 across the 6 behavioral families', async () => {
    expect(await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN}
      JOIN sys.sys_skill_categories c ON c.skill_category_id = s.skill_category_id
      WHERE c.skill_category_code='Technical'`)).toBe(8);
    expect(await count(`SELECT count(DISTINCT s.skill_id)::int AS n ${REF_JOIN}
      JOIN sys.sys_skill_categories c ON c.skill_category_id = s.skill_category_id
      WHERE c.skill_category_code<>'Technical'`)).toBe(23);
  });

  it('mapping is scoped: exactly the 31 referenced skills carry a category (catalog otherwise untouched)', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_skills WHERE skill_category_id IS NOT NULL`)).toBe(31);
  });
});
