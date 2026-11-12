-- I due ruoli di tenant creati da una prima stesura di Q (Addetto Chiusura Conti, Addetto Assistenza Clienti e Qualita') non entrano nel profilo
-- dichiarato della banca (000398) e il catalogo non ammette ruoli di cliente (000397): le 12 persone passano alle mansioni del catalogo e i due ruoli,
-- con le loro traduzioni, si tolgono. Idempotente: dove non esistono non fa niente. Giornale: staging.rtl_allinea_org_undo (righe tolte per intero).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE vecchi ON COMMIT DROP AS
SELECT r.job_role_id id, CASE r.job_role_code WHEN 'RTL-ROLE-ADDETTO-CHIUSURA-CONTI' THEN 'RTL-ROLE-SPECIALISTA-BACK-OFFICE' ELSE 'RTL-ROLE-SPECIALISTA-SUPPORTO-RETE' END nuovo
FROM sys.sys_job_roles r WHERE r.job_role_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND r.job_role_code IN ('RTL-ROLE-ADDETTO-CHIUSURA-CONTI','RTL-ROLE-ADDETTO-CUSTOMER-CARE');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p WHERE p.position_job_role_id IN (SELECT id FROM vecchi) ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_job_role_id=(SELECT j.job_role_id FROM sys.sys_job_roles j WHERE j.job_role_code=v.nuovo AND j.job_role_tenant_id IS NULL) FROM vecchi v WHERE p.position_job_role_id=v.id;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_reference_translations', t.reference_translation_id, to_jsonb(t) FROM sys.sys_reference_translations t WHERE t.entity_table='sys_job_roles' AND t.entity_id IN (SELECT id FROM vecchi) ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_reference_translations WHERE entity_table='sys_job_roles' AND entity_id IN (SELECT id FROM vecchi);
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_job_roles', j.job_role_id, to_jsonb(j) FROM sys.sys_job_roles j WHERE j.job_role_id IN (SELECT id FROM vecchi) ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_job_roles WHERE job_role_id IN (SELECT id FROM vecchi);
COMMIT;
SELECT 'W ok';
