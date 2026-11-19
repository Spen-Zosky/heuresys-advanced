-- J6 (Enzo 2026-11-19, I21): toglie dal tenant RTL Bank la competenza «materiali avanzati» (gruppo ESCO «chimica»), fuori industria per una banca.
--   54 righe di sys.sys_user_skills (skill 885a116c-045d-4813-b722-389d0a27d1ce), importate dal D1 il 22/07 (metadata.import = D1, fonte MANAGER_OVERRIDE).
-- Origine corretta nello stesso commit: db/scripts/import-d1-user-skills.sh non le riporta piu' per RTL (come la derivazione dei requisiti, 000096).
-- NON tocca le righe di sys.sys_user_skill_evidence di quelle persone e di quella competenza (restano, chiavi user+skill: nessuna FK verso user_skill_id): se vanno tolte e' un J6b.
-- Guardia: tenant RTL, competenza attesa, nessuna FK entrante su sys_user_skills (id non riferito altrove), conteggio atteso. Se una condizione non regge, si ferma.
-- Giornale: staging.rtl_competenze_fuori_industria_undo (la riga intera in jsonb). Ritorno: INSERT INTO sys.sys_user_skills SELECT * FROM jsonb_populate_record(NULL::sys.sys_user_skills, riga)
--   per ogni voce del giornale non ancora ripristinata (ON CONFLICT DO NOTHING).
-- Idempotente: la seconda corsa non trova righe e non fa niente.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_competenze_fuori_industria_undo (salvato_il timestamptz NOT NULL DEFAULT now(), chiave uuid PRIMARY KEY, riga jsonb NOT NULL);
CREATE TEMP TABLE da_togliere(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO da_togliere VALUES
  ('018c06f3-97ad-45cf-a52b-036da9731d02'),
  ('022488c4-d961-47dc-9a80-0592d5f4fbbd'),
  ('08c48cae-d446-49ae-88de-8a36c81faf85'),
  ('0b5474e9-7142-4532-97ba-d00a2335f241'),
  ('0c7a0a11-0c45-49e3-ba99-994f135dd872'),
  ('0e5efa2e-461c-46cb-b6ad-f40845c7abab'),
  ('10c75ee3-cb20-4ac0-b338-c882c384269d'),
  ('120609fa-ca96-4363-af49-1269c03e0942'),
  ('169390a2-9f74-4f13-9994-aff405408ec3'),
  ('1b7393ba-66e6-4e76-bb7e-6fa17f37661a'),
  ('20bc6679-db77-41fc-afb4-1f0a795c764f'),
  ('216fce66-dc8d-4993-8ee6-ae726ca82bc7'),
  ('2328cf1e-7050-4a3b-9f85-c71a9255bd62'),
  ('254d09ed-eaf8-4836-b4a1-50dc87276599'),
  ('27e811a2-fcd7-439f-bcb8-d623e4d9db51'),
  ('28c3b10f-679d-4992-8892-ac1b172b4bf6'),
  ('30030a25-6956-4841-a48e-45b37215115a'),
  ('360599bd-7eaa-41e9-9a90-01fdf0238b46'),
  ('4663dcda-1802-4a03-84d2-f6c5d847b79a'),
  ('4e7a77ed-b3a5-4b3e-bb11-43cca2f4f3a5'),
  ('50179a15-9d4a-42cb-ab53-f4101b7d4339'),
  ('51cecac4-9eb6-417a-af0d-57eda379c041'),
  ('56400c15-574d-4694-9915-7ded93420a50'),
  ('59639d3d-3537-49dc-8d18-00e68e14eff8'),
  ('5a040de4-01e8-4812-abc2-b5232facf61a'),
  ('6386af9f-c7f7-4f64-8fc3-bc0920637b4a'),
  ('642604af-efbc-4084-993e-944b1a047561'),
  ('659e25ce-75ac-4ab8-8f15-40028b65778e'),
  ('6ac6b9e3-092e-4e7b-aa91-819379ff2880'),
  ('6b9d8f8f-feec-4bfd-85c4-63121bfb5151'),
  ('6dac8fe4-c959-447c-8699-98f5deba8f7d'),
  ('7312b65e-2235-4b61-8ed8-10ebf83abf2a'),
  ('7362cfe4-1867-4119-9e1f-301a619176c6'),
  ('79e9f52d-7d7e-48d1-83be-beabc2a0f51c'),
  ('7dcf9116-03ec-48b1-b52b-f2adfdb22565'),
  ('7e402a9d-4ed0-4712-a8be-7e3bb9710f8a'),
  ('7f859fcc-1441-4208-81df-0592db7fb598'),
  ('90411669-ce76-4361-81ca-90e5488c3be5'),
  ('92fa1b05-3109-4b72-9a9a-f180ce9faf6a'),
  ('9619f640-ac2c-4cea-80be-758c002e99b7'),
  ('9fa61138-1c14-442c-8a2c-56b48834e5eb'),
  ('a33e5acd-7119-49d6-933e-551a26247ed8'),
  ('ac2ee762-7a0d-4d4b-b00f-1e4504f455ff'),
  ('ba113a46-6057-428f-b098-031f38125c3c'),
  ('c19e5013-8418-491c-bb14-870e1eb06a82'),
  ('c7557011-9476-4a23-8650-f8ba81d49d0c'),
  ('c92cd701-d0c4-418c-862a-24713f899561'),
  ('cb24a8e1-698a-45bc-8b82-09cd4d2538ba'),
  ('cbf8ab6b-7589-4f9d-b521-1c514613025f'),
  ('cd634283-2d17-4552-8c9b-c754e084508b'),
  ('d3e42c24-222e-49b4-8d97-5b6be7387072'),
  ('f0d01842-ee1e-4ffc-b2f5-2a37031b874d'),
  ('f3d744b0-4370-46ca-9ca2-e6346ae94698'),
  ('f8a80edd-58a4-4baa-b6aa-c1e026b2e570');
-- Misura prima
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_user_skills WHERE user_skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') rtl_totale,
  (SELECT count(*) FROM sys.sys_user_skills) totale,
  (SELECT count(*) FROM sys.sys_user_skills us JOIN da_togliere d ON d.id = us.user_skill_id) presenti,
  (SELECT count(*) FROM sys.sys_user_skill_evidence) evidenze;
SELECT 'J6 prima' fase, rtl_totale, totale, presenti, evidenze FROM prima;
DO $$ DECLARE n bigint; BEGIN
  SELECT count(*) INTO n FROM sys.sys_user_skills us JOIN da_togliere d ON d.id = us.user_skill_id
   WHERE us.user_skill_tenant_id <> '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' OR us.user_skill_skill_id <> '885a116c-045d-4813-b722-389d0a27d1ce';
  IF n > 0 THEN RAISE EXCEPTION 'J6: % righe dell elenco non sono (RTL, materiali avanzati), si ferma', n; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skills us JOIN da_togliere d ON d.id = us.user_skill_id) NOT IN (0, 54) THEN RAISE EXCEPTION 'J6: le righe presenti non sono ne'' 0 ne'' 54, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = 'sys.sys_user_skills'::regclass AND contype = 'f') THEN RAISE EXCEPTION 'J6: ora esiste una chiave esterna verso sys_user_skills, si ferma'; END IF;
