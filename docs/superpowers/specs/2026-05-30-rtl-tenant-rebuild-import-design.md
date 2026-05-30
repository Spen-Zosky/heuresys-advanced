# RTL tenant rebuild — IMPORT-DESIGN PROPOSAL (Phase 2 output, read-only)

**Date**: 2026-05-30 · **Owner**: CLI · **Status**: PROPOSAL — read-only enumeration complete, **no DB writes performed**. Awaits Enzo's decisions before any WRITE phase.
**Companion**: `2026-05-30-rtl-tenant-rebuild.md` (the 7-phase SPEC). **Backup in place**: `pg_dump_snapshots/heuresys_advanced_pre-rtl-rebuild_eb55058_20260530.dump` (417 MB, HEAD `eb55058`).
**Canonical legacy source (confirmed by Enzo)**: live Docker DB `heuresys_evo_platform_db` (db `heuresys_platform`, 1021 MB) on OCI VM.
**Evidence**: workflow `wf_bed10de5-2fc` (5 structured scouts) + recovered `rbac-ui` scout — all counts verified by live query 2026-05-30.

---

## 0. RESOLVED DECISIONS (2026-05-30, Enzo — locked)

| # | Decision | Resolved choice |
|---|---|---|
| D1 | Position cardinality | **~158, one position per employee** (full I1; derived from `employees.position_id` × `org_unit_id`; reports_to from `manager_id` w/ cycle-check) |
| D2 | Tenancy creation | **Repurpose `86ba7a65`→rtl-bank.org** (1-row UPDATE, code RTL_BANK_REFERENCE→RTL_BANK, clear synthetic; zero FK churn) + create fresh **heuresys.com** tenancy, re-point 3 users |
| D3 | E2E personas | **Re-wire to REAL users + DELETE `rtl-bank.test`** — platformAdmin→heuresys.com user; tenantAdmin/manager/employee→real rtl-bank.org by RBAC role; set known test passwords; update `tests/e2e/fixtures.ts`+`auth.setup.ts` BEFORE delete. `admin@heuresys.com` untouched |
| D4 | RBAC→UI | **Full per-permission port** — grant `sys_user_auth_roles` by legacy role-map (SUPERUSER→PLATFORM_ADMIN, TENANT_OWNER→TENANT_ADMIN, IT_ADMIN→TENANT_ADMIN, HR_DIRECTOR+HR_MANAGER→HRMS_MANAGER, DEPT_HEAD+LINE_MANAGER→MANAGER, EMPLOYEE→USER) + add `GET /v1/me/permissions` + nav-metadata layer + per-item sidebar filtering (replace coarse `hasAdminRole`) |
| D5 | Skill/cert import | **Complete** — employee_skills(905)→user_skill_evidence + skill_profiles(312 KSABA, explode→5 assessment_results) + assessments(299) + certifications(729)→user_certifications + tenant_custom_skills(25); join via esco_uri |
| D6 | HR history | **Top-up to full real fidelity** — import ~2924 missing legacy-rtl attendance rows (ON CONFLICT natural-key dedup) so real users have full history; the 4962 synthetic SYSTEM rows drop with the synthetic users |
| D7 | Org unit types | **COLLAPSE onto v5 8 types** (company→HEADQUARTERS, direction→DIVISION, group→DEPARTMENT; DIVISION/OFFICE/TEAM 1:1); legacy `org_type` saved in `metadata` jsonb (recoverable, promotable later). v5 CHECK-constrained catalog left intact. Sub-defaults: exclude TEST-AUTH roots; heuresys keep 3 hand-authored OUs + drop 4 PROTO; `org_units` canonical (not `tenant_org_units`) |
| D8 | CI / shared-DB | **Pause OCI self-hosted runner + single-transaction atomic delete** (assert KEEP=161/DELETE=272 before COMMIT — D3 moves the 4 rtl-bank.test personas into DELETE) + re-run `db:seed-test-admin` after; fresh backup at WRITE-session start |

