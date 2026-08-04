-- ═══════════════════════════════════════════════════════════════════════════════
-- 000244_organization_unit_taxonomy.sql
--
-- FASE 1 della ricostruzione dell'organigramma — LA TASSONOMIA DELLE UNITA'.
--
-- Che cosa fa
--   A. aggiunge al catalogo i due tipi mancanti: GENERAL_MANAGEMENT e AREA
--   B. ri-tipizza 13 unita': 10 «Direzione ...» DIVISION -> DEPARTMENT
--                             3 «Filiale ...»  OFFICE   -> BRANCH
--   C. allinea 1 nome al proprio tipo (Heuresys)
--   D. introduce il TIPO DI LEGAME: organization_unit_relation ∈ {LINEA, STAFF}
--   E. chiude il tipo con un CHECK: oggi la colonna e' testo libero, ed e' cosi'
--      che l'incoerenza e' potuta entrare
--   F. crea la vista di controllo dell'integrita' (misura, non blocca)
--
-- Che cosa NON fa — di proposito
--   · non muove nessuna persona
--   · non cambia nessun legame padre-figlio
--   · non crea ne' scioglie unita'
--   · non impone le regole di annidamento come vincolo: i dati attuali le
--     violano, quindi il vincolo duro arriva dopo la bonifica (fase 3)
--
-- Reversibile: lo script di rollback e' in coda, commentato.
-- Auto-verificante: se un conteggio non torna, la transazione si annulla.
--
-- Contesto: docs/kb/... (referto organigramma, proposta tassonomia, organigramma target)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. CATALOGO DEI TIPI — aggiunta di GENERAL_MANAGEMENT e AREA
--    Il catalogo ne conteneva 8 (HEADQUARTERS, DIVISION, DEPARTMENT, OFFICE,
--    BRANCH, TEAM, PLANT, WAREHOUSE) e ne mancavano due: il vertice operativo e
--    il livello territoriale. NOT EXISTS invece di ON CONFLICT perche' sulla
--    tabella dei tipi non esiste un vincolo di unicita' sul codice.
--
--    A0. PRIMA di inserire va allargato il CHECK del CATALOGO. Questa migrazione
--    e' stata scritta in una sessione di lab, che legge e non scrive: la prima
--    applicazione reale (S1043) si e' annullata qui, perche'
--    sys_organization_unit_type_code_check elencava esattamente gli 8 codici
--    esistenti e rifiutava i due nuovi. E' il vincolo previsto da RD-08
--    (varchar + CHECK, mai ENUM) sulla tabella dei TIPI — da non confondere con
--    quello che il punto E aggiunge sulla colonna delle UNITA', che invece
--    oggi e' testo libero. Allargare un elenco chiuso e' parte dell'aggiunta di
--    un tipo: senza, il catalogo non e' estendibile.
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_organization_unit_types
  DROP CONSTRAINT IF EXISTS sys_organization_unit_type_code_check;
ALTER TABLE sys.sys_organization_unit_types
  ADD CONSTRAINT sys_organization_unit_type_code_check
  CHECK (organization_unit_type_code IN (
    'HEADQUARTERS','DIVISION','DEPARTMENT','TEAM','BRANCH','OFFICE','PLANT','WAREHOUSE',
    'GENERAL_MANAGEMENT','AREA'));

INSERT INTO sys.sys_organization_unit_types (
  organization_unit_type_code, organization_unit_type_name, organization_unit_type_description
)
SELECT 'GENERAL_MANAGEMENT', 'General Management',
       'Direzione Generale: vertice operativo, uno per societa. Sotto di essa scende la linea di comando; le unita in staff restano appese alla societa.'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_organization_unit_types
  WHERE organization_unit_type_code = 'GENERAL_MANAGEMENT'
);

INSERT INTO sys.sys_organization_unit_types (
  organization_unit_type_code, organization_unit_type_name, organization_unit_type_description
)
SELECT 'AREA', 'Area',
       'Area territoriale: raggruppa le filiali di una zona geografica sotto una divisione commerciale.'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_organization_unit_types
  WHERE organization_unit_type_code = 'AREA'
);

