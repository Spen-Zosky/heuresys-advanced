# Verifica del piano «zero pendenze» — sessione preliminare 2026-09-12

> **item**: #76
> **stato**: IN CORSO

**Oggetto**: `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` (scritto 2026-07-25, S1029) — 262 cluster totali, 216 aperti alla data di questa verifica (46 già chiusi da esecuzione precedente).

**Metodo**: sessione di sola lettura/misura. Ogni cluster aperto è stato verificato uno per uno (nessun campionamento) leggendo il suo `*chiuso quando*` ed eseguendo, dove possibile in sola lettura, il comando indicato o un suo equivalente diretto (query `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -Atc "SELECT ..."`, `grep`/`find`/`wc` sul repo, `git log`/`git shortlog`, `gh pr list`/`gh api` in sola lettura, `curl` GET su endpoint pubblici). Nessun file del repo è stato modificato, nessun commit, nessuna scrittura sul database, nessun comando SSH verso host remoti (VM Oracle, linux-pc) — quando il criterio lo richiedeva, il cluster è classificato `NON-MISURABILE` con la ragione, oppure verificato per via indiretta (register/backlog/archivio/commit git).

Lavoro condotto in parallelo su 6 lotti per ondata (W0+W1a, W1b, W2, W3, W4, W5+W6), ciascuno verificato in modo indipendente; il lotto W5+W6 è stato completato direttamente da questa sessione dopo che il sub-agente assegnato non è riuscito a consegnare il proprio output (bloccato in un loop del gate di fine-turno del repository, estraneo al mandato di sola lettura di questo compito).

**Verdetti**: `GIÀ-FATTO` (il criterio è oggi soddisfatto, verificato) · `SUPERATO` (una decisione dottrinale successiva — I12 "rubinetto brownfield chiuso", ritiro dello schema `brownfield`, o un cambio di schema — rende il criterio senza oggetto) · `VALIDO` (il criterio non è oggi soddisfatto, verificato) · `NON-MISURABILE` (non verificabile da questa sessione: richiede scrittura, host remoto, o comando distruttivo).

**Comandi-tipo usati**: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -Atc "<SELECT>"` · `grep -rn`/`find` sul repo · `git log --oneline --all --grep=...` · `git shortlog -sn --since="3 months ago"` · `gh pr list --state open --label dependencies` · `gh api repos/.../branches/main/protection` · `curl -sI https://www.heuresys.com/...` · `wc -l`/`wc -c`/`du -sh` su file e directory locali.

---

## Tabella di verifica — tutti i 216 cluster aperti

