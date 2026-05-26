# Transform Compiler + Upsert SQL — Deep Code Audit

**Audit owner**: Cowork forensic agent · **Date**: 2026-05-20 · **Commit baseline**: `7a432a9` (HEAD on `main`)
**Scope**: `apps/api/src/modules/brownfield-wave-executor/` + correlated tests
**Methodology**: Read 100% del codice (no sampling), grep sistematico, cross-check git log + git diff vs HEAD
**Source-of-truth analyzed**: committed HEAD content. Working-tree truncations (vedi §9) sono separatamente isolati.

---

## §1 — Files inventory

| File | Lines (HEAD) | Lines (wt) | Status | Last commit |
|---|---:|---:|---|---|
| `transform-compiler.ts` | 487 | 339 | **M** (truncated) | `127e1a7` 2026-05-19 (Goal 003 Item F P1) |
| `upsert-sql.ts` | 638 | 455 | **M** (truncated) | `127e1a7` |
| `engine.ts` | 1309 | 1096 | **M** (truncated) | `127e1a7` (chain back to `f4164b8`) |
| `service.ts` | 193 | 140 | **M** (truncated) | (chain back to S923 handoff `7a432a9`) |
| `repository.ts` | 586 | 586 | clean | `306263b` 2026-05 |
| `run-logger.ts` | 67 | 67 | clean | `42a7401` (Goal 001a v4 Step 2) |
| `state.ts` | 36 | 36 | clean | (early) |
| `transforms.ts` | 170 | 170 | clean | (JS-side legacy path, deprecated) |
| `loader.ts` | 218 | 218 | clean | (early; ESKAP/SKILGRO ingest) |
| `routes.ts` | 67 | 67 | clean | (early) |
| `test/transform-compiler.test.ts` | 617 | 335 | **M** (truncated) | (chain back to Goal 003) |
| `test/upsert-sql-type-coerce.test.ts` | 147 | 147 | clean | `9c8cb1f` |
| `test/brownfield-wave-executor.integration.test.ts` | 146 | 146 | clean | (early) |
| `test/wave1-debug-scale-v4.test.ts` | 276 | 276 | clean | (Goal 001a v4) |
| `test/wave1-idempotency.test.ts` | 165 | 165 | clean | (Goal 001a v4) |

**Critical finding §1**: 5 file (engine, service, transform-compiler, upsert-sql, transform-compiler.test) hanno **uncommitted truncations** — `git diff --stat` riporta `5 files changed, 4 insertions(+), 878 deletions(-)`. Sono **non sintatticamente validi** (es. transform-compiler.ts si chiude a metà del case LOOKUP_FK, senza closing brace; engine.ts si tronca dentro `batchWriteLineage` function signature). Vedi §9.

---

## §2 — Architettura modulo (high-level)

```
                ┌──────────────────────────────────────────────────────┐
                │  POST /v1/brownfield/wave-executor/runs              │
                │  (routes.ts) → service.trigger(actor, body)          │
                └──────────────┬───────────────────────────────────────┘
                               │ orchestrator (service.ts)
                               ▼
        ┌──────────────────────────────────────────────────────────┐
        │ FSM state.ts: PENDING→STAGING→VALIDATING→APPROVED→       │
        │              UPSERTING→COMPLETE (+FAILED, +CANCELLED)    │
        │ Persistenza FSM: brownfield.import_runs.import_run_      │
        │  metadata.wave_executor (jsonb)                          │
        └──────────────────────────────────────────────────────────┘

  STAGING (engine.executeStage)
     loader.ensureLegacyMirrorDDL → CREATE legacy_mirror.* if missing
     loader.loadLegacyMirrorData  → INSERT from db/seeds/brownfield/wave1/legacy_data/*.sql
     truncateAllWave1Staging      → TRUNCATE staging.wave1_* CASCADE
     for each TableMapping:
       INSERT INTO staging.wave1_<short> SELECT ... FROM legacy_mirror.<src>
       (PG-side md5 content hash + to_jsonb(lm.*) raw record)

  VALIDATING (engine.executeValidate)
     for each TableMapping:
       UPDATE staging.wave1_<short> SET status='PASSED'  WHERE rules-met
       UPDATE staging.wave1_<short> SET status='FAILED' WHERE remaining
       INSERT INTO audit.import_validation_results (bulk per-row)

  APPROVED (engine.executeApprove)
     for each TableMapping with 0 fails → audit.import_approval_decisions APPROVED

  UPSERTING (engine.executeUpsert → executeUpsertSqlSidePerMapping)
     - Pre-filter cm per (LINEAGE_SOURCE_NK → audit; non-supported → audit)
     - executeUpsertSqlSidePerMapping(pool, args):
         1. transform-compiler.compileTransform per cm           (SELECT-list build)
         2. JSON_EXTRACT aggregation per target_column           (jsonb_build_object)
         3. NK fallback / system defaults / required-col fallback
         4. WHERE skip filter (UUID NK validity)
         5. INSERT INTO sys.<target> SELECT ... ON CONFLICT DO UPDATE RETURNING <pk>
         6. INSERT INTO sys.sys_source_lineage_records (CTE+JOIN)
         7. UPDATE staging.wave1_<short> SET target_record_id, upserted_at

  COMPLETE → updateWaveState; logRunEvent at every transition (run-logger.ts)
```

Trust boundary: `engine.ts` costruisce `srcExpr` come `(staging_raw_record->>'colname')` via `pg-format %L`; il compiler interpola `srcExpr` direct (è caller-trusted). Lineage write supporta sia `repository.writeLineage` (single-row, JS-side, deprecated) che `upsert-sql.ts` CTE-join (SQL-side, attivo).

---

## §3 — Transform codes — implementation vs registry vs tests

