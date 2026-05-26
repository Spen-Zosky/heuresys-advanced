# HANDOVER A CLI — Stato forense Heuresys Advanced (post S937)

**Documento**: passaggio consegne completo Cowork → Claude Code CLI.
**Scope**: mettere CLI in condizione di operare su `heuresys-advanced` senza errori di valutazione, senza supposizioni, senza re-discovery da zero.
**Data**: 2026-05-26 (chiusura sessione Cowork S937).
**HEAD origin/main al passaggio**: `14eb0dc` (S937 session report shipped).
**Ultimo tag pushato**: `v0.4.0a-s937-partial-checkpoint`.
**Predecessor tag stabile**: `v0.4.0-mvp4-ready` (post S935 Z chiusura).
**Source**: lettura forense di CLAUDE.md (project + global SoT), HANDOFF.md, STATE.md, bias_registry.md, MVP_4_ROADMAP.md, ADR_INDEX.md, NEXT_SESSION_MVP_2A/CLOSURE/S937, docs/ci/*, docs/cw-b59-*, qa_artifacts/s936_outcome_summary.md, .env.example, package.json (root + apps/api + apps/web), file system enumeration. Non si è inventato nulla; ogni numero / path / commit hash è verified.

---

## §0 — Bootstrap obbligatorio CLI (eseguire ALLA PRIMA AZIONE)

```bash
# A. Working tree + sync
cd /d/heuresys-advanced
git status -sb
# Expected:
#   ## main...origin/main
#   (eventuali .bak.* untracked accettabili)
git log --oneline -5
# Expected top 5 (post-S937):
#   14eb0dc docs(session): S937 final session report - 4/8 closed + 1/8 partial + 3/8 blocked-by-CK-1 + R23/iii eccezione documented
#   418e9b3 docs(cowork): S937 CK-8 - PROMPT 027 SDBI Phase 2 kickoff (MVP-4 stream 2.4)
#   0c53fdf docs(handoff): S937 partial closure - CK-4 v2 + CK-5 verify + CW-B62 SSH automation gap
#   b55ffe8 fix(scripts): S937 CK-4 - bisect-cw-b59-createctx v2 regex Class-extends + createContext
#   859a92d docs(handoff): S937 housekeeping priming + cross-layer doc refresh
git pull --ff-only origin main

# B. SSH agent (CRITICO — vedi §19)
ssh-add -l
# Se vuoto: SSH passphrase non ancora caricata; CK-1 ancora pending.
# Lanciare MANUALMENTE da una shell Windows aperta a mano:
#   & 'C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1'
# (eccezione R23/iii, vedi §19).

# C. Tunnel SSH 5433 (richiede B done)
ssh -fN -L 5433:localhost:5432 oracle-vm-default
# Verify on Windows:
#   Test-NetConnection localhost -Port 5433
# Or on bash:
#   nc -z localhost 5433 && echo OK

# D. Smoke DB
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT now(), version()"

# E. Workspace install
cd /d/heuresys-advanced
pnpm install --frozen-lockfile

# F. Baseline test API (atteso 69/69 verde — vedi §10)
cd apps/api
pnpm exec vitest run
# Out of 69 integration tests shipped MVP-1 ≤ post-S934, atteso baseline GREEN.
# Test count storico citato:
#   - 69/69 (post commit 64c2a27 MVP-1 closure)
#   - 341 passed / 1 fail pre-esistente skills:131 (post-MVP-3 v0.3.2)
# Variabilità dovuta a chunked test strategy CW-NEW-PF-02 + Vitest 4 migration S933.

# G. (Opzionale, solo se serve UI work) verifica @heuresys/ui
pnpm ls @heuresys/ui
# Expected: @heuresys/ui 0.1.1 risolto da registry (NOT link:.. — vedi §9).
```

**STOP** se: git diverge / SSH agent vuoto / tunnel non listening / vitest baseline rosso. Diagnosi prima di procedere (R10 no-hallucination).

---

## §1 — Identità progetto

`heuresys-advanced` è un **rewrite** di `heuresys-evo` (codebase legacy in `D:\evo.heuresys.com\` su Windows + `/home/ubuntu/heuresys-evo` su OCI VM). Piattaforma HRMS/BPM v5 — **position-centric, non employee-centric** (invariante I1, ADR-0008).

**Dominio funzionale shipped a 2026-05-26**:

- Position Intelligence Profile (PIP) come VIEW/MATERIALIZED VIEW (ADR-0008).
- Skill taxonomy 4-tier (families → categories → skills → aliases) — 6037 skill rows.
- Career succession + position skill requirements + learning gaps.
- KPI catalogue + OPB blueprint model (operating models + processes + variants).
- Brownfield wave 1 import deterministico (13/19 IMPORT pragmatic, 34509 upserted; vedi §5).
- ESS portal `/me/*` 14+ pagine self-scope.
- MFA TOTP completo (Tappa E MVP-3, RFC 6238, 5 integration test + Playwright 2/2).

**Out-of-scope hard** (I8 invariante): payroll execution, T&A, benefits, IAM/SSO esterno, recruiting hiring, onboarding (workflow), medical/health, contracts body.

**Bootstrap originale**: `docs/BOOTSTRAP_EXECUTION_PLAN.md` (priming canonical) + `START_HERE.md` (entry point storico).

---

## §2 — Stato repo (verified 2026-05-26)

| Item | Valore |
|---|---|
| Repo path Windows | `D:\heuresys-advanced` |
| Repo path OCI VM | `/home/ubuntu/heuresys-advanced` |
| Remote | `https://github.com/Spen-Zosky/heuresys-advanced` (public) |
| Branch corrente | `main` |
| HEAD locale = origin/main | `14eb0dc` (S937 session report) |
| Sync | 0/0 ahead/behind |
| Working tree | clean (2 file `*.bak.20260526-*` untracked accettabili: `CLAUDE.md.bak.20260526-172720`, `HANDOFF.md.bak.20260526-174356`) |
| Untracked extras tollerati | `sessioni/session_2026-05-26_s937_housekeeping/TRIGGER_PROMPT.txt` |
| Tag corrente | `v0.4.0a-s937-partial-checkpoint` (annotato, S937 chiusura partial) |
| Tag precedente stabile | `v0.4.0-mvp4-ready` (S935 Z chiusura full) |
| Altri tag origin verified | `v0.3.1-mvp3-final`, `v0.3.2-mvp3-full`, `v0.3.3-preflight-partial`, `v0.3.4-p0-closed`, `v0.4.0-brand-v1`, `v0.2.1-mvp2a-final`, `v0.2.0-mvp2` |
| Pre-commit hook | `.git/hooks/pre-commit` (warn-only mode) — runs `scripts/cowork-exchange/validate-naming.mjs` su cowork_code_exchange |
| Package manager | `pnpm@9.15.0` (pinato via `packageManager` field root package.json) |
| Node engines | `>=20.11.0` |
| OS development primario | Windows 11 x64, host `DESKTOP-KH728P2`, user `enzospenuso`, shell PowerShell 5.1 |
| OS development secondario | macOS 15.7.6 (Sequoia via OpenCore) Intel x86_64, alias SSH `mac-local` 192.168.1.4 |
| OS production / live DB / CI | Ubuntu 24.04 LTS ARM64 (aarch64) su OCI Free Tier eu-milan-1, alias SSH `oracle-vm-default` 80.225.82.207 |

**Commit storici recenti S937**:

```
14eb0dc docs(session): S937 final session report …
418e9b3 docs(cowork): S937 CK-8 - PROMPT 027 SDBI Phase 2 kickoff …
0c53fdf docs(handoff): S937 partial closure …
b55ffe8 fix(scripts): S937 CK-4 - bisect-cw-b59-createctx v2 …
859a92d docs(handoff): S937 housekeeping priming …
9fa3e57 docs(cowork): S936-6 R23 AUTONOMIA OPERATIVA cross-layer
25aa0df docs(qa): S936 follow-up tasks outcome summary
f8776ee feat(qa): S936-1 Path G build test outcome + lockfile
dccd368 docs(handoff): S935 Z closure …
662e14c chore(preflight): S935 D residual cleanup …
0845722 feat(ci): S935 F - 6 workflow YAML self-hosted …
bada257 feat(sec): S935 E base - branch protection + dependabot …
dbd791b docs(cw-b59): S935 C reframed root cause + scripts …
1a2b6cf feat(brownfield): S935 B - ADR-0020 + migration 000044 …
b27eccc fix(brownfield): S934 - CW-B61 silent-skip observability …
```

---

## §3 — Architettura sintetica

```
heuresys-advanced/
├── apps/
│   ├── api/        Fastify 5 + Drizzle pool + Zod + Argon2id + RS256 JWT (58 moduli business + auth, ~272 endpoint live)
│   ├── web/        Next.js 15 App Router + React 19 + Tailwind 4 + @heuresys/ui (admin 29 routes + ESS 14 routes + system-health)
│   └── showcase/   Next.js 15 static export → GitHub Pages (brand identity v1)
├── packages/
│   └── shared/     @heuresys/shared — Zod schemas + TS types con subpath exports
├── db/
│   ├── migrations/ 43 file *.sql idempotenti (000001 .. 000044, gap 000035 cosmetic)
│   ├── seeds/      CSV + INSERT idempotenti (registry brownfield + RTL_BANK_REFERENCE)
│   └── scripts/    twin .ps1 + .sh (create / migrate / reset / validate / seed)
├── docs/           planning + ADR + brownfield + frontend + api + security + ci + github + sdbi (futuro)
├── cowork_code_exchange/  protocollo Cowork↔CLI (PROMPT/PLAN/EXEC/REPORT/REVIEW + .inbox/)
├── cowork_reserved/       KB Cowork (bias_registry, batch archive, handoff fresh session, auto-ship scripts)
├── sessioni/       artefatti per sessione Cowork (session_YYYY-MM-DD_<slug>/)
├── qa_artifacts/   acceptance outputs + diagrams + Mermaid + bisect logs
├── tests/          tests/ top-level deprecated; tests vivono per-app (apps/api/test, apps/web/tests/e2e)
├── scripts/        utility script (bisect, restore-showcase, cowork-exchange/*)
└── .github/        workflows YAML (6 self-hosted oci-vm + 1 showcase ubuntu-hosted)
```

**Workspace pnpm** (`pnpm-workspace.yaml`): `apps/*` + `packages/*`. Subpath exports da `@heuresys/shared` (es. `@heuresys/shared/schemas/users`).

**Sibling repo Heuresys** (sorgente di `@heuresys/ui`):
- Path Windows: `D:\ux-design-shared`
- Remote: `https://github.com/Spen-Zosky/ux-design-shared` (public)
- HEAD storico: `dfa2e81` (post 0.1.1 publish-ready)
- Dist committato (no CI publish): `dist/` con tsup dual output `.mjs` + `.cjs` + `.d.ts` + `.d.cts`

---

## §4 — Stack tecnologico (versioni verified da package.json)

### Root (workspace orchestrator)

| Tool | Version | Note |
|---|---|---|
| pnpm | 9.15.0 (pinato) | packageManager field |
| Node | ≥ 20.11.0 | engines field |
| ESLint | 9.39.4 | flat config 9.x |
| typescript-eslint | 8.59.4 | flat |
| eslint-config-next | 15.5.18 | per apps/web |
| pnpm.overrides | `vite ^6.4.2`, `postcss ^8.5.10`, `esbuild ^0.25.0`, `qs >=6.15.2`, `exceljs>uuid >=11.1.1`, **`react 19.2.5`, `react-dom 19.2.5`, `@types/react 19.2.14`, `@types/react-dom 19.2.3`** (Path G da S935 phase C — pinning React quick-win) |

### apps/api

| Dep | Version |
|---|---|
| fastify | 5.8.5 |
| @fastify/cookie | 11.0.2 |
| @fastify/cors | 11.2.0 |
| @fastify/helmet | 13.0.2 |
| @fastify/jwt | 10.0.0 |
| @fastify/rate-limit | 10.3.0 |
| fastify-type-provider-zod | 4.0.2 |
| zod | 3.25.76 |
| pg | 8.13.1 |
| drizzle-orm | 0.45.2 (pool wrapper only; queries usano raw SQL parametrizzato per moduli business) |
| drizzle-kit | 0.28.1 (dev) |
| argon2 | 0.41.1 |
| otpauth | ^9.5.1 (TOTP RFC 6238) |
| pino | ^9.14.0 (logger) |
| vitest | 4.1.6 (singleThread, vedi §10) |
| vite | 6.4.2 |
| typescript | 5.7.2 |
| tsx | 4.19.2 |
| supertest | 7.0.0 |

### apps/web

| Dep | Version |
|---|---|
| next | 15.5.18 |
| react | 19.2.5 |
| react-dom | 19.2.5 |
| @heuresys/ui | ^0.1.1 (npm-published post X18 — NON link:) |
| @heuresys/shared | workspace:* |
| @tanstack/react-query | 5.62.16 |
| react-hook-form | 7.55.0 |
| @hookform/resolvers | 5.2.2 |
| i18next | 23.16.8 |
| react-i18next | 15.4.0 |
| lucide-react | ^1.16.0 |
| qrcode.react | ^4.2.0 (MFA enroll page) |
| zod | 3.25.76 |
| tailwindcss | 4.3.0 + @tailwindcss/postcss 4.3.0 |
| autoprefixer | 10.4.20 |
| @playwright/test | 1.55.1 |
| @axe-core/playwright | ^4.11.3 |
| axe-playwright | ^2.2.2 |
| vitest | 4.1.6 (apps/web NON usa vitest unit, solo Playwright E2E — script `test:e2e`) |
| typescript | 5.7.2 |

### apps/showcase

Pre-X18 esistente, static export Next 15 → GitHub Pages. Consuma `@heuresys/ui` npm. Workflow CI ubuntu-latest hosted.

### TypeScript invarianti (tsconfig.base.json)

- `strict: true`
- `noUncheckedIndexedAccess: true` — array index access e `Map.get()` ritornano `T | undefined`, narrow esplicito mandatory
- `noUnusedLocals: true`, `noUnusedParameters: true` — unused params prefisso `_` (es. `(_req, reply) =>`)
- `exactOptionalPropertyTypes: false` — intenzionalmente off per ergonomia Zod-inferred types

---

## §5 — Database (PostgreSQL 16 native, OCI VM tunnel 5433)

**Runtime location**: ADR-0010 Option B = PostgreSQL 16 native su `oracle-vm-default` (OCI VM ARM64), raggiunto da Windows via SSH tunnel `ssh -L 5433:localhost:5432 oracle-vm-default` (RD-25, attivo da 2026-05-16). **I13 invariante**: NO Docker.

Connection params (`.env` Option B, attivo):
- Host: `localhost`
- Port: `5433`
- DB: `heuresys_advanced`
- User: `heuresys` (role)
- Schema canonical: `sys`
- SSL: `disable`
- Superuser per script: `postgres` + password (`.env` only, mai committato)

### Schemi
- `sys` — canonical (~41 sys.* tables business; deve essere `sys.sys_<plural>` per I3/I4)
- `staging` — buffer brownfield (wave1_* 18 tables)
- `brownfield` — registry (table_mappings, column_mappings, source_tables, source_columns, import_runs, table_mapping_metadata, source_table_metadata)
- `audit` — `audit.import_validation_results` + altre per-modulo
- `temp_sdbi` — staging per SDBI Phase 2 (migration 000036 shipped)

### Migrations (43 file, idempotenti, OCI VM mounted)

```
000001_init_extensions.sql                 → uuid-ossp, pgcrypto
000002_init_sys_schema.sql                 → CREATE SCHEMA sys
000003_tenancies.sql                       → sys.sys_tenants
000004_users.sql                           → sys.sys_users (NB: auth tables separate, vedi 000005)
000005_auth_foundation.sql                 → 11 sys.sys_auth_* tables (I7)
000006_user_profiles_and_evidence.sql      → sys.sys_user_profiles + sys.sys_user_evidence
000007_enterprise_typing.sql               → sys.sys_enterprise_typing_profiles
000008_blueprint_catalog.sql               → sys.sys_blueprint_* (families, variants, processes, activations, overrides)
000009_organization_model.sql              → sys.sys_organization_units + units_kpi_templates
000010_job_role_model.sql                  → sys.sys_job_families + sys.sys_job_roles
000011_position_model.sql                  → sys.sys_positions + sys.sys_position_intelligence_profiles_v (VIEW per I9)
000012_user_position_assignments.sql       → sys.sys_user_position_assignments
000013_skill_taxonomy_model.sql            → sys.sys_skill_families/categories/skills/aliases/taxonomy_edges/proficiency_levels
000014_position_skill_requirements.sql     → sys.sys_position_skill_requirements (post-ADR-0020 reclassed REFERENCE_ONLY)
000015_kpi_model.sql                       → sys.sys_kpi_definitions + sys.sys_process_kpi_templates
000016_learning_model.sql                  → sys.sys_learning_modules/paths/path_steps
000017_assessment_gap_model.sql            → sys.sys_assessment_methods/results + sys.sys_learning_gaps + sys.sys_assessments
000018_career_succession_model.sql         → sys.sys_career_paths/path_steps + sys.sys_position_career_paths + sys.sys_user_career_plans + sys.sys_succession_pools + sys.sys_successor_candidates + sys.sys_successor_readiness + sys.sys_position_succession_relevance
000019_compensation_intelligence_model.sql → sys.sys_compensation_*
000020_seed_acquisition_staging.sql        → sys.sys_seed_* (run/decision/candidate_records)
000021_seed_reference_bank.sql             → RTL_BANK_REFERENCE seed (158 personas + 158 positions + assignments)
000022_visualization_graph_model.sql       → sys.sys_visualization_* (graphs, nodes, edges, layouts, node_layouts, styles, exports) — ADR-0009 separazione layout
000023_validation_views_and_checks.sql     → views per QA
000024_brownfield_import_staging.sql       → schema staging base
000025_brownfield_lineage_and_mapping.sql  → sys.sys_source_lineage_records (forensic-grade)
000026_brownfield_import_validation.sql    → audit.import_validation_results
000027_ess_inbox_and_audit.sql             → sys.sys_inbox_messages + sys.sys_audit_log (ESS)
000028_dashboard_permission_seed.sql       → RBAC seed (8 roles × 388 mappings)
000029_brownfield_table_mapping_wave.sql   → ADR-0012 wave column on brownfield.table_mappings
000030_brownfield_wave1_staging.sql        → 17 staging.wave1_* tables
000031_add_uq_sys_user_certifications.sql  → UQ certifications
000032_sys_activity_classifications_check_relax.sql
000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql
000034_add_wave1_job_families_staging.sql  → +1 staging table (totale staging.wave1_* = 18)
# NO 000035 (gap cosmetic)
000036_temp_sdbi_schema.sql                → ADR-0014 SDBI Phase 1 pilot (Goals/OKRs + Time/Leave shipped pilot X2)
000037_sys_goals_okrs_scaffold.sql         → SDBI pilot Goals/OKRs target
000038_sys_job_roles_family_nullable.sql   → ADR-0015 DROP NOT NULL family_id
000039_audit_source_table_id_nullable.sql
000040_sys_time_leave_scaffold.sql         → SDBI pilot Time/Leave target
000041_sys_esco_occupation_mappings_job_role_nullable.sql  → ADR-0016 DROP NOT NULL job_role_id + engine companion CW-B34
000042_sys_esco_occupation_mappings_uq_nulls_not_distinct.sql
000043_lookup_fk_2hop_validator.sql        → ADR-0017 LOOKUP_FK_2HOP transform (1381 rows unlocked X9)
000044_cw_b60_b_reclassify_application_level_targets.sql  → ADR-0020 S935 B reclassify 3 IMPORT→REFERENCE_ONLY
```

**Idempotency contract**: `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`. `pnpm db:migrate` × 2 → pg_dump diff vuoto (proven).

### Brownfield Wave 1 status (post-X19 + ADR-0020)

- 13/19 IMPORT targets popolati (~34509 upserted)
- 3 targets ex-IMPORT reclassed REFERENCE_ONLY via ADR-0020 (sys_blueprint_overrides, sys_position_skill_requirements, sys_position_learning_requirements)
- 3 targets ex-IMPORT silent-skip mitigato via CW-B61 (sys_skill_categories, sys_activity_classification_mappings, sys_process_kpi_templates — engine ora emette `SILENT_UPSERT_ZERO_ROWS_V1` audit row + pino WARN structured)
- Brownfield registry: 93 source_tables + 1164 source_columns + 94 table_mappings + **1271 column_mappings** (count corretto; vecchio numero 1177 in docs era drift, fixed S933)
- staging.wave1_* tables: **18** (count corretto; vecchio 17 era drift, fixed S933)

### Seed personas (test admin + 5 personas)

Password unica per tutte: **`Admin#PassW0rd!`**

| Email | Ruolo | Tenant |
|---|---|---|
| `admin@heuresys.com` | PLATFORM_ADMIN | (cross-tenant) |
| `tenant_admin_test@rtl-bank.test` | TENANT_ADMIN | RTL_BANK_REFERENCE |
| `manager_test@rtl-bank.test` | MANAGER | RTL_BANK_REFERENCE |
| `employee_test@rtl-bank.test` | USER | RTL_BANK_REFERENCE |
| `outsider_test@rtl-bank.test` | USER (outsider, niente assignment attivo) | RTL_BANK_REFERENCE |

Seed comando: `pnpm db:seed-test-admin` (script `db/scripts/seed-test-admin.ts`).

Seed RTL_BANK_REFERENCE (158 positions + 158 personas + assignments): `pnpm db:seed` (deterministic Faker seed=42, RD-Q6).

### Counts verified storici (per cross-check)

- sys_users: 433 (post-X19, no regressione)
- positions: 55 (NB: docs storici dicevano 158 era WRONG — quello è seed personas count)
- column_mappings: 1271 (post-S933 fix drift)
- staging tables: 18 wave1_*
- Migrations applied: 43 (compreso gap 000035 = numerazione cosmetic)
- sys.* populated: 60/134 (~45% post Wave 1 pragmatic close)

---

## §6 — Auth + Security

**Auth model**: 11 tabelle `sys.sys_auth_*` separate da `sys.sys_users` (I7 invariante). Migration 000005.

### Hashing
- **Argon2id** (ADR-0005) — params: 64 MiB / 3 iter / 4 parallelism (OWASP 2024)
- `needsRehash` auto-rotate al login successo

### JWT (ADR-0006)
- Access token: **RS256**, TTL 15min, cookie `HttpOnly` + `SameSite=Lax`
- Refresh token: TTL 30d, **single-use**, rotation con **replay detection** (revoke famiglia + `401 REFRESH_REPLAY_DETECTED`)
- Keys in `.secrets/jwt_{private,public}.pem` (**gitignored**)
- Login response: **200 con body** (NON 204 — Fastify strips body da 204; errata documented commit `7450f77`)

### CSRF (ADR-0006)
- Double-submit cookie pattern via `csrfPlugin`
- **Opt-in per route** — `app.verifyCsrf` preHandler obbligatorio su POST/PATCH/DELETE

### MFA TOTP (Tappa E MVP-3, v0.3.2-mvp3-full)
- RFC 6238 via `otpauth@9.5.1`
- Encryption a riposo: AES-256-GCM via `MFA_ENCRYPTION_KEY` env (32 byte base64, REQUIRED — env validation `.min(32)` shipped S935-E)
- Login flow 2-step: `LoginResponse` = discriminated union `{ status: 'success' | 'mfa_required' }`
- Endpoints: `/v1/auth/login` + `/v1/auth/mfa/verify` + admin lifecycle endpoints (enroll, factor list, reset)
- Error codes: `MFA_CODE_REQUIRED`, `MFA_INVALID`, `MFA_TOTP_INVALID`
- Test: 5 vitest integration test (real TOTP) + Playwright `login-mfa.spec.ts` 2/2 (prod build)

### RBAC (388 role × permission mappings, 8 ruoli)

8 ruoli (constant in `apps/api/src/config/constants.ts` `RoleCode` union):
1. `PLATFORM_ADMIN`
2. `TENANT_ADMIN`
3. `BLUEPRINT_MANAGER`
4. `HRMS_MANAGER`
5. `PROCESS_OWNER`
6. `MANAGER`
7. `USER`
8. `READ_ONLY`

**Permission cache**: caricata UNA volta a server start da `sys.sys_auth_role_permissions`. `requirePermission('perm:code')` throws `RBAC_NOT_LOADED` se used prima del cache populate (verificato a test bootstrap).

### Error classes typed (src/errors/index.ts)
- `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`
- Uso obbligatorio nei service/repository: `throw new ForbiddenError('Missing permission: skills:write', 'PERMISSION_DENIED')`
- Codes pattern: `SCREAMING_SNAKE`. Esistenti: `LOGIN_INVALID`, `REFRESH_REPLAY_DETECTED`, `RBAC_NOT_LOADED`, `PERMISSION_DENIED`, `RATE_LIMITED`, `MFA_*`
- Error handler globale → `{error:{code, message, requestId}}` stable response

### Secret hygiene (R11 cross-tool)
- MAI loggare: password, SSH private key content, API token, JWT body, connection string con credentials inline, GitHub PAT, OpenAI API key, OCI passphrase
- Logger redaction: `LOG_REDACT_PATHS` exported da `apps/api/src/app.ts` (cookies, Authorization, password fields, refresh tokens, `*.password`, `*.hash`, `*.secret`)
- Pre-commit: `grep -E 'password|secret|api.key|sk-|token|BEGIN PRIVATE KEY'` su staged diff prima di ogni commit con cambi a config files

---

## §7 — Infrastructure topology

### Windows host (sviluppo primario)
- `DESKTOP-KH728P2`, user `enzospenuso`
- Workspace Cowork persistente: `C:\Users\enzospenuso\Claude Desktop\`
- Repo: `D:\heuresys-advanced\` + `D:\ux-design-shared\`
- Repo legacy READ-ONLY: `D:\evo.heuresys.com\`
- Chiavi SSH in `C:\Users\enzospenuso\.ssh\`:
  - `oci_recovery_ed25519` → `oracle-vm-default` (passphrase richiesta — vedi §19)
  - `oci_vm_ed25519` → `oracle-vm-source` (secondary, parcheggiata 2026-04-16)
  - `mac_local_ed25519` → `mac-local`
  - `github_ed25519` → GitHub
- ssh-agent service: **Running + Automatic** (verified S937 CK-1)
- `~/.ssh/config` `Host *` ha: `AddKeysToAgent yes`, `IdentitiesOnly yes`, `ServerAliveInterval 60`, `ServerAliveCountMax 3`, `Compression yes`
- Cmd.exe NON in PATH di Enzo (profilo modificato) — sempre path assoluti per binari Windows
- Claude Code CLI installato: `claude` (v2.1.85 baseline)
- Git path: `C:\Git\cmd\git.exe`

### macOS host (sviluppo secondario)
- MacBook Pro 9,2 (Mid 2012) Intel x86_64, 8 GB RAM
- macOS 15.7.6 (Sequoia) via OpenCore Legacy Patcher — Darwin 24.6.0
- Alias SSH: `mac-local` | IP LAN: 192.168.1.4 | user `enzo`
- Homebrew: `/usr/local/` (Intel path)
- Claude Code CLI: `/usr/local/bin/claude` (update richiede `sudo claude update`)
- SSH non-interactive: zsh non sourcea `.zshrc` → prepend `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH` ad ogni comando remoto
- SSHFS mount: `/Users/enzo/mnt/oracle-vm-default` (script `~/mnt/mount-oci-vms.sh [mount|umount|status]`)
- Docker Desktop disponibile (ma I13 hard policy: NO docker per heuresys-advanced)
- Performance: build pesanti lenti (datato), ottimo per editing/SSH/git/exploration

### OCI VM `oracle-vm-default` (primaria, runtime + CI)
- OCI Free Tier eu-milan-1, Ubuntu 24.04 LTS ARM64
- IP: **80.225.82.207**
- User SSH: `ubuntu`, home `/home/ubuntu/`
- Chiave: `oci_recovery_ed25519`
- Repo: `/home/ubuntu/heuresys-advanced/` + `/home/ubuntu/heuresys-evo/` (legacy read-only)
- PostgreSQL 16 native (ADR-0004) — porta 5432 (raggiunta via tunnel locale 5433 da Windows)
- Node 22.x + pnpm 9.15.0 installati
- Claude Code CLI auto-update attivo
- Pre-requisiti runner GH Actions: già installati Playwright system deps (libnss3, libnspr4, ecc.)

### OCI VM `oracle-vm-source` (secondaria)
- IP: 79.72.47.188
- Chiave: `oci_vm_ed25519`
- Parcheggiata 2026-04-16 — non in uso operativo MVP-4

### Tunnel SSH canonical (Windows → OCI VM)

```powershell
# Background, no remote command, port forward only:
ssh -fN -L 5433:localhost:5432 oracle-vm-default
```

Multi-port via config alias `oracle-vm-default-tunnel`:
- 15433 → :5433 (PG alt)
- 18012 → :8012
- 19512 → :9512
- 37777 → :37777
- 14000 → :4000

---

## §8 — CI/CD (GitHub Actions self-hosted)

**Workflows shipped S935 phase F** (`.github/workflows/`):

| Workflow | File | Trigger | Runner | Duration (warm) | Gating |
|---|---|---|---|---|---|
| Typecheck | `typecheck.yml` | push + PR + dispatch | `[self-hosted, oci-vm]` | <30s | YES |
| Lint | `lint.yml` | push + PR + dispatch | `[self-hosted, oci-vm]` | <15s | YES |
| i18n parity | `i18n-parity.yml` | push (apps/web/src/i18n) + PR | `[self-hosted, oci-vm]` | <5s | YES |
| Test integration | `test-integration.yml` | push + PR (api+db paths) | `[self-hosted, oci-vm]` | <3min | YES |
| Build web | `build-web.yml` | push (web paths) + PR | `[self-hosted, oci-vm]` | <2min | YES |
| Playwright smoke | `playwright-smoke.yml` | push + PR | `[self-hosted, oci-vm]` | <10min | YES |
| Showcase deploy | `showcase.yml` (pre-S935) | push (showcase paths) | `ubuntu-latest` hosted | <5min | NO (deploy-only) |

**Stato attuale runner**: `oracle-vm-default-runner` NON ancora registrato (CK-2 di S937, blocked-by-CK-1). Procedura completa in `docs/ci/self-hosted-runners-setup.md` §3 (9 step, ~1-2h interactive on VM).

**Path-based scoping**:
- `typecheck.yml`: skip se solo `docs/**`, `*.md`, `cowork_reserved/**`, `cowork_code_exchange/**`, `.handoff/**`, `qa_artifacts/**`, `sessioni/**` changed.
- `test-integration.yml`: skip se solo `apps/web/**` o `apps/showcase/**` changed.
- `build-web.yml`: trigger su `apps/web/**`, `packages/shared/**`, root `package.json`, `pnpm-lock.yaml`.

**Concurrency**:
- `cancel-in-progress: true` per typecheck / lint / i18n / build-web (cancel-safe).
- `cancel-in-progress: false` per test-integration + playwright-smoke (DB state mid-flight protetta).

**Secrets via runner systemd EnvironmentFile** `/etc/heuresys-runner.env` (mode 600, root-owned). **MAI secrets letterali in YAML** (R11). Le var sono referenced come `$POSTGRES_USER` (env del processo runner), NON `secrets.POSTGRES_USER` (che richiederebbe GitHub Secrets registration).

Contenuto EnvironmentFile (placeholder values, da popolare):
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=heuresys_advanced
POSTGRES_USER=heuresys
POSTGRES_PASSWORD=<from .env dev host>
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable
COOKIE_SECRET=<from .env>
ADMIN_ORIGIN=http://localhost:3000
NODE_ENV=test
JWT_PRIVATE_KEY=<base64 of .secrets/jwt_private.pem>
JWT_PUBLIC_KEY=<base64 of .secrets/jwt_public.pem>
MFA_ENCRYPTION_KEY=<openssl rand -base64 32>
LOG_LEVEL=warn
NEXT_TELEMETRY_DISABLED=1
```

### Branch protection (docs/github/branch-protection.md, ACCEPTED ma da apply via gh CLI)

Su `main`:
- Require PR before merge: **OFF** (preserva autonomy Cowork+CLI ship-to-main)
- Require status checks: **ON** — i 6 workflow sopra in `required_status_checks`
- Require branches up-to-date before merging: **ON** (forza rebase se behind)
- Require linear history: **ON** (no merge commits, atomic commits / rebase)
- Require signed commits: OFF (deferred)
- Include administrators: **ON**
- Allow force pushes: **OFF** (R12 hard rule)
- Allow deletions: **OFF**

Apply script: `scripts/setup-branch-protection.ps1` (gh CLI) — vedi `docs/github/branch-protection.md` §3.

### Showcase deploy (pre-existing)

`apps/showcase` static export → GitHub Pages via `showcase.yml` (`ubuntu-latest` hosted). ~5 esecuzioni/mese.

---

## §9 — Design system `@heuresys/ui`

**Source repo**: `D:\ux-design-shared\` (sorgente). HEAD storico `dfa2e81` (post 0.1.1 release).
**Pubblicazione**: npm registry, package name `@heuresys/ui`, org `@heuresys` owner `spen-zosky`.
**Versione attiva**: `^0.1.1` (0.1.0 DEPRECATED post X18 saga).
**Risoluzione locale**: pnpm symlink interno `node_modules/.pnpm/@heuresys+ui@<ver>/node_modules/@heuresys/ui` (NON link: a working copy — la migrazione X18 ha switchato da `link:../ux-design-shared/ui` a npm-published).

### Componenti shipped 0.1.1
- 51 components / 16 tier (count storico, da verificare con `pnpm ls --depth=0`)
- Dashboard primitives: `DashboardShell`, `DashboardHeader`, `DashboardSidebar`, `DashboardFooter`, `KPIStrip`, `LogStream`, `AuditFeed`, `IncidentTimeline`, `ErrorRateBreakdown`, `AlertBanner`, `DBSupervisorSidebar`
- Brand: `HeuresysWordmark`, `HeuresysMark` (Exo 2 700, "y" viola)
- Standard primitives: Button, Card, DataTable, Input, etc.
- Hover affordance CSS globale (border --primary alpha 0.85 + glow ring + scale 1.012)
- Cross-hair tables: helper `attachCrossHair()` + 3 prebuilt (TenantFleet, SqlSlowQuery, RBAC con tri-state)
- Palette dropdown (4 preset: Default, Cool ocean, Warm sunset, Brand mono) + Theme toggle (sun/moon, html.dark, localStorage persist)

### Regole rigorose (CLAUDE.md project + ADR-0013 SoT policy)

1. **MAI** creare reusable UI components in `apps/web` / `apps/showcase` / `packages/*` di heuresys-advanced. Vanno nel repo `ux-design-shared`.
2. **MAI** aggiungere UI runtime deps (Radix, framer-motion, recharts, ecc.) ai `package.json` di heuresys-advanced. Appartengono a `@heuresys/ui` come transitive.
3. Page-specific composition rimane in `apps/web/src/components/` MA solo come composizione di primitives di `@heuresys/ui` + Zod schemas wrappers da `@heuresys/shared`.
4. React peer: `@heuresys/ui` dichiara React via `peerDependencies`; `apps/web` / `apps/showcase` installano React 19.2.5 concreto. Evita "due React instances" crash.

### Workflow modifica componente UI (post-X18)

1. Lavoro in repo `ux-design-shared` con Storybook (`npm run storybook` → `http://localhost:6006`)
2. Validate
3. Versionare + `npm publish` (richiede GAT bypass-2fa configured in `~/.npmrc`)
4. Bumpare dep qui: `pnpm update @heuresys/ui` (segue range `^0.1.1`) o pinning esplicito
5. `pnpm install` + verify integration

Per dev rapido in emergenza è ammesso temporaneamente reintrodurre `link:` o `pnpm.overrides` puntando a working copy locale, MA va ripristinato a versione npm prima del commit (regola non-negotiable).

### Tailwind 4 + Next 15 config consumption

```ts
// apps/web/tailwind.config.ts
content: [
  "./src/**/*.{ts,tsx}",
  "./node_modules/@heuresys/ui/dist/**/*.{js,mjs}",
]
```

```js
// apps/web/next.config.js
transpilePackages: ["@heuresys/ui"]
```

**globals.css** (Tailwind 4): `@source "../../node_modules/@heuresys/ui/dist/**/*.{js,mjs}"` (S935 CODE-3 portability fix).

### Known issue CW-B59 (vedi §12)

Post 0.1.1 publish, `apps/web` build su `/showcase/*` routes (`apps/web/src/_disabled_showcase_X18/`) genera `TypeError: d.createContext is not a function` durante page-data collection Next 15. Admin routes 40+ UNAFFECTED, build green. /showcase routes attualmente in `_disabled_showcase_X18/` (excluded da tsconfig). S935 phase C ha reframed root cause; S935 Path G React pinning ha eliminato `createContext` error ma exposed `Class extends value undefined`. Vedi §12 bias #59 + `docs/cw-b59-true-root-cause-2026-05-26.md` + S937 CK-4 script v2.

---

## §10 — Modules API (apps/api/src/modules — 58 directory)

```
activity-classification-mappings, activity-classifications, assessment-methods,
assessment-results, assessments, auth, blueprint-activations, blueprint-families,
blueprint-overrides, blueprint-processes, blueprint-variants,
brownfield-import-runs, brownfield-source-exports, brownfield-table-mappings,
brownfield-wave-executor, career-path-steps, career-paths, compensation,
dashboard, enterprise-size-bands, enterprise-typing-profiles, job-families,
job-roles, kpi-definitions, learning-gaps, learning-modules,
learning-path-steps, learning-paths, me, operating-models,
organization-unit-kpi-templates, organization-units, position-career-paths,
position-succession-relevance, positions, process-kpi-templates,
seed-acquisition-runs, seed-approval-decisions, seed-candidate-records,
skill-aliases, skill-categories, skill-families, skill-proficiency-levels,
skill-taxonomy-edges, skills, succession-pools, successor-candidates,
successor-readiness, tenants, training-initiatives, user-career-plans, users,
visualization-edges, visualization-exports, visualization-graphs,
visualization-layouts, visualization-node-layouts, visualization-nodes,
visualization-styles
```

Totale **58 moduli** + auth + ESS `me/` = ~272 endpoint live (count post-X18, da `grep -rEh "app\.(get|post|patch|delete|put)\(\"/" apps/api/src/modules/`).

### Pattern modulo (mandatory, applicato 11+ volte MVP-1, non deviare)

Per ogni nuovo modulo:

1. **`packages/shared/src/schemas/<module>.ts`** — Zod schemas (Create/Update/Filter/Response). Export da `packages/shared/src/index.ts` + subpath export in `packages/shared/package.json` → `./schemas/<module>`.
2. **`apps/api/src/modules/<module>/repository.ts`** — **raw parameterized SQL** contro `sys.sys_<plural>`. Drizzle solo via pool wrapper (`src/db/client.ts`); query usano `$1, $2, …` parametrizzati, mai string interpolation. Multi-statement atomic ops → helper `withTransaction(pool, async (client) => {...})` (pattern in `modules/auth/repository.ts`).
3. **`apps/api/src/modules/<module>/service.ts`** — business logic + scope authorization da `ActorContext` built da `req.user`. Visibility model per-modulo (tenant-only / global+tenant / platform-only — vedi moduli esistenti).
4. **`apps/api/src/modules/<module>/routes.ts`** — `FastifyPluginAsyncZod` con `requirePermission('<resource>:<verb>')` su ogni route + `app.verifyCsrf` su POST/PATCH/DELETE. Errors da typed classes in `src/errors/index.ts` (NO Error nativo).
5. **Register** in `apps/api/src/app.ts` step 13 con `app.register(<module>Routes, { prefix: '/v1/<module>' })`.
6. **`apps/api/test/<module>.integration.test.ts`** — supertest via `buildTestApp()` helper (4-8 test/modulo). Test colpiscono il **vero DB** via tunnel. ZERO mock.
7. `pnpm test` 100% green → **atomic commit**: `feat(api): MVP-1 5.1.X — <module> module (N endpoints, M tests)`.

### Plugin chain Fastify (`apps/api/src/app.ts`, ordine FISSO 1-13, non riordinare)

Da `docs/api/API_IMPLEMENTATION_PLAN.md` §3.2:

```
1. Zod type-provider compilers
2. requestId
3. helmet
4. cors
5. cookie
6. JWT (RS256)
7. rate-limit
8. auth (decode-only, non-enforcing — popola req.user se cookie presente)
9. CSRF (double-submit, opt-in per route via app.verifyCsrf preHandler)
10. tenantContext
11. errorHandler
12. /healthz + /readyz endpoints
13. module routes (/v1/<module>)
```

**Auth NON-enforcing al plugin level**: `auth.ts` decodifica JWT cookie in `req.user` se presente; enforcement per-route via `requirePermission('perm:code')` da `middleware/rbac.ts`. RBAC cache caricata UNA volta a server start (388 mappings × 8 roles).

### Test files apps/api/test (52 totali)

**35 integration test** (`*.integration.test.ts`): tutti i 58 moduli coperti tranne residual (auth/auth-mfa/me/me-ess-extensions/mfa hanno integration test, brownfield ha multiple file).

**Unit/special test**:
- `transform-compiler.test.ts`, `transform-compiler.cast-enum.test.ts`, `transform-compiler.lookup-fk-2hop.test.ts` (transform engine brownfield)
- `upsert-sql-cw-b34-nullable-nk.test.ts`, `upsert-sql-cw-b60-a-silent-skip.test.ts`, `upsert-sql-type-coerce.test.ts`, `upsert-sql.cw-b49-coalesce-conflict.test.ts` (upsert engine fixes)
- `wave1-debug-scale-v4.test.ts`, `wave1-idempotency.test.ts` (brownfield Wave 1)
- `run-logger.test.ts` (logger)

### Vitest config (apps/api/vitest.config.ts)

- **singleThread** (no parallel) — evita refresh-rotation race conditions
- shared DB pool across suite
- `buildTestApp()` helper boota Fastify isolato per test + carica RBAC cache una volta + injects `InMemoryMailer` per auth assertions senza I/O
- Vitest 4.x (migrazione S933 phase 0 fix: `poolOptions` → `fileParallelism + maxWorkers/minWorkers`)

**Baseline test count**:
- Post commit `64c2a27` (MVP-1 closure): **69/69 verde**
- Post MVP-3 v0.3.2: **341 passed / 1 fail pre-esistente** (`skills.integration.test.ts:131` createdSkillIds list visibility, non-blocking)
- Post S934: **+3 test** (`upsert-sql-cw-b60-a-silent-skip` T1/T2/T3 verdi via standalone esbuild driver + Windows host real run)

### OpenAPI

Endpoint dump: `pnpm openapi:generate` (scrive `apps/api/openapi.yaml`) — S935-D ha rimosso questo script (era dead per ora; ri-aggiungere quando si formalizza OpenAPI contract).

---

## §11 — Frontend admin + ESS (apps/web)

### Struttura `apps/web/src/app/`

```
app/
├── login/                       ← unica route pubblica
└── (authenticated)/             ← route group con auth guard layout
    ├── admin/                   ← admin business
    ├── blueprints/
    ├── brownfield-adaptation/
    ├── career-succession/
    ├── compensation-intelligence/
    ├── dashboard/
    ├── gaps/
    ├── kpis/
    ├── learning/
    ├── me/                      ← ESS portal (MVP-2b)
    │   ├── career/
    │   ├── certifications/
    │   ├── documents/
    │   ├── gaps/
    │   ├── inbox/
    │   ├── kpis/
    │   ├── learning/
    │   ├── positions/
    │   ├── profile/
    │   ├── security/
    │   └── skills/
    ├── organization/
    ├── positions/
    ├── processes/
    ├── seed-acquisition/
    ├── skills/
    ├── system-health/           ← PLATFORM_ADMIN dashboard (X16)
    ├── tenants/
    ├── users/
    └── visualizations/
```

**Route count storico verified**:
- 1 root + 1 login + 30 admin + 14 ESS + 1 system-health = **47 routes** (post-X16)
- Post X19/X20: admin/ESS surface invariata, MFA login-gating embedded in `/login`

### Playwright E2E spec files (apps/web/tests/e2e/, 20 spec)

```
a11y.spec.ts                   ← axe-playwright sweep (PLATFORM_ADMIN, TENANT_ADMIN, EMPLOYEE pages)
admin-catalogues.spec.ts       ← skills, kpis, learning catalogue
admin-lists.spec.ts            ← users, tenants, positions
admin-org-bpm.spec.ts          ← organization-units, blueprints
admin-pipelines.spec.ts        ← seed-acquisition, brownfield-adaptation
admin-tabs.spec.ts             ← tab navigation pattern
auth.spec.ts                   ← login (Tappa A baseline)
closing-pages.spec.ts          ← compensation, processes, career-succession
complex-domains.spec.ts        ← gaps, visualizations, system-health
ess-certifications-upload.spec.ts
landing-pages.spec.ts          ← role-based redirect post-login
login-mfa.spec.ts              ← Tappa E MFA 2-step (TOTP RFC 6238)
me-pages.spec.ts               ← ESS /me/* CRUD
mfa-enroll.spec.ts             ← MFA enroll flow
position-sub.spec.ts           ← position detail + sub-CRUD
showcase-a11y.spec.ts          ← (DISABLED per CW-B59)
showcase-smoke.spec.ts         ← (DISABLED per CW-B59)
smoke-5-personas.spec.ts       ← Per-persona smoke
system-health.spec.ts          ← X13 platformAdmin SUPERUSER + tenantAdmin redirect (CW-B53 acceptance)
visualizations.spec.ts         ← React Flow renderer
```

**Test count storico** (post-X13):
- 18 spec files, ~125 runtime `test()` calls via Playwright `--list`
- Coverage matrix: 0 NONE routes (X13 close ha portato `/system-health` da NONE a FULL)

### Doctrine LIVE DATA E2E ONLY (MVP-2a/2b non-negotiable)

Da `NEXT_SESSION_MVP_2A.md` + `CLAUDE.md` project section "MVP-2a / MVP-2b frontend":

1. **ZERO mock data, ZERO demo fixture, ZERO placeholder hard-coded**. Ogni cella/grafico/tabella/form alimentato da chiamata reale a `/v1/*` che colpisce PG OCI VM via tunnel 5433.
2. **ZERO endpoint stubbed**, NO Next.js routes che ritornano JSON statici, NO TanStack Query con `initialData`/`placeholderData` hard-coded.
3. **NO commit di pagina senza Playwright E2E test verde** che esegue login reale + naviga + asserisce su dati seed reali (RTL_BANK_REFERENCE + 5 test personas).
4. **Ordine OBBLIGATORIO**: API-first → contract verify (vitest API integration green) → frontend type reuse from `@heuresys/shared` → TanStack Query hook → component composing `@heuresys/ui` primitives → Playwright E2E green.
5. **Wiring completo TUTTI i livelli** prima di merge pagina: schema Zod shared → API repo/service/route → integration test → frontend types → hook → component → E2E. Se un livello manca, pagina **non considerata fatta**.
6. **Correction + retest cycle** mandatory: ogni regressione (TS, vitest API, Playwright, i18n parity) blocca merge pagina corrente.

### Empty state allowed

L'**unica eccezione** ammessa al "zero mock" è UI di **empty state reale** ("Nessun risultato trovato") quando la query REST ritorna lista vuota — e deve essere vera UI di empty state, non placeholder informativo.

### E2E run cadence (CW-B54 mitigation, X15 evidence)

- Acceptance suite acceptance va eseguita contro `pnpm start` (warm production build), NON `pnpm dev`.
- Dev mode causes JIT compile + 4-worker contention → ~45 timing fail su 125 test (1.0h vs 5.3m prod build).
- Dev mode acceptable solo per debugging single-spec con `--workers=1`.
- Showcase tests richiedono `NEXT_PUBLIC_ENABLE_SHOWCASE=1` burn-at-build OR `NODE_ENV !== 'production'`.

### i18n parity (it/en)

- Script: `pnpm i18n:check` (root) → `apps/web/scripts/check-i18n-parity.ts`
- Coverage: 23 keys × 2 locales (post-X13), parity verde
- File: `apps/web/src/i18n/{it,en}.json` (o `apps/web/src/locales/{it,en}/common.json` — verificare struttura corrente)
- MVP-4 expansion: CODE-10 deferred, ~2-4h work post-MVP-4 streams (vedi `docs/preflight-residual-todo.md` §2)

---

## §12 — Bias registry (61 catalogued / 43 mitigated post-S937)

Source: `cowork_reserved/bias_registry.md` (SoT cross-batch).

**Tally aggiornato S937**:
- Total catalogati: **61** actively (CW-B17 → CW-B62)
- WITHDRAWN: 1 (CW-B57 misdiagnosis 2026-05-24)
- Effective valid: 61 (B17→B56 + B58→B62)
- Mitigated: **43**
- Deferred proper fix: 1 (**CW-B59** — architectural Path A/F still pending)
- Reflexive pattern-memo: 6 (B25, B30, B40, B42, B44, B47)
- Standardized: 2 (B29 migration convention, cross-OS pipeline B28)
- Pending: 4 (B39 forensic, B41 xos_lib, B43 pattern note, B45 source-vs-target CHECK delta into SDBI Phase 4)
- **Next available**: `CW-B63`

### Bias critici per CLI (memo veloci da consultare prima di task affini)

| ID | Tipo | Lezione |
|---|---|---|
| **CW-B49** | Engine COALESCE-UQ | Conflict inference su `ON CONFLICT` deve preservare wrappers COALESCE. Helper `replaceTargetColsInConflictInference` parenthesis-depth-aware in `upsert-sql.ts`. ADR-0018. |
| **CW-B52** | Spec staleness | Acceptance `≥75/134 populated` ERA irraggiungibile (solo 19 distinct IMPORT targets Wave 1, max teorico 62/134). Always **live-state pre-flight** in PROMPT authoring. |
| **CW-B54** | Playwright dev-mode JIT jitter | Test acceptance OBBLIGATORIO contro `pnpm start` warm prod build. Dev mode = 45 timing fail su 125. |
| **CW-B58** | Misdiagnosis via assumption gap (meta-bias) | Empirical test matrix > narrative diagnosis. Pre-prescription bundle inspection mandatory (`head -30 dist/index.mjs`) prima di prescrivere fix tsup. Lesson cross-batch reinforced X18.3/X18.4/X18.5. |
| **CW-B59** | Bisect contamination + Next 15 RSC narrative bias (architectural) | NON è "RSC bundle threshold". È React peer-dep mismatch o `'use client'` missing o CJS/ESM interop. Iter 12 stack-trace empirical: `TypeError: d.createContext is not a function`. **Partial-mitigation**: S935 Path G React `pnpm.overrides` ha eliminato `createContext` ma exposed `Class extends value undefined` (S936-1). **Open**: Path A revised v2 bisect (S937 CK-4 script v2 shipped) OR Path F split `@heuresys/ui` in 3 sub-pkgs. |
| **CW-B60-A** | Engine silent-filter (3 IMPORT targets 0 upserted, 0 log) | Mitigated via **CW-B61** (S934 observability fix `SILENT_UPSERT_ZERO_ROWS_V1` audit row + pino WARN). 3 unit test verdi. **Live re-run validation DEFERRED** (S937 CK-3 blocked-by-CK-1 SSH). |
| **CW-B60-B** | Wave-2 scope gap (3 IMPORT senza staging source) | Mitigated via **ADR-0020** S935 B (3 application-level targets reclassed IMPORT→REFERENCE_ONLY). Migration 000044 idempotente. |
| **CW-B61** | Silent-skip observability fix | Code path `upsert-sql.ts:763-875` — probe SELECT count + logger.warn structured + audit INSERT BEFORE silent return. Result shape unchanged back-compat. |
| **CW-B62** | MCP-Windows SSH interactive automation gap | S937 finding — passphrase entry interattiva NON bypass-able via MCP Start-Process. 3 tentativi falliti. **Mitigated-by-documentation**: helper script `s937-ck1-load-ssh-key.ps1` workspace-level (R17) per manual launch da shell aperta a mano. R23/iii eccezione canonica. |

### Race condition mitigation

Numerazione bias = atomic claim: legge registry → Next available → claim → commit. Conflitti Cowork ↔ CLI parallel: primo commit wins; secondo incrementa + re-emit. Pre-emit verification mandatory.

---

## §13 — ADRs registrate (20)

Source: `docs/architecture/ADR_INDEX.md` + project CLAUDE.md.

| ID | Titolo | Status | Decisione sintetica |
|---|---|---|---|
| 0001 | Monorepo manager | Accepted | pnpm workspaces |
| 0002 | Backend framework | Accepted | Fastify 4 (upgrade to 5 in X19) |
| 0003 | DB access | Accepted | Drizzle ORM + raw `*.sql` migrations |
| 0004 | Runtime — no Docker | Accepted (hard) | PostgreSQL 16 native |
| 0005 | Password hashing | Accepted | Argon2id OWASP 2024 (64/3/4) |
| 0006 | Auth strategy | Accepted | JWT RS256 15min + refresh 30d rotation + HttpOnly + SameSite Lax + CSRF double-submit |
| 0007 | Frontend framework | Accepted | Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui via @heuresys/ui + TanStack Query + RHF + Zod |
| 0008 | PIP storage | Accepted | Relational + VIEW/MATERIALIZED VIEW (NO JSONB blob) |
| 0009 | Visualization coordinates | Accepted | sys.sys_visualization_node_layouts dedicato (layout vs semantica separati) |
| 0010 | PG runtime location | Accepted | **Option B** OCI VM tunnel 5433 (RD-25) |
| 0011 | ESS scope inclusion | Accepted | ESS = MVP-2b (13 page + 18 endpoint + 19 perm self-scope + ESLint guard) |
| 0012 | Brownfield wave assignment | Accepted | `table_mapping_wave smallint` su `brownfield.table_mappings` + CHECK 1..4 |
| 0013 | Showcase SoT policy | Accepted | 4-level hierarchy + 3 rules (no-edit zone on sync paths, portability, deps surface alignment) |
| 0014 | SDBI | **Proposed** | Semantic-Driven Brownfield Import — 6-phase AI-led workflow + temp_sdbi staging + mapping_card + confidence HIGH/MEDIUM/LOW. Pilot X2 Goals/OKRs + Time/Leave shipped. **DA PORTARE A `ACCEPTED`** in PROMPT 027 (SDBI Phase 2 kickoff). |
| 0015 | `sys_job_roles.family_id` nullable FK | **Proposed** | DROP NOT NULL (mig 000038). CW-B26 Semantic FK Phantom mirror per ADR-0016. |
| 0016 | `sys_esco_occupation_mappings.job_role_id` nullable FK | Accepted | DROP NOT NULL + engine companion CW-B34 |
| 0017 | LOOKUP_FK_2HOP transform | Accepted | Engine extension + migration 000043 validator dispatch |
| 0018 | COALESCE-UQ class-of-bug fix | Accepted | Helper `replaceTargetColsInConflictInference` parenthesis-depth-aware |
| 0020 | Wave-2 scope: application-level targets | Accepted | Reclassify 3 IMPORT→REFERENCE_ONLY (sys_blueprint_overrides + sys_position_skill_requirements + sys_position_learning_requirements). Migration 000044. S935 B. |
| (0019, 0021) | gap nel range | — | Numerazione cosmetic gap (0019 mai assegnato; 0021 reserved per ADR-0021 React peer-dep formalization se Path G consolidata) |

---

## §14 — Invarianti I1-I14 + RD-08/09 (non-negotiable)

Da `docs/BOOTSTRAP_EXECUTION_PLAN.md` §2 + `CLAUDE.md` project + `START_HERE.md`:

| # | Vincolo | Status enforcement |
|---|---|---|
| **I1** | Position-centric (NON Employee-centric). Position owner ≠ Incumbent. | Architecturally locked |
| **I2** | (reserved) | — |
| **I3** | Schema canonical = `sys`. Aux: `staging`, `brownfield`, `audit`, `temp_sdbi`. | Hard rule |
| **I4** | Mai `usr_*`, mai `br_*` (vecchi prefissi heuresys-evo). Sempre `sys.sys_<plural>`. | Hard rule |
| **I5** | Tenant isolation = **FK + API middleware filter**. **MAI RLS**. | Hard rule (no PostgreSQL RLS anywhere) |
| **I6** | (reserved) | — |
| **I7** | Auth separato da `sys.sys_users`: **11 tabelle `sys.sys_auth_*`** dedicate. | Migration 000005 |
| **I8** | Out-of-scope HARD: payroll execution, T&A, benefits, medical, IAM/SSO esterno, recruiting hiring, onboarding workflow, contracts body. | I8-related streams MVP-4 esplicitamente OUT-of-scope (RecruitingHiring + Onboarding marker only in SDBI Phase 2 PROMPT 027) |
| **I9** | Position Intelligence Profile = `VIEW`/`MATERIALIZED VIEW`, **MAI** blob JSONB. | ADR-0008 |
| **I10** | Visualization layer separato: layout edits → `sys_visualization_node_layouts`, semantica intatta. | ADR-0009 |
| **I11** | (reserved) | — |
| **I12** | Brownfield = **enrichment source only**; v5 architecture wins; demo data (no PII reale); no anonymization. | RD-02 |
| **I13** | PostgreSQL 16 **NATIVO**. **NO Docker**. Runtime per ADR-0010 = Option B OCI VM tunnel 5433. | ADR-0004 + ADR-0010 |
| **I14** | (reserved) | — |
| **RD-08** | Categorical fields = `varchar(N) + CHECK`, **MAI** PostgreSQL ENUM. Enum-like values come TS-side discriminators. | RD-08, applied in tutti i moduli |
| **RD-09** | `date` per date-only; `timestamptz` solo dove serve precision tempo. | RD-09 |

**Quando un nuovo requirement sembra conflittare con un'invariante → STOP e chiedere a Enzo (decision authority).** NON workaround silenzioso.

---

## §15 — Cowork↔CLI exchange protocol (v2.2)

Source: `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` + protocollo storico cowork_code_exchange.

### Directory `cowork_code_exchange/`

Convenzione file naming:
- `_00_STATE_<NNN>.md` — state machine corrente per Goal NNN
- `_01_PROMPT_<NNN>_<slug>.md` — PROMPT da Cowork a CLI (input)
- `_02_PLAN_<NNN>_<slug>.md` — PLAN da CLI (output, Cowork approva)
- `_02b_APPROVAL_<NNN>_<slug>.md` — APPROVAL signed by Cowork+Enzo (sha256 hash di PLAN)
- `_03_EXEC_<NNN>_<slug>.md` — EXEC log da CLI (execution trace)
- `_04_REPORT_<NNN>_<slug>.md` — REPORT finale da CLI
- `_05_REVIEW_<NNN>_<slug>.md` — REVIEW da Cowork (pass/fail/iterate)
- `_99_archive_<NNN>_<slug>.md` — archive

### Inbox (`.inbox/`)

- `.inbox/cowork/pending/` — message Cowork ha mandato a CLI, CLI legge poi sposta a `read/`
- `.inbox/cli/pending/` — message CLI ha mandato a Cowork
- Naming: `YYYY-MM-DDTHH-MM-SSZ__<NNN>__<msg_type>.md`
- Halt notify: `<TS>__<NNN>__halt_<reason>.md`
- Progress / prompt-ready / report-ready / approval-ready / exec-directive
- `read_at` field deve essere popolato quando spostato a `read/` (validator check)

### Pre-commit hook validator

`.git/hooks/pre-commit` esegue `scripts/cowork-exchange/validate-naming.mjs` in **warn-only mode** (default). Set `COWORK_EXCHANGE_STRICT=1` per fail commits su errors.

Validator controlli:
- File naming nonconformant
- Goal con REPORT ma no EXEC
- Goal con APPROVAL sha256 che NON matcha PLAN files presenti
- Goal con STATE.current_phase=CLOSED_PENDING_STRATEGIC_PIVOT ma no file CLOSED present
- Inbox message in `read/` ma `read_at` null

### Scripts gestione

```bash
pnpm cowork:status               # snapshot stato Goals
pnpm cowork:validate             # validator warn-only
pnpm cowork:validate:strict      # validator strict (fail su errors)
pnpm cowork:new-goal             # bootstrap nuovo Goal
pnpm cowork:install-hooks        # installa pre-commit hook
pnpm cowork:session-start        # apertura sessione
pnpm cowork:session-end          # chiusura sessione
pnpm cowork:inbox                # lista inbox
pnpm cowork:inbox:rebuild        # rebuild INDEX.md
pnpm cowork:notify               # send message
pnpm cowork:acquire-lock         # acquire Goal lock
pnpm cowork:release-lock         # release
pnpm cowork:check-locks          # check active locks
pnpm cowork:apply-pending        # apply pending Cowork→CLI changes
```

### PROMPT canonici sequencing recenti

| Goal | Slug | Status |
|---|---|---|
| 020 | batch_x16 | PROMPT + REPORT (X16 MVP-2a closure) |
| 021 | batch_x17 | PROMPT + REPORT |
| 022 | batch_x18 (npm publish saga) | PROMPT + amendment x5 + REPORT (chiuso pragmatic) |
| 023 | batch_x19_brownfield_wave1 | PROMPT + REPORT |
| 024 | batch_x20_mfa_login_gating | PROMPT + REPORT |
| 025 | batch_x21_defer_f_showcase_fix | PROMPT only (HIGH-RISK, attiva richiesta) |
| 026 | batch_x19a_dependabot_cve | PROMPT + REPORT |
| **027** | **s937_ck8_sdbi_phase2_kickoff** | **PROMPT only** (S937 CK-8, emesso 2026-05-26 — vedi §17) |

---

## §16 — Pendings carry-over post-S937

### CK-1..6 (housekeeping non chiuso S937)

| ID | Effort | Status | Note |
|---|---|---|---|
| **CK-1** SSH agent persistent setup | ~30-45 min (manual launch user) | **PARTIAL** | Config audited ✓, service Running+Automatic ✓, helper script ready. **BLOCKER R23/iii**: passphrase entry interattiva. Vedi §19. |
| **CK-2** OCI VM runner registration | ~1-2h interactive on VM | **BLOCKED-BY-CK-1** | Procedura `docs/ci/self-hosted-runners-setup.md` §3 (9 step). Pre-req SSH agent loaded. |
| **CK-3** CW-B60-A live re-run validation | ~30 min | **BLOCKED-BY-CK-1** | Target `sys_skill_categories` (32 staging rows smallest). Acceptance: ≥1 audit row `rule_code='SILENT_UPSERT_ZERO_ROWS_V1'`. |
| **CK-4** CW-B59 bisect v2 | 1-2h (Path A) o 4-6h (Path F fallback) | **DONE** script shipped (`b55ffe8`); EXECUTION deferred | Long-running, ideale CLI delegation. Path G overrides già attivi (root package.json `pnpm.overrides` react/react-dom 19.2.5). Pre-req: restore showcase routes + pnpm install pulito. |
| **CK-5** user_preferences clean verify | DONE | **CLOSED** | Length 9192 ~ file canonico 9236 (newline normalization), v5 version match, no duplicati MANDATORY_*. Layer 1 Cowork claude.ai OK. |
| **CK-6** CI primo run smoke post-runner | ~30 min | **BLOCKED-BY-CK-2** | No-op commit + `gh run list --limit 6` + `gh run watch <RUN_ID>`. |

### Pre-flight residual (from S933 PREFLIGHT_REPORT §4)

Da `docs/preflight-residual-todo.md`:

- **CLOSED S935 D**: CODE-2 (api dead scripts), CODE-3 (Tailwind 4 `@source` portable), CODE-7 (web dead vitest test).
- **CODE-5**: `_disabled_showcase_X18/` ancora on disk; auto-resolved by Path G success o hard-delete fallback (30 min) se Path F split.
- **CODE-10**: i18n discovery + locales extension. Approach in todo §2.3. Effort 2-4h post-MVP-4.
- **CODE-6**: queries.ts 47 routes refactor — explicit OUT OF SCOPE (~10-15h architectural refactor, beneficia testability non user-facing, alto rischio regressione).

### Dependabot

Stato pre-S935: 72 → 5 alerts (post triage Fase 1+2 + S935 E + S935 X19.A CVE).

- 0 critical, 0 low
- 2 high (next Middleware bypass — attende 15.6+)
- 3 medium (postcss / vite / esbuild dev-chain only)

Triage doc: `docs/github/dependabot-triage-2026-05-26.md` (4-bucket matrix MERGE_NOW/MERGE_BATCH/DEFER_MAJOR/CLOSE_DUPLICATE).

### skills:131 fail pre-esistente

`apps/api/test/skills.integration.test.ts:131` — createdSkillIds list visibility. Pre-esistente da X19.A, NON correlato uuid CVE fix, NON correlato MVP-4 work. Effort fix: ~30-60 min. Non-blocking. Da affrontare in QA validation sessione (~3-5h totali con altri residual).

### DEFER-F /showcase

`/showcase` static deploy + admin /showcase routes attualmente in `apps/web/src/_disabled_showcase_X18/`. PROMPT 025 emesso S935-C ma EXECUTION non avviata. Restore via `scripts/restore-showcase-routes.ps1` (S935 phase C). Decision: PROMPT 025 da rivedere con Path F (split @heuresys/ui in 3 sub-packages) se CK-4 bisect inconclusive.

---

## §17 — MVP-4 active stream: 2.4 SDBI Phase 2 (PROMPT 027 ready)

**Decision authority Enzo** (S937 CK-8 AskUserQuestion 2026-05-26 18:37 GMT+2): **stream 2.4 SDBI Phase 2** selected from `docs/MVP_4_ROADMAP.md` §2.4.

### PROMPT 027 emesso

File: `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` (8187B verified, commit `418e9b3` on origin/main).

### Scope ridotto sessione 1 (kickoff, ~6-10h CLI)

1. **ADR-0014 PROPOSED → ACCEPTED** (Cowork edit + Enzo sign-off note inline, atomic decision)
2. **Migration 000034 (temp_sdbi schema) + 000035 (lineage SDBI columns extension)** — NB: 000035 era gap cosmetic, ora va effettivamente creato come migration; ADR-0014 §4.2/§4.3 ha gli spec
3. **Audit rule_codes SDBI family** — extend `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` con ~10-15 SDBI rule_codes da ADR-0014 §3.8
4. **SDBI runbook scaffold** — crea `docs/sdbi/RUNBOOK.md` con TOC + Phase A-F template + pilot PerformanceReviews esempio
5. **Pilot macro-area = PerformanceReviews** — Phase A authoring (Cowork-side, fuori scope CLI in sessione 1; CLI sets up infrastruttura per ricevere card in sessione 2)

### Acceptance sessione 1

1. ADR-0014 status = ACCEPTED (Cowork ship + Enzo sign-off)
2. Migration 000034 + 000035 applied + `pnpm db:validate` twice-run green
3. SDBI audit rule_codes shipped in `audit-rule-codes.ts` (compile + lint clean)
4. `docs/sdbi/RUNBOOK.md` scaffold committed
5. PROMPT 027 chiuso con `_04_REPORT_027_*.md`
6. Test suite globale: ≥ baseline (no regression — 341 PASS + 1 pre-esistente skills:131)
7. NO push autonomo (Enzo gate finale push)

### Scope full stream 2.4 (multi-session, 75-125h = 3-5 focused-weeks)

7-8 macro-aree HRMS con target schema MISSING in `sys.*`:

| # | Macro-area | Status | Effort |
|---|---|---|---|
| 1 | **PerformanceReviews** (4-tier multi-rater) | IN scope — pilot consigliato | 8-10h |
| 2 | **Surveys/Engagement** (PULSAR cluster mid-overlap Wave 4) | IN scope | 7-9h |
| 3 | **Feedback** (peer 360, mentorship loops) | IN scope | 7-8h |
| 4 | **Mentorship** (pairing + sessions evidence) | IN scope | 7-8h |
| 5 | **PredictionsML** (churn / promotion-readiness scores) | IN scope | 8-10h |
| 6 | **Compensation** history (bands già coperti) | IN scope incremental | 7-9h |
| 7 | **Documents** (metadata only, URI ref, no binaries) | IN scope | 7-8h |
| 8 | **TalentPool** (cross-tenant succession candidates) | IN scope | 7-8h |
| 9 | RecruitingHiring | **OUT-of-scope I8** — marker only | <1h |
| 10 | Onboarding | **OUT-of-scope I8** — marker only | <1h |

Goals/OKRs + Time/Leave **già shipped** Phase 1 pilot X2 — usare come referenza pattern.

### Workflow SDBI 6-fase (per macro-area)

- **Phase A** Mapping_card authoring (**Cowork** Cowork analizza brownfield + emette `cowork_reserved/sdbi_mapping_cards/<macro_area>_card.md` con target sys.* schema DDL + column mappings + transform codes + AI confidence HIGH/MEDIUM/LOW per mapping; Enzo reviews + signs)
- **Phase B** Migration sys.<target> (**CLI** crea migration nuova `db/migrations/000<NN>_sdbi_<macro_area>_target.sql` idempotente; `pnpm db:migrate` su VM OCI tunnel 5433)
- **Phase C** temp_sdbi staging (**CLI** popola `temp_sdbi.<macro_area>` via SDBI extractor lexicon+AI; verify rowcount + sample)
- **Phase D** Consolidation (**CLI** esegue SDBI consolidator script — `apps/api/src/modules/sdbi-consolidator/` se esiste o da creare in pilot Phase A; output rows in `sys.<target>` + lineage in `sys.sys_source_lineage_records`)
- **Phase E** Audit + verify (**CLI** audit rule_codes SDBI family; count source-vs-target + acceptance threshold da card; cleanup `temp_sdbi.<macro_area>`)
- **Phase F** REPORT + REVIEW (CLI emette `_04_REPORT_<NNN>_<macro_area>.md`; Cowork emette `_05_REVIEW_<NNN>_<macro_area>.md` + pass/fail/iterate)

### Halt protocol PROMPT 027

| Scenario | File halt notify |
|---|---|
| ADR-0014 non ACCEPTED al pre-flight | `.inbox/cowork/pending/<TS>__027__halt_adr_0014_not_accepted.md` |
| Migration apply fallisce o non idempotente | `<TS>__027__halt_migration_apply_fail.md` |
| SSH tunnel down post pre-flight | `<TS>__027__halt_ssh_tunnel_lost.md` (3 retry prima di halt) |
| Audit rule_codes typecheck/lint failure | fix in-loop (R3 correggere ogni errore), NO halt |

### Altre 8 stream MVP-4 (out-of-scope sessione corrente, riferimento per future decisions)

Da `docs/MVP_4_ROADMAP.md` §2.1-2.9 + §0 TL;DR:

| Stream | Effort | Status priority |
|---|---|---|
| 2.1 Wave 2 brownfield (RTL_BANK_REFERENCE operating model) | 1.5-3 sett (37-75h) | Pre-req: CW-B60-A live validation (CK-3) |
| 2.2 Wave 3 | TBD | Post Wave 2 |
| 2.3 Wave 4 | TBD | Post Wave 3 |
| 2.4 **SDBI Phase 2** | 3-5 sett (75-125h) | **ACTIVE (PROMPT 027)** |
| 2.5 MFA multi-kind hardening (WebAuthn/FIDO2 + backup codes + admin lifecycle) | 2-3 sett | Security consolida post Tappa E TOTP |
| 2.6 Visualization renderers (React Flow + Mermaid + Dagre/ELK) | TBD | Post-completion bisect |
| 2.7 Mobile responsive + WCAG tail items | 2-4 sett | UX completion |
| 2.8 OCI Managed migration prep (Option C ADR-0010) | Late-MVP-4 | Production cutover prep |
| 2.9 `@spen-zosky/ui` npm publish path | TBD | Già done as `@heuresys/ui` 0.1.1 |

Acceptance globale MVP-4: 9 stream chiusi al loro acceptance locale OR esplicitamente deferred a MVP-5 con ADR di defer + test suite ≥ baseline + Playwright ≥ baseline + `pnpm db:validate` twice-run idempotency green + tag `v0.4.0-mvp4-complete` + release notes + HANDOFF aggiornato + no CW-B* aperto al merge finale.

---

## §18 — Vincoli operativi R1-R23 cross-tool + project specifics

Source: SoT `C:\Users\enzospenuso\.claude\CLAUDE.md` (R1-R23) + project `D:\heuresys-advanced\CLAUDE.md` (project-level R23 enforcement).

### Regole base R1-R17 (SoT v3 2026-04-22 slim)

| ID | Regola sintetica |
|---|---|
| **R1** PENSA PRIMA, AGISCI DOPO | Piano in 2 frasi. "Modo più semplice?". Mai >3 step per task semplice. Bulk copy Windows → robocopy/xcopy one-liner. |
| **R2** ISTRUZIONI ALLA LETTERA | "Completo" = ogni file. "Tutti" = tutti. No reinterpretazione, no sostituire metodo, no campionamento quando si chiede completezza. |
| **R3** CORREGGERE OGNI ERRORE | tsc/eslint/jest/build fail → fix TUTTI. No "pre-esistente", no "non introdotto da me". |
| **R4** ACCOUNTABILITY | Errore → riconoscere diretto + correttivo concreto. NO giustificazioni accademiche. |
| **R5** TEST-BEFORE-CLAIM | Mai "non posso X" senza verified-by: comando + output + path + timestamp. |
| **R6** NO-DELEGA SE HAI TOOL | Tool loaded per X → uso io. NO chiedere utente manualmente. Eccezioni: tool inesistente, decisione umana, op distruttiva supervisionata. |
| **R7** SANDBOX-TRANSIENT / WORKSPACE-PERSISTENT | `/sessions/<id>/` effimera. `/sessions/*/mnt/<Progetto>/` persistente. Sandbox produce, workspace custodisce. |
| **R8** TOOL INVENTORY A BOOTSTRAP | Turn #1: carica via ToolSearch deferred tools PRIMA di operare. |
| **R9** EFFICIENZA OPERATIVA / TOKEN HYGIENE | No re-read file in context, parallel tool calls indipendenti, prefer Grep/Glob a Read per localizzare, Read con offset/length per sezioni grandi, no duplicare output tool nella narrazione. |
| **R10** GESTIONE INCERTEZZA / NO-HALLUCINATION | "Non lo so, verifico" + check. MAI inventare path/version/flag. Se check impossibile → dichiarare "non verificato". |
| **R11** SECRET HYGIENE | MAI loggare password/SSH key content/API token/JWT/connection string/PAT/OpenAI key. File `.env` o `.ssh/<key>` → struttura/lista nomi only. Pre-commit grep secret patterns. Segret in history → segnalare prima di push. |
| **R12** GIT SAFETY CROSS-PROJECT | NO `--force` su main, NO `--reset --hard` senza prevenire WIP loss, NO `checkout .` / `restore .` senza conferma, NO `--amend` su commit pushato, NO `--no-verify`, prefer new commit a fix-up. |
| **R13** STRATEGIA MULTI-TOOL / DELEGA SUBAGENT | Task atomico noto → tool diretto. Esplorazione codebase non guidata → Agent Explore. Multi-step con artefatti → Agent general-purpose. Planning → Agent Plan. Verifica indipendente → Agent review. Brief subagent con file:line, numeri, diff — NO "based on findings". |
| **R14** ANTI-BIAS COGNITIVI | Cerca contro-evidenza prima ipotesi. No anchoring primo file. Esplorazione >30min senza convergenza → STOP riporta. 2+ fallimenti same direction → cambia approccio. |
| **R15** OCCHIO PER L'AUTOMAZIONE | Pattern ripetuto >2 volte → propor automation (script/skill/alias/hook/plugin). Segnala, non implementa autonomy. |
| **R16** POWERSHELL 5.1 ROBUSTO Windows | Path assoluti binari, NO `-ArgumentList @()` con stringhe (singola quoted), `cmd.exe` NON in PATH, NO funzioni 1-2 char (collidono con alias built-in `H`/`R`/`ls`/ecc.). Min 3+ caratteri (Log/Hdr/Sec/Out/Info). Encoding ASCII NoNewline per config critici (sshd_config). |
| **R17** SCRIPTS WORKSPACE-LEVEL LOCATION Windows | Script NON-progetto-specifici → `C:\Users\enzospenuso\Claude Desktop\scripts\`. Script project → `<progetto>\scripts\`. |

### R20-R23 (additions post-S935+S936, vincolanti)

| ID | Regola |
|---|---|
| **R20** FEASIBILITY 5-Q | Prima di "non eseguibile" applica 5 criteri: Grep concreto / token budget / pattern repetitivity / test coverage / risk register. Mai opinione travestita da valutazione. |
| **R22** DELEGA DECISIONALE CLASSE A/B | (DECISION AUTHORITY blocco) — Cowork formula proposte evidence-based con budget+rischi. Decision authority Enzo per chiusura/interruzione. Delega su stato stale = non vincolante, re-confermare su baseline corretta. |
| **R23** AUTONOMIA OPERATIVA TOOL-PROATTIVA | (a) Zero delega evitabile. Eccezioni: (i) PROHIBITED action (banking, malicious, weapons, child safety), (ii) op distruttiva irreversibile macchina (rm -rf system, push --force tag pubblici, drop DB prod, format disk), (iii) mancanza tecnica accertata (stdin interattivo passphrase non passabile via MCP, browser captcha, physical hardware). (b) Proactive tool loading (filesystem Windows → Windows-MCP/Desktop Commander/Filesystem; git → Windows-MCP PowerShell; browser → Claude in Chrome; GitHub → gh CLI; cross-repo refactor → Desktop Commander start_search + edit_block; Windows UI → Windows-MCP Click/Type/Snapshot/Shortcut/Clipboard). (c) Self-diagnose fallback: diagnosi → workaround → escalate SOLO se tutti workaround esauriti con messaggio specifico. (d) No user-executable instructions when autonomously executable. (e) Evidence not suggestion: mostra output reale (git output, log, screenshot, diff, contenuto file). |

### Project-level enforcement (CLAUDE.md heuresys-advanced)

- **Tool primari**: edits codice/test/migration → Filesystem MCP o Desktop Commander `edit_block` (real disk) preferiti per file >900B, Windows-MCP PowerShell fallback. Bash sandbox solo logica/calcolo non-stateful. Git → Windows-MCP PowerShell (`.git/index.lock` può non rimuoversi dal sandbox mount).
- **Push autorizzazione**: una volta autorizzata in sessione, vale fino a revoca. Nuova sessione = default "ask" (S937 ha ereditato da S935+S936; S938 default ask).
- **CI workflow + runner**: CI rossa = errore Claude DEVE correggere (R3), NON delegare. Consultare via `gh run list` + `gh run watch`.
- **Live re-run + DB queries**: prima `Test-NetConnection localhost -Port 5433`. Se down → fallback documentato.
- **Test verification level**: vitest test files con mocked pool sono sufficienti come unit verification per R3 closure observability fix. Live DB validation è "belt-and-suspenders" non-blocking quando unit-tested verde.

### Commit/push policy heuresys-advanced specifica

- **Commit local su `main`**: pre-autorizzati per heuresys-advanced (vedi `memory/feedback_full_autonomy.md` storico).
- **`git push`**: solo se Enzo lo richiede esplicitamente. Eredita autonomia su sessione corrente se concessa, default "ask" su nuova sessione.
- Commit prefix style: `feat(api): MVP-1 5.1.X — <module> (...)`, `chore(db): seed — ...`, `docs(handoff): ...`, `test(api): ...`, `fix(scripts): ...`. Atomic per modulo, non split.
- NEVER `--force`, `--no-verify`, `--amend` su pushato (R12).

---

## §19 — SSH passphrase blocker (eccezione R23/iii)

### Stato verified 2026-05-26 S937

- ssh-agent service Windows: **Running + Automatic** ✓
- `~/.ssh/config` `Host *`: `AddKeysToAgent yes` + `IdentitiesOnly yes` ✓
- Chiave `oci_recovery_ed25519` esiste ✓
- Agent: **VUOTO** post-reboot (passphrase mai inserita)

### Tentativi automation S937 (tutti falliti)

1. `Start-Process powershell -WindowStyle Normal -Wait`: finestra apre+chiude <2s.
2. `cmd.exe /K <ssh-add>`: finestra appare focused (taskbar "Attenzione richiesta") ma chiude pre-input.
3. Helper `.ps1` con `Read-Host` finale: PID disappears within seconds.

Root cause: MCP SessionId=1 (stessa console Enzo) ma le finestre spawn-ate via Start-Process non ereditano interactive token correttamente. Documented in `bias_registry.md` CW-B62.

### Mitigation (eccezione R23/iii canonical)

**Helper script workspace-level (R17)**:
`C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1`

**Manual launch obbligatorio da shell aperta a mano** (NON via MCP):

```powershell
# Apri PowerShell o Windows Terminal manualmente (Start Menu → PowerShell)
& 'C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1'
# Digita passphrase di oci_recovery_ed25519 quando appare il prompt
# Verifica finale:
ssh-add -l
# Expected: nnnn SHA256:... oci_recovery_ed25519 (ED25519)
ssh -o BatchMode=yes oracle-vm-default 'echo OK && hostname && date -u'
# Expected: OK + hostname + UTC timestamp
```

Una volta `ssh-add -l` mostra ED25519 cached, **tutte le SSH ops** sono unlocked: tunnel `ssh -fN -L 5433:localhost:5432 oracle-vm-default`, `ssh oracle-vm-default <cmd>`, scp, ecc.

### Alternative documentate (security trade-off, richiedono ADR)

| Opzione | Trade-off | Reusability |
|---|---|---|
| ssh-agent registry persistent + auto-load startup | Bassa: prompt una volta per power-cycle. | Alta. |
| Service-account key dedicata no-passphrase | Media: key su disco non protetta, scope-limited a CI/automation. | Alta. |
| Conversione chiave OCI a no-passphrase | Bassa: security degradation. | Alta. |

Default attuale: opzione C (interactive ssh-add una volta per sessione Windows). Switch a A o B richiederebbe ADR-0021 + script setup.

### Conseguenze CLI lato VM

Su `oracle-vm-default` Claude Code CLI **già installato e configurato** (no SSH passphrase issue lato VM). Quindi:
- CLI può girare **direttamente sulla VM** via SSH session aperta da Enzo (una volta SSH up Windows lato).
- CLI può anche girare lato Windows host (`D:\heuresys-advanced\`) — la maggior parte dei task non richiede SSH per essere eseguita (typecheck/lint/build/vitest mock funzionano local; ONLY live DB integration tests + brownfield Wave run richiedono tunnel up).

---

## §20 — Critical commands cheat sheet

### Repo navigation + git

```bash
cd /d/heuresys-advanced
git status -sb
git log --oneline -10
git diff --stat
git diff --cached --stat
git fetch --all --tags
git pull --ff-only origin main
# (push solo se Enzo autorizza esplicitamente in sessione corrente)
```

### Workspace install + run

```bash
pnpm install --frozen-lockfile
pnpm install                       # se lock changes attesi
pnpm dev                           # all workspaces parallel
cd apps/api && pnpm dev            # API solo (port 3001)
cd apps/web && pnpm dev            # web solo (port 3000)
pnpm build                         # all workspaces
pnpm typecheck                     # all workspaces
pnpm lint                          # all workspaces
pnpm test                          # all workspaces
```

### Test (con tunnel up)

```bash
cd apps/api
pnpm exec vitest run                                    # full suite
pnpm exec vitest run test/<name>.integration.test.ts    # single file
pnpm exec vitest run -t "<test name pattern>"           # by name pattern
pnpm typecheck:test                                     # tsconfig.test.json

