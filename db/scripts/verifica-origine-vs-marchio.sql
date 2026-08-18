-- verifica-origine-vs-marchio.sql — il controllo incrociato di P3 (spec §10.4), che è anche
-- la seconda metà di `#197`.
--
-- LE DUE COPERTURE, e perché confrontarle è il punto
--   `metadata.materialized_from` è un appunto che il motore lascia su **tre** tabelle su otto
--   (unità, competenze, indicatori) e NON sulle altre cinque — persone comprese. Il registro
--   `sys.sys_generated_record_origins` invece copre **ogni** riga generata.
--   Finché le due coperture non si confrontano, «non marcata perché reale» e «non marcata
--   perché il motore non la marca» sono indistinguibili guardando il dato: è il falso negativo
--   silenzioso che `#197` descrive.
--
--   Il controllo DEVE trovare una differenza. Se non ne trovasse nessuna starebbe confrontando
--   una cosa con sé stessa — ed è esattamente il modo in cui questo controllo può mentire.
--
-- Uso:
--   psql … -v codice=T9PROVA202608180322 -f db/scripts/verifica-origine-vs-marchio.sql
\if :{?codice}
\else
  \echo 'serve -v codice=<CODICE_AZIENDA>'
  \quit
\endif

\echo ''
\echo '=== copertura del REGISTRO (ogni riga generata) ==='
SELECT o.generated_record_origin_target_table AS tabella, count(*) AS righe
  FROM sys.sys_generated_record_origins o
  JOIN sys.sys_tenancies t ON t.tenant_id = o.generated_record_origin_tenant_id
 WHERE t.tenant_code = :'codice'
 GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== copertura del MARCHIO storico (tre tabelle su otto) ==='
WITH marchio AS (
  SELECT 'sys_organization_units' AS tabella, count(*) AS righe
    FROM sys.sys_organization_units u JOIN sys.sys_tenancies t ON t.tenant_id = u.organization_unit_tenant_id
   WHERE t.tenant_code = :'codice' AND u.organization_unit_metadata ? 'materialized_from'
  UNION ALL
  SELECT 'sys_skills', count(*) FROM sys.sys_skills s JOIN sys.sys_tenancies t ON t.tenant_id = s.skill_tenant_id
   WHERE t.tenant_code = :'codice' AND s.skill_metadata ? 'materialized_from'
  UNION ALL
  SELECT 'sys_kpi_definitions', count(*) FROM sys.sys_kpi_definitions k JOIN sys.sys_tenancies t ON t.tenant_id = k.kpi_definition_tenant_id
   WHERE t.tenant_code = :'codice' AND k.kpi_definition_metadata ? 'materialized_from'
  UNION ALL
  SELECT 'sys_users', count(*) FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
   WHERE t.tenant_code = :'codice' AND u.user_metadata ? 'materialized_from'
  UNION ALL
  SELECT 'sys_positions', count(*) FROM sys.sys_positions p JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
   WHERE t.tenant_code = :'codice' AND p.position_metadata ? 'materialized_from'
)
SELECT * FROM marchio ORDER BY tabella;

\echo ''
\echo '=== LA DIFFERENZA — righe che il registro conosce e il marchio no ==='
\echo '(un numero > 0 su una tabella e la prova che il marchio NON e il registro di provenienza)'
WITH reg AS (
  SELECT o.generated_record_origin_target_table AS tabella, count(*) AS n
    FROM sys.sys_generated_record_origins o
    JOIN sys.sys_tenancies t ON t.tenant_id = o.generated_record_origin_tenant_id
   WHERE t.tenant_code = :'codice' GROUP BY 1
), mar AS (
  -- ⚠ Le tabelle elencate qui devono essere le STESSE del blocco precedente. La prima
  -- stesura ne ometteva due (competenze e indicatori), e il controllo dichiarava scoperte
  -- 12 righe che il marchio invece copriva: un controllo che esagera la differenza è
  -- inservibile quanto uno che la tace, perché nessuno dei due numeri si può usare.
  SELECT 'sys_organization_units' AS tabella, count(*) AS n
    FROM sys.sys_organization_units u JOIN sys.sys_tenancies t ON t.tenant_id = u.organization_unit_tenant_id
   WHERE t.tenant_code = :'codice' AND u.organization_unit_metadata ? 'materialized_from'
  UNION ALL SELECT 'sys_skills', count(*) FROM sys.sys_skills s JOIN sys.sys_tenancies t ON t.tenant_id = s.skill_tenant_id
   WHERE t.tenant_code = :'codice' AND s.skill_metadata ? 'materialized_from'
  UNION ALL SELECT 'sys_kpi_definitions', count(*) FROM sys.sys_kpi_definitions k JOIN sys.sys_tenancies t ON t.tenant_id = k.kpi_definition_tenant_id
   WHERE t.tenant_code = :'codice' AND k.kpi_definition_metadata ? 'materialized_from'
  UNION ALL SELECT 'sys_users', count(*) FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
   WHERE t.tenant_code = :'codice' AND u.user_metadata ? 'materialized_from'
  UNION ALL SELECT 'sys_positions', count(*) FROM sys.sys_positions p JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
   WHERE t.tenant_code = :'codice' AND p.position_metadata ? 'materialized_from'
)
SELECT reg.tabella,
       reg.n AS nel_registro,
       coalesce(mar.n, 0) AS col_marchio,
       reg.n - coalesce(mar.n, 0) AS scoperte_dal_marchio
  FROM reg LEFT JOIN mar ON mar.tabella = reg.tabella
 WHERE reg.n - coalesce(mar.n, 0) > 0
 ORDER BY 4 DESC;
