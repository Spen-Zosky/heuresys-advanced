# Passo 3 della partecipazione ai processi per posizione (ADR-0044) — piano

Sessione S1119, 2026-10-17. Solo disegno. Lo eseguono le sessioni O2-09 (3a, letture) e O2-10 (3b, scrittura vecchia spenta e sentinella), vedi `README.md`.

## 0. Da dove si parte (letto in `.programmi/esiti-onda0/PE-4.md` e nel codice, 2026-10-17)

- Passo 1 (`db/migrations/000457_pe4_passo1_posizione_nelle_partecipazioni.sql`) e passo 2 (`db/scripts/pe4-passo2-riempi.sql`, fuori catena, con la regola D3) sono **provati su copia** e **non sono in produzione**. Esito misurato sulla copia: 681 righe con posizione (185 classe A, 496 classe H), 164 disattivate (classe N) con posizione nulla; 845 in tutto.
- **Tutte le 496 posizioni della classe H sono posizioni disattivate.** Con le letture del passo 3a, quelle 496 partecipazioni non troveranno nessuna persona.
- I 57 `OWNER`: 29 nella classe H (posizione disattivata), 28 nella classe N (riga disattivata). Dopo il passo 3a **nessun OWNER si risolve in una persona**: il dominio `process_owner` e l'insieme `functionalScopeUserIds` diventano vuoti per tutti gli attori di RTL Bank. Già prima, 75 processi di unità su 96 non avevano un OWNER.
- Letture (misurate con `rg process_participant apps/api/src`): `apps/api/src/lib/scope/functional.ts` righe 61-69 (`functionalScopeUserIds`) e 97-100 (`hasFunctionalScope`); `apps/api/src/lib/scope/domains.ts` righe 145-148 (dominio `process_owner`); `apps/api/src/modules/me/repository.ts` intorno alla riga 1640 (`GET /v1/me/processes`). Commento in `apps/api/src/lib/scope/data-classes.ts:366`.
- Scrittori fuori dalla catena: l'helper `apps/api/test/helpers/org-actors.ts`, sei test di integrazione (`scope-functional-axis`, `me-self-completeness-f5`, `domain-derived-sections`, `domains-f6`, `functional-scope`, `me-interfaces`), `apps/api/scripts/prova-live-99-f7.mts`, gli script `db/scripts/pe4-*`. `db/seeds/storia36/07_approvals.sql` dichiara di non scrivere la tabella; `db/scripts/verify-storia36.sql` controlla (C7d) che nessuna riga porti `metadata.storia36`.

## 1. Precondizioni (nessuna sessione parte senza)

| # | precondizione | chi | come si verifica |
|---|---|---|---|
| P1 | `000457` in produzione | Amministratore di Sistema (rilascio) | `bash scripts/verifica-deploy.sh` dice DEPLOYATO su un HEAD che contiene la `000457`; `\d sys.sys_process_participants` via tunnel mostra la colonna |
| P2 | passo 2 eseguito in produzione con `-v fase=tutto` | Amministratore di Sistema (scrittura sui dati vivi) | `select count(*) filter (where process_participant_position_id is not null), count(*) filter (where not process_participant_is_active) from sys.sys_process_participants` dà le due cifre che il giornale `staging.process_participants_position_undo` dichiara per la corsa |
| P3 | decisioni D-P3-1, D-P3-2, D-P3-3 (sezione 2) | Amministratore di Sistema | risposta scritta in `docs/kb/COWORK_INBOX.md` o nel mandato di O2-09 |
| P4 | per 3b: il passo 3a in produzione | Amministratore di Sistema (rilascio) | `verifica-deploy.sh` DEPLOYATO sull'HEAD di O2-09 |

## 2. Il trattamento dei 57 OWNER e delle righe che non si risolvono

Il passo 3a non decide chi partecipa: il RACI lo decide l'Amministratore di Sistema (controllo C7d). Ma il passo 3a, applicato da solo, toglie a tutti la visibilità funzionale per processo. Servono tre scelte, per gruppo e non per riga.

