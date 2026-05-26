# PROMPT 005 — CLI Batch X2 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: 3-block batch — A: engine.ts fixes (CW-B22/B23/B24) | B: P1 cascade Class B unlock (4 targets) | C: SDBI Goals/OKRs pilot
**Expected duration**: 9-15h CLI continuous session (can split if needed)
**Authored**: 2026-05-20T22:50Z by Cowork (batch C2)
**Predecessor**: REPORT X1 (`cowork_code_exchange/_04_REPORT_004_batch_x1.md`) — review by Cowork batch C2 ✅

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. You are the **executor** in Cowork↔CLI v2.2 protocol. Cowork (Claude Opus, batch C2 2026-05-20T22:18Z) has reviewed REPORT X1 and prepared this batch X2.

**X1 outcome recap** (your previous work):
- ✅ CW-B17 silent skip audit patch landed (commit `1443b54`) — 35640 silent skip rows ora documentati
- ✅ sys_job_families bootstrap (27 rows) — cascade root unblocked
- ✅ skill_adjacencies 5th MIRROR GAP fix (11634 rows in mirror)
- ✅ sys_skills 6037 → 20048 (+14011 da esco_skills MIRROR GAP)
- ✅ Wave 1 retry COMPLETED 55.4min, 17771 lineage rows
- ✅ commits pushed `origin/main 56a439e..56f3b03`
- 🔥 3 new biases discovered: CW-B22 (IS NOT DISTINCT FROM index gap), CW-B23 (stale stats), CW-B24 (lineage self-conflict)
- 🎯 9 spec improvements proposed (§2.5 of REPORT) — alcuni integrati in questo PROMPT

**Your work this batch (X2)**:
- **Block A** (P0): engine.ts deep-fix per CW-B22 + CW-B23 + CW-B24
- **Block B** (P1): apply 4 cascade Class B fixes + Wave 1 retry
- **Block C** (P2): SDBI Goals/OKRs pilot (10 source tables → 10 new sys.* tables via SDBI workflow)

**Commitments**:
- Read this PROMPT in full before any action
- Execute step-by-step in order: A → B → C (sequential per design)
- Halt+escalate (write to `cowork_code_exchange/.inbox/cowork/pending/<TS>_005_halt_<reason>.md`) on triggers in §10
- Write REPORT to `cowork_code_exchange/_04_REPORT_005_batch_x2.md` at end (format §11)
- No git push without explicit step instruction
- Each Block A/B/C has its own dedicated commit pre-push

**Critical thinking INVITED — non sei un esecutore cieco**:

You did excellent critical thinking in X1 (9 spec improvements + 3 new biases). Same approach here:

1. **Segnalare lacune o errori nelle mie patch specs** — i 3 engine patches CW-B22/B23/B24 sono Confidence MEDIUM-HIGH ma non perfetti. Se vedi bug, propose fix.
2. **R-01 critical risk** (cascade fixes Block B): la synthetic alias strategy DIPENDE dal fatto che lo staging code dereferenzi `aliased_from` metadata. **DEVI verificare staging code PRIMA di applicare**. Se non funziona, alternative strategy va proposta.
3. **Halt+escalate `exec_strategic_concern`** se decisioni macroscopiche ti sembrano sbagliate.
4. **Catalogare nuovi bias CW-B25+** se trovi pattern non documentati.
5. **Documentare anomalie** (non solo halt) — il tuo CW-B22-B24 discovery in X1 è stato asset prezioso.

**Mode operativo per Block**:
- **Block A engine patches**: confidence MEDIUM-HIGH (Cowork ha autorato 3 patches via deep code-read, ma engine.ts è file critico). Valuta criticamente, propone alternative se necessario, halt+escalate su ambiguità materiali.
- **Block B cascade fixes**: confidence MEDIUM (R-01 staging code risk pendente). Pre-flight verification OBBLIGATORIA prima di applicare INSERT SQL.
- **Block C SDBI pilot**: confidence HIGH su design (Cowork-authored), MEDIUM su execution (SDBI è nuovo paradigma — primo run). HC items già locked da Enzo, no further confirmation needed.

---

## §1 — Executive briefing (5 min read)

### §1.1 Project context

Recap dal PROMPT 004 §1.1: heuresys_advanced = greenfield rewrite. Brownfield pipeline LIVE. sys.* hit ratio post-X1 ~ 41/118 populated.

