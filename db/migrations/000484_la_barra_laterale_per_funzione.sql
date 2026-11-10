-- ============================================================================
-- 000484 — La barra laterale si ordina PER FUNZIONE, ogni voce ha la sua icona, e i
--          termini sono uno solo per ogni cosa.
--
-- IL RILIEVO (Enzo, 2026-11-10, entrato come Valentina Conti). Misurato dal vivo lo stesso
-- giorno su https://www.heuresys.com con `GET /api/v1/me/interfaces` e sul DOM della barra:
--   · 73 voci in 5 gruppi (Panoramica 16, Governance 13, Forza lavoro 15, Intelligence 4,
--     Area personale 25). I gruppi erano «sezioni» di tipo organizzativo, non funzioni:
--     «Panoramica» teneva insieme cruscotti, la politica MFA, l'acquisizione dei seed, il
--     registro di provenienza e i consigli operativi; «Area personale» 25 voci in fila.
--   · 16 voci senza icona: il registro dichiarava nomi che la mappa del frontend non
--     conosceva (`Lightbulb`, `ClipboardList`, `Grid3x3`, `CalendarDays`, e i nomi in
--     minuscolo della 000306 come `user`, `shield`, `file-text`, `sitemap`).
--   · due parole per la stessa cosa: «Console Process Owner», «Console Org Director» e
--     «Cruscotto Azienda»… accanto a «Dashboard». E inglese e italiano mescolati
--     («Seed acquisition», «Provenance ledger», «Insights (flight-risk)», «Time-off & leave»).
--
-- COSA FA
--   (a) ogni voce attiva riceve un GRUPPO FUNZIONALE (`ui_interface_sidebar_group`), un
--       ordine a blocchi di 100 per gruppo, un'ETICHETTA ITALIANA e un'ICONA di lucide in
--       forma PascalCase, che la mappa di `apps/web/src/app/(authenticated)/layout.tsx`
--       conosce tutta (e se un giorno non la conoscesse, il frontend mette un'icona di
--       riserva: nessuna voce resta senza).
--   (b) la sezione (`ui_interface_perspective`) dice CHE COSA è la voce — PERSONAL resta il
--       pavimento ESS di I17, e nessuna voce /me/* esce da PERSONAL — ma non decide più
--       l'ordine del menu: il frontend ordina i gruppi per l'ordine più basso delle loro voci.
--   (c) un termine solo: «Dashboard» al posto di «Console» e «Cruscotto» (è il termine di
--       SAP SuccessFactors, Workday e Oracle HCM), anche nei nomi di `sys_dashboards` e del
--       profilo dei clienti che li copia (000398), e le etichette inglesi tradotte.
--   (d) le traduzioni inglesi delle etichette (000306) si allineano.
--
-- I PERMESSI NON CAMBIANO. Nessuna colonna di cancello è toccata (`required_resource`,
-- `required_action`, `requires_admin`, `is_active`, classi di dato): chi vedeva una voce la
-- vede ancora, solo in un altro gruppo. La post-condizione lo verifica.
--
-- I GRUPPI (chiave → etichetta in `locales/*/shell.json`):
--   dashboards · organization · processes · people · talent · skills · analytics ·
--   compliance · configuration · me · me_profile · me_growth · me_results
--
-- GUARDIA / POST-CONDIZIONE / ROLLBACK
--   Guardia: nessuna rotta della mappa compare due volte fra le voci attive.
--   Post-condizione: ogni voce attiva toccata ha gruppo, etichetta e icona della mappa; il
--   numero di voci attive e le colonne di cancello sono identici a prima; nessuna voce /me/*
--   fuori da PERSONAL.
--   Rollback: giornale `staging.barra_laterale_000484_undo` (valori di prima, scritti una
--   volta sola alla prima passata e mai sovrascritti) per voci, cruscotti e profili.
--
-- IDEMPOTENTE: UPDATE da una tabella temporanea (la seconda passata produce le stesse righe).
-- Nessun BEGIN/COMMIT: il runner avvolge già il file in una transazione.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp.barra_mappa;
CREATE TEMP TABLE barra_mappa (
  route  text PRIMARY KEY,
  persp  text NOT NULL,
  grp    text NOT NULL,
  ord    int  NOT NULL,
  icon   text NOT NULL,
  label  text NOT NULL,
  label_en text NOT NULL
);

INSERT INTO barra_mappa (route, persp, grp, ord, icon, label, label_en) VALUES
  -- Dashboard
  ('/dashboard',                    'OVERVIEW',     'dashboards',    100, 'LayoutDashboard',     'Panoramica',                         'Overview'),
  ('/dashboard/company',            'OVERVIEW',     'dashboards',    110, 'Building2',           'Azienda',                            'Company'),
  ('/dashboard/org',                'OVERVIEW',     'dashboards',    120, 'Gauge',               'Organizzazione',                     'Organisation'),
  ('/dashboard/process',            'OVERVIEW',     'dashboards',    130, 'Workflow',            'Processi',                           'Processes'),
  ('/dashboard/hr',                 'OVERVIEW',     'dashboards',    140, 'UserCog',             'Direzione HR',                       'HR management'),
  ('/dashboard/branch',             'OVERVIEW',     'dashboards',    150, 'Store',               'Filiale',                            'Branch'),
  ('/dashboard/tenant',             'OVERVIEW',     'dashboards',    160, 'Building',            'Gestione del tenant',                'Tenant management'),
  ('/dashboard/platform',           'OVERVIEW',     'dashboards',    170, 'ServerCog',           'Piattaforma',                        'Platform'),
  ('/process-owner',                'OVERVIEW',     'dashboards',    180, 'GitBranch',           'Process owner',                      'Process owner'),
  ('/org-director',                 'OVERVIEW',     'dashboards',    190, 'Compass',             'Direzione organizzativa',            'Organisation design'),
  -- Organizzazione
  ('/organization/org-chart',       'GOVERNANCE',   'organization',  200, 'Network',             'Organigramma',                       'Org chart'),
  ('/positions',                    'GOVERNANCE',   'organization',  210, 'Briefcase',           'Posizioni',                          'Positions'),
  ('/job-catalog',                  'GOVERNANCE',   'organization',  220, 'BriefcaseBusiness',   'Catalogo delle mansioni',            'Job catalogue'),
  ('/organization',                 'GOVERNANCE',   'organization',  230, 'ChartNoAxesCombined', 'Analisi organizzativa',              'Organisation analysis'),
  ('/org-director/health',          'GOVERNANCE',   'organization',  240, 'HeartPulse',          'Salute organizzativa',               'Organisational health'),
  ('/org-director/vrio',            'GOVERNANCE',   'organization',  250, 'Award',               'Scorecard VRIO',                     'VRIO scorecard'),
  ('/org-director/advisor',         'GOVERNANCE',   'organization',  260, 'Lightbulb',           'Consigli operativi',                 'Operational advice'),
  -- Processi e progetti
  ('/processes',                    'GOVERNANCE',   'processes',     300, 'Workflow',            'Catalogo dei processi',              'Process catalogue'),
  ('/approvals',                    'GOVERNANCE',   'processes',     310, 'CheckCheck',          'Approvazioni',                       'Approvals'),
  ('/projects',                     'GOVERNANCE',   'processes',     320, 'FolderKanban',        'Progetti',                           'Projects'),
  -- Persone
  ('/users',                        'WORKFORCE',    'people',        400, 'Users',               'Utenti',                             'Users'),
  ('/time-off',                     'WORKFORCE',    'people',        410, 'CalendarDays',        'Ferie e permessi',                   'Time off & leave'),
  ('/analytics/attendance',         'WORKFORCE',    'people',        420, 'Clock',               'Presenze e straordinari',            'Attendance & overtime'),
  ('/analytics/compensation',       'WORKFORCE',    'people',        430, 'Coins',               'Retribuzioni',                       'Compensation'),
  ('/recruiting',                   'WORKFORCE',    'people',        440, 'UserPlus',            'Recruiting',                         'Recruiting'),
  -- Performance e talento
  ('/performance',                  'WORKFORCE',    'talent',        500, 'Star',                'Valutazioni',                        'Performance reviews'),
  ('/goals',                        'WORKFORCE',    'talent',        510, 'Target',              'Obiettivi',                          'Goals'),
  ('/okrs',                         'WORKFORCE',    'talent',        520, 'Flag',                'OKR',                                'OKRs'),
  ('/analytics/kpi',                'WORKFORCE',    'talent',        530, 'TrendingUp',          'KPI',                                'KPIs'),
  ('/talent-review',                'WORKFORCE',    'talent',        540, 'Grid3x3',             'Talent review',                      'Talent review'),
  ('/career-succession',            'WORKFORCE',    'talent',        550, 'Route',               'Carriera e successione',             'Career & succession'),
  -- Competenze e formazione
  ('/skills',                       'WORKFORCE',    'skills',        600, 'Puzzle',              'Competenze',                         'Skills'),
  ('/skill-taxonomy',               'WORKFORCE',    'skills',        610, 'Shapes',              'Tassonomia delle competenze',        'Skills taxonomy'),
  ('/analytics/skills',             'WORKFORCE',    'skills',        620, 'ChartColumn',         'Analisi delle competenze',           'Skills analysis'),
  ('/learning',                     'WORKFORCE',    'skills',        630, 'GraduationCap',       'Formazione',                         'Learning'),
  ('/learning/training-initiatives','WORKFORCE',    'skills',        640, 'BookOpen',            'Iniziative formative',               'Training initiatives'),
  -- Analisi
  ('/analytics/workforce',          'INTELLIGENCE', 'analytics',     700, 'ChartPie',            'Analisi della forza lavoro',         'Workforce analysis'),
  ('/insights',                     'INTELLIGENCE', 'analytics',     710, 'Radar',               'Rischio di abbandono',               'Attrition risk'),
  ('/engagement',                   'INTELLIGENCE', 'analytics',     720, 'MessageSquareHeart',  'Engagement e sondaggi',              'Engagement & surveys'),
  ('/visualizations',               'INTELLIGENCE', 'analytics',     730, 'PieChart',            'Visualizzazioni',                    'Visualisations'),
  -- Sicurezza e conformità
  ('/admin/roles',                  'GOVERNANCE',   'compliance',    800, 'KeyRound',            'Ruoli e permessi',                   'Roles & permissions'),
  ('/admin/mfa-policy',             'GOVERNANCE',   'compliance',    810, 'Fingerprint',         'Autenticazione a più fattori',       'Multi-factor authentication'),
  ('/provenance',                   'GOVERNANCE',   'compliance',    820, 'ScrollText',          'Registro di provenienza',            'Provenance register'),
  ('/generated-origins',            'GOVERNANCE',   'compliance',    830, 'DatabaseZap',         'Registro delle righe generate',      'Generated rows register'),
  ('/whistleblowing-console',       'GOVERNANCE',   'compliance',    840, 'Megaphone',           'Segnalazioni whistleblowing',        'Whistleblowing reports'),
  -- Configurazione
  ('/blueprints',                   'GOVERNANCE',   'configuration', 900, 'Blocks',              'Blueprint',                          'Blueprints'),
  ('/tenant-blueprints',            'GOVERNANCE',   'configuration', 910, 'FileStack',           'Fascicoli di configurazione',        'Configuration dossiers'),
  ('/tenants',                      'GOVERNANCE',   'configuration', 920, 'Landmark',            'Tenant',                             'Tenants'),
  ('/consolidation',                'GOVERNANCE',   'configuration', 930, 'GitMerge',            'Consolidamento con il prototipo',    'Prototype consolidation'),
  ('/seed-acquisition/runs',        'GOVERNANCE',   'configuration', 940, 'Sprout',              'Acquisizione dei dati di base',      'Seed acquisition'),
  ('/content',                      'GOVERNANCE',   'configuration', 950, 'Newspaper',           'Contenuti',                          'Content'),
  ('/leads',                        'GOVERNANCE',   'configuration', 960, 'Contact',             'Richieste di contatto',              'Contact requests'),
  ('/system-health',                'GOVERNANCE',   'configuration', 970, 'Activity',            'Stato del sistema',                  'System health'),
  -- Il mio spazio
  ('/me',                           'PERSONAL',     'me',           1000, 'House',               'La mia area',                        'My HR'),
  ('/me/inbox',                     'PERSONAL',     'me',           1010, 'Inbox',               'Posta in arrivo',                    'Inbox'),
  ('/me/approvals',                 'PERSONAL',     'me',           1020, 'CheckCheck',          'Le mie approvazioni',                'My approvals'),
  ('/me/delegations',               'PERSONAL',     'me',           1030, 'Handshake',           'Deleghe',                            'Delegations'),
  ('/me/team',                      'PERSONAL',     'me',           1040, 'UsersRound',          'Il mio team',                        'My team'),
  ('/me/org-chart',                 'PERSONAL',     'me',           1050, 'Network',             'Organigramma',                       'Org chart'),
  ('/me/handbook',                  'PERSONAL',     'me',           1060, 'BookMarked',          'Manuale del dipendente',             'Employee handbook'),
  -- Il mio profilo
  ('/me/profile',                   'PERSONAL',     'me_profile',   1100, 'User',                'Profilo',                            'Profile'),
  ('/me/documents',                 'PERSONAL',     'me_profile',   1110, 'FileText',            'I miei documenti',                   'My documents'),
  ('/me/time-off',                  'PERSONAL',     'me_profile',   1120, 'CalendarDays',        'Ferie e permessi',                   'Time off & leave'),
  ('/me/surveys',                   'PERSONAL',     'me_profile',   1130, 'ClipboardList',       'I miei sondaggi',                    'My surveys'),
  ('/me/security',                  'PERSONAL',     'me_profile',   1140, 'Shield',              'Sicurezza dell''account',            'Account security'),
  -- La mia crescita
  ('/me/skills',                    'PERSONAL',     'me_growth',    1200, 'Puzzle',              'Le mie competenze',                  'My skills'),
  ('/me/skills/self-assessment',    'PERSONAL',     'me_growth',    1210, 'ClipboardCheck',      'Autovalutazione delle competenze',   'Skills self-assessment'),
  ('/me/gaps',                      'PERSONAL',     'me_growth',    1220, 'Crosshair',           'I miei gap di competenza',           'My skill gaps'),
  ('/me/certifications',            'PERSONAL',     'me_growth',    1230, 'BadgeCheck',          'Le mie certificazioni',              'My certifications'),
  ('/me/learning',                  'PERSONAL',     'me_growth',    1240, 'GraduationCap',       'La mia formazione',                  'My learning'),
  ('/me/learning/catalogue',        'PERSONAL',     'me_growth',    1250, 'Library',             'Catalogo dei percorsi',              'Learning catalogue'),
  ('/me/career',                    'PERSONAL',     'me_growth',    1260, 'Route',               'La mia carriera',                    'My career'),
  ('/me/career/target',             'PERSONAL',     'me_growth',    1270, 'Flag',                'Obiettivo di carriera',              'Career goal'),
  ('/me/matching',                  'PERSONAL',     'me_growth',    1280, 'Telescope',           'Occupazioni compatibili',            'Matching occupations'),
  ('/me/positions',                 'PERSONAL',     'me_growth',    1290, 'Briefcase',           'Le mie posizioni',                   'My positions'),
  -- I miei risultati
  ('/me/performance',               'PERSONAL',     'me_results',   1300, 'Star',                'Le mie valutazioni',                 'My reviews'),
  ('/me/kpis',                      'PERSONAL',     'me_results',   1310, 'Target',              'I miei KPI',                         'My KPIs'),
  ('/me/analytics',                 'PERSONAL',     'me_results',   1320, 'ChartPie',            'Le mie analisi',                     'My analytics');

-- Il nome di ogni dashboard (titolo della pagina /dashboard/<codice>), con lo stesso termine.
DROP TABLE IF EXISTS pg_temp.barra_cruscotti;
CREATE TEMP TABLE barra_cruscotti (code text PRIMARY KEY, nome text NOT NULL);
INSERT INTO barra_cruscotti (code, nome) VALUES
  ('company',  'Dashboard Azienda'),
  ('process',  'Dashboard Processi'),
  ('org',      'Dashboard Organizzazione'),
  ('branch',   'Dashboard Filiale'),
  ('hr',       'Dashboard Direzione HR'),
  ('platform', 'Dashboard Piattaforma'),
  ('tenant',   'Dashboard Gestione del tenant'),
  ('self',     'Dashboard Self-Service');

-- --- guardia ------------------------------------------------------------------------------
DO $$
DECLARE doppie text;
BEGIN
  SELECT string_agg(ui_interface_route, ', ') INTO doppie
    FROM (SELECT ui_interface_route FROM sys.sys_ui_interfaces
           WHERE ui_interface_is_active
             AND ui_interface_route IN (SELECT route FROM barra_mappa)
           GROUP BY ui_interface_route HAVING count(*) > 1) d;
  IF doppie IS NOT NULL THEN
    RAISE EXCEPTION 'GUARDIA 000484: rotte attive duplicate (%)', doppie;
  END IF;
END $$;

-- --- giornale di ripristino (scritto una volta sola, mai sovrascritto) --------------------
CREATE TABLE IF NOT EXISTS staging.barra_laterale_000484_undo (
  oggetto     varchar(24)  NOT NULL,   -- 'ui_interface' | 'dashboard' | 'profilo_dashboard'
  chiave      varchar(160) NOT NULL,   -- ui_interface_id | dashboard_code | blueprint_content_dashboard_id
  prima       jsonb        NOT NULL,
  scritto_il  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (oggetto, chiave),
  CONSTRAINT barra_laterale_000484_undo_oggetto_check
    CHECK (oggetto IN ('ui_interface', 'dashboard', 'profilo_dashboard'))
);
COMMENT ON TABLE staging.barra_laterale_000484_undo IS
  '000484 — valori di prima del riordino della barra laterale (gruppo, sezione, ordine, icona, '
  'etichetta; nomi delle dashboard). Per tornare indietro: riportare `prima` sulle righe per chiave '
  'e emendare la 000484 (ADR-0035).';

INSERT INTO staging.barra_laterale_000484_undo (oggetto, chiave, prima)
SELECT 'ui_interface', i.ui_interface_id::text,
       jsonb_build_object('perspective', i.ui_interface_perspective,
                          'sidebar_group', i.ui_interface_sidebar_group,
                          'order', i.ui_interface_order,
                          'icon', i.ui_interface_icon,
                          'label', i.ui_interface_label)
  FROM sys.sys_ui_interfaces i
  JOIN barra_mappa m ON m.route = i.ui_interface_route
 WHERE i.ui_interface_is_active
ON CONFLICT (oggetto, chiave) DO NOTHING;

INSERT INTO staging.barra_laterale_000484_undo (oggetto, chiave, prima)
SELECT 'dashboard', d.dashboard_code, jsonb_build_object('name', d.dashboard_name)
  FROM sys.sys_dashboards d JOIN barra_cruscotti c ON c.code = d.dashboard_code
ON CONFLICT (oggetto, chiave) DO NOTHING;

INSERT INTO staging.barra_laterale_000484_undo (oggetto, chiave, prima)
SELECT 'profilo_dashboard', p.blueprint_content_dashboard_id::text,
       jsonb_build_object('name', p.blueprint_content_dashboard_name)
  FROM sys.sys_blueprint_content_dashboards p
  JOIN barra_cruscotti c ON c.code = p.blueprint_content_dashboard_code
 WHERE p.blueprint_content_dashboard_name LIKE 'Cruscotto %'
ON CONFLICT (oggetto, chiave) DO NOTHING;

-- --- la fotografia dei cancelli, per la post-condizione ------------------------------------
DROP TABLE IF EXISTS pg_temp.barra_cancelli_prima;
CREATE TEMP TABLE barra_cancelli_prima AS
SELECT ui_interface_id, ui_interface_required_resource, ui_interface_required_action,
       ui_interface_requires_admin, ui_interface_is_active
  FROM sys.sys_ui_interfaces;

-- --- (a)(b) gruppo, sezione, ordine, icona, etichetta --------------------------------------
UPDATE sys.sys_ui_interfaces i SET
  ui_interface_perspective   = m.persp,
  ui_interface_sidebar_group = m.grp,
  ui_interface_order         = m.ord,
  ui_interface_icon          = m.icon,
  ui_interface_label         = m.label
  FROM barra_mappa m
 WHERE i.ui_interface_route = m.route
   AND i.ui_interface_is_active
   AND (i.ui_interface_perspective, i.ui_interface_sidebar_group, i.ui_interface_order,
        coalesce(i.ui_interface_icon, ''), i.ui_interface_label)
       IS DISTINCT FROM (m.persp, m.grp, m.ord, m.icon, m.label);

-- --- (d) etichette inglesi -----------------------------------------------------------------
UPDATE sys.sys_reference_translations x SET text = m.label_en
  FROM sys.sys_ui_interfaces i JOIN barra_mappa m ON m.route = i.ui_interface_route
 WHERE x.entity_table = 'sys_ui_interfaces' AND x.entity_id = i.ui_interface_id
   AND x.field = 'ui_interface_label' AND x.locale = 'en'
   AND i.ui_interface_is_active
   AND x.text IS DISTINCT FROM m.label_en;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', m.label_en, 'MANUAL'
  FROM sys.sys_ui_interfaces i JOIN barra_mappa m ON m.route = i.ui_interface_route
 WHERE i.ui_interface_is_active
   AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations x
                    WHERE x.entity_table = 'sys_ui_interfaces' AND x.entity_id = i.ui_interface_id
                      AND x.field = 'ui_interface_label' AND x.locale = 'en');

-- --- (c) un termine solo: i nomi delle dashboard -------------------------------------------
UPDATE sys.sys_dashboards d SET dashboard_name = c.nome
  FROM barra_cruscotti c
 WHERE d.dashboard_code = c.code AND d.dashboard_name IS DISTINCT FROM c.nome;

UPDATE sys.sys_blueprint_content_dashboards p SET blueprint_content_dashboard_name = c.nome
  FROM barra_cruscotti c
 WHERE p.blueprint_content_dashboard_code = c.code
   AND p.blueprint_content_dashboard_name LIKE 'Cruscotto %';

-- --- post-condizione ----------------------------------------------------------------------
DO $$
DECLARE
  n_diverse int;
  n_cancelli int;
  n_me_fuori int;
  n_cruscotto int;
BEGIN
  -- ogni voce attiva della mappa porta esattamente gruppo, ordine, icona ed etichetta dichiarati
  SELECT count(*) INTO n_diverse
    FROM sys.sys_ui_interfaces i JOIN barra_mappa m ON m.route = i.ui_interface_route
   WHERE i.ui_interface_is_active
     AND (i.ui_interface_perspective, i.ui_interface_sidebar_group, i.ui_interface_order,
          coalesce(i.ui_interface_icon, ''), i.ui_interface_label)
         IS DISTINCT FROM (m.persp, m.grp, m.ord, m.icon, m.label);
  IF n_diverse <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000484: % voci non portano i valori dichiarati', n_diverse;
  END IF;

  -- ciò che NON doveva cambiare: i cancelli e lo stato attivo di TUTTE le voci
  SELECT count(*) INTO n_cancelli
    FROM sys.sys_ui_interfaces i
    FULL JOIN barra_cancelli_prima p USING (ui_interface_id)
   WHERE (i.ui_interface_required_resource, i.ui_interface_required_action,
          i.ui_interface_requires_admin, i.ui_interface_is_active)
         IS DISTINCT FROM
         (p.ui_interface_required_resource, p.ui_interface_required_action,
          p.ui_interface_requires_admin, p.ui_interface_is_active);
  IF n_cancelli <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000484: % voci hanno cambiato cancello o stato', n_cancelli;
  END IF;

  -- I17: il portale personale resta tutto in PERSONAL
  SELECT count(*) INTO n_me_fuori FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active
     AND (ui_interface_route = '/me' OR ui_interface_route LIKE '/me/%')
     AND ui_interface_perspective <> 'PERSONAL';
  IF n_me_fuori <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000484: % voci /me/* fuori dall''area personale', n_me_fuori;
  END IF;

  -- un termine solo
  SELECT count(*) INTO n_cruscotto FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active
     AND (ui_interface_label ILIKE 'console %' OR ui_interface_label ILIKE 'cruscotto%');
  IF n_cruscotto <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000484: % voci attive dicono ancora «console» o «cruscotto»', n_cruscotto;
  END IF;
END $$;
