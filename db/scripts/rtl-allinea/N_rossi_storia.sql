-- Custodia storia36 (voce 7), correzioni nei dati dei rossi non legati alla storia chiusa. Idempotente. Giornale: staging.rtl_allinea_org_undo.
--  C5f(iii) i posti critici sono segnalati nella vista di rilevanza della successione
--  C5b      i posti critici senza successori ricevono fino a 2 pari livello della stessa direzione (o di una direzione vicina)
--  C4h(ii)  chi dirige altri posti ha l'aggiornamento preposti (D.Lgs 81/08 art. 37) valido
--  C5c(iv)  gli obiettivi di carriera puntano a un posto piu' in alto, di altro mestiere e occupato (lungo la catena dei riporti)
--  C13d     le selezioni aperte su posti chiusi passano su un posto vacante gemello, nuovo e coerente (stessa unita', stesso titolo e mansione)
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
-- C5f(iii)
CREATE TEMP TABLE rel ON COMMIT DROP AS
SELECT gen_random_uuid() id, cp.critical_position_position_id pos FROM sys.sys_critical_positions cp
WHERE cp.critical_position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r WHERE r.position_id=cp.critical_position_position_id AND r.position_succession_relevance_tenant_id=cp.critical_position_tenant_id AND r.is_critical);
UPDATE sys.sys_position_succession_relevance r SET is_critical=true WHERE r.position_succession_relevance_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND r.position_id IN (SELECT pos FROM rel) AND NOT r.is_critical;
INSERT INTO sys.sys_position_succession_relevance (position_succession_relevance_id, position_id, position_succession_relevance_tenant_id, is_critical, position_succession_relevance_metadata)
SELECT id, pos, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', true, '{"allinea":"N"}'::jsonb FROM rel
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r WHERE r.position_id=rel.pos AND r.position_succession_relevance_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_position_succession_relevance', r.position_succession_relevance_id, '{}'::jsonb FROM sys.sys_position_succession_relevance r WHERE r.position_succession_relevance_metadata->>'allinea'='N' ON CONFLICT DO NOTHING;
-- C5b: successori fra i pari livello
CREATE TEMP TABLE senza ON COMMIT DROP AS
SELECT p.position_id, p.position_code, p.position_title, p.position_organization_unit_id uo, o.organization_unit_parent_id up,
       (SELECT k.user_contract_ccnl_level FROM sys.sys_user_position_assignments a JOIN sys.sys_user_contracts k ON k.user_contract_user_id=a.user_position_assignment_user_id AND k.user_contract_status='ACTIVE' WHERE a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' LIMIT 1) liv,
       (SELECT a.user_position_assignment_user_id FROM sys.sys_user_position_assignments a WHERE a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' LIMIT 1) titolare
FROM sys.sys_critical_positions cp JOIN sys.sys_positions p ON p.position_id=cp.critical_position_position_id JOIN sys.sys_organization_units o ON o.organization_unit_id=p.position_organization_unit_id
WHERE p.position_is_active AND p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c JOIN sys.sys_succession_pools s ON s.succession_pool_id=c.successor_candidate_pool_id WHERE s.succession_pool_position_id=p.position_id);
CREATE TEMP TABLE bacino ON COMMIT DROP AS
SELECT s.*, COALESCE((SELECT succession_pool_id FROM sys.sys_succession_pools x WHERE x.succession_pool_position_id=s.position_id LIMIT 1), gen_random_uuid()) pool_id,
       EXISTS (SELECT 1 FROM sys.sys_succession_pools x WHERE x.succession_pool_position_id=s.position_id) esiste FROM senza s;
INSERT INTO sys.sys_succession_pools (succession_pool_id, succession_pool_tenant_id, succession_pool_position_id, succession_pool_code, succession_pool_name, succession_pool_status, succession_pool_metadata)
SELECT pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', position_id, 'POOL-'||position_code, 'Successione — '||position_title, (SELECT succession_pool_status FROM sys.sys_succession_pools LIMIT 1), '{"allinea":"N"}'::jsonb FROM bacino WHERE NOT esiste;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_succession_pools', pool_id, '{}'::jsonb FROM bacino WHERE NOT esiste ON CONFLICT DO NOTHING;
CREATE TEMP TABLE pari ON COMMIT DROP AS
SELECT b.pool_id, a.user_position_assignment_user_id uid,
  row_number() OVER (PARTITION BY b.pool_id ORDER BY (k.user_contract_ccnl_level = b.liv) DESC, (p.position_organization_unit_id = b.uo) DESC, coalesce(k.user_contract_gross_annual_salary,0) DESC, a.user_position_assignment_user_id) rn
FROM bacino b
JOIN sys.sys_positions p ON p.position_is_active AND p.position_id <> b.position_id AND p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
JOIN sys.sys_organization_units o ON o.organization_unit_id=p.position_organization_unit_id AND (o.organization_unit_id=b.uo OR o.organization_unit_parent_id=b.up)
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id=p.position_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
JOIN sys.sys_user_contracts k ON k.user_contract_user_id=a.user_position_assignment_user_id AND k.user_contract_status='ACTIVE'
WHERE a.user_position_assignment_user_id IS DISTINCT FROM b.titolare AND k.user_contract_ccnl_level IN ('Dirigente','QD4','QD3','QD2');
DELETE FROM pari WHERE rn>2;
CREATE TEMP TABLE nuovi ON COMMIT DROP AS SELECT gen_random_uuid() cid, gen_random_uuid() rid, pari.*, CASE WHEN rn=1 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END liv FROM pari;
INSERT INTO sys.sys_successor_candidates (successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id, successor_candidate_user_id, successor_candidate_status, successor_candidate_readiness_level, successor_candidate_metadata)
SELECT cid, pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', uid, 'CANDIDATE', liv, '{"allinea":"N"}'::jsonb FROM nuovi;
INSERT INTO sys.sys_successor_readiness (successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id, successor_readiness_score, successor_readiness_horizon, successor_readiness_payload, successor_readiness_assessed_at)
SELECT rid, cid, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', CASE WHEN rn=1 THEN 60 ELSE 40 END, liv, '{"anno": 2026, "metodo": "comitato nomine — valutazione annuale", "allinea": "N"}'::jsonb, now() FROM nuovi;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_candidates', cid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_successor_readiness', rid, '{}'::jsonb FROM nuovi ON CONFLICT DO NOTHING;
-- C4h(ii)
CREATE TEMP TABLE prep ON COMMIT DROP AS
SELECT gen_random_uuid() id, u.user_id uid FROM sys.sys_users u
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE'
WHERE u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_status='ACTIVE'
  AND EXISTS (SELECT 1 FROM sys.sys_positions p WHERE p.position_reports_to_position_id=a.user_position_assignment_position_id)
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_certifications c WHERE c.user_certification_user_id=u.user_id AND c.user_certification_name ILIKE '%preposti%' AND c.user_certification_expires_date >= current_date + 365);
INSERT INTO sys.sys_user_certifications (user_certification_id, user_certification_user_id, user_certification_tenant_id, user_certification_name, user_certification_issuer, user_certification_issued_date, user_certification_expires_date, user_certification_metadata)
SELECT id, uid, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', 'Aggiornamento preposti (D.Lgs 81/08 art. 37)', 'INAIL', current_date, current_date + 1826, '{"status": "active", "validity_months": "60", "allinea": "N"}'::jsonb FROM prep;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_user_certifications', id, '{}'::jsonb FROM prep ON CONFLICT DO NOTHING;
-- C5c(iv): obiettivi di carriera lungo la catena dei riporti
CREATE TEMP TABLE bad ON COMMIT DROP AS
WITH RECURSIVE disc AS (
  SELECT p.position_id, 0 AS livello FROM sys.sys_positions p WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_reports_to_position_id IS NULL
  UNION ALL SELECT p.position_id, d.livello+1 FROM sys.sys_positions p JOIN disc d ON d.position_id=p.position_reports_to_position_id WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
), liv AS (SELECT position_id, min(livello) livello FROM disc GROUP BY 1)
SELECT t.user_target_position_id tid, a.user_position_assignment_position_id ora, p_ora.position_title titolo, l_ora.livello lo
FROM sys.sys_user_target_positions t
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=t.user_target_position_user_id AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE'
JOIN sys.sys_positions p_ora ON p_ora.position_id=a.user_position_assignment_position_id
JOIN sys.sys_positions p_meta ON p_meta.position_id=t.user_target_position_position_id
LEFT JOIN liv l_ora ON l_ora.position_id=p_ora.position_id LEFT JOIN liv l_meta ON l_meta.position_id=p_meta.position_id
WHERE t.user_target_position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND t.user_target_position_review_status<>'REJECTED'
  AND (l_meta.livello IS NULL OR l_ora.livello IS NULL OR l_meta.livello>=l_ora.livello OR p_meta.position_title=p_ora.position_title
    OR NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a2 WHERE a2.user_position_assignment_position_id=p_meta.position_id AND a2.user_position_assignment_status='ACTIVE'));
