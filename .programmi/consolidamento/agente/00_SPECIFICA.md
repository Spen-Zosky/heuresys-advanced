# Specifica dell'agente di consolidamento del tenant

Versione 4 del 2026-10-30 (aggiunte R-12 alle 19:26, R-13 alle 19:31 e R-14 alle 19:33 UTC). CONFERMATA da Enzo il 2026-10-30 alle 19:33 UTC (20:33 ora di Roma), compresi i punti nati come proposta. Nasce dall'intervista del thread «Definire l'agente di consolidamento del tenant» (appunti con le risposte e gli orari in `consolidamento/agente/INTERVISTA_APPUNTI_20261030.md`). Le voci segnate «proposta confermata» non erano state chieste una per una: le ho dedotte dalle risposte e dagli ADR, ed Enzo le ha confermate con il resto.

## 1. L'obiettivo

Il prototipo di un'industria nasce nel datastore, da ricerche web e agenti AI. Quando è completo e approvato, viene consegnato ad advanced come riferimento iniziale per un tenant. Se il tenant esiste già e ha i suoi dati in advanced, bisogna confrontare il prototipo con la situazione reale del tenant e portarli a coincidere. Il punto di arrivo è un tenant consolidato: i suoi dati restano suoi, ma ogni voce è collegata al prototipo oppure dichiarata come sua personalizzazione. Il lavoro lo fa un agente AI, che individua o ipotizza le corrispondenze; le decisioni le prende una persona del tenant.

## 2. Che cosa è già deciso altrove, e l'agente lo rispetta

ADR-0042: la piattaforma genera il semilavorato, il cliente lo possiede. ADR-0043: il datastore tiene i cataloghi e genera il fascicolo, advanced tiene il fascicolo del tenant. ADR-0046: il tenant vede il suo perimetro più le voci che si è creato da sé. ADR-0047: il prototipo arriva ad advanced come fascicolo con manifesto; la versione è fissata sull'attivazione del tenant e il passaggio a una versione nuova è un gesto per quel tenant. ADR-0048: ciò che il tenant ha modificato non viene mai sovrascritto; una voce tolta dal modello resta, marcata «fuori modello»; un conflitto si segnala e non blocca. ADR-0040: l'agente di advanced legge solo ciò che legge la persona che lo usa, e ogni scrittura passa da un'approvazione umana. D-36 del datastore: il modello propone, l'umano approva. ADR-0045: i dati contrattuali importati da Zucchetti e SAP non si modificano in Heuresys.

## 3. Dove vive

A regime tutto avviene dentro advanced (R-9, R-11). Il datastore consegna il prototipo approvato e lì il suo compito finisce; non legge e non scrive il database di advanced. Il consolidamento è una nuova capacità dell'agente che advanced ha già (`apps/agent-gateway`), non un agente nuovo. Si usa dalle pagine di gestione del Direttore HR o di un suo delegato (R-10). La pagina «Vuoti rispetto al completo» della console del datastore resta uno strumento di Enzo per controllare la qualità dei prototipi; non è l'agente, e non scrive in advanced.

## 4. Strategia: abbinare per significato

L'agente abbina per significato, non per nome o per codice (R-1): il confronto del 30 ottobre fra la banca regionale e RTL Bank ha misurato 0 nomi di processo uguali su 30 e 23, e 12 competenze ESCO in comune su 443. Lavora in due passate. Prima usa le chiavi comuni dove esistono (indirizzo ESCO, livello, tipo di unità dopo la traduzione del vocabolario). Poi, per tutto il resto, confronta il significato con la ricerca per somiglianza e con il modello. Ogni proposta porta il motivo e un grado di fiducia.

L'agente usa le sue capacità semantiche per trovare anche le corrispondenze nascoste (R-12), cioè quelle che il nome non lascia vedere: sinonimi e lingue diverse (Recruiting e Gestione delle assunzioni); una voce del tenant che copre due voci del prototipo, o il contrario; una corrispondenza che si capisce dal contesto, per esempio dall'unità a cui appartiene una posizione o dalle attività di un processo. Queste corrispondenze le propone con il motivo, come le altre, e valgono solo dopo la conferma.

## 4bis. Strategia: tradurre il prototipo nella lingua del tenant, a giri

Proposta di Enzo, decisa alle 19:31 UTC (R-13). L'agente non costringe il tenant ad adottare la nomenclatura del prototipo: fa il contrario. Lavora a giri. Il primo giro è un confronto preliminare fra prototipo e dati del tenant. Poi l'agente sostituisce nel prototipo i nomi e i vocaboli con quelli del tenant, per le corrispondenze trovate, e confronta di nuovo: il secondo confronto avviene fra cose scritte allo stesso modo e trova molte più corrispondenze. I giri preliminari terminano solo quando l'agente non è più in grado di individuare e adottare equipollenze semantiche fra i due contesti (R-14, 19:33 UTC): non c'è un numero fisso di giri. Si combina con l'ordine per gruppi del punto 9: tradotte le unità, le posizioni dentro quelle unità si riconoscono meglio.

Tre cautele, accettate insieme alla strategia. Prima: la traduzione si fa su una copia di lavoro del prototipo preparata per quel tenant; il prototipo approvato non si tocca, e nei dati del tenant non entra niente prima di una conferma. Seconda: durante i giri preliminari l'agente adotta da sé, nella copia di lavoro, le equipollenze che giudica sicure, ciascuna tracciata con il motivo e il giro in cui l'ha adottata; quelle dubbie restano fuori dalla traduzione e aspettano la conferma, perché una sostituzione sbagliata si trascinerebbe nei giri successivi. Alla fine dei giri tutte le equipollenze, anche quelle adottate dall'agente, vanno alla conferma del Direttore HR o del delegato; se una viene rifiutata, l'agente rifà i giri che dipendevano da lei (proposta confermata). Terza: ogni voce tradotta conserva il suo nome originale nel prototipo, per riconoscerla quando arriva una versione nuova.

