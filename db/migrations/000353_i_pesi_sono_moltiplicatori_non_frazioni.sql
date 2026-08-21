-- ============================================================================
-- 000353 — i pesi sono MOLTIPLICATORI, non frazioni: via i quattro vincoli che
--          la 000352 aveva messo dove non dovevano stare.
--
-- PERCHE' ESISTE QUESTO FILE. La `000352` (stessa sessione, poche ore prima) ha
-- vincolato dieci colonne `numeric(4,3)` all'intervallo 0..1. Per sei era
-- giusto; per quattro no, e la CI l'ha detto in venti minuti con due test
-- respinti dal vincolo:
--
--   sys_position_skill_requirements  ... PROFICIENT, 2.500, HIGH ...
--   sys_position_kpi_requirements    ... 5.000 ...
--
-- IL RAGIONAMENTO SBAGLIATO, scritto per intero perche' e' il valore di questo
-- file. I valori PRESENTI in produzione erano tutti dentro 0..1 — misurati, non
-- supposti: il piu' basso 0,129, il piu' alto 1,000. Da li' avevo concluso che
-- il dominio fosse 0..1. Ma i dati presenti non dicono il dominio AMMESSO:
-- dicono solo cosa e' stato scritto finora. Il dominio lo dichiara il contratto:
--
--   packages/shared/src/schemas/positions.ts
--     AddPositionSkillBodySchema.weight   z.number().min(0).max(10)
--     AddPositionKpiBodySchema.weight     z.number().min(0).max(9.999) // numeric(4,3)
--
-- Quel commento `// numeric(4,3)` accanto al `max(9.999)` e' la prova che il
-- tipo e' stato scelto APPOSTA per ammettere quel campo. Un peso di 2,5 non e'
-- un dato sporco: e' un moltiplicatore, e il modello lo prevede. Le confidenze
-- sono un'altra cosa — quelle sono probabilita', e per loro 0..1 resta giusto.
--
-- ⚠ ADR-0035, ed e' il motivo per cui i file sono DUE. Emendare la `000352`
-- (fatto) fa nascere corretto un database nuovo, ma non tocca i vincoli gia'
-- creati dove la catena e' passata — produzione compresa. Cancellare a valle
-- SENZA emendare a monte sarebbe stato peggio: la catena li rimetteva al giro
-- dopo. Servono entrambe le cose, ed e' esattamente il caso che la regola
-- descrive.
--
-- IDEMPOTENTE: `DROP CONSTRAINT IF EXISTS`, quindi la seconda corsa non trova
-- nulla e non protesta.
-- Authored: 2026-08-21 (S1077).
-- ============================================================================

ALTER TABLE sys.sys_position_skill_requirements
  DROP CONSTRAINT IF EXISTS ck_weight_0_1;

ALTER TABLE sys.sys_position_kpi_requirements
  DROP CONSTRAINT IF EXISTS ck_weight_0_1;

ALTER TABLE sys.sys_position_skill_requirement_history
  DROP CONSTRAINT IF EXISTS ck_position_skill_requirement_history_new_weight_0_1;

ALTER TABLE sys.sys_position_skill_requirement_history
  DROP CONSTRAINT IF EXISTS ck_position_skill_requirement_history_old_weight_0_1;

-- ----------------------------------------------------------------------------
-- Post-condizione, in due parti. La seconda e' quella che conta: protegge cio'
-- che NON doveva cambiare. Togliere quattro vincoli e' facile; togliere per
-- sbaglio anche i sei giusti sarebbe silenzioso.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  ancora_vincolate int;
  scoperte         int;
BEGIN
  -- (a) le quattro colonne di PESO non devono piu' avere un vincolo `<= 1`
  SELECT count(*) INTO ancora_vincolate FROM (VALUES
      ('sys_position_skill_requirements',        'weight'),
      ('sys_position_kpi_requirements',          'weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_new_weight'),
      ('sys_position_skill_requirement_history', 'position_skill_requirement_history_old_weight')
    ) AS t(tabella, colonna)
   WHERE EXISTS (
     SELECT 1 FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'sys' AND c.relname = t.tabella AND k.contype = 'c'
        AND pg_get_constraintdef(k.oid) LIKE '%' || t.colonna || '%'
        AND pg_get_constraintdef(k.oid) LIKE '%<= (1)%');
  IF ancora_vincolate <> 0 THEN
    RAISE EXCEPTION '000353: % colonne di peso portano ancora un vincolo <= 1', ancora_vincolate;
  END IF;

  -- (b) le SEI colonne 0..1 devono averlo ANCORA — questa e' la guardia negativa
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
    RAISE EXCEPTION '000353: % colonne che DOVEVANO restare 0..1 hanno perso il vincolo', scoperte;
  END IF;

  RAISE NOTICE '000353: i pesi sono liberi fino al dominio del tipo, le sei probabilita'' restano 0..1.';
END $$;
