-- ═══════════════════════════════════════════════════════════════════════════════
-- 000308_le_predizioni_ritrovano_il_loro_modello.sql
--
-- LE PREDIZIONI RITROVANO IL MODELLO CHE LE HA PRODOTTE (debito D-82).
--
-- IL DIFETTO
--   `sys_model_predictions.prediction_model_id` era NULL su tutte e 468 le righe,
--   mentre `sys_predictive_models` ne contiene 4 attivi. La decisione di Enzo del
--   2026-08-04 su #126 chiedeva che all'interessato arrivasse *anche il modello e
--   la data, non il punteggio nudo*: la data c'era, il modello no. Meta' di quella
--   decisione non era servibile per mancanza di dato, non di codice.
--
-- LA MISURA PRIMA (2026-08-14, sul vivo — regola 4a del metodo di bonifica)
--   468 righe, 0 con modello, in tre tipi da 156 ciascuno:
--     PERFORMANCE 156 · TURNOVER 156 · GENERIC 156
--   4 modelli, tutti `active`, tutti dello stesso tenant delle predizioni.
--
-- ⚠ IL REGISTRO DEI DEBITI DESCRIVEVA IL PROBLEMA A META', E LA MISURA LO CORREGGE
--   D-82 diceva «ricostruire il legame dal tipo, derivabile per due tipi su tre;
--   GENERIC non va indovinato». La prima parte regge. La seconda aveva ragione
--   sulla conclusione ma non ne conosceva la CAUSA, che ora e' accertata:
--
--   Le 156 GENERIC portano in `prediction_metadata` un `legacy_model_id`
--   (`81a3c97f-d161-43e8-bfcc-d9322da1e3cc`) e il campo `unresolved_model` con lo
--   stesso valore. Quel modello **non e' fra i quattro importati**: i loro
--   `legacy_model_id` sono `9e1d3db7`, `b0a85797`, `0a55cd97`, `b16b6b1c`. E' un
--   QUINTO modello del legacy, mai portato in advanced. Le GENERIC non sono
--   «predizioni senza modello»: sono predizioni di un modello che non abbiamo
--   importato, e il dato lo dichiara da se'.
--
--   Le 156 PERFORMANCE e le 156 TURNOVER, all'opposto, NON hanno alcun
--   `legacy_model_id`: per loro non esiste un riferimento da risolvere, e la
--   derivazione dal tipo e' l'unica strada — ed e' fondata, perche' esiste
--   esattamente UN modello per ciascuna variabile bersaglio (la guardia lo
--   verifica invece di darlo per scontato).
--
--   Quindi le GENERIC restano NULL **per una ragione accertata e scritta**, non
--   per rinuncia. Il giorno in cui il quinto modello venisse importato, si
--   risolverebbero dal loro stesso metadata.
--
-- Rieseguibile. Prerequisiti: nessuno oltre alle tabelle.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- GUARDIA — ri-verifica la precondizione AL MOMENTO DELL'ESECUZIONE (regola 4b).
-- Non eredita la misura di ieri: se domani nascesse un secondo modello con lo
-- stesso bersaglio, la derivazione diventerebbe ambigua e questa migrazione DEVE
-- fermarsi invece di scegliere a caso.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_perf    int;
  n_turn    int;
  n_generic int;
