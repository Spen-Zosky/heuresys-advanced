# _00_SESSION_HANDOFF_2026-05-19.md

**Purpose**: state-passing from this Cowork Desktop session (claude.ai Desktop, Windows) to the next Cowork session AND to Claude Code CLI for autonomous continuation.
**Author**: Cowork Desktop, 2026-05-19 ~01:35 GMT+2
**Audience**: next supervisor instance + executor reading cold without conversational context.
**Read order recommendation**: §1 executive state first; §2 what to do RIGHT NOW (CLI side); §3 if Cowork resumes; §4 if anything broke.

---

## §1 — Executive state

**Inherited from**: `_00_SESSION_HANDOFF_2026-05-18.md` (previous web Cowork) + 5 PLAN revisions + 1 rejected closure of Goal 001a.

**This session delivered (2026-05-19, ~01:30 turns Cowork-side)**:

1. **Goal 001 fully closed** with retrofit: STATE 001 → `current_phase: CLOSED`, fresh APPROVAL v5 signing canonical PLAN sha `e093ad82…`. Handoff O3 closed.
2. **Goal 002 prepared end-to-end**: DISCOVERY 002 (12 sections, SSH-verified facts on 759 JSON_EXTRACT + 93 LINEAGE_SOURCE_NK + 49 LOOKUP_FK + 3 no-UQ tables resolved + pg_stat_statements enabled + fresh pg_dump), PROMPT 002 (all B1/B2/B3/C1 decisions locked, G11 cross-check applied).
3. **Migration 000031 created + applied + tracked** (id=384, sha `9a1fec95…`): adds UQ on sys_user_certifications, eliminating `no_conflict_inference_available` skip for Wave 1.
4. **`pg_stat_statements` enabled** on `oracle-vm-default` cluster (postgresql.conf edit, cluster restart 2s zero-impact, extension installed at 1.10).
5. **Protocol v2.2 codified** with 8 structural rules R1-R8 + concurrency model §-1:
   - R1 Ownership matrix (Cowork NEVER commits/pushes; CLI is only git-write party)
   - R2 Activity locks (informational, not gating)
   - R3 STATE = atomic single sync surface (read → compute → write atomically via rename)
   - R4 `.gitattributes` EOL normalization
   - R5 Pre-commit hook auto-sanitization (strip nulls + renormalize + orphan-lock cleanup + validator)
   - R6 Pending-manifest pattern (Cowork prepares JSON + msg files; CLI consumes via `apply-pending.mjs`)
   - R7 Concurrency model in README §-1 (90/9/1 topology)
   - R8 Inbox messaging system (.inbox/{cowork,cli}/{pending,read}/ + auto-detection + chain tracker)
   - G12 (new gate): Cowork NEVER commits or pushes
6. **Scripts installed under `scripts/cowork-exchange/`**: new-goal, validate-naming (v2.2 with inbox check), status, install-hooks, locks (acquire/release/renew/check), inbox (list/mark-read/rebuild-index), notify (emit message), session-start (no-open-chains detector), apply-pending (CLI consumer).
7. **Pending-manifest ready**: `cowork_code_exchange/.cowork-pending-commits.json` + 6 message files in `.cowork-pending-commits/` — covers the entire session's commit chain (migration 000031 + .gitattributes + protocol v2.2 + Goal 001 retrofit + Goal 002 prep + forensic docs).

**Where we are now**:
- Cowork sandbox CANNOT commit (R1 enforced + observed `.git/index.lock` lock from Windows side throughout the session — this is the conflict that triggered the v2.2 rewrite).
- 14 commits ahead of `origin/main` from the previous session remain unpushed.
- 6 new commits queued in the pending-manifest, also unpushed.
- Inbox: 1 `prompt_ready` message for goal 002 in `.inbox/cli/pending/` waiting for CLI to consume.

---

## §2 — What CLI does at next session-start (the entire chain in one shot)

**Single-command finalization** (recommended):

```powershell
# From repo root D:\heuresys-advanced
pnpm cowork:session-start
```

