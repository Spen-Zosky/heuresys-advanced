# PIANO — registro delle corse, modello di partenza e scelta della corsa in /consolidation (2026-11-14)

Richiesta di Enzo (thread «Registrare le corse e scegliere il modello in consolidamento», 2026-11-14 03:39 e 03:43 UTC): la corsa RTL confrontata il 10-11/11 diventa la versione di modello di partenza di advanced; le versioni precedenti si eliminano; in /consolidation si sceglie la corsa o il modello del datastore con cui rifare un giro di allineamento con l'agente; un registro ricorda per ogni corsa le date di esecuzione, il modello, la data del modello, i risultati iniziali della consolidation e quale è diventata definitiva; la pagina parte dalla voce di registro più recente. Alla prima esecuzione su un modello mai consolidato la pagina avvisa (descrizione del modello e data di caricamento in advanced) e misura il tempo dell'agente. Le decisioni del giro del 01/11 si eliminano perché prese contro il modello sbagliato.

Lettura scelta: «la corsa del 10-11/11» è la corsa del datastore `p20261010010521tjb` (eseguita il 2026-10-10 01:05-03:24 UTC, pacchetto 0.3 numero 2, impronta 94a9bc80…), quella confrontata con RTL il 10/11 e l'11/11 (`heuresys-datastore/esecuzione/_misure/CONFRONTO_TJB_RTL_20261111`). Nessuna corsa del banco è nata il 10 o l'11/11 (misurato su `datastore_bench_prototype`).

Stato misurato il 2026-11-14 alle 03:50 UTC sulla produzione (sola lettura): RTL attivo su FIN_BANKING / REGIONAL_RETAIL_BANK_MEDIUM versione 1 (d5ef21db…, creata il 2026-08-08, 33 unità, 71 posizioni); nessun pacchetto ricevuto (`sys_blueprint_content_packages` e `sys_blueprint_content_receipts` vuote); una sessione di consolidamento aperta (77b96bd7…, 01/11, gruppo ORGANIZATION) con 57 proposte, 47 decisioni, 43 collegamenti; il giornale di ritorno porta 2 righe INSERT (unità AREA-01 e AREA-02, senza figli né posizioni).

Fuori da questo ciclo: il ritorno al datastore (AC-14); la consegna automatica dal datastore (resta il verbo `POST /v1/fascicoli/:prototipo/consegna` del datastore).

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| R0 | Consegna della corsa dal datastore: `POST 127.0.0.1:3101/v1/fascicoli/p20261010010521tjb/consegna {versione:2}` | Claude | cartella `consegne/p20261010010521tjb/2` con manifesto e pacchetto | fatta 03:44 UTC |
| R1 | Migrazione 000489: `sys.sys_blueprint_runs` (registro delle corse per tenant) + avvio della sessione legato alla corsa | Claude | catena verde su copia, riapplicata senza differenze | fatta: catena verde due volte su copia (000062 e 000429 emendate) |
| R2 | API: `GET /v1/consolidation/runs` (registro, più recente prima), `GET /v1/consolidation/runs/available` (consegne del datastore, con «già nel registro»), `POST /v1/consolidation/runs/receive` (accoglie una consegna come nuova versione di modello e la registra), `POST /v1/consolidation/runs/:id/definitive`; `POST /v1/consolidation` accetta `runId`; il primo giro di ogni gruppo scrive i risultati iniziali e il tempo dell'agente nel registro | Claude | prove d'integrazione verdi | fatta: 17/17 prove sul consolidamento verdi su copia |
| R3 | Pagina /consolidation: scelta della corsa (predefinita la più recente del registro), storico del registro, avviso «modello mai consolidato» con descrizione e data di caricamento, tempo dell'agente | Claude | login reale di una persona HRMS_MANAGER di RTL | scritta, prova dal vivo dopo il rilascio |
| R4 | In produzione, dopo backup verificato: accogliere la consegna e registrarla come corsa più recente (attivazione rimandata, vedi S2) | Claude | attivazione ACTIVE di RTL sulla nuova versione, riga nel registro | da fare |
| R5 | Annullare il giro del 01/11 (2 unità con il giornale di ritorno, sessione con proposte, decisioni, collegamenti) ed eliminare la versione vecchia | Enzo dà il sì nel thread, Claude esegue | conteggi a zero, backup prima | giro annullato 03:52 UTC (sì di Enzo 03:44:55); eliminazione della versione vecchia: aspetta Enzo |
| R6 | PR, CI verde, unione, rilascio, verifica dal vivo | Claude | `scripts/verifica-deploy.sh` DEPLOYATO e R3 ripetuta in produzione | da fare |

