# Functional Capability Ledger — heuresys-advanced

> **Cos'è**: la guida-alla-verifica del prodotto. Per ogni funzionalità dichiara uno **stato verificato** con evidenza concreta (`file:line` + query/count live). È il cuore della SoT di prodotto e l'input del piano di sviluppo funzionale.
> **Metodo**: cartografia codice (`db/migrations` + `apps/api/src/modules` + `packages/shared` + `apps/web/src/app`) + count/absence-check **LIVE** sul DB reale (tunnel `:5433` → OCI VM PostgreSQL 16). Verifica eseguita **2026-06-19** (S998) via 7 work-group paralleli read-only. Schema `sys.*`, migrazioni `000001..000141`.
> **Anti-drift (T2)**: i conteggi qui riportati sono **evidenza della verifica live al 2026-06-19**, non valori SoT congelati. La SoT dei conteggi correnti è `docs/kb/SOT_STATE.md` (ri-derivata ogni sessione). Non ri-hardcodare questi numeri altrove.
> **Ground-truth**: dove il wiki/`LATENT_CAPABILITY_CATALOG` (ora assorbito qui) divergono dal codice advanced, **vince il codice**. Le sovrastime del wiki (in parte legacy `heuresys-evo`) sono segnalate nella colonna "Discrepanza" e in §9.

## Legenda stato

| Stato | Significato |
|---|---|
| ✅ **IMPLEMENTATO-VERIFICATO** | codice + endpoint + test **e** dato live presenti |
| 🟡 **PARZIALE** | building-block/codice presenti ma orchestration/UI/dato live mancante |
| 🔵 **LATENTE — design-pending** | progettato (spec/schema), non costruito |
| ⚪ **LATENTE — idea** | abbozzo, nessun building-block |
| 🆕 **SCOPERTO** | capability emersa dalla verifica live, non catalogata prima |
| ❌ **ASSENTE / SOVRASTIMATO** | dichiarato dal wiki ma assente sull'advanced (absence-check) |

## Invarianti confermati LIVE (2026-06-19)

- **I1 position-centric** ✅ — `sys_positions` 162 righe, `position_owner_user_id` ≠ incumbent, `position_reports_to_position_id` 159/162 popolati.
- **I5 no-RLS** ✅ — `pg_policies WHERE schemaname='sys'` → **0 policy**; nessuna tabella con `relrowsecurity`. Isolamento = FK + middleware (`tenantContext.ts`).
- **I9 PIP è VIEW** ✅ — `sys_position_intelligence_profiles_v` (`000011_position_model.sql:272`, ri-emessa `000137:28`), `jsonb_agg` a runtime su 6 tabelle base, no blob.
- **RBAC** — 11 ruoli · 141 permission · 630 role-permission mapping · 328 user-role (query live).

---

## 1. PROCESS & BLUEPRINT

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza wiki↔advanced |
|---|---|---|---|---|---|---|
| Catalogo classificazioni ATECO/NACE | activity-classifications | ✅ | `000007_enterprise_typing.sql:16-58`; modulo+test. `count(sys_activity_classifications)` → **6533** | Alto | done | — |
| Cross-mapping ATECO↔NACE | activity-classification-mappings | ✅ | `000007:63-81` (confidence); count → **5730** | Medio-alto | done | — |
| Operating-model catalog | operating-models | ✅ | `000007:112-123`; count → **6** | Medio | done | — |
| Blueprint families (catalogo settoriale) | blueprint-families | ✅ | `000008_blueprint_catalog.sql:13-24`; web `blueprints/page.tsx:48`; count → **1** (FIN_BANKING) | Medio | done (catalogo da estendere) | wiki suggerisce multi-settore; live = solo banking |
| Blueprint variants (per size-band) | blueprint-variants | ✅ | `000008:29-45`; count → **1** | Medio | done | live = 1 variante |
| Blueprint process registry (modeling) | blueprint-processes | ✅ | `000008:50-67`; web read-only `processes/page.tsx:38-67` (DataTable, non runtime); count → **23** su 1 variante | Medio | done | catalogo onesto: modeling, non esecuzione |
| Blueprint activation per-tenant | blueprint-activations | 🟡 | `000008:72-103` (state-machine, "one active per tenant"); perm `blueprint:activate`; **codice+test completi, count → 0** | Alto | done lato codice; manca attivazione reale | — |
| Blueprint overrides | blueprint-overrides | 🟡 | `000008:108-134`; codice+test; count → **0** | Medio | done lato codice | — |
| Process-KPI template | process-kpi-templates | 🟡 | `000015_kpi_model.sql:70-82`; **tabella vuota**, count → **0** | Medio-alto | done lato codice; manca popolamento | — |
| RACI org-unit ↔ processo | organization-unit-processes | 🟡 | `000121:23-37` RACI-style a ruolo singolo (OWNER/CONTRIBUTOR/CONSULTED/INFORMED), **non matrice piena**; count → **13** (1 tenant) | Alto | done lato codice; dati = demo | **sovrastima maturità**: seed `54_raci_demo_rtl_s994.sql:8` = "12 demo, NOT production truth" + 1 reale |
| Approval runtime (primitiva BPM) | approvals | ✅ codice/UI · 🟡 dati | `000132_approval_runtime.sql:30-148` (requests+steps, quorum, SLA `000141`); UI mutativa completa `approvals/page.tsx` + `[id]/page.tsx`; 3 test; **requests/steps count → 0** | Molto alto | done lato codice/UI; manca 1ª istanza live | header `000132:5`: "first executable BPM primitive"; coerente Gap#1 Phase-0 #8 |
| Approval SLA / escalation | approvals (sla.ts) | 🟡 | `000141:19-40` + scanner `sla.ts:38-142` (timer systemd); count step con SLA → **0** | Alto | done lato codice | — |
| Content / CMS (documenti versionati) | content | ✅ | `000086_content_schema.sql:28/71/143`; 2 test; documents → **94** · versions → **102** | Medio | done | — |
| Content media (file binari) | content (media-*) | 🟡 | `000105:23`; store local-disk default `media-store.ts:4-10`; count → **0** | Basso-medio | done lato codice | — |
| Content ↔ blueprint cross-link | content-blueprint-links | ✅ | `000100:24-58`; count → **1** | Medio | done | — |