This will show:
- Goals: 001=CLOSED, 002=PROMPT (next: CLI)
- Locks: both INACTIVE
- Inbox: cowork=0, cli=1
- CHAIN STATUS: 2 open chains (002 PROMPT awaiting PLAN + 1 inbox message)

Then CLI should run:

```powershell
# Read the inbox message
pnpm cowork:inbox cli
# (shows: PROMPT 002 ready, next-expected: plan_ready)

# Apply Cowork-prepared commits (R6 pending-manifest)
pnpm cowork:apply-pending
# applies 6 commits + pushes to origin/main
# emits .inbox/cowork/pending/<ts>__pending_applied.md to notify Cowork

# Mark inbox prompt_ready as read
pnpm cowork:inbox -- --read 2026-05-18T23-10-02Z__002__prompt_ready.md

# Verify final state
pnpm cowork:status
pnpm cowork:validate
```

Expected result after these steps:
- `origin/main` is at HEAD + 20 commits (14 from previous session + 6 from this session)
- Working tree is clean (or has only pre-existing `docs/source_bundle/*.csv` modifications that pre-date this session)
- Goal 002 STATE shows `current_phase: PROMPT, next_actor: CLI` ready for PLAN production
- inbox cli/pending: 0, cowork/pending: 1 (the pending_applied ack — Cowork will mark-as-read at next session)

**Then CLI proceeds to produce `_02_PLAN_002_json-extract-lineage-fullscale.md`** per the PROMPT 002 specification, with:
- G11 cross-check applied (every §2.2 step ↔ ≥1 §2.6 criterion)
- Turn budget 40 (escalation at 38)
- All decisions B1/B2/B3 already locked (no questions to ask)
- Migration 000031 applied + pg_stat_statements enabled = no "no_conflict_inference_available" + telemetry available

When PLAN ready, CLI emits:
```powershell
pnpm cowork:notify cowork plan_ready --goal 002 \
  --ref cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md \
  --expected approval_ready
```

Then CLI waits for Cowork to write APPROVAL (or for direct EXEC start if Cowork is online).

---

## §3 — If Cowork resumes (next claude.ai Desktop session)

```
1. node scripts/cowork-exchange/session-start.mjs --party cowork
   (or `pnpm cowork:session-start --party cowork`)
2. Inspect inbox cowork pending: there should be a `pending_applied` message
   from CLI confirming the manifest commits landed.
3. node scripts/cowork-exchange/inbox.mjs --read <pending_applied filename>
4. Check goal 002 STATE: if CLI has produced PLAN 002, generate APPROVAL.
5. node scripts/cowork-exchange/notify.mjs cli approval_ready --goal 002 ...
6. Continue normal supervision.
```

If CLI hasn't yet produced PLAN 002 (still in PROMPT phase), Cowork simply waits — chain is open, CLI is the next actor.

---

## §4 — If something broke (recovery procedures)

### Pending manifest failed to apply

If `pnpm cowork:apply-pending` fails partway:
- Manifest remains at `.cowork-pending-commits.json`
- A `pending_apply_failed` message is emitted to `.inbox/cowork/pending/`
- Re-run `pnpm cowork:apply-pending` after fixing the underlying cause (e.g., merge conflict resolved, git lock cleared)
- The script is idempotent: `git add` followed by `git diff --cached` check skips commits already applied

### Encoding / EOL drift after `.gitattributes` lands

First push with `.gitattributes` may cause `git status` to show large numbers of modified files (renormalization). This is expected. Run `git add --renormalize .` followed by `git commit -m "chore: gitattributes renormalize"` to capture the EOL normalization in one commit.

### Validator reports orphan locks

```powershell
pnpm cowork:check-locks
# if STALE or ORPHAN_PRUNE_CANDIDATE, the pre-commit hook auto-removes them
# manually: rm cowork_code_exchange/.cowork-active.lock or .cli-active.lock
```

### Inbox message in wrong directory

If a message accidentally lands in wrong inbox: `git mv` to correct path, edit frontmatter `to:` field, regenerate INDEX via `pnpm cowork:inbox:rebuild`.

---

## §5 — Key artefact paths (canonical, R1-compliant)

