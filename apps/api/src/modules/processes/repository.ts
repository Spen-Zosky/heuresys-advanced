/**
 * apps/api/src/modules/processes/repository.ts
 *
 * I processi del tenant e la loro scheda (piano processi e progetti, V4). SQL parametrizzato su
 * sys_tenant_processes (000462, livello e genitore dalla 000498), sys_tenant_process_steps (le
 * attività), sys_organization_unit_processes (la partecipazione delle unità, RACI),
 * sys_process_participants (le persone), sys_process_kpi_templates (i KPI, legati al processo del
 * modello da cui il processo viene), sys_position_skill_requirements (le competenze delle posizioni
 * che eseguono), sys_approval_requests e sys_projects.
 *
 * Isolamento del tenant (I5): ogni lettura porta il tenant; `null` solo per un mandato di piattaforma.
 */
import { pool } from "../../db/client.js";
import type {
  TenantProcessActivity,
  TenantProcessListQuery,
  TenantProcessMatrixResponse,
  TenantProcessScheda,
  TenantProcessSummary,
  TenantProcessUnit,
} from "@heuresys/shared";

type Db = typeof pool;

/** «Cognome, Nome» (R1) da una riga di sys_users con alias `u`. */
const NOME_UTENTE = `COALESCE(nullif(concat_ws(', ', nullif(trim(u.user_last_name), ''), nullif(trim(u.user_first_name), '')), ''), nullif(trim(u.user_display_name), ''))`;

/** La riga di sintesi di un processo: chi lo tiene, quanti sottoprocessi, attività e unità. */
const SINTESI = `
  SELECT tp.tenant_process_id AS "processId",
         tp.tenant_process_tenant_id AS "tenantId",
         tn.tenant_name AS "tenantName",
         tp.tenant_process_code AS code,
         tp.tenant_process_name AS name,
         tp.tenant_process_description AS description,
         tp.tenant_process_level::int AS level,
         tp.tenant_process_parent_id AS "parentId",
         par.tenant_process_name AS "parentName",
         tp.tenant_process_is_active AS "isActive",
         tp.tenant_process_owner_position_id AS "ownerPositionId",
         op.position_title AS "ownerPositionTitle",
         (SELECT ${NOME_UTENTE}
            FROM sys.sys_user_position_assignments a
            JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
           WHERE a.user_position_assignment_position_id = tp.tenant_process_owner_position_id
             AND a.user_position_assignment_status = 'ACTIVE'
           ORDER BY (a.user_position_assignment_kind = 'PRIMARY') DESC,
                    a.user_position_assignment_start_date DESC NULLS LAST, a.user_position_assignment_user_id
           LIMIT 1) AS "ownerName",
         bp.blueprint_process_name AS "modelProcessName",
         (SELECT count(*)::int FROM sys.sys_tenant_processes c
           WHERE c.tenant_process_parent_id = tp.tenant_process_id AND c.tenant_process_is_active) AS "subprocessCount",
         (SELECT count(*)::int FROM sys.sys_tenant_process_steps st
           WHERE st.tenant_process_step_process_id = tp.tenant_process_id) AS "activityCount",
         (SELECT count(DISTINCT oup.org_unit_process_org_unit_id)::int FROM sys.sys_organization_unit_processes oup
           WHERE oup.org_unit_process_tenant_process_id = tp.tenant_process_id) AS "unitCount"
    FROM sys.sys_tenant_processes tp
    JOIN sys.sys_tenancies tn ON tn.tenant_id = tp.tenant_process_tenant_id
    LEFT JOIN sys.sys_tenant_processes par ON par.tenant_process_id = tp.tenant_process_parent_id
    LEFT JOIN sys.sys_positions op ON op.position_id = tp.tenant_process_owner_position_id
    LEFT JOIN sys.sys_blueprint_process_registry bp ON bp.blueprint_process_id = tp.tenant_process_source_blueprint_process_id`;

export async function listProcesses(db: Db, tenantId: string | null, q: TenantProcessListQuery): Promise<TenantProcessSummary[]> {
  const r = await db.query<TenantProcessSummary>(
    `${SINTESI}
      WHERE ($1::uuid IS NULL OR tp.tenant_process_tenant_id = $1::uuid)
        AND tp.tenant_process_is_active
        AND ($2::int IS NULL OR tp.tenant_process_level = $2::int)
        AND ($3::uuid IS NULL OR tp.tenant_process_parent_id = $3::uuid)
      ORDER BY tn.tenant_name, tp.tenant_process_name, tp.tenant_process_code`,
    [tenantId, q.level ?? null, q.parentId ?? null],
  );
  return r.rows;
}

