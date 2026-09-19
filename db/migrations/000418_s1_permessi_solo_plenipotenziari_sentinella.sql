--
-- 000418 — S-1 (mandato K, F2): la sentinella dei permessi «solo-plenipotenziari».
--
-- PERCHE'. Oggi 102 permessi su 231 hanno come UNICI titolari i tre ruoli plenipotenziari
-- (PLATFORM_ADMIN, HRMS_MANAGER, TENANT_ADMIN): un potere che nessun ruolo ordinario puo' esercitare.
-- Non e' un difetto da correggere qui: e' lo STATO DI PARTENZA che la Fase 4 del mandato K deve far
-- scendere, un ruolo alla volta. Questa migrazione lo congela in una allowlist con ELENCO ESPLICITO
-- (mai un carattere jolly: regola 4 del metodo di bonifica) e crea la vista che mostra ogni permesso
-- solo-plenipotenziario NON presente nell'allowlist viva. La vista NASCE VERDE PER ALLOWLIST: non
-- migliora lo stato di oggi, impedisce di peggiorarlo e MISURA il miglioramento di F4, che ritira
-- righe dall'allowlist con `data_ritiro` (mai DELETE, ADR-0035).
--
-- Sentinella: `db_health.py` raccoglie ogni `sys.v_*` e pretende zero righe. Se un giorno la vista
-- ha una riga, e' nato un permesso che solo i plenipotenziari possono usare senza che nessuno lo
-- abbia dichiarato.
--
-- Nota per R-1 passo 0: quando nascera' `revoked_at` su sys_auth_role_permissions, questa vista va
-- emendata per ignorare le righe ritirate (oggi la colonna non esiste: misurato in I-F).
--
-- Scritta da Claude Code CLI (S1103, 2026-09-15). Effetto per dove_siamo.py:
--   select 1 from pg_views where schemaname='sys' and viewname='v_permessi_solo_plenipotenziari'
--
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_permessi_plenipotenziari_ammessi (
  permission_code varchar(120) PRIMARY KEY,
  motivo          text        NOT NULL,
  data            date        NOT NULL DEFAULT current_date,
  data_ritiro     date,
  ritirato_da     varchar(60)
);
COMMENT ON TABLE sys.sys_permessi_plenipotenziari_ammessi IS
  '000418 (mandato K, S-1) — allowlist dei permessi il cui unico titolare e'' fra PLATFORM_ADMIN/HRMS_MANAGER/TENANT_ADMIN. Si RITIRA con data_ritiro (F4), mai DELETE.';

INSERT INTO sys.sys_permessi_plenipotenziari_ammessi (permission_code, motivo, data)
SELECT v.code, 'stato di partenza 2026-09, da ridurre con F4 (mandato K)', DATE '2026-09-15'
  FROM (VALUES
  ('assessment:update'),
  ('auth:revoke_user'),
  ('auth:sessions_read'),
  ('brownfield_adaptation:approve'),
  ('brownfield_adaptation:read'),
  ('brownfield_adaptation:trigger'),
  ('capability:admin'),
  ('career_succession:create'),
  ('career_succession:delete'),
  ('career_succession:update'),
  ('compensation_intelligence:update'),
  ('content:create'),
  ('content:delete'),
  ('content:publish'),
  ('content:update'),
  ('dashboard_hr:view'),
  ('dashboard_platform:view'),
  ('dashboard_tenant:view'),
  ('delegation:manage'),
  ('delegation:read'),
  ('engagement_feedback:create'),
  ('engagement_feedback:delete'),
  ('engagement_feedback:update'),
  ('gap_analysis:create'),
  ('gap_analysis:delete'),
  ('gap_analysis:update'),
  ('gdpr:erase'),
  ('gdpr:export'),
  ('gdpr:read'),
  ('gdpr:retention'),
  ('goal:create'),
  ('goal:delete'),
  ('goal:update'),
  ('insights:admin'),
  ('job-requisition:manage'),
  ('job-requisition:read'),
  ('job_family:create'),
  ('job_family:delete'),
  ('job_family:update'),
  ('job_role:create'),
  ('job_role:update'),
  ('kpi:create'),
  ('kpi:delete'),
  ('leads:read'),
  ('leads:update'),
  ('learning:create'),
  ('learning:delete'),
  ('learning:update'),
  ('matching:admin'),
  ('mentorship:create'),
  ('mentorship:delete'),
  ('mentorship:update'),
  ('mfa_policy:manage'),
  ('mfa_policy:read'),
  ('notification:create'),
  ('observability:read'),
  ('occupation_classification:create'),
  ('occupation_classification:delete'),
  ('occupation_classification:update'),
  ('okr:create'),
  ('okr:delete'),
  ('okr:update'),
  ('organization_unit:create'),
  ('organization_unit:delete'),
  ('organization_unit_processes:create'),
  ('organization_unit_processes:delete'),
  ('position:create'),
  ('position:delete'),
  ('provenance:read'),
  ('reference_sync:read'),
  ('reference_sync:trigger'),
  ('role:assign'),
  ('role:create'),
  ('role:update'),
  ('role_matrix:read'),
  ('seed_acquisition:approve'),
  ('seed_acquisition:delete'),
  ('seed_acquisition:read'),
  ('seed_acquisition:trigger'),
  ('skill:create'),
  ('skill:delete'),
  ('skill:update'),
  ('skill_taxonomy:create'),
  ('skill_taxonomy:delete'),
  ('skill_taxonomy:update'),
  ('surveys:create'),
  ('surveys:delete'),
  ('surveys:update'),
  ('team:manage'),
  ('tenant:create'),
  ('tenant:delete'),
  ('tenant:list'),
  ('tenant:update'),
  ('tenant_blueprint:approve'),
  ('tenant_blueprint:read'),
  ('tenant_blueprint:write'),
  ('tenant_materialization:execute'),
  ('training_initiative:create'),
  ('training_initiative:update'),
  ('user:create'),
  ('user:delete'),
  ('user_position_assignment:delete')
  ) AS v(code)
