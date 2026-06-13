# POST_V1_ROADMAP_DOSSIER — Direzioni post-v1.0 (decision-ready)

> **Scopo**: menu esaustivo e misurato delle direzioni possibili dopo la chiusura del backlog operativo (S984: "sostanzialmente a zero"), per decisione PM. Le opzioni sono **componibili in fasi additive** — nessun aut-aut. Prodotto in S985 (2026-06-12) da un workflow di discovery a 7 agenti (4 direzioni misurate + sweep residui + critic di completezza), con verifiche live su repo, DB advanced (:5433) e DB legacy (`heuresys_platform`).
> **Owner decisione**: Enzo (PM — il *cosa*). Esecuzione e scelte tecniche: CLI (il *come*).

## 0. Conteggi pinnati (misure fresche 2026-06-12, per superare i drift delle SoT)

| Metrica | Valore | Verified-by |
|---|---|---|
| Route registrations API | **407** `app.<verb>(` | `grep -rE "app\.(get|post|patch|put|delete)\(" apps/api/src --include="*.ts" \| wc -l` |
| File integration test API | **129** (889 `it()`/`test()`) | `ls apps/api/test/*.test.ts \| wc -l` + grep |
| Spec E2E web | **46** | `ls apps/web/tests/e2e/*.spec.ts \| wc -l` |
| Reconciliation registry | **142 POPULATED · 21 NO_SOURCE · 7 EXCLUDE · 2 REFERENCE_ONLY · 0 NEEDS_DECISION** | `SELECT resolved_status,count(*) FROM sys.v_reconciliation_status GROUP BY 1` (live) |
| Tenant v5 vs legacy | v5: **2 ACTIVE** (RTL 158 user + Heuresys 3) · legacy: **4** (RTL 158 emp, SmartFood 82, EcoNova 26, HS 4) | query live su entrambi i DB |

NB: CLAUDE.md/SOT_STATE riportano conteggi più vecchi (~279 endpoint, 576 test) — da riallineare al prossimo handoff.

---

## 1. Le 3 candidate storiche (citate in STATE.md S984)

### 1.A Connettore SuccessFactors — maturo lato repo, ⛔ PM-gated sull'accesso SAP

**Cosa è**: import one-way SF Employee Central → `sys.*` (mai export). Design riconciliato **già scritto e committato**: `docs/integrations/successfactors_heuresys_reconciled_design_2026-05-30.md` (pattern β brownfield-new-source + γ SDBI; mapping entità → sys.* definito; PII blocker ritirato via ADR-0023). Escluso dalla v1.x per decisione D-ROAD — unico item esplicitamente "documented roadmap".

