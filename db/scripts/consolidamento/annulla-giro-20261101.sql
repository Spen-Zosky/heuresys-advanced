-- db/scripts/consolidamento/annulla-giro-20261101.sql — annulla il giro di consolidamento del 01/11/2026 di RTL Bank.
--
-- Perché: le decisioni erano state prese contro il modello sbagliato (FIN_BANKING / REGIONAL_RETAIL_BANK_MEDIUM v1,
-- non la corsa p20261010010521tjb). Autorizzazione di Enzo nel thread, 2026-11-14 03:44:55 UTC: «Autorizzo a togliere
-- le unità AREA-01 e AREA-02 con il giornale di ritorno e a cancellare la sessione di consolidamento del 01/11 con le
-- sue 57 proposte, 47 decisioni e 43 collegamenti». Piano: docs/piani/PIANO_registro-corse-consolidamento_20261114.md, R5.
--
-- Misura prima (03:50 UTC): sessione 77b96bd7-…, 57 proposte, 47 decisioni, 43 collegamenti; giornale di ritorno con
-- 2 righe INSERT (le unità AREA-01 e AREA-02, create alle 03:07:50, senza figli né posizioni).
-- Guardia: ogni conteggio si ricontrolla qui dentro; se uno non torna, niente si scrive.
-- Post-condizione: le altre unità di RTL e degli altri tenant, le persone e le posizioni non cambiano.
-- Rollback: il dump verificato pg_dump_snapshots/pre-deploy/heuresys_advanced_pre-annulla-giro-0111_20261114T035000Z.dump.
-- Una sola transazione; elenco esplicito, nessun carattere jolly.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  s constant uuid := '77b96bd7-cad1-4a74-9ab5-25ca35b7a72a';
  u constant uuid[] := ARRAY['d3e0d14c-c6b9-4c48-9a70-dcc908515978', 'ef7d5e31-a523-4017-8bbb-29b00724d38a']::uuid[];
  n_prop int; n_dec int; n_link int; n_undo int; n_unita int; n_figli int; n_pos int;
  altre_unita_prima int; altre_unita_dopo int; persone_prima int; persone_dopo int; posizioni_prima int; posizioni_dopo int;
BEGIN
  SELECT count(*) INTO n_prop FROM sys.sys_tenant_consolidation_proposals WHERE tenant_consolidation_proposal_consolidation_id = s;
  SELECT count(*) INTO n_dec FROM sys.sys_tenant_consolidation_decisions d
    JOIN sys.sys_tenant_consolidation_proposals p ON p.tenant_consolidation_proposal_id = d.tenant_consolidation_decision_proposal_id
   WHERE p.tenant_consolidation_proposal_consolidation_id = s;
  SELECT count(*) INTO n_link FROM sys.sys_tenant_consolidation_links l
    JOIN sys.sys_tenant_consolidation_proposals p ON p.tenant_consolidation_proposal_id = l.tenant_consolidation_link_proposal_id
   WHERE p.tenant_consolidation_proposal_consolidation_id = s;
  SELECT count(*) INTO n_undo FROM staging.tenant_consolidation_undo
   WHERE reverted_at IS NULL AND kind = 'INSERT' AND table_name = 'sys_organization_units' AND record_id = ANY (u);
  SELECT count(*) INTO n_unita FROM sys.sys_organization_units
   WHERE organization_unit_id = ANY (u) AND organization_unit_code IN ('AREA-01', 'AREA-02');
  SELECT count(*) INTO n_figli FROM sys.sys_organization_units WHERE organization_unit_parent_id = ANY (u);
  SELECT count(*) INTO n_pos FROM sys.sys_positions WHERE position_organization_unit_id = ANY (u);
  IF (n_prop, n_dec, n_link, n_undo, n_unita, n_figli, n_pos) IS DISTINCT FROM (57, 47, 43, 2, 2, 0, 0) THEN
    RAISE EXCEPTION 'guardia: lo stato non è quello misurato (proposte %, decisioni %, collegamenti %, giornale %, unità %, figli %, posizioni %)',
      n_prop, n_dec, n_link, n_undo, n_unita, n_figli, n_pos;
  END IF;
  -- il giornale di ritorno resta, segnato come ritirato: le righe create si tolgono
  IF EXISTS (SELECT 1 FROM staging.tenant_consolidation_undo WHERE record_id = ANY (u) AND kind <> 'INSERT') THEN
    RAISE EXCEPTION 'guardia: il giornale porta modifiche diverse dalla creazione su queste unità';
  END IF;

  SELECT count(*) INTO altre_unita_prima FROM sys.sys_organization_units WHERE NOT (organization_unit_id = ANY (u));
  SELECT count(*) INTO persone_prima FROM sys.sys_users;
  SELECT count(*) INTO posizioni_prima FROM sys.sys_positions;

  UPDATE staging.tenant_consolidation_undo SET reverted_at = now()
   WHERE reverted_at IS NULL AND record_id = ANY (u);
  DELETE FROM sys.sys_organization_units WHERE organization_unit_id = ANY (u);
  DELETE FROM sys.sys_tenant_consolidation_links l USING sys.sys_tenant_consolidation_proposals p
   WHERE p.tenant_consolidation_proposal_id = l.tenant_consolidation_link_proposal_id AND p.tenant_consolidation_proposal_consolidation_id = s;
  DELETE FROM sys.sys_tenant_consolidation_decisions d USING sys.sys_tenant_consolidation_proposals p
   WHERE p.tenant_consolidation_proposal_id = d.tenant_consolidation_decision_proposal_id AND p.tenant_consolidation_proposal_consolidation_id = s;
  DELETE FROM sys.sys_tenant_consolidations WHERE tenant_consolidation_id = s; -- proposte, giri e voci di lavoro a cascata

  SELECT count(*) INTO altre_unita_dopo FROM sys.sys_organization_units;
  SELECT count(*) INTO persone_dopo FROM sys.sys_users;
  SELECT count(*) INTO posizioni_dopo FROM sys.sys_positions;
  IF altre_unita_dopo <> altre_unita_prima OR persone_dopo <> persone_prima OR posizioni_dopo <> posizioni_prima THEN
    RAISE EXCEPTION 'post-condizione: unità % → %, persone % → %, posizioni % → %',
      altre_unita_prima, altre_unita_dopo, persone_prima, persone_dopo, posizioni_prima, posizioni_dopo;
  END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_proposals WHERE tenant_consolidation_proposal_consolidation_id = s) THEN
    RAISE EXCEPTION 'post-condizione: restano proposte della sessione';
  END IF;
  RAISE NOTICE 'annullato: % proposte, % decisioni, % collegamenti, % unità', n_prop, n_dec, n_link, n_unita;
END $$;
COMMIT;
