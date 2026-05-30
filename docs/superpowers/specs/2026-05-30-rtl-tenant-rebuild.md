# SPEC — RTL tenant rebuild from real legacy data (fresh-session execution)

**Date**: 2026-05-30 · **Owner**: CLI · **Status**: SPEC — execution deferred to a fresh session (Enzo's decision; irreversible/cascade work needs full context). **Nothing destructive has been run.**

## Context & problem

The heuresys-advanced DB (single tenant `86ba7a65…`, PostgreSQL on OCI VM, **shared with CI E2E + dev + Mac**) is polluted by data from different phases:
- **433 users in one tenant** spanning 3 fictitious companies + a synthetic reference set, created Nov-2025 and May-2026.
- Two RTL datasets, **incoherent**: `rtl-bank.org` (158, **REAL**, migrated from legacy — anagraphics + attendance 3161/leave/overtime, but **0 positions, 0 roles**) vs `rtl-bank-reference.example.com` (158, **SYNTHETIC** scaffold — 158 incumbents → 161 positions → 6 org-units → compensation/career/org-chart, but no HR history).
- Only **1/161 positions has an owner**; the 433 users are mostly unwired.

**Goal (Enzo)**: collapse to **2 tenants — `rtl-bank.org` (customer) + `heuresys.com` (platform)** — and wire the REAL users to a REAL org structure so **all dashboards work on authentic data**. Then **sanitize** the DB (schemas/tables accreted across phases) to a clean state.

## Decisive discovery (workflow `wf_4445cc37-d22`, 2026-05-30)

Real, fresh (mar–mag 2026, up to +6 months vs the Nov-2025 baseline) legacy PostgreSQL dumps exist with **intact FK chains** employee→position→org-unit→assignment→contract:

| Source | Dump | Date | Real content |
|---|---|---|---|
| **VM `/home/ubuntu/heuresys-evo`** | `backups/local/heuresys_platform_20260507T030001Z.dump` (367MB) **+ live Docker DB `heuresys_evo_platform_db`** | **2026-05-07** | **270 employees / 4 tenants** (rtl-bank 158, smartfood 82, econova 26, heuresys 4); 570 tables; org_units/positions/assignments/skill_assessments(480)/certifications(729)/attendance/contracts |
| VM `/home/ubuntu/heuresys.com.evo` | `/home/ubuntu/backups/heuresys_platform_pre_esco_import_20260326_042003.sql.gz` (62MB) | 2026-03-22 | 267 empl · 47 org_units (parent/child + SAP IDs) · 20 tenant_jobs (ESCO) · 100 employee_job_assignments · 238 salary_band_assignments — **cleanest FK chain** |
| D:\ `heuresys.com.evo` | `backups/local/heuresys_platform_20260429T024105Z.dump` (367MB) | 2026-04-29 | v1 schema, employees+org+positions+CCNL_CRED_2024 contracts |
| D:\GitHub `heuresys.com.evo` | `backups/from-vm/platform_db.dump` (379MB, PG16) | 2026-04-18 | employees+org+positions+assignments+attendance |

Translation already half-done: **`db/seeds/brownfield/wave1/04_column_mappings.sql` (461KB, 4293 lines)** maps legacy→v5 (`sys.sys_users/sys_positions/sys_organization_units/sys_user_position_assignments`).

**Key insight**: the current `rtl-bank.org` users were imported from this legacy (`lineage_source: legacy_mirror.users`) but **without their positions/org**. The legacy holds the missing wiring. So the plan is **import the real structure**, not synthesize a mapping.

## Execution plan (fresh session)

> **Phase 0 — Backup + rollback (non-negotiable, first):** `pg_dump -Fc` of the whole heuresys-advanced DB (or at least schema `sys` + dependents) to a safe, dated file. Record exact HEAD + tag. Every later phase runs in transactions; keep the restore path one command away.

1. **Consult the legacy DBMS (Docker, live)** — `docker exec` into `heuresys_evo_platform_db` on the VM; for the **rtl-bank** tenant, enumerate employees, org_units, tenant_jobs (positions), employee_job_assignments, contracts, skills, attendance — row counts + structure (no PII dumped). Compare the live DB vs the 2026-05-07 dump; pick the freshest coherent snapshot. ⚠ **20+ sensitive legacy tables (pay_stubs, salary_band_assignments, merit_recommendations, …) lack `tenant_id`+RLS** → extract RTL subset with explicit app-level tenant filtering to avoid cross-tenant leak.
2. **Extract the RTL + heuresys subset** from the chosen legacy source: employees, org_units (hierarchy), positions/jobs, assignments, contracts, skills, attendance/leave.
3. **Map legacy→v5** reusing `brownfield/wave1/04_column_mappings.sql` (+ `05_job_families_registry.sql`); load into `sys.sys_users / sys_positions / sys_organization_units / sys_user_position_assignments / sys_user_auth_roles / compensation / …` with FK chains intact. Roles: TENANT_OWNER→TENANT_ADMIN, DEPT_HEAD→MANAGER, HR roles→HRMS_MANAGER, EMPLOYEE→USER.
4. **Collapse to 2 tenants**: keep wired `rtl-bank.org` + `heuresys.com`; **delete** the synthetic `rtl-bank-reference.example.com` (158) + `smartfood.org` (82) + `econova.org` (26) + `legacy.heuresys.local` (2) and their cascade, in FK order.
5. **Rebuild derived data**: org-chart graph (`db/seeds/org_chart_rtl_demo.sql`), reward gates, succession, gap, KPI, career — from the real incumbents.
6. **Sanitize schemas**: audit `sys / staging / brownfield / audit / temp_sdbi / legacy_mirror`; drop/archive redundant or phase-only tables/schemas → clean target state (document what's kept and why).
7. **Re-validate**: `pnpm test` (API), prod-build E2E, CI green. Dashboards must render on real data.

## Constraints / risks

- **Intoccabili**: personas E2E `rtl-bank.test` (4 users, 4 RBAC roles, CI auth.setup depends on them) + `admin@heuresys.com`. Keep or remap deliberately — never blind-delete.
- **Shared DB**: every destructive step affects CI + dev + Mac. Backup first, transactional, verify before commit.
- **Sensitive legacy tables without tenant_id/RLS** → filter extraction explicitly (cross-tenant leak risk).
- **Decision still open for Enzo**: which legacy snapshot is canonical (VM heuresys-evo 2026-05-07 live/dump = freshest + richest; VM heuresys.com.evo 2026-03-22 = cleanest FK chain). Confirm at fresh-session start.

## Rollback
`pg_restore` the Phase-0 dump (single command) → exact pre-rebuild state. No code/git changes are part of the rebuild except this SPEC + seed scripts.
