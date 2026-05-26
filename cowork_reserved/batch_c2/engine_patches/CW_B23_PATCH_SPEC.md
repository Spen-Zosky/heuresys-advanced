# CW-B23 Patch Spec — ANALYZE staging tables post-populate

**Author**: Cowork (deep-investigation C2.1)
**Date**: 2026-05-21
**Confidence**: HIGH
**Status**: AUTHORED — pending CLI X2 apply + test

---

## §1 — Problem statement

### Evidence from REPORT X1

- CLI observed during Wave 1 retry: PG planner makes poor join/scan choices when `pg_class.reltuples` is far from reality.
- The pipeline mass-INSERTs 10k-20k rows into `staging.wave1_<target>` tables (step `executeStage`) without running ANALYZE → `reltuples` stays at the pre-INSERT estimate (often 0 or stale from a prior run after TRUNCATE).
- Downstream, `executeValidate`, `executeApprove`, and `executeUpsert` (executing complex SQL with JOINs against the staging table) all consume bad cardinality estimates → can pick nested-loop plans when hash-join would be 100x faster, or pick seq scan when index scan would be 10x faster.
- Concrete observed manifestation in REPORT X1: 17-min stall on `wave1_activity_classifications` step 9 (also tied to CW-B22 missing index, but stale stats amplify the wrong-plan choice).

### Exact pipeline points

File: `apps/api/src/modules/brownfield-wave-executor/service.ts`

| Line | Event | What follows |
|---|---|---|
| 79 | `const stageStats = await executeStage(pool, run.runId, mappings);` | Staging populated, reltuples stale |
| 80–88 | logRunEvent `STAGE_COMPLETE` | — |
| 91 | `await updateWaveState(pool, run.runId, "VALIDATING");` | Validation queries start |
| 93 | `await executeValidate(...);` | Reads staging tables with bad stats |
| 118 | `await executeUpsert(...);` | Reads staging tables with bad stats — this is where the 17-min stall happens |

The optimal injection point is **after `executeStage` returns + after `STAGE_COMPLETE` is logged, before transitioning to VALIDATING**.

### Why ANALYZE is cheap

- Wave 1 staging tables hold at most ~20k rows each (`sys_skills` is the biggest; lifetime cap is the legacy mirror dump size).
- PG default `default_statistics_target = 100` samples 30k rows per analyzed table.
- ANALYZE on a 20k-row table: typically **20-100 ms** (single-table scan, in-memory).
- Total for 17 Wave 1 staging tables: **~1-2 s** wall clock cumulative.
- Net effect vs the observed 17-min stall: 3-4 orders of magnitude payback.

---

## §2 — Root cause analysis

### Why does `reltuples` get stale?

The wave executor sequence in `engine.ts:executeStage` (lines 150-224):

1. `truncateAllWave1Staging(pool)` — line 156 — TRUNCATE removes all rows AND **resets `reltuples` to 0** in `pg_class`.
2. For each mapping, `INSERT INTO staging.wave1_<target> SELECT ... FROM legacy_mirror.<src>` — lines 189-208 — pushes rows in, but does NOT update statistics.
3. `executeStage` returns; statistics still reflect 0 rows (or whatever they were after the last autovacuum/analyze ran on the empty table).

PostgreSQL's autovacuum eventually runs ANALYZE in the background, but:
- `autovacuum_analyze_threshold` (default 50) + `autovacuum_analyze_scale_factor` (default 0.1) means ANALYZE triggers at `50 + 0.1 * reltuples`. With `reltuples=0`, threshold is just 50 — so autovacuum WOULD trigger.
- BUT: autovacuum runs **asynchronously** in a separate worker, scheduled by `autovacuum_naptime` (default 1 min). The wave executor moves from STAGE → VALIDATE → APPROVE → UPSERT in seconds. By the time autovacuum considers the staging table, the upsert phase has already issued queries against it with the stale `reltuples=0` estimate.
- Worse: autovacuum may skip the table if there's contention, or run AFTER the upsert completes.

### Why the planner falls over

With `reltuples ≈ 0` on a table that actually has 20k rows:
- Planner thinks JOIN of `src` (≈0 rows from staging) × `target` (20k from sys.sys_*) → nested-loop with outer = src (small), inner = target. Picks seq scan on target because "outer is tiny anyway".
- Reality: src has 20k rows, target has 20k rows → 400M nested-loop iterations → minutes of CPU.
- With correct stats: planner picks hash-join (build hash from smaller side, probe other) → milliseconds.

