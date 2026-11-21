# Revisione del frontend di advanced con le soluzioni del datastore: mappa a passi piccoli

Data: 2026-11-21. Stato: **da approvare** (Enzo). Thread: «Pianificare la revisione del frontend di advanced».

> **Prossimo passo da eseguire: P2**, diagramma per fasi nella scheda del processo (`/tenant-processes/[id]`), dopo che Enzo ha visto P1 (in corso in un thread a parte). Modello da cui partire: la finestra del processo nella Mappa della console del datastore (schermata `5_processi_mappa_modale.png` in Drive `gdrive-hr:Heuresys/revisione-frontend-20261121/schermate/`): fasi in colonne con numero e codice APQC, una corsia per unità (responsabile in grigio), in ogni riquadro i ruoli che la eseguono, riquadro pieno = esegue, tratteggiato = consultata, riga di legenda sotto, pulsanti «Esporta SVG» e «Schermo intero». In advanced esistono già `FlussoCorsie` e `GrafoProcesso` (`components/processo/diagrammi.tsx`) e lo schermo intero di `components/organigramma/area-navigabile.tsx`: si riusano, non si rifanno. Subito dopo, se Enzo è d'accordo, **D1** (nessun testo troncato), che è il passo più piccolo della sezione 7.

## 1. Metodo (Enzo, 2026-11-21)

Niente piano da realizzare tutto insieme. Questo file è solo la **mappa**: elenca passi piccoli e autonomi, ciascuno visibile nel browser e rilasciabile da solo in poche ore (una pagina o un elemento per volta). Un passo alla volta, ciascuno in un thread nuovo: PR, CI verde, unione, rilascio, prova dal vivo, link a Enzo per vederlo. Solo dopo il suo sguardo si apre il passo seguente. L'ordine si può cambiare a ogni passo.

