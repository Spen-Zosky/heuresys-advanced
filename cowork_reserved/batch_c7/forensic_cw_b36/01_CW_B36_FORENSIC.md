# CW-B36 Forensic — sys_skill_categories.skill_category_family_id MAPPING MISCLASSIFICATION

**Status**: investigation complete — Mixed pattern, mostly Mapping Misclassification (Class B re-triage needed)
**Author**: Cowork batch C7.2
**Date**: 2026-05-21
**Audit trigger**: REPORT 009 §4 — 7256 rows excluded as `required_missing_skill_category_family_id`

---

## §1 — Target schema

```
sys.sys_skill_categories
  skill_category_id          uuid NOT NULL PK
  skill_category_family_id   uuid NOT NULL  FK→sys_skill_families(skill_family_id) ON DELETE CASCADE
  skill_category_code        varchar(64) NOT NULL UNIQUE
  skill_category_name        varchar(128) NOT NULL
  ...
```

`skill_category_family_id` is **required (NOT NULL)** but NOT in NK UQ (only `code` is UQ). So this is a "required col" gap (different class from CW-B35 NK gap).

`sys_skill_families` parent table already populated (verified live: 50+ rows with codes 1, 11, 12, BUS-ENT, BUS-LEAD, COMM-INT, HR-PERF, etc.).

## §2 — Source breakdown

3 sources, 7256 staged rows total:

| Source | Rows | Family candidate col | Cardinality | Classification |
|---|---:|---|---|---|
| skill_classifications | **7215** | `primary_category` (varchar) | 3 distinct values: hard/soft/hybrid | **MISCLASSIFIED** ❌ |
| competencies | 32 | `category` (varchar) | 6 distinct values (Leadership, Interpersonal, ...) | **FUZZY-MAPPABLE** ⚠️ |
| ontology_categories | 9 | `parent_id` (uuid) | 5/5 resolution FAIL via lineage | **SEMANTIC PHANTOM** (small volume) |

## §3 — Per-source diagnosis

### §3.1 skill_classifications (7215 rows) — MAPPING MISCLASSIFICATION

Sample raw record:
```json
{
  "id": "d6b61b13-...",
  "esco_skill_id": "ee40ebfd-...",
  "primary_category": "hard",
  "transferability": "transferable",
  "confidence_score": 0.6500,
  "cognitive_level": null,
  "skill_cluster_id": "5b4823af-...",
  ...
}
```

This is **per-skill classification metadata** (cognitive level, transferability, confidence score, classification source), NOT a skill category definition. Source semantics:
- `primary_category=hard/soft/hybrid` → skill TYPE classification, not family taxonomy
- `esco_skill_id` → reference to specific skill, not category
- `confidence_score`, `classification_source`, `needs_review` → AI classification audit metadata

**Verdetto**: `table_mapping (skill_classifications → sys_skill_categories)` è **SEMANTICALLY WRONG** at the table-mapping level. Should be re-classified.

Possible re-target options (out of CW-B36 immediate scope):
- (a) **REFERENCE_ONLY** classification — skill_classifications stays in legacy_mirror for future analytics, no upsert to any sys.* target
- (b) New table `sys_skill_classifications` (extend Skills/Learning loop SKILGRO domain — ciclo X9 macro-area future)
- (c) Embed into `sys_skills.skill_metadata` as JSON enrichment (post-fact upsert with UPDATE pattern, not Wave 1 insert)

### §3.2 competencies (32 rows) — FUZZY-MAPPABLE

`category` varchar values + match attempts:
```
Cognitive     → no match (no sys_skill_families row for "Cognitive")
External      → no match
Interpersonal → COMM-INT "Communication & Interpersonal"
Leadership    → BUS-LEAD "Leadership & Management"
Performance   → HR-PERF "Performance Management"
Personal      → COMM-INT "Communication & Interpersonal" (loose match)
```

4/6 distinct categories fuzzy-mappable to existing sys_skill_families. 2 unmappable (Cognitive, External).

Strategy options:
- **LOOKUP_FK by name with similarity** — would need new transform `LOOKUP_FK_FUZZY` (out of scope), OR pre-staging UPDATE
- **Pre-staging SQL**: UPDATE column_mappings with custom transform that emits CASE statement mapping the 6 strings → family UUIDs
- **Defer**: only 32 rows, low ROI vs effort to add fuzzy transform

