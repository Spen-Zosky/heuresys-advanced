# deploy/postgres/env-proprietario.sh — B2, tappa 3 (2026-11-21)
#
# Da includere con `.` (source) DOPO aver caricato il file d'ambiente del repo,
# solo negli script che fanno DDL legittimo (migrazioni, storia36, rilascio).
#
# La password del proprietario `heuresys` non sta piu' nel file d'ambiente del
# repo, che leggono anche gli agenti: sta in
#     ~/.config/heuresys-proprietario/db.env   (modo 600, POSTGRES_PASSWORD=...)
# spostata una volta da deploy/postgres/sposta-password-proprietario.sh.
#
# Se il file c'e', POSTGRES_PASSWORD e PGPASSWORD prendono il suo valore.
# Se non c'e' (PC, gemello, VM prima dello spostamento) l'ambiente resta com'era:
# vale ancora la password del file d'ambiente, dove c'e'. Mai stampata.

__ep_file="${HEURESYS_PROPRIETARIO_DB_ENV:-$HOME/.config/heuresys-proprietario/db.env}"
if [ -f "$__ep_file" ]; then
  __ep_pw="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$__ep_file" | head -n1)"
  if [ -n "$__ep_pw" ]; then
    export POSTGRES_PASSWORD="$__ep_pw" PGPASSWORD="$__ep_pw"
  else
    echo "[env-proprietario] $__ep_file senza POSTGRES_PASSWORD" >&2
  fi
fi
unset __ep_file __ep_pw
