# Cowork → CLI PROMPT Pattern (memo cross-session)

**Author**: Cowork Claude
**Date**: 2026-05-20
**Trigger**: Enzo feedback 2026-05-20 — "Per il futuro, ricordati di essere sufficientemente assertivo e direttivo con cli ma utilizza appieno anche le sue capacità critiche di valutare le istruzioni, segnalare criticità, proporre correzioni e azioni eccetera"

---

## §1 — Direttiva fondante

Quando scrivi PROMPT per CLI, equilibrio tra **assertività direttiva** e **invito al critical thinking**. Non uno O l'altro — entrambi.

**Assertività** = scope chiaro, no ambiguità, halt+escalate triggers specifici, REPORT format obbligatorio, decisioni Enzo locked esplicitamente, vincoli ("fai X, non fare Y").

**Critical thinking invited** = CLI ha capacità di valutazione + è più vicino al codice durante esecuzione + può vedere bug/lacune nel mio lavoro. Trattarlo come "esecutore meccanico" sottoutilizza la sua intelligenza.

---

## §2 — Pattern del PROMPT (10 sezioni standard)

### §A. Identity + role + commitments

- Chi è CLI in questo batch
- Cosa ha fatto Cowork prima (1-paragraph executive briefing)
- Lista commitments espliciti (read prompt fully, execute step-by-step, halt-escalate, REPORT, no push without instruction)
- **Critical thinking INVITED** sub-section: 5 modalità di critical input (segnala lacune/errori, proponi alternatives, flagga decisioni strategiche subottimali, cataloga nuovi bias, documenta anomalie)

### §B. Executive briefing (5-min read)

- Project context (1 paragrafo)
- Current state DB + repo (numerical + factual)
- Cosa Cowork batch precedente ha già fatto (LIVE, no CLI work needed)
- Decisioni Enzo locked (no further confirmation needed)
- Cosa CLI deve NON fare (out-of-scope esplicito)

### §C. Repository + DB current state snapshot

- Commands to verify state with expected outputs
- Reference points (commit SHAs, runId, row counts)

### §D. Pre-flight checks (mandatory before main work)

- Numbered checks with expected outputs
- "Halt+escalate if any fails" policy

### §E. Decisions context (already locked)

- Tabella decisione/stato/reference
- Mai chiedere CLI di ri-decidere ciò che Enzo ha già locked

### §F. Main work — step-by-step

**Direttivo**: numerate steps, code inline (not pointer-only), command examples, expected outputs.

**Critical-thinking room**: per ogni step, indica confidence level Cowork:
- High-confidence: "esegui as-is, segnala anomalie"
- Medium-confidence: "valuta criticamente, proponi alternatives se serve"
- High-judgment moments: "tuo critical thinking attivo, halt+escalate se ambiguità materiali"

### §G. Cowork artifacts directory (drill-down on demand)

- Tabella file/purpose
- "Do NOT load all of these — solo quando ambiguità"

### §H. Halt+escalate triggers

- Lista numerata triggers concreti (NOT vague "if anything weird")
- Format markdown del halt notify

### §I. REPORT format mandatory

- Markdown skeleton con sezioni numerate
- Include obbligatorio:
  - §1 step-by-step outcomes (factual)
  - §2 halts + anomalies documented
  - §2.5 **Cowork spec improvements suggested** (critical thinking output) ← KEY
  - §3 deferred items
  - §4 next-step recommendation per Cowork batch successivo
  - §5 bias catalog candidates
  - §6 feedback sul modello operativo Cowork↔CLI

### §J. Closing instructions

- STOP marker chiaro (cosa NON fare dopo Block A)
- "Good luck" + invito a ri-leggere prima di iniziare

---

## §3 — Anti-patterns da evitare

### ❌ Anti-pattern 1: "Pointer style PROMPT"
```
"Leggi questi 8 file e poi esegui"
```
**Problema**: CLI è sessione fresca senza context. Leggere 8 file costa 50-100k token + non garantisce CLI assorba dettagli.
**Fix**: self-contained briefing inline. Pointer ai file solo per drill-down on-demand.

### ❌ Anti-pattern 2: "Trust me, don't think"
```
"Trust Cowork's diagnostic — do NOT re-investigate"
"Just execute the spec as-is"
```
**Problema**: scoraggia CLI dal segnalare bug/lacune visibili durante esecuzione. Sottoutilizza critical thinking di CLI.
**Fix**: "Trust + critique balance" — alto trust default ma esplicito invito a segnalare evidence contraria.

### ❌ Anti-pattern 3: "Massive batch monolithic"
```
"Esegui Block A + Block B + Block C end-to-end"
```
**Problema**: surface failure alto. Se Block A ha issue, Block B/C contaminato. CLI sessione lunghissima è rischiosa.
**Fix**: split in batch separati. Block A = high-confidence work. Block B = nuovo paradigma in batch successivo post-review.

### ❌ Anti-pattern 4: "Ambiguous halt triggers"
```
"Halt se qualcosa va storto"
"Halt se non sei sicuro"
```
**Problema**: troppo vago, CLI potrebbe halt su trivial o non halt su critical.
**Fix**: lista numerata 8-12 triggers specifici (es. "wall-clock > 90 min", "test fail > 5", "schema apply error").

### ❌ Anti-pattern 5: "REPORT format generic"
```
"Scrivi un REPORT al termine"
```
**Problema**: CLI scrive ciò che vuole, manca info critica per Cowork review.
**Fix**: REPORT skeleton mandatory con sezioni numerate + acceptance criteria check + feedback su Cowork spec.

### ❌ Anti-pattern 6: "Tono militaresco"
```
"You MUST do X. You MUST NOT do Y. You SHALL report Z."
```
**Problema**: scoraggia CLI dal contestare. Risultato: o esegue robotico o si demoralizza.
**Fix**: tono collaborativo + assertività. "Esegui §5.1 as-is. Se vedi lacune, segnala in REPORT §2.5 invece di rifare unilateralmente."

---

## §4 — Patterns vincenti

### ✅ Pattern 1: "Confidence level per step"

Per ogni step §5.X, dichiarare esplicitamente quanto CLI può divergere:

```
§5.1 CW-B17 patch: CONFIDENCE HIGH (Cowork spec è solid, code inline testato semanticamente)
  → Esegui as-is. Segnala anomalie. Solo halt se typecheck > 5 errori inattesi.

§5.2 Class B fix: CONFIDENCE MEDIUM (Cowork ha proposto approccio, ma authoring brownfield è arte)
  → Valuta criticamente. Se vedi approccio alternativo chiaramente migliore, proponi in REPORT §2.5 prima di executare alternative.

§5.2.A sys_job_families brownfield registry authoring: CONFIDENCE LOW
  → Cowork raccomanda preferire halt+escalate piuttosto che rush authoring incerto. Tuo critical thinking attivo.
```

### ✅ Pattern 2: "Skip-fallback explicit"

Per work che potrebbe non riuscire:
```
"Se §5.2.A fallisce o richiede effort > stima, skip ed esegui le altre §5.2 step. 
Documenta come 'deferred to batch C2 SDBI workflow' in REPORT."
```

Riduce blast radius + dà CLI controllo legittimo su decisione skip vs forzare.

### ✅ Pattern 3: "Critical thinking output istituzionalizzato"

REPORT §2.5 "Cowork spec improvements suggested" come sezione mandatory. CLI sa di dover produrre critical feedback — diventa parte normale del workflow, non eccezione.

### ✅ Pattern 4: "Bias catalog evolution"

CW-B16..B21 documentati. Invitare CLI esplicitamente a proporre CW-B22+ se trova nuovi pattern. Il bias catalog è un asset cross-session che cresce con critical thinking output.

### ✅ Pattern 5: "Mode operativo per step"

```
- High-confidence step → esegui as-is
- Medium-confidence step → valuta criticamente, proponi alternative
- High-judgment step → critical thinking attivo, halt se ambiguità materiali
```

---

## §5 — Quick checklist pre-emit PROMPT

Prima di "dammi il trigger" a Enzo, Cowork verifica:

- [ ] PROMPT è self-contained (no pointer-only, key context inline)
- [ ] Scope hard boundaries esplicitati (cosa fare + cosa NON fare)
- [ ] Decisioni Enzo locked riportate (no re-confirmation needed)
- [ ] Pre-flight checks numerati con expected outputs
- [ ] Steps numerated step-by-step con code inline + commands
- [ ] **Critical thinking section presente in §A** (5 modalità input invited)
- [ ] **Confidence level dichiarato per step** ad alto judgment
- [ ] **Skip-fallback explicit** per work potentially failable
- [ ] Halt+escalate triggers numerati specifici (8-12)
- [ ] REPORT format con §2.5 (Cowork spec improvements) + §5 (bias) + §6 (modello operativo feedback)
- [ ] Tono collaborativo + assertivo (non militaresco, non flaccido)
- [ ] Closing instructions chiare ("STOP after Block A")

---

## §6 — Esempi corretti vs sbagliati

### ❌ Sbagliato
> "Apply the CW-B17 patch. Trust Cowork's spec. Don't deviate."

### ✅ Giusto
> "Apply the CW-B17 patch per §5.1.A and §5.1.B (code inline). Confidence HIGH on patch design — esegui as-is. Se durante apply vedi lacune nella spec (es. `mapping.source_table_id` non disponibile nel type definition esistente, oppure UUID_REGEX_PG constant non importato in scope), SEGNALA via inbox `exec_critique` con evidence + propone fix tu vuoi applicare. Cowork acknowledges che spec authoring è imperfect — feedback CLI durante exec è asset, non distrazione."

### ❌ Sbagliato
> "Halt+escalate if anything goes wrong."

### ✅ Giusto
> "Halt+escalate write to inbox cowork_code_exchange/.inbox/cowork/pending/<TS>_004_halt_<reason>.md if:
> 1. Pre-flight check §3.X fails
> 2. CW-B17 patch breaks > 5 existing tests
> 3. typecheck error post-patch unresolvable in 30 min
> 4. brownfield.column_mappings authoring for job_families requires unclear FK target choice
> 5. Wave 1 retry wall-clock > 90 min
> 6. ..."

---

## §7 — Memo evolutivo

Questo file è memo cross-session. Aggiornare quando:
- Enzo segnala nuovi pattern desiderati nel rapporto Cowork↔CLI
- Cowork osserva anti-patterns ricorrenti nei PROMPT scritti
- CLI segnala in REPORT §6 feedback specifico su modello operativo

Versioning: append-only changelog at the bottom.

### Changelog

- **2026-05-20**: Initial version (Enzo feedback "assertivo + direttivo MA critical thinking di CLI utilizzato appieno"). 7 sezioni del PROMPT + 6 anti-patterns + 5 patterns vincenti + checklist.

- **2026-05-21**: 3 nuovi anti-patterns aggiunti da REPORT X3 lessons (CW-B28, B29, B30). Vedi §8 below.

---

## §8 — Anti-patterns appresi da REPORT X3 (2026-05-21)

### ❌ Anti-pattern 7: "Cross-OS scripts authored on Linux/Mac, run on Windows"

