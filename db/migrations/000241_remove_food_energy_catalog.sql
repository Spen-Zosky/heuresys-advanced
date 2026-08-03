-- 000241_remove_food_energy_catalog.sql
--
-- Rimozione del catalogo formativo di dominio alimentare ed energetico
-- (decisione di Enzo, 2026-08-03) e chiusura di una classe di contaminazione
-- che la 000235 non aveva catturato.
--
-- PARTE 1 — i corsi food/energy
-- 35 percorsi e 35 moduli: HACCP, BRCGS, FSSC 22000, ISO 22000, GMP, allergeni,
-- tracciabilita' alimentare · solare, eolico, idroelettrico, SCADA energia,
-- ISO 50001, LEED, stoccaggio. Sono il corredo formativo di SmartFood ed
-- EcoNova, ma il loro CODICE non nomina i due tenant (`ALLERG-001`, non
-- `CRS-smartfood-*`), per questo erano rimasti fuori dal criterio della 000235.
--
-- L'elenco e' esplicito e non una espressione regolare: le 35 voci sono state
-- lette una per una prima di scrivere questa migrazione, e un'espressione su
-- "energy" avrebbe potuto pescare corsi bancari legittimi su un altro clone.
-- Verifica che l'elenco sia giusto: `ESG Investing & Sustainable Finance` NON
-- c'e' — e' finanza sostenibile, materia da banca, e resta.
--
-- Misurato prima: 0 assegnazioni, 0 evidenze, 0 requisiti di posizione, 0 step,
-- 0 iniziative formative puntano a questo materiale. Gli unici riferimenti sono
-- 175 mappature competenza-modulo, figli strutturali rimossi qui.
--
-- PARTE 2 — i percorsi `PATH-econova-*` e `PATH-smartfood-*`
-- Dieci righe con codice pulito e NOME `OLDDB::learning_paths::<uuid>`: la
-- 000235 cercava la chiave-macchina nel CODICE e non nel NOME, e le ha mancate.
-- Nominano due aziende che non esistono in questo prodotto: stesso criterio
-- della bonifica, esecuzione incompleta. 0 assegnazioni su tutte e dieci.
--
-- NON si toccano i cinque `PATH-rtl-bank-*` e i cinque `PATH-heuresys-*`, che
-- appartengono ai due tenant reali: i primi portano 199 assegnazioni di 124
-- persone. Che il loro NOME sia una chiave-macchina illeggibile e' un difetto
-- di leggibilita' del catalogo, non contaminazione, e va corretto dando loro
-- un titolo — non cancellandoli.
BEGIN;

CREATE TEMP TABLE _percorsi_da_rimuovere ON COMMIT DROP AS
SELECT learning_path_id FROM sys.sys_learning_paths
 WHERE learning_path_code IN (
   'ALLERG-001','BLDG-EE-001','BRC-001','EE-AUDIT-001','ELEC-SAFE-001',
   'ESG-ENERGY-001','FDEF-001','FFRAUD-001','FSSC22000-001','FT-001',
   'FT-NUT-001','FT-PROC-001','GHG-001','GMP-001','GRID-001','HACCP-001',
   'HACCP-ADV-001','HYDRO-001','ISO14001-001','ISO22000-001','ISO50001-001',
   'ISO50001-LA-001','LCA-001','LEAN-FOOD-001','PM-ENERGY-001','QC-FOOD-001',
   'QC-LAB-001','REG-ENERGY-001','REG-EU-001','SCADA-001','SOLAR-001',
   'SQF-001','STORAGE-001','TRACE-001','WIND-001')
    OR learning_path_code ~ '^PATH-(econova|smartfood)-';

CREATE TEMP TABLE _moduli_da_rimuovere ON COMMIT DROP AS
SELECT learning_module_id FROM sys.sys_learning_modules
 WHERE learning_module_code IN (
   'ALLERG-001','BLDG-EE-001','BRC-001','EE-AUDIT-001','ELEC-SAFE-001',
   'ESG-ENERGY-001','FDEF-001','FFRAUD-001','FSSC22000-001','FT-001',
   'FT-NUT-001','FT-PROC-001','GHG-001','GMP-001','GRID-001','HACCP-001',
   'HACCP-ADV-001','HYDRO-001','ISO14001-001','ISO22000-001','ISO50001-001',
   'ISO50001-LA-001','LCA-001','LEAN-FOOD-001','PM-ENERGY-001','QC-FOOD-001',
   'QC-LAB-001','REG-ENERGY-001','REG-EU-001','SCADA-001','SOLAR-001',
   'SQF-001','STORAGE-001','TRACE-001','WIND-001');

-- Guardia: nessuna persona deve perdere un corso. Se una sola assegnazione o
-- evidenza compare, la premessa della misura non vale piu' e si ferma tutto.
DO $$
DECLARE v_ref bigint;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_user_learning_assignments a
           WHERE a.user_learning_assignment_path_id IN (SELECT learning_path_id FROM _percorsi_da_rimuovere)
              OR a.user_learning_assignment_module_id IN (SELECT learning_module_id FROM _moduli_da_rimuovere))
       + (SELECT count(*) FROM sys.sys_user_learning_evidence e
           WHERE e.user_learning_evidence_module_id IN (SELECT learning_module_id FROM _moduli_da_rimuovere))
       + (SELECT count(*) FROM sys.sys_position_learning_requirements r
           WHERE r.learning_path_id IN (SELECT learning_path_id FROM _percorsi_da_rimuovere))
       + (SELECT count(*) FROM sys.sys_training_initiatives t
           WHERE t.training_initiative_module_id IN (SELECT learning_module_id FROM _moduli_da_rimuovere))
    INTO v_ref;
  IF v_ref > 0 THEN
    RAISE EXCEPTION
      'Rimozione interrotta: % riferimenti di persone o posizioni puntano al '
      'catalogo food/energy. Vanno riassegnati prima di rimuoverlo.', v_ref;
  END IF;
END $$;

DELETE FROM sys.sys_skill_learning_mappings
 WHERE skill_learning_mapping_module_id IN (SELECT learning_module_id FROM _moduli_da_rimuovere);

DELETE FROM sys.sys_learning_path_steps
 WHERE learning_path_step_module_id IN (SELECT learning_module_id FROM _moduli_da_rimuovere)
    OR learning_path_step_path_id IN (SELECT learning_path_id FROM _percorsi_da_rimuovere);

DELETE FROM sys.sys_learning_modules m
 USING _moduli_da_rimuovere d WHERE m.learning_module_id = d.learning_module_id;

DELETE FROM sys.sys_learning_paths p
 USING _percorsi_da_rimuovere d WHERE p.learning_path_id = d.learning_path_id;

COMMIT;
