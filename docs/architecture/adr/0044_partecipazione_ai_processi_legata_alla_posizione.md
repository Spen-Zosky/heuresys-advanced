# ADR-0044 — La partecipazione ai processi si lega alla posizione, non alla persona

- **Status**: ACCETTATO il 2026-10-12 da Enzo Spenuso (approvazione data in chat alle 00:37, ora di Roma)
- **Date**: 2026-10-11
- **Decided by**: Enzo Spenuso (decisione 7 dell'11 ottobre 2026: sì, in tre passi, con giornale di ritorno e senza indovinare i casi dubbi) · approvazione di questo testo: data il 2026-10-12
- **Redatto da**: Claude Code CLI, mandato W0-A2 (onda 0 del piano di adesione completa)
- **Relates to**: invariante **I1** (il modello è centrato sulla posizione), ADR-0036 (domini gerarchici e funzionali), ADR-0035 (ritirare si fa emendando la fonte), ADR-0041 (direzione del dato), ADR-0037 (cancellare una persona è anonimizzarla)
- **Emendamento del 2026-10-26** (approvato dall'Amministratore di Sistema): il vincolo del passo 3b è `CHECK (NOT process_participant_is_active OR process_participant_position_id IS NOT NULL)` e non `CHECK (process_participant_position_id IS NOT NULL)`, perché le righe disattivate dal passo 2 (classe N) restano senza posizione; per le righe che contano dice la stessa cosa. Motivo e prova in `.programmi/onda2/PIANO_passo3-partecipazione.md` §4 e `.programmi/onda2/esiti/O2-10.md`; migrazione `000459`.
- **Misura**: `.programmi/esiti-onda0/lavoro/partecipanti_misura.sql`, `partecipanti_misura_2.sql`, `partecipanti_misura_3.sql` con i loro `*_esito.txt` (gemello, sola lettura, 2026-10-11)

> **In parole semplici, per Enzo.**
> 1. Oggi chi partecipa a un processo è scritto come «questa persona», non come «questo posto»: quando una persona cambia posto, la partecipazione resta attaccata a lei e diventa sbagliata.
> 2. La misura lo conferma: delle 845 righe di RTL Bank, solo 185 riguardano persone che stanno ancora nell'unità del processo; le altre 660 sono rimaste indietro dopo i cambi di posto.
> 3. La proposta è legare la partecipazione al posto: la persona si ricava da chi occupa il posto oggi, così un cambio di posto non rompe più niente.
> 4. Si fa in tre passi reversibili: si aggiunge la colonna del posto, si riempie solo dove la risposta è certa (con un giornale per tornare indietro), e solo quando tutte le letture usano il posto si smette di scrivere la persona.
> 5. Per le 660 righe dubbie non indovino: ti propongo una regola per gruppo (non riga per riga), e la scelta è tua.

---

## Contesto

`sys.sys_process_participants` nasce con la migrazione `000179` (ADR-0027 F4, asse funzionale) e lega una **persona** (`process_participant_user_id`, FK su `sys_users` con `ON DELETE CASCADE`) a un processo di unità (`sys_organization_unit_processes`) con un ruolo RACI (`OWNER`, `CONTRIBUTOR`, `CONSULTED`, `INFORMED`). La migrazione `000184` la popola una volta, il 2026-07-20, con la regola B: per ogni processo di unità e ogni persona con un'assegnazione attiva su una posizione dell'unità, `OWNER` se la persona è proprietaria di una posizione attiva dell'unità, altrimenti `CONTRIBUTOR`.

Il legame alla persona contraddice I1: in questo prodotto la posizione è il centro, e la persona la occupa. Un legame fissato alla persona non segue i cambi di posto.

### La misura (gemello, clone della produzione allo schema 000453, 2026-10-11; il conteggio totale è confermato in produzione via tunnel lo stesso giorno: 845 righe, 57 `OWNER`)

| che cosa | valore |
|---|---|
| righe | 845, tutte del tenant RTL_BANK, tutte attive, tutte con `metadata.derived = RULE-B` |
| ruoli | 788 `CONTRIBUTOR`, 57 `OWNER`; nessun `CONSULTED` né `INFORMED` |
| processi di unità coperti | 96 (su 96); 75 senza alcun `OWNER` |
| persone distinte | 138 |
| ultima modifica di una riga | 2026-08-04 |
| assegnazioni ACTIVE iniziate dopo la derivazione (2026-07-20) | 138 su 161; nessuna persona ha più di un'assegnazione ACTIVE, nessuna posizione più di un titolare |

**Classificazione delle 845 righe** rispetto a oggi:

| classe | significato | righe |
|---|---|---|
| **A, certa** | la persona ha oggi esattamente una assegnazione ACTIVE su una posizione attiva dell'unità del processo | 185 (tutte `CONTRIBUTOR`) |
| **H, deducibile dalla storia** | oggi la persona non è nell'unità, ma alla data in cui la riga è stata scritta occupava esattamente una posizione dell'unità (secondo le date delle assegnazioni) | 496 (467 `CONTRIBUTOR`, 29 `OWNER`) |
| **N, senza posizione** | né oggi né alla data di scrittura la persona occupava una posizione dell'unità | 164 (136 `CONTRIBUTOR`, 28 `OWNER`) |

Delle 660 righe non certe (H + N), la relazione con l'unità oggi è: 415 la persona era nell'unità e la sua assegnazione è chiusa; 233 la persona sta ora in un'unità sottostante; 12 nessun legame. **Tutti i 57 `OWNER`** riguardano persone che oggi non sono titolari di una posizione nell'unità del processo.

Una nota sulle date: le assegnazioni di RTL Bank sono state riscritte dopo il 2026-07-20 dalla storia di 36 mesi (171 assegnazioni create dopo quella data). Per questo la classe H usa il calendario delle assegnazioni, che è la verità di dominio, ma resta una **ricostruzione**: non la tratto come certa. La cronaca di `000184` parlava di 1086 righe e quella di `verify-storia36.sql` di 1104; oggi sono 845. Da dove venga la differenza non l'ho ricostruito.

### Chi la tocca oggi (misurato con `python docs/kb/tools/chi_sorveglia.py sys_process_participants` e `rg --no-ignore process_participant`)

**Letture nel codice di produzione:**

- `apps/api/src/lib/scope/functional.ts`: `functionalScopeUserIds` (i partecipanti dei processi di cui l'attore è `OWNER`, righe 61-69) e `hasFunctionalScope` (righe 97-100). È l'asse funzionale del controllo di accesso.
- `apps/api/src/lib/scope/domains.ts:145`: il dominio `process_owner` (ADR-0036).
- `apps/api/src/modules/me/repository.ts:1647`: «i miei processi» del portale ESS (`GET /v1/me/processes`), con lo schema condiviso `packages/shared/src/schemas/me.ts`.
- `apps/api/src/lib/scope/data-classes.ts:366`: solo commento.

**Scritture:** nessuna rotta API (lo dice anche la classificazione della direzione del dato, `000429`: `importato`). Scrive solo la migrazione `000184`; nei test l'helper `apps/api/test/helpers/org-actors.ts` e sei file di integrazione (`scope-functional-axis`, `me-self-completeness-f5`, `domain-derived-sections`, `domains-f6`, `functional-scope`, `me-interfaces`); lo script `apps/api/scripts/prova-live-99-f7.mts`.

**Chi la sorveglia:** la sentinella `sys.v_history_cascade_to_users` (la FK sulla persona è nella sua lista di eccezioni, migrazione `000303`); la mappa GDPR (`000304`, colonna `process_participant_user_id` registrata per la cancellazione); il controllo `docs/kb/tools/check_completezza_self.py`; il controllo C7d della storia di 36 mesi (`db/scripts/verify-storia36.sql`): nessuna riga con `metadata.storia36`, perché **chi partecipa a quale processo lo decide Enzo, non un programma**.

## Decisione

> **Una partecipazione a un processo appartiene a una posizione. La persona che partecipa è chi occupa oggi quella posizione, ricavata dall'assegnazione ACTIVE. Il ruolo RACI resta sulla riga.**

La colonna nuova è `process_participant_position_id uuid`, FK su `sys.sys_positions (position_id)` con `ON DELETE RESTRICT` (una posizione non si cancella portandosi via in silenzio le sue partecipazioni; oggi le posizioni si disattivano, non si cancellano). Una posizione vacante partecipa lo stesso: il processo non perde il posto perché è scoperto, e le letture non trovano una persona.

## La migrazione in tre passi

I numeri delle migrazioni li fissa chi le scrive (dopo la `000455`). Ogni passo si prova sul gemello su copia usa-e-getta (`bash db/scripts/prova-idempotenza.sh`, poi `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'`) e si rilascia separatamente con il gesto di Enzo.

### Passo 1 — si aggiunge la colonna della posizione

- `ALTER TABLE sys.sys_process_participants ADD COLUMN IF NOT EXISTS process_participant_position_id uuid` (annullabile), il vincolo FK, l'indice `(process_participant_position_id, process_participant_is_active)` e un indice unico parziale `(process_participant_org_unit_process_id, process_participant_position_id) WHERE process_participant_position_id IS NOT NULL`.
- Niente cambia nei dati e nelle letture. La classificazione della direzione del dato resta `importato` (nessuna rotta scrive).
- **Inversa**: `DROP INDEX`, `DROP CONSTRAINT`, `DROP COLUMN`; la colonna è vuota, nulla si perde.
- **Prova**: idempotenza e prova generale della CI verdi; `\d sys.sys_process_participants` mostra la colonna; 845 righe invariate (impronta del contenuto prima e dopo).

### Passo 2 — la si riempie, solo dove la risposta è certa, con giornale di ritorno

- **Giornale**: `staging.process_participants_position_undo` (id della partecipazione, posizione precedente, posizione scritta, classe, identificativo della corsa, istante).
- **Registro dei dubbi**: `staging.process_participants_dubbi` (id della partecipazione, classe H o N, motivo, posizione candidata se c'è). Non scrive nulla in `sys`.
- **Riempimento automatico**: solo la classe A. La guardia ricalcola la classe di ogni riga dentro la stessa transazione (la precondizione si verifica al momento dell'esecuzione, non alla data di questa misura) e scrive soltanto dove trova esattamente una assegnazione ACTIVE su una posizione attiva dell'unità.
- **Post-condizione**: per tutte le righe, persona, ruolo, stato attivo e metadati identici a prima (impronta per riga); righe riempite = righe di classe A al momento dell'esecuzione; nessuna riga con `metadata.storia36` (il controllo C7d resta verde).
- **Le righe dubbie, decisione di Enzo per gruppo** (non riga per riga). La mia raccomandazione:
  - **H**: riempire con la posizione che la persona occupava alla data di scrittura della riga. È ciò che la regola B ha davvero registrato: il posto da cui la persona partecipava. Costo: una corsa in più dello stesso strumento; rischio: la ricostruzione poggia su date riscritte dalla storia di 36 mesi.
  - **N**: non riempire; la riga resta legata alla sola persona e al passo 3 viene disattivata (`is_active = false`, non cancellata), con il giornale.
  - In alternativa a entrambe: rigenerare la partecipazione dalle posizioni dell'unità (ogni posizione attiva dell'unità del processo partecipa come `CONTRIBUTOR`, la regola dell'`OWNER` da decidere). È più pulita, ma è decidere il RACI, che C7d riserva a Enzo: non la eseguo senza la sua scelta esplicita.
- **Inversa**: `UPDATE … SET process_participant_position_id = NULL` per le righe del giornale con l'identificativo della corsa; il giornale resta.
- **Prova**: sulla copia, il ritorno indietro riporta l'impronta della tabella identica a quella di prima del passo; sabotata (una riga riempita a mano fuori dal giornale), la prova di ritorno deve diventare rossa.

### Passo 3 — le letture usano la colonna nuova, poi si smette di scrivere la vecchia

- **3a, letture.** `functional.ts`, `domains.ts` e `me/repository.ts` ricavano la persona dalla posizione: `pp.process_participant_position_id → assegnazione ACTIVE → persona`. Finché esistono righe senza posizione (classe N non ancora decisa) la lettura usa la posizione se c'è, altrimenti la persona, e questo ramo di ripiego è dichiarato nel codice con la sua data di fine. Si aggiornano l'helper dei test e i sei file di integrazione.
- **3b, scrittura vecchia spenta.** Solo quando nessuna lettura usa più `process_participant_user_id`: la colonna diventa annullabile, chi crea una partecipazione (oggi nessuna rotta; domani l'eventuale rotta e i seed di collaudo) scrive solo la posizione, e un vincolo `CHECK (process_participant_position_id IS NOT NULL) NOT VALID`, poi validato, impedisce le righe nuove senza posizione. La colonna della persona **non si cancella** in questo ADR: il suo ritiro è un passo successivo, con archivio, secondo ADR-0035.
- **Sentinella**: una vista `sys.v_*` nuova (raccolta da `db_health.py`, a zero righe) diventa rossa se una partecipazione attiva non ha posizione. Nasce al passo 3b, non prima: creata prima sarebbe rossa per costruzione.
- **Inversa di 3a**: un commit che riporta le letture alla persona; i dati non cambiano. **Inversa di 3b**: si toglie il vincolo e si torna a scrivere la persona; la colonna c'è ancora.
- **Prova**: sulla copia, per ogni attore del tenant, l'insieme `functionalScopeUserIds` e il dominio `process_owner` prima e dopo il passo; ogni differenza è spiegata da una riga del giornale o da un cambio di posto misurato. La suite API sul gemello (`pnpm test:api:vm`) verde.

### Ordine

Passo 1 → passo 2 sulla classe A → decisione di Enzo su H e N → passo 2 sui gruppi decisi → passo 3a → passo 3b. Nessun passo parte se il precedente non è in produzione e la sua prova non è registrata.

## Rischi

1. **Cambia chi ha visibilità funzionale.** Oggi i 57 `OWNER` danno visibilità sulle attività dei partecipanti a persone che non sono più nell'unità; con le letture sulla posizione la visibilità passa a chi occupa il posto oggi. È la correzione voluta, ma è un cambio di comportamento visibile: la prova del passo 3a lo misura attore per attore prima del rilascio.
2. **Posizioni vacanti.** Una posizione senza titolare partecipa ma non dà una persona; le letture devono tollerarlo (nessuna persona, non un errore).
3. **Cancellazione di una persona.** Oggi cancellare una persona cancella le sue partecipazioni (`ON DELETE CASCADE`); con la posizione la partecipazione sopravvive al cambio di titolare, come deve. La voce della mappa GDPR resta finché la colonna della persona esiste.
4. **Il controllo C7d della storia di 36 mesi.** Il riempimento non scrive la chiave `storia36` nei metadati e non decide il RACI: copia il posto, non sceglie chi partecipa.
5. **Il gemello è indietro di due migrazioni** (000454 e 000455 non applicate): le prove si fanno su una copia migrata, come già in W0-A1.
6. **Direzione del dato.** Se un giorno nasce una rotta che scrive le partecipazioni, la classificazione passa da `importato` a `nativo`: è fuori da questo ADR.

## Opzioni scartate

- **Sostituire in un colpo la persona con la posizione.** Scartata: non c'è ritorno indietro, e le tre letture si romperebbero insieme.
- **Tenere la persona e aggiungere la posizione solo come informazione.** Scartata: le letture continuerebbero a usare la persona, e le righe resterebbero indietro a ogni cambio di posto, come oggi.
- **Un trigger che aggiorna la persona quando cambia l'assegnazione.** Scartata: due verità da tenere allineate per sempre, e il modello resta centrato sulla persona, contro I1.
- **Nessuna tabella: ricavare la partecipazione al volo dalle posizioni dell'unità.** Scartata come regola generale: perde il ruolo RACI esplicito per posto. Resta disponibile come regola di rigenerazione per le righe dubbie, se Enzo la sceglie (passo 2).
- **Riempire anche i dubbi con la posizione più probabile** (l'ultima occupata, o quella dell'unità sottostante). Scartata: è indovinare, ed è escluso dalla decisione dell'11 ottobre.

## Conseguenze

- I1 diventa vero anche per l'asse funzionale: un cambio di posto non lascia partecipazioni sbagliate.
- Il costo è nel piano di adesione, onda 2 («La correzione che conta»): tre migrazioni piccole, la revisione di tre lettori e dei test, una decisione di Enzo sui gruppi dubbi.
- Questo ADR non tocca i processi di unità (`sys_organization_unit_processes`), che sono già legati all'unità, né i team (`sys_team_members`), che restano legati alla persona: se anche loro debbano seguire la posizione è una domanda separata.

## Come si verifica che sia fatto

1. Ogni partecipazione attiva ha una posizione (sentinella del passo 3b a zero; prima del passo 1 non può esserlo).
2. Una persona che cambia posto non compare più fra i partecipanti dei processi della vecchia unità e compare in quelli della nuova, senza scritture sulla tabella delle partecipazioni (prova su copia: si chiude un'assegnazione, se ne apre un'altra, si rilegge).
3. Il giornale del passo 2 riporta la tabella allo stato di prima con impronta identica.
