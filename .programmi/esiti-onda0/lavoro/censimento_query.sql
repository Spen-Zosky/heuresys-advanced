select 'CLASSIF', stato, count(*) from sys.sys_classificazione_direzione_dato group by 2 order by 2;
select 'TABELLE', n.nspname, count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('sys','staging','reference_sync','audit','public') group by 2;
select 'GLOBALI_TENANT_NULL', t, n from (
 select c.table_name t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from sys.%I where %I is null', c.table_name, c.column_name), false, true, '')))[1]::text::bigint n
 from information_schema.columns c join information_schema.tables tt on tt.table_schema=c.table_schema and tt.table_name=c.table_name and tt.table_type='BASE TABLE'
 where c.table_schema='sys' and c.column_name like '%tenant_id' and c.is_nullable='YES') x where n>0 order by n desc;
select 'SENZA_TENANT', t, n from (
 select tt.table_name t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from sys.%I', tt.table_name), false, true, '')))[1]::text::bigint n
 from information_schema.tables tt where tt.table_schema='sys' and tt.table_type='BASE TABLE'
  and not exists (select 1 from information_schema.columns c where c.table_schema='sys' and c.table_name=tt.table_name and c.column_name like '%tenant_id')) x where n>0 order by n desc;
select 'REFSYNC', t, n from (select tablename t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from reference_sync.%I', tablename), false, true, '')))[1]::text::bigint n from pg_tables where schemaname='reference_sync') y;
select 'VETTORI', c.relname, a.attname, format_type(a.atttypid,a.atttypmod) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='sys' and a.attnum>0 and not a.attisdropped and format_type(a.atttypid,a.atttypmod) like 'vector%' ;
select 'TRADUZIONI', locale, source, count(*) from sys.sys_reference_translations group by 2,3 order by 2,3;
select 'TRAD_TAB', entity_table, count(*) from sys.sys_reference_translations group by 2 order by 3 desc limit 25;
select 'BLUEPRINT', 'famiglie', count(*) from sys.sys_blueprint_families union all select 'BLUEPRINT','varianti',count(*) from sys.sys_blueprint_variants union all select 'BLUEPRINT','versioni',count(*) from sys.sys_blueprint_variant_versions union all select 'BLUEPRINT','versioni_pubblicate',count(*) from sys.sys_blueprint_variant_versions where blueprint_variant_version_status='PUBLISHED' union all select 'BLUEPRINT','attivazioni',count(*) from sys.sys_blueprint_activations;
select 'FAM', blueprint_family_code from sys.sys_blueprint_families order by 2;
select 'SINT', tenant_code, tenant_status, tenant_industry_code from sys.sys_tenancies;
select 'HEURESYS', 'utenti', count(*) from sys.sys_users u join sys.sys_tenancies t on t.tenant_id=u.user_tenant_id where t.tenant_code='HEURESYS'
union all select 'HEURESYS','unita',count(*) from sys.sys_organization_units o join sys.sys_tenancies t on t.tenant_id=o.organization_unit_tenant_id where t.tenant_code='HEURESYS'
union all select 'HEURESYS','posizioni',count(*) from sys.sys_positions o join sys.sys_tenancies t on t.tenant_id=o.position_tenant_id where t.tenant_code='HEURESYS'
union all select 'HEURESYS','attivazioni',count(*) from sys.sys_blueprint_activations a join sys.sys_tenancies t on t.tenant_id=a.blueprint_activation_tenant_id where t.tenant_code='HEURESYS'
union all select 'RTL','utenti',count(*) from sys.sys_users u join sys.sys_tenancies t on t.tenant_id=u.user_tenant_id where t.tenant_code='RTL_BANK';
