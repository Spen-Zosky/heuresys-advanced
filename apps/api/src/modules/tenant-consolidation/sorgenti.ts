/**
 * apps/api/src/modules/tenant-consolidation/sorgenti.ts — AC-8 (prima metà).
 *
 * Le voci dei due lati, gruppo per gruppo: il tenant dalle sue tabelle, il prototipo dalla
 * versione fissata dalla sessione (`sys_blueprint_content_*`, processi in
 * `sys_blueprint_process_registry` unici per versione dalla 000463). Le tabelle sono quelle
 * misurate in AC-0 (disegno §4).
 *
 * L'ELENCO DELLE COLONNE È CHIUSO (specifica §7): nome, codice, descrizione, tipo, livello,
 * voce madre, indirizzo ESCO, attività. Nessuna query qui seleziona un identificativo di
 * persona (responsabile di unità, titolare, proprietario): ciò che non si legge non può finire
 * nel lotto del giudice. Le chiavi del tenant sono gli identificativi delle righe, quelle del
 * prototipo i codici, che sono la chiave stabile di una versione.
 *
 * Gruppo 5: il tenant porta i suoi indicatori; il prototipo indicatori e modelli di obiettivo.
 * Gli obiettivi assegnati alle persone sono dati di gestione, non struttura (misura di AC-0).
 */
import type { ConsolidationGroup } from "@heuresys/shared";
import type { DbConnector } from "./repository.js";
import type { Voce } from "./engine.js";

interface Riga {
  key: string;
  name: string;
  code: string | null;
  description: string | null;
  type: string | null;
  level: string | null;
  parent_name: string | null;
  esco_uri: string | null;
  activities: string[] | null;
}

function voce(r: Riga): Voce {
  return {
    key: r.key,
    name: r.name,
    code: r.code,
    description: r.description ? r.description.slice(0, 4000) : null,
    type: r.type,
    level: r.level,
    parentName: r.parent_name,
    escoUri: r.esco_uri,
    ...(r.activities && r.activities.length > 0 ? { activities: r.activities.slice(0, 50) } : {}),
  };
}

const TENANT: Record<ConsolidationGroup, string> = {
  ORGANIZATION: `
    SELECT u.organization_unit_id::text AS key, u.organization_unit_name AS name, u.organization_unit_code AS code,
           NULL::text AS description, u.organization_unit_type AS type,
           u.organization_unit_metadata->>'org_level' AS level, pu.organization_unit_name AS parent_name,
           NULL::text AS esco_uri, NULL::text[] AS activities
      FROM sys.sys_organization_units u
      LEFT JOIN sys.sys_organization_units pu ON pu.organization_unit_id = u.organization_unit_parent_id
     WHERE u.organization_unit_tenant_id = $1 AND u.organization_unit_is_active
     ORDER BY u.organization_unit_code`,
  POSITIONS_ROLES: `
    SELECT p.position_id::text AS key, p.position_title AS name, p.position_code AS code,
           NULL::text AS description, jr.job_role_name AS type, jr.job_role_seniority_level::text AS level,
           u.organization_unit_name AS parent_name,
           coalesce(p.position_esco_occupation_uri, jr.job_role_metadata->>'esco_occupation_code') AS esco_uri,
           NULL::text[] AS activities
      FROM sys.sys_positions p
      LEFT JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
      LEFT JOIN sys.sys_organization_units u ON u.organization_unit_id = p.position_organization_unit_id
     WHERE p.position_tenant_id = $1 AND p.position_is_active
     ORDER BY p.position_code`,
  // Le competenze del tenant sono le sue e quelle globali che le sue posizioni chiedono.
  SKILLS: `
    SELECT s.skill_id::text AS key, s.skill_name AS name, s.skill_code AS code, s.skill_description AS description,
           NULL::text AS type, NULL::text AS level, NULL::text AS parent_name, s.skill_esco_uri AS esco_uri,
           NULL::text[] AS activities
      FROM sys.sys_skills s
     WHERE s.skill_tenant_id = $1
        OR s.skill_id IN (SELECT psr.skill_id FROM sys.sys_position_skill_requirements psr
                            JOIN sys.sys_positions p ON p.position_id = psr.position_id
                           WHERE p.position_tenant_id = $1)
     ORDER BY s.skill_code`,
  PROCESSES: `
    SELECT tp.tenant_process_id::text AS key, tp.tenant_process_name AS name, tp.tenant_process_code AS code,
           tp.tenant_process_description AS description, NULL::text AS type, NULL::text AS level,
           NULL::text AS parent_name, NULL::text AS esco_uri,
           (SELECT array_agg(st.tenant_process_step_name ORDER BY st.tenant_process_step_ordinal)
              FROM sys.sys_tenant_process_steps st WHERE st.tenant_process_step_process_id = tp.tenant_process_id) AS activities
      FROM sys.sys_tenant_processes tp
     WHERE tp.tenant_process_tenant_id = $1 AND tp.tenant_process_is_active
     ORDER BY tp.tenant_process_code`,
  INDICATORS_GOALS: `
    SELECT k.kpi_definition_id::text AS key, k.kpi_definition_name AS name, k.kpi_definition_code AS code,
           k.kpi_definition_description AS description, k.kpi_definition_unit AS type, NULL::text AS level,
           NULL::text AS parent_name, NULL::text AS esco_uri, NULL::text[] AS activities
      FROM sys.sys_kpi_definitions k
     WHERE k.kpi_definition_tenant_id = $1
     ORDER BY k.kpi_definition_code`,
};

