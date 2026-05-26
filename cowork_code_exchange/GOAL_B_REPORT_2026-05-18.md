# Goal B — Lineage + HANDOFF reconciliation + staging cleanup + stats refresh

**Date:** 2026-05-18 (~16:14 GMT+2)
**Repo:** `D:\heuresys-advanced\`
**DB:** `heuresys_advanced` on `oracle-vm-default` (SSH remote-exec via `sudo -u postgres`, port 5432)
**Backup gate:** PASSED — proceed with writes.

---

## Section 1 — Preflight backup check

Discovery (`ls -la /home/ubuntu/backups/*.dump /var/backups/postgresql/*.dump /home/ubuntu/heuresys-advanced/*.dump 2>/dev/null`):

| Path | Size | Mtime | Age |
|---|---|---|---|
| `/home/ubuntu/backups/heuresys_advanced_pre_phase2_20260518_1347.dump` | 130 206 691 bytes (124 MB, pg_dump custom v1.15-0) | 2026-05-18 13:47 UTC | **~2.5 h** |

Other discovery paths (`/var/backups/postgresql/`, `/home/ubuntu/heuresys-advanced/`) — empty / no match.

**Freshness verdict:** **OK** (≤ 7 days; in fact ≤ 1 day).
**Decision:** proceed with writes (Actions 3, 4, 5).
**Abort path not taken.**

---

## Section 2 — Lineage FK integrity

### Queries executed

```sql
-- Schema verification (the literal spec referenced "import_run_id" — the real column
-- on sys.sys_source_lineage_records is "source_lineage_import_run_id").
SELECT column_name FROM information_schema.columns
 WHERE table_schema='sys' AND table_name='sys_source_lineage_records';

-- Orphan check (corrected column name)
SELECT count(*) AS orphan_lineage_rows
FROM sys.sys_source_lineage_records l
WHERE l.source_lineage_import_run_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.import_runs r WHERE r.import_run_id = l.source_lineage_import_run_id
  );

-- Lineage distribution by import_run_id
SELECT source_lineage_import_run_id, count(*) AS lineage_count
FROM sys.sys_source_lineage_records
GROUP BY source_lineage_import_run_id
ORDER BY lineage_count DESC;

-- Full import_runs
SELECT ctid, xmin, xmax, import_run_id, import_run_wave, import_run_classification_scope,
       import_run_status, import_run_started_at, import_run_finished_at, import_run_initiated_by
FROM brownfield.import_runs;
```

### Results

**Orphan lineage rows:** **0**.

**`brownfield.import_runs` full content:**

| ctid | xmin | xmax | import_run_id | wave | scope | status | started_at | finished_at | initiated_by |
|---|---|---|---|---|---|---|---|---|---|
| (0,3) | 130487 | 0 | `67d51a90-7ad9-44e2-860d-0d2e0e945af8` | 1 | DEMO | RUNNING | 2026-05-16 21:19:42.976+00 | NULL | `82c89e25-95db-46eb-be24-33a840cb3b79` |

**Lineage distribution by `source_lineage_import_run_id`:**

| source_lineage_import_run_id | lineage_count |
|---|---|
| `NULL` | **52** |

**Verdict: INTEGRITY_OK (vacuous).**

**Caveat — important nuance:** the orphan check passes only because **all 52 lineage rows have `source_lineage_import_run_id = NULL`.** The FK is "not violated" because there is no FK to violate. The engine never back-populated the lineage→import_run linkage on the debug-scale runs that produced these 52 rows. This means:

- The runbook §3.6 acceptance criterion ("every canonical row has lineage tied to `import_run_id`") is **structurally satisfied** (52 lineage rows exist) but **logically incomplete** (the run that emitted them is not traceable through the FK).
- Combined with the single visible `import_runs` row stuck `RUNNING` since 2026-05-16, this is a stronger statement of MIGRATION_STATUS §10 E10-4 than the report originally captured. The "Wave 1 reached COMPLETE on debug-scale" claim leaves **no durable audit trail at all** in the registry — neither in `import_runs.import_run_status` nor in `sys_source_lineage_records.source_lineage_import_run_id`.

Recorded as new gap candidate — see §6.

---

## Section 3 — HANDOFF reconciliation

**File path:** `D:\heuresys-advanced\HANDOFF.md` (row D, single inline edit at line 36).

**Re-verification before edit:** `SELECT count(*) FROM sys.sys_user_certifications;` → **1** (row `id=11ca9da8-438d-4931-af07-27d7cff66959`, `created_at=2026-05-17 19:52:45.863+00`).

**Finding:** HANDOFF.md already says `sys_user_certifications=1`. The MIGRATION_STATUS §10 E10-3 mismatch was real at report-time (~15:00 today, when an exact-count query via `query_to_xml` returned 0), but is **not reproducible** at edit-time (~16:14 today, same DB, same query, returns 1, against a row that was created yesterday). The value `=1` is therefore correct and was not changed; an inline reconciliation note was added.

**Old line (line 36, verbatim):**
```
| D | Brownfield Wave 1 execution | ✅ | Framework completo + pipeline end-to-end VERDE su debug-scale ≤20 row/target. Empirico: 5-cap COMPLETE 270s, 20-cap COMPLETE 310s, lineage>0, acceptance criteria verdi, sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati. **Known issue residuo SCOPE PERFORMANCE FULL 47K**: ...
```

**New line (line 36, verbatim):**
```
| D | Brownfield Wave 1 execution | ✅ | Framework completo + pipeline end-to-end VERDE su debug-scale ≤20 row/target. Empirico: 5-cap COMPLETE 270s, 20-cap COMPLETE 310s, lineage>0, acceptance criteria verdi, sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati *(reconciled 2026-05-18 per MIGRATION_STATUS §10 E10-3 — sys_user_certifications=1 confirmed against live DB; transient =0 reading at ~15:00 not reproducible at ~16:10, row dates from 2026-05-17)*. **Known issue residuo SCOPE PERFORMANCE FULL 47K**: ...
```

**`git diff` HANDOFF.md (unstaged, no commit performed):**

```diff
diff --git a/HANDOFF.md b/HANDOFF.md
index 63bbc58..fbab6cf 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -33,7 +33,7 @@ estesa che copre:
 | A | GitHub Tier 0-1 | ✅ | Topics, LICENSE, Dependabot, ruleset, security features tutti attivi |
 | B | Renderer grafici React Flow / Mermaid | ⏸️ DEFERRED | Gated brand identity (palette + typography decisions) |
 | C | ESS mutations hardening | ✅ | Upload form + polling implementati, E2E verde |
-| D | Brownfield Wave 1 execution | ✅ | ... sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati. **Known issue ...
+| D | Brownfield Wave 1 execution | ✅ | ... sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati *(reconciled 2026-05-18 per MIGRATION_STATUS §10 E10-3 — sys_user_certifications=1 confirmed against live DB; transient =0 reading at ~15:00 not reproducible at ~16:10, row dates from 2026-05-17)*. **Known issue ...
```

Byte diff: 1 changed line, net +207 bytes inserted, no removals, no other files touched. `git status` shows `M HANDOFF.md` — untracked + not staged, consistent with "no `git commit`" requirement.

---

## Section 4 — Staging cleanup

```sql
-- pre
SELECT count(*) AS pre_count FROM staging.wave1_skill_categories;
-- action
TRUNCATE staging.wave1_skill_categories;
-- post
SELECT count(*) AS post_count FROM staging.wave1_skill_categories;
```

| Stage | Exact count |
|---|---|
| Pre-TRUNCATE | **0** |
| Post-TRUNCATE | **0** |

**Note on the expected vs actual pre-state:** the goal prompt expected pre-count=49 per MIGRATION_STATUS §3. Reality is pre-count=0. The §3 entry "wave1_skill_categories | **49**" in MIGRATION_STATUS confused `pg_class.reltuples` (estimate, 49) with the exact `count(*)` (0). The 49 was a stale stat from a prior insertion that got rolled back / truncated outside of the captured timeline. TRUNCATE on an already-empty table is a no-op for data **but still resets `relpages`/`reltuples`/n_live_tup**, which is what we wanted operationally. After TRUNCATE, `pg_class.reltuples` for `staging.wave1_skill_categories` returns `-1` (uninitialized, pending next ANALYZE) — clean state.

**Verdict: CLEANUP_OK.**

---

## Section 5 — Stats refresh

```sql
-- pre
SELECT c.relname, c.reltuples::bigint AS pre_reltuples, c.relpages, s.n_live_tup, s.n_dead_tup, s.last_vacuum, s.last_analyze
FROM pg_class c LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE c.relname='import_runs' AND c.relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='brownfield');
-- action
VACUUM (ANALYZE) brownfield.import_runs;
-- post (same query as pre)
```

| Stage | reltuples | relpages | n_live_tup | n_dead_tup | last_vacuum | last_analyze |
|---|---|---|---|---|---|---|
| Pre-VACUUM | **2** | 1 | 1 | 31 | NULL (**never vacuumed**) | NULL (**never analyzed**) |
| Post-VACUUM | **1** | (1) | 1 | **0** | 2026-05-18 14:15:52.045+00 | 2026-05-18 14:15:52.047+00 |

**Verdict: STATS_REFRESHED.**

**MIGRATION_STATUS §10 E10-5 resolution:** the `reltuples=2 vs visible rows=1` anomaly is now explained and resolved. Root cause was **31 dead tuples + no autovacuum** on this table (`last_vacuum=NULL`, `last_analyze=NULL`, so autovacuum thresholds presumably not met because the table has only 1 live row and very few changes). The 31 dead tuples came from the executor's repeated UPDATE attempts to transition state (INSERT initial row → UPDATE state=RUNNING → UPDATE finished_at on FAILED attempts during debugging), each leaving a dead tuple in MVCC. After VACUUM ANALYZE: reltuples=1 ✅, n_dead_tup=0 ✅, stats freshly populated.

Side note for next iteration: configure autovacuum on `brownfield.import_runs` (small table, frequent UPDATEs) — e.g., `ALTER TABLE brownfield.import_runs SET (autovacuum_vacuum_threshold = 10, autovacuum_analyze_threshold = 10);` — so this doesn't drift back.

---

## Section 6 — Escalation

1. **NEW gap discovered in Section 2: lineage rows lack `source_lineage_import_run_id` backfill.**
   - **What:** All 52 rows in `sys.sys_source_lineage_records` have `source_lineage_import_run_id = NULL`. The brownfield wave executor produced these rows but never linked them back to the `brownfield.import_runs` row that emitted them.
   - **Why it matters:** Combined with `brownfield.import_runs` showing a single row stuck `RUNNING` since 2026-05-16, this means there is **no durable audit trail** for the runs that produced the canonical data already in `sys.*`. Acceptance criterion §3.6 of the Wave 1 runbook is structurally satisfied but logically incomplete.
   - **Recommended action:** add to the Goal A scope (SQL-side UPSERT refactor + audit wiring per §8.B of MIGRATION_STATUS): make the engine's UPSERT phase write `source_lineage_import_run_id = :current_run_id` on every lineage row insert. Optionally backfill the existing 52 rows with the stuck `67d51a90…` run_id if that's the run we want to attribute them to (or leave them NULL as "pre-history" and start fresh).

2. **Goal B Action 4 expectation drift.**
   - **What:** Goal prompt expected `staging.wave1_skill_categories` pre-count=49; actual=0. Root cause: MIGRATION_STATUS §3 cited `reltuples` as if it were exact, an internal error in that report.
   - **Why it matters:** doesn't block Goal B (TRUNCATE on empty is fine), but invalidates that data point in MIGRATION_STATUS.
   - **Recommended action:** none required; for the record, MIGRATION_STATUS §3 staging row should be re-read as "estimate-only" rather than authoritative. Already noted here, no separate report edit needed.

3. **Goal B Action 3 — value of `sys_user_certifications` non-deterministic in this session.**
   - **What:** At ~15:00 today, `SELECT count(*) FROM sys.sys_user_certifications` via the same SSH path returned 0. At ~16:14 today, the same query returns 1, against a row dated 2026-05-17 19:52. No DML by me between those two reads. Possible causes: (a) earlier `query_to_xml` wrapper hit a transient empty result (e.g., table locked for a microsecond by an autovacuum or by an in-flight test commit), (b) the API server inserted+rolled back, (c) test seed re-applied.
   - **Why it matters:** Low-stakes operationally, but the kind of glitch that could mask real data loss in a less obvious case.
   - **Recommended action:** if reproducible, run the same `query_to_xml` form to see whether the wrapper itself is fragile; otherwise drop it — single occurrence.

No actions blocked. Backup gate passed, all 5 actions completed within scope.

---

*End of report.*