export async function findProcess(db: Db, tenantId: string | null, id: string): Promise<TenantProcessSummary | null> {
  const r = await db.query<TenantProcessSummary>(
    `${SINTESI} WHERE tp.tenant_process_id = $2::uuid AND ($1::uuid IS NULL OR tp.tenant_process_tenant_id = $1::uuid)`,
    [tenantId, id],
  );
  return r.rows[0] ?? null;
}

/** Le attività del processo e dei suoi sottoprocessi (un solo livello sotto, 000498). */
export async function loadActivities(db: Db, ids: string[]): Promise<TenantProcessActivity[]> {
  const r = await db.query<TenantProcessActivity & { typicalHoursPerCycle: string | number | null }>(
    `SELECT st.tenant_process_step_id AS "activityId",
            st.tenant_process_step_process_id AS "processId",
            st.tenant_process_step_ordinal::int AS ordinal,
            st.tenant_process_step_code AS code,
            st.tenant_process_step_name AS name,
            st.tenant_process_step_input AS input,
            st.tenant_process_step_output AS output,
            st.tenant_process_step_org_unit_id AS "unitId",
            ou.organization_unit_name AS "unitName",
            st.tenant_process_step_executor_kind AS "executorKind",
            coalesce(pos.position_title, jr.job_role_name, st.tenant_process_step_executor_text) AS "executorName",
            st.tenant_process_step_executor_position_id AS "executorPositionId",
            st.tenant_process_step_executor_job_role_id AS "executorJobRoleId",
            st.tenant_process_step_work_nature AS "workNature",
            st.tenant_process_step_delivery_model AS "deliveryModel",
            st.tenant_process_step_typical_hours_per_cycle AS "typicalHoursPerCycle",
            nullif(st.tenant_process_step_metadata->>'apqc', '') AS "apqcCode",
            CASE WHEN m.tenant_process_step_mapping_id IS NULL THEN NULL
                 ELSE jsonb_build_object('kind', m.tenant_process_step_mapping_kind, 'criterion', m.tenant_process_step_mapping_criterion,
                                         'source', m.tenant_process_step_mapping_source, 'status', m.tenant_process_step_mapping_status)
            END AS "apqcMatch"
       FROM sys.sys_tenant_process_steps st
       LEFT JOIN sys.sys_tenant_process_step_mappings m
              ON m.tenant_process_step_mapping_step_id = st.tenant_process_step_id AND m.tenant_process_step_mapping_scheme = 'APQC_PCF'
       JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = st.tenant_process_step_process_id
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = st.tenant_process_step_org_unit_id
       LEFT JOIN sys.sys_positions pos ON pos.position_id = st.tenant_process_step_executor_position_id
       LEFT JOIN sys.sys_job_roles jr ON jr.job_role_id = st.tenant_process_step_executor_job_role_id
      WHERE st.tenant_process_step_process_id = ANY($1::uuid[])
      ORDER BY tp.tenant_process_level, tp.tenant_process_name, st.tenant_process_step_ordinal, st.tenant_process_step_code`,
    [ids],
  );
  return r.rows.map((x) => ({
    ...x,
    typicalHoursPerCycle: x.typicalHoursPerCycle === null ? null : Number(x.typicalHoursPerCycle),
  }));
}

