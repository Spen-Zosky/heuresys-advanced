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

# --- 3. IL CANCELLO CI: L'ULTIMO ESITO PER WORKFLOW, NON L'ESITO DI OGNI COMMIT.
#
#     IL DEPLOY NON PORTA UN COMMIT: PORTA UNA FINESTRA (#212, gemello — S1067).
#     `vm-deploy` porta in produzione TUTTO cio' che sta fra LAST_GOOD e ARMED, e un commit
#     di soli documenti ha UNA sola corsa (State lint): il 2026-08-16 il verde di `5d3028ca`
#     (solo docs/kb/) ha autorizzato il rollout del codice di `b6132910`, dove «Test (api
#     integration)», «Playwright smoke» e «Build (web)» erano ancora in volo. La produzione
#     non e' rimasta indietro: e' andata AVANTI rispetto a cio' che era stato verificato.
#
#     La prima cura fu «ogni commit di codice nella finestra dev'essere verde». Curava #212
#     e apriva D-87: LA STORIA NON SI RISCRIVE, quindi un commit rotto e poi CORRETTO resta
#     rosso per sempre e blocca la produzione per sempre. Misurato il 2026-08-21: `61ea8b90`
#     rotto e gia' corretto dal commit successivo ha tenuto ferma la produzione a ogni tick
#     per un'ora, e si e' sbloccata solo a mano.
#
#     IL CRITERIO GIUSTO STA UN GRADINO PIU' IN LA', e li' stanno entrambi i casi:
#
#       La CI verifica l'ALBERO, non il diff. Un verde del workflow W su un commit C
#       certifica l'albero a C per intero, antenati inclusi. Quindi serve, per ogni
#       workflow W visto nella finestra, il verde di W sul commit PIU' RECENTE che ha
#       eseguito W. Un rosso di W su un antenato e' irrilevante: quell'albero non va
#       in produzione — ci va quello di ARMED.
#
#     #212 ci sta dentro senza clausole: un ARMED di soli documenti non ha corse di codice,
#     quindi il commit piu' recente che ha eseguito «Test (api integration)» e' quello di
#     codice sotto, in volo o rosso, e il cancello blocca. D-87 si scioglie: il workflow
#     rotto e poi corretto ha il suo esito piu' recente verde, e si parte.
#
#     Restano interrogati SOLO ARMED + i commit che toccano path di deploy: non e' una
#     scorciatoia, e' il tetto delle chiamate all'API pubblica di GitHub (60/ora per IP,
#     senza token). Un commit di soli documenti in mezzo alla finestra non porta esiti che
#     ARMED non abbia gia'.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-paths.sh"   # accanto allo script, non a $ROOT: regge anche in una fixture (S1069)

# Gli sha da interrogare, DAL PIU' RECENTE AL PIU' VECCHIO — l'ordine E' il criterio:
# la prima riga che nomina un workflow e' il suo esito piu' recente. `git rev-list` li
# rende gia' in ordine decrescente, e ARMED va davanti a tutti.
SHAS="$ARMED"
if git merge-base --is-ancestor "$LAST_GOOD" "$ARMED" 2>/dev/null; then
  for c in $(git rev-list "$LAST_GOOD..$ARMED" 2>/dev/null | grep -v "^$ARMED$" || true); do
    [ -n "$(git diff --name-only "$c^" "$c" 2>/dev/null | grep -E "$DEPLOY_PATHS_RE" || true)" ] || continue
    SHAS="$SHAS $c"
  done
else
  # LAST_GOOD non e' un antenato di ARMED (storia riscritta, o produzione avanti): la
  # finestra non e' calcolabile. Si dichiara, non si finge di averla guardata.
  say "finestra non calcolabile (${LAST_GOOD:0:8} non e' antenato di ${ARMED:0:8}) — verificato il solo sha armato"
fi

RIGHE=""
for s in $SHAS; do
  set +e
  esiti_s="$(bash "$REPO_DIR/scripts/ci-gate.sh" --esiti "$s" 2>/dev/null)"
  rc_s=$?
  set -e
  if [ "$rc_s" -ne 0 ]; then
    # ci-gate --esiti fallisce CHIUSO sull'API irraggiungibile, e qui si propaga uguale:
    # un cancello che si apre quando non riesce a guardare non e' un cancello.
    err "IMPOSSIBILE LEGGERE la CI di ${s:0:8} — non deployo nel dubbio (R3)."
    exit 1
  fi
  [ -n "$esiti_s" ] || continue
  RIGHE="$RIGHE$(printf '%s' "$esiti_s" | awk -v s="$s" '{print $1, $2, s}')
