-- db/scripts/241-rimuovi-fascicoli-di-prova.sql
--
-- #241 V1 — rimuove i due fascicoli di prova dalla produzione, su decisione di Enzo
-- (2026-09-03: «PROVA-F7-ALFA in produzione: si rimuove»; `PROVA-F7-CONSULENZA` era già
-- dichiarato da rimuovere in S1085, perché vuoto e perché il suo nome inquina la guardia di #239).
--
-- NON è una migrazione, e non deve diventarlo: i due fascicoli nascono da uno script one-off
-- (`apps/api/scripts/prova-132-f7-due-prove-di-merito.mts`), non dalla catena — quindi nessun
-- deploy li rimette, e ADR-0035 non morde.
--
-- ⚠ LA CATENA È PIÙ LUNGA DI QUANTO SEMBRI, e la prima stesura di questo script lo ignorava.
-- Sette FK puntano ai fascicoli; TRE sono RESTRICT e possono bloccare la cancellazione:
--   sys_seed_acquisition_runs        (le corse di ricerca)      ← ALFA ne ha 2
--   sys_tenant_blueprint_snapshots   (le istantanee)            ← nessuna sulle prove
--   sys_generated_record_origins     (il registro delle righe costruite) ← ZERO: niente costruito
-- Dalle corse cascata `sys_seed_candidate_records` (15 righe). La prova generale sul gemello ha
-- scoperto la prima delle tre: senza di essa questo script sarebbe morto in produzione a metà.
--
-- Idempotente: se i fascicoli non ci sono più, esce senza fare nulla e senza errore.
--
--   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -v ON_ERROR_STOP=1 \
--        -f db/scripts/241-rimuovi-fascicoli-di-prova.sql

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Il bersaglio, dichiarato una volta sola. Elenco esplicito, nessun jolly:
--    ogni passo successivo si appoggia a queste tabelle temporanee, così non
--    esiste un secondo posto dove il criterio possa divergere.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_bersaglio_codici (code varchar(64) PRIMARY KEY) ON COMMIT DROP;
INSERT INTO t_bersaglio_codici (code) VALUES ('PROVA-F7-ALFA'), ('PROVA-F7-CONSULENZA');

CREATE TEMP TABLE t_bersaglio AS
SELECT b.tenant_blueprint_id AS bid, v.tenant_blueprint_version_id AS vid
  FROM sys.sys_tenant_blueprints b
  JOIN t_bersaglio_codici t ON t.code = b.tenant_blueprint_code
  LEFT JOIN sys.sys_tenant_blueprint_versions v
    ON v.tenant_blueprint_version_blueprint_id = b.tenant_blueprint_id;

CREATE TEMP TABLE t_corse AS
SELECT r.seed_acquisition_run_id AS rid
  FROM sys.sys_seed_acquisition_runs r
  JOIN t_bersaglio x ON x.vid = r.seed_acquisition_run_blueprint_version_id;

-- ---------------------------------------------------------------------------
-- 1. La misura PRIMA, derivata sul vivo. Nessun numero scritto a mano: le
--    post-condizioni confronteranno i delta contro questa fotografia, così lo
--    script resta vero anche se i totali cambiano fra oggi e la prossima volta.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t_prima AS
SELECT
  (SELECT count(*) FROM sys.sys_tenant_blueprints)                  AS fascicoli,
  (SELECT count(*) FROM sys.sys_tenant_blueprint_versions)          AS versioni,
  (SELECT count(*) FROM sys.sys_tenant_blueprint_process_decisions) AS decisioni,
  (SELECT count(*) FROM sys.sys_tenant_blueprint_snapshots)         AS istantanee,
  (SELECT count(*) FROM sys.sys_seed_acquisition_runs)              AS corse,
  (SELECT count(*) FROM sys.sys_seed_candidate_records)             AS candidati,
  (SELECT count(*) FROM sys.sys_generated_record_origins)           AS registro,
  (SELECT count(*) FROM t_bersaglio WHERE bid IS NOT NULL)          AS att_fascicoli_x_versione,
  (SELECT count(DISTINCT bid) FROM t_bersaglio)                     AS att_fascicoli,
  (SELECT count(*) FROM t_bersaglio WHERE vid IS NOT NULL)          AS att_versioni,
  (SELECT count(*) FROM t_corse)                                    AS att_corse,
  (SELECT count(*) FROM sys.sys_seed_candidate_records c
     WHERE c.seed_candidate_record_run_id IN (SELECT rid FROM t_corse)) AS att_candidati;

-- ---------------------------------------------------------------------------
-- 2. La guardia. Ri-verifica le precondizioni ADESSO, non le eredita dalla
--    misura di mezz'ora prima. Tre esiti, e solo uno è un errore:
--      tutte le versioni inerti e registro a zero → si procede
--      nessun fascicolo di prova                  → già fatto, si esce sereni
--      qualunque altro                            → si ferma tutto
-- ---------------------------------------------------------------------------
DO $guardia$
DECLARE
  n_fascicoli int;
  n_versioni  int;
  n_inerti    int;
  n_costruito int;
BEGIN
  SELECT count(DISTINCT bid), count(vid) INTO n_fascicoli, n_versioni FROM t_bersaglio;

  IF n_fascicoli = 0 THEN
    RAISE NOTICE '#241 V1: nessun fascicolo di prova presente — niente da fare.';
    RETURN;
  END IF;

  -- Inerte = DRAFT, senza tenant, mai approvata, mai applicata.
  SELECT count(*) INTO n_inerti
    FROM sys.sys_tenant_blueprints b
    JOIN sys.sys_tenant_blueprint_versions v
      ON v.tenant_blueprint_version_blueprint_id = b.tenant_blueprint_id
   WHERE b.tenant_blueprint_id IN (SELECT bid FROM t_bersaglio)
     AND b.tenant_blueprint_tenant_id IS NULL
     AND v.tenant_blueprint_version_status = 'DRAFT'
     AND v.tenant_blueprint_version_approved_at IS NULL
     AND v.tenant_blueprint_version_applied_at  IS NULL;

  IF n_inerti <> n_versioni THEN
    RAISE EXCEPTION
      'GUARDIA #241 V1: % versioni sui fascicoli di prova, ma solo % inerti (DRAFT, senza '
      'tenant, mai approvate, mai applicate). Fermo.', n_versioni, n_inerti;
  END IF;

  -- La guardia che conta davvero: se il fascicolo ha COSTRUITO righe, non si
  -- cancella il fascicolo — si disfa l'applicazione, che è un altro lavoro.
  SELECT count(*) INTO n_costruito
    FROM sys.sys_generated_record_origins g
   WHERE g.generated_record_origin_blueprint_version_id IN (SELECT vid FROM t_bersaglio);

  IF n_costruito <> 0 THEN
    RAISE EXCEPTION
      'GUARDIA #241 V1: il registro delle origini conosce % righe costruite da questi '
      'fascicoli. Cancellarli lascerebbe quelle righe senza provenienza. Fermo.', n_costruito;
  END IF;

  RAISE NOTICE
    '#241 V1 guardia: % fascicoli · % versioni, tutte inerti · 0 righe costruite — si procede.',
    n_fascicoli, n_versioni;
END
$guardia$;

-- ---------------------------------------------------------------------------
-- 3. Il giornale di rollback (metodo di bonifica ④), popolato PRIMA della
--    cancellazione e su tutti e quattro i livelli della catena.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.blueprint_prova_undo (
  undo_id     bigserial   PRIMARY KEY,
  undo_at     timestamptz NOT NULL DEFAULT now(),
  undo_reason text        NOT NULL,
  undo_table  text        NOT NULL,
  undo_row    jsonb       NOT NULL
);

COMMENT ON TABLE staging.blueprint_prova_undo IS
  '#241 V1 (S1086) — giornale di rollback della rimozione dei fascicoli di prova PROVA-F7-*, '
  'su tutti i livelli della catena. Si riapplica con staging.blueprint_prova_undo_apply().';

INSERT INTO staging.blueprint_prova_undo (undo_reason, undo_table, undo_row)
SELECT '#241 V1 S1086 — rimozione su decisione di Enzo 2026-09-03', 'sys.sys_seed_candidate_records', to_jsonb(c)
  FROM sys.sys_seed_candidate_records c
 WHERE c.seed_candidate_record_run_id IN (SELECT rid FROM t_corse);

INSERT INTO staging.blueprint_prova_undo (undo_reason, undo_table, undo_row)
SELECT '#241 V1 S1086 — rimozione su decisione di Enzo 2026-09-03', 'sys.sys_seed_acquisition_runs', to_jsonb(r)
  FROM sys.sys_seed_acquisition_runs r
 WHERE r.seed_acquisition_run_id IN (SELECT rid FROM t_corse);

INSERT INTO staging.blueprint_prova_undo (undo_reason, undo_table, undo_row)
SELECT '#241 V1 S1086 — rimozione su decisione di Enzo 2026-09-03', 'sys.sys_tenant_blueprint_versions', to_jsonb(v)
  FROM sys.sys_tenant_blueprint_versions v
 WHERE v.tenant_blueprint_version_id IN (SELECT vid FROM t_bersaglio WHERE vid IS NOT NULL);

INSERT INTO staging.blueprint_prova_undo (undo_reason, undo_table, undo_row)
SELECT '#241 V1 S1086 — rimozione su decisione di Enzo 2026-09-03', 'sys.sys_tenant_blueprints', to_jsonb(b)
  FROM sys.sys_tenant_blueprints b
 WHERE b.tenant_blueprint_id IN (SELECT bid FROM t_bersaglio);

-- ---------------------------------------------------------------------------
-- 4. La funzione che riapplica il giornale — il rollback è dichiarato, non
--    promesso. L'ordine è quello delle FK: fascicoli, versioni, corse, candidati.
--    I fascicoli entrano con `current_version_id` a NULL e lo riprendono dopo
--    che le versioni esistono, altrimenti la FK li respinge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.blueprint_prova_undo_apply()
RETURNS TABLE (tabella text, righe_rimesse bigint)
LANGUAGE plpgsql
AS $undo$
DECLARE
  n_b bigint := 0;
  n_v bigint := 0;
  n_r bigint := 0;
  n_c bigint := 0;
BEGIN
  INSERT INTO sys.sys_tenant_blueprints
  SELECT * FROM jsonb_populate_recordset(NULL::sys.sys_tenant_blueprints,
    (SELECT coalesce(jsonb_agg(undo_row - 'tenant_blueprint_current_version_id'), '[]'::jsonb)
       FROM staging.blueprint_prova_undo WHERE undo_table = 'sys.sys_tenant_blueprints'))
  ON CONFLICT (tenant_blueprint_id) DO NOTHING;
  GET DIAGNOSTICS n_b = ROW_COUNT;

  INSERT INTO sys.sys_tenant_blueprint_versions
  SELECT * FROM jsonb_populate_recordset(NULL::sys.sys_tenant_blueprint_versions,
    (SELECT coalesce(jsonb_agg(undo_row), '[]'::jsonb)
       FROM staging.blueprint_prova_undo WHERE undo_table = 'sys.sys_tenant_blueprint_versions'))
  ON CONFLICT (tenant_blueprint_version_id) DO NOTHING;
  GET DIAGNOSTICS n_v = ROW_COUNT;

  -- ora che le versioni esistono, il fascicolo può ripuntare alla sua
  UPDATE sys.sys_tenant_blueprints b
     SET tenant_blueprint_current_version_id =
           (j.undo_row ->> 'tenant_blueprint_current_version_id')::uuid
    FROM staging.blueprint_prova_undo j
   WHERE j.undo_table = 'sys.sys_tenant_blueprints'
     AND b.tenant_blueprint_id = (j.undo_row ->> 'tenant_blueprint_id')::uuid
     AND j.undo_row ->> 'tenant_blueprint_current_version_id' IS NOT NULL;

  INSERT INTO sys.sys_seed_acquisition_runs
  SELECT * FROM jsonb_populate_recordset(NULL::sys.sys_seed_acquisition_runs,
    (SELECT coalesce(jsonb_agg(undo_row), '[]'::jsonb)
       FROM staging.blueprint_prova_undo WHERE undo_table = 'sys.sys_seed_acquisition_runs'))
  ON CONFLICT (seed_acquisition_run_id) DO NOTHING;
  GET DIAGNOSTICS n_r = ROW_COUNT;

  INSERT INTO sys.sys_seed_candidate_records
  SELECT * FROM jsonb_populate_recordset(NULL::sys.sys_seed_candidate_records,
    (SELECT coalesce(jsonb_agg(undo_row), '[]'::jsonb)
       FROM staging.blueprint_prova_undo WHERE undo_table = 'sys.sys_seed_candidate_records'))
  ON CONFLICT (seed_candidate_record_id) DO NOTHING;
  GET DIAGNOSTICS n_c = ROW_COUNT;

  RETURN QUERY
    SELECT 'sys.sys_tenant_blueprints'::text, n_b UNION ALL
    SELECT 'sys.sys_tenant_blueprint_versions'::text, n_v UNION ALL
    SELECT 'sys.sys_seed_acquisition_runs'::text, n_r UNION ALL
    SELECT 'sys.sys_seed_candidate_records'::text, n_c;
END
$undo$;

-- ---------------------------------------------------------------------------
-- 5. La cancellazione, dal basso verso l'alto lungo le FK RESTRICT.
--    I candidati cadono per CASCADE dalle corse; le versioni per CASCADE dai
--    fascicoli; le decisioni per CASCADE dalle versioni.
-- ---------------------------------------------------------------------------
DELETE FROM sys.sys_seed_acquisition_runs
 WHERE seed_acquisition_run_id IN (SELECT rid FROM t_corse);

DELETE FROM sys.sys_tenant_blueprints
 WHERE tenant_blueprint_id IN (SELECT bid FROM t_bersaglio);

-- ---------------------------------------------------------------------------
-- 6. Le post-condizioni. La prima metà verifica ciò che DOVEVA cambiare — e di
--    quanto esattamente; la seconda protegge ciò che NON doveva, che è la metà
--    che si dimentica. Tutti i delta vengono dalla fotografia del passo 1.
-- ---------------------------------------------------------------------------
DO $post$
DECLARE
  p            record;
  d_fascicoli  int;
  d_versioni   int;
  d_corse      int;
  d_candidati  int;
  d_decisioni  int;
  d_istantanee int;
  d_registro   int;
  n_prova      int;
BEGIN
  SELECT * INTO p FROM t_prima;

  IF p.att_fascicoli = 0 THEN
    RAISE NOTICE '#241 V1 post: niente da verificare, non c''era nulla da rimuovere.';
    RETURN;
  END IF;

  SELECT count(*) INTO n_prova
    FROM sys.sys_tenant_blueprints b JOIN t_bersaglio_codici t ON t.code = b.tenant_blueprint_code;
  IF n_prova <> 0 THEN
    RAISE EXCEPTION 'POST #241 V1: restano % fascicoli di prova. Fermo.', n_prova;
  END IF;

  d_fascicoli  := p.fascicoli  - (SELECT count(*) FROM sys.sys_tenant_blueprints);
  d_versioni   := p.versioni   - (SELECT count(*) FROM sys.sys_tenant_blueprint_versions);
  d_corse      := p.corse      - (SELECT count(*) FROM sys.sys_seed_acquisition_runs);
  d_candidati  := p.candidati  - (SELECT count(*) FROM sys.sys_seed_candidate_records);
  d_decisioni  := p.decisioni  - (SELECT count(*) FROM sys.sys_tenant_blueprint_process_decisions);
  d_istantanee := p.istantanee - (SELECT count(*) FROM sys.sys_tenant_blueprint_snapshots);
  d_registro   := p.registro   - (SELECT count(*) FROM sys.sys_generated_record_origins);

  -- Ciò che doveva cambiare, e di quanto.
  IF (d_fascicoli, d_versioni, d_corse, d_candidati)
     <> (p.att_fascicoli, p.att_versioni, p.att_corse, p.att_candidati) THEN
    RAISE EXCEPTION
      'POST #241 V1: delta inatteso. fascicoli %/% · versioni %/% · corse %/% · candidati %/% '
      '(osservato/atteso). Fermo.',
      d_fascicoli, p.att_fascicoli, d_versioni, p.att_versioni,
      d_corse, p.att_corse, d_candidati, p.att_candidati;
  END IF;

  -- Ciò che NON doveva cambiare. Le prove non avevano decisioni, istantanee né
  -- righe nel registro: questi tre delta devono essere ZERO, altrimenti la
  -- cancellazione ha morso il fascicolo vero.
  IF (d_decisioni, d_istantanee, d_registro) <> (0, 0, 0) THEN
    RAISE EXCEPTION
      'POST #241 V1: e'' cambiato cio'' che non doveva — decisioni % · istantanee % · '
      'registro origini %. Il fascicolo RTL-BANK-CONFIG non doveva essere toccato. Fermo.',
      d_decisioni, d_istantanee, d_registro;
  END IF;

  RAISE NOTICE
    '#241 V1 post: rimossi % fascicoli · % versioni · % corse · % candidati; '
    'decisioni, istantanee e registro origini invariati.',
    d_fascicoli, d_versioni, d_corse, d_candidati;
END
$post$;

COMMIT;

-- Evidenza finale, letta dopo il COMMIT.
SELECT tenant_blueprint_code AS code, tenant_blueprint_name AS name, tenant_blueprint_status AS status
  FROM sys.sys_tenant_blueprints ORDER BY code;

SELECT undo_table, count(*) AS righe_in_giornale
  FROM staging.blueprint_prova_undo GROUP BY undo_table ORDER BY undo_table;
