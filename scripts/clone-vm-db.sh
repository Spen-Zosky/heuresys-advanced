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

# ── L'AGGANCIO DI PROVA (D-86, S1078) ───────────────────────────────────────────
# Tutto cio' che esce da questo processo — la VM, il database locale come superuser,
# il database locale come utente applicativo, il travaso dump->restore — passa da
# queste QUATTRO funzioni e SOLO da queste. Non e' un abbellimento: senza, questo
# script era provabile unicamente con `bash -n`, cioe' si sapeva che era sintassi
# valida e NIENTE su cosa decide. E cio' che decide e' se droppare degli schemi.
#
# Le guardie che porta — «la VM non risponde, non tocco niente», «l'elenco e' vuoto,
# non tocco niente», «il dump si e' interrotto, il clone e' INCOMPLETO», «non sono
# riuscito a MISURARE, che non vuol dire che sia divergente» — sono esattamente i
# rami che in produzione non si percorrono mai, e che quindi nessuno vede fallire
# finche' non servono. Un file di sostituzione le rende esercitabili senza una VM e
# senza un database:
#
#   CLONE_VM_DB_STUB=/percorso/finti-comandi.sh bash scripts/clone-vm-db.sh
#
# Il file viene letto DOPO le definizioni, quindi puo' ridefinirle; in assenza, lo
# script si comporta esattamente come prima — e il seam non e' una fiducia, e'
# verificato dalla corsa live sul gemello che segue ogni modifica.
remote_psql() {  # una query sulla VM, come postgres, in forma -tAc
  ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres psql -d '$DB_NAME' -tAc \"$1\""
}
pg_super() { sudo -u postgres psql -p "$PORT" -d "$DB_NAME" "$@"; }
pg_app()   { psql -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME" "$@"; }
# Imposta due variabili invece di restituire un codice: il lato SINISTRO della pipe
# conta quanto il destro, ed e' il motivo per cui esiste il controllo su `dump_rc`.
stream_dump_restore() {
  set +e
  ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres pg_dump -Fc '$DB_NAME'" \
    | sudo -u postgres "$PG_BIN/pg_restore" --clean --if-exists --no-acl -p "$PORT" -d "$DB_NAME"
  # PIPESTATUS va copiato IN UN COLPO SOLO: si azzera al primo comando eseguito dopo
  # la pipe — inclusa l'assegnazione che lo legge. Leggerlo due volte di fila dava
  # "PIPESTATUS[1]: variabile non assegnata" sotto `set -u`.
  local ps=("${PIPESTATUS[@]}")
  dump_rc=${ps[0]}
  rc=${ps[1]:-0}
  set -e
}
# shellcheck disable=SC1090
[ -n "${CLONE_VM_DB_STUB:-}" ] && . "$CLONE_VM_DB_STUB"

# [S1054 #172 · S1078 D-86] GLI SCHEMI SI RIFANNO DA ZERO PRIMA DEL RIPRISTINO,
# E L'ELENCO SI MISURA — non si scrive a mano.
#
# Perche' `--clean --if-exists` non basta: droppa SOLO gli oggetti presenti nel dump.
# Il dump emette anche un `DROP SCHEMA IF EXISTS <x>` finale, ma senza CASCADE, e
# quello fallisce non appena UN oggetto assente dal dump vive ancora nello schema.
# L'errore e' un notice che la riga sotto tollera, il ripristino prosegue, e cio' che
# la produzione ha RIMOSSO sopravvive sul clone: il clone diventa un sovrainsieme
# della sorgente invece che una copia.
#
# Due volte, e due materie diverse:
#   S1050 — funzioni in `staging`: PROD 88, clone 89. La differenza era
#     `storia36_check_c6a(date)`, firma vecchia sostituita in produzione da
#     `storia36_check_c6a()`: una batteria che l'avesse invocata con un argomento
#     avrebbe eseguito sul gemello L'IMPLEMENTAZIONE SBAGLIATA, con un verde che non
#     valeva per il codice vero. Fu curato droppando il solo `staging`.
#   S1074 — una TABELLA in `sys`: `sys_blueprint_content_processes`, ritirata dalla
#     mig. 000335 poche ore prima. Il censimento la vide, dichiaro' `FATAL: il clone
#     NON corrisponde alla VM`, e `close-propagate.sh` non armo' il deploy. Cioe':
#     OGNI ritiro di tabella rompeva la chiusura successiva. Anche li' fu curato
#     l'esemplare, a mano, e la causa rimase qui — che e' come questa riga e' nata.
#
# Riprodotto sul gemello il 2026-08-23 prima di scrivere la cura, per non curare a
# memoria: creata `sys.zz_fantasma_d86`, il ripristino l'ha lasciata viva e lo script
# e' uscito 1. Nel log: «non è possibile eliminare schema sys perché altri oggetti
# dipendono da esso — DETTAGLI: tabella sys.zz_fantasma_d86».
#
# QUALI schemi. Misurato lo stesso giorno con `pg_restore -l` sul dump vero: il dump
# ricrea `audit reference_sync staging sys` e NON ricrea `public`, che e' lo schema di
# default e pg_dump non emette. Ma le 5 estensioni (pgcrypto, uuid-ossp, pg_trgm,
# vector, pg_stat_statements) ci vivono dentro: droppare `public` farebbe fallire il
# loro `CREATE EXTENSION ... WITH SCHEMA public`. Quindi `public` resta, e su di lui
# vigila il solo censimento.
#
# L'elenco NON si cabla qui: un elenco scritto a mano e' vero il giorno in cui lo
# scrivi e falso al primo schema nuovo, e chi lo rilegge non ha modo di accorgersene.
# Si deriva dai due lati — l'unione, cosi' cade anche uno schema INTERO ritirato in
# produzione — si stampa, e si droppa NOME PER NOME. Nessun carattere jolly.
#
# CASCADE e' voluto e non e' un rischio aggiuntivo: droppa cio' che il ripristino
# subito dopo ricrea dal dump. Se il dump non arriva, il controllo su `dump_rc`
# (sotto) dichiara gia' il DB incompleto ed esce non-zero — ed e' la stessa finestra
# che `--clean` apre da sempre, su un oggetto riproducibile per definizione.
Q_SCHEMI="SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
          AND nspname NOT IN ('information_schema','public') ORDER BY 1"
sch_vm="$(remote_psql "$Q_SCHEMI" || echo '?')"
sch_loc="$(pg_super -tAc "$Q_SCHEMI" || echo '?')"
if [ "$sch_vm" = '?' ] || [ "$sch_loc" = '?' ]; then
  echo "[clone-vm-db] FATAL: non ho potuto misurare gli schemi (VM o locale) — non tocco niente." >&2
  echo "[clone-vm-db] Droppare su un elenco che non ho letto sarebbe peggio del difetto che curo." >&2
  exit 1
fi
SCHEMI="$(printf '%s\n%s\n' "$sch_vm" "$sch_loc" | sed '/^$/d' | sort -u)"
# `public` fuori, una seconda volta e a mano. La query sopra lo esclude gia', ma quella
# protezione vive DENTRO una stringa SQL: chi un giorno riscrivesse la query per un'altra
# ragione se la porterebbe via senza accorgersene, e il guasto si vedrebbe solo al primo
# ripristino — con le 5 estensioni gia' cadute e il clone mutilato. Due presidi per la
# stessa cosa qui non sono una ridondanza: sono l'unico dei due che una prova offline
# riesce a esercitare, perche' l'altro sta nel database.
SCHEMI="$(printf '%s\n' "$SCHEMI" | grep -vx 'public' || true)"
# Un guard che passa su input vuoto non e' un guard: se l'elenco e' vuoto, la misura e'
# andata storta in un modo che non ha prodotto errori — e nessun database sano ha zero
# schemi applicativi.
if [ -z "$SCHEMI" ]; then
  echo "[clone-vm-db] FATAL: l'elenco degli schemi e' VUOTO. Nessun database sano lo e':" >&2
  echo "[clone-vm-db] la misura e' fallita in silenzio. Non procedo." >&2
  exit 1
fi
echo "[clone-vm-db] schemi rifatti da zero: $(printf '%s' "$SCHEMI" | tr '\n' ' ')(public escluso: ci vivono le estensioni)"
for s in $SCHEMI; do
  pg_super -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS \"$s\" CASCADE" >/dev/null
done

dump_rc=0; rc=0
stream_dump_restore

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
  loc="$(pg_app -tAc "SELECT count(*) FROM $t" 2>>"$ERRLOG" || echo '?')"
  vm="$(remote_psql "SELECT count(*) FROM $t" 2>>"$ERRLOG" || echo '?')"
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
#
# ⚠ [D-86, S1078] LE TABELLE SI CONTANO DA `pg_class`, NON DA `information_schema`.
# `information_schema.tables` mostra SOLO gli oggetti su cui chi interroga ha un
# privilegio. I due lati non interrogano con lo stesso ruolo — la VM come `postgres`
# (superuser, vede tutto), il clone come `heuresys` — quindi la stessa query
# rispondeva due cose diverse per una ragione che col contenuto del database non
# c'entrava nulla: il confronto non era fra due misure omogenee.
# Misurato il 2026-08-23: con `sys.zz_fantasma_d86` viva sul clone e di proprieta' di
# `postgres`, il censimento leggeva `sys.tab=264` su ENTRAMBI i lati — cieco alla
# tabella di troppo — e l'allarme scatto' solo perche' quella tabella aveva un indice
# (`sys.idx` 788 contro 787). Una tabella ritirata SENZA indici sarebbe passata verde:
# il guardiano dei ritiri non si accorgeva dei ritiri.
CENSIMENTO="SELECT string_agg(x, ' ' ORDER BY x) FROM (
  SELECT n.nspname||'.fun='||count(*)::text AS x FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' GROUP BY n.nspname
  UNION ALL
  SELECT n.nspname||'.tab='||count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT LIKE 'pg_%'
     AND n.nspname <> 'information_schema' GROUP BY n.nspname
  UNION ALL
  SELECT schemaname||'.idx='||count(*)::text FROM pg_indexes
   WHERE schemaname NOT LIKE 'pg_%' GROUP BY schemaname) s"
cen_loc="$(pg_app -tAc "$CENSIMENTO" 2>>"$ERRLOG" || echo '?')"
cen_vm="$(remote_psql "$CENSIMENTO" 2>>"$ERRLOG" || echo '?')"
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
