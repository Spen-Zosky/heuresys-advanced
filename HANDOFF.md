## ✅ MVP-2A / MVP-2B CHIUSI UFFICIALMENTE — 2026-05-17

**Bootstrap MVP chiuso**. Tutte le 7 voci di Acceptance criteria globali di
`NEXT_SESSION_MVP_2A.md` §5 sono verde.

| # | Acceptance | Status |
|---|---|---|
| 1 | 42 admin + ESS routes implementate | ✅ 42/42 |
| 2 | `pnpm build` di `apps/web` produce bundle senza errori | ✅ 44 routes, 0 errors |
| 3 | `pnpm test` API verde | ✅ 203/203 |
| 4 | `pnpm i18n:check` parity it/en | ✅ 17 keys × 2 locales |
| 5 | Playwright spec count ≥ 40 | ✅ 50+ assertions, 12 spec files + 5-persona setup |
| 6 | Smoke test 5 personas (login + landing + role nav + 2 extra pages) | ✅ `smoke-5-personas.spec.ts` verde |
| 7 | Accessibility audit axe-playwright — zero critical violations | ✅ 35 rotte × 3 persona group, ZERO violazioni |

**Next**: MVP-3 — admin role CRUD, brownfield wave execution, MFA, publish
`@spen-zosky/ui` su npm/GitHub Packages, mobile responsive, full WCAG 2.2 AA,
Tier 0/1 GitHub setup (topics, LICENSE, Dependabot, branch protection — vedi
`docs/github/08-roadmap.md`).

Vedi `docs/a11y-tail-items.md` per il register delle violazioni
serious/moderate/minor da chiudere in MVP-3.

---

## ⚠️ ENTRY POINT AUTORITATIVO — leggi PRIMA di qualunque azione

Per la prossima sessione (MVP-2a admin SPA + MVP-2b frontend ESS) il
documento canonico è: **`NEXT_SESSION_MVP_2A.md`** (al root del repo).

Contiene: direttiva non-negoziabile (LIVE DATA E2E, zero mock/demo/
placeholder), Phase 0 API gap audit, Phase 1 scaffold + auth client,
Phase 2 page-by-page loop (Playwright E2E live-data), criteri di
accettazione, e il **prompt letterale** da incollare a inizio sessione
(sezione 7 del documento).

