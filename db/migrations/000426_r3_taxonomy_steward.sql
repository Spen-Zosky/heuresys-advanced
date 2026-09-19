-- 000426 — Mandato K, R-3: TAXONOMY_STEWARD lato cliente (D1=B).
--
-- IL PERCHE'. R-3 nasce dalla decisione D1 di Enzo (2026-09-14): "i sinonimi (alias) delle
-- competenze li governa chi governa le competenze" — skill:create/update/delete non basta
-- piu' per i sinonimi, nasce skill_alias:manage. Il mandato (passo 45) descrive anche
-- permessi "skill_taxonomy_tenant:*" per il governo generale della tassonomia lato cliente
-- (sys_skills del proprio tenant, sys_job_roles). Misurato sul codice vivo
-- (skills/service.ts, job-roles/service.ts): le rotte skill:create/update e
-- job_role:create/update GIA' tenant-scopano correttamente un attore non-platform — non
-- esiste alcun buco da chiudere con permessi paralleli. Deviazione dichiarata in
-- esiti/R-3_permessi_dichiarati.txt: TAXONOMY_STEWARD riceve gli STESSI permessi
-- tenant-scoped gia' provati (skill:*, job_role:*), non un duplicato morto che nessuna
-- rotta controllerebbe (violerebbe S-2).
--
-- skill_alias:manage e' l'UNICO permesso nuovo. Concesso a TAXONOMY_STEWARD,
-- HRMS_MANAGER, TENANT_ADMIN (D1), PLATFORM_ADMIN (esplicito qui sotto).
--
-- ⚠ MISURATO IN SESSIONE (S1107, prima di chiudere questa migrazione): 000005 concede
-- "OGNI permesso" a PLATFORM_ADMIN con un CROSS JOIN che il suo commento descrive come
-- "rivalutato a ogni db:migrate" — vero SOLO su una catena applicata in un unico passaggio
-- da zero. Su un database GIA' migrato (heuresys_ci, la produzione) 000005 e' registrato
-- come applicato con lo stesso sha e NON riesegue: un permesso nato oggi in una migrazione
-- successiva NON viene assorbito finche' 000005 stesso non cambia contenuto. Provato dal
-- vivo: senza questa riga, PLATFORM_ADMIN riceveva 403 "Missing permission:
-- skill_alias:manage" nonostante il commento di 000005. Stessa classe di difetto gia'
-- trovata e corretta in 000152/000178 per R-9 (vedi commit "fix(ci,db)" di questa sessione).
--
-- NESSUN RITIRO. Il mandato (passo 46) prevede "il ritiro a USER di skill:create/
-- update/delete SOLO sulle rotte degli alias": misurato sul vivo (sys_auth_role_permissions),
-- USER non ha mai avuto skill:create/update/delete (solo skill:read, skill:read:self,
-- skill:self_assess) — la premessa del ritiro non esiste. G-D2 resta vuota per costruzione:
-- non c'e' nessuna riga da marcare revoked_at. Il test S-4 `it.skip` (skill-aliases-
-- isolation.integration.test.ts) aveva un commento stale ("Oggi USER ha skill:create e
-- questa rotta risponde 201") — corretto qui: la rotta cambia guardia (skill:create ->
-- skill_alias:manage), e USER prima E dopo risponde 403 per lo stesso motivo (non ha ne'
-- l'uno ne' l'altro) — il caso resta utile come prova di REGRESSIONE, non di transizione.
--
-- ROTTA. apps/api/src/modules/skill-aliases/routes.ts cambia requirePermission da
-- skill:create/update/delete a skill_alias:manage sulle tre rotte di scrittura. Il service
-- (authorizeWriteOnSkill, isPlatform/tenant scope) NON cambia.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='TAXONOMY_STEWARD' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Il ruolo, con la famiglia dichiarata subito (000414 la pretende).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('TAXONOMY_STEWARD', 'Taxonomy Steward',
   'Governo lato cliente della tassonomia: competenze e ruoli professionali del proprio tenant, piu'' i sinonimi (skill_alias:manage, D1=B). La parte di piattaforma (skill_taxonomy:*, job_family:*) resta a PLATFORM_ADMIN. Nato mandato K, R-3, 2026-09-19.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Il permesso nuovo: skill_alias:manage.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('skill_alias:manage', 'Manage skill synonyms (aliases)',
   'skill_alias', 'manage',
   'POST/PATCH/DELETE /v1/skill-aliases — governo dei sinonimi delle competenze, separato da skill:create/update/delete (D1=B, mandato K, R-3, 2026-09-19): "i sinonimi li governa chi governa le competenze".')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 3. Grant a TAXONOMY_STEWARD: i sette permessi (esiti/R-3_permessi_dichiarati.txt).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'TAXONOMY_STEWARD'
   AND p.auth_permission_code IN (
     'skill:create', 'skill:update', 'skill:read',
     'job_role:create', 'job_role:update', 'job_role:read',
     'skill_alias:manage'
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. Estensione dichiarata: skill_alias:manage a HRMS_MANAGER, TENANT_ADMIN (D1) e
--    PLATFORM_ADMIN (esplicito, non affidato al blanket di 000005 — vedi commento in
--    testa al file). Nessun ritiro corrispondente: si aggiungono al fianco di
--    skill:create/update/delete, che restano intatti (governano anche le competenze,
--    non solo gli alias).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code IN ('HRMS_MANAGER', 'TENANT_ADMIN', 'PLATFORM_ADMIN')
   AND p.auth_permission_code = 'skill_alias:manage'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 5. Le traduzioni inglesi (guardia della 000255: copertura EN totale su sys_auth_roles
--    e sys_auth_permissions, nome E descrizione).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('TAXONOMY_STEWARD', 'name', 'Taxonomy Steward'),
    ('TAXONOMY_STEWARD', 'description',
     'Client-side governance of the tenant taxonomy: own-tenant skills and job roles, plus synonyms (skill_alias:manage, D1=B). The platform side (skill_taxonomy:*, job_family:*) stays with PLATFORM_ADMIN. Born mandato K, R-3, 2026-09-19.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('skill_alias:manage', 'name', 'Manage skill synonyms (aliases)'),
    ('skill_alias:manage', 'description',
     'POST/PATCH/DELETE /v1/skill-aliases — skill synonym governance, split from skill:create/update/delete (D1=B, mandato K, R-3, 2026-09-19): "synonyms are governed by whoever governs the skills".')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT DO NOTHING;

-- 6. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_steward int; n_hrms int; n_ta int; n_pa int; n_senza_cat int; n_platform_true int;
BEGIN
  SELECT count(*) INTO n_steward
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TAXONOMY_STEWARD' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'skill:create', 'skill:update', 'skill:read',
       'job_role:create', 'job_role:update', 'job_role:read',
       'skill_alias:manage'
     );
  IF n_steward <> 7 THEN
    RAISE EXCEPTION '000426: TAXONOMY_STEWARD deve avere 7 permessi, ne ha %', n_steward;
  END IF;

  SELECT count(*) INTO n_hrms
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code = 'skill_alias:manage';
  IF n_hrms <> 1 THEN
    RAISE EXCEPTION '000426: HRMS_MANAGER deve avere skill_alias:manage, trovato %', n_hrms;
  END IF;

  SELECT count(*) INTO n_ta
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code = 'skill_alias:manage';
  IF n_ta <> 1 THEN
    RAISE EXCEPTION '000426: TENANT_ADMIN deve avere skill_alias:manage, trovato %', n_ta;
  END IF;

  SELECT count(*) INTO n_pa
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code = 'skill_alias:manage';
  IF n_pa <> 1 THEN
    RAISE EXCEPTION '000426: PLATFORM_ADMIN deve avere skill_alias:manage (esplicito, non dal blanket di 000005), trovato %', n_pa;
  END IF;

  -- G-D2: nessun ritiro in questa migrazione, la guardia resta vuota.
  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000426: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT count(*) INTO n_senza_cat FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000426: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000426: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000426: TAXONOMY_STEWARD creato con 7 permessi; skill_alias:manage esteso a HRMS_MANAGER e TENANT_ADMIN; G-D2 a zero; 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.';
END $$;

COMMIT;

-- FINE 000426
