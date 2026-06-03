# Reconciliation F1 — Registry + View + Terminal States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`). **F1 WRITES to the production DB** (one new table + view + function + 65 registry rows). It does **NOT** modify any of the 65 business tables. **GATED**: a `pg_dump -Fc` backup + the user's explicit greenlight precede the apply step.

**Goal:** Materialize the F0-signed classification as a queryable DB registry: create `sys.sys_reconciliation_registry` + `sys.v_reconciliation_status`, seed the 65 verified rows (post sign-off borderlines applied), so every empty `sys.*` table has an explicit, queryable terminal status and the "ambiguous count" drops to zero.

**Architecture:** A single idempotent migration (`000058`) creates the registry table, a STABLE PL/pgSQL function that resolves per-table status (live `EXISTS` + card classification + registry declared status), and a view wrapping it. A separate idempotent seed (`04_registry.sql`) inserts the 65 classified rows, generated mechanically from the F0 workflow JSON with the 5 signed-off borderline overrides applied. No business-data writes.

**Tech Stack:** PostgreSQL 16, `db/scripts/migrate.sh` (`psql -1 -f`), Node (seed generator), vitest integration test against the live DB via tunnel `:5433`.

---

## Spec reference

Implements **F1** of `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md` (§3 registry/view, §1 terminal states). Consumes the F0 sign-off (A:5 B:16 C:23 D:21 after borderlines). The 5 imports (F2) and the walls (F3) are separate plans.

## Signed-off classification (F0 + borderlines)

Source of truth: `qa_artifacts/F0_reconciliation_triage.md` + the workflow JSON. Borderline overrides approved at sign-off (S960):
- `sys_bonus_pools`: B → **A** (import RTL subset 6/14; the 8 out-of-scope SmartFood/EcoNova rows skip, like kpi_targets).
- `sys_inbox_notifications`: B → **D** (declared EXCLUDE; legacy source `notifications` kept in registry, not imported).
- `sys_gap_analysis_results`: stays **A** (F2 verifies the skill_gap_analyses 1:1 mapping before import).
- `sys_user_professional_experiences`: stays **D** (NO_SOURCE — no legacy work-history table found).
- `sys_auth_sessions`: **D** NO_SOURCE (strip the spurious `legacy_source="session"` artifact → NULL).

Final counts: **A:5, B:16, C:23, D:21** (sum 65).

## bucket → declared_status mapping (registry)

| bucket | declared_status | wall | note |
|---|---|---|---|
| A | `IMPORT` | null | F2 will import |
| B | `NEEDS_DECISION` | set (the wall) | F3 resolves the wall, then imports |
| C | `NEEDS_DECISION` | null | F4 dossier — human derivation rule |
| D + legacy_source≠null | `EXCLUDE` | null | source exists, deliberately not imported |
| D + legacy_source=null | `NO_SOURCE` | null | app-generated / no legacy analog |

