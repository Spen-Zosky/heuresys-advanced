# DBMS Health-Check & Live-E2E Coverage — Report forense

**Data:** 2026-06-22 (S1004) · **DB:** `heuresys_advanced` @ OCI VM (tunnel :5433) · **Tenant reference:** RTL Bank (`86ba7a65…`, FIN_BANKING, M) + Heuresys System (S)
**Metodo:** census SQL deterministico (ground-truth) + workflow multi-agente 30 subagent (map+verify ⨯ adversariale anti-placeholder) su 73 pagine.
**Artefatti dati:** `rowcount_all_tables.csv` (263 tabelle) · `sys_column_completeness.csv` (1854 colonne, NULL-%) · `webapp_coverage_matrix.csv` (73 pagine).

---

## 0. Verdetto

Il DBMS è **strutturalmente sano e popolato sui domini core** (org, posizioni, utenti, skill-taxonomy, learning, KPI, attendance, performance, succession-scores). Integrità referenziale e isolamento tenant **puliti** (tutte le viste-guardrail a 0 violazioni). La maggioranza delle superfici web pesca dati reali live (**46/73 LIVE**). I problemi non sono di integrità ma di **copertura**: alcune funzioni hanno il serbatoio vuoto (gap-dati) e alcune pagine hanno un **disallineamento contratto API↔frontend** (gap-codice, indipendente dai dati — alcuni provocano crash/placeholder).

---

## 1. Inventario strutturale (verificato)

| Schema | Tabelle | Viste | Size | Ruolo |
|---|---|---|---|---|
| `sys` | 188 | 13 | 663 MB | business core |
| `staging` | 62 | 0 | 13 MB | ingestion temp (molte consumate/vuote) |
| `audit` | 5 | 0 | 548 MB | import logs (1.55M validation results) |
| `brownfield` | 8 | 0 | 1.8 MB | column/table mappings |
| `public` | 0 | 2 | — | pg_stat_statements |

Constraint: **545 FK · 220 PK · 340 CHECK · 22 UNIQUE**. Viste-guardrail (`v_orphan_position_assignments`, `v_tenant_boundary_violations`, `v_positions_without_job_role`, `v_synthetic_user_flag_consistency`, `v_canonical_outside_sys`, `v_inbox_resource_consistency`, …) tutte a **0 righe = nessuna violazione**. PIP popolata (`sys_position_intelligence_profiles_v` = 162). Migrations applicate: 151.

---

## 2. Completezza dati core (verificato)

### 2.1 Utenti (162 — 159 ACTIVE, 3 DEACTIVATED, tutti reali non-synthetic)
Anagrafica base completa (nome/cognome 162/162; email/display_name NOT NULL). Satelliti (utenti **senza** riga):

| Satellite | Senza riga / 162 | Lettura |
|---|---|---|
| `sys_user_professional_experiences` | **162** (tabella vuota) | gap-dati totale |
| `sys_user_target_positions` | **162** (vuota) | gap-dati totale |
| `sys_user_career_plans` | 105 (solo 57 coperti) | gap-dati parziale |
| `sys_auth_identities` (può loggare) | 150 (solo 12 con credenziali) | atteso (employee-centric I14: persona ≠ account) |
| `sys_user_preferences` | 158 (solo 4) | atteso (creato on-demand) |
| `sys_user_profiles` | 5 · `position_assignments` | 2 · `education` 5 · `certifications` 8 · `skill_evidence` 6 | gap minori |

Campi profilo critici: `user_profile_linkedin_uri` **0/156** · `user_profile_bio` **1/156** (entrambi vuoti per quasi tutti).

### 2.2 Tassonomie (le tabelle che descrivono skill/occupation/classificazioni)

| Tassonomia | Righe | Note completezza |
|---|---|---|
| `sys_skills` (catalogo) | 21.939 | `skill_kind` 14.036/21.939 · `skill_group_uri` ~12.892 · `skill_category_id` **31/21.939** (quasi nessuna categorizzata) |
| `sys_occupation_skill_requirements` | 126.051 | ESSENTIAL 67.600 / OPTIONAL 58.451 (100% risolte) |
| `sys_skill_taxonomy_edges` | 11.965 | gerarchia skill |
| `sys_esco_occupation_mappings` | 7.675 | occupation ESCO |
| `sys_activity_classifications` (ATECO/NACE) | 6.533 | + `…_mappings` 5.730 |
| `sys_job_roles` / `sys_job_families` | 136 / 27 | ruoli/famiglie |
| `sys_skill_families` / `sys_skill_categories` | 77 / 7 | famiglie ok; categorie usate solo da 31 skill |
| `sys_skill_aliases` / `sys_skill_proficiency_levels` | 80 / 6 | — |

