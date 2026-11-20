#!/usr/bin/env python3
"""Genera J3_testi_inglesi.sql: traduce in italiano (registro bancario e HR) i valori DISTINTI inglesi delle colonne RTL
della sezione A del censimento docs/piani/CENSIMENTO_rtl-inglese-residui_20261114.md (mandato del 2026-11-15).
Stesso modello di J_testi_italiano.sql / J2_testi_residui.sql: sostituisce solo valori ESATTI, solo nel tenant RTL,
giornale staging.rtl_allinea_testi_undo, misura prima e dopo, post-condizione, rollback dichiarato.
Uso: python3 genera_J3_testi.py > J3_testi_inglesi.sql

Non toccati di proposito (dichiarati anche nel file generato):
- sys_goal_check_ins.check_in_status_update = COMPLETED e sys_job_requisitions.requisition_reason = GROWTH: codici con CHECK (RD-08), non testi.
- sys_valutazione_condivisione_eccezioni.eccezione_motivo: registro tecnico che cita colonne e codici; sys_visualization_exports.export_payload: artefatti
  derivati (SVG/JSON/Mermaid) che si rigenerano dalla visualizzazione, non si correggono a mano.
- colonne «ruoli» del censimento (titoli di posto e nomi di certificazioni ufficiali, es. CAMS, CFA): euristica rumorosa, non errori.
- valori che il banco non ha ma la produzione si' (testi del 10/11 troncati nel censimento): J3 e' idempotente e li prendera' dove esistono,
  ma ogni valore non elencato qui resta com'e' e sara' ricontato dal censimento.
"""

RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0"

# tabella -> predicato di tenant (la colonna tenant, o il salto di chiave per le tabelle figlie)
TENANT = {
    "sys_goal_milestones": "milestone_tenant_id = '{T}'",
    "sys_goal_updates": "update_tenant_id = '{T}'",
    "sys_goal_check_ins": "check_in_tenant_id = '{T}'",
    "sys_goal_comments": "comment_tenant_id = '{T}'",
    "sys_goals": "goal_tenant_id = '{T}'",
    "sys_feedback_360_responses": "response_tenant_id = '{T}'",
    "sys_kpi_definitions": "kpi_definition_tenant_id = '{T}'",
    "sys_kpi_metric_definitions": "kpi_metric_definition_kpi_id IN (SELECT kpi_definition_id FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id = '{T}')",
    "sys_user_timeline_events": "user_timeline_event_tenant_id = '{T}'",
    "sys_goal_templates": "template_tenant_id = '{T}'",
    "sys_user_documents": "user_document_tenant_id = '{T}'",
    "sys_skills": "skill_tenant_id = '{T}'",
    "sys_job_postings": "posting_tenant_id = '{T}'",
    "sys_learning_paths": "learning_path_tenant_id = '{T}'",
    "sys_okr_check_ins": "check_in_tenant_id = '{T}'",
    "sys_okrs": "okr_tenant_id = '{T}'",
    "sys_learning_modules": "learning_module_tenant_id = '{T}'",
    "sys_mentorship_programs": "program_tenant_id = '{T}'",
    "sys_objective_reward_rules": "objective_reward_rule_tenant_id = '{T}'",
    "sys_payout_curves": "payout_curve_tenant_id = '{T}'",
}

R = []  # (tabella, colonna, en, it)


def add(t, c, en, it):
    R.append((t, c, en, it))


