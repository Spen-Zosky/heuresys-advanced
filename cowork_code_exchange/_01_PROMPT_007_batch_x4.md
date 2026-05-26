# PROMPT 007 — CLI Batch X4 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: 2 macro-blocks — A: P0 engine fix (CW-B31) + cascade re-try + cross-OS hygiene | B: 2 new SDBI pilots (Time/Leave + sys_users extension)
**Expected duration**: 5-9h CLI continuous session (recommend split A/B in 2 sessions)
**Authored**: 2026-05-21T03:30Z by Cowork (batch C4)
**Predecessor**: REPORT X3 (`cowork_code_exchange/_04_REPORT_006_batch_x3.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C4 has reviewed REPORT X3 + investigated job_templates failure + authored 2 new SDBI pilots. Lessons applied from REPORT X3 (3 new biases CW-B28/B29/B30):

- All extract scripts in this batch follow Cross-OS universal pipeline (CW-B28 mitigation, §6)
- Migration convention: NO `INSERT INTO sys.sys_schema_migrations` (CW-B29)
- Pre-flight includes `pnpm --filter @heuresys/shared build` if editing shared/ (CW-B30)
- Schema introspection LIVE applied to ALL specs (CW-B25 ongoing)

**X3 outcome recap**:
- ✅ Migration 000038 ADR-0015 (sys_job_roles family_id nullable) + companion Zod/Row edits
- ✅ Migration 000039 (audit source_table_id nullable, CW-B27)
- ✅ sys_job_roles 0 → 91 (ccnl_job_title_mapping)
- ❌ sys_job_roles job_templates 140 → 0 (UQ collision on duplicate job_code — new bias **CW-B31** identified by Cowork C4.1)
- ✅ SDBI Goals/OKRs lineage completion 4832 rows
- ✅ legacy_mirror.users + employees_* extracted (1354 rows total)

**Your X4 work**:
- **Block A (P0)**: CW-B31 engine fix (DISTINCT ON dedup on main INSERT) + sys_esco_occupation_mappings cascade re-try + cross-OS hygiene
- **Block B (P1)**: SDBI pilots — Time/Leave (3-6 tables, ~6267 rows) + sys_users extension (sys.sys_users 163 → ~433-437)

**Commitments** (same as before):
- Read PROMPT in full
- Execute Block A → B sequenziali (split sessions OK)
- Halt+escalate via inbox
- Write REPORT `cowork_code_exchange/_04_REPORT_007_batch_x4.md` + inbox notify
- No git push without explicit step

**Critical thinking INVITED** (you contribute CW-B25-B30 — keep it up):
- Block A patches: Cowork-authored, **HIGH confidence** (CW-B31 spec patterned on CW-B24 X2 success). Apply as-is, segnalare anomalie.
- Block B Time/Leave: **HIGH confidence** schema design, **MEDIUM** authoring (first pilot post-Goals/OKRs)
- Block B sys_users: **MEDIUM** confidence — è UPSERT MERGE in existing table (not new schema). 6 R-risks identified by C4.3 subagent — see §5.2 details.

---

## §1 — Executive briefing

### §1.1 Current state post-X3

| Metric | Value |
|---|---|
| sys.* populated tables | 51/128 |
| sys.sys_users | 163 (5 admin + 158 SYNTHETIC_REFERENCE CASCADIA) |
| sys.sys_job_roles | **91** (ccnl only, X4 expected →~141-151) |
| sys.sys_skills | 20048 |
| sys.sys_goals + 9 satellite | 5939 |
| Lineage records | ~23710 |
| Migrations applied | up to 000039 |
| legacy_mirror tables | 30 (post X3 +5 users/employees) |
| Wave 1 retry baseline | 3.4 min |

### §1.2 What Cowork batch C4 prepared

✅ **Investigations + spec files** in `cowork_reserved/batch_c4/`:
- `investigations/01_job_templates_failure_root_cause.md` — CW-B31 forensic + fix proposal (Option A engine-level DISTINCT ON dedup)
- `time_leave_pilot/` 8 files (SDBI pilot Macro-area #5)
- `sys_users_sdbi/` 5 files (extension existing sys.sys_users)
- `esco_cascade/02_sys_esco_occupation_mappings_RETRY.md` — cascade re-try spec
- `cross_os_fixes/README.md` — CW-B28/B29/B30 mitigation guidance

✅ **PROMPT pattern memo** updated with CW-B28/B29/B30 anti-patterns + 2 new patterns vincenti (`cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §8).

