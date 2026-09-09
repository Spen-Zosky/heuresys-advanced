#!/usr/bin/env bash
# db/scripts/prova-api-sul-gemello.sh
#
# ESEGUE LA SUITE `test-api` DOVE IL DATABASE VIVE — **propagando prima il codice
# che sto verificando**, e rifiutando di partire se il gemello non ce l'ha.
#
# PERCHE' ESISTE (Enzo, 2026-09-09): *«non possiamo impiegare 34 minuti per una
# cosa che potrebbe impiegare solo 14 secondi»*. La misura, dal verdetto lasciato
# dalla sessione precedente in `.zp/verify-verdict.json`:
#
#   test-api da Windows, via tunnel SSH  : 2054 s  (34 minuti)
#   un singolo file di test sul gemello  :   14 s  (misurato 2026-08-27)
#
# CIO' CHE MANCAVA, ED E' LA RAGIONE PER CUI LA SUITE ERA RIMASTA QUI.
# `verify_gate.py` lo dichiarava a chiare lettere, e non era una dimenticanza:
#
#   «il gemello sta al commit che gli e' stato propagato l'ultima volta [...]
#    quindi li' la suite proverebbe il codice di ieri. Un verde su codice vecchio
#    e' peggio di un'attesa. Se un giorno si vorra' spostarla: prima serve la
#    propagazione del codice dentro la suite stessa, e una guardia sull'sha —
#    non basta cambiare l'host.»
#
# Questo script e' quelle due cose. E la guardia e' piu' forte di quella chiesta:
# non confronta lo **sha del commit** ma l'**impronta del contenuto**. Lo sha di
# un commit non vede le modifiche non committate; l'impronta del contenuto si.
# E' anche il rimedio che `D-88` chiede — *«il verdetto deve portare l'impronta
# del contenuto verificato»* — applicato al lato «dove ho verificato».
#
# CHE COSA PROPAGA. I percorsi che instradano `test-api` in `verify_gate.py`
# (ROUTES): `apps/api/` e `packages/shared/`, **intere**, non i soli `src/`.
# L'elenco e' `git ls-files -co --exclude-standard`: tracciati **piu'** non
# tracciati non ignorati, cioe' esattamente il contenuto che sto verificando.
#
# PERCHE' SCRIVERE IN `~/heuresys-advanced` E' SICURO (censito 2026-09-09, C1):
#   · il runner CI lavora in `~/actions-runner/_work/heuresys-advanced` — altra
#     directory: una corsa CI in volo non viene toccata (e' la lezione di C4);
#   · il gemello PROD gira `node dist/server.js` da `apps/api`, cioe' il BUNDLE:
#     copiare `src/` e `test/` non cambia cio' che il servizio serve finche'
#     nessuno rebuilda;
#   · `align-clones.sh linuxpc` fa `reset --hard origin/main`, quindi cio' che
#     propago e' transitorio per costruzione.
#
# CIO' CHE NON FA, DI PROPOSITO: non cancella niente sul remoto. Il tar e'
# additivo; un file cancellato in locale ma ancora presente sul gemello lo COGLIE
# la guardia (impronte diverse) e lo script dice quale, senza rimuoverlo da se'.
# Il divieto di cancellare senza conferma vale anche qui, e in una corsa non
# presidiata una richiesta di permesso non la vede nessuno.
#
# Uso:
#   bash db/scripts/prova-api-sul-gemello.sh                  # la suite intera
#   bash db/scripts/prova-api-sul-gemello.sh test/foo.test.ts # un file solo
#   HOST=oracle-vm-default bash db/scripts/prova-api-sul-gemello.sh
#   VERIFICA_SOLO=1 bash db/scripts/prova-api-sul-gemello.sh   # propaga e confronta, non esegue
#
# Esce con l'exit code della suite remota. Se l'host non risponde, o se il
# contenuto non combacia, esce ROSSO e NON ripiega su questa macchina: ripiegare
# rimetterebbe il lavoro sul tunnel, cioe' il difetto che esiste per togliere.

set -uo pipefail

