-- 000395 — B1 residuo (2026-09-09): gap_closure_action_owner_user_id è un ATTORE, non un
-- soggetto.
--
-- IL FATTO. La sentinella B1 (mig. 000386) trovava una riga fuori posto su
-- sys_gap_closure_actions: il proprietario della chiusura (un amministratore di piattaforma,
-- HEURESYS) non appartiene al tenant della riga (RTL_BANK). Il file originale del bundle
-- l'aveva classificata come violazione vera. VERIFICATO empiricamente (2026-09-09): allineare
-- il tenant della riga all'owner rompe la relazione vera — `gap_closure_action_gap_id`
-- referenzia un `learning_gap` che appartiene davvero a RTL_BANK. Il gap è il soggetto; chi
-- lo chiude è un attore, esattamente come `created_by`/`approver`. La classificazione
-- originale era sbagliata, e questa migrazione la corregge nella tabella dichiarata (mig.
-- 000386), non nella sentinella.
--
-- L'altra riga trovata dalla stessa sentinella (sys_continuous_feedback.feedback_to_user_id,
-- 1 riga) era invece un vero difetto — nessun'ancora al soggetto sbagliato — ed è stata
-- corretta come dato, allineando il tenant al destinatario reale.

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_tenant_boundary_author_columns (author_column_name, author_column_note)
VALUES ('gap_closure_action_owner_user_id',
  'Chi e'' responsabile di chiudere il gap, non di chi e'' il gap - verificato 2026-09-09: '
  'il gap referenziato appartiene a RTL_BANK, l''owner e'' un amministratore di piattaforma '
  '(HEURESYS) che segue la chiusura per conto del cliente. Stessa semantica di '
  'created_by/approver.')
ON CONFLICT (author_column_name) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  -- Responsabilità propria: solo gap_closure_action_owner_user_id deve sparire dalla
  -- sentinella. sys_continuous_feedback.feedback_to_user_id resta un dato da riallineare
  -- riga per riga (bonifica a parte, come B7): questa migrazione non lo tocca, e non deve
  -- pretendere di vederlo già risolto su una copia che non l'ha ricevuto.
  SELECT count(*) INTO n FROM sys.v_tenant_boundary_violations_full
   WHERE colonna_legame = 'gap_closure_action_owner_user_id';
  IF n <> 0 THEN
    RAISE EXCEPTION '000395: sys_gap_closure_actions.gap_closure_action_owner_user_id e'' '
                    'ancora fra le violazioni (% righe) dopo la correzione della '
                    'classificazione', n;
  END IF;
  RAISE NOTICE '000395: gap_closure_action_owner_user_id non e'' piu'' una violazione.';
END $$;

COMMIT;