Compounded with CW-B22 (`IS NOT DISTINCT FROM` blocking index scan), the planner's options are limited even with good stats — but **good stats let it pick the LEAST-bad option** (hash-join with seqscan rather than nested-loop with seqscan).

---

## §3 — Patch design

### §3.1 Changes per file

#### File: `apps/api/src/modules/brownfield-wave-executor/engine.ts`

**Change 1 — Add an exported `analyzeWave1Staging` function** alongside the existing `truncateAllWave1Staging`-style helpers.

Insert near the end of `executeStage` (after line 222, before line 224 return), OR — cleaner — as a separate exported function called by the orchestrator. Recommended: separate function.

Add the following function at top-level in `engine.ts`, near other exported `execute*` functions (e.g., after `executeStage` at line 224):

```typescript
// -----------------------------------------------------------------------------
// CW-B23 — ANALYZE staging tables post-populate
// -----------------------------------------------------------------------------

/**
 * CW-B23 fix — After STAGE phase populates staging tables with 10k-20k rows
 * via mass INSERT … SELECT, pg_class.reltuples is stale (still reflects the
 * post-TRUNCATE value of 0). Subsequent phases (VALIDATE/UPSERT) issue
 * complex JOINs against staging tables; bad cardinality estimates can yield
 * nested-loop plans where hash-join would be 100x faster.
 *
 * Cost: ~20-100ms per 20k-row table × 17 staging tables ≈ 1-2s total.
 * Benefit: avoids minutes-long stalls in UPSERT phase (REPORT X1 observed
 * 17 min on wave1_activity_classifications step 9 — root cause was a
 * combination of CW-B22 missing index AND CW-B23 stale stats).
 *
 * Only ANALYZEs the staging tables that were actually populated by this
 * run (filtered via the stats argument), to avoid wasting work on the
 * empty members of the canonical 18-table set.
 */
export async function analyzeWave1Staging(
  pool: Pool,
  stats: WaveStageStats[],
): Promise<void> {
  // Only ANALYZE tables with > 0 rows from this run. The stagingTable
  // field is the fully-qualified `staging.wave1_<short>` name from
  // repository.stagingTableFor().
  const tablesToAnalyze = stats
    .filter((s) => s.stagedRows > 0)
    .map((s) => s.stagingTable);

  if (tablesToAnalyze.length === 0) return;

  // Run ANALYZE per-table. Cannot batch in a single statement (ANALYZE
  // accepts only one table per call in PG ≤15; PG 16 supports multi-table
  // ANALYZE but the per-table loop is portable and individual ANALYZE on
  // 20k rows is < 100ms so the wall-clock cost is bounded by table count
  // not by serialization).
  for (const t of tablesToAnalyze) {
    try {
      await pool.query(`ANALYZE ${t}`);
    } catch (e) {
      // Non-fatal: log and continue. ANALYZE failure shouldn't poison
      // the wave run — subsequent phases will just use stale stats.
      console.error(
        `[wave1-analyze] ANALYZE ${t} failed: ${(e as Error).message}`,
      );
    }
  }
}
```

**Type note**: `WaveStageStats.stagingTable` is already present (verified in current code; engine.ts:170-174 sets it; types come from `@heuresys/shared`). No type changes needed.

#### File: `apps/api/src/modules/brownfield-wave-executor/service.ts`

**Change 2 — Import the new function and call it after `STAGE_COMPLETE` log**.

Modify the import block at lines 20-27 to add `analyzeWave1Staging`:

```typescript
import {
  executeApprove,
  executeStage,
  executeUpsert,
  executeValidate,
  loadMappings,
  runAcceptanceChecks,
  analyzeWave1Staging,  // CW-B23 — added
} from "./engine.js";
```

Then insert the ANALYZE call between line 88 (`logRunEvent` STAGE_COMPLETE) and line 91 (`updateWaveState` to VALIDATING).

Old code (lines 80-93):
```typescript
      const stageStats = await executeStage(pool, run.runId, mappings);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "STAGE_COMPLETE",
        payload: {
          mappings: mappings.length,
          staged_rows_total: stageStats.reduce((s, x) => s + x.stagedRows, 0),
        },
      });

      // VALIDATING
      await updateWaveState(pool, run.runId, "VALIDATING");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_VALIDATING" });
      const validateStats = await executeValidate(pool, run.runId, mappings, stageStats);
```

