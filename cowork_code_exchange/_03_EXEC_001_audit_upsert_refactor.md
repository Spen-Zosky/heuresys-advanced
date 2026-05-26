# _03_EXEC_001_audit_upsert_refactor.md

**Protocol phase:** EXEC (executor running log)
**Goal ID:** 001
**Slug:** audit-upsert-refactor
**Status:** **HALTED at baseline B3 — PLAN §8 escape clause triggered (scope discovery requires PLAN amendment).**
**Authorisation:** "PLAN 001 approved, proceed with EXEC" + revisions R1+R2+R3 accepted, 40-turn cap with escalation at turn 38.
**Started:** 2026-05-18 ~17:09 GMT+2 (15:09 UTC)
**Halted:** 2026-05-18 ~17:11 GMT+2 (15:11 UTC), at turn 3 of EXEC budget.

---

## Pre-EXEC honest budget caveat (executor declaration)

The approved budget is 40 conversation turns with escalation at turn 38. Realistic forecast from PLAN §8 + practical CLI per-turn limits places full completion (baseline + 7 commits + full-scale 47k run + idempotency double-run + acceptance sweep) at ~50–55 turns under optimistic assumptions. The 38-turn escalation is therefore likely under any branching. Executor intends to (a) work aggressively from baseline forward; (b) honour the escalation policy strictly when triggered; (c) close with `_04_REPORT_001_partial.md` if §7 verification has not entered final phase by turn 38. Cowork should be aware this is expected, not a surprise.

---

## Step log

### T1 — Infrastructure pre-flight + tunnel restoration

