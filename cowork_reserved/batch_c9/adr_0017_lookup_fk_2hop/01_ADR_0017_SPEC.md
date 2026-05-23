# ADR-0017 — LOOKUP_FK_2HOP transform (engine extension)

**Status**: ACCEPTED (Cowork C9.2 → CLI X9 Block A 2026-05-23) — engine + migration 000043 + 5/5 tests + full-suite 332/338 PASS verified
**Date**: 2026-05-21
**Author**: Cowork batch C9.2
**Related**: ADR-0014 (SDBI architecture) + CW-B37 deep fix
**Triggered by**: REPORT X8 §6.2 — 1381 rows `nk_missing_skill_learning_mapping_skill_id` blocked by 2-hop resolution requirement (esco_skill_uri → legacy_mirror.esco_skills.id → sys_skills lineage)

---

## §1 — Context

Current `LOOKUP_FK` transform supports **1-hop resolution** patterns only:
- Plain col: `match_on: "legacy_id"` (jsonb extract `(src)->>'legacy_id'` then JOIN sys_source_lineage_records)
- Fallback pairs: `(sys_tenancies, legacy_tenant_id)` JOIN brownfield.tenant_id_mappings, etc.

Several SDBI macro-areas need **2-hop resolution**: source has a varchar URI/code that maps to a `legacy_mirror.<table>.uri` row, whose `.id` UUID then resolves via lineage to the sys.* target. Currently impossible to express in single LOOKUP_FK call.

**Concrete blockers post-X8**:
- `certification_esco_skills.esco_skill_uri` (664 rows) → sys_skills (via legacy_mirror.esco_skills)
- `course_esco_skills.esco_skill_uri` (717 rows) → sys_skills (via legacy_mirror.esco_skills)
- Plus future macro-areas (learning content URI → modules, ESCO occupation URI → occupations, etc.)

Total estimated unlock from 2-hop: **1381+ rows** for CW-B37 deep fix + ~2000-5000 rows from future macro-aree X10+.

## §2 — Decision

Add new transform code `LOOKUP_FK_2HOP` to `SUPPORTED_TRANSFORMS` (transform-compiler.ts:202). Payload semantics:

```json
{
  "target_table": "sys_skills",
  "match_on": "esco_skill_uri",
  "lookup_2hop": {
    "intermediate_schema": "legacy_mirror",
    "intermediate_table": "esco_skills",
    "intermediate_match_col": "uri",
    "intermediate_pk_col": "id"
  }
}
```

Engine emits this SQL fragment:

```sql
(SELECT slr.source_lineage_target_record_id
   FROM legacy_mirror.esco_skills lm
   JOIN sys.sys_source_lineage_records slr
     ON slr.source_lineage_source_record_id LIKE '%' || lm.id::text
  WHERE lm.uri = (staging_raw_record->>'esco_skill_uri')
    AND slr.source_lineage_target_table_name = 'sys_skills'
  LIMIT 1)
```

`srcExpr` (left side of `(...)->>'esco_skill_uri'`) is the staging raw record JSONB extract per existing LOOKUP_FK convention.

## §3 — Validate payload (DB-side trigger)

Mirror existing `brownfield.validate_lookup_fk_payload()` trigger function (mig 000033). Add validation for LOOKUP_FK_2HOP:

```sql
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_2hop_payload(p_payload jsonb, p_mapping_id uuid)
RETURNS void AS $$
BEGIN
  IF p_payload->>'target_table' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP payload missing target_table (mapping_id=%)', p_mapping_id;
  END IF;
  IF p_payload->>'match_on' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP payload missing match_on (mapping_id=%)', p_mapping_id;
  END IF;
  IF p_payload->'lookup_2hop' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP payload missing lookup_2hop block (mapping_id=%)', p_mapping_id;
  END IF;
  FOR _k IN SELECT unnest(ARRAY['intermediate_schema','intermediate_table','intermediate_match_col','intermediate_pk_col']) LOOP
    IF p_payload->'lookup_2hop'->>_k IS NULL THEN
      RAISE EXCEPTION 'LOOKUP_FK_2HOP payload.lookup_2hop missing %', _k;
    END IF;
  END LOOP;
END $$ LANGUAGE plpgsql;
```

