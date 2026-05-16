# Seed Staging and Approval Model

## Principle

Candidate seed records must never be written directly into canonical tables.

## Required Flow

```text
AI/web acquisition
  ↓
candidate staging
  ↓
source evidence
  ↓
validation
  ↓
human approval
  ↓
canonical sys.sys_* tables
```

## Staging Tables

```text
sys.sys_seed_acquisition_runs
sys.sys_seed_candidate_records
sys.sys_seed_source_evidence
sys.sys_seed_validation_results
sys.sys_seed_approval_decisions
```

## Seed Layers

```text
candidate_seed
validated_seed
approved_seed
canonical_seed
```

Only `approved_seed` may be applied to canonical tables.
