# ADR-0042 — La catena del semilavorato: la piattaforma genera, il cliente possiede

**Status**: PROPOSTO
**Date**: 2026-09-16
**Decided by**: Enzo Spenuso (la regola, già in produzione) · Claude Code CLI (stesura, mandato K)
**Relates to**: ADR-0041 (I23, direzione del dato) — questo ADR guarda il semilavorato di
piattaforma, non i dati amministrativi importati; i due invarianti sono ortogonali.

---

## Contesto

Heuresys costruisce un **fascicolo di settore** (blueprint) — competenze, famiglie
professionali, template di survey, obiettivi, KPI — che la piattaforma genera per industria
(banche, consulenza direzionale…) e che ogni tenant **applica e personalizza**. La regola
dichiarata del prodotto è: *la piattaforma genera il semilavorato; il cliente lo possiede e lo
personalizza.* Non era mai stata scritta come invariante, né provata sul vivo.

Il mandato K (indagini `I-A` e `I-B`) ha misurato due cose distinte: **se** la regola regge
quando la piattaforma rigenera un fascicolo, e **come** — fisicamente, nelle tabelle — la catena
è realizzata oggi.

## Decisione

### 1. Le personalizzazioni del cliente si conservano — ma per assenza di tocco, non per regola

Misurato (`I-A`, prova su copia — non sul database vivo): un override del cliente
(`sys_blueprint_overrides`) inserito prima di una riapplicazione del fascicolo esiste ancora
dopo, identico. **5/5 verde**; sabotato apposta (`DELETE` dell'override dentro la transazione di
prova) → **1 failed/4 passed**, la prova sa fallire.

La ragione, verificata nel codice (`tenant-materialization/build-plan.ts`,
`repository.ts`): **nessuna riga di materializzazione o rigenerazione legge o scrive
`sys_blueprint_overrides`**. L'unico scrittore/lettore è il CRUD del modulo
`blueprint-overrides`. Gli override sopravvivono perché **nessuno li tocca**, non perché un
vincolo li protegga esplicitamente — l'unico modo di perderli è la cascata su cancellazione
del padre (`ON DELETE CASCADE` da `sys_blueprint_activations`/`sys_blueprint_process_registry`),
che nessuna rigenerazione oggi esegue: la rigenerazione **aggiorna in posto**, non ricrea.

> **Questo ADR dichiara l'invariante che oggi vale per fortuna**: una rigenerazione del
> semilavorato **non deve mai** cancellare o ricreare un'attivazione o un processo del cliente.
> Se un giorno servirà farlo, la conservazione delle personalizzazioni smette di essere
> automatica e va **ri-progettata**, non solo ri-testata.

La prova automatica che oggi manca sul caso generale (supersessione di una corsa con override
presente, non solo applicazione pulita) resta un limite dichiarato di `I-A`, non colmato da
questo ADR: la supersessione è dimostrata dal codice (nessun `WHERE` la farebbe toccare una riga
nativa) e dal test T7 esistente, non da una seconda prova con override.

### 2. La catena fisica esiste in QUATTRO modi diversi su tredici tabelle — non uno

Misurato (`I-B`): la coppia «colonna tenant facoltativa + bandiera globale» che permette la
catena completa (piattaforma genera con `tenant_id NULL` + `is_global=true`; il cliente ha la
propria copia con `tenant_id` valorizzato) è realizzata **da una sola tabella su tredici**:
`sys_skills` (14.003 righe di piattaforma, 28 di cliente RTL).

| modo | tabelle | che cosa permette |
|---|---|---|
| **B — canonico** | `sys_skills` (1) | la catena completa: generato E personalizzato, distinguibili in una colonna |
| **A — catalogo senza tenant** | `sys_skill_families`, `sys_skill_categories`, `sys_skill_taxonomy_edges`, `sys_job_families`, `sys_organization_unit_templates`, `sys_process_kpi_templates` (6) | solo piattaforma; nessuna copia di cliente è possibile oggi |
| **C — B incompleto** | `sys_job_roles`, `sys_organization_unit_kpi_templates` (2) | ha la colonna tenant nullable ma **non** la bandiera: non distingue «globale» da «senza padrone» |
| **D — tenant obbligatorio** | `sys_tenant_blueprints`, `sys_survey_templates`, `sys_goal_templates`, `sys_engagement_survey_templates` (4) | ogni riga è già del tenant; il «generato» si distingue solo dal registro di provenienza (oggi vuoto) |

**Il modo canonico (B) resta la regola per ogni tabella nuova che deve sostenere la catena
completa.** I modi A, C, D sono **eccezioni ammesse per nome**, non errori da correggere in
questo ADR:

- **A è per costruzione**: sono classificazioni e contenuto di catalogo che I21 vuole aperti a
  ogni industria; una tabella A che dovrà avere una copia di cliente **passa a B**, non resta A
  con un workaround.
- **C è un B incompleto**: manca solo la bandiera `is_global`. Completarlo è lavoro di F4/F5, non
  di questo mandato — ma questo ADR lo dichiara come debito, non come varietà accettabile del
  modo canonico.
- **D è il modo dei fascicoli e dei template già personalizzati**: la riga stessa è la copia del
  cliente; distinguere «generato dalla piattaforma» da «scritto dal cliente» richiede il registro
  `sys_generated_record_origins`, che oggi è **vuoto** — nessuna materializzazione l'ha ancora
  popolato. Finché resta vuoto, in D la distinzione generato/personalizzato **non è
  ricostruibile**: è un limite dichiarato, non un difetto di questo ADR.

## Conseguenze

1. **Ogni tabella nuova pensata per ospitare sia contenuto di piattaforma sia personalizzazioni
   di cliente adotta il modo B** (`tenant_id` nullable + bandiera `is_global`), salvo una
   ragione scritta per l'eccezione.
2. **`R-3` (`TAXONOMY_STEWARD`)** e **`R-5` (`BLUEPRINT_MANAGER`)** distinguono, nei permessi che
   creano, la parte di piattaforma (genera, `tenant_id NULL`) dalla parte di cliente (possiede,
   governa la propria copia) — è la conseguenza diretta di questo ADR sui ruoli di Fase 4.
3. **Nessuna rigenerazione del semilavorato ricrea un'attivazione o un processo esistente**: li
   aggiorna in posto. Un cambiamento futuro a questo comportamento è un cambiamento
   architetturale, non un refactor — va per una nuova voce di decisione, non silenzioso.
4. **Il registro `sys_generated_record_origins`** resta la fonte per distinguere generato da
   personalizzato nel modo D; finché è vuoto, quella distinzione è dichiarata **non
   ricostruibile**, non «assunta zero».

## Cosa NON cambia

- I quattro modi fisici **non si unificano** in questo ADR: unificarli (portare C e D a B)
  sarebbe una migrazione dati, fuori mandato.
- `sys_blueprint_overrides` e `sys_generated_record_origins` restano gli unici due registri della
  catena; questo ADR non ne introduce di nuovi.
- I21 (coerenza di industry) resta il criterio che tiene aperte le tabelle di modo A: questo ADR
  non lo tocca, lo presuppone.

## Ratifica

Nasce `PROPOSTO`. Passa da tre confutatori in sola lettura (workflow `W3` del mandato K) prima di
andare a Enzo; la ratifica si registra in
`.programmi/K-ruoli-direzione/esiti/RISPOSTE_ENZO.md` e porta lo stato ad `ACCETTATO`.
