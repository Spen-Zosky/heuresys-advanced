-- ============================================================================
-- ADR-0049: riempie il processo del tenant (T1), le sue attivita' (T2), le regole e il legame delle
-- richieste di approvazione. FUORI CATENA: non e' una migrazione, non gira al deploy. Si lancia a mano:
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/attivita/riempi-attivita-dei-processi.sql
--
-- COSA SCRIVE.
--   1. Per ogni tenant, un processo per ogni processo del modello citato dalle sue unita' di processo
--      (codice, nome e descrizione copiati, origine MATERIALIZZAZIONE). L'owner e' il posto che il
--      modello nomina, se il codice si risolve in esattamente un posto attivo del tenant; altrimenti il
--      posto della partecipazione OWNER attiva sulla riga OWNER del processo, se e' uno solo (D-P3-1);
--      altrimenti nessuno, e una riga nel registro dei dubbi. Poi ogni unita' di processo riceve il suo.
--   2. Per RTL Bank, le 131 attivita' dei 23 processi: le fasi del datastore (APQC PCF Banking 8.0,
--      src/carico/fasi_di_riferimento.ts del datastore), con l'unita' che le esegue risolta per codice.
--   3. Per RTL Bank, le regole: ferie e permessi, retribuzioni e formazione appartengono al processo 17
--      «Gestione del capitale umano»; la formazione alla sua attivita' 7.3.4.
--   4. Le richieste di approvazione senza processo ricevono quello della regola del loro tenant.
--
-- GUARDIA. Le tabelle della 000462 devono esistere; ogni attivita' deve trovare il suo processo e la
-- sua unita' nel tenant, altrimenti si ferma senza scrivere niente (tutto in una transazione).
-- GIORNALE: staging.attivita_processi_undo (ogni riga creata o collegata, con identificativo di corsa).
-- REGISTRO DEI DUBBI: staging.attivita_processi_dubbi. INVERSA: riempi-attivita-dei-processi-inversa.sql.
-- POST-CONDIZIONI (RAISE se false): ogni unita' di processo ha il suo processo del tenant; le richieste
-- non toccate da questa corsa sono identiche a prima; le richieste toccate cambiano solo nelle due
-- colonne nuove; le cinque sentinelle della 000462 a zero.
-- IDEMPOTENTE: una seconda passata non trova niente da creare o collegare e non scrive nel giornale.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS staging.attivita_processi_undo (
  undo_id      bigserial PRIMARY KEY,
  run_id       uuid        NOT NULL,
  tabella      varchar(64) NOT NULL,
  riga_id      uuid        NOT NULL,
  azione       varchar(16) NOT NULL CHECK (azione IN ('CREA', 'COLLEGA')),
  valore_dopo  uuid,
  eseguito_il  timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il timestamptz
);
CREATE INDEX IF NOT EXISTS attivita_processi_undo_run_idx ON staging.attivita_processi_undo (run_id);
CREATE TABLE IF NOT EXISTS staging.attivita_processi_dubbi (
  tenant_id    uuid        NOT NULL,
  oggetto      varchar(128) NOT NULL,
  motivo       text        NOT NULL,
  registrato_il timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, oggetto)
);