/** Le unità che partecipano, con il loro ruolo e le persone che vi partecipano per conto loro. */
export async function loadUnits(db: Db, tenantId: string, ids: string[]): Promise<TenantProcessUnit[]> {
  const r = await db.query<{
    oupId: string; unitId: string; unitName: string; role: TenantProcessUnit["role"];
    userId: string | null; fullName: string | null; prole: TenantProcessUnit["role"] | null;
  }>(
    `SELECT oup.organization_unit_process_id AS "oupId",
            oup.org_unit_process_org_unit_id AS "unitId",
            ou.organization_unit_name AS "unitName",
            oup.org_unit_process_role AS role,
            pp.process_participant_user_id AS "userId",
            ${NOME_UTENTE} AS "fullName",
            pp.process_participant_role AS prole
       FROM sys.sys_organization_unit_processes oup
       JOIN sys.sys_organization_units ou ON ou.organization_unit_id = oup.org_unit_process_org_unit_id
       LEFT JOIN sys.sys_process_participants pp
              ON pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
             AND pp.process_participant_is_active
       LEFT JOIN sys.sys_users u ON u.user_id = pp.process_participant_user_id
      WHERE oup.org_unit_process_tenant_id = $1::uuid
        AND oup.org_unit_process_tenant_process_id = ANY($2::uuid[])
      ORDER BY CASE oup.org_unit_process_role WHEN 'OWNER' THEN 1 WHEN 'CONTRIBUTOR' THEN 2 WHEN 'CONSULTED' THEN 3 ELSE 4 END,
               ou.organization_unit_name, "fullName" NULLS LAST`,
    [tenantId, ids],
  );
  const perUnita = new Map<string, TenantProcessUnit>();
  for (const x of r.rows) {
    const chiave = `${x.unitId}|${x.role}`;
    let u = perUnita.get(chiave);
    if (!u) {
      u = { unitId: x.unitId, unitName: x.unitName, role: x.role, participants: [] };
      perUnita.set(chiave, u);
    }
    if (x.userId && x.prole && !u.participants.some((p) => p.userId === x.userId)) {
      u.participants.push({ userId: x.userId, fullName: x.fullName, role: x.prole });
    }
  }
  return [...perUnita.values()];
}