## 5. I tre esiti di ogni voce

Corrispondenza (R-2, R-12): la voce del tenant e quella del prototipo parlano della stessa cosa e si collegano. La regola predefinita è che il prototipo prende la nomenclatura del tenant: la voce consolidata porta il nome e il codice che il tenant usa già, e dal prototipo riceve ciò che il tenant non ha (descrizioni, legami, riferimenti ai cataloghi). Questa è la normalizzazione. Solo se il tenant lo chiede, voce per voce, si usa il nome del prototipo. Lacuna: una voce del prototipo non ha corrispondenti nel tenant e gli viene offerta; il tenant decide se adottarla o rifiutarla. Personalizzazione: una voce del tenant non ha corrispondenti nel prototipo; resta sua, non viene mai cancellata né forzata.

Proposta confermata: il nome e il codice del tenant non vengono mai sovrascritti da una versione nuova del prototipo. Per il resto, una voce collegata e poi normalizzata diventa «ereditata» nel senso di ADR-0048 e si aggiornerà con le versioni nuove del prototipo; una voce collegata che il tenant tiene nella sua forma diventa «conservata», e una differenza futura del prototipo su quella voce si segnala invece di applicarsi.

## 6. Chi decide

Ogni collegamento, ogni adozione e ogni normalizzazione li conferma il Direttore HR del tenant (`HRMS_MANAGER`) o un suo delegato (R-3, R-11). Il Direttore può nominare più delegati e limitarli a gruppi di dati, per esempio il responsabile della formazione solo per le competenze; la delega è registrata e revocabile, e il Direttore vede e può rivedere ogni decisione dei delegati. Enzo, come piattaforma, approva le regole dell'agente e le equivalenze di vocabolario comuni, non i singoli collegamenti. Per RTL Bank, finché non ha un Direttore HR reale, conferma Enzo.

## 7. Che cosa l'agente può e non può fare

L'agente legge e propone; non scrive mai da solo nei dati del cliente (R-4). Le modifiche confermate le applica advanced con i suoi meccanismi normali: sono registrate e reversibili. Niente vale senza una conferma umana, nemmeno gli abbinamenti certi (R-5).

Proposta confermata: l'agente non cancella mai una voce del tenant, nemmeno su richiesta dentro il consolidamento (una voce rifiutata resta, marcata); non tocca i dati delle persone (anagrafiche, contratti, valutazioni, retribuzioni), ma solo la struttura che il prototipo descrive (organizzazione, posizioni, ruoli, competenze, processi, attività, indicatori, obiettivi); non tocca i dati importati (ADR-0045); non esce dal perimetro del tenant (ADR-0046).

## 8. I meccanismi

Il registro delle decisioni (R-4): ogni proposta e ogni decisione si conservano, con chi ha deciso, quando, su quale versione del prototipo, con quale motivo e quale grado di fiducia. Serve a due cose: l'agente non ripropone ciò che è già stato deciso, e si vede sempre chi ha deciso cosa.

La conferma a gruppi (R-5): gli abbinamenti certi arrivano già pronti e raggruppati, e si confermano con un solo gesto; quelli incerti si vedono uno per uno, con il motivo.

Il vocabolario comune (R-7): i dati di un tenant non servono mai per un altro tenant. L'agente conserva solo le equivalenze generali di vocabolario confermate (per esempio DEPARTMENT del tenant equivale a DIREZIONE del prototipo), che Enzo approva come piattaforma prima che entrino nel vocabolario comune. Vive in advanced, al livello della piattaforma (R-11).

L'avanzamento (R-8): una pagina mostra, gruppo per gruppo, quante voci sono collegate, adottate, rifiutate, personalizzate e quante restano da decidere.

## 9. I riti

Quando lavora (R-6). In tre momenti: quando un prototipo approvato viene dato a un tenant che ha già i suoi dati; a ogni nuova versione del prototipo; su richiesta di Enzo o del Direttore HR.

In che ordine (R-6). Per gruppi di dati, in un ordine fisso, perché ogni gruppo si appoggia sul precedente: organizzazione (unità e livelli), posizioni e ruoli, competenze, processi, indicatori e obiettivi.

Proposta confermata: un gruppo si apre quando il precedente non ha più voci incerte da decidere, così una posizione si abbina conoscendo già la sua unità. A ogni nuova versione del prototipo l'agente riparte dal registro: propone solo ciò che è cambiato, rispettando le regole di ADR-0048.

Quando è finito (R-8). Un tenant è consolidato quando per ogni voce c'è una decisione: ogni voce del prototipo è collegata, adottata o rifiutata consapevolmente; ogni voce del tenant è collegata o segnata come personalizzazione.

## 10. Il modello

Si sviluppa e si prova sull'abbonamento Claude di Enzo, senza spesa (R-11): l'agente di advanced sa già girare così (`apps/agent-gateway/src/subscription-auth.ts`). Il passaggio a un modello pagato per cliente lo decide Enzo quando arriva il primo cliente vero.

## 11. Che cosa non è in questa specifica

Il disegno tecnico (tabelle, rotte, pagine) e il piano di lavoro: si scrivono ora che la specifica è confermata, nel programma di consolidamento. Il gradino 3 proposto nel thread «Spiegare la pagina dei vuoti rispetto al completo» (tabella delle corrispondenze nel datastore) va riletto alla luce del punto 3: a regime le corrispondenze del tenant vivono in advanced.
