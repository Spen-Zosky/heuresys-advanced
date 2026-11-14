-- Decisioni 1 e 4 (mandato RTL 2026-11-11, estensione del coordinatore): titolo e mansione delle 13 persone senza posto della corsa, secondo la corsa.
-- Rinaldi M. resta Analista Bilancio e Segnalazioni (decisione 1). Mansioni: quelle del catalogo (il profilo della banca, 000398, e' dichiarato e non ammette mansioni nuove). Idempotente.
-- Giornale: staging.rtl_allinea_org_undo (posto prima, contratto prima).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE t13(persona text, titolo text, codice_ruolo text) ON COMMIT DROP;
INSERT INTO t13 VALUES
 ('Mancini, Giorgio','Addetto Chiusura Conti','RTL-ROLE-SPECIALISTA-BACK-OFFICE'),('Villa, Paolo','Addetto Chiusura Conti','RTL-ROLE-SPECIALISTA-BACK-OFFICE'),
 ('Fiore, Gabriele','Consulente di Filiale','RTL-ROLE-CONSULENTE-CLIENTELA'),('Greco, Filippo','Consulente di Filiale','RTL-ROLE-CONSULENTE-CLIENTELA'),
 ('Monti, Michele','Operatore di Sportello e Cassa','RTL-ROLE-CASSIERE'),('Testa, Nicola','Operatore di Sportello e Cassa','RTL-ROLE-CASSIERE'),
 ('Fontana, Gabriele','Analista Crediti','RTL-ROLE-ANALISTA-CREDITI'),('Ricci, Giorgio','Analista Crediti','RTL-ROLE-ANALISTA-CREDITI'),
 ('Sanna, Pietro','Specialista Sviluppo Vendite','RTL-ROLE-SPECIALISTA-SVILUPPO-COMM'),('Santoro, Noemi','Specialista Sviluppo Vendite','RTL-ROLE-SPECIALISTA-SVILUPPO-COMM'),
 ('Fontana, Diego','Auditor','RTL-AUDIT'),('Greco, Andrea','Addetto Customer Care e Qualità','RTL-ROLE-SPECIALISTA-SUPPORTO-RETE');
CREATE TEMP TABLE chi ON COMMIT DROP AS
SELECT u.user_id, a.user_position_assignment_position_id pos, t.titolo, r.job_role_id
FROM t13 t JOIN sys.sys_users u ON u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_last_name||', '||u.user_first_name=t.persona
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
JOIN sys.sys_job_roles r ON r.job_role_code=t.codice_ruolo AND (r.job_role_tenant_id IS NULL OR r.job_role_tenant_id=u.user_tenant_id);
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM chi; IF n<>12 THEN RAISE EXCEPTION 'Q: % persone abbinate su 12', n; END IF; END $$;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p WHERE p.position_id IN (SELECT pos FROM chi) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_user_contracts', k.user_contract_id, to_jsonb(k) FROM sys.sys_user_contracts k WHERE k.user_contract_user_id IN (SELECT user_id FROM chi) AND k.user_contract_status='ACTIVE' ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_title=c.titolo, position_job_role_id=c.job_role_id FROM chi c WHERE p.position_id=c.pos AND (p.position_title<>c.titolo OR p.position_job_role_id IS DISTINCT FROM c.job_role_id);
UPDATE sys.sys_user_contracts k SET user_contract_job_title=c.titolo FROM chi c WHERE k.user_contract_user_id=c.user_id AND k.user_contract_status='ACTIVE' AND k.user_contract_job_title IS DISTINCT FROM c.titolo;
COMMIT;
SELECT 'Q ok';
