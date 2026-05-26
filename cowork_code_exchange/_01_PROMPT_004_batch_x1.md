# PROMPT 004 — CLI Batch X1 (Opt3 Phase 1 BLOCK A — self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: BLOCK A only (Phase 1 closure: CW-B17 patch + 4 Class B fixes + Wave 1 retry + verify). Block B (SDBI pilot Goals/OKRs) sarà in batch X2 successivo post-review REPORT X1.
**Expected duration**: 4-8h CLI continuous session
**Authored**: 2026-05-20T18:35Z by Cowork
**Pre-conditions**: Batch C1 closed by Cowork (vedi §1.3 below)

---

## §0 — Identity + role + commitment

You are Claude Code CLI on Windows. You are the **executor** in Cowork↔CLI v2.2 protocol. Cowork (Claude Opus, autonomous overnight session 2026-05-20) has:
- Completed forensic audit (15 KB files in `cowork_reserved/`, ~5800 righe)
- Authored ADR-0014 (SDBI architecture)
- Executed pre-requisites (P-2 backup pg_dump, P-4 lock, P-5 inspection + heuresys_test DROP)
- Executed Class C MIRROR GAP fix LIVE (4 source tables restored in legacy_mirror)
- Authored CW-B17 patch spec + 12 Class B diagnostic files + Goals/OKRs SDBI pilot (deferred to X2)
- Locked decisions: Opt3 Hybrid pragmatic + all HC items default accepted + drop test

You execute Block A of this batch (see §5). Block B (SDBI pilot) deferred to X2 — do NOT execute it now.

**Commitments**:
- Read this PROMPT in full before any action
- Execute step-by-step in order
- Halt+escalate (write to `cowork_code_exchange/.inbox/cowork/pending/<TS>_004_halt_<reason>.md`) on triggers in §7
- Write REPORT to `cowork_code_exchange/_04_REPORT_004_batch_x1.md` at end (format §8)
- No git push without explicit step instruction

**Critical thinking INVITED — non sei un esecutore cieco**:

Cowork ha fatto un lavoro forense approfondito MA è fallibile. Tu hai capacità di valutazione critica + sei più vicino al codice reale durante esecuzione + puoi vedere dettagli che io ho mancato. **Sei attivamente incoraggiato a**:

1. **Segnalare lacune o errori nella mia spec**: se §5.1 patch code ha un bug, se §5.2 fix proposal non considera un edge case, se assumption Cowork è sbagliata — DIMMELO via inbox `exec_critique` (NON halt obbligatorio se puoi continuare, ma documenta in REPORT §2 + ad-hoc inbox notify se urgente)
2. **Proporre approcci migliori**: se durante esecuzione vedi che un approccio alternativo è chiaramente superiore (es. patch più pulito, ordering diverso, decomposizione step più safe) — proponilo in REPORT §2.5 (nuova sezione "Cowork spec improvements suggested"). Non implementare alternative senza segnalare PRIMA, ma SEGNALA always.
3. **Flaggare decisioni strategiche subottimali**: se l'intera direzione (es. CW-B17 patch design, sys_job_families bootstrap approach) ti sembra sbagliata in ways non anticipated, halt+escalate `exec_strategic_concern` e descrivi.
4. **Catalogare nuovi bias CW-B22+**: se durante esecuzione scopri pattern di failure non documentati in CW-B16-B21, aggiungili al REPORT §5.
5. **Documentare anomalie**: anche se non blockanti, segnala in REPORT §2 qualsiasi cosa "diversa dal previsto" — è feedback prezioso per Batch C2.

**Trust + critique balance**: Cowork's diagnostic work (12 Class B + CW-B17 spec + Goals/OKRs pilot) ha alto trust default. NON ri-investigare da zero ciò che ho già documentato. MA se vedi evidence concreta che contraddice una mia conclusione, SEGNALA con evidence — non assumere io abbia sempre ragione.

**Mode operativo ottimale**: 
- High-confidence Cowork specs (§3 pre-flight checks, §5.1 patch code structure) → esegui as-is, segnala anomalie
- Medium-confidence Cowork proposals (§5.2 Class B fix tactics) → valuta criticamente, proponi alternatives se necessario
- High-judgment moments (es. brownfield registry authoring §5.2.A, type extensions in upsert-sql.ts) → tuo critical thinking attivo, halt+escalate se ambiguità materiali

---

## §1 — Executive briefing (everything you need to know in 5 minutes read)

### §1.1 Project context

