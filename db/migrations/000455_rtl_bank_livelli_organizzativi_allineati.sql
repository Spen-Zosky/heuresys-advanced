-- @migrate: once
-- ============================================================================
-- 000455 — RTL Bank: il livello organizzativo e' la posizione nella gerarchia
--
-- VOCE: Cowork 2026-10-04/05, «Livelli organizzativi del tenant RTL_BANK incoerenti».
-- Regola decisa da Enzo: il livello e' la posizione nella gerarchia, da 1 a n,
-- uguale per ogni casella. Azienda e Direzione Generale stanno insieme al
-- livello 1; la Divisione e' il secondo livello.
--
-- MISURATO il 2026-10-05 sul gemello (42 unita': 23 con livello dichiarato, 19
-- senza; dei 23, solo 3 coincidono con la profondita').
--
-- COSA FA. Scrive la sola chiave `org_level` del metadata delle unita' di RTL
-- Bank: livello = profondita' nell'albero (radice = 1), meno 1 per la Direzione
-- Generale e per tutto cio' che le sta sotto. Le unita' appese direttamente alla
-- radice (staff di controllo) restano al livello 2, come nella proposta.
-- NON sposta unita', NON cambia tipi, NON tocca la Divisione Risk & Compliance
-- (duplicato vuoto): sono decisioni di Enzo, ancora aperte.
--
-- L'APPLICAZIONE NON LEGGE `org_level`: nessun file di apps/ lo nomina (misurato
-- con ripgrep --no-ignore). Nessun effetto su viste o calcoli.
--
-- NESSUN FILE DELLA CATENA RICREA QUESTI VALORI: org_level nasce dai seed
-- una-tantum `db/seeds/rtl-rebuild/` e `storia36`, che non girano al deploy.
-- Se il database fosse ricostruito da quei seed, questa migrazione (una-tantum)
-- va riapplicata a mano.
--
-- GUARDIA. Se non c'e' RTL Bank (database nuovo) non fa niente. Se c'e' ma
-- l'albero non e' quello misurato (Direzione Generale non unica, unita' non
-- raggiungibili dalla radice) si ferma: non indovina.
--
-- ROLLBACK: giornale `staging.mig455_rtl_livelli_undo` +
-- `staging.mig455_rtl_livelli_undo_apply()`.
--
-- IDEMPOTENTE: scrive solo dove il valore differisce; alla seconda passata zero
-- righe. Authored: 2026-10-05 (S1117).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS staging.mig455_rtl_livelli_undo (
  undo_id        bigserial PRIMARY KEY,
  unit_id        uuid        NOT NULL,
  metadata_prima jsonb       NOT NULL,
  creato_il      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig455_rtl_livelli_undo IS
  'Giornale di annullamento della 000455: il metadata PRIMA della scrittura di org_level, '
  'unita'' per unita''. Si applica con staging.mig455_rtl_livelli_undo_apply().';

CREATE OR REPLACE FUNCTION staging.mig455_rtl_livelli_undo_apply() RETURNS integer
LANGUAGE plpgsql AS $f$
DECLARE n integer;
BEGIN
  UPDATE sys.sys_organization_units u
     SET organization_unit_metadata = j.metadata_prima
    FROM (SELECT DISTINCT ON (unit_id) unit_id, metadata_prima
            FROM staging.mig455_rtl_livelli_undo ORDER BY unit_id, undo_id ASC) j
   WHERE u.organization_unit_id = j.unit_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

DO $$
DECLARE
  v_root   uuid;
  v_tenant uuid;
  v_dg     int;
  v_tot    int;
  v_raggiunte int;
  v_scritte int;
  v_errate int;
  v_alterate int;
BEGIN
  SELECT organization_unit_id, organization_unit_tenant_id INTO v_root, v_tenant
    FROM sys.sys_organization_units
   WHERE organization_unit_parent_id IS NULL
     AND organization_unit_type = 'HEADQUARTERS'
     AND organization_unit_code = 'RTL'
     AND organization_unit_name = 'RTL Bank S.p.A.';
  IF v_root IS NULL THEN
    RAISE NOTICE '000455: RTL Bank non presente in questo database, niente da allineare.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _liv ON COMMIT DROP AS
  WITH RECURSIVE t AS (
    SELECT organization_unit_id id, 1 depth, false in_dg
      FROM sys.sys_organization_units WHERE organization_unit_id = v_root
    UNION ALL
    SELECT o.organization_unit_id, t.depth + 1,
           (t.in_dg OR (t.depth = 1 AND o.organization_unit_type = 'GENERAL_MANAGEMENT'))
      FROM t JOIN sys.sys_organization_units o ON o.organization_unit_parent_id = t.id)
  SELECT id, (depth - CASE WHEN in_dg THEN 1 ELSE 0 END) AS livello FROM t;

  -- GUARDIA: l'albero e' quello misurato.
  SELECT count(*) INTO v_tot FROM sys.sys_organization_units WHERE organization_unit_tenant_id = v_tenant;
  SELECT count(*) INTO v_raggiunte FROM _liv;
  IF v_tot <> v_raggiunte THEN
    RAISE EXCEPTION '000455: % unita'' del tenant ma % raggiungibili dalla radice: albero non quello misurato', v_tot, v_raggiunte;
  END IF;
  SELECT count(*) INTO v_dg FROM sys.sys_organization_units
   WHERE organization_unit_parent_id = v_root AND organization_unit_type = 'GENERAL_MANAGEMENT';
  IF v_dg <> 1 THEN
    RAISE EXCEPTION '000455: attesa 1 Direzione Generale sotto la radice, trovate %', v_dg;
  END IF;

  -- GIORNALE prima della scrittura, poi scrittura della sola chiave org_level.
  INSERT INTO staging.mig455_rtl_livelli_undo (unit_id, metadata_prima)
  SELECT u.organization_unit_id, u.organization_unit_metadata
    FROM sys.sys_organization_units u JOIN _liv l ON l.id = u.organization_unit_id
   WHERE u.organization_unit_metadata->>'org_level' IS DISTINCT FROM l.livello::text;

  UPDATE sys.sys_organization_units u
     SET organization_unit_metadata = jsonb_set(u.organization_unit_metadata, '{org_level}', to_jsonb(l.livello::text), true)
    FROM _liv l
   WHERE l.id = u.organization_unit_id
     AND u.organization_unit_metadata->>'org_level' IS DISTINCT FROM l.livello::text;
  GET DIAGNOSTICS v_scritte = ROW_COUNT;

  -- POST-CONDIZIONI: tutte allineate; il resto del metadata e il numero di unita' non sono cambiati.
  SELECT count(*) INTO v_errate FROM sys.sys_organization_units u JOIN _liv l ON l.id = u.organization_unit_id
   WHERE u.organization_unit_metadata->>'org_level' IS DISTINCT FROM l.livello::text;
  IF v_errate <> 0 THEN
    RAISE EXCEPTION '000455: % unita'' non allineate dopo la scrittura', v_errate;
  END IF;
  SELECT count(*) INTO v_alterate
    FROM staging.mig455_rtl_livelli_undo g
    JOIN sys.sys_organization_units u ON u.organization_unit_id = g.unit_id
   WHERE (u.organization_unit_metadata - 'org_level') IS DISTINCT FROM (g.metadata_prima - 'org_level');
  IF v_alterate <> 0 THEN
    RAISE EXCEPTION '000455: % unita'' con altre chiavi del metadata alterate', v_alterate;
  END IF;
  IF (SELECT count(*) FROM sys.sys_organization_units WHERE organization_unit_tenant_id = v_tenant) <> v_tot THEN
    RAISE EXCEPTION '000455: il numero di unita'' e'' cambiato';
  END IF;
  RAISE NOTICE '000455: % unita'' di RTL Bank su % riallineate a livello = posizione nella gerarchia.', v_scritte, v_tot;
END $$;

COMMIT;
