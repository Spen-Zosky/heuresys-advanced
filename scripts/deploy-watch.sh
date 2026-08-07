#!/usr/bin/env bash
# ============================================================================
# scripts/deploy-watch.sh — #165: il deploy si sgancia dalla chiusura di sessione.
#
# PERCHE' ESISTE
# --------------
# Fino a S1048 il cancello CI stava DENTRO il deploy, e il deploy DENTRO la chiusura:
#   close-propagate.sh -> align-clones.sh --auto-deploy -> vm-deploy-remote.sh
#   -> vm-deploy.sh:81 -> ci-gate.sh  (polling fino a CI_GATE_WAIT=900s)
# Cioe' la sessione restava aperta a guardare un controllo che non richiede nessuno
# che guardi. Misura S1048: un giro completo di CI vale 20-30 minuti su una sola
# macchina self-hosted, e la chiusura in se' e' di pochi minuti.
#
# Questo one-shot, chiamato da heuresys-advanced-deploy-watch.timer ogni 5 minuti,
# prende su di se' l'attesa: la sessione si chiude quando stato, commit e push sono
# fatti, e il deploy parte da solo quando la CI diventa verde.
#
# NON E' DEPLOY CONTINUO — E' DEPLOY ARMATO
# -----------------------------------------
# Un sorvegliante che deploya OGNI main verde aggirerebbe in silenzio il veto S1030
# (HEURESYS_CLOSE_NODEPLOY=1, che impedisce al ciclo non presidiato di mandare in
# produzione alle 03:00 senza nessuno che guardi) e deployerebbe anche i push di meta'
# sessione: in S1048 sarebbero stati TRE deploy invece di uno.
#
# Quindi la chiusura ARMA: spinge `refs/heads/prod` sullo stesso sha di `main`.
# Qui si agisce solo se `origin/prod == origin/main`, cioe' «la punta attuale e'
# quella autorizzata». Con il veto attivo la chiusura non arma e qui non succede
# nulla: il veto e' preservato per costruzione, non per promessa.
#
# Caso limite dichiarato: se una sessione arma e la successiva pusha prima che il
# timer scatti, `main` supera `prod` e il deploy armato NON parte piu'. E' il verso
# giusto in cui sbagliare — non si manda mai in produzione cio' che nessuno ha
# autorizzato — e la chiusura successiva riarma da se'.
#
# COSA NON DEVE FARE
# ------------------
# Non trasporta codice. `align-clones.sh:143` porta gia' il repo dei due host a
# origin/main con `git reset --hard` PRIMA di questo punto, quindi le macchine hanno
# gia' il codice giusto: qui manca solo build + restart, che e' `vm-deploy.sh`.
#
# ESITI (le tre uscite sono deliberatamente distinte)
#   0  — non c'era niente da fare, oppure il deploy e' riuscito
#   1  — CI ROSSA sullo sha armato, o il deploy e' fallito (OnFailure registra)
#   !=0 da vm-deploy.sh — propagato cosi' com'e'
# «CI ancora in volo» NON e' un fallimento: ci-gate esce 75 e qui diventa 0 silenzioso.
#
# Uso: bash scripts/deploy-watch.sh   (di norma via systemd; a mano per diagnosi)
# Env: REPO_DIR PUBLIC_HOST API_PORT WEB_PORT  (resi dall'unit) · DEPLOY_WATCH_DRYRUN=1
# ============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
ARM_REF="${DEPLOY_ARM_REF:-prod}"
STATE_FILE="${DEPLOY_WATCH_STATE:-$REPO_DIR/.deploy-watch-state}"
LOCK_FILE="${DEPLOY_WATCH_LOCK:-$REPO_DIR/.deploy-watch.lock}"

say()  { printf '[deploy-watch] %s\n' "$*"; }
err()  { printf '[deploy-watch] %s\n' "$*" >&2; }

# --- lock: un deploy dura minuti, il timer scatta ogni 5. Due deploy sovrapposti
#     sullo stesso repo (git reset --hard + pnpm install) si corromperebbero a vicenda.
#     flock non-bloccante: se il giro precedente e' ancora dentro, questo esce e basta.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    say "un giro precedente e' ancora in corso — salto questo tick"
    exit 0
  fi
fi

cd "$REPO_DIR"

