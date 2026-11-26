# ADR-0062 — Heuresys è AI-driven: un'organizzazione ghost di agenti lavora con le persone del tenant

- **Status**: PROPOSTO il 2026-11-26, in attesa del sì di Enzo Spenuso.
- **Date**: 2026-11-26
- **Redatto da**: Claude Code, thread «Rendere Heuresys davvero AI-driven» del progetto «ENZO: heuresys ecosystem».
- **Richiesta**: Enzo Spenuso, 2026-11-26 alle 03:09 ora di Roma: verificare se advanced e datastore sono davvero agentici, a che livello, e che cosa va fatto perché il prodotto sia AI-driven ad assoluto livello. Alle 03:42 ora di Roma: «tutto quello che deriva dalla tua intervista e dalle mie indicazioni deve confluire in un ADR fondante del progetto/repo e che dovrà orientare tutte le valutazioni su quello che c'è già oggi e su tutti i programmi e le attività di sviluppo attuali e future».
- **Decided by**: le risposte di Enzo alle tredici domande dell'intervista dello stesso thread (2026-11-26 alle 03:26, 03:29 e 03:42 ora di Roma), riportate in §2 e nel piano.
- **Valutazione che lo prepara**: [`docs/piani/ai-driven_20261126/VALUTAZIONE_agentica_20261126.md`](../../piani/ai-driven_20261126/VALUTAZIONE_agentica_20261126.md), letta su `main` di advanced al commit `40e409a` e del datastore al commit `0309fb3`: livello agentico **2 su 5** su dodici assi.
- **Piano di attuazione**: [`docs/piani/PIANO_heuresys-ai-driven_20261126.md`](../../piani/PIANO_heuresys-ai-driven_20261126.md).
- **Builds on**: ADR-0040 (l'agente legge ciò che legge la persona), ADR-0050 D6 (l'agente non porta mandati), ADR-0054 D7 (l'IA è il modo di lavorare, non un modulo), ADR-0056 (i principi agentici, in particolare P1, P7, P12, P14, P22, P23), ADR-0060 (le applet dell'assistente), ADR-0061 (tassonomia dei processi); regola trasversale di Enzo del 2026-10-31 (Heuresys è una piattaforma agentica, AI driven).
- **Emenda**: ADR-0053 nell'uso, non nel meccanismo. Il registro delle capacità e il modo `LIBERA` restano nel codice, ma nessuna capacità si attiva in modo `LIBERA` finché Enzo non lo decide con una decisione nuova (D4). ADR-0054 D1 si allarga: il cambiamento organizzativo resta al centro, e tutte le funzioni dell'HR manager sono centrali allo stesso modo (D1).
- **Non tocca**: gli invarianti di `CLAUDE.md` (I1-I23), ADR-0036 (perimetri e mandati), ADR-0054 D6 (i confini del prodotto), ADR-0056 D3 (il motore degli agenti, questione chiusa).

> **In parole semplici.**
> 1. Heuresys si dichiara AI-driven solo quando raggiunge il livello 5 su dodici assi misurati, e sette criteri sono verdi con una prova dal vivo. Oggi è al livello 2.
> 2. Dentro ogni tenant lavora un'organizzazione «ghost»: per ogni divisione e direzione reale c'è un Capo agente, un consulente di altissimo livello del suo campo, con una visione prospettica. Ogni Capo attiva una squadra di agenti specialisti della sua area.
> 3. Gli agenti preparano: osservano, segnalano, costruiscono scenari what-if e piani. Non scrivono mai da soli: ogni modifica la conferma la persona che l'ha chiesta.
> 4. Tutte le persone di RTL usano l'IA, ognuna con i suoi permessi. Anche un assistente esterno come Claude può lavorare dentro Heuresys, con gli stessi permessi.
> 5. Ogni proposta che riguarda persone dichiara il suo controllo di equità. Ogni risposta porta le sue fonti.
> 6. Questo ADR è il metro di tutto il progetto: ciò che esiste, i programmi in corso e quelli futuri si giudicano con esso.

---

## §1 — Contesto

La valutazione del 2026-11-26 ha misurato che Heuresys ha fondamenta di governo degli agenti allo stesso livello dei migliori del mercato: classi fisse per ogni azione, cancello di scrittura, registro delle capacità, dati vietati mostrati come {omissis}, diario e prova avversaria. Ha misurato anche che l'IA vive in un pannello che risponde quando è interrogato. L'assistente raggiunge 387 letture su 415 ma circa 28 scritture su 341. Nessun agente lavora in background. Il consigliere e il rischio di uscita sono regole fisse. Non esistono scenari, né il cambiamento come oggetto.