- **D-P3-1, chi è OWNER di un processo di unità.** Raccomando: **la posizione attiva del responsabile dell'unità** (`organization_unit_manager_user_id` → la sua assegnazione ACTIVE → la posizione, solo se è nell'unità del processo e se è una sola), scritta come riga `OWNER` nuova con `metadata.derived = 'RULE-OWNER-UNITA'` e giornale; le 29 righe `OWNER` della classe H restano dove sono (storia) e si disattivano con D-P3-2. Costo: una corsa di uno script nuovo, sul modello di `pe4-passo2-riempi.sql`. Rischio: chi guida l'unità vede le attività dei partecipanti dei processi della sua unità; è già ciò che vede per catena gerarchica (I18), quindi la visibilità non si allarga oltre l'asse gerarchico. Alternativa: nessun OWNER finché l'Amministratore di Sistema non li assegna a mano (il dominio `process_owner` resta vuoto; nessuno perde dati per catena gerarchica, si perde solo l'asse funzionale).
- **D-P3-2, le partecipazioni attive su posizioni disattivate** (le 496 della classe H, e ogni altra che la misura trovi al momento). Raccomando: **disattivarle** (`is_active = false`, giornale, nessuna cancellazione) al passo 3b, perché una posizione disattivata non è un posto da cui si partecipa. Costo: nessuno oltre al passo 3b. Rischio: nessuna visibilità persa, perché già al passo 3a non si risolvono in persone. Alternativa: lasciarle attive, e allora la sentinella del passo 3b deve escluderle per nome.
- **D-P3-3, le posizioni attive di un'unità che non partecipano ai suoi processi.** È la regola di rigenerazione che ADR-0044 tiene disponibile (ogni posizione attiva dell'unità partecipa come `CONTRIBUTOR`). Raccomando: **sì**, nella stessa corsa di D-P3-1, con `metadata.derived = 'RULE-CONTRIBUTOR-POSIZIONE'`. Senza, dopo D-P3-2 i processi restano con le sole 185 righe della classe A. Costo e rischio come D-P3-1.

Se l'Amministratore di Sistema risponde no a D-P3-1 e D-P3-3, il passo 3a si può rilasciare lo stesso, sapendo che l'asse funzionale per processo resta vuoto: la prova del passo 3a lo misura e lo scrive nell'esito.

## 3. Passo 3a — le letture usano la posizione (sessione O2-09)

**Codice.** Le tre letture ricavano la persona dalla posizione, con la stessa clausola in un solo posto (una funzione SQL di frammento in `apps/api/src/lib/scope/functional.ts`, riusata da `domains.ts` e da `me/repository.ts`):

```
pp.process_participant_position_id = upa.user_position_assignment_position_id
AND upa.user_position_assignment_status = 'ACTIVE'
AND upa.user_position_assignment_start_date <= current_date
AND (upa.user_position_assignment_end_date IS NULL OR upa.user_position_assignment_end_date >= current_date)
AND pos.position_is_active
```

- `functionalScopeUserIds`: i processi di cui l'attore occupa una posizione `OWNER`, poi le persone che occupano le posizioni partecipanti di quei processi.
- `hasFunctionalScope` e il dominio `process_owner`: l'attore occupa oggi una posizione `OWNER` attiva.
- `GET /v1/me/processes`: le partecipazioni delle posizioni che l'attore occupa oggi; lo schema condiviso `packages/shared/src/schemas/me.ts` guadagna `position_id` e `position_title` (aggiunte, nessun campo tolto).
- **Ramo di ripiego**: se una riga attiva ha la posizione nulla, la lettura usa la persona. Dopo P2 queste righe sono zero (la misura lo conferma prima del rilascio); il ramo resta come difesa, dichiarato nel codice con la data di fine «rilascio del passo 3b», e si toglie in O2-10.
- Una posizione vacante partecipa ma non dà persone: nessun errore, nessuna riga.
- Le scelte D-P3-1 e D-P3-3, se approvate, sono uno script fuori catena `db/scripts/pe4-passo3-regole.sql` (forma di `pe4-passo2-riempi.sql`: misura, guardia nella transazione, post-condizione, giornale `staging.process_participants_regole_undo`, inversa `pe4-passo3-regole-inversa.sql`), che scrive solo righe nuove con `metadata.derived` e mai `metadata.storia36`.

**Test.** L'helper `org-actors.ts` scrive la posizione insieme alla persona; i sei test di integrazione passano dalla posizione; un test nuovo prova il cambio di posto (si chiude un'assegnazione, se ne apre un'altra in un'altra unità, si rilegge: la persona compare fra i partecipanti della nuova unità e non della vecchia, senza scritture sulla tabella delle partecipazioni). Il test nuovo si vede rosso sul codice di oggi e verde dopo.

