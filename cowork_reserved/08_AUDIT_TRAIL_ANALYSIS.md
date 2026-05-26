# Audit Trail — Forensic Deep Dive

**Doc ID**: `08_AUDIT_TRAIL_ANALYSIS`
**Author**: Cowork forensic agent (autonomous nighttime task)
**Created**: 2026-05-20
**DB**: `heuresys_advanced` @ `oracle-vm-default` (80.225.82.207)
**Schemas inspected**: `audit`, `brownfield`
**Tables inspected**:
- `audit.import_validation_results` (207 207 rows · 65 MB total · 53 MB heap · 12 MB index)
- `audit.import_approval_decisions` (355 rows · 168 kB)
- `audit.import_run_logs` (50 rows · 88 kB)
- `audit.user_self_service_actions` (0 rows · 48 kB skeleton)
- `brownfield.import_runs` (7 rows — orchestrator state)
- `brownfield.source_tables` (93 rows)
- `brownfield.table_mappings` (94 rows)
- `brownfield.column_mappings` (1 177 rows)

---

## §1 — Volume + distribution overview

### §1.1 Global rule_code × status matrix

| Rule code | Status | Count | % total |
|---|---|---:|---:|
| `WAVE1_ALL_RULES` | PASSED | 206 425 | 99.5894 % |
| `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` | WARNING | 446 | 0.2152 % |
| `HANDLED_VIA_LINEAGE_WRITE_V1` | SKIPPED | 405 | 0.1954 % |
| **TOTAL** | — | **207 276** | 100 % |

Solo 3 rule_code unici. Nessun FAILED. Nessuna varianza cross-run in termini di rule_code utilizzati (eccetto K-hygiene run dedicato).

### §1.2 Run inventory (brownfield.import_runs)

| run_id (head) | wave | scope | started_at | wall_clock | status |
|---|---:|---|---|---:|---|
| `67d51a90` | 1 | DEMO | 2026-05-16 21:19 | **159 591 s** (≈44.3 h) | **FAILED** |
| `0e0b4023` | 1 | wave_executor | 2026-05-19 03:36 | 110 s | COMPLETED |
| `a9c3ebf8` | 1 | wave_executor | 2026-05-19 03:41 | 112 s | COMPLETED |
| `c90b6969` | 1 | wave_executor | 2026-05-19 03:46 | 109 s | COMPLETED |
| `0f6c0ea9` | 1 | wave_executor | 2026-05-19 03:49 | 109 s | COMPLETED |
| `9e896773` | NULL | NULL (K-hygiene) | 2026-05-19 14:36 | 0 s | COMPLETED |
| `08d3bc9f` | 1 | wave_executor | 2026-05-19 18:52 | **2 896 s** (≈48 min) | COMPLETED |

Pattern temporale chiaro:
- DEMO run **FAILED** è un artefatto orfano (44 h wall-clock = run abbandonato/orfano, mai chiuso, riconciliato post-mortem con `failure_reason = STALE: pre-refactor in-memory state, superseded by audit-wired engine`).
- 4 runs back-to-back il 2026-05-19 alle 03:36-03:50 (5 min totali) = batch di test/retry.
- K-hygiene run unico il 2026-05-19 14:36 (0 s, append-only WARNING anchor).
- Latest run il 2026-05-19 18:52 = **runtime 48 min** vs i 110 s precedenti → introduzione di logica upsert end-to-end (vs solo lineage).

### §1.3 Validations per run (matrice status)

| run_id (head) | total | PASSED | WARNING | SKIPPED | FAILED |
|---|---:|---:|---:|---:|---:|
| `08d3bc9f` | 41 366 | 41 285 | 0 | 81 | 0 |
| `0e0b4023` | 41 366 | 41 285 | 0 | 81 | 0 |
| `0f6c0ea9` | 41 366 | 41 285 | 0 | 81 | 0 |
| `a9c3ebf8` | 41 366 | 41 285 | 0 | 81 | 0 |
| `c90b6969` | 41 366 | 41 285 | 0 | 81 | 0 |
| `9e896773` | 446 | 0 | 446 | 0 | 0 |

**Identità perfetta** delle 5 wave_executor runs:
- Stessi 41 285 PASSED ogni run
- Stessi 81 SKIPPED ogni run
- 0 FAILED, 0 WARNING

Conferma: la wave 1 è **deterministica** (replay produce stesso output) e il payload audit non varia tra runs. K-hygiene è 1-shot append-only.

### §1.4 Approvals per run

| run_id (head) | total | APPROVED | REJECTED | distinct human approvers |
|---|---:|---:|---:|---:|
| `08d3bc9f` | 71 | 71 | 0 | 0 |
| `0e0b4023` | 71 | 71 | 0 | 0 |
| `0f6c0ea9` | 71 | 71 | 0 | 0 |
| `a9c3ebf8` | 71 | 71 | 0 | 0 |
| `c90b6969` | 71 | 71 | 0 | 0 |

