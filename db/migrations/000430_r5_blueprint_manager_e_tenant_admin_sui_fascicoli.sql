-- 000430 — Mandato K, R-5: BLUEPRINT_MANAGER completato, PROCESS_OWNER lasciato separato
-- (passo 51, dopo K1-ADR/R-0/R-9).
--
-- IL PERCHE'. `tenant_blueprint:read/write/approve` erano concessi SOLO a PLATFORM_ADMIN
-- (mig. 000300, decisioni E1/E6): nessun ruolo di cliente o di piattaforma-assegnata li
-- aveva ancora. R-5 li apre a due ruoli, con poteri diversi (E1/E3):
--   BLUEPRINT_MANAGER (funzione di piattaforma, gia' in PLATFORM_ASSIGNED_MANDATE_ROLES
--     da questa stessa migrazione, D9=B): read/write, MAI approve — costruisce il fascicolo,
--     non lo approva. Vede SOLO i clienti a cui e' assegnato.
--   TENANT_ADMIN (il cliente): read/approve, MAI write — il cliente approva e possiede,
--     non modifica il contenuto del suo profilo. Vede SOLO il proprio tenant.
--
-- PROCESS_OWNER NON cambia (E3): resta fuori da questa migrazione.
--
-- LO SCOPE (apps/api/src/modules/tenant-blueprints/service.ts): entrambi passano da
-- `perimetroClienti(actor)` (I-G), la stessa funzione gia' usata per PLATFORM_ADMIN (nessun
-- filtro). BLUEPRINT_MANAGER entra in PLATFORM_ASSIGNED_MANDATE_ROLES
-- (apps/api/src/lib/scope/mandati.ts) cosi' il middleware tenantContext popola
-- `assignedTenantIds` per lui; TENANT_ADMIN non e' in quell'insieme, quindi
-- `perimetroClienti` ricade sul proprio `tenantId`.
--
-- I 57 PERMESSI CONDIVISI fra BLUEPRINT_MANAGER e PROCESS_OWNER (misurati per il passo 52)
-- NON si toccano qui: restano per una decisione futura di Enzo, elenco in
-- esiti/R-5_57_condivisi.md.
--
-- NESSUN RITIRO: tre grant aggiuntivi, nessuna riga ritirata. G-D2 resta vuota. La
-- sentinella S-1 (000418) non ha bisogno di essere emendata: il titolare di
-- `tenant_blueprint:*` non e' piu' un sottoinsieme di {PLATFORM_ADMIN,HRMS_MANAGER,
-- TENANT_ADMIN} (BLUEPRINT_MANAGER si aggiunge), quindi le tre righe escono da sole dalla
-- vista `v_permessi_solo_plenipotenziari` — verificato dopo l'applicazione.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_role_permissions rp join sys.sys_auth_roles r on r.auth_role_id=rp.auth_role_id join sys.sys_auth_permissions p on p.auth_permission_id=rp.auth_permission_id where r.auth_role_code='BLUEPRINT_MANAGER' and p.auth_permission_code='tenant_blueprint:write' and rp.revoked_at is null
--
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'BLUEPRINT_MANAGER'
   AND p.auth_permission_code IN ('tenant_blueprint:read', 'tenant_blueprint:write')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Estensione allowlist TENANT_ADMIN (D-57, guardia rbac-tenant-admin-allowlist): la 000210
-- cancella ogni grant a TENANT_ADMIN fuori allowlist a ogni riapplicazione della catena.
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000430(code text PRIMARY KEY);
INSERT INTO _ta_extend_000430(code) VALUES
    ('tenant_blueprint:read'),
    ('tenant_blueprint:approve');

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'TENANT_ADMIN'
   AND p.auth_permission_code IN ('tenant_blueprint:read', 'tenant_blueprint:approve')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DROP TABLE _ta_extend_000430;

-- Self-healing: BLUEPRINT_MANAGER MAI tenant_blueprint:approve; TENANT_ADMIN MAI
-- tenant_blueprint:write (E1/E3, il cliente approva e possiede, non scrive il contenuto).
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'BLUEPRINT_MANAGER'
   AND p.auth_permission_code = 'tenant_blueprint:approve';

DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'TENANT_ADMIN'
   AND p.auth_permission_code = 'tenant_blueprint:write';

DO $$
DECLARE
  n_bm int; n_ta int; n_bm_vietato int; n_ta_vietato int; n_solo_plenipotenziari int;
BEGIN
  SELECT count(*) INTO n_bm
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'BLUEPRINT_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('tenant_blueprint:read', 'tenant_blueprint:write');
  IF n_bm <> 2 THEN
    RAISE EXCEPTION '000430: BLUEPRINT_MANAGER deve avere tenant_blueprint:read/write, trovati %', n_bm;
  END IF;

  SELECT count(*) INTO n_ta
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('tenant_blueprint:read', 'tenant_blueprint:approve');
  IF n_ta <> 2 THEN
    RAISE EXCEPTION '000430: TENANT_ADMIN deve avere tenant_blueprint:read/approve, trovati %', n_ta;
  END IF;

  SELECT count(*) INTO n_bm_vietato
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'BLUEPRINT_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code = 'tenant_blueprint:approve';
  IF n_bm_vietato <> 0 THEN
    RAISE EXCEPTION '000430: BLUEPRINT_MANAGER non deve avere tenant_blueprint:approve (E1/E3), ne ha %', n_bm_vietato;
  END IF;

  SELECT count(*) INTO n_ta_vietato
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code = 'tenant_blueprint:write';
  IF n_ta_vietato <> 0 THEN
    RAISE EXCEPTION '000430: TENANT_ADMIN non deve avere tenant_blueprint:write (E1/E3), ne ha %', n_ta_vietato;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000430: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT count(*) INTO n_solo_plenipotenziari
    FROM sys.v_permessi_solo_plenipotenziari
   WHERE permission_code LIKE 'tenant_blueprint:%';
  IF n_solo_plenipotenziari <> 0 THEN
    RAISE EXCEPTION '000430: tenant_blueprint:* non deve piu'' apparire come solo-plenipotenziario dopo questa migrazione, trovate %', n_solo_plenipotenziari;
  END IF;

  RAISE NOTICE '000430: BLUEPRINT_MANAGER read/write e TENANT_ADMIN read/approve su tenant_blueprint; nessun approve a BLUEPRINT_MANAGER, nessun write a TENANT_ADMIN; G-D2 a zero; S-1 non piu'' scattata su tenant_blueprint:*.';
END $$;

COMMIT;

-- FINE 000430
