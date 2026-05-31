# ADR-0014 — SDBI: Semantic-Driven Brownfield Import (complement to ETL brownfield)

**Status**: ACCEPTED (2026-05-31, S951 — adopted by ADR-0023 as the schema-gap-extension mechanism for FUTURE sources whose entities have no `sys.*` target; NOT used for the existing legacy, which already has 100% table+column mapping coverage. Implementation = SDBI Phase 2 / backlog B-10, distinct from this status.)
**Date**: 2026-05-20
**Authors**: Cowork Claude (architect supervisor)
**Decision authority**: Enzo Spenuso
**Supersedes / extends**: ADR-0012 brownfield table_mapping_wave column (extends, does NOT supersede)
**Related**: ADR-0008 PIP-as-view, ADR-0010 PostgreSQL runtime location

---

## §1 — Context

`heuresys_advanced` (rewrite di heuresys-evo) usa un brownfield import deterministico per popolare `sys.*` da `heuresys_platform.public` (582 tables) via 7 lexicon domains pre-definiti (ESKAP/SKILGRO/INDOOR/ITLAB/PROGOV/OPOURSKA/H2R). Pipeline:

```
extract-wave1-legacy.sh (pg_dump)
  → legacy_mirror.*
  → staging.wave1_<target>  (uniform jsonb buffer, migration 000030)
  → brownfield.column_mappings  (1177 hand-curated mappings + 14 transform codes)
  → transform-compiler.ts + upsert-sql.ts (mechanical)
  → sys.<target>
  → sys.sys_source_lineage_records (tracking)
```

**Outcome empirico** (forensic audit `cowork_reserved/` 2026-05-20):
- ✅ 6 sys.* macro-aree popolate (sys_skills 6037, sys_learning_modules 4488, sys_learning_paths 3227, sys_activity_classifications 3276, sys_skill_families 77, sys_compensation_bands 75)
- ❌ 12 sys.* silent-skip (Class B) — root causes CW-B17 (audit blind spot), CW-B18 (registry completeness gap), CW-B19 (source-side FK gap), CW-B20 (UQ constraint block)
- ❌ 13 macro-aree HRMS hanno **target schema MISSING** in sys.* (Goals/OKRs, Recruiting, Onboarding, Surveys/Engagement, Time/Leave, ecc.) — il brownfield non sa proporre nuovi schemi target

Direttiva Enzo 2026-05-20: "SDBI ha senso come tool SPECIFICO per i casi dove l'analogia semantica AI-led aggiunge valore reale. Non è da usare come 'sostituto' del brownfield. È tool complementare."

## §2 — Decision

Introdurre **SDBI** (Semantic-Driven Brownfield Import) come **paradigma complementare** al brownfield deterministico esistente, scope-separated per casi specifici dove brownfield non basta.

### §2.1 Boundary brownfield vs SDBI (decision tree)

Per ogni nuova source area da importare:

```
   ┌─────────────────────────────────────────────────────┐
   │  Source area da importare                            │
   └─────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
   ┌────────────────────┐  ┌──────────────────────┐
   │ Target sys.* table │  │ Target sys.* table   │
   │ EXISTS in schema?  │  │ MISSING in schema?   │
   └────────────────────┘  └──────────────────────┘
            │                          │
            ▼                          ▼
   Brownfield handles            SDBI handles
   (EXPLICIT_MAP +              (AI propose schema +
    column_mappings +            mapping_card +
    transform-compiler)          temp_sdbi staging +
                                 human review +
                                 consolidation)
```

**SDBI scope**: solo Tier D (TRUE GAP) macro-aree per cui sys.* target schema NON esiste.
**Brownfield scope**: Tier A (populated) maintenance + Tier B (silent skip fix) + Tier C (mirror gap fill via extract script extension).

## §3 — SDBI architecture

### §3.1 Six-phase workflow

