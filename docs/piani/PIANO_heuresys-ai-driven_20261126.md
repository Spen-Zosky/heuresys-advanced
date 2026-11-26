# Piano: Heuresys davvero AI-driven, livello 5 su ogni asse (2026-11-26)

Stato: **bozza, in attesa del sì di Enzo**. Nessuna voce di attuazione è partita. Richiesta di Enzo del 2026-11-26 (03:09 Roma) nel progetto «ENZO: heuresys ecosystem», thread «Rendere Heuresys davvero AI-driven»: verificare se advanced e datastore sono davvero agentici, a che livello, e che cosa serve perché il prodotto sia AI-driven ad assoluto livello, con l'IA che lavora dentro la piattaforma, scopre fatti sommersi, sostiene decisioni sofisticate, migliora organizzazione e risorse, progetta il cambiamento, ridisegna i processi e assiste ogni funzione presente e futura.

La valutazione di partenza è in [ai-driven_20261126/VALUTAZIONE_agentica_20261126.md](ai-driven_20261126/VALUTAZIONE_agentica_20261126.md): **livello 2 su 5**, governo degli agenti a 4, capacità di agire 1,5, proattività 1, change management 0,5. Le risposte di Enzo all'intervista sono nella sezione 2 e valgono come decisioni di questo piano. L'ADR fondante che le raccoglie, e che orienta tutto il progetto, è [ADR-0063](../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md): il piano lo attua.

## 1. Che cosa non si chiude con questo piano

- Questa sessione scrive solo la voce Z0 (questo piano, la valutazione e la proposta di ADR-0063 nel repo). Ogni altra voce parte dopo il sì di Enzo (voce Z1), in un thread suo, con la sua PR, le sue prove e la sua dimostrazione dal vivo su RTL con una persona reale del tenant (ADR-0026).
- Il livello 5 è un traguardo di più mesi, non di una sessione. Il piano è a onde (sezione 5); ogni onda si chiude con la misura del livello (voce M2), non con una dichiarazione.
- Restano decisioni di Enzo fuori dal piano: i rilasci seguono la delega permanente del 13/11, le spese restano sue, l'apertura a un cliente vero è una sua scelta di prodotto.

## 2. Le decisioni di Enzo (intervista del 2026-11-26)

| id | domanda | decisione | quando |
|---|---|---|---|
| E1 | Chi usa l'IA | tutte le persone di RTL, ognuna con i suoi permessi | 03:26 Roma |
| E2 | Prima missione | il cambiamento organizzativo dall'inizio alla fine, ma senza limitarsi a quello: tutte le funzioni dell'HR manager sono centrali | 03:26 |
| E3 | Autonomia | niente passa senza conferma: nessuna scrittura automatica, il modo LIBERA di ADR-0053 resta spento | 03:26 |
| E4 | Misura | i sette criteri della valutazione (sezione 5 di quel file), ognuno chiuso con una prova dal vivo | 03:26 |
| E5 | Chi conferma | la persona collegata che ha chiesto; niente parte da solo; riepilogo settimanale a Enzo di tutto ciò che è stato confermato | 03:29 |
| E6 | Agenti che segnalano | sì, senza scrivere, a ciascuno nel suo perimetro, in una casella dentro la piattaforma, per ora senza posta | 03:29 |
| E7 | Scenari what-if | sì, e vanno ampliati verso direzioni molto raffinate | 03:29 |
| E8 | Ordine | prima le fondamenta comuni, poi talenti, rimpiazzo e carriere; competenze e formazione; KPI e valutazioni; selezione; organizzazione e cambiamento; processi | 03:29 |
| E9 | Memoria | sì, per persona, visibile e cancellabile da lei | 03:29 |
| E10 | Agenti esterni | sì, e non come ultima onda: «già da adesso Claude è attivo e al servizio della piattaforma» | 03:42 |
| E11 | Prova della qualità | le domande le crea Claude e Claude fa tutto: almeno 200 per dominio, soglia 9 su 10 | 03:42 |
| E12 | Equità | ogni proposta sulle persone passa da un controllo di equità e lo dichiara esplicitamente | 03:42 |
| E13 | Spiegazioni | fonti cliccabili in ogni risposta e scenario | 03:42 |
| E14 | Organizzazione ghost | il sistema agentico rappresenta una struttura ghost dei soli ruoli apicali (divisioni e direzioni), con Capi agenti di altissimo livello, consulenziali e prospettici, che attivano squadre di subagenti specializzati nell'area dell'unità | 03:42 |
| E15 | ADR fondante | tutto ciò che viene dall'intervista confluisce in un ADR fondante che orienta la valutazione dell'esistente e tutti i programmi attuali e futuri: [ADR-0063](../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md) | 03:42 |

