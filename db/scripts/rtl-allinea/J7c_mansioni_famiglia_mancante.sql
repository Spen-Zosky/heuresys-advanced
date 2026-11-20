-- J7c (Enzo 2026-11-20, seguito di J7 e J7b): la famiglia delle 37 mansioni del profilo di RTL Bank che avevano il livello ma non la famiglia (modelli per direzione DEPT-* e DIR-*, e CEO-EXEC).
-- Regola dichiarata e ripetibile, come J7b, ma qui il codice dice di piu' dell'ISCO (le voci ESCO collegate danno per OPS ora 1120 ora 1330: contraddittorie):
--   FAMIGLIA = dalla direzione che il codice nomina (DEPT-<X>-... o DIR-<X>-...): AFC -> FIN, COMM -> COMM, CORP -> COMM (banca corporate), HR -> HR, IT -> IT, OPS -> OPS;
--              senza direzione nel codice: dal gruppo ISCO a 4 cifre della voce ESCO collegata (1120 -> ADMIN, come le mansioni CEO gia' compilate).
--   LIVELLO  = non si tocca: tutte e 37 lo hanno gia' (la regola di J7b non si applica a un campo pieno).
-- Riempie SOLO la famiglia vuota: non cambia mai un valore presente. Perimetro: i 37 codici elencati, catalogo globale (job_role_tenant_id NULL).
-- Giornale: staging.rtl_mansioni_famiglia_undo (stessa di J7 e J7b; fonte «regola codice-direzione» o «regola ISCO»). Ritorno: UPDATE sys.sys_job_roles r SET job_role_family_id = u.famiglia_prima
--   FROM staging.rtl_mansioni_famiglia_undo u WHERE r.job_role_id = u.job_role_id AND u.fonte LIKE 'regola codice%'.
-- Idempotente: la seconda corsa non trova famiglie vuote fra i codici elencati.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_mansioni_famiglia_undo (salvato_il timestamptz NOT NULL DEFAULT now(), job_role_id uuid PRIMARY KEY, codice text NOT NULL, famiglia_prima uuid, livello_prima text, famiglia_dopo uuid, livello_dopo text, fonte text NOT NULL);
CREATE TEMP TABLE direzione_famiglia(direzione text PRIMARY KEY, famiglia text NOT NULL) ON COMMIT DROP;
INSERT INTO direzione_famiglia VALUES ('AFC','FIN'),('COMM','COMM'),('CORP','COMM'),('HR','HR'),('IT','IT'),('OPS','OPS');
CREATE TEMP TABLE isco_famiglia(isco text PRIMARY KEY, famiglia text NOT NULL) ON COMMIT DROP;
INSERT INTO isco_famiglia VALUES ('1120','ADMIN');
CREATE TEMP TABLE elenco(codice text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO elenco VALUES ('CEO-EXEC'),('DEPT-AFC-1-MGR'),('DEPT-AFC-1-SMGR'),('DEPT-AFC-2-MGR'),('DEPT-AFC-2-SMGR'),('DEPT-COMM-1-MGR'),('DEPT-COMM-1-SMGR'),('DEPT-COMM-2-MGR'),('DEPT-COMM-2-SMGR'),('DEPT-CORP-1-MGR'),('DEPT-CORP-1-SMGR'),('DEPT-CORP-2-MGR'),('DEPT-CORP-2-SMGR'),('DEPT-HR-1-MGR'),('DEPT-HR-1-SMGR'),('DEPT-HR-2-MGR'),('DEPT-HR-2-SMGR'),('DEPT-IT-1-MGR'),('DEPT-IT-1-SMGR'),('DEPT-IT-2-MGR'),('DEPT-IT-2-SMGR'),('DEPT-OPS-1-MGR'),('DEPT-OPS-1-SMGR'),('DEPT-OPS-2-MGR'),('DEPT-OPS-2-SMGR'),('DIR-AFC-DIR'),('DIR-AFC-VDIR'),('DIR-COMM-DIR'),('DIR-COMM-VDIR'),('DIR-CORP-DIR'),('DIR-CORP-VDIR'),('DIR-HR-DIR'),('DIR-HR-VDIR'),('DIR-IT-DIR'),('DIR-IT-VDIR'),('DIR-OPS-DIR'),('DIR-OPS-VDIR');
CREATE TEMP TABLE esito ON COMMIT DROP AS
  SELECT r.job_role_id, r.job_role_code, r.job_role_family_id AS fam_prima, r.job_role_seniority_level AS liv,
         (SELECT string_agg(DISTINCT substr(m.esco_occupation_mapping_isco_code, 1, 4), ',') FROM sys.sys_esco_occupation_mappings m WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id) AS isco,
         coalesce(
           (SELECT f.job_family_id FROM direzione_famiglia d JOIN sys.sys_job_families f ON f.job_family_code = d.famiglia WHERE d.direzione = substring(r.job_role_code from '^(?:DEPT|DIR)-([A-Z]+)-')),
           (SELECT f.job_family_id FROM sys.sys_esco_occupation_mappings m JOIN isco_famiglia i ON i.isco = substr(m.esco_occupation_mapping_isco_code, 1, 4) JOIN sys.sys_job_families f ON f.job_family_code = i.famiglia
             WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id ORDER BY f.job_family_id LIMIT 1)) AS fam_regola,
         CASE WHEN r.job_role_code ~ '^(DEPT|DIR)-[A-Z]+-' THEN 'regola codice-direzione' ELSE 'regola ISCO' END AS fonte
    FROM sys.sys_job_roles r JOIN elenco e ON e.codice = r.job_role_code
   WHERE r.job_role_tenant_id IS NULL;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM esito;
  IF n <> 37 THEN RAISE EXCEPTION 'J7c: attese 37 mansioni di catalogo, trovate %', n; END IF;
  SELECT count(*) INTO n FROM esito WHERE fam_regola IS NULL AND fam_prima IS NULL;
  RAISE NOTICE 'J7c: % mansioni senza risposta della regola (restano vuote)', n;
END $$;
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_job_roles) totale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL) senza_famiglia,
  (SELECT count(*) FROM esito WHERE fam_prima IS NULL AND fam_regola IS NOT NULL) da_toccare;
