# WS-T7 — AI / ML / LLM audit
> DD investor-grade. Postura: **indipendente / avversariale**. Data: 2026-06-17. HEAD `ce26608` (S994). Auditor: Claude Sonnet 4.6 via Agent tool.

---

## Sintesi

Il sottosistema AI di heuresys-advanced è composto da **tre strati distinti** con maturità molto diverse:

1. **Semantic matching (pgvector + Voyage)** — pipeline di embedding offline (`voyage-4-lite`, 1024-dim, ~22k skill + 3k occupazioni + 136 job roles + 156 profili utente precomputati), kNN HNSW in PostgreSQL. Architettura solida e *praticamente priva di dipendenza esterna sul serving path* (il free-text real-time è gated OFF). I vettori sono in produzione e gli HNSW vengono scansionati (`idx_scan=363` su skill, `597` su occupation). CONFERMATO.

2. **Insights scoring (flight-risk / succession / skill-gap)** — modelli **deterministici a regole weighted-linear**, NO ML, NO training, NO modello esterno. I pesi sono hardcoded e documentati nel sorgente. Funziona e produce score freschi (ultimo recompute `2026-06-17T03:17`). Il marketing "AI/ML" per questo strato è **parzialmente fuorviante**: è statistica descrittiva avanzata con spiegabilità completa, non ML predittivo.

3. **Agent gateway (Claude Agent SDK)** — gateway sperimentale che espone le API `/v1` come MCP tools al plugin `human-resources-plus`. Gira sull'**abbonamento personale Claude MAX del founder** (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`), NON su API key commerciale. HITL write-gate implementato e testato (47/47). **Non in produzione come serving customer-facing — è un pilota interno/dimostrativo.**

**Gap critico per investitori**: l'agent-gateway usa il piano personale del founder per funzionare. Prima di qualsiasi serving commerciale verso clienti, è richiesta una API key Anthropic (o AWS Bedrock / GCP Vertex). Il ToS di Anthropic per la subscription MAX proibisce esplicitamente l'uso commerciale per conto terzi. Questo non è un GA-blocker immediato (nessun cliente reale oggi), ma è un **prerequisito obbligatorio al primo deploy commerciale**.

**Score complessivo: 65 / 100 (Adeguato) — Confidence: Alta.**

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Stato | Note |
|---|---|---|---|---|
| C11a | "pgvector embeddings" | SOT_STATE, CLAUDE.md | **CONFERMATO** | 4 tabelle embedding live; pgvector 0.8.2 installato; HNSW attivo e scansionato |
| C11b | "voyage-client embeddings" | D-12, sorgente | **CONFERMATO** | `voyage-4-lite`, EMBED_DIM=1024; 21.939 skill + 3.045 occupazioni embedded |
| C11c | "flight-risk scoring" | `insights/service.ts` | **CONFERMATO — con caveat** | Implementato e live (159 score, model `flight-risk-v1`, freschi `2026-06-17`); è euristica weighted-linear, NON ML/AI nel senso tradizionale |
| C11d | "skill-gap scoring" | `insights/service.ts` | **CONFERMATO — con caveat** | 154 score live; formula cosine-gap × 0.7 + evidence-sparsity × 0.3; stessa considerazione sul label "ML" |
| C11e | "succession-readiness scoring" | `insights/service.ts` | **CONFERMATO — con caveat** | 462 score live; 3 feature: position-fit (cosine) 0.5 + KPI 0.3 + tenure 0.2; weighted-linear puro |
| C11f | "AI matching / kNN" | `semantic-matching/service.ts` | **CONFERMATO** | 8 endpoint kNN su HNSW precomputato; serving path Voyage-free |
| C11g | "Agent SDK gateway" | `apps/agent-gateway/` | **PARZIALE** | Implementato e testato live (S991); usa subscription MAX personale del founder, non API key commerciale; pilota, non PROD serving |
| C11h | "predictions ML" | `apps/api/src/modules/predictions/` | **SMENTITO (parzialmente)** | Modulo `predictions` = read-only di valori precomputati legacy da `heuresys-evo`; nessun modello ML attivo; wrapper su dati storici |

---

## Finding