`heuresys_advanced` is a greenfield rewrite of legacy `heuresys-evo`. Brownfield import pipeline migrates ~700k rows from `heuresys_platform.public` (582 tables) to `heuresys_advanced.sys.*` (118 tables) via:
- `legacy_mirror.*` schema (subset mirror of platform, populated by `extract-wave1-legacy.sh`)
- `staging.wave1_*` jsonb-buffer tables (migration 000030)
- `brownfield.column_mappings` (1177 rows authored, 14 transform codes)
- `transform-compiler.ts` + `upsert-sql.ts` (mechanical SQL emit)
- `audit.import_validation_results` (207k validation rows)
- `sys.sys_source_lineage_records` (4099 lineage rows)

### §1.2 Current state of sys.*

| Metric | Value |
|---|---|
| Total sys.* tables | 118 + 11 views |
| Populated (≥1 row) | 38 (32%) |
| Empty (silent skip or no work) | 80 |
| Last Wave 1 retry | runId `08d3bc9f-e16d-418d-8414-17873ef170aa` (2026-05-19 18:52, wall-clock 48 min, 16733 upserted) |
| Latest commit on main | depends on your git state — check with `git log --oneline -5` |

### §1.3 What Cowork batch C1 already executed (LIVE, no CLI work needed)

✅ **Backup**: `/home/ubuntu/backups/heuresys_advanced_pre_batchC1_20260520_1624Z.dump` (257 MB) on VM
✅ **Class C MIRROR GAP fix**: 4 source tables now in legacy_mirror:
- `legacy_mirror.esco_skills` 14011 rows
- `legacy_mirror.business_processes` 26 rows
- `legacy_mirror.industry_ccnl_mapping` 14 rows
- `legacy_mirror.tenant_industry_classifications` 4 rows (already had 4, unchanged)

✅ **heuresys_test database DROPPED** (was stale snapshot 2026-05-07, 791 MB freed, backup safety net `/home/ubuntu/backups/heuresys_test_pre_drop_20260520.dump` 379 MB)