### §1.3 Decisions locked (no further confirmation)

| Decision | Status | Reference |
|---|---|---|
| ADR-0015 sys_job_roles nullable FK | ✅ ACCEPTED (X3 verified) | docs/architecture/adr/0015_*.md |
| ADR-0014 SDBI architecture | ✅ ACCEPTED (X2 + X3 validated) | docs/architecture/adr/0014_*.md |
| Time/Leave HC items 1-8 | DEFAULT ACCEPT (X2 pattern Enzo) | `time_leave_pilot/00_README_TIME_LEAVE_PILOT.md §HC` |
| sys_users HC items 1-4 | DEFAULT ACCEPT (X2 pattern Enzo) | `sys_users_sdbi/00_README_SYS_USERS_SDBI.md §HC` |
| CW-B31 fix Option A (engine DISTINCT ON dedup main INSERT) | RECOMMENDED Cowork — implement in X4 | `investigations/01_*.md §4.1` |
| Cross-OS fix patterns | ✅ DOCUMENTED `cross_os_fixes/README.md` | apply to new scripts |

---

## §2 — Pre-flight checks (mandatory)

```bash
# 2.1 SSH + DB
ssh -fN -L 5433:localhost:5432 oracle-vm-default 2>/dev/null
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT version();"

# 2.2 Baseline tests
cd D:\heuresys-advanced\apps\api && pnpm test
# Expected: 318 passed / 324 (baseline preserved)
pnpm typecheck
# Expected: 0 errors

# 2.3 X3 commits in main
cd D:\heuresys-advanced && git log --oneline -5
# Expected: includes commits ~75b3e1a + 2de68a3 (X3 Block A + B)

# 2.4 X3 outcomes verified
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_goals', COUNT(*) FROM sys.sys_goals
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
UNION ALL SELECT 'legacy_mirror.users', COUNT(*) FROM legacy_mirror.users
UNION ALL SELECT 'legacy_mirror.employees_core', COUNT(*) FROM legacy_mirror.employees_core
ORDER BY 1;"
# Expected: sys_job_roles 91, sys_goals 1067, sys_users 163, legacy_mirror.users 274, employees_core 270

# 2.5 Migrations applied
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT file_name FROM sys.sys_schema_migrations ORDER BY applied_at DESC LIMIT 5;"
# Expected: 000039_audit_source_table_id_nullable.sql + 000038_sys_job_roles_family_nullable.sql in top 5

# 2.6 CW-B30 build artefact pre-flight (if editing shared/)
# Skip unless touching packages/shared/ — Block A doesn't, Block B doesn't
```

If ANY fails: halt+escalate.

---

## §3 — BLOCK A (P0): CW-B31 fix + ESCO cascade re-try + cross-OS hygiene

### §3.A.1 CW-B31 engine fix — DISTINCT ON dedup main INSERT

**Source**: `cowork_reserved/batch_c4/investigations/01_job_templates_failure_root_cause.md` §4.1 Option A

**Why**: job_templates 140 staged with duplicate `job_code` values (PROTO-X-Y pattern, 4x duplicates). Main INSERT `ON CONFLICT DO UPDATE` fails with "cannot affect row a second time" → 0 upserted (engine try/catch absorbs error).

**Fix pattern**: Apply DISTINCT ON dedup to main INSERT (symmetric to CW-B24 lineage write X2 fix).

