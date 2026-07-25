#!/usr/bin/env bash
#
# scripts/clone-vm-db.sh — refresh a local PostgreSQL DB with a full clone of the VM's
# real `heuresys_advanced`. Streams pg_dump (VM, custom format) -> pg_restore (local) over
# SSH. Idempotent full refresh (`--clean --if-exists` drops+recreates objects, so the local
# DB matches the VM's CURRENT state). Re-runnable on demand.
#
# Runs on a self-hosted box that has: a local DB (created by setup-local-pg.sh), `.pgpass`
# for the loopback role, and SSH to the VM (alias `oracle-vm-default`). The VM's
# `sudo -u postgres pg_dump` is passwordless there.
#
# Usage:  bash scripts/clone-vm-db.sh
# Overridable env: VM_HOST  DB_NAME  POSTGRES_PORT  POSTGRES_USER  (else read from .env)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

VM_HOST="${VM_HOST:-oracle-vm-default}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
PORT="${POSTGRES_PORT:-5432}"
DBUSER="${POSTGRES_USER:-heuresys}"

# Restore with the client matching the LOCAL server major (a v17 pg_restore against a v16
# server emits v17 GUCs like transaction_timeout that v16 rejects), AS the postgres
# superuser (so CREATE EXTENSION works and original ownership=heuresys is preserved).
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
echo "[clone-vm-db] $VM_HOST:$DB_NAME  ->  local :$PORT/$DB_NAME  (restore as postgres, preserve ownership)"
echo "[clone-vm-db] streaming pg_dump(VM 16) | pg_restore(local 16) ..."
# SSH: senza ConnectTimeout una VM raggiungibile-ma-muta (reboot, security list OCI,
# black-hole) lascia il comando appeso finche' non scatta TimeoutStartSec dell'unit —
# 45 minuti con api e web del gemello gia' fermati da ExecStartPre. 15s bastano.
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=4)
set +e
ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres pg_dump -Fc '$DB_NAME'" \
  | sudo -u postgres "$PG_BIN/pg_restore" --clean --if-exists --no-acl -p "$PORT" -d "$DB_NAME"
# PIPESTATUS va copiato IN UN COLPO SOLO: si azzera al primo comando eseguito dopo la
# pipe — inclusa l'assegnazione che lo legge. Leggerlo due volte di fila dava
# "PIPESTATUS[1]: variabile non assegnata" sotto `set -u`.
pipe_status=("${PIPESTATUS[@]}")
dump_rc=${pipe_status[0]}
rc=${pipe_status[1]:-0}
set -e

# Il lato SINISTRO della pipe non era controllato affatto. Se ssh/pg_dump muore a meta'
# (disco pieno sulla VM, LAN caduta a trasferimento iniziato), pg_restore ha gia' eseguito
# i DROP di --clean, ricarica un dump troncato e puo' uscire 0: il DB resta mutilato e lo
# script dichiarava successo. Verificato in laboratorio: dump tagliato al 70% -> tabella
# con 20000 righe ricaricata a 0 righe, script exit 0. (S1030, review adversarial Z-022.)
if [ "$dump_rc" -ne 0 ]; then
  echo "[clone-vm-db] FATAL: pg_dump/ssh sul lato VM e' fallito (exit=$dump_rc)." >&2
  echo "[clone-vm-db] Il DB locale e' stato droppato da --clean e ora e' INCOMPLETO." >&2
  exit "$dump_rc"
fi
# pg_restore esce non-zero anche su notice benigni ("already exists / does not exist") al
# primo giro: non e' fatale di per se', ma non si prosegue in silenzio — decide il sanity
# check qui sotto, che ora e' un GATE e non una stampa.
[ "$rc" -ne 0 ] && echo "[clone-vm-db] pg_restore exit=$rc (notice benigni possibili — verifico sotto)"

echo "[clone-vm-db] sanity row-counts (local vs VM):"
mismatch=0
for t in sys.sys_users sys.sys_positions sys.sys_attendance; do
  loc="$(psql -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo '?')"
  vm="$(ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres psql -d '$DB_NAME' -tAc \"SELECT count(*) FROM $t\"" 2>/dev/null || echo '?')"
  # '?' = la query e' fallita. Confrontare due '?' dava "OK": il fallimento di ENTRAMBI i
  # lati si presentava come successo perfetto. Ora un '?' e' sempre un errore.
  if [ "$loc" = '?' ] || [ "$vm" = '?' ]; then
    status=ERR; mismatch=1
  elif [ "$loc" = "$vm" ]; then
    status=OK
  else
    status=DIFF; mismatch=1
  fi
  printf '  %-26s local=%-7s vm=%-7s %s\n' "$t" "$loc" "$vm" "$status"
done

if [ "$mismatch" -ne 0 ]; then
  echo "[clone-vm-db] FATAL: il clone NON corrisponde alla VM (o il confronto non e' stato" >&2
  echo "[clone-vm-db] possibile). Uscita non-zero: cosi' systemd marca il service failed e" >&2
  echo "[clone-vm-db] OnFailure=heuresys-unit-failure@ scrive nel registro degli alert." >&2
  exit 1
fi
echo "[clone-vm-db] done"
