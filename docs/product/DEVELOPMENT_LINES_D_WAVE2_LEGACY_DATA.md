# Development Lines — Serie D: Wave-2 mirata — i dati legacy che valgono

> **Stato**: PROPOSTO — selezione = Enzo. **Provenienza**: sweep legacy:primary S1016 (DB `heuresys_platform` su VM, 588 tabelle; 78 con >1000 righe di cui **65 NON coperte** dal registry brownfield — solo Wave-1, 97 mapping). Regola T2.
> **Perimetro**: import DATI dal legacy verso tabelle `sys.*` (in molti casi già esistenti e vuote/parziali). Infrastruttura pronta: executor wave-agnostico (S957), dottrina I14 (`LEGACY_EMP::`), data dictionary completo in `db-export/` (576 tabelle, 950 FK, 16 domini lexicon).
> **Vincolo noto**: transform-compiler supporta 12 codici meccanici; `JSON_EXTRACT`/`LINEAGE_SOURCE_NK` dichiarati non supportati (`transform-compiler.ts:8-10`) — da estendere se un dominio li richiede.

## Le linee (per dominio legacy, ordinate per leva)

### D1 — Possesso skill per-dipendente (lo storico che manca a skill-gap) ⭐
- **Dati legacy**: employee_skill_assessments **3.140** · employee_skills 1.445 · employee_skill_mappings 1.121 · career_skills 1.106 · position_skill_requirements 1.632. Wave-1 ha importato la TASSONOMIA, non il possesso.
- **Target**: `sys_user_skills` + evidence layer (si aggancia a Serie A-L2) + requirements posizione.
- **Webapp che si accendono**: `/insights/skill-gap` (gap su storico reale, non solo snapshot) · `/analytics/skills` · `/me/skills` (storico personale) · `/gaps`.
- **Effort**: ~1,5-2. **Valore**: people-analytics e skill-gap passano da dimostrativo a credibile.

### D2 — Engagement/PULSAR storico (sblocca il flight-risk vero)
- **Dati legacy**: survey_responses **4.482** · check_ins 2.495 · engagement_survey_responses 1.327 · pulse_checks 1.145 · wellbeing_checkins 1.142.
- **Target**: cluster engagement/surveys già a schema. NB dal sweep: la CTE engagement del flight-risk oggi ignora le survey API-created (dual-shape) — l'import è l'occasione per unificare la shape (fix incluso).
- **Webapp**: `/engagement` + `/engagement/[surveyId]` (storico reale) · `/insights` (feature engagement del flight-risk finalmente alimentata) · `/me/surveys`.
- **Effort**: ~1,5. **Valore**: l'insight più venduto (flight-risk) oggi gira con la gamba engagement muta.

### D3 — Storia dei goal (GOKMER)
- **Dati legacy**: goals 1.068 · goal_updates 1.811.
- **Target**: `sys_goals` (632 già backfillati S1011) + `sys_goal_updates` (che la Serie A-L1 espone). D3 e A-L1 sono gemelli naturali: importare + esporre in un'unica ondata.
- **Webapp**: le stesse di A-L1 (`/goals`, `/me/career` tab Obiettivi).
- **Effort**: ~1.

### D4 — Knowledge graph legacy (l'asset semantico più grande)
- **Dati legacy**: kg_edges **139.451** + kg_nodes 17.260 (+ mv_occupation_similarity 69.182). Zero mapping.
- **Target**: da decidere in design — candidati: arricchire `sys_skill_taxonomy_edges` (oggi 11.965), popolare graph_type di visualization oggi a 0 dati, o nuovo dominio kg. Si sposa col rilievo "skill-graph consumato come tabelle, non come grafo" (S-LAT6).
- **Webapp**: `/visualizations` (i graph_type oggi senza dati) · `/me/matching` e `/skills` (reasoning semantico più ricco). Componente `KGGraphCanvas` di @heuresys/ui costruito apposta e MAI usato.
- **Effort**: ~2-3 (serve design di destinazione prima dell'import). **Valore**: differenziatore "grafo 5-dimensioni" con sostanza.

### D5 — Timeline dipendente
- **Dati legacy**: analytics_events 5.000 · employee_timeline 4.641.
- **Target**: event-log consultivo per persona (attenzione: NON è l'event-sourcing di dominio — è storia importata read-only).
- **Webapp**: `/users/[userId]` (tab Timeline) · `/me` (la mia storia).
- **Effort**: ~1-1,5. **Valore**: profondità percepita del profilo persona; seme per il futuro event-sourcing (seme Later).

## Vincoli di metodo (per tutte)

- Registry-first: ogni dominio entra in `brownfield.table_mappings` con wave=2 (oggi 0 righe wave-2 — il residuo non è nemmeno pianificato a registry) — sana anche il caveat "ingestione S950 fuori registry".
- Chiave I14 (`LEGACY_EMP::<employees.id>`), idempotenza ON CONFLICT, `uuid_generate_v5` (memoria RFC-4122), lineage in `sys_source_lineage_records` (che la Serie A-L0 rende visibile: le due serie si rafforzano).
- Stats legacy: `pg_stat_user_tables` è azzerata sul legacy → usare `reltuples`/count reali (lezione sweep).

## Webapp impattate (riepilogo serie)

| Pagina | Linee | Nuova? |
|---|---|---|
| /insights/skill-gap, /analytics/skills, /me/skills, /gaps | D1 | no |
| /engagement, /engagement/[surveyId], /insights, /me/surveys | D2 | no |
| /goals, /me/career | D3 | no |
| /visualizations (+graph_type dormienti), /me/matching | D4 | no |
| /users/[userId] (tab Timeline), /me | D5 | no (tab nuove) |

## Sequenza raccomandata

D1 → D2 (+fix dual-shape) → D3 (con A-L1) → D5 → D4 (dopo design). Totale ~7-9 sessioni se tutto.
