#!/usr/bin/env bash
# =============================================================================
# cross_os_pipeline.sh — sourceable library cross-OS pg_dump/restore pipeline
# Author: Cowork batch C5.3
# Date: 2026-05-21
# Generalizes CW-B28 mitigation (extract_users_employees_legacy.sh fix) into
# reusable functions for any future SDBI extract from heuresys_platform (OCI VM)
# → heuresys_advanced.legacy_mirror (local Windows / Mac / VM).
#
# USAGE (source from your script):
#   #!/usr/bin/env bash
#   set -euo pipefail
#   source "$(dirname "$0")/../../cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh"
#
#   xos_init \
#     --ssh-host oracle-vm-default \
#     --remote-db heuresys_platform \
#     --local-db-url "postgresql://heuresys:***@localhost:5433/heuresys_advanced"
#
#   xos_restore_legacy_mirror \
#     --schema legacy_mirror \
#     --tables "users employees_pii employees_core leave_requests"
#
# DEPENDENCIES (cross-OS verified):
#   - bash (Git Bash on Windows, zsh/bash on Mac, bash on VM)
#   - ssh client + valid ~/.ssh/config entry for SSH_HOST
#   - psql in PATH (libpq client — Windows: PostgreSQL installer / Mac: brew install libpq)
#   - sudo NOPASSWD on remote VM for postgres user (already configured per RD-25)
#
# OS QUIRKS:
#   - Windows Git Bash: paths in DB_URL must use forward-slash; no cmd.exe quoting
#   - Mac: zsh non-interactive SSH ignores .zshrc → use SSH_HOST alias (config-based)
#   - VM-local execution: SSH_HOST can be "localhost" with port-less SSH (skips ssh)
#
# =============================================================================

# ---- Internal state (initialized by xos_init) ----
_XOS_SSH_HOST=""
_XOS_REMOTE_DB=""
_XOS_LOCAL_DB_URL=""
_XOS_LOG_PREFIX="[xos-pipe]"
_XOS_DRY_RUN=0
_XOS_VERBOSE=0

# ---- Public functions ----

xos_log() {
  # Structured logging with timestamp + prefix
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${_XOS_LOG_PREFIX} $*" >&2
}

xos_die() {
  xos_log "FATAL: $*"
  exit 1
}

xos_init() {
  # Initialize library state. Required before any pg_dump/restore call.
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ssh-host)      _XOS_SSH_HOST="$2"; shift 2 ;;
      --remote-db)     _XOS_REMOTE_DB="$2"; shift 2 ;;
      --local-db-url)  _XOS_LOCAL_DB_URL="$2"; shift 2 ;;
      --dry-run)       _XOS_DRY_RUN=1; shift ;;
      --verbose)       _XOS_VERBOSE=1; shift ;;
      *) xos_die "xos_init: unknown flag '$1'" ;;
    esac
  done

  [[ -n "${_XOS_SSH_HOST}" ]]     || xos_die "xos_init: --ssh-host required"
  [[ -n "${_XOS_REMOTE_DB}" ]]    || xos_die "xos_init: --remote-db required"
  [[ -n "${_XOS_LOCAL_DB_URL}" ]] || xos_die "xos_init: --local-db-url required"

  # Verify ssh reachable (skip if localhost VM-local execution)
  if [[ "${_XOS_SSH_HOST}" != "localhost" ]]; then
    ssh -o BatchMode=yes -o ConnectTimeout=5 "${_XOS_SSH_HOST}" "echo ok" >/dev/null 2>&1 \
      || xos_die "ssh '${_XOS_SSH_HOST}' unreachable (check ~/.ssh/config)"
  fi

  # Verify psql reachable
  psql "${_XOS_LOCAL_DB_URL}" -c "SELECT 1" >/dev/null 2>&1 \
    || xos_die "psql '${_XOS_LOCAL_DB_URL}' unreachable (check tunnel + creds)"

  xos_log "xos_init OK — remote=${_XOS_SSH_HOST}:${_XOS_REMOTE_DB} → local=${_XOS_LOCAL_DB_URL%:*}"
}

_xos_remote_exec() {
  # Run command on remote via ssh, or locally if SSH_HOST=localhost
  local cmd="$1"
  if [[ "${_XOS_SSH_HOST}" == "localhost" ]]; then
    bash -c "${cmd}"
  else
    ssh "${_XOS_SSH_HOST}" "${cmd}"
  fi
}

