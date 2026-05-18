# Wave 1 — Column Mapping Seed Report

Generated: 2026-05-18T01:51:58.032Z
Source: `scripts/generate_wave1_column_mappings.mjs`
Output SQL: `db/seeds/brownfield/wave1/04_column_mappings.sql`

## Summary

- Total INSERT rows emitted: **1177**
- Source tables in catalog: **93/93**
- Distinct target tables covered: **20**

## Transform breakdown

| Transform | Count |
|---|---:|
| `JSON_EXTRACT` | 759 |
| `CAST_TIMESTAMPTZ` | 130 |
| `LINEAGE_SOURCE_NK` | 93 |
| `TRIM` | 86 |
| `LOOKUP_FK` | 49 |
| `SKIP` | 39 |
| `DIRECT_COPY` | 11 |
| `UPPERCASE` | 3 |
| `CAST_INT` | 2 |
| `CAST_NUMERIC` | 1 |
| `CONSTANT` | 1 |
| `CAST_VARCHAR` | 1 |
| `CAST_BOOLEAN` | 1 |
| `LOWERCASE` | 1 |

## Per-domain coverage

| Domain | Total mappings | Real mappings | Skipped |
|---|---:|---:|---:|
| SKILGRO | 539 | 524 | 15 |
| ESKAP | 302 | 290 | 12 |
| INDOOR | 124 | 120 | 4 |
| ITLAB | 89 | 89 | 0 |
| OPOURSKA | 84 | 76 | 8 |
| PROGOV | 23 | 23 | 0 |
| H2R | 16 | 16 | 0 |

## Skipped source columns

Total SKIPs: **39**

### AI embedding (pgvector USER-DEFINED) — recomputable, not imported

Count: 39

```
course_enrollments_semantic.context_embedding
course_enrollments_semantic.embedding_model
course_enrollments_semantic.embedding_generated_at
courses.embedding_en
courses.embedding_it
courses.embedding_model
courses.embedding_generated_at
cross_entity_searches.query_embedding
esco_occupations.embedding_en
esco_occupations.embedding_it
esco_occupations.embedding_model
esco_occupations.embedding_generated_at
esco_skills.embedding_en
esco_skills.embedding_it
esco_skills.embedding_model
esco_skills.embedding_generated_at
industry_classifications.embedding_it
industry_classifications.embedding_en
industry_classifications.embedding_model
industry_classifications.embedding_generated_at
job_templates.embedding_en
job_templates.embedding_it
job_templates.embedding_model
job_templates.embedding_generated_at
learning_paths.embedding
learning_paths.embedding_text_hash
learning_paths.embedding_model
learning_paths.embedding_generated_at
onet_occupations.embedding_en
ontology_skill_dimensions.embedding
ontology_skill_dimensions.embedding_model
semantic_entity_index.embedding
semantic_entity_index.embedding_model
semantic_entity_index.embedding_generated_at
semantic_search_log.query_embedding
skill_gap_analyses.analysis_embedding
skill_gap_analyses.embedding_text_hash
skill_gap_analyses.embedding_model
skill_gap_analyses.embedding_generated_at
```

## Notes

- All `column_mapping_pii_disposition` = `NONE` (data is project case-study per `feedback_data_treatment_no_privacy_concerns.md`).
- Legacy primary key `id` columns map with `LINEAGE_SOURCE_NK` — the legacy PK is stored on the lineage row (`sys.sys_source_lineage_records.source_pk_value`), not on the canonical row.
- pgvector embedding columns (`embedding_*`, USER-DEFINED dtype) are SKIPPED — they are recomputable downstream by the AI pipeline.
- Bilingual fields (`name_it` / `name_en`, `description_it` / `description_en`, `title_it` / `title_en`) all map to the single target column with IT preferred and EN as fallback. The runtime transform layer will COALESCE(name_it, name_en, preferred_label).
- Source columns with no direct counterpart fall into the target table's `*_metadata` jsonb via `JSON_EXTRACT` transform, payload path `$.legacy.<column_name>`.
