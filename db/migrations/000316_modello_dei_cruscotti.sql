-- ─────────────────────────────────────────────────────────────────────────────
-- 000316 — Il modello dei cruscotti: famiglie, viste, classi esposte, permessi (#142 F2)
--
-- DIREZIONE DI ENZO (2026-08-05): «proseguendo nello sviluppo creeremo cruscotti focalizzati
-- per ciascuna tipologia di utilizzatore, per cui la parola *cruscotto* da sola non sara'
-- sufficiente per collegare un utente ad un cruscotto». Otto famiglie dichiarate — Azienda,
-- Processi, Organizzazione, Filiale, HR Management, Platform Management, Tenant Management,
-- Self-Service — ciascuna con requisiti d'accesso propri, il DIVIETO compreso, e con la
-- granularita' dichiarata PER VISTA.
--
-- STATO DI PARTENZA, misurato dal vivo prima di scrivere una riga (non ripreso da un
-- documento): esiste UN solo cruscotto — `dashboard` / `/dashboard` / permesso generico
-- `dashboard:view` — e SETTE ruoli su quattordici lo detengono. Sette tipologie diverse
-- guardano la stessa pagina: e' il problema posto da Enzo, misurato.
--
-- ── PERCHE' UNA TABELLA NUOVA E NON RIGHE IN `sys_ui_interfaces`
--
-- Una voce di menu e' una PAGINA che esiste. Le otto pagine non esistono ancora: le costruira'
-- F4. Inserirle ora in `sys_ui_interfaces` produrrebbe un menu che offre pagine inesistenti —
-- la stessa specie di bugia che #99 F7 ha appena tolto («un menu che offre una funzione che
-- appartiene a un'altra persona e' comunque una bugia»). Qui invece si dichiara il MODELLO:
-- quali cruscotti esistono, cosa mostrano, chi puo' vederli. `dashboard_ui_interface_id` resta
-- NULL fino a F4, che aggancia la pagina vera, e `dashboard_is_active` nasce `false` apposta.
--
-- ── LA GRANULARITA' VIVE NEL BLOCCO, E LA PAGINA LA EREDITA
--
-- Le classi di dato NON si dichiarano sul cruscotto: si dichiarano sulla singola VISTA
-- (`sys_dashboard_blocks`). La pagina espone l'UNIONE di quelle dei suoi blocchi. E' cosi' che
-- «la granularita' e' dichiarata per vista» diventa un fatto interrogabile invece di una
-- promessa, ed e' anche l'unico modo per non avere due verita' sullo stesso fatto: se le classi
-- stessero in due posti, un giorno divergerebbero. La sentinella `v_dashboard_class_drift`
-- sorveglia esattamente quel giorno.
--
-- ── COSA QUESTO MODELLO NON FA (ADR-0036, e il reperto che apre F2)
--
-- La derivazione M1 **restringe, non concede**. Dichiarare che un cruscotto espone
-- `COMPENSATION` non lo apre a nessuno: lo TOGLIE a chi ha `none` su quella classe — capi
-- squadra, proprietari di processo, mentori, approvatori. Il *se* resta il permesso RBAC,
-- ed e' per questo che ogni famiglia ha un permesso proprio: F7 sostituisce «quali tipologie
-- lo vedono», non «esiste il diritto di vederlo».
--
-- ── UN REPERTO CHE LA MAPPATURA HA PRODOTTO, e vale la pena scriverlo
--
-- Mappando le otto famiglie sulle sette classi si vede che **Organizzazione e Filiale espongono
-- le stesse classi**. Non sono distinte dal COSA: sono distinte dal PERIMETRO — la filiale e' un
-- sotto-albero. Le classi di M1 non possono separarle, e non e' un difetto della mappatura: e'
-- la conferma che ADR-0036 ha due assi e che qui ne stiamo usando uno solo. Il secondo asse lo
-- porta il resolver gerarchico, non questa tabella.
--
-- ── IL VECCHIO `dashboard:view` NON SI RITIRA QUI
--
-- ADR-0035: si emenda il file che crea l'oggetto. Il grant generico regge la pagina VIVA, che
-- e' ancora l'unica esistente; toglierlo adesso spegnerebbe l'unico cruscotto che c'e' prima
-- che i suoi successori esistano. Il ritiro appartiene a F4, quando le pagine nuove ci sono.
--
-- RD-08: `varchar(N) + CHECK`, mai ENUM. I3/I4: `sys.sys_<plural>`. I5: nessuna RLS.
-- Non distruttiva: crea tre tabelle nuove e le popola, non tocca alcuna riga esistente —
-- per questo non c'e' giornale di ritorno. L'unica scrittura su dati preesistenti e' la
-- dichiarazione delle classi della voce `dashboard`, discussa piu' sotto e misurata.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il catalogo delle famiglie ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_dashboards (
  dashboard_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_code              varchar(48)  NOT NULL,
  dashboard_name              varchar(128) NOT NULL,
  -- La rotta che la pagina AVRA'. Dichiararla ora rende verificabile, in F4, che la pagina
  -- costruita sia quella promessa dal modello, invece di scoprirlo a occhio.
  dashboard_route             varchar(255) NOT NULL,
  -- Il *se* (I16): il permesso RBAC proprio della famiglia. NULL soltanto per il Self-Service,
  -- che e' il pavimento universale (I17) e non si concede — si ha per il fatto di esistere.
  dashboard_permission_code   varchar(64),
  -- L'aggancio alla voce di menu, quando la pagina esistera' (F4). NULL non e' una dimenticanza:
  -- e' l'affermazione «questa pagina non e' ancora costruita».
  dashboard_ui_interface_id   uuid REFERENCES sys.sys_ui_interfaces(ui_interface_id) ON DELETE SET NULL,
  dashboard_order             integer NOT NULL DEFAULT 0,
  dashboard_is_active         boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_dashboards_code_uq UNIQUE (dashboard_code),
  -- Una famiglia attiva senza pagina agganciata sarebbe esattamente il menu che mente.
  CONSTRAINT sys_dashboards_attivo_ha_pagina
    CHECK (dashboard_is_active = false OR dashboard_ui_interface_id IS NOT NULL)
);

