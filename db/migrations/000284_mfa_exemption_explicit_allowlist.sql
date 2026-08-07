-- ═══════════════════════════════════════════════════════════════════════════════
-- 000284_mfa_exemption_explicit_allowlist.sql
--
-- #139 — «NON È UNA PERSONA» E «PUÒ SALTARE L'MFA» DIVENTANO DUE DOMANDE DIVERSE.
--
-- LA DECISIONE (Enzo, 2026-08-07). Alla domanda «i due account amministrativi di
-- HEURESYS devono poter accedere senza secondo fattore?» la risposta è **NO**.
--
-- IL PROBLEMA CHE QUESTA RISPOSTA FA EMERGERE. `#139` vuole marcare come «utenze di
-- servizio» due account tecnici (`admin@heuresys.com`, `platform.admin@heuresys.com`)
-- che oggi contano come persone. Ma `user_type='SERVICE'` non è solo un'etichetta del
-- modello dati: dal `000118` è **la condizione di eleggibilità all'esenzione MFA**, e
-- quella migrazione era stata scritta con l'intento esplicito, nel suo commento, che
-- «a HUMAN PLATFORM_ADMIN must NOT be exemptable». `platform.admin@heuresys.com` È
-- quel PLATFORM_ADMIN umano. Marcarlo SERVICE oggi lo renderebbe eleggibile, cioè
-- contraddirebbe la ragione per cui il `000118` esiste.
--
-- Alla radice c'è un accoppiamento fra due domande di natura diversa:
--   · «questa riga rappresenta una persona?»   → modello dei dati
--   · «questo account può saltare l'MFA?»      → decisione di sicurezza
-- Finché sono la stessa colonna, ogni futuro account di servizio diventa eleggibile
-- **per effetto collaterale**, senza che nessuno lo decida.
--
-- COSA FA. Aggiunge un secondo lucchetto, indipendente e nominativo: un account è
-- eleggibile all'esenzione solo se `user_type='SERVICE'` **E** è iscritto
-- esplicitamente in `sys.sys_auth_mfa_exemption_eligible_users`. Non sostituisce il
-- criterio esistente — lo **congiunge**, così l'intento del `000118` resta in piedi e
-- si aggiunge un atto deliberato e tracciabile.
--
-- Da qui in poi esentare un account richiede TRE atti distinti, ognuno visibile:
--   1. tipizzarlo SERVICE   2. iscriverlo all'elenco   3. creare l'esenzione
-- Nessuno dei tre è un effetto collaterale di un altro.
--
-- PERCHÉ È SICURO OGGI, MISURATO: `sys.sys_auth_mfa_exemptions` contiene **0 righe** e
-- **nessun** utente è di tipo SERVICE (163 su 163 sono STANDARD). L'elenco nasce vuoto,
-- quindi il numero di account esentabili passa da zero a zero: nessun comportamento
-- cambia, cambia ciò che sarà possibile domani. Invariante **I7**: è una tabella di
-- sola autenticazione, mai una bandiera sull'utente.
--
-- Idempotente. Porta con sé la propria prova: la §3 tenta un'esenzione non autorizzata
-- e pretende che venga rifiutata, dentro un savepoint.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- §1 — l'elenco nominativo. Il motivo è obbligatorio: un'eleggibilità senza una
--      ragione scritta è esattamente il genere di riga che nessuno sa più spiegare.
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_exemption_eligible_users (
  auth_mfa_eligible_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_eligible_user_id  uuid NOT NULL UNIQUE
                             REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_mfa_eligible_reason   text NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 varchar(255) NOT NULL DEFAULT current_user
);

COMMENT ON TABLE sys.sys_auth_mfa_exemption_eligible_users IS
  '#139 — elenco nominativo degli account che POSSONO ricevere un''esenzione MFA. '
  'Condizione necessaria e NON sufficiente: serve anche user_type=SERVICE (000118) '
  'e poi l''esenzione vera in sys_auth_mfa_exemptions. Tre atti distinti, mai effetti collaterali.';

-- §2 — l'eleggibilità diventa una congiunzione.
CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_users u
     WHERE u.user_id = NEW.auth_mfa_exemption_user_id
       AND u.user_type = 'SERVICE'
  ) THEN
    RAISE EXCEPTION
      'MFA exemption allowed ONLY for SERVICE accounts (user_type=SERVICE); user % is not a service account (M-8b)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- #139 — secondo lucchetto: l'iscrizione nominativa. Essere un account di servizio
  -- non basta piu': serve che qualcuno l'abbia deciso, per quell'account, e l'abbia
  -- scritto. Cosi' marcare SERVICE un account tecnico non gli apre nulla.
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_mfa_exemption_eligible_users e
     WHERE e.auth_mfa_eligible_user_id = NEW.auth_mfa_exemption_user_id
  ) THEN
    RAISE EXCEPTION
      'MFA exemption requires an explicit entry in sys_auth_mfa_exemption_eligible_users; user % is not listed (#139)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

-- §3 — LA PROVA, DENTRO LA MIGRAZIONE.
DO $mig$
DECLARE
  v_svc  uuid;
  v_ten  uuid;
  v_ok   boolean := false;
  v_cnt  bigint;
BEGIN
  -- Nessuna esenzione preesistente deve essere stata invalidata da questo giro.
  SELECT count(*) INTO v_cnt FROM sys.sys_auth_mfa_exemptions;
  IF v_cnt > 0 THEN
    RAISE NOTICE '000284: attenzione — esistono % esenzioni preesistenti: verificare che i titolari siano iscritti all elenco', v_cnt;
  END IF;

  SELECT tenant_id INTO v_ten FROM sys.sys_tenancies ORDER BY tenant_code LIMIT 1;

  BEGIN
    -- Un account di servizio NON iscritto non deve poter essere esentato. E' la
    -- proprieta' nuova, e un controllo che non si e' mai visto rifiutare non e' una prova.
    INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_status, user_type)
    VALUES (v_ten, '__prova-139__@heuresys.local', 'Prova 139', 'ACTIVE', 'SERVICE')
    RETURNING user_id INTO v_svc;

    BEGIN
      INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
      VALUES (v_svc, 'prova 000284 — deve fallire', true);
    EXCEPTION WHEN check_violation THEN
      v_ok := true;
    END;

    IF NOT v_ok THEN
      RAISE EXCEPTION '000284: un account SERVICE non iscritto e stato esentato — il secondo lucchetto non tiene';
    END IF;

    -- e iscrivendolo, invece, deve passare: un lucchetto che non si apre mai non e'
    -- un lucchetto, e' un muro — e renderebbe impossibile l'account headless legittimo.
    INSERT INTO sys.sys_auth_mfa_exemption_eligible_users (auth_mfa_eligible_user_id, auth_mfa_eligible_reason)
    VALUES (v_svc, 'prova 000284');
    INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
    VALUES (v_svc, 'prova 000284 — deve passare', true);

    RAISE EXCEPTION 'ROLLBACK_PROVA_000284';   -- la prova non lascia traccia
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'ROLLBACK_PROVA_000284' THEN RAISE; END IF;
  END;

  RAISE NOTICE '000284 done: eleggibilita = SERVICE **E** iscrizione nominativa. Elenco con % righe; entrambi i versi provati.',
    (SELECT count(*) FROM sys.sys_auth_mfa_exemption_eligible_users);
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility() ... (versione 000118)
--   DROP TABLE IF EXISTS sys.sys_auth_mfa_exemption_eligible_users;
-- COMMIT;
