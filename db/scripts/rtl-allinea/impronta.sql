-- Impronta MD5 del contenuto di ogni tabella di sys, staging e audit (ordine delle righe indifferente; si ignorano updated_at e updated_by,
-- che un UPDATE senza variazioni di valore aggiorna comunque). Sola lettura. Uso: psql -X -At -f impronta.sql  ->  righe «schema.tabella|righe|md5»
CREATE FUNCTION pg_temp.imp(s text, t text) RETURNS text LANGUAGE plpgsql AS $f$ DECLARE n bigint; h text; BEGIN
  EXECUTE format('SELECT count(*), md5(coalesce(string_agg(j::text, %L ORDER BY j::text), %L)) FROM (SELECT to_jsonb(x) - %L - %L AS j FROM %I.%I x) q', ',', '', 'updated_at', 'updated_by', s, t) INTO n, h;
  RETURN s || '.' || t || '|' || n || '|' || h; END $f$;
SELECT pg_temp.imp(n.nspname, c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND n.nspname IN ('sys','staging','audit') ORDER BY n.nspname, c.relname;
