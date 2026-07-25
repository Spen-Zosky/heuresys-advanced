# RESUME — Batch autonomo S1018 (fresh session restart point)

> **✅ SEQUENZA CHIUSA — non è più un punto di ripartenza (S1029, 2026-07-25).** Il batch a 13 wave non va ripreso da dove si era fermato: le sessioni S1019-S1028 hanno superato la sua struttura, e le tre wave mai dichiarate chiuse hanno oggi una collocazione diversa.
>
> | Wave | Esito |
> |---|---|
> | **W1-W10** | assorbite dalle sessioni successive (Serie C/D/F, #24 F4, E1 whistleblowing + ADR-0028, E4) |
> | **W11** — E5 ATS | **non fatta**: vive come item `#54` del register (~5-7 sessioni), area *product* del piano `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` |
> | **W12** — audit 100X | **non fatta**: vive come `#9/#10/#11` (WS-L + triage + gate) |
> | **W13** — deploy finale | **superata dai fatti**: il vincolo «deploy PROD solo a fine batch» è decaduto, i deploy sono avvenuti nelle sessioni successive. Verificato il 2026-07-25: la VM è su `1ae237cf`, api+web `active`, `https://www.heuresys.com/login` → 200 e `/api/readyz` → 200 |
>
> Le *decisioni* di Enzo elencate sotto restano vincolanti e non vanno ri-chieste. Il resto del file è storico.

> **Scopo**: ripartire dal punto esatto di interruzione del batch full-scope S1018 senza ripetere azioni fatte né perdere azioni da fare. Congelato 2026-07-16 su richiesta di Enzo (fresh session).
> **Piano completo (autoritativo)**: `docs/kb/PLAN_S1018_BATCH.md` (versionato nel repo — origine: piano di sessione VM S1018) — leggilo per intero all'avvio. **Register**: `docs/kb/SOT_BACKLOG.md` (item #4-#63). Questo file è l'indice di stato del batch.

## Come ripartire (fresh session)
1. `avvia sessione` → menu; poi leggi **questo file** + il **piano** sopra.
2. `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22` prima di ogni pnpm.
3. Baseline: `git log --oneline -1` deve essere ≥ `ee3b0558`. `git status` pulito tranne `.env.bak-*` (untracked, NON toccare).
4. Riprendi da **W2** (vedi sotto). Il DB è già migrato fino a **000172** (verifica: `ls db/migrations | tail -1`).

## Decisioni di Enzo (vincolanti, NON ri-chiedere) — interview S1018
- Scope dossier: **C + D + E + F + G tutte incluse** (Enzo: "includile tutte").
- **#40 Voyage runtime AUTORIZZATO** (fatto). **E2 SSO** = WAIT-INPUT (serve IdP di Enzo).
- App-password Outlook (#8/#39) NON fornita → resta GATED. Pricing (#4) numeri NON forniti.
- **Push per item; deploy PROD SOLO a fine batch** (W13). NON deployare a metà.
- HOLD riattivate: **#4-deferrals**, **#24 F4** (activity entities = **riuso goals/approvals**), **#9-11 audit 100X**.
- **F5 self-view**: TUTTO visibile al dipendente (capability + flight-risk con evidenze) → supersede D-6 via decision-log PRIMA del codice.
- **E3** time-off ESS-write: NO (solo lettura #33, già fatto). **E1** whistleblowing: SÌ con ruolo custodian + ADR-0028. **E5** ATS: in coda (W11).
- Decisioni residue in-batch delegate a Claude (batch-delegation); trade-off bilanciati → registrati come deferred con rationale, mai indovinati.

## Regole di esecuzione (ogni item)
Pattern modulo 7-step → `pnpm typecheck && lint && test` verdi → **live E2E su build locale** (porte test :3400 web / :3401 api, MAI :3013/:8013) con login persona reale → commit atomico → **push** → aggiorna nota register. Migrazioni SOLO additive (dist PROD gira). Numerazione migration = **next-free (prossima: 000173)**. Ogni risorsa sensibile → `RESOURCE_DATA_CLASS` nello stesso commit (D-51). Nuove liste = paginazione server-side (`usePaginatedList`, C4-mini). `text-destructive` NON valido → `text-danger`; `text-warning` valido.

## FATTO in S1018 (NON rifare)

### W0 — preflight + fondamenta (COMPLETO)
- Register: serie C-G convertite in #42-#63; #40/#24/#4-def/#9-11 riattivati; E2→WAIT-INPUT. (commit a0c52c03)
- **D-08 core** (commit dd8d0bd0): `scripts/vm-rollback.sh` nuovo + `vm-deploy.sh` probe-as-gate + LAST_GOOD + runbook `deploy/README.md`. **Il deploy finale W13 è ora protetto** (pg_dump pre-deploy già esisteva; ora + rollback + gate).
- **Fix test-harness PROD-VM** (commit 811a48d2): `test/helpers/setup.ts` — override `AUTH_LOGIN_RATELIMIT_MAX` valutato PRIMA di dotenv (il .env VM ha =10 hardening → starvava mfa-policy a 429); `semantic-matching` flag-OFF branch machine-independent.
- **C4-mini** (commit 3fa4d442): `apps/web/src/lib/hooks/use-paginated-list.ts` + `EntityTable` prop `server` (paginazione server-side). Le nuove liste lo usano.
- **4 TRUE-POSITIVE audit 2026-07-03 verificati GIÀ FIXATI**: F-001 (seed-test-admin env-driven, fail-closed), F-002 (login next param same-origin), F-004 (csv neutralizeFormula), F-012 (build-web.yml fork-PR gate). Nessun residuo.

### W1 — Serie A P1/P2/P3 (COMPLETA end-to-end)
Tutti DONE con API + web + E2E verdi, register aggiornato:
| Item | Commit API | Commit web | Note |
|---|---|---|---|
| **#40** free-text search | 96ff77cf | (incl.) | UI /me/matching + /skills, Voyage runtime live |
| **D-54** inbox orphans | 29c9a501 | — | cleanup in-tx + mig 000170 + test 3/3; **D-54 RISOLTO** in DEBT_REGISTER |
| **#26** goal/OKR life | 66f3c91c | c22725ef | sub-read + timeline; helper `canReadGoal`/`loadReadableOkr` (**contratto F4**); 10/10 API + 3/3 E2E |
| **#31** KPI metrology | e0748c87 | ee3b0558 | methods/rules/metrics/measurements; panel /kpis; 6/6 |
| **#30** gap closure | d48f4d4a | ee3b0558 | plans/actions/results + me/gaps/closure; panel /gaps; 5/5 |
| **#27** evidence layer ⭐ | d4d0eae3 | 7a544e02 | UNION 9 tabelle + provenance footer; EvidenceDrawer su /insights/skill-gap; mig 000172; 7/7 |
| **#28** trust ledger ⭐ | e65482a6 | 2f68f481 | /v1/provenance + /summary; pagina /provenance; mig 000171; 6/6 |

**Migrazioni nuove S1018**: 000170 (inbox purge), 000171 (provenance perm+ui), 000172 (evidence perm). Tutte applicate al DB VM + idempotenti.
**Contratto F4 (W9)**: l'autorizzazione goal/OKR è centralizzata in `goals/service.ts::canReadGoal` e `okrs/service.ts::loadReadableOkr` — W9/F4 sostituirà UN corpo di funzione (dual-class row-shape), non 5 moduli.

### Twice-run repair scoperto (già fixato in 29c9a501)
Le assertion GRANT-count NON-scoped di `000060` (matching:read/admin) e `000145` (14 mappings) erano rese stantie da 000169 (I21) → rompevano il re-run idempotente della catena. Ora sono FLOOR (`>=`). Le assertion role-scoped (000085, 000104) restano esatte per design.

## DA FARE (ordine wave — riprendi da W2)
Riferimento dettagliato per-wave nel **piano** (link in cima). Sintesi:
- **W2** Serie A P2/P3 = **GIÀ FATTA** (#29 talent-review NON fatto! — vedi sotto). **ATTENZIONE**: #29 talent-review (9-box) è ancora **ACTIVE, da fare** — era in W2 del piano ma NON è stato eseguito. Blueprint completo nell'output del Plan agent (in `docs/kb/PLAN_S1018_BATCH.md` sezione W2 + conversazione). #32 comp read e #33 time-off del piano W2 NON ancora fatti neanche loro. **→ Prossimo step concreto: #29, #32, #33** (Serie A P2/P3 residua) OPPURE passare a W3 Serie B.
- **W3** Serie B: #34 approval handlers, #37 reward-gate engine, #36 viz versioning+export, #38 inbox SSE, #35 observability. Blueprint dettagliato = output Plan agent "B-series" (in conversazione S1018 / piano).
- **W4** GTM deferrals (#4): lead admin UI, honeypot obs, /privacy reale, a11y Lighthouse ≥95.
- **W5** Serie G: #61 G2 (:delete perms 27 route), #62 G3 (acyclicity+warn), #60 G1 (retention 547MB, snapshot prima), #63 G5 (archive script).
- **W6** Serie C admin editing (#42-#45). **W7** Serie D legacy import (#46-#50). **W8** Serie F intelligence (#55-#59). **W9** #24 F4 asse funzionale (shadow→enforce). **W10** E1 whistleblowing (#51, ADR-0028) + E4 (#53). **W11** E5 ATS (#54). **W12** audit 100X (#9-11): WS-L design-only + triage D-01..D-14 + `/full-forensic-audit`. **W13** deploy finale (`vm-deploy.sh` con protezioni D-08) + smoke PROD + handoff completo.

## Gotchas appresi S1018 (non ri-inciampare)
- **TEST_ADMIN_PASSWORD** nel .env è quoted → de-quota per curl: `sed -e 's/^["'\'']//' -e 's/["'\'']$//'`. Playwright lo carica già de-quotato.
- **Playwright MFA setup flakiness**: la setup `platformAdmin` va spesso in flake su MFA (retry:1 la salva). Se una spec "did not run", ri-lancia: è la setup, non il codice.
- **Suite API completa** (`vitest run` su 172 file) può fare **SIGABRT (Napi::Error)** sotto carico concorrente (se API :3401 + Playwright girano insieme → pressione memoria). Non è un fallimento di test: i moduli passano individualmente. Per la regression gate completa, **killa prima l'API locale + Playwright** e gira la suite da sola.
- **Live E2E locale**: avvia API con `PORT=3401 HOST=127.0.0.1 pnpm exec tsx src/server.ts` (da apps/api, background); poi Playwright con `PLAYWRIGHT_WEB_PORT=3400 NEXT_PUBLIC_API_PROXY_BASE_URL=http://localhost:3401 NEXT_PUBLIC_API_BASE_URL=http://localhost:3401 pnpm exec playwright test <spec>`. I teardown psql falliscono (no PGPASSWORD) — innocui, best-effort.
- **Migration exact-count assertions**: preferire FLOOR (`< N`) a esatto (`<> N`) quando migrazioni successive additive possono estendere i grant (lezione twice-run).
- **DataTablePanel** ora accetta `children` (slot tra header e tabella) + `server` (paginazione). Riusa `usePaginatedList` per liste grandi.

## Stato SoT alla chiusura
- Branch `main`, HEAD `ee3b0558` (tutto pushato, origin allineato).
- Migration: **170 file, max 000172**. DB VM migrato. Test file API: **172**.
- DEBT_REGISTER: **D-54 RISOLTO** → 0 debiti aperti (verifica al prossimo handoff).
- **SOT_STATE.md §0 + Delta**: aggiornato con Delta S1018 (vedi sotto nel file). PROD www.heuresys.com gira ancora la versione **pre-batch** (nessun deploy — scelta Enzo, deploy a W13).
- `handoff_lint.py`: verde dopo l'aggiornamento §0 (era D3 FAIL su count stantio, ora ri-derivato).
