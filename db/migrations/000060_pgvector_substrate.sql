-- 000060_pgvector_substrate.sql
-- D7-P0 (AI capability ② — semantic matching, P0 substrate). Dossier
-- docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §6 (the "Schema changes" table).
--
-- Enables pgvector and ships the 4 EMPTY sidecar embedding tables + HNSW indexes that the
-- P1 Voyage pipeline will backfill. ZERO data write, zero Voyage call: tables ship empty.
-- No changes to existing sys.* business tables (preserves I1/I3/I4/I5/I7) — embeddings live
-- in NEW sidecar tables keyed 1:1 to their parent (sidecar keeps the hot tables narrow and
-- makes a re-embed a CASCADE-safe DELETE+re-INSERT, never an ALTER of the business row).
--
-- pgvector 0.8.2 is the packaged build already present on the OCI VM (ARM64) — verified live
-- (pg_available_extensions.name='vector', default_version 0.8.2, installed NULL). Enablement is
-- the per-DB CREATE EXTENSION below (mirrors 000001_init_extensions.sql).
--
-- Embedding dim = 1024 (voyage-3.5 default; Matryoshka-capable). model_id is stored per row so a
-- model switch is a clean re-embed, not a schema change. source_text_hash (sha256, P1-populated)
-- makes a re-backfill hash-skip to ~0 tokens.
--
-- PK convention mirrors the closest sibling — the 1:1 satellite sys_user_preferences (000053):
-- a surrogate uuid PRIMARY KEY + a UNIQUE NOT NULL business key (the parent FK, or the ESCO URI).
-- Audit cols are intentionally minimal (created_at only): these are derived/regenerable artifacts,
-- not hand-edited business rows, so the full created_by/updated_*/trigger satellite is unnecessary.
--
-- HNSW over IVFFlat: the corpus is small+static (skills ~22k, ESCO URIs, job_roles ~227) so HNSW
-- needs no lists/ANALYZE tuning; m=16 / ef_construction=64 are the pgvector defaults for this size.
--
-- Permission seed mirrors 000057 EXACTLY (same tables/columns, same CROSS JOIN + ON CONFLICT grant):
--   matching:read  -> the 6 admin roles 000057 granted analytics:view to, PLUS USER (D7-P1 OD-5:
--                     ESS self-scope — a user reads their own occupation/skill matches).
--   matching:admin -> PLATFORM_ADMIN + TENANT_ADMIN only (reindex/backfill is an admin action).
--
-- IDEMPOTENT: CREATE EXTENSION IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- INSERT ... ON CONFLICT DO NOTHING, guarded ADD CONSTRAINT (none needed here — no CHECKs). Running
-- the full set twice produces an empty pg_dump diff. Applied by migrate.{sh,ps1} under `psql -1 -f`.

-- -----------------------------------------------------------------------------
-- Extension enablement (mirrors 000001_init_extensions.sql).
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1) sys.sys_skill_embeddings — one vector per skill (FK sys_skills.skill_id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_skill_embeddings (
  skill_embedding_id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id                    uuid          NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  embedding                   vector(1024)  NOT NULL,
  model_id                    text          NOT NULL,
  source_text_hash            text,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sys_skill_embeddings_skill_uq UNIQUE (skill_id)
);

CREATE INDEX IF NOT EXISTS sys_skill_embeddings_hnsw_idx
  ON sys.sys_skill_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 2) sys.sys_esco_occupation_embeddings — one vector per distinct ESCO occupation URI.
--    Keyed by esco_uri (text), NOT a FK — the ESCO occupation taxonomy is an external
--    reference, embedded once per distinct URI (dossier §6).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_esco_occupation_embeddings (
  esco_occupation_embedding_id uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  esco_uri                     text          NOT NULL,
  embedding                    vector(1024)  NOT NULL,
  label_text                   text,
  isco_code                    text,
  model_id                     text          NOT NULL,
  source_text_hash             text,
  created_at                   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sys_esco_occupation_embeddings_uri_uq UNIQUE (esco_uri)
);