**Cosa esiste già** (≈ il telaio): pipeline brownfield multi-source + lineage, `brownfield.source_watermarks` (mig 000095, era il net-new #2 del design), modulo `/v1/reference-sync` con 2 connettori live (ESCO, ISTAT/ATECO) — DI fetcher seam (fixture in CI), lock anti-overlap, content-hash UNCHANGED, systemd timer. Costo misurato della 2ª sorgente (ATECO, `0761ca2`): 13 file, +606/−47, 1 sessione. **Net-new reale**: extractor OAuth2 (SAML Bearer) + client OData V2 + mapping multi-entità (più oneroso di un catalog upsert — lo yardstick ATECO è un floor, non una stima).

**Fasi proposte** (componibili):
- **F0 (PM, esterna)**: sandbox/tenant SF + credenziali OAuth2; scope entità EC del MVP; destino dei gap senza target (SDBI vs out-of-scope).
- **F1 (~1-2 sessioni, eseguibile SUBITO senza sandbox)**: chassis extractor fixture-driven (dottrina no-live-HTTP-in-CI) + watermark rows `SUCCESSFACTORS:<Entity>` (zero migration).
- **F2 (~2-3 sessioni)**: ingestion β — `staging.sf_*` + column_mappings 6-7 entità + upsert engine + lineage + test.
- **F3 (1-2 sessioni, human-gated ADR-0014)**: SDBI per i gap (EmpEmployment, base salary) — solo se F0 li include.
- **F4 (~1 sessione)**: scheduling + superficie admin + E2E.

**Effort totale**: ~5-8 sessioni (~25-40h) post-F0 (stima da yardstick, mini-piano R20 dovuto al kickoff). **Valore**: finché il prodotto resta case-study sintetico è **dimostrativo/architetturale** (multi-source reale), non integrazione cliente — vedi §4.1.

### 1.B Wave-3 import — residuo genuino, ma RIDEFINITO: multi-tenant legacy onboarding

**Cosa era**: "Demo Person Data Import" (BROWNFIELD_IMPORT_PLAN §5, runner DRAFT mai eseguito, MVP_4_ROADMAP §2.2 stimava 50-87h **inclusa** una human-approval UI). Per RTL quel lavoro è stato consegnato per vie diverse (rebuild S950 + ciclo reconciliation S958→S982): la vista è terminale (0 NEEDS_DECISION).

**Cosa resta davvero**: i **tenant legacy non-RTL mai onboardati** — SmartFood (82 employees, industria food), EcoNova (26, energy), Heuresys System (4). ~112 employees + satelliti. `brownfield.tenant_id_mappings` ha 2 sole righe **entrambe collassate su RTL**, e quella di Heuresys System è **stale/mis-mappata** (legacy `d5855519` → RTL benché la tenancy HEURESYS `8bc5bc59` esista). Skip documentati recuperabili: 12 models + 999 predictions, 164 kpi_targets, ~465 survey responses, career_goals 60/85 (il cui recupero farebbe decadere il NO_SOURCE di `sys_user_target_positions`).

**Decisione PM a monte** (non meccanica): SmartFood/EcoNova sono industrie **non-banking** e la tassonomia processi/KPI v5 è banking-native (decisione S970) → onboardarli è una scelta di prodotto (multi-industry vs single-industry reference).

**Livelli componibili**:
1. **Solo fix Heuresys System** (rimappa `d5855519`→`8bc5bc59` + import 4 employees): ~3-5h — chiude l'incoerenza più visibile.
2. **+1 tenant pilota** (EcoNova, il più piccolo): ~8-14h.
3. **Onboarding completo + skip-recovery**: ~20-35h (3-5 sessioni). La human-approval UI del piano originale è **opzionale** (ADR-0023 demo-data giustifica auto-approval): +25-40h solo se la si vuole.

**Rischi**: leakage cross-tenant in viste/BI (mitigato da db:validate 7 viste + test I5), policy mandatory-MFA da seedare per i nuovi tenant (ora copertura totale per-tenant, S984), mapping stale da correggere PRIMA dei satelliti.

### 1.C F7 "refactor estetico showcase" — **label STALE, item terminale**

Verdetto evidence-based: F7 è chiuso tre volte (WS-6d consolidamento ADR-0013 in v1.0.0 · S961 fix+proposte · S965-S969 proposte chiuse una a una: tokenize colori già completo, `/system-health` wired-to-live, split/extract verificati già-fatto/cosmetico). La dicitura "refactor estetico" esiste **solo** in STATE.md:15 — nessun documento definisce uno scope residuo. Inventario odierno: 0 TODO/FIXME in apps/showcase; 3 colori raw triviali fuori da `palettes` (che espone hex by-design). **Azione**: rimuovere la voce dalla lista candidati al prossimo handoff. Un eventuale redesign del sito showcase è un **nuovo item PM**, non F7.

---

## 2. Residui censiti (sweep esaustivo SoT + verifiche codice — 12 voci, 3 fasce)

Tutti i candidati "chiusi?" verificati con evidenza (ESS-media S982, rich-text S981, free-text PROD S975, category-heatmap `5ec1c6d` + file su disco, PSR 000096, scheduled-recompute S978: **tutti DONE**). Restano:

### Fascia DATA/MODELING (decisione semantica PM + esecuzione breve)
| # | Item | Effort | Gate |
|---|---|---|---|
| R1 | `engagement_feedback` (685) + `engagement_action_plans` (6) — mai importati, nessuno stato terminale | ~3-5h | PM: feedback-module dedicato vs estensione m2b |
| R2 | Crosswalk ATECO↔NACE per `sys_activity_classification_mappings` — ora parzialmente sbloccato da ATECO_2025 (3257 righe, S983) | ~3-6h | PM: vale la pena o resta empty-by-design |
| R3 | Residuo B-51: 91 job_roles corrotti `OLDDB::` + ESCO enrichment dei 25 RTL-ROLE (family/seniority NULL) | ~2-4h | PM: bonifica o freeze |
| R4 | `sys_process_kpi_templates` authoring v5-native | — | terminal-by-design; riapribile solo su richiesta PM |

### Fascia HARDENING/OPS (CLASSE A — eseguibili senza decisione PM, alto valore "GA")
| # | Item | Effort | Note |
|---|---|---|---|
| R5 | **Backup DB schedulato + retention + off-host** — oggi solo snapshot manuali pre-op | ~2-4h | miglior rapporto rischio-mitigato/effort dell'intero menu |
| R6 | **OpenAPI/Swagger exposure** dei 407 endpoint Zod-typed (`@fastify/swagger` 9.7 già nel tree, 0 wiring) | ~3-6h | candidate "public API docs" |
| R7 | **Timer reindex embeddings** (oggi solo manuale `POST /v1/matching/reindex`) — drift silenzioso del substrato kNN | ~1-2h | stesso chassis systemd di insights/scraping; da co-progettare con eventuale F4 SF |
| R8 | **Metriche/alerting app-level** (API senza `/metrics`; Grafana+prometheus sulla VM scrapano solo node/pg exporter — da verificare on-VM) | ~3-6h | prerequisito: check on-VM di cosa è già scrappato |

### Fascia QUALITY (PM-discrezionale)
| # | Item | Effort | Gate |
|---|---|---|---|
| R9 | Baseline load-testing (k6) su endpoint caldi — mai fatto, 0 ref nel repo | ~4-8h | PM: rilevante su free-tier ARM senza traffico reale? |
| R10 | a11y manuale: AAA + keyboard-nav + screen-reader (NVDA/VoiceOver) + forced-colors | ~6-10h | A/AA automatico è a zero totale; questo è il tail manuale |
| R11 | axe-core step nello Storybook upstream `ux-design-shared` | ~1-2h | repo upstream |
| R12 | Driver S3/MinIO per media object-store (seam local-disk shipped S981) | ~3-5h | ⛔ infra/costo PM |

---

## 3. Direzioni strategiche nuove (dal critic — mai misurate prima, plausibili per QUESTO prodotto)

| Direzione | Razionale (1 riga) | Effort | Su cosa poggia già |
|---|---|---|---|
| **3.1 Go-to-market: primo tenant reale** | È la decisione che **prezza tutte le altre**: finché resta case-study, SF è dimostrativo e Wave-3 accademico; un pilota reale impone signup/provisioning, revisione ADR-0023 (PII vera), retention, supporto | L | tenants CRUD, I5 + 7 viste validate, MFA per-tenant, HTTPS heuresys.com |
| **3.2 Security audit / pentest** | La superficie auth è interamente self-built (Argon2id/JWT/refresh-rotation/CSRF/MFA 4-kind); gli 889 test sono funzionali, non adversariali — OWASP ASVS + ZAP baseline è il complemento mancante per dirsi "GA" | M | helmet/rate-limit/CSRF/log-redaction già in catena; skill security-review |
| **3.3 BPM runtime (workflow engine)** | Il prodotto si chiama HRMS/**BPM** ma il lato BPM è solo modeling statico: nessun process-instance, task inbox, approvazioni, SLA — il ruolo PROCESS_OWNER non ha un runtime da possedere | L | 9 moduli blueprint-*, KPI templates, RBAC, visualization graphs |
| **3.4 Notification center + email digest** | La piattaforma calcola flight-risk/skill-gap/matching ma **nessuno viene avvisato**: chiudere il loop moltiplica il valore dell'analytics già shipped | M | mailer seam (SMTP/InMemory), pattern systemd timer; ⛔ creds SMTP (già open) |
| **3.5 Reporting & exports (CSV/XLSX/PDF)** | Gli HR admin vivono di export: oggi **zero** export tabellari (verificato); un exporter generico sugli endpoint list Zod-typed è alto valore percepito | M | exceljs nel tree, schemi Zod → colonne derivabili, RBAC riusabile |
| **3.6 PWA packaging dell'ESS** | L'unica storia "mobile" realistica per un solo developer: manifest + service worker + install prompt (oggi zero infra PWA) | S | a11y mobile chiuso S983, 13 pagine /me/* shipped |
| **3.7 DR drill: restore verification + RPO/RTO** | Un backup mai ristorato non è un backup — estende R5 con drill periodico + obiettivi dichiarati | S | clone-vm-db.sh prova già il restore path (linux-pc twin) |
| **3.8 AI deepening su pgvector esistente** | Feature LLM-assisted visibili (narrativa skill-gap, career-coach, JD generation da job_roles+ESCO) — il differenziatore più vendibile, in fasi additive | M | semantic-matching + voyage-client + insights + tassonomie ESCO/ATECO live; ⛔ spend LLM PM |
| **3.9 Data-retention / GDPR tooling** | Oggi correttamente assente (ADR-0023 no-PII); diventa **prerequisito non-negoziabile** il giorno del primo tenant reale — gated da 3.1, non da fare ora | M | schema audit, pattern delete-then-insert (D-18) |

---

## 4. Bug di prodotto scoperto in S985 (fuori menu, va deciso SUBITO)

**D-26 (DEBT_REGISTER)**: il silent-refresh è **strutturalmente rotto** attraverso il proxy `/api` — il cookie `hrx_refresh` è path-scoped a `/v1/auth` ma il client lo invoca su `/api/v1/auth/refresh` (mai inviato dal browser), e il middleware redirige a `/login` su cookie scaduto prima di ogni chiamata client → **gli utenti reali in PROD vengono sloggati ogni 15 minuti** (TTL access token), con re-login TOTP obbligatorio ora che mandatory-MFA è live. Stessa topologia nginx in PROD. Fix = decisione di design (cookie path vs proxy rewrite vs route handler), hot-path auth sensibile (~80 file test): **sessione dedicata ~2-4h**. È il candidato n°1 a prescindere dalla roadmap.

---

## 5. Raccomandazione composta (fasi additive, decide il PM)

1. **Subito (prossima sessione)**: **D-26 refresh fix** — è UX rotta in PROD live, tutto il resto può attendere.
2. **Quick-wins CLASSE A senza decisione PM** (~1 sessione aggregata): R5 backup+R7 reindex timer+3.7 DR drill light; R6 OpenAPI se avanza budget.
3. **Domanda strategica da rispondere prima di investire grosso**: **3.1 go-to-market** (case-study permanente vs prodotto con pilota reale). La risposta decide il peso di SF (1.A), Wave-3 (1.B), GDPR (3.9) e del BPM runtime (3.3).
4. **Scelte semantiche brevi quando capita** (R1-R3): un pomeriggio ciascuna, nessuna fretta.
5. **Bet di prodotto** (3.3-3.6, 3.8): da prioritizzare DOPO la risposta al punto 3 — tutti componibili, nessuno bloccante per gli altri.

### Open questions per il PM — DECISE S987 (2026-06-13)

Tutte le direzioni sono state decise da Enzo in S987 (intervista P3 + decisioni Fase 3). Record durevole: `memory/project_post_v1_program_s987.md` + `SOT_BACKLOG.md` §S987. **Non ri-chiedere.**

- **D-26**: ✅ greenlight + **FATTO** S987 (mig/fix `fa564fe`, gate verde).
- **Go-to-market (3.1)**: → **IBRIDO** — provisioning self-service + GDPR tooling (3.9) come fondazione additiva, no pilota reale ora (Fase 5).
- **Wave-3 (1.B)**: → **L1** — solo fix Heuresys System (#8a mapping ✅ S987 `a589a6e`; #8b import solo chiara.spenuso). SmartFood/EcoNova NON onboardati (no multi-industry).
- **SuccessFactors (1.A)**: → **ESCLUSO** dal programma (#7 fuori scope per scelta Enzo).
- **F7**: terminale/label stale (verdetto S985 confermato).
- **R1/R2/R3**: → tutti e 3 ESEGUIRE — R1 modulo feedback + import 400+6 · R2 popola crosswalk ~5.5k · R3 cleanup 91 + catalogo families + ESCO (dettaglio in `memory/project_post_v1_program_s987.md`).
- **#9 bet ondata 1**: → tutti e 4 (3.2 security · 3.3 BPM runtime · 3.4 notifications · 3.5 reporting). Ondata 2: 3.6 PWA · 3.8 AI (⛔ LLM spend).
- **3.4 SMTP / 3.8 LLM spend**: restano gate di attivazione (config/costo) — il codice si costruisce comunque.
- **D-08 CRITICAL** (fork-PR su prod, audit A1) + **3.9 GDPR**: gated, decisione esecuzione Enzo (fase E 100X / Fase 5).

---
*Fonti: workflow `s985-discovery` (7 agenti, output completo nel transcript S985) · misure live 2026-06-12 · doc citati inline. Questo dossier è uno snapshot decisionale, non una SoT di stato: lo stato vive in `.handoff/STATE.md` + `docs/kb/SOT_STATE.md`.*
