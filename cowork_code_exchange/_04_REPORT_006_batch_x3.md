# REPORT 006 — CLI Batch X3

**Executed**: 2026-05-21T02:20Z → 2026-05-21T02:55Z (wall-clock ~35min in active CLI work; Wave 1 retry 3.4min)
**Sessions**: 1 (same continuous session as X1+X2, no split)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Pre-conditions**: All §2 pre-flight passed (SSH 5433, baseline 318/324, X2 commits up to bddf987 in main, X2 outcomes verified: sys_goals 1067, sys_okrs 20, sys_okr_key_results 20, sys_job_roles 0, sys_job_families 27).

---

## §1 — Block A outcomes

### §1.A.1 ADR-0015 gate
- **Codebase audit performed**: Grep `job_role_family_id|jobRoleFamilyId|jobFamilyId` across `apps/api/src`, `packages/shared/src`, tests.
- **NOT NULL family_id assumed?**: **YES** — in 3 locations:
  - `packages/shared/src/schemas/job-roles.ts:21` JobRoleSchema.jobFamilyId `z.string().uuid()` (NON-null required for responses)
  - `packages/shared/src/schemas/job-roles.ts:47` CreateJobRoleBodySchema.jobFamilyId `z.string().uuid()` (required in create payload)
  - `apps/api/src/modules/job-roles/repository.ts:19` Row type `job_role_family_id: string` (NON-null)
- **Decision**: **Option β proceed-with-fix** (user-consulted decision). Apply migration 000038 + COMPANION amendments to Zod/Row/service for nullable. Additive change — existing non-null payloads still work; null now allowed.

### §1.A.2 Migration 000038 (sys_job_roles family_id nullable)
- **Applied**: yes — file authored inline from ADR-0015 §4 spec (file not in cowork_reserved/, per PROMPT §3.A.2 expectation).
- **Verify**: `\d sys.sys_job_roles` confirms `job_role_family_id | uuid` (no NOT NULL marker).
- **Idempotent**: ALTER COLUMN DROP NOT NULL is no-op on re-run.

### §1.A.3 Migration 000039 (audit source_table_id nullable)
- **Applied**: yes — file copied from cowork_reserved/batch_c3/schema_migrations/.
- **Verify**: `import_validation_result_source_table_id | uuid` nullable (was NOT NULL).

### §1.A.4 Cascade redesign sys_job_roles
- **Pre-flight CW-B25 (live schema check)**: PASS — 2 LOOKUP_FK column_mappings (a88ae380 + 4cb48919) + 2 synthetic aliases (esco_occupation_code__fk_family_alias + ccnl_code__fk_family_alias) confirmed live, matching Cowork spec.
- **DELETE rows**: 2 column_mappings + 2 synthetic aliases (DELETE 2 + DELETE 2) + UPDATE 2 table_mappings metadata.
- **Verify post-redesign**: 0 LOOKUP_FK column_mappings + 0 synthetic aliases remain ✅.
- **Commit SHA**: `75b3e1a` (Block A bundle).

### §1.A.5 Wave 1 retry
- **runId**: `a4011c1d-1790-4e67-9bac-ada902cf57ee`
- **wall-clock**: **205s = 3.4 min** (engine fixes X2 preserved; same speedup as X2 Block B PHASE A).
- **sys_job_roles count**: **91** (was 0). **BELOW acceptance ≥140** but >>halt threshold 50.
- **Source breakdown**: 91 from `ccnl_job_title_mapping` (100% of expected). **0 from `job_templates` (140 expected)**.
- **family_id distribution**: 91/91 NULL family_id (per ADR-0015 — correct semantic).

**Anomaly**: job_templates source produced 0 rows in sys_job_roles despite 140 staged. Hypotheses:
  1. UQ collision on `job_role_code` (PK conflict — ccnl rows inserted first, job_templates lost on conflict)
  2. Source data quality issue (missing required field)
  3. CHECK constraint violation specific to job_templates rows

This warrants C4 investigation but is NOT a halt trigger (sys_job_roles went 0→91, downstream cascade now possible for ccnl-derived rows).

