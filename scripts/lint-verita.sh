#!/usr/bin/env bash
# lint-verita.sh — il controllo di verità settimanale del wiki (automazione A10, voce R13).
#
# Piano docs/piani/PIANO_riordino-documentazione_20261125.md, decisione D4 di Enzo (25/11/2026):
# una volta a settimana un agente legge il wiki (docs/wiki/) e confronta le sue affermazioni con
# il codice, gli ADR e i registri. Propone, non decide: scrive le contraddizioni in
# docs/wiki/lint/<AAAAMMGG>.md, aggiunge una riga a docs/wiki/log.md e apre una PR in bozza di
# soli documenti. Non unisce mai e non modifica nessun altro file.
#
# Passi:
#   1. copia di prova da origin/main (scripts/copia-prova.sh, nome riservato «lint-verita»);
#   2. i controlli deterministici: check_documenti.py, build_wiki.py --check, build_adr_index.py --check;
#   3. l'agente, con il token dell'abbonamento (token-agenti.sh carica) e i soli strumenti di
#      lettura (Read, Grep, Glob): nessuna scrittura, nessun comando;
#   4. se c'è almeno un rilievo, ramo lint-verita/<AAAAMMGG>, commit del rapporto, PR in bozza.
#
# Uso: bash scripts/lint-verita.sh            (lo lancia il timer heuresys-advanced-lint-verita)
#      LINT_VERITA_PROVA=1 bash scripts/lint-verita.sh   (stampa il rapporto, non apre la PR)
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
NOME="lint-verita"
SEDE="${HEURESYS_PROVE_DIR:-$HOME/prove-heuresys-advanced}"
COPIA="$SEDE/$NOME"
OGGI="$(TZ=Europe/Rome date +%Y%m%d)"
MODELLO="${LINT_VERITA_MODELLO:-claude-sonnet-5-5}"

log() { echo "[lint-verita] $*"; }

exec 9>"${XDG_RUNTIME_DIR:-/tmp}/heuresys-lint-verita.lock"
flock -n 9 || { log "un'altra corsa è in volo: esco"; exit 0; }

git -C "$ROOT" fetch -q origin main

set +e
bash "$ROOT/scripts/copia-prova.sh" apri "$NOME" "lint di verità del wiki (timer heuresys-advanced-lint-verita)" --anche-se-altre
rc=$?
set -e
case "$rc" in
  0) ;;
  3|4)
    if [ -d "$COPIA" ]; then log "la copia $COPIA è rimasta da una corsa fallita: guardala e chiudila"; exit 1; fi
    log "un'altra copia di prova è aperta (esito $rc): riprovo la settimana dopo"; exit 0 ;;
  *) log "apertura della copia fallita (esito $rc)"; exit 1 ;;
esac
chiudi() { cd "$ROOT" && bash "$ROOT/scripts/copia-prova.sh" chiudi "$NOME" || log "chiusura della copia non riuscita: va chiusa a mano"; }
trap chiudi EXIT

cd "$COPIA"
RAPPORTO="docs/wiki/lint/$OGGI.md"
mkdir -p docs/wiki/lint

# 2. i controlli deterministici: il loro esito entra nel rapporto così com'è
deterministici="$( { python3 docs/kb/tools/check_documenti.py; python3 docs/kb/tools/build_wiki.py --check;
                     python3 docs/kb/tools/build_adr_index.py --check; } 2>&1 || true)"

