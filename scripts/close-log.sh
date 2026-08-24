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
#   bash scripts/close-log.sh sessione          # stampa la sessione DERIVATA (#191)
#
#   passo : registra|verifica|pubblica|propaga|deploy|clone-db|<libero>
#   esito : eseguito|saltato|ignoto|fallito|parziale
#   perche: prosa breve — DEVE dire su quale misura si basa («misurato: ...», «IGNOTO: ...»)
#
# La sessione si passa in env HEURESYS_SESSION (es. S1046); in sua assenza viene DERIVATA
# (#191, catena di precedenza documentata sotto `sessione_derivata`), e solo se ogni fonte
# tace la riga porta "S?".
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
# env override: solo per i test, come sopra.
SESSION_FILE="${HEURESYS_SESSION_FILE:-$ROOT/.handoff/session-id}"

# --------------------------------------------------------------------------- la sessione
# #191 — MISURATO 2026-08-15: `S?` non era il caso raro, era il caso NORMALE — 159 righe su 171.
# `${HEURESYS_SESSION:-S?}` da solo non poteva funzionare: NESSUNO esportava quella variabile
# (`grep -rl HEURESYS_SESSION` la trovava solo in chi la LEGGE e in un test). Il rimedio di #148
# ha cambiato il RAGGRUPPAMENTO del report, non la causa: le chiusure restavano distinte fra
# loro, ma nessuna sapeva ancora dire di CHI fosse.
#
# PERCHE' IL COMMIT DI HANDOFF NON BASTA COME FONTE PRIMARIA (la strada scritta nel register,
# provata e declassata a ripiego): l'ultimo commit `handoff S<N>` e' quello della sessione
# PRECEDENTE mentre la sessione e' in corso (⟹ N+1), e quello di QUESTA dopo la chiusura (⟹ N).
# I due casi non si distinguono: ne' da STATE.md (dopo l'handoff il numero coincide), ne' da
# HEAD (dopo il commit di handoff possono atterrarne altri — successo in S1063, `22b78564`).
# Un valore ambiguo non e' verificabile, ed e' proprio la proprieta' che serve qui.
#
# QUINDI il numero si fissa al BOOT, quando la risposta e' univoca (nessuna chiusura in volo),
# e si deposita in .handoff/session-id — per-macchina e gitignored, come questo stesso diario.
# Precedenza, dalla piu' forte alla piu' debole. L'ultima dichiara di non sapere invece di
# inventare, perche' un segnaposto onesto e' misurabile e una deduzione sbagliata no:
#   1. HEURESYS_SESSION      — chi orchestra la chiusura sa gia' chi e'
#   2. .handoff/session-id   — depositato dal boot (session-boot.ps1 §5b)
#   3. git+STATE, RIPIEGO    — vale finche' il boot non ha depositato: se STATE e' piu' avanti
#      dell'ultimo handoff committato, l'handoff di questa sessione e' scritto ma non ancora
#      pubblicato (⟹ STATE); altrimenti la sessione e' in corso (⟹ ultimo handoff + 1)
#   4. S?                    — nessuna delle tre
sessione_derivata() {
  if [ -n "${HEURESYS_SESSION:-}" ]; then printf '%s' "$HEURESYS_SESSION"; return; fi

  if [ -s "$SESSION_FILE" ]; then
    v="$(head -n1 "$SESSION_FILE" | tr -d '\r[:space:]')"
    if [ -n "$v" ]; then printf '%s' "$v"; return; fi
  fi

  # Si guardano i SOGGETTI, non i messaggi interi. `git log --grep` cerca anche nel CORPO:
  # il commit che ha introdotto questa funzione descriveva «l'ultimo commit `handoff S<N>`»
  # nel proprio corpo, `--grep` lo ha selezionato, `%s` ha restituito un soggetto senza numero
  # e il ripiego e' regredito di una sessione nello stesso momento in cui veniva scritto.
  # Misurato dalla batteria il 2026-08-15 — un difetto che parla di se' stesso.
  n="$(git -C "$ROOT" log -200 --format=%s 2>/dev/null \
       | grep -oE 'handoff S[0-9]{3,4}' | head -n1 | grep -oE '[0-9]{3,4}' || true)"
  st="$(grep -oE '\bS[0-9]{3,4}\b' "$ROOT/.handoff/STATE.md" 2>/dev/null | head -n1 | tr -d 'S' || true)"

  if [ -n "$n" ]; then
    if [ -n "$st" ] && [ "$st" -gt "$n" ] 2>/dev/null; then printf 'S%s' "$st"; return; fi
    printf 'S%s' "$((n + 1))"; return
  fi
  if [ -n "$st" ]; then printf 'S%s' "$st"; return; fi
  printf 'S?'
}

