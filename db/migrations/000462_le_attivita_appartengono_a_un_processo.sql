-- ============================================================================
-- 000462 — Le attivita' appartengono a un processo (ADR-0049; onda 2, T1 e T2 di
--          .programmi/onda2/DISEGNO_tabelle-onda2.md §2, piu' il legame del lavoro)
--
-- IL PROBLEMA. Misurato il 2026-10-27 su una copia del dump notturno: nessuna attivita' sa a quale
-- processo appartiene. Il processo del tenant e' un processo del modello agganciato a un'unita'
-- (000121), senza attivita'; le 741 richieste di approvazione di RTL Bank e i 26 progetti non portano
-- il processo. La cella ACTIVITY = read del dominio process_coordination (ADR-0036 §8) non ha dati.
--
-- COSA FA.
--   T1  sys_tenant_processes — il processo del tenant, con il legame al modello come origine e il
--       posto del suo owner; colonna org_unit_process_tenant_process_id su sys_organization_unit_processes.
--   T2  sys_tenant_process_steps — le attivita' del processo, ordinate, con chi le esegue. In piu' del
--       disegno: tenant_process_step_org_unit_id, l'unita' che esegue l'attivita' (ADR-0049 §2): il
--       datastore assegna le fasi alle unita', non ai posti.
--   R   sys_tenant_process_activity_rules — a quale processo (e attivita') appartiene un tipo di
--       richiesta di approvazione, per tenant. E' una regola del tenant, non del codice.
--   L   approval_request_tenant_process_id e approval_request_tenant_process_step_id sulle richieste,
--       project_tenant_process_id sui progetti; un innesco BEFORE INSERT da' alla richiesta nuova il
--       processo della regola quando chi la crea non lo indica.
--   C6  cinque sentinelle sys.v_*_cross_tenant, che devono stare a zero.
--
-- NON FA. Non scrive dati: le tabelle nascono vuote, le colonne nulle. Il riempimento e' fuori catena
-- (db/scripts/attivita/riempi-attivita-dei-processi.sql), con giornale e inversa.
-- CLASSIFICAZIONE E REGISTRO: le tre tabelle sono classificate 'importato' in 000429 e registrate in
--   000062, che sono file di numero minore (C8, C9): registrarle solo qui sarebbe verde alla prima
--   passata e rosso alla seconda.
-- POST-CONDIZIONE: righe e impronta delle tre tabelle toccate invariate, tranne le colonne nuove.
-- INVERSA, FUORI CATENA: db/scripts/onda2/000462-inversa.sql (si rifiuta se trova dati).
-- IDEMPOTENTE: IF NOT EXISTS ovunque, vincoli e indici solo se assenti. Authored: 2026-10-27.
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_n_ap bigint; v_h_ap text; v_n_pr bigint; v_h_pr text; v_n_ou bigint; v_h_ou text;
  w_n bigint; w_h text;
BEGIN
  -- MISURA prima: le tre tabelle esistenti che ricevono una colonna.
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'approval_request_tenant_process_id' - 'approval_request_tenant_process_step_id')::text, '|' ORDER BY t.approval_request_id)), '')
    INTO v_n_ap, v_h_ap FROM sys.sys_approval_requests t;
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'project_tenant_process_id')::text, '|' ORDER BY t.project_id)), '')
    INTO v_n_pr, v_h_pr FROM sys.sys_projects t;
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'org_unit_process_tenant_process_id')::text, '|' ORDER BY t.organization_unit_process_id)), '')
    INTO v_n_ou, v_h_ou FROM sys.sys_organization_unit_processes t;

  -- ------------------------------------------------------------------- T1
  CREATE TABLE IF NOT EXISTS sys.sys_tenant_processes (
    tenant_process_id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_process_tenant_id                 uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
    tenant_process_code                      varchar(64)  NOT NULL,
    tenant_process_name                      varchar(255) NOT NULL,
    tenant_process_description               text,
    tenant_process_owner_position_id         uuid REFERENCES sys.sys_positions(position_id) ON DELETE RESTRICT,
    tenant_process_source_blueprint_process_id uuid REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE SET NULL,
    tenant_process_is_active                 boolean NOT NULL DEFAULT true,
    tenant_process_metadata                  jsonb NOT NULL DEFAULT '{}'::jsonb,
    origine_dato                             varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE',
    created_at                               timestamptz NOT NULL DEFAULT now(),
    created_by                               uuid,
    updated_at                               timestamptz NOT NULL DEFAULT now(),
    updated_by                               uuid,
    CONSTRAINT sys_tenant_processes_code_uq UNIQUE (tenant_process_tenant_id, tenant_process_code),
    CONSTRAINT sys_tenant_processes_origine_ck CHECK (origine_dato IN ('IMPORT','NATIVO','MATERIALIZZAZIONE'))
  );
  CREATE INDEX IF NOT EXISTS sys_tenant_processes_owner_idx  ON sys.sys_tenant_processes (tenant_process_owner_position_id);
  CREATE INDEX IF NOT EXISTS sys_tenant_processes_source_idx ON sys.sys_tenant_processes (tenant_process_source_blueprint_process_id);

  ALTER TABLE sys.sys_organization_unit_processes ADD COLUMN IF NOT EXISTS org_unit_process_tenant_process_id uuid;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_organization_unit_processes_tenant_process_fk') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_organization_unit_processes_tenant_process_fk
      FOREIGN KEY (org_unit_process_tenant_process_id) REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS sys_organization_unit_processes_tenant_process_idx
    ON sys.sys_organization_unit_processes (org_unit_process_tenant_process_id);

  -- ------------------------------------------------------------------- T2
  CREATE TABLE IF NOT EXISTS sys.sys_tenant_process_steps (
    tenant_process_step_id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_process_step_tenant_id            uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
    tenant_process_step_process_id           uuid NOT NULL REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE CASCADE,
    tenant_process_step_code                 varchar(64) NOT NULL,
    tenant_process_step_name                 text NOT NULL,
    tenant_process_step_ordinal              smallint NOT NULL,
    tenant_process_step_input                text,
    tenant_process_step_output               text,
    tenant_process_step_org_unit_id          uuid REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE RESTRICT,
    tenant_process_step_executor_kind        varchar(12),
    tenant_process_step_executor_position_id uuid REFERENCES sys.sys_positions(position_id) ON DELETE RESTRICT,
    tenant_process_step_executor_job_role_id uuid REFERENCES sys.sys_job_roles(job_role_id) ON DELETE RESTRICT,
    tenant_process_step_executor_text        text,
    tenant_process_step_work_nature          varchar(24),
    tenant_process_step_delivery_model       varchar(20),
    tenant_process_step_typical_hours_per_cycle numeric(8,2),
    tenant_process_step_metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
    origine_dato                             varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE',
    created_at                               timestamptz NOT NULL DEFAULT now(),
    created_by                               uuid,
    updated_at                               timestamptz NOT NULL DEFAULT now(),
    updated_by                               uuid,
    CONSTRAINT sys_tenant_process_steps_code_uq UNIQUE (tenant_process_step_process_id, tenant_process_step_code),
    CONSTRAINT sys_tenant_process_steps_ordinal_ck CHECK (tenant_process_step_ordinal >= 1),
    CONSTRAINT sys_tenant_process_steps_name_ck CHECK (length(btrim(tenant_process_step_name)) > 0),
    CONSTRAINT sys_tenant_process_steps_executor_kind_ck CHECK (tenant_process_step_executor_kind IS NULL OR tenant_process_step_executor_kind IN ('POSIZIONE','RUOLO','AGENTE')),
    CONSTRAINT sys_tenant_process_steps_executor_ck CHECK (
      num_nonnulls(tenant_process_step_executor_position_id, tenant_process_step_executor_job_role_id, tenant_process_step_executor_text) <= 1
      AND (tenant_process_step_executor_position_id IS NULL OR tenant_process_step_executor_kind = 'POSIZIONE')
      AND (tenant_process_step_executor_job_role_id IS NULL OR tenant_process_step_executor_kind = 'RUOLO')
      AND (tenant_process_step_executor_text IS NULL OR tenant_process_step_executor_kind = 'AGENTE')),
    CONSTRAINT sys_tenant_process_steps_work_nature_ck CHECK (tenant_process_step_work_nature IS NULL OR tenant_process_step_work_nature IN ('PERSONA','ASSISTITO_AI','AUTOMATIZZABILE','AGENTE_SUPERVISIONATO')),
    CONSTRAINT sys_tenant_process_steps_delivery_model_ck CHECK (tenant_process_step_delivery_model IS NULL OR tenant_process_step_delivery_model IN ('INTERNO','SERVIZIO_CONDIVISO','ESTERNO')),
    CONSTRAINT sys_tenant_process_steps_hours_ck CHECK (tenant_process_step_typical_hours_per_cycle IS NULL OR tenant_process_step_typical_hours_per_cycle >= 0),
    CONSTRAINT sys_tenant_process_steps_origine_ck CHECK (origine_dato IN ('IMPORT','NATIVO','MATERIALIZZAZIONE'))
  );
  CREATE INDEX IF NOT EXISTS sys_tenant_process_steps_tenant_idx   ON sys.sys_tenant_process_steps (tenant_process_step_tenant_id);
  CREATE INDEX IF NOT EXISTS sys_tenant_process_steps_unit_idx     ON sys.sys_tenant_process_steps (tenant_process_step_org_unit_id);
  CREATE INDEX IF NOT EXISTS sys_tenant_process_steps_position_idx ON sys.sys_tenant_process_steps (tenant_process_step_executor_position_id);
  CREATE INDEX IF NOT EXISTS sys_tenant_process_steps_job_role_idx ON sys.sys_tenant_process_steps (tenant_process_step_executor_job_role_id);

  -- ------------------------------------------------------------------- R
  CREATE TABLE IF NOT EXISTS sys.sys_tenant_process_activity_rules (
    tenant_process_activity_rule_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_process_activity_rule_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
    tenant_process_activity_rule_resource_type varchar(64) NOT NULL,
    tenant_process_activity_rule_process_id  uuid NOT NULL REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE RESTRICT,
    tenant_process_activity_rule_step_id     uuid REFERENCES sys.sys_tenant_process_steps(tenant_process_step_id) ON DELETE RESTRICT,
    tenant_process_activity_rule_rationale   text,
    origine_dato                             varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE',
    created_at                               timestamptz NOT NULL DEFAULT now(),
    created_by                               uuid,
    updated_at                               timestamptz NOT NULL DEFAULT now(),
    updated_by                               uuid,
    CONSTRAINT sys_tenant_process_activity_rules_uq UNIQUE (tenant_process_activity_rule_tenant_id, tenant_process_activity_rule_resource_type),
    CONSTRAINT sys_tenant_process_activity_rules_origine_ck CHECK (origine_dato IN ('IMPORT','NATIVO','MATERIALIZZAZIONE'))
  );
  CREATE INDEX IF NOT EXISTS sys_tenant_process_activity_rules_process_idx ON sys.sys_tenant_process_activity_rules (tenant_process_activity_rule_process_id);
  CREATE INDEX IF NOT EXISTS sys_tenant_process_activity_rules_step_idx    ON sys.sys_tenant_process_activity_rules (tenant_process_activity_rule_step_id);

  -- ------------------------------------------------------------------- L
  ALTER TABLE sys.sys_approval_requests ADD COLUMN IF NOT EXISTS approval_request_tenant_process_id uuid;
  ALTER TABLE sys.sys_approval_requests ADD COLUMN IF NOT EXISTS approval_request_tenant_process_step_id uuid;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_requests_tenant_process_fk') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_requests_tenant_process_fk
      FOREIGN KEY (approval_request_tenant_process_id) REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_requests_tenant_process_step_fk') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_requests_tenant_process_step_fk
      FOREIGN KEY (approval_request_tenant_process_step_id) REFERENCES sys.sys_tenant_process_steps(tenant_process_step_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_requests_step_needs_process_ck') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_requests_step_needs_process_ck
      CHECK (approval_request_tenant_process_step_id IS NULL OR approval_request_tenant_process_id IS NOT NULL);
  END IF;
  CREATE INDEX IF NOT EXISTS sys_approval_requests_tenant_process_idx      ON sys.sys_approval_requests (approval_request_tenant_process_id);
  CREATE INDEX IF NOT EXISTS sys_approval_requests_tenant_process_step_idx ON sys.sys_approval_requests (approval_request_tenant_process_step_id);

  ALTER TABLE sys.sys_projects ADD COLUMN IF NOT EXISTS project_tenant_process_id uuid;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_projects_tenant_process_fk') THEN
    ALTER TABLE sys.sys_projects ADD CONSTRAINT sys_projects_tenant_process_fk
      FOREIGN KEY (project_tenant_process_id) REFERENCES sys.sys_tenant_processes(tenant_process_id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS sys_projects_tenant_process_idx ON sys.sys_projects (project_tenant_process_id);

  -- POST-CONDIZIONE: niente di cio' che c'era e' cambiato.
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'approval_request_tenant_process_id' - 'approval_request_tenant_process_step_id')::text, '|' ORDER BY t.approval_request_id)), '')
    INTO w_n, w_h FROM sys.sys_approval_requests t;
  IF w_n <> v_n_ap OR w_h <> v_h_ap THEN RAISE EXCEPTION '000462: le richieste di approvazione sono cambiate (% -> % righe)', v_n_ap, w_n; END IF;
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'project_tenant_process_id')::text, '|' ORDER BY t.project_id)), '')
    INTO w_n, w_h FROM sys.sys_projects t;
  IF w_n <> v_n_pr OR w_h <> v_h_pr THEN RAISE EXCEPTION '000462: i progetti sono cambiati (% -> % righe)', v_n_pr, w_n; END IF;
  SELECT count(*), coalesce(md5(string_agg((to_jsonb(t) - 'org_unit_process_tenant_process_id')::text, '|' ORDER BY t.organization_unit_process_id)), '')
    INTO w_n, w_h FROM sys.sys_organization_unit_processes t;
  IF w_n <> v_n_ou OR w_h <> v_h_ou THEN RAISE EXCEPTION '000462: le unita'' di processo sono cambiate (% -> % righe)', v_n_ou, w_n; END IF;
  RAISE NOTICE '000462: T1, T2 e regole presenti; % richieste, % progetti, % unita'' di processo invariate.', v_n_ap, v_n_pr, v_n_ou;
