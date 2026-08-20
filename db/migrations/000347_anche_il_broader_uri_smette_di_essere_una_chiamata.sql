-- ============================================================================
-- 000347 — #223 F1 (rilievo F3-02, coda di #222 F2): `broader_uri` riceve la
--          stessa cura che 000344 ha dato a `skill_group_uri`.
--
-- COME E' EMERSO. Correggendo l'UPDATE incondizionato di
-- `upsertEscoSkillHierarchy` si e' visto che quella funzione scrive DUE campi
-- dai link ESCO, non uno: `skill_group_uri` (che 000344 aveva gia' normalizzato)
-- e `broader_uri`, che nessuno aveva guardato. Misurato il 2026-08-20: **5.006**
-- valori, e TUTTI in forma di chiamata API.
--
-- E c'era di peggio: senza la correzione al connettore, la prossima corsa di
-- sincronizzazione avrebbe rimesso la forma lunga anche in `skill_group_uri`,
-- disfacendo 000344. La bonifica dei dati senza la cura della sorgente e' una
-- pulizia che dura fino al prossimo giro.
--
-- LA SORGENTE E' GIA' CORRETTA, in questo stesso commit:
-- `apps/api/src/modules/reference-sync/esco-connector.ts` estrae ora il
-- parametro `uri=` da ogni href prima di restituirlo (`canonicalConceptUri`),
-- e `repository.ts` non riscrive piu' righe identiche.
--
-- ROLLBACK: giornale `staging.mig347_broader_uri_undo` + la funzione che lo applica.
--
-- IDEMPOTENTE: la `WHERE` prende solo cio' che e' ancora in forma di chiamata.
-- Le post-condizioni sono state-invariant — reggono a lavoro gia' fatto, che e'
-- la lezione che 000344 ha imparato andando rossa alla seconda passata.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.mig347_broader_uri_undo (
  skill_id      uuid PRIMARY KEY,
  valore_prima  text NOT NULL,
  annotato_il   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig347_broader_uri_undo (skill_id, valore_prima)
SELECT skill_id, skill_metadata->>'broader_uri'
  FROM sys.sys_skills
 WHERE skill_metadata->>'broader_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%'
ON CONFLICT (skill_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig347_annulla() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE sys.sys_skills s
     SET skill_metadata = jsonb_set(s.skill_metadata, '{broader_uri}',
                                    to_jsonb(u.valore_prima), true)
    FROM staging.mig347_broader_uri_undo u
   WHERE u.skill_id = s.skill_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- GUARDIA — al momento, mai ereditata.
DO $$
DECLARE da_fare int; estraibili int; distinti_prima int;
BEGIN
  SELECT count(*) INTO da_fare FROM sys.sys_skills
   WHERE skill_metadata->>'broader_uri' LIKE 'https://ec.europa.eu/esco/api/%';
  SELECT count(*) INTO estraibili FROM sys.sys_skills
   WHERE skill_metadata->>'broader_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%';
  IF da_fare <> estraibili THEN
    RAISE EXCEPTION '000347: % in forma di chiamata ma solo % estraibili', da_fare, estraibili;
  END IF;

  SELECT count(DISTINCT skill_metadata->>'broader_uri') INTO distinti_prima
    FROM sys.sys_skills WHERE coalesce(skill_metadata->>'broader_uri', '') <> '';
  PERFORM set_config('heuresys.mig347_distinti_prima', distinti_prima::text, false);
  PERFORM set_config('heuresys.mig347_con_campo_prima',
                     (SELECT count(*) FROM sys.sys_skills WHERE skill_metadata ? 'broader_uri')::text,
                     false);
END $$;

UPDATE sys.sys_skills s
   SET skill_metadata = jsonb_set(
         s.skill_metadata, '{broader_uri}',
         to_jsonb(split_part(split_part(s.skill_metadata->>'broader_uri', 'uri=', 2), '&', 1)),
         true)
 WHERE s.skill_metadata->>'broader_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%';

-- POST-CONDIZIONE — state-invariant.
DO $$
DECLARE residue int; distinti_dopo int; distinti_prima int; malformati int; con_campo int;
BEGIN
  distinti_prima := current_setting('heuresys.mig347_distinti_prima', true)::int;

  SELECT count(*) INTO residue FROM sys.sys_skills
   WHERE skill_metadata->>'broader_uri' LIKE 'https://ec.europa.eu/esco/api/%';
  IF residue > 0 THEN
    RAISE EXCEPTION '000347: % righe ancora in forma di chiamata', residue;
  END IF;

  SELECT count(*) INTO malformati FROM sys.sys_skills
   WHERE coalesce(skill_metadata->>'broader_uri', '') <> ''
     AND skill_metadata->>'broader_uri' NOT LIKE 'http%';
  IF malformati > 0 THEN
    RAISE EXCEPTION '000347: % valori non sono piu'' URI', malformati;
  END IF;

  -- CIO' CHE NON DOVEVA CAMBIARE: quante competenze diverse fanno da «broader».
  -- Se il numero calasse, forme diverse sarebbero state fuse — perdita di
  -- informazione travestita da pulizia.
  SELECT count(DISTINCT skill_metadata->>'broader_uri') INTO distinti_dopo
    FROM sys.sys_skills WHERE coalesce(skill_metadata->>'broader_uri', '') <> '';
  IF distinti_dopo <> distinti_prima THEN
    RAISE EXCEPTION '000347: i broader distinti erano %, ora sono %', distinti_prima, distinti_dopo;
  END IF;

  SELECT count(*) INTO con_campo FROM sys.sys_skills WHERE skill_metadata ? 'broader_uri';
  IF con_campo <> current_setting('heuresys.mig347_con_campo_prima', true)::int THEN
    RAISE EXCEPTION '000347: % righe col campo, ne aveva % prima', con_campo,
                    current_setting('heuresys.mig347_con_campo_prima', true);
  END IF;

  IF EXISTS (SELECT 1 FROM staging.mig347_broader_uri_undo u
              WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_id = u.skill_id)) THEN
    RAISE EXCEPTION '000347: il giornale conserva righe che non esistono piu''';
  END IF;

  RAISE NOTICE '000347 ok — broader_uri normalizzati · % valori distinti (invariati) · % righe col campo',
               distinti_dopo, con_campo;
END $$;
