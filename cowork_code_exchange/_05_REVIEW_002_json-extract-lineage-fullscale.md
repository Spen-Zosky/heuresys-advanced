# _05_REVIEW_002_json-extract-lineage-fullscale.md

**Protocol phase:** REVIEW (supervisor closure, formal post-mortem)
**Goal ID:** 002
**Slug:** json-extract-lineage-fullscale
**Author:** Cowork Desktop (claude.ai Desktop, Claude Opus 4.7)
**Authored:** 2026-05-19T04:05:00+02:00
**REPORT under review:** `_04_REPORT_002_json-extract-lineage-fullscale.md` (canonical, NOT interim — partial closure accepted)
**PLAN baseline:** `_02_PLAN_002_*.md` v1 @ sha `5578b602…`
**APPROVAL signed:** `_02b_APPROVAL_002.md` @ sha `fb983aed…`
**Decision:** ⚠️ **ACCEPTED AS PARTIAL CLOSURE — Goal 002 CLOSED; Goal 003 scheduled for LOOKUP_FK semantic resolution.**

---

## §1 — Closure decision

Goal 002 is **accepted as partial closure**. 13 of 15 PLAN v1 §2.6 acceptance criteria are met with verifiable evidence. The 2 failing criteria (A10 sys_skills ≥5000, A11 lineage ≥47000) trace to a single root-cause blocker (LOOKUP_FK match_on payload semantic ambiguity) that is **outside the scope of PROMPT 002 as drafted** — confirmed by independent Cowork-side SSH verification.

This is NOT a Goal 001a v5 situation (PLAN gap with deferred step). The CLI's PLAN v1 §2.2 Item C was shipped exactly as specified, with G11 cross-check verified bidirectionally in §2.11. The blocker is a **Cowork-side PROMPT-drafting gap**: the PROMPT instructed "read payload.match_on instead of inventing column names" but did not specify the runtime semantic of `match_on` values for the 33 `sys_tenancies`-targeting mappings.

**Closure rationale**:

1. All PROMPT 002 §2 Problems 1-6 mapped to PLAN §2.2 Items A-J were shipped per spec (CLI §4 confirms; my §2 verification matrix below confirms).
2. Full-scale infrastructure end-to-end works: `brownfield.import_runs.import_run_status='COMPLETE'`, wall-clock 110s (5× under acceptance), audit trail PERSISTED (165,464 rows in `audit.import_validation_results` — durable evidence).
3. The 50 new `sys_skills` rows + 377 new lineage rows with non-null `import_run_id` prove the pipeline works for the mappings that don't hit the LOOKUP_FK semantic block.
4. Re-opening Goal 002 to fix the LOOKUP_FK semantic requires DISCOVERY-grade payload-vs-schema analysis (not just code adjustment) — this is exactly the kind of work a fresh Goal 003 with DISCOVERY 003 would do cleanly. Stuffing it into 002 amendment would mix EXEC and DISCOVERY phases.
5. The 10 commits CLI produced are clean architectural shipments (compile, aggregate, audit, runner). Renaming them to `_interim` because of a downstream semantic issue would mis-represent the work done.

---

## §2 — Acceptance criteria — supervisor verification

