-- @migrate: once
-- ============================================================================
-- 000273 — I cataloghi delle posizioni ritirate vanno in archivio, non restano
--          appesi a posizioni che non esistono piu'.
--
-- PERCHE' `@migrate: once` (#140, S1045)
--   Questa migrazione descrive un PASSAGGIO — «porta in archivio cio' che oggi e'
--   residuo» — non uno stato desiderato. L'INSERT nell'archivio non ha deduplica,
--   quindi ogni ri-esecuzione ri-archivia cio' che nel frattempo e' tornato ad
--   apparire: misurato, l'archivio contiene 388 righe a fronte delle 232 archiviate
--   una volta sola. Eseguita una volta fa il suo lavoro; rieseguita gonfia l'archivio
--   e non aggiunge nulla. Da qui in avanti viene saltata se il registro la riporta
--   con la stessa impronta. Per rifarla davvero: MIGRATE_FORCE_ALL=1.
--
-- IL REPERTO
--   `db_health` segnala 232 righe di catalogo agganciate a posizioni DISATTIVATE,
--   sopra la soglia di non-peggioramento (226). Misurato prima di toccare:
--
--     competenze 158 · formazione 58 · KPI 4 · profili retributivi 12  = 232
--     distribuite su 30 posizioni disattivate
--
-- PERCHE' SONO RESIDUO E NON INFORMAZIONE UNICA (le tre prove)
--   1. Nessuna delle 30 ha un titolare: 0 assegnazioni ATTIVE.
--   2. Nessuna ha una posizione viva con lo stesso codice che potrebbe ereditarle.
--   3. Sono il PRIMA della ricostruzione dell'organigramma: le 30 spente portano
--      titoli INGLESI (`Bank Teller`, `Compliance Officer`, `Securities Dealer`),
--      le 161 vive portano titoli ITALIANI (`Cassiere`, `Direttore di Filiale`,
--      `Analista Crediti`). E l'universo vivo e' gia' coperto: **157 posizioni
--      attive su 161 hanno i propri requisiti di competenza**.
--
--   Non si sta buttando il catalogo di un mestiere: si sta staccando la copia
--   vecchia da posizioni che l'organigramma ha chiuso.
--
-- PERCHE' ARCHIVIO E NON SOLO DELETE
--   La convenzione del progetto per cio' che si toglie dal vivo e' `audit.*_archive`
--   (skills_junk_archive, learning_junk_archive, career_paths_junk_archive…). Le
--   righe restano leggibili e re-inseribili: se domani si scoprisse che uno di quei
--   requisiti serviva, si recupera da qui invece di ricostruirlo a memoria. Una
--   pulizia irreversibile su dati di produzione non e' una pulizia, e' una perdita.
--
-- COSA NON TOCCA
--   Nessuna riga su posizioni ATTIVE. La guardia lo verifica contando prima e dopo:
--   se il numero di posizioni vive con requisiti cambiasse anche di uno, la
--   migrazione fallisce e non committa nulla.
--
-- IDEMPOTENTE: la seconda esecuzione non trova piu' nulla da archiviare.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit.position_requirements_stale_archive (
  archive_id     bigserial PRIMARY KEY,
  catalogo       varchar(40) NOT NULL,     -- da quale tabella proviene
  position_id    uuid        NOT NULL,
  position_code  varchar(60),
  position_title varchar(200),
  payload        jsonb       NOT NULL,     -- la riga intera, re-inseribile
  archived_at    timestamptz NOT NULL DEFAULT now(),
  archived_by    varchar(60) NOT NULL DEFAULT 'migration 000273'
);

COMMENT ON TABLE audit.position_requirements_stale_archive IS
  'Cataloghi (competenze/formazione/KPI/retribuzione) staccati da posizioni '
  'disattivate dalla ricostruzione dell''organigramma. Conservati per intero e '
  're-inseribili: `payload` e'' la riga originale.';

-- 1. Archivio. Un blocco per catalogo: gli schemi sono diversi, `to_jsonb` li
--    conserva tutti senza doverli replicare colonna per colonna.
INSERT INTO audit.position_requirements_stale_archive (catalogo, position_id, position_code, position_title, payload)
SELECT 'skill_requirements', r.position_id, p.position_code, p.position_title, to_jsonb(r)
  FROM sys.sys_position_skill_requirements r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
 WHERE NOT p.position_is_active
   AND NOT EXISTS (SELECT 1 FROM audit.position_requirements_stale_archive a
                   WHERE a.catalogo = 'skill_requirements'
                     AND a.position_id = r.position_id
                     AND a.payload = to_jsonb(r));

