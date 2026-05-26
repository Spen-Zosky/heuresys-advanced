# _02_PLAN_<NNN>_<slug>.md

**Protocol phase:** PLAN (executor → supervisor)
**Goal ID:** <NNN>
**Slug:** <slug>
**Plan version:** v1
**Created:** YYYY-MM-DD, by Claude Code CLI
**PROMPT reference:** `_01_PROMPT_<NNN>_<slug>.md` (sha256: <compute via sha256sum>)
**DISCOVERY reference:** `_00_DISCOVERY_<NNN>_<slug>.md` (sha256: <compute>)
**Predecessor artefacts:**
- ...

---

## §1 — Executive summary

(Max 10 lines. Plain English, no code. What you intend to do.)

---

## §2 — Baseline capture plan

| ID | Topic | Capture method | Output file | "Good" threshold |
|---|---|---|---|---|
| B1 | `pnpm test` baseline | `pnpm test --reporter=verbose` | `baselines/<NNN>-pnpm-test-<ts>.log` | exit 0, ≥ <N> pass |
| B2 | Debug-scale Wave run control | ... | `baselines/<NNN>-debug-<ts>.log` | state=COMPLETE in ≤ <s>s |
| B3 | DB state snapshot | per-table counts via `query_to_xml` | `baselines/<NNN>-db-state-<ts>.txt` | (as expected per DISCOVERY) |
| B5 | Source file SHAs | `sha256sum apps/api/src/modules/<scope>/*.ts` | `baselines/<NNN>-source-shas-<ts>.txt` | (rollback anchor) |

Each baseline registered in `baselines/INDEX.md` at capture time.

---

## §3 — Code change plan

(Per file. Order by dependency.)

### File: `apps/api/src/modules/<scope>/<file>.ts`

- **Current state:** what it does today (1-2 lines)
- **Intended change:** what behavior changes (3-5 lines)
- **Risk class:** low | medium | high
- **Test coverage:** which test exercises this; if none, propose new test
- **Commit:** atomic — separate commit from other file changes

---

## §4 — DB write plan

| Object | Write type | Trigger | Rows/run (debug) | Rows/run (full) | Reversible? |
|---|---|---|---|---|---|
| `audit.import_run_logs` | INSERT | each state transition | ~5 | ~5 | yes (DELETE WHERE run_id = X) |
| `brownfield.import_runs` | UPDATE | state transition | 1 per run | 1 per run | yes (UPDATE back) |

---

## §5 — Design detail

(Standalone section for trickiest part. Vocabulary tables, fragment compilers, edge cases, dynamic-SQL safety.)

---

## §6 — Decision points

| # | Decision | Path A | Path B | Recommendation | Rationale |
|---|---|---|---|---|---|

---

## §7 — Acceptance criteria

- [ ] `pnpm test` exit code = 0, passing count ≥ <N>
- [ ] `SELECT count(*) FROM audit.import_run_logs WHERE import_run_id = <new>` ≥ 5
- [ ] Full-scale run wall-clock ≤ 600s; `sys.sys_skills` ≥ 5000 after run
- [ ] `git log --oneline | head -10` shows ≥ 3 atomic commits attributable to Goal <NNN>
- [ ] STATE file `current_phase: REPORT` and `turn_consumed ≤ turn_budget`
- [ ] events.jsonl has ≥ 1 line per major step

---

## §8 — Turn budget breakdown

```
Step  -3 B1 baseline             1
Step  -2 B2 debug-scale          2
Step  -1 B3 audit/lineage state  0.5
Step   0 fresh pg_dump if needed 1
Step   1 ...                     N
...
Sub-total                        XX
Buffer                           5
Hard cap                         40
```

If estimate exceeds cap, declare in this section and propose either: (a) reduce scope, (b) ask for higher cap, (c) split into sub-goals <NNN>a and <NNN>b.

---

## §9 — Risk register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | ... | M | H | ... |
| R2 | ... | L | M | ... |

---

## §10 — Rollback plan

| Commit | Revert command | DB impact | Restore command (if needed) |
|---|---|---|---|
| `<sha>` | `git revert <sha>` | none | n/a |

For DB-side rollback: confirm `pg_restore -d heuresys_advanced /home/ubuntu/backups/<dump>` works; estimate downtime ~<N>min.

---

## Revision history

(Appended on every revision. Never rewrite history — always append.)

### v1 (YYYY-MM-DD HH:MM)
Initial PLAN. Awaits Cowork review.

### v2 (YYYY-MM-DD HH:MM) — reason: <Cowork request>
Changes: ...

*End of _02_PLAN_<NNN>_<slug>.md*
