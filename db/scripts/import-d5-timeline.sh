#!/usr/bin/env bash
# db/scripts/import-d5-timeline.sh
#
# #49 D/D5 — importa la storia delle persone da `employee_timeline` del sistema
# legacy `heuresys_platform` verso `sys.sys_user_timeline_events` (mig 000222),
# e registra il dominio nel registry brownfield come wave-2.
#
# MISURATO LIVE prima di scrivere lo script (2026-08-02):
#   employee_timeline  4641 righe · 7 tipi di evento realmente usati:
#     course_completed 2400 · certification_earned 729 · salary_change 591 ·
#     review_completed 290 · hire 270 · level_change 264 · wellbeing_alert 97
#   (il vincolo legacy ne ammette 26: gli altri 19 non hanno righe.)
#
# CROSSWALK: I14 — 'LEGACY_EMP::' || employee_id → sys_users.user_external_code.
# Le righe legacy che non trovano una persona in v5 sono ATTESE, non un errore:
# il legacy contiene più dipendenti del sottoinsieme portato in v5 (stessa
# dottrina di D1/D2). Lo script le conta e le dichiara.
#
# TIPI: i valori legacy sono minuscoli ('hire'), il CHECK di v5 li vuole
# maiuscoli come tutti gli altri discriminatori del progetto. La conversione è
# `upper()`: nessun tipo viene rimappato semanticamente, e un tipo legacy fuori
# dai 26 ammessi finisce in 'OTHER' conservando l'originale nel payload —
# meglio un fatto conservato con etichetta generica che un fatto perso.
#
# IDEMPOTENTE: upsert sulla chiave naturale `LEGACY_TL::<id>`. Ri-eseguire
# aggiorna in place, non duplica.
#
# Usage:  bash db/scripts/import-d5-timeline.sh [--dry-run]
# Prereqs: alias SSH `oracle-vm-default`; `.env` locale per il DB advanced (tunnel :5433).
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
set -a; . "${REPO_ROOT}/.env"; set +a
PSQL=(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1)

TL_TSV="$(mktemp)"
trap 'rm -f "${TL_TSV}"' EXIT
if command -v cygpath >/dev/null 2>&1; then
  TL_TSV_PSQL="$(cygpath -w "${TL_TSV}")"
else
  TL_TSV_PSQL="${TL_TSV}"
fi

echo "[d5] estrazione di employee_timeline dal database legacy…"
# I campi di testo passano da regexp_replace: un a-capo o un tab dentro
# `ai_summary` spezzerebbe il TSV e disallineerebbe tutte le colonne seguenti.
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -tAF$'\t' -c \"
  SELECT id, tenant_id, employee_id, event_type, event_date,
         coalesce(source_table,''), coalesce(source_id::text,''),
         coalesce(regexp_replace(ai_summary, E'[\\n\\r\\t]+', ' ', 'g'),''),
         coalesce(regexp_replace(payload::text, E'[\\n\\r\\t]+', ' ', 'g'),'{}')
    FROM employee_timeline
\"" > "${TL_TSV}"

TL_ROWS=$(wc -l < "${TL_TSV}" | tr -d ' ')
echo "[d5] estratte: ${TL_ROWS} righe"
[[ "${TL_ROWS}" -eq 0 ]] && { echo "[d5] INTERROTTO: estrazione vuota"; exit 1; }

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[d5] --dry-run: solo estrazione, niente scritto."
  exit 0
fi

echo "[d5] staging + upsert…"
"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE stage_tl (
  legacy_id uuid, legacy_tenant_id uuid, employee_id uuid, event_type text,
  event_date timestamptz, source_table text, source_id text,
  ai_summary text, payload text
) ON COMMIT DROP;
\copy stage_tl FROM '${TL_TSV_PSQL}' WITH (FORMAT text, DELIMITER E'\t', NULL '')

\echo '--- risoluzione del crosswalk (prima di scrivere) ---'
SELECT count(*) AS righe_legacy,
       count(*) FILTER (WHERE u.user_id IS NOT NULL) AS importabili,
       count(*) FILTER (WHERE u.user_id IS NULL)     AS senza_persona_in_v5
  FROM stage_tl st
  LEFT JOIN sys.sys_users u
    ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text;

\echo '--- tipi di evento presenti nella sorgente ---'
SELECT event_type, count(*) FROM stage_tl GROUP BY 1 ORDER BY 2 DESC;

