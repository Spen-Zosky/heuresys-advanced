-- Colloca i processi P01-P30 di RTL Bank come sottoprocessi dei processi unici (000498, voce V2 del
-- piano docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
--
-- Decisione di Enzo del 2026-11-18 03:43 di Roma: i P adottati dal consolidamento il 2026-11-17 sono
-- sottoprocessi. Le corrispondenze sono quelle del catalogo dei 21 processi unici approvato da Enzo il
-- 2026-11-10 (documento «Agente esperto bancario: consolidamento corsa e RTL», tabella «Proposte di
-- aggregazione dei Processi»): dove la corsa accorpava piu' P in un processo unico, ogni P diventa un
-- sottoprocesso di quel processo. Le voci P che RTL non ha non trovano righe e non fanno niente.
--
-- MISURA PRIMA, GUARDIA, POST-CONDIZIONE, RITORNO:
--   misura e guardia: ogni P da collocare esiste, e' al livello 1 senza genitore, e il suo genitore e'
--   un processo attivo di primo livello dello stesso tenant; altrimenti si ferma senza scrivere.
--   post-condizione: le altre colonne di tutti i processi sono invariate (impronta), 21 P al livello 2,
--   nessun difetto nella sentinella sys.v_tenant_processes_parent_defects.
--   ritorno: giornale staging.processi_sottoprocessi_undo e colloca-sottoprocessi-inversa.sql.
-- Idempotente: una seconda corsa non trova niente da collocare e lo dice.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS staging.processi_sottoprocessi_undo (
  salvato_il  timestamptz NOT NULL DEFAULT now(),
  processo_id uuid PRIMARY KEY,
  codice      text NOT NULL,
  genitore_prima uuid,
  livello_prima  smallint NOT NULL
);

CREATE TEMP TABLE mappa(figlio text PRIMARY KEY, genitore text NOT NULL) ON COMMIT DROP;
INSERT INTO mappa VALUES
  ('P01','00'),('P02','00'),('P06','00'),
  ('P03','11'),
  ('P05','10'),
  ('P04','02'),  -- 2026-11-22: separato da 10 (separa-tre-accorpamenti.sql)
  ('P07','12'),
  ('P08','15'),('P09','15'),('P10','15'),
  ('P11','01'),
  ('P12','03'),('P13','03'),('P14','03'),
  ('P17','04'),
  ('P15','13'),('P16','13'),
  ('P18','14'),('P19','14'),
  ('P20','05'),  -- 2026-11-22: separato da 05 (separa-tre-accorpamenti.sql)
  ('P21','09'),
  ('P22','17'),('P23','17'),('P24','17'),('P25','17'),('P28','17'),
  ('P26','16'),
  ('P27','18'),
  ('P29','19'),
  ('P30','20');

CREATE TEMP TABLE pr ON COMMIT DROP AS
SELECT tenant_process_code c, tenant_process_id id, tenant_process_level lv, tenant_process_parent_id par, tenant_process_is_active att
  FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

CREATE TEMP TABLE da_fare ON COMMIT DROP AS
SELECT f.id AS figlio_id, f.c AS figlio, g.id AS genitore_id, g.c AS genitore, f.lv, f.par, g.lv AS g_lv, g.att AS g_att
  FROM mappa m JOIN pr f ON f.c = m.figlio JOIN pr g ON g.c = m.genitore;

DO $$
DECLARE n_tot int; n_gia int; n_male int; impronta text;
BEGIN
  SELECT count(*) INTO n_tot FROM da_fare;
  SELECT count(*) INTO n_gia FROM da_fare WHERE lv = 2 AND par = genitore_id;
  SELECT count(*) INTO n_male FROM da_fare WHERE NOT ((lv = 1 AND par IS NULL) OR (lv = 2 AND par = genitore_id)) OR g_lv <> 1 OR NOT g_att;
  RAISE NOTICE 'misura: % P di RTL nella mappa, % gia'' collocati, % in uno stato inatteso', n_tot, n_gia, n_male;
  IF n_male > 0 THEN RAISE EXCEPTION 'guardia: % processi in uno stato inatteso, niente scritto', n_male; END IF;
  IF (SELECT count(*) FROM pr WHERE c LIKE 'P%' AND c NOT IN (SELECT figlio FROM mappa)) > 0 THEN
    RAISE EXCEPTION 'guardia: RTL ha processi P che la mappa non conosce, niente scritto';
  END IF;
END $$;

CREATE TEMP TABLE impronta_prima ON COMMIT DROP AS
SELECT count(*) n, md5(string_agg((to_jsonb(t) - 'tenant_process_parent_id' - 'tenant_process_level' - 'updated_at')::text, '|' ORDER BY t.tenant_process_id)) h
  FROM sys.sys_tenant_processes t;

INSERT INTO staging.processi_sottoprocessi_undo (processo_id, codice, genitore_prima, livello_prima)
SELECT figlio_id, figlio, par, lv FROM da_fare WHERE NOT (lv = 2 AND par = genitore_id)
ON CONFLICT (processo_id) DO NOTHING;

UPDATE sys.sys_tenant_processes t
   SET tenant_process_parent_id = d.genitore_id, tenant_process_level = 2
  FROM da_fare d
 WHERE t.tenant_process_id = d.figlio_id AND NOT (d.lv = 2 AND d.par = d.genitore_id);

DO $$
DECLARE a bigint; b text; n2 int; dif int; l1 int;
BEGIN
  SELECT count(*), md5(string_agg((to_jsonb(t) - 'tenant_process_parent_id' - 'tenant_process_level' - 'updated_at')::text, '|' ORDER BY t.tenant_process_id))
    INTO a, b FROM sys.sys_tenant_processes t;
  IF a <> (SELECT n FROM impronta_prima) OR b <> (SELECT h FROM impronta_prima) THEN
    RAISE EXCEPTION 'post-condizione: sono cambiate altre colonne dei processi';
  END IF;
  SELECT count(*) INTO n2 FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_level = 2;
  SELECT count(*) INTO l1 FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND tenant_process_level = 1 AND tenant_process_is_active;
  SELECT count(*) INTO dif FROM sys.v_tenant_processes_parent_defects;
  IF n2 <> (SELECT count(*) FROM da_fare) OR dif <> 0 THEN
    RAISE EXCEPTION 'post-condizione: sottoprocessi % (attesi %), difetti %', n2, (SELECT count(*) FROM da_fare), dif;
  END IF;
  RAISE NOTICE 'fatto: % sottoprocessi, % processi attivi di primo livello, 0 difetti', n2, l1;
END $$;

COMMIT;