HOST="${HOST:-linux-pc}"
REPO_REMOTO="${REPO_REMOTO:-heuresys-advanced}"
REPO_LOCALE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# I percorsi che instradano `test-api`. Devono restare allineati a ROUTES in
# `verify_gate.py`: se una rotta nuova instrada questa suite, va aggiunta qui,
# altrimenti la suite girerebbe su un contenuto che non ho propagato — cioe'
# esattamente il difetto che questo script esiste per chiudere.
PERCORSI=(apps/api packages/shared)

export MSYS_NO_PATHCONV=1
cd "$REPO_LOCALE" || exit 1

rosso() { printf '\n[prova-api] ROSSO — %s\n' "$1" >&2; }

# --- 1. l'host risponde? ------------------------------------------------------
if ! ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" true 2>/dev/null; then
  rosso "'$HOST' non risponde: la suite NON E' STATA ESEGUITA."
  cat >&2 <<EOF

  Non ripiego su questa macchina di proposito: da qui la stessa suite ha
  impiegato 2054 s (misurato, verdetto S1093) perche' ogni query attraversa il
  tunnel SSH. Un cancello che costa mezz'ora e' un cancello che si finisce per
  aggirare.

  Accendi '$HOST' e rilancia, oppure HOST=<altro> se hai un altro gemello.
EOF
  exit 1
fi

# --- 2. l'impronta del contenuto locale ---------------------------------------
# sha256 per file, lista ordinata per path, poi sha256 della lista. Lo stesso
# algoritmo gira sui due lati: se le impronte combaciano, il gemello ha
# ESATTAMENTE cio' che sto verificando — file per file, byte per byte.
#
# `git ls-files -co --exclude-standard` e non `-c` soltanto: un file di test
# appena creato e non ancora aggiunto all'indice fa parte del contenuto da
# verificare quanto uno tracciato. Verificarlo qui e non propagarlo la' sarebbe
# di nuovo un verde su codice che non e' quello.
# ⚠ IL FORMATO SI NORMALIZZA, ALTRIMENTI LA GUARDIA MENTE (misurato 2026-09-09,
# alla prima corsa di questo script). `sha256sum` su Git Bash stampa `HASH *path`
# — l'asterisco e' la modalita' binaria — mentre su Linux stampa `HASH  path`.
# Contenuto identico, riga diversa: la guardia dichiarava divergenza su 877 file
# che erano gli stessi byte per byte. Un falso rosso e' meno grave di un falso
# verde, ma resta uno strumento che misura se stesso invece dell'oggetto.
# Quindi: si prende la sola colonna dell'hash e si ricompone la riga con un
# separatore fisso, uguale sulle due macchine. Il path resta nel confronto
# apposta — senza, un rename passerebbe inosservato.
impronta_locale() {
  git ls-files -co --exclude-standard -- "${PERCORSI[@]}" \
    | LC_ALL=C sort \
    | while IFS= read -r f; do
        [ -f "$f" ] && printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"
      done \
    | sha256sum | cut -d' ' -f1
}

IMPRONTA_LOCALE="$(impronta_locale)"
N_FILE="$(git ls-files -co --exclude-standard -- "${PERCORSI[@]}" | wc -l | tr -d ' ')"
echo "[prova-api] host=$HOST  repo=~/$REPO_REMOTO"
echo "[prova-api] contenuto: $N_FILE file sotto ${PERCORSI[*]}  impronta=${IMPRONTA_LOCALE:0:12}"

# --- 3. propagazione ----------------------------------------------------------
# tar e non rsync: rsync NON esiste su Windows (misurato 2026-09-09), tar si su
# entrambe le macchine. `-T -` legge l'elenco esatto da stdin, cosi' non passa
# mai da `node_modules/` o `dist/`, che non sono nell'elenco di git.
# `SALTA_PROPAGAZIONE=1` esiste per PROVARE LA GUARDIA, non per uso normale: senza
# di lui l'unico modo di vedere la guardia dire di no sarebbe sporcare il gemello
# con un file da cancellare dopo — e una prova che pretende una cancellazione per
# funzionare e' una prova che in una corsa non presidiata non si esegue.
if [ "${SALTA_PROPAGAZIONE:-0}" = "1" ]; then
  echo "[prova-api] SALTA_PROPAGAZIONE=1 — non propago (prova della guardia)"
else
echo "[prova-api] propago il contenuto..."
if ! git ls-files -co --exclude-standard -- "${PERCORSI[@]}" \
     | tar -cf - -T - 2>/dev/null \
     | ssh -o ConnectTimeout=30 "$HOST" "cd ~/$REPO_REMOTO && tar -xf -"; then
  rosso "la propagazione e' fallita: la suite NON E' STATA ESEGUITA."
  exit 1