**File**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` line ~478-488 (main INSERT in step 6)

**Code change**:

Find:
```typescript
const insertSql = `
  INSERT INTO ${qTargetTable} (${colsList})
  SELECT ${selectList}
    FROM ${qStagingTable}
   WHERE ${baseWhere.join(" AND ")}
   ORDER BY staging_row_id
   ${limitClause}
  ON CONFLICT (${conflictInference}) ${setClause}
  RETURNING ${qPkCol}
`;
```

Replace with:
```typescript
// CW-B31 dedup: filter duplicate conflict-key rows BEFORE main INSERT
// (sym to CW-B24 lineage write fix X2 — apply DISTINCT ON to absorb duplicate
// natural keys without triggering "ON CONFLICT cannot affect row a second time")
const conflictKeyExpr = conflictInference; // e.g. "(job_role_code)" for sys_job_roles
const insertSql = `
  WITH staging_filtered AS (
    SELECT *
      FROM ${qStagingTable}
     WHERE ${baseWhere.join(" AND ")}
     ${limitClause}
  ),
  staging_deduped AS (
    SELECT DISTINCT ON ${conflictKeyExpr} *
      FROM staging_filtered
     ORDER BY ${conflictKeyExpr},
              staging_mapping_confidence DESC NULLS LAST,
              staging_row_id ASC
  )
  INSERT INTO ${qTargetTable} (${colsList})
  SELECT ${selectList}
    FROM staging_deduped
  ON CONFLICT (${conflictInference}) ${setClause}
  RETURNING ${qPkCol}
`;
```

**Note critica**: `conflictInference` ha forma "(col1, col2)" parenthesized OR "col_name" bare. Verify forma esatta + adatta DISTINCT ON syntax. If `conflictInference = "(job_role_code)"` → `DISTINCT ON (job_role_code)` syntactically OK. If alternative form → adatta.

⚠️ **CW-B25 pre-apply check**: verify `selectList` references columns from the staging row in a way compatible con il CTE filtering. Step 6 in current code may have JOIN-back que i CTE replicano: verify che `${selectList}` non rifaccia query a `${qStagingTable}` ricorsivamente.

If anomalous structure found: halt+escalate, propose adjusted patch.

**Test cases** (add to `apps/api/test/upsert-sql.cw-b31.test.ts` new file, ~80 LOC):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
// ... boilerplate

describe("CW-B31 main INSERT dedup", () => {
  it("dedups duplicate natural keys keeping highest confidence", async () => {
    // staging has 4 rows with same job_role_code, different confidence
    // expect 1 row inserted with highest-confidence content
  });

  it("dedups deterministically via staging_row_id when confidence tied", async () => {
    // staging has 3 rows same job_role_code, NULL confidence
    // expect 1 row inserted = first by staging_row_id ASC
  });

  it("preserves all rows when no duplicates", async () => {
    // staging has 100 rows all unique job_role_code
    // expect 100 inserted
  });

  it("dedup applies before ON CONFLICT (no second-conflict error)", async () => {
    // staging has duplicates AND target already has matching row
    // expect: 1 deduped row goes through ON CONFLICT DO UPDATE successfully
  });
});
```

Run tests:
```bash
cd D:\heuresys-advanced\apps\api && pnpm typecheck   # expect 0 errors
pnpm test                                            # expect ≥318 passed (existing) + new tests
```

**Commit**: `feat(api): CW-B31 fix — DISTINCT ON dedup main INSERT (resolve duplicate natural-key collision)` + push.

### §3.A.2 sys_esco_occupation_mappings cascade re-try

**Source**: `cowork_reserved/batch_c4/esco_cascade/02_sys_esco_occupation_mappings_RETRY.md`

**Pre-flight CW-B26 semantic FK check**:
```bash
ssh -i ~/.ssh/oci_key ubuntu@80.225.82.207 "sudo -u postgres psql -d heuresys_advanced -c \"
WITH samples AS (
  SELECT staging_raw_record->>'esco_occupation_code' AS code_in_source, staging_row_id
  FROM staging.wave1_esco_occupation_mappings
  WHERE staging_source_table = 'esco_occupations'
  LIMIT 5
)
SELECT s.code_in_source,
       (SELECT slr.source_lineage_target_record_id
        FROM sys.sys_source_lineage_records slr
        WHERE slr.source_lineage_target_table = 'sys_job_roles'
          AND slr.source_lineage_source_record_id = s.code_in_source LIMIT 1) AS resolves
FROM samples s;\""
```