CREATE TEMP TABLE fasi_rtl (processo varchar(64), codice varchar(64), ordine smallint, nome text, unita varchar(128), fonte varchar(16)) ON COMMIT DROP;
INSERT INTO fasi_rtl VALUES
    ('00', '1.2.3.1', 1, 'Sviluppare la strategia di partnership e alleanze', 'RTL', 'CATALOGO'),
    ('00', '1.2.3.2', 2, 'Sviluppare la strategia di sostenibilità', 'RTL', 'CATALOGO'),
    ('00', '1.2.3.3', 3, 'Sviluppare la strategia di fusioni, scissioni, acquisizioni e uscite', 'RTL', 'CATALOGO'),
    ('00', '1.2.3.4', 4, 'Sviluppare la strategia di innovazione', 'RTL', 'CATALOGO'),
    ('00', '1.2.3.5', 5, 'Sviluppare la strategia dei servizi di supporto', 'DIV-CFO', 'CATALOGO'),
    ('00', '1.2.3.6', 6, 'Sviluppare la strategia dei servizi condivisi', 'DIV-CFO', 'CATALOGO'),
    ('00', '1.2.3.7', 7, 'Sviluppare la strategia di miglioramento continuo', 'RTL', 'CATALOGO'),
    ('01', '5.4.4.1', 1, 'Analizzare il merito creditizio del cliente', 'DIV-CRED', 'CATALOGO'),
    ('01', '5.4.4.2', 2, 'Applicare la politica antiriciclaggio', 'DIV-RETAIL', 'CATALOGO'),
    ('01', '5.4.4.3', 3, 'Applicare la politica di identificazione del cliente', 'DIV-RETAIL', 'CATALOGO'),
    ('01', '5.4.4.4', 4, 'Applicare le condizioni del prodotto', 'DIV-RETAIL', 'CATALOGO'),
    ('01', '5.4.4.5', 5, 'Applicare il prezzo del prodotto', 'DIV-RETAIL', 'CATALOGO'),
    ('01', '5.4.4.6', 6, 'Valutare garanzie e collaterali', 'DIV-CRED', 'CATALOGO'),
    ('01', '5.4.4.7', 7, 'Configurare e attivare il rapporto', 'DIV-RETAIL', 'CATALOGO'),
    ('01', '5.4.4.8', 8, 'Finanziare ed erogare gli importi', 'DIV-CRED', 'CATALOGO'),
    ('02', '5.4.4.2', 1, 'Applicare la politica antiriciclaggio', 'DIR-AML', 'PROCESSO_INTERO'),
    ('03', '5.4.5.1', 1, 'Monitorare lo stato dei conti', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.2', 2, 'Gestire commissioni, interessi e competenze', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.3', 3, 'Monitorare i movimenti dei conti', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.4', 4, 'Rivedere periodicamente garanzie e collaterali', 'DIV-RETAIL', 'CATALOGO'),
    ('03', '5.4.5.5', 5, 'Tenere i conti interni', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.6', 6, 'Riconciliare i conti', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.7', 7, 'Monitorare la redditività dei prodotti', 'DIV-RETAIL', 'CATALOGO'),
    ('03', '5.4.5.8', 8, 'Rivedere il portafoglio dei prodotti', 'DIV-RETAIL', 'CATALOGO'),
    ('03', '5.4.5.9', 9, 'Eseguire il regolamento', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.10', 10, 'Monitorare e gestire gli eventi del conto', 'DIR-BACKOFF', 'CATALOGO'),
    ('03', '5.4.5.11', 11, 'Registrare le rettifiche nel sistema contabile', 'DIR-BACKOFF', 'CATALOGO'),
    ('04', '5.4.9.1', 1, 'Autorizzare le operazioni', 'DIR-PAY', 'CATALOGO'),
    ('04', '5.4.9.2', 2, 'Eseguire i pagamenti in entrata', 'DIR-PAY', 'CATALOGO'),
    ('04', '5.4.9.3', 3, 'Eseguire i pagamenti in uscita', 'DIR-PAY', 'CATALOGO'),
    ('04', '5.4.9.4', 4, 'Regolare le operazioni di trasferimento', 'DIR-BACKOFF', 'CATALOGO'),
    ('05', '5.4.4.1', 1, 'Analizzare il merito creditizio del cliente', 'DIR-CREDITI', 'PROCESSO_INTERO'),
    ('06', '9.2.4.1', 1, 'Definire le politiche sulle posizioni insolventi', 'DIR-RISKM', 'CATALOGO'),
    ('06', '9.2.4.2', 2, 'Analizzare i saldi delle posizioni insolventi', 'DIR-RISKM', 'CATALOGO'),
    ('06', '9.2.4.3', 3, 'Corrispondere e negoziare con i debitori insolventi', 'DIR-CREDITI', 'CATALOGO'),
    ('06', '9.2.4.4', 4, 'Concordare la soluzione della posizione con le funzioni interne', 'DIR-CREDITI', 'CATALOGO'),
    ('06', '9.2.4.5', 5, 'Registrare rettifiche e stralci', 'DIR-CREDITI', 'CATALOGO'),
    ('06', '9.2.4.6', 6, 'Condurre il recupero', 'DIR-CREDITI', 'CATALOGO'),
    ('06', '9.2.4.7', 7, 'Gestire le posizioni in default', 'DIR-CREDITI', 'CATALOGO'),
    ('07', '5.4.11.1', 1, 'Calcolare il rendimento degli investimenti', 'DIV-CRED', 'CATALOGO'),
    ('07', '5.4.11.2', 2, 'Valutare il rendimento rispetto alla politica d''investimento e ai parametri di riferimento', 'DIV-CRED', 'CATALOGO'),
    ('07', '5.4.11.3', 3, 'Valutare l''allocazione rispetto alla strategia e ai portafogli modello', 'DIV-CRED', 'CATALOGO'),
    ('07', '5.4.11.4', 4, 'Monitorare e valutare i gestori esterni', 'DIV-CRED', 'CATALOGO'),
    ('07', '5.4.11.5', 5, 'Ribilanciare i portafogli', 'DIV-RETAIL', 'CATALOGO'),
    ('08', '5.4.10.1', 1, 'Pianificare negoziazione ed esecuzione', 'DIV-RETAIL', 'CATALOGO'),
    ('08', '5.4.10.2', 2, 'Autorizzare gli ordini', 'DIV-CRED', 'CATALOGO'),
    ('08', '5.4.10.3', 3, 'Generare gli ordini', 'DIV-RETAIL', 'CATALOGO'),
    ('08', '5.4.10.4', 4, 'Eseguire le negoziazioni', 'DIV-RETAIL', 'CATALOGO'),
    ('09', '9.7.5.8', 1, 'Analizzare l''andamento dell''adeguatezza patrimoniale', 'DIV-CFO', 'PROCESSO_INTERO'),
    ('10', '11.1.4.1', 1, 'Analizzare lo storico dei rischi operativi', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.2', 2, 'Prevedere il fabbisogno a fronte del rischio operativo', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.3', 3, 'Allocare il capitale a fronte del rischio operativo', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.4', 4, 'Calcolare i rischi operativi secondo Basilea, CRD e norme nazionali', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.5', 5, 'Calcolare i rischi operativi con i modelli interni', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.6', 6, 'Produrre l''informativa di vigilanza (COREP) e la reportistica interna', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.7', 7, 'Raccogliere i dati di perdite ed eventi di rischio operativo', 'DIR-RISKM', 'CATALOGO'),
    ('10', '11.1.4.8', 8, 'Gestire le procedure antiriciclaggio', 'DIR-RISKM', 'CATALOGO'),
    ('11', '11.2.2.1', 1, 'Sviluppare le procedure di conformità normativa', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.2', 2, 'Individuare i requisiti normativi applicabili', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.3', 3, 'Seguire l''evoluzione delle norme', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.4', 4, 'Valutare il livello di conformità e individuarne le carenze', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.5', 5, 'Introdurre o rafforzare controlli e politiche di conformità', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.6', 6, 'Verificare la conformità e i controlli esistenti', 'DIR-AML', 'CATALOGO'),
    ('11', '11.2.2.7', 7, 'Compilare e comunicare i quadri di conformità', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.8', 8, 'Compilare e comunicare le segnalazioni interne e di vigilanza', 'DIR-COMPL', 'CATALOGO'),
    ('11', '11.2.2.9', 9, 'Curare i rapporti con le autorità di vigilanza', 'DIR-COMPL', 'CATALOGO'),
    ('12', '9.8.2.1', 1, 'Verificare l''efficacia dei controlli', 'RTL', 'CATALOGO'),
    ('12', '9.8.2.2', 2, 'Far sanare le carenze dei controlli', 'RTL', 'CATALOGO'),
    ('13', '5.4.8.1', 1, 'Fornire estratti conto e rendiconti', 'DIV-OPS', 'CATALOGO'),
    ('13', '5.4.8.2', 2, 'Gestire i rimborsi', 'DIV-OPS', 'CATALOGO'),
    ('13', '5.4.8.3', 3, 'Gestire le modifiche negoziate', 'DIV-RETAIL', 'CATALOGO'),
    ('13', '5.4.8.4', 4, 'Aggiornare i dati del cliente', 'DIV-OPS', 'CATALOGO'),
    ('13', '5.4.8.5', 5, 'Rivedere ed estendere il credito', 'DIV-RETAIL', 'CATALOGO'),
    ('13', '5.4.8.6', 6, 'Prezzare le operazioni', 'DIV-RETAIL', 'CATALOGO'),
    ('13', '5.4.8.7', 7, 'Strutturare e negoziare le operazioni', 'DIV-RETAIL', 'CATALOGO'),
    ('13', '5.4.8.8', 8, 'Gestire i finanziamenti in pool', 'DIR-BACKOFF', 'CATALOGO'),
    ('13', '5.4.8.9', 9, 'Gestire le cartolarizzazioni', 'DIR-BACKOFF', 'CATALOGO'),
    ('13', '5.4.8.10', 10, 'Amministrare conti di terzi (depositi vincolati, fondi, trust)', 'DIR-BACKOFF', 'CATALOGO'),
    ('13', '5.4.8.11', 11, 'Gestire il contante', 'DIV-OPS', 'CATALOGO'),
    ('13', '5.4.8.12', 12, 'Eseguire le rimesse', 'DIV-OPS', 'CATALOGO'),
    ('13', '5.4.8.13', 13, 'Preparare le conferme delle operazioni', 'DIR-BACKOFF', 'CATALOGO'),
    ('13', '5.4.8.14', 14, 'Preparare e negoziare i contratti quadro', 'DIV-RETAIL', 'CATALOGO'),
    ('14', '6.2.2.1', 1, 'Ricevere problemi, richieste e domande dei clienti', 'DIV-OPS', 'CATALOGO'),
    ('14', '6.2.2.2', 2, 'Analizzare problemi, richieste e domande', 'DIV-OPS', 'CATALOGO'),
    ('14', '6.2.2.3', 3, 'Risolvere problemi, richieste e domande', 'DIV-OPS', 'CATALOGO'),
    ('14', '6.2.2.4', 4, 'Rispondere ai clienti', 'DIV-RETAIL', 'CATALOGO'),
    ('14', '6.2.2.5', 5, 'Cogliere le opportunità di vendita aggiuntiva e incrociata', 'DIV-RETAIL', 'CATALOGO'),
    ('14', '6.2.2.6', 6, 'Passare le opportunità alla rete commerciale', 'DIV-RETAIL', 'CATALOGO'),
    ('15', '3.3.4.1', 1, 'Definire concetti e obiettivi promozionali', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.2', 2, 'Sviluppare i messaggi di marketing', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.3', 3, 'Definire il pubblico di riferimento', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.4', 4, 'Pianificare e provare le attività promozionali', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.5', 5, 'Eseguire le attività promozionali', 'DIV-RETAIL', 'CATALOGO'),
    ('15', '3.3.4.6', 6, 'Valutare gli indicatori delle promozioni', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.7', 7, 'Affinare gli indicatori delle promozioni', 'DIV-MKT', 'CATALOGO'),
    ('15', '3.3.4.8', 8, 'Riportare quanto appreso nelle promozioni future', 'DIV-MKT', 'CATALOGO'),
    ('16', '8.3.1.1', 1, 'Determinare i requisiti normativi e di audit dell''IT', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.2', 2, 'Comprendere la tolleranza al rischio delle unità di business', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.3', 3, 'Stabilire la tolleranza al rischio IT', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.4', 4, 'Assegnare la titolarità dei rischi', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.5', 5, 'Definire e mantenere i ruoli di gestione del rischio', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.6', 6, 'Definire gli obiettivi di conformità', 'DIV-IT', 'CATALOGO'),
    ('16', '8.3.1.7', 7, 'Individuare i sistemi a supporto della conformità', 'DIR-DEV', 'CATALOGO'),
    ('16', '8.3.1.8', 8, 'Individuare e valutare i rischi IT', 'DIR-INFRA', 'CATALOGO'),
    ('16', '8.3.1.9', 9, 'Valutare la resilienza ai rischi IT', 'DIR-INFRA', 'CATALOGO'),
    ('16', '8.3.1.10', 10, 'Definire le strategie di mitigazione dei rischi IT', 'DIV-IT', 'CATALOGO'),
    ('17', '7.3.1', 1, 'Gestire l''inserimento dei dipendenti', 'DIV-HR', 'CATALOGO'),
    ('17', '7.3.2', 2, 'Gestire la prestazione dei dipendenti', 'DIV-HR', 'CATALOGO'),
    ('17', '7.3.3', 3, 'Gestire lo sviluppo di carriera', 'DIV-HR', 'CATALOGO'),
    ('17', '7.3.4', 4, 'Sviluppare e formare i dipendenti', 'DIV-HR', 'CATALOGO'),
    ('18', '9.3.2.1', 1, 'Tenere il piano dei conti', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.2', 2, 'Registrare le scritture contabili', 'DIR-BACKOFF', 'CATALOGO'),
    ('18', '9.3.2.3', 3, 'Eseguire le ripartizioni', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.4', 4, 'Eseguire le rettifiche di fine periodo', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.5', 5, 'Registrare e riconciliare le operazioni infragruppo', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.6', 6, 'Riconciliare i conti di contabilità generale', 'DIR-BACKOFF', 'CATALOGO'),
    ('18', '9.3.2.7', 7, 'Eseguire il consolidamento e le elisioni', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.8', 8, 'Preparare il bilancio di verifica', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.9', 9, 'Preparare e registrare le rettifiche gestionali', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.10', 10, 'Tenere la contabilità dei contratti', 'DIV-CFO', 'CATALOGO'),
    ('18', '9.3.2.11', 11, 'Tenere la contabilità bancaria', 'DIR-BACKOFF', 'CATALOGO'),
    ('18', '9.3.2.12', 12, 'Contabilizzare gli strumenti finanziari', 'DIV-CFO', 'CATALOGO'),
    ('19', '4.2.5.1', 1, 'Gestire le informazioni sui fornitori', 'DIV-CFO', 'CATALOGO'),
    ('19', '4.2.5.2', 2, 'Analizzare le prestazioni di acquisti e fornitori', 'DIV-CFO', 'CATALOGO'),
    ('19', '4.2.5.3', 3, 'Sostenere le scorte e l''operatività', 'DIV-OPS', 'CATALOGO'),
    ('19', '4.2.5.4', 4, 'Controllare la qualità delle forniture', 'DIV-OPS', 'CATALOGO'),
    ('20', '10.1.4.1', 1, 'Trasferire le persone', 'DIV-OPS', 'CATALOGO'),
    ('20', '10.1.4.2', 2, 'Trasferire materiali e attrezzature', 'DIV-OPS', 'CATALOGO'),
    ('20', '10.1.4.3', 3, 'Garantire accesso e sicurezza delle sedi', 'DIV-OPS', 'CATALOGO'),
    ('21', '12.4.8', 1, 'Fornire consulenza legale', 'DIR-COMPL', 'PROCESSO_INTERO'),
    ('22', '13.8.6', 1, 'Analizzare i dati', 'DIV-IT', 'PROCESSO_INTERO');

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_rtl uuid;
  v_n_ap bigint; v_h_ap text; w_n bigint; w_h text;
  v_n int; v_sent int;
BEGIN
  -- GUARDIA
  IF to_regclass('sys.sys_tenant_processes') IS NULL OR to_regclass('sys.sys_tenant_process_steps') IS NULL
     OR to_regclass('sys.sys_tenant_process_activity_rules') IS NULL THEN
    RAISE EXCEPTION 'riempi-attivita: manca la migrazione 000462';
  END IF;
  SELECT tenant_id INTO v_rtl FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK';
  IF v_rtl IS NULL THEN RAISE EXCEPTION 'riempi-attivita: il tenant RTL_BANK non esiste'; END IF;
  PERFORM set_config('attivita.run_id', v_run::text, true);

  -- MISURA delle richieste prima, senza le due colonne che questa corsa puo' scrivere.
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'approval_request_tenant_process_id' - 'approval_request_tenant_process_step_id')::text, '|' ORDER BY t.approval_request_id)), '')
    INTO v_n_ap, v_h_ap FROM sys.sys_approval_requests t;

  -- 1. I PROCESSI DEL TENANT
  WITH citati AS (
    SELECT DISTINCT o.org_unit_process_tenant_id AS tenant_id, r.blueprint_process_id, r.blueprint_process_code AS codice,
           r.blueprint_process_name AS nome, r.blueprint_process_description AS descrizione, r.blueprint_process_owner_position_code AS owner_code
      FROM sys.sys_organization_unit_processes o
      JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = o.org_unit_process_blueprint_process_id
  ), dal_modello AS (
    SELECT c.tenant_id, c.codice, min(p.position_id::text)::uuid AS position_id, count(p.position_id) AS n
      FROM citati c LEFT JOIN sys.sys_positions p
        ON p.position_tenant_id = c.tenant_id AND p.position_is_active AND p.position_code = c.owner_code
     GROUP BY 1, 2
  ), dalla_partecipazione AS (
    SELECT c.tenant_id, c.codice, min(pp.process_participant_position_id::text)::uuid AS position_id,
           count(DISTINCT pp.process_participant_position_id) AS n
      FROM citati c
      JOIN sys.sys_organization_unit_processes o
        ON o.org_unit_process_tenant_id = c.tenant_id AND o.org_unit_process_blueprint_process_id = c.blueprint_process_id
       AND o.org_unit_process_role = 'OWNER'
      LEFT JOIN sys.sys_process_participants pp
        ON pp.process_participant_org_unit_process_id = o.organization_unit_process_id
       AND pp.process_participant_role = 'OWNER' AND pp.process_participant_is_active
       AND pp.process_participant_position_id IS NOT NULL
     GROUP BY 1, 2
  ), nuovi AS (
    INSERT INTO sys.sys_tenant_processes (tenant_process_tenant_id, tenant_process_code, tenant_process_name, tenant_process_description,
                                          tenant_process_owner_position_id, tenant_process_source_blueprint_process_id, tenant_process_metadata)
    SELECT c.tenant_id, c.codice, c.nome, c.descrizione,
           CASE WHEN m.n = 1 THEN m.position_id WHEN pa.n = 1 THEN pa.position_id END,
           c.blueprint_process_id,
           jsonb_build_object('adr', 'ADR-0049', 'owner_da', CASE WHEN m.n = 1 THEN 'modello' WHEN pa.n = 1 THEN 'partecipazione OWNER' ELSE 'nessuno' END)
      FROM citati c
      LEFT JOIN dal_modello m ON m.tenant_id = c.tenant_id AND m.codice = c.codice
      LEFT JOIN dalla_partecipazione pa ON pa.tenant_id = c.tenant_id AND pa.codice = c.codice
    ON CONFLICT (tenant_process_tenant_id, tenant_process_code) DO NOTHING
    RETURNING tenant_process_id, tenant_process_tenant_id, tenant_process_code, tenant_process_owner_position_id
  ), giornale AS (
    INSERT INTO staging.attivita_processi_undo (run_id, tabella, riga_id, azione)
    SELECT v_run, 'sys_tenant_processes', tenant_process_id, 'CREA' FROM nuovi
    RETURNING 1
  )
  INSERT INTO staging.attivita_processi_dubbi (tenant_id, oggetto, motivo)
  SELECT n.tenant_process_tenant_id, 'processo ' || n.tenant_process_code,
         'owner non risolto: il codice del modello non indica un solo posto attivo e la riga OWNER non ha una sola partecipazione OWNER attiva'
    FROM nuovi n WHERE n.tenant_process_owner_position_id IS NULL
  ON CONFLICT DO NOTHING;

  WITH c AS (
    UPDATE sys.sys_organization_unit_processes o
       SET org_unit_process_tenant_process_id = tp.tenant_process_id
      FROM sys.sys_tenant_processes tp
      JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = tp.tenant_process_source_blueprint_process_id
     WHERE o.org_unit_process_tenant_process_id IS NULL
       AND tp.tenant_process_tenant_id = o.org_unit_process_tenant_id
       AND tp.tenant_process_source_blueprint_process_id = o.org_unit_process_blueprint_process_id
    RETURNING o.organization_unit_process_id, tp.tenant_process_id
  )
  INSERT INTO staging.attivita_processi_undo (run_id, tabella, riga_id, azione, valore_dopo)
  SELECT v_run, 'sys_organization_unit_processes', organization_unit_process_id, 'COLLEGA', tenant_process_id FROM c;

  -- 2. LE ATTIVITA' DI RTL BANK. Ogni fase deve trovare processo e unita': altrimenti ci si ferma.
  SELECT count(*) INTO v_n FROM fasi_rtl f
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenant_processes tp WHERE tp.tenant_process_tenant_id = v_rtl AND tp.tenant_process_code = f.processo)
      OR NOT EXISTS (SELECT 1 FROM sys.sys_organization_units u WHERE u.organization_unit_tenant_id = v_rtl AND u.organization_unit_code = f.unita);
  IF v_n <> 0 THEN RAISE EXCEPTION 'riempi-attivita: % fasi senza processo o unita'' in RTL Bank', v_n; END IF;

  WITH nuove AS (
    INSERT INTO sys.sys_tenant_process_steps (tenant_process_step_tenant_id, tenant_process_step_process_id, tenant_process_step_code,
                                              tenant_process_step_name, tenant_process_step_ordinal, tenant_process_step_org_unit_id,
                                              tenant_process_step_metadata)
    SELECT v_rtl, tp.tenant_process_id, f.codice, f.nome, f.ordine, u.organization_unit_id,
           jsonb_build_object('fonte', 'heuresys-datastore: APQC PCF Banking 8.0', 'apqc', f.codice, 'fonte_fasi', f.fonte)
      FROM fasi_rtl f
      JOIN sys.sys_tenant_processes tp ON tp.tenant_process_tenant_id = v_rtl AND tp.tenant_process_code = f.processo
      JOIN sys.sys_organization_units u ON u.organization_unit_tenant_id = v_rtl AND u.organization_unit_code = f.unita
    ON CONFLICT (tenant_process_step_process_id, tenant_process_step_code) DO NOTHING
    RETURNING tenant_process_step_id
  )
  INSERT INTO staging.attivita_processi_undo (run_id, tabella, riga_id, azione)
  SELECT v_run, 'sys_tenant_process_steps', tenant_process_step_id, 'CREA' FROM nuove;

  -- 3. LE REGOLE DI RTL BANK
  WITH r(tipo, passo, motivo) AS (VALUES
      ('TIME_OFF_REQUEST', NULL::varchar, 'ferie e permessi: gestione del personale; l''APQC 7.3 non ha una fase per le assenze'),
      ('COMPENSATION_RECOMMENDATION', NULL::varchar, 'adeguamenti retributivi: gestione del personale; l''APQC 7.3 non ha una fase per la retribuzione'),
      ('TRAINING_INITIATIVE', '7.3.4', 'iniziative formative: fase 7.3.4 «Sviluppare e formare i dipendenti»')
  ), nuove AS (
    INSERT INTO sys.sys_tenant_process_activity_rules (tenant_process_activity_rule_tenant_id, tenant_process_activity_rule_resource_type,
                                                       tenant_process_activity_rule_process_id, tenant_process_activity_rule_step_id,
                                                       tenant_process_activity_rule_rationale)
    SELECT v_rtl, r.tipo, tp.tenant_process_id, s.tenant_process_step_id, r.motivo
      FROM r
      JOIN sys.sys_tenant_processes tp ON tp.tenant_process_tenant_id = v_rtl AND tp.tenant_process_code = '17'
      LEFT JOIN sys.sys_tenant_process_steps s ON s.tenant_process_step_process_id = tp.tenant_process_id AND s.tenant_process_step_code = r.passo
    ON CONFLICT (tenant_process_activity_rule_tenant_id, tenant_process_activity_rule_resource_type) DO NOTHING
    RETURNING tenant_process_activity_rule_id
  )
  INSERT INTO staging.attivita_processi_undo (run_id, tabella, riga_id, azione)
  SELECT v_run, 'sys_tenant_process_activity_rules', tenant_process_activity_rule_id, 'CREA' FROM nuove;

  -- 4. LE RICHIESTE: quelle senza processo prendono la regola del loro tenant.
  WITH c AS (
    UPDATE sys.sys_approval_requests a
       SET approval_request_tenant_process_id = r.tenant_process_activity_rule_process_id,
           approval_request_tenant_process_step_id = r.tenant_process_activity_rule_step_id
      FROM sys.sys_tenant_process_activity_rules r
     WHERE a.approval_request_tenant_process_id IS NULL
       AND r.tenant_process_activity_rule_tenant_id = a.approval_request_tenant_id
       AND r.tenant_process_activity_rule_resource_type = a.approval_request_resource_type
    RETURNING a.approval_request_id, a.approval_request_tenant_process_id
  )
  INSERT INTO staging.attivita_processi_undo (run_id, tabella, riga_id, azione, valore_dopo)
  SELECT v_run, 'sys_approval_requests', approval_request_id, 'COLLEGA', approval_request_tenant_process_id FROM c;

  -- POST-CONDIZIONI
  SELECT count(*) INTO v_n FROM sys.sys_organization_unit_processes WHERE org_unit_process_tenant_process_id IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'riempi-attivita: % unita'' di processo senza processo del tenant', v_n; END IF;

  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'approval_request_tenant_process_id' - 'approval_request_tenant_process_step_id')::text, '|' ORDER BY t.approval_request_id)), '')
    INTO w_n, w_h FROM sys.sys_approval_requests t;
  IF w_n <> v_n_ap OR w_h <> v_h_ap THEN RAISE EXCEPTION 'riempi-attivita: le richieste sono cambiate oltre le due colonne nuove'; END IF;

  SELECT (SELECT count(*) FROM sys.v_tenant_processes_cross_tenant) + (SELECT count(*) FROM sys.v_tenant_process_steps_cross_tenant)
       + (SELECT count(*) FROM sys.v_tenant_process_activity_rules_cross_tenant) + (SELECT count(*) FROM sys.v_approval_requests_process_cross_tenant)
       + (SELECT count(*) FROM sys.v_projects_process_cross_tenant) INTO v_sent;
  IF v_sent <> 0 THEN RAISE EXCEPTION 'riempi-attivita: % righe nelle sentinelle cross-tenant', v_sent; END IF;

  RAISE NOTICE 'riempi-attivita: corsa % — processi creati %, unita'' collegate %, attivita'' create %, regole create %, richieste collegate %',
    v_run,
    (SELECT count(*) FROM staging.attivita_processi_undo WHERE run_id = v_run AND tabella = 'sys_tenant_processes'),
    (SELECT count(*) FROM staging.attivita_processi_undo WHERE run_id = v_run AND tabella = 'sys_organization_unit_processes'),
    (SELECT count(*) FROM staging.attivita_processi_undo WHERE run_id = v_run AND tabella = 'sys_tenant_process_steps'),
    (SELECT count(*) FROM staging.attivita_processi_undo WHERE run_id = v_run AND tabella = 'sys_tenant_process_activity_rules'),
    (SELECT count(*) FROM staging.attivita_processi_undo WHERE run_id = v_run AND tabella = 'sys_approval_requests');
END $$;

COMMIT;
