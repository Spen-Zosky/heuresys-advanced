#!/usr/bin/env bash
#
# scripts/atlante-automatico.sh — l'atlante si rigenera da solo sulla VM (piano di pulizia, voce A2).
#
# PERCHE' ESISTE (Enzo, 2026-11-02). `atlante_fresco.py` diventa «vecchio» a ogni unione che tocca
# moduli, rotte, pagine o migrazioni, e rigenerarlo chiede il database vivo: lo faceva qualcuno a mano
# sulla VM. Questo script lo fa dal timer `heuresys-advanced-atlante.timer` (deploy/systemd/solo-vm/)
# e propone il risultato come PR.
#
# DOPO OGNI UNIONE, NON OGNI MATTINA (2026-11-19). Con il giro solo alle 05:00 l'atlante restava
# vecchio per ore dopo ogni unione, Atlas freshness su main era rosso (15 corse rosse su 21 dal 15 al
# 18/11), deploy-watch fermava il rilascio, e i thread rigeneravano a mano: 16 commit «atlante
# rigenerato» in 4 giorni. Ora il timer passa ogni 20 minuti, ma lo script lavora solo se origin/main
# e' cambiato dall'ultimo giro (passo 0, un `git fetch`), e la PR che apre la unisce
# lo script stesso, dopo aver aspettato che la sua CI sia tutta verde: e' la stessa unione con CI verde che i
# thread fanno gia' per permesso permanente (13/11/2026), e la PR tocca solo docs/kb/atlas.
#
# Che cosa fa, in ordine:
#   0. se origin/main e' lo stesso commit gia' guardato al giro prima, esce 0 senza fare niente;
#   1. se c'e' gia' una PR aperta da un ramo `atlante/*`, esce 0 senza fare niente;
#   2. apre una copia di prova da origin/main con scripts/copia-prova.sh (se un'altra copia e'
#      aperta esce 0: riprova al giro dopo);
#   3. nella copia chiede `atlante_fresco.py`: «fresco» → chiude la copia ed esce 0;
#   4. «vecchio» o «indeciso» → pnpm install, build_atlas.py con le coordinate del DB lette dal
#      .env della VM (la password non viene mai stampata), controlla che la sezione dati non perda
#      tabelle rispetto a main, committa su `atlante/<AAAAMMGG>`, pusha, apre la PR e ne chiede
#      l'unione automatica a CI verde;
#   5. chiude la copia e la cancella dal cestino: sulla VM il cestino non libera disco (regola del
#      30/10/2026), e la copia l'ha creata questo script.
#
# Si misura sempre dentro la copia, mai nel checkout principale: atlas_freshness() confronta con
# HEAD, e il checkout principale della VM non e' detto che stia su origin/main.
#
# Uso:   bash scripts/atlante-automatico.sh            (dal timer o a mano)
# Esiti: 0 niente da fare o PR aperta · 1 errore (la copia resta aperta per guardarci dentro)

set -euo pipefail

ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
NOME="atlante-auto"
SEDE="${HEURESYS_PROVE_DIR:-$HOME/prove-heuresys-advanced}"
COPIA="$SEDE/$NOME"
CESTINO="$HOME/_da_eliminare"
OGGI="$(TZ=Europe/Rome date +%Y%m%d)"

log() { echo "[atlante-automatico] $*"; }

exec 9>"${XDG_RUNTIME_DIR:-/tmp}/heuresys-atlante-automatico.lock"
flock -n 9 || { log "un'altra corsa e' in volo: esco"; exit 0; }

# 0. main non e' cambiato dall'ultimo giro: niente da guardare. Il commit si segna solo quando il
#    giro arriva in fondo (fresco, identico o PR aperta), cosi' un giro fallito si ripete al prossimo.
STATO_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/heuresys-advanced"
ULTIMO="$STATO_DIR/atlante-ultimo-main"
mkdir -p "$STATO_DIR"
git -C "$ROOT" fetch -q origin main
TESTA="$(git -C "$ROOT" rev-parse origin/main)"
if [ "$(cat "$ULTIMO" 2>/dev/null || true)" = "$TESTA" ]; then
  exit 0
fi
segna_guardato() { printf '%s\n' "$TESTA" > "$ULTIMO"; }
SPINTA="$STATO_DIR/atlante-pr-spinta"

# 0b. rilascio armato: main deve restare sul commit armato fino a DEPLOYATO (scripts/blocco-rilascio.sh).
#     Si esce senza segnare il giro, cosi' il primo giro dopo il rilascio guarda di nuovo.
blocco_attivo() { [ -f "$ROOT/scripts/blocco-rilascio.sh" ] && bash "$ROOT/scripts/blocco-rilascio.sh" attivo; }
if blocco_attivo; then
  log "rilascio armato in corso: main e' fermo, riprovo dopo DEPLOYATO"
  exit 0