ON CONFLICT (permission_code) DO NOTHING;

-- [mandato K, R-0] platform_tenant_assignment:manage (mig 000421) e' nato DOPO questo elenco,
-- ma la vista sotto rivede l'intero schema corrente: stessa ragione gia' scritta per 000062 e
-- 000304. A differenza delle 102 righe sopra (stato di partenza da RIDURRE con F4), questo
-- permesso e' solo-plenipotenziario PER DECISIONE (D9=B): nessun altro ruolo deve mai
-- assegnare clienti a un utente di piattaforma. Non e' un debito, e' la regola.
INSERT INTO sys.sys_permessi_plenipotenziari_ammessi (permission_code, motivo, data)
VALUES ('platform_tenant_assignment:manage',
        'D9=B (mandato K, R-0): solo PLATFORM_ADMIN assegna clienti a un ruolo di piattaforma. Non e'' uno stato di partenza da ridurre, e'' la regola stessa.',
        DATE '2026-09-16')
ON CONFLICT (permission_code) DO NOTHING;

-- [mandato K, R-10, mig 000427] job-requisition:read/:manage (gia' in allowlist sopra) sono
-- stati spezzati in sei permessi di dominio: requisition:read/:manage, candidate:read/:write,
-- interview:feedback, offer:manage. Sono FIGLI diretti dello stato di partenza del 2026-09-15
-- (stessa audience, stesso motivo), non un potere nuovo: la loro riduzione arriva con R-4/R-6/
-- R-8/R-11 quando RECRUITER/HIRING_MANAGER/PEOPLE_MANAGER nascono e ricevono i permessi giusti.
INSERT INTO sys.sys_permessi_plenipotenziari_ammessi (permission_code, motivo, data)
SELECT v.code, 'figlio di job-requisition:read/:manage (stato di partenza 2026-09-15), spezzato da R-10 (mandato K) — da ridurre con R-4/R-6/R-8/R-11', DATE '2026-09-19'
  FROM (VALUES
  ('requisition:read'),
  ('requisition:manage'),
  ('candidate:read'),
  ('candidate:write'),
  ('interview:feedback'),
  ('offer:manage')
  ) AS v(code)
ON CONFLICT (permission_code) DO NOTHING;

CREATE OR REPLACE VIEW sys.v_permessi_solo_plenipotenziari AS
WITH titolari AS (
  SELECT p.auth_permission_code AS permission_code,
         array_agg(DISTINCT r.auth_role_code::text ORDER BY r.auth_role_code::text) AS ruoli
    FROM sys.sys_auth_permissions p
    JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = p.auth_permission_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   GROUP BY 1
)
SELECT t.permission_code, t.ruoli
  FROM titolari t
 WHERE t.ruoli <@ ARRAY['PLATFORM_ADMIN','HRMS_MANAGER','TENANT_ADMIN']::text[]
   AND NOT EXISTS (SELECT 1 FROM sys.sys_permessi_plenipotenziari_ammessi a
                    WHERE a.permission_code = t.permission_code AND a.data_ritiro IS NULL);
COMMENT ON VIEW sys.v_permessi_solo_plenipotenziari IS
  '000418 (mandato K, S-1) — permessi il cui unico titolare e'' fra i tre plenipotenziari e che NON sono nell''allowlist viva. Nasce VERDE PER ALLOWLIST (102 righe congelate il 2026-09-15): misura il miglioramento di F4, non lo stato di oggi. Zero righe attese.';

-- Post-condizione: allowlist con almeno le 102 righe, vista a zero righe.
DO $$
DECLARE n_allow int; n_vista int;
BEGIN
  SELECT count(*) INTO n_allow FROM sys.sys_permessi_plenipotenziari_ammessi WHERE data_ritiro IS NULL;
  SELECT count(*) INTO n_vista FROM sys.v_permessi_solo_plenipotenziari;
  IF n_allow < 108 THEN RAISE EXCEPTION '000418: allowlist con % righe vive, attese almeno 108', n_allow; END IF;
  IF n_vista <> 0 THEN RAISE EXCEPTION '000418: la vista nasce con % righe, attese 0 (allowlist incompleta)', n_vista; END IF;
END $$;

COMMIT;
-- FINE 000418
