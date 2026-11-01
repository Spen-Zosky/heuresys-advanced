#!/usr/bin/env bash
#
# scripts/copia-fase.sh — la copia ripristinabile di advanced a ogni fine fase (ADR-0052).
#
# PERCHE' ESISTE (Enzo, 2026-11-01). Nei giorni di lavoro pesante su advanced serve poter
# tornare a un punto preciso in cui codice, database e configurazione stanno insieme, e
# sapere PRIMA che quel punto si ripristina davvero. I backup che c'erano non bastano:
# `backup-db.sh` salva il solo database, `vm-deploy.sh` fa un'istantanea prima del rilascio,
# e `dr-drill.sh` ripristina senza proprietari ne' permessi e ignora gli errori.
#
#   copia  <nome-fase>   etichetta git sul commit in produzione, dump completo, conteggi esatti
#                        di ogni tabella NELLA STESSA ISTANTANEA del dump, ruoli di advanced
#                        senza password, estensioni, registro delle migrazioni, configurazione
#                        senza segreti, impronte SHA-256 dei segreti, manifesto.
#   prova  <cartella>    ripristina il dump in un database a parte, con proprietari e permessi,
#                        fermandosi al primo errore, e confronta TUTTI i conteggi, le estensioni
#                        e il registro delle migrazioni. Un solo scarto = rosso.
#   drive  <cartella>    porta la copia su Drive (dump e segreti cifrati gpg a chiave pubblica,
#                        il resto in chiaro) e verifica ogni file riscaricandolo e confrontando
#                        l'impronta SHA-256. Senza chiave pubblica porta solo la parte in chiaro
#                        e lo scrive nel manifesto.
#   ritorna <cartella>   NON esegue niente: stampa la sequenza del ritorno vero, che si fa solo
#                        con il si' di Enzo.
#
# Sedi (ADR-0052 §4): VM  $COPIE_DIR (predefinita ~/backup-hr/copie-fase), ultime due copie;
#                     Drive $COPIE_REMOTE (predefinito gdrive-hr:Heuresys/copie-fase), tutte.
#
# GUARDIE
#   - `prova` non ripristina mai in un database che si chiama come quello di produzione, e non
#     tocca un database di prova che non porta il commento che lo script stesso gli mette.
#   - il dump si scrive dalla shell di chi lancia (redirezione), non da postgres: la home non
#     e' attraversabile dall'utente postgres (stesso motivo di dr-drill.sh).
#   - i segreti non si scrivono mai in chiaro fuori dal loro posto: su Drive passano da una
#     pipe dentro gpg.
#   - le copie piu' vecchie delle ultime due, e una copia fallita a meta', si SPOSTANO in
#     <repo>/_da_eliminare/<AAAAMMGG>_copie-fase/, non si cancellano.
#
# Esiti: 0 fatto e verde · 1 rosso (la copia non vale come punto di ritorno) · 2 uso sbagliato
#        · 3 precondizione mancante (strumento, database, chiave)
#
# Variabili: REPO_DIR COPIE_DIR COPIE_REMOTE COPIE_GPG_RECIPIENT DB_NAME PGPORT_COPIA
#            COPIE_RUOLI COPIE_TIENI COPIE_TIENI_PROVA=1 COPIE_NO_TAG=1
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"
if [ -f "$ENV_FILE" ]; then
  # solo le quattro chiavi che servono, senza caricare i segreti nell'ambiente
  _leggi() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"; }
  : "${DB_NAME:=$(_leggi POSTGRES_DB)}"
  : "${PGPORT_COPIA:=$(_leggi POSTGRES_PORT)}"
fi
DB_NAME="${DB_NAME:-heuresys_advanced}"
PGPORT_COPIA="${PGPORT_COPIA:-5432}"
COPIE_DIR="${COPIE_DIR:-$HOME/backup-hr/copie-fase}"
COPIE_REMOTE="${COPIE_REMOTE:-gdrive-hr:Heuresys/copie-fase}"
COPIE_TIENI="${COPIE_TIENI:-2}"
COPIE_RUOLI="${COPIE_RUOLI:-heuresys heuresys_app heuresys_ro heuresys_backup}"
PUBKEY_FILE="${COPIE_PUBKEY_FILE:-$HOME/.config/heuresys/copie-fase.pub.asc}"
SCRATCH_DB="${DB_NAME}_prova_ripristino"
MARCA="creato da scripts/copia-fase.sh prova"

