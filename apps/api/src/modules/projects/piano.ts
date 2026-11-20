/**
 * apps/api/src/modules/projects/piano.ts
 * Il piano di un progetto (V6/V7, migrazione 000503): fasi, attività, tappe e dipendenze.
 * SQL parametrizzato grezzo; le date escono come testo `YYYY-MM-DD` (RD-09: niente Date di JS,
 * che sposterebbe il giorno con il fuso). Ogni scrittura porta il progetto e il tenant, e controlla
 * che fase, genitore, appartenenza e attività di processo stiano nello stesso progetto o tenant.
 */
import type { Pool, PoolClient } from "pg";
import type {
  ProjectDependency,
  ProjectDependencyCreateBody,
  ProjectPhase,
  ProjectPhaseCreateBody,
  ProjectPhaseUpdateBody,
} from "@heuresys/shared";

type Eseguibile = Pool | PoolClient;

const NOME = `COALESCE(nullif(concat_ws(', ', nullif(trim(u.user_last_name), ''), nullif(trim(u.user_first_name), '')), ''), nullif(trim(u.user_display_name), ''))`;
const D = (c: string) => `to_char(${c}, 'YYYY-MM-DD')`;

const FASE = `
  SELECT f.project_phase_id AS "phaseId", f.project_phase_project_id AS "projectId",
         f.project_phase_parent_id AS "parentId", f.project_phase_kind AS kind,
         f.project_phase_ordinal AS ordinal, f.project_phase_name AS name,
         f.project_phase_description AS description,
         ${D("f.project_phase_planned_start")} AS "plannedStart", ${D("f.project_phase_planned_end")} AS "plannedEnd",
         ${D("f.project_phase_actual_start")} AS "actualStart", ${D("f.project_phase_actual_end")} AS "actualEnd",
         f.project_phase_progress_pct::float8 AS "progressPct", f.project_phase_status AS status,
         f.project_phase_owner_member_id AS "ownerMemberId", ${NOME} AS "ownerName",
         f.project_phase_process_step_id AS "processStepId", st.tenant_process_step_name AS "processStepName"
    FROM sys.sys_project_phases f
    LEFT JOIN sys.sys_project_members m ON m.project_member_id = f.project_phase_owner_member_id
    LEFT JOIN sys.sys_users u ON u.user_id = m.project_member_user_id
    LEFT JOIN sys.sys_tenant_process_steps st ON st.tenant_process_step_id = f.project_phase_process_step_id`;

/** Le fasi in ordine di albero: genitore prima dei figli, fratelli per ordine e data. */
export async function loadPhases(db: Eseguibile, projectId: string): Promise<ProjectPhase[]> {
  const r = await db.query<ProjectPhase>(
    `WITH RECURSIVE albero AS (
       SELECT project_phase_id, ARRAY[project_phase_ordinal, 0]::int[] AS via, ARRAY[project_phase_id] AS giro
         FROM sys.sys_project_phases WHERE project_phase_project_id = $1 AND project_phase_parent_id IS NULL
       UNION ALL
       SELECT c.project_phase_id, a.via || ARRAY[c.project_phase_ordinal, 0], a.giro || c.project_phase_id
         FROM sys.sys_project_phases c JOIN albero a ON c.project_phase_parent_id = a.project_phase_id
        WHERE NOT c.project_phase_id = ANY(a.giro)
     )
     ${FASE}
     JOIN albero a ON a.project_phase_id = f.project_phase_id
     ORDER BY a.via, f.project_phase_planned_start NULLS LAST, f.project_phase_name`,
    [projectId],
  );
  return r.rows;
}

export async function findPhase(db: Eseguibile, projectId: string, phaseId: string): Promise<ProjectPhase | null> {
  const r = await db.query<ProjectPhase>(`${FASE} WHERE f.project_phase_project_id = $1 AND f.project_phase_id = $2`, [projectId, phaseId]);
  return r.rows[0] ?? null;
}

export async function loadDependencies(db: Eseguibile, projectId: string): Promise<ProjectDependency[]> {
  const r = await db.query<ProjectDependency>(
    `SELECT project_dependency_id AS "dependencyId", project_dependency_predecessor_id AS "predecessorId",
            project_dependency_successor_id AS "successorId", project_dependency_kind AS kind,
            project_dependency_lag_days AS "lagDays"
       FROM sys.sys_project_dependencies WHERE project_dependency_project_id = $1
      ORDER BY created_at, project_dependency_id`,
    [projectId],
  );
  return r.rows;
}

export async function projectProcessId(db: Eseguibile, projectId: string): Promise<string | null> {
  const r = await db.query<{ id: string | null }>(`SELECT project_tenant_process_id AS id FROM sys.sys_projects WHERE project_id = $1`, [projectId]);
  return r.rows[0]?.id ?? null;
}

/** I riferimenti di una fase stanno nello stesso progetto (genitore, appartenenza) o tenant (attività di processo). */
export async function riferimentiValidi(
  db: Eseguibile, projectId: string, tenantId: string,
  ref: { parentId?: string | null; ownerMemberId?: string | null; processStepId?: string | null },
): Promise<string | null> {
  if (ref.parentId) {
    const r = await db.query(`SELECT 1 FROM sys.sys_project_phases WHERE project_phase_id = $1 AND project_phase_project_id = $2`, [ref.parentId, projectId]);
    if (r.rowCount !== 1) return "parentId";
  }
  if (ref.ownerMemberId) {
    const r = await db.query(`SELECT 1 FROM sys.sys_project_members WHERE project_member_id = $1 AND project_member_project_id = $2`, [ref.ownerMemberId, projectId]);
    if (r.rowCount !== 1) return "ownerMemberId";
  }
  if (ref.processStepId) {
    const r = await db.query(`SELECT 1 FROM sys.sys_tenant_process_steps WHERE tenant_process_step_id = $1 AND tenant_process_step_tenant_id = $2`, [ref.processStepId, tenantId]);
    if (r.rowCount !== 1) return "processStepId";
  }
  return null;
}