cmd="${1:-step}"; shift || true

case "$cmd" in
  step)
    step="${1:?usage: close-log.sh step <passo> <esito> <perche...>}"; shift
    outcome="${1:?usage: close-log.sh step <passo> <esito> <perche...>}"; shift
    why="$*"
    ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
    session="$(sessione_derivata)"
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
    # --- corse INTERROTTE (#229) --------------------------------------------------------
    # Una corsa che porta l'`apertura` ma non la `chiusura` e' stata uccisa a meta'. Il segnale
    # e' un'ASSENZA di proposito: un trap che provasse a scrivere l'interruzione puo' non
    # scattare (SIGKILL) o scattare a sproposito, mentre un'assenza non puo' essere registrata
    # male. Misurato il 2026-08-24: una corsa uccisa a 10 minuti compariva come «1 passi».
    #
    # DUE esclusioni, ognuna da un falso allarme reale dello stesso giorno:
    #  · le corse PRIMA di #229 non hanno l'apertura e non sono giudicabili — dichiararle
    #    interrotte sarebbe un allarme retroattivo su decine di corse storiche;
    #  · una corsa con la SOLA apertura e nessun passo di lavoro NON e' interrotta: non e' mai
    #    partita. E' il caso del dry-run, che usciva subito dopo aver scritto l'apertura — 59
    #    aperture orfane in un pomeriggio, e il boot annunciava «58 chiusure interrotte». Una
    #    corsa davvero uccisa ha sempre almeno un passo fatto prima di morire.
    interrotte="$(awk -F'"' '
      { run=""; step=""
        for(i=1;i<=NF;i++){ if($i=="run") run=$(i+2); if($i=="step") step=$(i+2) }
        if(run==""||step=="") next
        n[run]++
        if(step=="apertura") ap[run]=1
        if(step=="chiusura") ch[run]=1 }
      END { for (r in ap) if (!(r in ch) && n[r] > 1) print r }' "$LOG" | sort)"
    if [ -n "$interrotte" ]; then
      echo
      echo "  ⚠ CORSE INTERROTTE (apertura, lavoro fatto, nessuna chiusura) — la sessione successiva le eredita:"
      echo "$interrotte" | while read -r r; do
        [ -n "$r" ] || continue
        ultimo="$(grep "\"run\":\"$r\"" "$LOG" | tail -1 | grep -oE '"step":"[^"]*"' | cut -d'"' -f4)"
        quando="$(grep "\"run\":\"$r\"" "$LOG" | tail -1 | grep -oE '"ts":"[^"]*"' | cut -d'"' -f4)"
        printf "      %s  ultimo passo: %-16s %s\n" "$r" "${ultimo:-?}" "${quando:-?}"
      done
    fi
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

  sessione)
    # Chi orchestra la chiusura la esporta una volta e la passa ai figli, cosi' tutti i passi
    # di una stessa corsa portano lo stesso numero anche se qualcuno gira altrove.
    sessione_derivata; echo
    ;;

  *) echo "usage: close-log.sh step <passo> <esito> <perche...> | report [N] | sessione" >&2; exit 1 ;;
esac