END $$;
INSERT INTO staging.rtl_competenze_fuori_industria_undo (chiave, riga)
  SELECT us.user_skill_id, to_jsonb(us) FROM sys.sys_user_skills us JOIN da_togliere d ON d.id = us.user_skill_id ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_user_skills us USING da_togliere d WHERE d.id = us.user_skill_id AND us.user_skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND us.user_skill_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce';
-- Post-condizione: zero righe di quella competenza in RTL, nient'altro cambiato (totale - tolte), evidenze invariate.
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF EXISTS (SELECT 1 FROM sys.sys_user_skills WHERE user_skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND user_skill_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce') THEN RAISE EXCEPTION 'J6: restano righe di materiali avanzati in RTL'; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skills) <> p.totale - p.presenti THEN RAISE EXCEPTION 'J6: il totale non torna (atteso % meno %)', p.totale, p.presenti; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skills WHERE user_skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') <> p.rtl_totale - p.presenti THEN RAISE EXCEPTION 'J6: il totale di RTL non torna'; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skill_evidence) <> p.evidenze THEN RAISE EXCEPTION 'J6: le evidenze sono cambiate'; END IF;
END $$;
COMMIT;
SELECT 'J6 ok' esito, (SELECT count(*) FROM staging.rtl_competenze_fuori_industria_undo) voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_user_skills WHERE user_skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') rtl_totale_dopo;
