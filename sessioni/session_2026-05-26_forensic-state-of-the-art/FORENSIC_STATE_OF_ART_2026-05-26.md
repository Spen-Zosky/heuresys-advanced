# Forensic State of the Art — Heuresys Advanced HRMS/BPM Platform v5

**Data emissione**: 2026-05-26
**Sessione Cowork**: turn-1 ACK + audit comprehensive multi-track
**Repo**: `D:\heuresys-advanced\`
**HEAD live**: `456c36b` (ahead +1 vs `origin/main`) — tag più recente `v0.3.2-mvp3-full` su `d17ee0a` (HEAD +2 oltre il tag, 2 commit doc-only ancora locali)
**Branch attivo**: `main`
**Metodologia**: 7 esplorazioni parallele read-only delegate a subagent (docs, cowork_code_exchange, cowork_reserved + memory, apps/api, apps/web + showcase + shared, db/migrations+seeds+scripts, config+git) + lettura diretta di 5 file ancillari root (`START_HERE.md`, `HANDOFF.md`, `NEXT_SESSION_MVP_2A.md`, `NEXT_SESSION_MVP_CLOSURE.md`, `.handoff/STATE.md`). Zero modifiche al codebase, zero segreti stampati (R11).

---

## 0. Executive summary (TL;DR)

Heuresys Advanced è una piattaforma HRMS/BPM v5 multi-tenant **mid-execution avanzata, prossima a release candidate**. Il backend Fastify 5 (post-migrazione triage fase 2) espone **272 endpoint business + 2 health** su **8 ruoli RBAC** con **388 mapping role×permission** caricati in cache a startup; **41 tabelle sys.\*** + 5 schemi (sys/brownfield/audit/staging/temp_sdbi) per ~110 tabelle canoniche, 12 view (zero MATERIALIZED), **42 migration idempotenti** (con gap su 000035 — cosmetico) tutte applicate via OCI VM tunnel 5433. Il frontend Next.js 15 + React 19 + Tailwind 4 + TanStack Query v5 conta **47 route** (30 admin + 14 ESS + login + system-health + root router), **61 test Playwright** in 20 spec, **i18n parity it/en** verde, **zero violazioni live-data doctrine** (no mock/console/skip/TODO nel code attivo). Il design system `@heuresys/ui` è npm-published `^0.1.1` post-migrazione X18 (workflow live), e gli schemi Zod cross-domain in `@heuresys/shared` esportano **59 subpath** con **427 schemi** (380 `z.object`).

Tre MVP chiusi: **MVP-0** (bootstrap), **MVP-1** (API backend), **MVP-2a/2b** (admin SPA + ESS portal). **MVP-3** è chiuso come "FULL" (tag `v0.3.2-mvp3-full`) con 7/7 tappe shipped (A GitHub Tier 0/1, B Mermaid renderer, C ESS mutations, D brownfield Wave 1 pragmatic 13/19 IMPORT, E MFA full login-gating TOTP, F `@heuresys/ui` npm publish con caveat showcase deferred, G WCAG 2.2 AA). Restano **6 IMPORT target brownfield residual** classificati CW-B60 (3 engine silent-filter + 3 scope gap Wave-2/computed views), il fix proprio dello showcase Next 15 RSC bundle (DEFER-F, PROMPT 025 pending), e **12 PR Dependabot** aperte da triagiare. Il working tree è in stato di transizione (13 inbox cowork da committare, 1 modifica a `CLAUDE.md` non pushata, 1 worktree obsoleto `musing-wing-802781` flag `prunable`). Sicurezza: tutte le CVE note (uuid, qs, vite, postcss, esbuild) chiuse via `pnpm.overrides`. Doctrine live-data E2E **rispettata** in tutto `apps/web/src/` attivo.

**Tre azioni più urgenti** (effort stimato totale 6-10h): (1) **DEFER-F /showcase RSC bundle-threshold** proper fix (PROMPT 025 nell'inbox CLI dal 2026-05-25 mai consumato, 2-3h, HIGH-RISK); (2) **CW-B60-A forensic engine silent-filter** sui 3 target AUTO_APPROVED → 0 upserted (2-3h); (3) **CW-B60-B scope-gap Wave 2 / computed views ADR** sui 3 target IMPORT senza staging source (2-3h). Le tre attività si possono parallelizzare solo parzialmente (DEFER-F è isolato; CW-B60-A/B condividono il modulo brownfield-wave-executor).

---

## 1. Stato dell'arte — Stack snapshot

### 1.1 Topologia repository

```
D:\heuresys-advanced\                                  (monorepo pnpm @ Windows 11)
├── apps/
│   ├── api/         Fastify 5 + Zod + Argon2id + RS256 + Drizzle (raw SQL) — 58 moduli, 272 endpoint
│   ├── web/         Next.js 15.5 + React 19.2 + Tailwind 4.3 + TanStack v5.62 — 47 route
│   └── showcase/    Static Next.js 15.5 (GitHub Pages export) — 19 route brand identity v1
├── packages/
│   └── shared/      @heuresys/shared — 59 subpath exports, 427 schemi Zod, barrel + per-domain
├── db/
│   ├── migrations/  42 SQL idempotent (000001..000043, gap 000035) — sys/staging/brownfield/audit
│   ├── seeds/       brownfield wave1 + RTL_BANK_REFERENCE + SDBI Goals/OKRs + Time/Leave
│   └── scripts/     11 (5 ps1/sh twins, 2 ts, 4 bash-only, 1 lib sourceable)
├── docs/            Canonical planning (BOOTSTRAP + 18 ADR + ~30 markdown distribuiti)
├── cowork_code_exchange/    Protocollo v2.2 Cowork↔CLI (~140 file: PROMPT/PLAN/EXEC/REPORT/REVIEW)
├── cowork_reserved/         Knowledge Base forensic + bias_registry CW-B17..B60 + 12 batch_cN
├── qa_artifacts/            Coverage matrix + Playwright/axe/build logs + release notes
├── .handoff/STATE.md        SoT operativa cross-session più fresca (2026-05-25)
├── .github/                 1 workflow (showcase deploy) + Dependabot + CODEOWNERS + SECURITY + templates
├── .claude/                 settings.local.json + 1 worktree (prunable) + launch.json
├── HANDOFF.md               Storico cronologico sessione → batch X13 (2026-05-23)
├── NEXT_SESSION_MVP_2A.md   Doctrine LIVE DATA E2E ONLY (storica, MVP-2a chiuso)
├── NEXT_SESSION_MVP_CLOSURE.md  Plan MVP-2a/2b closure (storico, completato)
├── START_HERE.md            Entry point originale planning (MVP-0)
└── CLAUDE.md                Project SoT (post-X18, Design System npm-published)
```

### 1.2 Toolchain root

| Aspetto | Valore | Note |
|---|---|---|
| Package manager | `pnpm@9.15.0` pinned | `engines.node >=20.11.0`, `engines.pnpm >=9.0.0`, `.nvmrc 20.11.0` |
| Workspaces | `apps/*`, `packages/*` | `pnpm-workspace.yaml` |
| TS strict (base) | `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals/Parameters: true`, `exactOptionalPropertyTypes: false` | drift zero vs CLAUDE.md "TS quirks" |
| pnpm.overrides | 5 attive (`vite ^6.4.2`, `postcss ^8.5.10`, `esbuild ^0.25.0`, `qs >=6.15.2`, `exceljs>uuid >=11.1.1`) | tutte security-related; vedi §7 |
| Linting | `eslint 9.39.4` + `eslint-config-next 15.5.18` + `typescript-eslint 8.59.4` + `@eslint/js 9.39.4` | root-level setup |
| Design system dep | `"@heuresys/ui": "^0.1.1"` in root + apps/showcase (NON dichiarata in apps/web — hoisting workspace) | post-X18 npm-published |

### 1.3 Backend `apps/api` (Fastify 5)

**Stack runtime**: Fastify 5.8.5 (migrato da v4 in triage fase 2), `@fastify/{cookie,cors,helmet,jwt,rate-limit} v10-13`, `fastify-type-provider-zod 4.0.2` + `zod 3.25.76`, `drizzle-orm 0.45.2` (solo wrapper pool — query reali in SQL parametrizzato), `pg 8.13.1`, `argon2 0.41.1`, `otpauth 9.5.1` (TOTP RFC 6238).

**Plugin chain canonical** (`app.ts` 127-265, 13 step):

1. Zod compilers — 2. requestIdPlugin — 3. helmet (CSP) — 4. cors — 5. cookie — 6. JWT RS256 15min — 7. rate-limit 600/min — 8. authPlugin (decode-only, non-enforcing) — 9. csrfPlugin (opt-in `app.verifyCsrf`) — 10. tenantContextPlugin — 11. errorHandler — 12. `/healthz` + `/readyz` (con `isDatabaseReady()`) — 13. register dei 58 moduli.

**Inventario moduli (58 totali, 272 endpoint business)** raggruppati per dominio:

| Dominio | Moduli | EP | Esempi visibility |
|---|---|---:|---|
| Auth + MFA + me (ESS) | auth, auth/mfa-routes, me | 14+5+17 = 36 | self-scope hard, admin scoped |
| Tenancy/Users/Org | tenants, users, organization-units, positions | 5+8+5+10 = 28 | platform/tenant tier-aware |
| Skill taxonomy | skills, skill-families/categories/aliases/edges/proficiency-levels | 4+5+5+5+4+1 = 24 | global+tenant |
| Job design | job-families, job-roles | 5+4 = 9 | global+tenant |
| KPI | kpi-definitions, process-kpi-templates, organization-unit-kpi-templates | 5+4+4 = 13 | global lib + tenant |
| Learning | learning-modules, learning-paths, learning-path-steps, learning-gaps, training-initiatives | 5+5+5+5+4 = 24 | tenant + self |
| Assessment | assessment-methods, assessments, assessment-results | 1+4+3 = 8 | global lib + tenant + self |
| Career & Succession | career-paths, career-path-steps, user-career-plans, succession-pools, successor-candidates, successor-readiness, position-career-paths, position-succession-relevance | 5+5+5+5+5+3+4+4 = 36 | tenant + self/manager |
| Visualizations (ADR-0009) | 7 moduli (graphs/nodes/edges/layouts/node-layouts/styles/exports) | 5+5+4+5+4+4+3 = 30 | tenant, edit_layout perm |
| Enterprise typing | activity-classifications, mappings, size-bands, operating-models, profiles | 5+4+4+4+4 = 21 | global+tenant |
| Blueprint | families, variants, processes, activations, overrides | 5+5+5+5+4 = 24 | global lib + tenant |
| Brownfield (4 viewer + 1 executor) | source-exports, import-runs, table-mappings, wave-executor | 2+4+3+5 = 14 | tenant + admin |
| Seed acquisition | runs, candidates, decisions | 5+2+3 = 10 | tenant + approve |
| Compensation + Dashboard | compensation, dashboard | 4+1 = 5 | tenant role-gated |

**RBAC**: 8 ruoli (`PLATFORM_ADMIN`, `TENANT_ADMIN`, `BLUEPRINT_MANAGER`, `HRMS_MANAGER`, `PROCESS_OWNER`, `MANAGER`, `USER`, `READ_ONLY`) × 101 permission (81 admin + 19 ESS self-scope + 1 dashboard) → **388 mapping** caricati una sola volta a startup da `sys.sys_auth_role_permissions` via `loadRolePermissionCache()`. Fail-fast su cache vuota (`RBAC_NOT_LOADED`). Pattern `requirePermission('resource:verb')` su ogni route + `app.verifyCsrf` su POST/PATCH/DELETE.

**Auth flow**: Argon2id 64 MiB / 3 iter / 4 parallelism con auto-rotate su `needsRehash`. JWT RS256 15min + refresh 30d single-use con `familyId` rotation e replay detection in `withTransaction` → 401 `REFRESH_REPLAY_DETECTED`. Cookie HttpOnly + SameSite=Lax + CSRF double-submit (cookie `hrx_csrf` non-HttpOnly + header `x-csrf-token`). MFA TOTP completo (enroll/verify/list/delete/verify-login) implementato in `auth/mfa-{service,routes,repository}.ts`, **gating al login attivo** (Tappa E full, Tappa X20, `auth.service.login()` ritorna discriminated union `success | mfa_required`).

**Test suite**: 52 file di test, 41 `*.integration.test.ts` (DB live via tunnel), 11 unit (concentrati su brownfield-wave-executor). Vitest singleThread per evitare race su refresh-rotation. Baseline `.handoff/STATE.md`: **341 PASS / 1 FAIL (`skills.integration.test:131` pre-esistente, non bloccante) / 5 SKIP** (gli skip sono dinamici, nessun `.skip` statico nel sorgente). **0 `.only` / 0 TODO / 0 FIXME** in `src/`.

**Pulizia minore**: 6 `console.error` residui in `brownfield-wave-executor/{engine,upsert-sql}.ts` (dovrebbero usare `app.log.error`); script npm dead (`test:integration` punta a config inesistente, `openapi:generate` punta a script inesistente, `apps/api/openapi.yaml` non esiste); description `package.json` obsoleta (cita "Fastify 4, 23 modules, 148 endpoints"). State machine `brownfield-wave-executor` ha **8 stati** (non 6 come da doc): `PENDING, STAGING, VALIDATING, APPROVED, UPSERTING, COMPLETE, FAILED, CANCELLED`.

### 1.4 Frontend `apps/web` (Next.js 15)

**Routes (47 page.tsx)**: 1 root router + 1 `/login` + 30 admin authenticated + 14 ESS `/me/*` + 1 `/system-health` + layout shells. Conta admin = 30 (non 29 come da HANDOFF — drift +1 verosimile per `/system-health` aggiunto X13 o `/admin/roles`).

**Stack**: Next.js 15.5.18, React 19.2.5, TanStack Query 5.62, react-hook-form 7.55, Zod 3.25.76 (riusa schemi da `@heuresys/shared`), react-i18next 15.4 + i18next 23.16, Tailwind 4.3, Playwright 1.55.1, axe-playwright 2.2 + `@axe-core/playwright` 4.11.

**Auth client doctrine implementata**: `src/lib/api/fetch.ts` (`apiFetch<T>` wrapper con credentials include + CSRF auto + silent refresh 401 + Zod parse opzionale + error tipato), `csrf-store.ts` (in-memory + cookie `hrx_csrf` + `BroadcastChannel` cross-tab sync), `auth.ts` (TanStack hooks `useCurrentUser`, `useLogin` con ramo MFA, `useLogout` + clear), `landing.ts` (`landingForRoles` → `/dashboard` se admin, `/me` altrimenti), `errors.ts` (`ApiError`, `SessionExpiredError`, `NetworkError`). Middleware `src/middleware.ts` redirect `/login` se cookie `hrx_access` assente; public paths `/login`, `/_next`, `/api`, `/showcase`.

**E2E Playwright**: 20 spec file, **61 `test(` totali** (+ 5 setup persona). Pattern: `tests/.auth/<persona>.json` storageState evita rate-limit `/v1/auth/login` 10/5m. 5 personas seedate con password unica `<TEST_ADMIN_PASSWORD>` (`admin@heuresys.com`, `tenant_admin_test@rtl-bank.test`, `manager_test@rtl-bank.test`, `employee_test@rtl-bank.test`, `outsider_test@rtl-bank.test`).

**i18n parity**: `it/common.json` = `en/common.json` = **23 leaf keys** ciascuno → parity OK. **Caveat**: 23 chiavi totali su 47 pagine sono pochissime — gran parte delle stringhe UI vengono da `@heuresys/ui` o sono hardcoded in italiano nei `.tsx`. **Possibile debito i18n nascosto** (verificare grep literal strings IT/EN).

**Compliance live-data doctrine (zero violazioni in src/ attivo)**:
- `mockData|MOCK_DATA|MOCK_`: **0** match
- `initialData:|placeholderData:` con literal: **0** match
- `console.log`: **0** match (codice attivo)
- `it.skip|test.skip|.only(`: **0** match
- `TODO|FIXME` in `apps/web/src/`: **0** match
- 4 match `mock|fixture` esistono SOLO in `src/_disabled_showcase_X18/` (escluso da tsconfig + build)

**Anomalie strutturali**:
- **A1 Tailwind 4 source-scan**: `globals.css` linea 22 `@source "../../../../../ux-design-shared/ui/src/**/*.{ts,tsx}"` — punta alla **working copy locale** del sibling repo, **NON al published artifact in `node_modules/@heuresys/ui/dist`**. Su Mac/VM (o CI) senza `D:/ux-design-shared` clonato in posizione equivalente, Tailwind salterà le utility classes della UI library. Contraddice la doctrine X18 ("reproducibilità", "CI/CD senza filesystem locale").
- **A2 `@heuresys/ui` non dichiarata in `apps/web/package.json`**: risolta solo via hoisting workspace dal root. Inconsistente con `apps/showcase` che la dichiara correttamente.
- **A3 `_disabled_showcase_X18/` ancora in repo**: 18 file `page.tsx` dead code in `src/_disabled_showcase_X18/`. Da rimuovere o spostare fuori da `src/`.
- **A4 Nessun `queries.ts` co-located**: tutte le 47 pagine fanno `apiFetch` + `useQuery` inline. Validità pragmatica, ma riduce testabilità unit.
- **A5 `vitest.config.*` assente in `apps/web`** malgrado script `test`. Dead script.

