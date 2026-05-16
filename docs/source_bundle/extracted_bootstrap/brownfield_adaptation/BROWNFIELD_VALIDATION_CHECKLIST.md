# Brownfield Validation Checklist

Before applying any brownfield-derived record to canonical `sys.sys_*` tables, verify:

## Source

- [ ] Source table is classified.
- [ ] Source table is not excluded.
- [ ] Source record has deterministic natural key.
- [ ] Source record has content hash.
- [ ] Source mapping has confidence score.

## Target

- [ ] Target table exists in `sys` schema.
- [ ] Target table is part of approved architecture.
- [ ] Target record does not violate tenant boundary.
- [ ] Target record does not violate FK constraints.
- [ ] Target record has validation status.
- [ ] Target record has lineage.

## Scope

- [ ] Record is not payroll execution.
- [ ] Record is not benefits administration.
- [ ] Record is not medical/anamnestic.
- [ ] Record is not raw PII.
- [ ] Record is not RLS/runtime security artifact.
- [ ] Record does not reintroduce old architecture as canonical.

## Approval

- [ ] Candidate has been validated.
- [ ] Candidate has been approved.
- [ ] Import decision is recorded.
- [ ] Idempotent upsert has been tested.
