# Forense frontend 15/11/2026 - Dati 1 (analytics, insights, dashboard, visualizations, kpis, okrs, gaps, compensation-intelligence, career-succession, talent-review, goals, performance)

Metodo: ogni numero e' stato letto dall'API di produzione come persona reale (PEOPLE_MANAGER paolo.barbieri = vista di tenant; MANAGER alice.esposito = vista di catena a 4 persone; CEO federica.marchetti; BRANCH_MANAGER alberto.serra; PROCESS_OWNER luca.bianchi) e rifatto dal database (transazione sola lettura). Tenant RTL Bank = 86ba7a65.... Un solo accesso per persona, poi tutte le GET nello stesso processo.

Limiti dichiarati. NON VERIFICATO: pagina `analytics/skills-graph` e `visualizations/[graphId]` (servono id scelti nell'interfaccia, il budget di accessi non bastava); famiglie di dashboard `hr`, `org`, `tenant`, `platform` (le persone che le aprono, Valentina Conti e gli amministratori, non hanno accesso derivato: il calcolo e' stato verificato leggendo `blocchi.ts` e rifacendo le query dal database, non dall'API). Nessuna schermata del browser: tutto da API, codice e database. I testi sono stati letti dai file `apps/web/src/locales/it/*.json`; i codici maiuscoli dentro frasi interpolate sono tradotti da `testoLeggibile`/`vocePerCodice` (apps/web/src/lib/i18n.ts), quindi NON sono un rilievo; lo sono invece le etichette che arrivano ai grafici senza passare da li (D11).

## 1. Copertura

Persone: PM = PEOPLE_MANAGER, MG = MANAGER, CEO, BM = BRANCH_MANAGER, PO = PROCESS_OWNER.

| pagina | numero / oggetto | API | database | esito |
|---|---|---|---|---|
| analytics/workforce | organico totale (PM) | 158 | 158 (STANDARD, tenant) | OK |
| analytics/workforce | unita con persone | 37 | 37 | OK |
| analytics/workforce | somma per unita | 158 | 158 | OK |
| analytics/workforce | ruoli distinti / somma per ruolo | 50 / 146 | 62 titoli distinti / 158 | DIFETTO D4 |
| analytics/workforce | organico (MG) | 4 (1 unita) | 4 | OK |
| analytics/kpi | target totali / KPI distinti | 356 / 80 | 356 / 80 | OK |
| analytics/kpi | KPI con raggiungimento calcolabile | 9 su 80 (target 245) | 245 target con valore consuntivo, 111 senza | OK numero, DIFETTO D14 (lettura) |
| analytics/kpi | raggiungimento medio (indicatore) | 92 | media non pesata dei 9 KPI = 92,02 | OK come calcolo, D14 |
| analytics/attendance | ore ordinarie / straordinario / totale | 874.941,74 / 12.748,98 / 887.690,72 | identiche | OK |
| analytics/attendance | mesi (2023-08..2026-11), righe 128.517 su 158 persone | 40 mesi | 40 | OK |
| analytics/overtime | richieste / ore | 12.625 / 12.998,08 | 12.625 / 12.998,08 | OK |
| analytics/overtime | per stato (APPROVED 12.447, PAID 162, REJECTED 16) | uguali | uguali | OK |
| analytics/overtime | compenso totale | 28.327,60 EUR | 28.327,60 = 25.228,70 pagate + 3.098,90 RESPINTE | DIFETTO D6 |
| analytics/compensation | profili / unita / mediana / min / max (PM) | 142 / 31 / 52.000 / 34.000 / 150.000 | tutto il tenant 157 / 37 / 65.000 / 34.000 / 220.000 | coerente col progetto (soglia ADR-0036 par.5), DIFETTO D16 (non dichiarato) |
| analytics/skills | evidenze / persone / unita | 902 / 156 / 37 | 902 / 156 / 37 | OK |
| analytics/skills | per livello (1/9/35/166/691) | uguali | uguali | OK, D18 plausibilita |
| analytics/skills-by-category | evidenze 902, 7 categorie, somma categorie 902 | uguali | uguali | OK |
| analytics/skills-group-share | competenze 57, raggruppate 19, gruppi 16 | 19 raggruppate | 57 / 19 / 16 | OK, D18 |
| insights (rischio di abbandono) | persone valutate (PM) | 167 | 158 persone + 9 utenze di servizio | DIFETTO D1 |
| insights (rischio di abbandono) | (MG) | 4 | 4 | OK |
| insights/skill-gap | righe (PM / MG) | 133 / 2 | non rifatto dal DB (tabella di punteggi calcolati, 133 persone distinte nel JSON) | NON VERIFICATO contro DB |
| insights/succession-readiness | righe (PM / MG) | 468 righe / 156 persone | 156 persone in sys_succession_readiness_scores | OK conteggio persone, DIFETTO D13 (468 righe) |
| dashboard | Utenti (PM) | 167 | 158 persone (+9 di servizio) | DIFETTO D1 |
| dashboard | Posizioni | 162 | 162 attive (158 occupate + 4 vacanti; 316 totali, 154 non attive) | OK, nota D19 |
| dashboard | Unita organizzative | 42 | 42 (37 con persone) | OK, nota D19 |
| dashboard | Percorsi formativi / Lacune formative | 50 / 270 | 50 / 270 | OK |
| dashboard | Blueprint / Reward proposte | 1 / 33 | 1 / 33 PROPOSED | OK |
| dashboard | (MG) utenti/posizioni/unita/lacune | 4 / 4 / 1 / 4 | 4 / 4 / 1 / 4 | OK |
| dashboard | (MG) percorsi 50, blueprint 1, reward proposte 33 | tenant intero | non di catena | DIFETTO D7 |
| dashboard | andamento a 8 settimane | tutti piatti | coerente con created_at | OK, D19 |
| dashboard | attivita recente | "Nuova persona: Collaudo ..." | utenze di servizio, per (MG) di altre catene | DIFETTO D2 |
| dashboard | gap critici/alti | 5 CRITICAL in cima | 5 CRITICAL | OK |
| dashboard/company (CEO) | persone, andamento | trattenuti (masked) | - | DIFETTO D8 |
| dashboard/company (CEO) | copertura competenze (15 righe), andamento valutazioni 2025-Q2/Q3/Q4 = 46/155/98 | coerente col codice | - | OK, D18 |
| dashboard/process (PO) | processi attivi (20 righe), approvazioni APPLIED 578 / APPROVED 138 / REJECTED 25 | uguali | uguali (nessuna PENDING) | OK numero, DIFETTO D10 |
| dashboard/process (PO) | attivita recenti | 15 righe SALARY_CHANGE | - | DIFETTO D9 |
| dashboard/branch (MG) | filiali | vuote (unita Gestione Rischi = DEPARTMENT) | - | DIFETTO D9 |
| dashboard/branch (BM) | organico filiale mascherato; attivita con ricalcoli retributivi aperti | - | - | DIFETTO D9 |
| dashboard/company hr (blocchi) | "Persone in servizio" / "Rapporti conclusi" | non leggibile via API | 158 / 140 (i 140 sono tutti anche attivi) | DIFETTO D5 (da DB) |
| dashboard/company | andamento organico (assegnazioni iniziate per mese) | non leggibile via API | 2024-12: 2 ... 2026-08: 135 | DIFETTO D5 (da DB) |
| kpis | KPI definiti 560 = 233 piattaforma + 327 azienda | 560 / 327 | 233 + 327 | OK |
| okrs | 15 (13 attivi, 2 annullati) | 15 | 15 | OK, DIFETTO D15 |
| goals | 2.189 (completati 1.034, ecc.) | 2.189 | 2.189 / 1.034 | OK |
| gaps | totale 270; CRITICAL 5, HIGH 118, MEDIUM 99, LOW 48 | uguali | uguali | OK, D20 |
| gaps (MG) | 4 | 4 | 4 | OK |
| compensation-intelligence | reward gate 3.283 (3.199 / 51 / 25 / 8) | uguali | uguali | OK |
| compensation-intelligence | raccomandazioni 116 (72/33/11), variabile 182 (1.050.609 EUR), fasce 12, passaggi in paghe 39 | uguali | uguali | OK |
| compensation-intelligence | pesi economici 24, pool bonus 6, regole 6 | uguali | non rifatti | NON VERIFICATO contro DB |
| career-succession | percorsi 15, bacini 11, candidati 22 (7/7/5/3 per orizzonte) | uguali | 15 / 11 / 22 | OK, D11, D12 |
| talent-review | nine-box 153, fit 146, prontezza 88, successione 88, posizioni critiche 11, copertura 8 | uguali | 153/146/88/88/11/8 | OK numeri, DIFETTO D3, D13 |
| talent-review (MG) | 3 / 3 / 2 / 2 / 11 / 8 | - | - | OK ma D3 |
| performance | cicli 1, calibrazioni 35, valutazioni (MG) 14 | 1 / 35 / 14 | 35 calibrazioni tenant | OK numero, DIFETTO D20 |
| visualizations | grafici 3 (tutti ORG_CHART), export 16 | 3 / 16 | non rifatto | OK per coerenza fra persone, D22 |
| tutte | permessi: (CEO) 403 su analytics, dashboard/widgets, goals, okrs, talent-review, performance | - | CEO ha 48 permessi, nessuno di questi | DIFETTO D8 |

Totale: 24 pagine nel perimetro (22 lette dall'API, 2 NON VERIFICATE), circa 110 numeri verificati.

## 2. Rilievi

### D1 - "Utenti 167" in dashboard e "167 persone valutate" in insights contro 158 persone
Gravita alta. Pagine: dashboard, insights (rischio di abbandono). Persona: PM (tenant).
Cosa si vede: la dashboard dice Utenti 167; insights dice "167 persone valutate", fra cui "Collaudo Persona", "Collaudo DPO", "Collaudo Governo" e altre sei. L'organico (analytics/workforce, che e' corretto) e' 158.
Cosa dovrebbe essere: 158, le persone. Le 9 utenze sono `user_type='SERVICE'` (email `@collaudo.invalid`).
Prova: `chiama-come paolo.barbieri@... /v1/dashboard/widgets` -> counters.users 167; `/v1/insights/flight-risk` -> 167 voci, 9 con nome "Collaudo ..."; SQL: `select user_type,count(*) from sys.sys_users where user_tenant_id='86ba7a65-...' group by 1` -> SERVICE 9, STANDARD 158. `analytics/repository.ts:77` ha gia' il filtro `ONLY_PEOPLE` con il commento che spiega proprio questo errore (V6), ma dashboard e insights non lo usano.
Causa: `apps/api/src/modules/dashboard/repository.ts:87` (tenant) e `:110` (piattaforma) `count(*) FROM sys.sys_users` senza `user_type <> 'SERVICE'`; il trend `users` (riga 447) uguale; `apps/api/src/modules/insights/repository.ts` (query su sys_users alle righe 105, 195, 441, 523) non filtra.
Correzione: usare lo stesso filtro `u.user_type <> 'SERVICE'` in dashboard (contatore, trend, attivita) e insights (calcolo e lettura); poi ricalcolare gli insights.

### D2 - "Attivita recente" della dashboard: utenze di servizio e persone di altre catene
Gravita alta. Pagina dashboard. Persone: MG (alice.esposito), PM.
Cosa si vede: "Nuova persona: Collaudo Data Steward", "Collaudo People Manager", ... (19/09/2026). Alice, responsabile di 4 persone, vede lo stesso elenco del tenant.
Dovrebbe essere: eventi reali di persone vere, nel perimetro di chi guarda (I19: niente delle catene sorelle). Inoltre "Nuova persona" in un tenant bancario che ha importato 158 persone mostra solo i nove account di collaudo come "ultimi".
Prova: `/v1/dashboard/widgets` come alice -> recentActivity[0..2] = Collaudo...; scope.kind TEAM.
Causa: `dashboard/repository.ts:244` (`getRecentActivity`) filtra solo `tenant_id`, ignora `teamPositionIds`, e non esclude SERVICE.
Correzione: escludere SERVICE, restringere a utenti/posizioni del perimetro per il ruolo di catena.

### D3 - "Copertura ruoli critici" non riguarda le posizioni critiche
Gravita alta. Pagina talent-review. Persone: PM, MG.
Cosa si vede: sezione "Posizioni critiche" con 11 posizioni (Direttore Generale, Direttore IT e Digital, ...) e sezione "Copertura ruoli critici" con 8 righe (Cassiere, Analista Rischio, Operatore Titoli, Sviluppatore Software...). Intersezione per positionId = 0. Copertura: pronti subito 0, a 6 mesi 0, a 1 anno 2 in tutto, mentre i candidati di successione hanno 5 "pronti subito"; 5 righe su 8 hanno punteggio vuoto.
Dovrebbe essere: la copertura calcolata sulle 11 posizioni critiche, coerente con i candidati.
Prova: confronto degli id dei due elenchi dal JSON di `/v1/talent-review/critical-positions` e `/critical-coverage` -> 11, 8, intersezione 0; SQL conferma 11 posizioni critiche distinte e 8 righe in `sys_critical_role_coverage_status` (`payload: coverage rollup from readiness_scores`).
Causa: i dati di `sys_critical_role_coverage_status` derivano da un rollup su posizioni diverse da `sys_critical_positions` (script di popolamento, non l'API); la pagina li affianca come se fossero la stessa cosa.
Correzione: rigenerare il rollup sulle posizioni critiche (oppure calcolarlo a vista) e mostrare "non calcolata" dove manca il punteggio.

### D4 - Organico per ruolo: tagliato a 50, la somma non torna
Gravita alta. Pagina analytics/workforce. Persona: PM.
Cosa si vede: indicatore "Ruoli 50" e grafico per ruolo la cui somma e' 146; il totale in alto e' 158.
Dovrebbe essere: 62 ruoli, somma 158 (oppure dichiarare "primi 50 su 62, altri 12 ruoli").
Prova: API byJobRole = 50 voci, somma 146; SQL `count(distinct position_title)` fra le posizioni attive = 62.
Causa: `analytics/repository.ts:128` `LIMIT 50`; `analytics/workforce/page.tsx` conta `d.byJobRole.length` come "Ruoli". In piu' i "ruoli" sono titoli di posizione, non ruoli (job role): "Responsabile Direzione Affari Legali e Societari" e' una posizione.
Correzione: togliere il limite (o aggiungere voce "Altri") e calcolare il contatore dal totale vero; chiamarli "Posizioni per titolo".

### D5 - "Rapporti conclusi 140" e "Andamento organico" non dicono la verita
Gravita alta. Pagina dashboard/company (e hr/organico). Persona: HR (non verificata via API, verificata da DB); il CEO oggi li vede trattenuti (D8).
Cosa si vede: "Persone in servizio 158; Rapporti conclusi 140". Andamento organico: 135 nuovi nel solo agosto 2026.
Dovrebbe essere: i rapporti conclusi sono 0 (nessuno e' uscito); i 140 sono persone con una assegnazione ENDED e una ACTIVE (cambi di posizione del consolidamento). L'"andamento organico" conta le assegnazioni iniziate per mese: non e' un organico, ed e' dominato dal picco del consolidamento.
Prova: SQL: assegnazioni ENDED 140 persone, tutte presenti anche fra le ACTIVE (140 su 140); assegnazioni iniziate 2026-08 = 135.
Causa: `dashboard/blocchi.ts:89-111` (`companyHeadcount`: ENDED letto come cessazione) e `companyAndamentoOrganico`; `hrOrganico` stesso errore (conta per stato di assegnazione).
Correzione: "cessati" = persone senza nessuna assegnazione attiva; andamento = organico cumulato per mese, non nuove assegnazioni; "Persone in servizio" con filtro SERVICE.

### D6 - Straordinario: compenso totale che somma anche le richieste respinte; nota falsa
Gravita media. Pagina analytics/overtime. Persona: PM.
Cosa si vede: "Compenso totale 28.327,60 EUR"; nota: le richieste e le ore lavorate sono "in larga parte disgiunte".
Dovrebbe essere: 25.228,70 (le pagate), oppure dichiarare che include 3.098,90 di richieste respinte; la nota e' falsa: le ore di straordinario richieste per mese coincidono con quelle registrate in presenze (2023-08: 171,5 e 171,5; 2023-09: 259 e 259) e a livello totale 12.998,08 contro 12.748,98.
Prova: byStatus: PAID 25.228,70 + REJECTED 3.098,90; confronto mese per mese dei due JSON.
Causa: `analytics/repository.ts:1007` somma su tutti gli stati; testo `analytics.json` overtime.monthlyNote.
Correzione: escludere REJECTED/CANCELLED dal compenso; riscrivere la nota ("sono le stesse ore viste da due fonti, non sommarle").

### D7 - Dashboard del responsabile di linea: contatori di scala diversa
Gravita media. Pagina dashboard. Persona: MG.
Cosa si vede: Utenti 4, Posizioni 4, Unita 1, Lacune 4, ma Percorsi formativi 50, Blueprint 1 e "Reward proposte 33" (tenant intero). La riga delle reward la vede chi non ha il permesso di aprire la pagina retribuzioni (403).
Prova: `/v1/dashboard/widgets` come alice; `/v1/compensation/distribution` come alice -> 403.
Causa: `dashboard/repository.ts:63-66` (percorsi) e `:142-155` (reward) usano il tenant anche con `teamPositionIds`.
Correzione: nascondere/azzerare i contatori senza perimetro di catena; mai mostrare le proposte retributive a chi non ha `compensation_intelligence:read`.

### D8 - L'Amministratore delegato non vede organico e analisi; testo con codice
Gravita media. Pagine analytics/*, dashboard, goals, okrs, talent-review, performance, dashboard/company. Persona: CEO.
Cosa si vede: 403 "Missing permission: analytics:view" (e dashboard:view, goals, okrs, talent-review, performance); nella dashboard "Azienda" le viste Persone e Andamento organico sono "trattenute": "Valori trattenuti: PERSONAL ti e' accessibile in forma mascherata... i valori richiedono un mandato che non hai", con il nome della classe PERSONAL in codice e come etichetta.
Dovrebbe essere: coerente con il ruolo (CEO ha `dashboard_company:view`, quindi l'intento e' vederla): o il CEO vede l'organico, o la pagina spiega in italiano che cosa non vede e perche'.
Prova: query ruoli/permessi: CEO ha 48 permessi, nessuno fra analytics:view, dashboard:view, goal/okr, talent; `/v1/dashboard/catalog/company/data` come CEO.
Causa: matrice permessi (db) e `dashboard/service.ts` (withheldReason, composta a riga ~232 con `v.dataClasses.join`); web `dashboard/[famiglia]/page.tsx` mostra i codici classe nei badge.
Correzione: decisione di prodotto sui permessi del CEO; tradurre le classi di dato.

### D9 - Cruscotti di famiglia: mascherature incoerenti e viste vuote senza motivo
Gravita media. Pagine dashboard/branch, dashboard/process.
(a) Il BRANCH_MANAGER vede "Organico filiale" trattenuto, ma "Attivita filiale" mostra eventi come "Ricalcolo della retribuzione: livello tabellare, scatti di anzianita..." (SALARY_CHANGE) e "Riallineamento di livello": eventi di classe retributiva aperti mentre l'organico e' chiuso.
(b) Il PROCESS_OWNER vede 15 eventi, tutti SALARY_CHANGE del 15/04/2026 ("Retribuzione dirigenziale per fascia (Direttore Generale)..."): in una vista "attivita recenti di processo" compaiono scelte retributive dei vertici.
(c) alice (MANAGER) apre la dashboard Filiale e ottiene due schede "Nessuna riga nel tuo perimetro" perche' la sua unita e' un DEPARTMENT, non una filiale: nessuna spiegazione.
Causa: `blocchi.ts` (`branchAttivita`, `processAttivitaRecenti`) leggono `sys_user_timeline_events` senza filtrare per tipo/classe; `CTE_FILIALI` limita a `organization_unit_type='BRANCH'`.
Correzione: escludere i tipi retributivi o mascherarli come la classe COMPENSATION; testo "Questa dashboard riguarda le filiali: non ne governi nessuna".

### D10 - "Approvazioni in coda" non contiene nessuna approvazione in coda
Gravita media. Pagina dashboard/process. Persona: PO.
Mostra APPLIED 578, APPROVED 138, REJECTED 25: sono tutte concluse (0 PENDING). Il titolo promette una coda.
Causa: `blocchi.ts` `processApprovazioniInCoda` raggruppa tutti gli stati. Correzione: rinominare "Approvazioni per esito" o filtrare PENDING (e dire "nessuna in attesa").

### D11 - Grafici con etichette inglesi in maiuscolo
Gravita media. Pagine analytics/skills, skills-by-category, career-succession. Persona: PM.
Asse "NOVICE / BASIC / COMPETENT / PROFICIENT / EXPERT" (heatmap e barre) e asse del grafico dei candidati "READY 1 YEAR, READY 2 YEARS, READY NOW, READY 6 MONTHS" in ordine alfabetico, non temporale. Le etichette nei grafici non passano dalla traduzione (`_charts-client.tsx` non traduce le categorie); le traduzioni esistono (`common.json` enums, es. NOVICE = "Principiante").
Causa: `analytics/skills/page.tsx:20,87`, `skills-by-category/page.tsx:21`, `career-succession/page.tsx:92` (`.replace(/_/g," ")`).
Correzione: tradurre con `useEnumLabel` e ordinare per orizzonte.

### D12 - Codici interni della corsa dentro testi per l'utente
Gravita media. Pagine career-succession, talent-review. 
"Percorso della corsa p20261010010521tjb applicato a RTL Bank" e' la descrizione di 8 percorsi di carriera; "Criticita' CRITICAL del posto della corsa p20261010010521tjb" e' la motivazione di 3 posizioni critiche; i bacini si chiamano `LEGACY_SPLAN::<uuid>`, i percorsi `LEGACY_CP::<uuid>` e `CAR-TJB-00x` (codici in colonna "Codice").
Prova: `/v1/career-paths`, `/v1/talent-review/critical-positions`. Causa: dati scritti da script di import (`description`, `rationale`). Correzione: sostituire i testi con frasi per la persona; nascondere il codice interno come da R4.

### D13 - Tre numeri diversi di "prontezza alla successione" senza spiegazione
Gravita media. Pagine career-succession (22 candidati), talent-review (prontezza 88 / successione 88), insights/succession-readiness (468 righe).
Le tre fonti sono diverse (candidati nominati nei bacini; punteggi importati; calcolo del modello) e nessuna pagina dice quale e' quale. Nel calcolo del modello la stessa persona compare piu' volte (468 righe per 156 persone, fino a 3 posizioni): titolo "persone" fuorviante; 425 su 468 sono "pronti a 6 mesi" (91%), poco plausibile.
Correzione: una frase di spiegazione per fonte; contare persone distinte.

### D14 - Analisi KPI: 71 KPI su 80 a 0% e indicatore medio su 9
Gravita media. Pagina analytics/kpi. 
Il grafico mostra 80 barre di cui 71 a 0% ("n/d" in nota piccola) e il misuratore dice 92%: media non pesata di soli 9 KPI (356 target, 111 senza valore consuntivo). KPI senza dato appaiono come 0%, che e' un numero falso. Non ho verificato se la polarita (piu basso e meglio) e' rispettata: il calcolo e' `actual/target*100` per tutti.
Causa: `analytics/kpi/page.tsx` (`avgAchievementPct ?? 0`), `analytics/repository.ts` getKpiAchievement. Correzione: mostrare solo i KPI misurati, dire "9 KPI su 80 hanno un valore"; usare la polarita.

### D15 - OKR: tutti dell'ultimo trimestre 2024, "attivi" e scaduti; titoli inglesi
Gravita media. Pagina okrs. 13 OKR ACTIVE con periodo 01/10/2024-31/12/2024 (oggi 15/11/2026); nessun responsabile; titoli come "Launch mobile banking app v3.0", "Implement AI-powered fraud detection", "Launch D2C e-commerce platform", "Ottenere la certificazione B Corp", "Lanciare una linea di prodotti sostenibili con 15 articoli" (poco plausibili per una banca). La colonna reparto non c'e' (nel dato: DIV-CFO, DIR-DEV, Digital).
Correzione: dati (stato scaduto), non codice; in pagina mostrare "periodo concluso".

### D16 - Analisi retributiva: perimetro ridotto non dichiarato
Gravita media. Pagina analytics/compensation. Per PEOPLE_MANAGER 142 profili / 31 unita / massimo 150.000 / mediana 52.000; l'organico della pagina accanto mostra 37 unita; nel database i profili sono 157 con massimo 220.000 e mediana 65.000. La differenza e' voluta (`analytics/service.ts` `unitaEscluse`, ADR-0036 par.5) ma la pagina non lo dice: due persone dello stesso ufficio HR leggono numeri diversi senza motivo visibile.
Correzione: riga "Sono escluse le unita di vertice per il tuo livello".

### D17 - Gergo e inglese nelle etichette (testi letti da locales/it)
Gravita media. analytics.json: "Headcount totale", "OU", "Span medio", "Span of control", "Raggio organizzativo", "mid banda", "Cluster ESCO", "Gruppi ESCO"; admin.json: "Insights - rischio di abbandono", "flight-risk", "esplicabile per feature", "norm 50 - peso 20% - contrib 10", "Griglia 9-box", "Fit di posizione", "Edge", "Renderer Mermaid", "Reward proposte", "Tenant", "Blueprint", "Gap critici/alti"; hr.json: "reward gate", "Pipeline readiness", "pool", "Candidati alla succession", "Metrologia", "Polarita", "Check-in". Nessuna spiegazione di cosa misura ciascun numero (per es. "Mediana banda" e' il punto medio della banda, non lo stipendio).
Correzione: riscrivere in italiano comune (organico, unita, quanti riportano a un responsabile, rischio di uscita, "da 0 a 100: piu alto = piu rischio") e una frase sotto ogni grafico.

### D18 - Plausibilita bancaria dei dati
Gravita bassa/media. 691 evidenze di competenza su 902 (77%) sono "Esperto" (nessuna persona e' "Principiante" tranne 1); competenze come "materiali avanzati" (54 persone esperte) e ESCO "servizi militari e della difesa", "trasporti" fra i gruppi di una banca; sette gruppi senza nome, mostrati con codice grezzo ("skill/S4.3.1"); straordinario 98,6% "APPROVED" mai pagato, picco di 1.729 richieste a novembre 2025; 9-box con soli 4 riquadri occupati su 9 (STAR 40 = 26%).
Dato, non codice: da decidere se ripulire la base RTL.

### D19 - Dashboard: dettagli minori
Gravita bassa. Posizioni 162 (4 vacanti) contro persone 158 e unita 42 (5 senza persone): nessuna nota; la freccia "vs settimana prec." e' sempre piatta (8 settimane di valore costante) perche' il trend e' fatto sui created_at del consolidamento; "Posizioni" non dice "attive".

### D20 - Gap, calibrazioni, valutazioni
Gravita bassa/media. Gap: tutte le 270 righe senza competenza e senza posizione, e colonne Richiesto/Attuale sempre "-" (le competenze sono dentro `skillGaps` e sono scritte in inglese: "Data Analysis", "Customer Insight"). Calibrazioni: il MANAGER di 4 persone vede tutte le 35 del tenant (reparti "Marketing", "Banca Commerciale"...), le 9 "programmate" sono tutte nel passato (da 12/2025), luoghi in inglese ("Meeting Room A", "Milan HQ - Auditorium"); l'unico ciclo ("Valutazione annuale 2026") e' in bozza con scadenze gia' passate (30/09 e 31/10/2026).

### D21 - Visualizzazioni
Gravita bassa. Tre "grafici" tutti di tipo ORG_CHART con lo stesso codice `RTL_ORG_CHART` (versioni 1, 2, 3; due non attive) e descrizione tecnica "Org chart live derivato dalle posizioni (reports_to)"; il grafico "Distribuzione per tipo" ha una sola barra (ORG_CHART 3).

## 3. Per il thread organigrammi
- `visualizations` elenca tre versioni del medesimo organigramma (RTL_ORG_CHART v1, v2, v3); solo v3 e' attiva; descrizione con "reports_to".
- `/v1/analytics/org-network` non e' stato aperto (escluso); ma `analytics/repository.ts` (getOrgNetwork) conta anche le posizioni non attive e usa l'etichetta inglese "(unassigned)" per le unita mancanti; la pagina usa "Span of control" (analytics.json orgNetwork).
- Il conteggio persone dell'organigramma va confrontato con 158 (non 167): vedi D1.
