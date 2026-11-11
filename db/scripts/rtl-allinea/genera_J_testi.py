#!/usr/bin/env python3
"""Genera J_testi_italiano.sql: traduce in italiano i testi inglesi dei dati RTL (voce 5, mandato 2026-11-11).
Il dizionario è qui; lo SQL generato è autosufficiente, idempotente (sostituisce solo valori esatti inglesi) e porta un giornale
staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) il cui rollback è l'inversione nuovo -> vecchio.
Uso: python3 genera_J_testi.py > J_testi_italiano.sql
"""
import re

TITOLI = {  # titoli di posto / contratto / annuncio (confronto senza maiuscole)
    "Bank Manager": "Direttore di Filiale", "Bank Teller": "Cassiere", "Back Office Specialist": "Specialista Back Office",
    "Chief Risk Officer": "Direttore Rischi", "Financial Analyst": "Analista Finanziario", "Risk Analyst": "Analista Rischio",
    "Compliance Officer": "Specialista Compliance", "Investment Advisor": "Consulente Investimenti", "Securities Dealer": "Operatore Titoli",
    "Head of Commercial Banking": "Direttore Commerciale", "Head of Internal Audit": "Responsabile Internal Audit",
    "Head of Marketing": "Responsabile Marketing", "Head of Product": "Responsabile Prodotti", "Head of Treasury": "Responsabile Tesoreria",
    "Head of Legal & Compliance": "Responsabile Legale e Compliance", "HR Manager": "Responsabile Risorse Umane",
    "HR Director": "Direttore Risorse Umane", "IT Director": "Direttore IT e Digital", "Operations Director": "Direttore Operations",
    "Retail Director": "Direttore Retail Banking", "Finance Director": "Direttore Finanza e Amministrazione", "CEO": "Direttore Generale",
    "Line Manager - Operations": "Responsabile Operations", "Risk Manager": "Responsabile Gestione Rischi",
    "Payment Specialist": "Specialista Pagamenti", "Software Developer": "Sviluppatore Software", "System Administrator": "Sistemista",
    "Legal Counsel": "Legale", "Responsabile Direzione Risk Management": "Responsabile Direzione Gestione dei Rischi",
}
CORSI = {
    "ABA Bank Teller Certificate - Foundations": "Certificato ABA per cassieri - Fondamenti",
    "Advanced Data Analysis": "Analisi avanzata dei dati", "AML Transaction Monitoring": "Monitoraggio delle transazioni antiriciclaggio",
    "Basel III Framework - Capital Requirements": "Basilea III - Requisiti patrimoniali",
    "Basel IV - New Advances in Banking Regulation": "Basilea IV - Le novità della regolamentazione bancaria",
    "CAMS - Certified Anti-Money Laundering Specialist Prep": "CAMS - Preparazione alla certificazione antiriciclaggio",
    "Cash Handling & Counterfeit Detection": "Gestione del contante e riconoscimento delle banconote false", "Cloud Computing AWS": "Cloud computing con AWS",
    "Core Banking Systems Overview": "Panoramica dei sistemi di core banking", "Credit Risk Analysis Fundamentals": "Fondamenti di analisi del rischio di credito",
    "Customer Service Excellence in Banking": "Eccellenza nel servizio al cliente in banca", "Cybersecurity in Financial Services": "Sicurezza informatica nei servizi finanziari",
    "Data Analytics for Banking": "Analisi dei dati per il settore bancario", "Design Thinking": "Design thinking",
    "ESG Investing & Sustainable Finance": "Investimenti ESG e finanza sostenibile", "Ethical Sales in Banking": "Vendita etica in banca",
    "Financial Literacy for Customer Education": "Educazione finanziaria per la clientela", "Fraud Prevention for Frontline Staff": "Prevenzione delle frodi per il personale di prima linea",
    "FRM Part I - Financial Risk Manager Foundations": "FRM Parte I - Fondamenti del Financial Risk Manager", "FRM Part II - Advanced Risk Management": "FRM Parte II - Gestione avanzata del rischio",
    "Investment Advisory Fundamentals": "Fondamenti di consulenza sugli investimenti", "KYC Foundations - Know Your Customer": "Fondamenti di KYC - Conosci il tuo cliente",
    "Leadership for Production Supervisors": "Leadership per i responsabili di produzione", "Liquidity Risk Management": "Gestione del rischio di liquidità",
    "Machine Learning Basics": "Fondamenti di machine learning", "Market Risk Management": "Gestione del rischio di mercato",
    "MiFID II Compliance for Investment Services": "Conformità MiFID II per i servizi di investimento", "Operational Risk Management": "Gestione del rischio operativo",
    "Portfolio Management Essentials": "Fondamenti di gestione del portafoglio", "Production Supervision Excellence": "Eccellenza nella supervisione della produzione",
    "Project Management Agile": "Project management agile", "Securities Markets & Trading": "Mercati mobiliari e negoziazione",
    "Sensory Analysis & Evaluation": "Analisi e valutazione sensoriale", "Sustainability Consulting Methods": "Metodi di consulenza sulla sostenibilità",
    "Time Management": "Gestione del tempo", "Transaction Processing Excellence": "Eccellenza nell'elaborazione delle transazioni",
}
CATEGORIE = {"compliance": "conformità", "risk_management": "gestione del rischio", "soft_skills": "competenze trasversali", "investment": "investimenti",
             "operations": "operatività", "technical": "competenze tecniche", "leadership": "leadership"}
