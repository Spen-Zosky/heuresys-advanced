# I-B — La fisica delle famiglie di semilavorato (passo 14) — ESITO

Data: 2026-09-15, sessione S1103. Lettore W1 `I-B` (haiku; primo lancio scartato dal critico per **4 tabelle risolte male**, rilancio `evidenze/wf_F1_W1_202609150148_b` con i 13 nomi esatti), spia trovata; il lettore ha lasciato 6 distribuzioni in `non_misurato` e sbagliato `sys_skills` (14031/0 contro 14003/28): la tabella famiglie×5 è quindi **ri-misurata per intero in linea** con `tools/misura_ib.py` (READ ONLY; evidenza `evidenze/I-B_famiglie_202609150326.txt`).

> **La frase che K1-ADR deve riportare:** *la catena del semilavorato (piattaforma genera, cliente possiede e personalizza) è realizzata fisicamente in **4 modi diversi** su 13 tabelle. **Il modo canonico non è quello più diffuso** (A, catalogo senza tenant: 6 tabelle) ma quello che permette la catena completa: **B — `tenant_id` nullable + bandiera `is_global` nella stessa tabella**, oggi realizzato da **`sys_skills` soltanto** (14.003 righe di piattaforma, 28 di cliente RTL). Gli altri tre modi sono **eccezioni da dichiarare per nome**: A per i cataloghi che per natura non hanno copia di cliente; C (colonna presente, tutta NULL) è un B incompleto; D (`tenant_id` obbligatorio) è il modo dei fascicoli e dei template che nascono già del cliente.*

## La tabella famiglie×5 (13 tabelle, misurata)

Colonna tenant = `information_schema.columns … like '%tenant_id'`; bandiera = `… like '%is_global%'`; il «legame» al registro del generato è **per nome**, non FK (`generated_record_origin_target_table = '<t>'`) e il registro oggi è a **0 righe**: la colonna vale 0 per tutte per costruzione, non perché il legame manchi.

| tabella | colonna tenant (nullabile?) | bandiera | righe | tenant NULL | Heuresys System | RTL Bank | nel registro | MODO |
|---|---|---|---|---|---|---|---|---|
| sys_skill_families | – | – | 77 | – | – | – | 0 | A |
| sys_skill_categories | – | – | 7 | – | – | – | 0 | A |
| sys_skill_taxonomy_edges | – | – | 18.438 | – | – | – | 0 | A |
| sys_job_families | – | – | 16 | – | – | – | 0 | A |
| **sys_skills** | `skill_tenant_id` (sì) | **`skill_is_global`** | 14.031 | **14.003** | 0 | **28** | 0 | **B** |
| sys_job_roles | `job_role_tenant_id` (sì) | – | 176 | 176 | 0 | 0 | 0 | C |
| sys_tenant_blueprints | `tenant_blueprint_tenant_id` (sì) | – | 1 | 0 | 0 | 1 | 0 | D* |
| sys_survey_templates | `survey_template_tenant_id` (**no**) | – | 2 | 0 | 1 | 1 | 0 | D |
| sys_goal_templates | `template_tenant_id` (**no**) | – | 40 | 0 | 0 | 40 | 0 | D |
| sys_engagement_survey_templates | `template_tenant_id` (**no**) | – | 5 | 0 | 0 | 5 | 0 | D |
| sys_organization_unit_templates | – (`organization_unit_template_blueprint_id`) | – | 225 | – | – | – | 0 | A† |
| sys_process_kpi_templates | – | – | 73 | – | – | – | 0 | A |
| sys_organization_unit_kpi_templates | `organization_unit_kpi_template_tenant_id` (sì) | – | 100 | 100 | 0 | 0 | 0 | C |

\* `tenant_blueprint_tenant_id` è nullabile ma l'unica riga è di RTL: si comporta da D. † non ha tenant ma appartiene a un **blueprint** (`organization_unit_template_blueprint_id`): è contenuto del semilavorato, di piattaforma per via del blueprint, non per una colonna propria.

## I quattro modi, e che cosa ne discende

| modo | tabelle | che cosa permette | per K1-ADR |
|---|---|---|---|
| **A** — catalogo senza tenant | 6 (skill_families, skill_categories, skill_taxonomy_edges, job_families, organization_unit_templates, process_kpi_templates) | solo piattaforma; **nessuna copia di cliente possibile** | eccezione ammessa **per nome**: sono classificazioni/contenuto del blueprint (I21 le vuole aperte a ogni industria). Se un cliente dovrà personalizzarle, la tabella passa a B |
| **B** — `tenant_id` nullable + `is_global` | 1 (skills) | catena completa: la piattaforma genera (`NULL`, `is_global=true`), il cliente possiede la propria copia | **il modo canonico**; `sys_skill_aliases` vi si appoggia tramite la competenza madre (K-D4 ritirata) |
| **C** — `tenant_id` nullable, tutto NULL, senza bandiera | 2 (job_roles, organization_unit_kpi_templates) | come B ma senza il modo di distinguere «globale» da «senza padrone» | B incompleto: K1-ADR li dichiara «da completare con la bandiera» (una migrazione di F4/F5, non di questo mandato) |
| **D** — `tenant_id` obbligatorio | 4 (tenant_blueprints, survey_templates, goal_templates, engagement_survey_templates) | ogni riga è di un tenant; la piattaforma «genera» scrivendo nel tenant **Heuresys System** (1 survey template) o direttamente nel cliente (40 goal template di RTL) | il modo dei fascicoli e dei template **già personalizzati**: la copia del cliente è la riga stessa; il generato si distingue solo col registro `sys_generated_record_origins` (oggi vuoto) |

Correzioni ai numeri del lettore: `sys_skills` piattaforma/cliente = **14.003 / 28**, non 14.031/0 (`select count(*) filter (where skill_tenant_id is null), count(*) filter (where skill_tenant_id is not null) from sys.sys_skills`); le 6 distribuzioni «da verificare» sono nella tabella; `sys_organization_unit_templates` «tutte di piattaforma» è vero **per via del blueprint**, non di una colonna.

## Verdetto

- **SBLOCCA K1-ADR** con: 4 modi, canonico = B (`sys_skills`), eccezioni per nome A (6), C (2, da completare), D (4). Il registro del generato (`sys_generated_record_origins`) è oggi **vuoto**: la distinzione generato/personalizzato in D e C **non è ricostruibile** finché una materializzazione non lo popola — l'ADR lo dice nella prima riga delle conseguenze (come già chiede I-A).
- Nessuna decisione nuova per Enzo.