END $$;

-- updated_at, come sulle altre tabelle del tenant.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tenant_processes','sys_tenant_process_steps','sys_tenant_process_activity_rules'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_set_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON sys.%I FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- La richiesta nuova prende il processo dalla regola del suo tenant, se chi la crea non lo indica.
-- Un indicato esplicito vince: la regola e' il caso comune, non un divieto.
CREATE OR REPLACE FUNCTION sys.fn_approval_request_process_from_rule() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.approval_request_tenant_process_id IS NULL AND NEW.approval_request_resource_type IS NOT NULL THEN
    SELECT r.tenant_process_activity_rule_process_id, r.tenant_process_activity_rule_step_id
      INTO NEW.approval_request_tenant_process_id, NEW.approval_request_tenant_process_step_id
      FROM sys.sys_tenant_process_activity_rules r
     WHERE r.tenant_process_activity_rule_tenant_id = NEW.approval_request_tenant_id
       AND r.tenant_process_activity_rule_resource_type = NEW.approval_request_resource_type;
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION sys.fn_approval_request_process_from_rule() IS
  '000462 (ADR-0049) — una richiesta di approvazione nasce con il processo che la regola del tenant assegna al suo tipo, se chi la crea non lo indica.';
DROP TRIGGER IF EXISTS sys_approval_requests_process_from_rule ON sys.sys_approval_requests;
CREATE TRIGGER sys_approval_requests_process_from_rule BEFORE INSERT ON sys.sys_approval_requests
  FOR EACH ROW EXECUTE FUNCTION sys.fn_approval_request_process_from_rule();

