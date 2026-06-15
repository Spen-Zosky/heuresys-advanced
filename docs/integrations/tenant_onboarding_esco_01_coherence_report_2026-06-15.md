# Coherence Report — "ESCO multi-pilastro + Skills Group Share" & "Tenant Onboarding (HEU-FLOW-001)" vs repository reale

> **Status**: ANALYSIS — read-only, no repo change. Staging non committato (decisione Enzo 2026-06-15).
> **Sessione**: verifica design · **Data**: 2026-06-15 · **Repo**: `D:\heuresys-advanced` @ `main fffb1d7`
> **DB**: `heuresys_advanced` live via tunnel `localhost:5433` (psql 16, schema `sys`, 176 tabelle base).
> **Metodo**: 4 agenti Explore read-only + verifica diretta `@heuresys/ui@0.1.6/dist/index.d.ts` + ~40 query SQL read-only. Tutte le asserzioni negative sono verificate (grep/glob/read/psql).
> **Sorgenti analizzate**: `D:\enzospenuso\Desktop\Ricerca ESCO multi-pilastro + grafico Skills Group Share.md` · `D:\enzospenuso\Desktop\Tenant Onboarding — Flusso di prototipazione.md`.

---

## 0. Verdetto in una riga

I due documenti sono **fattualmente accurati sui componenti UI e descrivono correttamente il dominio**, ma divergono dal repo su tre piani: (a) il File-2/ltree **viola un invariante non-negoziabile** (I3/I4) e propone tecnologie assenti (ltree, Neo4j); (b) entrambi presumono **generazione/fetch che il repo non fa** (il repo importa da brownfield + ingerisce ESCO server-side, non genera AI né fa fetch client-side); (c) il vero collo di bottiglia **non è lo schema** — già quasi tutto modellato — ma il **popolamento**: tre tabelle-chiave sono vuote o solo-scaffold proprio dove i documenti vogliono lavorare.

---

## 1. File 1 — "ESCO multi-pilastro + Skills Group Share"

### 1.1 Accuratezza dei riferimenti UI — COERENTE (28/28)

Tutti i 28 componenti/util citati come "verificati in `index.d.ts`" **esistono davvero** in `@heuresys/ui@0.1.6` (consumata `^0.1.6` in `package.json` root + `apps/web` + `apps/showcase`), con le firme dichiarate.

| Simbolo | Esiste | Firma reale (`dist/index.d.ts`) |
|---|---|---|
| `EChartsCard` | ✅ | `:910` — props `{option:EChartsOption; height?; loading?; className?; onEvents?; ariaLabel?}` (6/6 combaciano) |
| `echartsPresets` | ✅ | `:914-968` — `.line .bar .pie .heatmap .sankey .funnel .treemap .radar .gauge` (9/9) |
| `ESCOTreeNavigator` + `ESCOTreeNode` | ✅ | `:1930` / `:1916-1923` — node `{uri; code\|null; label; iscoCode\|null; hasChildren; parentUri\|null}` |
| `KgMiniGraph` / `NetworkGraph` / `KGGraphCanvas` | ✅ | `:1807` / `:1061` / `:1948` |
| `CapabilityRadar` / `SkillHeatmap` | ✅ | `:1857` / `:1834` |
| `parseCSV/JSON/Excel/XML` | ✅ | `:1348/1358/1356/1360` |
| `exportCSV/Excel`, `downloadAsFile` | ✅ | `:1355/1357`, `:683` |
| `FilterBar/Pagination/Badge/Spinner/EmptyState/ErrorState/JsonTree/DataTable` | ✅ | `:346/444/169/172/182/186/1336/310` |
| `Card*` | ✅ | `Card/Header/Title/Description/Content/Footer` `:34-39` (NB: **nessun `CardAction`**) |
| `formatPercent/formatNumber/formatList` | ✅ | `:1542/1541/1546` |

**Conclusione**: il documento NON allucina sulla UI. Unico scostamento minore: `CardAction` inesistente (non richiesto esplicitamente).

### 1.2 Sourcing dati — il repo ha GIÀ una strada, diversa da quella proposta

