-- ═══════════════════════════════════════════════════════════════════════════════
-- 000292_emergency_team_coverage_per_branch.sql
--
-- #167 / `C4h(v)` — OGNI SEDE CON PERSONALE HA UNA SQUADRA DI EMERGENZA.
--
-- IL TRIAGE. Esito **(a) dato mancante**. Il controllo pretende che ogni sede con
-- personale abbia almeno un **addetto antincendio** e un **addetto al primo soccorso**
-- con attestato in corso di validità: è un obbligo di legge, non una convenzione del
-- dataset. Misurato alla frontiera della storia:
--   · **BG-CEN** — manca **entrambe** le figure (8 persone in sede);
--   · **BS-CEN** — manca l'**antincendio** (8 persone);
--   · **MI-CEN** — manca il **primo soccorso** (8 persone).
-- Tre filiali con personale e nessuno designato: sono le stesse filiali che il riordino
-- del 2026-08-04 ha spostato sotto le Aree territoriali. Ancora una volta la struttura è
-- cambiata e gli obblighi che ne discendono non l'hanno seguita.
--
-- ERA NASCOSTO DIETRO `C4h(ii)`. Finché i 24 preposti erano scoperti, la funzione
-- sollevava l'eccezione al sotto-controllo (ii) e non arrivava mai al (v). È la **sesta**
-- volta in due sessioni che un rosso ne nasconde un altro: il difetto di metodo non è in
-- questo dato, è in una batteria che si ferma al primo errore.
--
-- CHI SI NOMINA, E PERCHÉ NON A CASO. Per ogni sede scoperta si designa la persona con
-- **maggiore anzianità** in quella sede (assunzione più remota); se servono entrambe le
-- figure, la seconda va al secondo più anziano — due persone diverse, come in una squadra
-- vera. L'ordinamento è deterministico (anzianità, poi identificativo), quindi la stessa
-- migrazione nomina le stesse persone su ogni macchina.
--
-- Nome, ente e date degli attestati sono **letti dalle righe esistenti** della stessa
-- figura (l'ultima tornata), non scritti qui: se la cadenza cambiasse, questa migrazione
-- seguirebbe il dato invece di contraddirlo.
--
-- REVERSIBILE: le righe portano `origine: "000292"` nei metadati e
-- `staging.storia36_167_c4h_rollback()` — già estesa qui — le cancella insieme a quelle
-- della `000291`.
--
-- Idempotente: si crea solo per le sedi ancora scoperte.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_ins bigint;
  v_res bigint;
BEGIN
  -- Il modello di ciascuna figura, dall'ultima tornata realmente presente.
  CREATE TEMP TABLE modello ON COMMIT DROP AS
  SELECT * FROM (
    SELECT DISTINCT ON (f.chiave)
           f.chiave, f.ordine,
           c.user_certification_name AS nome, c.user_certification_issuer AS ente,
           c.user_certification_issued_date AS emesso, c.user_certification_expires_date AS scade
      FROM (VALUES ('%antincendio%', 1), ('%primo soccorso%', 2)) AS f(chiave, ordine)
      JOIN sys.sys_user_certifications c ON c.user_certification_name ILIKE f.chiave
     ORDER BY f.chiave, c.user_certification_issued_date DESC, c.user_certification_expires_date DESC
  ) m;

  IF (SELECT count(*) FROM modello) < 2 THEN
    RAISE EXCEPTION '000292: manca un attestato di riferimento per una delle due figure';
  END IF;

  -- Le sedi scoperte, con la persona da designare: anzianita' decrescente, e la
  -- seconda figura al secondo piu' anziano cosi' la squadra non e' una persona sola.
  CREATE TEMP TABLE nomine ON COMMIT DROP AS
  WITH scoperte AS (
    SELECT DISTINCT s.branch_code, m.chiave, m.ordine, m.nome, m.ente, m.emesso, m.scade
      FROM staging.storia36_sede_personale s
      CROSS JOIN modello m
     WHERE NOT EXISTS (
       SELECT 1 FROM staging.storia36_sede_personale s2
        JOIN sys.sys_user_certifications c ON c.user_certification_user_id = s2.user_id
       WHERE s2.branch_code = s.branch_code
         AND c.user_certification_name ILIKE m.chiave
         AND c.user_certification_expires_date >= COALESCE(staging.storia36_c4_frontier(), CURRENT_DATE))),
  graduatoria AS (
    SELECT s.branch_code, s.user_id,
           row_number() OVER (PARTITION BY s.branch_code
                              ORDER BY e.user_employment_hire_date NULLS LAST, s.user_id) AS posto
      FROM (SELECT DISTINCT branch_code, user_id FROM staging.storia36_sede_personale) s
      JOIN sys.sys_user_employment e ON e.user_employment_user_id = s.user_id)
  SELECT sc.branch_code, g.user_id, sc.nome, sc.ente, sc.emesso, sc.scade
    FROM scoperte sc
    JOIN graduatoria g ON g.branch_code = sc.branch_code AND g.posto = sc.ordine;

  INSERT INTO sys.sys_user_certifications (
    user_certification_user_id, user_certification_tenant_id, user_certification_name,
    user_certification_issuer, user_certification_issued_date, user_certification_expires_date,
    user_certification_credential_id, user_certification_metadata)
  SELECT n.user_id, c_rtl, n.nome, n.ente, n.emesso, n.scade,
         'ATT-' || upper(substring(md5(n.user_id::text || n.nome || '000292') for 10)),
         jsonb_build_object('blocco','sicurezza','storia36','C4','origine','000292','sede',n.branch_code)
    FROM nomine n;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  -- POST-CONDIZIONE — il predicato di C4h(v), ricalcolato.
  SELECT count(*) INTO v_res FROM (
    SELECT s.branch_code
      FROM staging.storia36_sede_personale s
      CROSS JOIN (VALUES ('%antincendio%'), ('%primo soccorso%')) AS f(figura)
     WHERE NOT EXISTS (
       SELECT 1 FROM staging.storia36_sede_personale s2
        JOIN sys.sys_user_certifications c ON c.user_certification_user_id = s2.user_id
       WHERE s2.branch_code = s.branch_code
         AND c.user_certification_name ILIKE f.figura
         AND c.user_certification_expires_date >= COALESCE(staging.storia36_c4_frontier(), CURRENT_DATE))
     GROUP BY 1, f.figura) x;
  IF v_res > 0 THEN
    RAISE EXCEPTION '000292: restano % sedi senza squadra di emergenza in regola', v_res;
  END IF;

  RAISE NOTICE '000292 done: % addetti designati; sedi scoperte: 0', v_ins;
END $mig$;

-- Il rollback copre entrambe le migrazioni del blocco sicurezza: chi annulla vuole
-- tornare allo stato di prima, non a un punto intermedio fra le due.
CREATE OR REPLACE FUNCTION staging.storia36_167_c4h_rollback()
RETURNS TABLE(cancellati bigint) LANGUAGE plpgsql AS $fn$
DECLARE v_n bigint;
BEGIN
  DELETE FROM sys.sys_user_certifications
   WHERE user_certification_metadata->>'origine' IN ('000291', '000292');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN QUERY SELECT v_n;
END $fn$;

COMMIT;
