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

# --- l'identita' di database di un lavoratore --------------------------------
#
# V2 dell'analisi di sicurezza: l'albero isola i FILE, non i DATI. Copiando il `.env`
# del repo, un lavoratore ereditava le credenziali di produzione — 162 utenti veri,
# 5.641 buste paga. Un errore dentro un'operazione legittima sarebbe stato
# irreversibile, e nessun hook lo avrebbe distinto da un'operazione giusta.
#
# Qui la garanzia non e' un divieto che si aggira: e' un'identita' che il DBMS
# stesso impedisce di usare per scrivere (`default_transaction_read_only=on` sul
# ruolo). Provato: SELECT passa, UPDATE/DELETE/DROP falliscono nel database.
#
# Conseguenza di processo, dichiarata: un cluster che per chiudersi deve SCRIVERE
# sul database non appartiene alla corsia non presidiata. Non e' un limite dello
# strumento, e' la definizione della corsia.

gov_declassa_credenziali_db() {   # <repo> <albero>
  local repo="$1"
  local dir="$2"
  local segreto="$repo/.secrets/gov-worker.pass"
  local env="$dir/.env"

  [[ -f "$env" ]] || return 0
  if [[ ! -s "$segreto" ]]; then
    echo "albero $dir: manca .secrets/gov-worker.pass — lancia prima" >&2
    echo "  bash db/scripts/crea-ruolo-gov-worker.sh" >&2
    return 1
  fi

  local pw
  pw="$(cat "$segreto")"
  # Si riscrivono le sole due righe che contano. Il resto del `.env` serve, e
  # toccarlo a caso romperebbe il lavoratore per ragioni che non c'entrano.
  "${ZP_PYTHON:-python}" - "$env" "$pw" <<'PYEOF'
import sys, re, pathlib
env, pw = pathlib.Path(sys.argv[1]), sys.argv[2]
testo = env.read_text(encoding="utf-8")
testo = re.sub(r"(?m)^POSTGRES_USER=.*$", "POSTGRES_USER=gov_worker", testo)
testo = re.sub(r"(?m)^POSTGRES_PASSWORD=.*$", "POSTGRES_PASSWORD=" + pw, testo)
# Le credenziali di superutente non hanno alcun mestiere in un albero di lavoro.
testo = re.sub(r"(?m)^POSTGRES_SUPERUSER(_PASSWORD)?=.*$", "", testo)
env.write_text(testo, encoding="utf-8")
PYEOF
  return 0
}