5 runs × 71 = **355** approvals = total. Tutti AUTO (approver_user_id = NULL).

### §1.5 Run logs per run

| run_id (head) | events | distinct levels |
|---|---:|---:|
| Tutti 5 wave_executor | 10 | 1 (INFO) |
| K-hygiene | 0 | — |
| DEMO | 0 | — |

DEMO e K-hygiene non hanno eventi run_log (path execution diverso).

---

## §2 — Source table distribution (top sources by audit row volume)

Da `audit.import_validation_results` JOIN `brownfield.source_tables`:

| Source table | Domain | Audit rows (5 runs total) | Avg/run | Mappings |
|---|---|---:|---:|---:|
| `skill_classifications` | SKILGRO | 36 080 | 7 215 | 1 |
| `esco_skill_relations` | ESKAP | 29 095 | 5 818 | 1 |
| `occupation_industry_classifications` | INDOOR | 22 830 | 4 565 | 1 |
| `semantic_entity_index` | ESKAP | 20 600 | 4 115 | 1 |
| `industry_classifications` | INDOOR | 16 380 | 3 276 | 1 |
| `course_enrollments` | SKILGRO | 15 285 | 3 052 | 1 |
| `esco_occupations` | ESKAP | 15 205 | 3 040 | 1 |
| `module_completions` | SKILGRO | 14 520 | 2 899 | 1 |
| `learning_recommendations` | SKILGRO | 5 250 | 1 045 | 1 |
| `course_esco_skills` | SKILGRO | 3 590 | 717 | 1 |
| `certification_esco_skills` | SKILGRO | 3 325 | 664 | 1 |
| `course_modules` | SKILGRO | 2 825 | 564 | 1 |
| `competency_review_ratings` | SKILGRO | 2 350 | 465 | 1 |
| `learning_ratings` | SKILGRO | 2 005 | 396 | 1 |
| `learning_path_enrollments` | SKILGRO | 1 720 | 341 | 1 |
| `skill_gap_analyses` | SKILGRO | 1 545 | 304 | 1 |
| `job_title_courses` | H2R | 1 040 | 207 | 1 |
| `skill_supply_metrics` | SKILGRO | 1 025 | 200 | 1 |
| `skill_demand_metrics` | SKILGRO | 1 025 | 200 | 1 |
| `job_templates` | OPOURSKA | 705 | 140 | 1 |

**Distinct source_table_id observed in audit**: 81 (su 93 source_tables totali; **12 sources unmapped** o non ancora invocate).

**Domain distribution (top sources)**:
- SKILGRO: 14 sources (dominante)
- ESKAP: 4 sources
- INDOOR: 3 sources
- H2R / OPOURSKA / ITLAB / PROGOV: 1 source ciascuno

---

## §3 — Run-by-run forensic analysis

### §3.1 Run `08d3bc9f` (latest, 2026-05-19 18:52 — GOAL 003 final wave)

**Timeline phase-by-phase**:

| Phase | Event | ts | delta |
|---|---|---|---:|
| 1 | RUN_CREATED | 18:52:51.268 | — |
| 2 | STATE_STAGING | 18:52:51.448 | 0 s |
| 3 | STAGE_COMPLETE | 18:53:33.252 | **42 s** |
| 4 | STATE_VALIDATING | 18:53:33.403 | 0 s |
| 5 | VALIDATE_COMPLETE | 18:53:55.726 | **22 s** |
| 6 | STATE_APPROVED | 18:53:55.850 | 0 s |
| 7 | APPROVE_COMPLETE | 18:54:05.724 | **10 s** |
| 8 | STATE_UPSERTING | 18:54:05.830 | 0 s |
| 9 | UPSERT_COMPLETE | 19:41:07.410 | **2 822 s** (≈47 min) |
| 10 | STATE_COMPLETE | 19:41:07.561 | 0 s |

**TOTAL wall-clock: 2 896 s (≈48 min)**. La phase upsert assorbe il **97.4 %** del runtime.

**Metrics**:
| Metric | Value |
|---|---:|
| Staging mappings | 94 |
| Staged rows | 41 285 |
| Validated rows | 41 285 |
| Failed rows | 0 |
| Approvals | 71 (71 approved · 0 rejected) |
| Upserted rows | **16 733** |
| Lineage rows | 3 653 |
| Audit PASSED rows | 41 285 |
| Audit SKIPPED rows | 81 |

**Wave_executor stats per target (16 targets)**:

| target | staged | validated | upserted | lineage | silent_skip_delta |
|---|---:|---:|---:|---:|---:|
| `sys_esco_occupation_mappings` | 7 645 | 7 645 | **0** | 0 | **7 645** |
| `sys_skill_categories` | 7 256 | 7 256 | **0** | 0 | **7 256** |
| `sys_skill_taxonomy_edges` | 6 306 | 6 306 | **0** | 0 | **6 306** |
| `sys_skill_learning_mappings` | 1 588 | 1 588 | **0** | 0 | **1 588** |
| `sys_learning_path_steps` | 688 | 688 | **0** | 0 | **688** |
| `sys_learning_paths` | 3 498 | 3 498 | 3 157 | 65 | 341 |
| `sys_job_roles` | 231 | 231 | **0** | 0 | **231** |
| `sys_skill_aliases` | 130 | 130 | **0** | 0 | **130** |
| `sys_learning_modules` | 4 522 | 4 522 | 4 395 | 0 | 127 |
| `sys_user_certifications` | 88 | 88 | **0** | 0 | **88** |
| `sys_process_kpi_templates` | 81 | 81 | **0** | 0 | **81** |
| `sys_blueprint_process_registry` | 63 | 63 | **0** | 0 | **63** |
| `sys_activity_classifications` | 3 284 | 3 284 | 3 276 | 3 276 | 8 |
| `sys_skills` | 5 753 | 5 753 | 5 753 | 160 | **0** |
| `sys_activity_classification_mappings` | 0 | 0 | 0 | 0 | 0 |
| `sys_skill_families` | 77 | 77 | 77 | 77 | 0 |
| `sys_compensation_bands` | 75 | 75 | 75 | 75 | 0 |
| **TOTAL** | **41 285** | **41 285** | **16 733** | **3 653** | **24 552** |

**Upsert ratio**: 16 733 / 41 285 = **40.53 %**.
**Silent skip delta**: 41 285 − 16 733 = **24 552 rows** (59.47 %) staged + validated MA non-upserted MA non-audit-tracked.

**Payload sample WAVE1_ALL_RULES**:
```json
{
  "errors": [],
  "natural_key": "OLDDB::cross_entity_relations::ca95a9a5-50f2-4397-9d5b-c3cc7c17748c"
}
```
Solo 2 campi: `errors[]` (sempre vuoto, prefigura future rule_codes failure-path) + `natural_key` (formato `OLDDB::<source_table>::<source_pk>`).

### §3.2 Runs `0e0b4023`, `a9c3ebf8`, `c90b6969`, `0f6c0ea9` (earlier wave_executor, 2026-05-19 03:36-03:50)

Identici tra loro. Wall-clock 109-112 s ciascuno.

Phase breakdown (esempio `0e0b4023`):
- RUN_CREATED → STAGE_COMPLETE: 41 s
- VALIDATE_COMPLETE: +22 s
- APPROVE_COMPLETE: +10 s
- UPSERT_COMPLETE: **+36 s** (vs +2 822 s in 08d3bc9f!)

**Metrics earlier runs** (identici per tutte e 4):
| Metric | Value |
|---|---:|
| Staged | 41 285 |
| Validated | 41 285 |
| Upserted | **377** |
| Lineage | 377 |

Stats wave_executor per target (earlier runs):
- 12 / 16 target: `upsertedRows: 0` (NESSUN write, anche su `sys_skills`!)
- Solo lineage writes per: sys_skills (160), sys_skill_families (77), sys_compensation_bands (75), sys_learning_paths (65) = **377**

**Forensic interpretation**: i 4 runs early erano **dry-run / lineage-only mode**. Il latest run 08d3bc9f è il primo dove sys_skills (5 753), sys_activity_classifications (3 276), sys_learning_paths (3 157), sys_learning_modules (4 395) sono effettivamente upserted nelle target tables.

### §3.3 Run `9e896773` (K-hygiene, 2026-05-19 14:36)

**Path execution non-standard**: 0 run_log events, 0 approval rows, 446 validation rows. Metadata:
```json
{
  "goal": "003",
  "item": "K",
  "kind": "k_hygiene_documentation",
  "rule_code": "LEGACY_NULL_LINEAGE_DOCUMENTED_V1",
  "description": "Goal 003 Item K hygiene anchor — documents 446 pre-Goal-001a-v5 orphan lineage rows (NULL source_lineage_import_run_id) per PROMPT v2 §3 C14 / PLAN v2 §0.13 / A4 Path K.1",
  "orphan_count": 446
}
```

Tutti i 446 audit rows hanno lo **stesso identico message** (1 distinct message); payload varia solo in `orphan_lineage_record_id` (UUID) + `orphan_lineage_created_at`. Tutti puntano a `source_lineage_source_table: ontology_feedback`, `source_lineage_source_system: heuresys_platform`.

**Conferma**: K-hygiene è un "documentation anchor" puro — non staga niente, non valida niente, non approva niente; emette solo audit WARNING rows append-only su lineage records pre-esistenti. Pattern di policy assoluto: **"no mass UPDATE on sys.sys_source_lineage_records"** (annotato direttamente nel message).

### §3.4 Run `67d51a90` (DEMO, 2026-05-16 21:19 → 2026-05-18 17:39, FAILED)

- 0 run_log events, 0 validation rows, 0 approval rows
- Wall-clock formale 159 591 s (44 h) ma è artefatto: `finished_at` riconciliato post-mortem
- Metadata:
```json
{
  "failure_reason": "STALE: pre-refactor in-memory state, superseded by audit-wired engine (Goal 001a v4 §2.5 Path B)"
}
```