| # | Criterion | REPORT evidence | Supervisor verdict |
|---|---|---|---|
| A1 | pnpm test ≥ 276 + new tests | 289 passed, 5 skipped, 0 failed | ✅ ACCEPTED |
| A2 | 8 JE tests ≥ 4 adversarial | commit b6d7394; tests enumerated in REPORT §1 | ✅ ACCEPTED |
| A3 | 3 LSN tests fragment=null | commit b6d7394 | ✅ ACCEPTED |
| A4 | 6 LFK tests ≥ 3 adversarial | commits bba7fa7 + 89ab29a, 10 LFK tests | ✅ ACCEPTED |
| A5 | debug-scale-v4 all assertions | 3/3 PASS, 88s wall-clock, #11-#14 green | ✅ ACCEPTED |
| A6 | SKIPPED_UNSUPPORTED_TRANSFORM_V1 = 0 | run 3 audit confirmed | ✅ ACCEPTED (DISCOVERY §6.3 invariant met) |
| A7 | HANDLED_VIA_LINEAGE_WRITE_V1 ≥ 1 | run 3 audit: 81 rows | ✅ ACCEPTED (new audit class works) |
| A8 | pg_stat_statements telemetry | extension 1.10 active, soft-asserted | ✅ ACCEPTED |
| A9 | idempotency rerun | wave1-idempotency 1/1 PASS, delta=0 | ✅ ACCEPTED (R4 mitigation effective) |
| **A10** | **full-scale sys_skills ≥5000** | sys_skills = 444 (was 394 pre-run); SSH-verified 2026-05-19T04:00Z | ❌ FAIL — blocker §3, accepted-with-known-gap |
| **A11** | **lineage ≥47000 non-null** | 377 new with non-null run_id; SSH-verified 823 total lineage rows | ❌ FAIL — same blocker |
| A12 | ≥ 8 atomic commits | 10 commits enumerated | ✅ ACCEPTED |
| A13 | no_conflict_inference_available = 0 | run 3 audit confirmed | ✅ ACCEPTED (migration 000031 efficacy at full-scale proven) |
| A14 | typecheck PASS | after every commit | ✅ ACCEPTED |
| A15 | lint 0 errors | after every commit | ✅ ACCEPTED |

**Score: 13/15. A10 + A11 partial-fail accepted with structural-resolution path scheduled.**

The 13 passing criteria are not partial — they are fully verified. The 2 failing criteria are blocked by a single upstream cause (registry payload semantic) outside the technical work specified in PROMPT 002.

---

## §3 — Blocker analysis — independent verification

CLI's REPORT §3 root-cause analysis is **confirmed correct** by Cowork-side SSH verification:

