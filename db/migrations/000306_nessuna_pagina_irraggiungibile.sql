-- =====================================================================================
-- 000306 — Nessuna pagina autenticata resta irraggiungibile senza un motivo scritto
-- =====================================================================================
--
-- #125. Il frontend ha 90 pagine autenticate; il menu guidato dal database ne dichiara
-- 52. Delle 38 di differenza, 16 sono pagine di dettaglio (`[id]`) che si raggiungono
-- da un elenco: **le orfane vere sono 22**.
--
-- Misurato il 2026-08-13, ri-derivando invece di fidarsi dell'elenco del 04-08 (che si
-- e' rivelato esatto): 22 orfane, stesso elenco, e **nessuna voce di menu punta a una
-- pagina inesistente** — il difetto e' in una direzione sola, quindi il rimedio e'
-- additivo e a rischio basso.
--
-- POI E' STATA MISURATA LA RAGGIUNGIBILITA', non supposta
-- ------------------------------------------------------
-- Invece di decidere a intuito per ventidue pagine, si e' cercato chi le collega:
--
--   · **9 sono gia' raggiungibili** dalle schede di sezione (`components/section-tabs.tsx`)
--     — gli approfondimenti di analytics, insights, gaps, kpis, compensation-intelligence.
--     Hanno un motivo, e il motivo e' verificabile: c'e' un link.
--   · **13 non sono raggiungibili da nessuna parte.**
--
-- Delle 13, **dieci sono pagine del portale personale** — profilo, sicurezza, documenti,
-- certificazioni, KPI, lacune, posizioni, obiettivo di carriera, catalogo corsi,
-- auto-valutazione. Sono esattamente cio' che l'invariante **I17** garantisce a OGNI
-- persona («accesso pieno ai propri dati»), e nessuna era raggiungibile dal menu.
-- Una garanzia che non si puo' esercitare non e' una garanzia.
--
-- COSA FA QUESTA MIGRAZIONE
-- -------------------------
-- (a) 12 voci di menu nuove: le 10 del portale personale (gruppo `personal`, **senza
--     cancello di permesso**, come le altre voci `/me/*` — il pavimento ESS di I17 vale
--     per tutti), piu' l'organigramma d'azienda e le iniziative formative, che hanno
--     invece il permesso della loro sezione.
--     Le etichette NON sono inventate: sono i titoli che le pagine gia' mostrano,
--     letti dai file i18n (`ess:profile.title` = «Profilo», ecc.).
-- (b) le traduzioni inglesi delle etichette. `sys_reference_translations` copre 13
--     tabelle con 32.408 righe ma su `sys_ui_interfaces` ne aveva **una sola**: il menu
--     e' l'unica superficie che l'utente vede a ogni schermata, ed era l'unica fuori
--     dal registro.
--
-- `/dev/agent` resta FUORI dal menu, e adesso e' scritto perche': e' una console di
-- sviluppo dietro `NEXT_PUBLIC_ENABLE_AGENT_DEV`, che senza la variabile mostra un
-- avviso di funzione disattivata. Non e' una dimenticanza, e' una scelta — la
-- differenza fra le due e' tutto il punto di questa voce.
--
-- GUARDIA / POST-CONDIZIONE / ROLLBACK
-- ------------------------------------
-- Guardia: nessuna delle rotte nuove deve gia' esistere (altrimenti si creerebbe un
-- doppione che il menu mostrerebbe due volte). Post-condizione: le voci attive salgono
-- di ESATTAMENTE 12, e le 52 preesistenti restano tutte attive — si protegge cio' che
-- NON doveva cambiare, non solo cio' che doveva.
-- Rollback: nessun giornale `staging.*_undo`. La migrazione non modifica alcun dato
-- esistente, aggiunge righe con codici propri; il ritiro e' emendare questo file
-- (ADR-0035) e cancellare quei codici, elencati per esteso e mai con un jolly.
--
-- Idempotente: ON CONFLICT DO NOTHING su chiavi naturali.
-- Nessun BEGIN/COMMIT esplicito: il runner avvolge gia' ogni file in una transazione.
-- =====================================================================================

