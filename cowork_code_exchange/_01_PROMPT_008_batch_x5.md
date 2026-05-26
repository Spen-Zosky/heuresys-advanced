# PROMPT 008 — CLI Batch X5 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: 4 macro-blocks — A: CW-B32 CAST_ENUM fix | B: ADR-0016 migration 000041 + audit | C: Time/Leave SDBI pilot (X4.B residual) | D: sys_users HYBRID extension (X4.B residual) + housekeeping (xos_lib commit)
**Expected duration**: 8-12h CLI continuous (**recommend split A+B in 1 session = X5.A 3-4h, C+D in 1 session = X5.B 5-8h**)
**Authored**: 2026-05-21T05:30Z by Cowork (batch C5)
**Predecessor**: REPORT X4.A (`cowork_code_exchange/_04_REPORT_007_batch_x4.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C5 has reviewed REPORT X4.A + addressed all 5 §4.5 feedback items + authored 4 new specs.

**X4.A outcome recap**:
- ✅ CW-B31 engine fix landed (DISTINCT ON dedup main INSERT) — commit `a76adef`
- ✅ Cross-OS hygiene applied to `extract_users_employees_legacy.sh`
- ⏸ ESCO cascade skipped (0/5 resolves → ADR-0016 proposed by you)
- ⏸ Block B (Time/Leave + sys_users) DEFERRED — your recommendation accepted
- ❌ sys_job_roles still 91 (CW-B32 surfaced: CAST_VARCHAR of integer org_level violates seniority CHECK)

**Cowork C5 batch deliverables ready for you**:
- ✅ `cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md` — CAST_ENUM transform + UPDATE column_mapping + 5 unit tests (Dry-run EXPLAIN ✅)
- ✅ `docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md` — ADR PROPOSED + migration 000041 spec + codebase audit instructions + Semantic FK Phantom resolution workflow §6
- ✅ `cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh` + README — sourceable library (CW-B28 generalization)
- ✅ `cowork_reserved/batch_c5/x4b_retrigger/README.md` — Block C/D sequencing + R-A2 defensive check definition
- ✅ `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` updated §9 with CW-B32/B33 + Dry-run EXPLAIN pattern + Iteration-as-feature

**Your X5 work** (4 blocks):
- **Block A (P0, 1.5-2.5h)**: Apply C5.1 CW-B32 CAST_ENUM spec → unblocks sys_job_roles 91 → ≥141
- **Block B (P0, 1-1.5h)**: Codebase audit + apply ADR-0016 migration 000041 + Wave 1 retry → unblocks sys_esco_occupation_mappings ≥3000
- **Block C (P1, 3-5h)**: Time/Leave SDBI pilot execution per C4 specs (Macro-area #5)
- **Block D (P1, 2-3h)**: sys_users HYBRID merge extension per C4 specs + R-A2 defensive check
- **Housekeeping**: commit `cowork_reserved/batch_c5/xos_lib/` to repo, adopt in Block C/D extract scripts

**Commitments** (same as before):
- Read PROMPT in full + all 4 spec deliverables
- Execute Block A → B → C → D sequenziali (split OK as X5.A=A+B / X5.B=C+D)
- Halt+escalate via `cowork_code_exchange/.inbox/cowork/pending/<TS>_008_halt_<reason>.md`
- Write REPORT `cowork_code_exchange/_04_REPORT_008_batch_x5.md` + inbox notify
- No git push without explicit step

**Critical thinking INVITED** (per Cowork pattern memo §9 vincente #5):
- Block A: HIGH confidence (Dry-run EXPLAIN ✅ documented). Apply spec as-is, but verify against transform-compiler.ts actual `srcExpr` format at edit time.
- Block B: HIGH confidence on migration DDL. MEDIUM on codebase audit — `>3 hits with business logic` → halt+escalate.
- Block C/D: spec quality HIGH (C4 authored with CW-B25 mitigation). Apply pattern but flag any schema drift detected at LIVE introspect.
- New CW-B34+ surfacing? Catalogue in REPORT §5.

---

## §1 — Executive briefing

### §1.1 Current state post-X4.A

| Metric | Value | X5 target |
|---|---|---|
| sys.* populated tables | 51/128 | ≥56/128 (Time/Leave +3, esco +1, more from Wave 1 retry) |
| sys.sys_job_roles | 91 | **≥141** (post CW-B32 fix) |
| sys.sys_esco_occupation_mappings | 0 | **≥3000** (post ADR-0016 + retry) |
| sys.sys_users | 163 | **~437** (post HYBRID merge) |
| sys.sys_attendance / sys_overtime / sys_time_off_balances | 0 | **≥6000 cumulative** (Time/Leave pilot) |
| Engine bias catalog | 32 (CW-B17-B31) | 33+ (CW-B32 mitigated, CW-B33 mitigated) |
| Migrations applied | 000039 (X3) | 000041 (after Block B) |

### §1.2 Decisions locked (no further confirmation)

| Decision | Status | Reference |
|---|---|---|
| CW-B32 fix Option A (CAST_ENUM transform) | ACCEPTED (Cowork-authored, Dry-run ✅) | `cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md` |
| ADR-0016 sys_esco_occupation_mappings nullable FK | PROPOSED (final accept post your audit) | `docs/architecture/adr/0016_*.md` |
| R-A2 defensive check definition | LOCKED (SQL assertion ≥5 ADMIN:: rows) | `cowork_reserved/batch_c5/x4b_retrigger/README.md §4` |
| xos_lib adoption in Block C/D extract scripts | RECOMMENDED (housekeeping P2) | `cowork_reserved/batch_c5/xos_lib/README.md` |
| All Block C/D HC items (Time/Leave HC-1..8 + sys_users HC-1..4) | DEFAULT ACCEPT (X4.B PROMPT 007 inheritance) | C4 specs |

### §1.3 Sequencing recommendation

**X5.A session (1 of 2, 3-4h continuous)**:
- §2 pre-flight (all blocks)
- Block A (CW-B32) → Wave 1 retry → verify sys_job_roles ≥141
- Block B (ADR-0016 audit + migration 000041 apply) → Wave 1 retry → verify sys_esco_occupation_mappings ≥3000
- Commit + push Block A + B + xos_lib (3 atomic commits, OR 1 bundle commit if preferred)
- REPORT 008.A interim (template §8)
- Inbox notify "X5.A complete, X5.B ready"

**X5.B session (2 of 2, 5-8h continuous)**:
- Block C (Time/Leave) — source via xos_lib, apply DDL + mapping cards, Wave 1 retry verify
- Block D (sys_users HYBRID) — R-A2 defensive check critical, apply per C4 specs
- Commit + push Block C + D
- REPORT 008.B final (template §8 §)

Single 8-12h session OK if preferred. Block sequence is preserved.

---

## §2 — Pre-flight (all blocks)

### §2.1 Connectivity + tunnels
```bash
# SSH tunnel to OCI VM PostgreSQL
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# Smoke-check DB
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW(), current_database()"

# Verify X4.A commit visible
cd D:\heuresys-advanced && git log --oneline -1
# Expected: a76adef (or descendant) "Block A bundle..."
```

### §2.2 Build artefact pre-flight (CW-B30)
This batch touches `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (Block A) + Zod/Row schemas if Block B audit finds hits.

```bash
# Before typecheck after edits:
cd D:\heuresys-advanced
pnpm --filter @heuresys/shared build  # only if you edit packages/shared/src/
pnpm typecheck                          # global
```

### §2.3 Cowork-prepared assets verification

```bash
# Verify all 4 C5 deliverables present
ls cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md
ls docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md
ls cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh
ls cowork_reserved/batch_c5/x4b_retrigger/README.md
```

### §2.4 Live DB state baseline (record in REPORT §0)

```sql
SELECT 'sys_job_roles' AS table_name, COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
UNION ALL SELECT 'sys_attendance', COUNT(*) FROM sys.sys_attendance
UNION ALL SELECT 'sys_overtime', COUNT(*) FROM sys.sys_overtime
UNION ALL SELECT 'sys_time_off_balances', COUNT(*) FROM sys.sys_time_off_balances;
```

---

## §3 — Block A: CW-B32 CAST_ENUM fix (P0, 1.5-2.5h)

**Goal**: unblock job_templates → sys_job_roles via mapping integer org_level → varchar seniority enum.

**Reference**: `cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md` (full spec including Dry-run EXPLAIN ✅).

### §3.A.1 Add CAST_ENUM transform code

File: `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`

Locate existing `case "CAST_VARCHAR":` block and add CAST_ENUM nearby. Use spec §3.1 code verbatim (text-comparison variant — avoid integer cast since `srcExpr` is typically text-as-jsonb-extract).

**Dry-run check at edit time** (CW-B33 mitigation):
1. Read current `srcExpr` format in transform-compiler.ts — verify it's `(staging_raw_record->>'<col>')` text
2. Confirm spec WHEN/ELSE clauses match text-text comparison (NO `::integer` cast)
3. If `srcExpr` is different format (e.g. wrapped in `::integer`), adapt spec accordingly + document

### §3.A.2 Add unit tests

File: `apps/api/test/transform-compiler.cast-enum.test.ts` (NEW)

Use spec §3.3 verbatim (5 tests). Verify SQL injection escape via pg-format `%L`.

```bash
cd apps/api
pnpm exec vitest run test/transform-compiler.cast-enum.test.ts
# Expected: 5/5 pass
```

### §3.A.3 Apply UPDATE column_mapping SQL

File: `db/seeds/brownfield/wave2/cw_b32_fix/01_org_level_to_cast_enum.sql` (NEW)

Use spec §3.2 verbatim. Apply via psql:

```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -v ON_ERROR_STOP=1 \
  -f db/seeds/brownfield/wave2/cw_b32_fix/01_org_level_to_cast_enum.sql
```

**Verify**:
```sql
SELECT column_mapping_transform, column_mapping_transform_payload
FROM brownfield.column_mappings
WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146';
-- Expected: transform='CAST_ENUM', payload includes value_map + cw_b32_fix=true
```

### §3.A.4 Wave 1 retry

```bash
cd apps/api
pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
# Capture runId in REPORT
```

### §3.A.5 Acceptance

```sql
SELECT COUNT(*) FROM sys.sys_job_roles;
-- Pre-X5: 91 → Post-X5.A: ≥141 (target ~141-151)
```

If sys_job_roles still 91 → halt+escalate with full audit dump.

---

## §4 — Block B: ADR-0016 migration 000041 + codebase audit (P0, 1-1.5h)

**Goal**: make `sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id` nullable → unblock ESCO catalog upsert (7642 staged → ≥3000 expected).

**Reference**: `docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md` (full ADR including codebase audit script §5 + migration spec §4 + Semantic FK Phantom workflow §6).

### §4.B.1 Codebase audit (MANDATORY pre-apply, CW-B33 mitigation)

```bash
cd D:\heuresys-advanced
grep -rn "esco_occupation_mapping_job_role_id\|escoOccupationMappingJobRoleId\|escoJobRoleId" \
  apps/api/src packages/shared/src apps/api/test 2>/dev/null
```

**Decision matrix** (per ADR §5):
- **0 hits**: apply migration directly, no companion edits
- **1-3 hits in Zod schemas / Row types**: companion edit to mark `.nullable()` in Zod + `string | null` in Row types
- **>3 hits with business logic assuming presence**: **HALT+ESCALATE** via inbox `<TS>_008_halt_codebase_audit_excessive.md`

Document audit results in REPORT §3.B.1 (cite file:line of each hit).

### §4.B.2 Author migration 000041

File: `db/migrations/000041_sys_esco_occupation_mappings_job_role_nullable.sql` (NEW)

Use ADR §4 spec verbatim. Idempotent: `ALTER COLUMN DROP NOT NULL` safe re-run.

### §4.B.3 Companion edits (if §4.B.1 found 1-3 hits)

Pattern from ADR-0015 X3 §1.A.6:
- Zod schemas: mark field `.nullable()` (e.g. in `packages/shared/src/schemas/esco-occupation-mappings.ts`)
- Row types: change `string` → `string | null` (in repository.ts Row interface)
- Service: ensure `null` propagates (no `!` non-null assertion)

```bash
pnpm --filter @heuresys/shared build  # CW-B30
pnpm typecheck
pnpm test --filter @heuresys/api      # ensure no regression
```

### §4.B.4 Apply migration

```bash
pnpm db:migrate
# Verifies idempotency + auto-tracks in sys.sys_schema_migrations
```

**Verify**:
```sql
\d sys.sys_esco_occupation_mappings
-- Expected: esco_occupation_mapping_job_role_id uuid (no NOT NULL)

SELECT file_name FROM sys.sys_schema_migrations WHERE file_name LIKE '%000041%';
-- Expected: 1 row
```

### §4.B.5 Wave 1 retry (post-Block A)

If Block A retry already ran, the same runId may cover Block B. Otherwise run again:

```bash
cd apps/api && pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
```

### §4.B.6 Acceptance

```sql
SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings;
-- Pre-X5: 0 → Post-X5: ≥3000 (50%+ of 7642 staged)
```

ADR-0016 status → ACCEPTED (update file front-matter from PROPOSED to ACCEPTED in commit).

---

## §5 — Block C: Time/Leave SDBI pilot (P1, 3-5h)

**Goal**: execute Macro-area #5 Time/Leave SDBI pilot per C4 specs (~6267 rows in 3 sys.* tables).

**Reference**: `cowork_reserved/batch_c4/time_leave_pilot/` (8 files, ~1500 LOC cumulative).

### §5.C.1 Pre-flight + extract

Source xos_lib (CW-B28 mitigation):

```bash
#!/usr/bin/env bash
set -euo pipefail
source cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh

xos_init \
  --ssh-host oracle-vm-default \
  --remote-db heuresys_platform \
  --local-db-url "postgresql://heuresys:****@localhost:5433/heuresys_advanced"

xos_restore_legacy_mirror \
  --schema legacy_mirror \
  --tables "employee_attendance employee_overtime employee_time_off_balances"
```

Verify per spec `01_SOURCE_DISCOVERY.md` row counts.

### §5.C.2 Apply DDL + mappings

Per spec `03_PHASE3_TEMP_SDBI_DDL.md`:
- Apply `temp_sdbi.*` staging tables
- Insert mapping cards from `mapping_cards/*.md` into brownfield.column_mappings
- Verify via per-mapping smoke check (Dry-run EXPLAIN if spec includes it)

### §5.C.3 Run Wave 1 + consolidation

Per spec `04_PHASE5_CONSOLIDATION_PLAN.md`:
- Run Wave 1 for Time/Leave macro-area
- Validate row counts via spec acceptance criteria

### §5.C.4 Acceptance

```sql
SELECT 'sys_attendance' AS t, COUNT(*) FROM sys.sys_attendance
UNION ALL SELECT 'sys_overtime', COUNT(*) FROM sys.sys_overtime
UNION ALL SELECT 'sys_time_off_balances', COUNT(*) FROM sys.sys_time_off_balances;
-- Expected cumulative: ≥6000 (per C4 spec ~6267 estimate)
```

---

## §6 — Block D: sys_users HYBRID extension (P1, 2-3h)

**Goal**: extend sys.sys_users 163 → ~437 via HYBRID merge with legacy_mirror.users + employees_pii.

**Reference**: `cowork_reserved/batch_c4/sys_users_sdbi/` (5 files, ~1100 LOC cumulative).

### §6.D.1 Pre-merge baseline

```sql
-- Record baseline (for R-A2 defensive check)
SELECT COUNT(*) FROM sys.sys_users WHERE user_natural_key LIKE 'ADMIN::%';
-- Expected: ≥5 (5 canonical admins seeded by pnpm db:seed-test-admin)
```

### §6.D.2 Execute merge per spec

Per `02_MAPPING_STRATEGY.md` + `03_PHASE3_TEMP_SDBI_DDL.md`:
- Apply temp_sdbi staging
- Insert mapping cards
- Run HYBRID merge (ON CONFLICT DO NOTHING preserves admins)

### §6.D.3 R-A2 defensive check (CRITICAL — halt+escalate immediato se fails)

Per `cowork_reserved/batch_c5/x4b_retrigger/README.md §4`:

```sql
DO $$
DECLARE
  v_admin_count int;
  v_expected int := 5;
BEGIN
  SELECT COUNT(*)
    INTO v_admin_count
    FROM sys.sys_users
   WHERE user_natural_key LIKE 'ADMIN::%';

  IF v_admin_count < v_expected THEN
    RAISE EXCEPTION 'R-A2 violation: expected >=% ADMIN:: rows, found %', v_expected, v_admin_count;
  END IF;

  RAISE NOTICE 'R-A2 check PASS: % ADMIN:: rows preserved', v_admin_count;
END $$;
```

If RAISE EXCEPTION fires → IMMEDIATE halt+escalate `<TS>_008_halt_R-A2_admin_loss.md`.

### §6.D.4 Acceptance

```sql
SELECT COUNT(*) FROM sys.sys_users;
-- Pre-X5: 163 → Post-X5: ≥430 (target ~437)

SELECT COUNT(*) FROM sys.sys_users WHERE user_natural_key LIKE 'ADMIN::%';
-- Must be ≥5 (R-A2 preserved)
```

---

## §7 — Halts + escalation triggers

Immediate halt+escalate via inbox `cowork_code_exchange/.inbox/cowork/pending/<TS>_008_halt_<reason>.md`:

| Trigger | Reason filename | Severity |
|---|---|---|
| Block A retry: sys_job_roles still 91 | `cw_b32_unexpected_fail` | P0 |
| Block B audit: >3 hits with business logic | `adr_0016_audit_excessive` | P0 |
| Block B retry: sys_esco_occupation_mappings still 0 | `adr_0016_unexpected_fail` | P0 |
| Block D R-A2: <5 ADMIN:: rows | `r_a2_admin_loss` | **P0 CRITICAL** |
| Wave 1 retry wall-clock > 90 min | `wave1_timeout` | P1 |
| ANY test regression > 5 new failures | `test_regression` | P1 |
| Strategic concern (semantic mismatch, schema drift) | `strategic_concern_<topic>` | P1 |

---

## §8 — REPORT format §8 mandatory

Final REPORT at `cowork_code_exchange/_04_REPORT_008_batch_x5.md`. Structure:

```
§0 Pre-conditions verified
§1 Block A outcomes (CW-B32 fix)
  §1.A.1 Transform code add
  §1.A.2 Unit tests
  §1.A.3 UPDATE column_mapping
  §1.A.4 Wave 1 retry runId + wall-clock
  §1.A.5 Acceptance (sys_job_roles count)
§2 Block B outcomes (ADR-0016)
  §2.B.1 Codebase audit hits + decisions
  §2.B.2 Migration 000041 apply
  §2.B.3 Companion edits (if any)
  §2.B.4 Wave 1 retry
  §2.B.5 Acceptance (sys_esco_occupation_mappings count)
§3 Block C outcomes (Time/Leave) [if X5.B]
§4 Block D outcomes (sys_users HYBRID) [if X5.B]
  §4.D.X R-A2 defensive check result
§5 Bias catalog updates (CW-B34+ if surfaced)
§6 Cowork spec improvements suggested
§7 Feedback sul modello operativo Cowork↔CLI
§8 Next step recommendation for Cowork batch C6
```

Emit `report_ready` inbox at end: `cowork_code_exchange/.inbox/cli/pending/<TS>_008__report_ready.md`.

---

## §9 — Critical thinking invitation (continue contributing — CW-B25-B33 pattern)

Per Cowork pattern memo §9 vincente #5 "Iteration-as-feature":

- Your X4.A 2-iteration fix on CW-B31 was a feature, not a bug — caught semantic that Cowork spec missed
- Continue surfacing CW-B34+ candidates in REPORT §5
- If a Block C/D spec turns out to be wrong at LIVE introspect (schema drift) → halt+escalate `strategic_concern_<topic>` rather than improvise
- Dry-run EXPLAIN before applying any CTE patch with target column lookups

**Cowork pre-emptive commitments for X5**:
- Block A spec underwent Dry-run EXPLAIN ✅ (anti-CW-B33)
- Block B ADR §6 generalizes Semantic FK Phantom workflow (anti-CW-B26 recurrence)
- Block C/D inherit C4 specs with CW-B25 schema introspection LIVE applied

---

## §10 — Reference files (Cowork-authored, ready for your use)

| Path | Purpose |
|---|---|
| `cowork_reserved/batch_c5/enum_fix/CW_B32_PATCH_SPEC.md` | Block A spec (full) |
| `docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md` | Block B ADR + migration + audit |
| `cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh` + README | Source for Block C/D extracts |
| `cowork_reserved/batch_c5/x4b_retrigger/README.md` | Block C/D sequencing + R-A2 |
| `cowork_reserved/batch_c4/time_leave_pilot/*` | Block C specs (8 files) |
| `cowork_reserved/batch_c4/sys_users_sdbi/*` | Block D specs (5 files) |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` | Anti-pattern catalog + vincenti §9 |
| `cowork_code_exchange/_04_REPORT_007_batch_x4.md` | X4.A REPORT (predecessor) |

---

Cowork standing by per review post-REPORT 008. Halt+escalate via inbox su any §7 trigger. Buon lavoro.

---

*End PROMPT 008*