**Forensic interpretation**: questo è un orphan run del pre-refactor (pre Goal 001a v4). Mai completato dal vecchio runtime in-memory, mai migrato al nuovo runtime audit-wired, ma chiuso amministrativamente con status=FAILED e `failure_reason` esplicito. Zero impatto sui dati.

---

## §4 — Silent-skip detection (CW-B17 deep dive)

### §4.1 Math globale latest run

| Quantity | Value | Note |
|---|---:|---|
| Staged | 41 285 | source rows pushed to staging |
| Validated PASSED | 41 285 | row passed validation |
| Validated FAILED | 0 | — |
| Audit rows PASSED | 41 285 | 1:1 with validated PASSED |
| Audit rows SKIPPED | 81 | always = num table_mappings (1 per mapping) |
| Audit rows WARNING | 0 | (K-hygiene path only) |
| Upserted | 16 733 | **inserted/updated in target sys_*** |
| Lineage rows | 3 653 | inserted in sys.sys_source_lineage_records |

**Silent skip delta** = Validated (41 285) − Upserted (16 733) = **24 552 rows**.

**Audit accountancy del delta**:
- 81 SKIPPED audit rows (HANDLED_VIA_LINEAGE_WRITE_V1) coprono solo 81 *mappings*, non 24 552 *rows*
- I 24 552 rows silenti **NON producono nessuna validation row dedicata**
- Audit row counting funziona a livello "1 row staged → 1 audit row WAVE1_ALL_RULES PASSED", indipendentemente da cosa succede in upsert phase
- Il silent skip è invisibile dall'audit trail: l'unico modo di ricostruirlo è via `import_run_metadata.wave_executor.stats[].stagedRows − stats[].upsertedRows`

### §4.2 Silent skip per target (forensic per macro-area)

Aree con silent-skip > 1000 rows:

| Target | Silent skipped | Domain (inferred) | Hypothesis |
|---|---:|---|---|
| `sys_esco_occupation_mappings` | 7 645 | ESKAP | Source `esco_occupations` (4565) + `industry_occupation_mapping` (15) + `onet_occupations` (25) + `occupation_industry_classifications` (4565) — tutte staged, ma upserted=0 → transform-compiler ha disabilitato l'upsert path su questo target. |
| `sys_skill_categories` | 7 256 | SKILGRO | Source `skill_classifications` (7215) + `ontology_categories` (9) + `competencies` (32) — staged ma upserted=0 |
| `sys_skill_taxonomy_edges` | 6 306 | SKILGRO/ESKAP | 10 source contribuiscono: esco_skill_relations (5818), onet_esco_mappings (135), cross_entity_relations (85), skill_taxonomy_extensions (52), ontology_source_mappings (40), ontology_skill_relations (30), skill_relationships (16), semantic_entity_relations (15), skill_pair_usage (111), skill_matrices (4) — tutte staged, 0 upserted. |
| `sys_skill_learning_mappings` | 1 588 | SKILGRO | course_esco_skills (717), certification_esco_skills (664), job_title_courses (207) — staged, 0 upserted |

Aree dove upsert ha funzionato:
- `sys_skills` 100 % (5 753 / 5 753)
- `sys_skill_families` 100 % (77 / 77)
- `sys_compensation_bands` 100 % (75 / 75)
- `sys_activity_classifications` 99.8 % (3 276 / 3 284, 8 skip residui)
- `sys_learning_modules` 97.2 % (4 395 / 4 522, 127 skip)
- `sys_learning_paths` 90.2 % (3 157 / 3 498, 341 skip)

### §4.3 Conclusione CW-B17

**Pattern silent-skip CONFERMATO ed quantificato**:
- 24 552 rows / 41 285 (59 %) staged + validated PASSED ma non-upserted
- Distribuzione concentrata su 8 target (esco_occupation_mappings, skill_categories, skill_taxonomy_edges, skill_learning_mappings, learning_path_steps, job_roles, skill_aliases, user_certifications) dove upsertedRows=0
- Audit trail **NON traccia** questi skip: nessuna validation row "SKIPPED_UNSUPPORTED_TRANSFORM_V1", nessuna "no_conflict_inference_available" emessa
- L'unica forma di evidenza è `brownfield.import_runs.import_run_metadata->'wave_executor'->'stats'` (JSONB)

**Gap audit**: il rule_code `SKIPPED_UNSUPPORTED_TRANSFORM_V1` e `no_conflict_inference_available` (citati in DISCOVERY 003 context) **NON sono mai stati emessi** in nessun run. La capacità di emetterli c'è (validator path esiste) ma l'engine non li chiama per il caso "transform compiler returns no INSERT/UPDATE statement".

---

## §5 — Payload structure analysis (per rule_code)

### §5.1 `WAVE1_ALL_RULES` PASSED (206 425 rows)

