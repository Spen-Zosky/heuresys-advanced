# Fase 0 — Verifica building-block (Gap #1: Porte Process/Org UI + scorecard prescrittiva di capability)

> Esecuzione della **Fase 0** del work-item `WORKITEM_GAP1_PERSPECTIVES_AND_SCORECARD.md` (decisione Enzo S997: "ri-verificare latent-capability su schema advanced"). Verifica fatta sullo **schema reale del repo `heuresys-advanced`** (NON sul wiki legacy `heuresys-evo`), perché `LATENT_CAPABILITY_CATALOG.md` segnala (disclaimer riga 4) che il wiki sovrastima la prontezza descrivendo in parte il legacy.
> **Metodo**: cartografia codice/migration (read-only, file:line) + **count LIVE sul DB reale** (tunnel :5433, OCI VM) — R5 / DoD live-data. Migrazioni `000001..000140`. Schema DB = `sys.*`.
> **Eseguita**: 2026-06-19 (S997).

## 1. Tabella sintetica

| # | Building-block | Stato | Evidenza (file:line) | Count LIVE (DB reale) |
|---|---|---|---|---|
| 1 | **PIP VIEW** | ✅ ESISTE | `db/migrations/000011_position_model.sql:272` `CREATE OR REPLACE VIEW sys.sys_position_intelligence_profiles_v` (VIEW non-materializzata su 6 tabelle base, JSONB proiettato a runtime via `jsonb_agg` → rispetta I9). Consumata in `modules/positions/repository.ts` | view presente |
| 2 | **Requirements tables** | ✅ ESISTE | `sys_position_skill_requirements` `000011:90`; `_kpi_` `000011:132`; `_learning_` `000011:161`; `sys_occupation_skill_requirements` `000123:34` (ESCO, seed `52`) | occupation **126051** · pos-skill **844** · pos-kpi **172** · pos-learning **1791** |
| 3 | **goal_alignments / alignment_weight** | ✅ ESISTE | `000037_sys_goals_okrs_scaffold.sql:432` `sys_goal_alignments` (`alignment_weight numeric(5,2) DEFAULT 100`, `alignment_type` SUPPORTS/CONTRIBUTES_TO/DERIVED_FROM/DEPENDS_ON) | **100** (allineamento goal↔goal, NON goal↔capability/position) |
| 4 | **event-sourcing / talent-signals** | ❌ ASSENTE | Nessuna tabella `*event*`/`talent_signal`/event-store di dominio. Unici "log": `sys_goal_check_ins`/`sys_goal_updates` (goal-specifici, `000037`), `sys_auth_login_events`/`sys_auth_mfa_exemption_audit` (auth/MFA), `sys_inbox_notifications` (ESS) | absence-check live: solo `sys_auth_login_events` matcha `event` → **nessun domain event-store** |
| 5 | **capability_score / composition (MLCE)** | ❌ ASSENTE | Zero match `capability_score`/`composite_score`/`composition`/`mlce` in migrations+modules+shared (unico hit "capability" = `auth/service.ts:169` "MFA capability", falso positivo) | absence-check live: **0 tabelle** → MLCE da costruire da zero |
| 6 | **maturity L0-L5** | ❌ ASSENTE | Zero match `maturity` (case-insensitive) in migrations+modules. Solo in `docs/` | absence-check live: **0 tabelle** → engine + rubrica da costruire |
| 7 | **organization-unit-processes / RACI** | ⚠️ PARZIALE | `sys_organization_unit_processes` `000121:23` + modulo API completo (`/v1/organization-unit-processes`). **NON matrice RACI**: 1 sola colonna `org_unit_process_role` CHECK OWNER/CONTRIBUTOR/CONSULTED/INFORMED (`000121:37`, "RACI-style"). Demo seed `54_raci_demo_rtl_s994.sql` | **13 righe** (OWNER 9 · CONTRIBUTOR 2 · CONSULTED 1 · INFORMED 1) = 12 demo + 1 reale, solo RTL_BANK, "NOT production truth" |
| 8 | **blueprint-* / activation + assenza BPM runtime** | ✅ catalog / ⚠️ runtime parziale | Moduli `blueprint-{families,variants,processes,overrides,activations}`; catalogo `sys_blueprint_process_registry`. **Nessun** `process_instance`/`task_instance`/`sla` engine generico. **Approvals S995** = primitiva BPM runtime: `000132_approval_runtime.sql:30` `sys_approval_requests` (state-machine) + `:95` `sys_approval_steps` (ledger). Header `000132:5`: "first executable BPM primitive: generic approval runtime" | (approval runtime esiste; non workflow-engine completo) |
| 9 | **insights (flight-risk/succession/skill-gap)** | ✅ ESISTE | `sys_flight_risk_scores` `000082:27`; `sys_succession_readiness_scores`+`sys_skill_gap_scores` `000092`; modulo `insights/`, recompute endpoints, UI `000091`/`000093` | flight-risk **159** · succession **462** · skill-gap **154** (per-soggetto, NON cross-livello) |
| 10 | **RBAC ruoli/permission delle porte** | ⚠️ PARZIALE | Ruoli `PROCESS_OWNER`/`BLUEPRINT_MANAGER`/`HRMS_MANAGER` esistono (`000005:236`); **`ORG_DIRECTOR` NON esiste**. Permission `process-owner:read`/`org-director:read`/`capability:read` = 0 match (RBAC è per-risorsa, non per-porta) | da creare: ruolo ORG_DIRECTOR + 3 permission porta |
| 11 | **Web routes — prospettive/"porte"** | ⚠️ 1 di 3 | 64 dir route in `apps/web/src/app/(authenticated)`. `processes/page.tsx:38` + `organization/page.tsx` esistono ma sono **DataTable list read-only**, non porte. App interamente HR-centrica (`me/*`, `positions`, `skills`, `kpis`, `analytics/*`, `insights/*`) | conferma claim "3 prospettive promesse, 1 implementata": **no** Porta Process-Owner né Org-Director come prospettiva dedicata |

