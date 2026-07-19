-- ============================================================================
-- 000175_esco_skill_catalogue_visibility.sql — #42/S1021 skill catalogue
-- visibility repair (prerequisite of #46 D/D1 skill possession).
--
-- PROBLEM (measured 2026-07-19 on the live DB):
--   sys.sys_skills held 14093 rows of which 14036 had
--   skill_is_global = false AND skill_tenant_id IS NULL. The repository filters
--   visibility as `skill_is_global = true OR skill_tenant_id = $tenant`
--   (modules/skills/repository.ts), so those rows were reachable by NO tenant —
--   99.6% of the catalogue was dark. Zero rows were global.
--   This was not cosmetic: 844 sys_position_skill_requirements and 11965
--   sys_skill_taxonomy_edges already pointed at those invisible skills, i.e. the
--   requirement/gap machinery was wired to data the UI could never surface.
--
-- FIX (this migration): the 14011 orphans carrying an ESCO URI are the public
--   ESCO reference taxonomy. Reference data is global by definition, so they are
--   flipped to skill_is_global = true. Tenant-owned skills (57 rows, RTL Bank)
--   are untouched.
--
-- DELIBERATELY NOT FIXED HERE: the remaining 25 orphans are legacy
--   `COMP::<uuid>` competencies (brownfield import, 2026-02-25). They are
--   duplicate residue — the same 8 competencies (Leadership, Comunicazione,
--   Adattabilita, Innovazione, Problem solving, Orientamento ai risultati,
--   Orientamento al cliente, Collaborazione) already exist 32 more times under
--   RTL Bank, and these 25 carry 0 position requirements, 0 gaps and 0 taxonomy
--   edges. Making them visible would surface 7 copies of each competency instead
--   of 4. They need de-duplication, not visibility → tracked separately.
--
-- IDEMPOTENT: the predicate excludes rows already global, so a second run
--   updates 0 rows.
-- ROLLBACK: UPDATE sys.sys_skills SET skill_is_global = false
--           WHERE skill_esco_uri IS NOT NULL AND skill_tenant_id IS NULL;
--           (exact, because no skill was global before this migration).
-- Authored: 2026-07-19.
-- ============================================================================

UPDATE sys.sys_skills
SET skill_is_global = true,
    updated_at      = now()
WHERE skill_esco_uri IS NOT NULL
  AND skill_tenant_id IS NULL
  AND skill_is_global = false;
