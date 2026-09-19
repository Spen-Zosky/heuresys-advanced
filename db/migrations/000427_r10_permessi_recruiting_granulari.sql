-- 000427 — Mandato K, R-10: sei permessi granulari per il recruiting (passo 49).
--
-- IL PERCHE'. 7 moduli del recruiting (job-requisitions, job-postings, candidates,
-- candidate-applications, interviews, interview-feedback, job-offers — 28 rotte, 4
-- ciascuno) condividono OGGI lo stesso permesso `job-requisition:read`/`:manage`
-- (mig. 000374, doctrine 000212: "due permessi, non quattro" — un solo verbo per
-- l'intero ciclo). Il commento in testa a `candidates/routes.ts` e agli altri 5
-- moduli a valle lo dichiara esplicito: "il recruiting e' un ciclo solo... separarli
-- dopo e' additivo". R-10 e' quel "dopo": R-4 (RECRUITER/HIRING_MANAGER, la voce
-- successiva) ha bisogno di dare a HIRING_MANAGER lettura+feedback sui colloqui
-- senza dargli anche la gestione delle offerte — impossibile con un solo permesso
-- che copre tutto.
--
-- MAPPATURA (esiti/R-10_rotte.md, scritta PRIMA di questa migrazione, misurata sulla
-- tabella `sys.*` di ciascun repository):
--   job-requisitions + job-postings      -> requisition:read / requisition:manage
--   candidates + candidate-applications  -> candidate:read / candidate:write
--   interviews + interview-feedback      -> interview:feedback (lettura E scrittura:
--     il mandato elenca sei permessi, non otto — nessun verbo :read separato per
--     questo dominio, deviazione dichiarata qui)
--   job-offers                            -> offer:manage (lettura E scrittura, stessa
--     ragione)
--
-- NESSUN RITIRO. `job-requisition:read` e `job-requisition:manage` NON si cancellano
-- e NON perdono grant (ADR-0035, "ritirare non e' cancellare" — qui non ritiriamo
-- nemmeno, li lasciamo vivi ma superati): solo la loro `description` si aggiorna per
-- dire che sono superati. G-D2 resta vuota: nessuna riga di sys_auth_role_permissions
-- viene marcata revoked_at da questa migrazione.
--
-- AUDIENCE: PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER — stessa allowlist di 000374
-- (i tre plenipotenziari che hanno gia' job-requisition:read/manage, misurato sul
-- vivo prima di scrivere questo file). Nessun ruolo di recruiting esiste ancora
-- (nasce in R-4, la voce successiva): self-healing DELETE per chiunque altro.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_permissions where auth_permission_code='requisition:manage'
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. I sei permessi nuovi.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('requisition:read', 'Read job requisitions',
   'requisition', 'read',
   'Lettura delle richieste di personale e degli annunci pubblicati (job-requisitions, job-postings). Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:read.'),
  ('requisition:manage', 'Manage job requisitions',
   'requisition', 'manage',
   'Gestione delle richieste di personale e degli annunci pubblicati (job-requisitions, job-postings). Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:manage.'),
  ('candidate:read', 'Read candidates',
   'candidate', 'read',
   'Lettura dei candidati e delle loro candidature (candidates, candidate-applications). Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:read.'),
  ('candidate:write', 'Write candidates',
   'candidate', 'write',
   'Scrittura dei candidati e delle loro candidature (candidates, candidate-applications). Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:manage.'),
  ('interview:feedback', 'Manage interviews and feedback',
   'interview', 'feedback',
   'Lettura e scrittura dei colloqui e dei relativi giudizi (interviews, interview-feedback): un solo verbo per l''intero dominio, come dichiarato dal mandato. Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:read/:manage.'),
  ('offer:manage', 'Manage job offers',
   'offer', 'manage',
   'Lettura e scrittura delle offerte di lavoro (job-offers): un solo verbo per l''intero dominio, come dichiarato dal mandato. Nato mandato K, R-10, 2026-09-19, spezzando job-requisition:read/:manage.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 2. job-requisition:read/:manage restano vivi e concessi, solo "superati" nel testo.
UPDATE sys.sys_auth_permissions
   SET auth_permission_description = 'SUPERATO da requisition:read, candidate:read, interview:feedback (mandato K, R-10, 2026-09-19): il permesso resta concesso ai plenipotenziari per compatibilita'', nessuna rotta lo controlla piu''.'
 WHERE auth_permission_code = 'job-requisition:read';

UPDATE sys.sys_auth_permissions
   SET auth_permission_description = 'SUPERATO da requisition:manage, candidate:write, interview:feedback, offer:manage (mandato K, R-10, 2026-09-19): il permesso resta concesso ai plenipotenziari per compatibilita'', nessuna rotta lo controlla piu''.'
 WHERE auth_permission_code = 'job-requisition:manage';

-- 3. Estensione allowlist TENANT_ADMIN (D-57, guardia rbac-tenant-admin-allowlist).
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000427(code text PRIMARY KEY);
INSERT INTO _ta_extend_000427(code) VALUES
    ('requisition:read'),
    ('requisition:manage'),
    ('candidate:read'),
    ('candidate:write'),
    ('interview:feedback'),
    ('offer:manage');

-- 4. Grant esplicito ai tre plenipotenziari (stessa audience di 000374).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p
    ON p.auth_permission_code IN (
      'requisition:read', 'requisition:manage',
      'candidate:read', 'candidate:write',
      'interview:feedback', 'offer:manage'
    )
 WHERE r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 5. Self-healing: nessun altro ruolo trattiene questi sei (nessun ruolo di
--    recruiting esiste ancora: nasce in R-4).
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions p, sys.sys_auth_roles r
 WHERE p.auth_permission_code IN (
         'requisition:read', 'requisition:manage',
         'candidate:read', 'candidate:write',
         'interview:feedback', 'offer:manage'
       )
   AND rp.auth_permission_id = p.auth_permission_id
   AND rp.auth_role_id = r.auth_role_id
   AND r.auth_role_code NOT IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER');

DROP TABLE _ta_extend_000427;

-- 6. Traduzioni EN (guardia 000255: copertura EN totale su sys_auth_permissions,
--    nome E descrizione).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('requisition:read', 'name', 'Read job requisitions'),
    ('requisition:read', 'description',
     'Read job requisitions and published job postings. Born mandato K, R-10, 2026-09-19, split from job-requisition:read.'),
    ('requisition:manage', 'name', 'Manage job requisitions'),
    ('requisition:manage', 'description',
     'Manage job requisitions and published job postings. Born mandato K, R-10, 2026-09-19, split from job-requisition:manage.'),
    ('candidate:read', 'name', 'Read candidates'),
    ('candidate:read', 'description',
     'Read candidates and their applications. Born mandato K, R-10, 2026-09-19, split from job-requisition:read.'),
    ('candidate:write', 'name', 'Write candidates'),
    ('candidate:write', 'description',
     'Write candidates and their applications. Born mandato K, R-10, 2026-09-19, split from job-requisition:manage.'),
    ('interview:feedback', 'name', 'Manage interviews and feedback'),
    ('interview:feedback', 'description',
     'Read and write interviews and their feedback: a single verb for the whole domain, as the mandate declares. Born mandato K, R-10, 2026-09-19, split from job-requisition:read/:manage.'),
    ('offer:manage', 'name', 'Manage job offers'),
    ('offer:manage', 'description',
     'Read and write job offers: a single verb for the whole domain, as the mandate declares. Born mandato K, R-10, 2026-09-19, split from job-requisition:read/:manage.')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'LLM', updated_at = now();

-- INSERT (non UPDATE): job-requisition:read/:manage non avevano MAI avuto una
-- description italiana prima di questa migrazione, quindi nessuna riga di
-- traduzione EN per 'description' esisteva ancora da aggiornare (misurato: una
-- UPDATE qui, alla prima stesura, dava "UPDATE 0" e lasciava un gap di copertura
-- rilevato dalla guardia della 000255 alla riapplicazione della catena).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', auth_permission_id, 'description', 'en',
       'SUPERSEDED by requisition:read, candidate:read, interview:feedback (mandato K, R-10, 2026-09-19): still granted to plenipotentiaries, no route checks it anymore.',
       'LLM'
  FROM sys.sys_auth_permissions WHERE auth_permission_code = 'job-requisition:read'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'LLM', updated_at = now();

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', auth_permission_id, 'description', 'en',
       'SUPERSEDED by requisition:manage, candidate:write, interview:feedback, offer:manage (mandato K, R-10, 2026-09-19): still granted to plenipotentiaries, no route checks it anymore.',
       'LLM'
  FROM sys.sys_auth_permissions WHERE auth_permission_code = 'job-requisition:manage'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'LLM', updated_at = now();

-- 7. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_nuovi int; n_grant int; n_en int;
  n_vecchi_grant int;
BEGIN
  SELECT count(*) INTO n_nuovi FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN (
     'requisition:read', 'requisition:manage',
     'candidate:read', 'candidate:write',
     'interview:feedback', 'offer:manage'
   );
  IF n_nuovi <> 6 THEN
    RAISE EXCEPTION '000427: attesi 6 permessi nuovi, trovati %', n_nuovi;
  END IF;

  SELECT count(*) INTO n_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN (
           'requisition:read', 'requisition:manage',
           'candidate:read', 'candidate:write',
           'interview:feedback', 'offer:manage'
         )
     AND rp.revoked_at IS NULL;
  IF n_grant <> 18 THEN
    RAISE EXCEPTION '000427: attese 18 concessioni (6 permessi x 3 plenipotenziari), trovate %', n_grant;
  END IF;

  -- job-requisition:read/:manage restano intatti: ancora 6 concessioni (2 x 3), G-D2 vuota.
  SELECT count(*) INTO n_vecchi_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('job-requisition:read', 'job-requisition:manage')
     AND rp.revoked_at IS NULL;
  IF n_vecchi_grant <> 6 THEN
    RAISE EXCEPTION '000427: job-requisition:read/:manage devono restare a 6 concessioni (nessun ritiro), trovate %', n_vecchi_grant;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000427: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT count(*) INTO n_en
    FROM sys.sys_reference_translations t
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = t.entity_id
   WHERE p.auth_permission_code IN (
           'requisition:read', 'requisition:manage',
           'candidate:read', 'candidate:write',
           'interview:feedback', 'offer:manage'
         )
     AND t.entity_table = 'sys_auth_permissions' AND t.locale = 'en'
     AND t.field IN ('name', 'description');
  IF n_en <> 12 THEN
    RAISE EXCEPTION '000427: attesi 12 overlay EN (6 permessi x name+description), trovati %', n_en;
  END IF;

  IF (SELECT coalesce(sum(missing), 0) FROM sys.v_reference_translation_coverage) <> 0 THEN
    RAISE EXCEPTION '000427: copertura EN globale non a zero dopo questa migrazione (guardia 000255)';
  END IF;

  RAISE NOTICE '000427: 6 permessi granulari del recruiting creati e concessi a PLATFORM_ADMIN/TENANT_ADMIN/HRMS_MANAGER; job-requisition:read/:manage intatti e marcati superati; G-D2 a zero.';
END $$;

COMMIT;

-- FINE 000427
