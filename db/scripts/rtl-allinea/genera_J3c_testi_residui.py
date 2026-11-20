#!/usr/bin/env python3
"""Genera J3c_testi_residui.sql: terza estensione di J3 con i testi inglesi o misti del tenant RTL Bank emersi dal giro del 20/11/2026
(rilevatore: parole inglesi comuni e nessuna lettera accentata, su tutte le colonne di testo libero delle tabelle con tenant, letto da una copia usa-e-getta
del backup; i valori distinti sono stati rivisti uno per uno). Stesso modello di J3 e J3b: valori ESATTI, solo tenant RTL, giornale staging.rtl_allinea_testi_undo,
misura prima e dopo, post-condizione, rollback dichiarato. Nessun valore coincide con uno di J3/J3b.
Uso: python3 genera_J3c_testi_residui.py > J3c_testi_residui.sql

Include la riparazione di sys_user_timeline_events: J (11/11) scriveva `substr(s, 24)` dove «Certification earned: » e' lungo 22 caratteri, e il primo carattere del
nome della certificazione andava perso («ertificazione Interna Leadership»). L'origine e' corretta in J (substr(s, 23)); qui si ripristinano i 9 valori storpiati.

Lasciati di proposito: codici con CHECK (template_category degli engagement, feedback_category, prediction_label, ...), sigle e termini ufficiali (LCR, ROE, NPL ratio, NPS,
cross-selling ratio, lead time, customer lifetime value), nomi ufficiali delle certificazioni (CAMS, CFA, FRM, ABA Bank Teller Certificate, GDPR Data Protection Officer),
nomi di ruolo di uso comune in banca (Internal Auditor, Risk Manager), nomi di utenti di collaudo.
"""

RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0"

TENANT = {
    "sys_behavioral_assessments": "behavioral_assessment_tenant_id = '{T}'",
    "sys_calibration_sessions": "calibration_session_tenant_id = '{T}'",
    "sys_content_versions": "version_tenant_id = '{T}'",
    "sys_engagement_surveys": "survey_tenant_id = '{T}'",
    "sys_goal_check_ins": "check_in_tenant_id = '{T}'",
    "sys_goal_milestones": "milestone_tenant_id = '{T}'",
    "sys_goal_templates": "template_tenant_id = '{T}'",
    "sys_goals": "goal_tenant_id = '{T}'",
    "sys_kpi_definitions": "kpi_definition_tenant_id = '{T}'",
    "sys_kpi_targets": "kpi_target_tenant_id = '{T}'",
    "sys_leads": "true",
    "sys_mentorship_programs": "program_tenant_id = '{T}'",
    "sys_okr_check_ins": "check_in_tenant_id = '{T}'",
    "sys_overtime": "overtime_tenant_id = '{T}'",
    "sys_performance_review_competency_ratings": "rating_tenant_id = '{T}'",
    "sys_predictive_models": "model_tenant_id = '{T}'",
    "sys_pulse_checks": "pulse_check_tenant_id = '{T}'",
    "sys_survey_questions": "survey_question_tenant_id = '{T}'",
    "sys_survey_templates": "survey_template_tenant_id = '{T}'",
    "sys_engagement_survey_templates": "template_tenant_id = '{T}'",
    "sys_surveys": "survey_tenant_id = '{T}'",
    "sys_time_off_requests": "request_tenant_id = '{T}'",
    "sys_user_education_records": "user_education_record_tenant_id = '{T}'",
    "sys_user_timeline_events": "user_timeline_event_tenant_id = '{T}'",
}

R = []  # (tabella, colonna, en, it)


def add(t, c, en, it):
    R.append((t, c, en, it))


def mappa(t, c, coppie):
    for en, it in coppie:
        add(t, c, en, it)


# --- assenze e straordinari ---
mappa("sys_time_off_requests", "request_reason", [
    ("Medical appointment", "Visita medica"), ("Family vacation", "Vacanza in famiglia"), ("Family leave", "Permesso per motivi familiari"),
    ("Personal matters", "Motivi personali"), ("Short illness", "Malattia di breve durata"), ("Personal day", "Permesso personale"),
    ("Parental leave", "Congedo parentale")])
mappa("sys_overtime", "overtime_reason", [
    ("Quarter closing", "Chiusura del trimestre"), ("System maintenance", "Manutenzione dei sistemi"), ("Client meeting", "Incontro con il cliente")])
