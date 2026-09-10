-- 000401 — I 73 contenuti KPI del modello bancario entrano nella catena (C2).
--
-- IL FATTO, misurato il 2026-09-10. `sys.sys_blueprint_content_kpis` ha 73 righe in
-- produzione, tutte legate all'unica versione pubblicata del modello della banca. **Nessun
-- file del repository le scrive**: cercato su tutti i `.sql` e tutti i `.ts` del progetto,
-- non esiste un solo `INSERT` verso quella tabella. Le tre migrazioni che la nominano
-- (`000327`, `000328`, `000335`) creano la STRUTTURA; il modulo `research` la scrive a
-- runtime; le prove la leggono. Le 73 righe sono entrate da uno SCRIPT del bundle Cowork
-- (B30, 2026-09-09), non dalla catena.
--
-- PERCHE' CONTA. Un ambiente ricostruito dalla catena non le ha, quindi **ogni prova che gira
-- su un ambiente pulito misura un prodotto diverso dalla produzione**. E' la stessa famiglia
-- di difetti che in questa sessione ha gia' morso tre volte: i 34 KPI senza nome inglese che
-- bloccavano la catena in produzione mentre la CI era verde; le 73 righe di
-- `sys_process_kpi_templates` che rendevano rossi due test solo fuori dalla CI; e le
-- migrazioni che il clone del gemello non aveva. Ogni volta la causa e' la stessa: dato
-- entrato da uno script invece che dalla catena.
--
-- I CONTENUTI SONO PRESI DALLA PRODUZIONE AL MOMENTO DELLA SCRITTURA (2026-09-10), estratti
-- con `format(%L)` e non ricopiati a mano: un elenco battuto a tastiera avrebbe introdotto
-- esattamente le differenze che questa voce esiste per togliere.
--
-- LA GUARDIA CONFRONTA PER CODICE, NON PER CONTEGGIO. Un numero uguale con contenuti diversi
-- e' il difetto che questa voce chiude, e una guardia che contasse soltanto non lo vedrebbe.
--
-- IDEMPOTENTE: `ON CONFLICT (versione, codice) DO NOTHING`. NESSUNA CANCELLAZIONE, e nessun
-- `UPDATE`: dove una riga esiste gia' — cioe' in produzione — questo file non la tocca.
-- Per tornare indietro: togliere il file. La catena si ri-applica per intero (ADR-0035).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _kpi_attesi (
  codice text, nome text, nome_en text, unita text, verso text, meta jsonb
) ON COMMIT DROP;