### §1.2 Current state DB post-X1

| Table | Rows | Note |
|---|---|---|
| `sys.sys_skills` | **20048** | +14011 from esco_skills MIRROR GAP |
| `sys.sys_learning_modules` | 4488 | unchanged X1 |
| `sys.sys_learning_paths` | 3227 | unchanged X1 |
| `sys.sys_activity_classifications` | 3276 | unchanged X1 |
| `sys.sys_source_lineage_records` | **17771** | +1038 from X1 retry |
| `sys.sys_skill_aliases` | **80** | +80 partial (62% of 130 staged) |
| `sys.sys_job_families` | **27** | NEW — bootstrap Block X1 |
| `sys.sys_skill_families` | 77 | unchanged |
| `sys.sys_compensation_bands` | 75 | unchanged |
| `sys.sys_blueprint_process_registry` | 23 | unchanged |
| `sys.sys_users` | 163 | unchanged |
| `sys.sys_positions` | 161 | unchanged |

**Pending silent skip targets** (35640 audit rows ora documentati, top 5 reasons):
- `nk_missing_skill_taxonomy_edge_parent_id` 17924 → sys_skill_taxonomy_edges
- `nk_missing_esco_occupation_mapping_job_role_id` 7645 → sys_esco_occupation_mappings
- `required_missing_skill_category_family_id` 7256 → sys_skill_categories
- `nk_missing_skill_learning_mapping_skill_id` 1381 → sys_skill_learning_mappings
- `required_missing_job_role_family_id` 231 → sys_job_roles

### §1.3 What Cowork batch C2 already prepared (no CLI work needed)

✅ **Engine patches** in `cowork_reserved/batch_c2/engine_patches/` (3 patch specs):
- `CW_B22_PATCH_SPEC.md` (380 LOC) — IS NOT DISTINCT FROM → = on NOT NULL NK cols
- `CW_B23_PATCH_SPEC.md` (424 LOC) — ANALYZE step post-staging-load in pipeline
- `CW_B24_PATCH_SPEC.md` (576 LOC) — Lineage self-conflict fix (DISTINCT ON dedup)
- `00_README_ENGINE_PATCHES.md` (217 LOC) — index + integration order

✅ **Cascade fixes** in `cowork_reserved/batch_c2/cascade_fixes/` (4 SQL specs):
- `01_sys_job_roles_mapping_fix.sql` (289 LOC) — Confidence HIGH
- `02_sys_esco_occupation_mappings_fix.sql` (289 LOC) — Confidence MEDIUM
- `03_sys_skill_categories_fix.sql` (243 LOC) — Confidence MEDIUM-HIGH
- `04_sys_skill_taxonomy_edges_fix.sql` (265 LOC) — Confidence MEDIUM-LOW
- `00_README_CASCADE_FIXES.md` (218 LOC) — index + R-01 critical risk

✅ **SDBI Goals/OKRs pilot** in `cowork_reserved/batch_c1/goals_pilot/` (17 files, dal C1.8 batch):
- `00_README_GOALS_PILOT.md` — full workflow narrative
- `01_SOURCE_DISCOVERY.md` — 10 source tables Phase 1 analysis
- `02_TARGET_SCHEMA_PROPOSAL.md` — 10 new sys.* tables design
- `migrations/000036_temp_sdbi_schema.sql` ⚠️ **renamed** (was 000034)
- `migrations/000037_sys_goals_okrs_scaffold.sql` ⚠️ **renamed** (was 000035)
- `mapping_cards/*.md` (10 SDBI cards)
- `04_PHASE3_TEMP_SDBI_DDL.md` — temp_sdbi.<table> mirror DDLs
- `05_PHASE5_CONSOLIDATION_PLAN.md` — INSERT...SELECT consolidation

⚠️ **Migration number conflict**: il C1.8 originale aveva `000034_temp_sdbi_schema.sql` + `000035_sys_goals_okrs_scaffold.sql`, MA X1 ha used `000034_add_wave1_job_families_staging.sql`. Cowork ha renamed le SDBI migrations a `000036` + `000037`. **USA SOLO `000036` e `000037`**, IGNORA i file `000034`/`000035` in goals_pilot/migrations/ (legacy duplicates non-removable da sandbox).

### §1.4 Decisions locked (no further confirmation)

