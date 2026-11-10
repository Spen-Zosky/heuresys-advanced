# Le logiche dell'assistente nelle interfacce di Heuresys

Scritto il 2026-11-10 su richiesta di Enzo («per capire come devono funzionare gli agenti e gli assistenti in Heuresys prendi spunto dal repo mod-platform e dalle sue interfacce, costruisciti e adatta le logiche da adottare e comincia ad implementarle sistematicamente alle interfacce di Heuresys»). Vale per advanced e per il datastore.

Questo documento non sostituisce la dottrina: i principi P1-P25 restano quelli di `PRINCIPI_agenti-e-assistenti_20261105.md`, recepiti da [ADR-0056](../adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md), e le regole di autonomia restano quelle di [ADR-0053](../adr/0053_gli_agenti_agiscono_senza_conferma_una_capacita_alla_volta.md). Qui si scrive come quei principi diventano interfaccia, pagina per pagina, prendendo ciò che mod-platform ha già costruito e provato. Il lavoro che ne discende sta nel piano [PIANO_assistente-nelle-interfacce_20261110.md](../../piani/PIANO_assistente-nelle-interfacce_20261110.md).

## Da dove viene

mod-platform letto in sola lettura al commit `e12ed17` (ramo predefinito su GitHub, 2026-11-10), senza toccarne né il codice né l'ambiente sulla VM. I file che contano:

| che cosa | dove in mod-platform |
|---|---|
| il piano che ha costruito la finestra, con misure ed errori trovati in produzione | `docs/piani/PIANO_ai-incorporata_20261105.md` (tappe F0-F12) |
| il simbolo e la finestra nel guscio | `apps/area/app/agente/finestra-agente.tsx`, montata in `apps/area/app/dashboard.tsx` |
| il ponte fra guscio e pagina | `packages/schemas/src/ponte-agente.ts`, `apps/area/app/agente/usa-pagina.ts` |
| il catalogo delle azioni di pagina, con modo e classe | `packages/schemas/src/azioni-pagina.ts` |
| un comando della vista su una pagina | `apps/area/app/offerte/vista-agente.ts` |
| le operazioni sull'oggetto, annullabili | `packages/configuratore/src/editor/configuratore/operazioni-agente.ts` |
| le regole stabili dell'interfaccia | `CLAUDE.md` di mod-platform, sezione «L'interfaccia dell'assistente» |

## Le logiche

Ogni logica dice che cosa fa mod-platform, che cosa c'era in Heuresys il 2026-11-10, come si adatta, e in quale blocco del piano si realizza.

### L1. Un simbolo, una finestra, un'applicazione che non si ferma

In mod-platform c'è un solo simbolo SVG in un punto fisso del guscio della dashboard, uguale in ogni pagina. Il clic non avvia l'assistente: mostra una finestra modale ridimensionabile, aperta sulle attività che vivono sul server. Chiudere la finestra la nasconde; un puntino sul simbolo dice che un lavoro è in corso. All'apertura si scalda il processo del modello (`POST /agente/caldo`), così la prima risposta arriva prima.

In Heuresys il 2026-11-10 l'assistente è montato una volta nel layout autenticato (`apps/web/src/components/pannello-agente.tsx`) e le conversazioni vivono nel database (T6 del piano dei principi agentici). Ma l'ingresso è un pulsante di testo «Apri» in una riga sopra la pagina, e il pannello aperto si inserisce nella pagina e la spinge in basso, con la colonna delle conversazioni sopra la conversazione invece che accanto.

Adattamento: un simbolo fisso in un angolo del guscio, con il puntino del lavoro in corso, e una finestra modale ridimensionabile sopra la pagina, che non la sposta. Cambiando pagina la finestra resta la stessa, perché il layout di Next.js non si ricarica: in Heuresys non serve l'iframe di mod-platform. Il simbolo e la finestra sono componenti comuni, quindi nascono in `@heuresys/ui` (`ux-design-shared`), con la disposizione dell'interfaccia di Claude e non il suo marchio (ADR-0056 D4). Blocco I2.

### L2. L'assistente c'è in ogni pagina

In mod-platform ogni voce del menu è una pagina dell'assistente (`PAGINE_AGENTE`): ciò che cambia da una pagina all'altra sono le azioni concesse, non la presenza del simbolo.