**Gap mapping notevole:** `sys_positions.position_esco_occupation_uri` = **100% NULL** → le 162 posizioni non sono linkate a un'occupation ESCO.

### 2.3 Tabelle `sys` vuote (34) — classificate

**Vuote BY-DESIGN (attese, non gap)** — 22: MFA effimere/self-enroll (`auth_mfa_otp_challenges`, `_recovery_codes`, `_webauthn_credentials`, `_exemptions`, `_exemption_audit`), `auth_sessions` (si usano refresh-token), `*_history`/`organization_unit_history`/`position_skill_requirement_history` (audit), `organization_hierarchies` (D-35: closure-table intenzionalmente non-usata, si usa adjacency+CTE), `seed_*` ×5 (pipeline seed-acquisition mai girata), `visualization_{layouts,node_layouts,styles,exports}` (config a runtime), `payroll_handoff_records`, `leads` (svuotato post-test GTM), `content_{categories,media}`.

**Vuote = GAP-DATI reali** — 12: `sys_user_professional_experiences`, `sys_user_target_positions`, `sys_notification_preferences`, `sys_approval_requests` + `sys_approval_steps` (BPM mai usato), `sys_reward_gates` + `sys_reward_gate_results` (+ `reward_gate_catalog` 7), `sys_blueprint_activations` + `sys_blueprint_overrides`, `sys_process_kpi_templates`, `sys_payout_curves`, `sys_successor_readiness` (ridondante: succession ha dati in `sys_succession_readiness_scores`=462).

---

## 3. Matrice copertura webapp → dati live E2E

**73 pagine** · **46 LIVE (63%)** · **19 PARTIAL (26%)** · **8 EMPTY (11%)**. Dettaglio per-pagina: `webapp_coverage_matrix.csv`.

### 3.1 EMPTY — la pagina mostra solo empty-state (8)

| Pagina | Sorgente vuota | Classe |
|---|---|---|
| `me/career` | `sys_user_target_positions` = 0 | gap-dati |
| `approvals` · `approvals/[id]` | `sys_approval_requests`/`_steps` = 0 (anche `seed_approval_decisions`=0) | gap-dati (BPM mai usato) |
| `me/handbook` · `me/handbook/[id]` | `content_documents` published = **0 globale** (121 doc esistono ma 0 PUBLISHED, tutti E2E-leftover) | gap-dati |
| `seed-acquisition/runs` | `seed_acquisition_runs` = 0 (5 tabelle seed vuote) | by-design (pipeline mai girata) |
| `compensation-intelligence` | `reward_gates`/`reward_gate_results` = 0 | gap-dati |
| `positions/[positionId]/learning` | `sys_learning_gaps` per-posizione (i gap sono per-user) | gap-dati/modello |

### 3.2 PARTIAL — dati parziali o colonna/contratto rotto (19, evidenza in CSV)

**Gap-DATI (colonna vuota / copertura parziale):**
- `me/profile` — bio 1/156 + linkedin 0/156 NULL (form quasi vuoto su quei campi)
- `positions/[positionId]` — `position_economic_weight` 0/158 NULL (campo "Peso economico" vuoto)
- `positions/[positionId]/skills` — 844 requirement su 148/162 posizioni (14 posizioni senza requisiti)
- `gaps` / `me/gaps` — righe reali ma colonne skillName/position non risolte
- `learning` — `durationMinutes` sparso (912/7427) · `learning/training-initiatives` — 1 sola riga RTL e sembra fixture negativa (`_BAD_FAC`)
- `content` / `content/[id]` — list+FTS live (121 doc) ma categorie 0, media 0, tutti i doc sono E2E-leftover (0 published)
- `me/inbox` — 50 notifiche reali ma solo `tommaso` ne ha (admin canonico vede empty); sotto-panel approvals morto
- `engagement/[surveyId]` · `me/surveys/[surveyId]` — live solo per i survey con questions (1-3 su più assegnati)
- `system-health` — KPI/auth/RBAC live; audit-feed vuoto (`user_self_service_actions`=0) + sparkline errori volatili

