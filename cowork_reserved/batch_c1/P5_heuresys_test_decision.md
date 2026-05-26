# P-5 heuresys_test inspection + decision (CORRECTED)

**Snapshot iniziale**: 2026-05-20T16:25Z
**Correction post-Enzo-feedback**: 2026-05-20T17:00Z

## ⚠️ CORRECTION

La conclusione iniziale ("heuresys_test = snapshot di heuresys_platform, usabile come sandbox SDBI") **è SBAGLIATA**. Verifica empirica rivela divergenze materiali.

## §1 — Equivalence audit (deep)

| Metric | heuresys_test | heuresys_platform | Verdict |
|---|---|---|---|
| **Migrations applied** | 215 | **240** | ❌ -25 missing |
| **Last migration** | `0002_phase13_dashboard_engine` (2026-05-07) | `phase18u_rls_null_safe_policies` (2026-05-14) | ❌ **7 giorni stale** |
| public tables | 573 | 582 | -9 |
| public views | 109 | 110 | -1 |
| `kg_edges` (knowledge graph edges) | **0** | 139451 | ❌ ESKAP KG missing |
| `kg_nodes` | 0 | 17260 | ❌ |
| `employee_skill_assessments` | **480** | 3140 | ❌ -85% (S35.3_M9 gokmer assessments missing) |
| `goals` | 1068 | 1067 | ⚠️ data drift +1 |
| `users` | 274 | 274 | ✅ |
| `tenants` | 4 | 4 | ✅ |
| `employees_core` | 270 | 270 | ✅ |
| `job_kpis` | 2000 | 2000 | ✅ |
| `performance_reviews` | 292 | 292 | ✅ |

## §2 — Diagnostica gap

Le 25 migrations missing nel test (applicate solo in platform 2026-05-11 → 2026-05-14):

- `phase18f_eskap_knowledge_graph` — ESKAP knowledge graph (kg_edges + kg_nodes scaffold + populate)
- `phase18d/e/g/h/i_*` — Italian Labor extension + regulatory frameworks + audience persona + smartfood + econova enrichment
- `phase18k_heuresys_succession_scaffold` — Heuresys tenant succession scaffold
- `phase18l_strip_mock_identities` — mock identity cleanup
- `phase18m/n/o_widget_*_binding` — widget API/employee_context/profile_capability binding
- `phase18p_process_presets_v2` — process presets v2
- `phase18q_mv_rbac_matrix` — RBAC matrix mat view
- `phase18r/s/t/u` — RBAC widget repoint + skill assessments indexes + audit_logs indexes + RLS null-safe policies
- `S35.3_M*_*` series — CASCADIA RTL_BANK seeding (taxonomy + positions + process blueprint + KPIs + gaussian assessments)

## §3 — Implicazione critica

`heuresys_test` è snapshot **STALE pre-phase18-S35.3** (~2026-05-07).

**Usarlo come sandbox SDBI introdurrebbe regressioni inevitabili**:
1. Lavoreremmo su schema MISSING ESKAP knowledge graph → mapping SDBI per kg_edges/kg_nodes farebbero "0 rows" su test ma 139k+17k su platform → workflow validation falsa
2. CASCADIA RTL_BANK seed-data assente → tenant-scoped mapping cards diverse vs production
3. RBAC matrix mat view assente → permission queries diverse
4. RLS policies versione vecchia → cross-tenant boundary check potrebbero behavior diff

**Conflitti potenziali post-promotion test→platform**:
- Nuove tabelle/colonne aggiunte da phase18 NON considerate nel mapping SDBI
- Data drift `goals` (+1 row in test) suggerisce che test riceve WRITE indipendenti — non è pure snapshot

## §4 — Decision RIVISTA

**heuresys_test = NON USARE come sandbox SDBI.**

**Alternative valutate**:

| Opzione | Pro | Contro | Effort |
|---|---|---|---|
| **A. Clone fresh da heuresys_platform** (`CREATE DATABASE heuresys_sdbi WITH TEMPLATE heuresys_platform`) | Snapshot current + isolated | Disk usage ~1112 MB extra | 5-10 min creazione |
| **B. Schema `temp_sdbi` dentro heuresys_advanced** | Lineage continuity + temp_ → sys_ promotion semplice | Risk pollution heuresys_advanced se SDBI workflow ha bugs (mitigated by TRUNCATE policy) | 0 (just CREATE SCHEMA) |
| **C. Refresh heuresys_test** (pg_dump platform → restore in test) | Mantiene namespace test esistente | Effort + downtime su test | 30-60 min |
| **D. Cross-DB read via dblink/postgres_fdw** | Zero copy, sempre current | Setup FDW complesso + cross-DB performance | 1-2h setup |

**Raccomandazione corretta**: **Opzione B (schema temp_sdbi in heuresys_advanced)**, perché:
1. ✅ Lineage continuity con `sys.sys_source_lineage_records` esistente (4099 rows)
2. ✅ Promotion temp_sdbi.X → sys.X via INSERT...SELECT semplice
3. ✅ Audit infrastructure (`audit.import_validation_results`) già wired
4. ✅ Zero downtime, zero new database
5. ⚠️ Rischio pollution mitigato via:
   - `BEGIN ... ROLLBACK` per workflow validation iniziale
   - `TRUNCATE temp_sdbi.X` policy idempotent re-run
   - Schema temp_sdbi isolated da sys.* (no FK cross-schema verso sys.*)
6. Source data: legge direttamente da `legacy_mirror.*` (già in heuresys_advanced, già populated post C1.4) — no cross-DB needed per Goals/OKRs e altri Tier D che SONO già in legacy_mirror (post extract-script extension)

**Per data NOT in legacy_mirror** (es. Goals/OKRs da platform.public): serve estendere extract-wave1-legacy.sh con nuovo dominio GOKMER (Phase 2 SDBI authoring) prima.

## §5 — heuresys_test fate

**Decisione**: ignorarlo. Non droppare (potrebbe avere data storica utile), ma non usarlo per workflow attivi. Treatment "frozen archive snapshot 2026-05-07".

**Action items**:
- ❌ NON usare come sandbox SDBI
- ❌ NON usare come source SDBI
- ⚠️ Documentare nel KB che è stale
- Future: se serve cleanup disk, valutare drop dopo conferma archivio backup esiste altrove

## §6 — Update raccomandazioni Opt3 downstream

Effetto su Phase 2 SDBI authoring (Goals/OKRs pilot):
- **temp_ schema location**: confirmed `heuresys_advanced.temp_sdbi.*`
- **Source**: `legacy_mirror.*` per data già imported, `heuresys_platform.public` cross-DB per data non in mirror (richiede extract-script-extension prima)
- **Validation environment**: usa `heuresys_advanced` direct con TRUNCATE-and-retry pattern, not separate sandbox DB

## §7 — Acknowledgment Enzo

Hai sollevato il dubbio critico al momento giusto. Senza la tua domanda, avrei procedutto con heuresys_test come sandbox SDBI introducendo regressioni significative durante Phase 2/3. CW-B21 candidate identified:

**CW-B21**: "Snapshot equivalence assumption" — assumere che un secondo DB con stesso nome di pattern + size simile sia equivalente al source primario. Mitigation: empirical migration count + data freshness check obbligatorio prima di proporre come sandbox.

---

*End P5 decision CORRECTED*