| Aspetto | Documento propone | Repo reale | Verdetto |
|---|---|---|---|
| Fetch ESCO | client-side via TanStack Query (`useEscoSearch`, `NEXT_PUBLIC_ESCO_API`) dal browser | **server-side**: `apps/api/src/modules/reference-sync/esco-connector.ts` chiama `https://ec.europa.eu/esco/api/search` e **ingerisce nel DB** (`sys_esco_occupation_mappings`, 7675 righe) | **DIVERGENTE (architettura)** |
| ATECO/NACE | A3 dump CSV/ODS/TTL manuale | `istat-ateco-connector.ts` scarica l'**XLSX ufficiale ISTAT** (`StrutturaATECO-2025-IT-EN-DE.xlsx`) e popola `sys_activity_classifications` (ATECO_2025 = 3257) | repo già oltre |
| Contratti shared | crea `esco.schema.ts` + `SkillGroupShare`/`buildShare` | **ASSENTI** (glob+grep a vuoto); esistono `reference-sync.ts`, `semantic-matching.ts`, `analytics.ts`, famiglia `skill-*`, `activity-classifications.ts` | **ASSENTE (da creare)** |

**Punto critico architetturale**: il fetch ESCO client-side contraddice la dottrina del repo (*MVP-2a/2b — LIVE DATA E2E ONLY*: ogni pagina legge da `/v1/*` sul DB, niente chiamate a servizi esterni dal browser). La strada coerente è **un endpoint `/v1/*` che serve dati ESCO già ingeriti nel DB**, non `fetch()` verso `ec.europa.eu` dal componente. L'API ESCO live resta utile solo come fonte di *ingestion server-side* (come già fa `reference-sync`).

### 1.3 Grafico "Skills Group Share" — ASSENTE, e i dati per costruirlo mancano

- La torta occupazione→gruppi-competenze **non esiste** (grep `GroupShare|skill.*group.*share|pie.*occupation` a vuoto su `apps/`).
- Già esistono `/analytics/skills` (heatmap coverage OU×proficiency, nav mig 000068) e `/analytics/skills-by-category`. `CapabilityRadar`/`SkillHeatmap`/`ESCOTreeNavigator` **non sono consumati da nessuna pagina web** (solo `EChartsCard`/`echartsPresets`).
- **Blocco dati reale**: il grafico richiede (A) occupation→skill essential/optional e (B) skill→gruppo (`broaderHierarchyConcept`). Nel DB: (A) esiste solo come **dump legacy 126.051 righe** (`db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupation_skills.sql`, 67.600 essential + 58.451 optional) classificato **`REFERENCE_ONLY` e mai importato** in `sys.*`; (B) `skill_metadata->>'skill_group_uri'` è **popolato su 0/21.939 skill**. → Oggi il grafico **non è alimentabile dal DB**, solo via API ESCO live on-demand.

### 1.4 Imprecisioni del documento (factual)

| Affermazione documento | Realtà verificata |
|---|---|
| `sys_position_skill_requirements` "vuoto" | **844 righe** (derivate da peer-group-prevalence, mig `000096` — posteriore alla stesura) |
| `sys_skills` "~20073" | reale **21.939** |
| modulo "matching" | reale **`semantic-matching`** (rotte sotto `/v1/matching/*`, gate `VOYAGE_API_KEY`) |
| occupazioni ESCO "~2942" | embeddings occupation = **3045**; mappings catalogo = 7650 |

---

## 2. File 2, parte (i) — Schema NACE/ATECO con `ltree`

### 2.1 Confronto schema — DIVERGENTE su tutta la linea

| Dimensione | Proposta `nace_classification` | Repo reale `sys.sys_activity_classifications` (mig `000007:16-27`) |
|---|---|---|
| Schema namespace | tabella **fuori da `sys.*`** | `sys.sys_activity_classifications` |
| Gerarchia | `path ltree` materialized-path (`J.62.620.6201`) | **adjacency-list by-code** (`activity_classification_parent_code varchar(32)`) |
| Livelli | `level_type` text + CHECK level↔depth + `depth GENERATED nlevel(path)` | `activity_classification_level smallint` |
| Estensione | richiede `CREATE EXTENSION ltree` | **ltree NON installato** (estensioni reali: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `vector`) |
| Re-parent | trigger `nace_set_path` + funzione `nace_move_subtree` | nessuno (solo `set_updated_at`) |
| Crosswalk | `MATERIALIZED VIEW ateco_to_nace` | **tabella relazionale** `sys_activity_classification_mappings`, **5730 righe** (NARROWER 2865 + BROADER 2865), mig `000007:63-72` + popolata `000112` |
| Export grafo | CSV → **Neo4j** (`neo4j-admin import`, APOC, Cypher) | **nessun Neo4j** nello stack; il grafo è `graphify` (esterno al repo) + `sys` viz model (`000022`) + pgvector |

### 2.2 Violazione di invariante — punto bloccante

Il documento crea esplicitamente `nace_classification` *"NON nello schema `sys.*`"*. Questo **viola I3/I4** (`CLAUDE.md:186`):