### 1.5 Static showcase `apps/showcase`

**19 route** (1 `/` + 18 `/showcase/*` brand identity v1): icons, logo, palettes, tables, forms, header, login-page, charts, landing-page, typography, page-types, footer, sidebar, primary-initial-page, shell, system-health, dashboard-cards.

Static export configurato per GitHub Pages (`basePath: "/heuresys-advanced"` se `STATIC_EXPORT=1`, `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`). Workflow CI `.github/workflows/showcase.yml` deploya su `gh-pages` (peaceiris/actions-gh-pages@v3, timeout 15min). Solo `@heuresys/ui ^0.1.1` + Next 15 + React 19 — niente Zod/TanStack/i18next (puro static).

### 1.6 Shared `packages/shared`

**59 subpath exports** in `package.json` (uno per dominio), corrispondenti a 59-61 file `.ts` in `src/schemas/` (+ `index.ts` barrel). **427 `export const ...Schema`** totali, **380 `z.object`**. File "ricchi": `me.ts` 29 schemi, `positions.ts` 16, `compensation.ts` 14, `users.ts/assessments.ts/blueprint-activations.ts/auth.ts` 8-15.

Match esatto vs codebase API (1 modulo Zod schema per modulo API). Lo schema-deduplication tra `apps/web` e `apps/api` funziona: **0 `z.object` in `apps/web/src/`** (tutti importati da `@heuresys/shared`).

