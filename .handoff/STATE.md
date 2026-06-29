# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-29 (S1011 — batch menu COMPLETO: D-48/D-46/F3b/F4/GTM **+F5** done+deployed+live; CLAUDE.md no-PII; #23 chiuso).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1011 — batch "affrontali tutti esclusi wait-input")

Enzo ha delegato l'intero menu (ordine D-46→F3b→F4→GTM→F5). **Chiusi tutti tranne F5, pushati, deployati e verificati LIVE su www**; F5 resta residuo onesto (multi-giorno). Mappatura iniziale via workflow 5-agenti. **D-48**: `vm-deploy.sh` verify con `curl --retry --retry-connrefused` (copre boot ~40s). **D-46**: CHECK `sys_ui_interfaces_perspective` ristretta ai **5 valori-sezione** (upstream migs riscritte a seed-sezione + CHECK inline 000050 + 000163), **verificata su DB scratch fresco** (rerun OK, PET rifiutato) — live in prod. **F3b**: `/me/career` a 3 sub-tab [Obiettivi | Percorsi | Rischio & Successione] con dati reali — l'analisi diceva "Obiettivi bloccato" ma sbagliava: backfill `goal_subject_user_id` via `'LEGACY_EMP::'||legacy_employee_id` (I14) ha collegato la maggioranza dei goal a 159 persone (mig 000166 + `goal:read:self`). **F4**: tab **Cedolini** in `/me/profile` — mig 000167 `sys_user_pay_slips` + seed 16 (66 legacy → 42 righe / 14 utenti; Antonio Parisi ha 3 cedolini). **GTM #4**: era **già implementato** → verify + riconciliazione numeri stale (STATIC_FACTS→S1011, moat 21939→14093, spec→IMPLEMENTED). **Regressione 000142** (asserzione perm goal/okr esatta rotta da `goal:read:self`) colta al 1° deploy e fixata a floor. Ogni item: integration + Playwright verdi su dati reali; deploy VM verde; live www verificato (route 401, CHECK 5-valori, skills 14093, 42 cedolini, 4 grant). **Correttivo memoria S1011**: bandito dall'output il qualificatore "no-PII / synthetic / ADR-0023" (Enzo stufo, ricorrente). **Poi (stessa sessione, su richiesta Enzo)**: **CLAUDE.md no-PII** sistemato (OUTPUT RULE in *Data provenance* + I12/I15 ritirano il qualificatore, sostanza intatta) + **F5 COMPLETO** — 3 pagine `/me/{analytics,org-chart,approvals}` (mig 000168 nav+`approval:read:self`; analytics aggregator attendance-trend, org-chart riusa il grafo ORG_CHART con highlight nodo proprio, approvals track-only empty-state reale; Enzo: solo-consultazione). #23 chiuso. **Incidente deploy risolto**: il 1° `vm-deploy.sh` è andato in timeout sul client SSH (10min) → build web incompleto + API non riavviata; fix = rebuild web con `NEXT_PUBLIC_API_PROXY_BASE_URL=:8013` (vm-deploy lo setta inline) + restart → prod ripristinata, F5 live su www (route 401, pagine 307).

## Top priorities (next session)

1. **D-49** (debito-deploy, P2): lanciare `vm-deploy.sh` in **background** (nohup) per non farlo interrompere dal timeout 10min del client SSH (causa root dell'incidente S1011: build web incompleto + API non riavviata). Eval: aggiungere un wrapper o doc nel `close-propagate`/`vm-deploy`. ~0.5h.
2. **pricing page** GTM (autorità *cosa* = Enzo: serve i suoi numeri prezzi/tier) — prossimo deliverable del programma-faro #4.
3. **#8 EMAIL** (WAIT-INPUT, app-password Outlook).

## Open questions (autorità *cosa* = Enzo)

- **F5.3 approvals evoluzione**: oggi è track-only (0 richieste → empty-state reale; gli employee non creano approvazioni). Se in futuro serve la **submission** ferie/permessi → è un modulo net-new (non esiste tabella leave/time-off request). Decisione di prodotto rimandata.
- **pricing**: numeri prezzi/tier per la pricing page GTM.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline                 # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                                        # OK
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/api/v1/me/career-paths   # 401 (route live)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_user_pay_slips"  # 42
```
