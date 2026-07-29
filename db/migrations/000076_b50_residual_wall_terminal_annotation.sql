-- =============================================================================
-- 000076_b50_residual_wall_terminal_annotation.sql
-- -----------------------------------------------------------------------------
-- B-50 reconciliation residual walls — TERMINAL-ANNOTATION close (S972, 2026-06-07).
--
-- Moves the 7 reconciliation tables that RESOLVE to 'NEEDS_DECISION' in
-- sys.v_reconciliation_status (an open/ambiguous state) to explicit terminal/
-- deferred states with MEASURED rationale, so the open state is documented and
-- closed. Bookkeeping/docs only — NO sys.* business table is populated (the actual
-- DATA import of the deferred tables is multi-session + gated on PM semantic
-- authority — OUT OF SCOPE).
--
-- Resolution mechanic (verified from sys.fn_reconciliation_status()):
--   resolved_status = has_rows ? POPULATED
--                   : card_classification (brownfield.table_mappings) IS NOT NULL ? <card>
--                   : declared_status (registry) IS NOT NULL ? <declared>
--                   : UNCLASSIFIED
-- The 7 target tables have NO brownfield card (card_classification IS NULL) and 0
-- rows, so the registry declared_status is exactly what surfaces in the view.
-- This mirrors the 17 existing NO_SOURCE tables (all registry-declared, no card).
-- NOTE: many OTHER registry rows also carry declared_status='NEEDS_DECISION' but
-- resolve to POPULATED/<card> in the view (has_rows / card wins first); only these
-- 7 actually RESOLVE to NEEDS_DECISION — hence asserts measure the VIEW, not the
-- raw registry declared_status count.
--
-- DEVIATION FROM B-42 PRECEDENT (commit 6b33d0b): B-42 added a brownfield card
-- (IMPORT->EXCLUDE) because EXCLUDE is a valid brownfield classification. NO_SOURCE
-- is NOT in the brownfield_table_mapping_classification CHECK
-- (IMPORT/TRANSFORM/REFERENCE_ONLY/EXCLUDE only), so a card CANNOT express NO_SOURCE
-- and would wrongly override the registry. Hence the 4 TERMINAL tables are closed via
-- registry declared_status='NO_SOURCE' ONLY (no brownfield card) — the same path the
-- existing 17 NO_SOURCE tables use.
--
-- TRANSACTION: db/scripts/migrate.sh applies every file with `psql -1` (one txn per
-- file) + ON_ERROR_STOP=1, so this file must NOT open its own BEGIN/COMMIT (that
-- triggers "already a transaction in progress" and double-nesting). The DO-block
-- assert at the end aborts (rolls back the whole file) if the end state is wrong.
--
-- MEASURED verdicts (RE-VERIFIED live S972 — advanced DB localhost:5433 + legacy
-- heuresys_platform on oracle-vm-default):
--   TERMINAL -> NO_SOURCE (no usable 1:1 populated source):
--     sys_payout_curves         no legacy curve/payout catalog (only view v_calibration_bell_curve)
--     sys_reward_gate_results   gate_id NOT NULL; sys_reward_gates=0 (cascade) + no gate-verdict source
--     sys_successor_readiness   candidate_id NOT NULL; sys_successor_candidates=0 (cascade);
--                               legacy readiness_level=varchar (categorical, no numeric score)
--     sys_user_target_positions career_goals(60)/career_path_recommendations(85) exist but
--                               resolve 0/60 to RTL users (0-overlap; derived/aspirational)
--   DEFER -> keep NEEDS_DECISION (legacy source EXISTS, blocked on PM bridge / Wave-2):
--     sys_branches              locations=34 EXISTS; branch_organization_unit_id NOT NULL+UNIQUE vs
--                               legacy org_units->location 47 FKs -> 13 distinct (inverse cardinality);
--                               needs PM-authored location<->org_unit pairing
--     sys_succession_pools      talent_pools=24 EXISTS; succession_plans.position_id 31/31 NULL;
--                               succession_pool_position_id NOT NULL; needs PM job/role->position bridge
--     sys_successor_candidates  succession_candidates=206/talent_pool_members=40 EXIST;
--                               successor_candidate_pool_id NOT NULL cascade on empty pools (coupled to pools)
--
-- IDEMPOTENT: marker-guarded UPDATEs (re-runnable to the same end state).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) TERMINAL -> NO_SOURCE (4 tables). Flip declared_status + prepend measured
--    rationale + set a wall tag. Guarded by the [B-50 TERMINAL S972] marker so a
--    re-run is a no-op on rationale (and the status flip is naturally idempotent).
-- ---------------------------------------------------------------------------
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_declared_status = 'NO_SOURCE',
  reconciliation_registry_wall = COALESCE(NULLIF(r.reconciliation_registry_wall, ''), 'no_usable_source'),
  reconciliation_registry_rationale =
    CASE WHEN r.reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%'
         THEN r.reconciliation_registry_rationale
         ELSE d.note || ' | ' || r.reconciliation_registry_rationale END,
  reconciliation_registry_decided_at = now()
