-- C2c (coordinatore, 2026-11-11): le review con periodo che finisce dopo l'allineamento passano al nuovo responsabile gerarchico; lo storico chiuso resta.
-- Idempotente. Giornale: staging.rtl_allinea_org_undo (riga prima).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE da ON COMMIT DROP AS
SELECT r.review_id id, m.mgr FROM sys.sys_performance_reviews r
JOIN LATERAL (SELECT a2.user_position_assignment_user_id mgr FROM sys.sys_user_position_assignments a1
   JOIN sys.sys_positions p1 ON p1.position_id=a1.user_position_assignment_position_id
   JOIN sys.sys_user_position_assignments a2 ON a2.user_position_assignment_position_id=p1.position_reports_to_position_id AND a2.user_position_assignment_kind='PRIMARY' AND a2.user_position_assignment_status='ACTIVE'
   WHERE a1.user_position_assignment_user_id=r.review_subject_user_id AND a1.user_position_assignment_kind='PRIMARY' AND a1.user_position_assignment_status='ACTIVE' LIMIT 1) m ON true
WHERE r.review_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND r.review_subject_user_id IS NOT NULL AND m.mgr<>r.review_subject_user_id
  AND r.review_period_end >= (SELECT min(salvato_il)::date FROM staging.rtl_allinea_livelli_undo)
  AND r.review_reviewer_user_id IS DISTINCT FROM m.mgr;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_performance_reviews', r.review_id, to_jsonb(r) FROM sys.sys_performance_reviews r WHERE r.review_id IN (SELECT id FROM da) ON CONFLICT DO NOTHING;
UPDATE sys.sys_performance_reviews r SET review_reviewer_user_id=d.mgr FROM da d WHERE d.id=r.review_id;
COMMIT;
SELECT 'U ok';
