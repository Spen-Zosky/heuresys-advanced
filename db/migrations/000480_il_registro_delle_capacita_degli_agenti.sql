-- ============================================================================================
-- 000480 — Il registro delle capacità degli agenti e delle loro attivazioni per tenant
--          (ADR-0053 passo A1; ADR-0056 D2; piano dei principi agentici, voce T2b).
--
-- IL PROBLEMA. ADR-0053 libera gli agenti una capacità alla volta, per un tenant alla volta, e vuole
-- che il gate riconosca una capacità dall'operazione risolta dell'atlante, non dal nome dello
-- strumento. ADR-0056 D2 aggiunge che la classe di un'azione (A legge, B interna e annullabile,
-- C esce o impegna) è una proprietà fissa dell'operazione, e che solo la classe B può girare senza
-- conferma. Finora né la capacità né la sua attivazione esistevano nel database.
--
-- COSA FA. Tre tabelle nuove, vuote, e una vista:
--   ① sys_agent_capabilities           — il catalogo, di piattaforma e senza tenant: nome, versione,
--                                         agente, gruppi di dati, modo di tornare indietro, tetto per giro;
--   ② sys_agent_capability_operations  — l'elenco CHIUSO delle operazioni dell'atlante che una capacità
--                                         usa, ciascuna con il metodo e la classe A/B/C;
--   ③ sys_agent_capability_activations — le attivazioni per tenant, in modo CONFERMA o LIBERA; solo
--                                         aggiunte: un cambio di modo è una riga nuova che sostituisce
--                                         la precedente, e la storia resta leggibile;
--   ④ v_agent_capability_activations_current — il modo in vigore per tenant e capacità.
--
-- LE GUARDIE STANNO NEL DATABASE, non solo nell'API che verrà:
--   · un'operazione GET è di classe A e solo una GET lo è; una DELETE è di classe C (P17, ADR-0035);
--   · una capacità pubblicata non cambia: le sue operazioni e i suoi campi si toccano solo in BOZZA,
--     e una versione nuova è una riga nuova;
--   · il modo LIBERA si rifiuta se manca l'informativa o il ritorno provato (ADR-0053 D2), se la
--     capacità non è pubblicata, se non ha una scrittura di classe B o se ha anche una sola
--     operazione di classe C (ADR-0056 D2);
--   · un'attivazione decisa da una persona porta chi l'ha decisa; il sistema può solo riportare a
--     CONFERMA (lo spegnimento da sé di ADR-0053 D4).
--
-- CHI SCRIVE: nessuno, per ora. Le rotte (con i permessi per HRMS_MANAGER e PLATFORM_ADMIN) e la
-- lettura dal gate sono le voci successive del piano (T3, passo A3 di ADR-0053).
-- CLASSIFICAZIONE E REGISTRO: le tabelle sono classificate in 000429 e registrate in 000062, file di
--   numero minore, come per la 000464 e la 000475.
-- GDPR: le sole colonne verso sys_users sono di paternità (ON DELETE SET NULL), fuori dal registro
--   dei dati di appartenenza, come in 000464.
-- IDEMPOTENTE: IF NOT EXISTS, CREATE OR REPLACE, vincoli in forma DROP/ADD. NESSUNA CANCELLAZIONE,
--   nessun dato scritto.
-- INVERSA, FUORI CATENA: db/scripts/agenti/inversa-000480.sql (si rifiuta se una tabella ha righe).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── ① il catalogo delle capacità ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_agent_capabilities (
  agent_capability_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- per esempio `consolidamento.organizzazione.collega` (ADR-0053 D1)
  agent_capability_code             varchar(100) NOT NULL,
  agent_capability_version          integer NOT NULL DEFAULT 1,
  -- il codice dell'agente, come nell'anagrafe e nel gettone d'agente (000477)
  agent_capability_agent_code       varchar(64) NOT NULL,
  agent_capability_description      text NOT NULL,
  -- i gruppi di dati che tocca e quelli che dichiara di non toccare (ADR-0053 D1)
  agent_capability_data_groups      text[] NOT NULL DEFAULT '{}',
  agent_capability_excluded_groups  text[] NOT NULL DEFAULT '{}',
  -- il modo di tornare indietro (ADR-0053 D3) e dove sta: la tabella del giornale o la colonna
  agent_capability_undo_mechanism   varchar(20) NOT NULL,
  agent_capability_undo_ref         varchar(300) NOT NULL,
  -- righe scritte per giro, oltre le quali l'agente si ferma e chiede (ADR-0053 D1, D4)
  agent_capability_volume_cap       integer NOT NULL,
  agent_capability_status           varchar(12) NOT NULL DEFAULT 'BOZZA',
  agent_capability_created_by       uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  agent_capability_created_at       timestamptz NOT NULL DEFAULT now(),
  agent_capability_published_at     timestamptz
);

ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_code_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_code_ck
  CHECK (agent_capability_code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_version_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_version_ck
  CHECK (agent_capability_version >= 1);
ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_undo_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_undo_ck
  CHECK (agent_capability_undo_mechanism IN ('GIORNALE_UNDO', 'RIGA_SOSTITUTIVA'));
ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_cap_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_cap_ck
  CHECK (agent_capability_volume_cap > 0);
ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_status_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_status_ck
  CHECK (agent_capability_status IN ('BOZZA', 'PUBBLICATA', 'RITIRATA'));
ALTER TABLE sys.sys_agent_capabilities DROP CONSTRAINT IF EXISTS sys_agent_capabilities_published_ck;
ALTER TABLE sys.sys_agent_capabilities ADD CONSTRAINT sys_agent_capabilities_published_ck
  CHECK ((agent_capability_status = 'BOZZA') = (agent_capability_published_at IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS sys_agent_capabilities_code_version_uq
  ON sys.sys_agent_capabilities (agent_capability_code, agent_capability_version);

-- ── ② le operazioni di una capacità ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_agent_capability_operations (
  agent_capability_operation_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: una capacità che ha operazioni non si cancella, si ritira (ADR-0035)
  agent_capability_operation_capability_id uuid NOT NULL
    REFERENCES sys.sys_agent_capabilities(agent_capability_id) ON DELETE RESTRICT,
  -- concetto e operazione dell'atlante: lo stesso riconoscimento del gate (ADR-0033 §5.2)
  agent_capability_operation_concept_id    varchar(200) NOT NULL,
  agent_capability_operation_operation_id  varchar(200) NOT NULL,
  agent_capability_operation_http_method   varchar(8) NOT NULL,
  agent_capability_operation_action_class  varchar(1) NOT NULL,
  agent_capability_operation_created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_agent_capability_operations DROP CONSTRAINT IF EXISTS sys_agent_capability_operations_method_ck;
ALTER TABLE sys.sys_agent_capability_operations ADD CONSTRAINT sys_agent_capability_operations_method_ck
  CHECK (agent_capability_operation_http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'));
ALTER TABLE sys.sys_agent_capability_operations DROP CONSTRAINT IF EXISTS sys_agent_capability_operations_class_ck;
ALTER TABLE sys.sys_agent_capability_operations ADD CONSTRAINT sys_agent_capability_operations_class_ck
  CHECK (agent_capability_operation_action_class IN ('A', 'B', 'C'));
-- la classe A è la lettura, e solo la lettura (ADR-0056 D2)
ALTER TABLE sys.sys_agent_capability_operations DROP CONSTRAINT IF EXISTS sys_agent_capability_operations_read_ck;
ALTER TABLE sys.sys_agent_capability_operations ADD CONSTRAINT sys_agent_capability_operations_read_ck
  CHECK ((agent_capability_operation_http_method = 'GET') = (agent_capability_operation_action_class = 'A'));
-- ogni cancellazione è di classe C (P17, ADR-0035)
ALTER TABLE sys.sys_agent_capability_operations DROP CONSTRAINT IF EXISTS sys_agent_capability_operations_delete_ck;
ALTER TABLE sys.sys_agent_capability_operations ADD CONSTRAINT sys_agent_capability_operations_delete_ck
  CHECK (agent_capability_operation_http_method <> 'DELETE' OR agent_capability_operation_action_class = 'C');

CREATE UNIQUE INDEX IF NOT EXISTS sys_agent_capability_operations_uq
  ON sys.sys_agent_capability_operations
     (agent_capability_operation_capability_id, agent_capability_operation_concept_id,
      agent_capability_operation_operation_id);

-- ── ③ le attivazioni per tenant ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_agent_capability_activations (
  agent_capability_activation_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_capability_activation_tenant_id         uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  agent_capability_activation_capability_id     uuid NOT NULL
    REFERENCES sys.sys_agent_capabilities(agent_capability_id) ON DELETE RESTRICT,
  agent_capability_activation_mode              varchar(10) NOT NULL,
  -- PERSONA: l'ha deciso una persona; AUTOMATICO: lo spegnimento da sé (ADR-0053 D4)
  agent_capability_activation_source            varchar(12) NOT NULL DEFAULT 'PERSONA',
  -- l'informativa ai lavoratori (legge 132/2025 art. 11): versione e data, o il suo riferimento
  agent_capability_activation_notice_ref        varchar(300),
  -- il ritorno provato su una copia (ADR-0053 D2 punto 2): comando, esito, data
  agent_capability_activation_rollback_proof_ref varchar(500),
  -- la soglia di fiducia sotto la quale l'agente si ferma e chiede (ADR-0053 D6)
  agent_capability_activation_confidence_min    smallint,
  agent_capability_activation_reason            text NOT NULL,
  agent_capability_activation_decided_by        uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  agent_capability_activation_decided_at        timestamptz NOT NULL DEFAULT now(),
  -- un cambio di modo è una riga nuova che sostituisce questa: la storia non si sovrascrive
  agent_capability_activation_supersedes_id     uuid
    REFERENCES sys.sys_agent_capability_activations(agent_capability_activation_id)
);

ALTER TABLE sys.sys_agent_capability_activations DROP CONSTRAINT IF EXISTS sys_agent_capability_activations_mode_ck;
ALTER TABLE sys.sys_agent_capability_activations ADD CONSTRAINT sys_agent_capability_activations_mode_ck
  CHECK (agent_capability_activation_mode IN ('CONFERMA', 'LIBERA'));
ALTER TABLE sys.sys_agent_capability_activations DROP CONSTRAINT IF EXISTS sys_agent_capability_activations_source_ck;
ALTER TABLE sys.sys_agent_capability_activations ADD CONSTRAINT sys_agent_capability_activations_source_ck
  CHECK (agent_capability_activation_source IN ('PERSONA', 'AUTOMATICO'));
-- il sistema può solo spegnere, mai liberare
ALTER TABLE sys.sys_agent_capability_activations DROP CONSTRAINT IF EXISTS sys_agent_capability_activations_auto_ck;
ALTER TABLE sys.sys_agent_capability_activations ADD CONSTRAINT sys_agent_capability_activations_auto_ck
  CHECK (agent_capability_activation_source = 'PERSONA' OR agent_capability_activation_mode = 'CONFERMA');
-- le due condizioni previe scritte di ADR-0053 D2 (la terza, il «per conto di», sta nel registro)
ALTER TABLE sys.sys_agent_capability_activations DROP CONSTRAINT IF EXISTS sys_agent_capability_activations_libera_ck;
ALTER TABLE sys.sys_agent_capability_activations ADD CONSTRAINT sys_agent_capability_activations_libera_ck
  CHECK (agent_capability_activation_mode <> 'LIBERA'
      OR (nullif(btrim(agent_capability_activation_notice_ref), '') IS NOT NULL
          AND nullif(btrim(agent_capability_activation_rollback_proof_ref), '') IS NOT NULL));
ALTER TABLE sys.sys_agent_capability_activations DROP CONSTRAINT IF EXISTS sys_agent_capability_activations_confidence_ck;
ALTER TABLE sys.sys_agent_capability_activations ADD CONSTRAINT sys_agent_capability_activations_confidence_ck
  CHECK (agent_capability_activation_confidence_min IS NULL
      OR agent_capability_activation_confidence_min BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS sys_agent_capability_activations_tenant_idx
  ON sys.sys_agent_capability_activations
     (agent_capability_activation_tenant_id, agent_capability_activation_capability_id,
      agent_capability_activation_decided_at DESC);

-- ── guardie: una capacità pubblicata non cambia ───────────────────────────────────────
CREATE OR REPLACE FUNCTION sys.f_agent_capability_immutabile() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.agent_capability_status <> 'BOZZA' THEN
      RAISE EXCEPTION 'sys_agent_capabilities: la capacità % v% è %, si ritira e non si cancella (ADR-0035)',
        OLD.agent_capability_code, OLD.agent_capability_version, OLD.agent_capability_status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.agent_capability_status = 'BOZZA' THEN
    RETURN NEW;
  END IF;
  -- fuori dalla BOZZA cambiano solo lo stato (PUBBLICATA -> RITIRATA) e la paternità messa a NULL
  IF (NEW.agent_capability_code, NEW.agent_capability_version, NEW.agent_capability_agent_code,
      NEW.agent_capability_description, NEW.agent_capability_data_groups, NEW.agent_capability_excluded_groups,
      NEW.agent_capability_undo_mechanism, NEW.agent_capability_undo_ref, NEW.agent_capability_volume_cap,
      NEW.agent_capability_created_at, NEW.agent_capability_published_at)
     IS DISTINCT FROM
     (OLD.agent_capability_code, OLD.agent_capability_version, OLD.agent_capability_agent_code,
      OLD.agent_capability_description, OLD.agent_capability_data_groups, OLD.agent_capability_excluded_groups,
      OLD.agent_capability_undo_mechanism, OLD.agent_capability_undo_ref, OLD.agent_capability_volume_cap,
      OLD.agent_capability_created_at, OLD.agent_capability_published_at)
     OR (NEW.agent_capability_created_by IS DISTINCT FROM OLD.agent_capability_created_by
         AND NEW.agent_capability_created_by IS NOT NULL)
     OR NOT (NEW.agent_capability_status = OLD.agent_capability_status
             OR (OLD.agent_capability_status = 'PUBBLICATA' AND NEW.agent_capability_status = 'RITIRATA')) THEN
    RAISE EXCEPTION 'sys_agent_capabilities: la capacità % v% è %, non si modifica: si fa una versione nuova',
      OLD.agent_capability_code, OLD.agent_capability_version, OLD.agent_capability_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_agent_capability_immutabile ON sys.sys_agent_capabilities;
CREATE TRIGGER trg_agent_capability_immutabile
  BEFORE UPDATE OR DELETE ON sys.sys_agent_capabilities
  FOR EACH ROW EXECUTE FUNCTION sys.f_agent_capability_immutabile();

CREATE OR REPLACE FUNCTION sys.f_agent_capability_operations_in_bozza() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_ids uuid[];
  v_stato text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.agent_capability_operation_capability_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.agent_capability_operation_capability_id];
  ELSE
    v_ids := ARRAY[OLD.agent_capability_operation_capability_id, NEW.agent_capability_operation_capability_id];
  END IF;
  SELECT string_agg(DISTINCT c.agent_capability_status, ',') INTO v_stato
    FROM sys.sys_agent_capabilities c
   WHERE c.agent_capability_id = ANY (v_ids) AND c.agent_capability_status <> 'BOZZA';
  IF v_stato IS NOT NULL THEN
    RAISE EXCEPTION 'sys_agent_capability_operations: l''elenco delle operazioni di una capacità % è chiuso',
      v_stato USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_agent_capability_operations_in_bozza ON sys.sys_agent_capability_operations;
CREATE TRIGGER trg_agent_capability_operations_in_bozza
  BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_agent_capability_operations
  FOR EACH ROW EXECUTE FUNCTION sys.f_agent_capability_operations_in_bozza();

-- ── guardie: le attivazioni ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sys.f_agent_capability_activation_ammessa() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_cap   sys.sys_agent_capabilities%ROWTYPE;
  v_n_b   int;
  v_n_c   int;
  v_prec  sys.sys_agent_capability_activations%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sys_agent_capability_activations accetta solo aggiunte: un cambio di modo è una riga nuova'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- l'unico aggiornamento ammesso è quello della FK ON DELETE SET NULL verso la persona
    IF NEW.agent_capability_activation_decided_by IS NULL
       AND (to_jsonb(NEW) - 'agent_capability_activation_decided_by')
           = (to_jsonb(OLD) - 'agent_capability_activation_decided_by') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'sys_agent_capability_activations accetta solo aggiunte: un cambio di modo è una riga nuova'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.agent_capability_activation_source = 'PERSONA' AND NEW.agent_capability_activation_decided_by IS NULL THEN
    RAISE EXCEPTION 'sys_agent_capability_activations: un''attivazione decisa da una persona dice chi l''ha decisa'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.agent_capability_activation_supersedes_id IS NOT NULL THEN
    SELECT * INTO v_prec FROM sys.sys_agent_capability_activations
     WHERE agent_capability_activation_id = NEW.agent_capability_activation_supersedes_id;
    IF v_prec.agent_capability_activation_tenant_id IS DISTINCT FROM NEW.agent_capability_activation_tenant_id
       OR v_prec.agent_capability_activation_capability_id IS DISTINCT FROM NEW.agent_capability_activation_capability_id THEN
      RAISE EXCEPTION 'sys_agent_capability_activations: si sostituisce solo un''attivazione dello stesso tenant e della stessa capacità'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.agent_capability_activation_mode = 'LIBERA' THEN
    SELECT * INTO v_cap FROM sys.sys_agent_capabilities
     WHERE agent_capability_id = NEW.agent_capability_activation_capability_id;
    IF v_cap.agent_capability_status <> 'PUBBLICATA' THEN
      RAISE EXCEPTION 'sys_agent_capability_activations: la capacità % v% è %, non si libera',
        v_cap.agent_capability_code, v_cap.agent_capability_version, v_cap.agent_capability_status
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) FILTER (WHERE agent_capability_operation_action_class = 'B'),
           count(*) FILTER (WHERE agent_capability_operation_action_class = 'C')
      INTO v_n_b, v_n_c
      FROM sys.sys_agent_capability_operations
     WHERE agent_capability_operation_capability_id = v_cap.agent_capability_id;
    IF v_n_c > 0 THEN
      RAISE EXCEPTION 'sys_agent_capability_activations: la capacità % v% ha % operazioni di classe C, che non diventano mai automatiche (ADR-0056 D2)',
        v_cap.agent_capability_code, v_cap.agent_capability_version, v_n_c
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_n_b = 0 THEN
      RAISE EXCEPTION 'sys_agent_capability_activations: la capacità % v% non ha scritture di classe B, non c''è niente da liberare',
        v_cap.agent_capability_code, v_cap.agent_capability_version
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_agent_capability_activation_ammessa ON sys.sys_agent_capability_activations;
CREATE TRIGGER trg_agent_capability_activation_ammessa
  BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_agent_capability_activations
  FOR EACH ROW EXECUTE FUNCTION sys.f_agent_capability_activation_ammessa();

-- ── ④ il modo in vigore ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_agent_capability_activations_current AS
SELECT DISTINCT ON (a.agent_capability_activation_tenant_id, a.agent_capability_activation_capability_id)
       a.agent_capability_activation_id,
       a.agent_capability_activation_tenant_id,
       a.agent_capability_activation_capability_id,
       c.agent_capability_code,
       c.agent_capability_version,
       c.agent_capability_status,
       a.agent_capability_activation_mode,
       a.agent_capability_activation_source,
       a.agent_capability_activation_decided_by,
       a.agent_capability_activation_decided_at
  FROM sys.sys_agent_capability_activations a
  JOIN sys.sys_agent_capabilities c ON c.agent_capability_id = a.agent_capability_activation_capability_id
 -- In vigore è l'attivazione che nessun'altra sostituisce (T3c, 2026-11-06): due decisioni nella
 -- stessa transazione hanno lo stesso decided_at, e l'ordine per id (casuale) le invertiva.
 WHERE NOT EXISTS (
         SELECT 1 FROM sys.sys_agent_capability_activations s
          WHERE s.agent_capability_activation_supersedes_id = a.agent_capability_activation_id)
 ORDER BY a.agent_capability_activation_tenant_id, a.agent_capability_activation_capability_id,
          a.agent_capability_activation_decided_at DESC, a.agent_capability_activation_id DESC;

COMMENT ON TABLE sys.sys_agent_capabilities IS
  '000480 (ADR-0053 A1, ADR-0056 D2) — catalogo di piattaforma delle capacità degli agenti: nome, versione, agente, gruppi di dati, ritorno, tetto per giro. Pubblicata non cambia: una versione nuova è una riga nuova.';
COMMENT ON TABLE sys.sys_agent_capability_operations IS
  '000480 (ADR-0053 A1, ADR-0056 D2) — elenco chiuso delle operazioni dell''atlante di una capacità, con metodo e classe A/B/C. GET è A e solo GET; DELETE è C.';
COMMENT ON TABLE sys.sys_agent_capability_activations IS
  '000480 (ADR-0053 A1) — attivazioni di una capacità per tenant, modo CONFERMA o LIBERA. Solo aggiunte. LIBERA pretende informativa, ritorno provato, capacità pubblicata, almeno una scrittura B e nessuna C.';
COMMENT ON VIEW sys.v_agent_capability_activations_current IS
  '000480 (ADR-0053 A1) — il modo in vigore per tenant e capacità: l''attivazione più recente. Nessuna riga = la capacità non è attiva nel tenant.';

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_tab int; n_cl int; n_rr int; n_ck int; n_trg int;
BEGIN
  SELECT count(*) INTO n_tab FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name IN (
     'sys_agent_capabilities', 'sys_agent_capability_operations', 'sys_agent_capability_activations');
  IF n_tab <> 3 THEN RAISE EXCEPTION '000480: le tabelle sono % invece di 3', n_tab; END IF;

  SELECT count(*) INTO n_cl FROM sys.sys_classificazione_direzione_dato
   WHERE tabella IN ('sys_agent_capabilities', 'sys_agent_capability_operations', 'sys_agent_capability_activations');
  SELECT count(*) INTO n_rr FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name IN (
     'sys_agent_capabilities', 'sys_agent_capability_operations', 'sys_agent_capability_activations');
  IF n_cl <> 3 OR n_rr <> 3 THEN
    RAISE EXCEPTION '000480: tabelle classificate in 000429: % su 3; registrate in 000062: % su 3', n_cl, n_rr;
  END IF;

  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conname IN ('sys_agent_capability_operations_read_ck', 'sys_agent_capability_operations_delete_ck',
                     'sys_agent_capability_activations_libera_ck', 'sys_agent_capability_activations_auto_ck');
  IF n_ck <> 4 THEN RAISE EXCEPTION '000480: i CHECK sulle classi e sul modo sono % invece di 4', n_ck; END IF;

  SELECT count(*) INTO n_trg FROM pg_trigger
   WHERE NOT tgisinternal AND tgname IN ('trg_agent_capability_immutabile',
     'trg_agent_capability_operations_in_bozza', 'trg_agent_capability_activation_ammessa');
  IF n_trg <> 3 THEN RAISE EXCEPTION '000480: le guardie sono % invece di 3', n_trg; END IF;

  RAISE NOTICE '000480 ok — registro delle capacità degli agenti: 3 tabelle classificate e registrate, 4 CHECK, 3 guardie.';
END $$;
