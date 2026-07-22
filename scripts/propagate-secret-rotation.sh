#!/usr/bin/env bash
#
# scripts/propagate-secret-rotation.sh — D-60: canale ESPLICITO e opt-in per
# propagare una credenziale RUOTATA ai .env remoti.
#
# `env-key-merge.sh` è additive-only by-design (mai overwrite): giusto per la
# topologia per-macchina, ma una rotazione (es. TEST_ADMIN_PASSWORD, S1014)
# restava stale sui cloni finché non si interveniva a mano (scoperto S1023:
# login demo PROD 401). Questo script fa l'OPPOSTO, solo su richiesta e solo
# per le chiavi NOMINATE: sovrascrive sul remoto il valore locale delle chiavi
# passate. MAI automatico, MAI chiamato dai flussi di allineamento.
#
# Guard-rail:
#   • rifiuta le chiavi di topologia per-macchina e i gate per-host (stessa
#     classe della denylist di env-key-merge): una "rotazione" su quelle
#     romperebbe la topologia del clone;
#   • la chiave deve esistere sia in locale sia sul remoto (rotazione =
#     sostituzione; una chiave nuova viaggia col canale additivo);
#   • backup del .env remoto prima di toccare qualunque valore.
#
# Usage:      bash scripts/propagate-secret-rotation.sh <ssh_host> <remote_repo_path> KEY [KEY...]
#   es.:      bash scripts/propagate-secret-rotation.sh oracle-vm-default /home/ubuntu/heuresys-advanced TEST_ADMIN_PASSWORD
# Test mode:  ENV_ROTATE_LOCAL=1 bash scripts/propagate-secret-rotation.sh <target_env> <source_env> KEY [KEY...]
#             (D-19: stessa funzione, due file locali, no ssh; stampa il numero di chiavi ruotate)
# Overridable env: LOCAL_ENV
set -euo pipefail
export MSYS_NO_PATHCONV=1

# Chiavi MAI ruotabili da questo canale: topologia per-macchina + gate per-host
# (superset della denylist di env-key-merge.sh — stessa classe di rischio).
ROTATION_REFUSELIST=" POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_SSL PORT HOST COOKIE_SECURE TRUST_PROXY API_BASE_URL WEB_BASE_URL PUBLIC_BASE_URL ADMIN_ORIGIN MFA_ENFORCEMENT_ENABLED MATCHING_FREETEXT_ENABLED API_DOCS_ENABLED VOYAGE_API_KEY PROM_METRICS_ENABLED TENANT_PROVISION_ENABLED BROWNFIELD_ENGINE_ENABLED "

# Sostituisce in $1 (target env) il valore delle chiavi $3.. col valore letto da
# $2 (source env). CRLF-tolerant. Richiede la chiave presente in ENTRAMBI i file.
# Echo del numero di chiavi ruotate; exit 1 se una chiave è rifiutata o assente.
rotate_keys_into() {
  local target="$1" src="$2"; shift 2
  local rotated=0 key val line
  for key in "$@"; do
    case " POSTGRES_HOST POSTGRES_PORT POSTGRES_DB POSTGRES_USER POSTGRES_SSL PORT HOST COOKIE_SECURE TRUST_PROXY API_BASE_URL WEB_BASE_URL PUBLIC_BASE_URL ADMIN_ORIGIN MFA_ENFORCEMENT_ENABLED MATCHING_FREETEXT_ENABLED API_DOCS_ENABLED VOYAGE_API_KEY PROM_METRICS_ENABLED TENANT_PROVISION_ENABLED BROWNFIELD_ENGINE_ENABLED " in
      *" $key "*) echo "REFUSED: $key è topologia/gate per-macchina, non ruotabile da questo canale" >&2; return 1 ;;
    esac
    # ultimo valore locale (last-wins, come il parsing dotenv)
    line="$(grep "^${key}=" "$src" | tail -n1 || true)"
    line="${line%$'\r'}"
    if [ -z "$line" ]; then echo "MISSING(local): $key non presente nel .env sorgente" >&2; return 1; fi
    if ! grep -q "^${key}=" "$target"; then
      echo "MISSING(remote): $key non presente nel .env di destinazione (usa il canale additivo)" >&2; return 1
    fi
    val="${line#*=}"
    # riscrittura sicura senza sed -i (valori con caratteri arbitrari): awk su temp
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS=""} index($0, k"=")==1 {print k"="v; next} {print}' \
      "$target" > "$target.rotate-tmp" && mv "$target.rotate-tmp" "$target"
    rotated=$((rotated+1))
  done
  echo "$rotated"
}

if [ "${ENV_ROTATE_LOCAL:-0}" = 1 ]; then
  target="${1:?test mode: propagate-secret-rotation.sh <target_env> <source_env> KEY...}"
  src="${2:?test mode: propagate-secret-rotation.sh <target_env> <source_env> KEY...}"
  shift 2
  rotate_keys_into "$target" "$src" "$@"
  exit 0
fi

SSH_HOST="${1:?usage: propagate-secret-rotation.sh <ssh_host> <remote_repo_path> KEY...}"
REMOTE_REPO="${2:?usage: propagate-secret-rotation.sh <ssh_host> <remote_repo_path> KEY...}"
shift 2
[ $# -ge 1 ] || { echo "nessuna chiave indicata — la propagazione è sempre esplicita" >&2; exit 1; }
LOCAL_ENV="${LOCAL_ENV:-$(git rev-parse --show-toplevel)/.env}"
[ -f "$LOCAL_ENV" ] || { echo "local .env not found: $LOCAL_ENV" >&2; exit 1; }

remote_env="$REMOTE_REPO/.env"
stamp="$(date +%Y%m%dT%H%M%SZ)"
tmp="/tmp/.env.rotation-src.$stamp"

scp -q "$LOCAL_ENV" "$SSH_HOST:$tmp"
ssh -o BatchMode=yes "$SSH_HOST" "
  set -e
  if [ ! -f '$remote_env' ]; then
    echo 'remote .env missing — run vm-bootstrap.sh first' >&2; rm -f '$tmp'; exit 1
  fi
  cp '$remote_env' '$remote_env.bak-$stamp'
  $(declare -f rotate_keys_into)
  rotated=\$(rotate_keys_into '$remote_env' '$tmp' $*)
  rm -f '$tmp'
  echo \"  [.env] rotated \$rotated key(s) on $remote_env (backup .bak-$stamp; tutte le altre chiavi intatte)\"
"
echo "NOTA: se la chiave è consumata da un servizio (API/web), riavvia i servizi sul target (vm-deploy o systemctl restart)."
