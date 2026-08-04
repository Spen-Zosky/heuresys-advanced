-- ═══════════════════════════════════════════════════════════════════════════════
-- 000247_organization_unit_managers.sql
--
-- FASE 4 della ricostruzione dell'organigramma — LE NOMINE.
--
-- Chiude il difetto piu grave dell'organigramma: 4 persone reggevano 15 unita, e
-- 11 unita non avevano un capo proprio. Dopo questa fase ogni unita ha il suo
-- responsabile, e ogni responsabile una sola unita — con una sola eccezione,
-- voluta e dichiarata: la CEO regge la societa E la Direzione Generale, perche' le
-- due cariche coincidono (decisione di Enzo, caso «CEO = DG»).
--
-- Il criterio delle nomine non e' discrezionale: viene dall'INQUADRAMENTO
-- CONTRATTUALE reale. I contratti dicono 10 Dirigenti, 24 Quadri Direttivi e 126
-- nelle aree professionali; l'organigramma chiede 10 posizioni di vertice e 24
-- ruoli di responsabilita intermedia. I due numeri coincidono, quindi
-- l'inquadramento E' la mappa delle nomine. Le mansioni dichiarate fanno il resto:
-- chi ha il titolo di «Head of Treasury» va alla Tesoreria.
--
-- Che cosa NON fa: nessuna persona cambia posizione, nessuna posizione cambia
-- unita. Le 161 assegnazioni restano 161. Lo spostamento delle persone e' la
-- fase 5.
--
-- Prerequisiti: 000244, 000245, 000246 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. LIBERARE LE DUE UNITA' IN ATTESA DI SCIOGLIMENTO
--    «Divisione Risk & Compliance» era il contenitore improprio delle funzioni di
--    controllo, che alla fase 3 sono uscite in staff: resta un guscio con 38
--    posizioni, e la sua responsabile (alice.esposito, Chief Risk Officer) va dove
--    le compete, cioe alla Direzione Risk Management. «Direzione Corporate
--    Banking» non esiste nel disegno target.
--    Entrambe verranno sciolte alla fase 6, quando le persone si saranno mosse.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_manager_user_id = NULL,
       updated_at                        = now()
 WHERE organization_unit_code IN ('DIV-RISK', 'DIR-CORP');

-- ───────────────────────────────────────────────────────────────────────────────
-- B. LE 29 NOMINE
--    Un solo UPDATE, con le persone risolte per email e le unita per codice: lo
--    script non contiene identificativi scritti a mano.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units AS ou
   SET organization_unit_manager_user_id =
         (SELECT user_id FROM sys.sys_users WHERE user_email = n.email || '@rtl-bank.org'),
       updated_at = now()
  FROM (VALUES
    -- ── il vertice: le due cariche coincidono ────────────────────────────────
    ('DG',              'federica.marchetti'),  -- CEO = Direttore Generale

    -- ── staff al CEO ─────────────────────────────────────────────────────────
    ('DIR-RISKM',       'alice.esposito'),      -- Chief Risk Officer, dal 2006
    ('DIR-LEGAL',       'roberta.benedetti'),   -- 3A4L, val 3,8, 9 anni in compliance
    -- (Internal Audit -> matteo.lombardi, Compliance -> andrea.martino e
    --  Antiriciclaggio -> marco.desantis sono gia corretti: non si toccano)

    -- ── divisione senza responsabile adeguato ────────────────────────────────
    ('DIV-CFO',         'federica.derosa'),     -- Dirigente «Finance Director», oggi senza unita
                                                -- (sostituisce marco.rinaldi, inquadrato 3A3L)

    -- ── governo della rete ───────────────────────────────────────────────────
    ('DIR-COORD',       'riccardo.martini'),    -- QD3, da «Bank Manager» senza filiale
    ('DIR-RETE',        'olivia.villa'),        -- QD3, idem

    -- ── crediti ──────────────────────────────────────────────────────────────
    ('DIR-CREDITI',     'claudia.serra'),       -- QD4 «Head of Commercial Banking», oggi senza unita
    ('DIR-MONIT',       'filippo.galli'),       -- 3A4L promosso, val 4,0, Diritto Commerciale
    ('UFF-CRED-PMI',    'cristina.lombardi'),   -- QD3, da «Bank Manager»
    ('UFF-CRED-RETAIL', 'luca.leone'),          -- QD3, idem

    -- ── operations ───────────────────────────────────────────────────────────
    ('DIR-BACKOFF',     'roberta.caputo'),      -- 3A3L promossa, val 4,9, Ing. Gestionale
    ('DIR-PAY',         'giuseppe.ferri'),      -- QD3 «Line Manager - Operations», val 4,2

    -- ── informatica ──────────────────────────────────────────────────────────
    ('DIR-INFRA',       'alice.costa'),         -- 3A4L promossa, System Administrator
    ('DIR-DEV',         'pietro.gallo'),        -- 3A4L promosso, val 4,0

    -- ── finanza ──────────────────────────────────────────────────────────────
    ('DIR-BILAN',       'martina.sala'),        -- 3A3L promossa, val 4,0
    -- (Tesoreria -> benedetta.cattaneo, QD4 «Head of Treasury»: gia corretto)

    -- ── risorse umane ────────────────────────────────────────────────────────
    ('UFF-PERS',        'maria.colombo'),       -- QD3 «HR Manager», val 3,6
    ('UFF-ORG',         'paolo.barbieri'),      -- 3A4L promosso, Diritto

    -- ── le due aree territoriali ─────────────────────────────────────────────
    ('AREA-MI',         'xenia.leone'),         -- QD3, dal 2009, val 4,9: la piu anziana fra i milanesi
    ('AREA-BSBG',       'marta.pellegrini'),    -- QD3, Brescia, val 4,9

    -- ── le 10 filiali: un direttore ciascuna, per residenza e valutazione ────
    ('FIL-MI-CEN',      'cristina.gatti'),      -- QD3, Milano, val 4,9 — hub principale
    ('FIL-MI-PRO',      'daniela.fabbri'),      -- QD3, Milano, val 4,8
    ('FIL-MI-SEM',      'gabriele.santoro'),    -- QD3, Milano, val 4,1
    ('FIL-MI-SSG',      'martina.santoro'),     -- QD3, Milano, val 3,2
    ('FIL-MB-MON',      'alessandro.gatti'),    -- QD3, RESIDENTE A MONZA, dal 2008, val 4,9
    ('FIL-CO-CEN',      'elisa.monti'),         -- 3A4L promossa, residente a Como
    ('FIL-VA-CEN',      'tommaso.fiore'),       -- 3A4L promosso, residente a Varese, val 4,2
    ('FIL-BS-CEN',      'cristina.costa'),      -- QD3, Brescia, dal 2007 — hub
    ('FIL-BG-CEN',      'marta.greco'),         -- QD3, Bergamo — hub
    ('FIL-BG-DAL',      'alberto.serra')        -- 3A4L promosso, residente a Bergamo
  ) AS n(codice, email)
 WHERE ou.organization_unit_code = n.codice;