### §3.3 ontology_categories (9 rows) — SEMANTIC FK PHANTOM (small)

```sql
WITH samples AS (
  SELECT staging_raw_record->>'parent_id' AS legacy_uuid
    FROM staging.wave1_skill_categories
   WHERE staging_source_table = 'ontology_categories' LIMIT 5
)
SELECT s.legacy_uuid,
       (SELECT slr.source_lineage_target_record_id
          FROM sys.sys_source_lineage_records slr
         WHERE slr.source_lineage_target_table_name = 'sys_skill_families'
           AND slr.source_lineage_source_record_id LIKE '%' || s.legacy_uuid LIMIT 1) AS resolves
  FROM samples s;
```

Result: **0/5 NULL resolution**. Same pattern as CW-B26 / ADR-0016 — source UUID doesn't have lineage to sys_skill_families.

Volume too small (9 rows) to justify dedicated ADR. Options:
- Skip via classification REFERENCE_ONLY
- Force NULL with engine CW-B34-style nullable patch (but family_id is REQUIRED not NK — engine path different)
- Defer

## §4 — Proposed mitigation

CW-B36 doesn't have a single "fix and ship" path. Recommend tri-action triage:

### Action A — Re-classify skill_classifications table_mapping (CLI X7 trivial)
```sql
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_rationale = 'CW-B36: source semantics ≠ target (skill_classifications is per-skill metadata, not category family). Re-classified pending SKILGRO macro-area (ciclo X9) decision on whether to extend sys_skill_classifications or embed into sys_skills.skill_metadata.'
 WHERE table_mapping_id = (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_categories'
      AND st.source_table_name = 'skill_classifications'
 );
```

**Effect**: 7215 rows removed from Wave 1 sys_skill_categories pipeline. No regression on already-populated sys_skill_categories.

### Action B — competencies fuzzy mapping (defer to X8 polishing)
Effort: medium (need new transform OR custom SQL). ROI: 32 rows. **DEFER**.

### Action C — ontology_categories (defer to manual taxonomy work)
Effort: low (re-classify to REFERENCE_ONLY or accept skip). ROI: 9 rows. **DEFER** OR Action A pattern.

### Acceptance criteria (Action A only, CLI X7)
- `skill_classifications` table_mapping classification = REFERENCE_ONLY
- Wave 1 retry: `required_missing_skill_category_family_id` count drops 7256 → ≤41 (32 competencies + 9 ontology_categories)
- No new sys_skill_categories rows expected (the table is already populated from other sources or pre-X1 seed)
- Bias catalog: CW-B36 documented as "Mapping Misclassification" pattern

## §5 — Pattern catalog impact

**NEW PATTERN — "Mapping Misclassification"**:
- table_mapping(source → target) was authored on schema/name similarity, but source SEMANTICS differ from target's
- Symptom: high % of rows fail at required-col or NK level for non-recoverable reasons (no LOOKUP_FK could resolve)
- Mitigation: re-classify table_mapping to REFERENCE_ONLY / EXCLUDE, defer to dedicated SDBI macro-area for proper target
- Detection: 5-sample on candidate cols shows wrong cardinality OR wrong semantic type

CW-B36 = first canonical instance. Pattern memo §10 (next batch C8) should add this alongside CW-B35 "Import Mapping Gap".

## §6 — Effort estimate

CLI X7 Block A.2 (CW-B36 Action A only): **15 min**.
- 1 UPDATE SQL
- Wave 1 retry verify
- Commit

Total CW-B36 X7 deliverable: 15 min + Wave 1 retry 3min wall-clock + commit/push 5 min = **~25 min CLI active**.

## §7 — Open questions

1. Should `competencies` mapping (32 rows) be re-classified too? Or fuzzy-mapped in C8 polishing? Recommendation: **leave APPROVED for now, low volume not blocking, address in X9 SKILGRO macro-area when sys_skill_categories full structure is finalized**.
2. Should `ontology_categories` (9 rows) be re-classified to REFERENCE_ONLY? Recommendation: **yes, same Action A pattern as skill_classifications, batch with this CLI X7 fix**.
3. Should we author ADR-0017 for the SKILGRO sys_skill_classifications table? Recommendation: **defer to X9 macro-area planning**.

---

*End CW-B36 forensic — Mapping Misclassification pattern identified*
