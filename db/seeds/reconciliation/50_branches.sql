-- 50_branches.sql — Wave-2/B-50 close: sys_branches import via anchor-OU rule (S982).
-- PM decision (Enzo 2026-06-10, dossier B50_DEFER_UNBLOCK_PACKAGE.md, D1 = option B):
--   for each legacy location referenced by org_units (via org_units.default_location_id), create ONE
--   branch anchored to the TOPMOST advanced OU of the referencing group (sys_branches has a UNIQUE
--   constraint on branch_organization_unit_id -> 1 branch per OU; the inverse cardinality wall
--   "many OU -> 1 location" is resolved by the anchor choice, not by spreading).
-- Anchor map (legacy org_unit id -> verified topmost of the referencing group, extracted 2026-06-10):
--   MI-HQ  -> 'RTL Bank S.p.A.' root  (e289f5e3...)  [15 referencing OUs, root included]
--   MI-OPS -> 'Divisione Operations'  (3352bf9c...)  [3 referencing OUs, the other 2 are its children]
--   BG-CEN -> 'Filiale Bergamo Centro' (59c17654...) [1:1]
--   BS-CEN -> 'Filiale Brescia Centro' (2dfe05dc...) [1:1]
--   MI-CEN -> 'Filiale Milano Centro'  (c85f47da...) [1:1]
--   HS-HQ  -> 'Heuresys S.r.l.' root   (96f284d6...) [3 referencing OUs, root included]
--   Advanced OU resolved at run-time via organization_unit_metadata->>'legacy_org_unit_id' (deterministic).
-- NOT imported (terminal residue, see mig 000106): the 10 RTL locations referenced by no org_unit —
--   a duplicate pre-existing legacy seed series (BG01~BG-CEN, BS01~BS-CEN, MI01~MI-CEN, HQ~MI-HQ,
--   OPS~MI-OPS + TEST-AUTH-LOC etc.); dead data, the live series is the one referenced by the org chart.
-- Field notes: sys_branches has NO name column -> location name in branch_metadata; legacy country
--   'ITA' (char(3)) -> 'IT' (char(2)); legacy province -> branch_region_code; lat/long are NULL in
--   legacy for all 6 -> omitted (jsonb_strip_nulls).
-- Sibling pattern: 49_succession_pools_candidates.sql. Baked VALUES (CI-reproducible). Idempotent:
--   ON CONFLICT (branch_tenant_id, branch_code) DO NOTHING.
-- Expected landed: 6 branches (5 RTL + 1 HS), 6 distinct anchor OUs, country_code 'IT' 6/6.
BEGIN;

WITH src(lid, vten, code, name, ltype, address, city, province, postal, phone, email, legacy_ou_lid) AS (VALUES
  ('e5b32537-4205-453d-af78-84c6e178cc0a','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','MI-HQ','Sede Centrale Milano','headquarters','Via Monte Rosa 91','Milano','MI','20149','+39 02 6291608','sede.centrale.milano@rtlbank.com','e289f5e3-03c5-4cc7-94f9-b526d29c1eda'),
  ('64cac264-a9fb-411a-aa78-4bb1a2530389','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','MI-OPS','Centro Operativo Assago','office','Via Milanofiori Nord','Assago','MI','20090','+39 02 4206789','centro.operativo.assago@rtlbank.com','3352bf9c-bfda-44a6-bbd5-d7dac84647f8'),
  ('54d30a65-31d8-4b8c-a9b1-717604d86f39','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','BG-CEN','Filiale Bergamo Centro','branch','Via XX Settembre 45','Bergamo','BG','24122','+39 02 6914335','filiale.bergamo.centro@rtlbank.com','59c17654-dba2-492d-b7d2-cbfed85e4e97'),
  ('99c26781-79ad-4348-bbb6-4ac3dadeb364','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','BS-CEN','Filiale Brescia Centro','branch','Corso Zanardelli 30','Brescia','BS','25121','+39 02 2519190','filiale.brescia.centro@rtlbank.com','2dfe05dc-d323-4493-8470-6ea4607d5ce4'),
  ('ab3db50c-e9a8-43bb-8ee7-22e116b9ec7d','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','MI-CEN','Filiale Milano Centro','branch','Piazza Duomo 1','Milano','MI','20121','+39 02 2113273','filiale.milano.centro@rtlbank.com','c85f47da-b5ed-4e83-8213-5846ddc878e8'),
  ('ae6239a0-8c31-4237-a03a-89449975f39c','8bc5bc59-f2d2-4a8a-882a-ea26ac367858','HS-HQ','Ufficio Milano Centrale','headquarters','Via Vittor Pisani 22','Milano','MI','20124','+39 02 6470157','ufficio.milano.centrale@heuresyssystem.com','96f284d6-1848-4190-b62f-368169122255')
)
INSERT INTO sys.sys_branches
  (branch_organization_unit_id, branch_tenant_id, branch_code, branch_address_line1,
   branch_city, branch_postal_code, branch_country_code, branch_region_code, branch_metadata)
SELECT ou.organization_unit_id, src.vten::uuid, src.code, src.address,
  src.city, src.postal, 'IT', src.province,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_location_id', src.lid, 'name', src.name, 'legacy_location_type', src.ltype,
    'anchor_rule', 'topmost-OU-of-referencing-group (Enzo D1=B, 2026-06-10)',
    'legacy_anchor_org_unit_id', src.legacy_ou_lid,
    'phone', src.phone, 'email', src.email))
FROM src
JOIN sys.sys_organization_units ou
  ON ou.organization_unit_metadata->>'legacy_org_unit_id' = src.legacy_ou_lid
 AND ou.organization_unit_tenant_id = src.vten::uuid
ON CONFLICT (branch_tenant_id, branch_code) DO NOTHING;

DO $post$
DECLARE n int; rtl int; hs int; ous int; cc int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_branches;
  SELECT count(*) INTO rtl FROM sys.sys_branches WHERE branch_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  SELECT count(*) INTO hs  FROM sys.sys_branches WHERE branch_tenant_id='8bc5bc59-f2d2-4a8a-882a-ea26ac367858';
  SELECT count(DISTINCT branch_organization_unit_id) INTO ous FROM sys.sys_branches;
  SELECT count(*) INTO cc FROM sys.sys_branches WHERE branch_country_code='IT';
  RAISE NOTICE '50_branches: branches=% (RTL=% HS=%) distinct_OUs=% country_IT=% (expect 6/5/1/6/6)', n, rtl, hs, ous, cc;
  IF n<>6 OR rtl<>5 OR hs<>1 OR ous<>6 OR cc<>6 THEN
    RAISE EXCEPTION '50_branches: count mismatch n=% rtl=% hs=% ous=% cc=%', n, rtl, hs, ous, cc;
  END IF;
END $post$;
COMMIT;
