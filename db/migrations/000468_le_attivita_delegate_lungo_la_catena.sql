-- ============================================================================================
-- 000468 — Le attività delegate lungo la catena (ADR-0051, accettato da Enzo il 2026-10-31 18:12 ora di Roma).
--
-- IL PRINCIPIO. Un capo (chi dirige un'unità, oppure chi ha posizioni che riportano alla sua) delega una SUA
-- attività a una persona della sua catena, mai oltre ciò che lui stesso può fare. La catena e la validità si
-- controllano nel servizio, a ogni uso (`apps/api/src/lib/scope/org.ts`, `delegationChainUserIds`): un vincolo
-- di catena non si scrive in un CHECK, perché l'organigramma cambia dopo che la riga è nata.
--
-- COSA FA.
--   ① l'ambito PROCESS_STEP: la delega di un'attività di processo (ADR-0049), con la sua colonna;
--   ② la colonna del tipo di richiesta, facoltativa, per restringere una delega APPROVALS a un tipo
--     (per esempio solo le ferie e i permessi);
--   ③ la firma «per conto di» sui passi di approvazione: la delega in forza della quale il passo è stato deciso;
--   ④ la pagina «Deleghe» nell'area personale (`/me/delegations`), con la sua voce di menu e l'etichetta inglese.
--     Pagina ESS: nessun permesso richiesto e visibile a ogni persona autenticata, come le altre di 000168;
--     chi non è capo di nessuno vi trova solo le deleghe ricevute.
-- Il CHECK dell'ambito nasce in 000314, EMENDATA alla fonte in questo stesso incremento (ADR-0035); qui si cambia
-- l'esemplare esistente, che un CREATE TABLE IF NOT EXISTS non ricrea. La 000465 non lo tocca più, perché il suo
-- controllo cerca solo CONSOLIDATION e lo trova.
--
-- IL TIPO DI DELEGA NON È UNA COLONNA. Si legge dall'ambito: APPROVALS e PROCESS_STEP sono deleghe di catena,
-- CONSOLIDATION e FULL deleghe di mandato. Una colonna in più sarebbe una seconda verità che può divergere.
--
-- IDEMPOTENTE. NESSUNA CANCELLAZIONE: il CHECK si allarga, le colonne nascono vuote, nessuna delega esistente
-- diventa non valida. MISURA PRIMA E DOPO: il numero delle deleghe e dei passi decisi non cambia.
-- ============================================================================================

\set ON_ERROR_STOP on

CREATE TEMP TABLE _misura_prima_000468 AS
  SELECT (SELECT count(*) FROM sys.sys_user_delegations) AS deleghe,
         (SELECT count(*) FROM sys.sys_approval_steps WHERE approval_step_decided_at IS NOT NULL) AS passi_decisi;

BEGIN;

-- ── ① e ② le colonne della delega ──────────────────────────────────────────────────────────
ALTER TABLE sys.sys_user_delegations
  ADD COLUMN IF NOT EXISTS user_delegation_request_type varchar(64);
ALTER TABLE sys.sys_user_delegations
  ADD COLUMN IF NOT EXISTS user_delegation_tenant_process_step_id uuid
    REFERENCES sys.sys_tenant_process_steps(tenant_process_step_id) ON DELETE RESTRICT;

COMMENT ON COLUMN sys.sys_user_delegations.user_delegation_request_type IS
  '000468 (ADR-0051) — per una delega APPROVALS, il solo tipo di richiesta delegato; nullo = tutti i tipi delegabili.';
COMMENT ON COLUMN sys.sys_user_delegations.user_delegation_tenant_process_step_id IS
  '000468 (ADR-0051) — per una delega PROCESS_STEP, l''attività di processo delegata; nulla per gli altri ambiti.';

CREATE INDEX IF NOT EXISTS sys_user_delegations_step_idx
  ON sys.sys_user_delegations (user_delegation_tenant_process_step_id)
  WHERE user_delegation_tenant_process_step_id IS NOT NULL;

-- l'esemplare del CHECK dell'ambito, cercato PER NOME: il CHECK dell'oggetto qui sotto nomina anch'esso l'ambito,
-- e una ricerca sul testo lo scambierebbe per questo. Si sostituisce solo se non ammette già PROCESS_STEP.
DO $$
DECLARE nome text; def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid) INTO nome, def
    FROM pg_constraint c
   WHERE c.conrelid = 'sys.sys_user_delegations'::regclass AND c.contype = 'c'
     AND c.conname = 'sys_user_delegations_user_delegation_scope_check';
  IF def IS NULL OR def NOT LIKE '%PROCESS_STEP%' THEN
    IF nome IS NOT NULL THEN EXECUTE format('ALTER TABLE sys.sys_user_delegations DROP CONSTRAINT %I', nome); END IF;
    ALTER TABLE sys.sys_user_delegations ADD CONSTRAINT sys_user_delegations_user_delegation_scope_check
      CHECK (user_delegation_scope IN ('APPROVALS', 'FULL', 'CONSOLIDATION', 'PROCESS_STEP'));
  END IF;
