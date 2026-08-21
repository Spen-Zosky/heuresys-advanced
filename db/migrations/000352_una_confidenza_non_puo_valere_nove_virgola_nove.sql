-- ============================================================================
-- 000352 — #222 F7 (rilievo F1-09): dieci colonne il cui dominio ammette
--          9,999 dove il significato ammette 1.
--
-- IL DIFETTO. `numeric(4,3)` dichiara «quattro cifre di cui tre decimali»,
-- cioe' un dominio che arriva a 9,999. Ma queste dieci colonne portano
-- CONFIDENZE e PESI: quantita' che per definizione stanno fra 0 e 1. Il tipo
-- non lo dice, quindi non lo impedisce — e un peso di 7,5 entrerebbe senza che
-- nulla si lamenti, per poi comparire in una somma ponderata come un numero
-- qualsiasi.
--
-- MISURATO PRIMA (2026-08-21). I valori reali oggi in produzione:
--   sys_activity_classification_mappings.confidence    1,000 .. 1,000   3.257
--   sys_esco_occupation_mappings.confidence            0,129 .. 1,000   7.714
--   sys_occupation_classification_mappings.confidence     (nessuna riga)     0
--   sys_organization_unit_kpi_templates.weight         1,000 .. 1,000     100
--   sys_position_kpi_requirements.weight               0,250 .. 0,250     168
--   sys_position_skill_requirement_history.new_weight  1,000 .. 1,000     181
--   sys_position_skill_requirement_history.old_weight  1,000 .. 1,000     181
--   sys_position_skill_requirements.weight             0,400 .. 1,000   1.434
--   sys_process_kpi_templates.default_weight             (nessuna riga)     0
--   sys_source_lineage_records.mapping_confidence      0,850 .. 1,000  70.959
-- Nessun valore fuori intervallo: il vincolo si mette su dati gia' conformi e
-- non ha nulla da sanare. E' una GUARDIA per il futuro, non una correzione.
--
-- LA CONVENZIONE NON E' INVENTATA QUI: quattro colonne dello stesso significato
-- hanno gia' questo vincolo, nella forma `col IS NULL OR (col >= 0 AND col <= 1)`
-- — `sys_positions.position_economic_weight`,
-- `sys_source_lineage_records.source_lineage_sdbi_confidence`,
-- `sys_blueprint_content_positions...economic_weight`,
-- `sys_user_position_assignments...fte`. Il difetto era che la stessa semantica
-- fosse protetta in quattro punti e scoperta in dieci: e' quello lo squilibrio,
-- piu' della singola colonna.
--
-- ⛔ CIO' CHE QUESTO FILE NON FA. `F1-09` nomina anche i tipi disallineati sulle
-- stesse semantiche — nome di competenza `varchar(255)` di qua e `text` di la',
-- lingua `varchar(5)` nelle traduzioni e `varchar(16)` negli alias. Non si
-- toccano, e la ragione e' misurabile: in PostgreSQL `varchar(n)` e `text` hanno
-- lo stesso immagazzinamento e le stesse prestazioni — la differenza e' solo il
-- limite di lunghezza. Cambiare il tipo di una colonna viva significa toccare le
-- viste che la leggono e i tipi generati che la descrivono, per un beneficio che
-- e' di stile. Il posto giusto di quella correzione e' un dominio riusabile
-- dichiarato una volta, cioe' una decisione di modello, non una migrazione di
-- pulizia. Resta scritto nel registro come raccomandazione per il nuovo, non
-- come lavoro pendente su questo.
--
-- IDEMPOTENTE: ogni vincolo si aggiunge solo se non c'e' gia'.
-- Authored: 2026-08-21 (S1077).
-- ============================================================================

DO $$
DECLARE
  v record;
  nome text;
  fatti int := 0;
  gia   int := 0;
BEGIN
  FOR v IN SELECT * FROM (VALUES
      ('sys_activity_classification_mappings',   'activity_class_mapping_confidence'),
      ('sys_esco_occupation_mappings',           'esco_occupation_mapping_confidence'),
      ('sys_occupation_classification_mappings', 'occupation_class_mapping_confidence'),
      ('sys_organization_unit_kpi_templates',    'organization_unit_kpi_template_weight'),
      ('sys_position_kpi_requirements',          'weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_new_weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_old_weight'),
      ('sys_position_skill_requirements',        'weight'),
      ('sys_process_kpi_templates',              'process_kpi_template_default_weight'),
      ('sys_source_lineage_records',             'source_lineage_mapping_confidence')
    ) AS t(tabella, colonna)
  LOOP
    nome := 'ck_' || v.colonna || '_0_1';
    -- Il nome puo' superare i 63 caratteri dell'identificatore: si accorcia in
    -- modo deterministico, non a caso, cosi' la seconda corsa lo ritrova.
    IF length(nome) > 63 THEN
      nome := 'ck_' || substr(md5(v.tabella || '.' || v.colonna), 1, 20) || '_0_1';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint k
                JOIN pg_class c ON c.oid = k.conrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'sys' AND c.relname = v.tabella AND k.conname = nome) THEN
      gia := gia + 1;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE sys.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I >= 0 AND %I <= 1))',
      v.tabella, nome, v.colonna, v.colonna, v.colonna);
    fatti := fatti + 1;
  END LOOP;

  RAISE NOTICE '000352: vincoli di intervallo aggiunti = %, gia'' presenti = %', fatti, gia;
END $$;

-- ----------------------------------------------------------------------------
-- Post-condizione. Non conta i vincoli creati — quello direbbe solo che
-- qualcosa e' successo. Verifica che NESSUNA delle dieci colonne sia rimasta
-- scoperta, che e' l'affermazione che interessa.
-- ----------------------------------------------------------------------------
DO $$
DECLARE scoperte int;
BEGIN
  SELECT count(*) INTO scoperte FROM (VALUES
      ('sys_activity_classification_mappings',   'activity_class_mapping_confidence'),
      ('sys_esco_occupation_mappings',           'esco_occupation_mapping_confidence'),
      ('sys_occupation_classification_mappings', 'occupation_class_mapping_confidence'),
      ('sys_organization_unit_kpi_templates',    'organization_unit_kpi_template_weight'),
      ('sys_position_kpi_requirements',          'weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_new_weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_old_weight'),
      ('sys_position_skill_requirements',        'weight'),
      ('sys_process_kpi_templates',              'process_kpi_template_default_weight'),
      ('sys_source_lineage_records',             'source_lineage_mapping_confidence')
    ) AS t(tabella, colonna)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'sys' AND c.relname = t.tabella AND k.contype = 'c'
        AND pg_get_constraintdef(k.oid) LIKE '%' || t.colonna || '%'
        AND pg_get_constraintdef(k.oid) LIKE '%<= (1)%');

  IF scoperte <> 0 THEN
    RAISE EXCEPTION '000352: % colonne di confidenza/peso restano senza vincolo di intervallo', scoperte;
  END IF;
  RAISE NOTICE '000352: tutte e dieci le colonne hanno il vincolo 0..1.';
END $$;
