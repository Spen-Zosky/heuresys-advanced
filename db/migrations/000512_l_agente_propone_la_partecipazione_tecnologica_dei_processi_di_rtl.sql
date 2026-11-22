-- @migrate: once
-- ============================================================================================
-- 000512 — L'agente propone la partecipazione tecnologica dei processi di RTL che non ne hanno una.
--          (ADR-0061 D4 e §6, passo 2 del §7: le sette faccette dei processi di RTL proposte)
--
-- IL FATTO. La 000510 ricavava la partecipazione tecnologica dalla natura del lavoro delle attività
-- (`tenant_process_step_work_nature`). Sulle attività di RTL quel campo è vuoto, quindi la proposta
-- non è nata e la faccetta è rimasta «Non ancora classificato» su tutti i processi (verificato dal
-- vivo il 2026-11-22 su «Erogazione del credito» e «Acquisizione e onboarding clienti»). Qui l'agente
-- la propone come la 000511 propone le altre cinque: dal nome, dalla descrizione e dalle attività di
-- ciascuno dei 42 processi attivi di RTL, con un solo valore del vocabolario chiuso della 000507.
--
-- CHE COSA SCRIVE. Solo righe nuove in sys.sys_tenant_process_facets, fonte AGENTE, stato PROPOSTA,
-- faccetta TECNOLOGIA, per il tenant RTL Bank, e solo dove il processo non ha ancora nessun valore
-- di quella faccetta: una decisione di una persona non si tocca, e nemmeno una proposta già fatta
-- dalla 000510 dove la natura del lavoro c'era. Un codice che sul database non c'è non scrive niente.
--
-- PERCHÉ `@migrate: once`. Come la 000510 e la 000511: una proposta rifiutata non torna a ogni deploy.
-- GUARDIA. Il vocabolario della 000507 deve avere i suoi 4 valori di TECNOLOGIA, o il file si ferma.
-- POST-CONDIZIONE. Nessuna riga di fonte PERSONA cambia; ogni proposta ha un criterio; ogni valore
-- proposto ha la sua ragione.
-- ROLLBACK DICHIARATO (elenco esplicito, solo ciò che questo file scrive):
--   DELETE FROM sys.sys_tenant_process_facets
--    WHERE tenant_process_facet_source = 'AGENTE' AND tenant_process_facet_status = 'PROPOSTA'
--      AND tenant_process_facet_criterion LIKE 'Proposta dell''agente (000512)%';
-- ============================================================================================

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM sys.sys_process_facet_values WHERE process_facet_value_facet = 'TECNOLOGIA';
  IF v <> 4 THEN RAISE EXCEPTION '000512: il vocabolario della partecipazione tecnologica ha % valori, attesi 4 (000507)', v; END IF;
END $$;

CREATE TEMP TABLE m512_persona ON COMMIT DROP AS
SELECT tenant_process_facet_id, tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_status
  FROM sys.sys_tenant_process_facets WHERE tenant_process_facet_source = 'PERSONA';

CREATE TEMP TABLE m512_ragione (valore text PRIMARY KEY, ragione text NOT NULL) ON COMMIT DROP;
INSERT INTO m512_ragione VALUES
  ('MANUALE','il lavoro è giudizio e confronto fra persone, senza un sistema che ne guidi i passi'),
  ('ASSISTITA','le persone decidono lavorando con sistemi che preparano dati, calcoli o pratiche'),
  ('AUTOMATIZZATA','il lavoro lo svolge il sistema informativo della banca e le persone decidono le eccezioni'),
  ('MISTA','alcune attività le svolge il sistema da solo, altre restano a persone che decidono caso per caso');