cd apps/web
pnpm typecheck
pnpm test:e2e                                           # Playwright full
pnpm exec playwright test <spec>.spec.ts                # single spec
pnpm exec playwright test --workers=1 --headed         # debug
```

### DB ops

```bash
pnpm db:create                     # PowerShell (Windows)
pnpm db:create:sh                  # bash (Mac/VM)
pnpm db:migrate
pnpm db:migrate:sh
pnpm db:reset                      # DESTRUCTIVE — ask user
pnpm db:validate                   # 7 views check
pnpm db:seed                       # RTL_BANK_REFERENCE
pnpm db:seed-test-admin            # 5 test personas

# psql direct
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT now()"
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

### SSH ops

```bash
ssh-add -l                                                 # list cached identities
ssh-add ~/.ssh/oci_recovery_ed25519                        # interactive prompt (manual launch from open shell)
ssh -fN -L 5433:localhost:5432 oracle-vm-default           # tunnel background
ssh oracle-vm-default 'cmd'                                # one-off remote
ssh oracle-vm-default                                       # interactive session
```

### Cowork exchange

```bash
pnpm cowork:status
pnpm cowork:validate
pnpm cowork:validate:strict        # fail on errors
pnpm cowork:inbox
pnpm cowork:check-locks
```

### GitHub gh CLI

