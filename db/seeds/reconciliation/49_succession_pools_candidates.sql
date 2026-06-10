-- 49_succession_pools_candidates.sql — Wave-2/B-50 close: succession pools + candidates import (S982).
-- PM decisions (Enzo 2026-06-10, dossier B50_DEFER_UNBLOCK_PACKAGE.md + WAVE2_UNBLOCK_PACKAGE.md):
--   D2 = incumbent-anchor rule + CEO/CFO title-match. pool.position = PRIMARY/ACTIVE position of the
--   legacy incumbent, resolved at run-time via sys_users.user_external_code='LEGACY_EMP::'||employees.id (I14).
-- Sources (legacy heuresys_platform, extracted 2026-06-10):
--   succession_plans (13 = 10 RTL + 3 HS): 6 RTL + 1 HS (COO) have resolvable incumbents -> §1;
--     2 RTL without incumbent resolved by PM-signed title-match (CEO->POS-00000321 exact unique,
--     CFO->POS-00000384 Finance Director fuzzy unique, sign-off Enzo 2026-06-10) -> §2;
--     NOT imported: 'Branch Director Milano' + 'Head of Corporate Banking' (RTL, no incumbent, no title
--     match) and HS 'CEO & Founder' + 'CTO / Head of Product' (incumbents not present in advanced).
--   critical_roles (8 RTL, current_incumbent_id 8/8 resolvable) -> §3. NOTE: incumbent-anchor on
--     critical_roles lands on the incumbent's CURRENT position (leaf positions, e.g. CR 'Chief Financial
--     Officer' -> POS-00000343 Bank Teller) — known effect of the approved rule (dossier flagged the CRO
--     case); full provenance in metadata, reversible per-prefix LEGACY_CROLE::.
--   succession_candidates (36 linked = 30 RTL + 6 HS). FALSE FRIEND confirmed at DDL level:
--     succession_candidates.critical_role_id has FK -> succession_plans(id) (NOT critical_roles).
--     Imported: the 24 RTL candidates of the 8 pooled RTL plans + 1 HS candidate (COO plan, employee
--     e1000001 = DEACTIVATED user, enters with status CANDIDATE per decision). NOT imported: 6 RTL on the
--     2 unpooled plans; 4 HS on unpooled plans; 1 HS (2b1cc664) unresolved in advanced.
--   talent_pools (24) + talent_pool_members (40) = WON'T-DO (no position semantics) — see mig 000106.
-- Readiness mapping (decision D2): ready_now->READY_NOW, ready_1_year->READY_1_YEAR,
--   ready_2_years->READY_2_YEARS, ready_3_years|ready_3_5_years|development_needed->NOT_READY;
--   raw legacy value preserved in successor_candidate_metadata.legacy_readiness.
-- Sibling pattern: 47_predictionsml.sql. Data baked as VALUES (CI-reproducible). Idempotent:
--   ON CONFLICT (tenant, code) / (pool, user) DO NOTHING.
-- Expected landed: pools 17 (16 RTL + 1 HS; 15 anchor=incumbent + 2 anchor=title_match);
--   candidates 25 (24 RTL + 1 HS); readiness READY_1_YEAR=6 READY_2_YEARS=6 NOT_READY=13 READY_NOW=0;
--   the 8 LEGACY_CROLE:: pools have 0 candidates (legacy candidates link plans only) — expected.
BEGIN;

-- §1 — pools from succession_plans with resolvable incumbent (6 RTL + 1 HS), anchor=incumbent
WITH src(lid, vten, name, incumbent_lid, criticality) AS (VALUES
  ('834a49e5-94ac-47e6-84e1-a8462672f85a','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','CRO / Chief Risk Officer','b2df47f7-18bf-4ca0-9638-5de2ec762b8a','critical'),
  ('72f28538-ff35-4c35-8210-3121b81f8773','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','CTO / Chief Technology Officer','6e728c0a-400a-4fe3-ab2d-e9f662774313','critical'),
  ('15790259-3857-4a0f-a1d2-a34e858801a3','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of Compliance','f0d1f485-54a9-4032-ae22-f8a08a53c49f','critical'),
  ('d3795e2f-c0ac-4c10-bf2a-5bb97b7ee3ad','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of HR','282dfaaf-5489-401f-a898-c055d10c6b0b','high'),
  ('f7f43ef6-32b5-4ac5-8b34-69b0715fd7c2','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of Operations','f6c47756-6f84-461d-be5d-dd8a3a3c79f1','high'),
  ('5ebfc961-7cb6-403e-91d1-4d5660355ef1','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of Retail Banking','d9d32524-ba0b-450c-9dcf-1cd2a347d7a3','high'),
  ('86cc4619-84a5-451a-aa31-49d0876af0b2','8bc5bc59-f2d2-4a8a-882a-ea26ac367858','COO','84bea3db-1ba4-4485-8916-de85b55b12f6','medium')
)
INSERT INTO sys.sys_succession_pools
  (succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
   succession_pool_name, succession_pool_status, succession_pool_metadata)
