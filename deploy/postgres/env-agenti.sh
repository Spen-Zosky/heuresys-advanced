# deploy/postgres/env-agenti.sh — B2, seconda tappa (2026-11-21)
#
# Da includere con `.` (source) DOPO aver caricato il `.env`: sostituisce
# l'utente e la password del database con quelli di `heuresys_agenti`, il ruolo
# che scrive solo righe (niente DROP, TRUNCATE, ALTER, CREATE). Lo usano gli
# script e i giri automatici che non cambiano la struttura del database.
#
# La credenziale sta in ~/.config/claude-agenti/db-agenti.env (modo 600), creata
# da deploy/postgres/assegna-password-agenti.sh. Non viene mai stampata.
#
# Dove il file non c'e' (PC via tunnel, gemello: la propagazione e' una decisione
# di Enzo) lo script lo dice su stderr e lascia l'ambiente com'era.
#
# Effetto: POSTGRES_USER, POSTGRES_PASSWORD, PGUSER, PGPASSWORD, ATLAS_PGUSER
# puntano a heuresys_agenti; HEURESYS_PG_RUOLO=agenti lo dichiara a chi segue.

__ea_file="${HEURESYS_AGENTI_DB_ENV:-$HOME/.config/claude-agenti/db-agenti.env}"
if [ -f "$__ea_file" ]; then
  __ea_user="$(sed -n 's/^POSTGRES_AGENT_USER=//p' "$__ea_file" | head -n1)"
  __ea_pw="$(sed -n 's/^POSTGRES_AGENT_PASSWORD=//p' "$__ea_file" | head -n1)"
  if [ -n "$__ea_user" ] && [ -n "$__ea_pw" ]; then
    export POSTGRES_USER="$__ea_user" PGUSER="$__ea_user" ATLAS_PGUSER="$__ea_user"
    export POSTGRES_PASSWORD="$__ea_pw" PGPASSWORD="$__ea_pw"
    export HEURESYS_PG_RUOLO=agenti
  else
    echo "[env-agenti] $__ea_file incompleto: resto sull'utente gia' impostato" >&2
  fi
else
  echo "[env-agenti] manca $__ea_file: resto sull'utente gia' impostato" >&2
fi
unset __ea_file __ea_user __ea_pw
