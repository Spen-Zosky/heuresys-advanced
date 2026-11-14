#!/usr/bin/env bash
# Applica in ordine tutti i blocchi dell'allineamento RTL a UN database (copia o produzione). Si ferma al primo errore.
# Uso: bash applica.sh "<comando psql senza -f>" <cartella-log>
#   es. bash applica.sh "sudo -n -u postgres psql -X -d heuresys_advanced_prova_ripristino" /tmp/log
# Ordine (le dipendenze sono fra i file: D1 carica le tabelle di appoggio che D2, L, R leggono).
set -euo pipefail
PSQL="${1:?comando psql}"; LOG="${2:?cartella log}"; mkdir -p "$LOG"
QUI="$(cd "$(dirname "$0")" && pwd)"
for f in B_regole_maturazione_ccnl A1_livelli A2_organigramma A3_titoli_riporti C1_processi D1_skill D2_criticita E1_mansioni G_collaudo H_competenze_fuori_settore I_coerenza_storia J_testi_italiano J2_testi_residui K_successione L_carriere M_criticita_vuote N_rossi_storia O_percorsi_e_orizzonti P_obiettivi_e_percorsi Q_titoli_13 I_coerenza_storia S_classi_rimanenti T_successori_che_riportano U_review_in_corso R_formazione_obiettivi V_traduzioni_en W_ritira_ruoli_nuovi X_vettori_stantii; do
  [ "$f" = J_testi_italiano ] && f=J_testi_italiano
  file="$QUI/$f.sql"; [ -f "$file" ] || { echo "manca $file" >&2; exit 3; }
  $PSQL -v ON_ERROR_STOP=1 -f - < "$file" > "$LOG/$f.out" 2>&1 || { echo "ROSSO in $f (vedi $LOG/$f.out)" >&2; tail -5 "$LOG/$f.out" >&2; exit 1; }
  echo "$f: $(grep -a -E ' ok ' "$LOG/$f.out" | tail -1 | tr -s ' ' | cut -c1-120)"
done
