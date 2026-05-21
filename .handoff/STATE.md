# heuresys-advanced — STATE

**Updated**: 2026-05-22 GMT+2
**Branch**: `main` — synced with origin (`444205c` X8 pushed)
**Last tag**: `v0.4.0-brand-v1`

## Last session brief

Cowork↔CLI batches X6.A → X8 shipped: 4 commits (eb48998 X6.A CW-B34 engine patch + ADR-0016 ACCEPTED; 5735556 X5.B Block C Time/Leave SDBI 6220 rows + Block D sys_users HYBRID 270 merged R-A2 PASS; bfd8982 X7 hardening CW-B35/36/37 + CW-B38 inline mig 000042; 444205c X8 audit clean CW-B38 + cleanup CW-B39). sys_skill_taxonomy_edges 0→11965, sys_users 163→433, sys_esco_occupation_mappings 0→7645 (stable across 2x Wave1 retries post-mig-000042 NULLS NOT DISTINCT). Engine + registry hardened.

## Top priorities (next session)

1. **X9 SKILGRO macro-area** (~6-10h CLI + 3-4h Cowork C9 authoring) — deferred CW-B37 deep fix (2-hop LOOKUP_FK transform, ADR-NNNN, 1381 sys_skill_learning_mappings rows) + CW-B35 Phase B/C (331+100+231 rows skill_taxonomy_edges heterogeneous/filter/defer) + CW-B39 learning domain re-architecture (canonical source for sys_learning_modules dal legacy `courses`). ROI ~5000-10000 row unlock. Spec authoring pending Cowork C9.
2. **Cowork tooling improvements** (per REPORT 012 §5, ~2-3h) — (a) `pnpm db:migrate:registered` variant che skip WHERE NOT EXISTS in `sys.sys_schema_migrations`; (b) `scripts/run-wave1-fullscale.mjs` HARD_TIMEOUT_MS default bump 11min→75min OR async+poll; (c) `brownfield.reclassify_table_mapping_reference_only()` SQL helper (pattern usato 3 batches: X7 CW-B36/37 + X8 CW-B39).
3. **Brand v1.1 deferred refinements** — 22 items in `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` (~6h batched). A11Y-1+2 first (~20min). Indipendente da Cowork↔CLI.

## Open questions

- X9 SKILGRO 2-hop LOOKUP_FK design: engine extension `LOOKUP_FK_2HOP` (transform-compiler.ts case branch + payload `{intermediate_table, intermediate_join_col, final_match_col}`) vs pre-staging materialized view? Decisione Cowork C9.1 pending.
- Canonical source per sys_learning_modules: confermare `courses` legacy o synthesis multi-source? Cowork C9.2 forensic needed.

## Stack snapshot (deltas vs S926)

- **sys.* populated**: ~60/128 (+9 vs S926 — sys_skill_taxonomy_edges 11965, sys_attendance 5199, sys_overtime 380, sys_time_off_balances 498, sys_time_off_requests 99, sys_leave_balance_transactions 24, sys_leave_accrual_rules 20, sys_users 433 (+270 LEGACY), sys_esco_occupation_mappings 7645)
- **Migrations**: +000040 sys time/leave scaffold (6 tables) + 000042 sys_esco UQ NULLS NOT DISTINCT (CW-B38)
- **Engine patches**: CW-B34 (TargetMeta.columnNullable + WHERE skip nullable-aware + buildNkJoinPredicate COALESCE per nullable UUID NK)
- **Registry hygiene**: 10 column_mappings normalized (CW-B35 LOOKUP_FK skill_taxonomy_edges) + 4 CAST_ENUM kind supplements + 5 table_mappings → REFERENCE_ONLY (CW-B36 + CW-B37 + CW-B39)
- **ADRs**: ADR-0016 ACCEPTED (full, post X6.A engine patch)
- **Test suite**: 327/333 pass (+1 vs X6.A da trivial transform-compiler.test.ts fix; 1 pre-existing skills tenant-scope fail unrelated)
- **Bias catalog**: 45 documented (CW-B17→CW-B40) — registry SoT in `cowork_reserved/bias_registry.md`

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
cd D:/heuresys-advanced && git log --oneline -3                          # 444205c X8
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_esco_occupation_mappings' AS k, COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
ORDER BY 1;"   # 7645, 11965, 433
ls cowork_code_exchange/.inbox/cli/pending/ | tail -3                    # check new PROMPT 013
```

## Resume protocol

1. Read STATE + check `cowork_code_exchange/.inbox/cli/pending/` for new PROMPT 013 (likely Cowork C9 X9 SKILGRO directive).
2. Per priorità #1 (X9 SKILGRO): read Cowork C9 spec dirs once available (`cowork_reserved/batch_c9/`), expect engine extension ADR + canonical source decision for sys_learning_modules. Multi-block execution likely (split A/B/C/D).
3. Per priorità #2 (tooling): può procedere independent from X9, lightweight infrastructure improvements.
4. Per priorità #3: indipendente Cowork↔CLI, vedi `docs/BRAND_V1_DEFERRED_REFINEMENTS.md`.