I 14 transform codes presenti in `brownfield.column_mappings` (counts dal briefing) mappati contro implementation `transform-compiler.ts` HEAD + tests `transform-compiler.test.ts` HEAD.

| Code | Reg uses | Impl: transform-compiler.ts | Test name | Payload schema | SQL output | Edge cases |
|---|---:|---|---|---|---|---|
| `JSON_EXTRACT` | 759 | L311–L335 (case `"JSON_EXTRACT"`) | `compileTransform — JSON_EXTRACT (Goal 002 Item A)` L543–L595 | `{path: "$.a.b.c"}` (string, dot-segment). Empty `$.`/`$` → NULL::jsonb. Throws `InvalidJsonExtractPayloadError` if missing/non-string. | `((src) -> 'a' -> 'b' -> 'c')` chain (`-> jsonb`, not `->>` text). Each seg quoted via `pg-format %L` (injection-safe). | NULL fallback for empty path; bracket-notation `[]` treated as literal segment (test L559); SQL keyword segment safe (test L572); dollar-quoting in segment safe (test L577). |
| `CAST_TIMESTAMPTZ` | 130 | L283–L291 (shared CAST_* branch) | `compileTransform — CAST family` L69–L83 | `{}` (no payload) | `CAST(src AS TIMESTAMPTZ)` | PG cast errors propagate to upsert-sql try/catch → audit `insert_failed:`. Plus Goal 003 Item B compat: upsert-sql L82 outer-wraps with target colType (e.g. `timestamp` target → `CAST(... AS TIMESTAMP)`). |
| `LINEAGE_SOURCE_NK` | 93 | L304–L309 (returns `fragment: null`) | `compileTransform — LINEAGE_SOURCE_NK (Goal 002 Item B)` L601–L617 | `{note: ...}` (advisory string, ignored by compiler) | None — fragment = null. **Handled by lineage write path** in upsert-sql.ts L538–L593 + engine.ts L644–L678 `recordHandledViaLineage` audit (rule_code `HANDLED_VIA_LINEAGE_WRITE_V1`). | engine.ts pre-filter L711 absorbs LINEAGE_SOURCE_NK before passing to executor (audit + skip). |
| `TRIM` | 86 | L274–L275 | `compileTransform — basic mechanical transforms` L47 | `{}` | `TRIM(src)` | applyTypeCoerceWrap considers TRIM as passthrough (upsert-sql L109) → if target colType ∈ TYPE_CAST_MAP wraps outer `CAST(TRIM(src) AS <type>)`. |
| `LOOKUP_FK` | 49 | L337–L480 (long branch, 4 sub-forms) | `compileTransform — LOOKUP_FK` block L154–L385 (15 tests) | `{target_table: string, match_on: string, return_col?: string}` | 4 paths (see below) | NULL-resolved → upsert-sql WHERE filter pre-empts row. Adversarial paths: 6 negative tests for quote/semicolon/chain injection. |
| `SKIP` | 39 | L301–L302 (returns `fragment: null`) | `compileTransform — basic mechanical transforms` L62 | `{}` | None — column omitted from INSERT. | No edge cases. |
| `DIRECT_COPY` | 11 | L270–L272 (also `null` aliased to it) | `compileTransform — basic mechanical transforms` L36, L42 | `{}` | `src` (passthrough) | applyTypeCoerceWrap passthrough — wraps to `CAST(src AS TYPE)` for non-text targets (upsert-sql L98–L120). Truncation via `LEFT(src, maxLen)` for varchar/bpchar (upsert-sql L230–L237). |
| `UPPERCASE` | 3 | L277–L278 | L52 | `{}` | `UPPER(src)` | passthrough not applied (only TRIM/DIRECT_COPY/null are passthrough per upsert-sql L109). |
| `CAST_INT` | 2 | L283–L291 (CAST branch) | CAST family | `{}` | `CAST(src AS INTEGER)` | Goal 003 Item B: outer-wrap if target = int2/int4/int8 (upsert-sql `CAST_COMPATIBLE_TARGETS`). Test `upsert-sql-type-coerce.test.ts` L70–L86. |
| `CAST_VARCHAR` | 1 | L283–L291 | CAST family | `{}` | `CAST(src AS VARCHAR)` | Goal 003 Item B: empty compat-target set (varchar handled by truncation wrapper instead, test L122). |
| `CAST_BOOLEAN` | 1 | L283–L291 | CAST family | `{}` | `CAST(src AS BOOLEAN)` | Compat-target `bool` → outer-wrap (upsert-sql L81). |
| `CAST_NUMERIC` | 1 | L283–L291 | CAST family | `{}` | `CAST(src AS NUMERIC)` | Compat-target `numeric` → outer-wrap (upsert-sql L80). |
| `LOWERCASE` | 1 | L280–L281 | L57 | `{}` | `LOWER(src)` | (passthrough non applicato) |
| `CONSTANT` | 1 | L293–L299 | L85–L127 (7 tests) | `{value: any}` — string/number/bool/null/undefined/object/array. | `pg-format %L` quoted literal. Throws `InvalidConstantPayloadError` for forbidden tokens (`now(`, `current_timestamp`, `random()`, etc. — 16-token denylist L164–L181) OR non-supported type. | Idempotency rule R8 enforced via FORBIDDEN_CONSTANT_TOKENS. Number `42` → `'42'` (pg-format quotes scalars). |

### §3.1 — LOOKUP_FK — 4 sub-forms details