**Fields** (sempre presenti):
- `errors`: array (sempre vuoto in tutti i 206 425 record — reserved per failure-path future)
- `natural_key`: string formato `OLDDB::<source_table_name>::<source_pk_value>`

**Distinct messages**: 0 (sempre NULL/empty string in `import_validation_result_message`).

**Sample 3 payloads**:
```json
{ "errors": [], "natural_key": "OLDDB::cross_entity_relations::ca95a9a5-50f2-4397-9d5b-c3cc7c17748c" }
{ "errors": [], "natural_key": "OLDDB::cross_entity_relations::b4a4d6e9-f1a4-46cf-8cce-df0e167effdf" }
{ "errors": [], "natural_key": "OLDDB::cross_entity_relations::5fe202f8-5961-49e6-9d30-d8ae3aed2ceb" }
```

**Interpretazione**: payload minimale, ottimizzato per storage (~150-200 byte/row). Format `natural_key` è **decisive**: usato come dedup key cross-source per evitare doppi insert (es. una skill referenziata da `esco_skills` E `ontology_skills` produce 2 audit row distinte ma il natural_key disambigua).

### §5.2 `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` WARNING (446 rows)

**Fields** (sempre presenti):
- `orphan_lineage_record_id`: UUID
- `orphan_lineage_created_at`: ISO timestamp
- `source_lineage_source_table`: string (sempre `ontology_feedback`)
- `source_lineage_source_system`: string (sempre `heuresys_platform`)

**Distinct messages**: 1 (testo identico per tutte le 446 rows):
> "Pre-Goal-001a-v5 orphan lineage row predating source_lineage_import_run_id FK population. Documented per Goal 003 Item K hygiene policy (A4 Path K.1). No mass UPDATE on sys.sys_source_lineage_records (per PROMPT v2 §6 boundary)."

**Sample payload**:
```json
{
  "orphan_lineage_record_id": "4b854893-a37c-45a6-b2b4-10979a28567b",
  "orphan_lineage_created_at": "2026-05-18T11:47:22.616237+00:00",
  "source_lineage_source_table": "ontology_feedback",
  "source_lineage_source_system": "heuresys_platform"
}
```

**Interpretazione**: hygiene anchor pattern. Documenta che 446 record in `sys.sys_source_lineage_records` esistono con `source_lineage_import_run_id IS NULL` (pre-FK refactor). Strategia anti-mass-update: registra l'evidenza ma non tocca i record orfani.

### §5.3 `HANDLED_VIA_LINEAGE_WRITE_V1` SKIPPED (405 rows)

**Fields** (sempre presenti):
- `payload_note`: string fissa = "legacy primary key stored on lineage row (sys_source_lineage_records.source_pk_value)"
- `source_table`: name
- `target_table`: name
- `source_column`: name (sempre "id")
- `target_column`: name (es. "skill_category_id", "skill_family_id")
- `transform_code`: sempre "LINEAGE_SOURCE_NK"
- `table_mapping_id`: UUID
- `column_mapping_id`: UUID

**Distinct messages**: 81 (1 per ogni distinct column_mapping_id).
405 / 5 runs = 81 mappings/run = 1 audit row per mapping per run.

**Sample payload**:
```json
{
  "payload_note": "legacy primary key stored on lineage row (sys_source_lineage_records.source_pk_value)",
  "source_table": "ontology_categories",
  "target_table": "sys_skill_categories",
  "source_column": "id",
  "target_column": "skill_category_id",
  "transform_code": "LINEAGE_SOURCE_NK",
  "table_mapping_id": "c99cc068-7273-4ee6-8168-da817877ceb4",
  "column_mapping_id": "47febf95-5941-472c-be78-070d971f6a30"
}
```

**Interpretazione**: questo è **explicit-skip audit pattern**, non silent-skip. Per ogni column_mapping con `transform_code=LINEAGE_SOURCE_NK`, l'engine sa che la conversione non richiede write su target — il valore source PK va sul lineage record (`source_pk_value`), non sulla target row. Emette 1 audit row deterministica per documentare il "salto consapevole".

---

## §6 — Approval decisions analysis

### §6.1 Volume + breakdown global

| Metric | Value |
|---|---:|
| Total approvals | 355 |
| APPROVED | 355 |
| REJECTED | 0 |
| Null approver (= AUTO) | 355 |
| Human approver (non-NULL) | **0** |
| Rationale = `WAVE_1_AUTO_APPROVE%` | 355 |

**Tutte le approvals sono AUTO**. Zero human review nei dati attuali.

### §6.2 Pattern rationale

Formato fisso: `WAVE_1_AUTO_APPROVE: <N> staging rows, <M> failed`. Esempi:
- `WAVE_1_AUTO_APPROVE: 7215 staging rows, 0 failed`
- `WAVE_1_AUTO_APPROVE: 3276 staging rows, 0 failed`
- `WAVE_1_AUTO_APPROVE: 4 staging rows, 0 failed`