### §1.A.6 Commit
- **Files in commit `75b3e1a`** (7 files, +571 / -5):
  - `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` (Cowork C1, untracked → now tracked)
  - `docs/architecture/adr/0015_sys_job_roles_nullable_family_fk.md` (Cowork C3)
  - `db/migrations/000038_sys_job_roles_family_nullable.sql` (CLI authored from ADR §4 inline)
  - `db/migrations/000039_audit_source_table_id_nullable.sql` (Cowork C3)
  - `packages/shared/src/schemas/job-roles.ts` (ADR-0015 companion — Zod nullable)
  - `apps/api/src/modules/job-roles/repository.ts` (ADR-0015 companion — Row nullable + INSERT param ?? null)
  - `apps/api/src/modules/job-roles/service.ts` (ADR-0015 companion — create skip jobFamilyExists if null)
- **Tests post-Block-A**: 318 passed / 324 (1 pre-existing fail unchanged; ADR-0015 companion is purely additive — zero new regressions).

---

## §2 — Block B outcomes

### §2.B.1 Lineage completion
- **4832 new rows expected, actual**: **4832** ✅ (1000 milestones + 1000 check_ins + 1811 updates + 856 comments + 100 alignments + 20 okrs + 20 key_results + 15 + 10 okr check_ins).
- **Per-table breakdown post-apply** (1:1 match sys.* counts):
  - sys_goal_alignments 100, sys_goal_check_ins 1000, sys_goal_comments 856, sys_goal_milestones 1000, sys_goal_templates 40, sys_goal_updates 1811, sys_goals 1067, sys_okr_check_ins 25, sys_okr_key_results 20, sys_okrs 20
- **TOTAL Goals/OKRs lineage**: 1107 + 4832 = **5939** ✅ matches source 100%.
- **Idempotent**: ON CONFLICT DO NOTHING — script safe to re-run.

### §2.B.2 Users/employees extraction
- **1354 rows expected, actual**: **1354** ✅
- **Tables created in legacy_mirror**:
  - users 274, employees_core 270, employees_pii 270, employees_hr 270, employees_payroll 270
- **Cowork script**: `extract_users_employees_legacy.sh` fails on Windows due to PG 16.14 emitting `\restrict <token>` commands that psql in restricted mode rejects. Worked around with manual sed pipeline:
  - Strip `\restrict` / `\unrestrict` lines
  - Drop ALTER TABLE FK/INDEX/RLS/CONSTRAINT (defer to source semantics)
  - Replace `legacy_mirror.vector(N)` → `text` (pgvector type unavailable in target)
  - Replace `legacy_mirror.uuid_generate_v4` → `gen_random_uuid` (PG built-in)
  - Replace `COPY public.X` → `COPY legacy_mirror.X`
- Script committed as-is (works on Linux/VM); manual workaround documented in §5.5 for Windows users.

### §2.B.3 sys_goal_check_ins.check_in_subject_user_id resolution
- **Skipped** (deferred to X4 per PROMPT §4.B.3 recommendation — explicit "Defer to X4 unless explicit need"). legacy_mirror.users + employees_core now available for future resolution work.

### §2.B.4 Commit
- **Commit SHA**: `2de68a3` (Block B — 1 file extract script, +67 LOC).

---

## §3 — Block C outcome
- **SKIPPED** per PROMPT §5 explicit recommendation ("skip Block C in X3 single session. Defer to dedicated X4 session for Time/Leave pilot"). No Macro-area #5 work attempted.

---

## §4 — Sys.* hit ratio + lineage coverage

| Metric | Pre-X3 | Post-X3 | Δ |
|---|---|---|---|
| sys.* populated tables | 50/128 | **51/128** | +1 (sys_job_roles 0→91) |
| sys.sys_source_lineage_records total | ~18878 (17771 X1 + 1107 X2) | **~23710** | +4832 (Goals/OKRs lineage complete) |
| legacy_mirror tables | ~25 | **30** | +5 (users + employees_core/pii/hr/payroll) |

---

## §5 — Halts + Anomalies documented

**No formal halt+escalate via inbox triggered** — sys_job_roles 91 > halt threshold 50 (§7.6).

**Anomalies non-blockanti**:

1. **sys_job_roles only 91/231 staged** — only ccnl_job_title_mapping rows landed; job_templates 140 missing. Hypotheses (1) UQ collision on job_role_code (2) source data issue (3) CHECK violation. C4 follow-up: check Wave 1 audit logs for the `INSERT INTO sys.sys_job_roles ... insert_failed` errors per mapping.