```
Path A — Goal 003 Item A FALLBACK pair (sys_tenancies, legacy_tenant_id):
  L374–L380
  SQL: (SELECT m.canonical_tenant_id
          FROM brownfield.tenant_id_mappings m
          WHERE m.legacy_id = (src) LIMIT 1)
  Test: L155–L173

Path B — Goal 003 Item A FALLBACK pair (sys_users, legacy_user_id):
  L389–L393
  SQL: (SELECT user_id FROM sys.sys_users
          WHERE user_email = (staging_raw_record->>'user_email') LIMIT 1)
  Note: srcExpr ignored deliberately (lookup by email convention).
  Test: L175–L191

Path C — Goal 003 Item F P1 lineage-records JOIN (matchKey === 'legacy_id'):
  L427–L434
  SQL: (SELECT slr.source_lineage_target_record_id
          FROM sys.sys_source_lineage_records slr
          WHERE slr.source_lineage_source_record_id = (src)
            AND slr.source_lineage_target_table_name = 'sys_<target>'
          LIMIT 1)
  Triggered by match_on of forms "X_metadata->>'legacy_id'" or "X_metadata->>legacy_id"
  Test: L193–L229

Path D — Standard form (plain column OR jsonb extract):
  L395–L479
  Regex: /^([a-z_][a-z0-9_]*)(?:->>'?([a-z_][a-z0-9_]*)'?)?$/
  Depluralize logic (L444–L448): ies→y, plain s→drop, double-s preserved.
  PK_OVERRIDES (L453–L456): sys_tenancies→tenant_id, sys_blueprint_process_registry→blueprint_process_id
  SQL plain:   (SELECT <pk> FROM sys.<target> WHERE <col> = (src) LIMIT 1)
  SQL jsonb:   (SELECT <pk> FROM sys.<target> WHERE <col>->>'<key>' = (src) LIMIT 1)
  Test: L246–L317 (10 tests across positive + adversarial)
```

---

## §4 — Documented vs Implemented gap analysis

**Documented codes NOT implemented in transform-compiler.ts (CASE-BLOCK level)**:

Da `SUPPORTED_TRANSFORMS` (L188–L204) — 15 entries (14 codes + `null`). Tutti i 14 transform codes registry-presenti SONO implementati in `compileTransform`.

**Documented in `transforms.ts` (JS-side legacy) but NOT implemented in transform-compiler.ts (SQL-side)**:

`transforms.ts` L52–L145 implementa 23 distinti switch cases. Quelli **assenti** dal SQL-side compiler (e che throw `UnsupportedTransformError`):

| Code in transforms.ts | Reg uses | Status SQL-side | Documented in PLAN v4 §1 |
|---|---:|---|---|
| `CAST_UUID` | 0 | NOT impl (unsupported) | vocabulary only |
| `CAST_DATE` | 0 | NOT impl | vocabulary only |
| `DEFAULT_IF_NULL` | 0 | NOT impl | vocabulary only |
| `HASH_SHA256` | 0 | NOT impl | vocabulary only |
| `CONTENT_HASH` | 0 | NOT impl | vocabulary only |
| `NATURAL_KEY` | 0 | NOT impl | vocabulary only |
| `CONCAT` | 0 | NOT impl | vocabulary only |
| `REGEX_EXTRACT` | 0 | NOT impl | vocabulary only |
| `SYNTHETIC_FLAG` | 0 | NOT impl | vocabulary only |

Le 9 entry sopra hanno 0 row in registry — il PLAN v4 §1 le classifica esplicitamente come "vocabulary entries with 0 mappings". `transform-compiler.ts` L8–L15 e `test/transform-compiler.test.ts` L388–L399 esplicitamente le testano come `UnsupportedTransformError`. **Gap intenzionale, documentato**.

**Implemented but NOT documented anywhere**: nessuno trovato. Ogni branch del `switch` ha JSDoc inline o riferimento PLAN.

**Payload schema mismatches**:
- `JSON_EXTRACT` JS-side (`transforms.ts` L109–L123) usa `payload.path` con stripping `$` poi `.split(".")`; SQL-side (`transform-compiler.ts` L324) usa `path.replace(/^\$\.?/, "")` + `split(".")`. **Semantically equivalent** — i test JS-side e SQL-side concordano sul comportamento per `$.a.b` → `[a, b]`.
- `LOOKUP_FK` JS-side (`transforms.ts` L130–L138) chiede `payload.target_table` + usa runtime `fkResolver`; SQL-side richiede ANCHE `payload.match_on` (regex-validated). **Schema asimmetrico**: SQL-side è il path attivo (engine ora chiama `executeUpsertSqlSidePerMapping`), e `match_on` è obbligatorio nel registry per ogni delle 49 row LOOKUP_FK (verificato da test adversarial).

---

## §5 — Test coverage assessment

**`transform-compiler.test.ts` (committed HEAD: 617 lines, 50 it() tests organized in 9 describe blocks)**

| describe block | # tests | Coverage |
|---|---:|---|
| basic mechanical transforms | 6 | DIRECT_COPY, null, TRIM, UPPERCASE, LOWERCASE, SKIP |
| CAST family | 5 | CAST_TIMESTAMPTZ, CAST_INT, CAST_VARCHAR, CAST_BOOLEAN, CAST_NUMERIC |
| CONSTANT | 7 | string/number/boolean/null/undefined/single-quote-escape/JSON object |
| CONSTANT idempotency rejection (R8) | 7+ | now()/CURRENT_TIMESTAMP/random()/gen_random_uuid()/nextval()/SELECT-prefix; + non-supported value type |
| LOOKUP_FK (Goal 002 Item C: match_on payload) | 12 | fallback A+B+P1, return_col override, missing/invalid target_table+match_on, adversarial injection 3 patterns |
| LOOKUP_FK Goal 003 Item A adversarial fixtures (C2 ≥5) | 5 | ADV-A1 quote injection, ADV-A2 semicolon, ADV-A3 uppercase no-trigger, ADV-A4 fallback-leak, ADV-A5 cross-target |
| UnsupportedTransformError | 10 | 9 vocabulary-only codes + 1 bogus |
| srcExpr validation | 1 | empty srcExpr rejection |
| SQL injection adversarial (A14) | 5 | CONSTANT break-out, LOOKUP_FK target_table inj, return_col inj, idempotency, all-12-codes safe-sample |
| JSON_EXTRACT (Goal 002 Item A) | 7 | happy path, depth 1, bracket outlier, quote injection, SELECT keyword, $$evil$$ dollar-quoting, empty path, missing path key |
| LINEAGE_SOURCE_NK (Goal 002 Item B) | 3 | fragment=null, targetColumn preserved, SUPPORTED_TRANSFORMS contains |
| SUPPORTED_TRANSFORMS export | 1 | count = 15, all 14 codes + null |

