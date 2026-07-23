#!/usr/bin/env bash
# db/scripts/import-d2-engagement.sh
#
# #47 D/D2 — completes the ENGAGEMENT history import from the legacy
# `heuresys_platform` and registers the whole D-series wave-2 in the
# brownfield registry (`brownfield.table_mappings` had 0 wave-2 rows).
#
# MEASURED LIVE before writing this script (S1028, 2026-07-23):
#   - the three "core" engagement domains are ALREADY imported and COMPLETE
#     against the I14 crosswalk (matchable rows == imported rows):
#       survey_responses             4482 legacy → 3792 matchable = 3792 in sys  ✓
#       engagement_survey_responses  1327 legacy →  862 matchable =  862 in sys  ✓
#       pulse_checks                 1145 legacy →  733 matchable =  733 in sys  ✓
#     (the register note "oggi solo seed sintetici" was STALE — the rows carry
#     LEGACY_SR:: / LEGACY_ESRES:: / LEGACY_PC:: natural keys.)
#   - the TRUE residual is the two mood-bearing domains never imported:
#       check_ins          2495 legacy (1621 matchable; employee_mood 3-5,
#                          employee_engagement all NULL, all status=completed)
#       wellbeing_checkins 1142 legacy (480 matchable; mood/energy/stress/wlb/sleep 1-5)
#
# TARGET: sys.sys_pulse_checks — the only mood-bearing table the flight-risk
# engagement CTE reads (insights/repository.ts eng_src source 3). Distinct
# natural-key prefixes keep provenance separable:
#   LEGACY_CI::<check_ins.id>          mood_score = employee_mood
#   LEGACY_WB::<wellbeing_checkins.id> mood_score = mood_score, comment = notes
# The non-mood wellbeing dimensions (energy/stress/work-life-balance/sleep) and
# the check-in meeting facts (type/duration/completed_at) are preserved in the
# row metadata — reversible without re-extracting. workload/satisfaction stay
# NULL: no semantic force-fit.
#
# CROSSWALK: I14 'LEGACY_EMP::' || employee_id → sys_users.user_external_code.
# Unmatched legacy employees are EXPECTED (legacy holds more employees than the
# S950 advanced subset), not an error — same doctrine as D1.
#
# REGISTRY (wave-2, sana il caveat "0 righe wave-2"):
#   - new brownfield.source_exports row 'legacy-live-wave2-D' (live PG extract,
#     not a zip bundle — sweep S1016 provenance)
#   - brownfield.source_tables + table_mappings (wave=2, APPROVED) for the full
#     D-series state: employee_skills→sys_user_skills (D1, imported),
#     surveys/engagement_surveys/survey_responses/engagement_survey_responses/
#     pulse_checks (imported pre-S1028), check_ins+wellbeing_checkins→sys_pulse_checks
#     (THIS import).
#
# IDEMPOTENT: upsert on natural key; registry upserts guarded. Re-run = update
# in place, never duplicates.
#
# Usage:  bash db/scripts/import-d2-engagement.sh [--dry-run]
# Prereqs: SSH alias `oracle-vm-default`; local .env for the advanced DB (tunnel :5433).
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
set -a; . "${REPO_ROOT}/.env"; set +a
PSQL=(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1)

CI_TSV="$(mktemp)"; WB_TSV="$(mktemp)"
trap 'rm -f "${CI_TSV}" "${WB_TSV}"' EXIT
if command -v cygpath >/dev/null 2>&1; then
  CI_TSV_PSQL="$(cygpath -w "${CI_TSV}")"; WB_TSV_PSQL="$(cygpath -w "${WB_TSV}")"
else
  CI_TSV_PSQL="${CI_TSV}"; WB_TSV_PSQL="${WB_TSV}"
fi

echo "[d2] extracting check_ins (mood-bearing) from the legacy DB…"
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -tAF$'\t' -c \"
  SELECT id, employee_id, scheduled_date::date,
         coalesce(meeting_type,''), coalesce(duration_minutes::text,''),
         employee_mood, coalesce(completed_at::text,'')
    FROM check_ins
   WHERE employee_mood IS NOT NULL
\"" > "${CI_TSV}"

echo "[d2] extracting wellbeing_checkins from the legacy DB…"
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -tAF$'\t' -c \"
  SELECT id, employee_id, checkin_date,
         mood_score, coalesce(energy_level::text,''), coalesce(stress_level::text,''),
         coalesce(work_life_balance::text,''), coalesce(sleep_quality::text,''),
         coalesce(is_anonymous::text,'false'),
         coalesce(regexp_replace(notes, E'[\\n\\r\\t]+', ' ', 'g'),'')
    FROM wellbeing_checkins
   WHERE mood_score IS NOT NULL
\"" > "${WB_TSV}"

