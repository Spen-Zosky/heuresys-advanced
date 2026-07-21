-- ============================================================================
-- Migration 000191 — pulizia sentinella sporca '""' (dato legacy).
-- Scoperta durante il popolamento i18n (ADR-0029 wave-1, S1024): 218 righe di
-- cataloghi portavano la stringa LETTERALE di 2 caratteri `""` come
-- "descrizione" invece di NULL/testo reale — census dinamico su TUTTE le
-- colonne testuali sys.* (data_type varying/text/character):
--   sys_auth_permissions.description          181
--   sys_skill_families.description             24
--   sys_skill_proficiency_levels.description    6
--   sys_operating_model_catalog.description     6
--   sys_skill_categories.description            1
-- (nessun'altra colonna testuale sys.* contiene il sentinella; i `name` sono puliti.)
--
-- '""' non è testo: rompe i filtri, inquina l'harvest i18n e mostra `""`
-- all'utente. Normalizzato a NULL (assenza reale di descrizione). Le righe di
-- traduzione EN erroneamente harvestate da '""' vengono rimosse.
--
-- Generico + idempotente: itera le colonne testuali e azzera il sentinella;
-- al 2° giro 0 righe. Authored: 2026-07-21 (S1024).
-- ============================================================================

DO $$
DECLARE
  r record;
  n bigint;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       AND t.table_type = 'BASE TABLE'                -- solo tabelle reali, non viste
     WHERE c.table_schema = 'sys'
       AND c.data_type IN ('character varying', 'text', 'character')
       AND c.table_name <> 'sys_reference_translations'  -- gestita a parte sotto
     ORDER BY 1, 2
  LOOP
    EXECUTE format(
      'UPDATE sys.%I SET %I = NULL WHERE %I = ''""''',
      r.table_name, r.column_name, r.column_name);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'cleaned %.% : % rows', r.table_name, r.column_name, n;
    END IF;
  END LOOP;
END $$;

-- Righe di traduzione EN harvestate dal sentinella (spazzatura): rimuovi.
DELETE FROM sys.sys_reference_translations WHERE text = '""';

-- Post-condition: nessun sentinella residuo nelle colonne testuali sys.*
DO $$
DECLARE
  r record;
  n bigint;
  total bigint := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'sys'
       AND c.data_type IN ('character varying', 'text', 'character')
  LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I = ''""''',
                   r.table_name, r.column_name) INTO n;
    total := total + n;
  END LOOP;
  IF total > 0 THEN
    RAISE EXCEPTION '000191: % sentinella `""` residui in sys.*', total;
  END IF;
END $$;