# --- obiettivi, traguardi, aggiornamenti, check-in, commenti ---
add("sys_goal_milestones", "milestone_title", "Raggiungere target KPI", "Raggiungere l'obiettivo sull'indicatore")
add("sys_goal_milestones", "milestone_title", "Review con il responsabile", "Revisione con il responsabile")
add("sys_goal_updates", "update_content", "Feedback dal management: approvata la modifica dell'approccio", "Riscontro della direzione: approvata la modifica dell'approccio")
add("sys_goal_check_ins", "check_in_notes", "Output trimestrale on-track con metrica target.", "Risultato trimestrale in linea con l'obiettivo e con la metrica prevista.")
add("sys_goal_check_ins", "check_in_notes", "Obiettivo chiuso entro target. KPI raggiunto +12% vs baseline.", "Obiettivo chiuso entro il valore atteso. Indicatore raggiunto: +12% rispetto alla situazione di partenza.")
add("sys_goal_check_ins", "check_in_next_steps", "Drafting deliverable + share per peer review", "Stesura del documento da consegnare e condivisione per la revisione fra pari")
add("sys_goal_comments", "comment_content", "La quality review ha evidenziato punti di miglioramento", "La revisione della qualità ha evidenziato punti di miglioramento")
add("sys_goals", "goal_title", "Cross-sell 3 products per customer interaction - Q4 2025", "Vendita incrociata di 3 prodotti per ogni contatto con il cliente - 4T 2025")
add("sys_goals", "goal_title", "Raggiungere target volumi trading mensili", "Raggiungere l'obiettivo di volumi di trading mensili")
add("sys_goals", "goal_description", "Gestire efficacemente gli alert AML con tasso di risoluzione del 98%. Misurabile mensilmente su sistema case management. Ridurre backlog alert >30gg a zero.", "Gestire in modo efficace le segnalazioni antiriciclaggio con un tasso di risoluzione del 98%. Misurabile ogni mese sul sistema di gestione dei casi. Azzerare l'arretrato di segnalazioni aperte da oltre 30 giorni.")
add("sys_goals", "goal_description", "Incrementare Assets Under Management del portafoglio clienti dell'8% YoY. Target: acquisizione 5 nuovi clienti, retention 95% clienti esistenti.", "Incrementare dell'8% su base annua il patrimonio gestito (Assets Under Management) del portafoglio clienti. Obiettivo: acquisizione di 5 nuovi clienti e mantenimento del 95% dei clienti esistenti.")
add("sys_feedback_360_responses", "response_strengths", "Excellent stakeholder management", "Ottima gestione degli interlocutori")
add("sys_user_timeline_events", "user_timeline_event_summary", "Corso completato: Project management agile (competenze trasversali)", "Corso completato: Gestione agile dei progetti (competenze trasversali)")
add("sys_okr_check_ins", "check_in_notes", "Progresso costante, on track per il target", "Progresso costante, in linea con l'obiettivo")
add("sys_okrs", "okr_objective", "Launch D2C e-commerce platform", "Lancio della piattaforma di e-commerce per la vendita diretta al cliente")
add("sys_okrs", "okr_objective", "Launch mobile banking app v3.0", "Lancio dell'app di mobile banking v3.0")
add("sys_objective_reward_rules", "objective_reward_rule_name", "Sales Incentive Q4 2024", "Incentivo vendite 4T 2024")
add("sys_payout_curves", "payout_curve_name", "Curva MBO standard (soglia 80%, target 100%, cap 150%)", "Curva MBO standard (soglia 80%, obiettivo 100%, tetto 150%)")
add("sys_user_documents", "user_document_title", "Certificato Risk Management", "Certificato Gestione dei Rischi")

# --- competenze (descrizioni in inglese) ---
SK = [
    ("Comprehensive wealth planning, portfolio construction, and client advisory", "Pianificazione patrimoniale completa, costruzione del portafoglio e consulenza al cliente"),
    ("Customer identification and verification, enhanced due diligence for high-risk clients", "Identificazione e verifica della clientela, adeguata verifica rafforzata per i clienti ad alto rischio"),
    ("Development and validation of internal credit scoring and rating models", "Sviluppo e validazione dei modelli interni di scoring e di rating del credito"),
    ("Focuses on achieving objectives and delivering outcomes", "Si concentra sul raggiungimento degli obiettivi e sulla produzione di risultati"),
    ("Generates creative ideas and implements improvements", "Genera idee creative e realizza miglioramenti"),
    ("HNW client advisory, portfolio management, estate planning", "Consulenza alla clientela di alto patrimonio, gestione del portafoglio, pianificazione successoria"),
    ("Inspires and guides others toward achieving goals", "Ispira e guida gli altri verso il raggiungimento degli obiettivi"),
    ("Letters of credit, documentary collections, trade guarantees", "Crediti documentari, incassi documentari, garanzie commerciali"),
    ("Markets in Financial Instruments Directive compliance for investment services", "Conformità alla direttiva sui mercati degli strumenti finanziari (MiFID) per i servizi di investimento"),
    ("Mortgage and consumer loan processing, credit analysis, approval workflows", "Istruttoria di mutui e prestiti al consumo, analisi del credito, flussi autorizzativi"),
    ("Operational execution of AML controls, STR filing, and transaction monitoring", "Esecuzione operativa dei controlli antiriciclaggio, segnalazione delle operazioni sospette e monitoraggio delle transazioni"),
    ("Prioritizes customer needs and delivers value", "Mette al primo posto i bisogni del cliente e crea valore"),
    ("Proficiency with core banking platforms (T24, Flexcube, SAP Banking)", "Padronanza delle piattaforme di core banking (T24, Flexcube, SAP Banking)"),
    ("Spot and forward FX transactions, hedging strategies", "Operazioni di cambio a pronti e a termine, strategie di copertura"),
    ("Works effectively with others to achieve shared goals", "Collabora in modo efficace con gli altri per raggiungere obiettivi condivisi"),
]
for en, it in SK:
    add("sys_skills", "skill_description", en, it)

