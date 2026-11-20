-- J7 (Enzo 2026-11-20, giro delle interfacce): famiglia e livello delle mansioni del catalogo che il profilo di RTL Bank mostra con «— —».
-- Misura: nel profilo di RTL (142 mansioni) 36 non avevano ne' famiglia ne' livello: 12 RTL-* e 24 PROTO-*. Qui se ne compilano 11 RTL-* e 1 PROTO-*, SOLO dove c'e' una fonte nel catalogo:
--   fonte «omonima»  = la mansione RTL-ROLE-* con lo stesso nome e le stesse funzioni (famiglia e livello copiati);
--   fonte «analogia» = nessun omonimo: la stessa famiglia della funzione e il livello che le mansioni «analista» del catalogo portano sempre (MID) — marcata sotto.
-- Lasciate vuote, senza fonte: RTL-CC (contact center: nessuna mansione omonima, nessuna famiglia «clientela» che non sia retail), il livello di RTL-HRBP, e le 23 PROTO-* del profilo (voci ESCO del catalogo di piattaforma: la famiglia la sceglie chi cura il catalogo).
-- Riempie solo dove famiglia E livello mancano entrambi; non cambia mai un valore gia' presente. Catalogo globale (job_role_tenant_id NULL, mig. 000397).
-- Giornale: staging.rtl_mansioni_famiglia_undo (mansione, famiglia e livello prima). Ritorno: UPDATE sys.sys_job_roles r SET job_role_family_id = u.famiglia_prima, job_role_seniority_level = u.livello_prima
--   FROM staging.rtl_mansioni_famiglia_undo u WHERE r.job_role_id = u.job_role_id. Idempotente: la seconda corsa non trova mansioni vuote da riempire fra quelle elencate.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_mansioni_famiglia_undo (salvato_il timestamptz NOT NULL DEFAULT now(), job_role_id uuid PRIMARY KEY, codice text NOT NULL, famiglia_prima uuid, livello_prima text, famiglia_dopo uuid, livello_dopo text, fonte text NOT NULL);
CREATE TEMP TABLE da_compilare(codice text PRIMARY KEY, famiglia text, livello text, fonte text) ON COMMIT DROP;
INSERT INTO da_compilare VALUES
  ('RTL-AML',     'LEGAL',  'MID',       'omonimo: RTL-ROLE-SPECIALISTA-COMPLIANCE (specialista antiriciclaggio = specialista compliance)'),
  ('RTL-BO-OPS',  'OPS',    'MID',       'omonimo: RTL-ROLE-BACK-OFFICE-SPECIALIST'),
  ('RTL-CEO',     'ADMIN',  'EXECUTIVE', 'omonimo: RTL-ROLE-CEO (amministratore delegato / direttore generale)'),
  ('RTL-COMPL',   'LEGAL',  'MID',       'omonimo: RTL-ROLE-COMPLIANCE-OFFICER'),
  ('RTL-CRO',     'RISK',   'EXECUTIVE', 'omonimo: RTL-ROLE-CHIEF-RISK-OFFICER'),
  ('RTL-CYBER',   'IT',     'MID',       'analogia: funzione IT, livello delle mansioni «analista» del catalogo'),
  ('RTL-FIN-RPT', 'FIN',    'MID',       'omonimo: RTL-ROLE-ANALISTA-BILANCIO (analista financial reporting)'),
  ('RTL-HR-MGR',  'HR',     'LEAD',      'omonimo: RTL-ROLE-HR-MANAGER'),
  ('RTL-HRBP',    'HR',     NULL,        'analogia: funzione HR, livello non derivabile (resta vuoto)'),
  ('RTL-IT-DEV',  'IT',     'MID',       'omonimo: RTL-ROLE-SOFTWARE-DEVELOPER'),
  ('RTL-OPS-MGR', 'OPS',    'LEAD',      'omonimo: RTL-ROLE-LINE-MANAGER-OPERATIONS'),
  ('PROTO-2-12',  'FIN',    'MID',       'omonimo: RTL-ROLE-ANALISTA-FINANZIARIO');
-- Guardie: ogni codice esiste una sola volta nel catalogo globale; ogni famiglia citata esiste; ogni livello e' ammesso.
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM da_compilare d JOIN sys.sys_job_roles r ON r.job_role_code = d.codice AND r.job_role_tenant_id IS NULL;
  IF n <> 12 THEN RAISE EXCEPTION 'J7: attese 12 mansioni di catalogo, trovate %', n; END IF;
  SELECT count(*) INTO n FROM da_compilare d WHERE d.famiglia IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_job_families f WHERE f.job_family_code = d.famiglia);
  IF n > 0 THEN RAISE EXCEPTION 'J7: % famiglie citate non esistono', n; END IF;
  SELECT count(*) INTO n FROM da_compilare d WHERE d.livello IS NOT NULL AND d.livello NOT IN ('ENTRY','JUNIOR','MID','SENIOR','LEAD','EXECUTIVE');
  IF n > 0 THEN RAISE EXCEPTION 'J7: % livelli non ammessi', n; END IF;
END $$;
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_job_roles) totale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL AND job_role_seniority_level IS NULL) vuote,
  (SELECT count(*) FROM sys.sys_job_roles r JOIN da_compilare d ON d.codice = r.job_role_code WHERE r.job_role_tenant_id IS NULL AND r.job_role_family_id IS NULL AND r.job_role_seniority_level IS NULL) da_riempire,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NOT NULL OR job_role_seniority_level IS NOT NULL) compilate;
SELECT 'J7 prima' fase, totale, vuote, da_riempire, compilate FROM prima;
INSERT INTO staging.rtl_mansioni_famiglia_undo (job_role_id, codice, famiglia_prima, livello_prima, famiglia_dopo, livello_dopo, fonte)
  SELECT r.job_role_id, r.job_role_code, r.job_role_family_id, r.job_role_seniority_level, f.job_family_id, d.livello, d.fonte
    FROM sys.sys_job_roles r JOIN da_compilare d ON d.codice = r.job_role_code
    LEFT JOIN sys.sys_job_families f ON f.job_family_code = d.famiglia
   WHERE r.job_role_tenant_id IS NULL AND r.job_role_family_id IS NULL AND r.job_role_seniority_level IS NULL
  ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_roles r SET job_role_family_id = f.job_family_id, job_role_seniority_level = d.livello
  FROM da_compilare d LEFT JOIN sys.sys_job_families f ON f.job_family_code = d.famiglia
 WHERE r.job_role_code = d.codice AND r.job_role_tenant_id IS NULL AND r.job_role_family_id IS NULL AND r.job_role_seniority_level IS NULL;
-- Post-condizione: nessuna mansione aggiunta o tolta, le compilate crescono esattamente di quelle riempite, nient'altro e' cambiato.
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF (SELECT count(*) FROM sys.sys_job_roles) <> p.totale THEN RAISE EXCEPTION 'J7: il numero di mansioni e'' cambiato'; END IF;
  IF (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL AND job_role_seniority_level IS NULL) <> p.vuote - p.da_riempire THEN RAISE EXCEPTION 'J7: le mansioni vuote non tornano'; END IF;
  IF (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NOT NULL OR job_role_seniority_level IS NOT NULL) <> p.compilate + p.da_riempire THEN RAISE EXCEPTION 'J7: le mansioni compilate non tornano'; END IF;
END $$;
COMMIT;
SELECT 'J7 ok' esito, (SELECT count(*) FROM staging.rtl_mansioni_famiglia_undo) voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL AND job_role_seniority_level IS NULL) ancora_vuote;
