-- ============================================================================
-- Migration 000115 — R3 Fase3 (S988): job_roles cleanup + family wiring + ESCO enrichment
-- ----------------------------------------------------------------------------
-- Three idempotent steps on sys.sys_job_roles + sys.sys_esco_occupation_mappings:
--   §1 DELETE the 91 garbage `OLDDB::ccnl_job_title_mapping::%` roles (brownfield wave1
--      artifacts; verified 0 FK from sys_positions/sys_esco_occupation_mappings live; the only
--      dependents are 91 sys_job_role_embeddings rows removed by ON DELETE CASCADE). These come
--      from the one-time brownfield wave1 engine run, NOT the standard migrate+seed flow, so a
--      fresh rebuild never re-creates them → this DELETE is a no-op there (idempotent both ways).
--   §2 wire the 25 RTL-ROLE-* job_roles to the EXISTING canonical family catalog
--      sys.sys_job_families + set job_role_seniority_level from the title.
--      ⚠ SCOPE DEVIATION (flagged for Enzo): the decision text said "crea sys_job_role_families
--        (nuovo catalogo)", but the structural authority ALREADY has sys.sys_job_families (27 rows,
--        with shared schema + API module) and job_role_family_id already FKs to it. Creating a
--        second catalog would be a redundant table + an FK retarget (schema break, violates R3/
--        no-duplication). HOW that meets the goal ("families wired"): wire to the existing catalog.
--        Reversible (UPDATE family_id back to NULL). PM may veto.
--   §3 ESCO-enrich the 25 RTL roles from the OFFLINE catalog already in
--      sys.sys_esco_occupation_mappings (3044 job_role_id IS NULL occupation rows) via in-DB
--      pg_trgm similarity on an acronym-expanded title. Floor 0.70 auto-accept; below → stored
--      WITH metadata.low_confidence=true (NEVER silently auto-accepted — flagged for human review).
--      No network/API key (offline). One mapping per role (idempotent via WHERE NOT EXISTS).
-- Applied under `psql -1 -f` (single implicit txn). Authored: 2026-06-13 (S988).
-- ============================================================================

-- §1 — DELETE garbage OLDDB roles (cascade removes their embeddings)
DELETE FROM sys.sys_job_roles WHERE job_role_code LIKE 'OLDDB::%';

-- §2 — wire family_id + seniority for the 25 RTL roles to the existing sys_job_families
WITH m(code, family_code, seniority) AS (VALUES
  ('RTL-ROLE-BACK-OFFICE-SPECIALIST',     'OPS',    'MID'),
  ('RTL-ROLE-BANK-MANAGER',               'RETAIL', 'LEAD'),
  ('RTL-ROLE-BANK-TELLER',                'RETAIL', 'MID'),
  ('RTL-ROLE-CEO',                        'ADMIN',  'EXECUTIVE'),
  ('RTL-ROLE-CEO-FOUNDER',                'ADMIN',  'EXECUTIVE'),
  ('RTL-ROLE-CHIEF-RISK-OFFICER',         'RISK',   'EXECUTIVE'),
  ('RTL-ROLE-COMPLIANCE-OFFICER',         'LEGAL',  'MID'),
  ('RTL-ROLE-COO',                        'OPS',    'EXECUTIVE'),
  ('RTL-ROLE-FINANCE-DIRECTOR',           'FIN',    'EXECUTIVE'),
  ('RTL-ROLE-FINANCIAL-ANALYST',          'FIN',    'MID'),
  ('RTL-ROLE-HEAD-OF-COMMERCIAL-BANKING', 'COMM',   'EXECUTIVE'),
  ('RTL-ROLE-HEAD-OF-PRODUCT',            'COMM',   'EXECUTIVE'),
  ('RTL-ROLE-HR-DIRECTOR',                'HR',     'EXECUTIVE'),
  ('RTL-ROLE-HR-MANAGER',                 'HR',     'LEAD'),
  ('RTL-ROLE-INVESTMENT-ADVISOR',         'WM',     'MID'),
  ('RTL-ROLE-IT-DIRECTOR',                'IT',     'EXECUTIVE'),
  ('RTL-ROLE-LINE-MANAGER-OPERATIONS',    'OPS',    'LEAD'),
  ('RTL-ROLE-OPERATIONS-DIRECTOR',        'OPS',    'EXECUTIVE'),
  ('RTL-ROLE-PAYMENT-SPECIALIST',         'OPS',    'MID'),
  ('RTL-ROLE-RETAIL-DIRECTOR',            'RETAIL', 'EXECUTIVE'),
  ('RTL-ROLE-RISK-ANALYST',               'RISK',   'MID'),
  ('RTL-ROLE-SECURITIES-DEALER',          'TREAS',  'MID'),
  ('RTL-ROLE-SOFTWARE-DEVELOPER',         'IT',     'MID'),
  ('RTL-ROLE-SYSTEM-ADMINISTRATOR',       'IT',     'MID'),
  ('RTL-ROLE-TENANT-OWNER',               'ADMIN',  'EXECUTIVE')
)
UPDATE sys.sys_job_roles r
SET job_role_family_id      = f.job_family_id,
    job_role_seniority_level = m.seniority
