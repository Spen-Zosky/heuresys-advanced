# Programma esecutivo: Heuresys per il change management

Data: 3 novembre 2026. Thread «Ricostruire la visione completa di Heuresys». Nasce dalla visione integrata (`docs/product/VISIONE_INTEGRATA_HEURESYS_20261103.md`, d'ora in poi VISIONE) e dalle decisioni di Enzo del 3/11, alle 04:33, alle 04:34, alle 04:39 e alle 05:15 ora di Roma. Riguarda advanced e datastore insieme. Scala di grigi, nessuna emoji.

## 1. Mandato e regole del programma

Enzo, 3/11 alle 05:15: il programma si attua sempre con le raccomandazioni di questo thread, che risolve da sé incoerenze, ambiguità e contraddizioni appoggiandosi alle buone pratiche documentate da società di consulenza e istituzioni accademiche; si comincia dalle copie e si passa alla produzione per capacità, una alla volta, ciascuna con il proprio ritorno provato.

Regole che valgono per ogni mandato:

1. Prima la copia, poi la produzione. Ogni capacità nuova si prova su una copia usa-e-getta (`bash scripts/copia-prova.sh` per il repository, banco usa-e-getta per i dati: PIANO interfacce, opzione A) e passa in produzione da sola, con il proprio ritorno provato (ADR-0052 per la copia di fase; rollback dichiarato per ogni scrittura di massa: CLAUDE.md, «Lavorare sui dati e sul codice»).
2. Fatto vuol dire dimostrato dal vivo: login con una persona reale del tenant, uso secondo il suo profilo, comando, output, orario (CLAUDE.md, «Quando un lavoro è finito»; ADR-0026).
3. Ogni funzione nasce con la sua metrica, scritta nel mandato prima del codice.
4. Ogni proposta di un agente in produzione ha una persona che decide, finché l'ADR-0053 non dice altro per quella capacità.
5. Restano a Enzo: armare un rilascio (`refs/heads/prod`), le spese, e le frasi che il controllo dei permessi chiede nel thread per scrivere o leggere in produzione (MEM, «LIMITE DELEGA»). Ogni mandato che ne ha bisogno lo dice nella colonna «serve Enzo», con il testo esatto da scrivere.
6. Distribuzione e ordine fra i thread li decide il coordinatore (MEM, regola del 31/10 21:53). Questo programma propone l'ordine; il coordinatore lo impone.

Scelta dei modelli (istruzioni globali di Enzo, «Quale modello»): Haiku per misure, conteggi e conversioni; Sonnet per codice su specifica chiara; Opus per progettare, diagnosticare e decidere; Fable solo per una decisione che non si può disfare o per l'ultima revisione prima di un cambiamento irreversibile. Lo sforzo segue la stessa logica: basso per il meccanico, medio per l'esecuzione, alto per il disegno.

## 2. Incoerenze risolte da questo thread

Ognuna è una decisione presa per delega di Enzo del 3/11 alle 05:15. Si può contestare; finché nessuno la contesta, vale.

| id | incoerenza | decisione | perché |
|---|---|---|---|
| R-1 | Tre posizionamenti: «Skills & Org Intelligence» (PRD di giugno), «Organizational Intelligence & Workforce Orchestration» (visione di agosto), change management (Enzo, 3/11) | Vale il change management; gli altri due diventano capacità al suo servizio. Lo fissa l'ADR del mandato F0-1 | è la parola di Enzo più recente e li contiene: lo stato dell'organizzazione serve a governarne il passaggio (VISIONE §1bis) |
| R-2 | Cliente tipo: 250-2000 dipendenti (PRD) contro PMI italiane (DREAM) | Primo: un fornitore come SAP o Zucchetti; secondo: una media impresa manifatturiera. Nessuna specializzazione per industria | risposte 1 e precisazione delle 04:34 (VISIONE §10) |
| R-3 | Il PRD dice «non è un BPM» e «layer prescrittivo non costruito», il codice li ha | Il PRD si riscrive nel mandato F0-1 come documento storico più una nota che rimanda all'ADR | VISIONE §2.3 punto 3 |
| R-4 | Prototipi per industria nel datastore contro prodotto generalista | I prototipi d'industria restano acceleratori; si separa nel datastore ciò che è comune a ogni impresa (mandato F5-1) | VISIONE §1bis, precisazione delle 04:34 |
| R-5 | Il README del gateway dice «non distribuito», l'unità è in servizio dal 31/10 | Il README si corregge nel primo mandato che tocca il gateway (F3-1) | VISIONE §4 |
| R-6 | Stato del progetto: SOT_STATE fermo al 27/09, 114 moduli contro 80 dichiarati | Non si corregge qui: è compito della skill `handoff` a fine sessione; il coordinatore lo segnala al prossimo thread di chiusura | CLAUDE.md, «Fonti di verità» |
| R-7 | Due piani in parallelo: il piano interfacce (PR #153, lotti L0-L13) e questo programma | Il piano interfacce resta la fonte per la qualità delle pagine; questo programma ne anticipa alcune voci (fase F1) e non le duplica | evita due elenchi per la stessa cosa |
| R-8 | Il «test del valore» è un criterio senza misura | Diventa la metrica comune di tutto il programma (mandato F0-3) | BUSINESS_SCOPE_AND_PRD.md §1.2 e §2.8 |

Sulle fonti: si pesano di più gli studi accademici e i dati con metodo dichiarato; i numeri delle società di consulenza e dei fornitori si usano dichiarandone l'origine. Esempio già applicato: il «70% dei cambiamenti fallisce» non ha base empirica valida e non si usa (VISIONE §1bis punto 3).

## 3. Che cosa non si chiude in questo programma

Dichiarato all'inizio, come chiedono le istruzioni globali: presenze, payroll, firma elettronica e app mobile nativa (sono il terreno dei sistemi da affiancare: VISIONE §8.2); il reclutamento, che resta costruito ma dichiarato non attivo (PIANO interfacce, decisione 9); la porta MCP del datastore verso advanced; le lacune di mercato del lotto L13 che non riguardano l'integrabilità.

## 4. Le fasi e i mandati

Ordine proposto: F0 subito; F1 e F2 in parallelo dopo F0-1; F3 dopo F0-2 e F6-1; F4 dopo F0-1 e F3-1; F5 in parallelo a F4. Ogni riga è un mandato per un thread: una PR, una dimostrazione, un rilascio quando tocca la produzione.

### F0. Fondamenta di decisione

| id | cosa | modello e sforzo | fatto quando | serve Enzo | stato |
|---|---|---|---|---|---|
| F0-1 | ADR del posizionamento (numero dopo lo 0053): change management al centro, modellazione organizzativa di ogni impresa, primi clienti, confini; riscrive `docs/product/README.md` e marca come storico il PRD di giugno | Opus, alto | ADR accettato da questo thread per delega, indice degli ADR aggiornato, PR unita | no | da fare |
| F0-2 | ADR-0053, agenti liberi in produzione per capacità | Opus per la stesura; Fable per l'ultima revisione prima dell'accettazione | già avviato: PR #155 in bozza, thread «Liberare gli agenti IA in produzione»; deve contenere le due condizioni della scheda del 3/11 (informativa, ritorno provato) e la regola «una capacità alla volta» | accettazione dell'ADR | avviato |
| F0-3 | Il test del valore come misura: una tabella di eventi d'uso e decisione (chi, quale pagina o agente, quale decisione, quando) e la definizione unica di «decisione tracciabile»; senza pagina, solo registro e query | Opus per il disegno, Sonnet per migrazione e API; medio | una query restituisce, per tenant e per settimana, le decisioni tracciabili; prova rossa prima e verde dopo; dimostrazione su RTL | frase per leggere in produzione | da fare |

### F1. Riscuotere ciò che è già costruito

Voci del piano interfacce anticipate, scelte perché un Direttore HR o un capo di unità le nota al primo uso (VISIONE §7). Ogni voce: una PR, pagina sulle API che esistono, dimostrazione dal vivo con la persona RTL del ruolo.

| id | cosa | voce del piano interfacce | modello e sforzo | metrica | stato |
|---|---|---|---|---|---|
| F1-1 | Approvazioni con paginazione e totale | V-1 (lotto L4) | Sonnet, medio | il Direttore HR raggiunge 741 su 741 | da fare |
| F1-2 | Incarichi e trasferimenti persona-posizione, con approvazione | G-3 | Sonnet, medio; Opus basso per rivedere il perimetro | incarichi fatti da pagina invece che da API | da fare |
| F1-3 | Pagina del responsabile di processo: fasi, richieste, tempi | G-9, G-23 | Sonnet, medio | il responsabile vede il suo processo; tempo per fase misurato | da fare |
| F1-4 | Privacy del dipendente: consensi ed export art. 15 | G-11 | Sonnet, basso | export richiesto e consegnato da pagina | da fare |
| F1-5 | Schede in pagine esistenti: chiusura dei gap, prontezza dei successori, misure dei KPI, allineamento degli obiettivi | G-6 e voci G collegate | Sonnet, basso; un solo thread, una PR per scheda | ogni scheda aperta da una persona del ruolo | da fare |

### F2. Integrabilità per un fornitore come SAP o Zucchetti

| id | cosa | modello e sforzo | fatto quando | stato |
|---|---|---|---|---|
| F2-1 | API pubblica accesa e documentata come prodotto (OpenAPI), con paginazione a cursore e idempotenza sulle scritture | Opus medio per il contratto, Sonnet medio per l'attuazione | documento OpenAPI servito e coerente con le rotte, prova di contratto in CI | da fare |
| F2-2 | Webhook minimi: cambi di posizione, di unità e di incarico verso un indirizzo registrato dal tenant, firmati | Opus per il disegno, Sonnet per l'attuazione; medio | un evento reale di RTL arriva a un ricevitore di prova con firma valida | da fare |
| F2-3 | Accesso unico OIDC per il tenant (SAML dopo, se un fornitore lo chiede) | Opus alto, perché tocca l'autenticazione (I7, ADR-0050) | login di una persona RTL da un fornitore di identità di prova, con il secondo fattore rispettato | da fare |

### F3. Agenti: zona libera, registro, promozione per capacità

| id | cosa | modello e sforzo | fatto quando | serve Enzo | stato |
|---|---|---|---|---|---|
| F3-1 | Registro degli agenti e firma «per conto di» in ogni audit (agente, capacità, versione, stato, chi può usarlo); corregge il README del gateway (R-5) | Opus per il disegno, Sonnet per l'attuazione; medio | ogni azione di un agente ha un attore e un «per conto di»; quota attribuita 100% | no | da fare, coincide con il lotto L9 del piano interfacce |
| F3-2 | Zona libera: banco usa-e-getta con una copia di RTL dove gli agenti scrivono senza conferma, e un registro di che cosa hanno fatto e con quale esito | Opus, medio | una corsa libera del consolidamento sui gruppi posizioni e ruoli, misurata contro le decisioni umane del 2/11 | no | da fare |
| F3-3 | Prima capacità promossa in produzione secondo l'ADR-0053: il consolidamento dei gruppi successivi all'organizzazione | Opus per la decisione; Fable per l'ultima revisione prima della promozione | ritorno provato sulla copia, informativa pronta (F6-1), promozione e dimostrazione dal vivo | frase per scrivere in produzione; armare il rilascio | da fare |

### F4. Il nucleo del change management

| id | cosa | modello e sforzo | fatto quando | stato |
|---|---|---|---|---|
| F4-1 | ADR del cambiamento come oggetto: sponsor, stato attuale, stato futuro, impatto calcolato con il motore del consolidamento | Opus, alto | ADR accettato per delega | da fare |
| F4-2 | C-1 in sola lettura: creare un cambiamento su una copia della struttura e vedere chi e che cosa tocca | Sonnet, alto per la parte di motore; Opus per la revisione | dimostrazione con una riorganizzazione di prova su RTL in zona libera, poi in produzione | da fare |
| F4-3 | C-2, cockpit del capo di unità | Sonnet, medio | un capo di filiale RTL lo usa; metrica: aperture e azioni chiuse da lì | da fare |
| F4-4 | C-3, «La mia azienda e il mio ruolo»: prima la pagina (posizione, processi, responsabili, a chi rivolgersi), poi l'agente che risponde con le fonti | Sonnet medio per la pagina; Opus medio per l'agente | metrica di domande risolte senza scrivere a nessuno, definita prima di accendere l'agente | da fare |
| F4-5 | C-4, prontezza per unità sul modello ADKAR, sui sondaggi di engagement esistenti, solo aggregata sopra una soglia | Sonnet, medio | una rilevazione di prova su un'unità RTL toccata da F4-2 | da fare |
| F4-6 | C-5, adozione misurata, sulla tabella di F0-3 | Sonnet, medio | adozione, utilizzo ed efficacia di un cambiamento di prova | da fare |

### F5. Indipendenza dal settore

| id | cosa | modello e sforzo | fatto quando | stato |
|---|---|---|---|---|
| F5-1 | Misura: quante voci hanno in comune il prototipo bancario e quello metalmeccanico, per gruppo (unità, posizioni, processi, competenze) | Haiku, basso | tabella misurata nel datastore, con il comando che la produce | da fare |
| F5-2 | Separare nel datastore il modello comune a ogni impresa dalle parti di settore, sulla base di F5-1 | Opus per il disegno, Sonnet per l'attuazione; alto | un prototipo per un settore mai visto parte dal modello comune e passa il contratto v0.3 | da fare |
| F5-3 | Il prototipo metalmeccanico consegnato ad advanced su una copia (zona libera), materializzato in un tenant di prova e consolidato | Sonnet, medio | il tenant di prova esiste solo sulla copia; nessun terzo tenant in produzione senza un ADR che cambi I15 | da fare |

### F6. Conformità dell'IA

| id | cosa | modello e sforzo | fatto quando | stato |
|---|---|---|---|---|
| F6-1 | Pacchetto per agente: valutazione ai sensi dell'art. 6(3) dell'AI Act, registro (F3-1), log, testo dell'informativa ai lavoratori e alle rappresentanze ai sensi della legge 132/2025 art. 11 | Opus, medio; Fable per la revisione prima di F3-3 | un documento per il consolidamento, pronto prima della sua promozione | da fare |

## 5. Ordine di distribuzione proposto al coordinatore

1. Subito: F0-1, F0-3, F5-1 (indipendenti fra loro); F0-2 prosegue nel suo thread.
2. Dopo F0-1: F1-1 e F1-2, poi F1-3, F1-4, F1-5; in parallelo F2-1.
3. Dopo F0-2 e F6-1: F3-1, F3-2, poi F3-3.
4. Dopo F3-1: F4-1, poi F4-2…F4-6 nell'ordine; F2-2 e F2-3 quando un fornitore è in vista.
5. Dopo F5-1: F5-2 e F5-3.

Ogni fase che tocca la produzione chiude con una copia di fase (ADR-0052) prima del rilascio successivo.

## 6. Chiusura

Il programma si chiude in forma binaria, leggendo le colonne «stato» di questo file: «PROGRAMMA CHIUSO, N/N mandati fatti» oppure «PROGRAMMA NON CHIUSO, manca il mandato K, serve Y». Le scoperte fatte strada facendo non allungano le tabelle: vanno in un registro a parte e si propongono a Enzo una volta sola.
