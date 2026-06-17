# Due Diligence — heuresys-advanced — Rapporto completo — 2026-06-17

> Forense, investor-grade. HEAD `ce26608` (S994). 16 pilastri (rubrica `references/scoring-rubric.md`), 7 workstream-agent + verifica diretta del DD lead. Postura: indipendente/avversariale. **Score globale 61/100 → verdetto CONDITIONAL-GO** (dettaglio `SCORECARD.md`; sintesi investitore `EXECUTIVE_SUMMARY.md`).

---

## 1. Status quo (fotografia misurata)

**Cos'è**: piattaforma HRMS/BPM SaaS multi-tenant. Monorepo pnpm: Fastify 5.8 API (Zod 4, Argon2id, RS256 JWT, RBAC DB-driven) su PostgreSQL 16 nativo (OCI VM, tunnel SSH); Next.js 16 admin SPA + ESS portal; `@heuresys/ui` design-system npm-published; showcase static su GitHub Pages. Dichiarato **v1.0.0 GA** (2026-06-02), in produzione su HTTPS `www.heuresys.com`.

**Baseline misurata indipendentemente** (HEAD `ce26608`): 75 moduli API · **424 endpoint** `/v1/*` · 79 Zod schema condivisi · **130 migration** idempotenti · **148 file test / 1012 `it()`** su DB reale (0 mock) · 48 spec Playwright · ~35.8k LOC TS/TSX · 193 tabelle `sys.*` · typecheck **exit 0 pulito** · `pnpm audit --prod` **0 vulnerabilità**. DB live: 2 tenancies (RTL_BANK 158 + Heuresys), 162 users/positions, 11 ruoli/137 permessi/600 mapping RBAC, 21.939 skill ESCO, 126.051 occupation-skill reqs, embeddings pgvector HNSW 1024-dim (Voyage).

**Stato di maturità**: GA **tecnica reale** (API live, suite verde, migration in sync 130/130, PROD HTTPS <110ms). GA **commerciale assente**: dati 100% sintetici case-study (ADR-0023 no-PII), **0 tenant cliente reale**, nessun signup/pricing/billing/onboarding self-service nel codice né su PROD (verificato live: PROD è login-only). Sviluppo a cadenza altissima ma **single-developer** con governance leggera (242+ commit direct-to-main, 0 merge/PR dal v1.0.0).

**Programma "RELEASE 100X"** (`docs/kb/improvement/**`, lo "scenario di brevissimo periodo"): auto-audit forense interno già eseguito (WS-A..K + 14 dossier decisionali). Trattato come rappresentazione del venditore e rivalidato: vedi §6.

---

## 2. Punti di forza (top)

1. **Ingegneria sopra-media per uno stadio pre-seed single-dev** (T1 72 / T2 74 / T9 79). Plugin chain Fastify a 13 step corretta, separazione `server.ts`/`app.ts`, module-pattern 7-step replicato su 75 moduli, single pg pool, raw-SQL **100% parametrico**, 0 dipendenze circolari, 130 migration idempotenti (twice-run proven). 1012 test integration su **DB reale** (no mock) — la suite stessa è la live-E2E.
2. **Security posture forte e verificata** (T6 78). Auth interamente self-built ma **ben fatto**: Argon2id 64MiB/3/4, RS256 15min HttpOnly+SameSite, refresh single-use + family-revoke + replay-detection, CSRF double-submit su 206 route, TOTP AES-256-GCM at-rest, log redaction runtime-proven. 0 SQL-injection / 0 IDOR / 0 secret-leak trovati con analisi forense. Actions GitHub **SHA-pinned** (supply-chain).
3. **Asset dati / knowledge-layer raro** (T5 72 / P4). Tassonomia ESCO completa (21.939 skill, 126.051 occupation-skill requirements) + embeddings pgvector HNSW operativi + semantic matching reale. È un substrato dati difficile da replicare, costruito e ingerito (provenienza brownfield deterministica, lineage, reconciliation registry 148 POPULATED).
4. **Disciplina di debt-management e trasparenza eccezionali** (X3 meta-finding). DEBT_REGISTER: 37 debiti tracciati, 36 risolti con evidenza file:line + verifica live; auto-espone i propri CRITICAL (fork-PR ACE, refresh rotto). 23 ADR. Il venditore **sottostima sé stesso** (counts SoT per-difetto; feature dichiarate assenti che invece esistono).
5. **Capital-efficiency genuina** (P3 strength). Burn ≈ €0 (OCI free-tier + tempo founder), IP 100% del founder, 0 dipendenze copyleft virali (692 MIT / 77 ISC / 32 Apache sul prod tree, 0 AGPL/SSPL). Spiegabilità AI deterministica = plus per EU AI Act.

