# Seed Completeness Backlog

## Purpose

The seed completeness backlog tracks missing, partial or candidate seed domains.

## Logical Fields

```text
backlog_id
tenant_id
blueprint_family
seed_domain
seed_object_type
missing_item_description
priority
source_strategy
research_prompt_template
expected_output_schema
completion_status
confidence_score
validated_by
validated_at
```

## Completion Statuses

```yaml
completion_status:
  - MISSING
  - PARTIAL
  - CANDIDATE_GENERATED
  - SOURCE_VALIDATED
  - DOMAIN_VALIDATED
  - APPROVED_FOR_SEEDING
  - SEEDED
  - SUPERSEDED
  - REJECTED
```

## Rule

Incomplete seeding must be visible. Do not silently leave catalogues incomplete.
