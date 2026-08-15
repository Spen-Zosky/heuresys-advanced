-- ─────────────────────────────────────────────────────────────────────────────
-- 000315 — Le classi di dato che ogni voce di menu espone (#99 F7, cascata M3)
--
-- M3 (§11 del documento dei domini) chiede che la visibilita' di una voce si DERIVI:
--
--   una tipologia vede una voce **se e solo se** esiste almeno una cella non-`none` fra i
--   suoi domini e le classi di dato che quella pagina espone.
--
-- Il pezzo che mancava e' l'ultimo: **quali classi espone una pagina**. Non e' derivabile
-- dal permesso, ed e' stato misurato prima di decidere: `ui_interface_required_resource` e'
-- la resource RBAC, cioe' il PERMESSO, non il CONTENUTO. Cinque pagine diverse —
-- `analytics-workforce`, `-attendance`, `-skills`, `-compensation`, `-kpi` — condividono la
-- resource `analytics` ed espongono quattro classi diverse. Derivare da li' avrebbe dato a
-- tutte e cinque la stessa risposta, e la pagina delle retribuzioni e' esattamente quella su
-- cui S1060 ha misurato una fuga reale (il punto unico a 220.000 €).
--
-- ⚠ PERCHE' QUESTA DICHIARAZIONE NON E' `requires_admin` CON UN ALTRO NOME. Il booleano era
-- opaco (`true`/`false`, nessuno sapeva dire perche') e **nessun controllo lo verificava**:
-- `whistleblowing-console` porta `requires_admin=false` ancora oggi, cioe' il dato dice il
-- contrario del difetto D1 che e' stato corretto nel codice. Qui invece:
--   · la dichiarazione e' verificabile contro `RESOURCE_DATA_CLASS` (cancello TS, F7);
--   · una voce SENZA classi e' un'affermazione precisa e non un'omissione — «questa pagina
--     non espone dati di persona» — e vale per cataloghi, blueprint, processi, strutture;
--   · le voci dell'area personale restano SENZA classi apposta: sono `self`, il pavimento
--     universale (I17), e M1 non ha una riga `self` perche' `self` non puo' valere `none`.
--
-- NON e' una scrittura di massa distruttiva: crea una tabella nuova e la popola. Nessuna
-- riga esistente viene toccata — per questo non c'e' giornale di ritorno: il ritiro di una
-- dichiarazione e' la cancellazione della sua riga qui, e la voce torna al solo RBAC.
--
-- RD-08: `varchar(N) + CHECK`, mai ENUM. I3/I4: `sys.sys_<plural>`. I5: nessuna RLS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sys.sys_ui_interface_data_classes (
  ui_interface_data_class_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ui_interface_id             uuid NOT NULL
                                REFERENCES sys.sys_ui_interfaces(ui_interface_id) ON DELETE CASCADE,
  -- Le SETTE classi di M1 (ADR-0036 §7). I nomi sono quelli del codice
  -- (`apps/api/src/lib/scope/data-classes.ts`), dove l'equivalenza col documento e'
  -- dichiarata una volta sola: IDENTITY→PERSONAL, CONTRACT_PAY→COMPENSATION,
  -- COMPETENCE→SKILL.
  data_class                  varchar(24) NOT NULL
                                CHECK (data_class IN ('PERSONAL', 'COMPENSATION', 'SKILL',
                                                      'EVALUATION', 'ACTIVITY', 'CREDENTIAL',
                                                      'SPECIAL_CATEGORY')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_ui_interface_data_classes_uq UNIQUE (ui_interface_id, data_class)
);

CREATE INDEX IF NOT EXISTS sys_ui_interface_data_classes_iface_idx
  ON sys.sys_ui_interface_data_classes (ui_interface_id);

-- ── Il popolamento. Ogni riga e' una decisione, e le non-ovvie portano il motivo.
INSERT INTO sys.sys_ui_interface_data_classes (ui_interface_id, data_class)
SELECT i.ui_interface_id, v.data_class
  FROM (VALUES
    -- ── GOVERNANCE ───────────────────────────────────────────────────────────
    ('users',                  'PERSONAL'),
    -- ⚠ Queste quattro sembravano CATALOGHI — tassonomia delle competenze, catalogo dei
    -- corsi — e le avevo lasciate senza classe. Il cancello di coerenza di F7 le ha
    -- respinte: la loro resource (`skill`, `learning`) e' classificata person-level in
    -- `RESOURCE_DATA_CLASS`, e il permesso che la pagina pretende e' lo STESSO che apre le
    -- competenze delle persone. Una pagina non e' un catalogo perche' si chiama cosi': lo e'
    -- se il permesso che chiede non porta altrove. Misurato: nessuno perde la voce, perche'
    -- tutti i domini che aprono una superficie hanno `SKILL` diverso da `none`.
    ('skills',                 'SKILL'),
    ('skill-taxonomy',         'SKILL'),
    ('learning',               'SKILL'),
    ('LEARNING_INITIATIVES',   'SKILL'),
    -- Una segnalazione e' un CASO DA ISTRUIRE, cioe' lavoro. Non e' la classe a
    -- proteggerla: la proteggono il permesso (un ruolo solo) e l'isolamento assoluto di
    -- ADR-0036 §5. Dichiararla PERSONAL avrebbe suggerito che la catena organizzativa
    -- possa arrivarci — l'esatto contrario dell'isolamento.
    ('whistleblowing-console', 'ACTIVITY'),
    -- ── INTELLIGENCE ─────────────────────────────────────────────────────────
    ('insights',               'EVALUATION'),
    -- ── OVERVIEW ─────────────────────────────────────────────────────────────
    ('approvals',              'ACTIVITY'),
    ('process-owner-console',  'ACTIVITY'),
    -- ⚠ `admin-mfa-policy` NON e' qui, e la sua assenza e' misurata. Dichiararla `CREDENTIAL`
    -- toglieva la pagina ai due `TENANT_ADMIN` reali (fra cui il CEO di RTL), perche' M1 da'
    -- `hr_mandate`/CREDENTIAL = `none`. Ma una POLITICA di tenant e' configurazione
    -- dell'organizzazione, non un dato di persona: resta al solo RBAC. Il contro-oracolo
    -- prima/dopo l'ha trovato — era l'unica riga di delta su 161 attori.
    -- VRIO legge le capacita' organizzative, che si derivano dalle competenze delle
    -- persone: e' SKILL, non struttura.
    ('org-director-vrio',      'SKILL'),
    -- ── WORKFORCE ────────────────────────────────────────────────────────────
    -- ⚠ Le cinque `analytics-*` condividono la resource `analytics` ed espongono classi
    -- DIVERSE. E' il caso che dimostra perche' la classe non si deriva dal permesso.
    ('analytics-workforce',    'PERSONAL'),
    ('analytics-attendance',   'PERSONAL'),
    ('analytics-skills',       'SKILL'),
    ('analytics-compensation', 'COMPENSATION'),
    ('analytics-kpi',          'EVALUATION'),
    ('time-off',               'PERSONAL'),
    ('talent-review',          'EVALUATION'),
    ('goals',                  'EVALUATION'),
    ('okrs',                   'EVALUATION'),
    ('performance',            'EVALUATION'),
    ('career-succession',      'EVALUATION')
  ) AS v(code, data_class)
  JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = v.code
ON CONFLICT ON CONSTRAINT sys_ui_interface_data_classes_uq DO NOTHING;

DO $$
DECLARE
  n_dich int; n_voci_dich int; n_personal int; n_attive int; n_orfane int; n_compensation int;
BEGIN
  SELECT count(*) INTO n_dich FROM sys.sys_ui_interface_data_classes;
  IF n_dich <> 21 THEN
    RAISE EXCEPTION '000315: le dichiarazioni sono % invece di 21 — una voce citata non esiste con quel codice', n_dich;
  END IF;

  SELECT count(DISTINCT ui_interface_id) INTO n_voci_dich FROM sys.sys_ui_interface_data_classes;
  IF n_voci_dich <> 21 THEN
    RAISE EXCEPTION '000315: le voci dichiarate sono % invece di 21', n_voci_dich;
  END IF;

  -- ⚠ POST-CONDIZIONE CHE PROTEGGE CIO' CHE NON DOVEVA CAMBIARE, ed e' la piu' importante
  -- di tutte: **nessuna voce dell'area personale deve avere una classe**. Se ne acquisisse
  -- una, verrebbe sottoposta a M1 — che non ha riga `self` — e sparirebbe dal menu di chi
  -- non ha domini, cioe' della maggioranza delle persone. Sarebbe la violazione di I17.
  SELECT count(*) INTO n_personal
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_perspective = 'PERSONAL';
  IF n_personal <> 0 THEN
    RAISE EXCEPTION '000315: % voci PERSONAL hanno una classe — I17 violata, sparirebbero dal menu', n_personal;
  END IF;

  -- La pagina delle retribuzioni DEVE portare COMPENSATION: e' la voce da cui e' partita
  -- tutta la granularita' di F7, ed e' quella su cui una fuga e' gia' stata misurata.
  SELECT count(*) INTO n_compensation
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code = 'analytics-compensation' AND dc.data_class = 'COMPENSATION';
  IF n_compensation <> 1 THEN
    RAISE EXCEPTION '000315: analytics-compensation non dichiara COMPENSATION';
  END IF;

  -- Nessuna dichiarazione puo' puntare a una voce che non esiste (la FK lo garantisce, ma
  -- una FK non dice se il JOIN di popolamento ha silenziosamente perso righe).
  SELECT count(*) INTO n_orfane
    FROM sys.sys_ui_interface_data_classes dc
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_ui_interfaces i WHERE i.ui_interface_id = dc.ui_interface_id);
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION '000315: % dichiarazioni orfane', n_orfane;
  END IF;

  -- NON doveva cambiare: le voci di menu attive sono ancora tutte li'.
  SELECT count(*) INTO n_attive FROM sys.sys_ui_interfaces WHERE ui_interface_is_active;
  IF n_attive < 66 THEN
    RAISE EXCEPTION '000315: le voci attive sono scese a % — qualcosa e stato spento', n_attive;
  END IF;

  RAISE NOTICE '000315 ok — 21 voci con classe dichiarata, 0 voci PERSONAL toccate, % voci attive intatte', n_attive;
END $$;
