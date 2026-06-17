# WS-T4 — Technology Fit & Best-Practice Benchmarking

> **Postura**: indipendente / avversariale. Valutazione dello stack rispetto alle best practice di settore per HRMS/BPM SaaS B2B. Data: 2026-06-17. HEAD `ce26608`. Ambiente: host Windows, tunnel SSH :5433 → OCI VM PostgreSQL 16.14.

---

## Sintesi

Lo stack scelto (Fastify 5.8 + Zod 4 + PostgreSQL 16 nativo + Next.js 16 App Router + pnpm monorepo + TypeScript 6 strict) è moderno, coerente e appropriato per un HRMS B2B multi-tenant. Le scelte architetturali chiave (raw SQL parametrico, no ORM, no Docker runtime, RS256 JWT, Argon2id, MFA multi-factor) sono difendibili e documentate in 23 ADR. La velocità di sviluppo è notevole: 75 moduli, 130 migration, 424 endpoint in ~6 settimane, typecheck sempre verde. I punti di debolezza rispetto alle best practice enterprise riguardano: (1) infrastruttura prod OCI free-tier single-VM non HA, (2) nessuna osservabilità strutturata (no APM/tracing/alerting proattivo), (3) dipendenze core bleeding-edge senza LTS consolidato, (4) backup DB non verificato indipendentemente, (5) SMTP non verificato come configurato in PROD. Lo stack tecnico è forte per una fase seed/pre-revenue ma richiede un investment in infrastruttura prima dell'onboarding del primo cliente enterprise.

---

## Claim del venditore rivalidati

| # | Claim | Fonte | Status | Evidenza |
|---|---|---|---|---|
| C-T1 | "TS 6.0.3, Next.js 16.2.9, Fastify 5.8.5, Zod 4.4.3, vitest 4.1.9, pnpm 9.15.0" | DISCOVERY.md §Stack | **CONFERMATO** | `apps/api/package.json` letto: `fastify@5.8.5`, `zod@4.4.3`, `typescript@6.0.3`. `apps/web/package.json` letto: `next@16.2.9`, `vitest@4.1.9`. Root `package.json` letto: `pnpm@9.15.0`. |
| C-T2 | "drizzle rimosso — raw parameterized SQL puro" | DISCOVERY.md C8 | **CONFERMATO** | `grep -rn "drizzle\|prisma\|typeorm\|knex" apps/api/src` = **0** (live 2026-06-17). `db/client.ts:5-7` conferma. |
| C-T3 | "0 vulnerabilità note (pnpm audit --prod)" | DISCOVERY.md | **CONFERMATO (dichiarato)** | Non ri-eseguito in questa sessione. Fiducia media (WS-H referenziato come verifica). |
| C-T4 | "PostgreSQL 16 nativo, NO Docker per runtime" | ADR-0004 | **CONFERMATO** | `SELECT version()` → `PostgreSQL 16.14 on aarch64-unknown-linux-gnu` (live 2026-06-17). `grep -rn "docker" db/scripts` → solo commenti ADR. |
| C-T5 | "RS256 JWT, Argon2id, CSRF double-submit, single-use refresh rotation con replay detection" | CLAUDE.md §Security | **CONFERMATO** | `apps/api/src/app.ts:262-275` letto: `sign.algorithm: "RS256"`. `apps/api/package.json`: `argon2@0.44.0`. `auth/service.ts:493`: `revokeRefreshFamily` su replay (letto sopra). |
| C-T6 | "pgvector embeddings, voyage-4-lite, cosine kNN per matching" | DISCOVERY.md C11 | **CONFERMATO (architettura)** | `grep -rn "pgvector\|embedding\|voyage" apps/api/src` → `insights/repository.ts:375`: `(1 - (jre.embedding <=> pe.embedding)) AS cosine`. `.env.example`: VOYAGE_API_KEY opzionale solo per backfill. |
| C-T7 | "8 CI workflow, 7 su runner self-hosted oci-vm" | .github/workflows | **CONFERMATO** | `ls .github/workflows/` → 8 file (live 2026-06-17). showcase.yml: `runs-on: ubuntu-latest` (GitHub-hosted). Tutti gli altri: `runs-on: [self-hosted, oci-vm]`. |
| C-T8 | "Backup DB schedulato + DR drill (RTO 93s)" | DISCOVERY.md C7 | **NON VERIFICABILE** | Claim riferisce a WS-C QW-C3. WS-C non letto in questa sessione. Nessun file `backup*.sh` trovato nei path Windows accessibili. Claim non verificato indipendentemente. |