CREATE INDEX IF NOT EXISTS sys_esco_occupation_embeddings_hnsw_idx
  ON sys.sys_esco_occupation_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 3) sys.sys_job_role_embeddings — one vector per job role (FK sys_job_roles.job_role_id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_job_role_embeddings (
  job_role_embedding_id       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_id                 uuid          NOT NULL REFERENCES sys.sys_job_roles(job_role_id) ON DELETE CASCADE,
  embedding                   vector(1024)  NOT NULL,
  model_id                    text          NOT NULL,
  source_text_hash            text,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sys_job_role_embeddings_job_role_uq UNIQUE (job_role_id)
);

CREATE INDEX IF NOT EXISTS sys_job_role_embeddings_hnsw_idx
  ON sys.sys_job_role_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 4) sys.sys_user_profile_embeddings — one MEAN-POOLED vector per user (FK sys_users.user_id).
--    DERIVED from the user's skill-evidence vectors (never a Voyage call). tenant_id carried for
--    I5 tenant isolation (FK+middleware filter, matches sys_users.user_tenant_id uuid NOT NULL).
--    derived_from_evidence_count surfaces sparsity honestly (0-evidence users -> real empty-state).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_profile_embeddings (
  user_profile_embedding_id    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      uuid          NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  tenant_id                    uuid          NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  embedding                    vector(1024)  NOT NULL,
  derived_from_evidence_count  integer       NOT NULL DEFAULT 0,
  model_id                     text          NOT NULL,
  created_at                   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sys_user_profile_embeddings_user_uq UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS sys_user_profile_embeddings_tenant_idx
  ON sys.sys_user_profile_embeddings (tenant_id);

CREATE INDEX IF NOT EXISTS sys_user_profile_embeddings_hnsw_idx
  ON sys.sys_user_profile_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- Permission seed (mirrors 000057_analytics_permission_seed.sql EXACTLY).
--   matching:read  — read own/scoped semantic matches (ESS + admin surfaces).
--   matching:admin — trigger reindex/backfill (admin only).
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('matching:read',  'View semantic matches',          'matching', 'read'),
  ('matching:admin', 'Manage semantic match reindex',  'matching', 'admin')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- matching:read -> the 6 admin roles 000057 granted analytics:view to, PLUS the USER role (OD-5 ESS).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'matching:read'
  AND r.auth_role_code IN (
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'BLUEPRINT_MANAGER',
    'HRMS_MANAGER',
    'PROCESS_OWNER',
    'MANAGER',
    'USER'
  )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- matching:admin -> platform + tenant admins only (reindex is an admin action).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'matching:admin'
  AND r.auth_role_code IN (
    'PLATFORM_ADMIN',
    'TENANT_ADMIN'
  )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Guarded assertion (mirrors 000059's DO-block style: RAISE EXCEPTION on mismatch).
-- Runs inside the migration's single transaction (`psql -1 -f`) so a failure aborts cleanly.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  ext_present  boolean;
  tbl_count    int;
  read_grants  int;
  admin_grants int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO ext_present;
  IF NOT ext_present THEN
    RAISE EXCEPTION 'D7-P0: pgvector extension (vector) is not installed after CREATE EXTENSION';
  END IF;

  SELECT count(*) INTO tbl_count
  FROM information_schema.tables
  WHERE table_schema = 'sys'
    AND table_name IN (
      'sys_skill_embeddings',
      'sys_esco_occupation_embeddings',
      'sys_job_role_embeddings',
      'sys_user_profile_embeddings'
    );
  IF tbl_count <> 4 THEN
    RAISE EXCEPTION 'D7-P0: expected 4 embedding tables, found %', tbl_count;
  END IF;

  SELECT count(*) INTO read_grants
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
  WHERE p.auth_permission_code = 'matching:read';
  IF read_grants <> 7 THEN
    RAISE EXCEPTION 'D7-P0: expected 7 matching:read grants (6 analytics roles + USER), found %', read_grants;
  END IF;

  SELECT count(*) INTO admin_grants
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
  WHERE p.auth_permission_code = 'matching:admin';
  IF admin_grants <> 2 THEN
    RAISE EXCEPTION 'D7-P0: expected 2 matching:admin grants (platform + tenant admin), found %', admin_grants;
  END IF;

  RAISE NOTICE 'D7-P0: pgvector substrate ready — 4 embedding tables, matching:read=% grants, matching:admin=% grants.', read_grants, admin_grants;
END $$;