| Decision | Status | Reference |
|---|---|---|
| Opt3 Hybrid strategy | ✅ ACCEPTED | `cowork_reserved/11_STRATEGIC_REFORMULATION.md` |
| 8 HC items Goals/OKRs pilot | ✅ ALL DEFAULT ACCEPTED | `cowork_reserved/batch_c1/goals_pilot/00_README_GOALS_PILOT.md §4` |
| Engine patches CW-B22/B23/B24 design | ✅ READY (Cowork-authored, your validation invited) | `cowork_reserved/batch_c2/engine_patches/` |
| Cascade fixes synthetic alias strategy | ✅ ACCEPTED with R-01 caveat | `cowork_reserved/batch_c2/cascade_fixes/00_README_CASCADE_FIXES.md` |
| Block sequence A → B → C | ✅ Cowork-locked | this PROMPT §3-§7 |

---

## §2 — Pre-flight checks (mandatory)

```bash
# 2.1 SSH tunnel up
ssh -fN -L 5433:localhost:5432 oracle-vm-default 2>/dev/null
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT version();"

# 2.2 Baseline tests
cd D:\heuresys-advanced\apps\api
pnpm test
# Expected: 318 passed / 324 (1 pre-existing fail in skills.integration.test.ts:131 from X1 baseline)
pnpm typecheck
# Expected: 0 errors

# 2.3 Confirm X1 commits pushed
cd D:\heuresys-advanced && git log --oneline -3
# Expected: includes 56f3b03 (X1 bundle) + 1443b54 (CW-B17)

# 2.4 Migration 000034 applied?
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT migration_id, file_name FROM sys.sys_schema_migrations ORDER BY migration_id DESC LIMIT 5;"
# Expected: 000034_add_wave1_job_families_staging.sql in list. If missing → halt+escalate (X1 incomplete state).

# 2.5 Sys.* current state
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_skills', COUNT(*) FROM sys.sys_skills
UNION ALL SELECT 'sys_job_families', COUNT(*) FROM sys.sys_job_families
UNION ALL SELECT 'sys_skill_aliases', COUNT(*) FROM sys.sys_skill_aliases
UNION ALL SELECT 'sys_source_lineage_records', COUNT(*) FROM sys.sys_source_lineage_records
ORDER BY 1;"
# Expected: sys_skills 20048, sys_job_families 27, sys_skill_aliases 80, sys_source_lineage_records 17771
```

If ANY pre-flight fails: halt+escalate.

---

## §3 — BLOCK A — Engine.ts fixes (CW-B22/B23/B24)

**Order**: CW-B22 → CW-B23 → CW-B24 (per `cowork_reserved/batch_c2/engine_patches/00_README_ENGINE_PATCHES.md`).

**Strategy**: 3 atomic commits, no Wave retry tra commits A.1/A.2/A.3. Single Wave retry at end of Block A to validate combined effect.

### §3.1 CW-B22 — Replace IS NOT DISTINCT FROM with = (NOT NULL NK cols)

**Source spec**: `cowork_reserved/batch_c2/engine_patches/CW_B22_PATCH_SPEC.md`

**Read it now** for line refs + complete patch code.

**Critical detail**:
- `nkMatchPairs` array (upsert-sql.ts ~line 514-520) is single source of truth — replace once, propagates to steps 7+8+9
- For `_tenant_id` columns (potentially nullable), use `COALESCE(col, sentinel) = COALESCE(col, sentinel)` to match UQ index expression
- Verify sentinel UUID consistency cross-table

**Apply**: edit upsert-sql.ts per spec §3, run `pnpm typecheck` + `pnpm test` → expect 318+/324+ passed.

**Commit**: `feat(api): CW-B22 fix — replace IS NOT DISTINCT FROM with = on NOT NULL NK cols (index optimization)`

### §3.2 CW-B23 — ANALYZE step post-staging-load

**Source spec**: `cowork_reserved/batch_c2/engine_patches/CW_B23_PATCH_SPEC.md`

**Critical detail**:
- New export `analyzeWave1Staging(pool, stats)` in `engine.ts`
- Called from `service.ts` between `STAGE_COMPLETE` log (riga 88) and `STATE_VALIDATING` transition (riga 91)
- Cycle only on staging tables with `stagedRows > 0`
- Cost: 1-2s total (vs 17min stall avoided)
- New event log `STAGE_ANALYZE_COMPLETE` with `elapsed_ms` payload

