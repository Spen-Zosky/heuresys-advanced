-- ============================================================================
-- Migration 000520 — I contenuti di piattaforma hanno l'inglese (ADR-0062, seguito del passo 3; ADR-0029).
--
-- Fatto misurato il 2026-11-26, in sola lettura sulla produzione: sulle coppie tabella-campo
-- registrate dalla 000516 e dalla 000517 restano 497 righe con testo italiano e senza
-- traduzione 'en':
--   - 409 nei blueprint, nel registro dei loro processi e nelle etichette delle interfacce:
--     la 000516 le ha registrate senza tradurle;
--   - 77 moduli formativi senza tenant (di piattaforma): la 000517 ha scritto l'elenco dei
--     testi partendo dai valori di RTL_BANK, e il confronto è sul testo, quindi i moduli con
--     un titolo diverso (per esempio senza il suffisso «edizione in aula») sono rimasti fuori;
--   - 11 del tenant HEURESYS (unità, posizioni, percorsi formativi, progetto, squadra), per la
--     stessa ragione.
--
-- Cosa fa: mette in una tabella temporanea le coppie italiano/inglese scritte qui sotto e
-- scrive l'inglese, con source = 'LLM', per ogni riga il cui testo italiano coincide (btrim),
-- di qualunque tenant. Il testo italiano nella riga non cambia. Dove il testo aveva già un
-- inglese nel catalogo, si usa quello (con l'iniziale maiuscola dove l'italiano la ha). Lo
-- stesso testo italiano ha qui un solo inglese. Le coppie sono già nel registro e hanno già
-- il trigger trg_togli_traduzioni contro gli orfani (000517). I codici citati nelle regole
-- di derivazione (per esempio DI_PROCESSO) restano come sono.
-- Due posizioni dei blueprint («Direttore Generale», «Addetto Amministrazione del Personale»)
-- avevano già un inglese LLM diverso da quello dato allo stesso testo dalla 000517: si allineano.
--
-- Idempotenza: ON CONFLICT; si aggiornano solo le righe 'LLM' con testo diverso, quindi
-- una seconda passata non modifica niente. Le traduzioni di altra fonte restano.
--
-- Come annullare: cancellare le righe di sys.sys_reference_translations con locale 'en',
-- source = 'LLM' e created_at uguale al momento in cui questo file è stato applicato la
-- prima volta, sulle coppie elencate più sotto.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._piattaforma_en;
CREATE TEMPORARY TABLE _piattaforma_en (
  tabella text NOT NULL,
  colonna text NOT NULL,
  it      text NOT NULL,
  en      text NOT NULL,
  PRIMARY KEY (tabella, colonna, it)
);

