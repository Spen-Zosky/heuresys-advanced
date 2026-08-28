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
# il database locale come utente applicativo, il database `postgres` per le
# operazioni sui database interi, il travaso dump->restore — passa da queste CINQUE
# funzioni e SOLO da queste. Non e' un abbellimento: senza, questo script era
# provabile unicamente con `bash -n`, cioe' si sapeva che era sintassi valida e
# NIENTE su cosa decide.
# ⚠ E cio' che decide e' CAMBIATO in S1083 (#236 F1): non piu' «se droppare degli
# schemi» — quel drop non esiste piu' — ma **se scambiare il clone di scena con
# quello vero**. La quinta funzione, `pg_maint`, e' quella che esegue lo scambio, ed
# e' quindi la piu' importante da poter sostituire in una prova.
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
# ── S1083, #236 F1: SI RIPRISTINA ACCANTO, NON SOPRA ────────────────────────────
# `TARGET_DB` e' il database su cui si LAVORA: durante il ripristino e' quello di
# scena (`<nome>_stage`), e diventa quello vero solo dopo lo scambio. Tutte le
# verifiche qui sotto lo seguono senza sapere quale sia — che e' precisamente il
# punto: girano PRIMA dello scambio invece che dopo il danno.
STAGE_DB="${STAGE_DB:-${DB_NAME}_stage}"
OLD_DB="${OLD_DB:-${DB_NAME}_old}"
TARGET_DB="$STAGE_DB"
# `pg_maint` parla col database `postgres`, non con quello di lavoro: CREATE, DROP e
# ALTER DATABASE non si possono eseguire da dentro il database che nominano.
pg_maint() { sudo -u postgres psql -w -p "$PORT" -d postgres "$@"; }
pg_super() { sudo -u postgres psql -w -p "$PORT" -d "$TARGET_DB" "$@"; }
# ⚠ DUE DIFESE, e la seconda l'ha imposta la corsa reale (S1083, #236 F1).
#
# `-w` — psql NON deve MAI chiedere una password: in una corsa non presidiata quella
# domanda non la legge nessuno e il processo resta appeso per sempre. Meglio fallire
# subito e lasciare che la guardia lo dichiari, che e' cio' che le guardie servono a
# fare. Misurato: la prima stesura di questa fase e' rimasta ferma 26 MINUTI su una
# richiesta di password invisibile, e il log si era fermato a meta' senza un errore.
#
# `PGPASSWORD` — e questa e' la CAUSA di quell'attesa. `.pgpass` associa la credenziale
# a un NOME DI DATABASE, e il database di scena ha un nome nuovo (`<nome>_stage`) che
# li' dentro non c'e'. Un difetto che nessuna prova con i finti comandi poteva vedere,
# perche' vive nella configurazione della macchina e non nel codice: l'ha trovato la
# corsa vera, ed e' esattamente il motivo per cui una corsa vera va fatta.
pg_app() {
  PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -w -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$TARGET_DB" "$@"
}
# Imposta due variabili invece di restituire un codice: il lato SINISTRO della pipe
# conta quanto il destro, ed e' il motivo per cui esiste il controllo su `dump_rc`.
stream_dump_restore() {
  set +e
  ssh "${SSH_OPTS[@]}" "$VM_HOST" "sudo -u postgres pg_dump -Fc '$DB_NAME'" \
    | sudo -u postgres "$PG_BIN/pg_restore" --no-acl -p "$PORT" -d "$STAGE_DB"
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

# [S1083 · #236 F1] IL CLONE SI RICOSTRUISCE ACCANTO, E SI SCAMBIA ALLA FINE.
#
# ⚠ COSA C'ERA PRIMA, e perche' e' cambiato. Fino a oggi questo script droppava gli
# schemi del clone (`DROP SCHEMA ... CASCADE`, nome per nome) e SUBITO DOPO li
# ricostruiva dal dump. Il commento di allora diceva che non era un rischio
# aggiuntivo, «la stessa finestra che --clean apre da sempre, su un oggetto
# riproducibile per definizione», e che il controllo su `dump_rc` avrebbe comunque
# dichiarato il database incompleto.
#
# Erano due affermazioni vere e una conclusione sbagliata: **dichiarare che il clone
# e' incompleto non lo ripara**, e nel caso che conta il controllo non gira affatto.
# Misurato in S1083: questo script viene lanciato da `close-propagate.sh` con un
# `ssh` in PRIMO PIANO, senza `nohup` — quindi chiudere la sessione CLI manda
# `SIGHUP` e uccide entrambi i lati della pipe. La finestra fra il DROP e la fine del
# ripristino dura MINUTI (misurata: «193 altri oggetti» in cascata), e chi la
# attraversa non trova un clone vecchio: non trova niente. Ed e' il database su cui
# girano la CI e la verifica lunga di chiusura.
#
# LA CURA, e non e' una guardia in piu': e' togliere la finestra. Si ripristina in un
# database DI SCENA che nasce vuoto accanto a quello vero, si verifica LI', e solo se
# tutto torna si scambiano i due nomi. Lo scambio e' un `ALTER DATABASE ... RENAME`,
# cioe' un aggiornamento di catalogo: istantaneo, non copia un byte.
#
# ⭐ E IL GUADAGNO VERO E' UN ALTRO, che non era lo scopo. Le verifiche che questo
# script gia' faceva — conteggi di righe, censimento degli oggetti — giravano DOPO
# aver sostituito il clone: dicevano «e' divergente» a danno fatto. Ora girano PRIMA
# dello scambio, quindi **un clone divergente non sostituisce mai quello buono**. Da
# referto diventano condizione.
#
# COSA RESTA VERO del ragionamento di prima: `--clean --if-exists` non basterebbe
# comunque (droppa i soli oggetti presenti nel dump, quindi cio' che la produzione ha
# RIMOSSO sopravviverebbe sul clone, rendendolo un sovrainsieme della sorgente — due
# volte, S1050 sulle funzioni di `staging` e D-86 su una tabella fantasma). Con un
# database che nasce vuoto il problema non si pone: non c'e' niente da ripulire, e
# infatti `--clean` e' stato tolto dal ripristino.
#
# `public` non e' piu' un caso speciale. Prima andava escluso a mano — due volte, per
# prudenza — perche' droppandolo cadevano le 5 estensioni che ci vivono dentro
# (pgcrypto, uuid-ossp, pg_trgm, vector, pg_stat_statements). In un database nuovo
# `public` esiste gia' e le estensioni le ricrea il dump: la trappola e' sparita
# insieme al drop, non e' stata aggirata.

# La misura degli schemi resta, e cambia mestiere: prima serviva a decidere COSA
# distruggere, ora a decidere SE sostituire. La guardia «non ho potuto misurare»
# vale ancora, e vale di piu': senza il numero della sorgente non c'e' post-condizione.
Q_SCHEMI="SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%'
          AND nspname NOT IN ('information_schema','public') ORDER BY 1"
sch_vm="$(remote_psql "$Q_SCHEMI" || echo '?')"
if [ "$sch_vm" = '?' ]; then
  echo "[clone-vm-db] FATAL: non ho potuto misurare gli schemi sulla VM — non tocco niente." >&2
  echo "[clone-vm-db] Senza il numero della sorgente non esiste una post-condizione da verificare." >&2
  exit 1
fi
SCHEMI_VM="$(printf '%s
' "$sch_vm" | sed '/^$/d' | sort -u)"
# Un guard che passa su input vuoto non e' un guard: nessun database sano ha zero
# schemi applicativi, quindi un elenco vuoto significa che la misura e' fallita in
# silenzio.
if [ -z "$SCHEMI_VM" ]; then
  echo "[clone-vm-db] FATAL: la VM dichiara ZERO schemi applicativi. Nessun database sano lo e':" >&2
  echo "[clone-vm-db] la misura e' fallita in silenzio. Non procedo." >&2
  exit 1
fi
echo "[clone-vm-db] schemi attesi dalla sorgente: $(printf '%s' "$SCHEMI_VM" | tr '
' ' ')"

# Il database di scena. Un residuo di una corsa interrotta si butta: e' per
# definizione incompleto, ed e' esattamente cio' che questa cura esiste per non
# lasciare piu' al suo posto.
echo "[clone-vm-db] preparo il database di scena: $STAGE_DB"
pg_maint -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$STAGE_DB\"" >/dev/null
# Le proprieta' si copiano da quello vero invece di essere cablate: encoding e
# collazione diverse produrrebbero un clone che ORDINA diversamente dalla sorgente, e
# nessuno dei controlli qui sotto se ne accorgerebbe.
PROPS="$(pg_maint -tAc "SELECT pg_encoding_to_char(encoding)||'|'||datcollate||'|'||datctype
                          FROM pg_database WHERE datname='$DB_NAME'" || echo '')"
if [ -z "$PROPS" ]; then
  echo "[clone-vm-db] FATAL: non ho letto encoding/collazione del database vero." >&2
  exit 1
fi
ENC="${PROPS%%|*}"; REST="${PROPS#*|}"; COLL="${REST%%|*}"; CTYPE="${REST##*|}"
pg_maint -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$STAGE_DB\" OWNER \"$DBUSER\"
  TEMPLATE template0 ENCODING '$ENC' LC_COLLATE '$COLL' LC_CTYPE '$CTYPE'" >/dev/null

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

# [S1083 · #236 F1] GLI SCHEMI ATTESI CI SONO TUTTI?
#
# La misura fatta all'inizio sulla sorgente serviva a decidere cosa distruggere; qui
# diventa la post-condizione che decide se sostituire. Un dump troncato che si ferma
# a meta' puo' lasciare uno schema intero mancante e superare i conteggi di riga —
# perche' quelle tre tabelle stanno tutte in `sys`, e `staging` o `audit` potrebbero
# non esserci affatto.
sch_stage="$(pg_super -tAc "$Q_SCHEMI" 2>>"$ERRLOG" || echo '?')"
if [ "$sch_stage" = '?' ]; then
  echo "  schemi del database di scena  NON MISURATI"
  mismatch=1; unmeasured=1
else
  SCHEMI_STAGE="$(printf '%s\n' "$sch_stage" | sed '/^$/d' | sort -u)"
  if [ "$SCHEMI_STAGE" = "$SCHEMI_VM" ]; then
    echo "  schemi                    OK  ($(printf '%s' "$SCHEMI_VM" | wc -w) presenti, come la sorgente)"
  else
    echo "  schemi                    DIFF" >&2
    echo "    VM    : $(printf '%s' "$SCHEMI_VM" | tr '\n' ' ')" >&2
    echo "    scena : $(printf '%s' "$SCHEMI_STAGE" | tr '\n' ' ')" >&2
    mismatch=1
  fi
fi

if [ "$mismatch" -ne 0 ]; then
  # ⭐ [S1083 · #236 F1] E QUI STA IL GUADAGNO: uscire di qui NON lascia macerie.
  # Il database vero non e' mai stato toccato — tutto quello che si e' fatto finora
  # e' avvenuto su `$STAGE_DB`. Il clone precedente e' ancora al suo posto, completo
  # e interrogabile, e la CI che gira su questa macchina non se ne accorge nemmeno.
  # Prima di oggi, arrivare a questo `exit 1` significava lasciare un database
  # mutilato con un messaggio che lo spiegava.
  echo "[clone-vm-db] il database di scena NON verra' scambiato: $DB_NAME resta quello di prima." >&2
  # Il residuo di scena si tiene apposta: e' il corpo del reato, e la corsa successiva
  # lo butta da se'. Buttarlo qui vorrebbe dire cancellare l'unica prova di cosa e'
  # andato storto, un minuto prima che qualcuno la guardi.
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
# ── [S1083 · #236 F1] LO SCAMBIO ────────────────────────────────────────────────
#
# Da qui in poi il database di scena e' verificato: schemi, righe e censimento degli
# oggetti tornano tutti. Lo scambio e' un aggiornamento di catalogo — `ALTER DATABASE
# ... RENAME` non copia un byte e non riscrive file: e' istantaneo qualunque sia la
# dimensione del database.
#
# ⚠ PERCHE' NON E' UNA SOLA TRANSAZIONE, dichiarato invece che nascosto: PostgreSQL
# non ammette `ALTER DATABASE ... RENAME` dentro un blocco transazionale. I due
# rinomini sono quindi due istruzioni separate, e fra l'una e l'altra c'e' una
# finestra — di MILLISECONDI, contro i MINUTI di prima, e soprattutto **riparabile**:
# se il secondo fallisce, il dato non e' perduto, si chiama `$OLD_DB` e il messaggio
# qui sotto dice esattamente come rimetterlo a posto. La differenza fra le due
# finestre non e' di grado: in una si perde il database, nell'altra si perde il suo
# nome.
#
# ⚠ LE CONNESSIONI NON SI PRE-CONTROLLANO, SI PROVA E BASTA — e la prima stesura di
# questa fase sbagliava proprio qui.
#
# Chiedere «c'e' qualcuno collegato?» e poi rinominare significa decidere su una
# misura di un istante prima: e' la «misura ereditata» che il metodo di bonifica
# vieta, e non e' teoria — misurato oggi, il pre-controllo ha bloccato uno scambio
# per **una** connessione anonima che stava gia' chiudendosi, lasciata dalle
# verifiche appena concluse. Un istante dopo non c'era piu' nessuno.
#
# Il rinomino invece **e'** la misura: fallisce da se' se qualcuno e' collegato, e lo
# fa nel momento esatto in cui conta. Quello che va aggiunto non e' un controllo
# prima, e' una DIAGNOSI dopo: il messaggio di PostgreSQL dice che il database e' in
# uso e non dice DA CHI, ed e' quella la mezz'ora di archeologia da risparmiare.
rinomina() { # <da> <a> — ritorna 1 e lascia la diagnosi in `$diagnosi`
  local da="$1" a="$2"
  diagnosi=""
  if pg_maint -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$da\" RENAME TO \"$a\"" >/dev/null 2>"$ERRLOG.ren"; then
    return 0
  fi
  diagnosi="$(sed 's/^/    | /' "$ERRLOG.ren" 2>/dev/null | head -4)"
  local chi
  chi="$(pg_maint -tAc "SELECT string_agg(DISTINCT coalesce(nullif(application_name,''),'(anonimo)')||' ['||state||']', ', ')
                          FROM pg_stat_activity
                         WHERE datname = '$da' AND pid <> pg_backend_pid()" 2>/dev/null || echo '?')"
  [ -n "$chi" ] && diagnosi="$diagnosi"$'\n'"    | collegati a $da: $chi"
  return 1
}

echo "[clone-vm-db] scambio: $DB_NAME -> $OLD_DB, $STAGE_DB -> $DB_NAME"
pg_maint -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$OLD_DB\"" >/dev/null
if ! rinomina "$DB_NAME" "$OLD_DB"; then
  echo "[clone-vm-db] FATAL: non ho potuto mettere da parte il clone attuale." >&2
  printf '%s\n' "$diagnosi" >&2
  echo "[clone-vm-db] NIENTE E' PERDUTO: il clone attuale e' intatto e quello nuovo, gia'" >&2
  echo "[clone-vm-db] verificato, aspetta in '$STAGE_DB'. Libera le connessioni e rilancia." >&2
  exit 1
fi
if ! rinomina "$STAGE_DB" "$DB_NAME"; then
  # La finestra di millisecondi, e cosa fare se ci si capita dentro. Non e' una
  # rassicurazione: e' il comando, perche' chi legge questo messaggio ha il database
  # che si chiama con un altro nome e ha bisogno di sapere quale.
  echo "[clone-vm-db] FATAL: il secondo rinomino e' fallito. IL DATO NON E' PERDUTO." >&2
  printf '%s\n' "$diagnosi" >&2
  echo "[clone-vm-db] Il clone precedente si chiama ora '$OLD_DB' e quello nuovo '$STAGE_DB'." >&2
  echo "[clone-vm-db] Per tornare com'era:  ALTER DATABASE \"$OLD_DB\" RENAME TO \"$DB_NAME\";" >&2
  exit 1
fi
# Da questo punto `$DB_NAME` e' il clone nuovo, quindi le prossime interrogazioni
# devono andare li'. Vale per chi aggiungera' verifiche dopo lo scambio.
TARGET_DB="$DB_NAME"
# Il vecchio si butta solo ADESSO, a scambio riuscito. Tenerlo fin qui e' costato
# spazio (misurato: 635 MB su 99 GB liberi) e ha comprato l'unica cosa che conta —
# che in nessun istante di questa procedura esista un momento senza clone.
pg_maint -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$OLD_DB\"" >/dev/null
echo "[clone-vm-db] done (scambiato: in nessun istante $DB_NAME e' rimasto senza dati)"
