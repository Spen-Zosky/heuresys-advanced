---
goal_id: NNN
slug: <kebab-case-slug>
created: YYYY-MM-DDTHH:MM:SS+02:00
current_phase: DISCOVERY    # DISCOVERY | PROMPT | PLAN | APPROVED | EXEC | EXEC_a | EXEC_b | REPORT | REVIEW | CLOSED
plan_version: null          # set after PLAN exists: v1, v2, v3-bis, ...
plan_sha256: null           # set after APPROVAL: sha256 of currently-approved PLAN
turn_budget: null           # set in APPROVAL
turn_consumed: 0
last_event_ts: YYYY-MM-DDTHH:MM:SS+00:00
last_event_summary: "Goal created"
last_event_actor: Cowork
next_actor: Cowork
halt_count: 0
halt_reasons: []
commits: []
db_writes_planned: []
backup_gate:
  status: not_checked        # not_checked | passed | failed
  last_check: null
  dump_path: null
  dump_mtime: null
---

# Goal <NNN> — <slug>

## Summary

One paragraph: what this goal is about, what success looks like, what it unblocks.

## Active artefacts

| Phase | File | Status |
|---|---|---|
| DISCOVERY | `_00_DISCOVERY_<NNN>_<slug>.md` | (todo) |
| PROMPT | `_01_PROMPT_<NNN>_<slug>.md` | (todo) |
| PLAN | `_02_PLAN_<NNN>_<slug>.md` | (todo) |
| APPROVAL | `_02b_APPROVAL_<NNN>.md` | (todo) |
| EXEC | `_03_EXEC_<NNN>_<slug>.md` | (todo) |
| REPORT | `_04_REPORT_<NNN>_<slug>.md` | (todo) |
| REVIEW | `_05_REVIEW_<NNN>_<slug>.md` | (todo) |

## Residual issues / blockers

(empty until something needs attention)

## Notes for next actor

(empty until something specific to flag)
