# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S940 — SDBI Phase 2 opened + chain remediation + PerformanceReviews DATA pilot).
**Branch**: `main` — HEAD **pushed** (push autorizzato sessione). 0 divergenza attesa post-push.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).
**CI**: verde (Test/Typecheck/Lint success). **0 alert Dependabot.** Tunnel 5433 up. Test API **345 pass / 5 skip / 0 fail** (codice invariato dall'ultimo run). **migrate.sh verde end-to-end + idempotent.**

## Last session brief

S940: **MVP-4 stream 2.4 — SDBI Phase 2** aperto e portato fino al **primo DATA pilot reale**.
- Infra: **ADR-0014 ACCEPTED**; mig **000045** (4 col provenance SDBI); **8 audit rule_codes**; **RUNBOOK**; mapping card **PERFREV-MAP-01**; mig **000046** (8 target `sys.sys_performance_*`/`sys_review_*`).
- **Chain remediation**: fix **000007** (idempotency guard), **ownership** reassign postgres→heuresys (runtime), **000044** (col fix, non si era mai applicata). migrate.sh ora verde+idempotent.
- **DATA pilot PerformanceReviews (mig 2.4.7)**: dati recuperati dal dump `heuresys_platform_0507` (la platform live era stata svuotata post-7mag) → restore in DB scratch `heuresys_platform_0507` sulla VM → mirror 8 tabelle in `legacy_mirror` → SDBI Phase 3+5 → **1251 righe in `sys.*`** (perf_reviews 292, participants 250, comp_ratings 465, goal_ratings 155, cycles 35, self 30, phases 20, templates 4). Accettazione: 0 FK dangling, goal_id 155/155→sys_goals, 1251 lineage SDBI-tagged, 8 audit COMPLETE.

## Riproducibilità data-setup (runtime, non in migration files)

```bash
# 1. scratch DB (già presente: heuresys_platform_0507). Se serve ricrearlo:
#    cp dump in /tmp (postgres non legge /home/ubuntu), poi sudo -u postgres pg_restore
# 2. mirror in legacy_mirror (per ogni tabella, come postgres sulla VM):
#    create table public._mir_$t as select <cols≠USER-DEFINED> from public.$t;  (nel scratch)
#    pg_dump -t public._mir_$t | sed 's/public\._mir_$t\b/legacy_mirror.$t/g' | psql -d heuresys_advanced
#    ALTER TABLE legacy_mirror.$t OWNER TO heuresys;   (le tabelle create da postgres non sono leggibili da heuresys!)
# 3. SDBI: psql -f db/seeds/brownfield/sdbi/performance_reviews/0{1,2,3}.sql
```

## Top priorities (next session)

1. **Scalare le altre 7 macro-aree** (dati pronti nel dump 0507/scratch): Surveys/Engagement (engagement_survey_responses 1124), Feedback (feedback_360 714), Mentorship (124), Succession/TalentPool (succession_candidates 100), Compensation (bonus_plans + salary). Per ciascuna: target migration + mapping card + mirror + Phase 3/5 (pattern PerformanceReviews 2.4.7).
2. **TODO(CHECK)** in 000046: aggiungere value-CHECK ora che i valori sono noti — review_type {ANNUAL,MID_YEAR}, review_status {SUBMITTED,COMPLETED,IN_PROGRESS}, cycle_status {ACTIVE,DRAFT,COMPLETED}, cycle_type {ANNUAL,SEMI_ANNUAL,QUARTERLY} + introspettare gli altri categorici. Migration 000047.
3. (opz) Phase 6 cleanup temp_sdbi.performance_* + audit SDBI_TEMP_CLEANUP_V1. (minori) Dependabot #6/#16; zod4 pre-Phase3-API.

## Stack snapshot

- SDBI: ADR-0014 ACCEPTED; temp_sdbi (000036); lineage SDBI cols (000045); 8 PerfReviews target (000046) **popolati 1251 righe**; pilot dati: Goals/OKRs 5939 + Time/Leave + **PerformanceReviews 1251**.
- **Migration max**: 000046. Chain re-runnable + idempotent (45 mig OK×2).
- **DB scratch** `heuresys_platform_0507` sulla VM = source dati completo per le restanti macro-aree (drop quando non serve più).
- **SoT viva**: `docs/kb/`. KB: wiki + graph hub in `wiki-space`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'; nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "select count(*) from sys.sys_performance_reviews"  # 292
bash db/scripts/migrate.sh   # OK: 45 migrations applied
cd apps/api && pnpm exec vitest run   # 345 pass / 5 skip
```