**Prova di chiusura (ADR-0044).** Su una copia usa-e-getta del gemello con `000457` e passo 2 applicati (il clone del gemello è indietro: si migra la copia, come in PE-4): per ogni attore di RTL Bank, l'insieme `functionalScopeUserIds` e il valore di `process_owner` **prima e dopo** il cambio, in un file di confronto `.programmi/onda2/esiti/O2-09_confronto-attori.txt`; ogni differenza spiegata da una riga del giornale, da una posizione disattivata (D-P3-2) o da una regola nuova (D-P3-1, D-P3-3). `pnpm test:api:vm` verde sul gemello. Una mutazione (il frammento senza il controllo della data di fine dell'assegnazione) deve far diventare rosso il test del cambio di posto.

**Inversa di 3a**: un commit che riporta le tre letture alla persona; i dati non cambiano. Per lo script delle regole, la sua inversa disattiva le righe della corsa.

## 4. Passo 3b — la scrittura vecchia si spegne, nasce la sentinella (sessione O2-10)

Parte solo con P4. Una migrazione, numero libero al momento.

- `ALTER TABLE sys.sys_process_participants ALTER COLUMN process_participant_user_id DROP NOT NULL` (la colonna resta; il suo ritiro è un passo successivo con archivio, ADR-0035).
- Se D-P3-2 è sì: lo script fuori catena `db/scripts/pe4-passo3b-disattiva.sql` disattiva le partecipazioni attive su posizioni disattivate, con giornale e inversa; si esegue **prima** della migrazione, perché la sentinella sotto non nasca rossa.
- Vincolo: `CHECK (NOT process_participant_is_active OR process_participant_position_id IS NOT NULL)`, aggiunto `NOT VALID` e poi validato nella stessa migrazione, dopo una guardia che conta le righe che lo violerebbero e si ferma se non sono zero.
  - **Scostamento da ADR-0044, da approvare insieme a questo piano.** L'ADR scrive `CHECK (process_participant_position_id IS NOT NULL)`. Con la decisione D3 già eseguita, le 164 righe disattivate hanno la posizione nulla e quel vincolo non si potrebbe validare. Il vincolo condizionato all'attività dice la stessa cosa per le righe che contano (una partecipazione attiva ha sempre una posizione) e lascia intatte le righe disattivate. Se l'Amministratore di Sistema lo approva, ADR-0044 riceve una riga di emendamento che rimanda a questo file.
- Sentinella: vista `sys.v_process_participants_active_without_position` (partecipazioni attive senza posizione), raccolta da `db_health.py`, a zero righe. Se D-P3-2 è no, la vista non conta le righe su posizioni disattivate solo se l'Amministratore di Sistema lo dice; altrimenti nasce anche `sys.v_process_participants_active_on_inactive_position`.
- Scrittori: l'helper dei test e `prova-live-99-f7.mts` scrivono solo la posizione; il ramo di ripiego del passo 3a si toglie.
- Mappa GDPR (`000304`): la voce `process_participant_user_id` resta finché la colonna esiste. La FK sulla persona resta `ON DELETE CASCADE` (in questo prodotto una persona si anonimizza e non si cancella, ADR-0037); cambiarla è fuori da questo passo.
- Direzione del dato: resta `importato` (nessuna rotta scrive le partecipazioni).

**Prova di chiusura.** Su copia usa-e-getta: la migrazione si applica due volte; la sentinella è a zero; un `INSERT` di una partecipazione attiva senza posizione fallisce sul vincolo (rosso atteso), uno con posizione passa; `ci-rehearsal.sh` verde con la sentinella contata; `pnpm test:api:vm` verde.

**Inversa di 3b** (fuori catena, `db/scripts/pe4-passo3b-inversa.sql`): drop della vista e del vincolo; `SET NOT NULL` sulla persona **solo** se nessuna riga ha la persona nulla, altrimenti rifiuto (vuol dire che una riga nuova è nata col solo posto: tornare indietro richiede di riempire la persona dall'assegnazione, ed è una decisione). Lo script di disattivazione ha la sua inversa col giornale.

## 5. Ordine

P1 e P2 (rilascio) → D-P3 (decisioni) → O2-09 (3a, ed eventualmente lo script delle regole) → rilascio di 3a e corsa dello script delle regole in produzione (Amministratore di Sistema) → O2-10 (3b) → rilascio di 3b. Nessun passo parte se il precedente non è in produzione con la sua prova registrata.