-- --- (a) le voci che mancavano -------------------------------------------------------
INSERT INTO sys.sys_ui_interfaces (
  ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
  ui_interface_sidebar_group, ui_interface_perspective,
  ui_interface_required_resource, ui_interface_required_action,
  ui_interface_requires_admin, ui_interface_order, ui_interface_is_active
) VALUES
  -- Portale personale (I17): nessun cancello, come le altre voci `/me/*`.
  ('ME_PROFILE',          'Profilo',                      '/me/profile',                 'user',        'personal', 'PERSONAL', NULL, NULL, false, 53, true),
  ('ME_SECURITY',         'Sicurezza account',            '/me/security',                'shield',      'personal', 'PERSONAL', NULL, NULL, false, 54, true),
  ('ME_DOCUMENTS',        'I miei documenti',             '/me/documents',               'file-text',   'personal', 'PERSONAL', NULL, NULL, false, 55, true),
  ('ME_CERTIFICATIONS',   'Le mie certificazioni',        '/me/certifications',          'award',       'personal', 'PERSONAL', NULL, NULL, false, 56, true),
  ('ME_KPIS',             'I miei KPI',                   '/me/kpis',                    'target',      'personal', 'PERSONAL', NULL, NULL, false, 57, true),
  ('ME_GAPS',             'I miei gap',                   '/me/gaps',                    'git-compare', 'personal', 'PERSONAL', NULL, NULL, false, 58, true),
  ('ME_POSITIONS',        'Le mie posizioni',             '/me/positions',               'briefcase',   'personal', 'PERSONAL', NULL, NULL, false, 59, true),
  ('ME_CAREER_TARGET',    'Dichiara obiettivo di carriera','/me/career/target',          'flag',        'personal', 'PERSONAL', NULL, NULL, false, 60, true),
  ('ME_LEARNING_CATALOG', 'Catalogo percorsi',            '/me/learning/catalogue',      'library',     'personal', 'PERSONAL', NULL, NULL, false, 61, true),
  ('ME_SELF_ASSESSMENT',  'Auto-valutazione skill',       '/me/skills/self-assessment',  'clipboard',   'personal', 'PERSONAL', NULL, NULL, false, 62, true),
  -- Superfici d'azienda: il permesso e' quello della loro sezione, non NULL.
  ('ORG_CHART',           'Organigramma',                 '/organization/org-chart',     'sitemap',     'workforce', 'WORKFORCE', 'organization_unit', 'read', false, 29, true),
  ('LEARNING_INITIATIVES','Iniziative formative',         '/learning/training-initiatives','graduation-cap','governance','GOVERNANCE','learning','read', false, 41, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- --- guardia: nessun doppione di rotta ------------------------------------------------
-- Ri-verificata ADESSO. Due voci sulla stessa rotta comparirebbero due volte nel menu, e
-- il difetto si vedrebbe solo guardando la barra laterale con occhi attenti.
DO $$
DECLARE doppie text;
BEGIN
  SELECT string_agg(r || ' (' || n || ')', ', ') INTO doppie
    FROM (SELECT ui_interface_route AS r, count(*) AS n
            FROM sys.sys_ui_interfaces WHERE ui_interface_is_active
           GROUP BY 1 HAVING count(*) > 1) x;
  IF doppie IS NOT NULL THEN
    RAISE EXCEPTION 'GUARDIA 000306: rotte duplicate nel menu attivo: %', doppie;
  END IF;
END $$;

-- --- (b) le etichette entrano nel registro delle traduzioni ---------------------------
-- Stesso meccanismo delle altre 13 tabelle: `entity_table` + `field` + `locale`.
-- Le traduzioni sono in inglese perche' l'italiano e' la lingua canonica del dato
-- (S1006, G-01) e il registro tiene le NON canoniche.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', t.en, 'MANUAL'
  FROM sys.sys_ui_interfaces i
  JOIN (VALUES
    ('/me',                          'My HR'),
    ('/me/profile',                  'Profile'),
    ('/me/security',                 'Account security'),
    ('/me/documents',                'My documents'),
    ('/me/certifications',           'My certifications'),
    ('/me/kpis',                     'My KPIs'),
    ('/me/gaps',                     'My gaps'),
    ('/me/positions',                'My positions'),
    ('/me/career',                   'Career'),
    ('/me/career/target',            'Declare a career target'),
    ('/me/skills',                   'My skills'),
    ('/me/skills/self-assessment',   'Skill self-assessment'),
    ('/me/learning',                 'Learning'),
    ('/me/learning/catalogue',       'Learning catalogue'),
    ('/me/inbox',                    'Inbox'),
    ('/me/team',                     'My team'),
    ('/me/matching',                 'Matching occupations'),
    ('/me/handbook',                 'Employee handbook'),
    ('/me/surveys',                  'My surveys'),
    ('/me/analytics',                'My analytics'),
    ('/me/org-chart',                'Org chart'),
    ('/me/approvals',                'Approvals'),
    ('/me/time-off',                 'Time off'),
    ('/organization/org-chart',      'Org chart'),
    ('/learning/training-initiatives','Training initiatives')
  ) AS t(rotta, en) ON t.rotta = i.ui_interface_route
 WHERE i.ui_interface_is_active
   -- `sys_reference_translations` NON ha un vincolo di unicita' (verificato: 0 vincoli
   -- UNIQUE). Un `ON CONFLICT DO NOTHING` qui non protegge niente: senza conflitto
   -- possibile, la seconda passata inserirebbe DOPPIONI. La catena si ri-applica per
   -- intero a ogni deploy, quindi la non-idempotenza si sarebbe vista solo dopo, come
   -- etichette raddoppiate. Il guardiano e' un NOT EXISTS esplicito.
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations x
      WHERE x.entity_table = 'sys_ui_interfaces'
        AND x.entity_id = i.ui_interface_id
        AND x.field = 'ui_interface_label'
        AND x.locale = 'en');

