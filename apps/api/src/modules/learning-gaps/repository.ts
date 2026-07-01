/**
 * apps/api/src/modules/learning-gaps/repository.ts
 * Raw SQL for sys.sys_learning_gaps. Tenant-scoped only.
 */

import type { Pool, PoolClient } from "pg";
import type {
  LearningGap,
  LearningGapListQuery,
  LearningGapSeverity,
  CreateLearningGapBody,
  UpdateLearningGapBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  learning_gap_id: string;
  learning_gap_tenant_id: string;
  learning_gap_user_id: string;
  learning_gap_position_id: string | null;
  learning_gap_skill_id: string | null;
  learning_gap_required_proficiency: string | null;
  learning_gap_current_proficiency: string | null;
  learning_gap_score: string | null;
  learning_gap_severity: LearningGapSeverity;
  learning_gap_detected_at: Date;
  learning_gap_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  user_name?: string | null; // G-02: resolved on the list query, undefined elsewhere
  position_title?: string | null;
  skill_name?: string | null;
}

const COLS = `learning_gap_id, learning_gap_tenant_id, learning_gap_user_id,
  learning_gap_position_id, learning_gap_skill_id, learning_gap_required_proficiency,
  learning_gap_current_proficiency, learning_gap_score, learning_gap_severity,
  learning_gap_detected_at, learning_gap_metadata, created_at, updated_at`;

function toGap(r: Row): LearningGap {
  return {
    learningGapId: r.learning_gap_id,
    tenantId: r.learning_gap_tenant_id,
    userId: r.learning_gap_user_id,
    userName: r.user_name ?? null,
    positionId: r.learning_gap_position_id,
    positionTitle: r.position_title ?? null,
    skillId: r.learning_gap_skill_id,
    skillName: r.skill_name ?? null,
    requiredProficiency: r.learning_gap_required_proficiency,
    currentProficiency: r.learning_gap_current_proficiency,
    score: r.learning_gap_score === null ? null : Number(r.learning_gap_score),
    severity: r.learning_gap_severity,
    detectedAt: r.learning_gap_detected_at.toISOString(),
    metadata: r.learning_gap_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGaps(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: LearningGapListQuery },
): Promise<{ items: LearningGap[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`learning_gap_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    // ADR-0027 F3: an empty allow-list means nobody is visible — short-circuit to empty.
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`learning_gap_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`learning_gap_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`learning_gap_position_id = $${params.length}`);
  }
  if (filter.query.skillId) {
    params.push(filter.query.skillId);
    where.push(`learning_gap_skill_id = $${params.length}`);
  }
  if (filter.query.severity) {
    params.push(filter.query.severity);
    where.push(`learning_gap_severity = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_learning_gaps ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS},
            (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = sys.sys_learning_gaps.learning_gap_user_id) AS user_name,
            (SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = sys.sys_learning_gaps.learning_gap_position_id) AS position_title,
            (SELECT s.skill_name FROM sys.sys_skills s WHERE s.skill_id = sys.sys_learning_gaps.learning_gap_skill_id) AS skill_name
       FROM sys.sys_learning_gaps ${whereClause}
      ORDER BY learning_gap_detected_at DESC, learning_gap_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toGap), total };
}

export async function findGapById(q: DbConnector, id: string): Promise<LearningGap | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_gaps WHERE learning_gap_id = $1`, [id],
  );
  return res.rows[0] ? toGap(res.rows[0]) : null;
}

export async function getUserTenant(q: DbConnector, userId: string): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function positionInTenant(
  q: DbConnector,
  positionId: string,
  tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean }> {
  const res = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.position_tenant_id === tenantId };
}

export async function skillVisibleToTenant(
  q: DbConnector,
  skillId: string,
  tenantId: string,
): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_skills
       WHERE skill_id = $1
         AND (skill_is_global = true OR skill_tenant_id = $2)
       LIMIT 1`,
    [skillId, tenantId],
  );
  return res.rows.length > 0;
}

export async function insertGap(
  q: DbConnector,
  tenantId: string,
  body: CreateLearningGapBody,
): Promise<LearningGap> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_learning_gaps (
        learning_gap_tenant_id, learning_gap_user_id, learning_gap_position_id,
        learning_gap_skill_id, learning_gap_required_proficiency, learning_gap_current_proficiency,
        learning_gap_score, learning_gap_severity, learning_gap_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.userId,
      body.positionId ?? null,
      body.skillId ?? null,
      body.requiredProficiency ?? null,
      body.currentProficiency ?? null,
      body.score ?? null,
      body.severity ?? "MEDIUM",
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toGap(res.rows[0]!);
}

export async function updateGapPartial(
  q: DbConnector,
  id: string,
  patch: UpdateLearningGapBody,
): Promise<LearningGap | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.requiredProficiency !== undefined) addSet("learning_gap_required_proficiency", patch.requiredProficiency);
  if (patch.currentProficiency !== undefined) addSet("learning_gap_current_proficiency", patch.currentProficiency);
  if (patch.score !== undefined) addSet("learning_gap_score", patch.score);
  if (patch.severity !== undefined) addSet("learning_gap_severity", patch.severity);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`learning_gap_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findGapById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_learning_gaps SET ${sets.join(", ")}
      WHERE learning_gap_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toGap(res.rows[0]) : null;
}

export async function deleteGap(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_learning_gaps WHERE learning_gap_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