BEGIN
  SELECT count(*) INTO n_perf
    FROM sys.sys_predictive_models
   WHERE model_target_variable = 'performance_rating' AND model_status = 'active';
  IF n_perf <> 1 THEN
    RAISE EXCEPTION 'Attesi 1 modello attivo per performance_rating, trovati %: la derivazione dal tipo sarebbe ambigua', n_perf;
  END IF;

  SELECT count(*) INTO n_turn
    FROM sys.sys_predictive_models
   WHERE model_target_variable = 'will_leave_6m' AND model_status = 'active';
  IF n_turn <> 1 THEN
    RAISE EXCEPTION 'Attesi 1 modello attivo per will_leave_6m, trovati %: la derivazione dal tipo sarebbe ambigua', n_turn;
  END IF;

  -- La causa dichiarata sopra dev'essere ancora vera: il modello delle GENERIC
  -- non e' fra gli importati. Se un giorno lo fosse, questa migrazione si ferma e
  -- qualcuno deve venire a risolverle DAL METADATA invece che lasciarle NULL.
  SELECT count(*) INTO n_generic
    FROM sys.sys_predictive_models m
   WHERE m.model_metadata->>'legacy_model_id' = '81a3c97f-d161-43e8-bfcc-d9322da1e3cc';
  IF n_generic <> 0 THEN
    RAISE EXCEPTION 'Il modello legacy delle predizioni GENERIC ORA esiste in advanced (% righe): vanno risolte dal loro metadata, non lasciate NULL', n_generic;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- ROLLBACK DICHIARATO (regola 4d) — il giornale conserva il PRIMO stato.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging.mig308_predictions_undo (
  prediction_id       uuid PRIMARY KEY,
  model_id_precedente uuid,
  salvato_il          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig308_predictions_undo (prediction_id, model_id_precedente)
SELECT prediction_id, prediction_model_id
  FROM sys.sys_model_predictions
 WHERE prediction_type IN ('PERFORMANCE', 'TURNOVER')
ON CONFLICT (prediction_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig308_predictions_undo_apply()
RETURNS int LANGUAGE plpgsql AS $undo$
DECLARE n int;
BEGIN
  UPDATE sys.sys_model_predictions p
     SET prediction_model_id = j.model_id_precedente
    FROM staging.mig308_predictions_undo j
   WHERE j.prediction_id = p.prediction_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $undo$;

-- ───────────────────────────────────────────────────────────────────────────────
-- LA SCRITTURA — elenco esplicito dei due tipi, mai un carattere jolly.
-- Il modello si risolve per VARIABILE BERSAGLIO, non per nome: il nome e'
-- un'etichetta che qualcuno puo' cambiare, il bersaglio e' cio' che il modello fa.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_model_predictions p
   SET prediction_model_id = m.model_id
  FROM sys.sys_predictive_models m
 WHERE p.prediction_type = 'PERFORMANCE'
   AND m.model_target_variable = 'performance_rating'
   AND m.model_status = 'active'
   AND p.prediction_tenant_id = m.model_tenant_id
   AND p.prediction_model_id IS DISTINCT FROM m.model_id;

UPDATE sys.sys_model_predictions p
   SET prediction_model_id = m.model_id
  FROM sys.sys_predictive_models m
 WHERE p.prediction_type = 'TURNOVER'
   AND m.model_target_variable = 'will_leave_6m'
   AND m.model_status = 'active'
   AND p.prediction_tenant_id = m.model_tenant_id
   AND p.prediction_model_id IS DISTINCT FROM m.model_id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — la 2 e la 3 proteggono cio' che NON doveva cambiare (regola 4c).
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_scoperte   int;
  n_generic    int;
  n_gen_non_null int;
  n_totale     int;
  n_tenant_rotto int;
BEGIN
  -- 1. Nessuna PERFORMANCE o TURNOVER resta senza modello.
  SELECT count(*) INTO n_scoperte
    FROM sys.sys_model_predictions
   WHERE prediction_type IN ('PERFORMANCE', 'TURNOVER') AND prediction_model_id IS NULL;
  IF n_scoperte <> 0 THEN
    RAISE EXCEPTION '% predizioni PERFORMANCE/TURNOVER restano senza modello', n_scoperte;
  END IF;

  -- 2. PROTEGGE LE GENERIC: devono restare NULL, ed essere ancora 156. Se una
  --    venisse valorizzata, qualcuno avrebbe indovinato — che e' esattamente cio'
  --    che questa migrazione si vieta.
  SELECT count(*), count(*) FILTER (WHERE prediction_model_id IS NOT NULL)
    INTO n_generic, n_gen_non_null
    FROM sys.sys_model_predictions WHERE prediction_type = 'GENERIC';
  IF n_generic = 0 THEN
    RAISE EXCEPTION 'Nessuna predizione GENERIC: la verifica che le protegge misurerebbe il vuoto';
  END IF;
  IF n_gen_non_null <> 0 THEN
    RAISE EXCEPTION '% predizioni GENERIC hanno ricevuto un modello: nessuno doveva indovinarlo', n_gen_non_null;
  END IF;

  -- 3. PROTEGGE IL TOTALE: nessuna riga creata o persa.
  SELECT count(*) INTO n_totale FROM sys.sys_model_predictions;
  IF n_totale <> 468 THEN
    RAISE EXCEPTION 'Le predizioni sono % invece di 468: questa migrazione collega, non crea ne'' cancella', n_totale;
  END IF;

  -- 4. Il legame non attraversa i tenant (I5: l'isolamento e' FK + filtro).
  SELECT count(*) INTO n_tenant_rotto
    FROM sys.sys_model_predictions p
    JOIN sys.sys_predictive_models m ON m.model_id = p.prediction_model_id
   WHERE p.prediction_tenant_id <> m.model_tenant_id;
  IF n_tenant_rotto <> 0 THEN
    RAISE EXCEPTION '% predizioni sono legate a un modello di un ALTRO tenant', n_tenant_rotto;
  END IF;

  RAISE NOTICE 'OK — 312 predizioni PERFORMANCE/TURNOVER legate al loro modello; % GENERIC restano NULL per causa accertata (modello legacy non importato); totale % intatto; nessun legame cross-tenant.',
               n_generic, n_totale;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK:  SELECT staging.mig308_predictions_undo_apply();
-- ═══════════════════════════════════════════════════════════════════════════════
