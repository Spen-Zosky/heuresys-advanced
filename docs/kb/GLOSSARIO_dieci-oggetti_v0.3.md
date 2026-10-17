# Glossario unico dei dieci oggetti

Una pagina sola, **identica in heuresys-datastore e in heuresys-advanced**: per ognuno dei dieci oggetti dell'organizzazione ([A §5]: obiettivo strategico, capability, processo, unità, ruolo, posizione, persona, team o progetto, indicatore, target) dice come si chiama nel datastore, come si chiama in advanced, e in quali tabelle sta. Nasce con il contratto dati v0.3 (piano 111 del datastore, mandato PE-1 del 2026-10-17) e segue le sue versioni.

Il datastore è il dominio della piattaforma: il **tipo d'impresa** (D-69). Advanced è il dominio del tenant: l'**azienda vera**. Per questo ogni oggetto ha due colonne di tabelle, e la persona ha la sola colonna di advanced.

**Come si legge.** «Pacchetto» è il nome della sezione o del campo nel pacchetto `heuresys.prototipo.pacchetto/0.3`. Le tabelle del datastore sono nello schema `datastore_model` salvo dove è scritto altrimenti; quelle di advanced nello schema `sys`. «(proposta)» indica una tabella che non esiste ancora: la casa proposta dalla mappatura v0.3, il cui nome fisico lo fissa la migrazione che la crea. I nomi delle tabelle esistenti sono stati letti il 2026-10-17 dalle migrazioni dei due repository; si riverificano con `git grep -i "create table" -- db/migrations` in ciascuno.

## I dieci oggetti

| # | Oggetto [A §5] | Pacchetto v0.3 | Datastore: tabelle | Advanced: nome | Advanced: tabelle |
|---|---|---|---|---|---|
| 1 | Obiettivo strategico | `obiettivi`, con `livello` (IMPRESA, PROCESSO, UNITA, RUOLO) e `padre` | `datastore_bench_objective` | goal | modello: `sys_blueprint_content_goals`; tenant: `sys_goals`, `sys_goal_alignments` |
| 2 | Capability aziendale | `capability`, e `processi[].capabilityCodici` | nessuna oggi (onda 1) | business capability | modello: `sys_blueprint_content_capabilities` (proposta); tenant: nessuna oggi (onda 2) |
| 3 | Processo e attività | `processi`, con `fasi` (le attività) | catalogo: `datastore_process`, `datastore_process_step`, `datastore_process_participation`; prototipo: `datastore_bench_process`, `datastore_bench_process_unit` | process | modello: `sys_blueprint_process_registry`, `sys_blueprint_content_unit_processes`, `sys_blueprint_content_process_steps` (proposta); tenant: `sys_organization_unit_processes`, `sys_process_participants` |
| 4 | Unità organizzativa | `unita`, con `mandato` e `budget` | `datastore_org_unit`, `datastore_bench_unit` | organization unit | modello: `sys_blueprint_content_units`; tenant: `sys_organization_units`, `sys_organization_unit_history` |
| 5 | Ruolo | `ruoli`; la posizione lo richiama in `posizioni[].ruoloCodice` (D-75) | nessuna oggi (onda 1) | job role | catalogo: `sys_job_roles`; modello: `sys_blueprint_content_job_roles` |
| 6 | Posizione | `posizioni` | `datastore_position`, `datastore_bench_position` | position | modello: `sys_blueprint_content_positions`, `sys_blueprint_content_position_processes`; tenant: `sys_positions`, `sys_user_position_assignments` |
| 7 | Persona | non si applica: il datastore descrive il tipo d'impresa, non chi ci lavora | non si applica | user (employee) | tenant: `sys_users`, `sys_user_position_assignments` |
| 8 | Team o progetto | `commesse`, con `natura` (COMMESSA, PROGETTO, TEAM_STABILE) e `composizione` | `datastore_bench_item` (una riga per voce) | engagement, project, team | modello: `sys_blueprint_content_engagements`, `sys_blueprint_content_engagement_links`; tenant: `sys_projects`, `sys_project_members`, `sys_teams`, `sys_team_members` |
| 9 | Indicatore | `indicatori` | prototipo: `datastore_bench_metric`; catalogo: `datastore_core.datastore_concept_metric` | KPI | modello: `sys_blueprint_content_kpis`; tenant: `sys_kpi_definitions`, `sys_kpi_measurements` |
| 10 | Target | `indicatori[].bersaglio`, con `periodo` | colonne `bench_metric_target_min`, `bench_metric_target`, `bench_metric_target_max` di `datastore_bench_metric` | KPI target | modello: colonne target di `sys_blueprint_content_kpis`; tenant: `sys_kpi_targets` |

## Le parole che significano due cose

**Capability.** Nel senso di [A §5, §8] la capability è ciò che l'impresa deve saper fare in modo affidabile: comprende processi, competenze, strumenti, dati e coordinamento. In advanced la parola indica oggi un'altra cosa: un **punteggio composito da 0 a 100** calcolato su dipendente, posizione, unità e azienda (`sys_capability_scores`, `sys_capability_maturity_scores`, `sys_capability_score_lineage`, migrazioni `000146` e `000147`). Da questo glossario in poi:

- «capability», senza aggettivi, è **solo** l'oggetto 2 della tabella;
- il punteggio si chiama **indice di capacità** (in inglese *capability index*), nell'interfaccia e nei documenti; le tabelle esistenti restano come sono, perché rinominarle non è un'aggiunta.

**Ruolo.** «Ruolo» è l'oggetto 5, il ruolo organizzativo (job role). In advanced esistono anche i **ruoli di autorizzazione** (`sys_auth_roles`, `sys_user_auth_roles`): dicono che cosa un utente può fare nel programma, non che lavoro fa. Si chiamano «ruoli di accesso».

**Decisione.** I **diritti decisionali** del contratto v0.3 (`decisioni`: propone, contribuisce, assenso, decide, esegue) non sono le decisioni del banco di prova nel datastore (`datastore_bench_decision`: accetta, rifiuta, modifica un passo della cascata) né il flusso delle approvazioni di advanced (`sys_approval_requests`, `sys_approval_steps`). Nel catalogo si dice «decisione»; il resto si chiama «esito del passo» e «approvazione».

**Commessa.** Nel pacchetto v0.2 `commesse` erano solo le commesse tipiche; in v0.3 la stessa sezione ospita «team e progetti tipici», distinti dal campo `natura`. Una voce senza `natura` è una commessa come nella v0.2.

## Gli oggetti di contorno che il contratto v0.3 aggiunge

Non sono fra i dieci di [A §5], ma servono a collegarli: **decisione** (`decisioni`, R18), **agente** (`agenti`, R38: un attore non umano con un ruolo umano che ne risponde), **entità giuridica** (`entita`, R44), **principio di progettazione** (`principi`, R36), **strategia tipica** (`strategia`, R01) e **perimetro del fascicolo** (`perimetro`, R48: il ventaglio di voci di catalogo che il tenant può usare). Le loro case proposte sono nella mappatura v0.3.
