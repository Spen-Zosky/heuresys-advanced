#!/usr/bin/env bash
# db/scripts/import-d1-user-skills.sh
#
# #46 D/D1 — imports per-employee SKILL POSSESSION from the legacy
# `heuresys_platform` (employee_skills) into sys.sys_user_skills.
#
# Wave-1 imported the skill TAXONOMY but not the POSSESSION: the platform knew
# which skills exist and which a position requires, but not who actually has
# them — so skill-gap and people-analytics had requirements with no counterpart.
#
# TWO CROSSWALKS, both measured live before this script was written:
#   - skill:    legacy esco_skills.uri  →  sys_skills.skill_esco_uri   (61/61 resolve)
#   - employee: 'LEGACY_EMP::' || employees.id → sys_users.user_external_code (I14,
#               employee-centric doctrine) — covers 156 of 162 advanced users (96.3%).
#     The legacy holds MORE employees (264 with skills) than the advanced RTL subset
#     by design (S950 rebuild), so unmatched legacy employees are expected, not an error.
#
# PROFICIENCY (Enzo 2026-07-19): legacy carries BOTH `proficiency_level` (int 1-5) and
# `proficiency_label` (free bilingual text) and they DISAGREE on 457 of 1445 rows (32%).
# The NUMERIC is authoritative; it maps onto sys_skill_proficiency_levels by RANK
# (1 NOVICE, 2 BASIC, 3 COMPETENT, 4 PROFICIENT, 5 EXPERT — MASTER/6 unused, the legacy
# has no sixth level). The original label is preserved in the row metadata so the
# decision can be reversed without re-extracting.
#
# IDEMPOTENT: staged into a TEMP table, then upserted on the legacy row id
# (user_skill_external_code). Re-running updates in place; it never duplicates.
#
# Usage:  bash db/scripts/import-d1-user-skills.sh [--dry-run]
# Prereqs: SSH alias `oracle-vm-default`; local .env for the advanced DB (tunnel :5433).
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
set -a; . "${REPO_ROOT}/.env"; set +a
PSQL=(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1)

STAGE_TSV="$(mktemp)"
trap 'rm -f "${STAGE_TSV}"' EXIT
# `psql` is a WINDOWS binary under Git Bash, so it cannot resolve the MSYS /tmp path
# that mktemp returns — \copy would fail with "No such file or directory". Translate it
# when cygpath is available; on Linux/Mac (VM) the path is already native.
if command -v cygpath >/dev/null 2>&1; then
  STAGE_TSV_PSQL="$(cygpath -w "${STAGE_TSV}")"
else
  STAGE_TSV_PSQL="${STAGE_TSV}"
fi

echo "[d1] extracting skill possession from the legacy DB…"
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -tAF$'\t' -c \"
  SELECT es.id,
         es.employee_id,
         e.uri,
         es.proficiency_level,
         coalesce(es.proficiency_label,''),
         coalesce(es.years_experience::text,''),
         es.is_primary,
         es.is_verified,
         coalesce(es.source,''),
         coalesce(es.confidence_score::text,''),
         coalesce(es.last_used_at::text,'')
    FROM employee_skills es
    JOIN esco_skills e ON e.id = es.esco_skill_id
   WHERE es.esco_skill_id IS NOT NULL
\"" > "${STAGE_TSV}"

ROWS=$(wc -l < "${STAGE_TSV}" | tr -d ' ')
echo "[d1] extracted ${ROWS} legacy rows"
[[ "${ROWS}" -eq 0 ]] && { echo "[d1] ABORT: nothing extracted"; exit 1; }

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[d1] --dry-run: extraction only, nothing written."
  exit 0
fi

echo "[d1] staging + upserting…"
"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE stage_user_skills (
  legacy_id uuid, employee_id uuid, esco_uri text, proficiency_level int,
  proficiency_label text, years_experience text, is_primary boolean,
  is_verified boolean, source text, confidence text, last_used text
) ON COMMIT DROP;

