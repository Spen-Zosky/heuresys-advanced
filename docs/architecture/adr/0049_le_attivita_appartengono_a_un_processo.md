# ADR-0049 — Le attività appartengono a un processo

- **Status**: ACCETTATO il 2026-10-29 da Enzo Spenuso (approvazione data in chat alle 04:25 UTC, 05:25 ora di Roma: «accettalo così com'è»); proposto il 2026-10-27 e applicato in produzione con la delega del 2026-10-23 sulle decisioni raccomandate
- **Date**: 2026-10-27
- **Redatto da**: Claude Code, thread «Collegare le attività ai processi»
- **Richiesta**: Amministratore di Sistema, 2026-10-27 17:21 ora di Roma: «Le attività del processo non si possono ancora mostrare, perché nessuna attività registra a quale processo appartiene. Questa mi sembra una carenza grave che deve essere colmata.»
- **Relates to**: ADR-0036 §8 (dominio `process_coordination`, cella ACTIVITY = read), ADR-0044 (la partecipazione appartiene al posto), ADR-0041 e I23 (direzione del dato), ADR-0035 (ritirare non è cancellare)
- **Poggia su**: `.programmi/onda2/DISEGNO_tabelle-onda2.md` §2, T1 e T2 (mandato O2-03, mai eseguito fino a oggi)

> **In parole semplici.**
> 1. Ogni processo del tenant esiste come oggetto suo, con il suo owner, e non più solo come processo del modello agganciato a un'unità.
> 2. Ogni processo ha le sue attività, in ordine, ciascuna con l'unità che la esegue. Per RTL Bank vengono dal datastore: 131 fasi del catalogo APQC per i 23 processi.
> 3. Ogni richiesta di approvazione sa a quale processo (e, quando si sa, a quale attività) appartiene. Lo decide una regola del tenant per tipo di richiesta, non il codice.
> 4. L'owner di un processo vede, in sola lettura, le attività del suo processo e quante richieste vi appartengono, senza i dati delle persone.

---

## Contesto

Misurato il 2026-10-27 su una copia del dump notturno di produzione (`heuresys_advanced_prova_attivita`, cluster utente 5436 sulla VM) e sul database di lavoro del datastore:

- in advanced il processo del tenant è una riga di `sys_organization_unit_processes` (000121) che punta a un processo del modello: 96 righe per RTL Bank, 23 processi, nessuna attività. `sys_blueprint_content_process_steps` (000458) esiste ed è vuota;
- le «attività» che la classe ACTIVITY protegge (`apps/api/src/lib/scope/data-classes.ts`) sono richieste di approvazione, squadre e progetti. Per RTL: 741 richieste (566 ferie e permessi, 115 retributive, 60 formative), 26 squadre e 26 progetti, una per unità. Nessuna porta il processo;
- nel datastore i 23 processi del prototipo 1 hanno ciascuno il proprio concetto APQC, ma zero fasi.

Collegare solo le richieste avrebbe dato qualcosa da vedere al solo owner del processo 17 (Gestione del capitale umano): tutte le 741 richieste appartengono a lui. Gli altri 22 owner avrebbero avuto una pagina vuota, perché una piattaforma HR non registra le pratiche bancarie.

## Decisione

1. **Il processo del tenant** (`sys_tenant_processes`, T1 del disegno dell'onda 2) e la colonna `org_unit_process_tenant_process_id` sulle unità di processo, come da disegno. L'owner è il posto che il modello nomina, se il codice si risolve in un solo posto attivo; altrimenti il posto della partecipazione OWNER attiva sulla riga OWNER del processo, se è uno solo (D-P3-1); altrimenti nessuno, registrato fra i dubbi.
2. **Le attività** (`sys_tenant_process_steps`, T2 del disegno) con un'aggiunta: `tenant_process_step_org_unit_id`, l'unità che esegue l'attività. Il datastore assegna le fasi alle unità (RESPONSABILE o ESECUTORE del processo), non ai posti, e la colonna dell'esecutore per posto, ruolo o agente resta per quando il dato ci sarà.
3. **Le regole** (`sys_tenant_process_activity_rules`): per tenant e tipo di richiesta, il processo e l'attività facoltativa. Un innesco `BEFORE INSERT` dà alla richiesta nuova il processo della regola quando chi la crea non lo indica; un valore indicato vince.
4. **Il legame del lavoro**: `approval_request_tenant_process_id` e `approval_request_tenant_process_step_id` sulle richieste, `project_tenant_process_id` sui progetti. I progetti non si collegano da soli: l'unità di una squadra partecipa da 2 a 17 processi, e scegliere a caso sarebbe scrivere il falso.
5. **La lettura dell'owner**: `GET /v1/me/processes/:organizationUnitProcessId/activities`, sullo stesso appoggio della rotta dei partecipanti (una mia partecipazione OWNER, 404 altrimenti). Restituisce le attività con l'unità che le esegue e i conteggi delle richieste del processo per tipo, stato e attività. Nessun titolo, nessun corpo, nessuna persona: il titolo di una richiesta retributiva contiene l'importo, e la cella è ACTIVITY = read, non COMPENSATION.

Le tabelle nascono `importato` (C8): le scrive solo il riempimento fuori catena. Diventano `ibrido` quando nascerà una rotta di scrittura (onda 3).

## Dati di partenza

Il riempimento (`db/scripts/attivita/riempi-attivita-dei-processi.sql`, fuori catena, con giornale `staging.attivita_processi_undo` e inversa) crea per ogni tenant i processi citati dalle sue unità, collega le unità di processo, scrive per RTL Bank le 131 attività e tre regole (ferie, retribuzioni e formazione al processo 17; la formazione alla sua attività 7.3.4), e collega le richieste esistenti. Le richieste del tenant di piattaforma restano senza processo: quel tenant non ha processi.

Le 131 fasi sono quelle depositate nel datastore da `pnpm run carica:fasi:riferimento` (`src/carico/fasi_di_riferimento.ts`): l'elenco e l'ordine vengono dall'APQC PCF Banking 8.0, i nomi italiani e l'unità esecutrice sono stati scritti in sessione e la provenienza lo dichiara. Cinque processi (02, 05, 09, 21, 22) hanno un concetto APQC senza figli: per loro il processo intero è l'unica attività.

## Conseguenze

- La cella ACTIVITY = read di `process_coordination` ha dati. `functionalScopeUserIds` resta com'era: l'owner vede le attività **del processo**, non tutte le attività delle persone che vi lavorano.
- Il mandato O2-03 si riduce a T3-T8: T1 e T2 sono fatti qui, sul suo disegno.
- Una richiesta di un tipo senza regola nasce senza processo, ed è visibile: la regola si aggiunge per il tenant, non nel codice.

## Prove

- Catena due volte e riempimento due volte su copia del dump notturno; seconda passata senza scritture; sentinelle C6 a zero.
- Prova d'integrazione della rotta dell'owner, con la scena scritta nella transazione del file.
- Dimostrazione dal vivo dopo il rilascio: login di un owner reale e lettura delle attività del suo processo.