/** Un numero dal testo del database, o null se manca o non è un numero (mai NaN nel contratto). */
function numeroO(v: string | null): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** I KPI del processo: quelli del processo del modello da cui viene (sys_process_kpi_templates). */
export async function loadKpis(db: Db, tenantId: string, modelProcessIds: string[]): Promise<TenantProcessScheda["kpis"]> {
  if (modelProcessIds.length === 0) return [];
  const r = await db.query<{ kpiId: string; name: string; description: string | null; unit: string | null; t: string | null; w: string | null }>(
    `SELECT DISTINCT ON (k.kpi_definition_id)
            k.kpi_definition_id AS "kpiId", k.kpi_definition_name AS name,
            k.kpi_definition_description AS description, k.kpi_definition_unit AS unit,
            -- Il target del modello è jsonb: un numero, oppure {valore, unita, direzione} con il
            -- valore come testo. Number() sull'oggetto dava NaN e la scheda rispondeva 500 (20/11/2026).
            CASE jsonb_typeof(t.process_kpi_template_default_target)
              WHEN 'number' THEN t.process_kpi_template_default_target #>> '{}'
              WHEN 'object' THEN t.process_kpi_template_default_target ->> 'valore'
            END AS t,
            t.process_kpi_template_default_weight AS w
       FROM sys.sys_process_kpi_templates t
       JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.process_kpi_template_kpi_id
      WHERE t.process_kpi_template_process_id = ANY($2::uuid[])
        AND (k.kpi_definition_tenant_id IS NULL OR k.kpi_definition_tenant_id = $1::uuid)
      ORDER BY k.kpi_definition_id`,
    [tenantId, modelProcessIds],
  );
  return r.rows
    .map((x) => ({
      kpiId: x.kpiId, name: x.name, description: x.description, unit: x.unit,
      defaultTarget: numeroO(x.t),
      defaultWeight: numeroO(x.w),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
}

/** I processi del modello da cui vengono il processo e i suoi sottoprocessi. */
export async function modelProcessIds(db: Db, ids: string[]): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    `SELECT DISTINCT tenant_process_source_blueprint_process_id AS id
       FROM sys.sys_tenant_processes
      WHERE tenant_process_id = ANY($1::uuid[]) AND tenant_process_source_blueprint_process_id IS NOT NULL`,
    [ids],
  );
  return r.rows.map((x) => x.id);
}

/** Le competenze richieste dalle posizioni che eseguono attività del processo. */
export async function loadSkills(db: Db, tenantId: string, positionIds: string[]): Promise<TenantProcessScheda["skills"]> {
  if (positionIds.length === 0) return [];
  const r = await db.query<{ skillId: string; name: string; positions: number }>(
    `SELECT s.skill_id AS "skillId", s.skill_name AS name, count(DISTINCT psr.position_id)::int AS positions
       FROM sys.sys_position_skill_requirements psr
       JOIN sys.sys_skills s ON s.skill_id = psr.skill_id
      WHERE psr.position_skill_requirement_tenant_id = $1::uuid
        AND psr.position_id = ANY($2::uuid[])
      GROUP BY 1, 2
      ORDER BY 3 DESC, 2`,
    [tenantId, positionIds],
  );
  return r.rows;
}

export async function countApprovals(db: Db, tenantId: string, ids: string[]): Promise<{ pending: number; total: number }> {
  const r = await db.query<{ pending: number; total: number }>(
    `SELECT count(*) FILTER (WHERE approval_request_status = 'PENDING')::int AS pending, count(*)::int AS total
       FROM sys.sys_approval_requests
      WHERE approval_request_tenant_id = $1::uuid AND approval_request_tenant_process_id = ANY($2::uuid[])`,
    [tenantId, ids],
  );
  return r.rows[0] ?? { pending: 0, total: 0 };
}

export async function loadProjects(db: Db, tenantId: string, ids: string[]): Promise<TenantProcessScheda["projects"]> {
  const r = await db.query<TenantProcessScheda["projects"][number]>(
    `SELECT project_id AS "projectId", project_code AS code, project_name AS name, project_status AS status
       FROM sys.sys_projects
      WHERE project_tenant_id = $1::uuid AND project_tenant_process_id = ANY($2::uuid[])
      ORDER BY project_name`,
    [tenantId, ids],
  );
  return r.rows;
}

/**
 * La matrice processi × unità del tenant: i processi attivi (i sottoprocessi subito sotto il loro
 * processo), le unità che partecipano ad almeno un processo e, per ogni coppia, il ruolo più forte
 * (OWNER > CONTRIBUTOR > CONSULTED > INFORMED).
 */
export async function loadMatrix(db: Db, tenantId: string): Promise<TenantProcessMatrixResponse> {
  const [pr, ce] = await Promise.all([
    db.query<TenantProcessMatrixResponse["processes"][number]>(
      `SELECT tp.tenant_process_id AS "processId", tp.tenant_process_code AS code, tp.tenant_process_name AS name,
              tp.tenant_process_level::int AS level, tp.tenant_process_parent_id AS "parentId"
         FROM sys.sys_tenant_processes tp
        WHERE tp.tenant_process_tenant_id = $1::uuid AND tp.tenant_process_is_active
        ORDER BY coalesce((SELECT p.tenant_process_name FROM sys.sys_tenant_processes p WHERE p.tenant_process_id = tp.tenant_process_parent_id), tp.tenant_process_name),
                 tp.tenant_process_level, tp.tenant_process_name, tp.tenant_process_code`,
      [tenantId],
    ),
    db.query<TenantProcessMatrixResponse["cells"][number] & { unitName: string; unitCode: string | null }>(
      `SELECT DISTINCT ON (oup.org_unit_process_tenant_process_id, oup.org_unit_process_org_unit_id)
              oup.org_unit_process_tenant_process_id AS "processId",
              oup.org_unit_process_org_unit_id AS "unitId",
              oup.org_unit_process_role AS role,
              ou.organization_unit_name AS "unitName",
              ou.organization_unit_code AS "unitCode"
         FROM sys.sys_organization_unit_processes oup
         JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = oup.org_unit_process_tenant_process_id AND tp.tenant_process_is_active
         JOIN sys.sys_organization_units ou ON ou.organization_unit_id = oup.org_unit_process_org_unit_id
        WHERE oup.org_unit_process_tenant_id = $1::uuid
        ORDER BY oup.org_unit_process_tenant_process_id, oup.org_unit_process_org_unit_id,
                 CASE oup.org_unit_process_role WHEN 'OWNER' THEN 1 WHEN 'CONTRIBUTOR' THEN 2 WHEN 'CONSULTED' THEN 3 ELSE 4 END`,
      [tenantId],
    ),
  ]);
  const unita = new Map<string, { unitId: string; name: string; code: string | null }>();
  for (const c of ce.rows) unita.set(c.unitId, { unitId: c.unitId, name: c.unitName, code: c.unitCode });
  return {
    tenantId,
    processes: pr.rows,
    units: [...unita.values()].sort((a, b) => a.name.localeCompare(b.name, "it") || a.unitId.localeCompare(b.unitId)),
    cells: ce.rows.map((c) => ({ processId: c.processId, unitId: c.unitId, role: c.role })),
  };
}
