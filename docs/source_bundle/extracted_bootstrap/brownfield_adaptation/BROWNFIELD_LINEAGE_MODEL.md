# Brownfield Lineage Model

## Purpose

Every imported or adapted record must preserve traceability to the old DBMS source.

## Canonical Table

```text
sys.sys_source_lineage_records
```

## Recommended Fields

```text
lineage_id
tenant_id
target_table_name
target_record_id
source_system
source_table_name
source_record_id
source_natural_key
source_content_hash
import_run_id
mapping_confidence
validation_status
created_at
```

## Natural Key Examples

```text
OLDDB::tenants::{old_id}
OLDDB::job_templates::{old_id}
OLDDB::esco_skills::{esco_uri}
OLDDB::courses::{old_course_id}
OLDDB::learning_paths::{old_learning_path_id}
OLDDB::process_kpis::{old_process_kpi_id}
```

## Rule

Lineage is mandatory for every brownfield-derived canonical record.