**Gap-CODICE (contratto API↔frontend rotto — INDIPENDENTE dai dati, sono BUG):**
- 🔴 `brownfield-adaptation` — **tab Inventory CRASHA**: `page.tsx` legge `e.capturedAt.slice(0,19)` senza optional-chaining ma l'API ritorna `retrievedAt` (campo `capturedAt`/`sourceSystem`/`rowCount` inesistenti) → `undefined.slice()` TypeError → 4 export reali non mostrati. Tab Mapping degradato (`sourceTable`→`sourceTableId`). Tab Runs OK (902 righe).
- `positions/[positionId]/kpis` — interface attende `kpiCode`/`kpiName`, l'API li espone con altro shape → colonne vuote (dati KPI reali esistono)
- `me/kpis` — backing reale (248 evidence) ma DISGIUNTO da ciò che la pagina legge
- `me/learning` — repo ritorna `pathId/status` ma la pagina dichiara `learningPathName` (mai fornito)
- `tenants/[tenantId]` — typing-tab legge `p.status`/`blueprintFamilyId`/… campi inventati non presenti nello schema canonico → `StatusBadge` rende em-dash; i campi reali ricchi (regulatory/employees/country) ignorati
- `blueprints` — colonna "Industry" legge `industryCode` mai ritornato da `toFam()` → sempre N/A

### 3.3 LIVE confermati (46, campione)
users (158) · users/[id] · me/positions · me/security · organization (23 OU) · org-chart (grafo 158 nodi/157 edge) · positions (158) · skills (21.939) · me/skills · me · me/team · me/documents (657) · dashboard · admin/roles (681 mapping) · admin/mfa-policy · tenants (2) · visualizations · analytics/org-network (CTE ricorsiva su 158 posizioni, span/depth/reach reali) · processes (23) · me/surveys · engagement · goals · okrs · learning/* · career-succession · insights/* · analytics/{skills,compensation,workforce,attendance,kpi} …

---

## 4. Piano di recupero (prioritizzato)

### P1 — Gap-CODICE (bug, non richiedono dati; alcuni rompono la pagina)
1. **`brownfield-adaptation` Inventory crash** — allineare l'interface della pagina ai campi reali (`retrievedAt`/`name`/`status`) + optional-chaining. *(crash → priorità massima)*
2. **`tenants/[tenantId]` typing-tab** — usare i campi reali dello schema `EnterpriseTypingProfileSchema` (regulatory_intensity/employee_count/country) invece di `status`/`blueprint*` inventati.
3. **`positions/[positionId]/kpis`, `me/kpis`, `me/learning`, `me/gaps`, `blueprints` Industry** — riconciliare il contratto shared-Zod ↔ interface di pagina (i dati esistono, è il binding sbagliato).

### P2 — Gap-DATI azionabili (popolamento su RTL Bank, tenant di produzione customer-example, dati trattati come reali — ADR-0026)
4. **`me/career` + career plans** — popolare `sys_user_target_positions` e completare `sys_user_career_plans` (57→162).
5. **`me/handbook`** — pubblicare contenuti reali (oggi 0 PUBLISHED; i 121 doc sono E2E-leftover → ripulire + seedare contenuti veri).
6. **`me/profile`** — popolare `bio`/`linkedin_uri` (oggi ~0).
7. **`approvals` + `compensation-intelligence`** — generare richieste di approvazione e reward-gate dimostrative (BPM/reward mai esercitati).
8. **`sys_user_professional_experiences`** — gap totale 162/162 (decisione: serve per CV/matching?).
9. **`position_esco_occupation_uri`** — linkare le 162 posizioni a occupation ESCO (sblocca matching occupation-driven).

### P3 — Igiene / by-design
10. Ripulire E2E-leftover (`content_documents` 121, `E2E Test Cert`, refresh-token 47k). Documentare le 22 vuote-by-design come tali (no azione).

---

## 5. Knowledge base & ripetibilità

Questo report + i 3 CSV sono la base statica. Il flusso **graphify-db-input** (rami `schema/` + `data/`) viene esteso per rendere il check **ripetibile/aggiornabile** (`scripts/db-health-graph.sh`: `_export.sql` esteso → `05_data_health.md` + `06_webapp_coverage.md` → `/graphify --update`) così la mappa relazionale resta viva e interrogabile. Vedi `graphify-db-input/` e il grafo in `graphify-out/`.
