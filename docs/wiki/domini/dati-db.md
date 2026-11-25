---
dominio: dati-db
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Schema sys.*, migrazioni idempotenti, regole per toccare dati e oggetti condivisi
fonti: [.claude/rules/db-migrations.md, db/migrations, docs/kb/tools/chi_sorveglia.py, db/scripts/prova-idempotenza.sh]
concetti: [migrazione, posizione, tenant, seed]
---

# Dati e database

## Com'è oggi

- Le tabelle di business stanno in `sys.sys_<plurale>`; gli schemi ausiliari sono `staging`, `reference_sync`, `audit` (I3/I4). Campi categorici `varchar(N) + CHECK`, mai ENUM (RD-08); `date` per le sole date (RD-09).
- Il modello è centrato sulla posizione, non sul dipendente (I1); il PIP è una vista, mai un blob (ADR-0008, I9).
- La catena delle migrazioni si riapplica a ogni deploy (ADR-0034); ritirare un oggetto vuol dire emendare il file che lo crea (ADR-0035). Le regole sono in [db-migrations](../../../.claude/rules/db-migrations.md).
- Il database è autosufficiente: l'ingestione dal legacy è chiusa dal 2026-08-14 (ADR-0038); `python docs/kb/tools/check_no_legacy_ingest.py` lo verifica.
- Ogni tabella di dati del cliente è nativa, importata o ibrida (ADR-0041, I23).
- Prima di toccare un oggetto condiviso: `python docs/kb/tools/chi_sorveglia.py <nome>`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0003](../../architecture/adr/0003_db_access_drizzle_plus_raw_sql.md) | DB Access: Drizzle ORM + Raw SQL Migrations | Superseded in part |
| [0008](../../architecture/adr/0008_position_intelligence_profile_as_view.md) | Position Intelligence Profile: Relational Base + View, not Blob | Accepted |
| [0009](../../architecture/adr/0009_visualization_node_layouts_separate_table.md) | Visualization: Dedicated `sys_visualization_node_layouts` Table | Accepted |
| [0015](../../architecture/adr/0015_sys_job_roles_nullable_family_fk.md) | `sys_job_roles.job_role_family_id` nullable FK | ACCEPTED |
| [0016](../../architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md) | `sys_esco_occupation_mappings.job_role_id` nullable FK | ACCEPTED |
| [0025](../../architecture/adr/0025_sys_skill_categories_nullable_family_fk.md) | `sys_skill_categories.skill_category_family_id` nullable FK (+ WS-3 activity-classification-mapping investigation: source-dump + 000052 fixes, residual FK-conflict blocker) | ACCEPTED |
| [0029](../../architecture/adr/0029_reference_data_i18n_translations_table.md) | i18n dei dati di riferimento: IT canonico in-row + tabella centrale `sys_reference_translations` | Accepted |
| [0034](../../architecture/adr/0034_migration_chain_is_schema_over_a_data_baseline.md) | La catena di migrazioni è uno strato di schema e controlli sopra una base di dati, non un ricostruttore | Accepted |
| [0035](../../architecture/adr/0035_retirement_amends_the_source_never_deletes_downstream.md) | Ritirare un oggetto: si emenda la fonte, non si cancella a valle | Accepted |
| [0037](../../architecture/adr/0037_user_deletion_is_anonymization.md) | Cancellare una persona significa anonimizzarla; la cancellazione fisica è la revoca di una creazione | Accepted |
| [0038](../../architecture/adr/0038_the_database_is_self_sufficient.md) | Il database è autosufficiente: il brownfield è storia, non una fonte | ACCEPTED |
| [0041](../../architecture/adr/0041_direzione_del_dato.md) | La direzione del dato: invariante I23 | ACCETTATO |
| [0045](../../architecture/adr/0045_dati_contrattuali_restano_importati.md) | I dati contrattuali del personale restano «importati»: Heuresys avvisa e rinvia al sistema esterno | ACCETTATO il 2026-10-12 da Enzo Spenuso |
<!-- /generato -->

## Come si fa

| lavoro | dove | comando |
|---|---|---|
| provare una migrazione | gemello, copia usa-e-getta | `bash db/scripts/prova-idempotenza.sh` |
| prova generale della CI | gemello | `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'` |
| applicare alla produzione | VM | `pnpm db:migrate:vm` |
| lavoro pesante | gemello o VM | `bash db/scripts/sul-gemello.sh '<cmd>'` |
| storia RTL di 36 mesi | VM | `bash db/scripts/storia36.sh custodia` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **47** documenti di questo dominio (lotti: A4 31, A4-campioni 1, B 15). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `cowork_reserved` 14, `qa_artifacts` 11, `cowork_code_exchange/baselines` 8, `docs/superpowers/specs` 5, `.storia36/analysis` 2, `docs/superpowers/plans` 2, `cowork_code_exchange` 1, `docs/kb/db-forensics` 1.
<!-- /generato -->

## Vedi anche

[architettura](architettura.md), [storia-archivio](storia-archivio.md), [consolidamento-tenant](consolidamento-tenant.md).