SELECT src.vten::uuid, a.user_position_assignment_position_id,
  'LEGACY_SPLAN::'||src.lid, src.name, 'ACTIVE',
  jsonb_build_object('legacy_plan_id', src.lid, 'anchor', 'incumbent',
    'legacy_incumbent_employee_id', src.incumbent_lid, 'legacy_criticality', src.criticality,
    'source_table', 'succession_plans',
    'anchor_rule', 'incumbent PRIMARY/ACTIVE position (Enzo D2, 2026-06-10)')
FROM src
JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::'||src.incumbent_lid
JOIN sys.sys_user_position_assignments a
  ON a.user_position_assignment_user_id = u.user_id
 AND a.user_position_assignment_kind = 'PRIMARY'
 AND a.user_position_assignment_status = 'ACTIVE'
ON CONFLICT (succession_pool_tenant_id, succession_pool_code) DO NOTHING;

-- §2 — pools from succession_plans without incumbent, PM-signed title-match (2 RTL), anchor=title_match
WITH src(lid, vten, name, criticality, pos_code) AS (VALUES
  ('73e8a482-a537-4ec0-8405-951faaf703d8','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','CEO / Amministratore Delegato','critical','POS-00000321'),
  ('78d9a211-2c67-49a2-86cd-87136ca8c356','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','CFO / Direttore Finanziario','critical','POS-00000384')
)
INSERT INTO sys.sys_succession_pools
  (succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
   succession_pool_name, succession_pool_status, succession_pool_metadata)
SELECT src.vten::uuid, p.position_id,
  'LEGACY_SPLAN::'||src.lid, src.name, 'ACTIVE',
  jsonb_build_object('legacy_plan_id', src.lid, 'anchor', 'title_match',
    'title_match_position_code', src.pos_code, 'legacy_criticality', src.criticality,
    'source_table', 'succession_plans',
    'pm_signoff', 'Enzo 2026-06-10 (CEO exact unique; CFO->Finance Director fuzzy unique confirmed)')
FROM src
JOIN sys.sys_positions p
  ON p.position_code = src.pos_code
 AND p.position_tenant_id = src.vten::uuid
ON CONFLICT (succession_pool_tenant_id, succession_pool_code) DO NOTHING;

-- §3 — pools from critical_roles (8 RTL, incumbent 8/8), anchor=incumbent
WITH src(lid, vten, name, department, incumbent_lid, criticality, succession_status) AS (VALUES
  ('7c9beaf1-48e0-488d-8561-a31d44015eb6','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Chief Executive Officer','Executive','6c42d762-3a3d-44ad-9332-8e59fe25005c','Critical','developing'),
  ('f3d51a88-2148-4df3-9a17-abf5b174af58','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Chief Financial Officer','Finance','78a646d5-5766-4da3-9f54-678528718bc3','Critical','developing'),
  ('27db9655-2b97-44be-a1a1-efe7e059e548','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Chief Technology Officer','Technology','8713c03f-6045-4134-b29c-57986b6d6167','Critical','healthy'),
  ('8fd6a686-5ae9-49a1-93de-c99d86082158','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of Human Resources','HR','8b20fb79-f1fb-4e9f-85f7-5bb2dd97d57b','Medium','developing'),
  ('29756301-8856-4047-be5b-77c86f244069','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Head of Risk Management','Risk','b27ce900-25e2-4986-a811-55a7d46b6223','High','healthy'),
  ('bd6d6eff-fa0d-4d2f-b782-ed5091c1bda8','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','Senior Architect','Technology','4f56440d-53e2-4121-89f9-6a9038aa9d1e','Medium','developing'),
  ('e5d9b998-92d4-4bb0-9335-a9b620249080','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','VP of Operations','Operations','77354cdf-95b7-40cb-a884-f2b219562b75','High','healthy'),
  ('7f2ec55a-70d6-486c-a9a6-968594f2aeff','86ba7a65-217f-48ba-8ce5-5c09b40a66b0','VP of Sales','Sales','b951699e-08d7-443e-b43b-d4e777115532','High','developing')
)
INSERT INTO sys.sys_succession_pools
  (succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
   succession_pool_name, succession_pool_status, succession_pool_metadata)