-- ── 2. Le viste di ciascun cruscotto — qui vive la granularita' ──────────────
CREATE TABLE IF NOT EXISTS sys.sys_dashboard_blocks (
  dashboard_block_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id            uuid NOT NULL REFERENCES sys.sys_dashboards(dashboard_id) ON DELETE CASCADE,
  dashboard_block_code    varchar(64)  NOT NULL,
  dashboard_block_name    varchar(128) NOT NULL,
  dashboard_block_order   integer NOT NULL DEFAULT 0,
  dashboard_block_is_active boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_dashboard_blocks_uq UNIQUE (dashboard_id, dashboard_block_code)
);

CREATE INDEX IF NOT EXISTS sys_dashboard_blocks_dashboard_idx
  ON sys.sys_dashboard_blocks (dashboard_id);

-- ── 3. Le classi che ogni vista espone ───────────────────────────────────────
-- Le SETTE classi di M1 (ADR-0036 §7), stesso vocabolario di `sys_ui_interface_data_classes`
-- (mig. 000315): i nomi sono quelli del codice, dove l'equivalenza col documento e' dichiarata
-- una volta sola — IDENTITY→PERSONAL, CONTRACT_PAY→COMPENSATION, COMPETENCE→SKILL.
CREATE TABLE IF NOT EXISTS sys.sys_dashboard_block_data_classes (
  dashboard_block_data_class_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_block_id            uuid NOT NULL
                                  REFERENCES sys.sys_dashboard_blocks(dashboard_block_id) ON DELETE CASCADE,
  data_class                    varchar(24) NOT NULL
                                  CHECK (data_class IN ('PERSONAL', 'COMPENSATION', 'SKILL',
                                                        'EVALUATION', 'ACTIVITY', 'CREDENTIAL',
                                                        'SPECIAL_CATEGORY')),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_dashboard_block_data_classes_uq UNIQUE (dashboard_block_id, data_class)
);

