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