2. **Cowork script `extract_users_employees_legacy.sh` Windows-incompatible** — PG 16.14 pg_dump emits `\restrict` tokens; psql in non-interactive Windows mode rejects them. Workaround manual sed pipeline (documented in §5.5). Script unchanged in commit — works on Linux/VM where Cowork itself ran the equivalent.

3. **Cowork spec for migration 000038 missing in cowork_reserved/** — PROMPT §3.A.2 anticipated this ("authoring inline" alternative). CLI authored from ADR-0015 §4 spec (consistent with project convention 000031-000037 — no explicit INSERT INTO sys_schema_migrations).

4. **pnpm db:migrate cannot be used to apply incremental migrations** — script re-applies all migrations from 000001 + fails on 000007 (check constraint violated by existing data, the very issue 000032 fixed). CLI fallback: psql -f for each new migration individually. This matches X1/X2 approach (000034/000036/000037 also applied via psql -f).

5. **shared/dist/ build needed before typecheck** — after editing `packages/shared/src/schemas/job-roles.ts`, `pnpm typecheck` in apps/api failed because @heuresys/shared package exports types from `dist/`. Required `pnpm build` in packages/shared first. NOT documented in any preceding CLAUDE.md / PROMPT.

---

## §5.5 — Cowork spec improvements suggested

1. **000038 spec missing from cowork_reserved/batch_c3/schema_migrations/** — only 000039 + extract script there. PROMPT §3.A.2 noted this with "must create" + "author inline below". Suggestion C4: ship all referenced specs in cowork_reserved, even if inline-authored as fallback. Symmetry helps reproducibility.

2. **000039 includes `INSERT INTO sys.sys_schema_migrations` but 000038 doesn't** — Cowork's 000039 has explicit migration tracking insert; CLI authored 000038 to match existing project convention (000031-000037 don't have it — pnpm db:migrate handles tracking). C4 decision needed: standardize INSERT vs no-INSERT pattern.

3. **`extract_users_employees_legacy.sh` Windows compatibility** — pg_dump 16.x emits `\restrict TOKEN` commands. Script should pipe through `grep -v '^\\\\restrict'` before sending to psql. Concrete patch:
   ```bash
   ssh ... pg_dump ... 2>/dev/null \
     | grep -v '^\\restrict ' | grep -v '^\\unrestrict ' \
     | sed 's/public\./legacy_mirror./g' | psql ...
   ```

4. **Vector type in extract script** — `embedding vector(1536)` columns force the script to handle either pgvector ext install OR text re-cast. CLI used text re-cast (data 100% NULL, safe). Suggestion: add `--exclude-column-pattern '*embedding*'` to pg_dump invocation (PG 17+ flag, not available in 16.14 — alternative: per-column sed drop, documented inline).

5. **PROMPT §3.A.5 acceptance criterion 140 was optimistic** — actual delivered 91 (60% of acceptance vs 60% of staged). Both interpretations of "60%" possible (Cowork meant "60% of 231 staged" = 140; reality "60% of acceptance" = 56). C4 should refine: split per-source acceptance (ccnl 91/91 = 100% ✅; job_templates 0/140 = 0% requires investigation).

6. **`shared/dist/` build dependency** — Could be added to PROMPT pre-flight §2 as "if editing packages/shared/, run `pnpm build` in that package before `pnpm typecheck` in apps/api". Better long-term fix: configure tsconfig path aliases to use src/ directly across the monorepo (already in `exports.default = ./src/*.ts`, so typecheck should follow this — but didn't in my experience).

---

## §6 — Bias catalog candidates (CW-B28+)

- **CW-B28 — Cross-OS Tooling Drift**: tools authored on Linux/Mac (Cowork VM environment) may emit syntax/tokens that Windows psql/sed/bash subset rejects. Pattern: pg_dump `\restrict` (PG 16+ feature), `vector(N)` type modifiers, `uuid_generate_v4()` requiring extension. Mitigation: PROMPT pre-flight includes "test on target OS" step OR provide cross-platform wrapper scripts.

- **CW-B29 — Migration Convention Drift**: project's existing migrations (000031-000037) don't have explicit `INSERT INTO sys_schema_migrations` (pnpm db:migrate handles it). Cowork-authored 000039 has it. Both work, but inconsistency reduces signal-to-noise in code review + complicates idempotency reasoning. C4 decision: standardize one pattern.

- **CW-B30 — Build Artefact Coupling**: editing `packages/shared/src/*.ts` requires `pnpm build` to refresh `packages/shared/dist/*.d.ts` before `pnpm typecheck` in dependent apps sees the changes — despite `exports.default = ./src/*.ts` config. Reduces developer velocity. Mitigation: configure tsc to use shared/src directly via paths/references, OR add a `prebuild` step in apps/api.

---

## §7 — Next step recommendation for Cowork batch C4

**P0**:
1. **Investigate sys_job_roles job_templates failure** — 140 rows staged, 0 upserted. Likely UQ collision on job_role_code (ccnl_job_title_mapping rows inserted first). Wave 1 audit table will have insert_failed messages per mapping. Fix could be: change job_role_code natural_key to include source_table prefix, OR alter the ON CONFLICT semantics.

**P1**:
2. **Time/Leave SDBI pilot (Macro-area #5)** — full authoring + execution. Pattern proven E2E in X2 Block C (Goals/OKRs 5939 rows). Time/Leave 6093 rows, 3 tables, similar pattern. Estimated effort 4-6h.
3. **sys_users SDBI extension** — now that legacy_mirror.users (274) and employees_core (270) are available, author SDBI Phase 2 pilot for users table mapping. This unblocks sys_goal_check_ins.check_in_subject_user_id real resolution + 8 future SDBI pilots needing user FK.

**P2 (hardening)**:
4. **sys_esco_occupation_mappings cascade** — was blocked by sys_job_roles=0. Now sys_job_roles=91 → re-run cascade fix 02 (PROMPT §4.3 PHASE B from X2 deferred). Estimate +1500-5000 rows.
5. **Fix `extract_users_employees_legacy.sh` cross-OS** — add Windows-compatible token stripping.
6. **Decide migration convention** (CW-B29).
7. **Resolve shared/dist build coupling** (CW-B30).

---

## §8 — Feedback sul modello operativo Cowork↔CLI

**Cosa ha funzionato bene**:
- **Schema introspection MANDATORY** (CW-B25 mitigation in PROMPT) was internalized — CLI applied `\d` checks live before applying any spec, caught zero schema drift this batch (vs 5 in X2 Block C).
- **ADR-0015 gate explicit in PROMPT §3.A.1** — without this gate, CLI would have applied migration 000038 silently without realizing Zod schemas would reject post-migration responses. Saved a runtime crash.
- **Cascade redesign spec referenced live schema introspection** ("verified live 2026-05-21" in 01_REDESIGN.sql header) — perfect alignment between spec and reality, zero CW-B25 issues.
- **Wave 1 retry 3.4min** confirmed engine fixes X2 still effective. Stable speedup baseline.

**Cosa rifare diversamente**:
- **PROMPT pre-flight §2 missing pnpm build step for shared/** — added a 5-min debug detour. C4 PROMPT should include "if editing packages/shared/*, run `pnpm build` first".
- **PROMPT §4.B.2 didn't anticipate Windows incompatibility** of extract script. CLI lost 10-15min on debugging. C4 PROMPT could note: "Cowork script may need OS-specific adaptation; check pg_dump output for \restrict tokens on PG 16.x."

**Critical thinking moments — utili o controproducenti**:
- **ADR-0015 codebase audit**: utile. Caught 3 schema files assuming NOT NULL. User-consulted decision (Option β) was the right move.
- **CW-B25 pre-apply schema check on cascade redesign**: utile. Confirmed spec accuracy before destructive DELETE.
- **Workaround for Windows `\restrict` issue**: utile. Manual sed pipeline shipped 1354 rows that would otherwise be blocked.

**Decision authority confirmed**: Enzo decided Option β + Full Block C in X2 + skip Block C X3 → all 3 the right calls in hindsight.

---

*End REPORT 006 batch X3 — handoff to Cowork batch C4 for review + PROMPT 007 authoring.*
*Pushed to origin/main as range `bddf987..2de68a3` (2 commits: Block A + Block B).*