## Simulazione

R1. Vero prima: 000488 è l'ultima. Strumento: `db/scripts/migrate.sh` sulla copia `heuresys_corse_prova1` (restore della produzione, creata e cancellata da questa sessione). Nessuna cancellazione; IF NOT EXISTS.

R2. La ricezione dall'API riusa il caricatore verificato `db/scripts/pacchetto/accogli-pacchetto.mjs ricevi`: solo inserimenti, idempotente per impronta, una riga di ricevuta per ogni esito. La cartella delle consegne la dichiara l'ambiente (`DATASTORE_CONSEGNE_DIR`); senza, l'elenco è vuoto e la pagina lo dice. ADR-0043: advanced non legge il database del datastore, legge solo la cartella delle consegne.

R4. Strumenti: `bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`, poi `accogli-pacchetto.mjs ricevi heuresys_advanced <cartella> <uscita> --produzione`, poi pubblicazione e attivazione con SQL in una transazione con guardia (RTL ha una sola attivazione ACTIVE e punta a d5ef21db). Ritorno: riattivare d5ef21db (finché non è eliminata).

R5. Distruttiva, dati non creati da questa sessione: si esegue solo con il sì scritto di Enzo, dopo backup verificato, con l'elenco esatto.

## Registro delle scoperte (fuori da questo ciclo, da proporre a Enzo una volta)

- S1 (03:51 UTC). Le unità create da un'adozione del consolidamento senza responsabile fanno fallire `000247_organization_unit_managers.sql` a ogni deploy. Tolte AREA-01/02 con R5; il difetto di fondo resta nel modulo tenant-consolidation (thread della pagina avvisato).
- S2 (04:10 UTC). Il pacchetto 0.3 della corsa tjb non porta ruoli né cruscotti (richiesta M2-M6 del programma di consolidamento): attivarlo per RTL svuoterebbe il profilo (`lib/scope/profilo.ts`) e la 000400 fallirebbe per le porte di ricompensa. Quindi R4 si ridimensiona: la corsa entra nel registro come voce di partenza e il consolidamento si fa contro di lei; l'attivazione aspetta un pacchetto completo. «Rendi definitiva» rifiuta un modello senza ruoli o cruscotti e porta con sé le porte di ricompensa.
- S3 (04:08 UTC). Ogni versione accolta con `ricevi` accende la sentinella `sys.v_processi_senza_kpi` (30 processi della corsa tjb senza modelli di indicatore): `ricevi` per disegno (C3) non scrive indicatori di piattaforma. La vista non è creata da nessun file del repo.
- S4. Il modello vecchio (FIN_BANKING v1) non si cancella e per ora non si ritira: è ancora il modello in uso di RTL (S2), e cancellarlo toglierebbe 96 assegnazioni processo-unità, 73 modelli di indicatore e 7 porte di RTL.

Configurazione di macchina (non nel repo): drop-in `/etc/systemd/system/heuresys-advanced-api.service.d/consegne-datastore.conf` con `DATASTORE_CONSEGNE_DIR`.

## Prossimo ciclo, già accettato da Enzo (2026-11-14 04:49 UTC): la cascata della decisione

