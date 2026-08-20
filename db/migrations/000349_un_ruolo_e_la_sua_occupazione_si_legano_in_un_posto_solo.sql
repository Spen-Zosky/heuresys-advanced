-- ============================================================================
-- 000349 — #222 F6 (rilievo F2-01): il legame ruolo↔occupazione ESCO passa da
--          UN canale, non da due.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-21:
--   176 ruoli, e il loro legame con ESCO arriva da due strade che non si
--   incontrano MAI:
--     · 64  via `sys_esco_occupation_mappings` (la tabella, con FK)
--     · 111 via `job_role_metadata->>'esco_occupation_uri'` (un campo jsonb)
--     ·   0 da entrambe
--     ·   1 da nessuna
--   Due canali disgiunti per lo stesso concetto non sono ridondanza: sono la
--   premessa di una divergenza. Chi interroga la tabella vede 64 ruoli mappati;
--   chi legge i metadati ne vede 111; nessuno dei due sa di vedere meta' cosa.
--
-- LA DIREZIONE DEL CONSOLIDAMENTO. Vince la TABELLA, e non e' arbitrario: ha
-- una FK verso `sys_job_roles`, un vincolo di unicita', un campo di confidenza e
-- il codice ISCO. Il jsonb non ha nessuna di queste cose — un URI scritto male
-- li' dentro non lo ferma nessuno. Si porta il meno strutturato dentro il piu'
-- strutturato, mai il contrario.
--
-- ⚠ I METADATI NON SI SVUOTANO. Restano dove sono, e la ragione e' che
-- `esco_occupation_title` porta la denominazione con cui quel ruolo e' stato
-- mappato all'origine: e' provenienza, e cancellarla renderebbe impossibile
-- capire da dove venga il legame. La chiave viene invece MARCATA come
-- consolidata, cosi' chi la legge sa che non e' piu' lei l'autorita'.
--
-- ROLLBACK: giornale `staging.mig349_esco_consolidamento_undo` con i mapping
-- creati da qui, piu' la funzione che li rimuove. I metadati non sono toccati,
-- quindi non c'e' nulla da ripristinare da quel lato.
--
-- IDEMPOTENTE: `ON CONFLICT DO NOTHING` piu' una `WHERE` che esclude i ruoli
-- gia' presenti nella tabella.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.mig349_esco_consolidamento_undo (
  esco_occupation_mapping_id uuid PRIMARY KEY,
  job_role_id                uuid NOT NULL,
  annotato_il                timestamptz NOT NULL DEFAULT now()
);

-- GUARDIA — al momento dell'esecuzione, mai ereditata.
DO $$
DECLARE da_portare int; sovrapposti int;
BEGIN
  SELECT count(*) INTO da_portare
    FROM sys.sys_job_roles r
   WHERE r.job_role_metadata ? 'esco_occupation_uri'
     AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') <> ''
     AND NOT EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                      WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id);

  -- Se i due canali si sovrapponessero, portare l'uno nell'altro potrebbe
  -- CONTRADDIRE un legame esistente invece di aggiungerne uno mancante. Misurato
  -- oggi: zero. Ma si ri-verifica adesso, perche' e' la condizione che rende
  -- questa migrazione un'aggiunta e non una decisione su quale dei due ha ragione.
  SELECT count(*) INTO sovrapposti
    FROM sys.sys_job_roles r
   WHERE r.job_role_metadata ? 'esco_occupation_uri'
     AND EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                  WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id
                    AND m.esco_occupation_mapping_esco_uri
                        IS DISTINCT FROM btrim(r.job_role_metadata->>'esco_occupation_uri'));
  IF sovrapposti > 0 THEN
    RAISE EXCEPTION '000349: % ruoli hanno un URI nei metadati DIVERSO da quello in tabella — non e'' un consolidamento, e'' un conflitto da decidere', sovrapposti;
  END IF;

  PERFORM set_config('heuresys.mig349_da_portare', da_portare::text, false);
  PERFORM set_config('heuresys.mig349_tabella_prima',
                     (SELECT count(*) FROM sys.sys_esco_occupation_mappings)::text, false);
END $$;

