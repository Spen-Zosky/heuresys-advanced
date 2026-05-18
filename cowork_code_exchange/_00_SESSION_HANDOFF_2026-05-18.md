# _00_SESSION_HANDOFF_2026-05-18.md

**Purpose:** state-passing artefact from this Cowork session (claude.ai web) to the next Cowork session (Desktop Cowork on Windows with filesystem + MCP access).
**Author:** Cowork claude.ai web session, 2026-05-18 ~22:30 GMT+2
**Audience:** next supervisor instance, reading cold without conversational context.
**Read order recommendation**: §1 first (executive state), then §6 (open items) and §5 (bias catalog), then the rest in order if you have time. The whole file is ~3000 words.

---

## §1 — Executive state

**Project**: Heuresys, full-stack AI-HRMS platform owned by Enzo Spenuso. The relevant subsystem for this handoff is the **brownfield Wave 1 executor**, which imports data from `legacy_mirror.*` → `staging.wave1_*` → `sys.*` within the single PostgreSQL database `heuresys_advanced` on `oracle-vm-default` (80.225.82.207).

**Session deliverables, in order of execution**:
1. **MIGRATION_STATUS_2026-05-18.md** (Phase 1 forensic baseline) — 67KB, 11 sections, 30 atomic SQL inspections. Committed at `93e1830`.
2. **GOAL_B_REPORT_2026-05-18.md** (lineage integrity check + HANDOFF reconciliation + staging cleanup + stats refresh) — 12KB. Committed at `fc0228b`.
3. **Goal 001a v5** (audit-wired engine + transform-compiler + SQL-side INSERT-SELECT UPSERT refactor for 12 mechanical transforms + Path B cleanup of stuck DEMO run). 8 atomic commits attributable + REVIEW commit. PLAN reached v5 (5 revisions), one closure attempt rejected (interim REPORT) before final acceptance.

**Session metadata**:
- ~30 EXEC turns of Goal 001a + ~15 supervisor-side authoring turns
- 12 substantive supervisor errors over the session (catalogued in §5.2)
- 3 instances of executor protocol-discipline halts (catalogued in §5.1)
- 5 PLAN versions of `_02_PLAN_001_*` (v1 → v2 → v3 → v3-bis → v4 → v5)