New code:
```typescript
      const stageStats = await executeStage(pool, run.runId, mappings);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "STAGE_COMPLETE",
        payload: {
          mappings: mappings.length,
          staged_rows_total: stageStats.reduce((s, x) => s + x.stagedRows, 0),
        },
      });

      // CW-B23 — ANALYZE staging tables to refresh pg_class.reltuples
      // before VALIDATE/UPSERT phases issue complex JOINs against them.
      // Cost: ~1-2s total for 17 tables × 20k rows each.
      // Benefit: avoids minutes-long stalls due to stale cardinality
      // estimates (REPORT X1 observed 17-min stall on wave1_activity_classifications).
      const analyzeT0 = Date.now();
      await analyzeWave1Staging(pool, stageStats);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "STAGE_ANALYZE_COMPLETE",
        payload: {
          tables_analyzed: stageStats.filter((s) => s.stagedRows > 0).length,
          elapsed_ms: Date.now() - analyzeT0,
        },
      });

      // VALIDATING
      await updateWaveState(pool, run.runId, "VALIDATING");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_VALIDATING" });
      const validateStats = await executeValidate(pool, run.runId, mappings, stageStats);
```

**Rationale for ordering**:
- The ANALYZE happens AFTER `STAGE_COMPLETE` log (post-stage observability preserved) and BEFORE `STATE_VALIDATING` transition. Audit trail clearly distinguishes the stage phase from the upsert phase, with ANALYZE as a transitional sub-step.
- Logging a `STAGE_ANALYZE_COMPLETE` event with elapsed time gives ops visibility into whether ANALYZE is slow (e.g., if a future Wave loads 200k rows, the elapsed time would surface immediately).
- Failure of ANALYZE is non-fatal (try/catch inside `analyzeWave1Staging` per Change 1) — wave continues with stale stats, planner falls back to current pre-patch behavior.

### §3.2 Alternatives considered + rejected

**Alternative A — Run `ANALYZE` inside `executeStage` itself (engine.ts line ~222 just before return).**

- Pro: Co-locates ANALYZE with the INSERT, hard to forget.
- Contro: Mixes a side-effect (statistics refresh) with the stage logic. Tests that mock `executeStage` would unexpectedly trigger ANALYZE. Less clean separation of concerns.
- **Rejected**: orchestrator-level call (service.ts) is cleaner. Stage function stays focused on staging-table population.

**Alternative B — Run `VACUUM ANALYZE` instead of just `ANALYZE`.**

- Pro: Cleans up dead tuples too.
- Contro: VACUUM acquires more aggressive locks, can block concurrent reads. Staging tables are freshly TRUNCATED + populated → there are no dead tuples to clean up. VACUUM adds I/O overhead with zero benefit on a fresh load.
- **Rejected**: ANALYZE alone is sufficient and cheaper.

**Alternative C — Use `ANALYZE staging.wave1_skill_categories, staging.wave1_skills, …` multi-table syntax (PG 16+).**

- Pro: Single round-trip.
- Contro: All 17 tables in one ANALYZE call acquires AccessShareLock on all of them simultaneously; if any one is locked by another session, the whole call blocks. Per-table loop with try/catch is more resilient.
- **Rejected**: per-table loop is robust + the wall-clock difference is negligible (≤ 200ms of additional latency from 17 round-trips on localhost).

**Alternative D — Tune `autovacuum_analyze_scale_factor = 0.01` per-table via `ALTER TABLE … SET (autovacuum_analyze_scale_factor = …)` and rely on autovacuum.**

- Pro: Set once, declarative.
- Contro: Autovacuum is **asynchronous**. The wave moves STAGE → VALIDATE → UPSERT in seconds; autovacuum won't catch up in time. Settings change is also orthogonal — it doesn't trigger ANALYZE on demand, just lowers the threshold for the next autovacuum cycle.
- **Rejected**: doesn't address the actual race condition.

**Chosen approach (Change 1+2)**: explicit synchronous ANALYZE per populated staging table immediately after STAGE completes. Surgical, observable, fail-safe.

---

## §4 — Test cases (specific) for CLI to author

### Unit tests

