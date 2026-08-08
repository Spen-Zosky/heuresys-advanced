-- ============================================================================
-- 000300 — I permessi del fascicolo, e cio' che il cliente non tocca piu'.
--          (#131 Tenant Builder P1, T3)
--
-- DECISIONE E9 (Enzo, 2026-08-05): dopo la firma i dati sono del cliente, ma
-- il lavoro di creazione del fascicolo condotto PRIMA della firma non si
-- modifica, e i campi bloccanti (ATECO, settore, modello ancorato) non si
-- toccano affatto. Fino a oggi TENANT_ADMIN deteneva `blueprint:activate`,
-- `:override` e `:delete` — cioe' poteva riscrivere i propri processi e le
-- proprie motivazioni. Verificato live prima di agire: li deteneva davvero.
--
-- ⚠️ L'EFFETTO DELLA REVOCA NON STA IN QUESTO FILE, e non e' una svista.
--   I tre codici sono stati tolti dalla `VALUES` della
--   `000210_tenant_admin_permission_allowlist.sql`, che e' un'allowlist
--   deny-by-default: passo 1 concede cio' che e' in elenco, passo 2 revoca
--   tutto il resto, passo 3 pretende che l'insieme vivo coincida con l'elenco.
--   La catena si ri-applica per intero a ogni deploy (ADR-0034), quindi una
--   `DELETE` in questa migrazione a valle verrebbe disfatta dal passo 1 al giro
--   dopo — il permesso oscillerebbe — e renderebbe rossa la guardia
--   `apps/api/test/rbac-tenant-admin-allowlist.test.ts`, che asserisce quella
--   coincidenza leggendo l'elenco DAL FILE.
--   Questo file porta i permessi nuovi, la loro concessione e le VERIFICHE.
--
-- PER TORNARE INDIETRO: si rimettono i tre codici nella `VALUES` della 000210.
--
-- IDEMPOTENTE + sicura due volte.
-- ============================================================================
BEGIN;

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource,
   auth_permission_action, auth_permission_description)
VALUES
  ('tenant_blueprint:read',    'Leggere i fascicoli',   'tenant_blueprint', 'read',
   'Leggere i fascicoli di configurazione delle aziende e le loro versioni.'),
  ('tenant_blueprint:write',   'Comporre un fascicolo', 'tenant_blueprint', 'write',
   'Creare fascicoli, compilarne l''identita'' e decidere sui processi.'),
  ('tenant_blueprint:approve', 'Approvare un fascicolo','tenant_blueprint', 'approve',
   'Approvare una versione di fascicolo: vale come firma.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Canone i18n (ADR-0029): italiano canonico IN RIGA, inglese come sovrapposizione
-- in `sys_reference_translations`. Senza questo blocco il cancello di copertura
-- EN va rosso con «restano 6 traduzioni mancanti» — 3 permessi x 2 campi — ed e'
-- esattamente cosi' che la prova generale lo ha intercettato prima del push.
WITH en(code, name_en, desc_en) AS (
  VALUES
    ('tenant_blueprint:read',    'Read configuration dossiers',
     'Read the company configuration dossiers and their versions.'),
    ('tenant_blueprint:write',   'Compose a configuration dossier',
     'Create dossiers, fill in their identity and decide on processes.'),
    ('tenant_blueprint:approve', 'Approve a configuration dossier',
     'Approve a dossier version: it counts as a signature.')
)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, v.field, 'en', v.text, 'MANUAL'
  FROM en
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = en.code
  CROSS JOIN LATERAL (VALUES ('name', en.name_en), ('description', en.desc_en)) AS v(field, text)
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_resource = 'tenant_blueprint'
 WHERE r.auth_role_code = 'PLATFORM_ADMIN'
ON CONFLICT DO NOTHING;

DO $$
DECLARE n_nuovi int; n_platform int; n_altri int; n_tenant int;
BEGIN
  SELECT count(*) INTO n_nuovi FROM sys.sys_auth_permissions
   WHERE auth_permission_resource = 'tenant_blueprint';
  IF n_nuovi <> 3 THEN
    RAISE EXCEPTION '000300: attesi 3 permessi tenant_blueprint, trovati %', n_nuovi;
  END IF;

  SELECT count(*) INTO n_platform
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND p.auth_permission_resource = 'tenant_blueprint';
  IF n_platform <> 3 THEN
    RAISE EXCEPTION '000300: PLATFORM_ADMIN deve avere tutti e 3 i permessi, ne ha %', n_platform;
  END IF;

  -- Decisione E1, verificata sulla RIGA intera e non solo sul ruolo appena
  -- servito: nessun altro ruolo detiene i permessi del fascicolo.
  SELECT count(*) INTO n_altri
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_resource = 'tenant_blueprint' AND r.auth_role_code <> 'PLATFORM_ADMIN';
  IF n_altri <> 0 THEN
    RAISE EXCEPTION '000300: % concessioni di tenant_blueprint fuori da PLATFORM_ADMIN', n_altri;
  END IF;

  -- L'effetto della revoca lo produce la 000210; QUI si verifica che sia
  -- avvenuto. E' la differenza fra fare una cosa e sapere che e' successa.
  SELECT count(*) INTO n_tenant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN'
     AND p.auth_permission_code IN ('blueprint:activate','blueprint:override','blueprint:delete');
  IF n_tenant <> 0 THEN
    RAISE EXCEPTION '000300: TENANT_ADMIN detiene ancora % permessi di modifica del modello — '
                    'controllare che i codici siano stati tolti dalla VALUES della 000210', n_tenant;
  END IF;

  -- Post-condizione che protegge cio' che NON doveva cambiare: il cliente
  -- continua a VEDERE il proprio modello. Togliergli anche la lettura sarebbe
  -- un effetto collaterale, non la decisione E9.
  SELECT count(*) INTO n_tenant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND p.auth_permission_code = 'blueprint:read';
  IF n_tenant <> 1 THEN
    RAISE EXCEPTION '000300: TENANT_ADMIN ha perso anche la LETTURA del modello: non era la decisione';
  END IF;

  -- La copertura EN dei tre permessi: 3 codici x 2 campi = 6 righe.
  SELECT count(*) INTO n_tenant
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE t.entity_table = 'sys_auth_permissions' AND t.locale = 'en'
     AND p.auth_permission_resource = 'tenant_blueprint';
  IF n_tenant <> 6 THEN
    RAISE EXCEPTION '000300: attese 6 traduzioni EN dei permessi del fascicolo, trovate %', n_tenant;
  END IF;

  RAISE NOTICE '000300: 3 permessi del fascicolo al solo PLATFORM_ADMIN (EN coperto); TENANT_ADMIN legge il modello ma non lo riscrive piu';
END $$;

COMMIT;
