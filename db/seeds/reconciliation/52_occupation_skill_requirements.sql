-- 52_occupation_skill_requirements.sql — T1.2 (S990): import the legacy ESCO occupation->skill
--   relation (126051 rows) into sys.sys_occupation_skill_requirements (mig 000123).
-- ----------------------------------------------------------------------------------------------
-- Source (committed, CI-reproducible — both pg_dump data-only files live in the repo):
--   db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupation_skills.sql
--     = public.esco_occupation_skills (id, occupation_id, skill_id, relation_type, created_at),
--       126051 rows; relation_type in {essential (67600), optional (58451)}.
--   db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupations.sql
--     = public.esco_occupations (id, uri, ...) — gives occupation_id -> ESCO uri (3040 rows, 1:1).
-- Resolution (verified live: 100% — 0 dropped):
--   skill_id  -> sys_skills via skill_code = 'OLDDB::esco_skills::' || skill_id -> skill_id + skill_esco_uri
--   occ_id    -> esco_occupations.uri
--   relation  -> upper-case ('essential'->'ESSENTIAL', 'optional'->'OPTIONAL')
-- Mechanism (NO public pollution after run): guarded DROP+CREATE the 2 public.esco_* STAGING
--   tables (data-only dumps INSERT into public.* with search_path=''), \i the dumps, INSERT ...
--   SELECT ... ON CONFLICT (occupation_uri, skill_esco_uri) DO NOTHING, then DROP the staging
--   tables. Idempotent: ON CONFLICT DO NOTHING + re-run = 0 new rows. Single explicit txn.
-- Run from repo root:
--   PGPASSWORD=... psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
--     -v ON_ERROR_STOP=1 -f db/seeds/reconciliation/52_occupation_skill_requirements.sql
-- Sibling pattern: 40_org_unit_kpi_templates.sql / 51_engagement_feedback.sql.
-- ----------------------------------------------------------------------------------------------
\set ON_ERROR_STOP on
BEGIN;

-- §1 — Staging tables in public (matching the data-only dump INSERT targets).
--   embedding_* columns typed text (the dump emits '[...]' string literals) to avoid a pgvector
--   dependency in staging — we never read them. DROP-first makes the load idempotent.
DROP TABLE IF EXISTS public.esco_occupation_skills;
DROP TABLE IF EXISTS public.esco_occupations;

CREATE TABLE public.esco_occupation_skills (
  id            uuid,
  occupation_id uuid,
  skill_id      uuid,
  relation_type text,
  created_at    timestamptz
);

CREATE TABLE public.esco_occupations (
  id                     uuid,
  uri                    text,
  preferred_label        text,
  description            text,
  isco_code              text,
  nace_codes             text,
  created_at             timestamptz,
  embedding_en           text,
  embedding_it           text,
  embedding_model        text,
  embedding_generated_at timestamptz,
  preferred_label_en     text,
  preferred_label_it     text,
  code                   text,
  description_en         text,
  description_it         text,
  parent_uri             text,
  level                  text,
  alt_labels             text,
  alt_labels_it          text
);

-- §2 — Load the committed dumps (data-only INSERTs into public.esco_*).
--   The dumps run `SELECT pg_catalog.set_config('search_path','',false)`; their INSERTs are
--   fully-qualified public.* so they target our staging tables regardless.
\i db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupations.sql
\i db/seeds/brownfield/wave1/legacy_data/wave1_eskap_esco_occupation_skills.sql

-- The dumps left search_path='' — restore it for the qualified-but-defensive INSERT below.
SET search_path = sys, public;

-- §3 — IMPORT: resolve + insert. Occupation must resolve (uri) and skill must resolve
--   (sys_skills via OLDDB prefix) — both are 100% per the live audit, so this is an inner JOIN.
--   metadata keeps the legacy ids for lineage (I14 doctrine: never drop the legacy key).
INSERT INTO sys.sys_occupation_skill_requirements (
  occupation_skill_req_occupation_uri,
  occupation_skill_req_skill_id,
  occupation_skill_req_skill_esco_uri,
  occupation_skill_req_relation,
  occupation_skill_req_is_global,
  occupation_skill_req_metadata
)
SELECT
  o.uri,
  s.skill_id,
  s.skill_esco_uri,
  CASE os.relation_type WHEN 'essential' THEN 'ESSENTIAL' WHEN 'optional' THEN 'OPTIONAL' END,
  true,
  jsonb_build_object(
    'source', 'esco_occupation_skills',
    'legacy_occupation_id', os.occupation_id::text,
    'legacy_skill_id', os.skill_id::text,
    'legacy_relation_type', os.relation_type
  )
FROM public.esco_occupation_skills os
JOIN public.esco_occupations o ON o.id = os.occupation_id
JOIN sys.sys_skills s ON s.skill_code = 'OLDDB::esco_skills::' || os.skill_id::text
WHERE os.relation_type IN ('essential', 'optional')
ON CONFLICT (occupation_skill_req_occupation_uri, occupation_skill_req_skill_esco_uri) DO NOTHING;

-- §4 — Drop the staging tables: leave NO pollution in public.
DROP TABLE public.esco_occupation_skills;
DROP TABLE public.esco_occupations;

-- §5 — In-transaction sanity (does not block re-run; counts are cumulative on the target).
DO $$
DECLARE n_total int; n_ess int; n_opt int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE occupation_skill_req_relation = 'ESSENTIAL'),
         count(*) FILTER (WHERE occupation_skill_req_relation = 'OPTIONAL')
    INTO n_total, n_ess, n_opt
    FROM sys.sys_occupation_skill_requirements;
  RAISE NOTICE '52_occupation_skill_requirements: target now total=% essential=% optional=%', n_total, n_ess, n_opt;
END $$;

COMMIT;