MESI = {"January": "gennaio", "February": "febbraio", "March": "marzo", "April": "aprile", "May": "maggio", "June": "giugno", "July": "luglio",
        "August": "agosto", "September": "settembre", "October": "ottobre", "November": "novembre", "December": "dicembre"}
MOTIVI = {"hire": "assunzione", "adjustment": "adeguamento", "promotion": "promozione", "merit": "merito", "promozione": "promozione", "merito": "merito", "cambio_ruolo": "cambio di ruolo"}

# (tabella, colonna) -> {inglese: italiano}
ESATTI = {
 ("sys_calibration_discussions", "calibration_discussion_adjustment_reason"): {
  "Adjusted based on cross-team comparison": "Rettificato in base al confronto fra team",
  "Cross-team calibration adjustment based on peer comparison": "Rettifica di calibrazione fra team in base al confronto fra pari"},
 ("sys_calibration_discussions", "calibration_discussion_notes"): {"Performance discussion completed. Employee reviewed against peers.": "Discussione sulla performance conclusa. Persona confrontata con i pari."},
 ("sys_calibration_sessions", "calibration_session_department"): {"Risk Management": "Gestione dei Rischi"},
 ("sys_calibration_sessions", "calibration_session_description"): {
  "Annual calibration for all departments": "Calibrazione annuale per tutte le direzioni", "Calibration for Risk and Compliance teams": "Calibrazione per i team Rischi e Compliance",
  "Calibration of Q3 performance ratings for Operations department": "Calibrazione dei giudizi di performance del terzo trimestre per la direzione Operations",
  "Performance calibration session for Commercial Banking": "Sessione di calibrazione della performance per la Banca Commerciale",
  "Performance calibration session for Direzione Generale": "Sessione di calibrazione della performance per la Direzione Generale",
  "Performance calibration session for Finance & Treasury": "Sessione di calibrazione della performance per Finanza e Tesoreria",
  "Performance calibration session for Human Resources": "Sessione di calibrazione della performance per le Risorse Umane",
  "Performance calibration session for Information Technology": "Sessione di calibrazione della performance per l'IT",
  "Performance calibration session for Legal & Compliance": "Sessione di calibrazione della performance per Legale e Compliance",
  "Performance calibration session for Marketing": "Sessione di calibrazione della performance per il Marketing",
  "Performance calibration session for Operations": "Sessione di calibrazione della performance per Operations",
  "Performance calibration session for Retail Banking": "Sessione di calibrazione della performance per il Retail Banking",
  "Performance calibration session for Risk Management": "Sessione di calibrazione della performance per la Gestione dei Rischi",
  "Tech team calibration session": "Sessione di calibrazione del team tecnologico"},
 ("sys_calibration_sessions", "calibration_session_name"): {
  "Calibration Risk Management 11/2025": "Calibrazione Gestione dei Rischi 11/2025", "Calibration Risk Management 12/2025": "Calibrazione Gestione dei Rischi 12/2025",
  "Calibration Risk Management 9/2025": "Calibrazione Gestione dei Rischi 9/2025", "Q3 2024 Performance Calibration - Risk & Compliance": "Calibrazione della performance 3T 2024 - Rischi e Compliance",
  "Calibration Legal & Compliance 10/2025": "Calibrazione Legale e Compliance 10/2025"},
 ("sys_calibration_sessions", "calibration_session_summary_notes"): {
  "Aligned 12 ratings. 3 adjustments from initial manager ratings. Strong discussion on high-potential identification.": "Allineati 12 giudizi, con 3 rettifiche rispetto ai giudizi iniziali dei responsabili. Discussione approfondita sull'individuazione degli alti potenziali.",
  "Calibration session completed with consensus on ratings": "Sessione di calibrazione conclusa con consenso sui giudizi",
  "Good alignment across managers. Discussed promotion readiness for 4 senior engineers.": "Buon allineamento fra i responsabili. Valutata la maturità alla promozione di 4 ingegneri senior.",
  "Reviewed 18 employees. Identified 2 high potentials for succession planning.": "Riesaminate 18 persone. Individuati 2 alti potenziali per la pianificazione della successione."},
 ("sys_career_paths", "career_path_description"): {
  "Career path for software engineers from Junior to Principal": "Percorso di carriera degli ingegneri del software da Junior a Principal",
  "Career progression from Analyst to Operations Director": "Crescita professionale da Analista a Direttore Operations",
  "From developer to CTO path": "Percorso da sviluppatore a responsabile della tecnologia", "Progression in risk analysis and management": "Crescita nell'analisi e nella gestione dei rischi"},
 ("sys_career_paths", "career_path_name"): {"Risk Management Track": "Percorso Gestione dei Rischi", "Compliance & Legal Track": "Percorso Compliance e Legale"},
 ("sys_compensation_bands", "compensation_band_name"): {
  "Support Band 1": "Fascia Supporto 1", "Support Band 2": "Fascia Supporto 2", "Tech Band 1": "Fascia Tecnica 1", "Tech Band 2": "Fascia Tecnica 2", "Tech Band 3": "Fascia Tecnica 3",
  "Professional Band 1": "Fascia Professionale 1", "Professional Band 2": "Fascia Professionale 2", "Professional Band 3": "Fascia Professionale 3",
  "Management Band 1": "Fascia Direttiva 1", "Management Band 2": "Fascia Direttiva 2", "Executive Band 1": "Fascia Dirigenziale 1", "Executive Band 2": "Fascia Dirigenziale 2"},
 ("sys_continuous_feedback", "feedback_message"): {
  "Consider breaking down complex topics more for stakeholders.": "Valuta di scomporre di più gli argomenti complessi per gli interlocutori.",
  "Consider delegating more to develop your team.": "Valuta di delegare di più per far crescere il tuo team.",
  "Consider scheduling buffer time between client meetings.": "Valuta di lasciare dei margini di tempo fra un incontro con i clienti e l'altro.",
  "Consider using more visual aids in your reports. The data is solid but could be more accessible.": "Valuta di usare più supporti visivi nei rapporti: i dati sono solidi ma potrebbero essere più accessibili.",
  "Excellent handling of the difficult client situation!": "Ottima gestione della situazione difficile con il cliente!",
  "Excellent presentation on Q3 risk metrics. Very clear and well-structured.": "Ottima presentazione sugli indicatori di rischio del terzo trimestre: molto chiara e ben strutturata.",
  "Great job on the presentation today! Your clear communication really helped the team understand the project status.": "Ottimo lavoro con la presentazione di oggi: la tua comunicazione chiara ha aiutato il team a capire lo stato del progetto.",
  "Great presentation skills in the team meeting today!": "Ottima capacità di presentazione nella riunione di team di oggi!",
  "Great teamwork on the Basel III compliance review. Your attention to detail was outstanding.": "Ottimo lavoro di squadra sulla revisione di conformità a Basilea III: la tua attenzione ai dettagli è stata eccellente.",
  "Keep up the great work on the regulatory submissions!": "Continua così con le segnalazioni regolamentari!",
  "Really appreciate your support during the system migration!": "Apprezzo molto il tuo supporto durante la migrazione del sistema!",
  "The documentation you created will help the whole team.": "La documentazione che hai preparato sarà utile a tutto il team.",
  "The new process you suggested saved us significant time.": "Il nuovo processo che hai proposto ci ha fatto risparmiare molto tempo.",
  "Try using the new dashboard for faster reporting.": "Prova il nuovo cruscotto per produrre i rapporti più in fretta.",
  "You might want to involve the compliance team earlier next time.": "La prossima volta valuta di coinvolgere prima il team compliance.",
  "Your analysis on the risk report was very thorough.": "La tua analisi nel rapporto sui rischi è stata molto accurata.",
  "Your attention to detail on audits is exemplary.": "La tua attenzione ai dettagli negli audit è esemplare.",
  "Your cross-team collaboration really improved the outcome.": "La tua collaborazione fra team ha migliorato davvero il risultato.",
  "Your mentorship of the junior analysts is making a real difference.": "Il tuo affiancamento degli analisti junior sta facendo una vera differenza."},
 ("sys_engagement_action_plans", "action_plan_title"): {"Team building Q2 2025": "Team building 2T 2025"},
 ("sys_engagement_surveys", "survey_title"): {"Wellbeing & Work-Life Balance Survey": "Indagine su benessere ed equilibrio fra lavoro e vita privata"},
 ("sys_engagement_survey_templates", "template_description"): {
  "30-day onboarding experience survey for new hires": "Indagine sull'esperienza di inserimento dei neoassunti a 30 giorni",
  "Comprehensive engagement survey covering key dimensions of employee experience": "Indagine completa sul coinvolgimento, sulle dimensioni principali dell'esperienza delle persone",
  "Employee wellbeing and mental health check-in": "Verifica del benessere e della salute mentale delle persone",
  "Quick 3-question pulse check for weekly engagement tracking": "Sondaggio rapido di 3 domande per il monitoraggio settimanale del coinvolgimento",
  "Standard exit interview to understand departure reasons and gather feedback": "Colloquio di uscita standard per capire i motivi dell'addio e raccogliere osservazioni"},
 ("sys_feedback_360_responses", "response_areas_for_improvement"): {
  "Could be better at saying no to non-priority items": "Potrebbe dire più spesso di no alle attività non prioritarie", "Could be more decisive under pressure": "Potrebbe essere più deciso sotto pressione",
  "Could be more flexible with changing priorities": "Potrebbe essere più flessibile quando le priorità cambiano", "Could develop strategic thinking skills": "Potrebbe sviluppare il pensiero strategico",
  "Could enhance cross-functional collaboration": "Potrebbe rafforzare la collaborazione fra funzioni", "Could improve delegation skills": "Potrebbe migliorare la capacità di delega",
  "Could improve time management": "Potrebbe migliorare la gestione del tempo", "Could share knowledge more often with the team": "Potrebbe condividere più spesso le conoscenze con il team",
  "Could take on more leadership opportunities": "Potrebbe cogliere più occasioni di leadership", "Need to improve public speaking skills": "Deve migliorare la capacità di parlare in pubblico",
  "Need to work on work-life balance": "Deve lavorare sull'equilibrio fra lavoro e vita privata", "Should network more across the organization": "Dovrebbe costruire più relazioni nell'organizzazione",
  "Want to develop more technical depth": "Vuole approfondire di più le competenze tecniche", "Would benefit from executive presence development": "Gioverebbe sviluppare l'autorevolezza di ruolo",
  "Would benefit from more proactive communication": "Gioverebbe una comunicazione più proattiva"},
 ("sys_feedback_360_responses", "response_strengths"): {
  "Adaptable to changing business needs": "Si adatta ai cambiamenti delle esigenze del business", "Consistently meets and often exceeds expectations": "Rispetta sempre e spesso supera le aspettative",
  "Dedicated to professional growth and learning": "Impegnato nella crescita professionale e nell'apprendimento", "Demonstrates strong ownership of responsibilities": "Dimostra forte senso di responsabilità",
  "Effective at prioritizing and managing workload": "Efficace nel definire le priorità e gestire il carico di lavoro", "Excellent collaboration and team support": "Ottima collaborazione e supporto al team",
  "Good at building relationships across teams": "Bravo a costruire relazioni fra i team", "Great attitude and positive team influence": "Ottimo atteggiamento e influenza positiva sul team",
  "Reliable and consistently delivers quality work": "Affidabile, consegna sempre lavoro di qualità", "Shows initiative and drives results": "Prende iniziativa e porta risultati",
  "Strong analytical skills and attention to detail": "Solide capacità analitiche e attenzione ai dettagli", "Strong commitment to quality and continuous improvement": "Forte impegno per la qualità e il miglioramento continuo",
  "Strong communication and problem-solving skills": "Solide capacità di comunicazione e di soluzione dei problemi", "Technical expertise and willingness to help others": "Competenza tecnica e disponibilità ad aiutare gli altri"},
 ("sys_goals", "goal_description"): {
  "CI fixture goal": "Obiettivo di verifica automatica", "Ensure regulatory knowledge is current": "Mantenere aggiornata la conoscenza normativa",
  "Identify and implement cost saving measures": "Individuare e attuare misure di contenimento dei costi", "Improve complaint handling efficiency": "Migliorare l'efficienza nella gestione dei reclami",
  "Improve customer service quality and response times": "Migliorare la qualità del servizio ai clienti e i tempi di risposta", "Increase loan processing efficiency and volume": "Aumentare l'efficienza e i volumi nell'istruttoria dei prestiti",
  "Increase revenue through product bundling": "Aumentare i ricavi con l'offerta di prodotti in pacchetto", "Maintain banking platform availability and reliability": "Mantenere disponibilità e affidabilità della piattaforma bancaria",
  "Non-performing loans reduction through improved risk assessment": "Ridurre i crediti deteriorati migliorando la valutazione del rischio", "Optimize payment and transfer processing workflows": "Ottimizzare i flussi di elaborazione di pagamenti e bonifici",
  "Reduce fraud incidents by 25%": "Ridurre del 25% gli episodi di frode", "Support team development and knowledge transfer": "Sostenere la crescita del team e il passaggio di conoscenze"},
 ("sys_goals", "goal_title"): {
  "Achieve 95% regulatory compliance score - Q4 2025": "Raggiungere il 95% di indice di conformità normativa - 4T 2025", "Achieve 99.9% system uptime - Q4 2025": "Raggiungere il 99,9% di disponibilità dei sistemi - 4T 2025",
  "Achieve quarterly revenue targets - Q4 2025": "Raggiungere gli obiettivi di ricavo trimestrali - 4T 2025", "Complete AML certification - Q4 2025": "Completare la certificazione antiriciclaggio - 4T 2025",
  "Complete Basel III compliance training - Q4 2025": "Completare la formazione sulla conformità a Basilea III - 4T 2025", "Complete digital banking training program - Q4 2025": "Completare il programma di formazione sul digital banking - 4T 2025",
  "Complete RBP compliance training": "Completare la formazione di conformità RBP", "Improve HR onboarding TTD by 20%": "Ridurre del 20% i tempi di inserimento delle persone neoassunte",
  "Increase customer satisfaction to 4.5/5 - Q4 2025": "Portare la soddisfazione dei clienti a 4,5/5 - 4T 2025", "Mentor 2 junior team members - Q4 2025": "Affiancare 2 colleghi junior - 4T 2025",
  "Process 500 loan applications monthly - Q4 2025": "Istruire 500 richieste di prestito al mese - 4T 2025", "Reduce customer complaint resolution time to 24h - Q4 2025": "Ridurre a 24 ore il tempo di risoluzione dei reclami - 4T 2025",
  "Reduce NPL ratio by 15% - Q4 2025": "Ridurre del 15% l'incidenza dei crediti deteriorati - 4T 2025", "Reduce operational costs by 10% - Q4 2025": "Ridurre del 10% i costi operativi - 4T 2025",
  "Reduce transaction processing time by 20% - Q4 2025": "Ridurre del 20% i tempi di elaborazione delle transazioni - 4T 2025"},
 ("sys_job_roles", "job_role_description"): {
  "Department manager": "Responsabile di direzione", "Senior department manager": "Responsabile di direzione senior",
  "In-house legal counsel — contracts, corporate & regulatory law, litigation support.": "Consulenza legale interna: contratti, diritto societario e regolamentare, supporto al contenzioso."},
 ("sys_kpi_definitions", "kpi_definition_name"): {
  "Findings closure time": "Tempo di chiusura dei rilievi", "Goal Completion": "Completamento degli obiettivi", "KYC verification time": "Tempo di verifica KYC",
  "Mean time to resolve": "Tempo medio di risoluzione", "New Product Success Rate": "Tasso di successo dei nuovi prodotti", "Risk-weighted assets": "Attività ponderate per il rischio",
  "Time-to-hire": "Tempo di assunzione", "Time to Hire": "Tempo di assunzione", "Training Hours": "Ore di formazione"},
 ("sys_kpi_metric_definitions", "kpi_metric_definition_name"): {
  "AML alert resolution time": "Tempo di chiusura delle segnalazioni antiriciclaggio", "Customer activation rate": "Tasso di attivazione dei clienti", "Customer NPS": "Soddisfazione dei clienti (NPS)",
  "Findings closure time": "Tempo di chiusura dei rilievi", "Goal Completion": "Completamento degli obiettivi", "KYC verification time": "Tempo di verifica KYC",
  "Mean time to resolve": "Tempo medio di risoluzione", "New Product Success Rate": "Tasso di successo dei nuovi prodotti", "Risk Assessment Accuracy": "Accuratezza della valutazione del rischio",
  "Risk-weighted assets": "Attività ponderate per il rischio", "Time-to-hire": "Tempo di assunzione", "Time to Hire": "Tempo di assunzione", "Training Hours": "Ore di formazione"},
 ("sys_leave_accrual_rules", "accrual_rule_name"): {
  "annual Accrual Policy": "Maturazione ferie", "sick Accrual Policy": "Maturazione malattia", "personal Accrual Policy": "Maturazione permessi personali",
  "parental Accrual Policy": "Maturazione permessi parentali", "bereavement Accrual Policy": "Maturazione permessi per lutto"},
 ("sys_leave_accrual_rules", "accrual_rule_description"): {
  "Standard accrual policy for annual": "Regola standard di maturazione delle ferie", "Standard accrual policy for sick": "Regola standard di maturazione dei giorni di malattia",
  "Standard accrual policy for personal": "Regola standard di maturazione dei permessi personali", "Standard accrual policy for parental": "Regola standard di maturazione dei permessi parentali",
  "Standard accrual policy for bereavement": "Regola standard di maturazione dei permessi per lutto"},
 ("sys_leave_balance_transactions", "transaction_description"): {
  "Year-end adjustment": "Rettifica di fine anno", "Carryover from previous year": "Riporto dall'anno precedente", "Leave taken": "Giorni goduti", "Monthly accrual": "Maturazione mensile"},
 ("sys_mentor_match_scores", "match_skill_name"): {"Project Management": "Gestione dei progetti"},
 ("sys_mentorship_programs", "program_name"): {"New Manager Accelerator": "Acceleratore per nuovi responsabili"},
 ("sys_mentorship_sessions", "session_notes"): {
  "Productive session covering key topics. Action items assigned.": "Incontro produttivo sugli argomenti principali. Assegnate le azioni.",
  "Productive session covering key topics. Good progress on goals.": "Incontro produttivo sugli argomenti principali. Buoni progressi sugli obiettivi.",
  "Productive session covering key topics. Great insights shared.": "Incontro produttivo sugli argomenti principali. Condivisi spunti molto utili.",
  "Productive session covering key topics. Identified areas for improvement.": "Incontro produttivo sugli argomenti principali. Individuate aree di miglioramento."},
 ("sys_objective_reward_rules", "objective_reward_rule_name"): {"Annual Performance Bonus 2024": "Premio annuale di performance 2024", "Digital Project Bonus": "Premio per progetti digitali"},
 ("sys_okr_key_results", "key_result_description"): {
  "Increase digital onboarding rate": "Aumentare la quota di clienti acquisiti con l'apertura digitale", "Increase mobile app daily active users": "Aumentare gli utenti attivi giornalieri dell'app",
  "Launch 3 new digital products": "Lanciare 3 nuovi prodotti digitali", "Reduce average loan approval time": "Ridurre il tempo medio di approvazione dei prestiti"},
 ("sys_okrs", "okr_department"): {"Risk Management": "Gestione dei Rischi", "Compliance": "Compliance"},
 ("sys_okrs", "okr_objective"): {
  "Achieve 15% growth in digital banking transactions": "Raggiungere una crescita del 15% delle operazioni di digital banking", "Achieve 98% AML compliance score": "Raggiungere il 98% di indice di conformità antiriciclaggio",
  "Achieve B Corp certification": "Ottenere la certificazione B Corp", "Complete core banking system modernization Phase 1": "Completare la fase 1 dell'ammodernamento del sistema di core banking",
  "Expand to 3 new regional markets": "Entrare in 3 nuovi mercati regionali", "Improve customer satisfaction (NPS) to 65+": "Portare la soddisfazione dei clienti (NPS) a 65 e oltre",
  "Increase corporate lending by 20%": "Aumentare del 20% i finanziamenti alle imprese", "Launch organic product line with 15 SKUs": "Lanciare una linea di prodotti sostenibili con 15 articoli",
  "Reduce food waste by 25% across operations": "Ridurre del 25% gli sprechi in tutta l'operatività", "Reduce loan processing time by 30%": "Ridurre del 30% i tempi di istruttoria dei prestiti",
  "Reduce NPL ratio to below 2.5%": "Ridurre l'incidenza dei crediti deteriorati sotto il 2,5%", "Reduce operational costs by 12%": "Ridurre del 12% i costi operativi"},
 ("sys_organization_units", "organization_unit_name"): {"Direzione Risk Management": "Direzione Gestione dei Rischi", "Divisione Risk & Compliance": "Divisione Rischi e Compliance"},
 ("sys_overtime", "overtime_reason"): {"Emergency support": "Supporto in emergenza", "Project deadline": "Scadenza di progetto"},
 ("sys_performance_review_competency_ratings", "rating_manager_comment"): {"Good technical output quality": "Buona qualità del lavoro tecnico"},
 ("sys_performance_review_competency_ratings", "rating_self_comment"): {
  "I applied my skills effectively to project deliverables": "Ho applicato con efficacia le mie competenze ai risultati dei progetti", "I have developed strong domain knowledge this period": "In questo periodo ho sviluppato una solida conoscenza del settore"},
 ("sys_predictive_models", "model_name"): {"Turnover Risk Model": "Modello di rischio di uscita"},
 ("sys_projects", "project_name"): {"Divisione Risk & Compliance": "Divisione Rischi e Compliance", "Squadra Risk Management": "Squadra Gestione dei Rischi"},
 ("sys_teams", "team_name"): {"Divisione Risk & Compliance": "Divisione Rischi e Compliance", "Squadra Risk Management": "Squadra Gestione dei Rischi", "Team Delivery Clienti": "Squadra Servizio Clienti"},
 ("sys_pulse_checks", "pulse_check_comment"): {
  "A bit stressed with the Q4 deadline approaching": "Un po' di stress con la scadenza del quarto trimestre in arrivo", "Feeling productive today, good team collaboration": "Oggi mi sento produttivo, buona collaborazione nel team",
  "Good balance this week, taking time for exercise": "Buon equilibrio questa settimana, ho trovato il tempo per fare movimento", "Great meeting with mentor, feeling motivated": "Ottimo incontro con il mentore, mi sento motivato",
  "Great team collaboration": "Ottima collaborazione nel team", "Heavy workload but manageable with proper planning": "Carico di lavoro pesante ma gestibile con una buona pianificazione",
  "Looking forward to the project launch": "Non vedo l'ora del lancio del progetto", "Need more clarity on priorities": "Serve maggiore chiarezza sulle priorità",
  "Need to take more breaks, feeling tired": "Devo fare più pause, mi sento stanco", "Project launch went well, celebrating small wins": "Il lancio del progetto è andato bene, festeggiamo i piccoli successi"},
 ("sys_reward_gate_catalog", "reward_gate_catalog_description"): {
  "All mandatory compliance training completed.": "Tutta la formazione obbligatoria di conformità è stata completata.", "All required training completed and assessed.": "Tutta la formazione richiesta è stata completata e valutata.",
  "No conduct violations during evaluation period.": "Nessuna violazione di condotta nel periodo di valutazione.", "No open critical risk findings.": "Nessun rilievo critico di rischio ancora aperto.",
  "No substantiated customer harm complaints.": "Nessun reclamo fondato per danno ai clienti."},
 ("sys_reward_gate_catalog", "reward_gate_catalog_name"): {"Customer Harm Gate": "Cancello danno ai clienti", "Risk Gate": "Cancello rischi", "Training Gate": "Cancello formazione", "Compliance Gate": "Cancello conformità"},
 ("sys_succession_pools", "succession_pool_name"): {"Successione — Responsabile Direzione Risk Management": "Successione — Responsabile Direzione Gestione dei Rischi"},
 ("sys_survey_questions", "survey_question_text"): {
  "Communication from leadership is clear and transparent": "La comunicazione dei vertici è chiara e trasparente", "How likely are you to recommend us as a workplace?": "Con quale probabilità ci consiglieresti come luogo di lavoro?",
  "I collaborate effectively with my team": "Collaboro in modo efficace con il mio team", "I feel a sense of belonging at work": "Sul lavoro mi sento parte di una comunità",
  "I feel comfortable sharing my ideas and opinions": "Mi sento a mio agio nel condividere idee e opinioni", "I feel motivated at work this quarter": "In questo trimestre mi sento motivato al lavoro",
  "I feel proud to work for this company": "Sono orgoglioso di lavorare per questa azienda", "I feel valued for my contributions": "Mi sento valorizzato per il mio contributo",
  "I feel valued for the work I do": "Mi sento valorizzato per il lavoro che svolgo", "I have opportunities for growth and development": "Ho opportunità di crescita e di sviluppo",
  "I have the resources I need to do my job effectively": "Ho le risorse necessarie per lavorare in modo efficace", "I have the tools and resources to do my job well": "Ho gli strumenti e le risorse per fare bene il mio lavoro",
  "I see a clear path for career growth here": "Vedo un percorso chiaro di crescita professionale", "I understand how my work contributes to company goals": "So come il mio lavoro contribuisce agli obiettivi dell'azienda",
  "I would recommend this company as a great place to work": "Consiglierei questa azienda come ottimo posto di lavoro", "My compensation is fair for my role": "La mia retribuzione è equa rispetto al mio ruolo",
  "My manager supports my growth and development": "Il mio responsabile sostiene la mia crescita e il mio sviluppo", "My manager supports my professional development": "Il mio responsabile sostiene il mio sviluppo professionale",
  "My workload is manageable": "Il mio carico di lavoro è gestibile", "The company culture promotes work-life balance": "La cultura aziendale favorisce l'equilibrio fra lavoro e vita privata"},
 ("sys_surveys", "survey_description"): {
  "Annual engagement survey measuring employee satisfaction, culture, and workplace experience": "Indagine annuale sul coinvolgimento: soddisfazione, cultura ed esperienza sul luogo di lavoro",
  "Assessment of management quality": "Valutazione della qualità della gestione", "Comprehensive annual engagement assessment": "Valutazione annuale completa del coinvolgimento",
  "Feedback from new employees about onboarding": "Opinioni dei neoassunti sull'inserimento", "Feedback on new digital banking tools": "Opinioni sui nuovi strumenti di digital banking"},
 ("sys_surveys", "survey_title"): {"Annual Engagement Survey 2025": "Indagine annuale sul coinvolgimento 2025", "Manager Effectiveness Survey": "Indagine sull'efficacia dei responsabili", "New Hire Onboarding Survey": "Indagine sull'inserimento dei neoassunti"},
 ("sys_tenant_consolidation_working_items", "tenant_consolidation_working_item_original_name"): {"Direzione Risk Management": "Direzione Gestione dei Rischi"},
 ("sys_tenant_consolidation_working_items", "tenant_consolidation_working_item_translated_name"): {"Direzione Risk Management": "Direzione Gestione dei Rischi"},
 ("sys_time_off_requests", "request_reason"): {"Annual holiday": "Ferie annuali", "Annual leave": "Ferie annuali"},
 ("sys_user_position_assignments", "user_position_assignment_notes"): {},
}

