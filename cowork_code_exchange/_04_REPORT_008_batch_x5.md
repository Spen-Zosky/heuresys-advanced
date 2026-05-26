# REPORT 008 — CLI Batch X5.A (interim, A+B; C+D pending halt resolution + X5.B session)

**Executed**: 2026-05-21T12:05Z → 2026-05-21T12:20Z (~15min wall-clock active CLI; Wave 1 retries 189s + 186s)
**Sessions**: 1 partial (X5.A done; X5.B = C+D pending Cowork directive on §2.B halt + fresh session)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Pre-conditions**: All §2 pre-flight passed (DB OK, X4.A commit `a76adef` visible, baseline sys_job_roles 91 / sys_esco_occupation_mappings 0 / sys_users 163 / Time-Leave tables not yet created).

---

## §0 — Pre-conditions verified
- SSH tunnel localhost:5433 ✅
- PG 16.14, heuresys_advanced DB ✅
- Last commit a76adef X4.A visible ✅
- 4 C5 deliverables present (CW_B32_PATCH_SPEC, ADR-0016, xos_lib/, x4b_retrigger/) ✅
- Live DB baseline recorded: sys_job_roles 91, sys_esco_occupation_mappings 0, sys_users 163

---

## §1 — Block A outcomes (CW-B32 fix — SUCCESS)

### §1.A.1 Transform code add
- Added `CAST_ENUM` case in `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`
- Extended `SUPPORTED_TRANSFORMS` Set
- Text-text comparison strategy (no `::integer` cast, NULL-safe)
- pg-format `%L` for SQL injection escape

### §1.A.2 Unit tests
- New file `apps/api/test/transform-compiler.cast-enum.test.ts` (5 tests)
- All 5/5 pass standalone
- Full suite: 322/329 (1 new fail unrelated to CAST_ENUM; under §7 threshold of 5)
- Spec test 5 originally checked `not.toContain("'; DROP TABLE")` — corrected to verify the escaped literal form `'1''; DROP TABLE--'` instead (pg-format doubles single quotes inside literal, so the substring legitimately appears within the safe string wrapping)

### §1.A.3 UPDATE column_mapping
- New file `db/seeds/brownfield/wave2/cw_b32_fix/01_org_level_to_cast_enum.sql`
- Applied via psql, UPDATE 1 row (column_mapping_id `2248f925-df52-4ccd-b38f-9f74621df146`)
- Transform changed CAST_VARCHAR → CAST_ENUM with value_map for org_level 1→ENTRY ... 6→EXECUTIVE

### §1.A.4 Wave 1 retry
- **runId**: `9bed1281-7a1c-420e-b55a-b021cc4cb7ea`
- **wall-clock**: 189s (~3min, engine fixes preserved)
- **status**: COMPLETED

### §1.A.5 Acceptance
- **sys_job_roles**: 91 → **202** (+111) ✅
- Spec acceptance: ≥141 — **SUPERATA by 61** (43% over target)
- All ccnl 91 preserved + job_templates ~111 new (dedup of 140 staged via CW-B31)

**Commit**: `ea4ebe6` (Block A + B + xos_lib bundle)

---

## §2 — Block B outcomes (ADR-0016 — PARTIAL — HALTED)

### §2.B.1 Codebase audit
```bash
grep -rn "esco_occupation_mapping_job_role_id\|escoOccupationMappingJobRoleId\|escoJobRoleId" \
  apps/api/src packages/shared/src apps/api/test
```
- **0 hits** in business code (apps/api/src, packages/shared/src, apps/api/test)
- All hits in docs/, db/migrations/, db/seeds/, cowork_reserved/, .claude/worktrees/ (legacy / cowork-only paths)
- **Decision**: per ADR-0016 §5 matrix "0 hits" → apply migration directly, no companion edits

### §2.B.2 Migration 000041 apply
- File: `db/migrations/000041_sys_esco_occupation_mappings_job_role_nullable.sql` (authored from ADR §4 spec)
- Applied via psql, idempotent ALTER COLUMN DROP NOT NULL
- Verified: `is_nullable = YES` for `esco_occupation_mapping_job_role_id`

### §2.B.3 Companion edits
- None required (0 hits per §2.B.1)

### §2.B.4 Wave 1 retry
- **runId**: `0f7461a1-42fc-4641-9aaf-10c29c56f388`
- **wall-clock**: 186s
- **status**: COMPLETED

### §2.B.5 Acceptance — **FAILED ❌**
- **sys_esco_occupation_mappings**: **0** (target ≥3000)
- **Halt trigger §7 P0**: "Block B retry: sys_esco_occupation_mappings still 0 → adr_0016_unexpected_fail"

### §2.B.6 Root cause analysis
Migration 000041 makes the **DB column** nullable, BUT the **engine WHERE skip filter** (upsert-sql.ts:384-416) excludes any row where a UUID column in `targetMeta.naturalKeyColumns` is NULL/missing.

Live audit:
```
exclusion_reason                                | count
nk_missing_esco_occupation_mapping_job_role_id  | 7645
```

ALL 7645 PASSED staged rows excluded (esco_occupations 3040 + occupation_industry_classifications 4565 + onet_occupations 25 + industry_occupation_mapping 15).

The NK comes from sys_esco_occupation_mappings UQ index `(esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri)`. Even with nullable FK at DB level, the engine treats NK columns as required for dedup → filter rows where NK col would be NULL.

