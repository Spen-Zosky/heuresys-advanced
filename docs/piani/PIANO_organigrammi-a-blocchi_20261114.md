# Piano: organigrammi a blocchi popolati, come il banco del datastore (14 novembre 2026)

Mandato di Enzo del 2026-11-14 alle 04:29 UTC, con sei schermate: le pagine di advanced che disegnano l'organigramma usano solo un grafo a nodi, affollato e illeggibile, senza i nomi delle persone; i collegamenti sono sbagliati (HR Director non collegato al CEO); il grafo mescola italiano e inglese. Il banco del datastore (tab Organizzazione, modello «banca commerciale regionale retail», corsa `p20261010010521tjb`) usa invece diagrammi gerarchici a blocchi con finestre a cascata. Si chiede: vista a blocchi «popolata completamente» (Cognome, Nome) ovunque ci sia il grafo, grafo a nodi riprogettato con dettagli al clic più completi, collegamenti calcolati dai dati vivi con un pulsante «Aggiorna», coerenza con la lingua selezionata.

## 0. Che cosa ho misurato prima di scrivere il piano

Il banco: `apps/banco/public/orgchart.mjs` (176 righe) e `ispeziona.mjs` (166 righe) del datastore, senza librerie. La copia servita sulla 3103 coincide con il file del repo (impronta SHA-256 di `orgchart.mjs` uguale: `curl -s http://127.0.0.1:3103/banco/orgchart.mjs | sha256sum`). Funzionamento: albero calcolato in SVG, figlie tutte foglia impilate in colonna sotto il padre, un organigramma per sede e uno per tutte le filiali, filiali tratteggiate, vertice pieno scuro; clic su un riquadro apre una scheda sopra la precedente (pila) con catena, struttura sotto di sé, unità figlie, ruoli; «‹ Indietro» chiude l'ultima, «Chiudi cascata» tutte, Esc l'ultima; «Esporta SVG».

I dati di advanced (RTL Bank), in sola lettura con il ruolo `heuresys_datastore_ro`: 38 unità attive con una sola radice, 162 posizioni attive tutte con unità, 1 sola senza capo (il Direttore Generale), 158 persone con un'assegnazione attiva, al massimo 9 persone per unità; 10 unità di tipo BRANCH. Il Direttore Risorse Umane riporta al Direttore Generale. Nessuna posizione attiva si chiama «HR Director» o «CEO»: il grafo a nodi viene da `db/seeds/org_chart_rtl_demo.sql`, scritto una volta e mai rieseguito (nessuno script lo richiama), mentre le posizioni sono state ricostruite dopo (154 posizioni non attive). I nomi delle unità e delle posizioni vivi sono in italiano e non hanno traduzioni in `sys_reference_translations`; i `name_it`/`name_en` nei metadati di 21 unità sono residui del legacy e in 9 casi diversi dal nome vero.

Differenze di dati rispetto al banco, dette a Enzo il 2026-11-14: il banco non ha persone (solo «N addetti» e posti per ruolo), advanced sì; in advanced le unità non hanno «sede» né «perché questo organico», quindi i gruppi sono «sede centrale» e «filiali» ricavati dal tipo BRANCH.

