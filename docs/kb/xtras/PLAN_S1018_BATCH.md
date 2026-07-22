# Programma S1018 — Batch autonomo "livello superiore" (ultracode)

> **Provenienza + esecuzione locale (S1019)**: piano nato come plan-file di sessione sulla VM (batch S1018, eseguito lì in deroga alla regola local-first); ora **versionato nel repo** e ripreso in locale. Indice di stato: `docs/kb/RESUME_S1018_BATCH.md` (autoritativo su cosa è FATTO/DA FARE — riparti da lì). Adattamenti per l'esecuzione dal PC locale: DB = stesso DB VM via tunnel `:5433` (boot hook lo verifica); `nvm use 22` non serve (Windows ha Node 24; per Playwright usare i wrapper `test:e2e*:node22`, D-36); porte live-E2E locali = **:3400 web / :3401 api** (regola RESUME, che supersede i :3001/:3000 citati sotto); i servizi PROD :8013/:3013 restano MAI toccati fino a W13. La sezione "Ambiente" sottostante descrive il contesto VM originale ed è mantenuta come record.

## Context

Enzo ha chiesto un batch autonomo senza presidio che esegua **tutte le attività pending, i debiti e i dossier** di heuresys-advanced, con decisioni operative prese da Claude (best practices, evidence-based) e interview preventiva completata. Obiettivo: portare il progetto al livello superiore lasciando ogni item chiuso con DoD live E2E (ADR-0026), commit atomici pushati, register/SoT aggiornati.

**Ambiente**: siamo SULLA VM OCI di produzione (`/home/ubuntu/heuresys-advanced`, aarch64). DB nativo `localhost:5432`. Servizi PROD systemd api :8013 / web :3013 girano da dist builds (editare sorgenti non li tocca fino a rebuild). Shell a Node 20 → **`nvm use 22` obbligatorio** prima di build/test. Playwright chromium installato. `VOYAGE_API_KEY` e `MATCHING_FREETEXT_ENABLED` presenti in `.env`.

## Decisioni di Enzo (interview, vincolanti per la sessione)

