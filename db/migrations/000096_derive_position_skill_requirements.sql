-- 000096_derive_position_skill_requirements.sql
-- ② Fase 3 — PSR-population (sys.sys_position_skill_requirements), DERIVED.
--
-- WHY DERIVED, not imported: the legacy `position_skill_requirements` (1632 rows) is
-- real but its position FK references legacy `job_templates` (the job-vs-position split)
-- with NO bridge to the 162 sys_positions, and the skill side has no deterministic
-- legacy→sys_skills key (reconciliation registry: NEEDS_DECISION, wall=job_to_position_bridge,
-- card REFERENCE_ONLY). The roadmap's sanctioned alternative to that wall is an explicit
-- "derivazione job_role→skill" — this migration implements it.
--
-- DERIVATION RULE (peer-group-prevalence-v1), grounded entirely in live data:
--   For each (job_role, tenant), the peer group = active incumbents of positions with that
--   role+tenant who carry ANY skill evidence. A skill becomes a REQUIREMENT of the role when
--   it is held by >= 34% of that peer group AND by at least 2 distinct peers (no 1-person
--   fabrication). required_proficiency = the modal declared proficiency among holders (ties
--   broken toward the higher level). weight = prevalence (0..1). criticality is banded from
--   prevalence (>=.8 CRITICAL / >=.6 HIGH / >=.4 MEDIUM / else LOW). Role-level requirements
--   are fanned out to every position of that role+tenant. Tenant-LOCAL (no cross-tenant peer
--   mixing → I5-clean). Provenance is recorded per row in metadata.derived_by for audit.
--
-- This de-circularizes skill-gap (a position inherits the role NORM, so an individual missing
-- a role-common skill shows a real gap) and is fully deterministic + explainable.
--
-- IDEMPOTENT: the existing UNIQUE(position_id, skill_id) index (sys_psr_position_skill_uq,
-- from 000011) + deterministic v5 row ids (uuid_generate_v5 of position:skill) + fixed timestamps +
-- delete-derived-then-insert. Re-running on unchanged data reproduces byte-identical rows
-- (empty pg_dump diff). Manually-authored requirements (metadata without the derived_by
-- marker) are NEVER deleted or clobbered (DELETE is marker-scoped; INSERT is ON CONFLICT
-- DO NOTHING against that unique index).

-- 1) Clear the previously-derived rows (marker-scoped) so a re-run re-derives from current data.
DELETE FROM sys.sys_position_skill_requirements
 WHERE position_skill_requirement_metadata ->> 'derived_by' = 'peer-group-prevalence-v1';

-- 2) Derive + insert (ON CONFLICT DO NOTHING leaves any manual requirement untouched).
WITH incumbents AS (
  SELECT p.position_job_role_id AS role_id, p.position_tenant_id AS tenant_id,
         a.user_position_assignment_user_id AS user_id
  FROM sys.sys_positions p
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_position_id = p.position_id
  WHERE p.position_job_role_id IS NOT NULL
    AND a.user_position_assignment_status = 'ACTIVE'
),
peers AS (  -- peer-group size: distinct incumbents (role,tenant) holding ANY evidence
  SELECT i.role_id, i.tenant_id,
         count(DISTINCT i.user_id) FILTER (
           WHERE EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence e
                          WHERE e.user_skill_evidence_user_id = i.user_id)
         ) AS peer_n
  FROM incumbents i GROUP BY 1, 2
),
ev AS (  -- one (role,tenant,skill,user,prof); a user's highest proficiency for a skill
  SELECT i.role_id, i.tenant_id, e.user_skill_evidence_skill_id AS skill_id, i.user_id,
         max(CASE e.user_skill_evidence_declared_proficiency
               WHEN 'MASTER' THEN 6 WHEN 'EXPERT' THEN 5 WHEN 'PROFICIENT' THEN 4
               WHEN 'COMPETENT' THEN 3 WHEN 'BASIC' THEN 2 WHEN 'NOVICE' THEN 1 ELSE 0 END) AS prof_ord
  FROM incumbents i
  JOIN sys.sys_user_skill_evidence e ON e.user_skill_evidence_user_id = i.user_id
  GROUP BY 1, 2, 3, 4
),
holders AS (
  SELECT role_id, tenant_id, skill_id, count(DISTINCT user_id) AS holders_n
  FROM ev GROUP BY 1, 2, 3
),
prof_rank AS (  -- modal proficiency per (role,tenant,skill); tie → higher ordinal
  SELECT role_id, tenant_id, skill_id, prof_ord,
         row_number() OVER (PARTITION BY role_id, tenant_id, skill_id
                            ORDER BY count(*) DESC, prof_ord DESC) AS rn
  FROM ev GROUP BY role_id, tenant_id, skill_id, prof_ord
),
qualified AS (
  SELECT h.role_id, h.tenant_id, h.skill_id, h.holders_n, pe.peer_n,
         round(h.holders_n::numeric / NULLIF(pe.peer_n, 0), 2) AS prevalence,
         pr.prof_ord
  FROM holders h
  JOIN peers pe ON pe.role_id = h.role_id AND pe.tenant_id = h.tenant_id
  JOIN prof_rank pr ON pr.role_id = h.role_id AND pr.tenant_id = h.tenant_id
                   AND pr.skill_id = h.skill_id AND pr.rn = 1
  WHERE pe.peer_n >= 1 AND h.holders_n >= 2
    AND (h.holders_n::numeric / NULLIF(pe.peer_n, 0)) >= 0.34
),
derived AS (  -- fan role+tenant requirements out to each position of that role+tenant
  SELECT p.position_id, q.tenant_id, q.skill_id, q.prof_ord, q.prevalence, q.holders_n, q.peer_n
  FROM qualified q
  JOIN sys.sys_positions p
    ON p.position_job_role_id = q.role_id AND p.position_tenant_id = q.tenant_id
)
INSERT INTO sys.sys_position_skill_requirements
  (position_skill_requirement_id, position_id, position_skill_requirement_tenant_id, skill_id,
   required_proficiency, weight, criticality, position_skill_requirement_metadata,
   created_at, created_by, updated_at, updated_by)
