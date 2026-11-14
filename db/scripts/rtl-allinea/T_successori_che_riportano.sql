-- C5g (coordinatore, 2026-11-11): i successori dei due posti critici senza riporti diventano persone che riportano al posto.
--  - Direzione Antiriciclaggio: uno Specialista Compliance passa alla direzione e riporta al suo responsabile
--  - Sviluppo Applicativi Core Banking: due sviluppatori (Mariani L., Zanetti C.) riportano al suo responsabile (scostamento dalla decisione 5, richiesto dal coordinatore)
--  - i successori scelti fra i pari che non riportano al posto si tolgono; i nuovi entrano con la prontezza
-- In coda: C4h(ii), l'aggiornamento preposti a chi dirige altri posti (prima era in N, ma T crea nuovi capi: in N la seconda corsa trovava un capo senza attestato).
-- Idempotente. Giornale: staging.rtl_allinea_org_undo (righe prima; inserite come 'ins:').
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE crit ON COMMIT DROP AS
SELECT p.position_id, p.position_title FROM sys.sys_positions p WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_is_active
 AND p.position_title IN ('Responsabile Direzione Antiriciclaggio','Responsabile Sviluppo Applicativi Core Banking');
-- scelta dei posti da far riportare
CREATE TEMP TABLE mov ON COMMIT DROP AS
SELECT x.pos, c.position_id crit FROM (
  SELECT (SELECT a.user_position_assignment_position_id FROM sys.sys_users u JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
          JOIN sys.sys_positions p ON p.position_id=a.user_position_assignment_position_id WHERE u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_title='Specialista Compliance' ORDER BY u.user_last_name, u.user_first_name LIMIT 1) pos, 'Responsabile Direzione Antiriciclaggio' t
  UNION ALL
  SELECT a.user_position_assignment_position_id, 'Responsabile Sviluppo Applicativi Core Banking' FROM sys.sys_users u JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=u.user_id AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
   WHERE u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND (u.user_last_name, u.user_first_name) IN (('Mariani','Luca'),('Zanetti','Chiara'))) x
JOIN crit c ON c.position_title=x.t WHERE x.pos IS NOT NULL;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p WHERE p.position_id IN (SELECT pos FROM mov) ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_reports_to_position_id=m.crit,
  position_organization_unit_id = CASE WHEN c.position_title='Responsabile Direzione Antiriciclaggio' THEN (SELECT position_organization_unit_id FROM sys.sys_positions WHERE position_id=m.crit) ELSE p.position_organization_unit_id END
FROM mov m JOIN crit c ON c.position_id=m.crit WHERE p.position_id=m.pos AND (p.position_reports_to_position_id IS DISTINCT FROM m.crit);
-- successori non validi (ne' occupano il posto, ne' riportano, ne' fanno lo stesso mestiere altrove)
CREATE TEMP TABLE inval ON COMMIT DROP AS
SELECT sc.successor_candidate_id id FROM sys.sys_successor_candidates sc JOIN sys.sys_succession_pools sp ON sp.succession_pool_id=sc.successor_candidate_pool_id LEFT JOIN sys.sys_positions pp ON pp.position_id=sp.succession_pool_position_id
WHERE sc.successor_candidate_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a0 WHERE a0.user_position_assignment_user_id=sc.successor_candidate_user_id AND a0.user_position_assignment_status='ACTIVE' AND a0.user_position_assignment_position_id=sp.succession_pool_position_id)
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions cpz ON cpz.position_id=a.user_position_assignment_position_id
       WHERE a.user_position_assignment_user_id=sc.successor_candidate_user_id AND a.user_position_assignment_status='ACTIVE' AND (cpz.position_reports_to_position_id=sp.succession_pool_position_id OR (cpz.position_title=pp.position_title AND cpz.position_id<>pp.position_id)));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_successor_readiness', r.successor_readiness_id, to_jsonb(r) FROM sys.sys_successor_readiness r WHERE r.successor_readiness_candidate_id IN (SELECT id FROM inval) ON CONFLICT DO NOTHING;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_successor_candidates', c.successor_candidate_id, to_jsonb(c) FROM sys.sys_successor_candidates c WHERE c.successor_candidate_id IN (SELECT id FROM inval) ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_successor_readiness WHERE successor_readiness_candidate_id IN (SELECT id FROM inval);
DELETE FROM sys.sys_successor_candidates WHERE successor_candidate_id IN (SELECT id FROM inval);
-- nuovi successori: i titolari dei posti che ora riportano
CREATE TEMP TABLE nuovi ON COMMIT DROP AS
SELECT gen_random_uuid() cid, gen_random_uuid() rid, sp.succession_pool_id pool_id, a.user_position_assignment_user_id uid,
       row_number() OVER (PARTITION BY sp.succession_pool_id ORDER BY a.user_position_assignment_user_id) rn
FROM (SELECT crit, pos FROM mov UNION
      SELECT sp2.succession_pool_position_id, r.position_id FROM sys.sys_succession_pools sp2 JOIN sys.sys_positions r ON r.position_reports_to_position_id=sp2.succession_pool_position_id AND r.position_is_active
       WHERE sp2.succession_pool_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
         AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c WHERE c.successor_candidate_pool_id=sp2.succession_pool_id)) m(crit, pos)
JOIN sys.sys_succession_pools sp ON sp.succession_pool_position_id=m.crit
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id=m.pos AND a.user_position_assignment_status='ACTIVE' AND a.user_position_assignment_kind='PRIMARY'
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates c WHERE c.successor_candidate_pool_id=sp.succession_pool_id AND c.successor_candidate_user_id=a.user_position_assignment_user_id);
INSERT INTO sys.sys_successor_candidates (successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id, successor_candidate_user_id, successor_candidate_status, successor_candidate_readiness_level, successor_candidate_metadata)
SELECT cid, pool_id, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', uid, 'CANDIDATE', CASE WHEN rn=1 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END, '{"allinea":"T"}'::jsonb FROM nuovi;
INSERT INTO sys.sys_successor_readiness (successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id, successor_readiness_score, successor_readiness_horizon, successor_readiness_payload, successor_readiness_assessed_at)
SELECT rid, cid, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', CASE WHEN rn=1 THEN 60 ELSE 40 END, CASE WHEN rn=1 THEN 'READY_1_YEAR' ELSE 'READY_2_YEARS' END, '{"anno": 2026, "metodo": "comitato nomine — valutazione annuale", "allinea": "T"}'::jsonb, now() FROM nuovi;
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
COMMIT;
SELECT 'T ok';
