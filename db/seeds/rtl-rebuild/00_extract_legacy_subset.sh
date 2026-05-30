#!/usr/bin/env bash
# 00_extract_legacy_subset.sh — RTL rebuild Phase: extract the rtl-bank + heuresys subset
# from the legacy Docker DB (heuresys_evo_platform_db / heuresys_platform) into CSVs.
#
# READ-ONLY on legacy. Writes CSVs to ./extracted/ (gitignored). Regenerable; commit this
# script, not the payload (brownfield-wave1 convention).
#
# Requires: SSH access to oracle-vm-default (key in agent) + the legacy container running.
# The DB password is read from the container env ($POSTGRES_PASSWORD) and never printed.
set -euo pipefail

RTL='0c54b84a-db6e-4da4-bc91-af5d480d524e'   # legacy tenant rtl-bank
HEU='d5855519-3ed1-4427-865f-fe75f1e42c4c'   # legacy tenant heuresys
TENANTS="'$RTL','$HEU'"
EMP_SUB="(SELECT id FROM employees WHERE tenant_id IN ($TENANTS))"

OUTDIR="$(cd "$(dirname "$0")" && pwd)/extracted"
mkdir -p "$OUTDIR"

# xt <name>  — SQL on stdin; runs read-only psql inside the legacy container, CSV → extracted/<name>.csv
xt() {
  local name="$1"
  ssh -o BatchMode=yes -o ConnectTimeout=10 oracle-vm-default \
    'docker exec -i heuresys_evo_platform_db sh -c '"'"'PGPASSWORD=$POSTGRES_PASSWORD exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -A -v ON_ERROR_STOP=1'"'"'' \
    > "$OUTDIR/$name.csv"
  local n; n=$(($(wc -l < "$OUTDIR/$name.csv") - 1))
  printf '  %-28s %6d rows\n' "$name.csv" "$n"
}

echo "Extracting rtl-bank + heuresys subset → $OUTDIR"

# --- identity / org ---------------------------------------------------------
xt employees <<SQL
\copy (SELECT id,tenant_id,email,personal_email,first_name,middle_name,last_name,job_title,department,location,position_id,org_unit_id,manager_id,pernr,hire_date,seniority_date,is_active,employment_status,phone_mobile,phone_work,address_street,address_city,address_postal_code,address_country,iban,swift_bic,bank_name,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,highest_education_level,highest_education_field,highest_education_institution,highest_education_year FROM employees WHERE tenant_id IN ($TENANTS) AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt users <<SQL
\copy (SELECT id,username,role,employee_id,is_active FROM users WHERE employee_id IN $EMP_SUB AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt org_units <<SQL
\copy (SELECT id,tenant_id,code,name,name_it,name_en,parent_id,org_type,org_level,manager_id,deputy_manager_id,headcount_budget,sort_order,is_active,valid_from,valid_to,description,color,icon FROM org_units WHERE tenant_id IN ($TENANTS) AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

# --- compensation -----------------------------------------------------------
xt employee_contracts <<SQL
\copy (SELECT id,tenant_id,employee_id,contract_type,start_date,end_date,ccnl_code,level,annual_salary,monthly_salary,num_monthly_payments,currency,fte_percentage,pay_scale_area,is_current FROM employee_contracts WHERE tenant_id IN ($TENANTS)) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt salary_bands <<SQL
\copy (SELECT id,tenant_id,band_code,band_name,job_level,job_family,currency,min_salary,mid_salary,max_salary,geo_region,is_active FROM salary_bands WHERE tenant_id IN ($TENANTS) AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt salary_band_assignments <<SQL
\copy (SELECT id,employee_id,band_id,current_salary,compa_ratio,range_penetration,assigned_at FROM salary_band_assignments WHERE employee_id IN $EMP_SUB) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

# --- skills / certs ---------------------------------------------------------
xt employee_skills <<SQL
\copy (SELECT s.id,s.tenant_id,s.employee_id,s.esco_skill_id,es.uri AS esco_uri,s.custom_skill_name,s.proficiency_level,s.proficiency_label,s.years_experience,s.is_primary,s.is_verified,s.source,s.confidence_score FROM employee_skills s LEFT JOIN esco_skills es ON es.id = s.esco_skill_id WHERE s.tenant_id IN ($TENANTS)) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt employee_skill_profiles <<SQL
\copy (SELECT p.id,p.tenant_id,p.employee_id,p.skill_id,es.uri AS esco_uri,p.knowledge_level,p.skill_level,p.ability_level,p.behavior_level,p.attitude_level,p.composite_score,p.source,p.acquired_date,p.verification_status,p.target_level FROM employee_skill_profiles p LEFT JOIN esco_skills es ON es.id = p.skill_id WHERE p.tenant_id IN ($TENANTS)) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt employee_skill_assessments <<SQL
\copy (SELECT id,employee_id,esco_skill_uri,skill_name,assessed_level,required_level,gap,assessment_date,assessed_by,assessment_method,evidence_notes FROM employee_skill_assessments WHERE employee_id IN $EMP_SUB) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt tenant_custom_skills <<SQL
\copy (SELECT id,tenant_id,code,name_en,name_it,skill_type,base_esco_skill_id,description_en,description_it,is_active FROM tenant_custom_skills WHERE tenant_id IN ($TENANTS) AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt certifications <<SQL
\copy (SELECT id,tenant_id,code,name,name_en,name_it,issuing_organization,validity_months,is_internal,is_active FROM certifications WHERE tenant_id IN ($TENANTS) AND deleted_at IS NULL) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

xt employee_certifications <<SQL
\copy (SELECT id,employee_id,certification_id,credential_id,issued_date,expiry_date,status,verification_status,credential_url,document_url FROM employee_certifications WHERE employee_id IN $EMP_SUB) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

# --- HR history (D6 attendance top-up; overtime/leave already in v5, kept for parity) ----
# VERIFY: confirm these tables carry no pgvector/embedding columns before relying on SELECT *.
xt employee_attendance <<SQL
\copy (SELECT id,tenant_id,employee_id,attendance_date,clock_in,clock_out,break_start,break_end,hours_regular,hours_overtime,hours_night,hours_holiday,hours_total,status,source,is_validated FROM employee_attendance WHERE tenant_id IN ($TENANTS)) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

# --- RBAC -> UI catalog (global, no tenant_id) ------------------------------
xt rbp_roles            <<SQL
\copy (SELECT id,code,name,hierarchy_level,inherits_from,default_dashboard_code,is_assignable FROM rbp_roles ORDER BY hierarchy_level) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_functional_areas <<SQL
\copy (SELECT id,code,name,category,sort_order,is_active FROM rbp_functional_areas) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_role_permissions <<SQL
\copy (SELECT id,role_id,functional_area_id,can_view,can_create,can_edit,can_delete,can_approve,can_export,scope_type FROM rbp_role_permissions) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_pages            <<SQL
\copy (SELECT id,code,name,route_path,functional_area_code,status,icon FROM rbp_pages) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_dashboards       <<SQL
\copy (SELECT id,code,name,sort_order,is_active FROM rbp_dashboards) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_dashboard_nav_items <<SQL
\copy (SELECT id,dashboard_id,item_type,target_page_id,target_dashboard_id,section,label_override,sort_order,is_visible FROM rbp_dashboard_nav_items) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
xt rbp_role_dashboards  <<SQL
\copy (SELECT id,role_id,dashboard_id,is_default FROM rbp_role_dashboards) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL

echo "Extraction complete. CSVs in $OUTDIR (gitignored)."
