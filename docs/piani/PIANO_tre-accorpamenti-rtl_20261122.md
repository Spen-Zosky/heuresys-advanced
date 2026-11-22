# Piano: tre accorpamenti dei processi di RTL Bank (2026-11-22)

Decisione di Enzo del 2026-11-22: dei nove accorpamenti che il consolidamento ha applicato il 2026-11-17, tre non reggono. P26 «Servizi IT core banking» (fiducia 45) e P20 «Gestione del credito» (fiducia 55) restano separati; P04 «Rischio operativo e antiriciclaggio» esce da 10 «Gestione del rischio» e va dentro 02 «Adeguata verifica e antiriciclaggio». Misura che ha portato qui: `esecuzione/_misure/processi_rtl_datastore_contro_advanced_20261122.md` in heuresys-datastore.

Fuori da questo ciclo: gli altri sei accorpamenti, che restano come sono; le attività, le unità e il responsabile dei tre sottoprocessi nuovi, che nascono vuoti come i 21 adottati il 2026-11-17.

| Id | Cosa | Chi | Fatta quando | Stato |
|---|---|---|---|---|
| T1 | `db/scripts/processi/separa-tre-accorpamenti.sql` e la sua inversa, con prova a secco | Claude | le due prove a secco (andata, e andata più ritorno in una transazione annullata) danno i numeri attesi | fatta |
| T2 | La mappa di `colloca-sottoprocessi.sql` dice P04 sotto 02 e P20 sotto 05 | Claude | una nuova corsa dello script non trova stati inattesi | fatta |
| T3 | CI verde e revisione del codice da un thread nuovo | coordinatore | PR unita | da fare |
| T4 | Backup verificato, poi `-v applica=1` in produzione | Claude | NOTICE «fatto: 21 processi di primo livello e 24 sottoprocessi attivi, 3 descrizioni ritirate, 3 creati, 0 difetti» | da fare |
| T5 | Verifica dal vivo | Claude | la matrice di `/tenant-processes` scrive «21 processi e 24 sottoprocessi» | da fare |

## Simulazione

Che cosa deve essere vero prima: le tre proposte PROCESSES di P04, P20 e P26 sono correnti e la loro decisione in vigore (`sys_tenant_consolidation_links`) è CONFERMATA; nessun processo di RTL ha i codici P04, P20, P26; 02, 05 e 16 sono processi attivi di primo livello; il modello in uso (`sys_blueprint_process_registry`, versione del consolidamento) ha le tre voci. Lo script lo misura e si ferma senza scrivere se una condizione manca.

Che cosa produce l'effetto: lo script, nella stessa semantica di `apps/api/src/modules/tenant-consolidation/applicazione.ts`. Per ogni proposta scrive una decisione RIFIUTATA che sostituisce la CONFERMATA; ritira dal giornale `staging.tenant_consolidation_undo` la descrizione che la CONFERMATA aveva copiato nel processo di RTL (solo se è ancora quella); crea il P come sottoprocesso con nome e descrizione del modello; scrive il giornale INSERT e aggiorna il collegamento. Gira col ruolo `heuresys_agenti` (`deploy/postgres/env-agenti.sh`), che non crea strutture: per questo nessuna tabella nuova.

Chi decide è registrato come l'Amministratore di Sistema (l'utente di Enzo), non come chi aveva deciso il 2026-11-17.

Distruttivo: no. Niente DELETE; l'inversa spegne i tre sottoprocessi, rimette le descrizioni e una CONFERMATA nuova. Guardia nel caso limite: post-condizione con impronta di tutte le colonne dei processi esistenti tranne descrizione e `updated_at`, e la sentinella `sys.v_tenant_processes_parent_defects` a zero; se qualcosa non torna la transazione si annulla.

Comandi (dalla radice di heuresys-advanced, sulla VM):

```bash
bash ~/.claude/tools/backup-verificato.sh heuresys_advanced
. deploy/postgres/env-agenti.sh
psql -h localhost -p 5432 -d heuresys_advanced -X -f db/scripts/processi/separa-tre-accorpamenti.sql              # prova a secco
psql -h localhost -p 5432 -d heuresys_advanced -X -v applica=1 -f db/scripts/processi/separa-tre-accorpamenti.sql # applica
```
