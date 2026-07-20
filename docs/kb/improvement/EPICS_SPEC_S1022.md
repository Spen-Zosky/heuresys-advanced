# SPEC ESEGUIBILI — 3 epiche GO-BRANCH (D-08 / D-09 / D-14) · S1022

> Design prodotto dal fan-out S1022 (dossier + stato reale verificato). Ogni fase marca se è **autonoma** (eseguibile senza input Enzo) o **decisione Enzo** (CLASSE B). Regola MASTER_PLAN: cambi strutturali su branch dedicato + gate verdi.

---

## D-09 — Observability /metrics Prometheus · **FASI 1-4 DONE (S1022, `fa24f7f3`, in main)**

- ✅ **FATTO e in main** (gated OFF, prod-safe): `prom-client` + `observability/prometheus.ts` (registry: http_request_duration histogram route-labeled + default process metrics + auth_events_total counter), route `GET /metrics` loopback-only + gated `PROM_METRICS_ENABLED`, counter agganciato a `insertLoginEvent`. Gate: test 4/4 + auth 20/20 + typecheck + build tsup.
- ⏳ **FASE 5 (autonoma nell'esecuzione, GATED su GO Enzo)**: collector pull-based systemd sulla VM che scrapa `127.0.0.1:8013/metrics` + retention serie storica + doc. **Decisione Enzo**: GO pieno (Evolutiva) + budget disco/retention (15 vs 30 gg) su OCI free-tier. Per attivare: `PROM_METRICS_ENABLED=true` nel `.env` VM (via `env-key-merge`), poi il collector.

---

## D-08 — CI/CD robustness (SPOF + DB-coupling) · **spec pronta, non iniziata**

Stato reale: GIÀ shippati fork-guard, pg_dump pre-deploy, `vm-rollback.sh`, probe-as-gate, SHA-pin Actions, cache. **Residuo misurato**: (A) CI gira sul **DB PROD** (`test-integration.yml:73` + `playwright-smoke.yml:122` usano `POSTGRES_DATABASE=heuresys_advanced`); (B) 0 limiti risorsa sul runner; (C) `main` **non protetto** (`gh api branches/main/protection` → 404, 0 required-checks → CI advisory); (D) **1 solo runner** = la VM PROD (`gh api actions/runners` → total 1).

- **FASE 1 (AUTONOMA) — DB-CI isolato `heuresys_ci`**: nuovo `db/scripts/setup-ci-database.sh` idempotente (createdb `heuresys_ci` + clone da `heuresys_advanced` col pattern di `clone-vm-db.sh` + migrate + seed personas) — dato D-52 (tx-rollback per-file) non drifta → clone one-time + refresh periodico. Poi in `test-integration.yml` + `playwright-smoke.yml` override job-level `env: POSTGRES_DB/POSTGRES_DATABASE: heuresys_ci` (sovrascrive l'EnvironmentFile del runner → vitest via `env.ts`→`client.ts` punta a `heuresys_ci`). **Gate**: CI verde su heuresys_ci + `SELECT count(*) FROM sys.sys_users` su heuresys_advanced identico prima/dopo (PROD non riceve più scritture di test).
- **FASE 2 (AUTONOMA) — deploy-gate CI-verde**: in `vm-deploy.sh` dopo il reset, gate opzionale (default ON, `DEPLOY_REQUIRE_CI=0` per bypass): `gh run list --commit <sha> --workflow test-integration.yml -q '.[0].conclusion'` deve essere `success`, altrimenti abort. Preserva NO-auto-deploy.
- **FASE 3 (AUTONOMA) — cgroup resource-slice**: drop-in systemd sull'unit del runner (`MemoryMax`/`CPUQuota`) versionato in `deploy/systemd/` — impedisce che un build/chromium/suite degradi PROD sull'ARM free-tier.
- **FASE 4 (DECISIONE Enzo) — required_status_checks**: estendere ruleset `main-protection-tier1` con required-checks (partire con typecheck+lint veloci, NON i gate DB lunghi su runner SPOF). Trade-off: cambia la meccanica direct-to-main.
- **FASE 5 (DECISIONE Enzo — infra) — 2° runner off-prod su linux-pc**: registrare linux-pc (192.168.1.11, twin x86_64 con DB locale) come runner `off-prod`, spostando i gate DB a girare contro il DB LOCALE del twin. Chiude SPOF + resource-contention + secret-on-prod + coda in un colpo.

---

## D-14 — Provisioning self-service + GDPR-tooling · **spec pronta (funzioni verificate esistenti)**

Stato reale: 0 endpoint provision/signup; `tenant-materialization` esiste (materializza tenant); GDPR = solo `/privacy` page marketing. §3.1 IBRIDO PM-approvata S987.

- **FASE 1 (AUTONOMA, SLICE DI PARTENZA) — provision-engine transazionale admin-gated**: nuovo modulo `tenants` esteso o `provisioning`. `POST /v1/tenants/provision` (`requirePermission('tenant:create')` + `verifyCsrf`) che in **un `withTransaction`** compone (tutte le funzioni VERIFICATE esistenti, `DbConnector`-compatibili):
  1. `insertTenant(client, {tenantCode, tenantName, ..., tenantStatus:'ACTIVE'})` (`tenants/repository.ts:137`)
  2. `insertUser(client, tenant.id, {email, displayName, status:'ACTIVE', type:'STANDARD', ...})` (`users/repository.ts:157`)
  3. insert identity LOCAL (pattern `seed-test-admin.ts` INSERT `sys_auth_identities`; estrarre in `auth/repository.ts:insertIdentity` se non esiste)
  4. `argon2.hash(password, ARGON2_PARAMS)` (da `auth/password.ts`) + `insertCredential(client, {identityId, hash, mustRotate:true})` (`auth/repository.ts:151`)
  5. `findRoleByCode(client, 'TENANT_ADMIN')` + `insertRoleGrant(client, {userId, roleId, tenantId:tenant.id, grantedBy:actor.userId})` (`users/repository.ts:281,316`)
  6. `upsertPolicy(client, {tenantId, ...})` MFA-policy per-tenant (`mfa-policy/repository.ts:69`)
  + schema shared `provisioning` (request/response) + integration test (provision → login del nuovo admin → verifica ruolo/tenant; rollback su errore intermedio → nessuna riga). **Nessuna PII nuova, admin-gated = default sicuro.** ~1 sessione.
- **FASE 2 (AUTONOMA)**: completezza (ruoli default, archetipo opzionale, idempotenza/feature-flag).
- **FASE 3-4 (DECISIONE Enzo — scope/policy)**: GDPR DSR-export (cosa esportare: quali `sys_user_*`, formato) + erasure/retention (cosa erasabile vs legal-hold payroll/contratti; finestre per data-class; consent-ledger). Il MECCANISMO è autonomo, lo SCOPE no.
- **FASE 5 (DEFER)**: signup pubblico + PII vera + revisione ADR-0023.

---

## Decisioni Enzo pendenti (sbloccano le fasi non-autonome)

1. **D-08 FASE 4** — quali required-checks mandatory su `main` (typecheck+lint per iniziare?) e quando i gate DB.
2. **D-08 FASE 5** — registrare linux-pc come 2° runner off-prod (infra: box da mantenere, twin esposto alla CI di un repo pubblico).
3. **D-09 FASE 5** — GO collector systemd VM + retention (15/30 gg).
4. **D-14 FASE 3-4** — scope GDPR minimo (cosa DSR-export / cosa erasabile vs legal-hold / retention per data-class / consenso).

Le fasi **autonome** (D-08 F1-3, D-14 F1-2) sono eseguibili nella prossima sessione senza attendere: la spec sopra è verificata sui file reali.
