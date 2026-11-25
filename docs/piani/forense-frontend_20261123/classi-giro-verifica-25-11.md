# Classi dei difetti del giro di verifica del 24-25/11/2026 (s2, s2b, s2c, s3, s4, s4b, s5, s6)

Fonte: /home/ubuntu/heuresys-advanced-giro/20261125-difetti-per-causa.tsv, 2.126 gruppi e 98.446 verifiche DIFETTO (somma della colonna n, letta con il modulo csv di Python). Dettagli letti in sola lettura dai registri 20261124-verifica-<giro>/registro.sqlite (apertura mode=ro&immutable=1, tabelle unita e verifica, filtro verdetto='DIFETTO'), con schermate aperte: s4 u4049, s2 u10261, s6 u10039. Codice letto in sola lettura in /home/ubuntu/heuresys-advanced al commit 80689227 (il rilascio del 25/11) e in /home/ubuntu/ux-design-shared al commit 18b7451. Nessun repo e nessun registro è stato modificato.

Classi di riferimento: docs/piani/forense-frontend_20261123/classi-difetti.md (K01-K34, X1-X3) e FUORI_CICLO.md (F1-F10). Le classi nuove si chiamano N1-N6.

## Metodo

Gruppi con causa scritta (giudicati, 43.341 verifiche): assegnati da regole deterministiche sul testo della causa (espressioni regolari, prima regola che scatta); tutti i 174 gruppi con n>=20 hanno una classe; restano senza classe 837 gruppi piccoli (tutti con n<20, 1.437 verifiche), elencati in coda. Una regola fissa: le righe T-CORPO di /tenant-processes vanno a N1 anche quando la causa parla della matrice o di VRIO, perché nel registro sono tutte sulla scheda flusso (misurato: 100% delle righe T-CORPO di quella pagina hanno scheda=flusso) e la causa è stata copiata da un'altra chiave.

Controlli automatici senza causa (55.105 verifiche): ogni riga letta dai registri e classificata dal testo segnalato. T-LINGUA: il testo è stato cercato nei valori di apps/web/src/locales/{it,en} (dopo aver tolto i segnaposto {{…}} e le cifre): se è un valore della lingua della pagina è un falso positivo; se è un valore dell'altra lingua è codice; se è una stringa letterale nei sorgenti (apps/web/src, apps/api/src, packages, ux-design-shared/ui/src) è codice; altrimenti è dato. T-CODICE, R-RETE, T-TRONCATO, A-* e gli altri: per tipo di dettaglio (sigla, stato HTTP, selettore del nodo, regola axe). I numeri sono esatti per i controlli automatici e per regola per quelli giudicati.

Pagine: per i gruppi giudicati sono l'unione delle pagine della colonna pagine_top (un minimo); per gli automatici sono contate dai registri.

## Tabella delle classi