**Edge cases tested**:
- SQL injection (single-quote, semicolon, double-dash, DROP/UPDATE/DELETE, dollar-quoting)
- NULL/undefined for CONSTANT (safe via %L → `NULL`)
- Empty path/match_on/target_table (defensive throws)
- Idempotency tokens (16-token denylist)
- All 14 codes round-tripped through `emittedSqlIsSafe` helper

**Edge cases NOT tested**:
- `transform-compiler.test.ts` non testa la combinazione `upsert-sql + compiler` insieme (è scope di integration test `wave1-debug-scale-v4.test.ts`).
- LOOKUP_FK Path C (matchKey='legacy_id' senza essere ricondotto a lineage JOIN se key non-`legacy_id` — testato L231–L244).
- Non c'è test per `payload.path` con segment vuoto interno (`$.a..b`) — il `filter(s => s.length > 0)` lo gestisce ma è silently passato.
- Non c'è test che il `srcExpr` venga interpolato letteralmente (trust boundary documentato a L22–L26 ma non test-coperto per srcExpr malicious).

**Coverage `upsert-sql-type-coerce.test.ts`** (147 lines, 16 tests in 4 describe blocks):
- Goal 003 Item K NEW types: interval/time/timetz/bytea (4 tests)
- Goal 002 Item E regression: int2/numeric/bool/jsonb (4 tests)
- Goal 003 Item B CAST_* compat: CAST_INT×{int2,int4,int8}, CAST_NUMERIC, CAST_BOOLEAN, CAST_TIMESTAMPTZ×{timestamptz,timestamp} (7 tests)
- Negative cases: incompat compat-target, non-CAST transforms, undefined colType, uuid (intenzionalmente escluso), text (5 tests)

**Coverage `brownfield-wave-executor.integration.test.ts`** (146 lines, 4 it() tests in 1 describe block):
- LIST runs with PLATFORM_ADMIN
- USER outsider 403 on list
- USER 403 on POST
- POST run wave=2 → 400 WAVE_NOT_IMPLEMENTED

**Coverage `wave1-debug-scale-v4.test.ts`** + `wave1-idempotency.test.ts`: integration-level, debug-scale (env `WAVE1_DEBUG_LIMIT`); esercitano la pipeline end-to-end con dataset ridotto + idempotency check (2 run consecutive). Non isolano singoli transform codes ma validano end-to-end.

**Gap test ad alta priorità**:
- Nessun test cross-modulo: `executeUpsertSqlSidePerMapping` non ha unit tests con mock pool (vive solo nelle integration tests).
- Nessun coverage per il WHERE skip filter (CW-B17 documentato §6 sotto) tranne integration-end-to-end.

---

## §6 — Upsert-sql analysis

### §6.1 — WHERE skip filter (CW-B17 catalog)

`upsert-sql.ts` L385–L416 (corrected; richiamato dal briefing come "238-269" ma il committed HEAD ha shifting linee):

```sql
WHERE staging_import_run_id = $1
  AND staging_source_table = $2
  AND staging_validation_status = 'PASSED'
  AND staging_target_record_id IS NULL
  -- skipFilters generated below:
  AND (<nk_uuid_col>) IS NOT NULL
  AND (<nk_uuid_col>)::text ~* '<UUID regex>'
  AND (<req_uuid_col>) IS NOT NULL
  -- ... ripetuto per ogni UUID NK + UUID required column
```

**Logica silent-skip** (L386–L416):
1. Per ogni `nkCol ∈ targetMeta.naturalKeyColumns`:
   - Se `colType === "uuid"` e NON termina `_tenant_id` (questi sono allowed NULL):
     - Aggiunge: `(<sql>) IS NOT NULL` AND `(<sql>)::text ~* '<UUID_REGEX>'`
2. Per ogni `reqCol ∈ targetMeta.requiredColumns`:
   - Salta se è PK/tenant/global/meta/name/NK
   - Se `colType === "uuid"` (es. FK come `skill_taxonomy_edge_skill_id`):
     - Aggiunge: `(<sql>) IS NOT NULL`
3. Se compilato fragment manca per quella col → aggiunge `FALSE` come hard-filter (silent skip totale).

**UUID_REGEX_PG** (L167):
`'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`

**Cosa filtra (silent skip senza audit class)**:
- Row con `LOOKUP_FK` che risolve a NULL (perché legacy_id non in `brownfield.tenant_id_mappings`, o `user_email` NULL, o `source_lineage_target_record_id` non popolato per quella source_record_id).
- Row con NK UUID che non rispetta il regex (es. valore malformato in legacy_mirror).
- Row con required UUID column NULL (es. FK obbligatoria irrisolta).

**Perché silent**: il WHERE è parte dell'INSERT … SELECT — le righe escluse non producono error, non producono audit row, non incrementano `failedRows`. La conseguenza: `upsertedRows` ≪ `validatedRows` ma niente in `audit.import_validation_results` spiega perché. Questo è il "silent gap" individuato nel briefing come `CW-B17`.

