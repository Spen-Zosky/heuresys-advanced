-- @migrate: once
-- ============================================================================================
-- 000511 — L'agente propone le altre cinque faccette dei processi di RTL: finalità, beneficiario,
--          modalità di lavoro, attivazione, standardizzazione. (ADR-0061 D4 e §6, passo 2 del §7:
--          «classificazione dei 21 processi di RTL, mostrata e modificabile da chi ha il potere»)
--
-- IL FATTO. La 000510 ha proposto le due faccette che si calcolano dalle attività (perimetro e
-- tecnologia). Queste cinque chiedono di leggere che cosa fa il processo: l'agente le ha lette dal
-- nome, dalla descrizione e dalle attività di ciascuno dei 42 processi attivi di RTL (21 processi
-- e 21 sottoprocessi), estratti il 2026-11-22 dal database di produzione in sola lettura, e per ogni
-- faccetta ha scelto uno o più valori del vocabolario chiuso della 000507.
--
-- CHE COSA SCRIVE. Solo righe nuove in sys.sys_tenant_process_facets, fonte AGENTE, stato PROPOSTA,
-- per il tenant RTL Bank, e solo sulla faccetta di un processo che NON ha ancora nessun valore: la
-- decisione di una persona non si tocca, nemmeno una proposta già fatta. Il criterio dice il nome
-- del processo e la ragione di ogni valore. Il processo si trova per codice; un codice che sul
-- database non c'è (un database di collaudo senza RTL) non scrive niente.
--
-- PERCHÉ `@migrate: once`. Come la 000510: una proposta rifiutata non deve tornare a ogni deploy.
-- GUARDIA. Il vocabolario della 000507 deve esserci per intero (26 valori), o il file si ferma.
-- POST-CONDIZIONE. Nessuna riga di fonte PERSONA cambia; ogni proposta ha un criterio.
-- ROLLBACK DICHIARATO (elenco esplicito, solo ciò che questo file scrive):
--   DELETE FROM sys.sys_tenant_process_facets
--    WHERE tenant_process_facet_source = 'AGENTE' AND tenant_process_facet_status = 'PROPOSTA'
--      AND tenant_process_facet_criterion LIKE 'Proposta dell''agente (000511)%';
-- ============================================================================================

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM sys.sys_process_facet_values;
  IF v <> 26 THEN RAISE EXCEPTION '000511: il vocabolario delle faccette ha % valori, attesi 26 (000507)', v; END IF;
END $$;

CREATE TEMP TABLE m511_persona ON COMMIT DROP AS
SELECT tenant_process_facet_id, tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_status
  FROM sys.sys_tenant_process_facets WHERE tenant_process_facet_source = 'PERSONA';

CREATE TEMP TABLE m511_ragione (faccetta text, valore text, ragione text, PRIMARY KEY (faccetta, valore)) ON COMMIT DROP;
INSERT INTO m511_ragione VALUES
  ('FINALITA','GOVERNO','decide la direzione della banca o ne controlla andamento e rischi'),
  ('FINALITA','VALORE','produce un servizio o un prodotto per cui il cliente paga'),
  ('FINALITA','SUPPORTO','rende possibile il lavoro degli altri processi'),
  ('BENEFICIARIO','CLIENTE_ESTERNO','il risultato arriva al cliente della banca'),
  ('BENEFICIARIO','CLIENTE_INTERNO','il risultato serve a unità, organi o persone della banca'),
  ('BENEFICIARIO','PARTNER','il risultato riguarda fornitori e partner'),
  ('BENEFICIARIO','AUTORITA','il risultato è dovuto all''autorità di vigilanza o pubblica'),
  ('BENEFICIARIO','ALTRI','il risultato è rivolto ad azionisti e consiglio di amministrazione'),
  ('MODALITA','FLUSSO','le attività hanno un ordine stabilito e ripetibile'),
  ('MODALITA','CASO','chi lavora sceglie i passi secondo la situazione'),
  ('MODALITA','IBRIDA','un percorso stabilito con valutazioni decise caso per caso'),
  ('ATTIVAZIONE','EVENTO','parte quando accade un fatto (un''operazione, un''assunzione, una norma nuova)'),
  ('ATTIVAZIONE','CALENDARIO','si ripete a scadenze stabilite (chiusure, piani, revisioni periodiche)'),
  ('ATTIVAZIONE','RICHIESTA','parte dalla richiesta di un cliente o di un''unità interna'),
  ('ATTIVAZIONE','SOGLIA','parte quando una misura supera un limite (insolvenza, limiti di rischio)'),
  ('STANDARDIZZAZIONE','COMUNE','è uguale in ogni azienda e settore'),
  ('STANDARDIZZAZIONE','PARAMETRIZZABILE','la struttura è comune, cambiano regole e parametri (di vigilanza o del contratto collettivo)'),
  ('STANDARDIZZAZIONE','VARIANTE_SETTORE','la struttura è propria del settore bancario');

