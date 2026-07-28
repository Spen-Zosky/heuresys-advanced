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
  AddPositionKpiBody,
  UpdatePositionKpiBody,
  PositionIntelligenceProfile,
  PositionLearningRequirement,
  PositionLearningModule,
  PositionSkillRequirementHistory,
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

import { toDateOnly } from "../../lib/date-only.js";

function dateOnly(d: Date | null): string | null {
  return toDateOnly(d);
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
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(position_title ILIKE $${params.length} OR position_code ILIKE $${params.length})`);
  }
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
  skill_code?: string | null; // B-06: joined on the list query, undefined elsewhere
  skill_name?: string | null;
}

function rowToSkillReq(r: RawSkillReqRow): PositionSkillRequirement {
  return {
    requirementId: r.position_skill_requirement_id,
    positionId: r.position_id,
    tenantId: r.position_skill_requirement_tenant_id,
    skillId: r.skill_id,
    skillCode: r.skill_code ?? null,
    skillName: r.skill_name ?? null,
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
    `SELECT psr.position_skill_requirement_id, psr.position_id,
            psr.position_skill_requirement_tenant_id, psr.skill_id,
            psr.required_proficiency, psr.weight, psr.criticality,
            psr.position_skill_requirement_metadata, psr.created_at, psr.updated_at,
            s.skill_code, s.skill_name
       FROM sys.sys_position_skill_requirements psr
       LEFT JOIN sys.sys_skills s ON s.skill_id = psr.skill_id
      WHERE psr.position_id = $1 ORDER BY psr.criticality DESC, psr.weight DESC`,
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
  rank: number | null;
  position_kpi_requirement_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  kpi_definition_code?: string | null; // B-06: joined on the list query, undefined elsewhere
  kpi_definition_name?: string | null;
}

function rowToKpiReq(r: RawKpiReqRow): PositionKpiRequirement {
  return {
    requirementId: r.position_kpi_requirement_id,
    positionId: r.position_id,
    tenantId: r.position_kpi_requirement_tenant_id,
    kpiDefinitionId: r.kpi_definition_id,
    kpiCode: r.kpi_definition_code ?? null,
    kpiName: r.kpi_definition_name ?? null,
    targetTemplate: r.target_template,
    weight: Number(r.weight),
    rank: r.rank,
    metadata: r.position_kpi_requirement_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const KPI_REQ_COLS = `position_kpi_requirement_id, position_id,
  position_kpi_requirement_tenant_id, kpi_definition_id,
  target_template, weight, rank,
  position_kpi_requirement_metadata, created_at, updated_at`;

export async function listKpiRequirements(
  q: DbConnector,
  positionId: string,
): Promise<PositionKpiRequirement[]> {
  const res = await q.query<RawKpiReqRow>(
    `SELECT pkr.position_kpi_requirement_id, pkr.position_id,
            pkr.position_kpi_requirement_tenant_id, pkr.kpi_definition_id,
            pkr.target_template, pkr.weight, pkr.rank,
            pkr.position_kpi_requirement_metadata, pkr.created_at, pkr.updated_at,
            k.kpi_definition_code, k.kpi_definition_name
       FROM sys.sys_position_kpi_requirements pkr
       LEFT JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = pkr.kpi_definition_id
      WHERE pkr.position_id = $1
      ORDER BY pkr.rank NULLS LAST, pkr.weight DESC`,
    [positionId],
  );
  return res.rows.map(rowToKpiReq);
}

export async function findKpiRequirement(
  q: DbConnector,
  positionId: string,
  kpiDefinitionId: string,
): Promise<PositionKpiRequirement | null> {
  const res = await q.query<RawKpiReqRow>(
    `SELECT ${KPI_REQ_COLS} FROM sys.sys_position_kpi_requirements
      WHERE position_id = $1 AND kpi_definition_id = $2`,
    [positionId, kpiDefinitionId],
  );
  return res.rows[0] ? rowToKpiReq(res.rows[0]) : null;
}

export async function insertKpiRequirement(
  q: DbConnector,
  positionId: string,
  tenantId: string,
  body: AddPositionKpiBody,
  createdBy: string,
): Promise<PositionKpiRequirement> {
  const res = await q.query<RawKpiReqRow>(
    `INSERT INTO sys.sys_position_kpi_requirements (
        position_id, position_kpi_requirement_tenant_id, kpi_definition_id,
        target_template, weight, rank,
        position_kpi_requirement_metadata, created_by
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8)
      RETURNING ${KPI_REQ_COLS}`,
    [
      positionId,
      tenantId,
      body.kpiDefinitionId,
      JSON.stringify(body.targetTemplate ?? {}),
      body.weight,
      body.rank ?? null,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return rowToKpiReq(res.rows[0]!);
}

export async function updateKpiRequirement(
  q: DbConnector,
  positionId: string,
  kpiDefinitionId: string,
  patch: UpdatePositionKpiBody,
  updatedBy: string,
): Promise<PositionKpiRequirement | null> {
  // COALESCE keeps unspecified fields intact; rank is explicitly settable to NULL
  // via a sentinel (passing null clears it, undefined leaves it).
  const res = await q.query<RawKpiReqRow>(
    `UPDATE sys.sys_position_kpi_requirements SET
        target_template = COALESCE($3::jsonb, target_template),
        weight          = COALESCE($4, weight),
        rank            = CASE WHEN $5::boolean THEN $6 ELSE rank END,
        position_kpi_requirement_metadata = COALESCE($7::jsonb, position_kpi_requirement_metadata),
        updated_by      = $8,
        updated_at      = now()
      WHERE position_id = $1 AND kpi_definition_id = $2
      RETURNING ${KPI_REQ_COLS}`,
    [
      positionId,
      kpiDefinitionId,
      patch.targetTemplate !== undefined ? JSON.stringify(patch.targetTemplate) : null,
      patch.weight ?? null,
      patch.rank !== undefined, // rankProvided sentinel
      patch.rank ?? null,
      patch.metadata !== undefined ? JSON.stringify(patch.metadata) : null,
      updatedBy,
    ],
  );
  return res.rows[0] ? rowToKpiReq(res.rows[0]) : null;
}

export async function deleteKpiRequirement(
  q: DbConnector,
  positionId: string,
  kpiDefinitionId: string,
): Promise<boolean> {
  const res = await q.query(
    `DELETE FROM sys.sys_position_kpi_requirements
      WHERE position_id = $1 AND kpi_definition_id = $2`,
    [positionId, kpiDefinitionId],
  );
  return (res.rowCount ?? 0) === 1;
}

/* --- learning sub-resources (#25 A/L5, S1016) -------------------------- */

interface RawLearningReqRow {
  position_learning_requirement_id: string;
  position_id: string;
  position_learning_requirement_tenant_id: string;
  learning_path_id: string;
  is_mandatory: boolean;
  deadline_rule: Record<string, unknown>;
  position_learning_requirement_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  learning_path_code: string | null;
  learning_path_name: string | null;
}

export async function listLearningRequirements(
  q: DbConnector,
  positionId: string,
): Promise<PositionLearningRequirement[]> {
  const res = await q.query<RawLearningReqRow>(
    `SELECT plr.position_learning_requirement_id, plr.position_id,
            plr.position_learning_requirement_tenant_id, plr.learning_path_id,
            plr.is_mandatory, plr.deadline_rule,
            plr.position_learning_requirement_metadata, plr.created_at, plr.updated_at,
            lp.learning_path_code, lp.learning_path_name
       FROM sys.sys_position_learning_requirements plr
       LEFT JOIN sys.sys_learning_paths lp ON lp.learning_path_id = plr.learning_path_id
      WHERE plr.position_id = $1
      ORDER BY plr.is_mandatory DESC, lp.learning_path_name ASC NULLS LAST`,
    [positionId],
  );
  return res.rows.map((r) => ({
    requirementId: r.position_learning_requirement_id,
    positionId: r.position_id,
    tenantId: r.position_learning_requirement_tenant_id,
    learningPathId: r.learning_path_id,
    learningPathCode: r.learning_path_code ?? null,
    learningPathName: r.learning_path_name ?? null,
    isMandatory: r.is_mandatory,
    deadlineRule: r.deadline_rule,
    metadata: r.position_learning_requirement_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

interface RawLearningModuleRow {
  skill_id: string;
  skill_code: string | null;
  skill_name: string | null;
  required_proficiency: string;
  learning_module_id: string;
  learning_module_code: string | null;
  learning_module_title: string | null;
  learning_module_kind: string | null;
  learning_module_delivery: string | null;
  learning_module_duration_minutes: number | null;
  target_proficiency: string;
}

export async function listLearningModuleCoverage(
  q: DbConnector,
  positionId: string,
): Promise<PositionLearningModule[]> {
  const res = await q.query<RawLearningModuleRow>(
    `SELECT psr.skill_id, s.skill_code, s.skill_name, psr.required_proficiency,
            lm.learning_module_id, lm.learning_module_code, lm.learning_module_title,
            lm.learning_module_kind, lm.learning_module_delivery,
            lm.learning_module_duration_minutes,
            slm.skill_learning_mapping_target_proficiency AS target_proficiency
       FROM sys.sys_position_skill_requirements psr
       JOIN sys.sys_skill_learning_mappings slm
         ON slm.skill_learning_mapping_skill_id = psr.skill_id
       JOIN sys.sys_learning_modules lm
         ON lm.learning_module_id = slm.skill_learning_mapping_module_id
       LEFT JOIN sys.sys_skills s ON s.skill_id = psr.skill_id
      WHERE psr.position_id = $1
      ORDER BY s.skill_name ASC NULLS LAST, lm.learning_module_title ASC NULLS LAST`,
    [positionId],
  );
  return res.rows.map((r) => ({
    skillId: r.skill_id,
    skillCode: r.skill_code ?? null,
    skillName: r.skill_name ?? null,
    requiredProficiency: r.required_proficiency as PositionLearningModule["requiredProficiency"],
    learningModuleId: r.learning_module_id,
    learningModuleCode: r.learning_module_code ?? null,
    learningModuleTitle: r.learning_module_title ?? null,
    learningModuleKind: r.learning_module_kind ?? null,
    learningModuleDelivery: r.learning_module_delivery ?? null,
    learningModuleDurationMinutes:
      r.learning_module_duration_minutes === null ? null : Number(r.learning_module_duration_minutes),
    targetProficiency: r.target_proficiency as PositionLearningModule["targetProficiency"],
  }));
}

/**
 * Come sono cambiati nel tempo i requisiti di competenza di una posizione.
 * La tabella era popolata e nessun endpoint la leggeva: il profilo di ruolo
 * sembrava non essere mai cambiato.
 */
export async function listSkillRequirementHistory(
  q: DbConnector,
  positionId: string,
  tenantId: string | undefined,
): Promise<{ items: PositionSkillRequirementHistory[]; total: number }> {
  const res = await q.query<{
    h_id: string; position_id: string; skill_id: string; skill_name: string | null;
    old_prof: string | null; new_prof: string;
    old_weight: string | null; new_weight: string | null;
    reason: string | null; actor_id: string | null; actor_name: string | null;
    effective_at: Date;
  }>(
    `SELECT h.position_skill_requirement_history_id        AS h_id,
            h.position_skill_requirement_history_position_id AS position_id,
            h.position_skill_requirement_history_skill_id  AS skill_id,
            s.skill_name                                   AS skill_name,
            h.position_skill_requirement_history_old_proficiency AS old_prof,
            h.position_skill_requirement_history_new_proficiency AS new_prof,
            h.position_skill_requirement_history_old_weight AS old_weight,
            h.position_skill_requirement_history_new_weight AS new_weight,
            h.position_skill_requirement_history_change_reason AS reason,
            h.position_skill_requirement_history_actor_user_id AS actor_id,
            u.user_display_name                            AS actor_name,
            h.position_skill_requirement_history_effective_at AS effective_at
       FROM sys.sys_position_skill_requirement_history h
       LEFT JOIN sys.sys_skills s ON s.skill_id = h.position_skill_requirement_history_skill_id
       LEFT JOIN sys.sys_users  u ON u.user_id  = h.position_skill_requirement_history_actor_user_id
      WHERE h.position_skill_requirement_history_position_id = $1
        AND ($2::uuid IS NULL OR h.position_skill_requirement_history_tenant_id = $2)
      ORDER BY h.position_skill_requirement_history_effective_at DESC`,
    [positionId, tenantId ?? null],
  );
  const items = res.rows.map((r) => ({
    historyId: r.h_id,
    positionId: r.position_id,
    skillId: r.skill_id,
    skillName: r.skill_name,
    oldProficiency: r.old_prof,
    newProficiency: r.new_prof,
    oldWeight: r.old_weight === null ? null : Number(r.old_weight),
    newWeight: r.new_weight === null ? null : Number(r.new_weight),
    changeReason: r.reason,
    actorUserId: r.actor_id,
    actorDisplayName: r.actor_name,
    effectiveAt: r.effective_at.toISOString(),
  }));
  return { items, total: items.length };
}
