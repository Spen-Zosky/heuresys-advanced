-- Blocco A / titoli e riporti (decisioni 1, 5, 7). Idempotente. Giornale: staging.rtl_allinea_org_undo (stesso schema di A2).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE pers ON COMMIT DROP AS
SELECT u.user_last_name || ', ' || u.user_first_name AS persona, a.user_position_assignment_position_id AS posto
FROM sys.sys_users u JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id
 AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
WHERE u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
CREATE TEMP TABLE tit(persona text, titolo text) ON COMMIT DROP;
INSERT INTO tit VALUES ('Martino, Andrea','Responsabile Compliance e Protezione Dati'),
 ('Gallo, Pietro','Responsabile Sviluppo Applicativi Core Banking'),('Costa, Alice','Responsabile Infrastrutture e Sicurezza IT'),
 ('De Rosa, Federica','Direttore Finanza e Tesoreria'),('Serra, Claudia','Responsabile Istruttoria Fidi'),
 ('Caputo, Paolo','Direttore Crediti'),('Cattaneo, Benedetta','Responsabile Tesoreria');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM tit WHERE persona NOT IN (SELECT persona FROM pers);
  IF n>0 THEN RAISE EXCEPTION 'A/titoli: % persone senza posto attivo', n; END IF; END $$;
CREATE TEMP TABLE it(persona text) ON COMMIT DROP;
INSERT INTO it VALUES ('Greco, Sara'),('Mariani, Luca'),('Zanetti, Chiara'),('Rinaldi, Stefano'),('Gatti, Pietro');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p
 WHERE p.position_id IN (SELECT posto FROM pers WHERE persona IN (SELECT persona FROM tit UNION SELECT persona FROM it))
ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_title=t.titolo FROM tit t JOIN pers s ON s.persona=t.persona WHERE p.position_id=s.posto AND p.position_title<>t.titolo;
UPDATE sys.sys_positions p SET position_reports_to_position_id=(SELECT position_id FROM sys.sys_positions WHERE position_code='POS-00000431')
 FROM it JOIN pers s ON s.persona=it.persona WHERE p.position_id=s.posto;
COMMIT;
SELECT 'A/titoli ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo) nel_giornale;