# --- modelli di obiettivo ---
add("sys_goal_templates", "template_name", "Raggiungere il target di ricavi", "Raggiungere l'obiettivo di ricavi")
add("sys_goal_templates", "template_name", "Fare da mentore ai membri del team", "Fare da mentore ai membri della squadra")
add("sys_goal_templates", "template_name", "Aumentare la collaborazione del team", "Aumentare la collaborazione nella squadra")
GT = [
    ("Mantenere l'NPL ratio (crediti deteriorati lordi/totale crediti lordi) entro la soglia target annuale definita dalla banca.", "Mantenere l'indice dei crediti deteriorati (crediti deteriorati lordi sul totale dei crediti lordi) entro la soglia obiettivo annuale definita dalla banca."),
    ("Mantenere il tasso di deterioramento dei nuovi finanziamenti retail erogati entro una soglia target, in linea con i trend di sistema", "Mantenere il tasso di deterioramento dei nuovi finanziamenti retail erogati entro una soglia obiettivo, in linea con l'andamento del sistema"),
    ("Incrementare il customer lifetime value della clientela retail rispetto all'anno precedente", "Incrementare il valore della clientela retail nel tempo (customer lifetime value) rispetto all'anno precedente"),
    ("Garantire in filiale una percentuale di clienti soddisfatti in linea con il target aziendale annuale.", "Garantire in filiale una percentuale di clienti soddisfatti in linea con l'obiettivo aziendale annuale."),
    ("Contenere il costo totale di servizio alla clientela retail per cliente (tutti i canali) entro il target annuo definito", "Contenere il costo totale di servizio alla clientela retail per cliente (tutti i canali) entro l'obiettivo annuo definito"),
    ("Mantenere un livello elevato di customer satisfaction nella relazione commerciale con la clientela gestita, rilevato tramite survey periodiche", "Mantenere un livello elevato di soddisfazione dei clienti nella relazione commerciale con la clientela gestita, rilevato con indagini periodiche"),
    ("Mantenere il costo del personale dedicato al cost accounting e al cost management entro il target definito per FTE di processo.", "Mantenere il costo del personale dedicato alla contabilità dei costi e alla gestione dei costi entro l'obiettivo definito per FTE di processo."),
    ("Contribuire al mantenimento del NPS di filiale in linea con il target aziendale annuale.", "Contribuire al mantenimento dell'indice di raccomandazione (NPS) di filiale in linea con l'obiettivo aziendale annuale."),
    ("Ridurre il tempo medio di istruttoria dei fidi a un valore target allineato ai benchmark di settore (3-7 giorni lavorativi).", "Ridurre il tempo medio di istruttoria dei fidi a un valore obiettivo allineato ai riferimenti di settore (3-7 giorni lavorativi)."),
    ("Garantire che almeno una quota target delle pratiche di istruttoria sia completata entro gli SLA interni definiti.", "Garantire che almeno una quota obiettivo delle pratiche di istruttoria sia completata entro i livelli di servizio interni definiti."),
    ("Rispettare il tempo di ciclo di elaborazione della busta paga entro i giorni lavorativi target definiti trimestralmente.", "Rispettare il tempo di ciclo di elaborazione della busta paga entro i giorni lavorativi obiettivo definiti ogni trimestre."),
    ("Raggiungere un tasso di risoluzione al primo contatto (first contact resolution) delle richieste payroll almeno pari alla soglia target definita.", "Raggiungere un tasso di risoluzione al primo contatto delle richieste sulle paghe almeno pari alla soglia obiettivo definita."),
]
for en, it in GT:
    # la stessa frase sta nel nome e nella descrizione del modello: vale per entrambe le colonne
    add("sys_goal_templates", "template_name", en, it)
    add("sys_goal_templates", "template_description", en, it)

