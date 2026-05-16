-- =============================================================================
-- 000006_user_profiles_and_evidence.sql
-- Heuresys Advanced — extended profile + evidence tables (10 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §1.4. Stores extended profile (1:1), education
-- history, professional experiences, certifications, documents (URI only —
-- binaries NEVER in DB), and 5 evidence tables (person/skill/learning/kpi/
-- assessment evidence) used by gap analysis + KPI cascading.
--
-- All tables tenant-scoped + user-scoped + audit columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_user_profiles (1:1 with sys_users; extended attributes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_profiles (
  user_profile_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_user_id         uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_profile_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_profile_bio             text,
  user_profile_picture_uri     text,
  user_profile_phone           varchar(64),
  user_profile_linkedin_uri    text,
  user_profile_contact_prefs   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  user_profile_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  created_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_profiles_user_uq
  ON sys.sys_user_profiles (user_profile_user_id);

CREATE INDEX IF NOT EXISTS sys_user_profiles_tenant_idx
  ON sys.sys_user_profiles (user_profile_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_profiles_set_updated_at' AND tgrelid = 'sys.sys_user_profiles'::regclass) THEN
    CREATE TRIGGER sys_user_profiles_set_updated_at BEFORE UPDATE ON sys.sys_user_profiles FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_user_education_records (degree, institution, year, ESCO ref)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_education_records (
  user_education_record_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_education_record_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_education_record_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_education_degree           varchar(255) NOT NULL,
  user_education_institution      varchar(255) NOT NULL,
  user_education_field_of_study   varchar(255),
  user_education_start_date       date,
  user_education_end_date         date,
  user_education_grade            varchar(64),
  user_education_esco_qualification_uri text,
  user_education_metadata         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  created_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_education_user_idx
  ON sys.sys_user_education_records (user_education_record_user_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_education_set_updated_at' AND tgrelid = 'sys.sys_user_education_records'::regclass) THEN
    CREATE TRIGGER sys_user_education_set_updated_at BEFORE UPDATE ON sys.sys_user_education_records FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 3. sys.sys_user_professional_experiences (roles outside the tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_professional_experiences (
  user_prof_exp_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_prof_exp_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_prof_exp_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_prof_exp_employer    varchar(255) NOT NULL,
  user_prof_exp_role_title  varchar(255) NOT NULL,
  user_prof_exp_industry    varchar(128),
  user_prof_exp_start_date  date         NOT NULL,
  user_prof_exp_end_date    date,
  user_prof_exp_description text,
  user_prof_exp_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  created_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  updated_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_prof_exp_user_idx
  ON sys.sys_user_professional_experiences (user_prof_exp_user_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_prof_exp_set_updated_at' AND tgrelid = 'sys.sys_user_professional_experiences'::regclass) THEN
    CREATE TRIGGER sys_user_prof_exp_set_updated_at BEFORE UPDATE ON sys.sys_user_professional_experiences FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 4. sys.sys_user_certifications (issuer, dates, document URI)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_certifications (
  user_certification_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_certification_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_certification_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_certification_name          varchar(255) NOT NULL,
  user_certification_issuer        varchar(255) NOT NULL,
  user_certification_issued_date   date,
  user_certification_expires_date  date,
  user_certification_credential_id varchar(255),
  user_certification_document_uri  text,
  user_certification_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  created_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_certifications_user_idx
  ON sys.sys_user_certifications (user_certification_user_id);

CREATE INDEX IF NOT EXISTS sys_user_certifications_expires_idx
  ON sys.sys_user_certifications (user_certification_expires_date)
  WHERE user_certification_expires_date IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_certifications_set_updated_at' AND tgrelid = 'sys.sys_user_certifications'::regclass) THEN
    CREATE TRIGGER sys_user_certifications_set_updated_at BEFORE UPDATE ON sys.sys_user_certifications FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 5. sys.sys_user_documents (URI metadata only; binaries NEVER in DB)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_documents (
  user_document_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_document_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_document_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_document_kind        varchar(64)  NOT NULL DEFAULT 'OTHER',
  user_document_title       varchar(255) NOT NULL,
  user_document_uri         text         NOT NULL,
  user_document_mime_type   varchar(128),
  user_document_size_bytes  bigint,
  user_document_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  created_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  updated_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_user_documents
  DROP CONSTRAINT IF EXISTS sys_user_documents_kind_check;
ALTER TABLE sys.sys_user_documents
  ADD CONSTRAINT sys_user_documents_kind_check
  CHECK (user_document_kind IN ('CV', 'CERTIFICATE', 'CONTRACT_REFERENCE', 'TRAINING_RECORD', 'EVIDENCE_PROOF', 'OTHER'));

CREATE INDEX IF NOT EXISTS sys_user_documents_user_idx
  ON sys.sys_user_documents (user_document_user_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_documents_set_updated_at' AND tgrelid = 'sys.sys_user_documents'::regclass) THEN
    CREATE TRIGGER sys_user_documents_set_updated_at BEFORE UPDATE ON sys.sys_user_documents FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 6. sys.sys_person_evidence_records (generic anchor; polymorphic via type)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_person_evidence_records (
  person_evidence_record_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  person_evidence_record_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  person_evidence_record_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  person_evidence_type             varchar(64)  NOT NULL,
  person_evidence_resource_type    varchar(64),
  person_evidence_resource_id      uuid,
  person_evidence_source           varchar(64)  NOT NULL DEFAULT 'MANAGER_ASSESSMENT',
  person_evidence_recorded_at      timestamptz  NOT NULL DEFAULT now(),
  person_evidence_recorded_by      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  person_evidence_payload          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_at                       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_person_evidence_records
  DROP CONSTRAINT IF EXISTS sys_person_evidence_type_check;
ALTER TABLE sys.sys_person_evidence_records
  ADD CONSTRAINT sys_person_evidence_type_check
  CHECK (person_evidence_type IN ('SKILL', 'LEARNING', 'KPI', 'ASSESSMENT', 'CERTIFICATION', 'BEHAVIORAL'));

ALTER TABLE sys.sys_person_evidence_records
  DROP CONSTRAINT IF EXISTS sys_person_evidence_source_check;
ALTER TABLE sys.sys_person_evidence_records
  ADD CONSTRAINT sys_person_evidence_source_check
  CHECK (person_evidence_source IN (
    'MANAGER_ASSESSMENT', 'THREE_SIXTY_ASSESSMENT', 'CERTIFICATION_VERIFIED',
    'SELF_ASSESSMENT', 'TRAINING_COMPLETION_REASSESSMENT', 'EXTERNAL_VALIDATOR', 'AI_INFERRED'
  ));

CREATE INDEX IF NOT EXISTS sys_person_evidence_user_idx
  ON sys.sys_person_evidence_records (person_evidence_record_user_id, person_evidence_recorded_at DESC);

CREATE INDEX IF NOT EXISTS sys_person_evidence_resource_idx
  ON sys.sys_person_evidence_records (person_evidence_resource_type, person_evidence_resource_id)
  WHERE person_evidence_resource_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 7. sys.sys_user_skill_evidence (skill mastery evidence)
-- -----------------------------------------------------------------------------
-- NOTE: FK to sys.sys_skills added in 000013 (skill catalog created later).
-- For now, user_skill_evidence_skill_id is a uuid column with no FK; the FK
-- is added by 000013 via `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS`
-- (we use a guarded DO block since ADD CONSTRAINT is not idempotent).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_skill_evidence (
  user_skill_evidence_id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_skill_evidence_user_id               uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_skill_evidence_tenant_id             uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_skill_evidence_skill_id              uuid         NOT NULL,
  user_skill_evidence_declared_proficiency  varchar(32)  NOT NULL,
  user_skill_evidence_source                varchar(64)  NOT NULL,
  user_skill_evidence_assessed_at           timestamptz  NOT NULL DEFAULT now(),
  user_skill_evidence_assessor_user_id      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_skill_evidence_score                 numeric(5,2),
  user_skill_evidence_comment               text,
  user_skill_evidence_metadata              jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                                timestamptz  NOT NULL DEFAULT now(),
  created_by                                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                                timestamptz  NOT NULL DEFAULT now(),
  updated_by                                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_user_skill_evidence
  DROP CONSTRAINT IF EXISTS sys_user_skill_evidence_proficiency_check;
ALTER TABLE sys.sys_user_skill_evidence
  ADD CONSTRAINT sys_user_skill_evidence_proficiency_check
  CHECK (user_skill_evidence_declared_proficiency IN ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

ALTER TABLE sys.sys_user_skill_evidence
  DROP CONSTRAINT IF EXISTS sys_user_skill_evidence_source_check;
ALTER TABLE sys.sys_user_skill_evidence
  ADD CONSTRAINT sys_user_skill_evidence_source_check
  CHECK (user_skill_evidence_source IN (
    'MANAGER_ASSESSMENT', 'THREE_SIXTY_ASSESSMENT', 'CERTIFICATION_VERIFIED',
    'SELF_ASSESSMENT', 'TRAINING_COMPLETION_REASSESSMENT', 'EXTERNAL_VALIDATOR', 'AI_INFERRED'
  ));

CREATE INDEX IF NOT EXISTS sys_user_skill_evidence_user_skill_idx
  ON sys.sys_user_skill_evidence (user_skill_evidence_user_id, user_skill_evidence_skill_id, user_skill_evidence_assessed_at DESC);

CREATE INDEX IF NOT EXISTS sys_user_skill_evidence_tenant_idx
  ON sys.sys_user_skill_evidence (user_skill_evidence_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_skill_evidence_set_updated_at' AND tgrelid = 'sys.sys_user_skill_evidence'::regclass) THEN
    CREATE TRIGGER sys_user_skill_evidence_set_updated_at BEFORE UPDATE ON sys.sys_user_skill_evidence FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 8. sys.sys_user_learning_evidence (completion records)
-- -----------------------------------------------------------------------------
-- NOTE: FK to sys.sys_learning_modules added in 000016.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_learning_evidence (
  user_learning_evidence_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_learning_evidence_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_learning_evidence_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_learning_evidence_module_id     uuid         NOT NULL,
  user_learning_evidence_completed_at  timestamptz  NOT NULL DEFAULT now(),
  user_learning_evidence_score         numeric(5,2),
  user_learning_evidence_certificate_uri text,
  user_learning_evidence_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now(),
  created_by                           uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                           timestamptz  NOT NULL DEFAULT now(),
  updated_by                           uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_learning_evidence_user_module_idx
  ON sys.sys_user_learning_evidence (user_learning_evidence_user_id, user_learning_evidence_module_id, user_learning_evidence_completed_at DESC);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_learning_evidence_set_updated_at' AND tgrelid = 'sys.sys_user_learning_evidence'::regclass) THEN
    CREATE TRIGGER sys_user_learning_evidence_set_updated_at BEFORE UPDATE ON sys.sys_user_learning_evidence FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 9. sys.sys_user_kpi_evidence (KPI measurement evidence per person)
-- -----------------------------------------------------------------------------
-- NOTE: FK to sys.sys_kpi_definitions added in 000015.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_kpi_evidence (
  user_kpi_evidence_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_kpi_evidence_user_id        uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_kpi_evidence_tenant_id      uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_kpi_evidence_kpi_id         uuid         NOT NULL,
  user_kpi_evidence_period_start   date         NOT NULL,
  user_kpi_evidence_period_end     date         NOT NULL,
  user_kpi_evidence_measured_value numeric(18,4),
  user_kpi_evidence_target_value   numeric(18,4),
  user_kpi_evidence_unit           varchar(64),
  user_kpi_evidence_recorded_at    timestamptz  NOT NULL DEFAULT now(),
  user_kpi_evidence_metadata       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  created_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_kpi_evidence_user_kpi_idx
  ON sys.sys_user_kpi_evidence (user_kpi_evidence_user_id, user_kpi_evidence_kpi_id, user_kpi_evidence_period_end DESC);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_kpi_evidence_set_updated_at' AND tgrelid = 'sys.sys_user_kpi_evidence'::regclass) THEN
    CREATE TRIGGER sys_user_kpi_evidence_set_updated_at BEFORE UPDATE ON sys.sys_user_kpi_evidence FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 10. sys.sys_user_assessment_evidence (manager / 360 assessment results)
-- -----------------------------------------------------------------------------
-- NOTE: FK to sys.sys_assessments added in 000017.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_assessment_evidence (
  user_assessment_evidence_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_assessment_evidence_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_assessment_evidence_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_assessment_evidence_assessment_id uuid         NOT NULL,
  user_assessment_evidence_dimension     varchar(128) NOT NULL,
  user_assessment_evidence_score         numeric(5,2),
  user_assessment_evidence_narrative     text,
  user_assessment_evidence_assessor_user_id uuid      REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_assessment_evidence_recorded_at   timestamptz  NOT NULL DEFAULT now(),
  user_assessment_evidence_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                             timestamptz  NOT NULL DEFAULT now(),
  created_by                             uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                             timestamptz  NOT NULL DEFAULT now(),
  updated_by                             uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_assessment_evidence_user_assessment_idx
  ON sys.sys_user_assessment_evidence (user_assessment_evidence_user_id, user_assessment_evidence_assessment_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_assessment_evidence_set_updated_at' AND tgrelid = 'sys.sys_user_assessment_evidence'::regclass) THEN
    CREATE TRIGGER sys_user_assessment_evidence_set_updated_at BEFORE UPDATE ON sys.sys_user_assessment_evidence FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
