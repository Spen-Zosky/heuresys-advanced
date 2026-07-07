WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_STATE.md + docs/kb/SOT_BACKLOG.md (item #27) + docs/kb/DEBT_REGISTER.md + docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L2 + apps/api/src/lib/scope/{data-classes,resolver,gate}.ts + the insights/gaps/reviews modules and their web pages.

Then fight the mission on paper, move by move, and write it to wargames/11-heuresys-evidence.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#27 A/L2 — evidence layer** ("the proofs under the scores") in heuresys-advanced. ~5.3k dormant DB rows (assessment/learning evidence, 360 feedback, continuous feedback, behavioral) must become a drill-down "why this score" on the insights/gaps/reviews surfaces, plus a self-scope view for ESS users. This is the substance of the explainability / AI-Act wedge (reinforces #28 Trust Ledger).

Deliver: read-only API sub-resources exposing the evidence under each score; drill-down UI on the existing insights/gaps/reviews pages; self-scope endpoints under `/v1/me/*` for the ESS view; i18n it+en for every new string.

The data is SENSITIVE: extend the data-class taxonomy (`apps/api/src/lib/scope/data-classes.ts`) with the new resources and annotate every new read route with `config.orgGate` — the D-51 boot assertion refuses to boot otherwise. Add `*-scope` integration tests proving org-axis isolation (pattern from S1013: allowed-manager 200 / cross-tree 404), with expectations derived live from the DB, never hardcoded.

Estimated effort ~8-12h. Doc of record: docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L2.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm: apps/api (Fastify 5), apps/web (Next.js 16), packages/shared, db/migrations (167 files, max 000169 at S1015 — re-derive live).
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. If counts differ from this brief, the SoT wins.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433, db heuresys_advanced. Migrations MUST be twice-run idempotent (invariant class D-12); enum-ish columns = varchar+CHECK (RD-08); never write resource-wide count asserts (class D-38: scope asserts by owned codes).
- AuthZ: bi-axial model ADR-0027; boot-gate D-51 (`lib/scope/gate.ts`) fails boot on undeclared sensitive read routes.
- Tests: vitest integration runs under per-file transactional isolation (D-52); full API suite 0 fail required.
- Done means: typecheck all ws · lint · i18n parity it+en · full API suite green · CI 6/6 green · deploy `scripts/vm-deploy.sh` · verified LIVE on www.heuresys.com with a real login (route 401 unauthenticated, drill-down renders real evidence rows).
- Product/scope decisions are Enzo's authority: never invent, mark as RECON NEEDED or fork.
