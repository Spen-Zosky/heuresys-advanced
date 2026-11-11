-- Custodia storia36 (voce 7), seguito di N. Idempotente. Giornale: staging.rtl_allinea_org_undo.
--  - nomi dei percorsi di carriera in italiano
--  - ogni posto di un passo di percorso e' collegato al percorso (sys_position_career_paths)
--  - gli obiettivi di carriera non raggiungibili da un percorso: i due posti entrano nel Percorso Direttivo (C5c(iii))
--  - orizzonte di copertura dei posti critici con bacino popolato (C5f(v))
--  - successori per i posti critici rimasti senza, fra i pari di unita' vicine di qualunque livello (C5b)
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE nome(en text, it text) ON COMMIT DROP;
INSERT INTO nome VALUES ('Management Track','Percorso Direttivo'),('Corporate Banking Track','Percorso Corporate Banking'),('Software Engineering Track','Percorso Ingegneria del Software'),
 ('Banking Operations Track','Percorso Operations Bancarie'),('Technology Leadership Track','Percorso Leadership Tecnologica');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_career_paths', c.career_path_id, to_jsonb(c) FROM sys.sys_career_paths c JOIN nome n ON n.en=c.career_path_name ON CONFLICT DO NOTHING;
UPDATE sys.sys_career_paths c SET career_path_name=n.it FROM nome n WHERE n.en=c.career_path_name;
-- collegamenti posto-percorso dai passi
INSERT INTO sys.sys_position_career_paths (position_career_path_id, position_id, position_career_path_tenant_id, career_path_id, position_career_path_metadata)
SELECT gen_random_uuid(), x.pos, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', x.path, '{"allinea":"O"}'::jsonb
FROM (SELECT DISTINCT s.career_path_step_path_id path, unnest(ARRAY[s.career_path_step_origin_position_id, s.career_path_step_target_position_id]) pos
      FROM sys.sys_career_path_steps s JOIN sys.sys_career_paths c ON c.career_path_id=s.career_path_step_path_id AND c.career_path_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0') x
WHERE x.pos IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_position_career_paths l WHERE l.position_id=x.pos AND l.career_path_id=x.path);
-- obiettivi non raggiungibili
CREATE TEMP TABLE irr ON COMMIT DROP AS
SELECT DISTINCT a.user_position_assignment_position_id ora, t.user_target_position_position_id meta
FROM sys.sys_user_target_positions t
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=t.user_target_position_user_id AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE'
WHERE t.user_target_position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND t.user_target_position_review_status<>'REJECTED'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_position_career_paths l1 JOIN sys.sys_position_career_paths l2 ON l2.career_path_id=l1.career_path_id AND l2.position_id=t.user_target_position_position_id WHERE l1.position_id=a.user_position_assignment_position_id);
INSERT INTO sys.sys_position_career_paths (position_career_path_id, position_id, position_career_path_tenant_id, career_path_id, position_career_path_metadata)
SELECT gen_random_uuid(), x.pos, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', (SELECT career_path_id FROM sys.sys_career_paths WHERE career_path_name='Percorso Direttivo' AND career_path_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'), '{"allinea":"O"}'::jsonb
FROM (SELECT ora pos FROM irr UNION SELECT meta FROM irr) x
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_career_paths l WHERE l.position_id=x.pos AND l.career_path_id=(SELECT career_path_id FROM sys.sys_career_paths WHERE career_path_name='Percorso Direttivo' AND career_path_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_position_career_paths', position_career_path_id, '{}'::jsonb FROM sys.sys_position_career_paths WHERE position_career_path_metadata->>'allinea'='O' ON CONFLICT DO NOTHING;
-- successori residui (qualunque livello, preferendo il piu' alto)
CREATE TEMP TABLE senza ON COMMIT DROP AS
SELECT p.position_id, p.position_code, p.position_title, p.position_organization_unit_id uo, o.organization_unit_parent_id up,
  (SELECT a.user_position_assignment_user_id FROM sys.sys_user_position_assignments a WHERE a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' LIMIT 1) titolare
FROM sys.sys_critical_positions cp JOIN sys.sys_positions p ON p.position_id=cp.critical_position_position_id JOIN sys.sys_organization_units o ON o.organization_unit_id=p.position_organization_unit_id
WHERE p.position_is_active AND p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c JOIN sys.sys_succession_pools s ON s.succession_pool_id=c.successor_candidate_pool_id WHERE s.succession_pool_position_id=p.position_id);
CREATE TEMP TABLE pari ON COMMIT DROP AS
SELECT sp.succession_pool_id pool_id, a.user_position_assignment_user_id uid,
  row_number() OVER (PARTITION BY sp.succession_pool_id ORDER BY CASE k.user_contract_ccnl_level WHEN 'Dirigente' THEN 9 WHEN 'QD4' THEN 8 WHEN 'QD3' THEN 7 WHEN 'QD2' THEN 6 WHEN 'QD1' THEN 5 WHEN '3A4L' THEN 4 ELSE 1 END DESC, (p.position_organization_unit_id=b.uo) DESC, a.user_position_assignment_user_id) rn
FROM senza b JOIN sys.sys_succession_pools sp ON sp.succession_pool_position_id=b.position_id
JOIN sys.sys_positions p ON p.position_is_active AND p.position_id<>b.position_id AND p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
JOIN sys.sys_organization_units o ON o.organization_unit_id=p.position_organization_unit_id AND (o.organization_unit_id=b.uo OR o.organization_unit_parent_id=b.up)
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
JOIN sys.sys_user_contracts k ON k.user_contract_user_id=a.user_position_assignment_user_id AND k.user_contract_status='ACTIVE'
WHERE a.user_position_assignment_user_id IS DISTINCT FROM b.titolare;
DELETE FROM pari WHERE rn>2;
CREATE TEMP TABLE nuovi ON COMMIT DROP AS SELECT gen_random_uuid() cid, gen_random_uuid() rid, pari.*, CASE WHEN rn=1 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END liv FROM pari;
INSERT INTO sys.sys_successor_candidates (successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id, successor_candidate_user_id, successor_candidate_status, successor_candidate_readiness_level, successor_candidate_metadata)
SELECT cid, pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', uid, 'CANDIDATE', liv, '{"allinea":"O"}'::jsonb FROM nuovi;
INSERT INTO sys.sys_successor_readiness (successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id, successor_readiness_score, successor_readiness_horizon, successor_readiness_payload, successor_readiness_assessed_at)
SELECT rid, cid, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', CASE WHEN rn=1 THEN 55 ELSE 35 END, liv, '{"anno": 2026, "metodo": "comitato nomine — valutazione annuale", "allinea": "O"}'::jsonb, now() FROM nuovi;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_candidates', cid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_readiness', rid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
-- orizzonte di copertura: il migliore fra i successori del bacino
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_position_succession_relevance', r.position_succession_relevance_id, to_jsonb(r) FROM sys.sys_position_succession_relevance r WHERE r.is_critical AND r.readiness_horizon IS NULL AND r.position_succession_relevance_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' ON CONFLICT DO NOTHING;
UPDATE sys.sys_position_succession_relevance r SET readiness_horizon = COALESCE((
  SELECT CASE min(CASE c.successor_candidate_readiness_level WHEN 'READY_NOW' THEN 0 WHEN 'READY_6_MONTHS' THEN 1 WHEN 'READY_1_YEAR' THEN 2 ELSE 3 END) WHEN 0 THEN 'READY_NOW' WHEN 1 THEN 'READY_6_MONTHS' WHEN 2 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END
  FROM sys.sys_successor_candidates c JOIN sys.sys_succession_pools s ON s.succession_pool_id=c.successor_candidate_pool_id WHERE s.succession_pool_position_id=r.position_id), 'READY_2_YEARS')
WHERE r.is_critical AND r.readiness_horizon IS NULL AND r.position_succession_relevance_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
COMMIT;
SELECT 'O ok';