---

## 3. Punti di debolezza (top)

1. **Nessun business** (P3 38 Critico, P2 44). Zero monetizzazione implementata (no Stripe/billing/subscription/pricing nel codice), zero clienti, pre-revenue, infra free-tier non commerciale. Unit economics non calcolabili. SOM ≈ 0.
2. **Key-person dependency = bus factor 1** (X3 58). 845/848 commit di un solo umano; infra idiosincratica e in parte personale (tunnel-SSH-DB, CI-runner = VM-prod, agent-gateway su abbonamento Claude MAX **personale** del founder). È il rischio dominante per l'investitore.
3. **Infra non-enterprise** (T4 65, T8 62). OCI free-tier ARM single-VM: no HA, no managed DB, no load-balancer, no horizontal scaling. **CI runner self-hosted = la VM PROD** (SPOF + il DB di CI è lo stesso di PROD). Nessuna osservabilità strutturata (no `/metrics` app-level, no APM/tracing/alerting). Rollback non ≤1 comando.
4. **Promessa "BPM" non mantenuta** (X1, P1). Il prodotto si chiama HRMS/**BPM** ma il lato BPM è solo modeling statico: 0 process-instance, task-inbox, approvazioni, SLA runtime. Il ruolo PROCESS_OWNER non ha un runtime da possedere.
5. **Compliance enterprise da costruire interamente** (X2 66). Nessuno strato GDPR operativo (no erasure-flow per-soggetto, no RoPA/DPIA/DPA, retention solo su auth-audit); AI Act: lo scoring su dipendenti (flight-risk/succession) è **potenzialmente Annex III high-risk** — mitigato by-design (deterministico, spiegabile, RBAC-gated, no decisioni solely-automated) ma **non formalizzato**. Tutto correttamente gated al primo tenant reale, ma è lavoro non fatto.

---

## 4. Debito tecnico

Concentrato e per lo più **già rientrato**. Voci attive verificate:
- **DX/manutenibilità** (T2-002, MEDIUM): ~150 duplicazioni del pattern `ActorContext`/`actor()`/`isPlatform()` (613 occorrenze misurate), ~60 schemi paginazione con cap incoerenti (200/500/1000/50), 28k LOC di boilerplate module-pattern. Costo di evoluzione futura, non difetto funzionale. Remediation: estrazione helper condivisi (QW-4/B4/B5), effort M.
- **List-endpoint senza LIMIT** (T3-002, HIGH): alcuni endpoint list business senza cap → payload illimitato per PLATFORM_ADMIN. Parzialmente mitigato (QW-B2 ha messo cap difensivi su insights/surveys). Effort S-M.
- **Test layer** (T2-001/004, MEDIUM): piramide invertita — 10/148 file non esercitano il path HTTP, 0 unit-test frontend (solo 48 spec Playwright), suite single-worker serial (~13min CI). Robusta ma lenta e senza unit-layer reale. Effort M-L.
- **agent-gateway fuori da CI** build/lint (T1-001, MEDIUM): un workspace non coperto dalla pipeline. Effort S.
- **D-37** (LOW, unico debito formalmente aperto): `reference-sync` hook-timeout flaky sotto carico full-suite (I/O esterno ESCO). Effort S.

**Auth-audit table growth** (T5-001, HIGH, ma non-blocker oggi): `sys_auth_refresh_tokens` ~39.440 righe per 9 utenti di test (leak da CI/E2E), Seq Scan misurato (8.8ms). L'housekeeping job copre solo revocati/scaduti; manca invalidazione delle famiglie pre-re-login. Diventa GA-blocker al primo tenant reale.

## 5. Debito funzionale

- **X1-001 (HIGH)**: BPM senza runtime (vedi §3.4). Effort L (è una feature, non un fix).
- **X1-002 (MEDIUM)**: email delivery = chassis SMTP-gated (creds assenti in PROD) — le notifiche in-app esistono, l'email no.
- **Multi-industry assente** (P1): tassonomia processi/KPI banking-native (RTL); SmartFood/EcoNova non onboardati per scelta di prodotto.
- **Export/reporting**: l'analisi ha verificato che export CSV/XLSX/PDF + inbox in-app + a11y spec **ESISTONO** già nel codice (`apps/api/src/lib/export/`, `/me/inbox`) — il dossier interno li dava per assenti (drift documentale a favore del prodotto).

## 6. Antipattern da correggere/eliminare — e adjudicazione dei falsi positivi

- **Falso positivo CRITICAL adjudicato dal DD lead**: il finding T3-001 (N+1 illimitato su `POST /v1/notifications/broadcast`, classificato CRITICAL/GA-blocker dall'agente) è **SMENTITO**. Verifica diretta: `apps/api/src/lib/notifications/emit.ts:105-159` — `emitNotificationsBulk` esegue **2 query a prescindere da N** (1 opt-out lookup + 1 INSERT set-based via `unnest`, cap 500), e `service.ts:30` lo usa. L'agente aveva ri-segnalato il difetto *originale* dalla `WS-B.md` del venditore senza verificare il fix QW-B1 già shipped. **Lezione DD**: anche le finding-list interne vanno rivalidate sul codice corrente. Netto: **0 antipattern CRITICAL aperti**.
- Antipattern reali residui = quelli di §4 (duplicazione module-pattern, cap paginazione incoerenti) — MEDIUM, di manutenibilità, non di correttezza.
- **CI-runner = VM-PROD** (T1-003/X3-003): antipattern operativo (CI gira sullo stesso host/DB della produzione). HIGH, da separare.

## 7. Technology fit & best-practice benchmarking (alternative con TCO/effort/rischio)

Stack attuale (TS6/Next16/Fastify5.8/Zod4/pnpm/vitest/raw-SQL no-ORM) = **moderno e appropriato**; "modernità" NON è il gap. Build-vs-buy sui componenti critici:

| Componente | Scelta attuale | Alternativa | Effort migrazione | Rischio | TCO / verdetto DD |
|---|---|---|---|---|---|
| **Auth** | Self-built (Argon2id/JWT/refresh/CSRF/MFA 4-kind) | Auth0 / Clerk / Supabase-auth / Keycloak | XL (riscrive hot-path + ~80 test) | Alto | **STAY.** Il self-built è già fatto, testato, sicuro (T6 78) e azzera il costo per-MAU di Auth0/Clerk (che a scala è il TCO dominante). Migrare distruggerebbe valore. |
| **DB layer** | Raw parametrized SQL (ORM rimosso) | Drizzle/Prisma/Kysely | L | Medio | **STAY raw** (scelta corretta del venditore: drizzle era dead-dep). Eventuale query-builder leggero solo se il team cresce. |
| **Infra PROD** | OCI free-tier ARM single-VM, PG nativo | Managed PG (RDS/Cloud SQL/Supabase) + app su container HA / Fly/Render | M-L | **Basso-medio, ALTA priorità** | **MIGRARE prima di GA commerciale.** Il free-tier non è infrastruttura commerciale (no HA, no SLA). Costo ~€100-400/mese gestito. **P0 d'uso dei fondi.** |
| **CI runner** | Self-hosted unico = VM PROD | GitHub-hosted + 2° runner ephemeral | S-M | Basso | **MIGRARE.** Elimina SPOF + separa CI/PROD + parallelizza (CI −50% dichiarato). |
| **AI embeddings** | Voyage (1 provider, seam astratto) | Cohere / OpenAI / self-host | S | Basso | **STAY**, ma il seam `Embedder` con singolo provider concreto = lock-in basso-non-zero. Costo trascurabile (~$0.075/reindex completo). |
| **Agent serving** | Claude Agent SDK su abbonamento MAX **personale** | API key commerciale Anthropic / Bedrock / Vertex | S | **Bloccante pre-commerciale** | **MIGRARE prima del primo cliente pagante** (ToS Anthropic vieta il serving commerciale su subscription). Costo ~$0.075-0.23/sessione agente, da inserire nel modello. |

## 8. Programma di sviluppo in caso di acquisizione (verso GA commerciale)

Postura: **evoluzione selettiva**, non rewrite (lo stack regge). Effort in person-week (1 dev senior; parallelizzabile con team). Kill-criteria per fase.

| Fase | Obiettivo | Item chiave | Effort | Kill-criteria |
|---|---|---|---|---|
| **F1 — De-risk infra & key-person** (P0) | Rendere il sistema non dipendente dal founder e dal free-tier | Migrazione managed-DB + app HA; 2° CI runner GitHub-hosted (separa CI/PROD); rollback ≤1 cmd; backup off-host + DR drill schedulato; observability (`/metrics`+APM+alerting); migrare agent-gateway a API key commerciale; **hire 2° dev + CONTRIBUTING/ONBOARDING** | 6-10 ww | Se l'infra non si stacca dal founder in <3 mesi → riconsiderare l'intera tesi (key-person non neutralizzabile). |
| **F2 — GA commerciale layer** | Da "case-study" a "prodotto vendibile" | Signup/provisioning self-service multi-tenant; pricing/billing (Stripe); onboarding; auth-audit retention/famiglie (T5-001); cap paginazione globali | 5-8 ww | Se nessun pilota reale firma in F2 → il prodotto resta demo; sospendere prima di F4. |
| **F3 — Compliance enterprise** | Sbloccare clienti EU reali | GDPR tooling (erasure-flow, RoPA/DPIA/DPA, retention per-soggetto, consent); classificazione formale AI Act + documentazione high-risk; DPA template | 4-6 ww | Showstopper legale formale su AI Act high-risk non gestibile → NO-GO sul segmento HR-scoring EU. |
| **F4 — Colmare le promesse di prodotto** | Mantenere il nome "BPM" + valore percepito | BPM runtime (process-instance/task/approval/SLA); notification email delivery (SMTP); reporting avanzato; multi-industry (se strategico) | 8-14 ww | Se il BPM runtime non trova domanda di mercato → ri-posizionare come "HRMS + analytics" e togliere BPM dal naming. |
| **F5 — Hardening commerciale** | Fiducia enterprise | Pentest indipendente / OWASP ASVS / ZAP; load-testing (k6); a11y manuale AAA; eval/golden-set per il retrieval kNN (T7-002) | 4-7 ww | — |

**Effort totale stimato verso GA commerciale: ~27-45 person-week** (~6-11 mesi a 1 dev; ~3-5 mesi con un team di 2-3). Nessuna riscrittura strutturale richiesta — è **costruzione additiva** su una base sana.

---

## 9. Indice finding (per pilastro / severità)

| Pilastro | Critical | High | Medium | Low/Info | Top finding | GA-blocker |
|---|---|---|---|---|---|---|
| P1 | 0 | 1 | 1 | 1 | P1-001 GA tecnica≠commerciale | sì (commerciale) |
| P2 | 0 | 2 | 1 | — | P2-002 nessun moat single-dev | no |
| P3 | 0 | 2 | 1 | — | P3-001 zero monetizzazione | sì (commerciale) |
| P4 | 0 | 1 | 2 | — | P4-001 "AI/ML"=euristica, non ML | no |
| X1 | 0 | 1 | 2 | — | X1-001 BPM senza runtime | sì (claim BPM) |
| T1 | 0 | 1 | 2 | — | T1-003 CI-runner=VM-PROD | sì (cond. multi-dev/SLA) |
| T2 | 0 | 0 | 3 | — | T2-002 dup ActorContext | no |
| T3 | 0 (T3-001 SMENTITO) | 2 | 1 | — | T3-005 GDPR/AI-Act assente | sì (commerciale EU) |
| T4 | 0 | 3 | 2 | — | T4-002 free-tier non HA | sì (SLA) |
| T5 | 0 | 1 | 1 | 1 asset | T5-001 auth-token bloat | sì (al 1° tenant) |
| T6 | 0 | 0 | 3 | — | T6-002 cross-tenant revoke latente | sì (multi-tenant reale) |
| T7 | 0 | 1 | 2 | — | T7-001 agent-gateway su MAX personale | sì (pre-commerciale) |
| T8 | 0 | 3 | — | — | F-T8-01 runner SPOF | cond. |
| T9 | 0 | 0 | — | 3 info | F-T9-01 copertura 75/424 diretta | no |
| X2 | 0 | 1 (cond.) | 1 | 1 asset | X2-001 zero strato GDPR | sì (al 1° tenant) |
| X3 | 1 (X3-001 bus factor) | 0 | 1 | 1 (meta+) | X3-001 bus factor=1 | no (da prezzare) |

> Nota severità: la maggioranza dei GA-blocker è **condizionale** ("scatta al primo cliente reale / multi-tenant / SLA"), non difetti aperti oggi. Riflette il profilo "base sana, layer commerciale assente".

## 10. Riferimento scorecard
Score globale **61/100** → **CONDITIONAL-GO**. Dettaglio pesi/contributi: `SCORECARD.md`. Sintesi investitore + condizioni di remediation: `EXECUTIVE_SUMMARY.md`. Evidenze per pilastro: `workstreams/WS-*.md`.

---
*Limiti dichiarati della DD*: (a) info finanziarie/societarie non-discoverable → assunzioni esplicite (01_DISCOVERY §domande founder), finding P3/X relativi marcati `da confermare`; (b) live E2E ha esercitato 75/424 endpoint **direttamente** + la suite integration del venditore come corroborazione — la full-suite e Playwright non sono stati rieseguiti end-to-end in questa DD (T9 confidence ancorata a campione rappresentativo); (c) PROD toccato solo read-only.