gov_credenziali_declassate() {    # <albero> -> 0 se l'albero NON ha le credenziali di produzione
  local env="$1/.env"
  [[ -f "$env" ]] || return 1
  grep -qE '^POSTGRES_USER=gov_worker$' "$env" || return 1
  grep -qE '^POSTGRES_SUPERUSER' "$env" && return 1
  return 0
}


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
    # Un albero riusato resta al commit di quando fu creato: senza questo, un
    # lavoratore lavorerebbe su codice vecchio e i suoi commit divergerebbero da
    # main senza che nessuno lo dica. Si riallinea SOLO se non ha niente in ballo:
    # se ha lavoro non salvato non si tocca — meglio un albero indietro che lavoro
    # perso.
    # DUE condizioni, non una. La prima versione guardava solo i file non committati:
    # un lavoratore che aveva COMMITTATO il suo lavoro sul proprio ramo lasciava
    # l'albero «pulito», e il reset --hard glielo portava via. Successo davvero il
    # 2026-08-09 con il commit f059a057 (5 file, +317 righe): recuperato solo perche'
    # git non aveva ancora raccolto l'oggetto. Un albero e' riallineabile solo se non
    # ha NULLA da perdere — ne' in lavoro non salvato, ne' in commit propri.
    # [S1052] Si conta per CONTENUTO, non per hash. `git pull --rebase` nella procedura
    # di chiusura RISCRIVE i commit: il lavoro del lavoratore 1 e' entrato in main come
    # `b87a4efd` mentre il suo ramo puntava ancora a `7eb39abf`, e il merge originale non
    # esisteva piu'. Contando gli hash, la guardia vedeva «commit propri da non perdere»
    # su un lavoro GIA' AL SICURO, e quell'albero non si sarebbe riallineato MAI PIU':
    # misurato, il lavoratore della corsa dopo ha lavorato con una skill vecchia di un
    # giorno perche' il suo albero era fermo.
    #
    # `git cherry` confronta i patch-id: un commit gia' presente in main con altro hash
    # esce con `-`, uno davvero nuovo con `+`. Si contano solo i `+`, cioe' cio' che
    # andrebbe perso per davvero. La protezione resta intera — cambia solo che smette di
    # proteggere copie.
    local suoi
    suoi="$(git -C "$dir" cherry "$(git -C "$repo" rev-parse main)" HEAD 2>/dev/null | grep -c '^+' || true)"
    suoi="${suoi:-0}"
    if [[ -z "$(git -C "$dir" status --porcelain)" && "${suoi:-0}" == "0" ]]; then
      # Il ref si risolve NEL REPO PRINCIPALE: dentro l'albero «HEAD» e' il commit
      # dell'albero stesso, quindi un reset su HEAD non lo muove di un millimetro —
      # e sembra funzionare. Misurato: w1 restava indietro di 4 commit senza dirlo.
      local dove
      dove="$(git -C "$repo" rev-parse "$ref" 2>/dev/null)"
      [[ -n "$dove" ]] && git -C "$dir" reset --hard "$dove" >/dev/null 2>&1 || true
    else
      echo "albero $dir: ha lavoro da perdere (non salvato o commit propri), lo lascio com'e'" >&2
    fi
    # Anche un albero RIUSATO va declassato: quelli creati prima di V2 hanno ancora
    # le credenziali di produzione nel loro .env, e il riuso salterebbe il passaggio.
    gov_declassa_credenziali_db "$repo" "$dir" || return 1
    echo "$dir"
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

  gov_declassa_credenziali_db "$repo" "$dir"

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

  # L'INCARICO. E' cio' che rende il perimetro un recinto invece di una frase: gli
  # hook nell'albero lo leggono e rifiutano le scritture fuori. Si scrive PRIMA di
  # aprire la sessione, e il diario delle azioni riparte pulito a ogni giro.
  # SOLO se un cluster e' stato assegnato, cioe' solo in parallelo. Con un lavoratore
  # solo la sessione gira nel repo principale e non ha un perimetro: scrivergli un
  # incarico con perimetro vuoto significherebbe bloccarle OGNI scrittura — il recinto
  # farebbe fuori la modalita' di sempre. Un incarico vecchio va comunque rimosso, o
  # resterebbe a recintare chi non c'entra.
  rm -f "$dir/.zp/incarico.json" "$dir/.zp/diario.ndjson"

  # [S1052] Il diario ora vive FUORI dall'albero (B1: il sorvegliato non custodisce il
  # proprio registro), quindi la riga sopra non lo raggiunge piu' e il giornale si
  # accumulava fra corse diverse: l'istruttoria di un lavoro avrebbe contato le azioni
  # di cluster precedenti. Qui si ARCHIVIA invece di cancellare — il registro di una
  # corsa e' una prova e non si butta, ma quella nuova deve partire pulita.
  local diari="${GOV_DIARI:-$(dirname "$dir")/../heuresys-gov-diari}"
  local diario_att="$diari/$(basename "$dir").ndjson"
  if [[ -s "$diario_att" ]]; then
    mkdir -p "$diari/archivio" 2>/dev/null &&
      mv "$diario_att" "$diari/archivio/$(basename "$dir")-$(date +%Y%m%d-%H%M%S).ndjson" 2>/dev/null || true
  fi

  if [[ -n "$cluster" ]]; then
    local perim
    perim="$("${ZP_PYTHON:-python}" docs/kb/tools/zp_state.py perimetro-json "$cluster" 2>/dev/null)"
    [[ -z "$perim" ]] && perim="[]"
    printf '{"cluster": "%s", "perimetro": %s}
