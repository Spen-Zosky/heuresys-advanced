-- ═══════════════════════════════════════════════════════════════════════════════
-- 000246_organization_unit_restructure.sql
--
-- FASE 3 della ricostruzione dell'organigramma — LA RISTRUTTURAZIONE.
--
-- E' la prima fase che tocca dati esistenti. Tocca SOLO la struttura:
--   A. rinomina 8 unita, allineando il nome alla funzione che presidiano
--   B. cambia il tipo a 1 unita (Legal & Compliance: da divisione a direzione)
--   C. sposta 12 unita: le 7 divisioni sotto la Direzione Generale, le 3 filiali
--      esistenti sotto le Aree, le 2 funzioni di controllo dalla linea allo staff
--   D. porta a 5 le unita in staff al CEO
--
-- Che cosa NON fa, e perche'
--   · NON scioglie nessuna unita. La Divisione Risk & Compliance perde le sue due
--     direzioni ma conserva 36 persone: disattivarla adesso lascerebbe 36 posizioni
--     appese a un'unita inattiva. Lo scioglimento e' la fase 6, dopo che le persone
--     si sono mosse. Vale anche per la Direzione Corporate Banking e per il Team
--     Product & Development.
--   · NON muove nessuna persona: nessuna posizione cambia unita, nessuna
--     assegnazione cambia. Le 161 assegnazioni attive restano 161.
--   · NON nomina responsabili: e' la fase 4.
--
-- Prerequisiti: 000244 (tassonomia) e 000245 (unita nuove) applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A0. I DUE CODICI CHE SI SCAMBIAVANO IL SIGNIFICATO (#127, 2026-08-13)
--     `DIV-COMM` si chiamava «Divisione Crediti» e `DIV-LEGAL` «Direzione
--     Compliance», mentre il nome «legale» sta su `DIR-LEGAL`, che e' un'unita'
--     DIVERSA: due codici che si scambiano il senso sono la condizione tipica in
--     cui qualcuno aggancia un dato all'unita' sbagliata — e qui Compliance e
--     Affari Legali hanno perimetri di riservatezza diversi.
--
--     STA QUI, e non in una migrazione successiva, per una ragione misurata: su
--     un database ESISTENTE la catena si ri-applica per intero, e `000250`
--     cerca l'unita' per codice. Con la rinomina a valle, `000250` girava PRIMA
--     e non trovava piu' nulla — prova generale rossa, «Posizioni centrali:
--     attese 40, create 39». E' ADR-0035: si emenda il file che crea l'oggetto.
--     Su un database nuovo questo UPDATE non trova nulla e i codici nascono
--     gia' giusti dal blocco B.
UPDATE sys.sys_organization_units
   SET organization_unit_code = 'DIV-CRED', updated_at = now()
 WHERE organization_unit_code = 'DIV-COMM';
UPDATE sys.sys_organization_units
   SET organization_unit_code = 'DIR-COMPL', updated_at = now()
 WHERE organization_unit_code = 'DIV-LEGAL';

-- GUARDIA su cio' che NON doveva cambiare: `DIR-LEGAL` e' un'unita' diversa e
-- deve restare intatta. E' il punto in cui una rinomina distratta fonderebbe
-- due unita' con perimetri di riservatezza diversi.
DO $guardia$
BEGIN
  IF EXISTS (SELECT 1 FROM sys.sys_organization_units
              WHERE organization_unit_code IN ('DIV-COMM', 'DIV-LEGAL')) THEN
    RAISE EXCEPTION '000246 A0: un codice vecchio e'' sopravvissuto alla rinomina';
  END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_organization_units
              WHERE organization_unit_code = 'DIR-COMPL')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units
                      WHERE organization_unit_code = 'DIR-LEGAL') THEN
    RAISE EXCEPTION '000246 A0: DIR-LEGAL e'' sparita: le due unita'' sono state fuse';
  END IF;
