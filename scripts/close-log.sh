#!/usr/bin/env bash
#
# scripts/close-log.sh — RENDICONTO della chiusura di sessione (S1046).
#
# Una riga per passo, append-only, in .handoff/close-log.ndjson (per-macchina, gitignored).
#
# DISTINZIONE FONDANTE — questo file NON è stato, è memoria storica:
#   • un PREDICATO misura «è già vero?» ADESSO, interrogando la realtà (git, ssh, psql).
#     Se si perde, si rimisura: nessun danno.
#   • questo RENDICONTO risponde a «cosa ho fatto, e quando?». Se si perde, si perde la storia,
#     NON la correttezza.
# Nessuna decisione della catena di chiusura legge questo file. Se una decisione cominciasse a
# leggerlo, la correttezza tornerebbe a dipendere dalla memoria — che è esattamente il difetto
# per cui il marcatore .session-align.marker degrada in silenzio quando viene consumato.
#
# Perché esiste: al 2026-08-06 il git log conta 148 commit «handoff S<N>» su 108 sessioni, ma
# quel numero NON sa distinguere una chiusura che ha prodotto due commit (S954: 1 minuto fra i due)
# da una sessione ripresa e ri-chiusa il giorno dopo (S1041: 18 ore). Senza questo diario la
# domanda «quante chiusure sono ripetizioni inutili?» non è misurabile — solo opinabile.
#
# Uso:
#   bash scripts/close-log.sh step <passo> <esito> <perche...>
#   bash scripts/close-log.sh report [N]        # riassume le ultime N sessioni (default 10)
#
#   passo : registra|verifica|pubblica|propaga|deploy|clone-db|<libero>
#   esito : eseguito|saltato|ignoto|fallito|parziale
#   perche: prosa breve — DEVE dire su quale misura si basa («misurato: ...», «IGNOTO: ...»)
#
# La sessione si passa in env HEURESYS_SESSION (es. S1046); in sua assenza la riga porta "S?".
#
# MISURATO 2026-08-12 (#148): "S?" NON era il caso raro, era il caso NORMALE — 84 righe su 96.
# Nessuno dei due chiamanti reali (close-propagate.sh, align-clones.sh) esportava
# HEURESYS_SESSION, quindi il diario nato per misurare le chiusure non sapeva dire di QUALE
# chiusura stesse parlando: `report` raggruppa per sessione, e 84 passi di cinque giorni
# diversi finivano in un blocco solo. La domanda per cui questo file esiste — «quante chiusure
# sono ripetizioni inutili?» — restava percio' non misurabile, con lo stesso difetto del
# `git log` che doveva sostituire, in forma peggiore.
#
# RIMEDIO: ogni riga porta anche `run`, l'identificativo della CORSA di chiusura. Non dipende
# da una variabile che qualcuno debba ricordarsi di esportare: close-propagate.sh lo esporta
# per i suoi figli, e in sua assenza close-log ne genera uno per corsa. Il numero di sessione
# resta un di piu': se c'e' si legge, se manca le chiusure restano comunque DISTINTE, che e'
# la proprieta' di cui la misura ha bisogno.
# Dependency-free (no jq): il JSON è escapato a mano, come scripts/journal-append.sh.
# NON FATALE per costruzione: ogni chiamata dovrebbe essere in coda `|| true` — un osservatore
# che fa fallire ciò che osserva è un difetto, non una guardia.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
# env override: solo per i test (default invariato) — il diario reale non va inquinato da righe
# di prova, altrimenti la misura che serve a decidere la ristrutturazione parte già sporca.
LOG="${HEURESYS_CLOSE_LOG:-$ROOT/.handoff/close-log.ndjson}"

cmd="${1:-step}"; shift || true

