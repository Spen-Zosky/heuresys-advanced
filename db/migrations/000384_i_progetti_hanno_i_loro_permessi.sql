-- ─────────────────────────────────────────────────────────────────────────────
-- 000384 — `#143` F4: i progetti hanno i loro permessi
--
-- La `000363` (F2) ha creato `sys_projects` e `sys_project_members` e vi ha portato
-- 26 progetti e 174 appartenenze. Da allora quei dati **non erano raggiungibili da
-- nessuna API**: misurato il 2026-09-09 con `chi_sorveglia.py sys_projects` —
-- nessun modulo, nessun test, nessuna sentinella, nessun cancello. Solo la
-- migrazione che li crea.
--
-- E' esattamente il caso del **cancello di esposizione** (`#79`): un dato che
-- nessuna API espone non e' nel prodotto. F4 costruisce il modulo; questa
-- migrazione gli da' i tre permessi che le sue rotte pretendono.
--
-- ── CHI LI RICEVE, E PERCHE' NON E' LA STESSA AUDIENCE DI `team:manage` ──────
-- `project:list` / `project:read` vanno a **tutti i ruoli che gia' leggono le
-- squadre**: un progetto e' il lavoro, e chi vede la squadra vede il lavoro. Lo
-- SCOPE resta al service — l'asse funzionale decide *quali* progetti, non questo
-- grant — quindi un permesso di lettura largo non allarga cio' che si vede: chi
-- non ha un mandato vede i soli progetti a cui partecipa.
--
-- `project:manage` va ai tre mandati (PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER)
-- **piu'** ai ruoli manageriali e di squadra, e qui la differenza con `team:manage`
-- e' voluta: un capo progetto deve poter dichiarare l'avanzamento del proprio
-- progetto senza chiamare l'amministratore. Il permesso dice *se*; il service
-- controlla che lo guidi davvero e nega con `PERMISSION_DENIED` altrimenti.
--
-- ⚠ CIO' CHE QUESTI PERMESSI **NON** APRONO — ed e' il confine I18, non una
-- omissione: guidare un progetto non da' accesso ai dati sensibili dei membri.
-- Retribuzione, valutazioni, dati personali e competenze restano alla catena
-- organizzativa. Il modulo espone di ogni membro nome, email, ruolo e finestra:
-- nient'altro passa da li'.
--
-- IDEMPOTENTE + twice-run safe.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('project:list',   'Elenco dei progetti visibili',                              'project', 'list'),
  ('project:read',   'Dettaglio di un progetto e dei suoi membri',                'project', 'read'),
  ('project:manage', 'Gestione del ciclo di vita di un progetto (creazione, modifica, avanzamento, membri)', 'project', 'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Overlay EN dei nomi (ADR-0029; idempotente)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', t.testo, 'MANUAL'
  FROM (VALUES
    ('project:list',   'List the projects you can see'),
    ('project:read',   'Read a project and its members'),
    ('project:manage', 'Manage a project lifecycle (create, update, progress, members)')
  ) AS t(codice, testo)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = t.codice
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- Estensione allowlist TENANT_ADMIN (la guardia rbac-tenant-admin-allowlist
-- parsa le righe VALUES a colonna singola dopo questo marker):
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000384(code text PRIMARY KEY);
INSERT INTO _ta_extend_000384(code) VALUES
    ('project:list'),
    ('project:read'),
    ('project:manage');

-- ── letture: la stessa audience che gia' legge le squadre ────────────────────
-- Si deriva da `team:list` invece di riscrivere un elenco di ruoli: due elenchi
-- scritti a mano sullo stesso fatto divergono, ed e' la lezione che `#99` F3 ha
-- gia' pagato una volta su questo stesso modulo.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_permissions tp ON tp.auth_permission_id = rp.auth_permission_id
                                  AND tp.auth_permission_code = 'team:list'
  CROSS JOIN sys.sys_auth_permissions np
 WHERE np.auth_permission_code IN ('project:list', 'project:read')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- ── gestione: i tre mandati, piu' chi puo' guidare un progetto ───────────────
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'project:manage'
 WHERE r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER',
                            'MANAGER', 'TEAM_LEADER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Self-healing: nessun altro ruolo trattiene `project:manage` (la 000005 blanket
-- e le sue eredi lo rimetterebbero a tutti a ogni riapplicazione della catena).
DELETE FROM sys.sys_auth_role_permissions rp
 USING sys.sys_auth_permissions p, sys.sys_auth_roles r
 WHERE p.auth_permission_code = 'project:manage'
   AND rp.auth_permission_id = p.auth_permission_id
   AND rp.auth_role_id = r.auth_role_id
   AND r.auth_role_code NOT IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'HRMS_MANAGER',
                                'MANAGER', 'TEAM_LEADER');

-- ── post-condizione: i permessi esistono e qualcuno li ha ────────────────────
DO $$
DECLARE v_perm int; v_grant int;
BEGIN
  SELECT count(*) INTO v_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('project:list','project:read','project:manage');
  IF v_perm <> 3 THEN
    RAISE EXCEPTION '000384: attesi 3 permessi project:*, trovati %', v_perm;
  END IF;

  SELECT count(*) INTO v_grant
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'project:manage';
  IF v_grant < 3 THEN
    RAISE EXCEPTION '000384: project:manage concesso a % ruoli, attesi almeno i 3 mandati', v_grant;
  END IF;
  RAISE NOTICE '000384 OK: 3 permessi, project:manage a % ruoli', v_grant;
END $$;
