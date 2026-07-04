#!/usr/bin/env node
/**
 * generate_wave1_column_mappings.mjs
 *
 * Generate an idempotent SQL seed file populating `brownfield.column_mappings`
 * with one row per (table_mapping, source_column) pair for Wave 1.
 *
 * Strategy (in priority order):
 *   1. Per-source-table OVERRIDES (hand-curated, derived from BROWNFIELD_ADAPTATION_MAP §4).
 *   2. Per-target-table SEMANTIC ALIASES (legacy_name -> canonical target_name).
 *   3. Canonical name match (e.g. legacy `created_at` -> target `created_at`).
 *   4. STANDARD lineage/audit defaults (id -> *_legacy_id stored inside *_metadata).
 *   5. EMBED_IN_METADATA fallback (record as JSON path inside <target>_metadata).
 *   6. SKIP only for explicit unmappable legacy fixtures (e.g. AI embedding vectors,
 *      pgvector USER-DEFINED columns, transient `deleted_at` for soft-delete tables).
 *
 * Inputs:
 *   - docs/source_bundle/brownfield/extracted/catalog.json (legacy columns)
 *   - live PostgreSQL (target table schemas via information_schema).
 *
 * Output:
 *   - db/seeds/brownfield/wave1/04_column_mappings.sql
 *   - db/seeds/brownfield/wave1/04_column_mappings_report.md
 *
 * Run:
 *   node scripts/generate_wave1_column_mappings.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''));
const ROOT = path.resolve(REPO, '..');
const CATALOG_PATH = path.join(ROOT, 'docs/source_bundle/brownfield/extracted/catalog.json');
const OUT_DIR = path.join(ROOT, 'db/seeds/brownfield/wave1');
const OUT_SQL = path.join(OUT_DIR, '04_column_mappings.sql');
const OUT_REPORT = path.join(OUT_DIR, '04_column_mappings_report.md');

const EXPORT_NAME = 'db-export-2026-05-15';

// F-013: build the connection from env, NEVER a hardcoded DB password. Host/port/db/user
// fall back to the standard local tunnel defaults; the password comes from POSTGRES_PASSWORD
// or, if unset, psql's ~/.pgpass (no secret committed to the repo).
const PGHOST = process.env.POSTGRES_HOST || 'localhost';
const PGPORT = process.env.POSTGRES_PORT || '5433';
const PGDB = process.env.POSTGRES_DB || 'heuresys_advanced';
const PGUSER = process.env.POSTGRES_USER || 'heuresys';
const DB_URL = process.env.DBURL || `postgres://${PGUSER}@${PGHOST}:${PGPORT}/${PGDB}`;
if (!process.env.PGPASSWORD && process.env.POSTGRES_PASSWORD) {
  process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
}

// ---------------------------------------------------------------------------
// Live DB introspection: pull target column lists for the 20 distinct targets.
// ---------------------------------------------------------------------------
console.log('Introspecting target tables from live DB...');
const psqlRaw = execSync(
  `psql -tAc "SELECT json_object_agg(tt.target_table, tt.cols) FROM (SELECT tm.table_mapping_target_table AS target_table, json_agg(json_build_object('name', c.column_name, 'data_type', c.data_type, 'is_nullable', c.is_nullable) ORDER BY c.ordinal_position) AS cols FROM brownfield.table_mappings tm JOIN information_schema.columns c ON c.table_schema = tm.table_mapping_target_schema AND c.table_name = tm.table_mapping_target_table WHERE tm.table_mapping_wave = 1 GROUP BY tm.table_mapping_target_table) tt;" "${DB_URL}"`,
  { encoding: 'utf8' }
).trim();
const TARGET_COLS = JSON.parse(psqlRaw);
console.log(`  ${Object.keys(TARGET_COLS).length} target tables introspected.`);

// Also pull the table_mapping rows + source_table info we need to resolve.
console.log('Pulling table_mappings list...');
const tmListRaw = execSync(
  `psql -tAc "SELECT json_agg(row_to_json(t)) FROM (SELECT st.source_table_name, tm.table_mapping_target_schema, tm.table_mapping_target_table FROM brownfield.table_mappings tm JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id WHERE tm.table_mapping_wave=1 ORDER BY st.source_table_name, tm.table_mapping_target_table) t" "${DB_URL}"`,
  { encoding: 'utf8' }
).trim();
const TABLE_MAPPINGS = JSON.parse(tmListRaw);
console.log(`  ${TABLE_MAPPINGS.length} table_mapping rows pulled.`);

// Group target tables a source table maps to (some sources map to 2 targets).
const TARGETS_BY_SOURCE = {};
for (const tm of TABLE_MAPPINGS) {
  (TARGETS_BY_SOURCE[tm.source_table_name] ||= []).push(tm.table_mapping_target_table);
}

// ---------------------------------------------------------------------------
// Read legacy catalog
// ---------------------------------------------------------------------------
console.log('Reading catalog.json...');
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const LEGACY_TABLES = catalog.tables;

// ---------------------------------------------------------------------------
// Per-target-table semantic alias dictionary.
// Maps a "concept" -> the canonical target column name in that target table.
// Each target table has a stable column-naming prefix (e.g. skill_, learning_module_,
// compensation_band_, esco_occupation_mapping_, etc.).
// ---------------------------------------------------------------------------

// Generic semantic concepts that are common across many target tables.
const COMMON_TARGET_COLUMNS = {
  // Concept -> heuristic suffix (added to the table's "base prefix")
  // We resolve each (target_table, concept) -> actual column via target column list lookup.
  // Lookup logic: see resolveTargetColumn() below.
};

// Per-target-table column-name PREFIX (used to map concept -> column).
const TARGET_PREFIX = {
  sys_activity_classifications:           'activity_classification_',
  sys_activity_classification_mappings:   'activity_class_mapping_',
  sys_blueprint_overrides:                'blueprint_override_',
  sys_blueprint_process_registry:         'blueprint_process_',
  sys_compensation_bands:                 'compensation_band_',
  sys_esco_occupation_mappings:           'esco_occupation_mapping_',
  sys_job_roles:                          'job_role_',
  sys_learning_modules:                   'learning_module_',
  sys_learning_path_steps:                'learning_path_step_',
  sys_learning_paths:                     'learning_path_',
  sys_position_learning_requirements:     'position_learning_requirement_',
  sys_position_skill_requirements:        'position_skill_requirement_',
  sys_process_kpi_templates:              'process_kpi_template_',
  sys_skill_aliases:                      'skill_alias_',
  sys_skill_categories:                   'skill_category_',
  sys_skill_families:                     'skill_family_',
  sys_skill_learning_mappings:            'skill_learning_mapping_',
  sys_skill_taxonomy_edges:               'skill_taxonomy_edge_',
  sys_skills:                             'skill_',
  sys_user_certifications:                'user_certification_',
};

/**
 * Given a target_table and a candidate suffix (e.g. 'name', 'code', 'description'),
 * return the matching column name in that target table, or null if it doesn't exist.
 */
