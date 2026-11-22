-- Inversa di separa-tre-accorpamenti.sql. Niente cancellazioni:
--   1. i tre sottoprocessi creati (righe INSERT del giornale, ancora da ritirare) si spengono
--      (tenant_process_is_active = false), solo se nessuno li ha già spenti;
--   2. le descrizioni ritirate in 10, 05 e 16 tornano quelle della CONFERMATA, solo dove sono ancora vuote;
--   3. una decisione CONFERMATA nuova, con forma e stato ADR-0048 copiati dalla decisione che la RIFIUTATA aveva
--      sostituito, prende il posto della RIFIUTATA, e il
--      collegamento la riporta.
-- PROVA A SECCO senza -v applica=1, come lo script diretto.
\set ON_ERROR_STOP on
\if :{?applica}
\else
  \set applica 0
\endif
BEGIN;

CREATE TEMP TABLE prop ON COMMIT DROP AS
SELECT p.tenant_consolidation_proposal_id AS proposta, p.tenant_consolidation_proposal_prototype_keys[1] AS figlio,
       l.tenant_consolidation_link_decision_id AS dec_rif, gen_random_uuid() AS dec_nuova,
       o.tenant_consolidation_decision_form AS forma_orig, o.tenant_consolidation_decision_adr48_state AS stato_orig
  FROM sys.sys_tenant_consolidation_proposals p
  JOIN sys.sys_tenant_consolidation_links l ON l.tenant_consolidation_link_proposal_id = p.tenant_consolidation_proposal_id
  JOIN sys.sys_tenant_consolidation_decisions r ON r.tenant_consolidation_decision_id = l.tenant_consolidation_link_decision_id
  JOIN sys.sys_tenant_consolidation_decisions o ON o.tenant_consolidation_decision_id = r.tenant_consolidation_decision_supersedes_id
 WHERE p.tenant_consolidation_proposal_group = 'PROCESSES'
   AND p.tenant_consolidation_proposal_prototype_keys[1] IN ('P04', 'P20', 'P26')
   AND p.tenant_consolidation_proposal_superseded_at IS NULL
   AND l.tenant_consolidation_link_decision = 'RIFIUTATA';

DO $$
BEGIN
  IF (SELECT count(*) FROM prop) <> 3 THEN
    RAISE EXCEPTION 'guardia: le tre proposte non sono tutte RIFIUTATA (%), niente scritto', (SELECT count(*) FROM prop);
  END IF;
END $$;

-- 1. Spegne i sottoprocessi creati.
CREATE TEMP TABLE spenti ON COMMIT DROP AS
WITH s AS (
  UPDATE sys.sys_tenant_processes t SET tenant_process_is_active = false, updated_at = now()
    FROM staging.tenant_consolidation_undo u JOIN prop p ON p.proposta = u.proposal_id AND p.dec_rif = u.decision_id
   WHERE u.kind = 'INSERT' AND u.reverted_at IS NULL AND u.table_name = 'sys_tenant_processes'
     AND t.tenant_process_id = u.record_id AND t.tenant_process_is_active
  RETURNING u.undo_id
) SELECT * FROM s;
UPDATE staging.tenant_consolidation_undo u SET reverted_at = now() FROM spenti s WHERE u.undo_id = s.undo_id;

-- 2. Rimette le descrizioni della CONFERMATA dove sono ancora vuote: per ogni processo solo la riga di giornale
--    ritirata per ultima, così l'UPDATE è deterministico anche se ce ne fossero di più vecchie.
CREATE TEMP TABLE da_rimettere ON COMMIT DROP AS
SELECT DISTINCT ON (u.record_id) u.undo_id, u.record_id, u.value_before, u.value_after
  FROM staging.tenant_consolidation_undo u JOIN prop p ON p.proposta = u.proposal_id
 WHERE u.kind = 'UPDATE' AND u.reverted_at IS NOT NULL AND u.column_name = 'tenant_process_description'
 ORDER BY u.record_id, u.reverted_at DESC, u.undo_id;
CREATE TEMP TABLE rimesse ON COMMIT DROP AS
WITH r AS (
  UPDATE sys.sys_tenant_processes t SET tenant_process_description = d.value_after, updated_at = now()
    FROM da_rimettere d
   WHERE t.tenant_process_id = d.record_id AND t.tenant_process_description IS NOT DISTINCT FROM d.value_before
  RETURNING d.undo_id
) SELECT * FROM r;
UPDATE staging.tenant_consolidation_undo u SET reverted_at = NULL FROM rimesse r WHERE u.undo_id = r.undo_id;

-- 3. La CONFERMATA torna in vigore.
INSERT INTO sys.sys_tenant_consolidation_decisions
  (tenant_consolidation_decision_id, tenant_consolidation_decision_proposal_id, tenant_consolidation_decision_tenant_id,
   tenant_consolidation_decision_value, tenant_consolidation_decision_form, tenant_consolidation_decision_adr48_state,
   tenant_consolidation_decision_reason, tenant_consolidation_decision_decided_by, tenant_consolidation_decision_supersedes_id)
SELECT p.dec_nuova, p.proposta, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', 'CONFERMATA', p.forma_orig, p.stato_orig,
       'Inversa di separa-tre-accorpamenti.sql: torna l''accorpamento del 2026-11-17.',
       '8f4d0161-04ab-5ddb-b5a1-c8656f9c1fa1', p.dec_rif
  FROM prop p;

UPDATE sys.sys_tenant_consolidation_links l
   SET tenant_consolidation_link_decision_id = p.dec_nuova, tenant_consolidation_link_decision = 'CONFERMATA',
       tenant_consolidation_link_form = p.forma_orig, tenant_consolidation_link_adr48_state = p.stato_orig,
       tenant_consolidation_link_report = jsonb_build_object('inversa', true), tenant_consolidation_link_applied_at = now()
  FROM prop p WHERE l.tenant_consolidation_link_proposal_id = p.proposta;

DO $$
BEGIN
  IF (SELECT count(*) FROM spenti) <> 3 OR (SELECT count(*) FROM rimesse) <> 3 THEN
    RAISE EXCEPTION 'post-condizione: spenti %, descrizioni rimesse % (attesi 3 e 3)', (SELECT count(*) FROM spenti), (SELECT count(*) FROM rimesse);
  END IF;
  IF (SELECT count(*) FROM sys.v_tenant_processes_parent_defects) <> 0 THEN
    RAISE EXCEPTION 'post-condizione: difetti nella sentinella dei genitori';
  END IF;
  RAISE NOTICE 'inversa: % sottoprocessi spenti, % descrizioni rimesse, 3 decisioni CONFERMATA',
    (SELECT count(*) FROM spenti), (SELECT count(*) FROM rimesse);
END $$;

\if :applica
  COMMIT;
  \echo 'APPLICATO'
\else
  ROLLBACK;
  \echo 'PROVA A SECCO: niente scritto (per applicare: -v applica=1)'
\endif