-- ───────────────────────────────────────────────────────────────────────────────
-- C. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_con_capo int; n_senza int; n_distinti int; n_condiviso int;
  n_assegn int; n_nulli int; n_ceo int;
BEGIN
  SELECT count(*) INTO n_con_capo FROM sys.sys_organization_units
   WHERE organization_unit_manager_user_id IS NOT NULL;
  IF n_con_capo <> 43 THEN
    RAISE EXCEPTION 'Unita con responsabile: attese 43 su 45, trovate %', n_con_capo;
  END IF;

  -- le due senza capo sono, e devono essere, quelle in attesa di scioglimento
  SELECT count(*) INTO n_senza FROM sys.sys_organization_units
   WHERE organization_unit_manager_user_id IS NULL
     AND organization_unit_code NOT IN ('DIV-RISK', 'DIR-CORP');
  IF n_senza <> 0 THEN
    RAISE EXCEPTION 'Unita senza responsabile diverse dalle 2 attese: %', n_senza;
  END IF;

  -- nessuna nomina e finita a NULL per un'email sbagliata
  SELECT count(*) INTO n_nulli FROM sys.sys_organization_units
   WHERE organization_unit_manager_user_id IS NULL
     AND organization_unit_code IN (
       'DG','DIR-RISKM','DIR-LEGAL','DIV-CFO','DIR-COORD','DIR-RETE','DIR-CREDITI',
       'DIR-MONIT','UFF-CRED-PMI','UFF-CRED-RETAIL','DIR-BACKOFF','DIR-PAY',
       'DIR-INFRA','DIR-DEV','DIR-BILAN','UFF-PERS','UFF-ORG','AREA-MI','AREA-BSBG',
       'FIL-MI-CEN','FIL-MI-PRO','FIL-MI-SEM','FIL-MI-SSG','FIL-MB-MON','FIL-CO-CEN',
       'FIL-VA-CEN','FIL-BS-CEN','FIL-BG-CEN','FIL-BG-DAL');
  IF n_nulli <> 0 THEN
    RAISE EXCEPTION 'Nomine non risolte (email inesistente?): % unita', n_nulli;
  END IF;

  -- un responsabile, una sola unita: l'unica eccezione e la CEO su societa e DG
  SELECT count(DISTINCT organization_unit_manager_user_id) INTO n_distinti
    FROM sys.sys_organization_units WHERE organization_unit_manager_user_id IS NOT NULL;
  IF n_distinti <> 42 THEN
    RAISE EXCEPTION 'Responsabili distinti: attesi 42 (43 unita meno la CEO che ne regge 2), trovati %', n_distinti;
  END IF;

  SELECT count(*) INTO n_condiviso
    FROM sys.v_organization_unit_integrity WHERE responsabile_condiviso;
  IF n_condiviso <> 2 THEN
    RAISE EXCEPTION 'Responsabili condivisi: attesi 2 (societa e Direzione Generale, entrambe della CEO), trovati %', n_condiviso;
  END IF;

  -- e le due unita condivise sono proprio quelle, non altre
  SELECT count(*) INTO n_ceo FROM sys.sys_organization_units
   WHERE organization_unit_code IN ('RTL','DG')
     AND organization_unit_manager_user_id =
         (SELECT user_id FROM sys.sys_users WHERE user_email='federica.marchetti@rtl-bank.org');
  IF n_ceo <> 2 THEN
    RAISE EXCEPTION 'La CEO deve reggere societa e Direzione Generale: trovate % su 2', n_ceo;
  END IF;

  -- nessuna persona spostata
  SELECT count(*) INTO n_assegn FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_assegn <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate, trovate %', n_assegn;
  END IF;

  RAISE NOTICE 'FASE 4 OK — 43 unita su 45 con responsabile proprio, 42 responsabili distinti, unico caso multiplo la CEO su societa e Direzione Generale. Da 4 capi per 15 unita a 1 capo per 1 unita. 161 assegnazioni invariate.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) il difetto chiuso: nessuno regge piu unita, tranne la CEO
