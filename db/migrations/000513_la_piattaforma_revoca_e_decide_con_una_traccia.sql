-- =====================================================================================
-- 000513 — La piattaforma revoca ruoli e decide il consolidamento nel cliente solo con una
--          traccia: due colonne d'autore escono dalla sentinella generica del confine e
--          ricevono ciascuna una sentinella sua (stessa forma di ADR-0055, mig 000479).
--
-- IL FATTO (misurato il 2026-11-26 alle 04:08-04:10 UTC, sola lettura su heuresys_advanced):
--   sys.v_tenant_boundary_violations_full ha 2 righe in produzione:
--   · sys.sys_user_auth_roles.user_auth_role_revoked_by, 184 righe: le revoche in RTL Bank
--     della corsa APPLICATA di db/scripts/modello-ruoli.sql del 2026-11-16 (ADR-0057),
--     firmate dall'Amministratore di Sistema, che è PLATFORM_ADMIN; 184 su 184 sono nel
--     giornale staging.modello_ruoli_undo con azione REVOCA.
--   · sys.sys_tenant_consolidation_decisions.tenant_consolidation_decision_decided_by,
--     3 righe: tre decisioni RIFIUTATA del 2026-11-22 dell'Amministratore di Sistema, con
--     il motivo scritto.
--   Sono atti legittimi della piattaforma, come le concessioni di ADR-0055: la colonna
--   d'autore non è un legame di dato del cliente. Ma «fuori cliente» resta legittimo solo
--   per un PLATFORM_ADMIN con una traccia, e questo lo guardano le due sentinelle nuove,
--   che pretendono zero.
--
-- COSA FA: due righe in sys.sys_tenant_boundary_author_columns, due viste sentinella.
-- Idempotente: INSERT ... ON CONFLICT DO NOTHING, CREATE OR REPLACE VIEW. Nessun dato di
-- business cambia.
-- RITORNO: DELETE delle due righe dal registro delle colonne d'autore (author_column_name
-- 'user_auth_role_revoked_by' e 'tenant_consolidation_decision_decided_by'),
-- DROP VIEW sys.v_revoche_fuori_cliente_senza_traccia e
-- DROP VIEW sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo.
-- =====================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Le due colonne escono dalla sentinella generica ----------------------------------
INSERT INTO sys.sys_tenant_boundary_author_columns (author_column_name, author_column_note)
VALUES
  ('user_auth_role_revoked_by',
   'Chi ha revocato il ruolo. Fuori dal cliente è legittimo solo per un PLATFORM_ADMIN con la '
   'revoca nel giornale staging.modello_ruoli_undo (mig 000513): lo guarda '
   'sys.v_revoche_fuori_cliente_senza_traccia.'),
  ('tenant_consolidation_decision_decided_by',
   'Chi ha deciso la proposta di consolidamento. Fuori dal cliente è legittimo solo per un '
   'PLATFORM_ADMIN con motivo scritto (mig 000513): lo guarda '
   'sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo.')
ON CONFLICT (author_column_name) DO NOTHING;

-- 2. Sentinella delle revoche ---------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_revoche_fuori_cliente_senza_traccia AS
WITH revoche AS (
  SELECT g.user_auth_role_id,
         g.user_auth_role_tenant_id,
         r.auth_role_code,
         g.user_auth_role_revoked_by,
         g.user_auth_role_revoked_at,
         EXISTS (
           SELECT 1
             FROM sys.sys_user_auth_roles pg
             JOIN sys.sys_auth_roles pr ON pr.auth_role_id = pg.user_auth_role_role_id
            WHERE pg.user_auth_role_user_id = g.user_auth_role_revoked_by
              AND pr.auth_role_code = 'PLATFORM_ADMIN'
              AND pg.user_auth_role_revoked_at IS NULL
         ) AS revocante_di_piattaforma,
         EXISTS (
           SELECT 1 FROM staging.modello_ruoli_undo x
            WHERE x.user_auth_role_id = g.user_auth_role_id
              AND x.azione = 'REVOCA'
         ) AS nel_giornale
    FROM sys.sys_user_auth_roles g
    JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
    JOIN sys.sys_users u      ON u.user_id      = g.user_auth_role_revoked_by
   WHERE g.user_auth_role_tenant_id IS NOT NULL
     AND u.user_tenant_id <> g.user_auth_role_tenant_id
)
SELECT user_auth_role_id,
       user_auth_role_tenant_id,
       auth_role_code,
       user_auth_role_revoked_by,
       user_auth_role_revoked_at,
       CASE
         WHEN NOT revocante_di_piattaforma AND NOT nel_giornale
           THEN 'revocante non PLATFORM_ADMIN e revoca fuori giornale'
         WHEN NOT revocante_di_piattaforma
           THEN 'revocante non PLATFORM_ADMIN'
         ELSE 'revoca fuori giornale'
       END AS allarme
  FROM revoche
 WHERE NOT (revocante_di_piattaforma AND nel_giornale);

