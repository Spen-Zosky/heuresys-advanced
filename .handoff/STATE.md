# heuresys-advanced — STATE

**Updated**: 2026-05-21 14:25 GMT+2
**Branch**: `main` — synced with origin (`ea4ebe6` X5.A pushed)
**Last tag**: `v0.4.0-brand-v1`

## Last session brief

Cowork↔CLI batches X1→X5.A shipped: 7 commits cumulativi (CW-B17/B22/B23/B24/B31 engine fixes + ADR-0014/0015/0016 + SDBI Goals/OKRs pilot 5939 rows + R-01/CW-B27/B32 mitigations + xos_lib cross-OS pipeline). Wave 1 baseline 55min→3min (18× speedup). sys_job_roles 0→202. Block B X5.A HALTED su CW-B34 (engine NK filter ignora DB nullable FK) — halt notice + 3 opzioni pending Cowork C6 review.

## Top priorities (next session)

1. **X5.A Block B halt resolution** — Cowork batch C6 review `cowork_code_exchange/.inbox/cowork/pending/2026-05-21T12-19-00Z__008_halt_adr_0016_unexpected_fail.md`. 3 opzioni: A engine COALESCE-aware skip filter (raccomandata, ~2-3h, mirror CW-B22), B synthetic LOOKUP_FK→NULL (hacky), C UQ redesign drop job_role_id. Sblocca sys_esco_occupation_mappings 0→≥3000.
2. **X5.B fresh session** — Block C Time/Leave SDBI pilot (~6267 rows, 3-6 sys.* tables, ~3-5h) + Block D sys_users HYBRID merge (163→~437, R-A2 admin preservation critical, ~2-3h). Indipendenti da halt #1. Spec in `cowork_reserved/batch_c4/{time_leave_pilot,sys_users_sdbi}/`. xos_lib disponibile in `db/scripts/_lib/cross_os_pipeline.sh`.
3. **Brand v1.1 deferred refinements** — 22 items in `docs/BRAND_V1_DEFERRED_REFINEMENTS.md` (~6h batched). Priorità raccomandata: A11Y-1+2 first (~20min). Indipendente da Cowork↔CLI work.

## Open questions

- **Decisione opzione A/B/C** per CW-B34 ESCO unblock (vedi halt notice).
- **Push del commit X5.B** (quando arriva): bundle unico A+B+C+D o split incrementale?
- **Goal 003 SDBI strategic pivot pre-X1** ancora pending — 8 commit non-pushati su separate branch? (verificare con `git branch -a`)

## Stack snapshot (deltas vs S925)

- **sys.* populated**: 51/128 (+13 vs pre-X1: sys_goals 1067 + 9 satellite Goals/OKRs SDBI + sys_job_families 27 + sys_job_roles 202 + sys_skill_aliases 80 + esco_skills 14011 MIRROR GAP)
- **Migrations**: 000034 (job_families staging) + 000036 (temp_sdbi schema) + 000037 (sys_goals_okrs scaffold) + 000038 (job_roles nullable family) + 000039 (audit nullable source_table_id) + 000041 (esco_occupation_mappings nullable job_role_id). 000035/000040 skipped (numbering coordination).
- **Engine patches**: CW-B17 audit emission, CW-B22 IS NOT DISTINCT FROM→=, CW-B23 ANALYZE staging, CW-B24 lineage DISTINCT ON, CW-B31 main INSERT DISTINCT ON, CW-B32 CAST_ENUM transform, R-01 aliased_from deref.
- **legacy_mirror**: 30 tables (+job_families 27 + esco_skills 14011 + skill_adjacencies 11634 + 11 goals/okrs + 5 users/employees).
- **ADRs**: ADR-0014 SDBI Accepted, ADR-0015 nullable FK Accepted, ADR-0016 PROPOSED (partial pending C6).
- **xos_lib**: `db/scripts/_lib/cross_os_pipeline.sh` sourceable (CW-B28 generalization).
- **Bias catalog**: 18 documented CW-B17→CW-B34.

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
cd D:/heuresys-advanced && pnpm --filter @heuresys/api typecheck     # green
git -C D:/heuresys-advanced log --oneline -3                          # ea4ebe6 X5.A
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_job_roles' AS k, COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_goals', COUNT(*) FROM sys.sys_goals
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
ORDER BY 1;"   # 202, 1067, 163
ls cowork_code_exchange/.inbox/cli/pending/ | tail -3                 # check new PROMPT
```

## Resume protocol

1. Read STATE + check `cowork_code_exchange/.inbox/cli/pending/` for new PROMPT 009 (Cowork C6 directive).
2. Per priorità #1: leggi halt notice + Cowork response. Apply engine patch Option A se directive accepts.
3. Per priorità #2 (X5.B): PROMPT 008 §5-§6 + C4 spec dirs. Run pre-flight § 2.
4. Per priorità #3: indipendente Cowork↔CLI work, vedi `docs/BRAND_V1_DEFERRED_REFINEMENTS.md`.
