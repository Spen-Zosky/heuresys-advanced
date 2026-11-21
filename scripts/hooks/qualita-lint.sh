#!/bin/sh
# qualita-lint.sh — hook PostToolUse (Edit|Write|MultiEdit): lint del SOLO file modificato.
# Uscita 2 = errori di lint: Claude li vede e corregge. Qualsiasi altro problema
# (file fuori dai pacchetti, eslint assente o non configurato, timeout) non blocca.
# Budget: 40 secondi. La suite intera resta alla CI.
set -u
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){}})')
[ -n "$FILE" ] || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$FILE" in /*) ABS="$FILE" ;; *) ABS="$ROOT/$FILE" ;; esac
REL=${ABS#"$ROOT"/}
case "$REL" in
  node_modules/*|*/node_modules/*|*/dist/*|*/.next/*) exit 0 ;;
  apps/*/*|packages/*/*) ;;
  *) exit 0 ;;
esac
case "$REL" in
  *.ts|*.tsx|*.mts|*.js|*.mjs) ;;
  *) exit 0 ;;
esac
[ -f "$ABS" ] || exit 0
PKG=$(printf '%s' "$REL" | cut -d/ -f1-2)
cd "$ROOT/$PKG" 2>/dev/null || exit 0
OUT=$(timeout 40 pnpm exec eslint --no-warn-ignored "$ABS" 2>&1)
RC=$?
# eslint: 0 = pulito, 1 = errori di lint, 2 = configurazione o uso errato (non e' colpa del file).
if [ "$RC" -eq 1 ]; then
  printf 'Lint: errori in %s (correggili prima di proseguire)\n%s\n' "$REL" "$OUT" >&2
  exit 2
fi
exit 0