If resolves count ≥ 3/5 → apply X2 file `cowork_reserved/batch_c2/cascade_fixes/02_sys_esco_occupation_mappings_fix.sql` (pre-flight schema verify CW-B25 first).

If resolves 0/5 → halt+escalate `exec_strategic_concern`, propose ADR-0016 nullable FK for sys_esco_occupation_mappings (similar pattern to ADR-0015).

### §3.A.3 Wave 1 retry post Block A

```bash
cd D:\heuresys-advanced && node scripts/run-wave1-fullscale.mjs > /tmp/wave_x4_blockA.json 2> /tmp/wave_x4_blockA.log
```

**Expected** (with CW-B31 fix + esco cascade if landed):
- Wall-clock ~4 min (engine fixes preserved)
- sys_job_roles: 91 → ~141-151 (job_templates dedup unlock)
- sys_esco_occupation_mappings: 0 → ~1500-5000 (if Option α applied)

### §3.A.4 Cross-OS hygiene fixes (CW-B28/B29)

Per `cowork_reserved/batch_c4/cross_os_fixes/README.md`:

1. Update `db/scripts/extract_users_employees_legacy.sh` con cross-OS pipeline (grep `\restrict` + sed vector/uuid_generate)
2. (optional) Remove explicit `INSERT INTO sys.sys_schema_migrations` from `cowork_reserved/batch_c3/schema_migrations/000039_audit_source_table_id_nullable.sql` (already applied — purely doc cleanup)

Commit: `chore(brownfield): X4 hygiene — cross-OS extract script + migration convention (CW-B28/B29)`

### §3.A.5 Commit Block A + push

```bash
git add apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts \
        apps/api/test/upsert-sql.cw-b31.test.ts \
        db/scripts/extract_users_employees_legacy.sh
git commit -m "feat(api): X4 Block A — CW-B31 main INSERT dedup + cross-OS hygiene"
git push origin main
```

---

## §4 — BLOCK B (P1): SDBI pilots — Time/Leave + sys_users extension

### §4.B.1 Time/Leave pilot (Macro-area #5)

**Source**: `cowork_reserved/batch_c4/time_leave_pilot/` (8 files Cowork-authored)

Read in order:
1. `00_README_TIME_LEAVE_PILOT.md` — workflow + 8 HC items (default approve per X2 pattern)
2. `02_TARGET_SCHEMA_PROPOSAL.md` — 6 sys.* tables design (verify count: 3 vs 6 per HC-2)
3. `migrations/000040_sys_time_leave_scaffold.sql` — apply
4. `mapping_cards/*.md` (3 cards minimum — attendance, overtime, balances)
5. `03_PHASE3_TEMP_SDBI_DDL.md` — temp_sdbi seeding plan
6. `04_PHASE5_CONSOLIDATION_PLAN.md` — consolidation INSERT...SELECT

**Sequence**:
1. Apply migration 000040 (sys_attendance + sys_overtime + sys_time_off_balances + opt 3 satellite)
2. Extract source tables to legacy_mirror via cross-OS pipeline (§6 pattern). Tables: employee_attendance, employee_overtime, employee_time_off_balances + (HC-2 choice) employee_time_off_requests, leave_balance_transactions, leave_accrual_rules
3. temp_sdbi seed + INSERT-SELECT per mapping cards
4. Phase 5 consolidation
5. Phase 6 cleanup (DROP temp_sdbi.*)
6. Verify acceptance: ~5237 + 383 + 501 (+ optional 99+27+20) = 6267 rows in 3-6 sys.* tables

