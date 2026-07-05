# ATLAS_CURATED — sintesi semantica del full sweep (NON generato)

> **File curato a mano**, datato — NON toccato da `build_atlas.py` (il gemello generato è `ATLAS.md`/`atlas.yaml`).
> **Provenienza**: full sweep multi-agente S1016 (2026-07-05, 19 agenti: 9 API + 3 web + shared + DB live + ops + legacy×2 + wiki + design-system), 193 rilievi verificati con evidenza `file:line` o query. I frammenti YAML integrali sono artefatti di sessione (scratchpad S1016); questo file ne conserva il distillato durevole.
> **Uso**: base evidence-based per il brainstorming sulle linee di sviluppo. Ogni voce è un FATTO osservato, non una decisione. Le decisioni di prodotto restano a Enzo (PM owns WHAT).

## 1. Colpo d'occhio (conteggi live 2026-07-05, ri-derivabili con `build_atlas.py` + `status_dashboard.py`)

83 moduli API · 468 route · 101 pagine web (53 admin + 24 /me + 6 pubbliche + 18 showcase) · 87 schemi shared (parità subpath 87/87) · 276 tabelle DB (**67 vuote**) · 12 viste sys · 0 matview · 6 estensioni (incl. `vector` 0.8.2, `pg_stat_statements`) · 2 tenant ACTIVE · 162 utenti/posizioni · 12 ruoli · 156 perm · 698 mapping · 167 migrazioni · 25.276+ embeddings pgvector live su 4 tabelle.

## 2. La "mappa d'oro": feature shipped senza dati (tabelle vuote → serbatoi da riempire o rami da potare)

| Cluster | Tabelle vuote | Significato |
|---|---|---|
| **Approval engine** | `sys_approval_requests`, `sys_approval_steps` = 0 | runtime BPM 3.3 costruito e testato, **mai usato in prod** |
| **MFA multi-kind** | otp_challenges, recovery_codes, webauthn_credentials, exemptions = 0 (vivi solo 6 factor TOTP + 2 policy) | superficie MFA completa, adozione zero (MFA OFF, decisione Enzo) |
| **Reward gates** | `sys_reward_gates`, `sys_reward_gate_results`, `sys_payout_curves` = 0 (catalogo 7 righe; `sys_variable_pay_calculations` = **121**) | i calcoli variable-pay girano SENZA gate engine |
| **Lead capture** | `sys_leads` = 0 | funnel GTM pubblico live, nessun lead reale ancora |
| **Visualization persistence** | layouts, node_layouts, styles, exports = 0 (graphs=1, nodes=158) | 9 renderer terminali, solo ORG_CHART vissuto |
| **Seed-governance** | tutte le 5 `sys_seed_*` = 0 | pipeline di acquisizione dati esterna mai innescata |
| **Altri serbatoi** | organization_hierarchies, organization_unit_history, user_professional_experiences, user_target_positions, successor_readiness, content_categories, content_media, payroll_handoff_records (write-only!), process_kpi_templates, blueprint_activations/overrides, notification_preferences, auth_sessions | schema-ready, dato assente |

## 3. Capacità dormienti nel CODICE (costruite, non esposte/attive)

- **Free-text semantic search** completa, testata, rate-limited, dietro flag `MATCHING_FREETEXT_ENABLED` default OFF (`semantic-matching/service.ts:152`) — mai esposta in prod.
- **Approvals effects registry** con UN solo effect (`tenant-activation`) — extension point pronto per side-effect approvativi (ferie, promozioni, comp change).
- **Notification digest** = chassis senza SMTP (ConsoleMailer logga senza inviare, `digest-cli.ts:8-11`); SMS_OTP = stub senza provider.
- **Graph versioning** dichiarato a schema (`graph_version` + unique) ma nessun endpoint crea versioni >1 (`visualization-graphs/service.ts:49`).
- **visualization-exports** = registro metadata senza motore di rendering né download (`service.ts:3`).
- **Role CRUD** mai shippato («full role CRUD lands in MVP-3», `auth/routes.ts:305`); matrice role-permissions in read gated da perm `auth:revoke_user` riusata.
- **OKR key-results** read-only (nessuna write API); **teams** read-only (derivati da seed, zero lifecycle API create/update/membership).
- **skills**: nessun DELETE/soft-deactivation (dichiarato post-MVP, mai shippato) — impossibile ritirare una skill via API.
- **predictions** = read-model legacy senza pipeline di ricalcolo; **seed-acquisition-runs.trigger** inserisce il run record ma l'executor reale non esiste.
- **ESS esclusioni deliberate** riaprebili: flight-risk senza self-view (D-6, `insights/routes.ts:8-9`); capability score senza self-view (`capability-composition/routes.ts:8`).