' "$cluster" "$perim" > "$dir/.zp/incarico.json"
  fi

  local comando="/zero-pending-loop $modo --lane $corsia --budget-ore $ore"
  [[ -n "$cluster" ]] && comando="$comando --cluster $cluster"

  # stderr su FILE e non mescolato allo stdout: con `2>&1` una riga di warning
  # rompe il JSON, il costo torna 0 e il tetto di spesa non scatta mai (misurato
  # nel driver, rilievo B3 — qui vale identico).
  # PERCHE' `MSYS2_ARG_CONV_EXCL` E NON `MSYS_NO_PATHCONV`. Git Bash traduce gli
  # argomenti che sembrano percorsi Unix quando lancia un eseguibile Windows: senza
  # difese, `/zero-pending-loop ...` arriva a claude come `C:/Git/zero-pending-loop`
  # e la skill non viene mai invocata. Ma `MSYS_NO_PATHCONV=1` spegne la traduzione
  # per TUTTO e resta nell'ambiente della sessione figlia — dove gli hook del
  # progetto ricevono `/d/...` non convertito e non trovano piu' i propri file:
  # misurato, la sessione moriva a zero turni con «can't open file D:\d\...».
  # Questa forma esclude il SOLO comando slash e lascia intatto il resto.
  # La durata la misura il lavoratore stesso. Il driver aspetta i figli in ordine,
  # quindi un solo cronometro sul giro darebbe a tutti il tempo del piu' lento — e
  # proprio il numero che serve per sapere se il parallelo conviene sarebbe finto.
  rm -f "$dir/.zp/durata-s"
  ( cd "$dir"
    _t0=$(date +%s)
    MSYS2_ARG_CONV_EXCL="/zero-pending-loop" "${ZP_CLAUDE_CMD:-claude}" -p "$comando" --output-format json --max-budget-usd "$budget" --permission-mode "$permessi" > ".zp/last-response.json" 2> ".zp/last-stderr.log"
    echo $(( $(date +%s) - _t0 )) > ".zp/durata-s"
  ) &
  # Il pid si consegna in una VARIABILE, non su stdout. Con `$( )` la funzione gira
  # in una sottoshell: il figlio e' suo, non del driver, e `wait` risponde «pid non
  # e' un figlio di questa shell» (exit 127). Il driver credeva di aver aspettato,
  # raccoglieva subito e leggeva «troncato» su sessioni ancora vive.
  GOV_ULTIMO_PID=$!
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

# SCRITTURA BINARIA, non print(). Su Windows print() chiude le righe con CRLF, e quel
# ritorno a capo entra nel nome del cluster: finisce nel file di lucchetto, nel prompt
# del lavoratore e dentro il giornale di spesa, che diventa JSON non valido. Il driver
# scarta ogni riga illeggibile IN SILENZIO, quindi il tetto di spesa smette di vedere
# qualunque costo e non scatta mai. Misurato il 2026-08-09: un lavoratore costato 2,20
# dollari e un totale che diceva 0,00. Lo stesso difetto che la review di luglio aveva
# gia chiuso una volta, tornato per una strada diversa.
# --- il consuntivo: cio' che il lavoratore ha DAVVERO toccato ----------------
#
# B2 della fase 2. Il recinto rifiuta le uscite dal perimetro mentre accadono, ma una
# difesa sola non basta per una cosa che Enzo ha definito «non accettabile»: se il
# recinto manca un caso, senza questo NESSUNO se ne accorge. Qui si guarda il
# risultato, non l'intenzione — `git diff` contro il perimetro dichiarato.
#
# E' anche il primo pezzo della regola di Enzo del 2026-08-09: «tutte le attivita' di
# controllo finale e di effettiva chiusura sono responsabilita' della sessione gov».
# L'esito che il lavoratore scrive e' una PROPOSTA; questo e' il primo controllo che
# la sessione gov gli fa, e che puo' respingerla.

gov_fuori_perimetro() {      # <repo> <albero> <cluster> -> stampa i file fuori, se ce ne sono
  local repo="$1"
  local dir="$2"
  local cluster="$3"
  local py="${ZP_PYTHON:-python}"
  [[ -n "$cluster" ]] || return 0

  local perim
  perim="$( cd "$repo" && "$py" docs/kb/tools/zp_state.py perimetro-json "$cluster" 2>/dev/null )"
  [[ -z "$perim" ]] && perim="[]"

  # Tutto cio' che il ramo ha prodotto: i commit rispetto a main E cio' che resta non
  # committato. Un lavoratore che lascia il lavoro non committato non e' per questo
  # fuori dai controlli.
  { git -C "$dir" diff --name-only "$(git -C "$repo" rev-parse main)"...HEAD 2>/dev/null
    git -C "$dir" status --porcelain 2>/dev/null | sed -E 's/^.{3}//'
  } | sort -u | "$py" -c "
import json,sys
perim = json.loads(sys.argv[1])
concessi = ('.zp/', '.handoff/')
fuori = []
for riga in sys.stdin:
    f = riga.strip().strip('\"')
    if not f or f.startswith(concessi):
        continue
    if not any(f == p or f.startswith(p.rstrip('/') + '/') for p in perim):
        fuori.append(f)
sys.stdout.buffer.write(''.join(x + chr(10) for x in fuori).encode())" "$perim"
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
sys.stdout.buffer.write(str().join(c[str(chr(39)+chr(105)+chr(100)+chr(39))[1:-1]] + chr(10) for c in d.get(chr(112)+chr(97)+chr(114)+chr(97)+chr(108)+chr(108)+chr(101)+chr(108)+chr(111), [])).encode())"
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