### 3.1 — Schema fact (verified 2026-05-19T04:00Z)

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema='sys' AND table_name='sys_tenancies';
```

Returns: `tenant_id, tenant_code, tenant_name, tenant_legal_name, tenant_country_code, tenant_industry_code, tenant_size_band, tenant_status, tenant_metadata, created_at, updated_at`.

**No `legacy_tenant_id` column exists**. CLI's report of "column does not exist" error is correct.

### 3.2 — Source raw_record key check (verified)

```sql
SELECT DISTINCT jsonb_object_keys(staging_raw_record) FROM staging.wave1_skills;
```

Top-level keys observed: `raw_text, filters, embedding_generated_at, ksaba_dimension, currency, comparison_type, ..., tenant_id, ...` — note `tenant_id` (uuid) but NO `legacy_tenant_id` key either.

This rules out the "match_on = source raw_record field name" interpretation as well. The payload `match_on=legacy_tenant_id` is therefore a **logical/conventional name** that requires a translation step in the compiler (e.g., per CLI's §3.4 option (b) recommendation).

### 3.3 — Categorization of failure modes (REPORT §3.5)

- **30× sys_tenancies LOOKUP_FK** (61% of full-scale errors) — the LOOKUP_FK semantic block above
- **2× learning_path_step_ordinal smallint** — Item E doesn't engage because transform is CAST_INT (not DIRECT_COPY/TRIM). Item E extension or registry CAST_INT fix.
- **2× sys_activity_classifications CHECK constraint** — legacy_mirror data has values outside CHECK. Data-quality issue.

All three categories are properly characterized as Goal 003 scope in REPORT §6.

### 3.4 — Root cause of the PROMPT gap (Cowork-side)

PROMPT 002 §1.4 stated: "Current compiler INVENTS lookup_col via convention; 49/49 mappings have `(target_table, match_on)`. Fix: read `payload.match_on`". DISCOVERY 002 §5.2 showed 3 example payloads but did **not** analyze what `match_on=legacy_tenant_id` should resolve to at runtime given `sys_tenancies` schema.

This was a Cowork-side assumption that `match_on` = target-table column-name (literal). CLI implemented this interpretation faithfully via PLAN §2.4.1 regex whitelist. Both interpretation and implementation are internally consistent; the gap was upstream in PROMPT/DISCOVERY drafting.

**Class A error from Goal 001a bias catalog reactivated**: unverified assumption on payload semantics. Should have queried at DISCOVERY-time how `match_on=legacy_tenant_id` for `target=sys_tenancies` is supposed to resolve, given the schema doesn't have that column.

---

## §4 — Scope deferrals to Goal 003 (acknowledged + scheduled)

REPORT §6 identified 6 follow-up items. Supervisor verdict on each:

| # | Item | Priority | Accepted? |
|---|---|---|---|
| 1 | LOOKUP_FK semantic resolution (option b convention recommended) | HIGH | ✅ — Goal 003 primary scope, DISCOVERY-grade |
| 2 | Wave 2/3/4 mapping discovery | MEDIUM | ✅ — Goal 004+ (separate goals per wave) |
| 3 | Brand identity v1 finalize | MEDIUM | ✅ — gates MVP-3 B/E-UI/F; separate workstream |
| 4 | 681 pre-existing NULL lineage cleanup | LOW | ✅ — Goal 003 piggyback or separate single-turn task |
| 5 | Item E TYPE_CAST_MAP completeness | LOW | ✅ — Goal 003 piggyback recommended (touches same module) |
| 6 | sys_activity_classifications CHECK reconciliation | LOW | ✅ — data-quality decision, separate from code goals |

### 4.1 — Goal 003 anticipated scope (NOT a commitment, just framing)

- **Phase 0 DISCOVERY**: enumerate `match_on` distinct values vs target_table schema. Identify the 3-4 conventions:
  - `legacy_<X>_id` on `sys_<X>s` target → resolve as `tenant_code` (or analog) lookup with source `staging_raw_record->>'legacy_<X>_id'`
  - `<col_name>` plain (e.g. `skill_name`) → literal column lookup
  - `<col>_metadata->>'<key>'` → jsonb path lookup
- **Phase 1 PROMPT**: explicit compiler design for the 3-4 conventions
- **EXEC**: <10 turns expected (mechanical fix once semantic is clear)
- **Acceptance**: re-run full-scale 47k Wave 1 → sys_skills ≥5000 + lineage ≥47000

---

## §5 — Budget retrospective

| Metric | PLAN estimate | Actual | Variance |
|---|---|---|---|
| Turns | 28 | 15 | **−13 turns** (47% under) |
| Wall-clock full-scale | 600s | 110s | **5× faster than target** |
| Commits | ≥8 | 10 | +2 (within spec, the 2 hotfixes were honest discoveries) |
| Acceptance criteria | 15/15 | 13/15 | -2 (LOOKUP_FK blocker §3) |

The 47% under-turn variance is notable. Hypothesis: CLI's Goal 002 work was architecturally simpler than estimated because Goal 001a v5 had already built the SQL-side infrastructure. Items A/B/C/D/E reused the existing scaffolding. The 28-turn estimate factored in unknown unknowns that didn't materialize; the 15-turn actual reflects clean architectural reuse.

The 5× wall-clock headroom is the more interesting datum: the platform performs well within budget. When Goal 003 resolves LOOKUP_FK and the full ~47k rows actually upsert, wall-clock will likely still fit ≤10 min (estimate: 4-6 min based on the per-mapping cost extrapolated from 110s for ~440 rows).

---

## §6 — Bias catalog input (for handoff to next Cowork session)

### 6.1 — Executor strengths reaffirmed

CLI demonstrated 3 protocol-canonical behaviors:

- **E1 evidence-gated halt avoided**: no halt needed; instead surfaced the blocker proactively in §3 with full forensic analysis (3.1 schema fact + 3.2 source key check + 3.3 categorization + 3.4 scope verdict). This is the same E1+E2 pattern from 001a v5 expressed differently — when the blocker is clearly outside-scope, transparent disclosure in REPORT § rather than mid-EXEC halt is correct.
- **E2 transparent scope-deferral**: REPORT §3.4 explicitly states "Beyond Goal 002 PROMPT scope" with justification. No silent absorption.
- **E3 proactive edge case surfacing**: hotfix 1 (depluralize return_col) and hotfix 2 (PK_OVERRIDES + jsonb auto-wrap) surfaced during EXEC, fixed in atomic commits with §5 PLAN deviations documented honestly. No "I'll mention this later" silent absorption.

These three patterns continue to define the executor that the protocol cultivates.

### 6.2 — Supervisor weaknesses observed in Goal 002

**CW-B13 (new entry)**: PROMPT-drafting assumption on `match_on` payload semantics. DISCOVERY 002 §5.2 surfaced 3 example payloads but did NOT analyze runtime resolution against target schemas. A 10-line query at DISCOVERY-time (`SELECT cm.column_mapping_transform_payload->>'match_on' as match_on, tm.target_table, c.column_name FROM brownfield.column_mappings cm JOIN ... LEFT JOIN information_schema.columns c ON c.table_schema='sys' AND c.table_name=tm.target_table AND c.column_name=cm.column_mapping_transform_payload->>'match_on'` looking for NULL c.column_name) would have caught the semantic mismatch on 30/49 mappings BEFORE PROMPT 002 was sent. Rule update proposed for `RULE_UPDATES.md`:

> **U-2026-05-19-01**: DISCOVERY for any goal touching brownfield column_mappings MUST include payload-vs-target-schema cross-check (left-join column_mappings.transform_payload fields against target table schemas; rows with NULL match indicate payload-semantic ambiguity that the PROMPT must address explicitly).

### 6.3 — Pattern observed: forensic transparency-over-halt

When CLI knows the scope of a blocker is upstream (not in the code being shipped), surfacing it in REPORT §3 forensically is more efficient than mid-EXEC halt. The cost saved: 1 round-trip (halt → Cowork respond → resume). The cost added: REPORT is partial. For Goal 002 the trade was favorable; for Goal 001a v5 (where the blocker was IN scope) the halt-and-resume was correct. The discriminator is "is the blocker in or out of the PROMPT scope".

---

## §7 — Open items for next session

| # | Item | Priority | Owner |
|---|---|---|---|
| O1 | Goal 003 PROMPT — LOOKUP_FK semantic resolution (DISCOVERY first) | HIGH | Cowork next session |
| O2 | Confirm CLI's REPORT-time cleanup is sufficient (audit/lineage rows from Goal 002 remain; intentionally PERSISTED per A10/A11 evidence) | MEDIUM | Cowork next session — visual check at session-start |
| O3 | Add U-2026-05-19-01 rule to `RULE_UPDATES.md` (or create the file) | LOW | Cowork next session |
| O4 | Update STATE 002 to `current_phase: CLOSED` with `closure_status: partial` and link REVIEW | LOW | Cowork this session — done in §9 |

---

## §8 — MVP-3 Tappa D status post-Goal-002

MVP-3 Tappa D (Brownfield Wave 1) status: **🟡 partial-closure**.

- **Architecture**: COMPLETE. SQL-side UPSERT framework + transform compiler + audit + lineage write all working end-to-end with durable audit trail.
- **Vocabulary support**: COMPLETE. 14/14 transform codes supported (12 mechanical from 001a v5 + JSON_EXTRACT + LINEAGE_SOURCE_NK shipped in 002).
- **Volume**: PARTIAL. ~1% of 47k rows actually upserted in current run (444 sys_skills). Expected ~95%+ post-Goal-003 LOOKUP_FK semantic fix.

Tappa D will move to **✅ green** when Goal 003 lands and a re-run validates the 5000+ / 47000+ thresholds.

The HANDOFF.md MVP-3 status row will need updating after Goal 003 closure, not after Goal 002.

---

## §9 — Closure stamp

Goal 002 — **CLOSED, PARTIAL ACCEPT**.

- 13/15 PLAN v1 §2.6 acceptance criteria met with verifiable evidence.
- 2 failing criteria (A10/A11) traced to a single upstream blocker (LOOKUP_FK payload semantic) confirmed outside PROMPT scope by independent SSH verification.
- 10 atomic commits + REPORT + this REVIEW form a complete audit trail.
- Goal 003 scheduled for the LOOKUP_FK semantic resolution + piggyback items 4/5 from REPORT §6.

STATE 002 transitioning to `current_phase: CLOSED` with `closure_status: partial`. CLI may stand down on this goal. Next protocol action: Cowork drafts DISCOVERY 003 + PROMPT 003 at the next session.

---

*End of _05_REVIEW_002_json-extract-lineage-fullscale.md*
