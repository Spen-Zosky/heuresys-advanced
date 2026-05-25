# PROMPT 023 — CLI Batch X19 (Brownfield Wave 1 full-47k SQL-side upsert)

**Goal ID**: 023 · **Slug**: `batch_x19_brownfield_wave1_full_47k_sql_upsert`
**Origin**: residual MVP-3 Tappa D (known issue X11+, deferred ripetutamente). Cowork C19 Enzo decision "voglio tutto e subito" — chiude Brownfield Wave 1 in scope dedicato.
**Expected duration**: 2-3h CLI
**Predecessor**: REPORT 022 (X18 close pragmatic). HEAD origin/main `82a30a1`.
**Scope**: completare 47k records SQL-side upsert da `legacy_mirror.*` → `sys.*` per Wave 1 IMPORT mappings (15 sys.* targets), risolvendo il residual issue di Tappa D.
**Out of scope**: refactor engine, new ADR, MVP-3 Tappa F /showcase (DEFER-F separato).

---

## §0 — Identity + context

You are Claude Code CLI. Sessione fresca, no inherited Cowork context except this PROMPT + reference files §9.

**Background**: brownfield import engine ha completato Wave 1 staging (`staging.brownfield_*` ~47k rows) + validation (CW-B49 patch X10) + approval. Engine upsert step ha FILTRO che escludeva mappings nuove (CW-B49 mitigation X10: `upsert-sql.ts` split-on-COALESCE patch + 4 unit tests). Issue residual: il full 47k execution non è stata mai re-runned end-to-end con engine post-patch — staging exists ma `sys.*` target tables sono populated solo ~45% (60/134 tables).

Pre-condition critica: DB live state (post-X16): 60/134 sys.* tables populated. Target post-X19: ≥75/134 (oltre 56%, includendo Wave 1 mappings restanti).

---

## §1 — Pre-flight live-state

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW(), version()" 2>&1 | head -5

cd /d/heuresys-advanced
git log --oneline -3   # expected HEAD: 82a30a1 or descendant
git status --short     # baseline note: pre-existing modifications out-of-scope X19

# DB baseline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced <<SQL
SELECT 'sys.sys_users count' AS metric, COUNT(*)::text AS val FROM sys.sys_users
UNION ALL SELECT 'sys.* populated tables', (
  SELECT COUNT(*) FROM information_schema.tables t
  WHERE t.table_schema='sys'
    AND EXISTS (SELECT 1 FROM pg_class c WHERE c.relname=t.table_name AND c.reltuples>0)
)::text
UNION ALL SELECT 'staging.brownfield_* rows', (
  SELECT COALESCE(SUM(n_live_tup),0) FROM pg_stat_user_tables WHERE schemaname='staging' AND relname LIKE 'brownfield_%'
)::text
UNION ALL SELECT 'brownfield.table_mappings IMPORT count', (
  SELECT COUNT(*) FROM brownfield.table_mappings WHERE classification='IMPORT'
)::text
UNION ALL SELECT 'brownfield.import_runs latest status', (
  SELECT import_run_status FROM brownfield.import_runs ORDER BY started_at DESC LIMIT 1
)::text;
SQL
```

### HALT P0 conditions
| Trigger | Action |
|---|---|
| SSH tunnel down + can't establish | HALT, instruct Enzo manual `ssh -fN -L 5433:...` |
| `sys.sys_users < 430` | HALT P0 CRITICAL (regression R-A2 gate) |
| HEAD ≠ descendant of `82a30a1` | HALT, CW-B52 staleness |
| `brownfield.import_runs` latest status = `IN_PROGRESS` da > 2h | HALT, investigate stale run |

---

## §2 — Main work: execute full Wave 1 upsert

### Block A — Engine state verification

```bash
cd /d/heuresys-advanced/apps/api
# Verifica engine + upsert-sql.ts CW-B49 patch present
grep -n 'split.*COALESCE\|CW-B49' src/brownfield/upsert-sql.ts 2>&1 | head -5
# Verifica tests pre-X19 baseline
pnpm exec vitest run test/brownfield/ 2>&1 | tail -10
# expected: 4 unit tests CW-B49 PASS + altri tests brownfield PASS
```

### Block B — Trigger full Wave 1 upsert

CLI deve identificare entrypoint engine corretto. Probabili candidati (verifica con grep):
```bash
grep -rn 'wave_1\|wave1\|wave_id.*=.*1' apps/api/src/brownfield/ | head -10
grep -rn 'export.*function.*upsert\|export.*function.*runWave' apps/api/src/brownfield/ | head -10
```

Identificato entrypoint (es. `runUpsertWave(waveId: number)` o equivalent):
```bash
# Trigger via CLI script o tsx ad-hoc
cd /d/heuresys-advanced
tsx -e "import('./apps/api/src/brownfield/<entrypoint>').then(m => m.runUpsertWave(1).then(r => console.log(JSON.stringify(r,null,2))))" 2>&1 | tee qa_artifacts/x19_brownfield_wave1_run.txt
# OR via existing npm script if available
```

Se entrypoint non chiaro: HALT P0, identifica + propone in halt notify.

### Block C — Verifica esito

```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced <<SQL
-- Post-upsert sys.* populated count
SELECT 'sys.* populated tables post' AS metric, COUNT(*) AS val
FROM information_schema.tables t
WHERE t.table_schema='sys'
  AND EXISTS (SELECT 1 FROM pg_class c WHERE c.relname=t.table_name AND c.reltuples>0);

