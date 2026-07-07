# WARGAME 14 — heuresys-advanced #28 A/L0 · Trust Ledger: read-API over provenance

- **Mission**: implement backlog item **#28 A/L0 — Trust Ledger: read-API over provenance** — expose `sys.sys_source_lineage_records` (~70,972 rows, today write-only) via `/v1/provenance` (per-record + aggregate) + admin UI panel, i18n it/en, RBAC proposal flagged for Enzo. GTM-citable (AI-Act / GDPR art. 22).
- **Executor**: Claude Code CLI (Sonnet or Opus) on `D:\heuresys-advanced` (Windows) or `/home/ubuntu/heuresys-advanced` (VM). DB: PostgreSQL 16 on OCI VM through SSH tunnel `localhost:5433`.
- **Wargamed**: 2026-07-06 by Fable 5 (read-only recon on the repo; no repo file was modified, no git command run there).
- **Sources of truth to RE-READ at execution, in this exact order (SoT wins over this document)**:
  1. `docs/kb/SOT_STATE.md`
  2. `docs/kb/SOT_BACKLOG.md` (item #28)
  3. `docs/kb/DEBT_REGISTER.md`
  4. `.handoff/STATE.md`
  5. Doc of record: `docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md` §L0 (+ §2-bis row "L0 provenance", §3 vincoli trasversali)
  6. Repo `CLAUDE.md` §"The module pattern" (7-step) and §"Tests" (D-52 tx isolation)
- **Binding constraints honored throughout**: D-51 boot-gate (orgGate on sensitive reads), D-52 (per-file tx isolation), D-12 (migrations twice-run idempotent), D-38 (migration asserts scoped to owned codes only), RD-08 (varchar+CHECK, never ENUM), I5 (tenant isolation = API filter, never RLS), live verification on https://www.heuresys.com. RBAC/product decisions are Enzo's authority: propose with evidence, flag, never silently decide.

---

## 1. RECON FINDINGS (verified, with evidence)

### 1.1 The data — VERIFIED

- **Table**: `sys.sys_source_lineage_records`, created in `db/migrations/000025_brownfield_lineage_and_mapping.sql:73-105`. Columns (all verified in DDL):
  - `source_lineage_record_id uuid PK`
  - `source_lineage_tenant_id uuid NOT NULL` FK → `sys.sys_tenancies` (**the table IS tenant-scoped**)
  - `source_lineage_source_system varchar(64) DEFAULT 'OLDDB'`, `source_lineage_source_table varchar(255)`, `source_lineage_source_record_id varchar(255)`, `source_lineage_source_natural_key varchar(512) NULL`, `source_lineage_source_content_hash char(64)`
  - `source_lineage_import_run_id uuid NULL` FK → `brownfield.import_runs` (which carries `import_run_wave smallint` — `000024_brownfield_import_staging.sql:72-80` — this is the JOIN for "aggregate by wave")
  - `source_lineage_table_mapping_id uuid NULL` FK → `brownfield.table_mappings`
  - `source_lineage_target_table_name varchar(255) NOT NULL`, `source_lineage_target_record_id uuid NOT NULL` (polymorphic target)
  - `source_lineage_mapping_confidence numeric(4,3) DEFAULT 1.000`, `source_lineage_validation_status varchar(32)` CHECK IN `('VALID','STALE','CONFLICTED','REJECTED')` (000025:91-95)
  - `source_lineage_metadata jsonb`, `created_at timestamptz`
- **SDBI audit columns** added by `db/migrations/000063_sdbi_infra.sql:116-131`: `source_lineage_sdbi_mapping_card_id varchar(128)`, `source_lineage_sdbi_confidence numeric(4,3)` (CHECK 0..1), `source_lineage_sdbi_ai_model_id varchar(128)`, `source_lineage_sdbi_human_approver varchar(255)`. These four are the AI-Act payload (which AI model mapped it, which human approved it). **NOTE (REVIEW-14 F5): brownfield-path rows leave all four NULL by design — 000063:111-113, no backfill; only the SDBI Option-B slice populates them.** R1's `sdbi_rows` probe measures the populated fraction before these columns go on screen (Move 6).
- **Indexes that matter** (created 000025:97-105; **live set = two**): unique `(source_system, source_table, source_record_id, target_table_name)`; **`sys_source_lineage_records_target_idx` on `(target_table_name, target_record_id)`** — the per-record lookup and the #27 evidence-link both ride this index. (the 000025 partial index on `source_natural_key` was DROPPED by `000131` as dead — it no longer exists live; do not recreate it, and do not plan any natural-key-filtered query on the assumption of index support.)
- **Row count**: **70,972** — verified in `qa_artifacts/dbms_health_2026-06-22/rowcount_all_tables.csv:221` (`sys,sys_source_lineage_records,70972`, dated 2026-06-22) and re-asserted by the dossier dated 2026-07-05. Per regola T2 the CSV is evidence, not SoT → re-derive live (RECON NEEDED R1).
- **Today the table is touched ONLY in write** by the wave-executor: `apps/api/src/modules/brownfield-wave-executor/{repository,engine,upsert-sql,transform-compiler}.ts`. No read module exists. No module named `provenance` exists under `apps/api/src/modules/` (verified directory listing, 83 module dirs).

### 1.2 The UI fork terrain — VERIFIED

- `/brownfield-adaptation` page: `apps/web/src/app/(authenticated)/brownfield-adaptation/page.tsx` (client component, `useTranslation("blueprints")`). It is **already a local-tab architecture**: `type Tab = "inventory" | "mapping" | "runs"` (page.tsx:31-32), each tab an `EntityTable` fed by `apiFetch("/v1/brownfield-...?limit=200")` with testids `brownfield-tab-<key>` / `brownfield-content-<key>`. A fourth tab is isomorphic and purely additive. Layout (`layout.tsx`) is a passthrough.
- **Sidebar/nav is DB-driven**: `db/migrations/000050_sys_ui_interfaces_registry.sql` — table `sys.sys_ui_interfaces` with CHECK on perspective and `(required_resource, required_action)` pair; row 000050:73 seeds `('brownfield','Brownfield','/brownfield-adaptation','Database','operations','OVERVIEW','brownfield_adaptation','read',true,22)`. Sidebar was re-organized to 5 sections in migration 000163 (backlog #22, decided by Enzo). **A NEW `/provenance` page therefore costs: a registry migration + a nav-placement decision that is Enzo's authority** (precedent #22). A panel inside the existing page costs neither.
- Existing E2E for the page: `apps/web/tests/e2e/admin-pipelines.spec.ts:21-31` — test "/brownfield-adaptation switches across 3 tabs", running with `storageStateFor("tenantAdmin")` (spec header: PLATFORM_ADMIN needed only for approvals, not exercised). It asserts the three existing testids only; it does not assert tab count.

### 1.3 RBAC terrain — VERIFIED

- Roles seeded in `db/migrations/000005_auth_foundation.sql:233-242`: `PLATFORM_ADMIN` (platform-level), `TENANT_ADMIN`, `HRMS_MANAGER`, plus BLUEPRINT_MANAGER / PROCESS_OWNER / MANAGER / USER / READ_ONLY (11 roles total per CLAUDE.md).
- `brownfield_adaptation:{trigger,read,approve}` seeded at 000005:355-358. **PLATFORM_ADMIN gets every permission** (catch-all CROSS JOIN, 000005:409-414). **TENANT_ADMIN gets everything except a denylist** — `tenant:create/delete, role:create/update, brownfield_adaptation:approve, reference_sync:read/trigger` (000005:415-423). → **TENANT_ADMIN already holds `brownfield_adaptation:read` today and already reads platform-import metadata on this very page** (confirmed independently by the E2E spec using the tenantAdmin persona).
- **Platform-only precedent**: `db/migrations/000085_reference_sync_platform_only.sql` — the canonical pattern for "this metadata is platform-global, revoke from TENANT_ADMIN" (DELETE grant + D-38-style owned-scope assert). This is the template IF Enzo rules provenance platform-only.
- HRMS_MANAGER's plenipotentiary grant (`000169_hrms_manager_data_plenipotentiary_grant.sql:7`) **explicitly excludes `brownfield_adaptation:*`** → precedent: import/lineage metadata is NOT an HRMS_MANAGER concern.
- NOTE (misleading comment, do not trust it): `apps/api/src/modules/brownfield-source-exports/service.ts:3` claims "PLATFORM_ADMIN-gated" — false; the route permission is `brownfield_adaptation:read` which TENANT_ADMIN holds. Trust the migrations, not that comment.

### 1.4 AuthZ / orgGate (D-51) — VERIFIED

- Taxonomy: `apps/api/src/lib/scope/data-classes.ts` — `RESOURCE_DATA_CLASS` maps RBAC **resources** to PERSONAL/COMPENSATION/SKILL/EVALUATION. **Neither `brownfield_adaptation` nor `provenance` is in the map** (lines 45-70). A resource not in the map "carries no person-level sensitive data and stays RBAC+tenant-gated" (data-classes.ts:13-14).
- Boot-gate: `apps/api/src/lib/scope/gate.ts` — refuses boot only when a read route's RBAC **resource is in the sensitive taxonomy** and lacks `config.orgGate`. Closed set `"service" | "catalog" | "aggregate"` (gate.ts:27).
- Precedent for our case: backlog **#25** (SOT_BACKLOG.md:64) — position sub-resources were NOT in the taxonomy → no orgGate required by D-51, "coerente coi sibling"; the dossier's prudential note was overruled by the gate itself. §L0 says the same for provenance: "nessun dato personale nuovo esposto (metadati di mapping)" — vincolo "PLATFORM/TENANT_ADMIN" (dossier line 30).
- orgGate declaration syntax when needed: `config: { orgGate: "service" }` alongside `preHandler` (seen in `apps/api/src/modules/insights/routes.ts:29,39,59,72`).

### 1.5 Module pattern & plumbing — VERIFIED

- 7-step pattern (repo CLAUDE.md §"The module pattern", mandatory): ① Zod schemas in `packages/shared/src/schemas/<module>.ts` + export in `packages/shared/src/index.ts` + subpath export in `packages/shared/package.json` (pattern at package.json:242-245 for brownfield-source-exports); ② `repository.ts` raw parameterized SQL (`$1,$2`, never interpolation); ③ `service.ts` with `ActorContext`; ④ `routes.ts` `FastifyPluginAsyncZod` + `requirePermission('<resource>:<verb>')` (CSRF only on writes — we have none); ⑤ register in `apps/api/src/app.ts` step 13 (`app.register(xRoutes, { prefix: "/v1/x" })`, sibling at app.ts:406); ⑥ integration test via `buildTestApp()`; ⑦ full `pnpm test` green + atomic commit.
- `ActorContext` = `{userId, tenantId: string|null, roles}` + `isPlatform()` — `apps/api/src/lib/actor.ts:21-30`; route builder `actorFromRequest` (actor.ts:36-39).
- **The brownfield read services ignore the actor entirely** (`brownfield-source-exports/service.ts:14-21` — `_actor` unused, no tenant filter). Safe there because `brownfield.*` tables have no tenant column. **NOT safe for lineage, which has `source_lineage_tenant_id NOT NULL`** — see RED-TEAM §7.
- Errors: typed classes with SCREAMING_SNAKE codes (`NotFoundError('X')` → 404); anti-enumeration on tenant boundary → 404, not 403.
- Tests: vitest singleThread, live DB through tunnel, **D-52 per-file tx isolation** (`test/helpers/tx-isolation.ts` wired in `setup.ts`; `now()` frozen per file; reads pass straight through — a read-only module is the easy case). Suite baseline at S1015: 186 files / 1285 tests / 0 fail.
- Commands: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm i18n:check` · `cd apps/api && pnpm exec vitest run test/<file>` · E2E `cd apps/web && pnpm test:e2e:prod` (on Windows Node ≥23 use `pnpm test:e2e:prod:node22` — D-36 Playwright crash).
- Migrations: 167 files, max `000169` (verified by directory listing 2026-07-06) → next expected `000170`, **re-derive live** (R2). `pnpm db:migrate` idempotent twice-run proven (D-12).
- CI workflows in `.github/workflows/`: build-web, i18n-parity, lint, playwright-smoke, shell-tests, showcase, state-lint, test-integration, typecheck (9 files; the number that triggers per push varies with path filters — pass = ALL checks triggered on the final commit are green, count re-derived via `gh run list`).
- Deploy: `bash scripts/align-clones.sh vm --deploy` (runs `vm-deploy.sh` → migrate + rebuild + restart). Live check target: https://www.heuresys.com, login persona `admin@` (real login — DoD live E2E per ADR-0026).
- i18n: `apps/web/src/locales/{it,en}/blueprints.json`, existing `"brownfield"` section at it/blueprints.json:71; the page uses namespace `blueprints`. Parity gate: `pnpm i18n:check` + CI `i18n-parity.yml`.

### 1.6 ASSUMED (explicitly not verified — each has a settling check in §2)

- A1. Live row count still ≈70,972 (CSV is 2026-06-22 evidence; wave runs may have added rows).
- A2. Next migration number is 000170 (another session may land first).
- A3. `source_lineage_source_natural_key` may contain PII-bearing values (emails/codici fiscali) for person-target rows. DDL allows it; content unknown offline.
- A4. No `provenance` resource already exists in `sys.sys_auth_permissions`, and `data-classes.ts` still lacks it at execution time.
- A5. `import_run_id` is populated on enough rows for a meaningful by-wave aggregate.
- A6. The live `sys_ui_interfaces` row for `/brownfield-adaptation` is active post-000163 re-org (needed only for fork A route B).
- A7. (REVIEW-14 F5) The 4 SDBI columns are populated ONLY on the SDBI Option-B slice — brownfield-path rows leave them NULL by design (000063:111-113, no backfill). R1's `sdbi_rows` FILTER measures the real populated fraction and drives Move 6's honest-labeling note for the AI-Act/GTM claim.

---

## 2. RECON NEEDED (exact settling checks — run at Move 1, all read-only)

All SQL through the tunnel: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "<SQL>"`.

- **R1 — live lineage count + shape** (settles A1, A5, A7, picks test fixtures):
  ```sql
  SELECT count(*) AS total,
         count(*) FILTER (WHERE source_lineage_import_run_id IS NULL) AS no_run,
         count(*) FILTER (WHERE source_lineage_sdbi_ai_model_id IS NOT NULL) AS sdbi_rows,
         count(DISTINCT source_lineage_tenant_id) AS tenants,
         min(created_at), max(created_at)
  FROM sys.sys_source_lineage_records;
  SELECT source_lineage_target_table_name, count(*) c
  FROM sys.sys_source_lineage_records GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
  ```
  Pass: total > 0 (expect ~70,972). Record the top target table — it seeds the per-record integration test. Record `sdbi_rows` — it feeds Move 6's "AI-Act columns populated on N of M rows" note (A7/F5). If total = 0 → ABORT-1.
- **R2 — next migration number** (settles A2): `ls db/migrations | tail -3`. Use max+1, zero-padded. Expected `000170_provenance_read_permission.sql`.
- **R3 — PII probe on natural keys** (settles A3, drives Move 4 masking decision):
  ```sql
  SELECT source_lineage_target_table_name,
         left(source_lineage_source_natural_key, 60) AS nk_sample
  FROM sys.sys_source_lineage_records
  WHERE source_lineage_source_natural_key IS NOT NULL
  ORDER BY random() LIMIT 12;
  ```
  If any sample looks like an email / fiscal code / full name → take fork D route B (omit `naturalKey` from API responses; keep it queryable only via DB). Log the finding for Enzo either way. Do NOT paste raw PII values into commits, docs, or reports (secret/PII hygiene) — describe the shape only.
- **R4 — permission & taxonomy virginity** (settles A4):
  ```sql
  SELECT auth_permission_code FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'provenance';
  ```
  plus `grep -n "provenance" apps/api/src/lib/scope/data-classes.ts`. Expected: 0 rows and no grep hit. If the permission already exists → skip its INSERT in Move 2 (keep the grants + assert). If data-classes already maps `provenance` → fork B route B applies from the start.
- **R5 — SoT re-read** (mandated by execution constraints): re-read the four SoT files in order; confirm #28 is still ACTIVE and no session landed a conflicting `/v1/provenance`. `grep -rn "v1/provenance" apps/api/src` must return 0 hits. If it doesn't → ABORT-2.
- **R6 — (only if fork A route B) live nav registry**: `SELECT * FROM sys.sys_ui_interfaces WHERE ui_interface_route IN ('/brownfield-adaptation','/provenance');` — gives the current sidebar_group/perspective values to mirror.

---

## 3. THE FORKS (triggers first — no judgment calls)

### Fork A — UI placement: panel inside `/brownfield-adaptation` vs new `/provenance` page

- **DEFAULT (route A): fourth tab "provenance" inside `/brownfield-adaptation`.** Grounding: the page is already a flat local-tab container (page.tsx:31-32) — a provenance tab is isomorphic to the existing three and additive; the dossier itself calls it "fit naturale" (§2-bis line 73); a NEW page requires a `sys_ui_interfaces` migration + sidebar placement, and nav placement is Enzo's authority (precedent #22/mig 000163) — a silent new nav item would violate the "never silently decide" constraint; effort budget is ~4h.
- **Trigger to route B (new `/provenance` page)**: take it ONLY if R6/R5 shows Enzo has pre-approved it — i.e. a `/provenance` row already exists in `sys_ui_interfaces`, or SOT_BACKLOG/#28 note or `.handoff/STATE.md` explicitly says "nuova pagina /provenance". Route B additionally requires: registry INSERT migration mirroring 000050:73 (resource `provenance`, action `read`, group/perspective copied from the live brownfield row per R6), a `page.tsx`+`layout.tsx` under `apps/web/src/app/(authenticated)/provenance/`, and a nav E2E touch. Everything else in this plan is identical.
- **In BOTH routes**: flag in the final report: "panel can be promoted to a `/provenance` page later; promotion = registry migration + moving the component — decision Enzo".

### Fork B — orgGate class (D-51)

- **DEFAULT (route A): `provenance` resource stays OUT of `RESOURCE_DATA_CLASS` → no orgGate declaration needed, none written.** Grounding: data-classes.ts:13-14 (unmapped = no person-level data, RBAC+tenant gated), dossier §L0 line 30 ("nessun dato personale nuovo esposto — metadati di mapping"), precedent #25 (SOT_BACKLOG.md:64). The boot-gate itself is the arbiter: if it boots, the claim holds.
- **Trigger to route B**: the API refuses to boot with the gate.ts violation message listing `/v1/provenance` routes (meaning `provenance` got classified sensitive between recon and execution — R4 grep hit, or a rebase brought it in). Then: declare `config: { orgGate: "aggregate" }` on the stats route and `config: { orgGate: "catalog" }` on the per-record routes (they return mapping-metadata rows, not person rows — the closed-set semantics per gate.ts:14-16), syntax as insights/routes.ts:29. Flag the classification to Enzo in the report — do not remove the taxonomy entry yourself.

### Fork C — RBAC scope: platform-admin only vs tenant-admin (PROPOSAL — Enzo decides)

- **PROPOSAL (implement as default): new dedicated permission `provenance:read`, granted to PLATFORM_ADMIN + TENANT_ADMIN, with rows tenant-filtered in the service.** Evidence: (i) TENANT_ADMIN already reads this page and the sibling brownfield metadata today (000005:415-423 denylist excludes only `:approve`; E2E runs as tenantAdmin — admin-pipelines.spec.ts:12); (ii) lineage rows are tenant-scoped by schema (`source_lineage_tenant_id NOT NULL`) — each tenant admin auditing "where did MY records come from" is exactly the GDPR art. 22 story; (iii) dossier §L0 line 30 says "PLATFORM/TENANT_ADMIN"; (iv) dedicated permission (not reuse of `brownfield_adaptation:read`) per dossier §3 "permission NUOVE dedicate". Do NOT grant HRMS_MANAGER (precedent 000169:7 excludes brownfield_adaptation:*).
- **Alternative for Enzo**: strict PLATFORM_ADMIN-only, template = `000085_reference_sync_platform_only.sql` (revoke + owned-scope assert). One small follow-up migration if he rules that way — structure Move 2's migration so this is a clean delta.
- **Trigger to implement the alternative immediately**: only if Enzo has already answered (check `.handoff/STATE.md` open-questions and #28 note at R5). Otherwise implement the proposal and **FLAG**: the final report and the SOT_BACKLOG #28 note MUST contain a "DECISIONE ENZO PENDING: provenance:read a TENANT_ADMIN (implementato, tenant-filtered) vs PLATFORM_ADMIN-only (template 000085)" line. Never silently decide — implementing the evidence-backed default WITH the flag is the sanctioned behavior here.

### Fork D — naturalKey exposure (from R3)

- Route A (R3 samples are opaque ids/codes): include `sourceNaturalKey` in the per-record response.
- Route B (R3 shows email/CF/name-like content): **omit `sourceNaturalKey` and `sourceContentHash` stays, naturalKey goes** — the field is dropped from the Zod response schema and the SELECT list; note it for Enzo ("esposizione naturalKey richiede decisione privacy"). Default-safe beats feature-complete on a GTM/GDPR deliverable.

---

## 4. MOVES

Run from repo root. Tunnel first. Never `git push --force`, never `reset --hard`, no `--no-verify`.

**Move 0 — Preflight.**
Action: `ssh -fN -L 5433:localhost:5432 oracle-vm-default` (skip if up); `git status` (must be clean); `git pull --ff-only`; SoT read order (R5); `pnpm install --frozen-lockfile` if lockfile changed; optional `pnpm status`.
Expected: clean tree, tunnel answers `psql ... -c "SELECT 1"`, #28 ACTIVE.
Likely failure: tunnel port 5433 already bound → an old tunnel exists → reuse it (test with the SELECT 1) instead of spawning a second. Second failure: dirty tree → previous session residue → STOP and report (never discard changes silently).

**Move 1 — Live recon (R1–R6).**
Action: run every check in §2; write the numbers into the session log.
Expected: total ≈70,972; a top target table with thousands of rows; next migration number known; R4 virgin.
Likely failure: R1 total = 0 → the premise of the mission is gone (data purged/moved) → ABORT-1. R5 grep hit → someone shipped provenance already → ABORT-2.

**Move 2 — Migration `0001NN_provenance_read_permission.sql`** (NN from R2; on the model of 000085 in reverse).
Action: create the migration with exactly: (a) `INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action) VALUES ('provenance:read','Read data provenance / lineage','provenance','read') ON CONFLICT (auth_permission_code) DO NOTHING;` (mirror the exact column list from 000005:355-358 — re-check the real column names in 000005 §2.9 before writing); (b) grants to PLATFORM_ADMIN and TENANT_ADMIN via the SELECT-JOIN insert pattern of 000005:409-423 with `ON CONFLICT DO NOTHING` (the 000005 catch-alls ran in the past — a new permission needs explicit grants); (c) a `DO $$` post-condition asserting **only the code this migration owns** (D-38): `provenance:read` exists AND is granted to exactly the 2 intended roles — count grants joined on that single code, expect 2. No CHECK constraints needed (no new table; RD-08 not in play).
Then run `pnpm db:migrate` (or `bash db/scripts/migrate.sh`) **twice** (D-12).
Expected: first run applies with the NOTICE; second run is a clean no-op EXIT 0.
Likely failure: assert counts 3+ grants → cause: a catch-all or another migration also granted it (or you wrote a resource-wide count — D-38 violation) → counter-move: scope the assert strictly by `auth_permission_code = 'provenance:read'` and enumerate the role codes in the assert; if a third role legitimately shows up, STOP and check which migration granted it before "fixing" the number. Second failure: chain breaks on an EARLIER migration → pre-existing drift, not yours → ABORT-3.

**Move 3 — Shared contracts `packages/shared/src/schemas/provenance.ts`.**
Action: Zod schemas (read-only module → no Create/Update): `ProvenanceRecordSchema` (camelCase projection of every column in §1.1, honoring fork D; include `sourceLineageRecordId`, `tenantId`, `sourceSystem`, `sourceTable`, `sourceRecordId`, `sourceContentHash`, `importRunId`, `tableMappingId`, `targetTableName`, `targetRecordId`, `mappingConfidence`, `validationStatus`, `sdbiMappingCardId`, `sdbiConfidence`, `sdbiAiModelId`, `sdbiHumanApprover`, `createdAt`), `ProvenanceListQuerySchema` (`targetTable?`, `targetRecordId?`, `sourceTable?`, `validationStatus?` (enum of the 4 CHECK values), `importRunId?`, `limit` default 50 max 200, `offset` default 0), `ProvenanceListResponseSchema` (`{items, total}` — the envelope the brownfield page already consumes, page.tsx:66), `ProvenanceIdParamSchema`, `ProvenanceStatsResponseSchema` (`{ total, avgMappingConfidence, byTargetTable: [{targetTableName, rows, avgConfidence}], bySourceTable: [...], byWave: [{wave: number|null, rows}], byValidationStatus: [{status, rows}], firstImportedAt, lastImportedAt }`). Export from `packages/shared/src/index.ts` AND add the `./schemas/provenance` subpath export in `packages/shared/package.json` (copy the shape at package.json:242-245). Do NOT include `sourceLineageMetadata` in any response schema — SDBI-path rows carry legacy jsonb provenance there (000063:111-113); it stays DB-only, same posture as fork D route B for naturalKey (REVIEW-14 F6).
Expected: `pnpm typecheck` green at workspace level.
Likely failure: web later fails `TS2307 Cannot find module '@heuresys/shared/schemas/provenance'` → cause: subpath export forgotten (the classic omission the codegen dossier warns about) → add it.

**Move 4 — API module `apps/api/src/modules/provenance/` (3 endpoints, read-only).**
Action:
- `repository.ts`: raw parameterized SQL on `sys.sys_source_lineage_records`. **Every query carries `WHERE ($1::uuid IS NULL OR source_lineage_tenant_id = $1)` with `$1 = isPlatform(actor) ? null : actor.tenantId`** — this is the RED-TEAM patch (§7), non-negotiable. The `$1 IS NULL` branch is reserved for platform actors ONLY — it must never be reachable via a null `actor.tenantId` (fail-closed guard in service.ts below, REVIEW-14 F1). `list` (filters + `count(*) OVER()` or a twin count query, ORDER BY created_at DESC, LIMIT/OFFSET); `findById`; `stats` (one aggregate query GROUP BY GROUPING SETS or 4 small GROUP BYs; by-wave via `LEFT JOIN brownfield.import_runs r ON r.import_run_id = source_lineage_import_run_id` grouping on `r.import_run_wave` — NULL wave bucket = rows with no run, per R1).
- `service.ts`: builds the tenant filter from `ActorContext` (actor.ts:21-30); `getById` must re-check the returned row's tenant against a non-platform actor and throw `NotFoundError` (anti-enumeration 404, never 403) when foreign. Before any repo call, apply the repo-canonical fail-closed guard: `if (!isPlatform(actor) && actor.tenantId === null) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");` (pattern: `capability-maturity/service.ts:35`, `skills/service.ts:59`). The SQL predicate's `$1 IS NULL` branch is reserved for platform actors ONLY — never reachable via a null `actor.tenantId`.
- `routes.ts`: `FastifyPluginAsyncZod`; `GET /` (list), `GET /stats`, `GET /:id` — **register `/stats` BEFORE `/:id`** (find-my-way resolves static over parametric regardless of order, but `/stats` declared first also protects against a uuid-validating `:id` schema rejecting it — declare `/stats` first as belt-and-suspenders); all with `preHandler: [requirePermission("provenance:read")]` (rbac middleware per brownfield-source-exports/routes.ts:16). No CSRF (no writes). No orgGate (fork B route A).
- Register in `apps/api/src/app.ts` step 13: `await app.register(provenanceRoutes, { prefix: "/v1/provenance" });` next to the brownfield block (app.ts:406).
Expected: `cd apps/api && pnpm dev` boots (proves fork B route A: the D-51 gate accepted the unclassified resource); `curl -s localhost:3001/v1/provenance/stats` → 401 (unauthenticated) — the route exists and is guarded. list/stats are seq-scan+sort over ~70k rows by design — acceptable at current scale (verify: `EXPLAIN ANALYZE` the list query once, expect <150 ms through the tunnel). Do NOT add indexes in the permission migration; if R1 shows >500k rows, flag an index follow-up (`created_at DESC`) to Enzo instead of hand-adding it.
Likely failure 1: boot refusal with gate.ts violations naming provenance → fork B trigger → apply route B declarations. Likely failure 2: 404 on curl → module not registered / prefix typo → check app.ts. Likely failure 3: `RBAC_NOT_LOADED` or 403 for an admin later in tests → the Move 2 migration didn't reach the live DB or the API process pre-dates it → re-run migrate, restart the dev server (the RBAC cache loads once at start).

**Move 5 — Integration tests `apps/api/test/provenance.integration.test.ts`.**
Action: via `buildTestApp()` (`app.inject()`), 9 tests, per-file D-52 tx isolation (read-only module — no writes, no `now()` traps): (1) 401 unauthenticated; (2) 403 for a persona without `provenance:read` (e.g. USER/READ_ONLY login helper); (3) list as PLATFORM_ADMIN → 200, `total > 0`, item schema parses; (4) filter `?targetTable=<top table from R1>&targetRecordId=<an id fetched in-test via pool.query SELECT>` → 200 with ≥1 item whose keys match — **this is the #27 contract test** (§7.V6); (5) `GET /:id` happy path; (6) `GET /:id` with a random uuid → 404; (7) **tenant isolation**: login as tenantAdmin of a tenant OTHER than the rows' tenant (or synthesize expectations from R1's tenant distribution: a tenant with 0 lineage rows must see `total = 0`) and assert a foreign `:id` → 404; (8) `/stats` → 200, `total` equals the live `SELECT count(*)` executed in-test (derive expectations live, never hardcode 70972 — the #25 precedent "attese derivate live"); (9) null-tenant guard: build an ActorContext with a non-platform role and `tenantId: null` (service-level unit call, or inject a token if the login helper supports it) → expect `403 TENANT_REQUIRED`, not a full list (REVIEW-14 F1).
Run: `cd apps/api && pnpm exec vitest run test/provenance.integration.test.ts`.
Expected: 9/9 green in seconds.
Likely failure: (7) impossible because every tenant in the DB has lineage rows and the seeded personas all belong to the lineage tenant → cause: single-tenant dataset → counter-move: INSERT one synthetic lineage row for a second tenant inside the test (D-52 rolls it back at file end — this is exactly what the isolation harness is for) and assert the cross-visibility both ways. Second failure: stats total ≠ live count → your stats query double-counts via the JOIN (one run per row is fine; a bad join key would fan out) → aggregate from the base table, join only inside the by-wave subquery.

**Move 6 — Web panel (fork A route A): fourth tab in `page.tsx`.**
Action: extend `Tab` union + `TAB_KEYS` with `"provenance"`; add a `useQuery` on `apiFetch("/v1/provenance?limit=200")` (enabled on tab) + one on `/v1/provenance/stats`; render: a stats strip (total rows, avg confidence, by-wave counts — simple cards or a compact `EntityTable`, composing existing primitives only) above an `EntityTable<ProvenanceRecord>` with columns sourceTable → targetTable, targetRecordId (mono, truncated), confidence, validationStatus (`StatusBadge`), sdbiAiModelId, sdbiHumanApprover, createdAt; **drill-down** = a client-side filter: clicking a by-target-table stats row sets `targetTable` on the list query (mission asks "UI panel with drill-down" — filter-drill satisfies it without new routes). testids: `brownfield-tab-provenance`, `brownfield-content-provenance`, `brownfield-provenance-row`, `brownfield-provenance-empty`, `brownfield-provenance-stats`. Types from `@heuresys/shared/schemas/provenance`. Expect `sdbi*` columns to be NULL on all brownfield-path rows (000063 invariant) — render `—`, and if R1's `sdbi_rows` is a small fraction, keep the two SDBI columns but note in the report: "AI-Act columns populated on N of M rows (SDBI-path only)" so the GTM claim is stated honestly (REVIEW-14 F5).
i18n: add `brownfield.tabs.provenance`, `brownfield.provenance.*` (columns, captions, statsLabels, empty) to BOTH `apps/web/src/locales/it/blueprints.json` and `en/blueprints.json`; run `pnpm i18n:check`.
Expected: `pnpm typecheck` + `pnpm i18n:check` green; local `pnpm dev` shows the 4th tab with real rows.
Likely failure: parity check red → a key exists in one locale only → mirror it. Rows render but confidence shows as string → numeric(4,3) comes back as string from pg → coerce in the Zod schema (`z.coerce.number()`) — decide it in Move 3, verify here.

**Move 7 — E2E extension.**
Action: in `apps/web/tests/e2e/admin-pipelines.spec.ts`, extend the existing 3-tab test (or add a sibling): click `brownfield-tab-provenance`, expect `brownfield-content-provenance` visible AND at least one `brownfield-provenance-row` (live data — 70k rows guarantee non-empty). It runs as tenantAdmin — which also proves fork C's grant works end-to-end.
Run: `cd apps/web && pnpm test:e2e:prod` (Windows Node ≥23: `pnpm test:e2e:prod:node22` — D-36).
Expected: spec green.
Likely failure: rows empty as tenantAdmin while API tests passed as platform → the tenantAdmin persona's tenant owns no lineage rows (R1 told you the distribution) → this is CORRECT behavior; switch the E2E assertion for that persona to the stats/empty-state OR use the platformAdmin storage state for the row assertion, and note the tenant distribution in the report.

**Move 8 — Full gates + atomic commit.**
Action: `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · `pnpm test` (full API suite — 0 fail, D-52 harness; expect ~187 files now) · `pnpm typecheck:test` in apps/api. Fix EVERY red, including pre-existing ones (R3 regola: non esiste "pre-esistente"). Commit: `feat(api+web): #28 A/L0 — provenance read-API + brownfield panel (3 endpoints, 9 tests, i18n it/en)` — include the migration, shared, api, web, e2e, locales. Grep the staged diff for secrets before committing.
Expected: everything green, one atomic commit.
Likely failure: an unrelated test file flakes (tunnel hiccup) → re-run that file alone; if deterministic red not caused by you and non-trivial to fix → ABORT-4 (report, don't bury).

**Move 9 — Push, CI, deploy, LIVE verification.**
Action: `git push` → watch `gh run list --commit <sha>` until all triggered workflows green. Then `bash scripts/align-clones.sh vm --deploy` (vm-deploy runs `db:migrate:sh` — the migration re-applies idempotently, D-12 proven in Move 2). Then LIVE: log in on https://www.heuresys.com as `admin@` persona (real login, ADR-0026 — credentials via `.secrets/`, never echo them), open `/brownfield-adaptation`, click Provenance: **real lineage rows on screen**; switch header language IT↔EN: labels translate; and API-level: verify via the browser DevTools Network tab while clicking the Provenance tab (the SPA's own `apiFetch` shows the real prod path), or replay that exact request with the session cookie (REVIEW-14 F7) — the `/v1/provenance/stats` response `total` = R1's count.
Expected: panel renders live rows; stats total matches the live DB count re-queried through the tunnel at the same moment.
Likely failure: panel 403 in PROD while local green → PROD API process started BEFORE the migration grant → cause: RBAC cache staleness → vm-deploy restarts the API after migrate, so if you deployed via align-clones this cannot happen; if it does, restart the API service on the VM (vm-deploy.sh's restart step) and re-check.

**Move 10 — Close the loop (SoT + flags).**
Action: update `docs/kb/SOT_BACKLOG.md` #28 → DONE with evidence note (endpoints, tests, live check) **including the fork C flag line for Enzo** (§3) and fork D finding if route B taken; touch `.handoff/STATE.md` per handoff governance. Do not edit SOT_STATE counts by hand beyond what its governance prescribes.
Expected: SoT reflects reality; Enzo's pending decision is impossible to miss.
Likely failure: none mechanical; the risk is forgetting the flag — the verification run V8 checks it.

---

## 5. ABORT CONDITIONS (stop, report to Enzo, do not improvise)

- **ABORT-1**: R1 returns 0 (or absurdly small) lineage rows — the 70,972-row premise is void; the deliverable's GTM claim would be false.
- **ABORT-2**: `grep -rn "v1/provenance" apps/api/src` non-empty at Move 1, or SoT shows #28 no longer ACTIVE — someone else shipped or descoped it.
- **ABORT-3**: `pnpm db:migrate` fails on a migration EARLIER than yours — pre-existing chain drift (class D-12); fixing other people's migrations mid-mission needs Enzo's eyes.
- **ABORT-4**: full suite has deterministic failures unrelated to this change that resist one honest fix attempt — do not paper over, do not `--no-verify`, do not skip files.
- **ABORT-5**: boot-gate refuses boot even AFTER fork B route B declarations — means the gate semantics changed under you; do not weaken gate.ts or data-classes.ts to pass.
- **ABORT-6**: any response field found carrying raw legacy personal values at live verification (GDPR-posture contradiction) — pull the offending field from the response schema, redeploy; if still leaking, revert the deploy flag and stop. (Note: `sourceLineageMetadata` is already excluded from every response schema by Move 3 — this abort covers whatever slips through anyway, not a field the plan opens. REVIEW-14 F6.)
- **ABORT-7**: any step would require `git push --force`, `git reset --hard`, history rewrite, or deleting files — forbidden here outright.

---

## 6. VERIFICATION RUNS (executor performs ALL, in this order; pass criteria explicit)

| # | When | Run | PASS looks like |
|---|---|---|---|
| V1 | Move 2 | `pnpm db:migrate` ×2 | 1st: applies `0001NN` with NOTICE; 2nd: full chain EXIT 0, no-op (D-12). |
| V2 | Move 2 | `psql ... -c "SELECT r.auth_role_code FROM sys.sys_auth_role_permissions rp JOIN sys.sys_auth_roles r USING (auth_role_id) JOIN sys.sys_auth_permissions p USING (auth_permission_id) WHERE p.auth_permission_code='provenance:read' ORDER BY 1"` | Exactly `PLATFORM_ADMIN, TENANT_ADMIN` (fork C default). |
| V3 | Move 4 | boot API + `curl localhost:3001/v1/provenance/stats` | Boot succeeds with NO orgGate declared (fork B proof) and curl → 401 envelope `{error:{code,...}}`. |
| V4 | Move 5 | `pnpm exec vitest run test/provenance.integration.test.ts` | 9/9 green (incl. test 9 `TENANT_REQUIRED` null-tenant guard — REVIEW-14 F1); totals derived live, none hardcoded. |
| V5 | Move 8 | `pnpm typecheck` · `pnpm lint` · `pnpm i18n:check` · `pnpm test` | All green; full API suite **0 fail** (D-52 harness, tunnel up). |
| V6 | Move 5+8 | **#27 no-rework contract test** (test #4 of Move 5) | `GET /v1/provenance?targetTable=<T>&targetRecordId=<id>` returns the lineage row(s) for a canonical record addressed by the SAME composite key an evidence record carries about itself. **Contract choice that guarantees it**: per-record lookup is addressed by `(targetTableName, targetRecordId)` — the polymorphic pair every canonical row (hence every future evidence row) already knows about itself, riding the existing index `sys_source_lineage_records_target_idx` (000025:100). #27's drill-down later becomes one `apiFetch` with keys it already possesses + a deep-link `?targetTable=&targetRecordId=` into the panel — zero provenance-side schema or route change. The response also exposes stable `sourceLineageRecordId` for permalinking. |
| V7 | Move 9 | CI on pushed commit: `gh run list --commit <sha>` | Every triggered workflow green (typecheck, lint, test-integration, i18n-parity, build-web, + any path-triggered others). |
| V8 | Move 9-10 | LIVE www.heuresys.com: real `admin@` login → `/brownfield-adaptation` → Provenance tab; language toggle IT↔EN; stats total vs live `SELECT count(*)` | Real lineage rows render (>0); labels translate both ways; on-screen/stats total == live DB count at the same timestamp; SOT_BACKLOG #28 note contains the "DECISIONE ENZO PENDING (RBAC)" flag. |

---

## 7. RED-TEAM RECORD (point 7 of SUCCESS.md)

**Attack that FAILED against the plan** — "Adding a 4th tab breaks the existing E2E and the mid-tier executor, seeing red on a file it barely touched, starts refactoring the spec." Examined `apps/web/tests/e2e/admin-pipelines.spec.ts:21-31`: the test asserts the three existing tab testids individually and never asserts tab COUNT, order, or last-position; a 4th `TAB_KEYS` entry is invisible to it. The default tab stays `inventory` (page.tsx:63), so the initial-visibility assertion also survives. Attack rejected; Move 7 only ADDS assertions. (Residual: if the spec ever asserted `toHaveCount(3)` after a rebase, the counter-move is to update the count in the same commit — additive, not refactor.)

**Attack that SUCCEEDED + patch applied** — "The executor copies the sibling module verbatim, as the 7-step pattern invites it to." The natural donor is `brownfield-source-exports/service.ts:14-21`, whose service **ignores the actor entirely** (`_actor`, no tenant WHERE) — safe there because `brownfield.*` tables carry no tenant column, and even labeled 'PLATFORM_ADMIN-gated' by a comment that is factually wrong (TENANT_ADMIN holds the permission per 000005:415-423). Copy that shape onto `sys_source_lineage_records` — which HAS `source_lineage_tenant_id NOT NULL` — and every TENANT_ADMIN reads every other tenant's lineage: a cross-tenant leak violating I5, on the very feature whose sales pitch is GDPR posture, exposed to the weakest-privileged role that can reach the page. **Patch, applied to the plan**: Move 4 hard-codes the tenant predicate into every repository query with `isPlatform()` bypass and 404 anti-enumeration on foreign ids; Move 5 test #7 makes the leak a red test (with the synthetic-second-tenant fallback so the test cannot be silently skipped); V2 pins the grant set so the blast radius of the permission is known. This is also why fork C can safely propose TENANT_ADMIN access at all. (REVIEW-14 F1 subsequently found a residual fail-open branch inside this very patch — closed below.)

**Independent adversarial review 2026-07-06 (REVIEW-14)** — verdict: APPROVED WITH PATCHES (0 CRITICAL · 0 HIGH · 1 MEDIUM · 5 LOW · 2 INFO); 16/16 substantive claims verified against the repo; all patches applied to this document:

- **F1 · MEDIUM** — the mandated tenant predicate failed OPEN for a non-platform actor with `tenantId: null` (`$1 IS NULL` branch, reachable via actor.ts:23) vs the repo's fail-closed canon (skills/service.ts:59, goals/service.ts:22, capability-maturity/service.ts:35) → fail-closed `TENANT_REQUIRED` guard added to Move 4 service.ts + test (9) added to Move 5 + V4 updated.
- **F2 · LOW** — stale index claim: the 000025 partial natural-key index was itself dropped by 000131 (not a "variant") → §1.1 corrected: live set = 2 indexes, no natural-key-filtered query may assume index support.
- **F3 · LOW** — unstated perf trade-off: no index supports the default list ordering or the tenant filter → seq-scan-by-design note + one-off `EXPLAIN ANALYZE` check + >500k-rows escalation-to-Enzo added to Move 4 Expected.
- **F4 · LOW** — false rationale on `/stats`-before-`/:id` (find-my-way resolves static over parametric regardless of registration order) → parenthetical corrected in Move 4; instruction kept as belt-and-suspenders.
- **F5 · LOW** — SDBI "AI-Act payload" columns are NULL on all brownfield-path rows by design (000063:111-113), an unmarked assumption put on screen → `sdbi_rows` FILTER probe added to R1, honest-labeling note added to Move 6, §1.1 corrected, assumption registered as A7.
- **F6 · LOW** — ABORT-6 referenced a leak path the schema never opens (`metadata` jsonb) → Move 3 now excludes `sourceLineageMetadata` explicitly; ABORT-6 trigger generalized to "any response field carrying raw legacy personal values".
- **F7 · INFO** — Move 9 live API check contained a literal `...` in the URL → replaced with DevTools-Network / cookie-replay verification wording.
- **F8 · INFO** — line-cite drift ±1-2 on three claims (content exact in all cases) → no patch required; cites remain grep-anchored.

---

## 8. SELF-GRADE vs SUCCESS.md (8 points)

1. **Expected observation per move** — PASS. Every move 0-10 states what green looks like (boot message, curl status, test counts, EXIT 0, rows on screen).
2. **Likely failure + cause + counter-move per move** — PASS. Each move carries its dominant failure with the signal it sends (e.g. TS2307→missing subpath export; 403-in-PROD→RBAC cache staleness) and the counter.
3. **Forks with triggers** — PASS. Four forks (UI placement, orgGate, RBAC scope, naturalKey PII), each with an observable trigger (registry row / SoT note; boot-gate refusal; Enzo's pre-answer in .handoff; R3 sample shape). No judgment left: defaults are declared and evidence-grounded.
4. **RECON NEEDED marked with exact settling checks** — PASS (REVIEW-14: one unmarked assumption had slipped through — SDBI column population, F5 — now registered as A7 and settled by R1's `sdbi_rows` probe). R1-R6 are copy-pasteable SQL/greps with expected outputs and the fork each one feeds.
5. **Abort conditions** — PASS. Seven, each an observable state, each "stop and report", including the git-safety absolutes.
6. **Verification spelled out** — PASS. V1-V8 with when/command/pass-criteria, including the #27 no-rework contract stated as a testable API-addressing choice (composite `(targetTableName, targetRecordId)` on the existing index).
7. **Red-team survived and recorded** — PASS (REVIEW-14: the successful attack's patch itself carried a fail-open null-tenant branch, F1 — the red-team stopped one step short of the repo's fail-closed canon; closed via the Move 4 guard + Move 5 test 9). One rejected attack (E2E fragility — checked against the actual spec) and one successful attack (verbatim-copy cross-tenant leak, grounded in real file evidence) with its patch woven into Moves 4/5 and V2.
8. **Executable blind** — PASS with one honest caveat: every command, path, file:line and schema field is in the doc, and live unknowns are pre-chewed into R-checks with routed outcomes; the only genuinely open item is deliberately NOT for the executor (fork C is Enzo's call — the plan makes the flag mandatory rather than resolvable, which is the constraint, not a gap).

Grade as originally written: **8/8** self-assessed, with point 8's caveat disclosed. **Independent adversarial review (REVIEW-14, 2026-07-06) graded the as-written plan 7.5/8** — the half-point gap being F1 (fail-open null-tenant branch inside the red-team patch itself, point 7) plus the unmarked F5 SDBI-population assumption (point 4). Both gaps are now closed in this document (Move 4 fail-closed guard + Move 5 test 9; R1 `sdbi_rows` probe + Move 6 honest-labeling note + A7), along with all LOW/INFO patches (F2-F4, F6-F7). **Post-patch grade: 8/8**, with the independent review on record in §7.