```bash
gh repo view Spen-Zosky/heuresys-advanced
gh run list --limit 6
gh run watch <RUN_ID>
gh workflow run typecheck.yml
gh api "/repos/Spen-Zosky/heuresys-advanced/branches/main/protection"
```

### Quick file ops Windows (via PowerShell)

```powershell
Set-Location 'D:\heuresys-advanced'
Get-ChildItem -Recurse -Filter '*.ts' | Measure-Object
Get-Content -Path '<file>' -TotalCount 50
Select-String -Path '<file>' -Pattern '<regex>' -Context 2,2
```

---

## §21 — File reference index (paths assoluti)

### Documenti planning canonical (read OBBLIGATORI prima di task complessi)

| File | Scope |
|---|---|
| `D:\heuresys-advanced\CLAUDE.md` | Project-level rules + R23 enforcement + LIVE DATA E2E doctrine + Design System @heuresys/ui (post-X18) |
| `C:\Users\enzospenuso\.claude\CLAUDE.md` | SoT operativa cross-tool R1-R23 (NB: snapshot Cowork può essere vecchia R1-R17, file Windows è la versione viva) |
| `D:\heuresys-advanced\HANDOFF.md` | Top-level reverse-chrono session history (S937 in top, scendi per S936/S935/S934/S933/X20/X19/X18/...) |
| `D:\heuresys-advanced\.handoff\STATE.md` | Machine-readable state snapshot (S937 partial in top) |
| `D:\heuresys-advanced\START_HERE.md` | Entry point storico (MVP-0 era, valido per priming 7-file canonical) |
| `D:\heuresys-advanced\NEXT_SESSION_MVP_2A.md` | Doctrine MVP-2a/2b LIVE DATA E2E (419 righe) |
| `D:\heuresys-advanced\NEXT_SESSION_MVP_CLOSURE.md` | Plan operativo chiusura MVP-2a/2b (537 righe) |
| `D:\heuresys-advanced\sessioni\session_2026-05-26_s937_housekeeping\NEXT_SESSION_START.md` | Piano S937 housekeeping + 6 carry-over CK |
| `D:\heuresys-advanced\sessioni\session_2026-05-26_s937_housekeeping\S937_SESSION_REPORT.md` | Report finale S937 (4/8 closed + 1 partial + 3 blocked) |
| `D:\heuresys-advanced\cowork_reserved\HANDOFF_FRESH_SESSION.md` | §0bis (S934) + §0ter (S935) outcome + carry-over |
| `D:\heuresys-advanced\cowork_reserved\bias_registry.md` | SoT 61 bias cross-batch + protocollo race claim |
| `D:\heuresys-advanced\qa_artifacts\s936_outcome_summary.md` | S936 follow-up outcomes (6 task) |
| `D:\heuresys-advanced\sessioni\session_2026-05-26_s935\S935_SESSION_REPORT.md` | S935 full report B/C/E/F/D/Z sequence |

