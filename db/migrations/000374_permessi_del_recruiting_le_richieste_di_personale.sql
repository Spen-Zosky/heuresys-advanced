-- ============================================================================
-- 000374 — #54 F3: i permessi della prima fetta del recruiting (le richieste)
--
-- `#54` F2 (mig `000364`) ha costruito le sette tabelle del ciclo, vuote per
-- scelta: il dominio si popola con l'uso, non con un import (I12 / ADR-0038).
-- F3 costruisce le API, e senza permessi nessuna rotta e' esponibile: misurato
-- il 2026-09-05, `sys_auth_permissions` non contiene NULLA che nomini
-- requisition, recruiting o candidate.
--
-- ── DUE PERMESSI, NON QUATTRO (doctrine 000212) ─────────────────────────────
-- `job-requisition:read` e `job-requisition:manage`. Un solo verbo di scrittura
-- invece di create/update/close: superficie RBAC minima, e il verbo copre
-- l'intero ciclo funzionale. Se un giorno servira' distinguere, l'estensione e'
-- additiva; il contrario — togliere un permesso gia' concesso — non lo e', e la
-- 000210 spiega perche' (§«COME SI TOGLIE UN PERMESSO A TENANT_ADMIN»).
--
-- ── AUDIENCE ESPLICITA (doctrine 000208 + D-57) ────────────────────────────
-- `PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`. L'ultimo per **I22**: e'
-- plenipotenziario sui dati business del tenant, e una richiesta di personale e'
-- dato business. `MANAGER` e `CEO` restano fuori: aprirli e' un'estensione
-- additiva che si fara' quando una pagina lo chiedera', non prima.
--
-- ⚠ L'ESTENSIONE DELL'ALLOWLIST NON E' UN OPZIONALE. La `000210` cancella ogni
-- grant a `TENANT_ADMIN` che non sia nella sua allowlist, e la catena si
-- riapplica per intero a ogni deploy: senza il marker qui sotto questi due
-- permessi verrebbero concessi e poi tolti al giro successivo, producendo un 403
-- che nessuno saprebbe spiegare. E' successo davvero (memoria: una migrazione
-- auto-riparante applicata fuori ordine ha tolto quattro permessi).
--
-- IDEMPOTENTE + twice-run safe.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('job-requisition:read',
   'Lettura delle richieste di personale (posizioni da coprire)',
   'job-requisition', 'read'),
  ('job-requisition:manage',
   'Gestione delle richieste di personale (apertura, modifica, chiusura)',
   'job-requisition', 'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Overlay EN del name (ADR-0029; idempotente — il gate i18n 000207 pretende 0 gap)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', t.testo, 'MANUAL'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
          ('job-requisition:read',   'Read job requisitions (positions to be filled)'),
          ('job-requisition:manage', 'Manage job requisitions (open, update, close)')
       ) AS t(code, testo) ON t.code = p.auth_permission_code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Estensione allowlist TENANT_ADMIN (la guardia rbac-tenant-admin-allowlist
-- parsa le righe VALUES a colonna singola dopo questo marker):
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000374(code text PRIMARY KEY);
INSERT INTO _ta_extend_000374(code) VALUES
    ('job-requisition:read'),
    ('job-requisition:manage');

-- Grant esplicito all'audience
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p
    ON p.auth_permission_code IN ('job-requisition:read', 'job-requisition:manage')
 WHERE r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Self-healing: nessun altro ruolo trattiene questi due (il blanket della 000005 ecc.)
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions p, sys.sys_auth_roles r
 WHERE p.auth_permission_code IN ('job-requisition:read', 'job-requisition:manage')
   AND rp.auth_permission_id = p.auth_permission_id
   AND rp.auth_role_id = r.auth_role_id
   AND r.auth_role_code NOT IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER');

DROP TABLE _ta_extend_000374;

-- Post-condizioni (fail-loud)
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('job-requisition:read', 'job-requisition:manage');
  IF n <> 2 THEN RAISE EXCEPTION '000374: attesi 2 permessi, trovati %', n; END IF;

  SELECT count(*) INTO n
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('job-requisition:read', 'job-requisition:manage');
  IF n <> 6 THEN RAISE EXCEPTION '000374: attese 6 concessioni (2 permessi x 3 ruoli), trovate %', n; END IF;

  SELECT count(*) INTO n
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE p.auth_permission_code IN ('job-requisition:read', 'job-requisition:manage')
     AND t.entity_table = 'sys_auth_permissions' AND t.field = 'name' AND t.locale = 'en';
  IF n <> 2 THEN RAISE EXCEPTION '000374: attesi 2 overlay EN, trovati %', n; END IF;

  RAISE NOTICE '000374: job-requisition read+manage attivi (PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER)';
END $$;