In Heuresys il pannello compare solo nelle pagine che `check_idoneita_agente.py` dichiara idonee (`apps/web/src/lib/agente/pagine-idonee.generated.ts`).

Adattamento: il simbolo c'è in ogni pagina autenticata; l'elenco delle pagine idonee resta, ma dice che cosa la pagina offre all'assistente (letture, comandi, oggetto di lavoro), non se il simbolo compare. Blocco I2.

### L3. La pagina si dichiara, e accetta solo un elenco chiuso di comandi

In mod-platform la pagina dice al guscio dove si trova, che cosa mostra e quali comandi accetta; il guscio le passa i comandi, controllando origine e finestra di provenienza; la pagina esegue solo quelli del suo elenco e risponde con un esito. Un comando arrivato mentre la pagina si avvia si tiene finché la pagina si dichiara; uno arrivato dopo un cambio di pagina si rifiuta.

In Heuresys il 2026-11-10 la pagina poteva dichiarare solo una frase di contesto (`useContestoAgente`), che viaggiava incollata al mandato.

Adattamento, fatto nel blocco I1: in Heuresys non c'è un iframe, quindi il ponte è un contesto React (`apps/web/src/lib/agente/contesto.tsx`, `useVistaAgente`) e non `postMessage`. La dichiarazione non la fa ogni pagina a mano: la fa il componente comune delle tabelle (`EntityTable` in `apps/web/src/components/data-table-panel.tsx`), e così vale per tutte le pagine che lo usano, presenti e future. La finestra manda al gateway la pagina dichiarata separata dal mandato; il gateway la passa al modello in un blocco `<pagina>` marcato come dato (P5) e fa valere il catalogo chiuso (`apps/agent-gateway/src/comandi-vista.ts`). Un comando che arriva dopo un cambio di pagina è rifiutato. Le righe della tabella non escono dal browser: al modello arrivano i nomi delle colonne e i conteggi.

### L4. Quattro modi di lavorare in una pagina, ognuno con la sua classe

mod-platform distingue per ogni azione di pagina un modo e una classe fissa (`MODI_AZIONE` in `azioni-pagina.ts`): legge (A), mostra (A, cambia solo ciò che si vede), propone (B per la bozza, C per ciò che esce), lavora sull'oggetto (B, ogni mandato è un passo annullabile).

In Heuresys esistevano la lettura (gli strumenti `hrx_*_list` e `hrx_*_get`) e la proposta di scrittura attraverso il cancello (`write-gate.ts`), con le classi di ADR-0056 D2 (`classi-azioni.ts`). Mancavano «mostra» e «lavora».

Adattamento: «mostra» è fatto nel blocco I1 (`hrx_vista_comanda`, classe A, che il cancello lascia passare e scrive nel diario come `VIEW_COMMAND`, senza contarlo fra le letture di persone perché non legge dati). «Lavora sull'oggetto» si fa nel blocco I5 sulle pagine che hanno un oggetto da costruire (organigramma, modello del tenant): l'agente restituisce operazioni, il programma le applica con le regole del dominio, e un annulla torna allo stato di prima.

### L5. Ogni pagina si può leggere, con i permessi della persona