### Documenti tecnici canonical

| File | Scope |
|---|---|
| `D:\heuresys-advanced\docs\BOOTSTRAP_EXECUTION_PLAN.md` | Overview top-level + 14 invarianti §2 + 11 ADR §3 + MVP-0/1/2 roadmap §5 + decision log RD-01..24 §9 |
| `D:\heuresys-advanced\docs\architecture\ADR_INDEX.md` | Registry 20 ADR |
| `D:\heuresys-advanced\docs\architecture\adr\0014_sdbi_semantic_driven_brownfield_import.md` | SDBI paradigm (20091B) — Status PROPOSED da portare ad ACCEPTED |
| `D:\heuresys-advanced\docs\db\TARGET_SCHEMA_DESIGN.md` | ~123 sys + 10 views + 10 aux con DDL outline |
| `D:\heuresys-advanced\docs\db\MIGRATION_IMPLEMENTATION_PLAN.md` | 27 migrations spec (pre-S935; 43 attuali) |
| `D:\heuresys-advanced\docs\security\AUTH_SECURITY_PLAN.md` | 11 auth tables + Argon2id + CSRF + 100 perms + ESS self-scope §6.1 |
| `D:\heuresys-advanced\docs\api\API_IMPLEMENTATION_PLAN.md` | Fastify 5 + 58 moduli + 272 endpoint + me/ §6.5 |
| `D:\heuresys-advanced\docs\frontend\FRONTEND_IMPLEMENTATION_PLAN.md` | Next 15 App Router + ESS portal MVP-2b + §11 routes inventory + §11.2 landing redirect role |
| `D:\heuresys-advanced\docs\MVP_4_ROADMAP.md` | 9 streams MVP-4 (effort + acceptance + risks) |
| `D:\heuresys-advanced\docs\cw-b59-true-root-cause-2026-05-26.md` | Path G/A/F strategy + analisi forensic empirical iter 12 |
| `D:\heuresys-advanced\docs\ci\self-hosted-runners-setup.md` | OCI VM runner registration §3 (9 step) |
| `D:\heuresys-advanced\docs\ci\workflows-overview.md` | Inventory 7 workflow + scoping + failure handling |
| `D:\heuresys-advanced\docs\github\branch-protection.md` | Canonical rules main + apply script gh CLI |
| `D:\heuresys-advanced\docs\github\dependabot-triage-2026-05-26.md` | 4-bucket matrix MERGE_NOW/MERGE_BATCH/DEFER_MAJOR/CLOSE_DUPLICATE |
| `D:\heuresys-advanced\docs\preflight-residual-todo.md` | CODE-5/CODE-10/CODE-6 status + verification commands |
| `D:\heuresys-advanced\docs\brownfield\WAVE_1_EXECUTION_RUNBOOK.md` | Wave 1 procedure |
| `D:\heuresys-advanced\docs\brownfield\BROWNFIELD_IMPORT_PLAN.md` | 4-wave canonical pointer |

