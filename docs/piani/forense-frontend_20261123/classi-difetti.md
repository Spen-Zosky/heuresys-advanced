# Classi dei difetti del controllo forense dell'interfaccia web (giri s2, s3, s4, s5 e s6, 23/11/2026)

Fonte: /home/ubuntu/heuresys-advanced-giro/20261123-giudizio/difetti-s2-s3.tsv, 2.656 chiavi e 56.875 righe (somma della colonna righe). Il file ha una chiave che va a capo dentro il campo (R-CONSOLE, «Loading chunk N failed»): è stata ricomposta, quindi le chiavi lette sono 2.656 e la somma delle righe coincide con il totale dichiarato. Dettagli dei nodi letti in sola lettura dai registri 20261123-forense-s2/registro.sqlite e 20261123-forense-s3/registro.sqlite (apertura immutable, nessuna scrittura). Codice letto in /home/ubuntu/heuresys-advanced-forense (commit 6efdd8a6 del 23/11/2026) e, per @heuresys/ui, in /home/ubuntu/ux-design-shared (commit f9a3c2a, versione 1.6.0, la stessa che apps/web/package.json chiede con ^1.6.0).

Giri s4, s5 e s6 (aggiornamento del 23/11/2026, sera). Fonte: /home/ubuntu/heuresys-advanced-giro/20261123-giudizio/difetti-s4-s6.tsv, stesse colonne, 3.002 chiavi e 62.648 righe (somma della colonna righe, letto con il modulo csv di Python: nessuna riga spezzata). Dettagli letti in sola lettura dai registri 20261123-forense-s4, -s5 e -s6 (registro.sqlite, apertura immutable): stati HTTP delle chiamate in errore e dettaglio dell'errore React. Codice letto in /home/ubuntu/heuresys-advanced-forense così com'è oggi (contiene già le PR #435-#441) e in /home/ubuntu/ux-design-shared (versione 1.7.0). In tutto le due fonti fanno 5.658 chiavi e 119.523 righe; ogni classe porta i due numeri distinti.

Metodo. Ogni chiave del file appartiene a una sola classe. Le chiavi automatiche (T-LINGUA, T-CODICE, T-TRONCATO e simili) sono state assegnate cercando il testo segnalato nei file locales/it e locales/en e fra le stringhe letterali di apps/web/src, apps/api/src, packages/shared/src e ux-design-shared/ui/src: se il testo è un valore della lingua giusta il rilievo è un falso positivo, se è una stringa fissa del codice la classe è quella del file, se non è nel codice è dato. Le chiavi giudicate (G-RENDER, G-TABELLA, E-ESERCIZIO) sono state assegnate dalla prima causa scritta dal giudice; quando una chiave porta più cause separate da «|», conta la prima e le altre sono citate nel testo della classe. Le schermate aperte per controllare le cause comuni sono u9808, u2283, u10259, u1451 e u1466 del giro s2. Lo script di assegnazione è deterministico e ha lasciato zero chiavi fuori classe. Per s4-s6 lo stesso criterio è stato riscritto in uno script nuovo (lo script di s2-s3 non è stato conservato): T-LINGUA cerca il testo nei valori dei locales (it ed en), nei sorgenti di apps/web, apps/api e packages e in ux-design-shared/ui/src, contando un sorgente solo quando il testo vi compare come stringa letterale intera (fra apici, apici inversi o tag), con N al posto delle cifre; i testi del faldone che oggi stanno in locales/it/ess.json (chiavi ess.faldone.*, portate lì da #439) vanno in K01; le chiavi giudicate vanno alla classe della prima causa, con alcune priorità scritte (per esempio «Nome Cognome» prima di «NAVIGATION»). Le classi nuove K31-K34 nascono da cause che in s2-s3 non c'erano.

Stato di una classe. «corretta in main» dice che la causa descritta è corretta nel codice unito; non dice che la correzione è già in produzione: i giri s4 e s5 sono finiti alle 21:28 e s6 alle 23:23, mentre le PR sono state unite fra le 19:27 e le 21:23, e il rilascio non è stato verificato qui. Le righe di s4-s6 in una classe corretta vanno quindi rilette dopo il rilascio, non contate come regressioni.

Avvertenza sui verdetti ereditati. Molte cause portano «[ereditato dal giro vecchio]» o «[FN]»: sono giudizi copiati da un giro precedente, non visti in questo. Per classe si dà quante righe sono ereditate; in tre classi (K06 accesso negato con percorso a vista, K21 barra laterale a 1440 px, K28 errori con UUID) il codice di oggi o le schermate di questo giro li smentiscono, e la classe lo dice.

Pagine: il file dà per ogni chiave solo le prime cinque pagine (colonna pagine_top), quindi il numero di pagine di una classe è l'unione di quelle elencate ed è un minimo. Persone: il massimo della colonna persone fra le chiavi della classe (il file non dà l'unione).

## Indice delle classi

| id | classe | natura | righe s2-s3 | righe s4-s6 | righe totali | chiavi s2-s3 | chiavi s4-s6 | stato | ordine |
|---|---|---|---|---|---|---|---|---|---|
| K01 | Faldone non tradotto in inglese | codice | 9.375 | 6.719 | 16.094 | 161 | 108 | corretta in main (#439) | 2 |
| K02 | Falsi positivi dei controlli automatici | strumento del giro | 6.510 | 7.489 | 13.999 | 148 | 108 | strumento del giro | 26 |
| K03 | Landmark annidati e main mancante | codice | 2.508 | 2.926 | 5.434 | 4 | 4 | corretta nella libreria 1.7.0 (da adottare) | 5 |
| K04 | Guscio più largo di 390 px: tutta la pagina esce a destra (faldone, processi, accesso negato e altre) | codice | 2.409 | 3.252 | 5.661 | 134 | 59 | corretta nella libreria 1.7.0 (da adottare) | 1 |
| K05 | Testi italiani fissi di @heuresys/ui (segnaposto della ricerca globale, tavolozza, tabella) | codice | 1.612 | 2.255 | 3.867 | 30 | 27 | corretta nella libreria 1.7.0 (da adottare) | 3 |
| K06 | Accesso negato con il percorso tecnico a vista: verdetto non confermato | codice (verdetto da riverificare) | 1.549 | 860 | 2.409 | 28 | 27 | da correggere | 6 |
| K07 | Pagine showcase spente in produzione | strumento del giro (comportamento voluto) | 1.451 | 725 | 2.176 | 20 | 19 | strumento del giro | 27 |
| K08 | «Proposta dell'agente (000511)» nella colonna Criterio della classificazione dei processi | dato (scritto da migrazioni) | 1.132 | 4.524 | 5.656 | 33 | 55 | dato | 8 |
| K09 | Avviso «Hai N giorni di ferie e permessi da godere» su pagine che non c'entrano, con numeri giudicati implausibili | codice e dato | 826 | 436 | 1.262 | 36 | 32 | da correggere | 11 |
| K10 | Elementi dei diagrammi di processo cliccabili senza nome | codice | 637 | 2.536 | 3.173 | 1 | 1 | corretta in main (#440) | 9 |
| K11 | Incoerenze del dato del tenant RTL | dato | 579 | 582 | 1.161 | 60 | 71 | dato | 30 |
| K12 | Testo a 10-11 px nella matrice processi per unità | codice | 526 | 3.294 | 3.820 | 7 | 7 | da correggere | 14 |
| K13 | Accessibilità puntuale: ordine dei titoli e regole singole | codice | 517 | 495 | 1.012 | 8 | 6 | corretta in main (#440) | 15 |
| K14 | Matrice dei ruoli: codici di permesso e di ruolo a vista | codice | 404 | 417 | 821 | 212 | 220 | corretta in main (#441) | 10 |
| K15 | Celle vuote senza segno nelle tabelle | codice | 392 | 838 | 1.230 | 1 | 1 | corretta in main (#441) | 13 |
| K16 | Errori di rete del giro: sessione scaduta, troppe richieste, riavvio | strumento del giro e infrastruttura | 340 | 501 | 841 | 180 | 200 | strumento del giro | 28 |
| K17 | Grafici: suggerimento al passaggio del mouse, etichette troncate, assi | codice (in parte da riverificare) | 333 | 586 | 919 | 11 | 18 | da correggere | 16 |
| K18 | Tabelle che non si ripiegano a 390 px | codice | 288 | 1.241 | 1.529 | 46 | 150 | corretta in main (#438) | 12 |
| K19 | Codici tecnici a vista in campi e titoli | codice | 224 | 207 | 431 | 20 | 28 | corretta in main (#441) | 17 |
| K20 | Rilievi singoli di impaginazione e contenuto di pagina (coda di codice) | codice | 210 | 113 | 323 | 20 | 13 | da correggere | 20 |
| K21 | Barra laterale a 1440 px: etichette a capo lettera per lettera, «NAVIGATION», email spezzata | codice (in gran parte verdetti ereditati) | 209 | 123 | 332 | 22 | 12 | da correggere | 21 |
| K22 | Convenzioni di presentazione: «Cognome, Nome», formato delle date, plurali, chiavi i18n a vista | codice | 189 | 277 | 466 | 44 | 58 | corretta in main (#438) | 19 |
| K23 | Esercizio dei comandi non visto: clic scaduti o senza effetto, da riverificare | strumento del giro (da riverificare) | 143 | 347 | 490 | 14 | 5 | strumento del giro | 24 |
| K24 | Attività dei processi senza ingresso, uscita, esecutore e ore | dato | 132 | 570 | 702 | 5 | 5 | dato | 29 |
| K25 | Pagine lente (oltre i secondi attesi) | codice (prestazioni API e pagina) | 86 | 166 | 252 | 5 | 10 | da correggere | 22 |
| K26 | Altri testi italiani fissi nel codice fuori dal faldone | codice | 79 | 315 | 394 | 26 | 32 | corretta in main (#438) | 18 |
| K27 | Faldone: sezioni collegate che non si aprono (URI troppo lungo, 414) | codice | 37 | 20 | 57 | 25 | 15 | corretta in main (#437) | 4 |
| K28 | Pagine di errore con codice NOT_FOUND e UUID a vista: verdetti ereditati | codice (verdetto da riverificare) | 23 | 16 | 39 | 12 | 5 | da correggere | 25 |
| K29 | Accesso negato che nomina la pagina sbagliata | codice | 18 | 0 | 18 | 11 | 0 | corretta in main (#436) | 7 |
| K30 | Chiamate API che falliscono sempre: mentorship e cronologia degli obiettivi | codice | 11 | 17 | 28 | 5 | 16 | corretta in main (#436) | 23 |
| K31 | Errori 500 dell'API: storia della persona e ricerca nel catalogo dei ruoli | codice | 0 | 3 | 3 | 0 | 2 | da correggere | 31 |
| K32 | Versione del blueprint (confronto e costruzione): codici, identificativi ESCO e messaggi italiani dall'API | codice | 0 | 25 | 25 | 0 | 15 | da correggere | 32 |
| K33 | Errore React #418 (idratazione) al cambio di lingua | codice (da riprodurre) | 0 | 5 | 5 | 0 | 1 | da correggere | 33 |
| K34 | Mappa dei dati personali (GDPR): nomi delle tabelle del database a vista | codice | 0 | 95 | 95 | 0 | 89 | da correggere | 34 |
| X1 | escluso: Organigrammi (/organization/org-chart, /me/org-chart, organigramma completo), comprese le righe T-CORPO del riquadro SVG | altro thread | 17.532 | 7.914 | 25.446 | 41 | 44 | escluso: altro thread | — |
| X2 | escluso: /analytics/org-network | altro thread | 26 | 104 | 130 | 16 | 16 | escluso: altro thread | — |
| X3 | escluso: Traduzione del dato: contenuti del tenant scritti in una sola lingua (nomi di unità, posizioni, processi, corsi, sondaggi, titoli delle richieste) mostrati nella pagina dell'altra lingua | altro thread | 6.568 | 12.655 | 19.223 | 1.270 | 1.523 | escluso: altro thread | — |
| totale | | | 56.875 | 62.648 | 119.523 | 2.656 | 3.002 | | |

Riepilogo per natura, giri s2-s3: classi di codice 23 (22.462 righe, 869 chiavi); classi di dato 3 (1.843 righe, 98 chiavi: K08, K11, K24); classi dello strumento del giro 4 (8.444 righe, 362 chiavi: K02, K07, K16, K23); escluse perché di altri thread 3 (24.126 righe, 1.327 chiavi). Classi incluse in tutto: 30, con 32.749 righe e 1.329 chiavi; con le escluse si arriva a 56.875 righe su 56.875. Giri s4-s6: classi di codice 27 (comprese le nuove K31-K34) con 27.237 righe e 956 chiavi; classi di dato con 5.676 righe e 131 chiavi; classi dello strumento del giro con 9.062 righe e 332 chiavi; escluse con 20.673 righe e 1.583 chiavi; in tutto 62.648 righe su 62.648 e 3.002 chiavi su 3.002.

Ordine di correzione proposto: prima le cause comuni che spostano più righe con un solo cambiamento (guscio a 390 px, faldone tradotto, testi fissi della libreria), poi i difetti funzionali (sezioni del faldone che non si aprono, accesso negato che nomina la pagina sbagliata), poi accessibilità e coda; le classi da riverificare e quelle dello strumento non chiedono codice.

## Classi

### K01 — Faldone non tradotto in inglese

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 9.375 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 161 |
| righe s4-s6 | 6.719 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 108 |
| stato | corretta in main (#439) |
| controlli s2-s3 | T-LINGUA 8.974, G-RENDER 401 |
| pagine s2-s3 | 2: /me/faldone, /users/<id>/faldone |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en |
| formati s2-s3 | 1440x900 |
| più parti del codice | sì: apps/web (componente) e apps/api (titoli, capitoli e motivi delle sezioni) |
| rischio | basso sul dato, medio sul lavoro: le chiavi API cambiano forma e vanno allineate test e contratti in packages/shared (FaldoneIndice). |
| ordine | 2 |

Causa radice. Il componente scrive in italiano fisso tutte le sue etichette senza passare da i18n: apps/web/src/components/faldone-vista.tsx righe 35-49 (CLASSI e VISIBILITA), 145 («Dati della persona» / «La persona vi compare»), 154 («Motivo: …»), 167 («Mostra le righe» / «Mostra la struttura delle righe»), 214-216 (titolo «Faldone di …» e descrizione), 230-245 (Righe, Sezioni con dati, Voci di catalogo, Sezioni con campi non visibili, Generato il, Solo le sezioni con dati, Aggiorna), 101 e 185 (testi di caricamento). Le intestazioni di colonna vengono da apps/web/src/lib/faldone-parole.ts riga 212 (funzione intestazione, dizionario PAROLE solo italiano). I titoli e i capitoli delle sezioni arrivano dall'API già in italiano: apps/api/src/modules/faldone/classi.ts (per esempio riga 73, «Anagrafica» / «Dati anagrafici e demografici»); i motivi dell'omissis sono frasi italiane in apps/api/src/modules/faldone/service.ts righe 130 e 158 (e le altre chiamate a chiudi(...)). Il ruolo «Data Protection Officer» che compare fra i testi del faldone è invece un falso positivo ed è in K02.

Correzione proposta. Portare le etichette del componente nei file locales/it e locales/en (spazio hr o ess) con useTranslation; far restituire all'API chiavi stabili (codice di capitolo, di sezione e di motivo) e tradurle nel client, oppure far scegliere all'API la lingua dalla preferenza dell'utente come già fa apps/api/src/modules/quadro/lenti.ts con L.t(it, en); dare a faldone-parole.ts un dizionario inglese.

Esempi dal file (righe, controllo, causa, primo esempio): 1.755 T-LINGUA «testo in italiano in pagina inglese: «Dati della persona»» (s2:75455:schermate/u8458.png) ; 1.412 T-LINGUA «testo in italiano in pagina inglese: «Mostra le righe»» (s2:75457:schermate/u8458.png) ; 819 T-LINGUA «testo in italiano in pagina inglese: «Visibile in parte»» (s2:75460:schermate/u8458.png).

Giri s4-s6: 6.719 righe e 108 chiavi (ereditate dal giro vecchio 0); controlli T-LINGUA 6.353, G-RENDER 366; pagine 4: /engagement/<id>, /investors, /me/faldone, /users/<id>/faldone; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 1.301 T-LINGUA «testo in italiano in pagina inglese: «Dati della persona»» (s4:74015:schermate/u8358.png) ; 1.016 T-LINGUA «testo in italiano in pagina inglese: «Mostra le righe»» (s4:74017:schermate/u8358.png) ; 645 T-LINGUA «testo in italiano in pagina inglese: «Visibile per intero»» (s4:74016:schermate/u8358.png).

Nota s4-s6. I testi segnalati («Dati della persona», «Mostra le righe», «Visibile per intero», i motivi «Motivo: …») oggi stanno in locales/it/ess.json sotto ess.faldone.* con la loro traduzione inglese: è la correzione di #439, non ancora vista dal vivo in questi giri.

### K02 — Falsi positivi dei controlli automatici

| voce | valore |
|---|---|
| natura | strumento del giro |
| righe s2-s3 | 6.510 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 148 |
| righe s4-s6 | 7.489 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 108 |
| stato | strumento del giro |
| controlli s2-s3 | T-CODICE 2.579, T-TRONCATO 1.891, T-LINGUA 1.810, T-NUMERO-IT 191, T-DECIMALE 27, T-TECNICO 12 |
| pagine s2-s3 | 73: /accessibilita, /admin/agent-capabilities, /admin/catalogo-kpi, /admin/mfa-policy, /admin/roles, /analytics/attendance, /analytics/kpi, /analytics/skills-group-share, /analytics/workforce, /approvals, /approvals/<id>, /blueprints/<id>, /compensation-intelligence, /content/<id>, /dashboard/branch e altre 58 |
| persone s2-s3 | fino a 10 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | nullo. |
| ordine | 26 |

Causa radice. Testi giusti letti come sbagliati. T-CODICE (2.579 righe): sigle del glossario e del dominio (INPS, IRPEF, GDPR, INAIL, IFRS, CAMS, WCAG, TOTP, SWIFT, codici BIC), parole rese maiuscole dal CSS (data-table-panel.tsx riga 234, intestazioni uppercase: «ESECUTRICE», «CONTRIBUTES») e codici dentro campi dichiaratamente di codice (codice posizione, unità). T-TRONCATO (1.891 righe): testo nascosto ai vedenti con sr-only, cioè le caption delle tabelle (ux-design-shared/ui/src/components/dashboard/DataTableWithCrossHair.tsx riga 48, _charts-client.tsx riga 194), l'intestazione «Azioni» (data-table-panel.tsx riga 238) e «pagina iniziale» (DashboardHeader.tsx riga 156). T-LINGUA (1.810 righe): testo già nella lingua della pagina, tolto dai file locales (per esempio «Data Protection Officer», «Zoom in», «Data origin», «Sicurezza dell'account», «Direzione Back Office»). T-NUMERO-IT su /me/security (un indirizzo IP letto come numero), T-DECIMALE (versioni WCAG 2.1, codici ATECO 64.19, «NACE Rev. 2.1»), T-TECNICO («banconote false» letto come booleano).

Correzione proposta. Nel giro: escludere gli elementi sr-only da T-TRONCATO, leggere il testo prima di text-transform per T-CODICE, una lista di sigle ammesse, confrontare T-LINGUA con i valori dei locales della lingua giusta, escludere IP e numeri di versione. Nessuna correzione nell'applicazione.

Esempi dal file (righe, controllo, causa, primo esempio): 1.891 T-TRONCATO «testo troncato senza modo di leggerlo intero» (s2:14239:schermate/u1442.png) ; 702 T-CODICE «parola in maiuscolo grezzo, probabile codice: INPS» (s2:69524:schermate/u7685.png) ; 702 T-CODICE «parola in maiuscolo grezzo, probabile codice: IRPEF» (s2:69525:schermate/u7685.png).

Giri s4-s6: 7.489 righe e 108 chiavi (ereditate dal giro vecchio 0); controlli T-CODICE 3.105, T-TRONCATO 2.163, T-LINGUA 2.060, T-NUMERO-IT 102, T-DECIMALE 47, T-TECNICO 12; pagine 71: /accessibilita, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /admin/mfa-policy, /admin/tassonomie, /analytics/attendance, /analytics/kpi, /analytics/overtime, /analytics/skills-group-share, /analytics/workforce, /approvals/<id>, /blueprints/<id>, /consolidation, /content/<id> e altre 56; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 2.163 T-TRONCATO «testo troncato senza modo di leggerlo intero» (s4:1402:schermate/u482.png) ; 662 T-CODICE «parola in maiuscolo grezzo, probabile codice: VRIO» (s4:3428:schermate/u552.png) ; 580 T-LINGUA «testo in inglese in pagina italiana: «Sicurezza dell'account»» (s4:1400:schermate/u482.png).

Nota s4-s6. Nuovi falsi positivi della stessa natura: sigle VRIO, RACI, APQC, COREP, NSFR, HQLA, TOTP, JPEG; intestazioni rese maiuscole dal CSS (ESECUTRICE, CONTRIBUTES, RESPONSABILE, CONSULTATA, INFORMATA); testi già nella lingua giusta («Sicurezza dell'account», «Zoom in», «Data origin : mixed», «Hours per cycle», «Base data», «Initial data acquisition»).

### K03 — Landmark annidati e main mancante

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 2.508 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 4 |
| righe s4-s6 | 2.926 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 4 |
| stato | corretta nella libreria 1.7.0 (da adottare) |
| controlli s2-s3 | A-landmark-main-is-top-level 1.601, A-landmark-one-main 422, A-landmark-banner-is-top-level 421, A-landmark-unique 64 |
| pagine s2-s3 | 15: /blueprints/<id>, /dashboard/branch, /dashboard/company, /goals, /me, /me/career, /me/faldone, /me/matching, /me/profile, /me/surveys/<id>, /positions/<id>, /tenant-processes/<id>, /tenants/<id>, /users/<id>, /users/<id>/faldone |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | it |
| formati s2-s3 | 1440x900 |
| più parti del codice | sì: @heuresys/ui (DashboardShell) e apps/web (layout, pagine, PageHeader) |
| rischio | basso sul comportamento, medio sul numero di file toccati; le prove axe esistenti vanno rilanciate. |
| ordine | 5 |

Causa radice. ux-design-shared/ui/src/components/dashboard/DashboardShell.tsx righe 61-66 avvolge il contenuto in un div con role="region" e aria-label: è un landmark, quindi il main di ogni pagina ci sta dentro (A-landmark-main-is-top-level, 1.601 righe) e due region con la stessa etichetta violano A-landmark-unique. Le pagine senza main proprio (per esempio il faldone, faldone-vista.tsx riga 212, che usa un div) producono A-landmark-one-main; in quelle pagine l'header di PageHeader (apps/web/src/components/intestazione-pagina.tsx riga 28) non sta dentro un main e diventa un banner annidato nella region (A-landmark-banner-is-top-level). Anche la pagina di accesso negato apre un main dentro la region (apps/web/src/app/(authenticated)/layout.tsx riga 508).

Correzione proposta. Una sola regola per tutte le pagine: il guscio dà il main (oppure toglie role=region e lascia il div solo focalizzabile) e le pagine non ne aprono un secondo; PageHeader resta header dentro il main. In alternativa, il guscio toglie il ruolo region e ogni pagina garantisce un main; va scelto uno dei due e applicato ovunque (circa 100 file di apps/web contengono <main>, misurato con grep -rln '<main' apps/web/src/app).

Esempi dal file (righe, controllo, causa, primo esempio): 1.601 A-landmark-main-is-top-level «Main landmark should not be contained in another landmark (moderate, N elementi)» (s2:14243:schermate/u1442.png) ; 422 A-landmark-one-main «Document should have one main landmark (moderate, N elementi)» (s2:22770:schermate/u1953.png) ; 421 A-landmark-banner-is-top-level «Banner landmark should not be contained in another landmark (moderate, N elementi)» (s2:67923:schermate/u7557.png).

Giri s4-s6: 2.926 righe e 4 chiavi (ereditate dal giro vecchio 0); controlli A-landmark-main-is-top-level 2.252, A-landmark-banner-is-top-level 307, A-landmark-one-main 307, A-landmark-unique 60; pagine 15: /blueprints/<id>, /dashboard/branch, /dashboard/process, /dashboard/tenant, /me, /me/career, /me/faldone, /me/matching, /me/profile, /positions/<id>, /talent-review, /tenant-processes/<id>, /tenants/<id>, /users/<id>, /users/<id>/faldone; persone fino a 5; lingue it; formati 1440x900. Esempi: 2.252 A-landmark-main-is-top-level «Main landmark should not be contained in another landmark (moderate, N elementi)» (s4:1406:schermate/u482.png) ; 307 A-landmark-banner-is-top-level «Banner landmark should not be contained in another landmark (moderate, N elementi)» (s4:73953:schermate/u8357.png) ; 307 A-landmark-one-main «Document should have one main landmark (moderate, N elementi)» (s4:73954:schermate/u8357.png).

### K04 — Guscio più largo di 390 px: tutta la pagina esce a destra (faldone, processi, accesso negato e altre)

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 2.409 (di cui ereditate dal giro vecchio 739) |
| chiavi s2-s3 | 134 |
| righe s4-s6 | 3.252 (di cui ereditate dal giro vecchio 784) |
| chiavi s4-s6 | 59 |
| stato | corretta nella libreria 1.7.0 (da adottare) |
| controlli s2-s3 | G-RENDER 2.315, G-TABELLA 76, T-FUORI 18 |
| pagine s2-s3 | 57: /admin/agent-capabilities, /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /admin/roles, /admin/tassonomie, /analytics/workforce, /approvals, /approvals/<id>, /assessments, /blueprints/<id>, /compensation-intelligence, /dashboard/company, /engagement e altre 42 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: @heuresys/ui (repo ux-design-shared) e apps/web/src/app/(authenticated)/layout.tsx |
| rischio | medio: tocca il guscio di tutte le pagine; serve una prova a 390 e a 1440 su tutte le pagine dopo l'aggiornamento della libreria. |
| ordine | 1 |

Causa radice. La causa è comune e non sta nelle pagine: a 390 px la barra in alto non si restringe, e la griglia del guscio prende la larghezza della barra. In ux-design-shared/ui/src/components/dashboard/DashboardHeader.tsx riga 164 il gruppo di destra (lingua, PaletteDropdown, tema, carta utente, rightExtras) è un flex senza min-w-0 e senza elementi nascosti sotto sm; in ux-design-shared/ui/src/components/dashboard/DashboardShell.tsx righe 42-46 la griglia esterna dichiara solo le righe (grid-rows-[64px_1fr_44px]) e non le colonne, quindi la sua unica colonna è larga quanto il contenuto minimo della barra. Le schermate lo mostrano: u9808 (faldone), u10259 (scheda processo), u2283 (accesso negato) tagliano tutte allo stesso bordo, insieme alla barra. Il caso del faldone, che il compito nominava come contenitore del faldone, è questa stessa causa: faldone-vista.tsx non ha larghezze fisse. Le righe «guscio non adattivo: barra laterale a tutto schermo» (739 righe, ereditate dal giro vecchio) descrivono un sintomo che le schermate di questo giro non mostrano più (a 390 c'è il menu a cassetto), ma il taglio a destra resta. T-FUORI su /login (iniziali delle persone di prova nella barra) va verificato a parte: la pagina di accesso usa un'altra intestazione.

Correzione proposta. In @heuresys/ui: aggiungere grid-cols-[minmax(0,1fr)] alla griglia esterna di DashboardShell, min-w-0 e shrink al gruppo di destra di DashboardHeader, e nascondere sotto sm la PaletteDropdown e la carta utente (spostandole nel cassetto). Pubblicare una versione nuova di @heuresys/ui e aggiornarla in apps/web/package.json (oggi ^1.6.0).

Esempi dal file (righe, controllo, causa, primo esempio): 444 G-RENDER «Su N px la pagina esce dalla larghezza: intestazione, percorso, titolo, schede e contenuto sono tagliati a destra senza adattarsi (nodo: pagina intera).» (s2:99617:schermate/u10259.png) ; 118 G-RENDER «Pagina a N px: il contenuto della scheda della persona (faldone) esce dalla larghezza dello schermo e viene tagliato a destra (titolo "Faldone di ..." troncat» (s3:30020:schermate/u7955.png) ; 112 G-RENDER «guscio non adattivo (@heuresys/ui): barra laterale a tutto schermo su mobile al posto del cassetto [ereditato dal giro vecchio]» (s2:68000:schermate/u7560.png).

Giri s4-s6: 3.252 righe e 59 chiavi (ereditate dal giro vecchio 784); controlli G-RENDER 3.242, T-FUORI 10; pagine 44: /admin/agent-capabilities, /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /approvals/<id>, /blueprints/<id>, /compensation-intelligence, /consolidation, /content/<id>, /dashboard/org, /dashboard/tenant, /engagement/<id>, /kpis, /learning e altre 29; persone fino a 5; lingue en, it; formati 390x844. Esempi: 1.776 G-RENDER «Su N px la pagina esce dalla larghezza: intestazione, percorso, titolo, schede e contenuto sono tagliati a destra senza adattarsi (nodo: pagina intera» (s4:104543:schermate/u10331.png) ; 180 G-RENDER «a N px il contenuto esce dalla larghezza: titolo, schede e testi sono tagliati a destra e serve lo scorrimento orizzontale [ereditato dal giro vecchio» (s4:84150:schermate/u8963.png) ; 108 G-RENDER «A NxN il contenuto è più largo dello schermo: titolo e testo tagliati sul bordo destro e i comandi dell'header (tema, utente) fuori vista, con scorrim» (s4:5977:schermate/u723.png).

Nota s4-s6. Comprende 784 righe ereditate «guscio non adattivo» e i giudizi nuovi «Su N px la pagina esce dalla larghezza» sulla scheda processo (1.776 righe su una chiave sola).

### K05 — Testi italiani fissi di @heuresys/ui (segnaposto della ricerca globale, tavolozza, tabella)

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 1.612 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 30 |
| righe s4-s6 | 2.255 (di cui ereditate dal giro vecchio 808) |
| chiavi s4-s6 | 27 |
| stato | corretta nella libreria 1.7.0 (da adottare) |
| controlli s2-s3 | T-LINGUA 1.190, G-RENDER 422 |
| pagine s2-s3 | 26: /admin/agent-capabilities, /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /admin/roles, /admin/tassonomie, /analytics/skills-group-share, /approvals/<id>, /assessments, /login, /me/analytics, /me/faldone, /me/handbook/<id>, /me/surveys/<id> e altre 11 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: @heuresys/ui e apps/web/src/app/(authenticated)/layout.tsx |
| rischio | basso. |
| ordine | 3 |

Causa radice. DashboardHeader passa il segnaposto solo alla CommandPalette e non al pulsante della ricerca: ux-design-shared/ui/src/components/dashboard/DashboardHeader.tsx riga 165 chiama HeaderSearchTrigger senza placeholder, e il pulsante usa il suo valore fisso «Cerca tenant, log, audit…» (ux-design-shared/ui/src/components/dashboard/header/search-trigger.tsx riga 13); il layout passa la traduzione (shell:ui.paletteSearch, layout.tsx riga 436) solo a commandPalettePlaceholder. Altri testi fissi della libreria: aria-label «Cambia palette accent (apri menu)» in ux-design-shared/ui/src/components/dashboard/PaletteDropdown.tsx riga 83 (1.106 righe da sola), «Data table» in DataTableWithCrossHair.tsx riga 44, «Aggiorna» in PageActions.tsx riga 70, «pagina iniziale» in DashboardHeader.tsx riga 117 (il layout non passa homeLabel), «Notifications · read own data» in notification-center.tsx.

Correzione proposta. In @heuresys/ui: aggiungere a labels un searchPlaceholder e passarlo a HeaderSearchTrigger, aggiungere un'etichetta a PaletteDropdown e rendere obbligatorie (o almeno passate dal layout) le etichette di DataTableWithCrossHair e PageActions; nel layout passare homeLabel e le nuove etichette da shell.json.

Esempi dal file (righe, controllo, causa, primo esempio): 1.106 T-LINGUA «testo in italiano in pagina inglese: «Cambia palette accent (apri menu)»» (s2:17871:schermate/u1562.png) ; 156 G-RENDER «Nella pagina in inglese il segnaposto della ricerca in alto resta in italiano ('Cerca tenant, log, audit...').» (s2:99610:schermate/u10258.png) ; 65 T-LINGUA «testo in italiano in pagina inglese: «Data table»» (s2:18185:schermate/u1579.png).

Giri s4-s6: 2.255 righe e 27 chiavi (ereditate dal giro vecchio 808); controlli G-RENDER 1.327, T-LINGUA 928; pagine 20: /admin/agent-capabilities, /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /analytics/skills-group-share, /approvals/<id>, /blueprints/<id>, /login, /me/analytics, /me/faldone, /me/handbook/<id>, /me/surveys/<id>, /mentorship, /positions/<id> e altre 5; persone fino a 5; lingue en; formati 1440x900, 390x844. Esempi: 864 T-LINGUA «testo in italiano in pagina inglese: «Cambia palette accent (apri menu)»» (s4:4383:schermate/u602.png) ; 624 G-RENDER «Nella pagina in inglese il segnaposto della ricerca in alto resta in italiano ('Cerca tenant, log, audit...'). [ereditato dal giro vecchio]» (s4:104536:schermate/u10330.png) ; 180 G-RENDER «il campo di ricerca nell'intestazione ha il segnaposto in italiano «Cerca tenant, log, audit...» in una pagina in inglese [ereditato dal giro vecchio]» (s4:84132:schermate/u8962.png).

Nota s4-s6. «Cambia palette accent (apri menu)» (864 righe) e il segnaposto «Cerca tenant, log, audit…» (624 righe ereditate più i giudizi nuovi) sono le stesse due cause; la stringa della tavolozza resta in ux-design-shared/ui/src/components/dashboard/PaletteDropdown.tsx come valore di riserva, quindi va controllato che advanced passi l'etichetta quando adotta la 1.7.0.

### K06 — Accesso negato con il percorso tecnico a vista: verdetto non confermato

| voce | valore |
|---|---|
| natura | codice (verdetto da riverificare) |
| righe s2-s3 | 1.549 (di cui ereditate dal giro vecchio 1) |
| chiavi s2-s3 | 28 |
| righe s4-s6 | 860 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 27 |
| stato | da correggere |
| controlli s2-s3 | G-RENDER 1.549 |
| pagine s2-s3 | 35: /admin/mfa-policy, /admin/roles, /analytics/attendance, /analytics/compensation, /analytics/kpi, /analytics/org-network, /analytics/overtime, /analytics/skills, /analytics/skills-by-category, /analytics/skills-graph, /analytics/skills-group-share, /analytics/workforce, /career-succession, /compensation-intelligence, /consolidation e altre 20 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | nullo sul codice; il rischio è di correggere qualcosa che non è rotto. |
| ordine | 6 |

Causa radice. Il codice attuale nomina la pagina negata con la voce di menu e non col percorso: apps/web/src/app/(authenticated)/layout.tsx righe 369-374 (commento «mai col percorso tecnico») e il testo shell:noAccess.body. Le schermate di esempio aperte per questa classe lo smentiscono: u1466 (/consolidation) mostra «La pagina «Consolidamento» non fa parte del tuo profilo», u1451 (/analytics/attendance) mostra la pagina con i dati. Le cause scritte dal giudice dicono «schermata solo EN/mobile dedotta dalla IT» o portano il segno [FN]: sono verdetti dedotti o riportati, non visti.

Correzione proposta. Nessuna correzione di codice: rigiudicare le 28 chiavi aprendo la schermata di ciascuna; quelle che restano vere confluiscono in K29 (pagina sbagliata) o in K04 (taglio a 390).

Esempi dal file (righe, controllo, causa, primo esempio): 324 G-RENDER «accesso negato (non è una pagina): il messaggio mostra il percorso tecnico a vista tra virgolette; schermata solo EN/mobile dedotta dalla IT [percorso-a-vista] » (s2:14423:schermate/u1451.png) ; 252 G-RENDER «percorso-url-a-vista: pagina «Non hai accesso» (persona senza permesso) che mostra il percorso tecnico tra virgolette; per skills-graph il messaggio nomina /ana» (s2:14455:schermate/u1452.png) ; 144 G-RENDER «accesso-negato-percorso-a-vista: pagina «Non hai accesso» per capo squadra, il testo mostra il percorso tecnico tra virgolette / guscio: etichette dei gruppi de» (s2:14502:schermate/u1454.png).

Giri s4-s6: 860 righe e 27 chiavi (ereditate dal giro vecchio 0); controlli G-RENDER 860; pagine 34: /admin/mfa-policy, /admin/roles, /analytics/attendance, /analytics/compensation, /analytics/kpi, /analytics/org-network, /analytics/overtime, /analytics/skills, /analytics/skills-by-category, /analytics/skills-graph, /analytics/skills-group-share, /analytics/workforce, /career-succession, /compensation-intelligence, /consolidation e altre 19; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 180 G-RENDER «accesso negato (non è una pagina): il messaggio mostra il percorso tecnico a vista tra virgolette; schermata solo EN/mobile dedotta dalla IT [percorso» (s4:1669:schermate/u491.png) ; 140 G-RENDER «percorso-url-a-vista: pagina «Non hai accesso» (persona senza permesso) che mostra il percorso tecnico tra virgolette; per skills-graph il messaggio n» (s4:1699:schermate/u492.png) ; 80 G-RENDER «accesso-negato-percorso-a-vista: pagina «Non hai accesso» per capo squadra, il testo mostra il percorso tecnico tra virgolette | guscio: etichette dei» (s4:1746:schermate/u494.png).

Nota s4-s6. Le 27 chiavi sono quasi tutte giudizi ereditati o dedotti come in s2-s3; vanno rigiudicate sulla schermata prima di correggere.

### K07 — Pagine showcase spente in produzione

| voce | valore |
|---|---|
| natura | strumento del giro (comportamento voluto) |
| righe s2-s3 | 1.451 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 20 |
| righe s4-s6 | 725 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 19 |
| stato | strumento del giro |
| controlli s2-s3 | P-HTTP 722, R-RETE 720, R-CONSOLE 9 |
| pagine s2-s3 | 18: /showcase, /showcase/charts, /showcase/dashboard-cards, /showcase/footer, /showcase/forms, /showcase/header, /showcase/icons, /showcase/landing-page, /showcase/login-page, /showcase/logo, /showcase/page-types, /showcase/palettes, /showcase/primary-initial-page, /showcase/shell, /showcase/sidebar e altre 3 |
| persone s2-s3 | fino a 10 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | nullo. |
| ordine | 27 |

Causa radice. apps/web/src/app/showcase/layout.tsx righe 22-25 chiama notFound() quando NODE_ENV è production: le 18 pagine /showcase rispondono 404 per scelta (registro s2: 432 unità /showcase, tutte con http 404). Il giro le ha in elenco e conta P-HTTP, R-RETE e R-CONSOLE su ognuna.

Correzione proposta. Togliere /showcase dall'elenco delle pagine del giro in produzione (o marcarle attese 404); nessun cambiamento all'applicazione.

Esempi dal file (righe, controllo, causa, primo esempio): 722 P-HTTP «risposta N» (s2:17723:schermate/u1542.png) ; 40 R-RETE «GET /showcase/charts → N al caricamento» (s2:17727:schermate/u1542.png) ; 40 R-RETE «GET /showcase/dashboard-cards → N al caricamento» (s2:17735:schermate/u1543.png).

Giri s4-s6: 725 righe e 19 chiavi (ereditate dal giro vecchio 0); controlli P-HTTP 365, R-RETE 360; pagine 18: /showcase, /showcase/charts, /showcase/dashboard-cards, /showcase/footer, /showcase/forms, /showcase/header, /showcase/icons, /showcase/landing-page, /showcase/login-page, /showcase/logo, /showcase/page-types, /showcase/palettes, /showcase/primary-initial-page, /showcase/shell, /showcase/sidebar e altre 3; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 365 P-HTTP «risposta N» (s4:1511:schermate/u484.png) ; 20 R-RETE «GET /showcase/charts → N al caricamento» (s4:4240:schermate/u582.png) ; 20 R-RETE «GET /showcase/dashboard-cards → N al caricamento» (s4:4247:schermate/u583.png).

### K08 — «Proposta dell'agente (000511)» nella colonna Criterio della classificazione dei processi

| voce | valore |
|---|---|
| natura | dato (scritto da migrazioni) |
| righe s2-s3 | 1.132 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 33 |
| righe s4-s6 | 4.524 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 55 |
| stato | dato |
| controlli s2-s3 | T-NUMERO-NUDO 544, T-LINGUA 272, G-RENDER 180, G-TABELLA 136 |
| pagine s2-s3 | 1: /tenant-processes/<id> |
| persone s2-s3 | fino a 1 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no (solo db/migrations) |
| rischio | medio: scrittura sul database di produzione e modifica di migrazioni già applicate (impronte); va provata sul gemello. |
| ordine | 8 |

Causa radice. Il testo non nasce nel frontend: lo scrivono le migrazioni db/migrations/000510_l_agente_propone_perimetro_e_tecnologia_dei_processi.sql (righe 67 e 76), 000511_l_agente_propone_le_altre_faccette_dei_processi_di_rtl.sql (riga 300) e 000512, che mettono il numero della migrazione nel criterio della faccetta (tenant_process_facet_criterion). Il numero serve da marcatore (le migrazioni lo cercano con LIKE 'Proposta dell''agente (000511)%', riga 25 della 000511) ed è finito a vista. Il testo è solo in italiano, quindi compare anche in T-LINGUA sulle pagine inglesi.

Correzione proposta. Migrazione nuova (dopo backup verificato, regola scrittura-db-sicura) che riscrive il criterio senza il numero e sposta il marcatore in una colonna o in un registro di provenienza; secondo ADR-0035 si emendano anche i file 000510-000512 perché la catena riapplicata non lo rimetta. In alternativa minima, il frontend può nascondere il prefisso, ma resterebbe nel dato.

Esempi dal file (righe, controllo, causa, primo esempio): 125 T-NUMERO-NUDO «Nella colonna Criterio della scheda Classificazione la frase «Proposta dell'agente (N) …» mostra un numero interno nudo tra parentesi, senza unità né spieg» (s2:108053:schermate/u10973.png) ; 113 T-NUMERO-NUDO «Nella colonna Criterio della scheda Classificazione il testo inizia con «Proposta dell'agente (N)» e il codice interno a sei cifre non ha spiegazione né co» (s2:109766:schermate/u11238.png) ; 90 G-RENDER «Nella scheda Classificazione la colonna Criterio mostra codici interni dell'agente tra parentesi, per esempio (N); a N px la tabella esce dalla larghezza» (s2:99521:schermate/u10251.png).

Giri s4-s6: 4.524 righe e 55 chiavi (ereditate dal giro vecchio 0); controlli T-NUMERO-NUDO 2.176, T-LINGUA 1.088, G-RENDER 720, G-TABELLA 540; pagine 1: /tenant-processes/<id>; persone fino a 4; lingue en, it; formati 1440x900, 390x844. Esempi: 472 T-NUMERO-NUDO «Nella colonna Criterio della scheda Classificazione la frase «Proposta dell'agente (N) …» mostra un numero interno nudo tra parentesi, senza unità né » (s4:124837:schermate/u13705.png) ; 432 T-NUMERO-NUDO «Nella colonna Criterio della scheda Classificazione il testo inizia con «Proposta dell'agente (N)» e il codice interno a sei cifre non ha spiegazione » (s4:126827:schermate/u14017.png) ; 360 G-RENDER «Nella scheda Classificazione la colonna Criterio mostra codici interni dell'agente tra parentesi, per esempio (N); a N px la tabella esce dalla larghe» (s4:104447:schermate/u10323.png).

Nota s4-s6. La classe cresce soprattutto per T-NUMERO-NUDO (2.176 righe): i giudici hanno visto tutti lo stesso «Proposta dell'agente (0005xx)» nella colonna Criterio, ora anche con «Verifica dal vivo del rilascio del passo N dell'ADR-N». La causa resta nel dato scritto dalle migrazioni 000510-000512.

### K09 — Avviso «Hai N giorni di ferie e permessi da godere» su pagine che non c'entrano, con numeri giudicati implausibili

| voce | valore |
|---|---|
| natura | codice e dato |
| righe s2-s3 | 826 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 36 |
| righe s4-s6 | 436 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 32 |
| stato | da correggere |
| controlli s2-s3 | G-RENDER 774, G-TABELLA 52 |
| pagine s2-s3 | 25: /analytics/attendance, /me, /me/analytics, /me/approvals, /me/career, /me/career/target, /me/certifications, /me/delegations, /me/documents, /me/gaps, /me/handbook, /me/inbox, /me/kpis, /me/learning, /me/learning/catalogue e altre 10 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: apps/api (lente del quadro) e dato dei saldi |
| rischio | basso per il filtro; la verifica dei saldi è una lettura. |
| ordine | 11 |

Causa radice. La lente personale «mie-ferie» del quadro (apps/api/src/modules/quadro/lenti.ts righe 557-575) somma i saldi di ferie e permessi dell'anno e si mostra in cima a ogni pagina personale, anche in Deleghe, Documenti, Manuale, Catalogo corsi. La somma usa balance_total_days + carryover + adjustment - used: i valori alti dipendono dai saldi caricati (dato), la presenza ovunque dipende dal codice che sceglie le lenti per pagina. Quasi tutte le chiavi portano [FN] e il giudizio «guscio: …» del giro vecchio.

Correzione proposta. Legare la lente alle sole pagine di assenze e al cruscotto personale (filtro per area nel quadro); controllare sul dato i saldi sopra 40 giorni prima di decidere se la somma va limitata all'anno corrente senza riporti.

Esempi dal file (righe, controllo, causa, primo esempio): 54 G-RENDER «numero-implausibile: avviso «N giorni di ferie e permessi da godere» per ~N persone / guscio: etichette dei gruppi della barra laterale a capo lettera per l» (s2:15532:schermate/u1485.png) ; 54 G-RENDER «numero-implausibile: avviso «N giorni di ferie e permessi da godere» per ~N persone / guscio mobile: barra laterale da Npx fissa, contenuto tagliato a dest» (s2:20390:schermate/u1725.png) ; 44 G-TABELLA «[numero-incoerente] «Giorni ferie residui N» contro banner «N giorni di ferie da godere»; riquadro «Indice di capacità» alto e quasi vuoto [spazio-vuoto] [FN» (s2:14427:schermate/u1451.png).

Giri s4-s6: 436 righe e 32 chiavi (ereditate dal giro vecchio 0); controlli G-RENDER 400, G-TABELLA 36; pagine 22: /analytics/attendance, /me, /me/analytics, /me/approvals, /me/career, /me/career/target, /me/certifications, /me/delegations, /me/documents, /me/gaps, /me/handbook, /me/inbox, /me/kpis, /me/learning/catalogue, /me/performance e altre 7; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 32 G-TABELLA «[numero-incoerente] «Giorni ferie residui N» contro banner «N giorni di ferie da godere»; riquadro «Indice di capacità» alto e quasi vuoto [spazio-vuo» (s4:1673:schermate/u491.png) ; 30 G-RENDER «numero-implausibile: avviso «N giorni di ferie e permessi da godere» per ~N persone | guscio: etichette dei gruppi della barra laterale a capo lettera» (s4:2690:schermate/u525.png) ; 30 G-RENDER «numero-implausibile: avviso «N giorni di ferie e permessi da godere» per ~N persone | guscio mobile: barra laterale da Npx fissa, contenuto tagliato a» (s4:6255:schermate/u765.png).

### K10 — Elementi dei diagrammi di processo cliccabili senza nome

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 637 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 1 |
| righe s4-s6 | 2.536 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 1 |
| stato | corretta in main (#440) |
| controlli s2-s3 | E-SENZA-NOME 637 |
| pagine s2-s3 | 3: /approvals, /recruiting/applications/<id>, /tenant-processes/<id> |
| persone s2-s3 | fino a 2 |
| lingue s2-s3 | it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 9 |

Causa radice. apps/web/src/components/processo/diagrammi.tsx righe 81-88: la funzione aprendo dà ai gruppi <g> dei diagrammi tabIndex 0 e role="button" ma nessun aria-label; è usata alle righe 158, 180, 270, 286 e 360 (corsie, attività, fasi, grafo). Le altre chiavi della stessa riga del file (inputs senza etichetta in /recruiting/applications/<id> e /approvals) sono 8 righe dentro la stessa chiave aggregata.

Correzione proposta. Far ricevere ad aprendo un'etichetta (nome dell'attività o dell'unità) e scriverla in aria-label; per /recruiting/applications/<id> e /approvals dare un'etichetta ai campi.

Esempi dal file (righe, controllo, causa, primo esempio): 637 E-SENZA-NOME «elemento interattivo senza nome leggibile» (s2:46611:schermate/u3381.png).

Giri s4-s6: 2.536 righe e 1 chiavi (ereditate dal giro vecchio 0); controlli E-SENZA-NOME 2.536; pagine 3: /approvals, /recruiting/applications/<id>, /tenant-processes/<id>; persone fino a 4; lingue it; formati 1440x900. Esempi: 2.536 E-SENZA-NOME «elemento interattivo senza nome leggibile» (s4:46635:schermate/u3861.png).

Nota s4-s6. Una sola chiave E-SENZA-NOME, 2.536 righe: è la stessa funzione aprendo di diagrammi.tsx, corretta da #440.

### K11 — Incoerenze del dato del tenant RTL

| voce | valore |
|---|---|
| natura | dato |
| righe s2-s3 | 579 (di cui ereditate dal giro vecchio 274) |
| chiavi s2-s3 | 60 |
| righe s4-s6 | 582 (di cui ereditate dal giro vecchio 188) |
| chiavi s4-s6 | 71 |
| stato | dato |
| controlli s2-s3 | G-TABELLA 295, G-RENDER 185, T-CODICE 88, T-ETICHETTE 11 |
| pagine s2-s3 | 21: /analytics/overtime, /analytics/skills, /analytics/workforce, /approvals, /blueprints, /compensation-intelligence, /gaps, /job-catalog, /learning, /me/approvals, /me/certifications, /me/learning, /me/matching, /me/time-off, /performance e altre 6 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | — |
| ordine | 30 |

Causa radice. Rilievi sul contenuto e non sull'interfaccia: righe duplicate (Compliance Officer e compliance officer in /job-catalog, corsi doppi in /learning, certificazioni ripetute), sedi incoerenti in /users, anni sbagliati in «Anni precedenti» (/me/time-off), date di scadenza precedenti all'iscrizione (/me/learning), colonne con un solo valore (/approvals, /processes), compensi orari implausibili negli straordinari, sessioni di dicembre ancora in programma, nomi lunghi come paragrafi in /blueprints, sezioni NACE scritte in maiuscolo dalla fonte (/tassonomie, 88 righe di T-CODICE). 274 righe su 579 sono ereditate dal giro vecchio. Possono sovrapporsi ai residui RTL già in carico ad altri thread.

Correzione proposta. Passarle al thread del dato RTL; nessuna correzione nel frontend.

Esempi dal file (righe, controllo, causa, primo esempio): 36 G-RENDER «celle-vuote: ruoli con Famiglia e Livello «—» in molte righe; nomi duplicati con maiuscole diverse (Compliance Officer / compliance officer); placeholder «codic» (s2:15166:schermate/u1477.png) ; 36 G-RENDER «celle-vuote: colonna Durata con trattino in molte righe; righe-duplicate: Analisi avanzata dei dati, Antiriciclaggio AML, Cloud computing con AWS, Comunicazione» (s2:15313:schermate/u1480.png) ; 36 G-TABELLA «[righe-duplicate] Internal Auditor, Specialista Compliance, Legale ripetuti con la stessa affinità [FN] [ereditato dal giro vecchio]» (s2:15812:schermate/u1495.png).

Giri s4-s6: 582 righe e 71 chiavi (ereditate dal giro vecchio 188); controlli G-TABELLA 310, G-RENDER 132, T-CODICE 132, T-ETICHETTE 8; pagine 22: /analytics/overtime, /analytics/skills, /approvals, /blueprints, /compensation-intelligence, /engagement/<id>, /job-catalog, /learning, /me/approvals, /me/certifications, /me/learning, /me/matching, /me/time-off, /org-director, /performance e altre 7; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 32 G-TABELLA «CN colonna Tipo sempre Valutazione, Risposte tutte N e Media senza scala [ereditato dal giro vecchio]» (s4:64206:schermate/u7245.png) ; 26 G-TABELLA «numero-implausibile: Richieste di straordinario: compenso N.N,N euro per N.N ore (circa N,N euro/ora); banner N persone su N con piu di N giorni di » (s4:1794:schermate/u495.png) ; 20 G-RENDER «celle-vuote: ruoli con Famiglia e Livello «—» in molte righe; nomi duplicati con maiuscole diverse (Compliance Officer / compliance officer); placehol» (s4:2349:schermate/u517.png).

Nota s4-s6. Comprende le sezioni NACE scritte in maiuscolo dalla fonte su /tassonomie (132 righe di T-CODICE) e i doppioni «compliance officer» / «Compliance Officer» di /job-catalog (T-ETICHETTE).

### K12 — Testo a 10-11 px nella matrice processi per unità

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 526 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 7 |
| righe s4-s6 | 3.294 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 7 |
| stato | da correggere |
| controlli s2-s3 | T-CORPO 526 |
| pagine s2-s3 | 2: /tenant-processes, /tenant-processes/<id> |
| persone s2-s3 | fino a 1 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 14 |

Causa radice. apps/web/src/components/processo/matrice-processi.tsx righe 57-99: text-[11px] sulla tabella e text-[10px] su intestazioni, celle R/E/C/I e conteggi. La causa citata dal giudice per 104 righe (org-director/vrio/page.tsx, text-[Npx]) non corrisponde alle pagine della chiave (/tenant-processes) e nel file vrio non c'è text-[Npx]: la chiave è stata assegnata qui per le pagine.

Correzione proposta. Portare la matrice almeno a 12 px (regola già adottata in @heuresys/ui 1.6.0, «testo minimo 12px») e compensare con lo scorrimento orizzontale della matrice.

Esempi dal file (righe, controllo, causa, primo esempio): 242 T-CORPO «Nella matrice processi per unità il testo è a circa N px (lettere R/E/C/I, codici e conteggi): troppo piccolo per leggere comodamente, nodo «N».» (s2:91531:schermate/u9614.png) ; 104 T-CORPO «Misura grezza sotto la percentile a Npx (apps/web/src/app/(authenticated)/org-director/vrio/page.tsx:N, tabular-nums text-[Npx]): valore di tabella da legger» (s2:91197:schermate/u9613.png) ; 50 T-CORPO «Nella matrice processi per unità il testo è a circa N px (lettere R/E/C/I, codici e conteggi): troppo piccolo per leggere comodamente, nodo «E».» (s2:91311:schermate/u9614.png).

Giri s4-s6: 3.294 righe e 7 chiavi (ereditate dal giro vecchio 0); controlli T-CORPO 3.294; pagine 2: /tenant-processes, /tenant-processes/<id>; persone fino a 4; lingue en, it; formati 1440x900, 390x844. Esempi: 974 T-CORPO «Nella matrice processi per unità le lettere R/E/C/I, i codici e i conteggi sono a circa N px, grigio su fondo scuro: troppo piccoli per leggere comoda» (s4:83291:schermate/u8957.png) ; 706 T-CORPO «Nella matrice processi per unità la legenda, i nomi dei sottoprocessi e le lettere R/E/C/I nelle celle sono a circa N px, grigio su fondo scuro: poco » (s4:90394:schermate/u9341.png) ; 706 T-CORPO «Nella matrice processi per unità (/tenant-processes?scheda=matrice) legenda, nomi dei sottoprocessi, lettere R/E/C e totali sono resi a circa Npx, sot» (s6:97903:schermate/u9869.png).

Nota s4-s6. Stessa causa in matrice-processi.tsx; 416 righe portano ancora la causa sbagliata di org-director/vrio/page.tsx e sono qui per le pagine, come in s2-s3.

### K13 — Accessibilità puntuale: ordine dei titoli e regole singole

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 517 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 8 |
| righe s4-s6 | 495 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 6 |
| stato | corretta in main (#440) |
| controlli s2-s3 | A-heading-order 488, A-link-in-text-block 15, A-empty-table-header 3, A-page-has-heading-one 3, A-label 3, A-select-name 3, A-html-has-lang 1, A-region 1 |
| pagine s2-s3 | 13: /admin/catalogo-kpi, /analytics/skills-by-category, /dev/agent, /goals, /jobs, /me/career/target, /me/faldone, /me/org-chart, /me/surveys/<id>, /recruiting/applications/<id>, /tenant-processes/<id>, /users/<id>/faldone, /visualizations/<id> |
| persone s2-s3 | fino a 10 |
| lingue s2-s3 | it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 15 |

Causa radice. A-heading-order (488 righe): il faldone salta da h1 a h3 (CardTitle as="h3" in apps/web/src/components/faldone-vista.tsx riga 137, senza h2 per il capitolo); le altre pagine della chiave (/jobs, /dev/agent e altre) vanno guardate una per una. Le altre regole sono puntuali: A-link-in-text-block su /visualizations/<id>, A-empty-table-header su /admin/catalogo-kpi e /tenant-processes/<id> (intestazione vuota della colonna E/C o azioni), A-page-has-heading-one su tre pagine, A-label e A-select-name su /recruiting/applications/<id>, A-html-has-lang e A-region su /goals (1 riga ciascuna, probabile pagina di errore durante un riavvio).

Correzione proposta. Dare un h2 al capitolo nel faldone (o CardTitle as="h2"); correggere puntualmente le altre pagine.

Esempi dal file (righe, controllo, causa, primo esempio): 488 A-heading-order «Heading levels should only increase by one (moderate, N elementi)» (s2:14637:schermate/u1458.png) ; 15 A-link-in-text-block «Links must be distinguishable without relying on color (serious, N elementi)» (s2:70687:schermate/u7769.png) ; 3 A-empty-table-header «Table header text should not be empty (minor, N elementi)» (s2:14365:schermate/u1445.png).

Giri s4-s6: 495 righe e 6 chiavi (ereditate dal giro vecchio 0); controlli A-heading-order 376, A-empty-table-header 97, A-link-in-text-block 15, A-label 3, A-select-name 3, A-page-has-heading-one 1; pagine 11: /admin/catalogo-kpi, /admin/tassonomie, /analytics/skills-by-category, /dev/agent, /me/faldone, /positions/<id>/kpis, /positions/<id>/skills, /recruiting/applications/<id>, /tenant-processes/<id>, /users/<id>/faldone, /visualizations/<id>; persone fino a 5; lingue it; formati 1440x900. Esempi: 376 A-heading-order «Heading levels should only increase by one (moderate, N elementi)» (s4:1879:schermate/u498.png) ; 97 A-empty-table-header «Table header text should not be empty (minor, N elementi)» (s4:1527:schermate/u485.png) ; 15 A-link-in-text-block «Links must be distinguishable without relying on color (serious, N elementi)» (s4:65841:schermate/u7393.png).

### K14 — Matrice dei ruoli: codici di permesso e di ruolo a vista

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 404 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 212 |
| righe s4-s6 | 417 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 220 |
| stato | corretta in main (#441) |
| controlli s2-s3 | T-CODICE 260, T-LINGUA 144 |
| pagine s2-s3 | 1: /admin/roles |
| persone s2-s3 | fino a 1 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900 |
| più parti del codice | sì: apps/web e locales |
| rischio | basso. |
| ordine | 10 |

Causa radice. apps/web/src/app/(authenticated)/admin/roles/page.tsx righe 44-46: l'etichetta del permesso si compone con roles.resources.<risorsa> e roles.actions.<azione> e ricade sul codice grezzo (defaultValue) quando la chiave manca nei locales, da cui «user_position_assignment», «gap_analysis» e simili; riga 127 mette il codice del permesso nel title della cella e riga 113 il codice del ruolo nel title dell'intestazione, letti dal controllo come testo. Le stringhe dei codici vengono dalle rotte API (apps/api/src/modules/*/routes.ts) e non sono un difetto di quelle.

Correzione proposta. Completare roles.resources e roles.actions in locales/it/admin.json e locales/en/admin.json per tutte le risorse (elenco da GET /v1/auth/role-permissions) e togliere il codice dal title o spostarlo in un attributo data-; aggiungere una prova che fallisce se una risorsa non ha etichetta.

Esempi dal file (righe, controllo, causa, primo esempio): 12 T-CODICE «nome tecnico con trattino basso: user_position_assignment» (s2:61091:schermate/u5289.png) ; 10 T-CODICE «nome tecnico con trattino basso: gap_analysis» (s2:61060:schermate/u5289.png) ; 10 T-CODICE «nome tecnico con trattino basso: career_succession» (s2:61117:schermate/u5289.png).

Giri s4-s6: 417 righe e 220 chiavi (ereditate dal giro vecchio 0); controlli T-CODICE 265, T-LINGUA 147, T-ATTACCATO 4, G-TABELLA 1; pagine 1: /admin/roles; persone fino a 1; lingue en, it; formati 1440x900. Esempi: 12 T-CODICE «nome tecnico con trattino basso: user_position_assignment» (s6:34651:schermate/u2889.png) ; 10 T-CODICE «nome tecnico con trattino basso: gap_analysis» (s6:34620:schermate/u2889.png) ; 10 T-CODICE «nome tecnico con trattino basso: career_succession» (s6:34677:schermate/u2889.png).

Nota s4-s6. Comprende T-ATTACCATO su /admin/roles («agent_request · decidere», «agent_request · leggere»): la risorsa agent_request non ha etichetta in roles.resources.

### K15 — Celle vuote senza segno nelle tabelle

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 392 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 1 |
| righe s4-s6 | 838 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 1 |
| stato | corretta in main (#441) |
| controlli s2-s3 | T-CELLE-VUOTE 392 |
| pagine s2-s3 | 5: /analytics/org-network, /analytics/overtime, /me/analytics, /positions/<id>/skills, /tenant-processes/<id> |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 13 |

Causa radice. Due punti: le tabelle equivalenti dei grafici (apps/web/src/app/(authenticated)/_charts-client.tsx righe 186-206, funzione TabellaEquivalente: fmt restituisce il valore così com'è, quindi null o stringa vuota diventano una cella vuota) e le colonne «grezze» di EntityTable (apps/web/src/components/data-table-panel.tsx righe 269-271: se la colonna è grezza la cella non passa da leggi.nodo, che altrove mette il trattino). Pagine: /tenant-processes/<id>, /positions/<id>/skills, /me/analytics, /visualizations, /analytics/overtime e altre.

Correzione proposta. In TabellaEquivalente scrivere «—» (con la spiegazione nel title) per null e vuoto; nelle colonne grezze applicare lo stesso segno quando cell() restituisce vuoto.

Esempi dal file (righe, controllo, causa, primo esempio): 392 T-CELLE-VUOTE «N celle vuote su N, senza un segno che dica perché» (s2:14363:schermate/u1445.png).

Giri s4-s6: 838 righe e 1 chiavi (ereditate dal giro vecchio 0); controlli T-CELLE-VUOTE 838; pagine 5: /analytics/attendance, /analytics/compensation, /analytics/org-network, /analytics/overtime, /tenant-processes/<id>; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 838 T-CELLE-VUOTE «N celle vuote su N, senza un segno che dica perché» (s4:1674:schermate/u491.png).

### K16 — Errori di rete del giro: sessione scaduta, troppe richieste, riavvio

| voce | valore |
|---|---|
| natura | strumento del giro e infrastruttura |
| righe s2-s3 | 340 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 180 |
| righe s4-s6 | 501 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 200 |
| stato | strumento del giro |
| controlli s2-s3 | R-RETE 121, E-LINK 119, E-ESERCIZIO 74, R-CONSOLE 26 |
| pagine s2-s3 | 32: /, /analytics/compensation, /assessments, /gaps, /generated-origins, /goals, /learning/training-initiatives, /login, /me/career/target, /me/faldone, /me/performance, /me/profile, /me/security, /me/skills, /me/skills/self-assessment e altre 17 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | nullo. |
| ordine | 28 |

Causa radice. Nei registri s2 e s3 le chiamate in errore di queste chiavi sono 401 (la sessione della persona di prova è scaduta o è stata sostituita a metà giro: auth/me, me/interfaces, me/preferences), 429 (limite di frequenza dell'API superato dal giro, 73 occorrenze in s2), 502 e 500 transitori (/goals, /organization, /generated-origins, auth/me), MIME text/html sui chunk di /me/career/target (pagina caricata mentre un rilascio sostituiva i file). I collegamenti mailto: di /recruiting/candidates non sono raggiungibili dallo strumento (Protocol "mailto:" not supported). Nessuno di questi è un difetto della pagina.

Correzione proposta. Nel giro: rinnovare l'accesso quando arriva un 401, rallentare sotto il limite di frequenza, sospendere il giro durante i rilasci, saltare i mailto:. Nell'applicazione nulla.

Esempi dal file (righe, controllo, causa, primo esempio): 38 R-RETE «GET /api/vN/auth/me → N al caricamento» (s2:18027:schermate/u1572.png) ; 38 R-RETE «GET /api/vN/me/interfaces → N al caricamento» (s2:18028:schermate/u1572.png) ; 35 R-RETE «GET /api/vN/me/preferences → N al caricamento» (s2:22756:schermate/u1952.png).

Giri s4-s6: 501 righe e 200 chiavi (ereditate dal giro vecchio 0); controlli R-RETE 294, E-LINK 117, E-ESERCIZIO 82, R-CONSOLE 8; pagine 34: /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /assessments, /career-succession, /compensation-intelligence, /engagement/<id>, /gaps, /goals, /insights, /insights/skill-gap, /insights/succession-readiness, /login, /me/career, /me/career/target e altre 19; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 51 R-RETE «GET /api/vN/auth/me → N al caricamento» (s4:1622:schermate/u486.png) ; 51 R-RETE «GET /api/vN/me/interfaces → N al caricamento» (s4:1623:schermate/u486.png) ; 42 R-RETE «GET /api/vN/me/preferences → N al caricamento» (s4:50950:schermate/u4004.png).

Nota s4-s6. Nei registri s4-s6 le chiamate in errore sono 401 (sessione scaduta), 403 con codice STEP_UP_REQUIRED su /goals, /okrs, /insights/*, /talent-review/*, /assessments, /performance-reviews, /compensation/* e /succession-pools, cioè la conferma del secondo fattore che il giro non sa dare (apps/api/src/lib/scope/conferma.ts righe 21-24 e 127-131; i pulsanti «Annulla» e «Chiudi» delle chiavi E-ESERCIZIO sono quelli della finestra di conferma), 404 intermittente su /admin/agent-requests (stessa pagina 200 nelle altre visite) e 502 su /compensation-intelligence e /analytics/compensation (riavvio). Nessuno è un difetto della pagina.

### K17 — Grafici: suggerimento al passaggio del mouse, etichette troncate, assi

| voce | valore |
|---|---|
| natura | codice (in parte da riverificare) |
| righe s2-s3 | 333 (di cui ereditate dal giro vecchio 4) |
| chiavi s2-s3 | 11 |
| righe s4-s6 | 586 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 18 |
| stato | da correggere |
| controlli s2-s3 | C-DINAMICO 114, G-GRAFICO 114, G-RENDER 57, G-TABELLA 48 |
| pagine s2-s3 | 10: /analytics/attendance, /analytics/compensation, /analytics/kpi, /analytics/org-network, /analytics/overtime, /analytics/skills, /analytics/workforce, /me/analytics, /tenant-processes/<id>, /visualizations |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 16 |

Causa radice. apps/web/src/app/(authenticated)/_charts-client.tsx righe 135-141 aggiunge già un tooltip a ogni grafico ECharts che non ne ha: C-DINAMICO (114 righe, una sola chiave, automatica) passa il mouse sul canvas e non trova un suggerimento nel DOM, quindi va riverificato prima di correggere. G-GRAFICO e i giudizi collegati segnalano etichette troncate con puntini, legende senza scala, un anello con un solo valore su /visualizations e il flusso a corsie di /tenant-processes/<id> a zoom ridotto (apps/web/src/components/processo/diagrammi.tsx).

Correzione proposta. Riverificare C-DINAMICO con un'attesa sul tooltip di ECharts; per le etichette usare axisLabel.width con overflow break e mostrare il nome intero nel tooltip; non disegnare un anello con un solo valore.

Esempi dal file (righe, controllo, causa, primo esempio): 114 C-DINAMICO «nessun suggerimento al passaggio del mouse» (s2:14432:schermate/u1451.png) ; 114 G-GRAFICO «grafici: etichette troncate (…), assi/legende non sempre spiegati, un anello con un solo valore (/visualizations), asse mesi oltre l'ultimo dato (attendance/ove» (s2:14433:schermate/u1451.png) ; 21 G-RENDER «Flusso a corsie a N px: lo schema a zoom N% esce a destra (ultima attività 'Finanziare...' tagliata) e il testo dei riquadri è molto piccolo.» (s2:99627:schermate/u10261.png).

Giri s4-s6: 586 righe e 18 chiavi (ereditate dal giro vecchio 0); controlli C-DINAMICO 210, G-GRAFICO 210, G-RENDER 105, G-TABELLA 61; pagine 9: /analytics/attendance, /analytics/kpi, /analytics/org-network, /analytics/overtime, /analytics/skills, /analytics/skills-by-category, /analytics/workforce, /tenant-processes/<id>, /visualizations; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 210 C-DINAMICO «nessun suggerimento al passaggio del mouse» (s4:1678:schermate/u491.png) ; 210 G-GRAFICO «grafici: etichette troncate (…), assi/legende non sempre spiegati, un anello con un solo valore (/visualizations), asse mesi oltre l'ultimo dato (atte» (s4:1679:schermate/u491.png) ; 85 G-RENDER «Flusso a corsie a N px: lo schema a zoom N% esce a destra (ultima attività 'Finanziare...' tagliata) e il testo dei riquadri è molto piccolo. [eredita» (s4:104553:schermate/u10333.png).

Nota s4-s6. Nuovi giudizi della stessa classe: mappe di calore di /analytics/skills e /analytics/skills-by-category con numeri quasi illeggibili per contrasto, etichette dell'asse x ruotate e sovrapposte in «Persone per titolo di posizione» (/analytics/workforce).

### K18 — Tabelle che non si ripiegano a 390 px

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 288 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 46 |
| righe s4-s6 | 1.241 (di cui ereditate dal giro vecchio 52) |
| chiavi s4-s6 | 150 |
| stato | corretta in main (#438) |
| controlli s2-s3 | G-TABELLA 190, G-RENDER 98 |
| pagine s2-s3 | 11: /admin/catalogo-kpi, /blueprints/<id>, /engagement/<id>, /goals, /me/security, /positions/<id>/kpis, /positions/<id>/learning, /positions/<id>/skills, /talent-review, /tenant-processes, /tenant-processes/<id> |
| persone s2-s3 | fino a 3 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 12 |

Causa radice. Oltre al taglio del guscio (K04), le tabelle con molte colonne restano tabelle anche a 390 px: EntityTable (apps/web/src/components/data-table-panel.tsx riga 232, table w-full dentro DataTableWithCrossHair con overflow-x-auto) mostra fino a sei colonne in tabella (COLONNE_IN_TABELLA in faldone-vista.tsx riga 33 e analoghe), e le tabelle della scheda processo (Attività, Unità e ruoli, Indicatori) e di /positions/<id>/skills, /positions/<id>/learning sono tabelle HTML senza vista a schede. Il giudice vede le ultime colonne fuori schermo o una colonna larga pochi caratteri.

Correzione proposta. Sotto md mostrare 2-3 colonne e portare le altre nella scheda della riga (il meccanismo «secondaria» di EntityTable esiste già), oppure una vista a schede; prima correggere K04, perché parte del taglio è suo.

Esempi dal file (righe, controllo, causa, primo esempio): 90 G-RENDER «Nella scheda Attività a N px la tabella esce dalla larghezza: dopo Ingresso le colonne (Uscita, Unità, Corrispondenza APQC) sono fuori schermo, e in Sottoproc» (s2:99580:schermate/u10255.png) ; 21 G-TABELLA «Tabella Attività a N px: la tabella esce dai N px (bordo destro della scheda fuori dallo schermo) e le ultime colonne non si vedono; visibili solo N., Attiv» (s2:99581:schermate/u10255.png) ; 21 G-TABELLA «Tabella Unità e ruoli a N px: la tabella esce dai N px (bordo destro della scheda fuori dallo schermo) e le ultime colonne non si vedono (colonna Ruolo dell» (s2:99618:schermate/u10259.png).

Giri s4-s6: 1.241 righe e 150 chiavi (ereditate dal giro vecchio 52); controlli G-TABELLA 829, G-RENDER 412; pagine 34: /admin/catalogo-kpi, /admin/roles, /analytics/compensation, /analytics/skills, /analytics/skills-by-category, /analytics/workforce, /blueprints/<id>, /compensation-intelligence, /consolidation, /dashboard/process, /engagement, /engagement/<id>, /goals, /insights, /insights/skill-gap e altre 19; persone fino a 4; lingue en, it; formati 1440x900, 390x844. Esempi: 360 G-RENDER «Nella scheda Attività a N px la tabella esce dalla larghezza: dopo Ingresso le colonne (Uscita, Unità, Corrispondenza APQC) sono fuori schermo, e in S» (s4:104506:schermate/u10327.png) ; 84 G-TABELLA «Tabella Unità e persone: A N px la tabella esce dalla larghezza: le colonne a destra sono tagliate senza indicazione di scorrimento e anche titolo e s» (s4:104544:schermate/u10331.png) ; 84 G-TABELLA «Tabella degli indicatori: A N px la tabella esce dalla larghezza: le colonne a destra sono tagliate senza indicazione di scorrimento e anche titolo e » (s4:104807:schermate/u10347.png).

Nota s4-s6. La classe cresce perché i giudici hanno guardato a 390 px molte più tabelle (scheda processo, posizioni, catalogo KPI, sondaggi, obiettivi, cicli di valutazione, consolidamento, matrice dei permessi).

### K19 — Codici tecnici a vista in campi e titoli

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 224 (di cui ereditate dal giro vecchio 164) |
| chiavi s2-s3 | 20 |
| righe s4-s6 | 207 (di cui ereditate dal giro vecchio 149) |
| chiavi s4-s6 | 28 |
| stato | corretta in main (#441) |
| controlli s2-s3 | G-RENDER 102, G-TABELLA 66, T-CODICE 56 |
| pagine s2-s3 | 10: /analytics/skills-group-share, /blueprints/<id>, /me/career, /me/matching, /me/profile, /positions/<id>/learning, /privacy, /tenants/<id>, /tenants/<id>/enterprise-typing, /visualizations/<id> |
| persone s2-s3 | fino a 10 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: apps/web e in parte dato |
| rischio | basso. |
| ordine | 17 |

Causa radice. Valori enumerati mostrati senza etichetta: apps/web/src/app/(authenticated)/me/profile/_components/contracts-tab.tsx riga 48 (workScheduleType, «full_time») e riga 35 (codice del contratto «CCNL_CRED_N» nel titolo); codice del tenant RTL_BANK su /tenants/<id>, RTL_ORG_CHART su /visualizations/<id>, ATECO_N su /tenants/<id>/enterprise-typing; codici di corso CRS-rtl-bank-N su /positions/<id>/learning, codici di modello (flight-risk-vN) su /me/career, codici skill/S… su /analytics/skills-group-share, codice ISCO formattato come numero su /me/matching, «`eu-milan-N`» con apici inversi su /privacy. Molte chiavi sono ereditate dal giro vecchio (164 righe su 224).

Correzione proposta. Passare i campi enumerati da enumLabel come già fa la riga 38 dello stesso file; mostrare il nome e non il codice (o il codice in seconda riga) per tenant, visualizzazioni, corsi e modelli; formattare i codici come testo; togliere gli apici inversi dal testo di /privacy.

Esempi dal file (righe, controllo, causa, primo esempio): 40 G-RENDER «codice-a-vista: «`eu-milan-N`» con apici inversi letterali nel testo (visto in IT; altre firme dedotte) [FN] [ereditato dal giro vecchio]» (s2:17718:schermate/u1541.png) ; 40 G-TABELLA «CN codice del corso (CRS-rtl-bank-N) accanto al nome [ereditato dal giro vecchio]» (s2:78932:schermate/u8753.png) ; 18 G-TABELLA «[codice-formattato-come-numero] codice ISCO mostrato come «N,N» (separatore migliaia); colonna assente in IT [FN] [ereditato dal giro vecchio]» (s2:18897:schermate/u1615.png).

Giri s4-s6: 207 righe e 28 chiavi (ereditate dal giro vecchio 149); controlli G-TABELLA 87, G-RENDER 85, T-CODICE 35; pagine 15: /analytics/skills-group-share, /blueprints/<id>, /compensation-intelligence, /me/career, /me/matching, /me/profile, /org-director, /org-director/advisor, /positions/<id>/learning, /privacy, /process-owner, /skill-taxonomy, /tenants/<id>, /tenants/<id>/enterprise-typing, /visualizations/<id>; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 40 G-TABELLA «CN codice del corso (CRS-rtl-bank-N) accanto al nome [ereditato dal giro vecchio]» (s4:79304:schermate/u8741.png) ; 20 G-RENDER «codice-a-vista: «`eu-milan-N`» con apici inversi letterali nel testo (visto in IT; altre firme dedotte) [FN] [ereditato dal giro vecchio]» (s4:4231:schermate/u581.png) ; 10 T-CODICE «codice al posto di una descrizione: CCNL_CRED_N» (s4:64805:schermate/u7305.png).

Nota s4-s6. Comprende «codice-a-vista» e «codice-formattato-come-numero» ereditati (skill/S…, ISCO) e i codici CCNL_CRED_N, ATECO_N, RTL_BANK, RTL_ORG_CHART, full_time.

### K20 — Rilievi singoli di impaginazione e contenuto di pagina (coda di codice)

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 210 (di cui ereditate dal giro vecchio 77) |
| chiavi s2-s3 | 20 |
| righe s4-s6 | 113 (di cui ereditate dal giro vecchio 38) |
| chiavi s4-s6 | 13 |
| stato | da correggere |
| controlli s2-s3 | G-TABELLA 114, G-RENDER 96 |
| pagine s2-s3 | 15: /admin/catalogo-kpi, /blueprints, /compensation-intelligence, /dev/agent, /engagement/<id>, /investors, /me/approvals, /me/gaps, /me/skills, /me/surveys/<id>, /performance, /positions/<id>/kpis, /skill-taxonomy, /time-off, /visualizations |
| persone s2-s3 | fino a 10 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 20 |

Causa radice. Rilievi giudicati su una pagina ciascuno, senza un componente comune: etichetta «dati case-study sintetici» su /investors (vietata dal CLAUDE.md del repo: un dato si descrive per ciò che è), riquadri di salute fuori contesto su /dev/agent, punteggi senza scala su /me/skills e /engagement/<id>, competenze impilate in una cella su /me/gaps, sezione con sola intestazione su /admin/catalogo-kpi, IBAN che copre il BIC su /me/profile, modello KPI senza unità su /positions/<id>/kpis, domande di valutazione senza scala su /me/surveys/<id>. 77 righe su 210 sono ereditate dal giro vecchio.

Correzione proposta. Una correzione per pagina, dopo aver riverificato le chiavi ereditate.

Esempi dal file (righe, controllo, causa, primo esempio): 40 G-RENDER «etichetta-rassicurante e numero-incoerente: «dati case-study sintetici»; N utenti, N unita, N posizioni contro N persone, N unita, N posizioni nel pro» (s2:17693:schermate/u1539.png) ; 36 G-TABELLA «[numero-senza-unita] punteggio N / N,N senza scala né unità [FN] [ereditato dal giro vecchio]» (s2:16407:schermate/u1502.png) ; 28 G-TABELLA «[tabella-aggregata] competenze impilate in una cella (anche ripetute: Regulatory Knowledge xN) con un solo punteggio; severità BASSA con punteggio N,N incoeren» (s2:15631:schermate/u1489.png).

Giri s4-s6: 113 righe e 13 chiavi (ereditate dal giro vecchio 38); controlli G-RENDER 58, G-TABELLA 55; pagine 11: /dev/agent, /gaps, /insights, /insights/skill-gap, /investors, /me/gaps, /me/profile, /me/skills, /org-director, /users/<id>/faldone, /visualizations; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 20 G-RENDER «sovrapposizione: IBAN lungo copre lo SWIFT/BIC nella scheda Dati bancari; lingua "it-IT" come codice nel campo; N giorni implausibile; EN/mobile da ca» (s4:3097:schermate/u540.png) ; 20 G-RENDER «etichetta-rassicurante e numero-incoerente: «dati case-study sintetici»; N utenti, N unita, N posizioni contro N persone, N unita, N posizioni nel pro» (s4:4206:schermate/u579.png) ; 16 G-TABELLA «[tabella-aggregata] competenze impilate in una cella (anche ripetute: Regulatory Knowledge xN) con un solo punteggio; severità BASSA con punteggio N,N» (s4:2782:schermate/u529.png).

Nota s4-s6. Nuovo: due sezioni del faldone con lo stesso titolo «Abbinamenti di mentoring», distinguibili solo dal motivo; punteggi con decimali incoerenti in /insights, /insights/skill-gap e /gaps.

### K21 — Barra laterale a 1440 px: etichette a capo lettera per lettera, «NAVIGATION», email spezzata

| voce | valore |
|---|---|
| natura | codice (in gran parte verdetti ereditati) |
| righe s2-s3 | 209 (di cui ereditate dal giro vecchio 184) |
| chiavi s2-s3 | 22 |
| righe s4-s6 | 123 (di cui ereditate dal giro vecchio 111) |
| chiavi s4-s6 | 12 |
| stato | da correggere |
| controlli s2-s3 | G-RENDER 209 |
| pagine s2-s3 | 29: /admin/agent-capabilities, /admin/agent-requests, /admin/catalogo-kpi, /admin/dati-di-riferimento, /admin/gdpr, /admin/tassonomie, /approvals/<id>, /assessments, /blueprints/<id>, /compensation-intelligence, /content/<id>, /engagement/<id>, /kpis, /learning/training-initiatives, /me e altre 14 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 21 |

Causa radice. 184 righe su 209 sono ereditate dal giro vecchio e non trovano riscontro nel codice di oggi: l'intestazione della barra viene da shell:ui.navigation, che in locales/it/shell.json riga 267 è «Navigazione»; nelle schermate di questo giro a 1440 px (u1451, u1466) la barra è chiusa a sole icone. Resta attuale l'email dell'utente che va a capo a metà parola nella barra stretta: apps/web/src/app/(authenticated)/layout.tsx riga 465 usa break-all.

Correzione proposta. Per l'email: troncare con puntini e title invece di break-all, o mostrarla solo a barra aperta. Rigiudicare le chiavi ereditate.

Esempi dal file (righe, controllo, causa, primo esempio): 99 G-RENDER «guscio: etichette dei gruppi della barra laterale a capo lettera per lettera [FN] [ereditato dal giro vecchio]» (s2:15387:schermate/u1481.png) ; 30 G-RENDER «intestazione «NAVIGATION» della barra laterale in inglese in pagina italiana [ereditato dal giro vecchio]» (s2:69212:schermate/u7645.png) ; 20 G-RENDER «etichetta NAVIGATION in inglese nel guscio italiano [ereditato dal giro vecchio]» (s2:69418:schermate/u7669.png).

Giri s4-s6: 123 righe e 12 chiavi (ereditate dal giro vecchio 111); controlli G-RENDER 122, T-TRONCATO 1; pagine 23: /admin/mfa-policy, /approvals/<id>, /blueprints/<id>, /compensation-intelligence, /content/<id>, /engagement/<id>, /kpis, /learning/training-initiatives, /login, /me, /me/handbook/<id>, /me/profile, /me/surveys/<id>, /organization, /organization/org-chart e altre 8; persone fino a 5; lingue en, it; formati 1440x900. Esempi: 55 G-RENDER «guscio: etichette dei gruppi della barra laterale a capo lettera per lettera [FN] [ereditato dal giro vecchio]» (s4:2568:schermate/u521.png) ; 20 G-RENDER «intestazione «NAVIGATION» della barra laterale in inglese in pagina italiana [ereditato dal giro vecchio]» (s4:64144:schermate/u7241.png) ; 15 G-RENDER «etichetta NAVIGATION in inglese nel guscio italiano [ereditato dal giro vecchio]» (s4:64030:schermate/u7233.png).

### K22 — Convenzioni di presentazione: «Cognome, Nome», formato delle date, plurali, chiavi i18n a vista

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 189 (di cui ereditate dal giro vecchio 91) |
| chiavi s2-s3 | 44 |
| righe s4-s6 | 277 (di cui ereditate dal giro vecchio 178) |
| chiavi s4-s6 | 58 |
| stato | corretta in main (#438) |
| controlli s2-s3 | G-RENDER 128, G-TABELLA 52, T-TENDINA 6, T-RESIDUO 2, T-PLURALE 1 |
| pagine s2-s3 | 17: /analytics/workforce, /approvals/<id>, /assessments, /compensation-intelligence, /content, /content/<id>, /dashboard, /dashboard/branch, /gaps, /insights/succession-readiness, /me/surveys/<id>, /me/time-off, /positions/<id>, /recruiting/applications/<id>, /talent-review e altre 2 |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 19 |

Causa radice. Più pagine scrivono le persone come «Nome Cognome» contro la regola R1 (Cognome, Nome) già applicata nel guscio con cognomeNome (layout.tsx riga 382): /users/<id>, /approvals/<id>, /gaps, /talent-review, /compensation-intelligence, /content/<id>, /dashboard. I campi data dei moduli usano l'input nativo e mostrano mm/dd/yyyy anche in italiano (/recruiting/applications/<id>, /assessments, /me/delegations, /me/time-off). Altri rilievi: chiave «content.filters.stat» a vista su /content, voce di menu «Okrs», «Attivita'» con apostrofo su /dashboard/branch, «N giorni» su /time-off, tendina «Riporta a» caricata con un limite (T-TENDINA, /positions/<id>), frase di prova a vista su /analytics/workforce (T-RESIDUO). 91 righe su 189 sono ereditate.

Correzione proposta. Usare cognomeNome ovunque si scrive una persona; impostare lang sul documento e usare un selettore di date localizzato; correggere le chiavi mancanti; rigiudicare le ereditate.

Esempi dal file (righe, controllo, causa, primo esempio): 36 G-RENDER «numero-incoerente: banner "N giorni" contro saldo Ferie N,N disponibili; formato-data-inglese mm/dd/yyyy (in IT); sezione "Anni precedenti" contiene righe N» (s2:16502:schermate/u1506.png) ; 18 G-RENDER «nome-non-cognome-nome: "Tommaso Esposito - Generale" mentre altrove "Mancini, Silvia"; righe-duplicate (Palmieri e Pagano due volte con "Generale"); riquadro at» (s2:14991:schermate/u1468.png) ; 16 G-TABELLA «CN persona scritta Nome Cognome e non Cognome, Nome (RN) (colonna Soggetto) [ereditato dal giro vecchio]» (s2:68853:schermate/u7617.png).

Giri s4-s6: 277 righe e 58 chiavi (ereditate dal giro vecchio 178); controlli G-TABELLA 134, G-RENDER 100, T-TENDINA 22, T-CHIAVE 8, T-NUMERO-IT 5, T-RESIDUO 4, T-PLURALE 4; pagine 25: /admin/catalogo-kpi, /analytics/workforce, /approvals/<id>, /compensation-intelligence, /content, /content/<id>, /dashboard, /dashboard/branch, /dashboard/process, /engagement, /gaps, /insights, /insights/skill-gap, /insights/succession-readiness, /me e altre 10; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 48 G-TABELLA «CN persona scritta Nome Cognome e non Cognome, Nome (RN) (autore delle versioni) [ereditato dal giro vecchio]» (s4:63977:schermate/u7229.png) ; 20 G-RENDER «numero-incoerente: banner "N giorni" contro saldo Ferie N,N disponibili; formato-data-inglese mm/dd/yyyy (in IT); sezione "Anni precedenti" contiene r» (s4:3341:schermate/u546.png) ; 18 T-TENDINA «CN Riporta a: lista caricata con limit N su tutte le posizioni e poi filtrata per tenant, puo troncare [ereditato dal giro vecchio]» (s4:74737:schermate/u8421.png).

Nota s4-s6. Due voci nuove non coperte da #438 e da correggere a parte: in /mentorship il nome fuori perimetro mostra «{omissis}» alla lettera, perché locales/it/hr.json e locales/en/hr.json riga 1502 hanno come valore di mentorship.omissis la stringa «{omissis}» (le graffe singole non sono un segnaposto di i18next); in /org-director/advisor compare la chiave «dimensions.performance.score» (T-CHIAVE). Anche il numero «N.N,N» in formato italiano su /me in inglese (T-NUMERO-IT, 5 righe) è qui.

### K23 — Esercizio dei comandi non visto: clic scaduti o senza effetto, da riverificare

| voce | valore |
|---|---|
| natura | strumento del giro (da riverificare) |
| righe s2-s3 | 143 (di cui ereditate dal giro vecchio 26) |
| chiavi s2-s3 | 14 |
| righe s4-s6 | 347 (di cui ereditate dal giro vecchio 15) |
| chiavi s4-s6 | 5 |
| stato | strumento del giro |
| controlli s2-s3 | E-ESERCIZIO 143 |
| pagine s2-s3 | 8: /assessments, /insights, /insights/succession-readiness, /login, /me/security, /me/surveys, /me/surveys/<id>, /tenant-processes/<id> |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | nullo finché non si conferma. |
| ordine | 24 |

Causa radice. Verdetti senza schermata: il clic su «Genera nuovi codici» (/me/security), «Sposta il gruppo «Organizzazione»» (dichiarato su /login, pagina dove quel pulsante della barra laterale non dovrebbe esserci), «Risultati» (/assessments) e sui nomi delle persone in /insights scade o non mostra effetti; «Invia risposte» disabilitato senza spiegazione su /me/surveys/<id> (ereditato). Il giudice stesso li segna «da riverificare a mano».

Correzione proposta. Riverificare a mano le 14 chiavi; aprire una classe di codice solo per quelle che si confermano (probabile: i nomi in /insights che non aprono il dettaglio).

Esempi dal file (righe, controllo, causa, primo esempio): 71 E-ESERCIZIO «Senza schermata (non vista): il clic su «Genera nuovi codici» in /me/security scade dopo N s, elemento non cliccabile o coperto; da riverificare a mano.» (s2:23682:schermate/u1981.png) ; 26 E-ESERCIZIO «DN: «Invia risposte» disabilitato senza dire perché; i campi voto sono caselle numeriche vuote senza scala (N-N) [ereditato dal giro vecchio]» (s2:69762:schermate/u7697.png) ; 7 E-ESERCIZIO «Senza schermata (non vista): il clic su «Risultati» in /assessments scade dopo N s, elemento non cliccabile o coperto; da riverificare a mano.» (s2:14818:schermate/u1462.png).

Giri s4-s6: 347 righe e 5 chiavi (ereditate dal giro vecchio 15); controlli E-ESERCIZIO 347; pagine 6: /insights, /insights/succession-readiness, /login, /me/security, /me/surveys/<id>, /tenant-processes/<id>; persone fino a 5; lingue it; formati 1440x900. Esempi: 272 E-ESERCIZIO «Senza schermata (non vista): il clic su «Genera nuovi codici» in /me/security scade dopo N s, elemento non cliccabile o coperto; da riverificare a man» (s4:104667:schermate/u10337.png) ; 41 E-ESERCIZIO «in Rischio di uscita il nome della persona nella tabella è un bottone ma il clic non apre nessun dettaglio, mentre il sottotitolo promette il punteggi» (s5:55912:schermate/u4354.png) ; 15 E-ESERCIZIO «DN: «Invia risposte» disabilitato senza dire perché; i campi voto sono caselle numeriche vuote senza scala (N-N) [ereditato dal giro vecchio]» (s4:65089:schermate/u7325.png).

Nota s4-s6. 272 righe sono il clic su «Genera nuovi codici» (verdetto ereditato, senza schermata), 41 i nomi in «Rischio di uscita» che non aprono il dettaglio.

### K24 — Attività dei processi senza ingresso, uscita, esecutore e ore

| voce | valore |
|---|---|
| natura | dato |
| righe s2-s3 | 132 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 5 |
| righe s4-s6 | 570 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 5 |
| stato | dato |
| controlli s2-s3 | G-RENDER 90, G-TABELLA 42 |
| pagine s2-s3 | 1: /tenant-processes/<id> |
| persone s2-s3 | fino a 1 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 29 |

Causa radice. Nella scheda Attività di /tenant-processes/<id> sei colonne (Ingresso, Uscita, Chi esegue, Natura del lavoro, Modalità, Ore per ciclo) sono «—» in tutte le righe e la colonna APQC dice «tipo da dichiarare»: la pagina mostra correttamente il vuoto, manca il dato delle attività del tenant.

Correzione proposta. Popolare le faccette delle attività (lavoro di dato, non di interfaccia) oppure nascondere le colonne interamente vuote.

Esempi dal file (righe, controllo, causa, primo esempio): 90 G-RENDER «Nella tabella Attività le colonne Ingresso, Uscita, Chi esegue, Natura del lavoro, Modalità e Ore per ciclo hanno solo un trattino in tutte le otto righe, senza» (s2:99531:schermate/u10253.png) ; 14 G-TABELLA «Tabella Attività: le colonne Ingresso, Uscita, Chi esegue, Natura del lavoro, Modalità, Ore per ciclo sono tutte «—» e «Corrispondenza APQC» mostra «tipo da dic» (s2:99534:schermate/u10253.png) ; 14 G-TABELLA «Tabella Activities in inglese: nomi delle attività in italiano; colonne Input, Output, Performed by, Nature of work, Delivery, Hours per cycle tutte «—»; «type » (s2:99576:schermate/u10254.png).

Giri s4-s6: 570 righe e 5 chiavi (ereditate dal giro vecchio 0); controlli G-RENDER 360, G-TABELLA 210; pagine 1: /tenant-processes/<id>; persone fino a 4; lingue en, it; formati 1440x900, 390x844. Esempi: 360 G-RENDER «Nella tabella Attività le colonne Ingresso, Uscita, Chi esegue, Natura del lavoro, Modalità e Ore per ciclo hanno solo un trattino in tutte le otto ri» (s4:104457:schermate/u10325.png) ; 168 G-TABELLA «Nella tabella delle attività le colonne Ingresso, Uscita, Chi esegue, Natura del lavoro, Modalità e Ore per ciclo mostrano solo «—» su tutte le righe:» (s4:104460:schermate/u10325.png) ; 21 G-TABELLA «Scheda Activities: sei colonne (Input, Output, Performed by, Nature of work, Delivery, Hours per cycle) hanno solo «—» in ogni riga e «APQC correspond» (s6:104619:schermate/u12986.png).

### K25 — Pagine lente (oltre i secondi attesi)

| voce | valore |
|---|---|
| natura | codice (prestazioni API e pagina) |
| righe s2-s3 | 86 (di cui ereditate dal giro vecchio 18) |
| chiavi s2-s3 | 5 |
| righe s4-s6 | 166 (di cui ereditate dal giro vecchio 13) |
| chiavi s4-s6 | 10 |
| stato | da correggere |
| controlli s2-s3 | P-TEMPO 67, G-RENDER 19 |
| pagine s2-s3 | 12: /kpis, /me, /me/career, /me/faldone, /me/handbook/<id>, /me/performance, /me/profile, /me/time-off, /positions/<id>, /tenant-processes/<id>, /users/<id>/faldone, /visualizations/<id> |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: apps/api e apps/web |
| rischio | basso. |
| ordine | 22 |

Causa radice. P-TEMPO su 12 pagine (/tenant-processes/<id>, /kpis, /me/handbook/<id>, /positions/<id>, /me/time-off, il faldone e altre). Il faldone carica l'indice di tutte le sezioni in una chiamata (faldone-vista.tsx riga 182, più di duemila voci di catalogo secondo il commento in testa al file). Il tempo del registro può comprendere le attese per 429 e riavvii (K16), quindi va rimisurato.

Correzione proposta. Rimisurare fuori dal giro con la skill prova-pagine; poi lavorare sulle rotte più lente (indice del faldone, scheda processo).

Esempi dal file (righe, controllo, causa, primo esempio): 46 P-TEMPO «Pagina pronta in N ms, oltre i N secondi, lenta per chi aspetta.» (s2:48921:schermate/u3434.png) ; 19 P-TEMPO «Pagina pronta in oltre N secondi (N ms): caricamento lento per una pagina di consultazione.» (s3:4488:schermate/u5907.png) ; 18 G-RENDER «posizione attuale resta «…» (caricamento non concluso) [ereditato dal giro vecchio]» (s2:69359:schermate/u7657.png).

Giri s4-s6: 166 righe e 10 chiavi (ereditate dal giro vecchio 13); controlli P-TEMPO 156, G-RENDER 10; pagine 14: /admin/dati-di-riferimento, /analytics/attendance, /analytics/skills-by-category, /compensation-intelligence, /content/<id>, /dashboard/company, /insights/skill-gap, /job-catalog, /me, /me/faldone, /positions/<id>, /tenant-processes/<id>, /users/<id>/faldone, /visualizations/<id>; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 60 P-TEMPO «Pagina pronta in N ms, oltre i N secondi, lenta per chi aspetta.» (s4:46308:schermate/u3851.png) ; 25 P-TEMPO «Pagina Competenze per categoria pronta in N ms, oltre i N secondi.» (s5:55296:schermate/u4337.png) ; 24 P-TEMPO «Pagina pronta in N ms, oltre i N secondi (mostra solo il messaggio di accesso negato «You do not have access to this page»).» (s5:58927:schermate/u4446.png).

### K26 — Altri testi italiani fissi nel codice fuori dal faldone

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 79 (di cui ereditate dal giro vecchio 3) |
| chiavi s2-s3 | 26 |
| righe s4-s6 | 315 (di cui ereditate dal giro vecchio 20) |
| chiavi s4-s6 | 32 |
| stato | corretta in main (#438) |
| controlli s2-s3 | T-LINGUA 76, G-RENDER 3 |
| pagine s2-s3 | 9: /dashboard/branch, /dashboard/company, /engagement/<id>, /me, /me/skills, /tassonomie, /tenant-processes, /tenant-processes/<id>, /time-off |
| persone s2-s3 | fino a 9 |
| lingue s2-s3 | en |
| formati s2-s3 | 1440x900 |
| più parti del codice | sì: apps/web e apps/api |
| rischio | basso. |
| ordine | 18 |

Causa radice. apps/api/src/modules/dashboard/blocchi.ts righe 80-87: ETICHETTA_EVENTO in solo italiano («Corso completato», «Certificazione conseguita»), mostrata in inglese su /me e /dashboard/*; apps/api/src/modules/dashboard/service.ts («Valori trattenuti: …»); apps/web/src/lib/valori-leggibili.ts («Rettifica di fine anno»); apps/web/src/app/(authenticated)/generated-origins/page.tsx e apps/web/src/components/processo/matrice-processi.tsx («E», «E/C» come sigle); testi «carico di lavoro» e «consolidamento e le elisioni» da apps/web/src/lib/faldone-parole.ts fuori dal faldone.

Correzione proposta. Tradurre lato API con la stessa coppia L.t(it, en) usata in quadro/lenti.ts, e lato web con le chiavi di locales.

Esempi dal file (righe, controllo, causa, primo esempio): 27 T-LINGUA «testo in italiano in pagina inglese: «E»» (s2:78657:schermate/u8738.png) ; 9 T-LINGUA «testo in italiano in pagina inglese: «Corso completato: GDPR e Privacy (conformità)»» (s2:69439:schermate/u7670.png) ; 5 T-LINGUA «testo in italiano in pagina inglese: «Certificazione conseguita: GDPR Data Protection Officer (TUV)»» (s2:70811:schermate/u7786.png).

Giri s4-s6: 315 righe e 32 chiavi (ereditate dal giro vecchio 20); controlli T-LINGUA 287, G-RENDER 22, G-TABELLA 6; pagine 14: /consolidation, /dashboard/branch, /dashboard/company, /dashboard/process, /dashboard/tenant, /me, /me/handbook/<id>, /me/skills, /tassonomie, /tenant-blueprints/<id>, /tenant-processes, /tenant-processes/<id>, /tenants/<id>/enterprise-typing, /time-off; persone fino a 5; lingue en, it; formati 1440x900, 390x844. Esempi: 103 T-LINGUA «testo in italiano in pagina inglese: «E»» (s4:72301:schermate/u8242.png) ; 87 T-LINGUA «testo in italiano in pagina inglese: «I»» (s4:72309:schermate/u8242.png) ; 21 T-LINGUA «testo in inglese in pagina italiana: «No»» (s4:3208:schermate/u542.png).

Nota s4-s6. Testi italiani nuovi di origine API: le descrizioni delle misure del consolidamento in apps/api/src/modules/tenant-consolidation/distanza.ts (per esempio riga 630, «Commesse del modello contro progetti del tenant.»), «livello prevalente: …» su /dashboard/company, «settore … · dimensione …» su /dashboard/tenant, «N sottoprocesso · N unità» su /dashboard/process.

### K27 — Faldone: sezioni collegate che non si aprono (URI troppo lungo, 414)

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 37 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 25 |
| righe s4-s6 | 20 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 15 |
| stato | corretta in main (#437) |
| controlli s2-s3 | E-ESERCIZIO 37 |
| pagine s2-s3 | 2: /me/faldone, /users/<id>/faldone |
| persone s2-s3 | fino a 8 |
| lingue s2-s3 | it |
| formati s2-s3 | 1440x900 |
| più parti del codice | sì: apps/api e apps/web |
| rischio | medio: cambia il contratto delle rotte del faldone e i test di integrazione. |
| ordine | 4 |

Causa radice. L'identificativo di una sezione collegata è la catena dei legami: apps/api/src/modules/faldone/catalogo.ts riga 177 (id `${t.nome}.${c.nome}@${m.id}`, ricorsivo); il client lo mette nel percorso (apps/web/src/components/faldone-vista.tsx riga 77, /sezioni/<id>), e per catene lunghe (sys.sys_valutazione_condivisione_eccezioni…, sys.sys_successor_readiness…) il server risponde 414. Le chiavi con 401 di questa stessa voce sono della classe K16.

Correzione proposta. Dare a ogni sezione un identificativo corto e stabile (impronta o indice nel catalogo) e risolverlo lato server; in alternativa passare la catena nel corpo di una POST.

Esempi dal file (righe, controllo, causa, primo esempio): 8 E-ESERCIZIO «button «Mostra la struttura delle righe»: cambia lo stato della pagina / errori in console: Failed to load resource: the server responded with a status of N (» (s2:82548:schermate/u8969.png) ; 3 E-ESERCIZIO «button «Mostra la struttura delle righe»: cambia lo stato della pagina / chiamate in errore: GET /api/vN/me/faldone/sezioni/sys.sys_valutazione_condivisione_ecc» (s2:83362:schermate/u9033.png) ; 3 E-ESERCIZIO «button «Mostra la struttura delle righe»: cambia lo stato della pagina / chiamate in errore: GET /api/vN/faldone/NbN-eaN-Nde-NaN-NccdNeeNbN/sezioni/sy» (s2:89402:schermate/u9489.png).

Giri s4-s6: 20 righe e 15 chiavi (ereditate dal giro vecchio 0); controlli E-ESERCIZIO 20; pagine 2: /me/faldone, /users/<id>/faldone; persone fino a 3; lingue it; formati 1440x900. Esempi: 3 E-ESERCIZIO «button «Mostra la struttura delle righe»: cambia lo stato della pagina | chiamate in errore: GET /api/vN/me/faldone/sezioni/sys.sys_valutazione_condiv» (s4:93088:schermate/u9489.png) ; 2 E-ESERCIZIO «button «Mostra le righe»: cambia lo stato della pagina | chiamate in errore: GET /api/vN/faldone/NbN-eaN-Nde-NaN-NccdNeeNbN/sezioni/sys.sys_successor_» (s4:114175:schermate/u11109.png) ; 2 E-ESERCIZIO «button «Mostra le righe»: cambia lo stato della pagina | chiamate in errore: GET /api/vN/faldone/NbN-eaN-Nde-NaN-NccdNeeNbN/sezioni/sys.sys_valutazion» (s4:114242:schermate/u11113.png).

Nota s4-s6. Nei registri s4-s6 le risposte 414 restano sulle catene sys.sys_valutazione_condivisione_eccezioni, sys.sys_successor_readiness e sys.sys_agent_activities: è la causa corretta da #437.

### K28 — Pagine di errore con codice NOT_FOUND e UUID a vista: verdetti ereditati

| voce | valore |
|---|---|
| natura | codice (verdetto da riverificare) |
| righe s2-s3 | 23 (di cui ereditate dal giro vecchio 23) |
| chiavi s2-s3 | 12 |
| righe s4-s6 | 16 (di cui ereditate dal giro vecchio 12) |
| chiavi s4-s6 | 5 |
| stato | da correggere |
| controlli s2-s3 | G-RENDER 23 |
| pagine s2-s3 | 4: /approvals/<id>, /projects/<id>, /tenants/<id>, /users/<id> |
| persone s2-s3 | fino a 5 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | no |
| rischio | nullo. |
| ordine | 25 |

Causa radice. Tutte le 23 righe sono ereditate dal giro vecchio. Il componente di errore oggi mette il riferimento tecnico in una riga secondaria chiusa (apps/web/src/components/stato-pagina.tsx righe 117-126, commento «il riferimento tecnico sta in una riga secondaria, chiusa»). Resta da guardare l'errore server su /tenants/<id>.

Correzione proposta. Rigiudicare; se /tenants/<id> dà ancora errore server, aprire la causa sull'API.

Esempi dal file (righe, controllo, causa, primo esempio): 5 G-RENDER «errore server a vista (A server error occurred) al posto della pagina tenant [ereditato dal giro vecchio]» (s2:70440:schermate/u7754.png) ; 5 G-RENDER «pagina nera con solo messaggio di errore del server e UUID di riferimento a vista [ereditato dal giro vecchio]» (s2:70449:schermate/u7755.png) ; 2 G-RENDER «richiesta non trovata con UUID di riferimento e codice NOT_FOUND a vista [ereditato dal giro vecchio]» (s3:20715:schermate/u7229.png).

Giri s4-s6: 16 righe e 5 chiavi (ereditate dal giro vecchio 12); controlli G-RENDER 16; pagine 2: /approvals/<id>, /tenants/<id>; persone fino a 4; lingue en, it; formati 1440x900, 390x844. Esempi: 4 G-RENDER «guscio non adattivo (@heuresys/ui): barra laterale a tutto schermo, contenuto tagliato; richiesta non trovata con UUID e NOT_FOUND a vista [ereditato » (s4:72375:schermate/u8247.png) ; 4 G-RENDER «errore server a vista (A server error occurred) al posto della pagina tenant [ereditato dal giro vecchio]» (s4:75184:schermate/u8454.png) ; 4 G-RENDER «pagina nera con solo messaggio di errore del server e UUID di riferimento a vista [ereditato dal giro vecchio]» (s4:75194:schermate/u8455.png).

### K29 — Accesso negato che nomina la pagina sbagliata

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 18 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 11 |
| righe s4-s6 | 0 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 0 |
| stato | corretta in main (#436) |
| controlli s2-s3 | G-RENDER 18 |
| pagine s2-s3 | 5: /admin/agent-capabilities, /admin/agent-requests, /admin/dati-di-riferimento, /admin/gdpr, /admin/tassonomie |
| persone s2-s3 | fino a 2 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 7 |

Causa radice. apps/web/src/app/(authenticated)/layout.tsx righe 370-374: se il percorso richiesto non ha una voce di menu propria, il nome si prende da verdict.route, che apps/web/src/lib/page-guard.ts riga 71 sostituisce con la prima pagina del gruppo di schede ({ kind: "denied", route: main }). Così /admin/agent-capabilities e /admin/agent-requests dicono «Ruoli», e /admin/dati-di-riferimento, /admin/gdpr, /admin/tassonomie dicono «Registro di provenienza».

Correzione proposta. Dare una voce shell:nav.voci a ciascuna pagina del gruppo, oppure, quando il nome della pagina richiesta manca, usare il testo generico shell:noAccess.bodyGenerico invece del nome della pagina principale del gruppo.

Esempi dal file (righe, controllo, causa, primo esempio): 3 G-RENDER «il messaggio di accesso negato nomina la pagina sbagliata (Registro di provenienza / Provenance ledger invece della pagina richiesta)» (s2:64126:schermate/u5406.png) ; 2 G-RENDER «la pagina /admin/agent-capabilities mostra «Non hai accesso a questa pagina» ma cita «Ruoli» invece del nome della pagina richiesta» (s2:14341:schermate/u1443.png) ; 2 G-RENDER «la pagina /admin/agent-requests mostra «Non hai accesso a questa pagina» ma cita «Ruoli» invece del nome della pagina richiesta» (s2:14350:schermate/u1444.png).

Giri s4-s6: nessuna riga in questa classe (la correzione era già nel codice servito, oppure il caso non si è ripresentato).

Nota s4-s6. Nessuna riga: il caso non si è ripresentato con le persone di s4-s6.

### K30 — Chiamate API che falliscono sempre: mentorship e cronologia degli obiettivi

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 11 (di cui ereditate dal giro vecchio 0) |
| chiavi s2-s3 | 5 |
| righe s4-s6 | 17 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 16 |
| stato | corretta in main (#436) |
| controlli s2-s3 | R-RETE 8, E-ESERCIZIO 3 |
| pagine s2-s3 | 2: /me/career, /mentorship |
| persone s2-s3 | fino a 1 |
| lingue s2-s3 | en, it |
| formati s2-s3 | 1440x900, 390x844 |
| più parti del codice | sì: apps/web e apps/api |
| rischio | basso. |
| ordine | 23 |

Causa radice. /mentorship carica programmi e coppie senza controllare il permesso (apps/web/src/app/(authenticated)/mentorship/page.tsx righe 111 e 114) e per chi non lo ha l'API risponde 403 (apps/api/src/modules/mentorship/routes.ts); gli incontri di una coppia rispondono 404 (rotta /pairings/:id/sessions, routes.ts riga 81, probabile coppia fuori dal perimetro). «Cronologia» in /me/career risponde 500 su GET /v1/me/goals/:goalId/timeline (apps/api/src/modules/me/routes.ts riga 296).

Correzione proposta. Condizionare le query di /mentorship a useCan('mentorship:read'); capire il 404 degli incontri; riprodurre il 500 della cronologia con un test di integrazione e correggerlo.

Esempi dal file (righe, controllo, causa, primo esempio): 4 R-RETE «GET /api/vN/mentorship/pairings → N al caricamento» (s2:16541:schermate/u1507.png) ; 4 R-RETE «GET /api/vN/mentorship/programs → N al caricamento» (s2:16542:schermate/u1507.png) ; 1 E-ESERCIZIO «button «Cronologia»: cambia lo stato della pagina / errori in console: Failed to load resource: the server responded with a status of N (Internal Server Error» (s3:2148:schermate/u5804.png).

Giri s4-s6: 17 righe e 16 chiavi (ereditate dal giro vecchio 0); controlli E-ESERCIZIO 17; pagine 1: /mentorship; persone fino a 2; lingue it; formati 1440x900. Esempi: 2 E-ESERCIZIO «button «Incontri»: cambia lo stato della pagina | chiamate in errore: GET /api/vN/mentorship/pairings/NeNb-N-N-bNc-eNacNedNcN/sessions → N» (s4:48619:schermate/u3907.png) ; 1 E-ESERCIZIO «button «Incontri»: cambia lo stato della pagina | errori in console: Failed to load resource: the server responded with a status of N (Not Found)» (s5:57420:schermate/u4387.png) ; 1 E-ESERCIZIO «button «Incontri»: cambia lo stato della pagina | chiamate in errore: GET /api/vN/mentorship/pairings/afNaN-eN-N-aeeN-eNeNeN/sessions → N» (s5:57421:schermate/u4387.png).

Nota s4-s6. Le 16 chiavi sono il pulsante «Incontri» di /mentorship (404 sulle sessioni della coppia, 15 volte in s5) e la cronologia: stessa causa corretta da #436.

### K31 — Errori 500 dell'API: storia della persona e ricerca nel catalogo dei ruoli

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 0 |
| chiavi s2-s3 | 0 |
| righe s4-s6 | 3 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 2 |
| stato | da correggere |
| controlli s4-s6 | E-ESERCIZIO 3 |
| pagine s4-s6 | 2: /job-catalog, /users/<id> |
| persone s4-s6 | fino a 2 |
| lingue s4-s6 | it |
| formati s4-s6 | 1440x900 |
| più parti del codice | sì: apps/api |
| rischio | basso, ma la causa va prima riprodotta. |
| ordine | 31 |

Causa radice. Due chiamate rispondono 500 (stato letto nei registri: GET /api/v1/user-timeline una volta in s4 e una in s6, GET /api/v1/job-roles una volta in s5). La prima la chiama la scheda «Storia» di /users/<id> (apps/web/src/app/(authenticated)/users/[userId]/page.tsx riga 367, TimelinePanel con basePath /v1/user-timeline) e la serve apps/api/src/modules/user-timeline/routes.ts righe 17-24 (userTimelineService.list, che passa per orgFilter dell'attore); la seconda è la ricerca nel catalogo dei ruoli di /job-catalog, servita da apps/api/src/modules/job-roles/routes.ts riga 21 e costruita in apps/api/src/modules/job-roles/repository.ts righe 84-86 (ILIKE su nome e codice). Il messaggio dell'errore non è nei registri: la causa nel codice non è stata vista.

Correzione proposta. Riprodurre le due chiamate con la persona del giro (s4 e s6 per la storia, s5 per la ricerca) in un test di integrazione, leggere il log dell'API all'ora del giro e correggere; se la storia fallisce solo per alcune persone, guardare il filtro organizzativo.

Esempi dal file (righe, controllo, causa, primo esempio): 2 E-ESERCIZIO «tab «Storia»: porta a /users/NcNdfN-fNe-Nb-bN-NeNbN | errori in console: Failed to load resource: the server responded with a status of N (Inter» (s4:75505:schermate/u8473.png) ; 1 E-ESERCIZIO «input «Cerca»: valore cambiato | errori in console: Failed to load resource: the server responded with a status of N (Internal Server Error)» (s5:56094:schermate/u4357.png).

### K32 — Versione del blueprint (confronto e costruzione): codici, identificativi ESCO e messaggi italiani dall'API

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 0 |
| chiavi s2-s3 | 0 |
| righe s4-s6 | 25 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 15 |
| stato | da correggere |
| controlli s4-s6 | G-RENDER 8, T-CODICE 6, R-RETE 4, T-UUID 2, T-NUMERO-NUDO 2, T-ACCENTO 1, R-CONSOLE 1, E-ESERCIZIO 1 |
| pagine s4-s6 | 2: /tenant-blueprints/<id>/versions/1/build, /tenant-blueprints/<id>/versions/1/diff |
| persone s4-s6 | fino a 1 |
| lingue s4-s6 | en, it |
| formati s4-s6 | 1440x900, 390x844 |
| più parti del codice | sì: apps/web (pagine diff e build) e apps/api (tenant-blueprints e tenant-materialization) |
| rischio | basso sul confronto; medio sulla costruzione, perché il messaggio è anche la guardia che ferma una costruzione incoerente e non va tolto, solo reso leggibile. |
| ordine | 32 |

Causa radice. Due pagine nuove nel giro. Il confronto (/tenant-blueprints/<id>/versions/1/diff) scrive le decisioni come codice grezzo: apps/web/src/app/(authenticated)/tenant-blueprints/[id]/versions/[n]/diff/page.tsx righe 93 e 97 compongono «${p.processCode} — ${p.inclusion}», quindi IN, PARTIAL e OUT compaiono a vista in entrambe le lingue (T-CODICE PARTIAL); il testo «In questa parte l'impatto sull'azienda gia' costruita non e' calcolabile…» arriva dall'API solo in italiano e con l'apostrofo al posto dell'accento (apps/api/src/modules/tenant-blueprints/diff.ts righe 24-30, T-ACCENTO). La costruzione (/tenant-blueprints/<id>/versions/1/build) riceve 409 su GET …/build-plan e mostra in grassetto il messaggio dell'errore, che elenca tutti i codici ESCO::uuid delle competenze senza categoria: apps/api/src/modules/tenant-materialization/blueprint-build-source.ts righe 233-240 (ConflictError BLUEPRINT_CONTENT_INCOHERENT, testo italiano fisso); compaiono anche FIN_BANKING e un UUID (T-UUID). A 390 px la pagina esce dalla larghezza come in K04.

Correzione proposta. Nel confronto passare inclusion da un'etichetta tradotta (le stesse di INCLUSIONI in tenant-blueprints/[id]/page.tsx riga 51); nell'API restituire un codice di motivo e tradurre nel client, oppure L.t(it, en) con gli accenti veri. Nella costruzione restituire nel corpo dell'errore il numero e l'elenco strutturato delle competenze (codice e nome) e mostrare il numero con l'elenco richiudibile, nella lingua della pagina.

Esempi dal file (righe, controllo, causa, primo esempio): 4 T-CODICE «parola in maiuscolo grezzo, probabile codice: PARTIAL» (s6:82734:schermate/u8925.png) ; 4 R-RETE «GET /api/vN/tenant-blueprints/NabdNfe-Naba-N-N-NbNdfdN/versions/N/build-plan → N al caricamento» (s6:82779:schermate/u8929.png) ; 2 G-RENDER «Nel blocco centrale un unico paragrafo in grassetto e centrato elenca centinaia di identificativi «ESCO::uuid» (N competenze senza categoria): illeggi» (s6:82778:schermate/u8929.png).

### K33 — Errore React #418 (idratazione) al cambio di lingua

| voce | valore |
|---|---|
| natura | codice (da riprodurre) |
| righe s2-s3 | 0 |
| chiavi s2-s3 | 0 |
| righe s4-s6 | 5 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 1 |
| stato | da correggere |
| controlli s4-s6 | E-ESERCIZIO 5 |
| pagine s4-s6 | 1: /login |
| persone s4-s6 | fino a 5 |
| lingue s4-s6 | it |
| formati s4-s6 | 1440x900 |
| più parti del codice | no |
| rischio | basso. |
| ordine | 33 |

Causa radice. Nel giro s4 il clic sul pulsante «IT — cambia lingua tra italiano e inglese», con la pagina registrata come /login, ha prodotto in console «Minified React error #418» con argomento text (registro s4, verifica 1410), cioè un testo diverso fra il server e il primo disegno nel browser; la scrittura PATCH /api/v1/me/preferences era bloccata dal giro. Il pulsante sta nel guscio autenticato (apps/web/src/app/(authenticated)/layout.tsx riga 440, etichetta shell:ui.languageSwitch), quindi la pagina era probabilmente già passata all'area riservata. Il nodo che cambia testo non è stato individuato.

Correzione proposta. Riprodurre in sviluppo (errore non minificato) con la stessa persona e lo stesso passaggio; correggere il nodo che legge la lingua o l'ora prima dell'idratazione (per esempio spostandolo in un effetto o in useSyncExternalStore con il valore del server).

Esempi dal file (righe, controllo, causa, primo esempio): 5 E-ESERCIZIO «button «IT — cambia lingua tra italiano e ingles»: cambia lo stato della pagina | errori in console: eccezione: Minified React error #N; visit https:/» (s4:1410:schermate/u482.png).

### K34 — Mappa dei dati personali (GDPR): nomi delle tabelle del database a vista

| voce | valore |
|---|---|
| natura | codice |
| righe s2-s3 | 0 |
| chiavi s2-s3 | 0 |
| righe s4-s6 | 95 (di cui ereditate dal giro vecchio 0) |
| chiavi s4-s6 | 89 |
| stato | da correggere |
| controlli s4-s6 | T-CODICE 95 |
| pagine s4-s6 | 1: /admin/gdpr |
| persone s4-s6 | fino a 1 |
| lingue s4-s6 | en, it |
| formati s4-s6 | 1440x900 |
| più parti del codice | sì: apps/web e, per le descrizioni, apps/api (gdpr data-map) |
| rischio | basso. |
| ordine | 34 |

Causa radice. La scheda «Mappa dei dati personali (93 tabelle)» di /admin/gdpr elenca i nomi fisici delle tabelle (audit.chiavi_idempotenza, sys.sys_users, sys.sys_user_bank_details e così via) senza una descrizione: apps/web/src/app/(authenticated)/admin/gdpr/page.tsx riga 172 scrive «{m.tableSchema}.{m.tableName}» in font-mono, una riga per tabella. La schermata u3007 del giro s6 lo mostra (93 righe, con doppioni apparenti come sys.sys_feedback_360_responses e sys.sys_continuous_feedback ripetuti, che sono la stessa tabella con colonne della persona diverse, chiave tableName più subjectFkColumn alla riga 171).

Correzione proposta. Dare a ogni voce della mappa un nome leggibile e la classe del dato (anagrafica, retribuzione, valutazioni…) dalla stessa tassonomia di apps/api/src/lib/scope/data-classes.ts, raggruppare per classe e lasciare il nome fisico in seconda riga o in un dettaglio; dire perché una tabella compare due volte (colonna della persona).

Esempi dal file (righe, controllo, causa, primo esempio): 4 T-CODICE «nome tecnico con trattino basso: sys_feedback_N_responses» (s6:34509:schermate/u2887.png) ; 2 T-CODICE «nome tecnico con trattino basso: sys_continuous_feedback» (s6:40278:schermate/u3007.png) ; 2 T-CODICE «nome tecnico con trattino basso: sys_gap_closure_plans» (s6:40296:schermate/u3007.png).

## Escluse perché appartengono ad altri thread

Queste righe sono contate nel totale ma non sono classi di questo lavoro: il compito le assegna ad altri thread.

| id | cosa | righe s2-s3 | righe s4-s6 | chiavi s2-s3 | chiavi s4-s6 | dove sta la causa |
|---|---|---|---|---|---|---|
| X1 | Organigrammi (/organization/org-chart, /me/org-chart, organigramma completo), comprese le righe T-CORPO del riquadro SVG | 17.532 | 7.914 | 41 | 44 | apps/web/src/components/organigramma/blocchi.tsx (fontSize del nome e del conteggio) |
| X2 | /analytics/org-network | 26 | 104 | 16 | 16 | — |
| X3 | Traduzione del dato: contenuti del tenant scritti in una sola lingua (nomi di unità, posizioni, processi, corsi, sondaggi, titoli delle richieste) mostrati nella pagina dell'altra lingua | 6.568 | 12.655 | 1.270 | 1.523 | dato monolingua, in parte scritto da migrazioni (per esempio db/migrations/000493_titoli_e_avvisi_delle_approvazioni_in_italiano.sql, 000396 e 000496 per il motivo dell'eccezione di valutazione) |

X1 contiene le due chiavi T-CORPO del riquadro dell'organigramma SVG (11.289 e 5.325 righe), le chiavi T-LINGUA, T-CODICE («UFFICIO») e G-RENDER le cui pagine sono solo i due organigrammi, e A-label-content-name-mismatch (solo organigrammi). Le chiavi che citano un organigramma insieme ad altre pagine sono rimaste nella loro classe. X3 è il dato in una sola lingua: il frontend lo mostra come lo riceve; la sua traduzione è un lavoro sul dato, già in carico ad altri. Dentro X3 ci sono anche 419 righe di altri controlli (G-RENDER, G-TABELLA, T-ETICHETTE, T-NUMERO-IT) che lamentano lo stesso fatto (titoli di richieste, nomi di processi e corsi in italiano nelle pagine inglesi). I residui del dato RTL che non sono traduzioni sono invece nella classe di dato K11, perché il compito chiede di separarli e non di escluderli; possono sovrapporsi a quanto già in carico al thread del dato RTL. Nei giri s4-s6 X1 contiene le due chiavi T-CORPO del riquadro SVG (5.088 e 2.400 righe), «UFFICIO», A-label-content-name-mismatch e la chiamata GET /api/v1/me/organigramma (404 e 401 nei registri); X2 le etichette e i nomi di /analytics/org-network; X3 12.378 righe T-LINGUA di testi che non sono né nei locales né fra le stringhe del codice (nomi di unità, processi, posizioni, corsi, titoli delle richieste di ferie, obiettivi) e 277 righe di giudizi che lamentano lo stesso fatto.

## Verifica di copertura

Giri s2-s3: somma delle righe per classe, incluse ed escluse, 56.875 su 56.875; chiavi 2.656 su 2.656. Giri s4-s6: righe 62.648 su 62.648, chiavi 3.002 su 3.002, nessuna chiave senza classe (lo script ha un ramo finale che segna «??» e il conteggio di «??» è zero). In tutto 119.523 righe e 5.658 chiavi. Le somme sono state ricalcolate dallo script che scrive l'indice, che si ferma se il totale di una delle due fonti non coincide.

## Rilievi non bloccanti delle revisioni

Punti emersi nelle revisioni delle PR #435-#441 e della libreria 1.7.0. Non sono classi del giro: si tengono qui perché non si perdano.

1. La scheda «Nuova raccomandazione» e /me/analytics avevano titoli h3 senza h2: fatto in #440.

2. La ricerca e l'ordinamento dell'assistente usano «Nome Cognome», mentre a video si legge «Cognome, Nome» (vista-tabella.ts): da correggere, altrimenti chi cerca per cognome come lo vede non trova la persona.

3. Su telefono la regola delle prime tre colonne nasconde la colonna di stato nelle tabelle comuni (data-table-panel.tsx): da valutare, perché lo stato è spesso l'informazione che serve di più; la colonna di stato potrebbe essere sempre fra quelle visibili.

4. La prova dei plurali lascia passare sette chiavi senza le varianti _one e _other: da correggere, la prova deve fallire su ogni chiave con count senza le due varianti in entrambe le lingue.

5. La lunghezza massima del contratto della sezione collegata del faldone (200 caratteri) è più corta del nome che una sezione può avere: da misurare sul catalogo vero (il nome più lungo) prima di decidere il limite.

6. Il parametro lingua del faldone tocca web e API insieme: l'ordine di rilascio va scritto (prima l'API che accetta il parametro, poi il web che lo manda), altrimenti per qualche minuto il web chiede una lingua che l'API non conosce.

7. In advanced l'uscita (logout) non è raggiungibile su telefono: la barra laterale è nascosta sotto md e il cassetto non contiene il comando di uscita. Da correggere nel guscio.

8. Dopo la libreria 1.7.0 SectionTabs e il pannello dell'agente restano fuori dal main e axe segnala la regola region: da sistemare quando advanced adotta la 1.7.0, mettendoli dentro un landmark.

9. Il codice «Proposta dell'agente (0005xx)» nella colonna Criterio è prodotto dalle migrazioni 000510-000512: è la classe di dato K08, che nei giri s4-s6 conta 4.524 righe, e non si corregge nel frontend.
