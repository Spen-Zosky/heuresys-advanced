-- ============================================================================================
-- 000515 — Il motore degli scenari what-if: scenario, versioni, opzioni, leve, ipotesi,
--          risultati, fonti, controlli di equità e la STRUTTURA OMBRA del tenant.
--          (voce F3a del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md, ADR-0063 D5, D6)
--
-- IL FATTO. ADR-0063 D5 decide che uno scenario è un oggetto con ipotesi, leve, opzioni e
-- risultati, calcolato su una struttura ombra del tenant e MAI sulle tabelle vere; i numeri li
-- calcola il codice, il modello sceglie le leve, confronta almeno due opzioni, spiega e cita.
-- D6 vuole il controllo di equità dichiarato su ogni proposta che riguarda persone e le fonti
-- cliccabili su ogni risultato. Fino a qui non esisteva nessun posto dove scriverlo.
--
-- CHE COSA CREA. Solo aggiunte, nessun oggetto esistente toccato. Nota di progetto con il
-- disegno completo: docs/piani/ai-driven_20261126/F3a_motore_degli_scenari.md.
--   · `sys_scenarios`: la domanda, la famiglia di calcolo, il dominio, la voce del catalogo
--     (S-T1…S-X2), la persona per cui si lavora e l'origine (persona, assistente, segnalatore).
--   · `sys_scenario_versions`: ogni ricalcolo è una versione nuova; una versione CALCOLATA è
--     congelata (D5: un numero si rifà, non si corregge). Porta la data e l'impronta SHA-256
--     della fotografia del tenant da cui parte.
--   · `sys_scenario_options`: almeno due per versione (una può essere «nessuna azione»), con
--     `option_touches_people` e `option_recommended`: un'opzione che tocca persone diventa
--     raccomandazione solo con i controlli di equità tutti SUPERATI (E12, D6).
--   · `sys_scenario_levers`: le leve di un'opzione (chi esce, quale unità si fonde, quale budget
--     cambia), con il bersaglio e i parametri; elenco chiuso di leve (RD-08) che F3b allarga
--     emendando QUESTO file (ADR-0035).
--   · `sys_scenario_assumptions`: le ipotesi della versione o di un'opzione (dato, stima,
--     vincolo, politica), con l'incertezza dichiarata quando è una stima.
--   · `sys_scenario_results`: i numeri, sempre con il calcolatore e la sua versione
--     (`calcolatore@x.y.z`): un numero senza calcolatore non entra (D5). Banda di incertezza e
--     numero di estrazioni per le proiezioni nel tempo.
--   · `sys_scenario_sources`: le fonti cliccabili (E13) di un'ipotesi o di un risultato: dato,
--     pagina, regola, documento, modello di settore del datastore, storia.
--   · `sys_scenario_equity_checks`: il controllo di equità dichiarato (E12): tratto, gruppi
--     confrontati, rapporto misurato, soglia, esito.
--   · `sys_scenario_shadow_units`, `sys_scenario_shadow_positions`,
--     `sys_scenario_shadow_assignments`: la STRUTTURA OMBRA. Con `*_option_id` vuoto è la
--     fotografia di partenza della versione (copia logica delle unità, delle posizioni e delle
--     assegnazioni attive del tenant); con l'opzione valorizzata è lo stato dopo le leve,
--     scritto dal calcolatore per il confronto prima/dopo. Il calcolo lavora qui: le tabelle
--     vere si leggono soltanto.
--   · `sys.sys_scenario_fotografa(version_id)`: la fotografia. LEGGE le tre tabelle vere e
--     scrive solo nelle tabelle ombra della versione; rifiuta una versione non in BOZZA o già
--     fotografata.
--
-- LE GUARDIE NEL DATABASE (non solo nel codice):
--   G1 una versione non in BOZZA non accetta modifiche a opzioni, leve, ipotesi, risultati,
--      fonti, equità e ombra; la versione stessa, una volta CALCOLATA, può solo passare ad
--      ARCHIVIATA. La cancellazione a cascata dello scenario resta possibile, e quando una riga
--      vera sparisce (unità, posizione, persona) l'ombra perde solo il riferimento: le tabelle
--      vere non restano mai bloccate da uno scenario.
--   G2 il passaggio a CALCOLATA pretende: almeno due opzioni, al più una «nessuna azione»;
--      ogni opzione con almeno un risultato; ogni risultato con almeno una fonte; la fotografia
--      fatta; ogni opzione che tocca persone con almeno un controllo di equità.
--   G3 un'opzione che tocca persone è raccomandata solo con controlli di equità tutti SUPERATI;
--      un controllo nuovo non superato su un'opzione già raccomandata è rifiutato.
--   G4 ogni riga figlia porta il tenant della sua versione (I5: FK più coerenza, mai RLS).
--
-- I DATI. Le tabelle nascono vuote e restano vuote finché una persona (o l'assistente per lei)
-- non apre uno scenario: uno scenario inventato sarebbe un dato finto. Ragione scritta
-- nell'elenco di storia36 (db/scripts/audit-storia36-empty-tables.txt).
-- CLASSIFICAZIONE E REGISTRO: tabelle classificate in 000429 e registrate in 000062, file di
--   numero minore, emendati come per la 000503.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, funzioni CREATE OR REPLACE, trigger
--   DROP IF EXISTS / CREATE.
-- ROLLBACK DICHIARATO (solo su tabelle vuote o con il loro contenuto, elenco esplicito):
--   DROP FUNCTION sys.sys_scenario_fotografa(uuid);
--   DROP TABLE sys.sys_scenario_shadow_assignments, sys.sys_scenario_shadow_positions,
--     sys.sys_scenario_shadow_units, sys.sys_scenario_equity_checks, sys.sys_scenario_sources,
--     sys.sys_scenario_results, sys.sys_scenario_assumptions, sys.sys_scenario_levers,
--     sys.sys_scenario_options, sys.sys_scenario_versions, sys.sys_scenarios;
--   DROP FUNCTION sys.sys_scenario_guardia_congelata(), sys.sys_scenario_guardia_versione(),
--     sys.sys_scenario_guardia_equita_opzione(), sys.sys_scenario_guardia_equita_controllo(),
--     sys.sys_scenario_guardia_tenant();
--   e le righe in 000429, 000062 e db/scripts/audit-storia36-empty-tables.txt.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── 1. Lo scenario ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenarios (
  scenario_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_tenant_id          uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_title              varchar(255) NOT NULL,
  scenario_question           text NOT NULL,
  scenario_family             varchar(24) NOT NULL,
  scenario_domain             varchar(24) NOT NULL,
  scenario_catalog_code       varchar(8),
  scenario_status             varchar(16) NOT NULL DEFAULT 'APERTO',
  scenario_origin             varchar(16) NOT NULL DEFAULT 'PERSONA',
  scenario_agent_ref          varchar(128),
  scenario_owner_user_id      uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_family_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_family_check
  CHECK (scenario_family IN ('EFFETTO_DIRETTO', 'CASCATA', 'NEL_TEMPO', 'SOTTO_VINCOLI', 'COMBINATO'));
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_domain_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_domain_check
  CHECK (scenario_domain IN ('TALENTI', 'COMPETENZE', 'KPI', 'SELEZIONE', 'ORGANIZZAZIONE',
                             'CAMBIAMENTO', 'PROCESSI', 'PERSONE', 'COMBINATO'));
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_catalog_code_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_catalog_code_check
  CHECK (scenario_catalog_code IS NULL OR scenario_catalog_code ~ '^S-[A-Z][0-9]{1,2}$');
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_status_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_status_check
  CHECK (scenario_status IN ('APERTO', 'CHIUSO'));
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_origin_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_origin_check
  CHECK (scenario_origin IN ('PERSONA', 'ASSISTENTE', 'SEGNALATORE'));
-- chi non è la persona dichiara quale agente ha aperto lo scenario (anagrafe degli agenti)
ALTER TABLE sys.sys_scenarios DROP CONSTRAINT IF EXISTS sys_scenarios_agent_ref_check;
ALTER TABLE sys.sys_scenarios ADD CONSTRAINT sys_scenarios_agent_ref_check
  CHECK (scenario_origin = 'PERSONA' OR scenario_agent_ref IS NOT NULL);
CREATE INDEX IF NOT EXISTS sys_scenarios_tenant_idx ON sys.sys_scenarios (scenario_tenant_id, scenario_status);
CREATE INDEX IF NOT EXISTS sys_scenarios_owner_idx ON sys.sys_scenarios (scenario_owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenarios_tenant_pair_uq ON sys.sys_scenarios (scenario_id, scenario_tenant_id);
DROP TRIGGER IF EXISTS sys_scenarios_set_updated_at ON sys.sys_scenarios;
CREATE TRIGGER sys_scenarios_set_updated_at BEFORE UPDATE ON sys.sys_scenarios
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
COMMENT ON TABLE sys.sys_scenarios IS
  'Scenari what-if (ADR-0063 D5, 000515): la domanda, la famiglia di calcolo, il dominio e la persona per cui si lavora. Si calcolano sulla struttura ombra, mai sulle tabelle vere.';

-- ── 2. Le versioni ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_versions (
  scenario_version_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_version_scenario_id      uuid NOT NULL,
  scenario_version_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_version_number           integer NOT NULL,
  scenario_version_status           varchar(16) NOT NULL DEFAULT 'BOZZA',
  scenario_version_notes            text,
  scenario_version_baseline_at      timestamptz,
  scenario_version_baseline_digest  char(64),
  scenario_version_computed_at      timestamptz,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  created_by                        uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_versions_scenario_fk
    FOREIGN KEY (scenario_version_scenario_id, scenario_version_tenant_id)
    REFERENCES sys.sys_scenarios (scenario_id, scenario_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_versions DROP CONSTRAINT IF EXISTS sys_scenario_versions_status_check;
ALTER TABLE sys.sys_scenario_versions ADD CONSTRAINT sys_scenario_versions_status_check
  CHECK (scenario_version_status IN ('BOZZA', 'CALCOLATA', 'ARCHIVIATA'));
ALTER TABLE sys.sys_scenario_versions DROP CONSTRAINT IF EXISTS sys_scenario_versions_number_check;
ALTER TABLE sys.sys_scenario_versions ADD CONSTRAINT sys_scenario_versions_number_check
  CHECK (scenario_version_number >= 1);
ALTER TABLE sys.sys_scenario_versions DROP CONSTRAINT IF EXISTS sys_scenario_versions_baseline_check;
ALTER TABLE sys.sys_scenario_versions ADD CONSTRAINT sys_scenario_versions_baseline_check
  CHECK ((scenario_version_baseline_at IS NULL) = (scenario_version_baseline_digest IS NULL)
         AND (scenario_version_baseline_digest IS NULL OR scenario_version_baseline_digest ~ '^[0-9a-f]{64}$'));
ALTER TABLE sys.sys_scenario_versions DROP CONSTRAINT IF EXISTS sys_scenario_versions_computed_check;
ALTER TABLE sys.sys_scenario_versions ADD CONSTRAINT sys_scenario_versions_computed_check
  CHECK ((scenario_version_status = 'BOZZA') = (scenario_version_computed_at IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_versions_number_uq
  ON sys.sys_scenario_versions (scenario_version_scenario_id, scenario_version_number);
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_versions_tenant_pair_uq
  ON sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id);
CREATE INDEX IF NOT EXISTS sys_scenario_versions_tenant_idx ON sys.sys_scenario_versions (scenario_version_tenant_id);
DROP TRIGGER IF EXISTS sys_scenario_versions_set_updated_at ON sys.sys_scenario_versions;
CREATE TRIGGER sys_scenario_versions_set_updated_at BEFORE UPDATE ON sys.sys_scenario_versions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
COMMENT ON TABLE sys.sys_scenario_versions IS
  'Versioni di uno scenario (000515): BOZZA si modifica, CALCOLATA è congelata e può solo diventare ARCHIVIATA; porta data e impronta SHA-256 della fotografia del tenant.';

-- ── 3. Le opzioni ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_options (
  scenario_option_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_option_version_id      uuid NOT NULL,
  scenario_option_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_option_code            varchar(8) NOT NULL,
  scenario_option_label           varchar(255) NOT NULL,
  scenario_option_description     text,
  scenario_option_is_baseline     boolean NOT NULL DEFAULT false,
  scenario_option_touches_people  boolean NOT NULL DEFAULT false,
  scenario_option_recommended     boolean NOT NULL DEFAULT false,
  scenario_option_ordinal         integer NOT NULL DEFAULT 1,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_options_version_fk
    FOREIGN KEY (scenario_option_version_id, scenario_option_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_options DROP CONSTRAINT IF EXISTS sys_scenario_options_code_check;
ALTER TABLE sys.sys_scenario_options ADD CONSTRAINT sys_scenario_options_code_check
  CHECK (scenario_option_code ~ '^[A-Z][0-9]?$');
-- «nessuna azione» non tocca persone e non si raccomanda come intervento
ALTER TABLE sys.sys_scenario_options DROP CONSTRAINT IF EXISTS sys_scenario_options_baseline_check;
ALTER TABLE sys.sys_scenario_options ADD CONSTRAINT sys_scenario_options_baseline_check
  CHECK (NOT scenario_option_is_baseline OR NOT scenario_option_touches_people);
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_options_code_uq
  ON sys.sys_scenario_options (scenario_option_version_id, scenario_option_code);
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_options_one_baseline_uq
  ON sys.sys_scenario_options (scenario_option_version_id) WHERE scenario_option_is_baseline;
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_options_tenant_pair_uq
  ON sys.sys_scenario_options (scenario_option_id, scenario_option_tenant_id);
CREATE INDEX IF NOT EXISTS sys_scenario_options_tenant_idx ON sys.sys_scenario_options (scenario_option_tenant_id);
DROP TRIGGER IF EXISTS sys_scenario_options_set_updated_at ON sys.sys_scenario_options;
CREATE TRIGGER sys_scenario_options_set_updated_at BEFORE UPDATE ON sys.sys_scenario_options
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
COMMENT ON TABLE sys.sys_scenario_options IS
  'Opzioni di una versione di scenario (000515): almeno due al calcolo, al più una «nessuna azione»; chi tocca persone è raccomandata solo con l''equità superata (E12).';

-- ── 4. Le leve ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_levers (
  scenario_lever_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_lever_option_id      uuid NOT NULL,
  scenario_lever_tenant_id      uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_lever_kind           varchar(40) NOT NULL,
  scenario_lever_target_type    varchar(16) NOT NULL,
  scenario_lever_target_id      uuid,
  scenario_lever_parameters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  scenario_lever_ordinal        integer NOT NULL DEFAULT 1,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_levers_option_fk
    FOREIGN KEY (scenario_lever_option_id, scenario_lever_tenant_id)
    REFERENCES sys.sys_scenario_options (scenario_option_id, scenario_option_tenant_id) ON DELETE CASCADE
);
-- Elenco chiuso (RD-08), specchio di SCENARIO_LEVER_KIND_VALUES in packages/shared/src/schemas/scenari.ts.
-- Una leva nuova emenda QUESTO elenco e lo schema condiviso insieme (ADR-0035).
ALTER TABLE sys.sys_scenario_levers DROP CONSTRAINT IF EXISTS sys_scenario_levers_kind_check;
ALTER TABLE sys.sys_scenario_levers ADD CONSTRAINT sys_scenario_levers_kind_check
  CHECK (scenario_lever_kind IN (
    'PERSONA_ESCE', 'PERSONA_SI_SPOSTA', 'TASSO_DI_USCITA',
    'POSIZIONE_APRE', 'POSIZIONE_CHIUDE', 'POSIZIONE_CAMBIA_RIPORTO',
    'UNITA_FONDE', 'UNITA_DIVIDE', 'UNITA_SPOSTA',
    'COPERTURA_INTERNA', 'COPERTURA_ESTERNA',
    'BUDGET_FORMAZIONE', 'INIZIATIVA_FORMATIVA',
    'BUDGET_MERITO', 'PESO_KPI', 'OBIETTIVO_CAMBIA',
    'ATTIVITA_TOGLIE', 'ATTIVITA_UNISCE', 'ATTIVITA_AUTOMATIZZA',
    'VINCOLO_COSTO', 'VINCOLO_AMPIEZZA_CONTROLLO', 'VINCOLO_TEMPO'));
ALTER TABLE sys.sys_scenario_levers DROP CONSTRAINT IF EXISTS sys_scenario_levers_target_type_check;
ALTER TABLE sys.sys_scenario_levers ADD CONSTRAINT sys_scenario_levers_target_type_check
  CHECK (scenario_lever_target_type IN ('PERSONA', 'POSIZIONE', 'UNITA', 'PROCESSO', 'ATTIVITA',
                                        'COMPETENZA', 'KPI', 'OBIETTIVO', 'TENANT'));
ALTER TABLE sys.sys_scenario_levers DROP CONSTRAINT IF EXISTS sys_scenario_levers_target_check;
ALTER TABLE sys.sys_scenario_levers ADD CONSTRAINT sys_scenario_levers_target_check
  CHECK ((scenario_lever_target_type = 'TENANT') = (scenario_lever_target_id IS NULL));
ALTER TABLE sys.sys_scenario_levers DROP CONSTRAINT IF EXISTS sys_scenario_levers_parameters_check;
ALTER TABLE sys.sys_scenario_levers ADD CONSTRAINT sys_scenario_levers_parameters_check
  CHECK (jsonb_typeof(scenario_lever_parameters) = 'object');
CREATE INDEX IF NOT EXISTS sys_scenario_levers_option_idx ON sys.sys_scenario_levers (scenario_lever_option_id);
CREATE INDEX IF NOT EXISTS sys_scenario_levers_tenant_idx ON sys.sys_scenario_levers (scenario_lever_tenant_id);
COMMENT ON TABLE sys.sys_scenario_levers IS
  'Leve di un''opzione di scenario (000515): che cosa si muove, su quale bersaglio, con quali parametri. Elenco chiuso, specchio dello schema condiviso scenari.ts.';

-- ── 5. Le ipotesi ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_assumptions (
  scenario_assumption_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_assumption_version_id  uuid NOT NULL,
  scenario_assumption_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_assumption_option_id   uuid REFERENCES sys.sys_scenario_options(scenario_option_id) ON DELETE CASCADE,
  scenario_assumption_kind        varchar(16) NOT NULL,
  scenario_assumption_statement   text NOT NULL,
  scenario_assumption_value       numeric,
  scenario_assumption_unit        varchar(32),
  scenario_assumption_low         numeric,
  scenario_assumption_high        numeric,
  scenario_assumption_ordinal     integer NOT NULL DEFAULT 1,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_assumptions_version_fk
    FOREIGN KEY (scenario_assumption_version_id, scenario_assumption_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_assumptions DROP CONSTRAINT IF EXISTS sys_scenario_assumptions_kind_check;
ALTER TABLE sys.sys_scenario_assumptions ADD CONSTRAINT sys_scenario_assumptions_kind_check
  CHECK (scenario_assumption_kind IN ('DATO', 'STIMA', 'VINCOLO', 'POLITICA'));
-- una stima dichiara la sua incertezza (D5: incertezza dichiarata)
ALTER TABLE sys.sys_scenario_assumptions DROP CONSTRAINT IF EXISTS sys_scenario_assumptions_band_check;
ALTER TABLE sys.sys_scenario_assumptions ADD CONSTRAINT sys_scenario_assumptions_band_check
  CHECK ((scenario_assumption_kind <> 'STIMA'
          OR (scenario_assumption_low IS NOT NULL AND scenario_assumption_high IS NOT NULL))
     AND (scenario_assumption_low IS NULL OR scenario_assumption_high IS NULL
          OR scenario_assumption_low <= scenario_assumption_high));
CREATE INDEX IF NOT EXISTS sys_scenario_assumptions_version_idx ON sys.sys_scenario_assumptions (scenario_assumption_version_id);
CREATE INDEX IF NOT EXISTS sys_scenario_assumptions_option_idx ON sys.sys_scenario_assumptions (scenario_assumption_option_id);
CREATE INDEX IF NOT EXISTS sys_scenario_assumptions_tenant_idx ON sys.sys_scenario_assumptions (scenario_assumption_tenant_id);
COMMENT ON TABLE sys.sys_scenario_assumptions IS
  'Ipotesi di una versione o di un''opzione di scenario (000515): dato, stima con la sua banda, vincolo, politica.';

-- ── 6. I risultati ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_results (
  scenario_result_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_result_option_id       uuid NOT NULL,
  scenario_result_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_result_metric_code     varchar(64) NOT NULL,
  scenario_result_metric_label    varchar(255) NOT NULL,
  scenario_result_value           numeric NOT NULL,
  scenario_result_unit            varchar(32) NOT NULL,
  scenario_result_low             numeric,
  scenario_result_high            numeric,
  scenario_result_draws           integer,
  scenario_result_horizon_months  integer,
  scenario_result_computed_by     varchar(96) NOT NULL,
  scenario_result_computed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_results_option_fk
    FOREIGN KEY (scenario_result_option_id, scenario_result_tenant_id)
    REFERENCES sys.sys_scenario_options (scenario_option_id, scenario_option_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_results DROP CONSTRAINT IF EXISTS sys_scenario_results_metric_check;
ALTER TABLE sys.sys_scenario_results ADD CONSTRAINT sys_scenario_results_metric_check
  CHECK (scenario_result_metric_code ~ '^[a-z][a-z0-9_]*$');
-- il numero lo calcola il codice: calcolatore e versione, mai il modello (D5)
ALTER TABLE sys.sys_scenario_results DROP CONSTRAINT IF EXISTS sys_scenario_results_computed_by_check;
ALTER TABLE sys.sys_scenario_results ADD CONSTRAINT sys_scenario_results_computed_by_check
  CHECK (scenario_result_computed_by ~ '^[a-z][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$');
ALTER TABLE sys.sys_scenario_results DROP CONSTRAINT IF EXISTS sys_scenario_results_band_check;
ALTER TABLE sys.sys_scenario_results ADD CONSTRAINT sys_scenario_results_band_check
  CHECK ((scenario_result_low IS NULL) = (scenario_result_high IS NULL)
     AND (scenario_result_low IS NULL
          OR (scenario_result_low <= scenario_result_value AND scenario_result_value <= scenario_result_high)));
ALTER TABLE sys.sys_scenario_results DROP CONSTRAINT IF EXISTS sys_scenario_results_draws_check;
ALTER TABLE sys.sys_scenario_results ADD CONSTRAINT sys_scenario_results_draws_check
  CHECK ((scenario_result_draws IS NULL OR scenario_result_draws >= 1)
     AND (scenario_result_horizon_months IS NULL OR scenario_result_horizon_months BETWEEN 0 AND 120));
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_results_metric_uq
  ON sys.sys_scenario_results (scenario_result_option_id, scenario_result_metric_code,
                               COALESCE(scenario_result_horizon_months, -1));
CREATE INDEX IF NOT EXISTS sys_scenario_results_tenant_idx ON sys.sys_scenario_results (scenario_result_tenant_id);
COMMENT ON TABLE sys.sys_scenario_results IS
  'Risultati di un''opzione di scenario (000515): il numero, la banda di incertezza, l''orizzonte e il calcolatore che l''ha prodotto (calcolatore@x.y.z).';

-- ── 7. Le fonti cliccabili (E13) ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_sources (
  scenario_source_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_source_version_id      uuid NOT NULL,
  scenario_source_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_source_assumption_id   uuid REFERENCES sys.sys_scenario_assumptions(scenario_assumption_id) ON DELETE CASCADE,
  scenario_source_result_id       uuid REFERENCES sys.sys_scenario_results(scenario_result_id) ON DELETE CASCADE,
  scenario_source_kind            varchar(16) NOT NULL,
  scenario_source_ref             text NOT NULL,
  scenario_source_label           varchar(255) NOT NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_sources_version_fk
    FOREIGN KEY (scenario_source_version_id, scenario_source_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_sources DROP CONSTRAINT IF EXISTS sys_scenario_sources_kind_check;
ALTER TABLE sys.sys_scenario_sources ADD CONSTRAINT sys_scenario_sources_kind_check
  CHECK (scenario_source_kind IN ('DATO', 'PAGINA', 'REGOLA', 'DOCUMENTO', 'DATASTORE', 'STORIA'));
ALTER TABLE sys.sys_scenario_sources DROP CONSTRAINT IF EXISTS sys_scenario_sources_owner_check;
ALTER TABLE sys.sys_scenario_sources ADD CONSTRAINT sys_scenario_sources_owner_check
  CHECK ((scenario_source_assumption_id IS NULL) <> (scenario_source_result_id IS NULL));
-- cliccabile: una rotta dell'API o una pagina (/…), un documento del repo (doc:), un ADR (adr:),
-- una voce del datastore (datastore:)
ALTER TABLE sys.sys_scenario_sources DROP CONSTRAINT IF EXISTS sys_scenario_sources_ref_check;
ALTER TABLE sys.sys_scenario_sources ADD CONSTRAINT sys_scenario_sources_ref_check
  CHECK (scenario_source_ref ~ '^(/[^\s]*|doc:[^\s]+|adr:[0-9]{4}|datastore:[^\s]+)$');
CREATE INDEX IF NOT EXISTS sys_scenario_sources_version_idx ON sys.sys_scenario_sources (scenario_source_version_id);
CREATE INDEX IF NOT EXISTS sys_scenario_sources_result_idx ON sys.sys_scenario_sources (scenario_source_result_id);
CREATE INDEX IF NOT EXISTS sys_scenario_sources_assumption_idx ON sys.sys_scenario_sources (scenario_source_assumption_id);
CREATE INDEX IF NOT EXISTS sys_scenario_sources_tenant_idx ON sys.sys_scenario_sources (scenario_source_tenant_id);
COMMENT ON TABLE sys.sys_scenario_sources IS
  'Fonti cliccabili di un''ipotesi o di un risultato di scenario (E13, 000515): rotta o pagina, documento, ADR, voce del datastore.';

-- ── 8. Il controllo di equità dichiarato (E12) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_scenario_equity_checks (
  scenario_equity_check_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_equity_check_option_id uuid NOT NULL,
  scenario_equity_check_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  scenario_equity_check_trait     varchar(24) NOT NULL,
  scenario_equity_check_groups    text NOT NULL,
  scenario_equity_check_ratio     numeric,
  scenario_equity_check_threshold numeric NOT NULL,
  scenario_equity_check_outcome   varchar(24) NOT NULL,
  scenario_equity_check_method    varchar(96) NOT NULL,
  scenario_equity_check_computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_scenario_equity_checks_option_fk
    FOREIGN KEY (scenario_equity_check_option_id, scenario_equity_check_tenant_id)
    REFERENCES sys.sys_scenario_options (scenario_option_id, scenario_option_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_equity_checks DROP CONSTRAINT IF EXISTS sys_scenario_equity_checks_trait_check;
ALTER TABLE sys.sys_scenario_equity_checks ADD CONSTRAINT sys_scenario_equity_checks_trait_check
  CHECK (scenario_equity_check_trait IN ('GENERE', 'ETA', 'DISABILITA', 'NAZIONALITA', 'ALTRO'));
ALTER TABLE sys.sys_scenario_equity_checks DROP CONSTRAINT IF EXISTS sys_scenario_equity_checks_outcome_check;
ALTER TABLE sys.sys_scenario_equity_checks ADD CONSTRAINT sys_scenario_equity_checks_outcome_check
  CHECK (scenario_equity_check_outcome IN ('SUPERATO', 'NON_SUPERATO', 'DATI_INSUFFICIENTI'));
-- un esito misurato porta il rapporto; «dati insufficienti» lo dichiara senza inventarlo
ALTER TABLE sys.sys_scenario_equity_checks DROP CONSTRAINT IF EXISTS sys_scenario_equity_checks_ratio_check;
ALTER TABLE sys.sys_scenario_equity_checks ADD CONSTRAINT sys_scenario_equity_checks_ratio_check
  CHECK ((scenario_equity_check_outcome = 'DATI_INSUFFICIENTI') = (scenario_equity_check_ratio IS NULL)
     AND scenario_equity_check_threshold > 0 AND scenario_equity_check_threshold <= 1
     AND (scenario_equity_check_ratio IS NULL OR scenario_equity_check_ratio >= 0));
ALTER TABLE sys.sys_scenario_equity_checks DROP CONSTRAINT IF EXISTS sys_scenario_equity_checks_method_check;
ALTER TABLE sys.sys_scenario_equity_checks ADD CONSTRAINT sys_scenario_equity_checks_method_check
  CHECK (scenario_equity_check_method ~ '^[a-z][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$');
CREATE UNIQUE INDEX IF NOT EXISTS sys_scenario_equity_checks_trait_uq
  ON sys.sys_scenario_equity_checks (scenario_equity_check_option_id, scenario_equity_check_trait);
CREATE INDEX IF NOT EXISTS sys_scenario_equity_checks_tenant_idx ON sys.sys_scenario_equity_checks (scenario_equity_check_tenant_id);
COMMENT ON TABLE sys.sys_scenario_equity_checks IS
  'Controllo di equità dichiarato di un''opzione che tocca persone (E12, ADR-0063 D6, 000515): tratto, gruppi, rapporto, soglia, esito, metodo.';

-- ── 9. La struttura ombra ───────────────────────────────────────────────────────────────────
-- option_id vuoto = fotografia di partenza della versione; option_id valorizzato = stato dopo le
-- leve di quell'opzione, scritto dal calcolatore. source_* = la riga vera da cui viene (vuota se
-- l'ombra la crea un'opzione, per esempio un'unità nata da una fusione).
CREATE TABLE IF NOT EXISTS sys.sys_scenario_shadow_units (
  shadow_unit_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_unit_version_id      uuid NOT NULL,
  shadow_unit_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  shadow_unit_option_id       uuid REFERENCES sys.sys_scenario_options(scenario_option_id) ON DELETE CASCADE,
  shadow_unit_source_id       uuid REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  shadow_unit_parent_id       uuid REFERENCES sys.sys_scenario_shadow_units(shadow_unit_id) ON DELETE CASCADE,
  shadow_unit_code            varchar(128) NOT NULL,
  shadow_unit_name            varchar(255) NOT NULL,
  shadow_unit_type            varchar(64),
  shadow_unit_manager_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  shadow_unit_change          varchar(16) NOT NULL DEFAULT 'INVARIATA',
  CONSTRAINT sys_scenario_shadow_units_version_fk
    FOREIGN KEY (shadow_unit_version_id, shadow_unit_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_shadow_units DROP CONSTRAINT IF EXISTS sys_scenario_shadow_units_change_check;
ALTER TABLE sys.sys_scenario_shadow_units ADD CONSTRAINT sys_scenario_shadow_units_change_check
  CHECK (shadow_unit_change IN ('INVARIATA', 'NUOVA', 'MODIFICATA', 'CHIUSA')
     AND (shadow_unit_option_id IS NOT NULL OR shadow_unit_change = 'INVARIATA'));
ALTER TABLE sys.sys_scenario_shadow_units DROP CONSTRAINT IF EXISTS sys_scenario_shadow_units_not_self_parent;
ALTER TABLE sys.sys_scenario_shadow_units ADD CONSTRAINT sys_scenario_shadow_units_not_self_parent
  CHECK (shadow_unit_parent_id IS NULL OR shadow_unit_parent_id <> shadow_unit_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_units_version_idx
  ON sys.sys_scenario_shadow_units (shadow_unit_version_id, shadow_unit_option_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_units_source_idx ON sys.sys_scenario_shadow_units (shadow_unit_source_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_units_parent_idx ON sys.sys_scenario_shadow_units (shadow_unit_parent_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_units_tenant_idx ON sys.sys_scenario_shadow_units (shadow_unit_tenant_id);
COMMENT ON TABLE sys.sys_scenario_shadow_units IS
  'Struttura ombra (ADR-0063 D5, 000515): unità del tenant copiate per una versione di scenario (opzione vuota) o come risultano dopo le leve di un''opzione. Le tabelle vere non si toccano.';

CREATE TABLE IF NOT EXISTS sys.sys_scenario_shadow_positions (
  shadow_position_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_position_version_id       uuid NOT NULL,
  shadow_position_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  shadow_position_option_id        uuid REFERENCES sys.sys_scenario_options(scenario_option_id) ON DELETE CASCADE,
  shadow_position_source_id        uuid REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  shadow_position_unit_id          uuid REFERENCES sys.sys_scenario_shadow_units(shadow_unit_id) ON DELETE CASCADE,
  shadow_position_reports_to_id    uuid REFERENCES sys.sys_scenario_shadow_positions(shadow_position_id) ON DELETE SET NULL,
  shadow_position_code             varchar(128) NOT NULL,
  shadow_position_title            varchar(255) NOT NULL,
  shadow_position_job_role_id      uuid REFERENCES sys.sys_job_roles(job_role_id) ON DELETE SET NULL,
  shadow_position_criticality      varchar(32),
  shadow_position_economic_weight  numeric(8,4),
  shadow_position_change           varchar(16) NOT NULL DEFAULT 'INVARIATA',
  CONSTRAINT sys_scenario_shadow_positions_version_fk
    FOREIGN KEY (shadow_position_version_id, shadow_position_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_shadow_positions DROP CONSTRAINT IF EXISTS sys_scenario_shadow_positions_change_check;
ALTER TABLE sys.sys_scenario_shadow_positions ADD CONSTRAINT sys_scenario_shadow_positions_change_check
  CHECK (shadow_position_change IN ('INVARIATA', 'NUOVA', 'MODIFICATA', 'CHIUSA')
     AND (shadow_position_option_id IS NOT NULL OR shadow_position_change = 'INVARIATA'));
ALTER TABLE sys.sys_scenario_shadow_positions DROP CONSTRAINT IF EXISTS sys_scenario_shadow_positions_not_self_report;
ALTER TABLE sys.sys_scenario_shadow_positions ADD CONSTRAINT sys_scenario_shadow_positions_not_self_report
  CHECK (shadow_position_reports_to_id IS NULL OR shadow_position_reports_to_id <> shadow_position_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_positions_version_idx
  ON sys.sys_scenario_shadow_positions (shadow_position_version_id, shadow_position_option_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_positions_source_idx ON sys.sys_scenario_shadow_positions (shadow_position_source_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_positions_unit_idx ON sys.sys_scenario_shadow_positions (shadow_position_unit_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_positions_reports_idx ON sys.sys_scenario_shadow_positions (shadow_position_reports_to_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_positions_tenant_idx ON sys.sys_scenario_shadow_positions (shadow_position_tenant_id);
COMMENT ON TABLE sys.sys_scenario_shadow_positions IS
  'Struttura ombra (000515): posizioni del tenant copiate per una versione di scenario o dopo le leve di un''opzione; I1, il modello resta centrato sulla posizione.';

CREATE TABLE IF NOT EXISTS sys.sys_scenario_shadow_assignments (
  shadow_assignment_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_assignment_version_id  uuid NOT NULL,
  shadow_assignment_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  shadow_assignment_option_id   uuid REFERENCES sys.sys_scenario_options(scenario_option_id) ON DELETE CASCADE,
  shadow_assignment_source_id   uuid REFERENCES sys.sys_user_position_assignments(user_position_assignment_id) ON DELETE SET NULL,
  shadow_assignment_position_id uuid NOT NULL REFERENCES sys.sys_scenario_shadow_positions(shadow_position_id) ON DELETE CASCADE,
  shadow_assignment_user_id     uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  shadow_assignment_kind        varchar(32) NOT NULL,
  shadow_assignment_fte         numeric(4,3) NOT NULL DEFAULT 1.000,
  shadow_assignment_change      varchar(16) NOT NULL DEFAULT 'INVARIATA',
  CONSTRAINT sys_scenario_shadow_assignments_version_fk
    FOREIGN KEY (shadow_assignment_version_id, shadow_assignment_tenant_id)
    REFERENCES sys.sys_scenario_versions (scenario_version_id, scenario_version_tenant_id) ON DELETE CASCADE
);
ALTER TABLE sys.sys_scenario_shadow_assignments DROP CONSTRAINT IF EXISTS sys_scenario_shadow_assignments_kind_check;
ALTER TABLE sys.sys_scenario_shadow_assignments ADD CONSTRAINT sys_scenario_shadow_assignments_kind_check
  CHECK (shadow_assignment_kind IN ('PRIMARY', 'SECONDARY', 'INTERIM', 'ACTING'));
ALTER TABLE sys.sys_scenario_shadow_assignments DROP CONSTRAINT IF EXISTS sys_scenario_shadow_assignments_change_check;
ALTER TABLE sys.sys_scenario_shadow_assignments ADD CONSTRAINT sys_scenario_shadow_assignments_change_check
  CHECK (shadow_assignment_change IN ('INVARIATA', 'NUOVA', 'MODIFICATA', 'CHIUSA')
     AND (shadow_assignment_option_id IS NOT NULL OR shadow_assignment_change = 'INVARIATA'));
ALTER TABLE sys.sys_scenario_shadow_assignments DROP CONSTRAINT IF EXISTS sys_scenario_shadow_assignments_fte_check;
ALTER TABLE sys.sys_scenario_shadow_assignments ADD CONSTRAINT sys_scenario_shadow_assignments_fte_check
  CHECK (shadow_assignment_fte > 0 AND shadow_assignment_fte <= 1);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_assignments_version_idx
  ON sys.sys_scenario_shadow_assignments (shadow_assignment_version_id, shadow_assignment_option_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_assignments_position_idx ON sys.sys_scenario_shadow_assignments (shadow_assignment_position_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_assignments_source_idx ON sys.sys_scenario_shadow_assignments (shadow_assignment_source_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_assignments_user_idx ON sys.sys_scenario_shadow_assignments (shadow_assignment_user_id);
CREATE INDEX IF NOT EXISTS sys_scenario_shadow_assignments_tenant_idx ON sys.sys_scenario_shadow_assignments (shadow_assignment_tenant_id);
COMMENT ON TABLE sys.sys_scenario_shadow_assignments IS
  'Struttura ombra (000515): chi è titolare di quale posizione ombra (I1: titolare distinto dal proprietario della posizione), nella fotografia o dopo le leve.';

-- ── 10. Le guardie ──────────────────────────────────────────────────────────────────────────

-- G4: le righe ombra e quelle legate a un'opzione stanno nella stessa versione e nello stesso tenant
CREATE OR REPLACE FUNCTION sys.sys_scenario_guardia_tenant() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  r jsonb := to_jsonb(NEW);
  v_version uuid := (r ->> TG_ARGV[0])::uuid;
  v_tenant  uuid := (r ->> TG_ARGV[1])::uuid;
  v_option  uuid := CASE WHEN TG_ARGV[2] <> '-' THEN (r ->> TG_ARGV[2])::uuid END;
  n int;
BEGIN
  IF v_option IS NOT NULL THEN
    SELECT count(*) INTO n FROM sys.sys_scenario_options
     WHERE scenario_option_id = v_option AND scenario_option_version_id = v_version
       AND scenario_option_tenant_id = v_tenant;
    IF n = 0 THEN
      RAISE EXCEPTION '000515 G4: %: l''opzione % non è della versione % del tenant %',
        TG_TABLE_NAME, v_option, v_version, v_tenant USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

-- G1: niente si muove in una versione non in BOZZA (la cascata di cancellazione passa)
CREATE OR REPLACE FUNCTION sys.sys_scenario_guardia_congelata() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  r jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_status varchar;
  v_version uuid;
BEGIN
  IF TG_ARGV[1] = 'versione' THEN
    v_version := (r ->> TG_ARGV[0])::uuid;
  ELSE  -- la riga porta l'opzione: la versione si legge dall'opzione
    SELECT scenario_option_version_id INTO v_version
      FROM sys.sys_scenario_options WHERE scenario_option_id = (r ->> TG_ARGV[0])::uuid;
  END IF;
  SELECT scenario_version_status INTO v_status
    FROM sys.sys_scenario_versions WHERE scenario_version_id = v_version;
  -- versione già tolta (cancellazione a cascata dello scenario): si lascia passare
  IF v_status IS NULL OR v_status = 'BOZZA' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- la riga vera da cui l'ombra viene è stata tolta (ON DELETE SET NULL su fonte, persona,
  -- ruolo): l'ombra perde il riferimento e resta com'era, e la tabella vera non resta bloccata
  IF TG_OP = 'UPDATE' AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(to_jsonb(NEW)) n
        WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key)
          AND NOT (n.value = 'null'::jsonb AND n.key ~ '(_source_id|_user_id|_job_role_id)$')) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '000515 G1: %: la versione % è %, non si modifica (si apre una versione nuova)',
    TG_TABLE_NAME, v_version, v_status USING ERRCODE = 'check_violation';
END $fn$;

-- G1 + G2 sulla versione: CALCOLATA è congelata; il passaggio a CALCOLATA pretende il necessario
CREATE OR REPLACE FUNCTION sys.sys_scenario_guardia_versione() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  n_opt int; n_base int; n_senza_ris int; n_ris_senza_fonte int; n_senza_equita int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.scenario_version_status <> 'BOZZA' THEN
      RAISE EXCEPTION '000515 G2: una versione nasce in BOZZA' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.scenario_version_status = 'ARCHIVIATA' THEN
    RAISE EXCEPTION '000515 G1: la versione % è ARCHIVIATA, non si modifica', OLD.scenario_version_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.scenario_version_status = 'CALCOLATA' THEN
    IF NEW.scenario_version_status = 'ARCHIVIATA'
       AND (to_jsonb(NEW) - 'scenario_version_status' - 'updated_at')
         = (to_jsonb(OLD) - 'scenario_version_status' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION '000515 G1: la versione % è CALCOLATA: può solo passare ad ARCHIVIATA, senza altre modifiche',
      OLD.scenario_version_id USING ERRCODE = 'check_violation';
  END IF;

  -- da qui OLD è BOZZA
  IF NEW.scenario_version_status = 'BOZZA' THEN
    RETURN NEW;
  END IF;
  IF NEW.scenario_version_status = 'ARCHIVIATA' THEN
    RETURN NEW;   -- una bozza abbandonata si archivia senza calcolo
  END IF;

  -- BOZZA -> CALCOLATA
  IF NEW.scenario_version_baseline_digest IS NULL THEN
    RAISE EXCEPTION '000515 G2: la versione % non ha la fotografia del tenant (sys_scenario_fotografa)',
      NEW.scenario_version_id USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE scenario_option_is_baseline)
    INTO n_opt, n_base
    FROM sys.sys_scenario_options WHERE scenario_option_version_id = NEW.scenario_version_id;
  IF n_opt < 2 THEN
    RAISE EXCEPTION '000515 G2: la versione % ha % opzioni, ne servono almeno due (ADR-0063 D5)',
      NEW.scenario_version_id, n_opt USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO n_senza_ris
    FROM sys.sys_scenario_options o
   WHERE o.scenario_option_version_id = NEW.scenario_version_id
     AND NOT EXISTS (SELECT 1 FROM sys.sys_scenario_results r WHERE r.scenario_result_option_id = o.scenario_option_id);
  IF n_senza_ris > 0 THEN
    RAISE EXCEPTION '000515 G2: % opzioni della versione % senza risultati calcolati',
      n_senza_ris, NEW.scenario_version_id USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO n_ris_senza_fonte
    FROM sys.sys_scenario_results r
    JOIN sys.sys_scenario_options o ON o.scenario_option_id = r.scenario_result_option_id
   WHERE o.scenario_option_version_id = NEW.scenario_version_id
     AND NOT EXISTS (SELECT 1 FROM sys.sys_scenario_sources s WHERE s.scenario_source_result_id = r.scenario_result_id);
  IF n_ris_senza_fonte > 0 THEN
    RAISE EXCEPTION '000515 G2: % risultati della versione % senza fonte cliccabile (E13)',
      n_ris_senza_fonte, NEW.scenario_version_id USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO n_senza_equita
    FROM sys.sys_scenario_options o
   WHERE o.scenario_option_version_id = NEW.scenario_version_id
     AND o.scenario_option_touches_people
     AND NOT EXISTS (SELECT 1 FROM sys.sys_scenario_equity_checks e
                      WHERE e.scenario_equity_check_option_id = o.scenario_option_id);
  IF n_senza_equita > 0 THEN
    RAISE EXCEPTION '000515 G2: % opzioni che toccano persone senza controllo di equità dichiarato (E12)',
      n_senza_equita USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;

-- G3: un'opzione che tocca persone è raccomandata solo con l'equità tutta superata
CREATE OR REPLACE FUNCTION sys.sys_scenario_guardia_equita_opzione() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE n_tot int; n_ok int;
BEGIN
  IF NEW.scenario_option_recommended AND NEW.scenario_option_touches_people THEN
    SELECT count(*), count(*) FILTER (WHERE scenario_equity_check_outcome = 'SUPERATO')
      INTO n_tot, n_ok
      FROM sys.sys_scenario_equity_checks WHERE scenario_equity_check_option_id = NEW.scenario_option_id;
    IF n_tot = 0 OR n_ok <> n_tot THEN
      RAISE EXCEPTION '000515 G3: l''opzione % tocca persone: si raccomanda solo con i controlli di equità tutti SUPERATI (% su %)',
        NEW.scenario_option_code, n_ok, n_tot USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION sys.sys_scenario_guardia_equita_controllo() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.scenario_equity_check_outcome <> 'SUPERATO' AND EXISTS (
       SELECT 1 FROM sys.sys_scenario_options
        WHERE scenario_option_id = NEW.scenario_equity_check_option_id
          AND scenario_option_recommended AND scenario_option_touches_people) THEN
    RAISE EXCEPTION '000515 G3: l''opzione è raccomandata: un controllo di equità % la smentisce; prima si toglie la raccomandazione',
      NEW.scenario_equity_check_outcome USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS sys_scenario_versions_guardia ON sys.sys_scenario_versions;
CREATE TRIGGER sys_scenario_versions_guardia BEFORE INSERT OR UPDATE ON sys.sys_scenario_versions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_versione();

DROP TRIGGER IF EXISTS sys_scenario_options_guardia_equita ON sys.sys_scenario_options;
CREATE TRIGGER sys_scenario_options_guardia_equita BEFORE INSERT OR UPDATE ON sys.sys_scenario_options
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_equita_opzione();
DROP TRIGGER IF EXISTS sys_scenario_equity_checks_guardia ON sys.sys_scenario_equity_checks;
CREATE TRIGGER sys_scenario_equity_checks_guardia BEFORE INSERT OR UPDATE ON sys.sys_scenario_equity_checks
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_equita_controllo();

-- G1 su tutte le figlie; G4 dove la riga porta versione e opzione insieme
DROP TRIGGER IF EXISTS sys_scenario_options_congelata ON sys.sys_scenario_options;
CREATE TRIGGER sys_scenario_options_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_options
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_option_version_id', 'versione');
DROP TRIGGER IF EXISTS sys_scenario_assumptions_congelata ON sys.sys_scenario_assumptions;
CREATE TRIGGER sys_scenario_assumptions_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_assumptions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_assumption_version_id', 'versione');
DROP TRIGGER IF EXISTS sys_scenario_sources_congelata ON sys.sys_scenario_sources;
CREATE TRIGGER sys_scenario_sources_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_sources
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_source_version_id', 'versione');
DROP TRIGGER IF EXISTS sys_scenario_levers_congelata ON sys.sys_scenario_levers;
CREATE TRIGGER sys_scenario_levers_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_levers
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_lever_option_id', 'opzione');
DROP TRIGGER IF EXISTS sys_scenario_results_congelata ON sys.sys_scenario_results;
CREATE TRIGGER sys_scenario_results_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_results
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_result_option_id', 'opzione');
DROP TRIGGER IF EXISTS sys_scenario_equity_checks_congelata ON sys.sys_scenario_equity_checks;
CREATE TRIGGER sys_scenario_equity_checks_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_equity_checks
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('scenario_equity_check_option_id', 'opzione');
DROP TRIGGER IF EXISTS sys_scenario_shadow_units_congelata ON sys.sys_scenario_shadow_units;
CREATE TRIGGER sys_scenario_shadow_units_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_shadow_units
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('shadow_unit_version_id', 'versione');
DROP TRIGGER IF EXISTS sys_scenario_shadow_positions_congelata ON sys.sys_scenario_shadow_positions;
CREATE TRIGGER sys_scenario_shadow_positions_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_shadow_positions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('shadow_position_version_id', 'versione');
DROP TRIGGER IF EXISTS sys_scenario_shadow_assignments_congelata ON sys.sys_scenario_shadow_assignments;
CREATE TRIGGER sys_scenario_shadow_assignments_congelata BEFORE INSERT OR UPDATE OR DELETE ON sys.sys_scenario_shadow_assignments
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_congelata('shadow_assignment_version_id', 'versione');

DROP TRIGGER IF EXISTS sys_scenario_assumptions_tenant ON sys.sys_scenario_assumptions;
CREATE TRIGGER sys_scenario_assumptions_tenant BEFORE INSERT OR UPDATE ON sys.sys_scenario_assumptions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_tenant('scenario_assumption_version_id', 'scenario_assumption_tenant_id', 'scenario_assumption_option_id');
DROP TRIGGER IF EXISTS sys_scenario_shadow_units_tenant ON sys.sys_scenario_shadow_units;
CREATE TRIGGER sys_scenario_shadow_units_tenant BEFORE INSERT OR UPDATE ON sys.sys_scenario_shadow_units
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_tenant('shadow_unit_version_id', 'shadow_unit_tenant_id', 'shadow_unit_option_id');
DROP TRIGGER IF EXISTS sys_scenario_shadow_positions_tenant ON sys.sys_scenario_shadow_positions;
CREATE TRIGGER sys_scenario_shadow_positions_tenant BEFORE INSERT OR UPDATE ON sys.sys_scenario_shadow_positions
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_tenant('shadow_position_version_id', 'shadow_position_tenant_id', 'shadow_position_option_id');
DROP TRIGGER IF EXISTS sys_scenario_shadow_assignments_tenant ON sys.sys_scenario_shadow_assignments;
CREATE TRIGGER sys_scenario_shadow_assignments_tenant BEFORE INSERT OR UPDATE ON sys.sys_scenario_shadow_assignments
  FOR EACH ROW EXECUTE FUNCTION sys.sys_scenario_guardia_tenant('shadow_assignment_version_id', 'shadow_assignment_tenant_id', 'shadow_assignment_option_id');

-- ── 11. La fotografia: legge le tabelle vere, scrive solo l'ombra della versione ────────────
CREATE OR REPLACE FUNCTION sys.sys_scenario_fotografa(p_version_id uuid)
RETURNS TABLE (unita integer, posizioni integer, assegnazioni integer, impronta char(64))
LANGUAGE plpgsql AS $fn$
DECLARE
  v_tenant uuid; v_status varchar; v_digest char(64);
  n_u int; n_p int; n_a int;
BEGIN
  SELECT scenario_version_tenant_id, scenario_version_status
    INTO v_tenant, v_status
    FROM sys.sys_scenario_versions WHERE scenario_version_id = p_version_id FOR UPDATE;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION '000515 fotografia: la versione % non esiste', p_version_id;
  END IF;
  IF v_status <> 'BOZZA' THEN
    RAISE EXCEPTION '000515 fotografia: la versione % è %, si fotografa solo una BOZZA', p_version_id, v_status;
  END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_scenario_shadow_units
              WHERE shadow_unit_version_id = p_version_id AND shadow_unit_option_id IS NULL) THEN
    RAISE EXCEPTION '000515 fotografia: la versione % ha già la sua fotografia', p_version_id;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _ombra_unita (source_id uuid PRIMARY KEY, shadow_id uuid NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _ombra_posizioni (source_id uuid PRIMARY KEY, shadow_id uuid NOT NULL) ON COMMIT DROP;
  TRUNCATE _ombra_unita, _ombra_posizioni;

  -- unità attive oggi
  INSERT INTO _ombra_unita (source_id, shadow_id)
  SELECT u.organization_unit_id, gen_random_uuid()
    FROM sys.sys_organization_units u
   WHERE u.organization_unit_tenant_id = v_tenant AND u.organization_unit_is_active
     AND u.organization_unit_effective_from <= current_date
     AND (u.organization_unit_effective_to IS NULL OR u.organization_unit_effective_to >= current_date);
  INSERT INTO sys.sys_scenario_shadow_units
    (shadow_unit_id, shadow_unit_version_id, shadow_unit_tenant_id, shadow_unit_source_id, shadow_unit_parent_id,
     shadow_unit_code, shadow_unit_name, shadow_unit_type, shadow_unit_manager_user_id)
  SELECT m.shadow_id, p_version_id, v_tenant, u.organization_unit_id, mp.shadow_id,
         u.organization_unit_code, u.organization_unit_name, u.organization_unit_type, u.organization_unit_manager_user_id
    FROM _ombra_unita m
    JOIN sys.sys_organization_units u ON u.organization_unit_id = m.source_id
    LEFT JOIN _ombra_unita mp ON mp.source_id = u.organization_unit_parent_id
   ORDER BY (u.organization_unit_parent_id IS NOT NULL);
  GET DIAGNOSTICS n_u = ROW_COUNT;

  -- posizioni attive oggi
  INSERT INTO _ombra_posizioni (source_id, shadow_id)
  SELECT p.position_id, gen_random_uuid()
    FROM sys.sys_positions p
   WHERE p.position_tenant_id = v_tenant AND p.position_is_active
     AND p.position_effective_from <= current_date
     AND (p.position_effective_to IS NULL OR p.position_effective_to >= current_date);
  INSERT INTO sys.sys_scenario_shadow_positions
    (shadow_position_id, shadow_position_version_id, shadow_position_tenant_id, shadow_position_source_id,
     shadow_position_unit_id, shadow_position_code, shadow_position_title, shadow_position_job_role_id,
     shadow_position_criticality, shadow_position_economic_weight)
  SELECT m.shadow_id, p_version_id, v_tenant, p.position_id, mu.shadow_id,
         p.position_code, p.position_title, p.position_job_role_id, p.position_criticality, p.position_economic_weight
    FROM _ombra_posizioni m
    JOIN sys.sys_positions p ON p.position_id = m.source_id
    LEFT JOIN _ombra_unita mu ON mu.source_id = p.position_organization_unit_id;
  GET DIAGNOSTICS n_p = ROW_COUNT;
  -- i riporti si legano dopo, fra righe ombra (si aggiorna l'ombra, non la posizione vera)
  UPDATE sys.sys_scenario_shadow_positions sp
     SET shadow_position_reports_to_id = mr.shadow_id
    FROM sys.sys_positions p
    JOIN _ombra_posizioni mr ON mr.source_id = p.position_reports_to_position_id
   WHERE sp.shadow_position_version_id = p_version_id AND sp.shadow_position_option_id IS NULL
     AND p.position_id = sp.shadow_position_source_id;

  -- assegnazioni attive oggi, sulle sole posizioni fotografate
  INSERT INTO sys.sys_scenario_shadow_assignments
    (shadow_assignment_version_id, shadow_assignment_tenant_id, shadow_assignment_source_id,
     shadow_assignment_position_id, shadow_assignment_user_id, shadow_assignment_kind, shadow_assignment_fte)
  SELECT p_version_id, v_tenant, a.user_position_assignment_id, mp.shadow_id,
         a.user_position_assignment_user_id, a.user_position_assignment_kind,
         LEAST(GREATEST(a.user_position_assignment_fte, 0.001), 1)
    FROM sys.sys_user_position_assignments a
    JOIN _ombra_posizioni mp ON mp.source_id = a.user_position_assignment_position_id
   WHERE a.user_position_assignment_tenant_id = v_tenant
     AND a.user_position_assignment_status = 'ACTIVE'
     AND a.user_position_assignment_start_date <= current_date
     AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= current_date);
  GET DIAGNOSTICS n_a = ROW_COUNT;

  -- impronta della fotografia: le righe vere di partenza, in ordine stabile
  SELECT encode(sha256(convert_to(coalesce(string_agg(x, E'\n' ORDER BY x), ''), 'UTF8')), 'hex')
    INTO v_digest
    FROM (
      SELECT 'U|' || su.shadow_unit_source_id || '|' || coalesce(pu.shadow_unit_source_id::text, '') || '|' ||
             su.shadow_unit_code || '|' || su.shadow_unit_name || '|' || coalesce(su.shadow_unit_manager_user_id::text, '') AS x
        FROM sys.sys_scenario_shadow_units su
        LEFT JOIN sys.sys_scenario_shadow_units pu ON pu.shadow_unit_id = su.shadow_unit_parent_id
       WHERE su.shadow_unit_version_id = p_version_id AND su.shadow_unit_option_id IS NULL
      UNION ALL
      SELECT 'P|' || sp.shadow_position_source_id || '|' || coalesce(su.shadow_unit_source_id::text, '') || '|' ||
             coalesce(rp.shadow_position_source_id::text, '') || '|' || sp.shadow_position_code || '|' ||
             sp.shadow_position_title || '|' || coalesce(sp.shadow_position_economic_weight::text, '')
        FROM sys.sys_scenario_shadow_positions sp
        LEFT JOIN sys.sys_scenario_shadow_units su ON su.shadow_unit_id = sp.shadow_position_unit_id
        LEFT JOIN sys.sys_scenario_shadow_positions rp ON rp.shadow_position_id = sp.shadow_position_reports_to_id
       WHERE sp.shadow_position_version_id = p_version_id AND sp.shadow_position_option_id IS NULL
      UNION ALL
      SELECT 'A|' || sa.shadow_assignment_source_id || '|' || coalesce(sa.shadow_assignment_user_id::text, '') || '|' ||
             sa.shadow_assignment_kind || '|' || sa.shadow_assignment_fte::text
        FROM sys.sys_scenario_shadow_assignments sa
       WHERE sa.shadow_assignment_version_id = p_version_id AND sa.shadow_assignment_option_id IS NULL
    ) righe;

  UPDATE sys.sys_scenario_versions
     SET scenario_version_baseline_at = now(), scenario_version_baseline_digest = v_digest
   WHERE scenario_version_id = p_version_id;

  RETURN QUERY SELECT n_u, n_p, n_a, v_digest;
END $fn$;
COMMENT ON FUNCTION sys.sys_scenario_fotografa(uuid) IS
  'Fotografia del tenant per una versione di scenario (000515): LEGGE unità, posizioni e assegnazioni attive e scrive solo nelle tabelle ombra della versione; impronta SHA-256 nella versione.';

-- ── 12. Post-condizione: le tabelle ci sono, sono classificate (I23) e registrate (000062) ──
DO $$
DECLARE n int;
  attese text[] := ARRAY['sys_scenarios','sys_scenario_versions','sys_scenario_options','sys_scenario_levers',
    'sys_scenario_assumptions','sys_scenario_results','sys_scenario_sources','sys_scenario_equity_checks',
    'sys_scenario_shadow_units','sys_scenario_shadow_positions','sys_scenario_shadow_assignments'];
BEGIN
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name = ANY (attese);
  IF n <> 11 THEN RAISE EXCEPTION '000515: attese 11 tabelle del motore degli scenari, trovate %', n; END IF;
  SELECT count(*) INTO n FROM sys.sys_classificazione_direzione_dato WHERE tabella = ANY (attese);
  IF n <> 11 THEN RAISE EXCEPTION '000515: le tabelle degli scenari non sono classificate in 000429 (%)', n; END IF;
END $$;

COMMIT;
