#!/usr/bin/env bash
# =============================================================================
# db-health-graph.sh  — repeatable DBMS health census + graphify-ingestible refresh
#
# Produces (idempotent, safe to re-run):
#   qa_artifacts/dbms_health_<date>/rowcount_all_tables.csv
#   qa_artifacts/dbms_health_<date>/sys_column_completeness.csv
#   graphify-db-input/schema/{foreign_keys,tables}.md         (via _export.sql)
#   graphify-db-input/data/{01..04}.md + 05_data_health.md    (via _export.sql)
#   graphify-db-input/data/06_webapp_coverage.md              (from latest coverage matrix, if any)
#
# After this, rebuild the knowledge graph (Claude-driven, NOT scriptable — the
# semantic extraction needs subagents). Run it from INSIDE graphify-db-input so
# its graphify-out/ (graph.json, manifest, cache) stays ISOLATED from the
# repo-root codebase graph:   cd graphify-db-input && /graphify . --update
#
# Usage:  bash scripts/db-health-graph.sh
# Requires: SSH tunnel :5433 -> OCI VM :5432 up.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DATE="$(date +%Y-%m-%d)"
OUT="qa_artifacts/dbms_health_${DATE}"
PSQL=(psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -X -P pager=off)

mkdir -p "$OUT" graphify-db-input/schema graphify-db-input/data

echo "[1/4] tunnel :5433 reachability"
if ! (exec 3<>/dev/tcp/localhost/5433) 2>/dev/null; then
  echo "ERROR: tunnel :5433 not reachable. Start it with:" >&2
  echo "  ssh -fN -L 5433:localhost:5432 oracle-vm-default" >&2
  exit 1
fi

echo "[2/4] census CSV (rowcount + per-column NULL completeness)"
"${PSQL[@]}" --csv -c "
SELECT n.nspname AS schema, c.relname AS tbl,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) c FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint AS rows
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND n.nspname IN ('sys','staging','brownfield','audit')
ORDER BY n.nspname, c.relname;" > "$OUT/rowcount_all_tables.csv"

"${PSQL[@]}" --csv -c "
WITH tbls AS (
  SELECT n.nspname s, c.relname t,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) c FROM %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint rows
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='r' AND n.nspname='sys'
), cols AS (
  SELECT col.table_name tn, t.rows, col.column_name cn, col.ordinal_position op, col.data_type dt,
    (xpath('/row/n/text()', query_to_xml(format('SELECT count(%I) n FROM %I.%I',col.column_name,col.table_schema,col.table_name),false,true,'')))[1]::text::bigint nn
  FROM information_schema.columns col JOIN tbls t ON t.s=col.table_schema AND t.t=col.table_name
  WHERE t.rows>0
)
SELECT tn AS tbl, cn AS col, dt AS type, rows, nn AS non_null,
  round(100.0*(rows-nn)/rows,1) AS null_pct
FROM cols ORDER BY tn, op;" > "$OUT/sys_column_completeness.csv"
echo "  rowcount: $(($(wc -l < "$OUT/rowcount_all_tables.csv")-1)) tables ; completeness: $(($(wc -l < "$OUT/sys_column_completeness.csv")-1)) columns"

echo "[3/4] graphify ingestible export (_export.sql -> schema + data + 05_data_health)"
"${PSQL[@]}" -f graphify-db-input/_export.sql

echo "[4/4] 06_webapp_coverage.md from latest coverage matrix (if present)"
MATRIX="$(ls -t qa_artifacts/dbms_health_*/webapp_coverage_matrix.csv 2>/dev/null | head -1 || true)"
if [ -n "${MATRIX:-}" ] && [ -f "$MATRIX" ]; then
  PYBIN="$(command -v python 2>/dev/null || echo 'C:/Users/enzospenuso/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe')"
  "$PYBIN" - "$MATRIX" > graphify-db-input/data/06_webapp_coverage.md <<'PYEOF'
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
out = ['# Webapp live-data coverage', '',
       'Each line: a web page calls an API endpoint that reads a database table, with its live-data status (LIVE/PARTIAL/EMPTY).', '']
for r in rows:
    tables = r.get('tables') or 'n/a'
    eps = r.get('endpoints') or 'n/a'
    line = f"- Page /{r['page']} (area {r['area']}) calls {eps} reading {tables}: status {r['final']}."
    if r.get('gap'):
        line += f" Gap: {r['gap']}"
    out.append(line)
sys.stdout.write('\n'.join(out) + '\n')
print(f"  wrote {len(rows)} page rows", file=sys.stderr)
PYEOF
  echo "  06_webapp_coverage.md <- $MATRIX"
else
  echo "  (no coverage matrix found — skip 06; regenerate it via the live-E2E coverage workflow)"
fi

echo ""
echo "DONE. Census in $OUT/ ; graphify input refreshed in graphify-db-input/"
echo "Next (Claude-driven, isolated dir): cd graphify-db-input && /graphify . --update   to rebuild the knowledge graph."
