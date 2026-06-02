# RTL tenant rebuild — WRITE seed set (DRAFT for review)

**Status**: DRAFT authored 2026-05-30. **NOT executed.** These files perform the RTL tenant rebuild (collapse to 2 tenants + wire real users to real org imported from legacy). Execution is a separate, gated, dedicated session (SPEC fresh-session doctrine).

**Design source**: `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild-import-design.md` (§0 = the 8 locked decisions D1–D8). Read it before running.

## What this does (the locked decisions)
- **D1** ~158 positions, one per real employee (from `employees.position_id` × `org_unit_id`).
- **D2** Repurpose tenancy `86ba7a65` → rtl-bank.org; create heuresys.com; re-point 3 users.
- **D3** Re-wire the 5 E2E personas onto REAL users, then delete `rtl-bank.test` (handled in app/web + step 09, not here).
- **D4** Full RBAC→UI port (role grants here in `08`; the `/v1/me/permissions` endpoint + sidebar refactor are CODE, not seed).
- **D5** Complete skill/cert import (KSABA exploded to assessment dimensions).
- **D6** Top-up real attendance to full legacy fidelity (dedup on natural-key).
- **D7** Collapse legacy org types onto the v5 8-type catalog; legacy `org_type` preserved in metadata.
- **D8** Single-transaction atomic collapse with `KEEP=161 / DELETE=272` asserts (post-D3: rtl-bank.test moves to DELETE); pause CI runner; re-seed after.

## Idempotency & conventions (every file)
- **Staging schema** `staging.rtl_*` holds the extracted legacy CSVs; each load file `CREATE TABLE IF NOT EXISTS` + `TRUNCATE` + `\copy` + transform, so re-running is safe.
- **Crosswalk** legacy→v5: ⚠️ **the original key below is DEPRECATED (ADR-0024 / I14, S954).** It keys persons on legacy `users.id` (the auth shell), which is user-centric and drops employees without an account. The **corrected** key is **`sys_users.user_external_code = 'LEGACY_EMP::'||legacy.employees.id`** (employee-centric — the person is `employees`, not `users`; 207 FK hang off `employees` vs 45 off `users`). The 5 seeds (`04`,`06`,`07`,`08` + this note) are being re-keyed in S954 Phase 2; the live bare-metal re-key is Phase 3 (gated). See `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`.
  - *Original (deprecated) text*: ~~users via the existing `sys_users.user_external_code = 'LEGACY:'||legacy.users.id`~~; newly-created rows (OUs, positions) store their legacy id in `*_metadata->>'legacy_*_id'` and resolve parents/links via that key in a second pass (this OU/position part is unchanged and correct).
- **Idempotent writes**: `ON CONFLICT (...) DO NOTHING` / `WHERE NOT EXISTS` / `INSERT ... ON CONFLICT DO UPDATE` — never blind INSERT. Running the full set twice = no-op diff.
- **Tenant safety**: legacy tables WITHOUT `tenant_id` (users, salary_band_assignments, employee_skill_assessments, employee_certifications) are filtered via `employee_id → employees.tenant_id` at extraction. NEVER `SELECT *` across tenants.
- **No destructive op except `09`**: files `01`–`08` and `10` are purely additive (INSERT/UPDATE). All deletion is concentrated in `09_collapse_delete.sql` (the single gated destructive step).
- Run with **psql** (the files use `\copy`), via the same runner as `db:migrate`.

## WS-1 (1b) — `12_user_satellites.sql` (employee-centric satellite re-derivation)
Populates the TRACTABLE empty `sys_user_*` satellites from the legacy `employees` source via the
verified email crosswalk (ADR-0024 / I14). Idempotent (`ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`);
twice-run = `INSERT 0 0`. Needs `extracted/employees.csv` + `extracted/employee_module_completions.csv`
(the latter added to `00_extract_legacy_subset.sh`).

