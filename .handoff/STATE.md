# heuresys-advanced — STATE

**Updated**: 2026-05-20 02:30 GMT+2
**Branch**: `main` — 8 commit ahead of `origin/main` (push parte di questa handoff)
**Last commit**: `127e1a7` feat(api): MVP-3 Tappa D — LOOKUP_FK form (b) lineage-records JOIN (Goal 003 Item F P1)

## Last session brief

Goal 003 v3 EXEC partial: Items K/C/D+M/A/B/F-P1 SHIPPED (7 commit). Item F 1st Wave 1 retry COMPLETED ma C4/C5 FAIL (9/15 silent skip). 5 diagnostic sub-investigations hanno surfaced 5 INFEASIBLE targets per Goal 004 (CW-B18/19/20 systemic constraints registry design). HALT awaiting Cowork Z-decision (Z1 raccomandato).

## Top priorities (next session)

1. **Goal 003 closure HALT_STATE** — leggere ultima notification `cli/pending/*` per Cowork Z-decision (Z1/Z2/Z3/Z4 su 5 INFEASIBLE targets). Se Z1: lancia Wave 1 retry P1-only (~30min wall-clock) + verify C4/C5 narrowed (≥10/15) + Item L REPORT 003 + STATE finalize atomic commit. **Effort: ~4-5 turn**. Vedi `cowork_code_exchange/_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md` per opzioni complete.
2. **Cowork inbox CLI pending**: 1 message non letta (PROMPT amended v3) + ack pending. Mark read prima di EXEC. ~0.5 turn.
3. **Push commits** se non già fatto in handoff. 8 commit Goal 003 ahead di origin/main.

## Open questions (next session)

- **Z-decision**: Z1 (P1-only retry, 5 INFEASIBLE accept) vs Z2 (UQ-relax migration, scope expand) vs Z3 (synthetic source_columns aliases). Cowork deve scegliere.
- **C5 final bar**: era ≥12/15 in v3, narrowed a ≥11 in E1, ora proposta ≥10/15 (Z1). Cowork verbal lock vs PROMPT v3.1?
- **Untracked Cowork artefacts** in `cowork_code_exchange/` (DISCOVERY/PROMPT/PLAN/APPROVAL/EXEC files Goal 001+002+003) — committarli ora con handoff o lasciare untracked?

## Stack snapshot (deltas vs S922)

- API: 11/22 modules + brownfield-wave-executor con Goal 003 fixes shipped (Item A LOOKUP_FK fallback-only sys_tenancies/sys_users + Item B CAST_* compat-target + Item K TYPE_CAST_MAP+orphan-audit + Item F P1 form (b) → lineage JOIN).
- Tests: **318 passed | 5 skipped | 0 failed** (+29 vs 289 baseline: +13 Item K + +6 Item A + +10 Item B). 72/72 transform-compiler + 23/23 upsert-sql-type-coerce.
- DB migrations applied: **000032** (mig 385, CHECK relax) + **000033** (mig 386, tenant_id_mappings + validate_lookup_fk_payload trigger). 5 INFEASIBLE targets documented Goal 004 prerequisite-dependent.
- Wave 1 retry runId `08d3bc9f-...` COMPLETED 48min: 6 baseline + sys_activity_classifications 3276 + sys_skills 5753 upserted (160 lineage gap) + sys_learning_modules 4395 upsert/0 lineage + sys_learning_paths 3157 upsert/65 lineage. 9 silent-skip targets need P1 retry or registry redesign.

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
cd D:/heuresys-advanced && pnpm --filter @heuresys/api test    # expected 318 passed | 5 skipped | 0 failed
cd D:/heuresys-advanced/apps/api && pnpm typecheck && pnpm lint
git log --oneline -10                                          # expect 8 Goal 003 commits including 127e1a7
ls cowork_code_exchange/.inbox/cli/pending/                    # expect Z-directive when arrives
```

## Resume protocol

1. Read `cowork_code_exchange/_00_STATE_003.md` (HALT context + 5 INFEASIBLE + Z-options + commits + bias catalog candidates)
2. Read `cowork_code_exchange/_03_EXEC_003_brownfield-seeding-complete.md` §F (Wave 1 retry journey 22 turn consumed, budget 18 residui)
3. Check `cowork_code_exchange/.inbox/cli/pending/` for Cowork Z-decision message
4. Proceed per Z-directive: ship retry (Z1) or migration (Z2) or aliases (Z3); poi Item L REPORT 003 + STATE finalize per CP7 atomic commit
