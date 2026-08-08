-- =============================================================================
-- #70 — Key-roles coverage seed for tenant RTL_BANK (S1025, 2026-07-22)
-- Tenant: 86ba7a65-217f-48ba-8ce5-5c09b40a66b0  (RTL Bank, customer-example)
--
-- Covers the vacant KEY roles by REASSIGNING existing employees (Enzo S1024:
-- "riassegnando dipendenti esistenti — NON creare incumbent fittizi") and fixes
-- the two broken assignment chains left by the S1024 org seed (assignments
-- ENDED without a replacement → '(unassigned)' leakage in analytics):
--
--   RIATTIVAZIONI (assignment ENDED sulla STESSA posizione, mai sostituito):
--   • alice.esposito    → Chief Risk Officer (POS-00000396)   [era il CRO]
--   • alberto.colombo   → Securities Dealer  (POS-00000350)   [era il dealer]
--
--   PROMOZIONI (candidato interno più senior con affinità di ruolo):
--   • benedetta.cattaneo (Securities Dealer 2003, più senior della Tesoreria)
--       → Head of Treasury (POS-TREAS-HEAD)
--   • matteo.lombardi    (Compliance Officer 2003, più senior di Risk&Compliance)
--       → Head of Internal Audit (POS-AUDIT-HEAD)
--   • andrea.martino     (Compliance Officer 2009)
--       → Head of Legal & Compliance (POS-LEGAL-HEAD)
--   • sara.gallo         (Investment Advisor Retail 2012)
--       → Head of Marketing (POS-MKT-HEAD)
--
--   COERENZA COLLEGATA (stessa transazione):
--   • contratti: alice → Dirigente + job_title reale (era QD4/"Risk analyst");
--     colombo → 3A4L ~59.5k (era 3A3L/43.9k, fuori dai pari 59-71k); i 4 promossi
--     → QD4 + salario in banda MG-1 (86-92k, sotto Head of Commercial 101k)
--   • band: le 4 posizioni head ricevono il profilo compensativo MG-1 (85-130k)
--   • manager OU: DIV-RISK → alice (era l'IT Director, incoerente), DIV-LEGAL →
--     martino, DIV-MKT → gallo, DIR-TREAS → cattaneo, DIR-AUDIT → lombardi
--   • owner posizioni head → federica.marchetti (precedente: owner CRO)
--   • team 1:1 con OU: LEAD allineato al manager; membership dei mossi aggiornata
--
-- Le retribuzioni restano provvisorie a livello di realismo di mercato: la
-- calibrazione CCNL Credito completa è il task #71 (ricerca web dedicata).
--
-- IDEMPOTENT: transazione unica; UUID v5 deterministici; UPDATE/INSERT guardati.
-- SCOPE: tocca SOLO il tenant RTL. Mai HEURESYS, mai altri tenant.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_key_roles_coverage.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\set rtl '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Guard + mappa (posizione target, utente, ruolo) — fail loud se manca qualcosa
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _moves ON COMMIT DROP AS
SELECT * FROM (VALUES
  -- (pos_code,          email,                             move_kind,   new_lvl,     new_salary, new_title)
  ('POS-00000396',      'alice.esposito@rtl-bank.org',     'REACTIVATE', 'Dirigente', NULL::int,  'Chief Risk Officer'),
  ('POS-00000350',      'alberto.colombo@rtl-bank.org',    'REACTIVATE', '3A4L',      59500,      'Securities Dealer'),
  ('POS-TREAS-HEAD',    'benedetta.cattaneo@rtl-bank.org', 'PROMOTE',    'QD4',       92000,      'Head of Treasury'),
  ('POS-AUDIT-HEAD',    'matteo.lombardi@rtl-bank.org',    'PROMOTE',    'QD4',       90000,      'Head of Internal Audit'),
  ('POS-LEGAL-HEAD',    'andrea.martino@rtl-bank.org',     'PROMOTE',    'QD4',       88000,      'Head of Legal & Compliance'),
  ('POS-MKT-HEAD',      'sara.gallo@rtl-bank.org',         'PROMOTE',    'QD4',       86000,      'Head of Marketing')
) t(pos_code, email, move_kind, new_lvl, new_salary, new_title);

CREATE TEMP TABLE _resolved ON COMMIT DROP AS
SELECT m.*, u.user_id, p.position_id, p.position_organization_unit_id AS ou_id
FROM _moves m
JOIN sys.sys_users u ON u.user_email = m.email AND u.user_tenant_id = :'rtl'::uuid
JOIN sys.sys_positions p ON p.position_code = m.pos_code AND p.position_tenant_id = :'rtl'::uuid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _resolved;
  IF n <> 6 THEN
    RAISE EXCEPTION '#70 seed: attese 6 righe risolte (utente+posizione), trovate %', n;
  END IF;
  IF (SELECT count(*) FROM sys.sys_users WHERE user_email='federica.marchetti@rtl-bank.org') <> 1 THEN
    RAISE EXCEPTION '#70 seed: owner federica.marchetti non trovato';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Assignment: chiudi l'eventuale PRIMARY ACTIVE su un'ALTRA posizione,
--    poi riattiva/crea il PRIMARY ACTIVE sulla posizione target.
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status = 'ENDED',
       user_position_assignment_end_date = DATE '2026-07-22',
       updated_at = now()
  FROM _resolved r
 WHERE a.user_position_assignment_user_id = r.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND a.user_position_assignment_position_id <> r.position_id;

-- riattivazione del rapporto ENDED sulla stessa posizione target (alice, colombo)
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status = 'ACTIVE',
       user_position_assignment_end_date = NULL,
       updated_at = now()
  FROM _resolved r
 WHERE a.user_position_assignment_user_id = r.user_id
   AND a.user_position_assignment_position_id = r.position_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ENDED';

-- nuovo assignment dove non ne esiste uno (promozioni)
INSERT INTO sys.sys_user_position_assignments
  (user_position_assignment_id, user_position_assignment_tenant_id,
   user_position_assignment_user_id, user_position_assignment_position_id,
   user_position_assignment_kind, user_position_assignment_fte,
   user_position_assignment_start_date, user_position_assignment_status,
   user_position_assignment_notes, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-assign:' || r.pos_code || ':' || r.email),
       :'rtl'::uuid, r.user_id, r.position_id, 'PRIMARY', 1.00,
       DATE '2026-07-22', 'ACTIVE',
       '#70 key-roles coverage (S1025): promozione interna',
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1)
FROM _resolved r
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                   WHERE a.user_position_assignment_user_id = r.user_id
                     AND a.user_position_assignment_position_id = r.position_id
                     AND a.user_position_assignment_kind = 'PRIMARY')
