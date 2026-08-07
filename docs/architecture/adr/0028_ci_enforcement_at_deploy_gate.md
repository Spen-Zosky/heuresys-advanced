# ADR-0028 — CI enforcement point: deploy gate, not branch-protection required checks

**Status**: Accepted (S1023, 2026-07-21)
**Context**: D-08 F4 (epic spec `docs/kb/improvement/EPICS_SPEC_S1022.md`)
**Decision authority**: Claude (technical decision per `feedback_claude_decides_technical`, S1022)

## Context

The D-08 epic called for extending the `main-protection-tier1` ruleset with
`required_status_checks` (starting with typecheck+lint). The measured state at
decision time: the ruleset carries `deletion` + `non_fast_forward` only; all
commits land on `main` directly (solo-maintainer direct-to-main doctrine — the
`handoff` skill pushes docs-only commits to main at every session close).

## Problem

GitHub required status checks are evaluated **before** a ref update is
accepted. Two structural conflicts with this repo's working model:

1. **Chicken-and-egg on direct pushes**: a freshly-created sha cannot have
   check results before it is pushed anywhere, so a direct push to a
   protected `main` is rejected outright. Required checks de facto force a
   PR-based (or stage-branch) flow for EVERY change.
2. **Docs-only pushes produce no checks at all**: every heavy workflow uses
   `paths-ignore: docs/**, *.md, .handoff/**, …`. A handoff commit would
   never receive the required check runs → its push would be blocked
   permanently (a required check that never reports is "expected → blocked").

Switching the whole doctrine to PR-flow would tax every session close with
PR + wait + merge mechanics, with no protection gain for a solo repo whose
real exposure is *what reaches PROD*, not *what transiently sits on main*.

## Decision

- The ruleset stays **without** `required_status_checks` (still active:
  `deletion`, `non_fast_forward`).
- CI-green is enforced at the **consumption point**: `scripts/ci-gate.sh`,
  invoked by `scripts/vm-deploy.sh` **before any mutation** of the PROD box.
  Semantics: red run on the deployed sha → abort; CI in flight → bounded
  wait; docs-only sha with no runs → the latest completed run of each key
  workflow (`test-integration`, `playwright-smoke`, `build-web`, `typecheck`,
  `lint`) on main must be `success`. Fail-closed on API errors.
  Bypass: `DEPLOY_REQUIRE_CI=0`, loud, for emergencies only.

## Consequences

- `main` may transiently carry a red commit; **PROD cannot receive it** —
  the gate blocks the deploy until CI is green again (R3 already obliges
  fixing any red immediately; the gate turns that doctrine into a mechanism).
- A standing red on main also blocks docs-only deploys (fallback path) —
  deliberate: it makes a lingering red CI operationally unignorable.
- No change to the session-close handoff mechanics.
- If the working model ever moves to PR-flow (e.g. collaborators join),
  revisit: required checks become viable and this ADR should be superseded.

---

## Amendment — S1049, 2026-08-07 (#165): the gate moves OUT of the session close

**What was wrong**: nothing about *where* CI is enforced — the consumption point is still
the right one. What was wrong is *who waits for it*. The gate sat inside `vm-deploy.sh`,
`vm-deploy.sh` inside the close propagation, and the close inside a human session. So the
"bounded wait" of `ci-gate.sh` (up to `CI_GATE_WAIT=900s`, polling) was paid by **Enzo**,
holding a session open to watch a check that needs nobody to watch it.

Measured at S1048 (`gh run list`, real durations): `Playwright smoke` 13.7 min mean /
23.2 max · `Test (api integration)` 8.7/18.9 · `Lint` 7.7/12.5 · `Typecheck` 6.2/12.4 ·
`State lint` 4.6/12.6 · `CodeQL` 3.5/3.6 — on **one** self-hosted runner, so they queue:
a full round is **20-30 minutes**. The close itself is a few minutes.

**Amended decision** — the enforcement point is unchanged; the *waiting* is relocated:

1. **The session close ARMS, it does not deploy.** `close-propagate.sh --auto-deploy`
   pushes `refs/heads/prod` at the just-pushed sha and returns. Cost: one push.
2. **A watcher deploys.** `scripts/deploy-watch.sh`, driven by
   `heuresys-advanced-deploy-watch.timer` (every 5 min) on the VM and linux-pc, deploys
   when — and only when — `origin/prod == origin/main`, that sha differs from the box's
   `LAST_GOOD_SHA`, and `ci-gate.sh` reports green. It runs the **same gate**, unchanged.
3. **`ci-gate.sh` gains a non-blocking mode** (`CI_GATE_NONBLOCKING=1`): PENDING exits
   **75** (`EX_TEMPFAIL`) instead of sleeping. 75 is distinct from both 0 and 1 on purpose
   — folding it onto 0 would deploy an unverified sha, folding it onto 1 would light up
   `systemctl --failed` every five minutes while CI merely does its job.

**Why ARMED and not "deploy every green main"**: the simpler continuous-deployment reading
would silently defeat the S1030 veto (`HEURESYS_CLOSE_NODEPLOY=1`, which keeps the
unattended `zero-pending-loop` from shipping to PROD at 03:00 with nobody watching), and
would also deploy mid-session pushes — in S1048 that would have been **three** PROD deploys
instead of one. With arming, a caller that must not deploy simply does not arm: the veto is
preserved *by construction*, not by prose.

**Accepted edge case**: if a session arms and the next session pushes before the timer
fires, `main` moves past `prod` and the armed deploy no longer happens. That is the correct
direction to fail — PROD never receives something nobody authorized — and the next close
re-arms by itself.

**Unchanged**: the gate semantics (red → abort, docs-only → latest key workflows green,
fail-closed on API errors, `DEPLOY_REQUIRE_CI=0` loud bypass), and `--deploy-now` on
`close-propagate.sh` still performs the old synchronous deploy for whoever wants to watch.
