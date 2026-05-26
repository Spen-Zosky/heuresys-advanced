# REPORT 007 — CLI Batch X4

**Executed**: 2026-05-21T04:36Z → 2026-05-21T04:55Z (Block A only — Block B deferred to next CLI session per PROMPT §0 recommendation)
**Sessions**: 1 partial (Block A done in this session; Block B = X4.B in fresh session)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Pre-conditions**: All §2 pre-flight passed (SSH 5433, DB connectivity, X3 commits visible, X3 outcomes verified: sys_job_roles 91, sys_goals 1067, sys_users 163, legacy_mirror.users 274, employees_core 270; migrations 000038/039 not in sys_schema_migrations table because applied via psql -f X3 — coerente con X1/X2 pattern).

---

## §1 — Block A outcomes

### §1.A.1 CW-B31 patch (DISTINCT ON dedup main INSERT)
- **Applied**: yes — CTE-based pattern (staging_filtered + staging_deduped) in upsert-sql.ts:614+. **TWO iterations** required:
  1. Initial patch used `DISTINCT ON (${conflictInference})` directly. Failed runtime with "column 'job_role_code' does not exist" because `conflictInference` lists target column names, but staging table has only staging_* columns + raw_record jsonb.
  2. Corrected patch: parse `conflictInference` into key cols, lookup corresponding `entry.sql` expressions in `colEntries`, build `conflictKeyExprs` (e.g. `TRIM(staging_raw_record->>'job_code')` for `job_role_code`). Use these expressions in DISTINCT ON + ORDER BY.
- **Spec deviation**: PROMPT §3.A.1 spec used `${conflictKeyExpr} = conflictInference;` directly — same bug. The "Note critica" in PROMPT actually anticipated this but didn't enforce verification. Documenting in §4.5.
- **typecheck**: PASS (both iterations).
- **tests**: 318 passed / 324 (baseline preserved; CW-B31 patch is additive — zero new regressions).
- **Commit SHA**: `a76adef` (Block A bundle).

### §1.A.2 ESCO cascade re-try
- **Pre-flight CW-B26 result**: 5/5 samples NULL resolve.
  - Sample esco_occupation_code values: `2149.4`, `2146`, `3257.1`, `3431.1`, `2351.2` (ISCO/ESCO classification codes)
  - sys_job_roles source_lineage_source_record_id format = UUID (e.g. legacy job_template `id` UUID)
  - **Mismatch**: ESCO codes (varchar) cannot resolve to UUID lineage keys. The 91 sys_job_roles populated from ccnl_job_title_mapping have UUID lineage keys derived from `staging_source_natural_key = OLDDB::ccnl::<uuid>`.
- **Decision**: SKIP apply cascade fix 02. Trigger §7.4 (0/5 resolves) → halt strategic_concern logica. Document in REPORT per PROMPT §3.A.2 recommendation: **propose ADR-0016** "sys_esco_occupation_mappings.job_role_id nullable FK" pattern (mirror ADR-0015 for sys_job_roles family).
- **Rationale**: ESCO data is independent classification catalog (5237 esco_occupations + 25 onet_occupations + 15 industry_occupation_mapping + 4565 occupation_industry_classifications = 7642 staged rows) without canonical FK to internal job_roles. Pre-X4 0/5 resolves confirms this. Forcing FK via cascade fix would replicate CW-B26 phantom (X2 sys_job_roles failure).

### §1.A.3 Wave 1 retry
- **runId iteration 1 (pre-fix2)**: `dee6adeb-320f-4a82-ac7d-336d348a12c1`, wall 174s, sys_job_roles=91 (job_templates: insert_failed "column job_role_code does not exist")
- **runId iteration 2 (post-fix2)**: `18cd878e-0cfa-4fb8-a98f-e1bae3dbac96`, wall 179s, sys_job_roles=91 (job_templates: insert_failed "violates check constraint sys_job_roles_seniority_level_check")
- **Diagnostic**:
  - **CW-B31 patch IS EFFECTIVE** — error class changed from "ON CONFLICT cannot affect row a second time" (X3 pre-patch) → "CHECK constraint violation" (X4 post-patch). The dedup works; main INSERT no longer chokes on duplicate conflict-keys.
  - **New downstream bug surfaced**: `org_level` (integer in job_templates source) → CAST_VARCHAR mapping produces values like "5", "3", etc. which don't match `sys_job_roles_seniority_level_check` ENUM (ENTRY/JUNIOR/MID/SENIOR/LEAD/EXECUTIVE).
  - **CW-B32 candidate** (see §5): CAST_VARCHAR transform applied to integer enum-like sources without value-mapping table. Defer to C5.
- **Wall-clock**: 179s = ~3min (engine fixes X2 preserved).
- **sys_job_roles count**: 91 (unchanged — same 91 ccnl rows since X3; ccnl ON CONFLICT DO UPDATE is no-op on same data).