---

## Finding

### T4-001
**ID**: T4-001
**Titolo**: TS 6.0.3 / Next.js 16.2.9 / Vitest 4.1.9 — versioni bleeding-edge, nessuna LTS consolidata
**Severità**: Medium
**Tipo**: Technology Fit
**Evidenza**: Da package.json letti direttamente:
- TypeScript 6.0.3: major release 2026 (TS 5.x era LTS consolidata)
- Next.js 16.2.9: versione oltre 15.x (già latest stabile quando documentato)
- Vitest 4.1.9: major oltre 3.x
- Playwright 1.61.0: latest ma con bug su Node 24 (D-36 — wrapper richiesto)
- React 19.2.7: latest
Stack dichiaratamente "a punta di innovazione" (commento fondatore implicito nelle scelte).
**Impatto**: (a) TS 6 major = breaking changes potenziali su tsconfig/features strict non ancora documentate; (b) Next.js 16 senza track record di stabilità enterprise; (c) Vitest 4: D-37 mostra hook-timeout flakiness; (d) dipendenze core senza LTS = patch security più frequenti, upgrade path non consolidato; (e) meno documentazione/StackOverflow per un futuro team.
**GA-blocker**: No (funziona oggi, typecheck verde)
**Remediation**: Valutare pinning a versioni N-1 con stabilità dimostrata per le dipendenze core. Documentare policy upgrade in ADR. Effort: S-M.
**Best-practice ref**: Enterprise SaaS B2B: LTS/stable per dipendenze core. Policy N-1 minor.
**Confidence**: Media (le versioni sono reali; il giudizio "bleeding-edge" dipende dall'upstream stability al momento del deployment)

---

### T4-002
**ID**: T4-002
**Titolo**: Infrastruttura prod = OCI free-tier ARM64 single-VM — non HA, no managed DB, no scaling orizzontale
**Severità**: High
**Tipo**: Technology Fit / Ops
**Evidenza**:
- VM: OCI free-tier ARM64 (2 OCPU, 12 GB RAM). DB PostgreSQL 16 sulla stessa VM (no separazione). nginx TLS stessa VM. DB size: **1240 MB** (live 2026-06-17).
- CI runner: stessa VM (SPOF, T1-003).
- OCI free-tier: nessun SLA commerciale Oracle.
- C-T8 (backup): NON VERIFICABILE indipendentemente in questa sessione.
- ADR-0010 Option C (OCI Managed PostgreSQL) documentata come futura ma non attuata.
**Impatto**: (a) SPOF totale: VM cade → PROD + CI + DNS + backup cadono insieme; (b) no HA DB (no replica, no failover); (c) scale-out orizzontale impossibile senza migrazione infra completa; (d) free-tier Oracle: rischio terminazione/upgrade forzato; (e) nessun SLA contrattuale per clienti reali.
**GA-blocker**: Sì (per onboarding del primo cliente con SLA)
**Remediation**: (Roadmap) Migrare DB a OCI Managed PostgreSQL (ADR-0010 Option C) o equivalente managed (Supabase/RDS); separare runner CI dalla VM PROD; configurare replica read + backup automatico. Effort: L-XL.
**Best-practice ref**: SaaS production: DB managed, compute separato, HA con replica, backup RPO ≤1h, SLA 99.9%.
**Confidence**: Alta

---

### T4-003
**ID**: T4-003
**Titolo**: Osservabilità strutturata assente — no APM, no distributed tracing, no alerting proattivo
**Severità**: High
**Tipo**: Technology Fit / Ops
**Evidenza**: `apps/api/src/modules/observability/routes.ts` esiste → `/v1/observability` con `metricsStore` in-memory (`app.ts:218-228`: `metricsStore.record(statusCode, elapsedTime, url)`). Logger: Pino JSON strutturato (buono). Nessun `opentelemetry`/`prom-client`/`@sentry/node` trovato in `apps/api/package.json` (letto sopra). Errori prod: visibili solo via SSH + log raw `/tmp/api.log`. playwright-smoke.yml menziona Grafana su porta 3000 (già sulla VM) ma nessuna integrazione API→Grafana trovata.
**Impatto**: (a) Degradamento silenzioso (pool saturo, latenza crescente, error rate elevato) senza alert proattivi; (b) post-mortem incidenti = accesso SSH + log raw; (c) un SLA con clienti reali richiede SLI/SLO misurabili e alerting su breach; (d) il metricsStore in-memory si azzera al restart.
**GA-blocker**: Sì (per SLA commerciali con clienti reali)
**Remediation**: (Roadmap) (a) OpenTelemetry SDK per Fastify (traces + metrics); (b) export Prometheus con `prom-client`; (c) alert su p99 latency, error rate 5xx, pool wait. Grafana OSS già sulla VM (porta 3000 — riutilizzabile). Effort: M.
**Best-practice ref**: DORA metrics, SLI/SLO/SLA framework, OpenTelemetry standard. Four Golden Signals (latency/traffic/errors/saturation).
**Confidence**: Alta (metricsStore in-memory confermato; assenza APM confermata da package.json letto)

---

### T4-004
**ID**: T4-004
**Titolo**: Semantic matching / AI: dipendenza Voyage esterna, embedding non sostituibili senza full backfill
**Severità**: Medium
**Tipo**: Technology Fit
**Evidenza**: `apps/api/src/config/env.ts:103-105` (letto): "VOYAGE_API_KEY: only the embedding BACKFILL script needs it. The serving API never calls Voyage (kNN runs over precomputed pgvector rows)." `.env.example:107-119`: VOYAGE_API_KEY opzionale, `MATCHING_FREETEXT_ENABLED` off per default. `insights/repository.ts:375`: `(1 - (jre.embedding <=> pe.embedding)) AS cosine` → operatore pgvector su embedding precomputati voyage-4-lite (1024-dim).
**Impatto**: (a) Cambio provider embedding (Voyage → OpenAI/Cohere/locale) richiede backfill completo di 21.939 skill + posizioni; (b) nessuna interfaccia di astrazione per l'embedding provider nel serving path (il DI seam `SemanticMatchingDeps` esiste per i test ma usa FakeEmbedder — non un provider reale alternativo); (c) se Voyage cambia pricing/API, il free-text matching `MATCHING_FREETEXT_ENABLED=true` è KO.
**GA-blocker**: No (serving path non chiama Voyage; matching strutturato sempre disponibile)
**Remediation**: Astrarre il provider embedding dietro `IEmbeddingProvider` (estendendo il DI seam test). Documentare procedura re-embedding. Effort: S-M.
**Best-practice ref**: Vendor abstraction per AI providers. OpenAI-compatible API convention.
**Confidence**: Alta

---

### T4-005
**ID**: T4-005
**Titolo**: SMTP non configurato per default — password-reset e notifiche email non funzionali senza config
**Severità**: Medium
**Tipo**: Technology Fit / Ops
**Evidenza**: `.env.example:130-163` letto direttamente: SMTP = OPZIONALE, fallback a `ConsoleMailer` (log su console). Commento: "NO SMTP PROVIDER? La platform è fully operable without one." Conseguenza: `POST /v1/auth/password-reset` usa ConsoleMailer → email non arriva all'utente. EMAIL_OTP MFA auto-HIDDEN senza SMTP. Status PROD: `.env` gitignored, non verificabile remotamente.
**Impatto**: Se SMTP non è configurato in PROD: password-reset non funziona per utenti reali; EMAIL_OTP MFA non disponibile. Funzionalità core HRMS (password recovery) non operativa senza configurazione manuale post-deploy.
**GA-blocker**: Sì (per onboarding clienti reali con password-reset)
**Remediation**: Verificare che la VM PROD abbia SMTP configurato; documentarlo in `deploy/README.md` come prerequisito pre-onboarding. Effort: XS (verifica), S (documentazione + alert).
**Confidence**: Media (SMTP status PROD non verificabile remotamente — .env gitignored)

---

### T4-006
**ID**: T4-006
**Titolo**: Backup DB non verificato indipendentemente — claim RTO 93s non confermato
**Severità**: High
**Tipo**: Technology Fit / Ops
**Evidenza**: DISCOVERY.md C7: "Backup DB schedulato + DR drill verificato live (RTO 93s, restore reale)" — claim riferisce a WS-C QW-C3. WS-C non letto in questa sessione. Nessun file `backup*.sh` o `pg_dump*.sh` trovato in `scripts/` o `db/scripts/` (bash live). Migration `000129_auth_audit_prune.sql` trovata (prune token, non backup). `ls db/migrations/*.sql | tail -5` mostra `000129`..`000131`.
**Impatto**: Senza backup automatico e testato: RTO/RPO non garantiti per incidenti OCI free-tier (corruzione, cancellazione, terminazione VM). DB = 1240 MB → pg_dump ≈ 10-15 min → RPO max = intervallo backup. Senza prove indipendenti, il claim "DR drill verificato" è una rappresentazione del venditore non corroborata.
**GA-blocker**: Sì (per SLA commerciali EU con GDPR data recovery obligations)
**Remediation**: Leggere WS-C per verificare il backup script; se assente, implementare `pg_dump` schedulato via systemd timer con copia offsite. Documentare RPO/RTO reali. Effort: S.
**Best-practice ref**: 3-2-1 backup rule. RPO ≤1h, RTO ≤4h per SaaS B2B. GDPR Art. 32 (sicurezza dei dati).
**Confidence**: Media (claim non verificato in questa sessione; potrebbe essere documentato in WS-C)

---

### T4-007
**ID**: T4-007
**Titolo**: OpenAPI gated OFF per default — documentazione API non auto-discoverable
**Severità**: Low
**Tipo**: Technology Fit
**Evidenza**: `apps/api/src/app.ts:192-209` letto: `fastifySwagger` + `fastifySwaggerUi` registrati solo se `env.API_DOCS_ENABLED`. `.env.example:124-127`: "DEFAULT OFF. Enable in dev/staging; keep OFF on public prod origin."
**Impatto**: Positivo: off per default in prod (sicurezza, surface enumeration). Negativo: gli integratori non hanno un modo self-service per scoprire l'API. Per un SaaS B2B con API commerciale, la documentazione è un asset di vendita e onboarding.
**GA-blocker**: No
**Remediation**: Generare e pubblicare lo spec OpenAPI come artefatto CI statico (GitHub Pages o developer portal). Effort: S.
**Confidence**: Alta

---

### T4-008
**ID**: T4-008
**Titolo**: ASSET — MFA enterprise-grade: TOTP + WebAuthn/FIDO2 + EMAIL_OTP + SMS_OTP + mandatory enforcement
**Severità**: Info
**Tipo**: Technology Fit (Asset)
**Evidenza**: `apps/api/package.json:dependencies`: `@simplewebauthn/server`, `otpauth`. `mfa-service.ts` (1085 LOC): 4 fattori MFA. `sys_auth_mfa_policies` per mandatory enforcement per-tenant. Kill-switch `MFA_ENFORCEMENT_ENABLED` per dev/test. AES-256-GCM at-rest per TOTP secrets (QW-SEC6, D-30 RISOLTO). Implementazione di classe enterprise per un sistema single-developer.
**GA-blocker**: N/A
**Confidence**: Alta

---

### T4-009
**ID**: T4-009
**Titolo**: ASSET — Stack tecnico moderno, 23 ADR, scelte documentate e difendibili
**Severità**: Info
**Tipo**: Technology Fit (Asset)
**Evidenza**: `ls docs/architecture/adr/` = 23 ADR (DISCOVERY.md). Scelte chiave documentate: ADR-0003 (raw SQL vs ORM), ADR-0004 (no Docker runtime), ADR-0005 (Argon2id), ADR-0008 (PIP come VIEW), ADR-0010 (OCI VM Option B), ADR-0023 (no-PII). Stack moderno attivamente mantenuto.
**GA-blocker**: N/A
**Confidence**: Alta

---

## Score del pilastro

| Score | Confidence | Motivazione |
|---|---|---|
| **65 / 100 — Debole** | Alta | Lo stack tecnico è moderno e ben documentato in 23 ADR — punto di forza per un single-developer. I gap di technology fit per un SaaS B2B enterprise sono strutturali: infrastruttura prod non HA (OCI free-tier single-VM = T4-002 HIGH), nessuna osservabilità strutturata (T4-003 HIGH), backup non verificato indipendentemente (T4-006 HIGH), SMTP potenzialmente assente in PROD (T4-005 MEDIUM), versioni bleeding-edge (T4-001 MEDIUM). La valutazione è "debole" per il go-to-market enterprise ma "adeguata" per la fase seed pre-revenue. Un round seed dovrebbe finanziare la migrazione infra come priorità P0. |
