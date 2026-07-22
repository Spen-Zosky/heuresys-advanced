#!/usr/bin/env bash
#
# scripts/gdpr-retention-sweep.sh — D-63: rende OPERATIVA la retention GDPR.
#
# Il framework registry-driven esiste dalla mig 000186 (`sys.sys_gdpr_data_map`,
# es. RETAIN 400gg su sys_auth_login_events) ma il sweep era invocabile solo a
# mano (`POST /v1/gdpr/retention/run`, PLATFORM-only) — zero scheduler. Questo
# script è il gemello batch di `gdpr/repository.ts runRetention()`: deriva le
# finestre DALLO STESSO registry (nessuna lista di tabelle duplicata) e cancella
# le righe più vecchie della finestra dichiarata.
#
# Fired by heuresys-advanced-gdpr-retention.timer (daily 03:00 — dopo backup
# 01:30 / auth-housekeeping 02:00 / insights 02:15 / digest 02:45, mai overlap).
# Idempotente e safe re-run (2° run immediato cancella ~0). Le entry senza
# retention_days/age_column (erasure-only) sono ignorate, come nel service.
#
# Usage:  bash scripts/gdpr-retention-sweep.sh
# Env: POSTGRES_* letti da .env (come auth-housekeeping.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

export PGPASSWORD="${POSTGRES_PASSWORD:-}"
PSQL=(psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-heuresys}" -d "${POSTGRES_DB:-heuresys_advanced}" \
  -v ON_ERROR_STOP=1)

echo "[gdpr-retention] registry-driven sweep (sys.sys_gdpr_data_map, entries con retention window)"

"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  e record;
  n bigint;
  total bigint := 0;
BEGIN
  FOR e IN
    SELECT gdpr_map_table_schema  AS sch,
           gdpr_map_table_name    AS tbl,
           gdpr_map_age_column    AS age_col,
           gdpr_map_retention_days AS days
      FROM sys.sys_gdpr_data_map
     WHERE gdpr_map_retention_days IS NOT NULL
       AND gdpr_map_age_column    IS NOT NULL
     ORDER BY 1, 2
  LOOP
    -- difensivo: solo tabelle realmente esistenti
    IF to_regclass(format('%I.%I', e.sch, e.tbl)) IS NULL THEN
      RAISE NOTICE '[gdpr-retention] SKIP %.% (tabella assente)', e.sch, e.tbl;
      CONTINUE;
    END IF;
    EXECUTE format(
      'DELETE FROM %I.%I WHERE %I < now() - make_interval(days => %s)',
      e.sch, e.tbl, e.age_col, e.days
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    RAISE NOTICE '[gdpr-retention] %.% (>%gg su %): % righe cancellate',
      e.sch, e.tbl, e.days, e.age_col, n;
  END LOOP;
  RAISE NOTICE '[gdpr-retention] totale righe cancellate: %', total;
END $$;
SQL

echo "[gdpr-retention] done"