fi
fi

# --- 4. LA GUARDIA — il gemello ha davvero il mio contenuto? ------------------
# Questa e' la ragione per cui lo script esiste. Senza, sarebbe solo «la stessa
# suite altrove», che e' precisamente cio' che `verify_gate.py` rifiutava di fare.
IMPRONTA_REMOTA="$(ssh -o ConnectTimeout=30 "$HOST" \
  "cd ~/$REPO_REMOTO && git ls-files -co --exclude-standard -- ${PERCORSI[*]} \
     | LC_ALL=C sort \
     | while IFS= read -r f; do [ -f \"\$f\" ] && printf '%s  %s\\n' \"\$(sha256sum \"\$f\" | cut -d' ' -f1)\" \"\$f\"; done \
     | sha256sum | cut -d' ' -f1" 2>/dev/null)"

if [ "$IMPRONTA_LOCALE" != "$IMPRONTA_REMOTA" ]; then
  rosso "il gemello NON ha il contenuto che sto verificando."
  cat >&2 <<EOF

  impronta qui      : ${IMPRONTA_LOCALE:-VUOTA}
  impronta su $HOST : ${IMPRONTA_REMOTA:-VUOTA}

  La suite NON e' stata eseguita, di proposito: eseguirla darebbe un verde su un
  codice che non e' il mio, e «un verde su codice vecchio e' peggio di un'attesa»
  (verify_gate.py). Non e' un guasto: e' la guardia che fa il suo mestiere.

  Causa quasi certa: un file esiste ancora sul gemello ma qui e' stato cancellato
  o rinominato — il tar aggiunge, non toglie. Per vedere quali:

    ssh $HOST 'cd ~/$REPO_REMOTO && git status --short -- ${PERCORSI[*]}'

  Rimedio, da eseguire a mano perche' cancella (mai in automatico, mai in una
  corsa non presidiata):

    ssh $HOST 'cd ~/$REPO_REMOTO && git checkout -- ${PERCORSI[*]} && git clean -fd ${PERCORSI[*]}'

  poi rilancia: la propagazione ricopre il resto.
EOF
  exit 1
fi

echo "[prova-api] guardia OK — il contenuto sul gemello combacia byte per byte"

if [ "${VERIFICA_SOLO:-0}" = "1" ]; then
  echo "[prova-api] VERIFICA_SOLO=1 — mi fermo qui, la suite non parte"
  exit 0
fi

# --- 5. la suite, dove il database vive ---------------------------------------
# nvm non e' nel PATH di una shell ssh non interattiva: senza questo `pnpm` esce
# 127 e sembra assente su una macchina che ce l'ha (gia' misurato in sul-gemello.sh).
CMD_SUITE="pnpm --filter @heuresys/api test"
if [ $# -gt 0 ]; then
  CMD_SUITE="pnpm --filter @heuresys/api exec vitest run $*"
fi
echo "[prova-api] eseguo: $CMD_SUITE"
INIZIO=$(date +%s)

ssh -o ConnectTimeout=30 "$HOST" \
  "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" >/dev/null 2>&1; cd ~/$REPO_REMOTO && $CMD_SUITE"
ESITO=$?

DURATA=$(( $(date +%s) - INIZIO ))
echo "[prova-api] durata ${DURATA}s  esito=$ESITO"

# --- 6. dichiarare cosa resta sul gemello -------------------------------------
# Non lo pulisco: lo dichiaro. Un working tree remoto sporco scoperto tre giorni
# dopo e' peggio di uno dichiarato adesso.
SPORCO="$(ssh -o ConnectTimeout=15 "$HOST" \
  "cd ~/$REPO_REMOTO && git status --porcelain -- ${PERCORSI[*]} | wc -l" 2>/dev/null || echo '?')"
if [ "$SPORCO" != "0" ] && [ "$SPORCO" != "?" ]; then
  echo "[prova-api] nota: $SPORCO file restano modificati su $HOST (cio' che ho propagato)."
  echo "[prova-api]       spariscono al prossimo 'align-clones.sh linuxpc' (reset --hard)."
fi

exit $ESITO
