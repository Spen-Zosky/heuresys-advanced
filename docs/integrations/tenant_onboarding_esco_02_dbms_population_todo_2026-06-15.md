# TODO — Miglior popolamento del DBMS (Tier 1-3)

> **Status**: PLAN — per esecuzione successiva su go di Enzo. Read-only doc (nessuna migration creata/applicata qui).
> **Data**: 2026-06-15 · **Deriva da**: `01_coherence_report_2026-06-15.md` · **Spec dettagliate**: file `03` (ESCO) + `04` (tenant onboarding).
> **Vincoli trasversali (tutti gli item)**: conformi invarianti `CLAUDE.md` (I1 position-centric · I3/I4 `sys.sys_<plural>` · I5 tenant filter no-RLS · RD-08 varchar+CHECK no-ENUM · RD-09 date/timestamptz · I12/ADR-0023 dati synthetic no-PII) · migration idempotente next-number da **`000118`** (ultima su disco = `000117`) · **DoD LIVE**: ogni item chiude SOLO con dimostrazione live su dati reali su **tenant di TEST** (output reale allegato: comando + output + path + timestamp). Mai mock/green-test. Secret/approval mancante → `blocked-on-Enzo`.

---

## Legenda

- **Tier 1** = sblocca i due documenti, basso rischio, fonte dati disponibile.
- **Tier 2** = completa il flusso, rischio medio (richiede decisione di modeling).
- **Tier 3** = il motore generativo, multi-sessione, gated.
- **Effort** = stima grezza token/ore CLI, da riconfermare con i 5 criteri R20 prima del go.

---

## Tier 1 — popolamenti abilitanti

| # | Item | Azione | Fonte dati | Idempotenza | Test | DoD live | Dipendenze | Rischio | Effort |
|---|---|---|---|---|---|---|---|---|---|
| **T1.1** | Backfill gerarchia ESCO skill (DT-B) | popolare `skill_metadata->>'skill_group_uri'` + `broader_uri` sui 14.011 skill con `skill_esco_uri` | API ESCO live `/resource/skill?uri=` **via `reference-sync` server-side** (estendere `esco-connector.ts`) OPPURE dump SKOS-TTL | UPSERT per `skill_esco_uri`; re-run idempotente (hash-skip via `brownfield.source_watermarks`) | vitest fixture-based + verifica `count(skill_group_uri)>0` | query live: `SELECT count(*) FROM sys.sys_skills WHERE skill_metadata->>'skill_group_uri' IS NOT NULL` ≫ 0 + sample 5 skill→gruppo coerenti con portale ESCO | nessuna (connector esiste) | MED | ~40-60k |
| **T1.2** | Import occupation→skill (DT-C) | promuovere il dump legacy 126.051 righe da `REFERENCE_ONLY` a nuova tabella `sys.*` | `db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupation_skills.sql` (67.600 essential + 58.451 optional) | seed deterministico `ON CONFLICT DO NOTHING`; `uuid_generate_v5` RFC-4122 per PK derivata | vitest integration (counts essential/optional, FK integrity) + db:validate 7/7 | query live: nuova tabella popolata con N righe = source; sample occupation→skill verificato vs legacy | decisione schema (vedi `03` §2) | MED | ~50-80k |
| **T1.3** | Valorizzare `sys_enterprise_typing_profiles` (DT-A) | wire RTL_BANK + HEURESYS: `enterprise_typing_industry_class_id`→`sys_activity_classifications` + `size_band_id` + `operating_model_id` + `employee_count` | dato reale tenant (RTL=FIN_BANKING/M; HEU=S) + catalogo classificazioni esistente | seed/migration idempotente `ON CONFLICT (tenant) DO UPDATE` | vitest integration (profilo non-NULL per i 2 tenant) | query live: `SELECT tenant, industry_class_id, size_band_id FROM sys.sys_enterprise_typing_profiles` → FK valorizzati, JOIN a classification risolve | nessuna | LOW | ~25-40k |

## Tier 2 — completamento flusso