END $guardia$;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. RINOMINE — il nome dice la funzione presidiata
--    Il criterio: ogni unita si chiama come il processo che governa. «Divisione
--    CFO» dice chi la dirige, non cosa fa; «Divisione Finanza e Amministrazione»
--    dice cosa fa. Un organigramma si legge dai nomi.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units AS ou
   SET organization_unit_name = r.nome_nuovo,
       updated_at             = now()
  FROM (VALUES
    -- la divisione commerciale presidia il credito: e' il suo mestiere
    ('DIV-CRED',    'Divisione Crediti'),
    -- e la sua direzione istruisce ed eroga
    ('DIR-CREDITI', 'Direzione Istruttoria ed Erogazione'),
    -- nomi che dicono la funzione, non la carica
    ('DIV-CFO',     'Divisione Finanza e Amministrazione'),
    ('DIV-HR',      'Divisione Risorse Umane e Organizzazione'),
    ('DIV-MKT',     'Divisione Marketing e Comunicazione'),
    ('DIR-AML',     'Direzione Antiriciclaggio'),
    ('DIR-DEV',     'Direzione Sviluppo Software e Canali Digitali'),
    -- la parte «Legal» e' stata scorporata in DIR-LEGAL (fase 2): qui resta la
    -- funzione di controllo, che assorbe anche il ruolo di protezione dei dati
    ('DIR-COMPL',   'Direzione Compliance e Protezione Dati')
  ) AS r(codice, nome_nuovo)
 WHERE ou.organization_unit_code = r.codice;

-- ───────────────────────────────────────────────────────────────────────────────
-- B. CAMBIO DI TIPO — Compliance non e' una divisione
--    Con 2 persone e un mandato di controllo non e' una grande ripartizione: e' una
--    direzione. Il tipo va allineato al rango, altrimenti torna il difetto che la
--    fase 1 ha corretto.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_type    = 'DEPARTMENT',
       organization_unit_type_id = (SELECT organization_unit_type_id
                                      FROM sys.sys_organization_unit_types
                                     WHERE organization_unit_type_code = 'DEPARTMENT'),
       updated_at                = now()
 WHERE organization_unit_code = 'DIR-COMPL';

-- ───────────────────────────────────────────────────────────────────────────────
-- C. SPOSTAMENTI
--    C1. le 7 divisioni operative passano sotto la Direzione Generale.
--        Prima pendevano tutte dalla societa, senza nessun punto di coordinamento.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_parent_id = (SELECT organization_unit_id
                                        FROM sys.sys_organization_units
                                       WHERE organization_unit_code = 'DG'),
       organization_unit_relation  = 'LINEA',
       updated_at                  = now()
 WHERE organization_unit_code IN (
   'DIV-RETAIL', 'DIV-CRED', 'DIV-OPS', 'DIV-IT', 'DIV-CFO', 'DIV-HR', 'DIV-MKT'
 );

--    C2. le 3 filiali esistenti passano sotto le Aree territoriali.
--        Prima erano figlie dirette della divisione, senza livello intermedio.
UPDATE sys.sys_organization_units AS ou
   SET organization_unit_parent_id = (SELECT organization_unit_id
                                        FROM sys.sys_organization_units
                                       WHERE organization_unit_code = m.area),
       updated_at                  = now()
  FROM (VALUES
    ('FIL-MI-CEN', 'AREA-MI'),
    ('FIL-BS-CEN', 'AREA-BSBG'),
    ('FIL-BG-CEN', 'AREA-BSBG')
  ) AS m(filiale, area)
 WHERE ou.organization_unit_code = m.filiale;

--    C3. le 2 funzioni di controllo escono dalla linea ed entrano in staff.
--        Risk Management e Antiriciclaggio erano DENTRO la Divisione Risk &
--        Compliance: cioe' controllori collocati sotto la linea che controllano.
--        Ora rispondono al CEO, come l'Internal Audit.
UPDATE sys.sys_organization_units
   SET organization_unit_parent_id = (SELECT organization_unit_id
                                        FROM sys.sys_organization_units
                                       WHERE organization_unit_code = 'RTL'),
       organization_unit_relation  = 'STAFF',
       updated_at                  = now()
 WHERE organization_unit_code IN ('DIR-RISKM', 'DIR-AML');