fi

# 1. una PR di rigenerazione gia' aperta basta
aperte="$(cd "$ROOT" && gh pr list --state open \
  --json headRefName -q '[.[] | select(.headRefName | startswith("atlante/"))] | length')"
if [ "$aperte" != "0" ]; then
  # Una PR rimasta aperta (per esempio perche' nel frattempo era stato armato un rilascio) si unisce
  # qui se la sua CI e' gia' tutta verde e non c'e' un rilascio armato; altrimenti si aspetta.
  # Si unisce solo la PR che questo script ha spinto: la testa deve essere il commit segnato in
  # $SPINTA al momento del push, e i file solo quelli generati. Un ramo atlante/* spinto da altri,
  # o ritoccato dopo, resta da rivedere a mano.
  vecchia="$(cd "$ROOT" && gh pr list --state open --json number,headRefName,headRefOid,isCrossRepository \
    -q '[.[] | select(.headRefName | startswith("atlante/")) | select(.isCrossRepository | not)][0] | "\(.number) \(.headRefOid)"')"
  fuori="$(cd "$ROOT" && gh pr view "${vecchia% *}" --json files -q '.files[].path' 2>/dev/null \
    | grep -vE '^(docs/kb/atlas/|apps/api/src/lib/origine/moduli\.generated\.ts$)' || true)"
  if [ "${vecchia#* }" != "$(cat "$SPINTA" 2>/dev/null || true)" ] || [ -n "$fuori" ]; then
    log "PR #${vecchia% *} da un ramo atlante/* non spinta da questo script, o con file non generati: la lascio a mano"
    exit 0
  fi
  if (cd "$ROOT" && gh pr checks "${vecchia% *}" >/dev/null 2>&1) \
     && (cd "$ROOT" && gh pr merge "${vecchia% *}" --squash --delete-branch --match-head-commit "${vecchia#* }" >/dev/null 2>&1); then
    log "PR #${vecchia% *} rimasta aperta: CI verde, unita"
  else
    log "c'e' gia' una PR aperta da un ramo atlante/* (#${vecchia% *}), CI non ancora verde: esco"
  fi
  exit 0
fi

chiudi_e_cancella() {
  bash "$ROOT/scripts/copia-prova.sh" chiudi "$NOME"
  # copia-prova.sh sposta in $CESTINO/prove-heuresys-advanced_<data>/$NOME_<ora>: il nome
  # «atlante-auto» e' riservato a questo script, quindi ogni voce cosi' chiamata e' sua.
  local d
  for d in "$CESTINO"/prove-heuresys-advanced_*/"${NOME}"_*; do
    [ -d "$d" ] && rm -rf -- "$d"
  done
  rmdir "$CESTINO"/prove-heuresys-advanced_* 2>/dev/null || true
}

# 2. copia di prova da origin/main. --anche-se-altre: la copia «atlante-auto» e' riservata a questo
#    script e non tocca quelle dei thread. Senza, una sola copia altrui aperta (il 19/11 ce n'era
#    una aperta dal 10/11) fermava ogni giro: l'ultima PR automatica dell'atlante era dell'11/11.
set +e
bash "$ROOT/scripts/copia-prova.sh" apri "$NOME" "atlante automatico (timer heuresys-advanced-atlante)" --anche-se-altre
rc=$?
set -e
case "$rc" in
  0) ;;
  3|4)
    if [ -d "$COPIA" ]; then
      # la copia e' la nostra: e' rimasta aperta da una corsa fallita, e va guardata a mano
      log "la copia $COPIA e' rimasta da una corsa precedente fallita: guardala e chiudila"; exit 1
    fi
    log "un'altra copia di prova e' aperta (esito $rc): riprovo al giro dopo"; exit 0 ;;
  *) log "apertura della copia fallita (esito $rc)"; exit 1 ;;
esac

# 3. l'atlante e' ancora vero?
set +e
stato="$(cd "$COPIA" && python3 docs/kb/tools/atlante_fresco.py)"
set -e
log "atlante_fresco.py: $stato"
if [ "$stato" = "fresco" ]; then
  chiudi_e_cancella
  log "niente da fare"
  segna_guardato
  exit 0
fi

# 4. rigenerazione
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" && nvm use -s 22 >/dev/null
fi
(cd "$COPIA" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)

ENV_FILE="${ENV_FILE:-$ROOT/.env}"
(
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  export ATLAS_PGHOST="${POSTGRES_HOST:-localhost}" ATLAS_PGPORT="${POSTGRES_PORT:-5432}"
  export ATLAS_PGUSER="${POSTGRES_USER:-heuresys}" ATLAS_PGDATABASE="${POSTGRES_DB:-heuresys_advanced}"
  cd "$COPIA" && python3 docs/kb/tools/build_atlas.py
)

