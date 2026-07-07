WARGAME ORDER. You are not executing this mission, you are wargaming it. A cheaper executor (Claude Code CLI on Sonnet/Opus, working on the heuresys-advanced repo) runs the brief below later. Your job is the route it will follow.

Recon first, read-only: docs/kb/SOT_BACKLOG.md (item #17) + the Wave-3 runner docs (`wave_runners/wave_3_runner.md` if present) + the legacy tenant data for SmartFood (82 employees) and EcoNova (26 employees) + the v5 process/KPI taxonomy (banking-native) + tenant-materialization module + ADR-0024/0026.

Then fight the mission on paper, move by move, and write it to wargames/17-heuresys-wave3.md:

- every move states its expected observation, exactly what you should see if it worked
- every move carries its most likely failure, the cause it signals, and the counter-move
- every fork gets a trigger, if you observe X, take route B
- assumptions recon could not settle get marked RECON NEEDED with the exact check that settles it
- end with abort conditions, and the verification runs the executor must perform with what pass looks like for each

Write it so the executor can run the brief end to end without asking a single question.

=== THE MISSION BRIEF (the executor's orders, not yours) ===

Implement backlog item **#17 Wave-3 residual — L2/L3 multi-industry tenant onboarding**: onboard the two non-banking legacy tenants, SmartFood (82 employees) and EcoNova (26 employees), into the v5 platform. L1 (Heuresys System fix) is ALREADY DONE (S987/S988, mig 000110+000111) — do not redo it.

**THE OPEN PRODUCT FORK (Enzo has NOT decided):** the v5 process/KPI taxonomy is banking-native. Route A = **multi-industry**: extend/branch the taxonomy per industry (food, green-energy) before onboarding; Route B = **single-industry reference**: onboard SmartFood/EcoNova mapping onto the banking-native taxonomy as best-effort reference tenants, documenting the semantic gaps. The wargame must fight both routes, cost them honestly (route A is a taxonomy program, not a session), and define the trigger (Enzo's strategy decision, informed by the recon evidence on how badly the banking taxonomy fits the two datasets — quantify the mismatch: how many legacy processes/KPIs map cleanly, how many don't).

Sequenced start regardless of route: L2 pilot = **EcoNova (26 employees, smaller blast radius)**, then SmartFood. Employee-centric keying doctrine applies (`LEGACY_EMP::<employees.id>`, ADR-0024, invariant I14); ambiente unico = production (ADR-0026, invariant I15): the onboarding writes REAL production tenants — every step idempotent and reversible, pre-deploy snapshot mandatory (pg_dump step in vm-deploy, D-08 pattern).

Deliver (per tenant): tenant + org-units + positions + users + assignments imported idempotently; RBAC seeded; skill/KPI mapping per chosen route; smoke E2E on the tenant's data; live verification.

=== EXECUTION CONSTRAINTS (heuresys-advanced, binding) ===

- Repo: `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM). Monorepo pnpm; db/migrations 167 files max 000169 at S1015 — re-derive live.
- Before ANY work read in order: docs/kb/SOT_STATE.md → docs/kb/SOT_BACKLOG.md → docs/kb/DEBT_REGISTER.md → .handoff/STATE.md. SoT wins.
- DB: PostgreSQL 16 on OCI VM, tunnel localhost:5433. Migrations twice-run idempotent (D-12); varchar+CHECK (RD-08); asserts by owned codes (D-38); NEVER break the migrate chain on re-run (class D-22/D-38: register new tables in the reconciliation registry BEFORE the 0-UNCLASSIFIED assert point).
- Tests under per-file tx isolation (D-52); full API suite 0 fail.
- Done means: typecheck · full suite green · CI 6/6 · vm-deploy (with pre-deploy pg_dump snapshot) · LIVE verification per tenant.
- The A-vs-B strategy is Enzo's authority: fork with trigger + quantified recon evidence, never pre-decide.
