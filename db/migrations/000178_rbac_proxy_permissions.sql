-- ============================================================================
-- 000178_rbac_proxy_permissions.sql — #61 G/G2 (2/2): via le permission proxy.
--
-- PROBLEMA: alcune route erano gate-ate da un permesso di un'ALTRA area, scelto
--   perche' aveva "piu' o meno" la stessa audience. La matrice diventava
--   illeggibile: per sapere chi puo' leggere l'observability bisognava sapere
--   che gira sotto `tenant:create`, che non c'entra nulla.
--
--   route                                   gate proxy          nuovo permesso
--   GET /v1/observability/*                 tenant:create       observability:read
--   GET /v1/auth/role-permissions           auth:revoke_user    role_matrix:read
--   GET /v1/auth/admin/users/:id/sessions   auth:revoke_user    auth:sessions_read
--   POST /v1/tenant-materialization         (nessuno)           tenant_materialization:execute
--
-- STESSO PRINCIPIO DELLA 000177: la matrice diventa esplicita, i privilegi
--   effettivi NON si muovono. Ogni nuovo permesso e' concesso esattamente
--   all'audience del gate che sostituisce, derivata dalla tabella dei grant.
--   Audience attuali (verificate): tenant:create = PLATFORM_ADMIN;
--   auth:revoke_user = PLATFORM_ADMIN, TENANT_ADMIN.
--
-- tenant_materialization:execute e' il caso speciale: la POST non aveva ALCUN
--   requirePermission. NON era una falla — il service chiama ensurePlatformAdmin
--   e quindi l'accesso era gia' ristretto; mancavano la difesa in profondita' a
--   livello di middleware e, di nuovo, la rappresentazione nella matrice. Il
--   permesso viene concesso a PLATFORM_ADMIN, cioe' esattamente chi il service
--   gia' ammetteva → zero cambio di comportamento.
--
-- DELIBERATAMENTE INVARIATO: GET /v1/tenant-materialization/archetypes resta
--   aperto a qualunque autenticato (catalogo statico di archetipi). Aggiungere
--   un permesso li' avrebbe RISTRETTO un accesso oggi consentito, cioe' un
--   cambio di comportamento — fuori dallo scopo "rendere onesta la matrice".
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING su entrambe le insert.
-- Authored: 2026-07-19.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('observability:read',             'Read observability dashboards',        'observability',        'read'),
  ('role_matrix:read',               'Read the role x permission matrix',    'role_matrix',          'read'),
  ('auth:sessions_read',             'Read another user''s auth sessions',   'auth',                 'sessions_read'),
  ('tenant_materialization:execute', 'Run tenant materialization (plan/apply)', 'tenant_materialization', 'execute')
ON CONFLICT (auth_permission_code) DO NOTHING;

WITH mapping(new_code, source_code) AS (
  VALUES
    ('observability:read',             'tenant:create'),
    ('role_matrix:read',               'auth:revoke_user'),
    ('auth:sessions_read',             'auth:revoke_user'),
    -- il gate effettivo era ensurePlatformAdmin nel service: tenant:create e'
    -- il permesso PLATFORM_ADMIN-only gia' presente in matrice, usato qui solo
    -- come SORGENTE dell'audience (PLATFORM_ADMIN), non come proxy della route.
    ('tenant_materialization:execute', 'tenant:create')
)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM mapping m
  JOIN sys.sys_auth_permissions sp ON sp.auth_permission_code = m.source_code
  JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = sp.auth_permission_id
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- CORREZIONE OBBLIGATORIA — grant a tappeto di 000005.
--
-- 000005 concede a TENANT_ADMIN OGNI permesso via CROSS JOIN su
-- sys_auth_permissions, con una denylist di 7 codici. Le migrazioni sono
-- idempotenti e RIGIRANO TUTTE a ogni `db:migrate`, quindi quel CROSS JOIN si
-- rivaluta sulla tabella permessi AGGIORNATA: ogni permesso introdotto da una
-- migrazione successiva viene automaticamente assorbito da TENANT_ADMIN.
--
-- Effetto misurato: observability:read e tenant_materialization:execute, nati
-- PLATFORM_ADMIN-only (sorgente tenant:create, che E' nella denylist), sono
-- finiti anche a TENANT_ADMIN → GET /v1/observability rispondeva 200 a un
-- TENANT_ADMIN che prima riceveva 403. Un allargamento di privilegio silenzioso,
-- intercettato da observability.integration.test.ts.
--
-- Qui riportiamo l'audience dei 4 permessi ESATTAMENTE a quella della sorgente,
-- cancellando i grant che la sorgente non ha. Essendo 000178 > 000005, questa
-- correzione gira DOPO il CROSS JOIN a ogni re-run → auto-riparante.
--
-- NB: la denylist di 000005 resta un rischio sistemico per OGNI permesso futuro
-- pensato come PLATFORM_ADMIN-only. Registrato come debito: la decisione se
-- invertire quella strategia (allowlist curata invece di "tutto meno 7") cambia
-- l'accesso di TENANT_ADMIN su larga scala e non e' una scelta tecnica isolata.
-- ---------------------------------------------------------------------------
WITH mapping(new_code, source_code) AS (
  VALUES
    ('observability:read',             'tenant:create'),
    ('role_matrix:read',               'auth:revoke_user'),
    ('auth:sessions_read',             'auth:revoke_user'),
    ('tenant_materialization:execute', 'tenant:create')
)
DELETE FROM sys.sys_auth_role_permissions rp
 USING mapping m
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
 WHERE rp.auth_permission_id = np.auth_permission_id
   AND NOT EXISTS (
     SELECT 1
       FROM sys.sys_auth_role_permissions srp
       JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
      WHERE sp.auth_permission_code = m.source_code
        AND srp.auth_role_id = rp.auth_role_id
   );

DO $$
DECLARE n int; extra int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN
     ('observability:read','role_matrix:read','auth:sessions_read','tenant_materialization:execute');

  -- post-condizione: nessuno dei 4 permessi puo' avere ruoli oltre la sorgente
  SELECT count(*) INTO extra
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions np ON np.auth_permission_id = rp.auth_permission_id
   WHERE np.auth_permission_code IN ('observability:read','tenant_materialization:execute')
     AND rp.auth_role_id NOT IN (
       SELECT srp.auth_role_id FROM sys.sys_auth_role_permissions srp
       JOIN sys.sys_auth_permissions sp ON sp.auth_permission_id = srp.auth_permission_id
       WHERE sp.auth_permission_code = 'tenant:create');
  IF extra > 0 THEN
    RAISE EXCEPTION '000178: % grant oltre l''audience sorgente — il grant a tappeto ha vinto', extra;
  END IF;

  RAISE NOTICE '000178: % permessi de-proxy presenti, audience allineate alla sorgente.', n;
END $$;
