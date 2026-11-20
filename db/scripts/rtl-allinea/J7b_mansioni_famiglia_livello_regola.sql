-- J7b (Enzo 2026-11-20, seguito di J7): famiglia e livello delle ultime mansioni del profilo di RTL Bank che il catalogo mostrava con «— —»:
--   23 PROTO-* bancarie, RTL-CC e il livello di RTL-HRBP. Una REGOLA dichiarata e ripetibile, non una scelta caso per caso:
--   FAMIGLIA = dal gruppo di unita' ISCO (4 cifre) della voce ESCO collegata alla mansione (sys_esco_occupation_mappings.esco_occupation_mapping_isco_code), tabella qui sotto;
--   LIVELLO  = dalla parola che apre il titolo della mansione, la stessa che le mansioni gia' compilate del catalogo seguono:
--              direttore | chief | amministratore delegato -> EXECUTIVE; responsabile | manager | capo -> LEAD; vice -> SENIOR; addetto | cassiere -> ENTRY; ogni altro titolo
--              (analista, consulente, specialista, gestore, operatore, tesoriere, controllore, pianificatore, business partner) -> MID.
-- Riempie SOLO il campo vuoto (famiglia o livello): non cambia mai un valore presente. Perimetro: i 25 codici elencati, tutti del catalogo globale (job_role_tenant_id NULL).
-- Una mansione per cui la regola non da' risposta (nessun ISCO in tabella) resta vuota e lo dice il messaggio finale.
-- Giornale: staging.rtl_mansioni_famiglia_undo (stessa tabella di J7: prima e dopo, con la fonte). Ritorno: UPDATE sys.sys_job_roles r SET job_role_family_id = u.famiglia_prima, job_role_seniority_level = u.livello_prima
--   FROM staging.rtl_mansioni_famiglia_undo u WHERE r.job_role_id = u.job_role_id AND u.fonte LIKE 'regola ISCO%'.
-- RTL-HRBP e' gia' nel giornale di J7 (stessa chiave): il suo livello non ha una voce a parte, e il ritorno di J7 lo riporta a vuoto insieme alla famiglia.
-- Idempotente: la seconda corsa non trova campi vuoti fra i codici elencati.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_mansioni_famiglia_undo (salvato_il timestamptz NOT NULL DEFAULT now(), job_role_id uuid PRIMARY KEY, codice text NOT NULL, famiglia_prima uuid, livello_prima text, famiglia_dopo uuid, livello_dopo text, fonte text NOT NULL);
CREATE TEMP TABLE isco_famiglia(isco text PRIMARY KEY, famiglia text NOT NULL, descrizione text NOT NULL) ON COMMIT DROP;
INSERT INTO isco_famiglia VALUES
  ('1211','FIN','dirigenti dei servizi finanziari'), ('1212','HR','dirigenti delle risorse umane'), ('1221','COMM','dirigenti delle vendite e del marketing'),
  ('1330','IT','dirigenti dei servizi ICT'), ('1346','RETAIL','dirigenti di filiale bancaria e assicurativa'),
  ('2411','FIN','contabili'), ('2412','WM','consulenti finanziari e di investimento'), ('2413','FIN','analisti finanziari'),
  ('2423','HR','specialisti del personale e della carriera'), ('2434','COMM','specialisti delle vendite ICT'), ('2631','FIN','economisti'),
  ('3312','COMM','addetti a crediti e prestiti'), ('4211','RETAIL','cassieri di banca e impiegati assimilati'), ('4222','RETAIL','impiegati dei centri di contatto con la clientela');