CREATE TEMP TABLE nuova_meta ON COMMIT DROP AS
WITH RECURSIVE su AS (
  SELECT b.tid, b.titolo, p.position_reports_to_position_id anc, 1 d FROM bad b JOIN sys.sys_positions p ON p.position_id=b.ora
  UNION ALL SELECT su.tid, su.titolo, p.position_reports_to_position_id, su.d+1 FROM su JOIN sys.sys_positions p ON p.position_id=su.anc WHERE su.anc IS NOT NULL AND su.d<8)
SELECT DISTINCT ON (su.tid) su.tid, su.anc FROM su JOIN sys.sys_positions p ON p.position_id=su.anc
WHERE p.position_title<>su.titolo AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a2 WHERE a2.user_position_assignment_position_id=su.anc AND a2.user_position_assignment_status='ACTIVE')
ORDER BY su.tid, su.d;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_user_target_positions', t.user_target_position_id, to_jsonb(t) FROM sys.sys_user_target_positions t WHERE t.user_target_position_id IN (SELECT tid FROM bad) ON CONFLICT DO NOTHING;
UPDATE sys.sys_user_target_positions t SET user_target_position_position_id=n.anc FROM nuova_meta n WHERE n.tid=t.user_target_position_id
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_target_positions x WHERE x.user_target_position_user_id=t.user_target_position_user_id AND x.user_target_position_position_id=n.anc AND x.user_target_position_id<>t.user_target_position_id);
-- quelli senza una meta valida sopra di loro (vertici) sono respinti con motivo
UPDATE sys.sys_user_target_positions t SET user_target_position_review_status='REJECTED', user_target_position_review_notes='Nessun posto superiore di altro mestiere lungo la catena dei riporti'
 WHERE t.user_target_position_id IN (SELECT tid FROM bad) AND t.user_target_position_id NOT IN (SELECT tid FROM nuova_meta);