Nella finestra della decisione l'agente spiega la cascata della voce (prerequisiti: per un'unità l'unità madre e il responsabile; conseguenze: posizioni, processi, indicatori che dipendono da lei nel modello) e fra le scelte c'è «Aggiorna cascata», che applica insieme la voce e le sue dipendenze. La cascata si ricava dai legami reali dello schema (chiavi esterne) e del contenuto del modello, mai da un elenco scritto a mano; si vede prima di confermare; si applica in un'unica transazione con il giornale di ritorno (`staging.tenant_consolidation_undo`). Caso che lo motiva: S1. PR separata, dopo il rilascio della PR 248; tocca `applicazione.ts` e `decisione-dialog.tsx`, da coordinare con il thread della pagina.

## Prossimo ciclo, proposto dal thread degli organigrammi (2026-11-14 04:57 UTC): sede e organico delle unità

Il modello porta per ogni unità `blueprint_content_unit_site_code` (sede centrale, centro operativo, filiali), `blueprint_content_unit_planned_headcount` e `blueprint_content_unit_headcount_note` (il perché di quell'organico); `sys.sys_organization_units` non ha dove tenerli (solo `organization_unit_metadata`). Valutazione: il consolidamento li porta nei dati, con colonne vere (sede come riferimento alle sedi del tenant, organico previsto, ragione dell'organico) e non dentro il jsonb, così le viste a blocchi dell'organigramma diventano uguali a quelle del banco. Entra nella cascata dell'unità (ciclo sopra): adottare o confermare un'unità porta anche la sua sede e il suo organico. Prima indagine: dove advanced tiene già le sedi (`sys.sys_branches`, legata alle unità) e chi legge `organization_unit_metadata`.

## Prossimo ciclo, base della PR della cascata (Enzo, 2026-11-14 05:14 UTC): oggetto di lavoro e approvazione definitiva

Cambia la base del consolidamento, quindi viene prima della cascata e della sede/organico.

| id | cosa | fatta quando |
|---|---|---|
| W1 | Decisioni, «Esegui modifiche (N)» e «Passa alla sezione successiva» scrivono solo nell'oggetto di lavoro della sessione (estende `sys_tenant_consolidation_working_items`); le valutazioni toccate da una modifica o da una cascata si ricalcolano lì | prova: dopo «Esegui modifiche» i dati vivi del tenant sono identici (conteggi e impronte) |
| W2 | Pulsante rosso «Approva definitivamente le modifiche»: solo il Direttore HR, conferma esplicita con l'anteprima delle differenze; backup verificato automatico; un'unica transazione con il giornale di ritorno | prova d'integrazione e login reale |
| W3 | Guardie lato server: un solo oggetto di lavoro aperto per tenant; controllo di obsolescenza (i dati vivi toccati non sono cambiati dall'apertura, altrimenti si rivalida); niente approvazione con un giro dell'agente in corso; dentro la transazione girano i controlli degli invarianti che oggi scattano al rilascio (caso S1: 000247), e se uno cade l'approvazione si ferma e lo dice; «Scarta modifiche» | prove rosse prima e verdi dopo |
| W4 | Flag «modifiche non approvate» sulla sessione di consolidamento, letto nella chiamata che dopo il login carica i permessi; segnale arancione intermittente nell'header fino all'approvazione, con testo e link alla pagina (leggibile anche con l'animazione ridotta) | E2E: la prima decisione accende il segnale, l'approvazione o lo scarto lo spengono |
| W5 | Il registro delle corse tiene anche l'esito finale: chi ha approvato, quando, quante modifiche per gruppo | prova d'integrazione |
| W6 | La 000247 conta solo il tenant per cui è scritta (RTL), così un altro tenant non rompe la catena | catena verde su copia con un'unità senza responsabile in un altro tenant |

Poi, su questa base: la cascata della decisione e la sede/organico delle unità (sezioni sopra).
