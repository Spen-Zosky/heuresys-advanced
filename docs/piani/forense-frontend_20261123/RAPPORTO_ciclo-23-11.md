# Rapporto del ciclo forense del 23 novembre 2026

Il ciclo riprende il controllo forense del frontend di produzione (mandato di Enzo del 15/11/2026, invariato) dal giro v1 del 20/11, rimasto con 4.973 unità in coda. Questo rapporto dice che cosa è stato visitato, giudicato e corretto, e che cosa resta. Le cifre si ricavano dai registri dei giri con `node ~/.claude/tools/qa-web/qa-web.mjs stato --giro <giro>` e dal file `pagina-per-ruolo.tsv`, prodotto da `scripts/qa-web/rapporto-pagina-ruolo.py`.

## Copertura

I giri sono cinque, uno per gruppo di persone di prova, tutti in produzione, solo in lettura (ogni richiesta non di lettura è bloccata nel browser), in italiano e inglese, a 1440 e 390 px.

| giro | persone | unità visitate | unità in coda |
|---|---|---|---|
| s2 | RECRUITER, SECURITY_ADMIN, CEO, DATA_STEWARD, DPO, MANAGER | 6.539 | 0 |
| s3 | TEAM_LEADER, USER, WHISTLEBLOWING_CUSTODIAN, anonimo | 2.983 | 0 |
| s4 | PEOPLE_MANAGER, BLUEPRINT_MANAGER | 4.789 | 0 |
| s5 | PROCESS_OWNER, BRANCH_MANAGER | 3.428 | 0 |
| s6 | HRMS_MANAGER | 2.552 | 0 |

Totale: 20.291 unità visitate, 259.167 verifiche, 2.011 coppie pagina per persona (una riga ciascuna in `pagina-per-ruolo.tsv`).

## Giudizio

Le righe che chiedono un occhio sono state giudicate per gruppo (stessa pagina, controllo, nodo e dettaglio): prima per eredità dei verdetti già dati nel giro del 16/11 e nei giri chiusi di questo ciclo, poi a occhio da giudici Sonnet sulle schermate (3.100 gruppi circa). Restano 555 righe senza verdetto (APERTO): tabelle dentro pannelli chiusi («Vedi i numeri del grafico»), schermate tagliate a 6.000 px o ferme sull'animazione di caricamento. Il ciclo non può dirsi chiuso finché non hanno un verdetto: dopo il rilascio della #441 le tabelle dei grafici si montano solo all'apertura, quindi vanno rifatte nel giro di verifica.

Limite dichiarato dei giudici: in molti gruppi hanno aperto una sola volta le schermate identiche e applicato lo stesso verdetto alle righe che le condividono; le righe con verdetto «ereditato dal giro vecchio» non sono state riviste a occhio in questo giro.

## Difetti

`classi-difetti.md` raggruppa tutti i difetti per causa radice: 119.523 righe di difetto (56.875 da s2 e s3, 62.648 da s4, s5 e s6), in classi di codice, di dato, dello strumento del giro e tre escluse perché di altri thread (organigrammi, rete organizzativa, traduzione del dato). Ogni classe ha causa nel codice, correzione, rischio e stato.

## Correzioni unite su main

| PR | classi |
|---|---|
| #435 | documenti e strumenti del ciclo |
| #437 | K27 sezioni del faldone che non si aprono (limite dei parametri del percorso) |
| #436 | K29 accesso negato che nomina la pagina sbagliata, K30 mentoring |
| #438 | K18 tabelle a 390 px, K22 convenzioni di presentazione, K26 testi fissi |
| #439 | K01 faldone tradotto in inglese |
| #440 | K10 e K13 accessibilità dei diagrammi e dei titoli |
| #441 | K14, K15, K19 codici a vista e celle vuote |

Libreria condivisa `ux-design-shared` (autorizzata da Enzo il 23/11): PR #16 (K03 `main` annidato, K04 guscio a 390 px, K05 testi fissi, livello dei titoli), poi #17 e #18; la versione 1.7.1 è su `main` e aspetta la pubblicazione su npm da parte di Enzo. In advanced va poi adottata (versione, testi tradotti dell'intestazione, `main` nelle pagine senza il proprio).

## Che cosa resta

- Pubblicazione della libreria 1.7.1 e adozione in advanced (serve Enzo per il codice dell'autenticatore).
- Classi di codice ancora da correggere: K09, K12, K17, K20, K21, K25, K32, K34 e i residui di K22 (correzioni in corso in PR piccole); K06, K21 e K28 vanno prima rigiudicate sulle schermate, perché i verdetti erano ereditati e il codice di oggi li smentisce.
- Classi di dato (K08 criterio «Proposta dell'agente (0005xx)», K11, K24): servono decisioni di Enzo prima di toccare i dati.
- Rilascio delle correzioni unite (lo arma l'altro thread) e giro di verifica sulle righe corrette e sulle 555 aperte.
- Difetto dello strumento `~/.claude/tools/da-eliminare.sh`: segue i collegamenti simbolici (ha spostato il file di configurazione del repo principale, poi rimesso a posto da Enzo) e dà lo stesso nome di arrivo a due file con lo stesso nome (il secondo sovrascrive il primo).
