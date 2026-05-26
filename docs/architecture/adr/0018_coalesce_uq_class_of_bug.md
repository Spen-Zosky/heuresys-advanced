# ADR-0018 — COALESCE-UQ class-of-bug (split-on-COALESCE)

**Status**: ACCEPTED (preventive class-of-bug documentation post-CW-B49 mitigation in X10)
**Date**: 2026-05-23
**Author**: Cowork batch C11.2
**Related**: ADR-0017 LOOKUP_FK_2HOP + CW-B49 root cause forensic (`cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md`)
**Triggered by**: REPORT 014 §5.4 — engine throughput +13851 rows post CW-B49 fix unlocked 10 sys.* tables silently failing pre-patch.

---

## §1 — Context

Il **brownfield-wave-executor engine** (`apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`) pre-X10 conteneva bug critico **CW-B49 split-on-COALESCE** che bloccava completamente upsert verso ogni sys.* table avente **UQ index con expression COALESCE interna**.

Bug location: `upsert-sql.ts:661`:
```typescript
const conflictKeyCols = conflictInference.split(",").map((s) => s.trim());  // ❌ naive
```

Per UQ index del tipo `UNIQUE (COALESCE(col, sentinel), other_col)`, il naive split(",") corrompe l'expression (vede 3 elementi invece di 2). Engine emette SQL DISTINCT ON invalido → PG raise `column does not exist` → try/catch absorba → 0 rows upserted, silently.

---

## §2 — 10 sys.* tables affette dalla class-of-bug (CW-B49)

Enumerazione esaustiva via query live `pg_get_indexdef ILIKE '%COALESCE%'`:

| # | sys.* table | UQ index definition |
|---:|---|---|
| 1 | `sys_career_paths` | `(COALESCE(career_path_tenant_id, '00000000-...'::uuid), career_path_code)` |
| 2 | `sys_compensation_bands` | `(COALESCE(compensation_band_tenant_id, '00000000-...'::uuid), compensation_band_code)` |
| 3 | `sys_kpi_definitions` | `(COALESCE(kpi_definition_tenant_id, '00000000-...'::uuid), kpi_definition_code)` |
| 4 | `sys_learning_modules` | `(COALESCE(learning_module_tenant_id, '00000000-...'::uuid), learning_module_code)` |
| 5 | `sys_learning_paths` | `(COALESCE(learning_path_tenant_id, '00000000-...'::uuid), learning_path_code)` |
| 6 | `sys_payout_curves` | `(COALESCE(payout_curve_tenant_id, '00000000-...'::uuid), payout_curve_code)` |
| 7 | `sys_skill_aliases` | `(skill_alias_skill_id, lower((skill_alias_label)::text), COALESCE(skill_alias_locale, ''))` |
| 8 | `sys_skills` | `(COALESCE(skill_tenant_id, '00000000-...'::uuid), skill_code)` |
| 9 | `sys_user_auth_roles` | `(user_auth_role_user_id, user_auth_role_role_id, COALESCE(user_auth_role_tenant_id, '00000000-...'::uuid)) WHERE ...` |
| 10 | `sys_user_certifications` | `(user_certification_tenant_id, ..., COALESCE(user_certification_issued_date, '0001-01-01'::date))` |

**Pattern strutturale comune**: il `COALESCE(col, sentinel)` ricorre per:
- **multi-tenant table con tenant nullable** (sys_career_paths, sys_compensation_bands, ecc. — 6 di 10): tenant_id può essere NULL per "global" rows, sentinel `'00000000-...'::uuid` mappa NULL → UUID per UQ semantics
- **temporal date column nullable** (sys_user_certifications): issued_date può essere NULL, sentinel `'0001-01-01'::date`
- **categorical varchar nullable** (sys_skill_aliases.locale): COALESCE empty string sentinel
- **conditional FK col nullable** (sys_user_auth_roles): COALESCE tenant_id pattern

---

## §3 — Decision

### §3.1 Fix engine (CW-B49 mitigation, applicata X10 da CLI)

**Helper extracted**: `replaceTargetColsInConflictInference(conflictInference, colEntries)` (`apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:~640-665`, exported per testability).

Algorithm: parenthesis-depth-aware substring substitution invece di naive split:

```typescript
let conflictKeyExprs = conflictInference;
for (const entry of colEntries) {
  const re = new RegExp(
    `\\b${entry.targetCol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'g'
  );
  conflictKeyExprs = conflictKeyExprs.replace(re, `(${entry.sql})`);
}
```

Output post-substitution: DISTINCT ON expression contiene `(<colEntry.sql>)` invece di bare target col name. PG sees staging-derived expressions → no `column does not exist` error.

**Test coverage**: 4 unit tests in `apps/api/test/upsert-sql.cw-b49-coalesce-conflict.test.ts` (T1 COALESCE NK UQ, T2 flat NK UQ regression, T3 nested function wrap, T4 word-boundary edge case).

### §3.2 Class-of-bug recognition

Il bug ha impact pattern **silently failing**: nessun crash, nessun audit log esplicito su `WHERE_SKIP_FILTER_EXCLUDED_V1`. Solo lo specific `staging_target_record_id IS NULL` post-INSERT mostra il problema.

**Difficile da scoprire**:
- Audit log nasconde il fail behind try/catch absorption + `skipReason: "insert_failed: column X does not exist..."`
- Solo confronto cross-table (es. "perché sys_skill_taxonomy_edges riesce ma sys_skills no?") rivela il pattern UQ COALESCE comune

**Forensic discovery method** (replicabile per future class-of-bug):
1. Hand-probe SQL diretta su staging (bypass engine wrapper)
2. Verify PG error message specific
3. Reverse-engineer engine SQL emit code path
4. Pattern-match UQ index definition across affected tables

---

## §4 — Preventive measures (future-proofing)

### §4.1 Schema design checklist (per future migrations)

Quando autorare migrations che creano UQ index, applicare questa **checklist preventiva**:

```
[ ] UQ index contiene COALESCE / lower() / altre funzioni con argomenti multipli?
  [ ] YES → verify che engine handle correctly via parenthesis-depth-aware parsing
  [ ] YES → add unit test specifico per quella table
[ ] UQ index puramente flat (comma-separated bare cols)?
  [ ] OK → engine standard substitution funziona
```

### §4.2 Engine introspection (vincente §20 function-level)

`engine.ts:loadTargetMeta()` introspecta UQ index via `pg_get_indexdef`. Aggiungere log preventivo:

```typescript
if (conflictInference?.includes('COALESCE') || conflictInference?.includes('lower(')) {
  console.warn(`[brownfield-wave-executor] target ${targetTable} has expression-based UQ: ${conflictInference}. Ensure replaceTargetColsInConflictInference handles correctly.`);
}
```

Early-warning log allerta operator quando new table con expression UQ è target di un wave run.

### §4.3 Hand-probe template (vincente §24)

Per ogni new UQ pattern non standard, eseguire pre-deploy hand-probe:

```sql
-- Template hand-probe per verify engine SQL emission
WITH staging_sample AS (
  SELECT * FROM staging.wave1_<target> LIMIT 1
)
SELECT DISTINCT ON (<emitted conflict key exprs>) staging_row_id
FROM staging_sample;
-- Expected: no PG error, returns 1 row
```

Se hand-probe fails → engine emit logic broken per quel pattern → patch needed BEFORE deploy.

---

## §5 — Impact quantification (X10 verified)

**Pre-X10 (CW-B49 active bug)**:
- Engine throughput per Wave 1: ~21,000 rows upserted
- 10 sys.* tables in #2 silently failing su ogni run
- Cumulative loss: incalcolabile (bug pre-esistente sin dall'origine engine)

**Post-X10 (CW-B49 mitigated)**:
- Engine throughput per Wave 1: ~35,000 rows upserted (+13,851 net, +65%)
- 10 sys.* tables in #2 ora upsert-able
- Direct unlock immediato: sys_learning_paths +127, sys_learning_modules +564, sys_skill_aliases +80 (new), sys_skills lineage 5593 (re-UPDATE)

**Implicazione**: ogni macro-area SDBI X11+ che touch tables in #2 ora benefits automaticamente del fix. Stima cumulativa unlock long-term: 5000-20000 rows aggiuntivi cross-batch.

---

## §6 — Acceptance + closure

### §6.1 Acceptance criteria (PASSED in X10)

1. ✅ Helper `replaceTargetColsInConflictInference` extracted + exported
2. ✅ 4/4 unit tests PASS (T1-T4 covering COALESCE / flat / nested / word-boundary)
3. ✅ Full test suite 336/342 (+4 new green)
4. ✅ Live Wave 1 retry post-patch: sys_learning_paths +127, sys_learning_modules +564 confirmed
5. ✅ No regression: sys_skill_taxonomy_edges, sys_users, sys_esco, sys_job_roles preserved
6. ✅ Engine throughput +65% confirmed (REPORT 014 §2)

### §6.2 Status

**ACCEPTED**. Bug fix shipped + verified live. Preventive measures (§4) codificate per future schema design.

---

## §7 — Risk + rollback

### Risk
- **LOW**: helper additive — non modifica behavior per UQ flat (regression test T2 PASS)
- **LOW**: regex `\b` word-boundary previene partial replacement (T4 PASS)

### Rollback
1. Revert upsert-sql.ts patch (helper function + delete site delegation)
2. Restore naive `split(",")` (NOT recommended — ri-introduce CW-B49)
3. Pattern memo §16 anti-pattern 24 rimane documentato come "known issue"

---

## §8 — Cross-references

- ADR-0014 SDBI architecture (origin engine framework)
- ADR-0017 LOOKUP_FK_2HOP (engine extension, transform-compiler.ts)
- CW-B49 forensic root cause: `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md`
- Pattern memo §16 anti-pattern 24 + §19 vincente 25 (this ADR)
- REPORT 014 X10 §1.A (patch ship evidence)

---

*End ADR-0018 — COALESCE-UQ class-of-bug enumeration + preventive measures*
