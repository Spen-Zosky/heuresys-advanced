-- ============================================================================
-- Migration 000517 — I contenuti di RTL hanno l'inglese (ADR-0062, passo 3; ADR-0029).
--
-- Fatto misurato il 2026-11-26, in sola lettura su produzione e gemello: i campi di
-- contenuto del tenant RTL_BANK (16 colonne di 14 tabelle sys.*) non hanno nessuna riga
-- in sys.sys_reference_translations e non sono nel registro sys.sys_translatable_field,
-- quindi le pagine in inglese li mostrano in italiano.
--
-- Cosa fa:
--   (a) registra le 16 coppie tabella-campo;
--   (b) mette in una tabella temporanea le coppie italiano/inglese scritte qui sotto;
--   (c) scrive l'inglese per ogni riga il cui testo italiano coincide (btrim), con
--       source = 'LLM'. Il testo italiano nella riga non cambia.
--
-- Il confronto è sul testo: vale per ogni riga con lo stesso valore, di qualunque tenant
-- (stessa regola del glossario dell'API, ADR-0062). Dove il valore non esiste, niente.
-- Nei criteri la traduzione omette il riferimento interno iniziale («Proposta
-- dell'agente (0005xx)»); il criterio della verifica del rilascio diventa la sola data.
-- Lo stesso testo italiano ha lo stesso inglese in ogni tabella e colonna (il glossario
-- dell'API cerca per testo).
--
-- Idempotenza: ON CONFLICT; si aggiornano solo le righe 'LLM' con testo diverso, quindi
-- una seconda passata non modifica niente. Le traduzioni di altra fonte restano.
--
-- Come annullare: cancellare le righe di sys.sys_reference_translations con locale 'en'
-- e source = 'LLM' delle 16 coppie elencate in (a). Le righe di registro con
-- note = 'contenuti dei tenant' restano innocue.
--
-- Le post-condizioni di copertura della 000255 e gemelle lasciano fuori i campi con
-- note = 'contenuti dei tenant' (emendate insieme alla 000516): il dato dei tenant cambia nell'uso.
--
-- Esclusi: sono esclusi solo i letterali interi del codice che gira in apps/web/src,
-- apps/api/src e packages/shared/src (i file di test non contano). Valori esclusi: nessuno.

-- ============================================================================

INSERT INTO sys.sys_translatable_field
  (entity_table, entity_pk_column, field, entity_field_column, note)
VALUES
  ('sys_career_paths','career_path_id','name','career_path_name','contenuti dei tenant'),
  ('sys_goals','goal_id','title','goal_title','contenuti dei tenant'),
  ('sys_learning_modules','learning_module_id','title','learning_module_title','contenuti dei tenant'),
  ('sys_learning_paths','learning_path_id','description','learning_path_description','contenuti dei tenant'),
  ('sys_learning_paths','learning_path_id','name','learning_path_name','contenuti dei tenant'),
  ('sys_okrs','okr_id','objective','okr_objective','contenuti dei tenant'),
  ('sys_organization_units','organization_unit_id','name','organization_unit_name','contenuti dei tenant'),
  ('sys_positions','position_id','title','position_title','contenuti dei tenant'),
  ('sys_projects','project_id','name','project_name','contenuti dei tenant'),
  ('sys_surveys','survey_id','title','survey_title','contenuti dei tenant'),
  ('sys_teams','team_id','name','team_name','contenuti dei tenant'),
  ('sys_tenant_process_facets','tenant_process_facet_id','criterion','tenant_process_facet_criterion','contenuti dei tenant'),
  ('sys_tenant_process_steps','tenant_process_step_id','name','tenant_process_step_name','contenuti dei tenant'),
  ('sys_tenant_processes','tenant_process_id','description','tenant_process_description','contenuti dei tenant'),
  ('sys_tenant_processes','tenant_process_id','name','tenant_process_name','contenuti dei tenant'),
  ('sys_training_initiatives','training_initiative_id','cohort_name','training_initiative_cohort_name','contenuti dei tenant')
ON CONFLICT (entity_table, field) DO UPDATE
  SET entity_pk_column = EXCLUDED.entity_pk_column,
      entity_field_column = EXCLUDED.entity_field_column,
      note = EXCLUDED.note;

DROP TABLE IF EXISTS pg_temp._rtl_en;
CREATE TEMPORARY TABLE _rtl_en (
  tabella text NOT NULL,
  colonna text NOT NULL,
  it      text NOT NULL,
  en      text NOT NULL,
  PRIMARY KEY (tabella, colonna, it)
);

INSERT INTO _rtl_en (tabella, colonna, it, en) VALUES
  ('sys_tenant_processes','tenant_process_name','Acquisizione e onboarding clienti','Customer acquisition and onboarding'),
  ('sys_tenant_processes','tenant_process_name','Adeguata verifica e antiriciclaggio','Customer due diligence and anti-money laundering'),
  ('sys_tenant_processes','tenant_process_name','Analisi e gestione delle performance dei canali','Channel performance analysis and management'),
  ('sys_tenant_processes','tenant_process_name','Apertura dei conti','Account opening'),
  ('sys_tenant_processes','tenant_process_name','Apertura e gestione conti','Account opening and management'),
  ('sys_tenant_processes','tenant_process_name','Approvvigionamenti e gestione fornitori','Procurement and supplier management'),
  ('sys_tenant_processes','tenant_process_name','Audit interno','Internal audit'),
  ('sys_tenant_processes','tenant_process_name','Chiusura dei conti','Account closure'),
  ('sys_tenant_processes','tenant_process_name','Compliance e reportistica regolamentare','Compliance and regulatory reporting'),
  ('sys_tenant_processes','tenant_process_name','Comprensione dei mercati, dei clienti e delle capacità','Understanding markets, customers and capabilities'),
  ('sys_tenant_processes','tenant_process_name','Dati e analytics','Data and analytics'),
  ('sys_tenant_processes','tenant_process_name','Definizione del modello di business e della visione di lungo periodo','Definition of the business model and long-term vision'),
  ('sys_tenant_processes','tenant_process_name','Elaborazione delle retribuzioni (payroll)','Payroll processing'),
  ('sys_tenant_processes','tenant_process_name','Erogazione del credito','Loan origination'),
  ('sys_tenant_processes','tenant_process_name','Facility e immobili','Facilities and real estate'),
  ('sys_tenant_processes','tenant_process_name','Finanza e contabilità','Finance and accounting'),
  ('sys_tenant_processes','tenant_process_name','Gestione degli ordini di vendita e cross-sell/up-sell','Sales order management and cross-selling/up-selling'),
  ('sys_tenant_processes','tenant_process_name','Gestione dei programmi di sicurezza (fisica e antirapina)','Security programme management (physical security and anti-robbery)'),
  ('sys_tenant_processes','tenant_process_name','Gestione dei rapporti con il consiglio di amministrazione','Board of directors relations management'),
  ('sys_tenant_processes','tenant_process_name','Gestione dei reclami e della customer satisfaction','Complaints and customer satisfaction management'),
  ('sys_tenant_processes','tenant_process_name','Gestione del capitale umano','Human capital management'),
  ('sys_tenant_processes','tenant_process_name','Gestione del rischio','Risk management'),
  ('sys_tenant_processes','tenant_process_name','Gestione del rischio di mercato','Market risk management'),
  ('sys_tenant_processes','tenant_process_name','Gestione della cassa','Cash management'),
  ('sys_tenant_processes','tenant_process_name','Investimenti retail','Retail investments'),
  ('sys_tenant_processes','tenant_process_name','IT e cybersecurity','IT and cybersecurity'),
  ('sys_tenant_processes','tenant_process_name','Legale','Legal'),
  ('sys_tenant_processes','tenant_process_name','Mantenimento dei conti','Account maintenance'),
  ('sys_tenant_processes','tenant_process_name','Marketing e comunicazione','Marketing and communications'),
  ('sys_tenant_processes','tenant_process_name','Monitoraggio e recupero crediti','Credit monitoring and collection'),
  ('sys_tenant_processes','tenant_process_name','Monitoraggio ed esecuzione di operazioni di rischio e hedging','Risk and hedging transaction monitoring and execution'),
  ('sys_tenant_processes','tenant_process_name','Onboarding, formazione e sviluppo dei dipendenti','Employee onboarding, training and development'),
  ('sys_tenant_processes','tenant_process_name','Operatività di filiale','Branch operations'),
  ('sys_tenant_processes','tenant_process_name','Pagamenti e bonifici','Payments and credit transfers'),
  ('sys_tenant_processes','tenant_process_name','Pianificazione e controllo di gestione','Planning and management control'),
  ('sys_tenant_processes','tenant_process_name','Pianificazione, politiche e strategie HR','HR planning, policies and strategies'),
  ('sys_tenant_processes','tenant_process_name','Reclutamento e selezione del personale','Recruitment and selection'),
  ('sys_tenant_processes','tenant_process_name','Remunerazione e retention dei dipendenti','Employee compensation and retention'),
  ('sys_tenant_processes','tenant_process_name','Servizi di investimento','Investment services'),
  ('sys_tenant_processes','tenant_process_name','Servizio alla clientela bancaria (credito e finanziamenti)','Banking customer service (credit and lending)'),
  ('sys_tenant_processes','tenant_process_name','Servizio clienti','Customer service'),
  ('sys_tenant_processes','tenant_process_name','Strategia e governance aziendale','Corporate strategy and governance'),
  ('sys_tenant_processes','tenant_process_name','Sviluppo della strategia di vendita','Sales strategy development'),
  ('sys_tenant_processes','tenant_process_name','Tesoreria e ALM','Treasury and ALM'),
  ('sys_tenant_processes','tenant_process_description','Analizza il mercato locale, i segmenti di clientela (famiglie, professionisti, PMI) e le capacità competitive della banca.','Analyses the local market, the customer segments (households, professionals, SMEs) and the bank''s competitive capabilities.'),
  ('sys_tenant_processes','tenant_process_description','Autorizza, esegue e regola i pagamenti e i trasferimenti di fondi della clientela.','Authorises, executes and settles customer payments and fund transfers.'),
  ('sys_tenant_processes','tenant_process_description','Cura la governance societaria e l''interfaccia operativa tra direzione e organo amministrativo.','Handles corporate governance and the operational interface between management and the board of directors.'),
  ('sys_tenant_processes','tenant_process_description','Definisce e gestisce i programmi di sicurezza fisica, i presidi antirapina e la risposta agli eventi criminosi nelle filiali.','Defines and manages physical security programmes, anti-robbery safeguards and the response to criminal incidents in branches.'),
  ('sys_tenant_processes','tenant_process_description','Definisce il modello di banca commerciale regionale e gli obiettivi di lungo periodo del gruppo.','Defines the regional commercial banking model and the group''s long-term objectives.'),
  ('sys_tenant_processes','tenant_process_description','Definisce la strategia commerciale e gli obiettivi di vendita per la rete di filiali.','Defines the commercial strategy and sales targets for the branch network.'),
  ('sys_tenant_processes','tenant_process_description','Definisce le politiche di affidamento e valuta l''approvazione delle nuove richieste di credito.','Defines lending policies and assesses the approval of new credit applications.'),
  ('sys_tenant_processes','tenant_process_description','Definisce politiche, organico e strategie di gestione del personale per sede centrale, centro operativo e filiali.','Defines HR policies, headcount and people management strategies for the head office, the operations centre and the branches.'),
  ('sys_tenant_processes','tenant_process_description','Elabora budget, reporting direzionale e controllo delle performance economico-finanziarie.','Prepares budgets, management reporting and monitoring of economic and financial performance.'),
  ('sys_tenant_processes','tenant_process_description','Elabora la strategia di crescita, posizionamento e sviluppo commerciale della banca sul territorio.','Develops the bank''s strategy for growth, positioning and commercial development in its territory.'),
  ('sys_tenant_processes','tenant_process_description','Elabora le retribuzioni e gli adempimenti connessi per tutto il personale della banca.','Processes payroll and the related obligations for all bank staff.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce gli acquisti di beni e servizi per tutte le sedi della banca.','Manages the purchase of goods and services for all bank sites.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce i contatti con la clientela su più canali, incluso il presidio del front-office in filiale.','Manages customer contacts across multiple channels, including front-office coverage in the branch.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce il rischio operativo e applica i presidi antiriciclaggio previsti dal D.Lgs. 231/2007 su tutta la rete.','Manages operational risk and applies the anti-money laundering safeguards required by Legislative Decree 231/2007 across the whole network.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce in filiale la vendita di prodotti bancari e le attività di cross-sell/up-sell alla clientela.','Manages the in-branch sale of banking products and cross-selling/up-selling to customers.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce inserimento, formazione obbligatoria (incluso antiriciclaggio e sicurezza) e sviluppo del personale.','Manages staff onboarding, mandatory training (including anti-money laundering and safety) and development.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce l''apertura dei conti con identificazione del cliente, adeguata verifica AML e attivazione del rapporto.','Manages account opening, including customer identification, AML due diligence and activation of the relationship.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce l''apertura e chiusura della cassa, la riconciliazione di incassi e pagamenti e le misure di sicurezza antirapina.','Manages cash opening and closing, reconciliation of receipts and payments and anti-robbery security measures.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce la chiusura dei rapporti su istruzione del cliente, il calcolo del saldo finale e la registrazione nel sistema.','Manages the closure of relationships on the customer''s instruction, the calculation of the final balance and its recording in the system.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce politiche retributive, incentivi e fidelizzazione del personale.','Manages remuneration policies, incentives and staff retention.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce reclutamento e selezione per ruoli di sede, back office e filiale.','Manages recruitment and selection for head office, back office and branch roles.'),
  ('sys_tenant_processes','tenant_process_description','Gestisce rimborsi, modifiche contrattuali, revisione e concessione del credito ai clienti retail e PMI.','Manages repayments, contractual amendments, reviews and the granting of credit to retail and SME customers.'),
  ('sys_tenant_processes','tenant_process_description','Misura e governa l''esposizione della banca alle variazioni di tassi, prezzi e cambi.','Measures and governs the bank''s exposure to changes in interest rates, prices and exchange rates.'),
  ('sys_tenant_processes','tenant_process_description','Monitora e integra i canali di contatto con la clientela (filiale, home banking, call center).','Monitors and integrates the customer contact channels (branch, home banking, call centre).'),
  ('sys_tenant_processes','tenant_process_description','Monitora i limiti di controparte e gestisce le operazioni di copertura del rischio finanziario.','Monitors counterparty limits and manages financial risk hedging transactions.'),
  ('sys_tenant_processes','tenant_process_description','Monitora lo stato dei conti, gestisce commissioni e movimenti e assicura la riconciliazione contabile tra filiale e back office.','Monitors account status, manages fees and transactions and ensures accounting reconciliation between branch and back office.'),
  ('sys_tenant_processes','tenant_process_description','Presidia il rispetto della normativa bancaria e finanziaria applicabile, incluse le disposizioni di vigilanza.','Oversees compliance with the applicable banking and financial regulations, including supervisory provisions.'),
  ('sys_tenant_processes','tenant_process_description','Presidia il sistema dei controlli interni (revisione interna, risk management, compliance) richiesto dalla vigilanza.','Oversees the internal control system (internal audit, risk management, compliance) required by banking supervision.'),
  ('sys_tenant_processes','tenant_process_description','Riceve, istruisce e risponde ai reclami della clientela entro i termini di legge e misura la soddisfazione del cliente.','Receives, investigates and answers customer complaints within the legal deadlines and measures customer satisfaction.'),
  ('sys_tenant_processes','tenant_process_description','Sviluppa e gestisce i sistemi informativi di core banking a supporto di sede centrale, centro operativo e filiali.','Develops and manages the core banking information systems that support the head office, the operations centre and the branches.'),
  ('sys_tenant_process_steps','tenant_process_step_name','Affinare gli indicatori delle promozioni','Refine promotion metrics'),
  ('sys_tenant_process_steps','tenant_process_step_name','Aggiornare i dati del cliente','Update customer data'),
  ('sys_tenant_process_steps','tenant_process_step_name','Allocare il capitale a fronte del rischio operativo','Allocate capital against operational risk'),
  ('sys_tenant_process_steps','tenant_process_step_name','Amministrare conti di terzi (depositi vincolati, fondi, trust)','Administer third-party accounts (escrow deposits, funds, trusts)'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare i dati','Analyse data'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare i saldi delle posizioni insolventi','Analyse delinquent account balances'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare il merito creditizio del cliente','Analyse customer creditworthiness'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare l''andamento dell''adeguatezza patrimoniale','Analyse capital adequacy trends'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare le prestazioni di acquisti e fornitori','Analyse procurement and supplier performance'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare lo storico dei rischi operativi','Analyse operational risk history'),
  ('sys_tenant_process_steps','tenant_process_step_name','Analizzare problemi, richieste e domande','Analyse issues, requests and enquiries'),
  ('sys_tenant_process_steps','tenant_process_step_name','Applicare il prezzo del prodotto','Apply product pricing'),
  ('sys_tenant_process_steps','tenant_process_step_name','Applicare la politica antiriciclaggio','Apply the anti-money laundering policy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Applicare la politica di identificazione del cliente','Apply the customer identification policy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Applicare le condizioni del prodotto','Apply product terms and conditions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Assegnare la titolarità dei rischi','Assign risk ownership'),
  ('sys_tenant_process_steps','tenant_process_step_name','Autorizzare gli ordini','Authorise orders'),
  ('sys_tenant_process_steps','tenant_process_step_name','Autorizzare le operazioni','Authorise transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Calcolare i rischi operativi con i modelli interni','Calculate operational risk using internal models'),
  ('sys_tenant_process_steps','tenant_process_step_name','Calcolare i rischi operativi secondo Basilea, CRD e norme nazionali','Calculate operational risk under Basel, CRD and national rules'),
  ('sys_tenant_process_steps','tenant_process_step_name','Calcolare il rendimento degli investimenti','Calculate investment returns'),
  ('sys_tenant_process_steps','tenant_process_step_name','Cogliere le opportunità di vendita aggiuntiva e incrociata','Capture up-selling and cross-selling opportunities'),
  ('sys_tenant_process_steps','tenant_process_step_name','Compilare e comunicare i quadri di conformità','Compile and communicate compliance scorecards'),
  ('sys_tenant_process_steps','tenant_process_step_name','Compilare e comunicare le segnalazioni interne e di vigilanza','Compile and communicate internal and regulatory reports'),
  ('sys_tenant_process_steps','tenant_process_step_name','Comprendere la tolleranza al rischio delle unità di business','Understand the risk tolerance of business units'),
  ('sys_tenant_process_steps','tenant_process_step_name','Concordare la soluzione della posizione con le funzioni interne','Agree the account resolution with internal functions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Condurre il recupero','Perform recovery'),
  ('sys_tenant_process_steps','tenant_process_step_name','Configurare e attivare il rapporto','Set up and activate the relationship'),
  ('sys_tenant_process_steps','tenant_process_step_name','Contabilizzare gli strumenti finanziari','Account for financial instruments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Controllare la qualità delle forniture','Check the quality of supplies'),
  ('sys_tenant_process_steps','tenant_process_step_name','Corrispondere e negoziare con i debitori insolventi','Correspond and negotiate with delinquent debtors'),
  ('sys_tenant_process_steps','tenant_process_step_name','Curare i rapporti con le autorità di vigilanza','Manage relations with supervisory authorities'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire concetti e obiettivi promozionali','Define promotional concepts and objectives'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire e mantenere i ruoli di gestione del rischio','Define and maintain risk management roles'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire gli obiettivi di conformità','Define compliance objectives'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire il pubblico di riferimento','Define the target audience'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire le politiche sulle posizioni insolventi','Define delinquent account policies'),
  ('sys_tenant_process_steps','tenant_process_step_name','Definire le strategie di mitigazione dei rischi IT','Define IT risk mitigation strategies'),
  ('sys_tenant_process_steps','tenant_process_step_name','Determinare i requisiti normativi e di audit dell''IT','Determine IT regulatory and audit requirements'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire i pagamenti in entrata','Execute incoming payments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire i pagamenti in uscita','Execute outgoing payments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire il consolidamento e le elisioni','Perform consolidation and eliminations'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire il regolamento','Execute settlement'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire le attività promozionali','Run promotional activities'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire le negoziazioni','Execute trades'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire le rettifiche di fine periodo','Perform period-end adjustments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire le rimesse','Execute remittances'),
  ('sys_tenant_process_steps','tenant_process_step_name','Eseguire le ripartizioni','Perform allocations'),
  ('sys_tenant_process_steps','tenant_process_step_name','Far sanare le carenze dei controlli','Ensure control deficiencies are remediated'),
  ('sys_tenant_process_steps','tenant_process_step_name','Finanziare ed erogare gli importi','Fund and disburse amounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Fornire consulenza legale','Provide legal advice'),
  ('sys_tenant_process_steps','tenant_process_step_name','Fornire estratti conto e rendiconti','Provide account statements and reports'),
  ('sys_tenant_process_steps','tenant_process_step_name','Garantire accesso e sicurezza delle sedi','Ensure site access and security'),
  ('sys_tenant_process_steps','tenant_process_step_name','Generare gli ordini','Generate orders'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire commissioni, interessi e competenze','Manage fees, interest and charges'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire i finanziamenti in pool','Manage syndicated loans'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire i rimborsi','Manage repayments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire il contante','Manage cash'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire l''inserimento dei dipendenti','Manage employee onboarding'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire la prestazione dei dipendenti','Manage employee performance'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire le cartolarizzazioni','Manage securitisations'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire le informazioni sui fornitori','Manage supplier information'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire le modifiche negoziate','Manage negotiated amendments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire le posizioni in default','Manage defaulted accounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire le procedure antiriciclaggio','Manage anti-money laundering procedures'),
  ('sys_tenant_process_steps','tenant_process_step_name','Gestire lo sviluppo di carriera','Manage career development'),
  ('sys_tenant_process_steps','tenant_process_step_name','Individuare e valutare i rischi IT','Identify and assess IT risks'),
  ('sys_tenant_process_steps','tenant_process_step_name','Individuare i requisiti normativi applicabili','Identify applicable regulatory requirements'),
  ('sys_tenant_process_steps','tenant_process_step_name','Individuare i sistemi a supporto della conformità','Identify the systems supporting compliance'),
  ('sys_tenant_process_steps','tenant_process_step_name','Introdurre o rafforzare controlli e politiche di conformità','Introduce or strengthen compliance controls and policies'),
  ('sys_tenant_process_steps','tenant_process_step_name','Monitorare e gestire gli eventi del conto','Monitor and manage account events'),
  ('sys_tenant_process_steps','tenant_process_step_name','Monitorare e valutare i gestori esterni','Monitor and evaluate external managers'),
  ('sys_tenant_process_steps','tenant_process_step_name','Monitorare i movimenti dei conti','Monitor account transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Monitorare la redditività dei prodotti','Monitor product profitability'),
  ('sys_tenant_process_steps','tenant_process_step_name','Monitorare lo stato dei conti','Monitor account status'),
  ('sys_tenant_process_steps','tenant_process_step_name','Passare le opportunità alla rete commerciale','Pass leads to the sales network'),
  ('sys_tenant_process_steps','tenant_process_step_name','Pianificare e provare le attività promozionali','Plan and test promotional activities'),
  ('sys_tenant_process_steps','tenant_process_step_name','Pianificare negoziazione ed esecuzione','Plan trading and execution'),
  ('sys_tenant_process_steps','tenant_process_step_name','Preparare e negoziare i contratti quadro','Prepare and negotiate master agreements'),
  ('sys_tenant_process_steps','tenant_process_step_name','Preparare e registrare le rettifiche gestionali','Prepare and record management adjustments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Preparare il bilancio di verifica','Prepare the trial balance'),
  ('sys_tenant_process_steps','tenant_process_step_name','Preparare le conferme delle operazioni','Prepare transaction confirmations'),
  ('sys_tenant_process_steps','tenant_process_step_name','Prevedere il fabbisogno a fronte del rischio operativo','Forecast operational risk requirements'),
  ('sys_tenant_process_steps','tenant_process_step_name','Prezzare le operazioni','Price transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Produrre l''informativa di vigilanza (COREP) e la reportistica interna','Produce regulatory disclosures (COREP) and internal reporting'),
  ('sys_tenant_process_steps','tenant_process_step_name','Raccogliere i dati di perdite ed eventi di rischio operativo','Collect operational risk loss and event data'),
  ('sys_tenant_process_steps','tenant_process_step_name','Registrare e riconciliare le operazioni infragruppo','Record and reconcile intercompany transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Registrare le rettifiche nel sistema contabile','Post adjustments to the accounting system'),
  ('sys_tenant_process_steps','tenant_process_step_name','Registrare le scritture contabili','Post accounting entries'),
  ('sys_tenant_process_steps','tenant_process_step_name','Registrare rettifiche e stralci','Record adjustments and write-offs'),
  ('sys_tenant_process_steps','tenant_process_step_name','Regolare le operazioni di trasferimento','Settle transfer transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Ribilanciare i portafogli','Rebalance portfolios'),
  ('sys_tenant_process_steps','tenant_process_step_name','Ricevere problemi, richieste e domande dei clienti','Receive customer issues, requests and enquiries'),
  ('sys_tenant_process_steps','tenant_process_step_name','Riconciliare i conti','Reconcile accounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Riconciliare i conti di contabilità generale','Reconcile general ledger accounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Riportare quanto appreso nelle promozioni future','Feed lessons learned into future promotions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Risolvere problemi, richieste e domande','Resolve issues, requests and enquiries'),
  ('sys_tenant_process_steps','tenant_process_step_name','Rispondere ai clienti','Respond to customers'),
  ('sys_tenant_process_steps','tenant_process_step_name','Rivedere ed estendere il credito','Review and extend credit'),
  ('sys_tenant_process_steps','tenant_process_step_name','Rivedere il portafoglio dei prodotti','Review the product portfolio'),
  ('sys_tenant_process_steps','tenant_process_step_name','Rivedere periodicamente garanzie e collaterali','Periodically review guarantees and collateral'),
  ('sys_tenant_process_steps','tenant_process_step_name','Seguire l''evoluzione delle norme','Track regulatory developments'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sostenere le scorte e l''operatività','Support inventory and operations'),
  ('sys_tenant_process_steps','tenant_process_step_name','Stabilire la tolleranza al rischio IT','Set IT risk tolerance'),
  ('sys_tenant_process_steps','tenant_process_step_name','Strutturare e negoziare le operazioni','Structure and negotiate transactions'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare e formare i dipendenti','Develop and train employees'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare i messaggi di marketing','Develop marketing messages'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia dei servizi condivisi','Develop the shared services strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia dei servizi di supporto','Develop the support services strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia di fusioni, scissioni, acquisizioni e uscite','Develop the merger, demerger, acquisition and exit strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia di innovazione','Develop the innovation strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia di miglioramento continuo','Develop the continuous improvement strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia di partnership e alleanze','Develop the partnership and alliance strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare la strategia di sostenibilità','Develop the sustainability strategy'),
  ('sys_tenant_process_steps','tenant_process_step_name','Sviluppare le procedure di conformità normativa','Develop regulatory compliance procedures'),
  ('sys_tenant_process_steps','tenant_process_step_name','Tenere i conti interni','Keep internal accounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Tenere il piano dei conti','Maintain the chart of accounts'),
  ('sys_tenant_process_steps','tenant_process_step_name','Tenere la contabilità bancaria','Keep the bank''s accounting records'),
  ('sys_tenant_process_steps','tenant_process_step_name','Tenere la contabilità dei contratti','Maintain contract accounting'),
  ('sys_tenant_process_steps','tenant_process_step_name','Trasferire le persone','Transfer people'),
  ('sys_tenant_process_steps','tenant_process_step_name','Trasferire materiali e attrezzature','Transfer materials and equipment'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare garanzie e collaterali','Assess guarantees and collateral'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare gli indicatori delle promozioni','Assess promotion metrics'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare il livello di conformità e individuarne le carenze','Assess the level of compliance and identify gaps'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare il rendimento rispetto alla politica d''investimento e ai parametri di riferimento','Assess performance against the investment policy and benchmarks'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare l''allocazione rispetto alla strategia e ai portafogli modello','Assess allocation against the strategy and model portfolios'),
  ('sys_tenant_process_steps','tenant_process_step_name','Valutare la resilienza ai rischi IT','Assess resilience to IT risks'),
  ('sys_tenant_process_steps','tenant_process_step_name','Verificare l''efficacia dei controlli','Test control effectiveness'),
  ('sys_tenant_process_steps','tenant_process_step_name','Verificare la conformità e i controlli esistenti','Verify compliance and existing controls'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 1 attività sono eseguite da una sola unità.','The only activity is performed by a single unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 11 attività sono eseguite da 2 unità diverse.','The 11 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 11 attività sono eseguite da 3 unità diverse.','The 11 activities are performed by 3 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 12 attività sono eseguite da 2 unità diverse.','The 12 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 14 attività sono eseguite da 3 unità diverse.','The 14 activities are performed by 3 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 2 attività sono eseguite da una sola unità.','The 2 activities are performed by a single unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 3 attività sono eseguite da una sola unità.','The 3 activities are performed by a single unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 4 attività sono eseguite da 2 unità diverse.','The 4 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 4 attività sono eseguite da una sola unità.','The 4 activities are performed by a single unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 6 attività sono eseguite da 2 unità diverse.','The 6 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 7 attività sono eseguite da 2 unità diverse.','The 7 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 8 attività sono eseguite da 2 unità diverse.','The 8 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 8 attività sono eseguite da una sola unità.','The 8 activities are performed by a single unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000510): le 9 attività sono eseguite da 2 unità diverse.','The 9 activities are performed by 2 different units.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Acquisizione e onboarding clienti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Customer acquisition and onboarding”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Acquisizione e onboarding clienti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Customer acquisition and onboarding”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Acquisizione e onboarding clienti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Customer acquisition and onboarding”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Acquisizione e onboarding clienti»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Customer acquisition and onboarding”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova).','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: it starts when an event occurs (a transaction, a hire, a new rule).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Channel performance analysis and management”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Channel performance analysis and management”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Channel performance analysis and management”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Channel performance analysis and management”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Channel performance analysis and management”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Account opening”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Account opening”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Account opening”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Account opening”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Account opening”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Account opening and management”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Account opening and management”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Account opening and management”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Account opening and management”: it starts when an event occurs (a transaction, a hire, a new rule); it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Account opening and management”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: il risultato serve a unità, organi o persone della banca; il risultato riguarda fornitori e partner.','Based on the name, description and activities of “Procurement and supplier management”: the outcome serves the bank''s units, corporate bodies or people; the outcome concerns suppliers and partners.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Procurement and supplier management”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Procurement and supplier management”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Procurement and supplier management”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Procurement and supplier management”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Audit interno»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Internal audit”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Audit interno»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Internal audit”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Audit interno»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Internal audit”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Audit interno»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Internal audit”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Audit interno»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Internal audit”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Account closure”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Account closure”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Account closure”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Account closure”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Account closure”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Compliance and regulatory reporting”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Compliance and regulatory reporting”: the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Compliance and regulatory reporting”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Compliance and regulatory reporting”: it starts when an event occurs (a transaction, a hire, a new rule); it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Compliance and regulatory reporting”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Understanding markets, customers and capabilities”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Understanding markets, customers and capabilities”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Understanding markets, customers and capabilities”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Understanding markets, customers and capabilities”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Understanding markets, customers and capabilities”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Definition of the business model and long-term vision”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Definition of the business model and long-term vision”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: il risultato è rivolto ad azionisti e consiglio di amministrazione.','Based on the name, description and activities of “Definition of the business model and long-term vision”: the outcome is addressed to shareholders and the board of directors.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Definition of the business model and long-term vision”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Definition of the business model and long-term vision”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Payroll processing”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Payroll processing”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Payroll processing”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Payroll processing”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Payroll processing”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Loan origination”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Loan origination”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Loan origination”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Loan origination”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Loan origination”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Facilities and real estate”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Facilities and real estate”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Facilities and real estate”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Facilities and real estate”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Facilities and real estate”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Finance and accounting”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Finance and accounting”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Finance and accounting”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Finance and accounting”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Finance and accounting”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova).','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: it starts when an event occurs (a transaction, a hire, a new rule).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Board of directors relations management”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Board of directors relations management”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: il risultato è rivolto ad azionisti e consiglio di amministrazione.','Based on the name, description and activities of “Board of directors relations management”: the outcome is addressed to shareholders and the board of directors.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Board of directors relations management”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Board of directors relations management”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Complaints and customer satisfaction management”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: il risultato arriva al cliente della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Complaints and customer satisfaction management”: the outcome reaches the bank''s customer; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Complaints and customer satisfaction management”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Complaints and customer satisfaction management”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Complaints and customer satisfaction management”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Human capital management”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Human capital management”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Human capital management”: it starts when an event occurs (a transaction, a hire, a new rule); it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Human capital management”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Human capital management”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Market risk management”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Market risk management”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Market risk management”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: parte quando una misura supera un limite (insolvenza, limiti di rischio).','Based on the name, description and activities of “Market risk management”: it starts when a measure exceeds a limit (default, risk limits).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Market risk management”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Risk management”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Risk management”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Risk management”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche); parte quando una misura supera un limite (insolvenza, limiti di rischio).','Based on the name, description and activities of “Risk management”: it recurs at set intervals (closings, plans, periodic reviews); it starts when a measure exceeds a limit (default, risk limits).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Risk management”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Cash management”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Cash management”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Cash management”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Cash management”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Cash management”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “IT and cybersecurity”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “IT and cybersecurity”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “IT and cybersecurity”: it starts when an event occurs (a transaction, a hire, a new rule); it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “IT and cybersecurity”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “IT and cybersecurity”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Legale»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Legal”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Legale»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Legal”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Legale»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Legal”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Legale»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Legal”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Legale»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Legal”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Account maintenance”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Account maintenance”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Account maintenance”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Account maintenance”: it starts when an event occurs (a transaction, a hire, a new rule); it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Account maintenance”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Marketing and communications”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Marketing and communications”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Marketing and communications”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Marketing and communications”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Marketing and communications”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Credit monitoring and collection”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Credit monitoring and collection”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Credit monitoring and collection”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: parte quando una misura supera un limite (insolvenza, limiti di rischio).','Based on the name, description and activities of “Credit monitoring and collection”: it starts when a measure exceeds a limit (default, risk limits).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Credit monitoring and collection”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: parte quando una misura supera un limite (insolvenza, limiti di rischio).','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: it starts when a measure exceeds a limit (default, risk limits).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Employee onboarding, training and development”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Employee onboarding, training and development”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Employee onboarding, training and development”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova); si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Employee onboarding, training and development”: it starts when an event occurs (a transaction, a hire, a new rule); it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Employee onboarding, training and development”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Branch operations”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Branch operations”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Branch operations”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Branch operations”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Branch operations”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Payments and credit transfers”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Payments and credit transfers”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Payments and credit transfers”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Payments and credit transfers”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Payments and credit transfers”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Planning and management control”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Planning and management control”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Planning and management control”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Planning and management control”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Planning and management control”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “HR planning, policies and strategies”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “HR planning, policies and strategies”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “HR planning, policies and strategies”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “HR planning, policies and strategies”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “HR planning, policies and strategies”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Recruitment and selection”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: le attività hanno un ordine stabilito e ripetibile.','Based on the name, description and activities of “Recruitment and selection”: the activities follow a set, repeatable order.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Recruitment and selection”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Recruitment and selection”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Recruitment and selection”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Employee compensation and retention”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo).','Based on the name, description and activities of “Employee compensation and retention”: the structure is common, while rules and parameters change (supervisory or collective agreement ones).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: rende possibile il lavoro degli altri processi.','Based on the name, description and activities of “Employee compensation and retention”: it enables the work of the other processes.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Employee compensation and retention”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Employee compensation and retention”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Investment services”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Investment services”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Investment services”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche); parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Investment services”: it recurs at set intervals (closings, plans, periodic reviews); it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Investment services”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Banking customer service (credit and lending)”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Banking customer service (credit and lending)”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Banking customer service (credit and lending)”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Banking customer service (credit and lending)”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Banking customer service (credit and lending)”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Customer service”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: il risultato arriva al cliente della banca.','Based on the name, description and activities of “Customer service”: the outcome reaches the bank''s customer.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: parte dalla richiesta di un cliente o di un''unità interna.','Based on the name, description and activities of “Customer service”: it starts from a request by a customer or an internal unit.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: produce un servizio o un prodotto per cui il cliente paga.','Based on the name, description and activities of “Customer service”: it produces a service or product that the customer pays for.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Customer service”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Corporate strategy and governance”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Corporate strategy and governance”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: il risultato serve a unità, organi o persone della banca; il risultato è rivolto ad azionisti e consiglio di amministrazione.','Based on the name, description and activities of “Corporate strategy and governance”: the outcome serves the bank''s units, corporate bodies or people; the outcome is addressed to shareholders and the board of directors.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Corporate strategy and governance”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Corporate strategy and governance”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: chi lavora sceglie i passi secondo la situazione.','Based on the name, description and activities of “Sales strategy development”: the people doing the work choose the steps according to the situation.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Sales strategy development”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: il risultato serve a unità, organi o persone della banca.','Based on the name, description and activities of “Sales strategy development”: the outcome serves the bank''s units, corporate bodies or people.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Sales strategy development”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: è uguale in ogni azienda e settore.','Based on the name, description and activities of “Sales strategy development”: it is the same in every company and sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: decide la direzione della banca o ne controlla andamento e rischi.','Based on the name, description and activities of “Treasury and ALM”: it sets the bank''s direction or monitors its performance and risks.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: il risultato serve a unità, organi o persone della banca; il risultato è dovuto all''autorità di vigilanza o pubblica.','Based on the name, description and activities of “Treasury and ALM”: the outcome serves the bank''s units, corporate bodies or people; the outcome is owed to the supervisory or public authority.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: la struttura è propria del settore bancario.','Based on the name, description and activities of “Treasury and ALM”: the structure is specific to the banking sector.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche).','Based on the name, description and activities of “Treasury and ALM”: it recurs at set intervals (closings, plans, periodic reviews).'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: un percorso stabilito con valutazioni decise caso per caso.','Based on the name, description and activities of “Treasury and ALM”: a set path with assessments decided case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Acquisizione e onboarding clienti»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Customer acquisition and onboarding”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Adeguata verifica e antiriciclaggio»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Customer due diligence and anti-money laundering”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Analisi e gestione delle performance dei canali»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Channel performance analysis and management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Apertura dei conti»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Account opening”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Apertura e gestione conti»: il lavoro lo svolge il sistema informativo della banca e le persone decidono le eccezioni.','Based on the name, description and activities of “Account opening and management”: the work is performed by the bank''s information system and people decide on exceptions.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Approvvigionamenti e gestione fornitori»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Procurement and supplier management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Audit interno»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Internal audit”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Chiusura dei conti»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Account closure”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Compliance e reportistica regolamentare»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Compliance and regulatory reporting”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Comprensione dei mercati, dei clienti e delle capacità»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Understanding markets, customers and capabilities”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Definizione del modello di business e della visione di lungo periodo»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Definition of the business model and long-term vision”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Elaborazione delle retribuzioni (payroll)»: il lavoro lo svolge il sistema informativo della banca e le persone decidono le eccezioni.','Based on the name, description and activities of “Payroll processing”: the work is performed by the bank''s information system and people decide on exceptions.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Erogazione del credito»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Loan origination”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Facility e immobili»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Facilities and real estate”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Finanza e contabilità»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Finance and accounting”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione degli ordini di vendita e cross-sell/up-sell»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Sales order management and cross-selling/up-selling”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione dei programmi di sicurezza (fisica e antirapina)»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Security programme management (physical security and anti-robbery)”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione dei rapporti con il consiglio di amministrazione»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Board of directors relations management”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione dei reclami e della customer satisfaction»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Complaints and customer satisfaction management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione del capitale umano»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Human capital management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione del rischio di mercato»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Market risk management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione del rischio»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Risk management”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Gestione della cassa»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Cash management”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «IT e cybersecurity»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “IT and cybersecurity”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Legale»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Legal”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Mantenimento dei conti»: il lavoro lo svolge il sistema informativo della banca e le persone decidono le eccezioni.','Based on the name, description and activities of “Account maintenance”: the work is performed by the bank''s information system and people decide on exceptions.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Marketing e comunicazione»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Marketing and communications”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Monitoraggio e recupero crediti»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Credit monitoring and collection”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Monitoraggio ed esecuzione di operazioni di rischio e hedging»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Risk and hedging transaction monitoring and execution”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Onboarding, formazione e sviluppo dei dipendenti»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Employee onboarding, training and development”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Operatività di filiale»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Branch operations”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Pagamenti e bonifici»: il lavoro lo svolge il sistema informativo della banca e le persone decidono le eccezioni.','Based on the name, description and activities of “Payments and credit transfers”: the work is performed by the bank''s information system and people decide on exceptions.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Pianificazione e controllo di gestione»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Planning and management control”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Pianificazione, politiche e strategie HR»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “HR planning, policies and strategies”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Reclutamento e selezione del personale»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Recruitment and selection”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Remunerazione e retention dei dipendenti»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Employee compensation and retention”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Servizi di investimento»: alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso.','Based on the name, description and activities of “Investment services”: some activities are performed by the system on its own, others remain with people who decide case by case.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Servizio alla clientela bancaria (credito e finanziamenti)»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Banking customer service (credit and lending)”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Servizio clienti»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Customer service”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Strategia e governance aziendale»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Corporate strategy and governance”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Sviluppo della strategia di vendita»: il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi.','Based on the name, description and activities of “Sales strategy development”: the work is judgement and discussion between people, with no system guiding its steps.'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «Tesoreria e ALM»: le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche.','Based on the name, description and activities of “Treasury and ALM”: people make the decisions, working with systems that prepare data, calculations or case files.'),
  ('sys_organization_units','organization_unit_name','Area Brescia-Bergamo','Brescia-Bergamo Area'),
  ('sys_organization_units','organization_unit_name','Area Milano e Provincia','Milan and Province Area'),
  ('sys_organization_units','organization_unit_name','Direzione Affari Legali e Societari','Legal and Corporate Affairs Department'),
  ('sys_organization_units','organization_unit_name','Direzione Antiriciclaggio','Anti-Money Laundering Department'),
  ('sys_organization_units','organization_unit_name','Direzione Back Office','Back Office Department'),
  ('sys_organization_units','organization_unit_name','Direzione Bilancio e Segnalazioni','Financial Statements and Regulatory Reporting Department'),
  ('sys_organization_units','organization_unit_name','Direzione Compliance e Protezione Dati','Compliance and Data Protection Department'),
  ('sys_organization_units','organization_unit_name','Direzione Coordinamento Commerciale','Commercial Coordination Department'),
  ('sys_organization_units','organization_unit_name','Direzione Corporate Banking','Corporate Banking Department'),
  ('sys_organization_units','organization_unit_name','Direzione Generale','General Management'),
  ('sys_organization_units','organization_unit_name','Direzione Gestione dei Rischi','Risk Management Department'),
  ('sys_organization_units','organization_unit_name','Direzione Governo e Supporto Rete','Network Governance and Support Department'),
  ('sys_organization_units','organization_unit_name','Direzione Infrastrutture','Infrastructure Department'),
  ('sys_organization_units','organization_unit_name','Direzione Internal Audit','Internal Audit Department'),
  ('sys_organization_units','organization_unit_name','Direzione Istruttoria ed Erogazione','Credit Assessment and Disbursement Department'),
  ('sys_organization_units','organization_unit_name','Direzione Monitoraggio e Crediti Deteriorati','Credit Monitoring and Non-Performing Loans Department'),
  ('sys_organization_units','organization_unit_name','Direzione Pagamenti','Payments Department'),
  ('sys_organization_units','organization_unit_name','Direzione Sviluppo Software e Canali Digitali','Software Development and Digital Channels Department'),
  ('sys_organization_units','organization_unit_name','Direzione Tesoreria e Mercati','Treasury and Markets Department'),
  ('sys_organization_units','organization_unit_name','Divisione Crediti','Credit Division'),
  ('sys_organization_units','organization_unit_name','Divisione Finanza e Amministrazione','Finance and Administration Division'),
  ('sys_organization_units','organization_unit_name','Divisione IT & Digital','IT & Digital Division'),
  ('sys_organization_units','organization_unit_name','Divisione Marketing e Comunicazione','Marketing and Communications Division'),
  ('sys_organization_units','organization_unit_name','Divisione Operations','Operations Division'),
  ('sys_organization_units','organization_unit_name','Divisione Retail Banking','Retail Banking Division'),
  ('sys_organization_units','organization_unit_name','Divisione Rischi e Compliance','Risk and Compliance Division'),
  ('sys_organization_units','organization_unit_name','Divisione Risorse Umane e Organizzazione','Human Resources and Organisation Division'),
  ('sys_organization_units','organization_unit_name','Filiale Bergamo Centro','Bergamo City Centre Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Brescia Centro','Brescia City Centre Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Como','Como Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Dalmine','Dalmine Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Milano Centro','Milan City Centre Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Milano Porta Romana','Milan Porta Romana Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Milano Sempione','Milan Sempione Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Monza','Monza Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Sesto San Giovanni','Sesto San Giovanni Branch'),
  ('sys_organization_units','organization_unit_name','Filiale Varese','Varese Branch'),
  ('sys_organization_units','organization_unit_name','RTL Bank S.p.A.','RTL Bank S.p.A.'),
  ('sys_organization_units','organization_unit_name','Ufficio Amministrazione del Personale','Personnel Administration Office'),
  ('sys_organization_units','organization_unit_name','Ufficio Crediti PMI','SME Credit Office'),
  ('sys_organization_units','organization_unit_name','Ufficio Crediti Retail','Retail Credit Office'),
  ('sys_organization_units','organization_unit_name','Ufficio Sviluppo, Formazione e Organizzazione','Development, Training and Organisation Office'),
  ('sys_positions','position_title','Addetto Amministrazione del Personale','Personnel Administration Officer'),
  ('sys_positions','position_title','Addetto Chiusura Conti','Account Closure Officer'),
  ('sys_positions','position_title','Addetto Customer Care e Qualità','Customer Care and Quality Officer'),
  ('sys_positions','position_title','Addetto Mantenimento Conti','Account Maintenance Officer'),
  ('sys_positions','position_title','Analista Bilancio e Segnalazioni','Financial Statements and Regulatory Reporting Analyst'),
  ('sys_positions','position_title','Analista Crediti','Credit Analyst'),
  ('sys_positions','position_title','Analista Finanziario','Financial Analyst'),
  ('sys_positions','position_title','Analista Monitoraggio Crediti','Credit Monitoring Analyst'),
  ('sys_positions','position_title','Analista Rischio','Risk Analyst'),
  ('sys_positions','position_title','Auditor','Auditor'),
  ('sys_positions','position_title','Cassiere','Teller'),
  ('sys_positions','position_title','Consulente Clientela','Customer Advisor'),
  ('sys_positions','position_title','Consulente di Filiale','Branch Advisor'),
  ('sys_positions','position_title','Consulente Investimenti','Investment Advisor'),
  ('sys_positions','position_title','Direttore Commerciale','Chief Commercial Officer'),
  ('sys_positions','position_title','Direttore Crediti','Chief Credit Officer'),
  ('sys_positions','position_title','Direttore di Filiale','Branch Manager'),
  ('sys_positions','position_title','Direttore Finanza e Tesoreria','Director of Finance and Treasury'),
  ('sys_positions','position_title','Direttore Generale','General Manager'),
  ('sys_positions','position_title','Direttore IT e Digital','Director of IT and Digital'),
  ('sys_positions','position_title','Direttore Operations','Director of Operations'),
  ('sys_positions','position_title','Direttore Retail Banking','Director of Retail Banking'),
  ('sys_positions','position_title','Direttore Rischi','Chief Risk Officer'),
  ('sys_positions','position_title','Direttore Risorse Umane','Human Resources Director'),
  ('sys_positions','position_title','FX & Money Markets Dealer','FX & Money Markets Dealer'),
  ('sys_positions','position_title','Gestore Piccole Imprese','Small Business Relationship Manager'),
  ('sys_positions','position_title','Gestore Recupero Crediti','Debt Collection Officer'),
  ('sys_positions','position_title','Internal Auditor','Internal Auditor'),
  ('sys_positions','position_title','Legale','Legal'),
  ('sys_positions','position_title','Marketing Specialist','Marketing Specialist'),
  ('sys_positions','position_title','Operatore Cambi','Foreign Exchange Operator'),
  ('sys_positions','position_title','Operatore di Sportello e Cassa','Teller and Cash Operator'),
  ('sys_positions','position_title','Operatore Titoli','Securities Operator'),
  ('sys_positions','position_title','Responsabile Compliance e Protezione Dati','Head of Compliance and Data Protection'),
  ('sys_positions','position_title','Responsabile Coordinamento Rete e Sviluppo Commerciale','Head of Network Coordination and Commercial Development'),
  ('sys_positions','position_title','Responsabile Direzione Affari Legali e Societari','Head of the Legal and Corporate Affairs Department'),
  ('sys_positions','position_title','Responsabile Direzione Antiriciclaggio','Head of the Anti-Money Laundering Department'),
  ('sys_positions','position_title','Responsabile Direzione Back Office','Head of the Back Office Department'),
  ('sys_positions','position_title','Responsabile Direzione Bilancio e Segnalazioni','Head of the Financial Statements and Regulatory Reporting Department'),
  ('sys_positions','position_title','Responsabile Direzione Coordinamento Commerciale','Head of the Commercial Coordination Department'),
  ('sys_positions','position_title','Responsabile Direzione Gestione dei Rischi','Head of the Risk Management Department'),
  ('sys_positions','position_title','Responsabile Direzione Monitoraggio e Crediti Deteriorati','Head of the Credit Monitoring and Non-Performing Loans Department'),
  ('sys_positions','position_title','Responsabile Direzione Pagamenti','Head of the Payments Department'),
  ('sys_positions','position_title','Responsabile Gestione Cassa e Pagamenti','Head of Cash and Payments Management'),
  ('sys_positions','position_title','Responsabile Gestione Rischi','Head of Risk Management'),
  ('sys_positions','position_title','Responsabile Infrastrutture e Sicurezza IT','Head of Infrastructure and IT Security'),
  ('sys_positions','position_title','Responsabile Internal Audit','Head of Internal Audit'),
  ('sys_positions','position_title','Responsabile Istruttoria Fidi','Head of Loan Underwriting'),
  ('sys_positions','position_title','Responsabile Marketing','Head of Marketing'),
  ('sys_positions','position_title','Responsabile Operations','Head of Operations'),
  ('sys_positions','position_title','Responsabile Risorse Umane','Head of Human Resources'),
  ('sys_positions','position_title','Responsabile Sviluppo Applicativi Core Banking','Head of Core Banking Application Development'),
  ('sys_positions','position_title','Responsabile Tesoreria','Head of Treasury'),
  ('sys_positions','position_title','Responsabile Ufficio Amministrazione del Personale','Head of the Personnel Administration Office'),
  ('sys_positions','position_title','Responsabile Ufficio Consulenza Clienti e Fidi','Head of the Customer Advisory and Lending Office'),
  ('sys_positions','position_title','Responsabile Ufficio Crediti PMI','Head of the SME Credit Office'),
  ('sys_positions','position_title','Responsabile Ufficio Crediti Retail','Head of the Retail Credit Office'),
  ('sys_positions','position_title','Responsabile Ufficio Sportello e Cassa','Head of the Teller and Cash Office'),
  ('sys_positions','position_title','Responsabile Ufficio Sviluppo, Formazione e Organizzazione','Head of the Development, Training and Organisation Office'),
  ('sys_positions','position_title','Sistemista','Systems Administrator'),
  ('sys_positions','position_title','Specialista Assistenza Clienti e Gestione Reclami','Customer Support and Complaints Specialist'),
  ('sys_positions','position_title','Specialista Back Office','Back Office Specialist'),
  ('sys_positions','position_title','Specialista Compliance','Compliance Specialist'),
  ('sys_positions','position_title','Specialista Formazione e Sviluppo','Training and Development Specialist'),
  ('sys_positions','position_title','Specialista Marketing e Comunicazione','Marketing and Communications Specialist'),
  ('sys_positions','position_title','Specialista Pagamenti','Payments Specialist'),
  ('sys_positions','position_title','Specialista Qualità e Supporto Rete','Quality and Network Support Specialist'),
  ('sys_positions','position_title','Specialista Sviluppo Commerciale','Commercial Development Specialist'),
  ('sys_positions','position_title','Specialista Sviluppo Vendite','Sales Development Specialist'),
  ('sys_positions','position_title','Sviluppatore Software','Software Developer'),
  ('sys_learning_modules','learning_module_title','Affiancamento in sala operativa finanza e tesoreria (dealing room)','Job shadowing in the finance and treasury dealing room'),
  ('sys_learning_modules','learning_module_title','Affiancamento operativo sugli applicativi di core banking','Hands-on job shadowing on core banking applications'),
  ('sys_learning_modules','learning_module_title','Aggiornamento annuale RLS','Annual refresher for workers'' safety representatives (RLS)'),
  ('sys_learning_modules','learning_module_title','Aggiornamento quinquennale addetti antincendio livello 2 (5 ore)','Five-yearly refresher for level 2 fire safety officers (5 hours)'),
  ('sys_learning_modules','learning_module_title','Aggiornamento triennale addetti primo soccorso (gruppo B/C, 4 ore)','Three-yearly refresher for first aid officers (group B/C, 4 hours)'),
  ('sys_learning_modules','learning_module_title','Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_learning_modules','learning_module_title','Basilea III/IV e requisiti patrimoniali — edizione in aula','Basel III/IV and capital requirements — classroom edition'),
  ('sys_learning_modules','learning_module_title','Corso addetti antincendio livello 2 (rischio medio, 8 ore)','Level 2 fire safety officer course (medium risk, 8 hours)'),
  ('sys_learning_modules','learning_module_title','Corso addetti primo soccorso (gruppo B/C, 12 ore)','First aid officer course (group B/C, 12 hours)'),
  ('sys_learning_modules','learning_module_title','Corso di cybersecurity per il personale IT','Cybersecurity course for IT staff'),
  ('sys_learning_modules','learning_module_title','Corso di sicurezza fisica e comportamento in caso di rapina','Course on physical security and conduct during a robbery'),
  ('sys_learning_modules','learning_module_title','Corso RSPP - Moduli A, B2 (settore credito/assicurazioni) e C','Health and safety service manager (RSPP) course - Modules A, B2 (credit/insurance sector) and C'),
  ('sys_learning_modules','learning_module_title','Corso su gestione dei reclami e soddisfazione dei clienti','Course on complaints handling and customer satisfaction'),
  ('sys_learning_modules','learning_module_title','Corso su gestione e recupero crediti problematici (NPL)','Course on managing and recovering non-performing loans (NPL)'),
  ('sys_learning_modules','learning_module_title','Corso tecnico di analisi del credito e istruttoria fidi','Technical course on credit analysis and loan underwriting'),
  ('sys_learning_modules','learning_module_title','Corso tecnico sui sistemi di pagamento e regolamento SEPA/interbancario','Technical course on SEPA/interbank payment and settlement systems'),
  ('sys_learning_modules','learning_module_title','Finanza sostenibile ed ESG — edizione in aula','Sustainable finance and ESG — classroom edition'),
  ('sys_learning_modules','learning_module_title','Formazione antiriciclaggio per esponenti dell''organo con funzione di supervisione strategica','Anti-money laundering training for members of the body with strategic supervision function'),
  ('sys_learning_modules','learning_module_title','Formazione del gestore delle segnalazioni whistleblowing','Training for the whistleblowing report manager'),
  ('sys_learning_modules','learning_module_title','Formazione e sensibilizzazione sulla resilienza operativa digitale (DORA)','Digital operational resilience (DORA) training and awareness'),
  ('sys_learning_modules','learning_module_title','Formazione generale sicurezza sul lavoro (4 ore)','General occupational health and safety training (4 hours)'),
  ('sys_learning_modules','learning_module_title','Formazione iniziale Rappresentante dei Lavoratori per la Sicurezza (RLS)','Initial training for workers'' safety representatives (RLS)'),
  ('sys_learning_modules','learning_module_title','Formazione operativa antiriciclaggio per addetti di sportello e cassa','Operational anti-money laundering training for tellers and cashiers'),
  ('sys_learning_modules','learning_module_title','Formazione per addetti alla distribuzione assicurativa in banca (Sezione E RUI)','Training for bank insurance distribution staff (RUI Section E)'),
  ('sys_learning_modules','learning_module_title','Formazione periodica antiriciclaggio per tutto il personale','Periodic anti-money laundering training for all staff'),
  ('sys_learning_modules','learning_module_title','Formazione professionale continua ai sensi del CCNL ABI','Continuing professional development under the ABI national collective labour agreement'),
  ('sys_learning_modules','learning_module_title','Formazione protezione dati personali (GDPR)','Personal data protection training (GDPR)'),
  ('sys_learning_modules','learning_module_title','Formazione specialistica antiriciclaggio per il responsabile della funzione','Specialist anti-money laundering training for the head of the function'),
  ('sys_learning_modules','learning_module_title','Formazione specifica per preposti','Specific training for supervisors'),
  ('sys_learning_modules','learning_module_title','Formazione specifica sicurezza, settore a rischio basso (4 ore)','Specific safety training, low-risk sector (4 hours)'),
  ('sys_learning_modules','learning_module_title','Formazione sul Modello di Organizzazione, Gestione e Controllo (MOG 231)','Training on the Organisation, Management and Control Model (Legislative Decree 231)'),
  ('sys_learning_modules','learning_module_title','Formazione sul sistema dei controlli interni e sulle funzioni di controllo','Training on the internal control system and control functions'),
  ('sys_learning_modules','learning_module_title','Gestione dei crediti deteriorati (NPL) — edizione in aula','Non-performing loan (NPL) management — classroom edition'),
  ('sys_learning_modules','learning_module_title','Gestione del rischio bancario — edizione in aula','Banking risk management — classroom edition'),
  ('sys_learning_modules','learning_module_title','IFRS 9 – Strumenti finanziari — edizione in aula','IFRS 9 – Financial instruments — classroom edition'),
  ('sys_learning_modules','learning_module_title','Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_learning_modules','learning_module_title','Internal audit bancario — edizione in aula','Banking internal audit — classroom edition'),
  ('sys_learning_modules','learning_module_title','MiFID II e tutela degli investitori — edizione in aula','MiFID II and investor protection — classroom edition'),
  ('sys_learning_modules','learning_module_title','Private banking e gestione patrimoniale — edizione in aula','Private banking and wealth management — classroom edition'),
  ('sys_learning_modules','learning_module_title','PSD2, open banking e pagamenti digitali — edizione in aula','PSD2, open banking and digital payments — classroom edition'),
  ('sys_learning_modules','learning_module_title','Requisiti di conoscenza e competenza MiFID II per il personale che fornisce consulenza in investimenti','MiFID II knowledge and competence requirements for staff providing investment advice'),
  ('sys_learning_modules','learning_module_title','Sicurezza informatica nei servizi finanziari — edizione in aula','Information security in financial services — classroom edition'),
  ('sys_learning_modules','learning_module_title','Sistemi di core banking e operatività di sportello — edizione in aula','Core banking systems and teller operations — classroom edition'),
  ('sys_learning_modules','learning_module_title','Tesoreria e mercati finanziari — edizione in aula','Treasury and financial markets — classroom edition'),
  ('sys_learning_modules','learning_module_title','Trade finance e operazioni con l''estero — edizione in aula','Trade finance and foreign transactions — classroom edition'),
  ('sys_learning_paths','learning_path_name','Analisi avanzata dei dati','Advanced data analysis'),
  ('sys_learning_paths','learning_path_name','Analisi dei dati per il settore bancario','Data analytics for the banking sector'),
  ('sys_learning_paths','learning_path_name','Analisi e valutazione sensoriale','Sensory analysis and evaluation'),
  ('sys_learning_paths','learning_path_name','Antiriciclaggio AML','Anti-money laundering (AML)'),
  ('sys_learning_paths','learning_path_name','Basilea III - Requisiti patrimoniali','Basel III - Capital requirements'),
  ('sys_learning_paths','learning_path_name','Basilea IV - Le novità della regolamentazione bancaria','Basel IV - What is new in banking regulation'),
  ('sys_learning_paths','learning_path_name','CAMS - Preparazione alla certificazione antiriciclaggio','CAMS - Preparation for the anti-money laundering certification'),
  ('sys_learning_paths','learning_path_name','Certificato ABA per cassieri - Fondamenti','ABA certificate for bank tellers - Fundamentals'),
  ('sys_learning_paths','learning_path_name','Cloud computing con AWS','Cloud computing with AWS'),
  ('sys_learning_paths','learning_path_name','Competenze per la trasformazione digitale','Skills for digital transformation'),
  ('sys_learning_paths','learning_path_name','Comunicazione Efficace','Effective Communication'),
  ('sys_learning_paths','learning_path_name','Conformità MiFID II per i servizi di investimento','MiFID II compliance for investment services'),
  ('sys_learning_paths','learning_path_name','Cybersecurity Awareness','Cybersecurity Awareness'),
  ('sys_learning_paths','learning_path_name','Da principiante ad esperto di analisi dati','From beginner to data analysis expert'),
  ('sys_learning_paths','learning_path_name','Design thinking','Design thinking'),
  ('sys_learning_paths','learning_path_name','Diversity & Inclusion','Diversity & Inclusion'),
  ('sys_learning_paths','learning_path_name','Eccellenza nel servizio al cliente in banca','Customer service excellence in banking'),
  ('sys_learning_paths','learning_path_name','Eccellenza nell''elaborazione delle transazioni','Excellence in transaction processing'),
  ('sys_learning_paths','learning_path_name','Eccellenza nella supervisione della produzione','Excellence in production supervision'),
  ('sys_learning_paths','learning_path_name','Educazione finanziaria per la clientela','Financial education for customers'),
  ('sys_learning_paths','learning_path_name','Excel Avanzato','Advanced Excel'),
  ('sys_learning_paths','learning_path_name','Fondamenti di analisi del rischio di credito','Fundamentals of credit risk analysis'),
  ('sys_learning_paths','learning_path_name','Fondamenti di consulenza sugli investimenti','Fundamentals of investment advice'),
  ('sys_learning_paths','learning_path_name','Fondamenti di gestione del portafoglio','Fundamentals of portfolio management'),
  ('sys_learning_paths','learning_path_name','Fondamenti di KYC - Conosci il tuo cliente','KYC fundamentals - Know your customer'),
  ('sys_learning_paths','learning_path_name','Fondamenti di machine learning','Fundamentals of machine learning'),
  ('sys_learning_paths','learning_path_name','Formazione obbligatoria annuale','Annual mandatory training'),
  ('sys_learning_paths','learning_path_name','FRM Parte I - Fondamenti del Financial Risk Manager','FRM Part I - Foundations of the Financial Risk Manager'),
  ('sys_learning_paths','learning_path_name','FRM Parte II - Gestione avanzata del rischio','FRM Part II - Advanced risk management'),
  ('sys_learning_paths','learning_path_name','GDPR e Privacy','GDPR and Privacy'),
  ('sys_learning_paths','learning_path_name','GDPR per Operatori Bancari','GDPR for Banking Operators'),
  ('sys_learning_paths','learning_path_name','Gestione agile dei progetti','Agile project management'),
  ('sys_learning_paths','learning_path_name','Gestione del contante e riconoscimento delle banconote false','Cash handling and counterfeit banknote detection'),
  ('sys_learning_paths','learning_path_name','Gestione del rischio di liquidità','Liquidity risk management'),
  ('sys_learning_paths','learning_path_name','Gestione del rischio di mercato','Market risk management'),
  ('sys_learning_paths','learning_path_name','Gestione del rischio operativo','Operational risk management'),
  ('sys_learning_paths','learning_path_name','Gestione del tempo','Time management'),
  ('sys_learning_paths','learning_path_name','Investimenti ESG e finanza sostenibile','ESG investing and sustainable finance'),
  ('sys_learning_paths','learning_path_name','Leadership Fondamentale','Leadership Essentials'),
  ('sys_learning_paths','learning_path_name','Mercati mobiliari e negoziazione','Securities markets and trading'),
  ('sys_learning_paths','learning_path_name','Monitoraggio delle transazioni antiriciclaggio','Anti-money laundering transaction monitoring'),
  ('sys_learning_paths','learning_path_name','Onboarding completo per nuovi assunti','Complete onboarding for new hires'),
  ('sys_learning_paths','learning_path_name','Panoramica dei sistemi di core banking','Overview of core banking systems'),
  ('sys_learning_paths','learning_path_name','Prevenzione delle frodi per il personale di prima linea','Fraud prevention for front-line staff'),
  ('sys_learning_paths','learning_path_name','PSD2 e Open Banking','PSD2 and Open Banking'),
  ('sys_learning_paths','learning_path_name','Sicurezza informatica nei servizi finanziari','Information security in financial services'),
  ('sys_learning_paths','learning_path_name','Sicurezza sul Lavoro','Occupational Safety'),
  ('sys_learning_paths','learning_path_name','SQL per Data Analysts','SQL for Data Analysts'),
  ('sys_learning_paths','learning_path_name','Sviluppo competenze di leadership per team leader','Leadership skills development for team leaders'),
  ('sys_learning_paths','learning_path_name','Vendita etica in banca','Ethical selling in banking'),
  ('sys_learning_paths','learning_path_description','ALM, gap di liquidità, LCR/NSFR, piano di finanziamento di emergenza, prove di stress sulla liquidità.','ALM, liquidity gap, LCR/NSFR, contingency funding plan, liquidity stress testing.'),
  ('sys_learning_paths','learning_path_description','Analisi dati avanzata con Python e SQL','Advanced data analysis with Python and SQL'),
  ('sys_learning_paths','learning_path_description','Analisi dei dati nel settore bancario: analisi della clientela, valutazione del merito di credito, individuazione delle frodi, automazione.','Data analytics in the banking sector: customer analytics, creditworthiness assessment, fraud detection, automation.'),
  ('sys_learning_paths','learning_path_description','Analisi del merito creditizio: rating interni, PD/LGD/EAD, modelli di scoring, analisi di bilancio.','Creditworthiness analysis: internal ratings, PD/LGD/EAD, scoring models, financial statement analysis.'),
  ('sys_learning_paths','learning_path_description','Architettura e servizi Amazon Web Services','Amazon Web Services architecture and services'),
  ('sys_learning_paths','learning_path_description','Architettura sistemi core banking, integrazioni, canali digitali, API, cybersecurity.','Core banking system architecture, integrations, digital channels, APIs, cybersecurity.'),
  ('sys_learning_paths','learning_path_description','Best practices gestione contante, riconoscimento banconote contraffatte, tecniche di verifica.','Cash handling best practices, counterfeit banknote detection, verification techniques.'),
  ('sys_learning_paths','learning_path_description','Come educare i clienti: risparmio, budgeting, credito responsabile, protezione frodi.','How to educate customers: saving, budgeting, responsible borrowing, fraud protection.'),
  ('sys_learning_paths','learning_path_description','Competenze per la trasformazione digitale','Skills for digital transformation'),
  ('sys_learning_paths','learning_path_description','Consapevolezza sicurezza informatica','Information security awareness'),
  ('sys_learning_paths','learning_path_description','Corso base sulle competenze di leadership e di gestione della squadra','Foundation course on leadership and team management skills'),
  ('sys_learning_paths','learning_path_description','Costruzione del portafoglio: teoria moderna del portafoglio, CAPM, diversificazione, ribilanciamento.','Portfolio construction: modern portfolio theory, CAPM, diversification, rebalancing.'),
  ('sys_learning_paths','learning_path_description','Da principiante ad esperto di analisi dati','From beginner to data analysis expert'),
  ('sys_learning_paths','learning_path_description','Depositi, prelievi, bonifici, pagamenti utenze, cambi valuta, assegni, procedure operative.','Deposits, withdrawals, credit transfers, utility bill payments, currency exchange, cheques, operating procedures.'),
  ('sys_learning_paths','learning_path_description','Direttiva MiFID II: governo dei prodotti, migliore esecuzione, incentivi, registrazione, segnalazioni EMIR/MiFIR.','MiFID II directive: product governance, best execution, inducements, record keeping, EMIR/MiFIR reporting.'),
  ('sys_learning_paths','learning_path_description','Evoluzioni regolamentari: output floor, revisione degli approcci IRB, rischio operativo, rischio CVA, FRTB.','Regulatory developments: output floor, revision of the IRB approaches, operational risk, CVA risk, FRTB.'),
  ('sys_learning_paths','learning_path_description','Fondamenti di adeguata verifica della clientela (CDD) e di adeguata verifica rafforzata (EDD), identificazione delle persone politicamente esposte, controllo delle liste sanzioni.','Fundamentals of customer due diligence (CDD) and enhanced due diligence (EDD), identification of politically exposed persons, sanctions list screening.'),
  ('sys_learning_paths','learning_path_description','Fondamenti operativita di cassa: gestione contante, riconoscimento banconote, riconciliazione.','Fundamentals of teller operations: cash handling, banknote recognition, reconciliation.'),
  ('sys_learning_paths','learning_path_description','Formazione obbligatoria annuale','Annual mandatory training'),
  ('sys_learning_paths','learning_path_description','Formazione obbligatoria sulla sicurezza','Mandatory safety training'),
  ('sys_learning_paths','learning_path_description','Formule avanzate, Pivot, VBA per Excel','Advanced formulas, pivot tables and VBA for Excel'),
  ('sys_learning_paths','learning_path_description','Gestione del tempo e produttività personale','Time management and personal productivity'),
  ('sys_learning_paths','learning_path_description','Introduzione al machine learning e AI','Introduction to machine learning and AI'),
  ('sys_learning_paths','learning_path_description','Investimenti ESG: rating ESG, obbligazioni verdi, investimenti a impatto, tassonomia UE, SFDR.','ESG investing: ESG ratings, green bonds, impact investing, EU taxonomy, SFDR.'),
  ('sys_learning_paths','learning_path_description','Mercati finanziari: azioni, reddito fisso, derivati, cambi. Tipi di ordine, esecuzione, regolamento.','Financial markets: equities, fixed income, derivatives, foreign exchange. Order types, execution, settlement.'),
  ('sys_learning_paths','learning_path_description','Metodologia Design Thinking per l innovazione','Design Thinking methodology for innovation'),
  ('sys_learning_paths','learning_path_description','Metodologie Agile e Scrum per la gestione progetti','Agile and Scrum methodologies for project management'),
  ('sys_learning_paths','learning_path_description','Minacce informatiche specifiche del settore bancario: APT, ransomware, minacce interne, sicurezza SWIFT.','Cyber threats specific to the banking sector: APTs, ransomware, insider threats, SWIFT security.'),
  ('sys_learning_paths','learning_path_description','Normativa antiriciclaggio per il settore finanziario','Anti-money laundering regulations for the financial sector'),
  ('sys_learning_paths','learning_path_description','Onboarding completo per nuovi assunti','Complete onboarding for new hires'),
  ('sys_learning_paths','learning_path_description','Preparazione all''esame FRM GARP, parte I: analisi quantitativa, mercati finanziari, modelli di valutazione.','Preparation for the GARP FRM exam, Part I: quantitative analysis, financial markets, valuation models.'),
  ('sys_learning_paths','learning_path_description','Preparazione alla certificazione CAMS di ACAMS. Copre identificazione transazioni sospette, due diligence clienti, reporting SAR/STR, sanzioni internazionali.','Preparation for the ACAMS CAMS certification. Covers identification of suspicious transactions, customer due diligence, SAR/STR reporting and international sanctions.'),
  ('sys_learning_paths','learning_path_description','Preparazione FRM GARP Parte II: rischio di mercato, rischio di credito, rischio operativo, rischio di liquidità.','GARP FRM Part II preparation: market risk, credit risk, operational risk, liquidity risk.'),
  ('sys_learning_paths','learning_path_description','Principi di consulenza finanziaria: allocazione del patrimonio, profilo di rischio del cliente, adeguatezza.','Principles of financial advice: asset allocation, customer risk profile, suitability.'),
  ('sys_learning_paths','learning_path_description','Privacy nel settore bancario: consenso, conservazione dei dati, diritti DSAR, notifica delle violazioni.','Privacy in the banking sector: consent, data retention, DSAR rights, breach notification.'),
  ('sys_learning_paths','learning_path_description','Promuovere diversità e inclusione in azienda','Promoting diversity and inclusion in the company'),
  ('sys_learning_paths','learning_path_description','Quadro OpRisk: identificazione, valutazione, mitigazione, KRI, raccolta dei dati sulle perdite, RCSA.','OpRisk framework: identification, assessment, mitigation, KRIs, loss data collection, RCSA.'),
  ('sys_learning_paths','learning_path_description','Query SQL avanzate per analisi dati','Advanced SQL queries for data analysis'),
  ('sys_learning_paths','learning_path_description','Regolamento generale protezione dati personali','General Data Protection Regulation'),
  ('sys_learning_paths','learning_path_description','Requisiti patrimoniali Basilea III: CET1, Tier 1, Tier 2, buffer di capitale, leverage ratio, LCR, NSFR.','Basel III capital requirements: CET1, Tier 1, Tier 2, capital buffers, leverage ratio, LCR, NSFR.'),
  ('sys_learning_paths','learning_path_description','Riconoscimento tentativi di frode: social engineering, identity theft, phishing, vishing.','Recognising fraud attempts: social engineering, identity theft, phishing, vishing.'),
  ('sys_learning_paths','learning_path_description','Seconda direttiva sui servizi di pagamento: SCA, API bancarie, TPP, AISP/PISP, sicurezza dei pagamenti.','Second Payment Services Directive: SCA, banking APIs, TPPs, AISP/PISP, payment security.'),
  ('sys_learning_paths','learning_path_description','Sviluppo delle competenze di leadership per i responsabili di squadra','Leadership skills development for team leaders'),
  ('sys_learning_paths','learning_path_description','Tecniche di assistenza alla clientela per il settore bancario: gestione dei reclami, vendita incrociata etica.','Customer service techniques for the banking sector: complaints handling, ethical cross-selling.'),
  ('sys_learning_paths','learning_path_description','Tecniche di comunicazione professionale','Professional communication techniques'),
  ('sys_learning_paths','learning_path_description','Tecniche di monitoraggio transazioni, red flags, pattern sospetti, uso di AI/ML nel transaction monitoring.','Transaction monitoring techniques, red flags, suspicious patterns, use of AI/ML in transaction monitoring.'),
  ('sys_learning_paths','learning_path_description','VaR, Expected Shortfall, prove di stress, analisi di scenario, backtesting, strategie di copertura.','VaR, Expected Shortfall, stress testing, scenario analysis, backtesting, hedging strategies.'),
  ('sys_learning_paths','learning_path_description','Vendita etica dei prodotti bancari: vendita basata sui bisogni, trasparenza, conflitto di interessi.','Ethical selling of banking products: needs-based selling, transparency, conflicts of interest.'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — agosto 2023 — Gestione del rischio bancario — edizione in aula','Edition A — August 2023 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — agosto 2024 — Gestione del rischio bancario — edizione in aula','Edition A — August 2024 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — agosto 2025 — Tesoreria e mercati finanziari — edizione in aula','Edition A — August 2025 — Treasury and financial markets — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — aprile 2024 — Tesoreria e mercati finanziari — edizione in aula','Edition A — April 2024 — Treasury and financial markets — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — aprile 2025 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition A — April 2025 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — aprile 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — April 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — dicembre 2023 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — December 2023 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — dicembre 2024 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition A — December 2024 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — dicembre 2025 — Private banking e gestione patrimoniale — edizione in aula','Edition A — December 2025 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — febbraio 2024 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — February 2024 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — febbraio 2025 — Internal audit bancario — edizione in aula','Edition A — February 2025 — Banking internal audit — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — febbraio 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — February 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — gennaio 2024 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — January 2024 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — gennaio 2025 — MiFID II e tutela degli investitori — edizione in aula','Edition A — January 2025 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — gennaio 2026 — Gestione del rischio bancario — edizione in aula','Edition A — January 2026 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — giugno 2024 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition A — June 2024 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — giugno 2025 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition A — June 2025 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — giugno 2026 — MiFID II e tutela degli investitori — edizione in aula','Edition A — June 2026 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — luglio 2024 — Tesoreria e mercati finanziari — edizione in aula','Edition A — July 2024 — Treasury and financial markets — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — luglio 2025 — Gestione del rischio bancario — edizione in aula','Edition A — July 2025 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — luglio 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — July 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — maggio 2024 — PSD2, open banking e pagamenti digitali — edizione in aula','Edition A — May 2024 — PSD2, open banking and digital payments — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — maggio 2025 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — May 2025 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — maggio 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — May 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — marzo 2024 — MiFID II e tutela degli investitori — edizione in aula','Edition A — March 2024 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — marzo 2025 — Tesoreria e mercati finanziari — edizione in aula','Edition A — March 2025 — Treasury and financial markets — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — marzo 2026 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition A — March 2026 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — novembre 2023 — PSD2, open banking e pagamenti digitali — edizione in aula','Edition A — November 2023 — PSD2, open banking and digital payments — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — novembre 2024 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition A — November 2024 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — novembre 2025 — Gestione del rischio bancario — edizione in aula','Edition A — November 2025 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — ottobre 2023 — MiFID II e tutela degli investitori — edizione in aula','Edition A — October 2023 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — ottobre 2024 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition A — October 2024 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — ottobre 2025 — Gestione del rischio bancario — edizione in aula','Edition A — October 2025 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — settembre 2023 — Private banking e gestione patrimoniale — edizione in aula','Edition A — September 2023 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — settembre 2024 — MiFID II e tutela degli investitori — edizione in aula','Edition A — September 2024 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione A — settembre 2025 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition A — September 2025 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — agosto 2023 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition B — August 2023 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — aprile 2024 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition B — April 2024 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — aprile 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition B — April 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — dicembre 2024 — PSD2, open banking e pagamenti digitali — edizione in aula','Edition B — December 2024 — PSD2, open banking and digital payments — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — febbraio 2025 — Private banking e gestione patrimoniale — edizione in aula','Edition B — February 2025 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — febbraio 2026 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition B — February 2026 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — gennaio 2024 — MiFID II e tutela degli investitori — edizione in aula','Edition B — January 2024 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — gennaio 2025 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition B — January 2025 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — giugno 2024 — Private banking e gestione patrimoniale — edizione in aula','Edition B — June 2024 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — giugno 2025 — Private banking e gestione patrimoniale — edizione in aula','Edition B — June 2025 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — giugno 2026 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition B — June 2026 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — luglio 2024 — Gestione del rischio bancario — edizione in aula','Edition B — July 2024 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — luglio 2025 — Private banking e gestione patrimoniale — edizione in aula','Edition B — July 2025 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — maggio 2024 — Private banking e gestione patrimoniale — edizione in aula','Edition B — May 2024 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — maggio 2025 — Private banking e gestione patrimoniale — edizione in aula','Edition B — May 2025 — Private banking and wealth management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — maggio 2026 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition B — May 2026 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — marzo 2024 — Gestione del rischio bancario — edizione in aula','Edition B — March 2024 — Banking risk management — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — marzo 2025 — MiFID II e tutela degli investitori — edizione in aula','Edition B — March 2025 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — marzo 2026 — Sistemi di core banking e operatività di sportello — edizione in aula','Edition B — March 2026 — Core banking systems and teller operations — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — novembre 2023 — Internal audit bancario — edizione in aula','Edition B — November 2023 — Banking internal audit — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — ottobre 2023 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition B — October 2023 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — ottobre 2024 — Il processo del credito: istruttoria, erogazione e monitoraggio — edizione in aula','Edition B — October 2024 — The credit process: assessment, disbursement and monitoring — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — ottobre 2025 — MiFID II e tutela degli investitori — edizione in aula','Edition B — October 2025 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — settembre 2023 — MiFID II e tutela degli investitori — edizione in aula','Edition B — September 2023 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — settembre 2024 — MiFID II e tutela degli investitori — edizione in aula','Edition B — September 2024 — MiFID II and investor protection — classroom edition'),
  ('sys_training_initiatives','training_initiative_cohort_name','Edizione B — settembre 2025 — Antiriciclaggio e contrasto al finanziamento del terrorismo — edizione in aula','Edition B — September 2025 — Anti-money laundering and counter-terrorist financing — classroom edition'),
  ('sys_goals','goal_title','Adozione strumenti di consulenza digitale — MBO 2023','Adoption of digital advisory tools — MBO 2023'),
  ('sys_goals','goal_title','Adozione strumenti di consulenza digitale — MBO 2024','Adoption of digital advisory tools — MBO 2024'),
  ('sys_goals','goal_title','Adozione strumenti di consulenza digitale — MBO 2025','Adoption of digital advisory tools — MBO 2025'),
  ('sys_goals','goal_title','Adozione strumenti di consulenza digitale — MBO 2026','Adoption of digital advisory tools — MBO 2026'),
  ('sys_goals','goal_title','Affiancare 2 colleghi junior - 4T 2025','Mentor 2 junior colleagues - Q4 2025'),
  ('sys_goals','goal_title','Attuare i miglioramenti del rilevamento delle frodi - 4T 2025','Implement fraud detection improvements - Q4 2025'),
  ('sys_goals','goal_title','Aumentare AUM del portafoglio clienti dell''8%','Increase client portfolio AUM by 8%'),
  ('sys_goals','goal_title','Completamento percorso formativo MiFID II — MBO 2023','Completion of the MiFID II training path — MBO 2023'),
  ('sys_goals','goal_title','Completamento percorso formativo MiFID II — MBO 2024','Completion of the MiFID II training path — MBO 2024'),
  ('sys_goals','goal_title','Completamento percorso formativo MiFID II — MBO 2026','Completion of the MiFID II training path — MBO 2026'),
  ('sys_goals','goal_title','Completare il programma di formazione sul digital banking - 4T 2025','Complete the digital banking training programme - Q4 2025'),
  ('sys_goals','goal_title','Completare la certificazione antiriciclaggio - 4T 2025','Complete the anti-money laundering certification - Q4 2025'),
  ('sys_goals','goal_title','Completare la certificazione FRM Parte I entro il 2T 2025','Complete the FRM Part I certification by Q2 2025'),
  ('sys_goals','goal_title','Completare la formazione di conformità RBP','Complete RBP compliance training'),
  ('sys_goals','goal_title','Completare la formazione sulla conformità a Basilea III - 4T 2025','Complete Basel III compliance training - Q4 2025'),
  ('sys_goals','goal_title','Contenimento del cost/income di area — MBO 2023','Containment of the area cost/income ratio — MBO 2023'),
  ('sys_goals','goal_title','Contenimento del cost/income di area — MBO 2024','Containment of the area cost/income ratio — MBO 2024'),
  ('sys_goals','goal_title','Contenimento del cost/income di area — MBO 2025','Containment of the area cost/income ratio — MBO 2025'),
  ('sys_goals','goal_title','Contenimento del cost/income di area — MBO 2026','Containment of the area cost/income ratio — MBO 2026'),
  ('sys_goals','goal_title','Crescita raccolta gestita del portafoglio — MBO 2023','Growth in managed assets of the portfolio — MBO 2023'),
  ('sys_goals','goal_title','Crescita raccolta gestita del portafoglio — MBO 2024','Growth in managed assets of the portfolio — MBO 2024'),
  ('sys_goals','goal_title','Crescita raccolta gestita del portafoglio — MBO 2025','Growth in managed assets of the portfolio — MBO 2025'),
  ('sys_goals','goal_title','Crescita raccolta gestita del portafoglio — MBO 2026','Growth in managed assets of the portfolio — MBO 2026'),
  ('sys_goals','goal_title','Digitalizzazione delle pratiche di fido — MBO 2023','Digitisation of credit line applications — MBO 2023'),
  ('sys_goals','goal_title','Digitalizzazione delle pratiche di fido — MBO 2024','Digitisation of credit line applications — MBO 2024'),
  ('sys_goals','goal_title','Digitalizzazione delle pratiche di fido — MBO 2026','Digitisation of credit line applications — MBO 2026'),
  ('sys_goals','goal_title','Incremento cross-selling prodotti assicurativi — MBO 2023','Increase in cross-selling of insurance products — MBO 2023'),
  ('sys_goals','goal_title','Incremento cross-selling prodotti assicurativi — MBO 2024','Increase in cross-selling of insurance products — MBO 2024'),
  ('sys_goals','goal_title','Incremento cross-selling prodotti assicurativi — MBO 2026','Increase in cross-selling of insurance products — MBO 2026'),
  ('sys_goals','goal_title','Istruire 500 richieste di prestito al mese - 4T 2025','Process 500 loan applications per month - Q4 2025'),
  ('sys_goals','goal_title','Mantenere accuratezza transazioni >99.5%','Maintain transaction accuracy >99.5%'),
  ('sys_goals','goal_title','Miglioramento NPS di filiale — MBO 2023','Improvement of branch NPS — MBO 2023'),
  ('sys_goals','goal_title','Miglioramento NPS di filiale — MBO 2024','Improvement of branch NPS — MBO 2024'),
  ('sys_goals','goal_title','Miglioramento NPS di filiale — MBO 2025','Improvement of branch NPS — MBO 2025'),
  ('sys_goals','goal_title','Miglioramento NPS di filiale — MBO 2026','Improvement of branch NPS — MBO 2026'),
  ('sys_goals','goal_title','Migliorare NPS filiale di 10 punti','Improve branch NPS by 10 points'),
  ('sys_goals','goal_title','Onboarding nuova clientela retail — MBO 2023','Onboarding of new retail customers — MBO 2023'),
  ('sys_goals','goal_title','Onboarding nuova clientela retail — MBO 2024','Onboarding of new retail customers — MBO 2024'),
  ('sys_goals','goal_title','Onboarding nuova clientela retail — MBO 2026','Onboarding of new retail customers — MBO 2026'),
  ('sys_goals','goal_title','Portare la soddisfazione dei clienti a 4,5/5 - 4T 2025','Raise customer satisfaction to 4.5/5 - Q4 2025'),
  ('sys_goals','goal_title','Qualità e completezza dei dati CRM — MBO 2023','Quality and completeness of CRM data — MBO 2023'),
  ('sys_goals','goal_title','Qualità e completezza dei dati CRM — MBO 2024','Quality and completeness of CRM data — MBO 2024'),
  ('sys_goals','goal_title','Qualità e completezza dei dati CRM — MBO 2026','Quality and completeness of CRM data — MBO 2026'),
  ('sys_goals','goal_title','Raggiungere 98% tasso risoluzione alert AML','Reach a 98% AML alert resolution rate'),
  ('sys_goals','goal_title','Raggiungere gli obiettivi di ricavo trimestrali - 4T 2025','Meet quarterly revenue targets - Q4 2025'),
  ('sys_goals','goal_title','Raggiungere il 95% di indice di conformità normativa - 4T 2025','Reach a 95% regulatory compliance rate - Q4 2025'),
  ('sys_goals','goal_title','Raggiungere il 99,9% di disponibilità dei sistemi - 4T 2025','Achieve 99.9% system availability - Q4 2025'),
  ('sys_goals','goal_title','Raggiungere l''obiettivo di volumi di trading mensili','Meet the monthly trading volume target'),
  ('sys_goals','goal_title','Raggiungere obiettivi di performance annuali','Meet annual performance objectives'),
  ('sys_goals','goal_title','Retention della clientela affluent — MBO 2023','Retention of affluent customers — MBO 2023'),
  ('sys_goals','goal_title','Retention della clientela affluent — MBO 2024','Retention of affluent customers — MBO 2024'),
  ('sys_goals','goal_title','Retention della clientela affluent — MBO 2025','Retention of affluent customers — MBO 2025'),
  ('sys_goals','goal_title','Retention della clientela affluent — MBO 2026','Retention of affluent customers — MBO 2026'),
  ('sys_goals','goal_title','Ridurre a 24 ore il tempo di risoluzione dei reclami - 4T 2025','Cut complaint resolution time to 24 hours - Q4 2025'),
  ('sys_goals','goal_title','Ridurre del 10% i costi operativi - 4T 2025','Reduce operating costs by 10% - Q4 2025'),
  ('sys_goals','goal_title','Ridurre del 15% l''incidenza dei crediti deteriorati - 4T 2025','Reduce the non-performing loan ratio by 15% - Q4 2025'),
  ('sys_goals','goal_title','Ridurre del 20% i tempi di elaborazione delle transazioni - 4T 2025','Reduce transaction processing times by 20% - Q4 2025'),
  ('sys_goals','goal_title','Ridurre del 20% i tempi di inserimento delle persone neoassunte','Reduce new hire onboarding time by 20%'),
  ('sys_goals','goal_title','Ridurre tempo produzione report del 20%','Reduce report production time by 20%'),
  ('sys_goals','goal_title','Riduzione dei tempi di istruttoria credito — MBO 2023','Reduction in credit assessment times — MBO 2023'),
  ('sys_goals','goal_title','Riduzione dei tempi di istruttoria credito — MBO 2024','Reduction in credit assessment times — MBO 2024'),
  ('sys_goals','goal_title','Riduzione dei tempi di istruttoria credito — MBO 2026','Reduction in credit assessment times — MBO 2026'),
  ('sys_goals','goal_title','Riduzione incidenza NPL del portafoglio — MBO 2023','Reduction of the portfolio NPL ratio — MBO 2023'),
  ('sys_goals','goal_title','Riduzione incidenza NPL del portafoglio — MBO 2024','Reduction of the portfolio NPL ratio — MBO 2024'),
  ('sys_goals','goal_title','Riduzione incidenza NPL del portafoglio — MBO 2025','Reduction of the portfolio NPL ratio — MBO 2025'),
  ('sys_goals','goal_title','Riduzione incidenza NPL del portafoglio — MBO 2026','Reduction of the portfolio NPL ratio — MBO 2026'),
  ('sys_goals','goal_title','Rinnovo certificazione IVASS nei termini — MBO 2023','On-time renewal of the IVASS certification — MBO 2023'),
  ('sys_goals','goal_title','Rinnovo certificazione IVASS nei termini — MBO 2024','On-time renewal of the IVASS certification — MBO 2024'),
  ('sys_goals','goal_title','Rinnovo certificazione IVASS nei termini — MBO 2026','On-time renewal of the IVASS certification — MBO 2026'),
  ('sys_goals','goal_title','Sviluppo competenze di credito specialistico — MBO 2023','Development of specialised lending skills — MBO 2023'),
  ('sys_goals','goal_title','Sviluppo competenze di credito specialistico — MBO 2024','Development of specialised lending skills — MBO 2024'),
  ('sys_goals','goal_title','Sviluppo competenze di credito specialistico — MBO 2026','Development of specialised lending skills — MBO 2026'),
  ('sys_goals','goal_title','Vendita incrociata di 3 prodotti per ogni contatto con il cliente - 4T 2025','Cross-sell 3 products per customer contact - Q4 2025'),
  ('sys_goals','goal_title','Zero rilievi negli audit antiriciclaggio — MBO 2023','Zero findings in anti-money laundering audits — MBO 2023'),
  ('sys_goals','goal_title','Zero rilievi negli audit antiriciclaggio — MBO 2024','Zero findings in anti-money laundering audits — MBO 2024'),
  ('sys_goals','goal_title','Zero rilievi negli audit antiriciclaggio — MBO 2026','Zero findings in anti-money laundering audits — MBO 2026'),
  ('sys_okrs','okr_objective','Aumentare del 20% i finanziamenti alle imprese','Increase business lending by 20%'),
  ('sys_okrs','okr_objective','Completare la fase 1 dell''ammodernamento del sistema di core banking','Complete phase 1 of the core banking system modernisation'),
  ('sys_okrs','okr_objective','Entrare in 3 nuovi mercati regionali','Enter 3 new regional markets'),
  ('sys_okrs','okr_objective','Lanciare una linea di prodotti sostenibili con 15 articoli','Launch a sustainable product line with 15 items'),
  ('sys_okrs','okr_objective','Lancio dell''app di mobile banking v3.0','Launch of mobile banking app v3.0'),
  ('sys_okrs','okr_objective','Lancio della piattaforma di e-commerce per la vendita diretta al cliente','Launch of the e-commerce platform for direct-to-customer sales'),
  ('sys_okrs','okr_objective','Ottenere la certificazione B Corp','Obtain B Corp certification'),
  ('sys_okrs','okr_objective','Portare la soddisfazione dei clienti (NPS) a 65 e oltre','Raise customer satisfaction (NPS) to 65 or higher'),
  ('sys_okrs','okr_objective','Raggiungere il 98% di indice di conformità antiriciclaggio','Reach a 98% anti-money laundering compliance rate'),
  ('sys_okrs','okr_objective','Raggiungere una crescita del 15% delle operazioni di digital banking','Achieve 15% growth in digital banking transactions'),
  ('sys_okrs','okr_objective','Realizzare il rilevamento delle frodi basato sull''intelligenza artificiale','Deliver artificial intelligence-based fraud detection'),
  ('sys_okrs','okr_objective','Ridurre del 12% i costi operativi','Reduce operating costs by 12%'),
  ('sys_okrs','okr_objective','Ridurre del 25% gli sprechi in tutta l''operatività','Cut waste across all operations by 25%'),
  ('sys_okrs','okr_objective','Ridurre del 30% i tempi di istruttoria dei prestiti','Reduce loan application processing times by 30%'),
  ('sys_okrs','okr_objective','Ridurre l''incidenza dei crediti deteriorati sotto il 2,5%','Bring the non-performing loan ratio below 2.5%'),
  ('sys_career_paths','career_path_name','Carriera in Compliance: da Addetto a Responsabile Compliance','Compliance career: from Compliance Officer to Head of Compliance'),
  ('sys_career_paths','career_path_name','Carriera IT: da Analista Programmatore a Capo Divisione Operations e IT','IT career: from Analyst Programmer to Head of the Operations and IT Division'),
  ('sys_career_paths','career_path_name','Carriera nella Direzione Crediti: da Analista a Capo Divisione','Credit Department career: from Analyst to Head of Division'),
  ('sys_career_paths','career_path_name','Carriera nella Gestione dei Rischi: da Addetto a Direttore Rischi','Risk Management career: from Risk Officer to Chief Risk Officer'),
  ('sys_career_paths','career_path_name','Da Consulente di Filiale a Capo Divisione Crediti e Finanza','From Branch Advisor to Head of the Credit and Finance Division'),
  ('sys_career_paths','career_path_name','Dal Back Office Conti al Capo Divisione Operations e IT','From Accounts Back Office to Head of the Operations and IT Division'),
  ('sys_career_paths','career_path_name','Dalla Cassa di Filiale alla Direzione Rete Commerciale','From the Branch Teller Desk to Branch Network Commercial Management'),
  ('sys_career_paths','career_path_name','Dalla Gestione dei Rischi al Rischio Operativo e Antiriciclaggio','From Risk Management to Operational Risk and Anti-Money Laundering'),
  ('sys_career_paths','career_path_name','Percorso Compliance e Legale','Compliance and Legal Path'),
  ('sys_career_paths','career_path_name','Percorso Corporate Banking','Corporate Banking Path'),
  ('sys_career_paths','career_path_name','Percorso Direttivo','Executive Path'),
  ('sys_career_paths','career_path_name','Percorso Gestione dei Rischi','Risk Management Path'),
  ('sys_career_paths','career_path_name','Percorso Ingegneria del Software','Software Engineering Path'),
  ('sys_career_paths','career_path_name','Percorso Leadership Tecnologica','Technology Leadership Path'),
  ('sys_career_paths','career_path_name','Percorso Operations Bancarie','Banking Operations Path'),
  ('sys_projects','project_name','Direzione Corporate Banking','Corporate Banking Department'),
  ('sys_projects','project_name','Divisione Rischi e Compliance','Risk and Compliance Division'),
  ('sys_projects','project_name','Squadra AML/Antiriciclaggio','AML/Anti-Money Laundering Team'),
  ('sys_projects','project_name','Squadra Back Office','Back Office Team'),
  ('sys_projects','project_name','Squadra Banca Commerciale','Commercial Banking Team'),
  ('sys_projects','project_name','Squadra Bergamo Centro','Bergamo City Centre Team'),
  ('sys_projects','project_name','Squadra Brescia Centro','Brescia City Centre Team'),
  ('sys_projects','project_name','Squadra CFO','CFO Team'),
  ('sys_projects','project_name','Squadra Crediti','Credit Team'),
  ('sys_projects','project_name','Squadra Crediti PMI','SME Credit Team'),
  ('sys_projects','project_name','Squadra Crediti Retail','Retail Credit Team'),
  ('sys_projects','project_name','Squadra Gestione dei Rischi','Risk Management Team'),
  ('sys_projects','project_name','Squadra Human Resources','Human Resources Team'),
  ('sys_projects','project_name','Squadra Infrastrutture','Infrastructure Team'),
  ('sys_projects','project_name','Squadra Internal Audit','Internal Audit Team'),
  ('sys_projects','project_name','Squadra IT & Digital','IT & Digital Team'),
  ('sys_projects','project_name','Squadra Legal & Compliance','Legal & Compliance Team'),
  ('sys_projects','project_name','Squadra Marketing','Marketing Team'),
  ('sys_projects','project_name','Squadra Milano Centro','Milan City Centre Team'),
  ('sys_projects','project_name','Squadra Operations','Operations Team'),
  ('sys_projects','project_name','Squadra Pagamenti','Payments Team'),
  ('sys_projects','project_name','Squadra Retail Banking','Retail Banking Team'),
  ('sys_projects','project_name','Squadra RTL Bank S.p.A.','RTL Bank S.p.A. Team'),
  ('sys_projects','project_name','Squadra Sviluppo Software','Software Development Team'),
  ('sys_projects','project_name','Squadra Tesoreria e Mercati','Treasury and Markets Team'),
  ('sys_surveys','survey_title','Indagine annuale sul coinvolgimento 2025','Annual engagement survey 2025'),
  ('sys_surveys','survey_title','Indagine rapida 3T 2024','Pulse survey Q3 2024'),
  ('sys_surveys','survey_title','Indagine rapida 4T 2025','Pulse survey Q4 2025'),
  ('sys_surveys','survey_title','Indagine su benessere ed equilibrio fra lavoro e vita privata','Wellbeing and work-life balance survey'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento 1T 2024','Engagement survey Q1 2024'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento 1T 2025','Engagement survey Q1 2025'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento 2T 2024','Engagement survey Q2 2024'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento 3T 2024','Engagement survey Q3 2024'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento 4T 2024','Engagement survey Q4 2024'),
  ('sys_surveys','survey_title','Indagine sul coinvolgimento dei dipendenti 4T 2024','Employee engagement survey Q4 2024'),
  ('sys_surveys','survey_title','Indagine sull''efficacia dei responsabili','Manager effectiveness survey'),
  ('sys_surveys','survey_title','Indagine sull''inserimento dei neoassunti','New hire onboarding survey'),
  ('sys_surveys','survey_title','Rilevazione di clima 2023-H2','Climate survey 2023-H2'),
  ('sys_surveys','survey_title','Rilevazione di clima 2024-H1','Climate survey 2024-H1'),
  ('sys_surveys','survey_title','Rilevazione di clima 2025-H1','Climate survey 2025-H1'),
  ('sys_surveys','survey_title','Rilevazione di clima 2026-H1','Climate survey 2026-H1'),
  ('sys_surveys','survey_title','Rilevazione di clima 2026-H2','Climate survey 2026-H2'),
  ('sys_surveys','survey_title','Rilevazione di clima in corso','Ongoing climate survey'),
  ('sys_surveys','survey_title','Riscontri sulla trasformazione digitale','Feedback on the digital transformation'),
  ('sys_teams','team_name','Direzione Corporate Banking','Corporate Banking Department'),
  ('sys_teams','team_name','Divisione Rischi e Compliance','Risk and Compliance Division'),
  ('sys_teams','team_name','Squadra AML/Antiriciclaggio','AML/Anti-Money Laundering Team'),
  ('sys_teams','team_name','Squadra Back Office','Back Office Team'),
  ('sys_teams','team_name','Squadra Banca Commerciale','Commercial Banking Team'),
  ('sys_teams','team_name','Squadra Bergamo Centro','Bergamo City Centre Team'),
  ('sys_teams','team_name','Squadra Brescia Centro','Brescia City Centre Team'),
  ('sys_teams','team_name','Squadra CFO','CFO Team'),
  ('sys_teams','team_name','Squadra Crediti','Credit Team'),
  ('sys_teams','team_name','Squadra Crediti PMI','SME Credit Team'),
  ('sys_teams','team_name','Squadra Crediti Retail','Retail Credit Team'),
  ('sys_teams','team_name','Squadra Gestione dei Rischi','Risk Management Team'),
  ('sys_teams','team_name','Squadra Human Resources','Human Resources Team'),
  ('sys_teams','team_name','Squadra Infrastrutture','Infrastructure Team'),
  ('sys_teams','team_name','Squadra Internal Audit','Internal Audit Team'),
  ('sys_teams','team_name','Squadra IT & Digital','IT & Digital Team'),
  ('sys_teams','team_name','Squadra Legal & Compliance','Legal & Compliance Team'),
  ('sys_teams','team_name','Squadra Marketing','Marketing Team'),
  ('sys_teams','team_name','Squadra Milano Centro','Milan City Centre Team'),
  ('sys_teams','team_name','Squadra Operations','Operations Team'),
  ('sys_teams','team_name','Squadra Pagamenti','Payments Team'),
  ('sys_teams','team_name','Squadra Retail Banking','Retail Banking Team'),
  ('sys_teams','team_name','Squadra RTL Bank S.p.A.','RTL Bank S.p.A. Team'),
  ('sys_teams','team_name','Squadra Sviluppo Software','Software Development Team'),
  ('sys_teams','team_name','Squadra Tesoreria e Mercati','Treasury and Markets Team'),
  ('sys_tenant_processes','tenant_process_name','Gestione del credito e delle politiche di affidamento','Credit and lending policy management'),
  ('sys_tenant_processes','tenant_process_name','Gestione del rischio operativo e antiriciclaggio (AML)','Operational risk and anti-money laundering (AML) management'),
  ('sys_tenant_processes','tenant_process_name','Sviluppo e gestione dei servizi/soluzioni IT (core banking)','Development and management of IT services/solutions (core banking)'),
  ('sys_tenant_process_facets','tenant_process_facet_criterion','Verifica dal vivo del rilascio del passo 2 dell''ADR-0061, 22/11/2026.','Verified on 22 November 2026.');

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_career_paths', r.career_path_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_career_paths r
  JOIN _rtl_en v ON v.tabella = 'sys_career_paths' AND v.colonna = 'career_path_name' AND btrim(r.career_path_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_goals', r.goal_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_goals r
  JOIN _rtl_en v ON v.tabella = 'sys_goals' AND v.colonna = 'goal_title' AND btrim(r.goal_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_modules', r.learning_module_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_learning_modules r
  JOIN _rtl_en v ON v.tabella = 'sys_learning_modules' AND v.colonna = 'learning_module_title' AND btrim(r.learning_module_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_paths', r.learning_path_id, 'description', 'en', v.en, 'LLM'
  FROM sys.sys_learning_paths r
  JOIN _rtl_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_description' AND btrim(r.learning_path_description) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_learning_paths', r.learning_path_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_learning_paths r
  JOIN _rtl_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_name' AND btrim(r.learning_path_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_okrs', r.okr_id, 'objective', 'en', v.en, 'LLM'
  FROM sys.sys_okrs r
  JOIN _rtl_en v ON v.tabella = 'sys_okrs' AND v.colonna = 'okr_objective' AND btrim(r.okr_objective) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_organization_units', r.organization_unit_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_organization_units r
  JOIN _rtl_en v ON v.tabella = 'sys_organization_units' AND v.colonna = 'organization_unit_name' AND btrim(r.organization_unit_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_positions', r.position_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_positions r
  JOIN _rtl_en v ON v.tabella = 'sys_positions' AND v.colonna = 'position_title' AND btrim(r.position_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_projects', r.project_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_projects r
  JOIN _rtl_en v ON v.tabella = 'sys_projects' AND v.colonna = 'project_name' AND btrim(r.project_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_surveys', r.survey_id, 'title', 'en', v.en, 'LLM'
  FROM sys.sys_surveys r
  JOIN _rtl_en v ON v.tabella = 'sys_surveys' AND v.colonna = 'survey_title' AND btrim(r.survey_title) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_teams', r.team_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_teams r
  JOIN _rtl_en v ON v.tabella = 'sys_teams' AND v.colonna = 'team_name' AND btrim(r.team_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_tenant_process_facets', r.tenant_process_facet_id, 'criterion', 'en', v.en, 'LLM'
  FROM sys.sys_tenant_process_facets r
  JOIN _rtl_en v ON v.tabella = 'sys_tenant_process_facets' AND v.colonna = 'tenant_process_facet_criterion' AND btrim(r.tenant_process_facet_criterion) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_tenant_process_steps', r.tenant_process_step_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_tenant_process_steps r
  JOIN _rtl_en v ON v.tabella = 'sys_tenant_process_steps' AND v.colonna = 'tenant_process_step_name' AND btrim(r.tenant_process_step_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_tenant_processes', r.tenant_process_id, 'description', 'en', v.en, 'LLM'
  FROM sys.sys_tenant_processes r
  JOIN _rtl_en v ON v.tabella = 'sys_tenant_processes' AND v.colonna = 'tenant_process_description' AND btrim(r.tenant_process_description) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_tenant_processes', r.tenant_process_id, 'name', 'en', v.en, 'LLM'
  FROM sys.sys_tenant_processes r
  JOIN _rtl_en v ON v.tabella = 'sys_tenant_processes' AND v.colonna = 'tenant_process_name' AND btrim(r.tenant_process_name) = v.it
ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE
  SET text = EXCLUDED.text, updated_at = now()
  WHERE sys_reference_translations.source = 'LLM'
    AND sys_reference_translations.text IS DISTINCT FROM EXCLUDED.text;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_training_initiatives', r.training_initiative_id, 'cohort_name', 'en', v.en, 'LLM'
  FROM sys.sys_training_initiatives r
  JOIN _rtl_en v ON v.tabella = 'sys_training_initiatives' AND v.colonna = 'training_initiative_cohort_name' AND btrim(r.training_initiative_cohort_name) = v.it
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
  SELECT 'sys_career_paths' AS tabella, 'career_path_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_career_paths r
    JOIN _rtl_en v ON v.tabella = 'sys_career_paths' AND v.colonna = 'career_path_name' AND btrim(r.career_path_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_career_paths' AND tr.entity_id = r.career_path_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_goals' AS tabella, 'goal_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_goals r
    JOIN _rtl_en v ON v.tabella = 'sys_goals' AND v.colonna = 'goal_title' AND btrim(r.goal_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_goals' AND tr.entity_id = r.goal_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_modules' AS tabella, 'learning_module_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_modules r
    JOIN _rtl_en v ON v.tabella = 'sys_learning_modules' AND v.colonna = 'learning_module_title' AND btrim(r.learning_module_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_modules' AND tr.entity_id = r.learning_module_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_paths' AS tabella, 'learning_path_description' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_paths r
    JOIN _rtl_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_description' AND btrim(r.learning_path_description) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_paths' AND tr.entity_id = r.learning_path_id AND tr.field = 'description' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_learning_paths' AS tabella, 'learning_path_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_learning_paths r
    JOIN _rtl_en v ON v.tabella = 'sys_learning_paths' AND v.colonna = 'learning_path_name' AND btrim(r.learning_path_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_learning_paths' AND tr.entity_id = r.learning_path_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_okrs' AS tabella, 'okr_objective' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_okrs r
    JOIN _rtl_en v ON v.tabella = 'sys_okrs' AND v.colonna = 'okr_objective' AND btrim(r.okr_objective) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_okrs' AND tr.entity_id = r.okr_id AND tr.field = 'objective' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_organization_units' AS tabella, 'organization_unit_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_organization_units r
    JOIN _rtl_en v ON v.tabella = 'sys_organization_units' AND v.colonna = 'organization_unit_name' AND btrim(r.organization_unit_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_organization_units' AND tr.entity_id = r.organization_unit_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_positions' AS tabella, 'position_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_positions r
    JOIN _rtl_en v ON v.tabella = 'sys_positions' AND v.colonna = 'position_title' AND btrim(r.position_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_positions' AND tr.entity_id = r.position_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_projects' AS tabella, 'project_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_projects r
    JOIN _rtl_en v ON v.tabella = 'sys_projects' AND v.colonna = 'project_name' AND btrim(r.project_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_projects' AND tr.entity_id = r.project_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_surveys' AS tabella, 'survey_title' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_surveys r
    JOIN _rtl_en v ON v.tabella = 'sys_surveys' AND v.colonna = 'survey_title' AND btrim(r.survey_title) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_surveys' AND tr.entity_id = r.survey_id AND tr.field = 'title' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_teams' AS tabella, 'team_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_teams r
    JOIN _rtl_en v ON v.tabella = 'sys_teams' AND v.colonna = 'team_name' AND btrim(r.team_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_teams' AND tr.entity_id = r.team_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_tenant_process_facets' AS tabella, 'tenant_process_facet_criterion' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_tenant_process_facets r
    JOIN _rtl_en v ON v.tabella = 'sys_tenant_process_facets' AND v.colonna = 'tenant_process_facet_criterion' AND btrim(r.tenant_process_facet_criterion) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_tenant_process_facets' AND tr.entity_id = r.tenant_process_facet_id AND tr.field = 'criterion' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_tenant_process_steps' AS tabella, 'tenant_process_step_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_tenant_process_steps r
    JOIN _rtl_en v ON v.tabella = 'sys_tenant_process_steps' AND v.colonna = 'tenant_process_step_name' AND btrim(r.tenant_process_step_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_tenant_process_steps' AND tr.entity_id = r.tenant_process_step_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_tenant_processes' AS tabella, 'tenant_process_description' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_tenant_processes r
    JOIN _rtl_en v ON v.tabella = 'sys_tenant_processes' AND v.colonna = 'tenant_process_description' AND btrim(r.tenant_process_description) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_tenant_processes' AND tr.entity_id = r.tenant_process_id AND tr.field = 'description' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_tenant_processes' AS tabella, 'tenant_process_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_tenant_processes r
    JOIN _rtl_en v ON v.tabella = 'sys_tenant_processes' AND v.colonna = 'tenant_process_name' AND btrim(r.tenant_process_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_tenant_processes' AND tr.entity_id = r.tenant_process_id AND tr.field = 'name' AND tr.locale = 'en'
UNION ALL
  SELECT 'sys_training_initiatives' AS tabella, 'training_initiative_cohort_name' AS colonna, count(DISTINCT v.it) AS valori, count(*) AS righe,
         count(tr.reference_translation_id) AS tradotte
    FROM sys.sys_training_initiatives r
    JOIN _rtl_en v ON v.tabella = 'sys_training_initiatives' AND v.colonna = 'training_initiative_cohort_name' AND btrim(r.training_initiative_cohort_name) = v.it
    LEFT JOIN sys.sys_reference_translations tr
      ON tr.entity_table = 'sys_training_initiatives' AND tr.entity_id = r.training_initiative_id AND tr.field = 'cohort_name' AND tr.locale = 'en'
  LOOP
    RAISE NOTICE '000517: %.% — % valori, % righe, % con inglese', esito.tabella, esito.colonna, esito.valori, esito.righe, esito.tradotte;
    IF esito.tradotte <> esito.righe THEN
      RAISE EXCEPTION '000517: %.% ha % righe senza inglese', esito.tabella, esito.colonna, esito.righe - esito.tradotte;
    END IF;
  END LOOP;
  SELECT count(*) INTO orfani
    FROM sys.v_reference_translation_orphans o
   WHERE o.entity_table IN (SELECT DISTINCT tabella FROM _rtl_en);
  IF orfani > 0 THEN
    RAISE EXCEPTION '000517: % traduzioni orfane nelle tabelle toccate', orfani;
  END IF;
END $$;

DROP TABLE IF EXISTS pg_temp._rtl_en;

-- ----------------------------------------------------------------------------
-- (d) Cancellata la riga, se ne vanno le sue traduzioni. Senza, ogni cancellazione
-- dall'applicazione lascerebbe un orfano: la 000255 pretende zero orfani su tutto il
-- database e la catena si fermerebbe al rilascio successivo. Il repo non aveva un
-- meccanismo da riusare (solo sentinelle e cancellazioni scritte a mano). I trigger si
-- mettono sulle tabelle registrate dalla 000516 e da questo file, lette dal registro;
-- una tabella assente si salta. Valgono anche per le cancellazioni a cascata.
-- Per annullare: togliere il trigger trg_togli_traduzioni dalle tabelle e la funzione.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.fn_togli_traduzioni_della_riga()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM sys.sys_reference_translations t
   WHERE t.entity_table = TG_TABLE_NAME
     AND t.entity_id = (to_jsonb(OLD) ->> TG_ARGV[0])::uuid;
  RETURN NULL;
END $fn$;

COMMENT ON FUNCTION sys.fn_togli_traduzioni_della_riga() IS
  'Trigger AFTER DELETE (000517): toglie le traduzioni della riga cancellata. Argomento: il nome della chiave primaria.';

DO $$
DECLARE t record; n int := 0;
BEGIN
  FOR t IN
    SELECT DISTINCT f.entity_table, f.entity_pk_column
      FROM sys.sys_translatable_field f
     WHERE f.note IN ('contenuti dei tenant', 'contenuto dei blueprint',
                      'registro dei processi dei blueprint', 'etichette delle interfacce')
       AND to_regclass('sys.' || f.entity_table) IS NOT NULL
     ORDER BY f.entity_table
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_togli_traduzioni ON sys.%I', t.entity_table);
    EXECUTE format('CREATE TRIGGER trg_togli_traduzioni AFTER DELETE ON sys.%I '
                   'FOR EACH ROW EXECUTE FUNCTION sys.fn_togli_traduzioni_della_riga(%L)',
                   t.entity_table, t.entity_pk_column);
    n := n + 1;
  END LOOP;
  IF n < 14 THEN
    RAISE EXCEPTION '000517: trigger di pulizia su % tabelle, attese almeno le 14 dei tenant', n;
  END IF;
  RAISE NOTICE '000517: trigger di pulizia delle traduzioni su % tabelle', n;
END $$;