\copy stage_user_skills FROM '${STAGE_TSV_PSQL}' WITH (FORMAT text, DELIMITER E'\t', NULL '')

-- Coverage BEFORE writing, so the numbers in the log are the real join result and
-- not an assumption about it.
\echo '--- crosswalk resolution ---'
SELECT count(*) AS legacy_rows,
       count(*) FILTER (WHERE s.skill_id IS NOT NULL)               AS skill_resolved,
       count(*) FILTER (WHERE u.user_id IS NOT NULL)                AS user_resolved,
       count(*) FILTER (WHERE s.skill_id IS NOT NULL
                          AND u.user_id IS NOT NULL)                AS importable
  FROM stage_user_skills st
  LEFT JOIN sys.sys_skills s ON s.skill_esco_uri = st.esco_uri
  LEFT JOIN sys.sys_users  u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text;

INSERT INTO sys.sys_user_skills AS t (
  user_skill_tenant_id, user_skill_user_id, user_skill_skill_id,
  user_skill_proficiency, user_skill_years_experience, user_skill_is_primary,
  user_skill_is_verified, user_skill_source, user_skill_confidence,
  user_skill_last_used_on, user_skill_external_code, user_skill_metadata
)
SELECT u.user_tenant_id,
       u.user_id,
       s.skill_id,
       -- numeric rank → advanced vocabulary (Enzo 2026-07-19: numeric authoritative)
       CASE st.proficiency_level
         WHEN 1 THEN 'NOVICE' WHEN 2 THEN 'BASIC' WHEN 3 THEN 'COMPETENT'
         WHEN 4 THEN 'PROFICIENT' WHEN 5 THEN 'EXPERT' ELSE 'COMPETENT' END,
       nullif(st.years_experience,'')::numeric,
       coalesce(st.is_primary,false),
       coalesce(st.is_verified,false),
       upper(coalesce(nullif(st.source,''),'SELF_ASSESSMENT')),
       nullif(st.confidence,'')::numeric,
       nullif(st.last_used,'')::date,
       'LEGACY_ES::' || st.legacy_id::text,
       jsonb_build_object(
         'legacy_proficiency_label', st.proficiency_label,
         'legacy_proficiency_level', st.proficiency_level,
         'import', 'D1'
       )
  FROM stage_user_skills st
  JOIN sys.sys_skills s ON s.skill_esco_uri = st.esco_uri
  JOIN sys.sys_users  u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text
 -- A user may hold the same ESCO skill twice in the legacy; keep the HIGHEST level.
 -- Compared by RANK, not with GREATEST(): these are varchars, so GREATEST would order
 -- them alphabetically and silently prefer 'NOVICE' over 'EXPERT'.
 ON CONFLICT (user_skill_user_id, user_skill_skill_id) DO UPDATE
   SET user_skill_proficiency      = CASE
         WHEN array_position(ARRAY['NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER'],
                             EXCLUDED.user_skill_proficiency)
            > array_position(ARRAY['NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER'],
                             t.user_skill_proficiency)
         THEN EXCLUDED.user_skill_proficiency ELSE t.user_skill_proficiency END,
       user_skill_years_experience = coalesce(EXCLUDED.user_skill_years_experience, t.user_skill_years_experience),
       user_skill_is_verified      = t.user_skill_is_verified OR EXCLUDED.user_skill_is_verified,
       user_skill_metadata         = t.user_skill_metadata || EXCLUDED.user_skill_metadata,
       updated_at                  = now();

\echo '--- imported state ---'
SELECT count(*) AS rows_in_sys_user_skills,
       count(DISTINCT user_skill_user_id) AS users_covered,
       count(DISTINCT user_skill_skill_id) AS skills_covered
  FROM sys.sys_user_skills;

COMMIT;
SQL

echo "[d1] done."
