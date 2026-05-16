/**
 * apps/api/src/modules/positions/repository.ts
 * Raw SQL for sys.sys_positions + sys.sys_position_skill_requirements +
 * sys.sys_position_kpi_requirements + sys.sys_position_intelligence_profiles_v.
 */

import type { Pool, PoolClient } from "pg";
import type {
  Position,
  PositionListQuery,
  CreatePositionBody,
  UpdatePositionBody,
  PositionSkillRequirement,
  AddPositionSkillBody,
  PositionKpiRequirement,
  PositionIntelligenceProfile,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface RawPositionRow {
  position_id: string;
  position_tenant_id: string;
  position_code: string;
  position_title: string;
  position_organization_unit_id: string | null;
  position_job_role_id: string | null;
  position_reports_to_position_id: string | null;
  position_owner_user_id: string | null;
  position_esco_occupation_uri: string | null;
  position_criticality: string | null;
  position_economic_weight: string | null;
  position_is_active: boolean;
  position_effective_from: Date;
  position_effective_to: Date | null;
  position_metadata: Record<string, unknown>;
  position_ai_hints: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function dateOnly(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function rowToPosition(r: RawPositionRow): Position {
  return {
    positionId: r.position_id,
    tenantId: r.position_tenant_id,
    code: r.position_code,
    title: r.position_title,
    organizationUnitId: r.position_organization_unit_id,
    jobRoleId: r.position_job_role_id,
    reportsToPositionId: r.position_reports_to_position_id,
    ownerUserId: r.position_owner_user_id,
    escoOccupationUri: r.position_esco_occupation_uri,
    criticality: r.position_criticality as Position["criticality"],
    economicWeight: r.position_economic_weight === null ? null : Number(r.position_economic_weight),
    isActive: r.position_is_active,
    effectiveFrom: dateOnly(r.position_effective_from)!,
    effectiveTo: dateOnly(r.position_effective_to),
    metadata: r.position_metadata,
    aiHints: r.position_ai_hints,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const POSITION_COLS = `position_id, position_tenant_id, position_code, position_title,
  position_organization_unit_id, position_job_role_id, position_reports_to_position_id,
  position_owner_user_id, position_esco_occupation_uri, position_criticality,
  position_economic_weight, position_is_active, position_effective_from,
  position_effective_to, position_metadata, position_ai_hints, created_at, updated_at`;

/* === Read =============================================================== */

export interface ListFilter {
  tenantId?: string;
  query: PositionListQuery;
}

export async function listPositions(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: Position[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, value: unknown) => {
    params.push(value);
    where.push(`${col} = $${params.length}`);
  };
  if (filter.tenantId) add("position_tenant_id", filter.tenantId);
  if (filter.query.isActive !== undefined) add("position_is_active", filter.query.isActive);
  if (filter.query.criticality) add("position_criticality", filter.query.criticality);
  if (filter.query.organizationUnitId) add("position_organization_unit_id", filter.query.organizationUnitId);
  if (filter.query.jobRoleId) add("position_job_role_id", filter.query.jobRoleId);
  if (filter.query.ownerUserId) add("position_owner_user_id", filter.query.ownerUserId);
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_positions ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limitIdx = params.length;
  params.push(filter.query.offset);
  const offsetIdx = params.length;

  const res = await q.query<RawPositionRow>(
    `SELECT ${POSITION_COLS} FROM sys.sys_positions ${whereClause}
      ORDER BY position_code LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );
  return { items: res.rows.map(rowToPosition), total };
}

export async function findPositionById(
  q: DbConnector,
  positionId: string,
): Promise<Position | null> {
  const res = await q.query<RawPositionRow>(
    `SELECT ${POSITION_COLS} FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  return res.rows[0] ? rowToPosition(res.rows[0]) : null;
}

export async function findPositionByCodeInTenant(
  q: DbConnector,
  tenantId: string,
  code: string,
): Promise<Position | null> {
  const res = await q.query<RawPositionRow>(
    `SELECT ${POSITION_COLS} FROM sys.sys_positions
      WHERE position_tenant_id = $1 AND position_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? rowToPosition(res.rows[0]) : null;
}

/* === Create ============================================================ */

export async function insertPosition(
  q: DbConnector,
  tenantId: string,
  body: CreatePositionBody,
  createdBy: string,
): Promise<Position> {
  const res = await q.query<RawPositionRow>(
    `INSERT INTO sys.sys_positions (
        position_tenant_id, position_code, position_title,
        position_organization_unit_id, position_job_role_id,
        position_reports_to_position_id, position_owner_user_id,
        position_esco_occupation_uri, position_criticality,
        position_economic_weight, position_is_active,
        position_effective_from, position_effective_to,
        position_metadata, position_ai_hints, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                COALESCE($12::date, CURRENT_DATE), $13, $14::jsonb, $15::jsonb, $16)
      RETURNING ${POSITION_COLS}`,
    [
      tenantId,
      body.code,
      body.title,
      body.organizationUnitId ?? null,
      body.jobRoleId ?? null,
      body.reportsToPositionId ?? null,
      body.ownerUserId ?? null,
      body.escoOccupationUri ?? null,
      body.criticality ?? null,
      body.economicWeight ?? null,
      body.isActive,
      body.effectiveFrom ?? null,
      body.effectiveTo ?? null,
      JSON.stringify(body.metadata ?? {}),
      JSON.stringify(body.aiHints ?? {}),
      createdBy,
    ],
  );
  return rowToPosition(res.rows[0]!);
}

/* === Update (partial) ================================================== */

export async function updatePositionPartial(
  q: DbConnector,
  positionId: string,
  patch: UpdatePositionBody,
  updatedBy: string,
): Promise<Position | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) addSet("position_title", patch.title);
  if (patch.organizationUnitId !== undefined) addSet("position_organization_unit_id", patch.organizationUnitId);
  if (patch.jobRoleId !== undefined) addSet("position_job_role_id", patch.jobRoleId);
  if (patch.reportsToPositionId !== undefined) addSet("position_reports_to_position_id", patch.reportsToPositionId);
  if (patch.ownerUserId !== undefined) addSet("position_owner_user_id", patch.ownerUserId);
  if (patch.escoOccupationUri !== undefined) addSet("position_esco_occupation_uri", patch.escoOccupationUri);
  if (patch.criticality !== undefined) addSet("position_criticality", patch.criticality);
  if (patch.economicWeight !== undefined) addSet("position_economic_weight", patch.economicWeight);
  if (patch.isActive !== undefined) addSet("position_is_active", patch.isActive);
  if (patch.effectiveFrom !== undefined) addSet("position_effective_from", patch.effectiveFrom);
  if (patch.effectiveTo !== undefined) addSet("position_effective_to", patch.effectiveTo);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`position_metadata = $${params.length}::jsonb`);
  }
  if (patch.aiHints !== undefined) {
    params.push(JSON.stringify(patch.aiHints));
    sets.push(`position_ai_hints = $${params.length}::jsonb`);
  }

  if (sets.length === 0) return findPositionById(q, positionId);

  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(positionId);
  const res = await q.query<RawPositionRow>(
    `UPDATE sys.sys_positions SET ${sets.join(", ")}
      WHERE position_id = $${params.length}
      RETURNING ${POSITION_COLS}`,
    params,
  );
  return res.rows[0] ? rowToPosition(res.rows[0]) : null;
}

/* === Soft delete (position_is_active=false) ============================ */

export async function softDeletePosition(
  q: DbConnector,
  positionId: string,
): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_positions
        SET position_is_active = false, updated_at = now()
      WHERE position_id = $1 AND position_is_active = true`,
    [positionId],
  );
  return (res.rowCount ?? 0) === 1;
}

/* === Intelligence Profile (PIP view) =================================== */

interface RawPipRow {
  position_id: string;
  position_tenant_id: string;
  position_code: string;
  position_title: string;
  position_organization_unit_id: string | null;
  position_job_role_id: string | null;
  position_owner_user_id: string | null;
  position_reports_to_position_id: string | null;
  position_esco_occupation_uri: string | null;
  position_criticality: string | null;
  position_economic_weight: string | null;
  position_is_active: boolean;
  position_effective_from: Date;
  position_effective_to: Date | null;
  required_skills: unknown;
  required_kpis: unknown;
  required_learning_paths: unknown;
  career_paths: unknown;
  compensation_profile: unknown;
  succession_relevance: unknown;
  position_ai_hints: Record<string, unknown>;
  updated_at: Date;
}

export async function findIntelligenceProfile(
  q: DbConnector,
  positionId: string,
): Promise<PositionIntelligenceProfile | null> {
  const res = await q.query<RawPipRow>(
    `SELECT * FROM sys.sys_position_intelligence_profiles_v WHERE position_id = $1`,
    [positionId],
  );
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return {
    positionId: r.position_id,
    tenantId: r.position_tenant_id,
    code: r.position_code,
    title: r.position_title,
    organizationUnitId: r.position_organization_unit_id,
    jobRoleId: r.position_job_role_id,
    ownerUserId: r.position_owner_user_id,
    reportsToPositionId: r.position_reports_to_position_id,
    escoOccupationUri: r.position_esco_occupation_uri,
    criticality: r.position_criticality as PositionIntelligenceProfile["criticality"],
    economicWeight: r.position_economic_weight === null ? null : Number(r.position_economic_weight),
    isActive: r.position_is_active,
    effectiveFrom: dateOnly(r.position_effective_from)!,
    effectiveTo: dateOnly(r.position_effective_to),
    requiredSkills: r.required_skills,
    requiredKpis: r.required_kpis,
    requiredLearningPaths: r.required_learning_paths,
    careerPaths: r.career_paths,
    compensationProfile: r.compensation_profile,
    successionRelevance: r.succession_relevance,
    aiHints: r.position_ai_hints,
    updatedAt: r.updated_at.toISOString(),
  };
}

/* === Skill requirements (sub-resource CRUD) ============================ */

interface RawSkillReqRow {
  position_skill_requirement_id: string;
  position_id: string;
  position_skill_requirement_tenant_id: string;
  skill_id: string;
  required_proficiency: string;
  weight: string;
  criticality: string;
  position_skill_requirement_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function rowToSkillReq(r: RawSkillReqRow): PositionSkillRequirement {
  return {
    requirementId: r.position_skill_requirement_id,
    positionId: r.position_id,
    tenantId: r.position_skill_requirement_tenant_id,
    skillId: r.skill_id,
    requiredProficiency: r.required_proficiency as PositionSkillRequirement["requiredProficiency"],
    weight: Number(r.weight),
    criticality: r.criticality as PositionSkillRequirement["criticality"],
    metadata: r.position_skill_requirement_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const SKILL_REQ_COLS = `position_skill_requirement_id, position_id,
  position_skill_requirement_tenant_id, skill_id, required_proficiency,
  weight, criticality, position_skill_requirement_metadata,
  created_at, updated_at`;

export async function listSkillRequirements(
  q: DbConnector,
  positionId: string,
): Promise<PositionSkillRequirement[]> {
  const res = await q.query<RawSkillReqRow>(
    `SELECT ${SKILL_REQ_COLS} FROM sys.sys_position_skill_requirements
      WHERE position_id = $1 ORDER BY criticality DESC, weight DESC`,
    [positionId],
  );
  return res.rows.map(rowToSkillReq);
}

export async function findSkillRequirement(
  q: DbConnector,
  positionId: string,
  skillId: string,
): Promise<PositionSkillRequirement | null> {
  const res = await q.query<RawSkillReqRow>(
    `SELECT ${SKILL_REQ_COLS} FROM sys.sys_position_skill_requirements
      WHERE position_id = $1 AND skill_id = $2`,
    [positionId, skillId],
  );
  return res.rows[0] ? rowToSkillReq(res.rows[0]) : null;
}

export async function insertSkillRequirement(
  q: DbConnector,
  positionId: string,
  tenantId: string,
  body: AddPositionSkillBody,
  createdBy: string,
): Promise<PositionSkillRequirement> {
  const res = await q.query<RawSkillReqRow>(
    `INSERT INTO sys.sys_position_skill_requirements (
        position_id, position_skill_requirement_tenant_id, skill_id,
        required_proficiency, weight, criticality,
        position_skill_requirement_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING ${SKILL_REQ_COLS}`,
    [
      positionId,
      tenantId,
      body.skillId,
      body.requiredProficiency,
      body.weight,
      body.criticality,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return rowToSkillReq(res.rows[0]!);
}

export async function deleteSkillRequirement(
  q: DbConnector,
  positionId: string,
  skillId: string,
): Promise<boolean> {
  const res = await q.query(
    `DELETE FROM sys.sys_position_skill_requirements
      WHERE position_id = $1 AND skill_id = $2`,
    [positionId, skillId],
  );
  return (res.rowCount ?? 0) === 1;
}

/* === KPI requirements (read-only for MVP-1) ============================ */

interface RawKpiReqRow {
  position_kpi_requirement_id: string;
  position_id: string;
  position_kpi_requirement_tenant_id: string;
  kpi_definition_id: string;
  target_template: Record<string, unknown>;
  weight: string;
  position_kpi_requirement_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function rowToKpiReq(r: RawKpiReqRow): PositionKpiRequirement {
  return {
    requirementId: r.position_kpi_requirement_id,
    positionId: r.position_id,
    tenantId: r.position_kpi_requirement_tenant_id,
    kpiDefinitionId: r.kpi_definition_id,
    targetTemplate: r.target_template,
    weight: Number(r.weight),
    metadata: r.position_kpi_requirement_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listKpiRequirements(
  q: DbConnector,
  positionId: string,
): Promise<PositionKpiRequirement[]> {
  const res = await q.query<RawKpiReqRow>(
    `SELECT position_kpi_requirement_id, position_id,
            position_kpi_requirement_tenant_id, kpi_definition_id,
            target_template, weight,
            position_kpi_requirement_metadata, created_at, updated_at
       FROM sys.sys_position_kpi_requirements
      WHERE position_id = $1 ORDER BY weight DESC`,
    [positionId],
  );
  return res.rows.map(rowToKpiReq);
}