| Artefact | Path | Owner |
|---|---|---|
| Protocol SoT | `cowork_code_exchange/README.md` (v2.2) | Cowork-write, CLI-commit |
| Validator | `scripts/cowork-exchange/validate-naming.mjs` | Cowork-write, CLI-commit |
| Pending manifest (this session) | `cowork_code_exchange/.cowork-pending-commits.json` | Cowork-write, CLI-consumes-and-archives |
| Commit messages (this session) | `cowork_code_exchange/.cowork-pending-commits/msg-NN-*.txt` | Cowork-write |
| Inbox structure | `cowork_code_exchange/.inbox/{cowork,cli}/{pending,read}/` | atomic move on read |
| Activity locks (if active) | `cowork_code_exchange/.{cowork,cli}-active.lock` | acquire/release by party |
| Goal 002 active artefacts | `_00_DISCOVERY_002`, `_00_STATE_002`, `_01_PROMPT_002` | Cowork-write |
| Goal 002 PLAN (to be produced) | `_02_PLAN_002_json-extract-lineage-fullscale.md` | CLI-write |
| Goal 001 closed artefacts | `_05_REVIEW_001a`, `_04_REPORT_001a`, EXEC log, PLAN canonical + 2 archives | committed |
| Migration 000031 | `db/migrations/000031_add_uq_sys_user_certifications.sql` (applied + tracked id=384) | committed via manifest |

---

## §6 — Honest variance from the session start intent

**What I (Cowork Desktop) intended to do at session start**: read priming docs, identify Goal 001b scope (now Goal 002), produce PROMPT, hand off to CLI for PLAN.

**What I actually did, in order**:
1. Investigated session state → Goal 001a in progress with v3-bis approved, then v4, then v5 closure attempt rejected (interim REPORT), then v5 final REPORT + REVIEW closed (all from previous Cowork web session).
2. Built protocol v2 from scratch (DISCOVERY/APPROVAL phases + STATE + inbox concept + templates + 4 Node scripts + hook) — was ~30 turns.
3. After observing Cowork-CLI concurrency conflicts (`.git/index.lock`, null-byte truncation in Write tool, file-watcher cache stale), pivoted to protocol v2.2 with 8 structural rules.
4. Created migration 000031 + enabled pg_stat_statements + fresh pg_dump backup on the live VM.
5. Produced DISCOVERY 002 via SSH (corrected initial assumption that 3 tables lacked UQ — turned out only 1 did) + PROMPT 002.
6. Prepared pending-manifest with 6 atomic commits + 6 message files.
7. Emitted `prompt_ready` inbox message for CLI.
8. Wrote this handoff.

**Total Cowork-side effort**: ~50 supervisor-turns equivalent. No git commits or pushes performed by Cowork (R1 enforced).

**Cumulative bias-catalog additions** (per Goal 001a REVIEW pattern):
- **CW-B9**: assumed Cowork could commit; observed that `.git/index.lock` is held by Windows file-watcher even when CLI is idle. Lesson encoded in R1 + G12.
- **CW-B10**: assumed Write tool produces clean text; observed null-byte padding + truncation when overwriting files. Lesson encoded in R5 strip-null in pre-commit.
- **CW-B11**: assumed STATE updates from both sides could race-stomp; encoded R3 atomic write protocol.
- **CW-B12**: pivoted protocol mid-session when concurrency reality became clear, instead of stopping at v2.1 + workaround. The v2.2 design is durable across all 90/9/1 topology modes.

---

## §7 — Next supervisor: 3-minute orientation

1. Read `cowork_code_exchange/README.md` §-1 (concurrency model) and §-0 (R1-R8 rules). 5 min.
2. Run `pnpm cowork:session-start --party cowork`. 30 sec.
3. Check inbox for `pending_applied` ack and any new CLI messages. 1 min.
4. Read STATE for Goal 002 (the only open goal). 2 min.
5. Decide next action: write APPROVAL (if PLAN 002 ready), wait (if CLI in EXEC), or REVIEW (if 002 closing).

That's it. The protocol is now self-documenting via STATE + inbox + CHAIN STATUS.

---

*End of _00_SESSION_HANDOFF_2026-05-19.md*