FROM m
JOIN sys.sys_job_families f ON f.job_family_code = m.family_code
WHERE r.job_role_code = m.code
  AND (r.job_role_family_id IS DISTINCT FROM f.job_family_id
       OR r.job_role_seniority_level IS DISTINCT FROM m.seniority);

-- §3 — ESCO-enrich the 25 RTL roles from the offline catalog (pg_trgm + acronym expansion)
WITH roles AS (
  SELECT job_role_id,
    lower(CASE
      WHEN upper(coalesce(job_role_metadata->>'legacy_job_title', job_role_name)) IN ('CEO','CEO & FOUNDER','TENANT OWNER')
        THEN 'chief executive officer'
      WHEN upper(coalesce(job_role_metadata->>'legacy_job_title', job_role_name)) = 'COO'
        THEN 'chief operating officer'
      ELSE regexp_replace(
             regexp_replace(coalesce(job_role_metadata->>'legacy_job_title', job_role_name), '\mHR\M', 'human resources', 'g'),
             '\mIT\M', 'information technology', 'g')
    END) AS search_term
  FROM sys.sys_job_roles
  WHERE job_role_code LIKE 'RTL-ROLE-%'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_esco_occupation_mappings e
       WHERE e.esco_occupation_mapping_job_role_id = sys.sys_job_roles.job_role_id)
),
cat AS (
  SELECT esco_occupation_mapping_esco_uri AS uri, esco_occupation_mapping_esco_label AS label,
         esco_occupation_mapping_isco_code AS isco
  FROM sys.sys_esco_occupation_mappings
  WHERE esco_occupation_mapping_job_role_id IS NULL
    AND esco_occupation_mapping_esco_uri LIKE 'http://data.europa.eu/esco/occupation/%'
)
INSERT INTO sys.sys_esco_occupation_mappings
  (esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri, esco_occupation_mapping_esco_label,
   esco_occupation_mapping_isco_code, esco_occupation_mapping_confidence, esco_occupation_mapping_metadata)
SELECT r.job_role_id, m.uri, m.label, m.isco, round(m.sim::numeric, 3),
  jsonb_build_object('source', 's988-r3-esco-enrich', 'search_term', r.search_term,
                     'match_method', 'trgm_offline', 'low_confidence', (m.sim < 0.70))
FROM roles r
CROSS JOIN LATERAL (
  SELECT c.uri, c.label, c.isco, similarity(r.search_term, lower(c.label)) AS sim
  FROM cat c
  ORDER BY similarity(r.search_term, lower(c.label)) DESC, length(c.label) ASC
  LIMIT 1
) m;

-- ============================================================================
-- Post-conditions (idempotent; informational counts + hard asserts).
-- ============================================================================
DO $$
DECLARE n_oldb int; n_fam int; n_sen int; n_esco int; n_low int;
BEGIN
  SELECT count(*) INTO n_oldb FROM sys.sys_job_roles WHERE job_role_code LIKE 'OLDDB::%';
  SELECT count(*) INTO n_fam  FROM sys.sys_job_roles WHERE job_role_code LIKE 'RTL-ROLE-%' AND job_role_family_id IS NOT NULL;
  SELECT count(*) INTO n_sen  FROM sys.sys_job_roles WHERE job_role_code LIKE 'RTL-ROLE-%' AND job_role_seniority_level IS NOT NULL;
  SELECT count(*) INTO n_esco FROM sys.sys_esco_occupation_mappings e
    JOIN sys.sys_job_roles r ON r.job_role_id = e.esco_occupation_mapping_job_role_id
    WHERE r.job_role_code LIKE 'RTL-ROLE-%';
  SELECT count(*) INTO n_low  FROM sys.sys_esco_occupation_mappings e
    JOIN sys.sys_job_roles r ON r.job_role_id = e.esco_occupation_mapping_job_role_id
    WHERE r.job_role_code LIKE 'RTL-ROLE-%' AND (e.esco_occupation_mapping_metadata->>'low_confidence')::boolean;
  RAISE NOTICE '000115: OLDDB-remaining=% RTL-family-wired=% RTL-seniority=% RTL-esco-mapped=% (of which low-confidence=%) — expect 0/25/25/25/~11',
    n_oldb, n_fam, n_sen, n_esco, n_low;
  IF n_oldb <> 0 THEN RAISE EXCEPTION '000115: % OLDDB roles still present (expected 0)', n_oldb; END IF;
  IF n_fam <> 25 OR n_sen <> 25 THEN RAISE EXCEPTION '000115: RTL family/seniority wiring incomplete (fam=% sen=%)', n_fam, n_sen; END IF;
  IF n_esco <> 25 THEN RAISE EXCEPTION '000115: expected 25 RTL ESCO mappings, found %', n_esco; END IF;
END $$;
