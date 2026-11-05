-- 000475_adr0050_d4_d7_mandato_come_atto.sql
-- ADR-0050 D4 e D7 (2026-11-05): concedere, revocare o riconfermare un mandato è un atto, e
-- certi mandati non stanno insieme sulla stessa persona.
--
-- D4. Un atto (`sys.sys_mandate_acts`) nasce come proposta (PENDING) con autore, motivo e,
--     per concessione e riconferma, una data di revisione; lo decide un SECONDO titolare di
--     mandato, mai chi lo propone né chi lo riceve. Solo un atto APPROVED produce l'effetto
--     su `sys.sys_user_auth_roles`, che ne conserva il riferimento (`user_auth_role_act_id`,
--     `_revoke_act_id`), il motivo, la revisione e chi ha approvato. Ogni passaggio di stato
--     di un atto va nel registro `sys.sys_mandate_act_audit` (trigger, non codice).
--     Le concessioni di mandato già in essere non hanno un atto: le elenca
--     `sys.v_mandato_da_riconfermare` (informativa: si svuota riconfermandole una per una,
--     con un atto CONFIRM). Le concessioni con un atto la cui revisione è passata le elenca
--     `sys.v_mandato_revisione_scaduta`, che pretende zero.
-- D7. Separazione dei compiti, sulla stessa persona e qualunque sia il tenant della concessione:
--     - WHISTLEBLOWING_CUSTODIAN con un mandato HR (TENANT_ADMIN, HRMS_MANAGER, PEOPLE_MANAGER)
--       o con SECURITY_ADMIN;
--     - SECURITY_ADMIN con TENANT_ADMIN;
--     - DPO con un mandato HR in chiaro (TENANT_ADMIN, HRMS_MANAGER, PEOPLE_MANAGER).
--     Il trigger rifiuta la concessione nuova (o la riattivazione) che creerebbe la coppia; la
--     sentinella `sys.v_mandati_incompatibili` conta le coppie che esistevano già, e pretende
--     zero.
--
-- Il controllo di D4 «chi può proporre» (CAN_GRANT_ROLES) e il perimetro di tenant restano
-- nel service dell'API (`modules/mandate-acts`), come per `grantRole`. Qui vive ciò che non
-- deve poter essere aggirato da nessuno scrittore: la forma dell'atto, le tre persone
-- distinte, il secondo titolare con un mandato vero, la coerenza fra atto ed effetto, D7.
--
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE,
-- trigger creati solo se mancano. Tabelle registrate in 000062 e classificate in 000429.
-- Rollback dichiarato: DROP delle tre viste, dei trigger e delle funzioni; DROP COLUMN delle
-- sei colonne su sys_user_auth_roles; DROP TABLE sys_mandate_act_audit, sys_mandate_acts;
-- DELETE delle tre rotte e dei due tipi aggiunti al catalogo del valore (§8).
-- Nessun dato esistente cambia: le colonne sono nuove e restano NULL sulle righe di prima.

BEGIN;