- SSH tunnel `localhost:5433 → oracle-vm-default:5432` was DOWN at EXEC start (per Phase 1 finding).
- Opened with `ssh -fN -L 5433:localhost:5432 oracle-vm-default`. Verified up via `/dev/tcp/localhost/5433`.
- baselines dir created at `D:\heuresys-advanced\cowork_code_exchange\baselines\`.
- **Backup gate (PLAN §"Operational boundaries"):** `find /home/ubuntu/backups/*.dump -mmin -360` returns:
  - `/home/ubuntu/backups/heuresys_advanced_pre_phase2_20260518_1347.dump (2026-05-18 13:47 UTC, ~3.5h old, 130 206 691 bytes)`
  - **Verdict: FRESH** (≤ 6h). Backup gate **PASSED**. No new dump needed before B-phase reads (no DB writes yet).

### T2 — Recovery (minor)

- First Bash call backgrounded automatically due to `ssh -fN` `-f` flag; parallel B5/B3 fired before `mkdir baselines/` settled. No data loss, just had to retry. Documented to flag a wrinkle for future cowork EXEC turns: never combine `ssh -fN` with downstream filesystem ops in the same Bash heredoc.

### T3 — Baseline B5 (SHA-256 of executor source files)

Captured to `cowork_code_exchange/baselines/001-source-shas-20260518_1710.txt`. Verbatim:

```
1d0aa6a412a89c221cc74794c43e2d6fcab0eafe7c074d596ac8b8ba8ca4b467 *apps/api/src/modules/brownfield-wave-executor/engine.ts
6a162d54c65a48e1fb6b726b6e32a8de6e24b54ae254caead019ebd410f32c5d *apps/api/src/modules/brownfield-wave-executor/loader.ts
7f68c100a4fa5d439ef908afe20ebcba429765b04f2b4b4e147b203add6958a2 *apps/api/src/modules/brownfield-wave-executor/repository.ts
839f235459724888c815e84c11cadb5422a99432afdc56aabc241db74bf8cc0a *apps/api/src/modules/brownfield-wave-executor/routes.ts
1e67485c193c269b9e8aa707361b02ddece6ae5b4e99eb78621a6fc415dde241 *apps/api/src/modules/brownfield-wave-executor/service.ts
914d63cb51bada8f6b6449fdfe26d7f431173dc18710d80dead4282102da405f *apps/api/src/modules/brownfield-wave-executor/state.ts
c5af4a86bacb324389d4c1b114e97c9a145f0beaaadf4ad36e76591a9d5787ee *apps/api/src/modules/brownfield-wave-executor/transforms.ts
```

These are the rollback anchor per PLAN §10 — any post-EXEC verification of "files unchanged" can compare against this set.

### T3 (cont.) — Baseline B3 (pre-state DB snapshot + transform vocabulary)

Captured to `cowork_code_exchange/baselines/001-db-state-20260518_1710.txt`. Confirmed DB state matches GOAL_B_REPORT §2 + §5 numbers:

| Object | Value | Matches PLAN expectation? |
|---|---|---|
| `brownfield.import_runs` | 1 row, status `RUNNING`, id `67d51a90-7ad9-44e2-860d-0d2e0e945af8` | ✅ as expected |
| `audit.import_run_logs` | 0 | ✅ |
| `audit.import_validation_results` | 0 | ✅ |
| `audit.import_approval_decisions` | 0 | ✅ |
| `sys.sys_source_lineage_records` distribution | 52 with NULL `source_lineage_import_run_id` | ✅ |
| `sys.sys_skills` | 52 | ✅ |
| `sys.sys_blueprint_process_registry` | 23 | ✅ |
| `sys.sys_user_certifications` | 1 | ✅ |
| `sys.sys_source_lineage_records` total | 52 | ✅ |
| `staging.wave1_*` est | 17 tables, all 0 or -1 (post-Goal-B TRUNCATE) | ✅ |

### T3 (final) — Baseline B3 transform vocabulary check — **🚨 DISCOVERY**

PLAN §5.1 assumed vocabulary = `{CAST, LOOKUP_FK, COPY, DEFAULT, REGEX}` (5 codes). PLAN §8 honest-estimate flag: "If a 6th code shows up, I will flag in chat before continuing rather than silently absorbing the cost."

Live `brownfield.column_mappings` shows **14 distinct codes** (1177 mapping rows total):

| transform code | mapping count | in PLAN? | category |
|---|---|---|---|
| `JSON_EXTRACT` | 759 | ❌ NEW | jsonb path extraction (PG `->`, `->>`, `#>>`) — needs payload spec design |
| `CAST_TIMESTAMPTZ` | 130 | ❌ NEW (typed variant) | typed CAST — mechanical extension of generic CAST |
| `LINEAGE_SOURCE_NK` | 93 | ❌ NEW | lineage natural-key extraction — semantically domain-specific, needs source-code inspection in `transforms.ts` to understand current behavior |
| `TRIM` | 86 | ❌ NEW | PG `trim()` — trivial |
| `LOOKUP_FK` | 49 | ✅ | as expected |
| `SKIP` | 39 | ❌ NEW | column dropped from SELECT list — special marker, needs care |
| `DIRECT_COPY` | 11 | ≈ COPY rename | trivial rename to existing pattern |
| `UPPERCASE` | 3 | ❌ NEW | PG `upper()` — trivial |
| `CAST_INT` | 2 | ❌ NEW (typed variant) | typed CAST |
| `CAST_VARCHAR` | 1 | ❌ NEW (typed variant) | typed CAST |
| `CAST_BOOLEAN` | 1 | ❌ NEW (typed variant) | typed CAST |
| `CAST_NUMERIC` | 1 | ❌ NEW (typed variant) | typed CAST |
| `LOWERCASE` | 1 | ❌ NEW | PG `lower()` — trivial |
| `CONSTANT` | 1 | ≈ DEFAULT rename | trivial — but semantics differ: CONSTANT replaces unconditionally, DEFAULT only when NULL |

**Codes NOT in mapping registry but in PLAN:** `COPY` (replaced by `DIRECT_COPY`), `DEFAULT` (replaced by `CONSTANT`?), `REGEX` (not used).

**Net new vocabulary: 9 codes, plus 2 renames (with semantic nuance for CONSTANT vs DEFAULT).**

PLAN §8 budget impact: "+3 turns per new code (compile fragment + test + adversarial test)". 9 × 3 = +27 turns. New realistic EXEC budget = **40 + 27 = ~67 turns** (or, more honestly, ~50–55 if I tighten test ceremony for the trivial ones — TRIM/UPPERCASE/LOWERCASE/CAST_*).

Additionally, `LINEAGE_SOURCE_NK` and `JSON_EXTRACT` are not trivially-mechanical: they require inspection of `transforms.ts` to understand current behavior and design compile fragments carefully.

**Per PLAN §5.1 + §8 rules, EXEC HALTS HERE pending PLAN amendment.** This is not a violation; it is the protocol's own escape clause executing as designed.

---

## Halt summary

| Aspect | Value |
|---|---|
| EXEC turns consumed | 3 of 40 (≤8% of budget) |
| Backup gate | PASSED (mtime ~3.5h old, ≤6h) |
| Baselines captured | B5 (source SHAs), B3 (DB state + vocabulary) ✅ |
| B1, B2, B4, B6 (new dump) | NOT YET ATTEMPTED |
| Code changes | NONE (no commits) |
| DB writes | NONE |
| Reason for halt | Transform vocabulary discovery (14 codes vs. assumed 5) — PLAN §8 rule trigger |
| Awaits | Cowork decision on PLAN amendment scope. See chat for proposed options. |

Next file in protocol: this EXEC is paused, not yet closed with `_04_REPORT`. When Cowork's decision arrives, EXEC will resume from B1 with the amended PLAN, or close as partial with `_04_REPORT_001_partial.md`.

---

*End of _03_EXEC_001_audit_upsert_refactor.md (snapshot at halt, will be appended on resume)*
