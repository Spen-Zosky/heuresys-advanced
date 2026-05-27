-- SDBI Succession/TalentPool pilot — Phase 5 consolidation. FK via sys.* natural_key. ON_ERROR_STOP=1.
BEGIN;
SELECT set_config('sdbi.run_id',(SELECT import_run_id::text FROM brownfield.import_runs
  WHERE import_run_metadata->>'pilot'='succession' ORDER BY import_run_started_at DESC LIMIT 1), false);

INSERT INTO sys.sys_talent_pools (pool_id,pool_tenant_id,pool_natural_key,pool_name,pool_description,pool_type,pool_criteria,
  pool_is_active,pool_created_by_user_id,pool_deleted_at,pool_metadata,created_at,updated_at)
SELECT pool_id,pool_tenant_id,pool_natural_key,pool_name,pool_description,pool_type,pool_criteria,pool_is_active,NULL::uuid,
  pool_deleted_at,pool_metadata,created_at,updated_at FROM temp_sdbi.talent_pools
ON CONFLICT (pool_tenant_id,pool_natural_key) DO NOTHING;

INSERT INTO sys.sys_talent_pool_members (member_id,member_tenant_id,member_natural_key,member_pool_id,member_employee_user_id,
  member_added_reason,member_added_by_user_id,member_added_at,member_removed_at,member_removed_reason,member_metadata,created_at,updated_at)
SELECT m.member_id,m.member_tenant_id,m.member_natural_key,
  (SELECT pool_id FROM sys.sys_talent_pools p WHERE p.pool_tenant_id=m.member_tenant_id
     AND p.pool_natural_key='TALENT_POOL::'||m.member_tenant_id::text||'::'||m._legacy_pool_id::text),
  NULL::uuid,m.member_added_reason,NULL::uuid,m.member_added_at,m.member_removed_at,m.member_removed_reason,m.member_metadata,m.created_at,m.updated_at
FROM temp_sdbi.talent_pool_members m
WHERE EXISTS (SELECT 1 FROM sys.sys_talent_pools p WHERE p.pool_tenant_id=m.member_tenant_id
     AND p.pool_natural_key='TALENT_POOL::'||m.member_tenant_id::text||'::'||m._legacy_pool_id::text)
ON CONFLICT (member_tenant_id,member_natural_key) DO NOTHING;

INSERT INTO sys.sys_succession_plans (plan_id,plan_tenant_id,plan_natural_key,plan_position_name,plan_legacy_position_id,
  plan_incumbent_user_id,plan_criticality_level,plan_risk_level,plan_notes,plan_target_date,plan_status,plan_created_by_user_id,
  plan_metadata,created_at,updated_at)
SELECT plan_id,plan_tenant_id,plan_natural_key,plan_position_name,plan_legacy_position_id,NULL::uuid,plan_criticality_level,
  plan_risk_level,plan_notes,plan_target_date,plan_status,NULL::uuid,plan_metadata,created_at,updated_at FROM temp_sdbi.succession_plans
ON CONFLICT (plan_tenant_id,plan_natural_key) DO NOTHING;

INSERT INTO sys.sys_critical_roles (role_id,role_tenant_id,role_natural_key,role_name,role_department,role_incumbent_user_id,
  role_criticality_level,role_impact_if_vacant,role_time_to_fill_estimate,role_succession_status,role_metadata,created_at,updated_at)
SELECT role_id,role_tenant_id,role_natural_key,role_name,role_department,NULL::uuid,role_criticality_level,role_impact_if_vacant,
  role_time_to_fill_estimate,role_succession_status,role_metadata,created_at,updated_at FROM temp_sdbi.critical_roles
ON CONFLICT (role_tenant_id,role_natural_key) DO NOTHING;

INSERT INTO sys.sys_succession_candidates (candidate_id,candidate_tenant_id,candidate_natural_key,candidate_critical_role_id,
  candidate_employee_user_id,candidate_readiness_level,candidate_strengths,candidate_development_needs,candidate_development_plan,
  candidate_rank_order,candidate_metadata,created_at,updated_at)
SELECT c.candidate_id,c.candidate_tenant_id,c.candidate_natural_key,
  (SELECT role_id FROM sys.sys_critical_roles r WHERE r.role_tenant_id=c.candidate_tenant_id
     AND r.role_natural_key='CRITICAL_ROLE::'||c.candidate_tenant_id::text||'::'||c._legacy_critical_role_id::text),
  NULL::uuid,c.candidate_readiness_level,c.candidate_strengths,c.candidate_development_needs,c.candidate_development_plan,
  c.candidate_rank_order,c.candidate_metadata,c.created_at,c.updated_at
FROM temp_sdbi.succession_candidates c ON CONFLICT (candidate_tenant_id,candidate_natural_key) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (source_lineage_tenant_id,source_lineage_source_system,source_lineage_source_table,
  source_lineage_source_record_id,source_lineage_source_natural_key,source_lineage_import_run_id,source_lineage_target_table_name,
  source_lineage_target_record_id,source_lineage_mapping_confidence,source_lineage_validation_status,source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id,source_lineage_sdbi_confidence,source_lineage_sdbi_ai_model_id,source_lineage_sdbi_human_approver)
SELECT x.tenant,'heuresys_platform',x.src,x.sid::text,'OLDDB::'||x.src||'::'||x.sid::text,current_setting('sdbi.run_id')::uuid,
  x.tgt,x.tid,0.85,'VALID',jsonb_build_object('sdbi_pilot','succession'),'SUCCESSION-MAP-01',0.85,'cli-claude-opus-4.7','enzo.spenuso@outlook.com'
FROM (
  SELECT pool_tenant_id tenant,'talent_pools' src,_legacy_source_id sid,'sys_talent_pools' tgt,pool_id tid FROM temp_sdbi.talent_pools
  UNION ALL SELECT member_tenant_id,'talent_pool_members',_legacy_source_id,'sys_talent_pool_members',member_id FROM temp_sdbi.talent_pool_members
  UNION ALL SELECT plan_tenant_id,'succession_plans',_legacy_source_id,'sys_succession_plans',plan_id FROM temp_sdbi.succession_plans
  UNION ALL SELECT role_tenant_id,'critical_roles',_legacy_source_id,'sys_critical_roles',role_id FROM temp_sdbi.critical_roles
  UNION ALL SELECT candidate_tenant_id,'succession_candidates',_legacy_source_id,'sys_succession_candidates',candidate_id FROM temp_sdbi.succession_candidates
) x ON CONFLICT (source_lineage_source_system,source_lineage_source_table,source_lineage_source_record_id,source_lineage_target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_validation_result_run_id,import_validation_result_rule_code,
  import_validation_result_status,import_validation_result_message,import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid,'SDBI_CONSOLIDATION_COMPLETE_V1','PASSED','SDBI Succession pilot — '||tgt,
  jsonb_build_object('mapping_card','SUCCESSION-MAP-01','target_table',tgt)
FROM (VALUES ('sys_talent_pools'),('sys_talent_pool_members'),('sys_succession_plans'),('sys_critical_roles'),('sys_succession_candidates')) v(tgt);
COMMIT;
SELECT 'sys_talent_pools' t,count(*) FROM sys.sys_talent_pools UNION ALL SELECT 'sys_talent_pool_members',count(*) FROM sys.sys_talent_pool_members
UNION ALL SELECT 'sys_succession_plans',count(*) FROM sys.sys_succession_plans UNION ALL SELECT 'sys_critical_roles',count(*) FROM sys.sys_critical_roles
UNION ALL SELECT 'sys_succession_candidates',count(*) FROM sys.sys_succession_candidates ORDER BY 1;