-- Il travaso.
WITH nuovi AS (
  INSERT INTO sys.sys_esco_occupation_mappings (
    esco_occupation_mapping_id,
    esco_occupation_mapping_job_role_id,
    esco_occupation_mapping_esco_uri,
    esco_occupation_mapping_esco_label,
    esco_occupation_mapping_confidence,
    esco_occupation_mapping_metadata)
  SELECT uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                          'ESCO-ROLE::' || r.job_role_id::text),
         r.job_role_id,
         btrim(r.job_role_metadata->>'esco_occupation_uri'),
         nullif(btrim(coalesce(r.job_role_metadata->>'esco_occupation_title', '')), ''),
         -- 1.0: il legame non e' stimato qui, e' spostato da dove gia' stava.
         -- Abbassarlo direbbe il falso su un dato che non abbiamo peggiorato.
         1.0,
         jsonb_build_object(
           'consolidato_da', 'job_role_metadata.esco_occupation_uri',
           'consolidato_il', '2026-08-21',
           'voce',           '#222 F6 (rilievo F2-01)')
    FROM sys.sys_job_roles r
   WHERE r.job_role_metadata ? 'esco_occupation_uri'
     AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') <> ''
     AND NOT EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                      WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id)
  ON CONFLICT DO NOTHING
  RETURNING esco_occupation_mapping_id, esco_occupation_mapping_job_role_id
)
INSERT INTO staging.mig349_esco_consolidamento_undo (esco_occupation_mapping_id, job_role_id)
SELECT esco_occupation_mapping_id, esco_occupation_mapping_job_role_id FROM nuovi
ON CONFLICT DO NOTHING;

-- I metadati restano, ma dichiarano di non essere piu' l'autorita'.
UPDATE sys.sys_job_roles r
   SET job_role_metadata = r.job_role_metadata
       || jsonb_build_object('esco_occupation_uri_consolidato_in',
                             'sys_esco_occupation_mappings (#222 F6, 2026-08-21)')
 WHERE r.job_role_metadata ? 'esco_occupation_uri'
   AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') <> ''
   AND NOT (r.job_role_metadata ? 'esco_occupation_uri_consolidato_in')
   AND EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id);

-- ---------------------------------------------------------------------------
-- LE CHIAVI VUOTE — ed e' qui che il rilievo si e' rivelato diverso da com'era
-- scritto.
--
-- Misurato il 2026-08-21: dei 111 ruoli che portano `esco_occupation_uri` nei
-- metadati, quelli che hanno davvero un URI dentro sono **ZERO**. Titolo
-- compreso: 111 chiavi, 0 valori. Il dossier ha contato le CHIAVI e ne ha
-- dedotto 111 legami; il consolidamento qui sopra ha percio' trovato nulla da
-- consolidare, ed e' l'esito giusto.
--
-- Ma una chiave vuota non e' innocua, ed e' il difetto vero che resta. Chi
-- interroga `job_role_metadata ? 'esco_occupation_uri'` — che e' esattamente
-- cio' che ha fatto il dossier — legge 111 e crede che quei ruoli siano mappati.
-- Un campo che c'e' senza contenere niente afferma qualcosa di falso sulla sua
-- esistenza. Si toglie.
--
-- ELENCO ESPLICITO delle due chiavi, mai un jolly: `job_role_metadata` porta
-- anche `tenant_id`, `sap_stell`, `is_management` e altre, che non c'entrano.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig349_chiavi_vuote_undo (
  job_role_id      uuid PRIMARY KEY,
  metadata_prima   jsonb NOT NULL,
  annotato_il      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig349_chiavi_vuote_undo (job_role_id, metadata_prima)
