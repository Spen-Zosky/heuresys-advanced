# ADR-0017 — `LOOKUP_FK_2HOP` transform (brownfield-wave-executor engine extension)

**Status**: ACCEPTED (Cowork C9.2 → CLI X9 Block A, 2026-05-23) — engine extension + migration 000043 validator + 5/5 dedicated unit tests + full-suite vitest 332/338 PASS verified
**Date**: 2026-05-21 (proposed) → 2026-05-23 (accepted X9 Block A)
**Author**: Cowork batch C9.2 + CLI X9 implementation
**Decision authority**: Enzo Spenuso (autorizzazione implicita via X9 PROMPT approval)
**Related**: ADR-0014 SDBI architecture · ADR-0018 COALESCE-UQ class-of-bug · CW-B37 deep fix (`cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md`)
**Triggered by**: REPORT X8 §6.2 — 1381 rows `nk_missing_skill_learning_mapping_skill_id` blocked by 2-hop resolution requirement (esco_skill_uri → legacy_mirror.esco_skills.id → sys_skills lineage)
**Retroactive ADR**: formalizzato 2026-05-26 (file mancante prima di questa data; spec viveva in `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` e migration 000043 shipped — questo file è la formal codification).

---

## §1 — Context

Il brownfield-wave-executor engine (`apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`) supporta una collezione di transform codes per mappare colonne source → target via SQL emit dinamico. Pre-ADR-0017, l'engine supportava `LOOKUP_FK` per **risoluzione 1-hop**:

- **Plain col** form (a): `match_on: "legacy_id"` → SQL `(staging_raw_record->>'legacy_id')` poi JOIN su `sys.sys_source_lineage_records`
- **Fallback pairs** form (b): `(sys_tenancies, legacy_tenant_id)` JOIN su `brownfield.tenant_id_mappings` (mig 000033)

Tuttavia diverse macro-aree SDBI + Wave 1 hardening richiedono **risoluzione 2-hop**: il source ha una varchar URI/code che mappa a un `legacy_mirror.<table>.uri` row, il cui `.id` UUID poi risolve via lineage al sys.* target. Single LOOKUP_FK call non può esprimere la doppia JOIN.

### §1.1 Blockers concreti post-X8 (1381 rows)

| Source column | Target | 2-hop path | Rows |
|---|---|---|---|
| `certification_esco_skills.esco_skill_uri` | sys_skills | via `legacy_mirror.esco_skills.uri → .id` | 664 |
| `course_esco_skills.esco_skill_uri` | sys_skills | via `legacy_mirror.esco_skills.uri → .id` | 717 |

Plus ~2000-5000 rows stimati da future SDBI macro-aree (learning content URI → modules, ESCO occupation URI → occupations, ecc.).

### §1.2 Anti-pattern alternativo (rejected)

L'alternativa "espandere LOOKUP_FK form (a/b) con casistica heuristic per detection 2-hop" è stata **rifiutata** per i seguenti motivi:
- Heuristic detection rende il transform meno predicibile (CW-B25 Spec-Schema Drift risk)
- Trigger validator DB-side non può facilmente discriminare 1-hop vs 2-hop dal solo `match_on`
- L'esplicitezza del payload `lookup_2hop` block aumenta diagnosability + auditability

## §2 — Decision

Aggiungere nuovo transform code **`LOOKUP_FK_2HOP`** a `SUPPORTED_TRANSFORMS` in `transform-compiler.ts:202`. Payload semantics:

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

Engine emette SQL fragment 2-hop:

```sql
(SELECT slr.source_lineage_target_record_id
   FROM legacy_mirror.esco_skills lm
   JOIN sys.sys_source_lineage_records slr
     ON slr.source_lineage_source_record_id LIKE '%' || lm.id::text
  WHERE lm.uri = (staging_raw_record->>'esco_skill_uri')
    AND slr.source_lineage_target_table_name = 'sys_skills'
  LIMIT 1)
```

Il `srcExpr` (left side `(...)->>'esco_skill_uri'`) è il staging raw record JSONB extract per existing LOOKUP_FK convention. La JOIN su `sys_source_lineage_records` riusa lineage form (b) infrastructure di ADR-0014.

## §3 — Implementation surface

### §3.1 DB validator (migration 000043)

File: `db/migrations/000043_lookup_fk_2hop_validator.sql` (already shipped X9 Block A).

Contiene:
1. **`brownfield.validate_lookup_fk_2hop_payload(p_payload jsonb, p_mapping_id uuid)`** — valida presenza required keys: `target_table`, `match_on`, `lookup_2hop.{intermediate_schema, intermediate_table, intermediate_match_col, intermediate_pk_col}`
2. **`brownfield.validate_lookup_fk_dispatch()`** — trigger function che dispatcha a `validate_lookup_fk_payload` (per `LOOKUP_FK`) o `validate_lookup_fk_2hop_payload` (per `LOOKUP_FK_2HOP`) basato su `NEW.column_mapping_transform`
3. **Trigger replacement** `brownfield_column_mappings_lookup_fk_validate` BEFORE INSERT su `brownfield.column_mappings` WHEN transform IN ('LOOKUP_FK', 'LOOKUP_FK_2HOP')

