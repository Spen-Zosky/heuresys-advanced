# WS-T5 — Data & DBMS Architecture
> Due diligence investor-grade. Pilastro T5 (peso 5). Auditor: Claude Sonnet 4.6 — ruolo indipendente/avversariale.
> Data: 2026-06-17. HEAD `ce26608`. DB: PostgreSQL 16.14 (OCI VM aarch64) via tunnel SSH :5433→:5432 (read-only).
> Metodo: query live su `pg_catalog` / `information_schema` / tabelle `sys.*` + EXPLAIN ANALYZE reali + ispezione repo.

---

## Sintesi

Il data layer di heuresys-advanced è **strutturalmente solido per un progetto pre-revenue con dati sintetici**: 0 ENUM nativi (RD-08 perfetto), 0 violazioni FK (constraint-enforced), 0 tabelle morte non-intenzionali (reconciliation registry terminale), PIP come VIEW (I9 rispettato), 130 migration idempotenti con ledger sha256 e deploy sha-gated. Il modello knowledge ESCO (21.939 skill, 126.051 occupation→skill requisiti, 4 tabelle HNSW vector) è l'asset differenziante più maturo del layer dati.

I **2 rischi misurati** residui hanno entrambi un percorso di correzione già avviato ma incompleto al momento dell'audit:

1. **Auth token bloat strutturale**: 39.463 token / 9 utenti di test — di cui 38.933 validi ma non-scaduti (leak CI/E2E che il timer di pruning non può eliminare, copre solo revocati/scaduti). Il partial index `active_idx` è de-facto inutilizzato (il planner sceglie Seq Scan: Execution Time 8.795ms, 39.463 righe scansionate per 1 utente). Il timer housekeeping QW-C2 è attivo dal 2026-06-16 ma non risolve il root-cause (token emessi senza invalidazione di quelli precedenti per lo stesso utente/famiglia).

2. **FK index coverage incompleta**: 237 FK single-col senza indice (vs claim 243 — claim leggermente sovrastimato pre-mig 000130); 50 FK `*_tenant_id` ancora senza indice leading (vs claim 56 — mig 000130 ne ha aggiunti 6 sui top-6 per size). Le tabelle residue sono di dimensione inferiore (<1 MB ciascuna al momento), ma il profilo crescerà.