✅ **Authored deliverables in cowork_reserved/batch_c1/** (33 files):
- `CW_B17_PATCH_SPEC.md` (code spec for upsert-sql.ts modification)
- `class_b_diagnostics/00_SUMMARY.md` (12 silent-skip targets ranked)
- `class_b_diagnostics/sys_*.md` (12 individual diagnostics)
- `goals_pilot/*` (deferred to Batch X2)
- `P5_heuresys_test_decision.md` + `C1_4_MIRROR_GAP_fix_report.md`

### §1.4 Decisions locked by Enzo (no further confirmation needed)

- Opt3 Hybrid strategy approved (vedi `cowork_reserved/11_STRATEGIC_REFORMULATION.md`)
- All 8 HC items: ACCEPTED with default proposals
- heuresys_test: DROPPED (already done)
- Migration numbering 000034/000035: NO conflict (last applied 000033)

### §1.5 What you (CLI) must NOT do

❌ Do not execute Block B (SDBI pilot Goals/OKRs) — that's batch X2 future
❌ Do not modify `apps/api/src/modules/brownfield-wave-executor/engine.ts` — out of scope for X1 (engine.ts lineage deep-investigation is a future task)
❌ Do not push to origin/main until explicit instruction at end of Block A
❌ Do not re-investigate "why Class B targets are silent-skipped" — Cowork already did, applied fixes are documented in §5.2
❌ Do not run `extract-wave1-legacy.sh` from scratch — Cowork already extended legacy_mirror with 4 new tables. You may extend the script for `job_families` (one of the 4 fixes), but that's narrow + specific.

---

## §2 — Repository + DB current state snapshot

### §2.1 Repo state

```bash
# Verify before starting:
cd D:\heuresys-advanced
git status -sb
# Expected: main, ahead of origin/main by N commits (could be 0 if previous CLI session pushed)

git log --oneline -5
# Expected: recent commits on Goal 003 + handoff S923/924 + brand/showcase work
```

### §2.2 DB state (heuresys_advanced on oracle-vm-default)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_skills', COUNT(*) FROM sys.sys_skills
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules
UNION ALL SELECT 'sys_learning_paths', COUNT(*) FROM sys.sys_learning_paths
UNION ALL SELECT 'sys_activity_classifications', COUNT(*) FROM sys.sys_activity_classifications
UNION ALL SELECT 'sys_skill_families', COUNT(*) FROM sys.sys_skill_families
UNION ALL SELECT 'sys_compensation_bands', COUNT(*) FROM sys.sys_compensation_bands
UNION ALL SELECT 'sys_blueprint_process_registry', COUNT(*) FROM sys.sys_blueprint_process_registry
ORDER BY 1;"
# Expected: sys_skills 6037, sys_learning_modules 4488, sys_learning_paths 3227,
#           sys_activity_classifications 3276, sys_skill_families 77,
#           sys_compensation_bands 75, sys_blueprint_process_registry 23
```

---

## §3 — Pre-flight checks (mandatory before §5)

Execute in order. Halt+escalate if ANY fails.

```bash
# 3.1 SSH tunnel up
ssh -fN -L 5433:localhost:5432 oracle-vm-default 2>/dev/null
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT 1;"
# Expected: 1

# 3.2 Backup exists (Cowork created it at C1.1)
ssh oracle-vm-default 'ls -lh /home/ubuntu/backups/heuresys_advanced_pre_batchC1_20260520_1624Z.dump'
# Expected: ~257 MB file

# 3.3 MIRROR GAP fix LIVE (Cowork executed at C1.4)
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'esco_skills', COUNT(*) FROM legacy_mirror.esco_skills
UNION ALL SELECT 'business_processes', COUNT(*) FROM legacy_mirror.business_processes
UNION ALL SELECT 'industry_ccnl_mapping', COUNT(*) FROM legacy_mirror.industry_ccnl_mapping
ORDER BY 1;"
# Expected: business_processes 26, esco_skills 14011, industry_ccnl_mapping 14

# 3.4 Baseline tests
cd D:\heuresys-advanced\apps\api
pnpm test
# Expected: 318/318 passed (give or take — pre-X1 baseline)
pnpm typecheck
# Expected: 0 errors

# 3.5 Working tree state
cd D:\heuresys-advanced
git status -sb
# Note any M / ?? files. If 5 files in apps/api/src/modules/brownfield-wave-executor/ are M with
# >800 LOC deleted (working tree CORRUPTION reported in F7 audit), execute:
#   git checkout HEAD -- apps/api/src/modules/brownfield-wave-executor/{engine,service,transform-compiler,upsert-sql}.ts apps/api/test/transform-compiler.test.ts
# But: CLI in previous sessions has already restored — verify with line counts:
wc -l apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts
# Expected: ~640 lines (committed HEAD state)
wc -l apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts
# Expected: ~487 lines
```

If all pre-flight passes, proceed to §5. Otherwise halt+escalate.

---

## §4 — Decisions context (already locked, just acknowledge)

| Decision | Status | Reference |
|---|---|---|
| Opt3 Hybrid strategy | ✅ ACCEPTED | `cowork_reserved/11_STRATEGIC_REFORMULATION.md` |
| 8 HC items pilot Goals/OKRs | ✅ ALL DEFAULT ACCEPTED | (relevant only for X2, ignore for X1) |
| Drop heuresys_test | ✅ EXECUTED 2026-05-20T18:30Z | done |
| MIRROR GAP fix (4 tables) | ✅ EXECUTED 2026-05-20T16:30Z | `cowork_reserved/batch_c1/C1_4_MIRROR_GAP_fix_report.md` |
| CW-B17 patch design | ✅ AUTHORED | `cowork_reserved/batch_c1/cw_b17_patches/CW_B17_PATCH_SPEC.md` |
| Class B fix priorities (4 top of 12) | ✅ RANKED | `cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md` |

---

## §5 — BLOCK A execution (your work this batch)

### §5.1 CW-B17 patch — add silent skip audit emission (~1.5-2h)

**Why**: Latest Wave 1 retry had 24552/41285 rows (59%) silent-skipped without audit trace. Forensic blind spot. Fix emits audit row per row excluded by WHERE skip filter.

**Step 5.1.A — Create new file `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts`**:

```typescript
/**
 * Audit rule codes emitted by brownfield wave executor.
 *
 * Convention: <CATEGORY>_<TOPIC>_V<N>
 */
export const AUDIT_RULE_CODES = {
  // Pre-existing (Goal 002+003)
  WAVE1_ALL_RULES: "WAVE1_ALL_RULES",
  LEGACY_NULL_LINEAGE_DOCUMENTED_V1: "LEGACY_NULL_LINEAGE_DOCUMENTED_V1",
  HANDLED_VIA_LINEAGE_WRITE_V1: "HANDLED_VIA_LINEAGE_WRITE_V1",

  // CW-B17 fix (Opt3 Phase 1 — this patch)
  /**
   * Emitted for every staging row excluded by WHERE skip filter due to:
   * - NK uuid column NULL or invalid format
   * - Required uuid column NULL
   *
   * payload: { target_col: string, exclusion_reason: string,
   *            target_table: string, table_mapping_id: uuid,
   *            staging_row_id: uuid }
   */
  WHERE_SKIP_FILTER_EXCLUDED_V1: "WHERE_SKIP_FILTER_EXCLUDED_V1",
} as const;