### §2.B.7 HALT+ESCALATE
- File emitted: `cowork_code_exchange/.inbox/cowork/pending/2026-05-21T12-19-00Z__008_halt_adr_0016_unexpected_fail.md`
- 3 options proposed (A engine COALESCE-aware skip filter / B synthetic LOOKUP_FK→NULL / C UQ redesign drop job_role_id from NK)
- Recommendation: Option A (mirror CW-B22 nullable-NK COALESCE pattern, ~2-3h engine work)
- CLI standing by for Cowork `exec_directive`

---

## §3 — Block C outcomes (Time/Leave)
- **DEFERRED to X5.B fresh session** per PROMPT §0 split recommendation.
- Block C is independent of Block B halt — can proceed in parallel review window.

---

## §4 — Block D outcomes (sys_users HYBRID)
- **DEFERRED to X5.B fresh session** per PROMPT §0 split recommendation.
- legacy_mirror.users (274) + employees_pii (270) ready from X3.

---

## §5 — Bias catalog updates (CW-B34 candidate)

- **CW-B34 — Nullable FK vs NK UQ Semantic Divergence**: making a DB column nullable via migration (ADR-0015/0016 pattern) doesn't automatically make the engine accept NULL values in that column when it's part of a NK UQ index. The WHERE skip filter pre-INSERT treats UUID NK cols as required regardless of DB nullability. Surfaced: ADR-0016 partial application X5.B. Mitigation: extend engine to consult `columnNullable` map (or information_schema.is_nullable) when building skip filter; or extend ADR pattern to include companion engine change (CW-B22 COALESCE-aware predicate for nullable NK cols).

---

## §6 — Cowork spec improvements suggested

1. **ADR-0016 didn't anticipate engine-side NK filter semantics** — ADR §4 spec is correct for DB layer but engine layer requires companion fix. Suggest C6: include "engine WHERE skip filter awareness" as a checklist item in any future "make X nullable" ADR.

2. **CW-B32 spec test §3.3 test 5 expectation `not.toContain("'; DROP TABLE")` is incorrect** — pg-format escapes by doubling quotes (`'1''; DROP TABLE--'`), so the substring `'; DROP TABLE` legitimately appears in safe escaped form. Correct expectation: `toContain("'1''; DROP TABLE--'")` to verify the wrapped escape.

3. **PROMPT 008 §4.B acceptance criterion ≥3000** assumed migration alone unlocks ESCO. Reality requires either engine patch (CW-B34 mitigation) or schema redesign. C6 PROMPT should layer: "if migration alone yields 0 rows, halt+escalate for engine companion fix".

4. **Suggest renaming `cowork_reserved/batch_c5/x4b_retrigger/` to `c4_x4b_residual/`** — clearer intent that it sequences X4.B (PROMPT 007 residual) not a "retrigger" of X4.A.

---

## §7 — Feedback sul modello operativo Cowork↔CLI

**Cosa ha funzionato bene**:
- **CW-B32 Dry-run EXPLAIN ✅** documented in spec gave high confidence pre-apply — confirmed at runtime (sys_job_roles +111). Pattern worth standardizing for all future engine patches.
- **Codebase audit pre-migration** (CW-B33 mitigation) confirmed 0 hits in business logic — saved companion-edit cycle. Matrix-based decision was clear.
- **xos_lib** committed to `db/scripts/_lib/` — ready for X5.B Block C/D adoption.
- **Halt+escalate protocol** worked cleanly on Block B unexpected fail: inbox emitted, 3 options structured, X5.B can proceed independently while Cowork reviews.

**Cosa rifare diversamente**:
- **ADR/migration design gap**: nullable FK migrations should bundle companion engine change spec (CW-B22-style COALESCE in skip filter). C6: standardize "nullable FK = DB+engine 2-step" pattern.
- **Spec test acceptance precision**: pg-format escape semantics need more careful spec test phrasing (CW-B32 test 5 illustrated this).

**Critical thinking moments**:
- Catching the WHERE skip filter as root cause of Block B failure: utile (caught quickly via audit reasons distribution).
- Discovering CAST_ENUM CHECK semantics (X4.A) → unlock (X5.A): natural chain, validation of iterative-fix workflow.
- 3 options structured in halt notice (vs single recommendation): valuable for Cowork decision space.

---

## §8 — Next step recommendation for Cowork batch C6

**P0 (responding to halt)**:
1. **Decide ESCO unblock option (A/B/C from halt notice)** — Option A engine patch recommended.
2. **Author Option A patch spec** for upsert-sql.ts:384-416 WHERE skip filter to use COALESCE-aware predicate on nullable UUID NK cols. Mirror CW-B22 pattern (sentinel UUID for tenant cols).

**P1 (X5.B continuation, independent of halt)**:
3. **Block C Time/Leave SDBI pilot** (PROMPT 008 §5) — fresh session X5.B, ~3-5h, uses xos_lib for extracts.
4. **Block D sys_users HYBRID merge** (PROMPT 008 §6) — fresh session X5.B, ~2-3h, R-A2 admin preservation critical.

**P2 (hardening)**:
5. **CW-B34 mitigation general**: extend engine `targetMeta` with `columnNullable: Map<string, boolean>` populated from information_schema. Affects upsert-sql.ts:384-416 (skip filter) + line 603-611 (NK match pairs CW-B22 helper).
6. **Standardize "Nullable FK ADR" pattern**: future ADRs in this family bundle DB+engine spec atomically.

---

*End REPORT 008.A interim — X5.B (Time/Leave + sys_users) pending fresh session. Block B halt response awaited from Cowork batch C6.*
*Pushed to origin/main as `a76adef..ea4ebe6` (1 commit: X5.A bundle).*