--    SELECT u.user_email, count(*) AS unita_rette,
--           string_agg(ou.organization_unit_name, ' + ' ORDER BY ou.organization_unit_name) AS quali
--      FROM sys.sys_organization_units ou
--      JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
--     GROUP BY 1 HAVING count(*) != 1;
--    atteso: UNA sola riga — federica.marchetti con «Direzione Generale + RTL Bank S.p.A.»
--    (prima erano quattro righe: paolo.caputo 5, sergio.caputo 4, luca.bianchi 3, quintino.bellini 3)
--
-- 2) l'inquadramento dei responsabili: i vertici sono dirigenti, i capi intermedi quadri
--    SELECT c.user_contract_ccnl_level, count(*)
--      FROM sys.sys_organization_units ou
--      JOIN sys.sys_users u ON u.user_id = ou.organization_unit_manager_user_id
--      LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
--     GROUP BY 1 ORDER BY 2 DESC;
--    Le promozioni (3A3L/3A4L a capo di un'unita) sono 8 e vanno formalizzate come
--    passaggi di inquadramento: e' una decisione HR, non una migrazione.
--
-- 3) cosa resta aperto
--    SELECT count(*) FILTER (WHERE senza_responsabile)   AS senza_capo,     -- 2 (in attesa di scioglimento)
--           count(*) FILTER (WHERE responsabile_esterno) AS capo_esterno    -- alto: si chiude in fase 5
--      FROM sys.v_organization_unit_integrity;
--    «capo_esterno» resta alto di proposito: un responsabile risulta esterno finche' la sua
--    POSIZIONE non viene spostata nell'unita che dirige, e le posizioni si muovono in fase 5.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   -- rimette i quattro capi condivisi e azzera le 17 unita nuove
--   UPDATE sys.sys_organization_units AS ou
--      SET organization_unit_manager_user_id =
--            (SELECT user_id FROM sys.sys_users WHERE user_email = r.email || '@rtl-bank.org')
--     FROM (VALUES ('DIV-RISK','alice.esposito'), ('DIR-CORP','paolo.caputo'),
--                  ('DIR-CREDITI','paolo.caputo'), ('UFF-CRED-PMI','paolo.caputo'),
--                  ('UFF-CRED-RETAIL','paolo.caputo'), ('FIL-MI-CEN','sergio.caputo'),
--                  ('FIL-BS-CEN','sergio.caputo'), ('FIL-BG-CEN','sergio.caputo'),
--                  ('DIR-BACKOFF','luca.bianchi'), ('DIR-PAY','luca.bianchi'),
--                  ('DIR-INFRA','quintino.bellini'), ('DIR-DEV','quintino.bellini'),
--                  ('DIV-CFO','marco.rinaldi')) AS r(codice,email)
--    WHERE ou.organization_unit_code = r.codice;
--   UPDATE sys.sys_organization_units SET organization_unit_manager_user_id = NULL
--    WHERE organization_unit_code IN ('DG','DIR-LEGAL','DIR-COORD','DIR-RETE','DIR-MONIT',
--          'DIR-BILAN','UFF-PERS','UFF-ORG','AREA-MI','AREA-BSBG','FIL-MI-PRO','FIL-MI-SEM',
--          'FIL-MI-SSG','FIL-MB-MON','FIL-CO-CEN','FIL-VA-CEN','FIL-BG-DAL');
--   UPDATE sys.sys_organization_units
--      SET organization_unit_manager_user_id =
--            (SELECT user_id FROM sys.sys_users WHERE user_email='alice.esposito@rtl-bank.org')
--    WHERE organization_unit_code = 'DIR-RISKM';
-- COMMIT;