# colonne a titoli di posto
COLONNE_TITOLI = [("sys_positions", "position_title"), ("sys_user_contracts", "user_contract_job_title"), ("sys_job_postings", "posting_title")]
# colonne a titoli di corso (esatti, e con il suffisso « — edizione in aula » gia' italiano)
COLONNE_CORSI = [("sys_learning_modules", "learning_module_title"), ("sys_learning_paths", "learning_path_name")]


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    righe = []  # (tabella, colonna, en, it)
    for (t, c), d in ESATTI.items():
        for en, it in d.items():
            righe.append((t, c, en, it.replace("'", "'")))
    for t, c in COLONNE_TITOLI:
        for en, it in TITOLI.items():
            righe.append((t, c, en, it))
            if en != en.lower() and en != en.capitalize():
                righe.append((t, c, en.capitalize() if en.split()[0] in ("Bank", "Risk", "Financial", "Compliance", "Investment", "Securities", "Payment", "Software", "System", "Legal") else en, it))
    # varianti con l'iniziale maiuscola sola, presenti nei contratti (es. «Bank manager», «Risk analyst»)
    for t, c in COLONNE_TITOLI:
        for en, it in TITOLI.items():
            low = en[0] + en[1:].lower()
            righe.append((t, c, low, it))
    for t, c in COLONNE_CORSI:
        for en, it in CORSI.items():
            righe.append((t, c, en, it))
    seen, uniche = set(), []
    for r in righe:
        k = r[:3]
        if k in seen or r[2] == r[3]:
            continue
        seen.add(k)
        uniche.append(r)

    out = []
    w = out.append
    w("-- Voce 5 (mandato RTL 2026-11-11): testi in italiano. GENERATO da genera_J_testi.py: non si modifica a mano.")
    w("-- Idempotente: sostituisce solo valori esatti inglesi. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).")
    w("-- Rollback: UPDATE <tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo, per ogni riga del giornale.")
    w("\\set ON_ERROR_STOP on")
    w("BEGIN;")
    w("CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));")
    w("CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;")
    w("INSERT INTO tr VALUES")
    w(",\n".join(f"({q(t)},{q(c)},{q(en)},{q(it)})" for t, c, en, it in uniche) + ";")
    w("""DO $$ DECLARE r record; n bigint; BEGIN
  FOR r IN SELECT * FROM tr LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L', r.tabella, r.colonna, r.en) INTO n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.en, r.it, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L', r.tabella, r.colonna, r.it, r.colonna, r.en);
    END IF;
  END LOOP;
END $$;""")

    # --- testi composti: eventi della storia, mesi delle edizioni, segno dei movimenti di saldo ---
    corsi_case = "\n".join(f"      WHEN {q(en)} THEN {q(it)}" for en, it in CORSI.items())
    cat_case = "\n".join(f"      WHEN {q(en)} THEN {q(it)}" for en, it in CATEGORIE.items())
    tit_case = "\n".join(f"      WHEN {q(en.lower())} THEN {q(it)}" for en, it in TITOLI.items())
    mot_case = "\n".join(f"      WHEN {q(en)} THEN {q(it)}" for en, it in MOTIVI.items())
    w("-- titoli e corsi come funzioni temporanee (valgono solo in questa transazione)")
    w(f"CREATE FUNCTION pg_temp.t_titolo(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE lower(x)\n{tit_case}\n      ELSE x END $f$;")
    w(f"CREATE FUNCTION pg_temp.t_corso(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x\n{corsi_case}\n      ELSE x END $f$;")
    w(f"CREATE FUNCTION pg_temp.t_cat(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x\n{cat_case}\n      ELSE x END $f$;")
    w(f"CREATE FUNCTION pg_temp.t_motivo(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT CASE x\n{mot_case}\n      ELSE x END $f$;")
    w("CREATE FUNCTION pg_temp.t_eur(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT translate(to_char(x::numeric,'FM999,999,990.00'),',.','.,') $f$;")
    w("CREATE FUNCTION pg_temp.t_num(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT replace(x,'.',',') $f$;")
    w("""CREATE TEMP TABLE ev ON COMMIT DROP AS
SELECT user_timeline_event_id id, user_timeline_event_summary vecchio,
 CASE
  WHEN s ~ '^Completed course: .* \\([a-z_]+\\)$' THEN 'Corso completato: ' || pg_temp.t_corso(regexp_replace(s,'^Completed course: (.*) \\(([a-z_]+)\\)$','\\1')) || ' (' || pg_temp.t_cat(regexp_replace(s,'^Completed course: (.*) \\(([a-z_]+)\\)$','\\2')) || ')'
  WHEN s ~ '^Certification earned: ' THEN 'Certificazione conseguita: ' || substr(s, 24)
  WHEN s ~ '^Hired as ' THEN 'Assunto come ' || pg_temp.t_titolo(substr(s, 10))
  WHEN s ~ '^level_realignment: Reassignment to CCNL_CRED_2024 tabellare levels \\(.*\\)$' THEN 'Riallineamento di livello: assegnazione ai livelli tabellari del CCNL Credito 2024 (' || pg_temp.t_titolo(regexp_replace(s,'^.*\\((.*)\\)$','\\1')) || ')'
  WHEN s ~ '^salary_recalculation: ' THEN 'Ricalcolo della retribuzione: livello tabellare, scatti di anzianità e adeguamento individuale'
  WHEN s ~ '^executive_band_override: Override salariale per fascia dirigenziale \\(.*\\)$' THEN 'Retribuzione dirigenziale per fascia (' || pg_temp.t_titolo(regexp_replace(s,'^.*\\((.*)\\)$','\\1')) || ')'
  WHEN s ~ '^Salary set to [0-9.]+ EUR \\(.*\\)$' THEN 'Retribuzione fissata a ' || pg_temp.t_eur(regexp_replace(s,'^Salary set to ([0-9.]+) EUR.*$','\\1')) || ' euro (' || pg_temp.t_motivo(regexp_replace(s,'^.*\\((.*)\\)$','\\1')) || ')'
  WHEN s ~ '^Review (annual|mid_year) completed: rating [0-9.]+/5$' THEN 'Valutazione ' || CASE WHEN s ~ '^Review annual' THEN 'annuale' ELSE 'intermedia' END || ' completata: giudizio ' || pg_temp.t_num(regexp_replace(s,'^.*rating ([0-9.]+)/5$','\\1')) || '/5'
 END nuovo
FROM (SELECT user_timeline_event_id, user_timeline_event_summary, user_timeline_event_summary s FROM sys.sys_user_timeline_events) x;""")
    w("DELETE FROM ev WHERE nuovo IS NULL OR nuovo = vecchio;")
    w("INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_user_timeline_events', 'user_timeline_event_summary', vecchio, nuovo, count(*) FROM ev GROUP BY vecchio, nuovo ON CONFLICT DO NOTHING;")
    w("UPDATE sys.sys_user_timeline_events t SET user_timeline_event_summary = ev.nuovo FROM ev WHERE ev.id = t.user_timeline_event_id;")
    # mesi nelle edizioni e nelle richieste di approvazione
    mese_sql = "x"
    for en, it in MESI.items():
        mese_sql = f"replace({mese_sql}, {q(en + ' ')}, {q(it + ' ')})"
    w(f"CREATE FUNCTION pg_temp.t_mesi(x text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT {mese_sql} $f$;")
    for t, c in [("sys_training_initiatives", "training_initiative_cohort_name"), ("sys_approval_requests", "approval_request_title")]:
        w(f"INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT {q(t)}, {q(c)}, {c}, pg_temp.t_mesi({c}), count(*) FROM sys.{t} WHERE {c} ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{{4}}' GROUP BY {c} ON CONFLICT DO NOTHING;")
        w(f"UPDATE sys.{t} SET {c} = pg_temp.t_mesi({c}) WHERE {c} ~ '(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{{4}}';")
    # segno dei movimenti di saldo: maturazione e riporto in aumento, utilizzo in diminuzione
    w("INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) SELECT 'sys_leave_balance_transactions', 'transaction_days_amount', transaction_type||':'||transaction_days_amount, transaction_type||':'||(CASE WHEN transaction_type IN ('ACCRUAL','CARRYOVER') THEN abs(transaction_days_amount) ELSE -abs(transaction_days_amount) END), count(*) FROM sys.sys_leave_balance_transactions WHERE (transaction_type IN ('ACCRUAL','CARRYOVER') AND transaction_days_amount<0) OR (transaction_type='USAGE' AND transaction_days_amount>0) GROUP BY transaction_type, transaction_days_amount ON CONFLICT DO NOTHING;")
    w("UPDATE sys.sys_leave_balance_transactions SET transaction_days_amount = abs(transaction_days_amount) WHERE transaction_type IN ('ACCRUAL','CARRYOVER') AND transaction_days_amount<0;")
    w("UPDATE sys.sys_leave_balance_transactions SET transaction_days_amount = -abs(transaction_days_amount) WHERE transaction_type='USAGE' AND transaction_days_amount>0;")
    w("COMMIT;")
    w("SELECT 'J ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale, (SELECT coalesce(sum(righe),0) FROM staging.rtl_allinea_testi_undo) righe_tradotte;")
    print("\n".join(out))


main()
