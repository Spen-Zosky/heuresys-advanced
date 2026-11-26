-- ============================================================================================
-- 000522 — I segnalatori: gli agenti che osservano il tenant e segnalano, senza cambiare nulla.
--          (voce F4a del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md, ADR-0063,
--          decisione E6 di Enzo: «sì, senza scrivere, a ciascuno nel suo perimetro, in una
--          casella dentro la piattaforma, per ora senza posta»)
--
-- IL FATTO. Fino a qui la proattività (asse 4 di ADR-0063) era a 1 su 5: nessun agente guardava
-- il tenant da solo. I segnalatori sono il primo passo: ogni notte leggono lo stato di RTL e, se
-- trovano qualcosa che una persona deve sapere («la posizione critica X non ha un successore
-- pronto»), lo mettono nella casella di chi ha quella cosa nel suo perimetro. Non scrivono su
-- nessuna tabella di business: l'unica scrittura è la segnalazione stessa, qui, più l'avviso
-- nella casella della piattaforma (sys_inbox_notifications, tipo SYSTEM).
--
-- CHE COSA CREA. Solo aggiunte, nessun oggetto esistente toccato.
--   · `sys_agent_signals`: una riga per segnalazione e per destinatario, con il segnalatore che
--     l'ha prodotta, il soggetto (posizione o unità), il destinatario e la ragione per cui gli
--     spetta (CATENA: dirige l'unità del soggetto o una che le sta sopra; MANDATO_HR: ha il
--     mandato HR sul tenant), la gravità, i numeri che la reggono (`evidence`), la pagina della
--     fonte, la scadenza e lo stato. Il giudizio «utile/non utile» (voce F4b, misura dell'asse 4)
--     ha già le sue colonne, vuote finché la casella non lo chiede.
--   · `sys.v_agent_signals_fuori_perimetro`: la sentinella, deve restare vuota. Elenca le
--     segnalazioni aperte il cui destinatario non ha più titolo a riceverle (un capo cambiato,
--     un ruolo revocato): il segnalatore le ritira al giro dopo.
--
-- LE GUARDIE NEL DATABASE (il codice le rispetta già; qui non si fidano del codice):
--   G1 il destinatario è una persona dello stesso tenant della segnalazione (I5);
--   G2 il soggetto esiste nel tenant della segnalazione;
--   G3 PERIMETRO: con CATENA il destinatario dirige l'unità del soggetto o una sua antenata
--      attiva (I16-I22); con MANDATO_HR ha un ruolo attivo fra TENANT_ADMIN, HRMS_MANAGER e
--      PEOPLE_MANAGER (lo stesso insieme di HR_MANDATED_ROLES in apps/api/src/lib/scope/resolver.ts);
--   G4 la successione non si comunica a chi la riguarda: una segnalazione di successione non va
--      mai a chi è titolare della posizione (classe EVALUATION «nonASe» del faldone);
--   G5 niente doppioni: una sola segnalazione APERTA per destinatario e per chiave.
--
-- I DATI. La tabella nasce vuota; la riempie solo il segnalatore notturno
-- (heuresys-advanced-agent-signals.timer). Ragione scritta nell'elenco di storia36.
-- CLASSIFICAZIONE E REGISTRO: tabella classificata in 000429 e registrata in 000062, file di
--   numero minore, emendati come per la 000515.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, funzioni CREATE OR REPLACE, trigger
--   DROP IF EXISTS / CREATE, vista CREATE OR REPLACE.
-- ROLLBACK DICHIARATO (elenco esplicito):
--   DROP VIEW sys.v_agent_signals_fuori_perimetro;
--   DROP TABLE sys.sys_agent_signals;
--   DROP FUNCTION sys.sys_agent_signal_guardia(), sys.sys_agent_signal_destinatario_ammesso(uuid, uuid, varchar, varchar, uuid);
--   e le righe in 000429, 000062 e db/scripts/audit-storia36-empty-tables.txt.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── 1. La segnalazione ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_agent_signals (
  agent_signal_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_signal_tenant_id         uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  agent_signal_agent_code        varchar(64) NOT NULL DEFAULT 'segnalatori',
  agent_signal_signaler_code     varchar(48) NOT NULL,
  agent_signal_domain            varchar(24) NOT NULL,
  agent_signal_subject_type      varchar(24) NOT NULL,
  agent_signal_subject_id        uuid NOT NULL,
  agent_signal_recipient_user_id uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  agent_signal_recipient_basis   varchar(16) NOT NULL,
  agent_signal_severity          varchar(16) NOT NULL,
  agent_signal_dedupe_key        varchar(255) NOT NULL,
  agent_signal_evidence          jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_signal_source_url        varchar(512),
  agent_signal_status            varchar(16) NOT NULL DEFAULT 'APERTA',
  agent_signal_first_seen_at     timestamptz NOT NULL DEFAULT now(),
  agent_signal_last_seen_at      timestamptz NOT NULL DEFAULT now(),
  agent_signal_expires_on        date NOT NULL,
  agent_signal_closed_at         timestamptz,
  agent_signal_feedback          varchar(16),
  agent_signal_feedback_at       timestamptz,
  agent_signal_notification_id   uuid REFERENCES sys.sys_inbox_notifications(notification_id) ON DELETE SET NULL,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_signaler_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_signaler_check
  CHECK (agent_signal_signaler_code IN ('POSIZIONE_CRITICA_SENZA_SUCCESSORE', 'AMPIEZZA_DI_CONTROLLO', 'POSIZIONE_SCOPERTA'));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_domain_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_domain_check
  CHECK (agent_signal_domain IN ('TALENTI', 'COMPETENZE', 'KPI', 'SELEZIONE', 'ORGANIZZAZIONE',
                                 'CAMBIAMENTO', 'PROCESSI', 'PERSONE'));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_subject_type_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_subject_type_check
  CHECK (agent_signal_subject_type IN ('POSITION', 'ORGANIZATION_UNIT'));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_basis_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_basis_check
  CHECK (agent_signal_recipient_basis IN ('CATENA', 'MANDATO_HR'));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_severity_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_severity_check
  CHECK (agent_signal_severity IN ('INFO', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_status_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_status_check
  CHECK (agent_signal_status IN ('APERTA', 'RISOLTA', 'SCADUTA', 'RITIRATA'));
-- una segnalazione chiusa dice quando; una aperta no
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_closed_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_closed_check
  CHECK ((agent_signal_status = 'APERTA') = (agent_signal_closed_at IS NULL));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_feedback_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_feedback_check
  CHECK ((agent_signal_feedback IS NULL AND agent_signal_feedback_at IS NULL)
      OR (agent_signal_feedback IN ('UTILE', 'NON_UTILE') AND agent_signal_feedback_at IS NOT NULL));
ALTER TABLE sys.sys_agent_signals DROP CONSTRAINT IF EXISTS sys_agent_signals_evidence_check;
ALTER TABLE sys.sys_agent_signals ADD CONSTRAINT sys_agent_signals_evidence_check
  CHECK (jsonb_typeof(agent_signal_evidence) = 'object');

-- G5 niente doppioni
CREATE UNIQUE INDEX IF NOT EXISTS sys_agent_signals_open_uq
  ON sys.sys_agent_signals (agent_signal_recipient_user_id, agent_signal_dedupe_key)
  WHERE agent_signal_status = 'APERTA';
CREATE INDEX IF NOT EXISTS sys_agent_signals_recipient_idx
  ON sys.sys_agent_signals (agent_signal_recipient_user_id, agent_signal_status, agent_signal_first_seen_at DESC);
CREATE INDEX IF NOT EXISTS sys_agent_signals_tenant_idx
  ON sys.sys_agent_signals (agent_signal_tenant_id, agent_signal_signaler_code, agent_signal_status);

DROP TRIGGER IF EXISTS sys_agent_signals_set_updated_at ON sys.sys_agent_signals;
CREATE TRIGGER sys_agent_signals_set_updated_at BEFORE UPDATE ON sys.sys_agent_signals
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();

COMMENT ON TABLE sys.sys_agent_signals IS
  'Segnalazioni degli agenti (ADR-0063, E6, 000522): una riga per destinatario, nel suo perimetro, con i numeri che la reggono. Gli agenti non scrivono altrove.';

-- ── 2. Chi può ricevere (G1-G4), usata dalla guardia e dalla sentinella ────────────────────────
CREATE OR REPLACE FUNCTION sys.sys_agent_signal_destinatario_ammesso(
  p_tenant uuid, p_recipient uuid, p_basis varchar, p_signaler varchar, p_subject uuid
) RETURNS text LANGUAGE plpgsql STABLE AS $$
-- Restituisce NULL se il destinatario è ammesso, altrimenti la ragione del rifiuto.
DECLARE
  v_unit uuid;
  v_ok   boolean;
BEGIN
  -- G1
  IF NOT EXISTS (SELECT 1 FROM sys.sys_users u
                  WHERE u.user_id = p_recipient AND u.user_tenant_id = p_tenant) THEN
    RETURN 'G1: il destinatario non è una persona del tenant della segnalazione';
  END IF;
  -- G2: l'unità del soggetto (posizione o unità)
  SELECT p.position_organization_unit_id INTO v_unit
    FROM sys.sys_positions p WHERE p.position_id = p_subject AND p.position_tenant_id = p_tenant;
  IF NOT FOUND THEN
    SELECT o.organization_unit_id INTO v_unit
      FROM sys.sys_organization_units o
     WHERE o.organization_unit_id = p_subject AND o.organization_unit_tenant_id = p_tenant;
    IF NOT FOUND THEN
      RETURN 'G2: il soggetto non esiste nel tenant della segnalazione';
    END IF;
  END IF;
  -- G4: la successione non si comunica al titolare
  IF p_signaler = 'POSIZIONE_CRITICA_SENZA_SUCCESSORE' AND EXISTS (
       SELECT 1 FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_position_id = p_subject
          AND a.user_position_assignment_user_id = p_recipient
          AND a.user_position_assignment_status = 'ACTIVE') THEN
    RETURN 'G4: la successione di una posizione non si segnala al suo titolare';
  END IF;
  -- G3
  IF p_basis = 'MANDATO_HR' THEN
    SELECT EXISTS (
      SELECT 1 FROM sys.sys_user_auth_roles ur
        JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
       WHERE ur.user_auth_role_user_id = p_recipient
         AND ur.user_auth_role_revoked_at IS NULL
         AND (ur.user_auth_role_tenant_id IS NULL OR ur.user_auth_role_tenant_id = p_tenant)
         AND r.auth_role_code IN ('TENANT_ADMIN', 'HRMS_MANAGER', 'PEOPLE_MANAGER')) INTO v_ok;
    IF NOT v_ok THEN
      RETURN 'G3: il destinatario non ha un mandato HR attivo sul tenant';
    END IF;
  ELSE
    IF v_unit IS NULL THEN
      RETURN 'G3: il soggetto non ha un''unità, quindi nessuna catena';
    END IF;
    WITH RECURSIVE su AS (
      SELECT v_unit AS ou
      UNION
      SELECT o.organization_unit_parent_id
        FROM sys.sys_organization_units o JOIN su ON o.organization_unit_id = su.ou
       WHERE o.organization_unit_parent_id IS NOT NULL
    )
    SELECT EXISTS (
      SELECT 1 FROM sys.sys_organization_units o JOIN su ON o.organization_unit_id = su.ou
       WHERE o.organization_unit_manager_user_id = p_recipient AND o.organization_unit_is_active) INTO v_ok;
    IF NOT v_ok THEN
      RETURN 'G3: il destinatario non dirige l''unità del soggetto né una che le sta sopra';
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION sys.sys_agent_signal_guardia() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_rifiuto text;
BEGIN
  -- solo su ciò che apre o riapre una segnalazione: chiudere non chiede di essere ammessi
  IF NEW.agent_signal_status = 'APERTA' THEN
    v_rifiuto := sys.sys_agent_signal_destinatario_ammesso(
      NEW.agent_signal_tenant_id, NEW.agent_signal_recipient_user_id, NEW.agent_signal_recipient_basis,
      NEW.agent_signal_signaler_code, NEW.agent_signal_subject_id);
    IF v_rifiuto IS NOT NULL THEN
      RAISE EXCEPTION 'segnalazione fuori perimetro (%)', v_rifiuto USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sys_agent_signals_guardia ON sys.sys_agent_signals;
CREATE TRIGGER sys_agent_signals_guardia
  BEFORE INSERT OR UPDATE OF agent_signal_tenant_id, agent_signal_recipient_user_id, agent_signal_recipient_basis,
                             agent_signal_subject_id, agent_signal_signaler_code, agent_signal_status
  ON sys.sys_agent_signals
  FOR EACH ROW EXECUTE FUNCTION sys.sys_agent_signal_guardia();

-- ── 3. La sentinella: deve restare vuota ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_agent_signals_fuori_perimetro AS
SELECT s.agent_signal_id, s.agent_signal_tenant_id, s.agent_signal_signaler_code,
       s.agent_signal_recipient_user_id, s.agent_signal_subject_id, x.rifiuto
  FROM sys.sys_agent_signals s
  CROSS JOIN LATERAL (SELECT sys.sys_agent_signal_destinatario_ammesso(
         s.agent_signal_tenant_id, s.agent_signal_recipient_user_id, s.agent_signal_recipient_basis,
         s.agent_signal_signaler_code, s.agent_signal_subject_id) AS rifiuto) x
 WHERE s.agent_signal_status = 'APERTA' AND x.rifiuto IS NOT NULL;

COMMENT ON VIEW sys.v_agent_signals_fuori_perimetro IS
  'Sentinella (000522): segnalazioni aperte il cui destinatario non ha più titolo a riceverle. Deve essere vuota dopo ogni giro dei segnalatori.';

-- ── 4. Post-condizione ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid = 'sys.sys_agent_signals'::regclass AND tgname = 'sys_agent_signals_guardia' AND NOT tgisinternal;
  IF n <> 1 THEN
    RAISE EXCEPTION '000522: la guardia del perimetro manca su sys_agent_signals';
  END IF;
  SELECT count(*) INTO n FROM sys.v_agent_signals_fuori_perimetro;
  IF n <> 0 THEN
    RAISE NOTICE '000522: % segnalazioni aperte fuori perimetro; il segnalatore le ritira al prossimo giro', n;
  END IF;
END $$;

COMMIT;
