-- ============================================================================================
-- 000500 — I giri del consolidamento guardano sei cataloghi in più
--          (piano docs/piani/PIANO_scheda-allineamento_20261118.md, voce SA5).
--
-- IL PROBLEMA. I giri del consolidamento confrontano cinque gruppi (organizzazione, posizioni e
-- ruoli, competenze, processi, indicatori e obiettivi), mentre la misura della distanza ne vede
-- ventiquattro domini. Sei cataloghi con nome restano fuori dai giri: contratti e livelli,
-- obblighi normativi, formazione, carriere, incentivi, commesse.
--
-- LA SOLUZIONE. Si allarga l'elenco chiuso dei gruppi con i sei nuovi codici, IN CODA: i cinque
-- gruppi di prima restano gli stessi e nello stesso ordine. Le colonne sono varchar(24) con CHECK
-- (RD-08): si sostituisce ogni CHECK con la versione allargata, una volta sola. Un CHECK più largo
-- accetta tutte le righe che il vecchio accettava, quindi nessuna riga esistente può fallire.
--
-- IDEMPOTENTE. Un vincolo che nomina già ENGAGEMENTS non si tocca. Il vincolo delle deleghe tiene
-- la clausola `IS NOT NULL` che la 000465 pretende, così la 000465 alla passata dopo lo lascia com'è.
-- Nessun dato cambia: si sostituiscono solo vincoli.
-- ============================================================================================

DO $$
DECLARE
  gruppi constant text := $g$'ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS', 'CONTRACTS', 'OBLIGATIONS', 'TRAINING', 'CAREERS', 'INCENTIVES', 'ENGAGEMENTS'$g$;
  v record;
  def text;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('sys.sys_tenant_consolidations', 'sys_tenant_consolidations_group_ck',
       'tenant_consolidation_open_group IS NULL OR tenant_consolidation_open_group IN (%s)'),
      ('sys.sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_rounds_group_ck',
       'tenant_consolidation_round_group IN (%s)'),
      ('sys.sys_tenant_consolidation_working_items', 'sys_tenant_consolidation_working_items_group_ck',
       'tenant_consolidation_working_item_group IN (%s)'),
      ('sys.sys_tenant_consolidation_proposals', 'sys_tenant_consolidation_proposals_group_ck',
       'tenant_consolidation_proposal_group IN (%s)'),
      ('sys.sys_platform_vocabulary_equivalences', 'sys_platform_vocabulary_equivalences_group_ck',
       'platform_vocabulary_equivalence_group IN (%s)'),
      ('sys.sys_tenant_consolidation_links', 'sys_tenant_consolidation_links_group_ck',
       'tenant_consolidation_link_group IN (%s)')
    ) AS x(tabella, vincolo, espressione)
  LOOP
    SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
     WHERE conrelid = v.tabella::regclass AND conname = v.vincolo;
    IF def IS NULL OR def NOT LIKE '%ENGAGEMENTS%' THEN
      IF def IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v.tabella, v.vincolo);
      END IF;
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (%s)', v.tabella, v.vincolo, format(v.espressione, gruppi));
    END IF;
  END LOOP;

  -- Le deleghe del consolidamento: stessa forma della 000465, con l'elenco allargato.
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
   WHERE conrelid = 'sys.sys_user_delegations'::regclass AND conname = 'sys_user_delegations_groups_ck';
  IF def IS NULL OR def NOT LIKE '%ENGAGEMENTS%' THEN
    IF def IS NOT NULL THEN
      ALTER TABLE sys.sys_user_delegations DROP CONSTRAINT sys_user_delegations_groups_ck;
    END IF;
    ALTER TABLE sys.sys_user_delegations ADD CONSTRAINT sys_user_delegations_groups_ck CHECK (
      (user_delegation_scope <> 'CONSOLIDATION' AND user_delegation_groups IS NULL)
      OR (user_delegation_scope = 'CONSOLIDATION'
          AND user_delegation_groups IS NOT NULL
          AND cardinality(user_delegation_groups) > 0
          AND user_delegation_groups <@ ARRAY['ORGANIZATION', 'POSITIONS_ROLES', 'SKILLS', 'PROCESSES', 'INDICATORS_GOALS',
                                              'CONTRACTS', 'OBLIGATIONS', 'TRAINING', 'CAREERS', 'INCENTIVES', 'ENGAGEMENTS']::text[]));
  END IF;
END $$;
