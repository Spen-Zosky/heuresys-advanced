#!/usr/bin/env bash
# db/scripts/extract-wave1-legacy.sh
#
# Regenerates db/seeds/brownfield/wave1/legacy_data/wave1_<domain>.sql by
# running `pg_dump --data-only` against the legacy `heuresys_platform` on
# `oracle-vm-default`. The output files are gitignored (~356 MB total) but
# this script makes them reproducible from any developer machine with
# SSH access to the OCI VM.
#
# Wave 1 source domains (88 tables — per docs/brownfield/_inspection_artifacts/
# tables_with_domains.csv filtered to classification=IMPORT and the 7 Wave 1
# lexicon domains):
#   - ESKAP (29 tables, ~140k rows; 4 split files for >100MB pgvector tables)
#   - SKILGRO (37 tables, ~19k rows)
#   - INDOOR (9 tables incl. industry_classifications split for embeddings)
#   - ITLAB (7 tables, ~310 rows)
#   - PROGOV (2 tables, ~144 rows)
#   - OPOURSKA (2 tables, ~29k rows)
#   - H2R (2 tables, ~207 rows)
#
# Usage:
#   bash db/scripts/extract-wave1-legacy.sh
#
# Prerequisites:
#   - SSH alias `oracle-vm-default` configured in ~/.ssh/config
#   - VM-side peer auth for the postgres user on heuresys_platform
#   - Local `scp` available
#
# The script is idempotent (overwrites existing files) and safe to re-run.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$REPO_ROOT/db/seeds/brownfield/wave1/legacy_data"
mkdir -p "$OUT_DIR"

PG_DUMP_FLAGS=(
  --data-only --no-owner --no-privileges --no-tablespaces --no-comments
  --format=plain --column-inserts --rows-per-insert=1000
)

dump_remote() {
  local domain="$1"
  shift
  local out="$1"
  shift
  local tables=("$@")
  local table_args=()
  for t in "${tables[@]}"; do
    table_args+=("-t" "public.$t")
  done
  echo "  → ${domain} (${#tables[@]} tables) → ${out}"
  ssh oracle-vm-default \
    "sudo -u postgres pg_dump ${PG_DUMP_FLAGS[*]} ${table_args[*]} -d heuresys_platform" \
    > "$out"
}

echo "[1/7] ESKAP"
ESKAP_MAIN=(
  cross_entity_relations cross_entity_searches esco_isco_groups
  esco_skill_groups esco_skill_relations onet_abilities onet_esco_mappings
  onet_import_jobs onet_knowledge onet_occupation_abilities
  onet_occupation_knowledge onet_occupation_skills onet_occupation_work_activities
  onet_occupations onet_skills onet_work_activities ontology_categories
  ontology_embedding_jobs ontology_feedback ontology_inference_jobs
  ontology_quality_metrics ontology_skill_dimensions ontology_skill_relations
  ontology_source_mappings semantic_entity_relations semantic_search_log
)
dump_remote ESKAP "$OUT_DIR/wave1_eskap.sql" "${ESKAP_MAIN[@]}"
dump_remote ESKAP-esco-occupations    "$OUT_DIR/wave1_eskap_esco_occupations.sql"    esco_occupations
dump_remote ESKAP-occupation-skills   "$OUT_DIR/wave1_eskap_esco_occupation_skills.sql" esco_occupation_skills
dump_remote ESKAP-semantic-entity-idx "$OUT_DIR/wave1_eskap_semantic_entity_index.sql"  semantic_entity_index

echo "[2/7] SKILGRO"
SKILGRO=(
  certification_esco_skills certifications competencies competency_frameworks
  competency_review_ratings course_enrollments course_enrollments_semantic
  course_esco_skills course_modules courses extracted_skills learning_bookmarks
  learning_content_providers learning_path_courses learning_path_enrollments
  learning_paths learning_ratings learning_recommendations module_completions
  rating_scales skill_aliases skill_classifications skill_clusters
  skill_demand_metrics skill_development_paths skill_extraction_jobs
  skill_gap_analyses skill_gap_snapshots skill_matrices skill_migration_jobs
  skill_pair_usage skill_relationships skill_requirements_templates
  skill_supply_metrics skill_synonyms skill_taxonomy_extensions unknown_skills
)
dump_remote SKILGRO "$OUT_DIR/wave1_skilgro.sql" "${SKILGRO[@]}"

echo "[3/7] INDOOR"
INDOOR_MAIN=(
  benchmark_configs benchmark_reports industry_occupation_mapping
  industry_profiles market_benchmarks market_salary_data
  occupation_industry_classifications tenant_industry_classifications
)
dump_remote INDOOR "$OUT_DIR/wave1_indoor.sql" "${INDOOR_MAIN[@]}"
dump_remote INDOOR-industry-classifications "$OUT_DIR/wave1_indoor_industry_classifications.sql" industry_classifications

echo "[4/7] ITLAB"
ITLAB=(ccnl_contracts ccnl_executive_bands ccnl_job_title_mapping ccnl_levels ccnl_seniority_rules holidays sindacati)
dump_remote ITLAB "$OUT_DIR/wave1_itlab.sql" "${ITLAB[@]}"

echo "[5/7] PROGOV"
PROGOV=(process_kpis process_phases)
dump_remote PROGOV "$OUT_DIR/wave1_progov.sql" "${PROGOV[@]}"

echo "[6/7] OPOURSKA"
OPOURSKA=(job_template_skills job_templates)
dump_remote OPOURSKA "$OUT_DIR/wave1_opourska.sql" "${OPOURSKA[@]}"

echo "[7/7] H2R"
H2R=(job_title_courses job_title_learning_paths)
dump_remote H2R "$OUT_DIR/wave1_h2r.sql" "${H2R[@]}"

echo "Done. ${OUT_DIR} populated. Total size:"
du -sh "$OUT_DIR"