-- ------------------------------------------------------------------- C6
CREATE OR REPLACE VIEW sys.v_tenant_processes_cross_tenant AS
SELECT tp.tenant_process_id AS riga, 'posto owner di un altro tenant' AS difetto
  FROM sys.sys_tenant_processes tp JOIN sys.sys_positions p ON p.position_id = tp.tenant_process_owner_position_id
 WHERE p.position_tenant_id <> tp.tenant_process_tenant_id
UNION ALL
SELECT o.organization_unit_process_id, 'unita'' di processo legata al processo di un altro tenant'
  FROM sys.sys_organization_unit_processes o JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = o.org_unit_process_tenant_process_id
 WHERE tp.tenant_process_tenant_id <> o.org_unit_process_tenant_id;

CREATE OR REPLACE VIEW sys.v_tenant_process_steps_cross_tenant AS
SELECT s.tenant_process_step_id AS riga, 'attivita'' e processo di tenant diversi' AS difetto
  FROM sys.sys_tenant_process_steps s JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = s.tenant_process_step_process_id
 WHERE tp.tenant_process_tenant_id <> s.tenant_process_step_tenant_id
UNION ALL
SELECT s.tenant_process_step_id, 'unita'' esecutrice di un altro tenant'
  FROM sys.sys_tenant_process_steps s JOIN sys.sys_organization_units u ON u.organization_unit_id = s.tenant_process_step_org_unit_id
 WHERE u.organization_unit_tenant_id <> s.tenant_process_step_tenant_id