# --- indicatori (KPI): nome, descrizione, formula ---
P_COST = "'perform cost accounting and control' e 'perform cost management'"
P_COST_IT = "«contabilità dei costi e controllo» e «gestione dei costi»"
KN = [  # nome (identico in descrizione e in sys_kpi_metric_definitions.kpi_metric_definition_name)
    ("Costo del personale dedicato a cost accounting e cost management per FTE di processo", "Costo del personale dedicato alla contabilità dei costi e alla gestione dei costi per FTE di processo"),
    ("Costo del personale del processo 'reward and retain employees' per dipendente", "Costo del personale del processo «remunerare e trattenere le persone» per dipendente"),
    ("Costo totale dei processi di cost accounting e cost management per $1.000 di ricavi", "Costo totale dei processi di contabilità dei costi e gestione dei costi per 1.000 dollari di ricavi"),
    ("Costo totale dei processi di cost accounting e cost management per FTE di processo", "Costo totale dei processi di contabilità dei costi e gestione dei costi per FTE di processo"),
    ("Costo totale del processo 'reward and retain employees' per dipendente", "Costo totale del processo «remunerare e trattenere le persone» per dipendente"),
    ("Customer Satisfaction Score (CSAT)", "Indice di soddisfazione dei clienti (CSAT)"),
    ("Customer Satisfaction Score (CSAT) post-apertura conto in filiale", "Indice di soddisfazione dei clienti (CSAT) dopo l'apertura del conto in filiale"),
    ("Customer lifetime value della clientela retail", "Valore della clientela retail nel tempo (customer lifetime value)"),
    ("Percentuale della rete commerciale che raggiunge le quote/target di vendita assegnati", "Percentuale della rete commerciale che raggiunge le quote e gli obiettivi di vendita assegnati"),
    ("Percentuale di clienti target con marketing personalizzato in una campagna tipica", "Percentuale di clienti obiettivo raggiunti da marketing personalizzato in una campagna tipica"),
    ("Punteggio di Customer Satisfaction/Net Promoter Score sulla relazione commerciale", "Punteggio di soddisfazione dei clienti e indice di raccomandazione (Net Promoter Score) sulla relazione commerciale"),
    ("Scostamento tra risultati effettivi e target del piano strategico triennale", "Scostamento tra risultati effettivi e obiettivi del piano strategico triennale"),
    ("Tasso di conversione canale web monitorato vs target", "Tasso di conversione del canale web monitorato rispetto all'obiettivo"),
    ("Tempo di ciclo per posizioni di middle management/specialisti, dall'approvazione della richiesta all'accettazione dell'offerta", "Tempo di ciclo per le posizioni di quadri intermedi e specialisti, dall'approvazione della richiesta all'accettazione dell'offerta"),
]
for en, it in KN:
    add("sys_kpi_definitions", "kpi_definition_name", en, it)
    add("sys_kpi_definitions", "kpi_definition_description", en, it)
    add("sys_kpi_metric_definitions", "kpi_metric_definition_name", en, it)