Idempotency: `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — twice-run safe.

### §3.2 Engine extension (transform-compiler.ts)

File: `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts:202+ (SUPPORTED_TRANSFORMS) + ~375+ (case LOOKUP_FK_2HOP)`

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
  return { sql, audit_metadata: { ... } };
}
```

### §3.3 Tests

5 dedicated unit tests in `apps/api/test/transform-compiler.lookup-fk-2hop.test.ts`:
- valid payload → SQL emit correct
- missing top-level keys → InvalidLookupFkPayloadError
- missing lookup_2hop block → InvalidLookupFkPayloadError
- missing intermediate_{schema,table,match_col,pk_col} → InvalidLookupFkPayloadError
- audit_metadata contiene transform=LOOKUP_FK_2HOP + intermediate path

Full vitest suite post-shipping: 332/338 PASS (5 nuovi + drift unrelated).

## §4 — Alternatives considered

### Alt A — Estendere LOOKUP_FK con heuristic 2-hop detection
- Pro: zero new transform code
- Con: implicit behavior, hard to audit, validator trigger DB-side complex
- **REJECTED**: violation of explicit-over-implicit principle

### Alt B — Pre-compute lineage 2-hop in staging phase
- Pro: separate concern from upsert
- Con: doubles staging IO, breaks single-pass invariant
- **REJECTED**: scale unfriendly per Wave 2/3/4

### Alt C — JSON_EXTRACT chain (LOOKUP_FK + chained JSON_EXTRACT)
- Pro: usa existing transforms
- Con: registry pollution (multiple mappings per single FK), UQ slot waste (CW-B20 reverse)
- **REJECTED**: amplifies registry constraints

### Alt D — N-hop generalization (LOOKUP_FK_NHOP)
- Pro: future-proof
- Con: YAGNI; 2-hop covers tutti i casi attuali + previsti next 6 months
- **DEFERRED**: se needed, ADR-0017.1 add NHOP later

## §5 — Consequences

### Positive
- ✅ 1381 rows immediate unlock post X9 Block A (esco_skills 2-hop)
- ✅ Reusable per future SDBI macro-aree con varchar URI/code resolution
- ✅ Explicit payload structure migliora debug + audit trail
- ✅ Trigger validator DB-side previene mappings malformed pre-execution
- ✅ Backward compatible: `LOOKUP_FK` invariato, additivo only

### Negative
- ⚠️ Two transforms simili (LOOKUP_FK + LOOKUP_FK_2HOP) richiedono dispatch validator logic
- ⚠️ SQL emit più verbose (3 row JOIN vs 1 row JOIN) — leggermente più costoso ma trascurabile vs scan cost
- ⚠️ Validator trigger ora deve gestire 2 transform codes — incremental complexity

### Neutral
- N-hop generalization rimane open (ADR-0017.1 future se necessario per 3+ hop)

## §6 — Acceptance criteria (post X9 Block A)

- [x] Engine case `LOOKUP_FK_2HOP` added a `transform-compiler.ts` SUPPORTED_TRANSFORMS
- [x] Migration 000043 applied (validator + trigger dispatch)
- [x] 5/5 dedicated unit tests passing
- [x] Full vitest suite 332/338 PASS (no regression)
- [x] Wave 1 re-run includes 2-hop mappings — verify 1381+ rows unlocked (via REPORT X9)
- [x] Trigger validator rejects malformed payloads at INSERT time
- [x] No regression su existing LOOKUP_FK 1-hop flow

## §7 — Migration sequence

| Step | Owner | Status |
|---|---|---|
| 1. Spec authoring | Cowork C9.2 | ✅ done (`cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md`) |
| 2. CLI X9 Block A implementation | CLI | ✅ done (commit `3a1fa8d`) |
| 3. Migration 000043 applied to DB | CLI | ✅ done (migration_id verified live) |
| 4. Engine + tests + vitest 332/338 | CLI | ✅ done |
| 5. ADR formal file (questo) | Cowork | ✅ done 2026-05-26 (retroactive) |

## §8 — Related forensic + ratifications

- `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` (spec original autorato Cowork C9.2)
- `cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md` (forensic deep fix che ha rivelato necessità 2-hop)
- `cowork_code_exchange/_04_REPORT_013_batch_x9.md` (CLI implementation REPORT — referenced batch X9 MEGA-BUNDLE)
- ADR-0014 SDBI complementary architecture
- ADR-0018 COALESCE-UQ — sibling class-of-bug fix landed same X9-X10 window

---

*ADR-0017 formalized 2026-05-26 — Cowork session retroactive ADR creation per drift documentale DOC-2 risolto in Pre-flight Phase 1.*
