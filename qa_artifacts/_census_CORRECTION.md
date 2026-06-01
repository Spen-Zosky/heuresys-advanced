# DB sanitization census — CORRECTION (S954, 2026-06-01)

## What I got wrong

My initial census (`_census_1/2/3.txt`) read `pg_stat_user_tables.n_live_tup` and reported
several large tables as **"0 rows / pure bloat"**. That was **wrong**: `n_live_tup` is a
*planner estimate* that was **stale** (ANALYZE had never run on those tables). The real
`count(*)` values:

| Object | Claimed (stale estimate) | REAL count(*) | Verdict |
|---|---|---|---|
| `audit.import_validation_results` | 0 live / "546 MB bloat" | **1,522,455 rows** | **real data** — validation results of the 21 COMPLETED imports |
| `legacy_mirror.esco_skills` | 0 rows | **14,011 rows** (347 MB mostly TOAST/pgvector) | **real cache** |
| `legacy_mirror.esco_occupations` | 0 rows | **3,040 rows** | real cache |
| `legacy_mirror.industry_classifications` | 0 rows | **3,276 rows** | real cache |

**Consequence**: `legacy_mirror` (586 MB) and `audit.import_validation_results` (528 MB) are
**NOT garbage** — they hold legitimate legacy-source cache and import-audit data. There was
**no ~1 GB of bloat to reclaim**. VACUUM FULL correctly compacted the small real bloat (~21 MB:
1325→1304 MB).

## What WAS correctly cleaned (genuinely safe, done)

- **staging.rtl_* + legacy_rtl_occupations** (14 tables, ~6k rows) — TRUNCATEd. Real data already
  in `sys.*`; these are S950 import leftovers. Recreatable by the rtl-rebuild seeds.
- **temp_sdbi._x5b_runid + temp_sdbi.sys_users** — DROPped. SDBI-pilot leftovers, not
  migration-managed (000036 only creates the schema). Schema `temp_sdbi` kept.
- **orphan import_runs** — RUNNING (stuck since 2026-05-21) → CANCELLED; FAILED annotated.
  UPDATE not DELETE, so the 74,261 FK-linked validation_results were preserved (no cascade).
- **VACUUM FULL** on audit + legacy_mirror — compacted real bloat (~21 MB), structure intact.

## Verified safe after cleanup
- `db:migrate ×2` idempotent (45 migrations, exit 0 both runs).
- sys.sys_users intact (161).
- staging.wave1_* schema intact (18, migration-managed).

## Lesson (R5/R14)
Never classify an object as empty/bloat from `pg_stat` estimates — run real `count(*)` and check
`pg_relation_size` vs `pg_total_relation_size` (TOAST). A stale estimate is worse than "unknown":
it produced a confident-but-false "1 GB of garbage" claim.