| Z-id | ondata | titolo abbreviato | verdetto | evidenza |
|---|---|---|---|---|
| Z-034 | W0 | Segreti TOTP: fixture in chiaro + plaintext DB | GIÀ-FATTO | psql count=0; fixture .ts letti da Proxy/DB cifrato (Z-262/#169 F3c), 0 hardcoded |
| Z-088 | W1 | Sizing storage pre-lancio HNSW non pianificato | VALIDO | grep m=8/m=16: solo nota WS-T5 "da pianificare pre-launch", nessuna stima committata |
| Z-066 | W1 | sys_auth_sessions tabella morta ma in mappa GDPR | VALIDO | psql: to_regclass NOT NULL, righe=0; gdpr_map_table_name='sys_auth_sessions' count=1 |
| Z-068 | W1 | Righe audit SDBI mai emesse (marker assente) | GIÀ-FATTO | audit.import_validation_results DROP in mig 000297; nota formale: provenance in sys_source_lineage_records |
| Z-078 | W1 | engagement_pulse_configs mai importato | GIÀ-FATTO | SOT_BACKLOG #7 CHIUSO + SDBI_PHASE2_CLOSURE.md: registry WON'T-DO con motivazione |
| Z-069 | W1 | Seed perf_feedback non ri-eseguibile (CSV_DIR) | SUPERATO | I12: seed archiviato in docs/archive/etl-brownfield-ritirato, temp_sdbi droppato S954 |
| Z-172 | W1 | Embedding provider unico, 1024 non documentato | VALIDO | 1024 documentato (mig 000060 + voyage-client.ts) ma makeEmbedder() hardcoded, no env seam |
| Z-254 | W1 | Disciplina rilascio @heuresys/ui (tag/gitHead/dual PM) | VALIDO | ux-design-shared: solo tag v0.4.0-brand-v1 (no v0.1.8/9); package-lock.json + ui/pnpm-lock.yaml |
| Z-231 | W1 | Contratto OpenAPI mai generato ne' pubblicato | VALIDO | no script openapi:generate; solo /openapi.json runtime, nessun artefatto/CI/drift-guard |
| Z-240 | W1 | CLAUDE.md layered, comprimere corpi estesi | VALIDO | wc -c CLAUDE.md=48840 (baseline 31302): cresciuto, non compresso |
| Z-212 | W1 | Batch doc-drift SoT (CLAUDE.md/README/roadmap/debt) | VALIDO | status_dashboard.py --strict: verdetto 11 RED (atlas stale, migration mismatch, lint FAIL) |
| Z-237 | W1 | CONTRIBUTING/ONBOARDING/runbook assenti | VALIDO | find root+docs: nessun CONTRIBUTING.md/ONBOARDING.md/RUNBOOK*.md |
| Z-215 | W1 | Chiusura formale 100X: KPI §7 + verdetto #9/10/11 | VALIDO | §7 solo bullet qualitativi senza misure/comandi; §9 stale "Prossimo: S-100X-A1" |
| Z-219 | W1 | Atlas curato stale (468 route, 276 tabelle) | VALIDO | ATLAS_CURATED.md: 83mod/468route/276tab/12ruoli vs live 108mod/405mig/245tab/14ruoli |
| Z-213 | W1 | SOT_STATE §1-9 mai ri-derivate (ferme S1006/7) | GIÀ-FATTO | SOT_STATE §0 ri-derivato a ogni sessione fino a S1096 (2026-09-12); tool aggiorna_numeri_sot.py |
| Z-214 | W1 | Riconciliare tracker 100X (TODO/BASELINE/etc) | VALIDO | TODO_100X.md 27 '- [ ]' aperte, stale da S997 (2026-06-19); BASELINE mai ri-misurato dal 2026-06-13 |
| Z-218 | W1 | Manca drift-check CI su prosa README/CLAUDE.md | VALIDO | grep su README/CLAUDE.md dentro handoff_lint.py: 0 check reali (solo commento dottrina) |
| Z-220 | W1 | Verdetti formali (3 condizioni + 4 Low) non in SoT | VALIDO | grep CONDITIONAL-GO/AUDIT-COND/AUDIT-LOW in SOT_BACKLOG+archivio: 0 risultati |
| Z-233 | W1 | ADR upstream mancanti (0008-0012) + UXIX proposed | VALIDO | ux-design-shared/governance: solo ADR-0001..0007; UXIX-0002/3/4 gia' Accepted ma ADR assenti |
| Z-238 | W1 | Policy upgrade/pinning dipendenze non documentata | VALIDO | nessun ADR trovato su pinning/upgrade; #66 e' altro tema (Dependabot queue, DONE) |
| Z-221 | W1 | Roadmap MVP-4 ancora DRAFT, AC non spuntate | VALIDO | docs/archive/MVP_4_ROADMAP.md: "Status: DRAFT" invariato, 21 '- [ ]' aperte |
| Z-223 | W1 | wave_runners W2/W3/W4: stato mai dichiarato | VALIDO | i 3 file wave_runners: tutti "Status: DRAFT", nessun superseded/storico |
| Z-239 | W1 | MEMORY.md non re-indicizzato (nodi vs link) | VALIDO | 98 file su disco = 98 link indice (riconciliato), ma memory/_archive non esiste |
| Z-136 | W1 | KPI: drill-down measurements su /kpis | VALIDO | grep: nessun drill-down UI in kpis/page.tsx, KpiMetrologyPanel non chiama :id/measurements |
| Z-144 | W1 | Duplicato FieldGrid mai promosso a @heuresys/ui | GIÀ-FATTO | detail-panel.tsx e' shim re-export da @heuresys/ui (0 duplicazione), pkg dichiara ^1.0.0 |
| Z-150 | W1 | Lead capture mai dimostrata live (sys_leads=0) | GIÀ-FATTO | psql: count(*)=6 righe reali (WEBSITE/DEMO/INVESTOR), admin UI /leads/page.tsx esiste |
| Z-135 | W1 | Gap closure: tab self piani chiusura su /me/gaps | VALIDO | API /v1/me/gaps/closure esiste (routes.ts:247) ma page.tsx (76 righe) non ha tab ne' la chiama |
| Z-152 | W1 | Brand v1: 5 refinement social media kit SK-1..SK-5 | VALIDO | git log: solo commit creazione+lint su generate-social-kit.mjs, nessun SK-1..5 nel file |
| Z-153 | W1 | Brand v1: favicon set/manifest assenti in PROD | VALIDO | curl: /favicon.ico=404, /site.webmanifest=307 redirect a /login |
| Z-255 | W1 | Git longpaths non impostato, 6 dir "Filename too long" | VALIDO | git config core.longpaths=non impostato; git status --ignored: 4 righe "Filename too long" |
| Z-006 | W1 | Runner self-hosted instabile, shutdown signal | VALIDO | gh run list: molti failure intermiste negli ultimi 10gg, nessuna serie di 10 successi consecutivi |
| Z-008 | W1 | Showcase axe/smoke mai in CI | VALIDO | showcase.yml fa solo deploy Pages, 0 occorrenze axe/smoke; spec esistono ma non girano in CI |
| Z-014 | W1 | Branch protection non verificata + branch stale | VALIDO | gh api branches/main/protection: 404 "Branch not protected"; 6 branch stale/dependabot su origin |
| Z-021 | W1 | linux-pc: 9 timer vs 2 previsti | NON-MISURABILE | ssh remoto vietato; script provisioning locale non decide lo stato reale del linux-pc |
| Z-033 | W1 | ux-design-shared: nessuna CI di qualita' | VALIDO | .github/workflows/ solo deploy-storybook.yml, nessun quality.yml nel repo |
| Z-031 | W1 | Monitor non-regressione ecosistema (5 asset WS-L) | VALIDO | grep/find: nessuno script "non-regress"/"monitor ecosistema"/"WS-L" nel repo |
| Z-032 | W1 | claude-mem disabilitato, stub bun-runner | VALIDO | ~/.claude/settings.json: "claude-mem@thedotmack": false tuttora presente (contraddice DEBT_REGISTER D-56 stantio) |
| Z-211 | W1 | E6 pattern portabili: metodo a11y + catalogo anti-pattern | VALIDO | DEVELOPMENT_LINES_E_EVO: E6 resta 2 righe descrittive, nessun catalogo committato, nessun WON'T-DO |
| Z-257 | W1 | Gate GDPR non copre 51 tabelle (filtro nome) | GIÀ-FATTO | test riscritto su FK graph (confdeltype), #183/mig 000304 (S1055); psql live: missing=[] su 76 subject-FK |
| Z-261 | W1 | MFA 7 account PROD aggirabile, segreti in chiaro | GIÀ-FATTO | file non contiene piu' segreti (#169 F3c); psql: 0 fattori label e2e-fixture, 159/159 label derived-access cifrati |
| Z-262 | W1 | Comando pnpm dev:login <email> | VALIDO | grep: nessun "dev:login" in alcun package.json o script del repo |
| Z-259 | W1 | Fuga preesistente export DSR (response_reviewer) | GIÀ-FATTO | repository.ts: guardia ACTOR-skip + projection withholding commentata "Z-259"; psql: reference_kind=ACTOR corretto |
| Z-260 | W1 | Dossier di contesto per revisori adversarial | VALIDO | pratica avviata 1 volta (.zp/prove/Z-259-contesto.md) ma nessun confronto misurato 2 corse consecutive |
| Z-258 | W1 | Ambito tenant: 3 classi, codice ne conosce 2 | VALIDO | teams/repository.ts:270 invariato (delete senza filtro tenant); nessun GLOBAL_TABLES/tenantless nel codice |
| Z-256 | W1 | similarPeople non filtra righe per sotto-albero | VALIDO | knnSimilarUsers filtra solo tenant_id (repository.ts:322), non sotto-albero organizzativo |
| Z-057 | W1 | Rate-limit 2-hop proxy da calibrare | GIÀ-FATTO | #242 (S1087): TRUST_PROXY=127.0.0.1,::1 in prod, numeric respinto, .env.example=false, test 5/5 |
| Z-039 | W1 | HSTS senza includeSubDomains | VALIDO | curl -sI heuresys.com: "Strict-Transport-Security: max-age=31536000" senza includeSubDomains |
| Z-249 | W1 | Due rossi semantici: text-destructive vs text-danger | VALIDO | StatusIcon (@heuresys/ui) ancora unico token; nessun ADR upstream trovato che unifichi i due |
| Z-252 | W1 | PaletteDropdown inerte + --font-sans aspirazionale | VALIDO | PaletteDropdown.tsx scrive ancora HSL su var esadecimali; "Exo 2" non caricato fuori da /showcase/typography |
| Z-253 | W1 | heuresys_ci mai rinfrescato da timer | VALIDO | ci-rehearsal.sh commento: "CONGELATO al provisioning"; nessun timer di refresh in deploy/systemd |
| Z-251 | W1 | Suite integrazione non regge contesa DB (pg_dump) | VALIDO | vitest.config.ts: hookTimeout invariato 30_000, nessun retry su connessione aggiunto |
| Z-111 | W1 | Contratto pool/isolate: 134 file closePool, no globalTeardown | VALIDO | vitest.config.ts: nessun globalTeardown dichiarato; grep closePool: 184 file lo referenziano ancora |
| Z-114 | W1 | Matrice coverage page.tsx↔spec Playwright mai prodotta | VALIDO | nessun file di coverage route↔spec trovato in repo (solo tool di coverage moduli/embedding, diversi) |
| Z-123 | W1 | Nessun test asserisce boot usi loader retrying | VALIDO | rbac-cache-boot-retry.test.ts testa solo la funzione isolata, non spia server.ts/start() |
| Z-167 | W2 | Wave engine INSERT...SELECT rinviato, path 47k mai esercitato | NON-MISURABILE | richiede run scrittura DB a scala reale; nessun report prima/dopo trovato nel repo |
| Z-173 | W2 | Refactor queries.ts per-pagina in hook riusabili | VALIDO | grep: 89 page.tsx sotto apps/web/src/app ancora con apiFetch/useQuery inline |
| Z-177 | W2 | Residui quick-win CLASS-A 100X mai chiusi | VALIDO | TODO_100X.md righe 82-109: QW-A1/A2/A4/B3/E2..E5/I1-I4 ancora `- [ ] TODO`, contraddicono riga 8 "Chiusi S994" |
| Z-161 | W2 | Duplicazione ActorContext/actor()/isPlatform + cap paginazione | GIÀ-FATTO | lib/actor.ts esiste, importato da 210 file; paginationFields(max,default) in packages/shared/_pagination.ts |
| Z-168 | W2 | me/repository.ts cresciuto a 1625 righe | VALIDO | wc -l apps/api/src/modules/me/repository.ts = 2165, ben sopra soglia 600 |
| Z-160 | W2 | D-03 subpath exports inutilizzate @heuresys/shared | VALIDO | package.json exports=119 chiavi; grep import "@heuresys/shared/*" nel repo = 4 subpath usati |
| Z-165 | W2 | Lint assente su showcase, finto su agent-gateway | VALIDO | agent-gateway lint="tsc --noEmit"; eslint.config.mjs riga 22 ignora "apps/showcase/**" |
| Z-163 | W2 | 17 'as any', 15 in helper isolamento transazionale | VALIDO | grep -c "as any" apps/api = 18 (soglia attesa ≤2); eslint-disable file-level ancora tx-isolation.ts:54 |
| Z-162 | W2 | Paginazione assente org-unit-processes/content-blueprint-links | VALIDO | grep limit/offset su routes+repository+service dei due moduli = 0 risultati |
| Z-169 | W2 | analytics org-network CTE ricorsiva ricalcolata ogni query | VALIDO | repository.ts:809 "WITH RECURSIVE scoped" invariato; nessun confronto EXPLAIN ANALYZE prima/dopo committato |
| Z-175 | W2 | Scaffold gen:module pattern 7-step mai creato | VALIDO | nessun "gen:module" in package.json; nessuno script scaffold trovato in scripts/ |
| Z-164 | W2 | 12 eslint-disable da rivedere, 2 rischiose | VALIDO | web: 6 eslint-disable (ridotti da 12) ma i 2 react-hooks/exhaustive-deps restano senza motivazione |
| Z-027 | W2 | Background job queue per wave runs assente | VALIDO | nessuna dip bullmq/pg-boss/bee-queue in apps/api/package.json; nessun pattern jobId per wave |
| Z-016 | W2 | Distributed tracing OpenTelemetry assente | VALIDO | grep -i opentelemetry apps/api/package.json = 0 risultati |
| Z-004 | W2 | Dependabot: smaltire le PR aperte | VALIDO | gh pr list --label dependencies --state open: 4 PR aperte (#87,#85,#84,#83) |
| Z-011 | W2 | Turbo affected-only per build/CI | VALIDO | nessun turbo.json nel repo; nessun riferimento "turbo" in package.json |
| Z-007 | W2 | Gate CI full-E2E assente, solo smoke in CI | VALIDO | playwright-integrale.yml: solo `workflow_dispatch`, nessun `schedule:`; ultimo run success 2026-09-07 |
| Z-009 | W2 | Workflow CI girano sul runner-VM di produzione | VALIDO | grep -c oci-vm: 6/12 workflow lo citano ancora (atlas-freshness, i18n-parity, lint, shell-tests, state-lint, typecheck) |
| Z-023 | W2 | PROD traccia main HEAD, non un tag semver | VALIDO | curl .../api/readyz → {"status":"ready","checks":...}, nessun campo versione esposto |
| Z-024 | W2 | vm-deploy self-modify buffer, unit nuove non installate | GIÀ-FATTO | vm-deploy.sh:140-155 re-exec guard gia' implementato (commit dd8d0bd, 2026-07-16) |
| Z-025 | W2 | Soglie scale-out non documentate, pgbouncer non verificato | VALIDO | deploy/README.md: solo porta 6432 elencata, nessuna soglia scale-out; verifica ssh non eseguibile da qui |
| Z-106 | W2 | Layer test frontend mai costruito (0 unit/component/msw) | VALIDO | apps/web vitest: 1 file, 7 test verdi (soglia ≥20); solo funzione pura, 0 componenti |
| Z-124 | W2 | QA E2E esaustivo multi-ruolo mai eseguito | VALIDO | nessun report web-qa-audit multi-profilo in docs/; solo qa_artifacts/x13_e2e_coverage_matrix.md (storico, altro perimetro) |
| Z-105 | W2 | Unit-layer API coperto solo su 3 moduli puri | GIÀ-FATTO | pnpm test:unit: 24 file, 220/221 test verdi senza tunnel DB (1 fallimento estraneo, in-progress su performance-reviews) |
| Z-108 | W2 | Suite accoppiata al DB via tunnel SSH, no DB effimero | VALIDO | nessun docker-compose/testcontainers/pg-mem nel repo; test integration restano DB-dipendenti |
| Z-107 | W2 | Test disattivati per env-gate e skip condizionali | VALIDO | f4-sweep.spec.ts ancora `test.skip(!SWEEP_ON)` (intero file gated); pattern skip condizionale su 16 spec |
| Z-116 | W2 | Copertura axe ferma a 35/107 route | VALIDO | PAGES_PER_PERSONA copre 36 route su 129 page.tsx reali oggi nel repo |
| Z-120 | W2 | Mutation testing statico mai eseguito | VALIDO | nessun tool stryker/mutation-testing nel repo (find negativo) |
| Z-126 | W2 | Manca gate ricorrente data-completeness DoD | VALIDO | nessun gate DoD-complete/backing trovato; solo check_completezza_self.py e completezza_tenant.py (concetti diversi, #117/E18) |
| Z-113 | W2 | Spec E2E mancanti: logout, replay negativo, 6 pagine | VALIDO | nessuno spec logout dedicato; approvals/[id], engagement/[surveyId], me/surveys/[surveyId] assenti in tests/e2e |
| Z-117 | W2 | Baseline a11y showcase ferma al 2026-05-20 | VALIDO | git log su showcase.json = 2026-05-20; showcase-a11y.spec.ts gatea solo critical, non serious |
| Z-121 | W2 | Nessun eval/golden-set per retrieval kNN | VALIDO | nessun file golden-set/recall@K trovato nel repo (find negativo) |
| Z-109 | W2 | Flake 500 login MFA step-2 suite integration | GIÀ-FATTO | DEBT_REGISTER D-55 RISOLTO S1029: root-cause deadlock, retry in withTransaction, 8 unit test committati |
| Z-115 | W2 | Checklist a11y manuale mai eseguita | VALIDO | docs/a11y-manual-checklist.md: grep "\[ \]" = 19/19 voci ancora non spuntate |
| Z-119 | W2 | apps/showcase ha ZERO test | VALIDO | showcase-a11y.spec.ts/showcase-smoke.spec.ts esistono ma showcase.yml non li esegue come gate |
| Z-122 | W2 | 45 file di test non esercitano il path HTTP | VALIDO | nessun elenco/triage dei 45 file committato in docs/ |
| Z-127 | W2 | Copertura test design system upstream sottile | VALIDO | ux-design-shared: 1 solo workflow CI, esegue solo `pnpm run test`, nessun passo axe-su-stories |
| Z-061 | W3 | Triage 37 tabelle sys.* a 0 righe nel registry | GIÀ-FATTO | psql: oggi 16 tabelle a 0 righe (non 37), tutte con resolved_status in v_reconciliation_status, 0 senza verdetto |
| Z-087 | W3 | 54 colonne JSONB non-metadata mai catalogate | VALIDO | psql: 72 colonne JSONB non-metadata, 0 indici GIN su jsonb; nessun catalogo committato trovato |
| Z-065 | W3 | Tabelle storia mai alimentate: org_unit/skill_req history | GIÀ-FATTO | psql: sys_organization_unit_history=246, sys_position_skill_requirement_history=181 righe; mig 000280 |
| Z-063 | W3 | Motore seed-acquisition mai eseguito end-to-end | GIÀ-FATTO | psql: sys_seed_acquisition_runs=16, approval_decisions=16, candidate_records=25, evidence=28, validation=140 |
| Z-072 | W3 | esco_skill_relations: lineage URI->UUID mai fatto | SUPERATO | I12: layer era nel wave-2 brownfield (etl-brownfield-ritirato/wave2), schema ritirato |
| Z-073 | W3 | CW-B36/CW-B37 REFERENCE_ONLY, deep-fix rimandato | SUPERATO | I12: schema 'brownfield' ritirato dall'information_schema, query column_mappings impossibile |
| Z-077 | W3 | sys_bonus_pools: 8/14 non importabili senza crosswalk | SUPERATO | psql: sys_bonus_pools=6/14; gap richiede crosswalk import legacy tenant, bloccato da I12 |
| Z-085 | W3 | 248 FK su 559 senza indice sulla leading column | GIÀ-FATTO | Backlog: S1042 CHIUSO (248→238 via 9 CONCURRENTLY, 112 su colonne vuote per design) |
| Z-089 | W3 | Partitioning sys_auth_login_events oltre 50M righe | VALIDO | psql: relkind='r' (non partizionata), 95.332 righe; nessuna soglia Prometheus trovata in grep |
| Z-104 | W3 | Pass query-perf/N+1 per-modulo mai eseguito | GIÀ-FATTO | Backlog: DONE S1028, GET /v1/observability/slow-queries (pg_stat_statements live) + fix reale 817ms→48ms |
| Z-064 | W3 | Blueprint runtime a zero: 0 attivazioni/override | GIÀ-FATTO | psql: sys_blueprint_activations=2, sys_blueprint_overrides=7 (non piu' 0) |
| Z-070 | W3 | Backfill live ESCO ~14k skill mai eseguito | GIÀ-FATTO | Backlog: T1.1 backfill ESEGUITO S990, skill_group_uri 0→12892/14011 |
| Z-079 | W3 | FK dichiarate ma mai applicate (skill_evidence, goals) | GIÀ-FATTO | psql: le 3 FK esistono e convalidated=true |
| Z-082 | W3 | Muri reconciliation NEEDS-DECISION (org-unit, learning) | GIÀ-FATTO | SOT_BACKLOG:897-898: "W3 learning-catalog ✅" e "W2 org-unit KPI template ✅" (mig 000061/000064) |
| Z-091 | W3 | P99 vista PIP mai misurato, promozione MATVIEW | VALIDO | grep: nessuna misura P99 ne' decisione MATVIEW trovata per sys_position_intelligence_profiles_v |
| Z-093 | W3 | ESCO occupation mapping: 25/137 job-role cablati | GIÀ-FATTO | psql: count(distinct esco_occupation_mapping_job_role_id)=176 su 176 job_roles totali (100%) |
| Z-095 | W3 | learning-gaps senza ricalcolo (solo CRUD+import) | VALIDO | grep: learning-gaps/routes.ts ha 6 endpoint, nessuno "recompute" |
| Z-096 | W3 | mentor match scores importati read-only | VALIDO | grep: mentorship/routes.ts match-scores solo GET (commento "read-only") |
| Z-097 | W3 | KPI achievement: nessun endpoint di scorecard | GIÀ-FATTO | grep: GET /v1/analytics/kpi (achievement rollup) con test in analytics.integration.test.ts |
| Z-059 | W3 | #69 Chiusura brownfield: drop staging.wave1_* + decommission VM | GIÀ-FATTO | commit 4251cf27 "#69 CHIUSA"; psql: schema staging ha 51 tabelle, nessuna wave1_ |
| Z-062 | W3 | Approval runtime a zero (sys_approval_requests/steps) | GIÀ-FATTO | psql: sys_approval_requests=768, sys_approval_steps=880 |
| Z-067 | W3 | 1000 check-in goal attribuiti ad admin hardcoded | VALIDO | psql: count(check_in_metadata ? 'subject_user_id_placeholder')=1000 |
| Z-075 | W3 | Import legacy gap_analysis_results rinviato | SUPERATO | I12: il criterio chiede import di righe dal legacy, rubinetto chiuso |
| Z-081 | W3 | succession_plans.position_id 100% NULL | GIÀ-FATTO | psql: sys.sys_succession_plans non esiste; SOT_BACKLOG "Wave-2/B-50 CHIUSI" |
| Z-083 | W3 | Brownfield Wave 1: 13/19 target, 3 silent-skip | GIÀ-FATTO | Backlog: i 3 silent-skip risolti/EXCLUDE terminale |
| Z-084 | W3 | Closure table organizzativa vuota, roll-up ricorsivo | VALIDO | psql: nessuna tabella *closure* organizzativa esiste; CTE ricorsiva ancora in uso |
| Z-080 | W3 | Perf feedback 9-box: gamba department/org_unit rinviata | VALIDO | grep: NineBoxListQuerySchema ha solo campo userId, nessun filtro organization_unit |
| Z-071 | W3 | LOOKUP_FK jsonb legacy_id: compilatore vs validatore | SUPERATO | I12: compilatore non piu' in codice attivo, schema brownfield sparito |
| Z-086 | W3 | Ricerca ILIKE su 31 repository, soli 2 indici GIN trgm | VALIDO | psql: solo 2 indici GIN trgm (sys_skills, sys_skill_aliases); cataloghi learning non coperti |
| Z-090 | W3 | Hard delete notifiche scadute, purge retention audit | NON-MISURABILE | ssh remoto (journalctl timer su VM) richiesto, non eseguibile da qui |
| Z-092 | W3 | legacy_mirror non copre tutte le sorgenti SDBI | SUPERATO | I12: estendere l'extract legacy a nuove macro-aree rimette in circolo dati brownfield |
| Z-094 | W3 | job_roles: 111/137 senza famiglia (family_id NULL) | VALIDO | psql: 110/176 sys_job_roles con job_role_family_id NULL (gap persiste) |
| Z-098 | W3 | sys_user_target_positions: 0 righe, nessun modulo API | GIÀ-FATTO | psql: 255 righe; grep: modulo user-target-positions/routes.ts, 6 endpoint |
| Z-099 | W3 | successor-readiness: nessuno scoring, INSERT da body | VALIDO | grep: successor-readiness/repository.ts riceve ancora "body.score ?? null" |
| Z-100 | W3 | process-kpi-templates: tabella vuota, gated su crosswalk | GIÀ-FATTO | psql: v_reconciliation_status.sys_process_kpi_templates resolved_status=POPULATED, has_rows=73 |
| Z-102 | W3 | position_economic_weight non popolato, MLCE su fallback | SUPERATO | mig 000227: colonna RITIRATA come base calcolo per decisione (#88) |
| Z-131 | W4 | C2 admin editing cataloghi + /job-catalog | GIÀ-FATTO | #43 DONE S1038 in SOT_BACKLOG_CHIUSI; job-catalog.spec.ts crea/patch job-role live |
| Z-130 | W4 | C1 admin editing People&Org | GIÀ-FATTO | #44 DONE S1038; organization-editing/users-editing/positions-editing.spec.ts fanno CRUD reale con login |
| Z-142 | W4 | LogStream/IncidentTimeline spente | GIÀ-FATTO | SystemHealthLive.tsx non le importa; commento dichiara "intentionally absent (no honest backend)" |
| Z-155 | W4 | Showcase audit Tier3 residuo | VALIDO | doc datato 2026-05-20, mai piu' modificato (git log) mentre 4 commit hanno toccato showcase dopo |
| Z-132 | W4 | C3 wizard materializzazione da archetipo | VALIDO | #45 DONE ma nota esplicita: "Non costruito: il wizard di materializzazione da archetipo" |
| Z-157 | W4 | /admin/roles CRUD reale | VALIDO | grep page.tsx: solo useQuery, zero POST/PATCH — pagina read-only confermata |
| Z-158 | W4 | Human approval gate UI import brownfield | SUPERATO | I12: nessun modulo/route "brownfield" esiste piu' in apps/api o apps/web |
| Z-159 | W4 | PWA manifest/service worker | VALIDO | nessun manifest.json/sw.js in apps/web; nessun WON'T-DO trovato in backlog/archivio |
| Z-128 | W4 | D-04 loading/error per-route | VALIDO | find: loading.tsx=1, error.tsx=2/129 pagine; chiusura S1041 solo 2 file generici, non per-route |
| Z-129 | W4 | Paginazione dialog + 5 campi mancanti | VALIDO | CareerPath.difficulty, BlueprintFamily.industryCode, BlueprintActivation.activatedAt assenti da packages/shared |
| Z-143 | W4 | MERGE_GROUPS hardcoded | VALIDO | grep MERGE_GROUPS section-tabs.tsx: 2 occorrenze, non 0 |
| Z-151 | W4 | Lead admin UI+honeypot+privacy+a11y | VALIDO | honeypot esiste ma senza observability; a11y fatto via axe (sostituto Lighthouse) |
| Z-138 | W4 | Drill per-position Essential Ranker | VALIDO | #55 DONE ma nota: "nessun contratto per-position esposto; se il prodotto lo vorra' e' un item nuovo" |
| Z-133 | W4 | Inbox SSE vs polling | GIÀ-FATTO | #38 DONE S1041 (trigger NOTIFY+SSE); grep INBOX_POLL_MS apps/web/src = 0 |
| Z-145 | W4 | 5 binding gap-codice E2E non-vuoti | VALIDO | test esistono ma titolati "empty state OK"/"empty or with rows", non asseriscono non-vuoto |
| Z-137 | W4 | Drill-down PIP /org-director | VALIDO | grep PIP/drill su org-director/page.tsx: solo commento F1, nessun drill PIP |
| Z-141 | W4 | Guardrail i18n su components | VALIDO | eslint.config.mjs regola scoped a apps/web/src/app/** only; SystemHealthLive.tsx ha stringhe EN hardcoded |
| Z-146 | W4 | 9 voci di sidebar disattivate ma raggiungibili | VALIDO | psql conferma 9 righe is_active=false; tutte le 9 page.tsx esistono ancora |
| Z-147 | W4 | 16 pagine showcase duplicate | VALIDO | apps/showcase esiste come workspace separato E apps/web/src/app/showcase ha ancora 18 page.tsx |
| Z-148 | W4 | 3 enum senza label + codici piattaforma | VALIDO | archivio S1025: "RESIDUO = worklist P2... label-layer enum, codici piattaforma" mai richiuso |
| Z-154 | W4 | Showcase skip-link+chrome polish | VALIDO | href="#main" gia' presente in layout, ma non verificato da showcase-a11y.spec.ts |
| Z-134 | W4 | EvidenceDrawer wiring 3 pagine | VALIDO | evidence-drawer.tsx esiste, usato solo in insights/skill-gap; assente da gaps/me-gaps/users |
| Z-140 | W4 | SystemHealthDashboard mock duplicato | VALIDO | grep: file duplicato identico in apps/web/src/components E apps/showcase/src/components |
| Z-149 | W4 | STATIC_FACTS investors page | VALIDO | grep STATIC_FACTS investors/page.tsx: 2 occorrenze; endpoint public-stats esiste ma non wired |
| Z-041 | W4 | Script authz esaustivo route×permission | VALIDO | nessuno script fra i check_*.py copre questo incrocio |
| Z-042 | W4 | 17 fp-check FALSE POSITIVE triati | VALIDO | FP_CHECK_VERIFICATION doc ha 24 righe F-0xx, DEBT_REGISTER ne cita solo 3 |
| Z-035 | W4 | Whistleblowing crypto app-level | VALIDO | repository.ts: whistleblowing_report_body plaintext, zero match "enc:v1:"/encrypt |
| Z-036 | W4 | Account lockout dopo N falliti | VALIDO | "lockout" esiste solo per MFA-OTP challenge, nessun ACCOUNT_LOCKED/423 su login generale |
| Z-037 | W4 | Rotazione chiave JWT | VALIDO | grep JWT_PRIVATE_KEY_PREVIOUS repo-wide: 0 match |
| Z-048 | W4 | audit.user_self_service_actions mai scritta | VALIDO | solo 1 SELECT, zero INSERT nel codebase |
| Z-038 | W4 | CSP fine-tuning per-route | VALIDO | 1 sola registrazione contentSecurityPolicy in app.ts, globale |
| Z-040 | W4 | Suite test security negativi | VALIDO | find apps/api/test: nessun file security.integration.test.ts |
| Z-046 | W4 | Test grant automatico TENANT_ADMIN | GIÀ-FATTO | rbac-tenant-admin-allowlist.test.ts implementa esattamente il guard (D-57 DONE) |
| Z-050 | W4 | 4 tabelle MFA runtime vuote | NON-MISURABILE | tunnel DB caduto a meta' sessione; criterio richiede comunque un enroll reale (scrittura) |
| Z-054 | W4 | Separazione ruoli DB app/migrator | VALIDO | grep heuresys_app/heuresys_migrator in db/: 0 match in tutto il repo |
| Z-055 | W4 | Rate-limit in-process (no store esterno) | VALIDO | app.ts: @fastify/rate-limit keyed su req.ip, nessuna opzione store/redis |
| Z-056 | W4 | Rate-limit per-tenant assente | VALIDO | grep rate-limit per-tenant repo-wide: 0 match |
| Z-047 | W4 | Refresh-token famiglie precedenti | VALIDO | revokeRefreshFamily chiamata solo su REPLAY_DETECTED/LOGOUT, non su re-login normale |
| Z-049 | W4 | Agent-gateway audit sink senza rotazione | VALIDO | audit-sink.ts commento: "under an external logrotate/retention policy" |
| Z-188 | W5 | #54/E5 Recruiting/ATS cluster /recruiting | GIÀ-FATTO | #54 DONE; 7 moduli/tabelle (requisitions/candidates/interviews/offers), E2E recruiting.spec.ts, /jobs pubblico |
| Z-208 | W5 | Integrazione llm_wiki + human-resources-plus | VALIDO | nessun piano/implementazione trovato oltre menzione in DREAM census (fuori scope canonical) |
| Z-186 | W5 | #50/D4 Knowledge graph legacy | GIÀ-FATTO | #50 DONE (rititolato "vista al grafo che abbiamo gia'"); pagina analytics/skills-graph con KGGraphCanvas |
| Z-191 | W5 | #58/F4 AI Advisor prescrittivo fase-1 | GIÀ-FATTO | psql: sys_advisor_suggestions=14 righe |
| Z-189 | W5 | #56/F2 VRIO scorecard /org-director/vrio | GIÀ-FATTO | #56 DONE; pagina + E2E vrio-scorecard.spec.ts esistono |
| Z-190 | W5 | #57/F3 OHI Organizational Health per OU | GIÀ-FATTO | #57 DONE; modulo org-health (api) + pagina org-director/health |
| Z-192 | W5 | E3 Time & Attendance console /attendance | VALIDO | DEVELOPMENT_LINES_E: "Serie E-E3 rinviata"; solo time-off+analytics/attendance view, no console overtime |
| Z-206 | W5 | WebSocket/SSE editing collaborativo visualization | VALIDO | grep websocket/socket.io/EventSource su visualization: solo use-inbox-stream (altro modulo, Z-133) |
| Z-185 | W5 | #49/D5 Employee timeline import | GIÀ-FATTO | #49 DONE; modulo user-timeline + tabella sys_user_timeline_events |
| Z-187 | W5 | #53/E4 Payroll ops read-extended | GIÀ-FATTO | #53 DONE in SOT_BACKLOG_CHIUSI |
| Z-197 | W5 | WI-D pilota blueprint-builder banca retail 8 step | VALIDO | SOT_BACKLOG: "WI-C/WI-D in pausa fino a riconciliazione" — blocked-on-Enzo, mai sciolto |
| Z-184 | W5 | #37/B2 Reward-gate engine sui 121 variable-pay | GIÀ-FATTO | psql: sys_reward_gate_results=3283 righe |
| Z-194 | W5 | CMS sys_content_media a 0 + residui P3 | VALIDO | psql: sys_content_media=0 righe, invariato |
| Z-183 | W5 | #36/B5 Visualization versioning + export reale | GIÀ-FATTO | psql: sys_visualization_exports=16, sys_visualization_layouts=2 |
| Z-193 | W5 | Approval effects oltre TIME_OFF_REQUEST | GIÀ-FATTO | registry effects/ ha gia' tenant-activation/materialization/blueprint-approval handlers |
| Z-198 | W5 | WI-B.2 agent-gateway compliance-guard/hr-verifier | VALIDO | grep: nessun compliance-guard/hr-verifier in apps/agent-gateway/src (solo audit-sink, redact) |
| Z-207 | W5 | HEU-FLOW-001 FASE 2 tenant onboarding mancante | VALIDO | nessuna evidenza di FASE 2 costruita oltre lo spec 2026-06-15 |
| Z-209 | W5 | Battle plan 03-localai mai eseguito | VALIDO | nessun servizio/doc battle-plan localai trovato nel repo |
| Z-196 | W5 | G6 Wiki advanced: refresh o declassamento | VALIDO | DEVELOPMENT_LINES_G ancora lista G6 come "refresh o declassamento esplicito" aperto |
| Z-181 | W5 | B4 EMAIL digest+OTP+preferenze (dep Z-180) | VALIDO | psql: sys_notification_preferences=0 righe; dipendenza Z-180 (segreto) non sciolta |
| Z-242 | W6 | GDPR documentale assente (RoPA, DPIA) | VALIDO | git ls-files: nessun file ropa/dpia nel repo |
| Z-243 | W6 | Classificazione AI Act Annex III mai prodotta | VALIDO | nessun documento di classificazione AI Act trovato in docs |
| Z-245 | W6 | Nessun DPA sub-processor, infra free-tier | VALIDO | nessun DPA nel repo; verifica intestazione account OCI non eseguibile da qui |
| Z-244 | W6 | SBOM/license-attribution mai generati | VALIDO | git ls-files: nessun artefatto SBOM/CycloneDX nel repo |
| Z-248 | W6 | Verdetto acquirente 'spietato' mai riconciliato | VALIDO | SCORECARD_ACQUIRER_RUTHLESS.md citato in #3 ma nessun verdetto accept/reject registrato |
| Z-247 | W6 | Domande founder Q1-Q8 mai risposte | VALIDO | 01_DISCOVERY.md: le 8 righe sono "assunzioni di lavoro in assenza di risposta", non risposte reali |
| Z-241 | W6 | Bus factor = 1, nessun secondo sviluppatore | VALIDO | git shortlog --since="3 months ago": solo Enzo Spenuso (1738) + org Spen-Zosky (21, stesso founder) |
| Z-246 | W6 | Nessun pilota cliente reale firmato | VALIDO | psql: solo 2 tenant ACTIVE (RTL Bank, Heuresys System), nessun cliente esterno aggiunto |
| Z-060 | W6 | #17 Wave-3 onboarding tenant legacy non-banking | VALIDO | psql: sys_tenancies ACTIVE=2 (non ≥3); nessun SmartFood/EcoNova onboardato |
| Z-074 | W6 | Tassonomia skill hard/soft, 14010/14041 senza categoria | VALIDO | psql: 14000 skill ancora con skill_category_id NULL (invariato) |
| Z-076 | W6 | Import legacy succession pools/candidates rinviato | SUPERATO | I12: il criterio chiede import di righe dal legacy, rubinetto chiuso |
| Z-101 | W6 | RACI produzione: modello seed demo 'NOT production truth' | GIÀ-FATTO | psql metadata: "Approved production RACI mapping on RTL_BANK ... supersedes S994 demo crosswalk" |
| Z-103 | W6 | Crosswalk ISCO-08 <-> CP2021 vuoto | VALIDO | psql: sys_occupation_classification_mappings=0 righe, invariato |
| Z-222 | W6 | Decision log MVP-4 (RD-29/32, Q-MVP4-01..10) mai deciso | VALIDO | nessun decision log MVP-4 trovato in docs |
| Z-026 | W6 | Migrazione PostgreSQL managed + runtime HA | VALIDO | nessun docs/architecture/OCI_MANAGED_MIGRATION_PLAN.md trovato |
| Z-028 | W6 | Archiviazione off-disk 27 dump pre-op | VALIDO | du -sh pg_dump_snapshots/ = 3.7G, invariato (soglia attesa <500M) |
| Z-205 | W6 | Promessa 'BPM' senza runtime generico | VALIDO | naming BPM ancora in README/PRD; nessun modulo process-instance/task-inbox |
| Z-182 | W6 | #16 SuccessFactors sandbox reale mai fatto | VALIDO | psql: nessuna tabella staging.sf_* esistente |
| Z-210 | W6 | Layer commerciale signup/billing assente | VALIDO | nessuna route/modulo signup o billing trovato in apps/web o apps/api |
| Z-199 | W6 | WI-D1 bulk-apply lineage-imitating rinviato | VALIDO | stessa evidenza di Z-197: WI-D in pausa, blocked-on-Enzo |
| Z-200 | W6 | WI-D3 recommender typing->variant rinviato | VALIDO | stessa evidenza di Z-197: WI-D in pausa, blocked-on-Enzo |
| Z-179 | W6 | #4 Pricing page: servono importi/piani reali | VALIDO | nessuna route /pricing trovata; backlog conferma blocked-on-Enzo |
| Z-201 | W6 | agent-gateway non deployato in PROD | VALIDO | nessuna unit systemd agent-gateway in deploy/systemd |
| Z-204 | W6 | Predictions/'AI-ML' da riposizionare | GIÀ-FATTO | BUSINESS_SCOPE_AND_PRD gia' riposizionato: "non ML black-box", "non ML", "no real ML" come wedge esplicito |
| Z-195 | W6 | #41 graphify: 26 chunk mancanti mai completati | VALIDO | graphify-out/PENDING_SEMANTIC_TOPUP.md ancora con 201 file pendenti |
| Z-180 | W6 | #8 EMAIL dormiente: app-password Outlook mancante | VALIDO | smtp-mailer.ts esiste ma nessuna prova di invio reale/app-password configurata |
| Z-202 | W6 | Rubrica Maturity L0-L5: cutoff senza sign-off | GIÀ-FATTO | rubric.ts versionato (RUBRICS registry) + SOT_STATE: v1-full gia' scelta da Enzo |
| Z-052 | W6 | Hardening commerciale: pentest/OWASP ASVS/k6 | VALIDO | nessun report pentest o script k6 trovato nel repo |
| Z-045 | W6 | SSO enterprise OIDC (Azure AD/Google) | VALIDO | nessuno spec/test SSO/OIDC trovato in apps/web/tests/e2e |
| Z-118 | W6 | 4 classi a11y out-of-scope mai riprese | VALIDO | nessun report firmato keyboard/screen-reader/forced-colors/WCAG-AAA trovato |

---

## Riepilogo numerico

### Per verdetto (216 cluster aperti)

| Verdetto | Conteggio | % |
|---|---:|---:|
| GIÀ-FATTO | 49 | 22.7% |
| SUPERATO | 10 | 4.6% |
| VALIDO | 153 | 70.8% |
| NON-MISURABILE | 4 | 1.9% |

### Per ondata

| Ondata | Aperti | GIÀ-FATTO | SUPERATO | VALIDO | NON-MISURABILE |
|---|---:|---:|---:|---:|---:|
| W0 | 1 | 1 | 0 | 0 | 0 |
| W1 | 53 | 9 | 1 | 42 | 1 |
| W2 | 37 | 4 | 0 | 32 | 1 |
| W3 | 36 | 17 | 7 | 11 | 1 |
| W4 | 39 | 5 | 1 | 32 | 1 |
| W5 | 20 | 10 | 0 | 10 | 0 |
| W6 | 30 | 3 | 1 | 26 | 0 |
| **Totale** | **216** | **49** | **10** | **153** | **4** |

### Elenco Z-id VALIDI per ondata, con somma ore dichiarate

**W0**: nessuno (0.0h)

**W1** (42 cluster, **84.7h**):
Z-006(2.0h) Z-008(2.0h) Z-014(2.0h) Z-031(1.0h) Z-032(1.0h) Z-033(2.0h) Z-039(0.2h) Z-066(1.5h) Z-088(2.0h) Z-111(2.0h) Z-114(2.0h) Z-123(1.0h) Z-135(1.5h) Z-136(2.0h) Z-152(1.5h) Z-153(1.0h) Z-172(2.0h) Z-211(2.0h) Z-212(4.0h) Z-214(2.0h) Z-215(3.0h) Z-218(2.0h) Z-219(3.0h) Z-220(2.0h) Z-221(1.5h) Z-223(1.5h) Z-231(6.0h) Z-233(2.0h) Z-237(4.0h) Z-238(2.0h) Z-239(1.0h) Z-240(6.0h) Z-249(1.5h) Z-251(2.0h) Z-252(2.0h) Z-253(1.5h) Z-254(1.5h) Z-255(0.5h) Z-256(1.5h) Z-258(3.0h) Z-260(1.0h) Z-262(1.5h)

**W2** (32 cluster, **169.0h**):
Z-004(6.0h) Z-007(3.0h) Z-009(3.0h) Z-011(6.0h) Z-016(8.0h) Z-023(3.0h) Z-025(3.0h) Z-027(10.0h) Z-106(12.0h) Z-107(6.0h) Z-108(8.0h) Z-113(4.0h) Z-115(3.0h) Z-116(6.0h) Z-117(4.0h) Z-119(3.0h) Z-120(6.0h) Z-121(4.0h) Z-122(3.0h) Z-124(9.0h) Z-126(5.0h) Z-127(3.0h) Z-160(5.0h) Z-162(3.0h) Z-163(3.5h) Z-164(2.5h) Z-165(4.0h) Z-168(6.0h) Z-169(3.0h) Z-173(12.0h) Z-175(3.0h) Z-177(9.0h)

**W3** (11 cluster, **49.5h**):
Z-067(4.0h) Z-080(3.5h) Z-084(4.0h) Z-086(3.0h) Z-087(8.0h) Z-089(6.0h) Z-091(5.0h) Z-094(3.0h) Z-095(5.0h) Z-096(5.0h) Z-099(3.0h)

**W4** (32 cluster, **153.0h**):
Z-035(5.0h) Z-036(5.0h) Z-037(5.0h) Z-038(4.0h) Z-040(4.0h) Z-041(6.0h) Z-042(6.0h) Z-047(3.0h) Z-048(5.0h) Z-049(2.5h) Z-054(4.0h) Z-055(4.0h) Z-056(4.0h) Z-128(6.0h) Z-129(6.0h) Z-132(9.0h) Z-134(2.5h) Z-137(3.0h) Z-138(5.0h) Z-140(2.5h) Z-141(3.0h) Z-143(6.0h) Z-145(4.0h) Z-146(3.0h) Z-147(3.0h) Z-148(3.0h) Z-149(2.5h) Z-151(6.0h) Z-154(3.0h) Z-155(10.0h) Z-157(9.0h) Z-159(9.0h)

**W5** (10 cluster, **81.0h**):
Z-181(3.0h) Z-192(10.0h) Z-194(8.0h) Z-196(5.0h) Z-197(9.0h) Z-198(6.0h) Z-206(10.0h) Z-207(6.0h) Z-208(18.0h) Z-209(6.0h)

**W6** (26 cluster, **437.0h**):
Z-026(80.0h) Z-028(1.0h) Z-045(14.0h) Z-052(60.0h) Z-060(24.0h) Z-074(5.0h) Z-103(3.0h) Z-118(8.0h) Z-179(6.0h) Z-180(0.5h) Z-182(40.0h) Z-195(1.0h) Z-199(10.0h) Z-200(8.0h) Z-201(4.0h) Z-205(60.0h) Z-210(40.0h) Z-222(5.0h) Z-241(0.0h) Z-242(40.0h) Z-243(16.0h) Z-244(2.0h) Z-245(8.0h) Z-246(0.0h) Z-247(0.5h) Z-248(1.0h)

**Totale VALIDO: 153 cluster, 974.2h** (~162 sessioni da 6h) — è il residuo reale del piano oggi, al netto di quanto già fatto o superato dalla dottrina.

---

## Osservazioni di metodo (non richieste esplicitamente, ma rilevanti per il prossimo ciclo)

1. **Quasi un quarto del piano (49/216, 22.7%) era già chiuso da lavoro successivo mai riconciliato nel piano stesso.** La causa più frequente: il register `SOT_BACKLOG.md`/`docs/archive/SOT_BACKLOG_CHIUSI.md` ha chiuso l'item equivalente (spesso con un `#nn` diverso e un nome diverso da quello del cluster Z-nnn) senza mai spuntare la casella corrispondente in questo piano.
2. **10 cluster sono SUPERATI**, quasi tutti in W1 e W3, e quasi tutti per la stessa ragione: I12 (rubinetto brownfield chiuso, 2026-08-14) rende senza oggetto ogni criterio che chiede un import letterale di righe dal DB legacy o una riparazione di mapping nello schema `brownfield`, ormai ritirato.
3. **W6 resta il più pesante in ore (437h su 446h originali) ma quasi tutto VALIDO**, cioè quasi nulla si è sbloccato da solo in due mesi — coerente col fatto che sono voci `decisione-business`/`esterno`/`segreto`: non si sciolgono senza un intervento di Enzo o un evento esterno (cliente, DPA, pentest).
4. **4 cluster NON-MISURABILI** (Z-021, Z-090 — richiedono SSH al linux-pc/VM; Z-050, Z-167 — richiedono una scrittura reale sul DB) restano da verificare in una sessione con accesso a quei canali.
5. Un solo lotto di verifica (W5+W6) ha dovuto essere completato direttamente da questa sessione perché il sub-agente assegnato è rimasto bloccato in un loop del gate di fine-turno del repository (`verify_gate.py`, che include `migrate-idempotent` — scrive su produzione — e richiede SSH), estraneo al mandato di sola lettura di questo compito: il gate non è mai stato eseguito, come da vincoli assegnati.

---

## Fasi (la sessione preliminare che `#76` aspettava)

- [x] **F1 Verificare i 216 cluster aperti uno per uno** — **fatto =** ogni cluster porta un verdetto con evidenza — FATTA 2026-09-12 (S1097, agente Sonnet delegato, 345k token, 60 tool call; 4 NON-MISURABILI dichiarati, non taciuti): **49 GIÀ-FATTO · 10 SUPERATO · 153 VALIDO (974,2 h) · 4 NON-MISURABILI**
- [x] **F2 Riportare i verdetti nel piano** — FATTA 2026-09-13 (S1098): le 49 GIÀ-FATTO e i 10 SUPERATI spuntati nel piano (`- [x]` + riga `✅ CHIUSO/SUPERATO S1098 — verdetto … : <evidenza>`), 59/59 trovati, 0 mancanti, 0 già chiusi; i 4 NON-MISURABILI restano aperti e dichiarati; la tabella delle ondate non porta più il conteggio dei chiusi (era già falso). `zp_state.py piano` dopo: **262 totali · 105 chiusi · 157 aperti** (131 autonomi = 558 h, 26 su Enzo) — era 216 aperti / 186 autonomi = 904 h
- [ ] **F3 L'esecuzione a ondate, un cluster per volta** — **fatto =** `zp_state.py piano` → 0 aperti autonomi. Non è lavoro di una sessione canonical: lo esegue il driver `scripts/zero-pending-driver.sh` (skill `zero-pending-loop`) in sessioni dedicate, cluster per cluster con due prove e tre revisori. Qui si riporta solo il conteggio quando cambia: al 2026-09-13 **157 aperti · 131 autonomi (558 h) · 26 su Enzo** (ri-misurato in S1099, invariato: nessuna ondata è girata nel frattempo; il driver non si accende in parallelo a una sessione canonical — contesa DB `Z251`, finestra 5h unica)