**Apply**: edit engine.ts + service.ts per spec §3, run tests.

**Commit**: `feat(api): CW-B23 fix — ANALYZE staging tables post-load (planner statistics defense)`

### §3.3 CW-B24 — Lineage self-conflict fix (DISTINCT ON dedup)

**Source spec**: `cowork_reserved/batch_c2/engine_patches/CW_B24_PATCH_SPEC.md`

**Critical detail (most complex)**:
- 2 root causes identified (Cause A: compound-PK collapse, Cause C: WHERE skip varchar NK NULL)
- Fix: `DISTINCT ON (staging_source_record_id) ORDER BY confidence DESC, staging_row_id ASC` on CTE `joined`
- Optional Change 2: forensic audit `LINEAGE_DEDUP_COLLAPSED_V1` (new rule_code) for runtime Cause A vs C breakdown
- Out-of-scope (defer to future ADR): Compound-PK `staging_source_record_id` derivation in engine.ts:182-183, WHERE skip filter tightening per varchar NK NULL (→ candidate CW-B25)

**Apply**: edit upsert-sql.ts step 8 lineage write SQL per spec §3, edit audit-rule-codes.ts to add `LINEAGE_DEDUP_COLLAPSED_V1` if Optional Change 2 implemented.

**Commit**: `feat(api): CW-B24 fix — lineage write DISTINCT ON dedup (resolve ON CONFLICT self-conflict)`

### §3.4 Verify Block A

```bash
# Smoke test post-Block-A
cd D:\heuresys-advanced\apps\api
pnpm typecheck   # expected 0 errors
pnpm test        # expected ≥ baseline (318+/324+ passed)

# Optional: Run Wave 1 retry to validate engine fixes in action
# (Cowork raccomanda di SALTARE qui — Wave retry sarà in Block B post-cascade-fix per validation combined)
```

### §3.5 Push Block A commits

```bash
git push origin main
# Expected: 3 commits pushed (or batched if you squashed)
```

---

## §4 — BLOCK B — Cascade Class B fixes (4 targets)

**Source specs**: `cowork_reserved/batch_c2/cascade_fixes/*.sql` + `00_README_CASCADE_FIXES.md`

### §4.1 ⚠️ R-01 CRITICAL pre-flight verification (synthetic alias compatibility)

**Source**: README `00_README_CASCADE_FIXES.md` §4 Risk Register R-01

**Issue**: Cascade fixes use **synthetic alias source_columns** strategy (additive INSERT, A1 ABSOLUTE compliant). Per funzionare, lo staging code DEVE dereferenziare il `aliased_from` metadata field.

**MANDATORY VERIFICATION before applying**:

1. Read `apps/api/src/services/brownfield/extract/stage.ts` (or equivalent staging code)
2. Find dove lo staging code legge `source_column_name` per estrarre dal raw record
3. Verify whether it honors `column_mapping_metadata.aliased_from` if present:
   - If YES → R-01 mitigated, proceed with cascade fixes
   - If NO → R-01 BLOCKING. Two options:
     - **Option α**: extend staging code to dereference alias (additional CW-B22-style patch, ~2-3h authoring)
     - **Option β**: halt+escalate `exec_strategic_concern` — Cowork must redesign alias strategy

3. Document verification outcome in REPORT §1.B.1 with file:line citation.

### §4.2 Anomaly check (from Cowork batch C2.2 findings)

⚠️ File `02_sys_esco_occupation_mappings_fix.sql` has one INSERT DISABLED (`AND FALSE` guard).

**Re-verify before applying**: live brownfield.table_mappings shows 4 sources for sys_esco_occupation_mappings (diagnostic said 5). Verify whether `onet_esco_mappings` is/isn't registered.

```sql
SELECT st.source_table_name FROM brownfield.table_mappings tm
JOIN brownfield.source_tables st ON st.source_table_id=tm.table_mapping_source_table_id
WHERE tm.table_mapping_target_table='sys_esco_occupation_mappings';
-- Expected: 4 or 5 rows
```

If 4 → diagnostic stale, leave AND FALSE. If 5 → un-disable.

### §4.3 Sequenced execution

**PHASE A** (apply 01 → Wave 1 retry → verify sys_job_roles):

