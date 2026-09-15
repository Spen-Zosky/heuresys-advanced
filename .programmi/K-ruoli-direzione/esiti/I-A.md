# I-A — La rigenerazione del semilavorato conserva le personalizzazioni? (passi 12 e 13) — ESITO

Data: 2026-09-15, sessione S1103. Lettore W1 `I-A` (sonnet, `evidenze/wf_F1_W1_202609150148`), spia trovata, 4 comandi verificati (1 discrepanza = la spia); passo 13 eseguito **in linea su copia** (evidenza `evidenze/I-A_passo13_202609150323.txt`).

> **La frase misurata che K1-ADR deve riportare:** *alla rigenerazione le personalizzazioni del cliente **si conservano** — non perché una regola le protegga, ma perché **nessuna rigenerazione le tocca**: la materializzazione non legge né scrive `sys_blueprint_overrides` (0 occorrenze di `override` in `tenant-materialization/{build-plan,repository}.ts`), l'unico scrittore è il CRUD del modulo `blueprint-overrides`, e la supersessione di una corsa aggiorna il registro solo sulle righe `status='GENERATED'` con `target_record_id` esatto (`approvals/effects/tenant-import-run.ts:174-183`). L'unico modo di perderle è cancellare il padre (`ON DELETE CASCADE` su attivazione e processo), che nessuna rigenerazione fa.* Provato sul vivo (copia): override inserito prima, applicazione, override identico dopo.

## Passo 12 — misure (verificate)

| misura | numero | comando |
|---|---|---|
| righe di `sys_generated_record_origins` con `superseded_by_run_id` valorizzato | **0** (il registro è **vuoto**: 0 righe in tutto) | `q.py "select generated_record_origin_target_table, count(*) from sys.sys_generated_record_origins where generated_record_origin_superseded_by_run_id is not null group by 1"` · `select count(*) …` → 0 |
| `sys_blueprint_overrides` per `inclusion` | **7** = IN 4 · PARTIAL 2 · OUT 1 | `q.py "select blueprint_override_inclusion, count(*) from sys.sys_blueprint_overrides group by 1"` |
| override con attivazione **e** processo ancora vivi | **7/7** | `q.py "select count(*) from sys.sys_blueprint_overrides o join sys.sys_blueprint_process_registry p on … join sys.sys_blueprint_activations a on …"` |
| scrittori di `superseded_by_run_id` in `apps/api/src` | **1** | `rg --no-ignore --hidden -n superseded_by_run_id apps/api/src` → `approvals/effects/tenant-import-run.ts:180` |

Le tre domande, con file:riga:

1. **Una corsa nuova che sostituisce una vecchia tocca le righe del cliente non generate?** No. `tenant-import-run.ts:161-172` disattiva solo i segnaposto `user_type='GENERATED_INCUMBENT'`; `:174-183` marca `superseded_by_run_id` **solo** sulle righe del registro con `status='GENERATED'` e `target_record_id` uguale. Una riga nativa non ha mai avuto una riga di registro: non può soddisfare quel `WHERE`. Sul vivo il meccanismo non ha ancora scritto nulla (registro a 0 righe).
2. **Gli override sopravvivono?** Sì, **per assenza di tocco**: `tenant-materialization/build-plan.ts` e `repository.ts` non contengono `override`; unico scrittore/lettore `blueprint-overrides/repository.ts`; FK `ON DELETE CASCADE` verso `sys_blueprint_activations` e `sys_blueprint_process_registry` (nessun soft-delete sul registro processi). Nessuna rigenerazione cancella attivazioni o processi (nessuna `DELETE` su quelle tabelle fuori dai CRUD per id — ricontrollato dal critico).
3. **C'è una prova automatica?** Prima di oggi **solo in parte**: la supersessione ha il caso T7 (`tenant-import-run-effect.integration.test.ts:90,125-157`); sugli override c'erano solo 7 test CRUD/auth (`blueprint-overrides.integration.test.ts`) e 3 test di applicazione senza override. **Da oggi sì**: passo 13.

## Passo 13 — prova su copia (IN LINEA)

«Copia» = l'isolamento transazionale per file (D-52: una transazione per file, rollback alla fine) sul database `heuresys_ci` del gemello, via `db/scripts/prova-api-sul-gemello.sh`: **niente resta scritto**, e la produzione è intatta (`q.py "select count(*) from sys.sys_blueprint_overrides where blueprint_override_rationale like '%passo 13%'"` → 0).

Due `it` nuove in `apps/api/test/tenant-blueprint-application.integration.test.ts`, in coppia attorno all'applicazione pulita:
- **prima**: nasce un processo del modello, un'attivazione del cliente di prova e un override `OUT` con ragione «mandato K, I-A passo 13»;
- **dopo** l'applicazione del fascicolo: l'override esiste ancora, `OUT`, stessa ragione, attivazione e processo padri vivi, e il registro del generato non ha marchiato `sys_blueprint_overrides` (0 righe: l'override è del cliente, non della piattaforma).

| corsa | esito | comando |
|---|---|---|
| verde | **5/5** (3 esistenti + 2 nuove), 9 s | `bash db/scripts/prova-api-sul-gemello.sh test/tenant-blueprint-application.integration.test.ts` |
| **rossa** (controprova: `DELETE` dell'override dentro la transazione del test, prima della misura) | **1 failed / 4 passed**, exit 1 — «l'override e' sparito con la rigenerazione» | stesso comando; sabotaggio poi rimosso (`grep -c SABOTAGGIO` → 0) |

Limite dichiarato: la ri-applicazione dello **stesso** fascicolo è rifiutata per costruzione («un fascicolo GIÀ applicato non si riapplica»), quindi la «rigenerazione» provata sul vivo è l'applicazione con override preesistente; la sostituzione di corsa (`superseded_by_run_id`) è dimostrata dal codice (§passo 12, domanda 1) e dal caso T7, non da una seconda prova con override.

## Verdetto

- **SBLOCCA K1-ADR** con la frase in cima. Il K1-ADR deve dire anche che la conservazione è **per assenza di tocco**, non per regola: se un giorno una rigenerazione volesse ricreare attivazioni o processi, gli override cadrebbero per CASCADE — è lì che l'ADR deve mettere l'invariante («la rigenerazione non cancella mai un'attivazione o un processo: li aggiorna in posto»).
- Nessuna decisione nuova per Enzo.