KF = [
    ("% clienti promotori (voto 9-10) meno % clienti detrattori (voto 0-6) da indagine di customer satisfaction, confronto anno su anno", "% clienti promotori (voto 9-10) meno % clienti detrattori (voto 0-6) da indagine di soddisfazione dei clienti, confronto anno su anno"),
    ("(Numero di patch di sicurezza applicate entro i tempi target della policy / Numero totale di patch di sicurezza da applicare) x 100", "(Numero di aggiornamenti di sicurezza applicati entro i tempi obiettivo della politica / Numero totale di aggiornamenti di sicurezza da applicare) x 100"),
    ("(risultato effettivo - target di piano) / target di piano x 100", "(risultato effettivo - obiettivo di piano) / obiettivo di piano x 100"),
    ("Conteggio delle segnalazioni di scostamento dal target inviate alla Direzione nel periodo, con relativa azione correttiva proposta", "Conteggio delle segnalazioni di scostamento dall'obiettivo inviate alla Direzione nel periodo, con relativa azione correttiva proposta"),
    ("Costo del personale impiegato nei processi " + P_COST + " diviso il numero di FTE di tali processi", "Costo del personale impiegato nei processi " + P_COST_IT + " diviso il numero di FTE di tali processi"),
    ("Costo del personale impiegato nel processo 'reward and retain employees' nel periodo / numero dipendenti dell'azienda", "Costo del personale impiegato nel processo «remunerare e trattenere le persone» nel periodo / numero dipendenti dell'azienda"),
    ("Costo totale (esterno+overhead+personale+sistemi+altro) per svolgere il processo 'reward and retain employees' / numero dipendenti dell'azienda", "Costo totale (esterno + spese generali + personale + sistemi + altro) per svolgere il processo «remunerare e trattenere le persone» / numero dipendenti dell'azienda"),
    ("Costo totale (personale, sistemi, overhead, outsourcing) per svolgere i processi " + P_COST + " per ogni $1.000 di ricavi", "Costo totale (personale, sistemi, spese generali, esternalizzazioni) per svolgere i processi " + P_COST_IT + " per ogni 1.000 dollari di ricavi"),
    ("Costo totale per svolgere i processi " + P_COST + " diviso il numero di FTE che li svolgono", "Costo totale per svolgere i processi " + P_COST_IT + " diviso il numero di FTE che li svolgono"),
    ("Numero FTE che svolgono il processo 'service bank customers' / fatturato retail (interessi + commissioni) in miliardi di euro", "Numero FTE che svolgono il processo «servire la clientela bancaria» / fatturato retail (interessi + commissioni) in miliardi di euro"),
    ("Numero di addetti commerciali che hanno raggiunto la quota/target assegnato nel periodo / totale addetti commerciali x100", "Numero di addetti commerciali che hanno raggiunto la quota o l'obiettivo assegnato nel periodo / totale addetti commerciali x100"),
    ("Numero di clienti destinatari di marketing personalizzato in una campagna tipica diviso numero totale di clienti target della campagna, per 100", "Numero di clienti destinatari di marketing personalizzato in una campagna tipica diviso numero totale di clienti obiettivo della campagna, per 100"),
    ("Numero di giorni lavorativi dall'inizio alla fine del ciclo di elaborazione della busta paga, confrontato con il target trimestrale", "Numero di giorni lavorativi dall'inizio alla fine del ciclo di elaborazione della busta paga, confrontato con l'obiettivo trimestrale"),
    ("Numero di giorni trascorsi tra l'approvazione della richiesta di personale e l'accettazione dell'offerta di lavoro, per le posizioni di middle management/specialisti", "Numero di giorni trascorsi tra l'approvazione della richiesta di personale e l'accettazione dell'offerta di lavoro, per le posizioni di quadri intermedi e specialisti"),
    ("Numero di risorse della rete commerciale che raggiungono il target assegnato / Numero totale di risorse della rete commerciale x 100", "Numero di risorse della rete commerciale che raggiungono l'obiettivo assegnato / Numero totale di risorse della rete commerciale x 100"),
    ("Numero di vendite/richieste prodotto completate online / Numero totale di visitatori del sito web, confrontato periodicamente con il target", "Numero di vendite e richieste di prodotto completate online / Numero totale di visitatori del sito web, confrontato periodicamente con l'obiettivo"),
    ("Somma ore di risposta alle richieste non-routine (casi complessi, ricorsi) di 'reward and retain employees' risolte nel periodo / numero di richieste non-routine risolte nel periodo", "Somma delle ore di risposta alle richieste non ordinarie (casi complessi, ricorsi) di «remunerare e trattenere le persone» risolte nel periodo / numero di richieste non ordinarie risolte nel periodo"),
    ("Somma ore di risposta alle richieste routine di 'reward and retain employees' risolte nel periodo / numero di richieste routine risolte nel periodo", "Somma delle ore di risposta alle richieste ordinarie di «remunerare e trattenere le persone» risolte nel periodo / numero di richieste ordinarie risolte nel periodo"),
    ("Totale DWE nel gruppo di processo 'perform planning and management accounting' diviso il numero di FTE che svolgono il processo", "Totale DWE nel gruppo di processi «pianificazione e contabilità direzionale» diviso il numero di FTE che svolgono il processo"),
    ("Totale DWE nel gruppo di processo 'perform planning and management accounting' diviso il totale degli FTE dell'intera azienda", "Totale DWE nel gruppo di processi «pianificazione e contabilità direzionale» diviso il totale degli FTE dell'intera azienda"),
    ("Totale dei Digital Worker Equivalents (DWE) nel gruppo di processo 'perform planning and management accounting' diviso il numero di FTE che svolgono il processo", "Totale dei lavoratori digitali equivalenti (DWE) nel gruppo di processi «pianificazione e contabilità direzionale» diviso il numero di FTE che svolgono il processo"),
    ("differenza media tra target assegnato alla business unit e target aziendale coerente x 100", "differenza media tra obiettivo assegnato all'unità di business e obiettivo aziendale coerente x 100"),
]
for en, it in KF:
    add("sys_kpi_definitions", "kpi_definition_formula", en, it)