Vincolo: un grafo salvato in `sys_visualization_*` non può contenere persone (sentinella bloccante della 000355, perimetro dell'agente). I nomi arrivano solo dal calcolo vivo, mai dal grafo salvato.

## 1. Voci

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| V1 | API `GET /v1/me/organigramma`: unità con responsabile, persone «Cognome, Nome» con la posizione, addetti, livello, filiale; posizioni con riporto e titolare; calcolata a ogni chiamata, perimetro dei clienti come la rubrica (permesso `user_profile:read:self`), `?tenantId=` per chi vede più clienti; schema Zod condiviso | Claude | test di integrazione verde sul gemello o in CI, risposta dal vivo con 38 unità e 158 persone | fatta: le stesse query, lette in sola lettura sulla produzione il 2026-11-14, danno 38 unità, 162 posizioni, 158 persone, 1 posizione senza riporto; CI in corso |
| V2 | API `POST /v1/visualization-graphs/:id/rigenera` per i grafi ORG_CHART: ricostruisce nodi e archi dalle posizioni attive (solo posizioni, mai persone), stessa logica del seed | Claude | test di integrazione verde; dal vivo il grafo RTL ha 162 nodi e 161 archi | da fare |
| V3 | Componente `OrganigrammaBlocchi`: porta in React dell'algoritmo del banco (colonne per le figlie foglia, gruppi sede centrale e filiali, tratteggio per le filiali, vertice pieno), riquadri con nomi delle persone (responsabile per primo, in grassetto), colori dai token, clic → scheda a cascata, «Esporta SVG» | Claude | test unitario della disposizione (nessuna sovrapposizione, ogni figlia sotto il padre), schermata dal vivo | fatta: 8 prove verdi; resa con i dati veri di RTL in tema chiaro e scuro (sede centrale 28 unità e 90 persone, filiali 10 e 68) |
| V4 | Scheda a cascata: alla scheda dell'unità si aggiungono tipo, persone, struttura sotto di sé a blocchi; ai comandi «‹ Indietro» e «Chiudi cascata» come nel banco | Claude | schermata dal vivo con due livelli aperti | da fare |
| V5 | Vista a nodi riprogettata: un nodo per unità (38, non 162 posizioni), albero ordinato invece della forza, etichette sempre leggibili, grandezza per addetti, rami richiudibili; clic → stessa scheda a cascata | Claude | schermata dal vivo, nessuna etichetta sovrapposta a profondità 2 | da fare |
| V6 | Pagine: `/organization/org-chart` e `/me/org-chart` con schede «Blocchi» (predefinita) e «Nodi», pulsante «Aggiorna» e ora del calcolo; `/me/org-chart` evidenzia la propria unità; `/visualizations/[graphId]` con «Aggiorna dai dati vivi» sui grafi ORG_CHART; `/consolidation` con l'organigramma a blocchi del cliente in un riquadro a parte | Claude | E2E esistenti verdi (test id conservati), login dal vivo con una persona di RTL | da fare |
| V7 | Lingua: testi dell'interfaccia in `it` e `en`; nomi di unità e posizioni dai dati vivi (nomi propri del cliente, uguali in ogni lingua); niente etichette dal grafo vecchio | Claude | nessuna stringa fissa nei componenti nuovi; cambio lingua dal vivo | da fare |
| V8 | PR con CI verde, unione, rilascio armato, rigenerazione del grafo RTL salvato dal pulsante, verifica dal vivo | Claude | `scripts/verifica-deploy.sh` DEPLOYATO; schermate | da fare |

## 2. Simulazione

V1: le tabelle lette sono quelle della rubrica (`sys_users`, `sys_positions`, `sys_user_position_assignments`, `sys_organization_units`); nessuna migrazione. Nessuna scrittura. Rischio: un'unità radice multipla (cliente Heuresys System) e cicli nel `parent_id` (il servizio delle unità li rifiuta, ma il calcolo non deve andare in loop: visita con insieme dei visti).

V2: scrive in produzione solo quando qualcuno preme il pulsante; permesso `visualization_graph:update` (da verificare nel catalogo dei permessi prima di usarlo). La cancellazione riguarda solo i nodi e gli archi di quel grafo, in una transazione; post-condizione: nessun nodo USER (la sentinella 000355 resta zero).

V6 e i thread paralleli: le PR 246, 247 e 248 toccano `/consolidation/page.tsx` e i file `hr.json`. Il riquadro va in un componente nuovo; in `page.tsx` entra una riga sola, dopo che le PR aperte sono state unite, con rebase sul `main` di quel momento.

V8: rilascio con i permessi permanenti (CI verde sul commit, backup verificato prima, verifiche dal vivo dopo). La pressione di «Aggiorna» sul grafo RTL è una scrittura in produzione: prima `bash ~/.claude/tools/backup-verificato.sh heuresys_advanced`.

## 3. Che cosa non si chiude in questo piano

La bonifica dei `name_it`/`name_en` residui nei metadati delle unità (dati del legacy, non letti dalle pagine nuove): la propongo a Enzo come voce del prossimo ciclo. La «sede» delle unità e il «perché questo organico» non esistono nei dati di advanced e non si inventano.

## 4. Registro delle scoperte

S1. Con le dieci filiali di RTL, che non hanno uffici sotto, la regola del banco (figlie foglia in colonna) produce una torre alta 1.500 punti e illeggibile. Differenza voluta: oltre 5 figlie foglia si affiancano (`MAX_COLONNA`), sotto le 5 resta la colonna come nel banco.

S2. Una vista ad albero di nodi non si può provare con il disegno lato server (ECharts disegna su canvas): si prova dal vivo dopo il rilascio, con lo spec `organigramma-blocchi.spec.ts`.

## 5. Chiusura

(da scrivere a fine ciclo)
