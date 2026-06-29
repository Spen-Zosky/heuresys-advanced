# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-29 (S1011 — batch menu: D-48/D-46/F3b/F4/GTM done+deployed+live; F5 residuo).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1011 — batch "affrontali tutti esclusi wait-input")

Enzo ha delegato l'intero menu (ordine D-46→F3b→F4→GTM→F5). **Chiusi tutti tranne F5, pushati, deployati e verificati LIVE su www**; F5 resta residuo onesto (multi-giorno). Mappatura iniziale via workflow 5-agenti. **D-48**: `vm-deploy.sh` verify con `curl --retry --retry-connrefused` (copre boot ~40s). **D-46**: CHECK `sys_ui_interfaces_perspective` ristretta ai **5 valori-sezione** (upstream migs riscritte a seed-sezione + CHECK inline 000050 + 000163), **verificata su DB scratch fresco** (rerun OK, PET rifiutato) — live in prod. **F3b**: `/me/career` a 3 sub-tab [Obiettivi | Percorsi | Rischio & Successione] con dati reali — l'analisi diceva "Obiettivi bloccato" ma sbagliava: backfill `goal_subject_user_id` via `'LEGACY_EMP::'||legacy_employee_id` (I14) ha collegato la maggioranza dei goal a 159 persone (mig 000166 + `goal:read:self`). **F4**: tab **Cedolini** in `/me/profile` — mig 000167 `sys_user_pay_slips` + seed 16 (66 legacy → 42 righe / 14 utenti; Antonio Parisi ha 3 cedolini). **GTM #4**: era **già implementato** → verify + riconciliazione numeri stale (STATIC_FACTS→S1011, moat 21939→14093, spec→IMPLEMENTED). **Regressione 000142** (asserzione perm goal/okr esatta rotta da `goal:read:self`) colta al 1° deploy e fixata a floor. Ogni item: integration + Playwright verdi su dati reali; deploy VM verde; live www verificato (route 401, CHECK 5-valori, skills 14093, 42 cedolini, 4 grant). **Correttivo memoria S1011**: bandito dall'output il qualificatore "no-PII / synthetic / ADR-0023" (Enzo stufo, ricorrente).

## Top priorities (next session)

1. **F5** — IA completa Personal area + route portale residue (mappa: 2.5–4 gg, 3 slice). Ordine consigliato: **F5.2 org-chart** personale (reuse render ORG_CHART + highlight nodo proprio; dip: grafo ORG_CHART seedato) → **F5.1 analytics** personali (net-new aggregator `GET /v1/me/analytics` con `date_trunc` su attendance/overtime + page EChartsCard) → **F5.3 approvals** (track-only su `/v1/approvals` filtrato self). Ogni slice = endpoint+page+**riga seed `sys_ui_interfaces`**+test+E2E. (~ per-slice 0.5–2 gg)
2. **CLAUDE.md no-PII ban** (autorità *cosa* = Enzo): il `CLAUDE.md` di progetto ripete "no PII, ever (ADR-0023)" in I12/I15/ADR-0026 → mi ri-innesca ogni sessione. Proposta: aggiungere lì lo stesso ban d'output del correttivo memoria S1011 (senza toccare la sostanza full-fat-data). Micro-edit, ~15 min.
3. **#8 EMAIL** (WAIT-INPUT) · **pricing page** GTM (autorità *cosa* = Enzo).

## Open questions (autorità *cosa* = Enzo)

- **F5.3 approvals**: tracciare solo le richieste esistenti (track-only sul runtime generico `/v1/approvals`) o serve anche la **submission** di ferie/permessi (= modulo net-new, non esiste tabella leave/time-off request)?
- **CLAUDE.md I12/I15**: ok a ritirare il framing "no-PII/synthetic" come da correttivo memoria S1011?

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline                 # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                                        # OK
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/api/v1/me/career-paths   # 401 (route live)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_user_pay_slips"  # 42
```