CREATE INDEX IF NOT EXISTS sys_dashboard_block_data_classes_block_idx
  ON sys.sys_dashboard_block_data_classes (dashboard_block_id);

-- ── 4. I permessi: uno per famiglia ──────────────────────────────────────────
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT v.code, v.nome, v.risorsa, v.azione
  FROM (VALUES
    ('dashboard_company:view',  'Vedere il cruscotto Azienda',             'dashboard_company',  'view'),
    ('dashboard_process:view',  'Vedere il cruscotto Processi',            'dashboard_process',  'view'),
    ('dashboard_org:view',      'Vedere il cruscotto Organizzazione',      'dashboard_org',      'view'),
    ('dashboard_branch:view',   'Vedere il cruscotto Filiale',             'dashboard_branch',   'view'),
    ('dashboard_hr:view',       'Vedere il cruscotto HR Management',       'dashboard_hr',       'view'),
    ('dashboard_platform:view', 'Vedere il cruscotto Platform Management', 'dashboard_platform', 'view'),
    ('dashboard_tenant:view',   'Vedere il cruscotto Tenant Management',   'dashboard_tenant',   'view')
  ) AS v(code, nome, risorsa, azione)
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_auth_permissions p WHERE p.auth_permission_code = v.code
 );

-- Estensione allowlist TENANT_ADMIN (guardia D-57 — parsa dopo il marker). La 000210 e'
-- deny-by-default: un permesso che arriva a TENANT_ADMIN senza essere DICHIARATO qui e' un
-- assorbimento silenzioso.
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000316(code text PRIMARY KEY);
INSERT INTO _ta_extend_000316(code) VALUES
    ('dashboard_company:view'),
    ('dashboard_process:view'),
    ('dashboard_org:view'),
    ('dashboard_hr:view'),
    ('dashboard_tenant:view');
DROP TABLE _ta_extend_000316;