# --- 1. stato remoto. `git fetch origin` porta anche refs/heads/prod con il refspec
#     standard; se il remoto non ha (ancora) la ref, rev-parse fallisce ed e' il caso
#     normale «nessuno ha mai armato», non un errore.
git fetch origin --quiet --prune 2>/dev/null || { err "git fetch fallito — riprovo al prossimo tick"; exit 0; }

ARMED="$(git rev-parse --verify --quiet "origin/$ARM_REF" || true)"
TIP="$(git rev-parse --verify --quiet "origin/$BRANCH" || true)"

if [ -z "$ARMED" ]; then
  say "nessun deploy armato (origin/$ARM_REF non esiste) — niente da fare"
  exit 0
fi
if [ -z "$TIP" ]; then
  err "origin/$BRANCH non risolvibile — riprovo al prossimo tick"
  exit 0
fi
if [ "$ARMED" != "$TIP" ]; then
  say "armato ${ARMED:0:8} ma origin/$BRANCH e' a ${TIP:0:8} — la punta non e' piu' quella autorizzata, non deployo"
  exit 0
fi

# --- 2. cosa gira davvero. Lo scrive vm-deploy.sh:245 alla fine di un deploy RIUSCITO.
#     Dottrina del dubbio (align-clones.sh:85-113): se il file manca o non e' uno sha,
#     lo stato e' IGNOTO e un'azione cara non si esegue nel dubbio.
LAST_GOOD_FILE="$REPO_DIR/pg_dump_snapshots/LAST_GOOD_SHA"
LAST_GOOD="$(tr -d '[:space:]' < "$LAST_GOOD_FILE" 2>/dev/null || true)"
if ! printf '%s' "$LAST_GOOD" | grep -qE '^[0-9a-f]{40}$'; then
  err "IGNOTO: $LAST_GOOD_FILE assente o non contiene uno sha — non deployo nel dubbio."
  err "        Esegui UNA volta a mano 'bash scripts/vm-deploy.sh' su questo host per stabilire il riferimento."
  exit 0
fi

if [ "$ARMED" = "$LAST_GOOD" ]; then
  say "gia' in produzione (${ARMED:0:8}) — niente da fare"
  exit 0
fi

say "armato ${ARMED:0:8}, in produzione ${LAST_GOOD:0:8} — verifico la CI"

# --- 3. cancello CI, in modo non bloccante: un one-shot non deve dormire 15 minuti.
set +e
CI_GATE_NONBLOCKING=1 bash "$REPO_DIR/scripts/ci-gate.sh" "$ARMED"
gate=$?
set -e
case "$gate" in
  0)  say "CI verde su ${ARMED:0:8}" ;;
  75) say "CI ancora in volo su ${ARMED:0:8} — riprovo al prossimo tick"; exit 0 ;;
  *)  # ROSSA (o API irraggiungibile: ci-gate fallisce CHIUSO, ed e' giusto cosi').
      # Si segnala UNA volta per sha: ripeterlo ogni 5 minuti trasformerebbe un
      # allarme in rumore, e un allarme che nessuno legge piu' non e' un allarme.
      if [ "$(cat "$STATE_FILE" 2>/dev/null || true)" = "red:$ARMED" ]; then
        say "CI non verde su ${ARMED:0:8} — gia' segnalato, resto zitto"
        exit 0
      fi
      printf 'red:%s\n' "$ARMED" > "$STATE_FILE"
      err "CI NON VERDE sullo sha armato ${ARMED:0:8} — deploy non eseguito (R3: la CI rossa si corregge, non si aggira)"
      exit 1 ;;
esac

if [ "${DEPLOY_WATCH_DRYRUN:-0}" = "1" ]; then
  say "DRY-RUN — qui partirebbe: vm-deploy.sh su ${ARMED:0:8}"
  exit 0
fi

# --- 4. deploy. SERVICE_USER si deriva dall'utente che sta girando: l'unit e' resa
#     con User=ubuntu sulla VM e User=enzo sul linux-pc dalla sed di vm-deploy.sh:167,
#     quindi `id -un` e' gia' la risposta giusta e non serve un placeholder in piu'
#     (uno non coperto dalla sed aborta il deploy — vm-deploy.sh:171).
export SERVICE_USER="${SERVICE_USER:-$(id -un)}"
say "deploy di ${ARMED:0:8} (utente $SERVICE_USER, repo $REPO_DIR)"
rm -f "$STATE_FILE"
exec bash "$REPO_DIR/scripts/vm-deploy.sh"