**Trade-off documentato**: l'approccio "WHERE skip vs INSERT-then-catch" risparmia round-trip e mantiene il INSERT atomico per la mappatura. Il costo è osservabilità degradata.

### §6.2 — ON CONFLICT inference

`upsert-sql.ts` L427–L434:
```typescript
const conflictInference = targetMeta.conflictInference;
if (!conflictInference) {
  return { ..., skipped: true, skipReason: "no_conflict_inference_available" };
}
```

`engine.loadTargetMeta` L96–L141 estrae l'inference clause dalla prima UNIQUE NON-PK index (via `pg_get_indexdef` + regex `USING <method> (...)`). Ricava sia il **conflictInference string** (per `ON CONFLICT (...)`) sia i **naturalKeyColumns** (per JOIN-back nel lineage CTE).

L'inference clause è interpolata raw (es. `COALESCE(skill_tenant_id, '00000000-...'::uuid), skill_code`) — copre sia colonne sia espressioni indicizzate.

### §6.3 — PK overrides

Definiti in **due luoghi** (denormalizzazione):

1. **transform-compiler.ts** L453–L456 (per LOOKUP_FK Path D return_col):
   - `sys_tenancies` → `tenant_id`
   - `sys_blueprint_process_registry` → `blueprint_process_id`

2. **engine.ts** L65 (per PK column default):
   - Generico: `<short>_id` dove `short = target.replace(/^sys_/, "")`.
   - Override implicito dalle UQ index inspection in `loadTargetMeta` L98–L109.

**Bug latente identificato**: i due override map sono separati e potrebbero divergere. PK override in transform-compiler è hardcoded; in engine viene derivato dalla DB schema. Per `sys_tenancies` entrambi convergono su `tenant_id` (OK), ma per future tabelle con PK non-convenzionali serve doppio update.

### §6.4 — Lineage row write

`upsert-sql.ts` L537–L593 — pattern CTE+JOIN single-statement:

```
WITH src AS (SELECT row + NK aliases FROM staging WHERE ...)
INSERT INTO sys.sys_source_lineage_records (...)
SELECT $3::uuid, 'heuresys_platform', s.*, t.<pk>, ...
  FROM src s JOIN sys.<target> t ON (NK match)
ON CONFLICT (source_system, source_table, source_record_id, target_table_name)
  DO UPDATE SET source_lineage_target_record_id = EXCLUDED.*, ...
```

NK match: per ogni NK col, alias come `__nk_<col>` nella CTE; JOIN clause: `t.<col> IS NOT DISTINCT FROM s.__nk_<col>` (NULL-safe compare).

Failure handling: `try/catch` (L595–L610) — failure è loggato a console (non audit). **Lineage failure non poisona il run**. Questo è intenzionale (CW-B comment a L606).

---

## §7 — Engine / lifecycle

### §7.1 — Phases summary

| Phase | engine fn | Lifecycle event | Notes |
|---|---|---|---|
| RUN_CREATED | (service.ts L57–L65) | service writes `audit.import_run_logs` via `logRunEvent` | row inserito in `brownfield.import_runs` |
| STATE_STAGING | `executeStage` L150–L224 | `STATE_STAGING` + `STAGE_COMPLETE` payload `{mappings, staged_rows_total}` | SQL-side `INSERT INTO staging FROM legacy_mirror` (eliminates JS OOM per CW-B18) |
| STATE_VALIDATING | `executeValidate` L230–L381 | `STATE_VALIDATING` + `VALIDATE_COMPLETE` payload `{validated, failed}` | Set-based 2-pass UPDATE; bulk audit insert per mapping |
| STATE_APPROVED | `executeApprove` L387–L435 | `STATE_APPROVED` + `APPROVE_COMPLETE` payload `{approved, rejected}` | 0-failed → APPROVED; >0-failed → REJECTED |
| STATE_UPSERTING | `executeUpsert` L540–L962 | `STATE_UPSERTING` + `UPSERT_COMPLETE` payload `{upserted, lineage}` | NEW SQL-side path via `executeUpsertSqlSidePerMapping`; topo-ordered for FK resolution |
| STATE_COMPLETE | (terminal) | `STATE_COMPLETE` (informational) | `import_run_finished_at` set; metadata stats persisted |
| STATE_FAILED | (catch) | `STATE_FAILED` payload `{error_class, message, stack_head}` | Try/catch in service.ts L132–L144 |
| STATE_CANCELLED | (manual) | (no event — direct update) | Only via `POST /runs/:id/cancel` endpoint |

### §7.2 — Idempotency

- **STAGING**: TRUNCATE all 17 staging tables → INSERT new. Idempotent across re-runs.
- **VALIDATING**: predicate `staging_validation_status = 'PENDING'` — solo righe non già valutate. Re-run senza TRUNCATE = no-op.
- **UPSERTING**: `ON CONFLICT DO UPDATE` per sys.<target>; secondary same on lineage. Re-run con stesso content_hash → idempotent (EXCLUDED.* identici).
- **APPROVE**: ogni run scrive una NUOVA `audit.import_approval_decisions` row (no ON CONFLICT). Non strettly idempotent ma append-only.

**Idempotency tested**: `wave1-idempotency.test.ts` esegue 2 run consecutive e verifica counts.

### §7.3 — Topological order

`engine.ts` L448–L469 — `WAVE1_TOPO_ORDER` array di 17 target tables ordinate L0/L1/L2 (catalogs → dependents). Mappings sortate via `topoIndex` prima di iterare. Garantisce che FK LOOKUP_FK risolvano dopo che il parent ha popolato.

### §7.4 — JS-side dead code