-- ───────────────────────────────────────────────────────────────────────────────
-- D. LO STAFF AL CEO — cinque unita
--    Internal Audit era gia in staff (fase 1), Affari Legali e' nato in staff
--    (fase 2), Risk Management e Antiriciclaggio ci sono appena arrivati (C3):
--    resta Compliance, che era una divisione della linea.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_relation  = 'STAFF',
       organization_unit_parent_id = (SELECT organization_unit_id
                                        FROM sys.sys_organization_units
                                       WHERE organization_unit_code = 'RTL'),
       updated_at                  = now()
 WHERE organization_unit_code = 'DIR-COMPL';

-- ───────────────────────────────────────────────────────────────────────────────
-- E. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_sotto_dg int; n_staff int; n_fil_mi int; n_fil_bsbg int;
  n_nome int; n_annid int; n_assegn int; n_risk_figli int; n_tot int;
BEGIN
  -- le 7 divisioni operative sotto la Direzione Generale
  SELECT count(*) INTO n_sotto_dg
    FROM sys.sys_organization_units
   WHERE organization_unit_parent_id = (SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='DG');
  IF n_sotto_dg <> 7 THEN
    RAISE EXCEPTION 'Sotto la Direzione Generale: attese 7 divisioni, trovate %', n_sotto_dg;
  END IF;

  -- 5 unita in staff al CEO
  SELECT count(*) INTO n_staff FROM sys.sys_organization_units WHERE organization_unit_relation='STAFF';
  IF n_staff <> 5 THEN
    RAISE EXCEPTION 'Unita in staff: attese 5, trovate %', n_staff;
  END IF;

  -- le filiali sotto le due Aree: 7 e 3
  SELECT count(*) INTO n_fil_mi FROM sys.sys_organization_units
   WHERE organization_unit_parent_id = (SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='AREA-MI');
  IF n_fil_mi <> 7 THEN
    RAISE EXCEPTION 'Area Milano: attese 7 filiali, trovate %', n_fil_mi;
  END IF;

  SELECT count(*) INTO n_fil_bsbg FROM sys.sys_organization_units
   WHERE organization_unit_parent_id = (SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='AREA-BSBG');
  IF n_fil_bsbg <> 3 THEN
    RAISE EXCEPTION 'Area Brescia-Bergamo: attese 3 filiali, trovate %', n_fil_bsbg;
  END IF;

  -- la Divisione Risk & Compliance resta, ma senza figli: e' pronta per lo
  -- scioglimento della fase 6, quando le sue 36 persone saranno state ricollocate
  SELECT count(*) INTO n_risk_figli FROM sys.sys_organization_units
   WHERE organization_unit_parent_id = (SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='DIV-RISK');
  IF n_risk_figli <> 0 THEN
    RAISE EXCEPTION 'Divisione Risk & Compliance: attesi 0 figli dopo lo spostamento dei controlli, trovati %', n_risk_figli;
  END IF;

  -- struttura coerente
  SELECT count(*) INTO n_nome  FROM sys.v_organization_unit_integrity WHERE viola_nomenclatura;
  SELECT count(*) INTO n_annid FROM sys.v_organization_unit_integrity WHERE viola_annidamento;
  IF n_nome  <> 0 THEN RAISE EXCEPTION 'Nomenclatura: % violazioni', n_nome; END IF;
  IF n_annid <> 0 THEN RAISE EXCEPTION 'Annidamento: % violazioni', n_annid; END IF;

  -- nessuna unita persa o creata in questa fase
  SELECT count(*) INTO n_tot FROM sys.sys_organization_units;
  IF n_tot <> 45 THEN RAISE EXCEPTION 'Unita totali: attese 45 invariate, trovate %', n_tot; END IF;

  -- e nessuna persona mossa
  SELECT count(*) INTO n_assegn FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_assegn <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate, trovate %', n_assegn;
  END IF;

  RAISE NOTICE 'FASE 3 OK — 7 divisioni sotto la Direzione Generale, 5 unita in staff al CEO, 7+3 filiali sotto le due Aree, Risk & Compliance senza figli, 0 violazioni di struttura, 161 assegnazioni invariate.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) l'albero, per livello e tipo di legame