INSERT INTO _kpi_attesi (codice, nome, nome_en, unita, verso, meta) VALUES
  ('BP-001-KPI-01', 'Tempo medio di erogazione', 'Average disbursement time', 'giorni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "05", "caricato_il": "2026-09-09", "riferimento": "15"}'::jsonb),
  ('BP-001-KPI-02', 'Tasso di default', 'Default rate', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "05", "caricato_il": "2026-09-09", "riferimento": "2.5"}'::jsonb),
  ('BP-001-KPI-03', 'Rapporto crediti deteriorati', 'NPL ratio', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "05", "caricato_il": "2026-09-09", "riferimento": "4.0"}'::jsonb),
  ('BP-001-KPI-04', 'Volume erogato', 'Disbursed volume', 'EUR milioni', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "05", "caricato_il": "2026-09-09", "riferimento": "50"}'::jsonb),
  ('BP-002-KPI-01', 'Tempo di elaborazione', 'Processing time', 'ore', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "04", "caricato_il": "2026-09-09", "riferimento": "4"}'::jsonb),
  ('BP-002-KPI-02', 'Tasso di errore', 'Error rate', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "04", "caricato_il": "2026-09-09", "riferimento": "0.5"}'::jsonb),
  ('BP-002-KPI-03', 'Volume transazioni', 'Transaction volume', 'numero/mese', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "04", "caricato_il": "2026-09-09", "riferimento": "50000"}'::jsonb),
  ('BP-003-KPI-01', 'Segnalazioni di operazioni sospette', 'Suspicious transaction reports', 'numero/trimestre', 'TARGET_RANGE', '{"origine": "ESISTENTE", "processo": "11", "caricato_il": "2026-09-09", "riferimento": "10"}'::jsonb),
  ('BP-003-KPI-02', 'Tempo di risposta alle richieste di audit', 'Audit request response time', 'giorni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "11", "caricato_il": "2026-09-09", "riferimento": "5"}'::jsonb),
  ('BP-003-KPI-03', 'Grado di conformita', 'Compliance rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "11", "caricato_il": "2026-09-09", "riferimento": "98"}'::jsonb),
  ('BP-003-KPI-04', 'Formazione obbligatoria completata', 'Mandatory training completion', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "11", "caricato_il": "2026-09-09", "riferimento": "95"}'::jsonb),
  ('BP-004-KPI-01', 'Tempo di copertura di una posizione', 'Time to hire', 'giorni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "17", "caricato_il": "2026-09-09", "riferimento": "30"}'::jsonb),
  ('BP-004-KPI-02', 'Tasso di permanenza', 'Retention rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "17", "caricato_il": "2026-09-09", "riferimento": "90"}'::jsonb),
  ('BP-004-KPI-03', 'Indice di coinvolgimento', 'Engagement score', 'punteggio 1-10', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "17", "caricato_il": "2026-09-09", "riferimento": "7.5"}'::jsonb),
  ('BP-005-KPI-01', 'Giorni per la chiusura contabile', 'Financial close days', 'giorni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "18", "caricato_il": "2026-09-09", "riferimento": "10"}'::jsonb),
  ('BP-005-KPI-02', 'Accuratezza delle scritture', 'Accounting accuracy', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "18", "caricato_il": "2026-09-09", "riferimento": "99.5"}'::jsonb),
  ('BP-005-KPI-03', 'Costo per transazione', 'Cost per transaction', 'EUR', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "18", "caricato_il": "2026-09-09", "riferimento": "2.50"}'::jsonb),
  ('BP-006-KPI-01', 'Valore a rischio', 'Value at Risk', 'EUR milioni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "10", "caricato_il": "2026-09-09", "riferimento": "5"}'::jsonb),
  ('BP-006-KPI-02', 'Perdita attesa', 'Expected Loss', 'EUR milioni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "10", "caricato_il": "2026-09-09", "riferimento": "2"}'::jsonb),
  ('BP-006-KPI-03', 'Attivi ponderati per il rischio', 'Risk-weighted assets', 'EUR milioni', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "10", "caricato_il": "2026-09-09", "riferimento": "500"}'::jsonb),
  ('BP-006-KPI-04', 'Copertura delle prove di stress', 'Stress test coverage', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "10", "caricato_il": "2026-09-09", "riferimento": "100"}'::jsonb),
  ('BP-007-KPI-01', 'Crescita delle masse gestite', 'AUM growth', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "07", "caricato_il": "2026-09-09", "riferimento": "10"}'::jsonb),
  ('BP-007-KPI-02', 'Soddisfazione del cliente', 'Client satisfaction', 'punteggio 1-10', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "07", "caricato_il": "2026-09-09", "riferimento": "8.0"}'::jsonb),
  ('BP-007-KPI-03', 'Ricavo per consulente', 'Revenue per advisor', 'EUR migliaia', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "07", "caricato_il": "2026-09-09", "riferimento": "200"}'::jsonb),
  ('BP-008-KPI-01', 'Disponibilita dei sistemi', 'System uptime', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "16", "caricato_il": "2026-09-09", "riferimento": "99.9"}'::jsonb),
  ('BP-008-KPI-02', 'Tempo medio di ripristino', 'Mean time to resolve', 'ore', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "16", "caricato_il": "2026-09-09", "riferimento": "4"}'::jsonb),
  ('BP-008-KPI-03', 'Rilasci andati a buon fine', 'Change success rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "16", "caricato_il": "2026-09-09", "riferimento": "95"}'::jsonb),
  ('BP-009-KPI-01', 'Tempo di verifica KYC', 'KYC verification time', 'days', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "02", "caricato_il": "2026-09-09", "riferimento": "3.00"}'::jsonb),
  ('BP-009-KPI-02', 'Tempo di risoluzione alert AML', 'AML alert resolution time', 'days', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "02", "caricato_il": "2026-09-09", "riferimento": "5.00"}'::jsonb),
  ('BP-009-KPI-03', 'Tasso di attivazione clienti', 'Customer activation rate', '%', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "01", "caricato_il": "2026-09-09", "riferimento": "92.00"}'::jsonb),
  ('BP-009-KPI-04', 'Onboarding NPS', 'Onboarding NPS', 'score', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "01", "caricato_il": "2026-09-09", "riferimento": "45.00"}'::jsonb),
  ('BP-010-KPI-01', 'Indice di copertura della liquidita', 'Liquidity Coverage Ratio', '%', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "09", "caricato_il": "2026-09-09", "riferimento": "130.00"}'::jsonb),
  ('BP-010-KPI-02', 'Indice di finanziamento stabile netto', 'Net Stable Funding Ratio', '%', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "09", "caricato_il": "2026-09-09", "riferimento": "110.00"}'::jsonb),
  ('BP-010-KPI-03', 'Scostamento del risultato sui cambi', 'FX trading P&L variance', 'EUR', 'TARGET_RANGE', '{"origine": "ESISTENTE", "processo": "09", "caricato_il": "2026-09-09", "riferimento": "0.00"}'::jsonb),
  ('BP-010-KPI-04', 'Giorni di riserva di liquidita', 'Liquidity buffer days', 'days', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "09", "caricato_il": "2026-09-09", "riferimento": "60.00"}'::jsonb),
  ('BP-011-KPI-01', 'Rilievi di audit ad alta gravita', 'High-severity audit findings', 'count', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "12", "caricato_il": "2026-09-09", "riferimento": "3.00"}'::jsonb),
  ('BP-011-KPI-02', 'Completamento del piano di audit', 'Audit plan completion rate', '%', 'HIGHER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "12", "caricato_il": "2026-09-09", "riferimento": "95.00"}'::jsonb),
  ('BP-011-KPI-03', 'Tempo di chiusura dei rilievi', 'Findings closure time', 'days', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "12", "caricato_il": "2026-09-09", "riferimento": "90.00"}'::jsonb),
  ('BP-011-KPI-04', 'Rilievi ripetuti', 'Repeat findings rate', '%', 'LOWER_IS_BETTER', '{"origine": "ESISTENTE", "processo": "12", "caricato_il": "2026-09-09", "riferimento": "5.00"}'::jsonb),
  ('BP-012-KPI-01', 'Realizzazione del piano strategico', 'Strategic plan delivery rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "00", "caricato_il": "2026-09-09", "riferimento": "85"}'::jsonb),
  ('BP-012-KPI-02', 'Rapporto costi/ricavi', 'Cost-to-income ratio', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "00", "caricato_il": "2026-09-09", "riferimento": "60"}'::jsonb),
  ('BP-012-KPI-03', 'Delibere del consiglio attuate nei termini', 'Board resolutions executed on time', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "00", "caricato_il": "2026-09-09", "riferimento": "90"}'::jsonb),
  ('BP-013-KPI-01', 'Tempo di apertura di un conto', 'Account opening lead time', 'giorni', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "03", "caricato_il": "2026-09-09", "riferimento": "1"}'::jsonb),
  ('BP-013-KPI-02', 'Pratiche di apertura respinte', 'Rejected account applications', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "03", "caricato_il": "2026-09-09", "riferimento": "5"}'::jsonb),
  ('BP-013-KPI-03', 'Conti dormienti sul totale', 'Dormant accounts share', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "03", "caricato_il": "2026-09-09", "riferimento": "8"}'::jsonb),
  ('BP-014-KPI-01', 'Tasso di recupero sui crediti deteriorati', 'NPL recovery rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "06", "caricato_il": "2026-09-09", "riferimento": "35"}'::jsonb),
  ('BP-014-KPI-02', 'Tempo medio di recupero', 'Average recovery time', 'mesi', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "06", "caricato_il": "2026-09-09", "riferimento": "18"}'::jsonb),
  ('BP-014-KPI-03', 'Posizioni scadute oltre 90 giorni', 'Past-due over 90 days', 'percentuale', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "06", "caricato_il": "2026-09-09", "riferimento": "3"}'::jsonb),
  ('BP-014-KPI-04', 'Grado di copertura degli accantonamenti', 'Provision coverage ratio', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "06", "caricato_il": "2026-09-09", "riferimento": "55"}'::jsonb),
  ('BP-015-KPI-01', 'Quota di prodotti collocati con profilo adeguato', 'Suitability-compliant placements', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "08", "caricato_il": "2026-09-09", "riferimento": "99"}'::jsonb),
  ('BP-015-KPI-02', 'Raccolta netta retail', 'Retail net inflows', 'EUR milioni', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "08", "caricato_il": "2026-09-09", "riferimento": "25"}'::jsonb),
  ('BP-015-KPI-03', 'Reclami su prodotti di investimento', 'Investment product complaints', 'numero/trimestre', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "08", "caricato_il": "2026-09-09", "riferimento": "5"}'::jsonb),
  ('BP-016-KPI-01', 'Tempo medio di attesa allo sportello', 'Average branch waiting time', 'minuti', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "13", "caricato_il": "2026-09-09", "riferimento": "8"}'::jsonb),
  ('BP-016-KPI-02', 'Differenze di cassa', 'Cash discrepancies', 'numero/mese', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "13", "caricato_il": "2026-09-09", "riferimento": "1"}'::jsonb),
  ('BP-016-KPI-03', 'Operazioni allo sportello per addetto', 'Counter transactions per teller', 'numero/giorno', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "13", "caricato_il": "2026-09-09", "riferimento": "60"}'::jsonb),
  ('BP-017-KPI-01', 'Reclami risolti al primo contatto', 'First-contact complaint resolution', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "14", "caricato_il": "2026-09-09", "riferimento": "75"}'::jsonb),
  ('BP-017-KPI-02', 'Tempo medio di risposta', 'Average response time', 'ore', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "14", "caricato_il": "2026-09-09", "riferimento": "4"}'::jsonb),
  ('BP-017-KPI-03', 'Indice di raccomandazione', 'Net Promoter Score', 'punteggio', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "14", "caricato_il": "2026-09-09", "riferimento": "40"}'::jsonb),
  ('BP-018-KPI-01', 'Costo di acquisizione per cliente', 'Customer acquisition cost', 'EUR', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "15", "caricato_il": "2026-09-09", "riferimento": "150"}'::jsonb),
  ('BP-018-KPI-02', 'Tasso di conversione delle campagne', 'Campaign conversion rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "15", "caricato_il": "2026-09-09", "riferimento": "3"}'::jsonb),
  ('BP-018-KPI-03', 'Notorieta di marca', 'Brand awareness', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "15", "caricato_il": "2026-09-09", "riferimento": "35"}'::jsonb),
  ('BP-019-KPI-01', 'Risparmio ottenuto sugli acquisti', 'Procurement savings', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "19", "caricato_il": "2026-09-09", "riferimento": "7"}'::jsonb),
  ('BP-019-KPI-02', 'Fornitori critici con valutazione aggiornata', 'Critical vendors with current assessment', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "19", "caricato_il": "2026-09-09", "riferimento": "100"}'::jsonb),
  ('BP-019-KPI-03', 'Tempo del ciclo di acquisto', 'Purchase cycle time', 'giorni', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "19", "caricato_il": "2026-09-09", "riferimento": "20"}'::jsonb),
  ('BP-020-KPI-01', 'Costo per postazione', 'Cost per workstation', 'EUR/anno', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "20", "caricato_il": "2026-09-09", "riferimento": "3500"}'::jsonb),
  ('BP-020-KPI-02', 'Consumo energetico per metro quadro', 'Energy use per square metre', 'kWh/mq', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "20", "caricato_il": "2026-09-09", "riferimento": "120"}'::jsonb),
  ('BP-020-KPI-03', 'Occupazione degli spazi', 'Space utilisation', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "20", "caricato_il": "2026-09-09", "riferimento": "75"}'::jsonb),
  ('BP-021-KPI-01', 'Contenziosi aperti', 'Open litigation cases', 'numero', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "21", "caricato_il": "2026-09-09", "riferimento": "10"}'::jsonb),
  ('BP-021-KPI-02', 'Esito favorevole nei contenziosi chiusi', 'Favourable outcome rate', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "21", "caricato_il": "2026-09-09", "riferimento": "70"}'::jsonb),
  ('BP-021-KPI-03', 'Tempo di revisione contrattuale', 'Contract review turnaround', 'giorni', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "21", "caricato_il": "2026-09-09", "riferimento": "5"}'::jsonb),
  ('BP-022-KPI-01', 'Qualita dei dati sui domini critici', 'Critical data quality score', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "22", "caricato_il": "2026-09-09", "riferimento": "95"}'::jsonb),
  ('BP-022-KPI-02', 'Segnalazioni regolamentari consegnate nei termini', 'Regulatory reports delivered on time', 'percentuale', 'HIGHER_IS_BETTER', '{"origine": "NUOVO", "processo": "22", "caricato_il": "2026-09-09", "riferimento": "100"}'::jsonb),
  ('BP-022-KPI-03', 'Tempo di evasione di una richiesta dati', 'Data request turnaround', 'giorni', 'LOWER_IS_BETTER', '{"origine": "NUOVO", "processo": "22", "caricato_il": "2026-09-09", "riferimento": "3"}'::jsonb);