`engine.ts` L782–L958 — l'intero blocco `if (false)` è il vecchio JS-side per-row UPSERT path (chunk loop con `buildTargetRow`, `batchUpsertTarget`, `batchWriteLineage`, `batchMarkStagingUpserted`). Marcato come **DEPRECATED in Goal 001a v5** (L722–L729). Reference no-op a `ensureFkLookupLoaded` (L575) tenuta solo per pacificare `noUnusedLocals`. Scheduled per rimozione in **Goal 001b**.

**Codice morto identificato**: ~180 righe (782–958). Più ~50 righe associate (`UpsertedRow` interface, `batchUpsertTarget`, `batchWriteLineage`, `batchMarkStagingUpserted`, `buildTargetRow`, `upsertTargetRow`, `serializeForPg`) — solo `batchWriteLineage` e helpers sono ancora chiamati nell'`if(false)` block.

---

## §8 — Repository / service / run-logger

### §8.1 — repository.ts (586 lines)

Pattern: **raw parameterized SQL** (no Drizzle query builder per selects). Funzioni esposte:

| Func | Linee | Scope |
|---|---:|---|
| `createWaveRun` | L86–L107 | INSERT `brownfield.import_runs` con `import_run_classification_scope='wave_executor'` + bootstrap `wave_executor` metadata jsonb |
| `findWaveRun` | L109–L118 | SELECT singolo + `unwrap()` cosmetic |
| `listWaveRuns` | L120–L154 | SELECT con filtro wave/state + count(*) per total |
| `updateWaveState` | L156–L194 | `jsonb_set(jsonb_set(metadata, '{wave_executor,state}', ...), '{wave_executor,failure_reason}', ...)` + status mirror |
| `setWaveStats` | L196–L211 | jsonb_set su `{wave_executor,stats}` |
| `getWave1Mappings` | L230–L251 | SELECT JOIN brownfield.table_mappings + source_tables filtered wave=1, APPROVED, IMPORT |
| `getColumnMappingsForTableMapping` | L261–L278 | SELECT JOIN column_mappings + source_columns |
| `stagingTableFor` | L291–L304 | mapping target → staging table (whitelist 17 tables) |
| `truncateAllWave1Staging` | L306–L319 | single TRUNCATE + CASCADE |
| `bulkInsertStaging` | L330–L372 | parametrized batch INSERT (BATCH=500) — usato dal **deprecated** JS-side path |
| `listStagingForUpsert`/`listAllStagingForRun` | L386–L422 | SELECT staging rows by status |
| `updateStagingValidation`/`markStagingUpserted` | L424–L453 | UPDATE singolo (deprecated JS-side path) |
| `writeLineage` | L459–L507 | INSERT singolo `sys.sys_source_lineage_records` (used by **deprecated** path; SQL-side ora usa CTE+JOIN inline) |
| `writeAuditValidation`/`writeAuditApproval` | L509–L563 | INSERT singolo audit rows |
| `resolvePlatformTenantId` | L574–L585 | SELECT `HEURESYS_PLATFORM` o `PLATFORM` tenant; fallback first tenant |

**Pattern notes**:
- Tutto via parametrized `$1, $2`. Nessun string interpolation di valori utente.
- Identifier interpolation (target/staging tables) viene da whitelist statica in `stagingTableFor` o da `mapping.target_table` (registry-controlled).
- `unwrap()` (L50–L76) — singola fonte per DTO→API model con stats reduce.

### §8.2 — service.ts (193 lines)

Orchestrator. **5 methods**:

| Method | Linee | Auth | Logic |
|---|---:|---|---|
| `list` | L42–L44 | (no PLATFORM_ADMIN gate intenzionale? — solo read) | listWaveRuns |
| `getById` | L46–L50 | (no gate, read) | findWaveRun |
| `trigger` | L52–L148 | PLATFORM_ADMIN required | Orchestrazione completa: createRun → STAGING → VALIDATING → APPROVED → UPSERTING → COMPLETE. Try/catch globale → STATE_FAILED + STATE_FAILED audit |
| `cancel` | L150–L160 | PLATFORM_ADMIN required | Solo se non terminal → status=CANCELLED |
| `getAcceptance` | L162–L173 | PLATFORM_ADMIN required | runAcceptanceChecks (3 sanity SQL checks) |

**Synchronous orchestration** (L66–L67 commento): la request blocca fino a COMPLETE/FAILED. Per Wave 1 47k rows non è scalabile (timeout HTTP probabile) ma tests usano `WAVE1_DEBUG_LIMIT`.

**Bug minore identificato** (L172): `runAcceptanceChecks` valuta 3 query SQL ma il check `lineage_rows_written` ha `pass: true` hard-coded — è solo informational, mai fail. Documentato a L1292 di engine.ts come "informational; empty wave is allowed".

### §8.3 — run-logger.ts (67 lines)

**Singolo primitivo**: `logRunEvent(q, {runId, level, message, payload})` → INSERT `audit.import_run_logs` → RETURNING id.

**Pattern**: ogni state transition + key lifecycle events in service.ts chiama logRunEvent (vedi service.ts L59–L65, L71, L80–L88, L92, L94–L102, L106, L108–L113, L117, L119–L127, L131, L137–L142).

Schema target (commento L15–L21): `import_run_log_id (PK uuid)`, `import_run_log_run_id (FK)`, `import_run_log_level`, `import_run_log_message`, `import_run_log_payload (jsonb)`, `created_at`.

**FK constraint**: `runId` deve essere già row in `brownfield.import_runs` — commento esplicito a L46.

---

## §9 — Uncommitted changes status

`git diff --stat`:
```
.../engine.ts            | 213 +---------------
.../service.ts           |  54 +---
.../transform-compiler.ts| 149 +----------
.../upsert-sql.ts        | 184 +-------------
apps/api/test/transform-compiler.test.ts | 282 ---------------------
 5 files changed, 4 insertions(+), 878 deletions(-)
```

