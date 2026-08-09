#!/usr/bin/env bash
# gov-lib.sh — i pezzi nuovi della modalita' gov (#173), in un file a parte.
#
# PERCHE' NON DENTRO IL DRIVER. Il driver e' un programma che si esegue: per provare
# una sua funzione bisognerebbe farlo partire, e all'avvio ci sono i guard-rail (freno
# di sicurezza, repo pulito, lock globale) che lo fermano molto prima. Qui invece sono
# funzioni sorgibili, che una batteria puo' chiamare una per una — e quindi rompere di
# proposito per vedere se le prove se ne accorgono.
#
#   source scripts/gov-lib.sh
#
# Non esegue nulla quando viene sorgiato: solo definizioni.
#
# Vedi docs/superpowers/plans/2026-08-09-modalita-gov.md (voci G3 e G4).

# --- lock per cluster ------------------------------------------------------
#
# Sostituisce, per i lavoratori, il lock GLOBALE del driver. Quello resta e continua
# a significare «un solo orchestratore per repo»; questi dicono «questo cluster ce
# l'ha in mano qualcuno». Il meccanismo e' lo stesso gia' collaudato nel driver, e
# non se ne inventa un altro (decisione 7 di Enzo):
#
#   · acquisizione ATOMICA con `set -o noclobber` — decide il kernel, non un test
#     seguito da una scrittura, che lascia una finestra fra i due;
#   · lock di un processo VIVO: non si tocca, si rinuncia;
#   · lock di un processo MORTO: e' un orfano, si recupera;
#   · si rilascia solo il PROPRIO, mai quello di un altro.

gov_lock_prendi() {          # <dir> <cluster> [info] -> 0 preso, 1 occupato
  local dir="$1"
  local cluster="$2"
  local info="${3:-}"
  [[ -n "$dir" && -n "$cluster" ]] || return 2
  mkdir -p "$dir" 2>/dev/null || return 2
  local f="$dir/$cluster.lock"
  if [[ -f "$f" ]]; then
    local pid
    pid="$(head -1 "$f" 2>/dev/null || echo 0)"
    if kill -0 "$pid" 2>/dev/null; then
      return 1                                  # vivo: non e' nostro e non si tocca
    fi
    rm -f "$f"                                  # orfano di un morto: si recupera
  fi
  ( set -o noclobber
    printf '%s\n%s\n%s\n' "$$" "$(date +%Y-%m-%dT%H:%M:%S)" "$info" > "$f"
  ) 2>/dev/null || return 1
  return 0
}

gov_lock_rilascia() {        # <dir> <cluster> -> sempre 0
  # Le assegnazioni si separano: `local a="$1" b="$a"` NON e' affidabile — sotto
  # `set -u` bash crea prima tutte le locali (non assegnate) e poi le riempie, e
  # l'espansione di `$a` nella stessa riga muore con «unbound variable». Trovato
  # da questa stessa batteria, che si e' fermata a meta' senza dare un rosso.
  local dir="$1"
  local cluster="$2"
  local f="$dir/$cluster.lock"
  [[ -f "$f" ]] || return 0
  [[ "$(head -1 "$f" 2>/dev/null || echo 0)" == "$$" ]] && rm -f "$f"
  return 0
}

gov_lock_chi() {             # <dir> <cluster> -> stampa il pid, vuoto se libero
  local f="$1/$2.lock"
  [[ -f "$f" ]] || return 0
  local pid
  pid="$(head -1 "$f" 2>/dev/null || echo 0)"
  kill -0 "$pid" 2>/dev/null && echo "$pid"
  return 0
}

