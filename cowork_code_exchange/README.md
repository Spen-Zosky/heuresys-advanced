# Cowork ↔ Claude Code CLI exchange directory — v2.2

> **Protocol version**: 2.2 (2026-05-19)
> Replaces v2.1 by adding the **Concurrency model + 8 structural rules R1-R8** that make Cowork/CLI cooperation safe under the real operational topology (CLI working ~90% alone, Cowork+CLI simultaneous ~9%, Cowork alone ~1%).
> Authoritative project-level SoT. Skill `cowork-cli-orchestrator` (claude.ai Desktop) aligns to this document, not vice versa.

---

## §-1 — Concurrency model (read this FIRST)

### Operational topology (observed reality)

| Mode | Frequency | Description |
|---|---|---|
| **CLI-only autonomous** | ~90% | Claude Code CLI on Windows works on the repo without Cowork active. Cowork sessions may be hours/days old |
| **Cowork + CLI simultaneous** | ~9% | Both active concurrently on the same `D:\heuresys-advanced\` working tree. CLI = executor, Cowork = supervisor/orchestrator |
| **Cowork-only** | ~1% | Cowork active, CLI idle. Rare; usually planning + DISCOVERY phases |

In **every** mode the role assignment is fixed:

- **CLI is the executor**: all `git commit`, `git push`, code changes (`apps/**`, `db/**`, `scripts/**`), and EXEC/REPORT artefacts
- **Cowork is the orchestrator/supervisor**: DISCOVERY, PROMPT, APPROVAL, REVIEW, STATE updates, planning docs

Cowork **never** commits and **never** pushes. Cowork prepares artefacts in the filesystem; CLI consumes them at its next session-start (or during simultaneous work) and persists them via git.

### Why this matters: classes of conflict that the rules prevent

| Class | Cause | Symptom observed | Fix |
|---|---|---|---|
| C1 git index lock | Cowork sandbox + CLI Windows compete on `.git/index.lock` | "Unable to create .git/index.lock: File exists" from Cowork | R1 (Cowork doesn't commit) + R6 (pending-manifest pattern) |
| C2 9p cache stale | Cowork sandbox sees stale state after CLI write | wc reports old size; readback shows obsolete content | R3 (STATE-as-sync, read before write) + R5 (post-commit normalize) |
| C3 Editor file handle | Notepad++/IDE Windows holds file open | `rm .git/index.lock` -> "Operation not permitted" | R6 (Cowork doesn't operate on `.git/` at all) |
| C4 Shared-artefact race | Both modify `_00_STATE_NNN.md` or EXEC log | PLAN v2/v3 lost before commit | R1 (ownership matrix) + R3 (atomic write via temp+rename) |
| C5 Encoding/EOL drift | CRLF vs LF, null padding from Write tool | README truncated, validate-naming.mjs corrupted | R4 (`.gitattributes`) + R5 (pre-commit strip nulls + normalize) |
| C6 Mute dependency | Cowork computes sha256 while CLI is writing | sha drift `f6919b79` vs `e093ad82` | R8 (inbox messaging: explicit handover instead of polling) |

### The 8 structural rules (R1-R8)

The rules are listed below in §-0.1 to §-0.8. Each rule has a "what it solves" + "where it's implemented" reference.

---

## §-0 — The 8 structural rules

### R1 — Ownership matrix (who writes what, no exceptions)

| Path / file | Cowork | CLI | Shared (atomic) |
|---|---|---|---|
| `cowork_code_exchange/_00_DISCOVERY_*.md` | write | read | — |
| `cowork_code_exchange/_01_PROMPT_*.md` | write | read | — |
| `cowork_code_exchange/_02_PLAN_*.md` (canonical) | sometimes write (amendments via Cowork) | write (initial + commits archives) | — |
| `cowork_code_exchange/_02_PLAN_*_v<N>.md` (archive) | — | write (`git mv`) | — |
| `cowork_code_exchange/_02b_APPROVAL_*.md` | write | read | — |
| `cowork_code_exchange/_03_EXEC_*.md` + `.events.jsonl` | read | write | — |
| `cowork_code_exchange/_04_REPORT_*.md` (+ `_interim`) | read | write | — |
| `cowork_code_exchange/_05_REVIEW_*.md` | write | read | — |
| `cowork_code_exchange/_00_STATE_NNN.md` | — | — | **shared atomic** (R3) |
| `cowork_code_exchange/baselines/*` | — | write | — |
| `cowork_code_exchange/.inbox/cowork/pending/*` | read | write | — |
| `cowork_code_exchange/.inbox/cli/pending/*` | write | read | — |
| `cowork_code_exchange/.inbox/*/read/*` | move-on-read by recipient | move-on-read by recipient | — |
| `cowork_code_exchange/README.md` + `_templates/*` | write | read | — |
| `cowork_code_exchange/_SKILL_UPDATE_MEMO.md` | write | read | — |
| `apps/**`, `db/**`, `scripts/**` (code) | propose via .cowork-pending or inbox | write | — |
| `git commit` on `main` | **NEVER** | always | — |
| `git push` to `origin/main` | **NEVER** | always | — |

**Implication**: Cowork operates purely in the filesystem layer (write markdown, propose code patches via pending-manifest). CLI is the only party that touches `.git/` directly.

### R2 — Activity locks (informational, not gating)

When both parties are active, each deposits a lockfile at session-start:

- `cowork_code_exchange/.cowork-active.lock` — written by Cowork
- `cowork_code_exchange/.cli-active.lock` — written by CLI

Lock content (YAML):

```yaml
pid: 12345
session_id: 2026-05-19T00-14-00Z
party: cowork | cli
started_at: 2026-05-19T00:14:00Z
expected_idle_at: 2026-05-19T01:14:00Z   # auto-renew every 15min while active
```

**Behavior**:

- Lock is **info, not hard gate**. Lock presence does not block writes — it informs the other party that its counterpart is active.
- Auto-expire if `now > expected_idle_at + 15min` (orphan cleanup by pre-commit hook R5).
- Released at clean session-end (Cowork: chat sign-off; CLI: process exit).
- Cowork before writing `_00_STATE_*` checks `.cli-active.lock`; if valid + recent, queues the update via `.cowork-pending-state-update.json` instead of direct write. CLI consumes the queue at next checkpoint.
- CLI before committing checks `.cowork-active.lock`; if valid + recent, waits 30s and retries up to 3x; if still locked, proceeds with a warning logged in EXEC.

### R3 — STATE file as single atomic sync surface

`_00_STATE_NNN.md` is the only file written by both parties. Update protocol:

1. **Read** current frontmatter + body
2. **Compute** new content (frontmatter merge, body append-only for `commits[]` / `halt_reasons[]`)
3. **Write atomically** via temp + rename: `write tmp; rename tmp -> dest` (POSIX atomic on same filesystem)
4. **Verify** readback (mtime + size + first/last line match)

Cowork-side STATE updates (only these fields):

- phase transitions: `current_phase` -> any non-EXEC value
- `plan_version`, `plan_sha256` (after Cowork's APPROVAL emission)
- `decisions_locked` (when locking B-decisions)
- `db_writes_executed` append (when Cowork executes preparatory DB writes)

CLI-side STATE updates (only these fields):

- `turn_consumed` (increment)
- `halt_count` / `halt_reasons` (append)
- `commits[]` append
- `current_phase` -> EXEC, EXEC_<resume>, REPORT
- `last_event_ts`, `last_event_summary`, `last_event_actor`

Fields with both parties append: use last-writer-wins on scalar, merge on arrays. Bodies (markdown narrative below frontmatter) are append-only per party — no mid-section edits.

### R4 — `.gitattributes` for EOL + binary normalization

File at repo root with rules:

```
* text=auto eol=lf

cowork_code_exchange/** text eol=lf
scripts/cowork-exchange/** text eol=lf
db/migrations/** text eol=lf
*.mjs text eol=lf
*.md text eol=lf

*.ps1 text eol=crlf
*.bat text eol=crlf
*.cmd text eol=crlf

*.dump binary
*.pem binary
*.png binary
*.jpg binary
```

Implication: Cowork sandbox sees LF on everything it edits. Notepad++ Windows may save CRLF — `.gitattributes` normalizes at commit (R5 pre-commit hook double-checks).

### R5 — Pre-commit hook with auto-sanitization

`scripts/cowork-exchange/hooks/pre-commit` extends the warn-only validator with:

1. **Null-byte strip** on all staged files in `cowork_code_exchange/` + `scripts/cowork-exchange/` (Cowork Write tool padding bug workaround)
2. **EOL normalize** per `.gitattributes` (`git add --renormalize` on staged paths)
3. **Orphan-lock cleanup**: remove `.cowork-active.lock` / `.cli-active.lock` where `expected_idle_at < now - 15min`
4. **Naming + inbox validator** (R8 integration): runs `validate-naming.mjs` which now also checks `.inbox/` consistency
5. **Warn-only by default**; strict via `COWORK_EXCHANGE_STRICT=1` env

### R6 — Pending-manifest pattern (Cowork → CLI handover)

When Cowork prepares a bundle of artefacts that need committing, CLI handles the actual commit operations:

1. Cowork writes `cowork_code_exchange/.cowork-pending-commits.json` listing proposed commits:

```json
{
  "generated_by": "Cowork Desktop",
  "generated_at": "2026-05-19T00:14:00Z",
  "session_id": "...",
  "commits": [
    {
      "title": "feat(db): migration 000031 -- UNIQUE INDEX on sys.sys_user_certifications",
      "paths": ["db/migrations/000031_add_uq_sys_user_certifications.sql"],
      "message_file": ".cowork-pending-commits/msg-001.txt"
    },
    ...
  ],
  "push_after": true,
  "push_target": "origin/main"
}
```

2. Cowork writes message bodies to `.cowork-pending-commits/msg-NNN.txt` (one per commit)
3. Optionally Cowork writes `scripts/cowork-exchange/finalize-session-YYYY-MM-DD.ps1` as a direct fallback executable
4. CLI at next session-start runs `pnpm cowork:apply-pending` which:
   - reads the manifest
   - executes each commit in order via `git add + git commit -F msg-file`
   - pushes if `push_after: true`
   - removes the manifest + msg files
   - emits `.inbox/cowork/pending/<ts>__pending-applied.md` to notify Cowork

### R7 — Concurrency model = §-1 of this README

This section. The other rules reference it. Each future session of Cowork or CLI MUST read §-1 + §-0.x first.

### R8 — Inbox messaging system (Cowork ↔ CLI chain tracker)

Structured filesystem-based messaging that lets each party detect "I have unread messages" and "is the chain open".

**Layout**:

```
cowork_code_exchange/.inbox/
  cowork/                                    # messages FOR Cowork (written BY CLI)
    pending/
      2026-05-19T10-30-12Z__002__exec-halt.md
    read/
      2026-05-18T22-34Z__001__migration-applied.md
  cli/                                       # messages FOR CLI (written BY Cowork)
    pending/
      2026-05-19T00-50Z__002__prompt-002-ready.md
    read/
  INDEX.md                                   # dashboard auto-generated by `cowork:inbox`
```

**Naming convention**: `<ISO-ts-with-dashes>__<NNN>__<slug>.md`

**Message frontmatter**:

```yaml
---
from: cli | cowork
to: cowork | cli
goal_id: 002
kind: prompt_ready | plan_ready | approval_ready | exec_started | exec_halt
      | exec_progress | report_ready | report_rejected | review_ready
      | session_handoff | question | answer | ack | pending_applied
ref_files:
  - cowork_code_exchange/_03_EXEC_002_*.md
  - apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts
created_at: 2026-05-19T10:30:12Z
read_at: null
acknowledged_by: null
expected_response_kind: plan_amendment | acknowledge | approve | reject
expected_response_by: null
---

# Subject (one-line)

Body markdown <= 50 lines. Larger context: link via ref_files.
```

**Mark-as-read protocol**: `git mv .inbox/<party>/pending/<file> .inbox/<party>/read/<file>` + optionally edit frontmatter `read_at` + `acknowledged_by`.

**Canonical chain rules** (which kind triggers which response):

| Trigger (sender → receiver) | Expected next action | Chain closes when |
|---|---|---|
| `prompt_ready` (Cowork → CLI) | produce PLAN, send `plan_ready` | `plan_ready` received |
| `plan_ready` (CLI → Cowork) | review, send `approval_ready` or `plan_amendment_requested` | APPROVAL persisted |
| `approval_ready` (Cowork → CLI) | start EXEC, optional `exec_started` ack | EXEC log first turn |
| `exec_halt` (CLI → Cowork) | review halt, send PLAN amendment | PLAN sha changes |
| `exec_progress` (CLI → Cowork) | info-only, optional ack | — |
| `report_ready` (CLI → Cowork) | review, send `review_ready` or `report_rejected` | REVIEW persisted or REPORT renamed `_interim.md` |
| `review_ready` (Cowork → CLI) | acknowledge, STATE → CLOSED | STATE.current_phase = CLOSED |
| `session_handoff` (any → next session of same party) | read at next session-start, ack | next session reads + acks |
| `pending_applied` (CLI → Cowork) | acknowledge commits applied | — |

**Auto-population**: scripts that persist phase artefacts auto-emit the right message. E.g., when Cowork writes `_01_PROMPT_NNN_*.md`, the `cowork:notify-from-state` script (run as final step of the session-end checklist or invoked manually) generates the matching `prompt_ready` message in `.inbox/cli/pending/`.

**No-open-chains detection**: `pnpm cowork:status` (extended) computes:

```
Goals:
  001  CLOSED                            -> no work
  002  PROMPT pending (next: CLI)        -> 1 message in cli inbox
  003  EXEC_a (CLI working)              -> 0 messages, in-flight

Cowork inbox: 0 pending
CLI inbox:    1 pending (002/prompt-002-ready.md)

CHAIN STATUS: 1 open chain (002, awaiting CLI to produce PLAN)
```

When both inboxes = 0 AND all goals `current_phase in {CLOSED}` or `next_actor = null`: **global state "idle, no open chains"**. Both parties may exit/sleep.

When a new directive arrives from the user, it creates a fresh chain (typically `prompt_ready` from Cowork to CLI).

---

## Purpose

Structured handshake channel between **Cowork** (supervisor / architect, claude.ai Desktop) and **Claude Code CLI** (executor, Windows / Mac / VM). Paper trail + explicit authorization gate for work that exceeds ad-hoc chat:

- multi-file refactors that touch several modules at once
- risky DB migrations (DDL, data backfills, brownfield ingests)
- iterative build + test loops that need to be replayed or audited
- any task with a turn budget > 10 or estimated wall-clock > 1h

Opt-in per project: presence of this directory = repo participates; absence = routine direct-push workflow.

---

## Protocol v2.2 — the 7-phase round-trip (unchanged from v2.1)

```
   Phase 0 — DISCOVERY  (Cowork: facts only, no plan)             [strongly recommended]
       v
   Phase 1 — PROMPT     (Cowork: task + acceptance, cites DISCOVERY)
       v
   Phase 2 — PLAN       (CLI: execution plan, versioned)
       v
   Phase 2b — APPROVAL  (Cowork: signs PLAN sha256)               [persistent]
       v
   Phase 3 — EXEC       (CLI: running log)                        [suffix _a/_b/... on halt+resume]
       +-- Phase 3.events.jsonl  (parallel machine-readable stream)
       v
   Phase 4 — REPORT     (CLI: closure)                            [may rejected -> _interim.md]
       v
   Phase 5 — REVIEW     (Cowork: async post-mortem)
```

Aux always present per goal:

- `_00_STATE_<NNN>.md` (atomic shared, R3)
- `baselines/INDEX.md`
- `.inbox/{cowork,cli}/pending/...` (R8 inbox)
- `.cowork-active.lock` / `.cli-active.lock` (when respective party active, R2)

### What changed v2.1 → v2.2

- **Concurrency model §-1** added (was implicit, now explicit with 90/9/1 topology)
- **8 structural rules R1-R8** (was scattered, now consolidated)
- **R8 inbox messaging system** (NEW): auto-detection of unread messages, chain tracking, no-open-chains exit
- **R6 pending-manifest pattern** (NEW): Cowork prepares JSON manifest + finalize.ps1; CLI applies at session-start
- **R5 pre-commit hook** extended with null-strip + EOL normalize + orphan-lock cleanup
- **R4 `.gitattributes`** added (was implicit)
- **R3 STATE atomic write** codified (was implicit shared write)

---

## Phase definitions (unchanged from v2.1)

(see v2.1 README in git history at commit before v2.2 amendment for verbose phase tables; condensed here)

| Phase | Producer | Output | Key constraint |
|---|---|---|---|
| 0 DISCOVERY | Cowork | `_00_DISCOVERY_<NNN>_<slug>.md` | Facts only, no plan, <= 300 lines |
| 1 PROMPT | Cowork | `_01_PROMPT_<NNN>_<slug>.md` | Cites DISCOVERY, applies G11 cross-check, <= 300 lines |
| 2 PLAN | CLI | `_02_PLAN_<NNN>_<slug>.md` (canonical) + `_v<N>.md` archives | G11 cross-check applied |
| 2b APPROVAL | Cowork | `_02b_APPROVAL_<NNN>.md` or `_v<N>.md` | Frontmatter `plan_sha256` matches canonical |
| 3 EXEC | CLI | `_03_EXEC_<NNN><resume?>_<slug>.md` + `.events.jsonl` | Halt with explicit summary if scope drift |
| 4 REPORT | CLI | `_04_REPORT_<NNN>_<slug>.md` (canonical or `_interim`/`_partial`) | Time/turn variance vs PLAN |
| 5 REVIEW | Cowork | `_05_REVIEW_<NNN>_<slug>.md` | Mandatory sections (PLAN soundness, halt predictability, rule updates, variance, bias lessons) |

---

## Naming convention (canonical v2.2)

```
_<step>_<TYPE>_<NNN>[<resume>]_<slug>.md
```

Tokens: `<step>` in {00, 01, 02, 02b, 03, 04, 05}; `<TYPE>` uppercase phase name; `<NNN>` 3-digit goal counter monotone; `<resume>` a/b/c only on `_03_EXEC_*`; `<slug>` kebab-case.

Special variants:

```
_02_PLAN_<NNN>_v<N>.md            # archived PLAN versions
_02b_APPROVAL_<NNN>_v<N>.md       # fresh APPROVAL for revised PLAN
_04_REPORT_<NNN>_interim.md       # rejected closure, goal continues
_04_REPORT_<NNN>_partial.md       # accepted-with-known-gaps
```

Aux (no NNN, aggregates across goals):

```
_00_STATE_<NNN>.md
_00_SESSION_HANDOFF_<YYYY-MM-DD>.md
baselines/INDEX.md
baselines/<NNN>-<topic>-<ts>.*
_templates/*.md
.inbox/cowork/pending/<ts>__<NNN>__<slug>.md
.inbox/cli/pending/<ts>__<NNN>__<slug>.md
.cowork-active.lock
.cli-active.lock
.cowork-pending-commits.json
.cowork-pending-commits/msg-NNN.txt
RULE_UPDATES.md
RISK_REGISTER.md
_SKILL_UPDATE_MEMO.md
```

---

## Gate rules (v2.2)

| Gate | Rule | Enforcement |
|---|---|---|
| G1 | EXEC must not begin without `_02b_APPROVAL_<NNN>.md` matching current PLAN sha256 | validator warns; pre-commit blocks if `--strict` |
| G2 | Authorization persisted in APPROVAL artefact, not only in chat | same |
| G3 | PLAN canonical committed BEFORE overwriting by new version | validator-checkable via git log |
| G4 | REPORT closes executor side; may become `_interim.md` if Cowork rejects | convention |
| G5 | REVIEW async; absence doesn't block next goal | convention |
| G6 | One active goal per `<NNN>` value | new-goal script picks next free |
| G7 | STATE updated by every phase transition | validator: STATE.current_phase matches latest phase file |
| G8 | Halt-and-resume uses `_03_EXEC_<NNN><a/b/c>_<slug>.md`; original halt log preserved | convention + validator |
| G9 | Backup gate: any DB write requires pg_dump mtime <= 6h | PROMPT mandates; CLI verifies at EXEC step 0 |
| G10 | Turn budget cap declared in APPROVAL; CLI escalates at cap-2 | convention + STATE tracking |
| G11 | PROMPT/PLAN cross-check: every §2.2 step maps to >= 1 §2.6 criterion AND vice versa | discipline; Cowork attention pre-publish |
| G12 (v2.2) | Cowork NEVER commits or pushes; CLI is the only git-write party | R1 enforcement; validator can check git log author pattern |
| G13 (v2.2) | Inbox pending messages must be acknowledged by reader within reasonable time | informational warning in `cowork:status` |

---

## Tooling — `scripts/cowork-exchange/`

| Script | Invocation | Purpose |
|---|---|---|
| `new-goal.mjs` | `pnpm cowork:new-goal <slug>` | Scaffold next free NNN + STATE + DISCOVERY placeholder |
| `validate-naming.mjs` | `pnpm cowork:validate [--strict]` | Walks dir, verifies naming + sequence + APPROVAL↔PLAN sha + inbox consistency |
| `status.mjs` | `pnpm cowork:status [<NNN>]` | STATE summary + inbox pending + CHAIN STATUS |
| `install-hooks.mjs` | `pnpm cowork:install-hooks` | Install pre-commit hook (idempotent) |
| `inbox.mjs` | `pnpm cowork:inbox [cowork|cli] [--read <file>]` | List pending; mark-as-read by `git mv` |
| `notify.mjs` | `pnpm cowork:notify <to> <kind> --goal NNN [--slug ...] [--ref ...]` | Create new inbox message |
| `acquire-lock.mjs` | `pnpm cowork:acquire-lock <party>` | Write activity lock at session-start |
| `release-lock.mjs` | `pnpm cowork:release-lock <party>` | Remove activity lock at session-end |
| `check-locks.mjs` | `pnpm cowork:check-locks` | Report active locks + orphan candidates |
| `apply-pending.mjs` | `pnpm cowork:apply-pending` | CLI consumes `.cowork-pending-commits.json` |
| `session-start.mjs` | `pnpm cowork:session-start` | Wrapper: lock + status + inbox + suggest next or "no open chains" |
| `session-end.mjs` | `pnpm cowork:session-end <party> [--handoff] [--reason ...] [--commit-state]` | Validator + chain status + (opt) handoff message + lock release + final summary |

---

## Migration history

| Version | Date | Triggering | Summary |
|---|---|---|---|
| 1.0 | 2026-05-18 | Goal 001 init | 5-phase PROMPT/PLAN/EXEC/REPORT/REVIEW |
| 2.0 (transient) | 2026-05-18 | Goal 001 bundle | + DISCOVERY + APPROVAL + STATE + events.jsonl + baselines |
| 2.1 | 2026-05-19 | Goal 001a closure | PLAN versioning + REPORT_interim + G11 + Cowork-side preparatory section §13 |
| 2.2 | 2026-05-19 | Cowork/CLI concurrency reality | Concurrency model §-1 + R1-R8 structural rules + inbox messaging R8 + pending-manifest R6 |

---

## Open deferrals (carry-forward)

- Global skill `cowork-cli-orchestrator` still describes v1. Project-level README = SoT. Memo `_SKILL_UPDATE_MEMO.md`.
- Cross-project: same protocol applies in `heuresys-evo`. Each repo carries own README.
- JSONL dashboard rendering (future, deferred).
- Multi-machine: today single-machine (Windows). Mac/VM-hosted CLI sessions share via git push/pull on `cowork_code_exchange/`.

---

*Authoritative project-level SoT. Updates require commit `chore(cowork): README v2.x — <reason>` via CLI (R1/G12).*
