-- Custodia storia36 (voce 7): successione dei posti critici dopo il riallineamento. Idempotente.
--  1) si tolgono i successori che non occupano il posto e non riportano a esso (C5g): dopo A i riporti sono cambiati
--  2) ogni posto critico attivo senza successori ne riceve fino a 2, scelti fra chi riporta direttamente al posto
--     (il piu' alto per retribuzione), con valutazione di prontezza (C5b). Se nessuno riporta al posto, resta senza: e' il caso dichiarato nell'esito.
-- Giornale: staging.rtl_allinea_org_undo (righe tolte per intero; righe inserite come 'ins:<tabella>').
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE inval ON COMMIT DROP AS
SELECT sc.successor_candidate_id id FROM sys.sys_successor_candidates sc
JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
LEFT JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
WHERE sc.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a0 WHERE a0.user_position_assignment_user_id = sc.successor_candidate_user_id AND a0.user_position_assignment_status='ACTIVE' AND a0.user_position_assignment_position_id = sp.succession_pool_position_id)
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions cpz ON cpz.position_id = a.user_position_assignment_position_id
       WHERE a.user_position_assignment_user_id = sc.successor_candidate_user_id AND a.user_position_assignment_status='ACTIVE'
         AND (cpz.position_reports_to_position_id = sp.succession_pool_position_id OR (cpz.position_title = pp.position_title AND cpz.position_id <> pp.position_id)));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_successor_readiness', r.successor_readiness_id, to_jsonb(r) FROM sys.sys_successor_readiness r WHERE r.successor_readiness_candidate_id IN (SELECT id FROM inval) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_successor_candidates', c.successor_candidate_id, to_jsonb(c) FROM sys.sys_successor_candidates c WHERE c.successor_candidate_id IN (SELECT id FROM inval) ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_successor_readiness WHERE successor_readiness_candidate_id IN (SELECT id FROM inval);
DELETE FROM sys.sys_successor_candidates WHERE successor_candidate_id IN (SELECT id FROM inval);
-- posti critici attivi senza successori
CREATE TEMP TABLE senza ON COMMIT DROP AS
SELECT p.position_id, p.position_code, p.position_title FROM sys.sys_critical_positions cp JOIN sys.sys_positions p ON p.position_id=cp.critical_position_position_id
WHERE p.position_is_active AND p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c JOIN sys.sys_succession_pools s ON s.succession_pool_id=c.successor_candidate_pool_id WHERE s.succession_pool_position_id=p.position_id);
CREATE TEMP TABLE bacino ON COMMIT DROP AS
SELECT s.position_id, s.position_title, COALESCE((SELECT succession_pool_id FROM sys.sys_succession_pools x WHERE x.succession_pool_position_id=s.position_id LIMIT 1), gen_random_uuid()) pool_id,
       EXISTS (SELECT 1 FROM sys.sys_succession_pools x WHERE x.succession_pool_position_id=s.position_id) esiste, s.position_code
FROM senza s;
INSERT INTO sys.sys_succession_pools (succession_pool_id, succession_pool_tenant_id, succession_pool_position_id, succession_pool_code, succession_pool_name, succession_pool_status, succession_pool_metadata)
SELECT pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', position_id, 'POOL-' || position_code, 'Successione — ' || position_title,
       (SELECT succession_pool_status FROM sys.sys_succession_pools LIMIT 1), '{"allinea":"K"}'::jsonb FROM bacino WHERE NOT esiste;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_succession_pools', pool_id, '{}'::jsonb FROM bacino WHERE NOT esiste ON CONFLICT DO NOTHING;
CREATE TEMP TABLE scelti ON COMMIT DROP AS
SELECT b.pool_id, b.position_id, a.user_position_assignment_user_id uid, row_number() OVER (PARTITION BY b.pool_id ORDER BY coalesce(k.user_contract_gross_annual_salary,0) DESC, a.user_position_assignment_user_id) rn
FROM bacino b JOIN sys.sys_positions r ON r.position_reports_to_position_id=b.position_id AND r.position_is_active
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id=r.position_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
LEFT JOIN sys.sys_user_contracts k ON k.user_contract_user_id=a.user_position_assignment_user_id AND k.user_contract_status='ACTIVE';
DELETE FROM scelti WHERE rn>2;
CREATE TEMP TABLE nuovi ON COMMIT DROP AS SELECT gen_random_uuid() cid, gen_random_uuid() rid, s.*, CASE WHEN rn=1 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END liv FROM scelti s;
INSERT INTO sys.sys_successor_candidates (successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id, successor_candidate_user_id, successor_candidate_status, successor_candidate_readiness_level, successor_candidate_metadata)
SELECT cid, pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', uid, 'CANDIDATE', liv, '{"allinea":"K"}'::jsonb FROM nuovi;
INSERT INTO sys.sys_successor_readiness (successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id, successor_readiness_score, successor_readiness_horizon, successor_readiness_payload, successor_readiness_assessed_at)
SELECT rid, cid, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', CASE WHEN rn=1 THEN 65 ELSE 45 END, liv, '{"anno": 2026, "metodo": "comitato nomine — valutazione annuale", "allinea": "K"}'::jsonb, now() FROM nuovi;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_candidates', cid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_readiness', rid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
COMMIT;
SELECT 'K ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo WHERE tabella LIKE '%successor%' OR tabella LIKE '%succession%') nel_giornale;
SELECT p.position_title FROM sys.sys_critical_positions cp JOIN sys.sys_positions p ON p.position_id=cp.critical_position_position_id WHERE NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c JOIN sys.sys_succession_pools s ON s.succession_pool_id=c.successor_candidate_pool_id WHERE s.succession_pool_position_id=p.position_id);
