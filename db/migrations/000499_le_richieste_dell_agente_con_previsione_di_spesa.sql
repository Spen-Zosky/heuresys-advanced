-- ============================================================================================
-- 000499 — Le richieste dell'agente con previsione di spesa, e il registro di costo e durata
--          (tappa T2: «ogni richiesta dell'agente passa dal sì di Enzo»).
--
-- IL FATTO. Il datastore ha già collaudato il cancello: ogni lavoro che fa pensare il modello mostra
-- la previsione di spesa, rispetta un tetto e consegna una proposta che si accetta o si rifiuta. In
-- advanced le richieste che l'agente genera (difetti, richieste in markdown) non avevano né
-- previsione né tetto né un posto dove aspettare, e nessun registro diceva quanto costasse una
-- chiamata dell'agente e quanto durasse.
--
-- CHE COSA CREA. Solo aggiunte, nessun oggetto esistente toccato:
--   · `sys_agent_requests`: una richiesta dell'agente per conto di una persona di un tenant, con il
--     testo in markdown, il perimetro del mandato in cui è nata, la previsione di spesa e il tetto.
--     Il CHECK `previsione <= tetto` è il cancello: oltre il tetto la riga non esiste. Stati:
--     IN_ATTESA, ACCETTATA, RIFIUTATA (il rifiuto chiede un motivo).
--   · `sys_agent_call_log`: una riga per ogni chiamata dell'agente (modello, esito, durata in
--     millisecondi, token e costo in dollari), eventualmente legata a una richiesta.
--
-- CHI FA CHE COSA. Propone e legge le proprie richieste ogni persona con il permesso già esistente
-- `agent_conversation:use:self` (e l'assistente per conto suo). Decide, e legge la coda e il registro
-- di tutti, solo chi ha i due permessi nuovi, dati al solo PLATFORM_ADMIN: `agent_request:decide` e
-- `agent_request:read:all`. Nessun permesso nuovo arriva a un ruolo di tenant, quindi le liste chiuse
-- di TENANT_ADMIN, PEOPLE_MANAGER, DATA_STEWARD, RECRUITER e HIRING_MANAGER restano com'erano.
--
-- PATERNITÀ E NON APPARTENENZA. Le colonne che nominano una persona (chi ha chiesto, chi ha
-- deciso, chi ha chiamato) sono `ON DELETE SET NULL`: la richiesta e il suo costo sopravvivono alla
-- persona, come ogni colonna di paternità (000295), e restano fuori dalla mappa GDPR.
-- CLASSIFICAZIONE E REGISTRO: tabelle classificate in 000429 e registrate in 000062, file di numero
--   minore, emendati come per la 000483.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, ON CONFLICT DO NOTHING.
-- ROLLBACK DICHIARATO (elenco esplicito, solo su tabelle vuote):
--   DELETE FROM sys.sys_auth_role_permissions WHERE auth_permission_id IN (SELECT auth_permission_id
--     FROM sys.sys_auth_permissions WHERE auth_permission_code IN ('agent_request:decide','agent_request:read:all'));
--   DELETE FROM sys.sys_reference_translations WHERE entity_table = 'sys_auth_permissions' AND entity_id IN
--     (SELECT auth_permission_id FROM sys.sys_auth_permissions
--       WHERE auth_permission_code IN ('agent_request:decide','agent_request:read:all'));
--   DELETE FROM sys.sys_auth_permissions WHERE auth_permission_code IN ('agent_request:decide','agent_request:read:all');
--   DROP TABLE sys.sys_agent_call_log, sys.sys_agent_requests;
--   e le due righe in 000429 e 000062.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_agent_requests (
  agent_request_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_request_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  -- chi ha chiesto: paternità, sopravvive alla persona
  agent_request_requester_id     uuid
    CONSTRAINT sys_agent_requests_requester_fk REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  agent_request_agent_code       varchar(64) NOT NULL,
  agent_request_title            varchar(200) NOT NULL,
  -- il testo della richiesta o del difetto, in markdown
  agent_request_body             text NOT NULL,
  -- il perimetro del mandato in cui l'agente ha lavorato, scritto per esteso
  agent_request_perimeter        varchar(200) NOT NULL,
  agent_request_estimate_usd     numeric(10,4) NOT NULL,
  agent_request_cap_usd          numeric(10,4) NOT NULL,
  agent_request_status           varchar(10) NOT NULL DEFAULT 'IN_ATTESA',
  agent_request_reject_reason    text,
  agent_request_decided_by       uuid
    CONSTRAINT sys_agent_requests_decided_by_fk REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  agent_request_decided_at       timestamptz,
  agent_request_created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_agent_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_agent_ck
  CHECK (agent_request_agent_code ~ '^[a-z0-9][a-z0-9-]*$');
ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_text_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_text_ck
  CHECK (length(btrim(agent_request_title)) > 0 AND length(btrim(agent_request_body)) > 0
         AND length(btrim(agent_request_perimeter)) > 0 AND length(agent_request_body) <= 100000);
-- il cancello: una previsione positiva che sta dentro un tetto positivo
ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_cap_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_cap_ck
  CHECK (agent_request_estimate_usd > 0 AND agent_request_cap_usd > 0
         AND agent_request_estimate_usd <= agent_request_cap_usd);
ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_status_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_status_ck
  CHECK (agent_request_status IN ('IN_ATTESA', 'ACCETTATA', 'RIFIUTATA'));
-- rifiutare chiede un motivo
ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_reason_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_reason_ck
  CHECK (agent_request_status <> 'RIFIUTATA'
         OR (agent_request_reject_reason IS NOT NULL AND length(btrim(agent_request_reject_reason)) > 0));
-- una richiesta in attesa non ha decisione, una decisa sì
ALTER TABLE sys.sys_agent_requests DROP CONSTRAINT IF EXISTS sys_agent_requests_decided_ck;
ALTER TABLE sys.sys_agent_requests ADD CONSTRAINT sys_agent_requests_decided_ck
  CHECK ((agent_request_status = 'IN_ATTESA') = (agent_request_decided_at IS NULL));

CREATE INDEX IF NOT EXISTS sys_agent_requests_queue_idx
  ON sys.sys_agent_requests (agent_request_status, agent_request_created_at DESC);
CREATE INDEX IF NOT EXISTS sys_agent_requests_tenant_idx
  ON sys.sys_agent_requests (agent_request_tenant_id, agent_request_created_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_agent_call_log (
  agent_call_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_call_tenant_id           uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  agent_call_user_id             uuid
    CONSTRAINT sys_agent_call_log_user_fk REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  agent_call_request_id          uuid
    REFERENCES sys.sys_agent_requests(agent_request_id) ON DELETE SET NULL,
  agent_call_agent_code          varchar(64) NOT NULL,
  agent_call_model               varchar(80) NOT NULL,
  agent_call_outcome             varchar(10) NOT NULL,
  agent_call_duration_ms         integer NOT NULL,
  agent_call_input_tokens        integer NOT NULL DEFAULT 0,
  agent_call_output_tokens       integer NOT NULL DEFAULT 0,
  agent_call_cost_usd            numeric(10,4) NOT NULL DEFAULT 0,
  agent_call_created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_agent_call_log DROP CONSTRAINT IF EXISTS sys_agent_call_log_agent_ck;
ALTER TABLE sys.sys_agent_call_log ADD CONSTRAINT sys_agent_call_log_agent_ck
  CHECK (agent_call_agent_code ~ '^[a-z0-9][a-z0-9-]*$');
ALTER TABLE sys.sys_agent_call_log DROP CONSTRAINT IF EXISTS sys_agent_call_log_outcome_ck;
ALTER TABLE sys.sys_agent_call_log ADD CONSTRAINT sys_agent_call_log_outcome_ck
  CHECK (agent_call_outcome IN ('OK', 'ERRORE', 'LIMITE'));
ALTER TABLE sys.sys_agent_call_log DROP CONSTRAINT IF EXISTS sys_agent_call_log_measures_ck;
ALTER TABLE sys.sys_agent_call_log ADD CONSTRAINT sys_agent_call_log_measures_ck
  CHECK (agent_call_duration_ms >= 0 AND agent_call_input_tokens >= 0
         AND agent_call_output_tokens >= 0 AND agent_call_cost_usd >= 0);

CREATE INDEX IF NOT EXISTS sys_agent_call_log_tenant_idx
  ON sys.sys_agent_call_log (agent_call_tenant_id, agent_call_created_at DESC);

COMMENT ON TABLE sys.sys_agent_requests IS
  '000499 (tappa T2) — una richiesta dell''agente con previsione di spesa e tetto; il CHECK previsione <= tetto è il cancello. La decide solo chi ha agent_request:decide; rifiutare chiede un motivo.';
COMMENT ON TABLE sys.sys_agent_call_log IS
  '000499 (tappa T2) — una riga per chiamata dell''agente: modello, esito, durata, token e costo in dollari, legata a una richiesta quando c''è.';

-- ---------------------------------------------------------------- i permessi (solo PLATFORM_ADMIN)
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, 'agent_request', v.azione
  FROM (VALUES
    ('agent_request:decide',   'Decidere le richieste dell''agente: accettarle o rifiutarle', 'decide'),
    ('agent_request:read:all', 'Leggere la coda delle richieste dell''agente e il registro di costo e durata di tutti i tenant', 'read')
  ) AS v(code, nome, azione)
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code);

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code IN ('agent_request:decide', 'agent_request:read:all')
 WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND r.retired_at IS NULL
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.testo, 'MANUAL'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('agent_request:decide',   'Decide the agent''s requests: accept or reject them'),
    ('agent_request:read:all', 'Read the agent request queue and the cost and duration log of all tenants')
  ) AS v(code, testo) ON v.code = p.auth_permission_code
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_tab int; n_cl int; n_rr int; n_ck int; n_perm int; n_rp int; n_trad int; n_fuori int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN ('sys_agent_requests', 'sys_agent_call_log');
  IF n_tab <> 2 THEN RAISE EXCEPTION '000499: le tabelle sono % invece di 2', n_tab; END IF;

  SELECT count(*) INTO n_cl FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_agent_requests', 'sys_agent_call_log');
  SELECT count(*) INTO n_rr FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN ('sys_agent_requests', 'sys_agent_call_log');
  IF n_cl <> 2 OR n_rr <> 2 THEN
    RAISE EXCEPTION '000499: classificate in 000429: % su 2; registrate in 000062: % su 2', n_cl, n_rr;
  END IF;

  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conname IN ('sys_agent_requests_cap_ck', 'sys_agent_requests_reason_ck',
                     'sys_agent_requests_decided_ck', 'sys_agent_call_log_measures_ck');
  IF n_ck <> 4 THEN RAISE EXCEPTION '000499: i CHECK su tetto, motivo, decisione e misure sono % invece di 4', n_ck; END IF;

  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('agent_request:decide', 'agent_request:read:all');
  IF n_perm <> 2 THEN RAISE EXCEPTION '000499: i permessi sono % invece di 2', n_perm; END IF;

  -- i due permessi stanno a PLATFORM_ADMIN e a nessun altro ruolo
  SELECT count(*) INTO n_rp FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('agent_request:decide', 'agent_request:read:all')
     AND r.auth_role_code = 'PLATFORM_ADMIN' AND rp.revoked_at IS NULL;
  SELECT count(*) INTO n_fuori FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('agent_request:decide', 'agent_request:read:all')
     AND r.auth_role_code <> 'PLATFORM_ADMIN' AND rp.revoked_at IS NULL;
  IF n_rp <> 2 OR n_fuori <> 0 THEN
    RAISE EXCEPTION '000499: a PLATFORM_ADMIN % permessi su 2, ad altri ruoli %', n_rp, n_fuori;
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code IN ('agent_request:decide', 'agent_request:read:all');
  IF n_trad <> 2 THEN RAISE EXCEPTION '000499: le traduzioni EN dei permessi sono % su 2', n_trad; END IF;

  RAISE NOTICE '000499 ok: 2 tabelle, 2 permessi a PLATFORM_ADMIN soltanto';
END $$;
