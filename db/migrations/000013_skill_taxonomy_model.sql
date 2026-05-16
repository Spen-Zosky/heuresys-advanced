-- =============================================================================
-- 000013_skill_taxonomy_model.sql
-- Heuresys Advanced — skill taxonomy (6 tables) + late FK to user_skill_evidence
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §5.1.
-- Tables: skill_families, skill_categories, skills, skill_taxonomy_edges,
-- skill_proficiency_levels (NOVICE..MASTER catalog), skill_aliases.
-- Also: late-binding FK from sys_user_skill_evidence.skill_id (created in
-- 000006) → sys_skills.skill_id (created here).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_skill_families
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_families (
  skill_family_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_family_code        varchar(64)  NOT NULL,
  skill_family_name        varchar(128) NOT NULL,
  skill_family_description text,
  skill_family_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_families_code_uq
  ON sys.sys_skill_families (skill_family_code);

-- -----------------------------------------------------------------------------
-- 2. sys.sys_skill_categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_categories (
  skill_category_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category_family_id   uuid         NOT NULL REFERENCES sys.sys_skill_families(skill_family_id) ON DELETE CASCADE,
  skill_category_code        varchar(64)  NOT NULL,
  skill_category_name        varchar(128) NOT NULL,
  skill_category_description text,
  skill_category_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_categories_code_uq
  ON sys.sys_skill_categories (skill_category_code);

CREATE INDEX IF NOT EXISTS sys_skill_categories_family_idx
  ON sys.sys_skill_categories (skill_category_family_id);

-- -----------------------------------------------------------------------------
-- 3. sys.sys_skill_proficiency_levels — NOVICE..MASTER catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_proficiency_levels (
  skill_proficiency_level_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_proficiency_level_code        varchar(32)  NOT NULL,
  skill_proficiency_level_name        varchar(64)  NOT NULL,
  skill_proficiency_level_rank        smallint     NOT NULL,
  skill_proficiency_level_description text,
  skill_proficiency_level_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_skill_proficiency_levels
  DROP CONSTRAINT IF EXISTS sys_spl_code_check;
ALTER TABLE sys.sys_skill_proficiency_levels
  ADD CONSTRAINT sys_spl_code_check
  CHECK (skill_proficiency_level_code IN ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_proficiency_levels_code_uq
  ON sys.sys_skill_proficiency_levels (skill_proficiency_level_code);

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_proficiency_levels_rank_uq
  ON sys.sys_skill_proficiency_levels (skill_proficiency_level_rank);

-- Seed the 6 canonical proficiency levels (idempotent)
INSERT INTO sys.sys_skill_proficiency_levels (skill_proficiency_level_code, skill_proficiency_level_name, skill_proficiency_level_rank) VALUES
  ('NOVICE',     'Novice',     1),
  ('BASIC',      'Basic',      2),
  ('COMPETENT',  'Competent',  3),
  ('PROFICIENT', 'Proficient', 4),
  ('EXPERT',     'Expert',     5),
  ('MASTER',     'Master',     6)
ON CONFLICT (skill_proficiency_level_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. sys.sys_skills — master skill catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skills (
  skill_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_tenant_id       uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  skill_category_id     uuid         REFERENCES sys.sys_skill_categories(skill_category_id) ON DELETE SET NULL,
  skill_code            varchar(128) NOT NULL,
  skill_name            varchar(255) NOT NULL,
  skill_description     text,
  skill_esco_uri        text,
  skill_is_global       boolean      NOT NULL DEFAULT false,
  skill_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  created_by            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  updated_by            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

-- skill_code unique per tenant; for global skills (tenant_id IS NULL), code must still be unique
CREATE UNIQUE INDEX IF NOT EXISTS sys_skills_tenant_code_uq
  ON sys.sys_skills (COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), skill_code);

CREATE INDEX IF NOT EXISTS sys_skills_category_idx
  ON sys.sys_skills (skill_category_id);

CREATE INDEX IF NOT EXISTS sys_skills_esco_uri_idx
  ON sys.sys_skills (skill_esco_uri)
  WHERE skill_esco_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS sys_skills_name_trgm_idx
  ON sys.sys_skills USING gin (skill_name gin_trgm_ops);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_skills_set_updated_at' AND tgrelid = 'sys.sys_skills'::regclass) THEN
    CREATE TRIGGER sys_skills_set_updated_at BEFORE UPDATE ON sys.sys_skills FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 5. sys.sys_skill_taxonomy_edges — parent/child + alternative labels + ESCO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_taxonomy_edges (
  skill_taxonomy_edge_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_taxonomy_edge_parent_id uuid         NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  skill_taxonomy_edge_child_id  uuid         NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  skill_taxonomy_edge_kind      varchar(32)  NOT NULL DEFAULT 'IS_A',
  skill_taxonomy_edge_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_skill_taxonomy_edges
  DROP CONSTRAINT IF EXISTS sys_skill_taxonomy_edge_kind_check;
ALTER TABLE sys.sys_skill_taxonomy_edges
  ADD CONSTRAINT sys_skill_taxonomy_edge_kind_check
  CHECK (skill_taxonomy_edge_kind IN ('IS_A', 'PART_OF', 'RELATED', 'PREREQUISITE_OF'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_taxonomy_edges_pair_kind_uq
  ON sys.sys_skill_taxonomy_edges (skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind);

-- -----------------------------------------------------------------------------
-- 6. sys.sys_skill_aliases — synonyms / translations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_aliases (
  skill_alias_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_alias_skill_id  uuid         NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  skill_alias_label     varchar(255) NOT NULL,
  skill_alias_locale    varchar(16),
  skill_alias_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_aliases_skill_label_locale_uq
  ON sys.sys_skill_aliases (skill_alias_skill_id, lower(skill_alias_label), COALESCE(skill_alias_locale, ''));

CREATE INDEX IF NOT EXISTS sys_skill_aliases_label_trgm_idx
  ON sys.sys_skill_aliases USING gin (skill_alias_label gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Late-binding FK: sys_user_skill_evidence.skill_id → sys_skills.skill_id
-- (table created in 000006 without FK; constraint added here once skills exist)
-- -----------------------------------------------------------------------------
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_user_skill_evidence'
      AND constraint_name = 'sys_user_skill_evidence_skill_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_user_skill_evidence
      ADD CONSTRAINT sys_user_skill_evidence_skill_id_fkey
      FOREIGN KEY (user_skill_evidence_skill_id)
      REFERENCES sys.sys_skills(skill_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- Late-binding FK: sys_position_skill_requirements.skill_id → sys_skills.skill_id
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_position_skill_requirements'
      AND constraint_name = 'sys_position_skill_requirements_skill_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_position_skill_requirements
      ADD CONSTRAINT sys_position_skill_requirements_skill_id_fkey
      FOREIGN KEY (skill_id)
      REFERENCES sys.sys_skills(skill_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;