**Commit**: `feat(sys): X4 SDBI Time/Leave pilot — Macro-area #5 (Goals/OKRs pattern replica)`

### §4.B.2 sys_users SDBI extension

**Source**: `cowork_reserved/batch_c4/sys_users_sdbi/` (5 files Cowork-authored)

⚠️ **Critical**: this pilot is **UPSERT MERGE into existing sys.sys_users** (NOT new table). Must preserve 5 STANDARD test admin rows + 158 SYNTHETIC_REFERENCE CASCADIA. Use `ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING` (preserve existing, append new).

Read:
1. `00_README_SYS_USERS_SDBI.md` — index + 4 HC items + UNIQUE strategy
2. `01_SOURCE_ANALYSIS.md` — legacy_mirror.users (274) + employees_core (270) + employees_pii (270) merge analysis
3. `02_MAPPING_STRATEGY.md` — HYBRID merge, driver=users, JOIN employees_pii for email/name
4. `03_PHASE3_TEMP_SDBI_DDL.md` — temp_sdbi.sys_users mirror + pass-1/pass-2 user resolution
5. `04_PHASE5_CONSOLIDATION_PLAN.md` — UPSERT into sys.sys_users with conflict preserve

**Pre-flight CW-B25**:
```bash
ssh -i ~/.ssh/oci_key ubuntu@80.225.82.207 'sudo -u postgres psql -d heuresys_advanced -c "
\d sys.sys_users
\d legacy_mirror.users
\d legacy_mirror.employees_pii
SELECT user_natural_key, user_email FROM sys.sys_users WHERE user_natural_key LIKE 'ADMIN::%' LIMIT 5;
SELECT COUNT(*), COUNT(DISTINCT email) FROM legacy_mirror.users;
"'
```

**Sequence**:
1. Verify legacy_mirror.users/employees_pii present (X3 extracted, but verify counts)
2. temp_sdbi.sys_users mirror DDL (06_README §pass-1 plan)
3. INSERT-SELECT da legacy_mirror with HYBRID merge logic
4. Phase 5 consolidation: UPSERT into sys.sys_users with ON CONFLICT DO NOTHING (preserve admins)
5. Verify: sys.sys_users count 163 → ~433-437 (preserve all 163 + insert ~268-272 new)

**6 R-risks identified by C4.3 subagent** — see `00_README_SYS_USERS_SDBI.md §HC checklist` for mitigation. R-key: **A2 fallimento (test admin perso) = HALT immediato**.

**Verify post-consolidation**:
```sql
SELECT user_natural_key LIKE 'ADMIN::%' AS is_admin, COUNT(*)
FROM sys.sys_users GROUP BY 1;
-- Expected: ADMIN 5 (preserved), non-ADMIN ~428-432 (158 CASCADIA + 270-274 new)
```

**Commit**: `feat(sys): X4 SDBI sys_users extension — 163→~433 via HYBRID merge legacy_mirror.users+employees_pii`

### §4.B.3 Block B push + Wave 1 retry (optional)

