-- =============================================================================
-- #71a — Adeguamento retributivo ai minimi CCNL (S1025, 2026-07-22)
--
-- FONTI (ricerca web 2026-07-22):
--   • CCNL Credito, tabelle dal 01/03/2026 (rinnovo 23/11/2023, 4ª tranche):
--     mensile ×13 ⇒ RAL tabellare: QD4 67.081 · QD3 57.159 · QD2 51.551 ·
--     QD1 48.662 · 3A4L 43.445 · 3A3L 39.773 · 3A2L 37.575 · 3A1L 35.650 ·
--     Area Unificata 32.233 (ccnlbancari.it/tabelle-retributive)
--   • Benchmark di mercato (Michael Page/Glassdoor/Indeed/talent.com):
--     teller 31k avg · risk analyst 30-50k · compliance 45-65k · dealer 55-75k ·
--     head treasury 70-120k · head audit 60-100k · legal counsel 44-72k+
--
-- Stato misurato (DB live): 26 contratti RTL sotto il minimo tabellare del
-- proprio livello (22×3A1L, 4×3A2L) — illegale per un datore CCNL Credito.
-- Fix: RAL = tabellare + margine deterministico 300-1.500 € (scatti/assegni),
-- solo per i sotto-minimo (chi è già sopra non viene toccato).
--
-- Tenant HEURESYS (CCNL Commercio, 2 contratti): inquadramenti incoerenti col
-- ruolo — COO (76.7k) era "Quadro" → Dirigente; Head of Product (94.6k) era
-- "Livello 2" → Quadro. Retribuzioni già di mercato, solo il livello cambia.
--
-- IDEMPOTENT: UPDATE guardati (secondo giro 0 righe). SCOPE: contratti only.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_ccnl_floors.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RTL / CCNL Credito: alza i sotto-minimo al tabellare + margine 300-1500 €
-- ----------------------------------------------------------------------------
WITH ccnl(lvl, ral_floor) AS (VALUES
  ('QD4',67081),('QD3',57159),('QD2',51551),('QD1',48662),
  ('3A4L',43445),('3A3L',39773),('3A2L',37575),('3A1L',35650),('AU',32233)
)
UPDATE sys.sys_user_contracts uc
   SET user_contract_gross_annual_salary =
         c.ral_floor + 300 + (abs(hashtext(uc.user_contract_user_id::text)) % 1201),
       updated_at = now()
  FROM ccnl c, sys.sys_users u, sys.sys_tenancies t
 WHERE uc.user_contract_ccnl_level = c.lvl
   AND u.user_id = uc.user_contract_user_id
   AND t.tenant_id = u.user_tenant_id
   AND t.tenant_code = 'RTL_BANK'
   AND uc.user_contract_gross_annual_salary < c.ral_floor;

-- ----------------------------------------------------------------------------
-- 2. HEURESYS / CCNL Commercio: inquadramenti coerenti col ruolo
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_contracts uc
   SET user_contract_ccnl_level = 'Dirigente', updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_id = uc.user_contract_user_id
   AND u.user_email = 'andrea.spenuso@heuresys.com'
   AND uc.user_contract_ccnl_level = 'Quadro';

UPDATE sys.sys_user_contracts uc
   SET user_contract_ccnl_level = 'Quadro', updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_id = uc.user_contract_user_id
   AND u.user_email = 'chiara.spenuso@heuresys.com'
   AND uc.user_contract_ccnl_level = 'Livello 2';

-- ----------------------------------------------------------------------------
-- 3. Post-conditions (fail loud)
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  WITH ccnl(lvl, ral_floor) AS (VALUES
    ('QD4',67081),('QD3',57159),('QD2',51551),('QD1',48662),
    ('3A4L',43445),('3A3L',39773),('3A2L',37575),('3A1L',35650),('AU',32233)
  )
  SELECT count(*) INTO n
    FROM sys.sys_user_contracts uc
    JOIN ccnl c ON c.lvl = uc.user_contract_ccnl_level
    JOIN sys.sys_users u ON u.user_id = uc.user_contract_user_id
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
   WHERE t.tenant_code = 'RTL_BANK'
     AND uc.user_contract_gross_annual_salary < c.ral_floor;
  IF n > 0 THEN
    RAISE EXCEPTION '#71a seed: % contratti RTL ancora sotto il minimo CCNL', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_user_contracts
   WHERE user_contract_ccnl_level IN ('Livello 2');
  IF n > 0 THEN
    RAISE EXCEPTION '#71a seed: livello non coerente ancora presente';
  END IF;

  RAISE NOTICE '#71a seed: minimi CCNL rispettati, inquadramenti HEURESYS coerenti.';
END $$;

COMMIT;