-- ── 5. La platea. Ogni riga e' una decisione, e le non ovvie portano il motivo ─
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM (VALUES
    -- Azienda: chi risponde dell'azienda intera. `CEO` c'e' per I19 — il vertice vede tutto
    -- perche' la sua catena E' l'azienda, non per eccezione.
    ('dashboard_company:view',  'TENANT_ADMIN'),
    ('dashboard_company:view',  'HRMS_MANAGER'),
    ('dashboard_company:view',  'CEO'),
    -- Processi: il proprietario dei processi, piu' chi governa il tenant.
    ('dashboard_process:view',  'PROCESS_OWNER'),
    ('dashboard_process:view',  'TENANT_ADMIN'),
    ('dashboard_process:view',  'HRMS_MANAGER'),
    -- Organizzazione: la struttura del tenant. `ORG_DIRECTOR` e' il ruolo che la governa.
    ('dashboard_org:view',      'TENANT_ADMIN'),
    ('dashboard_org:view',      'HRMS_MANAGER'),
    ('dashboard_org:view',      'ORG_DIRECTOR'),
    -- Filiale: il sotto-albero. `BRANCH_MANAGER` era gia' l'aggancio previsto (mig. 000272),
    -- e `MANAGER` guida una catena, che e' la stessa forma di perimetro.
    ('dashboard_branch:view',   'BRANCH_MANAGER'),
    ('dashboard_branch:view',   'MANAGER'),
    -- HR Management: il mandato HR (I22), e chi governa il tenant.
    -- ⚠ NON `PLATFORM_ADMIN`: ADR-0032 dice che il suo e' un mandato TECNICO, e M1 gli da'
    -- `mask` su COMPENSATION ed EVALUATION. Un cruscotto HR mascherato per meta' non e' un
    -- cruscotto HR: il diritto non gli va concesso, non gli va concesso e poi tolto a valle.
    ('dashboard_hr:view',       'HRMS_MANAGER'),
    ('dashboard_hr:view',       'TENANT_ADMIN'),
    -- Platform Management: solo l'amministratore tecnico.
    ('dashboard_platform:view', 'PLATFORM_ADMIN'),
    -- Tenant Management: la configurazione del tenant.
    ('dashboard_tenant:view',   'TENANT_ADMIN'),
    ('dashboard_tenant:view',   'PLATFORM_ADMIN')
  ) AS v(code, ruolo)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
  JOIN sys.sys_auth_roles r       ON r.auth_role_code       = v.ruolo
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Traduzioni EN: senza, il cancello i18n torna rosso (ADR-0029).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
    ('dashboard_company:view',  'View the Company dashboard'),
    ('dashboard_process:view',  'View the Processes dashboard'),
    ('dashboard_org:view',      'View the Organization dashboard'),
    ('dashboard_branch:view',   'View the Branch dashboard'),
    ('dashboard_hr:view',       'View the HR Management dashboard'),
    ('dashboard_platform:view', 'View the Platform Management dashboard'),
    ('dashboard_tenant:view',   'View the Tenant Management dashboard')
  ) AS v(code, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
ON CONFLICT DO NOTHING;

-- ── 6. Le otto famiglie ──────────────────────────────────────────────────────
INSERT INTO sys.sys_dashboards
  (dashboard_code, dashboard_name, dashboard_route, dashboard_permission_code, dashboard_order)
SELECT v.code, v.nome, v.rotta,
       NULLIF(v.permesso, '')::varchar(64),
       v.ord
  FROM (VALUES
    ('company',   'Cruscotto Azienda',             '/dashboard/azienda',      'dashboard_company:view',  10),
    ('process',   'Cruscotto Processi',            '/dashboard/processi',     'dashboard_process:view',  20),
    ('org',       'Cruscotto Organizzazione',      '/dashboard/organizzazione','dashboard_org:view',     30),
    ('branch',    'Cruscotto Filiale',             '/dashboard/filiale',      'dashboard_branch:view',   40),
    ('hr',        'Cruscotto HR Management',       '/dashboard/hr',           'dashboard_hr:view',       50),
    ('platform',  'Cruscotto Platform Management', '/dashboard/platform',     'dashboard_platform:view', 60),
    ('tenant',    'Cruscotto Tenant Management',   '/dashboard/tenant',       'dashboard_tenant:view',   70),
    -- Nessun permesso: I17, il pavimento universale. Un permesso qui sarebbe la
    -- possibilita' tecnica di NEGARE a qualcuno i propri stessi dati.
    ('self',      'Cruscotto Self-Service',        '/me',                     '',                        80)
  ) AS v(code, nome, rotta, permesso, ord)
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_dashboards d WHERE d.dashboard_code = v.code
 );

-- ── 7. Le viste, e le classi che ciascuna espone ─────────────────────────────
INSERT INTO sys.sys_dashboard_blocks
  (dashboard_id, dashboard_block_code, dashboard_block_name, dashboard_block_order)