CI_ROWS=$(wc -l < "${CI_TSV}" | tr -d ' ')
WB_ROWS=$(wc -l < "${WB_TSV}" | tr -d ' ')
echo "[d2] extracted: check_ins=${CI_ROWS}  wellbeing=${WB_ROWS}"
[[ "${CI_ROWS}" -eq 0 || "${WB_ROWS}" -eq 0 ]] && { echo "[d2] ABORT: empty extraction"; exit 1; }

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[d2] --dry-run: extraction only, nothing written."
  exit 0
fi

echo "[d2] staging + upserting…"
"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE stage_ci (
  legacy_id uuid, employee_id uuid, check_date date, meeting_type text,
  duration_minutes text, mood int, completed_at text
) ON COMMIT DROP;
\copy stage_ci FROM '${CI_TSV_PSQL}' WITH (FORMAT text, DELIMITER E'\t', NULL '')

CREATE TEMP TABLE stage_wb (
  legacy_id uuid, employee_id uuid, check_date date, mood int, energy text,
  stress text, wlb text, sleep text, is_anonymous text, notes text
) ON COMMIT DROP;
\copy stage_wb FROM '${WB_TSV_PSQL}' WITH (FORMAT text, DELIMITER E'\t', NULL '')

\echo '--- crosswalk resolution (before writing) ---'
SELECT 'check_ins' AS dom, count(*) AS legacy_rows,
       count(*) FILTER (WHERE u.user_id IS NOT NULL) AS importable
  FROM stage_ci st
  LEFT JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text
UNION ALL
SELECT 'wellbeing', count(*),
       count(*) FILTER (WHERE u.user_id IS NOT NULL)
  FROM stage_wb st
  LEFT JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text;

-- 1:1 check-ins → pulse rows (mood signal; meeting facts in metadata)
INSERT INTO sys.sys_pulse_checks AS t (
  pulse_check_id, pulse_check_tenant_id, pulse_check_subject_user_id,
  pulse_check_natural_key, pulse_check_mood_score, pulse_check_date,
  pulse_check_week_number, pulse_check_metadata
)
SELECT uuid_generate_v5(uuid_ns_url(), 'LEGACY_CI::' || st.legacy_id::text),
       u.user_tenant_id, u.user_id,
       'LEGACY_CI::' || st.legacy_id::text,
       st.mood, st.check_date,
       extract(week FROM st.check_date)::int,
       jsonb_build_object(
         'import', 'D2', 'source', 'check_in',
         'meeting_type', nullif(st.meeting_type,''),
         'duration_minutes', nullif(st.duration_minutes,'')::int,
         'completed_at', nullif(st.completed_at,'')
       )
  FROM stage_ci st
  JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text
ON CONFLICT (pulse_check_tenant_id, pulse_check_natural_key) DO UPDATE
  SET pulse_check_mood_score = EXCLUDED.pulse_check_mood_score,
      pulse_check_date       = EXCLUDED.pulse_check_date,
      pulse_check_metadata   = t.pulse_check_metadata || EXCLUDED.pulse_check_metadata;