```
┌────────────────────────────────────────────────────────────────┐
│  PHASE 1 — SOURCE DISCOVERY (per-source-table)                  │
│  • Schema introspect (cols, types, FK, constraints)              │
│  • Sample data extract (stratified N=10-50 rows)                 │
│  • AI semantic analysis → source_table_card                      │
│  • Detect: entity vs junction, soft-delete pattern, hierarchy     │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PHASE 2 — TARGET ANALOGY MATCHING (per-source-table)            │
│  • AI proposes target sys.* schema (NEW migrations)              │
│  • OR AI proposes existing sys.* target candidates by analogy    │
│  • Field-by-field mapping con confidence (HIGH/MEDIUM/LOW)       │
│  • HUMAN CHECKPOINT (Enzo) approve/correct schema design         │
│  • Output: mapping_card.md (per source table)                    │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PHASE 3 — TEMP_ SEEDING (mechanical, post human-approval)       │
│  • Migration applied: CREATE sys.<new_table> (con FK constraints)│
│  • CREATE temp_sdbi.<new_table> (mirror schema senza FK)         │
│  • INSERT-SELECT da legacy_mirror/platform.public                 │
│  • Idempotent (TRUNCATE-and-retry policy)                        │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PHASE 4 — RELATIONSHIP TRAVERSAL (per-FK ricorsivo)              │
│  • Per ogni FK in source: traverse to dependent tables            │
│  • Repeat Phase 1+2+3 per dipendenze                              │
│  • Build graph: nodes=source, edges=FK traversal order            │
│  • Detect cycles, mark visited                                    │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PHASE 5 — CONSOLIDATION REVIEW (separata, human-gated)          │
│  • Diff temp_sdbi.<table> vs sys.<table>                          │
│  • AI proposta consolidation plan                                 │
│    - INSERT new rows                                              │
│    - UPDATE arricchimento (es. metadata)                          │
│    - SKIP duplicati                                               │
│  • HUMAN CHECKPOINT approve                                        │
│  • Execute: INSERT...ON CONFLICT into sys.<table>                 │
│  • Build/rebuild indexes + FK constraints                          │
│  • Generate sys.sys_source_lineage_records entries                │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  PHASE 6 — TEMP_ CLEANUP (post-consolidation human-confirmed)    │
│  • DROP TABLE temp_sdbi.<table>                                   │
│  • Audit row: rule_code SDBI_CONSOLIDATION_COMPLETE_V1           │
└────────────────────────────────────────────────────────────────┘
```

### §3.2 Schema locations

| Schema | Purpose | Location |
|---|---|---|
| `legacy_mirror.*` | SOURCE — pre-existing mirror of heuresys_platform.public selective subset (93 tables post C1.4) | heuresys_advanced (already exists) |
| `temp_sdbi.*` | SDBI staging — temporary tables mirror of new sys.* targets, no FK constraints, TRUNCATE-able | heuresys_advanced (NEW schema, created by migration 000034) |
| `sys.*` | TARGET — canonical schemas, FK + indexes + RLS | heuresys_advanced (existing + extended via new migrations) |
| `audit.import_validation_results` | Audit trail — extended with SDBI rule_codes | heuresys_advanced (existing, extended) |
| `sys.sys_source_lineage_records` | Lineage tracking — extended with SDBI fields | heuresys_advanced (existing, extended) |

**Decision: temp_sdbi DENTRO heuresys_advanced**, NOT separate DB. Rationale:
- Lineage continuity con existing 4099 lineage rows
- Audit infrastructure already wired (no cross-DB queries)
- TRUNCATE-and-retry policy mitigates pollution risk
- Schema isolation (no FK temp_sdbi → sys.*) limits damage scope

### §3.3 Confidence threshold policy

AI confidence per mapping_card field:

| Range | Label | Action |
|---|---|---|
| **HIGH** (≥ 0.85) | autopilot | Auto-approve, INSERT in mapping_card, proceed Phase 3 |
| **MEDIUM** (0.60-0.85) | suggest+confirm | Generate mapping_card, mark fields needing human review, halt for Enzo approval |
| **LOW** (< 0.60) | halt+ask | Stop. Ask Enzo specific question (es. "Source field X — quale semantica?"). Resume after answer. |

Confidence è AI-self-reported nel mapping_card + verified empirically via:
- Sample data validation (10-50 rows test transform → reasonable target values?)
- FK resolution test (NULL count post-transform?)
- Type compatibility check

### §3.4 Lineage tracking extension

Esistente `sys.sys_source_lineage_records` (4099 rows) viene **esteso** (NOT replaced) con SDBI provenance via nuove columns o jsonb metadata:

```sql
-- Migration 000035 (proposed): extend lineage with SDBI metadata
ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_mapping_card_id text,
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_confidence numeric,
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_ai_model_id text,
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_human_approver text;
```

Brownfield-path lineage rows: NULL su nuove columns (preserved invariant).
SDBI-path lineage rows: populated with mapping_card_id + AI confidence + approver.

### §3.5 Audit rule_codes extension (CW-B17 family + SDBI family)

Esistente `audit.import_validation_results` viene esteso con nuovi rule_codes (constants file `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` — CW-B17 patch C1.5):