SELECT d.dashboard_id, v.blocco, v.nome, v.ord
  FROM (VALUES
    -- AZIENDA — l'azienda in una pagina
    ('company',  'headcount',              'Organico complessivo',            10),
    ('company',  'andamento-organico',     'Andamento dell''organico',        20),
    ('company',  'copertura-competenze',   'Copertura delle competenze',      30),
    ('company',  'andamento-valutazioni',  'Andamento delle valutazioni',     40),
    -- PROCESSI
    ('process',  'processi-attivi',        'Processi attivi',                 10),
    ('process',  'attivita-recenti',       'Attivita'' recenti',              20),
    ('process',  'approvazioni-in-coda',   'Approvazioni in coda',            30),
    -- ORGANIZZAZIONE
    ('org',      'struttura-unita',        'Struttura delle unita''',         10),
    ('org',      'posizioni-scoperte',     'Posizioni scoperte',              20),
    ('org',      'catena-di-riporto',      'Catena di riporto',               30),
    -- FILIALE — stesse classi di Organizzazione, perimetro diverso (vedi testata)
    ('branch',   'organico-filiale',       'Organico della filiale',          10),
    ('branch',   'attivita-filiale',       'Attivita'' della filiale',        20),
    ('branch',   'competenze-filiale',     'Competenze della filiale',        30),
    -- HR MANAGEMENT — l'unica famiglia che tocca la classe economica
    ('hr',       'organico',               'Organico',                        10),
    ('hr',       'retribuzioni',           'Retribuzioni',                    20),
    ('hr',       'valutazioni',            'Valutazioni',                     30),
    ('hr',       'formazione',             'Formazione',                      40),
    ('hr',       'assenze',                'Assenze e permessi',              50),
    -- PLATFORM MANAGEMENT — tecnico, non HR (ADR-0032)
    ('platform', 'salute-sistema',         'Salute del sistema',              10),
    ('platform', 'credenziali-e-accessi',  'Credenziali e accessi',           20),
    ('platform', 'job-e-corse',            'Job e corse pianificate',         30),
    -- TENANT MANAGEMENT
    ('tenant',   'configurazione-tenant',  'Configurazione del tenant',       10),
    ('tenant',   'blueprint-adottati',     'Blueprint adottati',              20),
    ('tenant',   'utenti-del-tenant',      'Utenti del tenant',               30),
    -- SELF-SERVICE — nessuna classe: e' `self`, e M1 non ha una riga `self` perche' `self`
    -- non puo' valere `none` (I17).
    ('self',     'il-mio-profilo',         'Il mio profilo',                  10),
    ('self',     'le-mie-attivita',        'Le mie attivita''',               20),
    ('self',     'la-mia-formazione',      'La mia formazione',               30)
  ) AS v(cruscotto, blocco, nome, ord)
  JOIN sys.sys_dashboards d ON d.dashboard_code = v.cruscotto
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_dashboard_blocks b
    WHERE b.dashboard_id = d.dashboard_id AND b.dashboard_block_code = v.blocco
 );

INSERT INTO sys.sys_dashboard_block_data_classes (dashboard_block_id, data_class)
SELECT b.dashboard_block_id, v.classe
  FROM (VALUES
    ('company',  'headcount',             'PERSONAL'),
    ('company',  'andamento-organico',    'PERSONAL'),
    ('company',  'copertura-competenze',  'SKILL'),
    ('company',  'andamento-valutazioni', 'EVALUATION'),
    ('process',  'processi-attivi',       'ACTIVITY'),
    ('process',  'attivita-recenti',      'ACTIVITY'),
    ('process',  'approvazioni-in-coda',  'ACTIVITY'),
    ('org',      'struttura-unita',       'PERSONAL'),
    ('org',      'posizioni-scoperte',    'PERSONAL'),
    ('org',      'catena-di-riporto',     'PERSONAL'),
    ('branch',   'organico-filiale',      'PERSONAL'),
    ('branch',   'attivita-filiale',      'ACTIVITY'),
    ('branch',   'competenze-filiale',    'SKILL'),
    ('hr',       'organico',              'PERSONAL'),
    ('hr',       'retribuzioni',          'COMPENSATION'),
    ('hr',       'valutazioni',           'EVALUATION'),
    ('hr',       'formazione',            'SKILL'),
    ('hr',       'assenze',               'PERSONAL'),
    -- La salute del sistema non espone dati di persona: nessuna classe, ed e'
    -- un'affermazione, non un'omissione.
    ('platform', 'credenziali-e-accessi', 'CREDENTIAL'),
    ('platform', 'job-e-corse',           'ACTIVITY'),
    ('tenant',   'utenti-del-tenant',     'PERSONAL')
  ) AS v(cruscotto, blocco, classe)
  JOIN sys.sys_dashboards d       ON d.dashboard_code = v.cruscotto
  JOIN sys.sys_dashboard_blocks b ON b.dashboard_id = d.dashboard_id
                                 AND b.dashboard_block_code = v.blocco
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_dashboard_block_data_classes c
    WHERE c.dashboard_block_id = b.dashboard_block_id AND c.data_class = v.classe
 );