### Scripts critici

| File | Scope |
|---|---|
| `D:\heuresys-advanced\scripts\bisect-cw-b59-createctx.ps1` | CW-B59 Path A revised v2 bisect (S937 CK-4 v2 regex `Class extends\|createContext`) |
| `D:\heuresys-advanced\scripts\restore-showcase-routes.ps1` | Restore `_disabled_showcase_X18` → `app/showcase` pre-bisect |
| `C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1` | Helper ssh-add launch (eccezione R23/iii, R17 workspace-level) |
| `C:\Users\enzospenuso\Claude Desktop\scripts\session-bootstrap.ps1` | Bootstrap canonical Cowork session (CLI tramite SessionStart hook ~/.claude/settings.json) |
| `D:\heuresys-advanced\db\scripts\migrate.ps1` / `migrate.sh` | DB migrations runner |
| `D:\heuresys-advanced\db\scripts\seed-test-admin.ts` | 5 test personas seed |
| `D:\heuresys-advanced\db\scripts\seed-reference-bank.ts` | RTL_BANK_REFERENCE 158 personas seed |
| `D:\heuresys-advanced\db\scripts\extract-wave1-legacy.sh` | Wave 1 brownfield SSH extract |
| `D:\heuresys-advanced\apps\web\scripts\check-i18n-parity.ts` | i18n it/en parity validator |