-- La versione di destinazione si RISOLVE, non si scrive: un uuid cablato e' vero il giorno in
-- cui lo scrivi e falso al primo ambiente ricostruito.
CREATE TEMP TABLE _versione_banca ON COMMIT DROP AS
SELECT vv.blueprint_variant_version_id AS id
  FROM sys.sys_blueprint_variant_versions vv
  JOIN sys.sys_blueprint_variants v
    ON v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
 WHERE v.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'
   AND vv.blueprint_variant_version_number = 1;

-- ── LA GUARDIA, ri-verificata al momento dell'esecuzione ────────────────────────────────
DO $guardia$
DECLARE n_versione bigint; n_attesi bigint;
BEGIN
  SELECT count(*) INTO n_versione FROM _versione_banca;
  IF n_versione <> 1 THEN
    RAISE EXCEPTION '000401 guardia: risolte % versioni del modello bancario, ne era attesa 1',
      n_versione;
  END IF;
  SELECT count(*) INTO n_attesi FROM _kpi_attesi;
  IF n_attesi <> 73 THEN
    RAISE EXCEPTION '000401 guardia: l''elenco porta % contenuti invece di 73', n_attesi;
  END IF;
END
$guardia$;

INSERT INTO sys.sys_blueprint_content_kpis
  (blueprint_content_kpi_version_id, blueprint_content_kpi_code, blueprint_content_kpi_name,
   blueprint_content_kpi_name_en, blueprint_content_kpi_unit, blueprint_content_kpi_direction,
   blueprint_content_kpi_metadata)