-- wellbeing check-ins → pulse rows (mood + subject's own note; other dims in metadata)
INSERT INTO sys.sys_pulse_checks AS t (
  pulse_check_id, pulse_check_tenant_id, pulse_check_subject_user_id,
  pulse_check_natural_key, pulse_check_mood_score, pulse_check_comment,
  pulse_check_date, pulse_check_week_number, pulse_check_metadata
)
SELECT uuid_generate_v5(uuid_ns_url(), 'LEGACY_WB::' || st.legacy_id::text),
       u.user_tenant_id, u.user_id,
       'LEGACY_WB::' || st.legacy_id::text,
       st.mood, nullif(st.notes,''),
       st.check_date,
       extract(week FROM st.check_date)::int,
       jsonb_build_object(
         'import', 'D2', 'source', 'wellbeing_checkin',
         'energy_level', nullif(st.energy,'')::int,
         'stress_level', nullif(st.stress,'')::int,
         'work_life_balance', nullif(st.wlb,'')::int,
         'sleep_quality', nullif(st.sleep,'')::int,
         'is_anonymous', st.is_anonymous::boolean
       )
  FROM stage_wb st
  JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text
ON CONFLICT (pulse_check_tenant_id, pulse_check_natural_key) DO UPDATE
  SET pulse_check_mood_score = EXCLUDED.pulse_check_mood_score,
      pulse_check_comment    = EXCLUDED.pulse_check_comment,
      pulse_check_date       = EXCLUDED.pulse_check_date,
      pulse_check_metadata   = t.pulse_check_metadata || EXCLUDED.pulse_check_metadata;

-- ---------------------------------------------------------------------------
-- Wave-2 registry (D-series): export → source_tables → table_mappings
-- ---------------------------------------------------------------------------
INSERT INTO brownfield.source_exports
  (source_export_id, source_export_name, source_export_retrieved_at,
   source_export_status, source_export_metadata)
VALUES
  (uuid_generate_v5(uuid_ns_url(), 'brownfield-export:legacy-live-wave2-D'),
   'legacy-live-wave2-D', TIMESTAMPTZ '2026-07-23 00:00:00+00', 'INGESTED',
   jsonb_build_object(
     'notes', 'Wave-2 D-series: live extraction from legacy PG heuresys_platform on the VM (no zip bundle). Provenance: sweep legacy:primary S1016.',
     'method', 'ssh + psql live extract',
     'scripts', jsonb_build_array('db/scripts/import-d1-user-skills.sh',
                                  'db/scripts/import-d2-engagement.sh')))
ON CONFLICT (source_export_id) DO NOTHING;

INSERT INTO brownfield.source_tables
  (source_table_id, source_table_export_id, source_table_schema, source_table_name,
   source_table_rls_enabled, source_table_row_estimate, source_table_domain,
   source_table_classification, source_table_metadata)
SELECT uuid_generate_v5(uuid_ns_url(), 'brownfield-st:wave2:' || v.name),
       uuid_generate_v5(uuid_ns_url(), 'brownfield-export:legacy-live-wave2-D'),
       'public', v.name, false, v.rows, v.domain, 'IMPORT',
       jsonb_build_object('wave', 2, 'series', v.series)
FROM (VALUES
  ('employee_skills',             1445, 'SKILLS',     'D1'),
  ('surveys',                        8, 'ENGAGEMENT', 'D2'),
  ('engagement_surveys',             6, 'ENGAGEMENT', 'D2'),
  ('survey_responses',            4482, 'ENGAGEMENT', 'D2'),
  ('engagement_survey_responses', 1327, 'ENGAGEMENT', 'D2'),
  ('pulse_checks',                1145, 'ENGAGEMENT', 'D2'),
  ('check_ins',                   2495, 'ENGAGEMENT', 'D2'),
  ('wellbeing_checkins',          1142, 'ENGAGEMENT', 'D2')
) v(name, rows, domain, series)
ON CONFLICT (source_table_id) DO NOTHING;

INSERT INTO brownfield.table_mappings
  (table_mapping_id, table_mapping_source_table_id, table_mapping_target_schema,
   table_mapping_target_table, table_mapping_classification,
   table_mapping_approval_status, table_mapping_rationale, table_mapping_metadata,
   table_mapping_wave)
SELECT uuid_generate_v5(uuid_ns_url(), 'brownfield-tm:wave2:' || v.src || '->' || v.tgt),
       uuid_generate_v5(uuid_ns_url(), 'brownfield-st:wave2:' || v.src),
       'sys', v.tgt, 'IMPORT', 'APPROVED', v.rationale,
       jsonb_build_object('wave', 2, 'series', v.series, 'session', 'S1028'),
       2
FROM (VALUES
  ('employee_skills', 'sys_user_skills', 'D1',
   '#46 D/D1: skill possession per-employee; crosswalk ESCO uri + LEGACY_EMP:: (I14). Imported via import-d1-user-skills.sh.'),
  ('surveys', 'sys_surveys', 'D2',
   '#47 D/D2: survey headers (LEGACY_SURVEY:: natural keys, imported pre-S1028).'),
  ('engagement_surveys', 'sys_engagement_surveys', 'D2',
   '#47 D/D2: engagement survey headers (LEGACY_ESURV::, imported pre-S1028).'),
  ('survey_responses', 'sys_survey_responses', 'D2',
   '#47 D/D2: per-question responses (LEGACY_SR::, imported pre-S1028; 3792/4482 = all crosswalk-matchable).'),
  ('engagement_survey_responses', 'sys_engagement_survey_responses', 'D2',
   '#47 D/D2: engagement responses jsonb (LEGACY_ESRES::, imported pre-S1028; 862 = all matchable).'),
  ('pulse_checks', 'sys_pulse_checks', 'D2',
   '#47 D/D2: native pulse checks (LEGACY_PC::, imported pre-S1028; 733 = all matchable).'),
  ('check_ins', 'sys_pulse_checks', 'D2',
   '#47 D/D2 S1028: 1:1 check-in mood signal → pulse rows LEGACY_CI:: (meeting facts in metadata; employee_engagement is all NULL in the legacy).'),
  ('wellbeing_checkins', 'sys_pulse_checks', 'D2',
   '#47 D/D2 S1028: wellbeing mood → pulse rows LEGACY_WB:: (energy/stress/wlb/sleep preserved in metadata, no semantic force-fit).')
) v(src, tgt, series, rationale)
ON CONFLICT (table_mapping_id) DO NOTHING;

\echo '--- imported state ---'
SELECT left(pulse_check_natural_key, 12) AS prefix, count(*)
  FROM sys.sys_pulse_checks GROUP BY 1 ORDER BY 1;
SELECT count(*) AS wave2_mappings FROM brownfield.table_mappings WHERE table_mapping_wave = 2;

COMMIT;
SQL

echo "[d2] done."