-- ── 8. La pagina viva dichiara cosa espone — ma la dichiarazione sta nella 000315 ────
-- `dashboard` era l'unica voce OVERVIEW senza classi: per M3 significa «non espone dati di
-- persona», che e' falso. Le tre classi (PERSONAL, SKILL, ACTIVITY) sono state aggiunte
-- ALL'ELENCO DELLA 000315, non qui.
--
-- PERCHE', ed e' un difetto vero trovato dalla prova generale e non un dettaglio di stile:
-- la 000315 CREA quella tabella e ne CENSISCE le righe (`<> 21`). Inserendole da qui, la
-- catena passava la PRIMA volta e si rompeva alla SECONDA — «le dichiarazioni sono 24 invece
-- di 21» — perche' ogni deploy ri-applica tutto e la post-condizione di un file di numero
-- MINORE rigira dopo che uno maggiore ha scritto. E' esattamente la classe di rottura che
-- ADR-0035 descrive, ed e' costata 10 secondi qui invece di 25 minuti di CI rossa.
-- Qui resta solo la VERIFICA incrociata, in fondo: le tre classi devono esserci.

-- ── 9. La sentinella: le due dichiarazioni non possono divergere ─────────────
-- Vale solo per i cruscotti gia' AGGANCIATI a una pagina (F4 in poi). Finche' nessuno lo e',
-- la vista e' vuota perche' non c'e' niente da confrontare — e questo NON e' un verde: e'
-- l'assenza della domanda. Il test in `apps/api/test` la interroga su un aggancio finto,
-- dentro una transazione annullata, perche' una sentinella mai vista rossa non e' una prova.
CREATE OR REPLACE VIEW sys.v_dashboard_class_drift AS
WITH classi_dei_blocchi AS (
  SELECT d.dashboard_id, d.dashboard_code, d.dashboard_ui_interface_id, c.data_class
    FROM sys.sys_dashboards d
    JOIN sys.sys_dashboard_blocks b ON b.dashboard_id = d.dashboard_id
                                   AND b.dashboard_block_is_active
    JOIN sys.sys_dashboard_block_data_classes c ON c.dashboard_block_id = b.dashboard_block_id
   WHERE d.dashboard_ui_interface_id IS NOT NULL
),
classi_della_pagina AS (
  SELECT d.dashboard_id, c.data_class
    FROM sys.sys_dashboards d
    JOIN sys.sys_ui_interface_data_classes c ON c.ui_interface_id = d.dashboard_ui_interface_id
   WHERE d.dashboard_ui_interface_id IS NOT NULL
)
SELECT b.dashboard_code, b.data_class, 'dichiarata sui blocchi, assente sulla pagina' AS scarto
  FROM classi_dei_blocchi b
 WHERE NOT EXISTS (SELECT 1 FROM classi_della_pagina p
                    WHERE p.dashboard_id = b.dashboard_id AND p.data_class = b.data_class)
UNION ALL
SELECT d.dashboard_code, p.data_class, 'dichiarata sulla pagina, nessun blocco la espone'
  FROM classi_della_pagina p
  JOIN sys.sys_dashboards d ON d.dashboard_id = p.dashboard_id
 WHERE NOT EXISTS (SELECT 1 FROM classi_dei_blocchi b
                    WHERE b.dashboard_id = p.dashboard_id AND b.data_class = p.data_class);

COMMENT ON VIEW sys.v_dashboard_class_drift IS
  'Sentinella #142 F2: per un cruscotto agganciato a una pagina, l''unione delle classi dei suoi blocchi deve coincidere con le classi dichiarate sulla pagina. Righe = divergenza.';

-- ── 10. Post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE
  n_cruscotti int; n_blocchi int; n_classi int; n_perm int; n_grant int; n_trad int;
  n_senza_perm int; n_attivi int; n_drift int; n_dash_classi int; n_utenti int;