These 8 choices parameterize the §8 WRITE plan. **No DB writes performed; authoring the WRITE migrations and executing them each require separate approval.**

---

## 1. Executive reframe — this is WIRING, not a re-import

The single most important finding: **most of the target data is already in v5.** The 2026-05 RTL import already loaded the people and the HR history; what was never done is the *organizational wiring* and the *RBAC*. So the rebuild is a **match-and-wire + targeted-import + tenant-collapse + sanitize**, not a bulk re-import.

| Already in v5 (DO NOT re-import) | Missing in v5 (the actual work) |
|---|---|
| 158 real rtl-bank.org users (**100% match** to legacy) + 3 heuresys.com | Org structure wiring (real OUs, positions, assignments) |
| HR history: attendance 5199, overtime 380, time_off 99 (overlap **proven** on natural-key=legacy id) | RBAC role grants for real users (only 5 users have roles today) |
| ESCO skill taxonomy: sys_skills 20048 (14011 esco_uri exact match), families 77, edges 11965 | User profiles (1 row), comp profiles (0), skill evidence (0), assessments (0), certifications (4) |
| ESCO→job_role crosswalk: sys_esco_occupation_mappings **7645 rows** | tenant_custom_skills (25 rtl, the one genuine skill-catalog gap) |

**Match key (proven 100%, 158/158 rtl + 2/2 heuresys)**: `v5 sys_users.user_external_code = 'LEGACY:' || legacy.public.users.id`. Chain to resolve a person: `v5 external_code → legacy users.id → users.employee_id → employees(.tenant_id,.position_id,.org_unit_id,.manager_id)`. **Do NOT join on employees.id directly** (external_code embeds the AUTH user uuid, not the employee uuid → 0 matches).

---

## 2. The problem, in verified numbers

**v5 `heuresys_advanced` today**: 1 active tenancy `86ba7a65` (RTL_BANK_REFERENCE, synthetic) + 1 archived. 433 users / 1 tenancy, separated only by email domain:

| domain | n | synthetic | wired to a position? | has RBAC role? |
|---|---|---|---|---|
| rtl-bank.org (REAL) | 158 | no | **0** | no |
| rtl-bank-reference.example.com (SYNTHETIC scaffold) | 158 | yes | 158 (all 161 assignments) | no |
| smartfood.org | 82 | no | 0 | no |
| econova.org | 26 | no | 0 | no |
| rtl-bank.test (E2E personas) | 4 | no | 3 | 4 |
| heuresys.com | 3 | no | 0 | 1 |
| legacy.heuresys.local | 2 | no | 0 | no |

Diagnosis: org-chart/dashboards render **only** on the 158 synthetic scaffold (161 positions, 6 OUs, 1 owner). The 275 real users are anagraphics + HR history with **no org position and no RBAC**.

**Legacy `heuresys_platform`** (canonical source): 4 tenants — rtl-bank 158 / smartfood 82 / econova 26 / heuresys 4. The two we keep:

| legacy tenant | id | employees | org_units | jobs (catalogue) |
|---|---|---|---|---|
| rtl-bank | `0c54b84a-db6e-4da4-bc91-af5d480d524e` | 158 | 32 | 8 |
| heuresys | `d5855519-3ed1-4427-865f-fe75f1e42c4c` | 4 | 8 | 3 |

---

## 3. Strategy — MATCH-AND-WIRE + REBUILD-org + targeted import

1. **Match-and-wire** the existing 158 real rtl-bank.org users (+3 heuresys.com): preserve their `user_id`, auth identities, and the ~196 FK references. Never delete+re-insert them.
2. **REBUILD** the org/position layer from legacy: drop the 6 synthetic OUs + 161 synthetic positions + 161 synthetic assignments; import the 32 real rtl + 8 real heuresys OUs and synthesize real positions, then wire the real users.
3. **Targeted import** of the genuinely-missing domains (profiles, comp profiles, skill evidence/assessments/certs, tenant_custom_skills, RBAC role grants).
4. **SKIP** already-migrated data (HR history, ESCO taxonomy) — guard every insert with `ON CONFLICT DO NOTHING` on the natural-key.
5. **Collapse** to 2 tenancies and **delete** the out-of-scope users in FK-safe order.
6. **Sanitize + re-validate**.

