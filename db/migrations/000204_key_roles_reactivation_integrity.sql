-- ============================================================================
-- 000204_key_roles_reactivation_integrity.sql — completamento coerente del
-- mandato #70 (S1025, "copri i ruoli chiave vacanti").
--
-- BUG S1025 misurato (2026-07-22): il seed `seed_key_roles_coverage.sql`
-- riattivò le catene ENDED di alice.esposito (POS-00000396, Chief Risk
-- Officer) e alberto.colombo (POS-00000350, Securities Dealer) SENZA
-- riattivare gli UTENTI, rimasti `DEACTIVATED`. La 000188 §D (invariante
-- offboarding: nessun assignment ACTIVE per utenti DEACTIVATED) è idempotente
-- e rigira a ogni `db:migrate` → ri-chiudeva le due catene a ogni re-run:
-- il CRO tornava vacante, 2 righe gap_analysis restavano orfane (158 righe vs
-- 156 utenti attivi — intercettato da reconciliation-f2-imports) e i due
-- comparivano "(unassigned)" nelle analytics.
--
-- FIX PERMANENTE (non compensativo): i due utenti tornano ACTIVE — è il
-- significato del mandato #70 (una riassegnazione interna È una riattivazione
-- del dipendente) — e le loro catene PRIMARY tornano ACTIVE senza end_date.
-- Con user_status='ACTIVE' la 000188 §D non li tocca più: nessuna rincorsa
-- tra migration. Posizioni verificate esclusive (nessun doppio titolare).
--
-- IDEMPOTENTE + twice-run: al 2° giro 0 righe toccate. Authored: 2026-07-22 (S1026).
-- ============================================================================

UPDATE sys.sys_users
   SET user_status = 'ACTIVE', updated_at = now()
 WHERE user_email IN ('alice.esposito@rtl-bank.org', 'alberto.colombo@rtl-bank.org')
   AND user_status = 'DEACTIVATED';

UPDATE sys.sys_user_position_assignments upa
   SET user_position_assignment_status   = 'ACTIVE',
       user_position_assignment_end_date = NULL,
       updated_at = now()
  FROM sys.sys_users u, sys.sys_positions p
 WHERE u.user_id = upa.user_position_assignment_user_id
   AND p.position_id = upa.user_position_assignment_position_id
   AND u.user_email IN ('alice.esposito@rtl-bank.org', 'alberto.colombo@rtl-bank.org')
   AND p.position_code IN ('POS-00000396', 'POS-00000350')
   AND upa.user_position_assignment_kind = 'PRIMARY'
   AND upa.user_position_assignment_status = 'ENDED';

DO $$
DECLARE n_active int; n_viol int;
BEGIN
  SELECT count(*) INTO n_active
    FROM sys.sys_user_position_assignments upa
    JOIN sys.sys_users u ON u.user_id = upa.user_position_assignment_user_id
   WHERE u.user_email IN ('alice.esposito@rtl-bank.org', 'alberto.colombo@rtl-bank.org')
     AND u.user_status = 'ACTIVE'
     AND upa.user_position_assignment_status = 'ACTIVE'
     AND upa.user_position_assignment_end_date IS NULL;
  IF n_active <> 2 THEN
    RAISE EXCEPTION '000204: attese 2 catene chiave ACTIVE, trovate %', n_active;
  END IF;

  SELECT count(*) INTO n_viol FROM sys.v_deactivated_user_active_assignment;
  IF n_viol > 0 THEN
    RAISE EXCEPTION '000204: % violazioni offboarding (000188 §D) introdotte', n_viol;
  END IF;

  RAISE NOTICE '000204: CRO (alice) e Securities Dealer (alberto) riattivati coerentemente (utente + catena).';
END $$;