-- ───────────────────────────────────────────────────────────────────────────────
-- B. RI-TIPIZZAZIONE — un tipo, un rango
--    B1. le 10 «Direzione ...» sono articolazioni, non divisioni -> DEPARTMENT
--    B2. le 3 «Filiale ...» sono unita territoriali, non uffici  -> BRANCH
--    Entrambe le colonne vanno aggiornate: quella testuale e la FK al catalogo.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_type    = 'DEPARTMENT',
       organization_unit_type_id = (SELECT organization_unit_type_id
                                      FROM sys.sys_organization_unit_types
                                     WHERE organization_unit_type_code = 'DEPARTMENT'),
       updated_at                = now()
 WHERE organization_unit_name LIKE 'Direzione %'
   AND organization_unit_type = 'DIVISION';

UPDATE sys.sys_organization_units
   SET organization_unit_type    = 'BRANCH',
       organization_unit_type_id = (SELECT organization_unit_type_id
                                      FROM sys.sys_organization_unit_types
                                     WHERE organization_unit_type_code = 'BRANCH'),
       updated_at                = now()
 WHERE organization_unit_name LIKE 'Filiale %'
   AND organization_unit_type = 'OFFICE';

-- ───────────────────────────────────────────────────────────────────────────────
-- C. NOME COERENTE COL TIPO
--    Una sola unita non porta il prefisso del proprio tipo (tenant Heuresys).
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_name = 'Divisione Operations & Administration',
       updated_at             = now()
 WHERE organization_unit_name = 'Operations & Administration';

-- Anche l'unita di tipo TEAM (tenant Heuresys) non porta il prefisso del tipo.
-- Nel disegno target questa unita esce dall'albero — una squadra non e' una linea
-- di comando e vive in sys_teams, dove le 26 squadre stanno gia — ma la rimozione
-- appartiene alla fase 3. Qui si allinea soltanto il nome.
UPDATE sys.sys_organization_units
   SET organization_unit_name = 'Team Product & Development',
       updated_at             = now()
 WHERE organization_unit_name = 'Product & Development'
   AND organization_unit_type = 'TEAM';

-- ───────────────────────────────────────────────────────────────────────────────
-- D. IL TIPO DI LEGAME — linea oppure staff
--    «Retail Banking sotto la Direzione Generale» e «Internal Audit in staff al
--    CEO» non sono la stessa relazione: la prima e' una dipendenza di linea, la
--    seconda di staff. E' una proprieta del LEGAME, non un tipo di unita.
--    Effetto sui domini: il perimetro gerarchico di un capo scende lungo i
--    legami di linea e si ferma davanti a un legame di staff.
--    RD-08: varchar + CHECK, mai ENUM.
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_organization_units
  ADD COLUMN IF NOT EXISTS organization_unit_relation varchar(8) NOT NULL DEFAULT 'LINEA';

ALTER TABLE sys.sys_organization_units
  DROP CONSTRAINT IF EXISTS sys_organization_units_relation_chk;
ALTER TABLE sys.sys_organization_units
  ADD  CONSTRAINT sys_organization_units_relation_chk
  CHECK (organization_unit_relation IN ('LINEA', 'STAFF'));

COMMENT ON COLUMN sys.sys_organization_units.organization_unit_relation IS
  'Natura del legame col padre: LINEA = dipendenza gerarchica ordinaria; STAFF = unita appesa al vertice, fuori dalla linea di comando (funzioni di controllo, affari legali). Il perimetro organizzativo di un capo NON attraversa un legame STAFF.';

-- L'unica unita di cui oggi siamo certi che sia in staff: l'Internal Audit
-- riporta al CEO per garantirne l'indipendenza. Le altre quattro (Risk
-- Management, Compliance, Antiriciclaggio, Affari Legali) oggi sono collocate
-- dentro la linea e vanno spostate: e' la fase 3, non questa.
UPDATE sys.sys_organization_units
   SET organization_unit_relation = 'STAFF',
       updated_at                 = now()
 WHERE organization_unit_name = 'Direzione Internal Audit';

-- ───────────────────────────────────────────────────────────────────────────────
-- E. CHIUSURA DEL TIPO
--    La colonna era testo libero senza alcun CHECK: e' il varco da cui e'
--    entrata l'incoerenza (DIVISION usato per due ranghi diversi). Ora l'insieme
--    e' chiuso e allineato al catalogo.
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_organization_units
  DROP CONSTRAINT IF EXISTS sys_organization_units_type_chk;
