# X4.B re-trigger update — Block B unchanged + sequencing

**Author**: Cowork batch C5.4
**Date**: 2026-05-21
**Triggered by**: REPORT X4.A §2 (Block B DEFERRED to fresh CLI session) + REPORT X4.A §6 next-step recommendation

---

## §1 — Status Block B (post-X4.A)

**Block B specs authored in batch C4 are UNCHANGED and STILL VALID** post-X4.A.

| Spec file | Lines | Status | Action X5 |
|---|---|---|---|
| `cowork_reserved/batch_c4/time_leave_pilot/00_README_TIME_LEAVE_PILOT.md` + 7 siblings | ~1500 cumulative | ✅ ready | Execute as Block C of X5 (renamed from "Block B") |
| `cowork_reserved/batch_c4/sys_users_sdbi/00_README_SYS_USERS_SDBI.md` + 4 siblings | ~1100 cumulative | ✅ ready | Execute as Block D of X5 |

**Pre-conditions for X5 Block C/D execution**:
- `legacy_mirror.users` + `legacy_mirror.employees_*` extracted in X3 ✅ (verified REPORT X4.A §0 pre-flight)
- Block A engine fixes pushed to main (CW-B31 patch + cross-OS hygiene) — commit `a76adef` ✅
- Fresh CLI session context window ready

## §2 — Sequencing X5 (4 blocks)

Block A and B of X5 are new (CW-B32 + ADR-0016). Block C and D are the X4.B residuals.

| X5 Block | Source | Effort | Critical path |
|---|---|---|---|
| **A — CW-B32 CAST_ENUM** | C5.1 spec | 1.5-2.5h | YES (unblocks job_templates → sys_job_roles ≥141) |
| **B — ADR-0016 migration 000041** | C5.2 spec + ADR | 1-1.5h | NO (parallel to A; unblocks sys_esco_occupation_mappings ≥3000) |
| **C — Time/Leave SDBI pilot** | C4.2 specs | 3-5h | NO |
| **D — sys_users HYBRID extension** | C4.3 specs | 2-3h | YES R-A2 admin preservation |
| **(housekeeping) — xos_lib commit** | C5.3 lib | <30 min | NO |

**Total estimated X5**: 8-12h cumulative. Recommend split in 2 CLI sessions:
- X5.A: Blocks A + B (engine + migration fixes, ~3-4h) + Wave 1 retry verify
- X5.B: Blocks C + D (SDBI pilots, ~5-8h) + xos_lib adoption

## §3 — Cross-batch dependency map

```
                          ┌─────────────────────────┐
                          │ X4.A delivered (a76adef)│
                          │ - CW-B31 engine fix     │
                          │ - extract_users_*.sh OS │
                          └────────────┬────────────┘
                                       │
                                       ▼
   ┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
   │ X5 Block A    │    │ X5 Block B       │    │ xos_lib commit  │
   │ CW-B32 fix    │    │ ADR-0016 + 41    │    │ (housekeeping)  │
   │ (1.5-2.5h)    │    │ (1-1.5h)         │    │ (<30min)        │
   └──────┬────────┘    └────────┬─────────┘    └────────┬────────┘
          │                      │                       │
          └──────────┬───────────┴───────────┬───────────┘
                     │                       │
                     ▼                       ▼
            ┌────────────────┐    ┌────────────────┐
            │ Wave 1 retry   │    │ Block C (X5.B) │
            │ verify ≥141 +  │    │ Time/Leave     │
            │ ≥3000 esco     │    │ (3-5h)         │
            └────────┬───────┘    └────────┬───────┘
                     │                     │
                     ▼                     ▼
            ┌────────────────────────────────────┐
            │ Block D (X5.B)                     │
            │ sys_users HYBRID + R-A2 defensive  │
            │ (2-3h)                             │
            └────────────────────────────────────┘
```

## §4 — R-A2 (sys_users admin preservation) refinement

REPORT X4.A §4.5 item 5 surfaced: PROMPT 007 §4.B.2 R-A2 "defensive check obbligatorio" was undefined. Defining now:

**R-A2 defensive check** (apply post-merge in Block D):

```sql
-- Assertion: ADMIN:: rows preserved (must be ≥5 — 5 canonical test admins)
DO $$
DECLARE
  v_admin_count int;
  v_expected int := 5;  -- 5 canonical seeded admins (per pnpm db:seed-test-admin)
BEGIN
  SELECT COUNT(*)
    INTO v_admin_count
    FROM sys.sys_users
   WHERE user_natural_key LIKE 'ADMIN::%';

  IF v_admin_count < v_expected THEN
    RAISE EXCEPTION 'R-A2 violation: expected ≥% ADMIN:: rows, found %', v_expected, v_admin_count;
  END IF;

  RAISE NOTICE 'R-A2 check PASS: % ADMIN:: rows preserved', v_admin_count;
END $$;
```

If RAISE EXCEPTION fires → CLI halt+escalate via inbox `<TS>_008_halt_R-A2_admin_loss.md`.

## §5 — REPORT X4.A feedback acknowledged

- ✅ §4.5 #1 (CW-B31 spec column-exists insight): incorporated in `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §9 CW-B33 + Dry-run EXPLAIN pattern (C5.0)
- ✅ §4.5 #2 (schema introspection LIVE pre-spec authoring): already CW-B25 mitigation in pattern memo
- ✅ §4.5 #3 (Semantic FK Phantom generalization): ADR-0016 §6 workflow (C5.2)
- ✅ §4.5 #4 (cross-OS library): C5.3 `xos_lib/cross_os_pipeline.sh`
- ✅ §4.5 #5 (R-A2 defensive check definition): §4 above

All 5 feedback items addressed in batch C5.

---

*End X4.B re-trigger update*