| Decisione | Valore |
|---|---|
| Scope dossier | C + D + G convertiti ed eseguiti; **E ed F inclusi** (sfida esplicita all'esclusione) |
| Voyage runtime (#40) | **AUTORIZZATO** → #40 GATED→ACTIVE |
| App-password Outlook (#8/#39) | non fornita → #39 resta GATED |
| Pricing (#4) | numeri non forniti → pricing page resta in attesa |
| Push/deploy | **push per item; deploy PROD solo a fine batch** |
| HOLD riattivate | #4-deferrals GTM · **#24 F4 con activity entities = riuso goals/approvals** · #9-11 audit 100X |
| F5 self-view | **TUTTO visibile** (capability + flight-risk al dipendente, con evidenze) → supersede D-6 via decision-log |
| E3 ESS-write time-off | **NO** — resta solo lettura (#33) |
| E1 whistleblowing | **SÌ** con ruolo WHISTLEBLOWING_CUSTODIAN dedicato + nuovo ADR-0028 |
| E5 ATS | in coda al batch (penultima wave) |
| E2 SSO | WAIT-INPUT (serve client ID/secret IdP di Enzo) — escluso |
| Decisioni residue in-batch | delegate a Claude (batch-delegation mode): triage dossier 100X secondo le raccomandazioni dei dossier; trade-off genuinamente bilanciati → registrati come deferred con rationale, mai indovinati |

## Regole di esecuzione (tutto il programma)

1. **Per item**: pattern modulo 7-step → typecheck+lint+test verdi → **live E2E su app buildato localmente** (porte test :3001/:3000, MAI toccare :8013/:3013) con login persona reale → commit atomico → **push** → aggiornare lo stato dell'item nel register (blocco strutturato).
2. **Migrazioni**: SOLO additive/backward-compatible col dist PROD in esecuzione (nessun destructive alter durante il batch). Numerazione: **next-free-number al momento dell'esecuzione** (i blocchi 000170/000185/000200 dei blueprint sono convenzioni di pianificazione). Ogni nuova risorsa sensibile va in `RESOURCE_DATA_CLASS` nello STESSO commit del seed (D-51 + drift test).
3. **Nuove pagine liste**: adottano da subito il pattern paginazione server-side (fondazione W0) — mai `?limit=200` hardcoded.
4. **Contratto #26↔F4**: autorizzazione per-goal/per-okr in UN solo helper (`canReadGoal(actor, goalRow)` / `canReadOkr`) attraversato da tutti i sub-resource — F4 poi sostituisce un corpo di funzione, non 5 moduli.
5. **RBAC cache**: il PROD in esecuzione non vede i nuovi permessi fino al restart finale — irrilevante (live E2E su build locale); restart a fine batch.
6. **Orchestrazione ultracode**: implementazione seriale per item (contention su migrations/app.ts/shared-index); Workflow multi-agente per verifica adversariale per-item (lenti: correctness/security-RBAC/i18n/DoD-live), ricerche e audit. Task tracking via TaskCreate per wave.
7. **Segreti**: mai valori in context/commit; `.env.bak-20260708T030557Z` NON si tocca.
8. **Fail-loud**: CI rossa o test rosso = da fixare subito (R3); mai `--no-verify`.

## Wave plan (ordine corretto da design-review)

### W0 — Preflight + fondamenta + security hardening (~0.5-1g)
- `nvm use 22`; `pnpm install` se serve; baseline verde (typecheck/lint/test rapidi).
- **Conversione register**: serie C/D/E/F/G → blocchi Action register in `SOT_BACKLOG.md` (#42+); status updates: #40 GATED→ACTIVE, HOLD #4-def/#24/#9-11 → ACTIVE, E2 → WAIT-INPUT. Commit `docs(backlog)`.
- **Verifica 4 TRUE-POSITIVE** dell'audit 2026-07-03 (`docs/kb/full-forensic-audit/INDEX.md:5-25`): F-001 default admin pwd (già fixato per CLAUDE.md — verificare), open-redirect login, CSV/DDE injection export, fork-PR sul runner self-hosted PROD. Fix immediato dei residui (piccoli).
- **D-08 core** (dal dossier 100X, ~1-2h, massimo valore): pg_dump pre-deploy + LAST_GOOD/rollback + probe-gate in `vm-deploy.sh` — protegge il deploy finale dell'intero batch.
- **C4-mini**: helper condiviso list-query (limit/offset/filtri) + wiring DataTable — il pattern che tutte le nuove pagine del batch adottano.

### W1 — Serie A P1 (ordine: #40 → D-54 → #26 → #31 → #30 → #27 → #28)
Blueprint completo in conversazione (agente P1); essenziali:
- **#40** free-text search: flag già ON in .env — solo UI wiring `/me/matching` + `/skills` (box ricerca, submit esplicito per il cap 30/min) + `.env.example` nota. Nessuna migration.
- **D-54**: helper `lib/notifications/cleanup.ts` + withTransaction nei delete di learning-modules e kpi-definitions (uniche hard-delete site verificate) + migration purge one-time + test su `v_inbox_resource_consistency=0`.
- **#26** goals/OKR life: sub-read `/v1/goals/:id/{updates,check-ins,milestones,comments}`, `/goals/templates`, `/goals/:id/alignments`, `/v1/okrs/:id/check-ins`, `/v1/me/goals/:goalId/timeline`. orgGate `service` (EVALUATION), comments privati esclusi salvo autore/tenant-scope. **Helper unico canReadGoal/canReadOkr (contratto F4)**. Timeline UI (Timeline/TimelineEvent da @heuresys/ui) in goals/okrs admin + `/me/career`. Nessuna migration.
- **#31** KPI metrology: sub-read methods(5)/weighting-rules(3)/`:id/metrics`/`:id/measurements` (orgGate service su user); panel Metrologia in `/kpis` + `/positions/[id]/kpis`. Nessuna migration. Gotcha: cataloghi globali senza tenant column.
- **#30** gap closure: closure-plans/analysis-results/`:id/closure-actions` + `/v1/me/gaps/closure`; tab "Piani di chiusura" in `/gaps` + `/me/gaps`. Nessuna migration. Gotcha: plans keyed user+position, NON gap.
- **#27** evidence layer ⭐: nuovo modulo `evidence` — `GET /v1/evidence/subject/:userId`, `/v1/evidence/for-score?scoreType&scoreId` (LEARNING_GAP/SKILL_GAP_SCORE/SUCCESSION_READINESS_SCORE/FLIGHT_RISK_SCORE), `/v1/me/evidence`. EvidenceItem unificato su 9 tabelle sorgente via UNION ALL + LEFT JOIN lineage (provenance: mappingConfidence, sdbiAiModelId, sdbiHumanApprover, validationStatus). `evidence: "EVALUATION"` in data-classes. Migration seed `evidence:read` (6 ruoli elevated) + `evidence:read:self`. EvidenceDrawer in insights/skill-gap/gaps/me-gaps/users. Gotcha: 360 anonime → assessorUserId null; continuous_feedback visibility policy documentata nel service.
- **#28** provenance ⭐: nuovo modulo — `GET /v1/provenance` (filtri table/run/status/confidence, paginato ≤200) + `/summary` (GROUP BY). Perm `provenance:read` solo PLATFORM/TENANT_ADMIN; niente data-class (metadata di record, commento D-51 nel routes). **Nuova pagina `/provenance`** (KPIStrip + tabelle) + ui_interfaces OVERVIEW. Angolo AI-Act/GTM.

### W2 — Serie A P2/P3 (#29 → #32 → #33)
- **#29** talent-review: modulo nuovo — nine-box derivata da `sys_talent_scores` (DISTINCT ON latest per user, bucket via band o soglie 33/66 — VIEW `sys_nine_box_grid` esiste ma sparsa, non riusarla ciecamente), readiness per orizzonte, fit, critical-positions (aggregate). Perm `talent_review:read` (leadership: PA/TA/HRMS/MANAGER/CEO/ORG_DIRECTOR, **no self-view**). Nuova pagina `/talent-review` (tier17: SuccessionCard, SkillHeatmap, CareerArc) + ui_interfaces WORKFORCE. `talent_review: "EVALUATION"`.
- **#32** comp read: estendere compensation — variable-pay/recommendations (orgGate service), bonus-pools (aggregate), reward-rules/economic-weights (catalog), **handoff-records** (solo scope all|tenant — I21; MANAGER 403). Panels in `/compensation-intelligence`. Mai payload variable-pay a scope subtree. Nessuna migration.
- **#33** time-off: modulo nuovo read-only — requests/accrual-rules/balance-transactions + `/v1/me/time-off/requests`. `time_off: "PERSONAL"`; perm `time_off:read` (PA/TA/HRMS/MANAGER) + `:self`. Tab in `/me` Presenze + panel `/analytics/attendance`. Gotcha: transactions filtrate via JOIN balances.

### W3 — Serie B (#34 → #37 → #36 → #38 → #35), blueprint agente P2
- **#34** approval effects: handler `TENANT_MATERIALIZATION` (compone `tmRepo.materialize` nel txn di approve; `POST /v1/tenant-materialization/requests`) + handler `COMPENSATION_RECOMMENDATION` (PROPOSED→APPROVED state-guarded; `POST /v1/compensation/recommendations/:id/submit-for-approval`). Estendere `insertRequest` con metadata (colonna esiste già). Guard anti-duplicato su richieste aperte stesso resource. Live E2E: flusso completo create→inbox→approve→apply.
- **#37** reward-gate engine: `compensation/engine.ts` — regole deterministiche per i 7 catalog code (CERTIFICATION da user_certifications, TRAINING da learning-gaps severity, RISK/COMPLIANCE da kpi evidence ratio; CONDUCT/HARM/AUDIT = PASSED basis NO_ADVERSE_EVENTS — onesto, no dati fabbricati). `POST /v1/compensation/reward-gates/evaluate` batch set-based (121 calc × 7 gate), idempotente (unique index migration + dedupe results). Payload spiegabile (inputs/thresholds/basis). UI panel + explain in `/compensation-intelligence`.
- **#36** viz versioning+export: `POST/GET /v1/visualization-graphs/:id/versions` (clone con remap nodi/edge); export engine server-side GENERIC_JSON + MERMAID + SVG hand-rolled (~150 righe, zero deps; PNG escluso, documentato); `GET /v1/visualization-exports/:id/download` (content-disposition, path solo da DB row); colonna `export_status` (migration); `EXPORT_STORAGE_DIR` default `.data/exports`. Version selector + export buttons in `/visualizations/[graphId]`.
- **#38** inbox SSE: `lib/notifications/bus.ts` (EventEmitter in-process, caveat multi-instance documentato) tap in `emit.ts`; `GET /v1/me/inbox/stream` (reply.hijack, heartbeat 25s, rate-limit esente, cap 3 stream/utente); hook web `use-inbox-stream` (EventSource + invalidateQueries + fallback polling 30s). Test su porta reale (opt-out tx-isolation documentato).
- **#35** observability: `/metrics` Prometheus **hand-rolled** (no prom-client — motivato), slow-queries da pg_stat_statements (verificato: ruolo heuresys legge le proprie query, NO grant), log-ring in-process (tee stream pino), incidents derivati dal ring, request-timeseries 96×15min. Re-light 4 sezioni `SystemHealthLive.tsx`. Gates su `tenant:create` finché G2 non normalizza (poi `observability:read`).

### W4 — GTM deferrals
(a) lead admin UI: GET /v1/leads filtrato/paginato (assorbe G3-leads) + `PATCH /:id` status + pagina `/admin/leads` + perm `leads:update` + ui_interfaces; (b) honeypot-trip counter in-memory + `GET /v1/leads/stats` + stat card; (c) `/privacy` contenuto reale IT/EN (processing effettivo: lead form, cookie auth HttpOnly, no analytics, retention, diritti); (d) a11y audit landing (chrome-devtools MCP Lighthouse ≥95 su `/`, `/investors`, `/demo`, `/login`) + fix.

### W5 — Serie G igiene (G2 → G3 → G1 → G5)
- **G2**: 6 nuovi perm `:delete` (27 route DELETE oggi su `:update` — enumerazione verificata: enterprise_typing, career_succession, gap_analysis, bpm_process, skill, visualization) + grants specchiati dalle audience live; normalizzazione proxy (observability:read, tenant_materialization:*, role-matrix); gate hardcoded PLATFORM_ADMIN → matrice. Regola: tutti i moduli successivi nascono con perm dedicati.
- **G3**: acyclicity IS_A (WITH RECURSIVE, 422 SKILL_TAXONOMY_CYCLE), warn INSIGHTS_SCAN_TRUNCATED sui LIMIT 5000, dual-shape check.
- **G1** (destructive-adjacent, snapshot PRIMA): archive+prune `audit.import_validation_results` (keep failures+90d, ~-500MB), VACUUM FULL documentato come op manuale off-hours, tighten auth retention 180→90d, script staging-truncate gated CONFIRM=1 (temp_sdbi: print-only), rotazione report align keep-last-20.
- **G5**: `git mv` script esausti → `docs/archive/scripts/` + README (move-not-delete; lista nel blueprint — conferma per-file nel commit body). G4 → handoff finale; G6 → note.

### W6 — Serie C admin editing (C4-full → C2 → C1 → C3)
Dossier `DEVELOPMENT_LINES_C_ADMIN_EDITING_UI.md` (design dettagliato a inizio wave — le write API esistono già, gap quasi solo frontend): C4 retrofit paginazione ~20 pagine esistenti + refactor shared-types (62/87 schemi senza consumer tipizzato) + apiFetch FormData; C2 cataloghi + nuova pagina `/job-catalog`; C1 people&org CRUD; C3 tenant&platform. DoD: ogni form provato con edit reale su RTL Bank.

### W7 — Serie D legacy wave-2 (D1 → D2 → D3 → D5 → D4 + import comp per E4)
Dossier `DEVELOPMENT_LINES_D_WAVE2_LEGACY_DATA.md`. Metodo registry-first wave=2, chiave I14 `LEGACY_EMP::`. D1 skill possession ⭐; D2 engagement/PULSAR (sblocca flight-risk pieno + fix dual-shape — regression recompute before/after su `sys_flight_risk_scores`); D3 goal history (**ri-eseguire E2E #26 come regression**); D5 timeline; D4 knowledge-graph (destination design). Fonte legacy: PG nativo `heuresys_platform` su questa VM.

### W8 — Serie F intelligence (F1 → F3 → F2 → F4-advisor → F5)
Blueprint agente P3. Explainability-first (pattern flight-risk: pesi dichiarati, payload per-componente, model_version):
- **F1** Essential Capability Ranker: `sys_capability_essential_scores` + recompute + read (aggregate); UI in `/org-director` + `/positions/[id]`.
- **F3** OHI (post-D2): `sys_org_health_scores` per OU, componenti normalizzate con re-normalize-on-missing.
- **F2** VRIO: `sys_capability_vrio_assessments` (V/R/I/O, rating+rationale, HUMAN/DERIVED) + pagina `/org-director/vrio`.
- **F4-advisor** fase-1: `GET /v1/advisor/suggestions?context=` via agent-gateway (MAX), citations[] obbligatorie + validator che scarta suggerimenti non citati; audit table `sys_advisor_suggestions` persistita PRIMA del display. Rate-limit MAX: se blocca il live-E2E → `blocked-on-Enzo`, mai mock-close.
- **F5** self-view FULL: decision-log che supersede D-6 PRIMA del codice; `/v1/me/risk` esteso con payload per-feature; capability self-read nel modulo me + perm self; UI `/me/analytics` + `/me/career` (framing coach).

### W9 — #24 F4 asse funzionale (design profondo agente P3)
- Migrations: `sys_process_participants` (LEAD/MEMBER, mirror team_members) + seed derivato da OU-processes/positions (fail-loud se RTL=0) + colonne nullable `goal_team_id`/`goal_blueprint_process_id`/`okr_team_id` + grants derivati TEAM_LEADER/TEAM_MEMBER + perm seeds (set proposto adottato CLASSE A, documentato nel design).
- `lib/scope/functional.ts` + `resolveActivityReadScope` (throw SENSITIVE_ON_FUNCTIONAL_AXIS su risorse sensibili — strutturale) + boot-gate `activityGate` (+ divieto orgGate+activityGate insieme) + axis "functional" in audit.
- Discriminazione dual-class per row-shape (subject≠null=EVALUATION/org; team/process=ACTIVITY/functional; null+null=tenant-visible back-compat) dentro `canReadGoal`/`canReadOkr` (già centralizzati da #26). Approvals: `approval`→ACTIVITY, buildScope ristretto (creator ∪ approver ∪ functional ∪ HR-mandate).
- Rollout: **shadow mode** (`FUNCTIONAL_AXIS_ENFORCEMENT=shadow|enforce`) → diff audit → enforce. Matrix test 12 casi (cross-tree lead antonio; org-manager NON vede activities altrui; ecc.) + rerun completo delle 21 suite `*-scope`.
- Modulo `/v1/process-participants` (7-step). Nuovo modulo tasks: NO (riuso goals con due_date/status). KPI operativi person-level: scope-cut documentato.

### W10 — E1 whistleblowing + E4 payroll read
- **E1**: ruolo `WHISTLEBLOWING_CUSTODIAN` (grant ≠ read: TENANT_ADMIN amministra il ruolo, NON legge); tabelle `sys_wb_reports` (reporter nullable, subject free-text NO FK, body AES-256-GCM app-level — chiavi `WB_ENCRYPTION_KEY`/`WB_CODE_HMAC_KEY` in .env; motivo: pgcrypto leakerebbe in pg_stat_statements esposto da #35) + `sys_wb_report_events`; access-code 160-bit HMAC-keyed per follow-up anonimo; scadenze 7gg ack / 3 mesi feedback / retention 5y da chiusura; boot-gate `wbGate`; LOG_REDACT esteso; notifiche generiche. API `/v1/wb-reports` + POST anonimo rate-limited con honeypot. Web: `/me/whistleblowing` + pubblica `/whistleblowing/[tenantCode]` + console custodian `/whistleblowing` (GOVERNANCE). **ADR-0028** (deroga da I18/I20/I21, proposta invariante I22). Test negativi = cuore: TA/HRMS/PA/MANAGER tutti 403. Custodian reale: scelgo un utente RTL fuori catena HR, documentato. Check finale skill `hrms-compliance`.
- **E4**: payroll ops read-extended (self-contained: import comp da W7 + read; execution payroll resta non-goal).

### W11 — E5 Recruiting/ATS (per decisione di Enzo: in coda)
Dossier `DEVELOPMENT_LINES_E_EVO_VERTICALS.md` §E5 (concept-porting dal cantiere evo, MAI codice — Express/Prisma+RLS incompatibile con I5). Design a inizio wave; spezzato in fasi con commit atomici (requisition-from-position → pipeline → colloqui → offerte con approvals funzionali già attivi da W9); cluster `/recruiting`. Se il batch si interrompe prima: progresso parziale committato e ripartibile.

### W12 — Audit 100X (gate pre-release)
1. **WS-L** ecosystem design-only: skill `claude-ecosystem-optimizer` modalità design+piano (NO implementazione) → `docs/kb/improvement/WS-L_PLAN.md` + `WS-L_TODO.md` + design datato; fix bug hook claude-mem.
2. **Triage D-01..D-14**: registro go/defer/won't per dossier seguendo le raccomandazioni interne (mandato batch); esecuzione inline solo epiche GO conservative piccole (D-07 doc-only; D-08 core già fatto in W0; D-09 assorbito da #35); epiche strutturali → GO registrato per sessioni dedicate su branch (regola MASTER_PLAN "mai su main per cambi strutturali").
3. **Re-run `/full-forensic-audit`** come gate pre-release sull'intero batch (append a INDEX.md); fix dei TP eventualmente emersi.

### W13 — Chiusura
- **Deploy finale**: push completo → `bash scripts/vm-deploy.sh` (con le protezioni D-08 di W0) → smoke www.heuresys.com (/login, /api/readyz) → full E2E prod.
- G4 doc-drift + G6 note → dentro handoff. Staleness check.
- **Skill `handoff`**: riscrittura `.handoff/STATE.md` + `SOT_STATE.md` + `SOT_BACKLOG.md` + `DEBT_REGISTER.md` (D-54→RISOLTO, item→DONE, nuovi GO 100X registrati), commit+push. Nota: align linux-pc NON eseguibile dalla VM (LAN irraggiungibile) → segnato in handoff per la prossima sessione Windows di Enzo.

## Rischi top (dal design-review)

| Rischio | P×I | Mitigazione |
|---|---|---|
| F4 restringe authz live | M×H | shadow mode + boot-gate + resolver hard-throw + rerun 21 suite scope |
| Deploy finale big-bang (scelta Enzo) | H×H | D-08 core in W0 (pg_dump+rollback+probe) + build/test/E2E locali a ogni wave + migrazioni solo additive |
| E1 confidenzialità (leak via log/observability/notifiche) | L-M×VH | crypto app-level, LOG_REDACT, notifiche generiche, batteria test negativi, ADR-0028 |
| Doppio tocco goals #26↔F4 | H×M | contratto helper unico canReadGoal |
| Collisione numeri migration | M×L | next-free-number a execution time |
| Advisor MAX rate-limit blocca DoD | M×M | off-peak; item→blocked-on-Enzo, mai mock-close |
| Scope creep W6/W11 | H×M | budget per fase + commit atomici ripartibili |

## Verifica end-to-end
Per item: `pnpm typecheck && pnpm lint && pnpm test` (+ vitest mirato) → Playwright E2E mirato → login reale (federica/paolo/tommaso/antonio/admin) su build locale con dati reali → evidenza (comando+output+timestamp). Per wave: suite completa + `pnpm i18n:check`. Finale: vm-deploy + `test:e2e:prod` + smoke PROD + `handoff_lint.py` OK.

## Fonti operative
Blueprint dettagliati per-item: output dei 3 Plan agent in conversazione (W1-W2: agente A-series; W3-W5+GTM: agente B-series; W8-W10+orchestrazione: agente architetture). Programma 100X: `docs/kb/improvement/{MASTER_PLAN_100X,TODO_100X}.md` + `DOSSIERS/`. Dossier serie: `docs/product/DEVELOPMENT_LINES_{A..G}_*.md`. Ogni wave ri-legge il proprio dossier/spec a inizio esecuzione.
