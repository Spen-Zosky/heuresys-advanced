-- 000453 — #262: endpoint per sys_classificazione_direzione_dato (decisione di Enzo, 2026-09-28).
--
-- IL PERCHE'. check_marciume.py (S1116) segnalava sys_classificazione_direzione_dato (252+
-- righe, I23/ADR-0041) popolata ma mai letta da un modulo API. La tabella dichiara la
-- DIREZIONE DEL DATO (nativo/importato/ibrido/infrastruttura) per ogni tabella sys.sys_* di
-- dato cliente — esattamente il dominio di cui DATA_STEWARD e' il custode (mig 000449: "il
-- custode del dato che ARRIVA da fuori", cioe' import/ibrido/reference-sync). Enzo ha scelto
-- un endpoint API (non una deroga): il dato e' utile al ruolo che gia' esiste per leggerlo.
--
-- COSA APRE. UN permesso nuovo, sola LETTURA: data_classification:read. UNA rotta,
-- GET /v1/data-classification (apps/api/src/modules/data-classification/routes.ts),
-- nessuno scope organizzativo (la tabella non ha tenant_id: classifica lo SCHEMA, non un
-- dato di cliente — stesso trattamento di reference-sync/provenance, D-51). Grant al solo
-- DATA_STEWARD: e' il ruolo il cui mandato descrive esattamente questo dominio.
--
-- CENSIMENTO PRIMA (chi_sorveglia.py sys_classificazione_direzione_dato, S1116): sentinella
-- BLOCCANTE sys.v_tabelle_non_classificate (si accende solo se una tabella NUOVA resta senza
-- classificazione — questa migrazione non ne crea), un test (data-steward.integration.test.ts,
-- legge la tabella via SQL diretto per la propria asserzione, non tocca la rotta nuova),
-- nessuno scrittore, nessun cancello. Nessun conflitto.
--
-- ROLLBACK DICHIARATO: un solo UPDATE sulla riga concessa qui (elenco esplicito):
--   UPDATE sys.sys_auth_role_permissions rp SET revoked_at = now(),
--          revoked_by_migration = 'rollback-000453'
--     FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
--    WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
--      AND r.auth_role_code = 'DATA_STEWARD' AND p.auth_permission_code = 'data_classification:read'
--      AND rp.revoked_at IS NULL;
--   NON va in db/migrations/ (ADR-0035: la catena si riapplica, lo disferebbe al giro dopo).
--
-- Effetto verificabile:
--   SELECT count(*) FROM sys.sys_auth_role_permissions rp
--     JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
--     JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
--    WHERE r.auth_role_code='DATA_STEWARD' AND p.auth_permission_code='data_classification:read'
--      AND rp.revoked_at IS NULL;   -- atteso: 1
--
\set ON_ERROR_STOP on

BEGIN;

-- (a) LA MISURA PRIMA.
CREATE TEMP TABLE mig453_prima ON COMMIT DROP AS
SELECT count(*)::int AS ruoli_con_permesso
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE p.auth_permission_code = 'data_classification:read' AND rp.revoked_at IS NULL;

-- (b) LA GUARDIA — il ruolo deve esistere davvero.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.sys_auth_roles WHERE auth_role_code = 'DATA_STEWARD' AND retired_at IS NULL) THEN
    RAISE EXCEPTION '000453: il ruolo DATA_STEWARD non esiste o e'' ritirato (lo crea 000449)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sys' AND table_name = 'sys_classificazione_direzione_dato') THEN
    RAISE EXCEPTION '000453: sys_classificazione_direzione_dato non esiste (la crea 000429)';
  END IF;
END $$;

-- 1. Il permesso nuovo.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('data_classification:read', 'Read data direction registry',
   'data_classification', 'read',
   'Legge sys.sys_classificazione_direzione_dato (I23/ADR-0041): la direzione del dato per ogni tabella sys.sys_* di dato cliente. Sola lettura, nessuna scrittura via API: il registro si ratifica per migrazione (X-1), non a runtime. Nato #262, 2026-09-28.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 2. Il grant a DATA_STEWARD.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'DATA_STEWARD'
   AND p.auth_permission_code = 'data_classification:read'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 2b. Riapertura se la riga esisteva revocata (rollback + nuovo deploy).
UPDATE sys.sys_auth_role_permissions rp
   SET revoked_at = NULL, revoked_by_migration = NULL
  FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'DATA_STEWARD'
   AND p.auth_permission_code = 'data_classification:read'
   AND rp.revoked_at IS NOT NULL;

-- (c) LE POST-CONDIZIONI.
DO $$
DECLARE
  n_prima int;
  n_dopo int;
  n_grant int;
BEGIN
  SELECT ruoli_con_permesso INTO n_prima FROM mig453_prima;
  SELECT count(*) INTO n_dopo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'data_classification:read' AND rp.revoked_at IS NULL;
  IF n_dopo NOT IN (n_prima, n_prima + 1) THEN
    RAISE EXCEPTION '000453: i ruoli con data_classification:read sono passati da % a %: questa migrazione ne aggiunge UNO solo',
      n_prima, n_dopo;
  END IF;

  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DATA_STEWARD' AND p.auth_permission_code = 'data_classification:read'
     AND rp.revoked_at IS NULL;
  IF n_grant <> 1 THEN
    RAISE EXCEPTION '000453: DATA_STEWARD deve avere data_classification:read ATTIVO, righe attive trovate: %', n_grant;
  END IF;

  RAISE NOTICE '000453 ok: DATA_STEWARD ha data_classification:read (ruoli con il permesso: % -> %)',
    n_prima, n_dopo;
END $$;

COMMIT;

-- FINE 000453