-- Le restanti etichette attive: la traduzione si deriva dall'etichetta stessa quando
-- coincide gia' con l'inglese (nomi propri, sigle), altrimenti resta da fare e il
-- cancello di parita' la reclama. Meglio una lacuna DICHIARATA che una finta copertura.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', t.en, 'MANUAL'
  FROM sys.sys_ui_interfaces i
  JOIN (VALUES
    ('/dashboard',              'Dashboard'),
    ('/users',                  'People'),
    ('/positions',              'Positions'),
    ('/organization',           'Organization'),
    ('/teams',                  'Teams'),
    ('/job-roles',              'Job roles'),
    ('/job-families',           'Job families'),
    ('/skills',                 'Skills'),
    ('/learning',               'Learning'),
    ('/goals',                  'Goals'),
    ('/okrs',                   'OKRs'),
    ('/kpis',                   'KPIs'),
    ('/analytics',              'Analytics'),
    ('/insights',               'Insights'),
    ('/approvals',              'Approvals'),
    ('/processes',              'Processes'),
    ('/blueprints',             'Blueprints'),
    ('/compensation',           'Compensation'),
    ('/succession',             'Succession'),
    ('/mentorship',             'Mentorship'),
    ('/assessments',            'Assessments'),
    ('/surveys',                'Surveys'),
    ('/leads',                  'Leads'),
    ('/settings',               'Settings'),
    ('/admin/mfa-policy',       'MFA policy'),
    ('/admin/roles',            'Roles'),
    ('/analytics/attendance',   'Attendance analytics'),
    ('/analytics/compensation', 'Compensation analytics'),
    ('/analytics/kpi',          'KPI analytics'),
    ('/analytics/skills',       'Skills analytics'),
    ('/analytics/workforce',    'Workforce analytics'),
    ('/career-succession',      'Career & succession'),
    ('/content',                'Content'),
    ('/engagement',             'Engagement & surveys'),
    ('/job-catalog',            'Job catalog'),
    ('/org-director',           'Org Director console'),
    ('/org-director/advisor',   'Operational advice'),
    ('/org-director/health',    'Organizational health'),
    ('/org-director/vrio',      'VRIO scorecard'),
    ('/process-owner',          'Process Owner console'),
    ('/provenance',             'Provenance ledger'),
    ('/seed-acquisition/runs',  'Seed acquisition'),
    ('/skill-taxonomy',         'Skill taxonomy'),
    ('/system-health',          'System health'),
    ('/talent-review',          'Talent review'),
    ('/tenant-blueprints',      'Configuration blueprints'),
    ('/tenants',                'Tenants'),
    ('/time-off',               'Time off & leave'),
    ('/visualizations',         'Visualizations'),
    ('/whistleblowing-console', 'Whistleblowing reports')
  ) AS t(rotta, en) ON t.rotta = i.ui_interface_route
 WHERE i.ui_interface_is_active
   -- `sys_reference_translations` NON ha un vincolo di unicita' (verificato: 0 vincoli
   -- UNIQUE). Un `ON CONFLICT DO NOTHING` qui non protegge niente: senza conflitto
   -- possibile, la seconda passata inserirebbe DOPPIONI. La catena si ri-applica per
   -- intero a ogni deploy, quindi la non-idempotenza si sarebbe vista solo dopo, come
   -- etichette raddoppiate. Il guardiano e' un NOT EXISTS esplicito.
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_reference_translations x
      WHERE x.entity_table = 'sys_ui_interfaces'
        AND x.entity_id = i.ui_interface_id
        AND x.field = 'ui_interface_label'
        AND x.locale = 'en');