cd "$COPIA"
[ "$(python3 docs/kb/tools/atlante_fresco.py || true)" = "fresco" ] \
  || { log "dopo la rigenerazione l'atlante non risulta fresco: mi fermo"; exit 1; }

# I file che derivano dall'atlante si rigenerano nello stesso commit: senza, «File generati
# allineati» diventa rosso su main appena l'atlante cambia (19/11, #313 poi #315).
GENERATI="docs/kb/atlas apps/api/src/lib/origine/moduli.generated.ts"
python3 docs/kb/tools/build_origine_moduli.py >/dev/null
# Le operazioni che l'agente sa chiamare derivano dall'atlante (#254): senza, una rotta nuova
# entra nell'atlante ma l'agente non la vede (21/11, schede di processi e progetti, #349).
python3 docs/kb/tools/build_agent_operations.py >/dev/null
python3 docs/kb/tools/check_idoneita_agente.py --check-ts apps/web/src/lib/agente/pagine-idonee.generated.ts >/dev/null \
  || { log "pagine-idonee.generated.ts non e' allineato all'atlante e non lo rigenero io: mi fermo"; exit 1; }

tabelle() { grep -m1 -oE '\| Tabelle DB \| [0-9]+' | grep -oE '[0-9]+$'; }
prima="$(git show HEAD:docs/kb/atlas/ATLAS.md | tabelle || echo 0)"
dopo="$(tabelle < docs/kb/atlas/ATLAS.md || echo 0)"
if [ "${dopo:-0}" -lt "${prima:-0}" ]; then
  log "la sezione dati perde tabelle ($prima → $dopo): niente commit"; exit 1
fi

# shellcheck disable=SC2086
if git diff --quiet -- $GENERATI; then
  log "rigenerato ma identico a main: niente da proporre"
  cd "$ROOT"; chiudi_e_cancella; segna_guardato; exit 0
fi

ramo="atlante/$OGGI"
git ls-remote --exit-code --heads origin "$ramo" >/dev/null 2>&1 && ramo="atlante/$OGGI-$(date +%H%M%S)"
git checkout -q -b "$ramo"
msg="$(mktemp)"
printf '%s\n' "docs(kb): rigenera l'atlante ($OGGI)" "" \
  "Rigenerato dal timer heuresys-advanced-atlante sulla VM (scripts/atlante-automatico.sh)." \
  "atlante_fresco.py: fresco. Tabelle DB $prima -> $dopo." > "$msg"
# shellcheck disable=SC2086
git add $GENERATI
# shellcheck disable=SC2086
git commit -q -F "$msg" -- $GENERATI
rm -f "$msg"
git push -q -u origin "$ramo"
git rev-parse HEAD > "$SPINTA"
gh pr create --base main --head "$ramo" --title "docs(kb): rigenera l'atlante ($OGGI)" \
  --body "Rigenerazione automatica dell'atlante (scripts/atlante-automatico.sh, timer heuresys-advanced-atlante sulla VM). atlante_fresco.py: fresco; tabelle DB $prima -> $dopo. Lo script la unisce da solo quando tutta la sua CI e' verde."
log "PR aperta dal ramo $ramo"
# Unione a CI verde, aspettata qui. NON `gh pr merge --auto`: main non ha controlli obbligatori,
# quindi GitHub non ha niente da aspettare e `--auto` unisce SUBITO, prima che la CI parta (visto
# il 19/11 con la #313). Si aspetta che i controlli compaiano, poi che finiscano tutti; si unisce
# solo se sono tutti verdi e la testa del ramo e' ancora il commit di questo giro. Ogni altro
# esito lascia la PR aperta, da unire a mano: non e' un errore del giro.
testa_ramo="$(git rev-parse HEAD)"
sleep 60
if timeout 3600 gh pr checks "$ramo" --watch --interval 30 >/dev/null 2>&1; then
  if blocco_attivo; then
    log "CI verde ma nel frattempo e' stato armato un rilascio: la PR resta aperta, la unisce il giro dopo DEPLOYATO"
    NON_SEGNARE=1
  elif gh pr merge "$ramo" --squash --delete-branch --match-head-commit "$testa_ramo" >/dev/null 2>&1; then
    log "CI verde: PR unita"
  else
    log "CI verde ma unione rifiutata: la PR resta da unire a mano"
  fi
else
  log "CI non verde, assente o oltre 60 minuti: la PR resta da unire a mano"
fi

cd "$ROOT"
chiudi_e_cancella
[ "${NON_SEGNARE:-0}" = 1 ] || segna_guardato