ON CONFLICT (user_position_assignment_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Contratti: inquadramento + retribuzione + job title coerenti col nuovo ruolo
--    (calibrazione CCNL completa → #71)
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_contracts uc
   SET user_contract_ccnl_level = r.new_lvl,
       user_contract_gross_annual_salary = COALESCE(r.new_salary, uc.user_contract_gross_annual_salary),
       user_contract_job_title = r.new_title,
       updated_at = now()
  FROM _resolved r
 WHERE uc.user_contract_user_id = r.user_id;

-- ----------------------------------------------------------------------------
-- 3. Band MG-1 per le 4 posizioni head (profilo compensativo mancante)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_position_compensation_profiles
  (position_compensation_profile_id, position_id, position_compensation_profile_tenant_id,
   compensation_band_id, economic_weight, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-pcp:' || r.pos_code),
       r.position_id, :'rtl'::uuid,
       (SELECT compensation_band_id FROM sys.sys_compensation_bands
         WHERE compensation_band_code = 'MG-1'
           AND compensation_band_tenant_id = :'rtl'::uuid),
       1.00,
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1)
FROM _resolved r
WHERE r.pos_code IN ('POS-TREAS-HEAD','POS-AUDIT-HEAD','POS-LEGAL-HEAD','POS-MKT-HEAD')
  AND NOT EXISTS (SELECT 1 FROM sys.sys_position_compensation_profiles pcp
                   WHERE pcp.position_id = r.position_id)
ON CONFLICT (position_compensation_profile_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Manager OU + owner posizioni head
-- ----------------------------------------------------------------------------
UPDATE sys.sys_organization_units ou
   SET organization_unit_manager_user_id = r.user_id, updated_at = now()
  FROM _resolved r,
       (VALUES ('POS-00000396','DIV-RISK'), ('POS-TREAS-HEAD','DIR-TREAS'),
               ('POS-AUDIT-HEAD','DIR-AUDIT'), ('POS-LEGAL-HEAD','DIV-LEGAL'),
               ('POS-MKT-HEAD','DIV-MKT')) map(pos_code, ou_code)
 WHERE r.pos_code = map.pos_code
   AND ou.organization_unit_code = map.ou_code
   AND ou.organization_unit_tenant_id = :'rtl'::uuid
   AND ou.organization_unit_manager_user_id IS DISTINCT FROM r.user_id;

UPDATE sys.sys_positions p
   SET position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE user_email='federica.marchetti@rtl-bank.org'),
       updated_at = now()
 WHERE p.position_tenant_id = :'rtl'::uuid
   AND p.position_code IN ('POS-TREAS-HEAD','POS-AUDIT-HEAD','POS-LEGAL-HEAD','POS-MKT-HEAD')
   AND p.position_owner_user_id IS DISTINCT FROM
       (SELECT user_id FROM sys.sys_users WHERE user_email='federica.marchetti@rtl-bank.org');

-- ----------------------------------------------------------------------------
-- 5. Team (1:1 con OU): lead allineato al manager + membership dei mossi
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _team_map ON COMMIT DROP AS
SELECT map.team_code, r.user_id, r.email
FROM _resolved r,
     (VALUES ('POS-00000396','DIV-RISK'), ('POS-TREAS-HEAD','DIR-TREAS'),
             ('POS-AUDIT-HEAD','DIR-AUDIT'), ('POS-LEGAL-HEAD','DIV-LEGAL'),
             ('POS-MKT-HEAD','DIV-MKT'), ('POS-00000350','DIR-TREAS')) map(pos_code, team_code)
WHERE r.pos_code = map.pos_code;

-- lead del team = nuovo head (colombo resta MEMBER)
UPDATE sys.sys_teams t
   SET team_lead_user_id = tm.user_id, updated_at = now()
  FROM _team_map tm
 WHERE t.team_code = tm.team_code
   AND t.team_tenant_id = :'rtl'::uuid
   AND tm.email <> 'alberto.colombo@rtl-bank.org'
   AND t.team_lead_user_id IS DISTINCT FROM tm.user_id;

-- membership: rimuovi le vecchie righe dei 6 mossi su team diversi dal target
DELETE FROM sys.sys_team_members m
 USING sys.sys_teams t, _team_map tm
 WHERE m.team_member_team_id = t.team_id
   AND m.team_member_user_id = tm.user_id
   AND t.team_tenant_id = :'rtl'::uuid
   AND t.team_code <> tm.team_code;

-- membership: assicura la riga sul team target (LEAD per gli head, MEMBER per colombo)
INSERT INTO sys.sys_team_members
  (team_member_id, team_member_team_id, team_member_user_id, team_member_role, team_member_is_active, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-tm:' || tm.team_code || ':' || tm.email),
       t.team_id, tm.user_id,
       CASE WHEN tm.email = 'alberto.colombo@rtl-bank.org' THEN 'MEMBER' ELSE 'LEAD' END,
       true,
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1)
FROM _team_map tm
JOIN sys.sys_teams t ON t.team_code = tm.team_code AND t.team_tenant_id = :'rtl'::uuid
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_team_members m
                   WHERE m.team_member_team_id = t.team_id
                     AND m.team_member_user_id = tm.user_id)
ON CONFLICT (team_member_id) DO NOTHING;

-- il vecchio LEAD sbagliato di DIV-RISK (IT Director) non deve restare membro
DELETE FROM sys.sys_team_members m
 USING sys.sys_teams t
 WHERE m.team_member_team_id = t.team_id
   AND t.team_code = 'DIV-RISK' AND t.team_tenant_id = :'rtl'::uuid
   AND m.team_member_user_id = (SELECT user_id FROM sys.sys_users WHERE user_email='marco.desantis@rtl-bank.org');

-- ----------------------------------------------------------------------------
-- 6. Post-conditions (fail loud)
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  -- 6a. le 6 posizioni chiave hanno esattamente 1 incumbent PRIMARY ACTIVE
  SELECT count(*) INTO n
  FROM (VALUES ('POS-00000396'),('POS-00000350'),('POS-TREAS-HEAD'),
               ('POS-AUDIT-HEAD'),('POS-LEGAL-HEAD'),('POS-MKT-HEAD')) k(code)
  JOIN sys.sys_positions p ON p.position_code = k.code
  WHERE (SELECT count(*) FROM sys.sys_user_position_assignments a
          WHERE a.user_position_assignment_position_id = p.position_id
            AND a.user_position_assignment_kind='PRIMARY'
            AND a.user_position_assignment_status='ACTIVE') <> 1;
  IF n > 0 THEN
    RAISE EXCEPTION '#70 seed: % posizioni chiave senza esattamente 1 incumbent ACTIVE', n;
  END IF;

  -- 6b. nessun utente ha più di 1 PRIMARY ACTIVE (no double-hat)
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_kind='PRIMARY' AND user_position_assignment_status='ACTIVE'
     GROUP BY user_position_assignment_user_id HAVING count(*) > 1) q;
  IF n > 0 THEN
    RAISE EXCEPTION '#70 seed: % utenti con più di un PRIMARY ACTIVE', n;
  END IF;

  -- 6c. nessun utente con attendance/overtime/evidence resta senza catena OU
  SELECT count(*) INTO n
  FROM sys.sys_users u
  WHERE (EXISTS (SELECT 1 FROM sys.sys_attendance x WHERE x.attendance_subject_user_id = u.user_id)
      OR EXISTS (SELECT 1 FROM sys.sys_overtime x WHERE x.overtime_subject_user_id = u.user_id)
      OR EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence x WHERE x.user_skill_evidence_user_id = u.user_id))
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_position_assignments a
      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
      WHERE a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE');
  IF n > 0 THEN
    RAISE EXCEPTION '#70 seed: % utenti con dati ma senza catena OU attiva', n;
  END IF;

  -- 6d. lead team = manager OU per i 5 team toccati
  SELECT count(*) INTO n
  FROM (VALUES ('DIV-RISK'),('DIR-TREAS'),('DIR-AUDIT'),('DIV-LEGAL'),('DIV-MKT')) k(code)
  JOIN sys.sys_teams t ON t.team_code = k.code AND t.team_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid
  JOIN sys.sys_organization_units ou ON ou.organization_unit_code = k.code
   AND ou.organization_unit_tenant_id = t.team_tenant_id
  WHERE t.team_lead_user_id IS DISTINCT FROM ou.organization_unit_manager_user_id;
  IF n > 0 THEN
    RAISE EXCEPTION '#70 seed: % team con lead disallineato dal manager OU', n;
  END IF;

  RAISE NOTICE '#70 seed: 6 ruoli chiave coperti, catene OU integre, team allineati.';
END $$;

COMMIT;