I prodotti di riferimento del 2026 lavorano diversamente. SAP fa coordinare agenti specialisti da assistenti per ruolo. Oracle compone squadre di agenti che pianificano, simulano e ripianificano. Visier ha agenti che osservano l'organizzazione e segnalano da soli. Workday tiene un registro centrale degli agenti con uso e valore. Orgvue modella le riorganizzazioni con l'impatto mostrato prima di ogni scrittura (fonti nella valutazione, sezione 4).

Enzo ha chiesto di non accontentarsi e di arrivare al livello 5 su tutto. In più ha dato un'indicazione che nessuno di quei prodotti segue: l'organizzazione degli agenti rispecchia il vertice dell'organizzazione del cliente.

## §2 — Decisioni

**D1 — Che cosa vuol dire AI-driven.** Heuresys è AI-driven quando l'IA è il modo in cui ogni funzione si usa, non un pannello accanto alla funzione. Le funzioni sono quelle di oggi e quelle che verranno: persone, competenze, carriere e percorsi, tavole di rimpiazzo, selezione interna ed esterna, talenti, formazione, KPI, obiettivi e valutazioni, compensi, organizzazione e cambiamento, processi, amministrazione del personale. Il traguardo è il livello 5 su ciascuno dei dodici assi della valutazione e sette criteri verdi con una prova dal vivo:
1. ogni funzione è anche dell'agente;
2. ci sono agenti che lavorano da soli e segnalano;
3. c'è lavoro in più passi;
4. le decisioni si prendono su scenari;
5. il cambiamento è un oggetto;
6. i processi si ridisegnano con prove;
7. qualità e valore sono misurati.

Il livello si misura con un comando, non con un giudizio (voce M1 del piano). Ogni funzione nuova nasce con la sua voce per l'agente (P1). Una rotta di business senza classe né esclusione dichiarata è un difetto che la CI vede.

