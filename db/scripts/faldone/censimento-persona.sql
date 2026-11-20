-- db/scripts/faldone/censimento-persona.sql — per UNA persona: righe e colonne non vuote per ogni legame L1.
-- Sola lettura. Uso: psql -X -A -F $'\t' -v uid=<uuid> -f db/scripts/faldone/censimento-persona.sql heuresys_advanced
\pset footer off
BEGIN READ ONLY;
\echo '### PERSONA_PER_LEGAME'
WITH fk AS (
  SELECT n.nspname AS s, cl.relname AS t, a.attname AS col
  FROM pg_constraint c
  JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f' AND c.confrelid = 'sys.sys_users'::regclass AND array_length(c.conkey,1) = 1
    AND NOT cl.relispartition AND c.conrelid <> c.confrelid
)
SELECT s || '.' || t AS tabella, col,
  (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I WHERE %I = %L::uuid', s, t, col, :'uid'), false, true, '')))[1]::text::int AS righe
FROM fk ORDER BY 3 DESC, 1, 2;
\echo '### PERSONA_COLONNE_NON_VUOTE_IN_SYS_USERS'
SELECT count(*) FILTER (WHERE value IS NOT NULL AND value <> 'null'::jsonb) AS non_vuote, count(*) AS colonne
FROM sys.sys_users u, jsonb_each(to_jsonb(u)) WHERE u.user_id = :'uid'::uuid;
ROLLBACK;