**Where things stand right now (at this handoff time)**:
- Goal 001a CLOSED via `_05_REVIEW_001a_audit_upsert_refactor.md`.
- Working tree of `D:\heuresys-advanced\` is clean for code modules; cowork_code_exchange/ contains all PLAN/REPORT/REVIEW artefacts as committed history.
- `origin/main` is **behind local** by several commits — the session intentionally did not `git push` (Enzo's decision: review locally first).
- No DB writes pending, no transactions in flight, no migrations behind.
- The brownfield Wave 1 pipeline now functions at debug-scale (20-cap) via SQL-side UPSERT for 12 mechanical transforms. 852/1177 mappings (using JSON_EXTRACT or LINEAGE_SOURCE_NK) are correctly SKIPPED with forensic audit emission. Full-scale 47k run is NOT verified — that's Goal 001b scope.

---

## §2 — Architecture context (the must-knows)

### 2.1 — The reframing that took most of Phase 1 to discover

The original mental model — "migrate from DB `evo_heuresys` to DB `heuresys_advanced`" — was wrong. **The real architecture is brownfield intra-DB**: a single database (`heuresys_advanced` on `oracle-vm-default`) contains the schemas `legacy_mirror` (97 tables, ingested via SQL seed scripts at bootstrap), `staging.wave1_*` (intermediate stage for the import pipeline), and `sys.*` (the target canonical schema). There is no separate source DB to connect to; `legacy_mirror` is the effective source.

This reframing is documented in MIGRATION_STATUS §10 E10-1. Future supervisors should never re-introduce the "two DB" framing.

### 2.2 — Topology

- **VM**: `oracle-vm-default` (80.225.82.207), Ubuntu 24.04 ARM64, single Postgres 16.14 cluster on port 5432. Single user-DB `heuresys_advanced` (plus `heuresys_platform`, `heuresys_test`).
- **Access from Windows host (DESKTOP-KH728P2)**: SSH tunnel on local port 5433 → VM 5432, plus claude-mem service tunnel on 37777. CLI uses `ssh oracle-vm-default 'sudo -u postgres psql ...'` for read-only diagnosis and parameterized queries for writes.
- **Repos**: live on Windows at `D:\heuresys-advanced\` (target) and `D:\evo.heuresys.com\` (legacy stack reference). NOT on the VM.
- **Backup**: `pg_dump --format=custom` available on VM at `/home/ubuntu/backups/`. Pre-Goal-001a backup at `heuresys_advanced_pre_goal001a_v4_20260518_1657.dump` (125MB, SHA `9c731c52…`).

### 2.3 — Brownfield engine codebase

Module path: `apps/api/src/modules/brownfield-wave-executor/`. Key files (verified by CLI's read at evidence gate, turns 6-7 of v2 EXEC):

- `engine.ts` — orchestrator, contains state machine (`setWaveStats`), `executeValidate`, `executeApprove`, `executeUpsert` (now calls SQL-side path, JS-side dead-code-wrapped in `if (false)`)
- `repository.ts` — DB access wrappers, contains `writeAuditApproval`, `batchWriteLineage`
- `service.ts` — top-level service wrapping engine; `trigger()` lifecycle method with 10 `logRunEvent` call sites (added in v4 EXEC)
- `transform-compiler.ts` (NEW v4) — pg-format-safe SQL fragment compiler for 12 mechanical transforms (322 lines)
- `run-logger.ts` (NEW v4) — single `logRunEvent` primitive against `audit.import_run_logs` (66 lines)
- `upsert-sql.ts` (NEW v5) — `executeUpsertSqlSidePerMapping`, the SQL-side INSERT-SELECT-ON CONFLICT path (410 lines)
- `transforms.ts` — legacy JS-side `applyTransform`, still referenced by deprecated dead code
- `loader.ts`, `routes.ts`, `state.ts` — unchanged through Goal 001a

Tests: in `apps/api/test/` (NOT `__tests__/` — vitest.config uses `test/**/*.test.ts`, a non-obvious convention to remember).

### 2.4 — Transform vocabulary

14 distinct `column_mapping_transform` codes appear in `brownfield.column_mappings` (1177 rows total). Discovered at v2 EXEC turn 3 (CLI baseline B3). Distribution:

- **Mechanical (12 codes, 325 rows, Goal 001a scope)**: DIRECT_COPY, CAST_TIMESTAMPTZ/INT/VARCHAR/BOOLEAN/NUMERIC, TRIM, UPPERCASE, LOWERCASE, CONSTANT, SKIP, LOOKUP_FK
- **Non-mechanical (2 codes, 852 rows, Goal 001b scope)**: JSON_EXTRACT (759), LINEAGE_SOURCE_NK (93)
- **Available but unused (8 codes, 0 rows)**: present in `transforms.ts` switch but no current mapping uses them — handled uniformly as `UnsupportedTransformError` via the escape path

---

## §3 — Protocol state and conventions

### 3.1 — cowork_code_exchange/ canonical files

| File | Status | SHA-256 (truncated) |
|---|---|---|
| `_01_PROMPT_001_audit_upsert_refactor.md` | canonical, unchanged | (from Cowork v4-era authoring) |
| `_02_PLAN_001_audit_upsert_refactor.md` | canonical v5 (live) | `f6919b79…` |
| `_02_PLAN_001_v4.md` | archive | `2d15860d…` |
| `_02_PLAN_001_v3-bis.md` | archive | `5aa42fa7…` |
| `_03_EXEC_001_audit_upsert_refactor.md` | HALTED snapshot (preserved, turn 3 halt) | (unchanged since 17:11 UTC) |
| `_03_EXEC_001a_audit_upsert_refactor.md` | append-only log, turns 1-30 | (final at REVIEW commit) |
| `_04_REPORT_001a_audit_upsert_refactor.md` | canonical (final, supersedes interim) | (per CLI summary) |
| `_04_REPORT_001a_interim.md` | archive of rejected closure attempt | (renamed via git mv) |
| `_05_REVIEW_001a_audit_upsert_refactor.md` | canonical (closes Goal 001a) | (this session) |

Files **v2 and v3 of PLAN are NOT_RECOVERABLE** — never committed before v3-bis overwrite. This is documented in README.md "Versioning convention" §.

### 3.2 — Versioning convention (codified in README.md during this session)

When Cowork amends an artefact:
1. Cowork generates the new version as a file in the sandbox (e.g. `_02_PLAN_001_audit_upsert_refactor_v5.md`)
2. Enzo downloads and saves as canonical `_02_PLAN_001_audit_upsert_refactor.md`, overwriting the previous canonical
3. CLI archives the overwritten canonical to `_02_PLAN_001_v<N>.md` (with `git mv` if tracked, plain `mv` if untracked)
4. Canonical (unsuffixed) is always the live version; archives are `_v<N>.md` suffixed

Special case for REPORT files: when a closure attempt is rejected and the goal continues, the REPORT is renamed `_04_REPORT_NNN_interim.md` instead of `_v<N>.md` (semantic distinction: rejected-closure vs. earlier-version).

### 3.3 — Protocol "Cowork v2" markers seen on disk

During Goal 001a, three files appeared in `cowork_code_exchange/` with `source: Cowork` attribution that **I (this Cowork session) did not create**:

- `_00_STATE_001.md` (5363b)
- `_02b_APPROVAL_001.md` (4264b)
- `_SKILL_UPDATE_MEMO.md` (7627b)
- README.md grew from 5126b (init) to 21045b — partly from CLI's versioning section, partly from unknown source

Possible origins: parallel session, previous goal in another channel, or a "Cowork v2 protocol" extension that CLI references. Origin unverified during this session because claude.ai web has no filesystem access. **Action for Desktop Cowork**: read these files directly (you have filesystem access via MCP) and either incorporate their patterns into the protocol or remove them as stale.

Pre-commit hook validator warnings (per CLI's closure summary) referenced "Cowork v2 protocol" 7-phase round-trip and an APPROVAL signature step. If that protocol version is supposed to be active, this session was operating in a degraded variant of it. Investigate.

---

## §4 — Outstanding work

### 4.1 — Goal 001b (next executor task)

Scope (per PLAN v5 §3 + REPORT §7):

- **JSON_EXTRACT** transform support (759 mappings, 64% of vocab). Requires:
  - Design of `jsonb_extract_path_text(%I, %L, %L, ...)` compilation strategy
  - Injection-test design specific to jsonb path manipulation (e.g. malicious path components like `["__proto__"]`, SQL keywords as path elements)
- **LINEAGE_SOURCE_NK** transform support (93 mappings). Requires:
  - Code inspection of `transforms.ts` to understand current semantics (not yet done in this session)
  - PG SQL compile fragment design after semantics are clear
- **LOOKUP_FK target-schema introspection fix** (Goal 001a REPORT §7 item 1). Compile-time introspection of target columns to filter SELECT list — fixes 3 mappings that currently SKIP with `insert_failed: column "skills_id" does not exist`.
- **Type coercion auto-wrap** (REPORT §7 item 2). When target column is non-text-compatible (e.g. `smallint`), auto-wrap DIRECT_COPY with CAST — fixes 2 mappings.
- **ON CONFLICT inference for sys_user_certifications** (REPORT §7 item 3). Decision required between (a) emit `ON CONFLICT DO NOTHING` for tables without UQ — silent semantics, (b) emit error-and-record audit row — explicit failure semantics. REVIEW §3.3 recommends (b).
- **Full-scale 47k Wave 1 verification** (the original A8 criterion from PLAN v4 §0). `sys.sys_skills ≥ 5000` post-run, wall-clock ≤ 10 minutes, complete audit trail.

Estimated turn budget: **25-30 turns**. Allocation in REVIEW §6.2.

### 4.2 — Cowork-side maintenance (not part of any goal)

| # | Item | Priority | Owner |
|---|---|---|---|
| O1 | Enable `pg_stat_statements` extension on `oracle-vm-default` cluster (CREATE EXTENSION + cluster config + restart) | medium | Enzo decision + next supervisor |
| O2 | Update cowork-exchange pre-commit hook validator to recognize: `_04_*_001a_*` naming variants (currently warns), `_04_*_interim.md` pattern, multi-file PLAN/REPORT versioning per README convention | low | next supervisor |
| O3 | Emit fresh APPROVAL signed against PLAN v5 canonical (SHA `f6919b79…`); existing APPROVAL signs v3-bis (stale per validator) | low | next supervisor |
| O4 | Investigate the 3 unattributed files (`_00_STATE_001.md`, `_02b_APPROVAL_001.md`, `_SKILL_UPDATE_MEMO.md`) found in `cowork_code_exchange/` during turn 9 archiving — Desktop Cowork can read these directly | low (curiosity/hygiene) | Desktop Cowork |
| O5 | Decide on commit/push of session deliverables to `origin/main`. Currently several commits ahead of origin/main, deliberately not pushed | medium | Enzo + Desktop Cowork |

### 4.3 — Stretching ahead

After Goal 001b: the original 4 goals (A/B/C/D) from MIGRATION_STATUS §8.B remain, of which A is now consumed as 001a. The remaining are:

- **Goal C** — Wave 2/3/4 mapping discovery and ingestion (not yet scoped; estimated 60+ turns over multiple sessions)
- **Goal D** — Restore legacy `evo_heuresys` DB from OCI bucket if forensic source parity is needed (estimated 20 turns, low priority — only if Goal 001b reveals data integrity questions that need legacy comparison)

---

## §5 — Bias catalog (the operational memory for future supervisors)

This is the single most important section for a new Cowork to read. It captures patterns that will recur.

### 5.1 — Executor patterns to preserve and reinforce

Three behaviors from CLI that are the protocol's working ideal:

**E1 — Evidence-gated halt.** When CLI's reading of the codebase or DB state contradicted the PLAN's assumptions, CLI halted EXEC and produced a verbatim-evidence comparison (e.g. "PROMPT/PLAN assertion vs Reality from engine.ts"), then proposed 2-3 explicit options with rationale and recommended one. **Did not silently absorb** the discrepancy, did not inflate budget to compensate, did not select an option without supervisor consent. Observed at turn 3 of v2 EXEC (14 transform codes discovery) and turn 8 of v3-bis EXEC (E1-E5 verbatim code reads that revealed 2 of 3 audit gaps were false).

**E2 — Transparent scope-deferral with explicit ASK.** CLI's interim REPORT §6.1 documented the deferred SQL-side refactor with full root cause analysis, recommendation, and explicit ask to supervisor for decision. **This is the single behavior that made supervisor intervention possible.** Without this transparency, Goal 001a would have shipped with Problem 1 (47k OOM) unresolved.

**E3 — Proactive edge case surfacing.** When CLI noticed an edge case not anticipated by the PLAN (UUID NK fallback row-skip in JS-side path), it surfaced the case proactively at EXEC start of the relevant step, asked for 1 turn of investigation, and got it. **No assumption-and-proceed.**

The new supervisor should cite these patterns explicitly when authoring the Goal 001b PROMPT and PLAN. The expectation should be set up-front that this is how the executor operates.

### 5.2 — Supervisor failure modes catalogued from this session

I (Cowork claude.ai web) made 12 substantive errors during this session. They fell into four classes:

**Class A — Unverified assumption errors** (5 instances): asserting facts about the codebase, DB state, or filesystem topology that I couldn't directly observe.
- *Errors 1-2*: assumed two separate DBs and VM-hosted repos; reality was intra-DB and Windows-local repos
- *Error 3*: wrote spec with column name `import_run_id` when actual was `source_lineage_import_run_id`
- *Error 4*: read `reltuples=49` as exact count in MIGRATION_STATUS, then wrote spec assuming pre-state of 49 rows (actual: 0)
- *Error 5*: instructed CLI to write `=0` in HANDOFF based on stale data; DB factually held `=1`

**Class B — Inattention errors on verifiable details** (4 instances): math, counts, paths that could have been checked but weren't before release.
- *Error 6*: PLAN v3 §0 had 75%/25% as percentages when arithmetic gave 27.6%/72.4%
- *Error 7*: PLAN v3 §2.1 invented baseline-capture status that didn't match actual EXEC log
- *Error 8*: PLAN v3 §2.2 listed file paths (`executeUpsert.ts`, `lineage-writer.ts`) that don't exist; code lives in `engine.ts` and `repository.ts`
- *Error 9*: PLAN v3 §1 had vocab counts UPPERCASE=2/LOWERCASE=2 (actual: 3/1)

**Class C — Internal consistency errors** (2 instances): document contradicts itself between sections.
- *Error 10*: PLAN v3 said "overwrite v2 in place" but sandbox generated `_v3.md` sibling
- *Error 12*: PLAN v4 §2.2 step 4(a) mandated SQL-side refactor; PLAN v4 §2.6 acceptance criteria didn't verify it. Inevitable consequence: CLI delivered hybrid that met all 10 criteria but skipped the mandated step.

**Class D — UX consideration errors** (1 instance): not thinking about workflow cost from the user's perspective.
- *Error 11*: Instructed Enzo to overwrite v3-bis canonical with v4 without considering that he was manually doing the download/save and would lose visibility of the version history without a separate archive step

### 5.3 — Discipline practices applied (and their limits)

From error #6 onward, I articulated five disciplines:

1. Math by calculation, not memory
2. Paths and column names from authoritative source (REPORT or CLI direct query), never invented
3. Affermazioni condizionali on filesystem state where I have no direct visibility
4. Verify with CLI before specifying technical objects I can't see
5. Internal re-read of every file I produce before release

The disciplines reduced but did not eliminate errors. Error #12 (consistency gap in PLAN v4) occurred AFTER these were in place. The missing pattern was: **cross-check that every functional step in §2.2 maps to ≥1 acceptance criterion in §2.6 AND vice versa**.

This sixth discipline is now codified in PLAN v5 §-1 standing lesson. The new supervisor should adopt all six as baseline practice.

### 5.4 — Why Phase 1 forensic was incomplete

MIGRATION_STATUS Phase 1 was a high-quality DB-only forensic survey, but it contained two inferential errors that propagated through PLAN v1 → v4:

- **§10 E10-4 inferred**: "the COMPLETE state lives in the engine's in-memory state machine, not in the durable `brownfield.import_runs.import_run_status` column." **Reality** (per CLI evidence E2 turn 8 of v3-bis EXEC): the engine writes 2 of 3 audit tables correctly. The 0 counts were artifacts of `afterAll` test cleanup, not absence of writes.
- **§8.A high #3 inferred**: "All 52 lineage rows have `source_lineage_import_run_id = NULL` — the executor never back-populates the FK." **Reality** (per E1 + E5): `batchWriteLineage` populates it; the 52 NULL are historic FK `ON DELETE SET NULL` artifacts.

The lesson: **DB-only forensic is insufficient. Code-reading must accompany DB counting** for any claim of the form "the engine does/doesn't do X." This lesson is now standing in PLAN v5 §-1.

---

## §6 — Recommended first turns for next supervisor

Concrete actions for the new Cowork Desktop session, in order:

1. **Read this handoff fully**. ~3000 words, 10 min.
2. **Read `_05_REVIEW_001a_audit_upsert_refactor.md`** for the formal closure context. ~3500 words, 15 min.
3. **Read `_04_REPORT_001a_audit_upsert_refactor.md`** for what was actually delivered. ~5000 words, 15 min.
4. **Read MIGRATION_STATUS §10** (escalation register) — orient on what was known forensically about the system pre-Goal-001a.
5. **Use filesystem access (your MCP Desktop Commander) to investigate the 3 unattributed files** (O4 in §4.2). Either incorporate or remove. Report findings as part of your first PROMPT to CLI.
6. **Decide on git push**: working tree has several commits ahead of origin/main. Recommend `git log origin/main..HEAD --oneline` to see the queue, then ask Enzo. Push or not, before starting Goal 001b.
7. **Author `_01_PROMPT_002_*.md`** for Goal 001b. Use PLAN v5 of Goal 001a as architectural template — same sectioning, same versioning convention, same hard guard-rails structure, same explicit cross-check step↔acceptance. Goal 001b's scope is enumerated in §4.1.

### 6.1 — Before writing the Goal 001b PROMPT, decisions needed from Enzo:

- ON CONFLICT semantics for sys_user_certifications: DO NOTHING (silent) vs error-and-record audit row (explicit failure). Recommend explicit failure per REVIEW §3.3.
- Whether to enable `pg_stat_statements` (O1) before Goal 001b starts, to give the executor better telemetry options.
- Goal 001b turn cap: REVIEW §6.2 suggests 25-30. Confirm with Enzo before locking.

### 6.2 — Operating principles inherited from this session

- **Use the protocol gates** — `_01_PROMPT_*` → `_02_PLAN_*` → supervisor review → `_03_EXEC_*` (only after explicit "PLAN approved, proceed with EXEC" from supervisor) → `_04_REPORT_*` → `_05_REVIEW_*`.
- **Budget for one rejected closure attempt per goal**. The pattern is normal, not exceptional. Use the `_interim.md` naming convention when it happens.
- **Code-read before declaring DB-level gaps**. This is non-negotiable.
- **Cross-check step↔acceptance** before locking any PLAN. This is non-negotiable.
- **Acknowledge executor patterns E1-E3 explicitly** in PROMPTs and REVIEWs. The protocol culture is reinforced by recognition.
- **Use ask_user_input_v0 (or equivalent) for ≤4 option decisions**. Don't write 10 paragraphs to elicit a 1-word answer.

---

## §7 — Personal note from outgoing supervisor

I made 12 errors over this session, several of which CLI had to catch and correct. The disciplines articulated in §5.3 reduced but didn't eliminate them. The protocol — with its explicit gate at `_02_PLAN_*` review and the structural separation of `_01_PROMPT_*` from `_03_EXEC_*` — is the reason none of those 12 errors shipped as silent technical debt. **The protocol overhead is the supervisor's safety net, not just the executor's.**

To the next Cowork Desktop session: you will have filesystem access that I didn't. Some of the errors I made (specifically Classes A and B) will become structurally impossible for you — you can `cat` a file before specifying its path. Use that advantage. But be aware that Classes C and D (consistency, UX) are not solved by filesystem access. They're solved by discipline. The cross-check rule from PLAN v5 §-1 is your friend.

CLI is an excellent executor. Trust the evidence-gated halts (pattern E1). When CLI says "I want to verify something before proceeding," let it. The turn budget you save by skipping verifications gets consumed at triple cost by debugging downstream.

Goal 001b is well-scoped and should be achievable in one focused session of 25-30 turns. JSON_EXTRACT is the technical risk; the rest is mechanical. Spend supervisor time on the JSON_EXTRACT design — get it right in PLAN, the EXEC will follow.

Good luck. The system you're inheriting is in good shape.

---

*End of _00_SESSION_HANDOFF_2026-05-18.md*
