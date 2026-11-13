-- Blocco D / criticita' dei posti (profili.ts: CRITICITA_RUOLI). Il posto RTL abbinato prende la criticita' del posto della corsa;
-- i posti CRITICAL entrano in sys_critical_positions se mancano. Idempotente. Giornale: staging.rtl_allinea_org_undo (stato prima del posto)
-- e staging.rtl_allinea_skill_undo (tabella sys_critical_positions, id inseriti). Dipende da D1 (staging.rtl_persona_corsa).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_skill_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TABLE IF NOT EXISTS staging.rtl_corsa_crit(posto text, criticita text);
TRUNCATE staging.rtl_corsa_crit;
COPY staging.rtl_corsa_crit FROM STDIN;
R001	CRITICAL
R002	MEDIUM
R003	MEDIUM
R004	MEDIUM
R005	MEDIUM
R006	CRITICAL
R007	MEDIUM
R008	MEDIUM
R009	MEDIUM
R010	CRITICAL
R011	MEDIUM
R012	MEDIUM
R013	MEDIUM
R014	CRITICAL
R015	MEDIUM
R016	MEDIUM
R017	MEDIUM
R018	CRITICAL
R019	MEDIUM
R020	MEDIUM
R021	MEDIUM
R022	MEDIUM
R023	MEDIUM
R024	MEDIUM
R025	MEDIUM
R026	MEDIUM
R027	MEDIUM
R028	MEDIUM
R029	MEDIUM
R030	MEDIUM
R031	MEDIUM
R032	MEDIUM
R033	HIGH
R034	MEDIUM
R035	LOW
R036	MEDIUM
R037	HIGH
R038	MEDIUM
R039	LOW
R040	MEDIUM
R041	HIGH
R042	MEDIUM
R043	MEDIUM
R044	MEDIUM
R045	HIGH
R046	HIGH
R047	HIGH
R048	HIGH
R049	LOW
R050	MEDIUM
R051	LOW
R052	HIGH
R053	LOW
R054	MEDIUM
R055	LOW
R056	HIGH
R057	LOW
R058	MEDIUM
R059	MEDIUM
R060	MEDIUM
R061	MEDIUM
R062	HIGH
R063	MEDIUM
R064	LOW
R065	LOW
R066	LOW
R067	MEDIUM
R068	HIGH
R069	MEDIUM
R070	LOW
R071	LOW
R072	LOW
R073	MEDIUM
R074	HIGH
R075	MEDIUM
R076	MEDIUM
R077	HIGH
R078	LOW
R079	LOW
R080	LOW
R081	HIGH
R082	LOW
R083	LOW
R084	CRITICAL
R085	MEDIUM
R086	MEDIUM
R087	LOW
R088	LOW
R089	LOW
R090	MEDIUM
R091	MEDIUM
R092	MEDIUM
R093	MEDIUM
R094	LOW
R095	MEDIUM
R096	MEDIUM
R097	MEDIUM
R098	MEDIUM
R099	LOW
R100	MEDIUM
R101	MEDIUM
R102	MEDIUM
R103	MEDIUM
R104	LOW
R105	LOW
R106	LOW
R107	CRITICAL
R108	MEDIUM
R109	LOW
\.
CREATE TEMP TABLE pp ON COMMIT DROP AS
SELECT DISTINCT a.user_position_assignment_position_id AS posto, k.criticita
FROM staging.rtl_persona_corsa pc JOIN staging.rtl_corsa_crit k ON k.posto=pc.codice
JOIN sys.sys_users u ON u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_last_name || ', ' || u.user_first_name = pc.persona
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY';
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p JOIN pp ON pp.posto=p.position_id ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_criticality=pp.criticita FROM pp WHERE pp.posto=p.position_id AND p.position_criticality IS DISTINCT FROM pp.criticita
   -- i posti gia' nel registro dei critici restano CRITICAL (lo impone I, C5f): D non li abbassa, altrimenti I li rialzerebbe a ogni corsa
   AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions c WHERE c.critical_position_position_id=p.position_id);
WITH ins AS (
  INSERT INTO sys.sys_critical_positions (critical_position_tenant_id, critical_position_position_id, critical_position_rationale)
  SELECT '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid, p.posto, 'Criticita'' CRITICAL del posto della corsa p20261010010521tjb' FROM pp p
   WHERE p.criticita='CRITICAL' AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions c WHERE c.critical_position_position_id=p.posto)
  RETURNING critical_position_id)
INSERT INTO staging.rtl_allinea_skill_undo (tabella, chiave) SELECT 'sys_critical_positions', critical_position_id FROM ins ON CONFLICT DO NOTHING;
COMMIT;
SELECT 'D/criticita ok' esito, (SELECT count(*) FROM sys.sys_positions WHERE position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND position_is_active AND position_criticality IS NULL) posti_senza_criticita,
       (SELECT count(*) FROM sys.sys_critical_positions WHERE critical_position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0') critici;
