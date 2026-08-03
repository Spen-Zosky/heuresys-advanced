#!/usr/bin/env bash
# db/scripts/import-e4-salary-bands.sh
#
# #53 E/E4 — importa le fasce retributive da `salary_bands` del sistema legacy
# `heuresys_platform` verso `sys.sys_compensation_bands`.
#
# MISURATO LIVE prima di scrivere lo script (2026-08-03):
#   legacy salary_bands: 41 righe, TUTTE complete (min/mid/max e nome valorizzati),
#   distribuite su 4 tenant legacy:
#     RTL Bank 12 · EcoNova 11 · SmartFood 11 · Heuresys System 7
#   advanced sys_compensation_bands: 87 righe di cui 75 SENZA valore economico e 43
#   col nome uguale al codice (`OLDDB::ccnl_levels::<uuid>`) — un import precedente
#   che ha portato le chiavi ma non i dati. Solo 12 sono utilizzabili e 9 davvero
#   usate dalle posizioni.
#
# TENANT: solo i due che esistono in v5. EcoNova e SmartFood non sono mai stati
# migrati, e importarne le fasce creerebbe righe che non appartengono a nessun
# tenant reale — la stessa contaminazione che il progetto ha già dovuto bonificare
# altrove. Le 22 righe dei tenant assenti sono ESCLUSE e lo script lo dichiara.
#
# CROSSWALK: `sys_tenancies.tenant_metadata->>'legacy_tenant_id'`, che esiste già —
# nessun UUID scritto a mano qui dentro.
#
# IDEMPOTENTE: upsert sull'indice unico `(COALESCE(tenant_id, zero), code)` creato
# dalla migration 000019. Ri-eseguire aggiorna in place, non duplica.
#
# NON CANCELLA NULLA: le 75 righe prive di valore restano dov'erano. Rimuoverle è
# un'operazione distruttiva su dati di produzione e richiede una decisione esplicita.
#
# Usage:  bash db/scripts/import-e4-salary-bands.sh [--dry-run]
# Prereqs: alias SSH `oracle-vm-default`; `.env` locale per il DB advanced (tunnel :5433).
set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
set -a; . "${REPO_ROOT}/.env"; set +a
PSQL=(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1)

SB_TSV="$(mktemp)"
trap 'rm -f "${SB_TSV}"' EXIT
if command -v cygpath >/dev/null 2>&1; then
  SB_TSV_PSQL="$(cygpath -w "${SB_TSV}")"
else
  SB_TSV_PSQL="${SB_TSV}"
fi

echo "[e4] estrazione di salary_bands dal database legacy…"
# I campi di testo passano da regexp_replace: un a-capo dentro `description`
# spezzerebbe il TSV e disallineerebbe le colonne seguenti.
MSYS_NO_PATHCONV=1 ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -tAF$'\t' -c \"
  SELECT id, tenant_id, band_code, band_name,
         coalesce(regexp_replace(description, E'[\\n\\r\\t]+', ' ', 'g'),''),
         coalesce(job_level,''), coalesce(job_family,''), coalesce(currency,'EUR'),
         min_salary, mid_salary, max_salary,
         coalesce(geo_region,''), coalesce(effective_from::text,''),
         coalesce(effective_to::text,''), coalesce(is_active::text,'true')
    FROM salary_bands
   WHERE deleted_at IS NULL
\"" > "${SB_TSV}"

SB_ROWS=$(wc -l < "${SB_TSV}" | tr -d ' ')
echo "[e4] estratte: ${SB_ROWS} righe"
[[ "${SB_ROWS}" -eq 0 ]] && { echo "[e4] INTERROTTO: estrazione vuota"; exit 1; }

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[e4] --dry-run: solo estrazione, niente scritto."
  exit 0
fi

echo "[e4] staging + upsert…"
"${PSQL[@]}" <<SQL
BEGIN;

CREATE TEMP TABLE stage_sb (
  legacy_id uuid, legacy_tenant_id uuid, band_code text, band_name text,
  description text, job_level text, job_family text, currency text,
  min_salary numeric, mid_salary numeric, max_salary numeric,
  geo_region text, effective_from text, effective_to text, is_active text
) ON COMMIT DROP;
\copy stage_sb FROM '${SB_TSV_PSQL}' WITH (FORMAT text, DELIMITER E'\t', NULL '')

\echo '--- risoluzione del crosswalk tenant (prima di scrivere) ---'
SELECT count(*) AS righe_legacy,
       count(*) FILTER (WHERE t.tenant_id IS NOT NULL) AS importabili,
       count(*) FILTER (WHERE t.tenant_id IS NULL)     AS tenant_non_migrato
  FROM stage_sb s
  LEFT JOIN sys.sys_tenancies t
    ON t.tenant_metadata->>'legacy_tenant_id' = s.legacy_tenant_id::text;

