-- ============================================================================================
-- 000491 — La sentinella dei processi senza indicatori guarda il modello IN USO
--          (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md, scoperta S3).
--
-- PERCHÉ. sys.v_processi_senza_kpi esisteva nel database ma nessun file del repository la creava, e contava
-- i processi di OGNI versione di modello. Dalla 000463 ogni tenant adotta la propria versione, e dalla C3
-- una corsa del datastore si accoglie come versione nuova senza scrivere indicatori di piattaforma: la
-- corsa p20261010010521tjb, accolta il 2026-11-14 per essere confrontata, ha acceso la sentinella con 30
-- processi che nessun tenant usa. Un processo «che il prodotto descrive e non sa valutare» è un processo del
-- modello che un tenant ha adottato: la vista conta quelli, cioè i processi delle versioni fissate da
-- un'attivazione ACTIVE (o, dove l'attivazione non fissa una versione, delle versioni pubblicate della sua
-- variante, il ripiego di lib/scope/profilo.ts).
--
-- Stesse colonne di prima (CREATE OR REPLACE). IDEMPOTENTE. Nessun dato scritto.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE VIEW sys.v_processi_senza_kpi AS
SELECT r.blueprint_process_code,
       r.blueprint_process_name
  FROM sys.sys_blueprint_process_registry r
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_process_kpi_templates t
                    WHERE t.process_kpi_template_process_id = r.blueprint_process_id)
   AND EXISTS (SELECT 1
                 FROM sys.sys_blueprint_activations a
                 JOIN sys.sys_blueprint_variant_versions vv
                   ON vv.blueprint_variant_version_id = r.blueprint_process_variant_version_id
                WHERE a.blueprint_activation_status = 'ACTIVE'
                  AND (a.blueprint_activation_variant_version_id = vv.blueprint_variant_version_id
                       OR (a.blueprint_activation_variant_version_id IS NULL
                           AND a.blueprint_activation_variant_id = vv.blueprint_variant_version_variant_id
                           AND vv.blueprint_variant_version_status = 'PUBLISHED')));

COMMENT ON VIEW sys.v_processi_senza_kpi IS
  'Processi del modello IN USO (versione fissata da un''attivazione ACTIVE) che nessun KPI misura. Da tenere a zero: un processo senza KPI e'' un pezzo di azienda che il prodotto descrive e non sa valutare. Le versioni accolte e non adottate non contano (000491).';

COMMIT;
