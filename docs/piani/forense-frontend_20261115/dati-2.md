# Dati 2: portale personale me/* (tranne me/org-chart), controllo forense del 15 novembre 2026

Metodo: per ogni pagina letto il sorgente (apps/web/src/app/(authenticated)/me), chiamato l'API di produzione come la persona (un solo accesso per persona, tutte le GET nello stesso processo), rifatto il dato dal database in sola lettura (tabelle sys.sys_*). Persone: Alberto Colombo (TEAM_MEMBER) e Alice Esposito (MANAGER) su tutte le rotte di dati; Alberto Serra (direttore di filiale) e Federica Marchetti (CEO) solo su profilo, team, approvazioni, inbox, KPI, analisi, lacune, corsi, sondaggi. Non eseguite per Paolo Barbieri e Laura Santoro (NON VERIFICATO: limite di 10 accessi ogni 5 minuti condiviso con le altre indagini). Non verificato nel browser: i rilievi vengono da sorgente + risposta API + database, non da schermate. Non eseguite le azioni di scrittura (form ferie, autovalutazione, obiettivo di carriera, iscrizione, MFA, risposta ai sondaggi, delega).

## 1. Copertura pagina x persona x dato

Esito: OK = valore API = valore database e sensato; RIL = rilievo D2-nn; NV = non verificato.