## 4. Gap/opportunità API puntuali

- Nessun endpoint **Prometheus /metrics** (observability espone solo /system-health JSON); 4 sezioni system-health droppate per assenza backend: log tail, slow-query (pg_stat_statements è installato!), incident timeline, KPI time-series (`SystemHealthLive.tsx:16-22`).
- **notifications**: solo POST broadcast, nessuna read admin per audit dei broadcast.
- **leads**: list senza paginazione/filtri (`leads/repository.ts:23-27`).
- **insights**: LIMIT 5000 hardcoded (truncation silente futura); la CTE engagement ignora le survey API-created (dual-shape response_answers, `insights/repository.ts:132-148`) → **le survey nuove non alimentano MAI il flight-risk**.
- `sys_payroll_handoff_records` write-only (INSERT senza alcun SELECT in tutto apps/api) — ledger mai leggibile; `sys_compensation_recommendations` letto solo come count.
- Media store: solo LocalDiskStore, driver S3/MinIO dichiarato e non implementato (`media-store.ts:3-6`).
- **skill-taxonomy-edges**: nessun check di aciclicità sul grafo IS_A (`service.ts:46-51`) — data-quality gap per traversal futuri.

## 5. Web/UX — pattern e gap

- **Admin SPA prevalentemente read-only**: solo 9/53 pagine con mutation; **zero CRUD UI** su users/tenants/positions/skills/kpi-definitions/learning/goals/okrs/org-units → il grosso dell'amministrazione dati passa ancora da SQL/seed. Opportunità macro: "fase di admin editing".
- **Nessuna paginazione UI**: `?limit=200` hardcoded (~20 pagine), viz cap 500.
- **62/87 schemi shared senza consumer web tipizzato** (71%): le pagine duplicano interface locali (positions, organization, skills, me-profile) — anti-pattern vs dottrina MVP-2a "types reused from shared".
- i18n: `SystemHealthLive` unica pagina autenticata fuori guardrail; colori chart hardcoded hex in `/me/analytics` e `/me/org-chart` (contro brand-token doctrine).
- `section-tabs.tsx` hardcoda i 6 merge-group mentre la sidebar è DB-driven — doppia manutenzione sulle rename route.
- `/demo` usa 10 PNG statici pre-catturati — drift visivo possibile vs UI live.
- `/investors` ha STATIC_FACTS hardcoded (pattern D-01, drift risk noto).
- Inbox: polling 30s, push SSE dichiarato post-MVP-3.
- Nessun `middleware.ts`: protezione route client-side + enforcement API (by design, da conoscere).

## 6. Design system @heuresys/ui — capitale inutilizzato

- Catena versioni allineata (working copy = npm = consumato = 0.1.9) MA **CLAUDE.md §Design System è stale** (dichiara ^0.1.1, S932).
- **201 componenti esportati, ~60+ mai importati** dalle 2 app: in particolare **ESCOTreeNavigator, KGGraphCanvas, SAPSyncPanel** (costruiti PER heuresys, Sprint 3.G), gli atomics HR tier17 (**SkillHeatmap, SuccessionCard, CareerArc, KgMiniGraph**), l'intero tier6 forms avanzati (IbanInput, TaxIdInput, OtpInput, MoneyInput, FormWizard, FileDropzone…), collab (Kanban/Timeline/CommentThread/CalendarGrid), AI (Chatbot/VoiceInput).
- Stories 122/201; naming collision `RbacMatrix` vs `RBACMatrix`.

## 7. DB health / igiene

- `audit.import_validation_results` = **1,55M righe / 547 MB = ~44% del DB** → candidato n.1 retention/partition/archive.
- `sys_auth_refresh_tokens` 44k/26MB + `sys_auth_login_events` 91k/29MB per 162 utenti → candidato purge job (auth-housekeeping esiste: verificarne le soglie).
- `staging.wave1_*` 18 tabelle a 0 righe con size residua (bloat) → TRUNCATE/VACUUM; schema `temp_sdbi` con 4 tabelle `pf_*` ancora popolate → verificare e droppare.
- **12 ruoli nel DB** (12° = ORG_DIRECTOR) vs "11 roles" in CLAUDE.md §Security — doc da allineare.