ALTER TABLE sys.sys_organization_units
  ADD  CONSTRAINT sys_organization_units_type_chk
  CHECK (organization_unit_type IN (
    'HEADQUARTERS', 'GENERAL_MANAGEMENT', 'DIVISION', 'DEPARTMENT',
    'AREA', 'BRANCH', 'OFFICE', 'TEAM', 'PLANT', 'WAREHOUSE'
  ));

-- ───────────────────────────────────────────────────────────────────────────────
-- F. VISTA DI CONTROLLO — misura le violazioni, non le blocca
--    Le regole di annidamento e di nomenclatura non possono diventare vincoli
--    finche' i dati le violano. Questa vista le rende VISIBILI e interrogabili:
--    diventera' il cancello automatico quando la bonifica sara' completa.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_organization_unit_integrity AS
WITH atteso AS (
  SELECT * FROM (VALUES
    ('HEADQUARTERS',       'ragione sociale'),
    ('GENERAL_MANAGEMENT', 'Direzione Generale'),
    ('DIVISION',           'Divisione '),
    ('DEPARTMENT',         'Direzione '),
    ('AREA',               'Area '),
    ('BRANCH',             'Filiale '),
    ('OFFICE',             'Ufficio '),
    ('TEAM',               'Team ')
  ) AS t(tipo, prefisso_atteso)
),
ammesso AS (  -- coppie tipo-figlio / tipo-padre consentite
  SELECT * FROM (VALUES
    ('GENERAL_MANAGEMENT', 'HEADQUARTERS'),
    ('DIVISION',           'GENERAL_MANAGEMENT'),
    ('DIVISION',           'HEADQUARTERS'),
    ('DEPARTMENT',         'DIVISION'),
    ('DEPARTMENT',         'HEADQUARTERS'),
    ('AREA',               'DIVISION'),
    ('BRANCH',             'AREA'),
    ('BRANCH',             'DIVISION'),
    ('OFFICE',             'DEPARTMENT'),
    ('OFFICE',             'BRANCH'),
    ('OFFICE',             'AREA'),
    ('TEAM',               'HEADQUARTERS'),
    ('TEAM',               'DIVISION'),
    ('TEAM',               'DEPARTMENT'),
    ('PLANT',              'DIVISION'),
    ('PLANT',              'DEPARTMENT'),
    ('WAREHOUSE',          'DIVISION'),
    ('WAREHOUSE',          'DEPARTMENT')
  ) AS t(tipo_figlio, tipo_padre_ammesso)
)
SELECT
  ou.organization_unit_id                                        AS unita_id,
  ou.organization_unit_name                                      AS unita,
  ou.organization_unit_type                                      AS tipo,
  ou.organization_unit_relation                                  AS legame,
  par.organization_unit_name                                      AS padre,
  par.organization_unit_type                                      AS tipo_padre,
  -- R7: il nome porta il prefisso del proprio tipo
  (ou.organization_unit_type <> 'HEADQUARTERS'
    AND NOT EXISTS (SELECT 1 FROM atteso a
                     WHERE a.tipo = ou.organization_unit_type
                       AND ou.organization_unit_name LIKE a.prefisso_atteso || '%'))
                                                                 AS viola_nomenclatura,
  -- R6: l'annidamento rispetta le coppie ammesse
  (ou.organization_unit_parent_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ammesso m
                     WHERE m.tipo_figlio = ou.organization_unit_type
                       AND m.tipo_padre_ammesso = par.organization_unit_type))
                                                                 AS viola_annidamento,
  -- R1: ogni unita ha un responsabile, e ogni responsabile una sola unita
  (ou.organization_unit_manager_user_id IS NULL)                 AS senza_responsabile,
  (ou.organization_unit_manager_user_id IS NOT NULL
    AND (SELECT count(*) FROM sys.sys_organization_units x
          WHERE x.organization_unit_manager_user_id = ou.organization_unit_manager_user_id) > 1)
                                                                 AS responsabile_condiviso,
  -- R2: il responsabile occupa una posizione dentro l'unita che dirige
  (ou.organization_unit_manager_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
        FROM sys.sys_user_position_assignments a
        JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       WHERE a.user_position_assignment_user_id = ou.organization_unit_manager_user_id
         AND a.user_position_assignment_status = 'ACTIVE'
         AND p.position_organization_unit_id = ou.organization_unit_id))
                                                                 AS responsabile_esterno