FROM (VALUES
  ('sys_payout_curves',
   '[B-50 TERMINAL S972] -> NO_SOURCE no-catalog: re-verified legacy heuresys_platform has NO standalone curve/payout catalog table (only the view v_calibration_bell_curve); curve shapes are human-authored config. NEEDS_DECISION closed terminal.'),
  ('sys_reward_gate_results',
   '[B-50 TERMINAL S972] -> NO_SOURCE cascade+derived: reward_gate_result_gate_id NOT NULL and parent sys_reward_gates=0 rows (re-verified); no legacy gate-verdict source exists. Derived analytics, no 1:1 source. NEEDS_DECISION closed terminal.'),
  ('sys_successor_readiness',
   '[B-50 TERMINAL S972] -> NO_SOURCE no-numeric-source+cascade: successor_readiness_candidate_id NOT NULL and parent sys_successor_candidates=0 rows (re-verified); legacy succession_candidates.readiness_level is varchar CATEGORICAL (already mapped into sys_successor_candidates), NOT a numeric score. Derived. NEEDS_DECISION closed terminal.'),
  ('sys_user_target_positions',
   '[B-50 TERMINAL S972] -> NO_SOURCE 0-overlap: legacy career_goals(60)/career_path_recommendations(85) exist but resolve 0/60 to active RTL users (re-verified) -> no usable populated 1:1 (user,position) target source. Derived/aspirational. NEEDS_DECISION closed terminal.')
) AS d(tbl, note)
WHERE r.reconciliation_registry_table_name = d.tbl;

-- ---------------------------------------------------------------------------
-- 2) DEFER (3 tables): keep NEEDS_DECISION, set an explicit DEFER rationale that
--    cites the PM-bridge / Wave-2 blocker + that it needs PM semantic authority.
--    sys_succession_pools / sys_successor_candidates already carry a [DEFER S970]
--    marker; sys_branches did NOT (was a "DEAD-END candidate"). The marker-guard
--    [B-50 DEFER S972] makes this idempotent and adds the explicit DEFER note +
--    PM-authority statement uniformly. declared_status stays NEEDS_DECISION.
-- ---------------------------------------------------------------------------
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_rationale =
    CASE WHEN r.reconciliation_registry_rationale LIKE '%[B-50 DEFER S972]%'
         THEN r.reconciliation_registry_rationale
         ELSE d.note || ' | ' || r.reconciliation_registry_rationale END,
  reconciliation_registry_decided_at = now()
FROM (VALUES
  ('sys_branches',
   '[B-50 DEFER S972] keep NEEDS_DECISION (needs PM semantic authority): legacy locations=34 EXISTS (1:1 address fields) so NOT no-source, BUT branch_organization_unit_id is NOT NULL + UNIQUE while legacy org_units->location is many->one (47 FKs -> 13 distinct locations, re-verified) = inverse cardinality. Blocked on a PM-authored location<->org_unit pairing bridge.'),
  ('sys_succession_pools',
   '[B-50 DEFER S972] keep NEEDS_DECISION (needs PM semantic authority / Wave-2): legacy talent_pools=24 (+members=40) EXISTS, BUT succession_pool_position_id NOT NULL and legacy succession_plans.position_id is 31/31 NULL (re-verified), talent_pools has no position key. Blocked on a PM job/role->position bridge or a Wave-2 position_id backfill.'),
  ('sys_successor_candidates',
   '[B-50 DEFER S972] keep NEEDS_DECISION (needs PM semantic authority / Wave-2): legacy succession_candidates=206 (+talent_pool_members=40) EXIST and person FK resolves via legacy employees (I14), BUT successor_candidate_pool_id NOT NULL is cascade-blocked on empty sys_succession_pools (legacy succession_candidates has no pool_id column). Coupled to sys_succession_pools — same PM/Wave-2 bridge.')
) AS d(tbl, note)
WHERE r.reconciliation_registry_table_name = d.tbl;

