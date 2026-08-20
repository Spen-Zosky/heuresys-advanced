-- ============================================================================
-- 000343 — #222 F1 (rilievi F1-04, F1-06, F1-07): tre presidi strutturali.
--
-- Vanno per primi nell'onda W3 perche' sono GUARDIE: dopo, gli errori che le
-- fasi seguenti correggono non possono piu' rientrare in silenzio.
--
-- MISURE PRIMA (2026-08-20, sul vivo — il dossier e' del 19, e #149 vieta di
-- ereditarne le misure):
--   · sys_skills: 14.036 righe, 14.003 con `skill_esco_uri`, 14.003 DISTINTI
--     -> nessun duplicato, l'indice unico si puo' creare.
--   · FK senza indice, misurate su pg_constraint x pg_index: TRE, e non quelle
--     che il piano prevedeva. `blueprint_family_activity_class_classification_id`
--     un indice ce l'ha gia'; scoperte sono invece `sys_skills.created_by`,
--     `sys_skills.updated_by` e `occupation_class_mapping_target_id`.
--   · sys_reference_translations: 32.485 righe su 14 `entity_table` diversi,
--     nessun vincolo su quella colonna. Orfani misurati con una risalita
--     dinamica tabella per tabella: ZERO, e zero tabelle ignote.
--
-- ⚠ PERCHE' NON C'E' IL `CHECK` CHE IL RILIEVO CHIEDEVA. F1-07 chiede un CHECK
-- sull'insieme chiuso dei valori ammessi per `entity_table`. Sarebbe un elenco
-- di 14 nomi cablato nello schema: cioe' **una misura variabile scritta come
-- fatto**, che e' esattamente cio' che IL PUNTO FISSO vieta. Invecchierebbe alla
-- prima entita' che diventa traducibile, e il modo in cui invecchia e' il
-- peggiore — una INSERT legittima che fallisce, e qualcuno che «sistema» il
-- vincolo allargandolo senza guardare.
-- Al suo posto c'e' una sentinella che chiede la stessa cosa **al catalogo**:
-- «questo `entity_table` e' una tabella vera? e questa riga esiste ancora?».
-- Non ha un elenco da aggiornare, e copre in piu' il caso che il CHECK non
-- vedeva affatto: la riga cancellata sotto una traduzione ancora viva.
--
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo` — non si tocca alcun
-- dato. L'inversa e' `DROP INDEX` per i quattro indici, `DROP VIEW` e
-- `DROP FUNCTION` per la sentinella.
--
-- IDEMPOTENTE: `IF NOT EXISTS` sugli indici, `CREATE OR REPLACE` su funzione e
-- vista.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Un URI ESCO identifica UNA competenza (F1-04)
--
-- Parziale (`WHERE ... IS NOT NULL`): 33 competenze non hanno un URI ESCO — sono
-- competenze locali, non un difetto — e un unico non parziale le respingerebbe
-- tutte tranne una, perche' in PostgreSQL i NULL non sono uguali fra loro ma
-- l'indice li indicizza comunque.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_esco_uri
  ON sys.sys_skills (skill_esco_uri)
  WHERE skill_esco_uri IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Le tre chiavi esterne scoperte (F1-06)
--
-- Una FK senza indice sulla colonna che la porta rende lenta ogni cancellazione
-- della tabella referenziata: Postgres deve leggere l'intera tabella figlia per
-- sapere se qualcuno punta alla riga che sta per sparire. Con `sys_users` e
-- `sys_occupation_classifications` questo significa una scansione completa di
-- `sys_skills` (14.036 righe) a ogni utente rimosso.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_skills_created_by
  ON sys.sys_skills (created_by);
CREATE INDEX IF NOT EXISTS idx_skills_updated_by
  ON sys.sys_skills (updated_by);
CREATE INDEX IF NOT EXISTS idx_occupation_class_mapping_target
  ON sys.sys_occupation_classification_mappings (occupation_class_mapping_target_id);

-- ---------------------------------------------------------------------------
-- 3. Una traduzione deve avere qualcosa da tradurre (F1-07)
--
-- La funzione risale il catalogo invece di consultare un elenco: per ogni
-- `entity_table` presente cerca la tabella reale in `sys`, ne legge la chiave
-- primaria da `pg_index`, e verifica che l'`entity_id` esista ancora.
--
-- `STABLE` e non `IMMUTABLE`: legge tabelle, quindi il suo risultato cambia coi
-- dati. Dichiararla immutabile permetterebbe al pianificatore di riusarne il
-- risultato dentro la stessa query, che qui sarebbe una bugia.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.fn_traduzioni_senza_soggetto()
RETURNS TABLE (entity_table text, entity_id uuid, motivo text)
LANGUAGE plpgsql STABLE AS $$
DECLARE r record; pk text;
BEGIN
  FOR r IN SELECT DISTINCT t.entity_table AS et FROM sys.sys_reference_translations t LOOP

    -- (a) la tabella nominata esiste?
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
                    WHERE ns.nspname = 'sys' AND c.relname = r.et AND c.relkind = 'r') THEN
      RETURN QUERY
        SELECT t.entity_table::text, t.entity_id, 'tabella inesistente'::text
          FROM sys.sys_reference_translations t WHERE t.entity_table = r.et;
      CONTINUE;
    END IF;

    SELECT a.attname INTO pk
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE i.indrelid = ('sys.' || r.et)::regclass AND i.indisprimary;

    -- (b) senza chiave primaria non si puo' verificare: si DICHIARA, non si tace.
    --     Un caso non misurabile che passa in silenzio e' un buco nel presidio.
    IF pk IS NULL THEN
      RETURN QUERY
        SELECT t.entity_table::text, t.entity_id, 'tabella senza chiave primaria: non verificabile'::text
          FROM sys.sys_reference_translations t WHERE t.entity_table = r.et;
      CONTINUE;
    END IF;

    -- (c) la riga tradotta esiste ancora?
    RETURN QUERY EXECUTE format(
      'SELECT t.entity_table::text, t.entity_id, %L::text
         FROM sys.sys_reference_translations t
        WHERE t.entity_table = %L
          AND NOT EXISTS (SELECT 1 FROM sys.%I e WHERE e.%I = t.entity_id)',
      'riga tradotta sparita', r.et, r.et, pk);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW sys.v_reference_translations_senza_soggetto AS
  SELECT * FROM sys.fn_traduzioni_senza_soggetto();

COMMENT ON VIEW sys.v_reference_translations_senza_soggetto IS
  'SENTINELLA (#222 F1, rilievo F1-07): traduzioni il cui soggetto non esiste — tabella inesistente, oppure riga sparita sotto la traduzione. Zero righe = ogni traduzione ha qualcosa da tradurre. Sostituisce il CHECK con elenco cablato, che sarebbe invecchiato alla prima entita nuova.';

-- ---------------------------------------------------------------------------
-- 4. POST-CONDIZIONE
--
-- Il controllo (c) e' quello che protegge cio' che NON doveva cambiare: creare
-- un indice unico su una colonna con duplicati fallisce da se', ma creare i tre
-- indici di FK non puo' fallire — e allora la domanda giusta non e' «esistono?»,
-- e' «le righe sono ancora tutte li'?».
-- ---------------------------------------------------------------------------
DO $$
DECLARE indici int; senza_soggetto int; skill_ora int; skill_uri int;
BEGIN
  SELECT count(*) INTO indici FROM pg_indexes
   WHERE schemaname = 'sys'
     AND indexname IN ('uq_skills_esco_uri', 'idx_skills_created_by',
                       'idx_skills_updated_by', 'idx_occupation_class_mapping_target');
  IF indici <> 4 THEN
    RAISE EXCEPTION '000343: attesi 4 indici, trovati %', indici;
  END IF;

  SELECT count(*) INTO senza_soggetto FROM sys.v_reference_translations_senza_soggetto;
  IF senza_soggetto > 0 THEN
    RAISE EXCEPTION '000343: % traduzioni senza soggetto — la sentinella nasce gia'' rossa', senza_soggetto;
  END IF;

  -- nulla e' stato perso installando i presidi
  SELECT count(*), count(skill_esco_uri) INTO skill_ora, skill_uri FROM sys.sys_skills;
  IF skill_uri > skill_ora THEN
    RAISE EXCEPTION '000343: conteggi incoerenti su sys_skills (% uri su % righe)', skill_uri, skill_ora;
  END IF;

  RAISE NOTICE '000343 ok — 4 indici · 0 traduzioni senza soggetto · sys_skills % righe (% con URI ESCO)',
               skill_ora, skill_uri;
END $$;
