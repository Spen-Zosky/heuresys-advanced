-- db/scripts/faldone/censimento.sql — censimento MISURATO dei dati legati a una persona.
-- Non scrive niente: crea solo viste TEMPORANEE dentro una transazione che finisce in ROLLBACK
-- (una transazione READ ONLY non le permetterebbe). Uso: psql -X -A -F $'\t' -f db/scripts/faldone/censimento.sql heuresys_advanced
-- Livelli:
--   L0  sys.sys_users (la persona stessa)
--   L1  tabelle con una FK verso sys.sys_users (dato diretto)
--   L2  tabelle con una FK verso una tabella L1 (dato collegato: righe figlie dei dati della persona)
--   R   tabelle riferite da L1/L2 (decodifiche: posizioni, unità, competenze...) — colonne collegate
--   IMPL colonne che sembrano puntare a una persona ma non hanno FK (legami impliciti)
\pset footer off
BEGIN;

CREATE TEMP VIEW fk AS
SELECT c.oid, cn.nspname AS src_schema, cl.relname AS src_table,
       fn.nspname AS dst_schema, fl.relname AS dst_table,
       (SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(n, ord)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS src_cols,
       c.conrelid, c.confrelid
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace cn ON cn.oid = cl.relnamespace
JOIN pg_class fl ON fl.oid = c.confrelid JOIN pg_namespace fn ON fn.oid = fl.relnamespace
WHERE c.contype = 'f' AND NOT cl.relispartition;

CREATE TEMP VIEW l1 AS
SELECT DISTINCT conrelid AS rel FROM fk WHERE dst_schema = 'sys' AND dst_table = 'sys_users' AND conrelid <> confrelid;

CREATE TEMP VIEW l2 AS
SELECT DISTINCT f.conrelid AS rel FROM fk f JOIN l1 ON l1.rel = f.confrelid
WHERE f.conrelid NOT IN (SELECT rel FROM l1) AND f.conrelid <> 'sys.sys_users'::regclass;

CREATE TEMP VIEW rr AS
SELECT DISTINCT f.confrelid AS rel FROM fk f
WHERE f.conrelid IN (SELECT rel FROM l1 UNION SELECT rel FROM l2)
  AND f.confrelid NOT IN (SELECT rel FROM l1 UNION SELECT rel FROM l2)
  AND f.confrelid <> 'sys.sys_users'::regclass;

CREATE TEMP VIEW livelli AS
SELECT 'sys.sys_users'::regclass::oid AS rel, 'L0' AS livello
UNION ALL SELECT rel, 'L1' FROM l1 UNION ALL SELECT rel, 'L2' FROM l2 UNION ALL SELECT rel, 'R' FROM rr;

CREATE TEMP VIEW colonne AS
SELECT a.attrelid AS rel, count(*) AS n FROM pg_attribute a
WHERE a.attnum > 0 AND NOT a.attisdropped GROUP BY 1;

\echo '### TABELLE'
SELECT v.livello, n.nspname || '.' || c.relname AS tabella, co.n AS colonne,
       c.reltuples::bigint AS righe_stimate,
       (SELECT string_agg(src_cols || '->' || dst_table, ' ' ORDER BY src_cols) FROM fk
         WHERE fk.conrelid = v.rel AND (fk.dst_table = 'sys_users' OR fk.confrelid IN (SELECT rel FROM l1))) AS legami
FROM livelli v JOIN pg_class c ON c.oid = v.rel JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN colonne co ON co.rel = v.rel
ORDER BY v.livello, 2;

\echo '### TOTALI'
SELECT v.livello, count(*) AS tabelle, sum(co.n) AS colonne
FROM livelli v JOIN colonne co ON co.rel = v.rel GROUP BY ROLLUP (v.livello) ORDER BY 1;

\echo '### LEGAMI_PER_COLONNA_L1 (quante FK verso sys_users per nome di colonna)'
SELECT src_cols, count(*) FROM fk WHERE dst_table = 'sys_users' AND dst_schema = 'sys'
GROUP BY 1 ORDER BY 2 DESC, 1;

\echo '### IMPLICITI (colonne persona senza FK verso sys_users)'
SELECT n.nspname || '.' || c.relname AS tabella, a.attname, format_type(a.atttypid, a.atttypmod) AS tipo
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p') AND NOT c.relispartition AND a.attnum > 0 AND NOT a.attisdropped
  AND n.nspname IN ('sys','audit','staging','reference_sync')
  AND a.attname ~ '(user_id|employee_id|person_id|subject_id|actor_id|_by$|_by_user)'
  AND NOT EXISTS (SELECT 1 FROM fk WHERE fk.conrelid = c.oid AND fk.dst_table = 'sys_users'
                  AND a.attname = ANY (string_to_array(fk.src_cols, ',')))
ORDER BY 1, 2;
ROLLBACK;