**JSONB usage pervasivo** (176 colonne in 150+ tabelle) è una caratteristica di progettazione deliberata per dati semi-strutturati/audit (metadata, payload, snapshots) — non una violazione dell'invariante I9 (che riguarda solo il PIP, correttamente implementato come VIEW).

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Stato | Evidenza (query live) |
|---|---|---|---|---|
| C1-data | "RD-08: 0 ENUM nativi, categorici = varchar+CHECK" | WS-C F-WS-C-10, CLAUDE.md RD-08 | **CONFERMATO** | `SELECT count(*) FROM pg_type WHERE typtype='e' AND typnamespace=sys` = **0**; CHECK constraints = 234 |
| C2-data | "243 FK single-col senza indice di supporto; 56 sono tenant_id" | WS-C F-WS-C-1 | **PARZIALE** | Query live = **237** FK senza indice totali (non 243); **50** tenant_id senza indice leading (non 56). Delta = mig 000130 (2026-06-16) ha aggiunto 6 indici tenant. I numeri del claim erano pre-fix. |
| C3-data | "auth-audit unbounded: 46k token / 9 utenti (37k attivi), zero pruning" | WS-C F-WS-C-4 | **PARZIALE** | `count(*) = 39.463 / 9 utenti`; **39.018 attivi** (non 37.554 — ricresciuti). Il pruning QW-C2 è NOW LIVE (timer attivo 2026-06-16, service `heuresys-advanced-auth-housekeeping.timer`) ma script elimina solo revocati/scaduti (131 candidati). I 38.933 token validi-non-scaduti restano intoccati e crescono. Partial index `active_idx` = Seq Scan (8.8ms / 39.463 rows per utente). |
| C4-data | "squash migration: non consolidare ora" | D-07 WS-C F-WS-C-7 | **CONFERMATO** | Ledger = **130 righe** (max migration_id 7578); deploy = `migrate-if-pending.sh` sha-gated O(pending). Proprietà twice-run-empty-diff non re-verificata in questo audit ma architettura confermata. |
| C5-data | "D-18 chiuso: 1 riga attiva/utente nelle score tables" | WS-C F-WS-C-6 | **CONFERMATO** | `flight_risk_scores`: 159 total / 159 distinct; `talent_scores`: 154/154 |
| C6-data | "dead-schema = 0 (reconciliation registry terminale)" | WS-C F-WS-C-9 | **CONFERMATO** | `v_reconciliation_status`: POPULATED 148 / NO_SOURCE 21 / EXCLUDE 9 / REFERENCE_ONLY 1 = 179 total; 0 vuote non-intenzionali |
| C7-data | "7 validation views strutturali = 0 righe" | db/scripts/validate_database.sh | **CONFERMATO** | Tutte e 7 le STRUCTURAL_VIEWS = 0 righe (v_orphan_position_assignments, v_tenant_boundary_violations, v_synthetic_user_flag_consistency, v_canonical_outside_sys, v_active_primary_assignment_per_user, v_visualization_node_in_canonical_node, v_inbox_resource_consistency) |
| C8-data | "PIP = VIEW mai JSONB blob (I9)" | CLAUDE.md I9 | **CONFERMATO** | `sys_position_intelligence_profiles_v` = VIEW (non tabella fisica); nessuna tabella `*position_intelligence*` BASE TABLE nel catalog |
| C9-data | "skills ESCO: 21.939 / occupation-skill: 126.051" | SOT_STATE, D-32/33 | **CONFERMATO** | `count(*) sys_skills` = **21.939**; `count(*) sys_occupation_skill_requirements` = **126.051** |
| C10-data | "pgvector HNSW embeddings attivi (skill+occupation+job_role+user_profile)" | SOT_STATE D-32/34 | **CONFERMATO con nota** | 4 indici HNSW (m=16, ef_construction=64, vector_cosine_ops): sys_skill_embeddings_hnsw_idx (167 MB, 363 scansioni), sys_esco_occupation_embeddings_hnsw_idx (24 MB, 597 scansioni). Vettori dim=**1024** (Voyage). sys_user_profile_embeddings_hnsw_idx e sys_job_role_embeddings_hnsw_idx = 0 scansioni (feature semantica non ancora a regime per quegli oggetti). |
| C11-data | "brownfield engine: motore sano, riconciliazione terminale" | D-11 | **CONFERMATO** | 4 moduli API brownfield live in app.ts:391-394; 0 stati aperti nel reconciliation registry (tutti terminali); motore cold ma integro e testato |
| C12-data | "migration ledger robusto: sha256 + duration + UNIQUE file_name + deploy sha-gated" | WS-C F-WS-C-8 | **CONFERMATO** | Ledger 130 righe; `migrate-if-pending.sh` sha-gated confermato da ispezione file; migration_id serial @ 7578 |

---

## Finding

### T5-001 — Auth token bloat strutturale: partial index inutilizzabile, root-cause non indirizzato dal housekeeping

- **Severita**: HIGH
- **Tipo**: Performance / Operativo
- **Evidenza**:
  - `SELECT count(*), count(DISTINCT auth_refresh_token_user_id) FROM sys.sys_auth_refresh_tokens` = **39.463 / 9 utenti** (2026-06-17 ore ~12:00 UTC)
  - Analisi attivi: `count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL)` = **39.018** di cui **38.933 validi non scaduti** e solo 85 scaduti-ma-non-revocati
  - Distribuzione per utente: 18.300 token attivi per `user_id=82c89e25` (47% del totale tabella), 12.499 per secondo utente
  - `EXPLAIN (ANALYZE, BUFFERS) SELECT FROM sys_auth_refresh_tokens WHERE user_id=X AND used_at IS NULL AND revoked_at IS NULL` → **Seq Scan** (cost=0..1762, actual time=0.015..7.887, **39.463 righe scansionate**, Execution Time=8.795ms). Il planner ignora il partial index `active_idx (user_id) WHERE used_at IS NULL AND revoked_at IS NULL` perché alla cardinalità attuale (~46% selectivity su tutto il heap) il Seq Scan è corretto.
  - Script housekeeping `scripts/auth-housekeeping.sh` elimina solo `revoked_at IS NOT NULL OR expires_at < now()` → candidati eliminabili NOW = **131** (0.3% del totale)
  - Timer `heuresys-advanced-auth-housekeeping.timer` attivo dal 2026-06-16 20:44 UTC, prossima run 2026-06-18 02:00 — attivo ma irrilevante per il 99.7% del bloat
  - Root cause: nessun meccanismo invalida i token precedenti al re-login/re-test → ogni run CI/E2E emette nuovi token senza scadere i vecchi
