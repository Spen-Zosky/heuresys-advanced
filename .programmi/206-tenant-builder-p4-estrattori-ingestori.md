# 206 — Tenant Builder P4: estrattori e ingestori, il dato vero prende il posto del provvisorio

> **item**: #206
> **stato**: IN CORSO
> **ripresa**: Enzo, «#206» dalla corsia HOLD, S1098 (2026-09-13). Il trigger dichiarato (`#198` T9b)
> NON è scattato: la ripresa è la seconda via prevista dal blocco («riprendi #206»).

Le persone vere entrano nell'azienda che P3 ha costruito: estrazione registrata come fonte,
atterraggio senza tipi, validazione contro il profilo atteso (E19), firma della corsa (E26),
iniezione nelle posizioni con il registro dell'origine che passa a `CONFIRMED`/`SUPERSEDED`.

Specifica e piano (lab, 2026-08-16, **non verificati** finché non misurati — `#149`):
`D:\heuresys-design-lab\2026-08-16--epic-tenant-builder-p4-estrattori-e-ingestori.md` ·
`D:\heuresys-design-lab\2026-08-16--piano-implementazione-p4-estrattori-e-ingestori.md`.

## Decisioni vincolanti di Enzo (prese, non si ri-chiedono)

- **E19** i dati iniziali sono i parametri di controllo dell'importazione.
- **E25** la persona entra SEMPRE; è la POSIZIONE a restare segnalata (vista, non colonna — T5 fatto).
- **E26** si firma l'IMPORTAZIONE, non la persona: una richiesta di approvazione per corsa.
- **E27** si sperimenta prima sul gemello, in produzione una volta sola sul dato vero.
- **E29** l'archetipo scritto a mano è sparito (`#132` F3): un modello nato dalla ricerca **non
  inventa persone** (`incumbents: []` in `blueprint-build-source.ts`).
- **I12** nessuna riga dal legacy. **ADR-0035** ritirare ≠ cancellare.

## Analisi avversariale della consegna — misurata 2026-09-13 sul DB vivo (S1098)

| # | La consegna dice | Misurato | Correzione adottata |
|---|---|---|---|
| C-1 | P4 «sostituisce il segnaposto con la persona vera» | `sys_users`: **0** `GENERATED_INCUMBENT` (161 STANDARD, 3 SERVICE); l'unica sorgente viva (`BLUEPRINT_CONTENT`) produce `incumbents: []` per decisione (E29) | **Il caso normale è la posizione VACANTE**: la persona vera riceve l'incarico PRIMARY ACTIVE su una posizione senza occupante e la posizione passa a `CONFIRMED`. La sostituzione del segnaposto resta come **ramo secondario** (lo schema lo ammette ancora: `user_type` CHECK + `materialize` sa crearli) e si prova costruendo il segnaposto nella fixture |
| C-2 | la corsa è una riga di `reference_sync.import_runs` con scope `tenant_import` (T1) | `import_run_classification_scope` **senza CHECK** (2 NULL · DEMO 1 · reference_sync 915 · wave_executor 286); ma candidati, validazioni e decisioni hanno FK su **`sys_seed_acquisition_runs`**, non su `import_runs` | **La corsa è una `sys_seed_acquisition_runs`** (tenant-scoped, `source_registry_payload` porta la fonte). `import_runs` NON si usa: due righe di corsa per un atto solo sono un difetto. T1 si chiude «nessuna modifica», con la misura |
| C-3 | `source_exports` «porta già l'impronta» e rende la corsa idempotente (T3) | `source_export_file_hash char(64)` **senza vincolo di unicità** (6 righe, 4 con hash, 0 duplicati) | T3 aggiunge l'indice unico parziale `WHERE hash IS NOT NULL` (mig nuova) + ricerca per impronta nel service. Senza, l'idempotenza sarebbe un proposito |
| C-4 | esiti `AMMESSA / AMMESSA-CON-SCOSTAMENTO / CIECA` in `sys_seed_validation_results` (T4) | CHECK sullo status: `PASSED / FAILED / WARNING / SKIPPED` | Mappa: AMMESSA=`PASSED` · CON-SCOSTAMENTO=`WARNING` · CIECA=`SKIPPED`; `rule_code = 'E19_CRITICAL_SKILL_COVERAGE'`, `payload = {esito, attesi, mancanti[]}`. Nessuna modifica di schema |
| C-5 | «senza `sys_generated_record_origins` (che oggi non esiste) P4 non ha nulla da confermare» | La tabella **esiste** (mig 000319), con `superseded_by_run_id` e i tre stati; **0 righe** perché nessuna azienda vera è stata costruita | T7/T8 si costruiscono e si provano ORA (fixture `seminaModello`). Resta bloccato **solo T9** (azienda vera in produzione): `#198` T9b aspetta un modello NON bancario generato dalla ricerca (`MGMT_CONSULTING_SMALL`: 0 unità; `REGIONAL_RETAIL_BANK_MEDIUM`: 33 unità · 71 posizioni) |
| C-6 | (non lo dice) | `sys_user_position_assignments` ha **7 sentinelle BLOCCANTI** (`v_active_primary_assignment_per_user`, `v_deactivated_user_active_assignment`, `v_orphan_position_assignments`, `v_tenant_boundary_violations`, `v_positions_with_critical_skill_gap`…) | L'iniezione crea **un solo** incarico PRIMARY ACTIVE per persona, sulla posizione dello **stesso tenant**, e solo se la posizione non ha già un PRIMARY ACTIVE (a meno che sia un segnaposto, che viene disattivato nello stesso atto) |
| C-7 | la competenza della persona si legge «dal profilo» | La vista T5 legge `sys_user_skills (user, skill)`; una persona importata senza righe lì risulta con TUTTI i critici mancanti | Lo staging porta `skill_codes` (testo, separatore `;`); l'iniezione scrive `sys_user_skills` con `user_skill_source = 'TENANT_IMPORT'` (misurato: la colonna non ha CHECK, valori vivi `SELF_DECLARATION` 537 · `MANAGER_OVERRIDE` 814) |

## Fasi (i nove task del piano — T5 già fatto in S1066)

- [x] **T1 Il tipo di corsa** — FATTO 2026-09-13 come «nessuna modifica necessaria», CON la misura: `pg_constraint` su `reference_sync.import_runs` → 2 CHECK (`status`, `wave`), NESSUNO su `classification_scope` (2 NULL · DEMO 1 · reference_sync 915 · wave_executor 286). E la corsa NON vive lì (C-2): vive in `sys_seed_acquisition_runs`, marcata `metadata.kind = TENANT_IMPORT`
- [x] **T2 La tabella di atterraggio** — FATTO 2026-09-13 · mig `000410`: `staging.tenant_import_people`, 24 colonne del cliente `text` (post-condizione nella migrazione: zero tipizzate), più fonte e n° riga nostri · prova generale sul linux-pc VERDE (due passate, 45/45 sentinelle) · applicata in produzione dalla VM (13 s) · prova: `'31/02/2024'` e `'S'` entrano (`tenant-import-runs.integration.test.ts` T2)
- [x] **T3 L'estrazione registrata come fonte** — FATTO 2026-09-13 · stessa mig: `source_exports_file_hash_uq` (parziale, `WHERE hash IS NOT NULL`) · `POST /v1/tenant-import-runs/sources`: sha-256 della serializzazione canonica, ricerca per impronta PRIMA del nome · prova: stesso contenuto con nome diverso → `alreadyRegistered: true`, stesso id, righe NON ri-atterrate; contenuto nuovo con nome usato → 409 `SOURCE_NAME_TAKEN`
- [x] **T4 La validazione contro il profilo atteso (E19)** — FATTO 2026-09-13 · `tenant-import-runs/validation.ts`: sei regole nominate (`PERSON_EMAIL`, `PERSON_NOT_YET_PRESENT`, `POSITION_EXISTS`, `POSITION_VACANT`, `HIRE_DATE_PARSEABLE`, `E19_CRITICAL_SKILL_COVERAGE`), stesso criterio della vista T5 · tre prove: copre tutto → AMMESSA/PASSED · manca uno → AMMESSA_CON_SCOSTAMENTO/WARNING con l'elenco (`Lean manufacturing`) · zero critici → CIECA/SKIPPED, mai PASSED · in più: la data inesistente esce NOMINATA, due persone sulla stessa posizione → la seconda esclusa
- [x] **T5 La vista dello scostamento (E25)** — FATTO 2026-08-17 (S1066) · `dcec8120`, mig `000318` · prova: oracolo RTL riprodotto 97/299/70/60 più 64 posizioni cieche · `sys.v_positions_with_critical_skill_gap`, dichiarata INFORMATIVA in `db_health.py`
- [x] **T6 L'effetto di approvazione `TENANT_IMPORT_RUN` (E26)** — FATTO 2026-09-13 · `effects/tenant-import-run.ts` registrato (sesto effetto) · `POST /:id/submit` apre UNA richiesta per corsa con le eccezioni nominate nel corpo; approvatori = detentori di `seed_acquisition:approve` nell'azienda, o del tenant di piattaforma se l'azienda non ne ha · prova: sabotato (`guasti.registro`) → 0 persone, corsa RUNNING, fonte AVAILABLE, segnaposto ACTIVE (`tenant-import-run-effect.integration.test.ts`)
- [x] **T7 L'iniezione, e il caso controintuitivo** — FATTO 2026-09-13 · nell'effetto: precondizione RI-VERIFICATA alla firma (④b) · persona STANDARD + incarico PRIMARY ACTIVE + `sys_user_skills` (`TENANT_IMPORT`) · segnaposto → `SUPERSEDED` (con `superseded_by_run_id`), `DEACTIVATED`, incarico `ENDED`, mai cancellato · posizione e unità → `CONFIRMED` · post-condizione viva: 0 posizioni/unità SUPERSEDED o l'atto torna indietro · prova: 3 iniettate, 1 segnaposto sostituito, la vista T5 vede lo scostamento di Carla (1) e non quello di Anna (0), Bruno CIECO
- [x] **T8 Il modulo API `tenant-import-runs`** — FATTO 2026-09-13 · 5 rotte (`POST /sources`, `GET /`, `GET /:id`, `POST /`, `POST /:id/submit`) · permessi misurati sul codice: `seed_acquisition:read` ×2, `seed_acquisition:trigger` ×3, nessuno nuovo · prova: USER senza il permesso → 403 `FORBIDDEN` (non `PERMISSION_DENIED`) · 8/8 + 4/4 test verdi, typecheck e lint verdi
- [ ] **T9 La corsa vera su un'azienda vera (E20)** — ⛔ **FUORI DAL CONFINE DI QUESTA SESSIONE**: pretende `#198` T9b (azienda vera in produzione), che aspetta un modello non bancario dalla ricerca. Qui si fa la **prova sul gemello** (E27) con `REGIONAL_RETAIL_BANK_MEDIUM`, dichiarata esperimento e poi disfatta

## Simulazione R24 (cinque domande, prima di eseguire)

| voce | precondizioni | meccanismo (letto, non presunto) | propagazione | chi | guardia |
|---|---|---|---|---|---|
| T1 | tunnel su (OK boot) | `pg_constraint` su `import_runs`: 2 CHECK, nessuno su scope | solo questo file + registro | io | nessuna scrittura |
| T2+T3 | ultimo file `000409` | mig idempotente `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE hash IS NOT NULL` (0 duplicati misurati → non fallisce) | `ci-rehearsal.sh` sul linux-pc (C2), `pnpm db:migrate:vm` alla chiusura | io | l'indice fallirebbe su duplicati: misurati 0 |
| T4 | `sys_position_skill_requirements` (criticality CRITICAL) e `sys_skills.skill_code` | funzione pura + query; stessa logica della vista T5 | test unit+integration | io | — |
| T6+T7 | registry effetti (`effects/index.ts`), `withTransaction`, `sys_user_skills.user_skill_source` CHECK da misurare | pattern `applyTenantBlueprintApplication` | test integrazione con `seminaModello` | io | UPDATE guardato `RUNNING→COMPLETED`; sabotaggio dichiarato; post-condizione «nessuna posizione SUPERSEDED» |
| T8 | `packages/shared` schemi, `api-module-pattern.md` | 7 passi, `requirePermission` fra i sette | typecheck + test + verify_gate | io | grep permessi |
| T9 (gemello) | linux-pc raggiungibile, clone fresco, modello con contenuto (71 posizioni) | script `prova-live-206.mts` contro il gemello via `sul-gemello.sh` | disfatta a fine prova (E28) | io | gira SOLO dove il DB si dichiara gemello |

**Confine di sessione dichiarato**: T1-T8 completabili qui (budget misurato: `guardiano --budget 400000 → CI STA`, residuo alla soglia 557k). T9 in produzione NO — resta a `#198` T9b.

## Registro delle scoperte fuori ciclo (si presenta UNA volta, non entra in «cosa resta»)

- `import_run_classification_scope` è categoriale senza CHECK e con 2 NULL (RD-08): fuori da questo ciclo.
- `source_exports.source_export_file_hash` nullable su 2 righe storiche: le fonti senza impronta non sono idempotenti; fuori da questo ciclo.

## Mandato di sessione S1098 (Enzo, 2026-09-13)

*«quando hai finito questa corsa, esegui tutti da P1 a P3 in autonomia e automaticamente prendendo
decisioni per mio conto, nell'ordine che ritieni più appropriato. l'unico guardiano che comanda è
quello della capienza»* — dopo `#206`: `#76` F2 → `#214` F6 → `#159` F2 → `#205` F2 → `#149` F4 /
`#79` F3 (continuativi) → `#198` (gated, si riesamina). Registro in `.programmi/S1098-mandato.md`.