function resolveTargetColumn(target_table, suffix) {
  const cols = TARGET_COLS[target_table];
  if (!cols) return null;
  const prefix = TARGET_PREFIX[target_table] || '';
  // 1. exact prefix + suffix
  const candidate1 = `${prefix}${suffix}`;
  if (cols.some(c => c.name === candidate1)) return candidate1;
  // 2. suffix alone (created_at, updated_at, created_by, updated_by, tenant_id, etc.)
  if (cols.some(c => c.name === suffix)) return suffix;
  return null;
}

/**
 * Return the canonical "metadata" column name for a target table (e.g. skill_metadata).
 */
function metadataCol(target_table) {
  return resolveTargetColumn(target_table, 'metadata') || `${TARGET_PREFIX[target_table] || ''}metadata`;
}

// ---------------------------------------------------------------------------
// Semantic CONCEPT dictionary — common legacy column names mapped to a concept-key.
// The concept-key is then resolved to a target column by resolveTargetColumn().
// ---------------------------------------------------------------------------

/**
 * Legacy column name patterns (lowercased) -> { concept, transform, payload }.
 * `concept` is the suffix to look up in the target table (e.g. 'name', 'code',
 * 'description', 'external_uri').
 * If the concept exists in the target table, the column is mapped DIRECT_COPY
 * (or the indicated transform). Otherwise the column falls through to metadata.
 *
 * For audit columns (created_at, updated_at, created_by, updated_by) the lookup
 * tries both the prefixed and unprefixed form.
 */
