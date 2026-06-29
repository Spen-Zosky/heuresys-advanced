# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-29 (S1010 — programma "portale legacy → Personal area /me": F1+F2+F3a live in prod, in pausa).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1010 — profilo /me a navtab + import anagrafica legacy)

Programma (richiesta Enzo): portare la ricchezza del **Portale Dipendente legacy** (heuresys-evo, live `:3012/portal/*`, codebase VM **`/home/ubuntu/heuresys.com.evo`** — NON i cloni S63 `evo.heuresys.com`/`heuresys-evo`) nella **Personal area `/me`**, con pattern **navtab** (decisione IA **Ibrido**: profilo a tab per i dati "fermi"; aree dinamiche come sub-tab nelle voci esistenti). **3 fasi live in prod**: **F1** `/me/profile` a tab Panoramica (anagrafica) + Organizzazione — **6 nuovi satelliti** (`sys_user_demographics/_identity_documents/_addresses/_family_members/_bank_details/_employment`, mig **000164**) **importati dal DB legacy** `heuresys_evo_platform_db` (match `'LEGACY_EMP::'||employees.id`, ADR-0024; 161 anagrafiche, idempotente, seed `db/seeds/rtl-rebuild/14_*` + generator `db/scripts/gen-anagraphic-seed.sql`). **F2** tab Contratti (`sys_user_contracts` mig **000165**, 158 import, seed 15_*) + Documenti (wiring `/v1/me/documents`). **F3a** My HR (`/me`) a sub-tab Riepilogo|Performance|Presenze (endpoint self read-only su `sys_performance_reviews`/`sys_attendance`/`sys_time_off_balances` — dati già presenti dal rebuild, **nessun import**). nuovi endpoint self `/v1/me/{profile/full,contracts,performance,attendance}`. `ProfileTabs` riusabile (`apps/web/src/components/profile-tabs.tsx`, `?tab=`+lazy-mount). **Correttivo bias no-PII** (richiesto da Enzo): memoria `data-treatment-no-privacy-concerns` rinforzata (blocco anti-trigger) + corretto `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md:70` (l'innesco "out-of-scope"). **Debito S1009 colto+fixato**: `me-preferences.spec` cercava i vecchi bottoni `language-it/en` (S1009 li sostituì col toggle header `DashboardHeader`) — la CI smoke (solo `smoke-5-personas`) non lo copriva. Gate verdi end-to-end, **3 deploy VM** (verify race-FN ~40s boot, smoke www OK).

## Top priorities (next session)

1. **F3b** — `/me/career` a sub-tab [Obiettivi | Percorsi | Rischio & Successione]: endpoint `/v1/me/goals` (`sys_goals`) + `/v1/me/risk` (`sys_flight_risk_scores`/`sys_succession_readiness_scores`), dati già presenti; UI + test. NB `sys_user_target_positions` (Percorsi) è **vuoto** → empty-state o usa career-paths. (~3-4h)
2. **F4** — Cedolini/payroll in **consultazione** (autorità *cosa* = Enzo: importare RAL/cedolino individuale dal legacy `employee_pay_stubs`?). (~2-3h)
3. **F5** — IA completa Personal area + route portale residue (analytics personali, approvazioni, org-chart). (~4h+)

## Open questions (autorità *cosa* = Enzo)

- **F4 payroll**: importare i dati individuali cedolino/RAL dal legacy per la consultazione, o basta l'employment già importato (RAL contrattuale in `sys_user_employment`/`sys_user_contracts`)?
- **navtab generico**: `ProfileTabs` è advanced-specific in `apps/web`; promuoverlo a `@heuresys/ui` se serve un 3° consumer.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_user_demographics"  # 161
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/api/v1/me/profile/full   # 401 (endpoint live)
```
