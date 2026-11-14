-- Blocco C (mandato RTL 2026-11-11): 21 processi unici. RTL ne aveva 23: 07 Consulenza patrimoniale + 08 Investimenti retail -> «Servizi di investimento» (07);
-- 22 Dati e analytics -> IT e cybersecurity (16). I processi assorbiti restano come non attivi (ritirare non e' cancellare).
-- Responsabili dei processi riallineati ai capi di direzione (12 Audit, 21 Legale, 06 Monitoraggio). Idempotente.
-- Giornale: staging.rtl_allinea_processi_undo (tabella, chiave, riga prima).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_processi_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE pr ON COMMIT DROP AS
SELECT tenant_process_code c, tenant_process_id id FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
CREATE TEMP TABLE acc(da text, a text) ON COMMIT DROP;
INSERT INTO acc VALUES ('08','07'),('22','16');

INSERT INTO staging.rtl_allinea_processi_undo (tabella, chiave, riga)
SELECT 'sys_tenant_processes', p.tenant_process_id, to_jsonb(p) FROM sys.sys_tenant_processes p
 WHERE p.tenant_process_id IN (SELECT id FROM pr WHERE c IN ('07','08','16','22','12','21','06')) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_processi_undo (tabella, chiave, riga)
SELECT 'sys_tenant_process_steps', s.tenant_process_step_id, to_jsonb(s) FROM sys.sys_tenant_process_steps s
 WHERE s.tenant_process_step_process_id IN (SELECT id FROM pr WHERE c IN ('08','22')) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_processi_undo (tabella, chiave, riga)
SELECT 'sys_organization_unit_processes', o.organization_unit_process_id, to_jsonb(o) FROM sys.sys_organization_unit_processes o
 WHERE o.org_unit_process_tenant_process_id IN (SELECT id FROM pr WHERE c IN ('08','22')) ON CONFLICT DO NOTHING;

-- le fasi passano al processo assorbente, dopo le sue (ordinale continuato)
UPDATE sys.sys_tenant_process_steps s SET tenant_process_step_process_id=(SELECT id FROM pr WHERE c=a.a),
       tenant_process_step_ordinal = s.tenant_process_step_ordinal + COALESCE((SELECT max(t.tenant_process_step_ordinal) FROM sys.sys_tenant_process_steps t WHERE t.tenant_process_step_process_id=(SELECT id FROM pr WHERE c=a.a)),0)
FROM acc a WHERE s.tenant_process_step_process_id=(SELECT id FROM pr WHERE c=a.da);
-- tutti i riferimenti ai processi assorbiti passano all'assorbente
UPDATE sys.sys_organization_unit_processes o SET org_unit_process_tenant_process_id=(SELECT id FROM pr WHERE c=a.a)
 FROM acc a WHERE o.org_unit_process_tenant_process_id=(SELECT id FROM pr WHERE c=a.da);
UPDATE sys.sys_approval_requests o SET approval_request_tenant_process_id=(SELECT id FROM pr WHERE c=a.a) FROM acc a WHERE o.approval_request_tenant_process_id=(SELECT id FROM pr WHERE c=a.da);
UPDATE sys.sys_projects o SET project_tenant_process_id=(SELECT id FROM pr WHERE c=a.a) FROM acc a WHERE o.project_tenant_process_id=(SELECT id FROM pr WHERE c=a.da);
UPDATE sys.sys_tenant_process_activity_rules o SET tenant_process_activity_rule_process_id=(SELECT id FROM pr WHERE c=a.a) FROM acc a WHERE o.tenant_process_activity_rule_process_id=(SELECT id FROM pr WHERE c=a.da);
UPDATE sys.sys_tenant_processes SET tenant_process_is_active=false WHERE tenant_process_id IN (SELECT id FROM pr WHERE c IN ('08','22')) AND tenant_process_is_active;
UPDATE sys.sys_tenant_processes SET tenant_process_name='Servizi di investimento' WHERE tenant_process_id=(SELECT id FROM pr WHERE c='07') AND tenant_process_name<>'Servizi di investimento';

-- responsabili
UPDATE sys.sys_tenant_processes p SET tenant_process_owner_position_id=(SELECT position_id FROM sys.sys_positions WHERE position_code='POS-AUDIT-HEAD' AND position_tenant_id=p.tenant_process_tenant_id) WHERE p.tenant_process_id=(SELECT id FROM pr WHERE c='12') AND p.tenant_process_owner_position_id IS DISTINCT FROM (SELECT position_id FROM sys.sys_positions WHERE position_code='POS-AUDIT-HEAD' AND position_tenant_id=p.tenant_process_tenant_id);
UPDATE sys.sys_tenant_processes p SET tenant_process_owner_position_id=(SELECT position_id FROM sys.sys_positions WHERE position_code='POS-CMD-DIR-LEGAL' AND position_tenant_id=p.tenant_process_tenant_id) WHERE p.tenant_process_id=(SELECT id FROM pr WHERE c='21') AND p.tenant_process_owner_position_id IS DISTINCT FROM (SELECT position_id FROM sys.sys_positions WHERE position_code='POS-CMD-DIR-LEGAL' AND position_tenant_id=p.tenant_process_tenant_id);
UPDATE sys.sys_tenant_processes p SET tenant_process_owner_position_id=(SELECT position_id FROM sys.sys_positions WHERE position_code='POS-CMD-DIR-MONIT' AND position_tenant_id=p.tenant_process_tenant_id) WHERE p.tenant_process_id=(SELECT id FROM pr WHERE c='06') AND p.tenant_process_owner_position_id IS DISTINCT FROM (SELECT position_id FROM sys.sys_positions WHERE position_code='POS-CMD-DIR-MONIT' AND position_tenant_id=p.tenant_process_tenant_id);

DO $$ DECLARE a int; b int; BEGIN
  SELECT count(*) INTO a FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_is_active;
  SELECT count(*) INTO b FROM sys.sys_tenant_process_steps s JOIN sys.sys_tenant_processes p ON p.tenant_process_id=s.tenant_process_step_process_id WHERE NOT p.tenant_process_is_active AND p.tenant_process_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  IF a<>21 OR b<>0 THEN RAISE EXCEPTION 'C: processi attivi=% (attesi 21), fasi su processi non attivi=%', a, b; END IF; END $$;
COMMIT;
SELECT 'C ok' esito, (SELECT count(*) FROM sys.sys_tenant_process_steps s JOIN sys.sys_tenant_processes p ON p.tenant_process_id=s.tenant_process_step_process_id WHERE p.tenant_process_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0') fasi_totali;