| pagina | dato | persona | valore API | valore database | esito |
|---|---|---|---|---|---|
| me | posizione principale | Colombo | Specialista Sviluppo Commerciale (POS-DIR-COORD-SPCO-1) | assegnazione PRIMARY ACTIVE dal 04/08/2026 | OK (codice nel sottotitolo: D2-10) |
| me | ruoli | Colombo | USER, TEAM_MEMBER | idem | RIL D2-10 (codici) |
| me | corsi | Colombo | 20 | 20 assegnazioni (17 completate) | OK conteggio, RIL D2-21 (conta anche i completati) |
| me | lacune | Colombo / Serra | 0 / 2 | 0 / 2 righe sys_learning_gaps | OK |
| me (Presenze) | saldi ferie 2023-2026 | Colombo | usate 9/8/14/11 | richieste approvate 9/8/14/11 giorni | OK |
| me (Presenze) | presenze 16-27/08/2026 | Colombo | VACATION 9 giorni lavorativi | 9 righe VACATION, nessun fine settimana | OK; stato grezzo D2-11 |
| me (Performance) | revisioni | Colombo / Esposito | 4 / 4 (ultima 3,53 / 2,85) | idem | OK dato; formato RIL D2-12 |
| me/analytics | obiettivi, competenze | Colombo | 15, 5 | 15 obiettivi, 5 evidenze | OK, ma competenze 5 contro 7 in me/skills: D2-16 |
| me/analytics | giorni di ferie disponibili | Colombo / Esposito / Serra | 773 / 788 / 759 | somma di tutti gli anni e di tutti i tipi di assenza | RIL D2-03 |
| me/analytics | trend ore | Colombo | 40 mesi, 2026-11 = 75 h | somma sys_attendance per mese | OK |
| me/analytics | rischio di uscita | Colombo | 24,54 con sei fattori | contributi = peso x valore, somma 24,55 | OK (arrotondamento) |
| me/approvals | richieste proprie | Colombo / Esposito / Marchetti | 4 / 4 / 179, 0 in attesa | created_by = persona | OK; titoli RIL D2-14 |
| me/approvals | coerenza con me/inbox | Marchetti | 0 in attesa | inbox: 24 avvisi «in attesa/scaduta» | RIL D2-07 |
| me/career (Obiettivi) | 15 obiettivi | Colombo | 15 | 15 | OK; scadute ancora in corso D2-18 |
| me/career (Percorsi) | percorso e piani | Colombo | Percorso Corporate Banking, 2 piani | idem | RIL D2-19 |
| me/career (Rischio) | successione | Colombo | 3 righe identiche | 3 posizioni distinte con lo stesso titolo | RIL D2-19 |
| me/career/target | elenco bersagli | Colombo / Esposito | non mostrato | 1 bersaglio ciascuno in sys_user_target_positions | RIL D2-20 |
| me/certifications | 7 attestati | Colombo | 7 | idem | OK; senza stato di scadenza D2-23 |
| me/delegations | deleghe | Colombo / Esposito / Marchetti | vuote; candidati Esposito 3 persone + 10 passi | unità Esposito = 4 persone (lei + 3) | OK |
| me/documents | 5 documenti | Colombo | 5 | 5 | OK |
| me/gaps | lacune | Serra | 2 righe, nomi in inglese | sys_learning_gaps (skill_id nullo su 270 righe su 270) | RIL D2-17 |
| me/handbook | 10 documenti | Colombo / Esposito | 10 | pubblicati del tenant | OK; data ISO D2-13 |
| me/inbox | notifiche | Colombo / Esposito / Marchetti | 0 / 0 / 24 | 0 / 0 / 24 | OK conteggio; contenuto D2-07 |
| me/kpis | indicatori | Colombo / Esposito | 4 generici mai misurati / 0 | requisiti della posizione corrente; bersaglio reale FX trading P&L variance 150.000 EUR non elencato | RIL D2-04 |
| me/learning | assegnazioni | Colombo | 20 (10 edizioni, 10 percorsi) | 20 | OK; date D2-21 |
| me/learning/catalogue | 50 percorsi | Colombo | 50, 10 già assegnati con «Iscriviti» | 50 | RIL D2-21 |
| me/matching | occupazioni, posizioni, ruoli | Colombo / Esposito | etichette in inglese, duplicati | calcolo dei punteggi: NV (non rifatto) | RIL D2-19 |
| me/performance | revisioni | Colombo | 4 | 4 | OK dato; RIL D2-12 |
| me/positions | 2 assegnazioni | Colombo / Esposito | attuale dal 04/08/2026, precedente chiusa 03/08/2026 | idem | OK; codice come prima colonna D2-10 |
| me/profile | anagrafica, indirizzo, banca | Colombo | come da database | sys_user_demographics, indirizzi, banca | OK; coerenze D2-22 |
| me/profile (Organizzazione) | responsabile | Colombo / Esposito / Serra | vuoto / vuoto / Federica Marchetti | titolare della posizione sopra: Riccardo Martini per Colombo | RIL D2-01 |
| me/profile (Organizzazione) | fine contratto, stato | Colombo | 27/07/2026, ACTIVE | contratto a tempo indeterminato senza fine | RIL D2-08 |
| me/profile (Contratti) | contratto | Colombo | CTR-2020-0197, qualifica «Operatore Titoli» | idem; la posizione attuale è un'altra | RIL D2-08 |
| me/profile (Cedolini) | 39 buste, lordo, netto | Colombo | lordo 4.576,92, netto 3.295,38, trattenute 1.281,54 | idem | OK importi; trattenute INPS/IRPEF vuote D2-02; coerenza con RAL D2-09 |
| me/profile (Esperienze) | 3 esperienze | Colombo | durate 59, 59, 60 mesi | calcolate dalle date | OK |
| me/security | sessioni, fattori | Colombo | 2 sessioni, 1 TOTP | idem | OK; IP D2-24 |
| me/skills | possedute, evidenze | Colombo / Esposito | 7 / 5; 10 / 6 | idem | RIL D2-16 |
| me/skills/self-assessment | elenco competenze (ricerca lato server) | Colombo | NV | NV: nessuna GET rifatta | NV |
| me/surveys | 7 sondaggi | Colombo | 6 chiusi senza data di compilazione | 6 con 8-16 risposte | RIL D2-05 |
| me/surveys/[surveyId] | domande e risposte | Colombo | NV | NV: non chiamato | NV |
| me/handbook/[id] | corpo e allegati | Colombo | NV | NV: non chiamato | NV |
| me/team | squadra | Colombo / Esposito / Serra | Tesoreria e Mercati 2 membri / Divisione Rischi e Compliance 36 membri, nessun responsabile / idem | sys_teams, sys_team_members | RIL D2-06 |
| me/time-off | saldi e richieste | Colombo / Esposito | 12 schede / 15 richieste | idem, usate = somma richieste approvate | OK dato; presentazione D2-15 |

