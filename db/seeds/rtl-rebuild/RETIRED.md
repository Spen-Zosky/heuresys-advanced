# `db/seeds/rtl-rebuild/` — RITIRATO (2026-08-07, S1049)

**Questi seed non sono più eseguibili, ed è voluto.**

## La decisione

Enzo, 2026-08-07: **«la ricostruzione del tenant RTL è a fine vita»**. È la risposta alla
domanda posta durante `#164`, quando la misura ha smentito il piano: le tabelle di appoggio
`staging.rtl_*` risultavano vuote, ma *vuota* non vuol dire *inutilizzata* — erano l'ingresso
di questo strumento, che semplicemente non stava girando.

Presa la decisione, la migrazione **`000283`** ha rimosso le 12 tabelle `staging.rtl_*` vuote.
I seed che le leggono non trovano più le relazioni e falliscono: è l'effetto del ritiro, non
un guasto.

## Cosa non funziona più, nel dettaglio

| seed | legge |
|---|---|
| `02_organization_units.sql` | `rtl_org_units` |
| `05_compensation.sql` | `rtl_salary_bands`, `rtl_salary_band_assignments`, `rtl_employee_contracts` |
| `06_skills_certs.sql` | `rtl_employee_skills`, `rtl_employee_skill_profiles`, `rtl_employee_skill_assessments`, `rtl_tenant_custom_skills`, `rtl_certifications`, `rtl_employee_certifications`, `rtl_users` |
| `07_attendance_topup.sql` | `rtl_employee_attendance`, `rtl_users` |
| `08_rbac_role_grants.sql` | `rtl_users` |

`03_positions.sql`, `04_assignments.sql` e `12_user_satellites.sql` leggono solo
`staging.rtl_employees` e `staging.rtl_employee_module_completions`, che **restano**: girerebbero
ancora, ma fanno parte di uno strumento ritirato e non vanno usati.

## Cosa NON è stato toccato, e perché

- **`staging.rtl_employees` (162 righe)** e **`staging.rtl_employee_module_completions` (11 righe)**
  contengono dati. «Lo strumento è a fine vita» non è la stessa cosa di «i suoi dati si buttano»:
  è una decisione separata, e non è stata presa.
- **`staging.storia36_*`** (calendario, corse, giornali di rollback di `#155`/`#160`) è
  infrastruttura **viva** della storia RTL, non residuo di questo strumento.
- **`db/seeds/storia36/`** è un'altra cosa e resta pienamente in uso: il seed rieseguito in S1048
  (`05_career.sql`) sta lì, e non legge nessuna tabella `staging.rtl_*`.

## Perché i file restano qui

Sono il **verbale di come il tenant RTL è stato costruito** — la ricostruzione di S950 e le sue
successive fasi. Cancellarli renderebbe illeggibile la provenienza di 162 persone, 314 posizioni
e dell'organigramma su cui gira tutto il resto. Restano come documentazione, non come strumento.

Se un giorno servisse ricostruire un tenant da zero, **non si riesumano questi**: si parte dal
lavoro sul Tenant Builder (`#131`), che è la strada scelta.
