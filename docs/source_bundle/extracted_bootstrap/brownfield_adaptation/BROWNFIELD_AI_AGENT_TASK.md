# Brownfield Adaptation Task for the AI Coding Agent

## Task

You must treat `db-export.zip` as a brownfield source of reusable structures and data.

You must not use it as the target schema.

## Required Deliverables

Before implementing import scripts, produce:

```text
docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md
docs/brownfield/BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md
docs/brownfield/BROWNFIELD_IMPORT_PLAN.md
docs/brownfield/BROWNFIELD_EXCLUSION_REPORT.md
```

## Required Procedure

1. Build the clean target architecture first.
2. Inspect `db-export.zip`.
3. Generate source table inventory.
4. Classify every old table.
5. Map useful old tables to target `sys.sys_*` tables.
6. Stage candidate records.
7. Validate candidates.
8. Apply only approved records.
9. Write lineage records.
10. Generate final import report.

## Non-Negotiable Constraints

- Do not import old RLS policies.
- Do not import payroll, benefits, medical/anamnestic, attendance, bank details or raw SAP HR tables.
- Do not make old public schema canonical.
- Do not use old column names as target names unless explicitly mapped.
- Do not collapse job role, position and user assignment into one table.
- Preserve the new position-centric architecture.
