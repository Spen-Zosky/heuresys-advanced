# _04_REPORT_<NNN>_<slug>.md

**Protocol phase:** REPORT (executor → supervisor, closure)
**Goal ID:** <NNN>
**Slug:** <slug>
**Variant:** complete | partial
**Authored:** YYYY-MM-DD HH:MM:SS+02:00, by Claude Code CLI
**EXEC reference:** `_03_EXEC_<NNN>[<resume>]_<slug>.md` (final state)
**PLAN reference:** `_02_PLAN_<NNN>_<slug>.md` (sha256: <sha>)
**APPROVAL reference:** `_02b_APPROVAL_<NNN>.md` (sha256: <sha>)

---

## §1 — Outcome

**Result:** ✅ complete | ⚠️ partial | ❌ failed

One paragraph: what was achieved against PLAN §7 acceptance criteria.

---

## §2 — Acceptance criteria — pass/fail

| # | Criterion | Status | Verified-by | Evidence |
|---|---|---|---|---|
| 1 | `pnpm test` exit 0, ≥ N pass | ✅ PASS | `pnpm test` | `baselines/<NNN>-pnpm-test-final-<ts>.log` |
| 2 | Audit table populated | ✅ PASS | SQL query | output below |
| 3 | Full-scale run ≤ 600s | ⚠️ partial | wall-clock | <details> |
| ... | ... | ... | ... | ... |

---

## §3 — Artefacts produced

### Commits

| sha | Subject | Files |
|---|---|---|
| `<sha>` | `feat(...)`: ... | ... |

### Files created / modified

| Path | Change | Lines added/removed |
|---|---|---|

### DB writes

| Object | Operation | Row count | Reversibility |
|---|---|---|---|

---

## §4 — Verifications (verbatim output)

(One subsection per verification, with exact command + exact output.)

### V1 — pnpm test final state
```
$ pnpm test
... (full output)
```

### V2 — audit.import_run_logs populated
```sql
SELECT count(*), array_agg(DISTINCT new_status ORDER BY 1)
FROM audit.import_run_logs WHERE import_run_id = '<new-run>';
```
```
count | array_agg
------+----------
   5  | {APPROVED,COMPLETE,RUNNING,UPSERTING,VALIDATING}
```

---

## §5 — Deviations from PLAN

(Anything the executor did differently from PLAN. With rationale. If zero, write "zero".)

---

## §6 — Residual issues

(Anything left over. Each gets a proposal: new goal, follow-up commit, ADR, etc.)

| # | Issue | Severity | Proposed action |
|---|---|---|---|

---

## §7 — Time / turn variance

| Metric | PLAN estimate | EXEC actual | Variance |
|---|---|---|---|
| Turns | 40 | <X> | <±N> |
| Wall-clock | <h> | <h> | ... |

---

## §8 — Handoff

- STATE updated: `current_phase: REPORT`, `next_actor: Cowork`.
- Awaits: `_05_REVIEW_<NNN>_<slug>.md` (async; may arrive hours or days later).
- Channel-side closure: CLI stands down on this goal.

---

*End of _04_REPORT_<NNN>_<slug>.md*
