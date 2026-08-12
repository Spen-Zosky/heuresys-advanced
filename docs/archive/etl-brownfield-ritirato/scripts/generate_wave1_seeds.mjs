#!/usr/bin/env node
/**
 * generate_wave1_seeds.mjs
 *
 * Generate the 4 idempotent SQL seed files for Wave 1 brownfield mapping
 * registry population, under db/seeds/brownfield/wave1/.
 *
 * Inputs:
 *   docs/source_bundle/brownfield/extracted/catalog.json (table & column metadata)
 *   docs/brownfield/_inspection_artifacts/tables_with_domains.csv (Wave 1 filter)
 *   docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md (canonical mappings, embedded below as JS dict)
 *
 * Outputs (idempotent — every INSERT uses ON CONFLICT DO NOTHING):
 *   db/seeds/brownfield/wave1/00_source_export.sql
 *   db/seeds/brownfield/wave1/01_source_tables.sql
 *   db/seeds/brownfield/wave1/02_source_columns.sql
 *   db/seeds/brownfield/wave1/03_table_mappings.sql
 *
 * Run: node scripts/generate_wave1_seeds.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''));
const ROOT = path.resolve(REPO, '..');
const CATALOG_PATH = path.join(ROOT, 'docs/source_bundle/brownfield/extracted/catalog.json');
const CSV_PATH = path.join(ROOT, 'docs/brownfield/_inspection_artifacts/tables_with_domains.csv');
const OUT_DIR = path.join(ROOT, 'db/seeds/brownfield/wave1');

// db-export.zip metadata (sha256 computed externally; size and name fixed).
const EXPORT_NAME = 'db-export-2026-05-15';
const EXPORT_SHA256 = '09e5e98c28b701bb008a051e068b731c87bc170d4b4f5bbc8d7a400e81b6e594';
const EXPORT_SIZE_BYTES = 1066682;
const EXPORT_FILE_COUNT = 35;

// Wave-1 in-scope domains (matches BROWNFIELD_ADAPTATION_MAP §4).
const WAVE1_DOMAINS = new Set(['ESKAP', 'SKILGRO', 'INDOOR', 'ITLAB', 'PROGOV', 'OPOURSKA', 'H2R']);

// ---------------------------------------------------------------------------
// Canonical source -> target mapping for Wave 1 IMPORT tables.
// Derived from BROWNFIELD_ADAPTATION_MAP.md §4.1, 4.3, 4.5, 4.6, 4.8, 4.9, 4.10
// Each value is an array of {target_table, natural_key_pattern, transform_hint?}.
// Fallback heuristic is used for tables not enumerated here (see assignTarget()).
// ---------------------------------------------------------------------------
const EXPLICIT_MAP = {
  // ---- OPOURSKA (4) ----
  business_processes:        [{ t: 'sys_blueprint_process_registry', k: 'BLUEPRINT_PROCESS::<code>', h: 'process_registry with FK to blueprint variant' }],
  esco_skills:               [{ t: 'sys_skills',                     k: 'ESCO_SKILL::<uri>' }],
  job_templates:             [{ t: 'sys_job_roles',                  k: 'JOB_ROLE::<family>::<code>' }],
  job_template_skills:       [{ t: 'sys_position_skill_requirements', k: 'POSITION_SKILL::<position_id>::<skill_id>', h: 'derived from job_template instantiation' }],

  // ---- INDOOR (10) ----
  industry_classifications:    [{ t: 'sys_activity_classifications',           k: 'ATECO_2025::<code>' }, { t: 'sys_activity_classifications', k: 'NACE_REV_2_1::<code>', h: 'NACE variant' }],
  industry_ccnl_mapping:       [{ t: 'sys_activity_classification_mappings',   k: 'ATECO_CCNL::<ateco>::<ccnl>' }],
  industry_occupation_mapping: [{ t: 'sys_esco_occupation_mappings',           k: 'INDUSTRY_OCC::<industry>::<occupation>' }],
  benchmark_configs:           [{ t: 'sys_blueprint_overrides',                k: 'BENCHMARK_CONFIG::<tenant>::<industry>' }],
  benchmark_reports:           [{ t: 'sys_blueprint_overrides',                k: 'BENCHMARK_REPORT::<tenant>::<industry>::<period>' }],
  industry_profiles:           [{ t: 'sys_activity_classifications',           k: 'INDUSTRY_PROFILE::<code>' }],
  industry_size_bands:         [{ t: 'sys_activity_classifications',           k: 'INDUSTRY_SIZE_BAND::<code>' }],
  occupation_industry_classifications: [{ t: 'sys_esco_occupation_mappings',   k: 'OCC_INDUSTRY::<occupation>::<industry>' }],
  tenant_industry_classifications:     [{ t: 'sys_blueprint_overrides',        k: 'TENANT_INDUSTRY::<tenant>::<industry>' }],
  holidays:                    [{ t: 'sys_blueprint_overrides',                k: 'HOLIDAY::<country>::<date>', h: 'holiday catalog override' }],

  // ---- H2R (2 IMPORT only) ----
  job_title_courses:        [{ t: 'sys_skill_learning_mappings',     k: 'JOB_TITLE_COURSE::<title>::<course>' }],
  job_title_learning_paths: [{ t: 'sys_position_learning_requirements', k: 'JOB_TITLE_PATH::<title>::<path>' }],

  // ---- SKILGRO (39) ----
  certifications:               [{ t: 'sys_user_certifications',     k: 'CERTIFICATION::<code>', h: 'catalog rows; instances per user' }],
  certification_esco_skills:    [{ t: 'sys_skill_learning_mappings', k: 'CERT_SKILL::<certification>::<skill>' }],
  competencies:                 [{ t: 'sys_skills',                  k: 'COMPETENCY::<code>' }, { t: 'sys_skill_categories', k: 'COMPETENCY_CATEGORY::<code>', h: 'category facet' }],
  competency_frameworks:        [{ t: 'sys_skill_families',          k: 'COMPETENCY_FRAMEWORK::<code>' }],
  competency_review_ratings:    [{ t: 'sys_skills',                  k: 'COMPETENCY_RATING::<competency>::<level>', h: 'rating-scale attribute' }],
  courses:                      [{ t: 'sys_learning_modules',        k: 'LEARNING_MODULE::<scope>::<title_hash>' }],
  course_modules:               [{ t: 'sys_learning_path_steps',     k: 'COURSE_MODULE::<course>::<position>' }],
  course_enrollments:           [{ t: 'sys_learning_paths',          k: 'COURSE_ENROLLMENT::<user>::<course>', h: 'enrollment catalog row (instance ↔ path)' }],
  course_enrollments_semantic:  [{ t: 'sys_learning_paths',          k: 'COURSE_ENROLLMENT_SEM::<enrollment>' }],
  course_esco_skills:           [{ t: 'sys_skill_learning_mappings', k: 'COURSE_SKILL::<course>::<skill>' }],
  learning_paths:               [{ t: 'sys_learning_paths',          k: 'LEARNING_PATH::<tenant>::<code>' }],
  learning_path_courses:        [{ t: 'sys_learning_path_steps',     k: 'PATH_COURSE::<path>::<course>::<order>' }],
  learning_path_enrollments:    [{ t: 'sys_learning_paths',          k: 'PATH_ENROLLMENT::<user>::<path>' }],
  learning_bookmarks:           [{ t: 'sys_learning_modules',        k: 'LEARNING_BOOKMARK::<user>::<module>' }],
  learning_content_providers:   [{ t: 'sys_learning_modules',        k: 'CONTENT_PROVIDER::<code>' }],
  learning_ratings:             [{ t: 'sys_learning_modules',        k: 'LEARNING_RATING::<module>::<rater>' }],
  learning_recommendations:     [{ t: 'sys_learning_modules',        k: 'LEARNING_REC::<user>::<module>' }],
  module_completions:           [{ t: 'sys_learning_modules',        k: 'MODULE_COMPLETION::<user>::<module>' }],
  rating_scales:                [{ t: 'sys_skills',                  k: 'RATING_SCALE::<code>', h: 'scale catalog metadata' }],
  market_benchmarks:            [{ t: 'sys_skills',                  k: 'MARKET_BENCHMARK::<industry>::<role>', h: 'skill market intelligence' }],
  market_salary_data:           [{ t: 'sys_skills',                  k: 'MARKET_SALARY::<role>::<region>', h: 'skill compensation overlay (Wave1 catalog only)' }],
  skill_adjacencies:            [{ t: 'sys_skill_taxonomy_edges',    k: 'SKILL_ADJACENCY::<skill_a>::<skill_b>' }],
  skill_aliases:                [{ t: 'sys_skill_aliases',           k: 'SKILL_ALIAS::<skill>::<alias>' }],
  skill_classifications:        [{ t: 'sys_skill_categories',        k: 'SKILL_CLASSIFICATION::<code>' }],
  skill_clusters:               [{ t: 'sys_skill_families',          k: 'SKILL_CLUSTER::<code>' }],
  skill_demand_metrics:         [{ t: 'sys_skills',                  k: 'SKILL_DEMAND::<skill>::<period>' }],
  skill_development_paths:      [{ t: 'sys_learning_paths',          k: 'SKILL_DEV_PATH::<skill>' }],
  skill_extraction_jobs:        [{ t: 'sys_skills',                  k: 'SKILL_EXTRACT_JOB::<job_id>', h: 'job metadata only' }],
  skill_gap_analyses:           [{ t: 'sys_skills',                  k: 'SKILL_GAP::<tenant>::<period>' }],
  skill_gap_snapshots:          [{ t: 'sys_skills',                  k: 'SKILL_GAP_SNAP::<tenant>::<period>::<seq>' }],
  skill_matrices:               [{ t: 'sys_skill_taxonomy_edges',    k: 'SKILL_MATRIX::<row>::<col>' }],
  skill_migration_jobs:         [{ t: 'sys_skills',                  k: 'SKILL_MIGRATION_JOB::<job_id>' }],
  skill_pair_usage:             [{ t: 'sys_skill_taxonomy_edges',    k: 'SKILL_PAIR::<skill_a>::<skill_b>' }],
  skill_relationships:          [{ t: 'sys_skill_taxonomy_edges',    k: 'SKILL_RELATIONSHIP::<skill_a>::<skill_b>::<type>' }],
  skill_requirements_templates: [{ t: 'sys_position_skill_requirements', k: 'SKILL_REQ_TEMPLATE::<template>' }],
  skill_supply_metrics:         [{ t: 'sys_skills',                  k: 'SKILL_SUPPLY::<skill>::<period>' }],
  skill_synonyms:               [{ t: 'sys_skill_aliases',           k: 'SKILL_SYNONYM::<skill>::<synonym>' }],
  skill_taxonomy_extensions:    [{ t: 'sys_skill_taxonomy_edges',    k: 'SKILL_TAXONOMY_EXT::<source>::<target>' }],
  unknown_skills:               [{ t: 'sys_skills',                  k: 'UNKNOWN_SKILL::<text>' }],
  extracted_skills:             [{ t: 'sys_skills',                  k: 'EXTRACTED_SKILL::<source>::<text>' }],
  import_skill_links:           [{ t: 'sys_skill_taxonomy_edges',    k: 'IMPORT_SKILL_LINK::<source>::<target>' }],

  // ---- ITLAB (7) ----
  ccnl_contracts:        [{ t: 'sys_compensation_bands', k: 'CCNL::<contract>::<version>' }],
  ccnl_executive_bands:  [{ t: 'sys_compensation_bands', k: 'CCNL_EXEC_BAND::<contract>::<band>' }],
  ccnl_job_title_mapping:[{ t: 'sys_job_roles',          k: 'CCNL_JOB_TITLE::<contract>::<level>::<title>' }],
  ccnl_levels:           [{ t: 'sys_compensation_bands', k: 'CCNL_LEVEL::<contract>::<level>' }],
  ccnl_seniority_rules:  [{ t: 'sys_compensation_bands', k: 'CCNL_SENIORITY::<contract>::<rule>' }],
  sindacati:             [{ t: 'sys_compensation_bands', k: 'SINDACATO::<code>', h: 'union reference (REFERENCE_ONLY in MAP §4.10; promoted to band overlay for Wave 1 import)' }],

  // ---- PROGOV (2) ----
  process_kpis:   [{ t: 'sys_process_kpi_templates',     k: 'FIN_BANKING_KPI::<process_code>::<kpi_code>' }],
  process_phases: [{ t: 'sys_blueprint_process_registry', k: 'PROCESS_PHASE::<process>::<phase>', h: 'embedded as process_registry.metadata.phases' }],

  // ---- ESKAP (29) ----
  cross_entity_relations:    [{ t: 'sys_skill_taxonomy_edges',    k: 'CROSS_ENTITY_REL::<src>::<tgt>::<type>' }],
  cross_entity_searches:     [{ t: 'sys_skills',                  k: 'CROSS_ENTITY_SEARCH::<query_hash>', h: 'search audit; metadata only' }],
  esco_isco_groups:          [{ t: 'sys_skill_families',          k: 'ISCO_GROUP::<code>' }],
  esco_occupation_skills:    [{ t: 'sys_position_skill_requirements', k: 'ESCO_OCC_SKILL::<occupation>::<skill>' }],
  esco_occupations:          [{ t: 'sys_esco_occupation_mappings', k: 'ESCO_OCCUPATION::<uri>' }],
  esco_skill_groups:         [{ t: 'sys_skill_families',          k: 'ESCO_SKILL_GROUP::<code>' }],
  esco_skill_relations:      [{ t: 'sys_skill_taxonomy_edges',    k: 'ESCO_SKILL_REL::<src>::<tgt>::<type>' }],
  onet_abilities:            [{ t: 'sys_skills',                  k: 'ONET_ABILITY::<code>' }],
  onet_esco_mappings:        [{ t: 'sys_skill_taxonomy_edges',    k: 'ONET_ESCO::<onet>::<esco>' }],
  onet_import_jobs:          [{ t: 'sys_skills',                  k: 'ONET_IMPORT_JOB::<job_id>', h: 'job metadata only' }],
  onet_knowledge:            [{ t: 'sys_skills',                  k: 'ONET_KNOWLEDGE::<code>' }],
  onet_occupation_abilities: [{ t: 'sys_position_skill_requirements', k: 'ONET_OCC_ABILITY::<occupation>::<ability>' }],
  onet_occupation_knowledge: [{ t: 'sys_position_skill_requirements', k: 'ONET_OCC_KNOWLEDGE::<occupation>::<knowledge>' }],
  onet_occupation_skills:    [{ t: 'sys_position_skill_requirements', k: 'ONET_OCC_SKILL::<occupation>::<skill>' }],
  onet_occupation_work_activities: [{ t: 'sys_position_skill_requirements', k: 'ONET_OCC_WORK_ACT::<occupation>::<activity>' }],
  onet_occupations:          [{ t: 'sys_esco_occupation_mappings', k: 'ONET_OCCUPATION::<code>' }],
  onet_skills:               [{ t: 'sys_skills',                  k: 'ONET_SKILL::<code>' }],
  onet_work_activities:      [{ t: 'sys_skills',                  k: 'ONET_WORK_ACTIVITY::<code>' }],
  ontology_categories:       [{ t: 'sys_skill_categories',        k: 'ONTOLOGY_CATEGORY::<code>' }],
  ontology_embedding_jobs:   [{ t: 'sys_skills',                  k: 'ONTOLOGY_EMBED_JOB::<job_id>', h: 'AI job metadata' }],
  ontology_feedback:         [{ t: 'sys_skills',                  k: 'ONTOLOGY_FEEDBACK::<entity>::<rater>' }],
  ontology_inference_jobs:   [{ t: 'sys_skills',                  k: 'ONTOLOGY_INFER_JOB::<job_id>' }],
  ontology_quality_metrics:  [{ t: 'sys_skills',                  k: 'ONTOLOGY_QUALITY::<metric>::<period>' }],
  ontology_skill_dimensions: [{ t: 'sys_skills',                  k: 'ONTOLOGY_SKILL_DIM::<skill>::<dimension>' }],
  ontology_skill_relations:  [{ t: 'sys_skill_taxonomy_edges',    k: 'ONTOLOGY_SKILL_REL::<src>::<tgt>::<type>' }],
  ontology_source_mappings:  [{ t: 'sys_skill_taxonomy_edges',    k: 'ONTOLOGY_SRC_MAP::<src_system>::<src_id>::<canonical_id>' }],
  semantic_entity_index:     [{ t: 'sys_skills',                  k: 'SEMANTIC_INDEX::<entity_type>::<entity_id>' }],
  semantic_entity_relations: [{ t: 'sys_skill_taxonomy_edges',    k: 'SEMANTIC_REL::<src>::<tgt>::<type>' }],
  semantic_search_log:       [{ t: 'sys_skills',                  k: 'SEMANTIC_SEARCH::<query_hash>', h: 'search audit; metadata only' }],
};

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
const sqlString = (s) => {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
};
const sqlNum = (n) => (n === null || n === undefined || Number.isNaN(n)) ? 'NULL' : String(n);
const sqlBool = (b) => b ? 'true' : 'false';
const sqlJson = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;

// ---------------------------------------------------------------------------
// Read inputs
// ---------------------------------------------------------------------------
console.log('Reading catalog.json...');
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const tables = catalog.tables;

console.log('Reading tables_with_domains.csv...');
const csv = fs.readFileSync(CSV_PATH, 'utf8').split('\n');
// Header: table_name,domains,tenant_scoped,rls_enabled,row_estimate,n_columns,n_fks,classification,comment
const csvRows = csv.slice(1).filter(l => l.trim().length > 0).map(line => {
  // Split on comma but respect quoted commas in comment field
  const re = /(?:^|,)("(?:[^"]|"")*"|[^,]*)/g;
  const parts = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    let v = m[1];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
    parts.push(v);
  }
  return {
    table_name: parts[0],
    domains: parts[1],
    tenant_scoped: parts[2] === 'True',
    rls_enabled: parts[3] === 'True',
    row_estimate: parseInt(parts[4], 10) || 0,
    n_columns: parseInt(parts[5], 10) || 0,
    n_fks: parseInt(parts[6], 10) || 0,
    classification: parts[7],
    comment: parts[8] || '',
  };
});

// Filter Wave 1 IMPORT rows: classification=IMPORT and any domain in WAVE1_DOMAINS.
const wave1 = csvRows.filter(r => {
  if (r.classification !== 'IMPORT') return false;
  const sigles = r.domains.split('|');
  return sigles.some(s => WAVE1_DOMAINS.has(s));
});

console.log(`Wave 1 source tables: ${wave1.length}`);
if (wave1.length !== 93) {
  console.warn(`  WARNING: expected 93, got ${wave1.length}`);
}

// Pick the primary domain for each table (first sigle that is in WAVE1_DOMAINS).
for (const r of wave1) {
  const sigles = r.domains.split('|');
  r.primary_domain = sigles.find(s => WAVE1_DOMAINS.has(s)) || sigles[0];
}

// ---------------------------------------------------------------------------
// Fallback target assignment for tables not in EXPLICIT_MAP
// ---------------------------------------------------------------------------
function assignTarget(name, domain) {
  if (EXPLICIT_MAP[name]) return EXPLICIT_MAP[name];

  // Domain-based fallback
  const lc = name.toLowerCase();
  if (domain === 'ESKAP') {
    if (lc.includes('relation') || lc.includes('edge') || lc.includes('mapping')) {
      return [{ t: 'sys_skill_taxonomy_edges', k: `ESKAP_EDGE::${name}::<key>`, h: 'ESKAP edge fallback' }];
    }
    return [{ t: 'sys_skills', k: `ESKAP::${name}::<id>`, h: 'ESKAP catalog fallback' }];
  }
  if (domain === 'SKILGRO') {
    if (lc.includes('skill')) return [{ t: 'sys_skills', k: `SKILGRO_SKILL::${name}::<id>`, h: 'SKILGRO skill fallback' }];
    if (lc.includes('learn') || lc.includes('course') || lc.includes('module')) {
      return [{ t: 'sys_learning_modules', k: `SKILGRO_LEARN::${name}::<id>`, h: 'SKILGRO learning fallback' }];
    }
    return [{ t: 'sys_skill_categories', k: `SKILGRO::${name}::<id>`, h: 'SKILGRO category fallback' }];
  }
  if (domain === 'INDOOR') {
    if (lc.includes('industry') || lc.includes('nace') || lc.includes('ateco')) {
      return [{ t: 'sys_activity_classifications', k: `INDOOR_CLASSIF::${name}::<code>`, h: 'INDOOR classification fallback' }];
    }
    return [{ t: 'sys_esco_occupation_mappings', k: `INDOOR_OCC::${name}::<key>`, h: 'INDOOR mapping fallback' }];
  }
  if (domain === 'ITLAB') {
    return [{ t: 'sys_compensation_bands', k: `ITLAB::${name}::<code>`, h: 'ITLAB CCNL fallback' }];
  }
  if (domain === 'PROGOV') {
    return [{ t: 'sys_process_kpi_templates', k: `PROGOV::${name}::<code>`, h: 'PROGOV process fallback' }];
  }
  if (domain === 'OPOURSKA') {
    return [{ t: 'sys_blueprint_process_registry', k: `OPOURSKA::${name}::<code>`, h: 'OPOURSKA fallback' }];
  }
  if (domain === 'H2R') {
    return [{ t: 'sys_skill_learning_mappings', k: `H2R::${name}::<code>`, h: 'H2R fallback' }];
  }
  return [{ t: 'sys_skills', k: `UNMAPPED::${name}::<id>`, h: 'NO_DOMAIN_RULE — TODO map' }];
}

// ---------------------------------------------------------------------------
// File 00 — source_exports
// ---------------------------------------------------------------------------
function buildFile00() {
  const lines = [];
  lines.push('-- db/seeds/brownfield/wave1/00_source_export.sql');
  lines.push('-- Wave 1 source export registration (idempotent).');
  lines.push('-- Generated by scripts/generate_wave1_seeds.mjs');
  lines.push(`-- Bundle: docs/source_bundle/brownfield/db-export.zip (sha256=${EXPORT_SHA256})`);
  lines.push('');
  lines.push('INSERT INTO brownfield.source_exports (');
  lines.push('  source_export_name, source_export_file_hash, source_export_retrieved_at,');
  lines.push('  source_export_size_bytes, source_export_status, source_export_metadata');
  lines.push(') VALUES (');
  lines.push(`  ${sqlString(EXPORT_NAME)},`);
  lines.push(`  ${sqlString(EXPORT_SHA256)},`);
  lines.push(`  '2026-05-15T17:56:00Z'::timestamptz,`);
  lines.push(`  ${EXPORT_SIZE_BYTES}::bigint,`);
  lines.push(`  'INGESTED',`);
  lines.push(`  ${sqlJson({
    file_count: EXPORT_FILE_COUNT,
    schemas_in_zip: ['public'],
    ingested_by: 'wave1_bootstrap',
    bundle_path: 'docs/source_bundle/brownfield/db-export.zip',
    catalog_source: 'docs/source_bundle/brownfield/extracted/catalog.json',
    notes: 'Schema metadata only — no PII row data (per observation 9220 May 17 2026).',
  })}`);
  lines.push(`) ON CONFLICT (source_export_name) DO NOTHING;`);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File 01 — source_tables
// ---------------------------------------------------------------------------
function buildFile01() {
  const lines = [];
  lines.push('-- db/seeds/brownfield/wave1/01_source_tables.sql');
  lines.push('-- Wave 1 source-table registration: 93 rows (idempotent).');
  lines.push('-- Generated by scripts/generate_wave1_seeds.mjs');
  lines.push('-- Domains: ESKAP=29, SKILGRO=39, INDOOR=10, ITLAB=7, PROGOV=2, OPOURSKA=4, H2R=2');
  lines.push('');

  // Use a single multi-VALUES INSERT inside a CTE that resolves the export_id.
  // This keeps the parent FK resolution implicit in the seed.
  lines.push('WITH export AS (');
  lines.push(`  SELECT source_export_id FROM brownfield.source_exports WHERE source_export_name = ${sqlString(EXPORT_NAME)}`);
  lines.push(')');
  lines.push('INSERT INTO brownfield.source_tables (');
  lines.push('  source_table_export_id, source_table_schema, source_table_name,');
  lines.push('  source_table_rls_enabled, source_table_row_estimate,');
  lines.push('  source_table_domain, source_table_classification, source_table_metadata');
  lines.push(')');
  lines.push('SELECT export.source_export_id, v.schema, v.name, v.rls, v.rows, v.domain, v.cls, v.meta FROM export, (VALUES');

  const valueRows = [];
  for (const r of wave1) {
    const t = tables[r.table_name];
    if (!t) {
      console.warn(`  WARNING: ${r.table_name} not in catalog.json — using CSV-only metadata`);
    }
    const pkCols = (t && t.primary_key) ? t.primary_key : [];
    const fkCount = (t && t.foreign_keys) ? t.foreign_keys.length : r.n_fks;
    const allDomains = r.domains.split('|');
    const meta = {
      pk_columns: pkCols,
      fk_count: fkCount,
      tenant_scoped: r.tenant_scoped,
      n_columns: r.n_columns,
      all_domains: allDomains,
      legacy_comment: r.comment || null,
    };
    valueRows.push(
      `  (${sqlString('public')}, ${sqlString(r.table_name)}, ${sqlBool(r.rls_enabled)}, ` +
      `${sqlNum(r.row_estimate)}::bigint, ${sqlString(r.primary_domain)}, ${sqlString('IMPORT')}, ${sqlJson(meta)})`,
    );
  }
  lines.push(valueRows.join(',\n'));
  lines.push(') AS v(schema, name, rls, rows, domain, cls, meta)');
  lines.push('ON CONFLICT (source_table_export_id, COALESCE(source_table_schema, \'\'::varchar), source_table_name) DO NOTHING;');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File 02 — source_columns
// ---------------------------------------------------------------------------
function buildFile02() {
  const lines = [];
  lines.push('-- db/seeds/brownfield/wave1/02_source_columns.sql');
  lines.push('-- Wave 1 source-column registration: one row per (source_table, column) (idempotent).');
  lines.push('-- Generated by scripts/generate_wave1_seeds.mjs');
  lines.push('');

  // The brownfield.source_columns schema:
  //   source_column_table_id (FK), source_column_name, source_column_data_type,
  //   source_column_is_nullable, source_column_comment, source_column_pii_flag,
  //   source_column_metadata jsonb
  // Conflict target: (source_column_table_id, source_column_name)
  //
  // Use one INSERT statement per table_name (so the lookup CTE is per-table). This
  // keeps SQL output structured and lets a single failed lookup show clearly.

  let totalCols = 0;

  for (const r of wave1) {
    const t = tables[r.table_name];
    if (!t || !t.columns || t.columns.length === 0) {
      lines.push(`-- SKIP ${r.table_name}: not in catalog.json or empty columns`);
      continue;
    }
    lines.push(`-- ${r.table_name} (${r.primary_domain}): ${t.columns.length} columns`);
    lines.push('WITH src AS (');
    lines.push('  SELECT source_table_id FROM brownfield.source_tables');
    lines.push(`  WHERE source_table_name = ${sqlString(r.table_name)} AND source_table_schema = 'public'`);
    lines.push('    AND source_table_export_id = (SELECT source_export_id FROM brownfield.source_exports');
    lines.push(`        WHERE source_export_name = ${sqlString(EXPORT_NAME)})`);
    lines.push(')');
    lines.push('INSERT INTO brownfield.source_columns (');
    lines.push('  source_column_table_id, source_column_name, source_column_data_type,');
    lines.push('  source_column_is_nullable, source_column_comment, source_column_pii_flag,');
    lines.push('  source_column_metadata');
    lines.push(')');
    lines.push('SELECT src.source_table_id, v.name, v.dt, v.nl, v.cm, v.pii, v.meta FROM src, (VALUES');

    const colRows = [];
    for (const c of t.columns) {
      // data_type: prefer 'data_type' (e.g. 'character varying') but cap at 64 chars
      let dt = (c.data_type || c.type || 'unknown').toString().substring(0, 64);
      const meta = {
        position: c.position,
        udt_name: c.type,
        max_length: c.max_length,
        precision: c.precision,
        scale: c.scale,
        default: c.default,
      };
      // Strip null-valued metadata keys for cleanliness
      Object.keys(meta).forEach(k => { if (meta[k] === null || meta[k] === undefined) delete meta[k]; });
      colRows.push(
        `  (${sqlString(c.name)}, ${sqlString(dt)}, ${sqlBool(c.nullable !== false)}, ` +
        `${sqlString(c.comment)}, false, ${sqlJson(meta)})`,
      );
      totalCols++;
    }
    lines.push(colRows.join(',\n'));
    lines.push(') AS v(name, dt, nl, cm, pii, meta)');
    lines.push('ON CONFLICT (source_column_table_id, source_column_name) DO NOTHING;');
    lines.push('');
  }

  console.log(`Total columns to insert: ${totalCols}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File 03 — table_mappings
// ---------------------------------------------------------------------------
function buildFile03() {
  const lines = [];
  lines.push('-- db/seeds/brownfield/wave1/03_table_mappings.sql');
  lines.push('-- Wave 1 (source_table, canonical_target) mapping rows (idempotent).');
  lines.push('-- Generated by scripts/generate_wave1_seeds.mjs');
  lines.push('-- All rows: classification=IMPORT, approval_status=APPROVED, target_schema=sys, wave=1.');
  lines.push('');

  let totalMappings = 0;

  for (const r of wave1) {
    const targets = assignTarget(r.table_name, r.primary_domain);
    for (const tgt of targets) {
      const meta = {
        natural_key_pattern: tgt.k,
        auto_approver_rule: 'WAVE_1_AUTO_APPROVE',
        transform_hint: tgt.h || null,
        primary_domain: r.primary_domain,
        all_domains: r.domains.split('|'),
      };
      Object.keys(meta).forEach(k => { if (meta[k] === null) delete meta[k]; });

      lines.push('WITH src AS (');
      lines.push('  SELECT source_table_id FROM brownfield.source_tables');
      lines.push(`  WHERE source_table_name = ${sqlString(r.table_name)} AND source_table_schema = 'public'`);
      lines.push('    AND source_table_export_id = (SELECT source_export_id FROM brownfield.source_exports');
      lines.push(`        WHERE source_export_name = ${sqlString(EXPORT_NAME)})`);
      lines.push(')');
      lines.push('INSERT INTO brownfield.table_mappings (');
      lines.push('  table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table,');
      lines.push('  table_mapping_classification, table_mapping_approval_status,');
      lines.push('  table_mapping_approved_at, table_mapping_rationale, table_mapping_metadata,');
      lines.push('  table_mapping_wave');
      lines.push(')');
      lines.push(`SELECT src.source_table_id, 'sys', ${sqlString(tgt.t)}, 'IMPORT', 'APPROVED',`);
      lines.push(`  now(), 'Wave 1 auto-approval per BROWNFIELD_IMPORT_PLAN.md §3.', ${sqlJson(meta)}, 1`);
      lines.push('FROM src');
      lines.push('ON CONFLICT (table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table) DO NOTHING;');
      lines.push('');
      totalMappings++;
    }
  }

  console.log(`Total table_mappings: ${totalMappings}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });

const f0 = path.join(OUT_DIR, '00_source_export.sql');
const f1 = path.join(OUT_DIR, '01_source_tables.sql');
const f2 = path.join(OUT_DIR, '02_source_columns.sql');
const f3 = path.join(OUT_DIR, '03_table_mappings.sql');

fs.writeFileSync(f0, buildFile00());
fs.writeFileSync(f1, buildFile01());
fs.writeFileSync(f2, buildFile02());
fs.writeFileSync(f3, buildFile03());

console.log('');
console.log('Files written:');
for (const f of [f0, f1, f2, f3]) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').length;
  console.log(`  ${path.relative(ROOT, f)}: ${lines} lines`);
}