**Test 1 — `analyzeWave1Staging` skips empty staging tables**:
```typescript
import { analyzeWave1Staging } from "../src/modules/brownfield-wave-executor/engine";

test("CW-B23: analyzeWave1Staging issues no queries for empty stats", async () => {
  const mockPool = { query: vi.fn() };
  await analyzeWave1Staging(mockPool as any, []);
  expect(mockPool.query).not.toHaveBeenCalled();
});

test("CW-B23: analyzeWave1Staging issues ANALYZE only for populated tables", async () => {
  const mockPool = { query: vi.fn().mockResolvedValue({ rowCount: 0 }) };
  await analyzeWave1Staging(mockPool as any, [
    { target: "sys_skills",     stagingTable: "staging.wave1_skills",     stagedRows: 20000, validatedRows: 0, failedRows: 0, upsertedRows: 0, lineageRows: 0 },
    { target: "sys_skill_aliases", stagingTable: "staging.wave1_skill_aliases", stagedRows: 0, validatedRows: 0, failedRows: 0, upsertedRows: 0, lineageRows: 0 },
  ]);
  expect(mockPool.query).toHaveBeenCalledTimes(1);
  expect(mockPool.query).toHaveBeenCalledWith("ANALYZE staging.wave1_skills");
});
```

**Test 2 — `analyzeWave1Staging` does not throw if one ANALYZE fails**:
```typescript
test("CW-B23: ANALYZE failure on one table doesn't poison the loop", async () => {
  const mockPool = {
    query: vi.fn()
      .mockResolvedValueOnce({ rowCount: 0 })       // wave1_skill_categories OK
      .mockRejectedValueOnce(new Error("lock timeout"))  // wave1_skills fails
      .mockResolvedValueOnce({ rowCount: 0 }),       // wave1_skill_aliases OK
  };
  await expect(analyzeWave1Staging(mockPool as any, [
    { target: "sys_skill_categories", stagingTable: "staging.wave1_skill_categories", stagedRows: 100, validatedRows: 0, failedRows: 0, upsertedRows: 0, lineageRows: 0 },
    { target: "sys_skills",           stagingTable: "staging.wave1_skills",           stagedRows: 20000, validatedRows: 0, failedRows: 0, upsertedRows: 0, lineageRows: 0 },
    { target: "sys_skill_aliases",    stagingTable: "staging.wave1_skill_aliases",    stagedRows: 500, validatedRows: 0, failedRows: 0, upsertedRows: 0, lineageRows: 0 },
  ])).resolves.toBeUndefined();
  expect(mockPool.query).toHaveBeenCalledTimes(3);
});
```

### Integration tests

**Test 3 — Real wave run logs `STAGE_ANALYZE_COMPLETE` event with elapsed_ms**:
```typescript
test("CW-B23: wave run emits STAGE_ANALYZE_COMPLETE between STAGE_COMPLETE and STATE_VALIDATING", async () => {
  const { runId } = await triggerWave1AsAdmin({ mode: "DRY_RUN" });
  const events = await fetchRunEvents(runId);
  const stageIdx = events.findIndex(e => e.message === "STAGE_COMPLETE");
  const analyzeIdx = events.findIndex(e => e.message === "STAGE_ANALYZE_COMPLETE");
  const validIdx = events.findIndex(e => e.message === "STATE_VALIDATING");
  expect(stageIdx).toBeGreaterThanOrEqual(0);
  expect(analyzeIdx).toBeGreaterThan(stageIdx);
  expect(validIdx).toBeGreaterThan(analyzeIdx);
  expect(events[analyzeIdx].payload?.tables_analyzed).toBeGreaterThan(0);
  expect(events[analyzeIdx].payload?.elapsed_ms).toBeLessThan(5000); // sanity bound
});
```

**Test 4 — Post-ANALYZE, `pg_class.reltuples` reflects actual row count**:
```typescript
test("CW-B23: pg_class.reltuples on staging.wave1_skills reflects post-INSERT row count", async () => {
  await triggerWave1AsAdmin({ mode: "EXECUTE", debugLimit: 100 });
  const res = await pool.query<{ reltuples: number; actual: number }>(
    `SELECT
       (SELECT reltuples FROM pg_class WHERE oid = 'staging.wave1_skills'::regclass) AS reltuples,
       (SELECT count(*)  FROM staging.wave1_skills) AS actual`
  );
  const { reltuples, actual } = res.rows[0]!;
  // Tolerance: ANALYZE samples don't yield exact count, but should be
  // within 20% on a 100-row table.
  if (actual > 0) {
    expect(Math.abs(reltuples - actual) / actual).toBeLessThan(0.2);
  }
});
```

### Performance regression test

**Test 5 — Wave 1 UPSERT phase wall-clock improves with ANALYZE present**:
```text
Hard to assert directly in CI, but possible to assert that the
STAGE_ANALYZE_COMPLETE event was logged before any UPSERT step. The
17-min stall recurrence is the qualitative observation; quantify by
asserting total wave duration < 10 min on the standard fixture.
```