org-units **26** · positions **162** (RTL_BANK + HEURESYS).

## 2. Gap dati reali (cosa manca per MLCE Phase-1 + Maturity + 2 Porte)

**MLCE Phase-1** — da costruire da zero: tabella capability_score / composition / lineage cross-livello (employee→position→org-unit→org) + entità `capability` di prima classe (oggi skill/KPI vivono a livello position/occupation, nessun raggruppamento capability né mappa skill→capability). **Input riusabili presenti**: PIP VIEW (#1), requirements incl. ESCO 126k (#2), insights per-soggetto (#9), gerarchia org (`position_reports_to_position_id`), pesi (`weight`/`criticality`/`position_economic_weight`). Manca un feeder event/signal (#4) → ricomposizione via query batch + `*_computed_at` (pattern insights riusabile).

**Maturity Engine** — tutto assente (#6): tabella score + rubrica codificata + funzione di derivazione SQL + permission + UI. Dipende a monte dall'output numerico MLCE.

**2 Porte UI** — zero route dedicate (#11). RBAC parziale (#10: serve `ORG_DIRECTOR` + permission porta). Dati Process-Owner parziali: `organization_unit_processes` (RACI-style **demo 12 righe** su RTL → serve popolazione reale = decisione Enzo) + catalogo processi. Approval runtime (#8) c'è ma non c'è scorecard/runtime per OU.

## 3. Discrepanze wiki-vs-advanced (dove il catalogo latente sovrastima)

1. **Event-sourcing — SOVRASTIMATO.** Catalogo righe 27/42 ("DPI/RMA sfruttano event-sourcing", "asset event-sourcing dichiarato presente"): nel repo advanced **non esiste alcun event-store di dominio** (#4, confermato live). Solo log goal-specifici + audit auth. È esattamente il caso previsto dal disclaimer (legacy evo).
2. **Maturity — lieve sovrastima.** "rubric stabile; engine design-pending" (riga 23): la rubrica è **solo documentale**, nel codice 0 (#6).
3. **RACI — sovrastima di maturità.** Modulo reale ma "RACI-style" a ruolo singolo e popolazione **demo su tenant TEST** ("NOT production truth"), non dati di produzione (#7).
4. **goal_alignments — scope più stretto del percepito.** Esiste (#3, 100 righe) ma è goal↔goal, non goal↔capability/position.
5. **MLCE / capability_score — catalogo ACCURATO** (design-pending, confermato assente). Nessuna sovrastima.
6. **Porte UI — catalogo ONESTO e allineato** ("zero pagine, solo HR"): verifica indipendente conferma 1/3 (#11).

## 4. Verdetto Fase 0

La tesi del Discovery regge sui fatti: **il valore latente è nell'orchestration/computation layer, non nei dati**. I dati abilitanti esistono e sono popolati live (ESCO 126k, PIP, requirements, insights, gerarchia org 26 OU / 162 pos). Mancano da costruire, in ordine di dipendenza: (1) **MLCE Phase-1** (prerequisito numerico), (2) **Maturity engine** (consuma MLCE), (3) **Porte UI** Org-Director + Process-Owner (RBAC `ORG_DIRECTOR` + 3 permission). **Nessun event-sourcing** da cui ripartire → MLCE userà ricomposizione batch (pattern insights). La RACI reale (popolazione produzione) resta **input prodotto di Enzo**.

→ Le Fasi 1-5 del work-item restano valide; effort stimato **~7.5-9 person-week** (additivo, nessun rewrite). Aperte come item di backlog **Gap #1** (non eseguite in questa sessione — fuori dallo scope della decisione "verifica + adozione SoT").
