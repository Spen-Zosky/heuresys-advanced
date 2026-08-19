-- ============================================================================
-- 000327 — Dove vive il contenuto di un modello.  (#132 Tenant Builder P2a, F1)
--
-- IL PROBLEMA, nelle parole di Enzo (decisione E29, 2026-08-17): «il fascicolo non puo'
-- avere un archetipo aprioristico, altrimenti genera sempre una banca come RTL. I dati
-- hardcoded del file di codice scritto a mano devono scomparire — non deve rimanere
-- traccia — e l'archetipo deve essere generato dalla ricerca.»
--
-- Oggi il contenuto di un modello vive in `apps/api/src/modules/tenant-materialization/
-- blueprints.ts`: 296 righe di TypeScript che descrivono una banca al dettaglio. Finche'
-- vive li', ogni azienda costruita e' quella banca — misurato il 2026-08-19 costruendo
-- (e poi disfacendo) `T9PROVA202608191152`, che e' nata banca senza che nessuno lo
-- chiedesse. Questa migrazione da' al contenuto una casa nel DATABASE, agganciata alla
-- VERSIONE di variante: e' il presupposto perche' `F3` possa ritirare il file.
--
-- PERCHE' NON SI RIUSA `sys_organization_unit_templates`, che F1 chiedeva di valutare.
-- La misura dice che la forma non regge, e per due ragioni diverse:
--   · aggancia `..._blueprint_id`, che la mig. `000064` dichiara essere «legacy template_id
--     group (the 9)» — un RAGGRUPPAMENTO ereditato, non una versione di questo sistema. Non
--     e' orfano per difetto: non ha mai avuto un referente locale;
--   · copre UN dominio su cinque. Per `positions` e `skills` non esiste alcuna tabella di
--     modelli, e i KPI di unita' (`sys_organization_unit_kpi_templates`, 100 righe) portano
--     `tenant_id`, cioe' sono per CLIENTE e non di piattaforma.
-- Riusarla per un dominio solo avrebbe prodotto due forme diverse per la stessa cosa.
--
-- LE 225 RIGHE RESTANO, ed e' la «ragione scritta» che F1 ammette in alternativa alla
-- bonifica: sono nove strutture organizzative complete, gia' dentro `sys.*`, e potranno
-- alimentare una variante quando `F6` costruira' il ponte. Cancellarle sarebbe buttare
-- contenuto vero per fare ordine su un nome.
--
-- LA FORMA, una volta sola per cinque domini (F5: «il primo costa la forma, gli altri
-- quattro la riusano»):
--   · ogni riga appartiene a UNA VERSIONE di variante — cio' che rende il contenuto
--     fotografabile e riapplicabile, che e' il difetto della tabella vecchia;
--   · CHIAVE NATURALE `(versione, codice)`, cosi' un contenuto si nomina invece di doversi
--     ricordare un uuid, e due proposte non possono creare due volte la stessa voce;
--   · i legami interni si esprimono per CODICE (`parent_code`, `unit_code`), non per uuid:
--     una proposta di ricerca (F4) nomina «la direzione commerciale», non un identificativo
--     che non conosce. La risoluzione a uuid la fa il motore al momento di costruire.
--
-- I3/I4: tabelle `sys.sys_<plural>`. I5: sono di PIATTAFORMA, senza `tenant_id` — un
-- modello non appartiene a un cliente (e' la riqualifica che F6 dovra' scrivere). RD-08:
-- i campi categorici sono `varchar + CHECK`, mai ENUM. RD-09: `timestamptz` sugli audit.
--
-- IDEMPOTENTE. Nessuna operazione distruttiva: solo CREATE ... IF NOT EXISTS.
-- PER TORNARE INDIETRO: `DROP TABLE sys.sys_blueprint_content_*` e togliere questo file —
-- la catena si ri-applica per intero a ogni deploy (ADR-0035).
-- ============================================================================
BEGIN;

-- ── ① le unità: la struttura, per codice ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_units (
  blueprint_content_unit_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_unit_version_id  uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_unit_code        varchar(64)  NOT NULL,
  blueprint_content_unit_name        varchar(255) NOT NULL,
  blueprint_content_unit_name_en     varchar(255),
  -- Il padre si nomina per CODICE e resta dentro la stessa versione: una struttura è un
  -- albero chiuso, e un riferimento a un codice di un'altra versione sarebbe un albero
  -- che attraversa due modelli.
  blueprint_content_unit_parent_code varchar(64),
  blueprint_content_unit_type        varchar(32)  NOT NULL,
  blueprint_content_unit_level       integer      NOT NULL DEFAULT 0,
  blueprint_content_unit_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_units_uq UNIQUE (blueprint_content_unit_version_id, blueprint_content_unit_code),
  CONSTRAINT sys_blueprint_content_units_livello_ck CHECK (blueprint_content_unit_level >= 0),
  -- Una unità non può essere padre di sé stessa. Il ciclo più lungo non si intercetta con
  -- un CHECK, e non si finge di farlo: lo verifica il motore quando costruisce.
  CONSTRAINT sys_blueprint_content_units_non_se_stessa_ck
    CHECK (blueprint_content_unit_parent_code IS DISTINCT FROM blueprint_content_unit_code)
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_units_versione_idx
  ON sys.sys_blueprint_content_units (blueprint_content_unit_version_id);

-- ── ② le posizioni: chi sta dove, e quanto pesa ───────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_positions (
  blueprint_content_position_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_position_version_id uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_position_code       varchar(64)  NOT NULL,
  blueprint_content_position_title      varchar(255) NOT NULL,
  blueprint_content_position_title_en   varchar(255),
  blueprint_content_position_unit_code  varchar(64)  NOT NULL,
  blueprint_content_position_criticality varchar(16) NOT NULL DEFAULT 'MEDIUM',
  blueprint_content_position_economic_weight numeric(4,3),
  blueprint_content_position_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_positions_uq UNIQUE (blueprint_content_position_version_id, blueprint_content_position_code),
  CONSTRAINT sys_blueprint_content_positions_criticita_ck
    CHECK (blueprint_content_position_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT sys_blueprint_content_positions_peso_ck
    CHECK (blueprint_content_position_economic_weight IS NULL
           OR (blueprint_content_position_economic_weight >= 0
               AND blueprint_content_position_economic_weight <= 1))
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_positions_versione_idx
  ON sys.sys_blueprint_content_positions (blueprint_content_position_version_id);

-- ── ③ le competenze ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_skills (
  blueprint_content_skill_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_skill_version_id uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_skill_code       varchar(64)  NOT NULL,
  blueprint_content_skill_name       varchar(255) NOT NULL,
  blueprint_content_skill_name_en    varchar(255),
  blueprint_content_skill_kind       varchar(32)  NOT NULL DEFAULT 'SKILL',
  blueprint_content_skill_category   varchar(64),
  blueprint_content_skill_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_skills_uq UNIQUE (blueprint_content_skill_version_id, blueprint_content_skill_code),
  -- Il vocabolario è quello che `sys_skills.skill_kind` usa già: un modello che dichiarasse
  -- una specie che il prodotto non conosce non sarebbe costruibile.
  -- ⚠ EMENDATO dalla `000328` (#132 F2): questa riga diceva
  -- `('SKILL','KNOWLEDGE','COMPETENCE','LANGUAGE','CERTIFICATION')`, cioè NON il vocabolario
  -- di `sys_skills` — la frase qui sopra era vera come intenzione e falsa come contenuto.
  -- `LANGUAGE` e `CERTIFICATION` passavano il cancello e non erano costruibili; `BEHAVIOR`
  -- e `OTHER`, che il prodotto conosce, erano vietati al modello. Corretto qui per i
  -- database nuovi, e nella `000328` per quelli che esistono già (ADR-0035).
  CONSTRAINT sys_blueprint_content_skills_specie_ck
    CHECK (blueprint_content_skill_kind IN ('SKILL','KNOWLEDGE','COMPETENCE','BEHAVIOR','OTHER'))
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_skills_versione_idx
  ON sys.sys_blueprint_content_skills (blueprint_content_skill_version_id);

-- ── ④ gli indicatori ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_kpis (
  blueprint_content_kpi_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_kpi_version_id uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_kpi_code       varchar(64)  NOT NULL,
  blueprint_content_kpi_name       varchar(255) NOT NULL,
  blueprint_content_kpi_name_en    varchar(255),
  blueprint_content_kpi_unit       varchar(32),
  blueprint_content_kpi_direction  varchar(16)  NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  blueprint_content_kpi_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_kpis_uq UNIQUE (blueprint_content_kpi_version_id, blueprint_content_kpi_code),
  -- ⚠ EMENDATO dalla `000328` (#132 F2): diceva `TARGET_IS_BEST`, che nel prodotto non
  -- esiste — `sys_kpi_definitions.kpi_definition_polarity` ammette `TARGET_RANGE`.
  CONSTRAINT sys_blueprint_content_kpis_verso_ck
    CHECK (blueprint_content_kpi_direction IN ('HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE'))
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_kpis_versione_idx
  ON sys.sys_blueprint_content_kpis (blueprint_content_kpi_version_id);

-- ── ⑤ i processi ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_processes (
  blueprint_content_process_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_process_version_id uuid         NOT NULL
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_process_code       varchar(64)  NOT NULL,
  blueprint_content_process_name       varchar(255) NOT NULL,
  blueprint_content_process_name_en    varchar(255),
  blueprint_content_process_ordinal    integer      NOT NULL DEFAULT 0,
  -- Chi presidia il processo, per CODICE di posizione: è l'attribuzione che l'archetipo
  -- cablato esprime con 23 OWNER, uno per processo.
  blueprint_content_process_owner_position_code varchar(64),
  blueprint_content_process_metadata   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_processes_uq UNIQUE (blueprint_content_process_version_id, blueprint_content_process_code),
  CONSTRAINT sys_blueprint_content_processes_ordine_ck CHECK (blueprint_content_process_ordinal >= 0)
);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_processes_versione_idx
  ON sys.sys_blueprint_content_processes (blueprint_content_process_version_id);

-- ── ⑥ il registro di riconciliazione, che ogni tabella `sys.*` deve dichiarare ──
-- Trovato dalla PROVA GENERALE alla seconda passata: la `000062` pretende «0 UNCLASSIFIED»
-- e trovava le mie 5. Non e' una formalita': la vista `v_reconciliation_status` marca come
-- UNCLASSIFIED ogni tabella assente dal registro, e una tabella non classificata e' una
-- tabella di cui nessuno ha detto se debba essere riconciliata col sistema di provenienza.
--
-- Qui la risposta e' EXCLUDE / bucket D, e la ragione e' la sostanza di questa voce: il
-- contenuto di un modello NON viene dal legacy — nasce dalla ricerca (`#132` F4) e diventa
-- modello attraverso il ponte (F6). Un giorno queste tabelle conterranno cio' che oggi sta
-- cablato in `blueprints.ts`, e nemmeno quello viene da un'importazione.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_blueprint_content_units', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (#132 F1). Le unita'' di una versione di variante nascono dalla ricerca e dal ponte F6, non da un''importazione: non sono un bersaglio di riconciliazione.]'),
  ('sys_blueprint_content_positions', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (#132 F1). Le posizioni di una versione di variante sono modello di piattaforma, non dati di un cliente ne'' righe importate.]'),
  ('sys_blueprint_content_skills', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (#132 F1). Le competenze richieste da un modello; il catalogo vero e'' `sys_skills`, che ha la propria classificazione.]'),
  ('sys_blueprint_content_kpis', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (#132 F1). Gli indicatori che un modello propone; le definizioni vive stanno in `sys_kpi_definitions`.]'),
  ('sys_blueprint_content_processes', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (#132 F1). I processi che un modello prevede, col presidio espresso per codice di posizione.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n int; v_mancanti text;
BEGIN
  -- 1. Le cinque tabelle esistono, e sono cinque: se una mancasse, il dominio che regge
  --    resterebbe senza casa e F2 lo scoprirebbe costruendo.
  SELECT count(*) INTO n FROM information_schema.tables
   WHERE table_schema = 'sys' AND table_name LIKE 'sys_blueprint_content_%';
  IF n <> 5 THEN
    RAISE EXCEPTION '000327: attese 5 tabelle di contenuto, trovate %', n;
  END IF;

  -- 2. Ognuna aggancia la VERSIONE, che è il difetto della tabella vecchia. Si verifica la
  --    FK, non il nome della colonna: un nome giusto su una FK assente non protegge niente.
  SELECT string_agg(t.table_name, ', ') INTO v_mancanti
    FROM information_schema.tables t
   WHERE t.table_schema = 'sys' AND t.table_name LIKE 'sys_blueprint_content_%'
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = ('sys.' || t.table_name)::regclass
          AND c.contype = 'f'
          AND c.confrelid = 'sys.sys_blueprint_variant_versions'::regclass);
  IF v_mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000327: queste tabelle non agganciano una versione di variante: %', v_mancanti;
  END IF;

  -- 3. Ognuna ha la sua chiave naturale `(versione, codice)`: senza, due proposte
  --    approvate potrebbero creare due volte la stessa voce e nessuno se ne accorgerebbe.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conname LIKE 'sys_blueprint_content_%_uq' AND contype = 'u';
  IF n <> 5 THEN
    RAISE EXCEPTION '000327: attese 5 chiavi naturali (versione, codice), trovate %', n;
  END IF;

  -- 4. NESSUNA porta `tenant_id`: un modello è di piattaforma, non di un cliente. È la
  --    riqualifica che F6 dovrà scrivere, e qui si rende impossibile contraddirla per
  --    distrazione.
  SELECT string_agg(table_name, ', ') INTO v_mancanti
    FROM information_schema.columns
   WHERE table_schema = 'sys' AND table_name LIKE 'sys_blueprint_content_%'
     AND column_name LIKE '%tenant%';
  IF v_mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000327: queste tabelle di modello portano un tenant: %', v_mancanti;
  END IF;

  -- 5. Cio' che NON doveva cambiare: le 225 righe ereditate restano dove sono. Questa
  --    migrazione non le tocca, e la post-condizione lo dimostra invece di prometterlo.
  SELECT count(*) INTO n FROM sys.sys_organization_unit_templates;
  IF n <> 225 THEN
    RAISE EXCEPTION '000327: le 225 strutture ereditate sono diventate % — non dovevano essere toccate', n;
  END IF;

  -- 6. Le cinque sono classificate: la `000062` pretende «0 UNCLASSIFIED», e alla seconda
  --    passata trovava le mie. Meglio verificarlo qui, dove si legge il perche'.
  SELECT string_agg(t.table_name, ', ') INTO v_mancanti
    FROM information_schema.tables t
   WHERE t.table_schema = 'sys' AND t.table_name LIKE 'sys_blueprint_content_%'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_reconciliation_registry r
                      WHERE r.reconciliation_registry_table_name = t.table_name);
  IF v_mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000327: queste tabelle non sono nel registro di riconciliazione: %', v_mancanti;
  END IF;

  RAISE NOTICE '000327 ok — 5 tabelle di contenuto agganciate alla versione, 225 righe ereditate intatte';
END $$;

COMMIT;
