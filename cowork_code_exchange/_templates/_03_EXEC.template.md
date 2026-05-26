# _03_EXEC_<NNN>[<resume>]_<slug>.md

**Protocol phase:** EXEC (executor running log)
**Goal ID:** <NNN>
**Resume suffix:** (none | a | b | c)
**Slug:** <slug>
**Status:** IN PROGRESS
**Authorisation:** `_02b_APPROVAL_<NNN>.md` (PLAN <version>, sha256 `<sha>`)
**PLAN reference:** `_02_PLAN_<NNN>_<slug>.md` (sha256 verified at EXEC start: <sha>)
**Started:** YYYY-MM-DD HH:MM:SS+02:00
**Hard cap:** 40 turns; escalation at turn 38
**Predecessor artefacts:** (if resume) `_03_EXEC_<NNN>[prev_resume].md` HALTED at <step>

Running log appended chronologically. Each step records: action, command, result, time, artifacts.

Event stream (machine-readable): `_03_EXEC_<NNN>[<resume>].events.jsonl` (1 JSON line per step).

---

## Pre-EXEC budget commitment

(Confirm PLAN §8 allocation and any honest-estimate caveats relative to the cap.)

```
Step -3 B1                 1
Step -2 B2                 2
...
Sub-total                  XX
Buffer                     5
Hard cap                   40
```

---

## Step log

### Step -3 — B1 baseline capture

**Time:** YYYY-MM-DD HH:MM:SS+02:00 → HH:MM:SS+02:00, wall-clock <s>s
**Command:** `<exact command>`
**Output captured to:** `baselines/<NNN>-pnpm-test-<ts>.log`
**Exit code:** 0

**Result summary:**

```
Test Files  ...
     Tests  ...
   Start at ...
   Duration ...
```

**Verdict:** ✅ baseline OK. EXEC may proceed.
**Event written to:** `_03_EXEC_<NNN>.events.jsonl`

### Step -2 — B2 debug-scale control

...

---

## Halt summary (if EXEC halts)

| Aspect | Value |
|---|---|
| EXEC turns consumed | <X> of 40 |
| Backup gate | <PASSED|FAILED|NOT CHECKED> |
| Baselines captured | B1, B2, ... |
| Code changes | NONE / <N> commits: <list> |
| DB writes | NONE / <list> |
| Reason for halt | <classification + evidence> |
| Awaits | <what Cowork action unblocks resume> |

On halt:
1. Finalize this EXEC log (no more appends).
2. Append a `{status: halt, halt_reason: ...}` event in events.jsonl.
3. Update `_00_STATE_<NNN>.md`: `current_phase: PLAN` (back to PLAN for amendment) or `EXEC_<next_suffix>` if amendment already agreed.
4. Confirm in chat to Cowork with a brief summary.

---

## Turn ledger (consumed vs budget)

| Turn | Step | Action | Budget | Consumed |
|---|---|---|---|---|

Total: <X> / 40.

---

## On completion (non-halt)

When all PLAN steps are done and §7 acceptance criteria pass:
1. Move to REPORT phase: write `_04_REPORT_<NNN>_<slug>.md`.
2. Final events.jsonl line with `{status: complete}`.
3. Update STATE: `current_phase: REPORT`, `turn_consumed: <final>`, `next_actor: Cowork`.

*Running log — appended in subsequent EXEC turns.*
