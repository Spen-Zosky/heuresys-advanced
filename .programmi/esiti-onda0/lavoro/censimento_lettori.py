import subprocess, re, json, collections
tabs = """sys_skills sys_skill_taxonomy_edges sys_skill_groups sys_skill_families sys_skill_categories sys_skill_aliases sys_skill_learning_mappings sys_skill_proficiency_levels
sys_occupation_skill_requirements sys_esco_occupation_mappings sys_occupation_classifications sys_activity_classifications sys_activity_classification_mappings sys_industry_codes
sys_job_roles sys_job_families sys_organization_unit_templates sys_organization_unit_types sys_operating_model_catalog sys_enterprise_size_bands
sys_kpi_definitions sys_kpi_metric_definitions sys_kpi_assessment_methods sys_kpi_weighting_rules sys_goal_templates sys_assessment_methods sys_learning_modules sys_compensation_bands sys_reward_gate_catalog
sys_reference_translations sys_translatable_field
sys_skill_embeddings sys_esco_occupation_embeddings sys_job_role_embeddings sys_user_profile_embeddings
sys_blueprint_families sys_blueprint_variants sys_blueprint_variant_versions sys_blueprint_content_units sys_blueprint_content_job_roles sys_blueprint_content_dashboards sys_blueprint_process_registry sys_blueprint_activations sys_blueprint_family_activity_classes sys_blueprint_overrides
sys_research_sources sys_seed_validation_results sys_seed_source_evidence sys_seed_approval_decisions sys_industry_forbidden_terms sys_dashboards sys_dashboard_blocks sys_ui_interfaces sys_process_kpi_templates
import_runs source_watermarks source_exports""".split()
def area(p):
    m=re.match(r'apps/api/src/modules/([^/]+)/',p)
    if m: return 'api:'+m.group(1)
    m=re.match(r'apps/api/src/(lib|jobs|middleware|db)/([^/]+)',p)
    if m: return 'api:'+m.group(1)+'/'+m.group(2).split('.')[0]
    if p.startswith('apps/api/test/'): return 'test'
    if p.startswith('apps/web/'): return 'web'
    if p.startswith('db/migrations/'): return 'migrazioni'
    if p.startswith('db/seeds/'): return 'seeds'
    if p.startswith('db/scripts/'): return 'db/scripts'
    if p.startswith('docs/'): return None
    if p.startswith('scripts/'): return 'scripts'
    if p.startswith('packages/'): return 'shared'
    return p.split('/')[0]
out={}
for t in tabs:
    r=subprocess.run(['git','grep','-l','-w',t,'--','.'],capture_output=True,text=True,encoding='utf-8')
    c=collections.Counter()
    for p in r.stdout.split('\n'):
        if not p: continue
        a=area(p)
        if a and a not in ('test','migrazioni'): c[a]+=1
    out[t]={k:v for k,v in sorted(c.items())}
json.dump(out,open('.programmi/esiti-onda0/lavoro/lettori_per_tabella.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
for t,v in out.items(): print(t,'|',', '.join(v) if v else '(nessun lettore nel codice)')