1. Apply `01_sys_job_roles_mapping_fix.sql` via psql:
   ```bash
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
     -f cowork_reserved/batch_c2/cascade_fixes/01_sys_job_roles_mapping_fix.sql
   ```
2. Run Wave 1 retry:
   ```bash
   cd D:\heuresys-advanced
   node scripts/run-wave1-fullscale.mjs > /tmp/wave_blockB_phaseA.json 2> /tmp/wave_blockB_phaseA.log
   ```
3. Verify sys_job_roles ≥ 140 (cascade unlock validated):
   ```sql
   SELECT COUNT(*) FROM sys.sys_job_roles;
   ```
   - If ≥ 140 → R-01 MITIGATED, proceed PHASE B
   - If < 50 → R-01 NOT MITIGATED, halt+escalate

**PHASE B** (apply 02/03/04 parallel-ish + Wave 1 retry):

1. Apply 03 + 04 (independent):
   ```bash
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
     -f cowork_reserved/batch_c2/cascade_fixes/03_sys_skill_categories_fix.sql
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
     -f cowork_reserved/batch_c2/cascade_fixes/04_sys_skill_taxonomy_edges_fix.sql
   ```
2. Apply 02 (after PHASE A validated job_roles populated):
   ```bash
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
     -f cowork_reserved/batch_c2/cascade_fixes/02_sys_esco_occupation_mappings_fix.sql
   ```
3. Wave 1 retry final (incorporates all 4 fixes):
   ```bash
   node scripts/run-wave1-fullscale.mjs > /tmp/wave_blockB_final.json 2> /tmp/wave_blockB_final.log
   ```

### §4.4 Verify Block B acceptance

```sql
SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_skill_categories', COUNT(*) FROM sys.sys_skill_categories
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
ORDER BY 1;
```

Realistic expected per Cowork's analysis:
- sys_job_roles ≥ 140 (60% of 231 staged)
- sys_esco_occupation_mappings ≥ 1500 (20-40% of 7645)
- sys_skill_categories ≥ 3000 (40-60% of 7256, depends on cluster_id coverage)
- sys_skill_taxonomy_edges ≥ 8000 (~50% of 17924, ESCO URIs deferred)

**Acceptance**: ≥3/4 targets newly populated. If <2/4 → halt+escalate, R-01 not mitigated OR deeper issue.

**Commit + push**:
```bash
git add db/seeds/brownfield/wave2/cascade_fixes/  # if you copied SQL specs to repo
git commit -m "feat(brownfield): batch X2 Block B — cascade Class B fixes (4 targets, synthetic alias strategy)"
git push origin main
```

---

## §5 — BLOCK C — SDBI Goals/OKRs pilot

**Source**: `cowork_reserved/batch_c1/goals_pilot/` (17 files, fully authored by Cowork C1.8)

**Read these FIRST**:
1. `cowork_reserved/batch_c1/goals_pilot/00_README_GOALS_PILOT.md` — workflow narrative + 8 HC items (all default approved by Enzo)
2. `cowork_reserved/batch_c1/goals_pilot/05_PHASE5_CONSOLIDATION_PLAN.md` — execution recipe
3. `cowork_reserved/batch_c1/goals_pilot/04_PHASE3_TEMP_SDBI_DDL.md` — temp_sdbi.* DDL

**Decisions**:
- All 8 HC items: ACCEPT default proposals (Enzo confirmed batch C1)
- Migrations: USE `000036_temp_sdbi_schema.sql` + `000037_sys_goals_okrs_scaffold.sql` (NOT 000034/35, those are duplicate file artifacts)

### §5.1 Pre-flight Block C

```bash
# Verify Block A + B successful (no halts)
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_skill_categories', COUNT(*) FROM sys.sys_skill_categories;"
# Expected: at least 1 of them ≥ 100

# Verify Goals/OKRs source data still in heuresys_platform
ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "SELECT COUNT(*) FROM goals;"'
# Expected: 1067
```

### §5.2 Apply migrations 000036 + 000037

```bash
cp cowork_reserved/batch_c1/goals_pilot/migrations/000036_temp_sdbi_schema.sql db/migrations/
cp cowork_reserved/batch_c1/goals_pilot/migrations/000037_sys_goals_okrs_scaffold.sql db/migrations/

cd D:\heuresys-advanced && pnpm db:migrate
# Expected: 2 new migrations applied (total 36 in sys_schema_migrations)
```

