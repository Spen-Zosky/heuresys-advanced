# heuresys-advanced — STATE

**Updated**: 2026-05-23 GMT+2
**Branch**: `main` — synced with origin (`7ea09f0` X10 pushed)
**Last tag**: `v0.4.0-brand-v1`

## Last session brief

Cowork↔CLI batches X9 SKILGRO mega + X10 CW-B49 fix shipped: 2 commits (3a1fa8d X9 ADR-0017 LOOKUP_FK_2HOP engine + canonical re-mapping registry + CW-B37 deep fix + CW-B35 Phase C cleanup, HALT P0 CW-B49 raised on 0-upsert; 7ea09f0 X10 CW-B49 patch `replaceTargetColsInConflictInference` + 4 unit test, Wave 1 retry verify → +127 sys_learning_paths, +564 sys_learning_modules, engine throughput +13851 rows vs X9). 4 bias documented (CW-B46/B47/B48/B49). ADR-0017 ACCEPTED. Engine stabilizing.

## Top priorities (next session)

1. **X11.B Performance Reviews / GOKMER macro-area** (~3-5h CLI + 2h Cowork C11 authoring) — sys_users (433) + sys_goals + sys_job_roles (202) canonical ready. Low complexity post-engine maturity. Recommended first by REPORT 014 §6.
2. **X11.A CW-B47 resolution** (~1-2h) — sys_skill_learning_mappings stays 0 (1381 staged) per `skill_learning_mapping_module_id` NOT NULL semantic gap (course_id is path-level FK in source). Either 3-hop synthesizer (course→sys_learning_paths→course_modules) or REFERENCE_ONLY reclassify pending semantic ADR.
3. **Cowork tooling carry-over from S927** (~2-3h) — (a) `pnpm db:migrate:registered` variant skip `sys_schema_migrations` WHERE NOT EXISTS; (b) `HARD_TIMEOUT_MS` default bump 11min→75min in `scripts/run-wave1-fullscale.mjs`; (c) `brownfield.reclassify_table_mapping_reference_only()` SQL helper.

## Open questions

- X11.B vs X11.A priority: REPORT 014 §6 raccomanda B prima (clean macro-area) + A dopo, ma Cowork C11 può decidere altrimenti.
- CW-B47 fix path: 3-hop FK synthesizer engine extension (più ambizioso, riusabile) vs REFERENCE_ONLY (basso costo, scope-limited)? Spec authoring pending Cowork C11.

## Stack snapshot (deltas vs S927)

- **sys.* populated**: 61/128 (+1 vs S927 — sys_learning_paths 3354 +127, sys_learning_modules 5052 +564, others stable)
- **Migrations**: +000043 LOOKUP_FK_2HOP validator + dispatch (idempotent re-apply verified)
- **Engine patches**: +case `LOOKUP_FK_2HOP` (SUPPORTED_TRANSFORMS 16→17) + helper `replaceTargetColsInConflictInference` (CW-B49 split-on-COALESCE fix) + dispatch `validate_lookup_fk_dispatch` (CW-B46 signature recovery)
- **Registry hygiene**: +2 NEW IMPORT mappings (courses→sys_learning_paths, course_modules→sys_learning_modules) + 4 REFERENCE_ONLY reclassify (CW-B35 Phase C heterogeneous) + 3 UPDATE LOOKUP_FK_2HOP (CW-B37) + 1 REFERENCE_ONLY (courses→sys_learning_modules legacy Option-A)
- **ADRs**: ADR-0017 ACCEPTED (LOOKUP_FK_2HOP engine extension)
- **Test suite**: 336/342 PASS (+9 new: 5 LOOKUP_FK_2HOP + 4 CW-B49 COALESCE; 1 pre-existing skills.integration flaky preserved)
- **Bias catalog**: 49 documented (CW-B17→CW-B49) — `cowork_reserved/bias_registry.md` SoT

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
cd D:/heuresys-advanced && git log --oneline -3                          # 7ea09f0 X10
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_learning_paths' k, COUNT(*) FROM sys.sys_learning_paths
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
ORDER BY 1;"   # 3354, 5052, 433
ls cowork_code_exchange/.inbox/cli/pending/ | tail -3                    # check new PROMPT 015 (X11)
```

## Resume protocol

1. Read STATE + check `cowork_code_exchange/.inbox/cli/pending/` for new PROMPT 015 (likely Cowork C11 X11.B Performance Reviews / GOKMER).
2. Per priorità #1 (X11.B): expect single-block low-complexity macro-area leveraging mature engine post-CW-B49.
3. Per priorità #2 (X11.A CW-B47): pending Cowork ADR decision (3-hop vs REFERENCE_ONLY).
4. Per priorità #3 (tooling): can proceed independent if no PROMPT 015 yet.