## 2. Rilievi

### Gravità alta

**D2-01. «Responsabile» sempre vuoto per 126 persone su 161**
- Pagina e persona: me/profile, scheda Organizzazione; Colombo e Esposito (Serra lo vede perché la sua posizione risponde alla posizione della CEO, che ha un proprietario).
- Si vede: «Responsabile: —». Dovrebbe essere «Martini, Riccardo» per Colombo (la posizione risponde a «Responsabile Direzione Coordinamento Commerciale», tenuta da Riccardo Martini).
- Prova: `sql-sola-lettura.mts` sulla posizione POS-CMD-DIR-COORD: `position_owner_user_id` nullo, assegnazione ACTIVE a Riccardo Martini. Misura su tutte le 161 assegnazioni primarie attive: 126 con nome nullo, 124 delle quali con un titolare vero (2 posizioni senza `reports_to`).
- Causa: `apps/api/src/modules/me/repository.ts:283` ricava il nome da `sys_positions.position_owner_user_id` e non dal titolare della posizione di destinazione (invariante I1: proprietario e titolare sono distinti).
- Correzione: unire per titolare (assegnazione PRIMARY ACTIVE della posizione `reports_to`), con il proprietario come ripiego; nome in forma «Cognome, Nome».
- Incoerenza collegata: il responsabile del team di Colombo (me/team) è un'altra persona, vedi D2-06.

