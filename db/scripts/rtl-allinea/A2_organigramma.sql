-- Blocco A / organigramma (decisioni 3 e 6, mandato RTL 2026-11-11): niente livello di Area, 10 filiali reali sotto la Divisione Retail,
-- in ogni filiale un Responsabile Sportello e Cassa e un Responsabile Consulenza Clienti e Fidi. Idempotente.
-- Ritirare non e' cancellare: le Aree restano come unita' non attive. I codici dei posti riusati restano (identificatori stabili).
-- Giornale: staging.rtl_allinea_org_undo (stato prima di ogni unita' e posto toccati). Rollback: ripristino dei campi dal jsonb.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));

CREATE TEMP TABLE pers ON COMMIT DROP AS
SELECT u.user_last_name || ', ' || u.user_first_name AS persona, a.user_position_assignment_position_id AS posto
FROM sys.sys_users u JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id
 AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
WHERE u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

-- (filiale, responsabile sportello, responsabile consulenza)
CREATE TEMP TABLE fil(unita text, resp_sport text, resp_cons text) ON COMMIT DROP;
INSERT INTO fil VALUES
 ('FIL-BG-CEN','De Santis, Claudia','Esposito, Matteo'),('FIL-BS-CEN','Gatti, Marta','Cattaneo, Davide'),
 ('FIL-CO-CEN','Colombo, Filippo','Mariani, Daniele'),('FIL-BG-DAL','Esposito, Tommaso','Pagano, Matteo'),
 ('FIL-MI-CEN','Moretti, Alice','Leone, Xenia'),('FIL-MI-PRO','Colombo, Silvia','Ferrara, Paolo'),
 ('FIL-MI-SEM','Deluca, Umberto','Costa, Filippo'),('FIL-MB-MON','Caruso, Martina','Mariani, Elisa'),
 ('FIL-MI-SSG','Fabbri, Giorgio','Marchetti, Noemi'),('FIL-VA-CEN','Caruso, Simone','Romano, Claudia');

CREATE TEMP TABLE un ON COMMIT DROP AS
SELECT organization_unit_code c, organization_unit_id id FROM sys.sys_organization_units WHERE organization_unit_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
CREATE TEMP TABLE po ON COMMIT DROP AS
SELECT position_code c, position_id id FROM sys.sys_positions WHERE position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM (SELECT resp_sport p FROM fil UNION ALL SELECT resp_cons FROM fil) x WHERE p NOT IN (SELECT persona FROM pers);
  IF n > 0 THEN RAISE EXCEPTION 'A/org: % responsabili senza posto attivo', n; END IF; END $$;

-- giornale: unita' e posti che si toccano
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_organization_units', o.organization_unit_id, to_jsonb(o) FROM sys.sys_organization_units o
 WHERE o.organization_unit_id IN (SELECT id FROM un WHERE c IN (SELECT unita FROM fil) OR c IN ('AREA-MI','AREA-BSBG'))
ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p
 WHERE p.position_organization_unit_id IN (SELECT id FROM un WHERE c IN (SELECT unita FROM fil) OR c IN ('AREA-MI','AREA-BSBG'))
    OR p.position_id IN (SELECT posto FROM pers WHERE persona IN ('Pellegrini, Marta','Orlando, Ignazio'))
ON CONFLICT DO NOTHING;

-- 1) le 10 filiali dipendono dalla Divisione Retail; i direttori riportano al Retail Director
UPDATE sys.sys_organization_units f SET organization_unit_parent_id=(SELECT id FROM un WHERE c='DIV-RETAIL')
 WHERE f.organization_unit_id IN (SELECT id FROM un WHERE c IN (SELECT unita FROM fil));
UPDATE sys.sys_positions p SET position_reports_to_position_id=(SELECT id FROM po WHERE c='POS-00000436')
 WHERE p.position_id IN (SELECT id FROM po WHERE c LIKE 'POS-CMD-FIL-%');

-- 2) Pellegrini M.: Responsabile Gestione Cassa e Pagamenti della rete (Direzione Governo e Supporto Rete)
UPDATE sys.sys_positions p SET position_title='Responsabile Gestione Cassa e Pagamenti', position_organization_unit_id=(SELECT id FROM un WHERE c='DIR-RETE'),
       position_reports_to_position_id=(SELECT id FROM po WHERE c='POS-CMD-DIR-RETE')
 WHERE p.position_id=(SELECT posto FROM pers WHERE persona='Pellegrini, Marta');