**D2 — L'organizzazione ghost.** In ogni tenant l'IA ha la forma di un'organizzazione «ghost» che riproduce i soli ruoli apicali di gestione dell'organizzazione reale: il vertice, le divisioni e le direzioni (le unità entro il secondo livello sotto il vertice, ricavate dal vivo dall'albero delle unità del tenant). Ogni unità ghost ha:
- un **Capo agente**, con il profilo di un manager di altissimo livello del campo dell'unità, che ragiona da consulente e in prospettiva: conosce la missione, i processi, le posizioni e i KPI dell'unità reale; conosce il modello di settore del datastore; conosce le metodologie della sua disciplina;
- una **squadra di subagenti specialisti**, focalizzati sull'area d'azione dell'unità, che il Capo attiva, coordina e verifica. Per esempio, la divisione delle risorse umane ghost ha gli specialisti di talenti e rimpiazzo, competenze e formazione, KPI e valutazioni, selezione, organizzazione e cambiamento, processi, amministrazione.

Le regole dell'organizzazione ghost:
- **Segue la struttura reale.** Quando l'albero delle unità cambia, l'organizzazione ghost si riforma, e la storia dei cambiamenti resta.
- **Ha un comitato.** Il Capo ghost del vertice riunisce i Capi interessati quando una domanda attraversa più unità. Per esempio, una riorganizzazione delle risorse umane tocca i processi della direzione crediti, e il Capo ghost dei crediti ne valuta l'impatto dal suo punto di vista.
- **Serve le persone vere.** La persona parla con il suo assistente personale (P7), che porta la domanda al Capo ghost competente. Il Capo risponde con il lavoro della sua squadra.
- **Non ha permessi propri.** Ogni agente ghost legge con il perimetro della persona per cui lavora in quel momento (P12, ADR-0040, ADR-0050 D6). Quando lavora in background, legge con il perimetro del destinatario della segnalazione. Un Capo ghost non vede di più perché rappresenta il vertice.
- **È in anagrafe.** Ogni Capo e ogni specialista ha una scheda con versione, istruzioni, strumenti e batteria di prove; si promuove con le prove (P22, P23).

**D3 — Gli agenti preparano, le persone confermano.** Gli agenti osservano, segnalano, costruiscono scenari, piani e applet. Nessuna scrittura parte senza la conferma della persona collegata che l'ha chiesta (risposte 3 e 5). Nessun agente in background scrive dati di business: produce solo segnalazioni e proposte. Le segnalazioni arrivano a ciascuno nel suo perimetro, in una casella dentro la piattaforma, per ora senza posta (risposta 6). Enzo riceve ogni settimana il riepilogo di tutte le scritture confermate con l'agente.

**D4 — Il modo LIBERA resta spento.** Il meccanismo di ADR-0053 resta nel codice e nelle prove, ma nessuna capacità si attiva in modo `LIBERA` per nessun tenant finché Enzo non lo decide con una decisione nuova. Il cancello lo ricontrolla a ogni scrittura.

**D5 — Gli scenari what-if.** Uno scenario è un oggetto con ipotesi, leve, opzioni e risultati, calcolato su una struttura ombra del tenant e mai sulle tabelle vere. I numeri li calcola il codice. Il modello sceglie le leve, confronta almeno due opzioni, spiega e cita. Le famiglie di calcolo sono cinque:
- effetto diretto;
- cascata;
- proiezione nel tempo con l'incertezza dichiarata;
- ottimizzazione sotto vincoli (budget, tempi, perimetri, contratti, equità);
- scenari combinati e prove di resistenza, con il confronto con il modello di settore del datastore.

Il catalogo iniziale è nel piano (sezione 4) e si allarga verso scenari sempre più raffinati (risposta 7). Uno scenario diventa lavoro vero solo con un'applet confermata (ADR-0060).

**D6 — Qualità, equità e fonti.**
- La batteria di domande vere con la risposta attesa la costruisce e la tiene Claude, per ogni dominio e per ogni Capo ghost (risposta 11). Un dominio è pronto solo sopra la soglia del piano.
- Ogni proposta che riguarda persone, per esempio rimpiazzi, promozioni, selezione, fasce di valutazione, compensi, passa da un controllo di equità per genere, età e gli altri tratti protetti presenti nei dati. Il controllo lo **dichiara esplicitamente** nella proposta: esito, gruppi confrontati, rapporto misurato. Sotto la soglia, la proposta non si presenta come raccomandazione (risposta 12).
- Ogni risposta e ogni scenario portano le fonti cliccabili: il dato, la pagina, la regola, aperti nelle modali a cascata (risposta 13).

**D7 — Memoria e apprendimento.** Gli agenti ricordano per persona ciò che la persona ha deciso, preferisce e ha corretto: la persona lo vede e lo cancella (risposta 9, P20). Le segnalazioni giudicate utili o inutili, le proposte accettate o scartate con il motivo e gli esiti delle batterie migliorano gli agenti, attraverso versioni promosse con le prove (P23).

**D8 — Chi usa l'IA.** Tutte le persone di RTL, ognuna con i suoi permessi (risposta 1). Anche un assistente esterno, come Claude, può lavorare dentro Heuresys con MCP, con i permessi della persona, le classi e il cancello di sempre; è già da adesso al servizio della piattaforma (risposta 10), non un'ultima fase.

**D9 — Un'etichetta dice la verità.** Ciò che fa una regola si chiama regola. Si chiama agente solo ciò in cui un modello ragiona. Le «proposte dell'agente» scritte da regole SQL (migrazioni 000510-000512) e i motori a regole (consigliere, rischio di uscita) si rinominano o diventano agenti veri, sotto un Capo ghost.

**D10 — Questo ADR è il metro.** Ogni ADR, piano, programma e voce di backlog nuovo, in advanced e nel datastore, dichiara quale asse e quale criterio di D1 serve e come rispetta D2-D9. I programmi aperti oggi si rileggono con questo metro (voce Z4 del piano). Il livello si rimisura a ogni fine onda. I `CLAUDE.md` dei due repo portano il rimando a questo ADR dal giorno in cui è accettato.

## §3 — Conseguenze

- **Capacità dell'abbonamento.** Un'organizzazione di agenti che lavora anche in background consuma molto più di un pannello. Il piano prevede lotti con tetto giornaliero, code con priorità e il consumo visibile per agente. Se la capacità non basta, lo si mostra con la misura.
- **Un Capo ghost non decide.** Il profilo di manager di altissimo livello serve alla qualità del ragionamento, non a un'autorità. Le decisioni restano alle persone, con la loro conferma (D3, D4).
- **Il perimetro vale anche per il vertice ghost.** Un Capo ghost lavora con il perimetro della persona servita. Per questo due persone diverse possono ricevere risposte diverse dallo stesso Capo, e deve essere così.
- **Prima di un cliente vero**: l'informativa ai lavoratori (L. 132/2025 art. 11) e la valutazione dei sistemi di IA in ambito HR prevista dall'AI Act (allegato III) si preparano con il pacchetto F6-1 del programma del change management. RTL è un tenant dimostrativo con persone inventate, e lì non servono.
- **Il datastore.** Il modello di settore diventa il termine di confronto degli scenari e la conoscenza di settore dei Capi ghost. La console del datastore riceve la memoria delle conversazioni (piano K, voce K15).

## §4 — Attuazione

Il piano [`PIANO_heuresys-ai-driven_20261126.md`](../../piani/PIANO_heuresys-ai-driven_20261126.md) attua questo ADR a onde, con un thread, una PR e una prova dal vivo per ogni voce. Assorbe il piano della conoscenza agentica (PR #272) e il piano delle applet (ADR-0060), senza duplicarli.