**Problema**: Cowork in sandbox Linux + SSH a VM Ubuntu → bash scripts pattern Linux/Mac. CLI gira su Windows con PowerShell + Git Bash. Difference critiche:
- `pg_dump 16+` emette `\restrict <token>` + `\unrestrict <token>` lines incompatibili con psql non-interactive Windows
- `pgvector` extension types (`vector(N)`) richiedono ext install lato target — fallisce su default heuresys_advanced
- `uuid_generate_v4()` (from uuid-ossp ext) vs `gen_random_uuid()` (pgcrypto, more portable)
- Path separators (`/` vs `\`), heredoc syntax, sed/awk flags

**Pattern surfaced X3**: `extract_users_employees_legacy.sh` autorato da Cowork — CLI ha dovuto workaround manuale (~10-15 min debug detour) per stripping `\restrict` + replace vector→text + uuid_generate_v4→gen_random_uuid.

**Fix**: Per OGNI script extract/restore/seed:
```bash
# Universal compatibility wrapper
ssh "${SSH_HOST}" "..." \
  | grep -v '^\\restrict ' | grep -v '^\\unrestrict ' \
  | sed 's/vector([0-9]*)/text/g' \
  | sed 's/uuid_generate_v4()/gen_random_uuid()/g' \
  | sed 's/public\./legacy_mirror./g' \
  | psql "$DB_URL"
```

OR Cowork-side test su Windows pattern before publishing scripts.

### ❌ Anti-pattern 8: "Migration convention drift"

**Problema**: Project's existing migrations 000031-000037 NON hanno `INSERT INTO sys.sys_schema_migrations` (pnpm db:migrate handles tracking). Cowork-authored migration 000039 (in batch C3) HA explicit INSERT. Inconsistency riduce signal-to-noise.

**Fix Cowork-side**: prima di authoring nuove migration, INSPECT migrations esistenti:
```bash
grep -l "INSERT INTO sys.sys_schema_migrations" db/migrations/*.sql
# If empty → project convention is "no explicit INSERT, runner handles it"
# If all → project convention is "explicit INSERT, redundant with runner"
# Follow the dominant pattern.
```

### ❌ Anti-pattern 9: "Build artefact coupling missing in pre-flight"

**Problema**: editing `packages/shared/src/*.ts` → `pnpm typecheck` in apps/api fails until `pnpm build` in packages/shared/ regenerates `dist/*.d.ts` (despite `exports.default = ./src/*.ts` config). CLI X3 lost 5min on this.

**Fix in PROMPT pre-flight §2**:
```
## §2.X — Build artefact pre-flight

If your batch involves editing files in `packages/shared/src/`:
1. After edit + before `pnpm typecheck` in apps/api:
   pnpm --filter @heuresys/shared build
2. If apps/web also affected (rare in batch context):
   pnpm --filter @heuresys/web build
```

### ✅ Pattern vincente 6: "ADR gate explicit in PROMPT"

PROMPT 006 §3.A.1 "ADR-0015 gate" = mandatory codebase audit before applying migration. CLI caught 3 Zod/Row schemas assuming NOT NULL. Without gate: runtime crash.

**Pattern**: per ogni ADR-driven schema change, PROMPT include:
```
### §X — ADR gate
Read `docs/architecture/adr/<NNNN>_*.md`.
Pre-flight: Grep <impacted_pattern> in codebase. If found, document + halt+escalate OR proceed-with-companion-fix.
```

### ✅ Pattern vincente 7: "Schema introspection 'verified live <date>' inline in spec"

Cowork's C3 cascade redesign spec header: "verified live 2026-05-21". CLI confidence sky-high — no CW-B25 risk. Pattern adopt per OGNI SQL/DDL spec authoring.

---

### Changelog (continued)

- **2026-05-21**: Added §8 (3 anti-patterns from REPORT X3 + 2 pattern vincenti). Total: 9 anti-patterns + 7 patterns vincenti documented.

- **2026-05-21 (X4.A debrief)**: Added §9 (2 new anti-patterns from REPORT X4.A: CW-B32 + CW-B33, with critical mitigation = Dry-run EXPLAIN mandatory step). Total: 11 anti-patterns + 7 patterns vincenti.

---

## §9 — Anti-patterns appresi da REPORT X4.A (2026-05-21)

### ❌ Anti-pattern 10: "Integer-to-Enum CAST without value mapping"

**Problema**: CAST_VARCHAR transform applied to integer source column when target has CHECK constraint with string ENUM values. The cast produces lexically valid varchar ("5", "3") that fails the CHECK at INSERT time.

**Pattern surfaced X4.A**: `job_templates.org_level` (integer 1-6 per ISCO-like seniority) → `sys_job_roles.job_role_seniority_level` (varchar CHECK ENUM `ENTRY/JUNIOR/MID/SENIOR/LEAD/EXECUTIVE`). CAST_VARCHAR produces "5" — CHECK violation → 140 staging rows fail at INSERT layer.

**Catalog**: CW-B32 (REPORT 007 §5).

**Fix**: introduce explicit value_map transform OR pre-staging compute. Two options:
- **(a) NEW transform CAST_ENUM**: payload `{value_map: {1:"ENTRY", 2:"JUNIOR", 3:"MID", 4:"SENIOR", 5:"LEAD", 6:"EXECUTIVE"}}`. Compiler emits `CASE WHEN src = 1 THEN 'ENTRY' WHEN src = 2 THEN 'JUNIOR' ... END`.
- **(b) Pre-staging compute**: use existing CONSTANT or DIRECT_COPY with explicit SQL CASE inline. Less reusable, but no new transform code.

**Cowork-side mitigation pre-spec authoring**:
1. For each CAST_* transform proposed, verify source data_type vs target CHECK constraints
2. If source integer + target ENUM string: STOP, propose CAST_ENUM OR pre-compute, NOT CAST_VARCHAR

### ❌ Anti-pattern 11: "Spec-Implementation Coupling Gap"

**Problema**: Cowork-authored spec describes pseudo-code or SQL template that **compiles syntactically** but **fails at PostgreSQL runtime** due to semantic mismatch with the data layer.

**Pattern surfaced X4.A**: my CW-B31 patch spec `cowork_reserved/batch_c4/investigations/01_*.md §4.1` said:
```typescript
const conflictKeyExpr = conflictInference;
const insertSql = `... SELECT DISTINCT ON ${conflictKeyExpr} ...`;
```
But `conflictInference` is the TARGET column name list (e.g. `(job_role_code)`), while the SELECT operates on staging table that doesn't have `job_role_code` — it has `staging_*` cols + `staging_raw_record` jsonb. The expression compiles OK but runtime PG error: "column 'job_role_code' does not exist". CLI needed 2 iterations to converge on correct expression: parse `conflictInference` → lookup in `colEntries.find(e => e.targetCol === key).sql` → use that EXPRESSION (not the column name).

**Catalog**: CW-B33 (REPORT 007 §5).

**Cowork-side mitigation**: ALL SQL template specs MUST include a **"Dry-run EXPLAIN" mental check**:

### ✅ Pattern vincente 8: "Dry-run EXPLAIN step in spec authoring"

**Mandatory pre-publish check** for every Cowork-authored SQL template spec:

```
1. Inspect the SQL template literal as if executing it.
2. For each column reference: identify the table/CTE source.
3. Verify that column EXISTS in that source (live `\d` introspection).
4. For computed expressions (e.g. ${var} interpolations): trace the variable
   to its definition. Verify the substitution produces valid SQL.
5. For CTE chains: ensure cols available at each level (CTE A doesn't expose
   col X to CTE B if X wasn't SELECTed in A).
6. Document the dry-run reasoning in spec §"Dry-run EXPLAIN" subsection.
```

Apply specifically to:
- INSERT...SELECT templates with CTE pre-processing
- DISTINCT ON / GROUP BY on computed expressions
- WINDOW functions referencing aliases
- Subqueries with variable interpolation

**Example dry-run** (CW-B31 spec retrospectively, what should have been in §3.A.1):
```sql
-- DRY-RUN EXPLAIN:
-- Template: SELECT DISTINCT ON ${conflictKeyExpr} * FROM staging_filtered
-- ${conflictKeyExpr} = "${conflictInference}" = "(job_role_code)"
-- staging_filtered = SELECT * FROM staging.wave1_job_roles WHERE ...
-- → staging_filtered cols = [staging_row_id, staging_raw_record, ...] (NO job_role_code)
-- → "DISTINCT ON (job_role_code) FROM staging_filtered" = RUNTIME ERROR "col not exist"
-- ❌ DRY-RUN FAILED. Fix: use colEntries expression for job_role_code, not the col name.
```

This catches CW-B33 class bugs BEFORE the spec ships to CLI.

### ✅ Pattern vincente 9: "Critical thinking iteration as feature"

CLI's "2 iterations" to converge on CW-B31 correct patch is **NOT a failure** — it's the system working as designed (Cowork spec MEDIUM-HIGH confidence + CLI critical thinking + runtime feedback loop = converge). The Dry-run EXPLAIN pattern §pattern-8 reduces iteration count to 0-1 (catch at spec authoring time), but the iteration fallback is healthy when spec quality is bounded.

**Anti-pattern to avoid**: "perfect spec ideal". Cowork should NOT spend 10× effort trying to produce 100% correct spec when 90% spec + 1-iteration CLI critical thinking achieves same outcome faster. **Trade-off favors fast iterations over slow perfection**.

---

---

## §10 — Anti-patterns + vincenti continued (X5.A debrief, batch C6)

### ❌ Anti-pattern 12: CW-B34 — Nullable FK vs NK UQ Semantic Divergence

**Sintomo**: Migration `ALTER COLUMN DROP NOT NULL` (ADR-0015/0016 pattern) applicata correttamente al DB layer. Codebase audit clean (0 hits business logic). Wave 1 retry post-migration: **0 rows upserted** invece del target previsto.

**Root cause**: l'engine `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:431-442` WHERE skip filter tratta UUID NK columns come **required-present pre-INSERT** indipendentemente da DB nullability. Naming-convention escape (`endsWith('_tenant_id')`) copre solo tenant cols — NON consulta `information_schema.is_nullable` per altri NK UUID cols.

**Caso concreto (X5.A)**: sys_esco_occupation_mappings post-ADR-0016 = 0 rows. Audit `import_validation_results` mostra 7645/7645 staged rows exclude con reason `nk_missing_esco_occupation_mapping_job_role_id`. Migration DB nullable ≠ engine accept NULL.

**Mitigazione**:
1. Estendere `TargetMeta` (engine.ts:36-50) con `columnNullable: Map<string, boolean>` popolato da `information_schema.columns.is_nullable`
2. Modificare WHERE skip filter (upsert-sql.ts:431-442) per saltare `IS NOT NULL` + UUID regex check quando colonna è nullable
3. Iniettare esplicito `NULL::uuid` in colEntries quando nessun column_mapping popola una nullable NK col

**Generalizzazione**: post-patch, ogni nullable NK UUID col (via new ADR) eredita automaticamente NULL-allowance senza engine code change. Pattern allinea con CW-B22 ma è generalizzato via metadata introspection.

**Lezione**: "Nullable FK ADR" è un pattern DB+engine, MAI solo-DB. Vedi pattern vincente §10.10 sotto.

---

### ✅ Pattern vincente 10: "ADR DB+Engine 2-step bundling"

Quando autorizzi un ADR nella famiglia "make column nullable" (ADR-0015/0016 pattern), il PROMPT/spec DEVE bundle obbligatoriamente:

1. **DB-layer spec** — migration ALTER COLUMN DROP NOT NULL (idempotente, COMMENT ON COLUMN)
2. **Codebase audit** — grep Zod/Row/service hits + decision matrix (companion edits)
3. **Engine-layer spec o verification check** — almeno UNO dei seguenti:
   - Verificare che la colonna NON sia in `targetMeta.naturalKeyColumns` (caso "no engine impact"), OPPURE
   - Pre-flight 5-sample dry-run del WHERE skip filter (catch CW-B34 caso early), OPPURE
   - Esplicita spec del companion engine patch (CW-B34 mitigation)

**Anti-pattern da evitare**: pensare che ADR DB-layer = ADR completo. La realtà è che engine layer ha checks ortogonali a DB constraints. Il "DB-only ADR" è un MEDIUM-confidence ship per default (deve essere classificato così nei PROMPT future).

**Pattern checklist per ADR nullable FK future**:
```
[ ] DB migration spec authored (ALTER COLUMN DROP NOT NULL + COMMENT)
[ ] Codebase audit instructions (grep + decision matrix)
[ ] NK UQ index analysis (is the col part of NK UQ?)
  [ ] If YES: engine companion fix REQUIRED (CW-B34 pattern)
  [ ] If NO: simple DB-only ADR sufficient
[ ] CHECK constraint analysis (CHECK violation post-ALTER?)
[ ] FK ON DELETE behavior unchanged?
[ ] Acceptance criteria includes Wave 1 retry + count verification
```

**Caso X5.A retrospective**: ADR-0016 mancava check NK UQ → CW-B34 sorpreso CLI a runtime. Cowork C6.2 ha amendato ADR-0016 §11-12 documentando la lezione. Pattern memo §10 codifica la checklist per il futuro.

---

---

## §11 — Anti-patterns + vincenti continued (X6.A debrief + C7 forensic, batch C7)

### ✅ Pattern vincente 11: "Lineage JOIN-back COALESCE-aware (X6.A scope-creep lesson)"

REPORT 009 §1.3 documented un CLI scope-creep critico: durante X6.A engine patch CW-B34, CLI ha esteso `buildNkJoinPredicate` (NOT in mia spec §4.2) per emettere COALESCE-sentinel pattern anche per cols nullable. Senza fix, `t.col = s.col` con entrambi NULL → FALSE in SQL → lineage_rows = 0 per ADR-0015/0016 targets nonostante INSERT success.

**Lezione**: Quando autorizzi nullable NK UUID, le 2 stack che gestiscono NULL devono allinearsi:
1. **WHERE skip filter** (upsert-sql.ts:431-442) — il tuo focus spec
2. **NK JOIN-back predicate** (upsert-sql.ts:686 buildNkJoinPredicate) — facilmente missed

**Pattern checklist da aggiungere a ogni "nullable NK ADR" spec future**:
```
[ ] WHERE skip filter — nullable-aware? (CW-B34)
[ ] NK JOIN-back predicate — COALESCE-sentinel? (X6.A lesson)
[ ] conflictKeyExpr DISTINCT ON — accepts NULL? (CW-B31 + CW-B34 interaction)
[ ] colEntries injection — NULL::uuid placeholder when entry missing?
[ ] PG UQ semantics — NULL ≠ NULL default OK, OR NULLS NOT DISTINCT needed?
[ ] FK ON DELETE behavior — NULL rows survive CASCADE?
```

**Cattura il pattern**: ogni feature engine che tocca NK NULL semantics deve verificare TUTTI questi punti. Una sola omissione = silent data corruption (lineage = 0 nel caso X6.A) o run failure.

---

### ❌ Anti-pattern 13: CW-B35 — "Import Mapping Gap" (column_mappings incompleti)

**Sintomo**: target sys.* tabella popolata 0 rows. Audit `exclusion_reason` = `nk_missing_<col>` o `required_missing_<col>` per HIGH volume. Sembra "engine bug" ma in realtà è **brownfield registry data gap** (column_mappings missing).

**Root cause**: il source data HA le FK UUIDs valide e RESOLVE 5/5 via lineage, MA le `column_mappings` non hanno LOOKUP_FK per popolare il target NK col. Le UUID sono solo in metadata JSONB.

**Distinzione vs Semantic FK Phantom (CW-B26 / ADR-0016)**:
- Semantic FK Phantom: source UUID **NON resolve** 0/5 via lineage → nullable FK ADR
- Import Mapping Gap: source UUID **RESOLVE 5/5** via lineage → add missing column_mappings (no ADR, no engine change, no migration)

**Detection workflow**:
```sql
-- Step 1: per source, list which target cols are mapped
SELECT cm.column_mapping_target_column, COUNT(*)
  FROM brownfield.column_mappings cm
  JOIN brownfield.table_mappings tm ON ...
 WHERE tm.table_mapping_target_table = '<target>'
 GROUP BY 1;

-- Step 2: required NK cols missing from above list = candidates
-- Step 3: identify source col carrying FK UUID (e.g. source_skill_id)
-- Step 4: 5-sample resolution via lineage
-- Step 5: if 5/5 resolve → IMPORT GAP → add column_mappings
```

**Mitigation**: pure SQL INSERT INTO brownfield.column_mappings con LOOKUP_FK transform. No code change. Fast unlock pattern (high volume rows recovered in <30 min CLI active).

**Esempio canonical (X6.A REPORT §4 surfacing)**: `sys_skill_taxonomy_edges.parent_id` 17924 missing → 5 sources CLEAN unlockable, 2 NEEDS FILTER, 4 DEFER. Spec C7.1.

---

### ❌ Anti-pattern 14: CW-B36 — "Mapping Misclassification" (table_mapping autorizzato su semantica sbagliata)

**Sintomo**: target sys.* tabella popolata < expected. Audit `exclusion_reason` mostra rows excluded per non-recoverable reasons (no LOOKUP_FK risolverebbe).

**Root cause**: `table_mapping (source → target)` è stato autorizzato su similarità nome/schema, ma la SEMANTICA del source NON è quella del target. Esempio: `skill_classifications` → `sys_skill_categories` mappato perché entrambi parlano di "skill categories", ma skill_classifications è **per-skill metadata** (cognitive_level, transferability, hard/soft type), non una **category family taxonomy**.

**Distinzione vs Import Mapping Gap (CW-B35)**:
- Import Gap: source data HA i campi giusti, column_mappings sono incompleti
- Misclassification: source data NON HA i campi giusti (semantica wrong)

**Detection workflow**:
1. 5-sample staging_raw_record cols → are these semantically aligned con target?
2. If FK candidates exist, do 5-sample resolution
3. If 0/5 + cardinality semantically wrong (es. 3 valori distinti per 7215 rows = skill TYPE non category) → Mapping Misclassification

**Mitigation**: re-classify table_mapping a `REFERENCE_ONLY` o `EXCLUDE`. Defer al macro-area SDBI corretta per il source. NO data fabrication via sentinel UUID (viola CARD-4).

**Esempio canonical (X6.A REPORT §4 surfacing)**: `sys_skill_categories.skill_category_family_id` 7256 missing → `skill_classifications` (7215 rows) is MISCLASSIFIED, target REFERENCE_ONLY. Spec C7.2.

---

### ❌ Anti-pattern 15: CW-B37 sub — "LOOKUP_FK Payload Misconfigured"

**Sintomo**: target NK col 100% rows fail with `nk_null_<col>` (LOOKUP_FK returns NULL).

**Root cause**: column_mapping has LOOKUP_FK transform with `match_on: <col>` BUT staging_raw_record doesn't contain `<col>` (was authored against different source schema or aspirationally).

**Detection workflow**:
```sql
SELECT cm.column_mapping_transform_payload,
       (SELECT string_agg(DISTINCT key, ', ')
          FROM staging.wave1_<target>, jsonb_each_text(staging_raw_record)
         WHERE staging_source_table = '<src>') AS keys_in_source
  FROM brownfield.column_mappings cm
 WHERE cm.column_mapping_transform = 'LOOKUP_FK'
   AND cm.column_mapping_target_column = '<target_col>';
```

If `payload->>'match_on'` ∉ `keys_in_source` → CW-B37 sub-pattern confirmed.

**Mitigation**: re-classify table_mapping a REFERENCE_ONLY (source incompatible) OR correct payload + re-apply.

**Esempio (X6.A REPORT §4)**: `job_title_courses → sys_skill_learning_mappings.skill_id` LOOKUP_FK `match_on:skill_name`, ma source ha solo `course_id`. 207 rows NULL. Re-classify REFERENCE_ONLY. Spec C7.3.

---

### ✅ Pattern vincente 12: "Audit reasons distribution as forensic primary"

**Pattern emergente da X6.A**: audit `import_validation_results.exclusion_reason` distribution è la single most informative forensic query post-Wave1. Una singola SELECT GROUP BY:

```sql
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<runId>'
 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

Rivela **istantaneamente** tutti i bias attivi nel run, classificati per volume. X6.A surface CW-B35/36/37 in 1 query.

**Pattern checklist post-Wave1 retry obbligatoria**:
```
[ ] Run audit exclusion_reason distribution
[ ] Top 5 reasons by count → triage candidates
[ ] Per reason: identify se è (a) noto bias, (b) new pattern, (c) data quality issue
[ ] Documentare in REPORT §4 (X6.A canonical example)
[ ] Cowork next batch: forensic deep-dive per top-volume reasons
```

**Anti-pattern da evitare**: ottimizzare reasons singoli senza considerare distribution. Pattern X6.A: CW-B34 fix unlocked ESCO, ma SOLO post-fix audit distribution ha rivelato gli ALTRI 3 bias che erano nascosti dietro ESCO (17924 + 7256 + 1588 rows aspettando).

---

---

## §12 — Anti-patterns + vincenti continued (X5.B + X7 debrief, batch C8)

### ❌ Anti-pattern 16: CW-B38 — Nullable FK + PG default NULLS DISTINCT UQ → cross-run duplicate

**Sintomo**: ADR-0015/0016 pattern applicato (nullable NK UUID + companion engine patch CW-B34). Wave 1 first run unlocked target ✅. Wave 1 RE-RUN duplica rows (N → 2N → 3N...).

**Root cause**: PG default `UNIQUE` semantic = NULL ≠ NULL. ON CONFLICT (nk_col1, nk_col2) DO NOTHING non triggera quando un nk_col is NULL. Each retry emits fresh duplicate set. Lineage UQ updates target_record_id pointer → pre-existing rows become orphans.

**Live evidence (X7)**: sys_esco_occupation_mappings 7645 (X6.A) → 15290 (X7 v1 = 7645 X6.A orphan + 7645 X7 lineage-linked). P0 regression.

**Mitigazione**: companion `DROP INDEX + CREATE UNIQUE INDEX ... NULLS NOT DISTINCT` (PG 15+ feature) in same migration batch as DROP NOT NULL.

**Generalizzazione**: ogni futuro ADR-0015/0016-pattern MUST bundle NULLS NOT DISTINCT. Vedi `cowork_reserved/batch_c8/cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md` §3 checklist + template §4.

**Audit live state (C8.2 verified 2026-05-21)**:
- `sys_esco_occupation_mappings` — vulnerable + ALREADY mitigated by X7 migration 000042
- `sys_job_roles.family_id` (ADR-0015) — NOT vulnerable (family_id non in NK UQ, solo job_role_code è UQ)
- No other sys.* tables affected currently

---

### ❌ Anti-pattern 17: CW-B39 — Multi-instance domain mismatch (signal per macro-area dedicated batch)

**Sintomo**: same domain (es. learning/skills) shows multiple bias instances across batches (CW-B35/36/37/39 tutti in skills+learning). Each "fix" surfaces another related instance.

**Root cause**: legacy brownfield registry has architectural mapping confusion in that domain — single-batch fixes don't address root architectural mismatch. Es. sys_learning_modules sourced from analytics (bookmarks, ratings) instead of canonical courses; course_modules misrouted to learning_path_steps; sys_learning_path_steps blocked by missing module_id resolution.

**Detection**: when 3+ CW-B<N> in same domain (skills/learning here) → escalate to macro-area dedicated batch (X9 SKILGRO).

**Mitigazione tactical**: REFERENCE_ONLY re-classify per audit cleanup. Defer architectural fix to dedicated macro-area cycle.

**Cataloghing strategy**: pattern memo `signals` section dovrebbe tracciare domain bias density per priorizzare macro-area triage.

---

### ❌ Anti-pattern 18: CW-B40 — Spec assumed non-existent column

**Sintomo**: spec SQL `SET <col> = ...` fallisce a runtime con "column does not exist". Pattern frequente quando spec è authored against assumed schema (es. column inferred dal nome o da pattern di altre tabelle).

**Root cause (X7 instance)**: Cowork PROMPT 011 §4 + §5 ha usato `SET table_mapping_rationale = ...` (column inferred per analogia con `rationale` field in altre tabelle), ma `brownfield.table_mappings` non ha `rationale` (solo `table_mapping_metadata jsonb`).

**Mitigazione preventiva (CW-B25 column-level extension)**: PROMPT spec authoring per registry UPDATE/INSERT DEVE embeddare `\d <schema>.<table>` verbatim o referenziare file forensic con column list verified. CW-B25 (schema introspection LIVE) deve essere applicato a column level, non solo table level.

**Caso correlato REPORT 010 §5.b (CW-B42 storico)**: SDBI spec column-name drift `lar.method` vs live `accrual_method`. Stessa categoria: spec authored without final column-level verification.

**Pattern memo standard**: PROMPT template includes mandatory section "§X.Y Schema verified — list columns referenced + their existence" pre-SQL spec authoring.

---

### ❌ Anti-pattern 19: CW-B41 — xos_lib piped psql COPY breaks on Win Git Bash (subprocess stdin)

**Sintomo**: `xos_lib::xos_dump_data | psql -v ON_ERROR_STOP=1` emits `invalid command \N` errors when running on Windows Git Bash. Linux/Mac work fine.

**Root cause**: psql consumes stdin as commands; `COPY ... FROM stdin` switches mode but subsequent multi-line TSV data triggers Git Bash buffering / line-handling differently than Linux. Pipe `pg_dump | psql` is fragile across OS.

**Mitigazione**: dump to temp file → `psql -f file` (file-based, no pipe). Worked X5.B inline. Generalize: update `cross_os_pipeline.sh` to write to tempfile internally.

**Action item C8/C9**: refactor `db/scripts/_lib/cross_os_pipeline.sh::xos_restore_legacy_mirror` to use file-based pattern + keep pipe interface deprecated/optional.

---

### ❌ Anti-pattern 20: CW-B45 — Source data violates target CHECK coherency

**Sintomo**: source rows pass staging validation MA fallano consolidation INSERT con CHECK constraint violation. Pattern: source schema lacks coherency checks that target has → source data is loose.

**Live evidence (X5.B Block C)**:
- 5000 attendance rows: `is_validated=true` + `validated_by=NULL` → violates `sys_attendance_validation_coherent` CHECK
- 290 overtime rows: `status IN ('APPROVED','EXPORTED','PAID')` + `approved_by=NULL` → violates `sys_overtime_approval_coh` CHECK

**Mitigazione tactical (X5.B inline)**: pre-consolidate normalize (set `is_validated=false` / `status='PENDING'` when actor_user_id IS NULL).

**Mitigazione strutturale**: SDBI spec template Phase 4 add "source vs target CHECK delta" pre-validation step. List CHECKs su target table, identify potential source data conflicts via SELECT sampling, plan normalization upfront.

---

### ✅ Pattern vincente 13: "Inline Mitigation Scope" (CLI X7 proposal §8)

CLI X7 ha proposto codifica formal di quando CLI è pre-authorized to apply inline mitigations vs quando deve halt+escalate. Adottato come pattern vincente:

**✅ Inline OK (CLI pre-authorized, no halt+escalate roundtrip)**:
- Engine helper extension (es. buildNkJoinPredicate X6.A)
- Index property tweak (NULLS NOT DISTINCT, partial index, etc.)
- UPDATE-in-place vs INSERT su registry (idempotent, audit-preserving)
- Payload key normalization (quoted vs non-quoted)
- Enum value mapping additions (CAST_ENUM value_map extensions)
- Source column-name drift fixes (rename inline)
- Source data CHECK normalization (pre-consolidate UPDATE)

**⛔ Halt required (must escalate to Cowork inbox)**:
- Nuovi ADR (architectural decision)
- table_mapping classification cross-domain (re-target a tabella diversa)
- Engine transform code addition (nuovo SUPPORTED_TRANSFORMS entry)
- Schema CHECK constraint change (modify or add constraint)
- DROP TABLE / DROP COLUMN su sys.* targets
- Cross-batch dependency change (new precondition for unrelated targets)
- Any P0 regression NOT covered by simple inline migration

**Razionale**: Inline OK = low risk, well-contained, immediate rollback possible. Halt required = high risk, cross-domain impact, architectural judgment needed.

**Beneficio quantificato (X7)**: 4 inline mitigations evitate 4 halt+escalate roundtrip cycles (~1-2h ciascuno) → ~5h saved.

---

### ✅ Pattern vincente 14: "UPDATE-in-place pivot for UQ-constrained registry"

When INSERT to `brownfield.column_mappings` fails on UQ `(table_mapping_id, source_column_id)`, pivot to UPDATE-in-place of the existing row.

**Why**: UQ on `(table_mapping_id, source_column_id)` allows only 1 column_mapping per (table_mapping, source_column) pair. If 8 existing JSON_EXTRACT mappings need to become 8 LOOKUP_FK with different target column, INSERT fails — UPDATE preserves audit history + idempotency.

**Pattern template**:
```sql
-- If proposed INSERT would conflict on (table_mapping_id, source_column_id):
-- UPDATE the existing row instead, switching:
--   transform = old_transform → new_transform
--   target_column = old_target → new_target (e.g. metadata → parent_id)
--   payload = old_payload → new_payload

UPDATE brownfield.column_mappings
   SET column_mapping_transform = '<new_transform>',
       column_mapping_target_column = '<new_target>',
       column_mapping_transform_payload = jsonb_build_object(...)
 WHERE column_mapping_table_mapping_id = ... AND column_mapping_source_column_id = ...;
```

**Lezione spec authoring**: pre-author, run query `SELECT * FROM brownfield.column_mappings WHERE table_mapping_id IN (?) AND source_column_id IN (?)` to discover existing rows + author UPDATE OR INSERT proactively.

**Caso canonical X7 §1.A.2**: 10 INSERT failed → pivot a 10 UPDATE-in-place. Same net effect, idempotent.

---

### ✅ Pattern vincente 15: "Bias Registry SoT (CW-B numbering race condition mitigation)"

Quando Cowork batch + CLI session lavorano in parallelo, entrambi possono surface new bias candidates e claim stesso numero `CW-B<N>` per pattern diversi.

**Mitigazione strutturale**: `cowork_reserved/bias_registry.md` (NEW C8.1) come SoT centralizzato. Pre-emit protocol:
1. Read registry
2. Trova `Next available: CW-B<N+1>`
3. Aggiungi tua entry (stub minimo)
4. Aggiorna `Next available`
5. Commit atomico

Both Cowork and CLI MUST consult registry before emitting new CW-B<N>.

**Caso risolto retroattivamente**: REPORT 010 §5 vs C7 forensic conflict (entrambi avevano emesso CW-B35/B36/B37 per pattern diversi). CLI X7 ha auto-riconciliato leggendo pattern memo §11 + ha numerato propri come CW-B38/B39/B40. Cowork C8.1 ha completato la riconciliazione ufficiale numerando REPORT 010 §5 candidates come CW-B41..B45.

---

---

## §13 — Subagent-first PROMPT pattern (CLI architecture utilization)

### ✅ Pattern vincente 16: "Subagent-first PROMPT structure"

**Trigger Enzo 2026-05-23**: i PROMPT Cowork attuali trattano CLI come "esecutore lineare" invece che come **agent system multi-modal con subagent isolation + tool parallelism**. Risultato: context budget main session si satura inutilmente, capability CLI sotto-utilizzate.

**Capability CLI che vanno esplicitamente raccomandate nei PROMPT**:

1. **Subagent (Task tool) con contesto isolato**:
   - `subagent_type=Explore thoroughness=quick/medium/very_thorough` per ricerca codebase non guidata
   - `subagent_type=Plan` per planning architetturale
   - `subagent_type=general-purpose` per investigation multi-step + review indipendente
   - Subagent gira in context proprio + ritorna sintesi compatta al main

2. **Tool calls paralleli**: chiamate indipendenti vanno fatte simultanee (es. Read N file in 1 risposta, non N risposte sequenziali)

3. **Investigation profonda senza consumare context principale**: invece di Read 3 spec da 500 righe (1500+ righe in main), delega subagent con prompt "estrai checklist da X file" → ritorna 200-word summary

4. **Pre-flight verification indipendente**: post-migration/critical-step, lancia subagent verification per audit indipendente → main session resta lucida per il next block

5. **Context budget management** per mega-bundle: dopo Block A+B considera `/compact` o sub-session via subagent per Block C-D-E

### Template "§Capability hints" da includere in OGNI PROMPT futuro

```markdown
## §X — Capability hints (CLI architecture utilization)

### Subagent delegation raccomandata
- Pre-flight audit (live DB introspect, schema verification): 
  Task subagent_type=Explore thoroughness=quick
- Spec deep-dive (>500 righe per file): 
  Task subagent_type=general-purpose con prompt "estrai checklist actionable da file X"
- Pre-commit verification indipendente del lavoro fatto: 
  Task subagent_type=general-purpose "review autonomo Block X"
- Planning architetturale (es. choice tra opzioni implementation): 
  Task subagent_type=Plan

### Parallelization opportunities
- Step X + Step Y sono indipendenti → tool calls simultanei nella stessa risposta
- Read multipli file spec → 1 risposta con N Read tools paralleli

### Context budget guidance
- Block A+B atteso ~30-40% context budget
- Pre-Block C: considera /compact se >60% used
- Block D/E: candidates per subagent delegation (isolate execution + preserve main)
```

### Anti-pattern (Cowork-side) da NON ripetere

❌ PROMPT lineare "Step 1 → 2 → 3 → ..." senza menzionare subagent
❌ Implicito: assume CLI da solo decida quando delegare (a volte sì, a volte no)
❌ Spec deep-dive obbligatori Read multipli senza alternative subagent
❌ Mega-bundle 5+ block senza guidance context budget

### Quando NON usare subagent

- Task atomico noto (1 Edit specifico, 1 SQL apply) — tool diretto basta
- Operazioni che richiedono visibilità completa nel main context (es. decisione architetturale che dipende da multiple dipendenze già viste)

**Lezione canonical**: PROMPT 013 X9 SKILGRO mega-bundle è stato authored SENZA Capability hints section → CLI deve da solo decidere se subagent o no, sub-ottimale. Pattern Subagent-first va in TUTTI i PROMPT post-2026-05-23.

---

## §14 — Feasibility-before-implementation (FBI)

### ✅ Pattern vincente 17: "Feasibility-before-implementation"

**Trigger Enzo 2026-05-23 (richiamo per comportamento scorretto)**: Cowork ha proposto tooling watchdog PowerShell + investito 2h scripting + 250 LOC senza verificare prima la **fattibilità tecnica** nel contesto reale. Risultato: il watchdog dipendeva da `claude code -p` headless mode con OAuth keychain (NON funziona — richiede API key separata = costo aggiuntivo). Esperimento abbandonato, cleanup richiesto, tempo + token sprecati.

**Pattern obbligatorio**: quando Cowork propone tooling che dipende da capability di tool esterno (CLI, API, library, env config), VERIFICA la fattibilità con 1 test triviale **PRIMA** di scrivere implementazione completa.

### Checklist FBI obbligatoria pre-implementation

```
Per ogni proposta tooling con dipendenze esterne:

[ ] Q1: Il tool external supporta la modalità che sto assumendo?
       → Verifica: <tool> --help | grep <modalità>
       → Test triviale: <tool> <comando_minimo> + verifica exit code

[ ] Q2: L'environment del cliente ha le credenziali/config richieste?
       → Verifica: env vars, file config, OAuth/API key state
       → Chiedere a Enzo se ha le credentials, NON assumere

[ ] Q3: Esiste un test minimo (1-2 comandi) che conferma la fattibilità?
       → Run test triviale (es. "echo test" via il tool)
       → Verifica output + exit code prima di scrivere implementation

[ ] Q4: La soluzione ha costi nascosti (API credits, time, setup)?
       → Quantifica costi $$ + tempo setup
       → Trasparenza con Enzo PRIMA di iniziare implementation

[ ] Q5: Esiste alternativa più semplice già supportata?
       → Es: pattern manual + workflow optimization invece di tooling new
       → Evaluate alternative cost vs proposed tooling cost
```

**Se anche UNO dei 5 punti è "non verificato" → STOP. Verifica prima. Comunica risultati a Enzo. Decidi insieme se procedere.**

### Caso canonical

**Watchdog C9.1 (2026-05-21 — 2026-05-23 cleanup)**:
- Proposto: PowerShell watchdog che invoca `claude -p` headless
- Q1 NON verificato: assunto che `-p` ereditasse OAuth keychain (sbagliato)
- Q2 NON verificato: assunto che env Windows avesse API key (sbagliato)
- Q3 NON verificato: nessun test `claude -p "test"` PRIMA di scrivere 250 LOC
- Q4 NON verificato: scoperto solo post-test che richiede API key separata = $ extra
- Q5 NON verificato: pattern manual paste già funzionante, alternative non valutate

Risultato: 2h sprecati + token + cleanup richiesto da Enzo + ammissione errore.

### Comportamento sanzionato esplicitamente da Enzo

Quote letterale Enzo 2026-05-23:
> "comportamento da dilettante, perchè la feasibility è sempre un prerequisito da accertare"

**Mai più**. Pattern memo §14 è SoT permanente.

### Quando applicare FBI vs procedere diretto

- ✅ Procedere diretto: task atomico con tool già verificato (es. Read/Edit/Bash su file noto)
- ✅ Procedere diretto: modifica file esistente con pattern già testato
- 🛑 FBI obbligatoria: tooling nuovo, capability esterna assumed, integration con sistema cliente
- 🛑 FBI obbligatoria: qualsiasi soluzione che richiede credentials/auth/config che non ho verificato io stesso

---

---

## §15 — Model tiering strategy (cost-aware per task type)

### ✅ Pattern vincente 18: "Model selection strategy per task type"

**Trigger Enzo 2026-05-23**: Claude Code CLI gira default su Opus 4.7 (flagship, high cost). MA per subagent Task tool è possibile specificare modello diverso (`model: "haiku" | "sonnet" | "opus"`). Non tutti i sotto-task richiedono Opus 4.7 — usarlo per task triviali è spreco di token/credits.

### Tier ufficiale modelli (2026-05)

| Modello | Costo relativo | Use case principale | Quando usare |
|---|---|---|---|
| **Opus 4.7** | 1.0× (baseline) | Orchestrator main session, ragionamento complesso, decisioni architetturali, integration multi-step con dipendenze cross-block | Solo dove serve davvero |
| **Sonnet 4.6** | ~0.2× (5× cheaper) | Execution workhorse: Edit/Write/Bash standard, SQL apply, forensic introspect, test suite run | Default per la maggior parte dei subagent |
| **Haiku 4.5** | ~0.05× (20× cheaper) | Task atomici triviali: file move, simple grep, formatting, sintesi corte, audit query single-shot | Massimo risparmio per task semplici |

### Mapping task → modello raccomandato

**Opus 4.7 ONLY (main session)**:
- Orchestrator decisioni cross-block (es. "Block A ha cambiato X, va ri-pianificato Block B?")
- ADR architectural design (es. ADR-0017 LOOKUP_FK_2HOP authoring)
- Engine code change con dipendenze multiple (es. CW-B34 patch upsert-sql.ts:431-461 + buildNkJoinPredicate)
- Inline Mitigation Scope critical thinking (es. CW-B38 NULLS NOT DISTINCT discovery X7)
- Halt+escalate decisions su P0

**Sonnet 4.6 (subagent default)**:
- Live DB introspect (schema audit, count queries, validation result analysis)
- Spec deep-dive + structured summary
- Test suite run + parse output → report
- Migration apply via psql -f + result verification
- Forensic investigation multi-step ma pattern noto
- Wave 1 retry monitoring + result extraction
- Code review autonomo di lavoro fatto

**Haiku 4.5 (subagent low-cost)**:
- Single-shot audit query (es. "SELECT count(*) FROM sys.X")
- File path verification + size check
- Grep/find su pattern noto
- 1-paragraph sintesi di output already-structured
- Formatting + cleanup minor
- Inbox file move + classification

### Template "§Model tiering" da includere in OGNI PROMPT futuro

```markdown
## §X — Model tiering raccomandato (cost-aware)

### Main session (orchestrator)
Modello: Opus 4.7 (default CLI)
Scope: orchestration cross-block, decisioni Inline Mitigation Scope, ADR application, integration multi-step

### Subagent delegations
- Block A pre-flight audit DB schema → Task subagent_type=Explore model="haiku"
- Block B spec deep-dive (3 file × 500 righe) → Task subagent_type=general-purpose model="sonnet"
- Block C verification post-migration → Task subagent_type=general-purpose model="sonnet"
- Block D audit forensic single-query → Task subagent_type=general-purpose model="haiku"
- Block E review autonomo del lavoro → Task subagent_type=general-purpose model="sonnet"

### Razionale risparmio
Task triviali (es. audit query, file verification) NON richiedono Opus 4.7.
Sonnet 4.6 è 5× più economico, Haiku 4.5 è 20× più economico — sufficient per task pattern noti.
Riservare Opus 4.7 per ragionamento complesso main session + decisioni architetturali.
```

### Anti-pattern (Cowork-side) da NON ripetere

❌ PROMPT senza specificare modello → CLI usa default Opus 4.7 per TUTTI i subagent = spreco
❌ Assumere "Opus 4.7 ovunque per qualità massima" → ROI negativo su task triviali
❌ Mai considerare Haiku 4.5 → uso non ottimizzato

### Quando NON downgrade

Lascia Opus 4.7 anche per subagent se:
- Task richiede critical thinking creativo (es. surface nuovo bias category)
- Output qualitativo complesso (es. write ADR proposal)
- Investigation con conclusioni che impattano main decision
- Cross-domain reasoning (es. correlare audit forensic con bias catalog history)

### Caso canonical da applicare

PROMPT 013 X9 SKILGRO mega-bundle:
- Block A (engine implementation): main session Opus 4.7 ✅
- Block B subtask "verify courses schema in legacy_mirror" → sarebbe stato Haiku 4.5 sufficient
- Block C subtask "apply 2 UPDATE column_mappings" → sarebbe stato Haiku 4.5
- Block D audit query "count exclusion_reason GROUP BY" → Haiku 4.5
- Wave 1 retry result parsing → Sonnet 4.6

Stima risparmio se applicato a X9: ~40-60% costo totale batch (assumendo 5-8h Opus → mix Opus+Sonnet+Haiku).

### Esempio Task tool invocation con model override

```typescript
// In CLI session
Task({
  description: "Audit DB schema",
  subagent_type: "Explore",
  model: "haiku",  // ← override del default Opus 4.7
  prompt: "Run psql query: SELECT count(*) per sys.* table. Return JSON {table_name: count}.",
})
```

### Quando override fallisce (anti-pattern caso)

Se Haiku 4.5 produce output insufficient (es. miss un edge case che Opus avrebbe colto), il subagent ritorna data parziale. Mitigazione: pattern memo §13 "verifica indipendente subagent" — main session valida + se sospetto, re-lancia subagent con model upgrade.

---

---

## §16 — X9 SKILGRO debrief (batch C10 lessons)

### ❌ Anti-pattern 21: CW-B46 — Spec assumed function signature without LIVE introspect

**Sintomo**: Migration template assume signature di funzione PG esistente (`validate_lookup_fk_payload(jsonb, uuid)`), ma reality è `(varchar, varchar) → boolean` + trigger wrapper separato. CREATE OR REPLACE FUNCTION accetta lazily — non error a apply time. Ma poi il dispatch trigger BREAKS tutte le successive LOOKUP_FK column_mappings INSERTs.

**Root cause (Cowork-side, parente CW-B40/CW-B25)**: schema introspection LIVE deve includere **function signatures** (`pg_get_functiondef`), non solo table columns. Pattern CW-B25 fin qui era table-level + column-level (CW-B40 extension). Ora va esteso a function-level.

**Mitigation preventiva per spec authoring**: pre-spec authoring, eseguire **LIVE introspect functions**:

```sql
-- Function signature + body verbatim
SELECT pg_get_functiondef(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = '<schema>' AND p.proname = '<function_name>';

-- Function argument types
SELECT proname, oidvectortypes(proargtypes), prorettype::regtype
  FROM pg_proc
 WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = '<schema>')
   AND proname = '<function_name>';
```

Includere output verbatim nello spec PRIMA di scrivere migration template che wrap/dispatch funzioni esistenti.

**Caso canonical X9 Block A**: ADR-0017 §7 migration template assumeva `validate_lookup_fk_payload(jsonb, uuid)`. CLI ha mitigato inline: dispatch function inlinata LOOKUP_FK validation (extract target_table+match_on JSONB keys, call real `validate_lookup_fk_payload(varchar, varchar)`, RAISE on false).

---

### ❌ Anti-pattern 22: CW-B47 — Inline mitigation cap when source semantic missing

**Sintomo**: Inline UPDATE-in-place column_mapping per mappare source col X → target col Y. MA source schema lacks the semantic relation (es. `course_id` reference ≠ `module_id`, livello path/course vs module). Inline mitigation può patch column_mapping ma **non synthesize** missing semantic FK. Result: silent-skip a livello NOT NULL constraint downstream.

**Pattern (Cowork + CLI)**: quando inline UPDATE è semanticamente lossy, il REPORT DEVE:
1. Documentare il residual finding esplicitamente
2. Stimare expected drop rate (es. "best-effort 50% match, 50% silent-skip su NOT NULL")
3. NON claim "full unlock" — solo "partial unlock per matched-URI, residual blocked"
4. Aggiungere `column_mapping_metadata.note` con la limitation

**Caso canonical X9 Block C**: `course_id → module_id LOOKUP_FK` su `course_esco_skills` era loose (course-level vs module-level). Inline UPDATE applicato ma rows silent-skipped su module_id NOT NULL.

**Lesson per future spec**: quando spec autora LOOKUP_FK con semantic ambiguity, includere explicit comment in spec § "Expected unlock rate + residual" + flag come "partial mitigation" non "full unlock".

---

### ❌ Anti-pattern 23: CW-B48 — Background `&` shell job status unreliable

**Sintomo**: launching Wave 1 via `nohup node script.mjs > log &` in orchestrator shell. Parent bash reports "background job completed" al primo stdout flush, ma processo è ancora alive. False positive "finished" notification.

**Mitigation pattern (CLI-side)**: NON usare shell job status come truth. Monitor via DB poll:

```sql
SELECT import_run_status FROM brownfield.import_runs WHERE id = $run_id;
-- 'RUNNING' = still alive, 'COMPLETED' = done
```

Polling interval: ogni 30-60s fino a status COMPLETED. Esempio loop bash:

```bash
while true; do
  status=$(psql -tA -c "SELECT import_run_status FROM brownfield.import_runs WHERE id='<runid>'")
  [ "$status" = "COMPLETED" ] && break
  [ "$status" = "FAILED" ] && exit 1
  sleep 30
done
```

---

### ❌ Anti-pattern 24: CW-B49 — IMPORT new table_mapping NOT propagated to upsert

**Sintomo**: Inserire nuova table_mapping classification=IMPORT, approval=APPROVED, wave=1. Wave 1 retry stages source rows + validation PASSED + APPROVED. MA **0 rows upserted** — `staging_target_record_id IS NULL` per 100% dei rows.

**Status**: P0 BLOCKER — engine upsert pipeline esclude new-on-this-run table_mappings. Working hypotheses (per C10 forensic):
1. Upsert query JOIN `audit.import_approval_decisions` AND richiede `table_mapping_run_id` pre-bind
2. Filter `table_mapping_classification='IMPORT' AND table_mapping_run_id IS NOT NULL`
3. Lineage existence pre-check

**Impatto**: blocca tutti i futuri Block che richiedono creazione di nuove table_mappings (la maggior parte dei batch SDBI rimanenti). Forensic deep richiesta su `apps/api/src/modules/brownfield-wave-executor/engine.ts + upsert-sql.ts`.

**Status mitigation**: PENDING C10 forensic. Vedi `cowork_reserved/batch_c10/forensic_cw_b49/`.

---

### ✅ Pattern vincente 19: "Document residual finding pattern (CW-B47 follow-up)"

Quando un fix è semanticamente parziale (best-effort), il REPORT deve:
1. **Quantificare** il match rate (es. "975/1381 URI matched legacy_mirror.esco_skills, 406 unmatched synthetic")
2. **Stimare residual blocking** (es. "delle 975 matched, ulteriori N skip su downstream NOT NULL")
3. **Distinguere acceptance criterion vs residual**: se spec misurava `audit drop X→Y`, lo si raggiunge anche con residual; se misurava `target count ≥N`, allora residual è failure
4. **Documentare come `column_mapping_metadata.note`** in registry per audit trail

Anti-pattern: dichiarare "Block X PASSED" senza esplicitare residual → confusione su prossime decisioni.

---

### ✅ Pattern vincente 20: "Function-level schema introspection LIVE (CW-B25 extension)"

CW-B25 originario era table+column level. X9 ha provato che bastava non.

Spec authoring per migration template che wrappano/dispatchano funzioni esistenti DEVE includere:
- `pg_get_functiondef` verbatim della funzione wrapped
- Argument types via `oidvectortypes(proargtypes)`
- Return type via `prorettype::regtype`

Output incluso nello spec PRIMA del migration template draft.

**Generalizzazione CW-B25**: schema introspection LIVE = tables + columns + **functions + triggers + indexes + check constraints**. Tutto verbatim from pg_catalog/information_schema. No assumptions.

---

---

## §17 — `/loop` watchdog vincente (Cowork↔CLI session-bounded automation)

### ✅ Pattern vincente 21: "`/loop` bundled skill come Cowork↔CLI watchdog"

**Origine**: 2026-05-23 — dopo errore watchdog PowerShell C9.1 (FBI saltata, abbandonato) + ricerca approfondita docs Claude Code CLI + test FBI-compliant.

**Discovery**: `/loop` è una **bundled skill** di Claude Code CLI (prompt-based, no logica hardcoded). Schedula prompt recurring background nella sessione CLI aperta. Utilizza OAuth interactive (zero API key extra).

**Capabilities verified live (test 2026-05-23T16:31-16:35Z, 3 iter PASS)**:
- Auto-execution prompt task ogni X minuti (interval auto-paced o explicit `5m`/`300s`)
- Bash tool calls auto-approved durante iterazioni (no permission prompts)
- File read/write tools available
- Counter-based stop logic supportata
- Session-bounded (muore al close finestra terminal)
- Auto-expire dopo 3 giorni

### Use case canonical: Cowork↔CLI watchdog

Sostituisce manual copy-paste trigger Enzo per ogni PROMPT emesso da Cowork:

1. Enzo lancia 1× al giorno: `claude` interactive + paste `/loop` watchdog prompt
2. Loop scansiona `.inbox/cli/pending/` ogni 5 min
3. Quando Cowork emette nuovo `_01_PROMPT_*` + inbox notify, loop auto-detect + esegue
4. Loop emette REPORT + inbox notify + commit/push autonomously
5. Cowork processa REPORT review + emette next PROMPT
6. Cycle continua fino a close finestra o expire 3 giorni

**Riduzione intermediation operativa: ~95%**. Restano tue: ADR approval + P0 halt review.

### Pattern memo reference

Spec autoritativa completa con PROMPT autoritativo + lifecycle + sanity checks in `cowork_reserved/batch_c10/loop_watchdog/01_LOOP_WATCHDOG_PROMPT.md`.

### FBI 5/5 verified (case canonical "FBI applicata correttamente")

A differenza del fallimento watchdog PowerShell C9.1 (FBI saltata), questa volta FBI applicata pre-implementation:
- Q1 ✅ docs.claude.com confirm + community sources (Verdent, PopularAITools, MindStudio)
- Q2 ✅ OAuth interactive, no API key extra
- Q3 ✅ test triviale `D:\tmp\loop_test\` — 3 iter + auto-stop + file write OK
- Q4 ⚠️ cost ~120-300k token/h idle quantificato + budget rosario accettato
- Q5 ✅ alternative ponderate (manual paste fallback always available + scheduled task Cowork side complementare)

**Lezione**: FBI applicata = soluzione viable trovata. FBI saltata = 2h sprecati su soluzione non-viable. Comportamento corretto = sempre verificare prima.

### Combinazione massima Cowork↔CLI automation

```
┌──────────────────────────────────────────────────────────────┐
│ Cowork-side (questa chat OR scheduled task ogni 15-30 min): │
│   - Read REPORT from .inbox/cowork/pending/                  │
│   - Cognitive review + spec drafting                          │
│   - Emit next _01_PROMPT_*.md + .inbox/cli/pending/notify    │
│   - Bias registry + pattern memo updates                      │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  (file system inbox)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ CLI-side (claude /loop 5m, session-bounded watchdog):        │
│   - Poll .inbox/cli/pending/ ogni 5 min                       │
│   - Auto-execute PROMPT files (full batch protocol v2.2)     │
│   - Emit REPORT + .inbox/cowork/pending/notify                │
│   - Move pending → read                                       │
│   - Commit + push singolo bundle                              │
└──────────────────────────────────────────────────────────────┘
                          │
                          │  (Enzo human-in-loop)
                          ▼
                  ADR approval + P0 halt review
```

**Combined intermediation reduction: ~98%**.

---

---

## §18 — Workflow accoppiato Cowork-scheduled ↔ CLI-/loop (full automation Cowork↔CLI)

### ✅ Pattern vincente 22: "Dual-watchdog Cowork-scheduled + CLI-/loop"

**Origine**: 2026-05-23 — completamento test FBI per entrambi i lati post-discovery `/loop` skill.

**Discovery cumulative**:
- `/loop` CLI bundled skill: ✅ verified live (3-iter test PASS) — polling `.inbox/cli/pending/`
- Cowork scheduled task: ✅ verified live (one-shot test PASS) — polling `.inbox/cowork/pending/`

Combinazione = full automation Cowork↔CLI (~95-98% intermediation reduction).

### Architettura accoppiata

```
┌─────────────────────────────────────────────────────────────────────┐
│ COWORK-SIDE WATCHDOG (scheduled task recurring 15min)               │
│   File: D:\enzospenuso\Documents\Claude\Scheduled\                   │
│         cowork-watchdog-poll-inbox\SKILL.md                          │
│   Cron: */15 * * * * (every 15 min local time)                       │
│                                                                       │
│   Per iteration:                                                      │
│   1. Poll D:\heuresys-advanced\cowork_code_exchange\.inbox\          │
│      cowork\pending\                                                  │
│   2. Filter *__report_ready.md, *__halt_*.md, *__exec_progress.md   │
│   3. Categorize CASE A/B/C/D:                                         │
│      - A clean PASS → log, move to read/                             │
│      - B PASS+surface → log, move to read/                           │
│      - C partial/fail → log, KEEP in pending (Enzo review needed)   │
│      - D halt P0 → log + KEEP in pending (urgent Enzo review)        │
│   4. Write cowork_reserved\scheduled_alerts.log                      │
│   5. Idle throttle: 1 idle log per 4 runs (max 1/hour)               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │  (file system: cowork_reserved/)
                                ▼
        Enzo apre Cowork chat → vede scheduled_alerts.log →
        sa cosa è successo durante absence → priority handling
                                │
                                │  (Enzo conversational interaction)
                                ▼
                Cowork chat: emit next _01_PROMPT_*.md
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CLI-SIDE WATCHDOG (claude /loop 5m session-bounded)                  │
│   Lanciato 1× al giorno da Enzo: claude → /loop 5m <prompt>          │
│                                                                       │
│   Per iteration (5 min):                                              │
│   1. Poll .inbox\cli\pending\                                         │
│   2. Filter *__prompt_ready.md + *__exec_directive*.md               │
│   3. Auto-execute PROMPT files (full Cowork↔CLI v2.2)                │
│   4. Emit REPORT + .inbox\cowork\pending\__report_ready.md           │
│   5. Move processed pending → read                                    │
│   6. Commit + push singolo bundle                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### FBI verified entrambi i lati

| Componente | FBI 5/5 | Test evidence |
|---|---|---|
| `/loop` CLI side | ✅ | 3-iter test 16:31-16:35Z 2026-05-23 PASS — `D:\tmp\loop_test\loop_test.log` |
| Cowork scheduled side | ✅ | one-shot test 16:30:38Z 2026-05-23 PASS — `D:\heuresys-advanced\cowork_reserved\scheduled_test.log` (cowork_inbox=15, cli_inbox=2, mount RW OK) |

### Cost budget cumulativo

- **CLI `/loop` 5m**: ~120-300k token/h idle + variable execution cost
- **Cowork scheduled 15m**: ~3-5k token/run × 96 run/giorno = ~400k token/giorno
- **Total automation cost**: ~1-2M token/giorno

Sustainabile su OAuth subscription (no API key extra). Significativo ma giustificato dalla riduzione ~95-98% intermediation.

### Lifecycle + manutenzione (Enzo POV)

| Evento | Frequency | Azione |
|---|---|---|
| Lancio CLI `/loop` | Daily (mattina) | Apri terminale, `claude`, paste `/loop` prompt |
| Re-paste `/loop` | Settimanale (auto-expire 3 giorni) | Re-paste |
| Cowork scheduled gira | Auto recurring 15min (app open) | None — gira da solo |
| Check `scheduled_alerts.log` | Quando apri Cowork chat | Read tail per priority overview |
| Halt P0 review | Quando alerts segnalano P0 | Apri chat + emit exec_directive |
| ADR approval | Quando alerts segnalano ambiguity | Apri chat + decisione architetturale |

### Limit di scope (onestà, anti-pattern §17 reminder)

**Scheduled task NON fa**:
- ❌ Emit autonomous `_01_PROMPT_*.md` files (richiede full Cowork conversation context — pattern memo, bias registry, ADR list = too much for stateless scheduled run)
- ❌ Modify pattern memo / bias registry / CLAUDE.md
- ❌ Trigger CLI sessions
- ❌ Commit / push git
- ❌ Decide ADR architectural

**Scheduled task FA**:
- ✅ Detection + categorization automatica (PASS/SURFACE/FAIL/HALT)
- ✅ Move file pending → read (per acceptance criteria met)
- ✅ Write alerts log per Enzo overview
- ✅ Idle heartbeat throttled

**Decisione cognitive** (emit next PROMPT, ADR approval, halt resolution) **resta Enzo** ma con visibility full via alerts log → ridotto a "apri chat 1-2 volte al giorno per batch processing".

### Riduzione intermediation finale (quantificata)

| Aspetto | Pre-watchdog | Post Cowork-scheduled solo | Post CLI-/loop solo | Post combinato |
|---|---|---|---|---|
| Operativa (copy-paste trigger) | 100% | 100% | ~5% | ~5% |
| Cognitiva (review REPORT) | 100% | ~30% | ~80% | ~30% |
| Detection (sapere quando agire) | tutto Enzo | automato | manual | automato |
| **Totale** | tutto Enzo | ~70% reduction | ~50% reduction | **~95% reduction** |

### Quando NON è appropriato il dual-watchdog

- Progetti early-stage con frequente cambio architecture → scheduled detection diventa noise
- Progetti con bias surfacing nuovo ad ogni batch → richiede frequent Enzo deep review, automation marginal
- Progetti con halt P0 frequenti → scheduled non aiuta perché Enzo serve comunque

Usare dual-watchdog dopo che:
- Engine + framework sono maturi (post ~10 cicli)
- Bias catalog stabile (poche nuove categorie surfacing)
- Pattern memo §1-§N coverage estensiva

heuresys-advanced post-X10 = candidato ottimale.

### Caso canonical (case study Cowork batch C10)

heuresys-advanced 2026-05-23, post-X10 setup:
- `/loop` CLI verified live + production prompt scritto (`cowork_reserved/batch_c10/loop_watchdog/`)
- Cowork scheduled task active (`*/15 * * * *`)
- Both feed into accoppiata workflow
- Expected reduction Enzo intermediation: ~95% per X11-X16 cycles rimanenti

---

---

## §19 — X10 debrief (4 lessons da REPORT 014 §5)

### ✅ Pattern vincente 23: "Fast-suite tier per iteration cycle"

**Origine**: REPORT 014 §5.2 — CLI X10 ha notato che `pnpm exec vitest run` full suite (~80s) è eccessivo per ciascuna iterazione di engine patch development. Suggerito **two-tier approach**:

- **Tier 1 (development)**: `pnpm exec vitest run test/<patch-specific>.test.ts` ≤2s — esegui ad ogni patch micro-iteration
- **Tier 2 (acceptance)**: `pnpm exec vitest run` full ~80s — esegui SOLO una volta a fine Block prima del commit

Effort saving per iteration: ~78s × N micro-iterazioni = significativo per debug cycles (es. ADR-0017 v1 → v2 dispatch fix avrebbe avuto ~5 cycles × 78s = ~6 min saved).

**Template per PROMPT futuri** (sezione `§Strategia esecuzione`):

```
### Test execution tier
- Durante iteration patch: `pnpm exec vitest run test/<patch-specific>.test.ts` (fast feedback ≤2s)
- Solo pre-commit final: `pnpm exec vitest run` (full suite acceptance)
- Non re-eseguire full suite tra micro-iter sullo stesso file
```

---

### ✅ Pattern vincente 24: "Empirical hand-probe SQL pre-patch design"

**Origine**: Cowork C10.8 forensic CW-B49 + REPORT 014 §5.3 — il root cause CW-B49 (split-on-COALESCE) è stato verificato via **hand-probe SQL diretta su staging table** PRIMA di scrivere patch design:

```sql
-- Hand-probe runtime PG behavior con conflictKeyExprs corrotto
SELECT DISTINCT ON (
  COALESCE(learning_path_tenant_id, '00000000-...'::uuid),
  TRIM(staging_raw_record->>'code')
) staging_row_id
FROM staging.wave1_learning_paths
WHERE staging_import_run_id = '<x9_runId>' LIMIT 1;
-- → ERROR: column "learning_path_tenant_id" does not exist
```

Risultato: confirm root cause + design patch con confidence alta.

**Pattern checklist per future engine bug debug**:
1. Reproduce bug in isolation via hand-probe SQL (no engine wrapper)
2. Identify exact PG error message
3. Reverse-engineer engine code path che porta a quel SQL
4. Design patch + verify mentale: nuovo SQL emitted gira PG?
5. Then write code patch + unit tests

**Pre-empirical-probe risk**: design patch based on assumption → fail at runtime → iterazione costosa (caso watchdog C9.1 saltò questo, costo 2h sprecati).

---

### ✅ Pattern vincente 25: "ADR class-of-bug enumeration (preventive)"

**Origine**: REPORT 014 §5.4 — CW-B49 fix ha unlocked 10 sys.* tables con COALESCE NK UQ pattern simultaneously (sys_career_paths, sys_compensation_bands, sys_kpi_definitions, sys_learning_modules, sys_learning_paths, sys_payout_curves, sys_skill_aliases, sys_skills, sys_user_auth_roles, sys_user_certifications). Engine throughput +13851 rows post-patch.

**Pattern**: quando un fix engine sblocca un cluster di tabelle con stesso pattern strutturale, autorare un **ADR class-of-bug** che enumera tutte le tabelle affette + documenta il pattern + previene re-introduzione del bug in future schema.

**Caso canonical**: ADR-0018 (questo batch C11.2) enumera 10 COALESCE-UQ sys.* tables + documenta bug split-on-COALESCE + raccomanda checklist per future UQ expression-based indexes.

**Future application**: ogni volta che CLI surfaca un fix che impatta N>3 tabelle simultaneously, Cowork debe autorare ADR class-of-bug per documentation preventiva.

---

### ❌ Anti-pattern 25: CW-B47 in spec wording precision (lesson da REPORT 014 §5.1)

**Sintomo**: PROMPT 014 §6 acceptance #4 wording era: "sys_skill_learning_mappings depends on CW-B47 + URI match". CLI ha interpretato come "MIGHT be unlocked by CW-B49 + CW-B47". In realtà CW-B47 (module_id semantic gap) è independent macro-area, non resolvable da CW-B49 alone.

**Mitigazione**: spec wording deve essere ASSERTIVO + UNAMBIGUOUS quando si tratta di dependencies cross-batch:

❌ "depends on CW-B47" (ambiguo — può intendere "blocked-by" o "related-to")
✅ "sys_skill_learning_mappings will stay 0 until CW-B47 module_id semantic is addressed (independent macro-area, not blocked by CW-B49)"

**Pattern memo per spec wording**: usa "blocked-by", "related-to", "independent-of" come termini precisi. NON usare "depends-on" senza qualificazione.

---

### ✅ Pattern vincente 26: "Watchdog scheduled live verified — auto-re-classification"

**Origine**: 2026-05-23T17:19:42Z — scheduled watchdog Cowork-side `cowork-watchdog-poll-inbox` ha auto-corretto la sua propria classification di REPORT 014:
- Run 1 (17:03): classified `status=ambiguous` (template placeholders not parsed correctly)
- Run 2 (17:19): re-detected + classified `status=pass_with_surface` + annotazione `corrects_prior_ambiguous_assessment=true` + `next_action=auto_emit_prompt_015_recommended_X11B_GOKMER_or_X11A_CW_B47`

**Capability emergente**: il watchdog scheduled NON è "fire-and-forget" — è auto-correcting via re-scan iterativo. Se la prima classification è ambigua o errata, scan successivi possono refine.

**Implicazione design**: il watchdog può lasciare file in `pending/` quando ambiguous (per re-evaluation) invece di committare a una classificazione cruda al primo scan. Pattern §18 architettura accoppiata reinforced.

**Evidence pattern memo §18 vincente 22 working as designed**: i 14 vecchi `exec_progress` da REPORT 003 storici sono stati moved to read autonomously al primo scan. Risparmio Enzo: ~14 file da gestire manualmente.

---

### Changelog (continued)

- **2026-05-21 (X4.A debrief)**: §9 (CW-B32, CW-B33, Dry-run EXPLAIN, Iteration). Total: 11 anti + 9 vincenti.
- **2026-05-21 (X5.A debrief, batch C6)**: §10 (CW-B34 nullable NK + "ADR DB+Engine 2-step"). Total: 12 anti + 10 vincenti.
- **2026-05-21 (X6.A debrief + C7 forensic)**: §11 (Lineage JOIN-back + CW-B35/36/37 + Audit forensic). Total: 15 anti + 12 vincenti.
- **2026-05-21 (X5.B + X7 debrief, batch C8)**: §12 (CW-B38/39/40 + storico CW-B41..B45 retroattivo + Inline Mitigation Scope + UPDATE-in-place pivot + Bias Registry SoT). Total: 20 anti + 15 vincenti.
- **2026-05-23 (Enzo feedback intermediation + watchdog cleanup)**: §13 (Subagent-first PROMPT pattern) + §14 (Feasibility-before-implementation FBI). Total: 20 anti + 17 vincenti.
- **2026-05-23 (Enzo feedback model tiering)**: §15 (Model selection strategy per task type). Total: 20 anti + 18 vincenti.
- **2026-05-23 (X9 SKILGRO debrief, batch C10)**: §16 (CW-B46/47/48/49 + Document residual finding + Function-level schema introspection). Total: 24 anti + 20 vincenti.
- **2026-05-23 (`/loop` watchdog FBI verified)**: §17 (/loop bundled skill vincente). Total: 24 anti + 21 vincenti.
- **2026-05-23 (Cowork scheduled + dual-watchdog completo)**: §18 (Dual-watchdog architettura). Total: 24 anti + 22 vincenti.
- **2026-05-23 (X10 debrief, batch C11)**: §19 (4 lessons da REPORT 014 §5 — Fast-suite tier vincente, Empirical hand-probe vincente, ADR class-of-bug vincente, CW-B47 spec wording anti-pattern, Watchdog auto-re-classification vincente). Total: **25 anti-patterns + 26 patterns vincenti**.
- **2026-05-24 (X18 debrief, batch C18.x → C19 consolidation)**: §20 (5 lessons cross-batch X18 — CW-B58 meta-rule "empirical > narrative", CW-B59 bisect time-box + source-impl-replacement canonical, npm-publish-migration end-to-end checklist, GAT lifecycle policy, Next 15 RSC bundle threshold workaround pattern). Total: **27 anti-patterns + 29 patterns vincenti**.

---

## §20 — X18 debrief (batch C18.x → C19 consolidation, 2026-05-24)

X18 ha consumato 5 amendment cascade (PROMPT 022 → 022.1 → 022.2 → 022.3 → 022.4 → 022.5) + 6 halt P0/P1 + 12 bisect iterations + 4 narrative hypothesis confutate empirically dal CLI. Retro-analisi Enzo C18 (intervento esplicito post-PROMPT 022.2): "stai procedendo per tentativi ed errori, contravvenendo a tutte le regole". Lesson finalizzate dopo HALT-022-06 bisect_inconclusive + Enzo decision Path B+C pragmatic close. Sotto le 5 lezioni consolidate da assorbire cross-project.

### ❌ Anti-pattern 26: Narrative diagnosis senza empirical test matrix (CW-B58 meta-rule)

```
"Ho ragionato che dist 388 KB significa Radix bundled inline. Prescrivo external aggressive list."
```

**Problema**: Cowork ha modelli teorici (tsup behavior, Webpack resolution, npm exports map semantics) ma NON ha la realtà sotto mano. Quando prescrive un fix basato su assumption non verificata empiricamente:
- Il fix può essere harmless ma REDUNDANT (caso CW-B57 — external aggressive era redundant, tsup auto-externalize dependencies by default)
- O peggio, può essere wrong direction (caso CW-B57 first → withdrawn dopo CLI counter-evidence)

Manifestazione X18: PROMPT 022.2 ha prescribed external aggressive list su 30+ libs senza fare `head -30 dist/index.mjs | grep '^import'` per verificare baseline bundle behavior. CLI ha fatto self-check post-rebuild → 388 KB byte-identical pre/post → external era redundant. CW-B57 withdrawn.

**Fix** (CW-B58 mitigation canonical):
- **PRE-prescription empirical scan obbligatorio** prima di prescrivere fix architetturale:
  - Bundle inspection: `head -30 dist/<entry>.mjs | grep '^import'` per verify external behavior
  - File presence: `ls -la dist/index.*` per verify outExtension/exports map alignment
  - Manifest exports verify: `cat package.json | jq '.exports'`
  - Consumer scan: `grep -rn '@pkg/' apps/ --include='*.{ts,tsx,css}'` per enumerare subpath usage
- **Meta-rule**: "quando CLI contraddice Cowork diagnosi con evidenza concreta (verified-by test, bundle inspection, registry HTTP check, multi-config test matrix), Cowork accetta + ringrazia + self-corrects nel prossimo amendment. CLI ha la realtà sotto le mani, Cowork ha modelli teorici."
- **In PROMPT authoring**: includi sempre §"Pre-flight empirical baseline" con 3-5 check concreti che CLI esegue PRIMA di Block A, no narrative diagnosis senza evidence in PROMPT body.

### ❌ Anti-pattern 27: Bisect senza time-box + export-list manipulation (CW-B59 — methodology contamination)

```
"Bisect logaritmico su src/index.ts exports. Comment 50%, rebuild, retest. Itera fino a culprit isolated."
```

**Problema**: bisect via export-list removal contaminata su 3 layer:
1. **Downstream typecheck blocking**: removere exports trips consumer typecheck (es. `SystemHealthDashboard.tsx` imports 20+ items collettivi) — build stops at typecheck pre-page-data → can't isolate single-component runtime effect.
2. **Stub replacement module-structure drift**: replacing missing export con `export const X = (() => null)` cambia module structure (was pure re-exports, became mixed) → dist output diverso → webpack chunking differs → fail behavior changes mid-iteration.
3. **Link: vs versioned different fail modes**: link: ha fail X (webpack parse error on useEffect), versioned ha fail Y (`d.createContext undefined`) — bisect via link: NON è il setup canonical per problemi di publish.

Manifestazione X18: 12 iterations CLI Path β → NO single-component culprit isolabile, REAL cause = bundle-complexity-threshold + Next 15 RSC boundary (architetturale, non singolo).

**Fix** (CW-B59 mitigation canonical):
- **Bisect canonical = source-file impl replacement** (stub IMPL, KEEP export signature) NOT export-list manipulation. Module structure preservata, consumer typecheck unaffected.
- **Time-box mandatory**: max 8-10 iterations OR 60-90 min budget. Beyond che threshold → HALT + escalate Cowork per scope reassessment (problema è probabilmente architetturale, NON singolo culprit).
- **In PROMPT authoring**: se prescriverebbi bisect, includi sempre §"Bisect time-box + escalation criteria" con limite numerico e fallback path (es. Path C revert / Path D defer / Path E workaround pragmatic).
- **Multi-config test matrix CONCURRENTE al bisect**: 3 config test (link: / versioned / no-transpilePackages) eseguiti ALL'INIZIO per validate se è single-component OR threshold/architettura, prima di committi su bisect costoso.

### ✅ Pattern vincente 27: npm-publish-migration end-to-end checklist

Quando PROMPT prescrive npm publish (link: → versioned migration), includi pre-flight CHECKLIST esaustiva:

```
§ Pre-flight npm-publish-migration mandatory:
1. npm whoami → verifica auth (non "Not logged in")
2. npm profile get tfa → verifica 2FA mode (auth-and-writes richiede GAT o --otp)
3. ~/.npmrc grep _authToken → verifica GAT presence per bypass-2fa
4. npm view <pkg>@<version> → verifica registry state (404 = libero / 200 = preso)
5. npm view <pkg> → check current latest version + deprecated history
6. npm org ls <scope> → verifica org exists + user membership (404 = creare via https://www.npmjs.com/org/create)
7. grep -rn '<pkg>/' apps/ --include='*.{ts,tsx,css,mjs,js}' → enumera subpath consumers
8. head -30 dist/<entry>.mjs | grep '^import' → verify external behavior baseline (≥30 imports = tsup auto-externalize OK)
9. ls dist/index.* → verify outExtension matches manifest exports (.mjs + .cjs entrambi presenti)
10. cat <ui-repo>/package.json | jq '.exports' → exports map preserves all subpath consumers
```

Senza questa checklist, X18 ha catturato 4+ halt: npm-not-logged-in, exports-map-subpath-gap, publish-2fa-required, dual-package-hazard (misdiagnosis). Tutti pre-conoscibili.

### ✅ Pattern vincente 28: GAT lifecycle policy

Per pacchetti pubblici scoped (org `@<scope>/...`) con 2FA `auth-and-writes`:
- **Setup one-time**: https://www.npmjs.com/settings/<user>/tokens/granular-access-tokens/new
  - Token name descrittivo (es. `<pkg>-publish-cli`)
  - **CHECK "Allow this token to bypass 2FA when publishing or modifying packages"** (cruciale per CI/CLI publish)
  - Permission scope `Read and write` + restrict packages a `<scope>/<pkg>` o intero `<scope>`
  - Expiration 365 giorni (rotate annualmente)
- **Storage**: `~/.npmrc` user-level `//registry.npmjs.org/:_authToken=npm_XXX` — R11 mai loggare, mai committare
- **Lifecycle**: rotate ogni expiration, revoke compromised, scope minimal (per-package preferred over per-scope per blast radius restriction)
- **Verify pre-publish**: `cat ~/.npmrc | grep -c '_authToken'` deve essere 1 (presente in pre-flight)

### ✅ Pattern vincente 29: Next 15 RSC bundle threshold workaround pattern

Manifestazione X18 HALT-022-06: `@heuresys/ui` >50 components → page-data collection trips `d.createContext is not a function` / `Class extends value undefined` su routes con import from main entry (NON subpath issue, è chunk topology).

Workaround tier-list (in ordine di preference):
1. **Path B `export const dynamic = "force-dynamic"`**: 1-line change su layout problematica. Skip static gen, route works at runtime. Pro: minimal invasive. Con: SSR runtime cost per route, no static gen benefit.
2. **Path C scope reduction**: move route folder fuori da App Router (`src/app/<route>` → `src/_disabled_<route>_<batch>`) + tsconfig exclude. Pro: complete isolation, build PASS. Con: route disabled finché root cause fix.
3. **Path A git bisect commits library repo**: ~5-7 iterations log2(N_commits) tra last-known-good baseline e HEAD. Identifica commit/dep culprit. Atomic evidence.
4. **Path F split library in subpackages**: `@<scope>/<lib>-core` + `@<scope>/<lib>-dashboard` + `@<scope>/<lib>-brand`. Reduce bundle surface per chunk. Pro: architettura solida. Con: major refactor + multi-publish cycle.
5. **Path E framework upgrade**: Next 16 (when available) — speculative ma può avere fix RSC bundle. Out-of-scope MVP-3.

**Decision matrix**: priority MVP close immediate → Path B+C pragmatic + caveat documentato + DEFER-F session. Priority root cause → Path A/F dedicated.

In PROMPT authoring per future npm publish con library multi-component: includi §"RSC bundle threshold contingency" che pre-segnali Path B+C come fallback se build fail post-versioned migration.

---