# --- annunci, percorsi e moduli formativi, programmi di mentorship ---
POST = [
    ("Annuncio interno: Head of Marketing presso Divisione Marketing e Comunicazione. Riservato alle persone di RTL Bank.", "Annuncio interno: Responsabile Marketing presso Divisione Marketing e Comunicazione. Riservato alle persone di RTL Bank."),
    ("Annuncio interno: Head of Legal & Compliance presso Direzione Compliance e Protezione Dati. Riservato alle persone di RTL Bank.", "Annuncio interno: Responsabile Legale e Compliance presso Direzione Compliance e Protezione Dati. Riservato alle persone di RTL Bank."),
    ("Annuncio interno: Head of Treasury presso Direzione Tesoreria e Mercati. Riservato alle persone di RTL Bank.", "Annuncio interno: Responsabile Tesoreria presso Direzione Tesoreria e Mercati. Riservato alle persone di RTL Bank."),
    ("Annuncio interno: Risk Manager presso Direzione Risk Management. Riservato alle persone di RTL Bank.", "Annuncio interno: Responsabile Gestione Rischi presso Direzione Gestione dei Rischi. Riservato alle persone di RTL Bank."),
    ("Annuncio interno: Head of Internal Audit presso Direzione Internal Audit. Riservato alle persone di RTL Bank.", "Annuncio interno: Responsabile Internal Audit presso Direzione Internal Audit. Riservato alle persone di RTL Bank."),
]
for en, it in POST:
    add("sys_job_postings", "posting_description", en, it)
add("sys_learning_paths", "learning_path_description", "Analytics nel banking: customer analytics, credit scoring, fraud detection, automation.", "Analisi dei dati nel settore bancario: analisi della clientela, valutazione del merito di credito, individuazione delle frodi, automazione.")
add("sys_learning_paths", "learning_path_description", "Corso base sulle competenze di leadership e gestione team", "Corso base sulle competenze di leadership e di gestione della squadra")
add("sys_learning_paths", "learning_path_description", "Fondamenti di Customer Due Diligence (CDD), Enhanced Due Diligence (EDD), identificazione PEP, screening liste sanzioni.", "Fondamenti di adeguata verifica della clientela (CDD) e di adeguata verifica rafforzata (EDD), identificazione delle persone politicamente esposte, controllo delle liste sanzioni.")
add("sys_learning_paths", "learning_path_description", "Sviluppo competenze di leadership per team leader", "Sviluppo delle competenze di leadership per i responsabili di squadra")
add("sys_learning_paths", "learning_path_description", "Tecniche di customer service per il settore bancario: gestione reclami, cross-selling etico.", "Tecniche di assistenza alla clientela per il settore bancario: gestione dei reclami, vendita incrociata etica.")
add("sys_learning_modules", "learning_module_title", "Corso su gestione reclami e customer satisfaction", "Corso su gestione dei reclami e soddisfazione dei clienti")
add("sys_learning_modules", "learning_module_description", "Corso su gestione reclami e customer satisfaction", "Corso su gestione dei reclami e soddisfazione dei clienti")
add("sys_mentorship_programs", "program_description",
    "A comprehensive 12-month program designed to develop the next generation of banking leaders. Participants are paired with senior executives to build strategic thinking, decision-making, and team management skills.",
    "Programma completo di 12 mesi per formare la prossima generazione di dirigenti bancari. I partecipanti sono affiancati a dirigenti senior per sviluppare pensiero strategico, capacità decisionale e gestione della squadra.")