const PROTOTIPO: Record<ConsolidationGroup, string> = {
  ORGANIZATION: `
    SELECT u.blueprint_content_unit_code AS key, u.blueprint_content_unit_name AS name, u.blueprint_content_unit_code AS code,
           NULL::text AS description, u.blueprint_content_unit_type AS type, u.blueprint_content_unit_level::text AS level,
           pu.blueprint_content_unit_name AS parent_name, NULL::text AS esco_uri, NULL::text[] AS activities
      FROM sys.sys_blueprint_content_units u
      LEFT JOIN sys.sys_blueprint_content_units pu
        ON pu.blueprint_content_unit_version_id = u.blueprint_content_unit_version_id
       AND pu.blueprint_content_unit_code = u.blueprint_content_unit_parent_code
     WHERE u.blueprint_content_unit_version_id = $1
     ORDER BY u.blueprint_content_unit_code`,
  POSITIONS_ROLES: `
    SELECT p.blueprint_content_position_code AS key, p.blueprint_content_position_title AS name,
           p.blueprint_content_position_code AS code, NULL::text AS description,
           p.blueprint_content_position_metadata->>'job_role_code' AS type,
           p.blueprint_content_position_metadata->>'seniority_level' AS level,
           u.blueprint_content_unit_name AS parent_name,
           coalesce(p.blueprint_content_position_metadata->>'esco_occupation_uri',
                    p.blueprint_content_position_metadata->>'esco_uri') AS esco_uri,
           NULL::text[] AS activities
      FROM sys.sys_blueprint_content_positions p
      LEFT JOIN sys.sys_blueprint_content_units u
        ON u.blueprint_content_unit_version_id = p.blueprint_content_position_version_id
       AND u.blueprint_content_unit_code = p.blueprint_content_position_unit_code
     WHERE p.blueprint_content_position_version_id = $1
     ORDER BY p.blueprint_content_position_code`,
  SKILLS: `
    SELECT s.blueprint_content_skill_code AS key, s.blueprint_content_skill_name AS name, s.blueprint_content_skill_code AS code,
           NULL::text AS description, s.blueprint_content_skill_kind AS type, NULL::text AS level,
           s.blueprint_content_skill_category AS parent_name,
           coalesce(s.blueprint_content_skill_metadata->>'esco_uri', s.blueprint_content_skill_metadata->>'esco_skill_uri') AS esco_uri,
           NULL::text[] AS activities
      FROM sys.sys_blueprint_content_skills s
     WHERE s.blueprint_content_skill_version_id = $1
     ORDER BY s.blueprint_content_skill_code`,
  PROCESSES: `
    SELECT r.blueprint_process_code AS key, r.blueprint_process_name AS name, r.blueprint_process_code AS code,
           r.blueprint_process_description AS description, NULL::text AS type, NULL::text AS level,
           NULL::text AS parent_name, NULL::text AS esco_uri,
           (SELECT array_agg(st.blueprint_content_process_step_name ORDER BY st.blueprint_content_process_step_ordinal)
              FROM sys.sys_blueprint_content_process_steps st
             WHERE st.blueprint_content_process_step_version_id = $1
               AND st.blueprint_content_process_step_process_code = r.blueprint_process_code) AS activities
      FROM sys.sys_blueprint_process_registry r
     WHERE r.blueprint_process_variant_version_id = $1
     ORDER BY r.blueprint_process_code`,
  INDICATORS_GOALS: `
    SELECT 'KPI:' || k.blueprint_content_kpi_code AS key, k.blueprint_content_kpi_name AS name,
           k.blueprint_content_kpi_code AS code, NULL::text AS description, k.blueprint_content_kpi_unit AS type,
           NULL::text AS level, NULL::text AS parent_name, NULL::text AS esco_uri, NULL::text[] AS activities
      FROM sys.sys_blueprint_content_kpis k
     WHERE k.blueprint_content_kpi_version_id = $1
    UNION ALL
    SELECT 'GOAL:' || g.blueprint_content_goal_code, g.blueprint_content_goal_title, g.blueprint_content_goal_code,
           NULL::text, g.blueprint_content_goal_dimension, g.blueprint_content_goal_horizon,
           NULL::text, NULL::text, NULL::text[]
      FROM sys.sys_blueprint_content_goals g
     WHERE g.blueprint_content_goal_version_id = $1
     ORDER BY 1`,
};

export async function vociDelTenant(q: DbConnector, tenantId: string, group: ConsolidationGroup): Promise<Voce[]> {
  const { rows } = await q.query<Riga>(TENANT[group], [tenantId]);
  return rows.map(voce);
}

export async function vociDelPrototipo(q: DbConnector, variantVersionId: string, group: ConsolidationGroup): Promise<Voce[]> {
  const { rows } = await q.query<Riga>(PROTOTIPO[group], [variantVersionId]);
  return rows.map(voce);
}
