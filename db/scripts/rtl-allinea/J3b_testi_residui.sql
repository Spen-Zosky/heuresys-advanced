-- J3b (estensione, 2026-11-19): testi inglesi o misti residui del tenant RTL Bank, emersi dal confronto con la produzione. GENERATO da genera_J3b_testi_residui.py: non si modifica a mano.
-- Idempotente: sostituisce solo valori ESATTI, solo nel tenant RTL. Giornale: staging.rtl_allinea_testi_undo (tabella, colonna, vecchio, nuovo, righe).
-- Rollback: UPDATE sys.<tabella> SET <colonna> = vecchio WHERE <colonna> = nuovo (e stesso tenant), per ogni riga del giornale scritta da J3b.
-- Non toccati: codici con CHECK (check_in_status_update=COMPLETED, requisition_reason=GROWTH), registro tecnico eccezione_motivo, export_payload derivati, titoli di ruolo e nomi ufficiali di certificazioni.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_testi_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, colonna text NOT NULL, vecchio text NOT NULL, nuovo text NOT NULL, righe bigint NOT NULL, PRIMARY KEY (tabella, colonna, vecchio));
CREATE TEMP TABLE tr(tabella text, colonna text, en text, it text) ON COMMIT DROP;
CREATE TEMP TABLE tg(tabella text PRIMARY KEY, filtro text) ON COMMIT DROP;
CREATE TEMP TABLE misura(fase text, tabella text, righe_totali bigint, righe_inglesi bigint) ON COMMIT DROP;
INSERT INTO tg VALUES
('sys_goal_check_ins','check_in_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goal_milestones','milestone_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goal_templates','template_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_goals','goal_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_learning_paths','learning_path_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_objective_reward_rules','objective_reward_rule_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_okr_check_ins','check_in_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_okrs','okr_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0'''),
('sys_skills','skill_tenant_id = ''86ba7a65-217f-48ba-8ce5-5c09b40a66b0''');
INSERT INTO tr VALUES
('sys_goals','goal_description','Enhance digital transformation skills','Potenziare le competenze di trasformazione digitale'),
('sys_goals','goal_description','Meet or exceed assigned revenue goals','Raggiungere o superare gli obiettivi di ricavo assegnati'),
('sys_goals','goal_description','Obtain Anti-Money Laundering professional certification','Ottenere la certificazione professionale in materia di antiriciclaggio'),
('sys_goals','goal_description','Ensure all banking operations meet regulatory requirements','Garantire che tutte le operazioni bancarie rispettino i requisiti normativi'),
('sys_goals','goal_title','Implement fraud detection improvements - Q4 2025','Attuare i miglioramenti del rilevamento delle frodi - 4T 2025'),
('sys_okrs','okr_objective','Implement AI-powered fraud detection','Realizzare il rilevamento delle frodi basato sull''intelligenza artificiale'),
('sys_goal_check_ins','check_in_next_steps','Update piano + rivedere milestone Q+1','Aggiornare il piano e rivedere i traguardi del trimestre successivo'),
('sys_goal_check_ins','check_in_notes','Qualità sotto target su metric secondario. Refocus richiesto.','Qualità sotto l''obiettivo su una metrica secondaria. Richiesto un riorientamento.'),
('sys_goal_check_ins','check_in_notes','Slippage di 2 settimane su deliverable principale. Recovery plan in revisione.','Slittamento di 2 settimane sul documento principale da consegnare. Piano di recupero in revisione.'),
('sys_goal_check_ins','check_in_notes','Esecuzione fluida, no blockers materiali.','Esecuzione fluida, nessun ostacolo rilevante.'),
('sys_goal_check_ins','check_in_notes','Resource gap critico — hiring decision pending.','Carenza critica di risorse — decisione di assunzione in sospeso.'),
('sys_okr_check_ins','check_in_notes','Completate attività chiave, buon momentum','Completate le attività chiave, buon slancio'),
('sys_goal_milestones','milestone_title','Ottenere feedback stakeholders','Ottenere il riscontro dei portatori di interesse'),
('sys_goal_templates','template_description','Offrire attività di mentorship ai membri junior del team','Offrire attività di affiancamento ai membri junior della squadra'),
('sys_skills','skill_description','VaR calculations, market risk models, trading book risk assessment','Calcolo del VaR, modelli di rischio di mercato, valutazione del rischio del portafoglio di negoziazione'),
('sys_skills','skill_description','Regulatory stress tests, scenario design, capital impact assessment','Prove di stress regolamentari, definizione degli scenari, valutazione dell''impatto sul capitale'),
('sys_skills','skill_description','Payment Services Directive 2, API banking, third-party provider integration','Seconda direttiva sui servizi di pagamento, API bancarie, integrazione con fornitori terzi'),
('sys_skills','skill_description','Mobile payments, digital wallets, blockchain-based transactions','Pagamenti da dispositivo mobile, portafogli digitali, transazioni basate su blockchain'),
('sys_skills','skill_description','Expected credit loss models, hedge accounting, financial instrument classification','Modelli di perdita attesa su crediti, contabilizzazione delle operazioni di copertura, classificazione degli strumenti finanziari'),
('sys_skills','skill_description','ESG criteria integration, green bonds, sustainable lending frameworks','Integrazione dei criteri ESG, obbligazioni verdi, quadri per il credito sostenibile'),
('sys_skills','skill_description','Client relationship development, cross-selling, client retention strategies','Sviluppo della relazione con il cliente, vendita incrociata, strategie di fidelizzazione'),
('sys_skills','skill_description','Banking-specific security controls, SWIFT CSP, secure transaction protocols','Controlli di sicurezza specifici del settore bancario, SWIFT CSP, protocolli per transazioni sicure'),
('sys_skills','skill_description','Banking audit methodologies, regulatory examination preparation, control testing','Metodologie di revisione bancaria, preparazione alle ispezioni regolamentari, verifica dei controlli'),
('sys_skills','skill_description','Treasury operations, cash pooling, payment processing','Operazioni di tesoreria, gestione accentrata della liquidità, elaborazione dei pagamenti'),
('sys_skills','skill_description','RCSA, loss event collection, key risk indicators, operational risk capital','RCSA, raccolta degli eventi di perdita, indicatori chiave di rischio, capitale a fronte del rischio operativo'),
('sys_learning_paths','learning_path_description','VaR, Expected Shortfall, stress testing, scenario analysis, backtesting, hedging strategies.','VaR, Expected Shortfall, prove di stress, analisi di scenario, backtesting, strategie di copertura.'),
('sys_learning_paths','learning_path_description','ALM, liquidity gap, LCR/NSFR, contingency funding plan, stress test liquidita.','ALM, gap di liquidità, LCR/NSFR, piano di finanziamento di emergenza, prove di stress sulla liquidità.'),
('sys_learning_paths','learning_path_description','Analisi merito creditizio: rating interni, PD/LGD/EAD, scoring models, financial statement analysis.','Analisi del merito creditizio: rating interni, PD/LGD/EAD, modelli di scoring, analisi di bilancio.'),
('sys_learning_paths','learning_path_description','Costruzione portafoglio: Modern Portfolio Theory, CAPM, diversificazione, rebalancing.','Costruzione del portafoglio: teoria moderna del portafoglio, CAPM, diversificazione, ribilanciamento.'),
('sys_learning_paths','learning_path_description','Direttiva MiFID II: product governance, best execution, inducements, recording, reporting EMIR/MiFIR.','Direttiva MiFID II: governo dei prodotti, migliore esecuzione, incentivi, registrazione, segnalazioni EMIR/MiFIR.'),
('sys_learning_paths','learning_path_description','Framework OpRisk: identificazione, assessment, mitigazione, KRI, loss data collection, RCSA.','Quadro OpRisk: identificazione, valutazione, mitigazione, KRI, raccolta dei dati sulle perdite, RCSA.'),
('sys_learning_paths','learning_path_description','Investimenti ESG: rating ESG, green bonds, impact investing, EU Taxonomy, SFDR.','Investimenti ESG: rating ESG, obbligazioni verdi, investimenti a impatto, tassonomia UE, SFDR.'),
('sys_learning_paths','learning_path_description','Mercati finanziari: equity, fixed income, derivatives, forex. Order types, execution, settlement.','Mercati finanziari: azioni, reddito fisso, derivati, cambi. Tipi di ordine, esecuzione, regolamento.'),
('sys_learning_paths','learning_path_description','Minacce cyber specifiche banking: APT, ransomware, insider threat, SWIFT security.','Minacce informatiche specifiche del settore bancario: APT, ransomware, minacce interne, sicurezza SWIFT.'),
('sys_learning_paths','learning_path_description','Payment Services Directive 2: SCA, API banking, TPP, AISP/PISP, sicurezza pagamenti.','Seconda direttiva sui servizi di pagamento: SCA, API bancarie, TPP, AISP/PISP, sicurezza dei pagamenti.'),
('sys_learning_paths','learning_path_description','Principi consulenza finanziaria: asset allocation, profilo rischio cliente, suitability.','Principi di consulenza finanziaria: allocazione del patrimonio, profilo di rischio del cliente, adeguatezza.'),
('sys_learning_paths','learning_path_description','Vendita etica prodotti bancari: needs-based selling, trasparenza, conflitto interessi.','Vendita etica dei prodotti bancari: vendita basata sui bisogni, trasparenza, conflitto di interessi.'),
('sys_learning_paths','learning_path_description','Preparazione FRM GARP Part I: quantitative analysis, financial markets, valuation models.','Preparazione all''esame FRM GARP, parte I: analisi quantitativa, mercati finanziari, modelli di valutazione.'),
('sys_learning_paths','learning_path_description','Privacy nel settore bancario: consenso, data retention, diritti DSAR, breach notification.','Privacy nel settore bancario: consenso, conservazione dei dati, diritti DSAR, notifica delle violazioni.'),
('sys_objective_reward_rules','objective_reward_rule_name','Platform Performance Bonus 2026','Premio di rendimento della piattaforma 2026'),
('sys_objective_reward_rules','objective_reward_rule_name','Spot Bonus Pool Q4 2024','Fondo premi una tantum 4T 2024'),
('sys_objective_reward_rules','objective_reward_rule_name','Critical Skills Retention 2024','Mantenimento delle competenze critiche 2024');
-- Guardia: il tenant RTL esiste con i suoi dati (un database diverso o vuoto non si tocca) e nessun valore di arrivo coincide con uno di partenza.
DO $$ BEGIN
  IF (SELECT count(*) FROM sys.sys_goals WHERE goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') < 1000 THEN RAISE EXCEPTION 'J3b: il tenant RTL non ha i dati attesi, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM tr a JOIN tr b ON a.tabella=b.tabella AND a.colonna=b.colonna AND a.it=b.en) THEN RAISE EXCEPTION 'J3b: catena di traduzioni, si ferma'; END IF;
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
  RAISE NOTICE 'J3b prima: % righe inglesi elencate in % tabelle', (SELECT sum(righe_inglesi) FROM misura WHERE fase='prima'), (SELECT count(*) FROM misura WHERE fase='prima');
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
  RAISE NOTICE 'J3b: righe da cambiare prima = %', da_cambiare;
END $$;
-- Misura dopo e post-condizione: nessuna riga persa o aggiunta, nessun valore inglese elencato rimasto nel tenant
DO $$ DECLARE r record; tot bigint; prima bigint; resto bigint; BEGIN
  FOR r IN SELECT DISTINCT t.tabella, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %s', r.tabella, r.filtro) INTO tot;
    SELECT righe_totali INTO prima FROM misura WHERE fase='prima' AND tabella=r.tabella;
    IF tot IS DISTINCT FROM prima THEN RAISE EXCEPTION 'J3b: la tabella % ha cambiato numero di righe (% -> %)', r.tabella, prima, tot; END IF;
  END LOOP;
  FOR r IN SELECT t.*, g.filtro FROM tr t JOIN tg g USING (tabella) LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = %L AND (%s)', r.tabella, r.colonna, r.en, r.filtro) INTO resto;
    IF resto > 0 THEN RAISE EXCEPTION 'J3b: restano % righe con %.% = %', resto, r.tabella, r.colonna, left(r.en, 60); END IF;
  END LOOP;
END $$;
COMMIT;
SELECT 'J3b ok' esito, (SELECT count(*) FROM staging.rtl_allinea_testi_undo) voci_nel_giornale;
