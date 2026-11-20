-- J6b (Enzo 2026-11-19, gemella di J6, I21): toglie da RTL Bank le evidenze della competenza «materiali avanzati» (skill 885a116c-045d-4813-b722-389d0a27d1ce) delle stesse 54 persone di J6.
-- Si applica DOPO J6: le persone si leggono dal giornale di J6 (staging.rtl_competenze_fuori_industria_undo). Se il giornale non ha 54 voci si ferma.
-- Guardie: tenant RTL, competenza attesa, nessuna FK entrante su sys_user_skill_evidence, ogni evidenza da togliere ha la sua persona nel giornale, nessuna persona di J6 senza evidenza residua da spiegare, conteggio atteso 0 o 54.
-- Giornale: staging.rtl_evidenze_fuori_industria_undo (riga intera in jsonb). Ritorno: INSERT INTO sys.sys_user_skill_evidence SELECT * FROM jsonb_populate_record(NULL::sys.sys_user_skill_evidence, riga) per ogni voce, ON CONFLICT DO NOTHING.
-- Idempotente: la seconda corsa non trova righe e non fa niente.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_evidenze_fuori_industria_undo (salvato_il timestamptz NOT NULL DEFAULT now(), chiave uuid PRIMARY KEY, riga jsonb NOT NULL);
CREATE TEMP TABLE persone(user_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO persone SELECT DISTINCT (riga->>'user_skill_user_id')::uuid FROM staging.rtl_competenze_fuori_industria_undo
  WHERE riga->>'user_skill_skill_id' = '885a116c-045d-4813-b722-389d0a27d1ce' AND riga->>'user_skill_tenant_id' = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_user_skill_evidence) totale,
  (SELECT count(*) FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') rtl_totale,
  (SELECT count(*) FROM sys.sys_user_skill_evidence e JOIN persone p ON p.user_id = e.user_skill_evidence_user_id
     WHERE e.user_skill_evidence_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce' AND e.user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') presenti,
  (SELECT count(*) FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce') della_competenza;
SELECT 'J6b prima' fase, totale, rtl_totale, presenti, della_competenza FROM prima;
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF (SELECT count(*) FROM persone) <> 54 THEN RAISE EXCEPTION 'J6b: il giornale di J6 ha % persone, ne servono 54 (J6 va applicato prima)', (SELECT count(*) FROM persone); END IF;
  IF p.presenti NOT IN (0, 54) THEN RAISE EXCEPTION 'J6b: le evidenze presenti non sono ne'' 0 ne'' 54 (%), si ferma', p.presenti; END IF;
  IF p.della_competenza <> p.presenti THEN RAISE EXCEPTION 'J6b: la competenza ha % evidenze, % delle persone di J6: ce ne sono di altre, si ferma', p.della_competenza, p.presenti; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = 'sys.sys_user_skill_evidence'::regclass AND contype = 'f') THEN RAISE EXCEPTION 'J6b: ora esiste una chiave esterna verso sys_user_skill_evidence, si ferma'; END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_user_skills us JOIN persone p2 ON p2.user_id = us.user_skill_user_id WHERE us.user_skill_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce') THEN RAISE EXCEPTION 'J6b: J6 non e'' completo, restano righe di sys_user_skills'; END IF;
END $$;
INSERT INTO staging.rtl_evidenze_fuori_industria_undo (chiave, riga)
  SELECT e.user_skill_evidence_id, to_jsonb(e) FROM sys.sys_user_skill_evidence e JOIN persone p ON p.user_id = e.user_skill_evidence_user_id
   WHERE e.user_skill_evidence_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce' AND e.user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_user_skill_evidence e USING persone p WHERE p.user_id = e.user_skill_evidence_user_id
   AND e.user_skill_evidence_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce' AND e.user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
DO $$ DECLARE p prima%ROWTYPE; BEGIN
  SELECT * INTO p FROM prima;
  IF EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_skill_id = '885a116c-045d-4813-b722-389d0a27d1ce') THEN RAISE EXCEPTION 'J6b: restano evidenze di materiali avanzati'; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skill_evidence) <> p.totale - p.presenti THEN RAISE EXCEPTION 'J6b: il totale non torna'; END IF;
  IF (SELECT count(*) FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') <> p.rtl_totale - p.presenti THEN RAISE EXCEPTION 'J6b: il totale di RTL non torna'; END IF;
END $$;
COMMIT;
SELECT 'J6b ok' esito, (SELECT count(*) FROM staging.rtl_evidenze_fuori_industria_undo) voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') rtl_totale_dopo;
