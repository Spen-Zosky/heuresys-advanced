-- =============================================================================
-- 000106_wave2_succession_branches_close.sql
-- -----------------------------------------------------------------------------
-- Wave-2 / B-50 CLOSE (S982, 2026-06-10) — registry close of the last 3
-- NEEDS_DECISION tables, now imported by seeds 49-50 under PM decisions D1-D3
-- (Enzo 2026-06-10, dossiers docs/kb/B50_DEFER_UNBLOCK_PACKAGE.md +
-- docs/kb/WAVE2_UNBLOCK_PACKAGE.md):
--   D1: sys_branches = option B (6 branches, anchor-OU rule; 10 orphan RTL
--       locations = terminal residue, duplicate legacy seed series).
--   D2: succession = incumbent-anchor (15 pools) + CEO/CFO title-match (2 pools,
--       PM sign-off) -> 17 pools + 25 candidates (seeds 49).
--   D3: talent_pools (24) + talent_pool_members (40) = WON''T-DO explicit
--       (criterion-pools, no position semantics, incompatible with the
--       position-centric target); career cluster (~2,300 legacy rows, job FKs
--       100% NULL, no advanced target) + 86 anchor-less candidates + 12
--       candidates on unpooled plans = declared OUT-OF-SCOPE (terminal).
--
-- FALSE-FRIEND CORRECTION (supersedes S972 rationale): the S972 note "legacy
-- succession_candidates has no pool_id column" is SUPERSEDED — measured 120/120
-- (and confirmed at DDL level: FK succession_candidates_critical_role_id_fkey
-- REFERENCES succession_plans(id)): succession_candidates.critical_role_id
-- points to succession_plans.id, NOT critical_roles. The plan->candidate anchor
-- EXISTS and drove the seed-49 cascade.
--
-- Registry mechanic (unchanged from 000076): resolved_status = has_rows ?
-- POPULATED : card : declared_status. The 3 tables have NO brownfield card; the
-- 'WON''T-DO' value does NOT exist in the declared_status CHECK -> the WON'T-DO
-- verdicts live in rationale text; declared_status flips to 'IMPORT' (the
-- accurate state: an executed import; the view shows POPULATED via has_rows).
--
-- ALSO: sys_successor_readiness rationale refresh — its S972 NO_SOURCE verdict
-- had TWO branches; the "cascade parent=0" branch decays now that
-- sys_successor_candidates is populated; the verdict STANDS on the
-- no-numeric-score branch. Status unchanged (NO_SOURCE), rationale prepended
-- (the [B-50 TERMINAL S972] marker is preserved — tests LIKE-match it).
--
-- TRANSACTION: migrate.sh applies with `psql -1` — NO BEGIN/COMMIT here.
-- IDEMPOTENT: marker-guarded UPDATEs ([WAVE2 CLOSE S982] / [WAVE2 S982]).
-- FRESH-REBUILD SAFE: hard asserts only on registry state + view-wide
-- NEEDS_DECISION=0 (true both before seeds run — declared IMPORT — and after —
-- POPULATED); row-count asserts are conditional with a WARNING when seeds 49-50
-- have not run yet.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) The 3 imported tables: declared_status -> IMPORT + measured close rationale.
-- ---------------------------------------------------------------------------
-- NOTE: reconciliation_registry_wall is kept (historical record of the resolved
-- wall — the bucket-B invariant test requires every B row to name its wall);
-- the RESOLUTION is recorded in the rationale below.
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_declared_status = 'IMPORT',
  reconciliation_registry_legacy_source = d.src,
  reconciliation_registry_rationale =
    CASE WHEN r.reconciliation_registry_rationale LIKE '%[WAVE2 CLOSE S982]%'
         THEN r.reconciliation_registry_rationale
         ELSE d.note || ' | ' || r.reconciliation_registry_rationale END,
  reconciliation_registry_decided_at = now()
