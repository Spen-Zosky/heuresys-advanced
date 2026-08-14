# ADR-0023 — Data-Source Doctrine: advanced = structural authority, legacy = canonical no-PII source

**Status**: ⛔ **SUPERSEDED da ADR-0038** (2026-08-14) — **è cronaca, non un mandato.**
> Questo ADR spiega **da dove vengono** i dati che oggi sono in `sys.*`, e per questo resta
> leggibile e utile. **Non descrive più come si procede.** Enzo, 2026-08-14: *«nessun dato
> riferito al brownfield deve essere rimesso in circolo, tutto va ricostruito con il DBMS
> attuale»* — il database è autosufficiente e il rubinetto è chiuso. Chi legge questo documento
> cercando istruzioni sta leggendo il documento sbagliato: → **ADR-0038**, e il cancello
> `python docs/kb/tools/check_no_legacy_ingest.py` che lo fa rispettare.
> **Resta invece in vigore**, ed è ribadito da ADR-0038: `sys.*` è l'autorità strutturale;
> l'ingestione storica non ha mai avuto uno strato di anonimizzazione; i dati si trattano come
> **produzione reale**.

**Date**: 2026-05-31
**Author**: CLI session (data-source doctrine review, S951)
**Decision authority**: Enzo Spenuso
**Supersedes / amends**: the "enrichment source only" clause of invariant **I12** (the no-PII / no-anonymization clause of I12 is preserved and reaffirmed here)
**Related**: I12, I13, ADR-0004 (no-Docker runtime), ADR-0010 (PostgreSQL runtime location), ADR-0012 (brownfield wave column), ADR-0014 (SDBI), RTL tenant rebuild S950
**Triggered by**: Enzo's clarification of the data model (2026-05-31): the legacy brownfield is a synthetic AI-generated case study (no real persons) and must be treated as the canonical data source that populates the structurally-authoritative advanced schema, after mapping/reconciliation. A read-only 7-agent verification workflow confirmed all three premises empirically; this ADR formalizes the result and supersedes the stale "enrichment-only" framing.

---

## §1 — Context

Over time, invariant **I12** ("Brownfield = enrichment source only … brownfield data is demo/no-PII, no anonymization layer") and the SuccessFactors reconciled-design doc accreted a framing that no longer matches the shipped architecture:

1. **"enrichment source only"** understates the legacy DB. In practice the legacy is the **primary, authoritative data source** that populates `sys.*`.
2. A **PII/GDPR blocker** was raised (SF doc §8.2) under the premise that a future live import could bring real-person PII. Enzo has ruled that this product is a **case study by design** and will never ingest real-client PII — so the blocker has no premise.

A read-only verification workflow (S951, 7 agents, DB + repo, 101 read/query) confirmed the three premises with hard numbers (see §3). This ADR is the locked doctrine; I12/SOT §9/CLAUDE.md are amended to point here.

## §2 — Decision

### §2.1 Advanced (`sys.*`) is the STRUCTURAL AUTHORITY
Tables, relations, keys, indexes, and views are defined in the advanced schema. Any source adapts to `sys.*`, never the reverse. The brownfield wave-executor reads the **target** `sys.*` schema (`information_schema` / `pg_index`, `engine.ts loadTargetMeta`) to build its INSERT / conflict-inference; the legacy is reshaped to fit via `brownfield.column_mappings`. Verified: **97/97** `table_mappings` target `target_schema='sys'` (single distinct value); `sys` has **134 base tables + 11 views + 1569 columns** vs the legacy catalogue of **94 tables / 1174 columns** — `advanced ⊇ legacy` in mapping coverage (0 source tables/columns unmapped). The two schemas are largely **orthogonal by domain**: the legacy is a skills/learning/ESCO/market dataset (no HR-transactional tables); the advanced core-HR (auth, positions, assignments, compensation, BPM) does not originate from the legacy.

### §2.2 Legacy Docker = CANONICAL DATA SOURCE (not mere enrichment)
The legacy `heuresys-evo` Docker DB (container `heuresys_evo_platform_db`, db `heuresys_platform`) is the **authoritative data source** for the domain it covers (skills/learning/ESCO/ontology/market + org/identity via match-and-wire). It is **not** a secondary enrichment input. Verified: **69 450** lineage rows in `sys.sys_source_lineage_records` across 28 target tables from 73 legacy source tables; **~49%** of `sys.*` tables populated from it; the entire **RTL tenant rebuild (S950)** was wired from the legacy via `user_external_code = 'LEGACY:' || legacy.id` (161 users / 162 positions / 26 OU / 2 active tenants).