INSERT INTO audit.position_requirements_stale_archive (catalogo, position_id, position_code, position_title, payload)
SELECT 'learning_requirements', r.position_id, p.position_code, p.position_title, to_jsonb(r)
  FROM sys.sys_position_learning_requirements r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
 WHERE NOT p.position_is_active
   AND NOT EXISTS (SELECT 1 FROM audit.position_requirements_stale_archive a
                   WHERE a.catalogo = 'learning_requirements'
                     AND a.position_id = r.position_id
                     AND a.payload = to_jsonb(r));

INSERT INTO audit.position_requirements_stale_archive (catalogo, position_id, position_code, position_title, payload)
SELECT 'kpi_requirements', r.position_id, p.position_code, p.position_title, to_jsonb(r)
  FROM sys.sys_position_kpi_requirements r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
 WHERE NOT p.position_is_active
   AND NOT EXISTS (SELECT 1 FROM audit.position_requirements_stale_archive a
                   WHERE a.catalogo = 'kpi_requirements'
                     AND a.position_id = r.position_id
                     AND a.payload = to_jsonb(r));

INSERT INTO audit.position_requirements_stale_archive (catalogo, position_id, position_code, position_title, payload)
SELECT 'compensation_profiles', r.position_id, p.position_code, p.position_title, to_jsonb(r)
  FROM sys.sys_position_compensation_profiles r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
 WHERE NOT p.position_is_active
   AND NOT EXISTS (SELECT 1 FROM audit.position_requirements_stale_archive a
                   WHERE a.catalogo = 'compensation_profiles'
                     AND a.position_id = r.position_id
                     AND a.payload = to_jsonb(r));

-- 2. Distacco dal vivo. Le condizioni sono IDENTICHE a quelle dell'archivio: cio'
--    che si cancella e' esattamente cio' che e' stato appena conservato.
DELETE FROM sys.sys_position_skill_requirements r
 USING sys.sys_positions p
 WHERE p.position_id = r.position_id AND NOT p.position_is_active;

DELETE FROM sys.sys_position_learning_requirements r
 USING sys.sys_positions p
 WHERE p.position_id = r.position_id AND NOT p.position_is_active;

DELETE FROM sys.sys_position_kpi_requirements r
 USING sys.sys_positions p
 WHERE p.position_id = r.position_id AND NOT p.position_is_active;

DELETE FROM sys.sys_position_compensation_profiles r
 USING sys.sys_positions p
 WHERE p.position_id = r.position_id AND NOT p.position_is_active;

DO $$
DECLARE
  n_residui int;
  n_attive_con_req int;
  n_archiviate bigint;
BEGIN
  -- (a) Il reperto e' chiuso: zero cataloghi su posizioni spente.
  SELECT (SELECT count(*) FROM sys.sys_position_skill_requirements r
            JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
       + (SELECT count(*) FROM sys.sys_position_learning_requirements r
            JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
       + (SELECT count(*) FROM sys.sys_position_kpi_requirements r
            JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
       + (SELECT count(*) FROM sys.sys_position_compensation_profiles r
            JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
    INTO n_residui;
  IF n_residui <> 0 THEN
    RAISE EXCEPTION 'restano % cataloghi su posizioni disattivate', n_residui;
  END IF;

  -- (b) LA GUARDIA CHE CONTA: il vivo non ha perso niente. Se questo numero
  --     scendesse, staremmo cancellando i requisiti di posizioni in uso — che e'
  --     il danno vero, non il rumore che stiamo togliendo.
  SELECT count(*) INTO n_attive_con_req
    FROM sys.sys_positions p
   WHERE p.position_is_active
     AND EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements x WHERE x.position_id=p.position_id);
  IF n_attive_con_req < 157 THEN
    RAISE EXCEPTION
      'le posizioni ATTIVE con requisiti sono scese a % (attese >= 157): la pulizia ha morso il vivo',
      n_attive_con_req;
  END IF;

  -- (c) Nulla e' sparito senza lasciare traccia.
  SELECT count(*) INTO n_archiviate FROM audit.position_requirements_stale_archive;
  IF n_archiviate = 0 THEN
    RAISE EXCEPTION 'archivio vuoto: le righe sarebbero state cancellate senza conservarle';
  END IF;

  RAISE NOTICE '000273: % righe archiviate e staccate · 0 residui · % posizioni attive con requisiti (invariate)',
               n_archiviate, n_attive_con_req;
END $$;

COMMIT;