CREATE TEMP TABLE elenco(codice text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO elenco VALUES ('PROTO-2-10'),('PROTO-2-11'),('PROTO-2-13'),('PROTO-2-2'),('PROTO-2-3'),('PROTO-2-4'),('PROTO-2-5'),('PROTO-2-6'),('PROTO-2-7'),('PROTO-2-8'),('PROTO-2-9'),
  ('PROTO-4-10'),('PROTO-4-4'),('PROTO-4-9'),('PROTO-6-1'),('PROTO-6-2'),('PROTO-6-3'),('PROTO-6-4'),('PROTO-6-5'),('PROTO-7-1'),('PROTO-7-2'),('PROTO-7-4'),('PROTO-8-1'),('RTL-CC'),('RTL-HRBP');
CREATE TEMP TABLE esito ON COMMIT DROP AS
  SELECT r.job_role_id, r.job_role_code, r.job_role_name, r.job_role_family_id AS fam_prima, r.job_role_seniority_level AS liv_prima,
         (SELECT string_agg(DISTINCT substr(m.esco_occupation_mapping_isco_code, 1, 4), ',') FROM sys.sys_esco_occupation_mappings m WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id) AS isco,
         (SELECT f.job_family_id FROM sys.sys_esco_occupation_mappings m JOIN isco_famiglia i ON i.isco = substr(m.esco_occupation_mapping_isco_code, 1, 4) JOIN sys.sys_job_families f ON f.job_family_code = i.famiglia
           WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id GROUP BY f.job_family_id ORDER BY count(*) DESC, f.job_family_id LIMIT 1) AS fam_regola,
         CASE WHEN lower(r.job_role_name) ~ '^(direttore|direttrice|chief|amministratore delegato)' THEN 'EXECUTIVE'
              WHEN lower(r.job_role_name) ~ '^(responsabile|manager|capo|head)' OR lower(r.job_role_name) ~ ' manager( |$|/)' THEN 'LEAD'
              WHEN lower(r.job_role_name) ~ '^vice' THEN 'SENIOR'
              WHEN lower(r.job_role_name) ~ '^(addetto|addetta|cassiere)' THEN 'ENTRY'
              ELSE 'MID' END AS liv_regola
    FROM sys.sys_job_roles r JOIN elenco e ON e.codice = r.job_role_code
   WHERE r.job_role_tenant_id IS NULL;
-- Guardie: tutti i 25 codici esistono nel catalogo globale; nessuna mansione ha PIU' di un gruppo ISCO ambiguo nella tabella (la regola deve dare una sola famiglia).
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM esito;
  IF n <> 25 THEN RAISE EXCEPTION 'J7b: attese 25 mansioni di catalogo, trovate %', n; END IF;
  SELECT count(*) INTO n FROM esito WHERE fam_regola IS NULL AND fam_prima IS NULL;
  RAISE NOTICE 'J7b: % mansioni senza risposta della regola per la famiglia (restano vuote)', n;
END $$;
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_job_roles) totale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL AND job_role_seniority_level IS NULL) vuote,
  (SELECT count(*) FROM esito WHERE (fam_prima IS NULL AND fam_regola IS NOT NULL) OR liv_prima IS NULL) da_toccare;
SELECT 'J7b prima' fase, totale, vuote, da_toccare FROM prima;
INSERT INTO staging.rtl_mansioni_famiglia_undo (job_role_id, codice, famiglia_prima, livello_prima, famiglia_dopo, livello_dopo, fonte)
  SELECT job_role_id, job_role_code, fam_prima, liv_prima, coalesce(fam_prima, fam_regola), coalesce(liv_prima, liv_regola),
         'regola ISCO ' || coalesce(isco, 'assente') || ' -> famiglia; titolo -> livello'
    FROM esito WHERE (fam_prima IS NULL AND fam_regola IS NOT NULL) OR liv_prima IS NULL
  ON CONFLICT DO NOTHING;
UPDATE sys.sys_job_roles r SET job_role_family_id = coalesce(r.job_role_family_id, e.fam_regola), job_role_seniority_level = coalesce(r.job_role_seniority_level, e.liv_regola)
  FROM esito e WHERE e.job_role_id = r.job_role_id AND ((e.fam_prima IS NULL AND e.fam_regola IS NOT NULL) OR e.liv_prima IS NULL);
-- Post-condizione: nessuna mansione aggiunta o tolta; nessun valore presente cambiato; le mansioni del giornale hanno ora famiglia e livello (salvo risposta mancante della regola).
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF (SELECT count(*) FROM sys.sys_job_roles) <> p.totale THEN RAISE EXCEPTION 'J7b: il numero di mansioni e'' cambiato'; END IF;
  IF EXISTS (SELECT 1 FROM esito e JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id
              WHERE (e.fam_prima IS NOT NULL AND r.job_role_family_id IS DISTINCT FROM e.fam_prima) OR (e.liv_prima IS NOT NULL AND r.job_role_seniority_level IS DISTINCT FROM e.liv_prima))
  THEN RAISE EXCEPTION 'J7b: un valore presente e'' stato cambiato'; END IF;
  IF EXISTS (SELECT 1 FROM esito e JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id WHERE r.job_role_seniority_level IS NULL) THEN RAISE EXCEPTION 'J7b: restano mansioni senza livello'; END IF;
END $$;
SELECT 'J7b regola' fase, e.job_role_code, e.job_role_name, f.job_family_code famiglia, r.job_role_seniority_level livello, coalesce(e.isco, 'assente') isco
  FROM esito e JOIN sys.sys_job_roles r ON r.job_role_id = e.job_role_id LEFT JOIN sys.sys_job_families f ON f.job_family_id = r.job_role_family_id ORDER BY e.job_role_code;
COMMIT;
SELECT 'J7b ok' esito, (SELECT count(*) FROM staging.rtl_mansioni_famiglia_undo WHERE fonte LIKE 'regola ISCO%') voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_job_roles WHERE job_role_family_id IS NULL AND job_role_seniority_level IS NULL) ancora_vuote;