### Cowork exchange

| Path | Scope |
|---|---|
| `D:\heuresys-advanced\cowork_code_exchange\` | PROMPT/PLAN/EXEC/REPORT/REVIEW protocol files |
| `D:\heuresys-advanced\cowork_code_exchange\_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` | **PROMPT 027 ACTIVE** (S937 CK-8 emesso) |
| `D:\heuresys-advanced\cowork_code_exchange\.inbox\cowork\pending\` | Cowork → CLI message inbox |
| `D:\heuresys-advanced\cowork_code_exchange\.inbox\cli\pending\` | CLI → Cowork message inbox |
| `D:\heuresys-advanced\cowork_reserved\` | KB Cowork internal (bias_registry, batch archive, auto-ship) |
| `D:\heuresys-advanced\sessioni\` | Per-session artifacts (forensic, S933-S937) |

---

## §22 — Next actions priority queue per CLI

### Immediate (next session entry-point)

1. **Verify SSH** — `ssh-add -l`. Se vuoto → CK-1 ancora pending (Enzo deve fare manual launch helper script). NON proseguire con CK-2/3/6 finché SSH up. Tunnel `ssh -fN -L 5433:localhost:5432 oracle-vm-default` deve listening.

2. **Apri PROMPT 027** — `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md`. Leggere integralmente. Eseguire §0 pre-flight. Procedere §3 sequenza CLI sessione 1 (ADR-0014 ACCEPTED + mig 000034/000035 + audit codes + runbook scaffold + pilot setup).

3. **Concurrente** (se SSH up): CK-2 OCI VM runner registration (`docs/ci/self-hosted-runners-setup.md` §3) + CK-3 CW-B60-A live re-run validation (target `sys_skill_categories` smallest, verifica audit `SILENT_UPSERT_ZERO_ROWS_V1` count > 0) + CK-6 CI primo run smoke (no-op commit + `gh run watch`).

### Secondary (post SDBI Phase 2 sessione 1)

4. **CW-B59 bisect execution** — long-running task (1.5-2h Path A o 4-6h Path F). Script v2 ready (`scripts/bisect-cw-b59-createctx.ps1`). Pre-req: restore showcase + pnpm install pulito + Path G overrides attivi. R14 time-box 60-90min Path A → se inconclusive switch Path F.

5. **DEFER-F /showcase restore** — post CW-B59 fixed, restore `apps/web/src/_disabled_showcase_X18/` → `apps/web/src/app/showcase/` via script. Rimuovi tsconfig.json exclude. CODE-5 auto-resolved.

6. **MVP-4 stream 2.4 sessioni 2+** — Phase A-F end-to-end per pilot PerformanceReviews; lessons learned → template per altre 6-7 macro-aree. Multi-session 75-125h.

### Tertiary (cleanup pre-MVP-4 closure)

7. **skills:131 fix** — `apps/api/test/skills.integration.test.ts:131` createdSkillIds list visibility. ~30-60min.

8. **CODE-10 i18n discovery** — post MVP-4 streams surface stabilization. ~2-4h.

9. **Dependabot remaining 5 alerts** — 2 high (Next Middleware bypass attende 15.6+) + 3 medium (postcss/vite/esbuild dev-chain only). Triage in batch quando 15.6 disponibile.

10. **OCI Managed migration prep** (stream 2.8 MVP-4) — Late-MVP-4 timing.

### Tag schedule

- `v0.4.1-housekeeping-closed`: post CK-1/2/3/6 complete (probabilmente S938+).
- `v0.4.0-mvp4-complete`: post 9 stream MVP-4 chiusi (multi-session).

---

## §23 — Halt protocol + escalation

### Quando CLI deve fermarsi e mandare halt notify

1. **Pre-requisito violato**: SSH down dopo pre-flight, tunnel non listening, DB unreachable, pnpm install fail, working tree non clean inaspettato.
2. **Invariante violata**: nuovo requirement conflitta con I1-I14 / RD-08 / RD-09. **STOP e chiedere a Enzo via halt notify**, NON workaround.
3. **Op distruttiva irreversibile**: rm -rf system, push --force tag pubblici, drop DB prod, format disk. **MAI eseguire**, escalate.
4. **Test fail unresolvable**: tsc/eslint/jest/build fail su path che NON è correlato al cambio (R3 dice fix anyway, ma se >2 tentativi same direction → halt R14).
5. **Op che richiede passphrase / browser captcha / physical hardware**: eccezione R23/iii canonical, halt + delegate.

### Format halt notify

File: `cowork_code_exchange/.inbox/cowork/pending/<TS>__<NNN>__halt_<reason>.md`

Naming convenzione:
- TS: `YYYY-MM-DDTHH-MM-SSZ` (UTC ISO basic)
- NNN: Goal ID (es. 027 per SDBI Phase 2 kickoff)
- reason: snake_case breve (es. `adr_0014_not_accepted`, `ssh_tunnel_lost`, `migration_apply_fail`)

Content structure:
```markdown
# Halt notify — Goal NNN — <reason>