Obiettivo dichiarato da Enzo: **livello 5 su tutti gli assi**, con gli scenari what-if gestiti in modo eccellente.

## 3. Il traguardo: che cosa vuol dire livello 5, asse per asse

Lo stesso metro della valutazione. Ogni asse ha una misura che la voce M1 rende automatica, così il livello si legge da un comando e non da un giudizio.

| # | Asse | Oggi | Livello 5 vuol dire | Misura |
|---|---|---|---|---|
| 1 | Governo e sicurezza | 4 | cruscotto degli agenti con uso, consumo, esiti e valore; ogni versione di agente promossa con le sue prove | cruscotto vivo, versioni promosse = versioni in servizio |
| 2 | Profondità di lettura | 3,5 | tutte le letture, più documenti, regole e politiche come conoscenza, più la memoria della persona | letture raggiungibili ≥ 98%, domande sui documenti nella batteria |
| 3 | Capacità di agire | 1,5 | ogni scrittura di business raggiungibile con la sua classe, e lavori in più passi (applet) con anteprima e ritorno | scritture raggiungibili ≥ 90%, applet per dominio ≥ 3 |
| 4 | Autonomia e proattività | 1 | agenti in background che osservano e segnalano a ogni ruolo; preparano da soli il lavoro, che la persona conferma (E3) | segnalatori attivi per dominio ≥ 3, segnalazioni giudicate utili ≥ 70% |
| 5 | Fatti sommersi | 1,5 | diagnosi delle cause, anomalie, incoerenze fra domini, con la fonte | casi di diagnosi nella batteria superati ≥ 90% |
| 6 | Decisioni sofisticate | 2 | scenari what-if a più opzioni, combinati, nel tempo, sotto vincoli, con incertezza dichiarata | catalogo scenari (sezione 4) disponibile e provato dal vivo |
| 7 | Organizzazione e risorse | 2,5 | riorganizzazioni modellate con impatto, ampiezza di controllo, livelli, costi, confronto col settore | scenari S-O provati, confronto col datastore |
| 8 | Change management | 0,5 | il cambiamento come oggetto: motivo, stato attuale e futuro, impatto, prontezza, piano di adozione, avanzamento misurato | un cambiamento di RTL portato dall'inizio alla fine |
| 9 | Ridisegno dei processi | 1,5 | come il processo è eseguito davvero, il disegno nuovo con impatto su posizioni e competenze | scenari S-P provati su un processo di RTL |
| 10 | Assistenza in ogni funzione | 2,5 | ogni pagina con il suo contesto e i suoi comandi; ogni funzione nuova nasce con la sua voce per l'agente | pagine con contesto dichiarato = pagine idonee; controllo in CI |
| 11 | Qualità e apprendimento | 1 | batteria per dominio sopra soglia, equità controllata, la memoria e le correzioni migliorano le proposte | soglia E11 su ogni dominio |
| 12 | Generazione di modelli | 3 | il modello di settore del datastore entra negli scenari come termine di confronto e come proposta | scenari con confronto di settore provati |

## 4. Il catalogo degli scenari what-if (E7)

Il motore è uno solo (voce F3): uno scenario è un oggetto con ipotesi, opzioni e risultati, calcolato su una **struttura ombra** del tenant, mai sulle tabelle vere. I numeri li calcola il codice; il modello compone lo scenario dalla domanda, sceglie le leve, confronta le opzioni, spiega e cita. Ogni scenario mostra almeno due opzioni, l'incertezza e le fonti, e diventa lavoro vero solo con un'applet confermata dalla persona (E3, E5).

Cinque famiglie di calcolo, in ordine di raffinatezza:

1. **Effetto diretto**: una leva, un risultato (chi tocca, quanto costa, che cosa scopre).
2. **Cascata**: una leva che ne muove altre (un'uscita apre una posizione, il successore lascia la sua, e così via fino in fondo).
3. **Nel tempo**: proiezione a 6, 12 e 36 mesi con le probabilità (uscite, prontezza, tempi di formazione e di selezione), con una banda di incertezza simulata a molte estrazioni e non un solo numero. Le probabilità si stimano sulla storia di 36 mesi di RTL (`db/scripts/storia36.sh`), dichiarando che è una storia generata.
4. **Sotto vincoli**: la soluzione migliore che rispetta budget, tempi, perimetri, contratti (CCNL del credito per RTL) ed equità (E12): ottimizzazione, non tentativi.
5. **Combinati e di resistenza**: più leve insieme e prove di resistenza della struttura, con il confronto col modello di settore del datastore.

| id | dominio | scenario |
|---|---|---|
| S-T1 | talenti e rimpiazzo | esce una persona chiave: successori, prontezza, tempi, formazione per colmare, costo del vuoto |
| S-T2 | talenti e rimpiazzo | catena di rimpiazzo a cascata: chi si sposta dopo chi, quali posizioni restano scoperte alla fine della catena |
| S-T3 | talenti e rimpiazzo | resistenza: e se nei prossimi 12 mesi esce il 10% dei talenti, con le probabilità per persona; quali unità cedono per prime |
| S-T4 | carriere e percorsi | piano di sviluppo per portare N successori a «pronto» entro una data, con formazione, mentorato e incarichi; probabilità di riuscita |
| S-T5 | carriere e mobilità | mobilità interna ottimale: assegnare persone a posizioni aperte massimizzando corrispondenza delle competenze e minimizzando i vuoti creati |
| S-C1 | competenze e formazione | il budget della formazione cambia (per esempio meno 20%): quali lacune restano, in quali posizioni critiche, con quale rischio |
| S-C2 | competenze | comprare, costruire o prendere in prestito una competenza: selezione esterna, formazione interna, consulenza; costo, tempo, rischio |
| S-C3 | competenze | competenze emergenti del settore (datastore, ESCO): chi è più vicino, quanto costa riqualificare, chi resta scoperto |
| S-C4 | formazione | portafoglio ottimale di iniziative sotto un budget: massima riduzione delle lacune pesate per criticità della posizione |
| S-K1 | KPI e valutazioni | cambiano i pesi di KPI e obiettivi nella valutazione: chi cambia fascia, chi supera le soglie di premio, quanto costa |
| S-K2 | valutazioni | calibrazione: incoerenze fra valutatori e unità, scarti non spiegati dai KPI, proposte di riallineamento |
| S-K3 | compensi | distribuzione del budget di merito sotto vincoli (equità interna, fasce del CCNL, prestazioni); divario retributivo prima e dopo |
| S-K4 | obiettivi | a cascata: un obiettivo di vertice cambia, quali obiettivi di unità e di persona vanno riallineati |
| S-S1 | selezione | coprire N posizioni dall'interno o dall'esterno: costo, tempi, catena di rimpiazzo creata, rischio di non coprire |
| S-S2 | selezione | la pipeline dei candidati: probabilità di coprire entro una data, colli di bottiglia per fase |
| S-S3 | selezione | il profilo della posizione: ruolo, competenze, livello CCNL e fascia proposti dal modello di settore e dalle posizioni simili |
| S-O1 | organizzazione | fondere, dividere o spostare unità: persone, posizioni, processi, riporti, costi, ampiezza di controllo prima e dopo |
| S-O2 | organizzazione | ampiezza di controllo e livelli: struttura alternativa che rispetta i limiti scelti, con chi cambia responsabile |
| S-O3 | organizzazione | confronto della struttura con il modello di settore del datastore: dove RTL si scosta e quanto costa avvicinarsi |
| S-O4 | organico | piano dell'organico a 12 e 36 mesi sotto un vincolo di costo: assunzioni, uscite, mobilità |
| S-M1 | cambiamento | un cambiamento come oggetto: stato attuale e futuro, impatto calcolato, prontezza per unità, piano di adozione con le tappe |
| S-M2 | cambiamento | prontezza e resistenza: per unità, sui sondaggi di engagement aggregati sopra soglia, carico di cambiamenti già in corso |
| S-M3 | cambiamento | sequenza: in che ordine introdurre più cambiamenti per non sovraccaricare le stesse unità |
| S-P1 | processi | ridisegno: togliere, unire o automatizzare attività; effetto su posizioni, competenze, carico delle unità, KPI del processo |
| S-P2 | processi | l'IA nelle attività: quali attività passano da persona ad assistita o automatizzata, con quale impatto su organico e competenze |
| S-P3 | processi | confronto col processo di riferimento del settore (datastore, APQC): passi mancanti, ruoli scoperti |
| S-X1 | combinato | fusione di due unità con le uscite previste, i successori e il piano di formazione insieme, in un solo scenario |
| S-X2 | combinato | piano strategico: un obiettivo del vertice tradotto in organico, competenze, formazione, selezione e cambiamento, con il costo totale |

## 5. Le voci

Ogni voce è un lotto per un thread suo (regola dei passi piccoli del 21/11), con il modello minimo adatto (regola del 07/11): **S** Sonnet, **O** Opus. «Fatta quando» è sempre una prova dal vivo su RTL con comando, esito, percorso e orario.

### Onda 0: decisioni e misura

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| Z0 | Valutazione, piano e proposta di ADR-0063 nel repo, PR in bozza | `docs/piani/PIANO_heuresys-ai-driven_20261126.md`, `docs/piani/ai-driven_20261126/`, `docs/architecture/adr/0063_*.md` | Claude (O) | PR aperta | fatta |
| Z1 | Sì di Enzo al piano | — | Enzo | risposta nel thread | fatta: «Sì, accetto ADR e piano», 2026-11-26 alle 03:47 ora di Roma |
| Z2 | ADR-0063 fondante: le decisioni E1-E15, l'organizzazione ghost, LIBERA spenta (emenda l'uso di ADR-0053), il motore degli scenari sulla struttura ombra, i segnalatori senza scrittura, equità dichiarata, memoria per persona, il metro per tutto il progetto | `docs/architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md`, `python docs/kb/tools/build_adr_index.py` | Claude (O) scrive; Enzo accetta | stato ACCETTATO nel file | fatta: ACCETTATO il 2026-11-26 alle 03:47 ora di Roma; ADR-0053 marcato «Superseded in part by ADR-0063 D4» |
| Z3 | Il rimando ad ADR-0063 nei `CLAUDE.md` di advanced e del datastore, nelle sezioni «Com'è oggi» del wiki (`prodotto-visione`, `agenti-ia`; la mappa degli ADR per dominio è già in Z0) | `CLAUDE.md`, `docs/wiki/domini/*.md`; datastore: `CLAUDE.md` con la sua sessione | Claude (S) | `check_documenti.py` e `build_wiki.py --check` verdi nei due repo | advanced fatto nella PR #499; datastore nella sua PR |
| Z4 | Riesame con il metro di ADR-0063 (D10) di ciò che esiste e dei programmi aperti: per ciascuno l'asse e il criterio che serve, che cosa si tiene, che cosa si assorbe qui, che cosa si ferma | `python3 docs/kb/tools/programmi.py`, piani in `docs/piani/`, `.programmi/`, datastore `esecuzione/programmi/` | Claude (O) | tabella del riesame in `docs/piani/ai-driven_20261126/RIESAME_programmi.md`, proposta a Enzo una volta | fatta la tabella il 2026-11-26 ([RIESAME_programmi.md](ai-driven_20261126/RIESAME_programmi.md)): 19 si tengono, 9 si assorbono, 2 voci si fermano (F3-2 e F3-3 del change management, contro D4), 5 in attesa, 9 con lo stato da riallineare; proposta nella sezione 7 del file, applicata il 2026-11-26 su decisione del coordinatore, che la ricava dalla risposta di Enzo all'intervista (E3, punto 3: «niente passa senza conferma mia») e da ADR-0063 D4: F3-2 e F3-3 sospese senza cancellare niente, rimandi di assorbimento nei file d'origine, stati riallineati come annotazioni (sezione 8 del file); tutto si rimette com'era se Enzo dice altro |
| Z5 | Controllo del metro: ogni ADR e piano nuovo dichiara asse e criterio di ADR-0063 D1 | `docs/kb/tools/check_metro_adr0063.py` in `state-lint.yml` | Claude (S) | visto rosso su un piano finto senza dichiarazione | fatta: il controllo è in `state-lint.yml` (self-test più repo); dichiarazione richiesta: una riga `Metro ADR-0063: asse N; criterio N` in ogni ADR dal 0064 e in ogni piano con data nel nome dal 2026-11-26; prova rossa/verde nel self-test, 2026-11-26 |
| M0 | Misura dell'uso reale in produzione, in sola lettura (conversazioni, persone, proposte, capacità e modo, ammessi) | query in `docs/piani/ai-driven_20261126/misura-uso.sql`, eseguita da un thread sulla VM | Claude (S) | numeri nel file della valutazione con l'orario | fatta: misura del 2026-11-26 alle 02:31 UTC, nella valutazione §2.6 |
| M1 | Il livello si misura da un comando: copertura di letture, scritture, pagine, segnalatori, scenari, batteria, uso | `docs/kb/tools/misura_livello_agentico.py` (dall'atlante e da `agent-operations.json`), in `verify_gate.py` | Claude (S) | il comando riproduce i numeri della valutazione; visto rosso togliendo una voce dal catalogo | aperta |
| M2 | Rito di cancello d'onda: si rimisura il livello con M1 e si scrive l'esito qui | questa tabella | Claude | a ogni fine onda | aperta |

### Onda 1: le fondamenta comuni (E8)

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| F0a | Aprire l'assistente a tutte le persone di RTL (E1): tenant RTL ammesso, limiti di servizio adeguati, coda con priorità invece del rifiuto quando l'abbonamento è pieno | drop-in del gateway sulla VM, `apps/agent-gateway/src/limiti.ts` | Claude (S) | tre persone di RTL con profili diversi conversano dal vivo, ognuna vede solo il suo perimetro | aperta |
| F0b | Garanzia di E3: nessuna attivazione LIBERA possibile per RTL finché Enzo non dice altro; il cancello lo ricontrolla | migrazione nuova, `capacita.ts`, prova | Claude (S) | prova rossa con un'attivazione finta, verde senza | fatta nel codice il 2026-11-26: migrazione 000518 (grilletto che rifiuta ogni `LIBERA` nuova, riporta a `CONFERMA` quelle in vigore, sentinella `sys.v_agent_capability_libera_in_vigore` a zero), API `AGENT_CAPABILITY_LIBERA_SPENTA`, cancello `LIBERA_SPENTA` (`apps/agent-gateway/test/libera-spenta.test.ts`, vista rossa sul cancello di prima e verde dopo); **fatta** il 2026-11-26: in produzione con dd750e70 (PR #505); prova dal vivo sulla VM alle 12:30 UTC: sentinella a 0 righe, il grilletto rifiuta l'accensione di `LIBERA` (provato dentro BEGIN e ROLLBACK, 0 capacità e 0 attivazioni prima e dopo), la rotta delle capacità risponde 409 `AGENT_CAPABILITY_LIBERA_SPENTA` |
| F0c | Riepilogo settimanale a Enzo di ogni scrittura confermata con l'agente (E5) | rotta di sola lettura, pagina, timer | Claude (S) | il riepilogo della prima settimana letto da Enzo | fatta nel codice il 2026-11-26: rotta `GET /v1/agent-weekly-summary` (confermate, negate, senza conferma, per persona e per scrittura, dal diario del cancello), pagina `/admin/agent-weekly-summary` in italiano e inglese, timer del lunedì alle 7:30 che mette l'avviso nella casella di chi ha il mandato di piattaforma, senza posta (E6); in produzione con dd750e70 il 2026-11-26 (PR #505); prova dal vivo sulla VM alle 12:30 UTC: timer attivo, rotta 200 con Valentina Conti (Direttore HR, settimana 16-22/11, totali 0), pagina aperta senza errori (schermata `/mnt/project-files/riepilogo-settimanale.png`); riserva: la vista di piattaforma non è provata con una persona dal vivo, perché l'unico `PLATFORM_ADMIN` attivo è Enzo (la copre la prova di integrazione); resta la lettura di Enzo del primo riepilogo, lunedì 30/11 |
| F1 | Copertura d'azione: ogni scrittura di business nel catalogo con la sua classe (oggi circa 28 su 341); le C sempre con conferma, le B con conferma per E3; nessuna cancellazione fisica | `docs/kb/agent-perimetri.json`, `build_agent_operations.py`, `classi-azioni.ts`, prova avversaria estesa | Claude (O) per la classificazione, (S) per i lotti | M1 ≥ 90% delle scritture; prova avversaria verde | in corso (PR #504, 2026-11-26): le 341 scritture hanno una riga in `docs/kb/agent-classi-scritture.json` (B 98, C 96, fuori 147 con la ragione); il catalogo dell'agente le apre con la classe, da 28 a 184 raggiungibili, tutte con la conferma della persona; prova avversaria estesa a ogni scrittura della mappa, verde. Copertura delle scritture di business 184 su 255 (72%), misura `python3 docs/kb/tools/check_copertura_agente.py`. Sotto il 90% restano 61 cancellazioni fisiche (classe X finché non diventano ritiri logici, ADR-0035) e 11 scritture del consolidamento, che sta su più prefissi; manca la prova dal vivo su RTL dopo il rilascio |
| F1b | Ogni funzione nuova nasce con la sua voce per l'agente (P1): controllo in CI che rende rossa una rotta senza classe né esclusione dichiarata | `docs/kb/tools/check_copertura_agente.py`, `.github/workflows/copertura-agente.yml` (le rotte si leggono dal codice, perché l'atlante si rigenera dopo l'unione) | Claude (S) | visto rosso con una rotta finta | fatta (PR #504): visto rosso il 2026-11-26 alle 03:10 UTC con `POST /rotta-finta` in `goals/routes.ts`, poi tolta; `--selftest` 3 su 3 |
| F2 | Conoscenza e memoria: si assorbe il piano K della PR #272 (documenti, politiche e regole consultabili, ricerca per parole e significato, memoria personale per E9) | voci K1-K10 e K15 di quel piano | Claude (O) | come nel piano K; memoria vista e cancellata da una persona di RTL | aperta |
| F3a | ADR e schema del motore degli scenari: scenario, versioni, ipotesi, leve, opzioni, risultati, struttura ombra (copia logica del tenant su cui si calcola senza toccare le tabelle vere) | ADR in Z2, migrazioni, `packages/shared/src/schemas/scenari.ts` | Claude (O) | catena provata sul gemello con `ci-rehearsal.sh`; nessuna scrittura sulle tabelle vere (post-condizione) | in corso: schema, guardie e fotografia nella migrazione 000515, contratto `scenari.ts`, nota [F3a_motore_degli_scenari.md](ai-driven_20261126/F3a_motore_degli_scenari.md); PR in CI |
| F3b | Calcolatori deterministici delle cinque famiglie (effetto diretto, cascata, nel tempo con simulazione a molte estrazioni, sotto vincoli, combinati) | `apps/api/src/modules/scenari/` | Claude (O) | prove con risultati attesi calcolati a mano; tempi sotto la soglia di P25 | aperta |
| F3c | Le probabilità stimate sulla storia di RTL (uscite, prontezza, tempi di formazione e selezione), al posto della regola lineare del rischio di uscita, con la banda di incertezza e la dichiarazione che la storia è generata | `apps/api/src/modules/insights/`, `db/scripts/storia36.sh` | Claude (O) | confronto fra stima e storia su un periodo tenuto da parte | aperta |
| F3d | L'agente degli scenari: dalla domanda allo scenario, confronto delle opzioni, spiegazione con le fonti; strumenti di classe A (lo scenario non scrive sulle tabelle vere) | gateway, istruzioni, catalogo | Claude (O) | S-T1 e S-O1 dal vivo con Valentina Conti | aperta |
| F3e | La pagina degli scenari: opzioni affiancate, grafici, banda di incertezza, modali a cascata sulle fonti, barra di avanzamento nei calcoli lunghi | `apps/web/src/app/(authenticated)/scenari/`, `@heuresys/ui` | Claude (S) | uso dal vivo con il profilo dell'HR manager | aperta |
| F4a | I segnalatori (E6): agenti in background che osservano e non scrivono; ogni segnalazione ha destinatario, perimetro, fonte, gravità, scadenza; niente doppioni | migrazione `sys_agent_signals`, timer con il token degli agenti, `docs/architecture/agenti/ANAGRAFE_agenti.md` | Claude (O) | tre segnalazioni vere su RTL arrivano alle persone giuste, nessuna fuori perimetro (prova) | aperta |
| F4b | La casella delle segnalazioni nella piattaforma, con «utile» e «non utile» che diventano la misura dell'asse 4 | pagina, rotte, `@heuresys/ui` | Claude (S) | uso dal vivo | aperta |
| F5 | Lavoro in più passi: si attua il piano delle applet (ADR-0060, voci P2 e P4-P14), con la conferma della persona per ogni applet (E3) | `docs/piani/PIANO_applet-assistente_20261118.md` | Claude (O) | come nel piano delle applet | aperta |
| F6a | La batteria della qualità per dominio e per Capo ghost (E11): almeno 200 domande vere per dominio con la risposta attesa ricavata dai dati di RTL, costruite e tenute da Claude; soglia 9 su 10; le risposte attese si ricavano con query riproducibili, non a memoria | `apps/agent-gateway/test/batteria/`, script di corsa sul gemello | Claude (S) | prima corsa con l'esito per dominio | aperta |
| F6b | Il controllo di equità (E12) su ogni proposta che riguarda persone: rapporto fra gruppi per genere, età e gli altri tratti protetti presenti nei dati; la proposta lo dichiara esplicitamente (esito, gruppi, rapporto); sotto soglia non si presenta come raccomandazione | `apps/api/src/lib/equita/`, componente della dichiarazione in `@heuresys/ui`, prova | Claude (O) | visto rosso su una proposta sbilanciata costruita apposta; dichiarazione visibile dal vivo | aperta |
| F6c | Fonti cliccabili (E13): ogni risposta e ogni scenario portano i riferimenti a dato, pagina e regola, aperti in modale | `istruzioni.ts`, `risposta-assistente.tsx` | Claude (S) | dal vivo su tre risposte | aperta |
| F7 | La squadra di specialisti è l'organizzazione ghost: vedi l'onda 1b qui sotto | — | — | — | assorbita in G1-G8 |
| F8 | Cruscotto degli agenti: uso, consumo per agente e persona, tempi, esiti, segnalazioni utili, decisioni prese con l'agente (test del valore, F0-3 del programma del change management), per Capo ghost e per specialista | piano K voce K13, pagina per Enzo | Claude (S) | una settimana di numeri letti da Enzo | aperta |
| F9 | Heuresys per gli assistenti esterni (E10): accesso con MCP per Claude e altri assistenti, con i permessi della persona, le classi e il cancello di sempre; nessun accesso senza login della persona | gateway, autenticazione, prova avversaria estesa | Claude (O) | una persona di RTL lavora da Claude sul suo perimetro; prova avversaria verde | aperta |

### Onda 1b: l'organizzazione ghost (E14, ADR-0063 D2)

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| G1 | Le unità ghost derivate dal vivo dall'albero delle unità del tenant (vertice, divisioni, direzioni entro il secondo livello), con la storia quando l'albero cambia; nessuna tabella di business toccata | vista o tabelle nuove in `sys.*` (RD-08, I5), migrazione provata sul gemello | Claude (O) | per RTL l'elenco ghost coincide con le unità reali di primo e secondo livello; un cambio d'albero su copia riforma l'elenco | aperta |
| G2 | Il profilo di ogni Capo ghost: missione, processi, posizioni e KPI dell'unità reale, conoscenza di settore dal datastore, metodologie della disciplina, tono consulenziale e prospettico; il profilo è dato versionato, non testo libero nel codice | `apps/agent-gateway/src/ghost/`, schema in `packages/shared` | Claude (O) | i profili di RTL generati e letti: uno per unità ghost | aperta |
| G3 | Le squadre: per ogni Capo i subagenti specialisti della sua area, con istruzioni, strumenti del catalogo e batteria (F6a); la divisione delle risorse umane ghost ha gli specialisti dei domini D1-D7 | gateway (sotto-agenti dell'SDK), anagrafe degli agenti | Claude (O) | un Capo attiva tre specialisti su una domanda e verifica le loro risposte, dal vivo | aperta |
| G4 | L'instradamento: l'assistente personale porta la domanda al Capo ghost competente; il Capo del vertice riunisce il comitato dei Capi quando la domanda attraversa più unità | gateway, istruzioni | Claude (O) | una domanda di riorganizzazione che tocca risorse umane e crediti, risolta dal comitato dal vivo | aperta |
| G5 | Il perimetro: ogni agente ghost legge con il perimetro della persona servita o del destinatario; prova avversaria su un Capo che prova a leggere oltre | prova avversaria estesa | Claude (S) | prova verde; vista rossa togliendo la guardia | aperta |
| G6 | I Capi ghost in background: osservano la loro area e producono segnalazioni (F4) e proposte di scenario, mai scritture | timer, `sys_agent_signals` | Claude (O) | una settimana di segnalazioni dei Capi su RTL, con il giudizio di utilità | aperta |
| G7 | La pagina «Organizzazione ghost»: l'organigramma ghost accanto a quello reale, Capi e squadre, che cosa stanno facendo, le loro segnalazioni e i loro scenari; modali a cascata; italiano e inglese | `apps/web/src/app/(authenticated)/organizzazione-ghost/`, `@heuresys/ui` | Claude (S) | uso dal vivo con il profilo dell'HR manager e con un capo di divisione | aperta |
| G8 | Anagrafe, versioni e promozione dei Capi e degli specialisti (P22, P23): una versione entra in servizio solo con la batteria sopra soglia | `docs/architecture/agenti/ANAGRAFE_agenti.md`, `check_anagrafe_agenti.py` | Claude (S) | il gateway rifiuta una versione non promossa (prova) | aperta |

### Onde 2-7: i domini (ordine di E8)

Per ogni dominio lo stesso schema di cinque voci, così ogni dominio arriva al livello 5 allo stesso modo:

- **a, scritture**: le scritture del dominio nel catalogo con la classe (parte di F1);
- **b, specialista**: un subagente della squadra del Capo ghost competente (G3), con istruzioni, conoscenza del dominio e batteria sopra soglia (F6a);
- **c, segnalatori**: almeno tre, elencati sotto (F4);
- **d, scenari**: quelli della sezione 4 per il dominio (F3);
- **e, applet**: almeno tre lavori in più passi (F5), dimostrati dal vivo con la persona del profilo giusto.

Base di oggi, per i soli strumenti del catalogo generico (`agent-operations.json` contro `atlas.yaml`, misura del 2026-11-26): letture al 100% in quasi tutti i domini; scritture talenti e carriere 6 su 33, competenze e formazione 1 su 46, KPI e valutazioni 2 su 29, selezione 0 su 14, organizzazione 0 su 55 (più gli strumenti con nome proprio su unità e posizioni), processi 2 su 23, persone e amministrazione 0 su 21.

| id | dominio | segnalatori (c) | scenari (d) | applet (e) | stato |
|---|---|---|---|---|---|
| D1 | Talenti, tavole di rimpiazzo, carriere e percorsi | posizione critica senza successore pronto; successore ad alto rischio di uscita; carriera ferma oltre la soglia | S-T1…S-T5 | piano di successione di un'unità; percorso di sviluppo per N successori; revisione dei talenti preparata | aperta |
| D2 | Competenze e formazione | lacuna critica in crescita; formazione obbligatoria in scadenza; competenza del settore assente nel tenant | S-C1…S-C4 | piano formativo sotto budget; riqualificazione di un gruppo; aggiornamento delle competenze di un ruolo | aperta |
| D3 | KPI, obiettivi, valutazioni e compensi | valutazioni incoerenti con i KPI; scarto fra valutatori; divario retributivo oltre soglia | S-K1…S-K4 | sessione di calibrazione preparata; riallineamento degli obiettivi a cascata; distribuzione del merito | aperta |
| D4 | Selezione interna ed esterna | richiesta ferma oltre i tempi; candidato interno idoneo non considerato; offerta fuori fascia | S-S1…S-S3 | apertura di una posizione con profilo e annuncio; confronto interno-esterno; pianificazione dei colloqui | aperta |
| D5 | Organizzazione e cambiamento | ampiezza di controllo fuori limite; unità con troppi cambiamenti insieme; posizioni senza titolare da tempo | S-O1…S-O4, S-M1…S-M3, S-X1, S-X2 | riorganizzazione di un'unità dall'inizio alla fine (E2); piano di adozione; comunicazione alle persone toccate, preparata e confermata | aperta |
| D6 | Processi | attività senza responsabile; processo con passi mancanti rispetto al riferimento; carico fuori misura su un'unità | S-P1…S-P3 | ridisegno di un processo; classificazione e mappatura verso APQC di un gruppo di processi | aperta |
| D7 | Persone e amministrazione (presenze, ferie, straordinari, engagement, faldone) | carico eccessivo prolungato; assenze anomale per unità, solo aggregate; calo di engagement | effetto su organico e carico (dentro S-O4) | pianificazione delle ferie di un'unità; risposta alle richieste dei dipendenti con le fonti | aperta |
| D8 | Datastore | prototipo di settore cambiato rispetto a quello del tenant | il modello di settore come termine di confronto in S-O3, S-C3, S-P3 | console con memoria (piano K, voce K15) | aperta |


## 6. Simulazione, scritta prima di eseguire

- **Dove si calcola uno scenario.** Sulla struttura ombra, mai sulle tabelle `sys.*` vere: la post-condizione di ogni prova conta le righe delle tabelle di business prima e dopo (regola delle scritture di massa). Lo scenario diventa lavoro solo con un'applet, che scrive con l'identità e i permessi della persona dopo la sua conferma (ADR-0060 E1, decisione E3).
- **Che cosa calcola il modello e che cosa il codice.** I numeri li calcola sempre il codice (riproducibili, provati); il modello sceglie leve e opzioni, spiega e cita. Un numero scritto dal modello senza calcolo è un difetto che la batteria deve vedere.
- **Capacità dell'abbonamento.** Aprire a tutte le persone di RTL (E1) e accendere i segnalatori consuma la capacità condivisa con i thread di sviluppo. Per questo i segnalatori girano a lotti con un tetto giornaliero (piano K, decisione D4), le domande vanno in coda con priorità e il consumo si vede (F8). Se la capacità non basta, lo si dice con la misura, non lo si presume.
- **Dati di RTL.** Le persone di RTL sono inventate; le probabilità stimate sulla loro storia valgono per la prova del motore, non come verità statistica, e lo scenario lo dichiara.
- **Persone e perimetri.** I segnalatori e gli scenari leggono con il perimetro del destinatario (I16-I22); le segnalazioni sulle persone passano dal controllo di equità; le segnalazioni restano dentro la piattaforma (E6), quindi nessuna classe C.
- **Altri thread.** Gateway agenti (PR #496), permessi, lingue e sottoprocessi lavorano ora: le voci F0a, F9 e G3-G4 toccano il gateway e partono dopo l'unione di #496. Il piano K (PR #272) e il piano delle applet si assorbono, non si duplicano: le loro tabelle restano la fonte delle loro voci. Ogni pagina nuova nasce con il selettore italiano e inglese.
- **Numeri delle migrazioni e ADR.** ADR-0058 è riservato dal piano K: questo piano usa ADR-0063 (ADR-0062 è della PR #498). Le migrazioni prendono il numero libero al momento della PR, dopo `git fetch`.
- **Chi serve davvero.** Enzo per Z1, Z2 (accettare l'ADR) e le prove dal vivo con le persone di RTL che vuole vedere; la batteria la fa tutta Claude (E11). Tutto il resto lo fanno i thread.

## 7. Registro delle scoperte (fuori da questo ciclo)

- La tabella del piano dell'assistente come Claude ha V1-V4 «da fare», ma V2 e V3 esistono nel codice (`omissis.ts`, `istruzioni.ts`).
- ADR-0033 è PROPOSED mentre il catalogo generico è in servizio.
- Le migrazioni 000510-000512 scrivono `fonte AGENTE` per regole SQL: l'etichetta promette un agente che non c'è.
- Il README del gateway descrive l'adattatore di un plugin oggi disattivato.
