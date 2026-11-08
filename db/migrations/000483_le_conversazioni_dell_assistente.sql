-- ============================================================================================
-- 000483 — Le conversazioni dell'assistente stanno nel database (ADR-0056 D4, piano dei principi
--          agentici voce T6a).
--
-- IL FATTO. Fino a qui una conversazione con l'assistente viveva dentro una richiesta HTTP del
-- gateway: chiusa la finestra, il giro si fermava; riaperta, non c'era niente da riprendere; una
-- proposta di scrittura aspettava due minuti in memoria (`apps/agent-gateway/src/approval-bridge.ts`)
-- e poi spariva. ADR-0056 D4 chiede il contrario: conversazioni e attività salvate e legate alla
-- persona e al tenant, il lavoro che prosegue a finestra chiusa, la conversazione che si riprende,
-- le proposte in attesa salvate con la loro scadenza e con il motivo obbligatorio quando si scartano.
--
-- CHE COSA CREA. Quattro tabelle, legate a catena alla conversazione:
--   · `sys_agent_conversations`: di chi è (persona e tenant), con quale agente, la sessione del
--     modello da riprendere, e le impronte delle persone già lette, perché il contatore delle persone
--     distinte segua la conversazione e non la singola richiesta (ADR-0040 §4b). Impronte e non
--     identificativi: per contare i distinti basta l'uguaglianza;
--   · `sys_agent_activities`: una richiesta della persona e il suo giro, con lo stato e il motivo
--     per cui si è fermato;
--   · `sys_agent_activity_events`: ciò che la persona vede del giro, in ordine. Lo scrive il gateway
--     già ridotto: il testo dell'assistente, lo strumento chiamato, le proposte, la fine. Non i
--     risultati degli strumenti, che possono riguardare altre persone;
--   · `sys_agent_proposals`: una scrittura (o una lettura oltre la soglia) che aspetta la persona,
--     con gli argomenti già redatti, la scadenza e, se scartata, il motivo.
--
-- CHI LEGGE E CHI SCRIVE. Solo la persona che possiede la conversazione, e l'assistente per conto
-- suo, attraverso `/v1/agent-conversations` (modulo `agent-conversations`) con il permesso
-- `agent_conversation:use:self`, dato a ogni ruolo di tenant e a PLATFORM_ADMIN. Una proposta la
-- decide solo la persona: un gettone d'agente non approva le proprie proposte (lo rifiuta il
-- servizio). Nessun altro, nemmeno un mandato HR, legge la conversazione di un'altra persona.
--
-- STATI DERIVATI E NON SCRITTI. Una proposta oltre la scadenza si legge SCADUTA, un'attività
-- aperta più vecchia della durata massima si legge INTERROTTA: nessun processo deve passare a
-- chiuderle, e un riavvio del gateway non lascia righe «in corso» per sempre.
--
-- CASCADE VERSO LA PERSONA. È un possesso personale, come le altre 61 FK dell'allowlist della 000303
--   (sentinella sys.v_history_cascade_to_users): emendata lì, con il nome del vincolo dichiarato qui.
-- GDPR. La conversazione appartiene alla persona: è nel registro `sys_gdpr_data_map` come PERSONAL,
--   cancellata con la persona (DELETE); le tabelle figlie seguono per ON DELETE CASCADE.
-- CLASSIFICAZIONE E REGISTRO: le tabelle sono classificate in 000429 e registrate in 000062, file di
--   numero minore, come per la 000480.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, ON CONFLICT DO NOTHING.
-- ROLLBACK DICHIARATO (elenco esplicito, solo su tabelle vuote):
--   DELETE FROM sys.sys_gdpr_data_map WHERE (gdpr_map_table_schema, gdpr_map_table_name,
--     gdpr_map_subject_fk) = ('sys','sys_agent_conversations','agent_conversation_user_id');
--   DELETE FROM sys.sys_auth_role_permissions WHERE auth_permission_id = (SELECT auth_permission_id
--     FROM sys.sys_auth_permissions WHERE auth_permission_code = 'agent_conversation:use:self');
--   DELETE FROM sys.sys_reference_translations WHERE entity_table = 'sys_auth_permissions'
--     AND entity_id = (SELECT auth_permission_id FROM sys.sys_auth_permissions
--                       WHERE auth_permission_code = 'agent_conversation:use:self');
--   DELETE FROM sys.sys_auth_permissions WHERE auth_permission_code = 'agent_conversation:use:self';
--   DROP TABLE sys.sys_agent_proposals, sys.sys_agent_activity_events, sys.sys_agent_activities,
--     sys.sys_agent_conversations;
--   e le quattro righe in 000429 e 000062.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_agent_conversations (
  agent_conversation_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_conversation_tenant_id      uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  -- la persona che possiede la conversazione: l'assistente agisce per conto suo (ADR-0050 D6)
  agent_conversation_user_id        uuid NOT NULL
    CONSTRAINT sys_agent_conversations_user_fk REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  -- il codice dell'agente, come nell'anagrafe (`docs/architecture/agenti/ANAGRAFE_agenti.md`)
  agent_conversation_agent_code     varchar(64) NOT NULL,
  agent_conversation_title          varchar(200) NOT NULL,
  -- la sessione del modello da riprendere (identificativo opaco dell'Agent SDK)
  agent_conversation_sdk_session_ref varchar(100),
  -- impronte SHA-256 delle persone già lette nella conversazione (ADR-0040 §4b), mai identificativi
  agent_conversation_persons_seen   text[] NOT NULL DEFAULT '{}',
  agent_conversation_created_at     timestamptz NOT NULL DEFAULT now(),
  agent_conversation_updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_agent_conversations DROP CONSTRAINT IF EXISTS sys_agent_conversations_agent_ck;
ALTER TABLE sys.sys_agent_conversations ADD CONSTRAINT sys_agent_conversations_agent_ck
  CHECK (agent_conversation_agent_code ~ '^[a-z0-9][a-z0-9-]*$');
ALTER TABLE sys.sys_agent_conversations DROP CONSTRAINT IF EXISTS sys_agent_conversations_title_ck;
ALTER TABLE sys.sys_agent_conversations ADD CONSTRAINT sys_agent_conversations_title_ck
  CHECK (length(btrim(agent_conversation_title)) > 0);
ALTER TABLE sys.sys_agent_conversations DROP CONSTRAINT IF EXISTS sys_agent_conversations_persons_ck;
ALTER TABLE sys.sys_agent_conversations ADD CONSTRAINT sys_agent_conversations_persons_ck
  CHECK (cardinality(agent_conversation_persons_seen) <= 100000
         AND array_to_string(agent_conversation_persons_seen, '') ~ '^([0-9a-f]{64})*$');

CREATE INDEX IF NOT EXISTS sys_agent_conversations_owner_idx
  ON sys.sys_agent_conversations (agent_conversation_tenant_id, agent_conversation_user_id,
                                  agent_conversation_updated_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_agent_activities (
  agent_activity_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_activity_conversation_id  uuid NOT NULL
    REFERENCES sys.sys_agent_conversations(agent_conversation_id) ON DELETE CASCADE,
  agent_activity_prompt           text NOT NULL,
  agent_activity_status           varchar(12) NOT NULL DEFAULT 'IN_CORSO',
  -- perché il giro si è fermato, quando non è finito da sé
  agent_activity_stop_reason      varchar(12),
  -- l'ultima risposta dell'assistente, per l'elenco delle attività
  agent_activity_result           text,
  agent_activity_started_at       timestamptz NOT NULL DEFAULT now(),
  agent_activity_ended_at         timestamptz
);

ALTER TABLE sys.sys_agent_activities DROP CONSTRAINT IF EXISTS sys_agent_activities_status_ck;
ALTER TABLE sys.sys_agent_activities ADD CONSTRAINT sys_agent_activities_status_ck
  CHECK (agent_activity_status IN ('IN_CORSO', 'IN_ATTESA', 'FATTA', 'FALLITA', 'INTERROTTA'));
ALTER TABLE sys.sys_agent_activities DROP CONSTRAINT IF EXISTS sys_agent_activities_stop_ck;
ALTER TABLE sys.sys_agent_activities ADD CONSTRAINT sys_agent_activities_stop_ck
  CHECK (agent_activity_stop_reason IS NULL
         OR agent_activity_stop_reason IN ('DURATA', 'GETTONE', 'GIRI', 'ERRORE', 'PERSONA'));
-- un'attività aperta non ha una fine, una chiusa sì
ALTER TABLE sys.sys_agent_activities DROP CONSTRAINT IF EXISTS sys_agent_activities_end_ck;
ALTER TABLE sys.sys_agent_activities ADD CONSTRAINT sys_agent_activities_end_ck
  CHECK ((agent_activity_status IN ('IN_CORSO', 'IN_ATTESA')) = (agent_activity_ended_at IS NULL));
ALTER TABLE sys.sys_agent_activities DROP CONSTRAINT IF EXISTS sys_agent_activities_prompt_ck;
ALTER TABLE sys.sys_agent_activities ADD CONSTRAINT sys_agent_activities_prompt_ck
  CHECK (length(btrim(agent_activity_prompt)) > 0 AND length(agent_activity_prompt) <= 20000);

CREATE INDEX IF NOT EXISTS sys_agent_activities_conversation_idx
  ON sys.sys_agent_activities (agent_activity_conversation_id, agent_activity_started_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_agent_activity_events (
  agent_activity_event_activity_id uuid NOT NULL
    REFERENCES sys.sys_agent_activities(agent_activity_id) ON DELETE CASCADE,
  agent_activity_event_seq         integer NOT NULL,
  agent_activity_event_kind        varchar(12) NOT NULL,
  agent_activity_event_payload     jsonb NOT NULL,
  agent_activity_event_created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_activity_event_activity_id, agent_activity_event_seq)
);

ALTER TABLE sys.sys_agent_activity_events DROP CONSTRAINT IF EXISTS sys_agent_activity_events_kind_ck;
ALTER TABLE sys.sys_agent_activity_events ADD CONSTRAINT sys_agent_activity_events_kind_ck
  CHECK (agent_activity_event_kind IN ('TESTO', 'STRUMENTO', 'PROPOSTA', 'LIMITE', 'ERRORE', 'FINE'));
ALTER TABLE sys.sys_agent_activity_events DROP CONSTRAINT IF EXISTS sys_agent_activity_events_seq_ck;
ALTER TABLE sys.sys_agent_activity_events ADD CONSTRAINT sys_agent_activity_events_seq_ck
  CHECK (agent_activity_event_seq >= 1);
-- ciò che la persona vede, non un deposito: un evento resta piccolo
ALTER TABLE sys.sys_agent_activity_events DROP CONSTRAINT IF EXISTS sys_agent_activity_events_size_ck;
ALTER TABLE sys.sys_agent_activity_events ADD CONSTRAINT sys_agent_activity_events_size_ck
  CHECK (jsonb_typeof(agent_activity_event_payload) = 'object'
         AND octet_length(agent_activity_event_payload::text) <= 65536);

CREATE TABLE IF NOT EXISTS sys.sys_agent_proposals (
  -- lo stesso identificativo che il gateway manda alla finestra e che la decisione cita
  agent_proposal_id               uuid PRIMARY KEY,
  agent_proposal_activity_id      uuid NOT NULL
    REFERENCES sys.sys_agent_activities(agent_activity_id) ON DELETE CASCADE,
  -- SCRITTURA, o LETTURA oltre la soglia alta di persone distinte (#252)
  agent_proposal_kind             varchar(10) NOT NULL,
  agent_proposal_tool             varchar(120) NOT NULL,
  -- gli argomenti come li vede la persona: già redatti dal gateway (`redact.ts`)
  agent_proposal_input            jsonb NOT NULL,
  agent_proposal_action_class     varchar(1),
  agent_proposal_persons_count    integer,
  agent_proposal_status           varchar(10) NOT NULL DEFAULT 'IN_ATTESA',
  agent_proposal_reject_reason    text,
  agent_proposal_created_at       timestamptz NOT NULL DEFAULT now(),
  agent_proposal_expires_at       timestamptz NOT NULL,
  agent_proposal_decided_at       timestamptz
);

ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_kind_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_kind_ck
  CHECK (agent_proposal_kind IN ('SCRITTURA', 'LETTURA'));
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_class_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_class_ck
  CHECK (agent_proposal_action_class IS NULL OR agent_proposal_action_class IN ('A', 'B', 'C'));
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_status_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_status_ck
  CHECK (agent_proposal_status IN ('IN_ATTESA', 'APPROVATA', 'SCARTATA'));
-- scartare chiede un motivo (ADR-0056 D4)
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_reason_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_reason_ck
  CHECK (agent_proposal_status <> 'SCARTATA'
         OR (agent_proposal_reject_reason IS NOT NULL AND length(btrim(agent_proposal_reject_reason)) > 0));
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_decided_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_decided_ck
  CHECK ((agent_proposal_status = 'IN_ATTESA') = (agent_proposal_decided_at IS NULL));
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_expiry_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_expiry_ck
  CHECK (agent_proposal_expires_at > agent_proposal_created_at
         AND agent_proposal_expires_at <= agent_proposal_created_at + interval '1 hour');
ALTER TABLE sys.sys_agent_proposals DROP CONSTRAINT IF EXISTS sys_agent_proposals_input_ck;
ALTER TABLE sys.sys_agent_proposals ADD CONSTRAINT sys_agent_proposals_input_ck
  CHECK (octet_length(agent_proposal_input::text) <= 65536);

CREATE INDEX IF NOT EXISTS sys_agent_proposals_activity_idx
  ON sys.sys_agent_proposals (agent_proposal_activity_id);

COMMENT ON TABLE sys.sys_agent_conversations IS
  '000483 (ADR-0056 D4, piano T6a) — una conversazione con l''assistente, di una persona in un tenant. La legge e la scrive solo la persona, o l''assistente per conto suo.';
COMMENT ON TABLE sys.sys_agent_activities IS
  '000483 (ADR-0056 D4) — una richiesta della persona e il suo giro: stato e motivo dell''arresto. Un''attività aperta più vecchia della durata massima si legge INTERROTTA.';
COMMENT ON TABLE sys.sys_agent_activity_events IS
  '000483 (ADR-0056 D4) — ciò che la persona vede del giro, in ordine: testo, strumenti, proposte, fine. Non i risultati degli strumenti.';
COMMENT ON TABLE sys.sys_agent_proposals IS
  '000483 (ADR-0056 D4) — una proposta dell''assistente che aspetta la persona, con argomenti redatti e scadenza. Scartarla chiede un motivo; oltre la scadenza si legge SCADUTA.';

-- ---------------------------------------------------------------- il permesso
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT 'agent_conversation:use:self', 'Usare l''assistente: le proprie conversazioni, attività e proposte',
       'agent_conversation', 'use'
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'agent_conversation:use:self');

-- TENANT_ADMIN usa l'assistente come ogni persona (guardia D-57, deny-by-default della 000210).
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000483(code text PRIMARY KEY);
INSERT INTO _ta_extend_000483(code) VALUES
    ('agent_conversation:use:self');
DROP TABLE _ta_extend_000483;

-- Ogni ruolo di tenant in servizio, e PLATFORM_ADMIN: la conversazione è sempre della persona,
-- quale che sia il suo ruolo.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'agent_conversation:use:self'
 WHERE r.retired_at IS NULL
   AND (r.auth_role_is_platform = false OR r.auth_role_code = 'PLATFORM_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en',
       'Use the assistant: one''s own conversations, activities and proposals', 'MANUAL'
  FROM sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'agent_conversation:use:self'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- GDPR
INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_retention_days, gdpr_map_age_column, gdpr_map_legal_basis
) VALUES
  ('sys', 'sys_agent_conversations', 'agent_conversation_user_id',
   'PERSONAL', 'DELETE', 'SUBJECT', NULL, NULL,
   'Conversazione della persona con l''assistente (ADR-0056 D4, mig 000483): richieste, risposte e '
   'proposte. Si cancella con la persona; attività, eventi e proposte seguono per ON DELETE CASCADE.')
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO NOTHING;

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_tab int; n_cl int; n_rr int; n_ck int; n_mancanti int; n_gdpr int; n_trad int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN (
     'sys_agent_conversations', 'sys_agent_activities', 'sys_agent_activity_events', 'sys_agent_proposals');
  IF n_tab <> 4 THEN RAISE EXCEPTION '000483: le tabelle sono % invece di 4', n_tab; END IF;

  SELECT count(*) INTO n_cl FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_agent_conversations', 'sys_agent_activities', 'sys_agent_activity_events', 'sys_agent_proposals');
  SELECT count(*) INTO n_rr FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN (
     'sys_agent_conversations', 'sys_agent_activities', 'sys_agent_activity_events', 'sys_agent_proposals');
  IF n_cl <> 4 OR n_rr <> 4 THEN
    RAISE EXCEPTION '000483: tabelle classificate in 000429: % su 4; registrate in 000062: % su 4', n_cl, n_rr;
  END IF;

  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conname IN ('sys_agent_proposals_reason_ck', 'sys_agent_proposals_decided_ck',
                     'sys_agent_activities_end_ck', 'sys_agent_conversations_persons_ck');
  IF n_ck <> 4 THEN RAISE EXCEPTION '000483: i CHECK su motivo, decisione, fine e impronte sono % invece di 4', n_ck; END IF;

  -- ogni ruolo di tenant in servizio, e PLATFORM_ADMIN, usa l'assistente
  SELECT count(*) INTO n_mancanti
    FROM sys.sys_auth_roles r
   WHERE r.retired_at IS NULL
     AND (r.auth_role_is_platform = false OR r.auth_role_code = 'PLATFORM_ADMIN')
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE rp.auth_role_id = r.auth_role_id AND p.auth_permission_code = 'agent_conversation:use:self'
          AND rp.revoked_at IS NULL);
  IF n_mancanti <> 0 THEN
    RAISE EXCEPTION '000483: % ruoli senza agent_conversation:use:self', n_mancanti;
  END IF;

  SELECT count(*) INTO n_gdpr FROM sys.sys_gdpr_data_map
   WHERE gdpr_map_table_schema = 'sys' AND gdpr_map_table_name = 'sys_agent_conversations'
     AND gdpr_map_erasure_strategy = 'DELETE' AND gdpr_map_reference_kind = 'SUBJECT';
  IF n_gdpr <> 1 THEN RAISE EXCEPTION '000483: la conversazione non è nel registro GDPR (%)', n_gdpr; END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code = 'agent_conversation:use:self';
  IF n_trad <> 1 THEN RAISE EXCEPTION '000483: la traduzione EN del permesso manca (%)', n_trad; END IF;

  RAISE NOTICE '000483 ok: 4 tabelle, permesso a ogni ruolo di tenant e alla piattaforma, registro GDPR';
END $$;
