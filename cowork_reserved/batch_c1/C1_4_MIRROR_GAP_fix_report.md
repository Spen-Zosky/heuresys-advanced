# C1.4 — Class C MIRROR GAP fix: completed ✅

**Executed**: 2026-05-20T16:30Z via SSH on oracle-vm-default
**By**: Cowork sandbox (autonomous, no CLI required for this step)

## Outcome

| Table | Before | After | Source (platform) | Match |
|---|---|---|---|---|
| `legacy_mirror.esco_skills` | 0 | **14011** | 14011 | ✅ |
| `legacy_mirror.business_processes` | 0 | **26** | 26 | ✅ |
| `legacy_mirror.industry_ccnl_mapping` | 0 | **14** | 14 | ✅ |
| `legacy_mirror.tenant_industry_classifications` | 4 (preexisting) | 4 | 4 | ✅ |

**Total restored**: 14051 rows.

## Method

1. `pg_dump --data-only --no-owner --no-privileges -t public.<table> -d heuresys_platform` (no `--inserts`, COPY format)
2. `sed 's/public\.<table>/legacy_mirror.<table>/g'`
3. `psql -d heuresys_advanced -f` — COPY FROM stdin format applied successfully

Note: initial attempt with `--column-inserts --rows-per-insert=1000` format causò parsing error (`trailing junk after numeric literal`) — passaggio a COPY format risolto.

## Implication

I 4 MIRROR GAPS critici identificati in F10/F2b ora chiusi. SDBI workflow (Opt3 Phase 2/3) può ora leggere da:
- `legacy_mirror.esco_skills` (14k rows ESCO skills taxonomy) — finalmente disponibile per skill enrichment di sys_skills (attualmente 6037, può crescere significativamente)
- `legacy_mirror.business_processes` (26 rows) — finalmente disponibile per sys_blueprint_process_registry cascade prereq (Goal 003 INFEASIBLE potenzialmente unlockable)
- `legacy_mirror.industry_ccnl_mapping` (14 rows) — sys_activity_classification_mappings target previously empty può ora popolarsi

## Action items per CLI Batch X1 (downstream)

Nessuna azione richiesta CLI per questo fix. Effetto è già LIVE su DB.
La prossima Wave 1 retry (CLI batch X1) raccoglierà automaticamente questi nuovi data via brownfield.column_mappings esistenti (per esco_skills 29 mapping presenti, per business_processes 11, per industry_ccnl_mapping 7).

## Verification anchor

```sql
SELECT 'esco_skills', COUNT(*) FROM legacy_mirror.esco_skills;            -- 14011
SELECT 'business_processes', COUNT(*) FROM legacy_mirror.business_processes; -- 26
SELECT 'industry_ccnl_mapping', COUNT(*) FROM legacy_mirror.industry_ccnl_mapping; -- 14
```
