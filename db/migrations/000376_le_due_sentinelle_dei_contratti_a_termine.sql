-- ─────────────────────────────────────────────────────────────────────────────
-- 000376 — Le due sentinelle dei contratti a termine (#246 F2 + F3)
--
-- ── PERCHÉ IL DIFETTO È SOPRAVVISSUTO DUE ANNI ──────────────────────────────
-- Un terzo dell'organico risultava a tempo determinato, e **nessuno strumento
-- lo misurava**. Le sentinelle esistenti guardavano le SCADENZE: un `fixed_term`
-- senza data di fine non è scaduto, quindi non compariva da nessuna parte. La
-- 000375 ha bonificato l'esistente; questa impedisce che tomi.
--
-- ── LA REGOLA (Enzo, 2026-09-05), nelle sue due metà ────────────────────────
--   ① AMMISSIBILITÀ — nessun contratto a termine a chi ha più di **12 mesi** di
--      anzianità. Oltre quel confine il tipo è sbagliato, qualunque data porti.
--   ② DURATA — un contratto a termine ha una scadenza, e non oltre **16 mesi**
--      dall'assunzione: dopo, si passa a tempo indeterminato.
--
-- ── PERCHÉ DUE VISTE E NON UN `CHECK` ───────────────────────────────────────
-- Il piano di `#246` diceva «dove possibile un CHECK, altrimenti una sentinella».
-- Qui il `CHECK` **non è possibile**, e la ragione è di sostanza, non di comodo:
-- entrambe le regole confrontano una colonna di `sys_user_contracts` con la data
-- di assunzione, che vive in `sys_user_employment` — un vincolo di tabella non
-- può leggere un'altra tabella. E la prima regola dipende inoltre da
-- `current_date`: una condizione che cambia da sola nel tempo non è esprimibile
-- come vincolo (una riga valida oggi diventerebbe invalida domani senza che
-- nessuno l'abbia toccata, e ogni UPDATE successivo fallirebbe).
--
-- Le due viste entrano da sole nella batteria di `db_health.py`, che raccoglie
-- ogni `sys.v_*` e pretende zero righe.
--
-- ⚠ Una vista che MISURA (invece di segnalare una violazione) renderebbe rossa
--   la prova generale per costruzione: queste due segnalano violazioni, e sui
--   dati bonificati dalla 000375 sono a zero. Provate rosse qui sotto.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── ① AMMISSIBILITÀ: nessun contratto a termine oltre i 12 mesi di anzianità ─
CREATE OR REPLACE VIEW sys.v_contratto_a_termine_fuori_ammissibilita AS
SELECT
  c.user_contract_id,
  u.user_email,
  e.user_employment_hire_date                                   AS assunto_il,
  date_part('year', age(current_date, e.user_employment_hire_date)) * 12
    + date_part('month', age(current_date, e.user_employment_hire_date))  AS mesi_di_anzianita,
  c.user_contract_end_date                                      AS scadenza
FROM sys.sys_user_contracts c
JOIN sys.sys_users u           ON u.user_id = c.user_contract_user_id
JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
WHERE c.user_contract_status = 'ACTIVE'
  AND c.user_contract_type   = 'fixed_term'
  AND e.user_employment_hire_date IS NOT NULL
  AND age(current_date, e.user_employment_hire_date) > interval '12 months';

COMMENT ON VIEW sys.v_contratto_a_termine_fuori_ammissibilita IS
  'ROSSA se un contratto a termine appartiene a chi ha piu'' di 12 mesi di anzianita'': '
  'oltre quel confine il tipo e'' sbagliato, qualunque data porti (#246, regola di Enzo).';

-- ── ② DURATA: scadenza presente, e non oltre i 16 mesi dall'assunzione ──────
CREATE OR REPLACE VIEW sys.v_contratto_a_termine_durata_incoerente AS
SELECT
  c.user_contract_id,
  u.user_email,
  e.user_employment_hire_date  AS assunto_il,
  c.user_contract_end_date     AS scadenza,
  CASE
    WHEN c.user_contract_end_date IS NULL THEN 'senza scadenza: in vigore per sempre'
    ELSE 'scadenza oltre i 16 mesi dall''assunzione'
  END                          AS perche
FROM sys.sys_user_contracts c
JOIN sys.sys_users u           ON u.user_id = c.user_contract_user_id
JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
WHERE c.user_contract_status = 'ACTIVE'
  AND c.user_contract_type   = 'fixed_term'
  AND (
        c.user_contract_end_date IS NULL
     OR (e.user_employment_hire_date IS NOT NULL
         AND c.user_contract_end_date > e.user_employment_hire_date + interval '16 months')
      );

COMMENT ON VIEW sys.v_contratto_a_termine_durata_incoerente IS
  'ROSSA se un contratto a termine non ha scadenza, o ce l''ha oltre i 16 mesi '
  'dall''assunzione: dopo 16 mesi il rapporto e'' a tempo indeterminato (#246).';

-- ── LE PROVE: entrambe devono poter diventare ROSSE ─────────────────────────
-- Una sentinella mai vista rossa non e' una prova. Si inietta un caso per
-- ciascuna, si verifica che la vista lo trovi, e si disfa — dentro la stessa
-- transazione, cosi' un fallimento non lascia residui.
DO $$
DECLARE
  v_contratto uuid;
  v_assunto   date;
  v_n         int;
BEGIN
  -- si sceglie una persona vera con una data di assunzione: la prova gira sui
  -- dati che ci sono, non su un caso costruito che potrebbe non somigliare a
  -- nulla di reale.
  SELECT c.user_contract_id, e.user_employment_hire_date
    INTO v_contratto, v_assunto
  FROM sys.sys_user_contracts c
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
  WHERE c.user_contract_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL
    AND age(current_date, e.user_employment_hire_date) > interval '12 months'
  LIMIT 1;

  IF v_contratto IS NULL THEN
    RAISE NOTICE '000376: nessun contratto con anzianita'' oltre i 12 mesi — prove NON eseguite';
  ELSE
    -- prova ①: il tipo sbagliato per l'anzianita' che la persona ha
    UPDATE sys.sys_user_contracts
       SET user_contract_type = 'fixed_term',
           user_contract_end_date = v_assunto + interval '10 months'
     WHERE user_contract_id = v_contratto;
    SELECT count(*) INTO v_n FROM sys.v_contratto_a_termine_fuori_ammissibilita
     WHERE user_contract_id = v_contratto;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '000376: la sentinella dell''ammissibilita'' NON vede il caso iniettato — non e'' una prova';
    END IF;

    -- prova ②: scadenza oltre i 16 mesi dall'assunzione
    UPDATE sys.sys_user_contracts
       SET user_contract_end_date = v_assunto + interval '20 months'
     WHERE user_contract_id = v_contratto;
    SELECT count(*) INTO v_n FROM sys.v_contratto_a_termine_durata_incoerente
     WHERE user_contract_id = v_contratto;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '000376: la sentinella della durata NON vede la scadenza troppo lontana';
    END IF;

    -- prova ②-bis: e nemmeno l'assenza di scadenza le deve sfuggire, che e'
    -- il caso da cui tutto e' partito — 25 contratti in vigore per sempre.
    UPDATE sys.sys_user_contracts
       SET user_contract_end_date = NULL
     WHERE user_contract_id = v_contratto;
    SELECT count(*) INTO v_n FROM sys.v_contratto_a_termine_durata_incoerente
     WHERE user_contract_id = v_contratto;
    IF v_n <> 1 THEN
      RAISE EXCEPTION '000376: la sentinella della durata NON vede il contratto senza scadenza';
    END IF;

    -- si disfa: il caso iniettato torna com'era (permanent, senza fine)
    UPDATE sys.sys_user_contracts
       SET user_contract_type = 'permanent', user_contract_end_date = NULL
     WHERE user_contract_id = v_contratto;

    RAISE NOTICE '000376: entrambe le sentinelle provate ROSSE su un caso vero, e disfatto';
  END IF;

  -- ── lo stato dopo la 000375: entrambe devono essere a ZERO ───────────────
  SELECT count(*) INTO v_n FROM sys.v_contratto_a_termine_fuori_ammissibilita;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '000376: % contratti a termine fuori ammissibilita'' — la 000375 non ha finito', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM sys.v_contratto_a_termine_durata_incoerente;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '000376: % contratti a termine con durata incoerente', v_n;
  END IF;
  RAISE NOTICE '000376: entrambe le sentinelle a zero sui dati correnti';
END $$;

COMMIT;
