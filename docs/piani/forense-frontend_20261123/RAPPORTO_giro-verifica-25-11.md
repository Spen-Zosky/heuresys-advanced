# Rapporto del giro di verifica del 24 e 25 novembre 2026

Il giro di verifica ha rivisitato in produzione tutte le pagine di advanced, per ogni persona di prova, in italiano e inglese, a 1440 e 390 px, dopo i rilasci delle correzioni del ciclo del 23/11. Questo rapporto dice che cosa è stato visitato, che cosa è stato giudicato, che cosa è stato corretto e rilasciato, e che cosa resta fuori.

## Copertura

Otto giri, uno per gruppo di persone, tutti in produzione e in sola lettura (ogni richiesta che non sia di lettura è bloccata nel browser).

| giro | unità visitate | unità in coda | verifiche |
|---|---|---|---|
| s2 | 6.253 | 0 | 70.004 |
| s2b | 2.951 | 0 | 26.115 |
| s2c | 2.895 | 0 | 26.025 |
| s3 | 2.983 | 0 | 30.382 |
| s4 | 3.819 | 0 | 35.669 |
| s4b | 1.542 | 0 | 12.218 |
| s5 | 3.444 | 0 | 33.479 |
| s6 | 2.552 | 0 | 23.466 |

Totale: 26.439 unità e 257.358 verifiche, in 2.027 coppie pagina per persona (una riga ciascuna in `pagina-per-ruolo.tsv`). Esito di tutte le righe, letto dai registri: 166.674 OK, 71.900 difetto, 18.575 non applicabile, 209 bloccate, nessuna aperta e nessuna senza verdetto (`qa-web stato` esce 0 su tutti gli otto giri). Le 209 righe bloccate sono accessi che il giro non supera (secondo fattore, classe N6 nel file delle classi).

## Rilasci e prove dal vivo

- 80689227: correzioni K08, K24 e atlante (#475-#478), DEPLOYATO su due host, provate dal vivo in italiano e inglese.
- 835a3880: correzioni N1-N5 e K22 (#479) e atlante (#480), DEPLOYATO su due host (`verifica-deploy.sh`: readyz 200, login 200). Prova dal vivo su `/tenant-processes/<id>` con le schede Flusso a corsie, Fasi e Grafo: nessun testo del disegno sotto i 12 px (prima circa 7), il ruolo della corsia non è più in maiuscolo grezzo, nessun «Proposta dell'agente (nnn)», il peso non è un decimale nudo, sottotitoli con il plurale giusto.

## Ripasso dopo l'ultimo rilascio

Sono state rifatte 3.400 unità circa di `/tenant-processes/<id>` (due processi per giro) e ne sono state giudicate le righe nuove. Le righe vecchie delle stesse unità sono state tolte dai registri (copia di prima in `~/heuresys-advanced-giro/20261125-ripasso/`), perché `rifai` lascia i verdetti già dati. Sulle 1.174 unità ripassate dei giri s2, s2b, s2c e s4b i difetti delle classi corrette (K08, N1, N3, K22, N4) non compaiono più; restano il dato in italiano nelle pagine in inglese (classe di dato X3), i controlli di lingua e di codice (rumore dello strumento) e il clic sulle intestazioni di corsia della scheda Fasi (vedi limiti).

## Classi dei difetti

`classi-giro-verifica-25-11.md` raggruppa le 98.446 verifiche di difetto del giro (prima del ripasso) per causa radice. Quasi tutte sono coperte dalle classi già note: circa 54.000 sono dati fuori ciclo (organigrammi X1, rete organizzativa X2, traduzione del dato X3) e circa 19.000 sono rumore dei controlli automatici (K02). Le classi nuove sono N1-N5 (codice, corrette e rilasciate in #479) e N6 (limite dello strumento).

## Correzioni unite e rilasciate in questo giro

| PR | classi |
|---|---|
| #475, #476, #477 | K08 criterio senza numero interno, K24 colonne vuote delle attività |
| #478, #480 | atlante rigenerato |
| #479 | N1 diagrammi leggibili all'apertura, N2 faccette nella lingua della pagina, N3 ruolo della corsia, N4 nome accessibile dei diagrammi, N5 peso in percentuale, K22 plurale |

## Limiti dichiarati

- Alcune route dinamiche con segnaposto non risolto (`/content/[id]`, `/dashboard/[famiglia]`, `/engagement/[surveyId]`, `/recruiting/applications/[id]`, `/tenant-blueprints/[id]` e le sue versioni) non sono visitabili dal giro (non esiste un'istanza nei dati di prova): sono registrate «non applicabile» con la causa scritta. Copertura da completare con istanze vere (F11).
- Intestazioni di corsia della scheda Fasi: il clic automatico scade perché il centro del gruppo è coperto dalle caselle delle attività; la pagina dice che si apre con il doppio clic, quindi nei giri s2b e s6 le righe sono «non applicabile». Nei giri s2 e s2c ne restano alcune giudicate difetto da giudici diversi: sono la stessa cosa e vanno lette così (F12).
- I verdetti ereditati dal giro vecchio (3.910 su 9.992 gruppi) non sono tutti stati rivisti sulla schermata nuova. Due schermate li smentiscono (s6 u10039 per il guscio a 390 px, K04; s4 u4049 per il segnaposto, K05). K04, K05, K06, K19 e K21 vanno riverificate a parte (F13).
- Il ripasso ha campionato due processi per giro, non tutti i 45.
- Le 209 righe bloccate dall'accesso (N6) non sono state viste.

## Chiusura

CICLO CHIUSO — 19/19 voci fatte (C10 è fuori ciclo): tutte le righe dei giri hanno un verdetto, nessuna è aperta, e le classi corrette sono tornate OK nelle unità ripassate. Il resto è nel registro «fuori da questo ciclo» (F11-F13).
