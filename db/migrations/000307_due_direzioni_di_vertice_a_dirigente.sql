-- ═══════════════════════════════════════════════════════════════════════════════
-- 000307_due_direzioni_di_vertice_a_dirigente.sql
--
-- DUE RESPONSABILI DI DIREZIONE DI PRIMO LIVELLO DIVENTANO DIRIGENTI.
--
-- Decisione di Enzo del 2026-08-14. E' lo stesso difetto che #118 ha corretto un
-- gradino piu' in basso (mig. 000264): la nomina c'e' — reggono un'unita' che
-- riporta direttamente alla Direzione Generale — ma l'inquadramento non la segue.
--
-- CHI, E PERCHE' SOLO DUE
--   `matteo.lombardi` (Direzione Internal Audit, QD4) e `andrea.martino`
--   (Direzione Compliance e Protezione Dati, QD4).
--
--   ⚠ Un TERZO caso esiste e resta fuori PER DECISIONE ESPLICITA di Enzo:
--   `roberta.benedetti` (Direzione Affari Legali e Societari) e' ancora QD3, ma
--   e' stata promossa dalle aree professionali a QD3 il 2026-08-04 dalla mig.
--   000264 — dieci giorni fa. Un secondo salto a distanza di dieci giorni non e'
--   una correzione di dato, e' una decisione di carriera diversa. Resta QD3, e la
--   verifica 3 qui sotto PROTEGGE quella scelta invece di limitarsi a ignorarla.
--
-- COSA NON SI TOCCA, E PERCHE' NON E' UNA OMISSIONE
--   La retribuzione e la fascia restano dove sono (90.000 e 88.000 su `MG-1`
--   [85.000-130.000]). Tre ragioni, misurate:
--
--   1. Le due retribuzioni cadono DENTRO la fascia che le due posizioni gia'
--      portano, quindi la verifica X3a resta verde senza toccare nulla.
--   2. Spostare la fascia a `EX-2` [120.000-190.000] — quella dei Dirigenti RTL —
--      li porterebbe SOTTO il minimo di fascia, e X3a diventerebbe rossa. Muovere
--      la fascia senza muovere la retribuzione e' proprio il difetto che la 000262
--      e la 000264 hanno corretto: non lo si reintroduce.
--   3. Un aumento e' una decisione di business. Enzo ha deciso il livello; sulla
--      retribuzione non ha dato una regola, e inventarne una qui significherebbe
--      decidere al posto suo su 178.000 EUR di massa salariale.
--
--   ⚠ CONSEGUENZA DICHIARATA, non nascosta: dopo questa migrazione i Dirigenti RTL
--   sono 11 e i due piu' bassi prendono 88.000 e 90.000 contro un minimo di coorte
--   che era 135.553. La scala resta ORDINATA (verifica 5), ma la coorte dirigenziale
--   si allarga verso il basso. Se Enzo vorra' allineare anche la retribuzione, sara'
--   una migrazione successiva con la sua regola di collocazione — come fu il #120
--   per il #118.
--
-- Le persone si risolvono PER EMAIL, mai per identificativo.
-- Rieseguibile. Prerequisiti: 000264 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- La decisione, scritta una volta sola.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE decisione_307 (email text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO decisione_307 (email) VALUES
  ('matteo.lombardi@rtl-bank.org'),
  ('andrea.martino@rtl-bank.org');

-- ───────────────────────────────────────────────────────────────────────────────
-- GUARDIA — ri-verifica la precondizione AL MOMENTO DELL'ESECUZIONE, non eredita
-- la misura di ieri. Tre condizioni, e ognuna puo' fermare la migrazione.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_orfane   int;
  n_non_capi int;
  n_liv1     int;
BEGIN
  -- (i) ogni email corrisponde a una persona reale
  SELECT count(*) INTO n_orfane
    FROM decisione_307 d
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE lower(u.user_email) = lower(d.email));
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION 'Decisione riferita a % email che non corrispondono ad alcuna persona', n_orfane;
  END IF;

  -- (ii) reggono DAVVERO un'unita' attiva. Se domani non la reggessero piu', la
  --      ragione della promozione sarebbe decaduta e questa migrazione DEVE
  --      fermarsi invece di applicare una decisione che non ha piu' la sua causa.
  SELECT count(*) INTO n_non_capi
    FROM decisione_307 d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_organization_units ou
      WHERE ou.organization_unit_manager_user_id = u.user_id
        AND ou.organization_unit_is_active);
  IF n_non_capi <> 0 THEN
    RAISE EXCEPTION '% delle persone da promuovere non reggono piu'' alcuna unita'' attiva: la ragione della promozione e'' decaduta', n_non_capi;
  END IF;

  -- (iii) l'unita' che reggono e' di PRIMO livello (riporta alla radice del tenant).
  --       E' la condizione che distingue questo caso dai 28 responsabili QD3/QD4
  --       piu' in basso, per i quali l'inquadramento e' corretto com'e'.
  WITH RECURSIVE albero AS (
    SELECT organization_unit_id, organization_unit_manager_user_id, 0 AS liv
      FROM sys.sys_organization_units
     WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
    UNION ALL
    SELECT o.organization_unit_id, o.organization_unit_manager_user_id, a.liv + 1
      FROM sys.sys_organization_units o
      JOIN albero a ON o.organization_unit_parent_id = a.organization_unit_id
     WHERE o.organization_unit_is_active
  )
  SELECT count(DISTINCT u.user_id) INTO n_liv1
    FROM decisione_307 d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
    JOIN albero a ON a.organization_unit_manager_user_id = u.user_id
   WHERE a.liv = 1;
  IF n_liv1 <> (SELECT count(*) FROM decisione_307) THEN
    RAISE EXCEPTION 'Solo % delle % persone reggono un''unita'' di PRIMO livello: la premessa della decisione non regge',
                    n_liv1, (SELECT count(*) FROM decisione_307);
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- ROLLBACK DICHIARATO — il giornale conserva il PRIMO stato, non quello di ieri
-- (`DO NOTHING`: la catena si ri-applica a ogni deploy).
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging.mig307_dirigenti_undo (
  user_id             uuid PRIMARY KEY,
  livello_contratto   varchar(32),
  livello_impiego     varchar(32),
  salvato_il          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig307_dirigenti_undo (user_id, livello_contratto, livello_impiego)
SELECT u.user_id, c.user_contract_ccnl_level, e.user_employment_pay_scale_level
  FROM decisione_307 d
  JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
  JOIN sys.sys_user_contracts c
    ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
  LEFT JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig307_dirigenti_undo_apply()
RETURNS int LANGUAGE plpgsql AS $undo$
DECLARE n int;
BEGIN
  UPDATE sys.sys_user_contracts c
     SET user_contract_ccnl_level = j.livello_contratto, updated_at = now()
    FROM staging.mig307_dirigenti_undo j
   WHERE j.user_id = c.user_contract_user_id AND c.user_contract_status = 'ACTIVE';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE sys.sys_user_employment e
     SET user_employment_pay_scale_level = j.livello_impiego, updated_at = now()
    FROM staging.mig307_dirigenti_undo j
   WHERE j.user_id = e.user_employment_user_id;
  RETURN n;
END $undo$;

-- ───────────────────────────────────────────────────────────────────────────────
-- IL LIVELLO — sul contratto…
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_contracts c
   SET user_contract_ccnl_level = 'Dirigente',
       updated_at = now()
  FROM sys.sys_users u, decisione_307 d
 WHERE u.user_id = c.user_contract_user_id
   AND lower(u.user_email) = lower(d.email)
   AND c.user_contract_status = 'ACTIVE'
   AND c.user_contract_ccnl_level IS DISTINCT FROM 'Dirigente';

-- ───────────────────────────────────────────────────────────────────────────────
-- …E DOVE LA PERSONA LO LEGGE. E' la lezione della 000264 §D: contratto e scheda
-- d'impiego sono due posti, e `/v1/me/profile/full` mostra il secondo. Promuovere
-- solo il contratto significa lasciare la persona a vedere il vecchio
-- inquadramento nel PROPRIO portale.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_employment e
   SET user_employment_pay_scale_level = c.user_contract_ccnl_level,
       updated_at = now()
  FROM sys.sys_user_contracts c, sys.sys_users u, decisione_307 d
 WHERE c.user_contract_user_id = e.user_employment_user_id
   AND u.user_id = e.user_employment_user_id
   AND lower(u.user_email) = lower(d.email)
   AND c.user_contract_status = 'ACTIVE'
   AND e.user_employment_pay_scale_level IS DISTINCT FROM c.user_contract_ccnl_level;

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — principi, non conteggi congelati. Le verifiche 2, 3 e 4
-- proteggono cio' che NON doveva cambiare.
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_non_dir      int;
  n_ral_mossa    int;
  n_fascia_mossa int;
  liv_benedetti  varchar(32);
  n_fuori_fascia int;
  n_universo     int;
  n_impiego      int;
  med_dir        numeric;
  med_qd4        numeric;
BEGIN
  -- 1. Entrambi risultano Dirigenti.
  SELECT count(*) INTO n_non_dir
    FROM decisione_307 d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
   WHERE c.user_contract_ccnl_level <> 'Dirigente';
  IF n_non_dir <> 0 THEN
    RAISE EXCEPTION '% dei due non risultano Dirigenti', n_non_dir;
  END IF;

  -- 2. PROTEGGE: la retribuzione dei due NON e' cambiata. Sono i valori misurati
  --    prima della scrittura; se una futura migrazione li muovesse, questa riga
  --    lo direbbe invece di lasciarlo passare in silenzio.
  SELECT count(*) INTO n_ral_mossa
    FROM sys.sys_users u
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
   WHERE (lower(u.user_email) = 'matteo.lombardi@rtl-bank.org' AND c.user_contract_gross_annual_salary <> 90000.00)
      OR (lower(u.user_email) = 'andrea.martino@rtl-bank.org'  AND c.user_contract_gross_annual_salary <> 88000.00);
  IF n_ral_mossa <> 0 THEN
    RAISE EXCEPTION 'La retribuzione dei due e'' cambiata (% righe): questa migrazione muove il livello, non la paga', n_ral_mossa;
  END IF;

  -- 3. PROTEGGE LA DECISIONE DI ENZO: `roberta.benedetti` resta QD3. E' il terzo
  --    caso, escluso apposta perche' promossa dieci giorni fa.
  SELECT c.user_contract_ccnl_level INTO liv_benedetti
    FROM sys.sys_users u
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
   WHERE lower(u.user_email) = 'roberta.benedetti@rtl-bank.org';
  IF liv_benedetti IS NULL THEN
    RAISE EXCEPTION 'roberta.benedetti non ha un contratto attivo: la verifica che la protegge non puo'' misurare nulla';
  END IF;
  IF liv_benedetti <> 'QD3' THEN
    RAISE EXCEPTION 'roberta.benedetti risulta % invece di QD3: la decisione di lasciarla fuori e'' stata scavalcata', liv_benedetti;
  END IF;

  -- 4. PROTEGGE: la fascia delle due posizioni non si e' mossa da MG-1.
  SELECT count(*) INTO n_fascia_mossa
    FROM decisione_307 d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = u.user_id AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_position_compensation_profiles pc ON pc.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pc.compensation_band_id
   WHERE b.compensation_band_code <> 'MG-1';
  IF n_fascia_mossa <> 0 THEN
    RAISE EXCEPTION '% posizioni dei due hanno cambiato fascia: doveva restare MG-1', n_fascia_mossa;
  END IF;

  -- 5. X3a: nessuna retribuzione fuori dalla fascia della propria posizione, e
  --    l'universo NON dev'essere vuoto, altrimenti lo zero non dimostra niente.
  SELECT count(*) FILTER (WHERE c.user_contract_gross_annual_salary < b.compensation_band_min_eur
                             OR c.user_contract_gross_annual_salary > b.compensation_band_max_eur),
         count(*)
    INTO n_fuori_fascia, n_universo
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
    JOIN sys.sys_position_compensation_profiles pc ON pc.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pc.compensation_band_id
   WHERE a.user_position_assignment_status = 'ACTIVE'
     AND c.user_contract_gross_annual_salary IS NOT NULL;
  IF n_universo = 0 THEN
    RAISE EXCEPTION 'X3a misura su un universo vuoto: lo zero non dimostrerebbe nulla';
  END IF;
  IF n_fuori_fascia <> 0 THEN
    RAISE EXCEPTION 'X3a: % retribuzioni fuori dalla fascia della posizione (universo %)', n_fuori_fascia, n_universo;
  END IF;

  -- 6. La scala resta ORDINATA: la mediana Dirigente non scende sotto quella QD4.
  --    E' la conseguenza dichiarata in testa, qui misurata invece che sperata.
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY user_contract_gross_annual_salary)
         FILTER (WHERE user_contract_ccnl_level = 'Dirigente'),
         percentile_cont(0.5) WITHIN GROUP (ORDER BY user_contract_gross_annual_salary)
         FILTER (WHERE user_contract_ccnl_level = 'QD4')
    INTO med_dir, med_qd4
    FROM sys.sys_user_contracts WHERE user_contract_status = 'ACTIVE';
  IF med_dir IS NULL OR med_qd4 IS NULL THEN
    RAISE EXCEPTION 'Mediane non calcolabili: Dirigente=% QD4=%', med_dir, med_qd4;
  END IF;
  IF med_dir <= med_qd4 THEN
    RAISE EXCEPTION 'La mediana Dirigente (%) e'' scesa sotto quella QD4 (%): la scala non e'' piu'' ordinata', med_dir, med_qd4;
  END IF;

  -- 7. Contratto e scheda d'impiego coerenti su TUTTI, non solo sui due: se un
  --    altro seed li disallineasse, va visto qui.
  SELECT count(*) INTO n_impiego
    FROM sys.sys_user_employment e
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = e.user_employment_user_id AND c.user_contract_status = 'ACTIVE'
   WHERE e.user_employment_pay_scale_level IS DISTINCT FROM c.user_contract_ccnl_level;
  IF n_impiego <> 0 THEN
    RAISE EXCEPTION '% schede d''impiego non rispecchiano l''inquadramento del contratto', n_impiego;
  END IF;

  RAISE NOTICE 'OK — due Direzioni di primo livello a Dirigente; retribuzioni e fasce intatte; benedetti resta QD3; X3a a zero su universo %; mediana Dirigente % > QD4 %; schede d''impiego allineate.',
               n_universo, med_dir, med_qd4;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK:  SELECT staging.mig307_dirigenti_undo_apply();
-- ═══════════════════════════════════════════════════════════════════════════════
