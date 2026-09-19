-- 000431 — Mandato K, R-8: IMPLEMENTATION_CONSULTANT (D9=B, dopo R-0, R-9, K1-ADR).
--
-- IL PERCHE'. Un consulente esterno che porta un cliente in produzione (avviamento):
-- registra la fonte, apre e conduce le corse di ricerca, vede i candidati trovati e i
-- fascicoli. Vede SOLO i clienti a cui e' stato assegnato
-- (sys.sys_platform_user_tenant_assignments, mig. 000421), MAI tutti come PLATFORM_ADMIN
-- (e' un consulente esterno: l'elenco completo dei clienti e' un problema commerciale,
-- mandato sezione D9).
--
-- I 7 MODULI DELL'AVVIAMENTO (I-C, esiti/I-C.md riga 15) e i permessi concessi:
--   · tenant-blueprints    — tenant_blueprint:read (SOLO lettura: chi decide/approva il
--     fascicolo resta BLUEPRINT_MANAGER/TENANT_ADMIN, R-5. Il consulente lo consulta).
--   · seed-acquisition-runs — seed_acquisition:read, seed_acquisition:trigger (conduce le
--     corse di ricerca: e' il verbo di questo ruolo).
--   · seed-candidate-records, seed-approval-decisions, tenant-import-runs — stessa famiglia
--     seed_acquisition:read/trigger (nessun modulo nuovo: sono la stessa pipeline).
--   · tenants — tenant:read (vede i dati del cliente assegnato, non l'elenco commerciale
--     intero: il filtro e' nel servizio via perimetroClienti, non nel permesso).
--   · tenant-materialization — NESSUN grant: `GET /sources` e' gia' aperto a chiunque sia
--     autenticato (routes.ts, nessuna gate); la POST che materializza resta PLATFORM_ADMIN
--     via `ensurePlatformAdmin` nel servizio (#132 E29, atto irreversibile) — nessuna prova
--     di R-8 lo richiede, e non e' "aggiungere il ruolo a un insieme esistente": e'
--     un'estensione di potere non specificata dal mandato, quindi non si concede.
--
-- NON concesso, per separazione dei compiti (stessa forma di E1/E3 in R-5):
--   · seed_acquisition:approve — la decisione di approvare un candidato resta del cliente
--     (TENANT_ADMIN) o della piattaforma; il consulente propone, non approva.
--   · seed_acquisition:delete, tenant:create, tenant:delete, tenant_blueprint:write/approve —
--     poteri amministrativi/distruttivi, fuori mandato per un consulente esterno.
--   · role:assign (CAN_GRANT_ROLES) — IMPLEMENTATION_CONSULTANT non concede ruoli (passo 55:
--     "concede un ruolo -> 403").
--
-- REGISTRATO, NON RISOLTO QUI (esiti/REGISTRO_SCOPERTE.md, S1109): la quarta prova di passo
-- 55 ("legge una busta paga -> mascherata") richiederebbe che il resolver organizzativo
-- (`lib/scope/resolver.ts`/`domains.ts`, che oggi riconosce solo PLATFORM_ADMIN/HR-mandato/
-- albero) sappia leggere `assignedTenantIds` per aprire una lettura mascherata sul tenant
-- assegnato — un'estensione architetturale mai fatta per BLUEPRINT_MANAGER (R-5) ne' per
-- PLATFORM_OPERATOR/SALES (R-9), e non "aggiungere il ruolo a un insieme esistente" come le
-- altre voci di F4. Tocca I16/I18/I20: non si inventa qui senza una decisione di Enzo.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_role_permissions rp join sys.sys_auth_roles r on r.auth_role_id=rp.auth_role_id join sys.sys_auth_permissions p on p.auth_permission_id=rp.auth_permission_id where r.auth_role_code='IMPLEMENTATION_CONSULTANT' and p.auth_permission_code='seed_acquisition:trigger' and rp.revoked_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Il ruolo, famiglia dichiarata subito (000414 la pretende).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('IMPLEMENTATION_CONSULTANT', 'Implementation Consultant',
   'Consulente esterno di avviamento: conduce le corse di ricerca (seed acquisition), vede i candidati trovati e i fascicoli, sui soli clienti a cui e'' stato assegnato (sys_platform_user_tenant_assignments, mandato K D9=B) — mai tutti i clienti come PLATFORM_ADMIN. Non approva candidati ne'' concede ruoli. Nato mandato K, R-8, 2026-09-19.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Grant: i moduli dell'avviamento, sola lettura + trigger delle corse.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'IMPLEMENTATION_CONSULTANT'
   AND p.auth_permission_code IN (
     'tenant:read',
     'tenant_blueprint:read',
     'seed_acquisition:read',
     'seed_acquisition:trigger'
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. Le traduzioni inglesi (guardia 000255: copertura EN totale su ruoli/permessi; qui
--    nessun permesso nuovo, solo il ruolo).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('IMPLEMENTATION_CONSULTANT', 'name', 'Implementation Consultant'),
    ('IMPLEMENTATION_CONSULTANT', 'description',
     'External onboarding consultant: runs seed-acquisition searches, sees the candidates found and the tenant blueprints, only for the customers it has been assigned to (sys_platform_user_tenant_assignments, mandato K D9=B) — never every customer like PLATFORM_ADMIN. Does not approve candidates or grant roles. Born mandato K, R-8, 2026-09-19.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

-- 4. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_ic int; n_vietati int; n_senza_cat int; n_platform_true int;
BEGIN
  SELECT count(*) INTO n_ic
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'IMPLEMENTATION_CONSULTANT' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('tenant:read', 'tenant_blueprint:read', 'seed_acquisition:read', 'seed_acquisition:trigger');
  IF n_ic <> 4 THEN
    RAISE EXCEPTION '000431: IMPLEMENTATION_CONSULTANT deve avere 4 permessi, ne ha %', n_ic;
  END IF;

  SELECT count(*) INTO n_vietati
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'IMPLEMENTATION_CONSULTANT' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'seed_acquisition:approve', 'seed_acquisition:delete',
       'tenant:create', 'tenant:delete',
       'tenant_blueprint:write', 'tenant_blueprint:approve',
       'tenant_materialization:execute', 'role:assign'
     );
  IF n_vietati <> 0 THEN
    RAISE EXCEPTION '000431: IMPLEMENTATION_CONSULTANT non deve avere poteri amministrativi/di approvazione, ne ha %', n_vietati;
  END IF;

  SELECT count(*) INTO n_senza_cat
    FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000431: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000431: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000431: IMPLEMENTATION_CONSULTANT creato (4 permessi: tenant:read, tenant_blueprint:read, seed_acquisition:read/trigger); 0 poteri amministrativi; 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.';
END $$;

COMMIT;

-- FINE 000431