-- §1 — l'atto
CREATE TABLE IF NOT EXISTS sys.sys_mandate_acts (
  mandate_act_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_act_kind          varchar(8)  NOT NULL,
  -- SET NULL e non CASCADE: un atto è storia di governo e sopravvive alla cancellazione della
  -- persona (000303 vieta CASCADE verso sys_users fuori dall'elenco; 000304 vuole nel registro
  -- GDPR ogni chiave di appartenenza CASCADE o RESTRICT). Alla nascita il trigger lo pretende.
  mandate_act_user_id       uuid        REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  mandate_act_role_id       uuid        NOT NULL REFERENCES sys.sys_auth_roles(auth_role_id) ON DELETE RESTRICT,
  mandate_act_tenant_id     uuid        REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  mandate_act_grant_id      uuid        REFERENCES sys.sys_user_auth_roles(user_auth_role_id) ON DELETE SET NULL,
  mandate_act_reason        text        NOT NULL,
  mandate_act_review_by     date,
  mandate_act_position_id   uuid        REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  mandate_act_status        varchar(10) NOT NULL DEFAULT 'PENDING',
  mandate_act_proposed_by   uuid        REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  mandate_act_proposed_at   timestamptz NOT NULL DEFAULT now(),
  mandate_act_decided_by    uuid        REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  mandate_act_decided_at    timestamptz,
  mandate_act_decision_note text,
  CONSTRAINT sys_mandate_acts_kind_ck   CHECK (mandate_act_kind IN ('GRANT', 'REVOKE', 'CONFIRM')),
  CONSTRAINT sys_mandate_acts_status_ck CHECK (mandate_act_status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  CONSTRAINT sys_mandate_acts_reason_ck CHECK (length(btrim(mandate_act_reason)) >= 10),
  CONSTRAINT sys_mandate_acts_review_ck CHECK (mandate_act_kind = 'REVOKE' OR mandate_act_review_by IS NOT NULL),
  CONSTRAINT sys_mandate_acts_decided_ck CHECK ((mandate_act_status = 'PENDING') = (mandate_act_decided_at IS NULL)),
  -- le tre persone distinte: chi decide non è chi propone (salvo il ritiro, che è del proponente)
  -- né chi riceve; chi riceve non si propone una concessione o una riconferma
  CONSTRAINT sys_mandate_acts_persone_ck CHECK (
        (mandate_act_status = 'WITHDRAWN' OR mandate_act_decided_by IS DISTINCT FROM mandate_act_proposed_by)
    AND (mandate_act_status = 'WITHDRAWN' OR mandate_act_decided_by IS DISTINCT FROM mandate_act_user_id)
    AND (mandate_act_kind = 'REVOKE' OR mandate_act_proposed_by IS DISTINCT FROM mandate_act_user_id))
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_mandate_acts_una_proposta_aperta_ux
  ON sys.sys_mandate_acts (mandate_act_user_id, mandate_act_role_id,
                           COALESCE(mandate_act_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
                           mandate_act_kind)
  WHERE mandate_act_status = 'PENDING';
CREATE INDEX IF NOT EXISTS sys_mandate_acts_tenant_status_ix
  ON sys.sys_mandate_acts (mandate_act_tenant_id, mandate_act_status);

COMMENT ON TABLE sys.sys_mandate_acts IS
  'ADR-0050 D4 (mig 000475): concessione, revoca o riconferma di un mandato forte come atto: proposta, decisione di un secondo titolare, effetto. Scritto solo dall''API (modulo mandate-acts).';

-- §2 — l'effetto porta il riferimento all'atto
ALTER TABLE sys.sys_user_auth_roles
  ADD COLUMN IF NOT EXISTS user_auth_role_act_id        uuid REFERENCES sys.sys_mandate_acts(mandate_act_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_auth_role_reason        text,
  ADD COLUMN IF NOT EXISTS user_auth_role_review_by     date,
  ADD COLUMN IF NOT EXISTS user_auth_role_approved_by   uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_auth_role_revoke_act_id uuid REFERENCES sys.sys_mandate_acts(mandate_act_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_auth_role_revoked_by    uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN sys.sys_user_auth_roles.user_auth_role_act_id IS
  'ADR-0050 D4 (mig 000475): l''atto APPROVED (GRANT o CONFIRM) che regge questa concessione di mandato. NULL sulle concessioni di prima e sui ruoli che non sono mandati.';

-- §3 — la forma dell'atto e le sue transizioni
CREATE OR REPLACE FUNCTION sys.f_atto_di_mandato_coerente()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ruolo text;
BEGIN
  SELECT r.auth_role_code INTO v_ruolo FROM sys.sys_auth_roles r WHERE r.auth_role_id = NEW.mandate_act_role_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.mandate_act_status <> 'PENDING' THEN
      RAISE EXCEPTION 'mandate act refused: an act is born PENDING (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mandate_act_user_id IS NULL THEN
      RAISE EXCEPTION 'mandate act refused: user_id is required (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mandate_act_proposed_by IS NULL THEN
      RAISE EXCEPTION 'mandate act refused: proposed_by is required (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    IF v_ruolo IS NULL OR v_ruolo NOT IN (SELECT sys.f_ruoli_mandato()) THEN
      RAISE EXCEPTION 'mandate act refused: % is not a mandate role (ADR-0050 D4)', v_ruolo USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mandate_act_kind IN ('REVOKE', 'CONFIRM') AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_auth_roles g
       WHERE g.user_auth_role_id = NEW.mandate_act_grant_id
         AND g.user_auth_role_user_id = NEW.mandate_act_user_id
         AND g.user_auth_role_role_id = NEW.mandate_act_role_id
         AND g.user_auth_role_tenant_id IS NOT DISTINCT FROM NEW.mandate_act_tenant_id
         AND g.user_auth_role_revoked_at IS NULL) THEN
      RAISE EXCEPTION 'mandate act refused: % needs the active grant it acts on (ADR-0050 D4)', NEW.mandate_act_kind
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mandate_act_kind = 'GRANT' AND NEW.mandate_act_grant_id IS NOT NULL THEN
      RAISE EXCEPTION 'mandate act refused: a GRANT proposal has no grant yet (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.mandate_act_review_by IS NOT NULL AND NEW.mandate_act_review_by <= CURRENT_DATE THEN
      RAISE EXCEPTION 'mandate act refused: review_by must be in the future (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: ciò che l'atto dice non cambia; cambia solo lo stato, una volta, da PENDING.
  IF NEW.mandate_act_kind        IS DISTINCT FROM OLD.mandate_act_kind
     OR (NEW.mandate_act_user_id IS DISTINCT FROM OLD.mandate_act_user_id AND NEW.mandate_act_user_id IS NOT NULL)
     OR NEW.mandate_act_role_id  IS DISTINCT FROM OLD.mandate_act_role_id
     OR NEW.mandate_act_tenant_id IS DISTINCT FROM OLD.mandate_act_tenant_id
     OR NEW.mandate_act_reason   IS DISTINCT FROM OLD.mandate_act_reason
     OR NEW.mandate_act_review_by IS DISTINCT FROM OLD.mandate_act_review_by
     OR NEW.mandate_act_position_id IS DISTINCT FROM OLD.mandate_act_position_id
     OR NEW.mandate_act_proposed_at IS DISTINCT FROM OLD.mandate_act_proposed_at
     OR (NEW.mandate_act_proposed_by IS DISTINCT FROM OLD.mandate_act_proposed_by AND NEW.mandate_act_proposed_by IS NOT NULL) THEN
    RAISE EXCEPTION 'mandate act refused: the content of an act does not change (ADR-0050 D4)' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.mandate_act_status <> 'PENDING' THEN
    -- dopo la decisione si muovono solo i riferimenti che una cancellazione azzera (ON DELETE
    -- SET NULL) e, una volta, il grant nato da un GRANT approvato
    IF NEW.mandate_act_status IS DISTINCT FROM OLD.mandate_act_status
       OR (NEW.mandate_act_decided_by IS DISTINCT FROM OLD.mandate_act_decided_by AND NEW.mandate_act_decided_by IS NOT NULL)
       OR NEW.mandate_act_decided_at IS DISTINCT FROM OLD.mandate_act_decided_at
       OR NEW.mandate_act_decision_note IS DISTINCT FROM OLD.mandate_act_decision_note
       OR (NEW.mandate_act_grant_id IS DISTINCT FROM OLD.mandate_act_grant_id
           AND NEW.mandate_act_grant_id IS NOT NULL
           AND NOT (OLD.mandate_act_grant_id IS NULL AND OLD.mandate_act_kind = 'GRANT' AND OLD.mandate_act_status = 'APPROVED')) THEN
      RAISE EXCEPTION 'mandate act refused: a decided act does not change (ADR-0050 D4)' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.mandate_act_grant_id IS DISTINCT FROM OLD.mandate_act_grant_id AND NEW.mandate_act_grant_id IS NOT NULL THEN
    RAISE EXCEPTION 'mandate act refused: the grant of a proposal does not change (ADR-0050 D4)' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.mandate_act_status = 'PENDING' THEN
    RETURN NEW;
  END IF;
  IF NEW.mandate_act_decided_by IS NULL THEN
    RAISE EXCEPTION 'mandate act refused: decided_by is required (ADR-0050 D4)' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.mandate_act_status = 'WITHDRAWN' AND NEW.mandate_act_decided_by IS DISTINCT FROM OLD.mandate_act_proposed_by THEN
    RAISE EXCEPTION 'mandate act refused: only the proposer withdraws (ADR-0050 D4)' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.mandate_act_status = 'APPROVED' AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles g
      JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
      JOIN sys.sys_users u ON u.user_id = g.user_auth_role_user_id
     WHERE g.user_auth_role_user_id = NEW.mandate_act_decided_by
       AND g.user_auth_role_revoked_at IS NULL
       AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato())
       AND u.user_status = 'ACTIVE') THEN
    RAISE EXCEPTION 'mandate act refused: the approver must hold a mandate (ADR-0050 D4)' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_mandate_acts_coerente'
                  AND tgrelid = 'sys.sys_mandate_acts'::regclass) THEN
    CREATE TRIGGER sys_mandate_acts_coerente
      BEFORE INSERT OR UPDATE ON sys.sys_mandate_acts
      FOR EACH ROW EXECUTE FUNCTION sys.f_atto_di_mandato_coerente();
  END IF;
END;
$tr$;

-- §4 — il registro di audit degli atti
CREATE TABLE IF NOT EXISTS sys.sys_mandate_act_audit (
  mandate_act_audit_id     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_act_audit_act_id uuid        NOT NULL,
  mandate_act_audit_op     varchar(8)  NOT NULL,
  mandate_act_audit_kind   varchar(8)  NOT NULL,
  mandate_act_audit_status varchar(10) NOT NULL,
  mandate_act_audit_user_id uuid       NOT NULL,
  mandate_act_audit_role_id uuid       NOT NULL,
  mandate_act_audit_tenant_id uuid,
  mandate_act_audit_actor  uuid,
  mandate_act_audit_note   text,
  created_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_mandate_act_audit_act_ix ON sys.sys_mandate_act_audit (mandate_act_audit_act_id);

COMMENT ON TABLE sys.sys_mandate_act_audit IS
  'ADR-0050 D4 (mig 000475): ogni nascita e ogni decisione di un atto di mandato. Popolata da trigger, senza chiavi esterne: sopravvive alla cancellazione delle persone.';

CREATE OR REPLACE FUNCTION sys.f_atto_di_mandato_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.mandate_act_status IS NOT DISTINCT FROM OLD.mandate_act_status THEN
    RETURN NULL;
  END IF;
  INSERT INTO sys.sys_mandate_act_audit
    (mandate_act_audit_act_id, mandate_act_audit_op, mandate_act_audit_kind, mandate_act_audit_status,
     mandate_act_audit_user_id, mandate_act_audit_role_id, mandate_act_audit_tenant_id,
     mandate_act_audit_actor, mandate_act_audit_note)
  VALUES
    (NEW.mandate_act_id, TG_OP, NEW.mandate_act_kind, NEW.mandate_act_status,
     NEW.mandate_act_user_id, NEW.mandate_act_role_id, NEW.mandate_act_tenant_id,
     CASE WHEN TG_OP = 'INSERT' THEN NEW.mandate_act_proposed_by ELSE NEW.mandate_act_decided_by END,
     CASE WHEN TG_OP = 'INSERT' THEN NEW.mandate_act_reason ELSE NEW.mandate_act_decision_note END);
  RETURN NULL;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_mandate_acts_audit'
                  AND tgrelid = 'sys.sys_mandate_acts'::regclass) THEN
    CREATE TRIGGER sys_mandate_acts_audit
      AFTER INSERT OR UPDATE ON sys.sys_mandate_acts
      FOR EACH ROW EXECUTE FUNCTION sys.f_atto_di_mandato_audit();
  END IF;
END;
$tr$;

-- §5 — D7: le coppie che non stanno sulla stessa persona
CREATE OR REPLACE FUNCTION sys.f_mandati_incompatibili(a text, b text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM (VALUES
      ('WHISTLEBLOWING_CUSTODIAN', 'TENANT_ADMIN'),
      ('WHISTLEBLOWING_CUSTODIAN', 'HRMS_MANAGER'),
      ('WHISTLEBLOWING_CUSTODIAN', 'PEOPLE_MANAGER'),
      ('WHISTLEBLOWING_CUSTODIAN', 'SECURITY_ADMIN'),
      ('SECURITY_ADMIN',           'TENANT_ADMIN'),
      ('DPO',                      'TENANT_ADMIN'),
      ('DPO',                      'HRMS_MANAGER'),
      ('DPO',                      'PEOPLE_MANAGER')) AS c(x, y)
     WHERE (c.x = a AND c.y = b) OR (c.x = b AND c.y = a))
$$;

COMMENT ON FUNCTION sys.f_mandati_incompatibili(text, text) IS
  'ADR-0050 D7 (mig 000475): vero se i due ruoli non possono stare sulla stessa persona. Copia di INCOMPATIBILI in lib/scope/mandati.ts; la parità la verifica adr0050-mandato-atto.integration.test.ts.';

-- §6 — l'effetto: D7 e la coerenza con l'atto
CREATE OR REPLACE FUNCTION sys.f_concessione_di_mandato_coerente()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ruolo text;
  v_altro text;
BEGIN
  -- la revoca: se cita un atto, l'atto è una REVOKE approvata di questa concessione
  IF TG_OP = 'UPDATE' AND NEW.user_auth_role_revoke_act_id IS NOT NULL
     AND NEW.user_auth_role_revoke_act_id IS DISTINCT FROM OLD.user_auth_role_revoke_act_id
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_mandate_acts a
        WHERE a.mandate_act_id = NEW.user_auth_role_revoke_act_id
          AND a.mandate_act_kind = 'REVOKE' AND a.mandate_act_status = 'APPROVED'
          AND a.mandate_act_grant_id = NEW.user_auth_role_id) THEN
    RAISE EXCEPTION 'role grant refused: revoke_act_id is not an approved REVOKE of this grant (ADR-0050 D4)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.user_auth_role_revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.auth_role_code INTO v_ruolo FROM sys.sys_auth_roles r WHERE r.auth_role_id = NEW.user_auth_role_role_id;
  IF v_ruolo IS NULL OR v_ruolo NOT IN (SELECT sys.f_ruoli_mandato()) THEN
    RETURN NEW;
  END IF;

  -- il controllo scatta quando la concessione nasce attiva, torna attiva, o cambia persona o ruolo
  IF TG_OP = 'INSERT'
     OR OLD.user_auth_role_revoked_at IS NOT NULL
     OR NEW.user_auth_role_user_id IS DISTINCT FROM OLD.user_auth_role_user_id
     OR NEW.user_auth_role_role_id IS DISTINCT FROM OLD.user_auth_role_role_id THEN
    SELECT r.auth_role_code INTO v_altro
      FROM sys.sys_user_auth_roles g
      JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
     WHERE g.user_auth_role_user_id = NEW.user_auth_role_user_id
       AND g.user_auth_role_id <> NEW.user_auth_role_id
       AND g.user_auth_role_revoked_at IS NULL
       AND sys.f_mandati_incompatibili(v_ruolo, r.auth_role_code)
     LIMIT 1;
    IF v_altro IS NOT NULL THEN
      RAISE EXCEPTION 'role grant refused: % and % cannot be held by the same person (ADR-0050 D7)', v_ruolo, v_altro
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- l'atto citato è approvato e dice la stessa cosa
  IF NEW.user_auth_role_act_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.user_auth_role_act_id IS DISTINCT FROM OLD.user_auth_role_act_id)
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_mandate_acts a
        WHERE a.mandate_act_id = NEW.user_auth_role_act_id
          AND a.mandate_act_status = 'APPROVED'
          AND a.mandate_act_kind IN ('GRANT', 'CONFIRM')
          AND a.mandate_act_user_id = NEW.user_auth_role_user_id
          AND a.mandate_act_role_id = NEW.user_auth_role_role_id
          AND a.mandate_act_tenant_id IS NOT DISTINCT FROM NEW.user_auth_role_tenant_id
          AND (a.mandate_act_kind = 'GRANT' OR a.mandate_act_grant_id = NEW.user_auth_role_id)) THEN
    RAISE EXCEPTION 'role grant refused: act_id is not an approved act for this grant (ADR-0050 D4)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_auth_roles_mandato_coerente'
                  AND tgrelid = 'sys.sys_user_auth_roles'::regclass) THEN
    CREATE TRIGGER sys_user_auth_roles_mandato_coerente
      BEFORE INSERT OR UPDATE ON sys.sys_user_auth_roles
      FOR EACH ROW EXECUTE FUNCTION sys.f_concessione_di_mandato_coerente();
  END IF;