-- Il tenant è quello della PERSONA in v5, non quello del legacy: gli id di
-- tenant dei due sistemi non coincidono, e la riga deve stare col suo utente.
INSERT INTO sys.sys_user_timeline_events AS t (
  user_timeline_event_id,
  user_timeline_event_tenant_id,
  user_timeline_event_user_id,
  user_timeline_event_type,
  user_timeline_event_occurred_at,
  user_timeline_event_source_table,
  user_timeline_event_source_id,
  user_timeline_event_summary,
  user_timeline_event_payload,
  user_timeline_event_external_code
)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'LEGACY_TL::' || st.legacy_id::text),
  u.user_tenant_id,
  u.user_id,
  CASE
    WHEN upper(st.event_type) IN (
      'HIRE','PROMOTION','LEVEL_CHANGE','SALARY_CHANGE','COURSE_COMPLETED',
      'COURSE_ENROLLED','SKILL_VALIDATED','SKILL_UPDATED','REVIEW_COMPLETED',
      'MANAGER_CHANGE','CERTIFICATION_EARNED','CERTIFICATION_EXPIRED',
      'GOAL_ACHIEVED','GOAL_ASSIGNED','ROLE_CHANGE','LOCATION_CHANGE',
      'CONTRACT_RENEWED','CONTRACT_SIGNED','WELLBEING_ALERT','FEEDBACK_RECEIVED',
      'TIME_OFF_TAKEN','ABSENCE_RECORDED','SUCCESSION_NOMINATION',
      'TALENT_POOL_INCLUSION','DISCIPLINARY_ACTION','OTHER'
    ) THEN upper(st.event_type)
    ELSE 'OTHER'
  END,
  st.event_date,
  nullif(st.source_table, ''),
  nullif(st.source_id, '')::uuid,
  nullif(st.ai_summary, ''),
  -- Il payload originale, più il tipo legacy quando è finito in 'OTHER':
  -- il fatto resta ricostruibile senza tornare alla sorgente.
  coalesce(st.payload::jsonb, '{}'::jsonb)
    || jsonb_build_object('legacy_event_type', st.event_type),
  'LEGACY_TL::' || st.legacy_id::text
FROM stage_tl st
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || st.employee_id::text
ON CONFLICT (user_timeline_event_external_code) WHERE user_timeline_event_external_code IS NOT NULL
DO UPDATE SET
  user_timeline_event_type        = EXCLUDED.user_timeline_event_type,
  user_timeline_event_occurred_at = EXCLUDED.user_timeline_event_occurred_at,
  user_timeline_event_summary     = EXCLUDED.user_timeline_event_summary,
  user_timeline_event_payload     = EXCLUDED.user_timeline_event_payload,
  updated_at                      = now();

\echo '--- esito ---'
SELECT count(*) AS righe_in_v5,
       count(DISTINCT user_timeline_event_user_id) AS persone,
       min(user_timeline_event_occurred_at)::date AS dal,
       max(user_timeline_event_occurred_at)::date AS al
  FROM sys.sys_user_timeline_events;

SELECT user_timeline_event_type, count(*)
  FROM sys.sys_user_timeline_events GROUP BY 1 ORDER BY 2 DESC;

-- ── Registry brownfield: il dominio entra come wave-2 (vincolo di metodo D) ──
INSERT INTO brownfield.source_exports (source_export_id, source_export_name, source_export_metadata)
SELECT uuid_generate_v5(uuid_ns_url(), 'legacy-live-wave2-D'), 'legacy-live-wave2-D',
       jsonb_build_object('kind', 'live-pg-extract', 'note', 'estrazione live dal PG legacy, non un bundle zip')
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.source_exports WHERE source_export_name = 'legacy-live-wave2-D'
 );

INSERT INTO brownfield.source_tables (
  source_table_id, source_table_export_id, source_table_schema, source_table_name,
  source_table_row_estimate, source_table_domain, source_table_classification
)
SELECT uuid_generate_v5(uuid_ns_url(), 'wave2-D::employee_timeline'),
       (SELECT source_export_id FROM brownfield.source_exports WHERE source_export_name = 'legacy-live-wave2-D'),
       'public', 'employee_timeline', ${TL_ROWS}, 'TIMELINE', 'IMPORT'
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.source_tables WHERE source_table_name = 'employee_timeline'
 );

INSERT INTO brownfield.table_mappings (
  table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table,
  table_mapping_classification, table_mapping_approval_status, table_mapping_rationale,
  table_mapping_metadata
)
SELECT st.source_table_id, 'sys', 'sys_user_timeline_events',
       'IMPORT', 'APPROVED',
       'D5 (#49) — storia consultiva della persona; crosswalk I14 LEGACY_EMP::, chiave naturale LEGACY_TL::',
       jsonb_build_object('wave', 2, 'script', 'db/scripts/import-d5-timeline.sh')
  FROM brownfield.source_tables st
 WHERE st.source_table_name = 'employee_timeline'
   AND NOT EXISTS (
     SELECT 1 FROM brownfield.table_mappings m
      WHERE m.table_mapping_source_table_id = st.source_table_id
        AND m.table_mapping_target_table = 'sys_user_timeline_events'
   );

COMMIT;
SQL

echo "[d5] fatto."