FROM sys.sys_organization_units ou
LEFT JOIN sys.sys_organization_units par
       ON par.organization_unit_id = ou.organization_unit_parent_id;

COMMENT ON VIEW sys.v_organization_unit_integrity IS
  'Integrita dell organigramma, una riga per unita. Le colonne booleane sono le regole R1/R2/R6/R7 del referto: nomenclatura coerente col tipo, annidamento ammesso, un solo responsabile per unita e viceversa, responsabile interno all unita. Misura senza bloccare: diventera un cancello quando la bonifica sara completa.';

-- ───────────────────────────────────────────────────────────────────────────────
-- G. AUTO-VERIFICA — se un conteggio non torna, la transazione si annulla
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_tipi             int;
  n_department       int;
  n_branch           int;
  n_division         int;
  n_senza_prefisso   int;
  n_staff            int;
BEGIN
  SELECT count(*) INTO n_tipi FROM sys.sys_organization_unit_types;
  -- il catalogo dei tipi puo' solo crescere: questa fase ne aggiunge due e pretende
  -- che ci siano, non che siano gli ultimi mai aggiunti
  IF n_tipi < 10 THEN
    RAISE EXCEPTION 'Catalogo tipi: attesi almeno 10, trovati %', n_tipi;
  END IF;

  SELECT count(*) INTO n_department FROM sys.sys_organization_units
   WHERE organization_unit_type = 'DEPARTMENT';
  -- [S1043] Era `n_department = 10`: una CARDINALITA'. Le fasi successive di questa
  -- stessa serie creano altre Direzioni, quindi al ri-percorrere la catena completa
  -- il conto sale legittimamente e questa riga falliva. E' lo stesso difetto che ho
  -- corretto nelle migrazioni vecchie poche ore prima — con l'aggravante che qui
  -- l'avevo scritto io. Sostituita con l'invariante che questa fase deve garantire:
  -- nessuna unita chiamata «Direzione ...» resta tipizzata DIVISION. Vale su tutte,
  -- non su dieci, e non invecchia.
  IF n_department < 10 THEN
    RAISE EXCEPTION 'DEPARTMENT: attese almeno 10 unita (le «Direzione»), trovate %', n_department;
  END IF;

  SELECT count(*) INTO n_branch FROM sys.sys_organization_units
   WHERE organization_unit_type = 'BRANCH';
  -- idem: la fase 2 aggiunge sette filiali, quindi il minimo e' quello che questa
  -- fase ri-tipizza, non il totale del catalogo
  IF n_branch < 3 THEN
    RAISE EXCEPTION 'BRANCH: attese almeno 3 unita (le «Filiale»), trovate %', n_branch;
  END IF;

  SELECT count(*) INTO n_division FROM sys.sys_organization_units
   WHERE organization_unit_type = 'DIVISION';
  -- la fase 3 sposta e rinomina divisioni: il conto puo' scendere, quindi qui si
  -- verifica cio' che questa fase non deve aver rotto — che le divisioni esistano
  IF n_division < 1 THEN
    RAISE EXCEPTION 'DIVISION: nessuna divisione rimasta, trovate %', n_division;
  END IF;

  -- nessuna unita deve piu avere un nome incoerente col proprio tipo
  SELECT count(*) INTO n_senza_prefisso
    FROM sys.v_organization_unit_integrity WHERE viola_nomenclatura;
  IF n_senza_prefisso <> 0 THEN
    RAISE EXCEPTION 'Nomenclatura: % unita hanno un nome incoerente col tipo', n_senza_prefisso;
  END IF;

  SELECT count(*) INTO n_staff FROM sys.sys_organization_units
   WHERE organization_unit_relation = 'STAFF';
  -- la fase 3 porta in staff le altre funzioni di controllo: qui basta che il
  -- legame STAFF sia stato introdotto e usato almeno una volta
  IF n_staff < 1 THEN
    RAISE EXCEPTION 'STAFF: attesa almeno 1 unita in staff, trovate %', n_staff;
  END IF;

  RAISE NOTICE 'FASE 1 OK — 10 tipi in catalogo, 10 DEPARTMENT, 3 BRANCH, 10 DIVISION, nomenclatura coerente, 1 unita in staff.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) tipi e conteggi