## 8. Legacy — residuo importabile e cantiere

**DB legacy `heuresys_platform`** (588 tabelle; 78 con >1000 righe, **65 non coperte** da table_mappings; registry = solo Wave-1, 97 mapping/1225 column_mappings):
- **Knowledge graph legacy NON importato**: `kg_edges` 139.451 + `kg_nodes` 17.260 — l'asset semantico più grande del legacy.
- **Layer skill per-dipendente NON importato**: employee_skill_assessments 3.140, employee_skills 1.445, career_skills 1.106, position_skill_requirements 1.632 — Wave-1 ha portato la tassonomia, non il POSSESSO delle skill → gap diretto per skill-gap/people-analytics su dati storici reali.
- **Engagement/PULSAR** non importato (survey_responses 4.482, check_ins 2.495, pulse 1.145…), **GOKMER** goals 1.068 + updates 1.811, **analytics_events** 5.000 + employee_timeline 4.641, mirror SAP-infotype ~30 tabelle pa*/pb*.
- Caveat metodologico: l'ingestione persone/org S950 è avvenuta FUORI dal registry brownfield → il registry sottostima la copertura reale.
- Data dictionary pronto in `db-export/` (576 tabelle, 950 FK, 16 domini lexicon) — base per pianificare Wave-2 per dominio.

