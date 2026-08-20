-- ============================================================================
-- 000338 — #220 W1.2 (rilievo F5-05): togliere a `codex_auditor` e `gov_worker`
--          la lettura delle sei superfici che portano credenziali, secondo
--          fattore, coordinate bancarie e buste paga.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--    WHERE grantee IN ('codex_auditor','gov_worker') AND table_name IN (...);
--   -> 12 righe: SELECT su tutte e sei, per entrambi i ruoli.
--
-- «SOLA LETTURA» NON VUOL DIRE «INNOCUO», ed e' il punto di questo file. Il
-- documento di ritiro della modalita' gov (2026-08-10, §5 R12) archivia
-- `gov_worker` con la frase «e' in sola lettura per costruzione, quindi
-- lasciarlo non apre nulla». La misura di oggi dice che quel ruolo legge **265
-- tabelle**, e fra queste le credenziali e le buste paga: la sola lettura non
-- limita COSA si legge, e per un segreto leggere e' tutto il danno possibile.
--
-- PERCHE' NON BASTA EMENDARE LA FONTE (ADR-0035, applicato per quel che si puo').
--   · `gov_worker` non ha piu' un file che lo crea: lo script e' stato cancellato
--     dal ritiro gov (R7). Non c'e' fonte da emendare, e quindi nessuna catena
--     che disfi questa revoca — qui la forma (3) dell'ADR e' l'unica disponibile,
--     ed e' corretta.
--   · `codex_auditor` nasce in `.codex-review/service/access/`, che per contratto
--     NON e' di Claude (CLAUDE.md §Codex read-only audit channel). Quel file
--     concede `SELECT ON ALL TABLES IN SCHEMA sys, audit` PIU'
--     `ALTER DEFAULT PRIVILEGES`: significa che ogni tabella futura nasce
--     leggibile, comprese quelle sensibili non ancora scritte. Questa migrazione
--     e' percio' la sede autorevole: gira a OGNI deploy, quindi ri-chiude il
--     varco anche se lo script di provisioning viene rilanciato.
--   · Una nota per il canale Codex sta in
--     `.codex-review/service/access/CLAUDE_INTEGRATION.md`.
--
-- ⚠ QUESTA NON E' LA VOCE R12. Rimuovere il ruolo `gov_worker` (DROP ROLE) resta
-- una decisione di Enzo, dichiarata bloccata su di lui nel documento di ritiro.
-- Qui si riduce cio' che il ruolo puo' leggere; non si tocca la sua esistenza.
--
-- ELENCO ESPLICITO, MAI UN JOLLY: sei oggetti e due ruoli, nominati uno per uno.
-- Un `REVOKE ALL ON ALL TABLES` avrebbe spento anche l'audit legittimo di Codex,
-- che e' un servizio voluto e sotto contratto.
--
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo`, perche' non si tocca
-- alcuna riga. L'inversa e' un GRANT esplicito degli stessi sei oggetti; per
-- `codex_auditor` la rigenera anche il suo script di provisioning.
--
-- IDEMPOTENTE: la revoca di un privilegio assente non e' un errore; le guardie
-- saltano i ruoli e gli oggetti che su questo database non esistono (la CI e i
-- database nuovi non hanno questi due ruoli).
-- ============================================================================

DO $$
DECLARE
  ruolo    text;
  oggetto  text;
  ruoli    text[] := ARRAY['codex_auditor', 'gov_worker'];
  oggetti  text[] := ARRAY[
    'sys_auth_credentials',
    'sys_auth_mfa_recovery_codes',
    'sys_auth_password_reset_tokens',
    'sys_user_bank_details',
    'sys_user_pay_slips',
    'v_mfa_secrets_in_cleartext'
  ];
BEGIN
  FOREACH ruolo IN ARRAY ruoli LOOP
    -- il ruolo puo' non esistere: su un database di CI o appena creato non c'e'
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ruolo);

    FOREACH oggetto IN ARRAY oggetti LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'sys' AND c.relname = oggetto
      );
      EXECUTE format('REVOKE ALL ON sys.%I FROM %I', oggetto, ruolo);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Due controlli, e il secondo protegge cio' che NON doveva
-- cambiare. Contare solo i privilegi spariti non distinguerebbe «ho chiuso le
-- sei superfici sensibili» da «ho spento l'audit di Codex per intero» — che e'
-- il guasto piu' probabile di questo file, ed e' un danno vero: quel canale e'
-- un servizio voluto e sotto contratto.
-- ---------------------------------------------------------------------------
DO $$
DECLARE rimasti int; superstiti int;
BEGIN
  SELECT count(*) INTO rimasti
    FROM information_schema.role_table_grants
   WHERE grantee IN ('codex_auditor', 'gov_worker')
     AND table_schema = 'sys'
     AND table_name IN ('sys_auth_credentials', 'sys_auth_mfa_recovery_codes',
                        'sys_auth_password_reset_tokens', 'sys_user_bank_details',
                        'sys_user_pay_slips', 'v_mfa_secrets_in_cleartext');
  IF rimasti > 0 THEN
    RAISE EXCEPTION '000338: % privilegi ancora concessi sulle superfici sensibili', rimasti;
  END IF;

  -- Se `codex_auditor` esiste, deve conservare la lettura sul resto di `sys`:
  -- e' la ragione per cui il ruolo esiste. Zero grant qui non sarebbe «piu'
  -- sicuro», sarebbe questo file che ha ecceduto il suo mandato.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'codex_auditor') THEN
    SELECT count(*) INTO superstiti
      FROM information_schema.role_table_grants
     WHERE grantee = 'codex_auditor' AND table_schema = 'sys';
    IF superstiti = 0 THEN
      RAISE EXCEPTION '000338: codex_auditor ha perso OGNI lettura su sys — revoca troppo larga';
    END IF;
    RAISE NOTICE '000338 ok — codex_auditor conserva % oggetti leggibili in sys', superstiti;
  END IF;
END $$;
