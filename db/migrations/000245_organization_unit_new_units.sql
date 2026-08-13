-- ═══════════════════════════════════════════════════════════════════════════════
-- 000245_organization_unit_new_units.sql
--
-- FASE 2 della ricostruzione dell'organigramma — LE UNITA' NUOVE.
--
-- Interamente ADDITIVA: crea 17 unita' e non tocca nulla di esistente. Nessuna
-- riga aggiornata, nessuna cancellata, nessuna persona spostata. Se qualcosa non
-- torna, basta cancellare le 17 righe create (rollback in coda).
--
-- Le 17 unita'
--   1  Direzione Generale                          GENERAL_MANAGEMENT  linea, sotto la societa
--   1  Direzione Affari Legali e Societari          DEPARTMENT          STAFF, sotto la societa
--   2  Direzione Coordinamento Commerciale
--      Direzione Governo e Supporto Rete            DEPARTMENT          linea, sotto Retail Banking
--   2  Area Milano e Provincia
--      Area Brescia-Bergamo                         AREA                linea, sotto Retail Banking
--   7  filiali: Porta Romana, Sempione, Sesto San Giovanni, Monza (Area Milano)
--               Dalmine (Area Brescia-Bergamo)  ·  Como, Varese (Area Milano)
--                                                   BRANCH              linea, sotto le due Aree
--   1  Direzione Monitoraggio e Crediti Deteriorati DEPARTMENT          linea, sotto Commercial Banking
--   1  Direzione Bilancio e Segnalazioni            DEPARTMENT          linea, sotto Divisione CFO
--   2  Ufficio Amministrazione del Personale
--      Ufficio Sviluppo, Formazione e Organizzazione OFFICE             linea, sotto Divisione HR
--
-- Le unita' nascono SENZA RESPONSABILE: le nomine sono la fase 4. La vista di
-- integrita' segnalera' quindi 17 righe «senza_responsabile», ed e' atteso.
--
-- I padri sono le unita' ATTUALI (Divisione Commercial Banking, Divisione CFO,
-- Divisione Human Resources): le rinomine e gli spostamenti sono la fase 3.
--
-- Prerequisito: 000244 applicata (serve il catalogo con GENERAL_MANAGEMENT e AREA,
-- e la colonna organization_unit_relation).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 0. CORREZIONE DELLA VISTA DI INTEGRITA' — una coppia mancava
--    La fase 1 ammetteva OFFICE solo sotto DEPARTMENT, BRANCH o AREA. Ma i due
--    uffici delle Risorse Umane stanno sotto una DIVISIONE, che con cinque persone
--    non ha direzioni intermedie: creare una direzione per contenere due uffici da
--    due persone sarebbe la frammentazione che vogliamo evitare.
--    La coppia OFFICE/DIVISION e' quindi legittima e va ammessa: senza questa
--    correzione la fase 2 introdurrebbe due violazioni di annidamento.
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
ammesso AS (
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
    ('OFFICE',             'DIVISION'),     -- ← aggiunta in fase 2: divisioni piccole senza direzioni
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
  ou.organization_unit_id       AS unita_id,
  ou.organization_unit_name     AS unita,
  ou.organization_unit_type     AS tipo,
  ou.organization_unit_relation AS legame,
  par.organization_unit_name    AS padre,
  par.organization_unit_type    AS tipo_padre,
  (ou.organization_unit_type <> 'HEADQUARTERS'
    AND NOT EXISTS (SELECT 1 FROM atteso a
                     WHERE a.tipo = ou.organization_unit_type
                       AND ou.organization_unit_name LIKE a.prefisso_atteso || '%'))
                                AS viola_nomenclatura,
  (ou.organization_unit_parent_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ammesso m
                     WHERE m.tipo_figlio = ou.organization_unit_type
                       AND m.tipo_padre_ammesso = par.organization_unit_type))
                                AS viola_annidamento,
  (ou.organization_unit_manager_user_id IS NULL)  AS senza_responsabile,
  (ou.organization_unit_manager_user_id IS NOT NULL
    AND (SELECT count(*) FROM sys.sys_organization_units x
          WHERE x.organization_unit_manager_user_id = ou.organization_unit_manager_user_id) > 1)
                                AS responsabile_condiviso,
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

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LE 17 UNITA' NUOVE
--    Un solo INSERT ... SELECT: i tipi e i padri sono risolti per codice, quindi
--    lo script non contiene identificativi scritti a mano ed e' rieseguibile.
--    Il filtro NOT EXISTS sul codice rende l'operazione idempotente.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_organization_units (
  organization_unit_tenant_id,
  organization_unit_code,
  organization_unit_name,
  organization_unit_type,
  organization_unit_type_id,
  organization_unit_parent_id,
  organization_unit_relation,
  organization_unit_effective_from,
  organization_unit_is_active
)
SELECT
  (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'),
  n.codice,
  n.nome,
  n.tipo,
  (SELECT organization_unit_type_id FROM sys.sys_organization_unit_types
    WHERE organization_unit_type_code = n.tipo),
  (SELECT organization_unit_id FROM sys.sys_organization_units
    WHERE organization_unit_code = n.codice_padre),
  n.legame,
  CURRENT_DATE,
  true
FROM (VALUES
  -- vertice operativo
  ('DG',           'Direzione Generale',                            'GENERAL_MANAGEMENT', 'RTL',        'LINEA'),
  -- staff al CEO
  ('DIR-LEGAL',    'Direzione Affari Legali e Societari',           'DEPARTMENT',         'RTL',        'STAFF'),
  -- governo della rete, sotto la divisione commerciale
  ('DIR-COORD',    'Direzione Coordinamento Commerciale',           'DEPARTMENT',         'DIV-RETAIL', 'LINEA'),
  ('DIR-RETE',     'Direzione Governo e Supporto Rete',             'DEPARTMENT',         'DIV-RETAIL', 'LINEA'),
  -- livello territoriale
  ('AREA-MI',      'Area Milano e Provincia',                       'AREA',               'DIV-RETAIL', 'LINEA'),
  ('AREA-BSBG',    'Area Brescia-Bergamo',                          'AREA',               'DIV-RETAIL', 'LINEA'),
  -- crediti e finanza
  ('DIR-MONIT',    'Direzione Monitoraggio e Crediti Deteriorati',  'DEPARTMENT',         'DIV-CRED',   'LINEA'),
  ('DIR-BILAN',    'Direzione Bilancio e Segnalazioni',             'DEPARTMENT',         'DIV-CFO',    'LINEA'),
  -- risorse umane
  ('UFF-PERS',     'Ufficio Amministrazione del Personale',         'OFFICE',             'DIV-HR',     'LINEA'),
  ('UFF-ORG',      'Ufficio Sviluppo, Formazione e Organizzazione', 'OFFICE',             'DIV-HR',     'LINEA')
) AS n(codice, nome, tipo, codice_padre, legame)
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_organization_units e
   WHERE e.organization_unit_code = n.codice
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 1-bis. LE 7 FILIALI DELLE DUE AREE — secondo livello, secondo INSERT
--    Perche' separate: il padre di queste sette e' AREA-MI o AREA-BSBG, che
--    NASCONO NELL'INSERT QUI SOPRA. Una singola INSERT ... SELECT non vede le
--    righe che sta inserendo, quindi la sotto-query sul codice del padre
--    restituiva NULL e le sette filiali finivano orfane. E' esattamente cosi'
--    che si e' fermata la prima applicazione reale (S1043): l'auto-verifica ha
--    contato «7 unita non-sede senza padre» e ha annullato tutto — il difetto
--    e' stato scoperto dal controllo che la migrazione porta con se'.
--    Ordine di inserimento = ordine dell'albero: prima le aree, poi le filiali.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_organization_units (
  organization_unit_tenant_id,
  organization_unit_code,
  organization_unit_name,
  organization_unit_type,
  organization_unit_type_id,
  organization_unit_parent_id,
  organization_unit_relation,
  organization_unit_effective_from,
  organization_unit_is_active
)
SELECT
  (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'),
  n.codice,
  n.nome,
  n.tipo,
  (SELECT organization_unit_type_id FROM sys.sys_organization_unit_types
    WHERE organization_unit_type_code = n.tipo),
  (SELECT organization_unit_id FROM sys.sys_organization_units
    WHERE organization_unit_code = n.codice_padre),
  n.legame,
  CURRENT_DATE,
  true
FROM (VALUES
  -- filiali dell'Area Milano e Provincia
  ('FIL-MI-PRO',   'Filiale Milano Porta Romana',                   'BRANCH',             'AREA-MI',    'LINEA'),
  ('FIL-MI-SEM',   'Filiale Milano Sempione',                       'BRANCH',             'AREA-MI',    'LINEA'),
  ('FIL-MI-SSG',   'Filiale Sesto San Giovanni',                    'BRANCH',             'AREA-MI',    'LINEA'),
  ('FIL-MB-MON',   'Filiale Monza',                                 'BRANCH',             'AREA-MI',    'LINEA'),
  ('FIL-CO-CEN',   'Filiale Como',                                  'BRANCH',             'AREA-MI',    'LINEA'),
  ('FIL-VA-CEN',   'Filiale Varese',                                'BRANCH',             'AREA-MI',    'LINEA'),
  -- filiale dell'Area Brescia-Bergamo
  ('FIL-BG-DAL',   'Filiale Dalmine',                               'BRANCH',             'AREA-BSBG',  'LINEA')
) AS n(codice, nome, tipo, codice_padre, legame)
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_organization_units e
   WHERE e.organization_unit_code = n.codice
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. AUTO-VERIFICA — la transazione si annulla se un conteggio non torna
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_tot int; n_dg int; n_area int; n_branch int; n_dep int; n_office int;
  n_orfane int; n_annid int; n_nome int; n_assegn int; n_padri_nulli int;
BEGIN
  SELECT count(*) INTO n_tot    FROM sys.sys_organization_units;
  -- [S1043] I conteggi per tipo guardano le unita ATTIVE, non tutte.
  --
  -- Erano su tutte, e reggevano solo alla prima applicazione: la fase 6 scioglie due
  -- unita (non le cancella, per non perdere la storia), quindi al ri-percorrere la
  -- catena completa questa fase vede lo stato FINALE e contava 16 DEPARTMENT contro
  -- le 15 attese. Il numero atteso non era sbagliato — era sbagliato il perimetro.
  -- Contando le vive, ogni valore torna esatto senza allentare nulla: e' la forma
  -- giusta di un'asserzione di fase dentro una serie che continua dopo di lei.
  SELECT count(*) INTO n_dg     FROM sys.sys_organization_units WHERE organization_unit_type='GENERAL_MANAGEMENT' AND organization_unit_is_active;
  SELECT count(*) INTO n_area   FROM sys.sys_organization_units WHERE organization_unit_type='AREA'   AND organization_unit_is_active;
  SELECT count(*) INTO n_branch FROM sys.sys_organization_units WHERE organization_unit_type='BRANCH' AND organization_unit_is_active;
  SELECT count(*) INTO n_dep    FROM sys.sys_organization_units WHERE organization_unit_type='DEPARTMENT' AND organization_unit_is_active;
  SELECT count(*) INTO n_office FROM sys.sys_organization_units WHERE organization_unit_type='OFFICE' AND organization_unit_is_active;

  IF n_tot    <> 45 THEN RAISE EXCEPTION 'Unita totali: attese 45 (28+17), trovate %', n_tot; END IF;
  IF n_dg     <>  1 THEN RAISE EXCEPTION 'Direzione Generale: attesa 1, trovate %', n_dg; END IF;
  IF n_area   <>  2 THEN RAISE EXCEPTION 'AREA: attese 2, trovate %', n_area; END IF;
  IF n_branch <> 10 THEN RAISE EXCEPTION 'BRANCH: attese 10 (3+7), trovate %', n_branch; END IF;
  IF n_dep    <> 15 THEN RAISE EXCEPTION 'DEPARTMENT: attese 15 (10+5), trovate %', n_dep; END IF;
  IF n_office <>  4 THEN RAISE EXCEPTION 'OFFICE: attesi 4 (2+2), trovati %', n_office; END IF;

  -- nessun padre irrisolto: se un codice_padre non esistesse, il parent_id sarebbe NULL
  SELECT count(*) INTO n_padri_nulli FROM sys.sys_organization_units
   WHERE organization_unit_parent_id IS NULL AND organization_unit_type <> 'HEADQUARTERS';
  IF n_padri_nulli <> 0 THEN
    RAISE EXCEPTION 'Padri irrisolti: % unita non-sede senza padre', n_padri_nulli;
  END IF;

  -- la struttura resta coerente su nomenclatura e annidamento
  SELECT count(*) INTO n_nome  FROM sys.v_organization_unit_integrity WHERE viola_nomenclatura;
  SELECT count(*) INTO n_annid FROM sys.v_organization_unit_integrity WHERE viola_annidamento;
  IF n_nome  <> 0 THEN RAISE EXCEPTION 'Nomenclatura: % violazioni', n_nome; END IF;
  IF n_annid <> 0 THEN RAISE EXCEPTION 'Annidamento: % violazioni', n_annid; END IF;

  -- le 17 nuove nascono senza responsabile: atteso, le nomine sono la fase 4
  SELECT count(*) INTO n_orfane FROM sys.v_organization_unit_integrity vi
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = vi.unita_id
   WHERE vi.senza_responsabile AND ou.organization_unit_is_active;
  -- la fase 4 nomina i responsabili delle 17 nuove: su un ri-percorso completo non
  -- ne resta nessuna orfana, ed e' il risultato corretto, non un difetto
  IF n_orfane NOT IN (0, 17) THEN
    RAISE EXCEPTION 'Unita attive senza responsabile: attese 17 (prima passata) o 0 (dopo la fase 4), trovate %', n_orfane;
  END IF;

  -- e soprattutto: nessuna persona si e mossa
  SELECT count(*) INTO n_assegn FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_assegn <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate, trovate %', n_assegn;
  END IF;

  RAISE NOTICE 'FASE 2 OK — 45 unita totali (17 nuove), 1 Direzione Generale, 2 Aree, 10 filiali, 15 direzioni, 4 uffici. Nomenclatura e annidamento a zero violazioni. 161 assegnazioni invariate.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) l'albero nuovo, per livello
--    WITH RECURSIVE a AS (
--      SELECT organization_unit_id, organization_unit_name, organization_unit_type,
--             organization_unit_relation, 1 AS liv
--        FROM sys.sys_organization_units WHERE organization_unit_parent_id IS NULL
--      UNION ALL
--      SELECT o.organization_unit_id, o.organization_unit_name, o.organization_unit_type,
--             o.organization_unit_relation, a.liv+1
--        FROM sys.sys_organization_units o JOIN a ON o.organization_unit_parent_id = a.organization_unit_id)
--    SELECT liv, organization_unit_type, organization_unit_relation, count(*)
--      FROM a GROUP BY 1,2,3 ORDER BY 1,2;
--
-- 2) lo stato dell'integrita
--    SELECT count(*) FILTER (WHERE viola_nomenclatura)     AS nomenclatura,   -- 0
--           count(*) FILTER (WHERE viola_annidamento)      AS annidamento,    -- 0
--           count(*) FILTER (WHERE senza_responsabile)     AS senza_capo,     -- 17
--           count(*) FILTER (WHERE responsabile_condiviso) AS capo_condiviso, -- 15
--           count(*) FILTER (WHERE responsabile_esterno)   AS capo_esterno    -- 14
--      FROM sys.v_organization_unit_integrity;
--    Le 17 senza capo sono le nuove (fase 4); condiviso ed esterno sono i difetti
--    preesistenti che chiude la fase 3.
--
-- 3) le due Aree e le loro filiali
--    SELECT p.organization_unit_name AS area, count(f.organization_unit_id) AS filiali
--      FROM sys.sys_organization_units p
--      LEFT JOIN sys.sys_organization_units f ON f.organization_unit_parent_id = p.organization_unit_id
--     WHERE p.organization_unit_type = 'AREA' GROUP BY 1;
--    atteso: Area Milano e Provincia 6 · Area Brescia-Bergamo 1
--    (le 3 filiali esistenti passano sotto le Aree in fase 3: oggi sono ancora
--     figlie della Divisione Retail Banking)
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_organization_units
--    WHERE organization_unit_code IN (
--      'DG','DIR-LEGAL','DIR-COORD','DIR-RETE','AREA-MI','AREA-BSBG',
--      'FIL-MI-PRO','FIL-MI-SEM','FIL-MI-SSG','FIL-MB-MON','FIL-CO-CEN','FIL-VA-CEN',
--      'FIL-BG-DAL','DIR-MONIT','DIR-BILAN','UFF-PERS','UFF-ORG');
--   -- e ripristinare la vista della fase 1 (senza la coppia OFFICE/DIVISION)
-- COMMIT;