### §5.3 Extract Goals/OKRs source from heuresys_platform → legacy_mirror

Pattern: extend `extract-wave1-legacy.sh` (new lexicon domain GOKMER) OR use ad-hoc script (preferred for X2 — less invasive).

Source tables to extract:
- `goals` (1067), `goal_updates` (1811), `goal_check_ins` (1000), `goal_milestones` (1000), `goal_comments` (856), `goal_alignments` (100), `goal_templates` (40), `okrs` (20), `key_results` (20), `okr_checkins` (10), `okr_check_ins` (15)

Apply pattern same as Cowork batch C1.4 MIRROR GAP fix:
```bash
ssh oracle-vm-default 'sudo -u postgres pg_dump --data-only --no-owner --no-privileges \
  -t public.goals -t public.goal_updates -t public.goal_check_ins -t public.goal_milestones \
  -t public.goal_comments -t public.goal_alignments -t public.goal_templates \
  -t public.okrs -t public.key_results -t public.okr_checkins -t public.okr_check_ins \
  -d heuresys_platform' | \
  sed -e 's/COPY public\.goals/COPY legacy_mirror.goals/g' \
      -e 's/COPY public\.goal_updates/COPY legacy_mirror.goal_updates/g' \
      -e ... (same pattern for all 11) | \
  PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced

# Verify
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'goals', COUNT(*) FROM legacy_mirror.goals UNION ALL
SELECT 'okrs', COUNT(*) FROM legacy_mirror.okrs UNION ALL
SELECT 'key_results', COUNT(*) FROM legacy_mirror.key_results;"
# Expected: 1067, 20, 20
```

⚠️ legacy_mirror.<goals_table> tables may need CREATE TABLE first (extract-wave1-legacy.sh likely never included them). If COPY fails with "table doesn't exist", run schema-dump first:

```bash
ssh oracle-vm-default 'sudo -u postgres pg_dump --schema-only --no-owner --no-privileges \
  -t public.goals -t public.goal_updates -t public.goal_check_ins -t public.goal_milestones \
  -t public.goal_comments -t public.goal_alignments -t public.goal_templates \
  -t public.okrs -t public.key_results -t public.okr_checkins -t public.okr_check_ins \
  -d heuresys_platform' | \
  sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS legacy_mirror./g' | \
  sed 's/public\./legacy_mirror./g' | \
  PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced
```

### §5.4 temp_sdbi seeding

Per `cowork_reserved/batch_c1/goals_pilot/04_PHASE3_TEMP_SDBI_DDL.md`:

- 10 `temp_sdbi.<table>` mirror DDLs (no-FK, TRUNCATE-able)
- INSERT-SELECT from legacy_mirror per ogni mapping_card

Pattern per table:
```sql
TRUNCATE temp_sdbi.sys_goals;
INSERT INTO temp_sdbi.sys_goals (...)
SELECT <transformed columns>
FROM legacy_mirror.goals
WHERE ... ;  -- mapping per mapping_cards/goals_sys_goals.md
```

Repeat for tutte 10 mapping cards. Use mapping_cards files as source of truth for field-by-field SQL.

### §5.5 Phase 5 consolidation

Per `cowork_reserved/batch_c1/goals_pilot/05_PHASE5_CONSOLIDATION_PLAN.md`:

INSERT...SELECT da temp_sdbi → sys.* con audit + lineage. SDBI audit rule_codes:
- `SDBI_HUMAN_APPROVED` per ogni row (HC items all default-approved → high confidence path)
- `SDBI_CONSOLIDATION_COMPLETE_V1` final marker

### §5.6 Phase 6 cleanup

```sql
DROP TABLE IF EXISTS temp_sdbi.sys_goals;
DROP TABLE IF EXISTS temp_sdbi.sys_okrs;
-- ... etc per 10 tables
-- Schema temp_sdbi RIMANE per future SDBI pilots
```

### §5.7 Verify Block C acceptance