SELECT
  -- deterministic, RFC-4122-conformant v5 UUID (stable across re-runs → empty pg_dump diff;
  -- a raw md5::uuid would fail the response schema's strict z.uuid() version/variant check).
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                   'psr-derived:' || d.position_id::text || ':' || d.skill_id::text),
  d.position_id, d.tenant_id, d.skill_id,
  CASE d.prof_ord WHEN 6 THEN 'MASTER' WHEN 5 THEN 'EXPERT' WHEN 4 THEN 'PROFICIENT'
                  WHEN 3 THEN 'COMPETENT' WHEN 2 THEN 'BASIC' ELSE 'NOVICE' END,
  d.prevalence,
  CASE WHEN d.prevalence >= 0.8 THEN 'CRITICAL' WHEN d.prevalence >= 0.6 THEN 'HIGH'
       WHEN d.prevalence >= 0.4 THEN 'MEDIUM' ELSE 'LOW' END,
  jsonb_build_object('derived_by', 'peer-group-prevalence-v1',
                     'prevalence', d.prevalence, 'holders', d.holders_n, 'peers', d.peer_n,
                     'source', 'sys_user_skill_evidence'),
  TIMESTAMPTZ '2026-06-08 00:00:00+00', NULL, TIMESTAMPTZ '2026-06-08 00:00:00+00', NULL
FROM derived d
ON CONFLICT (position_id, skill_id) DO NOTHING;

-- 3) Record the population decision in the reconciliation registry (audit trail). The view
--    already resolves to POPULATED via has_rows; this updates the human-readable rationale.
UPDATE sys.sys_reconciliation_registry
   SET reconciliation_registry_rationale =
         reconciliation_registry_rationale ||
         ' || [POPULATED S978, mig 000096] DERIVED via peer-group-prevalence-v1 (job_role→skill, '
         || 'tenant-local, >=34% prevalence & >=2 holders, modal proficiency). Legacy import remains '
         || 'walled (job_to_position_bridge); this is the sanctioned derivation alternative.',
       updated_at = now()
 WHERE reconciliation_registry_table_name = 'sys_position_skill_requirements'
   AND reconciliation_registry_rationale NOT LIKE '%POPULATED S978%';

-- 4) Assertions: derived rows exist (when source data present), all carry the marker, no dup pair.
DO $$
DECLARE n_derived int; n_dups int;
BEGIN
  SELECT count(*) INTO n_derived FROM sys.sys_position_skill_requirements
   WHERE position_skill_requirement_metadata ->> 'derived_by' = 'peer-group-prevalence-v1';
  SELECT count(*) INTO n_dups FROM (
    SELECT position_id, skill_id FROM sys.sys_position_skill_requirements
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF n_dups <> 0 THEN
    RAISE EXCEPTION '② Fase 3 PSR: % duplicate (position,skill) pairs (UQ violated)', n_dups;
  END IF;
  RAISE NOTICE '② Fase 3 PSR-population: % derived requirement rows (peer-group-prevalence-v1).', n_derived;
END $$;
