# Cowork ↔ Claude Code CLI exchange directory

## Purpose

This directory is the structured handshake channel between **Cowork** (the supervisor / architect) and **Claude Code CLI** (the executor). It exists to give a paper trail and an explicit authorization gate for the categories of work where ad-hoc chat is not enough:

- multi-file refactors that touch several modules at once,
- risky DB migrations (DDL, data backfills, brownfield ingests),
- iterative build + test loops that need to be replayed or audited.

Authoritative spec: **regola 13** of `~/.claude/CLAUDE.md` (user-global). The directory is **opt-in per project** — its presence here means this repo is part of the channel; absence means routine direct-push workflow.

## Protocol — the 5 phases

The protocol is a strict 5-step round-trip. Each step is a numbered markdown file. Step order is enforced; skipping is a violation.

| Step | File | Producer | Consumer | Purpose |
|---|---|---|---|---|
| 1 | `_01_PROMPT_<NNN>_<slug>.md` | Cowork (supervisor) | Claude Code CLI | Defines the task: scope, constraints, acceptance criteria, success oracle, off-limits. |
| 2 | `_02_PLAN_<NNN>_<slug>.md` | Claude Code CLI (executor) | Cowork | Detailed plan **before any execution**: steps, risk register, files to touch, verifications, fallback. Awaits explicit authorization. |
| 3 | `_03_EXEC_<NNN>_<slug>.md` | Claude Code CLI | (log) | Live execution log, written **only after** the supervisor authorizes the plan. Captures commits, command outputs, deviations from plan. |
| 4 | `_04_REPORT_<NNN>_<slug>.md` | Claude Code CLI | Cowork | Final closing report: artefacts produced, verified-by commands, residual issues, follow-ups. Marks task done. |
| 5 | `_05_REVIEW_<NNN>_<slug>.md` | Cowork | (post-mortem) | Asynchronous review. May arrive hours or days later. Captures lessons, regressions caught downstream, rule updates. |

## Naming convention

```
_<step>_<TYPE>_<NNN>_<slug>.md
```

- `<step>` = 2-digit phase number: `01`, `02`, `03`, `04`, `05`.
- `<TYPE>` = literal phase name: `PROMPT`, `PLAN`, `EXEC`, `REPORT`, `REVIEW`.
- `<NNN>` = 3-digit goal number, monotonically increasing across the channel: `001`, `002`, `003`, ... A single goal owns one `<NNN>` and all 5 files share it.
- `<slug>` = kebab-case description, lowercase, no spaces, no diacritics. Concise: `sql-side-upsert-refactor`, `wave-2-mapping-seed`, `mfa-totp-ui`.

Examples:

```
_01_PROMPT_001_sql-side-upsert-refactor.md
_02_PLAN_001_sql-side-upsert-refactor.md
_03_EXEC_001_sql-side-upsert-refactor.md
_04_REPORT_001_sql-side-upsert-refactor.md
_05_REVIEW_001_sql-side-upsert-refactor.md
```

## Gate rules

Hard constraints — violations break the protocol and require restart of the round:

- **EXEC must not begin** until the supervisor has explicitly authorized the PLAN. No silent advance.
- **Authorization is explicit and in-chat**, not implicit. The supervisor confirms with a message like `"PLAN 001 approvato, procedi con EXEC"` or `"PLAN 001 approved — execute"`. A neutral `"ok"` or reaction is not sufficient.
- **The PLAN may be revised**: if Cowork requests changes, the executor updates `_02_PLAN_<NNN>_*.md` in place and waits for re-authorization. PLAN history lives in `git log` of that file.
- **REPORT closes the task** from the executor side. After REPORT, the executor stands down on that goal and awaits the next PROMPT.
- **REVIEW is asynchronous**: it may arrive within minutes, hours, or days. Its absence does not block the next goal — the channel proceeds to `<NNN+1>`.
- **One active goal at a time** is the default. If two goals must run concurrently (different `<NNN>`), each must be independently in a non-conflicting EXEC phase; this is rare and should be flagged in the second PROMPT.

## Git policy

- **All `_0X_*.md` files are committed** to the repo. The exchange directory is a permanent audit trail and a historical reconstruction surface, not transient scratch.
- **No `.gitignore` entry** excludes `cowork_code_exchange/`. If a future contributor proposes one, refuse and point at this section.
- Commit signature for these files follows the CLI convention: `chore(cowork): _0X_TYPE_NNN_slug — short summary`. The executor commits its own files (PLAN, EXEC, REPORT); the supervisor commits PROMPT and REVIEW.
- The dir initialization (this `README.md` plus the empty directory) is committed by the supervisor, typically together with the first `_01_PROMPT_001_*.md`.

## First active goal

**TBD — Goal A audit-wiring + SQL-side UPSERT refactor (in arrivo).**

Reference: §8.B of `MIGRATION_STATUS_2026-05-18.md` (sibling file at repo root). The first PROMPT is expected to scope:

- SQL-side `executeUpsert` refactor (`apps/api/src/modules/brownfield-wave-executor/engine.ts`),
- audit-table wiring (`audit.import_run_logs`, `audit.import_validation_results`, `audit.import_approval_decisions`),
- `failure_reason` persistence on every FAILED state transition,
- acceptance: full-scale 47k-row Wave 1 run reaches `state=COMPLETE` with `sys_skills ≥ 5000` + lineage 1:1 in ≤10min, vitest 218/219 still green.