CREATE TEMP TABLE m512_proposta (codice text PRIMARY KEY, valore text NOT NULL) ON COMMIT DROP;
INSERT INTO m512_proposta VALUES
  ('00','MANUALE'),
  ('01','MISTA'),
  ('02','MISTA'),
  ('03','AUTOMATIZZATA'),
  ('04','AUTOMATIZZATA'),
  ('05','ASSISTITA'),
  ('06','MISTA'),
  ('07','MISTA'),
  ('09','ASSISTITA'),
  ('10','ASSISTITA'),
  ('11','ASSISTITA'),
  ('12','MANUALE'),
  ('13','ASSISTITA'),
  ('14','ASSISTITA'),
  ('15','ASSISTITA'),
  ('16','MISTA'),
  ('17','ASSISTITA'),
  ('18','MISTA'),
  ('19','ASSISTITA'),
  ('20','MANUALE'),
  ('21','MANUALE'),
  ('P01','MANUALE'),
  ('P05','ASSISTITA'),
  ('P06','MANUALE'),
  ('P08','ASSISTITA'),
  ('P09','MANUALE'),
  ('P10','ASSISTITA'),
  ('P11','ASSISTITA'),
  ('P12','MISTA'),
  ('P13','AUTOMATIZZATA'),
  ('P14','MISTA'),
  ('P15','MISTA'),
  ('P16','ASSISTITA'),
  ('P19','ASSISTITA'),
  ('P21','MISTA'),
  ('P22','MANUALE'),
  ('P23','ASSISTITA'),
  ('P24','ASSISTITA'),
  ('P25','ASSISTITA'),
  ('P27','ASSISTITA'),
  ('P28','AUTOMATIZZATA'),
  ('P30','MISTA');

INSERT INTO sys.sys_tenant_process_facets
  (tenant_process_facet_tenant_id, tenant_process_facet_process_id, tenant_process_facet_facet,
   tenant_process_facet_value_code, tenant_process_facet_criterion, tenant_process_facet_source, tenant_process_facet_status)
SELECT p.tenant_process_tenant_id, p.tenant_process_id, 'TECNOLOGIA', q.valore,
       'Proposta dell''agente (000512) dal nome, dalla descrizione e dalle attività di «' || p.tenant_process_name
         || '»: ' || r.ragione || '.',
       'AGENTE', 'PROPOSTA'
  FROM m512_proposta q
  JOIN m512_ragione r ON r.valore = q.valore
  JOIN sys.sys_tenant_processes p
    ON p.tenant_process_code = q.codice
   AND p.tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
   AND p.tenant_process_is_active
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenant_process_facets f
                    WHERE f.tenant_process_facet_process_id = p.tenant_process_id
                      AND f.tenant_process_facet_facet = 'TECNOLOGIA')
ON CONFLICT DO NOTHING;

DO $$
DECLARE cambiate int; senza_criterio int; senza_ragione int;
BEGIN
  SELECT count(*) INTO senza_ragione FROM m512_proposta q
    LEFT JOIN m512_ragione r ON r.valore = q.valore WHERE r.ragione IS NULL;
  SELECT count(*) INTO cambiate FROM m512_persona m
    LEFT JOIN sys.sys_tenant_process_facets f ON f.tenant_process_facet_id = m.tenant_process_facet_id
   WHERE f.tenant_process_facet_id IS NULL
      OR (f.tenant_process_facet_value_code, f.tenant_process_facet_criterion, f.tenant_process_facet_status, f.tenant_process_facet_source)
         IS DISTINCT FROM (m.tenant_process_facet_value_code, m.tenant_process_facet_criterion, m.tenant_process_facet_status, 'PERSONA');
  SELECT count(*) INTO senza_criterio FROM sys.sys_tenant_process_facets
   WHERE tenant_process_facet_source = 'AGENTE' AND length(trim(tenant_process_facet_criterion)) = 0;
  IF senza_ragione <> 0 OR cambiate <> 0 OR senza_criterio <> 0 THEN
    RAISE EXCEPTION '000512: valori senza ragione=%, decisioni di persone cambiate=%, proposte senza criterio=%',
      senza_ragione, cambiate, senza_criterio;
  END IF;
END $$;
