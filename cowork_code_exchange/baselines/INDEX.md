# Baselines INDEX

Registry of all baselines captured by the cowork_code_exchange channel. Auto-readable by `scripts/cowork-exchange/status.mjs`.

## Naming convention

```
<NNN>-<topic>-<YYYYMMDD>_<HHMM>.<ext>     # v2 canonical (proposed)
B<N>_<descr>_<YYYYMMDD>_<HHMM>.<ext>      # legacy form used in EXEC 001/001a
Step<N><sub>_<descr>_<YYYYMMDD>_<HHMM>.<ext>  # in-flight EXEC step capture (added during 001a v5)
```

Both forms coexist in this repo as accreted history of Goal 001 + 001a EXEC. From Goal 002 onward, the canonical v2 form `<NNN>-<topic>-<ts>.<ext>` will be used exclusively. INDEX rows below capture the actual filenames present on disk.

---

## Goal 001 / 001a — audit-upsert-refactor (CLOSED 2026-05-18 ~21:30 GMT+2)

### EXEC 001 baselines (v2 era, before halt at T3)

| Baseline | Type | Captured | Step | File | Size |
|---|---|---|---|---|---|
| B3 (DB state + transform vocab) | db-snapshot | 2026-05-18T15:10Z | EXEC_001 T3 | `001-db-state-20260518_1710.txt` | 1.2 KB |
| B5 (source file SHAs) | source-sha | 2026-05-18T15:10Z | EXEC_001 T3 | `001-source-shas-20260518_1710.txt` | 862 B |

EXEC_001 halted at T3 over vocabulary mismatch (14 transform codes vs 5 assumed). These two baselines are preserved as halt evidence.

### EXEC 001a v3-bis baselines (turns 1-22 of v4 EXEC)

| Baseline | Type | Captured | Step | File | Size |
|---|---|---|---|---|---|
| B1 (pnpm test baseline) | test-output | 2026-05-18T15:38Z | EXEC_001a Step -3 | `B1_pnpm_test_20260518_173829.log` | 213 KB |
| B2 attempt 1 (debug-scale 20-cap run) | wave-run | 2026-05-18T15:51Z | EXEC_001a Step -2 | `B2_debug_run_20260518_175146.log` | 370 B |
| B2 attempt 1 pre-state | db-snapshot | 2026-05-18T15:51Z | EXEC_001a Step -2 | `B2_pre_state_20260518_175146.txt` | 636 B |
| B2 attempt 1 post-state | db-snapshot | 2026-05-18T15:51Z | EXEC_001a Step -2 | `B2_post_state_20260518_175146.txt` | 773 B |
| B2 attempt 2 (debug-scale, retry) | wave-run | 2026-05-18T15:54Z | EXEC_001a Step -2 | `B2_debug_run_20260518_175404.log` | 5 KB |
| B2 attempt 2 post-state | db-snapshot | 2026-05-18T15:54Z | EXEC_001a Step -2 | `B2_post_state_20260518_175404.txt` | 656 B |
| B4 (audit/lineage state) | db-snapshot | 2026-05-18T16:01Z | EXEC_001a Step -1 | `B4_audit_lineage_state_20260518_180107.txt` | 1.1 KB |
| B6 (EXPLAIN baseline) | sql-plan | 2026-05-18T16:03Z | EXEC_001a Step 1 | `B6_explain_baseline_20260518_180301.txt` | 2.4 KB |

### EXEC 001a v4 in-flight captures (Steps 3, 8 from v4 numbering)

| Capture | Type | Step | File | Size |
|---|---|---|---|---|
| Step 3 verify (audit-writer integration) | test-output | EXEC_001a Step 3 (v4) | `Step3_verify_20260518_192849.log` | 5 KB |
| Step 8 debug-scale-v4 gated test | wave-run | EXEC_001a Step 8 (v4) | `Step8_debug_v4_20260518_194730.log` | 1.9 KB |
| Step 8 idempotency gated test | wave-run | EXEC_001a Step 8 (v4) | `Step8_idempotency_20260518_195048.log` | 1.8 KB |

### EXEC 001a v4 turn 8 B2 re-capture (post-evidence-gate)

| Capture | Type | File | Size |
|---|---|---|---|
| B2 v4 capture (post-evidence) | wave-run | `B2_v4_capture_20260518_185032.log` | 5 KB |
| B2 v4 pre-state | db-snapshot | `B2_v4_pre_state_20260518_185032.txt` | 435 B |
| B2 v4 post-state | db-snapshot | `B2_v4_post_state_20260518_185032.txt` | 439 B |

### EXEC 001a v5 captures (turns 23-30, criterion 11 delivery)

| Capture | Type | Step | File | Size |
|---|---|---|---|---|
| Step 11.a verify (SQL-side refactor smoke + debug-scale) | wave-run | EXEC_001a Step 11.a (v5) | `Step11a_verify_20260518_211353.log` | 19 KB |
| Step 11.b verify (criterion 11 test assertions) | test-output | EXEC_001a Step 11.b (v5) | `Step11b_verify_20260518_212016.log` | 19 KB |
| Step 11.c idempotency (post-refactor) | wave-run | EXEC_001a Step 11.c (v5) | `Step11c_idempotency_20260518_212607.log` | 37 KB |

---

## Goal 002 — json-extract-lineage-fullscale (DISCOVERY phase)

DISCOVERY 002 captured via SSH at 2026-05-19T00:09Z–00:14Z. Findings live in `_00_DISCOVERY_002_*.md` §3-§10; not stored as separate baseline files (they're the doc itself). Reference for any 002 EXEC will be the DISCOVERY doc's SHA-256.

DISCOVERY 002 file sha (captured 2026-05-19T00:14Z): see filesystem at sign-off time.

---

## Cross-goal baselines

None.

---

## Conventions for new baselines (canonical v2, to be adopted from Goal 002+)

When CLI captures a baseline during EXEC:

1. Write the raw output to `baselines/<NNN>-<topic>-<YYYYMMDD>_<HHMM>.<ext>` (canonical v2 form).
2. Emit an event line in `_03_EXEC_<NNN><resume>.events.jsonl`:
   ```jsonl
   {"ts":"...","goal":<NNN>,"phase":"EXEC<...>","step":"...","action":"baseline.<topic>","status":"ok","artifacts":["baselines/<NNN>-<topic>-<ts>.<ext>"],"sha256":"<computed>","notes":"<short>"}
   ```
3. Append a row to this INDEX.md.
4. The SHA-256 is the contract: any post-EXEC verification that "this baseline corresponds to that artefact" uses the SHA, not the path.

For legacy `B<N>_<descr>_<ts>.<ext>` files from Goal 001/001a: they remain in the directory and in this INDEX as accreted history. Not renamed.

---

## Maintenance

- INDEX is human-readable + grep-friendly. Machine path: `scripts/cowork-exchange/status.mjs` (extensible to list-baselines if useful).
- Baselines from CLOSED goals are kept indefinitely (small footprint, audit value).
- If pruning is needed in the future: move to `baselines/_archive/<NNN>/` and remove from active table; record archive operation here.
