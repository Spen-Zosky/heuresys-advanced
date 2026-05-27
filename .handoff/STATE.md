# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S940 — SDBI Phase 2: infra + chain remediation + **6 macro-aree DATA pilot, 9561 righe**).
**Branch**: `main` — HEAD **pushed**. **CI** verde. **0 alert Dependabot.** Tunnel 5433 up. Test API 345/5/0. **migrate.sh verde+idempotent (50 mig).**

## Last session brief

S940 — MVP-4 stream 2.4 SDBI Phase 2: da apertura a **6 macro-aree HRMS importate con dati reali**.
- **Infra**: ADR-0014 ACCEPTED; mig 000045 (lineage SDBI cols); 8 audit rule_codes; RUNBOOK; chain remediation (fix 000007 idempotency, ownership reassign postgres→heuresys, 000044 col fix → migrate.sh verde+idempotent).
- **Recovery dati**: live `heuresys_platform` svuotata; dati completi nel dump `heuresys_platform_0507` → restore in DB scratch `heuresys_platform_0507` sulla VM.
- **6 DATA pilot end-to-end** (pattern: restore→mirror legacy_mirror→temp_sdbi Phase3→consolidation sys.* Phase5 FK via natural_key→lineage SDBI-tagged + audit COMPLETE):

| macro-area | mig | card | sys.* | righe |
|---|---|---|---|---|
| PerformanceReviews (2.4.7) | 000046 | PERFREV-MAP-01 | 8 | 1251 |
| Mentorship (2.4.8) | 000047 | MENTORSHIP-MAP-01 | 4 | 521 |
| Feedback (2.4.9) | 000048 | FEEDBACK-MAP-01 | 4 | 1689 |
| Surveys/Engagement (2.4.10) | 000049 | SURVEYS-MAP-01 | 4 | 5635 |
| Succession/TalentPool (2.4.11) | 000050 | SUCCESSION-MAP-01 | 5 | 194 |
| Compensation (2.4.12) | 000051 | COMPENSATION-MAP-01 | 3 | 271 |
| **TOT** | | | **28** | **9561** |

Esclusioni oneste documentate nelle card (4 orphan feedback_responses; 14 orphan succession_candidates; feedback_360.review_cycle_id NULL nel source). User FK sempre NULL + legacy ids in metadata (manca employee→sys_users bridge). embeddings (vector) sempre skip.

## Top priorities (next session)

1. ~~employee→sys_users bridge~~ **INFATTIBILE coi dati attuali (verificato S940)**: le tabelle dipendenti legacy (`employees_core/hr/pii/payroll`) NON esistono nel dump 0507; i `sys_users` (433) sono persona di reference seedate (domini rtl-bank.org/smartfood.org/econova.org) con 0 lineage e metadata vuoto → nessuna chiave di join verso gli `employee_id` legacy. I user FK restano NULL + legacy id in metadata (unico trattamento corretto). Sbloccabile solo se in futuro si seeda un bridge esplicito legacy-employee→sys_users.
2. ~~TODO(CHECK) 000052~~ **FATTO S940** (mig 000052, 29 value-CHECK derivati dai dati per le 6 aree; `review_potential_rating` escluso perché misto numerico+label).
3. **Macro-aree rimanenti**: PredictionsML (performance_predictions/trends — verificare righe nel dump 0507), Recruiting/Onboarding (OUT-of-scope I8, marker only). Sub-tabelle reference rinviate (questionnaires/questions/templates/categories di feedback+surveys).
4. (opz) Phase 6 cleanup temp_sdbi.* + audit SDBI_TEMP_CLEANUP_V1. (minori) Dependabot #6/#16; zod4 pre-Phase3-API.

## Riproducibilità data-setup (runtime, non in migration files)

- DB scratch `heuresys_platform_0507` sulla VM = source completo (drop quando non serve). Mirror per area: `create table public._mir_$t as select <cols≠USER-DEFINED> from public.$t` (nel scratch) → `pg_dump -t public._mir_$t | sed 's/public\._mir_$t/legacy_mirror.$t/g' | psql heuresys_advanced` → `ALTER TABLE legacy_mirror.$t OWNER TO heuresys` (le tabelle create da postgres NON sono leggibili da heuresys!). Poi `psql -f 0{1,2,3}.sql`.
- NB: `POSTGRES_SUPERUSER_PASSWORD` vuota in `.env` → op superuser via SSH peer-auth VM (`sudo -u postgres`). Leggere dump come `ubuntu`; `pg_restore` 16 richiede `-f`/`-d`. NON usare obfuscation chr() nei comandi (il mirror critical_roles fallì silenziosamente così).

## Stack snapshot

- **Migration max**: 000051. Chain re-runnable+idempotent (50 mig OK×2).
- SDBI: ADR-0014 ACCEPTED; **6 macro-aree dati (9561 righe, 28 sys.* tables)** + Goals/OKRs 5939 + Time/Leave (pilot precedenti).
- SoT viva: `docs/kb/`. KB: wiki + graph hub in `wiki-space`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'; nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "select source_lineage_sdbi_mapping_card_id, count(*) from sys.sys_source_lineage_records where source_lineage_sdbi_mapping_card_id like '%-MAP-01' group by 1 order by 1"  # 6 rows, tot 9561
bash db/scripts/migrate.sh   # OK: 50 migrations applied
cd apps/api && pnpm exec vitest run   # 345 pass / 5 skip
```