# 3. l'agente, in sola lettura
# shellcheck disable=SC1091
[ -r "$HOME/.claude/tools/token-agenti.sh" ] && . "$HOME/.claude/tools/token-agenti.sh" carica
unset ANTHROPIC_API_KEY
PROMPT="Sei il controllo di verità settimanale del wiki di heuresys-advanced (docs/wiki/LEGGIMI.md).
Leggi docs/wiki/index.md e ogni pagina di docs/wiki/domini/. Per ogni affermazione della sezione
«Com'è oggi» e di «Come si fa», verifica nel repo (codice, migrazioni, ADR in docs/architecture/adr/,
registri in docs/kb/, CLAUDE.md, script citati) che sia vera oggi. Non modificare nessun file.
Rispondi SOLO con una tabella markdown con le colonne: pagina | affermazione | che cosa dice il repo
(con il percorso e la riga) | correzione proposta. Una riga per contraddizione vera; niente righe per
le affermazioni confermate. Se non trovi contraddizioni, rispondi esattamente: NESSUNA CONTRADDIZIONE."
# sotto systemd il PATH è minimo: claude sta di solito in ~/.local/bin (si sovrascrive con CLAUDE_BIN)
export PATH="$HOME/.local/bin:$PATH"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
errori="$(mktemp)"
set +e
esito_agente="$("$CLAUDE_BIN" -p "$PROMPT" --model "$MODELLO" --allowedTools "Read,Grep,Glob" \
                  --output-format text 2>"$errori")"
rc=$?
set -e
[ $rc -eq 0 ] || { log "l'agente è uscito con $rc: $(head -c 400 "$errori")"; rm -f "$errori"; exit 1; }
rm -f "$errori"

{
  printf -- '---\ndominio: qualita-verifica\nnatura: esito\nstato: chiuso\naggiornato_il: %s\n' "${OGGI:0:4}-${OGGI:4:2}-${OGGI:6:2}"
  printf -- 'sintesi: Controllo di verità del wiki del %s\nfonti: [docs/wiki/index.md]\nconcetti: [wiki]\n---\n\n' "$OGGI"
  printf '# Controllo di verità del wiki, %s\n\nCommit controllato: `%s`. Modello: `%s`. Script: `scripts/lint-verita.sh`.\n\n' \
    "$OGGI" "$(git rev-parse --short HEAD)" "$MODELLO"
  printf '## Controlli deterministici\n\n```\n%s\n```\n\n## Contraddizioni trovate dall'\''agente\n\n%s\n' "$deterministici" "$esito_agente"
} > "$RAPPORTO"

# il rapporto l'ha scritto questa corsa: se non diventa una PR si toglie, così la copia si chiude pulita
if [ -n "${LINT_VERITA_PROVA:-}" ]; then cat "$RAPPORTO"; rm -f "$RAPPORTO"; exit 0; fi
if printf '%s' "$esito_agente" | grep -q 'NESSUNA CONTRADDIZIONE' && printf '%s' "$deterministici" | grep -q ' 0 rilievi rossi'; then
  rm -f "$RAPPORTO"; log "nessuna contraddizione e controlli verdi: niente PR"; exit 0
fi

printf '| %s | lint | controllo di verità settimanale: [rapporto](lint/%s.md) | PR lint-verita/%s |\n' \
  "${OGGI:0:4}-${OGGI:4:2}-${OGGI:6:2}" "$OGGI" "$OGGI" >> docs/wiki/log.md
ramo="lint-verita/$OGGI"
git checkout -q -b "$ramo"
msg="$(mktemp)"
printf 'docs(wiki): controllo di verità del %s\n\nRapporto di scripts/lint-verita.sh: proposte, da rivedere prima di unire.\n' "$OGGI" > "$msg"
git add "$RAPPORTO" docs/wiki/log.md
git commit -q -F "$msg" -- "$RAPPORTO" docs/wiki/log.md
rm -f "$msg"
git push -q -u origin "$ramo"
gh pr create --draft --base main --head "$ramo" --title "docs(wiki): controllo di verità del $OGGI" \
  --body "Rapporto settimanale del controllo di verità del wiki (A10, piano di riordino del 25/11/2026). Le correzioni proposte sono in \`$RAPPORTO\`: si applicano nella PR, poi si unisce." >/dev/null
log "PR aperta su $ramo"