"
done

if [ -z "$RIGHE" ]; then
  # Nessuna corsa su nessuno degli sha guardati: e' il caso docs-only puro. Non si inventa
  # un verdetto — si delega a ci-gate, che ha gia' il ripiego dichiarato «i workflow chiave
  # devono essere verdi sull'ultimo main», ed e' l'unico posto dove quel ripiego vive.
  say "nessuna corsa sugli sha della finestra — ripiego sul cancello di ci-gate"
  set +e
  CI_GATE_NONBLOCKING=1 bash "$REPO_DIR/scripts/ci-gate.sh" "$ARMED"
  gate=$?
  set -e
  case "$gate" in
    0)  say "CI verde su ${ARMED:0:8}" ;;
    75) say "CI ancora in volo su ${ARMED:0:8} — riprovo al prossimo tick"; exit 0 ;;
    *)  if [ "$(cat "$STATE_FILE" 2>/dev/null || true)" = "red:$ARMED" ]; then
          say "CI non verde su ${ARMED:0:8} — gia' segnalato, resto zitto"; exit 0
        fi
        printf 'red:%s\n' "$ARMED" > "$STATE_FILE"
        err "CI NON VERDE sullo sha armato ${ARMED:0:8} — deploy non eseguito (R3: la CI rossa si corregge, non si aggira)"
        exit 1 ;;
  esac
else
  # `!visto[$2]++` tiene la PRIMA riga per nome di workflow: siccome le righe scendono dal
  # commit piu' recente, la prima E' l'esito piu' recente. E' qui, in una riga di awk, che
  # sta tutta la differenza fra il cancello di prima e questo.
  ULTIMI="$(printf '%s' "$RIGHE" | awk 'NF && !visto[$2]++')"
  ROSSO="$(printf '%s\n' "$ULTIMI" | awk '$1=="RED" {print; exit}')"
  VOLO="$(printf '%s\n'  "$ULTIMI" | awk '$1=="PENDING" {print; exit}')"

  # Il rosso batte l'in-volo: un workflow gia' fallito non diventa verde aspettando, e
  # segnalarlo subito e' il punto di tutto il meccanismo OnFailure.
  if [ -n "$ROSSO" ]; then
    wf="$(printf '%s' "$ROSSO" | awk '{print $2}')"; c="$(printf '%s' "$ROSSO" | awk '{print $3}')"
    # Si segnala UNA volta per sha: ripeterlo ogni 5 minuti trasformerebbe un allarme in
    # rumore, e un allarme che nessuno legge piu' non e' un allarme.
    if [ "$(cat "$STATE_FILE" 2>/dev/null || true)" = "red:$c" ]; then
      say "CI non verde su ${c:0:8} — gia' segnalato, resto zitto"; exit 0
    fi
    printf 'red:%s\n' "$c" > "$STATE_FILE"
    if [ "$c" = "$ARMED" ]; then
      err "CI NON VERDE sullo sha armato ${ARMED:0:8} ($wf) — deploy non eseguito (R3: la CI rossa si corregge, non si aggira)"
    else
      err "CI NON VERDE: '$wf' e' rosso a ${c:0:8}, che sta DENTRO la finestra di questo deploy (${LAST_GOOD:0:8}..${ARMED:0:8})"
      err "        Ed e' l'esito PIU' RECENTE di quel workflow nella finestra: nessun commit a valle l'ha rifatto verde."
      err "        Se e' gia' stato corretto, il rimedio e' un commit che faccia ripartire '$wf' — non un aggiramento."
    fi
    exit 1
  fi

  if [ -n "$VOLO" ]; then
    wf="$(printf '%s' "$VOLO" | awk '{print $2}')"; c="$(printf '%s' "$VOLO" | awk '{print $3}')"
    if [ "$c" = "$ARMED" ]; then
      say "CI ancora in volo su ${ARMED:0:8} ($wf) — riprovo al prossimo tick"
    else
      say "CI ancora in volo: '$wf' a ${c:0:8}, DENTRO la finestra ${LAST_GOOD:0:8}..${ARMED:0:8} — non deployo, riprovo al prossimo tick"
    fi
    exit 0
  fi

  say "finestra ${LAST_GOOD:0:8}..${ARMED:0:8} verificata: $(printf '%s\n' "$ULTIMI" | grep -c .) workflow, ultimo esito verde per ognuno"
fi

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
