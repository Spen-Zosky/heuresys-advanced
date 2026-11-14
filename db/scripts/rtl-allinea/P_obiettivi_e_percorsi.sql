-- Custodia storia36 (voce 7), seguito di N/O. Idempotente. Giornale: staging.rtl_allinea_org_undo.
--  - gli obiettivi di carriera ancora non di crescita (C5c(iv)) sono respinti con motivo
--  - descrizioni dei percorsi di carriera in italiano
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE bad ON COMMIT DROP AS
WITH RECURSIVE disc AS (
  SELECT p.position_id, 0 AS livello FROM sys.sys_positions p WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND p.position_reports_to_position_id IS NULL
  UNION ALL SELECT p.position_id, d.livello+1 FROM sys.sys_positions p JOIN disc d ON d.position_id=p.position_reports_to_position_id WHERE p.position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
), liv AS (SELECT position_id, min(livello) livello FROM disc GROUP BY 1)
SELECT t.user_target_position_id tid
FROM sys.sys_user_target_positions t
JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id=t.user_target_position_user_id AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE'
JOIN sys.sys_positions p_ora ON p_ora.position_id=a.user_position_assignment_position_id
JOIN sys.sys_positions p_meta ON p_meta.position_id=t.user_target_position_position_id
LEFT JOIN liv l_ora ON l_ora.position_id=p_ora.position_id LEFT JOIN liv l_meta ON l_meta.position_id=p_meta.position_id
WHERE t.user_target_position_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND t.user_target_position_review_status<>'REJECTED'
  AND (l_meta.livello IS NULL OR l_ora.livello IS NULL OR l_meta.livello>=l_ora.livello OR p_meta.position_title=p_ora.position_title
    OR NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a2 WHERE a2.user_position_assignment_position_id=p_meta.position_id AND a2.user_position_assignment_status='ACTIVE'));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_user_target_positions', t.user_target_position_id, to_jsonb(t) FROM sys.sys_user_target_positions t WHERE t.user_target_position_id IN (SELECT tid FROM bad) ON CONFLICT DO NOTHING;
UPDATE sys.sys_user_target_positions SET user_target_position_review_status='REJECTED', user_target_position_review_notes='Il posto non e'' piu'' in alto nell''organigramma o non ha titolari: non e'' una crescita'
 WHERE user_target_position_id IN (SELECT tid FROM bad);
CREATE TEMP TABLE d(en text, it text) ON COMMIT DROP;
INSERT INTO d VALUES ('Relationship management career path','Percorso di carriera nella gestione delle relazioni con la clientela'),('Career path into people management','Percorso di carriera verso la gestione delle persone'),('Compliance officer progression','Crescita professionale nella compliance');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_career_paths', c.career_path_id, to_jsonb(c) FROM sys.sys_career_paths c JOIN d ON d.en=c.career_path_description ON CONFLICT DO NOTHING;
UPDATE sys.sys_career_paths c SET career_path_description=d.it FROM d WHERE d.en=c.career_path_description;
COMMIT;
SELECT 'P ok';