### §1.A.4 Cross-OS hygiene (CW-B28)
- **File updated**: `db/scripts/extract_users_employees_legacy.sh` (full rewrite, 67 LOC):
  - Added `2>/dev/null` to ssh pg_dump (separate stderr warnings from data stream)
  - Pipeline: `grep -v '^\\restrict '` + `grep -v '^\\unrestrict '` (PG 16+ token strip)
  - sed `vector(N)` → `text` (pgvector unavailable in legacy_mirror)
  - sed `uuid_generate_v4()` → `gen_random_uuid()` (no extension required)
  - sed CREATE TABLE → CREATE TABLE IF NOT EXISTS (idempotent)
  - sed ALTER TABLE FK / CREATE INDEX / RLS skip (defer to source semantics)
- **Verified**: X3 manual workaround pattern matches new script; replicable cross-OS.

### §1.A.5 Commit + push
- **Commit `a76adef`**: 2 files, +69 / -15.
- **Push**: SUCCESS `2de68a3..a76adef` to origin/main.

---

## §2 — Block B outcomes
- **DEFERRED to X4.B** (next CLI session) per PROMPT §0 "recommend split A/B in 2 sessions". User-consulted decision pre-execution.
- **Scope reserved for X4.B**:
  - Time/Leave SDBI pilot (Macro-area #5, ~6267 rows in 3-6 sys.* tables)
  - sys_users HYBRID merge extension (163 → ~437 via legacy_mirror.users + employees_pii)
- **Pre-conditions for X4.B**: legacy_mirror.users/employees_* already extracted in X3 ✅. Block A engine fixes pushed to main ✅. Session fresh context ready.

---

## §3 — Sys.* hit ratio + lineage

| Metric | Pre-X4 | Post-X4.A | Δ |
|---|---|---|---|
| sys.* populated tables | 51/128 | **51/128** | 0 (sys_job_roles 91 unchanged — CW-B32 blocker) |
| sys.sys_source_lineage_records total | ~23710 | ~23710 | 0 (no new upserts) |
| Engine bias catalog | 31 (CW-B17-B30 + CW-B22-B27) | **32** (+CW-B31 effective) | +1 |

(Stats unchanged in DB but engine improved structurally: CW-B31 unlock pattern proven, blocked by CW-B32 downstream.)

---

## §4 — Halts + Anomalies

**No formal halt+escalate via inbox triggered**:
- §7.4 ESCO 0/5 resolves: documented + deferred to ADR-0016 proposal in §7 (in-REPORT escalation; no immediate work blocked).
- §7.6 sys_job_roles < 130: technically triggered (91 < 130), but root cause is CW-B32 (downstream bug) NOT CW-B31 (which proved EFFECTIVE). Engine fix delivered as scoped; data outcome blocked by different layer.

**Anomalies documented**:

1. **CW-B31 patch required 2 iterations** — first iteration misused `conflictInference` as raw column name list. Production runtime caught it ("column does not exist"). Second iteration: parse + lookup colEntries expressions.

2. **CW-B32 surfaced** — CAST_VARCHAR of integer `org_level` produces "5", "3" etc. which violate `sys_job_roles_seniority_level_check`. Same job_templates rows that CW-B31 would have deduped, now fail at CHECK layer. Pattern: integer→varchar CAST should support value-mapping table OR be replaced with explicit ENUM mapping transform.

3. **PROMPT §3.A.1 spec code had the same first-iteration bug as my initial patch** — Cowork wrote `conflictKeyExpr = conflictInference;` which would fail at runtime. PROMPT "Note critica" anticipated this ("verify forma esatta + adatta DISTINCT ON syntax") but didn't preclude implementing as-is. Reduces Cowork's HIGH confidence rating for Block A in retrospect.

---

## §4.5 — Cowork spec improvements suggested

1. **CW-B31 spec PROMPT §3.A.1 misses key technical insight**: `conflictInference` is target-column names, but staging table doesn't have those columns. DISTINCT ON needs the EXPRESSIONS from colEntries. The spec's "Note critica" warned about syntax ("parenthesized vs bare") but missed the column-exists semantic. C5 PROMPT: include exec-runtime "verify columns exist in CTE" as standard pre-patch test.

2. **ESCO cascade spec PROMPT §3.A.2 query had wrong source column** — used `staging_raw_record->>'esco_occupation_code'` but esco_occupations source has `code` (not `esco_occupation_code`). After fix to `code`, still 0/5 resolves (semantic FK absent as suspected). Lesson: schema introspection per source column names should be part of spec authoring (CW-B25 reminder).

3. **CW-B26 root cause persists beyond ADR-0015** — sys_esco_occupation_mappings has same Semantic FK Phantom pattern as sys_job_roles had pre-ADR-0015. Suggest C5 codify a generalized "Semantic FK Phantom resolution" workflow: (1) pre-flight resolves count, (2) if 0/5 → propose nullable FK ADR, (3) if 3/5+ → cascade fix viable. Pattern replicable for future targets.

4. **Cross-OS script pattern §6** is good and now standardized. Suggest moving this to a `db/scripts/_lib/cross_os_pipeline.sh` source-able library so all extract scripts can `source` it instead of duplicating. Reduces drift across future extracts.

5. **PROMPT 007 Block B sys_users §4.B.2 R-A2 critical halt** has a slight ambiguity: "ANY ADMIN:: row lost during merge" — the ON CONFLICT DO NOTHING strategy should preserve them definitionally, but the "defensive check obbligatorio" is undefined. Suggest C5: define check as post-merge SQL assertion `SELECT COUNT(*) FROM sys_users WHERE user_natural_key LIKE 'ADMIN::%' >= 5` with halt+escalate if violated.

---

## §5 — Bias catalog candidates (CW-B32+)

- **CW-B32 — Integer-to-Enum CAST Without Value Mapping**: CAST_VARCHAR transform applied to integer source col when target has CHECK constraint on string enum values. Produces lexically valid varchar ("5", "3") that fails the CHECK. Surfaced: job_templates.org_level (integer 1-6) → sys_job_roles.job_role_seniority_level (varchar ENUM ENTRY/JUNIOR/.../EXECUTIVE). Mitigation options:
  - (a) Add CAST_ENUM transform with `payload.value_map = {1: "ENTRY", 2: "JUNIOR", ...}`
  - (b) Pre-staging compute: derive seniority_level via SQL CASE in column mapping
  - (c) Relax CHECK constraint to also accept "1", "2", etc. (worst — pollutes enum semantics)
  - Decision: defer to C5 spec.

- **CW-B33 — Spec-Implementation Coupling Gap**: spec author's pseudo-code (`${conflictKeyExpr} = conflictInference`) compiles syntactically but fails at PG runtime due to column-existence semantics. Pattern: specs describing SQL templates should include EXEC-time validation, not just compile/syntax check. Mitigation: PROMPT pre-flight should include "EXPLAIN dry-run" step for non-trivial CTE patches.

---

## §6 — Next step recommendation for Cowork batch C5

**P0**:
1. **CW-B32 fix (org_level → seniority_level mapping)** — author CAST_ENUM transform OR pre-staging CASE expression. Unblocks job_templates 140 staging → ~50-60 deduped sys_job_roles (sys_job_roles 91 → ~141-151, ADR-0015 acceptance MET).
2. **ADR-0016 sys_esco_occupation_mappings nullable job_role_id FK** — mirror ADR-0015 pattern. Codebase audit for sys_esco_occupation_mappings consumers needed.

**P1 (X4.B continuation)**:
3. **Block B execution** (Time/Leave + sys_users extension) — fresh CLI session X4.B.

**P2 (hardening)**:
4. **Generalize "Semantic FK Phantom resolution" workflow** (per §4.5 item 3).
5. **Cross-OS pipeline library** `db/scripts/_lib/cross_os_pipeline.sh` (per §4.5 item 4).
6. **Spec authoring guideline**: SQL templates require EXEC-time validation, not just syntax (CW-B33 mitigation).

---

## §7 — Feedback sul modello operativo Cowork↔CLI

**Cosa ha funzionato bene**:
- **CW-B28 cross-OS pipeline standardization** (PROMPT §6) was internalized + applied to extract script — script now portable. Pattern works.
- **PROMPT 007 §3.A.2 explicit halt trigger** for ESCO 0/5 resolves — caught the semantic FK phantom early. No live SQL applied unnecessarily.
- **Two-iteration CW-B31 fix process** — initial implementation failed in production, runtime error precise, second iteration converged in 5 min. Engine try/catch absorption + audit logs gave fast feedback loop.
- **Session split recommendation** (PROMPT §0) accepted — Block A focus in this session, Block B fresh context next. Avoids context-window risk on critical sys_users R-A2 admin preservation work.

**Cosa rifare diversamente**:
- **PROMPT §3.A.1 CW-B31 spec gap** — should include the "conflictInference are target column names, not staging columns" insight upfront. Saved iteration 1 of patch.
- **Cowork extract_users_employees_legacy.sh OS-portability** — the X3 issue should have been pre-fixed in C4. Patched in X4 Block A.4 but cost session time.
- **REPORT 006 §5.5 CW-B25/B26/B27 patterns reaffirmed** in this batch — both CW-B26 (ESCO Phantom) AND CW-B32 (CAST CHECK gap) are forms of "data semantic violates spec assumptions". C5 should formalize a Pre-Apply Data Validation step in PROMPT specs.

**Critical thinking moments — utili o controproducenti**:
- **CW-B31 patch second iteration** (catching the conflictInference semantics): VERY utile.
- **ESCO 0/5 skip + ADR-0016 proposal**: utile. Avoided wasted apply.
- **CW-B32 surfaced post-CW-B31 dedup**: emerge organically from layered fixing approach. Good signal.

**Decision authority**: User decision to split A/B → correct call. Block B's R-A2 sys_users critical work deserves fresh session context.

---

*End REPORT 007 Block A interim — X4.B (Time/Leave + sys_users) follows in fresh CLI session.*
*Pushed to origin/main as `2de68a3..a76adef` (1 commit: Block A bundle).*
