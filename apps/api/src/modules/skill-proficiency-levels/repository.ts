/**
 * apps/api/src/modules/skill-proficiency-levels/repository.ts
 * Read-only catalog (NOVICE..MASTER, ranks 1..6). Seeded in migration 000013.
 */

import type { Pool, PoolClient } from "pg";
import type { SkillProficiencyLevel, SkillProficiencyLevelCode } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_proficiency_level_id: string;
  skill_proficiency_level_code: SkillProficiencyLevelCode;
  skill_proficiency_level_name: string;
  skill_proficiency_level_rank: number;
  skill_proficiency_level_description: string | null;
  skill_proficiency_level_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `skill_proficiency_level_id, skill_proficiency_level_code,
  skill_proficiency_level_name, skill_proficiency_level_rank,
  skill_proficiency_level_description, skill_proficiency_level_metadata,
  created_at, updated_at`;

function toLevel(r: Row): SkillProficiencyLevel {
  return {
    proficiencyLevelId: r.skill_proficiency_level_id,
    code: r.skill_proficiency_level_code,
    name: r.skill_proficiency_level_name,
    rank: r.skill_proficiency_level_rank,
    description: r.skill_proficiency_level_description,
    metadata: r.skill_proficiency_level_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listProficiencyLevels(
  q: DbConnector,
): Promise<{ items: SkillProficiencyLevel[]; total: number }> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_proficiency_levels
      ORDER BY skill_proficiency_level_rank ASC`,
  );
  const items = res.rows.map(toLevel);
  return { items, total: items.length };
}
