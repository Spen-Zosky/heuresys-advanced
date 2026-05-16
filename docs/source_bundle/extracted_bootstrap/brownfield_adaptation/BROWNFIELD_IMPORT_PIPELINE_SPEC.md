# Brownfield Import Pipeline Specification

## Pipeline

```text
db-export.zip
  ↓
extract metadata and available rows/files
  ↓
create brownfield source registry
  ↓
load source table metadata
  ↓
generate adaptation map
  ↓
classify tables
  ↓
create transformation rules
  ↓
stage candidate records
  ↓
validate candidate records
  ↓
approve import decisions
  ↓
apply idempotent canonical upserts
  ↓
write lineage records
```

## Required Brownfield Tables

```text
brownfield.brownfield_source_exports
brownfield.brownfield_source_tables
brownfield.brownfield_source_columns
brownfield.brownfield_table_mappings
brownfield.brownfield_column_mappings
brownfield.brownfield_import_runs
brownfield.brownfield_candidate_records
brownfield.brownfield_validation_results
brownfield.brownfield_import_decisions
```

## Canonical Lineage Table

```text
sys.sys_source_lineage_records
```

## Required Import Statuses

```yaml
import_status:
  - DISCOVERED
  - CLASSIFIED
  - MAPPED
  - STAGED
  - VALIDATED
  - APPROVED
  - APPLIED
  - REJECTED
  - SUPERSEDED
```

## Development Team Sequence

1. Inspect the old export.
2. Generate `BROWNFIELD_ADAPTATION_MAP.md`.
3. Classify every table.
4. Produce transformation plan.
5. Stage candidates only.
6. Validate candidates.
7. Apply approved candidates only.
8. Generate lineage report.