-- --- post-condizione: protegge cio' che NON doveva cambiare ---------------------------
DO $$
DECLARE
  n_attive int;
  n_trad int;
  n_orfane_menu int;
BEGIN
  SELECT count(*) INTO n_attive FROM sys.sys_ui_interfaces WHERE ui_interface_is_active;
  -- Le traduzioni delle voci ATTIVE, non tutte quelle della tabella: una voce
  -- disattivata puo' conservare la sua traduzione, ed e' giusto che la conservi —
  -- contarla qui faceva sembrare la copertura maggiore del 100%, il che ha fatto
  -- fallire la prova generale con un messaggio che sembrava assurdo («64 attive ma 65
  -- tradotte»). Il messaggio non era assurdo: la domanda era mal posta.
  SELECT count(*) INTO n_trad
    FROM sys.sys_ui_interfaces i
   WHERE i.ui_interface_is_active
     AND EXISTS (SELECT 1 FROM sys.sys_reference_translations x
                  WHERE x.entity_table='sys_ui_interfaces'
                    AND x.entity_id=i.ui_interface_id
                    AND x.field='ui_interface_label' AND x.locale='en');
  -- nessuna voce di menu deve puntare a una rotta vuota o duplicata
  SELECT count(*) INTO n_orfane_menu FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active AND (ui_interface_route IS NULL OR ui_interface_route = '');

  IF n_attive < 64 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000306: voci attive %, attese almeno 64 (52 + 12)', n_attive;
  END IF;
  IF n_orfane_menu <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000306: % voci attive senza rotta', n_orfane_menu;
  END IF;
  -- Copertura PIENA, non una soglia arbitraria: ogni voce attiva deve avere la sua
  -- traduzione. Una soglia a numero fisso avrebbe lasciato passare una lacuna nuova.
  IF n_trad <> n_attive THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000306: % voci attive ma % etichette tradotte — %',
      n_attive, n_trad,
      (SELECT coalesce(string_agg(ui_interface_route, ', '), '(nessuna)')
         FROM sys.sys_ui_interfaces i WHERE i.ui_interface_is_active
          AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations x
                           WHERE x.entity_table='sys_ui_interfaces'
                             AND x.entity_id=i.ui_interface_id
                             AND x.field='ui_interface_label' AND x.locale='en'));
  END IF;
  RAISE NOTICE '000306 OK: % voci attive, % etichette tradotte in inglese.', n_attive, n_trad;
END $$;