**Natura modifiche**: tutte cancellazioni, nessuna addizione meaningful. Pattern uniforme: i file si interrompono a metà funzione/case lasciando il file sintatticamente invalido.

**File-by-file diff**:

| File | Truncation point (working tree) | HEAD lines | WT lines | Risultato |
|---|---|---:|---:|---|
| `transform-compiler.ts` | Tronca dentro case `LOOKUP_FK` dopo il commento iniziale (L339). Mancano: implementation Path A/B/C/D, default branch, closing braces. | 487 | 339 | Non compila |
| `upsert-sql.ts` | Tronca dentro `executeUpsertSqlSidePerMapping` poco prima della costruzione INSERT SQL. Manca il blocco INSERT/CTE/UPDATE finale. | 638 | 455 | Non compila |
| `engine.ts` | Tronca dentro firma di `batchWriteLineage`. Mancano: body batchWriteLineage, batchMarkStagingUpserted, buildTargetRow, upsertTargetRow, serializeForPg, runAcceptanceChecks, loadMappings, refreshRun. | 1309 | 1096 | Non compila |
| `service.ts` | Tronca dentro catch block del `trigger` (taglia `errorClass`, `stackHead`, e tutto dopo). Mancano: chiusura try/catch, `cancel`, `getAcceptance`, `countLegacyMirrorRows`. | 193 | 140 | Non compila |
| `transform-compiler.test.ts` | Tronca dentro `describe(LOOKUP_FK Goal 003 Item A adversarial fixtures)` durante ADV-A2. Mancano: ADV-A3/A4/A5 + UnsupportedTransformError suite + srcExpr validation + SQL injection adversarial + SUPPORTED_TRANSFORMS export + JSON_EXTRACT + LINEAGE_SOURCE_NK suites. | 617 | 335 | Test parzialmente valido |

**Interpretazione**: i file working tree sono **artefatto di un editor crash o operazione di cancellazione parziale**, non un commit deliberato. Il committed HEAD `7a432a9` è lo stato semanticamente valido. **Azione raccomandata**: `git checkout HEAD -- apps/api/src/modules/brownfield-wave-executor/ apps/api/test/transform-compiler.test.ts` per ripristinare, oppure preservare working tree se Enzo sa che sono modifiche WIP recoverable. **NON committarli** in stato corrente.

Nessuna delle 5 modifiche aggiunge funzionalità — sono pure rimozioni di codice esistente.

---

## §10 — Implications per opzioni strategiche

### Opzione 1 — Completa brownfield

**Effort estensione per Wave 2/3/4 nuove aree**:

Stima per **nuovo transform code** (es. `CAST_DATE`, `CONCAT`, `DEFAULT_IF_NULL`):
- transform-compiler.ts: 1 case branch (5–30 LOC) + add to SUPPORTED_TRANSFORMS
- transform-compiler.test.ts: 3–8 it() tests (happy + edge + adversarial)
- Migration DB-side: aggiungere validator `brownfield.validate_<code>_payload()` se serve schema enforcement (vedi LOOKUP_FK mig 000033)
- **Effort per code semplice (passthrough/single SQL fn): ~2-4 ore** including test
- **Effort per code complesso (es. CONCAT con multi-source columns, REGEX_EXTRACT con regex compile): ~6-10 ore**

Stima per **nuova fallback pair LOOKUP_FK** (es. (sys_skills, legacy_skill_id) → JOIN lineage_records):
- Già supportato via Path C (matchKey='legacy_id' → lineage JOIN). Aggiunta richiede solo registry mapping update + scope-lock test.
- **Effort: ~1-2 ore**

Stima per **nuovo target table** Wave 2/3/4:
- Aggiungere staging migration (sul pattern 000030)
- Aggiungere alla whitelist `stagingTableFor` + `truncateAllWave1Staging` + `WAVE1_TOPO_ORDER`
- Registry seed (table_mappings + column_mappings) — è il vero lavoro
- **Effort estensione codice executor: trivial (~30 min)**. Effort design registry mappings: significant ma fuori da questo modulo.

**Bug noti / debt da fixare**:

1. **Dead JS-side path** (engine.ts 180+ LOC `if(false)` block + helpers): rimuovere in Goal 001b come pianificato.
2. **PK_OVERRIDES doppio** (§6.3): consolidare in `engine.loadTargetMeta` → propagare a transform-compiler via parametro.
3. **WHERE skip filter silent gap** (CW-B17): NESSUN audit row per i righe escluse dall'UUID-validity filter. Mitigation: aggiungere COUNT() pre-INSERT che confronta `validatedRows` vs `would-be-inserted-rows` e produce audit row `WHERE_SKIPPED:<n>` quando differiscono. **Effort: ~4-6 ore**.
4. **Lineage failure silenzioso** (upsert-sql.ts L606): solo console.error, no audit. Considerare audit row `LINEAGE_WRITE_FAILED`.
5. **Async lifecycle**: `service.trigger` è synchronous (HTTP request blocca fino a COMPLETE). Per Wave 2+ con 100k+ rows servirà queue-based async pattern. **Effort architettura: medium**.

**Test coverage da estendere**:
- Unit test per `executeUpsertSqlSidePerMapping` con mock pool (oggi solo integration).
- Unit test per WHERE skip filter edge cases.
- Integration test full-scale (commit `e8...`-tracked: `BROWNFIELD_RUN_REAL_WAVE1=1` env gate is documented in `brownfield-wave-executor.integration.test.ts` L4-L9 ma non shipped come CI test).

### Opzione 2 — SDBI puro

**Codice riusabile come "mechanical executor"**:

