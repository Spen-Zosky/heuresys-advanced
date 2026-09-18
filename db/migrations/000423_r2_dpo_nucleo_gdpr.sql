-- 000423 — Mandato K, R-2: DPO, nucleo GDPR (D3=A, decisione C di Enzo 2026-09-18).
--
-- IL PERCHE'. R-2 nasce come domanda architetturale (esiti/R-2_domanda_masking.md): "come
-- il DPO legge il dossier di una persona con i campi sensibili mascherati" tocca I18/I20
-- (HR_MANDATED_ROLES + mask.ts). Enzo ha scelto l'opzione C (esiti/RISPOSTE_ENZO.md, riga
-- R-2): questa migrazione chiude SOLO il nucleo GDPR — i quattro permessi che il ruolo
-- DPO riceve, e il ritiro di gdpr:erase a HRMS_MANAGER — senza toccare HR_MANDATED_ROLES,
-- mask.ts o inventare un terzo stato "tenant-wide ma mascherato". La lettura mascherata
-- del dossier resta una voce D-nuova separata, BLOCCATA(Enzo).
--
-- DPO e' tenant-scoped come TENANT_ADMIN/HRMS_MANAGER: NON entra in GDPR_MANDATE_ROLES
-- (apps/api/src/lib/scope/mandati.ts), quindi assertTenantScope lo limita al proprio
-- tenant come loro, e runRetention gli risponde 403 PLATFORM_ONLY come already succede a
-- TENANT_ADMIN/HRMS_MANAGER (difetto preesistente, registrato in REGISTRO_SCOPERTE, non
-- risolto qui). auth_role_is_platform=false (come BLUEPRINT_MANAGER/PLATFORM_OPERATOR).
--
-- I quattro permessi (gdpr:read, gdpr:export, gdpr:erase, gdpr:retention) esistono gia'
-- (mig. 000186): nessun permesso nuovo qui, solo il grant a DPO e il ritiro a HRMS_MANAGER.
-- La riga di eccezione a G-D2 (HRMS_MANAGER, gdpr:erase, 'R-2') e' GIA' in
-- sys.sys_ritiri_ammessi da 000420 (R-1 passo 0, che l'ha prenotata in anticipo): questa
-- migrazione la USA (il ritiro effettivo), non la crea.
--
-- ROLLBACK: pronto e committato PRIMA di applicare questa migrazione in produzione, in
-- .programmi/K-ruoli-direzione/evidenze/R-2_202609190000/rollback_pronto_000424.sql — FUORI
-- da db/migrations/ apposta: se stesse qui verrebbe ri-eseguito a ogni deploy e disfarebbe
-- R-2 da subito. Si attiva SOLO copiandolo in db/migrations/000424_....sql, decisione che
-- spetta a chi vuole disfare R-2, non un effetto automatico di questo file.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='DPO' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Il ruolo, con la famiglia dichiarata subito (000414 la pretende).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('DPO', 'Data Protection Officer',
   'Nucleo GDPR del tenant: gdpr:read, gdpr:export, gdpr:erase, gdpr:retention (mandato K, R-2, D3=A, 2026-09-18). Tenant-scoped come TENANT_ADMIN/HRMS_MANAGER — non ha mandato piattaforma. La lettura mascherata del dossier (I18/I20) e'' una voce separata, non ancora decisa.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Grant a DPO: i quattro permessi gia' esistenti (mig. 000186).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'DPO'
   AND p.auth_permission_code IN ('gdpr:read', 'gdpr:export', 'gdpr:erase', 'gdpr:retention')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. Il ritiro (D3=A): gdpr:erase a HRMS_MANAGER. Ritirare non e'' cancellare (ADR-0035):
--    la riga resta, marcata. La riga di eccezione a G-D2 e'' gia'' in sys_ritiri_ammessi
--    da 000420 — qui si esegue solo l'atto.
UPDATE sys.sys_auth_role_permissions rp
   SET revoked_at = now(), revoked_by_migration = '000423'
  FROM sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'HRMS_MANAGER'
   AND p.auth_permission_code = 'gdpr:erase'
   AND rp.revoked_at IS NULL;

-- 4. Le traduzioni inglesi (000255/000272/000300/000404/000422: la guardia della 000255
--    pretende copertura EN totale su sys_auth_roles, nome E descrizione).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('DPO', 'name', 'Data Protection Officer'),
    ('DPO', 'description',
     'Tenant GDPR core: gdpr:read, gdpr:export, gdpr:erase, gdpr:retention (mandato K, R-2, D3=A, 2026-09-18). Tenant-scoped like TENANT_ADMIN/HRMS_MANAGER — no platform mandate. Masked-dossier reading (I18/I20) is a separate, not-yet-decided item.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

-- 5. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_dpo int; n_hrms_erase_active int; n_hrms_erase_revoked int; n_guardia int;
  n_senza_cat int; n_platform_true int; n_ammessi int;
BEGIN
  SELECT count(*) INTO n_dpo
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DPO' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('gdpr:read', 'gdpr:export', 'gdpr:erase', 'gdpr:retention');
  IF n_dpo <> 4 THEN
    RAISE EXCEPTION '000423: DPO deve avere 4 permessi (gdpr:read/export/erase/retention), ne ha %', n_dpo;
  END IF;

  SELECT count(*) INTO n_hrms_erase_active
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND p.auth_permission_code = 'gdpr:erase'
     AND rp.revoked_at IS NULL;
  IF n_hrms_erase_active <> 0 THEN
    RAISE EXCEPTION '000423: HRMS_MANAGER ha ancora gdpr:erase ATTIVO dopo il ritiro (D3=A)';
  END IF;

  SELECT count(*) INTO n_hrms_erase_revoked
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND p.auth_permission_code = 'gdpr:erase'
     AND rp.revoked_at IS NOT NULL AND rp.revoked_by_migration = '000423';
  IF n_hrms_erase_revoked <> 1 THEN
    RAISE EXCEPTION '000423: la riga ritirata di HRMS_MANAGER/gdpr:erase non e'' marcata come attesa (%)', n_hrms_erase_revoked;
  END IF;

  -- TENANT_ADMIN NON e'' toccato da questa voce (D3=A parla solo di HRMS_MANAGER): resta
  -- titolare di gdpr:erase, nessuna regressione sul suo perimetro.
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE r.auth_role_code = 'TENANT_ADMIN' AND p.auth_permission_code = 'gdpr:erase'
       AND rp.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION '000423: TENANT_ADMIN ha perso gdpr:erase — D3=A parla solo di HRMS_MANAGER';
  END IF;

  -- G-D2: la guardia deve restare a zero (l'eccezione e'' dichiarata in sys_ritiri_ammessi).
  SELECT count(*) INTO n_ammessi FROM sys.sys_ritiri_ammessi
   WHERE role_code = 'HRMS_MANAGER' AND permission_code = 'gdpr:erase';
  IF n_ammessi <> 1 THEN
    RAISE EXCEPTION '000423: manca la riga di eccezione G-D2 per HRMS_MANAGER/gdpr:erase (attesa da 000420)';
  END IF;

  SELECT count(*) INTO n_guardia FROM sys.v_permessi_ritirati_a_ruoli_preesistenti;
  IF n_guardia <> 0 THEN
    RAISE EXCEPTION '000423: guardia G-D2 accesa (% righe), attese 0', n_guardia;
  END IF;

  SELECT count(*) INTO n_senza_cat FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000423: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000423: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000423: DPO creato con 4 permessi; HRMS_MANAGER ha perso gdpr:erase (ritirato, non cancellato); TENANT_ADMIN invariato; G-D2 a zero; 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.';
END $$;

COMMIT;

-- FINE 000423