**Cantiere `/home/ubuntu/heuresys.com.evo`** (produzione matura: 231 pagine, 1481 endpoint, jest 3099; in pensionamento phased): **12 macro-aree presenti lì e ASSENTI in advanced** — recruiting/ATS completo · time&attendance (advanced ha 3.180 righe attendance senza feature!) · payroll ops (pay-stubs/salary-bands/merit-cycles/benefits) · AI-native layer (RAG, embedding-pipeline, ai-orchestrator, career-coach, predictive) · marketplace/plugin ecosystem · wellbeing/**whistleblowing (obbligo D.Lgs 24/2023** — gap compliance per HRMS italiano) · workforce planning · integrazioni O*NET/NACE/SAP · **SSO enterprise OAuth** (advanced ha solo login locale+TOTP — blocker vendite enterprise) · lifecycle ops · RBP widget engine data-driven · observability stack (Sentry/Prometheus). Pattern portabili: FilterBuilder/paginate (ADR-012 legacy), metodo a11y sistematico. ⚠️ il legacy usa RLS (vietata in advanced, I5) — attenzione nei port di schema.

## 9. Wiki e grafi (viste parallele, MAI SoT)

- **Wiki advanced** ferma al 2026-05-27 (**pre-GA**, 748 commit dietro): ADR coperti 19/26 (mancano 0023/0024/0026/0027 = le dottrine cardine), invarianti I1-I13 vs I1-I21 attuali, 2 source path morti in `linked_sources.yaml` (+ path assoluti da parametrizzare). **Trattarla come fonte storica**; ADR ≤0020 e record brownfield/brand riusabili as-is.
- **Grafo graphify in-repo**: refresh full-codebase eseguito in S1016 (questa sessione) — vista esplorativa, subordinata all'atlas.

## 10. Incoerenze tecniche minori catalogate (candidate debt-register, non urgenti)

- Pattern ricorrente **DELETE sotto permission `:update`** (career-paths, succession-pools, user-career-plans, enterprise-*, activity-*, seed-acquisition, visualization `update_layout`): nessuna `:delete` dedicata in ~10 moduli.
- Permission proxy/riusate: observability←`tenant:create`, operating-models/ou-kpi-templates←`enterprise_typing:*`/`bpm_process:*`, engagement←`surveys:read`, role-matrix←`auth:revoke_user`, taxonomy skill← gate hardcoded PLATFORM_ADMIN nel service (non deducibile dalla matrice RBAC).
- **tenant-materialization**: POST senza requirePermission (solo CSRF + service-gate), GET /archetypes aperto a ogni autenticato — seedare perm dedicate.
- Copertura `orgGate` asimmetrica ma passante D-51 (che copre solo data-class sensitive): surveys/engagement senza orgGate (possibile data-class EVALUATION → verificare vs I18); job-families/job-roles senza `catalog` vs sibling che lo dichiarano.
- Commenti stale: mfa-routes "plain-HTTP PROD" (HTTPS da S962), positions routes "10 endpoints" (sono 13), viz-graphs "5 endpoints" (sono 7), users/repository header, mfa-policy "8 canonical roles" (sono 12), test brownfield "empty in CI".
- `showcase/layout.tsx:70` renderizza un path assoluto Windows nel footer (viola no-absolute-paths).
- `landing.ts` hardcoda 6 ADMIN_ROLES senza i ruoli funzionali holderless — un holder puramente funzionale atterra su /me.
- CI `test-integration.yml:3` commento "41 integration tests" hardcoded (vietato da D-01).
- Script esauriti da archiviare: bisect-cw-b59, restore-showcase-routes, codemod s983, encrypt-totp-secrets (one-time), `scripts/cowork-exchange/` (protocollo congelato S939); `deploy/reports/claude-align` ~81 report senza retention.

## 11. Drift documentali rilevati (da sanare al prossimo handoff)

1. CLAUDE.md §Security: "11 roles" → sono **12** (+ORG_DIRECTOR, mig 000145); anche `mfa-policy/service.ts` header dice 8.
2. CLAUDE.md §Design System: `^0.1.1` → reale `^0.1.9` (8 patch dopo).
3. CLAUDE.md §U2/S953: descrive il filtro PET default "Tutte" → ritirato in S1009 (5 sezioni collassabili).
4. `docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md` è datato 2026-06-19 = **pre-Gap#1**: dichiara MLCE/Maturity ASSENTI, ma esistono da S999 (capability-composition + capability-maturity live) → **i candidati Tier C "bloccati da MLCE" (VRIO, OHI, Essential Capability Ranker) sono in realtà SBLOCCATI**; Goals/OKR Tier A shippati (read-only).
5. Ledger §10 Tier A ancora aperti (verificati vs codice): **9-box/talent grid** (159+154 righe, 0 endpoint), **gap-closure** (36+440+270 righe, esposte? verificare live), **Provenance/Trust Ledger** (70.972 righe lineage, 0 endpoint), **readiness-horizon** (90) e **position-fit** (146) senza endpoint, mentor-match via embeddings, recompute learning-gaps.

## 12. Semi per le linee di sviluppo (raggruppamento tematico, TUTTO componibile — nessuna scelta aut-aut)

- **A. Esporre il già-pronto** (basso effort, dati live): 9-box · trust-ledger/provenance (angolo AI-Act) · readiness+fit read-API · self-view capability/flight-risk ESS · payroll_handoff read · compensation-recommendations list · notifications admin read.
- **B. Attivare il dormiente**: free-text semantic search (flag) · reward-gate engine sui 121 calcoli · approval effects (nuovi handler) · digest+EMAIL_OTP (sbloccato da #8 WAIT-INPUT) · graph versioning/export engine.
- **C. Admin editing UI**: CRUD sulle entità core oggi read-only + paginazione + shared-types refactor (62 schemi) + componenti @heuresys/ui inutilizzati (FormWizard, tier6 forms).
- **D. Wave-2 dati legacy mirati**: employee-skill layer (possesso skill storico) · engagement/PULSAR · GOKMER goals-history · kg_nodes/kg_edges (grafo semantico) — con registry esteso e dottrina I14.
- **E. Verticali dal cantiere evo**: whistleblowing (compliance IT) · SSO enterprise · time&attendance (dati già presenti!) · recruiting/ATS · payroll ops — porting concettuale, non di codice (stack diverso, RLS vietata).
- **F. Intelligence layer sopra MLCE** (ora sbloccato): VRIO scorecard · OHI · Essential Capability Ranker · AI Advisor prescrittivo (agent-gateway già live su MAX).
- **G. Piattaforma/igiene**: retention audit 547MB · purge auth events · Prometheus /metrics + slow-query (pg_stat_statements già attivo) · perm `:delete` dedicate + perm proxy da sanare · aciclicità skill-graph.

---
*Aggiornare questo file SOLO con un nuovo sweep verificato (o correzioni puntuali datate). Le decisioni derivate vanno nei dossier `docs/product/` e nell'Action register.*