END;
$tr$;

-- §7 — le tre viste
CREATE OR REPLACE VIEW sys.v_mandati_incompatibili AS
SELECT a.user_auth_role_user_id AS utente,
       ra.auth_role_code        AS ruolo,
       rb.auth_role_code        AS ruolo_incompatibile
  FROM sys.sys_user_auth_roles a
  JOIN sys.sys_auth_roles ra ON ra.auth_role_id = a.user_auth_role_role_id
  JOIN sys.sys_user_auth_roles b ON b.user_auth_role_user_id = a.user_auth_role_user_id
                                AND b.user_auth_role_revoked_at IS NULL
  JOIN sys.sys_auth_roles rb ON rb.auth_role_id = b.user_auth_role_role_id
 WHERE a.user_auth_role_revoked_at IS NULL
   AND ra.auth_role_code < rb.auth_role_code
   AND sys.f_mandati_incompatibili(ra.auth_role_code, rb.auth_role_code);

COMMENT ON VIEW sys.v_mandati_incompatibili IS
  'ADR-0050 D7 (mig 000475): persone che portano due mandati incompatibili. Pretende zero. Sola lettura.';

CREATE OR REPLACE VIEW sys.v_mandato_da_riconfermare AS
SELECT g.user_auth_role_id       AS concessione,
       g.user_auth_role_user_id  AS utente,
       r.auth_role_code          AS ruolo,
       g.user_auth_role_tenant_id AS tenant,
       g.user_auth_role_granted_at AS concessa_il
  FROM sys.sys_user_auth_roles g
  JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
 WHERE g.user_auth_role_revoked_at IS NULL
   AND g.user_auth_role_act_id IS NULL
   AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato());

