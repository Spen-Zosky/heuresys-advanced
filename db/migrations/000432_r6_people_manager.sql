-- 000432 — Mandato K, R-6 sessione 1: PEOPLE_MANAGER (D2=A, dopo X-1 ratificata).
--
-- IL PERCHE'. PEOPLE_MANAGER e' il ruolo di CLIENTE per la gestione operativa delle
-- persone: tutti i permessi di SCRITTURA sulle tabelle NATIVE/IBRIDE della
-- classificazione X-1 (`sys.sys_classificazione_direzione_dato`) + LETTURA sulle
-- tabelle IMPORTATE + `compensation_intelligence:update` (passo 56, testo esatto).
-- NON tocca i dati importati dal legacy (I12): li legge, non li scrive.
--
-- L'elenco si e' GENERATO con `tools/permessi_da_classificazione.py` (124 candidati)
-- e RIVISTO A MANO (mandato, passo 56): 39 esclusi perche' appartengono a domini gia'
-- assegnati altrove nel mandato K (avviamento, recruiting, GDPR, tassonomia,
-- commerciale, piattaforma) o a un'invariante non negoziabile
-- (`whistleblowing:manage`, isolamento assoluto ADR-0036 §5). Dettaglio completo,
-- motivo per motivo: `esiti/R-6_permessi_people_manager.md`.
--
-- HRMS_MANAGER RESTA INTATTO: nessun ritiro in questa migrazione (G-D2 lo verifica).
-- PEOPLE_MANAGER entra in HR_MANDATED_ROLES (mandato, sezione 2, conseguenza b) —
-- `apps/api/src/lib/scope/resolver.ts` — cosi' l'asse organizzativo (I18) gli apre
-- lo stesso perimetro di TENANT_ADMIN/HRMS_MANAGER: tutto il tenant, non solo il
-- proprio sotto-albero.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='PEOPLE_MANAGER' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 0. Misura PRIMA di toccare nulla: HRMS_MANAGER non deve calare (nessun ritiro
-- in questa migrazione). Confronto prima/dopo, non una soglia assoluta — misurato
-- sul vivo il 2026-09-19: HRMS_MANAGER ha 167 permessi, non ">200" come una prima
-- stesura di questa post-condizione assumeva senza aver misurato.
CREATE TEMP TABLE _hrms_prima AS
SELECT count(*) AS n
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
 WHERE r.auth_role_code = 'HRMS_MANAGER' AND rp.revoked_at IS NULL;