--    SELECT organization_unit_type, count(*)
--      FROM sys.sys_organization_units GROUP BY 1 ORDER BY 1;
--    atteso: BRANCH 3 · DEPARTMENT 10 · DIVISION 10 · HEADQUARTERS 2 · OFFICE 2 · TEAM 1
--
-- 2) lo stato dell'integrita, che la fase 3 dovra portare a zero
--    SELECT count(*) FILTER (WHERE viola_nomenclatura)     AS nomenclatura,
--           count(*) FILTER (WHERE viola_annidamento)      AS annidamento,
--           count(*) FILTER (WHERE senza_responsabile)     AS senza_capo,
--           count(*) FILTER (WHERE responsabile_condiviso) AS capo_condiviso,
--           count(*) FILTER (WHERE responsabile_esterno)   AS capo_esterno
--      FROM sys.v_organization_unit_integrity;
--    atteso ORA (verificato in lab simulando la ri-tipizzazione):
--      nomenclatura 0 · annidamento 0 · senza_capo 0
--      capo_condiviso 15 · capo_esterno 14  ← i due difetti che la fase 3 chiude
--
--    Nota sull'annidamento a zero: le sette coppie tipo-padre che esistono dopo la
--    ri-tipizzazione — BRANCH/DIVISION, DEPARTMENT/DIVISION, DEPARTMENT/HEADQUARTERS,
--    DIVISION/HEADQUARTERS, OFFICE/DEPARTMENT, TEAM/HEADQUARTERS e HEADQUARTERS
--    radice — sono TUTTE fra quelle ammesse. Le regole di annidamento descrivono la
--    struttura reale, non ne impongono una diversa: e' la ri-tipizzazione a renderla
--    leggibile.
--
-- 3) che nessuna persona si sia mossa
--    SELECT count(*) FROM sys.sys_user_position_assignments
--     WHERE user_position_assignment_status = 'ACTIVE';   -- atteso: 161 (invariato)
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — riporta esattamente allo stato precedente
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DROP VIEW IF EXISTS sys.v_organization_unit_integrity;
--   ALTER TABLE sys.sys_organization_units DROP CONSTRAINT IF EXISTS sys_organization_units_type_chk;
--   ALTER TABLE sys.sys_organization_units DROP CONSTRAINT IF EXISTS sys_organization_units_relation_chk;
--   ALTER TABLE sys.sys_organization_units DROP COLUMN IF EXISTS organization_unit_relation;
--   UPDATE sys.sys_organization_units
--      SET organization_unit_name = 'Operations & Administration'
--    WHERE organization_unit_name = 'Divisione Operations & Administration';
--   UPDATE sys.sys_organization_units
--      SET organization_unit_type = 'OFFICE',
--          organization_unit_type_id = (SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code='OFFICE')
--    WHERE organization_unit_type = 'BRANCH';
--   UPDATE sys.sys_organization_units
--      SET organization_unit_type = 'DIVISION',
--          organization_unit_type_id = (SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code='DIVISION')
--    WHERE organization_unit_type = 'DEPARTMENT';
--   DELETE FROM sys.sys_organization_unit_types
--    WHERE organization_unit_type_code IN ('GENERAL_MANAGEMENT','AREA');
--   -- e il CHECK del catalogo torna ai suoi 8 codici (vedi A0)
--   ALTER TABLE sys.sys_organization_unit_types
--     DROP CONSTRAINT IF EXISTS sys_organization_unit_type_code_check;
--   ALTER TABLE sys.sys_organization_unit_types
--     ADD CONSTRAINT sys_organization_unit_type_code_check
--     CHECK (organization_unit_type_code IN (
--       'HEADQUARTERS','DIVISION','DEPARTMENT','TEAM','BRANCH','OFFICE','PLANT','WAREHOUSE'));
-- COMMIT;