| Componente | Riuso SDBI | Note |
|---|---|---|
| `state.ts` (36 LOC FSM) | 100% riusabile | FSM is generic |
| `service.ts` orchestrator | ~70% riusabile | Trigger lifecycle pattern OK; specific path STAGING/VALIDATING/APPROVED da rivedere |
| `run-logger.ts` | 100% riusabile | audit primitive generico |
| `repository.ts` lifecycle (createRun/findRun/listRuns/updateState) | 100% riusabile | brownfield-agnostic |
| `repository.ts` staging (bulkInsertStaging, truncate) | 0% riusabile | brownfield-specific table names + schema |
| `engine.executeValidate` | 0% riusabile | Wave 1-specific rules baked in SQL |
| `engine.executeUpsert` (sans dead code) | 50% riusabile | Pattern OK ma topology + naturalKey logic brownfield-specific |
| `transform-compiler.ts` | 100% riusabile per altri ETL | Pure SQL fragment compiler — generic by design |
| `upsert-sql.ts` `executeUpsertSqlSidePerMapping` | 50% riusabile | NK fallback + sys.<target> + lineage write pattern brownfield-bound, ma struttura INSERT-SELECT generica |
| `loader.ts` ESKAP/SKILGRO ingest | 0% riusabile | Wave 1-specific |
| `transforms.ts` (deprecated JS-side) | DROP | obsolete |

**Quanto va riscritto**: la **transformation primitive layer** (transform-compiler + run-logger + state) è essenzialmente data-driven e generic — riusabile. La **integration layer** (engine.ts, loader.ts, repository.ts staging functions) è ~70% brownfield-specific. **Totale riscrittura SDBI puro: stimata 60–70% del modulo**.

### Opzione 3 — Hybrid

**Cosa resta brownfield**:
- `loader.ts` (ingestion legacy_mirror)
- `engine.executeStage` SQL-side staging from legacy_mirror
- `engine.executeValidate` Wave 1 rules
- Whitelist `stagingTableFor` (specific tables)
- `transforms.ts` legacy JS-side path (drop comunque)

**Cosa va SDBI**:
- `transform-compiler.ts` (already generic — vita propria come `apps/api/src/lib/sql-transform/`)
- `upsert-sql.ts` `executeUpsertSqlSidePerMapping` come template per altri INSERT-SELECT mechanical executors
- `run-logger.ts` come audit primitive cross-modulo
- `state.ts` FSM helper riusabile
- Pattern lifecycle in `service.ts` (extract a base class / decorator)

**Costo refactoring split**: ~8–14 giorni di ingegneria (estrazione moduli + test isolation + import path updates + doc).

---

## Key findings summary

1. **14 transform codes registry = 14 implementati in `transform-compiler.ts`**. Zero gap docs-vs-code per il dataset attivo. I 9 vocabulary-only codes (CAST_UUID, CAST_DATE, DEFAULT_IF_NULL, HASH_SHA256, CONTENT_HASH, NATURAL_KEY, CONCAT, REGEX_EXTRACT, SYNTHETIC_FLAG) sono **deliberatamente unsupported** e testati come `UnsupportedTransformError`.

2. **LOOKUP_FK ha 4 path runtime distinti** (2 fallback pair + lineage JOIN P1 + standard regex form). Coverage test buona (15 it()). PK_OVERRIDES denormalizzato tra `engine.ts` e `transform-compiler.ts` — refactor candidate.

3. **Working tree CORROTTO**: 5 file (engine, service, transform-compiler, upsert-sql, transform-compiler.test) hanno truncamenti accidentali di 878 LOC totali. **Non compilano nello stato attuale del working tree**. Il committed HEAD `7a432a9` è la SoT semanticamente valida. **Azione critica**: `git checkout HEAD -- ...` o discussione con Enzo prima di qualsiasi build/test.

4. **WHERE skip filter silent (CW-B17)** è la principale criticità di osservabilità: righe valide ma con FK irrisolto/NK UUID malformato vengono silenziosamente saltate senza audit row. Differenza `validatedRows - upsertedRows` può essere significativa e invisibile.

5. **~230 LOC di dead JS-side code in `engine.ts`** (block `if (false)` L782–L958 + helpers): `batchUpsertTarget`, `batchWriteLineage`, `batchMarkStagingUpserted`, `buildTargetRow`, `upsertTargetRow`. Scheduled per cleanup in Goal 001b. **Effort cleanup**: ~2 ore.

6. **`transform-compiler.ts` è SQL-injection-hardened**: 5 adversarial tests covering CONSTANT break-out, LOOKUP_FK target_table/return_col/match_on injection, idempotency tokens. `pg-format` `%I/%L` usato consistentemente. **Audit conclude**: nessun injection vector identificato nel codice HEAD.

7. **Effort estensione brownfield (Opzione 1)**: nuovo transform code semplice ~2-4h, complesso ~6-10h. Nuovo target table Wave 2 ~30min code + significant registry seed work. WHERE silent gap fix ~4-6h. Dead code cleanup ~2h. **Totale debt cleanup pre-extension**: ~10-15h prima di shippare Wave 2 fresh.

8. **Riusabilità SDBI**: transform-compiler/run-logger/state sono già generici (~100% riusabili). Engine + loader + repository staging functions sono ~70% brownfield-specific. Refactor split costo: 8–14 giorni eng.

9. **Test coverage maturo per transform-compiler** (50 it() in 9 describe blocks, 617 LOC HEAD). Lacuna principale: nessun unit test per `executeUpsertSqlSidePerMapping` (solo integration). Nessun test per WHERE skip silent gap.

10. **Engine.ts è il file più complesso e dual-implementation**: SQL-side path (active, ~280 LOC) + JS-side dead path (~230 LOC) + topology + FK cache + audit absorption. È il candidate #1 per refactor pre-Wave-2.
