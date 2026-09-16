--
-- 000420 — R-1 passo 0 (mandato K, F4): le colonne per ritirare un permesso o un ruolo.
--
-- PERCHE'. I-F ha misurato che nessuna colonna di ritiro esiste su sys_auth_role_permissions
-- ne' su sys_auth_roles: requirePermission non legge il database (carica una mappa in cache
-- all'avvio, apps/api/src/modules/auth/cache-loader.ts), quindi un ritiro senza filtro nel
-- caricatore e senza riavvio del server non avrebbe alcun effetto. Questa migrazione aggiunge
-- le due colonne, la guardia meccanica G-D2 (vista + allowlist) che difende l'unica eccezione
-- decisa da Enzo (D2=A: HRMS_MANAGER resta plenipotenziario; D3=A: tranne gdpr:erase, per R-2),
-- ed emenda 000418 (nota lasciata li' il 2026-09-15) perche' la sua vista ignori le righe ora
-- ritirabili.
--
-- Effetto per dove_siamo.py:
--   select 1 from information_schema.columns where table_schema='sys'
--     and table_name='sys_auth_role_permissions' and column_name='revoked_at'
--
BEGIN;

ALTER TABLE sys.sys_auth_role_permissions
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS revoked_by_migration text NULL;
COMMENT ON COLUMN sys.sys_auth_role_permissions.revoked_at IS
  '000420 (mandato K, R-1) — ritirare non e'' cancellare (ADR-0035): NULL = concesso, non-NULL = ritirato. Il file che ha ritirato va in revoked_by_migration. auth/cache-loader.ts filtra su questa colonna.';

ALTER TABLE sys.sys_auth_roles
  ADD COLUMN IF NOT EXISTS retired_at timestamptz NULL;
COMMENT ON COLUMN sys.sys_auth_roles.retired_at IS
  '000420 (mandato K, R-1) — un ruolo ritirato resta come riga (storia, ADR-0035); auth/cache-loader.ts lo esclude dalla cache dal momento del ritiro.';

-- G-D2: l'unica eccezione ammessa a D2 (HRMS_MANAGER resta plenipotenziario) e' quella
-- decisa da Enzo con D3 (gdpr:erase a HRMS_MANAGER, per R-2). Una sola riga oggi; ogni riga
-- in piu' sarebbe una seconda eccezione, che la CLI non decide da sola (mandato sezione 2).
CREATE TABLE IF NOT EXISTS sys.sys_ritiri_ammessi (
  role_code       varchar(60)  NOT NULL,
  permission_code varchar(120) NOT NULL,
  voce            varchar(20)  NOT NULL,
  PRIMARY KEY (role_code, permission_code)
);
COMMENT ON TABLE sys.sys_ritiri_ammessi IS
  '000420 (mandato K, R-1, guardia G-D2) — l''unica eccezione ammessa a D2 (HRMS_MANAGER resta plenipotenziario): un ritiro di permesso a uno dei 14 ruoli preesistenti al mandato K deve avere una riga qui, o la vista v_permessi_ritirati_a_ruoli_preesistenti si accende.';

INSERT INTO sys.sys_ritiri_ammessi (role_code, permission_code, voce)
VALUES ('HRMS_MANAGER', 'gdpr:erase', 'R-2')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- I 14 ruoli che esistevano ALLA CHIUSURA di F0.3 (baseline del mandato K, misurata
-- 2026-09-14): un elenco congelato, non "tutti i ruoli oggi" — i ruoli che F4 fara'
-- nascere non sono "preesistenti" e la guardia non li deve toccare.
CREATE OR REPLACE VIEW sys.v_permessi_ritirati_a_ruoli_preesistenti AS
SELECT r.auth_role_code AS role_code, p.auth_permission_code AS permission_code
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE rp.revoked_at IS NOT NULL
   AND r.auth_role_code IN (
     'PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER',
     'MANAGER','USER','READ_ONLY','CEO','TEAM_LEADER','TEAM_MEMBER','ORG_DIRECTOR',
     'WHISTLEBLOWING_CUSTODIAN','BRANCH_MANAGER'
   )
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_ritiri_ammessi ra
      WHERE ra.role_code = r.auth_role_code AND ra.permission_code = p.auth_permission_code
   );
COMMENT ON VIEW sys.v_permessi_ritirati_a_ruoli_preesistenti IS
  '000420 (mandato K, R-1, guardia G-D2) — ogni ritiro di permesso a un ruolo preesistente NON coperto da sys_ritiri_ammessi. Zero righe attese sempre; una riga qui e'' una seconda eccezione a D2, e la CLI si ferma invece di deciderla.';

-- Emenda 000418 (nota lasciata li' il 2026-09-15): la vista dei solo-plenipotenziari deve
-- ignorare le righe ritirate, altrimenti un permesso ritirato a HRMS_MANAGER (R-2) resterebbe
-- contato come suo per sempre.
CREATE OR REPLACE VIEW sys.v_permessi_solo_plenipotenziari AS
WITH titolari AS (
  SELECT p.auth_permission_code AS permission_code,
         array_agg(DISTINCT r.auth_role_code::text ORDER BY r.auth_role_code::text) AS ruoli
    FROM sys.sys_auth_permissions p
    JOIN sys.sys_auth_role_permissions rp ON rp.auth_permission_id = p.auth_permission_id AND rp.revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   GROUP BY 1
)
SELECT t.permission_code, t.ruoli
  FROM titolari t
 WHERE t.ruoli <@ ARRAY['PLATFORM_ADMIN','HRMS_MANAGER','TENANT_ADMIN']::text[]
   AND NOT EXISTS (SELECT 1 FROM sys.sys_permessi_plenipotenziari_ammessi a
                    WHERE a.permission_code = t.permission_code AND a.data_ritiro IS NULL);
COMMENT ON VIEW sys.v_permessi_solo_plenipotenziari IS
  '000418 (mandato K, S-1), emendata da 000420 (R-1): ignora le righe ritirate (rp.revoked_at IS NULL). Nasce VERDE PER ALLOWLIST: misura il miglioramento di F4, non lo stato di oggi. Zero righe attese.';

-- Post-condizione
DO $$
DECLARE n_col int; n_ritiri int; n_guardia int;
BEGIN
  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema='sys' AND table_name='sys_auth_role_permissions' AND column_name='revoked_at';
  IF n_col <> 1 THEN RAISE EXCEPTION '000420: colonna revoked_at non trovata'; END IF;

  SELECT count(*) INTO n_ritiri FROM sys.sys_ritiri_ammessi;
  IF n_ritiri <> 1 THEN RAISE EXCEPTION '000420: sys_ritiri_ammessi ha % righe, attesa 1', n_ritiri; END IF;

  SELECT count(*) INTO n_guardia FROM sys.v_permessi_ritirati_a_ruoli_preesistenti;
  IF n_guardia <> 0 THEN RAISE EXCEPTION '000420: guardia G-D2 nasce con % righe, attese 0', n_guardia; END IF;
END $$;

COMMIT;
-- FINE 000420
