-- =============================================================================
-- 000120_skill_kind_dimension.sql
-- T2.4 (#3 ESCO / tenant-onboarding, debt D-34) — add a deterministic
-- `skill_kind` dimension derived from the ESCO skill_type, lifting categorization
-- coverage from 31/21939 to ~14k WITHOUT inventing a hard/soft taxonomy.
-- -----------------------------------------------------------------------------
-- Rationale (discovery 2026-06-15): the File-2 "hard/soft/live/conoscenze"
-- taxonomy has NO 1:1 mapping to ESCO skill/knowledge and ESCO carries no
-- hard/soft flag (is_transversal is 0% populated). So we ship ONLY the part the
-- data can prove deterministically: the ESCO-native kind from
-- skill_metadata->>'skill_type' (skill 10797 / knowledge 3230 / competence 8 /
-- behavior 1 = 14036 typed). The hard/soft layer is DEFERRED to an Enzo decision.
-- The ~7903 rows with NULL skill_type are brownfield POLLUTION (metadata like
-- {employee_id, meeting_type}, {relationship: peer} — NOT skills); they are left
-- skill_kind NULL and flagged as a separate data-quality item (not classified,
-- not deleted — cleanup needs a decision).
-- RD-08: varchar + CHECK, NEVER a Postgres enum. Additive: skills/repository.ts
-- selects an explicit column list (no SELECT *), so a new column is read-safe.
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE WHERE IS DISTINCT FROM (0 rows
-- on 2nd run). I12/ADR-0023 (synthetic no-PII).
-- =============================================================================

ALTER TABLE sys.sys_skills ADD COLUMN IF NOT EXISTS skill_kind varchar(16);

ALTER TABLE sys.sys_skills DROP CONSTRAINT IF EXISTS sys_skills_skill_kind_check;
ALTER TABLE sys.sys_skills ADD CONSTRAINT sys_skills_skill_kind_check
  CHECK (skill_kind IS NULL OR skill_kind IN ('SKILL','KNOWLEDGE','COMPETENCE','BEHAVIOR','OTHER'));

UPDATE sys.sys_skills
   SET skill_kind = upper(skill_metadata->>'skill_type')
 WHERE skill_metadata->>'skill_type' IN ('skill','knowledge','competence','behavior')
   AND skill_kind IS DISTINCT FROM upper(skill_metadata->>'skill_type');

CREATE INDEX IF NOT EXISTS sys_skills_skill_kind_idx
  ON sys.sys_skills (skill_kind) WHERE skill_kind IS NOT NULL;

-- DOWN (manual): ALTER TABLE sys.sys_skills DROP COLUMN IF EXISTS skill_kind;
-- =============================================================================