UNION ALL
SELECT s.tenant_process_step_id, 'posto esecutore di un altro tenant'
  FROM sys.sys_tenant_process_steps s JOIN sys.sys_positions p ON p.position_id = s.tenant_process_step_executor_position_id
 WHERE p.position_tenant_id <> s.tenant_process_step_tenant_id;

CREATE OR REPLACE VIEW sys.v_tenant_process_activity_rules_cross_tenant AS
SELECT r.tenant_process_activity_rule_id AS riga, 'regola verso il processo di un altro tenant' AS difetto
  FROM sys.sys_tenant_process_activity_rules r JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = r.tenant_process_activity_rule_process_id
 WHERE tp.tenant_process_tenant_id <> r.tenant_process_activity_rule_tenant_id
UNION ALL
SELECT r.tenant_process_activity_rule_id, 'regola con un''attivita'' di un altro processo'
  FROM sys.sys_tenant_process_activity_rules r JOIN sys.sys_tenant_process_steps s ON s.tenant_process_step_id = r.tenant_process_activity_rule_step_id
 WHERE s.tenant_process_step_process_id <> r.tenant_process_activity_rule_process_id;

CREATE OR REPLACE VIEW sys.v_approval_requests_process_cross_tenant AS
SELECT a.approval_request_id AS riga, 'richiesta legata al processo di un altro tenant' AS difetto
  FROM sys.sys_approval_requests a JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = a.approval_request_tenant_process_id
 WHERE tp.tenant_process_tenant_id <> a.approval_request_tenant_id
