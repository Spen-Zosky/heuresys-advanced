Sono Enzo Spenuso. Riprendo il progetto Heuresys Advanced HRMS/BPM Platform v5
in `D:\heuresys-advanced\`. La sessione precedente ha chiuso MVP-0 al 100%
e ha avviato MVP-1 con step 5.1.1. Branch `main`, 13 commit, working tree clean.

  3fc8bda  feat(api): MVP-1 step 5.1.1 — Fastify server + middleware + /healthz
  fc22fef  chore(bootstrap): MVP-0 step 5.0.7 — RTL_BANK_REFERENCE seed (Faker 42)
  5e89734  chore(bootstrap): MVP-0 step 5.0.3 group 5 + fixes
  8590b16  chore(bootstrap): MVP-0 step 5.0.3 group 4
  e8bc34d  chore(bootstrap): MVP-0 step 5.0.3 group 3
  949e92b  chore(bootstrap): MVP-0 step 5.0.3 group 2
  495a51a  chore(bootstrap): MVP-0 step 5.0.3 group 1
  9e73f6b  chore(bootstrap): MVP-0 step 5.0.2 — db scripts
  ded44ec  chore(bootstrap): MVP-0 step 5.0.1 — workspace scaffold
  5dd64ea  chore(bootstrap): close ADR-0010 (B — OCI VM tunnel 5433, RD-25)
  3863130  docs(start): add START_HERE.md
  59b898c  chore(bootstrap): formal approval — Section 19 unlocked (RD-24)
  c928034  chore(bootstrap): Section 18 planning phase complete

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
  8. apps/api/src/                                  (server.ts + app.ts + middleware/)

Poi leggi la mia memory persistente (cross-session):
  `C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\memory\MEMORY.md`
  - feedback_full_autonomy        (autonomia piena su install/commit, no push, no destructive)
  - brownfield_legacy_source_paths (D:\evo.heuresys.com + /home/ubuntu/heuresys-evo)

=== STATO LIVE (verificato a fine sessione precedente) ===

Database (su OCI VM `oracle-vm-default`, cluster PG 16.13, porta 5432):
  - DB `heuresys_advanced` (target) side-by-side con `heuresys_platform` (711 legacy tables)
  - 118 sys tables + 11 views + 6 brownfield aux + 4 audit aux
  - 8 roles + 98 permissions + 388 role×perm mappings seeded
  - RTL_BANK_REFERENCE tenant + 5 branches + 158 positions + 158 synthetic users +
    158 PRIMARY ACTIVE assignments (Faker seed=42, deterministic)
  - 27/27 migrations applicate, idempotency proven (pg_dump diff vuoto)
  - 7/7 structural validation views PASS

API runtime:
  - apps/api con Fastify 4.28.1 + plugin chain canonical (helmet, cors, cookie, jwt,
    rate-limit, requestId, auth, csrf, tenantContext, errorHandler)
  - JWT RS256 keys generate in .secrets/jwt_{private,public}.pem (gitignored)
  - COOKIE_SECRET 48-byte base64 random in .env (gitignored)
  - End-to-end testato: GET /healthz → 200 {status:ok}
                         GET /readyz  → 200 {status:ready, checks:{database:ok}}
                         x-request-id propagato, helmet headers attivi
  - Acceptance A16 PASS

Tunnel SSH e processi background:
  - `ssh -L 5433:localhost:5432 oracle-vm-default` (potrebbe essere già chiuso dal logout)
  - `tsx watch src/server.ts` (porta 3001, anch'esso potrebbe non essere più attivo)
  - Riaprili manualmente se servono per testing operativo

=== CONFIGURAZIONE / VINCOLI INVARIANTI ===

  - Stack: Fastify 4 + Drizzle ORM + raw SQL migrations (ADR-0002, ADR-0003)
  - DB: PostgreSQL 16 NATIVO su OCI VM (ADR-0010 = Option B chiuso da RD-25)
  - DB name: `heuresys_advanced`, role `heuresys` (password recuperata da legacy evo)
  - Schema canonical: `sys.sys_<plural>`. Aux: `staging`, `brownfield`, `audit`
  - Tenant isolation: FK + API middleware filter. **MAI RLS**
  - Position-centric (I1), Position owner ≠ Incumbent (I2)
  - Auth separato in 11 tabelle `sys.sys_auth_*`, Argon2id 64 MiB / 3 / 4
  - JWT RS256 15min + refresh 30d single-use rotation, HttpOnly + SameSite=Lax + CSRF
  - Categorical fields: `varchar(N) + CHECK` (RD-08, **mai PostgreSQL ENUM**)
  - `date` per date-only columns; `timestamptz` solo dove serve precision tempo
  - ESS in scope come MVP-2b (ADR-0011): 13 pages /me/* + 18 endpoint /v1/me/* +
    19 self-scope perms + `requireSelfScope()` + ESLint rule + audit.user_self_service_actions
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

Quando usare:
  - Recovery credenziali DB / API keys / siti / CLI tools
  - MVP-2 frontend: UI components/librerie/assets riusabili (deciso a inizio MVP-2)
  - Brownfield wave runs (post-MVP)

Vincoli: NON stampare valori segreti nel context/chat, solo uso operativo.
NON committare path assoluti hardcoded a heuresys-advanced.

=== PROSSIMO STEP CONCRETO: MVP-1 5.1.3 — AUTH MODULE ===

Riferimento canonical: docs/security/AUTH_SECURITY_PLAN.md tutto il documento, in particolare
§3 (Argon2id), §4 (JWT+refresh), §5 (CSRF), §9 (password reset), §13 (acceptance checklist).
E docs/api/API_IMPLEMENTATION_PLAN.md §6.1 (endpoint roster auth).

Deliverable:
  apps/api/src/modules/auth/
    routes.ts        — POST /v1/auth/login, /refresh, /logout, GET /me,
                       POST /password-reset/{request,complete},
                       POST /admin/revoke-user/:userId
    service.ts       — verify password (Argon2id + needsRehash on login),
                       issue access JWT + refresh opaque, rotation chain,
                       replay detection, login event logging
    repository.ts    — tenantId-first signatures, queries against sys_auth_*
    schema.ts        — Zod request/response schemas (export to packages/shared
                       in step 5.1.4)
    cache-loader.ts  — load sys.sys_auth_role_permissions → in-memory cache
                       via setRolePermissionCache() at server start
                       (così rbac.requirePermission() non più "not loaded")

Acceptance:
  - POST /v1/auth/login accetta {email,password}, ritorna 204 + set 3 cookies +
    body {user, roles, csrfToken}
  - POST /v1/auth/refresh rota tokens; replay → REFRESH_REPLAY_DETECTED + family revoke
  - POST /v1/auth/logout revoca family + clears cookies
  - GET /v1/auth/me ritorna {userId, email, roles, tenantId} (no hash leaked)
  - CSRF middleware blocca state-changing senza X-CSRF-Token header
  - Password reset flow opaque-token, 15min TTL, single use
  - Pino redaction test: log con body.password → [REDACTED]
  - Rate limit: 11 login in 5min → 429
  - Acceptance test A18 (`/auth/me` works) — PASS dopo aver creato un user di test
    (con Argon2id hash) tramite seed o script ad-hoc

Note operativi:
  - L'API può girare già senza /v1/auth/* (5.1.1 OK)
  - Per testare: prima creo 1 user "admin" di prova con Argon2id hash via SQL diretto,
    poi POST /v1/auth/login e verifico cookie flow
  - Il RBAC cache deve essere POPOLATO all'avvio del server (cache-loader chiamato
    da app.ts dopo register di tutti i plugin, prima del listen)

Tempo stimato: 600-900 righe TS in apps/api/src/modules/auth/ + integration test
supertest. ~1 sessione focused.

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

  1. Leggi START_HERE.md + i 7 doc canonici di priming + apps/api/src/.
  2. Leggi MEMORY.md cross-session (feedback_full_autonomy + brownfield_legacy_source_paths).
  3. Verifica `git log --oneline -n 5` e `git status --short`.
  4. Verifica che il tunnel SSH sia aperto (se no, aprilo: `ssh -L 5433:localhost:5432 oracle-vm-default`)
     e che psql risponda: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"`.
  5. Conferma di aver capito lo stato e di essere pronto per MVP-1 step 5.1.3.
  6. Inizia con il piano dettagliato dell'auth module + chiedi conferma per partire.

Vai.