**Timestamp**: ISO UTC
**Originator**: CLI (or Cowork)
**Severity**: P0 / P1 / P2
**Halt condition**: <descrizione>

## §1 Pre-condition checked
- <step> → <outcome>
- ...

## §2 Verified-by evidence (R5)
- Comando: `<cmd>`
- Output: <output>
- Path: <abs path>
- Timestamp: <iso>

## §3 Why halt vs continue
<motivo: invariante, R23/iii eccezione, R12 git safety, op distruttiva, ecc.>

## §4 Proposed alternatives (R23/c self-diagnose)
1. <workaround tentato> → <esito>
2. ...

## §5 Decision request
<cosa serve da Cowork/Enzo per sbloccare>
```

Cowork riceve in `.inbox/cowork/pending/`, processa, sposta a `read/` con `read_at` populated, risponde via `_01_PROMPT_<NNN>_amendment.md` o re-direction.

### Escalation tree

- **CLI bloccato** → halt notify → Cowork received → Cowork analizza + propone fix → se decision authority Enzo (CLASSE A/B per R22) → AskUserQuestion Enzo.
- **Cowork bloccato** → richiesta esplicita a Enzo via chat con evidence-based proposal (budget + rischi + alternative).
- **Tool failure persistent (>3 tentativi)** → R14 anti-bias trigger → STOP + report a Enzo con messaggio specifico "ho tentato A,B,C; non risolvibile autonomamente perché [reason verificata]".

---

## §24 — Anti-bias warnings (patterns ricorrenti)

### Pattern memorizzati da catalogare prima di task affini

| Pattern | Bias ID | Memo |
|---|---|---|
| Spec staleness (acceptance criterion irraggiungibile per drift fra spec authoring e DB reality) | CW-B52 | Always **live-state pre-flight** in PROMPT authoring (grep concreti, count DB, status check). |
| Misdiagnosis via assumption gap (prescription senza empirical verify) | CW-B58 | Empirical test matrix > narrative diagnosis. Per bundle issues: `head -30 dist/index.mjs | grep '^import'` PRIMA di prescrivere external aggressive list. |
| Narrative-bias architecturale (caso CW-B59: "RSC bundle threshold" → reality React peer-dep) | CW-B59 | Re-read stack trace empirical. NOT trust "emergent property" narrative quando stack trace nominaffuse un identifier specifico (`d.createContext` minified). |
| Bisect contamination (bisect via export removal contamina apps/web typecheck) | CW-B59 | Bisect deve produrre **buildable** intermediate states. Stub replacement con `const X = null` cambia module shape, dist output diff, webpack chunking diff → bisect convergence broken. |
| Engine silent-skip (rowCount=0 senza log/audit) | CW-B17, CW-B60-A, CW-B61 | Ogni return path engine deve emettere observability: log + audit. **NO silent return**. |
| Race condition CW-B<N> claim Cowork↔CLI parallel | (no specific) | Read bias_registry → Next available → claim → commit. Pre-emit verification mandatory. |
| HANDOFF non aggiornato post-CLI batch → Cowork riparte stale | (lesson §6 HANDOFF_FRESH_SESSION) | Ogni batch CLI deve update HANDOFF_FRESH_SESSION.md §1+§2+§3 + .handoff/STATE.md nel §5 Block D, non solo STATE.md. |
| Burn-in `NEXT_PUBLIC_*` findstr in chunks = false-negative | (lesson §6) | Next.js inlines values, not names. Canonical burn-in = HTTP smoke su gated route. |
| PowerShell 5.1 quirks Windows | CW-NEW-PF-* + R16 | Path assoluti binari, NO `-ArgumentList @()` string array, alias collision 1-2 char functions (`H`/`R`/`ls`/...), encoding ASCII NoNewline per sshd_config. |
| MCP Windows SSH interactive automation gap | CW-B62 | Passphrase entry NON bypass-able via MCP. Eccezione R23/iii. Helper script + manual launch. |
| Dev-mode JIT jitter Playwright | CW-B54 | Acceptance suite contro `pnpm start` warm prod build, NON `pnpm dev`. |
| npm-publish-migration exports map subpath gap | CW-B55 | Pre-flight grep `@<pkgname>/` consumer scan obbligatorio prima di stripping exports. |
| npm publish pre-flight gap | CW-B56 | `npm whoami` insufficient; check `npm org ls <scope>`, `npm profile get tfa`, `~/.npmrc _authToken` GAT. |
| tsup outExtension config | CW-B58 | Per `"type": "module"` + manifest che ref `.mjs` serve `outExtension({format}) => js: format === "esm" ? ".mjs" : ".cjs"` in tsup.config. |

### Anti-bias time-box (R14)

- Esplorazione codebase > 30 min senza convergenza → STOP + report stato a Enzo per decisione direzione.
- 2+ tentativi falliti same direction → cambiare approccio.
- Bisect inconclusive dopo 5-10 iter sul axis nuovo → switch to architectural alternative (Path F).
- Sessioni Cowork > 60 turn → propor `/compact` o split sessione.

### Decision authority Enzo (R22)

CLASSE A (chiusura/interruzione): solo Enzo.
CLASSE B (delega su stato stale): non vincolante, re-confermare baseline corretta.

Cowork+CLI formulano proposte evidence-based con budget+rischi, NON veti.

---

## §25 — Sintesi finale (TL;DR per CLI veloce)

1. **HEAD** locale + origin/main = `14eb0dc`. Tag `v0.4.0a-s937-partial-checkpoint`. Sync 0/0. Working tree clean modulo 2 .bak.* + 1 TRIGGER_PROMPT.txt untracked tollerati.

2. **Stack**: Fastify 5.8.5 + Drizzle 0.45 + Zod 3.25 + pg 8.13 + Argon2id + JWT RS256 + Vitest 4. Next 15.5.18 + React 19.2.5 + Tailwind 4.3 + TanStack Query 5.62 + @heuresys/ui 0.1.1 (npm-published post-X18). PostgreSQL 16 native su OCI VM ARM64 (tunnel 5433). pnpm 9.15.

3. **API**: 58 moduli (~272 endpoint) in `apps/api/src/modules/`. 52 test files. Baseline storica 69/69 verde post-MVP-1; 341 passed/1 fail pre-esistente skills:131 post-MVP-3. Plugin chain Fastify 13-step FISSO. Pattern modulo 7-step mandatory. RBAC 388 mappings × 8 ruoli caricata a server start.

4. **Web**: 47 routes (1 login + 30 admin + 14 ESS + 1 system-health + 1 root). 20 Playwright spec, ~125 runtime `test()`. Coverage matrix 0 NONE post-X13. Doctrine LIVE DATA E2E ONLY (NO mock, NO stub, NO fixture, mandatory Playwright per pagina).

5. **DB**: 43 migration idempotent (gap 000035 cosmetic), 18 staging.wave1_*, 1271 column_mappings, ~60/134 sys.* populated.

6. **Auth**: 11 `sys.sys_auth_*` (I7), MFA TOTP RFC 6238, JWT RS256 15min + refresh 30d single-use rotation con replay detection, CSRF double-submit opt-in.

7. **CI**: 6 workflow self-hosted oci-vm shipped (typecheck/lint/i18n/test-integration/build-web/playwright-smoke) + 1 ubuntu-hosted (showcase). **Runner NON ancora registrato** (CK-2 S937 blocked-by-CK-1 SSH).

8. **Cowork↔CLI protocol v2.2**: `cowork_code_exchange/` con file naming canonical + inbox + pre-commit hook validator warn-only. **PROMPT 027 ACTIVE** per SDBI Phase 2 kickoff (Goal 027).

9. **Bias registry**: 61 catalogued / 43 mitigated / next CW-B63. CW-B59 architectural deferred (Path A v2 bisect script ready commit b55ffe8 OR Path F split @heuresys/ui).

10. **20 ADR registrate**. ADR-0014 SDBI **Proposed → da portare ACCEPTED** in PROMPT 027.

11. **Invarianti I1-I14 + RD-08/09** non-negotiable. I5 NO RLS. I13 NO Docker. RD-08 NO PG ENUM. I7 auth separate.

12. **R1-R23 vincolanti**. R23 autonomy: zero delega evitabile + proactive tool loading + self-diagnose fallback + no user-executable when autonomously executable + evidence not suggestion. R23/iii eccezione canonica per SSH passphrase entry interattiva.

13. **Next actions**: (a) SSH unblock CK-1 manual + tunnel up; (b) PROMPT 027 sessione 1 kickoff SDBI Phase 2; (c) parallel CK-2/3/6 housekeeping closure; (d) tag `v0.4.1-housekeeping-closed` post-closure.

14. **Push policy**: locali su main pre-autorizzati; push solo se Enzo autorizza esplicitamente. S938 nuova sessione = default ask.

15. **Eccezione R23/iii SSH passphrase**: helper `C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1` manual launch da shell aperta a mano, NON via MCP automation.

---

**End of HANDOVER document.**

File salvato in:
- Primario: `D:\heuresys-advanced\cowork_code_exchange\_00_HANDOVER_CLI_2026-05-26_post_S937.md`
- Mirror sessione: `D:\heuresys-advanced\sessioni\session_2026-05-26_s937_housekeeping\HANDOVER_CLI.md`
- Mirror outputs Cowork (CW1): `C:\Users\enzospenuso\Claude Desktop\heuresys-advanced\sessioni\session_2026-05-26_s937_housekeeping\HANDOVER_CLI.md` (se path esiste)

*Generated by Cowork S937 closure — autonomia ereditata da S935+S936; R23 enforcement pieno; reading sources verified non-hallucinated.*
