-- La sentinella 000342: i vettori delle mansioni che l'allineamento ha rinominato (E1, J) non descrivono piu' il testo da cui nascono.
-- Si tolgono (sono una cache): il lavoro di calcolo dei vettori li rifa' dal testo nuovo. Idempotente. Giornale: staging.rtl_allinea_org_undo (riga intera, vettore incluso).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_job_role_embeddings', e.job_role_id, to_jsonb(e) FROM sys.sys_job_role_embeddings e
 WHERE e.job_role_id::text IN (SELECT chiave FROM sys.v_embedding_impronta_non_combacia WHERE tabella='sys_job_role_embeddings') ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_job_role_embeddings WHERE job_role_id::text IN (SELECT chiave FROM sys.v_embedding_impronta_non_combacia WHERE tabella='sys_job_role_embeddings');
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM sys.v_embedding_impronta_non_combacia WHERE tabella='sys_job_role_embeddings'; IF n>0 THEN RAISE EXCEPTION 'X: restano % vettori stantii', n; END IF; END $$;
COMMIT;
SELECT 'X ok' esito, (SELECT count(*) FROM sys.v_embedding_impronta_non_combacia) stantii;