---

## §5 — Acceptance criteria post-patch

### Query 1 — Verify ANALYZE was run + stats are fresh

After a Wave 1 dry-run finishes, run on the platform DB:

```sql
SELECT relname,
       reltuples::bigint     AS estimated_rows,
       n_live_tup            AS actual_live,
       last_analyze          AS last_analyze_ts,
       (NOW() - last_analyze) AS analyze_age
  FROM pg_stat_user_tables
 WHERE schemaname = 'staging'
   AND relname LIKE 'wave1_%'
 ORDER BY n_live_tup DESC;
```

**Expected**:
- `last_analyze_ts` within the past 10 minutes for every populated staging table.
- `reltuples` ≈ `n_live_tup` (within 20% margin on small samples; exact on large samples).
- No populated staging table should show `last_analyze` as NULL or older than the start of the wave run.

### Query 2 — Verify wave run event log includes the new event

```sql
SELECT level, message, payload, occurred_at
  FROM audit.brownfield_wave_executor_run_events
 WHERE run_id = '<latest-run-id>'
 ORDER BY occurred_at ASC;
```

**Expected**: presence of one `STAGE_ANALYZE_COMPLETE` event between `STAGE_COMPLETE` and `STATE_VALIDATING`, with `payload->>'elapsed_ms'` numeric and reasonable (typically 200-2000 ms).

### Query 3 — Wall-clock improvement on Wave 1 full retry

End-to-end: full Wave 1 (no DEBUG_LIMIT) completes in ≤ 10 min. UPSERT phase alone ≤ 5 min. No single mapping stalls > 60 s on step 9 staging-mark.

---

## §6 — Risk + rollback

### Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| ANALYZE acquires AccessShareLock that conflicts with concurrent DDL | VERY LOW (no concurrent DDL on staging tables during wave run) | LOW (ANALYZE wait until lock available, then proceeds) | Per-table loop allows non-blocking partial progress |
| ANALYZE on a corrupted staging table errors out | LOW | LOW | try/catch in `analyzeWave1Staging` logs + continues |
| Future Wave 2/3 staging tables not covered | MED (likely as new waves added) | LOW (no regression, just no perf benefit) | Pattern: each new wave's executor must call its own `analyzeWaveN Staging` analogue |
| ANALYZE duration creeps up as data grows beyond 200k rows | LOW (current cap 20k per table, no growth path identified) | LOW | Monitor `STAGE_ANALYZE_COMPLETE.payload.elapsed_ms` log; alert if > 30s |

### Rollback procedure

If the patch causes regression:

1. `git revert` Change 2 in `service.ts` (the call site). Function `analyzeWave1Staging` can stay in `engine.ts` as dead code; it's idempotent and harmless if uncalled. Even cleaner: revert both changes together.
2. Re-run `pnpm test` to verify baseline green.
3. Re-trigger Wave 1; behavior reverts to pre-patch (slow but functional).

No DB schema or data changes. Pure code revert.

---

## §7 — Effort estimate for CLI

| Step | Effort |
|---|---|
| Read patch spec + understand context | 10 min |
| Apply Change 1 (add function in engine.ts) | 10 min |
| Apply Change 2 (call site + event log in service.ts) | 10 min |
| Write Tests 1-2 (unit mocked) | 30 min |
| Write Tests 3-4 (integration with real DB) | 40 min |
| Run `pnpm test` baseline (must stay 69+ green, plus 2-4 new) | 15 min |
| Wave 1 retry + capture Query 1+2+3 acceptance output | 20 min |
| Atomic commit + push | 10 min |
| **Total** | **~2.5 h** |

**Confidence**: HIGH. Smallest of the three patches.

---

## §8 — Interaction with CW-B22

CW-B22 (`IS NOT DISTINCT FROM → =`) and CW-B23 (ANALYZE) **compound**: with bad stats AND bad predicate, the planner has no choice but seq-scan-nested-loop. With either one fixed, performance improves; with both, the planner can pick its best plan.

**Recommended apply order**: CW-B22 first, CW-B23 second, then re-test. Reason: CW-B22 is a correctness-equivalent transform of the SQL (same semantics, faster plan); CW-B23 is a hygiene step that helps every JOIN downstream. If you apply only one, CW-B22 has higher direct impact on the observed 17-min stall.

But **both should land together in the same Wave 1 retry cycle** for the cleanest acceptance signal.