> *"I3/I4 Schema discipline: business tables live in `sys.sys_<plural>`. Aux schemas are `staging`, `brownfield`, `audit`. Never `usr_*` / `br_*` / etc."* — invariante "non-negotiable, enforced architecturally, **cannot be revisited without a new ADR**" (`CLAUDE.md:183`).

Inoltre vive fuori dalla numerazione `db/migrations/000NNN`. La parte **concettuale** del documento (tassonomia ⊂ ontologia, semantica simbolica vs vettoriale, thesaurus/SKOS, regole/reasoner, identità/naming, provenance) è **didatticamente corretta e ben mappata** sullo stack (PostgreSQL relazionale + `graphify` + `claude-mem`/pgvector). Ma lo **schema concreto ltree + Neo4j è incompatibile** con l'architettura e già **funzionalmente coperto** dal modello relazionale.

**Conclusione parte (i)**: il problema che il documento risolve (gerarchia NACE/ATECO + crosswalk + proiezione a grafo) **è già risolto** con pattern diverso e conforme (adjacency-by-code + crosswalk bidirezionale + ATECO_2025). ltree darebbe query di sottoalbero più ergonomiche ma a costo di nuova estensione + ri-modellazione + violazione invariante → **trade-off sfavorevole**. Semmai si aggiungono *recursive view* helper sul modello attuale (vedi report §6, non eseguire).

---

## 3. File 2, parte (ii) — "Tenant Onboarding" (HEU-FLOW-001 v0.1)

Copertura fase-per-fase (S = schema, D = dato live):

| Fase / entità | Stato | Evidenza (S / D) |
|---|---|---|
| **F0** tenant name | ESISTE | `sys_tenancies` — 2 tenant (RTL_BANK FIN_BANKING M · HEURESYS S) |
| **F0** classificazione NACE/ATECO 4 livelli | **PARZIALE** | catalogo `sys_activity_classifications` S✅ D✅ (6533: ATECO 2210 / ATECO_2025 3257 / NACE 1066); legame al tenant via `sys_enterprise_typing_profiles` (mig `000007:128`) S✅ **D✗ (unico profilo = HEURESYS, tutti i FK NULL)** |
| **F0** dimensione/tipologia impresa | **PARZIALE** | `sys_enterprise_size_bands` + `sys_operating_model_catalog` S✅; sul tenant solo `tenant_size_band` (varchar CHECK XS..XL); profilo strutturato **vuoto** |
| **F1** processi di business tipici | ESISTE (catalogo) | `sys_blueprint_*` (mig `000008`): 1 family (FIN_BANKING) / 1 variant (REGIONAL_RETAIL_BANK_MEDIUM) / **23 process** / **0 attivazioni** — è catalogo tenant-less, non BPM runtime |
| **F1** OU + gerarchia | ESISTE | 26 OU (`organization_unit_parent_id` self-FK); **closure-table `sys_organization_hierarchies` = 0 righe** |
| **F1** ruoli/job position/job description + gerarchia | ESISTE | job_roles 136 (25 con ESCO mapping), families 27, positions 162 (159 con `position_reports_to_position_id`) |
| **F1** assegnazione OU↔processi | **ASSENTE** | nessuna tabella di join (grep a vuoto); solo accoppiamento indiretto via KPI-template |
| **F1** assegnazione organico↔OU | ESISTE | position↔OU (`position_organization_unit_id`) + `sys_user_position_assignments` |
| **F3** skill portfolio per ruolo | ESISTE (ma derivato) | `sys_position_skill_requirements` 844 — **da prevalenza tra incumbent (`peer-group-prevalence-v1`), NON da occupation ESCO** |
| **F3** classificazione skill hard/soft/live/conoscenze | **ASSENTE (schema)** | solo `skill_category_id` (7 categorie comportamentali, **31/21939 valorizzate**); `skill_type` ESCO skill/knowledge popolato 14036 in `skill_metadata` jsonb |
| **F3** cluster skill per ruolo/OU/processo | **ASSENTE** | nessuna tabella cluster/skill_group (`information_schema` → 0) |
| **F3** KPI/metriche/assessment | ESISTE | kpi_definitions 243, targets 248, org_unit_templates 100, **process_templates 0** |
| **F3** carriere / formazione / successioni | ESISTE | career_paths 28 (steps 35), learning_modules 7427 (paths 4667), succession_pools 17 (candidates 25) |
| **F0/F1/F3 come "ricerca AI augmented" (GENERA da NACE+size)** | **ASSENTE** | nessun generatore/recommender; dato attuale = **import brownfield + seed Faker deterministico** (`db/scripts/seed-reference-bank.ts`, seed=42), non AI-generato |

