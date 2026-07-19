-- ============================================================================
-- 000177_dedicated_delete_permissions.sql — #61 G/G2: la matrice RBAC torna onesta.
--
-- PROBLEMA: 32 DELETE di moduli standalone giravano sotto il permesso :update (o
--   :override/:trigger/:update_layout) della loro area. La matrice role×permission
--   — che /admin/roles mostra come SoT dei privilegi — non diceva quindi da
--   nessuna parte CHI puo' cancellare: un ruolo con "update" ereditava
--   implicitamente il diritto di distruggere.
--
-- PRINCIPIO DI QUESTA MIGRAZIONE: rendere la matrice ESPLICITA senza spostare di
--   un millimetro i privilegi effettivi. Ogni nuovo `<area>:delete` viene
--   concesso ESATTAMENTE ai ruoli che gia' detengono il permesso sotto cui la
--   route girava — derivato dalla tabella dei grant, non da una lista di ruoli
--   riscritta a mano (che duplicherebbe una SoT e driftera').
--   Chi poteva cancellare, continua a poterlo fare. Chi non poteva, no.
--
-- FUORI SCOPO (verificato route per route, non assunto):
--   - positions `/:id/skills/:skillId` e `/:id/kpis/:kpiId` restano su
--     position:update. NON cancellano un'entita': rimuovono un requisito DA una
--     posizione, cioe' modificano l'insieme dei requisiti. Sono nested sotto il
--     padre e non hanno un modulo proprio. Per di piu' position:delete e' piu'
--     RISTRETTO di position:update (niente MANAGER): spostarle avrebbe tolto un
--     privilegio ai manager. La linea G2 le contava fra le violazioni: non lo sono.
--   - users DELETE grant → role:assign (revoca di un ruolo, semantica corretta).
--   - me `/security/sessions/:familyId` → me:sessions:manage (self-scope, I17).
--
-- Nota su blueprint: le 4 route sotto blueprint:override e quella sotto
--   blueprint:activate confluiscono in un unico blueprint:delete perche' i due
--   permessi hanno audience IDENTICA (verificato: BLUEPRINT_MANAGER,
--   PLATFORM_ADMIN, TENANT_ADMIN) — l'unificazione non allarga nulla.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING su entrambe le insert.
-- Authored: 2026-07-19.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('enterprise_typing:delete', 'Delete enterprise-typing reference data', 'enterprise_typing', 'delete'),
  ('blueprint:delete',         'Delete blueprint catalogue entities',     'blueprint',         'delete'),
  ('career_succession:delete', 'Delete career & succession entities',     'career_succession', 'delete'),
  ('skill:delete',             'Delete skill taxonomy entities',          'skill',             'delete'),
  ('seed_acquisition:delete',  'Delete seed acquisition runs',            'seed_acquisition',  'delete'),
  ('bpm_process:delete',       'Delete BPM process templates',            'bpm_process',       'delete'),
  ('gap_analysis:delete',      'Delete learning gaps',                    'gap_analysis',      'delete'),
  ('visualization:delete',     'Delete visualization entities',           'visualization',     'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Grant each new permission to exactly the audience of the permission the route
-- used to run under. Derived from sys_auth_role_permissions itself, so the
-- audiences cannot drift from reality.
WITH mapping(new_code, source_code) AS (
  VALUES
    ('enterprise_typing:delete', 'enterprise_typing:update'),
    ('blueprint:delete',         'blueprint:override'),
    ('career_succession:delete', 'career_succession:update'),
    ('skill:delete',             'skill:update'),
    ('seed_acquisition:delete',  'seed_acquisition:trigger'),
    ('bpm_process:delete',       'bpm_process:update'),
    ('gap_analysis:delete',      'gap_analysis:update'),
    ('visualization:delete',     'visualization:update_layout')
)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT rp.auth_role_id, np.auth_permission_id
  FROM mapping m
  JOIN sys.sys_auth_permissions sp ON sp.auth_permission_code = m.source_code
  JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = sp.auth_permission_id
  JOIN sys.sys_auth_permissions np ON np.auth_permission_code = m.new_code
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN (
     'enterprise_typing:delete','blueprint:delete','career_succession:delete','skill:delete',
     'seed_acquisition:delete','bpm_process:delete','gap_analysis:delete','visualization:delete');
  RAISE NOTICE '000177: % dedicated :delete permissions present, grants mirrored from source permissions.', n;
END $$;
