# CW-B37 Forensic — sys_skill_learning_mappings.skill_id mixed IMPORT/LOOKUP-BUG

**Status**: investigation complete — Split pattern (Import Gap + LOOKUP_FK Bug). Recommend defer to X9 SKILGRO.
**Author**: Cowork batch C7.3
**Date**: 2026-05-21
**Audit trigger**: REPORT 009 §4 — 1381 `nk_missing_skill_id` + 207 `nk_null_skill_id` (invalid uuid)

---

## §1 — Target schema

```
sys.sys_skill_learning_mappings
  skill_learning_mapping_id                 uuid NOT NULL PK
  skill_learning_mapping_skill_id           uuid NOT NULL FK→sys_skills(skill_id) ON DELETE CASCADE
  skill_learning_mapping_module_id          uuid NOT NULL FK→sys_learning_modules(learning_module_id) ON DELETE CASCADE
  skill_learning_mapping_target_proficiency varchar(32) NOT NULL CHECK IN (NOVICE,BASIC,COMPETENT,PROFICIENT,EXPERT,MASTER)
  skill_learning_mapping_metadata           jsonb NOT NULL

UNIQUE INDEX pair_uq (skill_id, module_id)
```

Both NK FKs **NOT NULL**. Pattern similar to CW-B35 (NK UUID required).

## §2 — Source breakdown (1588 staged rows)

| Source | Rows | skill_id mapping | module_id mapping | Gap pattern |
|---|---:|---|---|---|
| certification_esco_skills | 664 | **MISSING** | **MISSING** | Import Gap (like CW-B35) |
| course_esco_skills | 717 | **MISSING** | **MISSING** | Import Gap |
| job_title_courses | 207 | LOOKUP_FK exists but payload bug | LOOKUP_FK on course_id | LOOKUP_FK config bug |

**Total 1381** = 664 + 717 missing mappings (Import Gap)
**Total 207** = job_title_courses with LOOKUP_FK that resolves to NULL (config bug)

## §3 — Per-source diagnosis

### §3.1 certification_esco_skills (664) + course_esco_skills (717) — IMPORT GAP w/ 2-HOP RESOLUTION

Source data keys: `esco_skill_uri`, `skill_name`, `certification_id`/`course_id`. NO direct UUID FK to sys_skills.

Resolution path: `esco_skill_uri` → `legacy_mirror.esco_skills.uri` → `legacy_mirror.esco_skills.id` → lineage to `sys_skills.skill_id`. This is **2-hop**, not the standard 1-hop LOOKUP_FK pattern.

5-sample resolution check failed (`sys_skills.skill_metadata->>'esco_uri'` is NULL — URIs stored elsewhere, likely in skill_code OLDDB::<table>::<uuid> pattern but URI itself not in sys_skills directly). Live verified:
```
http://esco.eu/skill/B1  → NULL resolution
http://esco.eu/skill/B4  → NULL resolution
http://esco.eu/skill/B5  → NULL resolution
http://esco.eu/skill/FD2 → NULL resolution
http://esco.eu/skill/D2  → NULL resolution
```

**Verdetto**: standard LOOKUP_FK won't work without engine extension or pre-staging hop.

Options:
- (a) **Engine extension**: new transform `LOOKUP_FK_2HOP` with `lookup_table`, `intermediate_table`, `intermediate_join_col`, `final_match_col` semantics. **Out of scope X7** (engine change, ~2-3h).
- (b) **Pre-staging SQL UPDATE** that joins legacy_mirror.esco_skills + lineage to compute final skill_id, then UPDATE staging.wave1_skill_learning_mappings.staging_raw_record with `skill_id` key injected. CLI X7 could do this via custom SQL but it pollutes staging semantics.
- (c) **Defer to X9 SKILGRO macro-area** — Skills/Learning loop dedicated batch (per roadmap §X9). Engine extension natural there.

**Recommendation**: option (c) defer. Volume 1381 is small relative to SKILGRO scope (~6 expected new tables).

### §3.2 job_title_courses (207) — LOOKUP_FK PAYLOAD BUG

Current column_mapping payload:
```json
{"match_on": "skill_name", "target_table": "sys_skills"}
```