| ID | Titolo | Severità | Tipo | Evidenza | Impatto | GA-blocker | Remediation + effort | Best-practice ref | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| T7-001 | Agent-gateway usa subscription Claude MAX personale: proibito per serving commerciale | **High** | Compliance / ToS | `apps/agent-gateway/src/server.ts:44`: `delete process.env.ANTHROPIC_API_KEY`; `.env.example:228-236` documenta esplicitamente l'uso della subscription personale; Anthropic ToS §4 vieta uso commerciale multi-tenant su subscription personale | Al primo cliente reale l'agent non può essere acceso senza API key Anthropic; costo AI non budgetato nel modello finanziario | **No** (nessun cliente oggi), ma prerequisito obbligatorio al primo deploy commerciale | Procurare API key Anthropic pay-per-use (o AWS Bedrock / GCP Vertex); stimato ~2h di configurazione + decisione budget AI | Anthropic Commercial Terms §4; best practice: API key per serving commerciale | Alta |
| T7-002 | Nessun eval / golden-set per la qualità del retrieval kNN | **Medium** | Test coverage / ML rigor | `grep eval golden fixture.*embedding apps/api/test` → 0 hit; unico test di derivazione è `psr-derivation` (prevalence band, non kNN recall); test suite inietta `FakeEmbedder` deterministico che non verifica la qualità dei vettori reali Voyage | Non esiste misura di recall@K né precision per `similarSkills`, `myOccupations`, `userPositions`; regressioni di qualità embedding (es. dopo upgrade modello) non catturate dal CI | No | Aggiungere 5-10 golden test: dato un profilo seed RTL_BANK, asserire che i top-K risultati includano occupazioni/ruoli attesi da esperto. Effort ~3-5h | MTEB benchmark practice; ML eval pattern | Alta |
| T7-003 | `VOYAGE_API_KEY` non è nella denylist `env-key-merge.sh` | **Medium** | Config / secret propagation | `scripts/env-key-merge.sh:35`: denylist include `MFA_ENFORCEMENT_ENABLED`, `MATCHING_FREETEXT_ENABLED` ecc. ma **non `VOYAGE_API_KEY`**; identificato in D-12 §"denylist" come gap non chiuso | Una chiave dev/staging potrebbe propagarsi additivamente alla VM prod via `align-clones`; rischio billing inatteso su account Voyage o credential-leak in env VM | No | Aggiungere `VOYAGE_API_KEY` alla denylist in `env-key-merge.sh` (15 min, LOW risk); già identificato in D-12 conservativo ma non eseguito | D-12 raccomandazione §1; secret hygiene R10 | Alta |
| T7-004 | Reindex timer settimanale: VM prod senza `VOYAGE_API_KEY` → fail silenzioso non monitorato | **Medium** | Operational / observability | `deploy/systemd/heuresys-advanced-reindex.service` nota esplicita: _"By design the serving VM does NOT carry the key … documented no-op/fail"_; nessun `OnFailure=` nel `.service` (a differenza di altri timer); nessun alert se il reindex non avviene | Il substrato embedding può diventare obsoleto silenziosamente se ESCO aggiunge occupazioni; HNSW skill-embeddings 21.939 su 45k ESCO totali → copertura parziale già ora | No | Aggiungere `OnFailure=` al `.service` + alert (come i fratelli backup/insights); oppure portare `VOYAGE_API_KEY` sulla VM prod (costo ~$0 nel free tier Voyage 200M token). Effort ~30 min | D-12 §evolutiva: reindex orchestration hardening | Alta |
| T7-005 | Label "AI/ML" per i modelli insights fuorviante: sono euristiche a regole deterministiche | **Medium** | Claim accuracy / investor risk | `insights/service.ts:1-16` commento esplicito: _"The model is a DETERMINISTIC, documented weighted-linear rule (NO ML, NO external service)"_; pesi hardcoded (tenure 0.15, kpi 0.25, engagement 0.25); stesso pattern per succession e skill-gap | Un investor che legge "AI/ML flight-risk scoring" si aspetta un modello addestrato, feature selection, cross-validation, out-of-sample performance; il delta percepito vs realtà è sostanziale in una pitch | No | Documentare correttamente come "explainable rule-based scoring" (vantaggio in ambito EU AI Act / GDPR Art. 22 high-risk); mantenere il disclaimer nel sorgente ed esplicitarlo nel pitch. Effort: solo narrativo, nessun codice | EU AI Act Art. 5 (rule-based = lower risk tier); GDPR Art. 22 | Alta |
| T7-006 | Modello `voyage-4-lite` hardcoded: dimension lock-in 1024 non documentato a livello schema | **Low** | Vendor lock-in / maintainability | `voyage-client.ts:9`: `export const EMBED_DIM = 1024`; schema pgvector usa `vector(1024)` implicito — un futuro switch a modello con dimensione diversa richiede migration schema 290 MB + ri-backfill completo; nessun commento nella migration che spiega il vincolo | Switch a `voyage-4` (1024) o `voyage-3-large` (1024) safe; switch a OpenAI text-embedding-3-large (3072) o modelli 1536-dim richiederebbe schema migration; rischio basso ma non documentato | No | Aggiungere commento al file migration che crea `vector(1024)` e in `voyage-client.ts:EMBED_DIM` che spiega il vincolo dimensionale (15 min). Già identificato in D-12 come "deliverable a costo zero" | D-12 §evolutiva: dim-1024-guard | Alta |
| T7-007 | `apps/agent-gateway` CI coverage parzialmente chiusa in S994 ma non verificata end-to-end | **Low** | CI coverage | `01_DISCOVERY.md:84` nota agent-gateway fuori da CI; `SOT_STATE.md delta S994 #5`: _"agent-gateway `build`+`lint` (ora in `pnpm -r`)"_ — il batch S994 ha aggiunto build+lint ma non è verificato se i 47 test gateway girano nel workflow CI | Se i test gateway non girano in CI, una regressione nel write-gate HITL non viene catturata automaticamente | No | Verificare output CI S994 per confermare test gateway nel workflow; se inclusi → chiudere a Info | CI governance | Media |
| T7-008 | Modulo `predictions`: read-only di valori precomputati legacy, nessun modello attivo | **Info** | Claim accuracy | `apps/api/src/modules/predictions/service.ts:5-6`: _"READ-ONLY: legacy precomputed predictive-analytics values exposed as-is. No writes."_ — i valori vengono da `heuresys-evo`, non da un modello attivo | Il claim "predictions" può creare aspettative errate in chi lo legge come "motore predittivo in tempo reale" | No | Documentare nella pitch deck come "legacy predictions bridge (read-only)" anziché "prediction engine" | — | Alta |

