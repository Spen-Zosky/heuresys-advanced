-- ============================================================================
-- Migration 000274 — #151: la sentinella dell'organigramma ignora le unità ritirate
-- ----------------------------------------------------------------------------
-- `sys.v_organization_unit_integrity` non filtrava `organization_unit_is_active`:
-- segnalava `senza_responsabile` per ogni unità RITIRATA, che per definizione un
-- responsabile non ce l'ha più. Al 2026-08-06 erano due — «Divisione Risk &
-- Compliance» e «Direzione Corporate Banking», chiuse il 2026-08-04 dalla
-- ricostruzione dell'organigramma stessa (000244-000251).
--
-- Il difetto era PERMANENTE e crescente: ogni unità chiusa in futuro avrebbe
-- aggiunto un falso positivo, fino a rendere la sentinella illeggibile — cioè
-- inutile proprio quando serve. Scoperto dal triage di S1047 misurando #146.
--
-- Prova che era un falso positivo e non un dato sbagliato: la vista contava
-- `senza_responsabile = 2`, mentre la misura diretta sulle unità ATTIVE
-- (`organization_unit_manager_user_id IS NULL`) contava 0 su tutte e 43.
--
-- Due filtri, non uno:
--   §1 la vista esamina solo le unità attive;
--   §2 anche il conteggio interno di `responsabile_condiviso` ignora le ritirate
--      — altrimenti chi guidava un'unità poi chiusa risulterebbe "condiviso" per
--      sempre, sostituendo un falso positivo con un altro.
--
-- VERIFICATO PRIMA DI SCRIVERE che §2 non sopprima i segnali legittimi:
-- `federica.marchetti@rtl-bank.org` guida DUE unità **attive** (RTL Bank S.p.A.
-- e Direzione Generale) e ZERO ritirate, quindi il flag resta acceso — come
-- deve, perché quello è un fatto da spiegare, non un artefatto da nascondere.
--
-- Colonne invariate (CREATE OR REPLACE VIEW le esige identiche per nome, ordine
-- e tipo). Idempotente, non distruttiva: non tocca una sola riga di dati.
-- Reversibile: il `down` in coda ripristina la definizione senza filtri. 2026-08-06.
-- ============================================================================

CREATE OR REPLACE VIEW sys.v_organization_unit_integrity AS
WITH atteso AS (
  SELECT t.tipo, t.prefisso_atteso
    FROM (VALUES
      ('HEADQUARTERS','ragione sociale'), ('GENERAL_MANAGEMENT','Direzione Generale'),
      ('DIVISION','Divisione '),          ('DEPARTMENT','Direzione '),
      ('AREA','Area '),                   ('BRANCH','Filiale '),
      ('OFFICE','Ufficio '),              ('TEAM','Team ')
    ) t(tipo, prefisso_atteso)
), ammesso AS (
  SELECT t.tipo_figlio, t.tipo_padre_ammesso
    FROM (VALUES
      ('GENERAL_MANAGEMENT','HEADQUARTERS'),
      ('DIVISION','GENERAL_MANAGEMENT'), ('DIVISION','HEADQUARTERS'),
      ('DEPARTMENT','DIVISION'),         ('DEPARTMENT','HEADQUARTERS'),
      ('AREA','DIVISION'),
      ('BRANCH','AREA'),                 ('BRANCH','DIVISION'),
      ('OFFICE','DEPARTMENT'),           ('OFFICE','DIVISION'),
      ('OFFICE','BRANCH'),               ('OFFICE','AREA'),
      ('TEAM','HEADQUARTERS'),           ('TEAM','DIVISION'), ('TEAM','DEPARTMENT'),
      ('PLANT','DIVISION'),              ('PLANT','DEPARTMENT'),
      ('WAREHOUSE','DIVISION'),          ('WAREHOUSE','DEPARTMENT')
    ) t(tipo_figlio, tipo_padre_ammesso)
)
SELECT ou.organization_unit_id                       AS unita_id,
       ou.organization_unit_name                     AS unita,
       ou.organization_unit_type                     AS tipo,
       ou.organization_unit_relation                 AS legame,
       par.organization_unit_name                    AS padre,
       par.organization_unit_type                    AS tipo_padre,
       ou.organization_unit_type::text <> 'HEADQUARTERS'
         AND NOT EXISTS (
           SELECT 1 FROM atteso a
            WHERE a.tipo = ou.organization_unit_type::text
              AND ou.organization_unit_name::text LIKE (a.prefisso_atteso || '%')
         )                                           AS viola_nomenclatura,
       ou.organization_unit_parent_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ammesso m
            WHERE m.tipo_figlio = ou.organization_unit_type::text
              AND m.tipo_padre_ammesso = par.organization_unit_type::text
         )                                           AS viola_annidamento,
       ou.organization_unit_manager_user_id IS NULL  AS senza_responsabile,
       ou.organization_unit_manager_user_id IS NOT NULL
         AND (SELECT count(*)
                FROM sys.sys_organization_units x
               WHERE x.organization_unit_manager_user_id = ou.organization_unit_manager_user_id
                 -- §2: le unità ritirate non rendono "condiviso" un responsabile.
                 AND x.organization_unit_is_active) > 1 AS responsabile_condiviso,
       ou.organization_unit_manager_user_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM sys.sys_user_position_assignments a
             JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
            WHERE a.user_position_assignment_user_id = ou.organization_unit_manager_user_id
              AND a.user_position_assignment_status::text = 'ACTIVE'
              AND p.position_organization_unit_id = ou.organization_unit_id
         )                                           AS responsabile_esterno
  FROM sys.sys_organization_units ou
  LEFT JOIN sys.sys_organization_units par
         ON par.organization_unit_id = ou.organization_unit_parent_id
 -- §1: una unità ritirata non è una violazione, è un'unità chiusa.
 WHERE ou.organization_unit_is_active;

COMMENT ON VIEW sys.v_organization_unit_integrity IS
  'Sentinella struttura organizzativa: nomenclatura, annidamento e responsabili. '
  'Esamina SOLO le unità attive (mig 000274, #151): una unità ritirata non ha '
  'responsabile per definizione e segnalarla era un falso positivo permanente.';

-- ============================================================================
-- down (manuale, per riferimento — NON eseguito dalla catena):
--   ripristina la definizione senza i due filtri, cioè rimuovi la clausola
--   `WHERE ou.organization_unit_is_active` finale e la condizione
--   `AND x.organization_unit_is_active` dalla sottoquery di responsabile_condiviso.
-- ============================================================================
