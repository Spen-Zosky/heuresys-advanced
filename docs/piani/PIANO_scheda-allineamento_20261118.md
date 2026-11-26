# Piano: la scheda «Allineamento» nella pagina del consolidamento

Data: 2026-11-18. Thread «Aggiungere la scheda Allineamento al consolidamento». Nasce dall'analisi del 18/11 (`consolidamento/20261118_CONSOLIDAMENTO_E_ALLINEAMENTO_ANALISI.md` nei file del progetto) e dal sì di Enzo del 18/11 alle 04:06 UTC alla proposta di costruire in advanced il disegno della pagina «Corsa del 10/10 e RTL Bank» della console del datastore, con i numeri di advanced e le decisioni di chi ha l'autorità. Scelta sul pulsante rosso (18/11, coordinatore su delega di Enzo, opzione raccomandata): registra le decisioni approvate; i dati di RTL cambiano dopo, con il motore dell'allineamento provato su copia (tappe B-C-E di `PIANO_allineamento-consolidamento_20261116.md`).

Vincolo di Enzo: niente deve rompersi. Quindi tutto è aggiuntivo: la console del datastore non si tocca (nessun file di heuresys-datastore cambia); la rotta `/distance`, i giri e le decisioni dei giri restano come sono; le parti nuove stanno in una tabella nuova, in rotte nuove e in una scheda nuova accanto alla pagina di sempre.

Che cosa non si chiude in questo ciclo: l'applicazione delle decisioni ai dati di RTL (tappe B-C-E); il passaggio della console ai numeri di advanced (lavoro separato, nel repo del datastore).

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| SA1 | Registro delle decisioni: `sys.sys_alignment_decisions` (000499), bozza e approvata per voce; 000062 e 000429 emendate per la tabella nuova | Claude | catena applicata due volte sul gemello senza errori | in corso · nel codice: `db/migrations/000499_le_decisioni_dell_allineamento.sql` (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); la dimostrazione dal vivo non è stata riletta |
| SA2 | API: `GET /v1/consolidation-runs/:runId/alignment` (24 domini in 13 famiglie, copertura, voci con chiave, proposta e decisioni), `PUT …/alignment/drafts`, `POST …/alignment/approve` (il pulsante rosso), `POST …/alignment/discard`; decide solo chi ha `consolidation:decide` | Claude | prove `test/unit/allineamento.unit.test.ts` e `test/consolidation-alignment.integration.test.ts` verdi in CI; impronta di unità e posizioni del tenant uguale prima e dopo | in corso · nel codice: `apps/api/src/modules/tenant-consolidation/allineamento.ts` (riesame Z4 del 2026-11-26, `docs/piani/ai-driven_20261126/RIESAME_programmi.md`); la dimostrazione dal vivo non è stata riletta |
| SA3 | Scheda «Allineamento» in `/consolidation`: quadro per famiglie, un dominio alla volta con le sole divergenze, filtri per esito e decisione, ricerca, pulizia dei doppioni, decisione per voce, «Accetta le proposte» in blocco, avviso arancione con pulsante rosso e conferma | Claude | login di Valentina Conti (Direttore HR di RTL) in produzione: schermate del quadro e di un dominio, numeri uguali a quelli dell'API | in corso |
| SA4 | S1: i giri leggono l'indirizzo ESCO delle competenze e l'occupazione e il ruolo delle posizioni del modello dalle colonne (000454, 000458), non dai metadati vuoti | Claude | prova d'integrazione che legge l'ESCO della colonna; dal vivo, quante competenze del modello portano l'ESCO nei giri | in corso |
| SA5 | I sei cataloghi con un nome ancora fuori dai giri (contratti, obblighi, formazione, carriere, incentivi, commesse), in modo aggiuntivo | Claude | nella stessa PR, commit a parte: sei gruppi in coda a `CONSOLIDATION_GROUP_VALUES` (i cinque di prima invariati), sorgenti dei due lati in `sorgenti.ts`, vincoli allargati dalla 000500 (idempotente, nessun dato cambia), decisioni dei sei cataloghi solo registrate nel collegamento (nessuna scrittura sui dati del tenant), obblighi con il lato del tenant vuoto perché advanced non ha la tabella; prova d'integrazione sui due lati e sui sette vincoli | in corso |
| SA6 | Rilascio con il turno del coordinatore e verifica dal vivo | Claude | `scripts/verifica-deploy.sh` DEPLOYATO; giri e scheda aperti come Valentina Conti | da fare |

## Le scelte, in breve

- La proposta per voce: Unisco per una coppia riconosciuta (uguale in parte o diversa), Adotto per una voce del solo modello, Tengo per una voce del solo tenant, Tolgo per un doppione del tenant nei cataloghi (stesso nome due volte). I ruoli di accesso restano del tenant. Le voci uguali non chiedono decisioni.
- La chiave di una voce è un'impronta di dominio, lato, nomi normalizzati e ricorrenza: la decisione resta attaccata alla voce fra una misura e l'altra; se la voce sparisce (i dati sono cambiati), la decisione si conta come superata e non si perde.
- Le decisioni ammesse per lato stanno nel contratto condiviso (`ALLOWED_ALIGNMENT_DECISIONS`), così la pagina mostra le stesse scelte che la rotta accetta.

## Registro delle scoperte

Vuoto all'apertura.
