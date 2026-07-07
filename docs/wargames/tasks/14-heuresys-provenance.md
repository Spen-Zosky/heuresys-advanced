WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_BACKLOG.md (item #28) + docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L0 + the lineage/provenance tables (~70,972 rows — verify the real table names live) + the `/brownfield-adaptation` page and its module.

Then fight the mission on paper, move by move, and write it to wargames/14-heuresys-provenance.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#28 A/L0 — Trust Ledger: read-API over provenance** in heuresys-advanced. 70,972 lineage rows exist and are invisible. Build `/v1/provenance` (per-record + aggregated views) and a UI panel — either inside `/brownfield-adaptation` or a new `/provenance` page (fork: pick based on what recon shows about the brownfield page's information architecture; state the trigger).

This is a GTM-citable deliverable (AI-Act / GDPR art. 22 posture: every derived score traceable to its source). It reinforces #27 evidence layer — design the API so evidence-layer drill-downs can later link into provenance records without rework.

Deliver: `/v1/provenance` read endpoints (per-record lookup by entity type+id, aggregate stats by source/wave/table); UI panel with drill-down; RBAC decision (which roles read provenance — platform-admin only vs tenant-admin: RECON the existing permission patterns and propose, flag for Enzo); i18n it+en.

Estimated effort ~4h. Doc of record: docs/product/DEVELOPMENT_LINES_A_EXPOSE_DORMANT_DATA.md §L0.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm; db/migrations 167 files max 000169 at S1015 — re-derive live.
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. SoT wins.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433. Migrations twice-run idempotent (D-12); varchar+CHECK (RD-08); asserts by owned codes (D-38).
- AuthZ: check whether provenance falls in the sensitive taxonomy (lib/scope/data-classes.ts) — if yes, orgGate declaration is mandatory (boot-gate D-51); if it is aggregate-only metadata, `aggregate` gate likely applies. Settle in recon.
- Tests under per-file tx isolation (D-52); full API suite 0 fail.
- Done means: typecheck · lint · i18n parity · full suite green · CI 6/6 · vm-deploy · LIVE verification on www.heuresys.com (panel renders real lineage rows).
- RBAC/product decisions are Enzo's authority: propose with evidence, flag, never silently decide.
