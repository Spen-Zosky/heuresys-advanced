# Censimento della separazione — passo S1 (W0-A1, 2026-10-11)

Sola misura: niente è stato tolto, spostato o modificato. Il criterio è quello deciso l'11 ottobre: il datastore è il dominio della piattaforma, advanced è il dominio del tenant. Questo file elenca ciò che in advanced appartiene alla piattaforma, con chi lo legge oggi e se il datastore ha già l'equivalente.

## Come sono stati misurati i numeri (i numeri cambiano, i comandi no)

- Conteggi del database: `.programmi/esiti-onda0/lavoro/censimento_query.sql`, eseguito in sola lettura sul gemello (`ssh linux-pc 'sudo -n -u postgres psql -d heuresys_advanced -X -q -At -F"|"' < censimento_query.sql`). Il gemello è un clone della produzione allo schema della migrazione 000453 (250 tabelle `sys`, senza le 29 della 000454): i numeri sono del clone, non della produzione viva, e sono del 2026-10-11.
- Chi legge: `.programmi/esiti-onda0/lavoro/censimento_lettori.py` (esegue `git grep -w <tabella>` e raggruppa per modulo API, pagina web, seed, script); il risultato intero sta in `lettori_per_tabella.json`. Sono lettori testuali: dicono dove il nome della tabella compare, non provano che il codice giri.
- Datastore: letto in sola lettura dal suo database (`heuresys_datastore`, schemi `datastore_core`, `datastore_derived`, `datastore_model`, `datastore_meta`), contando le righe di `pg_stat_user_tables`.
- Classificazione del dato (ADR-0041) nel clone: `nativo` 51, `importato` 85, `ibrido` 77, `infrastruttura` 40 tabelle (253 righe in `sys_classificazione_direzione_dato`, comprese le 29 della 000454 già dichiarate `importato`).

## 1. Cataloghi generali (tabelle `sys` senza tenant, o righe con tenant nullo)

Tutto ciò che segue è catalogo di piattaforma: nessun tenant lo possiede. Colonna «datastore»: SÌ = esiste l'equivalente con ordine di grandezza simile; PARZ = esiste in parte; NO = non l'ho trovato.