CREATE TEMP TABLE m511_proposta (codice text, faccetta text, valore text) ON COMMIT DROP;
INSERT INTO m511_proposta VALUES
  ('00','FINALITA','GOVERNO'),
  ('00','BENEFICIARIO','ALTRI'),
  ('00','BENEFICIARIO','CLIENTE_INTERNO'),
  ('00','MODALITA','CASO'),
  ('00','ATTIVAZIONE','CALENDARIO'),
  ('00','STANDARDIZZAZIONE','COMUNE'),
  ('01','FINALITA','VALORE'),
  ('01','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('01','MODALITA','FLUSSO'),
  ('01','ATTIVAZIONE','RICHIESTA'),
  ('01','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('02','FINALITA','GOVERNO'),
  ('02','BENEFICIARIO','AUTORITA'),
  ('02','MODALITA','IBRIDA'),
  ('02','ATTIVAZIONE','EVENTO'),
  ('02','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('03','FINALITA','VALORE'),
  ('03','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('03','MODALITA','FLUSSO'),
  ('03','ATTIVAZIONE','EVENTO'),
  ('03','ATTIVAZIONE','CALENDARIO'),
  ('03','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('04','FINALITA','VALORE'),
  ('04','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('04','MODALITA','FLUSSO'),
  ('04','ATTIVAZIONE','RICHIESTA'),
  ('04','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('05','FINALITA','VALORE'),
  ('05','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('05','MODALITA','IBRIDA'),
  ('05','ATTIVAZIONE','RICHIESTA'),
  ('05','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('06','FINALITA','VALORE'),
  ('06','BENEFICIARIO','CLIENTE_INTERNO'),
  ('06','MODALITA','CASO'),
  ('06','ATTIVAZIONE','SOGLIA'),
  ('06','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('07','FINALITA','VALORE'),
  ('07','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('07','MODALITA','IBRIDA'),
  ('07','ATTIVAZIONE','CALENDARIO'),
  ('07','ATTIVAZIONE','RICHIESTA'),
  ('07','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('09','FINALITA','GOVERNO'),
  ('09','BENEFICIARIO','CLIENTE_INTERNO'),
  ('09','BENEFICIARIO','AUTORITA'),
  ('09','MODALITA','IBRIDA'),
  ('09','ATTIVAZIONE','CALENDARIO'),
  ('09','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('10','FINALITA','GOVERNO'),
  ('10','BENEFICIARIO','CLIENTE_INTERNO'),
  ('10','BENEFICIARIO','AUTORITA'),
  ('10','MODALITA','IBRIDA'),
  ('10','ATTIVAZIONE','CALENDARIO'),
  ('10','ATTIVAZIONE','SOGLIA'),
  ('10','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('11','FINALITA','GOVERNO'),
  ('11','BENEFICIARIO','AUTORITA'),
  ('11','MODALITA','IBRIDA'),
  ('11','ATTIVAZIONE','CALENDARIO'),
  ('11','ATTIVAZIONE','EVENTO'),
  ('11','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('12','FINALITA','GOVERNO'),
  ('12','BENEFICIARIO','CLIENTE_INTERNO'),
  ('12','BENEFICIARIO','AUTORITA'),
  ('12','MODALITA','CASO'),
  ('12','ATTIVAZIONE','CALENDARIO'),
  ('12','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('13','FINALITA','VALORE'),
  ('13','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('13','MODALITA','IBRIDA'),
  ('13','ATTIVAZIONE','RICHIESTA'),
  ('13','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('14','FINALITA','VALORE'),
  ('14','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('14','MODALITA','CASO'),
  ('14','ATTIVAZIONE','RICHIESTA'),
  ('14','STANDARDIZZAZIONE','COMUNE'),
  ('15','FINALITA','VALORE'),
  ('15','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('15','MODALITA','IBRIDA'),
  ('15','ATTIVAZIONE','CALENDARIO'),
  ('15','STANDARDIZZAZIONE','COMUNE'),
  ('16','FINALITA','SUPPORTO'),
  ('16','BENEFICIARIO','CLIENTE_INTERNO'),
  ('16','MODALITA','IBRIDA'),
  ('16','ATTIVAZIONE','RICHIESTA'),
  ('16','ATTIVAZIONE','EVENTO'),
  ('16','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('17','FINALITA','SUPPORTO'),
  ('17','BENEFICIARIO','CLIENTE_INTERNO'),
  ('17','MODALITA','FLUSSO'),
  ('17','ATTIVAZIONE','EVENTO'),
  ('17','ATTIVAZIONE','CALENDARIO'),
  ('17','STANDARDIZZAZIONE','COMUNE'),
  ('18','FINALITA','SUPPORTO'),
  ('18','BENEFICIARIO','CLIENTE_INTERNO'),
  ('18','BENEFICIARIO','AUTORITA'),
  ('18','MODALITA','FLUSSO'),
  ('18','ATTIVAZIONE','CALENDARIO'),
  ('18','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('19','FINALITA','SUPPORTO'),
  ('19','BENEFICIARIO','CLIENTE_INTERNO'),
  ('19','BENEFICIARIO','PARTNER'),
  ('19','MODALITA','FLUSSO'),
  ('19','ATTIVAZIONE','RICHIESTA'),
  ('19','STANDARDIZZAZIONE','COMUNE'),
  ('20','FINALITA','SUPPORTO'),
  ('20','BENEFICIARIO','CLIENTE_INTERNO'),
  ('20','MODALITA','FLUSSO'),
  ('20','ATTIVAZIONE','RICHIESTA'),
  ('20','STANDARDIZZAZIONE','COMUNE'),
  ('21','FINALITA','SUPPORTO'),
  ('21','BENEFICIARIO','CLIENTE_INTERNO'),
  ('21','MODALITA','CASO'),
  ('21','ATTIVAZIONE','RICHIESTA'),
  ('21','STANDARDIZZAZIONE','COMUNE'),
  ('P01','FINALITA','GOVERNO'),
  ('P01','BENEFICIARIO','ALTRI'),
  ('P01','MODALITA','CASO'),
  ('P01','ATTIVAZIONE','CALENDARIO'),
  ('P01','STANDARDIZZAZIONE','COMUNE'),
  ('P05','FINALITA','GOVERNO'),
  ('P05','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P05','BENEFICIARIO','AUTORITA'),
  ('P05','MODALITA','IBRIDA'),
  ('P05','ATTIVAZIONE','SOGLIA'),
  ('P05','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P06','FINALITA','GOVERNO'),
  ('P06','BENEFICIARIO','ALTRI'),
  ('P06','MODALITA','CASO'),
  ('P06','ATTIVAZIONE','CALENDARIO'),
  ('P06','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P08','FINALITA','GOVERNO'),
  ('P08','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P08','MODALITA','CASO'),
  ('P08','ATTIVAZIONE','CALENDARIO'),
  ('P08','STANDARDIZZAZIONE','COMUNE'),
  ('P09','FINALITA','GOVERNO'),
  ('P09','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P09','MODALITA','CASO'),
  ('P09','ATTIVAZIONE','CALENDARIO'),
  ('P09','STANDARDIZZAZIONE','COMUNE'),
  ('P10','FINALITA','VALORE'),
  ('P10','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P10','MODALITA','IBRIDA'),
  ('P10','ATTIVAZIONE','CALENDARIO'),
  ('P10','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P11','FINALITA','VALORE'),
  ('P11','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P11','MODALITA','IBRIDA'),
  ('P11','ATTIVAZIONE','RICHIESTA'),
  ('P11','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P12','FINALITA','VALORE'),
  ('P12','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P12','MODALITA','FLUSSO'),
  ('P12','ATTIVAZIONE','RICHIESTA'),
  ('P12','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P13','FINALITA','VALORE'),
  ('P13','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P13','MODALITA','FLUSSO'),
  ('P13','ATTIVAZIONE','EVENTO'),
  ('P13','ATTIVAZIONE','CALENDARIO'),
  ('P13','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P14','FINALITA','VALORE'),
  ('P14','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P14','MODALITA','FLUSSO'),
  ('P14','ATTIVAZIONE','RICHIESTA'),
  ('P14','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P15','FINALITA','VALORE'),
  ('P15','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P15','MODALITA','FLUSSO'),
  ('P15','ATTIVAZIONE','CALENDARIO'),
  ('P15','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P16','FINALITA','VALORE'),
  ('P16','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P16','MODALITA','IBRIDA'),
  ('P16','ATTIVAZIONE','RICHIESTA'),
  ('P16','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P19','FINALITA','VALORE'),
  ('P19','BENEFICIARIO','CLIENTE_ESTERNO'),
  ('P19','BENEFICIARIO','AUTORITA'),
  ('P19','MODALITA','CASO'),
  ('P19','ATTIVAZIONE','RICHIESTA'),
  ('P19','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P21','FINALITA','GOVERNO'),
  ('P21','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P21','MODALITA','IBRIDA'),
  ('P21','ATTIVAZIONE','SOGLIA'),
  ('P21','STANDARDIZZAZIONE','VARIANTE_SETTORE'),
  ('P22','FINALITA','SUPPORTO'),
  ('P22','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P22','MODALITA','CASO'),
  ('P22','ATTIVAZIONE','CALENDARIO'),
  ('P22','STANDARDIZZAZIONE','COMUNE'),
  ('P23','FINALITA','SUPPORTO'),
  ('P23','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P23','MODALITA','FLUSSO'),
  ('P23','ATTIVAZIONE','RICHIESTA'),
  ('P23','STANDARDIZZAZIONE','COMUNE'),
  ('P24','FINALITA','SUPPORTO'),
  ('P24','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P24','MODALITA','FLUSSO'),
  ('P24','ATTIVAZIONE','EVENTO'),
  ('P24','ATTIVAZIONE','CALENDARIO'),
  ('P24','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P25','FINALITA','SUPPORTO'),
  ('P25','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P25','MODALITA','IBRIDA'),
  ('P25','ATTIVAZIONE','CALENDARIO'),
  ('P25','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P27','FINALITA','GOVERNO'),
  ('P27','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P27','MODALITA','FLUSSO'),
  ('P27','ATTIVAZIONE','CALENDARIO'),
  ('P27','STANDARDIZZAZIONE','COMUNE'),
  ('P28','FINALITA','SUPPORTO'),
  ('P28','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P28','BENEFICIARIO','AUTORITA'),
  ('P28','MODALITA','FLUSSO'),
  ('P28','ATTIVAZIONE','CALENDARIO'),
  ('P28','STANDARDIZZAZIONE','PARAMETRIZZABILE'),
  ('P30','FINALITA','SUPPORTO'),
  ('P30','BENEFICIARIO','CLIENTE_INTERNO'),
  ('P30','MODALITA','IBRIDA'),
  ('P30','ATTIVAZIONE','EVENTO'),
  ('P30','STANDARDIZZAZIONE','VARIANTE_SETTORE');

WITH pr AS (
  SELECT p.tenant_process_id AS pid, p.tenant_process_tenant_id AS tid, p.tenant_process_name AS nome, q.faccetta, q.valore
    FROM m511_proposta q
    JOIN sys.sys_tenant_processes p
      ON p.tenant_process_code = q.codice
     AND p.tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
     AND p.tenant_process_is_active
),
crit AS (
  SELECT pr.pid, pr.faccetta,
         'Proposta dell''agente (000511) dal nome, dalla descrizione e dalle attività di «' || min(pr.nome) || '»: '
           || string_agg(r.ragione, '; ' ORDER BY v.process_facet_value_ordinal) || '.' AS criterio
    FROM pr
    JOIN m511_ragione r ON r.faccetta = pr.faccetta AND r.valore = pr.valore
    JOIN sys.sys_process_facet_values v ON v.process_facet_value_facet = pr.faccetta AND v.process_facet_value_code = pr.valore
   GROUP BY pr.pid, pr.faccetta
)
INSERT INTO sys.sys_tenant_process_facets
  (tenant_process_facet_tenant_id, tenant_process_facet_process_id, tenant_process_facet_facet,
   tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_source, tenant_process_facet_status)
SELECT pr.tid, pr.pid, pr.faccetta, pr.valore, c.criterio, 'AGENTE', 'PROPOSTA'
  FROM pr JOIN crit c ON c.pid = pr.pid AND c.faccetta = pr.faccetta
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenant_process_facets f
                    WHERE f.tenant_process_facet_process_id = pr.pid AND f.tenant_process_facet_facet = pr.faccetta)
ON CONFLICT DO NOTHING;

DO $$
DECLARE cambiate int; senza_criterio int; senza_ragione int;
BEGIN
  SELECT count(*) INTO senza_ragione FROM m511_proposta q
    LEFT JOIN m511_ragione r ON r.faccetta = q.faccetta AND r.valore = q.valore WHERE r.ragione IS NULL;
  SELECT count(*) INTO cambiate FROM m511_persona m
    LEFT JOIN sys.sys_tenant_process_facets f ON f.tenant_process_facet_id = m.tenant_process_facet_id
   WHERE f.tenant_process_facet_id IS NULL
      OR (f.tenant_process_facet_value_code, f.tenant_process_facet_criterion, f.tenant_process_facet_status, f.tenant_process_facet_source)
         IS DISTINCT FROM (m.tenant_process_facet_value_code, m.tenant_process_facet_criterion, m.tenant_process_facet_status, 'PERSONA');
  SELECT count(*) INTO senza_criterio FROM sys.sys_tenant_process_facets
   WHERE tenant_process_facet_source = 'AGENTE' AND length(trim(tenant_process_facet_criterion)) = 0;
  IF senza_ragione <> 0 OR cambiate <> 0 OR senza_criterio <> 0 THEN
    RAISE EXCEPTION '000511: valori senza ragione=%, decisioni di persone cambiate=%, proposte senza criterio=%',
      senza_ragione, cambiate, senza_criterio;
  END IF;
END $$;
