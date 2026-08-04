-- ═══════════════════════════════════════════════════════════════════════════════
-- 000262_band_profile_and_twin_assignment.sql
--
-- LA FASCIA SEGUE LA POSIZIONE, E L'ULTIMO DOPPIONE DI ASSEGNAZIONE.
--
-- A. LA FASCIA SBAGLIATA E' DELLA POSIZIONE, NON DELLA PERSONA
--   `alice.esposito` prende 178.000 e la posizione che ricopre e' agganciata alla
--   fascia `MG-1` [85.000-130.000]. Sembra uno stipendio fuori scala; non lo e'.
--   Le fasce apicali `EX-1` [180-280k] ed `EX-2` [120-190k] esistono nel catalogo, e
--   178.000 cade dentro `EX-2`. Il dato da correggere e' il PROFILO DELLA POSIZIONE,
--   non la retribuzione della persona — che e' un fatto contrattuale e non si tocca
--   per far tornare un conto.
--
--   La correzione non e' un caso singolo scritto a mano ma una regola: quando la
--   retribuzione di chi ricopre una posizione cade FUORI dalla fascia agganciata, e
--   nel catalogo esiste UNA SOLA fascia che quella retribuzione la contiene, il
--   profilo si sposta su quella. Se le fasce candidate sono zero o piu' di una, la
--   riga resta com'e': un'ambiguita' non si risolve indovinando.
--
--   Questa correzione e' diventata possibile solo ora: fino alla 000261 i profili
--   erano appesi a posizioni disattivate e la verifica misurava su 25 righe invece
--   che su 157, quindi il caso era invisibile.
--
-- B. L'ULTIMO DOPPIONE
--   `andrea.martino` risultava con due assegnazioni sovrapposte allo stesso incarico,
--   stesso intervallo 2009-12-29 → 2025-02-27. La 000261 non lo ha preso perche'
--   cercava lo stesso `position_id`: qui le POSIZIONI sono due —
--   `POS-LEGAL-COMPL-01` (identificativo deterministico, dal seme) e `POS-00000291`
--   (codice progressivo, dall'importazione legacy). Non e' un doppione di
--   assegnazione: e' lo stesso incarico rappresentato due volte, e la sovrapposizione
--   e' il sintomo. Entrambe le posizioni sono ormai disattivate; si toglie
--   l'assegnazione su quella di provenienza legacy e si tiene la deterministica, che
--   e' riproducibile dal seme.
--
-- Rieseguibile. Prerequisiti: 000261 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. IL PROFILO SI SPOSTA SULLA FASCIA CHE CONTIENE LA RETRIBUZIONE REALE
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE riallineo ON COMMIT DROP AS
WITH occupanti AS (
  SELECT pc.position_compensation_profile_id AS profilo_id,
         c.user_contract_gross_annual_salary AS ral,
         b.compensation_band_min_eur AS min_att, b.compensation_band_max_eur AS max_att
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_positions p  ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_position_compensation_profiles pc ON pc.position_id = p.position_id
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pc.compensation_band_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = a.user_position_assignment_user_id
                                 AND c.user_contract_status = 'ACTIVE'
   WHERE a.user_position_assignment_status = 'ACTIVE'
     AND c.user_contract_gross_annual_salary IS NOT NULL
     AND (c.user_contract_gross_annual_salary < b.compensation_band_min_eur
          OR c.user_contract_gross_annual_salary > b.compensation_band_max_eur)
)
SELECT o.profilo_id,
       (SELECT nb.compensation_band_id FROM sys.sys_compensation_bands nb
         WHERE o.ral BETWEEN nb.compensation_band_min_eur AND nb.compensation_band_max_eur) AS fascia_giusta
  FROM occupanti o
 WHERE (SELECT count(*) FROM sys.sys_compensation_bands nb
         WHERE o.ral BETWEEN nb.compensation_band_min_eur AND nb.compensation_band_max_eur) = 1;

UPDATE sys.sys_position_compensation_profiles pc
   SET compensation_band_id = r.fascia_giusta, updated_at = now()
  FROM riallineo r
 WHERE pc.position_compensation_profile_id = r.profilo_id
   AND r.fascia_giusta IS NOT NULL
   AND pc.compensation_band_id IS DISTINCT FROM r.fascia_giusta;

-- ───────────────────────────────────────────────────────────────────────────────
-- B. VIA L'ASSEGNAZIONE SULLA POSIZIONE GEMELLA DI PROVENIENZA LEGACY
-- ───────────────────────────────────────────────────────────────────────────────
DELETE FROM sys.sys_user_position_assignments a
 USING sys.sys_positions p
 WHERE a.user_position_assignment_position_id = p.position_id
   AND a.user_position_assignment_status = 'ENDED'
   AND p.position_code ~ '^POS-[0-9]+$'          -- codice progressivo = importazione legacy
   AND NOT p.position_is_active
   AND EXISTS (                                   -- esiste il gemello, stesso incarico e stesse date
     SELECT 1 FROM sys.sys_user_position_assignments g
       JOIN sys.sys_positions gp ON gp.position_id = g.user_position_assignment_position_id
      WHERE g.user_position_assignment_user_id  = a.user_position_assignment_user_id
        AND g.user_position_assignment_start_date = a.user_position_assignment_start_date
        AND g.user_position_assignment_end_date IS NOT DISTINCT FROM a.user_position_assignment_end_date
        AND g.user_position_assignment_id <> a.user_position_assignment_id
        AND gp.position_code !~ '^POS-[0-9]+$');

-- ───────────────────────────────────────────────────────────────────────────────
-- C. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_fuori int; n_universo int; n_sovrapposte int; n_attive int; n_spostati int;
BEGIN
  SELECT count(*) INTO n_spostati FROM riallineo WHERE fascia_giusta IS NOT NULL;

  -- L'UNIVERSO va dichiarato: se fosse minuscolo, uno zero non proverebbe niente.
  -- Fino alla 000261 questa misura girava su 25 righe invece di 157, e la sua
  -- rassicurazione era falsa.
  SELECT count(*) INTO n_universo
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_position_compensation_profiles pc ON pc.position_id = p.position_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = a.user_position_assignment_user_id
                                 AND c.user_contract_status = 'ACTIVE'
   WHERE a.user_position_assignment_status = 'ACTIVE' AND c.user_contract_gross_annual_salary IS NOT NULL;
  IF n_universo < 120 THEN
    RAISE EXCEPTION 'Universo della verifica retributiva: % righe, attese >120 — la misura sarebbe cieca', n_universo;
  END IF;

  SELECT count(*) INTO n_fuori
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_position_compensation_profiles pc ON pc.position_id = p.position_id
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pc.compensation_band_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = a.user_position_assignment_user_id
                                 AND c.user_contract_status = 'ACTIVE'
   WHERE a.user_position_assignment_status = 'ACTIVE'
     AND c.user_contract_gross_annual_salary IS NOT NULL
     AND (c.user_contract_gross_annual_salary < b.compensation_band_min_eur
          OR c.user_contract_gross_annual_salary > b.compensation_band_max_eur);
  IF n_fuori <> 0 THEN
    RAISE EXCEPTION 'Retribuzioni fuori dalla fascia della posizione: % su % — restano casi ambigui', n_fuori, n_universo;
  END IF;

  SELECT count(*) INTO n_sovrapposte FROM (
    SELECT 1 FROM sys.sys_user_position_assignments x
      JOIN sys.sys_user_position_assignments y
        ON y.user_position_assignment_user_id = x.user_position_assignment_user_id
       AND y.user_position_assignment_id <> x.user_position_assignment_id
       AND y.user_position_assignment_start_date = x.user_position_assignment_start_date
       AND y.user_position_assignment_end_date IS NOT DISTINCT FROM x.user_position_assignment_end_date) q;
  IF n_sovrapposte <> 0 THEN
    RAISE EXCEPTION 'Assegnazioni ancora sovrapposte: %', n_sovrapposte;
  END IF;

  SELECT count(*) INTO n_attive FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive <> 161 THEN RAISE EXCEPTION 'Assegnazioni attive: attese 161, trovate %', n_attive; END IF;

  RAISE NOTICE 'OK — % profili spostati sulla fascia che contiene la retribuzione reale; zero retribuzioni fuori fascia su un universo di %; zero assegnazioni sovrapposte; 161 attive.',
               n_spostati, n_universo;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — dallo snapshot pre-migrazione: la riga non conserva la fascia precedente.
-- ═══════════════════════════════════════════════════════════════════════════════