### 1.7 Design system `@heuresys/ui`

Post-migrazione **X18** (2026-05-24/25, batch X18 con 5 amendment cascade): npm-published `^0.1.1` (NON più `link:../ux-design-shared/ui`). Pinned in root `package.json` + `apps/showcase/package.json`. Sister repo `D:\ux-design-shared` rimane sorgente di sviluppo (Storybook 51 componenti, 16 tier — count storico, da riverificare). Componenti dashboard system-health: 14 widget shipped (KPIStrip, LogStream, AuditFeed, IncidentTimeline, ErrorRateBreakdown, AlertBanner, DBSupervisorSidebar, ecc.) + brand mark/wordmark + DashboardShell/Header/Sidebar/Footer.

**Caveat aperto**: showcase consumption Next 15 RSC bundle threshold non risolto (DEFER-F). Fix pragmatico applicato in X18: workaround Path B+C (`apps/web/src/_disabled_showcase_X18/`). Proper fix in PROMPT 025 dell'inbox CLI dal 2026-05-25 mai consumato.

### 1.8 Database (PostgreSQL 16 nativo, OCI VM, tunnel 5433)

**42 migrazioni `.sql`** idempotenti (range 000001..000043, gap 000035 cosmetico), tutte applicate. **5 schemi**: `sys` canonical (~110 tabelle), `brownfield` (7), `audit` (4), `staging` (18 wave1_*), `temp_sdbi` (DDL via seed esterno).

**Tabelle sys per dominio** (totale ~110):
- Auth 11 (`sys_auth_*` + `sys_user_auth_roles`), Core 4, Profiles/Evidence 10, Enterprise typing 5, Blueprint 5, Org 5, Job roles 3, Positions 7 (+ history), Skills 6, KPI 9, Learning 8, Assessment/Gap 10, Career/Succession 9, Compensation 11, Seed acquisition 5, Visualization 7, ESS 1 (inbox).
- **MVP-3 SDBI Goals/OKRs** (mig 000037): 10 tabelle (sys_goal_templates, sys_goals, sys_goal_milestones, sys_goal_check_ins, sys_goal_updates, sys_goal_comments, sys_goal_alignments, sys_okrs, sys_okr_key_results, sys_okr_check_ins).
- **MVP-3 SDBI Time/Leave** (mig 000040): 6 tabelle (sys_leave_accrual_rules, sys_time_off_balances, sys_leave_balance_transactions, sys_time_off_requests, sys_attendance, sys_overtime).

**Views**: **12 view** (11 distinte), **0 MATERIALIZED VIEW**. PIP (`sys_position_intelligence_profiles_v`, ADR-0008 + I9) implementata come VIEW semplice — non MV. 7 STRUCTURAL validation views + 3 INFORMATIONAL + 1 inbox replace.

**RBAC seed**: 8 ruoli + 101 permission + ~388 mapping (calcolati dinamicamente via CROSS JOIN/IN-list) tutti con `ON CONFLICT DO NOTHING`.

**RTL_BANK_REFERENCE seed**: 1 tenant + 5 branches + **55 positions** (25 branch + 30 HQ) + **158 users sintetici** + **158 PRIMARY ACTIVE assignments**. Faker `SEED=42` deterministic. **Drift documentale**: lo STATE.md cita "158 positions" — il valore corretto è **55 positions**; 158 si riferisce a `users`/`assignments`.

**Brownfield registry**: 93 source_tables + 1164 source_columns + **95 table_mappings** (+1 vs STATE) + **1271 column_mappings** (+94 vs STATE — evoluzione significativa post-snapshot). **18 staging.wave1_*** tables (mig 000030 ne crea 17 + mig 000034 aggiunge `wave1_job_families`).

**Pattern proibiti — ZERO violazioni**:
- `CREATE TYPE ... AS ENUM`: 0 (rispetto RD-08 — varchar+CHECK ovunque)
- `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`: 0 (rispetto I5)
- `DROP TABLE` non-guarded: 0 (le 2 occorrenze sono in commenti reversibility 000033 + 000036)