| rule_code | Family | Status | Semantica |
|---|---|---|---|
| `WAVE1_ALL_RULES` | Brownfield | PASSED | (pre-existing) generic Wave 1 pass |
| `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` | Brownfield | WARNING | (pre-existing) NULL lineage hygiene |
| `HANDLED_VIA_LINEAGE_WRITE_V1` | Brownfield | SKIPPED | (pre-existing) LINEAGE_SOURCE_NK marker |
| **`WHERE_SKIP_FILTER_EXCLUDED_V1`** | **Brownfield (NEW)** | **SKIPPED** | CW-B17 fix: silent skip rows ora documentate con exclusion_reason |
| **`SDBI_CONFIDENCE_HIGH_AUTO_APPROVED`** | **SDBI** | **PASSED** | Mapping_card auto-approved (confidence ≥ 0.85) |
| **`SDBI_CONFIDENCE_MEDIUM_NEEDS_REVIEW`** | **SDBI** | **WARNING** | Mapping_card requires human review |
| **`SDBI_CONFIDENCE_LOW_HALT_ASKED`** | **SDBI** | **WARNING** | Workflow halted for AI clarification request |
| **`SDBI_HUMAN_APPROVED`** | **SDBI** | **PASSED** | Human approved mapping_card |
| **`SDBI_HUMAN_REJECTED`** | **SDBI** | **FAILED** | Human rejected mapping_card |
| **`SDBI_HUMAN_CORRECTED`** | **SDBI** | **PASSED** | Human corrected and re-approved |
| **`SDBI_CONSOLIDATION_COMPLETE_V1`** | **SDBI** | **PASSED** | Phase 5 consolidation completed successfully |
| **`SDBI_TEMP_CLEANUP_V1`** | **SDBI** | **PASSED** | Phase 6 temp_ cleanup done |

### §3.6 Mapping card structure

Standard format per mapping_card (markdown + jsonb embedded):

```markdown
# Mapping Card — <source_table> → <target_sys_table>

## Metadata
- mapping_card_id: <uuid> (auto-gen)
- source: heuresys_platform.public.<source_table>  (or legacy_mirror.<source_table>)
- target: heuresys_advanced.sys.<target_table>
- created: <timestamp>
- author: SDBI AI (Cowork Claude)
- approver: <human_email> | NULL (pending)
- confidence_overall: 0.0-1.0
- workflow_phase: 1|2|3|4|5|6

## Source semantic analysis
- semantic_type: entity | junction | hierarchy | aggregation
- contains_pii: true | false
- temporal: snapshot | event-log | mixed
- ...

## Field mapping (per column)
| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | <target>_id | uuid | DIRECT_COPY | HIGH | exact match |
| name | varchar | <target>_name | varchar | TRIM+LEFT(N) | HIGH | name field standard |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH | audit field |
| ... | ... | ... | ... | ... | ... | ... |

## FK resolution strategy
- source.tenant_id → sys.sys_tenancies via brownfield.tenant_id_mappings
- source.employee_id → sys.sys_users via legacy id lineage JOIN
- ...

## Pre-flight checks
- Source row count: N
- Sample validation (5 rows): PASS/FAIL details
- Cascade dependencies: list

## Post-execution acceptance
- temp_sdbi.<target> count = source row count (modulo soft-delete filters)
- 0 NULL on NOT NULL columns
- All FK resolutions valid (0 dangling refs)
- Lineage rows = upserted rows

## Human review notes
[Enzo's feedback / corrections here]
```

Stored in `cowork_reserved/sdbi_mapping_cards/<source>_<target>.md` per supervisor visibility.

### §3.7 AI provider

**Decision**: Cowork Claude as supervisor (mapping_card author + ADR creator) + CLI Claude Code as executor (mechanical seed apply + migrations + Wave run).

**Rationale**:
- Cowork natural for high-quality semantic analysis (sample data + schema introspection + analogy reasoning)
- CLI natural for code execution + git ops + Windows tooling
- Pattern già existing (Cowork↔CLI v2.2 protocol)
- No external AI API needed initially (lower cost + lower latency)

Future: se Phase 3 scale richiede higher throughput, evaluate Claude API direct + script automation (Opt2-style migration).

### §3.8 Bias mitigation (CW-B16-B21 lessons embedded)

| Bias | Mitigation in SDBI |
|---|---|
| CW-B16 — broken-baseline wall-clock | Mapping_card includes empirical row count from Phase 1 (NO extrapolation) |
| CW-B17 — silent skip blind spot | WHERE_SKIP_FILTER_EXCLUDED_V1 audit class (C1.5 patch) covers brownfield path. SDBI Phase 5 consolidation INSERT...ON CONFLICT must emit audit per skipped row |
| CW-B18 — DISCOVERY completeness | Phase 1 includes: enumerate ALL source NOT NULL columns + check each has proposed mapping (no implicit NULL assumption) |
| CW-B19 — source-side FK availability | Phase 2 includes: for each FK in target, verify source has resolvable value (sample N rows, check non-NULL ratio) |
| CW-B20 — registry UQ constraint | SDBI bypasses brownfield.column_mappings UQ (writes direct to temp_sdbi). Mapping_card replaces column_mapping for SDBI workflow |
| CW-B21 — snapshot equivalence assumption | Verify source freshness explicitly in Phase 1 (last migration date, recent write activity) |