add("sys_mentorship_programs", "program_description",
    "Sostegno ai nuovi responsabili nel passaggio da collaboratore a guida delle persone. Attenzione al coaching, alla restituzione di feedback e alle dinamiche di team.",
    "Sostegno ai nuovi responsabili nel passaggio da collaboratore a guida delle persone. Attenzione al coaching, alla restituzione di riscontri e alle dinamiche della squadra.")


# --- italiani con «team» (confronto con la produzione, 15/11): squadra, come nel resto del tenant ---
for t, c, en, it in [
    ("sys_goal_updates", "update_content", "Collaborazione con il team di sviluppo per accelerare i tempi", "Collaborazione con la squadra di sviluppo per accelerare i tempi"),
    ("sys_goal_updates", "update_content", "Formazione del team completata, fase operativa avviata", "Formazione della squadra completata, fase operativa avviata"),
    ("sys_goal_check_ins", "check_in_notes", "Bloccato su una dipendenza da un altro team (Finanza e Operations). Riallineamento in agenda.", "Bloccato su una dipendenza da un'altra squadra (Finanza e Operations). Riallineamento in agenda."),
    ("sys_goal_check_ins", "check_in_notes", "Dipendenza esterna in ritardo (fornitore o altro team). Monitoraggio settimanale.", "Dipendenza esterna in ritardo (fornitore o altra squadra). Monitoraggio settimanale."),
    ("sys_goal_comments", "comment_content", "Possiamo coinvolgere il team IT per supporto tecnico?", "Possiamo coinvolgere la squadra IT per un supporto tecnico?"),
    ("sys_goal_comments", "comment_content", "Suggerisco di coinvolgere il team compliance per la prossima fase", "Suggerisco di coinvolgere la squadra compliance per la prossima fase"),
    ("sys_feedback_360_responses", "response_strengths", "Bravo a costruire relazioni fra i team", "Bravo a costruire relazioni fra le squadre"),
    ("sys_feedback_360_responses", "response_strengths", "Ottimo atteggiamento e influenza positiva sul team", "Ottimo atteggiamento e influenza positiva sulla squadra"),
    ("sys_feedback_360_responses", "response_strengths", "Ottima collaborazione e supporto al team", "Ottima collaborazione e supporto alla squadra"),
    ("sys_goals", "goal_description", "Raggiungere gli obiettivi di performance definiti nel piano individuale. Partecipare attivamente alle iniziative di team.", "Raggiungere gli obiettivi di performance definiti nel piano individuale. Partecipare attivamente alle iniziative di squadra."),
    ("sys_goals", "goal_description", "Sostenere la crescita del team e il passaggio di conoscenze", "Sostenere la crescita della squadra e il passaggio di conoscenze"),
]:
    add(t, c, en, it)


def q(s):
    return "'" + s.replace("'", "''") + "'"


# Un valore non deve comparire due volte per la stessa colonna con traduzioni diverse
visti = {}
for t, c, en, it in R:
    k = (t, c, en)
    assert k not in visti or visti[k] == it, k
    visti[k] = it
R = [(t, c, en, it) for (t, c, en), it in visti.items()]
tabelle = sorted({t for t, _, _, _ in R})
for t in tabelle:
    assert t in TENANT, t