COMMENT ON VIEW sys.v_mandato_da_riconfermare IS
  'ADR-0050 D4 (mig 000475): concessioni di mandato attive senza un atto approvato. Informativa: si svuota riconfermandole una per una (atto CONFIRM). Sola lettura.';

CREATE OR REPLACE VIEW sys.v_mandato_revisione_scaduta AS
SELECT g.user_auth_role_id        AS concessione,
       g.user_auth_role_user_id   AS utente,
       r.auth_role_code           AS ruolo,
       g.user_auth_role_review_by AS revisione
  FROM sys.sys_user_auth_roles g
  JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
 WHERE g.user_auth_role_revoked_at IS NULL
   AND g.user_auth_role_act_id IS NOT NULL
   AND g.user_auth_role_review_by < CURRENT_DATE;

COMMENT ON VIEW sys.v_mandato_revisione_scaduta IS
  'ADR-0050 D4 (mig 000475): concessioni di mandato con un atto la cui data di revisione è passata. Pretende zero: si riconferma o si revoca. Sola lettura.';

-- §8 — il test del valore (000470): proporre e decidere un atto di mandato sono decisioni di
-- governo, e si contano come le deleghe.
INSERT INTO audit.valore_tipi_decisione (codice, categoria, etichetta, descrizione) VALUES
  ('mandato_proposto', 'governo', 'Atto di mandato proposto',
   'Si propone di concedere, revocare o riconfermare un mandato forte a una persona (ADR-0050 D4).'),
  ('mandato_deciso',   'governo', 'Atto di mandato deciso',
   'Un secondo titolare di mandato approva o respinge un atto di mandato (ADR-0050 D4).')