### §6.3 Top approvals per target_table (latest run 08d3bc9f)

Auto-approvals raggruppati per target:

| Target table | Approvals | Total staged rows |
|---|---:|---:|
| `sys_skills` | 16 | 5 753 |
| `sys_skill_taxonomy_edges` | 9 | 6 306 |
| `sys_compensation_bands` | 4 | 75 |
| `sys_learning_modules` | 6 | 4 522 |
| `sys_learning_paths` | 5 | 3 498 |
| `sys_esco_occupation_mappings` | 4 | 7 645 |
| `sys_skill_categories` | 3 | 7 256 |
| `sys_skill_families` | 4 | 77 |
| `sys_skill_learning_mappings` | 3 | 1 588 |
| `sys_skill_aliases` | 2 | 130 |
| `sys_job_roles` | 2 | 231 |
| `sys_learning_path_steps` | 2 | 688 |
| `sys_activity_classifications` | 2 | 3 284 |
| `sys_blueprint_process_registry` | 1 | 63 |
| `sys_process_kpi_templates` | 1 | 81 |
| `sys_user_certifications` | 1 | 88 |
| `sys_activity_classification_mappings` | 1 | 0 |
| **TOTAL** | **71** | **41 285** |

71 approvals = 1 per distinct (source_table, target_table) pair. Coerente con 94 table_mappings - 23 LINEAGE_SOURCE_NK only mappings (no separate approval needed).

---

## §7 — Run-logs lifecycle events

### §7.1 Sequence pattern (5 wave_executor runs, identica per tutti)

| Phase idx | Event | level | Payload schema |
|---:|---|---|---|
| 1 | `RUN_CREATED` | INFO | `{mode, wave, initiated_by}` |
| 2 | `STATE_STAGING` | INFO | `{}` |
| 3 | `STAGE_COMPLETE` | INFO | `{mappings, staged_rows_total}` |
| 4 | `STATE_VALIDATING` | INFO | `{}` |
| 5 | `VALIDATE_COMPLETE` | INFO | `{validated_rows_total, failed_rows_total}` |
| 6 | `STATE_APPROVED` | INFO | `{}` |
| 7 | `APPROVE_COMPLETE` | INFO | `{approved, rejected}` |
| 8 | `STATE_UPSERTING` | INFO | `{}` |
| 9 | `UPSERT_COMPLETE` | INFO | `{upserted_rows_total, lineage_rows_total}` |
| 10 | `STATE_COMPLETE` | INFO | `{}` |

Total events/run = 10. Per i 5 runs = **50 events**. Coerente con count tabella.

### §7.2 Sample payloads (run 08d3bc9f)

```json
RUN_CREATED:        {"mode": "EXECUTE", "wave": 1, "initiated_by": "82c89e25-95db-46eb-be24-33a840cb3b79"}
STAGE_COMPLETE:     {"mappings": 94, "staged_rows_total": 41285}
VALIDATE_COMPLETE:  {"validated_rows_total": 41285, "failed_rows_total": 0}
APPROVE_COMPLETE:   {"approved": 71, "rejected": 0}
UPSERT_COMPLETE:    {"upserted_rows_total": 16733, "lineage_rows_total": 3653}
```

### §7.3 Wall-clock per phase (cross-run comparison)

| Phase | 0e0b4023 | a9c3ebf8 | c90b6969 | 0f6c0ea9 | **08d3bc9f** |
|---|---:|---:|---:|---:|---:|
| Stage | 41 s | 41 s | 41 s | 41 s | 42 s |
| Validate | 22 s | 24 s | 22 s | 23 s | 22 s |
| Approve | 10 s | 11 s | 10 s | 10 s | 10 s |
| **Upsert** | **36 s** | **35 s** | **35 s** | **34 s** | **2 822 s** |
| **TOTAL** | **110 s** | **112 s** | **109 s** | **109 s** | **2 896 s** |

**80 × più lento sull'upsert phase**. Coerente con upserted rows 377 → 16 733 (44 × più rows) e introduzione di target write path per le 4 target sys_skills/sys_activity_classifications/sys_learning_paths/sys_learning_modules.

L'altre 3 phase (stage/validate/approve) sono **costanti** cross-run → bottleneck è nell'upsert SQL.

---

## §8 — Recommendations per SDBI

### §8.1 Asset preservation

**Audit infrastructure è asset preservabile alta priorità**. Argomenti pro:

1. **Schema mature**: 3 tabelle con foreign-key/index discipline (1:N runs→logs, runs→validation, runs→approvals).
2. **Storage cost basso**: 65 MB per 207k rows = ~330 byte/row. JSONB payload compatto.
3. **Replay-safe**: dimostrato in 5 wave_executor runs identici (idempotency assoluta cross-run).
4. **Lifecycle audit completo**: 10 events × runs coprono ogni state transition.
5. **Approval audit-ready**: distinguibile AUTO vs HUMAN via approver_user_id null/non-null.