```sql
SELECT 'sys_goals', COUNT(*) FROM sys.sys_goals
UNION ALL SELECT 'sys_okrs', COUNT(*) FROM sys.sys_okrs
UNION ALL SELECT 'sys_okr_key_results', COUNT(*) FROM sys.sys_okr_key_results
UNION ALL SELECT 'sys_goal_milestones', COUNT(*) FROM sys.sys_goal_milestones
UNION ALL SELECT 'sys_goal_check_ins', COUNT(*) FROM sys.sys_goal_check_ins
UNION ALL SELECT 'sys_goal_updates', COUNT(*) FROM sys.sys_goal_updates
UNION ALL SELECT 'sys_goal_comments', COUNT(*) FROM sys.sys_goal_comments
UNION ALL SELECT 'sys_goal_alignments', COUNT(*) FROM sys.sys_goal_alignments
UNION ALL SELECT 'sys_goal_templates', COUNT(*) FROM sys.sys_goal_templates
UNION ALL SELECT 'sys_okr_check_ins', COUNT(*) FROM sys.sys_okr_check_ins
ORDER BY 1;
-- Expected total ~5939 rows matching source after consolidation
```

**Commit + push**:
```bash
git commit -am "feat(sys): SDBI Phase 2 pilot Goals/OKRs (ADR-0014) — 10 new sys.* tables populated"
git push origin main
```

---

## §6 — Cowork artifacts directory (drill-down on demand)

| File | When to consult |
|---|---|
| `cowork_reserved/00_README_KB.md` | KB master index |
| `cowork_reserved/batch_c2/engine_patches/CW_B22_PATCH_SPEC.md` | Block A.1 detail |
| `cowork_reserved/batch_c2/engine_patches/CW_B23_PATCH_SPEC.md` | Block A.2 detail |
| `cowork_reserved/batch_c2/engine_patches/CW_B24_PATCH_SPEC.md` | Block A.3 detail |
| `cowork_reserved/batch_c2/engine_patches/00_README_ENGINE_PATCHES.md` | Block A overview + integration order |
| `cowork_reserved/batch_c2/cascade_fixes/00_README_CASCADE_FIXES.md` | Block B overview + R-01 risk |
| `cowork_reserved/batch_c2/cascade_fixes/01-04_*.sql` | Block B SQL specs |
| `cowork_reserved/batch_c1/goals_pilot/00_README_GOALS_PILOT.md` | Block C overview |
| `cowork_reserved/batch_c1/goals_pilot/01_SOURCE_DISCOVERY.md` | Block C source detail |
| `cowork_reserved/batch_c1/goals_pilot/02_TARGET_SCHEMA_PROPOSAL.md` | Block C schema design |
| `cowork_reserved/batch_c1/goals_pilot/04_PHASE3_TEMP_SDBI_DDL.md` | Block C §5.4 DDLs |
| `cowork_reserved/batch_c1/goals_pilot/05_PHASE5_CONSOLIDATION_PLAN.md` | Block C §5.5 consolidation |
| `cowork_reserved/batch_c1/goals_pilot/mapping_cards/*.md` | Block C §5.4 SQL templates per table |
| `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` | SDBI architecture reference |

---

## §7 — Halt+escalate triggers

Emit `cowork_code_exchange/.inbox/cowork/pending/<TS>_005_halt_<reason>.md` if:

1. Pre-flight check fail (§2.X)
2. **Block A**: typecheck fail post-patch unresolvable >30min, OR test regression >5 new failures
3. **Block A**: ANY engine.ts patch causes Wave 1 retry FAIL (status != COMPLETED)
4. **Block B R-01 verified BLOCKING**: staging code doesn't dereference alias, no path forward
5. **Block B PHASE A**: sys_job_roles < 50 post-fix-A1+retry (R-01 unmitigated despite verification)
6. **Block B PHASE B**: ≥3 of 4 targets still 0 post-retry
7. **Block C**: legacy_mirror schema-dump for goals/okrs fails
8. **Block C**: migrations 000036/037 apply fail (schema design issue)
9. **Block C**: Phase 5 consolidation discovers data integrity issue
10. **Wave 1 retry wall-clock >120 min** (vs ~60 min expected post engine fixes)
11. **git push fails** (branch protection, conflicts)
12. **Disk space issue**

---

## §8 — Critical risks summary

| Risk | Block | Severity | Mitigation |
|---|---|---|---|
| R-01 staging code no alias deref | B | HIGH | §4.1 pre-flight verification + halt+escalate if fail |
| CW-B22 sentinel UUID cross-table inconsistency | A.1 | LOW | EXPLAIN ANALYZE post-patch + integration tests |
| CW-B24 Optional Change 2 over-scope | A.3 | LOW | Implement only if straightforward (else defer) |
| Block A engine refactor breaks existing Wave 1 baseline | A | MEDIUM | §3.4 verify tests + post-Block-B Wave 1 retry validates |
| Block C SDBI complexity (first pilot) | C | MEDIUM | Mapping cards step-by-step + temp_sdbi safety (TRUNCATE-and-retry) |
| Migrations 000034/35 (old) confused with 000036/37 (new) | C | LOW | §1.3 explicit warning + §5.2 use 000036/037 |