Wave 1 retry NOT required after Block B (SDBI doesn't use Wave executor). Skip retry, just commit + push.

```bash
git push origin main
```

---

## §5 — Cowork artifacts directory

| Path | Content |
|---|---|
| `cowork_reserved/batch_c4/investigations/01_job_templates_failure_root_cause.md` | CW-B31 forensic + Option A spec |
| `cowork_reserved/batch_c4/time_leave_pilot/` (8 files) | Time/Leave SDBI pilot full |
| `cowork_reserved/batch_c4/sys_users_sdbi/` (5 files) | sys_users SDBI extension |
| `cowork_reserved/batch_c4/esco_cascade/02_RETRY.md` | ESCO cascade re-try spec |
| `cowork_reserved/batch_c4/cross_os_fixes/README.md` | CW-B28/B29/B30 mitigations |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` | Updated §8 with 3 new anti-patterns + 2 patterns vincenti |
| `docs/architecture/adr/0015_*.md` | ADR-0015 nullable FK (X3 applied) |

---

## §6 — Cross-OS universal extract pipeline (CW-B28)

ALL extract scripts in X4+ MUST use this pattern:

```bash
# Data extract
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --data-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/COPY public\./COPY legacy_mirror./g' \
  | psql "${DB_URL}"

# Schema extract (first time per table)
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --schema-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/vector([0-9]*)/text/g' \
  | sed 's/uuid_generate_v4()/gen_random_uuid()/g' \
  | sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS legacy_mirror./g' \
  | sed 's/public\./legacy_mirror./g' \
  | sed '/^ALTER TABLE.*ADD CONSTRAINT/d' \
  | sed '/^CREATE INDEX/d' \
  | psql "${DB_URL}"
```

---

## §7 — Halt+escalate triggers

Emit `cowork_code_exchange/.inbox/cowork/pending/<TS>_007_halt_<reason>.md` if:

1. Pre-flight check fail §2
2. CW-B31 patch breaks > 5 existing tests
3. CW-B31 typecheck error unresolvable >30min
4. ESCO cascade pre-flight resolves 0/5 samples (semantic FK still broken)
5. Wave 1 retry wall-clock > 60 min (vs ~4-5 expected)
6. sys_job_roles count post X4 < 130 (CW-B31 fix not effective)
7. Time/Leave migration 000040 fails apply
8. **sys_users any test admin row LOST during merge** (R-A2 critical — immediate halt)
9. Cross-DB query / pg_dump pipeline fails (cross-OS bug regressione)
10. Disk space, git push, ecc.

---

## §8 — REPORT 007 format

Write `cowork_code_exchange/_04_REPORT_007_batch_x4.md`:

```markdown
# REPORT 007 — CLI Batch X4

**Executed**: <start> → <end>
**Sessions**: 1 or split

## §1 — Block A outcomes
### §1.A.1 CW-B31 patch
- Applied, typecheck, tests, commit SHA
- DISTINCT ON syntax variation needed?
### §1.A.2 ESCO cascade
- Pre-flight resolves count: N/5
- Decision: applied/halted
- Post-retry count
### §1.A.3 Wave 1 retry
- runId, wall-clock, sys_job_roles+sys_esco counts
### §1.A.4 Cross-OS hygiene
- Files updated
- Commit SHA

## §2 — Block B outcomes
### §2.B.1 Time/Leave pilot
- 3 vs 6 tables choice (HC-2)
- Migration 000040 applied
- Source extract row counts to legacy_mirror
- temp_sdbi seed counts
- Phase 5 consolidation 3-6 sys.* counts
- Cleanup confirmed

### §2.B.2 sys_users extension
- Pre-merge sys.sys_users count
- temp_sdbi.sys_users count post-source-load
- Post-merge sys.sys_users count
- Admin preservation verified (5 still ADMIN:: present)
- 6 R-risks: status per ognuno

## §3 — Sys.* hit ratio + lineage
- Pre-X4 / Post-X4

## §4 — Halts + Anomalies

## §4.5 — Cowork spec improvements suggested
- Block A patch insertion variations encountered
- Block B Time/Leave HC default vs deviation
- Block B sys_users R-risks resolution

## §5 — Bias catalog candidates (CW-B32+)

## §6 — Next step recommendation for Cowork batch C5
- Performance Reviews SDBI pilot (Macro-area #1)
- OR Recruiting (Macro-area #2)
- OR address residual issues

## §7 — Feedback sul modello operativo Cowork↔CLI
```

After REPORT: `node scripts/cowork-exchange/notify.mjs cowork report_ready --goal 007 --slug batch_x4 ...`

---

## §9 — Closing

After REPORT: STOP. Cowork batch C5 will review + plan next macro-area (most likely Performance Reviews or Recruiting per master index ranking).

Block A is mechanical (CW-B31 patch + ESCO retry + hygiene). Block B is the value generation (~6700 new sys.* rows from Time/Leave + sys_users extension unblocks user_id resolution cross-pilot).

Good luck.

---

*End PROMPT 007 batch X4*
