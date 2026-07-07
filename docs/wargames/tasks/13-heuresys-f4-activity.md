WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/architecture/adr/0027_two_axis_contextual_authorization.md §5 + docs/superpowers/specs/2026-06-30-two-axis-authorization-model-design.md §3-§5 (F4) + docs/superpowers/specs/2026-07-01-f3-sensitive-modules-map.md (historical) + docs/kb/SOT_BACKLOG.md (item #24) + apps/api/src/lib/scope/*.

Then fight the mission on paper, move by move, and write it to wargames/13-heuresys-f4-activity.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#24 F4 — the functional/activity axis** of the bi-axial authorization model (ADR-0027), the last remaining phase (F0-F3+F5+F6+I21 are DONE, 15 modules org-gated). Scope: the functional axis + activity endpoints (tasks / objectives / operational-KPIs / operational-approvals) + `sys_process_participants` (user-level process membership). This is the largest remaining piece — a new "activity" domain — and includes the cross-tree half of F5.

**THE OPEN PRODUCT FORK (Enzo has NOT decided — this is the heart of the wargame):** option A = a generic task model (new activity entities); option B = reuse of goals/approvals as activity carriers (design §4-§5). The wargame must fight BOTH routes to comparable depth, state the trigger that selects between them (= Enzo's explicit decision, plus any technical evidence that should inform it), and share every common move (recon, sys_process_participants wiring, taxonomy extension ACTIVITY→functional-axis) so no work is wasted whichever route is chosen.

Deliver (either route): activity read endpoints gated on the functional axis; `sys_process_participants` exposed; data-classes taxonomy extended (ACTIVITY → functional axis, per lib/scope/data-classes.ts design); scope tests proving functional-axis isolation; i18n it+en for any UI.

This item is currently HOLD `{kind: manual}` — the wargame turns Enzo's decision into a fork trigger instead of a blocker. Doc of record: ADR-0027 §5 + design spec 2026-06-30 §3.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm; db/migrations 167 files max 000169 at S1015 — re-derive live.
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. SoT wins over this brief.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433. Migrations twice-run idempotent (D-12); varchar+CHECK (RD-08); asserts by owned codes (D-38).
- AuthZ: boot-gate D-51 — extending the taxonomy means new routes MUST declare config.orgGate (or the functional-axis equivalent this mission introduces) or boot fails; design the gate extension explicitly.
- Tests under per-file tx isolation (D-52); full API suite 0 fail; scope tests with live-derived expectations.
- Done means: typecheck · lint · i18n parity · full suite green · CI 6/6 · vm-deploy · LIVE verification on www.heuresys.com.
- The A-vs-B choice and any taxonomy semantics are Enzo's authority: fork with trigger, never pre-decide.
