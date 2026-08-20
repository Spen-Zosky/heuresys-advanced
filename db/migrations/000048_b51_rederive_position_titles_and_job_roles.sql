-- @migrate: once
--
-- PERCHE' `once` (#223 F2, rilievo F3-09 — 2026-08-20). Misurata sul vivo con
-- `duration_ms` di sys_schema_migrations: questa e' la migrazione PIU' LENTA
-- della catena, 79.781 ms — quattro volte la seconda, e da sola piu' di tutto il
-- resto messo insieme. La catena si ri-applica per intero a ogni deploy, quindi
-- quegli 80 secondi si pagavano ogni volta per ri-derivare un risultato gia'
-- ottenuto il 2026-06-01.
--
-- Non porta guardie vive, ed e' la condizione che rende lecito marcarla: l'unica
-- `RAISE EXCEPTION` verifica che il blocco di 162 righe incorporato nel file non
-- sia stato troncato in scrittura — controlla il FILE, non lo stato del
-- database. Il `RAISE NOTICE` finale e' informativo e non blocca nulla.
--
-- Su un database nuovo gira comunque: `once` salta solo quando l'impronta
-- coincide con quella registrata. La CI from-zero non e' toccata.
-- 000048_b51_rederive_position_titles_and_job_roles.sql
-- B-51 (2026-06-01): re-derive the 162 RTL/Heuresys position_title and wire
-- position_job_role_id from the REAL legacy profession (employees.job_title), employee-centric.
--
-- DOCTRINE (ADR-0024 / I14): the person is legacy `employees`, not `users`. Each v5 position
-- already carries its incumbent's legacy id at position_metadata->>'legacy_employee_id'
-- (162/162 present, verified 162/162 exact join). We join that to legacy employees.job_title
-- to obtain the real profession. The previous P2 proposal was INVALIDATED (it keyed the
-- pre-000046 user-centric graph); this is re-derived from zero on the post-000046 graph.
--
-- SOURCE: db/seeds/rtl-rebuild/extracted/employees.csv (gitignored generated extract,
-- synthetic no-PII data per ADR-0023). The legacy_employee_id -> (title, role) map is baked as
-- static rows below so the migration is self-contained and CI-reproducible (no \copy, no
-- external-file dependency at apply time). Regenerate via
-- db/seeds/rtl-rebuild/11_rederive_b51_titles_roles.py.
--
-- The 7 coarse v5 buckets (Compliance Officer / Risk Analyst / Financial Analyst / Bank Manager
-- / Bank Teller / Investment Advisor / Security Specialist) are replaced by the 25 real
-- fine-grained titles (e.g. Security Specialist -> Securities Dealer; the Compliance Officer
-- bucket splits into Compliance Officer / Back Office Specialist / Payment Specialist). The
-- coarse bucket stays in position_metadata.legacy_position_text for lineage.
--
-- 25 new job_roles use the distinctive GLOBAL code prefix RTL-ROLE-<SLUG> (0 pre-existing,
-- verified) with job_role_family_id = NULL and job_role_seniority_level = NULL (evidence-only:
-- the legacy data carries no reliable family/seniority signal -- no guessing). The 202
-- pre-existing roles (incl. 91 corrupt OLDDB::) are intentionally NOT touched (P3/B-50 scope).
--
-- IDEMPOTENT: roles INSERT ... ON CONFLICT (job_role_code) DO NOTHING; position UPDATEs guarded
-- by IS DISTINCT FROM. Second run = 0 mutations = empty pg_dump diff. Applied by migrate.sh
-- under `psql -1 -f` (single transaction); the ON COMMIT DROP temp table is scoped to it.

CREATE TEMP TABLE _b51_derivation (
  legacy_employee_id text NOT NULL,
  new_title          text NOT NULL,
  role_code          text NOT NULL,
  raw_legacy_title   text NOT NULL
) ON COMMIT DROP;