**Distinzione chiave**: il **modeling/catalogo** (ATECO/NACE/blueprint/processi) è reale e popolato; il **runtime di processo generico** è ❌ ASSENTE (absence-check su `%process_instance%`/`%task_instance%`/`%workflow_instance%`/`%bpmn%` → 0). `approvals` è l'unica primitiva runtime (con apply-effects transazionali — vedi §8 S-PROC1).

---

## 2. STRUCTURE

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza |
|---|---|---|---|---|---|---|
| Organization-unit tree | organization-units | ✅ | `000009_organization_model.sql:27` (self-FK `:34`); 5 endpoint CRUD; `app.ts:347`; count → **26** (8 unit-type, 6 branch) | Alto | done | — |
| Org closure-table (ancestor/descendant) | organization-units | 🟡 (presente, non usata) | closure `sys_organization_hierarchies` `000009:98-104` **0 righe**; repo usa solo adjacency `parent_id` | Medio | basso (manca trigger/seed + uso) | — |
| Positions (spina dorsale I1) | positions | ✅ | `000011:22` (`reports_to` self-FK, criticality+economic_weight); ~14 endpoint; 11 test; count → **162** (reports_to 159/162) | Alto | done | — |
| PIP — Position Intelligence Profile (VIEW, I9) | positions | ✅ | VIEW `sys_position_intelligence_profiles_v` `000011:272`/`000137:28` (jsonb_agg 6 tabelle); `repository.ts:284`; count → **162**. Req live: skill 844 · kpi 172 · learning 1791 | Molto alto | done | catalogo accurato |
| Position KPI rank | positions | 🟡 (schema sì, dati no) | colonna `rank` `000137:17-23`; PIP `ORDER BY rank…weight`; `rank NOT NULL` count → **0** (ordering via weight) | Medio | basso (popolamento) | — |
| Position career-paths (link) | position-career-paths | ✅ | `000011:190`; 4 endpoint; count → **40** | Medio | done | — |
| Position succession relevance | position-succession-relevance | ✅ | `000011:237-254` (is_critical, readiness_horizon); 4 endpoint; count → **9** | Medio-alto | done | — |
| Tenants (multi-tenant root, no-RLS) | tenants | ✅ | `sys_tenancies`; 5 endpoint; 8 test; filtro per-param non-RLS; count → **2** (HEURESYS + RTL_BANK, ACTIVE) | Alto | done | — |
| Tenant materialization (provisioning sintetico) | tenant-materialization | ✅ 🆕 | provisioning deterministico org+pos+users+evidence da archetipi, PLATFORM_ADMIN-only (`service.ts:18-59`); 2 endpoint; 9 test | Alto | done (slice WI-C) | non catalogato |
| Enterprise typing profiles | enterprise-typing-profiles | ✅ | `000007:128` (FK industry/size/operating + regulatory_intensity); 4 endpoint; 7 test; count → **2** | Medio-alto | done | — |
| Enterprise size bands | enterprise-size-bands | ✅ | `000007:86-104` (XS..XL); count → **4** | Basso-medio | done | — |
| Teams + my-team scope axis | teams | ✅ | `000054_r1b_teams_and_roles.sql:28-113` (TEAM_LEADER/MEMBER + perm team:*); 11 test; teams → **24** · members → **176** | Medio-alto | done | — |
| Org-unit KPI templates (template layer) | organization-unit-kpi-templates | ✅ | `000064:26-94` (dual-mode instance/blueprint); 6 test; kpi-templates → **100** · taxonomy → **225** | Medio | done | — |

---

