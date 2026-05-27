# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S940 — MVP-4 stream 2.4 SDBI Phase 2 opened + migration-chain remediation).
**Branch**: `main` — HEAD `cf86121` **pushed to origin** (push autorizzato per la sessione). 0 divergenza.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).
**CI**: triggata sull'ultimo push (runner OCI). **0 alert Dependabot.** Tunnel 5433 up. Test API **345 pass / 5 skip / 0 fail**. **migrate.sh verde end-to-end + twice-run idempotent.**

## Last session brief

S940: aperto **MVP-4 stream 2.4 — SDBI Phase 2** (CLI-owned). **ADR-0014 → ACCEPTED** (sign-off Enzo). Infra SDBI: mig **000045** (4 colonne provenance su `sys.sys_source_lineage_records`), **8 audit rule_codes SDBI**, **`docs/sdbi/RUNBOOK.md`**. **Pilot PerformanceReviews = DESIGN pilot**: mapping card `PERFREV-MAP-01` + mig **000046** (8 tabelle target). zod4 differito.
**Migration chain RISANATA** (era rotta end-to-end): fix **000007** (guard idempotency scheme_check), **ownership** `brownfield.tenant_id_mappings` + 2 funzioni `validate_lookup_fk_payload*` riassegnate postgres→heuresys (runtime, SSH peer-auth VM), **000044** bug `table_mapping_kind`→`table_mapping_classification` (non si era MAI applicata; ora riclassifica 12 record ADR-0020). Tutto pushato.

## 🔴 Carry-over (decisione Enzo)

1. **Source PerformanceReviews — nessun dato importabile allo stato live.** Le 8 source `heuresys_platform.public` sono 0-row; `legacy_mirror` non ha le tabelle perf-review (mai estratte; l'extract pulla da `heuresys_platform`, che ora è 0-row sulle HR tables — `legacy_mirror.goals`=1067 fu estratto quando la platform aveva dati, poi svuotata). **Phase 3-6 (import) restano DIFFERITE.** Opzione per sbloccare: restore di un dump storico `heuresys_platform_*.dump` (`/home/ubuntu/heuresys-evo/backups/local/`, ~367MB i primi di maggio) in un DB scratch sulla VM per verificare se le perf-review furono mai popolate, poi estrarre. **Verifica/effort separati — payoff incerto. Decidere se investire.**

2. ~~migrate.sh full-chain rotto~~ **RISOLTO S940** (vedi brief). Nota credenziali: `POSTGRES_SUPERUSER_PASSWORD` in `.env` è vuota → op superuser via SSH peer-auth sulla VM (`sudo -u postgres psql`), non via tunnel. Leggere i dump come utente `ubuntu` (la home non è attraversabile da `postgres`).

## Top priorities (next session)

1. **Decisione carry-over #1**: investire nel restore dump-storico per recuperare dati perf-review, oppure switch a una macro-area con dati in `legacy_mirror` (es. cluster Competency: `competency_review_ratings` 465, `learning_ratings` 396), oppure procedere con altre macro-aree solo come design pilot → PROMPT 028.
2. **TODO(CHECK)** in 000046: completare i value-CHECK whitelist (`review_type`/`status`, `cycle_type`/`status`, `phase_status`, `template_type`, `potential_rating`, `*_rating_scale_type`, `ksaba_dimension`) quando si osservano valori reali.
3. (minori) Dependabot residui: #6 react-i18next 15→17, #16 gh-pages 3→4. zod4 (#3+#5) mini-milestone prima di SDBI Phase 3 API.

## Stack snapshot

- **HEAD**: `cf86121` = origin/main. SDBI: ADR-0014 ACCEPTED; temp_sdbi (000036); lineage SDBI cols (000045); 8 target PerfReviews (000046, 0-row); 2 pilot dati shipped (Goals/OKRs 5939, Time/Leave).
- **Migration max**: 000046. **Chain re-runnable + idempotent** (45 mig, OK×2).
- **SoT viva**: `docs/kb/` (CLI-owned). **KB**: wiki `heuresys-advanced-wiki` + graph hub in `wiki-space`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                # empty = synced
bash db/scripts/migrate.sh                          # OK: 45 migrations applied (idempotent)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_performance_*"  # 8 target
cd apps/api && pnpm exec vitest run                 # 345 pass / 5 skip
```