Extend trigger `brownfield_column_mappings_lookup_fk_validate` to dispatch to either `validate_lookup_fk_payload` (transform = LOOKUP_FK) or `validate_lookup_fk_2hop_payload` (transform = LOOKUP_FK_2HOP).

Migration: `db/migrations/000043_lookup_fk_2hop_validator.sql`.

## §4 — Engine implementation (transform-compiler.ts)

Add case `LOOKUP_FK_2HOP` near existing `LOOKUP_FK` (transform-compiler.ts:375):

```typescript
case "LOOKUP_FK_2HOP": {
  const payload = transform_payload as Record<string, unknown> | null;
  const targetTable = payload?.target_table as string;
  const matchOn = payload?.match_on as string;
  const lookup2hop = payload?.lookup_2hop as Record<string, string> | undefined;

  if (!targetTable || !matchOn || !lookup2hop) {
    throw new InvalidLookupFkPayloadError(
      "LOOKUP_FK_2HOP missing target_table / match_on / lookup_2hop",
      mappingId,
    );
  }
  const { intermediate_schema, intermediate_table, intermediate_match_col, intermediate_pk_col } = lookup2hop;
  if (!intermediate_schema || !intermediate_table || !intermediate_match_col || !intermediate_pk_col) {
    throw new InvalidLookupFkPayloadError(
      "LOOKUP_FK_2HOP lookup_2hop missing schema/table/match_col/pk_col",
      mappingId,
    );
  }

  const sql = format(
    "(SELECT slr.source_lineage_target_record_id " +
    "FROM %I.%I lm " +
    "JOIN sys.sys_source_lineage_records slr " +
    "  ON slr.source_lineage_source_record_id LIKE '%%' || lm.%I::text " +
    "WHERE lm.%I = (%s) " +
    "  AND slr.source_lineage_target_table_name = %L LIMIT 1)",
    intermediate_schema, intermediate_table,
    intermediate_pk_col,
    intermediate_match_col,
    srcExpr,
    targetTable,
  );
  return { fragment: { sql }, targetColumn };
}
```

Add `"LOOKUP_FK_2HOP"` to `SUPPORTED_TRANSFORMS` Set (line 202).

## §5 — Unit tests (transform-compiler.lookup-fk-2hop.test.ts NEW)

5 tests minimum:
- **T1** happy path: certification_esco_skills.esco_skill_uri → sys_skills via legacy_mirror.esco_skills
- **T2** payload missing lookup_2hop → throws InvalidLookupFkPayloadError
- **T3** payload missing intermediate_schema/table/match_col/pk_col → throws
- **T4** SQL injection escape via pg-format `%I` `%L`
- **T5** SQL output structure includes correct schema-qualified joins + LIMIT 1

## §6 — Acceptance criteria

1. `SUPPORTED_TRANSFORMS.size` = 17 (was 16) — test transform-compiler.test.ts:516 update
2. 5/5 unit tests PASS
3. Migration 000043 applies idempotent
4. brownfield.column_mappings INSERT with LOOKUP_FK_2HOP transform + valid payload succeeds
5. brownfield.column_mappings INSERT with LOOKUP_FK_2HOP transform + INVALID payload (missing field) → trigger RAISE EXCEPTION (validator works)
6. Wave 1 retry post-deployment with new column_mappings for sys_skill_learning_mappings → `nk_missing_skill_learning_mapping_skill_id` drops from 1381 → ≤300 (resolution rate ~78%+)
7. No regression: existing LOOKUP_FK transforms still work (262 mappings in registry)
8. Full test suite ≥327 passing

## §7 — Migration file template

**File**: `db/migrations/000043_lookup_fk_2hop_validator.sql`

