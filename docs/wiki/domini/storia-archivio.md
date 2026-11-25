---
dominio: storia-archivio
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Che cosa è stato ritirato e da dove si recupera; il brownfield e il legacy come storia
fonti: [docs/piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv, docs/archive/SOT_BACKLOG_CHIUSI.md, docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md]
concetti: [ritiro, legacy, brownfield]
---

# Storia e archivio

## Com'è oggi

- Questa pagina non ha contenuto proprio: dice che cosa è uscito dal repo e come si recupera.
- I documenti superati escono dal repo con `python3 docs/kb/tools/ritira_documenti.py`: copia con impronta nel cestino della cartella del progetto, `git rm`, riga nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv) con il commit di main da cui si recupera (`git show <commit>:<percorso>`).
- Una citazione da un archivio, da una migrazione applicata o da un registro chiuso è storia e non trattiene un documento (sezione 10 del piano di riordino).
- Il brownfield e il legacy `heuresys-evo` sono storia (ADR-0038): si consultano per i concetti, mai per le righe; nel legacy la persona è `employees` (ADR-0024, [dottrina](../../brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md)).
- Le voci chiuse del backlog stanno in [SOT_BACKLOG_CHIUSI](../../archive/SOT_BACKLOG_CHIUSI.md).

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0012](../../architecture/adr/0012_brownfield_table_mapping_wave_column.md) | Brownfield Wave Assignment: Dedicated Column on `table_mappings` | Accepted |
| [0014](../../architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md) | SDBI: Semantic-Driven Brownfield Import (complement to ETL brownfield) | ACCEPTED |
| [0017](../../architecture/adr/0017_lookup_fk_2hop_transform.md) | `LOOKUP_FK_2HOP` transform (brownfield-wave-executor engine extension) | ACCEPTED |
| [0018](../../architecture/adr/0018_coalesce_uq_class_of_bug.md) | COALESCE-UQ class-of-bug (split-on-COALESCE) | ACCEPTED |
| [0020](../../architecture/adr/0020_wave2_scope_application_level_targets.md) | Wave-2 scope for application-level targets (CW-B60-B closure) | ACCEPTED |
| [0023](../../architecture/adr/0023_data_source_doctrine.md) | Data-Source Doctrine: advanced = structural authority, legacy = canonical no-PII source | ⛔ SUPERSEDED da ADR-0038 |
| [0024](../../architecture/adr/0024_legacy_ingestion_employee_centric.md) | Legacy ingestion is EMPLOYEE-centric: `sys_user*` ⟸ legacy `employee*` (not `users`) | ACCEPTED |
| [0038](../../architecture/adr/0038_the_database_is_self_sufficient.md) | Il database è autosufficiente: il brownfield è storia, non una fonte | ACCEPTED |
<!-- /generato -->

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **319** documenti di questo dominio (lotti: A4 217, A4-campioni 1, B 101). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `cowork_code_exchange` 79, `cowork_code_exchange/.inbox/cowork/read` 35, `cowork_code_exchange/.inbox/cli/read` 27, `docs/superpowers/plans` 14, `cowork_reserved/batch_c1/class_b_diagnostics` 13, `cowork_reserved/batch_c3/sdbi_scale` 12, `cowork_reserved/batch_c1/goals_pilot/mapping_cards` 10, `docs/source_bundle/extracted_bootstrap/brownfield_adaptation` 9.
<!-- /generato -->

## Vedi anche

[dati-db](dati-db.md), [stato-pianificazione](stato-pianificazione.md).