SELECT src.vten::uuid, a.user_position_assignment_position_id,
  'LEGACY_CROLE::'||src.lid, src.name, 'ACTIVE',
  jsonb_build_object('legacy_critical_role_id', src.lid, 'anchor', 'incumbent',
    'legacy_incumbent_employee_id', src.incumbent_lid, 'legacy_criticality', src.criticality,
    'legacy_department', src.department, 'legacy_succession_status', src.succession_status,
    'source_table', 'critical_roles',
    'anchor_rule', 'incumbent PRIMARY/ACTIVE position (Enzo D2, 2026-06-10); position is the incumbent''s current position, not a title-matched executive position')
FROM src
JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::'||src.incumbent_lid
JOIN sys.sys_user_position_assignments a
  ON a.user_position_assignment_user_id = u.user_id
 AND a.user_position_assignment_kind = 'PRIMARY'
 AND a.user_position_assignment_status = 'ACTIVE'
ON CONFLICT (succession_pool_tenant_id, succession_pool_code) DO NOTHING;

-- §4 — candidates of the pooled plans (24 RTL + 1 HS). Pool resolved via LEGACY_SPLAN:: code;
--   person via LEGACY_EMP:: (I14). Tenant inherited from the pool row.
WITH src(lid, plan_lid, emp_lid, readiness, strengths, devneeds, rank_order) AS (VALUES
  -- CEO / Amministratore Delegato (plan 73e8a482)
  ('3fde149d-faba-4113-a437-f6bae01b998d','73e8a482-a537-4ec0-8405-951faaf703d8','e385112d-9e2b-45cb-bded-fb578a8329ba','ready_2_years','Performance review 5.0/5 sostenuta. Bank manager con esperienza filiale capofila. Forte network interno cross-divisione, esposizione a clienti high-value retail e mid-corporate. Comunicazione efficace verso stakeholder esterni (banche corrispondenti, Banca d''Italia).','Esposizione governance board level (CdA, comitato esecutivo). Familiarità con framework regolamentari Basel III/CET1 a livello strategico. Lateral exposure a CFO/CRO scope (P&L group, RAF). Visione strategica corporate banking + treasury.',1),
  ('bcd10c99-2cb8-43ea-b71f-dbe171bcfe19','73e8a482-a537-4ec0-8405-951faaf703d8','b128dd43-aca7-4b14-893d-c527b93fb45a','ready_3_5_years','Performance review 4.98/5. Bank manager con track record di turn-around filiale (NPL ratio ridotto del 22% in 18m). Capacità di gestione situazioni complesse, leadership in contesti pressione regolamentare.','Profondità strategica multi-divisione (oggi limitato a retail). Esposizione M&A + capital markets. Network esterno (associazioni ABI, gruppi di lavoro Banca d''Italia). Governance del rischio operativo a livello group.',2),
  ('118b8101-3c8a-43bb-9f85-8727f312576e','73e8a482-a537-4ec0-8405-951faaf703d8','7b6a0d90-8361-439d-87f6-cea12d619235','ready_3_5_years','Performance review 4.97/5. Bank manager di esperienza con eccellente capacità di people management (engagement team al 92mo percentile). Background analitico solido (laurea STEM + master finanza).','Esperienza operativa al di fuori del retail. Visibilità verso il board. Comprensione integrata del cost-income e cost-of-risk a livello consolidato. Network internazionale (correspondent banking).',3),
  -- CFO / Direttore Finanziario (plan 78d9a211)
  ('66477ae8-fdc8-491d-a007-cba7b0918b1d','78d9a211-2c67-49a2-86cd-87136ca8c356','9dd2208b-bbaf-49e2-b3b4-02b1a39841fb','ready_2_years','Performance review 4.15/5. Financial analyst senior con expertise in IFRS 9 + analisi credit risk. Solida formazione contabile (CDA-IT certification) e ottima conoscenza Basel III standardized approach.','Esposizione treasury e capital management (LCR/NSFR). Visione consolidata P&L gruppo. Network con auditor esterni e investor relations. Comprensione dei processi MIFID II e reporting CONSOB.',1),
  ('bf0b4310-6c51-4933-a188-8cc59b5553f8','78d9a211-2c67-49a2-86cd-87136ca8c356','9f222622-83fd-4da7-8398-441c011618bc','ready_3_5_years','Performance review 4.07/5. Financial analyst con focus su pianificazione strategica e budgeting. Forte capacità modeling + scenario analysis (DCF, stress testing).','Leadership management (team < 5 oggi). Esposizione frontline business divisions. Comunicazione verso ALCO e comitato rischi. Public speaking analyst day.',2),
  ('b4473742-84a0-426d-8aae-eaa0103fe7ab','78d9a211-2c67-49a2-86cd-87136ca8c356','be743c83-98fb-495f-80cb-339471da0071','ready_3_5_years','Performance review 4.06/5. Financial analyst con esposizione cross-funzionale (controllo gestione + tesoreria). Background quantitativo solido.','Leadership maturity. Profondità su capital adequacy ratios consolidati. Network esterno con CFO peer companies. Tax planning ottimization Italian context.',3),
  -- CRO / Chief Risk Officer (plan 834a49e5)
  ('741a4920-bb50-4ca8-80b6-a54cc5ca1949','834a49e5-94ac-47e6-84e1-a8462672f85a','14238377-9dbd-4978-bddb-35d0f42ddbf3','ready_1_year','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('d6e95bdd-69d6-4c5e-b453-830ec7f21848','834a49e5-94ac-47e6-84e1-a8462672f85a','70aae718-bdb5-4ea1-ae2b-4a94b4335ac8','ready_3_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('47496c9a-309a-49e8-933f-9e36388766a9','834a49e5-94ac-47e6-84e1-a8462672f85a','54e9d401-9baf-4204-9d8f-33f8830ef932','ready_2_years','Performance review 5.0/5. Risk analyst senior con specializzazione credit risk + operational risk. Lavora regolarmente con framework Basel III standardized + foundation IRB.','Esposizione market risk + liquidity risk. Strategic dialogue con CEO/CFO su risk appetite framework. Comunicazione a stakeholder esterni (rating agencies, regulator). People management > 10 risorse.',3),
  -- CTO / Chief Technology Officer (plan 72f28538)
  ('ddb21c33-f179-4359-a85a-85c8efed569a','72f28538-ff35-4c35-8210-3121b81f8773','1785bd08-9fa3-4ce0-a05b-2326f2ab9856','ready_3_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('5ab7685d-eac8-4af7-9e01-8d2692e888de','72f28538-ff35-4c35-8210-3121b81f8773','282dfaaf-5489-401f-a898-c055d10c6b0b','ready_1_year','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('e250689c-daa3-499c-81f4-76c524c5e8a1','72f28538-ff35-4c35-8210-3121b81f8773','6a0f7d31-037a-4f4c-88f9-77204c621415','ready_2_years','Performance review 4.13/5. Software Developer senior con expertise full-stack (Java + cloud AWS) + esperienza pratica con sistemi core banking. Forte cultura DevOps + sicurezza applicativa.','Esposizione governance IT a livello group. Familiarità con frameworks regolamentari DORA + EBA Guidelines on ICT. People management cross-team. Vendor management (T24, SAP).',3),
  -- Head of Compliance (plan 15790259)
  ('405caaa3-445c-4ddf-b064-f63975869683','15790259-3857-4a0f-a1d2-a34e858801a3','46a938e9-8785-4108-943d-e390ff324259','ready_1_year','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('c237d606-3eb0-4eda-ad7a-65f5cec42d42','15790259-3857-4a0f-a1d2-a34e858801a3','b9960ac4-61c5-4691-b6cd-ddb76d116c17','ready_1_year','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('f9777c40-cf60-4146-8164-fbab412a6d85','15790259-3857-4a0f-a1d2-a34e858801a3','e22a956e-d122-49f4-a753-21d118be4fe4','ready_1_year','Performance review 5.0/5. Compliance officer senior con esposizione completa AML/CFT, MiFID II, GDPR. Track record di audit Banca d''Italia clean negli ultimi 3 cicli ispettivi.','Visibilità a livello board (oggi limitato al comitato rischi). Capacità di public speaking esterno (conference, working groups ABI). Network con regulator (DG-Vigilanza Banca d''Italia, MEF).',3),
  -- Head of HR (plan d3795e2f)
  ('fcdcf841-8f1f-4c6e-a627-8b76fe004e4e','d3795e2f-c0ac-4c10-bf2a-5bb97b7ee3ad','a711c494-0181-4e6d-9fec-066b32dcb790','ready_3_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('fa5abfb2-2999-44ba-af6a-a81d945c7216','d3795e2f-c0ac-4c10-bf2a-5bb97b7ee3ad','a3965358-2146-4eee-940e-450cea225879','ready_1_year','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('fa01b7cc-6b73-4ae2-8bb7-8e6b01455d46','d3795e2f-c0ac-4c10-bf2a-5bb97b7ee3ad','60f89c9b-5846-49da-8d1f-3234289ba9b3','ready_3_5_years','Performance review 4.03/5. Bank teller senior con esperienza filiale + retail banking. Forte cultura customer-centric + capacità di gestione situazioni complesse cliente.','Transizione HR-specific. Conoscenza framework CCNL credito + sindacati banking. Comprensione organizational design + workforce planning. Network HR community.',3),
  -- Head of Operations (plan f7f43ef6)
  ('0cfcbc23-3817-4b81-974f-12b8a59970e6','f7f43ef6-32b5-4ac5-8b34-69b0715fd7c2','3108bf17-8228-439f-b5a8-2370286ef5e8','ready_2_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('a5eef416-0c28-43a9-a964-a20028bc673a','f7f43ef6-32b5-4ac5-8b34-69b0715fd7c2','33216231-635c-4481-b005-e1bc6407d894','ready_3_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('d11a0386-d181-4f20-b7ff-1b5da69c6a17','f7f43ef6-32b5-4ac5-8b34-69b0715fd7c2','da391a54-735f-4672-a91a-f95182c6bf8b','ready_3_5_years','Performance review 4.0/5. Back office specialist senior con esposizione completa operations chain (payments, settlement, reconciliation). Conoscenza profonda di SWIFT GPI + TARGET2 + Eurosystem.','Strategic process re-engineering. Vendor management (core banking provider). Esposizione DORA + cyber-resilience operational. People management > 15 risorse + cross-site coordination.',3),
  -- Head of Retail Banking (plan 5ebfc961)
  ('f680296d-111b-401d-8916-d0093bb24396','5ebfc961-7cb6-403e-91d1-4d5660355ef1','106c1da7-3071-4aa7-9a9f-bb4db9626655','ready_2_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('0ef48469-9a30-4f24-b765-38d8c8761f39','5ebfc961-7cb6-403e-91d1-4d5660355ef1','ba10692e-f6a4-45e5-b542-8c3a5e964a08','ready_3_years','Potenziale identificato. Performance consistente nel ruolo attuale.','Necessità di esposizione a responsabilità più ampie.',1),
  ('e10aad98-2ff1-4c0d-9c9f-773636a95c95','5ebfc961-7cb6-403e-91d1-4d5660355ef1','00ab77d2-eb90-4af1-b23a-f84ac02a710f','ready_3_5_years','Performance review 5.0/5. Securities dealer con esposizione retail investment + advisory mass-affluent. Forte cultura cliente + capacità di gestione product mix (fondi, ETF, polizze).','Leadership di rete commerciale (oggi individual contributor). Visione strategica multi-channel (filiale + digital). Conoscenza operations + IT banking. Esposizione regulator framework integrato.',3),
  -- COO (HS plan 86cc4619) — employee e1000001 is a DEACTIVATED advanced user: enters per decision D2
  --   (the other COO candidate 2b1cc664 has no advanced user -> excluded, see header)
  ('22a35bcf-a507-4d7f-b8e6-55af36848c88','86cc4619-84a5-451a-aa31-49d0876af0b2','e1000001-0000-0000-0000-000000000001','development_needed',NULL,NULL,2)
)
INSERT INTO sys.sys_successor_candidates
  (successor_candidate_pool_id, successor_candidate_tenant_id, successor_candidate_user_id,
   successor_candidate_status, successor_candidate_readiness_level, successor_candidate_metadata)
SELECT sp.succession_pool_id, sp.succession_pool_tenant_id, u.user_id, 'CANDIDATE',
  CASE src.readiness
    WHEN 'ready_now'     THEN 'READY_NOW'
    WHEN 'ready_1_year'  THEN 'READY_1_YEAR'
    WHEN 'ready_2_years' THEN 'READY_2_YEARS'
    ELSE 'NOT_READY'  -- ready_3_years | ready_3_5_years | development_needed (decision D2)
  END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_candidate_id', src.lid, 'legacy_plan_id', src.plan_lid,
    'legacy_employee_id', src.emp_lid, 'legacy_readiness', src.readiness,
    'strengths', src.strengths, 'development_needs', src.devneeds, 'rank_order', src.rank_order))
FROM src
JOIN sys.sys_succession_pools sp ON sp.succession_pool_code = 'LEGACY_SPLAN::'||src.plan_lid
JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::'||src.emp_lid
ON CONFLICT (successor_candidate_pool_id, successor_candidate_user_id) DO NOTHING;

DO $post$
DECLARE pools int; rtl int; hs int; inc int; tm int; cand int; r1 int; r2 int; nr int; rn int; xten int;
BEGIN
  SELECT count(*) INTO pools FROM sys.sys_succession_pools;
  SELECT count(*) INTO rtl FROM sys.sys_succession_pools WHERE succession_pool_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  SELECT count(*) INTO hs  FROM sys.sys_succession_pools WHERE succession_pool_tenant_id='8bc5bc59-f2d2-4a8a-882a-ea26ac367858';
  SELECT count(*) INTO inc FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'anchor'='incumbent';
  SELECT count(*) INTO tm  FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'anchor'='title_match';
  SELECT count(*) INTO cand FROM sys.sys_successor_candidates;
  SELECT count(*) INTO r1 FROM sys.sys_successor_candidates WHERE successor_candidate_readiness_level='READY_1_YEAR';
  SELECT count(*) INTO r2 FROM sys.sys_successor_candidates WHERE successor_candidate_readiness_level='READY_2_YEARS';
  SELECT count(*) INTO nr FROM sys.sys_successor_candidates WHERE successor_candidate_readiness_level='NOT_READY';
  SELECT count(*) INTO rn FROM sys.sys_successor_candidates WHERE successor_candidate_readiness_level='READY_NOW';
  SELECT count(*) INTO xten FROM sys.sys_successor_candidates c
    JOIN sys.sys_succession_pools sp ON sp.succession_pool_id=c.successor_candidate_pool_id
    WHERE sp.succession_pool_tenant_id <> c.successor_candidate_tenant_id;
  RAISE NOTICE '49_succession: pools=% (RTL=% HS=%; incumbent=% title_match=%) candidates=% (R1Y=% R2Y=% NR=% RN=%) cross-tenant=%',
    pools, rtl, hs, inc, tm, cand, r1, r2, nr, rn, xten;
  IF pools<>17 OR rtl<>16 OR hs<>1 OR inc<>15 OR tm<>2 THEN
    RAISE EXCEPTION '49_succession: pool count mismatch pools=% rtl=% hs=% inc=% tm=%', pools, rtl, hs, inc, tm;
  END IF;
  IF cand<>25 OR r1<>6 OR r2<>6 OR nr<>13 OR rn<>0 THEN
    RAISE EXCEPTION '49_succession: candidate count mismatch cand=% r1=% r2=% nr=% rn=%', cand, r1, r2, nr, rn;
  END IF;
  IF xten<>0 THEN RAISE EXCEPTION '49_succession: % cross-tenant candidates', xten; END IF;
END $post$;
COMMIT;