print("-- J3 (mandato RTL 2026-11-15): testi inglesi del tenant RTL Bank (sezione A del censimento). GENERATO da genera_J3_testi.py: non si modifica a mano.")
print("-- Idempotente: sostituisce solo valori ESATTI, solo nel tenant RTL. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).")
print("-- Rollback: UPDATE sys.<tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo (e stesso tenant), per ogni riga del giornale scritta da J3.")
print("-- Non toccati: codici con CHECK (check_in_status_update=COMPLETED, requisition_reason=GROWTH), registro tecnico eccezione_motivo, export_payload derivati, titoli di ruolo e nomi ufficiali di certificazioni.")
print("\\set ON_ERROR_STOP on")
print("BEGIN;")
print("CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));")
print("CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;")
print("CREATE TEMP TABLE tg(tabella text PRIMARY KEY, filtro text) ON COMMIT DROP;")
print("CREATE TEMP TABLE misura(fase text, tabella text, righe_totali bigint, righe_inglesi bigint) ON COMMIT DROP;")
print("INSERT INTO tg VALUES")
print(",\n".join(f"({q(t)},{q(TENANT[t].format(T=RTL))})" for t in tabelle) + ";")
print("INSERT INTO tr VALUES")
print(",\n".join(f"({q(t)},{q(c)},{q(en)},{q(it)})" for t, c, en, it in R) + ";")
print(f"""-- Guardia: il tenant RTL esiste con i suoi dati (un database diverso o vuoto non si tocca) e nessun valore di arrivo coincide con uno di partenza.
DO $$ BEGIN
  IF (SELECT count(*) FROM sys.sys_goals WHERE goal_tenant_id = '{RTL}') < 1000 THEN RAISE EXCEPTION 'J3: il tenant RTL non ha i dati attesi, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM tr a JOIN tr b ON a.tabella=b.tabella AND a.colonna=b.colonna AND a.it=b.en) THEN RAISE EXCEPTION 'J3: catena di traduzioni, si ferma'; END IF;
END $$;
-- Misura prima: per tabella, righe del tenant e righe che portano un valore inglese elencato
DO $$ DECLARE r record; tot bigint; ing bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    ing := 0;
    INSERT INTO misura VALUES ('prima', r.tabella, tot, 0);
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO ing;
    UPDATE misura SET righe_inglesi = righe_inglesi + ing WHERE fase='prima' AND tabella=r.tabella;
  END LOOP;
  RAISE NOTICE 'J3 prima: % righe inglesi elencate in % tabelle', (SELECT sum(righe_inglesi) FROM misura WHERE fase='prima'), (SELECT count(*) FROM misura WHERE fase='prima');
END $$;
DO $$ DECLARE r record; n bigint; da_cambiare bigint := 0; BEGIN
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO n;
    da_cambiare := da_cambiare + n;
    IF n > 0 THEN
      INSERT INTO staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe) VALUES (r.tabella, r.colonna, r.en, r.it, n) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE sys.%I SET %I = %L WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.it, r.colonna, r.en, r.filtro);
    END IF;
  END LOOP;
  RAISE NOTICE 'J3: righe da cambiare prima = %', da_cambiare;
END $$;
-- Misura dopo e post-condizione: nessuna riga persa o aggiunta, nessun valore inglese elencato rimasto nel tenant
DO $$ DECLARE r record; tot bigint; prima bigint; resto bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    SELECT righe_totali INTO prima FROM misura WHERE fase='prima' AND tabella=r.tabella;
    IF tot IS DISTINCT FROM prima THEN RAISE EXCEPTION 'J3: la tabella % ha cambiato numero di righe (% -> %)', r.tabella, prima, tot; END IF;
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO resto;
    IF resto > 0 THEN RAISE EXCEPTION 'J3: restano % righe con %.% = %', resto, r.tabella, r.colonna, left(r.en, 60); END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'J3 ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale;
-- Guardia vettori (classe J3, 19/11): se un testo con vettore e' cambiato e il vettore non e' stato ricalcolato, esce rosso. Rinviabile con -v vettori_rinvia=1 (lo fa applica.sh, che chiude con vettori.sh --verifica).
\\if :{{?vettori_rinvia}}
\\else
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM sys.v_embedding_impronta_non_combacia;
  IF n > 0 THEN RAISE EXCEPTION 'J3: % vettori non combaciano piu'' col testo, ricalcola: bash db/scripts/rtl-allinea/vettori.sh --ricalcola', n; END IF; END $$;
\\endif""")
