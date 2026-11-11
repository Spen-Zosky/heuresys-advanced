#!/usr/bin/env bash
# ============================================================================
# scripts/rilascio-copia.sh — la produzione gira da una COPIA RILASCIATA, non dalla cartella del repo.
#
# PERCHE' (Enzo, 2026-11-10, decisione D1 di docs/piani/PIANO_turni-advanced-datastore_20261110.md).
# Il repo sulla VM e quello sulla Debian lavorano a turno (turni-gemelli). Finche' api, web, gateway e
# i lavori pianificati girano dentro ~/heuresys-advanced, ogni cosa che il turno fa in quella cartella
# (far avanzare `main`, pnpm install, ricevere file) cambia la produzione senza build e senza CI. La
# cura e' la stessa di mod-platform R1: il codice in servizio sta in una copia fatta con `git archive`
# dello sha rilasciato, con le sue dipendenze e la sua build, e i servizi puntano a un collegamento
# fisso che cambia solo quando la copia nuova e' pronta. La cartella del repo torna a essere un
# gemello di sviluppo come la Debian.
#
# Questo script fa solo i gesti sui file; il rilascio vero (cancello CI, snapshot, migrazioni, build,
# unita', riavvio, prova) resta in vm-deploy.sh, che lo chiama.
#
# Sottocomandi:
#   prepara <sorgente> <sha> <cartella-rilasci>   estrae lo sha in <cartella-rilasci>/<AAAAMMGG_HHMMSS>/albero,
#                                                 collega i dati vivi fuori da git della sorgente, scrive
#                                                 .rilascio/{sorgente,commit,preparato_il}; stampa l'albero
#   punta <collegamento> <albero>                 il collegamento del servizio passa all'albero, in un colpo
#   sorgente <albero>                             stampa la cartella del repo da cui la copia e' nata
#   commit <albero>                               stampa lo sha della copia
#   pulisci <cartella-rilasci> <collegamento> [tieni] [--prova]
#                                                 tiene le <tieni> (2) cartelle datate piu' recenti e quella in
#                                                 servizio, e cancella le altre
#
# La pulizia CANCELLA, e non sposta in _da_eliminare/: e' la regola della VM del 30/10/2026 («ogni rito
# automatico che crea copie ha la sua conservazione scritta nello script e cancella da se' cio' che esce»;
# un cestino sulla VM non libera spazio). Cancella solo cartelle che ha creato lui: nome AAAAMMGG_HHMMSS
# dentro <cartella-rilasci>, con .rilascio/commit dentro, mai quella in servizio, ognuna detta per nome.
# Codici: 0 bene · 1 fermato (niente toccato nel servizio) · 2 uso sbagliato.
# ============================================================================
set -uo pipefail

# Percorsi fuori da git che NON si collegano nella copia: rigenerabili (la copia li rifà), di sessione,
# cestini. Il resto (.env, .secrets, pg_dump_snapshots, qa_artifacts, .data, ...) si collega, cosi' la
# produzione legge gli stessi dati vivi di prima.
NON_COLLEGARE='(^|/)(node_modules|\.next|dist|\.turbo|\.cache|__pycache__|_da_eliminare|test-results|playwright-report)(/|$)|^\.claude/worktrees(/|$)|^\.turno/locale(/|$)|\.tsbuildinfo$'

say() { printf '[rilascio-copia] %s\n' "$*"; }
err() { printf '[rilascio-copia] %s\n' "$*" >&2; }
uso() { sed -n '18,27p' "$0" >&2; exit 2; }