| voce (tabella) | righe | chi la legge oggi (moduli API, web, script) | datastore |
|---|---|---|---|
| `sys_skills` (righe con tenant nullo) | 14003 | advisor, analytics, approvals, capability-composition, dashboard, evidence, learning-gaps, lib/scope, me, positions, public-stats, reference-sync, research, semantic-matching, skill-aliases, skill-categories, skill-families, tenant-materialization | SÌ: `datastore_concept_skill` 13939 su 29417 concetti |
| `sys_occupation_skill_requirements` | 126051 | public-stats, seed | PARZ: `datastore_concept_link` 168537 |
| `sys_skill_taxonomy_edges` | 18438 | modulo skill-taxonomy-edges, script db | SÌ: `datastore_concept_link` |
| `sys_esco_occupation_mappings` | 7826 | public-stats, reference-sync, semantic-matching, script db | SÌ: `datastore_concept_occupation` 3039 |
| `sys_activity_classifications` / `_mappings` | 4304 / 3257 | activity-classifications, activity-classification-mappings, approvals, reference-sync, research | SÌ: classificazioni ATECO e NACE (17 classificazioni in `datastore_classification`) |
| `sys_occupation_classifications` | 2121 | occupation-classifications | SÌ: `datastore_concept_occupation` |
| `sys_skill_groups` | 640 | capability-composition, script db | SÌ: `datastore_collection` (7 raccolte) |
| `sys_skill_families` / `_categories` / `_aliases` / `_proficiency_levels` | 77 / 7 / 80 / 6 | skill-families, skill-categories, skill-aliases, skill-proficiency-levels, analytics, tenant-materialization, capability-composition, me | PARZ: raccolte e categorie del datastore; la categoria della competenza arriva dal pacchetto (categoria e origine) |
| `sys_skill_learning_mappings` | 352 | positions, seed | NO |
| `sys_job_roles` (tenant nullo) | 176 | job-roles, job-families, lib/scope, semantic-matching, web | NO: il ruolo come oggetto sopra la posizione è la decisione 6 dell'11 ottobre, ancora da costruire nel datastore |
| `sys_job_families` | 16 | job-families, job-roles, web | NO |
| `sys_organization_unit_templates` / `_types` | 225 / 10 | tenant-materialization (tipi), research, seed | PARZ: `datastore_org_unit` 38, `datastore_org_level` 8 |
| `sys_operating_model_catalog` | 6 | operating-models, research | SÌ in parte: modelli operativi nel contesto del pacchetto |
| `sys_enterprise_size_bands` | 5 | blueprint-variants, tenant-blueprints, approvals, research | SÌ: fasce dimensionali (`concept_size_class`) |
| `sys_industry_codes` | 12 | tenants, research, approvals, web | SÌ: ATECO / NACE |
| `sys_kpi_definitions` (tenant nullo) | 233 | kpi-definitions, analytics, evidence, me, positions, process-kpi-templates, organization-unit-kpi-templates, tenant-materialization, web | SÌ: `datastore_concept_metric` 10016 e `datastore_bench_metric` 4112 |
| `sys_kpi_metric_definitions` / `_assessment_methods` / `_weighting_rules` / `sys_assessment_methods` / `sys_goal_templates` | 199 / 5 / 3 / 5 / (non contata) | kpi-definitions, assessment-methods, goals | PARZ |
| `sys_process_kpi_templates`, `sys_organization_unit_kpi_templates` (tenant nullo 100) | 73 / 100 | process-kpi-templates, organization-unit-kpi-templates | SÌ: obiettivi e indicatori di processo del pacchetto (`datastore_bench_objective` 2434) |
| `sys_learning_modules` (tenant nullo) | 77 | learning-modules, learning-path-steps, evidence, me, positions, training-initiatives, web | NO (la formazione del pacchetto è una proposta per tenant, non un catalogo) |
| `sys_compensation_bands` (tenant nullo) | 29 | compensation, capability-composition, insights, analytics | PARZ: CCNL con livelli e minimi (`datastore_agreement_wage` 64, `datastore_agreement_level_rank` 31) |
| `sys_reward_gate_catalog` | 11 | compensation | NO (richiesta #264 M3: gli incentivi nella forma delle porte) |
| `sys_dashboards` / `sys_dashboard_blocks` / `sys_blueprint_content_dashboards` | 8 / 27 / 11 | dashboard, lib/scope, web | NO (richiesta #264 M2) |
| `sys_ui_interfaces` (e classi di dato) | 85 / 43 | lib/scope, me, public-stats, web | NO: è catalogo del prodotto advanced (interfacce), non di dominio: probabilmente resta in advanced |
| `sys_blueprint_content_job_roles` | 145 | lib/scope (profilo del cliente) | NO |

Nota di lettura: i cataloghi del prodotto stesso (`sys_auth_permissions` 242, `sys_auth_roles` 24, `sys_auth_role_permissions` 1248, `sys_ui_interfaces`, `sys_translatable_field`, `sys_gdpr_data_map`, `sys_classificazione_direzione_dato`) sono senza tenant ma sono della piattaforma advanced come applicazione, non del dominio dei dati: li metto fuori dal conto e segnalo la scelta.

## 2. Traduzioni

`sys_reference_translations`: 36868 righe, tutte in inglese (`en`); origine: ESCO 29013, HARVEST 5399, LLM 2320, MANUAL 136. Per tabella: `sys_skills` 28062, `sys_activity_classifications` 4304, `sys_occupation_classifications` 2121, `sys_skill_groups` 1147, `sys_kpi_definitions` 317, `sys_job_roles` 265, `sys_auth_permissions` 261, altre sotto 135.
Lettori: `lib/i18n` (API), script `db/scripts/populate-*` e `populate-en-from-esco.sql`.
Datastore: SÌ in forma più larga, `datastore_concept_label` 180934 e `datastore_concept_description` 53564 (più lingue). Le traduzioni di competenze, classificazioni e gruppi sono della piattaforma; quelle di `sys_auth_permissions` e `sys_ui_interfaces` sono del prodotto advanced e restano.

## 3. Vettori

Quattro tabelle con colonna `vector(1024)` e relativi indici HNSW: `sys_skill_embeddings` 14031, `sys_esco_occupation_embeddings` 3045, `sys_job_role_embeddings` 176, `sys_user_profile_embeddings` (non contata: dato personale del tenant, misura da fare separata).
Lettori: modulo `semantic-matching` (10 endpoint, 1040 righe), `insights`, web (`sys_job_role_embeddings`), script `db/scripts`.
Datastore: SÌ per competenze e occupazioni, `datastore_concept_embedding` 27732 (modello voyage-4-lite, copertura in `datastore_vector_coverage`). I vettori dei profili utente sono del tenant e restano in advanced.

## 4. Sincronizzazione dei cataloghi

Schema `reference_sync`: `import_runs` 1214 righe, `source_watermarks` 5, `source_exports` 6. Modulo `reference-sync` (1292 righe, 4 endpoint) che scrive su competenze, mappature ESCO e classificazioni; modulo `tenant-import-runs` (907 righe, 5 endpoint) legge le stesse tabelle; unità e timer di deploy citano `source_watermarks`.
Datastore: SÌ, è il suo mestiere (`datastore_meta.datastore_load` 1416, `datastore_source` 30, `datastore_source_document` 21, copie e contenuto con impronta).

## 5. Famiglie e varianti di modello scritte a mano

Misurato: 2 famiglie (`FIN_BANKING`, `MGMT_CONSULTING`), 2 varianti, 2 versioni (entrambe pubblicate), 2 attivazioni. Contenuto di modello: 33 unità, 71 posizioni, 132 competenze, 73 indicatori, 23 processi, 145 ruoli di catalogo, 11 cruscotti. Scritti da migrazioni (`000008`, `000021`, `000301`, `000336`, `000397`, `000398`, `000400`), cioè a mano, non dal datastore.
Moduli: `blueprint-families`, `-variants`, `-activations`, `-overrides`, `-processes`, `content-blueprint-links`, `tenant-blueprints` (2091 righe, 20 endpoint), `tenant-materialization`, pagine web `blueprints/` e `tenant-blueprints/`.
Datastore: SÌ, genera i prototipi (`datastore_bench_prototype` 20, pacchetti 11); la giunzione provata oggi (W0-A1) carica il pacchetto in `sys_blueprint_content_*`.
Distinzione da tenere: il registro e l'attivazione per tenant (`tenant_blueprints`, `activations`) sono di advanced; la generazione del contenuto no.

## 6. Creazione sintetica di un tenant

`tenants/provisioning.ts` (173 righe: il commento dice che la ricerca dell'archetipo in un catalogo TypeScript è stata ritirata), `tenant-materialization` (1343 righe, 2 endpoint, `build-plan.ts`: costruisce unità, posizioni, competenze e indicatori in un tenant da una sorgente), `tenant-builder` documentato nei `.programmi`. Lettori web: pagina `tenants/`. Seed demo: `db/seeds/org_chart_rtl_demo.sql`, `survey-assignments-demo.sql` (dati del tenant di prova, non di piattaforma).
Datastore: PARZ: genera il modello; il costruire il tenant dal modello resta funzione di advanced (è il suo dominio: il tenant riceve, personalizza, popola). Decisione da prendere nella bozza ADR: `tenant-materialization` resta, `provisioning.ts` va riletto.

## 7. Acquisizione dei semi

Tabelle: `sys_seed_validation_results` 140, `sys_seed_source_evidence` 28, `sys_seed_approval_decisions` 16, `sys_research_sources` 7, `sys_industry_forbidden_terms` 2. Moduli: `research` (2581 righe, nessuna rotta propria: è il motore), `seed-candidate-records` (5 endpoint), `seed-approval-decisions` (3), `tenant-import-runs`, `approvals`; pagina web `seed-acquisition/`; cartelle `db/seeds/` (`reconciliation`, `rtl-banking-skills`, `rtl-rebuild`, `storia36`).
Datastore: SÌ, la ricerca, le fonti e le prove sono suo (`datastore_bench_evidence` 5023, `datastore_bench_decision` 99, `datastore_source` 30). Ciò che resta in advanced è il tenant importato da sistemi esterni (onda 3), non i semi di piattaforma. I seed `rtl-*` e `storia36` sono dati del tenant RTL Bank, non di piattaforma.

## 8. Funzioni di piattaforma del tenant «Heuresys System»

Il tenant `HEURESYS` (settore MGMT_CONSULTING) ha 9 utenti, 3 unità, 3 posizioni, 1 attivazione. Ruoli: `PLATFORM_ADMIN` 240 permessi, `TENANT_ADMIN` 211, `HRMS_MANAGER` 168. Moduli con ramo `isPlatform(...)`: 75 servizi. Moduli che sono del solo mandato tecnico di piattaforma: `platform-tenant-assignments` (3 endpoint), `tenants` (7), `tenant-materialization` (rotta con codice `TENANT_MATERIALIZE_ADMIN_ONLY`), `reference-sync`, `research`, i quattro moduli di tassonomia delle competenze con codici `*_ADMIN_ONLY` (`job-families`, `skill-categories`, `skill-families`, `skill-taxonomy-edges`). Pagine web candidate: `tenants/`, `seed-acquisition/`, `system-health/`, `blueprints/`, `tenant-blueprints/`, `skill-taxonomy/`, `job-catalog/`, `generated-origins/`, `provenance/`, `leads/`.
Datastore: PARZ: ha gli strumenti che producono i modelli; non ha la console di amministrazione. In advanced resta la sola amministrazione tecnica dei tenant (decisione dell'11 ottobre).
Da verificare nella bozza ADR (non misurato qui): quali delle pagine candidate richiedono davvero solo un ruolo di piattaforma.

## Che cosa questo censimento non dice

- Non dice quanto costa togliere ciascuna voce: nessuna è stata tolta. Il ritiro è irreversibile su dati di produzione e ha un cancello a fine onda 3.
- I «lettori» sono occorrenze del nome in tutto il repository, compresi artefatti; nella tabella ho tenuto moduli API, pagine web, seed e script. Un lettore vero va confermato prima del ritiro.
- Le righe per tenant (RTL Bank) non sono state contate: sono dati del cliente e restano.