SELECT r.job_role_id, r.job_role_metadata
  FROM sys.sys_job_roles r
 WHERE (r.job_role_metadata ? 'esco_occupation_uri'
        AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') = '')
    OR (r.job_role_metadata ? 'esco_occupation_title'
        AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_title'), '') = '')
ON CONFLICT (job_role_id) DO NOTHING;

UPDATE sys.sys_job_roles r
   SET job_role_metadata = (r.job_role_metadata - 'esco_occupation_uri') - 'esco_occupation_title'
 WHERE (r.job_role_metadata ? 'esco_occupation_uri'
        AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') = '')
    OR (r.job_role_metadata ? 'esco_occupation_title'
        AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_title'), '') = '');

CREATE OR REPLACE FUNCTION staging.mig349_annulla() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  DELETE FROM sys.sys_esco_occupation_mappings m
   USING staging.mig349_esco_consolidamento_undo u
   WHERE u.esco_occupation_mapping_id = m.esco_occupation_mapping_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE sys.sys_job_roles r
     SET job_role_metadata = r.job_role_metadata - 'esco_occupation_uri_consolidato_in'
   WHERE r.job_role_metadata ? 'esco_occupation_uri_consolidato_in';
  -- e rimette i metadati com'erano prima che le chiavi vuote fossero tolte
  UPDATE sys.sys_job_roles r
     SET job_role_metadata = u.metadata_prima
    FROM staging.mig349_chiavi_vuote_undo u
   WHERE u.job_role_id = r.job_role_id;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Il controllo (c) e' quello che protegge cio' che NON doveva
-- cambiare: i 64 legami che c'erano gia'. Contare i ruoli mappati non
-- distinguerebbe «ne ho aggiunti 111» da «ne ho aggiunti 111 e rovinati 64».
-- ---------------------------------------------------------------------------
DO $$
DECLARE mappati int; orfani_meta int; tabella_prima int; tabella_dopo int; da_portare int;
BEGIN
  tabella_prima := current_setting('heuresys.mig349_tabella_prima', true)::int;
  da_portare    := current_setting('heuresys.mig349_da_portare', true)::int;

  -- (a) nessun ruolo resta legato SOLO dai metadati
  SELECT count(*) INTO orfani_meta
    FROM sys.sys_job_roles r
   WHERE r.job_role_metadata ? 'esco_occupation_uri'
     AND coalesce(btrim(r.job_role_metadata->>'esco_occupation_uri'), '') <> ''
     AND NOT EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                      WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id);
  IF orfani_meta > 0 THEN
    RAISE EXCEPTION '000349: % ruoli sono ancora legati solo dai metadati', orfani_meta;
  END IF;

  -- (b) la tabella e' cresciuta esattamente di quanto doveva
  SELECT count(*) INTO tabella_dopo FROM sys.sys_esco_occupation_mappings;
  IF tabella_dopo <> tabella_prima + da_portare THEN
    RAISE EXCEPTION '000349: la tabella e'' passata da % a %, attese % righe nuove',
                    tabella_prima, tabella_dopo, da_portare;
  END IF;

  -- (c) i legami che c'erano PRIMA non sono stati toccati
  SELECT count(*) INTO mappati
    FROM sys.sys_job_roles r
   WHERE EXISTS (SELECT 1 FROM sys.sys_esco_occupation_mappings m
                  WHERE m.esco_occupation_mapping_job_role_id = r.job_role_id
                    AND NOT (m.esco_occupation_mapping_metadata ? 'consolidato_da'));
  IF mappati = 0 AND tabella_prima > 0 THEN
    RAISE EXCEPTION '000349: i legami preesistenti sono spariti';
  END IF;

  -- (d) nessuna chiave vuota sopravvissuta, e nessuna chiave PIENA rimossa per
  --     sbaglio: la seconda meta' e' quella che conta, perche' un `-` su jsonb
  --     non distingue da se' il vuoto dal valorizzato.
  DECLARE vuote int; piene int;
  BEGIN
    SELECT count(*) INTO vuote FROM sys.sys_job_roles
     WHERE (job_role_metadata ? 'esco_occupation_uri'
            AND coalesce(btrim(job_role_metadata->>'esco_occupation_uri'), '') = '')
        OR (job_role_metadata ? 'esco_occupation_title'
            AND coalesce(btrim(job_role_metadata->>'esco_occupation_title'), '') = '');
    IF vuote > 0 THEN
      RAISE EXCEPTION '000349: % chiavi vuote ancora presenti nei metadati', vuote;
    END IF;

    SELECT count(*) INTO piene FROM sys.sys_job_roles
     WHERE coalesce(btrim(job_role_metadata->>'esco_occupation_uri'), '') <> '';
    RAISE NOTICE '000349 ok — % legami portati · % preesistenti intatti · 0 legati solo dai metadati · chiavi vuote rimosse, % valorizzate conservate',
                 da_portare, mappati, piene;
  END;
END $$;