---

## Nota di supporto a P4 (Prodotto / Roadmap AI)

Il workstream P4 ("AI matching e scoring") è **giustificato dall'evidenza** con le seguenti qualifiche:

**Asset reali (forza):**
- Il substrato pgvector è operativo in produzione con 21.939 skill embeddate (`voyage-4-lite`), indici HNSW scansionati attivamente (`skill: idx_scan=363 / 48.470 tuple read`, `occupation: idx_scan=597 / 20.659 tuple read`). La pipeline embed-at-write-time + serve-precomputed è architetturalmente corretta e Voyage-free sul serving path.
- Il timer di reindex settimanale (R7) esiste su disco (`deploy/systemd/heuresys-advanced-reindex.{service,timer}`). L'idempotenza hash-skip SHA-256 è implementata correttamente.
- I modelli weighted-linear per flight-risk / succession / skill-gap producono score **spiegabili per design** (ogni feature ha peso e contributo nel payload JSON), il che è un asset per EU AI Act / GDPR Art. 22 (nessun sistema di decision-making "black-box"). Questo differenzia positivamente rispetto a soluzioni ML opache.
- Il write-gate HITL (M-2) dell'agent-gateway è correttamente implementato: deny-by-default, allowlist, audit trail JSONL su ogni decisione (`audit-sink.ts`). Pattern da mantenere.
- Seam `Embedder` (interfaccia + DI) già astratto: `VoyageEmbedder` + `FakeEmbedder` iniettabile. Non c'è un hard-coupling da spezzare.

