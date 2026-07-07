WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_STATE.md + docs/kb/SOT_BACKLOG.md (item #26) + docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L1 + the existing `goals` and `okrs` modules (read-only, shipped S999, mig 000142-144) + `/me/career` (3 sub-tabs, S1011) + apps/api/src/lib/scope/data-classes.ts.

Then fight the mission on paper, move by move, and write it to wargames/12-heuresys-goals-okr.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#26 A/L1 — the life of goals/OKRs** in heuresys-advanced. ~4.8k dormant rows (goal updates, check-ins, milestones, comments, alignments) must surface as read sub-resources + a timeline component in three places: `/goals`, `/okrs`, and the Obiettivi sub-tab of `/me/career`.

Deliver: read-only API sub-resources on goals/okrs (updates, check-ins, milestones, comments, alignments); a timeline UI in the three pages; self-scope reuse of `goal:read:self` (already seeded, 4 ESS roles, mig 000166); i18n it+en.

Notes from the SoT: `goal_subject_user_id` was backfilled to 632/1067 via `'LEGACY_EMP::'||goal_metadata->>'legacy_employee_id'` (S1011) — the remaining goals have no subject user; the timeline must render for both. EVALUATION data-class → orgGate on the org axis for non-self reads.

Estimated effort ~6-10h. Doc of record: docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L1.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm: apps/api (Fastify 5), apps/web (Next.js 16), packages/shared, db/migrations (167 files, max 000169 at S1015 — re-derive live).
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. If counts differ from this brief, the SoT wins.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433. Migrations twice-run idempotent (class D-12); varchar+CHECK not enums (RD-08); asserts scoped by owned codes (class D-38).
- AuthZ: ADR-0027 bi-axial; boot-gate D-51 refuses boot on undeclared sensitive read routes; `*-scope` tests with live-derived expectations for any org-gated route.
- Tests under per-file tx isolation (D-52); full API suite 0 fail.
- Done means: typecheck all ws · lint · i18n parity it+en · full API suite green · CI 6/6 · deploy `scripts/vm-deploy.sh` · verified LIVE on www.heuresys.com with a real login (timeline renders real rows on a goal with history AND on a goal without subject user).
- Product/scope decisions are Enzo's authority: mark as RECON NEEDED or fork, never invent.