| Satellite | Result | Source mapping |
|---|---|---|
| `sys_user_profiles` | **populated** (156) | `employees.phone_mobile`→phone (work fallback); emergency contact + address → `*_metadata` |
| `sys_user_education_records` | **populated** (157) | `highest_education_level`→degree, `_institution`→institution, `_field`→field, `_year`→Jan-1 end_date |
| `sys_user_assessment_evidence` | **populated** (1560) | deterministic projection of existing v5 `sys_assessment_results` JOIN `sys_assessments` (KSABA dimensions) |
| `sys_user_learning_evidence` | **0 (honest)** | source = legacy `module_completions` (status=completed only); the 1 completed row in the subset belongs to `spen.zosky@gmail.com`, a legacy employee NOT carried into v5 → no crosswalk target. Seed is correct + future-proof (auto-populates if such a user appears). |
| `sys_user_professional_experiences` | **SKIPPED** | NO clean legacy source — no prior-employment table; `employees` has no prior-experience columns; `career_*` are forward-looking aspiration data. All 3 required cols (employer/role_title/start_date) would be fabricated → skipped per MAPPING-CARD RULE. |
| `sys_user_kpi_evidence` | **BLOCKED (cross-wave)** | FK target `sys_kpi_definitions` is EMPTY (WS-2 target); `kpi_id` (NOT NULL) cannot resolve → deferred to WS-2. |

The doctrine is guarded permanently by `apps/api/test/employee-centric-doctrine.integration.test.ts` (1a):
0 `LEGACY:%` person keys; well-formed distinct `LEGACY_EMP::%`; satellite FK + tenant integrity.

## Legacy source (read-only)
Live Docker `heuresys_evo_platform_db` (db `heuresys_platform`) on OCI VM. Tenants: rtl-bank `0c54b84a-db6e-4da4-bc91-af5d480d524e` (158 emp / 32 OU), heuresys `d5855519-3ed1-4427-865f-fe75f1e42c4c` (4 emp / 8 OU). The extracted CSV payload lives in `extracted/` (**gitignored** — regenerable via `00_extract_legacy_subset.sh`, per the brownfield-wave1 convention).

## Run order
| # | File | Destructive? | Status |
|---|---|---|---|
| 00 | `00_extract_legacy_subset.sh` | no (read-only legacy → CSV) | DRAFT ✅ |
| 01 | `01_tenancies.sql` (D2) | no | DRAFT ✅ |
| 02 | `02_organization_units.sql` (D7) | no | DRAFT ✅ |
| 03 | `03_positions.sql` (D1) | no | DRAFT ✅ |
| 04 | `04_assignments.sql` | no | DRAFT ✅ |
| 05 | `05_compensation.sql` | no | DRAFT ✅ |
| 06 | `06_skills_certs.sql` (D5) | no | DRAFT ✅ |
| 07 | `07_attendance_topup.sql` (D6) | no | DRAFT ✅ |
| 08 | `08_rbac_role_grants.sql` (D4 data part) | no | DRAFT ✅ |
| 09 | `09_collapse_delete.sql` (D8) | **YES — gated** | DRAFT ✅ |
| 10 | `10_rebuild_derived.sql` | no | DRAFT ✅ |
| 12 | `12_user_satellites.sql` (WS-1 1b) | no | APPLIED ✅ |

Code (separate from this seed set): `GET /v1/me/permissions` (apps/api), nav-manifest + sidebar refactor (apps/web), persona re-wire (`tests/e2e/fixtures.ts` + `auth.setup.ts`).

## Pre-run checklist (WRITE session)
1. Fresh `pg_dump -Fc` backup + record HEAD (see `pg_dump_snapshots/*.provenance.txt`).
2. Pause the OCI self-hosted CI runner.
3. SSH tunnel `:5433` up; legacy Docker DB reachable.
4. Run `00` (extraction) → verify `extracted/*.csv` row counts.
5. Run `01`–`08` (+ code) → verify counts at each step.
6. Run `09` **only after** dry-run COUNTs confirm `KEEP=161 / DELETE=272`.
7. Run `10`; then `pnpm db:seed-test-admin` (personas), `pnpm test`, prod-build E2E, CI green.

## Rollback
`pg_restore --clean --if-exists` the Phase-0 dump (single command; see provenance sidecar). All steps are transactional; `09` is one `BEGIN/COMMIT`.
