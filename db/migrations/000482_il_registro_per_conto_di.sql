-- 000482 — ADR-0053 A2, piano dei principi agentici voce T5: il registro «per conto di».
--
-- IL FATTO. ADR-0053 D2 pone tre condizioni prima che una capacità dell'agente vada in modo
-- LIBERA; la terza è che ogni scrittura dell'agente dica quale agente, quale capacità e versione,
-- in quale giro, per conto di chi, su quale oggetto. Il diario del cancello
-- (`audit.agent_gateway_decisions`, 000452) diceva già chi, quando, con quale strumento, su quale
-- concetto e operazione e con quale esito; la capacità e la versione stavano solo dentro il testo
-- di `reason` (`WRITE_CAPABILITY_LIBERA <codice>@<versione>`), cioè non si potevano contare. E
-- l'esito era `allow` sia per la scrittura approvata da una persona sia per quella eseguita da
-- sola: la differenza che conta di più per ADR-0053 non era una colonna.
--
-- CHE COSA AGGIUNGE, alla stessa tabella e senza toccare le righe che ci sono:
--   · `outcome`: `allow-read`, `allow-write` (approvata da una persona), `allow-write-autonomous`
--     (eseguita da una capacità LIBERA, senza ponte), `deny`. È l'esito nuovo che A2 chiede
--     accanto a `allow-write`. Le righe di prima restano NULL: non si inventa un passato;
--   · `action_class`: la classe dell'azione (ADR-0056 D2), A, B o C;
--   · `capability_code`, `capability_version`: la capacità che ha liberato la scrittura;
--   · `on_behalf_of`: per conto di chi (ADR-0050 D6). È l'identificativo opaco della persona che
--     ha avviato il giro, lo stesso valore di `principal_subject`, mai un nome (stessa dottrina
--     del diario: nessun dato personale in chiaro). Il giro è `conversation_id`, che c'è già.
--
-- IL 100% NON È UNA SPERANZA. Un vincolo pretende capacità, versione e «per conto di» su ogni
-- riga `allow-write-autonomous`: una scrittura autonoma senza attribuzione non entra nel diario,
-- e il cancello (`apps/agent-gateway/src/write-gate.ts`) non la esegue senza una persona da
-- nominare. La sentinella `sys.v_agente_scritture_senza_per_conto_di` guarda anche le scritture
-- approvate da una persona: deve restare a zero.
--
-- L'OGGETTO E IL VALORE PRIMA E DOPO. L'oggetto sta in `concept`, `operation` e `args_hash`
-- (l'impronta degli argomenti, cioè del valore chiesto, mai il valore in chiaro). Il valore di
-- prima non entra nel diario: vive nel giornale di ritorno della capacità
-- (`sys.sys_agent_capabilities.agent_capability_undo_ref`, 000480), che è la sola sede in cui si
-- può anche rimettere a posto, e la riga del diario lo raggiunge per capacità e giro. Copiarlo
-- qui porterebbe dati del cliente in un registro che per dottrina non ne contiene.
--
-- LE DUE METÀ DEL REGISTRO. `audit.registro_scritture` (000477) tiene, dal lato dell'API, ogni
-- scrittura su /v1/* con la persona per conto di cui l'agente agisce e l'esito HTTP: dice che cosa
-- è successo. Questo diario tiene, dal lato del cancello, la decisione: se una persona l'ha
-- approvata o se l'ha liberata una capacità, quale e in quale versione. Si incontrano sulla
-- persona e sull'orario; nessuna delle due copia l'altra.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS; vincoli in forma DROP/ADD;
-- CREATE OR REPLACE VIEW. ROLLBACK DICHIARATO: nessun giornale `staging.*_undo`, la migrazione
-- aggiunge e non trasforma righe. L'inversa:
--   DROP VIEW sys.v_agente_scritture_senza_per_conto_di;
--   ALTER TABLE audit.agent_gateway_decisions DROP CONSTRAINT agd_autonoma_attribuita,
--     DROP COLUMN on_behalf_of, DROP COLUMN capability_version, DROP COLUMN capability_code,
--     DROP COLUMN action_class, DROP COLUMN outcome;
--
-- CENSIMENTO (chi_sorveglia.py agent_gateway_decisions, prima di scrivere): nessun cancello,
-- nessuno scrittore fuori dal gateway; test in apps/agent-gateway/test/audit-sink.test.ts e
-- diario-nel-database.integration.test.ts; vista sys.v_agente_persone_per_conversazione (000452),
-- che legge colonne che qui non cambiano.

BEGIN;

ALTER TABLE audit.agent_gateway_decisions
  ADD COLUMN IF NOT EXISTS outcome            varchar(30),
  ADD COLUMN IF NOT EXISTS action_class       varchar(1),
  ADD COLUMN IF NOT EXISTS capability_code    varchar(80),
  ADD COLUMN IF NOT EXISTS capability_version integer,
  ADD COLUMN IF NOT EXISTS on_behalf_of       text;

-- I vincoli in forma DROP/ADD, come in 000477: la catena si riapplica a ogni deploy, e così una
-- definizione corretta qui raggiunge anche un database dove il vincolo c'era già.
ALTER TABLE audit.agent_gateway_decisions DROP CONSTRAINT IF EXISTS agd_outcome_ck;
ALTER TABLE audit.agent_gateway_decisions ADD CONSTRAINT agd_outcome_ck CHECK (
  outcome IS NULL
  OR outcome IN ('allow-read', 'allow-write', 'allow-write-autonomous', 'deny'));
ALTER TABLE audit.agent_gateway_decisions DROP CONSTRAINT IF EXISTS agd_action_class_ck;
ALTER TABLE audit.agent_gateway_decisions ADD CONSTRAINT agd_action_class_ck CHECK (
  action_class IS NULL OR action_class IN ('A', 'B', 'C'));
ALTER TABLE audit.agent_gateway_decisions DROP CONSTRAINT IF EXISTS agd_autonoma_attribuita;
ALTER TABLE audit.agent_gateway_decisions ADD CONSTRAINT agd_autonoma_attribuita CHECK (
  outcome IS DISTINCT FROM 'allow-write-autonomous'
  OR (capability_code IS NOT NULL
      AND capability_version IS NOT NULL
      AND on_behalf_of IS NOT NULL AND on_behalf_of <> ''
      AND conversation_id IS NOT NULL
      AND action_class = 'B'));

COMMENT ON COLUMN audit.agent_gateway_decisions.outcome IS
  'ADR-0053 A2 (000482): allow-read, allow-write (approvata da una persona), allow-write-autonomous (capacità LIBERA, senza ponte), deny. NULL sulle righe scritte prima della 000482.';
COMMENT ON COLUMN audit.agent_gateway_decisions.on_behalf_of IS
  'ADR-0053 A2, ADR-0050 D6 (000482): per conto di chi, identificativo opaco della persona che ha avviato il giro. Mai un nome.';

CREATE INDEX IF NOT EXISTS idx_agent_gateway_decisions_capability
  ON audit.agent_gateway_decisions (capability_code, capability_version)
  WHERE capability_code IS NOT NULL;

-- La sentinella: una scrittura dell'agente, approvata o autonoma, che non dice per conto di chi.
-- Zero righe è l'atteso, e resta tale (ADR-0053 D2: la quota attribuita è il 100%).
CREATE OR REPLACE VIEW sys.v_agente_scritture_senza_per_conto_di AS
SELECT decision_id, conversation_id, ts, tenant, tool, outcome, capability_code, capability_version
  FROM audit.agent_gateway_decisions
 WHERE outcome IN ('allow-write', 'allow-write-autonomous')
   AND (on_behalf_of IS NULL OR on_behalf_of = '');

COMMENT ON VIEW sys.v_agente_scritture_senza_per_conto_di IS
  'ADR-0053 A2 (000482) — SENTINELLA, deve restare a zero: scritture dell''agente senza «per conto di». Una riga qui spegne la capacità (ADR-0053 D2).';

-- Guardia: colonne, vincolo e vista ci sono; la sentinella nasce a zero.
DO $$
DECLARE
  n_col integer;
  n_ck  integer;
  n     integer;
BEGIN
  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema = 'audit' AND table_name = 'agent_gateway_decisions'
     AND column_name IN ('outcome', 'action_class', 'capability_code', 'capability_version', 'on_behalf_of');
  IF n_col <> 5 THEN RAISE EXCEPTION '000482: attese 5 colonne nuove, trovate %', n_col; END IF;
  SELECT count(*) INTO n_ck FROM pg_constraint
   WHERE conname IN ('agd_outcome_ck', 'agd_action_class_ck', 'agd_autonoma_attribuita');
  IF n_ck <> 3 THEN RAISE EXCEPTION '000482: attesi 3 vincoli, trovati %', n_ck; END IF;
  SELECT count(*) INTO n FROM sys.v_agente_scritture_senza_per_conto_di;
  IF n <> 0 THEN RAISE EXCEPTION '000482: % scritture senza «per conto di» alla nascita', n; END IF;
  RAISE NOTICE '000482 ok: registro «per conto di» pronto, sentinella a zero';
END $$;

COMMIT;