## 3. ROLE & SUCCESSION

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza |
|---|---|---|---|---|---|---|
| Job families catalog | job-families | ✅ | `000010_job_role_model.sql:8`; 5 endpoint; 7 test; count → **27** | Medio | done | — |
| Job roles catalog | job-roles | ✅ | `000010:21-39` (seniority CHECK); 4 endpoint; 7 test; count → **136** | Medio | done | — |
| Job-role → family wiring | job-roles | 🟡 | FK nullable (`000038`); `family_id NOT NULL` → **25** · NULL → **111** (ruoli reali, non garbage) | Medio | basso (UPDATE batch) | wiki non copre |
| ESCO occupation mapping | job-roles | 🟡 | `000010:54` + enrich trgm `000115:66-103`; mappings totali **7675**, **WIRED solo 25/136 ruoli** (~11 low_confidence) | Alto | medio (engine trgm riusabile) | **wiki implica ESCO pieno; reale = 25/136** |
| Career paths (mobilità curated) | career-paths | 🟡 | `000018:8-27`; count → **28** = 21 "Test Auth Path" (residuo E2E) + 7 track legacy `LEGACY_CP::`; tutti `is_global=false` | Alto | basso (cleanup) / alto (operativi) | wiki implica path operativi; reale = template+residuo test |
| Career path steps | career-path-steps | 🟡 | `000018:38` (FK origin/target → positions); count → **35**, ma con posizioni reali → **0** | Alto | medio (wiring posizioni) | scheletri senza wiring |
| User career plans | user-career-plans | ✅ | `000018:54-73` (status); 5 endpoint; count → **113** (ACTIVE 95 · COMPLETED 18) | Alto | done | popolato |
| User target positions (aspirazioni + review) | user-career-plans (tab.) | 🟡 (vuoto) | `000018:84-104` (review_status, reviewer FK); **schema completo, nessun modulo API**, count → **0** | Medio | medio (modulo API sopra schema) | non catalogato |
| Succession pools | succession-pools | ✅ | `000018:130`; 5 endpoint; count → **17** (RTL 16 · HEURESYS 1, ACTIVE) | Alto | done | — |
| Successor candidates | successor-candidates | ✅ | `000018:154-177` (readiness_level categorico); 6 endpoint; count → **25** | Alto | done | readiness stored, non calcolato qui |
| Readiness distribution (aggregator) | successor-candidates | ✅ 🆕 | `GET /readiness-distribution` GROUP BY (`repository.ts:94-116`), consumato da chart ECharts | Medio | done | non catalogato |
| Successor readiness samples (modulo) | successor-readiness | ❌ (modulo c'è, vuoto + nessun calcolo) | `000018:182`; service = solo INSERT, score dal body, **ZERO scoring** (`service.ts:37-46`); count → **0**; registry `NO_SOURCE` | Medio | decidere: collegare a insights o ritirare | il "readiness score" promesso NON è calcolato qui |
| **Succession readiness ENGINE** (calcolato) | insights (`sys_succession_readiness_scores`) | ✅ 🆕 | engine reale `insights/service.ts:219-401` weighted-linear (posFit .5/kpi .3/tenure .2), recompute `:387`; count → **462** | Alto | done | **wiki "succession readiness" = QUESTO**, non `successor-readiness` (false friend) |
| Critical positions | (`sys_critical_positions`, 000018) | 🆕 | `000018:115` (business_impact_score); count → **8** | Alto | modulo API da costruire | non catalogato |
| Critical-role coverage status | (`000018`) | 🆕 | `000018:196` (ready_now/6mo/1y, computed_at); count → **8** | Alto | espozione API/UI | non catalogato |
| Career & Succession web UI | route `career-succession` | 🟡 | 3 tab read-only + 1 chart; **discrepanza UI↔schema**: `page.tsx:13-20` dichiara `difficulty`/`fromJobRoleId` inesistenti → colonne vuote | Medio | read-only; manca CRUD UI | UI mostra campi inesistenti |

---

## 4. COMPETENCE (skills / learning / assessment)

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza |
|---|---|---|---|---|---|---|
| Skill catalog (ESCO-native) | skills | ✅ | `000013_skill_taxonomy_model.sql:87`; 4 rotte; web `skills/page.tsx:44`; count → **21939** | Alto | done | — |
| skill_kind dimension | skills | 🟡 | `000120:23-34`; SKILL 10797 · KNOWLEDGE 3230 · COMPETENCE 8 · BEHAVIOR 1 · **NULL 7903** (legacy non classificate) | Medio | basso (backfill) | — |
| Skill aliases | skill-aliases | ✅ | `000013:147`; 5 rotte; count → **80** | Medio | done | — |
| Skill categories | skill-categories | ✅ | `000013:31`; count → **7** | Medio | done | — |
| Skill families | skill-families | ✅ | `000013:15`; count → **77** | Medio | done | — |
| Skill proficiency levels | skill-proficiency-levels | ✅ | `000013:51`; 1 rotta read-only; count → **6** (scala 0-5) | Basso | done | — |
| Skill taxonomy edges (DAG) | skill-taxonomy-edges | ✅ | `000013:126`; count → **11965** (RELATED 11763 · PREREQUISITE_OF 198 · PART_OF 4) | Alto | done | — |
| Skill embeddings (pgvector) | semantic-matching | ✅ 🆕 | `pg_extension vector 0.8.2`; `repository.ts:118-158` kNN cosine; count → **21939** (100%, 1024-dim voyage-4-lite) | Molto alto | done | — |
| Occupation→skill requirements (ESCO) | reference-sync / read | ✅ | `000123:34`; count → **126051** (ESSENTIAL 67600 · OPTIONAL 58451) | Molto alto | done | — |
| ESCO occupation mappings + embeddings | reference-sync / semantic-matching | ✅ | mappings → **7675**; occupation embeddings → **3045** | Alto | done | — |
| Reference-sync (ESCO/ATECO/NACE) | reference-sync | ✅ | 4 rotte PLATFORM_ADMIN; 3 source (ESCO, ESCO_SKILL_HIERARCHY, ATECO_2025); watermark **IDLE** (mai triggerato live) | Alto | done; run live non eseguito | — |
| ATECO↔NACE crosswalk | reference-sync / read | ✅ | `000112` popola crosswalk bidirezionale idempotente | Medio | done | — |
| Assessment methods | assessment-methods | ✅ | `000017_assessment_gap_model.sql:8`; 1 rotta; count → **5** | Basso | done | — |
| Assessments | assessments | ✅ | `000017:26`; 4 rotte; count → **615** | Medio | done | — |
| Assessment results | assessment-results | ✅ | `000017:63`; 3 rotte; count → **1560** | Medio | done | — |
| Behavioral assessments | (nessun modulo API) | ❌ orphan-data | `000017:79` `sys_behavioral_assessments` count → **465** popolate, **0 moduli** (grep) | Medio | basso-medio (modulo CRUD) | dato presente, API assente |
| User assessment evidence | (nessun modulo API) | ❌ orphan-data | `sys_user_assessment_evidence` count → **1560**, **0 moduli** | Medio | basso (endpoint) | dato presente, API assente |
| Learning modules (catalogo) | learning-modules | ✅ | `000016_learning_model.sql:10`; 5 rotte; web `learning/page.tsx:48`; count → **7427** | Alto | done | — |
| Learning paths | learning-paths | ✅ | `000016:81`; 5 rotte; count → **4667** | Alto | done | — |
| Learning path steps | learning-path-steps | ✅ | `000016:105`; 5 rotte; count → **124** | Medio | done | — |
| Skill→learning mappings | brownfield-wave-executor (write) | ✅ 🆕 | `sys_skill_learning_mappings` (skill→module + target_proficiency); count → **635**; nessun CRUD dedicato | Alto | basso (endpoint) | ponte gap→learning |
| User learning assignments/evidence | me (read) | 🟡 | `sys_user_learning_assignments` → **1990**; `sys_user_learning_evidence` → **1434** | Alto | basso | — |
| Learning gaps (CRUD) | learning-gaps | 🟡 (NON computed) | `000016:176`; 5 rotte; **service valida solo FK, score dal body** (`repository.ts:153-171`); formula solo nel seed `20_learning_gaps.sql:10`; count → **270** | Alto se computed | medio (recompute endpoint) | **wiki "gap calcolato"; reale = CRUD + import** |
| Skill-gap scores (insights) | insights | ✅ | `sys_skill_gap_scores` (model_version, computed_at); count → **154** | Alto | done | — |
| Gap analysis results / closure plans / actions | (nessun modulo API) | 🟡 (data sì, API no) | `000017:114` results → **270**; closure_plans → **36**; closure_actions → **440**; **0 moduli** | Alto | basso-medio (modulo `gap-closure`) | dati pronti, orchestration assente |
| Training initiatives (coorti) | training-initiatives | ✅ (under-seeded) | `000016:48`; 4 rotte; count → **1** | Medio | done | — |
| Mentorship (programs/pairings/sessions) | mentorship | ✅ | `000072_mentorship_schema.sql` (4 tabelle); **15 rotte**; 2 test; programs **5** · mentorships **63** · sessions **150** | Alto | done | — |
| Mentor match scores | mentorship (read-only) | 🟡 (NON computed) | `000072:207`; read-only; **0 embedding/kNN** (scores legacy importati via seed); count → **30** | Alto se computed | medio (recompute via embeddings) | wiki implica matching attivo; reale = importato read-only |

---

## 5. PERFORMANCE (KPI / compensation / engagement / insights)

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza |
|---|---|---|---|---|---|---|
| KPI catalog + cascade (10 tabelle) | kpi-definitions | ✅ | `000015_kpi_model.sql:11-271`; 5 endpoint; web `kpis/page.tsx:47`; 5 test; definitions **243** · targets **248** · measurements **248** · assessment_results **248** | Alto | done | — |
| Process-level KPI templates | process-kpi-templates | 🟡 | `000015:70-82`; count → **0** | Medio | popolamento | cascade process→KPI non popolato |
| KPI achievement computation (% target) | — | ❌ non-modulo | nessun servizio/endpoint scorecard achievement; usato solo come feature in `insights/service.ts:129` | Alto | medio (dati esistono: targets+measurements) | — |
| Compensation Intelligence (decision-support, non payroll) | compensation | ✅ | `000019_compensation_intelligence_model.sql:10-249` (12 tabelle); 5 endpoint; web; 9 test; bands **87** · profiles **159** · recommendations **116** · variable_pay **121** | Alto | done | — |
| Reward gates (eval per soggetto) | compensation | 🟡 | `000019:167-203`; solo **catalogo** popolato (gate_catalog 7); **istanze 0** (reward_gates/results) | Medio-alto | engine valutazione mancante | distribution su 0 istanze |
| Payroll handoff / payout curves | compensation | 🟡 | `000019:229-248`/`:72-91`; count → **0** (output runtime by-design) | Medio | done (schema+API) | — |
| Engagement surveys — authoring (JSONB) | surveys | ✅ | `000077_engagement_surveys_schema.sql:32`; 9 endpoint; 9 test; templates 5 · surveys 6 · responses **862**; no web-route | Medio-alto | done | — |
| Engagement read-model (question-level) + pulse | engagement | ✅ | `000097_engagement_normalized_schema.sql:18-55`; 4 endpoint read-only; web `engagement/page.tsx`; 8 test; surveys 8 · questions 21 · responses **3792** · pulse **733** | Alto | done | — |
| Survey assignments (ESS respond) | surveys (000135) | ✅ | `000135` + perm `surveys:respond:self`; ESS test; count → **8** | Medio | done | — |
| Engagement feedback (anon) + action plans | engagement-feedback | ✅ | `000113_engagement_feedback_schema.sql:31`; 10 endpoint; 10 test; feedback **400** · action_plans 6; no web-route | Medio-alto | done | — |
| PredictionsML read-model | predictions | ✅ (read-only, valori legacy) | `000079_predictionsml_schema.sql:40-126`; 4 endpoint read-only; **NO ML in-platform, NO recompute** (`000079:7`); models 4 · predictions **468** (TURNOVER/PERFORMANCE/GENERIC ×156) | Medio | done (read-model) | **"ML predictions" = import legacy, non engine attivo** |
| Insights — Flight-risk | insights | ✅ (euristica deterministica) | `000082:27-43`; regola weighted-linear `service.ts:67-199`; recompute systemd timer; web; 12 test; count → **159** | Alto | done | NON ML black-box → plus explainability |
| Insights — Succession-readiness | insights | ✅ (euristica) | `000092:25-38`; `service.ts:224-266`; count → **462** | Alto | done | — |
| Insights — Skill-gap | insights | ✅ (euristica) | `000092:41-54`; `service.ts:272-311` + notifica GAP_CLOSURE_DUE; count → **154** | Alto | done | — |
| Goals / OKR | — (solo schema 000037) | 🟡 / 🔵 | `000037_sys_goals_okrs_scaffold.sql:41` (10 tabelle) **POPOLATE**: goals **1067** · okrs **20** · goal_alignments **100**; **nessun modulo API/UI**, non in `app.ts` | Alto | medio (7-step su dati live) | dati esistono, capability **dormiente** |
| Performance reviews / 360 / nine-box / talent grid | — (solo schema 000065) | 🟡 / 🔵 | `000065_sdbi_perf_feedback_schema.sql:10`; **POPOLATE**: reviews **161** · 360_responses **390** · talent_scores **154** · continuous_feedback **474**; **nessun modulo API** | Alto | medio (schema+dati live) | dati esistono, capability **dormiente** |

---

## 6. PLATFORM (auth / RBAC / multi-tenant / export / matching / viz / ESS / pipeline)

| Capability | Modulo/i | Stato | Evidenza (file:line + count live) | Valore | Effort | Discrepanza |
|---|---|---|---|---|---|---|
| Auth — Argon2id + JWT RS256 + refresh rotation/replay | auth | ✅ | `password.ts:16-19` (argon2id 64MiB/3/4); replay `service.ts:521-563`; `000005`; credentials 12 · login_events **67348** · refresh_tokens 42238 | Alto | done | — |
| MFA multi-factor | mfa-policy, auth(mfa) | 🟡 | schema 5 kind (TOTP/email-OTP/WebAuthn/recovery/exemptions, `000081/099/102/103/116/118`); **factors 6 tutti TOTP**, gli altri 0 | Alto | schema c'è; non-TOTP non esercitato | "MFA multi-kind deferred v1.x" allineato |
| RBAC — 11 ruoli × 141 perm | auth, middleware/rbac | ✅ | `middleware/rbac.ts`; roles **11** · permissions **141** · role_permissions **630** · user_roles **328** | Alto | done | `ORG_DIRECTOR` assente (Gap #1) |
| Multi-tenant — FK + middleware (no RLS) | tenants, users | ✅ | `middleware/tenantContext.ts`; tenancies 2 · users **162**; vista `v_tenant_boundary_violations` | Alto | done | I5 confermato |
| Audit / Lineage | (brownfield-*) | ✅ | `000025`; `sys_source_lineage_records` → **70972** · reconciliation_registry 111; **history-tables vuote** (org/skill-req) | Medio-alto | done (lineage); history non popolata | event-sourcing di dominio ASSENTE |
| Export universale `?format=csv\|xlsx\|pdf` | lib/export (trasversale) | ✅ 🆕 | hook globale `lib/export/hook.ts:49` (onSend post-RBAC su ~85 list-route); `serializers.ts:48` exceljs `:67` pdfkit; `app.ts:232` | Molto alto | done | non catalogato |
| Inbox / Notifications | notifications, me(inbox) | 🟡 | inbox read/manage via `me/routes.ts:165-182`; emit admin `notifications/routes.ts:14`; inbox **50** (tutte UNREAD); **preferences 0**; no push/email channel | Medio | inbox live; delivery channel assente | — |
| Semantic-matching — kNN cosine | semantic-matching | ✅ | `repository.ts:118-192` (`<=>` cosine); 4 entità embedding: skill **21939** · occupation **3045** · user_profile **156** · job_role **136** | Molto alto | done | accurato |
| Visualization — 9 graph_type | visualization-{graphs,nodes,edges,layouts,node-layouts,styles,exports} | 🟡 | 9 graph_type `000022:32` + 6 export-format `:175`; 7 moduli con route; **graphs 1 (solo ORG_CHART)** · nodes 158 · edges 157 · **layouts/styles/exports = 0** | Alto | API completi; **8/9 graph_type 0 dati live** | wiki "9 renderer terminali"; reale 1/9 popolato |
| Analytics — 9 viste BI + export | analytics | ✅ | `analytics/routes.ts:35-119` (9 GET + export CSV/JSON); rollup in-SQL (non materialized view) | Alto | done (Phase 1) | "viste" = rollup query |
| ESS Portal — modulo `me` | me, me-preferences | ✅ | `me/routes.ts` **34 route**; `app.ts:401`; **15 pagine** `/me/*`; self-scope perm `*:self` (20 in DB) | Alto | done (MVP-2b) | **catalogo sottostima**: reali 15 pag/34 endpoint vs 13/18 |
| Data-pipeline — brownfield ingestion | brownfield-* | ✅ | `000025`/`000030`; column_mappings 1225 · table_mappings 97; staging 62 tabelle; lineage 70972 | Alto | done (RTL rebuild) | I12/ADR-0023 (no-PII) |
| Data-pipeline — seed acquisition | seed-acquisition-runs/candidate-records/approval-decisions | 🔵 | `000020:10`; moduli+route presenti; **tutte le tabelle 0** (mai eseguito E2E) | Medio | scaffold dichiarato | — |
| Observability — system-health | observability | 🟡 | `observability/routes.ts:18`; web `system-health`; endpoint singolo, no telemetria persistita | Medio | base presente | — |
| Agent-gateway — Agent SDK + MCP (#9) | apps/agent-gateway (servizio separato) | 🟡 🆕 | app `@heuresys/agent-gateway`: `write-gate.ts`/`heuresys-client.ts`/`mcp-tools.ts`/`sdk-agent.ts`; core unit-tested mock; **bridge HTTP/SSE live non completato** (residuo WI-B.2) | Molto alto | gate/client testati; manca bridge live | scoperta programma post-v1 |

---

## 7. LATENTI — catalogo wiki ri-verificato sull'advanced

> Assorbe `LATENT_CAPABILITY_CATALOG.md` (wiki-derived), ri-verificato live. Il pattern è netto: le capability che il wiki dichiara dipendenti da **event-sourcing** o da **MLCE** sono bloccate alla radice perché entrambi sono assenti.

| Capability | Stato | Evidenza (absence/presence live) | Valore | Effort | Dipendenza bloccante |
|---|---|---|---|---|---|
| Capability Academy Autogen | 🔵 | building-block L&D presenti (learning-paths/gaps); **nessun generatore** (academy tables → 0) | L&D self-service | medio | learning ✅, skill-gap ✅ |
| VRIO Scorecard | ❌ | `tables ~* vrio` → **0**; nessuna entità capability da scorare | board-ready CSO/CFO | alto | **MLCE** + entità capability |
| Essential Capability Ranker | 🟡 | pesi reali (`position_kpi.rank/weight` `000137:21`, economic_weight 24, weighting_rules 3); **manca scoring 5-comp + entità capability** | budget L&D data-driven | medio-alto | MLCE / capability-entity |
| OHI Data-Driven Scorecard (OHS) | ❌ | `tables ~* ohi/organizational_health` → **0**; engagement esiste ma nessun indice salute calcolato | board continuo | alto | MLCE, dato OU-level |
| Dynamic Performance Index (DPI) | ❌ | `tables ~* dynamic/renewal` → **0**; **dipende da event-sourcing ASSENTE** | "1ª metrica dynamic capability" | molto alto | **event-sourcing** |
| Routine Mutation Analytics (RMA) | ❌ | `tables ~* routine/mutation` → **0**; richiede event-log di processo (assente) | "1ª impl. Nelson-Winter" | molto alto | **event-sourcing/process-event-log** |
| AI Augmentation Score (AAS) | ❌ (input presenti) | `tables ~* augment` → **0**; ma predictions esposte (`/v1/predictions`, models 4 · predictions 468) | KPI CIO/CDO | medio | dato OU-level augmentation |
| GCC Multi-Tenant Orchestration | 🟡 | tipizzazione enterprise reale (typing-profiles 2, operating-model 6); **manca governance cross-tenant** | enterprise multi-national | alto | cross-tenant rollup (vs isolamento attuale) |
| Regulatory Constraints Layer (RCL/CCNL) | ❌ | `tables ~* regulatory/ccnl/constraint` → **0**; comp/leave esistono come dati non vincoli | PA + regolati | alto | constraint-engine |
| Assignment Staffing Entity | ❌ | `tables ~* assignment` → falsi positivi org-persistenti; **nessuna entità employee×project×role×period** | project-based | molto alto | nuovo asse (tocca I1) |
| AI Advisor | 🔵 | `tables ~* advisor/digest` → **0**; infra notifiche + agent-gateway esterno; nessun data-layer advisor | brain prescrittivo | alto | scorecard a monte |
| Multi-Level Composition Engine (MLCE) | ❌ | `tables ~* capability/composit` → **0** (conferma Phase-0 #5); input riusabili: PIP, pesi, gerarchia | capability composta auditabile | alto | — (è il prerequisito di tutto il layer prescrittivo) |
| Capability Maturity Engine | ❌ | `tables ~* maturity` → **0** (conferma Phase-0 #6); rubrica L0-L5 solo documentale | maturity senza intervista | medio | **MLCE** |

---

## 8. 🆕 SCOPERTE (capability emerse dalla verifica, non catalogate)

| # | Scoperta | Stato | Evidenza | Valore | Effort |
|---|---|---|---|---|---|
| S-PROC1 | Apply-effects registry per approvazioni (side-effect transazionali) | ✅ | `approvals/effects/registry.ts` + `tenant-activation.ts:20-34` (flip tenant_status su apply, stessa transazione) | Alto (seme workflow-engine) | done |
| S-STRUCT1 | Org-unit template layer | ✅ | `sys_organization_unit_templates` → **225** (taxonomy tenant-less di blueprint) | Medio | done |
| S-PERF1 | Insights recompute schedulato in PROD (systemd timer, in-process) | ✅ | `insights/recompute-cli.ts:1-25` (`heuresys-advanced-insights.timer`, system-actor NIL-UUID) | Alto (pipeline analitica viva) | done |
| S-PERF2 | Continuous feedback come event-log immutabile | 🆕 | `sys_continuous_feedback` → **474** (uno dei pochissimi event-log di dominio) | Medio (materia prima signals) | esporre |
| S-PERF3 | Variable-pay calculation come signal-score | 🆕 | `sys_variable_pay_calculations` → **121** (ponte KPI→reward materializzato) | Medio | esporre |
| S-LAT1 | **Data Provenance / Trust Ledger** | 🆕 | `sys_source_lineage_records` → **70972** con `mapping_confidence`/`sdbi_ai_model_id`/`sdbi_human_approver`/`content_hash`; **0 endpoint** | **Alto** (audit AI-mapping, EU AI-Act/GDPR Art.22) | medio (read-API+UI su dati pronti) |
| S-LAT2 | Nine-Box Talent Grid live | 🆕 | `sys_nine_box_grid` **159** · `sys_talent_scores` **154** (potential+performance+band); nessun `/v1/nine-box` | Alto (talent-review board-ready) | basso (read-API+UI) |
| S-LAT3 | Multi-dimensional Position-Fit | 🆕 | `sys_employee_position_fit_scores` → **146** (fit scomposto per dimensione); no endpoint | Medio | basso-medio |
| S-LAT4 | Readiness con orizzonte temporale | 🆕 | `sys_readiness_scores` → **90** (horizon ready-now/1y/2y); no endpoint | Alto | basso |
| S-LAT5 | Reconciliation Registry + 4 VIEW integrità | 🆕 | `sys_reconciliation_registry` **111** + `v_reconciliation_status`/`v_tenant_boundary_violations`/`v_orphan_position_assignments`/`v_pip_completeness`; no `/v1/reconciliation` | Basso-medio (data-integrity dashboard) | basso |
| S-LAT6 | Skill-graph semantico sotto-sfruttato | 🆕 | edges **11965** + embeddings (skill 21939 · occ 3045) "consumati come tabelle, non come grafo" (debt) | Medio-alto (graph reasoning, emerging-skill) | medio |
| S-LAT7 | Economic-weight temporale | 🆕 | `sys_position_economic_weight` → **24** (value + period); già in PIP, non esposto stand-alone | Basso (input VRIO "Value") | basso |
| S-PLAT1 | pgvector substrate 4 entità | ✅ | 25.276 embedding totali (skill/occupation/job-role/user-profile) | Alto | done |

---

## 9. Discrepanze wiki↔advanced (sintesi)

Le sovrastime del catalogo latente (wiki-derived, in parte legacy `heuresys-evo`), corrette dalla verifica live:

1. **Event-sourcing di dominio — ASSENTE.** Solo `sys_auth_login_events` (auth). Blocca DPI e RMA alla radice (conferma Phase-0 #4). Eccezione parziale: `sys_continuous_feedback` (474) è un event-log immutabile isolato (S-PERF2).
2. **MLCE / capability_score / Maturity — ASSENTI** (Phase-0 #5/#6 confermati). Il catalogo qui è **accurato** (design-pending). MLCE è il collo di bottiglia di VRIO/OHI/Maturity/Essential-Ranker.
3. **ESCO "pieno" — SOVRASTIMATO.** Solo **25/136** ruoli mappati a ESCO; catalogo occupazioni offline (7650) + engine trgm pronti per completare.
4. **learning-gaps "calcolato" — SOVRASTIMATO.** È CRUD + import-seed; nessun recompute API (required vs current).
5. **mentor matching "semantico" — SOVRASTIMATO.** Scores legacy read-only; 0 embedding/kNN cablato (i building-block embedding esistono).
6. **"ML predictions" — read-model legacy**, non engine attivo. Insights = euristiche deterministiche spiegabili (plus AI-Act, non "ML").
7. **Visualization "9 renderer terminali" — SOVRASTIMATO.** 9 graph_type a schema, **8 con 0 dati live** (solo ORG_CHART popolato).
8. **RACI — sovrastima maturità.** RACI-style a ruolo singolo, 12 demo + 1 reale, 1 tenant ("NOT production truth").
9. **ESS — SOTTOSTIMATO** dal catalogo (15 pagine/34 endpoint reali vs 13/18 dichiarati).
10. **Pattern generale confermato**: *il valore latente è nell'orchestration/computation/API layer, non nei dati* — molte tabelle popolate sono orfane di API (Goals/OKR, Performance-review/9-box, gap-closure, behavioral-assessments, provenance, nine-box, readiness-horizon).

---

## 10. Candidati di sviluppo (ponte verso il piano)

Ordinati per leva (valore alto × effort favorevole). I primi sono "dati già live, manca solo API/UI" → basso rischio, pattern 7-step su tabelle esistenti.

**Tier A — alto valore / basso-medio effort (dati già popolati)**
- **Modulo Goals/OKR** (API+UI) — 1067 goals + 20 okr + 100 alignment già live.
- **Modulo Performance-review / 9-box** (API+UI) — reviews 161 · 360 390 · talent_scores 154 · nine_box 159 già live (assorbe S-LAT2).
- **Modulo gap-closure** (API+UI) — closure_plans 36 + actions 440 + analysis_results 270 già live.
- **Provenance / Trust Ledger read-API + UI** (S-LAT1) — 70972 record con confidence AI/umana → angolo AI-Act/explainability forte.
- **Readiness-horizon + Position-fit dimensionale** read-API (S-LAT3/S-LAT4) — score già calcolati.
- **Recompute learning-gaps** (endpoint required-vs-current) e **mentor-match via embeddings** — building-block presenti.
- **Esporre behavioral-assessments / user-assessment-evidence** (orfani con dati).
- **Completare ESCO wiring** dei 111 ruoli (engine trgm riusabile).

**Tier B — alto valore / effort alto (costruzione vera, sblocca il layer prescrittivo)**
- **MLCE Phase-1** (capability_score cross-livello + lineage) — prerequisito numerico di tutto il prescrittivo; building-block (PIP, pesi, gerarchia) pronti. *(blueprint esecutivo: `WORKITEM_GAP1_DESIGN_SPEC.md`; piano + Fase-0: `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` / `_PHASE0_VERIFICATION.md`)*
- **Capability Maturity engine (L0-L5)** sopra MLCE. *(Gap #1)*
- **Porte UI Process-Owner / Org-Director** (le 2 prospettive mancanti su 3). *(Gap #1)*
- **Approval runtime → prima istanza live + estensione** verso workflow-engine generico (riusa apply-effects S-PROC1).

**Tier C — scope-extender / strategici (aprono mercati, alto effort)**
- VRIO / OHI / Essential-Ranker (dipendono da MLCE).
- AI Advisor prescrittivo (riusa agent-gateway).
- Event-sourcing di dominio → sblocca DPI/RMA.
- RCL (PA) · Assignment Staffing (project-based) · GCC (enterprise multi-nazionale).

---

## Note, DoD e limiti

- **DoD live-data**: gli stati ✅ richiedono codice+test+dato live; le capability con codice/schema completi ma tabella a 0 righe sono 🟡 (orchestration pronta, manca dimostrazione live).
- **Copertura dichiarata**: 77/77 moduli API verificati (7 work-group) + 13 latenti del catalogo + 13 scoperte. Nessuna dimensione saltata.
- **Limiti**: i conteggi sono evidenza al 2026-06-19 (vedi anti-drift in testa). Le valutazioni di valore/effort sono stime indicative da affinare nel piano (`writing-plans`).
- **Decisioni strategiche aperte** (non sciolte qui, autorità Enzo): tesi "Organizational Intelligence" (riposizionare?) e verticale primo — vedi `BUSINESS_SCOPE_AND_PRD.md` §1.5/§2.11.