**Idempotency**: tutte le migration usano `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `CREATE OR REPLACE` / DROP+CREATE in DO blocks. `validate_database.{ps1,sh}` formalizza **twice-run pg_dump --schema-only diff** proof (acceptance A3 BOOTSTRAP §6) + audit `sys.sys_schema_migrations` con SHA-256 per file.

**Scripts (11 totali)**: 5 PS1/SH twin (create / migrate / reset / validate / brownfield-wave-1-preflight), 2 standalone TS (seed-reference-bank + seed-test-admin), 4 bash-only (setup_oci_vm_database + extract-wave1-legacy + extract_users_employees_legacy + cross_os_pipeline.sh library).

**5 test personas** (idempotenti via `seed-test-admin.ts`, password `<TEST_ADMIN_PASSWORD>`):
- `admin@heuresys.com` → PLATFORM_ADMIN (tenant NULL)
- `tenant_admin_test@rtl-bank.test` → TENANT_ADMIN (RTL)
- `manager_test@rtl-bank.test` → MANAGER (incumbent + owner TEST_MGR_POS)
- `employee_test@rtl-bank.test` → USER (incumbent TEST_SUB_POS, team subordinate)
- `outsider_test@rtl-bank.test` → USER (incumbent TEST_OUTSIDER_POS, NOT in team)

---

## 2. Cronologia Cowork↔CLI — Goal forensic

Il protocollo Cowork↔CLI v2.2 (`cowork_code_exchange/README.md`) è **authoritative SoT project-level**. Lifecycle file naming: `_00_DISCOVERY` / `_00_STATE` / `_01_PROMPT` / `_02_PLAN` / `_02b_APPROVAL` / `_03_EXEC` / `_04_REPORT` / `_05_REVIEW` per goal numerato NNN. Inbox messaging in `.inbox/{cli,cowork}/{pending,read}/` con frontmatter cronologico ISO.

### 2.1 Goal 001 — audit-upsert-refactor (2026-05-18, ✅ CHIUSO)

Sub-goal "001a". Refactor SQL-side UPSERT (12 mechanical transforms) + audit wiring + Path B stuck DEMO run. Outcome: **11/11 criteri PASS**, formal REVIEW closure. File creati: `transform-compiler.ts` (322 LOC + 52 unit test), `run-logger.ts` (66 LOC), `upsert-sql.ts` (410 LOC). 9 commit atomici. Cycle time ~7h, 30 turn EXEC. 1 halt evidence-gated T3 (scoperta 14 transform codes vs 5 assumed). 1 interim REPORT rifiutato → poi accepted.

**Lezioni codificate**: G11 cross-check rule (ogni step ↔ ≥1 criterion) in PLAN v5 §-1. Catalog 12 errori supervisore web Class A-D.

### 2.2 Goal 002 — json-extract-lineage-fullscale (2026-05-19, ⚠️ PARTIAL)

DISCOVERY mandatory (pattern v2). PROMPT con decisioni B1/B2/B3/C1 locked + G11 applicato. PLAN unica versione (no halt EXEC). **13/15 criteri PASS** — A10/A11 FAIL (`sys_skills` 444 vs ≥5000, lineage 377 vs ≥47000). Blocker upstream `LOOKUP_FK match_on=legacy_<X>_id` semantica fuori PROMPT scope. File estesi: `transform-compiler` JSON_EXTRACT + LINEAGE_SOURCE_NK + LOOKUP_FK form a/b, `upsert-sql.ts` JSON aggregation + type-coerce auto-wrap. Migration 000031 (UQ `sys_user_certifications`) preparata da Cowork pre-EXEC. 9 commit. 3 full-scale runs ~110s ciascuno (totalStaged 41285, totalUpserted 377).

**Bias nuovi CW-B9..B13**: sandbox commit impossibile, null-byte Write tool, STATE race-stomp, mid-session protocol pivot, partial-closure-acceptance. **Lezione**: deferral PARTIAL ad altro Goal preferibile a mixing EXEC + DISCOVERY.

### 2.3 Goal 003 — brownfield-seeding-complete (2026-05-19/20, ⏸️ SUSPENDED_PENDING_STRATEGIC_PIVOT)

**Il goal più critico — pivot strategico finale.** DISCOVERY (94 Wave 1 mappings + sys.* gap). PROMPT v1 → v2 → v3 (narrowing C5 da ≥15 → ≥12). PLAN v1 → v2 canonical (v3 skip, PROMPT v3 amends solo C4/C5 bars). EXEC HALT post Item F con **5 sub-diagnostic**: DIAGNOSTIC_REPORT → CLASSB_FINDINGS → CLASSB_SUBDISCOVERY → CLASSB_SEMANTIC_FAIL → CLASSB_UQ_BLOCK.

**Sequenza narrowing C5**:
1. PROMPT v2: ≥15/15
2. PROMPT v3: ≥12/15 (CW-B18 registry completeness gap)
3. E1 verbal directive: ≥11/15 (CW-B19 source-side FK availability gap)
4. Z1 verbal: ≥10/15 (CW-B20 UQ + JSON_EXTRACT systemic)

**P1 SHIPPED** commit `127e1a7` (LOOKUP_FK form b → lineage records JOIN) risolve 4 Class-A targets. **5 INFEASIBLE declared per Goal 004**: `sys_skill_categories` (CW-B20), `sys_learning_path_steps` (CW-B19), `sys_blueprint_process_registry` (CW-B18), `sys_job_roles` (CW-B18), `sys_esco_occupation_mappings` (CW-B18). **0 INSERT** in `brownfield.column_mappings` (UQ-blocked); 8063 staged rows reclassified `CASCADE_PREREQUISITE_MISSING_GOAL_004`.

**Pivot strategico Enzo 2026-05-20T01:30** (verbatim): *"concettualmente sbagliato applicare criteri di coerenza e integrità tra i due dbms... interpretazione semantica AI-led... schema temp_ per non contaminare sys_"*. Nasce concetto **SDBI** (Semantic-Driven Brownfield Import) con 6-fase strawman (SOURCE DISCOVERY → TARGET ANALOGY → TEMP_ SEEDING → RELATIONSHIP TRAVERSAL → CONSOLIDATION REVIEW → CLEANUP). Codificato in **ADR-0014 PROPOSED** + migration 000036 (`temp_sdbi` schema) + 000037 (`sys_goals_okrs_scaffold`).

**Goal 003 NON è mai stato formalmente chiuso** — nessun REPORT 003, nessun REVIEW 003. Le 5 sub-EXEC diagnostiche sono evidenza completa ma orphan. 8 commit Goal 003 + 14 commit pre-Goal-003 (totale ~22 commit) ahead di `origin/main` allora; lo stato attuale è invece "synced d17ee0a" (i commit sono stati eventualmente pushati nei batch successivi). **Lavoro residuo formale = creare REPORT 003 + REVIEW 003 a chiusura.**

### 2.4 Goals 004-026 — Batch X1..X21 (post-pivot, protocollo "v2.2 semplificato")

Dal batch X1 in poi il protocollo formale 7-fasi è stato **abbandonato** in favore di "PROMPT + REPORT diretto". STATE files solo per 001/002/003. Pattern sostitutivi: pattern memo `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` + `bias_registry.md`.

| Goal | Batch | Tema | Status |
|---|---|---|---|
| 004 | X1 | CW-B17 patch + Wave 1 retry (sys_skills 6037→20048, esco_skills MIRROR GAP landed) | ✅ COMPLETE |
| 005 | X2 | Engine deep-fix CW-B22/23/24 (16× speedup Wave 1: 55→3.4min) + SDBI Goals/OKRs pilot | ✅ COMPLETE |
| 006 | X3 | Migrations 000038/039 + cascade redesign sys_job_roles (ADR-0015) | ✅ COMPLETE (sys_job_roles 0→91) |
| 007 | X4 | CW-B31 DISTINCT ON dedup + ESCO cascade re-try | ⏸ Block A only |
| 008 | X5 | CW-B32 CAST_ENUM + ADR-0016 + Time/Leave SDBI + sys_users HYBRID | ⚠️ X5.A partial (3 directive cw_b34) |
| 009 | X6.A | CW-B34 engine patch (ADR-0016 ACCEPTED): sys_esco_occupation_mappings 0→7645 | ✅ COMPLETE |
| 010 | X5.B | Time/Leave SDBI + sys_users HYBRID: sys_users 163→433 | ✅ BOTH SUCCESS |
| 011 | X7 | CW-B35/B36/B37 hardening (Wave 1 57min) | ✅ COMPLETE |
| 012 | X8 | CW-B38 audit verify + CW-B39 REFERENCE_ONLY cleanup | ✅ COMPLETE |
| 013 | X9 | SKILGRO MEGA-BUNDLE 5-block + LOOKUP_FK_2HOP | ✅ COMPLETE |
| 014 | X10 | CW-B49 engine fix (`upsert-sql.ts:661` split-on-COALESCE bug) — bias registry → 49 | ✅ COMPLETE |
| 015 | X11 | Hardening sprint consolidation (3/4 applied, 1 deferred REFERENCE_ONLY) | ✅ COMPLETE — ADR-0018 |
| 016 | X12 | **PIVOT MVP-2a Phase 0 API gap audit** (autonomous Cowork) | ✅ COMPLETE — refresh v2.0 |
| 017 | X13 | MVP-2a Coverage Hardening (E2E + spec + i18n + a11y) — CW-B53 | ✅ COMPLETE |
| 018 | X14 | MVP-2a Final Live Validation 67 hard PASS / 52 dev-mode JIT timeout | ⚠️ ENV CAVEAT |
| 019 | X15 | E2E vs production build — CW-B54 CONFIRMED — 118/125 effective PASS in 5.3m | ✅ COMPLETE |
| 020 | X16 | Final Certification + tag `v0.2.1-mvp2a-final` (124/125 PASS) | ✅ COMPLETE |
| 021 | X17 | D+B combo: tag push + showcase contract fix (CW-B52 staleness) | ✅ COMPLETE |
| 022 | X18 | MVP-3 Tappa F `@heuresys/ui` npm publish — **5 amendment cascade** | ⚠️ SHIPPED with caveat (Path B+C workaround) |
| 023 | X19 | Brownfield Wave 1 full-47k SQL-side upsert (residual Tappa D) | ⚠️ **HALT P1** — 6 targets residual |
| 024 | X20 | MFA login-gating (residual Tappa E) | ✅ COMPLETE |
| 025 | X21 | DEFER-F /showcase Next 15 RSC bundle proper fix — **PROMPT pending** | ⏳ **NOT STARTED** |
| 026 | X19.A | Dependabot CVE uuid bump | ✅ COMPLETE |

### 2.5 X18 caso emblematico — 5 amendment cascade

Una saga formativa per il protocollo:

| Amendment | Causa halt | Bias atomic |
|---|---|---|
| 022.1 | `exports_map_subpath_gap` (HALT-022-02) | CW-B55 |
| 022.2 | `dual_package_hazard` (HALT-022-03) | CW-B56 + CW-B57 |
| 022.3 | `cw_b57_misdiagnosis` (HALT-022-04, CLI counter-evidence empirical) — **Cowork retro-apology esplicito** | CW-B57 WITHDRAWN + CW-B58 |
| 022.4 | `persistent_build_fail` (HALT-022-05, 3 config falsificate) | Path β bisect |
| 022.5 | `bisect_inconclusive` (HALT-022-06, 12 iter — no single culprit) | CW-B59 candidate |

**Lezione Cowork (PROMPT 022.4 §0)**: *"4 amendment cascade basate su narrative diagnosis senza empirical test matrix. CLI ha dovuto fare la test matrix da solo. Da PROMPT 022.4 in poi: zero new narrative hypothesis Cowork-side"*.

### 2.6 Stato attuale protocollo

| Aspetto | Stato |
|---|---|
| Versione | v2.2 (README.md SoT) |
| Skill globale `cowork-cli-orchestrator` | ancora v1 (5 fasi) — `_SKILL_UPDATE_MEMO.md` documenta 6 changes proposte ma mai applicate al plugin dir |
| Goal aperto/in-flight | Goal 003 SUSPENDED senza REPORT/REVIEW formale; Goal 025 PROMPT pending mai consumato; REPORT 004 + 005 pending nessuna REVIEW |
| Bias catalog | **58 attivi** (B17→B56 + B58 + B59 + B60). CW-B57 WITHDRAWN. Next available CW-B61 |
| Drift INDEX | `.inbox/INDEX.md` stale dal 2026-05-19T14:14:49Z |
| Lock orphan | `.cowork-active.lock` ancora presente (auto-cleanup pre-commit hook R5 evidentemente non eseguito) |
| 6 pending commits | `.cowork-pending-commits.json` + msg-01..msg-06 mai puliti post-apply (manifest residual) |
| Watchdog | DISATTIVATO da utente (annotato in PROMPT 017) |

### 2.7 Pending Cowork↔CLI critici

1. **PROMPT 025 X21 DEFER-F** (`/showcase` Next 15 RSC bundle proper fix) — `.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md` mai consumato. Sospensione su scelta Path A (bisect) / Path F (split `@heuresys/ui`) / Path E (Next 16 upgrade).
2. **REPORT 004 + 005** (X1 + X2) — pending in `.inbox/cowork/pending/`, **nessuna REVIEW chiusa**.
3. **REPORT/REVIEW 003** — Goal sospeso, chiusura formale mai prodotta.
4. **`_SKILL_UPDATE_MEMO.md`** — 6 changes alla skill cowork-cli-orchestrator mai applicate al plugin Windows.
5. **Housekeeping**: inbox INDEX rebuild + lock cleanup + manifest cleanup.

---

## 3. Mappa decisionale — ADR / RD / Invarianti / Bias

### 3.1 18 ADR registrate (registry obsoleto a 0013)

| ADR | Titolo | Status | Note |
|---|---|---|---|
| 0001 | Monorepo pnpm workspaces | Accepted | Node 20, pnpm 9 |
| 0002 | Backend Fastify 4 | Accepted (overridable) | **Realtà: Fastify 5 post-triage fase 2** |
| 0003 | DB Drizzle + raw SQL | Accepted (overridable) | Realtà: Drizzle solo come pool wrapper |
| 0004 | No Docker, native PG | Accepted (hard policy) | OK |
| 0005 | Argon2id 64/3/4 | Accepted | OK |
| 0006 | JWT + refresh + cookie + CSRF | Accepted | OK |
| 0007 | Next 15 App Router | Accepted | OK |
| 0008 | PIP = view, not blob | Accepted | OK (VIEW, no MV) |
| 0009 | sys_visualization_node_layouts separate | Accepted | OK |
| 0010 | PG runtime location — Option B (OCI VM, tunnel 5433) | Accepted (RD-25) | OK |
| 0011 | ESS in scope as MVP-2b | Accepted | OK (13 pagine + 18 endpoint — realtà 14+17, drift minore) |
| 0012 | Brownfield wave column (`table_mapping_wave`) | Accepted | mig 000029 |
| 0013 | Showcase SoT policy (4-level hierarchy + 3 binding rules) | Accepted | OK |
| **0014** | **SDBI — Semantic-Driven Brownfield Import** | **PROPOSED** | Workflow 6-phase AI-led, mig 000036/000037 |
| **0015** | **sys_job_roles.family_id nullable** | **PROPOSED** | CW-B26 Semantic FK Phantom; mig 000038 |
| **0016** | **sys_esco_occupation_mappings.job_role_id nullable** | **ACCEPTED (X6.A)** | + engine companion CW-B34; mig 000041 |
| **0017** | **LOOKUP_FK_2HOP** | **MANCANTE come file** | Referenziato da ADR-0014 §8 + ADR-0018 §8; mig 000043 esiste ma ADR formale no |
| **0018** | **COALESCE-UQ class-of-bug** | **Accepted** | 10 sys.* tabelle affette + helper `replaceTargetColsInConflictInference` |

**Drift documentale**: `docs/architecture/ADR_INDEX.md` registry ferma a 0013 (2026-05-20). Mancano 0014-0018 dal registry. **ADR-0017 manca proprio come file**.

### 3.2 RD-01..RD-25 (Decision Log — sintesi)

| RD | Topic | Decisione (≤15 parole) |
|---|---|---|
| 01 | DB rename | `heuresys_advanced` / role `heuresys` |
| 02-03 | Brownfield demo | 4 tenant, 270 employees, no anonymization, no PII reale |
| 04 | ESS inclusion | ADR-0011 — 13 pagine + 18 endpoint + 19 self-scope perms |
| 05-06 | Argon2id + SameSite | 64/3/4 + Lax confermati |
| 07 | auth:revoke_user | Aggiunto a PLATFORM_ADMIN + TENANT_ADMIN |
| 08-09 | varchar+CHECK + date | RD-08 mai PG ENUM; date per date-only, timestamptz per time-of-day |
| 10-11 | ESS tables + migration count | +2 tabelle (sys_inbox_notifications, audit.user_self_service_actions); 27 mig (realtà 42) |
| 12 | Bilingual it/en | da MVP-2 via next-intl + parità CI |
| 13 | React Flow Pro | warning hideAttribution; ADR pre-prod (mai aperto) |
| 14 | READ_ONLY landing | redirect `/me` (non `/dashboard`) |
| 15-16 | P99 PIP 600ms + pool 20 | con MV fallback (oggi VIEW) |
| 17 | Risk register | aggiunti R12-R15 (bus factor, ARM64, bleeding-edge, ESS expansion) |
| 18-22 | Brownfield processo | refresh PR mandatory, DGOV breakdown 179 tabs, wave counts 93+94+31+55=273, 16-step promotion, wave_runners (TBD wave 2-4) |
| 23 | Mermaid PNG/SVG | generated |
| 24 | Approvazione formale | Section 19 unlocked |
| 25 | ADR-0010 closure | Option B selezionata, tunnel 5433 |

### 3.3 Invarianti I1..I14

| ID | Sintesi 1 riga |
|---|---|
| I1 | Position-centric (NON Employee-centric) |
| I2 | Position owner ≠ Position incumbent |
| I3-I4 | Schema canonico `sys.sys_<plural>`; aux `staging/brownfield/audit` |
| I5 | Tenant isolation = FK + middleware API; **MAI RLS** |
| I6 | Tenant FK = `sys_users.user_tenant_id → sys_tenancies.tenant_id` |
| I7 | Auth separato in 11 tabelle `sys.sys_auth_*` |
| I8 | Out of scope: payroll, T&A, benefits, IAM, recruiting, onboarding, contracts body |
| I9 | PIP = VIEW/MV mai JSONB blob (ADR-0008) |
| I10 | Visualization layout edits → `sys_visualization_node_layouts` (ADR-0009) |
| I11 | Training completion ≠ skill mastery |
| I12 | Brownfield = enrichment source; v5 wins on conflict |
| I13 | PG 16 NATIVO. NO Docker (ADR-0004) |
| I14 | Synthetic data flagged: `user_is_synthetic=true`, `user_type=SYNTHETIC_REFERENCE` |

CLAUDE.md di progetto cita I1-I13. I14 esiste in BOOTSTRAP ma non nel digest CLAUDE.md.

### 3.4 Bias registry CW-B17..B60 (58 attivi, B57 withdrawn)

Tally: **39 mitigated · 1 withdrawn · 1 deferred-proper-fix · 6 reflexive · 2 standardized · 1 documented partial · 3 pending forensic/spec minor · 1 pending engine improvement**. **CW-B60 PENDING** (due-parte: A engine silent-filter, B Wave-2 scope gap) è l'unico bias non chiuso al 2026-05-25.

---

## 4. Debiti tecnici categorizzati

### 4.1 Debito documentale (priority MEDIUM, effort LOW-MED)

| ID | Item | Effort |
|---|---|---|
| DOC-1 | **ADR_INDEX.md** ferma a 0013 — aggiungere ADR-0014..0018 (5 entries) | 30min |
| DOC-2 | **ADR-0017 (LOOKUP_FK_2HOP) manca come file** — esiste mig 000043 + 2 refs in ADR-0014/0018, scrivere ADR formale | 1h |
| DOC-3 | **README.md root** ancora cita "@heuresys/ui linked via `link:`" e "51 components" — aggiornare per realtà post-X18 | 20min |
| DOC-4 | **HANDOFF.md** non aggiornato post-C19 (ferma a batch X13 = 2026-05-23). `.handoff/STATE.md` è la SoT fresca | 1h |
| DOC-5 | **HANDOFF_FRESH_SESSION.md** in `cowork_reserved/` cita `readlink @heuresys/ui → /d/ux-design-shared/ui` come check pre-flight, **obsoleto post-X18** | 15min |
| DOC-6 | **MVP-4 non documentato canonicamente** — nessun `docs/MVP_4_*` o piano formale | 2-3h |
| DOC-7 | **Wave 2/3/4 runner docs mancanti** in `docs/brownfield/wave_runners/` (RD-22) | 4-6h |
| DOC-8 | **package.json apps/api description obsoleta** ("Fastify 4, 23 modules, 148 endpoints") → realtà Fastify 5, 58/272 | 5min |
| DOC-9 | **`.env.example` `MFA_ENCRYPTION_KEY` etichettata "post-MVP"** ma MVP-3 Tappa E full shipped | 5min |
| DOC-10 | **BOOTSTRAP §10 Q1-Q8** non marcate RESOLVED post-RD-24 | 10min |
| DOC-11 | **API_IMPLEMENTATION_PLAN** dice "23 moduli/148 endpoint" — realtà 58/272 | 1-2h refresh |
| DOC-12 | **State-machine wave-executor doc** dice 6 stati — realtà 8 (aggiungere FAILED + CANCELLED) | 15min |
| DOC-13 | **STATE.md migration count** dice "000031 in pending commits": la migration esiste già committata. Aggiornare baseline. | 5min |
| DOC-14 | **STATE.md RTL_BANK positions count** dice "158 positions" → realtà 55 positions + 158 users | 5min |
| DOC-15 | **STATE.md column_mappings = 1177** → realtà 1271; staging 17 → realtà 18 | 5min |

### 4.2 Debito codice (priority MED, effort LOW-MED)

| ID | Item | Effort |
|---|---|---|
| CODE-1 | **6 `console.error` in brownfield-wave-executor** (engine.ts:223,268,820 + upsert-sql.ts:683,892,917) — sostituire con `app.log.error` | 30min |
| CODE-2 | **Script npm dead**: `test:integration` (vitest.integration.config.ts inesistente), `openapi:generate` (scripts/generate-openapi.ts inesistente), `apps/api/openapi.yaml` inesistente | 1h (rimozione + decisione su openapi generator) |
| CODE-3 | **Tailwind 4 source-scan path locale** `globals.css:22` — rompere dipendenza da `D:/ux-design-shared/ui/src` (CI/CD/Mac portability) | 2-4h |
| CODE-4 | **`@heuresys/ui` non dichiarata in `apps/web/package.json`** — risolta solo via hoisting | 10min |
| CODE-5 | **`_disabled_showcase_X18/` ancora in src/** (18 file dead code, 4 file con `mock|fixture` residui) | 30min cleanup |
| CODE-6 | **Nessun `queries.ts` co-located** — 47 pagine fanno `apiFetch + useQuery` inline | 8-15h (refactor opzionale) |
| CODE-7 | **`vitest.config.*` assente in apps/web** malgrado script `test` (dead) | 10min |
| CODE-8 | **Worktree `musing-wing-802781` prunable** — 147 commit dietro main, naming drift vs `launch.json` "brand-identity-v1". Cleanup `git worktree remove --force` | 5min (con conferma) |
| CODE-9 | **`.claude/worktrees/` non in `.gitignore`** | 5min |
| CODE-10 | **i18n parity** OK ma con solo 23 keys per 47 pagine → strings non i18n hardcoded? Da verificare grep IT/EN literal | 2-4h discovery + N×fix |

### 4.3 Debito brownfield/SDBI (priority HIGH, effort HIGH)

| ID | Item | Effort |
|---|---|---|
| BF-1 | **CW-B60-A engine silent-filter** — 3 target AUTO_APPROVED + 0 upserted senza log (skill_categories, activity_classification_mappings, process_kpi_templates). Forensic + observability + unit tests | 2-3h |
| BF-2 | **CW-B60-B Wave 2 / computed views ADR** — 3 target IMPORT senza staging source (blueprint_overrides, position_learning_requirements, position_skill_requirements) | 2-3h |
| BF-3 | **Wave 2 / 3 / 4 mai eseguite** — wave 2 (RTL_BANK_REFERENCE operating model), wave 3 (sensitive tenant data), wave 4 (cross-tenant) | molti giorni, post-MVP-3 |
| BF-4 | **SDBI Phase 2 pilot** (ADR-0014 PROPOSED) — formal acceptance + estensione 11 macro-aree HRMS | 1-2 settimane |
| BF-5 | **REPORT 003 + REVIEW 003** mai prodotti — Goal sospeso senza closure formale | 1-2h |
| BF-6 | **5 sub-EXEC diagnostic Item F orphan** — non sintetizzati da nessun REPORT | 1h se mergiati in REPORT 003 |

### 4.4 Debito sicurezza & dipendenze (priority HIGH, effort MED)

| ID | Item | Effort |
|---|---|---|
| SEC-1 | **12 PR Dependabot aperte** non triagiate: actions/setup-node-6, peaceiris/actions-gh-pages-4, pnpm/action-setup-6, apps/web/next-15.5.18 (×2), fastify-type-provider-zod-6.1.0, postcss-8.5.14, react-i18next-17.0.8, zod-4.4.3 (major), 2 minor-and-patch groups | 2-4h triage |
| SEC-2 | **`qs@6.15.1` + `6.15.2` coesistono in `node_modules/.pnpm/`** — override `qs >=6.15.2` non propagato a tutta dep tree. Verificare `pnpm why qs` | 30min |
| SEC-3 | **Dependabot auto-close CVE-2026-41907 (uuid) + #76 (qs)** — verificare scan post-d17ee0a | 10min |
| SEC-4 | **MFA hardening completo**: TOTP recovery codes, backup codes, WEBAUTHN/EMAIL_OTP/SMS_OTP (schema multi-kind preparato, solo TOTP implementato) | 1-2 settimane |
| SEC-5 | **Nessun workflow CI per `pnpm test` / `typecheck` / `lint` / Playwright** — solo deploy showcase. Tutta verifica locale. Aggiungere CI guard pre-merge | 4-8h |
| SEC-6 | **Branch protection rules** non versionate nel repo (config server-side) — formalizzare in `.github/branch-protection.yml` | 2h |
| SEC-7 | **MFA_ENCRYPTION_KEY** in `.env.example` documentato come "optional post-MVP" ma codice live richiede già MFA enrollment. Allineare doc + obbligatorietà env validation | 30min |

### 4.5 Debito test & QA (priority MED, effort MED)

| ID | Item | Effort |
|---|---|---|
| QA-1 | **`skills.integration.test:131` FAIL pre-esistente** (deterministico, non correlato uuid/MFA): createdSkillIds non in list response | 30-60min |
| QA-2 | **5 SKIP dinamici non identificati** — il sorgente non contiene `.skip` statici; verificare condizionali runtime | 1h discovery |
| QA-3 | **a11y tail items** (serious/moderate/minor) documentati in `docs/a11y-tail-items.md` da chiudere in MVP-4 | molti giorni |
| QA-4 | **Test count divergenze**: 323 statici grep vs 341 dichiarati STATE — drift documentale o `describe.each` expansion runtime | 30min verifica |
| QA-5 | **Conteggio admin routes** 30 vs 29 documentate post-X13 (+1 drift — probabile `/system-health` o `/admin/roles`) | 5min count update |
| QA-6 | **E2E showcase** — `showcase-a11y.spec.ts` esiste ma showcase live in `apps/web` è disabilitato (X18). Reattivare post-DEFER-F | 30min coordination |
| QA-7 | **`me-pages.spec.ts` 10 test ≠ 14 ESS routes** — verificare coverage completa | 1h |

---

## 5. Attività pendenti — Backlog operativo immediato

Ordinate per priorità decrescente. Riferimento `.handoff/STATE.md` (SoT più fresca al 2026-05-25):

### 5.1 P0 — Devono partire prossima sessione

| ID | Item | Effort | Bias correlato |
|---|---|---|---|
| P0-1 | **DEFER-F /showcase RSC bundle-threshold** proper fix. PROMPT 025 pronto in `.inbox/cli/pending/`. Restore `apps/web/src/_disabled_showcase_X18` + scelta Path A bisect / Path F split `@heuresys/ui` / Path E Next 16 | 2-3h, HIGH-RISK | CW-B59 |
| P0-2 | **CW-B60-A forensic engine silent-filter** — 3 target AUTO_APPROVED + 0 upserted senza log. Deep-dive `executeUpsert` filter + add observability + unit tests | 2-3h | CW-B60 (A) |
| P0-3 | **CW-B60-B Wave 2 / computed views ADR** — 3 target IMPORT senza staging source | 2-3h | CW-B60 (B) |

### 5.2 P1 — Housekeeping protocollo Cowork↔CLI

| ID | Item | Effort |
|---|---|---|
| P1-1 | Committare/cleanup working dir (13 inbox cowork deleted, 1 STATE_002 modified, 6+ untracked) | 30min |
| P1-2 | Rebuild `cowork_code_exchange/.inbox/INDEX.md` (stale dal 2026-05-19) via `pnpm cowork:inbox:rebuild` | 5min |
| P1-3 | Pulizia `.cowork-active.lock` orphan + `.cowork-pending-commits.json` post-apply | 10min |
| P1-4 | Chiusura formale Goal 003: REPORT 003 + REVIEW 003 sintetizzando 5 sub-EXEC Item F | 1-2h |
| P1-5 | REVIEW 004 + 005 (X1+X2 reports pending da 2026-05-20) | 30-60min |
| P1-6 | Commit doc-only locale + push `456c36b` (richiede autorizzazione esplicita Enzo) | 5min |
| P1-7 | `git worktree remove .claude/worktrees/musing-wing-802781 --force` + `git branch -D claude/musing-wing-802781` + aggiungere `.claude/worktrees/` a `.gitignore` | 5min |

### 5.3 P2 — Security & dipendenze

| ID | Item | Effort |
|---|---|---|
| P2-1 | Triage 12 PR Dependabot — accept minor/patch groups, decide su next 15.5.18 (presumed duplicato), valutare zod 4.4.3 major upgrade | 2-4h |
| P2-2 | Verificare `pnpm why qs` per residuo dual-resolution `qs@6.15.1` vs `@6.15.2` | 30min |
| P2-3 | Workflow CI per `pnpm test` (apps/api integration tests con DB tunnel skippable in CI), `typecheck`, `lint`, Playwright smoke 5 personas | 4-8h |

### 5.4 P3 — Documentazione & refactor

| ID | Item | Effort |
|---|---|---|
| P3-1 | Tutti DOC-1..DOC-15 della §4.1 — refresh batch documentale | 6-10h |
| P3-2 | Tailwind 4 source-scan fix (CODE-3) — alternativa: copiare `D:/ux-design-shared/ui/dist` in `apps/web` pre-build, o configurare `@source` via pnpm-resolved path | 2-4h |
| P3-3 | Quick wins code (CODE-1, CODE-2, CODE-4, CODE-5, CODE-7) | 2-3h |
| P3-4 | Refactor i18n keys missing (CODE-10) — discovery grep + estensione locales | 2-4h |

---

## 6. Attività da programmare — MVP-4 candidates

MVP-3 è chiuso "FULL" come `v0.3.2-mvp3-full`. La roadmap canonical non ha MVP-4 documentato. Candidates evidence-based:

### 6.1 Brownfield maturity (HIGH value)

- **Wave 2 execution**: RTL_BANK_REFERENCE operating model deep import (target ~94 source tables / 31 sys.* canonical, runner docs TBD). Effort: 1-2 settimane.
- **Wave 3 execution**: sensitive tenant data con human approval gates. Richiede ADR + approval workflow UI. Effort: 2-3 settimane.
- **Wave 4 execution**: cross-tenant aggregation con governance. Effort: 2-3 settimane.
- **SDBI Phase 2 pilot** (ADR-0014 PROPOSED → ACCEPTED): formal acceptance + estensione 11 macro-aree HRMS (PerformanceReviews, RecruitingHiring, Onboarding, Surveys, Time/Leave già done, Feedback, Mentorship, PredictionsML, Compensation, Documents, TalentPool). Effort: 1-2 mesi.
- **Closure CW-B60-A/B**: vedi §5.1.

### 6.2 Security hardening (HIGH value)

- **MFA multi-kind**: WEBAUTHN (FIDO2 hardware keys), EMAIL_OTP, SMS_OTP. Schema già preparato in `sys_auth_mfa_factors`. Effort: 2-4 settimane.
- **MFA recovery codes** + backup codes flow. Effort: 1 settimana.
- **Session enumeration UI** (`/me/security` lista sessioni attive + revoke per device). Effort: 1 settimana.
- **Audit log UI** (`/admin/audit` visualizzazione query-able su 207k+ audit rows). Effort: 2 settimane.
- **OCI Managed migration prep** (ADR-0010 future revisit) — switch da OCI VM self-managed a Autonomous DB. Effort: 4-8 settimane (richiede ADR + cutover plan + perf test).

### 6.3 UX / Frontend (MED value)

- **React Flow renderer** per `/visualizations/[graphId]` e `/organization/org-chart` — oggi list views, target React Flow + Dagre/ELK layout (ADR-0009 ready). Effort: 2-3 settimane.
- **Mermaid renderer** per KPI cascade — Tappa B MVP-3 fatta solo parziale. Effort: 1 settimana.
- **Position sub-CRUD mutation UI** (combobox skill picker, KPI assignment workflows). Effort: 2-3 settimane.
- **Compensation-intelligence write UI** — oggi solo read (4 endpoint), write workflow per reward gates + payout curves. Effort: 2 settimane.
- **File upload reale** per certifications/documents (`/me/certifications`, `/me/documents`) — oggi form bound ma upload logic stub. Effort: 1 settimana.
- **Mobile responsive audit** — Tailwind 4 breakpoints presenti ma non auditati cross-device. Effort: 1-2 settimane.
- **WCAG 2.2 AA tail items closure** — `docs/a11y-tail-items.md` register. Effort: 2-3 settimane.

### 6.4 Performance & osservabilità (MED value)

- **MV fallback per PIP** (RD-15) — oggi VIEW; sotto carico passare a MATERIALIZED VIEW con refresh policy.
- **Pool sizing** (RD-16) — oggi pool 20, tunare per VM ARM64 + carico atteso.
- **Tracing / Distributed observability** — oggi solo Pino structured logs. Aggiungere OpenTelemetry → Grafana Cloud / OCI Observability.
- **DB query analyzer** — `pg_stat_statements` già attivato (vedi `_99_DB_INVENTORY_2026-05-20.md`). UI per top-N slow queries.

### 6.5 Plugin & ecosystem (LOW-MED value)

- **`@spen-zosky/ui` npm publish** — Tappa F MVP-3 deferred (X18). Path A o B post DEFER-F closure.
- **Storybook publication** per ux-design-shared (oggi locale). Effort: 1 settimana.
- **React Flow Pro license** decision (RD-13) prima di produzione commerciale.

---

## 7. Test da eseguire

### 7.1 Test di regression (eseguibili oggi)

```bash
# Pre-flight
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# Backend
cd D:\heuresys-advanced\apps\api
pnpm test                     # vitest 341/342 (1 fail pre-esistente skills:131)
pnpm typecheck                # zero error attesi
pnpm typecheck:test           # zero error attesi
pnpm lint                     # ESLint clean