gov_lock_rilascia_tutti() {  # <dir> -> rilascia solo i propri
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  local f
  for f in "$dir"/*.lock; do
    [[ -e "$f" ]] || continue
    [[ "$(head -1 "$f" 2>/dev/null || echo 0)" == "$$" ]] && rm -f "$f"
  done
  return 0
}

# --- cartelle di lavoro separate ------------------------------------------
#
# MISURATO S1052, ed e' la ragione per cui il perimetro sui file NON basta: tre
# guardie del loop ragionano sull'INTERO albero di lavoro — «non parto su repo
# sporco» (zero-pending-driver.sh), l'impronta con cui il cancello di verifica
# decide se un verde vale ancora (verify_gate.py), e i controlli dovuti per ogni
# file toccato (zp_gate.py). Due lavoratori con perimetri di file disgiunti si
# romperebbero comunque a vicenda su queste tre. Quindi: un albero per lavoratore.
#
# Gli alberi stanno FUORI dal repo, come gia' fa il registro delle modalita': sono
# stato di macchina, non sorgente, e non devono comparire in `git status`.

gov_worktree_base() {        # <repo> -> il percorso base, fuori dal repo
  local repo="$1"
  echo "${GOV_WORKTREE_BASE:-$(dirname "$repo")/heuresys-gov-workers}"
}

gov_worktree_prepara() {     # <repo> <n> [ref] -> stampa il percorso; 1 se fallisce
  local repo="$1"
  local n="$2"
  local ref="${3:-HEAD}"
  local base dir
  base="$(gov_worktree_base "$repo")"
  dir="$base/w$n"

  if [[ -e "$dir/.git" ]]; then
    echo "$dir"                                 # gia' pronto: si riusa
    return 0
  fi

  mkdir -p "$base" 2>/dev/null || return 1
  # UN RAMO PER LAVORATORE, non un HEAD staccato. Con `--detach` i commit di una
  # sessione sarebbero nati orfani: nessun ramo li tiene, `git log` di main non li
  # vede, e il lavoro di un'intera corsa sarebbe recuperabile solo a mano dal
  # reflog. Con un ramo, a fine corsa si vede cosa ha prodotto ciascuno e lo si
  # porta su main con un merge — che e' una decisione, non un automatismo.
  git -C "$repo" worktree add -B "gov/w$n" "$dir" "$ref" >&2 || return 1

  # Cio' che `git worktree` NON porta, ed e' esattamente cio' che serve per lavorare:
  # i file ignorati. Senza, il lavoratore nasce senza credenziali e fallisce al primo
  # comando, in un modo che sembra un difetto del codice e non della preparazione.
  local f
  for f in .env .env.local .npmrc; do
    [[ -f "$repo/$f" ]] && cp "$repo/$f" "$dir/$f"
  done
  [[ -d "$repo/.secrets" ]] && cp -r "$repo/.secrets" "$dir/.secrets"

  echo "$dir"
  return 0
}

gov_worktree_pronto() {      # <dir> -> 0 se puo' lavorare, 1 se manca l'installazione
  [[ -d "$1/node_modules" ]]
}

# --- assegnazione ----------------------------------------------------------
#
# Il driver assegna, il lavoratore NON sceglie. Senza questo, N lavoratori
# chiamerebbero tutti `zp_state prossimo` e otterrebbero lo STESSO cluster: la
# selezione e' deterministica, quindi darebbe a tutti il primo della lista.

# --- avvio e raccolta dei lavoratori --------------------------------------
#
# Stanno qui, e non dentro il driver, per la ragione scritta in testa al file: il
# driver non si puo' far partire per provarlo. Il comando e' sostituibile con
# ZP_CLAUDE_CMD, cosi' la batteria puo' mettere al posto di `claude` un finto che
# scrive un esito e muore — e provare l'orchestrazione senza aprire sessioni vere
# e, soprattutto, senza toccare il freno di sicurezza.
#
# Lo stato di un lavoratore vive nel SUO albero, in `<albero>/.zp/`. Non serve
# rinominare nulla: la sessione figlia usa i percorsi relativi di sempre, e due
# lavoratori non si vedono perche' hanno due alberi, non perche' qualcuno ha
# aggiunto un prefisso a ogni file.

gov_avvia_lavoratore() {     # <dir> <cluster> <modo> <corsia> <ore> <budget> <permessi> -> pid
  local dir="$1"
  local cluster="$2"
  local modo="$3"
  local corsia="$4"
  local ore="$5"
  local budget="$6"
  local permessi="$7"

  mkdir -p "$dir/.zp"
  # Si cancella l'esito PRIMA: se resta quello del giro precedente, un lavoratore
  # troncato verrebbe letto come uno che ha chiuso bene.
  rm -f "$dir/.zp/last-outcome.json"

  local comando="/zero-pending-loop $modo --lane $corsia --budget-ore $ore"
  [[ -n "$cluster" ]] && comando="$comando --cluster $cluster"

  # stderr su FILE e non mescolato allo stdout: con `2>&1` una riga di warning
  # rompe il JSON, il costo torna 0 e il tetto di spesa non scatta mai (misurato
  # nel driver, rilievo B3 — qui vale identico).
  # La durata la misura il lavoratore stesso. Il driver aspetta i figli in ordine,
  # quindi un solo cronometro sul giro darebbe a tutti il tempo del piu' lento — e
  # proprio il numero che serve per sapere se il parallelo conviene sarebbe finto.
  rm -f "$dir/.zp/durata-s"
  ( cd "$dir"
    _t0=$(date +%s)
    "${ZP_CLAUDE_CMD:-claude}" -p "$comando" --output-format json --max-budget-usd "$budget" --permission-mode "$permessi" > ".zp/last-response.json" 2> ".zp/last-stderr.log"
    echo $(( $(date +%s) - _t0 )) > ".zp/durata-s"
  ) &
  echo $!
}

gov_raccogli_lavoratore() {  # <dir> -> "esito|costo|prossimo|durata_s"
  local dir="$1"
  local py="${ZP_PYTHON:-python}"
  local costo esito prossimo

  # Sempre da dentro l'albero, con percorsi RELATIVI: in Git Bash un percorso
  # assoluto e' in forma MSYS (/d/...) e Python su Windows non sa aprirlo.
  costo="$( cd "$dir" && "$py" -c "
import json,sys
try: print(json.load(sys.stdin).get('total_cost_usd') or 0)
except Exception: print(0)" < ".zp/last-response.json" 2>/dev/null || echo 0 )"

  if [[ -f "$dir/.zp/last-outcome.json" ]]; then
    esito="$( cd "$dir" && "$py" -c "
import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('outcome',''))" 2>/dev/null )"
    prossimo="$( cd "$dir" && "$py" -c "
import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('next',''))" 2>/dev/null )"
  else
    esito="troncato"; prossimo="recover"
  fi
  local durata
  durata="$(cat "$dir/.zp/durata-s" 2>/dev/null || echo 0)"
  case "$durata" in ''|*[!0-9]*) durata=0 ;; esac
  printf '%s|%s|%s|%s\n' "${esito:-troncato}" "${costo:-0}" "${prossimo:-}" "$durata"
}

gov_assegna() {              # <repo> <corsia> <lavoratori> [budget_ore] -> id, uno per riga
  local repo="$1"
  local corsia="$2"
  local lavoratori="$3"
  local ore="${4:-}"
  local py="${ZP_PYTHON:-python}"
  local args=(docs/kb/tools/zp_state.py perimetri --lane "$corsia"
              --lavoratori "$lavoratori" --json)
  [[ -n "$ore" ]] && args+=(--budget-ore "$ore")
  ( cd "$repo" && "$py" "${args[@]}" ) 2>/dev/null | "$py" -c "
import json,sys
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
for c in d.get('parallelo', []):
    print(c['id'])"
}

# --- la configurazione non si riscrive mentre qualcuno lavora ---------------
#
# Il modo `censimento` riscrive zp.config.yaml PER INTERO (azzera `clusters:`,
# aggiorna meta.plan, rimette clusters_classified) e si invoca a mano, quindi non
# passa dal lock del driver. Se gira mentre 2-3 lavoratori sono attivi, gli si
# sposta il pavimento sotto i piedi: leggono classi e perimetri di un piano che
# non esiste piu'.
#
# Il lucchetto e' lo STESSO dei cluster, con un nome riservato: nessun meccanismo
# nuovo da imparare, e il recupero degli orfani vale gia'.

gov_config_prendi()   { gov_lock_prendi "$1" config "${2:-}"; }
gov_config_rilascia() { gov_lock_rilascia "$1" config; }

gov_config_occupata() {      # <dir> -> 0 se qualcuno la sta riscrivendo
  [[ -n "$(gov_lock_chi "$1" config)" ]]
}
