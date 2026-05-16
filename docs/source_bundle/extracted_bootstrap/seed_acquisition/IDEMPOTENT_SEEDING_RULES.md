# Idempotent Seeding Rules

## Required Natural Keys

Every seed record must include a deterministic natural key.

Examples:

```text
ESCO_SKILL::{esco_skill_uri}
ESCO_OCCUPATION::{esco_occupation_uri}
ATECO_2025::{ateco_code}
NACE_REV_2_1::{nace_code}
FIN_BANKING_KPI::{process_code}::{kpi_code}
LEARNING_MODULE::{scope}::{normalized_title_hash}
```

## Required Fields

```text
seed_natural_key
source_system
source_uri
source_version
content_hash
mapping_confidence
validation_status
retrieved_at
approved_by
approved_at
```

## Import Rule

Use safe upserts:

```sql
ON CONFLICT (seed_natural_key)
DO UPDATE
```

but never overwrite human-approved data with lower-confidence candidate data.