- **Impatto**: Il partial index auth hot-path è neutralizzato. Ogni operazione di refresh-token verifica (la più frequente nell'auth API: `POST /v1/auth/refresh`) esegue un sequential scan dell'intera tabella. Con un solo tenant live il degrado è tollerabile (8.8ms); con 100 tenant paganti reali e 1000 utenti attivi il costo diventa proibitivo. Il bloat crescerà linearmente con ogni sessione di test.
- **GA-blocker**: NO (dati sintetici, 9 utenti; ma deve essere risolto prima del primo tenant reale)
- **Remediation**: (a) SHORT-TERM: `DELETE FROM sys_auth_refresh_tokens WHERE auth_refresh_token_user_id = $1 AND auth_refresh_token_family_id != $current_family` al momento del login (invalida token di famiglie precedenti stesse dell'utente) — scoped, sicuro, non invalida sessioni attive della stessa famiglia; (b) O in alternativa: aggiungere `MAX_ACTIVE_FAMILIES_PER_USER = 10` come cap e invalidare le più vecchie. Effort: ~0.5 sessione. Verifica: post-fix `count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND user_id = $test_user)` deve tornare a O(10), non O(10.000+).
- **Best-practice ref**: OWASP refresh token rotation best practices; RFC 6749 token invalidation on re-auth
- **Confidence**: Alta

---

### T5-002 — FK index coverage: 50 tenant_id FK residue senza indice leading, 237 FK totali

- **Severita**: MEDIUM
- **Tipo**: Performance / Scalabilita
- **Evidenza**:
  - Query `pg_constraint JOIN pg_index WHERE contype='f' AND array_length(conkey,1)=1 AND NOT EXISTS(i.indkey[0]=conkey[1])` → **237** FK totali senza indice (claim venditore: 243 pre-mig000130; delta = 6 indici aggiunti dalla mig)
  - `attname LIKE '%tenant_id%'` filter → **50** FK tenant_id senza indice leading (claim: 56 pre-fix)
  - Top tabelle residue senza indice tenant: `sys_position_learning_requirements` (992 kB), `sys_user_learning_assignments` (800 kB), `sys_position_skill_requirements` (760 kB), `sys_user_assessment_evidence` (664 kB), `sys_user_learning_evidence` (624 kB) — tutte sotto 1 MB attuale
  - EXPLAIN reale su `sys_skills` (post-mig000130): `Index Scan using sys_skills_tenant_idx` (Execution Time=0.149ms) — conferma che i 6 indici aggiunti dalla mig funzionano (Bitmap Index Scan come da claim QW-C1 verificato)
  - 109 FK audit-actor (`created_by`/`updated_by`) senza indice — classificazione corretta: low-value, basso uso in lettura
- **Impatto**: Le 50 FK tenant_id residue sono su tabelle piccole (<1 MB) — il seq scan attuale è trascurabile. Con crescita dati (100+ tenant, 1000+ utenti) le stesse tabelle possono raggiungere decine-centinaia di MB, a quel punto il costo di lista-per-tenant diventa visibile (O(N_tabella) invece di O(N_tenant)).
- **GA-blocker**: NO (problema futuro, non attuale con dati sintetici)
- **Remediation**: Aggiungere migration additiva (`CREATE INDEX IF NOT EXISTS`) per le 50 FK tenant_id residue, prioritizzando quelle legate a moduli ad alta frequenza (learning, skill, assessment). Effort: ~0.5 sessione (pattern già stabilito da mig 000130). Verifica: EXPLAIN di una list-by-tenant mostra Index Scan su tutte le tabelle target.
- **Confidence**: Alta

---

### T5-003 — ASSET: ESCO knowledge representation matura e operativa (21.939 skill + 126.051 requisiti + HNSW 1024-dim)

- **Severita**: INFO (asset)
- **Tipo**: Architettura / Differenziazione
- **Evidenza**:
  - `sys_skills`: 21.939 righe, 14.036 con `skill_kind` (SKILL/KNOWLEDGE/COMPETENCE/BEHAVIOR), 14.011 con `skill_esco_uri`; indice trigram `sys_skills_name_trgm_idx` per ricerca testuale
  - `sys_skill_taxonomy_edges`: 11.965 edge (relazione parent/child per gerarchia broader/narrower)
  - `sys_occupation_skill_requirements`: 126.051 righe (mapping occupation→skill con proficiency requirements)
  - `sys_skill_embeddings` (HNSW): 21.939 righe, vettori dim=**1024** (Voyage), indice 167 MB (heap 3.7 MB), 363 scansioni reali
  - `sys_esco_occupation_embeddings` (HNSW): 597 scansioni reali — feature semantic search già operativa
  - Tutti e 4 gli indici HNSW configurati con `m=16, ef_construction=64, vector_cosine_ops` — parametri standard per recall vs speed trade-off
  - DB totale: 1.24 GB (dominato da embeddings: ~230 MB HNSW+heap skill + ~67 MB esco occupation)
- **Impatto**: Il layer knowledge ESCO è l'asset tecnico più maturo e differenziante del DB. Raro nei competitor pre-seed. La copertura full-embedding (21.939/21.939 skill) è un segnale di qualità architetturale elevata. Le 2 tabelle HNSW non ancora usate (job_role, user_profile) sono ready-to-activate con dati reali.
- **GA-blocker**: N/A
- **Confidence**: Alta

---

### T5-004 — ASSET: Schema discipline perfetta (RD-08/09, 0 ENUM, 234 CHECK, 130 migration idempotenti, deploy sha-gated)

- **Severita**: INFO (asset)
- **Tipo**: Qualita architetturale
- **Evidenza**:
  - `count(*) FROM pg_type WHERE typtype='e' AND typnamespace=sys` = **0** (RD-08 perfetto)
  - CHECK constraints = **234**; nessun ENUM nativo
  - `date` vs `timestamptz`: 32 colonne `date`, 370 `timestamptz` — coerente con RD-09 (solo 3 colonne `*_date timestamptz` borderline-legittime verificate nel claim vendior)
  - Migration ledger: 130 righe, `sha256` per ogni file, `duration_ms`, `file_name UNIQUE`, `migration_id` serial @7578. Wrapper `migrate-if-pending.sh` sha-gated confermato (ispezione `db/scripts/`)
  - 7 STRUCTURAL validation views = 0 righe (audit live 2026-06-17)
  - 0 tabelle morte non-intenzionali (`v_reconciliation_status`: 148 POPULATED / 21 NO_SOURCE / 9 EXCLUDE / 1 REFERENCE_ONLY)
  - PIP = VIEW (`sys_position_intelligence_profiles_v`), nessuna tabella fisica, 162 righe
- **Impatto**: Riduce materialmente il rischio di technical debt cumulativo. La catena migration è un riferimento auditabile completo dello storico dello schema.
- **GA-blocker**: N/A
- **Confidence**: Alta

---

### T5-005 — JSONB pervasivo (176 colonne in 150+ tabelle): pattern deliberato, non violazione I9, ma rischio query-complexity a scala

- **Severita**: LOW
- **Tipo**: Architettura / DX / scalabilita
- **Evidenza**:
  - `SELECT count(*) FROM information_schema.columns WHERE table_schema='sys' AND data_type='jsonb'` = **176 colonne** in ~150 tabelle
  - Classificazione: 122 colonne `*_metadata` / `*_payload` (dati semi-strutturati, estensibili) + 54 colonne non-metadata (es. `response_answers`, `review_section_ratings`, `template_questions`, `goal_tags`, `okr_tags`, `branch_opening_hours`)
  - Invariante I9 (PIP mai JSONB blob): RISPETTATA — PIP è VIEW, nessuna tabella fisica con JSONB che costituisca un "blob PIP"
  - Le 54 colonne non-metadata includono JSONB semanticamente rilevanti: `response_answers`, `review_competency_ratings_snapshot`, `check_in_key_result_updates_snapshot` — dati che potrebbero essere normalizzati ma che sono stati deliberatamente denormalizzati per performance di lettura/snapshot immutability
- **Impatto**: Nessun impatto operativo immediato. A scala (100+ tenant, queries aggregate cross-JSONB) le query `->>/jsonb_to_recordset` possono degradare senza indici GIN dedicati. La normalizzazione retroattiva di campi semanticamente strutturati (es. `survey_questions`, `template_questions`) richiede effort non banale.
- **GA-blocker**: NO
- **Remediation**: Nota — catalogare i 54 JSONB non-metadata e decidere per ciascuno: (a) aggiungere GIN index per le query frequenti (`goal_tags`, `okr_tags`); (b) normalizzare in tabella separata dove il JSON ha struttura fissa (`response_answers`, `template_questions`). Effort totale: 1-2 sessioni per una migration additiva + analisi per i candidati di normalizzazione.
- **Confidence**: Media (pattern deliberato, impatto a scala non misurato su dati sintetici)

---

### T5-006 — ASSET: Trigger infrastructure (79 trigger su 74 tabelle) per updated_at + audit integrità

- **Severita**: INFO (asset con nota)
- **Tipo**: Qualita operativa
- **Evidenza**:
  - `count(*) FROM information_schema.triggers WHERE trigger_schema='sys'` = **79** trigger; 74 tabelle con almeno un trigger
  - Pattern dominante: `_set_updated_at` (BEFORE UPDATE) per `updated_at` automatico
  - Pattern audit: `sys_auth_mfa_exemptions_audit` (INSERT/UPDATE/DELETE AFTER) per audit trail MFA
  - Pattern integrità: `sys_auth_mfa_exemptions_eligibility` (INSERT/UPDATE BEFORE) per enforcement regole business
  - Nessun trigger `INSTEAD OF` o `FOR EACH STATEMENT` rilevato nel campione — pattern pulito
- **Impatto**: L'infrastruttura trigger garantisce consistenza automatica `updated_at` senza dipendere dalla disciplina applicativa. I 3 trigger audit/eligibility su MFA sono un segnale di maturità dell'auth layer. Con 75+ moduli API il trigger overhead sui BEFORE UPDATE è trascurabile per workload HRMS (non OLAP).
- **GA-blocker**: N/A
- **Confidence**: Alta

---

### T5-007 — Footprint DB dominato da HNSW embeddings (457 MB su 1.24 GB totale): rapporto dato/indice anomalo per sys_skill_embeddings

- **Severita**: LOW
- **Tipo**: Infrastruttura / Storage
- **Evidenza**:
  - `pg_database_size('heuresys_advanced')` = **1.240 MB**
  - `sys_skill_embeddings`: heap 3.74 MB / HNSW index 167 MB = **rapporto heap:idx = 1:44** (anomalo — il HNSW cresce con il numero di vettori e la dimensionalita, non con la dimensione dell'heap)
  - `sys_esco_occupation_embeddings`: heap ~5 MB / HNSW index 24 MB = rapporto 1:5 (atteso)
  - Top 15 tabelle per size: `sys_skill_embeddings` 290 MB (heap+idx), `sys_occupation_skill_requirements` 96 MB, `sys_source_lineage_records` 60 MB
  - Su OCI free-tier: 1 OCPU ARM + 6 GB RAM + 50 GB SSD. L'embedding layer occupa attualmente ~37% del DB — con tenant reali che aggiungono user_profile_embeddings e job_role_embeddings il footprint crescera rapidamente
- **Impatto**: A regime (100 tenant, 10.000 utenti), il `user_profile_embeddings` HNSW potrebbe crescere a centinaia di MB addizionali. Il free-tier OCI (50 GB SSD) potrebbe risultare insufficiente entro 6-12 mesi di operazione commerciale con tenant reali. Non bloccante oggi (dati sintetici), ma rilevante per il sizing infrastrutturale post-funding.
- **GA-blocker**: NO
- **Remediation**: Pianificare upgrade storage OCI (flex block volume pagato) prima del lancio commerciale. Valutare `m=8` vs `m=16` per gli indici HNSW meno critici (user_profile, job_role) per ridurre footprint a parità di recall accettabile. Effort: 0 immediato, da pianificare pre-launch.
- **Confidence**: Alta

---

### T5-008 — ASSET: D-18 chiuso e verificato (score tables 1 riga/utente, delete-bounded atomico)

- **Severita**: INFO (asset)
- **Tipo**: Robustezza dati
- **Evidenza**:
  - `sys_flight_risk_scores`: count=159, distinct user_id=159 (1:1)
  - `sys_talent_scores`: count=154, distinct=154
  - Pattern delete-then-insert atomico in `modules/insights/repository.ts` (D-18 chiuso S977)
- **GA-blocker**: N/A
- **Confidence**: Alta

---

## Score

| Dimensione | Score | Peso | Note |
|---|---|---|---|
| Schema discipline (RD-08/09, invarianti, FK integrity) | 90 | alta | 0 ENUM, 234 CHECK, 0 orfani FK, 0 dead-schema — eccellente |
| Knowledge representation (ESCO, pgvector, taxonomy) | 85 | alta | 21.939 skill, 1024-dim HNSW attivo, gerarchia edges — forte |
| Migration governance (idempotenza, ledger sha256, deploy sha-gated) | 88 | alta | 130 migration robuste, deploy O(pending) — forte |
| Data integrity (validation views, reconciliation registry, PIP VIEW) | 92 | alta | 7/7 STRUCTURAL views = 0, registro terminale — eccellente |
| Performance readiness (indici, query plan, scala) | 52 | alta | Auth Seq Scan critico (T5-001), 50 tenant FK senza indice (T5-002), HNSW oversize skill |
| Operativita (backup, pruning, trigger) | 72 | media | Timer backup+housekeeping attivi; housekeeping non risolve root-cause token bloat |

**Score T5 complessivo: 72 / 100 — Adeguato**
**Confidence: Alta**

**Motivazione**: La struttura relazionale e la governance schema sono eccellenti per un progetto pre-revenue (RD-08/09 perfetti, 0 dead-schema, ledger sha256, validation views tutte verdi). Il layer ESCO+pgvector è l'asset tecnico differenziante piu maturo del progetto. Il punteggio e penalizzato dalla dimensione Performance Readiness: il Seq Scan sull'auth hot-path (T5-001) e un problema operativo misurabile oggi (8.8ms/call con 9 utenti di test; proiettato a ordini di grandezza peggiori con tenant reali), e la FK coverage incompleta (T5-002) e un rischio di scalabilita non bloccante ora ma reale. Entrambi sono risolvibili in <1 sessione di lavoro, il che giustifica un investitore nel non considerarli GA-blocker, ma nel condizionare il funding alla loro chiusura documentata prima del primo tenant reale.

---

## Dipendenze e cross-ref

- T5-001 cross-ref: WS-T6 (sicurezza auth, refresh rotation), WS-T8 (infra/DR)
- T5-002 cross-ref: WS-T2 (API performance, list endpoints)
- T5-007 cross-ref: WS-T8 (infra sizing OCI free-tier)
- JSONB (T5-005) cross-ref: WS-T2 (query performance), WS-X1 (GDPR/data model)

---

*Audit read-only — nessuna modifica a codice/schema/CI/deploy, zero scritture DB. Tunnel SSH :5433 attivo per tutta la durata dell'audit. Output: solo questo file WS-T5.md.*