add("sys_overtime", "overtime_notes", "Auto-generated overtime record", "Registrazione di straordinario generata automaticamente")
# --- clima e sondaggi ---
mappa("sys_pulse_checks", "pulse_check_comment", [
    ("Heavy workload but manageable", "Carico di lavoro elevato ma gestibile"), ("Feeling productive this week", "Settimana produttiva")])
SONDAGGI = [
    ("Digital Transformation Feedback", "Riscontri sulla trasformazione digitale"),
    ("Engagement Survey Q1 2024", "Indagine sul coinvolgimento 1T 2024"), ("Engagement Survey Q2 2024", "Indagine sul coinvolgimento 2T 2024"),
    ("Engagement Survey Q3 2024", "Indagine sul coinvolgimento 3T 2024"), ("Engagement Survey Q4 2024", "Indagine sul coinvolgimento 4T 2024"),
    ("Engagement Survey Q1 2025", "Indagine sul coinvolgimento 1T 2025"),
    ("Q4 2024 Employee Engagement Survey", "Indagine sul coinvolgimento dei dipendenti 4T 2024"),
]
mappa("sys_surveys", "survey_title", SONDAGGI)
mappa("sys_engagement_surveys", "survey_title", SONDAGGI)
mappa("sys_surveys", "survey_description", [
    ("Quarterly pulse check on employee engagement", "Rilevazione trimestrale rapida sul coinvolgimento dei dipendenti"),
    ("Quick quarterly check on employee sentiment", "Verifica trimestrale rapida sull'umore dei dipendenti")])
MODELLI = [
    ("Exit Interview Survey", "Indagine di uscita"), ("Employee Engagement Survey", "Indagine sul coinvolgimento dei dipendenti"),
    ("Wellbeing Assessment", "Valutazione del benessere"), ("Onboarding Check-in", "Verifica di inserimento"),
    ("Weekly Pulse Check", "Rilevazione settimanale rapida"), ("Custom Engagement Survey", "Indagine sul coinvolgimento personalizzata"),
]
mappa("sys_survey_templates", "survey_template_name", MODELLI)
mappa("sys_engagement_survey_templates", "template_name", MODELLI)
add("sys_survey_templates", "survey_template_description", "General employee engagement survey", "Indagine generale sul coinvolgimento dei dipendenti")
mappa("sys_survey_questions", "survey_question_category", [
    ("Psychological Safety", "sicurezza psicologica"), ("Belonging", "appartenenza"), ("Career", "carriera"), ("Workload", "carico di lavoro"),
    ("Pride", "orgoglio"), ("Communication", "comunicazione"), ("Motivation", "motivazione"), ("Culture", "cultura"),
    ("Collaboration", "collaborazione"), ("Manager", "responsabile"), ("Growth", "crescita"), ("Resources", "risorse"),
    ("Management", "direzione"), ("Alignment", "allineamento"), ("Recognition", "riconoscimento"), ("Compensation", "retribuzione")])
# --- valutazioni, calibrazioni, previsioni ---
COMP = [("Professional Conduct", "Condotta professionale"), ("Technical Execution", "Esecuzione tecnica"), ("Domain Knowledge", "Conoscenza del settore")]
mappa("sys_performance_review_competency_ratings", "rating_competency_name", COMP)
mappa("sys_behavioral_assessments", "behavioral_assessment_competency", COMP)
mappa("sys_performance_review_competency_ratings", "rating_manager_comment", [
    ("Consistently professional behavior", "Comportamento costantemente professionale"), ("Solid understanding demonstrated", "Solida comprensione dimostrata")])
add("sys_performance_review_competency_ratings", "rating_self_comment", "I maintained high professional standards", "Ho mantenuto standard professionali elevati")
mappa("sys_calibration_sessions", "calibration_session_location", [
    ("Meeting Room A", "Sala riunioni A"), ("Board Room", "Sala del consiglio"), ("Virtual", "Virtuale"), ("Virtual - MS Teams", "Virtuale - MS Teams"),
    ("Milan HQ - Board Room", "Sede di Milano - Sala del consiglio"), ("Milan HQ - Auditorium", "Sede di Milano - Auditorium"),
    ("Milan HQ - Conference A", "Sede di Milano - Sala conferenze A")])
mappa("sys_calibration_sessions", "calibration_session_name", [
    ("Q3 2024 Performance Calibrazione - Operations", "Calibrazione della performance 3T 2024 - Operations"),
    ("Q3 2024 Performance Calibrazione - Tecnologia", "Calibrazione della performance 3T 2024 - Tecnologia")])