**Le tre lacune specifiche del flusso**: (1) legame tenant→NACE/ATECO+size **valorizzato** (schema c'è, dato no); (2) **assegnazione OU↔processi**; (3) il **motore di generazione AI-augmented** del reference environment — quest'ultimo coincide con **#9 WI-C `tenant-materialization`** (esplicitamente *"not built yet"*, `apps/agent-gateway/src/mcp-tools.ts:86`) + recommender typing→variant (D3, **rinviato** per decisione #9). Manca anche la **FASE 2** (annotata nel documento stesso).

---

## 4. Relazione tra i due documenti

Sono **complementari**: la **FASE 3-ESCO** del File 2 (skill portfolio per ruolo da job-description+occupation, classificazione, cluster) è esattamente ciò che il File 1 implementa tecnicamente. Convergono sullo stesso blocco-dati: senza `occupation→skill` e `skill→gruppo` popolati, né il grafico né lo skill-portfolio-da-occupation sono realizzabili dal DB. → I deliverable di popolamento (spec ESCO) sono **prerequisito comune**.

---

## 5. Debiti tecnici emersi

| ID locale | Debito | Sev | Stato registro |
|---|---|---|---|
| **DT-A** | `sys_enterprise_typing_profiles` di fatto vuoto (FK industry/size/operating-model NULL su entrambi i tenant) → FASE 0 non istanziata | 🟡 | **D-31** (registrato 2026-06-15) |
| **DT-B** | campi gerarchia ESCO (`skill_group_uri`, `broader_uri`, `narrower/related/reuse/isco_groups/primary_category/cognitive_level`) = **0/21939** popolati (scaffold morto in `skill_metadata`) | 🟡 | **D-32** (registrato 2026-06-15) |
| **DT-C** | occupation→skill (126k righe legacy) `REFERENCE_ONLY`, mai importate → nessuna derivazione skill-da-occupation | 🟡 | **D-33** (+ parz. `SOT_BACKLOG` B-50(b)) |
| **DT-D** | solo 31/21939 skill categorizzate; nessuno schema hard/soft/conoscenze sopra `skill_type` ESCO | 🟢 | **D-34** (registrato 2026-06-15) |
| **DT-E** | closure-table `sys_organization_hierarchies` = 0 (gerarchia OU vive solo sul `parent_id`) | 🟢 | **D-35** (registrato 2026-06-15) |
| (esistente) | `process_kpi_templates` 0, `blueprint_activations` 0 | 🟢 | noto (reconciliation registry) |
| (govern.) | proposta ltree/Neo4j viola I3/I4 → richiederebbe ADR | 🔴 se eseguita | — |

> Questi debiti sono stati registrati in `docs/kb/DEBT_REGISTER.md` come **D-31..D-35** (2026-06-15, staging non committato): DT-A→D-31, DT-B→D-32, DT-C→D-33, DT-D→D-34, DT-E→D-35.

---

## 6. Raccomandazioni di sintesi

- **File 1 (UI/ESCO)**: accurato, eseguibile — ma **riportarlo all'architettura del repo**: endpoint `/v1/*` server-side che legge dati ESCO già ingeriti (non fetch client-side), contratti in `@heuresys/shared`, grafico come composizione di `EChartsCard`. Prerequisito dati = spec popolamento ESCO (file `03`).
- **File 2 ltree/Neo4j**: **non eseguire come scritto** (viola I3/I4, stack assente, già coperto). Tenere la parte concettuale come nota di architettura; per ergonomia di traversal → *recursive view* sul modello adjacency-by-code attuale, non ltree, e niente Neo4j (il grafo è `graphify`, esterno).
- **File 2 Tenant Onboarding**: **scheletro dati esistente ~90%**; il valore è in tre popolamenti + il motore generativo (file `02`/`04`). Decidere se la "ricerca AI augmented" *genera* o *raccomanda-poi-conferma* è la decisione di prodotto aperta (autorità Enzo).

## 7. Deliverable collegati (questa sessione)

- `02_dbms_population_todo_2026-06-15.md` — TODO list Tier 1-3 eseguibile.
- `03_esco_population_spec_2026-06-15.md` — spec backfill `skill_group_uri`/`broader` + import occupation→skill (conforme I3/I4).
- `04_tenant_onboarding_spec_2026-06-15.md` — spec legame tenant→NACE/size + OU↔processi + motore generativo (aggancio #9 WI-C).
