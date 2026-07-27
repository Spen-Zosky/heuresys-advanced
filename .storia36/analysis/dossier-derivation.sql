WITH RECURSIVE fk AS (
  SELECT cr.relname AS child, cf.relname AS parent, na.attname AS col
  FROM pg_constraint co
  JOIN pg_class cr ON cr.oid=co.conrelid
  JOIN pg_namespace nr ON nr.oid=cr.relnamespace
  JOIN pg_class cf ON cf.oid=co.confrelid
  JOIN pg_namespace nf ON nf.oid=cf.relnamespace
  CROSS JOIN LATERAL unnest(co.conkey) AS k(attnum)
  JOIN pg_attribute na ON na.attrelid=cr.oid AND na.attnum=k.attnum
  WHERE co.contype='f' AND nr.nspname='sys' AND nf.nspname='sys'
),
biz AS (
  SELECT DISTINCT child, parent FROM fk
  WHERE col !~ '_by$' AND col !~ '_actor' AND col !~ '(created|updated|deleted)_by_user_id$'
),
hubs(hub, dossier) AS (VALUES
  ('sys_tenancies','TENANT'),
  ('sys_users','PERSONA'),
  ('sys_positions','POSIZIONE'),
  ('sys_organization_units','UNITA_ORG'),
  ('sys_teams','TEAM'),
  ('sys_blueprint_process_registry','PROCESSO'),
  ('sys_kpi_definitions','CASCATA_KPI')
),
reach AS (
  SELECT h.hub COLLATE "C" AS tbl, h.dossier FROM hubs h
  UNION
  SELECT b.child, r.dossier
  FROM biz b JOIN reach r ON b.parent = r.tbl
),
alltab AS (
  SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='sys' AND c.relkind='r'
)
SELECT a.tbl,
       coalesce(array_agg(DISTINCT r.dossier ORDER BY r.dossier)
                FILTER (WHERE r.dossier IS NOT NULL), '{}') AS dossiers
FROM alltab a
LEFT JOIN reach r ON r.tbl = a.tbl
GROUP BY a.tbl
ORDER BY cardinality(coalesce(array_agg(DISTINCT r.dossier)
                FILTER (WHERE r.dossier IS NOT NULL), '{}')), a.tbl;