export type AuditRuleCode = (typeof AUDIT_RULE_CODES)[keyof typeof AUDIT_RULE_CODES];
```

**Step 5.1.B — Edit `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`**:

Position: after the `baseWhere = [...]` declaration (~line 418-424), BEFORE the `conflictInference` check (~line 427). Insert the following code block:

```typescript
// CW-B17 patch — emit audit for WHERE-skipped rows BEFORE main INSERT.
// Identifies staging rows that satisfy validation_status='PASSED' but FAIL skipFilters.
// Closes the silent-skip forensic blind spot (Goal 003 W1 retry: 24552/41285 = 59% lost).
if (mode === "EXECUTE" && skipFilters.length > 0) {
  // Identify exclusion reason per row: NK uuid issue OR required uuid NULL.
  const skipReasonCases: string[] = [];
  for (const nkCol of targetMeta.naturalKeyColumns) {
    const colType = targetMeta.columnTypes.get(nkCol);
    if (colType !== "uuid") continue;
    if (nkCol.endsWith("_tenant_id")) continue;
    const entry = colEntries.find((e) => e.targetCol === nkCol);
    if (!entry) {
      skipReasonCases.push(`WHEN TRUE THEN ${format("%L", "nk_missing_" + nkCol)}`);
      continue;
    }
    skipReasonCases.push(
      `WHEN (${entry.sql}) IS NULL THEN ${format("%L", "nk_null_" + nkCol)}`,
      `WHEN NOT ((${entry.sql})::text ~* ${UUID_REGEX_PG}) THEN ${format("%L", "nk_invalid_uuid_" + nkCol)}`,
    );
  }
  for (const reqCol of targetMeta.requiredColumns) {
    const colType = targetMeta.columnTypes.get(reqCol);
    if (colType !== "uuid") continue;
    if (
      reqCol === targetMeta.pkColumn ||
      reqCol === tenantCol ||
      reqCol === globalCol ||
      reqCol === metaCol ||
      reqCol === nameCol
    ) continue;
    if (targetMeta.naturalKeyColumns.includes(reqCol)) continue;
    const entry = colEntries.find((e) => e.targetCol === reqCol);
    if (!entry) {
      skipReasonCases.push(`WHEN TRUE THEN ${format("%L", "required_missing_" + reqCol)}`);
      continue;
    }
    skipReasonCases.push(
      `WHEN (${entry.sql}) IS NULL THEN ${format("%L", "required_null_" + reqCol)}`
    );
  }

  if (skipReasonCases.length > 0) {
    const auditSkipSql = `
      INSERT INTO audit.import_validation_results (
        import_validation_result_run_id,
        import_validation_result_source_table_id,
        import_validation_result_source_record_id,
        import_validation_result_rule_code,
        import_validation_result_status,
        import_validation_result_message,
        import_validation_result_payload
      )
      SELECT
        $1::uuid,
        $3::uuid,
        staging_source_record_id,
        'WHERE_SKIP_FILTER_EXCLUDED_V1',
        'SKIPPED',
        'Staging row validation_status=PASSED but excluded by WHERE skip filter (NK uuid NULL/invalid or required uuid NULL)',
        jsonb_build_object(
          'target_table', $4::text,
          'table_mapping_id', $5::uuid,
          'exclusion_reason', CASE ${skipReasonCases.join(" ")} ELSE 'unknown' END,
          'staging_row_id', staging_row_id
        )
      FROM ${qStagingTable}
      WHERE staging_import_run_id = $1
        AND staging_source_table = $2
        AND staging_validation_status = 'PASSED'
        AND staging_target_record_id IS NULL
        AND NOT (${skipFilters.join(" AND ")})
    `;
    try {
      await pool.query(auditSkipSql, [
        runId,
        mapping.source_table_name,
        mapping.source_table_id,
        mapping.target_table,
        mapping.table_mapping_id,
      ]);
    } catch (e) {
      console.error(
        `[sql-side-upsert] CW-B17 audit emission failed for mapping ${mapping.table_mapping_id}: ${(e as Error).message}`,
      );
      // Continue — audit emission failure should NOT block import
    }
  }
}
```

**Note**: `mapping.source_table_id` should be available on the `mapping` object passed in. If not currently exposed, check the type definition + repository.ts. If you need to extend the `MappingRow` type to include `source_table_id`, do so (it's a small addition — should be uuid pulled from brownfield.source_tables via JOIN in repository.ts query). If too invasive, halt+escalate.

**Step 5.1.C — Run typecheck + tests**:

```bash
cd D:\heuresys-advanced\apps\api
pnpm typecheck
# Expected: 0 errors