-- Orlando I.: Specialista Customer Care e Gestione Reclami (il vice direttore non e' un ruolo della corsa)
UPDATE sys.sys_positions p SET position_title='Specialista Customer Care e Gestione Reclami', position_organization_unit_id=(SELECT id FROM un WHERE c='DIR-RETE'),
       position_reports_to_position_id=(SELECT id FROM po WHERE c='POS-CMD-DIR-RETE')
 WHERE p.position_id=(SELECT posto FROM pers WHERE persona='Orlando, Ignazio');

-- 3) responsabili di filiale
UPDATE sys.sys_positions p SET position_title='Responsabile Ufficio Sportello e Cassa', position_organization_unit_id=(SELECT id FROM un WHERE c=f.unita),
       position_reports_to_position_id=(SELECT id FROM po WHERE c='POS-CMD-'||f.unita)
 FROM fil f JOIN pers s ON s.persona=f.resp_sport WHERE p.position_id=s.posto;
UPDATE sys.sys_positions p SET position_title='Responsabile Ufficio Consulenza Clienti e Fidi', position_organization_unit_id=(SELECT id FROM un WHERE c=f.unita),
       position_reports_to_position_id=(SELECT id FROM po WHERE c='POS-CMD-'||f.unita)
 FROM fil f JOIN pers s ON s.persona=f.resp_cons WHERE p.position_id=s.posto;
-- cassieri e consulenti della filiale riportano ai rispettivi responsabili
UPDATE sys.sys_positions p SET position_reports_to_position_id=s.posto
 FROM fil f JOIN pers s ON s.persona=f.resp_sport
 WHERE p.position_organization_unit_id=(SELECT id FROM un WHERE c=f.unita) AND p.position_title='Cassiere' AND p.position_id<>s.posto;
UPDATE sys.sys_positions p SET position_reports_to_position_id=s.posto
 FROM fil f JOIN pers s ON s.persona=f.resp_cons
 WHERE p.position_organization_unit_id=(SELECT id FROM un WHERE c=f.unita) AND p.position_title IN ('Consulente Clientela','Gestore Piccole Imprese') AND p.position_id<>s.posto;

-- 4) le Aree escono dall'organigramma (ritirate, non cancellate)
UPDATE sys.sys_organization_units a SET organization_unit_is_active=false, organization_unit_effective_to=COALESCE(a.organization_unit_effective_to, current_date)
 WHERE a.organization_unit_id IN (SELECT id FROM un WHERE c IN ('AREA-MI','AREA-BSBG')) AND a.organization_unit_is_active;
UPDATE sys.sys_positions p SET position_is_active=false, position_effective_to=COALESCE(p.position_effective_to, current_date)
 WHERE p.position_organization_unit_id IN (SELECT id FROM un WHERE c IN ('AREA-MI','AREA-BSBG')) AND p.position_is_active;

-- post-condizioni
DO $$ DECLARE a int; b int; c int; BEGIN
  SELECT count(*) INTO a FROM sys.sys_organization_units f JOIN sys.sys_organization_units p ON p.organization_unit_id=f.organization_unit_parent_id
   WHERE f.organization_unit_type='BRANCH' AND f.organization_unit_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.organization_unit_code<>'DIV-RETAIL';
  SELECT count(*) INTO b FROM sys.sys_positions p JOIN sys.sys_organization_units u ON u.organization_unit_id=p.position_organization_unit_id
   WHERE u.organization_unit_type='AREA' AND p.position_is_active;
  SELECT count(*) INTO c FROM sys.sys_positions p WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_is_active
   AND p.position_reports_to_position_id IN (SELECT position_id FROM sys.sys_positions WHERE NOT position_is_active);
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'A/org: filiali fuori Retail=%, posti attivi in Area=%', a, b; END IF;
  RAISE NOTICE 'posti attivi che riportano a un posto non attivo: %', c; END $$;
COMMIT;
SELECT 'A/org ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo) nel_giornale,
  (SELECT count(*) FROM sys.sys_organization_units WHERE organization_unit_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND organization_unit_type='AREA' AND organization_unit_is_active) aree_attive;