**Limiti per P4:**
- Provider embedding: **1 solo concreto** (`VoyageEmbedder`). Il seam esiste ma è compile-time, non config-driven. D-12 ha identificato il percorso evolutivo (provider registry via env) ma lo ha gated su trigger F4/SF o secondo modello.
- Il costo Voyage per il reindex schedulato è **zero osservabilità**: nessun contatore di token billable loggato per run. Con 200M token free/account e un corpus ~25k item × ~150 token/item, il costo stimato è ~$0.075 per run completo (Voyage 4-lite: $0.02/MTok). Il free tier copre ~1.333 run completi prima di qualsiasi costo.
- Il modulo `predictions` non aggiunge valore AI incrementale: è un bridge read-only su dati legacy. Nella pitch deck va riclassificato.
- L'agent-gateway non ha SLA definiti, nessun retry/circuit-breaker, nessun rate limiting per le chiamate LLM. In produzione su clienti reali richiederebbe hardening significativo (~1 sessione).

**Costo AI stimato a regime (per tenant reale):**

| Componente | Stima | Note |
|---|---|---|
| Voyage reindex | ~$3.90/anno | $0.075/run × 52 run; free tier copre anni |
| Anthropic API key (agent, `claude-opus-4-8`) | ~$0.075-$0.23/sessione agente | ~5-15k token per sessione; costo diventa materiale con volume |
| pgvector overhead | incluso infra | già nel DB PostgreSQL |

---

## Score

| Dimensione | Sub-score | Peso | Contributo |
|---|---|---|---|
| Substrato embedding (pgvector, HNSW, pipeline, idempotenza) | 82/100 | 25% | 20.5 |
| Qualità scoring insights (implementazione, freschezza, spiegabilità) | 75/100 | 25% | 18.75 |
| Agent gateway (architettura HITL, sicurezza, write-gate) | 68/100 | 20% | 13.6 |
| Eval coverage e regressione qualità kNN | 30/100 | 15% | 4.5 |
| Provider abstraction e lock-in mitigation | 58/100 | 10% | 5.8 |
| Compliance e labeling corretto dei claim AI | 52/100 | 5% | 2.6 |

**Score finale: 65.75 / 100 → arrotondato a 65**
**Banda: Adeguato (60-74)**
**Confidence: Alta**

**Motivazione**: il substrato embedding è reale, operativo e architetturalmente corretto. I modelli di scoring producono risultati live con spiegabilità completa. L'agent-gateway è un pilota funzionante con HITL solido. I gap principali sono: (a) assenza totale di eval/golden-set per la qualità del kNN — nessuna misura di recall@K nel CI, (b) agent-gateway su subscription personale non scalabile commercialmente (ToS violation al primo cliente), (c) label "AI/ML" sui modelli deterministici che crea aspettative errate negli investitori, (d) nessun monitoraggio del timer di reindex sulla VM prod. Nessun finding è GA-blocker per il prodotto attuale (nessun cliente reale); T7-001 diventa bloccante all'onboarding del primo tenant pagante.

---

*Comandi di riproduzione risultati live (HEAD `ce26608`, tunnel SSH :5433 attivo):*
```bash
# pgvector installato
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
# → vector|0.8.2

# Embedding corpora
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT model_id, count(*) FROM sys.sys_skill_embeddings GROUP BY model_id;"
# → voyage-4-lite|21939

psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT model_id, count(*) FROM sys.sys_esco_occupation_embeddings GROUP BY model_id;"
# → voyage-4-lite|3045

# HNSW scan activity
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT indexname, idx_scan, idx_tup_read FROM pg_stat_user_indexes
      JOIN pg_class i ON i.oid=indexrelid
      WHERE schemaname='sys' AND i.relname LIKE '%hnsw%';"
# skill: 363/48470; occupation: 597/20659; job_role: 0/0; user_profile: 0/0

# Insight scores (live, freschi 2026-06-17)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT count(*) FROM sys.sys_flight_risk_scores;"  # 159
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT count(*) FROM sys.sys_succession_readiness_scores;"  # 462
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT count(*) FROM sys.sys_skill_gap_scores;"  # 154

# Eval golden test: assente
grep -rniE "eval|golden|fixture.*embedding" apps/api/test/  # 0 hit rilevanti
```