**D2-02. Cedolini: INPS, IRPEF e totale trattenute sempre «—»**
- Pagina: me/profile, scheda Cedolini; ogni persona.
- Dovrebbe: Colombo, ottobre 2026: INPS 420,62, IRPEF 860,92, totale 1.281,54 (presenti nell'API).
- Prova: chiave JSON nel database; 6.112 buste su 6.134 hanno `inps`, `irpef`, `total_deductions` minuscole, 0 hanno `INPS`.
- Causa: `apps/web/src/app/(authenticated)/me/profile/_components/pay-slips-tab.tsx:42-44` legge `deductions.INPS`, `.IRPEF`, `.total`.
- Correzione: leggere `inps`, `irpef`, `total_deductions` (meglio: l'API normalizza e dichiara le chiavi nel contratto condiviso `packages/shared/src/schemas/me.ts:223`).

**D2-03. Analisi: «giorni di ferie disponibili» = 773 (788 Esposito, 759 Serra)**
- Pagina: me/analytics, quarto riquadro.
- Dovrebbe: ferie dell'anno in corso. Colombo: 25 - 9 = 16.
- Prova: 773 = permessi 8 + malattia 711 + ferie 54; la malattia pesa 180 giorni all'anno su quattro anni.
- Causa: `repository.ts:654` somma `total - used` su tutte le righe di `sys_time_off_balances`, senza anno né tipo. La pagina scrive il numero con `toString()` (`analytics/page.tsx:47`).
- Correzione: solo tipo VACATION e anno corrente (con riporto), formattato con `useFormat`.

**D2-04. KPI: l'obiettivo vero non si vede, si vedono quattro indicatori generici mai misurati**
- Pagina: me/kpis; Colombo (4 KPI «Clienti, Produttività, Qualità, Scadenze», tutti «Mai misurato»), Esposito (vuota).
- Dovrebbe: per Colombo anche «FX trading P&L variance», bersaglio 2026 di 150.000 EUR, assegnato a lui.
- Prova: `sys_kpi_targets` di Colombo ha 1 riga; per 158 persone su 158 con bersagli assegnati il KPI non è tra i requisiti della posizione attuale, quindi non compare; solo 42 persone su 160 hanno un qualsiasi KPI richiesto. L'API restituisce `assignedTarget` e `targetTemplate` (85/70/100) e la pagina li ignora (`kpis/page.tsx`).
- Causa: `repository.ts:1490-1580` parte dai requisiti della posizione (`FROM user_position_assignments JOIN position_kpi_requirements`) e collega i bersagli solo a quelli.
- Correzione: partire dall'unione fra requisiti di posizione e bersagli assegnati; mostrare obiettivo, soglia minima e massima con l'unità.

**D2-05. Sondaggi già compilati appaiono «Da compilare» con il pulsante «Rispondi»**
- Pagina: me/surveys; Colombo (6 sondaggi chiusi con 8-16 risposte), Esposito (7).
- Prova: `completedAt: null` e `answerCount` 8-16; 403 coppie persona/sondaggio hanno risposte senza assegnazione completata. Nel 2025 Colombo ha 16 risposte su 8 domande (doppie).
- Causa: `repository.ts:922-995` (`listMyAssignedSurveys`): le risposte raggiunte senza riga di assegnazione portano `completed_at` nullo; la pagina decide con `s.completedAt` (`surveys/page.tsx:57-65`).
- Correzione: completato = ha risposte oppure assegnazione completata; per i sondaggi chiusi niente «Rispondi». Le risposte doppie sono un difetto del dato (cartella dati).

**D2-06. «Il mio team» non rappresenta la squadra della persona**
- Pagina: me/team.
- Colombo: vede «Squadra Tesoreria e Mercati» (2 membri: Cattaneo, Colombo), ma dal 04/08/2026 lavora in «Direzione Coordinamento Commerciale» (5 persone, responsabile Martini), che non ha nessuna squadra.
- Esposito e Serra: vedono la stessa «Divisione Rischi e Compliance» di 36 persone, sparse su 16 unità (filiali, pagamenti, audit...), agganciata all'unità radice «RTL Bank S.p.A.»; Esposito (responsabile della Direzione Gestione dei Rischi) compare come «Membro» e nessuno come «Responsabile»; dei suoi 3 collaboratori veri (Gentile, Giuliani, Rossi) la squadra ne contiene 2.
- Prova: `sys_teams.team_lead_user_id` = Alice Esposito ma 0 righe LEAD fra i 36 membri (è l'unica squadra su 26 senza riga LEAD); `team_organization_unit_id` = unità radice.
- Causa: dato (squadre non allineate alla riorganizzazione del 04/08/2026) e `teams/repository.ts` che costruisce il ruolo solo da `team_member_role`.
- Correzione: derivare il responsabile da `team_lead_user_id`; riallineare squadre e unità (cartella dati); per i responsabili offrire anche «i miei collaboratori diretti» dal perimetro gerarchico.

**D2-07. Inbox: avvisi «Approvazione in attesa/scaduta» su passi già approvati**
- Pagina: me/inbox; Marchetti (24 avvisi, tutti letti): «Approvazione scaduta: Adeguamento retributivo — 1,158 EUR... ferma da 3 cicli senza decisione».
- Prova: i 24 passi collegati sono APPROVED e la richiesta APPLIED; me/approvals di Marchetti dice 0 in attesa. Su tutto il tenant 25 avvisi puntano a passi già approvati.
- Causa: dato di storia36 (`db/seeds/storia36/07_approvals.sql`) con avvisi non chiusi alla decisione; `apps/api/src/modules/approvals/sla.ts:109,125` compone l'oggetto con il titolo grezzo.
- Correzione: chiudere (stato DISMISSED) gli avvisi dei passi decisi alla decisione e nel seed; l'inbox non deve mostrare avvisi su richieste concluse.

### Gravità media

**D2-08. Fine contratto 27/07/2026 con stato «ACTIVE» e contratto indeterminato**
- me/profile (Organizzazione e Contratti), Colombo. Contratto `permanent`, senza fine; rapporto con fine 27/07/2026 (passata) e qualifica contrattuale «Operatore Titoli», mentre la posizione è «Specialista Sviluppo Commerciale». Nelle note del contratto (non mostrate): «Trasformato a tempo indeterminato il 14/08/2026».
- Prova: 55 rapporti su 160 hanno fine passata e stato ACTIVE; 74 contratti senza fine hanno un rapporto con fine.
- Causa: dato (`sys_user_employment.user_employment_contract_end_date` non azzerato dalla trasformazione) e `organization-tab.tsx` che la mostra come «Fine contratto». Correzione: azzerare/riallineare nel dato; la pagina nasconde una fine passata se il contratto è indeterminato.

**D2-09. Cedolino non coerente con la RAL**
- Colombo: lordo mensile 4.576,92 x 13 = 59.500 contro RAL 49.583 (contratto e rapporto). Su 158 buste di ottobre il rapporto lordo x 13 / RAL va da 0,52 a 1,92. Correzione nel dato (cartella dati) o spiegazione in pagina (componenti variabili): NON VERIFICATO quale delle due sia quella giusta.

**D2-10. Codici e valori inglesi nelle schede del profilo e nelle liste (R4, C1)**
- me/ (riga «Ruoli: USER, TEAM_MEMBER», `summary-tab.tsx:35`) e me/profile Organizzazione («Ruoli» `organization-tab.tsx`, «Stato: ACTIVE», area/tipo/gruppo/livello paga `CCNL`, `CCNL_CRED_2024`, `3A3L`, area personale `MI-S`, sottoarea `0001`, società `RTLB`); Panoramica (`overview-tab.tsx`: sesso MALE, nazionalità IT, stato civile MARRIED, paese IT, relazione `spouse`, `child`, laurea MSC, «Business Administration», relazione del contatto di emergenza `spouse`); me/positions: il codice posizione è la prima colonna (`positions/page.tsx:38`, R2); me: codice posizione nel sottotitolo.
- Correzione: `useEnumLabel` con domini per sesso, stato civile, relazione, laurea, ruoli, stato del rapporto; codici nel dettaglio.
- Inoltre «Sede» e «Centro di costo» sono sempre «—» perché l'API li fissa a null (`repository.ts:334-335`): togliere i campi o valorizzarli.

**D2-11. Presenze: stato grezzo e ore con il punto**
- me (Presenze): `PRESENT`, `REMOTE` come testo (`attendance-tab.tsx:52`), ore «7.5h» (`:51`), saldi «usati/totali» con decimali non formattati.

**D2-12. Voti con tre formati e potenziale in codice**
- Colombo, ultima revisione 3,53: me (Performance) «3.5» (`performance-tab.tsx:30`, `toFixed`), me/performance «3.53» (`performance/page.tsx:45`), me/analytics «3,5». Colonna «Potenziale» mostra `MEDIUM`/`HIGH`/`LOW` (`performance/page.tsx:70`). Correzione: `fmt.numeroFisso(.., 2)` ovunque e `useEnumLabel` per il potenziale. La regola di calcolo del voto complessivo non è dichiarata e non è la media di obiettivi e competenze (2024: 4,26 e 3,86 danno 3,88): NON VERIFICATO.

**D2-13. Altri numeri non in formato italiano**
- me/skills punteggio «0.9» (`skills/page.tsx:133`); me/career obiettivi «peso 0.2» (`goals-tab.tsx:47`); me/learning scadenza «2023-09-28» (`learning/page.tsx:49`); me/handbook data «2025-03-03» (`handbook/page.tsx:38`); me/analytics giorni di ferie (D2-03).

**D2-14. Titoli di approvazioni e avvisi con numeri in forma inglese**
- me/approvals, me/inbox: «Richiesta di ferie — 9.00 giorni dal 16/08/2026» (566 titoli), «Adeguamento retributivo — 1,158 EUR» (86 titoli, 18 avvisi). Causa: `db/seeds/storia36/07_approvals.sql:92` (cast numerico) e `:175` (`FM999G999` in locale inglese). Correzione: migrazione di riscrittura dei titoli e formato nel seed; nuove richieste da `me/service.ts` da verificare.

**D2-15. Ferie e permessi: saldi di tutti gli anni come «disponibili»**
- me/time-off, Colombo: 12 schede (3 tipi x 4 anni); «Malattia 2026: 177 giorni disponibili», e per gli anni chiusi «giorni disponibili» che non esistono più. Dato giusto per le ferie 2026: 16 giorni. Correzione: mostrare l'anno corrente in primo piano, ferie e permessi come saldo, la malattia come giorni usati senza «disponibili»; storico in una scheda.

**D2-16. Competenze: 7 in pagina, 5 in analisi; evidenze senza possesso**
- Colombo: me/skills «7 competenze» (possesso), me/analytics «Competenze: 5» (evidenze `sys_user_skill_evidence`). Due evidenze su cinque («analisi finanziaria», «Gestione del rischio», livello Esperto, valutata dal responsabile) non hanno la competenza corrispondente fra quelle possedute. Causa: `repository.ts:649` conta le evidenze, la pagina conta il possesso. Correzione: un solo conteggio (il possesso) e le evidenze che non hanno possesso proposte come da confermare.

**D2-17. Lacune: nomi in inglese, un solo nome per riga, severità incoerente**
- me/gaps, Serra: «Regulatory Knowledge +5» (inglese), livelli attuale/obiettivo mai mostrati, severità «Bassa» con punteggio 95 e dentro competenze «significant»/«moderate»; `gap` null in ogni voce. Causa: `gaps/page.tsx:31-46` mostra solo `nomi[0]`; dato in `learning_gap_metadata` (skill_id nullo su 270 righe su 270). Correzione: espandere la riga con competenza, livello attuale, livello obiettivo, scarto; nomi in italiano alla fonte; spiegare il punteggio.

**D2-18. Obiettivi scaduti ancora «in corso»**
- me/career, Colombo: quattro obiettivi «4T 2025» scaduti il 31/12/2025 sono «In corso» al 7%, 14%, 66%, 85%; un obiettivo MBO 2026 «A rischio» scaduto il 30/06/2026. Dato non chiuso alla scadenza (cartella dati); la pagina non segnala la scadenza superata. Altri due obiettivi hanno peso 1 e 0,35 in un ciclo con altri pesi: i pesi di un ciclo non sommano a 1 nel 2025 (0,21+0,35+0,32+1).

**D2-19. Carriera e abbinamenti: elenchi senza senso o duplicati**
- me/career (Percorsi), Colombo: «Percorso Corporate Banking» da Specialista Sviluppo Commerciale passa per Direttore di Filiale, poi Analista Finanziario, Consulente Investimenti, di nuovo Analista Finanziario, Direttore Finanza e Tesoreria (si scende e si ripete); i due piani ACTIVE non hanno bersaglio né orizzonte.
- me/career (Rischio e successione), Colombo: tre carte identiche «Analista Crediti» 77,51, «Pronto in 6 mesi» (tre posizioni diverse con lo stesso titolo; si vede solo il titolo).
- me/matching, Colombo: 3+ posizioni «Analista Crediti» con lo stesso 69%; due ruoli «consulente finanziario corporate»; occupazioni in inglese («business analyst») con ISCO «2413.1.1» (traduzione già in arrivo con PR #228, come da piano interfaccia).
- Correzione: distinguere le posizioni per unità, deduplicare per titolo, controllare la sequenza dei passi alla fonte.

**D2-20. Gli obiettivi di carriera inseriti non si rivedono mai**
- me/career/target registra un bersaglio (`POST /v1/me/career/target-positions`) e `GET /v1/me/career` esiste, ma nessuna pagina lo legge: 255 bersagli di 152 persone (Colombo 1, Esposito 1) invisibili; anche mentorati, valutazioni, punteggi di lacuna personali non hanno pagina (NON VERIFICATO l'elenco completo: ho trovato assenti `/me/career`, `/me/assessments`, `/me/mentorships`, `/me/skill-gap-scores`, `/me/predictions`, `/me/pulse-checks`; `/me/mentorships` per le due persone è comunque vuoto). La mutazione di `career/target/page.tsx` invalida la chiave `["me","career"]`, che non coincide con `["me","career-paths"]` usata dalla scheda Percorsi.

**D2-21. Corsi: iscrizione offerta su corsi già assegnati, date che non sono quelle del corso, catalogo con corsi fuori settore**
- me/learning/catalogue, Colombo: «Iscriviti» su tutti i 50 percorsi, di cui 10 già assegnati (anche completati: «Antiriciclaggio AML»); colonna «Codice» (`CRS-rtl-bank-2`); corso «Analisi e valutazione sensoriale» (settore alimentare, tema C10 già noto).
- me/learning: «Iscritto il 28/07/2026» per edizioni del 2023 (è `created_at` della riga, importata, `repository.ts:1190-1213`); la scadenza dei percorsi è vuota.
- me: «Corsi 20» conta anche i 17 completati. Correzione: conteggio «da fare/in corso» e «completati» separati; stato «Già assegnato» nel catalogo.

**D2-22. Anagrafica incoerente nel dato**
- me/profile, Colombo: codice fiscale CLMLRT82P03F205P ha il codice del comune di nascita F205 (Milano), mentre il luogo di nascita è Como; contatto di emergenza «Roberto Colombo, coniuge» mentre la famiglia ha come coniuge Elena Ferrari. Il contatto di emergenza «coniuge» non coincide con il coniuge in famiglia in 59 casi su 59; 19 persone «sposate» non hanno nessun coniuge in famiglia. Correzione nel dato.

**D2-23. Attestati: nessuno stato di validità**
- me/certifications, Colombo: «Chartered Financial Analyst» scade il 17/11/2026 (fra due giorni), «Addetto primo soccorso» ha tre generazioni nello stesso elenco, senza indicazione di scaduto/in scadenza/valido (`certifications/page.tsx:76-82`). Correzione: colonna stato calcolata e ordine per validità, storico raccolto.

### Gravità bassa

**D2-24.** me/security: l'indirizzo IP appare come `80.225.82.207/32` (notazione CIDR) (`security/page.tsx:888`).

**D2-25.** me/surveys: «Rilevazione di clima 2026-H2» risulta compilata l'8 giugno 2026, prima del semestre; la lista dei sondaggi non mostra la data in cui si è risposto.

**D2-26.** me/handbook: la colonna «Pubblicato» usa `publishedAt ?? updatedAt`; per i documenti ancora in bozza non ha senso (non verificato: nessuno in bozza fra i 10).

## 3. Per il thread organigrammi

- Il responsabile di una persona va ricavato dal titolare della posizione di destinazione (assegnazione PRIMARY ACTIVE della posizione `position_reports_to_position_id`), non da `position_owner_user_id`: 124 posizioni con titolare ma proprietario nullo (D2-01). Un organigramma o una scheda che usa il proprietario mostra «nessun responsabile» per 126 persone su 161.
- Le squadre (`sys_teams`) non coincidono con l'albero: la «Divisione Rischi e Compliance» da 36 persone ha come unità la radice «RTL Bank S.p.A.» e membri di 16 unità; Colombo è ancora nella squadra della Tesoreria, ma dal 04/08/2026 sta nella Direzione Coordinamento Commerciale (D2-06). Non fidarsi delle squadre per costruire l'organigramma.
- Due posizioni attive senza `reports_to`: si presentano come radici; verificare che siano quelle attese.
- Non ho aperto me/org-chart.

## 4. Non verificato

- Pagine di dettaglio: me/handbook/[id], me/surveys/[surveyId], me/skills/self-assessment, me/career/target (solo sorgente), form e scritture.
- Persone Paolo Barbieri e Laura Santoro, e le pagine per Serra e Marchetti oltre a quelle del §1.
- Come le tabelle rendono i nomi con la rubrica (`useRubrica`, forma «Cognome, Nome»): letto nel codice di me/team, non osservato a video; l'API di me/team restituisce `fullName` «Nome Cognome».
- Calcoli dei punteggi di abbinamento, dei modelli di rischio (verificato solo che i contributi sommino) e il voto complessivo delle revisioni.
- Incidente collaterale per il thread dei dati 3: le approvazioni PENDING di Enzo Spenuso (27) sono tutte «Fascicolo E2E-FASCICOLO-...», cioè residui di prove automatiche in produzione.