_xos_filter_dump_data() {
  # CW-B28 cross-OS filter for DATA-ONLY pg_dump output.
  # - Strip \restrict / \unrestrict lines (PG 16+ incompatible w/ psql non-tty)
  # - Rewrite COPY public.<t> → COPY <target_schema>.<t>
  local target_schema="$1"
  grep -v '^\\restrict ' \
    | grep -v '^\\unrestrict ' \
    | sed "s/COPY public\\./COPY ${target_schema}./g"
}

_xos_filter_dump_schema() {
  # CW-B28 cross-OS filter for SCHEMA-ONLY pg_dump output.
  # - Strip \restrict / \unrestrict lines
  # - vector(N) → text (avoid pgvector ext dependency)
  # - uuid_generate_v4() → gen_random_uuid() (avoid uuid-ossp ext dependency)
  # - Strip ALTER TABLE ADD CONSTRAINT (FK against public.* would break post-rewrite)
  # - Strip CREATE INDEX (defer to consumer if needed; not required for mirror reads)
  # - Rewrite public.<t> → <target_schema>.<t>, CREATE TABLE → CREATE TABLE IF NOT EXISTS
  local target_schema="$1"
  grep -v '^\\restrict ' \
    | grep -v '^\\unrestrict ' \
    | sed 's/vector([0-9]*)/text/g' \
    | sed 's/uuid_generate_v4()/gen_random_uuid()/g' \
    | sed "s/CREATE TABLE public\\./CREATE TABLE IF NOT EXISTS ${target_schema}./g" \
    | sed "s/public\\./${target_schema}./g" \
    | sed '/^ALTER TABLE.*ADD CONSTRAINT/d' \
    | sed '/^CREATE INDEX/d'
}

xos_dump_schema() {
  # Dump schema (DDL only) for given tables from remote → stdout filtered.
  # Args: --tables "t1 t2 t3" --target-schema legacy_mirror
  local tables="" target_schema=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tables)         tables="$2"; shift 2 ;;
      --target-schema)  target_schema="$2"; shift 2 ;;
      *) xos_die "xos_dump_schema: unknown flag '$1'" ;;
    esac
  done
  [[ -n "${tables}" ]]         || xos_die "xos_dump_schema: --tables required"
  [[ -n "${target_schema}" ]]  || xos_die "xos_dump_schema: --target-schema required"

  local table_args=""
  for t in ${tables}; do
    table_args="${table_args} -t public.${t}"
  done

  xos_log "dump_schema: tables=[${tables}] → ${target_schema}"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip pg_dump (would emit DDL filtered)"
    return 0
  fi

  _xos_remote_exec "sudo -u postgres pg_dump --schema-only --no-owner --no-privileges ${table_args} -d ${_XOS_REMOTE_DB}" \
    | _xos_filter_dump_schema "${target_schema}"
}

xos_dump_data() {
  # Dump data-only (COPY blocks) for given tables from remote → stdout filtered.
  # Args: --tables "t1 t2 t3" --target-schema legacy_mirror
  local tables="" target_schema=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tables)         tables="$2"; shift 2 ;;
      --target-schema)  target_schema="$2"; shift 2 ;;
      *) xos_die "xos_dump_data: unknown flag '$1'" ;;
    esac
  done
  [[ -n "${tables}" ]]         || xos_die "xos_dump_data: --tables required"
  [[ -n "${target_schema}" ]]  || xos_die "xos_dump_data: --target-schema required"

  local table_args=""
  for t in ${tables}; do
    table_args="${table_args} -t public.${t}"
  done

  xos_log "dump_data: tables=[${tables}] → ${target_schema}"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip pg_dump (would emit COPY filtered)"
    return 0
  fi

  _xos_remote_exec "sudo -u postgres pg_dump --data-only --no-owner --no-privileges ${table_args} -d ${_XOS_REMOTE_DB}" \
    | _xos_filter_dump_data "${target_schema}"
}

xos_ensure_schema() {
  # Idempotent CREATE SCHEMA IF NOT EXISTS for target.
  local target_schema="$1"
  [[ -n "${target_schema}" ]] || xos_die "xos_ensure_schema: target schema required"

  xos_log "ensure_schema: ${target_schema}"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip CREATE SCHEMA"
    return 0
  fi

  psql "${_XOS_LOCAL_DB_URL}" -c "CREATE SCHEMA IF NOT EXISTS ${target_schema}" >/dev/null
}

