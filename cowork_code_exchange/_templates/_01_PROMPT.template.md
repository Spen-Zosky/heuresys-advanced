# _01_PROMPT_<NNN>_<slug>.md

**Protocol phase:** PROMPT (supervisor → executor)
**Goal ID:** <NNN>
**Slug:** <slug>
**Created:** YYYY-MM-DD, by Cowork (supervisor)
**Target executor:** Claude Code CLI on <Windows | Mac | VM>
**Predecessor artefacts:**
- `_00_DISCOVERY_<NNN>_<slug>.md` (facts baseline, committed at `<sha>`)
- `_00_STATE_<NNN>.md` (current state)
- [any other predecessor docs]

---

## ⚠️ CRITICAL — Protocol rule for this turn

**Your output for this turn MUST be `_02_PLAN_<NNN>_<slug>.md`, not execution.**

This is the PROMPT phase of the cowork_code_exchange v2 protocol. Your next deliverable is the detailed execution plan — written but not executed. After Cowork reviews and explicitly approves the PLAN (an `_02b_APPROVAL_<NNN>.md` file appears in this directory referencing your PLAN's sha256), then and only then you produce `_03_EXEC_<NNN>_<slug>.md` (action log) and `_04_REPORT_<NNN>_<slug>.md` (closure report).

**Do NOT** start coding in this turn. Do NOT touch the DB. Do NOT run tests. Output is **markdown only**, saved at the PLAN path.

---

## Task scope (verified facts from DISCOVERY)

(Reference `_00_DISCOVERY_<NNN>_<slug>.md` by section. Restate only the facts the executor needs in-context, not the entire discovery.)

### Problem 1 — <name>
- ...
- Required transformation: ...

### Problem 2 — <name>
- ...

(One problem per major code/DB concern. Problems interlock when they cannot be verified in isolation; declare that explicitly.)

---

## Out of scope

The PLAN must explicitly mark these as out-of-scope to prevent scope creep:

- ...
- ...

---

## Constraints — boundaries of any acceptable PLAN

### Code change boundaries

The PLAN may propose changes to files in these paths:
- `apps/api/src/modules/<scope>/**`
- `apps/api/src/modules/<scope>/__tests__/**`

The PLAN must NOT propose changes to:
- `prisma/schema.prisma` (introspection only)
- ...

### DB write boundaries

The PLAN must specify exactly which DB objects will be written. Allowlist:
- ...

The PLAN must NOT propose writes to:
- ...

### Test boundaries

- `pnpm test` must continue to pass at ≥ <current baseline> (capture in EXEC step 0).
- ...

### Operational boundaries

- Backup gate: before any DB write, verify a pg_dump of `heuresys_advanced` exists with mtime ≤ 6 hours. If not, create fresh dump first.
- Git discipline: atomic commits per logical step. Each commit references Goal <NNN>.
- Turn budget: hard cap **<N>** turns. Escalation at turn `<N-2>` if §<acceptance> not entering final phase.

---

## Required structure of `_02_PLAN_<NNN>_<slug>.md`

The PLAN must contain these sections, in this order:

### §1 — Executive summary (max 10 lines)
Plain English, no code.

### §2 — Baseline capture plan
What you'll measure at EXEC step 0 (test baselines, DB snapshots, file SHAs). Each baseline gets a file path under `baselines/<NNN>-<topic>-<ts>.<ext>`.

### §3 — Code change plan
Per file: full path, current state, intended change, risk class, test coverage.

### §4 — DB write plan
Per object: schema.table, write type, trigger code path, expected row count, reversibility.

### §5 — Design detail (if any non-trivial subsystem)
Standalone section per such subsystem (e.g., transform compiler, audit writer).

### §6 — Decision points deferred to supervisor
Each as a choice with pros/cons + recommendation.

### §7 — Acceptance criteria
Bulleted, machine-checkable list. Each criterion verifiable from EXEC output.

### §8 — Turn budget breakdown
Allocate the cap across proposed steps. If you think the cap is too tight, say so for negotiation.

### §9 — Risk register
Top 5 risks. Per risk: probability, impact, mitigation.

### §10 — Rollback plan
Per commit: exact `git revert`/`git reset` command. For DB: confirm pg_dump restore command.

---

## After you write `_02_PLAN_<NNN>_<slug>.md`

1. Save the PLAN at `cowork_code_exchange/_02_PLAN_<NNN>_<slug>.md`.
2. Update `_00_STATE_<NNN>.md`: `current_phase: PLAN`, `plan_version: v1`, `plan_sha256: <computed>`, `next_actor: Cowork`.
3. Confirm completion in chat with a 5-10 line summary.
4. **Stop.** Wait for `_02b_APPROVAL_<NNN>.md` to appear or for Cowork to request PLAN revisions.

---

## Hard guard-rails for this PROMPT turn

1. NO code changes
2. NO DB writes
3. NO test execution
4. NO git operations (read-only OK for log/status/diff)
5. NO new SSH tunnels
6. Secret hygiene: no credentials in PLAN even sanitized
7. The PLAN is a read-only-on-environment artefact

*End of _01_PROMPT_<NNN>_<slug>.md*