# Frontend
cd D:\heuresys-advanced\apps\web
pnpm typecheck                # zero error
pnpm i18n:check               # 23 keys parity it/en
pnpm build                    # production build (Next 15)
pnpm exec playwright test --workers=1     # 61 test E2E
pnpm exec playwright test a11y.spec.ts    # axe critical=0 atteso

# Showcase
cd D:\heuresys-advanced\apps\showcase
STATIC_EXPORT=1 pnpm build:static  # GitHub Pages export

# Security
pnpm audit --audit-level=moderate   # post-overrides
```

### 7.2 Test forensic dedicati (NEXT_SESSION_MVP_CLOSURE-style)

- **Twice-run idempotency proof**: `pnpm db:validate` (esegue migration 2x + pg_dump schema-only diff, deve essere ∅).
- **5 personas smoke test manuale browser** (5×30s ciascuna): login + landing redirect corretta + nav role-gated + 2 page extra + logout.
- **MFA enroll + verify-login flow** (5 step Playwright `mfa-enroll.spec.ts` + `login-mfa.spec.ts`).
- **CSRF block test** (cURL POST senza `x-csrf-token` → 403 atteso).
- **Refresh token rotation + replay** (vitest `auth.integration.test.ts`).

### 7.3 Test performance da pianificare (MVP-4)

- **PIP view** P99 ≤ 600ms (RD-15) — load test su `/v1/positions/:id` con 100 concurrent users.
- **Brownfield wave-executor** large-scale (>50k rows) — già stressato in X19 (34509 upserted in 47min, OK), ma full 200k+ non testato.
- **DB pool exhaustion** sotto carico (RD-16 pool 20).
- **Bundle size budget** apps/web (Next 15 SSR + hydration overhead) — tracciare con `@next/bundle-analyzer`.

### 7.4 Test security audit completi

- **OWASP ZAP scan** su `apps/web` + `apps/api` (deploy temporaneo o tunnel).
- **SQLMap su parametri query** — verificare zero injection (raw SQL parametrizzato dovrebbe bloccare).
- **JWT token tampering** — verificare RS256 verifica firma con public key.
- **Session enumeration** — verificare admin sessions API + scope check TENANT_ADMIN.
- **Argon2id timing attack** — verificare timing comparison costante.

---

## 8. Raccomandazioni strategiche

### 8.1 Quick wins (≤4h totali, alto ROI)

1. **Cleanup working dir + housekeeping protocollo** (P1-1..P1-7): mette il repo in stato "deployable" e riallinea SoT.
2. **Refresh batch documentale low-effort** (DOC-3 README, DOC-5 HANDOFF_FRESH_SESSION, DOC-8 package.json desc, DOC-9 env.example, DOC-12 state-machine, DOC-13/14/15 STATE.md): elimina drift documentale superficiale.
3. **6 console.error → app.log.error** (CODE-1): allinea brownfield-wave-executor al pattern logging structured.
4. **Tag annotato per stato corrente** dopo cleanup (es. `v0.3.2-mvp3-full-stable` con notes su stato 2026-05-26).

### 8.2 Decisioni strategiche da prendere

1. **DEFER-F path**: scegliere A (bisect) / F (split `@heuresys/ui`) / E (Next 16). Affecting effort 2h vs 8h vs 16h. Raccomandazione: **A bisect** (più conservativo, già 12 iter parziali).
2. **Wave 2 vs SDBI Phase 2**: priorità su brownfield rigido (Wave 2) o paradigma AI-led (SDBI)? Le 6 IMPORT residual classificate CW-B60 sono evidence che il rigid approach ha raggiunto un plateau — **SDBI Phase 2 raccomandato** se Enzo conferma il pivot strategico del 2026-05-20.
3. **CI workflow**: investire in `.github/workflows/{test,typecheck,lint,playwright}.yml` per gates pre-merge? Effort 4-8h ma elimina classe intera di regression. **Raccomandato** prima di esposizione esterna del repo.
4. **GitHub release pubbliche**: il repo è public su `Spen-Zosky/heuresys-advanced`. Decidere se mantenere release notes auto-generate (oggi minimal) o curare changelog per ogni tag.
5. **MFA enforcement policy**: oggi MFA è opt-in self-enroll. Policy aziendale "MFA mandatory for PLATFORM_ADMIN + TENANT_ADMIN" da approvare?
6. **OCI Managed migration timing**: lo state corrente (OCI VM tunnel 5433) ha lavorato benissimo per MVP-0..3. Migrazione OCI Managed introduce SSL + connection string + autovacuum tuning differente — non urgente, da pianificare quando si decide il deployment di produzione.

### 8.3 Anti-patterns da evitare nelle prossime sessioni

Dalla cronologia Cowork↔CLI emerge un pattern ricorrente di **narrative diagnosis senza empirical test matrix** che ha causato la cascata X18 di 5 amendment. La mitigazione codificata (PROMPT 022.4 §0): *"zero new narrative hypothesis Cowork-side; CLI ha override authority con verified-by evidence"*. Suggerisco:

1. **Pre-flight live-state validation MANDATORY** in ogni PROMPT (CW-B52 mitigation): leggere HEAD + count test + count routes immediatamente prima di authoring PROMPT, mai trust su snapshot stale.
2. **G11 cross-check rule** per PLAN: ogni step.§2.2 ↔ ≥1 criterion.§2.6. Catturato 12 supervisor errors in Goal 001.
3. **Evidence-gated halt (pattern E1)** invece di best-effort completion: HALT documentato è preferibile a partial shipping nascosto.
4. **Critical-thinking-active** explicitly invited in ogni PROMPT post-X1: CLI può sfidare l'assunzione Cowork con counter-evidence.
5. **Goal "SUSPENDED" formalizzato in protocol v3** (non previsto formalmente in v2.2) per evitare orphan unrecorded come Goal 003.

### 8.4 Risk-radar attivo

| Risk | Probabilità | Impact | Mitigation status |
|---|---|---|---|
| R12 Bus factor 1 (solo Enzo) | H | H | ADR + handoff doc + co-author commit ma nessun handover umano effettivo |
| R13 ARM64 OCI native deps | M | M | Argon2/pg/Drizzle build OK su VM (verificato MVP-1) |
| R14 Bleeding-edge stack (Next 15, React 19, Tailwind 4) | M | M | Pin exact patch + downgrade plan in BOOTSTRAP. Dependabot PR aperte attive |
| R15 ESS scope expansion | L | L | Hard self-scope + ESLint guard + Playwright cross-user test |
| **CW-B60 brownfield residual** | H | M | 6 target deferred — non bloccano MVP-3 release ma vincolano completezza dati |
| **DEFER-F /showcase** | M | L | Workaround Path B+C funzionante; non bloccante per `apps/web` production |
| **CI/CD assente** | M | H | Nessuna guard automatica pre-merge — rischio regression silente alta |

---

## 9. Appendice — File chiave per re-priming

### 9.1 Top-15 file da leggere SEMPRE all'apertura sessione

1. `D:\heuresys-advanced\.handoff\STATE.md` — **SoT più fresca operativa**
2. `D:\heuresys-advanced\HANDOFF.md` — storico cronologico
3. `D:\heuresys-advanced\CLAUDE.md` — project SoT (post-X18)
4. `D:\heuresys-advanced\cowork_reserved\HANDOFF_FRESH_SESSION.md` — primary handoff Cowork-side
5. `D:\heuresys-advanced\cowork_reserved\bias_registry.md` — bias catalog CW-B17..B60
6. `D:\heuresys-advanced\cowork_code_exchange\README.md` — protocol v2.2 SoT
7. `D:\heuresys-advanced\cowork_code_exchange\_00_SESSION_HANDOFF_2026-05-20.md` — handoff finale Goal 003 sospensione + pivot SDBI
8. `D:\heuresys-advanced\docs\BOOTSTRAP_EXECUTION_PLAN.md` §5+§8+§9 — roadmap + risk + decision log
9. `D:\heuresys-advanced\docs\architecture\ADR_INDEX.md` + ADR 0014/0015/0016/0018 (0017 manca)
10. `D:\heuresys-advanced\docs\api\MVP_2A_API_GAP_AUDIT.md` v2.0 — gap status zero
11. `D:\heuresys-advanced\NEXT_SESSION_MVP_2A.md` §0 — doctrine LIVE DATA E2E ONLY
12. `D:\heuresys-advanced\apps\api\src\app.ts` — plugin chain canonical + LOG_REDACT_PATHS
13. `D:\heuresys-advanced\packages\shared\src\index.ts` — barrel schemi Zod
14. `D:\heuresys-advanced\db\scripts\README.md` — idempotency contract
15. `D:\heuresys-advanced\qa_artifacts\mvp3_full_release_notes_v0.3.2.md` — release notes tag corrente

### 9.2 File pending operativi da consumare/chiudere

- `cowork_code_exchange/.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md` (DEFER-F)
- `cowork_code_exchange/.inbox/cowork/pending/2026-05-20T22-14-12Z__004__report_ready.md` (REVIEW X1)
- `cowork_code_exchange/.inbox/cowork/pending/2026-05-21T01-53-26Z__005__report_ready.md` (REVIEW X2)
- 5 sub-diagnostic Item F per merge in REPORT 003: `_03_EXEC_003_{DIAGNOSTIC_REPORT,CLASSB_FINDINGS,CLASSB_SUBDISCOVERY,CLASSB_SEMANTIC_FAIL,CLASSB_UQ_BLOCK}_Item_F.md`

### 9.3 Comandi operativi base

```bash
# SSH tunnel (sempre)
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# Verify tunnel
netstat -ano | grep "LISTENING.*:5433"
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"