---

## 4. Per-domain mapping summary (verified)

### 4.1 Organizations (scout `org`)
- Source `org_units`: rtl 32 (depth 4), heu 8 (depth 2). **Exclude** the spurious `TEST-AUTH` 2nd root in each tenant (NULL type, test pollution). heuresys has 4 `PROTO-<hash>` template-generated nodes + 3 hand-authored (HS-CORP/HS-MGMT/HS-PROD) — **decision needed** (keep/rename/drop).
- Manager remap: `org_units.manager_id → employees.id → employees.email → sys_users.email → sys_users.id` (23/32 rtl managers resolve, all have email).
- Type catalog: legacy `{company,division,direction,group,office,team}` vs v5 8 types. DIVISION/OFFICE/TEAM map 1:1; `company→HEADQUARTERS`, `direction→DIVISION`, `group→DEPARTMENT` (collapse) **or** extend catalog (decision).
- Lossy fields (name_it/name_en/headcount/sort_order/color/icon/sap_*) → `metadata` jsonb (sap_* all empty → no-op).
- **Two parallel legacy org models**: `org_units`(76) vs `tenant_org_units`(47 via charts). org_units has the populated manager FKs → treat as canonical (confirm).

### 4.2 Positions (scout `positions`) — **the core decision lives here**
- Legacy has **no real position table**. `tenant_jobs` is an 8-row job *catalogue*; `employee_job_assignments` is sparse/unreliable (57/158, 2 jobs). The real spine is **`employees.position_id`** (free-text, 156/158, 7 distinct: Compliance Officer 29, Risk Analyst 28, Financial Analyst 27, Bank Teller 22, Bank Manager 22, Investment Advisor 15, Security Specialist 13) + `employees.org_unit_id` (158/158) + `employees.manager_id` (157/158, 27 managers = the reporting tree).
- ESCO: legacy `tenant_jobs.esco_*` are **empty** → derive ESCO from the existing v5 `sys_esco_occupation_mappings` (7645) keyed on resolved job_role, not from legacy.
- **I1 invariant guard**: `critical_roles.current_incumbent_id` is the INCUMBENT → feeds `sys_user_position_assignments`, **never** `position_owner_user_id`.
- reports_to: derive from `employees.manager_id` (incumbent's manager → that manager's position); run cycle-detection before write.

### 4.3 People / contracts / comp (scout `people`)
- 100% match (§1). Wiring gap: 0/158 real users have an assignment.
- Import targets: `sys_user_profiles` (from addresses/bank/emergency + inline), `sys_position_compensation_profiles` (from employee_contracts 158 + salary_band_assignments 156 — **position-centric**, attach to position not user), `sys_compensation_bands` (12 rtl bands, dedup vs existing 75).
- heuresys reconciliation: 4 legacy emps vs 3 v5 users (2 legacy emps lack auth users) — decision.
- pernr (00000xxx) not in v5 external_code → store in `user_metadata` for SAP/payroll traceability (decision).

### 4.4 Skills / certs / attendance (scout `skills`)
- **SKIP (already migrated, overlap proven)**: attendance (v5 5199 = 237 IMPORT legacy-rtl + 4962 SYSTEM synthetic), overtime (380), time_off (99), ESCO taxonomy.
- **IMPORT (v5 empty)**: `sys_user_skill_evidence` ← employee_skills (905 rtl); `sys_assessments`+`sys_assessment_results` ← employee_skill_assessments (299 rtl) / employee_skill_profiles (312 KSABA); `sys_user_certifications` ← employee_certifications (729, only 4 in v5); `sys_skills` tenant-scoped ← tenant_custom_skills (25).
- esco_skill_id remap: join via **esco_uri** (stable), not legacy uuid.
- KSABA 5-dim: explode to 5 `sys_assessment_results` rows vs collapse to composite (decision).
- Tables WITHOUT tenant_id (employee_skill_assessments, employee_certifications) → filter via `employee_id → employees.tenant_id`.
- Optional: v5 attendance is only a 237-row subset of legacy rtl 3161 → top-up 2924 rows with natural-key dedup if full fidelity wanted (decision).