But `staging_raw_record` for job_title_courses has **only `course_id`** key (no skill_name, no skill UUID, no esco_uri). The mapping was authored against a different source schema or aspirationally.

**Verdetto**: `job_title_courses → sys_skill_learning_mappings.skill_id` is **structurally not resolvable** from current source data.

Options:
- (a) **Re-classify table_mapping** as REFERENCE_ONLY (job_title_courses → sys_skill_learning_mappings) — 207 rows out of Wave 1 sys_skill_learning_mappings, semantic re-evaluation deferred
- (b) **Use job_title field** to fuzzy-match sys_job_roles (different target table) — would require new table_mapping, not fix to existing one
- (c) Defer

**Recommendation**: option (a) for X7 trivial fix. job_title_courses appartiene semanticamente a sys_job_role_skill_mappings o sys_position_skill_requirements (future macro-area), non a sys_skill_learning_mappings.

## §4 — Proposed mitigation

### Action A — Re-classify job_title_courses → sys_skill_learning_mappings as REFERENCE_ONLY (X7 trivial, 15 min)

```sql
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_rationale = 'CW-B37: job_title_courses lacks skill UUID/URI/name in staging_raw_record. LOOKUP_FK payload {match_on:skill_name} unresolvable. Source semantically belongs to job_role↔skill mapping (sys_job_role_skill_mappings, ciclo X10 H2R or X12 TALPIPE).'
 WHERE table_mapping_id = (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_learning_mappings'
      AND st.source_table_name = 'job_title_courses'
 );
```

**Effect**: 207 invalid-uuid rows removed from Wave 1 sys_skill_learning_mappings pipeline.

### Action B — Defer certification_esco_skills + course_esco_skills to X9 SKILGRO (DOCUMENT in C8 planning)

Both sources require 2-hop LOOKUP_FK or engine extension. Defer to dedicated Skills/Learning macro-area cycle X9.

In X7 REPORT, document forward-recommendation for X9 SKILGRO C-batch authoring:
- ADR-NNNN engine extension `LOOKUP_FK_2HOP` (new transform)
- OR alternative: pre-staging materialized view that joins legacy_mirror.esco_skills + lineage

## §5 — Acceptance criteria (Action A only, X7)

- `job_title_courses → sys_skill_learning_mappings` table_mapping classification = REFERENCE_ONLY
- Wave 1 retry: `nk_null_skill_id` count drops 207 → 0
- `nk_missing_skill_id` count stays at 1381 (deferred to X9)

## §6 — Pattern catalog impact

**CW-B37 = Hybrid**: 1381 rows Import Gap (CW-B35 family) + 207 rows LOOKUP_FK Misconfigured (new sub-pattern).

**NEW PATTERN — "LOOKUP_FK Payload Misconfigured"**:
- column_mapping has LOOKUP_FK transform but `match_on` column not present in staging_raw_record
- Symptom: 100% of rows fail with `nk_null_<col>` (LOOKUP returns NULL because match field absent)
- Detection: 5-sample staging_raw_record keys vs payload.match_on
- Mitigation: re-classify table_mapping to REFERENCE_ONLY OR correct payload + re-apply

Pattern memo §10 next batch: catalog "LOOKUP_FK Payload Misconfigured" alongside "Import Mapping Gap" (CW-B35) and "Mapping Misclassification" (CW-B36).

## §7 — Effort estimate

CLI X7 Block A.3 (CW-B37 Action A only): **10 min**.
- 1 UPDATE SQL
- Wave 1 retry verify
- Commit + push

## §8 — Open questions

1. `certification_esco_skills` (664) + `course_esco_skills` (717) source semantics — verified these belong to SKILGRO domain? **Yes** — both source tables are explicitly about skills↔learning_modules relationships, which is canonical SKILGRO scope per lexicon.md
2. 2-hop LOOKUP_FK transform — should be designed in C-batch preceding X9 (cw-b37-2hop spec). **Defer to X8 or X9 preparation**.
3. Multi-source dedup (CW-B31 DISTINCT ON) for sys_skill_learning_mappings — need to verify edge case behavior post-Action A.

---

*End CW-B37 forensic — LOOKUP_FK Payload Misconfigured + Import Gap split*
