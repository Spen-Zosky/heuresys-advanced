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

| classe | stato | misura prima | misura dopo | PR |
|---|---|---|---|---|
| C6 barra laterale | soluzione centrale fatta (`components/menu-laterale.tsx`, `lib/menu-albero.ts`) | giro 1 | | #227 |
| C2 persone | fatta: rubrica `GET /v1/me/rubrica` e rete in ogni cella | giro 1 | | #227 |
| C1, C4 lingua e numeri | fatta: rete di leggibilità (`lib/leggibile*.ts`), indicatori; la correzione alla fonte dei dati inglesi resta da fare per ciò che il giro trova | giro 1 | | #227 |
| C8 grafici | fatta: `rendiLeggibile` in `_charts-client.tsx` | giro 1 | | #227 |
| C7 intestazioni | fatta: `components/intestazione-pagina.tsx` in 77 pagine | giro 1 | | #227 |
| C12 schede a cascata | fatta: `components/scheda-rapida.tsx`, nomi cliccabili dalla rete | giro 1 | | #227 |
| C13 spiegazioni | fatta: `lib/glossario.ts`, `components/spiegazione.tsx` su colonne e indicatori | giro 1 | | #227 |
| C15 insight | fatta: `GET /v1/me/quadro` (22 lenti) montato da `PageHeader`; le pagine di configurazione non hanno ancora un'area | giro 1 | | #227 |
| C5 schede | componente fatto (`components/schede-pagina.tsx`), applicato a retribuzioni; le altre pagine dalle misure del giro | giro 1 | | #227 |
| C3, C9, C10, C11, C14 | da fare sulle misure del giro (C10 ha ora il suo rilevatore) | giro 1 | | |

Criterio di chiusura (Enzo, 2026-11-11): «non dirai "fatto" fino a quando non avrai verificato e corretto il singolo bit di tutte le interfacce e delle loro catene». Il lavoro si chiude solo con un giro completo, tutte le pagine per tutti i ruoli, a zero rilievi, con le schermate.

Coordinamento: le pagine del ramo «tabelle intelligenti» (`claude/project-thread-k0v5tl`: posizioni, ruoli, catalogo delle professioni, organizzazione, persone) non si toccano finché quel ramo non è unito. Sul CCNL di RTL l'agente esperto bancario ha misurato 158 contratti, tutti Credito 2024, e 15 regole di maturazione del Commercio duplicate che sta togliendo lui; le fasce Commercio e Metalmeccanico sono righe di catalogo senza tenant, visibili al solo mandato di piattaforma.
