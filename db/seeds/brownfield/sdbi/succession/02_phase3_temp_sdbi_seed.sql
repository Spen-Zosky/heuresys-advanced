-- SDBI Succession/TalentPool pilot — Phase 3 seed. Run via psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE v uuid := gen_random_uuid(); BEGIN
  INSERT INTO brownfield.import_runs (import_run_id, import_run_export_id, import_run_status, import_run_started_at, import_run_metadata)
  VALUES (v,(SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),'RUNNING',now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','succession','mapping_card','SUCCESSION-MAP-01','source','heuresys_platform_0507'));
  PERFORM set_config('sdbi.run_id', v::text, true);
END $$;

INSERT INTO temp_sdbi.talent_pools (_legacy_source_id,_import_run_id,pool_tenant_id,pool_natural_key,pool_name,
  pool_description,pool_type,pool_criteria,pool_is_active,pool_deleted_at,pool_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,'TALENT_POOL::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  TRIM(src.name),src.description,UPPER(src.pool_type),src.criteria,src.is_active,src.deleted_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.talent_pools','legacy_created_by',src.created_by::text),
  src.created_at,src.updated_at
FROM legacy_mirror.talent_pools src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.talent_pool_members (_legacy_source_id,_legacy_pool_id,_import_run_id,member_tenant_id,member_natural_key,
  member_added_reason,member_added_at,member_removed_at,member_removed_reason,member_metadata,created_at,updated_at)
SELECT src.id,src.talent_pool_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'TALENT_POOL_MEMBER::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.added_reason,src.added_at,src.removed_at,
  src.removed_reason,jsonb_build_object('legacy_id',src.id::text,'legacy_pool_id',src.talent_pool_id::text,
    'legacy_employee_id',src.employee_id::text,'legacy_added_by',src.added_by::text),src.created_at,src.updated_at
FROM legacy_mirror.talent_pool_members src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.succession_plans (_legacy_source_id,_import_run_id,plan_tenant_id,plan_natural_key,plan_position_name,
  plan_legacy_position_id,plan_criticality_level,plan_risk_level,plan_notes,plan_target_date,plan_status,plan_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,'SUCCESSION_PLAN::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.position_name,src.position_id,UPPER(src.criticality_level),UPPER(src.risk_level),src.notes,src.target_date,UPPER(src.status),
  jsonb_build_object('legacy_id',src.id::text,'legacy_position_id',src.position_id::text,'legacy_incumbent_employee_id',src.incumbent_employee_id::text,
    'legacy_created_by',src.created_by::text),src.created_at,src.updated_at
FROM legacy_mirror.succession_plans src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.critical_roles (_legacy_source_id,_import_run_id,role_tenant_id,role_natural_key,role_name,role_department,
  role_criticality_level,role_impact_if_vacant,role_time_to_fill_estimate,role_succession_status,role_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,'CRITICAL_ROLE::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.role_name,src.department,UPPER(src.criticality_level),src.impact_if_vacant,src.time_to_fill_estimate,UPPER(src.succession_status),
  jsonb_build_object('legacy_id',src.id::text,'legacy_current_incumbent_id',src.current_incumbent_id::text),
  src.created_at AT TIME ZONE 'UTC',src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.critical_roles src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- candidates: no tenant_id → inherit from parent critical_roles (14/100 orphan critical_role_id excluded)
INSERT INTO temp_sdbi.succession_candidates (_legacy_source_id,_legacy_critical_role_id,_import_run_id,candidate_tenant_id,
  candidate_natural_key,candidate_readiness_level,candidate_strengths,candidate_development_needs,candidate_development_plan,
  candidate_rank_order,candidate_metadata,created_at,updated_at)
SELECT src.id,src.critical_role_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'SUCCESSION_CANDIDATE::'||tm.canonical_tenant_id::text||'::'||src.id::text,UPPER(src.readiness_level),src.strengths,
  src.development_needs,src.development_plan,src.rank_order,
  jsonb_build_object('legacy_id',src.id::text,'legacy_critical_role_id',src.critical_role_id::text,'legacy_candidate_employee_id',src.candidate_employee_id::text),
  src.created_at AT TIME ZONE 'UTC',src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.succession_candidates src
JOIN legacy_mirror.critical_roles cr ON cr.id=src.critical_role_id
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=cr.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now() WHERE import_run_id=current_setting('sdbi.run_id')::uuid;
COMMIT;
SELECT 'talent_pools' t,count(*) FROM temp_sdbi.talent_pools UNION ALL SELECT 'talent_pool_members',count(*) FROM temp_sdbi.talent_pool_members
UNION ALL SELECT 'succession_plans',count(*) FROM temp_sdbi.succession_plans UNION ALL SELECT 'critical_roles',count(*) FROM temp_sdbi.critical_roles
UNION ALL SELECT 'succession_candidates',count(*) FROM temp_sdbi.succession_candidates ORDER BY 1;
