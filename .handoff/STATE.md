# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-22 (S1004 — DBMS health-check + ADR-0026 doctrine + retire `is_synthetic`).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1004 — DBMS health-check, ADR-0026, refactor synthetic)

Sessione lunga DBMS + dottrina. (1) **Health-check forense del DBMS**: census completo delle tabelle + completezza per-colonna + **matrice copertura live-E2E** delle pagine web→endpoint→repository SQL→tabella verificata contro RTL_BANK via workflow multi-agente (LIVE / PARTIAL / EMPTY, passaggio adversariale) → `qa_artifacts/dbms_health_2026-06-22/FINAL_REPORT.md`; distinzione netta **gap-DATI vs gap-CODICE**. (2) **Flusso graphify ripetibile** `scripts/db-health-graph.sh` (census + `_export.sql` esteso `05_data_health`/`06_webapp_coverage`) → grafo-conoscenza DBMS in `graphify-db-input/graphify-out/` (265 nodi/27 community, gitignored, dir-isolata dal grafo codebase). (3) **ADR-0026** (chiarimento dottrinale Enzo, "una volta per tutte"): UN ambiente = **produzione**; RTL Bank (customer-example) + Heuresys System (platform) = **tenant di produzione correnti** (NON "di test"); dati synthetic-by-provenance → no-PII → **trattati come reali**; 2 percorsi d'uso (prospect pubblico→`/demo`·`/investors` / utente registrato→login per profilo RBAC); CLAUDE.md invariante **I15** + DoD riformulata; **audit forense 12-agenti = codice già conforme (0 refactor test/prod)**; 7 doc allineati. (4) **Refactor A** (decisione Enzo): ritirato `user_is_synthetic` (colonna+vista+CHECK+index) + rinominato user_type `SYNTHETIC_REFERENCE`→`GENERATED_INCUMBENT` (mig **000154**; `000004`/`000023`/`000111` resi twice-run idempotenti, CHECK transition-tolerant). **Gate tutti verdi**: typecheck 5ws · test API impattati (users/tenant-mat/auth-mfa) · migrate ×2 idempotente · db:validate (6 viste=0, empty diff) · **deploy VM PROD live** (`/users` 401 non-500, `/readyz` 200). 4 commit **pushati** + VM allineata. Granulare → `SOT_STATE.md §Delta S1004`.

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): candidato **pricing page** (serve numeri prezzi/tier) o altro. Keystone del programma.
2. **Allineamento doc descrittivi `is_synthetic`** (~8 doc: `TARGET_SCHEMA_DESIGN`, `BOOTSTRAP I14`, brownfield ×3, `MIGRATION_IMPL`, `AUTH_SECURITY`, `MVP_4`) ancora citano la colonna ritirata → pulizia terminologica (DEBT D-44, ~0.5h).
3. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → EMAIL_OTP + digest live.

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='sys' AND table_name='sys_users' AND column_name='user_is_synthetic'"  # 0 (colonna ritirata)
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/api/v1/users   # 401 (route up, no 500)
```
