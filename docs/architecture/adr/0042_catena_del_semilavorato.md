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
che nessuna rigenerazione oggi esegue.

⚠ **Precisione sul meccanismo, verificata di nuovo qui** (`rg` su
`tenant-materialization/*.ts` e sugli effetti di approvazione: zero occorrenze di
`sys_blueprint_activations`/`sys_blueprint_process_registry`): non è che la rigenerazione
«aggiorni in posto» quelle due tabelle — **non le tocca affatto**, in nessun modo, né in lettura
né in scrittura. Dove `tenant-materialization/repository.ts` scrive davvero altro contenuto
(unità organizzative, posizioni, competenze, utenti), lo fa con `INSERT … ON CONFLICT DO
NOTHING` (righe 158, 194, 260, 352) — **salta se la riga esiste già, non la aggiorna mai**. Il
verbo giusto per questo ADR è «non tocca», non «aggiorna»: un tocco che non c'è è più robusto di
un aggiornamento che potrebbe un giorno sovrascrivere qualcosa.

> **Questo ADR dichiara l'invariante che oggi vale per fortuna**: una rigenerazione del
> semilavorato **non deve mai** cancellare o ricreare un'attivazione o un processo del cliente.
> Se un giorno servirà farlo, la conservazione delle personalizzazioni smette di essere
> automatica e va **ri-progettata**, non solo ri-testata.

La prova automatica che oggi manca sul caso generale (supersessione di una corsa con override
presente, non solo applicazione pulita) resta un limite dichiarato di `I-A`, non colmato da
questo ADR: la supersessione è dimostrata dal codice (nessun `WHERE` la farebbe toccare una riga
nativa) e dal test T7 esistente, non da una seconda prova con override.

### 2. La catena fisica esiste in QUATTRO modi diversi sulle tredici tabelle che il mandato ha censito — e lo stesso schema fisico ricorre anche fuori da quel censimento

Misurato (`I-B`, censimento **dichiaratamente limitato** alle nove famiglie di template del
semilavorato elencate dal mandato): la coppia «colonna tenant facoltativa + bandiera globale» che
permette la catena completa (piattaforma genera con `tenant_id NULL` + `is_global=true`; il
cliente ha la propria copia con `tenant_id` valorizzato) è realizzata, **dentro quel censimento**,
da una sola tabella su tredici: `sys_skills` (14.003 righe di piattaforma, 28 di cliente RTL).

| modo | tabelle (nel censimento di `I-B`) | che cosa permette |
|---|---|---|
| **B — canonico** | `sys_skills` (1) | la catena completa: generato E personalizzato, distinguibili in una colonna |
| **A — catalogo senza tenant** | `sys_skill_families`, `sys_skill_categories`, `sys_skill_taxonomy_edges`, `sys_job_families`, `sys_organization_unit_templates`, `sys_process_kpi_templates` (6) | solo piattaforma; nessuna copia di cliente è possibile oggi |
| **C — B incompleto** | `sys_job_roles`, `sys_organization_unit_kpi_templates` (2) | ha la colonna tenant nullable ma **non** la bandiera: non distingue «globale» da «senza padrone» |
| **D — tenant nullable, oggi sempre valorizzato** | `sys_survey_templates`, `sys_goal_templates`, `sys_engagement_survey_templates` (3) | ogni riga oggi è del tenant; il «generato» si distingue solo dal registro di provenienza (oggi vuoto) |

⚠ **`sys_tenant_blueprints` è stata riclassificata**, fuori dal modo D dov'era finita: a livello
di schema `tenant_blueprint_tenant_id` è **nullable**, senza alcun vincolo `NOT NULL` (verificato:
`pg_get_constraintdef` non mostra nessun check sulla colonna), e il servizio ha un `linkTenant()`
dedicato (`tenant-blueprints/service.ts:184-206`) proprio per agganciare il tenant **dopo** la
creazione — un fascicolo può esistere prima che l'azienda sia registrata (il commento della
migrazione `000299_fascicolo_del_tenant.sql:5-7` lo dice esplicitamente). Che oggi l'unica riga
esistente abbia un tenant è un fatto della singola riga, non un vincolo del database: è
strutturalmente **modo C** (nullable, senza bandiera), non modo D. Un campione di una riga non
sostiene una classificazione strutturale — è la stessa cautela che `I-B` aveva già scritto in
nota per questa tabella («si comporta da D», non «è D»), e questo ADR l'aveva persa nel travaso.

