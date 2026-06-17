# WS-T8 — Operational Readiness & Scalability
**Data:** 2026-06-17 | **Auditor:** Claude Sonnet 4.6 | **Peso:** 3

---

## Executive Summary

**Score: 62/100 | Banda: Adeguato | Confidence: Alta**

Il progetto ha un'infrastruttura CI/CD funzionante con 8 workflow attivi, deploy automatizzato via `vm-deploy.sh`, backup schedulato e DR drill implementato. Tutte le GitHub Actions sono SHA-pinned (claim WS-G "0 SHA-pin" SMENTITO positivamente). Il gap principale è strutturale: un solo runner self-hosted sulla VM di produzione serializza tutti i job CI e usa il DB PROD live per i test, eliminando la separabilità CI/PROD. Il rollback è manuale (nessuno script `vm-rollback.sh`), l'osservabilità è in-memory senza persistenza né formato Prometheus, e il singolo nodo OCI Free Tier non ha path documentato di scale-out.

---

## 1. CI/CD Pipeline

### 1.1 Workflow inventory

| Nome | Runner | Trigger | SHA-pinned? | Timeout |
|---|---|---|---|---|
| `typecheck.yml` | self-hosted oci-vm | push/PR main + dispatch | Sì (tutte 5 action-ref) | 10 min |
| `lint.yml` | self-hosted oci-vm | push/PR main + dispatch | Sì | 5 min |
| `i18n-parity.yml` | self-hosted oci-vm | push/PR main (locales) + dispatch | Sì | 3 min |
| `shell-tests.yml` | self-hosted oci-vm | push/PR main (scripts/) + dispatch | Sì | 5 min |
| `test-integration.yml` | self-hosted oci-vm | push/PR main (api/**) + dispatch | Sì | 15 min |
| `build-web.yml` | self-hosted oci-vm | push/PR main (web/**) + dispatch | Sì | 20 min |
| `playwright-smoke.yml` | self-hosted oci-vm | push/PR main (web+api) + dispatch | Sì | 30 min |
| `showcase.yml` | **ubuntu-latest** (GH-hosted) | push main (showcase/**) + dispatch | Sì | 15 min |

Actions SHA-pinned (lista completa verificata live su tutti gli yml):
- `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6`
- `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6`
- `pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6`
- `actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4`
- `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7`
- `peaceiris/actions-gh-pages@84c30a85c19949d7eee79c4ff27748b70285e453 # v4`

### 1.2 Claim validation (WS-G)

| Claim WS-G | Evidenza verificata | Status |
|---|---|---|
| 7/8 workflow su runner self-hosted unico = VM prod (SPOF) | Verificato: 7/8 dichiarano `runs-on: [self-hosted, oci-vm]`; 1/8 (`showcase.yml`) su `ubuntu-latest` | **CONFERMATO** |
| 0/13 actions SHA-pinned | Tutte le 6 action-reference uniche sono SHA-pinned con commento versione. Grep live su tutti gli yml: nessuna ref a tag mobile. | **SMENTITO (positivo — asset)** |
| main ruleset = 0 required-status-checks (CI advisory) | Non verificabile via file locali (richiede GitHub API / web). Branch protection rules non sono nei file del repo. | **NON VERIFICABILE** |
| 242 commit direct-to-main | `git log --oneline origin/main | wc -l` = 848 commit. Trunk-based no-PR confermato dalla storia git (nessun branch di feature in corso). | **PARZIALE** (848 commit, pattern confermato) |

### 1.3 Finding CI/CD

**F-T8-01 — Runner Self-Hosted SPOF su VM PROD**
- Severità: HIGH
- Tipo: Reliability / Security
- Evidenza: 7/8 workflow `runs-on: [self-hosted, oci-vm]`. L'OCI Free Tier è istanza singola senza failover. Crash VM = CI giù + PROD giù simultaneamente.
- Impatto: Nessuna separazione CI/PROD. Manutenzione VM blocca entrambi i sistemi.
- GA-blocker: CONDIZIONALE (accettabile early-stage; bloccante per Series A)
- Remediation: Runner off-prod su `linux-pc` (candidato D-08 opzione Evolutiva) o GH-hosted per job non-DB.
- Effort: 1-2 sessioni
- Confidence: Alta

**F-T8-02 — DB PROD usato come DB CI per integration tests**
- Severità: HIGH
- Tipo: Reliability / Data integrity
- Evidenza: `test-integration.yml` step "Verify DB connectivity": `psql -h localhost -p 5432` — stesso socket del PROD. I test creano e cancellano record sul DB condiviso.
- Impatto: Race condition tra test CI e PROD live; test mal scritto può corrompere dati reali.
- GA-blocker: CONDIZIONALE
- Remediation: DB CI separato con schema clonato + seed-only (D-08 QW-G2, ~0.5 sessioni).
- Effort: 0.5 sessioni
- Confidence: Alta

**F-T8-03 — CI serializzato: 1 runner, nessun parallelismo**
- Severità: MEDIUM
- Tipo: Velocity
- Evidenza: 7 workflow su 1 runner = max 1 job contemporaneamente. Wall-time reale: typecheck 14 min, test 12m42s, playwright-smoke fino a 30 min. Push che tocca web+api+scripts → feedback loop ~50 min.
- Impatto: Velocity di sviluppo bloccata post-funding su team plurale.
- GA-blocker: NO
- Remediation: Runner multipli + affected-only filtering (D-08 opzione Evolutiva, 2 sessioni).
- Effort: 2 sessioni
- Confidence: Alta

---

## 2. Deploy & Rollback

### 2.1 Deploy procedure

`scripts/vm-deploy.sh` — script bash idempotente, documentato. Steps: hard git sync → self-re-exec guard (se lo script cambia nel commit) → pnpm install frozen-lockfile → ABI sentinel clean-reinstall (cambia Node → purga node_modules native) → `migrate-if-pending.sh` (sha256-gated, no-op se già migrato) → build shared → build api → build web → install/enable 4 systemd timer (scraping/insights/backup/reindex) → restart api+web → verify (curl readyz + web /login HTTP code).

**Asset operativi:**
- Self-modify-buffer re-exec: garantisce che la nuova versione dello script sia quella eseguita
- ABI sentinel: clean-reinstall automatico per native modules (argon2)
- `migrate-if-pending.sh` sha256-gated: zero doppioni
- Verify automatico post-restart: fallisce rumorosamente se l'API non risponde
- 4 timer schedulati installati idempotentemente ad ogni deploy

### 2.2 Rollback capability (KPI dichiarato: ≤1 comando)

Nessuno script `vm-rollback.sh` trovato (`ls scripts/vm-rollback.sh` → NOT FOUND). Il backup schedulato (`backup-db.sh` + timer) crea dump `.dump` in `pg_dump_snapshots/scheduled/` — sulla stessa VM. Un rollback richiederebbe manualmente: `git reset --hard <prev-sha>` + `bash scripts/vm-deploy.sh` + eventuale `pg_restore` del dump pre-deploy (che non esiste: il deploy non fa `pg_dump` prima).

**KPI "≤1 comando" non soddisfatto.**

### 2.3 Finding Deploy

**F-T8-04 — Assenza di rollback automatizzato**
- Severità: HIGH
- Tipo: Reliability / Operability
- Evidenza: `scripts/vm-rollback.sh` NOT FOUND. `vm-deploy.sh` non contiene `pg_dump` pre-deploy (grep confermato). `dr-drill.sh` testa restore da backup schedulato, non da checkpoint pre-deploy.
- Impatto: Deploy con bug/migrazione-errata → RTO manuale multi-step potenzialmente lungo.
- GA-blocker: CONDIZIONALE
- Remediation: `pg_dump --format=custom` pre-deploy + `LAST_GOOD` git ref + `vm-rollback.sh` (D-08 opzione Conservativa, ~0.5 sessioni).
- Effort: 0.5 sessioni
- Confidence: Alta

**F-T8-05 — PROD traccia origin/main HEAD, non tag semver**
- Severità: MEDIUM
- Tipo: Release strategy
- Evidenza: `vm-deploy.sh` riga 45-46: `git checkout "$BRANCH"` + `git reset --hard "origin/$BRANCH"`. `BRANCH` default = `"main"`. Ogni push può finire in PROD al prossimo deploy.
- Impatto: Nessun versioning esplicito di PROD. Impossibile affermare "PROD è v1.2.3" senza leggere SHA.
- GA-blocker: NO
- Remediation: Deploy via tag + `DEPLOY_TAG` env var.
- Effort: 0.5 sessioni
- Confidence: Alta

---

## 3. Backup & Disaster Recovery

### 3.1 DR drill claim (QW-C3, RTO 93s)

`scripts/dr-drill.sh` esiste ed è implementato. Logica: trova il dump più recente in `pg_dump_snapshots/scheduled/` → misura RPO (età del backup) → crea scratch DB → `pg_restore --no-owner --no-acl` (via stdin per permission, non path — fix S993) → verifica row-counts restored vs PROD (4 tabelle chiave) → droppa scratch → report PASS/WARN. STRICT mode: exit non-zero su RPO > 48h o restore rotto → systemd marca il unit failed. `heuresys-advanced-dr-drill.timer` presente in `deploy/systemd/` (verificato via Glob). Il claim RTO 93s è plausibile ma non verificato in questa sessione (il drill gira sulla VM).

### 3.2 Backup schedulato off-host

`heuresys-advanced-backup.timer` installato da `vm-deploy.sh` (riga 125). Il backup crea dump in `$ROOT/pg_dump_snapshots/scheduled/` — **path sulla stessa VM** che ospita il DB. Il backup non è off-host: un failure del disco/VM distrugge PROD e backup contemporaneamente.

`auth-housekeeping.sh` + timer: gestisce pruning di `sys_auth_refresh_tokens` (revocati/scaduti) e `sys_auth_login_events` (>180d). Correttamente implementato e schedulato.

### 3.3 Finding DR/Backup

**F-T8-06 — Backup on-VM: nessuna copia off-host**
- Severità: HIGH
- Tipo: Disaster Recovery
- Evidenza: `dr-drill.sh` riga 28: `BACKUP_DIR="${BACKUP_DIR:-$ROOT/pg_dump_snapshots/scheduled}"` — path relativo alla repo root sulla stessa VM che ospita PostgreSQL.
- Impatto: Disk failure / VM termination = perdita simultanea di PROD DB + backup. Il DR drill dimostra restorability locale ma non durabilità.
- GA-blocker: CONDIZIONALE (tollerabile early-stage; bloccante per compliance con clienti enterprise)
- Remediation: `rclone` / OCI Object Storage / S3 post-dump. ≤0.5 sessioni.
- Effort: 0.5 sessioni
- Confidence: Alta

---

## 4. Observability

### 4.1 Application-level metrics

In-process metrics store: `apps/api/src/modules/observability/metrics-store.ts` — ring buffer 1440 min-bucket, aggregato da `GET /v1/observability/system-health` (PLATFORM_ADMIN-only). Metriche: uptime 24h %, totalRequests, byStatusClass, errorRate5xx %, clientErrorRate4xx %, avgDurationMs. Alimentato via `onResponse` lifecycle hook in `app.ts` (righe 214-226). I dati sono in-RAM: si azzerano ad ogni restart.

Non presente: formato Prometheus (`/metrics` endpoint), `prom-client` dep, persistenza serie storica, distributed tracing, error tracking esterno, alerting.

La VM ospita già Prometheus (9090), node-exporter (9100), pg-exporter (9187) via Docker (da `deploy/README.md` port map) — ma non raccolgono metriche applicative Fastify.

### 4.2 Infrastructure monitoring

Prometheus + Grafana (porta 3000 Docker) monitorano OS e PostgreSQL. Nessun dashboard applicativo (latenza endpoint, error rate, RBAC denials, login failures, auth events). Il ring-buffer admin esiste ma non è osservabile esternamente.

### 4.3 Finding Observability

**F-T8-07 — Metrics in-RAM: nessuna persistenza, nessun Prometheus scraping**
- Severità: MEDIUM
- Tipo: Observability
- Evidenza: `metrics-store.ts` riga 176: `export const metricsStore = new RequestMetricsStore()` — singleton in-process. Nessun `prom-client` in `package.json`. Nessun endpoint `/metrics`. Prometheus installato ma non vede l'applicazione.
- Impatto: Metriche azzerate ad ogni deploy/restart. Nessuna storicità. Incident investigation = journal logs solo.
- GA-blocker: NO
- Remediation: D-09 opzione Evolutiva: `prom-client` + `GET /metrics` loopback-bound + Prometheus pull-config. ~1 sessione.
- Effort: 1 sessione
- Confidence: Alta

---

## 5. Scalability Assessment

### 5.1 Current architecture limits

| Componente | Limite attuale | Note |
|---|---|---|
| VM OCI Free Tier ARM64 | 1 nodo, no auto-scaling | Unico punto di failure infrastrutturale |
| Fastify API | Single-process, no cluster | PM2 cluster richiederebbe RBAC cache condivisa |
| PostgreSQL | 1 istanza locale, pgbouncer :6432 | pgbouncer presente ma non verificato se usato dall'API |
| Scheduler jobs | 4 systemd timer single-instance | No distributed lock; safe con 1 nodo |
| Next.js web | No CDN; assets serviti da nginx sulla stessa VM | CDN migliorerebbe TTFB globale |
| Auth state | JWT + refresh token nel DB condiviso | Compatibile con scale-out orizzontale (shared DB) |

### 5.2 Bottlenecks identificati

| Bottleneck | Scenario trigger | Mitigazione attuale |
|---|---|---|
| PostgreSQL single-node | >100 concurrent heavy analytics | pgbouncer installato (non verificato nell'API config) |
| RBAC cache in-RAM | Multi-process deployment | N/A: single-process oggi |
| `next build` ARM64 su VM | Ogni deploy richiede rebuild completo | Cache `.next/cache` in CI (build-web.yml) |
| Playwright CI su stesso host di PROD | CI + PROD traffic sovrapposti | Porte separate 3001/3187 + setsid isolation |
| 3GB node_modules su runner VM | Runner restart dopo crash | `--prefer-offline` + pnpm cache |

### 5.3 Finding Scalability

**F-T8-08 — Architettura single-node senza path di scale-out documentato**
- Severità: LOW
- Tipo: Scalability
- Evidenza: `deploy/README.md`, `vm-deploy.sh` — nessun riferimento a cluster, load balancer, replica PostgreSQL, containerizzazione.
- Impatto: Accettabile per early-stage/SMB. Non scalable oltre ~500 MAU concorrenti senza redesign.
- GA-blocker: NO
- Remediation: Documentare threshold di scale-out; verificare se pgbouncer è nel connection string dell'API.
- Effort: 0.5 sessioni (documentazione) + 2-3 sessioni (esecuzione)
- Confidence: Media

---

## 6. Finding Register T8

| ID | Titolo | Severità | GA-blocker | Confidence |
|---|---|---|---|---|
| F-T8-01 | Runner self-hosted SPOF su VM PROD | HIGH | CONDIZIONALE | Alta |
| F-T8-02 | DB PROD usato come DB CI (integration tests) | HIGH | CONDIZIONALE | Alta |
| F-T8-03 | CI serializzato: 1 runner, nessun parallelismo | MEDIUM | NO | Alta |
| F-T8-04 | Assenza di rollback automatizzato | HIGH | CONDIZIONALE | Alta |
| F-T8-05 | PROD traccia origin/main HEAD, non tag semver | MEDIUM | NO | Alta |
| F-T8-06 | Backup on-VM: nessuna copia off-host | HIGH | CONDIZIONALE | Alta |
| F-T8-07 | Metrics in-RAM: nessuna persistenza, nessun Prometheus | MEDIUM | NO | Alta |
| F-T8-08 | Architettura single-node senza path scale-out documentato | LOW | NO | Media |

**GA-blocker CONDIZIONALE** = bloccante per round Series A o per contratti enterprise con SLA; accettabile per early-stage pre-revenue con clienti SMB.
**GA-blocker count: 0 assoluti, 4 condizionali.**

---

## 7. Score T8

**Score: 62/100 | Banda: Adeguato (60-74)**
**Confidence: Alta**

**Criteri di scoring:**

| Area | Punti max | Assegnati | Note |
|---|---|---|---|
| CI/CD pipeline attiva e configurata | 25 | 18 | Pipeline funzionante, SHA-pinned, concurrency; -7 per SPOF+DB-CI |
| Deploy automatizzato e robusto | 20 | 14 | vm-deploy.sh solid, ABI guard, self-re-exec; -6 per no rollback |
| Backup & DR | 20 | 12 | DR drill + timer implementati; -8 per backup on-VM + no off-host |
| Observability | 20 | 10 | Ring buffer + admin endpoint; -10 per no persistence + no Prometheus |
| Scalability & architettura | 15 | 8 | Single-node documentato; pgbouncer presente ma non verificato |

**Asset positivi non riconosciuti da WS-G:**
- TUTTE le actions sono SHA-pinned (WS-G claim "0/13" era errato — asset supply chain FORTE)
- Fork-guard ACE già implementato (F-WS-G-1 chiuso S988, commit `7177dda`)
- `auth-housekeeping.sh` + timer: gestione corretta TTL token
- `dr-drill.sh` STRICT mode + systemd alert: DR maturo per dimensione del progetto