```sql
-- =============================================================================
-- 000043_lookup_fk_2hop_validator.sql
-- ADR-0017 — LOOKUP_FK_2HOP transform validator function + trigger dispatch
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP+CREATE TRIGGER
-- =============================================================================

BEGIN;

-- §1 Validator function
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_2hop_payload(
  p_payload jsonb, p_mapping_id uuid
)
RETURNS void AS $$
DECLARE
  _k text;
BEGIN
  IF p_payload->>'target_table' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing target_table (mapping=%)', p_mapping_id;
  END IF;
  IF p_payload->>'match_on' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing match_on (mapping=%)', p_mapping_id;
  END IF;
  IF p_payload->'lookup_2hop' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing lookup_2hop block (mapping=%)', p_mapping_id;
  END IF;
  FOR _k IN SELECT unnest(ARRAY['intermediate_schema','intermediate_table','intermediate_match_col','intermediate_pk_col']) LOOP
    IF p_payload->'lookup_2hop'->>_k IS NULL THEN
      RAISE EXCEPTION 'LOOKUP_FK_2HOP lookup_2hop missing % (mapping=%)', _k, p_mapping_id;
    END IF;
  END LOOP;
END $$ LANGUAGE plpgsql;

-- §2 Replace existing trigger with dispatch logic
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_mapping_transform = 'LOOKUP_FK' THEN
    PERFORM brownfield.validate_lookup_fk_payload(
      NEW.column_mapping_transform_payload, NEW.column_mapping_id
    );
  ELSIF NEW.column_mapping_transform = 'LOOKUP_FK_2HOP' THEN
    PERFORM brownfield.validate_lookup_fk_2hop_payload(
      NEW.column_mapping_transform_payload, NEW.column_mapping_id
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Existing trigger (from mig 000033) calls validate_lookup_fk_payload_trigger only for LOOKUP_FK
-- Replace with dispatch function handling both
DROP TRIGGER IF EXISTS brownfield_column_mappings_lookup_fk_validate ON brownfield.column_mappings;
CREATE TRIGGER brownfield_column_mappings_lookup_fk_validate
  BEFORE INSERT ON brownfield.column_mappings
  FOR EACH ROW
  WHEN (NEW.column_mapping_transform IN ('LOOKUP_FK', 'LOOKUP_FK_2HOP'))
  EXECUTE FUNCTION brownfield.validate_lookup_fk_dispatch();

COMMIT;
```

## §8 — Risk + rollback

### Risk
- **LOW**: additive transform — does not modify existing LOOKUP_FK code path
- **MEDIUM**: 2-hop SQL JOIN runtime performance on large legacy_mirror tables (esco_skills 5237 rows). Mitigated: index `legacy_mirror.esco_skills(uri)` ensures O(log n) lookup
- **LOW**: SQL injection — `%I` and `%L` pg-format already escape per existing LOOKUP_FK precedent

### Rollback
1. Revert engine.ts patch (remove case LOOKUP_FK_2HOP)
2. Revert SUPPORTED_TRANSFORMS Set entry
3. Migration 000043 idempotent revert:
   ```sql
   DROP FUNCTION IF EXISTS brownfield.validate_lookup_fk_2hop_payload(jsonb, uuid);
   -- Restore original single-validator trigger
   ```

## §9 — Open questions

1. **Multiple intermediate hops** (3-hop+) — out of scope ADR-0017. Possibly future ADR-0018 if needed.
2. **Performance on 50k+ legacy_mirror tables** — not yet tested. Add index on intermediate_match_col mandatory before activation.
3. **Cycle detection** — if intermediate table itself has lineage to target, current SQL may produce stale joins. Defer to runtime testing in X9.

## §10 — Effort estimate

CLI X9 Block A (ADR-0017 implementation): **2-3h**
- Migration 000043 author + apply: 30 min
- transform-compiler.ts case add: 20 min
- 5 unit tests author: 45 min
- SUPPORTED_TRANSFORMS test update: 5 min
- Full test suite + typecheck + lint: 30 min
- Sample column_mapping INSERT + dry-run EXPLAIN verify: 20 min
- Commit + push: 15 min

---

*End ADR-0017 spec — LOOKUP_FK_2HOP engine extension*
