# Piano: rifare l'interfaccia di advanced in modo sistematico (11 novembre 2026)

Mandato di Enzo del 2026-11-11 alle 00:23 ora di Roma, con otto schermate: le webapp mescolano italiano e inglese, scrivono le persone in tre modi, mostrano sigle e UUID, numeri senza separatori, pagine lunghe senza schede, una barra laterale che torna in cima a ogni clic, grafici illeggibili, righe vuote, il CCNL Commercio dentro una banca, tabelle-tabulato, dati che sembrano cliccabili e non aprono niente, nessuna spiegazione e nessuna finestra di sintesi a cascata come quella del banco del datastore. E soprattutto: ogni difetto segnalato veniva corretto dove era stato visto, non dove si ripeteva.

Questo piano cambia il metodo. Ogni difetto è una **classe**: si misura su tutte le pagine e con tutti i ruoli, si corregge con un solo strumento centrale (componente, formattatore, dizionario, migrazione alla fonte), e si dimostra chiusa rimisurando tutto. Il thread «Rendere intelligenti tabelle e dati di tutte le pagine» (PR #220, repertorio R1-R7 in `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`) e il thread della barra laterale (PR #213) confluiscono qui: le loro regole restano valide, il loro lavoro non si rifà.

Che cosa vuol dire «fatto»: il giro automatico (§3) su tutte le rotte con una persona per ogni ruolo trova zero rilievi nelle classi chiuse, e le schermate di ogni pagina per ogni ruolo sono state guardate e sono nel rapporto. Il rilascio in produzione e l'unione delle PR restano decisioni di Enzo.

Che cosa non si chiude in questo piano: il programma di allineamento dei dati di RTL al modello (thread «agente esperto bancario»), salvo le incoerenze che una pagina mostra e che si correggono alla fonte (classe C10).

## 1. Le classi di difetto

| id | classe | come si misura (giro §3) | soluzione centrale |
|---|---|---|---|
| C1 | Lingua: inglese nei testi, nelle etichette e nei valori (APPROVED, Long term, Accrual Policy, Year-end adjustment, leave_request) | parole inglesi da un dizionario chiuso e codici MAIUSCOLO_CON_TRATTINO nel testo visibile | dizionario unico dei valori (`lib/valori-leggibili.ts`) applicato da `EntityTable`, `EnumBadge` e grafici; i testi descrittivi importati in inglese si traducono alla fonte con una migrazione |
| C2 | Persone: email, UUID o «Nome Cognome» al posto di «Cognome, Nome» | email e UUID nel testo visibile | l'API restituisce il nome; nel web `NomePersona` e la rete di `EntityTable` risolvono id ed email in «Cognome, Nome» dalla rubrica del tenant |
| C3 | Sigle e codici senza descrizione (BUS-ENT, ISCO «21», POS-00000288) | colonne il cui contenuto è un codice | il codice va in seconda riga accanto alla descrizione, mai da solo; `Codice` con spiegazione al passaggio |
| C4 | Numeri non formattati (883217, 0.5, 60,000) | cifre ≥ 1000 senza separatore, decimali col punto, raggruppamento inglese | `useFormat()` già esiste: la rete di `EntityTable`, `StatsCard` e assi dei grafici lo applica sempre |
| C5 | Pagine lunghe da scorrere invece di schede | altezza della pagina > 3 schermate senza schede | `SchedePagina`: sezioni della pagina in schede orizzontali con l'indirizzo che ricorda la scheda |
| C6 | Barra laterale: torna in cima a ogni clic, gruppi piatti, gruppo Dashboard | posizione di scorrimento dopo un clic; profondità dell'albero | voci con `Link` di Next (niente ricarica della pagina), posizione salvata, sottogruppi |
| C7 | Intestazioni: spazio vuoto dopo l'header, titolo che non si distingue | distanza fra intestazione e primo contenuto; dimensione del titolo | `IntestazionePagina` compatta, titolo marcato, descrizione su una riga |
| C8 | Grafici illeggibili: legende sovrapposte, assi senza unità, numeri inglesi | grafici con legenda a scorrimento, assi con «,» di migliaia | involucro unico dei grafici: legenda sotto e leggibile, assi con unità e forma italiana |
| C9 | Righe vuote o incomplete | righe con metà o più delle celle vuote | l'API non restituisce righe senza dati che servono; la pagina dice che cosa manca invece di «—» ripetuto |
| C10 | Dati incoerenti col tenant (CCNL Commercio in una banca) | confronto fra industria del tenant e dati mostrati | correzione alla fonte con migrazione dichiarata (I21, ADR-0043) |
| C11 | Tabelle-tabulato: colonne e righe che non servono alla gestione | giudizio per pagina (R2) | ogni tabella sceglie le colonne per il lavoro di chi guarda; il resto va nella scheda di dettaglio |
| C12 | Dati che sembrano cliccabili e non aprono niente; dati che dovrebbero aprire la loro catena | elementi con aspetto di collegamento senza azione | `SchedaRapida`: finestra di sintesi a cascata (come il banco del datastore) per persona, posizione, unità, processo, ruolo |
| C13 | Nessuna spiegazione | intestazioni e indicatori senza aiuto | `InfoTip` con il glossario unico (`lib/glossario.ts`) |
| C14 | Errori di pagina: richieste `/v1/*` fallite, console con errori | rete e console durante il giro | correzione per causa |
| C15 | Niente insight: la pagina si apre con un tabulato invece che con ciò che serve decidere (anomalie, tendenze, rischi, azioni suggerite) | pagina il cui primo schermo è una tabella o un elenco senza una sintesi | `QuadroInsight` in testa a ogni pagina: tre-cinque segnali calcolati dall'API sul perimetro di chi guarda, ognuno cliccabile verso la catena che lo spiega (C12) |

**Criterio di «fatto» per ogni pagina** (Enzo, 2026-11-11 00:27 Roma: «un'interfaccia moderna, accattivante, piacevole da usare, che stimola la curiosità… dove sono gli insight?»): il primo schermo dice che cosa sta succedendo e che cosa merita attenzione, con numeri veri del tenant e un comando per andare a vedere; i dati vanno incontro a chi guarda, non si cercano. La tabella completa resta, ma dopo, in una scheda, con le colonne utili alla gestione.

## 2. L'ambiente di verifica

Un banco sulla VM, su una **copia** del database ripristinata dall'ultima copia di fase in un cluster PostgreSQL privato della sessione (porta libera, solo `localhost`), con API e web costruiti dal ramo del lavoro su porte libere e chiavi di firma proprie. Le persone si impersonano firmando l'accesso con la chiave del banco (`scripts/banco-verifica.sh gettone <email>`): niente parola d'ordine e niente secondo fattore, perché la chiave vale solo per il banco. La produzione, le sue chiavi, `heuresys_advanced` e `heuresys_ci` non si toccano; il codice di autenticazione del prodotto non cambia.

## 3. Il giro automatico

`apps/web/tests/giro/giro.mjs`: per ogni persona (una per ruolo, scelta dal database del banco) apre ogni rotta di prodotto (dalle cartelle di `src/app/(authenticated)`, rotte con parametri risolte seguendo il primo collegamento), salva la schermata intera e misura le classi C1-C9, C12 e C14 con `misure.js`. Esito: `giro-esito.json`, un rapporto per classe e una pagina di provini con tutte le schermate.

## 4. Registro di avanzamento

Misure del giro (pagine / occorrenze; giro 2 = `20261111-0223` su a8921995, giro 3 = `20261111-0411` su 9f82ba92; esiti in `~/heuresys-advanced-giro/<giro>/` sulla VM, non versionati):

| classe | giro 2 | giro 3 | correzioni dopo il giro 3 |
|---|---|---|---|
| C1-codice | 35 / 2141 | 24 / 1368 | codici interpolati nelle frasi (formattatore i18n), caselle di scelta di assenze e visualizzazioni |
| C1-inglese | 56 / 3190 | 37 / 1851 | resto in buona parte testi salvati nel database (storia retributiva, obiettivi): passati al thread dei dati |
| C2-email | 5 / 1056 | 2 / 24 | |
| C2-uuid | 6 / 491 | 0 / 0 | |
| C3-codice-solo | 15 / 2871 | 4 / 628 | annunci e richieste aprono con titolo e posizione; numero dell'attestato nella scheda |
| C3-codice-prima-colonna | 13 / 135 | 7 / 69 | |
| C4-decimale-col-punto | 11 / 793 | 4 / 274 | importi accanto alla valuta |
| C4-migliaia-inglesi | 3 / 117 | 3 / 117 | «4,069 EUR» → «4.069 EUR» |
| C4-senza-separatore | 19 / 550 | 16 / 338 | numeri interpolati con i separatori; copertura dati 0..100 |
| C5-pagina-lunga | 18 / 100 | 19 / 119 | schede su persona, visualizzazione, candidati, selezione, talent review, assenze, lacune |
| C7 (tre classi) | 82 / 896 | 1 / 19 | |
| C8-canvas-senza-testo | 15 / 230 | 6 / 114 | |
| C9-riga-vuota | 5 / 398 | 6 / 423 | colonne vuote ovunque escono dalla tabella; serie vuote dalla tabella del grafico |
| C10-industria-diversa | 3 / 128 | 3 / 128 | dato: thread dell'agente bancario |
| C12-tabella-senza-dettaglio | 33 / 289 | 15 / 122 | il giro non lo chiede più alle tabelle dei grafici |
| C13-senza-spiegazioni | 41 / 415 | 22 / 208 | otto concetti nuovi nel glossario; intestazioni ovvie escluse dalla misura |
| C14-console | 98 / 1191 | 0 / 0 | |
| C14-rete | 8 / 103 | 0 / 0 | |
| C14-caricamento | 9 / 40 | 1 / 1 | /system-health: misura del tempo dell'API nel giro 4 |
| C15-senza-insight | 44 / 270 | 6 / 13 | chi vede solo sé stesso riceve le lenti personali |

Giro 10 (`giro-20261111-1259` su 5f0b172f, 2014 esiti, nessuna richiesta `/v1` fallita né errore di console). Ciò che resta sopra zero, e di chi è:

| classe | pagine / occorrenze | dove sta | chi lo chiude |
|---|---|---|---|
| C1-codice, C1-inglese, C5, C9, C12 | /admin/roles, /job-catalog | pagine del ramo k0v5tl | il thread «tabelle intelligenti» |
| C1-inglese | /me/delegations, /okrs, /me/career, /dashboard/[famiglia], /analytics/kpi, /leads (54) | titoli di posizioni, obiettivi, KPI, corsi e messaggi salvati in inglese | il thread dei dati (agente bancario) |
| C1-inglese | /me/matching (4) | nomi ESCO in inglese: il codice legge già l'etichetta italiana, che arriva con la migrazione 000486 della PR #228 | PR #228 |
| C4 | /content, /me/inbox, /me/career (19) | residui di prova («ZZZ Link E2E», «Fascicolo di prova») e un titolo «4.5/5» | il thread dei dati |
| C10 | /org-director/vrio, /analytics/skills-group-share (8) | competenze di altre industrie assegnate alle persone di RTL; il VRIO ora mostra quali competenze compongono ogni gruppo | il thread dei dati |
| C15 | nessuna nel giro 11 | il giro aspetta la chiamata del quadro (5e291a8e): nel giro 11 (`giro-20261111-1422` su 8746bceb) C15 è a zero, tutte le altre classi identiche al giro 10, nessuna pagina nuova | chiusa |

Giro 11, verifiche a mano: come piattaforma su una posizione di RTL la tendina dei ruoli porta solo i 142 ruoli del perimetro di RTL (34 esclusi, nessun termine di altre industrie); come custode delle segnalazioni la console mostra il quadro con la lente delle segnalazioni aperte.

Correzioni dei giri 4-11, tutte nel ramo `claude/project-thread-s3y6jo` (PR #227): schede orizzontali su KPI, formazione, tassonomia, direzione, contenuti, MFA, approvazioni; testoLeggibile su codici e chiavi minuscole; deleghe in «Cognome, Nome»; provenienza con i nomi italiani di tutte le 70 tabelle d'origine misurate; quote dei gruppi di competenze nel perimetro del cliente (I21); consigli del direttore a pagine; professioni ESCO in italiano quando il catalogo le porta; VRIO con le competenze che compongono ogni gruppo; tendine della scheda di posizione nel catalogo e nelle persone del suo cliente; quadro della console delle segnalazioni calcolato dentro la custodia (#99 F4).

Criterio di chiusura (Enzo, 2026-11-11): «non dirai "fatto" fino a quando non avrai verificato e corretto il singolo bit di tutte le interfacce e delle loro catene». Il lavoro si chiude solo con un giro completo, tutte le pagine per tutti i ruoli, a zero rilievi, con le schermate.

Coordinamento: le pagine del ramo «tabelle intelligenti» (`claude/project-thread-k0v5tl`: posizioni, ruoli, catalogo delle professioni, organizzazione, persone) non si toccano finché quel ramo non è unito. Sul CCNL di RTL l'agente esperto bancario ha misurato 158 contratti, tutti Credito 2024, e 15 regole di maturazione del Commercio duplicate che sta togliendo lui; le fasce Commercio e Metalmeccanico sono righe di catalogo senza tenant, visibili al solo mandato di piattaforma.
