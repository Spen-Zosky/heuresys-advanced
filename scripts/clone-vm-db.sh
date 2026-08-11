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

# [S1054, #172] Lo schema `staging` va rimosso PRIMA del ripristino, e a mano.
#
# Perche' `--clean --if-exists` non basta: il suo `DROP SCHEMA staging` fallisce
# — «altri oggetti dipendono da esso», le funzioni `storia36_*` — l'errore e' un
# notice che la riga 60 tollera, il ripristino prosegue e i controlli passano.
# Ma lo schema NON viene ricreato da zero: cio' che la produzione ha RIMOSSO
# sopravvive sul clone, e il clone diventa un sovrainsieme della sorgente.
# Misurato in S1050: funzioni in `staging` — PROD 88, clone 89. La differenza era
# `storia36_check_c6a(date)`, una firma vecchia sostituita in produzione da
# `storia36_check_c6a()`: una batteria che l'avesse invocata con un argomento
# avrebbe eseguito sul gemello **l'implementazione sbagliata**, con un verde che
# non valeva per il codice vero. Fu rimossa a mano, ma la causa e' rimasta qui.
#
# CASCADE e' voluto e non e' un rischio aggiuntivo: droppa cio' che il ripristino
# subito dopo ricrea dal dump. Se il dump non arriva, il controllo su `dump_rc`
# (sotto) dichiara gia' il DB incompleto ed esce non-zero.
echo "[clone-vm-db] drop esplicito di staging (il --clean non ce la fa: dipendenze)"
sudo -u postgres psql -p "$PORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS staging CASCADE' >/dev/null

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
unmeasured=0
ERRLOG="$(mktemp)"
trap 'rm -f "$ERRLOG"' EXIT
for t in sys.sys_users sys.sys_positions sys.sys_attendance; do
  # D-78: lo stderr di psql NON si butta piu' via. Buttarlo ha nascosto per settimane la
  # ragione vera di un FATAL ricorrente sul gemello: l'unit systemd dichiarava
  # `Environment=PGOPTIONS=-c lock_timeout=30s` SENZA virgolette, e in `Environment=` lo
  # spazio separa due assegnazioni — il server riceveva un `-c` monco e RIFIUTAVA ogni
  # connessione locale. Lo script leggeva '?' su tutte le tabelle e annunciava un clone
  # divergente, mentre il clone era allineato riga per riga: falliva la MISURA, non il dato.
  # Con l'errore in chiaro la diagnosi e' immediata invece che archeologica.
  loc="$(psql -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME" -tAc "SELECT count(*) FROM $t" 2>>"$ERRLOG" || echo '?')"
  vm="$(ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres psql -d '$DB_NAME' -tAc \"SELECT count(*) FROM $t\"" 2>>"$ERRLOG" || echo '?')"
  # '?' = la query e' fallita. Confrontare due '?' dava "OK": il fallimento di ENTRAMBI i
  # lati si presentava come successo perfetto. Ora un '?' e' sempre un errore.
  if [ "$loc" = '?' ] || [ "$vm" = '?' ]; then
    status=ERR; mismatch=1; unmeasured=1
  elif [ "$loc" = "$vm" ]; then
    status=OK
  else
    status=DIFF; mismatch=1
  fi
  printf '  %-26s local=%-7s vm=%-7s %s\n' "$t" "$loc" "$vm" "$status"
done

# [S1054, #172] Post-condizione sugli OGGETTI, non solo sulle righe.
#
# Contare le righe di tre tabelle non vede una funzione di troppo: e' esattamente
# come il residuo di S1050 e' passato inosservato. Questo censimento confronta,
# per ogni schema, quante funzioni / tabelle+viste / indici esistono sui due lati.
# Protegge cio' che NON doveva cambiare — la forma del database — invece del solo
# contenuto di cio' che ci si aspettava di trovare.
CENSIMENTO="SELECT string_agg(x, ' ' ORDER BY x) FROM (
  SELECT n.nspname||'.fun='||count(*)::text AS x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' GROUP BY n.nspname
  UNION ALL
  SELECT table_schema||'.tab='||count(*)::text FROM information_schema.tables
   WHERE table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema' GROUP BY table_schema
  UNION ALL
  SELECT schemaname||'.idx='||count(*)::text FROM pg_indexes
   WHERE schemaname NOT LIKE 'pg_%' GROUP BY schemaname) s"
cen_loc="$(psql -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME" -tAc "$CENSIMENTO" 2>>"$ERRLOG" || echo '?')"
cen_vm="$(ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres psql -d '$DB_NAME' -tAc \"$CENSIMENTO\"" 2>>"$ERRLOG" || echo '?')"
if [ "$cen_loc" = '?' ] || [ "$cen_vm" = '?' ]; then
  echo "  censimento oggetti        NON MISURATO"
  mismatch=1; unmeasured=1
elif [ "$cen_loc" = "$cen_vm" ]; then
  echo "  censimento oggetti        OK  ($(printf '%s' "$cen_loc" | wc -w) voci identiche)"
else
  echo "  censimento oggetti        DIFF" >&2
  echo "    VM    : $cen_vm" >&2
  echo "    clone : $cen_loc" >&2
  # La differenza, voce per voce: senza questa riga si sa CHE divergono e non DOVE,
  # ed e' la stessa mezz'ora di archeologia che il progetto ha gia' pagato altrove.
  echo "    delta : $(comm -3 <(printf '%s' "$cen_vm" | tr ' ' '\n' | sort) \
                              <(printf '%s' "$cen_loc" | tr ' ' '\n' | sort) | tr '\t' ' ' | tr '\n' ' ')" >&2
  mismatch=1
fi

if [ "$mismatch" -ne 0 ]; then
  # Il gate resta invariato: si esce non-zero in ENTRAMBI i casi, perche' un clone non
  # verificato non e' un clone verificato (un falso via libera su un DB mutilato e' la
  # ragione per cui questo controllo esiste — S1030 Z-022). Cambia solo la DIAGNOSI:
  # "non sono riuscito a misurare" e "i numeri non combaciano" sono due guasti diversi e
  # ora lo dicono, invece di presentarsi con la stessa frase.
  if [ "$unmeasured" -ne 0 ]; then
    echo "[clone-vm-db] FATAL: il confronto NON e' stato possibile — almeno una conta e'" >&2
    echo "[clone-vm-db] fallita ('?'). Questo NON dice che il clone sia divergente: dice che" >&2
    echo "[clone-vm-db] non e' stato verificato. Errori riportati dai client:" >&2
    sed 's/^/    | /' "$ERRLOG" >&2
  else
    echo "[clone-vm-db] FATAL: il clone NON corrisponde alla VM — le conte differiscono." >&2
  fi
  echo "[clone-vm-db] Uscita non-zero: cosi' systemd marca il service failed e" >&2
  echo "[clone-vm-db] OnFailure=heuresys-unit-failure@ scrive nel registro degli alert." >&2
  exit 1
fi
echo "[clone-vm-db] done"