FROM (VALUES
  ('sys_branches',
   'public.locations (34; 6 imported, 10 orphan RTL = terminal residue)',
   '[WAVE2 CLOSE S982] IMPORTED (seed 50, PM decision D1=B): 6 branches (5 RTL + 1 HS) via anchor-OU rule — one branch per referenced location, anchored to the TOPMOST advanced OU of the referencing group (MI-HQ->RTL root, MI-OPS->DIV-OPS, 3 FIL-* 1:1, HS-HQ->HS-CORP root), resolved deterministically via organization_unit_metadata.legacy_org_unit_id. The 10 RTL locations referenced by no org_unit are a duplicate pre-existing legacy seed series (BG01~BG-CEN, HQ~MI-HQ, ...) = TERMINAL residue, not importable org data. country ITA->IT; location name/phone/email in branch_metadata.'),
  ('sys_succession_pools',
   'public.succession_plans (31) + public.critical_roles (16); public.talent_pools (24) + talent_pool_members (40) = WON''T-DO (criterion-pools, no position semantics)',
   '[WAVE2 CLOSE S982] IMPORTED (seed 49, PM decision D2): 17 pools (16 RTL + 1 HS) = 15 incumbent-anchor (pool position = incumbent''s PRIMARY/ACTIVE position via LEGACY_EMP:: crosswalk, measured 15/15 distinct) + 2 PM-signed title-match (CEO->POS-00000321 exact unique, CFO->Finance Director POS-00000384 fuzzy unique). NOT imported: RTL plans Branch Director Milano + Head of Corporate Banking (no incumbent, no title match) and HS CEO&Founder + CTO/Head of Product (incumbents not in advanced) = terminal. talent_pools+members = WON''T-DO explicit (PM D3): generic criterion-pools, structurally incompatible with the position-centric NOT NULL target; no ADR/schema change.'),
  ('sys_successor_candidates',
   'public.succession_candidates (206; 25 imported via plan-cascade)',
   '[WAVE2 CLOSE S982] IMPORTED (seed 49, PM decision D2/D3): 25 candidates (24 RTL on the 8 pooled plans + 1 HS DEACTIVATED-user candidate on the COO pool). FALSE-FRIEND CORRECTED (supersedes the S972 note "no pool_id column"): succession_candidates.critical_role_id REFERENCES succession_plans(id) — measured 120/120 + explicit DDL FK — so the plan->candidate cascade EXISTS. Readiness mapped (ready_now/1y/2y 1:1; ready_3*/development_needed->NOT_READY, raw in metadata). TERMINAL residue (PM D3): 86 anchor-less candidates + 12 candidates on unpooled plans + 1 HS candidate unresolved in advanced; legacy career cluster (~2,300 rows, job FKs 100% NULL, no advanced target) = OUT-OF-SCOPE Wave-2 declared.')
) AS d(tbl, src, note)
WHERE r.reconciliation_registry_table_name = d.tbl;

-- ---------------------------------------------------------------------------
-- 2) sys_successor_readiness — rationale-only refresh (status stays NO_SOURCE).
-- ---------------------------------------------------------------------------
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_rationale =
    CASE WHEN r.reconciliation_registry_rationale LIKE '%[WAVE2 S982]%'
         THEN r.reconciliation_registry_rationale
         ELSE '[WAVE2 S982] cascade-parent branch DECAYED (sys_successor_candidates now populated by seed 49); the NO_SOURCE verdict STANDS on the no-numeric-score branch (legacy readiness_level is categorical, already mapped into sys_successor_candidates.readiness_level + metadata). | '
              || r.reconciliation_registry_rationale END,
  reconciliation_registry_decided_at = now()
WHERE r.reconciliation_registry_table_name = 'sys_successor_readiness';

-- ---------------------------------------------------------------------------
-- 3) Post-condition asserts.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_declared_import int;
  v_marked          int;
  v_view_needs_dec  int;
  v_readiness_ok    int;
  v_branches        int;
  v_pools           int;
  v_cands           int;
  v_populated3      int;
