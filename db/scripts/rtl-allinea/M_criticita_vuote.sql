-- Voce 2 / D criticita' (mandato RTL 2026-11-11): i posti senza criticita' (nessun posto della corsa abbinato) la ricevono con la regola bancaria:
-- chi dirige altri posti con livello Dirigente, QD4 o QD3 = HIGH; chi dirige altri posti = MEDIUM; gli altri = LOW. Idempotente.
-- Giornale: staging.rtl_allinea_org_undo (riga del posto prima).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE vuoti ON COMMIT DROP AS
SELECT p.position_id,
  CASE WHEN EXISTS (SELECT 1 FROM sys.sys_positions r WHERE r.position_reports_to_position_id=p.position_id AND r.position_is_active)
        AND COALESCE((SELECT k.user_contract_ccnl_level FROM sys.sys_user_position_assignments a JOIN sys.sys_user_contracts k ON k.user_contract_user_id=a.user_position_assignment_user_id AND k.user_contract_status='ACTIVE'
                       WHERE a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' LIMIT 1),'') IN ('Dirigente','QD4','QD3') THEN 'HIGH'
       WHEN EXISTS (SELECT 1 FROM sys.sys_positions r WHERE r.position_reports_to_position_id=p.position_id AND r.position_is_active) THEN 'MEDIUM'
       ELSE 'LOW' END crit
FROM sys.sys_positions p WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_is_active AND (p.position_criticality IS NULL OR p.position_criticality='');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p JOIN vuoti v ON v.position_id=p.position_id ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_criticality=v.crit FROM vuoti v WHERE v.position_id=p.position_id;
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM sys.sys_positions WHERE position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND position_is_active AND (position_criticality IS NULL OR position_criticality=''); IF n>0 THEN RAISE EXCEPTION 'M: % posti senza criticita''', n; END IF; END $$;
COMMIT;
SELECT 'M ok' esito, position_criticality, count(*) FROM sys.sys_positions WHERE position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND position_is_active GROUP BY 2 ORDER BY 2;
