WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_BACKLOG.md (item #34) + docs/product/DEVELOPMENT_LINES_B_ACTIVATE_DORMANT_CODE.md §B3 + apps/api/src/modules/approvals/effects/{registry,tenant-activation,index}.ts (S998 slice-3a) + the tenant-materialization module (WI-C, complete since S998).

Then fight the mission on paper, move by move, and write it to wargames/16-heuresys-approval-effects.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#34 B/B3 — new approval-effect handlers**: the first REAL approval flow in production. Today the effects registry has exactly one handler (`TENANT_ACTIVATION`, flips sys_tenancies PENDING_ACTIVATION→ACTIVE) and `sys_approval_requests` = 0 rows — the BPM engine is built but empty.

Deliver: a `TENANT_MATERIALIZATION` handler (the seam is ready: registry dispatch in `service.applyRequest` runs the handler in the SAME `withTransaction`, throw → `APPLY_EFFECT_FAILED` 409 rollback) that on approval invokes the tenant-materialization apply (org-units + positions + incumbents + assignments + skill/KPI evidence, all idempotent). Then assess and propose (RECON) which 1-2 further handlers give the most real value for least risk given the actual data (candidates visible in the modules: goal/OKR state transitions, leave requests — verify what exists).

Integration tests: full approve→effect→subject-mutated round-trip, plus the failure path (handler throw → request NOT marked applied, subject untouched — verify the 409 rollback contract). An end-to-end demo path (create request → approve → tenant materialized) must be verifiable live.

Estimated effort ~2-4h per handler. Doc of record: DEVELOPMENT_LINES_B §B3.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm; db/migrations 167 files max 000169 at S1015 — re-derive live.
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. SoT wins.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433. Migrations twice-run idempotent (D-12); varchar+CHECK (RD-08); asserts by owned codes (D-38). Materialization keying: `SYN_<positionCode>`, NEVER `LEGACY_EMP::` (invariant I14).
- Tests under per-file tx isolation (D-52) — note: the approve→effect flow spans real transactions; check how tx-isolation interacts with `withTransaction` savepoint facade before writing tests.
- Done means: typecheck · lint · full suite green · CI 6/6 · vm-deploy · LIVE verification.
- Which handlers beyond TENANT_MATERIALIZATION = propose with evidence, Enzo decides.