**Il censimento di `I-B` non è un censimento dell'intero schema.** Interrogando `sys.*` per lo
stesso schema fisico (`… WHERE column_name LIKE '%is_global'`) emergono, fuori dalle tredici
tabelle del mandato, altre **sette** tabelle con la stessa coppia di colonne:
`sys_career_paths`, `sys_compensation_bands`, `sys_kpi_definitions`, `sys_learning_modules`,
`sys_learning_paths`, `sys_payout_curves` (tenant nullable + bandiera) e
`sys_occupation_skill_requirements` (bandiera senza colonna tenant — un quinto pattern, non
censito da nessuno dei quattro modi). Il modo B non è raro come idioma nel codice: **è raro
dentro il dominio che il mandato ha scelto di censire** (le famiglie di template del
semilavorato), e ricorre altrove con un uso disomogeneo — attivo con split reale piattaforma/
cliente su `sys_compensation_bands` (29 globali/12 di tenant) e `sys_learning_modules` (77/15);
strutturalmente presente ma **mai esercitato** su `sys_career_paths` e `sys_learning_paths`
(0 righe globali, bandiera sempre falsa) e su `sys_kpi_definitions` (233 righe, tutte globali:
nessuna copia di tenant ancora creata); incoerente su `sys_payout_curves` (bandiera `true` su
righe che hanno comunque un `tenant_id`, un uso della colonna diverso da quello di `sys_skills`).
**Classificare queste sette tabelle nei quattro modi è fuori dallo scopo di questo ADR**: il
censimento completo di ogni tabella che usa lo schema fisico B, non solo quelle del semilavorato
di blueprint, è un lavoro dichiarato qui e non eseguito, non una promessa che questo documento
tiene.

**Il modo canonico (B) resta la regola per ogni tabella nuova che deve sostenere la catena
completa.** I modi A, C, D sono **eccezioni ammesse per nome**, non errori da correggere in
questo ADR:

- **A è per costruzione**: sono classificazioni e contenuto di catalogo che I21 vuole aperti a
  ogni industria; una tabella A che dovrà avere una copia di cliente **passa a B**, non resta A
  con un workaround.
- **C è un B incompleto**: manca solo la bandiera `is_global`. Riguarda `sys_job_roles`,
  `sys_organization_unit_kpi_templates` e, per le ragioni misurate sopra, anche
  `sys_tenant_blueprints`. Completarlo è lavoro di F4/F5, non di questo mandato — ma questo ADR
  lo dichiara come debito, non come varietà accettabile del modo canonico.
- **D è il modo dei fascicoli e dei template già personalizzati**: la riga stessa è la copia del
  cliente; distinguere «generato dalla piattaforma» da «scritto dal cliente» richiede il registro
  `sys_generated_record_origins`, che oggi è **vuoto** — nessuna materializzazione l'ha ancora
  popolato. Finché resta vuoto, in D la distinzione generato/personalizzato **non è
  ricostruibile**: è un limite dichiarato, non un difetto di questo ADR. Diversamente da C, le
  tre tabelle rimaste in D (`sys_survey_templates`, `sys_goal_templates`,
  `sys_engagement_survey_templates`) hanno la colonna tenant **non nullable** — è un vincolo di
  schema, non solo un fatto delle righe di oggi.

## Conseguenze

1. **Ogni tabella nuova pensata per ospitare sia contenuto di piattaforma sia personalizzazioni
   di cliente adotta il modo B** (`tenant_id` nullable + bandiera `is_global`), salvo una
   ragione scritta per l'eccezione.
2. **`R-3` (`TAXONOMY_STEWARD`) e `R-5` (`BLUEPRINT_MANAGER`) NON hanno lo stesso rapporto con
   questo ADR** — il mandato li tiene deliberatamente separati (sezione 2, conseguenza a; R-3
   passo 45), e questo ADR lo eredita invece di appiattirlo:
   - `R-3` riceve **solo** permessi lato cliente (`skill_taxonomy_tenant:*`, `skill_alias:manage`
     — governa la propria copia, `tenant_id` valorizzato). La parte che genera con `tenant_id
     NULL` **resta a `PLATFORM_ADMIN`**, non toccata da questo mandato:
     `PLATFORM_TAXONOMY_STEWARD` non nasce qui.
   - `R-5` è un ruolo di **piattaforma** (asse `haMandatoPiattaformaAssegnato`, D9=B — R-0, non
     I23): scrive `tenant_blueprint:write` su un fascicolo che è **già** del cliente assegnato,
     non genera una riga `tenant_id NULL`. Coerente con la riclassificazione sopra:
     `sys_tenant_blueprints` è modo C (tenant nullable, oggi sempre valorizzato quando esiste),
     non modo B — R-5 non esercita mai il lato «genera» della catena su questa tabella.
3. **Nessuna rigenerazione del semilavorato tocca un'attivazione o un processo esistente** — non
   li aggiorna, non li ricrea, non li legge: l'assenza è totale, verificata sopra. Un cambiamento
   futuro a questo comportamento (per esempio, far scrivere la rigenerazione su quelle tabelle) è
   un cambiamento architetturale, non un refactor — va per una nuova voce di decisione, non
   silenzioso.
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