(B and C share `declared_status=NEEDS_DECISION`; the `bucket` column + `wall` distinguish them. The 6 tables that already carry a `REFERENCE_ONLY` card keep it — the view resolves them as `REFERENCE_ONLY` via card>declared precedence, and the registry `bucket` surfaces F0's view that several are in fact importable behind a wall: an informative card-vs-registry delta to revisit in F3.)

## File structure

- Create: `db/migrations/000058_reconciliation_registry.sql` — table + function + view (idempotent).
- Create: `db/seeds/reconciliation/04_registry.sql` — 65 idempotent `INSERT … ON CONFLICT … DO UPDATE`.
- Create: `qa_artifacts/runs/_f1_gen_seed.mjs` — gitignored generator (reads F0 JSON → emits `04_registry.sql`).
- Create: `apps/api/test/reconciliation-registry.integration.test.ts` — asserts the registry + view.

---

## Task 1: Write migration 000058 (table + function + view)

**Files:** Create `db/migrations/000058_reconciliation_registry.sql`

- [ ] **Step 1: Write the full migration**

```sql
-- 000058_reconciliation_registry.sql
-- F1 of the reconciliation-closure cycle (spec 2026-06-03-reconciliation-closure-design §3).
-- Gives every sys.* table an explicit, queryable terminal status. Pure metadata: does NOT
-- touch any of the 65 business tables. Idempotent: CREATE … IF NOT EXISTS + CREATE OR REPLACE.
-- RD-08: categorical = varchar(N) + CHECK, never ENUM. Audit cols + guarded updated_at trigger
-- mirror 000053.

CREATE TABLE IF NOT EXISTS sys.sys_reconciliation_registry (
  reconciliation_registry_id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_registry_table_name     varchar(255) NOT NULL,
  reconciliation_registry_bucket         varchar(1)  NOT NULL,
  reconciliation_registry_declared_status varchar(20) NOT NULL,
  reconciliation_registry_legacy_source  varchar(255),
  reconciliation_registry_legacy_source_rows integer,
  reconciliation_registry_wall           varchar(64),
  reconciliation_registry_rationale      text        NOT NULL,
  reconciliation_registry_decided_at     timestamptz NOT NULL DEFAULT now(),
  created_at                             timestamptz NOT NULL DEFAULT now(),
  created_by                             uuid        REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                             timestamptz NOT NULL DEFAULT now(),
  updated_by                             uuid        REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_reconciliation_registry_table_uq UNIQUE (reconciliation_registry_table_name)
);

ALTER TABLE sys.sys_reconciliation_registry
  DROP CONSTRAINT IF EXISTS sys_reconciliation_registry_bucket_check;
ALTER TABLE sys.sys_reconciliation_registry
  ADD CONSTRAINT sys_reconciliation_registry_bucket_check
  CHECK (reconciliation_registry_bucket IN ('A','B','C','D'));

ALTER TABLE sys.sys_reconciliation_registry
  DROP CONSTRAINT IF EXISTS sys_reconciliation_registry_status_check;
ALTER TABLE sys.sys_reconciliation_registry
  ADD CONSTRAINT sys_reconciliation_registry_status_check
  CHECK (reconciliation_registry_declared_status IN
         ('IMPORT','REFERENCE_ONLY','EXCLUDE','NO_SOURCE','NEEDS_DECISION'));

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='sys_reconciliation_registry_set_updated_at'
                 AND tgrelid='sys.sys_reconciliation_registry'::regclass) THEN
    CREATE TRIGGER sys_reconciliation_registry_set_updated_at BEFORE UPDATE
      ON sys.sys_reconciliation_registry FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- Status resolver: live EXISTS (cheap, stops at first row) + card classification + registry.
-- STABLE (not IMMUTABLE: reads tables). One row per sys base table.
CREATE OR REPLACE FUNCTION sys.fn_reconciliation_status()
RETURNS TABLE (
  table_name           text,
  has_rows             boolean,
  card_classification  text,
  declared_status      text,
  resolved_status      text,
  bucket               text,
  legacy_source        text,
  wall                 text,
  rationale            text
) LANGUAGE plpgsql STABLE AS $fn$
DECLARE r record; v_has boolean; v_card text; v_decl text; v_bucket text; v_src text; v_wall text; v_rat text;
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sys' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM sys.%I LIMIT 1)', r.tname) INTO v_has;
    SELECT tm.table_mapping_classification INTO v_card
    FROM brownfield.table_mappings tm
    WHERE tm.table_mapping_target_schema = 'sys' AND tm.table_mapping_target_table = r.tname
    ORDER BY CASE tm.table_mapping_classification
               WHEN 'IMPORT' THEN 1 WHEN 'EXCLUDE' THEN 2 WHEN 'REFERENCE_ONLY' THEN 3 ELSE 4 END
    LIMIT 1;
    SELECT rr.reconciliation_registry_declared_status, rr.reconciliation_registry_bucket,
           rr.reconciliation_registry_legacy_source, rr.reconciliation_registry_wall,
           rr.reconciliation_registry_rationale
      INTO v_decl, v_bucket, v_src, v_wall, v_rat
    FROM sys.sys_reconciliation_registry rr
    WHERE rr.reconciliation_registry_table_name = r.tname;
    table_name := r.tname; has_rows := v_has; card_classification := v_card;
    declared_status := v_decl; bucket := v_bucket; legacy_source := v_src; wall := v_wall; rationale := v_rat;
    resolved_status := CASE
      WHEN v_has THEN 'POPULATED'
      WHEN v_card IS NOT NULL THEN v_card
      WHEN v_decl IS NOT NULL THEN v_decl
      ELSE 'UNCLASSIFIED' END;
    RETURN NEXT;
  END LOOP;
END $fn$;

CREATE OR REPLACE VIEW sys.v_reconciliation_status AS
  SELECT * FROM sys.fn_reconciliation_status();

DO $$
DECLARE v_unclassified int; v_total int;
BEGIN
  SELECT count(*) , count(*) FILTER (WHERE resolved_status='UNCLASSIFIED')
    INTO v_total, v_unclassified FROM sys.v_reconciliation_status;
  RAISE NOTICE '000058: % sys tables, % UNCLASSIFIED (0 expected after seed 04)', v_total, v_unclassified;
END $$;
```

- [ ] **Step 2: Idempotency dry check (no apply yet)**

Run: `bash -n` is not applicable to SQL; instead eyeball: every object uses `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP CONSTRAINT IF EXISTS … ADD`. The trigger is guarded. No `INSERT` here (data is the seed). ✓

## Task 2: Generate the seed `04_registry.sql` from F0 JSON

**Files:** Create `qa_artifacts/runs/_f1_gen_seed.mjs` (gitignored) → emits `db/seeds/reconciliation/04_registry.sql`

- [ ] **Step 1: Write the generator**

It reads the F0 workflow output JSON (`…/tasks/wwish4d2o.output`), applies the 5 borderline overrides, maps bucket→declared_status, and emits idempotent `INSERT … ON CONFLICT (reconciliation_registry_table_name) DO UPDATE`. Override map (literal in the script):
```js
const OVERRIDE = {
  sys_bonus_pools:               { bucket:'A', note:'sign-off: import RTL subset 6/14; out-of-scope tenants skip' },
  sys_inbox_notifications:       { bucket:'D', note:'sign-off: EXCLUDE — runtime notifications, not imported' },
  sys_auth_sessions:             { legacy_source:null, legacy_source_rows:null, note:'sign-off: strip session artifact; runtime auth' },
};
function declared(t){
  if (t.bucket==='A') return 'IMPORT';
  if (t.bucket==='B'||t.bucket==='C') return 'NEEDS_DECISION';
  return t.legacy_source ? 'EXCLUDE' : 'NO_SOURCE';   // D
}
```
Each INSERT row: table_name, bucket, declared_status, legacy_source, legacy_source_rows, wall, rationale (quote-escaped). Wrap in `BEGIN; … COMMIT;` + a `RAISE EXCEPTION` if the inserted count ≠ 65. Header comment mirrors `03_kpi_targets.sql`.

- [ ] **Step 2: Run the generator + sanity check**

Run: `node qa_artifacts/runs/_f1_gen_seed.mjs "<F0 output path>"`
Expected: writes `db/seeds/reconciliation/04_registry.sql`; stdout reports `65 rows, byBucket A:5 B:16 C:23 D:21`. Grep the file: `grep -c "INTO sys.sys_reconciliation_registry\|VALUES" db/seeds/reconciliation/04_registry.sql` consistent with 65 rows.

## Task 3: GATED apply (backup → migrate → seed)

**Files:** none (DB writes)

- [ ] **Step 1: Backup (D-SAFE) — on the VM, co-located with the DB**

Run:
```bash
ssh -o BatchMode=yes oracle-vm-default 'pg_dump -Fc heuresys_advanced > ~/pg_dump_snapshots/pre-f1-registry_20260603.dump && ls -la ~/pg_dump_snapshots/pre-f1-registry_20260603.dump'
```
Expected: a non-zero-byte dump file listed.

- [ ] **Step 2: Apply the migration**

Run: `bash db/scripts/migrate.sh` (applies 000058; idempotent over the whole set)
Expected: no error; NOTICE `000058: 138 sys tables, 65 UNCLASSIFIED (0 expected after seed 04)` (65 because the seed has not run yet).

- [ ] **Step 3: Apply the seed**

Run: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -1 -f db/seeds/reconciliation/04_registry.sql`
Expected: NOTICE `registry: 65 rows (A:5 B:16 C:23 D:21)`; no EXCEPTION.

## Task 4: Validate (idempotency + closure)

**Files:** none

- [ ] **Step 1: Migration idempotent twice-run**

Run: `bash db/scripts/migrate.sh && bash db/scripts/migrate.sh`
Expected: both succeed, no error (CREATE OR REPLACE / IF NOT EXISTS).

- [ ] **Step 2: Seed idempotent twice-run**

Run: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -1 -f db/seeds/reconciliation/04_registry.sql`
Expected: still 65 rows (ON CONFLICT DO UPDATE — no duplicates); NOTICE 65.

- [ ] **Step 3: Closure assertion via the view**

Run:
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "
SELECT 'unclassified=' || count(*) FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED';
SELECT 'registry=' || count(*) FROM sys.sys_reconciliation_registry;
SELECT reconciliation_registry_bucket, count(*) FROM sys.sys_reconciliation_registry GROUP BY 1 ORDER BY 1;"
```
Expected: `unclassified=0`, `registry=65`, bucket A=5 B=16 C=23 D=21.

- [ ] **Step 4: Structural validation untouched**

Run: `pnpm db:validate`
Expected: 7/7 views PASS (the new registry does not affect the existing validation views).

## Task 5: Integration test

**Files:** Create `apps/api/test/reconciliation-registry.integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from './helpers/build-test-app';
import { getPool } from '../src/db/client';

describe('reconciliation registry (F1)', () => {
  beforeAll(async () => { await buildTestApp(); });
  afterAll(async () => { await getPool().end().catch(() => {}); });

  it('registry holds exactly 65 rows with the signed-off bucket split', async () => {
    const { rows } = await getPool().query(
      `SELECT reconciliation_registry_bucket AS b, count(*)::int AS n
         FROM sys.sys_reconciliation_registry GROUP BY 1`);
    const m = Object.fromEntries(rows.map((r: any) => [r.b, r.n]));
    expect(m).toEqual({ A: 5, B: 16, C: 23, D: 21 });
  });

  it('the view leaves zero UNCLASSIFIED tables', async () => {
    const { rows } = await getPool().query(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'`);
    expect(rows[0].n).toBe(0);
  });

  it('every B row names a structural wall', async () => {
    const { rows } = await getPool().query(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket='B' AND reconciliation_registry_wall IS NULL`);
    expect(rows[0].n).toBe(0);
  });

  it('every A/B row carries a legacy_source', async () => {
    const { rows } = await getPool().query(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket IN ('A','B') AND reconciliation_registry_legacy_source IS NULL`);
    expect(rows[0].n).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd apps/api && pnpm exec vitest run test/reconciliation-registry.integration.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Full API suite green (no regression)**

Run: `cd apps/api && pnpm test`
Expected: previous count + 4 new, 0 failures.

## Task 6: Commit (atomic, no push)

- [ ] **Step 1: Commit**

```bash
git add db/migrations/000058_reconciliation_registry.sql db/seeds/reconciliation/04_registry.sql apps/api/test/reconciliation-registry.integration.test.ts
git commit -m "feat(db): F1 reconciliation registry — sys_reconciliation_registry + v_reconciliation_status, 65 rows classified (S960)"
```
(The gitignored generator in `qa_artifacts/runs/` is not staged.)

---

## Self-Review

- **Spec coverage:** registry table + view (spec §3) — Task 1 ✓. 65 terminal states seeded (spec §1) — Task 2/3 ✓. EXCLUDE for source-backed D — handled via `declared_status=EXCLUDE` in the registry (Task 2 map); no brownfield `EXCLUDE` card is needed because none of the 65 carries a pending `IMPORT` card except `process_kpi_templates` (kept IMPORT, now bucket B — wall resolves it in F3), so there is no pending flow to block ✓. "ambiguous count → 0" (spec §1) — Task 4 Step 3 asserts `unclassified=0` ✓.
- **Placeholder scan:** full DDL, full test, concrete commands, the override map is literal. The seed generator body is described with the decisive override map + declared() function inline (the per-row INSERT emission is mechanical string-building) — not a hand-wave. ✓
- **Type consistency:** column names `reconciliation_registry_*` identical across DDL, function, seed, and test; `declared_status` enum values match the CHECK; bucket letters A/B/C/D match everywhere. The function output columns (`resolved_status`, `has_rows`, …) match the closure query in Task 4. ✓
- **Write-safety:** only DDL on new objects + INSERT into the new registry table. Zero writes to the 65 business tables. Backup precedes apply. ✓
