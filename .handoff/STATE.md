# heuresys-advanced — STATE

**Updated**: 2026-06-01 (S954). **Branch**: `main` HEAD `90a2b4d` (+ questo handoff) = synced con origin. Working tree pulito. **db:migrate ×2 verde** (46 migration), **API 359/0**.

## Last session brief

- **🟢 ADR-0024 employee-centric ingestion (3 fasi shipped).** Il legacy Docker è EMPLOYEE-centric (207 FK→`employees` vs 45→`users`); `sys_user*` ⟸ legacy `employee*`, `users`→solo `sys_auth_*`. Fase 1 doc (ADR-0024 + `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` + invariante **I14**), Fase 2 re-key 5 seed `rtl-rebuild` via email-join, Fase 3 migration `000046` (160 `LEGACY:`→`LEGACY_EMP::`, relabel puro 0-FK).
- **🧹 Case-study scope enforced.** DB ridotto a **2 tenant ACTIVE** (RTL_BANK 158 + HEURESYS 3). Migration `000047`: DELETE `RTL_BANK_REFERENCE` (scaffold) + DROP `legacy_mirror` (586MB cache, conteneva SmartFood/EcoNova estranei) + purge mapping out-of-scope; `000021` §7 rimosso, `000033` re-scoped. **DB 1304→719 MB**. Blueprint FIN_BANKING (globale) preservato.
- **❌ P2 RTL title proposal INVALIDATA+eliminata** (girava su `user_external_code` pre-re-key) → riaperta pulita come **B-51**.

## Top priorities (next session)

1. **B-51 — re-derive 162 `position_title` + `position_job_role_id`** (employee-centric, design da zero sul DB post-S954). Blocca R2. Vedi `SOT_BACKLOG.md` B-51 + `RTL_STABILIZATION_PLAN.md §P2` (invalidata).
2. **Brand-fidelity F5 ESS / F6 admin / F7 showcase** (~6-8h). Vedi `memory/project_brand_fidelity_migration.md`.
3. **B-50 full reconciliation legacy→advanced** (~65/134 sys.* popolate), esecuzione gated, lega B-10 SDBI Phase 2.

## Open questions

- **SuccessFactors connector**: design committato, flag PII risolto (ADR-0023); resta decidere adozione come item MVP-4 + naming `staging.sf_*` (I3/I4).
- **CI non verificata** questa sessione (i commit toccano DB/migration → potrebbero re-triggerare workflow); controllare `gh run list` a inizio prossima.

## Stack snapshot

- DB: 161 utenti / **2 tenant ACTIVE** (RTL_BANK + HEURESYS); legacy_mirror+RTL_BANK_REFERENCE rimossi; **719 MB**; **46 migration** `000001..000047`. ANALYZE full-DB fatto (stime planner accurate).
- ADR su disco: …0023, **0024** (employee-centric ingestion). Invarianti: +**I14**. Backup S954: `pg_dump_snapshots/pre-{rekey,cleanup,tenant-cleanup}-s954_*`.

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_tenancies where tenant_status='ACTIVE'"  # 2
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # CI
```