### 4.5 RBAC → UI (scout `rbac-ui`) — **richest gap**
- Legacy authoritative model = **3-layer star**: `rbp_roles(8) →< rbp_role_permissions(179) >→ rbp_functional_areas(34) →< rbp_pages(170 via functional_area_code)`; plus `rbp_role_dashboards(23)` → `rbp_dashboards(11)` → curated `rbp_dashboard_nav_items(279)`. (`role_permissions`(20) + `permissions`(184) are a **stub** — references a non-existent SYSADMIN role; ignore.)
- v5 today = **two disconnected gates**: API fine-grained `requirePermission` (`apps/api/src/middleware/rbac.ts:40`, 246× across 53 files, backed by 394 mappings) BUT web sidebar is **coarse binary** — `apps/web/src/app/(authenticated)/layout.tsx:40-47` `ADMIN_ROLES` Set + `:163` `groups = hasAdminRole ? [...adminGroups, meGroup] : [meGroup]`. Any admin-class role sees the SAME full sidebar; the 394-mapping richness never reaches the UI.
- **Role map** (legacy→v5): SUPERUSER→PLATFORM_ADMIN, TENANT_OWNER→TENANT_ADMIN, IT_ADMIN→TENANT_ADMIN(±platform), HR_DIRECTOR+HR_MANAGER→HRMS_MANAGER (dual-tier collapse), DEPT_HEAD+LINE_MANAGER→MANAGER, EMPLOYEE→USER. v5-only (no legacy peer): BLUEPRINT_MANAGER, PROCESS_OWNER, READ_ONLY.
- Permission gap: v5 99 perms vs legacy 184.
- **Porting proposal**: add a nav-metadata layer (static TS manifest in `apps/web/src/lib/` OR `sys.sys_nav_*` tables) where each sidebar item declares its `gatePermission`; replace `hasAdminRole` with per-item permission filtering driven by a new `GET /v1/me/permissions` aggregator → sidebar mirrors the API gate. Substitute legacy routes with current v5 routes (mapping table in scout output). Down-map the ~74 ACTIVE legacy pages onto the ~20 real v5 routes (don't port the 89 DEMO/UNASSIGNED/DISABLED legacy pages).

### 4.6 v5 target / cascade (scout `v5-target-cascade`)
- `sys_tenancies` create-requirements: NOT NULL = `tenant_code varchar(64)` + `tenant_name varchar(255)` only; everything else defaulted/nullable. CHECKs: status ∈ {ACTIVE,SUSPENDED,ARCHIVED,PENDING_ACTIVATION}; size_band NULL|XS|S|M|L|XL. **No `tenant_type` column** (SPEC assumption was wrong).
- **No reusable person/position/org column mappings** in `04_column_mappings.sql` (it covers only reference/skills/learning/comp-band tables) — these must be authored fresh. Only reusable hooks: `created_by/updated_by` LOOKUP_FK + `CAST_TIMESTAMPTZ`.
- Sensitive legacy tables **without tenant_id** (cross-tenant leak risk): `employee_pay_stubs`(66), `salary_band_assignments`(238), `merit_recommendations`(208), `bonus_allocations`(244), `ccnl_contracts`(7, likely global) + views `v_compensation_by_department`/`v_payroll_summary`. Extract ONLY via `employee_id → employees.tenant_id` filter + double-filter on the parent band/plan/cycle tenant_id.

---

## 5. Tenant collapse plan (FK-verified)

**Scope counts (verified, asserted before any delete; post-D3):** total 433 → **KEEP 161** (rtl-bank.org 158 + heuresys.com 3) · **DELETE 272** (rtl-bank-reference.example.com 158 + smartfood.org 82 + econova.org 26 + legacy.heuresys.local 2 + rtl-bank.test 4). The 4 rtl-bank.test personas are re-wired onto real users (D3) BEFORE this delete.

**Tenancy approach (recommended)**: REPURPOSE `86ba7a65` as **rtl-bank.org** — 1-row UPDATE (`tenant_code` RTL_BANK_REFERENCE→RTL_BANK, clear `is_synthetic` metadata, rename), **zero FK churn** for the 161 keep-users. CREATE one fresh **heuresys.com** platform tenancy; re-point the 3 heuresys.com users' `user_tenant_id`.

**Delete predicate** — on EXACT email domain, never tenant_id alone (synthetic and real both = 158 under same tenancy):
`user_email LIKE '%@rtl-bank-reference.example.com' OR '%@smartfood.org' OR '%@econova.org' OR '%@legacy.heuresys.local' OR '%@rtl-bank.test'` (rtl-bank.test included per D3).

**FK-safe delete order (single transaction, verified from 196-row FK graph):**
1. `sys_user_position_assignments` (RESTRICTs both users + positions)
2. RESTRICT children of users (subject_user_id): `sys_attendance`, `sys_overtime`, `sys_time_off_requests`, `sys_time_off_balances`, `sys_goal_check_ins`
3. `DELETE sys_users` (DELETE scope) → auto-CASCADE ~40 child tables (sys_auth_*, profiles, certs, evidence, scores…), SET NULL ~150 created_by/updated_by
4. `DELETE sys_positions` (synthetic) → CASCADE skill/kpi/career/comp/critical children, SET NULL self/owner
5. `DELETE sys_organization_units` (synthetic) → CASCADE branches/hierarchies/history/kpi, SET NULL positions/bonus_pools

Dry-run COUNT each RESTRICT child filtered to DELETE-scope subjects BEFORE the real delete.

---

## 6. E2E personas — the open tension

The SPEC/memory said "re-wire the 5 personas to REAL users and delete `rtl-bank.test`". The FK scout's KEEP set includes the 4 `rtl-bank.test` personas. Two coherent paths (decision §7.3):
- **(A) Keep `rtl-bank.test`** (lowest risk): CI fixtures unchanged, invariant "CI green" trivially held. The personas remain synthetic test accounts alongside real data.
- **(B) Re-wire to real users** (SPEC intent, more authentic): map platformAdmin→a heuresys.com user, tenantAdmin/manager/employee→real rtl-bank.org users by RBAC role; set known test passwords; update `apps/web/tests/e2e/fixtures.ts` + `auth.setup.ts`; THEN delete `rtl-bank.test`. Sequence carefully so no E2E run lacks a valid login.

`admin@heuresys.com` (native PLATFORM_ADMIN, no external_code) stays untouched in both paths.

---

## 7. KEY DECISIONS for Enzo (CLASS B — not mine to make)

1. **Position cardinality** — (A) 8 jobs→8 positions [leaves 150 employees position-less, breaks I1], (B) **~158 one-per-employee** [recommended; matches current 161-synthetic pattern, full I1], (C) cluster ~20-40 by (title×OU).
2. **Tenancy creation** — **repurpose 86ba7a65** [recommended, zero FK churn] vs create 2 fresh [161 re-points].
3. **E2E personas** — keep `rtl-bank.test` [lower risk] vs re-wire to real + delete [SPEC intent]. (§6)
4. **RBAC→UI gating** — port the legacy per-permission sidebar (nav-metadata layer + `/v1/me/permissions` + per-item filter) [recommended, fixes the coarse gate] vs keep binary `hasAdminRole`. Plus: accept HR dual-tier collapse? add IT_ADMIN/DEPT_HEAD? expand v5 99→184 perms?
5. **Skill/cert import** — scope (all 3 skill tables or just employee_skills) + KSABA explode-vs-collapse + add a certification catalog table vs denormalize.
6. **HR history** — skip (already present) [recommended] vs top-up the ~2924 missing legacy rtl attendance rows.
7. **Org**: drop synthetic + import 32+8 real [recommended] · exclude TEST-AUTH [recommended] · heuresys PROTO nodes keep/rename/drop · type collapse vs extend · confirm `org_units` (not `tenant_org_units`) canonical.
8. **CI/shared-DB**: pause OCI VM self-hosted runner during WRITE; re-run `db:seed-test-admin` after; confirm single-transaction atomic delete.

---

## 8. Sequenced WRITE plan (for the FUTURE authorized session — NOT executed now)

Dependency order (each step a guarded, idempotent migration/seed; verify counts per step):
1. **Backup** (done — re-take fresh at WRITE-session start; record HEAD).
2. **Tenancy**: repurpose 86ba7a65→rtl-bank.org; create heuresys.com; re-point 3 heuresys.com users.
3. **Org**: import 32+8 real OUs (+ types) → two-pass parent_id → manager remap via email bridge.
4. **Positions**: synthesize per chosen cardinality from employees.position_id+org_unit; set job_role + ESCO via existing 7645 crosswalk; derive reports_to from manager_id (cycle-check); owner per I1 (manager-position or NULL).
5. **Assignments**: one PRIMARY `sys_user_position_assignment` per real user → its position.
6. **Comp**: `sys_position_compensation_profiles` from contracts+band_assignments; dedup bands.
7. **Profiles + skills + certs + assessments**: targeted imports with esco_uri join + employee→user remap + ON CONFLICT guards; tenant_custom_skills (25).
8. **RBAC**: grant `sys_user_auth_roles` to real users per legacy role map; (optional) nav-metadata layer + sidebar refactor.
9. **Delete** out-of-scope 272 users + synthetic org/positions (FK-safe order §5), single transaction, assertions on KEEP=161/DELETE=272.
10. **Rebuild derived** (org-chart graph, reward gates, succession, gap, KPI, career) from real incumbents.
11. **E2E personas** path A or B (§6).
12. **Sanitize** schemas (audit sys/staging/brownfield/audit/temp_sdbi/legacy_mirror; drop/archive phase-only).
13. **Re-validate**: `pnpm test`, prod-build E2E, CI green; dashboards on real data.

---

## 9. Consolidated high-severity risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Cross-tenant leak from 5 no-tenant_id sensitive legacy tables | Mandatory `employee_id→employees.tenant_id` filter + parent band/plan/cycle tenant double-filter on EVERY extraction |
| R2 | FK cascade-order violation on delete (RESTRICT on assignments + 5 subject_user_id) | Exact child→parent order §5, single transaction, dry-run COUNTs first |
| R3 | Mis-scoped delete wipes real rtl-bank.org (synthetic & real both 158 same tenancy) | Predicate on exact email domain; assert KEEP=161/DELETE=272 before COMMIT |
| R4 | Re-importing users instead of matching breaks ~196 FK refs + 5 personas | MATCH-AND-WIRE; preserve user_id; only INSERT into assignment/profile/comp/role tables |
| R5 | Double-import of HR history (already present, overlap proven) | ON CONFLICT DO NOTHING on natural-key part-3 = legacy id |
| R6 | Shared-DB blast radius (CI runner + dev + Mac on same live DB) | Fresh backup; pause CI runner during WRITE; single transaction; re-seed personas; rollback ready |
| R7 | I1 violation (incumbent wired as position owner) | Hard rule: incumbent→assignment only; owner→manager-position or NULL; post-write assertion |
| R8 | esco_skill_id legacy-uuid mismatch | Join via stable esco_uri, not legacy uuid |
| R9 | Coarse v5 sidebar shows pages the API will 403 | Per-item permission filter driven by `/v1/me/permissions` (RBAC porting) |

---

## 10. Rollback
`pg_restore --clean --if-exists` of the Phase-0 dump → exact pre-rebuild state (see `*.provenance.txt`). VM-local alternative via `sudo -u postgres pg_restore` (peer auth, faster). No git/code changes are part of the WRITE except new migration/seed files + this proposal.
