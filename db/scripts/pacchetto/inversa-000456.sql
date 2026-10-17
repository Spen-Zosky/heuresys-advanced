-- Inversa della 000456: riporta a testo le tre colonne del pacchetto del datastore.
-- NON sta in db/migrations (la catena la applicherebbe a ogni deploy). Si lancia a mano, su una copia o su una decisione di Enzo:
--   psql -h localhost -d <database> -v ON_ERROR_STOP=1 -f db/scripts/pacchetto/inversa-000456.sql
-- Rende lo stesso testo che la guardia della 000456 ha ammesso: data AAAA-MM-GG; istante in UTC con millisecondi e «Z».
-- Idempotente: converte solo le colonne che non sono ancora testo.
BEGIN;

DO $$
DECLARE
  c record;
  tipo text;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('sys_blueprint_content_packages',        'blueprint_content_package_source_created_at',        'varchar(40)', 'to_char(%I AT TIME ZONE ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')'),
      ('sys_blueprint_content_ccnl',            'blueprint_content_ccnl_effective',                   'text',        'to_char(%I, ''YYYY-MM-DD'')'),
      ('sys_blueprint_content_ccnl_institutes', 'blueprint_content_ccnl_institute_valid_from',        'varchar(40)', 'to_char(%I, ''YYYY-MM-DD'')')
    ) AS v(tabella, colonna, vecchio, espressione)
  LOOP
    SELECT data_type INTO tipo FROM information_schema.columns
     WHERE table_schema = 'sys' AND table_name = c.tabella AND column_name = c.colonna;
    IF tipo IN ('date', 'timestamp with time zone') THEN
      EXECUTE format('ALTER TABLE sys.%I ALTER COLUMN %I TYPE %s USING ' || c.espressione, c.tabella, c.colonna, c.vecchio, c.colonna);
      RAISE NOTICE 'inversa-000456: % riportata a %', c.colonna, c.vecchio;
    ELSE
      RAISE NOTICE 'inversa-000456: % e'' % , no-op', c.colonna, coalesce(tipo, 'assente');
    END IF;
  END LOOP;
END $$;

COMMIT;