--    WITH RECURSIVE a AS (
--      SELECT organization_unit_id AS id, organization_unit_name AS nome,
--             organization_unit_type AS tipo, organization_unit_relation AS legame, 1 AS liv
--        FROM sys.sys_organization_units WHERE organization_unit_parent_id IS NULL
--      UNION ALL
--      SELECT o.organization_unit_id, o.organization_unit_name, o.organization_unit_type,
--             o.organization_unit_relation, a.liv+1
--        FROM sys.sys_organization_units o JOIN a ON o.organization_unit_parent_id = a.id)
--    SELECT liv, legame, tipo, count(*), string_agg(nome, ' · ' ORDER BY nome)
--      FROM a GROUP BY 1,2,3 ORDER BY 1,2,3;
--
--    atteso al livello 2: 1 GENERAL_MANAGEMENT in LINEA (la Direzione Generale)
--                         4 DEPARTMENT in STAFF (Audit, Risk Management, Compliance,
--                           Antiriciclaggio) + 1 DEPARTMENT in STAFF (Affari Legali)
--                         1 DIVISION in LINEA (Risk & Compliance, in attesa di scioglimento)
--
-- 2) la prova che i controlli sono usciti dalla linea
--    SELECT organization_unit_name, organization_unit_relation,
--           (SELECT organization_unit_name FROM sys.sys_organization_units p
--             WHERE p.organization_unit_id = ou.organization_unit_parent_id) AS padre
--      FROM sys.sys_organization_units ou
--     WHERE organization_unit_relation = 'STAFF' ORDER BY 1;
--    atteso: tutte e 5 con padre «RTL Bank S.p.A.»
--
-- 3) l'integrita: cosa resta da chiudere
--    SELECT count(*) FILTER (WHERE senza_responsabile)     AS senza_capo,     -- 17
--           count(*) FILTER (WHERE responsabile_condiviso) AS capo_condiviso, -- 15
--           count(*) FILTER (WHERE responsabile_esterno)   AS capo_esterno    -- 14
--      FROM sys.v_organization_unit_integrity;
--    Sono i tre difetti che chiude la fase 4 (le nomine).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   -- nomi
--   UPDATE sys.sys_organization_units AS ou SET organization_unit_name = r.vecchio
--     FROM (VALUES ('DIV-CRED','Divisione Commercial Banking'),
--                  ('DIR-CREDITI','Direzione Crediti'),
--                  ('DIV-CFO','Divisione CFO'),
--                  ('DIV-HR','Divisione Human Resources'),
--                  ('DIV-MKT','Divisione Marketing'),
--                  ('DIR-AML','Direzione AML/Antiriciclaggio'),
--                  ('DIR-DEV','Direzione Sviluppo Software'),
--                  ('DIR-COMPL','Divisione Legal & Compliance')) AS r(codice,vecchio)
--    WHERE ou.organization_unit_code = r.codice;
--   -- tipo
--   UPDATE sys.sys_organization_units
--      SET organization_unit_type='DIVISION',
--          organization_unit_type_id=(SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code='DIVISION')
--    WHERE organization_unit_code='DIR-COMPL';
--   -- padri: tutto torna sotto la societa, filiali sotto la divisione, controlli dentro Risk
--   UPDATE sys.sys_organization_units
--      SET organization_unit_parent_id=(SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='RTL'),
--          organization_unit_relation='LINEA'
--    WHERE organization_unit_code IN ('DIV-RETAIL','DIV-CRED','DIV-OPS','DIV-IT','DIV-CFO','DIV-HR','DIV-MKT','DIR-COMPL');
--   UPDATE sys.sys_organization_units
--      SET organization_unit_parent_id=(SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='DIV-RETAIL')
--    WHERE organization_unit_code IN ('FIL-MI-CEN','FIL-BS-CEN','FIL-BG-CEN');
--   UPDATE sys.sys_organization_units
--      SET organization_unit_parent_id=(SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_code='DIV-RISK'),
--          organization_unit_relation='LINEA'
--    WHERE organization_unit_code IN ('DIR-RISKM','DIR-AML');
-- COMMIT;