SELECT 'J7c prima' fase, totale, senza_famiglia, da_toccare FROM prima;
INSERT INTO staging.rtl_mansioni_famiglia_undo (job_role_id, codice, famiglia_prima, livello_prima, famiglia_dopo, livello_dopo, fonte)
  SELECT job_role_id, job_role_code, fam_prima, liv, fam_regola, liv, fonte FROM esito WHERE fam_prima IS NULL AND fam_regola IS NOT NULL
  ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_roles r SET job_role_family_id = e.fam_regola FROM esito e WHERE e.job_role_id = r.job_role_id AND e.fam_prima IS NULL AND e.fam_regola IS NOT NULL;
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF (SELECT count(*) FROM sys.sys_job_roles) <> p.totale THEN RAISE EXCEPTION 'J7c: il numero di mansioni e'' cambiato'; END IF;
  IF (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL) <> p.senza_famiglia - p.da_toccare THEN RAISE EXCEPTION 'J7c: le mansioni senza famiglia non tornano'; END IF;
  IF EXISTS (SELECT 1 FROM esito e JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id WHERE r.job_role_seniority_level IS DISTINCT FROM e.liv) THEN RAISE EXCEPTION 'J7c: un livello e'' cambiato'; END IF;
END $$;
SELECT 'J7c regola' fase, e.job_role_code, f.job_family_code famiglia, e.liv livello, coalesce(e.isco,'-') isco, e.fonte
  FROM esito e JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id LEFT JOIN sys.sys_job_families f ON f.job_family_id = r.job_role_family_id ORDER BY e.job_role_code;
COMMIT;
SELECT 'J7c ok' esito, (SELECT count(*) FROM staging.rtl_mansioni_famiglia_undo WHERE fonte LIKE 'regola codice%' OR (fonte = 'regola ISCO' AND codice = 'CEO-EXEC')) voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL) senza_famiglia_ora;