const SEMANTIC_RULES = [
  // -- audit / lifecycle (apply to nearly every target table) ----------------
  { match: /^id$/,                          concept: 'id',                  transform: 'LINEAGE_SOURCE_NK', payload: () => ({ note: 'legacy primary key stored on lineage row (sys_source_lineage_records.source_pk_value)' }) },
  { match: /^created_at$/,                  concept: 'created_at',          transform: 'CAST_TIMESTAMPTZ' },
  { match: /^updated_at$/,                  concept: 'updated_at',          transform: 'CAST_TIMESTAMPTZ' },
  { match: /^deleted_at$/,                  concept: 'deleted_at',          transform: 'CAST_TIMESTAMPTZ', payload: () => ({ note: 'soft-delete marker; target may store as metadata.deleted_at if column missing' }) },
  { match: /^created_by$/,                  concept: 'created_by',          transform: 'LOOKUP_FK',         payload: () => ({ target_table: 'sys_users', match_on: 'legacy_user_id' }) },
  { match: /^updated_by$/,                  concept: 'updated_by',          transform: 'LOOKUP_FK',         payload: () => ({ target_table: 'sys_users', match_on: 'legacy_user_id' }) },
  { match: /^validated_by$/,                concept: 'updated_by',          transform: 'LOOKUP_FK',         payload: () => ({ target_table: 'sys_users', match_on: 'legacy_user_id' }) },
  { match: /^validated_at$/,                concept: 'updated_at',          transform: 'CAST_TIMESTAMPTZ' },
  { match: /^tenant_id$/,                   concept: 'tenant_id',           transform: 'LOOKUP_FK',         payload: () => ({ target_table: 'sys_tenancies', match_on: 'legacy_tenant_id' }) },

  // -- canonical descriptive fields ------------------------------------------
  { match: /^code$/,                        concept: 'code',                transform: 'TRIM' },
  { match: /^name$/,                        concept: 'name',                transform: 'TRIM' },
  { match: /^name_it$/,                     concept: 'name',                transform: 'TRIM', payload: () => ({ note: 'IT preferred — fallback to name_en if missing' }) },
  { match: /^name_en$/,                     concept: 'name',                transform: 'TRIM', payload: () => ({ note: 'EN fallback for name field' }) },
  { match: /^title$/,                       concept: 'title',               transform: 'TRIM' },
  { match: /^title_it$/,                    concept: 'title',               transform: 'TRIM', payload: () => ({ note: 'IT preferred — fallback to title_en if missing' }) },
  { match: /^title_en$/,                    concept: 'title',               transform: 'TRIM', payload: () => ({ note: 'EN fallback for title field' }) },
  { match: /^preferred_label$/,             concept: 'name',                transform: 'TRIM' },
  { match: /^preferred_label_en$/,          concept: 'name',                transform: 'TRIM', payload: () => ({ note: 'EN fallback' }) },
  { match: /^preferred_label_it$/,          concept: 'name',                transform: 'TRIM', payload: () => ({ note: 'IT preferred' }) },
  { match: /^label$/,                       concept: 'name',                transform: 'TRIM' },
  { match: /^description$/,                 concept: 'description',         transform: 'TRIM' },
  { match: /^description_it$/,              concept: 'description',         transform: 'TRIM', payload: () => ({ note: 'IT preferred — fallback to description_en if missing' }) },
  { match: /^description_en$/,              concept: 'description',         transform: 'TRIM', payload: () => ({ note: 'EN fallback for description field' }) },
  { match: /^summary$/,                     concept: 'description',         transform: 'TRIM', payload: () => ({ note: 'legacy summary merged into description' }) },
  { match: /^uri$/,                         concept: 'esco_uri',            transform: 'TRIM' },
  { match: /^esco_uri$/,                    concept: 'esco_uri',            transform: 'TRIM' },
  { match: /^external_uri$/,                concept: 'esco_uri',            transform: 'TRIM' },
  { match: /^isco_code$/,                   concept: 'isco_code',           transform: 'TRIM' },
  { match: /^level$/,                       concept: 'level',               transform: 'CAST_INT' },

  // -- categorical / catalog references --------------------------------------
  { match: /^category$/,                    concept: 'category',            transform: 'TRIM' },
  { match: /^kind$/,                        concept: 'kind',                transform: 'UPPERCASE' },
  { match: /^type$/,                        concept: 'kind',                transform: 'UPPERCASE' },

  // -- boolean / status ------------------------------------------------------
  { match: /^is_active$/,                   concept: 'is_active',           transform: 'CAST_BOOLEAN' },
  { match: /^is_global$/,                   concept: 'is_global',           transform: 'CAST_BOOLEAN' },
  { match: /^is_optional$/,                 concept: 'is_optional',         transform: 'CAST_BOOLEAN' },
  { match: /^is_mandatory$/,                concept: 'is_mandatory',        transform: 'CAST_BOOLEAN' },
];