In mod-platform un difetto trovato da Enzo in produzione (l'assistente della Libreria grafica «non vedeva la pagina») ha portato la regola: ogni voce del menu ha almeno una lettura, che il codice esegue sulla rotta GET vera con la sessione della persona, con i soli campi dichiarati, un limite di righe e un tetto di caratteri; una prova controlla il menu vero (`tests/unit/agente-letture.test.ts`).

In Heuresys le letture del gateway coprono la struttura (unità, posizioni, ruoli, competenze, KPI, modelli) e alcune letture di valore (valutazioni, predizioni, processi). Molte voci del menu non hanno una lettura: l'assistente aperto su quelle pagine può solo dire che non vede.

Adattamento: un controllo che confronta le voci della barra laterale con le letture del catalogo, e diventa rosso quando una voce non ha né una lettura né un'eccezione scritta con il motivo; poi le letture mancanti, a gruppi, con le rotte GET già esistenti e i permessi della persona (P12). Il freno delle persone distinte resta com'è (ADR-0040 §4b). Blocco I3, da coordinare con la barra laterale per funzione (PR #213), che è la fonte delle voci.

### L6. Il testo dipende dall'esito

Secondo difetto di mod-platform in produzione: l'assistente scriveva «ho aggiornato la bozza» e subito dopo «non si può fare». La correzione: ogni comando ha un id, la pagina riferisce `ok`, `parziale` o `rifiutata`, senza risposta vale `non_confermata`, e il testo nasce dall'esito; se il testo finale dichiara fatto ciò che non è avvenuto, il codice lo sostituisce con il motivo vero.

Adattamento, fatto in parte nel blocco I1: lo strumento `hrx_vista_comanda` restituisce al modello l'esito che la pagina ha riferito (`POST /agent/esiti` del gateway, solo dalla persona per cui l'agente lavora e con il token CSRF), e l'esito dice il vero: con la paginazione del server un comando vale per la sola pagina caricata ed è `parziale`, con il totale. Manca il controllo nel codice sul testo finale, che va nella prova avversaria con casi propri (blocco I4).

### L7. La persona vede che cosa l'assistente ha cambiato, e torna indietro

In mod-platform un comando della vista cambia la vista e basta. In Heuresys si aggiunge una riga sopra la tabella che dice che cosa ha cambiato l'assistente («ricerca "Milano", ordinata per Sede») e un pulsante per tornare alla tabella intera. Fatto nel blocco I1. È la stessa idea del passo annullabile di L4, applicata alla vista.

### L8. Le prestazioni sono un requisito

mod-platform ha misurato (piano, sezione 3ter): processo caldo all'apertura, prefisso stabile (istruzioni, schema e strumenti fissi; il contesto della pagina in fondo al messaggio), comandi della vista applicati appena validati, modello veloce per capire e comandare la vista. Con Haiku a caldo il primo comando della vista arriva in circa 1,3 secondi.

In Heuresys il modello è fissato per nome (`AGENT_GATEWAY_MODEL`, `limiti.ts`) e il giro passa dall'Agent SDK per ogni richiesta. Adattamento: prima si misura nel gateway con lo stesso metodo (tempo al primo comando, al primo testo, totale, a caldo e a freddo), poi si decide; il cambio di modello si fa solo con un rilascio, che decide Enzo. Il blocco I1 mette già il blocco `<pagina>` in testa al mandato della persona e il comando si applica appena arriva. Blocco I6.

### L9. Ciò che l'attività produce sta nell'area di destra

In mod-platform la finestra ha a destra ciò che l'attività ha prodotto o usato (bozze, catene, disegni, collegamenti alle pagine). In Heuresys non c'è ancora. Adattamento con la finestra del blocco I2: i collegamenti alle pagine in cui l'assistente ha lavorato e le proposte in attesa, poi i prodotti quando nascono (blocco I5).

### L10. Che cosa resta com'è

Restano le regole già in vigore in Heuresys, che coincidono con mod-platform o ne sono più strette: l'assistente è usato solo dalle persone nominate in `AGENT_GATEWAY_ALLOWED_USER_IDS` e il motore è l'abbonamento Claude di Enzo (ADR-0056 D3, regola di Enzo del 2026-11-10); ogni conversazione è della sua persona, e un'altra riceve 404; l'agente non ha più permessi della persona (P12); nessuna cancellazione libera (P17); il dettato aspetta il giorno in cui la finestra accetta la voce (ADR-0056 D7).

### L11. Il datastore

La console del datastore (`apps/console`) il 2026-11-10 non ha un assistente. Adattamento: la stessa finestra e lo stesso ponte, con le letture date dai verbi del vocabolario (`docs/04_impianto/27_IL_VOCABOLARIO_DEI_VERBI.md` del datastore) e il modello attraverso Claude Code, secondo le regole del datastore. Blocco I7, in una sessione del datastore.

## Che cosa non si porta da mod-platform, e perché

- L'iframe e `postMessage`: in Heuresys le pagine stanno nello stesso albero React del guscio.
- Il servizio delle chiavi (la Porta Google) e la doppia conferma con codice: nessuna azione di Heuresys esce dalla piattaforma (ADR-0056 D5); nascono con la prima.
- Un comando per pagina scritto a mano (`offerte.filtra`, `offerte.ordina`): in Heuresys le pagine con un elenco usano lo stesso componente, quindi i comandi sono quelli della tabella (`tabella.cerca`, `tabella.filtra`, `tabella.ordina`, `tabella.azzera`). Una pagina con un bisogno proprio aggiunge un comando al catalogo del gateway e alla sua dichiarazione, mai un agente nuovo (P13).