-- Wave 1 specific: row counts per sys.* IMPORT target
SELECT m.target_table, m.classification,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = m.target_table AND table_schema='sys') AS table_exists,
       (CASE WHEN m.target_table IS NOT NULL THEN (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname=m.target_table AND schemaname='sys') END) AS row_count
FROM brownfield.table_mappings m
WHERE m.wave_id = 1 AND m.classification = 'IMPORT'
ORDER BY m.target_table;

-- Audit run
SELECT import_run_status, started_at, finished_at, total_rows_upserted, total_errors
FROM brownfield.import_runs ORDER BY started_at DESC LIMIT 1;

-- R-A2 regression check
SELECT 'sys.sys_users post' AS metric, COUNT(*) AS val FROM sys.sys_users;
SQL
```

### Block D — Acceptance gates

- ≥75/134 sys.* tables populated (target soft, hard floor 60/134 mantenuto)
- Wave 1 mappings IMPORT classification → ≥12/15 target tables populated con row_count > 0 (3 misclassified ammessi residual, vedi CW-B50 X11)
- `import_runs` latest record: `import_run_status = 'COMPLETED'` o `'COMPLETED_WITH_ERRORS'` (NOT `FAILED`)
- `total_errors` < 10% del `total_rows_upserted` (tolerance ragionevole per brownfield messy data)
- R-A2: `sys.sys_users = 433` (NO REGRESSION)
- vitest brownfield suite: 0 regression (≥4 CW-B49 tests PASS + altri brownfield)

---

## §3 — Block E — REPORT + commit

```bash
cd /d/heuresys-advanced
git add qa_artifacts/x19_brownfield_wave1_run.txt \
        cowork_code_exchange/_01_PROMPT_023_batch_x19_brownfield_wave1.md \
        cowork_code_exchange/_04_REPORT_023_batch_x19.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md

git commit -m "feat(db): MVP-3 Tappa D residual — Brownfield Wave 1 full-47k SQL-side upsert (N/15 IMPORT targets populated, sys.* M/134)"
```

REPORT format `_04_REPORT_023_batch_x19.md` sezioni §0-§9 standard (pre-conditions, Block A-E outcomes, bias updates, next-step C19+, halt status, HANDOFF refresh).

---

## §4 — Halt + critical thinking

- HALT P0 catastrophic: SSH tunnel down, R-A2 regression, engine entrypoint not findable, DB lock conflicts
- HALT P1 (handoff): row_count target multi-table sotto soglia per ≥4 IMPORT mappings (indica engine logic gap residual oltre CW-B49)
- Critical thinking ATTIVO: se durante upsert vedi pattern anomali (es. ON CONFLICT non triggera, FK violations sistematiche, ecc.), halt + REPORT §6 spec improvement candidate (probabilmente CW-B60+ atomic)

---

## §5 — Out of scope X19

- MFA login-gating (PROMPT 024)
- DEFER-F /showcase Next 15 fix (PROMPT 025)
- Dependabot CVE updates (PROMPT 026)
- Wave 2/3 (future ADR)
- Engine refactor (future ADR)

---

## §6 — Reference

| Path | Purpose |
|---|---|
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` | canonical Wave 1 scope |
| `apps/api/src/brownfield/upsert-sql.ts` | CW-B49 patched |
| `apps/api/test/brownfield/` | vitest baseline |
| `brownfield.table_mappings` (DB) | classification IMPORT/REFERENCE_ONLY |
| `brownfield.import_runs` (DB) | audit trail |

---

*End PROMPT 023 — single-batch X19. Reference X10 CW-B49 + X11 CW-B50 (misclassified mappings) per historical context.*