BEGIN
  SELECT count(*) INTO v_declared_import
    FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN ('sys_branches','sys_succession_pools','sys_successor_candidates')
     AND reconciliation_registry_declared_status = 'IMPORT';

  SELECT count(*) INTO v_marked
    FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_rationale LIKE '%[WAVE2 CLOSE S982]%';

  SELECT count(*) INTO v_view_needs_dec
    FROM sys.v_reconciliation_status
   WHERE resolved_status = 'NEEDS_DECISION';

  -- readiness row: still NO_SOURCE, carries BOTH the new marker and the preserved S972 marker
  SELECT count(*) INTO v_readiness_ok
    FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name = 'sys_successor_readiness'
     AND reconciliation_registry_declared_status = 'NO_SOURCE'
     AND reconciliation_registry_rationale LIKE '%[WAVE2 S982]%'
     AND reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%';

  RAISE NOTICE 'WAVE2 close: declared IMPORT=% (exp 3), marked=% (exp 3), view-wide NEEDS_DECISION=% (exp 0), readiness ok=% (exp 1)',
    v_declared_import, v_marked, v_view_needs_dec, v_readiness_ok;

  IF v_declared_import <> 3 THEN
    RAISE EXCEPTION 'WAVE2 assert: expected 3 rows declared IMPORT, got %', v_declared_import;
  END IF;
  IF v_marked <> 3 THEN
    RAISE EXCEPTION 'WAVE2 assert: expected 3 [WAVE2 CLOSE S982] markers, got %', v_marked;
  END IF;
  IF v_view_needs_dec <> 0 THEN
    RAISE EXCEPTION 'WAVE2 assert: expected view-wide NEEDS_DECISION=0, got %', v_view_needs_dec;
  END IF;
  IF v_readiness_ok <> 1 THEN
    RAISE EXCEPTION 'WAVE2 assert: sys_successor_readiness state wrong (status/markers), got %', v_readiness_ok;
  END IF;

  -- Conditional data asserts: hard only when the seeds have run (live DB);
  -- on a fresh rebuild (migrations run before seeds) emit a WARNING instead.
  SELECT count(*) INTO v_branches FROM sys.sys_branches;
  -- [S1048] I bacini IMPORTATI, non tutti quelli presenti — stesso ragionamento
  -- già applicato qui sotto ai candidati, esteso perché lo stato è cambiato di
  -- nuovo. La 000278 (#160) ha rimosso i bacini agganciati a posizioni sbagliate
  -- o disattivate, e un conteggio totale fotograferebbe di nuovo uno stato invece
  -- di verificare l'import. Quelli importati dal Wave-2 si riconoscono
  -- dall'`anchor` nei metadati, che solo il seed 49 scrive.
  SELECT count(*) INTO v_pools    FROM sys.sys_succession_pools
   WHERE succession_pool_metadata ? 'anchor';
  -- I candidati IMPORTATI, non tutti quelli presenti: la storia ne aggiunge
  -- (scelti col criterio di successione) e ne toglie (quelli senza criterio),
  -- e un conteggio totale qui fotograferebbe uno stato invece di verificare
  -- l'import. Si riconoscono dalla provenienza, che solo l'import scrive.
  SELECT count(*) INTO v_cands    FROM sys.sys_successor_candidates
   WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL;
  IF v_branches = 0 AND v_pools = 0 AND v_cands = 0 THEN
    RAISE WARNING 'WAVE2 close: targets empty — fresh rebuild detected; run db/seeds/reconciliation/49 + 50 after migrations.';
  ELSE
    -- L'import ha portato 25 candidati e 17 bacini; la storia può averne rimossi
    -- — mai aggiunti con quella provenienza, ed è questo che si verifica: il
    -- limite è verso l'ALTO, perché superarlo significherebbe che qualcuno sta
    -- scrivendo righe spacciandole per import.
    --
    -- [S1048] Anche i BACINI passano a un limite verso l'alto, e il motivo è che
    -- un numero fisso qui non può essere giusto: questa migrazione gira PRIMA
    -- della 000278 (#160) nella catena, quindi su un clone che parte da zero vede
    -- 17 bacini, mentre su un database già allineato ne vede 7 — la 000278 ha
    -- rimosso quelli agganciati a un ruolo critico che non era il loro
    -- (`Chief Executive Officer` su `Securities Dealer`, il `CFO` su `Bank
    -- Teller`) e quelli appesi a posizioni disattivate. Pinnare uno dei due stati
    -- rompe l'altro: misurato, `pools <> 7` ha fatto fallire la CI, dove la catena
    -- riparte dall'inizio. L'invariante vero è lo stesso dei candidati — l'import
    -- non ha prodotto PIÙ di quanto dichiarato — e vale in entrambi i momenti.
    -- Il minimo di 1 candidato è stato tolto per la stessa ragione di sostanza:
    -- zero importati superstiti è l'esito corretto della 000278, non un import
    -- perso (le righe sono in `staging.storia36_160_undo`).
    IF v_branches <> 6 OR v_pools > 17 OR v_cands > 25 THEN
      RAISE EXCEPTION 'WAVE2 assert: imported counts wrong branches=% pools=% candidates=% (exp 6 / pools<=17 / cands<=25)', v_branches, v_pools, v_cands;
    END IF;
    SELECT count(*) INTO v_populated3
      FROM sys.v_reconciliation_status
     WHERE table_name IN ('sys_branches','sys_succession_pools','sys_successor_candidates')
       AND resolved_status = 'POPULATED';
    IF v_populated3 <> 3 THEN
      RAISE EXCEPTION 'WAVE2 assert: expected the 3 targets POPULATED in view, got %', v_populated3;
    END IF;
  END IF;
END $$;