/** Il genitore proposto non è la fase stessa né una sua discendente (niente cicli). */
export async function creaCiclo(db: Eseguibile, phaseId: string, parentId: string): Promise<boolean> {
  const r = await db.query(
    `WITH RECURSIVE su AS (
       SELECT project_phase_id, project_phase_parent_id FROM sys.sys_project_phases WHERE project_phase_id = $2
       UNION ALL
       SELECT p.project_phase_id, p.project_phase_parent_id FROM sys.sys_project_phases p JOIN su ON p.project_phase_id = su.project_phase_parent_id
     ) SELECT 1 FROM su WHERE project_phase_id = $1 LIMIT 1`,
    [phaseId, parentId],
  );
  return r.rowCount === 1;
}

const COLONNA: Record<keyof ProjectPhaseUpdateBody, string> = {
  parentId: "project_phase_parent_id",
  kind: "project_phase_kind",
  ordinal: "project_phase_ordinal",
  name: "project_phase_name",
  description: "project_phase_description",
  plannedStart: "project_phase_planned_start",
  plannedEnd: "project_phase_planned_end",
  actualStart: "project_phase_actual_start",
  actualEnd: "project_phase_actual_end",
  progressPct: "project_phase_progress_pct",
  status: "project_phase_status",
  ownerMemberId: "project_phase_owner_member_id",
  processStepId: "project_phase_process_step_id",
};

export async function insertPhase(db: Eseguibile, projectId: string, tenantId: string, b: ProjectPhaseCreateBody): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO sys.sys_project_phases
       (project_phase_project_id, project_phase_tenant_id, project_phase_parent_id, project_phase_kind,
        project_phase_ordinal, project_phase_name, project_phase_description,
        project_phase_planned_start, project_phase_planned_end, project_phase_actual_start, project_phase_actual_end,
        project_phase_progress_pct, project_phase_status, project_phase_owner_member_id, project_phase_process_step_id)
     VALUES ($1, $2, $3, $4,
             COALESCE($5, (SELECT COALESCE(max(project_phase_ordinal), 0) + 1 FROM sys.sys_project_phases
                            WHERE project_phase_project_id = $1 AND project_phase_parent_id IS NOT DISTINCT FROM $3::uuid)),
             $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING project_phase_id AS id`,
    [projectId, tenantId, b.parentId ?? null, b.kind ?? "ACTIVITY", b.ordinal ?? null, b.name, b.description ?? null,
     b.plannedStart ?? null, b.plannedEnd ?? null, b.actualStart ?? null, b.actualEnd ?? null,
     b.progressPct ?? null, b.status ?? "PLANNED", b.ownerMemberId ?? null, b.processStepId ?? null],
  );
  return r.rows[0]!.id;
}

export async function updatePhase(db: Eseguibile, projectId: string, phaseId: string, b: ProjectPhaseUpdateBody): Promise<void> {
  const set: string[] = [];
  const vals: unknown[] = [projectId, phaseId];
  for (const [k, col] of Object.entries(COLONNA) as Array<[keyof ProjectPhaseUpdateBody, string]>) {
    if (b[k] === undefined) continue;
    vals.push(b[k]);
    set.push(`${col} = $${vals.length}`);
  }
  if (set.length === 0) return;
  await db.query(
    `UPDATE sys.sys_project_phases SET ${set.join(", ")}, updated_at = now()
      WHERE project_phase_project_id = $1 AND project_phase_id = $2`,
    vals,
  );
}

export async function deletePhase(db: Eseguibile, projectId: string, phaseId: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM sys.sys_project_phases WHERE project_phase_project_id = $1 AND project_phase_id = $2`, [projectId, phaseId]);
  return r.rowCount === 1;
}

export async function insertDependency(db: Eseguibile, projectId: string, tenantId: string, b: ProjectDependencyCreateBody): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO sys.sys_project_dependencies
       (project_dependency_project_id, project_dependency_tenant_id, project_dependency_predecessor_id,
        project_dependency_successor_id, project_dependency_kind, project_dependency_lag_days)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING project_dependency_id AS id`,
    [projectId, tenantId, b.predecessorId, b.successorId, b.kind ?? "FS", b.lagDays ?? 0],
  );
  return r.rows[0]!.id;
}

/** Se aggiungere «successore dipende da predecessore» chiuderebbe un giro di dipendenze. */
export async function dipendenzaCircolare(db: Eseguibile, predecessorId: string, successorId: string): Promise<boolean> {
  const r = await db.query(
    `WITH RECURSIVE dopo AS (
       SELECT project_dependency_successor_id AS id FROM sys.sys_project_dependencies WHERE project_dependency_predecessor_id = $1
       UNION
       SELECT d.project_dependency_successor_id FROM sys.sys_project_dependencies d JOIN dopo ON d.project_dependency_predecessor_id = dopo.id
     ) SELECT 1 FROM dopo WHERE id = $2 LIMIT 1`,
    [successorId, predecessorId],
  );
  return r.rowCount === 1;
}

export async function deleteDependency(db: Eseguibile, projectId: string, dependencyId: string): Promise<boolean> {
  const r = await db.query(`DELETE FROM sys.sys_project_dependencies WHERE project_dependency_project_id = $1 AND project_dependency_id = $2`, [projectId, dependencyId]);
  return r.rowCount === 1;
}
