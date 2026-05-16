Sono Enzo Spenuso. Riprendo il progetto Heuresys Advanced HRMS/BPM Platform v5
in `D:\heuresys-advanced\`. Sessione precedente: chiuso MVP-1 step 5.1.3 +
tutti i 4 follow-up + step 5.1.4 (schemas → @heuresys/shared). 15/15 test verdi.

  c219741  feat(shared): MVP-1 5.1.4 — promote auth schemas to @heuresys/shared
  2239c48  docs(handoff): update for 5.1.3 followups closure
  7450f77  docs(security): AUTH_SECURITY_PLAN.md errata — cookie path + login/refresh status
  ffd3007  test(api): MVP-1 5.1.3 followup #3 — live pino redaction test (config-level)
  0cb3aee  test(api): MVP-1 5.1.3 followup #2 — live rate-limit test (11 logins → 429)
  eb67e63  feat(api): MVP-1 5.1.3 followup #1 — TENANT_ADMIN own-tenant scope on admin-revoke
  3f5a03d  chore(api): MVP-1 5.1.3 acceptance verification + HANDOFF update
  5171a9c  test(api): MVP-1 5.1.3g — auth integration suite (11/11 PASS via app.inject)
  c757152  feat(db): MVP-1 5.1.3f — idempotent test-admin seed (PLATFORM_ADMIN)
  6cfa944  feat(api): MVP-1 5.1.3e — /v1/auth/* routes + per-route rate limits
  83f653f  feat(api): MVP-1 5.1.3d — auth service (rotation + replay detection + mailer)
  899aab0  feat(api): MVP-1 5.1.3c — auth repository (raw SQL against sys.sys_auth_*)
  a424d51  feat(api): MVP-1 5.1.3b — auth schemas + crypto/token helpers
  2e32b79  chore(api): typecheck hygiene — exclude db/scripts + auth.ts type collision fix
  5b6b141  feat(api): MVP-1 5.1.3a — RBAC cache loader (388 role×perm in-memory)
  ...

=== PRIMING OBBLIGATORIO ===

Prima di toccare codice leggi nell'ordine (in parallelo dove possibile):

  1. START_HERE.md                                  (canonical session entry point)
  2. docs/BOOTSTRAP_EXECUTION_PLAN.md               (§5 MVP roadmap, §9 RD-01..RD-25,
                                                     §8 risk register R1..R15)
  3. docs/architecture/ADR_INDEX.md                 (11 ADR — tutti Accepted dopo RD-25)
  4. docs/api/API_IMPLEMENTATION_PLAN.md            (§3 server bootstrap, §4 middleware,
                                                     §5 module roster, §6.1 auth, §6.5 me/)
  5. docs/security/AUTH_SECURITY_PLAN.md            (§2 DDL 11 auth tables, §3 Argon2id,
                                                     §4 JWT+refresh+CSRF, §6 role×perm matrix)
  6. docs/db/TARGET_SCHEMA_DESIGN.md                (~123 sys + 10 views + 10 aux)
  7. docs/db/MIGRATION_IMPLEMENTATION_PLAN.md       (27 migrations applicate, idempotent)
  8. apps/api/src/                                  (server.ts + app.ts + middleware/ +
                                                     modules/auth/ — full 5.1.3 module)
  9. apps/api/test/auth.integration.test.ts         (11 test references)

Poi leggi la memory persistente (cross-session):
  `C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\MEMORY.md`
  - feedback_full_autonomy        (autonomia piena su install/commit, no push, no destructive)
  - brownfield_legacy_source_paths (D:\evo.heuresys.com + /home/ubuntu/heuresys-evo)

=== STATO LIVE (verificato a fine sessione precedente) ===

Database (su OCI VM `oracle-vm-default`, cluster PG 16.13, porta 5432):
  - DB `heuresys_advanced` side-by-side con `heuresys_platform` (711 legacy tables)
  - 118 sys tables + 11 views + 6 brownfield aux + 4 audit aux
  - 8 roles + 98 permissions + 388 role×perm mappings seeded
  - RTL_BANK_REFERENCE tenant + 5 branches + 158 positions + 158 synthetic users +
    158 PRIMARY ACTIVE assignments (Faker seed=42, deterministic)
  - 27/27 migrations applicate, idempotency proven (pg_dump diff vuoto)
  - 7/7 structural validation views PASS

API runtime:
  - apps/api con Fastify 4.28.1 + plugin chain canonical (helmet, cors, cookie, jwt,
    rate-limit, requestId, auth, csrf, tenantContext, errorHandler)
  - JWT RS256 keys in .secrets/jwt_{private,public}.pem (gitignored)
  - COOKIE_SECRET 48-byte base64 in .env (gitignored)
  - RBAC cache: 8 roles + 388 mappings loaded at startup
  - 7 endpoints /v1/auth/* live + 15/15 integration tests verde
  - Test admin seeded: admin@heuresys.com / Admin#PassW0rd! (PLATFORM_ADMIN)

Tunnel SSH e processi background:
  - `ssh -fN -L 5433:localhost:5432 oracle-vm-default` (potrebbe essere chiuso dal logout)
  - `pnpm dev` API server :3001 (anch'esso potrebbe non essere più attivo)
  - Riaprili manualmente se servono per testing operativo

=== DELIVERABLE 5.1.3 (auth module — completato) ===

apps/api/src/modules/auth/  (~1500 LOC TS, 7 file)
  cache-loader.ts     — sys.sys_auth_role_permissions → in-memory cache (388 mappings)
  password.ts         — Argon2id 64MiB/3/4 + PasswordPolicy Zod refiner
  tokens.ts           — 32-byte opaque + sha256Hex + setAuthCookies/clearAuthCookies
  schema.ts           — Zod schemas (Login/Me/PasswordReset/Revoke) + RoleCodeSchema
  mailer.ts           — IMailer + ConsoleMailer (dev) + InMemoryMailer (test)
  repository.ts       — raw SQL su sys.sys_auth_* + withTransaction helper
  service.ts          — createAuthService factory (login/refresh/logout/me/reset/revoke)
  routes.ts           — FastifyPluginAsyncZod, 7 endpoint + rate-limit + CSRF opt-in

db/scripts/seed-test-admin.ts (~230 LOC) — idempotente, PLATFORM_ADMIN platform-scoped
apps/api/test/auth.integration.test.ts (11 test) + helpers (build-test-app, setup)

7 endpoint /v1/auth/* live:
  POST /login                       (200 + 3 cookies + body)
  POST /refresh                     (CSRF + rotation + replay detection → 401)
  POST /logout                      (CSRF + revoke family + clear cookies)
  GET  /me                          (200 + {userId, email, roles, tenantId})
  POST /password-reset/request      (sempre 204, anti-enumeration)
  POST /password-reset/complete     (token bound, 15min TTL, single-use)
  POST /admin/revoke-user/:userId   (requirePermission 'auth:revoke_user')

AUTH §13 acceptance checklist (post-follow-up):
  ✅ Login 200 + cookies + body
  ✅ Login wrong creds → 401 LOGIN_INVALID (anti-enumeration)
  ✅ Refresh rotation → new tokens differ
  ✅ Refresh replay → 401 REFRESH_REPLAY_DETECTED + family revoked (verificato DB)
  ✅ Logout 204 + cookies cleared + family revoked
  ✅ /me con cookie → 200; senza → 401 (tenantId NULL per PLATFORM_ADMIN)
  ✅ CSRF block 403 su state-changing senza X-CSRF-Token
  ✅ Password reset request → 204 + mailer.sent populated
  ✅ Argon2id 64MiB/3/4 + needsRehash auto-rotation on login
  ✅ Rate limit live: 11/login attempts → 11° è 429 (followup #2)
  ✅ Pino redaction live: LOG_REDACT_PATHS sentinel never leaks, [REDACTED]
      appears su tutti i path documentati (followup #3)
  ⏭️  Tenant isolation (cross-tenant 404): non testabile finché non c'è il modulo positions

Deviazioni dal piano (risolte da errata):
  - Login + Refresh ritornano 200 con body (HTTP proibisce body su 204, Fastify
    lo strip). AUTH_SECURITY_PLAN.md §13 aggiornato (commit 7450f77).
  - Refresh cookie path = /v1/auth (commento esempio §4.3 corretto in 7450f77).

Followup MVP-1 5.1.3 chiusi:
  ✅ #1 — TENANT_ADMIN own-tenant target check su admin-revoke + 2 nuovi test
  ✅ #2 — Live rate-limit test (11 → 429) in suite vitest
  ✅ #3 — Live pino redaction test (5 log lines, ≥10 [REDACTED] matches)
  ✅ #4 — AUTH_SECURITY_PLAN.md errata (cookie path + login status)

Open items residui:
  - Cleanup di sys_auth_login_events accumulati dai test (volume basso, opzionale)
  - Pgcrypto-based DB-side hash check su refresh tokens (oggi calcolato in TS,
    accettabile per MVP)

=== CONFIGURAZIONE / VINCOLI INVARIANTI ===

  - Stack: Fastify 4 + Drizzle ORM + raw SQL migrations (ADR-0002, ADR-0003)
  - DB: PostgreSQL 16 NATIVO su OCI VM (ADR-0010 = Option B chiuso da RD-25)
  - DB name: `heuresys_advanced`, role `heuresys`
  - Schema canonical: `sys.sys_<plural>`. Aux: `staging`, `brownfield`, `audit`
  - Tenant isolation: FK + API middleware filter. **MAI RLS**
  - Position-centric (I1), Position owner ≠ Incumbent (I2)
  - Auth separato in 11 tabelle `sys.sys_auth_*`, Argon2id 64 MiB / 3 / 4
  - JWT RS256 15min + refresh 30d single-use rotation, HttpOnly + SameSite=Lax + CSRF
  - Categorical fields: `varchar(N) + CHECK` (RD-08, **mai PostgreSQL ENUM**)
  - `date` per date-only columns; `timestamptz` solo dove serve precision tempo
  - ESS in scope come MVP-2b (ADR-0011)
  - Brownfield: dati demo (no PII reale), no anonymization, solo `user_is_synthetic=true`

=== AUTONOMIA AUTORIZZATA (cross-session) ===

L'utente ha autorizzato autonomia piena sul progetto:
  - Installazioni su PC Windows (winget/choco/pnpm install)
  - Installazioni sulla VM via SSH (apt install, npm -g)
  - Esecuzione script (migrate, validate, seed, dev start)
  - Commit Git su branch locali — SENZA chiedere conferma per ogni commit

CONFERMA SOLO PER (operazioni distruttive/irreversibili):
  - `git push` (mai senza richiesta esplicita)
  - `--no-verify`, `--force`, `--force-with-lease`
  - DROP DATABASE `heuresys_platform` (legacy brownfield)
  - rm -rf su path non-temp, git reset --hard
  - Modifiche `pg_hba.conf`/`postgresql.conf` su VM, SSH config, OCI security list

Riferisci a checkpoint significativi (fine step MVP, errori bloccanti, decisioni nuove).
Log proattivo per operazioni lunghe (>30s) per visibilità.

=== RISORSE ESTERNE DISPONIBILI ===

L'utente ha dato accesso completo (inclusi env files, API keys, credenziali siti/CLI/DBMS)
al codebase legacy heuresys-evo (sorgente brownfield):
  - Windows PC:  D:\evo.heuresys.com\         (codebase completo + 9 .env files)
  - OCI VM:      /home/ubuntu/heuresys-evo    (anche con runtime PostgreSQL brownfield)

Vincoli: NON stampare valori segreti nel context/chat, solo uso operativo.
NON committare path assoluti hardcoded a heuresys-advanced.

=== PROSSIMO STEP CONCRETO: MVP-1 5.1.5 — FIRST BUSINESS MODULE ===

Stato post-5.1.4: pipeline auth + RBAC + tenant isolation + shared schemas è
solida. Il prossimo step è il primo business CRUD module per validare l'
intera architettura (route → service → repository → DB) su un dominio reale.

Opzione A — `tenants` module (RACCOMANDATA — minimo accoppiamento):
  GET    /v1/tenants                   — PLATFORM_ADMIN cross-tenant
  GET    /v1/tenants/:id               — TENANT_ADMIN own + PLATFORM_ADMIN
  POST   /v1/tenants                   — PLATFORM_ADMIN
  PATCH  /v1/tenants/:id               — TENANT_ADMIN own + PLATFORM_ADMIN
  DELETE /v1/tenants/:id               — PLATFORM_ADMIN
  Deliverable: ~600 LOC (schemas in @heuresys/shared/schemas/tenants +
  routes/service/repository in apps/api/src/modules/tenants). Esercita
  fine il middleware tenantContext + scope filter cross-tenant.
  Riferimento canonical: docs/api/API_IMPLEMENTATION_PLAN.md §6.2.

Opzione B — `users` module (più complesso, tocca FK + role grants):
  CRUD su sys.sys_users + management di sys.sys_user_auth_roles (assegnare/
  revocare ruoli). Scope filters per MANAGER/USER. ~1000 LOC.

Opzione C — `positions` module (esempio full nel piano):
  CRUD su sys.sys_positions + sub-resources (skills, kpis). Il modulo "core"
  HRMS. ~1400 LOC con sub-resources.

Raccomandazione: andare con A (tenants), 5.1.5. Dopo si può procedere con
users (5.1.6) e positions (5.1.7) in modo additivo.

Tempo stimato (opzione A): ~45-60 min.

=== REGOLE DI LAVORO (sintesi cross-CLAUDE.md) ===

  - Rispondi sempre in italiano. Terminologia tecnica e codice in inglese.
  - Mostra piano prima di operazioni su file (regola 4 CLAUDE.md, mitigato da autonomia).
  - Mostra diff prima di modifiche grandi (>~30 righe per file).
  - Mai cancellare file senza menzionarlo nella sintesi del turno.
  - Windows: PowerShell 5.1 con path assoluti; cmd.exe non in PATH.
  - Mai push remoto senza richiesta esplicita.
  - Le sub-directory gitignored (docs/source_bundle/brownfield/extracted/,
    docs/brownfield/_inspection_artifacts/, .secrets/) non vanno toccate.

=== APRI LA SESSIONE COSI' ===

  1. Leggi START_HERE.md + i 7 doc canonici di priming + apps/api/src/ (incluso modules/auth/).
  2. Leggi MEMORY.md cross-session (feedback_full_autonomy + brownfield_legacy_source_paths).
  3. Verifica `git log --oneline -n 10` e `git status --short`.
  4. Verifica che il tunnel SSH sia aperto (se no, aprilo:
       `ssh -fN -L 5433:localhost:5432 oracle-vm-default`)
     e che psql risponda:
       `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"`.
  5. (Opzionale) Riavvia API dev server: `cd apps/api && pnpm dev` — verifica
     "RBAC permission cache loaded rolesLoaded:8 mappingsLoaded:388".
  6. (Opzionale) Test admin login smoke:
       Invoke-RestMethod -Uri http://localhost:3001/v1/auth/login -Method POST \
         -ContentType "application/json" \
         -Body '{"email":"admin@heuresys.com","password":"Admin#PassW0rd!"}'
  7. Conferma di aver capito lo stato e di essere pronto per MVP-1 step 5.1.4
     (o quale altro step l'utente sceglie).
  8. Inizia con il piano dettagliato + chiedi conferma per partire.

Vai.