INSERT INTO _b51_derivation (legacy_employee_id, new_title, role_code, raw_legacy_title) VALUES
  ('00ab77d2-eb90-4af1-b23a-f84ac02a710f', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('00b9c9e7-d699-4e43-8ad9-e2f53f653ace', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('02a7ea68-eecc-46e4-9793-27a1a3ef7d60', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('0917af5f-bf43-4621-92ad-c56af51a4aab', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('0aea4521-8d35-4df5-9aa5-d62ca7d2e984', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('0c055a67-9d88-47af-98a6-d07bc779fc26', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('10457330-94a4-4b14-b569-8f8c88388ef1', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('106c1da7-3071-4aa7-9a9f-bb4db9626655', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('108a2057-f80a-4344-9c9c-a18acd9b3b6d', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('11f54f90-7b36-45f4-9dd4-2a7067ae427a', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('126a030b-623c-4e52-859c-477af1fa7461', 'Payment Specialist', 'RTL-ROLE-PAYMENT-SPECIALIST', 'Payment Specialist'),
  ('14238377-9dbd-4978-bddb-35d0f42ddbf3', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('1615995b-ec9d-42fe-86e4-a74268670805', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('1785bd08-9fa3-4ce0-a05b-2326f2ab9856', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('1d5aab00-8fc9-4db9-9818-6e779a75cec8', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('1e40fe3e-ccc5-4bbf-81d5-cd9f44a53603', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('1ecb093a-0ace-4d9e-8588-b7845b9003b5', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('1ff05c57-4065-42fd-a781-f57a00a0c4c1', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('2038c99d-cf59-4f51-a803-6d92a0ace21d', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('282dfaaf-5489-401f-a898-c055d10c6b0b', 'HR Director', 'RTL-ROLE-HR-DIRECTOR', 'HR Director'),
  ('28f92d04-1065-4fb6-8682-955d6f5aa311', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('2b010639-575d-4051-9b43-0978f681e59a', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('2b1cc664-5631-45d8-a82d-cc05d9b028f3', 'Head of Product', 'RTL-ROLE-HEAD-OF-PRODUCT', 'Head of Product'),
  ('2b814654-8bd7-486d-b23e-685d06e237e3', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('2d2a75ef-341b-48b4-bf27-87f64877eb63', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('2d50031e-339f-4f27-8ec0-43c7111856d9', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('2eeecd88-f7c0-4594-945b-495e2d86a0f5', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('2fa1439f-c201-4e3f-b584-41c9378c9ba6', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('2fe8ae94-860b-41a5-a9f9-0effb8c5e52f', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('30c36ff1-202a-4d56-916c-78e7371f1dbe', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('3108bf17-8228-439f-b5a8-2370286ef5e8', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('33216231-635c-4481-b005-e1bc6407d894', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('34bfcbc8-3675-4e80-81d5-d93a417ba100', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('35273bb1-e2be-4ead-a829-8fe0f803c637', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('35738460-31e6-4390-b2b6-26f6fefb9af0', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('3847c0c3-f744-4cbf-a01b-5af039ec8ea5', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d', 'Operations Director', 'RTL-ROLE-OPERATIONS-DIRECTOR', 'Operations Director'),
  ('3c7681cb-6ad7-41dc-b91a-c244aa069a16', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('4056dac6-0cf9-40a7-a502-46cbb9d5e41d', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('40fc1fbc-0066-47f2-844b-62d9184bdaa8', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('46a938e9-8785-4108-943d-e390ff324259', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('493c20ad-2130-47ba-b285-003bf180b9b6', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('49d87745-c543-4788-ba81-ac0435391bce', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('4cc2dc19-f2cd-4fcb-b757-52477cfbdda8', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('4d96136f-0586-4444-bee5-67128b0f09af', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('4dc6f190-c6a6-4e2a-8536-0115ebcda256', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('4f56440d-53e2-4121-89f9-6a9038aa9d1e', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('507637ff-9102-439d-ab19-a27fb261a134', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('51e989a2-0266-4c70-abae-1af8e742fe42', 'Chief Risk Officer', 'RTL-ROLE-CHIEF-RISK-OFFICER', 'Chief Risk Officer'),
  ('54e9d401-9baf-4204-9d8f-33f8830ef932', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('56aae07f-23a4-410d-bf60-ee1d426a7e30', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('56b6adff-98a4-4d51-9c27-2c3db087b151', 'Back Office Specialist', 'RTL-ROLE-BACK-OFFICE-SPECIALIST', 'Back Office Specialist'),
  ('584395b7-a653-4792-b740-ec72469f9f3d', 'CEO & Founder', 'RTL-ROLE-CEO-FOUNDER', 'CEO & Founder'),
  ('5919bd6f-fe08-4681-a85c-d74967c415eb', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('5b219dbc-6d00-48c9-8b72-55111564bbca', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('5c50a8cc-da3c-4a4e-a8f9-96f221f299fe', 'CEO', 'RTL-ROLE-CEO', 'CEO'),
  ('5d1b4efb-ced7-4332-b513-400f3cc9e1c6', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('5d6d204b-1845-4fe4-8f31-2c2484a8d4f0', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('60f89c9b-5846-49da-8d1f-3234289ba9b3', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('61a03edb-fa59-4f41-9430-076d85d7f8d8', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('654d4ba2-6322-46f5-8a56-91057df6b8c9', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('665df87e-584e-4a82-aec8-2102037ddf9f', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('66faddef-45c1-42ba-b821-32b381e6f810', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('6a01293e-5b44-4d56-ae60-759ebaefd723', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('6a0f7d31-037a-4f4c-88f9-77204c621415', 'Software Developer', 'RTL-ROLE-SOFTWARE-DEVELOPER', 'Software Developer'),
  ('6c42d762-3a3d-44ad-9332-8e59fe25005c', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('6e728c0a-400a-4fe3-ab2d-e9f662774313', 'IT Director', 'RTL-ROLE-IT-DIRECTOR', 'IT Director'),
  ('6eec8128-9c53-4a5b-bc5b-398c17ce2482', 'Back Office Specialist', 'RTL-ROLE-BACK-OFFICE-SPECIALIST', 'Back Office Specialist'),
  ('6f0daf48-185a-42fe-98b3-b6ce4664d45a', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('6f4e0b48-3838-48f9-a8f2-3859231288ce', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('70aae718-bdb5-4ea1-ae2b-4a94b4335ac8', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('71e9b421-63e3-47ec-bbb0-4b6f66c7a784', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('73d9fb1b-24fb-49f6-9174-f405b2b68c06', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('74b966d2-e5ac-4528-acc4-a6a21d24b5c5', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('767eca57-e24a-4f28-b322-19d60eb58513', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('77354cdf-95b7-40cb-a884-f2b219562b75', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('77454e5d-3891-43b1-8967-812bd3da0bdc', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('78a646d5-5766-4da3-9f54-678528718bc3', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('7a39720d-6dc5-43df-880f-64f780c3577c', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('7a532e80-0842-4bd3-adcc-03c58efcbd4c', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('7b6a0d90-8361-439d-87f6-cea12d619235', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('7e7d910b-361f-493a-b599-98486250ea72', 'Software Developer', 'RTL-ROLE-SOFTWARE-DEVELOPER', 'Software Developer'),
  ('7f370dd7-61b6-4698-96e7-2f00ab6559fd', 'System Administrator', 'RTL-ROLE-SYSTEM-ADMINISTRATOR', 'System Administrator'),
  ('80ec2dc4-337c-4cdf-bda6-1bc16fab393c', 'System Administrator', 'RTL-ROLE-SYSTEM-ADMINISTRATOR', 'System Administrator'),
  ('81452b32-fd7e-4f14-b153-fa60aa070301', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('81560a64-e671-4864-8e97-653063206c34', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('83ecd1ae-a98a-4270-8867-4093d8d01dce', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('8482512a-e1e7-4a40-ae4d-ef3aac45cebb', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('84bea3db-1ba4-4485-8916-de85b55b12f6', 'COO', 'RTL-ROLE-COO', 'COO'),
  ('8585190e-a0ee-444e-8e7b-d9508dfb5b74', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('868bff72-1e31-471e-83c4-d4f2b264338e', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('8713c03f-6045-4134-b29c-57986b6d6167', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('8a87d077-214e-4e19-903c-65fb862c3f55', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('8b20fb79-f1fb-4e9f-85f7-5bb2dd97d57b', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('8b5b5b12-2f31-4060-9d66-91aaceb1b823', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('8c01a821-cba1-440d-9f94-8c08c5012c46', 'Software Developer', 'RTL-ROLE-SOFTWARE-DEVELOPER', 'Software Developer'),
  ('8cdc325d-5896-492b-bb3f-4a8258c41090', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('941f8fcc-0695-4e52-a1ee-7e640726d6bc', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('952540df-3f4f-4ad8-8c27-6cd54b014c57', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('95c174f8-ce5d-49da-b5b7-97d3722226de', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('96eb2aab-0374-42f1-ad17-2b3d284beb9a', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('9b6aa832-8277-4c8b-9778-e15dc3fc46e0', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('9c9c4243-7a56-4b5f-a222-549aaf82885b', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('9dd2208b-bbaf-49e2-b3b4-02b1a39841fb', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('9f222622-83fd-4da7-8398-441c011618bc', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('a3965358-2146-4eee-940e-450cea225879', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('a5c62382-a83d-46ba-9a0f-cd766e7618fa', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('a61b38c2-7382-408b-8f45-98268c57997f', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('a67decd5-763d-4ad4-b9b4-93b1dbb5c003', 'Back Office Specialist', 'RTL-ROLE-BACK-OFFICE-SPECIALIST', 'Back Office Specialist'),
  ('a711c494-0181-4e6d-9fec-066b32dcb790', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('a9355c71-a30c-44c6-8d64-0ed6cdf2bb0c', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('ab5d08d4-327a-4c17-b9eb-0a8e647d5312', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('ac29b238-e303-4564-81de-de87f4db916e', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('ac8e29fd-dfa8-44ea-a702-b3fe71eaabaf', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('aca67c77-e499-46cf-833e-9a8fd2db9923', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('adf224d3-da12-4eba-a016-f7dc1bcce48f', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('adf42752-4a76-4ce7-9bb2-c3df8578e235', 'Payment Specialist', 'RTL-ROLE-PAYMENT-SPECIALIST', 'Payment Specialist'),
  ('b01d05cc-3ffe-4146-83d3-7022662bf556', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('b0d5d8ab-27e8-443e-8c9b-72f121f2d549', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('b128dd43-aca7-4b14-893d-c527b93fb45a', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('b27ce900-25e2-4986-a811-55a7d46b6223', 'Software Developer', 'RTL-ROLE-SOFTWARE-DEVELOPER', 'Software Developer'),
  ('b2df47f7-18bf-4ca0-9638-5de2ec762b8a', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('b382b141-28d7-4708-b60d-c5ac2bf9e8e7', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('b4504691-95af-40b8-ae8a-12c3a2e362f0', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('b951699e-08d7-443e-b43b-d4e777115532', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('b9960ac4-61c5-4691-b6cd-ddb76d116c17', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('ba10692e-f6a4-45e5-b542-8c3a5e964a08', 'Back Office Specialist', 'RTL-ROLE-BACK-OFFICE-SPECIALIST', 'Back Office Specialist'),
  ('bd9be51b-a4d4-4c2a-be8c-065806ce0c79', 'IT Director', 'RTL-ROLE-IT-DIRECTOR', 'IT Director'),
  ('be743c83-98fb-495f-80cb-339471da0071', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('be75abce-7780-496d-a8a6-9317d046e19a', 'Payment Specialist', 'RTL-ROLE-PAYMENT-SPECIALIST', 'Payment Specialist'),
  ('bf084fb3-069a-4110-8f28-93845e3487ff', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('bf65cb1c-5990-4b6d-9c16-9bc84d4d9c10', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('bff71948-22ba-4c44-a9ac-b340c5afa423', 'Line Manager - Operations', 'RTL-ROLE-LINE-MANAGER-OPERATIONS', 'Line Manager - Operations'),
  ('c336b889-bcba-4097-9fa3-3995ca52578a', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('c550cecf-0a3d-4b06-9578-39594c3a7229', 'HR Manager', 'RTL-ROLE-HR-MANAGER', 'HR Manager'),
  ('c9587106-38ed-441a-8b2e-216bbf214dd5', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('cb4dff9a-9615-47c4-a6ee-4f11f8570264', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('cc9acb65-bb71-418f-96b1-2711a8ebd69b', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('ce1347e1-4487-4feb-b8e1-b42ea63e5a4f', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('d00a8626-ff0f-4d2f-93e9-02aa81fbec12', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('d1073ae0-43fb-44d7-9eb4-40a0e920c669', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('d280d84f-205c-48b5-88b6-47614929f68f', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('d3c4200a-8a73-42aa-b330-7337881cc697', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('d5151b61-9d0b-496f-bbed-8923e9518ef7', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('d920a8d0-1270-413d-a1a8-bb304493cbc2', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('d9d32524-ba0b-450c-9dcf-1cd2a347d7a3', 'Retail Director', 'RTL-ROLE-RETAIL-DIRECTOR', 'Retail Director'),
  ('da391a54-735f-4672-a91a-f95182c6bf8b', 'Back Office Specialist', 'RTL-ROLE-BACK-OFFICE-SPECIALIST', 'Back Office Specialist'),
  ('dc04d150-a251-45b3-86c7-24fcd38ecda7', 'Bank Teller', 'RTL-ROLE-BANK-TELLER', 'Bank teller'),
  ('de687489-65a5-4fb4-ac1a-ec0fb8d54967', 'Investment Advisor', 'RTL-ROLE-INVESTMENT-ADVISOR', 'Investment advisor'),
  ('e1000001-0000-0000-0000-000000000001', 'Tenant Owner', 'RTL-ROLE-TENANT-OWNER', 'Tenant Owner'),
  ('e22a956e-d122-49f4-a753-21d118be4fe4', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('e385112d-9e2b-45cb-bded-fb578a8329ba', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('e98d47b0-9047-411e-9162-649738bfc018', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('eebd9803-be31-4f3e-87b2-b0b7d1508c72', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('f0d1f485-54a9-4032-ae22-f8a08a53c49f', 'Compliance Officer', 'RTL-ROLE-COMPLIANCE-OFFICER', 'Compliance officer'),
  ('f6325909-23c3-4f9b-88c1-0372c43950d4', 'Securities Dealer', 'RTL-ROLE-SECURITIES-DEALER', 'Securities dealer'),
  ('f6c47756-6f84-461d-be5d-dd8a3a3c79f1', 'Operations Director', 'RTL-ROLE-OPERATIONS-DIRECTOR', 'Operations Director'),
  ('f92b74ef-79bb-4eeb-8f78-81bebbe91c24', 'Risk Analyst', 'RTL-ROLE-RISK-ANALYST', 'Risk analyst'),
  ('fb4977fb-3aff-4112-b6c1-fa69bb920728', 'Financial Analyst', 'RTL-ROLE-FINANCIAL-ANALYST', 'Financial analyst'),
  ('fcd0f8be-2760-437c-a0ac-4abb2e040b7a', 'Finance Director', 'RTL-ROLE-FINANCE-DIRECTOR', 'Finance Director'),
  ('fd7210b5-11af-47d4-8a56-f23610bef72d', 'Bank Manager', 'RTL-ROLE-BANK-MANAGER', 'Bank manager'),
  ('ffa50514-b899-44ce-b5f6-43f5fe9f3a01', 'Head of Commercial Banking', 'RTL-ROLE-HEAD-OF-COMMERCIAL-BANKING', 'Head of Commercial Banking');

-- Fail loud if the baked block was truncated on write (defensive integrity gate).
DO $$
DECLARE n int; r int;
BEGIN
  SELECT count(*), count(DISTINCT role_code) INTO n, r FROM _b51_derivation;
  IF n <> 162 THEN RAISE EXCEPTION 'B-51: expected 162 derivation rows, got %', n; END IF;
  IF r <> 25  THEN RAISE EXCEPTION 'B-51: expected 25 distinct roles, got %', r; END IF;
END $$;

-- STEP B: create the 25 clean global job_roles (idempotent).
INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_metadata)
SELECT DISTINCT d.role_code, d.new_title,
       jsonb_build_object('source', 'b51-rederive', 'legacy_job_title', d.raw_legacy_title)
FROM _b51_derivation d
ON CONFLICT (job_role_code) DO NOTHING;

-- STEP C1: re-derive position_title from the real legacy job_title (idempotent guard).
UPDATE sys.sys_positions p
SET position_title = d.new_title
FROM _b51_derivation d
WHERE p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
  AND p.position_title IS DISTINCT FROM d.new_title;

-- STEP C2: wire position_job_role_id to the matching RTL-ROLE-* role (idempotent guard).
UPDATE sys.sys_positions p
SET position_job_role_id = r.job_role_id
FROM _b51_derivation d
JOIN sys.sys_job_roles r ON r.job_role_code = d.role_code
WHERE p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
  AND p.position_job_role_id IS DISTINCT FROM r.job_role_id;

-- Verification (NOTICE only; does not fail the migration).
DO $$
DECLARE total int; wired int; titled int; roles_created int;
BEGIN
  SELECT count(*) INTO total FROM sys.sys_positions;
  SELECT count(position_job_role_id) INTO wired FROM sys.sys_positions;
  SELECT count(*) INTO titled FROM sys.sys_positions p
    JOIN _b51_derivation d ON p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
   WHERE p.position_title = d.new_title;
  SELECT count(*) INTO roles_created FROM sys.sys_job_roles WHERE job_role_code LIKE 'RTL-ROLE-%';
  RAISE NOTICE 'B-51 done: % positions total, % role-wired (expect 162), % titled-correct (expect 162), % RTL-ROLE-* roles (expect 25)',
    total, wired, titled, roles_created;
END $$;