\echo '--- ripartizione per tenant di destinazione ---'
SELECT coalesce(t.tenant_code, '(tenant non presente in v5)') AS destinazione, count(*)
  FROM stage_sb s
  LEFT JOIN sys.sys_tenancies t
    ON t.tenant_metadata->>'legacy_tenant_id' = s.legacy_tenant_id::text
 GROUP BY 1 ORDER BY 2 DESC;

-- Solo i tenant che esistono davvero in v5. La valuta resta nei metadati: lo schema
-- advanced esprime gli importi in euro (colonne *_eur) e una fascia in altra valuta
-- va convertita, non rinominata — se comparisse, la si vede qui.
INSERT INTO sys.sys_compensation_bands (
  compensation_band_tenant_id, compensation_band_code, compensation_band_name,
  compensation_band_min_eur, compensation_band_mid_eur, compensation_band_max_eur,
  compensation_band_is_global, compensation_band_metadata
)
SELECT t.tenant_id,
       'LEGACY_BAND::' || s.band_code,
       s.band_name,
       s.min_salary, s.mid_salary, s.max_salary,
       false,
       jsonb_strip_nulls(jsonb_build_object(
         'legacy', jsonb_build_object(
            'source_table', 'salary_bands',
            'legacy_id', s.legacy_id,
            'band_code', s.band_code,
            'currency', nullif(s.currency, ''),
            'job_level', nullif(s.job_level, ''),
            'job_family', nullif(s.job_family, ''),
            'geo_region', nullif(s.geo_region, ''),
            'effective_from', nullif(s.effective_from, ''),
            'effective_to', nullif(s.effective_to, ''),
            'is_active', nullif(s.is_active, '')
         ),
         'description', nullif(s.description, '')
       ))
  FROM stage_sb s
  JOIN sys.sys_tenancies t
    ON t.tenant_metadata->>'legacy_tenant_id' = s.legacy_tenant_id::text
ON CONFLICT (COALESCE(compensation_band_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
             compensation_band_code)
DO UPDATE SET
  compensation_band_name     = EXCLUDED.compensation_band_name,
  compensation_band_min_eur  = EXCLUDED.compensation_band_min_eur,
  compensation_band_mid_eur  = EXCLUDED.compensation_band_mid_eur,
  compensation_band_max_eur  = EXCLUDED.compensation_band_max_eur,
  compensation_band_metadata = EXCLUDED.compensation_band_metadata,
  updated_at                 = now();

\echo '--- esito ---'
SELECT count(*) FILTER (WHERE compensation_band_code LIKE 'LEGACY_BAND::%') AS importate,
       count(*) FILTER (WHERE compensation_band_mid_eur IS NOT NULL)        AS con_valore,
       count(*)                                                            AS totale
  FROM sys.sys_compensation_bands;

-- ── Registry brownfield: il dominio entra come wave-2, come per D1/D2/D5 ──
INSERT INTO brownfield.source_exports (source_export_id, source_export_name, source_export_metadata)
SELECT uuid_generate_v5(uuid_ns_url(), 'legacy-live-wave2-E'), 'legacy-live-wave2-E',
       jsonb_build_object('kind', 'live-pg-extract', 'note', 'estrazione live dal PG legacy, non un bundle zip')
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.source_exports WHERE source_export_name = 'legacy-live-wave2-E'
 );

INSERT INTO brownfield.source_tables (
  source_table_id, source_table_export_id, source_table_schema, source_table_name,
  source_table_row_estimate, source_table_domain, source_table_classification
)
SELECT uuid_generate_v5(uuid_ns_url(), 'wave2-E::salary_bands'),
       (SELECT source_export_id FROM brownfield.source_exports WHERE source_export_name = 'legacy-live-wave2-E'),
       'public', 'salary_bands', ${SB_ROWS}, 'COMPENSATION', 'IMPORT'
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.source_tables WHERE source_table_name = 'salary_bands'
 );

INSERT INTO brownfield.table_mappings (
  table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table,
  table_mapping_classification, table_mapping_approval_status, table_mapping_rationale,
  table_mapping_metadata
)
SELECT st.source_table_id, 'sys', 'sys_compensation_bands',
       'IMPORT', 'APPROVED',
       'E4 (#53) — fasce retributive; crosswalk tenant via tenant_metadata->>legacy_tenant_id, chiave naturale LEGACY_BAND::. Esclusi i tenant mai migrati (EcoNova, SmartFood).',
       jsonb_build_object('wave', 2, 'script', 'db/scripts/import-e4-salary-bands.sh')
  FROM brownfield.source_tables st
 WHERE st.source_table_name = 'salary_bands'
   AND NOT EXISTS (
     SELECT 1 FROM brownfield.table_mappings tm
      WHERE tm.table_mapping_source_table_id = st.source_table_id
        AND tm.table_mapping_target_table = 'sys_compensation_bands'
   );

COMMIT;
SQL

echo "[e4] fatto."