PSQL=(sudo -n -u postgres psql -X -p "$PGPORT_COPIA" -v ON_ERROR_STOP=1 -Atq)

say() { printf '[copia-fase] %s\n' "$*"; }
err() { printf '[copia-fase] %s\n' "$*" >&2; }
ora() { TZ=Europe/Rome date '+%Y-%m-%d %H:%M:%S %Z'; }
cestino() { printf '%s' "$REPO_DIR/_da_eliminare/$(TZ=Europe/Rome date +%Y%m%d)_copie-fase"; }
uso() { sed -n '11,27p' "$0" | sed 's/^# \{0,3\}//' >&2; exit 2; }

# Le query di conteggio e di confronto, uguali per la copia e per la prova: se divergessero,
# un rosso direbbe solo che le query sono diverse.
Q_CONTEGGI_GEN="SELECT format('SELECT %L || ''|'' || count(*) FROM %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 ORDER BY n.nspname, c.relname"
Q_ESTENSIONI="SELECT extname || '|' || extversion FROM pg_extension ORDER BY 1"
Q_MIGRAZIONI="SELECT file_name || '|' || sha256 FROM sys.sys_schema_migrations ORDER BY 1"

richiedi() { for c in "$@"; do command -v "$c" >/dev/null 2>&1 || { err "manca lo strumento '$c'"; exit 3; }; done; }

registro() { mkdir -p "$COPIE_DIR"; printf '%s | %s\n' "$(ora)" "$*" >> "$COPIE_DIR/REGISTRO.txt"; }

manifesto_impronte() {  # $1 = cartella della copia: riscrive la sezione delle impronte
  local d="$1"
  ( cd "$d" && find . -type f ! -name MANIFESTO.txt ! -name IMPRONTE.sha256 -printf '%P\n' | LC_ALL=C sort \
      | xargs -r -d '\n' sha256sum ) > "$d/IMPRONTE.sha256"
}