INSERT INTO _piattaforma_en (tabella, colonna, it, en) VALUES
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','GERARCHICA se la posizione è responsabile di un''unità, DI_PROCESSO se è responsabile di un processo (passo derivati)','GERARCHICA if the position is responsible for a unit, DI_PROCESSO if it is responsible for a process (derived data step)'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','PROCESSO per gli obiettivi nati dalle terne del passo obiettivi, IMPRESA per quelli nati dalle priorità della strategia','PROCESSO for goals derived from the triples of the goals step, IMPRESA for those derived from the strategy priorities'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','dalla data di creazione del pacchetto all''orizzonte dell''obiettivo misurato (ANNUALE 365 giorni, TRIMESTRALE 90)','from the package creation date to the horizon of the measured goal (ANNUALE 365 days, TRIMESTRALE 90)'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','il contratto che ha il livello assegnato alla posizione dal passo inquadramento; se il livello è in più contratti il campo resta assente','the contract containing the level assigned to the position by the job grading step; if the level appears in several contracts the field stays empty'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','il responsabile del processo dell''obiettivo che l''indicatore misura (passo derivati)','the owner of the process of the goal that the indicator measures (derived data step)'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_rule','le fasi dal passo fasi, nell''ordine del catalogo; esecutore: la prima posizione che le svolge, o l''agente che le cita se la natura è AGENTE_SUPERVISIONATO; natura del lavoro dal passo agenti, erogazione dal passo principi','the phases from the phases step, in catalogue order; performer: the first position that carries them out, or the agent that cites them if the nature is AGENTE_SUPERVISIONATO; nature of work from the agents step, delivery from the principles step'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Bilancio/Direzione Crediti - reportistica NPE','Financial Statements / Credit Department - NPE reporting'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Calendario Risk Management / Direzione','Risk Management calendar / Senior Management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Controlli di secondo livello - Direzione Crediti','Second-line controls - Credit Department'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Direzione Crediti - reportistica NPL','Credit Department - NPL reporting'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Modello interno di risk management','Internal risk management model'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Procedure operative Back Office','Back Office operating procedures'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Riconciliazione conti titoli / Back Office','Securities account reconciliation / Back Office'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Risk Management - reportistica limiti di rischio','Risk Management - risk limit reporting'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Risk Management / backtesting regolamentare','Risk Management / regulatory backtesting'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Risk Management / sistema di reporting VaR','Risk Management / VaR reporting system'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Risk Management/Tesoreria - segnalazioni di vigilanza','Risk Management / Treasury - supervisory reporting'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Segnalazioni di vigilanza Banca d''Italia / Tesoreria','Bank of Italy supervisory reporting / Treasury'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Sistema di limit monitoring / Risk Management','Limit monitoring system / Risk Management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Sistema di regolamento titoli / Back Office Titoli','Securities settlement system / Securities Back Office'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Sistema di risk management / trading desk','Risk management system / trading desk'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Tesoreria - sistema di cash management','Treasury - cash management system'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_data_source','Tesoreria / APQC Open Standards Benchmarking','Treasury / APQC Open Standards Benchmarking'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','(Stock NPL anno corrente - Stock NPL anno precedente) / Stock NPL anno precedente x100','(Current-year NPL stock - Previous-year NPL stock) / Previous-year NPL stock x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','(crediti deteriorati rientrati in bonis nell''anno / stock NPL a inizio anno) x100','(Non-performing exposures returned to performing status during the year / NPL stock at the start of the year) x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','(numero giorni con daily cash position pubblicata entro l''orario operativo prestabilito / giorni operativi nel periodo) x100','(Number of days with the daily cash position published within the set operating hours / Business days in the period) x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','(numero pratiche che richiedono correzione o rielaborazione / totale pratiche istruite nel periodo) x100','(Number of applications requiring correction or rework / Total applications processed in the period) x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Attività liquide di alta qualità / Flussi di cassa netti in uscita in 30 giorni di stress, x100','High-quality liquid assets / Net cash outflows over a 30-day stress period, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Giorni con report VaR consegnato entro il termine previsto / Giorni lavorativi totali, x100','Days with the VaR report delivered by the set deadline / Total business days, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di breach dei limiti VaR/posizione rilevati in backtesting / periodo','Number of VaR/position limit breaches detected in backtesting / period'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di discrepanze nei conti titoli non risolte entro la chiusura giornaliera','Number of securities account discrepancies not resolved by the daily close'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di posizioni riconciliate entro i termini operativi / Totale posizioni da riconciliare, x100','Number of positions reconciled within operating deadlines / Total positions to be reconciled, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di sforamenti rilevati e segnalati entro i termini interni / Totale sforamenti rilevati, x100','Number of breaches detected and reported within internal deadlines / Total breaches detected, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di stress test eseguiti nel periodo / Numero di stress test pianificati dal calendario, x100','Number of stress tests performed in the period / Number of stress tests planned in the calendar, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Numero di valute estere oggetto del programma di hedging valutario / Ricavi totali (miliardi di $)','Number of foreign currencies covered by the currency hedging programme / Total revenue (billion $)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Piano presentato entro la data pianificata = SI/NO; eventuale ritardo in giorni','Plan presented by the planned date = YES/NO; any delay in days'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Riserve di attività liquide di elevata qualità / Totale uscite di cassa nette nei successivi 30 giorni di stress x100','High-quality liquid asset reserves / Total net cash outflows over the following 30 days of stress x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Stima statistica della massima perdita potenziale del portafoglio su 1 giorno al 99% di confidenza','Statistical estimate of the maximum potential portfolio loss over 1 day at a 99% confidence level'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','VaR effettivo del portafoglio / Limite VaR assegnato, x100','Actual portfolio VaR / Assigned VaR limit, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','Valore delle operazioni non regolate entro T+2 / Valore totale delle operazioni regolate, x100','Value of transactions not settled by T+2 / Total value of settled transactions, x100'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','conteggio degli eventi di superamento dei limiti di rischio approvati dal Consiglio nel periodo','Count of breaches of the Board-approved risk limits in the period'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_formula','ora di pubblicazione del report di daily cash position - ora di apertura operativa prevista','Daily cash position report publication time - scheduled operating opening time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Accuratezza delle scritture','Accounting entry accuracy'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Attivi ponderati per il rischio','Risk-weighted assets'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Completamento del piano di audit','Audit plan completion'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Consumo energetico per metro quadro','Energy consumption per square metre'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Contenziosi aperti','Open litigation cases'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Conti dormienti sul totale','Dormant accounts as a share of total'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Copertura delle prove di stress','Stress test coverage'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Costo di acquisizione per cliente','Customer acquisition cost'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Costo per postazione','Cost per workstation'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Costo per transazione','Cost per transaction'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Crescita delle masse gestite','Growth in assets under management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Delibere del consiglio attuate nei termini','Board resolutions implemented on time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Differenze di cassa','Cash differences'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Discrepanze irrisolte nei conti titoli a fine giornata','Unresolved discrepancies in securities accounts at end of day'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Disponibilita dei sistemi','System availability'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Esecuzione degli stress test periodici secondo il calendario definito','Execution of periodic stress tests according to the defined calendar'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Esito favorevole nei contenziosi chiusi','Favourable outcome in closed litigation'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Formazione obbligatoria completata','Mandatory training completed'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Fornitori critici con valutazione aggiornata','Critical suppliers with an up-to-date assessment'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Giorni di riserva di liquidita','Liquidity reserve days'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Giorni per la chiusura contabile','Days to close the accounts'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Grado di conformita','Compliance level'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Grado di copertura degli accantonamenti','Provision coverage ratio'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Indice di coinvolgimento','Engagement index'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Indice di copertura della liquidita','Liquidity coverage ratio'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Indice di finanziamento stabile netto','Net stable funding ratio'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Indice di raccomandazione','Net promoter score'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Liquidity Coverage Ratio (LCR)','Liquidity Coverage Ratio (LCR)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Notorieta di marca','Brand awareness'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Numero di sforamenti non autorizzati dei limiti di rischio finanziario/liquidità','Number of unauthorised breaches of financial and liquidity risk limits'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Numero di valute estere coinvolte nel programma di hedging per miliardo di $ di ricavi','Number of foreign currencies in the hedging programme per billion dollars of revenue'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Occupazione degli spazi','Space occupancy'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Onboarding NPS','Onboarding NPS'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Operazioni allo sportello per addetto','Counter transactions per teller'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Percentuale di giorni con posizione di liquidità determinata entro l''orario operativo','Percentage of days with the liquidity position determined within operating hours'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Percentuale di utilizzo del limite VaR assegnato','Utilisation of the assigned VaR limit (%)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Perdita attesa','Expected loss'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Posizioni scadute oltre 90 giorni','Exposures past due over 90 days'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Pratiche di apertura respinte','Rejected account opening applications'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Qualita dei dati sui domini critici','Data quality on critical domains'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Quota di prodotti collocati con profilo adeguato','Products sold within suitability profile'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Raccolta netta retail','Retail net inflows'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Rapporto costi/ricavi','Cost/income ratio'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Rapporto crediti deteriorati','Non-performing loan ratio'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Realizzazione del piano strategico','Strategic plan delivery'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Reclami risolti al primo contatto','Complaints resolved at first contact'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Reclami su prodotti di investimento','Complaints on investment products'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Ricavo per consulente','Revenue per advisor'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Riduzione dello stock di NPL rispetto all''anno precedente','Reduction of the NPL stock compared with the previous year'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Rilasci andati a buon fine','Successful releases'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Rilievi di audit ad alta gravita','High-severity audit findings'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Rilievi ripetuti','Repeat findings'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Risparmio ottenuto sugli acquisti','Procurement savings achieved'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Scostamento del risultato sui cambi','Foreign exchange result variance'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Segnalazioni di operazioni sospette','Suspicious transaction reports'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Segnalazioni regolamentari consegnate nei termini','Regulatory reports delivered on time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Sforamenti dei limiti di rischio operativo segnalati tempestivamente alla Direzione','Operational risk limit breaches reported promptly to Senior Management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Soddisfazione del cliente','Customer satisfaction'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Superamenti non autorizzati dei limiti di rischio (VaR e posizione)','Unauthorised breaches of risk limits (VaR and position)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di attivazione clienti','Customer activation rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di conversione delle campagne','Campaign conversion rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di default','Default rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di errore','Error rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di permanenza','Retention rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di recupero (reverse ratio) dei crediti deteriorati','Recovery rate (reverse ratio) on non-performing loans'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di recupero sui crediti deteriorati','Non-performing loan recovery rate'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tasso di settlement fails su operazioni in titoli regolate T+2','Settlement fail rate on securities transactions settled T+2'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempestività della reportistica giornaliera del VaR alla Direzione','Timeliness of daily VaR reporting to Senior Management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempestività della riconciliazione front office/back office','Timeliness of front office / back office reconciliation'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempestività di presentazione del piano strategico HR annuale al vertice','Timeliness of presenting the annual HR strategic plan to the top management'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo del ciclo di acquisto','Purchase cycle time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di apertura di un conto','Account opening turnaround time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di chiusura dei rilievi','Findings closure time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di copertura di una posizione','Time to fill a position'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di determinazione della posizione di liquidità giornaliera (daily cash position)','Time to determine the daily liquidity position (daily cash position)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di elaborazione','Processing time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di evasione di una richiesta dati','Data request fulfilment time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di revisione contrattuale','Contract review turnaround time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di risoluzione alert AML','AML alert resolution time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di risposta alle richieste di audit','Response time to audit requests'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo di verifica KYC','KYC verification time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo medio di attesa allo sportello','Average counter waiting time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo medio di erogazione','Average disbursement time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo medio di recupero','Average recovery time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo medio di ripristino','Average restoration time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Tempo medio di risposta','Average response time'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','VaR del portafoglio a 1 giorno (intervallo di confidenza 99%)','1-day portfolio VaR (99% confidence level)'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Valore a rischio','Value at risk'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Volume erogato','Disbursed volume'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_name','Volume transazioni','Transaction volume'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','Fails scesi dal 10% (Q2 2022) al 5% dopo penalità CSDR; target realistico circa 2% in valore.','Fails down from 10% (Q2 2022) to 5% after CSDR penalties; realistic target about 2% by value.'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','LCR minimo regolamentare 100% (Basilea III); banche italiane LCR medio attuale circa 240%.','Regulatory minimum LCR 100% (Basel III); current average LCR of Italian banks about 240%.'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','NPE ratio lordo previsto in calo al 2,3% nel 2025-27, sotto la soglia BCE del 5%','Gross NPE ratio expected to fall to 2.3% in 2025-27, below the ECB threshold of 5%'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','Soglia statistica 99° percentile VaR superata mediamente una volta ogni due trimestri.','Statistical threshold: the 99th percentile VaR is exceeded on average once every two quarters.'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','VaR calcolato con probabilità 99% su orizzonte di un giorno di trading (prassi di settore).','VaR calculated at 99% probability over a one-trading-day horizon (industry practice).'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','cut-off operativo tipico delle banche italiane fissato alle 16:00 nei giorni lavorativi','Typical operating cut-off of Italian banks set at 16:00 on business days'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_reference_text','soglia regolamentare minima 100%; media banche italiane 195% nel 2024','Regulatory minimum threshold 100%; average of Italian banks 195% in 2024'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Addetto Amministrazione del Personale','Payroll and HR Administration Officer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Amministratore Delegato','Chief Executive Officer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Analista Bilancio e Segnalazioni','Financial Reporting Analyst'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Analista Crediti','Credit Analyst'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Analista Finanziario','Financial Analyst'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Analista Monitoraggio Crediti','Credit Monitoring Analyst'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Analista Rischio','Risk Analyst'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Auditor Interno','Internal Auditor'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Cassiere','Bank Teller'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Consulente Clientela','Personal Banking Advisor'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Divisione Crediti','Head of Credit'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Divisione Retail','Head of Retail Division'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Finanza e Amministrazione','Finance Director'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Generale','CEO'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore IT e Digital','IT Director'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Operations','Operations Director'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore Risorse Umane e Organizzazione','Director of Human Resources and Organisation'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Direttore di Filiale','Branch Manager'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Gestore Piccole Imprese','Small Business Relationship Manager'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Gestore Recupero Crediti','Debt Recovery Officer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Legale','Legal'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Operatore Cambi','FX Dealer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Operatore Titoli','Securities Dealer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Affari Legali e Societari','Head of Legal and Corporate Affairs'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Amministrazione del Personale','Head of Personnel Administration'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Antiriciclaggio','Head of Anti-Money Laundering'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Back Office','Head of Back Office'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Bilancio e Segnalazioni','Head of Financial Statements and Regulatory Reporting'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Compliance e Protezione Dati','Head of Compliance and Data Protection'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Coordinamento Commerciale','Head of Commercial Coordination'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Crediti PMI','Head of SME Credit'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Crediti Retail','Head of Retail Credit'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Governo e Supporto Rete','Head of Network Governance and Support'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Infrastrutture','Head of Infrastructure'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Internal Audit','Head of Internal Audit'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Istruttoria ed Erogazione','Head of Credit Assessment and Disbursement'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Marketing e Comunicazione','Head of Marketing and Communications'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Monitoraggio e Crediti Deteriorati','Head of Credit Monitoring and Non-Performing Loans'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Pagamenti','Head of Payments'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Risk Management','Head of Risk Management'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Sviluppo Software e Canali Digitali','Head of Software Development and Digital Channels'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Sviluppo, Formazione e Organizzazione','Head of Development, Training and Organisation'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile Tesoreria e Mercati','Head of Treasury and Markets'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Responsabile di Area','Area Manager'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Risk Manager','Risk Manager'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Sistemista','Systems Administrator'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Back Office','Back Office Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Compliance','Compliance Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Formazione e Sviluppo','Learning and Development Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Marketing e Comunicazione','Marketing and Communications Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Pagamenti','Payment Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Qualità e Supporto Rete','Branch Network Support Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Specialista Sviluppo Commerciale','Business Development Specialist'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Sviluppatore Software','Software Developer'),
  ('sys_blueprint_content_positions','blueprint_content_position_title','Vice Direttore di Filiale','Deputy Branch Manager'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','Domain Name Service','Domain Name Service'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','Gestione del rischio','Risk Management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','Security engineering','Security engineering'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','adeguare l’impegno allo sviluppo dell’impresa','align efforts towards business development'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','affrontare i rischi individuati','address identified risks'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','ambiente software di sviluppo integrato','integrated development environment software'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','amministrare sistemi TIC','administer ICT system'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','amministrazione di ufficio','office administration'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','analizzare i fattori esterni delle imprese','analyse external factors of companies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','analizzare i fattori interni delle imprese','analyse internal factors of companies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','analizzare i piani economici','analyse business plans'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','analizzare le prestazioni finanziarie di un’impresa','analyse financial performance of a company'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','analizzare le specifiche del software','analyse software specifications'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','applicare la gestione delle crisi','apply crisis management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','applicare politiche di organizzazione del sistema','apply system organisational policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','applicare politiche di sicurezza ICT','implement ICT security policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','applicare politiche di utilizzo dei sistemi TIC','apply ICT system usage policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','assistere gli utenti di sistemi TIC','support ICT system users'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','assumere la responsabilità della gestione di un’impresa','assume responsibility for the management of a business'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','attività bancarie','banking activities'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','attuare la corporate governance','implement corporate governance'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','audit interno','internal auditing'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','collaborare con i dirigenti','liaise with managers'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','componenti hardware','hardware components'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','concludere gli accordi commerciali','conclude business agreements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','conferire alla gestione aziendale un’impostazione proattiva che anticipi gli sviluppi futuri','imprint visionary aspirations into the business management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','coordinare le attività operative','coordinate operational activities'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','costituire le équipe di un’organizzazione sulla base delle competenze','shape organisational teams based on competencies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','costruire la fiducia','build trust'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','creare diagrammi di flusso','create flowchart diagram'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','definire i requisiti tecnici','define technical requirements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','definire le politiche di rischio','define risk policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','definire le regole organizzative','define organisational standards'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','dirigere i direttori dei reparti dell’azienda','lead managers of company departments'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','disegni tecnici','technical drawings'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','elaborare i pagamenti','process payments'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','elaborazione di modelli di processi aziendali','business process modelling'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','eseguire i backup','perform backups'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','eseguire il debug di un software','debug software'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','eseguire la manutenzione di sistemi TIC','maintain ICT system'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','eseguire test di sistema','manage system testing'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','esigenze degli utenti del sistema TIC','ICT system user requirements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','fare ricerca scientifica','perform scientific research'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','fornire informazioni sui prodotti finanziari','provide financial product information'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','garantire la legalità delle operazioni aziendali','ensure lawful business operations'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestione del marketing','marketing management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestione del rischio aziendale','enterprise risk management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestione delle operazioni','operations management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestione di progetto','project management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestione finanziaria','financial management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire gli aspetti finanziari di un’impresa','manage financial aspects of a company'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire i cambiamenti dei sistemi TIC','manage changes in ICT system'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire la documentazione cartacea','handle paperwork'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire la sicurezza del sistema','manage system security'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire sistemi amministrativi','manage administrative systems'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','gestire un progetto di ingegneria','manage engineering project'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','identificazione dei rischi','risk identification'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','impegnarsi per far crescere l’azienda','strive for company growth'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','implementare il piano di ripresa del sistema TIC','implement ICT recovery system'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','implementare software anti-virus','implement anti-virus software'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','implementare un firewall','implement a firewall'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','implementare una rete virtuale privata o VPN','implement a virtual private network'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','indicatori chiave di rischio','key risk indicators'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','individuare gli indicatori chiave di prestazione','track key performance indicators'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','individuare le necessità dei clienti','identify customer requirements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','infrastruttura TIC','ICT infrastructure'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','integrare componenti di sistema','integrate system components'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','integrare gli interessi degli azionisti nei piani aziendali','integrate shareholders'' interests in business plans'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','integrare i fondamenti strategici nelle prestazioni quotidiane','integrate strategic foundation in daily performance'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','interessarsi alle operazioni quotidiane dell’azienda','collaborate in company''s daily operations'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','interpretare i bilanci d’esercizio','interpret financial statements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','interpretare i requisiti tecnici','interpret technical requirements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','interpretare testi tecnici','interpret technical texts'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','librerie di componenti software','software components libraries'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','mantenere i contatti con i soci','liaise with shareholders'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','metodologie di assicurazione della qualità','quality assurance methodologies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','monitorare la politica aziendale','monitor company policy'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','monitorare le prestazioni di sistema','monitor system performance'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','negoziare con le parti interessate','negotiate with stakeholders'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','offrire consulenza sulla gestione dei rischi','advise on risk management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','offrire i servizi finanziari','offer financial services'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','osservare le norme aziendali','follow company standards'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','ottemperare alle disposizioni legali','comply with legal regulations'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','pianificare gli obiettivi a medio e lungo termine','plan medium to long term objectives'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','plasmare la cultura aziendale','shape corporate culture'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','politiche aziendali','company policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','politiche dell’organizzazione','organisational policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','prendere decisioni aziendali strategiche','make strategic business decisions'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','prevedere i rischi organizzativi','forecast organisational risks'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','principi di ingegneria','engineering principles'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','processi aziendali','business processes'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','processi di ingegneria','engineering processes'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','programmazione di sistemi TIC','ICT system programming'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','programmazione informatica','computer programming'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','rendiconti d’esercizio','financial statements'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','responsabilità sociale delle imprese','corporate social responsibility'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','risolvere i problemi del sistema TIC','solve ICT system problems'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','rispettare il codice etico degli affari','abide by business ethical code of conducts'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','servizi web','web services'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sistemi digitali','digital systems'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sistemi operativi','operating systems'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','software per ufficio','office software'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sostenibilità aziendale','corporate sustainability'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','stabilire buone relazioni di cooperazione','establish collaborative relations'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','standard di rete','network standards'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','stimare l''impatto dei rischi','estimate impact of risks'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','strumenti di debug TIC','ICT debugging tools'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','strumenti per la gestione della configurazione software','tools for software configuration management'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare i piani aziendali','develop business plans'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare le politiche organizzative','develop organisational policies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare le strategie aziendali','develop company strategies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare le strategie di generazione di entrate','develop revenue generation strategies'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare metodi di migrazione automatica dei dati','develop automated migration methods'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare prototipi software','develop software prototype'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','sviluppare una rete professionale','develop professional network'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','svolgere le mansioni di segreteria','perform clerical duties'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','tecniche di analisi qualitativa del rischio','qualitative risk analysis techniques'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','tecniche di analisi quantitativa del rischio','quantitative risk analysis techniques'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','tecniche di finanziamento del rischio','risk financing techniques'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','tenere un archivio delle transazioni finanziarie','maintain records of financial transactions'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','tipi di assicurazione','types of insurance'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','trasferimento del rischio','risk transfer'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','trasferire dati esistenti','migrate existing data'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','usare librerie software','use software libraries'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare i sistemi per ufficio','use office systems'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare interfacce specifiche delle applicazioni','use an application-specific interface'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare schemi di progettazione software','use software design patterns'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare software per il disegno tecnico','use technical drawing software'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare strumenti di back-up e di recupero','use back-up and recovery tools'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','utilizzare strumenti di computer-aided software engineering','utilise computer-aided software engineering tools'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','valutare i fattori di rischio','assess risk factors'),
  ('sys_blueprint_content_skills','blueprint_content_skill_name','valutare le prestazioni dei collaboratori dell’organizzazione','evaluate performance of organisational collaborators'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Area territoriale 1','Territorial area 1'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Area territoriale 2','Territorial area 2'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Affari Legali e Societari','Legal and Corporate Affairs Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Antiriciclaggio','Anti-Money Laundering Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Back Office','Back Office Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Bilancio e Segnalazioni','Financial Statements and Regulatory Reporting Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Compliance e Protezione Dati','Compliance and Data Protection Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Coordinamento Commerciale','Commercial Coordination Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Generale','General Management'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Governo e Supporto Rete','Network Governance and Support Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Infrastrutture','Infrastructure Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Internal Audit','Internal Audit Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Istruttoria ed Erogazione','Credit Assessment and Disbursement Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Monitoraggio e Crediti Deteriorati','Credit Monitoring and Non-Performing Loans Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Pagamenti','Payments Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Risk Management','Risk Management Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Sviluppo Software e Canali Digitali','Software Development and Digital Channels Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Direzione Tesoreria e Mercati','Treasury and Markets Department'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Crediti','Credit Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Finanza e Amministrazione','Finance and Administration Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione IT & Digital','IT & Digital Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Marketing e Comunicazione','Marketing and Communications Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Operations','Operations Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Retail Banking','Retail Banking Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Divisione Risorse Umane e Organizzazione','Human Resources and Organisation Division'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Filiale capoluogo','Provincial capital branch'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Filiale di provincia','Provincial branch'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Filiale urbana','Urban branch'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Ufficio Amministrazione del Personale','Personnel Administration Office'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Ufficio Crediti PMI','SME Credit Office'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Ufficio Crediti Retail','Retail Credit Office'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','Ufficio Sviluppo, Formazione e Organizzazione','Development, Training and Organisation Office'),
  ('sys_blueprint_content_units','blueprint_content_unit_name','[Ragione sociale della banca]','[Bank''s registered name]'),
  ('sys_blueprint_process_registry','blueprint_process_name','Acquisizione e onboarding clienti','Customer acquisition and onboarding'),
  ('sys_blueprint_process_registry','blueprint_process_name','Adeguata verifica e antiriciclaggio','Customer due diligence and anti-money laundering'),
  ('sys_blueprint_process_registry','blueprint_process_name','Apertura e gestione conti','Account opening and management'),
  ('sys_blueprint_process_registry','blueprint_process_name','Approvvigionamenti e gestione fornitori','Procurement and supplier management'),
  ('sys_blueprint_process_registry','blueprint_process_name','Audit interno','Internal audit'),
  ('sys_blueprint_process_registry','blueprint_process_name','Compliance e reportistica regolamentare','Compliance and regulatory reporting'),
  ('sys_blueprint_process_registry','blueprint_process_name','Consulenza patrimoniale','Wealth advisory'),
  ('sys_blueprint_process_registry','blueprint_process_name','Dati e analytics','Data & Analytics'),
  ('sys_blueprint_process_registry','blueprint_process_name','Erogazione del credito','Loan origination'),
  ('sys_blueprint_process_registry','blueprint_process_name','Facility e immobili','Facilities and real estate'),
  ('sys_blueprint_process_registry','blueprint_process_name','Finanza e contabilità','Finance & Accounting'),
  ('sys_blueprint_process_registry','blueprint_process_name','Gestione del capitale umano','Human capital management'),
  ('sys_blueprint_process_registry','blueprint_process_name','Gestione del rischio','Risk Management'),
  ('sys_blueprint_process_registry','blueprint_process_name','IT e cybersecurity','IT and cybersecurity'),
  ('sys_blueprint_process_registry','blueprint_process_name','Investimenti retail','Retail investments'),
  ('sys_blueprint_process_registry','blueprint_process_name','Legale','Legal'),
  ('sys_blueprint_process_registry','blueprint_process_name','Marketing e comunicazione','Marketing & Communications'),
  ('sys_blueprint_process_registry','blueprint_process_name','Monitoraggio e recupero crediti','Credit monitoring and collection'),
  ('sys_blueprint_process_registry','blueprint_process_name','Operatività di filiale','Branch operations'),
  ('sys_blueprint_process_registry','blueprint_process_name','Pagamenti e bonifici','Payments and credit transfers'),
  ('sys_blueprint_process_registry','blueprint_process_name','Servizio clienti','Customer service'),
  ('sys_blueprint_process_registry','blueprint_process_name','Strategia e governance aziendale','Corporate strategy and governance'),
  ('sys_blueprint_process_registry','blueprint_process_name','Tesoreria e ALM','Treasury and ALM'),
  ('sys_learning_modules','learning_module_title','Analisi avanzata dei dati','Advanced data analysis'),
  ('sys_learning_modules','learning_module_title','Analisi dei dati per il settore bancario','Data analytics for the banking sector'),
  ('sys_learning_modules','learning_module_title','Analisi e valutazione sensoriale','Sensory analysis and evaluation'),
  ('sys_learning_modules','learning_module_title','Antiriciclaggio AML','Anti-money laundering (AML)'),
  ('sys_learning_modules','learning_module_title','Antiriciclaggio e contrasto al finanziamento del terrorismo','Anti-money laundering and counter-terrorist financing'),
  ('sys_learning_modules','learning_module_title','Basilea III - Requisiti patrimoniali','Basel III - Capital requirements'),
  ('sys_learning_modules','learning_module_title','Basilea III/IV e requisiti patrimoniali','Basel III/IV and capital requirements'),
  ('sys_learning_modules','learning_module_title','Basilea IV - Le novità della regolamentazione bancaria','Basel IV - What is new in banking regulation'),
  ('sys_learning_modules','learning_module_title','CAMS - Preparazione alla certificazione antiriciclaggio','CAMS - Preparation for the anti-money laundering certification'),
  ('sys_learning_modules','learning_module_title','Certificato ABA per cassieri - Fondamenti','ABA certificate for bank tellers - Fundamentals'),
  ('sys_learning_modules','learning_module_title','Cloud computing con AWS','Cloud computing with AWS'),
  ('sys_learning_modules','learning_module_title','Comunicazione Efficace','Effective Communication'),
  ('sys_learning_modules','learning_module_title','Conformità MiFID II per i servizi di investimento','MiFID II compliance for investment services'),
  ('sys_learning_modules','learning_module_title','Cybersecurity Awareness','Cybersecurity Awareness'),
  ('sys_learning_modules','learning_module_title','Design thinking','Design thinking'),
  ('sys_learning_modules','learning_module_title','Diversity & Inclusion','Diversity & Inclusion'),
  ('sys_learning_modules','learning_module_title','Eccellenza nel servizio al cliente in banca','Customer service excellence in banking'),
  ('sys_learning_modules','learning_module_title','Eccellenza nell''elaborazione delle transazioni','Excellence in transaction processing'),
  ('sys_learning_modules','learning_module_title','Eccellenza nella supervisione della produzione','Excellence in production supervision'),
  ('sys_learning_modules','learning_module_title','Educazione finanziaria per la clientela','Financial education for customers'),
  ('sys_learning_modules','learning_module_title','Excel Avanzato','Advanced Excel'),
  ('sys_learning_modules','learning_module_title','FRM Parte I - Fondamenti del Financial Risk Manager','FRM Part I - Foundations of the Financial Risk Manager'),
  ('sys_learning_modules','learning_module_title','FRM Parte II - Gestione avanzata del rischio','FRM Part II - Advanced risk management'),
  ('sys_learning_modules','learning_module_title','Finanza sostenibile ed ESG','Sustainable finance and ESG'),
  ('sys_learning_modules','learning_module_title','Fondamenti di KYC - Conosci il tuo cliente','KYC fundamentals - Know your customer'),
  ('sys_learning_modules','learning_module_title','Fondamenti di analisi del rischio di credito','Fundamentals of credit risk analysis'),
  ('sys_learning_modules','learning_module_title','Fondamenti di consulenza sugli investimenti','Fundamentals of investment advice'),
  ('sys_learning_modules','learning_module_title','Fondamenti di gestione del portafoglio','Fundamentals of portfolio management'),
  ('sys_learning_modules','learning_module_title','Fondamenti di machine learning','Fundamentals of machine learning'),
  ('sys_learning_modules','learning_module_title','GDPR e Privacy','GDPR and Privacy'),
  ('sys_learning_modules','learning_module_title','GDPR per Operatori Bancari','GDPR for Banking Operators'),
  ('sys_learning_modules','learning_module_title','Gestione agile dei progetti','Agile project management'),
  ('sys_learning_modules','learning_module_title','Gestione dei crediti deteriorati (NPL)','Non-performing loan (NPL) management'),
  ('sys_learning_modules','learning_module_title','Gestione del contante e riconoscimento delle banconote false','Cash handling and counterfeit banknote detection'),
  ('sys_learning_modules','learning_module_title','Gestione del rischio bancario','Banking risk management'),
  ('sys_learning_modules','learning_module_title','Gestione del rischio di liquidità','Liquidity risk management'),
  ('sys_learning_modules','learning_module_title','Gestione del rischio di mercato','Market risk management'),
  ('sys_learning_modules','learning_module_title','Gestione del rischio operativo','Operational risk management'),
  ('sys_learning_modules','learning_module_title','Gestione del tempo','Time management'),
  ('sys_learning_modules','learning_module_title','IFRS 9 – Strumenti finanziari','IFRS 9 – financial instruments'),
  ('sys_learning_modules','learning_module_title','Il processo del credito: istruttoria, erogazione e monitoraggio','The credit process: assessment, disbursement and monitoring'),
  ('sys_learning_modules','learning_module_title','Internal audit bancario','Banking internal audit'),
  ('sys_learning_modules','learning_module_title','Investimenti ESG e finanza sostenibile','ESG investing and sustainable finance'),
  ('sys_learning_modules','learning_module_title','Leadership Fondamentale','Leadership Essentials'),
  ('sys_learning_modules','learning_module_title','Leadership per i responsabili di produzione','Leadership for production managers'),
  ('sys_learning_modules','learning_module_title','Mercati mobiliari e negoziazione','Securities markets and trading'),
  ('sys_learning_modules','learning_module_title','Metodi di consulenza sulla sostenibilità','Sustainability advisory methods'),
  ('sys_learning_modules','learning_module_title','MiFID II e tutela degli investitori','MiFID II and investor protection'),
  ('sys_learning_modules','learning_module_title','Monitoraggio delle transazioni antiriciclaggio','Anti-money laundering transaction monitoring'),
  ('sys_learning_modules','learning_module_title','PSD2 e Open Banking','PSD2 and Open Banking'),
  ('sys_learning_modules','learning_module_title','PSD2, open banking e pagamenti digitali','PSD2, open banking and digital payments'),
  ('sys_learning_modules','learning_module_title','Panoramica dei sistemi di core banking','Overview of core banking systems'),
  ('sys_learning_modules','learning_module_title','Prevenzione delle frodi per il personale di prima linea','Fraud prevention for front-line staff'),
  ('sys_learning_modules','learning_module_title','Private banking e gestione patrimoniale','Private banking and wealth management'),
  ('sys_learning_modules','learning_module_title','SQL per Data Analysts','SQL for Data Analysts'),
  ('sys_learning_modules','learning_module_title','Sicurezza informatica nei servizi finanziari','Information security in financial services'),
  ('sys_learning_modules','learning_module_title','Sicurezza sul Lavoro','Occupational Safety'),
  ('sys_learning_modules','learning_module_title','Sistemi di core banking e operatività di sportello','Core banking systems and teller operations'),
  ('sys_learning_modules','learning_module_title','Tesoreria e mercati finanziari','Treasury and financial markets'),
  ('sys_learning_modules','learning_module_title','Trade finance e operazioni con l''estero','Trade finance and foreign transactions'),
  ('sys_learning_modules','learning_module_title','Vendita etica in banca','Ethical selling in banking'),
  ('sys_learning_paths','learning_path_description','Corso base sulle competenze di leadership e gestione team','Foundation course on leadership and team management skills'),
  ('sys_learning_paths','learning_path_description','Metodologie consulenza: materiality analysis, scenario planning, target setting (SBTi), implementation roadmaps.','Advisory methodologies: materiality analysis, scenario planning, target setting (SBTi), implementation roadmaps.'),
  ('sys_learning_paths','learning_path_name','Metodi di consulenza sulla sostenibilità','Sustainability advisory methods'),
  ('sys_organization_units','organization_unit_name','Divisione Operations & Administration','Operations & Administration Division'),
  ('sys_organization_units','organization_unit_name','Divisione Product & Development','Product & Development Division'),
  ('sys_organization_units','organization_unit_name','Heuresys S.r.l.','Heuresys S.r.l.'),
  ('sys_positions','position_title','CEO & Founder','CEO & Founder'),
  ('sys_positions','position_title','COO','COO'),
  ('sys_positions','position_title','Responsabile Prodotti','Head of Products'),
  ('sys_projects','project_name','Squadra Servizio Clienti','Customer Service Team'),
  ('sys_teams','team_name','Squadra Servizio Clienti','Customer Service Team'),
  ('sys_ui_interfaces','ui_interface_label','Compensation','Compensation'),
  ('sys_ui_interfaces','ui_interface_label','Competenze per categoria','Skills by category'),
  ('sys_ui_interfaces','ui_interface_label','Gap','Gap'),
  ('sys_ui_interfaces','ui_interface_label','KPI','KPIs'),
  ('sys_ui_interfaces','ui_interface_label','Quote competenze per gruppo','Skill shares by group'),
  ('sys_ui_interfaces','ui_interface_label','Rete organizzativa','Organisational network'),
  ('sys_ui_interfaces','ui_interface_label','Richieste di straordinario','Overtime requests'),
  ('sys_ui_interfaces','ui_interface_label','Skill gap','Skill gap'),
  ('sys_ui_interfaces','ui_interface_label','Succession readiness','Succession readiness');

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_derivations', r.blueprint_content_derivation_id, 'rule', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_derivations r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_derivations' AND v.colonna = 'blueprint_content_derivation_rule' AND btrim(r.blueprint_content_derivation_rule) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_kpis', r.blueprint_content_kpi_id, 'data_source', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_kpis r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_data_source' AND btrim(r.blueprint_content_kpi_data_source) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_kpis', r.blueprint_content_kpi_id, 'formula', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_kpis r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_formula' AND btrim(r.blueprint_content_kpi_formula) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_kpis', r.blueprint_content_kpi_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_kpis r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_name' AND btrim(r.blueprint_content_kpi_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_kpis', r.blueprint_content_kpi_id, 'reference_text', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_kpis r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_reference_text' AND btrim(r.blueprint_content_kpi_reference_text) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_positions', r.blueprint_content_position_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_positions r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_positions' AND v.colonna = 'blueprint_content_position_title' AND btrim(r.blueprint_content_position_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_skills', r.blueprint_content_skill_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_skills r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_skills' AND v.colonna = 'blueprint_content_skill_name' AND btrim(r.blueprint_content_skill_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_content_units', r.blueprint_content_unit_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_content_units r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_units' AND v.colonna = 'blueprint_content_unit_name' AND btrim(r.blueprint_content_unit_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_blueprint_process_registry', r.blueprint_process_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_blueprint_process_registry r
  JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_process_registry' AND v.colonna = 'blueprint_process_name' AND btrim(r.blueprint_process_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_modules', r.learning_module_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_learning_modules r
  JOIN _piattaforma_en v ON v.tabella = 'sys_learning_modules' AND v.colonna = 'learning_module_title' AND btrim(r.learning_module_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_paths', r.learning_path_id, 'description', 'en', v.en, 'LLM'
  FROM sys.sys_learning_paths r
  JOIN _piattaforma_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_description' AND btrim(r.learning_path_description) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_paths', r.learning_path_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_learning_paths r
  JOIN _piattaforma_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_name' AND btrim(r.learning_path_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_organization_units', r.organization_unit_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_organization_units r
  JOIN _piattaforma_en v ON v.tabella = 'sys_organization_units' AND v.colonna = 'organization_unit_name' AND btrim(r.organization_unit_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_positions', r.position_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_positions r
  JOIN _piattaforma_en v ON v.tabella = 'sys_positions' AND v.colonna = 'position_title' AND btrim(r.position_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_projects', r.project_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_projects r
  JOIN _piattaforma_en v ON v.tabella = 'sys_projects' AND v.colonna = 'project_name' AND btrim(r.project_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_teams', r.team_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_teams r
  JOIN _piattaforma_en v ON v.tabella = 'sys_teams' AND v.colonna = 'team_name' AND btrim(r.team_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', r.ui_interface_id, 'ui_interface_label', 'en', v.en, 'LLM'
  FROM sys.sys_ui_interfaces r
  JOIN _piattaforma_en v ON v.tabella = 'sys_ui_interfaces' AND v.colonna = 'ui_interface_label' AND btrim(r.ui_interface_label) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

-- Post-condizione: conteggi per coppia, nessuna riga corrispondente senza inglese,
-- nessun orfano nelle tabelle toccate.
DO $$
DECLARE esito record; orfani bigint;
BEGIN
  FOR esito IN
  SELECT 'sys_blueprint_content_derivations' AS tabella, 'blueprint_content_derivation_rule' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_derivations r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_derivations' AND v.colonna = 'blueprint_content_derivation_rule' AND btrim(r.blueprint_content_derivation_rule) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_derivations' AND tr.entity_id = r.blueprint_content_derivation_id AND tr.field = 'rule' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_kpis' AS tabella, 'blueprint_content_kpi_data_source' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_kpis r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_data_source' AND btrim(r.blueprint_content_kpi_data_source) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_kpis' AND tr.entity_id = r.blueprint_content_kpi_id AND tr.field = 'data_source' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_kpis' AS tabella, 'blueprint_content_kpi_formula' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_kpis r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_formula' AND btrim(r.blueprint_content_kpi_formula) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_kpis' AND tr.entity_id = r.blueprint_content_kpi_id AND tr.field = 'formula' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_kpis' AS tabella, 'blueprint_content_kpi_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_kpis r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_name' AND btrim(r.blueprint_content_kpi_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_kpis' AND tr.entity_id = r.blueprint_content_kpi_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_kpis' AS tabella, 'blueprint_content_kpi_reference_text' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_kpis r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_kpis' AND v.colonna = 'blueprint_content_kpi_reference_text' AND btrim(r.blueprint_content_kpi_reference_text) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_kpis' AND tr.entity_id = r.blueprint_content_kpi_id AND tr.field = 'reference_text' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_positions' AS tabella, 'blueprint_content_position_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_positions r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_positions' AND v.colonna = 'blueprint_content_position_title' AND btrim(r.blueprint_content_position_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_positions' AND tr.entity_id = r.blueprint_content_position_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_skills' AS tabella, 'blueprint_content_skill_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_skills r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_skills' AND v.colonna = 'blueprint_content_skill_name' AND btrim(r.blueprint_content_skill_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_skills' AND tr.entity_id = r.blueprint_content_skill_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_content_units' AS tabella, 'blueprint_content_unit_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_content_units r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_content_units' AND v.colonna = 'blueprint_content_unit_name' AND btrim(r.blueprint_content_unit_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_content_units' AND tr.entity_id = r.blueprint_content_unit_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_blueprint_process_registry' AS tabella, 'blueprint_process_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_blueprint_process_registry r
    JOIN _piattaforma_en v ON v.tabella = 'sys_blueprint_process_registry' AND v.colonna = 'blueprint_process_name' AND btrim(r.blueprint_process_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_blueprint_process_registry' AND tr.entity_id = r.blueprint_process_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_modules' AS tabella, 'learning_module_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_modules r
    JOIN _piattaforma_en v ON v.tabella = 'sys_learning_modules' AND v.colonna = 'learning_module_title' AND btrim(r.learning_module_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_modules' AND tr.entity_id = r.learning_module_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_paths' AS tabella, 'learning_path_description' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_paths r
    JOIN _piattaforma_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_description' AND btrim(r.learning_path_description) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_paths' AND tr.entity_id = r.learning_path_id AND tr.field = 'description' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_paths' AS tabella, 'learning_path_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_paths r
    JOIN _piattaforma_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_name' AND btrim(r.learning_path_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_paths' AND tr.entity_id = r.learning_path_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_organization_units' AS tabella, 'organization_unit_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_organization_units r
    JOIN _piattaforma_en v ON v.tabella = 'sys_organization_units' AND v.colonna = 'organization_unit_name' AND btrim(r.organization_unit_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_organization_units' AND tr.entity_id = r.organization_unit_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_positions' AS tabella, 'position_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_positions r
    JOIN _piattaforma_en v ON v.tabella = 'sys_positions' AND v.colonna = 'position_title' AND btrim(r.position_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_positions' AND tr.entity_id = r.position_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_projects' AS tabella, 'project_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_projects r
    JOIN _piattaforma_en v ON v.tabella = 'sys_projects' AND v.colonna = 'project_name' AND btrim(r.project_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_projects' AND tr.entity_id = r.project_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_teams' AS tabella, 'team_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_teams r
    JOIN _piattaforma_en v ON v.tabella = 'sys_teams' AND v.colonna = 'team_name' AND btrim(r.team_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_teams' AND tr.entity_id = r.team_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_ui_interfaces' AS tabella, 'ui_interface_label' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_ui_interfaces r
    JOIN _piattaforma_en v ON v.tabella = 'sys_ui_interfaces' AND v.colonna = 'ui_interface_label' AND btrim(r.ui_interface_label) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_ui_interfaces' AND tr.entity_id = r.ui_interface_id AND tr.field = 'ui_interface_label' AND tr.locale = 'en'
  LOOP
    RAISE NOTICE '000520: %.% — % valori, % righe, % con inglese', esito.tabella, esito.colonna, esito.valori, esito.righe, esito.tradotte;
    IF esito.tradotte <> esito.righe THEN
      RAISE EXCEPTION '000520: %.% ha % righe senza inglese', esito.tabella, esito.colonna, esito.righe - esito.tradotte;
    END IF;
  END LOOP;
  SELECT count(*) INTO orfani
    FROM sys.v_reference_translation_orphans o
   WHERE o.entity_table IN (SELECT DISTINCT tabella FROM _piattaforma_en);
  IF orfani > 0 THEN
    RAISE EXCEPTION '000520: % traduzioni orfane nelle tabelle toccate', orfani;
  END IF;
END $$;

DROP TABLE IF EXISTS pg_temp._piattaforma_en;