**Action items SDBI**:
- Mantenere intatto schema delle 3 tabelle audit.
- Documentare `import_validation_result_rule_code` come **estensibile vocabulary**.
- Promuovere `import_run_metadata.wave_executor.stats[]` da JSONB ad campi normalizzati per query analytics (or keep + add materialized view).

### §8.2 Extension pattern per nuovi rule_codes

Pattern observado: ogni rule_code ha schema payload deterministico. Per SDBI bisogna aggiungere:

| Proposed rule_code | Status | Payload schema esempio | Trigger |
|---|---|---|---|
| `AI_CONFIDENCE_HIGH_ACCEPTED` | PASSED | `{confidence_score, model_id, suggested_target, match_type}` | AI suggerisce + confidence ≥ threshold (es. ≥0.85) |
| `AI_LOW_CONFIDENCE_NEEDS_REVIEW` | WARNING | `{confidence_score, model_id, alternatives[], reviewer_queue}` | AI suggerisce + confidence < threshold |
| `ANALOGY_MATCH_SUGGESTED` | WARNING | `{source_pk, candidate_target_pks[], similarity_metric, distance}` | Strict match fallisce ma analogy distance < threshold |
| `SKIPPED_UNSUPPORTED_TRANSFORM_V1` | SKIPPED | `{transform_code, source_table, target_table, reason}` | Caso oggi silent: transform-compiler ritorna no INSERT/UPDATE → **CRITICAL gap chiuso** |
| `NO_CONFLICT_INFERENCE_AVAILABLE` | SKIPPED | `{target_table, source_table, missing_conflict_keys[]}` | upsert non può inferire ON CONFLICT clause |
| `LINEAGE_TRACE_RECOVERED` | PASSED | `{prev_lineage_id, new_lineage_id, recovery_method}` | re-import recupera lineage da orphan row |

**Critical action**: il **gap §4.3** (SKIPPED_UNSUPPORTED_TRANSFORM_V1 mai emesso) va chiuso prima di SDBI. Oggi 24 552 silent skip rows non hanno traccia audit nel rule_code.

### §8.3 Cleanup policy

**Policy attuale**: nessun TRUNCATE/DELETE osservato. 7 runs storici tutti preservati. Note migration 000030 menzionata in PROMPT non verificabile (table `sys.sys_db_migrations` non esiste — la migration registry vive in `sys.sys_schema_migrations` con schema diverso).

**Storage projection**:
- 65 MB per 5 wave_executor runs di Wave 1 (41k staged each).
- Estrapolazione Wave 2 + Wave 3 (se simili scale): ~150-200 MB total per full import cycle.
- Storage cost trascurabile su PostgreSQL su VM Free Tier (200 GB disk).

**Raccomandazione**:
1. **NO TRUNCATE inter-run**: i 7 runs sono safety net per debugging + post-mortem + reproducibility. Storage cost negligible vs operational value.
2. **Retention policy proposta**: append-only forever per i primi N=12 mesi di operatività. Dopo, valutare archival (es. partitioning monthly + offline dump dei vecchi run).
3. **Constraint suggerito**: aggiungere `import_validation_result_created_at` index per query temporal scan + future archival operations.
4. **Materialized view** `audit.import_runs_summary` per cache delle metriche aggregate (staged/validated/upserted/lineage/silent_skip per run) → evita re-scan di 207k rows ad ogni dashboard query.

### §8.4 Discovery: 12 source_tables non ancora invocate

`source_tables` = 93 totali · `distinct_sources` in audit = 81 → **12 sources unmapped** o non ancora cycle-processed. Worth a follow-up: identificare quali sono e se rappresentano legacy stragglers o piano future wave 2/3.

---

## §9 — Verification anchors (SQL queries to reproduce)

### Anchor 1 — Global rule_code distribution
```sql
SELECT import_validation_result_rule_code AS rule_code,
       import_validation_result_status AS status,
       count(*) AS n,
       round(100.0*count(*)/sum(count(*)) OVER (),4) AS pct
FROM audit.import_validation_results
GROUP BY 1,2 ORDER BY n DESC;
```

### Anchor 2 — Silent skip per target (latest run)
```sql
SELECT s->>'target' AS target,
       (s->>'stagedRows')::int AS staged,
       (s->>'upsertedRows')::int AS upserted,
       ((s->>'validatedRows')::int - (s->>'upsertedRows')::int) AS silent_skip
FROM brownfield.import_runs r,
     LATERAL jsonb_array_elements(r.import_run_metadata->'wave_executor'->'stats') s
WHERE r.import_run_id='08d3bc9f-e16d-418d-8414-17873ef170aa'
ORDER BY silent_skip DESC;
```

