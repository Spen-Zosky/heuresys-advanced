-- Voce 4 (mandato RTL 2026-11-11): requisiti di competenza che una banca non ha (alimentare, chimica/materiali, sosta).
-- Fanno comparire «chimica» e «trasporti» nel VRIO di RTL. Si ritirano i requisiti dei posti RTL; il catalogo ESCO resta com'e'.
-- Idempotente. Giornale: staging.rtl_allinea_org_undo (riga intera dei requisiti). Rollback: INSERT dalle righe salvate.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
CREATE TEMP TABLE fuori ON COMMIT DROP AS
SELECT r.position_skill_requirement_id id FROM sys.sys_position_skill_requirements r JOIN sys.sys_skills s ON s.skill_id=r.skill_id
 WHERE r.position_skill_requirement_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
   AND (s.skill_name IN ('materiali avanzati','regolamentazione della sosta') OR s.skill_name ~* 'produzione alimentare');
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_position_skill_requirements', r.position_skill_requirement_id, to_jsonb(r) FROM sys.sys_position_skill_requirements r JOIN fuori f ON f.id=r.position_skill_requirement_id ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_position_skill_requirements WHERE position_skill_requirement_id IN (SELECT id FROM fuori);
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM sys.sys_position_skill_requirements r JOIN sys.sys_skills s ON s.skill_id=r.skill_id
   WHERE r.position_skill_requirement_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND (s.skill_name IN ('materiali avanzati','regolamentazione della sosta') OR s.skill_name ~* 'produzione alimentare');
  IF n>0 THEN RAISE EXCEPTION 'H: restano % requisiti fuori settore', n; END IF; END $$;
COMMIT;
SELECT 'H ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo WHERE tabella='sys_position_skill_requirements') nel_giornale;
