-- 000428 — Mandato K, R-4: RECRUITER e HIRING_MANAGER (passo 50, D8=A).
--
-- IL PERCHE'. R-10 (000427) ha spezzato job-requisition:read/:manage in sei permessi di
-- dominio proprio per questo: RECRUITER conduce l'intero ciclo, HIRING_MANAGER legge le
-- richieste e i candidati e da' il feedback dei colloqui, MAI le offerte. Con un solo
-- permesso per tutto il ciclo (lo stato prima di R-10) i due ruoli non si potevano
-- distinguere. Nessuno dei due esiste ancora: misurato prima di scrivere questo file
-- (`select 1 from sys.sys_auth_roles where auth_role_code in ('RECRUITER','HIRING_MANAGER')`
-- -> 0 righe).
--
-- RECRUITER — tutti e sei i permessi granulari (mandato, passo 50), perimetro TENANT
-- (RECRUITING_TENANT_WIDE_ROLES in apps/api/src/lib/scope/recruiting.ts): vede ogni
-- richiesta/candidato/colloquio/offerta del proprio tenant, come i plenipotenziari.
--
-- HIRING_MANAGER — requisition:read, candidate:read, interview:feedback. NIENTE
-- requisition:manage, candidate:write, offer:manage (il mandato lo dice esplicito: "NIENTE
-- offer:manage"). Perimetro = sotto-albero organizzativo via `position_organization_unit_id`
-- (apps/api/src/lib/scope/recruiting.ts, resolveRecruitingOrgScope): il segnale e'
-- `isOrgUnitManager` (I16/#99 F3, lo stesso segnale primario del resolver organizzativo
-- generico), NON l'aggiunta letterale di HIRING_MANAGER a `MANAGERIAL_ROLES` in
-- resolver.ts — farlo aprirebbe anche il resolver dei dati SENSIBILI (PERSONAL/
-- COMPENSATION/SKILL/EVALUATION, I18/I20) al sotto-albero di HIRING_MANAGER, un mandato
-- che il passo 50 non concede. Deviazione dichiarata dalla lettera ("via MANAGERIAL_ROLES"),
-- fedele allo spirito (stesso meccanismo organizzativo, perimetro isolato al recruiting).
--
-- NESSUN RITIRO. Due ruoli nuovi, nessuna riga esistente tocca. G-D2 resta vuota.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='RECRUITER' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. I due ruoli.
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('RECRUITER', 'Recruiter',
   'Conduce l''intero ciclo del recruiting: richieste di personale, annunci, candidati, colloqui, offerte (tutti e sei i permessi granulari di R-10), perimetro tenant. Nato mandato K, R-4, 2026-09-19.',
   false, 'functional'),
  ('HIRING_MANAGER', 'Hiring Manager',
   'Legge le richieste di personale e i candidati e da'' il feedback dei colloqui SOLO nel proprio sotto-albero organizzativo; mai le offerte. Nato mandato K, R-4, 2026-09-19 (D8=A).',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. RECRUITER: tutti e sei i permessi di R-10.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'RECRUITER'
   AND p.auth_permission_code IN (
     'requisition:read', 'requisition:manage',
     'candidate:read', 'candidate:write',
     'interview:feedback', 'offer:manage'
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. HIRING_MANAGER: SOLO i tre permessi di lettura/feedback (mandato, passo 50 —
--    "NIENTE offer:manage").
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'HIRING_MANAGER'
   AND p.auth_permission_code IN ('requisition:read', 'candidate:read', 'interview:feedback')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. Self-healing: nessun altro permesso finisce su questi due ruoli (nessun blanket li
--    tocca, ma la catena si riapplica per intero: una riga in piu' qui la toglierebbe
--    subito, non fra un anno).
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'RECRUITER'
   AND p.auth_permission_code NOT IN (
     'requisition:read', 'requisition:manage',
     'candidate:read', 'candidate:write',
     'interview:feedback', 'offer:manage'
   );

DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_roles r, sys.sys_auth_permissions p
 WHERE rp.auth_role_id = r.auth_role_id
   AND rp.auth_permission_id = p.auth_permission_id
   AND r.auth_role_code = 'HIRING_MANAGER'
   AND p.auth_permission_code NOT IN ('requisition:read', 'candidate:read', 'interview:feedback');

-- 5. Le traduzioni inglesi (guardia 000255: copertura EN totale, nome E descrizione).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('RECRUITER', 'name', 'Recruiter'),
    ('RECRUITER', 'description',
     'Conducts the whole recruiting cycle: requisitions, postings, candidates, interviews, offers (all six R-10 permissions), tenant-wide perimeter. Born mandato K, R-4, 2026-09-19.'),
    ('HIRING_MANAGER', 'name', 'Hiring Manager'),
    ('HIRING_MANAGER', 'description',
     'Reads job requisitions and candidates and gives interview feedback, ONLY within their own org sub-tree; never offers. Born mandato K, R-4, 2026-09-19 (D8=A).')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

-- 6. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_recruiter int; n_hm int; n_hm_vietati int; n_gap int;
BEGIN
  SELECT count(*) INTO n_recruiter
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'RECRUITER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'requisition:read', 'requisition:manage',
       'candidate:read', 'candidate:write',
       'interview:feedback', 'offer:manage'
     );
  IF n_recruiter <> 6 THEN
    RAISE EXCEPTION '000428: RECRUITER deve avere 6 permessi, ne ha %', n_recruiter;
  END IF;

  SELECT count(*) INTO n_hm
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HIRING_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('requisition:read', 'candidate:read', 'interview:feedback');
  IF n_hm <> 3 THEN
    RAISE EXCEPTION '000428: HIRING_MANAGER deve avere 3 permessi, ne ha %', n_hm;
  END IF;

  -- Il mandato lo dice esplicito: "NIENTE offer:manage" (ne' requisition:manage, ne'
  -- candidate:write). Guardia positiva sull'assenza, non solo sul conteggio.
  SELECT count(*) INTO n_hm_vietati
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HIRING_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('requisition:manage', 'candidate:write', 'offer:manage');
  IF n_hm_vietati <> 0 THEN
    RAISE EXCEPTION '000428: HIRING_MANAGER non deve avere requisition:manage/candidate:write/offer:manage, ne ha %', n_hm_vietati;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000428: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT coalesce(sum(missing), 0) INTO n_gap FROM sys.v_reference_translation_coverage;
  IF n_gap <> 0 THEN
    RAISE EXCEPTION '000428: copertura EN globale non a zero dopo questa migrazione (guardia 000255), % mancanti', n_gap;
  END IF;

  RAISE NOTICE '000428: RECRUITER (6 permessi) e HIRING_MANAGER (3 permessi, niente offer:manage/requisition:manage/candidate:write) creati; G-D2 a zero; copertura EN completa.';
END $$;

COMMIT;

-- FINE 000428