pnpm test
# Expected: 318+/318+ passed (existing tests unchanged; new patch is additive)
```

If typecheck fails: halt+escalate with error message.
If tests fail: debug 1-2h max. If unresolvable: halt+escalate.

**Step 5.1.D — Optional: add unit tests** (lower priority — only if time permits within Block A budget). Skip if you're already at 3-4h in Block A. Document as deferred to X2.

**Step 5.1.E — Commit**:

```bash
git add apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts \
        apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts
git commit -m "feat(api): CW-B17 silent skip audit emission (WHERE_SKIP_FILTER_EXCLUDED_V1)

Adds audit row per staging row excluded by WHERE skip filter (NK uuid NULL/invalid
or required uuid NULL). Closes forensic blind spot from Goal 003 W1 retry (24552/41285
silent-skipped rows).

Refs: cowork_reserved/batch_c1/cw_b17_patches/CW_B17_PATCH_SPEC.md
ADR: 0014 §3.5 (SDBI + brownfield audit family)"
```

**Do NOT push yet**. Push at end of Block A after all steps.

---

### §5.2 Apply 4 Class B fixes (quickest wins per ranking)

Per Cowork ranking (`cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md` §4), the 4 quickest-win Class B fixes are:

#### §5.2.A Fix 1 — `sys_job_families` bootstrap (CASCADE ROOT, 3-5h)

**Why**: `sys_job_families` is empty + has NO mappings in registry. It's the cascade root that blocks sys_job_roles + sys_esco_occupation_mappings + sys_position_skill_requirements (8000+ rows downstream).

**Diagnostic file**: `cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md`

**Action**:

1. Extract `job_families` from platform → legacy_mirror (COPY format, like Cowork did for the 4 MIRROR GAP):
   ```bash
   ssh oracle-vm-default 'sudo -u postgres pg_dump --data-only --no-owner --no-privileges -t public.job_families -d heuresys_platform' > /tmp/job_families_dump.sql

   # Inspect and modify schema reference (public → legacy_mirror)
   sed -i 's/public\.job_families/legacy_mirror.job_families/g' /tmp/job_families_dump.sql

   # First create the empty table in legacy_mirror with same schema as platform
   ssh oracle-vm-default 'sudo -u postgres pg_dump --schema-only --no-owner --no-privileges -t public.job_families -d heuresys_platform' | \
     sed 's/CREATE TABLE public\.job_families/CREATE TABLE IF NOT EXISTS legacy_mirror.job_families/g' | \
     sed 's/public\.job_families/legacy_mirror.job_families/g' | \
     PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced

   # Then COPY data
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f /tmp/job_families_dump.sql

   # Verify
   PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT COUNT(*) FROM legacy_mirror.job_families"
   # Expected: 27 rows
   ```

2. Extend `db/scripts/extract-wave1-legacy.sh` — add `job_families` to OPOURSKA list (lines 106-108 in current script):
   ```bash
   OPOURSKA=(job_template_skills job_templates job_families)
   ```

3. Author `brownfield.source_tables` + `brownfield.source_columns` + `brownfield.table_mappings` + `brownfield.column_mappings` for `job_families`:

   Pattern: take existing `job_templates` mapping as template (similar source structure), adapt. Likely ~7-10 column_mappings (id → JSON_EXTRACT to metadata.legacy_id, code → job_family_code DIRECT_COPY, name → job_family_name, etc.).

   Reference the diagnostic file `cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md` §3 for the 6-step authoring procedure.

   If you find the brownfield registry INSERT statements too risky to author by hand: halt+escalate. Cowork can generate them via mapping_card workflow in batch C2.

4. Add to migration 000030 staging whitelist (or create migration 000034 `add_wave1_job_families_staging.sql`). Verify pattern in existing 000030.

5. Verify staging table created: `\dt staging.wave1_job_families` exists.

**Acceptance**: sys.sys_job_families count ≥ 27 post-Wave-1-retry.

**Skip-fallback**: if authoring brownfield registry rows is too complex, skip this fix and document as "deferred to batch C2 SDBI workflow" in REPORT. The cascade downstream targets (sys_job_roles + sys_esco_occupation_mappings) will then remain empty in X1 — acceptable.

#### §5.2.B Fix 2 — `skill_adjacencies` 5th MIRROR GAP (1h)

**Why**: Cowork's audit identified `legacy_mirror.skill_adjacencies` has 0 rows vs 11634 in platform — missed by initial C1.4. Blocks sys_skill_taxonomy_edges authoring.

**Action**: Replicate C1.4 pattern for 1 table:

```bash
ssh oracle-vm-default 'sudo -u postgres pg_dump --data-only --no-owner --no-privileges -t public.skill_adjacencies -d heuresys_platform' | \
  sed 's/COPY public\.skill_adjacencies/COPY legacy_mirror.skill_adjacencies/g' | \
  PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced

PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT COUNT(*) FROM legacy_mirror.skill_adjacencies;"
# Expected: 11634
```

If the table doesn't exist in legacy_mirror schema yet (extract-wave1-legacy.sh originally created schema-only), pg_dump schema first like §5.2.A step 1.

#### §5.2.C Fix 3 — `sys_skill_aliases` (1-2h)

**Why**: 130 staged rows, target empty. Quickest target win.

**Diagnostic file**: `cowork_reserved/batch_c1/class_b_diagnostics/sys_skill_aliases.md`

**Action**: According to diagnostic, this depends on `esco_skills` upsert into `sys_skills` (now possible after MIRROR GAP fix + Wave 1 retry). The fix may be **no-op-code** if a fresh Wave 1 retry post-MIRROR-GAP-fix populates it automatically.

**Strategy**: skip this as an explicit fix step. Let Wave 1 retry (§5.3) populate it via cascade effect of the MIRROR GAP fix.

**Acceptance**: sys.sys_skill_aliases count > 0 post-Wave-1-retry (target ~130).

#### §5.2.D Fix 4 — Decision point: defer or attempt others

`sys_learning_path_steps` (rank 9, 3-5h effort) requires deeper authoring. Recommendation: **defer to Batch C2 SDBI workflow** (the Cowork-authored Goals/OKRs pilot has a similar pattern that can be reused for learning_path_steps in X2+).

**Other Class B targets** (sys_skill_categories, sys_skill_taxonomy_edges, sys_skill_learning_mappings, etc.): all defer to X2.

---

### §5.3 Wave 1 retry

After §5.1 + §5.2 complete (or as-far-as-possible), run Wave 1 fullscale retry:

```bash
cd D:\heuresys-advanced
node scripts/run-wave1-fullscale.mjs > /tmp/wave1_X1_post_blockA.json 2> /tmp/wave1_X1_post_blockA.log
```

Expected:
- COMPLETED status
- Wall-clock ≤ 60 min (post-MIRROR-GAP-fix likely longer than pre-fix due to new data, but should not exceed soft limit)
- Upserted significantly > 16733 (baseline pre-X1)
- New audit rows with `rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'` (CW-B17 emission verification)

**If wall-clock > 90 min**: halt+escalate (suggests new bottleneck — possibly esco_skills 14011 rows new upsert path triggering issue).

**If status != COMPLETED**: halt+escalate with full error log.

---

### §5.4 Verify Block A acceptance

```sql
-- 1. CW-B17 audit emission (was 0 pre-fix, expected non-zero post-fix)
SELECT
  import_validation_result_rule_code,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_run_id = '<latest_X1_run_id>'
GROUP BY 1 ORDER BY 2 DESC;
-- Expected: WAVE1_ALL_RULES PASSED + WHERE_SKIP_FILTER_EXCLUDED_V1 SKIPPED (non-zero)

-- 2. Distribution by exclusion_reason (CW-B17 detail)
SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_run_id = '<latest_X1_run_id>'
  AND import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1'
GROUP BY 1 ORDER BY 2 DESC;
-- Expected: variety of reasons (nk_null_*, nk_invalid_uuid_*, required_null_*) reflecting silent skip causes

-- 3. Class B target progress (those we attempted to fix)
SELECT 'sys_job_families', COUNT(*) FROM sys.sys_job_families
UNION ALL SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_skill_aliases', COUNT(*) FROM sys.sys_skill_aliases
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
ORDER BY 1;
-- Expected: at least sys_job_families ≥ 27 (if §5.2.A succeeded)
--           sys_skill_aliases > 0 (if Wave 1 retry picked it up)
--           sys_job_roles + sys_esco_occupation_mappings: bonus if cascade unlocked

-- 4. Total sys.* hit ratio
SELECT COUNT(*) FROM (
  SELECT c.relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='sys' AND c.relkind='r' AND c.reltuples>0
) t;
-- Pre-X1: 38. Expected post-X1: 40-45 (depending on which fixes landed)
```

---

### §5.5 Final commit + push (end of Block A)