| # | Item | Azione | Fonte dati | Idempotenza | Test | DoD live | Dipendenze | Rischio | Effort |
|---|---|---|---|---|---|---|---|---|---|
| **T2.4** | Classificazione skill hard/soft/conoscenze (DT-D) | mappare le 21.939 skill (non 31) usando `skill_type` ESCO (skill/knowledge) già in `skill_metadata` + categorie | `skill_metadata->>'skill_type'` (14.036 popolati) + `sys_skill_categories` | UPSERT `skill_category_id` deterministico | vitest (coverage categorie ≫ 31) | query live: `count(skill_category_id) ≫ 31`; distribuzione per categoria | T1.1 (gruppo) opzionale | MED | ~40-60k |
| **T2.5** | Assegnazione OU↔processi (lacuna F1) | nuova tabella join `sys.sys_organization_unit_processes` (o equivalente) conforme I3/I4 + popolamento dai blueprint | `sys_blueprint_process_registry` (23) + `sys_organization_units` (26) | migration idempotente + seed `ON CONFLICT` | vitest integration + tenant-isolation (I5) | query live: join OU↔processo popolato per RTL_BANK | decisione semantica Enzo (cardinalità) | MED | ~40-60k |
| **T2.6** | Cluster skill per ruolo/OU/processo (lacuna F3) | tabella/aggregato derivato skill→gruppo per le 3 dimensioni | dipende da T1.1 (skill→gruppo) + PSR (844) + assignment | view/MV o tabella derivata idempotente | vitest (cluster non vuoti) | query live: cluster per 1 ruolo RTL coerente | **T1.1** | MED | ~50-70k |

## Tier 3 — motore generativo (multi-sessione, gated)

| # | Item | Azione | Fonte | Idempotenza | Test | DoD live | Dipendenze | Rischio | Effort |
|---|---|---|---|---|---|---|---|---|---|
| **T3.7** | Motore AI-augmented del reference environment (#9 WI-C `tenant-materialization`) | modulo `tenant-materialization` (POST `/v1/tenant-materialization`, PLATFORM_ADMIN, dry-run/plan→apply) che genera org/positions/skill/KPI da NACE+size | catalogo blueprint + recommender typing→variant (D3, rinviato) | upsert idempotente `ON CONFLICT`, modella `seed-reference-bank.ts` | integration + adversarial (M-2 write-gate) | E2E live: materializzazione di 1 tenant TEST end-to-end (generate→plan→apply) con output reale | ⛔ gate #9: `ANTHROPIC_API_KEY` SDK-valida · go migration-apply · approval write | HIGH | multi-sessione |
| **T3.8** | Grafico "Skills Group Share" (File 1) | endpoint `/v1/analytics/skill-group-share` (server-side, legge DB) + pagina `EChartsCard` torta | DB post-T1.1/T1.2 | — | integration + Playwright E2E live | E2E: torta renderizza % skill-per-gruppo per 1 occupazione reale | **T1.1 + T1.2** | LOW-MED | ~40-60k |

## Sequenza consigliata

```
T1.3 (LOW, indip.)  ─┐
T1.1 (connector) ────┼─► T2.4, T2.6, T3.8 (dipendono da T1.1)
T1.2 (import) ───────┘    T2.5 (indip., decisione cardinalità)
                          T3.7 (gated su #9 — ultimo)
```

## NON fare (esplicito)

- **NON** creare `nace_classification` ltree fuori da `sys.*` (viola I3/I4 — vedi report §2.2). La gerarchia NACE/ATECO è già `sys_activity_classifications` adjacency-by-code + crosswalk 5730.
- **NON** introdurre Neo4j / `neo4j-admin` (stack assente; il grafo è `graphify`, esterno al repo).
- **NON** fetch ESCO client-side dal browser (`NEXT_PUBLIC_ESCO_API`): viola LIVE-DATA doctrine. Ingestion server-side via `reference-sync`, serving via `/v1/*`.
- **NON** committare nulla finché Enzo non dà il go (questi doc sono staging).