### §2.3 No-PII is GLOBAL (no real-client carve-out)
All data this product handles is **synthetic case-study data by design** — there are no real persons. Therefore: **no PII concern, no anonymization / masking / pseudonymization layer** (verified: all **1225** `column_mappings` have `column_mapping_pii_disposition = NONE`; 0 PSEUDONYMIZE / MASK / DROP / TAG_SYNTHETIC). The synthetic/`is_synthetic` tags are **provenance discriminators, not a privacy gate** (`user_is_synthetic` is the exact inverse of `user_type='SYNTHETIC_REFERENCE'`). This product is a case study and **will not ingest real-client PII, ever** — the previously-considered "future live real-client import = PII concern" carve-out (SF doc §8.2) is **retired**. The no-PII guarantee is unconditional for this project.

### §2.4 Ingestion paths
- **(a) Deterministic brownfield pipeline** — registry (`brownfield.source_*` + `table_mappings` + `column_mappings`) → `staging.wave1_*` jsonb buffer → VALIDATE / APPROVE → idempotent upsert (`ON CONFLICT`, content-hash) → `sys.sys_source_lineage_records`. Used for taxonomy/skills/learning.
- **(b) Hand-authored seed SQL** — for org/identity (the S950 RTL match-and-wire).
- **(c) SDBI (ADR-0014)** — for **future** sources whose entities have **no** `sys.*` target: the AI proposes a schema extension, human-gated, in `temp_sdbi`. The advanced schema is **extended** via SDBI; the existing legacy needs no SDBI (full mapping already present).

## §3 — Verified evidence (S951 workflow)

| Premise | Verdict | Key numbers |
|---|---|---|
| Brownfield = no-PII, usable as-is | CONFIRMED | 1225/1225 `column_mappings` `pii_disposition=NONE`; 0 anonymization mappings |
| Advanced = structural authority | CONFIRMED | `sys` 134 tab / 11 views / 1569 col; 97/97 mappings → `sys`; legacy 94 tab / 1174 col; 0 unmapped |
| Legacy populates advanced (after remap/reconcile) | CONFIRMED | 69 450 lineage rows, 28 targets, 73 sources; ~49% `sys.*` populated; RTL S950 match-and-wire |

**Nuances locked into the doctrine** (where the raw vision over-reaches): advanced is a *proper* superset of the legacy but *orthogonal by domain* (legacy has no HR-transactional tables); the SuccessFactors "gaps" are gaps of a *different, exploratory, not-approved source*, not legacy gaps; "complete reconciliation" is aspirational — current state is ~49% (69/134 `sys.*` tables still empty, no delta/watermark; tracked as backlog B-50).

## §4 — Consequences

**Positive**
- A future session inherits the verified doctrine and does not re-derive it, nor self-impose a non-existent PII blocker on the synthetic source.
- I12's data-role clause matches reality (authoritative source, not enrichment).
- The no-Docker policy (I13/ADR-0004) is unambiguous: it governs the advanced runtime, not the read-only legacy source (see ADR-0004 source-vs-runtime note).

**Negative / bounded**
- "No-PII is global" is a deliberate product stance (case study). If the product's purpose ever changes to ingest a real client's live PII, this ADR must be revisited with a dedicated PII/GDPR governance ADR — it is not silently overridable.

**Neutral**
- No code or schema changes here; this is a documentary doctrine. Structurally-related invariants (I1/I3/I4/I5/I7/I9, RD-08/09) and the reconciliation ADRs (0012/0016/0017/0020) are unchanged and reinforced.

## §5 — Scope boundary (cardinal)

Confirming this doctrine **authorizes a direction, not a bulk-execution mandate**. The residual reconciliation work (sys.* beyond ~49%, Wave-2/3, SDBI Phase 2, orphan import_runs, delta/watermark) is tracked as **SOT_BACKLOG B-50** and executed only under an explicit, separately-greenlit session (scope-discipline, `feedback_scope_discipline_no_cascade`).

## §6 — References
- I12 / I13 (CLAUDE.md "Non-negotiable invariants"; SOT_STATE §9)
- ADR-0004 (no-Docker runtime — source-vs-runtime note), ADR-0010, ADR-0012, ADR-0014 (SDBI, ACCEPTED)
- `docs/integrations/successfactors_heuresys_reconciled_design_2026-05-30.md` (PII blocker retired)
- `memory/feedback_data_treatment_no_privacy_concerns.md` (internal data-treatment ruling this formalizes)
- SOT_BACKLOG B-50 (full reconciliation)

---

*End ADR-0023*
