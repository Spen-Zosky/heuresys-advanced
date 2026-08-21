-- ============================================================================
-- 000352 — #222 F7 (rilievo F1-09): le SEI colonne che stanno davvero fra 0 e 1.
--
-- ⚠ QUESTO FILE E' STATO EMENDATO IL GIORNO STESSO IN CUI E' NATO, e la storia
-- va tenuta perche' l'errore e' istruttivo. La prima stesura vincolava DIECI
-- colonne `numeric(4,3)` all'intervallo 0..1, e il ragionamento era: «il tipo
-- ammette 9,999, ma confidenze e pesi stanno fra 0 e 1». La CI l'ha smentito
-- in venti minuti — due test respinti dal vincolo con `weight = 2.500` e
-- `weight = 5.000`.
--
-- COME MI SONO INGANNATO, che e' il punto. Avevo MISURATO i valori presenti in
-- produzione e li avevo trovati tutti dentro 0..1 (il piu' basso 0,129). Ma i
-- dati presenti non dicono il DOMINIO AMMESSO: dicono solo cosa e' stato scritto
-- finora. Il dominio lo dichiara il contratto, e il contratto dice l'opposto:
--     AddPositionSkillBodySchema.weight  z.number().min(0).max(10)
--     AddPositionKpiBodySchema.weight    z.number().min(0).max(9.999)  // numeric(4,3)
-- Quel commento `// numeric(4,3)` e' la prova che il tipo e' stato scelto APPOSTA
-- per ammettere quel campo: i pesi sono MOLTIPLICATORI, non frazioni. Solo le
-- confidenze sono probabilita', e per quelle 0..1 e' giusto.
-- Una misura vera che suggerisce una conclusione falsa: si legge il file che
-- DEFINISCE la cosa, non solo la cosa.
--
-- LE SEI CHE RESTANO, e perche' ognuna:
--   · activity_class_mapping_confidence     probabilita'
--   · esco_occupation_mapping_confidence    probabilita'
--   · occupation_class_mapping_confidence   probabilita'
--   · source_lineage_mapping_confidence     probabilita'
--   · organization_unit_kpi_template_weight contratto `z.number().min(0).max(1)`
--   · process_kpi_template_default_weight   contratto `z.number().min(0).max(1)`
--
-- LE QUATTRO USCITE — pesi con dominio dichiarato oltre 1:
--   · sys_position_skill_requirements.weight              (max 10)
--   · sys_position_kpi_requirements.weight                (max 9,999)
--   · sys_position_skill_requirement_history.new_weight   (storia della prima)
--   · sys_position_skill_requirement_history.old_weight   (storia della prima)
-- ADR-0035: emendare QUESTO file fa nascere giusto un database nuovo, ma non
-- toglie i quattro vincoli gia' creati dove la catena e' passata — lo fa la
-- `000353`, che esiste solo per quello.
--
-- LA CONVENZIONE NON E' INVENTATA QUI: quattro colonne dello stesso significato
-- hanno gia' questo vincolo, nella forma `col IS NULL OR (col >= 0 AND col <= 1)`
-- — `sys_positions.position_economic_weight`,
-- `sys_source_lineage_records.source_lineage_sdbi_confidence`,
-- `sys_blueprint_content_positions...economic_weight`,
-- `sys_user_position_assignments...fte`.
--
-- ⛔ CIO' CHE QUESTO FILE NON FA. `F1-09` nomina anche i tipi disallineati sulle
-- stesse semantiche — nome di competenza `varchar(255)` di qua e `text` di la'.
-- Non si toccano: in PostgreSQL i due hanno lo stesso immagazzinamento e le
-- stesse prestazioni, e il posto di quella correzione e' un dominio riusabile,
-- cioe' una decisione di modello, non una migrazione di pulizia.
--
-- IDEMPOTENTE: ogni vincolo si aggiunge solo se non c'e' gia'.
-- Authored: 2026-08-21 (S1077) · emendata lo stesso giorno dopo la CI.
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
    RAISE EXCEPTION '000352: % colonne 0..1 restano senza vincolo di intervallo', scoperte;
  END IF;
  RAISE NOTICE '000352: tutte e sei le colonne 0..1 hanno il vincolo.';
END $$;