| classe | nome | n verifiche | n pagine | esistente/nuova | azione | file probabili |
|---|---|---|---|---|---|---|
| X3 | Traduzione del dato: contenuti del tenant in una sola lingua (nomi di unità, processi, corsi, KPI, titoli delle richieste, criterio delle faccette in pagina inglese) | 27.622 | 92 | esistente | fuori ciclo | dato del tenant RTL |
| X1 | Organigrammi (testo dei riquadri SVG, nomi delle unità, regole axe sull'SVG, «UFFICIO») | 26.629 | 2 (+4 citate) | esistente | fuori ciclo | components/organigramma/blocchi.tsx |
| K02 | Falsi positivi dei controlli automatici (vedi sezione) | 19.457 | 127 | esistente | falso positivo del controllo | ~/.claude/tools/qa-web, scripts/qa-web/adattatore.mjs |
| K08 | «Proposta dell'agente (0005xx)» nel criterio della classificazione | 4.833 | 1 | esistente (corretta, rilascio 80689227) | riverificare dopo rilascio | — |
| N1 | Diagrammi di processo (flusso a corsie, fasi, grafo) illeggibili all'apertura: testo a 7 px, titolo della fascia troncato senza puntini, nodi troncati | 3.289 | 1 (/tenant-processes/<id>, schede flusso, fasi, grafo) | NUOVA | correggere codice | apps/web/src/components/processo/diagrammi.tsx; apps/web/src/lib/navigazione-area.ts |
| K25 | Pagine lente (oltre 5 s) | 2.375 | ≥9 (124 nei dati P-TEMPO) | esistente (F6) | fuori ciclo | da indagare (API del processo e del faldone) |
| K04 | Guscio più largo di 390 px | 2.249 | ≥86 | esistente (corretta, #454 in produzione) | riverificare dopo rilascio (verdetti non confermati) | — |
| K07 | Pagine showcase spente in produzione (404 di P-HTTP, R-RETE, R-CONSOLE) | 2.175 | 18 | esistente | falso positivo del controllo (comportamento voluto) | — |
| N3 | Ruolo della corsia in maiuscolo grezzo nella vista a fasi («CONTRIBUTES», «ESECUTRICE», «RESPONSABILE») | 924 | 1 | NUOVA | correggere codice | apps/web/src/components/processo/diagrammi.tsx:246 |
| K17 | Grafici: suggerimento al passaggio del mouse (C-DINAMICO), etichette, assi | 917 | ≥29 | esistente | riverificare dopo rilascio (#452-#470) | apps/web/src/app/(authenticated)/_charts-client.tsx |
| K16 | Errori di rete del giro: sessione scaduta (401), 500/502 al riavvio, script rifiutati per MIME durante il rilascio, pagina 502 senza lang | 853 | ≥80 | esistente | falso positivo del controllo (infrastruttura e strumento) | — |
| K11 | Incoerenze del dato RTL, comprese le sezioni NACE in maiuscolo in /tassonomie | 843 | ≥30 | esistente (F1) | fuori ciclo | dato |
| K06 | Accesso negato con il percorso a vista (verdetti ereditati) | 688 | 25 | esistente (C7: non è più un difetto) | riverificare dopo rilascio | — |
| K22 | Plurali e convenzioni: «1 sottoprocessi», «# activities» con una sola attività; date ISO | 682 | ≥8 | esistente, residuo non coperto da #438 | correggere codice | apps/web/src/locales/{it,en}/blueprints.json (chiave riepilogo, riga 474) |
| N2 | Valori delle faccette dei processi in italiano nella pagina inglese: l'API legge solo la colonna _it | 633 | 1 (+2 citate) | NUOVA | correggere codice | apps/api/src/modules/tenant-processes/repository.ts:106-118 |
| N4 | Nome accessibile diverso dal testo visibile negli oggetti apribili dei diagrammi (axe label-content-name-mismatch) | 441 | 1 | NUOVA (nata dalla correzione di K10, #440) | correggere codice | apps/web/src/components/processo/diagrammi.tsx (aprendo, righe 77, 244-264) |
| K05 | Testi italiani fissi della libreria («Cerca tenant, log, audit...» ereditato; «Data table») | 437 | ≥10 | esistente | riverificare dopo rilascio (204 righe ereditate); «Data table» 173 righe = F7 fuori ciclo | — |
| K24 | Attività senza ingresso, uscita, esecutore e ore | 371 | 1 | esistente (corretta, rilascio 80689227) | riverificare dopo rilascio | — |
| K23 | Esercizio dei comandi non visto (clic in timeout su gruppi SVG e su maniglie del menu, pulsante del nome in /insights) | 330 | ≥9 | esistente | riverificare (strumento) | — |
| K19 | Codici tecnici a vista (CCNL_CRED_2024, PERNR, codici unità, UUID dell'intervistatore in /recruiting/applications/<id>, «eu-milan» ereditato) | 275 | ≥8 | esistente | riverificare dopo rilascio; UUID = correggere codice (piccolo) | apps/web/src/app/(authenticated)/recruiting/applications/[id]/page.tsx:350-372 |
| N6 | Conferma d'identità (secondo fattore) che il giro non supera: 403 sulle API di /talent-review, /compensation-intelligence, /goals, /okrs, /insights per HRMS_MANAGER e PEOPLE_MANAGER | 265 | 6 | NUOVA | falso positivo del controllo (limite dello strumento) | scripts/qa-web/adattatore.mjs (accesso con secondo fattore) |
| K13 | Accessibilità puntuale: landmark con lo stesso nome (A-landmark-unique), ordine dei titoli, h1 mancante | 184 | ≥10 | esistente | correggere codice | apps/web/src/app/(authenticated)/blueprints/[id], users/[id] (dossier-*), me/matching, process-owner |
| K26 | Altri testi italiani fissi del codice in pagina inglese («Rettifica di fine anno», «carico di lavoro», descrizioni del diff dei blueprint, frammenti di locales) | 158 | ≥7 | esistente, residuo | correggere codice | apps/web/src/lib/valori-leggibili.ts:79; apps/web/src/lib/faldone-parole.ts:192; tenant-blueprints/[id]/versions/[n]/diff |
| N5 | Peso degli indicatori come decimale nudo (0,40) mentre la guida dice che i pesi sommano a 100% | 152 | 3 | NUOVA | correggere codice | apps/web/src/app/(authenticated)/tenant-processes/[id]/page.tsx:225 |
| K21 | Barra laterale a 1440 px (in gran parte verdetti ereditati) | 116 | ≥27 | esistente (corretta in parte, #465) | riverificare dopo rilascio | — |
| K09 | Avviso dei giorni di ferie | 48 | 3 | esistente (corretta, #448) | riverificare dopo rilascio | — |
| K01 | Faldone non tradotto | 44 | 3 | esistente (corretta, #439) | riverificare dopo rilascio | — |
| K10 | Elementi cliccabili senza nome (E-SENZA-NOME su /approvals) | 8 | 1 | esistente | riverificare dopo rilascio | — |
| K15 | Celle vuote senza segno | 7 | 2 | esistente | riverificare dopo rilascio | — |
| K32 | Build-plan del blueprint 409 | 4 | 1 | esistente | correggere codice (già in coda K32) | — |
| — | Coda non assegnata: 837 gruppi, tutti con n<20 (soprattutto tabelle a 390 px = K18, rilievi singoli = K20, grafie doppie del catalogo = K11, mappe di calore = K17, frasi italiane nel dato = X3) | 1.437 | ≥106 | da assegnare | da giudicare nel prossimo passaggio | — |
| totale | | 98.446 | | | | |

## Controlli automatici: che cosa è rumore e che cosa no

T-LINGUA (37.111). Falso positivo 7.690 (21%): 5.862 testi che sono valori della lingua della pagina («Personal data», «Zoom in», «Hours per cycle», «Sicurezza dell'account» in pagina italiana), 732 «Data origin : mixed/hybrid» (inglese composto in pagina inglese), 693 nomi italiani con prestiti inglesi in pagina italiana («Direzione Back Office», «Specialista Back Office»), 403 testi di una o due lettere («E», «I», «No»). Organigramma (X1) 2.266. Dato del tenant (X3) 26.824, di cui 1.758 sono il criterio «Proposta dell'agente (0005xx) dal nome…», che anche dopo il rilascio K08 resta una frase italiana in pagina inglese. Codice 331: «Data table» della libreria (173, F7), stringhe letterali dei sorgenti (56) e frammenti di valori dell'altra lingua (102, da riguardare: in gran parte pezzi di frasi spezzate dal controllo, per esempio «di conformità», «Gestire i»).

T-CODICE (8.934). Falso positivo 7.338: sigle vere (APQC, INPS, IRPEF, VRIO, GDPR, INAIL, IFRS, CAMS, WCAG, TOTP, BIC…). Difetti veri: 798 ruoli di corsia in maiuscolo (N3), 490 sezioni NACE in maiuscolo nel dato (K11), 112 nell'organigramma (X1), 196 codici (CCNL_CRED_2024, PERNR, codici di unità e progetto: K19, da riguardare perché alcuni sono codici legittimi di una colonna «Codice»).

T-TRONCATO (3.720): tutto falso positivo. Per selettore del nodo: 2.960 sono `<caption>` delle tabelle, 364 intestazioni `thead` (la colonna «Azioni»), 278 «Caricamento…», 62 «Chiudi», 56 «pagina iniziale»: testi per il lettore di schermo con la classe sr-only, che il controllo legge come troncati (DataTable di ux-design-shared, data-table.tsx:62, e i caption sr-only di apps/web). Correzione dello strumento: escludere gli elementi con clip/sr-only.

R-RETE (2.047): 1.080 sono le pagine showcase in 404 (K07); 642 sono 401 su /auth/me, /me/permissions, /me/interfaces, /me/preferences (sessione scaduta, K16); 56 sono 500/502 sulle stesse rotte in finestre orarie precise (riavvii, K16); 4 sono 409 del build-plan (K32); 265 sono 403 per HRMS_MANAGER e PEOPLE_MANAGER su talent-review, compensation, goals, okrs, insights, assessments, performance-reviews. La schermata s4 u4049 mostra il motivo: la finestra «Confirm your identity» chiede il secondo fattore e il giro non lo supera («The code could not be verified»), quindi la pagina resta su «Loading…» (N6, limite dello strumento; da confermare sulle altre righe 403, verificata su una).

P-HTTP (1.085): 1.080 showcase (K07), 5 risposte 502 (K16). R-CONSOLE (159): 123 script rifiutati per tipo MIME (chunk di Next.js non più presenti durante un rilascio, s2 e s5), il resto 401/404/5xx: K16 e K07. P-TEMPO (2.609): pagine lente vere, non rumore; misurate: /tenant-processes/<id> 954 difetti su 10.160 visite (mediana dei difetti 6,2 s, p90 8,1 s; mediana di tutte le visite 2,8 s), /users/<id>/faldone 624 su 3.431 (6,0 s), /me/faldone 235 su 1.733 (6,4 s). Restano K25, fuori ciclo (F6).

A-label-content-name-mismatch (498): 441 sui diagrammi di processo (N4), 57 sull'organigramma (X1). A-landmark-unique (166): nav dentro .h-full in /blueprints/<id>, schede del dossier in /users/<id>, sezioni «Da guardare» ripetute (K13). A-heading-order (43): 33 organigramma (X1), 10 K13. A-html-has-lang, A-landmark-one-main, A-region (6): tutte sull'unità s2c 12022, che è la pagina 502 del proxy (K16).

Altri falsi positivi: T-NUMERO-IT 344 su 413 sono l'indirizzo IP «80.225.82.207» in /me/security (gli altri 69 sono titoli delle richieste nel dato, X3); E-LINK 238 sono collegamenti mailto: che lo strumento prova a scaricare; T-DECIMALE 94 sono «WCAG 2.2» e «v3.0»; T-TECNICO 33 è «banconote false».

## Classi nuove

### N1 — Diagrammi di processo illeggibili all'apertura

Causa radice nel codice. apps/web/src/components/processo/diagrammi.tsx disegna i testi delle attività a fontSize 10-11 (righe 163-165) e 12-14 nelle altre viste; AreaNavigabile apre il disegno alla scala di adattamento con minimo SCALA_MIN_LEGGIBILE = 0.7 (apps/web/src/lib/navigazione-area.ts:20), quindi il testo arriva a circa 7 px (schermata s2 u10261: zoom 70%, riquadri illeggibili). Il titolo della fascia del sottoprocesso usa `dueRighe(f.nome, n)[0]` (righe 125-128 e 226-229): quando il nome va su due righe si tiene solo la prima e i puntini non compaiono, da cui «Erogazione del» e «Adeguata verifica e». Pagine: /tenant-processes/<id> schede flusso, fasi, grafo. Gravità: alta (è il contenuto principale della scheda, 3.289 verifiche su tutte le persone). Correzione proposta: corpo minimo dei testi del disegno tale che a scala 0.7 restino a 12 px o più (cioè fontSize >= 17 in unità del disegno) oppure scala minima di apertura 1 con scorrimento; per la fascia, mostrare il nome intero su una o due righe o aggiungere «…» quando si tronca. Natura: codice.

### N2 — Faccette dei processi in italiano nella pagina inglese

Causa radice nel codice. apps/api/src/modules/tenant-processes/repository.ts, funzioni facetVocabulary (righe 102-111) e processFacets (righe 113-125), leggono solo `process_facet_value_label_it` e `process_facet_value_description_it`, mentre la tabella sys.sys_process_facet_values ha anche le colonne _en, già popolate (db/migrations/000507_le_faccette_dei_processi.sql, riga 60: «Governo e indirizzo» / «Governance and direction»). Pagine: /tenant-processes/<id> scheda classificazione (valori come «Governo e indirizzo», «Cliente esterno», «Realizzazione del valore»). Gravità: media. Correzione proposta: passare la lingua della richiesta al repository e scegliere _it o _en (oppure restituire entrambe e scegliere nella pagina). Natura: codice. Il testo del criterio e le descrizioni degli indicatori sono invece dato in una sola lingua (X3), e l'unità di misura «percentuale» dei KPI è un valore italiano nel dato (db/migrations/000401…, X3).

### N3 — Ruolo della corsia in maiuscolo grezzo

Causa radice nel codice. diagrammi.tsx:246 scrive `ruolo.toUpperCase()`, dove ruolo viene da enumLabel("processUnitRole", …) (tenant-processes/[id]/page.tsx:288); in inglese CONTRIBUTOR è «Contributes» (locales/en/common.json:883), che diventa «CONTRIBUTES», un verbo in maiuscolo accanto a «Owner», «Consulted», «Informed». Il controllo T-CODICE lo legge come codice (798 righe) e i giudici come incoerenza (126). Pagine: /tenant-processes/<id> scheda fasi. Gravità: bassa. Correzione proposta: niente toUpperCase (o maiuscoletto solo con CSS e una forma sostantiva coerente nelle etichette, per esempio «Contributor»). Natura: codice.

### N4 — Nome accessibile diverso dal testo visibile nei diagrammi

Causa radice nel codice. La correzione di K10 (#440, commit fd73bcb3) dà a ogni gruppo apribile un aria-label con `aprendo(etichetta, …)` (diagrammi.tsx:77): per le corsie l'etichetta è solo il nome dell'unità mentre il gruppo mostra anche il ruolo in maiuscolo (righe 244-249), per le attività è etichettaAttivita(a) mentre il testo visibile è il numero d'ordine e il nome spezzato e troncato con «…». La regola axe label-content-name-mismatch chiede che il testo visibile sia contenuto nel nome. Pagine: /tenant-processes/<id> schede flusso, fasi, grafo (441 verifiche). Gravità: media (accessibilità, livello serious). Correzione proposta: comporre l'aria-label in modo che cominci con il testo visibile (ruolo e nome della corsia; numero e nome dell'attività), oppure togliere il ruolo dal gruppo apribile. Natura: codice.

### N5 — Peso degli indicatori come decimale nudo

Causa radice nel codice. apps/web/src/app/(authenticated)/tenant-processes/[id]/page.tsx:225 mostra `fmt.numero(x.defaultWeight, 2)` (0,40), mentre il glossario dice «i pesi di una persona sommano a 100%» (locales/it/common.json:1646). Pagine: /tenant-processes/<id> scheda indicatori, con casi simili in /positions/<id>/skills e /admin/catalogo-kpi. Gravità: bassa. Correzione proposta: mostrare il peso in percentuale (fmt.percento o valore per 100 con «%»). Natura: codice.

### N6 — Secondo fattore non superato dal giro

Causa: non è nel prodotto. Le API di talent review, compensation, goals, okrs, insights rispondono 403 finché la persona non conferma l'identità; il giro entra senza poter dare il codice (schermata s4 u4049). Pagine: /talent-review, /compensation-intelligence, /goals, /okrs, /insights, /insights/succession-readiness, per HRMS_MANAGER e PEOPLE_MANAGER (265 verifiche). Gravità: nessuna sul prodotto; lascia però non verificate quelle pagine per due ruoli. Correzione proposta: nello strumento, conferma del secondo fattore con il codice della persona di prova prima delle pagine protette, oppure escludere le chiamate 403 dopo la richiesta di conferma. Natura: strumento del giro.

## Avvertenze sui verdetti

Dei 9.992 verdetti giudicati G-RENDER e G-TABELLA nei registri, 3.910 portano «[ereditato dal giro vecchio]»: sono copiati, non visti in questo giro. Per K04 la schermata s6 u10039 (/me/faldone?scheda=valutazioni, 390 px, 24/11 13:20) smentisce la causa scritta: la pagina sta nella larghezza. Per K05 la schermata s4 u4049 mostra il segnaposto già in inglese («Search tenants, logs, audit…»). Inoltre due gruppi T-CORPO (440 e 84 verifiche) e il gruppo P-TEMPO di /dashboard/company (244) hanno una causa che parla di un'altra pagina: il verdetto è stato propagato per chiave su unità diverse. Le classi K04, K05, K06, K21 e K19 di questo giro vanno quindi riverificate prima di contarle.

## Che cosa correggere nel codice, in ordine di priorità

1. N1 — diagrammi di processo leggibili all'apertura e titolo della fascia non troncato (diagrammi.tsx, navigazione-area.ts): 3.289 verifiche, gravità alta, un solo file.
2. N2 — faccette nella lingua della pagina (apps/api tenant-processes/repository.ts): 633 verifiche, il dato inglese esiste già.
3. N4 — aria-label degli oggetti dei diagrammi che contengono il testo visibile (diagrammi.tsx): 441 verifiche, si fa insieme a N1 e N3.
4. K22 residuo — plurali di «sottoprocessi» e «attività» nella chiave riepilogo di blueprints.json (it ed en): 639 verifiche, una chiave.
5. N3 — ruolo della corsia senza toUpperCase (diagrammi.tsx:246): 924 verifiche, una riga; si fa con N1.
6. K13 — landmark con nome unico in /blueprints/<id>, /users/<id> (dossier), /me/matching, /process-owner: 184 verifiche.
7. N5 — peso in percentuale (tenant-processes/[id]/page.tsx:225): 152 verifiche.
8. K26 residuo — traduzioni fisse in valori-leggibili.ts e faldone-parole.ts usate in pagina inglese, descrizioni del diff dei blueprint: 158 verifiche.
9. K19 piccolo — UUID dell'intervistatore in /recruiting/applications/<id> quando la lista utenti non lo contiene: 14 verifiche.

Correzioni dello strumento del giro, fuori dal codice del prodotto: escludere gli elementi sr-only da T-TRONCATO; non scaricare i mailto: in E-LINK; T-LINGUA che confronti con i valori dei locales e ignori testi corti; T-CODICE con elenco di sigle ammesse; T-NUMERO-IT che riconosca gli indirizzi IP; secondo fattore per HRMS_MANAGER e PEOPLE_MANAGER (N6); non propagare un verdetto per chiave su unità di un'altra pagina o scheda.