// ---------------------------------------------------------------------------
// HARD per-source-table overrides (the high-value, domain-aware mappings).
// Format:
//   SOURCE_OVERRIDES['esco_skills']['preferred_label'] = {
//     forTarget: 'sys_skills',           // optional — limits the rule to one target
//     target: 'skill_name',              // explicit target column
//     transform: 'TRIM',
//     payload: { ... }
//   };
// ---------------------------------------------------------------------------
const SOURCE_OVERRIDES = {
  esco_skills: {
    uri:               { forTarget: 'sys_skills', target: 'skill_esco_uri',   transform: 'TRIM' },
    preferred_label:   { forTarget: 'sys_skills', target: 'skill_name',       transform: 'TRIM' },
    preferred_label_en:{ forTarget: 'sys_skills', target: 'skill_name',       transform: 'TRIM', payload: { note: 'EN fallback' } },
    preferred_label_it:{ forTarget: 'sys_skills', target: 'skill_name',       transform: 'TRIM', payload: { note: 'IT preferred' } },
    description:       { forTarget: 'sys_skills', target: 'skill_description', transform: 'TRIM' },
    description_en:    { forTarget: 'sys_skills', target: 'skill_description', transform: 'TRIM', payload: { note: 'EN fallback' } },
    description_it:    { forTarget: 'sys_skills', target: 'skill_description', transform: 'TRIM', payload: { note: 'IT preferred' } },
    skill_type:        { forTarget: 'sys_skills', target: 'skill_metadata',    transform: 'JSON_EXTRACT', payload: { path: '$.skill_type' } },
  },
  business_processes: {
    process_code:      { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_code',        transform: 'TRIM' },
    process_name:      { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_name',        transform: 'TRIM' },
    description:       { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_description', transform: 'TRIM' },
    value_chain_position: { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_ordinal',  transform: 'CAST_INT' },
  },
  job_templates: {
    job_code:          { forTarget: 'sys_job_roles', target: 'job_role_code', transform: 'TRIM' },
    title_it:          { forTarget: 'sys_job_roles', target: 'job_role_name', transform: 'TRIM', payload: { note: 'IT preferred' } },
    title_en:          { forTarget: 'sys_job_roles', target: 'job_role_name', transform: 'TRIM', payload: { note: 'EN fallback' } },
    description:       { forTarget: 'sys_job_roles', target: 'job_role_description', transform: 'TRIM' },
    org_level:         { forTarget: 'sys_job_roles', target: 'job_role_seniority_level', transform: 'CAST_VARCHAR', payload: { note: 'numeric legacy level cast to seniority label string' } },
  },
  ccnl_contracts: {
    code:              { forTarget: 'sys_compensation_bands', target: 'compensation_band_code', transform: 'TRIM' },
    name:              { forTarget: 'sys_compensation_bands', target: 'compensation_band_name', transform: 'TRIM' },
    name_it:           { forTarget: 'sys_compensation_bands', target: 'compensation_band_name', transform: 'TRIM', payload: { note: 'IT preferred' } },
    name_en:           { forTarget: 'sys_compensation_bands', target: 'compensation_band_name', transform: 'TRIM', payload: { note: 'EN fallback' } },
  },
  ccnl_levels: {
    code:              { forTarget: 'sys_compensation_bands', target: 'compensation_band_code', transform: 'TRIM' },
    name:              { forTarget: 'sys_compensation_bands', target: 'compensation_band_name', transform: 'TRIM' },
    min_monthly_gross: { forTarget: 'sys_compensation_bands', target: 'compensation_band_min_eur', transform: 'CAST_NUMERIC' },
    max_monthly_gross: { forTarget: 'sys_compensation_bands', target: 'compensation_band_max_eur', transform: 'CAST_NUMERIC' },
  },
  industry_classifications: {
    code:              { forTarget: 'sys_activity_classifications', target: 'activity_classification_code', transform: 'TRIM' },
    parent_code:       { forTarget: 'sys_activity_classifications', target: 'activity_classification_parent_code', transform: 'TRIM' },
    classification_system: { forTarget: 'sys_activity_classifications', target: 'activity_classification_scheme', transform: 'UPPERCASE' },
    name_it:           { forTarget: 'sys_activity_classifications', target: 'activity_classification_name', transform: 'TRIM', payload: { note: 'IT preferred' } },
    name_en:           { forTarget: 'sys_activity_classifications', target: 'activity_classification_name', transform: 'TRIM', payload: { note: 'EN fallback' } },
    description_it:    { forTarget: 'sys_activity_classifications', target: 'activity_classification_description', transform: 'TRIM', payload: { note: 'IT preferred' } },
    description_en:    { forTarget: 'sys_activity_classifications', target: 'activity_classification_description', transform: 'TRIM', payload: { note: 'EN fallback' } },
    level:             { forTarget: 'sys_activity_classifications', target: 'activity_classification_level', transform: 'CAST_INT' },
  },
  industry_ccnl_mapping: {
    industry_code:     { forTarget: 'sys_activity_classification_mappings', target: 'activity_class_mapping_source_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_activity_classifications', match_on: 'activity_classification_code' } },
    ccnl_code:         { forTarget: 'sys_activity_classification_mappings', target: 'activity_class_mapping_target_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_compensation_bands', match_on: 'compensation_band_code' } },
    is_primary:        { forTarget: 'sys_activity_classification_mappings', target: 'activity_class_mapping_kind', transform: 'CONSTANT', payload: { value: 'PRIMARY' } },
  },
  industry_occupation_mapping: {
    industry_code:     { forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_isco_code', transform: 'TRIM' },
    occupation_uri:    { forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_esco_uri',  transform: 'TRIM' },
  },
  esco_occupations: {
    uri:               { forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_esco_uri', transform: 'TRIM' },
    preferred_label:   { forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_esco_label', transform: 'TRIM' },
    preferred_label_en:{ forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_esco_label', transform: 'TRIM', payload: { note: 'EN fallback' } },
    preferred_label_it:{ forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_esco_label', transform: 'TRIM', payload: { note: 'IT preferred' } },
    isco_code:         { forTarget: 'sys_esco_occupation_mappings', target: 'esco_occupation_mapping_isco_code', transform: 'TRIM' },
  },
  competencies: {
    name:              { forTarget: 'sys_skills', target: 'skill_name', transform: 'TRIM' },
    description:       { forTarget: 'sys_skills', target: 'skill_description', transform: 'TRIM' },
    category:          { forTarget: 'sys_skill_categories', target: 'skill_category_code', transform: 'TRIM' },
  },
  competency_frameworks: {
    name:              { forTarget: 'sys_skill_families', target: 'skill_family_name', transform: 'TRIM' },
    description:       { forTarget: 'sys_skill_families', target: 'skill_family_description', transform: 'TRIM' },
  },
  courses: {
    code:              { forTarget: 'sys_learning_modules', target: 'learning_module_code', transform: 'TRIM' },
    title:             { forTarget: 'sys_learning_modules', target: 'learning_module_title', transform: 'TRIM' },
    title_en:          { forTarget: 'sys_learning_modules', target: 'learning_module_title', transform: 'TRIM', payload: { note: 'EN fallback' } },
    description:       { forTarget: 'sys_learning_modules', target: 'learning_module_description', transform: 'TRIM' },
    description_en:    { forTarget: 'sys_learning_modules', target: 'learning_module_description', transform: 'TRIM', payload: { note: 'EN fallback' } },
    course_type:       { forTarget: 'sys_learning_modules', target: 'learning_module_kind', transform: 'UPPERCASE' },
    duration_hours:    { forTarget: 'sys_learning_modules', target: 'learning_module_duration_minutes', transform: 'CAST_NUMERIC', payload: { note: 'multiply by 60 in transform step (hours → minutes)' } },
  },
  learning_paths: {
    code:              { forTarget: 'sys_learning_paths', target: 'learning_path_code', transform: 'TRIM' },
    name:              { forTarget: 'sys_learning_paths', target: 'learning_path_name', transform: 'TRIM' },
    description:       { forTarget: 'sys_learning_paths', target: 'learning_path_description', transform: 'TRIM' },
  },
  certifications: {
    code:              { forTarget: 'sys_user_certifications', target: 'user_certification_name', transform: 'TRIM', payload: { note: 'catalog row — certification code stored on name; per-user instance follows in Wave 3' } },
    name:              { forTarget: 'sys_user_certifications', target: 'user_certification_name', transform: 'TRIM' },
    name_it:           { forTarget: 'sys_user_certifications', target: 'user_certification_name', transform: 'TRIM', payload: { note: 'IT preferred' } },
    name_en:           { forTarget: 'sys_user_certifications', target: 'user_certification_name', transform: 'TRIM', payload: { note: 'EN fallback' } },
    issuing_organization: { forTarget: 'sys_user_certifications', target: 'user_certification_issuer', transform: 'TRIM' },
  },
  skill_aliases: {
    alias_text:        { forTarget: 'sys_skill_aliases', target: 'skill_alias_label',  transform: 'TRIM' },
    language_code:     { forTarget: 'sys_skill_aliases', target: 'skill_alias_locale', transform: 'LOWERCASE' },
    esco_skill_id:     { forTarget: 'sys_skill_aliases', target: 'skill_alias_skill_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_skills', match_on: 'skill_metadata->>legacy_id' } },
  },
  skill_synonyms: {
    synonym_text:      { forTarget: 'sys_skill_aliases', target: 'skill_alias_label', transform: 'TRIM' },
    language_code:     { forTarget: 'sys_skill_aliases', target: 'skill_alias_locale', transform: 'LOWERCASE' },
  },
  skill_classifications: {
    name:              { forTarget: 'sys_skill_categories', target: 'skill_category_name', transform: 'TRIM' },
    code:              { forTarget: 'sys_skill_categories', target: 'skill_category_code', transform: 'TRIM' },
    description:       { forTarget: 'sys_skill_categories', target: 'skill_category_description', transform: 'TRIM' },
  },
  skill_clusters: {
    name:              { forTarget: 'sys_skill_families', target: 'skill_family_name', transform: 'TRIM' },
    code:              { forTarget: 'sys_skill_families', target: 'skill_family_code', transform: 'TRIM' },
    description:       { forTarget: 'sys_skill_families', target: 'skill_family_description', transform: 'TRIM' },
  },
  skill_relationships: {
    source_skill_id:   { forTarget: 'sys_skill_taxonomy_edges', target: 'skill_taxonomy_edge_parent_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_skills', match_on: 'skill_metadata->>legacy_id' } },
    target_skill_id:   { forTarget: 'sys_skill_taxonomy_edges', target: 'skill_taxonomy_edge_child_id',  transform: 'LOOKUP_FK', payload: { target_table: 'sys_skills', match_on: 'skill_metadata->>legacy_id' } },
    relationship_type: { forTarget: 'sys_skill_taxonomy_edges', target: 'skill_taxonomy_edge_kind', transform: 'UPPERCASE' },
  },
  process_kpis: {
    kpi_code:          { forTarget: 'sys_process_kpi_templates', target: 'process_kpi_template_kpi_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_kpi_definitions', match_on: 'kpi_definition_code' } },
    process_id:        { forTarget: 'sys_process_kpi_templates', target: 'process_kpi_template_process_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_blueprint_process_registry', match_on: 'blueprint_process_metadata->>legacy_id' } },
  },
  process_phases: {
    phase_code:        { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_metadata', transform: 'JSON_EXTRACT', payload: { path: '$.phases[].code' } },
    phase_name:        { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_metadata', transform: 'JSON_EXTRACT', payload: { path: '$.phases[].name' } },
    phase_order:       { forTarget: 'sys_blueprint_process_registry', target: 'blueprint_process_metadata', transform: 'JSON_EXTRACT', payload: { path: '$.phases[].order' } },
  },
  job_title_courses: {
    job_title:         { forTarget: 'sys_skill_learning_mappings', target: 'skill_learning_mapping_skill_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_skills', match_on: 'skill_name' } },
    course_id:         { forTarget: 'sys_skill_learning_mappings', target: 'skill_learning_mapping_module_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_learning_modules', match_on: 'learning_module_metadata->>legacy_id' } },
  },
  job_title_learning_paths: {
    job_title:         { forTarget: 'sys_position_learning_requirements', target: 'position_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_positions', match_on: 'position_metadata->>legacy_job_title' } },
    learning_path_id:  { forTarget: 'sys_position_learning_requirements', target: 'learning_path_id', transform: 'LOOKUP_FK', payload: { target_table: 'sys_learning_paths', match_on: 'learning_path_metadata->>legacy_id' } },
  },
};

// ---------------------------------------------------------------------------
// Decide the mapping for a single (source_table, source_column, target_table) triple.
//
// Returns { target_column, transform, payload, pii_disposition, comment }
// or null to indicate SKIP.
// ---------------------------------------------------------------------------
function decideMapping(source_table, source_col, target_table) {
  const colName = source_col.name;
  const colDtype = (source_col.data_type || '').toLowerCase();

  // -- Explicit SKIPs --------------------------------------------------------
  // pgvector USER-DEFINED embedding columns — recomputable downstream.
  if (colDtype === 'user-defined' || colName.startsWith('embedding_')) {
    return {
      target_column: '__SKIP__',
      transform: 'SKIP',
      payload: { reason: 'AI embedding (pgvector USER-DEFINED) — recomputable, not imported' },
      pii: 'NONE',
      comment: 'pgvector skip',
    };
  }

  // -- 1. Per-source-table override -----------------------------------------
  const overrides = SOURCE_OVERRIDES[source_table];
  if (overrides && overrides[colName]) {
    const ov = overrides[colName];
    if (!ov.forTarget || ov.forTarget === target_table) {
      return {
        target_column: ov.target,
        transform: ov.transform,
        payload: ov.payload || {},
        pii: 'NONE',
        comment: 'override',
      };
    }
    // override exists but doesn't apply to this target — fall through to heuristic.
  }

  // -- 2. Semantic rule pass -------------------------------------------------
  for (const rule of SEMANTIC_RULES) {
    if (rule.match.test(colName)) {
      // Try to resolve the concept against this target table.
      const tc = resolveTargetColumn(target_table, rule.concept);
      if (tc) {
        let payload = {};
        if (typeof rule.payload === 'function') payload = rule.payload();
        return {
          target_column: tc,
          transform: rule.transform,
          payload,
          pii: 'NONE',
          comment: `semantic:${rule.concept}`,
        };
      }
      // concept doesn't exist in target — fall through to metadata embedding.
    }
  }

  // -- 3. Canonical exact match in target ------------------------------------
  // If the source column name matches an existing target column exactly, DIRECT_COPY.
  const targetCols = TARGET_COLS[target_table] || [];
  const exact = targetCols.find(c => c.name === colName);
  if (exact) {
    return {
      target_column: exact.name,
      transform: 'DIRECT_COPY',
      payload: {},
      pii: 'NONE',
      comment: 'exact-name-match',
    };
  }

  // -- 4. Prefix + suffix match (e.g. source 'name' -> target '<prefix>name') --
  const targetPrefix = TARGET_PREFIX[target_table] || '';
  const prefixed = `${targetPrefix}${colName}`;
  const prefixedMatch = targetCols.find(c => c.name === prefixed);
  if (prefixedMatch) {
    return {
      target_column: prefixedMatch.name,
      transform: 'DIRECT_COPY',
      payload: {},
      pii: 'NONE',
      comment: 'prefixed-name-match',
    };
  }

  // -- 5. Metadata embedding fallback ----------------------------------------
  const metaCol = metadataCol(target_table);
  return {
    target_column: metaCol,
    transform: 'JSON_EXTRACT',
    payload: { path: `$.legacy.${colName}`, direction: 'embed', source_dtype: colDtype },
    pii: 'NONE',
    comment: 'metadata-embed',
  };
}

// ---------------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------------
const sqlString = (s) => {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
};
const sqlJson = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;

const lines = [];
lines.push('-- db/seeds/brownfield/wave1/04_column_mappings.sql');
lines.push('-- Wave 1 column-level mapping rows (idempotent).');
lines.push('-- Generated by scripts/generate_wave1_column_mappings.mjs');
lines.push('-- One INSERT per (table_mapping, source_column) pair.');
lines.push('--');
lines.push('-- Strategy:');
lines.push('--   1. per-source-table OVERRIDES from BROWNFIELD_ADAPTATION_MAP §4');
lines.push('--   2. semantic-rule match against target column prefix');
lines.push('--   3. exact / prefixed name match');
lines.push('--   4. metadata embedding fallback (target_column = <target>_metadata)');
lines.push('--   5. SKIP only for pgvector embeddings (recomputable AI artifact)');
lines.push('--');
lines.push('-- All inserts use ON CONFLICT (column_mapping_table_mapping_id, column_mapping_source_column_id)');
lines.push('-- DO NOTHING for idempotency.');
lines.push('');

// Stats
const stats = {
  total: 0,
  byTransform: {},
  byDomain: {},
  skipped: [],
  unmappedFromCatalog: [],
};

// We iterate per (source_table, target_table). For each, we emit a single big
// INSERT ... SELECT ... FROM (VALUES ...) block. The block resolves the
// table_mapping_id and the source_column_id by joining against existing rows.

// Group TABLE_MAPPINGS by source_table_name to compute the target list per source.
const sources = Object.keys(TARGETS_BY_SOURCE).sort();

for (const sourceTable of sources) {
  const t = LEGACY_TABLES[sourceTable];
  if (!t || !t.columns || t.columns.length === 0) {
    lines.push(`-- SKIP ${sourceTable}: not in catalog.json or empty columns`);
    stats.unmappedFromCatalog.push(sourceTable);
    continue;
  }
  const targets = TARGETS_BY_SOURCE[sourceTable];

  for (const targetTable of targets) {
    lines.push(`-- ${sourceTable} → sys.${targetTable} (${t.columns.length} columns)`);
    lines.push('WITH tm AS (');
    lines.push('  SELECT tm.table_mapping_id');
    lines.push('    FROM brownfield.table_mappings tm');
    lines.push('    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id');
    lines.push('    JOIN brownfield.source_exports se ON se.source_export_id = st.source_table_export_id');
    lines.push(`   WHERE st.source_table_name = ${sqlString(sourceTable)}`);
    lines.push(`     AND st.source_table_schema = 'public'`);
    lines.push(`     AND tm.table_mapping_target_schema = 'sys'`);
    lines.push(`     AND tm.table_mapping_target_table = ${sqlString(targetTable)}`);
    lines.push(`     AND se.source_export_name = ${sqlString(EXPORT_NAME)}`);
    lines.push('), src AS (');
    lines.push('  SELECT sc.source_column_id, sc.source_column_name');
    lines.push('    FROM brownfield.source_columns sc');
    lines.push('    JOIN brownfield.source_tables st ON st.source_table_id = sc.source_column_table_id');
    lines.push('    JOIN brownfield.source_exports se ON se.source_export_id = st.source_table_export_id');
    lines.push(`   WHERE st.source_table_name = ${sqlString(sourceTable)}`);
    lines.push(`     AND st.source_table_schema = 'public'`);
    lines.push(`     AND se.source_export_name = ${sqlString(EXPORT_NAME)}`);
    lines.push(')');
    lines.push('INSERT INTO brownfield.column_mappings (');
    lines.push('  column_mapping_table_mapping_id, column_mapping_source_column_id,');
    lines.push('  column_mapping_target_column, column_mapping_transform,');
    lines.push('  column_mapping_transform_payload, column_mapping_pii_disposition,');
    lines.push('  column_mapping_metadata');
    lines.push(')');
    lines.push('SELECT tm.table_mapping_id, src.source_column_id, v.tgt, v.tf, v.pl, v.pii, v.meta');
    lines.push('  FROM tm, src,');
    lines.push('  (VALUES');

    const valueRows = [];
    for (const col of t.columns) {
      const decision = decideMapping(sourceTable, col, targetTable);
      const isSkip = decision.transform === 'SKIP';

      // Stats
      stats.total++;
      stats.byTransform[decision.transform] = (stats.byTransform[decision.transform] || 0) + 1;
      if (isSkip) stats.skipped.push({ source: sourceTable, col: col.name, reason: decision.payload.reason });

      const meta = {
        legacy_column: col.name,
        legacy_dtype: col.data_type,
        legacy_nullable: col.nullable,
        rule: decision.comment,
      };

      valueRows.push(
        `    (${sqlString(col.name)}::varchar, ${sqlString(decision.target_column)}, ` +
        `${decision.transform ? sqlString(decision.transform) : 'NULL'}, ` +
        `${sqlJson(decision.payload || {})}, ${sqlString(decision.pii || 'NONE')}, ${sqlJson(meta)})`,
      );
    }
    lines.push(valueRows.join(',\n'));
    lines.push('  ) AS v(legacy_col, tgt, tf, pl, pii, meta)');
    lines.push('  WHERE src.source_column_name = v.legacy_col');
    lines.push('ON CONFLICT (column_mapping_table_mapping_id, column_mapping_source_column_id) DO NOTHING;');
    lines.push('');
  }
}

// ---------------------------------------------------------------------------
// Write SQL
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_SQL, lines.join('\n'));
console.log(`Wrote ${OUT_SQL} (${lines.length} lines, ${stats.total} INSERT rows)`);

// ---------------------------------------------------------------------------
// Build the markdown report
// ---------------------------------------------------------------------------
const reportLines = [];
reportLines.push('# Wave 1 — Column Mapping Seed Report');
reportLines.push('');
reportLines.push(`Generated: ${new Date().toISOString()}`);
reportLines.push(`Source: \`scripts/generate_wave1_column_mappings.mjs\``);
reportLines.push(`Output SQL: \`db/seeds/brownfield/wave1/04_column_mappings.sql\``);
reportLines.push('');
reportLines.push('## Summary');
reportLines.push('');
reportLines.push(`- Total INSERT rows emitted: **${stats.total}**`);
reportLines.push(`- Source tables in catalog: **${sources.length - stats.unmappedFromCatalog.length}/${sources.length}**`);
reportLines.push(`- Distinct target tables covered: **${Object.keys(TARGET_COLS).length}**`);
reportLines.push('');
reportLines.push('## Transform breakdown');
reportLines.push('');
reportLines.push('| Transform | Count |');
reportLines.push('|---|---:|');
const transformEntries = Object.entries(stats.byTransform).sort((a, b) => b[1] - a[1]);
for (const [tf, n] of transformEntries) {
  reportLines.push(`| \`${tf}\` | ${n} |`);
}
reportLines.push('');
reportLines.push('## Per-domain coverage');
reportLines.push('');
// Compute per-domain by walking the catalog + table_mappings — replicate the
// same logic SQL would, but here in JS for the report.
const domainStats = {}; // domain -> { total, real, skipped }
for (const tm of TABLE_MAPPINGS) {
  const t = LEGACY_TABLES[tm.source_table_name];
  if (!t || !t.columns) continue;
  // The table_mappings rows carry the wave-1 source tables. The original wave1
  // build assigns a primary domain via TARGETS_BY_SOURCE — but here we don't
  // have it directly; we look it up from a synthesized map below.
}
// Build domain index from CSV-style source_table_domain via a quick psql call.
const domainCsv = execSync(
  `psql -tAc "SELECT st.source_table_name || '|' || st.source_table_domain FROM brownfield.source_tables st WHERE st.source_table_classification='IMPORT'" "${DB_URL}"`,
  { encoding: 'utf8' }
).trim().split(/\r?\n/);
const SOURCE_TO_DOMAIN = {};
for (const line of domainCsv) {
  const [name, dom] = line.replace(/\r$/, '').split('|');
  SOURCE_TO_DOMAIN[name] = (dom || '').replace(/\r/g, '').trim();
}
for (const tm of TABLE_MAPPINGS) {
  const t = LEGACY_TABLES[tm.source_table_name];
  if (!t || !t.columns) continue;
  const dom = SOURCE_TO_DOMAIN[tm.source_table_name] || 'UNKNOWN';
  domainStats[dom] ||= { total: 0, real: 0, skipped: 0 };
  for (const col of t.columns) {
    const d = decideMapping(tm.source_table_name, col, tm.table_mapping_target_table);
    domainStats[dom].total++;
    if (d.transform === 'SKIP') domainStats[dom].skipped++;
    else domainStats[dom].real++;
  }
}
reportLines.push('| Domain | Total mappings | Real mappings | Skipped |');
reportLines.push('|---|---:|---:|---:|');
for (const [dom, s] of Object.entries(domainStats).sort((a, b) => b[1].total - a[1].total)) {
  reportLines.push(`| ${dom} | ${s.total} | ${s.real} | ${s.skipped} |`);
}
reportLines.push('');
reportLines.push('## Skipped source columns');
reportLines.push('');
reportLines.push(`Total SKIPs: **${stats.skipped.length}**`);
reportLines.push('');
if (stats.skipped.length > 0) {
  // Group by reason
  const byReason = {};
  for (const s of stats.skipped) {
    (byReason[s.reason] ||= []).push(`${s.source}.${s.col}`);
  }
  for (const [reason, items] of Object.entries(byReason)) {
    reportLines.push(`### ${reason}`);
    reportLines.push('');
    reportLines.push(`Count: ${items.length}`);
    reportLines.push('');
    reportLines.push('```');
    reportLines.push(items.slice(0, 60).join('\n'));
    if (items.length > 60) reportLines.push(`... and ${items.length - 60} more`);
    reportLines.push('```');
    reportLines.push('');
  }
}
if (stats.unmappedFromCatalog.length > 0) {
  reportLines.push('## Source tables NOT in catalog.json (no mappings emitted)');
  reportLines.push('');
  reportLines.push('```');
  reportLines.push(stats.unmappedFromCatalog.join('\n'));
  reportLines.push('```');
  reportLines.push('');
}
reportLines.push('## Notes');
reportLines.push('');
reportLines.push('- All `column_mapping_pii_disposition` = `NONE` (data is project case-study per `feedback_data_treatment_no_privacy_concerns.md`).');
reportLines.push('- Legacy primary key `id` columns map with `LINEAGE_SOURCE_NK` — the legacy PK is stored on the lineage row (`sys.sys_source_lineage_records.source_pk_value`), not on the canonical row.');
reportLines.push('- pgvector embedding columns (`embedding_*`, USER-DEFINED dtype) are SKIPPED — they are recomputable downstream by the AI pipeline.');
reportLines.push('- Bilingual fields (`name_it` / `name_en`, `description_it` / `description_en`, `title_it` / `title_en`) all map to the single target column with IT preferred and EN as fallback. The runtime transform layer will COALESCE(name_it, name_en, preferred_label).');
reportLines.push('- Source columns with no direct counterpart fall into the target table\'s `*_metadata` jsonb via `JSON_EXTRACT` transform, payload path `$.legacy.<column_name>`.');
reportLines.push('');
fs.writeFileSync(OUT_REPORT, reportLines.join('\n'));
console.log(`Wrote ${OUT_REPORT}`);

// Final summary
console.log('');
console.log('Summary:');
console.log(`  Total mappings: ${stats.total}`);
console.log('  Transform breakdown:');
for (const [tf, n] of transformEntries) console.log(`    ${tf}: ${n}`);
console.log(`  SKIPs: ${stats.skipped.length}`);
console.log(`  Source tables not in catalog: ${stats.unmappedFromCatalog.length}`);