-- C13d: posto vacante gemello per le selezioni aperte su posti chiusi
CREATE TEMP TABLE chiusi ON COMMIT DROP AS
SELECT rq.requisition_id rid, gen_random_uuid() npos, rq.requisition_position_id vecchio FROM sys.sys_job_requisitions rq
WHERE rq.requisition_metadata->>'storia36'='C13' AND rq.requisition_status='OPEN' AND NOT EXISTS (SELECT 1 FROM sys.sys_positions p WHERE p.position_id=rq.requisition_position_id AND p.position_is_active);
INSERT INTO sys.sys_positions (position_id, position_tenant_id, position_code, position_title, position_organization_unit_id, position_job_role_id, position_reports_to_position_id, position_esco_occupation_uri, position_criticality, position_economic_weight, position_is_active, position_effective_from, position_metadata)
SELECT c.npos, p.position_tenant_id, p.position_code||'-V'||substr(c.npos::text,1,4), p.position_title, p.position_organization_unit_id, p.position_job_role_id,
  p.position_reports_to_position_id,
  p.position_esco_occupation_uri, COALESCE(p.position_criticality,'LOW'), p.position_economic_weight, true, current_date, jsonb_build_object('allinea','N','gemello_di',p.position_id)
FROM chiusi c JOIN sys.sys_positions p ON p.position_id=c.vecchio;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_job_requisitions', q.requisition_id, to_jsonb(q) FROM sys.sys_job_requisitions q WHERE q.requisition_id IN (SELECT rid FROM chiusi) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_positions', npos, '{}'::jsonb FROM chiusi ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_requisitions q SET requisition_position_id=c.npos FROM chiusi c WHERE c.rid=q.requisition_id;
COMMIT;
SELECT 'N ok' esito;