# Dev (entrambi)
cd D:\heuresys-advanced && pnpm dev    # API :3001 + web :3000

# DB seed (idempotent)
pnpm db:seed                    # RTL_BANK_REFERENCE (158 users + 55 positions)
pnpm db:seed-test-admin         # 5 test personas

# Test smoke
curl -s http://localhost:3001/healthz   # 200
curl -s -X POST http://localhost:3001/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@heuresys.com","password":"<TEST_ADMIN_PASSWORD>"}'
```

---

## 10. Closing — verdetto sintetico

Il progetto è in stato **mature mid-execution**, con backend production-grade, frontend MVP feature-complete (live-data doctrine rispettata), DB stabile su OCI VM, design system migrato a npm-published, MFA login-gating attivo. Le tre release tag (`v0.2.0-mvp2`, `v0.3.1-mvp3-final`, `v0.3.2-mvp3-full`) attestano stabilità incrementale.

I debiti aperti sono **categorizzati e non bloccanti** per un eventuale freeze immediato: il sistema è oggi deployabile come "MVP-3 closure" con i 6 brownfield target marcati `CASCADE_PREREQUISITE_MISSING_GOAL_004` accettati come residual. Il rischio principale è il **bus factor 1** (R12 storico) — qualsiasi handover esterno richiederebbe 2-4 settimane di onboarding strutturato sui ~140 file `cowork_code_exchange/` + 18 ADR + 42 migrations + 58 moduli API + 47 routes FE.

Le **3 priorità P0 della prossima sessione** rimangono DEFER-F (showcase), CW-B60-A (engine), CW-B60-B (Wave 2 ADR) — totale 6-9h se eseguite sequenzialmente. Le P1 housekeeping (≤2h) andrebbero comunque eseguite prima per riportare il working tree in stato pulito e riallineare SoT documentale.

**Raccomandazione finale**: prima del prossimo step operativo, eseguire le P1 (housekeeping + commit + cleanup worktree) e i DOC-1..DOC-15 low-effort, per creare un **anchor stabile** (eventuale tag `v0.3.2.1-cleanup`). Poi decidere strategicamente quale dei 3 P0 affrontare per primo in base a tolleranza al rischio (DEFER-F è HIGH-RISK ma isolato; CW-B60-A/B sono MED-RISK ma legati al modulo brownfield-wave-executor critico).

---

**Fine relazione forensic.**
**Author**: Cowork (Claude Opus 4.7, sessione 2026-05-26)
**Method**: 7 subagent paralleli + lettura diretta + cross-check
**Files inspected**: ~300 (di cui ~50 letti integralmente, ~250 indicizzati via Glob/Grep)
**Token usage stimato**: ~900k (esplorazione + sintesi)
**Zero modifiche al codebase**, **zero segreti stampati**, **R9 token hygiene rispettata**.
