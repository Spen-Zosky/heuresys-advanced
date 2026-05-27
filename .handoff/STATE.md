# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S940 — SDBI Phase 2: infra + chain remediation + **4 macro-aree DATA pilot**).
**Branch**: `main` — HEAD **pushed**. **CI** verde. **0 alert Dependabot.** Tunnel 5433 up. Test API 345/5/0. **migrate.sh verde+idempotent (48 mig).**

## Last session brief

S940 — MVP-4 stream 2.4 SDBI Phase 2 aperto e portato a **4 macro-aree con dati reali** (+ infra + risanamento catena migration).
- **Infra**: ADR-0014 ACCEPTED; mig 000045 (lineage SDBI cols); 8 audit rule_codes; RUNBOOK; chain remediation (fix 000007 idempotency, ownership reassign, 000044 col fix → migrate.sh verde+idempotent).
- **Recovery dati**: la live `heuresys_platform` era svuotata; dati completi nel dump `heuresys_platform_0507` → restore in DB scratch `heuresys_platform_0507` sulla VM (source per tutte le macro-aree).
- **4 DATA pilot end-to-end** (mig 000046-049, card *-MAP-01, seed `db/seeds/brownfield/sdbi/<area>/0{1,2,3}.sql`):

| macro-area | mig | sys.* tables | righe |
|---|---|---|---|
| PerformanceReviews (2.4.7) | 000046 | 8 | 1251 |
| Mentorship (2.4.8) | 000047 | 4 | 521 |
| Feedback (2.4.9) | 000048 | 4 | 1689 |
| Surveys/Engagement (2.4.10) | 000049 | 4 | 5635 |
| **TOT** | | **20** | **9096** |

Pattern per ciascuna: restore→mirror in legacy_mirror→temp_sdbi (Phase 3)→consolidation sys.* (Phase 5, FK via natural_key)→lineage SDBI-tagged + audit COMPLETE. User FK NULL+metadata (no employee→sys_users bridge). Cross-cluster FK risolte dove possibile (cf→sys_goals, fb/surveys intra-cluster). Esclusioni oneste documentate (4 orphan feedback_responses; review_cycle_id NULL nel source feedback_360).

## Top priorities (next session)

1. **Macro-aree restanti** (dati nel dump 0507/scratch, pattern 2.4.x rodato): Succession/TalentPool (succession_candidates 100, succession_plans, talent_pools, talent_pool_members), Compensation (bonus_plans 10, salary_bands, salary_band_assignments, revenue_equity), PredictionsML (performance_predictions/trends — verificare righe nel dump). Sub-tabelle reference rinviate (questionnaires/questions/templates/categories).
2. **TODO(CHECK)** migration 000050: aggiungere value-CHECK ai categorici (valori ora noti dai dati) per 000046-049. Es. review_type{ANNUAL,MID_YEAR}, status, cycle_type, ecc.
3. **employee→sys_users bridge**: per risolvere gli user FK oggi NULL (employee_id legacy → sys_users) — vale per tutte le macro-aree.
4. (opz) Phase 6 cleanup temp_sdbi.* + audit SDBI_TEMP_CLEANUP_V1. (minori) Dependabot #6/#16; zod4.

## Riproducibilità data-setup (runtime, non in migration files)

- DB scratch `heuresys_platform_0507` sulla VM = source completo. Mirror per area: `create table public._mir_$t as select <cols≠USER-DEFINED> ...` nel scratch → `pg_dump | sed public._mir_$t→legacy_mirror.$t | psql heuresys_advanced` → `ALTER TABLE legacy_mirror.$t OWNER TO heuresys` (le tabelle create da postgres NON sono leggibili da heuresys). Poi `psql -f 0{1,2,3}.sql`.
- NB: `POSTGRES_SUPERUSER_PASSWORD` vuota in `.env` → op superuser via SSH peer-auth VM. `pg_restore` dei dump come utente `ubuntu` (postgres non attraversa /home/ubuntu); pg_restore 16 richiede `-f` o `-d`.

## Stack snapshot

- **Migration max**: 000049. Chain re-runnable+idempotent (48 mig OK×2).
- SDBI: ADR-0014 ACCEPTED; 4 macro-aree dati (9096 righe, 20 sys.* tables) + Goals/OKRs 5939 + Time/Leave (pilot precedenti).
- SoT viva: `docs/kb/`. KB: wiki + graph hub in `wiki-space`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'; nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "select source_lineage_sdbi_mapping_card_id, count(*) from sys.sys_source_lineage_records where source_lineage_sdbi_mapping_card_id like '%-MAP-01' group by 1"
bash db/scripts/migrate.sh   # OK: 48 migrations applied
```
