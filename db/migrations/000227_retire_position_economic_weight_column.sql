-- 000227_retire_position_economic_weight_column.sql
-- #88 — il "peso economico" delle posizioni era un campo vuoto su cui si progettava.
--
-- Misurato (2026-08-02, database vivo): tre sedi con nomi quasi identici e semantiche
-- incompatibili fra loro —
--
--   sys_positions.position_economic_weight                  0 valorizzati su 181
--   sys_position_compensation_profiles.economic_weight     13 valorizzati su 172, scala 0,5-1,0
--   sys_position_economic_weight (tabella)                 24 posizioni, valori 333-568
--                                                          = punti di job evaluation legacy
--
-- La prima era letta da capability-composition come massa di aggregazione delle unità
-- organizzative, dentro un COALESCE(economic_weight, criticalityFactor, 1). Essendo NULL
-- ovunque, quel COALESCE cadeva SEMPRE sul ripiego, e la criticità è MEDIUM su 160 posizioni
-- su 181: il roll-up per unità era di fatto una media NON pesata travestita da media pesata.
--
-- Popolarla dalla tabella dedicata sarebbe stato l'errore peggiore: quei valori sono punti di
-- job evaluation (333-568), due ordini di grandezza sopra la scala 0,5-2,0 del ripiego. Sarebbe
-- passato senza rumore e avrebbe distorto ogni aggregato.
--
-- Decisione: la colonna è RITIRATA come base di calcolo. La base economica è la fascia
-- retributiva (sys_compensation_bands via sys_position_compensation_profiles, 169/177 posizioni
-- su RTL), che è la stessa già usata da F1 (essential ranking) e F2 (VRIO) — una sola nozione
-- di valore economico invece di tre.
--
-- La colonna NON viene eliminata: un DROP è irreversibile e non serve a nulla qui. Resta in
-- schema con un commento che dice a chi la incontra di non progettarci sopra.
-- Idempotente: COMMENT ON è sempre ri-eseguibile.

COMMENT ON COLUMN sys.sys_positions.position_economic_weight IS
  'RITIRATA (#88, 2026-08-02) — mai popolata, nessun lettore. La base economica di una posizione '
  'e'' la fascia retributiva: sys_position_compensation_profiles -> sys_compensation_bands, la '
  'stessa fonte usata da essential-ranking (F1), VRIO (F2) e dalla massa di aggregazione di '
  'capability-composition. Non ripopolare questa colonna senza un ADR: due motori userebbero '
  'basi economiche diverse.';

COMMENT ON TABLE sys.sys_position_economic_weight IS
  'Punti di JOB EVALUATION importati dal legacy (metadata.legacy.source_table = job_evaluations), '
  'scala 333-568 su 24 posizioni. NON e'' un peso di aggregazione e non e'' sulla stessa scala del '
  'fattore di criticita'' (0,5-2,0): usarla come tale distorce gli aggregati di due ordini di '
  'grandezza. Vedi #88.';