COMMENT ON VIEW sys.v_revoche_fuori_cliente_senza_traccia IS
  'mig 000513: revoche di ruolo in un tenant fatte da un utente di un altro tenant senza '
  'PLATFORM_ADMIN attivo o senza la riga REVOCA nel giornale staging.modello_ruoli_undo. '
  'Pretende zero.';

-- 3. Sentinella delle decisioni di consolidamento -------------------------------------
CREATE OR REPLACE VIEW sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo AS
WITH decisioni AS (
  SELECT d.tenant_consolidation_decision_id,
         d.tenant_consolidation_decision_tenant_id,
         d.tenant_consolidation_decision_value,
         d.tenant_consolidation_decision_decided_by,
         d.tenant_consolidation_decision_decided_at,
         EXISTS (
           SELECT 1
             FROM sys.sys_user_auth_roles pg
             JOIN sys.sys_auth_roles pr ON pr.auth_role_id = pg.user_auth_role_role_id
            WHERE pg.user_auth_role_user_id = d.tenant_consolidation_decision_decided_by
              AND pr.auth_role_code = 'PLATFORM_ADMIN'
              AND pg.user_auth_role_revoked_at IS NULL
         ) AS decisore_di_piattaforma,
         length(btrim(coalesce(d.tenant_consolidation_decision_reason, ''))) >= 10 AS con_motivo
    FROM sys.sys_tenant_consolidation_decisions d
    JOIN sys.sys_users u ON u.user_id = d.tenant_consolidation_decision_decided_by
   WHERE u.user_tenant_id <> d.tenant_consolidation_decision_tenant_id
)
SELECT tenant_consolidation_decision_id,
       tenant_consolidation_decision_tenant_id,
       tenant_consolidation_decision_value,
       tenant_consolidation_decision_decided_by,
       tenant_consolidation_decision_decided_at,
       CASE
         WHEN NOT decisore_di_piattaforma AND NOT con_motivo
           THEN 'decisore non PLATFORM_ADMIN e motivo assente'
         WHEN NOT decisore_di_piattaforma
           THEN 'decisore non PLATFORM_ADMIN'
         ELSE 'motivo assente'
       END AS allarme
  FROM decisioni
 WHERE NOT (decisore_di_piattaforma AND con_motivo);

COMMENT ON VIEW sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo IS
  'mig 000513: decisioni di consolidamento di un tenant prese da un utente di un altro tenant '
  'senza PLATFORM_ADMIN attivo o senza motivo scritto. Pretende zero.';

-- 4. Misura dopo: si dichiara, non si impone (la copia della CI può non avere queste righe)
DO $$
DECLARE n_r int; n_d int; n_c int;
BEGIN
  SELECT count(*) INTO n_r FROM sys.v_revoche_fuori_cliente_senza_traccia;
  SELECT count(*) INTO n_d FROM sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo;
  SELECT count(*) INTO n_c FROM sys.v_tenant_boundary_violations_full;
  RAISE NOTICE '000513: revoche fuori cliente senza traccia %, decisioni fuori cliente senza motivo %, confine generico %',
    n_r, n_d, n_c;
END
$$;

COMMIT;

-- =====================================================================================
-- LA PROVA A ESITI OPPOSTI — le sentinelle devono saper diventare rosse. Si esegue a mano,
-- finisce in ROLLBACK.
-- =====================================================================================
-- BEGIN;
-- -- (a) una revoca fuori cliente tolta dal giornale: deve comparire
-- DELETE FROM staging.modello_ruoli_undo
--  WHERE undo_id = (SELECT x.undo_id FROM staging.modello_ruoli_undo x
--                     JOIN sys.sys_user_auth_roles g ON g.user_auth_role_id = x.user_auth_role_id
--                     JOIN sys.sys_users u ON u.user_id = g.user_auth_role_revoked_by
--                    WHERE x.azione = 'REVOCA' AND u.user_tenant_id <> g.user_auth_role_tenant_id
--                    LIMIT 1);
-- SELECT count(*) AS deve_essere_1 FROM sys.v_revoche_fuori_cliente_senza_traccia;
-- -- (b) una decisione fuori cliente senza motivo: deve comparire
-- UPDATE sys.sys_tenant_consolidation_decisions SET tenant_consolidation_decision_reason = 'no'
--  WHERE tenant_consolidation_decision_id = (SELECT d.tenant_consolidation_decision_id
--          FROM sys.sys_tenant_consolidation_decisions d
--          JOIN sys.sys_users u ON u.user_id = d.tenant_consolidation_decision_decided_by
--         WHERE u.user_tenant_id <> d.tenant_consolidation_decision_tenant_id LIMIT 1);
-- SELECT count(*) AS deve_essere_1 FROM sys.v_decisioni_consolidamento_fuori_cliente_senza_motivo;
-- ROLLBACK;