-- 1. Il ruolo, famiglia dichiarata subito (000414 la pretende).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('PEOPLE_MANAGER', 'People Manager',
   'Gestione operativa delle persone: scrittura su tutte le tabelle NATIVE/IBRIDE della classificazione X-1 (obiettivi, competenze, formazione, carriera, engagement, KPI, posizioni, organigramma...) + lettura sulle tabelle IMPORTATE dal legacy. Mandato HR tenant-wide (HR_MANDATED_ROLES), come TENANT_ADMIN/HRMS_MANAGER. Non concede ruoli, non tocca GDPR/avviamento/recruiting/tassonomia/whistleblowing (domini di altri ruoli). Nato mandato K, R-6, 2026-09-19.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Grant: i 78 permessi rivisti a mano (esiti/R-6_permessi_people_manager.md).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'PEOPLE_MANAGER'
   AND p.auth_permission_code IN (
    ('analytics:view'),
    ('approval:create'),
    ('approval:decide'),
    ('assessment:create'),
    ('assessment:update'),
    ('branch:list'),
    ('branch:read'),
    ('capability:read'),
    ('career_succession:create'),
    ('career_succession:delete'),
    ('career_succession:read'),
    ('career_succession:update'),
    ('compensation_intelligence:read'),
    ('compensation_intelligence:update'),
    ('content:create'),
    ('content:delete'),
    ('content:publish'),
    ('content:update'),
    ('dashboard:view'),
    ('engagement_feedback:create'),
    ('engagement_feedback:delete'),
    ('engagement_feedback:update'),
    ('evidence:read'),
    ('gap_analysis:create'),
    ('gap_analysis:delete'),
    ('gap_analysis:read'),
    ('gap_analysis:update'),
    ('goal:create'),
    ('goal:delete'),
    ('goal:read'),
    ('goal:update'),
    ('insights:view'),
    ('job_role:create'),
    ('job_role:update'),
    ('kpi:create'),
    ('kpi:delete'),
    ('kpi:read'),
    ('kpi:update'),
    ('learning:create'),
    ('learning:delete'),
    ('learning:update'),
    ('leave:read'),
    ('mentorship:create'),
    ('mentorship:delete'),
    ('mentorship:read'),
    ('mentorship:update'),
    ('okr:create'),
    ('okr:delete'),
    ('okr:update'),
    ('org_director:read'),
    ('organization_unit:create'),
    ('organization_unit:delete'),
    ('organization_unit:update'),
    ('organization_unit_processes:create'),
    ('organization_unit_processes:delete'),
    ('position:create'),
    ('position:delete'),
    ('position:read'),
    ('position:update'),
    ('predictions:read'),
    ('skill:create'),
    ('skill:self_assess'),
    ('skill:update'),
    ('surveys:create'),
    ('surveys:delete'),
    ('surveys:read'),
    ('surveys:update'),
    ('talent:read'),
    ('team:manage'),
    ('timeline:read'),
    ('training_initiative:create'),
    ('training_initiative:update'),
    ('user:create'),
    ('user:delete'),
    ('user:update'),
    ('visualization:create'),
    ('visualization:delete'),
    ('visualization:update_layout')
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_pm int; n_vietati int; n_senza_cat int; n_platform_true int; n_hrms int;
BEGIN
  SELECT count(*) INTO n_pm
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code = 'PEOPLE_MANAGER' AND rp.revoked_at IS NULL;
  IF n_pm <> 78 THEN
    RAISE EXCEPTION '000432: PEOPLE_MANAGER deve avere 78 permessi, ne ha %', n_pm;
  END IF;

  -- I domini esclusi non devono comparire, per costruzione (typo guard sulla revisione).
  -- job_family:* e organization_unit_kpi_template:*/process_kpi_template:* sono anch'essi
  -- esclusi: sono residui G2 (000199) la cui audience DEVE essere identica a quella del
  -- permesso sorgente (tenant:create / bpm_process:*, rispettivamente) — concederli a
  -- PEOPLE_MANAGER senza concedere ANCHE il sorgente romperebbe quell'invariante
  -- (rbac-delete-permissions.test.ts, "each G2-residual permission keeps the audience of
  -- its source"), misurato in sessione dopo un primo giro rosso su job_family:create.
  SELECT count(*) INTO n_vietati
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PEOPLE_MANAGER' AND rp.revoked_at IS NULL
     AND (
       p.auth_permission_code LIKE 'blueprint:%' OR p.auth_permission_code LIKE 'gdpr:%'
       OR p.auth_permission_code = 'role:assign' OR p.auth_permission_code LIKE 'seed_acquisition:%'
       OR p.auth_permission_code LIKE 'tenant:%' OR p.auth_permission_code = 'tenant_materialization:execute'
       OR p.auth_permission_code LIKE 'skill_taxonomy:%' OR p.auth_permission_code = 'skill_alias:manage'
       OR p.auth_permission_code = 'whistleblowing:manage' OR p.auth_permission_code = 'delegation:manage'
       OR p.auth_permission_code IN ('candidate:write','interview:feedback','offer:manage','requisition:manage','leads:update')
       OR p.auth_permission_code LIKE 'job_family:%'
       OR p.auth_permission_code LIKE 'organization_unit_kpi_template:%'
       OR p.auth_permission_code LIKE 'process_kpi_template:%'
     );
  IF n_vietati <> 0 THEN
    RAISE EXCEPTION '000432: PEOPLE_MANAGER non deve avere permessi di altri domini (avviamento/GDPR/recruiting/tassonomia/whistleblowing/commerciale/G2-residui), ne ha %', n_vietati;
  END IF;

  -- HRMS_MANAGER resta intatto: nessun ritiro in questa migrazione (confronto
  -- prima/dopo dentro la stessa transazione, non una soglia assoluta).
  SELECT count(*) INTO n_hrms
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND rp.revoked_at IS NULL;
  IF n_hrms <> (SELECT n FROM _hrms_prima) THEN
    RAISE EXCEPTION '000432: HRMS_MANAGER e'' cambiato (era %, ora %) — questa migrazione non deve ritirare ne'' aggiungere nulla', (SELECT n FROM _hrms_prima), n_hrms;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000432: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT count(*) INTO n_senza_cat
    FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000432: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000432: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000432: PEOPLE_MANAGER creato (78 permessi, revisione a mano); 0 permessi di altri domini; HRMS_MANAGER intatto (% permessi); G-D2 a zero; 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.', n_hrms;
END $$;

DROP TABLE _hrms_prima;

COMMIT;

-- FINE 000432