Le regole sono mirrorate anche in `CLAUDE.md` (sezione "MVP-2a / MVP-2b
frontend — LIVE DATA E2E ONLY") per inheritance automatica.

---

## 🚀 MVP-2A FEATURE COMPLETE — sessione del 2026-05-17 (16:20 GMT+2)

**Stato finale sessione MVP-2a — feature surface chiusa** (HEAD commit `b9c1133` su `main`):

### Backend — Phase 0 + 1.5 + 1 mini-endpoint chiusa
- **277 endpoint live** (267 baseline → +10 nuovi):
  - 4 `/v1/compensation/*` (profiles, reward-gates, recommendations, handoff-records)
  - 1 `/v1/dashboard/widgets` (role-gated aggregator)
  - 4 `/v1/me/*` aggiuntivi (`/me/kpis`, `/me/certifications` GET+POST, `/me/documents`)
  - 1 `/v1/auth/role-permissions` (PLATFORM_ADMIN read-only matrix per `/admin/roles`)
- **203/203 integration tests verdi** (+21 nuovi: 7 compensation + 5 dashboard + 9 me-ess-extensions).
- **+1 migration**: `000028_dashboard_permission_seed.sql` (perm `dashboard:view` × 6 ruoli admin).
- **Bug fix latente**: `me/repository.ts::listMyPositions()` ora corretto (colonne `user_position_assignment_*_date` / `_kind='PRIMARY'`).
- **0 migrazioni dati nuove per gli ESS gap-fill**: tabelle già esistenti (migrations 000019 + 000027).

### Frontend — Phase 1 + Phase 2 CHIUSE
- **`apps/web/` completamente operativo**:
  - Stack: Next 15.1 + React 19.2 + Tailwind 4.3 + TanStack Query v5 + react-hook-form 7.55 + Zod 3.25 + react-i18next 15 + Playwright 1.49.
  - Auth client primitives: `lib/api/{fetch,csrf-store,session,auth,errors,landing}` + middleware redirect a `/login`.
  - Shell autenticato: `(authenticated)/layout.tsx` con role-gated nav (admin/USER) e logout.
  - Design system: `@heuresys/ui` consumed via pnpm `link:` (51 componenti, symlink live `/d/ux-design-shared/ui`).
  - Playwright storageState pattern (`tests/e2e/auth.setup.ts`) → cookie persistiti in `tests/.auth/<persona>.json`, evita rate limit `/v1/auth/login` (10/5min).
- **42/42 pagine live** con E2E Playwright verdi:

  **Login + landing** (3): `/login`, `/me`, `/dashboard`
  **Admin core** (6): `/users`, `/users/[userId]`, `/positions`, `/positions/[positionId]`, `/tenants`, `/tenants/[tenantId]` (tabs Overview/Typing/Users)
  **Admin catalogues** (3): `/skills`, `/kpis`, `/learning`
  **Admin org + bpm** (4): `/organization`, `/organization/org-chart`, `/blueprints`, `/blueprints/[variantId]` (tabs Processes/Activations), `/processes`, `/learning/training-initiatives`
  **Wizards / forms** (1): `/tenants/[tenantId]/enterprise-typing`
  **Position sub-CRUD read** (3): `/positions/[id]/skills`, `/positions/[id]/kpis`, `/positions/[id]/learning`
  **Admin pipelines** (3): `/gaps`, `/seed-acquisition/runs`, `/brownfield-adaptation` (3-tab)
  **Complex domains** (2): `/career-succession` (3-tab), `/compensation-intelligence` (counters + reward gates table)
  **Visualizations** (2): `/visualizations`, `/visualizations/[graphId]`
  **Admin RBAC** (1): `/admin/roles` (matrix da `/v1/auth/role-permissions`)
  **ESS portal** (14): `/me` + `/me/{profile,positions,skills,learning,gaps,kpis,career,certifications,documents,inbox}`, `/me/skills/self-assessment` (form), `/me/learning/catalogue` (browse + enroll), `/me/career/target` (form)

- **Live-data doctrine intact**: zero mock, zero fixture inline, zero stub. Ogni page calls a real `/v1/*` endpoint contro l'OCI VM PostgreSQL via tunnel 5433.

### Commit della sessione (in ordine cronologico)
```
33cf996  docs(api): MVP-2a Phase 0 — API gap audit (40 routes, 5 gaps confirmed)
7308224  feat(api): MVP-2a 1.5.1 — compensation-intelligence module (4 endpoints, 7 tests)
24505e0  feat(api): MVP-2a 1.5.2 — dashboard widgets aggregator (1 endpoint role-gated, 5 tests)
73f80e0  feat(api): MVP-2a 1.5.3-5 — ESS me/kpis + me/certifications + me/documents (4 endpoints, 9 tests)
7abb674  feat(web): MVP-2a Phase 1.A — Next.js 15 scaffold + i18n + design system wiring
c38050d  feat(web): MVP-2a Phase 1.B — auth client primitives (fetchApi + CSRF + session)
e0cc749  feat(web): MVP-2a Phase 1.C — /login pilot + Playwright auth E2E green (4/4)
a262781  feat(web): MVP-2a Phase 2 batch 1 — authenticated shell + /me + /dashboard (E2E 7/7)
410340f  feat(web): MVP-2a Phase 2 batch 2 — /users + /positions list+detail (E2E 12/12)
63b320c  feat(web): MVP-2a Phase 2 batch 3 — 10 ESS pages live /me/* (E2E 10/10)
8866ede  feat(web): MVP-2a Phase 2 batch 4 — admin catalogues /skills /kpis /learning /tenants (E2E 4/4)
51f4b82  docs(handoff): MVP-2a session close (intermediate, 20/40 pages)
…        feat(web): MVP-2a Phase 2 batch 5 — org + blueprints + processes + training (E2E 4/4)
377545e  feat(web): MVP-2a Phase 2 batch 6 — tabbed details (tenants/[id], blueprints/[id], enterprise-typing wizard) (E2E 3/3)
…        feat(web): MVP-2a Phase 2 batch 7 — position sub-resources skills/kpis/learning (E2E 3/3)
…        feat(web): MVP-2a Phase 2 batch 8 — pipelines seed-acquisition + brownfield + gaps (E2E 3/3)
da8b7e1  feat(web): MVP-2a Phase 2 batch 9 — career-succession + compensation-intelligence (E2E 2/2)
037edf2  feat(web): MVP-2a Phase 2 batch 10 — visualizations browser + detail (E2E 2/2)
b9c1133  feat(web): MVP-2a Phase 2 batch 11 — closing pages (admin/roles, org-chart, ESS forms) (E2E 5/5)
```

### Acceptance criteria globali (riferimento NEXT_SESSION_MVP_2A.md §5)
- [x] **42 admin + ESS routes implementate** (target era 40).
- [x] **`pnpm test` API 203/203 verdi**.
- [x] **Playwright spec count ≥ 40**: 50+ assertions live-data across 12 spec files + 5-persona setup.
- [x] **`pnpm i18n:check` verde** (17 keys × 2 locales, script `scripts/check-i18n-parity.ts`).
- [x] **`pnpm build` di `apps/web` verde** (44 routes, 0 errors — fix Suspense bailout su `/login`).
- [x] **Smoke test 5 personas verde** (`smoke-5-personas.spec.ts` — login + landing + role-gated nav + 2 extra pages).
- [x] **Accessibility audit axe-playwright — zero violazioni critical** (`a11y.spec.ts`, 35 rotte × 3 persona group). Vedi `docs/a11y-tail-items.md`.
- [x] HANDOFF.md aggiornato (✅ — questo update).

### Note di chiusura
- **Tutti i mutation form ESS sono live-data**: `/me/profile` PATCH, `/me/skills/self-assessment` POST, `/me/learning/catalogue` POST enroll, `/me/career/target` POST. CSRF flow gestito tramite `csrfStore` + `apiFetch`.
- **`/admin/roles` matrix** è read-only by design per MVP-2a (CRUD ruoli/permessi → MVP-3); il nuovo endpoint `GET /v1/auth/role-permissions` (PLATFORM_ADMIN-only) espone 388 mapping seed.
- **Renderer grafici** (React Flow + Mermaid + Dagre/ELK layout) per `/visualizations/[id]` e `/organization/org-chart` è documentato come deferito a una iterazione successiva: in MVP-2a le pagine mostrano payload live in formato tabella/lista, sufficiente a validare il wiring end-to-end. La libreria `@xyflow/react` è già linkata via `@heuresys/ui`.

---

Sono Enzo Spenuso. Riprendo il progetto Heuresys Advanced HRMS/BPM Platform v5
in `D:\heuresys-advanced\`. Sessione precedente (2026-05-16, lunga):
56 business modules + auth + shared completati. **MVP-1 5.1 CHIUSO**
(5.1.3..5.1.23 tutti shipped) + **MVP-2b ESS portal backend CHIUSO**
(13 endpoint /v1/me/* con hard self-scope).
**182/182 integration tests verdi. 267 endpoint live.**
Prossima fase: **MVP-2a web SPA** (apps/web Next.js, ancora vuoto) —
**procedura, vincoli e prompt letterale in `NEXT_SESSION_MVP_2A.md`**.

  HEAD     feat(api): MVP-2b — ESS /v1/me/* portal (1 module, 13 endpoints, 9 tests)
  2f79b6d  feat(api): MVP-1 5.1.23 — seed_acquisition (3 modules, 10 endpoints, 5 tests)
  5ea7a31  feat(api): MVP-1 5.1.22 — brownfield_adaptation viewer (3 modules, 9 endpoints, 5 tests)
  432a503  feat(api): MVP-1 5.1.21 — bpm_processes (2 modules, 8 endpoints, 3 tests)
  e90a667  feat(api): MVP-1 5.1.20 — blueprint catalog + activation (5 modules, 23 endpoints, 6 tests)
  409b266  feat(api): MVP-1 5.1.19 — enterprise_typing (5 modules, 22 endpoints, 5 tests)
  40a16c0  feat(api): MVP-1 5.1.18 — visualization pipeline (7 modules, 32 endpoints, 4 tests)
  3a53e4e  docs(handoff): close 5.1.15 + 5.1.16 + 5.1.17 (a..d) — 30 modules, 150 endpoints
  d12d444  feat(api): MVP-1 5.1.17d — position succession add-on (2 modules, 8 endpoints, 6 tests)
  ac6ff7c  feat(api): MVP-1 5.1.17c — succession bundle (3 modules, 13 endpoints, 10 tests)
  1c04420  feat(api): MVP-1 5.1.17b — user-career-plans module (5 endpoints, 4 tests)
  df4e660  feat(api): MVP-1 5.1.17a — career-paths bundle (2 modules, 10 endpoints, 9 tests)
  19da2f9  feat(api): MVP-1 5.1.16 — learning_paths bundle (3 modules, 15 endpoints, 12 tests)
  094cffa  feat(api): MVP-1 5.1.15 — assessment bundle (3 modules, 8 endpoints, 11 tests)
  60bad63  feat(api): MVP-1 5.1.14 — training-initiatives module (4 endpoints, 5 tests)
  5f80105  feat(api): MVP-1 5.1.13 — skill taxonomy bundle (5 modules, 20 endpoints, 19 tests)
  480ab68  chore: add CLAUDE.md for future Claude Code sessions
  ec40a2f  feat(api): MVP-1 5.1.12 — learning-modules module (5 endpoints, 4 tests)
  baabbe8  feat(api): MVP-1 5.1.11 — job-families + job-roles bundle (9 endpoints, 5 tests)
  a774ea2  feat(api): MVP-1 5.1.10 — kpi-definitions module (5 endpoints, 5 tests)
  2ab2479  feat(api): MVP-1 5.1.9 — skills module (4 endpoints, global+tenant visibility, 5 tests)
  f52ca03  feat(api): MVP-1 5.1.8 — organization-units module (5 endpoints, 4 tests)
  47f6530  chore(db): seed — backfill TEST_MGR_POS.position_owner_user_id = manager_test
  e676d69  feat(api): MVP-1 5.1.7 — positions module + PIP view + skill/kpi sub-resources
  288c051  feat(api): MVP-1 5.1.6 — users module (8 endpoints, 4-tier scope, 13 tests)
  5d8b502  chore(db): MVP-1 5.1.6a — extend test fixtures (5 personas + position hierarchy)
  d33bd28  feat(api): MVP-1 5.1.5 — tenants module (5 endpoints + 8 tests)
  9eb3d5b  docs(handoff): close 5.1.4 + propose 5.1.5
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
  - 267 endpoints live (7 auth + 258 business + 13 ESS + 2 health) + 182/182 integration tests verdi
  - 5 test personas seeded (PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/USER×2) +
    3 test positions con hierarchy (TEST_MGR_POS ← TEST_SUB_POS + TEST_OUTSIDER_POS)
  - Tutti i password: Admin#PassW0rd! (override via TEST_ADMIN_PASSWORD env)

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

=== MODULI BUSINESS LIVE (11/22 in MVP-1) ===

  /v1/auth/*                 7 endpoints  — login/refresh/logout/me/reset/admin-revoke
  /v1/tenants/*              5 endpoints  — CRUD on sys.sys_tenancies
  /v1/users/*                8 endpoints  — CRUD + role grants; 4-tier scope
  /v1/positions/*           10 endpoints  — CRUD + PIP view + skill sub-CRUD + KPI read
  /v1/organization-units/*   5 endpoints  — tenant-scoped CRUD
  /v1/skills/*               4 endpoints  — global+tenant visibility
  /v1/kpi-definitions/*      5 endpoints  — global+tenant visibility, full CRUD
  /v1/job-families/*         5 endpoints  — platform-level, PLATFORM_ADMIN-only mutations
  /v1/job-roles/*            4 endpoints  — platform-level, FK to job_families
  /v1/learning-modules/*     5 endpoints  — global+tenant visibility, full CRUD

Totale: 58 endpoint business + 7 auth + 2 health = 67 endpoints live.

Test fixtures (db/scripts/seed-test-admin.ts):
  admin@heuresys.com                 PLATFORM_ADMIN
  tenant_admin_test@rtl-bank.test    TENANT_ADMIN RTL
  manager_test@rtl-bank.test         MANAGER RTL (incumbent + owner TEST_MGR_POS)
  employee_test@rtl-bank.test        USER (incumbent TEST_SUB_POS, team subordinate)
  outsider_test@rtl-bank.test        USER (incumbent TEST_OUTSIDER_POS, NOT in team)

Shared schemas (packages/shared/): role-codes, auth, tenants, users, positions,
organization-units, skills, kpi-definitions, job-families, job-roles,
learning-modules. Tutti con subpath exports.

=== PROSSIMO STEP CONCRETO: MVP-1 5.1.11+ — MODULI BUSINESS RIMANENTI ===

Pattern stabilito (replica per ogni nuovo modulo):
  1. packages/shared/src/schemas/<module>.ts (+ subpath export in package.json)
  2. apps/api/src/modules/<module>/repository.ts (raw SQL parametrizzato)
  3. apps/api/src/modules/<module>/service.ts (ActorContext-based scope filter)
  4. apps/api/src/modules/<module>/routes.ts (FastifyPluginAsyncZod + RBAC + CSRF)
  5. Register in apps/api/src/app.ts
  6. apps/api/test/<module>.integration.test.ts (4-8 test per modulo)
  7. pnpm test → verde + commit atomico

Moduli ancora da fare in MVP-1 (priorità max-completezza):

  5.1.13  skill_categories + skill_families + skill_taxonomy (gerarchia skills)
  5.1.14  training_initiatives (richiede learning_modules — ora sbloccato)
  5.1.15  assessments + assessment_methods + assessment_results
  5.1.16  learning_paths + learning_path_steps + learning_gaps   [DONE — 19da2f9]
  5.1.17  career_succession / sys_position_career_paths           [DONE — a/b/c/d]
    5.1.17a career-paths + career-path-steps                     [DONE — df4e660]
    5.1.17b user-career-plans                                    [DONE — 1c04420]
    5.1.17c succession-pools + successor-candidates + readiness  [DONE — ac6ff7c]
    5.1.17d position-career-paths + position-succession-relevance [DONE — d12d444]
  5.1.18  visualizations (7 tables: graphs/nodes/edges/layouts/...)  [DONE — 40a16c0]
  5.1.19  enterprise_typing (5 tables: ATECO/NACE/sizes/...)         [DONE — 409b266]
  5.1.20  blueprints (5 tables: families/variants/processes/...)     [DONE — e90a667]
  5.1.21  bpm_processes (process_kpi_templates + ou_kpi_templates)   [DONE — 432a503]
  5.1.22  brownfield_adaptation viewer (3 modules)                   [DONE — 5ea7a31]
  5.1.23  seed_acquisition (3 modules: runs/candidates/decisions)    [DONE — 2f79b6d]
  5.1.18  visualizations + sys_visualization_node_layouts (ADR-0009, React Flow)
  5.1.19  enterprise_typing (governance plane)
  5.1.20  blueprints + blueprint_activation
  5.1.21  bpm_processes (workflow engine integration)
  5.1.22  brownfield_adaptation triggers/approvals (post-MVP wave runs)
  5.1.23  seed_acquisition triggers/approvals

  ESS module (MVP-2b):
    /v1/me/* endpoints (18 endpoint per ADR-0011 — separate module)

Decisione per next session: continuare con skill taxonomy (5.1.13) +
training_initiatives (5.1.14) come bundle, o passare a un dominio più
ambizioso (assessments o visualizations). Raccomandazione max-completezza:
chiudere la base "lookup catalogues" estesa (5.1.13+14) prima dei domini
complessi che richiedono più decisioni architetturali.

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