ON CONFLICT (codice) DO UPDATE
   SET categoria = EXCLUDED.categoria, etichetta = EXCLUDED.etichetta,
       descrizione = EXCLUDED.descrizione, attivo = true, updated_at = now()
 WHERE (audit.valore_tipi_decisione.categoria, audit.valore_tipi_decisione.etichetta,
        audit.valore_tipi_decisione.descrizione, audit.valore_tipi_decisione.attivo)
   IS DISTINCT FROM (EXCLUDED.categoria, EXCLUDED.etichetta, EXCLUDED.descrizione, true);

INSERT INTO audit.valore_rotte_decisione (metodo, rotta, codice, oggetto_tipo, oggetto_da, esito_da) VALUES
  ('POST', '/v1/mandate-acts',             'mandato_proposto', 'atto_di_mandato', 'risposta:actId', 'risposta:kind'),
  ('POST', '/v1/mandate-acts/:id/approve', 'mandato_deciso',   'atto_di_mandato', 'param:id',       'risposta:status'),
  ('POST', '/v1/mandate-acts/:id/reject',  'mandato_deciso',   'atto_di_mandato', 'param:id',       'risposta:status')
ON CONFLICT (metodo, rotta) DO UPDATE
   SET codice = EXCLUDED.codice, oggetto_tipo = EXCLUDED.oggetto_tipo,
       oggetto_da = EXCLUDED.oggetto_da, esito_da = EXCLUDED.esito_da, updated_at = now()
 WHERE (audit.valore_rotte_decisione.codice, audit.valore_rotte_decisione.oggetto_tipo,
        audit.valore_rotte_decisione.oggetto_da, audit.valore_rotte_decisione.esito_da)
   IS DISTINCT FROM (EXCLUDED.codice, EXCLUDED.oggetto_tipo, EXCLUDED.oggetto_da, EXCLUDED.esito_da);

COMMIT;

-- POST-CONDIZIONI
DO $pc$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgname IN ('sys_mandate_acts_coerente', 'sys_mandate_acts_audit', 'sys_user_auth_roles_mandato_coerente');
  IF n <> 3 THEN RAISE EXCEPTION '000475: i trigger sono % invece di 3', n; END IF;

  SELECT count(*) INTO n FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN ('sys_mandate_acts', 'sys_mandate_act_audit');
  IF n <> 2 THEN RAISE EXCEPTION '000475: tabelle registrate in 000062: % su 2', n; END IF;
  SELECT count(*) INTO n FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_mandate_acts', 'sys_mandate_act_audit');
  IF n <> 2 THEN RAISE EXCEPTION '000475: tabelle classificate in 000429: % su 2', n; END IF;

  RAISE NOTICE '000475 ok — atti di mandato (D4), separazione dei compiti (D7); da riconfermare: %, incompatibili: %',
    (SELECT count(*) FROM sys.v_mandato_da_riconfermare), (SELECT count(*) FROM sys.v_mandati_incompatibili);
END;
$pc$;