case "$cmd" in
  step)
    step="${1:?usage: close-log.sh step <passo> <esito> <perche...>}"; shift
    outcome="${1:?usage: close-log.sh step <passo> <esito> <perche...>}"; shift
    why="$*"
    ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
    session="${HEURESYS_SESSION:-S?}"
    # L'id di CORSA: ereditato da chi orchestra la chiusura, altrimenti generato qui.
    # Una riga isolata non deve poter finire nel mucchio di un'altra chiusura.
    run="${HEURESYS_CLOSE_RUN:-orfana-$(date +%Y%m%dT%H%M%S)-$$}"
    head_sha="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
    host="$(hostname 2>/dev/null || echo '?')"

    mkdir -p "$ROOT/.handoff"
    esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
    printf '{"ts":"%s","session":"%s","run":"%s","host":"%s","head":"%s","step":"%s","outcome":"%s","why":"%s"}\n' \
      "$ts" "$(esc "$session")" "$(esc "$run")" "$(esc "$host")" "$head_sha" \
      "$(esc "$step")" "$(esc "$outcome")" "$(esc "$why")" >> "$LOG"
    echo "  [close-log] $step=$outcome — $why"
    ;;

  report)
    n="${1:-10}"
    [ -f "$LOG" ] || { echo "nessun rendiconto ancora: $LOG"; exit 0; }
    echo "=== rendiconto chiusure — ultime $n CORSE ($LOG) ==="
    # Raggruppa per CORSA di chiusura, non per sessione (#148): fino al 2026-08-12
    # raggruppava per sessione, e siccome 84 righe su 96 portavano "S?" finivano tutte
    # in un blocco solo — cinque giorni di chiusure diverse indistinguibili fra loro.
    # Le righe scritte prima non hanno `run`: degradano alla sessione, come prima,
    # invece di sparire dal rendiconto.
    awk -v want="$n" '
      { r="" }
      match($0, /"run":"[^"]*"/)     { r=substr($0,RSTART+7,RLENGTH-8) }
      match($0, /"session":"[^"]*"/) { sess=substr($0,RSTART+11,RLENGTH-12) }
      { s = (r != "") ? r : sess
        etichetta[s] = (r != "" && sess != "S?" && sess != "") ? sess " (" s ")" : s }
      match($0, /"ts":"[^"]*"/)      { t=substr($0,RSTART+6,RLENGTH-7) }
      match($0, /"step":"[^"]*"/)    { p=substr($0,RSTART+8,RLENGTH-9) }
      match($0, /"outcome":"[^"]*"/) { o=substr($0,RSTART+11,RLENGTH-12) }
      match($0, /"why":"[^"]*"/)     { w=substr($0,RSTART+7,RLENGTH-8) }
      { if (!(s in seen)) { seen[s]=1; order[++k]=s }
        body[s]=body[s] sprintf("    %-10s %-9s %s\n", p, o, w)
        if (!(s in t0)) t0[s]=t
        t1[s]=t; cnt[s]++ }
      END {
        start = (k > want) ? k - want + 1 : 1
        for (i=start; i<=k; i++) { s=order[i]
          printf "\n%s  (%d passi, %s -> %s)\n", etichetta[s], cnt[s], t0[s], t1[s]
          printf "%s", body[s] }
      }' "$LOG"
    echo
    echo "--- sintesi ---"
    printf "  righe totali : %s\n" "$(wc -l < "$LOG" | tr -d ' ')"
    printf "  sessioni     : %s\n" "$(grep -oE '"session":"[^"]*"' "$LOG" | sort -u | wc -l | tr -d ' ')"
    printf "  corse        : %s
" "$(grep -oE '"run":"[^"]*"' "$LOG" | sort -u | wc -l | tr -d ' ')"
    printf "  senza corsa  : %s (righe di prima di #148)
" "$(grep -cv '"run":' "$LOG" || true)"
    for o in eseguito saltato ignoto fallito parziale; do
      c="$(grep -c "\"outcome\":\"$o\"" "$LOG" || true)"
      [ "$c" = 0 ] || printf "  %-9s    : %s\n" "$o" "$c"
    done
    ;;

  *) echo "usage: close-log.sh step <passo> <esito> <perche...> | report [N]" >&2; exit 1 ;;
esac