mappa("sys_predictive_models", "model_name", [
    ("Skill Gap Analyzer", "Analizzatore dei divari di competenza"), ("Promotion Readiness", "Prontezza alla promozione"),
    ("Performance Predictor", "Previsione delle prestazioni")])
mappa("sys_mentorship_programs", "program_name", [
    ("Digital Transformation Champions", "Ambasciatori della trasformazione digitale"), ("Technical Banking Mastery", "Eccellenza tecnica bancaria"),
    ("Women in Banking Leadership", "Leadership femminile nel settore bancario"), ("Leadership Excellence Program", "Programma di eccellenza nella leadership")])
# --- obiettivi, check-in e traguardi ---
mappa("sys_goal_check_ins", "check_in_blockers", [
    ("Budget approval in attesa", "Approvazione del budget in attesa"), ("Tool/platform issue tecnico", "Problema tecnico di strumento o piattaforma"),
    ("Dipendenza vendor in ritardo", "Dipendenza dal fornitore in ritardo"), ("Sign-off compliance pending", "Approvazione della compliance in attesa")])
mappa("sys_goal_check_ins", "check_in_next_steps", [
    ("Schedulare meeting con stakeholders", "Pianificare un incontro con le parti interessate"),
    ("Escalare blocco a Director per unblock", "Segnalare il blocco al direttore per sbloccarlo"),
    ("Workshop tecnico per refactor approach", "Workshop tecnico per rivedere l'impostazione del codice")])
mappa("sys_goal_check_ins", "check_in_notes", [
    ("Avanzamento regolare. Milestone Q-X raggiunta in tempo.", "Avanzamento regolare. Traguardo del trimestre raggiunto in tempo."),
    ("Risk score elevato per resource constraint. Escalation valutata.", "Punteggio di rischio elevato per vincolo di risorse. Segnalazione al livello superiore in valutazione."),
    ("In attesa di sign-off compliance per next phase.", "In attesa dell'approvazione della compliance per la fase successiva."),
    ("Outcome misurabile validato dal manager.", "Risultato misurabile convalidato dal responsabile.")])
add("sys_okr_check_ins", "check_in_next_steps", "Coinvolgere stakeholder aggiuntivi", "Coinvolgere altre parti interessate")
add("sys_okr_check_ins", "check_in_blockers", "Attesa approvazione budget per il prossimo step", "Attesa approvazione del budget per il passo successivo")
add("sys_goal_milestones", "milestone_title", "Consolidamento e lessons learned", "Consolidamento e lezioni apprese")
add("sys_goals", "goal_title", "Completare certificazione FRM Part I entro Q2 2025", "Completare la certificazione FRM Parte I entro il 2T 2025")
mappa("sys_goals", "goal_category", [
    ("risk management", "gestione del rischio"), ("customer service", "servizio al cliente"), ("professional development", "sviluppo professionale"),
    ("development", "sviluppo"), ("sales", "vendite")])
mappa("sys_goal_templates", "template_category", [
    ("development", "sviluppo"), ("learning", "apprendimento"), ("project", "progetto"), ("career", "carriera")])
# «Company-wide» NON si traduce: e' il valore sentinella che la migrazione 000357 (riapplicata a ogni deploy) e il codice leggono per «OKR di tutta l'azienda».
mappa("sys_kpi_targets", "kpi_target_unit", [("ratio", "rapporto"), ("score", "punteggio"), ("days", "giorni")])
# --- KPI ---
KPI1 = "Tempo di determinazione della posizione di liquidità giornaliera (daily cash position)"
add("sys_kpi_definitions", "kpi_definition_name", KPI1, "Tempo di determinazione della posizione di liquidità giornaliera")
add("sys_kpi_definitions", "kpi_definition_description", KPI1, "Tempo di determinazione della posizione di liquidità giornaliera")
add("sys_kpi_definitions", "kpi_definition_formula", "ora di pubblicazione del report di daily cash position - ora di apertura operativa prevista",
    "ora di pubblicazione del report della posizione di cassa giornaliera - ora di apertura operativa prevista")
add("sys_kpi_definitions", "kpi_definition_formula", "(numero giorni con daily cash position pubblicata entro l'orario operativo prestabilito / giorni operativi nel periodo) x100",
    "(numero giorni con posizione di cassa giornaliera pubblicata entro l'orario operativo prestabilito / giorni operativi nel periodo) x100")
