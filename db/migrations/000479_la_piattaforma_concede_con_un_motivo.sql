-- =====================================================================================
-- ADR-0055 — La piattaforma concede ruoli dentro un cliente solo con un motivo scritto
--
-- IL FATTO (misurato 2026-11-06 con docs/kb/tools/db_health.py):
--   sys.v_tenant_boundary_violations_full segnala 9 righe di sys.sys_user_auth_roles in cui
--   user_auth_role_granted_by è un utente del tenant di piattaforma e la concessione è in
--   RTL Bank: 7 del 2026-10-31 (riassegnazione «il ruolo segue il lavoro») e 2 del
--   2026-11-05/06 (P-6 del piano interfacce), tutte autorizzate per iscritto da Enzo.
--
-- LA DECISIONE (Enzo, 2026-11-06 01:22 UTC): sì, ma solo da PLATFORM_ADMIN e con un motivo
-- scritto. Quindi la colonna esce dalla sentinella generica (come le colonne d'autore della
-- 000386) e la guarda una sentinella sua, che pretende zero.
--
-- Idempotente: INSERT ... ON CONFLICT, CREATE OR REPLACE VIEW, UPDATE solo dove il motivo
-- manca. Niente si cancella.
-- Ritorno: DELETE della riga 'user_auth_role_granted_by' dal registro delle colonne d'autore,
-- DROP VIEW della sentinella nuova; i motivi scritti si riconoscono dal prefisso «ADR-0055».
-- =====================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. La colonna esce dalla sentinella generica ---------------------------------------
INSERT INTO sys.sys_tenant_boundary_author_columns (author_column_name, author_column_note)
VALUES ('user_auth_role_granted_by',
  'Chi ha concesso il ruolo. Fuori dal cliente è legittimo solo per un PLATFORM_ADMIN con '
  'motivo scritto (ADR-0055): lo guarda sys.v_concessioni_fuori_cliente_senza_motivo.')
ON CONFLICT (author_column_name) DO NOTHING;

-- 2. La sentinella dedicata --------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_concessioni_fuori_cliente_senza_motivo AS
WITH concessioni AS (
  SELECT g.user_auth_role_id,
         g.user_auth_role_tenant_id,
         r.auth_role_code,
         g.user_auth_role_granted_by,
         g.user_auth_role_granted_at,
         u.user_tenant_id AS concedente_tenant_id,
         EXISTS (
           SELECT 1
             FROM sys.sys_user_auth_roles pg
             JOIN sys.sys_auth_roles pr ON pr.auth_role_id = pg.user_auth_role_role_id
            WHERE pg.user_auth_role_user_id = g.user_auth_role_granted_by
              AND pr.auth_role_code = 'PLATFORM_ADMIN'
              AND pg.user_auth_role_revoked_at IS NULL
         ) AS concedente_di_piattaforma,
         length(btrim(coalesce(g.user_auth_role_reason, a.mandate_act_reason, ''))) >= 10
           AS con_motivo
    FROM sys.sys_user_auth_roles g
    JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
    JOIN sys.sys_users u      ON u.user_id      = g.user_auth_role_granted_by
    LEFT JOIN sys.sys_mandate_acts a ON a.mandate_act_id = g.user_auth_role_act_id
   WHERE g.user_auth_role_tenant_id IS NOT NULL
     AND u.user_tenant_id <> g.user_auth_role_tenant_id
)
SELECT user_auth_role_id,
       user_auth_role_tenant_id,
       auth_role_code,
       user_auth_role_granted_by,
       user_auth_role_granted_at,
       CASE
         WHEN NOT concedente_di_piattaforma AND NOT con_motivo
           THEN 'concedente non PLATFORM_ADMIN e motivo assente'
         WHEN NOT concedente_di_piattaforma
           THEN 'concedente non PLATFORM_ADMIN'
         ELSE 'motivo assente'
       END AS allarme
  FROM concessioni
 WHERE NOT (concedente_di_piattaforma AND con_motivo);

COMMENT ON VIEW sys.v_concessioni_fuori_cliente_senza_motivo IS
  'ADR-0055 (mig 000479): concessioni di ruolo in un tenant fatte da un utente di un altro '
  'tenant senza PLATFORM_ADMIN attivo o senza motivo scritto (user_auth_role_reason o atto '
  'di ADR-0050 D4). Pretende zero.';

-- 3. Il motivo alle concessioni esistenti, autorizzate per iscritto ------------------
UPDATE sys.sys_user_auth_roles g
   SET user_auth_role_reason =
         'ADR-0055: riassegnazione «il ruolo segue il lavoro», autorizzazione scritta di '
         'Enzo Spenuso del 2026-10-31 (thread «Riassegnare i ruoli di RTL secondo il lavoro»)'
  FROM sys.sys_users u
 WHERE u.user_id = g.user_auth_role_granted_by
   AND g.user_auth_role_tenant_id IS NOT NULL
   AND u.user_tenant_id <> g.user_auth_role_tenant_id
   AND (g.user_auth_role_reason IS NULL OR btrim(g.user_auth_role_reason) = '')
   AND g.user_auth_role_granted_at >= '2026-10-31T00:00:00Z'
   AND g.user_auth_role_granted_at <  '2026-11-01T00:00:00Z';

UPDATE sys.sys_user_auth_roles g
   SET user_auth_role_reason =
         'ADR-0055: P-6 del piano interfacce, ruoli delle utenze di prova a persone vere, '
         'autorizzazione scritta di Enzo Spenuso del 2026-11-05'
  FROM sys.sys_users u
 WHERE u.user_id = g.user_auth_role_granted_by
   AND g.user_auth_role_tenant_id IS NOT NULL
   AND u.user_tenant_id <> g.user_auth_role_tenant_id
   AND (g.user_auth_role_reason IS NULL OR btrim(g.user_auth_role_reason) = '')
   AND g.user_auth_role_granted_at >= '2026-11-05T00:00:00Z'
   AND g.user_auth_role_granted_at <  '2026-11-07T00:00:00Z';

-- 4. Misura dopo: si dichiara, non si impone (il database della CI non ha queste righe) --
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.v_concessioni_fuori_cliente_senza_motivo;
  RAISE NOTICE 'ADR-0055: concessioni fuori cliente senza motivo dopo la 000479: %', n;
END
$$;

COMMIT;

-- =====================================================================================
-- LA PROVA A ESITI OPPOSTI — la sentinella deve saper diventare rossa. Si esegue a mano,
-- finisce in ROLLBACK.
-- =====================================================================================
-- BEGIN;
-- -- (a) una concessione fuori cliente senza motivo: deve comparire
-- UPDATE sys.sys_user_auth_roles SET user_auth_role_reason = NULL
--  WHERE user_auth_role_id = (SELECT user_auth_role_id FROM sys.sys_user_auth_roles g
--                               JOIN sys.sys_users u ON u.user_id = g.user_auth_role_granted_by
--                              WHERE u.user_tenant_id <> g.user_auth_role_tenant_id LIMIT 1);
-- SELECT count(*) AS deve_essere_1 FROM sys.v_concessioni_fuori_cliente_senza_motivo;
-- ROLLBACK;