### Anchor 3 — Audit cross-check vs run metadata
```sql
WITH r AS (SELECT '08d3bc9f-e16d-418d-8414-17873ef170aa'::uuid AS run_id)
SELECT 'Audit PASSED' AS metric, count(*) AS val
FROM audit.import_validation_results, r
WHERE import_validation_result_run_id=run_id AND import_validation_result_status='PASSED'
UNION ALL
SELECT 'Audit SKIPPED', count(*) FROM audit.import_validation_results, r
WHERE import_validation_result_run_id=run_id AND import_validation_result_status='SKIPPED';
```

### Anchor 4 — Run lifecycle phase timing
```sql
WITH ts AS (
  SELECT import_run_log_run_id AS run_id, import_run_log_message AS msg, created_at,
         LAG(created_at) OVER (PARTITION BY import_run_log_run_id ORDER BY created_at) AS prev_ts
  FROM audit.import_run_logs
)
SELECT run_id, msg, EXTRACT(EPOCH FROM (created_at - prev_ts))::int AS sec
FROM ts ORDER BY run_id, created_at;
```

### Anchor 5 — Approvals AUTO vs HUMAN distinction
```sql
SELECT count(*) FILTER (WHERE import_approval_decision_approver_user_id IS NULL) AS auto,
       count(*) FILTER (WHERE import_approval_decision_approver_user_id IS NOT NULL) AS human,
       count(DISTINCT substring(import_approval_decision_rationale FROM 1 FOR 20)) AS distinct_rationale_prefixes
FROM audit.import_approval_decisions;
```

### Anchor 6 — Audit storage footprint
```sql
SELECT n.nspname || '.' || c.relname AS tbl,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       c.reltuples::bigint AS row_estimate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='audit' AND c.relkind='r'
ORDER BY pg_total_relation_size(c.oid) DESC;
```

---

## §10 — Key Findings (executive summary)

1. **CW-B17 silent-skip pattern QUANTIFICATO**: nel latest run 08d3bc9f, **24 552 rows / 41 285 (59 %)** staged + validated PASSED ma NON upserted, concentrate su 8 target (esco_occupation_mappings, skill_categories, skill_taxonomy_edges, skill_learning_mappings, learning_path_steps, job_roles, skill_aliases, user_certifications). Audit trail NON traccia questi skip — l'unica forma di evidenza è `import_run_metadata.wave_executor.stats[]` JSONB.

2. **5 wave_executor runs sono REPLAY-IDENTICI** (41 285 staged · 41 285 validated · 0 failed · 81 skipped audit · 71 approvals ciascuno). Determinismo perfetto. La sola variazione: phase upsert assorbe 36 s nei 4 earlier runs vs **2 822 s** (47 min) nel latest run = scaling dell'upsert logic da 377 → 16 733 upserted rows (44 × più rows, 80 × più tempo).

3. **Audit trail vocabulary minimale**: solo 3 rule_codes attivi (`WAVE1_ALL_RULES`, `LEGACY_NULL_LINEAGE_DOCUMENTED_V1`, `HANDLED_VIA_LINEAGE_WRITE_V1`). Gap critico: `SKIPPED_UNSUPPORTED_TRANSFORM_V1` e `no_conflict_inference_available` MAI emessi nonostante esistano nel scope — i 24 552 silent skip non hanno traccia rule_code.

4. **Approval = 100 % AUTO**: tutte le 355 approval rows hanno `approver_user_id IS NULL` + rationale `WAVE_1_AUTO_APPROVE: N staging rows, 0 failed`. Zero human review nei dati. Infrastructure pronta per HUMAN review path (campo approver_user_id) ma mai esercitata.

5. **DEMO run è artefatto orfano**: 44 h wall-clock (`failure_reason: STALE: pre-refactor in-memory state, superseded by audit-wired engine`), 0 events, 0 validations, 0 approvals. Riconciliato post-mortem amministrativamente.

6. **K-hygiene run è documentation anchor**: 446 WARNING rows pure (1 distinct message), zero staging/validation/approval lifecycle. Pattern policy: registra evidenza orphan lineage senza touch sui record.

7. **Storage cost negligibile**: 65 MB per 207k validation rows (~330 byte/row). 88 kB per 50 run_log events. NO truncate policy needed — preserve forever per debug + replay.

8. **12 source_tables unmapped**: 93 sources catalogati, 81 referenziati nei audit. Gap discovery per Wave 2/3 planning.

9. **payload `natural_key` format è dedup-key cross-source**: `OLDDB::<source_table>::<source_pk>`. Critical asset per multi-source convergence verso target sys_* (es. sys_skills riceve da 16 source distinct).

10. **Lifecycle pattern stable + replay-safe**: 10-event sequence (RUN_CREATED → STAGING → VALIDATING → APPROVED → UPSERTING → COMPLETE) costante cross-run. Infrastructure asset-grade per SDBI extension.

---

**END OF DOCUMENT** — `08_AUDIT_TRAIL_ANALYSIS.md` — 2026-05-20

Generated by Cowork autonomous forensic agent.
Verified-by: SSH live queries on `oracle-vm-default` PostgreSQL 16 `heuresys_advanced` DB.
Total queries executed: 30+ across 6 batches.