```bash
cd D:\heuresys-advanced
git status -sb
# Verify only relevant changes (no accidental files)

# If §5.2.A authored brownfield registry rows via SQL applied directly to DB,
# document the SQL in db/seeds/brownfield/wave1/05_job_families_registry.sql (idempotent)
# and commit that file too.

git add db/scripts/extract-wave1-legacy.sh  # if extended for job_families
git add db/seeds/brownfield/wave1/  # if any new seed files
git add db/migrations/  # if any new migration

git commit -m "feat(brownfield): batch X1 — Class B fix wave 1 (CW-B17 audit + job_families bootstrap + skill_adjacencies mirror gap)

- CW-B17: WHERE_SKIP_FILTER_EXCLUDED_V1 audit class (closes silent-skip blind spot)
- MIRROR GAP fix: legacy_mirror.skill_adjacencies populated (11634 rows, was 0)
- sys_job_families bootstrap: 27 rows via new extract + registry authoring (unblocks downstream cascade)
- Wave 1 retry: post-fix run runId <runId>, wall-clock <Xs>, upserted <N>

Refs:
- cowork_reserved/batch_c1/cw_b17_patches/CW_B17_PATCH_SPEC.md
- cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md
- cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md"

git push origin main
```

**If push fails**: halt+escalate. Could be branch protection, conflict with remote, etc.

---

## §6 — Cowork artifacts directory (drill-down on demand)

If during execution you need specific detail beyond this PROMPT, drill down:

| File | Purpose |
|---|---|
| `cowork_reserved/00_README_KB.md` | Full KB index |
| `cowork_reserved/11_STRATEGIC_REFORMULATION.md` | Why Opt3 + 3-options comparison |
| `cowork_reserved/02a_ADV_SYS.md` | All 118 sys.* tables with row counts |
| `cowork_reserved/06_BROWNFIELD_REGISTRY_DEEP_DIVE.md` | 1177 column_mappings + 14 transform codes detail |
| `cowork_reserved/07_TRANSFORM_COMPILER_ANALYSIS.md` | Code audit of brownfield-wave-executor |
| `cowork_reserved/08_AUDIT_TRAIL_ANALYSIS.md` | 207k audit rows pattern analysis |
| `cowork_reserved/batch_c1/cw_b17_patches/CW_B17_PATCH_SPEC.md` | Full CW-B17 spec (this PROMPT §5.1 has the essential inline) |
| `cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md` | 12 Class B ranking |
| `cowork_reserved/batch_c1/class_b_diagnostics/sys_<target>.md` | Individual diagnostic per target |
| `cowork_reserved/batch_c1/C1_4_MIRROR_GAP_fix_report.md` | What Cowork already executed |
| `cowork_reserved/batch_c1/P5_heuresys_test_decision.md` | heuresys_test drop decision |
| `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` | SDBI architecture (Batch X2+ context) |

Do NOT load all of these — load only when ambiguity or unclear.

---

## §7 — Halt+escalate triggers (only allowed pause primitive)

Write to `cowork_code_exchange/.inbox/cowork/pending/<TS>_004_halt_<reason>.md` if:

1. **Pre-flight check fail** (§3.X)
2. **CW-B17 patch breaks > 5 existing tests** — debug max 1h, if unresolvable halt
3. **typecheck error post-patch** that you cannot resolve in 30 min
4. **brownfield.column_mappings authoring for job_families too risky** (e.g., unclear FK target choice) — preferable defer to Cowork batch C2
5. **Wave 1 retry wall-clock > 90 min** (vs ~60 min expected)
6. **Wave 1 retry status != COMPLETED**
7. **git push fails** (branch protection, conflicts)
8. **Any DDL/migration fails to apply** (suggests schema design issue)
9. **Disk space issue** (DB or local)
10. **Anything outside clear scope of §5**

Halt notify format (markdown):
```markdown
---
from: cli
to: cowork
goal_id: 004
slug: batch_x1
kind: exec_halt
ref_files:
  - cowork_code_exchange/_01_PROMPT_004_batch_x1.md
created_at: <TS>
expected_response_kind: exec_directive
---

# HALT — <short reason>

## §1 — Halt point
Step <§5.X.Y> at <TS>.

## §2 — Evidence
- Command run: ...
- Output: ...
- Error: ...

## §3 — What I tried
1. ...
2. ...

## §4 — Proposed options
- A: ...
- B: ...
- C: defer to Batch C2 / X2

## §5 — What I can do meanwhile
- Continue with §5.X.Z if independent
- OR full halt awaiting Cowork directive
```

---

## §8 — REPORT format (mandatory at end of Block A)

Write `cowork_code_exchange/_04_REPORT_004_batch_x1.md`:

```markdown
# REPORT 004 — CLI Batch X1 Block A

**Executed**: <start_TS> → <end_TS> (wall-clock <Xh Xm>)
**By**: Claude Code CLI on Windows
**Pre-conditions**: All pre-flight checks passed (§1-§4)

## §1 — Step-by-step outcomes

### §1.1 CW-B17 patch (§5.1)
- audit-rule-codes.ts created: yes/no
- upsert-sql.ts patched: yes/no (line range modified: X-Y)
- typecheck: PASS / FAIL (details)
- tests: N/M passed (details if any new failures)
- commit SHA: <sha>

### §1.2 Class B fixes (§5.2)
- §5.2.A sys_job_families bootstrap: COMPLETED / DEFERRED / PARTIAL (details)
  - legacy_mirror.job_families count: N
  - brownfield.source_tables/columns/table_mappings/column_mappings rows added: N
  - staging.wave1_job_families created: yes/no
- §5.2.B skill_adjacencies MIRROR GAP: COMPLETED / DEFERRED
  - legacy_mirror.skill_adjacencies count: 11634 expected, actual: N
- §5.2.C sys_skill_aliases via cascade: tested via Wave 1 retry (see §1.3)

### §1.3 Wave 1 retry (§5.3)
- runId: <uuid>
- wall-clock: <Xs>
- status: COMPLETED / FAILED / OTHER
- staged: <N>
- upserted: <N>
- lineage rows: <N>

### §1.4 Acceptance verifications (§5.4)
- CW-B17 audit rows emitted (non-zero): yes/no, count = N
- Exclusion reasons distribution: <top 3>
- Class B target progress:
  - sys_job_families: N (expected ≥ 27)
  - sys_skill_aliases: N
  - sys_job_roles: N (bonus if cascade)
  - sys_esco_occupation_mappings: N
  - Other: list any populated
- sys.* hit ratio post-X1: N/118 (was 38)

### §1.5 Final commit + push
- Files changed: list
- Commit SHA: <sha>
- Push status: SUCCESS / FAIL

## §2 — Halts encountered (if any) + Anomalies documented
- list each halt with timestamp + reason + resolution
- Anomalies non-blockanti incontrate (cose "diverse dal previsto" anche se sei riuscito a procedere)

## §2.5 — Cowork spec improvements suggested (critical thinking output)
- Lacune o errori trovati nella spec PROMPT 004
- Approcci alternativi che ti sembrano superiori (con reasoning)
- Concrete proposals per Batch C2 author migliore

## §3 — Deferred to Batch X2
- list any §5.X items skipped + rationale

## §4 — Next step recommendation for Cowork batch C2
- e.g. "engine.ts lineage write deep-investigation needed before Class B targets sys_skill_categories/skill_taxonomy_edges/etc."
- e.g. "Goals/OKRs pilot ready for X2 (Cowork-authored migrations 000034/000035 + mapping cards)"
- e.g. "sys_position_skill_requirements requires staging whitelist add + position semantics decision — needs Cowork architecture input"

## §5 — Bias catalog candidates (if any new ones surfaced during execution)
- e.g. CW-B22 — <description>

## §6 — Feedback sul modello operativo Cowork↔CLI
- Le instruzioni del PROMPT erano sufficienti? Troppo? Insufficienti?
- Quali parti hanno funzionato bene? Quali rifare diversamente?
- Critical thinking moments che hai esercitato — utili o controproducenti?
```

After REPORT written, emit inbox notify:
```bash
node scripts/cowork-exchange/notify.mjs cowork exec_completed \
  --goal 004 --slug batch_x1 \
  --subject "Batch X1 Block A completed" \
  --ref cowork_code_exchange/_04_REPORT_004_batch_x1.md
```

---

## §9 — Budget + timing

- §5.1 CW-B17 patch: 1.5-2h
- §5.2.A sys_job_families bootstrap: 3-5h
- §5.2.B skill_adjacencies MIRROR GAP: 1h
- §5.2.C sys_skill_aliases: 0h (passive via Wave 1 retry)
- §5.3 Wave 1 retry: 50-90 min
- §5.4 Verify: 30 min
- §5.5 Commit + push: 15 min
- REPORT writing: 30-60 min
- **Total Block A**: 7-11h max

If you reach 8h with §5.2.A not yet complete, halt+escalate — better halt than rush authoring brownfield registry rows.

---

## §10 — Closing instructions

After REPORT written + inbox notify emitted: STOP. Do not start Block B (SDBI pilot Goals/OKRs). Cowork batch C2 will review REPORT X1 and prepare PROMPT 005 for batch X2.

Good luck. Read §1.1-§1.5 once more before starting §3 pre-flight.

---

*End PROMPT 004 batch X1*