## §4 — Consequences

### §4.1 Positive

1. **Coverage extension**: 13 macro-aree TRUE GAP HRMS coperte (Goals/OKRs, Recruiting, Onboarding, ecc.)
2. **AI-assisted schema design** for new sys.* tables — riduce effort manuale schema design
3. **Investment preservation**: brownfield 100% preservato + esteso
4. **Bias mitigation embedded**: CW-B17-B21 learnings inform SDBI design
5. **Adaptive future-proofing**: pattern riusabile per nuove source tables future (Wave 5+ se necessario)

### §4.2 Negative

1. **Complexity dual-paradigm**: developer + supervisor devono conoscere boundary brownfield vs SDBI
2. **Effort overhead per macro-area**: 7-10h per macro-area SDBI (vs 5-8h brownfield equivalent — più overhead per pilot validation + AI iteration)
3. **AI confidence threshold tuning**: empirical calibration durante pilot (Phase 2)
4. **Mapping_card storage**: file-based markdown — versioning + lifecycle management aggiuntivo

### §4.3 Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI hallucinations / mapping wrong | MEDIUM (35%) | LOW | Mandatory human checkpoint sotto confidence threshold + sample validation |
| Boundary brownfield vs SDBI confusing | LOW (20%) | LOW | Decision tree §2.1 + per-case ADR comment |
| temp_sdbi pollution heuresys_advanced | LOW (15%) | MEDIUM | TRUNCATE policy + BEGIN+ROLLBACK pilot phase + isolated schema (no cross-schema FK) |
| Phase 5 consolidation introduces inconsistency | MEDIUM (30%) | HIGH | Human review obbligatorio + DRY_RUN diff prima di execute + rollback procedure documented |

## §5 — Acceptance criteria per ADR-0014

ADR-0014 è considerata ACCEPTED quando:
1. ✅ Phase 2 pilot Goals/OKRs LIVE in sys.* (~5.8k rows) via SDBI workflow
2. ✅ Phase 5 consolidation diff procedure validated (no false positives/negatives)
3. ✅ Bias mitigations §3.8 enforced via Phase 1 checklist
4. ✅ Documentation runbook (`docs/sdbi/RUNBOOK.md`) published post-pilot
5. ✅ Audit trail consistency post-SDBI workflow verified (lineage + audit rule_codes populated correctly)

## §6 — Implementation roadmap

Phase mapping al TODO master (`cowork_reserved/12_TODO_LIST_GRANULARE.md`):

| Phase ADR | TODO ref | Description |
|---|---|---|
| ADR Phase 0 — acceptance | (this ADR) | Enzo approves design |
| ADR Phase 1 — schema scaffold | TODO Phase 1 P1.X | Migration 000034 (temp_sdbi schema), 000035 (lineage SDBI columns extension), CW-B17 patch |
| ADR Phase 2 — pilot Goals/OKRs | TODO Phase 2 | SDBI workflow on Goals/OKRs source (10 source tables, ~5.8k rows) |
| ADR Phase 3 — scale 12 macro-aree | TODO Phase 3 | Replica pattern Phase 2 |
| ADR Phase 4 — closure | TODO Phase 4 | Documentation + verification |

## §7 — Status

**ACCEPTED** (2026-05-31, S951). Adopted by **ADR-0023** (data-source doctrine) as the sanctioned mechanism to **extend** the advanced `sys.*` schema when a FUTURE source carries entities with no existing target. **Scope**: SDBI is NOT used for the existing legacy `heuresys-evo` (full table+column mapping coverage already present, `advanced ⊇ legacy`); the legacy is handled by the deterministic brownfield wave pipeline (ADR-0012).

The status (design accepted) is distinct from the **implementation**, which remains open as **SOT_BACKLOG B-10 (SDBI Phase 2)** — Goals/OKRs pilot + scale. The §5 acceptance criteria below are the implementation gates for that Phase-2 work, not preconditions for the doctrine-level acceptance recorded here.

## §8 — References

- `cowork_reserved/00_README_KB.md` — KB index
- `cowork_reserved/10_GAPS_ANALYSIS.md` — 5-tier classification
- `cowork_reserved/11_STRATEGIC_REFORMULATION.md` — 3-options evaluation, Opt3 recommended
- `cowork_reserved/12_TODO_LIST_GRANULARE.md` — master plan
- `cowork_reserved/batch_c1/CW_B17_PATCH_SPEC.md` — CW-B17 silent skip audit fix
- `cowork_reserved/batch_c1/class_b_diagnostics/00_SUMMARY.md` — 12 silent-skip target diagnostics

---

*End ADR-0014*