---

## §9 — Budget envelope

- Block A engine patches: 6-10h (3 patches × 2-3h each)
- Block B cascade fixes: 4-8h (R-01 verify + 4 SQL applies + 2 Wave retries + verify)
- Block C SDBI pilot: 4-7h (migrations + extract + temp_sdbi seed + consolidation + verify)
- REPORT writing: 60-90min
- **Total**: 14-25h max

Recommended split into 2-3 CLI sessions:
- Session X2.A: Block A only (6-10h)
- Session X2.B: Block B only (4-8h, after X2.A REPORT)
- Session X2.C: Block C only (4-7h, after X2.B REPORT)

OR single long session if you prefer.

---

## §10 — Halt+escalate triggers (already listed §7) + REPORT format

See §7 above for halt triggers.

REPORT format mandatory at end (or split per block).

---

## §11 — REPORT format

Write `cowork_code_exchange/_04_REPORT_005_batch_x2.md`:

```markdown
# REPORT 005 — CLI Batch X2

**Executed**: <start_TS> → <end_TS>
**Sessions used**: 1 or 2 or 3 (document split)

## §1 — Block A engine patches outcomes

### §1.A.1 CW-B22 patch
- Applied: yes/no
- typecheck: PASS/FAIL
- tests: N/M passed
- Commit SHA: <sha>

### §1.A.2 CW-B23 patch
- (same format)

### §1.A.3 CW-B24 patch
- (same format)
- Optional Change 2 implemented?: yes/no

## §2 — Block B cascade fixes outcomes

### §2.B.1 R-01 verification result
- File:line citation: ...
- Outcome: MITIGATED / OPTION-α-NEEDED / OPTION-β-HALT

### §2.B.2 Anomaly check (02 file AND FALSE)
- 4 or 5 sources?
- Action taken

### §2.B.3 PHASE A — sys_job_roles
- Pre/post count: 0 / N
- R-01 mitigation validated?

### §2.B.4 PHASE B — sys_esco/categories/taxonomy_edges
- 3 counts pre/post
- Wave 1 retry wall-clock

## §3 — Block C SDBI Goals/OKRs outcomes

### §3.C.1 Migrations 000036/037 apply
- Status, count
- sys.sys_goals/okrs/key_results/... schemas verified

### §3.C.2 Source extraction to legacy_mirror
- 10 tables row counts in legacy_mirror

### §3.C.3 temp_sdbi seeding
- 10 temp tables row counts

### §3.C.4 Phase 5 consolidation
- 10 sys.* table row counts post-consolidation

### §3.C.5 Phase 6 cleanup
- temp_sdbi.* dropped

## §4 — Sys.* hit ratio post-X2
- Pre-X2: ~41/118
- Post-X2: N/118 (+M new populated)

## §5 — Halts + Anomalies documented

## §5.5 — Cowork spec improvements suggested
- Spec deviations + rationale
- Better approaches identified
- Concrete proposals for batch C3

## §6 — Bias catalog candidates (CW-B25+)

## §7 — Next step recommendation for Cowork batch C3
- Goals/OKRs success → SDBI proven, scale to 11 macro-aree TRUE GAP remaining
- OR specific issues to address first

## §8 — Feedback sul modello operativo Cowork↔CLI
```

After REPORT written, emit inbox notify:
```bash
node scripts/cowork-exchange/notify.mjs cowork report_ready \
  --goal 005 --slug batch_x2 \
  --subject "Batch X2 completed (3 blocks)" \
  --ref cowork_code_exchange/_04_REPORT_005_batch_x2.md
```

---

## §12 — Closing

After REPORT written: STOP. Cowork batch C3 will review + plan next steps (likely Phase 3 SDBI scale to 11 macro-aree TRUE GAP, OR fix any P0 issue surfaced in X2).

Good luck. Read §1-§2 once more before §3 Block A. Block A → B → C sequential per design.

---

*End PROMPT 005 batch X2*