xos_restore_legacy_mirror() {
  # Full pipeline: dump schema + data from remote.public.* → local <schema>.*
  # Args: --schema legacy_mirror --tables "t1 t2 t3"
  # Idempotent: CREATE TABLE IF NOT EXISTS + INSERT (COPY will append; truncate before if rerun desired)
  local schema="" tables="" truncate_first=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --schema)          schema="$2"; shift 2 ;;
      --tables)          tables="$2"; shift 2 ;;
      --truncate-first)  truncate_first=1; shift ;;
      *) xos_die "xos_restore_legacy_mirror: unknown flag '$1'" ;;
    esac
  done
  [[ -n "${schema}" ]] || xos_die "xos_restore_legacy_mirror: --schema required"
  [[ -n "${tables}" ]] || xos_die "xos_restore_legacy_mirror: --tables required"

  xos_ensure_schema "${schema}"

  # Step 1: DDL
  xos_log "restore_legacy_mirror: applying schema for [${tables}]"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip schema apply"
  else
    xos_dump_schema --tables "${tables}" --target-schema "${schema}" \
      | psql "${_XOS_LOCAL_DB_URL}" -v ON_ERROR_STOP=1 \
      || xos_die "schema restore failed"
  fi

  # Step 2: optional truncate (rerun scenario)
  if [[ "${truncate_first}" -eq 1 ]]; then
    xos_log "truncate_first: TRUNCATE ${schema}.{${tables}} CASCADE"
    if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
      xos_log "DRY-RUN: skip TRUNCATE"
    else
      local trunc_list=""
      for t in ${tables}; do
        trunc_list="${trunc_list}${schema}.${t},"
      done
      trunc_list="${trunc_list%,}"
      psql "${_XOS_LOCAL_DB_URL}" -c "TRUNCATE ${trunc_list} CASCADE" \
        || xos_die "truncate failed"
    fi
  fi

  # Step 3: DATA
  xos_log "restore_legacy_mirror: applying data for [${tables}]"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip data apply"
  else
    xos_dump_data --tables "${tables}" --target-schema "${schema}" \
      | psql "${_XOS_LOCAL_DB_URL}" -v ON_ERROR_STOP=1 \
      || xos_die "data restore failed"
  fi

  # Step 4: row count verification
  xos_log "restore_legacy_mirror: row count verification"
  for t in ${tables}; do
    local count
    count=$(psql "${_XOS_LOCAL_DB_URL}" -tA -c "SELECT COUNT(*) FROM ${schema}.${t}")
    xos_log "  ${schema}.${t} → ${count} rows"
  done

  xos_log "restore_legacy_mirror: DONE"
}

xos_run_sql_file() {
  # Apply a local SQL file to the local DB via psql (ON_ERROR_STOP=1).
  # Args: <path-to-.sql>
  local sql_file="$1"
  [[ -f "${sql_file}" ]] || xos_die "xos_run_sql_file: file not found: ${sql_file}"

  xos_log "run_sql_file: ${sql_file}"
  if [[ "${_XOS_DRY_RUN}" -eq 1 ]]; then
    xos_log "DRY-RUN: skip psql apply"
    return 0
  fi
  psql "${_XOS_LOCAL_DB_URL}" -v ON_ERROR_STOP=1 -f "${sql_file}" \
    || xos_die "run_sql_file failed: ${sql_file}"
}

# =============================================================================
# Library self-test — invoked only when this file is executed directly,
# never on `source`. Smoke-test only (no side effects).
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "xos_lib self-test (smoke):"
  echo "  Bash version: ${BASH_VERSION}"
  echo "  OS uname: $(uname -s)"
  echo "  Available functions:"
  declare -F | grep -E '^declare -f xos_' | awk '{print "    "$3}'
  echo ""
  echo "Source this file from your script instead of executing it directly."
  echo "Example:"
  echo "  source path/to/cross_os_pipeline.sh"
  echo "  xos_init --ssh-host oracle-vm-default --remote-db heuresys_platform \\"
  echo "    --local-db-url \"postgresql://...\""
  echo "  xos_restore_legacy_mirror --schema legacy_mirror --tables \"users employees_pii\""
fi