END $$;

-- coerenza fra ambito e oggetto: l'attività solo, e sempre, per PROCESS_STEP; il tipo di richiesta solo per APPROVALS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'sys.sys_user_delegations'::regclass AND conname = 'sys_user_delegations_oggetto_ck') THEN
    ALTER TABLE sys.sys_user_delegations ADD CONSTRAINT sys_user_delegations_oggetto_ck CHECK (
      ((user_delegation_scope = 'PROCESS_STEP') = (user_delegation_tenant_process_step_id IS NOT NULL))
      AND (user_delegation_request_type IS NULL OR user_delegation_scope = 'APPROVALS'));
  END IF;
END $$;

-- ── ③ la firma «per conto di» ─────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_approval_steps
  ADD COLUMN IF NOT EXISTS approval_step_acting_delegation_id uuid
    REFERENCES sys.sys_user_delegations(user_delegation_id) ON DELETE RESTRICT;

COMMENT ON COLUMN sys.sys_approval_steps.approval_step_acting_delegation_id IS
  '000468 (ADR-0051) — la delega in forza della quale il passo è stato deciso: decided_by è il delegato, approver resta il delegante.';

CREATE INDEX IF NOT EXISTS sys_approval_steps_acting_delegation_idx
  ON sys.sys_approval_steps (approval_step_acting_delegation_id)
  WHERE approval_step_acting_delegation_id IS NOT NULL;

-- ── ④ la pagina nell'area personale ──────────────────────────────────────────────────────
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('me-delegations', 'Deleghe', '/me/delegations', 'Users', 'personal', 'PERSONAL', NULL, NULL, false, 52)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- `sys_reference_translations` non ha un vincolo di unicità: il guardiano è un NOT EXISTS (come in 000306).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'Delegations', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_route = '/me/delegations'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations x
      WHERE x.entity_table = 'sys_ui_interfaces' AND x.entity_id = i.ui_interface_id
        AND x.field = 'ui_interface_label' AND x.locale = 'en');

COMMIT;

-- ── post-condizioni ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE n_col int; n_ck int; d_prima bigint; d_dopo bigint; p_prima bigint; p_dopo bigint;
BEGIN
  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema = 'sys'
     AND ((table_name = 'sys_user_delegations'
           AND column_name IN ('user_delegation_request_type', 'user_delegation_tenant_process_step_id'))
       OR (table_name = 'sys_approval_steps' AND column_name = 'approval_step_acting_delegation_id'));
  IF n_col <> 3 THEN RAISE EXCEPTION '000468: le colonne nuove sono % invece di 3', n_col; END IF;

  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conrelid = 'sys.sys_user_delegations'::regclass AND contype = 'c'
     AND (conname = 'sys_user_delegations_oggetto_ck'
          OR (conname = 'sys_user_delegations_user_delegation_scope_check'
              AND pg_get_constraintdef(oid) LIKE '%PROCESS_STEP%' AND pg_get_constraintdef(oid) LIKE '%CONSOLIDATION%'));
  IF n_ck <> 2 THEN RAISE EXCEPTION '000468: i CHECK dell''ambito e dell''oggetto sono % invece di 2', n_ck; END IF;

  IF (SELECT count(*) FROM sys.sys_ui_interfaces WHERE ui_interface_route = '/me/delegations') <> 1 THEN
    RAISE EXCEPTION '000468: la pagina /me/delegations non ha una e una sola voce di menu';
  END IF;
  IF (SELECT count(*) FROM sys.sys_reference_translations x JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = x.entity_id
       WHERE x.entity_table = 'sys_ui_interfaces' AND i.ui_interface_route = '/me/delegations' AND x.locale = 'en') <> 1 THEN
    RAISE EXCEPTION '000468: l''etichetta inglese della pagina /me/delegations non è una e una sola';
  END IF;

  SELECT deleghe, passi_decisi INTO d_prima, p_prima FROM _misura_prima_000468;
  SELECT count(*) INTO d_dopo FROM sys.sys_user_delegations;
  SELECT count(*) INTO p_dopo FROM sys.sys_approval_steps WHERE approval_step_decided_at IS NOT NULL;
  IF d_prima <> d_dopo THEN RAISE EXCEPTION '000468: le deleghe erano % e ora sono %', d_prima, d_dopo; END IF;
  IF p_prima > p_dopo THEN RAISE EXCEPTION '000468: i passi decisi erano % e ora sono %', p_prima, p_dopo; END IF;

  RAISE NOTICE '000468 ok — ambito PROCESS_STEP, tipo di richiesta, firma per conto di; % deleghe invariate', d_dopo;
END $$;

DROP TABLE _misura_prima_000468;