Ogni passo rispetta: vincolo agentico (ciò che vede la persona lo vede e lo usa anche l'assistente), dati vivi da `/v1/*`, regole UI di Enzo (italiano, numeri it-IT, «Cognome, Nome», tab orizzontali, stato in ultima colonna, niente sigle, attese visibili, scala di grigi nei disegni, nessun testo troncato), componenti generici in `@heuresys/ui`, composizione in `apps/web`.

## 2. Che cosa ha il datastore e advanced no (sintesi dell'inventario)

Letto il codice di `main` dei due repo il 2026-11-21 (datastore `4ae203c`, advanced `8587974`). Le affermazioni «manca» poggiano su ricerche nel codice; ogni passo le ricontrolla in apertura.

- **Ispezionabilità a cascata** (fondativa). Nel datastore ogni identificativo che compare in pagina o dentro una scheda diventa cliccabile da sé e apre una finestra sopra la precedente: otto tipi di oggetto nel banco (processo, unità, ruolo, terna processo-unità-ruolo, obiettivo, metrica, obbligo normativo, livello del contratto, `apps/banco/public/ispeziona.mjs`), con sezioni contate, diagrammi dentro la scheda (fasi, corsie, struttura sotto l'unità), fonti. In advanced la cascata copre **tre tipi** (persona, posizione, unità: `components/scheda-rapida.tsx`, `TipoScheda`), si attiva solo dove il nome passa dalla rete di leggibilità, e le schede sono meno articolate (niente diagrammi del processo, niente obiettivi o metriche collegati, niente fonti). Processi, attività, competenze, mansioni, obiettivi, KPI, progetti, contratti e livelli non si aprono a cascata. Le finestre sono già ridimensionabili (`lib/modale.ts`).
- **Processi**. Il datastore ha la **mappa processi × unità** (responsabile, esecutrici, consultate, conteggio E/C, clic sul processo), il diagramma per fasi, l'elenco con motivo e fonti. Advanced ha l'elenco dei processi del tenant e, nella scheda, corsie e grafo a nodi (`components/processo/diagrammi.tsx`); la mappa d'insieme e il diagramma per fasi mancano. I dati per la mappa ci sono nello schema: ruolo RACI dell'unità nel processo (`sys_organization_unit_processes`, `TenantProcessUnitRoleSchema`); quanti ne ha RTL si misura nel passo P1.
- **Catena dei passi**. Sono 31 passi (contratto v0.3); le corse fatte con la v0.2 ne hanno 25 (mancano strategia, capability, mestieri, decisioni, agenti, principi). La console lo dice in modo incoerente: menu e guida «31», tabella «Prototipi e corse» «25» (difetto del datastore, va segnalato al suo repo). La vista per livelli con «legge da / lo usano / si rifanno a catena» non ha un equivalente in advanced.
- **Tabelle**. Nel datastore ogni elenco si ordina, si filtra, si raggruppa, si confronta, si esporta in CSV (ciò che si vede) e conserva la vista nell'indirizzo. In advanced la tabella comune (`components/data-table-panel.tsx`) lo fa solo su comando dell'assistente.
- **Altro**: schermo intero nei disegni, attesa visibile anche sulle letture (`attesa-globale.tsx` copre solo le scritture), ricerca per significato con istogramma dei punteggi, guida «Aiuto» di pagina, contratti a una data.
- **Design**: confronto dal vivo con schermate affiancate in corso; i passi di design si aggiungono alla tabella quando arriva, senza fermare i primi passi.

Già coperto in advanced, non si rifà: corsie e grafo dei processi, Gantt, organigrammi con Esporta SVG, coda dell'agente con previsione di spesa, navigatore delle tassonomie, contratti del tenant con lacune, consolidamento e confronto corse, Ctrl+K, menu senza ricarica, schede nell'indirizzo, stato dei servizi, riordino della barra laterale (PR #369).

## 3. I passi

Ordine raccomandato: prima ciò che Enzo ha indicato come più visibile (processi), poi la cascata un tipo alla volta, poi le tabelle una funzione alla volta.

| # | passo (uno per PR, poche ore) | dove si vede | come si prova dal browser | stato |
|---|---|---|---|---|
| P1 | Mappa processi × unità: righe i processi, colonne le unità, R/E/C nelle celle, conteggio E/C, nome intero dell'unità al passaggio, clic sul processo che ne apre la scheda | `/tenant-processes`, nuova scheda «Mappa» | Come Valentina Conti: apri Processi, scheda Mappa; leggi chi è responsabile di un processo, passa sopra un'intestazione, clicca un processo | **primo passo** |
| P2 | Diagramma per fasi nella scheda del processo, accanto a corsie e grafo | `/tenant-processes/[id]` | Apri un processo con fasi: diagramma, schermo pieno della modale, Esporta SVG | da fare |
| P3 | Cascata: la scheda del **processo** (quadro, unità coinvolte con il loro ruolo, attività, diagrammi) apribile ovunque compaia un processo, anche dentro altre schede | tutte le pagine che nominano un processo | Da una persona apri la sua unità, dall'unità un processo, dal processo un'altra unità: le schede si impilano, il filo riporta indietro | da fare |
| P4 | Cascata: **competenza** e **mansione** | Competenze, Posizioni, Faldone | Da una posizione apri una competenza richiesta e da lì le altre posizioni che la chiedono | da fare |
| P5 | Cascata: **obiettivo** e **KPI** | Obiettivi, KPI, scheda del processo | Da un processo apri un obiettivo e la sua metrica | da fare |
| P6 | Cascata: **livello del contratto** | Contratti del tenant, persone | Da una persona apri il suo livello e i minimi | da fare |
| P7 | Cascata: **progetto** e fase | Progetti, Faldone | Da una persona apri un suo progetto e una fase | da fare |
| P8 | Identificativi cliccabili da sé: ogni nome di oggetto noto, anche nel testo libero e dentro le schede, diventa apribile senza scriverlo pagina per pagina | trasversale | Apri una scheda con testo descrittivo: i nomi citati si aprono | da fare |
| P9 | Schermo intero nei disegni (organigrammi, processi, Gantt), Esc per uscire | area navigabile comune | Apri organigramma e un processo, «Schermo intero» | da fare |
| P10 | Tabelle: ordinare cliccando l'intestazione (la stessa vista che usa l'assistente) | tutte le tabelle | Su Utenti ordina per cognome e poi chiedi all'assistente un altro ordine | da fare |
| P11 | Tabelle: filtro con casella di testo e «righe 1–25 di 312» | tutte le tabelle | Su Utenti filtra «Milano» | da fare |
| P12 | Tabelle: esporta in CSV ciò che si vede | tutte le tabelle | Esporta dopo un filtro: il file ha solo le righe filtrate | da fare |
| P13 | Tabelle: vista conservata nell'indirizzo | tutte le tabelle | Copia l'indirizzo, riaprilo: stessa vista | da fare |
| P14 | Tabelle: raggruppa per una colonna | tutte le tabelle | Su Posizioni raggruppa per unità | da fare |
| P15 | Metti a confronto due o più righe | tutte le tabelle | Su Posizioni spunta tre righe, «Confronta» | da fare |
| P16 | Attesa visibile anche quando la pagina legge (barra in cima, segno al centro dopo mezzo secondo) | trasversale | Rete lenta in DevTools: si vede sempre il lavoro in corso | da fare |
| P17 | Ricerca per significato: istogramma dei punteggi con taglio mobile | Competenze | Cerca una frase e sposta il taglio | da fare |
| P18 | Guida «Aiuto» in finestra, letta anche dall'assistente: prima pagina Consolidamento | Consolidamento | «Aiuto» accanto al titolo, poi una domanda all'assistente | da fare |
| P19 | Contratti: minimi a una data e tranche del rinnovo (prima si verifica che i dati ci siano) | Contratti del tenant | Scegli una data passata | da fare |
| P20 | Catena della costruzione del tenant per livelli, con dipendenze e rifacimenti a catena | Costruzione del blueprint | Clic su un passo: da chi dipende, chi lo usa | da decidere (tocca il consolidamento) |
| D1–D6 | Passi di design: vedi sezione 7 | — | — | D1–D4 pronti per l'esecuzione; D5–D6 dopo le schermate di advanced |

## 4. Come si chiude un passo

1. In apertura si ricontrolla che il passo manchi ancora e che i dati ci siano (se mancano, il passo lo dice subito a Enzo invece di partire).
2. Una PR con le prove viste rosse prima e verdi dopo; CI verde; unione.
3. Rilascio armato dal thread «Verificare e correggere tutte le pagine di advanced», esito con `scripts/verifica-deploy.sh`.
4. Prova dal vivo in produzione con la persona indicata; esito, ora e link scritti nella sezione 5.
5. Link a Enzo per vederlo; il passo seguente parte in un thread nuovo.

## 5. Esiti dei passi

(vuoto)

## 6. Confronto passo per passo con la corsa della banca (lavoro continuo)

Metodo chiesto da Enzo il 2026-11-21: si parte dal datastore, che ha meno dati e una forma chiusa, e si percorre la corsa della banca passo per passo; per ogni passo si guarda che cosa mostra il pannello a destra e con quale logica, si cercano le pagine di advanced che trattano le stesse informazioni e si decide l'esito. Correzioni al metodo: le parti trasversali (scheda a cascata, tabelle, area dei disegni) si costruiscono una volta sola, la prima volta che servono; l'ordine di esecuzione segue il valore visibile, non l'ordine della corsa. Esiti possibili: **integrare** (advanced ha la pagina, manca una parte), **sostituire** (la soluzione del datastore è migliore e prende il posto), **implementare** (advanced non ha niente), **equivalente**, **non applicabile** (strumento di chi costruisce il modello, senza controparte nel tenant).

Quanti passi: la lista è una sola, `src/passi/forma_del_banco.ts` del datastore, `PASSI_DELLA_CASCATA`: 31 passi; le corse del contratto v0.2 (come quella della banca del 10/10) ne hanno 25, senza `strategia`, `capability`, `mestieri`, `decisioni`, `agenti`, `principi`.

Regole aggiunte dopo la revisione critica del metodo (2026-11-21):
- il confronto è **a due vie**: se advanced è già pari o migliore non si tocca; se le due soluzioni divergono decide Enzo; a fine giro si fa anche il giro inverso, le pagine di advanced che non corrispondono a nessun passo;
- ogni riga dice anche **da dove arrivano i dati** (rotta del datastore e rotta `/v1` di advanced): una vista portata senza la sua fonte dati in advanced è inutile, e quel caso diventa un'indagine prima del passo;
- i passi esecutivi restano piccoli, come vuole Enzo, ma due passi che cadono sulla stessa pagina di advanced si possono unire in una PR se insieme restano di poche ore: la CI ha un solo esecutore e ogni PR costa la sua coda;
- formato fissato con un pilota su due passi della corsa (uno semplice, uno complesso), poi esteso a tutti.

### 6.1 La logica comune del pannello di una corsa

Da `apps/console/src/app/traccia-datastore/corsa/[id]/vista.tsx`, uguale per ogni passo: la barra dei passi con lo stato di ciascuno; il titolo «n. passo — stato»; una scheda «Riepilogo» con i fatti del passo, da quali passi dipende e quali lo usano; **una scheda per ogni elenco** che il passo produce, con filtro; il **dettaglio della riga fisso a lato** (l'elenco resta visibile); i valori annidati che si aprono a richiesta; i **valori che nominano un oggetto di un altro passo diventano collegamenti** a quel passo, già filtrato su quell'oggetto; le schede «Organigramma» e «Mappa e diagrammi» dove il passo ha unità o processi; passo, scheda e filtro nell'indirizzo, con il tasto Indietro del browser che ripercorre il cammino. Nel banco (`apps/banco/public/ispeziona.mjs`) in più ogni identificativo nel testo diventa una scheda a cascata.

Che cosa vuol dire per advanced: la «cascata» del datastore ha **due forme**, la finestra sopra la finestra (che advanced ha per tre tipi) e il **salto all'elenco filtrato** di un altro dominio con il dettaglio a lato (che advanced non ha). I passi P3–P8 coprono la prima; per la seconda serve un passo trasversale in più (P21 qui sotto).

### 6.2 La tabella dei passi

Prima stesura dal codice di entrambi i repo, 2026-11-21; ogni riga si verifica dal vivo prima di diventare un passo esecutivo, e la colonna «stato» dice a che punto è. Il rilievo dal vivo della sezione 6.3 (2026-11-21 sera) verifica la colonna «che cosa mostra» per tutti i 25 passi presenti: dove le due sezioni divergono vale la 6.3. Attenzione alla numerazione: qui «# corsa» è l'ordine v0.2 (1–25), la console numera sulla barra a 31 (tabella di corrispondenza nella 6.3).

| # corsa | passo del datastore | che cosa mostra | pagine di advanced con le stesse informazioni | esito | passo della mappa | stato |
|---|---|---|---|---|---|---|
| 1 | Attività (ATECO) | codici ATECO dell'impresa con NACE e fonti | `/tenants/[id]`, `/tenants/[id]/enterprise-typing`, `/tassonomie` (settori) | integrare: la voce ATECO del tenant apribile a cascata con il suo ramo e le fonti | P4-bis | rilevato dal vivo; lato advanced da verificare |
| 2 | Classe e sedi | classe dimensionale, addetti, sedi | `/tenants/[id]/enterprise-typing`, `/organization` | integrare: sedi come oggetti apribili (unità e persone per sede) | da aprire | rilevato dal vivo; lato advanced da verificare |
| 3 | CCNL e istituti | contratti, livelli, minimi, istituti, fonti, riscontro dei minimi | scheda Contratti di `/tenants/[id]` | integrare: istituti, fonti, minimi a una data, tranche | P19 | rilevato dal vivo; lato advanced da verificare |
| 4 | Processi di business | elenco con tipo, codice APQC, sedi, motivo, fonti; **mappa processi × unità R/E/C** | `/tenant-processes`, `/processes`, `/process-owner` | implementare la mappa; integrare motivo e fonti | **P1** (in corso in un thread a parte), P3 | in corso |
| 5 | Unità organizzative | unità con genere, sede, processi e ruolo nel processo | `/organization`, scheda unità a cascata | integrare: nella scheda dell'unità i processi con R/E/C e i ruoli | P3 | rilevato dal vivo; lato advanced da verificare |
| 6 | Organigramma | albero con padre, livello, addetti; disegno | `/organization/org-chart` | equivalente (piano organigrammi del 14–15/11) | — | rilevato dal vivo; lato advanced da verificare |
| 7 | Obblighi normativi | norme, ambito, figure dovute | nessuna pagina trovata | dati solo nel modello (`sys_blueprint_content_obligations`), dipende dal consolidamento (6.3) | P23 | rilevato dal vivo |
| 8 | Ruoli organizzativi | ruoli con unità, livello, persone, processi presidiati | `/positions`, `/job-catalog`, scheda posizione | integrare: la scheda della posizione con processi presidiati, livello, competenze, criticità | P4 | rilevato dal vivo; lato advanced da verificare |
| 9 | Copertura degli obblighi | per obbligo le posizioni che lo coprono e il ruolo mancante | nessuna | come il 7: dati solo nel modello, dipende dal consolidamento | P23 | rilevato dal vivo |
| 10 | Livello CCNL per ruolo | livello, categoria e motivo per ogni ruolo | scheda Contratti (persone per livello), `/positions` | integrare: il livello come oggetto apribile | P6 | rilevato dal vivo; lato advanced da verificare |
| 11 | Fasi dei processi | fasi per processo; diagramma per fasi | `/tenant-processes/[id]` | implementare il diagramma per fasi | P2 | da fare |
| 12 | Skill per ruolo | competenze ESCO per ruolo, essenziali o facoltative | `/positions/[id]/skills`, `/skills`, `/gaps` | integrare: competenza apribile a cascata | P4 | rilevato dal vivo; lato advanced da verificare |
| 13 | Obiettivi | terne processo-unità-ruolo e obiettivi | `/goals`, `/okrs`, `/performance` | integrare: obiettivo legato a processo e unità, apribile | P5 | rilevato dal vivo; lato advanced da verificare |
| 14 | Metriche | indicatori per obiettivo | `/kpis`, `/admin/catalogo-kpi`, `/positions/[id]/kpis` | integrare | P5 | rilevato dal vivo; lato advanced da verificare |
| 15 | Campi derivati | riporti e campi calcolati | linee di riporto nella scheda posizione | non applicabile come pagina; i riporti sono già nella scheda | — | rilevato dal vivo; lato advanced da verificare |
| 16 | Bersagli degli indicatori | valori obiettivo per indicatore | `/kpis` | integrare | P5 | rilevato dal vivo; lato advanced da verificare |
| 17 | Formazione | percorsi per ruolo | `/learning`, `/learning/training-initiatives`, `/positions/[id]/learning` | da confrontare dal vivo | — | rilevato dal vivo; lato advanced da verificare |
| 18 | Carriere | percorsi di carriera | `/career-succession`, `/me/career` | da confrontare dal vivo | — | rilevato dal vivo; lato advanced da verificare |
| 19 | Incentivi e welfare | incentivi e welfare per categoria | nessuna pagina trovata | dati solo nel modello (`sys_blueprint_content_incentives`), dipende dal consolidamento (6.3) | P24 | rilevato dal vivo |
| 20 | Flussi di commessa | flussi di lavoro per commessa | `/projects` (solo in parte) | da confrontare con `/projects`: la corsa ha 4 flussi bancari reali (6.3) | da aprire | rilevato dal vivo |
| 21 | Criticità dei ruoli | criticità e motivo per ruolo | `/positions` (colonna), `/talent-review`, `/insights/succession-readiness` | integrare nella scheda della posizione | P4 | rilevato dal vivo; lato advanced da verificare |
| 22 | Condizioni degli istituti CCNL | condizioni per istituto | scheda Contratti | integrare insieme al 3 | P19 | rilevato dal vivo; lato advanced da verificare |
| 23 | Traduzioni in inglese | testi in inglese | — | non applicabile (advanced è in italiano) | — | chiuso |
| 24 | Prove di lettura | verifiche di costruzione | `/consolidation` (in parte) | non applicabile come pagina del tenant | — | rilevato dal vivo; lato advanced da verificare |
| 25 | Pacchetto per advanced | il pacchetto che advanced importa | `/tenant-blueprints`, `/consolidation` | equivalente | — | rilevato dal vivo; lato advanced da verificare |
| v0.3 | Strategia | strategia dell'impresa | `/org-director`, `/org-director/vrio` | da confrontare su una corsa a 31 passi | — | indagine |
| v0.3 | Capability | capacità e maturità | `/org-director` (ricalcolo capacità e maturità) | da confrontare | — | indagine |
| v0.3 | Mestieri | mestieri per competenze | `/job-catalog` | da confrontare | — | indagine |
| v0.3 | Decisioni | decisioni per processo | nessuna trovata | indagine | — | indagine |
| v0.3 | Agenti | agenti previsti per processo | `/admin/agent-capabilities` | da confrontare | — | indagine |
| v0.3 | Principi | principi dell'organizzazione | nessuna trovata | indagine | — | indagine |

Passi della mappa nati da questo confronto, da aggiungere alla sezione 3 quando arrivano al loro turno: **P21** salto all'elenco filtrato con il dettaglio della riga a lato (seconda forma della cascata); **P22** sedi come oggetti apribili; **P23** obblighi normativi e copertura (se i dati ci sono); **P24** incentivi e welfare (se i dati ci sono).

### 6.3 Rilievo dal vivo della corsa della banca (2026-11-21)

Fonte: rilievo fatto sulla VM con il browser sulla console (porta 3107), corsa `p20261010010521tjb` (banca retail, 10/10/2026), consegnato in Drive `gdrive-hr:Heuresys/revisione-frontend-20261121/`: `passi.tsv` (104 righe, una per passo e scheda), `LEGGIMI.txt`, `schermate/` (105 immagini 1440×900). Le altre due corse della banca (`p20261006161114sbx`, `p20261004222646792`) hanno gli stessi 25 passi su 25.

**Numerazione.** La barra mostra 31 caselle; la corsa ne ha 25 e le sei vuote sono i passi v0.3. Corrispondenza «v0.2 → barra»: 1→1, 2→2, 3→4, 4→5, 5→7, 6→8, 7→9, 8→10, 9→11, 10→12, 11→13, 12→14, 13→16, 14→18, 15→19, 16→20, 17→21, 18→22, 19→23, 20→24, 21→25, 22→26, 23→29, 24→30, 25→31. Le caselle 3, 6, 15, 17, 27, 28 sono i passi v0.3 (strategia, capability, mestieri, decisioni, agenti, principi), vuote su tutte e tre le corse: le sei righe v0.3 della tabella 6.2 restano senza un caso dal vivo finché non esiste una corsa a 31.

**Che cosa è risultato vero, e che cosa correggere nella 6.1.**
- La struttura è identica per tutti i passi: «Riepilogo» (fatti: stato, durata, costo, chiamate, chiuso, origine; avvisi; bottoni verso i passi collegati, da 2 a 20), una scheda per tabella con il conteggio, «Esecuzioni». In più «Organigramma» (31 riquadri SVG, schermo intero, esporta SVG) nei passi unità e organigramma, e «Mappa e diagrammi» (30 processi) nei passi processi e fasi.
- **Il dettaglio della riga non è una finestra modale**: è un pannello fisso a destra, con tutti i campi della riga (da 2 a 369), gli elenchi annidati chiusi e, per i valori complessi, il JSON grezzo.
- **La cascata della corsa è il salto, non la finestra sopra la finestra**: un valore che è un codice di un altro passo (R001, U01, P01, O001, M001, OBB_…, FOR_…, CAR_…, INC_…, COM_…) porta a quel passo, apre la tabella filtrata e seleziona la riga. Profondità 1 per salto, ma i salti si concatenano e il tasto Indietro del browser ripercorre il cammino. Provato su 22 tabelle.
- **L'unica finestra modale** è nella Mappa: il clic su un processo apre il diagramma per fasi con le corsie dei ruoli, con precedente/successivo, schermo intero ed esporta SVG; non apre altre finestre dentro di sé.
- La finestra sopra la finestra con 8 tipi di oggetto è del **banco** (`ispeziona.mjs`), non della corsa. Quindi il modello di ispezionabilità da portare in advanced è la **somma** delle due: la scheda a cascata del banco (P3–P8) e il salto all'elenco filtrato della corsa (P21).
- **Limiti della corsa da non copiare**: i valori-codice cliccabili visibili sono pochi (da 0 a 5 per riga), il resto sta negli elenchi chiusi (167 nel caso degli incentivi, 34 nelle commesse); i nomi dei campi sono quelli tecnici (`senzaRiscontro`, `gradoAziendale`, `occupazioniEsco`); i valori complessi sono in JSON grezzo. In advanced queste tre cose violano le regole dell'interfaccia (niente sigle, solo italiano, dati leggibili): si porta la logica, non la resa.
- Grafici: solo SVG (organigramma, fasi, corsie dei ruoli) e la matrice processi × unità con E/C.
- Dati: la console legge `/dati/corsa/<id>/passo/<chiave>[?tabella&pagina&q&ordina&verso]` e `/dati/corsa/<id>/processi`; a monte il servizio 3101 (`/v1/banco/prototipi`, `/banco/api/datastore/prototipi/<id>`, `/banco/api/datastore/stato?prototipo=`, `/v1/banco/pacchetto/sezioni-v03`).

**Che cosa contiene ogni passo** (righe per tabella, corsa della banca; tra parentesi i campi del dettaglio):

| barra | passo | tabelle (righe) | salto provato | nota per advanced |
|---|---|---|---|---|
| 1 | Attività (ATECO) | proposte 3 (8), domande 0 | — | confronto con la scheda ATECO del tenant |
| 2 | Classe e sedi | sedi 5 (4) | — | le sedi sono un elenco piatto anche qui: P22 resta valido ma non ha un modello da copiare |
| 4 | CCNL e istituti | ccnl 2 (144, 8 elenchi) | — | 144 campi in JSON: in advanced serve una vista per livelli, minimi e istituti (P19) |
| 5 | Processi | processi 30 (15); Mappa 30 | P01 → processi | P1 (matrice) e P2 (diagramma) confermati |
| 7 | Unità | unità 31 (17); Organigramma 31 | U01 → organigramma | |
| 8 | Organigramma | unità 31 (26); Organigramma 31 | U01 → organigramma | equivalente in advanced |
| 9 | Obblighi | obblighi 20 (15) | OBB_SIC_RSPP → obblighi | dati presenti nel datastore |
| 10 | Ruoli | ruoli 109 (16), correzioniGerarchia 0 | R001 → ruoli | 5 codici cliccabili per riga, il più collegato |
| 11 | Copertura | obblighi 20 (17) | OBB_SIC_RSPP → obblighi | |
| 12 | Livello CCNL per ruolo | assegnazioni 109 (4), prepostiSuccursale 3 (6), due vuote | R001, R045 → ruoli | |
| 13 | Fasi | processi 30 (40); Mappa | P01 → processi | 14 codici per riga, quasi tutti chiusi |
| 14 | Skill per ruolo | perRuolo 109 (105) | R001 → ruoli | 105 campi per ruolo: base per P4 |
| 16 | Obiettivi | terne 125 (5), obiettivi 247 (10) | T001, O001 | la terna processo-unità-ruolo è il ponte per P5 |
| 18 | Metriche | metriche 327 (12) | M001 → metriche | |
| 19 | Campi derivati | riporto 109, pesiObiettivi 247, tipiCompetenze 443, responsabiliProcesso 30 | R001, P01 | |
| 20 | Bersagli | bersagli 327 (5) | M001 → metriche | |
| 21 | Formazione | moduli 30 (9) | FOR_RSPP_INIZIALE | i moduli rimandano agli obblighi |
| 22 | Carriere | percorsi 9 (14) | CAR_001 | |
| 23 | Incentivi e welfare | schemi 5 (13) | INC_VAP | 167 rimandi agli obiettivi, tutti chiusi |
| 24 | Commesse | commesse 4 (14) | COM_FIDO_RETAIL | 4 flussi bancari (es. fido retail): il passo **si applica** alla banca, la 6.2 lo dava per probabilmente non applicabile |
| 25 | Criticità | criticità 109 (3) | R001 → ruoli | |
| 26 | Condizioni istituti | ccnl 2 (129) | — | |
| 29 | Traduzioni | solo Riepilogo (4.482 valori) | — | non applicabile |
| 30 | Prove di lettura | prove 384 (4) | — | non applicabile come pagina del tenant |
| 31 | Pacchetto | 14 sezioni del pacchetto, conteggi 14, riferimentiRotti 16 | U01, P01, R001, O001, M001… | riferimentiRotti elenca le 16 categorie di controllo, tutte a 0 (`riferimentiRottiTotale` = 0 su questa e sulle altre corse della banca): nessun difetto. Da notare per advanced: una tabella di controlli a zero va mostrata come «0 su 16 controlli», non come 16 righe |

**Esito delle tre indagini aperte nella 6.2 (obblighi, copertura, incentivi).** I dati esistono nel datastore (20 obblighi, 5 schemi di incentivi) e il pacchetto li porta in advanced, ma in advanced arrivano solo **al livello del modello**: `sys.sys_blueprint_content_obligations`, `sys_blueprint_content_obligation_positions`, `sys_blueprint_content_incentives`, letti oggi solo dal consolidamento (`apps/api/src/modules/tenant-consolidation/sorgenti.ts`, `distanza.ts`). Nel tenant non c'è una tabella né una pagina. Quindi P23 e P24 non sono passi di interfaccia: prima serve portare obblighi e incentivi nel tenant (un gradino del consolidamento), poi la pagina. Restano in mappa come «dipende dal consolidamento».

**Correzioni alla 6.2 che ne discendono**: riga 20 (Flussi di commessa) da «probabilmente non applicabile» a «da confrontare con `/projects`: 4 flussi bancari reali»; righe 7, 9, 19 da «indagine» a «dati solo nel modello, dipende dal consolidamento»; tutte le altre righe da «da verificare dal vivo» a «rilevato dal vivo nel datastore; lato advanced da verificare con un login RTL».

## 7. Confronto di design (dal codice, 2026-11-21)

Base: i fogli di stile delle due interfacce (`heuresys-datastore/apps/console/src/app/globals.css`, `heuresys-datastore/apps/web/src/app/interazione.css`; `heuresys-advanced/apps/web/src/app/globals.css`, `theme-overrides.css`) e la schermata della finestra del processo. Le schermate dei pannelli dei passi del datastore vanno rifatte a pagina intera (quelle consegnate mostrano solo la cima della pagina: le schede di uno stesso passo hanno lo stesso peso in byte), e quelle di advanced arrivano dal thread delle pagine dopo il rilascio in corso: D5 e D6 si confermano su quelle.

**Che cosa è uguale.** Le due interfacce usano lo stesso design system (`@heuresys/ui`; console 1.4.0, advanced 1.6.0) e lo stesso tema di marca (`@heuresys/ui/theme`): colori, caratteri, spaziature di base, barra laterale e intestazione vengono dalla stessa libreria. La differenza di aspetto che si vede non nasce dai token: nasce da **quattro regole globali** che il datastore ha scritto nel proprio foglio di stile e advanced no, e da **come le pagine compongono** i pezzi.

**Le regole globali del datastore che advanced non ha.**
1. **Nessun testo troncato**: `.truncate` è neutralizzata per tutta l'interfaccia (il testo va a capo). In advanced la classe `truncate` compare 13 volte (2 nella vetrina) e 4 grafici tagliano le etichette (`grep -rn "truncate" --include=*.tsx apps/web/src`, 2026-11-21), tra cui la scheda a cascata (`components/scheda-rapida.tsx:110`), il menu laterale (`app/(authenticated)/layout.tsx:231`), il titolo dell'assistente e dell'ispettore, i membri del progetto; e i grafici tagliano le etichette degli assi (`overflow: "truncate"` in `analytics/skills`, `analytics/org-network`, `analytics/skills-by-category`). È già una regola UI di Enzo, quindi è un difetto, non una scelta di gusto.
2. **Tinta al passaggio del mouse su tutto ciò che si clicca o si ispeziona**, posata come strato sopra lo sfondo (un pulsante scuro si schiarisce, uno chiaro si scurisce), e nei disegni SVG il nodo si scurisce con un alone (regola dell'Amministratore di Sistema del 2026-10-26). Advanced dichiara che l'affordance al passaggio «è inclusa in `@heuresys/ui`»: da verificare dal vivo che copra anche righe di tabella, nodi dei disegni e valori cliccabili.
3. **La manina su ogni elemento cliccabile**, con un solo elenco di selettori (pulsanti, schede, voci di menu, collegamenti, righe con `cursor-pointer`, nodi SVG con `data-a`).
4. **La barra di attività** in cima su ogni attesa, letture comprese. In advanced compare solo sulle scritture (`components/attesa-globale.tsx`): è già il passo P16.

**Come compongono le pagine (dalla schermata della finestra del processo).**
- Sotto il titolo una **riga di fatti misurati** separati da «·» (es. «158 addetti · 5 sedi · 25 passi accettati su 25»; «1 unità coinvolte · 3 ruoli · 3 persone»), al posto delle schede di numeri grandi.
- Ogni disegno e ogni griglia di stati porta una **riga di legenda** sotto di sé, in parole («Riquadro pieno = fase eseguita…; tratteggio = unità consultata»; «Pieno: accettato · bordo spesso: aspetta una decisione · grigio: da rifare · tratteggiato: assente»). Lo stato si legge dalla forma del bordo (pieno, spesso, tratteggiato, grigio) e non dal colore: funziona in scala di grigi e in stampa.
- Ogni disegno ha la sua **barra con «Esporta SVG» e «Schermo intero»** in alto a destra.
- Disegni in **scala di grigi**: riquadri bianchi con bordo nero, corsia del responsabile in grigio, testo secondario grigio. Nessun colore di stato.
- Densità alta e tipografia piccola nei disegni, titoli in grassetto con codice e nome («P01 · Definizione del modello…»).

**Conferme dalle schermate rifatte a pagina intera (2026-11-21, 106 file).** Viste `10_ruoli_t-ruoli.png` e `5_processi_mappa.png`, oltre alla finestra del processo:
- le schede portano il **conteggio nel titolo** («ruoli (109)», «correzioniGerarchia (0)», «Esecuzioni (1)»), così una scheda vuota si riconosce prima di aprirla;
- la tabella è densa (righe da una linea, bordi sottili, nessuna ombra), con **ordinamento su ogni colonna** (simbolo ↕ nell'intestazione), filtro sopra, «righe 1-50 di 109» e «indietro / pagina 1 di 3 / avanti» **sopra e sotto** la tabella;
- il riquadro «Dettaglio» a destra, quando nessuna riga è scelta, **dice che cosa fare** («Scegli una riga della tabella per vederla intera qui») invece di restare vuoto;
- la matrice processi × unità ha le intestazioni delle unità **ruotate in verticale** con il nome intero, R pieno nero, E grigio, C tratteggiato, la colonna E/C con i conteggi e la legenda in parole sopra: è il modello visivo di P1;
- **difetti da non portare**: intestazioni in inglese o tecniche («Headcount», «correzioniGerarchia»), unità indicate con il codice (U01) invece che con il nome, livelli in maiuscolo («DIRIGENTE»), colonna «sì/no». In advanced tutte e quattro violano le regole dell'interfaccia.

**Passi di design.**

| Passo | Contenuto | Dove si vede | Come si prova | Stato |
|---|---|---|---|---|
| D1 | Nessun testo troncato: regola globale come nel datastore e tolti i `truncate` dei componenti; nei grafici le etichette vanno a capo invece di tagliarsi | ovunque; subito nella scheda a cascata, nel menu laterale e in `/analytics/skills` | una persona o un'etichetta lunga si legge per intero | pronto |
| D2 | Tinta al passaggio e manina su tutto ciò che si clicca, righe di tabella e nodi dei disegni compresi (se la libreria non li copre già) | `/positions`, `/organization/org-chart` | passando sopra una riga o un nodo cambia colore e compare la manina | pronto, prima la verifica dal vivo |
| D3 | Legenda in parole sotto ogni disegno e ogni griglia di stati | organigrammi, diagrammi dei processi, matrice di P1 | ogni disegno dice che cosa vuol dire pieno, tratteggiato, spesso | pronto; nasce con P1 e P2 e si estende agli altri disegni |
| D4 | «Esporta SVG» accanto a «Schermo intero» su ogni disegno | organigrammi, diagrammi dei processi | il file SVG si scarica e si apre | pronto; si unisce a P9 |
| D5 | Riga di fatti misurati sotto il titolo delle pagine di dettaglio (processo, unità, posizione) | `/tenant-processes/[id]`, `/positions/[id]` | sotto il titolo «N unità · N ruoli · N persone» | dopo le schermate di advanced |
| D7 | Conteggio nel titolo di ogni scheda («Posizioni (109)») e riquadro di dettaglio che, vuoto, dice che cosa fare | `/positions/[id]`, `/tenant-processes/[id]`, `/organization` | la scheda vuota mostra «(0)» prima di aprirla | pronto |
| D6 | Stato espresso dalla forma del bordo oltre che dalla parola, dove ci sono griglie di stati | tabelle con colonna stato, barre di avanzamento | in stampa in bianco e nero lo stato si distingue | dopo le schermate di advanced |