SELECT (SELECT id FROM _versione_banca), k.codice, k.nome, k.nome_en, k.unita, k.verso, k.meta
  FROM _kpi_attesi k
ON CONFLICT (blueprint_content_kpi_version_id, blueprint_content_kpi_code) DO NOTHING;

-- ── LE POST-CONDIZIONI — per CODICE, non per conteggio ──────────────────────────────────
DO $post$
DECLARE v_ver uuid; n_mancanti bigint; n_intrusi bigint; n_diversi bigint; n_tot bigint;
BEGIN
  SELECT id INTO v_ver FROM _versione_banca;

  -- (a) nessun codice atteso manca
  SELECT count(*) INTO n_mancanti FROM _kpi_attesi k
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_blueprint_content_kpis c
                      WHERE c.blueprint_content_kpi_version_id = v_ver
                        AND c.blueprint_content_kpi_code = k.codice);
  IF n_mancanti <> 0 THEN
    RAISE EXCEPTION '000401: % contenuti attesi non sono nella tabella', n_mancanti;
  END IF;

  -- (b) nessun codice in piu' su quella versione
  SELECT count(*) INTO n_intrusi FROM sys.sys_blueprint_content_kpis c
   WHERE c.blueprint_content_kpi_version_id = v_ver
     AND NOT EXISTS (SELECT 1 FROM _kpi_attesi k WHERE k.codice = c.blueprint_content_kpi_code);
  IF n_intrusi <> 0 THEN
    RAISE EXCEPTION '000401: % contenuti presenti che l''elenco non prevede', n_intrusi;
  END IF;

  -- (c) IL PUNTO DI QUESTA VOCE: stesso codice, stesso CONTENUTO. Un conteggio uguale con
  --     contenuti diversi e' esattamente il difetto che si sta chiudendo, e (a)+(b) da soli
  --     non lo vedrebbero.
  SELECT count(*) INTO n_diversi
    FROM sys.sys_blueprint_content_kpis c
    JOIN _kpi_attesi k ON k.codice = c.blueprint_content_kpi_code
   WHERE c.blueprint_content_kpi_version_id = v_ver
     AND (c.blueprint_content_kpi_name      IS DISTINCT FROM k.nome
       OR c.blueprint_content_kpi_name_en   IS DISTINCT FROM k.nome_en
       OR c.blueprint_content_kpi_unit      IS DISTINCT FROM k.unita
       OR c.blueprint_content_kpi_direction IS DISTINCT FROM k.verso);
  IF n_diversi <> 0 THEN
    RAISE EXCEPTION '000401: % contenuti hanno lo stesso codice e un contenuto diverso da '
      'quello della produzione — e'' il difetto che questo file esiste per chiudere', n_diversi;
  END IF;

  SELECT count(*) INTO n_tot FROM sys.sys_blueprint_content_kpis
   WHERE blueprint_content_kpi_version_id = v_ver;
  RAISE NOTICE '000401 ok — % contenuti KPI sul modello bancario, confrontati per codice e '
    'per contenuto, 0 mancanti, 0 intrusi, 0 diversi.', n_tot;
END
$post$;

COMMIT;
