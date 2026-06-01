# heuresys-advanced — STATE

**Updated**: 2026-06-02 (S956 — v1.0.0 consolidation, checkpoint 1). **Work is on branch `release/v1.0.0`** (HEAD `a20d633`, pushed, **PR #24 → main**, CI 5/5 green); `main` holds only the entry-point doc. **FRESH SESSION: `git checkout release/v1.0.0` and read `NEXT_GENERATION_ENTRY_POINT.md` §13 RESUME POINT — it is the authoritative resume record (state, blueprints, blockers, lessons).** 53 migrations (`000001..000053`).

## Last session brief (S956 — v1.0.0 consolidation, 7 workstreams shipped + CI-green)
- **WS-0** bootstrap (backup + baseline green + CI). **WS-5**: 60/60 module integration tests (550 green) + fixed a real prod bug (GET /v1/activity-classifications 500 — Zod enum missing ATECO/NACE). **WS-1**: employee-centric satellites (1874 rows: profiles/education/assessment_evidence) + permanent 1a doctrine guard. **WS-3** (partial): skill_categories 0→6 (nullable-FK mig 000051, ADR-0025) + re-derivation gains (skills 20073→21939, learning↑). **WS-6g**: ADR-0015 ACCEPTED. **WS-6b**: pg-pool ECONNRESET handler. **WS-4 P1**: user theme+palette prefs (server-SoT, mig 000053, full-stack + E2E).
- All adversarially verified; all pushed; PR #24 CI green at each step.

## Top priorities (next session — §13 has full detail + blueprints)
1. **WS-4 R1b** teams (sys_teams/members + TEAM_LEADER/MEMBER + 3rd scope axis, derive from REAL `sys.sys_organization_units`) + **V** sampled E2E matrix. ~4-6h.
2. **WS-2** Wave-2 executor code-gen (~2.5h, additive: remove wave!=1 guard + parameterize by wave); data import source-discovery-gated → defer documented.
3. **WS-7 RELEASE**: bump 4 workspaces→1.0.0, regen stale viz-graph (db:validate), tag v1.0.0, gh release, auto-merge PR #24.

## Open questions / blockers (documented §8/§13)
- sys_activity_classification_mappings: FK-vs-mapping redesign (mig 000007). sys_kpi_definitions empty → blocks process_kpi + user_kpi_evidence (→ WS-2).
- WS-6 deferred (GA-scope, risk/effort): 6e MFA multi-kind, 6f mobile-matrix, 6c obs-depth, 6g.2 markers.

## Stack snapshot
- DB: 161 users / 2 tenant; **53 migrations**; +1874 user_* satellite rows; sys_user_preferences live; skills 21939, learning_modules 7300.
- Consolidation: WS-0/5/1/3(part)/6g/6b/4P1 ✅. Backups in pg_dump_snapshots/ (pre-v1.0.0/ws1/ws3/ws4).
- Lessons (§13): trust verified DB+adversarial review over agent self-reports; run FULL suite before pushing; every PR push re-runs full CI; rebuild shared dist after src edits.

## Verification (next session)
```bash
git -C /d/heuresys-advanced checkout release/v1.0.0 && git pull
gh pr checks 24                                               # CI on the consolidation PR
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_user_preferences"
```
