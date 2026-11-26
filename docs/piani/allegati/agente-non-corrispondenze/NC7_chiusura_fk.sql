WITH RECURSIVE fk AS (
  SELECT c.conrelid::regclass::text AS tab, c.confrelid::regclass::text AS puntata,
         (SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colonna
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.conrelid::regclass::text <> c.confrelid::regclass::text
), chain AS (
  SELECT tab, colonna, puntata, 1 AS livello FROM fk
   WHERE puntata IN ('sys.sys_users','sys.sys_positions','sys.sys_organization_units')
  UNION
  SELECT f.tab, f.colonna, f.puntata, ch.livello + 1 FROM fk f JOIN chain ch ON f.puntata = ch.tab
   WHERE ch.livello < 8
), best AS (
  SELECT DISTINCT ON (tab) tab, colonna, puntata, livello FROM chain ORDER BY tab, livello, puntata, colonna
)
SELECT b.tab, b.colonna, b.puntata, b.livello,
       (SELECT string_agg(a.attname, ',') FROM pg_attribute a WHERE a.attrelid = b.tab::regclass
          AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = 'tenant_id') AS col_tenant
FROM best b ORDER BY livello, tab;
