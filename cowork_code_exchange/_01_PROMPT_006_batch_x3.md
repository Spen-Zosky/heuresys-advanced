# PROMPT 006 — CLI Batch X3 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: 3 blocks — A: P0 schema migrations + cascade redesign | B: SDBI Goals/OKRs hardening | C: optional scale next macro-area
**Expected duration**: 4-8h CLI continuous session (single block per session OK)
**Authored**: 2026-05-21T03:00Z by Cowork (batch C3)
**Predecessor**: REPORT X2 (`cowork_code_exchange/_04_REPORT_005_batch_x2.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C3 has reviewed REPORT X2 and prepared this batch X3. Key lessons applied:
- **Schema introspection MANDATORY** (CW-B25 mitigation) — all specs in this PROMPT authored from LIVE schema queries, NOT from documentation
- **Smaller scope** — X3 is hardening + 1 new pilot, NOT mega-batch
- **Critical thinking invited** continua (your CW-B22-B27 contributions in X1+X2 were precious)

**X2 outcome recap**:
- ✅ Block A engine patches (CW-B22/B23/B24) — Wave 1 retry **3.4 min vs 55 min baseline (16× speedup)**
- ⚠️ Block B cascade fixes PARTIAL — sys_job_roles 0 (semantic FK phantom CW-B26 surfaced)
- ✅ Block C SDBI Goals/OKRs SUCCESS — 5939 rows in 10 sys.* tables (1:1 match source)
- 🔥 3 nuovi biases: CW-B25 (Spec-Schema Drift), CW-B26 (Semantic FK Phantom), CW-B27 (Cross-Workflow Schema Coupling)
- Sys.* hit ratio: 41/118 → **50/128** post-X2

**Your X3 work**:
- **Block A** (P0, MANDATORY): apply migration 000038 (ADR-0015) + migration 000039 (CW-B27) + cascade redesign sys_job_roles
- **Block B** (P1, recommended): SDBI Goals/OKRs hardening (lineage completion 4832 rows + extract users/employees) 
- **Block C** (P2, optional): pilot 1 macro-area dalle 11 TRUE GAP rimaste (raccomandato Macro-area #5 Time/Leave per volume + clarity)

**Commitments**:
- Read this PROMPT in full
- Execute Block A → B → C sequenziali (split CLI sessions OK)
- Halt+escalate via inbox `cowork_code_exchange/.inbox/cowork/pending/<TS>_006_halt_<reason>.md`
- Write REPORT `cowork_code_exchange/_04_REPORT_006_batch_x3.md` + inbox notify report_ready
- No git push without explicit step

**Critical thinking INVITED**:
- Block A is **HIGH confidence** (schema-validated specs). Execute as-is.
- Block B is **HIGH confidence** for lineage SQL (JOIN strategy validated 100%). MEDIUM for users/employees extraction (first time, sequential dependency).
- Block C is **MEDIUM confidence** (next macro-area is new pilot, similar pattern to Goals/OKRs but not identical).
- Apply CW-B25 mitigation YOURSELF: `\d <table>` LIVE before any SQL apply.

---

## §1 — Current state (post-X2)

| Metric | Value | Note |
|---|---|---|
| sys.* tables populated | **50/128** | +12 vs pre-X1 |
| Last migration applied | 000037 | sys_goals_okrs_scaffold |
| Last commit | ~bddf987 (REPORT X2) | check `git log --oneline -3` |
| sys.sys_goals | 1067 | NEW via SDBI |
| sys.sys_skills | 20048 | +14011 da MIRROR GAP X1 |
| sys.sys_job_roles | **0** | Cascade fix BLOCKED → ADR-0015 fix this batch |
| Wave 1 retry baseline | 3.4 min | Post engine fixes (16x speedup) |
| lineage rows total | ~18878 | (17771 X1 + 1107 X2) |
| Goals/OKRs lineage | 1107 / 5939 (19% coverage) | 4832 missing → C3.3 fix |

---

## §2 — Pre-flight checks

```bash
# 2.1 SSH tunnel + DB connectivity
ssh -fN -L 5433:localhost:5432 oracle-vm-default 2>/dev/null
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT version();"

# 2.2 Baseline tests
cd D:\heuresys-advanced\apps\api && pnpm test
# Expected: 318 passed / 324 (1 pre-existing fail unchanged)

# 2.3 Git state
cd D:\heuresys-advanced && git log --oneline -5
# Expected: includes recent commits from REPORT X2 batch (range ~431a07b..bddf987)
git status -sb
# Expected: main clean OR with this PROMPT file pending

# 2.4 X2 outcomes verified
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_goals', COUNT(*) FROM sys.sys_goals
UNION ALL SELECT 'sys_okrs', COUNT(*) FROM sys.sys_okrs
UNION ALL SELECT 'sys_okr_key_results', COUNT(*) FROM sys.sys_okr_key_results
UNION ALL SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
ORDER BY 1;"
# Expected: sys_goals 1067, sys_okrs 20, sys_okr_key_results 20, sys_job_roles 0
```

If ANY fails: halt+escalate.

---

## §3 — BLOCK A — P0 schema migrations + cascade redesign

### §3.A.1 ADR-0015 confirmation gate

Read `docs/architecture/adr/0015_sys_job_roles_nullable_family_fk.md` (Cowork-authored).

**Status**: PROPOSED. If you have concerns (e.g., codebase scan shows endpoint expecting NOT NULL family_id), halt+escalate `exec_strategic_concern` with evidence.

If no concerns: proceed §3.A.2. ADR moves PROPOSED → ACCEPTED upon successful X3 acceptance criteria.

### §3.A.2 Apply migration 000038 (sys_job_roles nullable family_id)

Source: `cowork_reserved/batch_c3/schema_migrations/000038_sys_job_roles_family_nullable.sql`

**MISSING — must create**: il file `000038_sys_job_roles_family_nullable.sql` non è in cowork_reserved (ADR-0015 §4 ha la specifica DDL). Authoring inline:

```sql
-- 000038_sys_job_roles_family_nullable.sql
BEGIN;
ALTER TABLE sys.sys_job_roles ALTER COLUMN job_role_family_id DROP NOT NULL;
COMMENT ON COLUMN sys.sys_job_roles.job_role_family_id IS
  'Optional FK to sys_job_families. NULL allowed for legacy-imported job_roles lacking canonical family assignment (ADR-0015 + CW-B26). UPDATE when family becomes known.';
COMMIT;
```

Apply:
```bash
cp cowork_reserved/batch_c3/schema_migrations/000038_sys_job_roles_family_nullable.sql db/migrations/  # if file exists; else author inline above
# OR write file inline based on ADR-0015 §4 spec
cd D:\heuresys-advanced && pnpm db:migrate
```

**Verify**:
```sql
\d sys.sys_job_roles
-- Expected: job_role_family_id uuid (NO NOT NULL marker)
```

### §3.A.3 Apply migration 000039 (audit source_table_id nullable)

Source: `cowork_reserved/batch_c3/schema_migrations/000039_audit_source_table_id_nullable.sql`

```bash
cp cowork_reserved/batch_c3/schema_migrations/000039_audit_source_table_id_nullable.sql db/migrations/
cd D:\heuresys-advanced && pnpm db:migrate
```

**Verify**:
```sql
\d audit.import_validation_results
-- Expected: import_validation_result_source_table_id uuid (NO NOT NULL marker)
```

### §3.A.4 Apply cascade redesign sys_job_roles

Source: `cowork_reserved/batch_c3/cascade_redesign/01_sys_job_roles_REDESIGN.sql`

This script:
1. DELETE 2 LOOKUP_FK column_mappings (the inert ones from C2.2 attempt — they pointed to non-existent FK semantic)
2. DELETE 2 synthetic alias source_columns (no longer needed post nullable FK)
3. UPDATE table_mapping_metadata stamp con ADR-0015 reference

⚠️ **Pre-flight**: verify Cowork's spec matches live schema (CW-B25):
```bash
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT cm.column_mapping_id, cm.column_mapping_target_column, cm.column_mapping_transform
FROM brownfield.column_mappings cm
JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id
WHERE tm.table_mapping_target_table='sys_job_roles'
ORDER BY cm.column_mapping_target_column;"
```

If list shows expected inert LOOKUP_FK rows for `job_role_family_id` → apply REDESIGN script. Otherwise halt+escalate.

### §3.A.5 Wave 1 retry post Block A

```bash
cd D:\heuresys-advanced && node scripts/run-wave1-fullscale.mjs > /tmp/wave_blockA_x3.json 2> /tmp/wave_blockA_x3.log
```

Expected wall-clock: ~4-5 min (engine fixes from X2 still effective).

**Verify acceptance**:
```sql
SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_job_families', COUNT(*) FROM sys.sys_job_families
ORDER BY 1;
```

Acceptance: sys_job_roles ≥ 140 (60% of 231 staged; some legitimately empty without family).

### §3.A.6 Commit Block A

```bash
git add db/migrations/000038_*.sql db/migrations/000039_*.sql db/seeds/brownfield/wave2/cascade_redesign/  # if used
git commit -m "feat(api): X3 Block A — nullable FK sys_job_roles family + audit schema (ADR-0015 + CW-B27)"
git push origin main
```

---

## §4 — BLOCK B — SDBI Goals/OKRs hardening

### §4.B.1 Complete lineage records (4832 missing)

Source: `cowork_reserved/batch_c3/lineage_completion/complete_goals_lineage.sql`

Cowork authored INSERT statements for 8 remaining SDBI tables (milestones, check_ins, updates, comments, alignments, okrs, key_results, okr_check_ins). JOIN strategy `RIGHT(<target>_natural_key, 36)::uuid = lm.<source>.id` validated 100% match.

**Pre-flight**:
```bash
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT COUNT(*) FROM sys.sys_source_lineage_records
WHERE source_lineage_target_table_name LIKE 'sys_goal%' OR source_lineage_target_table_name LIKE 'sys_okr%';"
# Expected: 1107 (from X2)
```

**Apply**:
```bash
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -f cowork_reserved/batch_c3/lineage_completion/complete_goals_lineage.sql
```

**Verify post-apply**:
```sql
SELECT source_lineage_target_table_name, COUNT(*)
FROM sys.sys_source_lineage_records
WHERE source_lineage_target_table_name LIKE 'sys_goal%' OR source_lineage_target_table_name LIKE 'sys_okr%'
GROUP BY 1 ORDER BY 1;
-- Expected counts (matching sys.* row counts):
--   sys_goal_alignments     100
--   sys_goal_check_ins      1000
--   sys_goal_comments       856
--   sys_goal_milestones     1000
--   sys_goal_templates      40
--   sys_goal_updates        1811
--   sys_goals               1067
--   sys_okr_check_ins       25
--   sys_okr_key_results     20
--   sys_okrs                20
-- Total: 5939 lineage rows (1107 pre + 4832 new)
```

### §4.B.2 Extract users + employees_core to legacy_mirror (CW-B27 mitigation)

Source: `cowork_reserved/batch_c3/schema_migrations/extract_users_employees_legacy.sh`

```bash
cp cowork_reserved/batch_c3/schema_migrations/extract_users_employees_legacy.sh db/scripts/
chmod +x db/scripts/extract_users_employees_legacy.sh

# Run
bash db/scripts/extract_users_employees_legacy.sh
```

Expected outcome (script self-verifies):
- legacy_mirror.users 274 rows
- legacy_mirror.employees_core 270 rows
- legacy_mirror.employees_pii 270 rows (PII fixture data, safe — see script header)
- legacy_mirror.employees_hr 270 rows
- legacy_mirror.employees_payroll 270 rows

### §4.B.3 Update sys_goal_check_ins.check_in_subject_user_id (X2 placeholder fix)

X2 used admin user placeholder for sys_goal_check_ins.check_in_subject_user_id NOT NULL FK. Now with legacy_mirror.employees_core available, resolve real user_id.

⚠️ Optional fix in X3 — può essere deferred a X4 se time-pressed. If applied:

```sql
-- Match legacy employee_id stored in check_in_metadata to real sys.sys_users entry
-- (sys_users will be populated when SDBI extends to users in future macro-area)
-- For now: this is a placeholder fix — actual user resolution requires sys_users populated
-- which is future scope. Skip unless sys_users fully populated.
```

Defer to X4 unless explicit need.

### §4.B.4 Commit Block B

```bash
git add db/scripts/extract_users_employees_legacy.sh
git commit -m "feat(brownfield): X3 Block B — SDBI Goals/OKRs lineage complete + legacy_mirror users/employees"
git push origin main
```

---

## §5 — BLOCK C — Optional scale next macro-area (RECOMMENDED IF TIME)

**Goal**: validate SDBI scale pattern with 1 additional pilot. Goals/OKRs proven E2E; next pilot tests pattern replicability.

**Cowork raccomandazione**: **Macro-area #5 Time/Leave** (rank #1 in C3.5 master index per volume × clarity):
- 6093 rows total (3 tabelle: employee_attendance 5237, employee_overtime 383, employee_time_off_balances 501)
- Self-contained (no cross-area FK dependencies)
- Source schema clear (timestamps + integer durations, no semantic ambiguity)
- Target schema design: NEW sys_attendance, sys_overtime, sys_time_off_balances (~3 new sys.* tables)

**Detail spec**: `cowork_reserved/batch_c3/sdbi_scale/05_TimeLeave.md`

⚠️ Block C richiede:
1. New migration `000040_sys_time_leave_scaffold.sql` (target schemas creation) — authoring TBD by CLI or Cowork batch C4
2. Extract time/leave from platform → legacy_mirror (extend extract script with TIME_LEAVE block)
3. temp_sdbi seed for 3 tables
4. Phase 5 consolidation
5. Phase 6 cleanup

**Recommendation X3**: skip Block C in X3 single session. Defer to dedicated **X4 session** for Time/Leave pilot full authoring + execution.

X3 closes after Block A + B with summary recommendation for X4.

**OR**: if CLI session has > 8h budget available + Block A + B completed cleanly, can attempt Block C pilot here. Authoring sys_time_leave_scaffold migration yourself (similar pattern to 000037_sys_goals_okrs_scaffold.sql) + adapt Goals/OKRs SDBI workflow to Time/Leave.

---

## §6 — Cowork artifacts directory

| File | Purpose |
|---|---|
| `docs/architecture/adr/0015_sys_job_roles_nullable_family_fk.md` | ADR-0015 source (Block A.1 gate) |
| `cowork_reserved/batch_c3/schema_migrations/000039_audit_source_table_id_nullable.sql` | Migration spec Block A.3 |
| `cowork_reserved/batch_c3/schema_migrations/extract_users_employees_legacy.sh` | Block B.2 script |
| `cowork_reserved/batch_c3/cascade_redesign/01_sys_job_roles_REDESIGN.sql` | Block A.4 spec |
| `cowork_reserved/batch_c3/lineage_completion/complete_goals_lineage.sql` | Block B.1 spec |
| `cowork_reserved/batch_c3/sdbi_scale/00_MASTER_INDEX.md` | 11 macro-aree ranking (X4+ context) |
| `cowork_reserved/batch_c3/sdbi_scale/05_TimeLeave.md` | Block C option spec |
| `cowork_code_exchange/_04_REPORT_005_batch_x2.md` | X2 REPORT (your previous work) |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` | Pattern reference (your feedback X2 informed this) |

---

## §7 — Halt+escalate triggers

Emit `cowork_code_exchange/.inbox/cowork/pending/<TS>_006_halt_<reason>.md` if:

1. Pre-flight check fail §2
2. Migration 000038 fails apply (FK constraint conflict, unexpected NOT NULL data)
3. Migration 000039 fails apply (audit table dependency)
4. Cascade redesign §3.A.4 pre-flight reveals brownfield state inconsistent with C2.2 expectations
5. Wave 1 retry post Block A wall-clock > 60 min (vs ~4-5 expected)
6. sys_job_roles count < 50 post Block A retry (R-01 + ADR-0015 unmitigated)
7. Lineage SQL §4.B.1 produces row count drastically different from expected 4832
8. extract_users_employees_legacy.sh fails (PII concern, schema mismatch, etc.)
9. ADR-0015 codebase audit reveals NOT NULL family_id assumption in endpoints (halt strategic_concern)
10. Disk space, git push, anything outside clear scope

---

## §8 — REPORT 006 format

Write `cowork_code_exchange/_04_REPORT_006_batch_x3.md`:

```markdown
# REPORT 006 — CLI Batch X3

**Executed**: <start> → <end> (wall-clock)
**Sessions**: 1 or split

## §1 — Block A outcomes
### §1.A.1 ADR-0015 gate
- Codebase audit: NOT NULL family_id assumed?: yes/no
- Decision: proceed/halt
### §1.A.2 Migration 000038
- Applied: yes/no
- Verify: \d output, family_id nullable: yes/no
### §1.A.3 Migration 000039
- (same)
### §1.A.4 Cascade redesign
- Pre-flight: live schema matched spec?: yes/no
- DELETE rows: N (inert column_mappings + alias source_columns)
- Commit SHA
### §1.A.5 Wave 1 retry
- runId, wall-clock, sys_job_roles count

## §2 — Block B outcomes
### §2.B.1 Lineage completion
- 4832 new rows expected, actual: N
- Per-table breakdown
### §2.B.2 Users/employees extraction
- 1354 rows expected, actual: N
- Tables created in legacy_mirror

## §3 — Block C outcome (if attempted)
- skipped/attempted/completed

## §4 — Sys.* hit ratio + lineage coverage
- Pre-X3: 50/128, lineage 18878
- Post-X3: N/128, lineage M

## §5 — Halts + Anomalies

## §5.5 — Cowork spec improvements suggested

## §6 — Bias catalog candidates (CW-B28+)

## §7 — Next step recommendation for Cowork batch C4
- Time/Leave pilot (Macro-area #5) full authoring
- OR specific issues to address first

## §8 — Feedback sul modello operativo Cowork↔CLI
```

After REPORT: `node scripts/cowork-exchange/notify.mjs cowork report_ready --goal 006 --slug batch_x3 ...`

---

## §9 — Closing

After REPORT: STOP. Cowork batch C4 will review + plan Time/Leave pilot OR address P0 issues.

Good luck. Block A is straightforward execution. Block B has the highest value/effort ratio (4832 lineage rows in ~30 min). Block C is bonus if time permits.

---

*End PROMPT 006 batch X3*
