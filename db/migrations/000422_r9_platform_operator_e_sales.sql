-- 000422 — Mandato K, R-9: PLATFORM_OPERATOR e SALES (D9=B).
--
-- IL PERCHE'. R-9 e' la prima voce di F4 che popola l'asse costruito da R-0
-- (`PLATFORM_ASSIGNED_MANDATE_ROLES`, D9=B): finche' non esiste un ruolo di piattaforma
-- che non sia PLATFORM_ADMIN, quell'asse non l'ha provato nessuno sul vivo. Due ruoli:
--
--   · PLATFORM_OPERATOR — sola lettura su observability, provenance, generated-origins,
--     notifications (audit). Vede solo i clienti a cui e' stato assegnato
--     (sys.sys_platform_user_tenant_assignments, mig. 000421), MAI tutti come PLATFORM_ADMIN.
--   · SALES — leads (lettura + avanzamento di stato). Non usa l'asse di assegnazione: i lead
--     non hanno tenant (sono prospect per Heuresys, non dati di un cliente esistente).
--
-- IL DEBITO CHE QUESTA MIGRAZIONE SALDA (misurato in sessione, non nel mandato): il GET
-- /v1/notifications/broadcasts condivideva il permesso `notification:create` col POST che
-- invia — dare a PLATFORM_OPERATOR quel permesso per l'audit gli avrebbe dato anche la
-- capacita' di inviare broadcast, che contraddice "sola lettura". Si spezza in
-- `notification:read` (nuovo, per il GET) e si lascia `notification:create` al solo POST.
-- Chi aveva gia' `notification:create` (PLATFORM_ADMIN, HRMS_MANAGER, TENANT_ADMIN) riceve
-- anche `notification:read`, cosi' nessuno perde l'audit che gia' aveva (nessun RITIRO: G-D2
-- resta vuota).
--
-- is_platform=false per entrambi i ruoli nuovi (come BLUEPRINT_MANAGER, altro ruolo di
-- piattaforma D9): PLATFORM_ADMIN resta l'UNICO ruolo con auth_role_is_platform=true
-- (mask.ts, actor.ts) — la concessione a una persona di collaudo avviene sempre con un
-- tenant_id concreto (il tenant "di casa" Heuresys System), mai NULL, quindi il vincolo
-- 000389 non richiede is_platform=true qui.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='PLATFORM_OPERATOR' and retired_at is null
--   select 1 from sys.sys_auth_roles where auth_role_code='SALES' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. I due ruoli, con la famiglia dichiarata subito (000414 la pretende: 0 ruoli senza
--    categoria, e la catena riapplicata intera al prossimo deploy la ri-verifica).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('PLATFORM_OPERATOR', 'Platform Operator',
   'Sola lettura su observability, provenance, generated-origins e sull''audit dei broadcast di sistema. Vede solo i clienti a cui e'' stato assegnato (sys_platform_user_tenant_assignments, mandato K D9=B) — mai tutti i clienti come PLATFORM_ADMIN. Nato mandato K, R-9, 2026-09-17.',
   false, 'functional'),
  ('SALES', 'Sales',
   'Legge e avanza lo stato delle richieste di contatto (leads) del sito pubblico. I lead non hanno tenant: non usa l''asse di assegnazione-cliente. Nato mandato K, R-9, 2026-09-17.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Il permesso nuovo: notification:read, per spezzare l'audit dei broadcast dal loro invio.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('notification:read', 'Read the SYSTEM broadcast audit',
   'notification', 'read',
   'GET /v1/notifications/broadcasts — audit di sola lettura dei broadcast di sistema inviati. Spezzato da notification:create (mandato K, R-9, 2026-09-17) perche'' un ruolo di sola lettura (PLATFORM_OPERATOR) non deve poter anche inviare.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 3. Grant a PLATFORM_OPERATOR: le tre letture + l'audit dei broadcast.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'PLATFORM_OPERATOR'
   AND p.auth_permission_code IN ('observability:read', 'provenance:read', 'notification:read')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. Grant a SALES: lettura e avanzamento dei lead.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'SALES'
   AND p.auth_permission_code IN ('leads:read', 'leads:update')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 5. Le traduzioni inglesi (stesso inciampo di 000255/000272/000300/000404: la guardia
--    della 000255 pretende copertura EN totale su sys_auth_roles e sys_auth_permissions,
--    nome E descrizione — due ruoli + un permesso nuovi senza traduzione fermerebbero
--    l'INTERA catena alla seconda passata: 2*2 + 1*2 = 6 mancanti, misurato).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('PLATFORM_OPERATOR', 'name', 'Platform Operator'),
    ('PLATFORM_OPERATOR', 'description',
     'Read-only over observability, provenance, generated-origins and the system-broadcast audit. Sees only the customers assigned to it (sys_platform_user_tenant_assignments, mandato K D9=B) — never every customer like PLATFORM_ADMIN. Born mandato K, R-9, 2026-09-17.'),
    ('SALES', 'name', 'Sales'),
    ('SALES', 'description',
     'Reads and advances the status of public-site contact leads. Leads carry no tenant: does not use the customer-assignment axis. Born mandato K, R-9, 2026-09-17.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('notification:read', 'name', 'Read the SYSTEM broadcast audit'),
    ('notification:read', 'description',
     'GET /v1/notifications/broadcasts — read-only audit of sent SYSTEM broadcasts. Split off notification:create (mandato K, R-9, 2026-09-17) so a read-only role (PLATFORM_OPERATOR) cannot also send.')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT DO NOTHING;

-- 6. notification:read a chi aveva gia' notification:create (nessun RITIRO: solo
--    un'aggiunta, cosi' l'audit che gia' avevano resta invariato dopo lo spezzamento).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, pr.auth_permission_id
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_permissions pc ON pc.auth_permission_id = rp.auth_permission_id
  CROSS JOIN sys.sys_auth_permissions pr
 WHERE pc.auth_permission_code = 'notification:create'
   AND pr.auth_permission_code = 'notification:read'
   AND rp.revoked_at IS NULL
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 7. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_op int; n_sales int; n_read_holders int; n_create_holders int; n_missing int;
  n_senza_cat int; n_platform_true int;
BEGIN
  SELECT count(*) INTO n_op
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PLATFORM_OPERATOR' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('observability:read', 'provenance:read', 'notification:read');
  IF n_op <> 3 THEN
    RAISE EXCEPTION '000422: PLATFORM_OPERATOR deve avere 3 permessi (observability:read, provenance:read, notification:read), ne ha %', n_op;
  END IF;

  SELECT count(*) INTO n_sales
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'SALES' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('leads:read', 'leads:update');
  IF n_sales <> 2 THEN
    RAISE EXCEPTION '000422: SALES deve avere 2 permessi (leads:read, leads:update), ne ha %', n_sales;
  END IF;

  -- Chi aveva notification:create deve avere ANCHE notification:read (nessuna regressione
  -- sull'audit che gia' esercitava).
  SELECT count(*) INTO n_create_holders
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'notification:create' AND rp.revoked_at IS NULL;
  SELECT count(*) INTO n_missing
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'notification:create' AND rp.revoked_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_auth_role_permissions rp2
         JOIN sys.sys_auth_permissions p2 ON p2.auth_permission_id = rp2.auth_permission_id
        WHERE rp2.auth_role_id = rp.auth_role_id
          AND p2.auth_permission_code = 'notification:read'
          AND rp2.revoked_at IS NULL
     );
  IF n_missing <> 0 THEN
    RAISE EXCEPTION '000422: % titolari di notification:create non hanno ricevuto notification:read', n_missing;
  END IF;

  SELECT count(*) INTO n_read_holders
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'notification:read' AND rp.revoked_at IS NULL;
  IF n_read_holders <> n_create_holders + 1 THEN
    RAISE EXCEPTION '000422: notification:read deve avere % titolari (i % di notification:create + PLATFORM_OPERATOR), ne ha %', n_create_holders + 1, n_create_holders, n_read_holders;
  END IF;

  -- Nessun ruolo senza famiglia (000414 lo ripeterebbe al prossimo deploy: qui lo si
  -- garantisce subito).
  SELECT count(*) INTO n_senza_cat
    FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000422: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  -- PLATFORM_ADMIN resta l'unico is_platform=true (mask.ts, actor.ts se ne fidano).
  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000422: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000422: PLATFORM_OPERATOR (3 permessi) e SALES (2 permessi) creati; notification:read su % ruoli (create-holders + PLATFORM_OPERATOR); 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.', n_read_holders;
END $$;

COMMIT;

-- FINE 000422
