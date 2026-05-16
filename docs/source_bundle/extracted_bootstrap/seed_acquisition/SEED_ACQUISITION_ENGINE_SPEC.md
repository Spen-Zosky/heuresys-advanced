# Seed Acquisition and Validation Engine Specification

## Purpose

The Seed Acquisition and Validation Engine allows the AI coding agent to generate candidate seed data from approved sources rather than relying only on static preseed files.

## Pipeline

```text
Seed objective
  → Source of Truth registry
  → Research prompt template
  → Source acquisition
  → Structured extraction
  → Evidence capture
  → Confidence scoring
  → Candidate seed staging
  → Validation
  → Human approval
  → Idempotent canonical seed
```

## Domains Supported

```text
enterprise_classification
bpm_processes
organization_units
positions
job_roles
esco_occupations
skills
position_skill_requirements
kpis
learning_modules
training_initiatives
learning_paths
assessment_methods
career_paths
succession_rules
compensation_rules
visualization_graphs
```

## Required Staging Tables

```text
sys.sys_seed_acquisition_runs
sys.sys_seed_research_prompts
sys.sys_seed_candidate_records
sys.sys_seed_source_evidence
sys.sys_seed_validation_results
sys.sys_seed_approval_decisions
```

## Status Flow

```yaml
seed_status:
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

## CLI Command Targets

The Development Team should scaffold commands such as:

```bash
npm run seed:discover -- --domain esco --input positions.csv
npm run seed:discover -- --domain kpi --industry FIN_BANKING
npm run seed:discover -- --domain learning --position Branch_Manager
npm run seed:validate -- --run-id <id>
npm run seed:approve -- --run-id <id>
npm run seed:apply -- --run-id <id>
```