UNION ALL
SELECT a.approval_request_id, 'richiesta con un''attivita'' di un altro processo'
  FROM sys.sys_approval_requests a JOIN sys.sys_tenant_process_steps s ON s.tenant_process_step_id = a.approval_request_tenant_process_step_id
 WHERE s.tenant_process_step_process_id <> a.approval_request_tenant_process_id;

CREATE OR REPLACE VIEW sys.v_projects_process_cross_tenant AS
SELECT p.project_id AS riga, 'progetto legato al processo di un altro tenant' AS difetto
  FROM sys.sys_projects p JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = p.project_tenant_process_id
 WHERE tp.tenant_process_tenant_id <> p.project_tenant_id;

COMMENT ON VIEW sys.v_tenant_processes_cross_tenant IS '000462 (C6) — zero righe attese: un processo del tenant con l''owner di un altro tenant, o un''unita'' di processo legata al processo di un altro tenant.';
COMMENT ON VIEW sys.v_tenant_process_steps_cross_tenant IS '000462 (C6) — zero righe attese: un''attivita'' con processo, unita'' o posto di un altro tenant.';
COMMENT ON VIEW sys.v_tenant_process_activity_rules_cross_tenant IS '000462 (C6) — zero righe attese: una regola verso il processo di un altro tenant, o con un''attivita'' di un altro processo.';
COMMENT ON VIEW sys.v_approval_requests_process_cross_tenant IS '000462 (C6) — zero righe attese: una richiesta legata al processo di un altro tenant, o con un''attivita'' di un altro processo.';
COMMENT ON VIEW sys.v_projects_process_cross_tenant IS '000462 (C6) — zero righe attese: un progetto legato al processo di un altro tenant.';

COMMENT ON TABLE sys.sys_tenant_processes IS '000462 (ADR-0049, onda 2 T1) — il processo del tenant, distinto dal processo del modello che ne e'' l''origine.';
COMMENT ON TABLE sys.sys_tenant_process_steps IS '000462 (ADR-0049, onda 2 T2) — le attivita'' di un processo del tenant, ordinate, con l''unita'' e chi le esegue.';
COMMENT ON TABLE sys.sys_tenant_process_activity_rules IS '000462 (ADR-0049) — a quale processo e attivita'' appartiene un tipo di richiesta di approvazione, per tenant.';
COMMENT ON COLUMN sys.sys_tenant_process_steps.tenant_process_step_org_unit_id IS '000462 (ADR-0049 §2) — l''unita'' che esegue l''attivita'': il datastore assegna le fasi alle unita''. Aggiunta al disegno T2.';

COMMIT;

-- Direzione del dato e registro di riconciliazione: le righe stanno in 000429 e 000062 (numeri minori). Qui solo la verifica.
DO $$
DECLARE n_cl int; n_rr int;
BEGIN
  SELECT count(*) INTO n_cl FROM unnest(ARRAY['sys_tenant_processes','sys_tenant_process_steps','sys_tenant_process_activity_rules']) t(nome)
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_classificazione_direzione_dato c WHERE c.tabella = t.nome AND c.stato = 'importato');
  SELECT count(*) INTO n_rr FROM unnest(ARRAY['sys_tenant_processes','sys_tenant_process_steps','sys_tenant_process_activity_rules']) t(nome)
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_reconciliation_registry r WHERE r.reconciliation_registry_table_name = t.nome);
  IF n_cl <> 0 OR n_rr <> 0 THEN
    RAISE EXCEPTION '000462: tabelle nuove non classificate in 000429 (%) o non registrate in 000062 (%)', n_cl, n_rr;
  END IF;
END $$;