# ---------------------------------------------------------------------------------------------
cmd_copia() {
  local fase="${1:-}"
  [[ "$fase" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || { err "nome della fase: minuscole, cifre e trattini (es. consolidamento-c5)"; exit 2; }
  richiedi git sudo pg_dump sha256sum
  "${PSQL[@]}" -d "$DB_NAME" -c "SELECT 1" >/dev/null || { err "il database $DB_NAME sulla porta $PGPORT_COPIA non risponde"; exit 3; }

  local oggi; oggi="$(TZ=Europe/Rome date +%Y%m%d)"
  local nome="${oggi}-${fase}"
  local d="$COPIE_DIR/$nome"
  [ -e "$d" ] && { err "la copia $d esiste gia': non la sovrascrivo"; exit 2; }
  mkdir -p "$d/config"
  # una copia fallita a meta' non resta fra le copie (sembrerebbe buona): si sposta da parte
  COPIA_IN_CORSO="$d"
  trap 'if [ -n "${COPIA_IN_CORSO:-}" ] && [ -d "$COPIA_IN_CORSO" ]; then c="$(cestino)"; mkdir -p "$c"; mv "$COPIA_IN_CORSO" "$c/$(basename "$COPIA_IN_CORSO")_fallita_$(date +%H%M%S)"; err "copia fallita: spostata in $c"; fi' EXIT
  local t0; t0=$(date +%s)

  # --- 1. codice: il commit IN PRODUZIONE, non la punta del ramo
  local sha; sha="$(tr -d '[:space:]' < "$REPO_DIR/pg_dump_snapshots/LAST_GOOD_SHA" 2>/dev/null || true)"
  printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { err "LAST_GOOD_SHA assente o non valido: non so quale codice e' in produzione"; rm -rf "$d"; exit 3; }
  local tag="fase-${nome}"
  if [ "${COPIE_NO_TAG:-0}" != 1 ]; then
    local gia; gia="$(git -C "$REPO_DIR" rev-parse -q --verify "refs/tags/$tag^{commit}" || true)"
    if [ -z "$gia" ]; then
      git -C "$REPO_DIR" tag -a "$tag" "$sha" -m "Copia ripristinabile di fine fase: $fase (ADR-0052)"
    elif [ "$gia" != "$sha" ]; then
      err "l'etichetta $tag esiste gia' e punta a ${gia:0:8}, non a ${sha:0:8}"; exit 3
    fi
    git -C "$REPO_DIR" push origin "refs/tags/$tag" --quiet || err "ATTENZIONE: etichetta $tag creata ma non spinta su GitHub"
  fi
  say "codice: $tag -> ${sha:0:8}"

  # --- 2. database + conteggi nella STESSA istantanea
  # Una sessione apre una transazione REPEATABLE READ ed esporta l'istantanea; pg_dump la usa;
  # la stessa sessione conta le righe e legge estensioni e migrazioni. Cosi' i conteggi
  # descrivono esattamente cio' che il dump contiene, anche se la produzione scrive intanto.
  say "database: dump di $DB_NAME (porta $PGPORT_COPIA) nell'istantanea esportata"
  coproc SESS { "${PSQL[@]}" -d "$DB_NAME" 2>&1; }
  # bash chiude i descrittori del coproc quando psql esce (dopo \q): li duplichiamo, cosi'
  # l'uscita ancora nel tubo si legge per intero anche a sessione finita.
  local spid="$SESS_PID" in out snap="" riga
  exec {in}>&"${SESS[1]}" {out}<&"${SESS[0]}"
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n' >&"$in"
  read -r -t 60 snap <&"$out" || true
  printf '%s' "$snap" | grep -qE '^[0-9A-F]+-[0-9A-F]+-[0-9]+$' || { err "istantanea non ottenuta: '$snap'"; exit 1; }
  sudo -n -u postgres pg_dump -p "$PGPORT_COPIA" -Fc --snapshot="$snap" "$DB_NAME" > "$d/database.dump"
  {
    printf "SELECT '##CONTEGGI';\n%s\n\\\\gexec\n" "$Q_CONTEGGI_GEN"
    printf "SELECT '##ESTENSIONI';\n%s;\n" "$Q_ESTENSIONI"
    printf "SELECT '##MIGRAZIONI';\n%s;\n" "$Q_MIGRAZIONI"
    printf "SELECT '##FINE';\nCOMMIT;\n\\\\q\n"
  } >&"$in"
  local sez="" ; : > "$d/conteggi.txt"; : > "$d/estensioni.txt"; : > "$d/migrazioni.txt"
  while IFS= read -r -t 600 riga <&"$out"; do
    case "$riga" in
      '##CONTEGGI') sez=conteggi.txt ;; '##ESTENSIONI') sez=estensioni.txt ;;
      '##MIGRAZIONI') sez=migrazioni.txt ;; '##FINE') break ;;
      ERROR*|FATAL*|psql:*) err "errore nella sessione della copia: $riga"; exit 1 ;;
      *) [ -n "$sez" ] && printf '%s\n' "$riga" >> "$d/$sez" ;;
    esac
  done
  exec {in}>&- {out}<&-
  wait "$spid" 2>/dev/null || true
  local ntab; ntab=$(wc -l < "$d/conteggi.txt")
  [ "$ntab" -gt 0 ] || { err "nessun conteggio letto"; exit 1; }
  [ "$(stat -c %s "$d/database.dump")" -gt "${COPIE_DUMP_MIN:-1048576}" ] || { err "dump troppo piccolo"; exit 1; }
  say "database: $(du -h "$d/database.dump" | cut -f1), $ntab tabelle contate, $(wc -l < "$d/migrazioni.txt") migrazioni"

  # --- 3. ruoli di advanced, senza password
  local re; re="$(printf '%s|' $COPIE_RUOLI)"; re="${re%|}"
  sudo -n -u postgres pg_dumpall -p "$PGPORT_COPIA" --roles-only --no-role-passwords 2>/dev/null \
    | grep -E "ROLE (${re})( |;)|TO (${re})( |;|,)|GRANT (${re}) TO" > "$d/ruoli.sql" || true
  printf '%s\n' "$DB_NAME|$("${PSQL[@]}" -d "$DB_NAME" -c "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()")" > "$d/proprietario.txt"

  # --- 4. configurazione, senza segreti
  grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" 2>/dev/null | tr -d '=' > "$d/config/env_chiavi.txt" || true
  local u
  for u in /etc/systemd/system/heuresys-advanced-*; do
    [ -e "$u" ] || continue
    if [ -d "$u" ]; then mkdir -p "$d/config/systemd/$(basename "$u")"; cp -p "$u"/* "$d/config/systemd/$(basename "$u")/" 2>/dev/null || true
    else mkdir -p "$d/config/systemd"; cp -p "$u" "$d/config/systemd/"; fi
  done
  for u in /etc/nginx/sites-enabled/www.heuresys.com.conf; do [ -r "$u" ] && cp -p "$u" "$d/config/"; done
  crontab -l 2>/dev/null | grep -iE 'heuresys-advanced|backup-hr' > "$d/config/crontab.txt" || true
  {
    echo "node: $(ls "$HOME/.nvm/versions/node" 2>/dev/null | tr '\n' ' ')"
    echo "pnpm: $(grep -oE '"packageManager": *"[^"]+"' "$REPO_DIR/package.json" | cut -d'"' -f4)"
    echo "postgres: $("${PSQL[@]}" -d "$DB_NAME" -c 'SHOW server_version')"
  } > "$d/config/versioni.txt"

  # --- 5. impronte dei segreti (i segreti restano dove sono)
  : > "$d/segreti_impronte.sha256"
  for u in "$ENV_FILE" /etc/heuresys/*; do
    [ -f "$u" ] || sudo -n test -f "$u" || continue
    printf '%s  %s\n' "$(sudo -n cat "$u" | sha256sum | cut -d' ' -f1)" "$u" >> "$d/segreti_impronte.sha256"
  done

  # --- 6. manifesto
  manifesto_impronte "$d"
  {
    echo "COPIA RIPRISTINABILE DI ADVANCED (ADR-0052)"
    echo "fase:        $fase"
    echo "fatta:       $(ora) da $(whoami)@$(hostname)"
    echo "codice:      $sha  (etichetta $tag)"
    echo "database:    $DB_NAME, porta $PGPORT_COPIA, istantanea $snap"
    echo "tabelle:     $ntab   migrazioni: $(wc -l < "$d/migrazioni.txt")   estensioni: $(wc -l < "$d/estensioni.txt")"
    echo "durata:      $(( $(date +%s) - t0 )) s"
    echo "impronte:    IMPRONTE.sha256 (sha256sum -c IMPRONTE.sha256)"
    echo "PROVA DI RIPRISTINO: non ancora fatta"
    echo "DRIVE: non ancora caricata"
  } > "$d/MANIFESTO.txt"
  registro "copia $nome: $ntab tabelle, codice ${sha:0:8}"
  say "copia fatta: $d"

  # --- 7. rotazione: restano le ultime $COPIE_TIENI, le altre si SPOSTANO
  COPIA_IN_CORSO=""   # copia completa: da qui in poi non si sposta piu'
  local vecchie; vecchie="$(find "$COPIE_DIR" -mindepth 1 -maxdepth 1 -type d -name '20[0-9]*' -printf '%T@ %f\n' | sort -n | cut -d' ' -f2- | head -n -"$COPIE_TIENI")"
  if [ -n "$vecchie" ]; then
    local cestino; cestino="$(cestino)"
    mkdir -p "$cestino"
    for u in $vecchie; do mv "$COPIE_DIR/$u" "$cestino/"; registro "spostata in $cestino: $u"; say "spostata in $cestino: $u"; done
  fi
  printf '%s\n' "$d"
}

# ---------------------------------------------------------------------------------------------
cmd_prova() {
  local d="${1:-}"; [ -d "$d" ] && [ -f "$d/database.dump" ] || { err "cartella di copia non valida: $d"; exit 2; }
  richiedi pg_restore sudo diff
  [ "$SCRATCH_DB" != "$DB_NAME" ] || { err "il database di prova coincide con quello vero"; exit 2; }
  ( cd "$d" && sha256sum --quiet -c IMPRONTE.sha256 ) || { err "le impronte della copia non coincidono: la copia e' alterata"; exit 1; }

  local esiste; esiste="$("${PSQL[@]}" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$SCRATCH_DB'")"
  if [ "$esiste" = 1 ]; then
    local c; c="$("${PSQL[@]}" -d postgres -c "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '$SCRATCH_DB'")"
    case "$c" in "$MARCA"*) say "tolgo il database di prova precedente ($c)"; sudo -n -u postgres dropdb -p "$PGPORT_COPIA" "$SCRATCH_DB" ;;
      *) err "$SCRATCH_DB esiste e non l'ha creato questo script: non lo tocco"; exit 3 ;; esac
  fi
  local owner; owner="$(cut -d'|' -f2 "$d/proprietario.txt")"
  local r; for r in $COPIE_RUOLI; do
    [ "$("${PSQL[@]}" -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname = '$r'")" = 1 ] || { err "manca il ruolo $r sul cluster"; exit 1; }
  done
  local t0; t0=$(date +%s)
  sudo -n -u postgres createdb -p "$PGPORT_COPIA" -O "$owner" "$SCRATCH_DB"
  "${PSQL[@]}" -d postgres -c "COMMENT ON DATABASE $SCRATCH_DB IS '$MARCA $(date -u +%Y%m%dT%H%M%SZ)'"
  say "ripristino in $SCRATCH_DB (proprietari e permessi, fermo al primo errore)"
  local esito=VERDE nota="" motivo=""
  if ! sudo -n -u postgres pg_restore -p "$PGPORT_COPIA" -d "$SCRATCH_DB" --exit-on-error < "$d/database.dump" 2> "$d/prova_errori.txt"; then
    esito=ROSSO; motivo="pg_restore si e' fermato: $(head -3 "$d/prova_errori.txt" | tr '\n' ' ')"
  fi
  local tr=$(( $(date +%s) - t0 ))
  if [ "$esito" = VERDE ]; then
    printf '%s\n\\gexec\n' "$Q_CONTEGGI_GEN" | "${PSQL[@]}" -d "$SCRATCH_DB" > "$d/prova_conteggi.txt"
    "${PSQL[@]}" -d "$SCRATCH_DB" -c "$Q_ESTENSIONI" > "$d/prova_estensioni.txt"
    "${PSQL[@]}" -d "$SCRATCH_DB" -c "$Q_MIGRAZIONI" > "$d/prova_migrazioni.txt"
    # Un'estensione torna alla versione che il server sa installare: se la versione registrata
    # nella copia non e' piu' fra quelle disponibili (il pacchetto e' stato aggiornato, e nel
    # database vivo manca solo ALTER EXTENSION ... UPDATE), e quella ripristinata e' la versione
    # predefinita del server, non e' un difetto della copia: si annota, e il confronto resta sul resto.
    local nome ver vprova nota=""
    while IFS='|' read -r nome ver; do
      vprova="$(grep -E "^${nome}[|]" "$d/prova_estensioni.txt" | cut -d'|' -f2 || true)"
      [ -n "$vprova" ] && [ "$vprova" != "$ver" ] || continue
      local q="SELECT (SELECT default_version FROM pg_available_extensions WHERE name = '$nome') = '$vprova'
                  AND NOT EXISTS (SELECT 1 FROM pg_available_extension_versions WHERE name = '$nome' AND version = '$ver')"
      if [ "$("${PSQL[@]}" -d postgres -c "$q")" = t ]; then
        sed -i "s#^${nome}|${vprova}\$#${nome}|${ver}#" "$d/prova_estensioni.txt"
        nota="$nota $nome torna alla $vprova perche' il server non ha piu' la $ver;"
      fi
    done < "$d/estensioni.txt"
    local f; for f in conteggi estensioni migrazioni; do
      if ! diff -q "$d/$f.txt" "$d/prova_$f.txt" >/dev/null; then
        esito=ROSSO; motivo="$motivo $f diversi ($(diff "$d/$f.txt" "$d/prova_$f.txt" | grep -c '^[<>]' || true) righe);"
      fi
    done
  fi
  [ -n "${nota:-}" ] && motivo="${motivo}${motivo:+ }nota:$nota"
  local ntab; ntab=$(wc -l < "$d/conteggi.txt")
  local righe; righe=$(awk -F'|' '{s+=$2} END{print s+0}' "$d/conteggi.txt")
  if [ "${COPIE_TIENI_PROVA:-0}" = 1 ]; then say "tengo $SCRATCH_DB (COPIE_TIENI_PROVA=1)"
  else sudo -n -u postgres dropdb -p "$PGPORT_COPIA" "$SCRATCH_DB"; fi
  sed -i "s#^PROVA DI RIPRISTINO:.*#PROVA DI RIPRISTINO: $esito il $(ora) — $ntab tabelle e $righe righe confrontate una per una, ripristino in ${tr} s${motivo:+ — $motivo}#" "$d/MANIFESTO.txt"
  manifesto_impronte "$d"
  registro "prova $(basename "$d"): $esito, $ntab tabelle, $righe righe, ${tr} s${motivo:+, $motivo}"
  say "PROVA DI RIPRISTINO: $esito — $ntab tabelle, $righe righe, ${tr} s ${motivo}"
  [ "$esito" = VERDE ] || exit 1
}

# ---------------------------------------------------------------------------------------------
cmd_drive() {
  local d="${1:-}"; [ -d "$d" ] && [ -f "$d/MANIFESTO.txt" ] || { err "cartella di copia non valida: $d"; exit 2; }
  richiedi rclone gpg sha256sum
  grep -q '^PROVA DI RIPRISTINO: VERDE' "$d/MANIFESTO.txt" || { err "la copia non ha una prova di ripristino verde: non la porto su Drive"; exit 1; }
  local nome; nome="$(basename "$d")"
  local dest="$COPIE_REMOTE/$nome"
  local gh; gh="$(mktemp -d "$d/.gnupg.XXXX")"; chmod 700 "$gh"
  local cifra=0 fpr=""
  if [ -f "$PUBKEY_FILE" ]; then
    gpg --homedir "$gh" --quiet --import "$PUBKEY_FILE" 2>/dev/null
    fpr="$(gpg --homedir "$gh" --with-colons --fingerprint 2>/dev/null | awk -F: '/^fpr/{print $10; exit}')"
    [ -n "$fpr" ] && cifra=1
  fi
  local inv; inv="$(mktemp -d "$d/.invio.XXXX")"
  # le due cartelle di lavoro le crea questo script e le toglie in ogni caso, anche su un rosso
  trap 'rm -rf "'"$gh"'" "'"$inv"'"' EXIT
  ( cd "$d" && find . -type f ! -name database.dump ! -name DRIVE_IMPRONTE.sha256 ! -path './.gnupg*' ! -path './.invio*' -printf '%P\n' ) \
    | while IFS= read -r f; do mkdir -p "$inv/$(dirname "$f")"; cp -p "$d/$f" "$inv/$f"; done
  if [ "$cifra" = 1 ]; then
    gpg --homedir "$gh" --batch --yes --trust-model always -r "$fpr" -o "$inv/database.dump.gpg" -e "$d/database.dump"
    # i segreti passano da una pipe: mai scritti in chiaro su disco
    local lista=(); local u; for u in "$ENV_FILE" /etc/heuresys/*; do sudo -n test -f "$u" && lista+=("$u"); done
    sudo -n tar -cf - "${lista[@]}" 2>/dev/null | gpg --homedir "$gh" --batch --yes --trust-model always -r "$fpr" -o "$inv/segreti.tar.gpg" -e
    echo "cifratura: gpg a chiave pubblica, impronta $fpr" > "$inv/CIFRATURA.txt"
  else
    echo "NON CIFRATA E INCOMPLETA: manca la chiave pubblica ($PUBKEY_FILE). Su Drive non ci sono ne' il database ne' i segreti." > "$inv/CIFRATURA.txt"
    err "ATTENZIONE: chiave pubblica assente, porto su Drive solo la parte in chiaro"
  fi
  ( cd "$inv" && find . -type f -printf '%P\n' | LC_ALL=C sort | xargs -r -d '\n' sha256sum ) > "$d/DRIVE_IMPRONTE.sha256"
  say "carico su $dest"
  rclone copy "$inv" "$dest" --quiet
  say "verifico: riscarico ogni file e confronto l'impronta SHA-256"
  local remoto; remoto="$(rclone hashsum sha256 --download "$dest" 2>/dev/null | LC_ALL=C sort -k2)"
  local locale; locale="$(LC_ALL=C sort -k2 "$d/DRIVE_IMPRONTE.sha256" | sed 's/  / /')"
  local esito=VERDE
  [ "$(printf '%s\n' "$remoto" | sed 's/  / /')" = "$locale" ] || esito=ROSSO
  local nfile; nfile=$(wc -l < "$d/DRIVE_IMPRONTE.sha256")
  local completa; [ "$cifra" = 1 ] && completa="completa e cifrata" || completa="SOLO PARTE IN CHIARO, senza database e segreti"
  sed -i "s#^DRIVE:.*#DRIVE: $esito il $(ora) — $dest, $nfile file, impronte riscaricate e confrontate; $completa#" "$d/MANIFESTO.txt"
  manifesto_impronte "$d"
  rclone copyto "$d/MANIFESTO.txt" "$dest/MANIFESTO.txt" --quiet
  registro "drive $nome: $esito, $nfile file, $completa"
  say "DRIVE: $esito — $nfile file — $completa"
  [ "$esito" = VERDE ] || exit 1
}

# ---------------------------------------------------------------------------------------------
cmd_ritorna() {
  local d="${1:-}"; [ -d "$d" ] || { err "cartella di copia non valida: $d"; exit 2; }
  local tag; tag="$(awk '/^codice:/{gsub(/[()]/,""); print $4}' "$d/MANIFESTO.txt")"
  local oggi; oggi="$(TZ=Europe/Rome date +%Y%m%d)"
  cat <<EOT
RITORNO VERO A $(basename "$d") — NON ESEGUITO. Si fa solo con il si' di Enzo, a mano, in quest'ordine:

  1. sudo systemctl stop heuresys-advanced-deploy-watch.timer heuresys-advanced-web heuresys-advanced-api
  2. sudo -u postgres psql -p $PGPORT_COPIA -c 'ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_prima_del_ritorno_$oggi'
  3. sudo -u postgres createdb -p $PGPORT_COPIA -O $(cut -d'|' -f2 "$d/proprietario.txt") $DB_NAME
  4. sudo -u postgres pg_restore -p $PGPORT_COPIA -d $DB_NAME --exit-on-error < $d/database.dump
  5. sudo -u postgres psql -p $PGPORT_COPIA -d $DB_NAME -c 'GRANT CONNECT ON DATABASE $DB_NAME TO heuresys_app, heuresys_ro'
     (e i permessi dei ruoli esterni, letti prima del passo 2 da ${DB_NAME}: codex_auditor, gov_worker, heuresys_datastore_ro)
  6. bash $REPO_DIR/scripts/vm-rollback.sh $tag
  7. sha256sum -c $d/segreti_impronte.sha256   (i segreti devono essere quelli della copia)
  8. login di un utente RTL su https://www.heuresys.com e uso secondo il suo profilo
  9. sudo systemctl start heuresys-advanced-deploy-watch.timer
EOT
}

case "${1:-}" in
  copia)   shift; cmd_copia "$@" ;;
  prova)   shift; cmd_prova "$@" ;;
  drive)   shift; cmd_drive "$@" ;;
  ritorna) shift; cmd_ritorna "$@" ;;
  *) uso ;;
esac
