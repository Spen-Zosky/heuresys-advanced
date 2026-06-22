-- =============================================================================
-- 000023_validation_views_and_checks.sql
-- Heuresys Advanced — 10 cross-table validation views
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §14 + MIGRATION_IMPLEMENTATION_PLAN §4.
-- Each view surfaces structural violations: a healthy DB returns 0 rows.
-- validate_database.{ps1,sh} runs SELECT count(*) FROM <view> and fails
-- if any returns non-zero.
--
-- The 10th view sys.v_inbox_resource_consistency is declared as an empty
-- placeholder here (its source table sys_inbox_notifications is created
-- by 000027). Migration 000027 replaces this VIEW with the real body via
-- CREATE OR REPLACE VIEW once the target tables exist.
-- =============================================================================

-- 1. Orphan position assignments (user or position deleted)
CREATE OR REPLACE VIEW sys.v_orphan_position_assignments AS
SELECT a.user_position_assignment_id, a.user_position_assignment_user_id, a.user_position_assignment_position_id
FROM sys.sys_user_position_assignments a
LEFT JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE u.user_id IS NULL OR p.position_id IS NULL;

-- 2. Tenant boundary violations (assignment tenant != user tenant != position tenant)
CREATE OR REPLACE VIEW sys.v_tenant_boundary_violations AS
SELECT a.user_position_assignment_id,
       a.user_position_assignment_tenant_id AS assignment_tenant,
       u.user_tenant_id                      AS user_tenant,
       p.position_tenant_id                  AS position_tenant
FROM sys.sys_user_position_assignments a
JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE a.user_position_assignment_tenant_id <> u.user_tenant_id
   OR a.user_position_assignment_tenant_id <> p.position_tenant_id;

-- 3. Positions without job role assigned
CREATE OR REPLACE VIEW sys.v_positions_without_job_role AS
SELECT position_id, position_code, position_title, position_tenant_id
FROM sys.sys_positions
WHERE position_job_role_id IS NULL AND position_is_active = true;

-- 4. PIP completeness — positions with at least one base requirement missing
CREATE OR REPLACE VIEW sys.v_pip_completeness AS
SELECT p.position_id, p.position_code, p.position_tenant_id,
       (SELECT count(*) FROM sys.sys_position_skill_requirements WHERE position_id = p.position_id) AS skills_n,
       (SELECT count(*) FROM sys.sys_position_kpi_requirements WHERE position_id = p.position_id) AS kpis_n,
       (SELECT count(*) FROM sys.sys_position_learning_requirements WHERE position_id = p.position_id) AS learning_n
FROM sys.sys_positions p
WHERE p.position_is_active = true
  AND NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements WHERE position_id = p.position_id);

-- 5. Reward gate completeness — tenants with activated blueprints missing gate seeds
CREATE OR REPLACE VIEW sys.v_reward_gate_completeness AS
SELECT t.tenant_id, t.tenant_code, ba.blueprint_activation_variant_id AS variant_id,
       count(*) FILTER (WHERE g.reward_gate_catalog_id IS NULL) AS missing_gates
FROM sys.sys_tenancies t
JOIN sys.sys_blueprint_activations ba ON ba.blueprint_activation_tenant_id = t.tenant_id
LEFT JOIN sys.sys_reward_gate_catalog g
  ON g.reward_gate_catalog_blueprint_variant_id = ba.blueprint_activation_variant_id
WHERE ba.blueprint_activation_status = 'ACTIVE'
GROUP BY t.tenant_id, t.tenant_code, ba.blueprint_activation_variant_id
HAVING count(*) FILTER (WHERE g.reward_gate_catalog_id IS NULL) > 0;

-- 6. (retired) synthetic-user flag consistency view — the `user_is_synthetic`
-- flag was removed in mig 000154 (ADR-0026 decision A); nothing to validate here.

-- 7. Canonical tables outside sys schema (schema policy guard)
CREATE OR REPLACE VIEW sys.v_canonical_outside_sys AS
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE 'sys\_%' ESCAPE '\'
  AND table_schema NOT IN ('sys');

-- 8. Users with more than one ACTIVE PRIMARY assignment (also enforced by
-- partial unique index in 000012, but the view provides reporting hook)
CREATE OR REPLACE VIEW sys.v_active_primary_assignment_per_user AS
SELECT user_position_assignment_user_id, count(*) AS n_active_primary
FROM sys.sys_user_position_assignments
WHERE user_position_assignment_kind = 'PRIMARY'
  AND user_position_assignment_status = 'ACTIVE'
GROUP BY user_position_assignment_user_id
HAVING count(*) > 1;

-- 9. Visualization nodes whose source_entity_id does not exist in the canonical table
CREATE OR REPLACE VIEW sys.v_visualization_node_in_canonical_node AS
SELECT n.node_id, n.node_source_entity_type, n.node_source_entity_id, n.node_graph_id
FROM sys.sys_visualization_nodes n
WHERE n.node_source_entity_id IS NOT NULL AND (
  (n.node_source_entity_type = 'POSITION' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_positions WHERE position_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'USER' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_users WHERE user_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'SKILL' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_skills WHERE skill_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'KPI' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_kpi_definitions WHERE kpi_definition_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'PROCESS' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'UNIT' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_organization_units WHERE organization_unit_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'LEARNING_MODULE' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_learning_modules WHERE learning_module_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'CAREER_PATH' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_career_paths WHERE career_path_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'BLUEPRINT_VARIANT' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = n.node_source_entity_id))
  OR
  (n.node_source_entity_type = 'SUCCESSION_POOL' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_succession_pools WHERE succession_pool_id = n.node_source_entity_id))
);

-- 10. Inbox notifications polymorphic FK consistency (ADR-0011 ESS)
-- PLACEHOLDER: real body in 000027 once sys_inbox_notifications exists.
-- Until then, the view returns 0 rows (correct behaviour: no inbox table).
-- Column types match the final body so CREATE OR REPLACE works on re-run.
CREATE OR REPLACE VIEW sys.v_inbox_resource_consistency AS
SELECT
  NULL::uuid        AS notification_id,
  NULL::varchar(64) AS notification_resource_type,
  NULL::uuid        AS notification_resource_id
WHERE false;