# --- formazione, documenti, contatti ---
mappa("sys_user_education_records", "user_education_field_of_study", [("Business Administration", "Economia Aziendale"), ("Computer Science", "Informatica")])
add("sys_content_versions", "version_change_note", "Initial version", "Versione iniziale")
add("sys_leads", "lead_message", "Please contact me with more information.", "Vi chiedo di contattarmi per avere maggiori informazioni.")
# --- riparazione: primo carattere perso da J (substr(s, 24) al posto di substr(s, 23)) ---
for nome, ente in [
    ("Scrum Master Certified", "Scrum Alliance"), ("Financial Risk Manager (FRM)", "GARP"), ("Antiriciclaggio AML Specialist", "AICOM"),
    ("GDPR Data Protection Officer", "TUV"), ("Sicurezza Base D.Lgs 81/08", "INAIL"), ("Certificazione Interna Leadership", "Internal"),
    ("Certified Anti-Money Laundering Specialist (CAMS)", "ACAMS"), ("ABA Bank Teller Certificate", "American Bankers Association"),
    ("Chartered Financial Analyst (CFA)", "CFA Institute")]:
    add("sys_user_timeline_events", "user_timeline_event_summary", f"Certificazione conseguita: {nome[1:]} ({ente})", f"Certificazione conseguita: {nome} ({ente})")

def q(s):
    return "'" + s.replace("'", "''") + "'"


import guardia_valori  # un valore che il codice o le migrazioni leggono non si traduce (caso «Company-wide», 20/11/2026)
guardia_valori.verifica(R)

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

print("-- J3c (estensione, 2026-11-20): testi inglesi o misti residui del tenant RTL Bank, emersi dal giro del 20/11/2026. GENERATO da genera_J3c_testi_residui.py: non si modifica a mano.")
print("-- Idempotente: sostituisce solo valori ESATTI, solo nel tenant RTL. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).")
print("-- Rollback: UPDATE sys.<tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo (e stesso tenant), per ogni riga del giornale scritta da J3c.")
print("-- Non toccati: codici con CHECK, sigle e termini ufficiali, nomi ufficiali di certificazioni, titoli di ruolo di uso comune (vedi docstring del generatore).")
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
  IF (SELECT count(*) FROM sys.sys_goals WHERE goal_tenant_id = '{RTL}') < 1000 THEN RAISE EXCEPTION 'J3c: il tenant RTL non ha i dati attesi, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM tr a JOIN tr b ON a.tabella=b.tabella AND a.colonna=b.colonna AND a.it=b.en) THEN RAISE EXCEPTION 'J3c: catena di traduzioni, si ferma'; END IF;
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
  RAISE NOTICE 'J3c prima: % righe inglesi elencate in % tabelle', (SELECT sum(righe_inglesi) FROM misura WHERE fase='prima'), (SELECT count(*) FROM misura WHERE fase='prima');
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
  RAISE NOTICE 'J3c: righe da cambiare prima = %', da_cambiare;
END $$;
-- Misura dopo e post-condizione: nessuna riga persa o aggiunta, nessun valore inglese elencato rimasto nel tenant
DO $$ DECLARE r record; tot bigint; prima bigint; resto bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    SELECT righe_totali INTO prima FROM misura WHERE fase='prima' AND tabella=r.tabella;
    IF tot IS DISTINCT FROM prima THEN RAISE EXCEPTION 'J3c: la tabella % ha cambiato numero di righe (% -> %)', r.tabella, prima, tot; END IF;
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO resto;
    IF resto > 0 THEN RAISE EXCEPTION 'J3c: restano % righe con %.% = %', resto, r.tabella, r.colonna, left(r.en, 60); END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'J3c ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale;
-- Guardia vettori (classe J3, 19/11): se un testo con vettore e' cambiato e il vettore non e' stato ricalcolato, esce rosso. Rinviabile con -v vettori_rinvia=1 (lo fa applica.sh, che chiude con vettori.sh --verifica).
\\if :{{?vettori_rinvia}}
\\else
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM sys.v_embedding_impronta_non_combacia;
  IF n > 0 THEN RAISE EXCEPTION 'J3c: % vettori non combaciano piu'' col testo, ricalcola: bash db/scripts/rtl-allinea/vettori.sh --ricalcola', n; END IF; END $$;
\\endif
-- Prima della produzione: bash db/scripts/rtl-allinea/prova-catena.sh <.env della copia di prova> (migrate.sh exit 0 dopo questo script).""")