-- ---------------------------------------------------------------------------
-- 3) Post-condition assert — measured against the VIEW (resolved_status), which
--    is the surface the whole reconciliation system reads:
--      * the 4 terminal tables resolve to NO_SOURCE
--      * the 3 defer tables carry a non-empty rationale and are either still
--        NEEDS_DECISION (pre-Wave-2) or POPULATED (post Wave-2 close S982:
--        mig 000106 + seeds 49-50 import them — re-runs of THIS file must stay
--        green in both worlds, per the migrate.sh twice-run invariant)
--      * VIEW-wide NEEDS_DECISION equals exactly the residual of these 3
--      * each row carries its B-50 marker (idempotent re-run safety)
--    [S982 amendment] the original assert pinned NEEDS_DECISION=3 and broke the
--    full-chain re-run after the Wave-2 import; now state-aware (D-12 pattern).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_terminal_no_source int;
  v_defer_closed       int;
  v_defer_still_nd     int;
  v_view_needs_dec     int;
  v_terminal_marked    int;
  v_defer_marked       int;
BEGIN
  -- 4 terminal tables resolve to NO_SOURCE in the view
  SELECT count(*) INTO v_terminal_no_source
    FROM sys.v_reconciliation_status
   WHERE table_name IN
         ('sys_payout_curves','sys_reward_gate_results','sys_successor_readiness','sys_user_target_positions')
     -- NO_SOURCE *oppure* POPULATED: la decisione B-50 dice che queste quattro
     -- tabelle non hanno una sorgente nel legacy, e resta vera anche adesso che
     -- il programma storia36 le ha riempite — i dati non vengono dal legacy,
     -- vengono da lì. Pretendere NO_SOURCE significherebbe pretendere che
     -- restino vuote per sempre, e questa migration fallirebbe alla prima
     -- riesecuzione su un database vivo (è successo: `pnpm db:validate` si
     -- fermava qui).
     AND resolved_status IN ('NO_SOURCE', 'POPULATED');

  -- 3 defer tables: valid in BOTH worlds (NEEDS_DECISION pre-Wave-2, POPULATED post-S982)
  SELECT count(*) INTO v_defer_closed
    FROM sys.v_reconciliation_status
   WHERE table_name IN ('sys_branches','sys_succession_pools','sys_successor_candidates')
     AND resolved_status IN ('NEEDS_DECISION', 'POPULATED')
     AND coalesce(length(trim(rationale)), 0) > 0;

  SELECT count(*) INTO v_defer_still_nd
    FROM sys.v_reconciliation_status
   WHERE table_name IN ('sys_branches','sys_succession_pools','sys_successor_candidates')
     AND resolved_status = 'NEEDS_DECISION';

  -- view-wide NEEDS_DECISION must be exactly the residual of these 3 (3 pre-Wave-2, 0 after)
  SELECT count(*) INTO v_view_needs_dec
    FROM sys.v_reconciliation_status
   WHERE resolved_status = 'NEEDS_DECISION';

  SELECT count(*) INTO v_terminal_marked
    FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%';

  SELECT count(*) INTO v_defer_marked
    FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_rationale LIKE '%[B-50 DEFER S972]%';

  RAISE NOTICE 'B-50: view terminal NO_SOURCE=% (exp 4), defer closed-or-nd=% (exp 3, of which still NEEDS_DECISION=%), view-wide NEEDS_DECISION=% (exp = residual), terminal-marked=% (exp 4), defer-marked=% (exp 3)',
    v_terminal_no_source, v_defer_closed, v_defer_still_nd, v_view_needs_dec, v_terminal_marked, v_defer_marked;

  IF v_terminal_no_source <> 4 THEN
    RAISE EXCEPTION 'B-50 assert: expected 4 terminal tables resolve NO_SOURCE-or-POPULATED in view, got %', v_terminal_no_source;
  END IF;
  IF v_defer_closed <> 3 THEN
    RAISE EXCEPTION 'B-50 assert: expected 3 defer tables NEEDS_DECISION-or-POPULATED with rationale in view, got %', v_defer_closed;
  END IF;
  IF v_view_needs_dec <> v_defer_still_nd THEN
    RAISE EXCEPTION 'B-50 assert: expected view-wide NEEDS_DECISION=% (residual of the 3 defer tables), got %', v_defer_still_nd, v_view_needs_dec;
  END IF;
  IF v_terminal_marked <> 4 THEN
    RAISE EXCEPTION 'B-50 assert: expected 4 terminal-marked rationales, got %', v_terminal_marked;
  END IF;
  IF v_defer_marked <> 3 THEN
    RAISE EXCEPTION 'B-50 assert: expected 3 defer-marked rationales, got %', v_defer_marked;
  END IF;
END $$;