BEGIN
  SELECT count(*) INTO n_cruscotti FROM sys.sys_dashboards;
  IF n_cruscotti <> 8 THEN
    RAISE EXCEPTION '000316: le famiglie sono % invece di 8', n_cruscotti;
  END IF;

  SELECT count(*) INTO n_blocchi FROM sys.sys_dashboard_blocks;
  IF n_blocchi <> 27 THEN RAISE EXCEPTION '000316: i blocchi sono % invece di 27', n_blocchi; END IF;

  SELECT count(*) INTO n_classi FROM sys.sys_dashboard_block_data_classes;
  IF n_classi <> 21 THEN RAISE EXCEPTION '000316: le classi dei blocchi sono % invece di 21', n_classi; END IF;

  -- Il Self-Service NON deve avere un permesso: sarebbe la possibilita' di negare a qualcuno
  -- i propri dati (I17). E deve essere l'UNICO senza.
  SELECT count(*) INTO n_senza_perm FROM sys.sys_dashboards WHERE dashboard_permission_code IS NULL;
  IF n_senza_perm <> 1 THEN
    RAISE EXCEPTION '000316: i cruscotti senza permesso sono % invece di 1 (solo self)', n_senza_perm;
  END IF;
  PERFORM 1 FROM sys.sys_dashboards WHERE dashboard_code = 'self' AND dashboard_permission_code IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '000316: il cruscotto senza permesso non e'' self'; END IF;

  -- ⚠ EMENDATA IL 2026-08-19 (#142 F4), e la ragione va detta perche' e' una lezione.
  --
  -- Diceva: «nessuna famiglia e' attiva» (`n_attivi <> 0` -> eccezione), col commento «le
  -- pagine non esistono ancora, le costruisce F4». Era una FOTOGRAFIA DEL MOMENTO scritta
  -- nella forma di un invariante: vera il giorno in cui fu scritta, e destinata a diventare
  -- falsa esattamente quando il lavoro che annunciava fosse stato fatto.
  --
  -- F4 le pagine le ha costruite (mig. `000326`), e la prova generale l'ha intercettata alla
  -- SECONDA passata — cioe' ~25 minuti prima che lo facesse la CI. Il rimedio e' emendare
  -- QUESTO file, non aggiungerne uno dopo: la catena si ri-applica per intero a ogni deploy,
  -- e una correzione a valle verrebbe disfatta al giro successivo (ADR-0035).
  --
  -- L'invariante che l'asserzione voleva davvero esprimere — vero prima di F4 e dopo — e':
  -- **nessuna famiglia e' attiva SENZA una pagina**. E' la stessa condizione del CHECK
  -- `sys_dashboards_attivo_ha_pagina`; averla anche qui la rende una post-condizione letta,
  -- non solo un vincolo dichiarato.
  SELECT count(*) INTO n_attivi FROM sys.sys_dashboards
   WHERE dashboard_is_active AND dashboard_ui_interface_id IS NULL;
  IF n_attivi <> 0 THEN
    RAISE EXCEPTION '000316: % famiglie attive senza pagina — il menu mentirebbe', n_attivi;
  END IF;

  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code LIKE 'dashboard\_%:view';
  IF n_perm <> 7 THEN RAISE EXCEPTION '000316: i permessi sono % invece di 7', n_perm; END IF;

  -- ⚠ QUI NON SI CONTA, SI VERIFICA CHI. Il conteggio esatto e' ORDINE-DIPENDENTE, e la prova
  -- generale me l'ha dimostrato facendo rosso in due modi diversi:
  --   · prima passata  → 16 concessioni, quelle dichiarate sotto;
  --   · seconda passata → 21, perche' `000005` (riga 405, «PLATFORM_ADMIN gets every
  --     permission») e' un grant A TAPPETO che rigira a ogni deploy e raccoglie i permessi
  --     nati DOPO di lui. Alla prima passata i miei non esistevano ancora quando e' passato.
  -- Un numero fisso sarebbe quindi rosso su una delle due passate, sempre. Si asserisce
  -- l'invariante: le 16 coppie dichiarate ci sono, e nessun ruolo NON previsto ne ha.
  --
  -- ⚠ E la scoperta che ne discende, perche' correggeva una mia assunzione: ADR-0032 NON
  -- protegge i dati HR da PLATFORM_ADMIN negandogli il permesso — gliene concede ogni uno,
  -- e li protegge MASCHERANDO (`platform_mandate` ha COMPENSATION/EVALUATION = `mask` in M1).
  -- Le uniche due eccezioni al tappeto in tutto il catalogo sono `whistleblowing:read|manage`,
  -- che ADR-0036 §5 isola in assoluto. Asserire l'assenza del permesso avrebbe messo qui una
  -- regola che l'architettura non ha.
  SELECT count(*) INTO n_grant
    FROM (VALUES
      ('dashboard_company:view','TENANT_ADMIN'), ('dashboard_company:view','HRMS_MANAGER'),
      ('dashboard_company:view','CEO'),
      ('dashboard_process:view','PROCESS_OWNER'), ('dashboard_process:view','TENANT_ADMIN'),
      ('dashboard_process:view','HRMS_MANAGER'),
      ('dashboard_org:view','TENANT_ADMIN'), ('dashboard_org:view','HRMS_MANAGER'),
      ('dashboard_org:view','ORG_DIRECTOR'),
      ('dashboard_branch:view','BRANCH_MANAGER'), ('dashboard_branch:view','MANAGER'),
      ('dashboard_hr:view','HRMS_MANAGER'), ('dashboard_hr:view','TENANT_ADMIN'),
      ('dashboard_platform:view','PLATFORM_ADMIN'),
      ('dashboard_tenant:view','TENANT_ADMIN'), ('dashboard_tenant:view','PLATFORM_ADMIN')
    ) AS atteso(code, ruolo)
   WHERE EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
       JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
      WHERE p.auth_permission_code = atteso.code AND r.auth_role_code = atteso.ruolo
   );
  IF n_grant <> 16 THEN
    RAISE EXCEPTION '000316: delle 16 concessioni dichiarate ne risultano %', n_grant;
  END IF;

  -- POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE: nessun ruolo fuori dai previsti ha preso
  -- un cruscotto. PLATFORM_ADMIN e' previsto per il tappeto di 000005, non per una decisione
  -- presa qui — e la differenza e' scritta, non sottintesa.
  PERFORM 1
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
   WHERE p.auth_permission_code LIKE 'dashboard\_%:view'
     AND r.auth_role_code NOT IN ('TENANT_ADMIN', 'HRMS_MANAGER', 'CEO', 'PROCESS_OWNER',
                                  'ORG_DIRECTOR', 'BRANCH_MANAGER', 'MANAGER', 'PLATFORM_ADMIN');
  IF FOUND THEN
    RAISE EXCEPTION '000316: un ruolo non previsto ha ottenuto un cruscotto';
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en' AND t.field = 'name'
     AND p.auth_permission_code LIKE 'dashboard\_%:view';
  IF n_trad <> 7 THEN RAISE EXCEPTION '000316: le traduzioni EN sono % invece di 7', n_trad; END IF;

  SELECT count(*) INTO n_dash_classi
    FROM sys.sys_ui_interface_data_classes c
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = c.ui_interface_id
   WHERE i.ui_interface_code = 'dashboard';
  IF n_dash_classi <> 3 THEN
    RAISE EXCEPTION '000316: la voce dashboard dichiara % classi invece di 3', n_dash_classi;
  END IF;

  SELECT count(*) INTO n_drift FROM sys.v_dashboard_class_drift;
  IF n_drift <> 0 THEN RAISE EXCEPTION '000316: la sentinella vede % divergenze', n_drift; END IF;

  -- POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE: le persone ci sono ancora, e il
  -- permesso generico regge ancora la pagina viva (non e' stato ritirato qui — ADR-0035).
  SELECT count(*) INTO n_utenti FROM sys.sys_users;
  IF n_utenti < 100 THEN RAISE EXCEPTION '000316: gli utenti sono scesi a % — qualcosa ha cancellato', n_utenti; END IF;
  PERFORM 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'dashboard:view';
  IF NOT FOUND THEN RAISE EXCEPTION '000316: il permesso generico dashboard:view e'' sparito'; END IF;

  RAISE NOTICE '000316 ok — 8 famiglie, 27 viste, 21 classi, 7 permessi, 16 concessioni dichiarate presenti, sentinella a 0 (utenti %)', n_utenti;
END $$;
