# Rapporto del giro di verifica del 24 e 25 novembre 2026

Il giro di verifica ha rivisitato in produzione tutte le pagine di advanced, per ogni persona di prova, in italiano e inglese, a 1440 e 390 px, dopo i rilasci delle correzioni del ciclo del 23/11. Questo rapporto dice che cosa è stato visitato, che cosa è stato giudicato, che cosa è stato corretto e rilasciato, e che cosa resta fuori.

## Copertura

Nove giri: otto per gruppo di persone e un nono (s7) sulle pagine dei fascicoli di configurazione per tutte le persone, tutti in produzione e in sola lettura (ogni richiesta che non sia di lettura è bloccata nel browser).

| giro | unità visitate | unità in coda | verifiche |
|---|---|---|---|
| s2 | 6.253 | 0 | 70.004 |
| s2b | 2.951 | 0 | 26.115 |
| s2c | 2.895 | 0 | 26.025 |
| s3 | 2.983 | 0 | 29.677 |
| s4 | 3.819 | 0 | 35.669 |
| s4b | 1.542 | 0 | 12.237 |
| s5 | 3.444 | 0 | 33.479 |
| s6 | 2.552 | 0 | 23.562 |
| s7 (fascicoli di configurazione, 15 persone) | 265 | 0 | 3.808 |

Totale: 26.704 unità e 260.576 verifiche, in 2.069 coppie pagina per persona (una riga ciascuna in `pagina-per-ruolo.tsv`). Esito di tutte le righe, letto dai registri: 172.058 OK, 69.878 difetto, 18.640 non applicabile, nessuna bloccata, nessuna aperta e nessuna senza verdetto (`qa-web stato` esce 0 su tutti i nove giri).

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

## Riapertura del 25 novembre (pomeriggio)

Su domande di Enzo sono state riviste tre affermazioni della prima stesura, che erano sbagliate.

- Le route dinamiche «non visitabili» erano un artefatto del singolo giro: tutte le 20 route con parametro sono state raggiunte con oggetti veri da almeno un giro. Solo il dettaglio dei fascicoli di configurazione (con costruzione e confronto) era visto da una sola persona: il giro s7 lo ha visitato per tutte le 15 persone di prova (180 viste di partenza, tutte HTTP 200). L'esplorazione degli stati ulteriori di s7 è stata fermata.
- Le 209 righe «bloccate dal secondo fattore» non c'entravano con il secondo fattore: erano 203 clic scaduti a 5 secondi e 6 accessi rifiutati al secondo passo. Rifatte, non ne resta nessuna. Il giro supera il secondo fattore da sé con il fattore «derived-access» di ogni persona di prova.
- I verdetti ereditati dal giro vecchio stavano nei giri s3 e s6: quelli di impaginazione, tabelle e grafici (K04, K05, K06, K19, K21) sono stati azzerati e rigiudicati sulle schermate nuove. Il difetto del pulsante «Sign out» a barra espansa, segnalato da alcuni giudici, è smentito dalla misura dal vivo (58 px di testo in un riquadro di 235 px). K05 si giudica con la regola attuale: ogni pagina nella lingua scelta.

Dal rigiudizio sono usciti difetti veri, corretti e rilasciati: #482 (tabelle che uscivano dallo schermo a 390 px, scale e assi dei grafici, colonna «Sottoprocesso») e #487 (fascicolo non disponibile con titolo e ritorno, testi scritti per chi sviluppa, grafici, scheda persona). Rilasci: 87d7ce9d e dd9a30d5, DEPLOYATI su due host e provati dal vivo (per #487: 8 pagine in italiano e inglese a 1440 e 390 px con HRMS_MANAGER, 32 viste senza contenuto fuori schermo né testi tecnici; la frase nuova del fascicolo non disponibile è stata vista con BLUEPRINT_MANAGER in italiano a 1440 px, gli altri accessi di quella persona nella prova sono stati rifiutati al secondo passo e non contano). Dopo #487 le pagine corrette non sono state rigiudicate riga per riga nei registri: vale la prova dal vivo.

## Limiti dichiarati

- I giri s2-s7 sono anteriori a #487: le righe di difetto delle pagine corrette restano nei registri come erano.
- Il ripasso dopo #479 e #482 ha campionato una parte delle unità (due processi per giro; un esemplare per pagina in s6).
- Restano fuori ciclo: barra laterale compressa (F8), traduzione del dato (X3), organigrammi e rete organizzativa (X1, X2), K11, F14 e F15.

## Chiusura

CICLO CHIUSO — 19/19 voci fatte (C10 è fuori ciclo): tutte le righe dei nove giri hanno un verdetto, nessuna è aperta o bloccata, le correzioni sono in produzione. Il resto è nel registro «fuori da questo ciclo».
