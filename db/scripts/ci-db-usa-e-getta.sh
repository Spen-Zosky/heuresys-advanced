#!/usr/bin/env bash
# ============================================================================
# db/scripts/ci-db-usa-e-getta.sh — ogni corsa della CI ha il SUO database.
#
# PERCHÉ (Enzo, 2026-11-18, «Ricostruisci e isola»). Fino a oggi tutte le corse scrivevano nello
# stesso `heuresys_ci` del gemello: la catena delle migrazioni di un ramo vi restava applicata anche
# per le corse degli altri rami. Il 17-18/11 una migrazione di una PR ha lasciato due righe di registro,
# una prova a mano ha lasciato due tabelle, e per ore ogni PR e main sono state rosse per colpe non loro.
#
# COSA FA. `heuresys_ci` diventa il MODELLO e nessuna corsa lo tocca più:
#   crea <job>   copia il modello in `heuresys_corsa_<ora>_<corsa>_<tentativo>_<job>_ci`
#                (copia di file, ~20 s), ne copia i permessi di connessione, e scrive POSTGRES_DB e
#                POSTGRES_DATABASE in $GITHUB_ENV per i passi successivi. Prima toglie le copie di
#                corse finite da più di 12 ore che fossero rimaste (corsa uccisa a metà).
#   controlla    esce rosso se il passo corrente non punta alla copia della corsa: un'eventuale
#                precedenza dell'ambiente del job sul $GITHUB_ENV si vedrebbe qui, non nei dati.
#   rimuovi      cancella la copia della corsa (`if: always()` nel workflow).
#
# Il nome finisce in `_ci`: è il modo in cui le guardie dei seed (`collaudo-guard.mjs`) riconoscono un
# database di collaudo, e il prefisso `heuresys_corsa_` è l'unico spazio in cui questo script cancella.
# Si aggiorna il modello con db/scripts/setup-ci-database.sh, fuori dalle corse.
# ============================================================================
set -euo pipefail

MODELLO="${CI_DB_MODELLO:-heuresys_ci}"
PROPRIETARIO="${CI_DB_PROPRIETARIO:-${POSTGRES_USER:-heuresys}}"
pg() { sudo -n -u postgres psql -v ON_ERROR_STOP=1 -tA "$@"; }
die() { echo "[ci-db] FATALE: $*" >&2; exit 1; }

nel_mio_spazio() {
  case "$1" in heuresys_corsa_*_ci) return 0 ;; *) return 1 ;; esac
}

spazza_vecchie() {
  local soglia d ts
  soglia="$(date -u -d '12 hours ago' +%Y%m%d%H%M%S)"
  pg -c "SELECT datname FROM pg_database WHERE datname LIKE 'heuresys\_corsa\_%\_ci'" | while read -r d; do
    [ -n "$d" ] && nel_mio_spazio "$d" || continue
    ts="${d#heuresys_corsa_}"; ts="${ts%%_*}"
    case "$ts" in [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) continue ;; esac
    if [ "$ts" \< "$soglia" ]; then
      echo "[ci-db] tolgo la copia rimasta di una corsa vecchia: $d"
      sudo -n -u postgres dropdb --force --if-exists "$d" || true
    fi
  done
}

crea() {
  local job="${1:?crea vuole il nome del job}" nome i acl
  job="$(printf '%s' "$job" | tr -c 'a-z0-9' '_' | cut -c1-12)"
  nome="heuresys_corsa_$(date -u +%Y%m%d%H%M%S)_${GITHUB_RUN_ID:-locale}_${GITHUB_RUN_ATTEMPT:-1}_${job}_ci"
  nome="$(printf '%s' "$nome" | tr -s '_')"
  [ "${#nome}" -le 63 ] || die "nome troppo lungo per PostgreSQL: $nome"
  nel_mio_spazio "$nome" || die "nome fuori dallo spazio delle copie: $nome"
  [ "$(pg -c "SELECT count(*) FROM pg_database WHERE datname='$MODELLO'")" = "1" ] || die "il modello $MODELLO non esiste"

  spazza_vecchie

  # La copia pretende zero connessioni sul modello: se una corsa vecchia (ramo che non ha ancora
  # questo script) ci sta lavorando, si aspetta invece di interromperla.
  for i in $(seq 1 40); do
    if sudo -n -u postgres createdb -O "$PROPRIETARIO" -T "$MODELLO" "$nome" 2>/dev/null; then break; fi
    [ "$i" = 40 ] && die "il modello $MODELLO resta occupato da 10 minuti: non posso copiarlo"
    echo "[ci-db] il modello è in uso, riprovo fra 15 secondi ($i/40)"
    sleep 15
  done

  # I permessi di connessione al database non viaggiano con la copia: si riportano uguali.
  acl="$(pg -c "SELECT string_agg(format('GRANT %s ON DATABASE %I TO %I', a.privilege_type, '$nome', r.rolname), '; ')
                 FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a
                 JOIN pg_roles r ON r.oid = a.grantee
                WHERE d.datname = '$MODELLO' AND a.grantee <> 0")"
  [ -n "$acl" ] && pg -c "$acl" >/dev/null
  if pg -c "SELECT NOT has_database_privilege('public', '$MODELLO', 'CONNECT')" | grep -q t; then
    pg -c "REVOKE CONNECT ON DATABASE \"$nome\" FROM PUBLIC" >/dev/null
  fi

  echo "[ci-db] copia della corsa pronta: $nome (dal modello $MODELLO)"
  if [ -n "${GITHUB_ENV:-}" ]; then
    { echo "POSTGRES_DB=$nome"; echo "POSTGRES_DATABASE=$nome"; echo "CI_DB_CORSA=$nome"; } >> "$GITHUB_ENV"
  else
    echo "$nome"
  fi
}

controlla() {
  local n="${CI_DB_CORSA:-}"
  [ -n "$n" ] && nel_mio_spazio "$n" || die "CI_DB_CORSA assente o fuori spazio: la copia della corsa non è stata creata"
  [ "${POSTGRES_DB:-}" = "$n" ] || die "POSTGRES_DB=${POSTGRES_DB:-<vuoto>} invece di $n: i passi andrebbero sul database sbagliato"
  [ "$(pg -c "SELECT count(*) FROM pg_database WHERE datname='$n'")" = "1" ] || die "la copia $n non esiste"
  echo "[ci-db] i passi della corsa usano $n"
}

rimuovi() {
  local n="${CI_DB_CORSA:-}"
  if [ -z "$n" ]; then echo "[ci-db] nessuna copia da togliere"; return 0; fi
  nel_mio_spazio "$n" || die "rifiuto di cancellare $n: non è una copia di corsa"
  sudo -n -u postgres dropdb --force --if-exists "$n"
  echo "[ci-db] copia della corsa tolta: $n"
}

case "${1:-}" in
  crea) shift; crea "$@" ;;
  controlla) controlla ;;
  rimuovi) rimuovi ;;
  *) echo "uso: $0 crea <job> | controlla | rimuovi" >&2; exit 2 ;;
esac