# collega <src> <albero> <percorso>: collega un percorso fuori da git. Una cartella che dentro ha
# qualcosa da NON collegare (un node_modules, un .next, i worktree) non si collega intera: si scende
# e si collegano i suoi figli, uno per uno.
collega() {
  local src="$1" albero="$2" p="$3" su c
  [ -n "$p" ] || return 0
  printf '%s\n' "$p" | grep -qE "$NON_COLLEGARE" && return 0
  su="$(dirname "$p")"
  while [ "$su" != . ]; do [ -L "$albero/$su" ] && return 0; su="$(dirname "$su")"; done
  if [ -d "$src/$p" ] && [ ! -L "$src/$p" ] && \
     [ -n "$(cd "$src" && find "$p" -mindepth 1 -maxdepth 4 -print 2>/dev/null | grep -E "$NON_COLLEGARE" | head -1)" ]; then
    for c in "$src/$p"/* "$src/$p"/.[!.]* "$src/$p"/..?*; do
      [ -e "$c" ] || [ -L "$c" ] || continue
      collega "$src" "$albero" "$p/$(basename "$c")" || return 1
    done
    return 0
  fi
  if [ -e "$albero/$p" ] || [ -L "$albero/$p" ]; then
    [ -d "$src/$p" ] && [ -d "$albero/$p" ] && [ ! -L "$albero/$p" ] && {
      # cartella in git con dentro file ignorati: si scende
      for c in "$src/$p"/* "$src/$p"/.[!.]* "$src/$p"/..?*; do
        [ -e "$c" ] || [ -L "$c" ] || continue
        [ -e "$albero/$p/$(basename "$c")" ] && continue
        collega "$src" "$albero" "$p/$(basename "$c")" || return 1
      done
      return 0
    }
    err "FERMO: $p e' sia in git sia fuori da git"; return 1
  fi
  mkdir -p "$albero/$(dirname "$p")" && ln -s "$src/$p" "$albero/$p" || { err "FERMO: collegamento di $p non riuscito"; return 1; }
}

prepara() {
  local src="${1:?}" sha="${2:?}" base="${3:?}" ts albero p n=0
  git -C "$src" rev-parse --git-dir >/dev/null 2>&1 || { err "FERMO: $src non e' un repo git"; return 1; }
  sha="$(git -C "$src" rev-parse --verify --quiet "$sha^{commit}")" || { err "FERMO: commit $2 assente in $src"; return 1; }
  ts="${RILASCIO_TS:-$(date -u +%Y%m%d_%H%M%S)}"
  albero="$base/$ts/albero"
  [ -e "$albero" ] && { err "FERMO: $albero esiste gia'"; return 1; }
  mkdir -p "$albero" || { err "FERMO: non riesco a creare $albero"; return 1; }
  git -C "$src" archive "$sha" | tar -x -C "$albero" || { err "FERMO: estrazione di ${sha:0:8} non riuscita"; return 1; }
  local elenco; elenco="$(mktemp)"
  git -C "$src" ls-files -o -i --exclude-standard --directory > "$elenco"
  while IFS= read -r p; do
    collega "$src" "$albero" "${p%/}" || { rm -f "$elenco"; return 1; }
  done < "$elenco"
  rm -f "$elenco"
  n="$(find "$albero" -type l | wc -l)"
  mkdir -p "$albero/.rilascio"
  printf '%s\n' "$src" > "$albero/.rilascio/sorgente"
  printf '%s\n' "$sha" > "$albero/.rilascio/commit"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$albero/.rilascio/preparato_il"
  say "copia di ${sha:0:8} in $albero: $n collegamenti ai dati vivi di $src" >&2
  printf '%s\n' "$albero"
}

punta() {
  local link="${1:?}" albero="${2:?}"
  # una copia rilasciata, oppure (solo per tornare indietro dal primo passaggio) la cartella del repo
  [ -d "$albero" ] && { [ -f "$albero/.rilascio/commit" ] || [ -d "$albero/.git" ]; } || { err "FERMO: $albero non e' una copia rilasciata"; return 1; }
  if [ -e "$link" ] && [ ! -L "$link" ]; then err "FERMO: $link esiste e non e' un collegamento"; return 1; fi
  mkdir -p "$(dirname "$link")" && ln -sfn "$albero" "$link.nuovo" && mv -T "$link.nuovo" "$link" || { err "FERMO: non riesco a spostare $link"; return 1; }
  say "$link -> $albero ($(cut -c1-8 "$albero/.rilascio/commit" 2>/dev/null || git -C "$albero" rev-parse --short HEAD))"
}

pulisci() {
  local base="${1:?}" link="${2:?}" tieni="${3:-2}" prova="${4:-}" attivo d n=0
  [ -d "$base" ] || return 0
  attivo="$(readlink -f "$link" 2>/dev/null || true)"
  for d in $(find "$base" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}_[0-9]{6}' -printf '%f\n' | sort -r); do
    n=$((n+1))
    [ "$n" -le "$tieni" ] && continue
    if [ -n "$attivo" ] && [ "$attivo" = "$(readlink -f "$base/$d/albero" 2>/dev/null)" ]; then
      say "pulizia: tengo $d (e' in servizio)"; continue
    fi
    [ -f "$base/$d/albero/.rilascio/commit" ] || { say "pulizia: tengo $d (non e' una copia rilasciata)"; continue; }
    if [ "$prova" = --prova ]; then say "PROVA pulizia: cancellerei $base/$d ($(du -sh "$base/$d" | cut -f1))"; continue; fi
    rm -rf -- "${base:?}/${d:?}" && say "pulizia: cancellata $base/$d"
  done
}

cmd="${1:-}"; shift || true
case "$cmd" in
  prepara)  [ $# -eq 3 ] || uso; prepara "$@" ;;
  punta)    [ $# -eq 2 ] || uso; punta "$@" ;;
  sorgente) [ $# -eq 1 ] || uso; cat "$1/.rilascio/sorgente" ;;
  commit)   [ $# -eq 1 ] || uso; cat "$1/.rilascio/commit" ;;
  pulisci)  [ $# -ge 2 ] || uso; pulisci "$@" ;;
  *) uso ;;
esac
