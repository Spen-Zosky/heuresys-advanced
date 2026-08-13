#!/usr/bin/env python3
"""session_mode.py — le modalita' di sessione di heuresys-advanced.

    avvia sessione        -> modalita' `canonical`  (sviluppo, comportamento storico)
    avvia sessione lab    -> modalita' `lab`        (analisi, sola lettura sul prodotto)

Sono DUE, e non e' un caso: `lab` allenta il cancello di verifica perche' e' l'unica
che non scrive nel repo. Qualunque altra cosa venga digitata dopo «avvia sessione»
non e' riconosciuta e degrada a `canonical` — il fail-safe: dimenticare o sbagliare
il comando non apre mai un varco.

Principio: la modalita' non e' una promessa del modello, e' uno STATO su disco
marcato sul `session_id`. Gli hook la leggono, quindi due sessioni concorrenti
sullo stesso repo possono avere trattamenti diversi nello stesso istante.

    <padre del repo>/.heuresys-session-mode/<session_id>.json

Il registro sta FUORI dal repo: non sporca il working tree e non si propaga ai
cloni (e' stato locale di macchina, non configurazione).

Fallimento sicuro
-----------------
Marcatore assente, illeggibile, corrotto, o payload senza `session_id`
=> `canonical`, cioe' il comportamento piu' severo, quello di sempre.
Un guasto non apre mai la modalita' permissiva.

Sottocomandi
------------
  prompt-hook   UserPromptSubmit — riconosce i due comandi e marca la modalita'
  stop-gate     Stop/SubagentStop — in `lab` lascia passare, altrimenti delega
                a docs/kb/tools/verify_gate.py check --hook
  lab-guard     PreToolUse — in `lab` vieta le scritture; NON filtra mai le letture
  mode          diagnostica: stampa la modalita' di una sessione
  gc            ripulisce i marcatori vecchi
  selftest      batteria di casi sulle decisioni della guardia (usata come
                prova di portabilita' sui cloni)
"""
from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path

CANONICAL = "canonical"
LAB = "lab"
MODI = (CANONICAL, LAB)
MAX_MARKER_AGE_S = 14 * 24 * 3600

# --- percorsi -------------------------------------------------------------


def repo_root() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env:
        p = Path(env)
        if p.is_dir():
            return p.resolve()
    return Path(__file__).resolve().parents[2]


REPO = repo_root()
PARENT = REPO.parent
STORE = PARENT / ".heuresys-session-mode"
LAB_DIR = PARENT / "heuresys-design-lab"


def norm(p) -> str:
    try:
        return os.path.normcase(os.path.realpath(str(p)))
    except OSError:
        return os.path.normcase(str(p))


def is_inside(path, root) -> bool:
    a, b = norm(path), norm(root)
    return a == b or a.startswith(b.rstrip(os.sep) + os.sep)


def write_roots() -> list[Path]:
    """Dove una sessione lab puo' scrivere."""
    roots = [LAB_DIR, STORE, Path.home() / ".claude" / "projects"]
    for var in ("CLAUDE_SCRATCHPAD_DIR", "TMPDIR", "TEMP", "TMP"):
        v = os.environ.get(var)
        if v:
            roots.append(Path(v))
    return roots


# --- registro delle modalita' --------------------------------------------


def marker(session_id: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id or "unknown")[:120]
    return STORE / f"{safe}.json"


def get_mode(session_id: str) -> str:
    if not session_id:
        return CANONICAL
    try:
        data = json.loads(marker(session_id).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return CANONICAL
    mode = data.get("mode")
    # Elenco esplicito, non un ternario: finche' la funzione diceva «lab o
    # canonical», una modalita' nuova veniva trattata in silenzio come canonica
    # e nessuno se ne accorgeva. Un valore ignoto resta canonical — il fallimento
    # sicuro non cambia: e' il comportamento piu' severo.
    return mode if mode in MODI else CANONICAL


def leggi_marcatore(session_id: str) -> dict:
    """Il payload del marcatore, o {} se assente/illeggibile.

    Serve alle plance: `get_mode` risponde «che modalita'», questa risponde
    «e con quale incarico» — quale cluster sta lavorando un lavoratore, e da quando."""
    if not session_id:
        return {}
    try:
        data = json.loads(marker(session_id).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def set_mode(session_id: str, mode: str, implicita: bool = False) -> None:
    """Scrive il marcatore.

    `implicita` distingue una modalita' DICHIARATA da una dedotta: senza il comando,
    la sessione e' canonica per fail-safe, ed e' un'informazione diversa da «Enzo ha
    scritto avvia sessione». Il registro deve saper dire quale delle due, altrimenti
    la storia racconta una certezza che non c'era (#128).
    """
    STORE.mkdir(parents=True, exist_ok=True)
    ora = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    payload_marcatore = {
        "mode": mode,
        "session_id": session_id,
        "repo": str(REPO),
        "set_at": ora,
        # L'ULTIMO SEGNO DI VITA, rinfrescato a ogni prompt. Senza, la durata di una
        # sessione non era misurabile e una sessione lunga poteva vedersi cancellare
        # il marcatore mentre era in corso.
        "last_seen": ora,
        "implicita": implicita,
    }
    marker(session_id).write_text(
        json.dumps(payload_marcatore, indent=2), encoding="utf-8")


def tocca(session_id: str) -> None:
    """Aggiorna il solo `last_seen`, lasciando intatto il resto.

    Non riscrive `mode`: la modalita' la decide il primo messaggio, e un messaggio
    successivo non deve poterla cambiare per sbaglio. Un errore qui e' silenzioso e
    grave — sposterebbe una sessione da lab a canonica o viceversa senza dirlo.
    """
    p = marker(session_id)
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(d, dict):
            return
        d["last_seen"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        p.write_text(json.dumps(d, indent=2), encoding="utf-8")
    except (OSError, ValueError):
        return                      # un marcatore illeggibile non fa fallire un prompt


# --- che cosa comporta una modalita' -------------------------------------
#
# DUE PREDICATI, NON UNA CATENA DI `if` SPARSI: la domanda «questa modalita' e'
# sorvegliata?» e la domanda «questa modalita' passa dal cancello?» sono diverse, e
# tenerle separate evita che una risposta venga dedotta dall'altra.


def guardia_si_applica(mode: str) -> bool:
    """Vero se la guardia sulle chiamate va consultata in questa modalita'."""
    return mode == LAB


def cancello_di_verifica_si_applica(mode: str) -> bool:
    """Vero se il cancello di verifica deve girare a fine turno."""
    return mode != LAB


def gc(giorni: int | None = None, esegui: bool = True) -> list[str]:
    """Pota i marcatori piu' vecchi di `giorni`. **Non piu' automatica** (#128).

    Prima girava a ogni apertura di sessione con una soglia cablata di 14 giorni e
    senza dire niente: la storia si accorciava da sola. Adesso e' un atto esplicito —
    `hook.sh gc [giorni]` — perche' la decisione di potare e' di Enzo, non un effetto
    collaterale dell'aprire una sessione.

    Restituisce i NOMI dei marcatori interessati invece di un numero: un conteggio non
    dice cosa si e' perso. Con `esegui=False` si vede cosa cancellerebbe senza farlo.
    """
    soglia_s = (giorni if giorni is not None else 14) * 24 * 3600
    tolti: list[str] = []
    if not STORE.is_dir():
        return tolti
    now = time.time()
    for f in sorted(STORE.glob("*.json")):
        try:
            if now - f.stat().st_mtime > soglia_s:
                tolti.append(f.stem)
                if esegui:
                    f.unlink()
        except OSError:
            pass
    return tolti


def storico() -> list[dict]:
    """Le sessioni in ordine cronologico, con modalita' e durata.

    E' la ricostruzione che il 2026-08-04 e' stata fatta a mano leggendo i file uno per
    uno; qui la fa la macchina. `durata` esiste solo da quando il marcatore porta
    `last_seen`: per i marcatori piu' vecchi resta `None`, e si dice, invece di
    inventare uno zero che sembrerebbe una sessione istantanea.
    """
    fuori: list[dict] = []
    if not STORE.is_dir():
        return fuori
    for f in STORE.glob("*.json"):
        if f.name == "payload-shapes.json":
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            fuori.append({"session_id": f.stem, "mode": "?", "set_at": None,
                          "last_seen": None, "durata_min": None, "implicita": None,
                          "nota": "marcatore illeggibile"})
            continue
        if not isinstance(d, dict):
            continue
        inizio, fine = d.get("set_at"), d.get("last_seen")
        durata = None
        if inizio and fine:
            try:
                a = time.mktime(time.strptime(inizio[:19], "%Y-%m-%dT%H:%M:%S"))
                b = time.mktime(time.strptime(fine[:19], "%Y-%m-%dT%H:%M:%S"))
                durata = round((b - a) / 60.0, 1)
            except ValueError:
                durata = None
        fuori.append({
            "session_id": d.get("session_id") or f.stem,
            "mode": d.get("mode") or "?",
            "set_at": inizio,
            "last_seen": fine,
            "durata_min": durata,
            "implicita": d.get("implicita"),
        })
    fuori.sort(key=lambda r: (r["set_at"] or ""))
    return fuori


# --- payload degli hook ---------------------------------------------------


def payload() -> dict:
    try:
        raw = sys.stdin.read()
    except (OSError, ValueError):
        return {}
    if not raw.strip():
        return {}
    try:
        d = json.loads(raw)
        return d if isinstance(d, dict) else {}
    except ValueError:
        return {}


def record_shape(event: str, data: dict) -> None:
    """Annota le CHIAVI ricevute (mai i valori). Serve a verificare la forma
    reale del payload invece di assumerla."""
    try:
        STORE.mkdir(parents=True, exist_ok=True)
        shapes = STORE / "payload-shapes.json"
        try:
            cur = json.loads(shapes.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            cur = {}
        entry = {"keys": sorted(data.keys()), "seen_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
        ti = data.get("tool_input")
        if isinstance(ti, dict):
            entry["tool_input_keys"] = sorted(ti.keys())
        cur[event] = entry
        shapes.write_text(json.dumps(cur, indent=2), encoding="utf-8")
    except OSError:
        pass


# --- riconoscimento dei comandi di avvio ---------------------------------

# Il gruppo e' UNO SOLO — `lab` — e la parentesi resta opzionale: «avvia sessione»
# nudo vale `canonical`. Qualunque altra parola dopo «sessione» non fa match, quindi
# torna None e il chiamante applica `canonical`. E' il fail-safe voluto: una parola
# sbagliata, o un comando ritirato, degradano alla modalita' meno permissiva invece
# di aprire un varco o di far fallire l'avvio.
_CMD_RE = re.compile(r"^\s*avvia\s+sessione(?:\s+(lab))?\s*[.!:]?\s*$", re.IGNORECASE)


def parse_start_command(prompt: str):
    """-> 'lab' | 'canonical' | None. Riconosce il comando anche come prima riga di
    un messaggio piu' lungo."""
    if not prompt:
        return None
    first = prompt.strip().splitlines()[0] if prompt.strip() else ""
    for candidate in (prompt, first):
        m = _CMD_RE.match(candidate)
        if m:
            return LAB if m.group(1) else CANONICAL
    return None


CANONICAL_BRIEF = """\
[modalita' sessione: CANONICA — sviluppo]

Questa sessione e' marcata `canonical`: valgono tutte le regole abituali del
progetto (CLAUDE.md), cancello di verifica compreso.

Adesso, in un solo giro:
  python docs/kb/tools/session_start.py
Poi presenta il menu delle azioni e chiedi: "Scegli #, aggrega (es. 1+4), o nuovo."
Non iniziare a lavorare prima della scelta.

IL GUARDIANO — due misure, una regola (Enzo, 2026-08-13 — vale sempre):
  python docs/kb/tools/guardiano.py                # contesto + finestra 5h + verdetto
  python docs/kb/tools/guardiano.py --sorveglia    # exit 3 = si chiude
  python docs/kb/tools/guardiano.py --budget N     # "ci sta un lavoro da N?" exit 2 = no
REGOLA: se contesto >= 75% OPPURE finestra 5h >= 80%, allora interrompi le
attivita', registra il progresso, committa E PUSHA tutto, e fai la chiusura
completa della sessione. Non «valuta»: interrompi.
I due numeri sono misurati — i token che l'API ha riportato nel transcript, e la
percentuale che Claude Code passa alla riga di stato. Il boot li stampa in cima
alla dashboard. Nessuna frase sul contesto o sui limiti senza il numero accanto;
cio' che non si puo' misurare si dichiara NON MISURABILE, mai stimato.
"""

LAB_BRIEF = """\
[modalita' sessione: LAB — analisi, sola lettura sul prodotto]

Vincoli attivi, imposti anche da una guardia automatica:
  · LETTURA SENZA LIMITI su qualunque oggetto del progetto — codice, route,
    endpoint, contratti, frontend, configurazioni, CI, migrazioni, schema e dati
    live, DB legacy, artefatti generati, .env, storia git, documentazione.
    Una lettura bloccata e' un difetto della guardia, da segnalare.
  · SCRITTURA solo in <padre del repo>/heuresys-design-lab/ e nella memoria di
    progetto. Mai nel repo.
  · Niente git che modifica, niente test/typecheck/lint/build, niente scritture
    sul DB, niente migrazioni, deploy, restart, ne' riscrittura della SoT.
  · Navigazione autenticata AUTORIZZATA (Chrome primo, Playwright secondo):
    si naviga, non si muta. Artefatti Playwright fuori dal repo. Mai
    `pnpm test:e2e*` (fa `next build` e sporca il repo).
  · I valori dei segreti non si trascrivono mai in un artefatto o in un messaggio.

IL GUARDIANO — due misure, una regola (Enzo, 2026-08-13 — vale anche qui):
  python docs/kb/tools/guardiano.py                # contesto + finestra 5h + verdetto
  python docs/kb/tools/guardiano.py --sorveglia    # exit 3 = si chiude
REGOLA: se contesto >= 75% OPPURE finestra 5h >= 80%, allora interrompi, registra,
committa E PUSHA, e chiudi la sessione. E' lettura, quindi la guardia lo lascia
passare (verificato). Nessuna frase sui limiti senza il numero accanto; cio' che
non si puo' misurare si dichiara NON MISURABILE, mai stimato.

Contratto completo: <padre del repo>/heuresys-design-lab/README.md
Apri leggendo quel README e lo STATO.md accanto, poi chiedi da dove partire.
Non presentare il menu delle azioni di sviluppo: non e' una sessione di sviluppo.
"""


# --- la guardia: decisione pura, testabile -------------------------------

GIT_WRITE_SUBS = {
    "add", "commit", "push", "pull", "checkout", "switch", "restore", "stash",
    "reset", "merge", "rebase", "cherry-pick", "revert", "clean", "rm", "mv",
    "apply", "am", "update-index", "update-ref", "filter-branch", "worktree",
    "submodule", "init", "gc", "prune", "fsck", "repack",
}
GIT_GLOBAL_WITH_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}
GIT_DESTRUCTIVE_FLAGS = {"-d", "-D", "-m", "-M", "--delete", "--move", "--force", "-f"}

PNPM_DENY_SCRIPTS = re.compile(
    r"^(test|test:.*|typecheck|typecheck:.*|lint|lint:.*|build|dev|start|db:.*|e2e.*)$"
)

SQL_WRITE_RE = re.compile(
    r"\b(insert|update|delete|drop|create|alter|truncate|grant|revoke|"
    r"vacuum|reindex|cluster|copy|refresh\s+materialized|call|do)\b",
    re.IGNORECASE,
)

# #134 — I VERBI SI CERCANO NEL CODICE, NON DENTRO LE STRINGHE.
# Caso minimo che falliva: `psql -c "select 'tenant:create' as prova"` veniva rifiutato
# come scrittura perche' la parola `create` sta DENTRO gli apici. Conseguenza pratica: in
# lab non si poteva interrogare il permesso `tenant:create`, ne' nessun `*:create`,
# `*:update`, `*:delete` — cioe' buona parte del modello RBAC diventava non ispezionabile
# proprio nella modalita' nata per ispezionare.
# Rimedio: si tolgono letterali e commenti PRIMA di cercare i verbi. Sostituiti con uno
# spazio e non con nulla, cosi' `select'create'from` non puo' saldarsi in una parola nuova.
SQL_LETTERALI_RE = re.compile(
    r"--[^\n]*"                 # commento di riga
    r"|/\*.*?\*/"               # commento a blocco
    r"|\$\w*\$.*?\$\w*\$"       # dollar-quoting ($$ ... $$, $tag$ ... $tag$)
    r"|'(?:[^']|'')*'"          # letterale fra apici singoli, '' incluso
    r'|"(?:[^"]|"")*"',         # identificatore fra virgolette doppie
    re.DOTALL,
)


def _sql_senza_letterali(sql: str) -> str:
    """Il testo SQL con letterali e commenti sostituiti da spazi.

    NON e' un parser: e' una potatura deliberatamente grossolana, e sbaglia dalla parte
    giusta. Un corpo `DO $$ ... create table ... $$` viene svuotato, ma `DO` resta fuori
    dagli apici ed e' gia' nell'elenco dei verbi che scrivono: la scrittura viene vista
    lo stesso.
    """
    return SQL_LETTERALI_RE.sub(" ", sql)


# #134 (secondo caso) — SI DECIDE SUL VERBO, NON SUL PERCORSO.
# `ls db/scripts/` veniva rifiutato come «script che scrivono»: la regola guardava se il
# percorso COMPARIVA nel comando, non se veniva ESEGUITO. Elencare o leggere uno script e'
# esattamente cio' che una sessione di analisi deve poter fare — ed e' la stessa dottrina
# gia' scritta nel commento di DEPLOY_RE: si vietano i verbi che mutano, non i comandi interi.
SCRIPT_MUTANTI_RE = re.compile(r"(db/scripts/|storia36\.sh)", re.IGNORECASE)
INTERPRETI = {"bash", "sh", "zsh", "ksh", "dash", "python", "python3", "py",
              "pwsh", "powershell", "source", "."}


def _esegue_script_mutante(toks: list[str]) -> bool:
    """Vero solo se uno script mutante viene ESEGUITO, non semplicemente nominato."""
    if not toks:
        return False
    if SCRIPT_MUTANTI_RE.search(toks[0]):
        return True                                   # ./db/scripts/x.sh — e' il comando
    primo = os.path.basename(toks[0].replace("\\", "/")).lower()
    if primo in INTERPRETI:
        return any(SCRIPT_MUTANTI_RE.search(t) for t in toks[1:])
    return False

# Attenzione: qui il rischio e' la guardia TROPPO LARGA. `systemctl is-active` e
# `docker ps` sono letture legittime e devono passare: si vietano i verbi che
# mutano, non i comandi interi.
DEPLOY_RE = re.compile(
    r"(vm-deploy|align-clones|close-propagate|align-claude-ecosystem|"
    r"systemctl\s+(--\S+\s+)*(start|stop|restart|reload|enable|disable|mask|unmask|"
    r"daemon-reload|set-property|kill)\b|"
    r"service\s+\w+\s+(start|stop|restart|reload)\b|"
    r"pm2\s+(start|stop|restart|reload|delete)\b|"
    r"docker\s+(run|exec|rm|rmi|stop|start|restart|build|compose|kill|prune|cp)\b)",
    re.IGNORECASE,
)
# `db/scripts/` e `storia36.sh` NON stanno piu' qui (#134): erano gli unici due termini
# che parlavano di un PERCORSO invece che di un verbo, e per questo `ls db/scripts/`
# veniva rifiutato. Ora li governa _esegue_script_mutante(), che guarda se lo script
# viene eseguito. La stessa dottrina del commento qui sopra, applicata anche a loro.

PS_WRITE_CMDLETS = re.compile(
    r"\b(Set-Content|Out-File|Add-Content|New-Item|Remove-Item|Move-Item|"
    r"Copy-Item|Rename-Item|Clear-Content|Set-ItemProperty)\b",
    re.IGNORECASE,
)

DENIED_SKILLS = {"handoff", "zero-pending-loop", "full-alignment-deploy"}

SEGMENT_SPLIT = re.compile(r"\|\||&&|[;\n|]")

# --- #121: il parser guardava il TESTO, non la struttura -------------------------------
#
# La guardia spezzava il comando con una regex sulla stringa grezza e cercava le
# redirezioni allo stesso modo. Cinque rifiuti ingiusti su sei nascevano da li':
#
#   psql -At -F'|' -c "SELECT ..."          il `|` DENTRO gli apici spezzava il comando
#   WHERE compensation_band_max_eur > 120000  un confronto letto come redirezione
#   ON o2.id > o1.id                          idem, dentro una condizione di join
#   una stringa SQL contenente ` -> `          idem
#   def analizza(...) -> dict:                 dentro un heredoc Python
#
# In nessuno dei sei ha lasciato passare una scrittura: falliva in CHIUSURA, non in
# apertura. Ma l'attrito spinge a riscrivere le query per aggirare il parser, ed e' cosi'
# che si introducono errori veri.
#
# Il rischio da presidiare e' il ROVESCIO: rendere il parser consapevole delle virgolette
# non deve renderlo piu' permissivo. La prova che conta non e' che i sei casi passino —
# e' che i casi VERI continuino a essere rifiutati.

_APERTURE_HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")


def _senza_heredoc(cmd: str) -> str:
    """Toglie il CORPO degli heredoc, lasciando l'intestazione.

    Il corpo di un heredoc non e' shell: e' SQL, Python, JSON. Analizzarlo come se lo
    fosse produce falsi positivi che non hanno niente a che vedere con la shell — il
    caso misurato e' `def analizza(...) -> dict:`, dove `>` veniva letto come una
    redirezione verso un file di nome `dict:`.

    L'intestazione resta, cosi' un `cat <<EOF > file/nel/repo` continua a essere visto.
    """
    fuori: list[str] = []
    righe = cmd.split("\n")
    i = 0
    while i < len(righe):
        r = righe[i]
        fuori.append(r)
        m = _APERTURE_HEREDOC.search(r)
        if m:
            marcatore = m.group(2)
            i += 1
            while i < len(righe) and righe[i].strip() != marcatore:
                i += 1
            # la riga del marcatore di chiusura si scarta insieme al corpo
        i += 1
    return "\n".join(fuori)


def _fuori_virgolette(s: str):
    """Genera (indice, carattere) per i soli caratteri NON dentro apici.

    Un solo passaggio, uno stato di due valori. Non e' un parser di shell completo e non
    pretende di esserlo: distingue «dentro una stringa» da «fuori», che e' esattamente
    la distinzione che mancava.
    """
    apice = ""
    i = 0
    while i < len(s):
        c = s[i]
        if apice:
            if c == "\\" and apice == '"':
                i += 2
                continue
            if c == apice:
                apice = ""
        elif c in "'\"":
            apice = c
        else:
            yield i, c
        i += 1


def _segmenti(cmd: str) -> list[str]:
    """Spezza il comando sui separatori di shell che stanno FUORI dalle virgolette.

    Stessi separatori di prima (`||`, `&&`, `;`, `|`, a-capo): cambia solo che un `|`
    dentro `-F'|'` non conta piu' come separatore.
    """
    tagli: list[int] = []
    salta = -1
    testo = cmd
    for i, c in _fuori_virgolette(testo):
        if i <= salta:
            continue
        if c in ";\n|&":
            doppio = testo[i:i + 2] in ("||", "&&")
            if c == "&" and not doppio:
                continue                       # `&` singolo: non e' un separatore qui
            tagli.append(i)
            salta = i + 1 if doppio else i
    pezzi, inizio = [], 0
    for t in tagli:
        pezzi.append(testo[inizio:t])
        inizio = t + (2 if testo[t:t + 2] in ("||", "&&") else 1)
    pezzi.append(testo[inizio:])
    return pezzi


def _redirezioni(seg: str) -> list[str]:
    """I bersagli delle redirezioni presenti FUORI dalle virgolette, piu' quelli di `tee`.

    `2>&1` e `>&2` non sono scritture su file e non entrano.
    """
    fuori = list(_fuori_virgolette(seg))
    posizioni = {i for i, _ in fuori}
    bersagli: list[str] = []
    i = 0
    while i < len(seg):
        if i not in posizioni or seg[i] != ">":
            i += 1
            continue
        j = i + 1
        if j < len(seg) and seg[j] == ">":
            j += 1
        if j < len(seg) and seg[j] == "&":       # 2>&1, >&2: duplicazione, non un file
            i = j + 1
            continue
        while j < len(seg) and seg[j] in " \t":
            j += 1
        k = j
        while k < len(seg) and seg[k] not in " \t\n;|&":
            k += 1
        if k > j:
            bersagli.append(seg[j:k].strip("\"'"))
        i = k if k > j else j + 1
    for m in re.finditer(r"\btee\b(?:\s+-a)?\s+(\"[^\"]+\"|'[^']+'|[^\s;|&]+)", seg):
        bersagli.append(m.group(1).strip("\"'"))
    return bersagli


def _cartella_di_lavoro(cmd: str) -> str | None:
    """La cartella impostata da un `cd` in testa al comando, se c'e'.

    Sesto caso misurato: `cd <cartella-lab>/artefatti && comm ... > pagine-orfane.txt`
    risultava una scrittura nel repo, perche' un bersaglio relativo veniva risolto
    SEMPRE contro la radice del repo. Scriveva invece dove e' permesso.
    """
    for seg in _segmenti(cmd):
        s = seg.strip()
        if not s:
            continue
        # Il bersaglio si legge dal TESTO GREZZO, non da `_tokens`. `shlex` in modo
        # POSIX tratta la barra rovesciata come carattere di fuga, quindi
        # `D:\heuresys-design-lab` tornava `D:heuresys-design-lab` — che su Windows
        # NON e' piu' un percorso assoluto, e il bersaglio finiva risolto contro il
        # repo. Il caso (f) e' caduto proprio qui, e l'ha detto la prova.
        m = re.match(r"cd\s+(\"[^\"]+\"|'[^']+'|\S+)\s*$", s)
        if m:
            return m.group(1).strip("\"'")
        return None                              # il `cd` conta solo se e' il primo
    return None


def _tokens(segment: str) -> list[str]:
    try:
        return shlex.split(segment, posix=True)
    except ValueError:
        return segment.split()


def _git_subcommand(toks: list[str]):
    i = toks.index("git") + 1
    while i < len(toks):
        t = toks[i]
        if t in GIT_GLOBAL_WITH_ARG:
            i += 2
            continue
        if t.startswith("-"):
            i += 1
            continue
        return t, toks[i + 1:]
    return None, []


def _looks_like_path(tok: str) -> bool:
    return bool(tok) and not tok.startswith("-")


def _check_command(cmd: str):
    """-> None se permesso, altrimenti la motivazione del rifiuto."""
    if not cmd or not cmd.strip():
        return None

    # #121: si analizza il comando SENZA i corpi degli heredoc (che non sono shell) e
    # si spezza sui separatori che stanno FUORI dalle virgolette.
    cmd_analizzabile = _senza_heredoc(cmd)
    cwd_dichiarata = _cartella_di_lavoro(cmd_analizzabile)

    for segment in _segmenti(cmd_analizzabile):
        seg = segment.strip()
        if not seg:
            continue
        toks = _tokens(seg)
        if not toks:
            continue
        low = seg.lower()

        # --- git che modifica
        if "git" in toks:
            sub, rest = _git_subcommand(toks)
            if sub in GIT_WRITE_SUBS:
                return (f"modalita' lab: `git {sub}` modifica il repository. "
                        "Le sessioni lab non scrivono nel repo ne' nella storia git.")
            if sub in {"branch", "tag", "remote", "config", "notes"}:
                if any(f in rest for f in GIT_DESTRUCTIVE_FLAGS):
                    return (f"modalita' lab: `git {sub}` con un flag distruttivo. "
                            "Consentite solo le forme di lettura.")

        # --- script di pacchetto
        if toks[0] in {"pnpm", "npm", "yarn"}:
            args = [t for t in toks[1:] if not t.startswith("-")]
            if args and args[0] == "run":
                args = args[1:]
            if args:
                head = args[0]
                if head == "exec":
                    tool = args[1] if len(args) > 1 else ""
                    if tool in {"vitest", "tsc", "eslint", "next", "jest"}:
                        return (f"modalita' lab: `{toks[0]} exec {tool}` esegue la toolchain "
                                "del repo e scrive artefatti. Vietato.")
                    if tool == "playwright":
                        return _check_playwright(seg)
                elif PNPM_DENY_SCRIPTS.match(head):
                    return (f"modalita' lab: `{toks[0]} {head}` esegue test/build/servizi "
                            "e scrive nel repo. Vietato. (Letture come `pnpm status` restano ok.)")
                elif head in {"install", "add", "remove", "update", "link", "publish"}:
                    return (f"modalita' lab: `{toks[0]} {head}` modifica le dipendenze. Vietato.")

        # --- playwright invocato per altre vie
        if "playwright" in low and re.search(r"\bplaywright\b", low):
            r = _check_playwright(seg)
            if r:
                return r

        # --- runner diretti
        if toks[0] in {"vitest", "jest", "tsc", "eslint", "next"}:
            return (f"modalita' lab: `{toks[0]}` esegue la toolchain del repo. Vietato.")

        # --- cancello di verifica
        if "verify_gate.py" in low and re.search(r"verify_gate\.py\s+run", low):
            return ("modalita' lab: `verify_gate.py run` eseguirebbe le suite del repo. "
                    "Vietato (e inutile: in lab il cancello non si applica).")

        # --- database
        if any(t == "psql" or t.endswith("/psql") or t.endswith("psql.exe") for t in toks):
            r = _check_psql(seg, toks)
            if r:
                return r

        # --- deploy, servizi, script mutanti
        if DEPLOY_RE.search(seg) or _esegue_script_mutante(toks):
            return ("modalita' lab: il comando avvia deploy, allineamento cloni, "
                    "servizi o script che scrivono. Vietato.")

        # --- filesystem verso il repo
        r = _check_fs(toks, seg)
        if r:
            return r

        # --- redirezioni dentro il repo
        r = _check_redirect(seg, cwd_dichiarata)
        if r:
            return r

    return None


def _check_playwright(seg: str):
    if not re.search(r"\bplaywright\b", seg, re.IGNORECASE):
        return None
    if not re.search(r"\b(test|codegen|show-report)\b", seg, re.IGNORECASE):
        return None
    if "test:e2e" in seg:
        return ("modalita' lab: gli script `test:e2e*` eseguono `next build` prima di "
                "Playwright e scrivono .next/ nel repo. Usa un'invocazione ad hoc con "
                "configurazione nella cartella lab.")
    if norm(LAB_DIR) in norm_all(seg) or str(LAB_DIR).replace("\\", "/").lower() in seg.replace("\\", "/").lower():
        return None
    return ("modalita' lab: Playwright deve puntare a una configurazione e a un output "
            f"dentro {LAB_DIR} — per default scriverebbe screenshot e tracce in "
            "apps/web/test-results/, cioe' dentro il repo.")


def norm_all(s: str) -> str:
    return os.path.normcase(s.replace("\\", "/"))


# #121 (quarto caso) — LE OPZIONI BREVI SI RAGGRUPPANO.
# `psql -Atc "SELECT 1"` e `psql -A -t -c "SELECT 1"` sono lo stesso comando, ma il
# confronto per token esatto vedeva solo `-Atc`, non trovava `-c`, e chiudeva dicendo
# «senza -c non e' ispezionabile». Rifiuto ingiusto — non un buco: il ramo che scattava
# era quello che CHIUDE, quindi nessun SQL e' mai sfuggito all'ispezione. Stessa famiglia
# degli altri casi di #121: si legge il testo invece del significato.
#
# Le opzioni di psql che VOGLIONO un valore. Chi non e' qui dentro non ne prende
# (`-A`, `-t`, `-x`, `-q`, `-e`, `-1`, ...), quindi il grappolo prosegue.
PSQL_OPZIONI_CON_VALORE = set("cdfFhLoPpRTUv")


def _psql_grappolo(tok: str):
    """Scioglie un'opzione breve raggruppata di psql.

    -> (lettere, valore_attaccato_o_None) per `-Atc`, `-cSELECT 1`, `-f`;
       None se il token non e' un grappolo di opzioni brevi (`--command=`, un percorso,
       l'SQL stesso).
    Regola POSIX, la stessa di psql: si scorrono le lettere e la PRIMA che vuole un
    valore se lo prende — attaccato se nel token c'e' dell'altro, altrimenti dal token
    successivo. Percio' in `-Atc` il valore va a `c`, e in `-cAt` andrebbe a `c`.
    """
    if len(tok) < 2 or not tok.startswith("-") or tok.startswith("--"):
        return None
    corpo = tok[1:]
    for i, ch in enumerate(corpo):
        if ch in PSQL_OPZIONI_CON_VALORE:
            return corpo[: i + 1], (corpo[i + 1:] or None)
    return corpo, None


def _check_psql(seg: str, toks: list[str]):
    if "<" in seg:
        return "modalita' lab: psql con redirezione da file — SQL non ispezionabile. Vietato."
    if "-f" in toks or "--file" in toks:
        return "modalita' lab: psql -f esegue uno script non ispezionabile. Vietato."
    sql_parts = []
    for i, t in enumerate(toks):
        if t in {"-c", "--command"} and i + 1 < len(toks):
            sql_parts.append(toks[i + 1])
        elif t.startswith("--command="):
            sql_parts.append(t.split("=", 1)[1])
        else:
            g = _psql_grappolo(t)
            if not g or t in {"-c", "--command"}:
                continue
            lettere, attaccato = g
            ultima = lettere[-1]
            if ultima == "f":
                # `-Atf script.sql`: prima cadeva nel messaggio generico. Vietato lo
                # stesso, ma detto per quello che e'.
                return "modalita' lab: psql -f esegue uno script non ispezionabile. Vietato."
            if ultima == "c":
                if attaccato is not None:
                    sql_parts.append(attaccato)
                elif i + 1 < len(toks):
                    sql_parts.append(toks[i + 1])
    if not sql_parts:
        return ("modalita' lab: psql senza -c non e' ispezionabile. "
                "Usa `psql ... -c \"SELECT ...\"`.")
    for sql in sql_parts:
        if SQL_WRITE_RE.search(_sql_senza_letterali(sql)):
            return ("modalita' lab: la query scrive o modifica lo schema. "
                    "In lab il database e' in sola lettura: solo SELECT.")
    return None


FS_MUTATORS = {"rm", "rmdir", "mv", "cp", "mkdir", "touch", "chmod", "chown",
               "ln", "truncate", "sed", "dd", "robocopy", "rsync"}


def _check_fs(toks: list[str], seg: str):
    head = os.path.basename(toks[0]) if toks else ""
    if head not in FS_MUTATORS:
        return None
    if head == "sed" and not re.search(r"-i\b", seg):
        return None
    for t in toks[1:]:
        if not _looks_like_path(t):
            continue
        cand = t if os.path.isabs(t) else str(REPO / t)
        if is_inside(cand, REPO) and not any(is_inside(cand, r) for r in write_roots()):
            return (f"modalita' lab: `{head}` con un percorso dentro il repo ({t}). "
                    "Le sessioni lab non modificano il working tree.")
    return None


REDIRECT_RE = re.compile(r"(?:>>?|\btee\b(?:\s+-a)?)\s+(\"[^\"]+\"|'[^']+'|[^\s;|&]+)")


def _check_redirect(seg: str, cwd: str | None = None):
    """#121: i bersagli si cercano FUORI dalle virgolette, e un `cd` in testa conta.

    `cwd` e' la cartella impostata da un `cd` all'inizio del comando. Senza, un
    bersaglio relativo veniva risolto SEMPRE contro la radice del repo — quindi
    `cd <lab>/artefatti && ... > nota.txt` risultava una scrittura nel repo mentre
    scriveva dove e' permesso. Con `cd` fuori dal repo il bersaglio relativo non e'
    piu' nel repo, e non c'e' niente da vietare.
    """
    base = REPO
    if cwd:
        p = Path(cwd) if os.path.isabs(cwd) else (REPO / cwd)
        base = p
    for target in _redirezioni(seg):
        if not target or target.startswith("/dev/") or target in {"nul", "NUL", "$null"}:
            continue
        cand = target if os.path.isabs(target) else str(base / target)
        if is_inside(cand, REPO) and not any(is_inside(cand, r) for r in write_roots()):
            return (f"modalita' lab: redirezione verso {target}, dentro il repo. "
                    f"Scrivi in {LAB_DIR}.")
    return None


def decide(tool_name: str, tool_input: dict, mode: str = LAB):
    """Decisione della guardia.
    -> (True, "") se permesso, (False, motivo) se vietato.

    Impostazione: LISTA DI DIVIETI. Tutto cio' che non e' esplicitamente
    vietato passa, perche' il perimetro di lettura e' totale."""
    tool_input = tool_input or {}

    if tool_name in {"Write", "Edit", "NotebookEdit", "MultiEdit"}:
        fp = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        if not fp:
            return True, ""
        if any(is_inside(fp, r) for r in write_roots()):
            return True, ""
        return False, (
            f"modalita' lab: scrittura consentita solo in {LAB_DIR} (e nella memoria di "
            f"progetto). Percorso richiesto: {fp}"
        )

    if tool_name in {"Bash", "PowerShell"}:
        cmd = tool_input.get("command") or ""
        if tool_name == "PowerShell":
            m = PS_WRITE_CMDLETS.search(cmd)
            if m and not any(str(r).replace("\\", "/").lower() in cmd.replace("\\", "/").lower()
                             for r in write_roots()):
                return False, (
                    f"modalita' lab: `{m.group(1)}` scrive sul filesystem. "
                    f"Consentito solo verso {LAB_DIR}.")
        reason = _check_command(cmd)
        if reason:
            return False, reason
        return True, ""

    if tool_name == "Skill":
        skill = (tool_input.get("skill") or "").strip().lower()
        if skill in DENIED_SKILLS:
            return False, (
                f"modalita' lab: la skill `{skill}` scrive nel repo o riscrive la SoT. "
                "Non appartiene a una sessione di analisi.")
        return True, ""

    # Read, Grep, Glob, WebFetch, WebSearch, MCP Chrome, tutto il resto: passa.
    return True, ""


# --- sottocomandi ---------------------------------------------------------


def cmd_prompt_hook() -> int:
    """#128: nessuna sessione invisibile, nessuna cancellazione automatica.

    Tre cose cambiano rispetto a prima, e tutte e tre nascono da una decisione di Enzo
    (2026-08-04): «preferisco avere una storia completa ed eventualmente decidere io
    quando non mi serve piu'».

    1. UNA SESSIONE SENZA COMANDO ESISTE LO STESSO. Prima, se il primo messaggio non
       era «avvia sessione», questa funzione usciva senza scrivere niente: quella
       sessione non esisteva per il registro, pur comportandosi da canonica. Non e'
       teorico — spiega l'anomalia che la cronistoria del 2026-08-04 aveva dovuto
       lasciare irrisolta: due documenti scritti in orari coperti da marcatori
       canonici non erano «una canonica che scrive nel lab», erano una sessione senza
       marcatore.
       Il marcatore implicito e' SEMPRE `canonical`, mai `lab`: e' il fail-safe
       dichiarato, e scrivere un marcatore in assenza di comando non deve poter
       aprire la modalita' permissiva. E si scrive solo se non ce n'e' gia' uno, cosi'
       il primo messaggio resta quello che decide.
    2. IL SEGNO DI VITA. Il marcatore portava solo `set_at`, e la data di modifica non
       veniva mai rinfrescata: una sessione piu' lunga della soglia si vedeva
       cancellare il marcatore MENTRE ERA IN CORSO, ricadendo in canonica in silenzio.
    3. NIENTE `gc()` QUI. La potatura non e' piu' un effetto collaterale dell'aprire
       una sessione: si chiede a mano con `hook.sh gc`. Un marcatore pesa 161 byte —
       dieci sessioni al giorno per cinque anni fanno ~3 MB. La cancellazione
       automatica non difendeva niente che valesse la perdita della storia.
    """
    data = payload()
    record_shape("UserPromptSubmit", data)
    sid = data.get("session_id") or ""
    mode = parse_start_command(data.get("prompt") or "")

    if mode is None:
        # Nessun comando riconosciuto: la sessione esiste comunque, ed e' canonica.
        if sid:
            if not marker(sid).exists():
                set_mode(sid, CANONICAL, implicita=True)
            else:
                tocca(sid)
        return 0

    set_mode(sid, mode)
    sys.stdout.write(LAB_BRIEF if mode == LAB else CANONICAL_BRIEF)
    return 0


def cmd_stop_gate() -> int:
    data = payload()
    record_shape(data.get("hook_event_name") or "Stop", data)
    sid = data.get("session_id") or ""
    if not cancello_di_verifica_si_applica(get_mode(sid)):
        return 0                      # nessun output = nessun blocco
    gate = REPO / "docs" / "kb" / "tools" / "verify_gate.py"
    if not gate.is_file():
        return 0
    try:
        # BYTE, non testo: `text=True` decodifica con locale.getpreferredencoding(),
        # che su Windows e' cp1252 — il verdetto del gate viaggia in UTF-8 e ogni
        # trattino lungo tornava come "â€”". Il wrapper deve restituire il verdetto
        # VERBATIM (e' cio' che il test di equivalenza in run-shell-tests.sh esige),
        # quindi non si decodifica affatto: si inoltrano i byte cosi' come sono.
        proc = subprocess.run(
            [sys.executable, str(gate), "check", "--hook"],
            cwd=str(REPO), capture_output=True, timeout=25,
        )
    except (OSError, subprocess.SubprocessError):
        return 0
    if proc.stdout:
        sys.stdout.buffer.write(proc.stdout)
        sys.stdout.buffer.flush()
    return 0


def cmd_lab_guard() -> int:
    data = payload()
    record_shape("PreToolUse", data)
    sid = data.get("session_id") or ""
    modalita = get_mode(sid)
    if not guardia_si_applica(modalita):
        return 0
    ok, reason = decide(data.get("tool_name") or "", data.get("tool_input") or {}, modalita)
    if ok:
        return 0
    sys.stderr.write(reason + "\n")
    return 2                          # 2 = blocca la chiamata, motivo a Claude


def cmd_mode(argv) -> int:
    sid = argv[0] if argv else os.environ.get("CLAUDE_SESSION_ID", "")
    if not sid:
        data = payload()
        sid = data.get("session_id") or ""
    print(get_mode(sid))
    return 0


# --- selftest -------------------------------------------------------------

def _cases():
    repo = str(REPO)
    lab = str(LAB_DIR)
    return [
        # (descrizione, tool, input, atteso_permesso)
        ("lettura sorgente API", "Read", {"file_path": f"{repo}/apps/api/src/server.ts"}, True),
        ("lettura route Next.js", "Read", {"file_path": f"{repo}/apps/web/src/app/layout.tsx"}, True),
        ("lettura schema Zod", "Read", {"file_path": f"{repo}/packages/shared/src/index.ts"}, True),
        ("lettura workflow CI", "Read", {"file_path": f"{repo}/.github/workflows/ci.yml"}, True),
        ("lettura migrazione", "Read", {"file_path": f"{repo}/db/migrations/000001_init.sql"}, True),
        ("lettura .env", "Read", {"file_path": f"{repo}/.env"}, True),
        ("grep nel repo", "Grep", {"pattern": "foo", "path": repo}, True),
        ("git log", "Bash", {"command": "git log --oneline -5"}, True),
        ("git status", "Bash", {"command": 'git -C "%s" status --short' % repo}, True),
        ("git diff", "Bash", {"command": "git diff HEAD -- apps/api"}, True),
        ("psql SELECT", "Bash", {"command": 'psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_users;"'}, True),
        # #134 — i verbi si cercano nel codice, non dentro le stringhe. Le due righe
        # vanno LETTE INSIEME: la prima da sola proverebbe solo che la guardia e' stata
        # aperta, la seconda che e' rimasta chiusa. Servono entrambe per dire «corretta».
        ("psql SELECT con 'create' dentro gli apici", "Bash", {"command": "psql -c \"select 'tenant:create' as prova\""}, True),
        ("psql SELECT con un permesso *:delete fra apici", "Bash", {"command": "psql -c \"SELECT * FROM sys.sys_permissions WHERE code = 'user:delete'\""}, True),
        ("psql con un commento che nomina drop", "Bash", {"command": 'psql -c "SELECT 1 -- drop table x"'}, True),
        ("psql CREATE TABLE vero", "Bash", {"command": 'psql -c "create table x (a int)"'}, False),
        ("psql DELETE vero", "Bash", {"command": 'psql -c "delete from sys.sys_users where 1=0"'}, False),
        ("psql DO con create dentro il corpo", "Bash", {"command": 'psql -c "DO $$ BEGIN create table x(a int); END $$"'}, False),
        # #186 — le opzioni brevi RAGGRUPPATE sono lo stesso comando di quelle sciolte.
        # I tre casi che contano stanno insieme di proposito: il primo prova che il
        # rifiuto ingiusto e' finito, gli altri due che sciogliere il grappolo non ha
        # aperto un varco. Uno solo dei tre, da solo, non direbbe niente.
        ("psql -Atc SELECT (opzioni raggruppate)", "Bash", {"command": 'psql -Atc "select 1"'}, True),
        ("psql -Atc UPDATE (raggruppate, ma scrive)", "Bash", {"command": 'psql -Atc "update sys.sys_users set x=1"'},
         False, "la query scrive o modifica lo schema"),
        # Il motivo e' la parte che conta: `-Atf` era vietato anche prima, ma per la
        # ragione sbagliata («senza -c non e' ispezionabile»). Senza il quinto elemento
        # questo caso resterebbe verde anche togliendo il ramo che lo riconosce.
        ("psql -Atf (raggruppate su uno script)", "Bash", {"command": "psql -Atf db/seed.sql"},
         False, "psql -f esegue uno script non ispezionabile"),
        ("psql -cCREATE attaccato al grappolo", "Bash", {"command": "psql -ccreate table x (a int)"},
         False, "la query scrive o modifica lo schema"),
        ("psql -At senza -c (niente da ispezionare)", "Bash", {"command": "psql -At"},
         False, "psql senza -c non e' ispezionabile"),
        # #121 — I SEI RIFIUTI INGIUSTI DEL 2026-08-04, come regressione permanente.
        # Sono letture pure: erano bloccate perche' il parser guardava il testo grezzo.
        # Stanno qui insieme di proposito — presi uno per uno non direbbero niente, e'
        # l'insieme che descrive la causa.
        ("#121 (a) separatore DENTRO gli apici", "Bash",
         {"command": "psql -At -F'|' -c \"SELECT count(*) FROM sys.sys_users\""}, True),
        ("#121 (b) confronto > in una WHERE", "Bash",
         {"command": "psql -c \"SELECT 1 WHERE compensation_band_max_eur > 120000\""}, True),
        ("#121 (c) confronto > in una condizione di join", "Bash",
         {"command": "psql -c \"SELECT 1 FROM a o1 JOIN b o2 ON o2.organization_unit_id > o1.organization_unit_id\""}, True),
        ("#121 (d) una freccia dentro una stringa SQL", "Bash",
         {"command": "psql -c \"SELECT 'da -> a' AS passaggio\""}, True),
        ("#121 (e) annotazione di tipo dentro un heredoc", "Bash",
         {"command": "python - <<'EOF'\ndef analizza(x) -> dict:\n    return {}\nEOF"}, True),
        ("#121 (f) cd nel lab, poi redirezione relativa", "Bash",
         {"command": f"cd {LAB_DIR}/artefatti && comm -13 a.txt b.txt > pagine-orfane.txt"}, True),
        # IL ROVESCIO, che e' la parte che conta: sapere delle virgolette non deve
        # rendere il parser piu' permissivo. Se uno solo di questi passasse, la
        # correzione avrebbe aperto un varco invece di chiudere un attrito.
        ("#121 rovescio: redirezione VERA nel repo", "Bash",
         {"command": "echo ciao > docs/nota.md"}, False, "redirezione verso"),
        ("#121 rovescio: redirezione vera dopo un cd NEL repo", "Bash",
         {"command": "cd docs && echo ciao > nota.md"}, False, "redirezione verso"),
        ("#121 rovescio: tee nel repo", "Bash",
         {"command": "cat x | tee docs/nota.md"}, False, "redirezione verso"),
        ("#121 rovescio: heredoc che redirige nel repo", "Bash",
         {"command": "cat <<'EOF' > docs/nota.md\ncontenuto\nEOF"}, False, "redirezione verso"),
        ("#121 rovescio: scrittura SQL dopo un separatore quotato", "Bash",
         {"command": "psql -At -F'|' -c \"UPDATE sys.sys_users SET x=1\""}, False,
         "la query scrive o modifica lo schema"),
        # #134 (secondo caso) — si decide sul verbo, non sul percorso.
        ("elenco di db/scripts", "Bash", {"command": "ls db/scripts/"}, True),
        ("lettura di uno script di db/scripts", "Bash", {"command": "cat db/scripts/migrate.sh"}, True),
        ("grep dentro db/scripts", "Bash", {"command": "grep -n POSTGRES db/scripts/migrate.sh"}, True),
        ("esecuzione di uno script di db/scripts", "Bash", {"command": "bash db/scripts/migrate.sh .env"}, False),
        ("esecuzione della custodia storia36", "Bash", {"command": "bash db/scripts/storia36.sh custodia"}, False),
        ("pnpm status (dashboard)", "Bash", {"command": "pnpm status"}, True),
        ("scrittura nella cartella lab", "Write", {"file_path": f"{lab}/nota.md"}, True),
        ("chrome MCP", "mcp__claude-in-chrome__navigate", {"url": "https://example.org"}, True),
        ("ssh lettura", "Bash", {"command": "ssh linux-pc 'systemctl is-active heuresys-api'"}, True),
        ("systemctl status", "Bash", {"command": "ssh oracle-vm-default 'systemctl status heuresys-web'"}, True),
        ("journalctl", "Bash", {"command": "ssh linux-pc 'journalctl -u heuresys-api -n 50'"}, True),
        ("docker ps", "Bash", {"command": "docker ps -a"}, True),
        ("gh run list", "Bash", {"command": "gh run list --limit 5"}, True),
        ("curl GET", "Bash", {"command": "curl -s https://www.example.org/api/readyz"}, True),
        ("cat di un file del repo", "Bash", {"command": "cat apps/api/package.json"}, True),
        ("sed senza -i", "Bash", {"command": "sed -n '1,20p' CLAUDE.md"}, True),

        ("scrittura nel repo", "Write", {"file_path": f"{repo}/apps/api/src/x.ts"}, False),
        ("modifica nel repo", "Edit", {"file_path": f"{repo}/CLAUDE.md"}, False),
        ("git add", "Bash", {"command": "git add -A"}, False),
        ("git commit", "Bash", {"command": 'git commit -m "x"'}, False),
        ("git push", "Bash", {"command": "git push origin main"}, False),
        ("git checkout", "Bash", {"command": "git checkout -- ."}, False),
        ("git reset", "Bash", {"command": "git reset --hard"}, False),
        ("git branch -d", "Bash", {"command": "git branch -d feature"}, False),
        ("pnpm test", "Bash", {"command": "pnpm test"}, False),
        ("pnpm typecheck", "Bash", {"command": "pnpm typecheck"}, False),
        ("pnpm build", "Bash", {"command": "pnpm build"}, False),
        ("pnpm db:reset", "Bash", {"command": "pnpm db:reset"}, False),
        ("pnpm test:e2e:prod", "Bash", {"command": "cd apps/web && pnpm test:e2e:prod"}, False),
        ("pnpm exec vitest", "Bash", {"command": "pnpm exec vitest run test/a.test.ts"}, False),
        ("playwright senza config lab", "Bash", {"command": "npx playwright test spec.ts"}, False),
        ("playwright con config lab", "Bash", {"command": 'npx playwright test --config="%s/pw.config.cjs"' % lab}, True),
        ("psql INSERT", "Bash", {"command": 'psql -c "INSERT INTO sys.sys_users (id) VALUES (1);"'}, False),
        ("psql UPDATE", "Bash", {"command": 'psql -c "UPDATE sys.sys_users SET x=1;"'}, False),
        ("psql -f", "Bash", {"command": "psql -f db/seed.sql"}, False),
        ("verify_gate run", "Bash", {"command": "python docs/kb/tools/verify_gate.py run"}, False),
        ("deploy VM", "Bash", {"command": "bash scripts/vm-deploy.sh"}, False),
        ("align cloni", "Bash", {"command": "bash scripts/align-clones.sh all"}, False),
        ("rm nel repo", "Bash", {"command": "rm -rf apps/web/.next"}, False),
        ("redirezione nel repo", "Bash", {"command": "echo ciao > docs/nota.md"}, False),
        ("redirezione nella cartella lab", "Bash", {"command": 'echo ciao > "%s/nota.md"' % lab}, True),
        ("systemctl restart", "Bash", {"command": "ssh linux-pc 'systemctl restart heuresys-api'"}, False),
        ("docker compose up", "Bash", {"command": "docker compose up -d"}, False),
        ("sed -i su file del repo", "Bash", {"command": "sed -i 's/a/b/' CLAUDE.md"}, False),
        ("pnpm install", "Bash", {"command": "pnpm install"}, False),
        ("skill handoff", "Skill", {"skill": "handoff"}, False),
        ("comando composto con git commit", "Bash", {"command": "git status && git commit -m x"}, False),
    ]


def cmd_selftest() -> int:
    ok = bad = 0
    failures = []
    # Un caso e' `(descrizione, tool, input, atteso)` — e facoltativamente un QUINTO
    # elemento: un pezzo di testo che il motivo deve contenere.
    #
    # Serve perche' il solo si'/no non discrimina sempre. `psql -Atf script.sql` e'
    # vietato sia sciogliendo il grappolo sia non sciogliendolo: cambia il MOTIVO
    # («esegue uno script non ispezionabile» invece del generico «senza -c»), non
    # l'esito. Un caso che resta verde comunque non e' una prova, e' un ornamento.
    for caso in _cases():
        desc, tool, inp, expected = caso[0], caso[1], caso[2], caso[3]
        motivo_atteso = caso[4] if len(caso) > 4 else None
        allowed, reason = decide(tool, inp)
        if allowed != expected:
            bad += 1
            failures.append((desc, expected, allowed, reason))
        elif motivo_atteso and motivo_atteso not in (reason or ""):
            bad += 1
            failures.append((f"{desc} [motivo]", motivo_atteso, reason or "(nessun motivo)", ""))
        else:
            ok += 1

    # Le due modalita' e cosa comportano. E' il punto in cui una di esse potrebbe
    # essere scambiata per piu' permissiva di quello che e': se qualcuno esentasse
    # `canonical` dal cancello, o togliesse la guardia a `lab`, qui diventa rosso.
    for mode, guardia, cancello in [
        (LAB, True, False),
        (CANONICAL, False, True),
    ]:
        for etichetta, atteso, ottenuto in [
            (f"guardia in {mode}", guardia, guardia_si_applica(mode)),
            (f"cancello di verifica in {mode}", cancello, cancello_di_verifica_si_applica(mode)),
        ]:
            if atteso == ottenuto:
                ok += 1
            else:
                bad += 1
                failures.append((etichetta, atteso, ottenuto, "predicato di modalita'"))

    # casi sul registro
    probe_sid = "__selftest__"
    checks = []
    try:
        set_mode(probe_sid, LAB)
        checks.append(("marcatore lab riletto", get_mode(probe_sid) == LAB))
        set_mode(probe_sid, CANONICAL)
        checks.append(("marcatore canonical riletto", get_mode(probe_sid) == CANONICAL))
        marker(probe_sid).write_text(
            json.dumps({"mode": "pippo", "session_id": probe_sid}), encoding="utf-8")
        checks.append(("modo ignoto -> canonical", get_mode(probe_sid) == CANONICAL))
        marker(probe_sid).write_text("{ non json", encoding="utf-8")
        checks.append(("marcatore corrotto -> canonical", get_mode(probe_sid) == CANONICAL))
        marker(probe_sid).unlink()
        checks.append(("marcatore assente -> canonical", get_mode(probe_sid) == CANONICAL))
        checks.append(("session_id vuoto -> canonical", get_mode("") == CANONICAL))

        # --- #128: nessuna sessione invisibile, nessuna cancellazione automatica ----
        #
        # I due casi che la voce dichiara come condizione di chiusura. Il secondo e'
        # quello che conta di piu': prova che aprire una sessione NON accorcia piu' la
        # storia. Prima girava `gc()` a ogni apertura, e un marcatore vecchio spariva
        # senza che nessuno lo chiedesse.
        senza_cmd = "__selftest_senza_comando__"
        try:
            marker(senza_cmd).unlink()
        except OSError:
            pass

        # SI CHIAMA IL GANCIO VERO, non una sua imitazione.
        #
        # La prima stesura di questi casi *simulava* cio' che fa `cmd_prompt_hook`
        # («se non esiste, scrivi canonical»). Provata coi sabotaggi, tre su cinque
        # NON venivano colti: stavo provando la mia simulazione, non il codice. Una
        # prova che non puo' fallire non e' una prova, e questa non poteva.
        def prompt(sid: str, testo: str) -> None:
            import io as _io
            globale = globals()
            vero_payload, vera_stdout = globale["payload"], sys.stdout
            globale["payload"] = lambda: {"session_id": sid, "prompt": testo}
            sys.stdout = _io.StringIO()          # il brief non deve sporcare l'esito
            try:
                cmd_prompt_hook()
            finally:
                globale["payload"] = vero_payload
                sys.stdout = vera_stdout

        prompt(senza_cmd, "ciao, guardiamo insieme una cosa")
        d = leggi_marcatore(senza_cmd)
        checks.append(("#128 sessione senza comando: il marcatore esiste", bool(d)))
        checks.append(("#128 sessione senza comando: e' canonical, MAI lab",
                       d.get("mode") == CANONICAL))
        checks.append(("#128 sessione senza comando: dichiarata implicita",
                       d.get("implicita") is True))
        checks.append(("#128 il marcatore porta un segno di vita",
                       bool(d.get("last_seen"))))
        # `tocca` aggiorna last_seen e NON tocca la modalita'
        set_mode(senza_cmd, LAB)
        prima = leggi_marcatore(senza_cmd).get("set_at")
        tocca(senza_cmd)
        dopo = leggi_marcatore(senza_cmd)
        checks.append(("#128 tocca() non cambia la modalita'", dopo.get("mode") == LAB))
        checks.append(("#128 tocca() non cambia l'inizio", dopo.get("set_at") == prima))

        # un secondo messaggio NON deve cambiare la modalita' decisa dal primo
        prompt(senza_cmd, "avvia sessione lab")          # arriva DOPO: oggi imposta lab
        checks.append(("#128 un comando successivo puo' ancora dichiarare la modalita'",
                       leggi_marcatore(senza_cmd).get("mode") == LAB))
        prompt(senza_cmd, "un messaggio qualunque")
        checks.append(("#128 un messaggio qualunque NON riporta a canonical",
                       leggi_marcatore(senza_cmd).get("mode") == LAB))

        # un marcatore vecchio di oltre la soglia SOPRAVVIVE all'apertura di una sessione
        vecchio = "__selftest_vecchio__"
        set_mode(vecchio, CANONICAL)
        antico = time.time() - (60 * 24 * 3600)
        os.utime(marker(vecchio), (antico, antico))
        prompt("__selftest_nuova__", "avvia sessione")    # apre una sessione VERA
        checks.append(("#128 un marcatore vecchio sopravvive all'apertura",
                       marker(vecchio).exists()))
        # ...e `gc --prova` lo VEDE senza cancellarlo, poi `gc` lo cancella davvero
        visti = gc(14, esegui=False)
        checks.append(("#128 gc in prova lo elenca", vecchio in visti))
        checks.append(("#128 gc in prova NON cancella", marker(vecchio).exists()))
        tolti = gc(14, esegui=True)
        checks.append(("#128 gc esplicito cancella", vecchio in tolti and not marker(vecchio).exists()))
        # lo storico non perde nessuna sessione viva
        ids = {r["session_id"] for r in storico()}
        checks.append(("#128 lo storico elenca le sessioni vive",
                       senza_cmd in ids and "__selftest_nuova__" in ids))
        for s in (senza_cmd, "__selftest_nuova__"):
            try:
                marker(s).unlink()
            except OSError:
                pass
    except OSError as exc:
        checks.append((f"registro non scrivibile: {exc}", False))
    for desc, res in checks:
        if res:
            ok += 1
        else:
            bad += 1
            failures.append((desc, True, False, "registro"))

    # riconoscimento dei comandi
    for text, expected in [
        ("avvia sessione", CANONICAL),
        ("  avvia sessione  ", CANONICAL),
        ("Avvia Sessione Lab", LAB),
        ("avvia sessione lab", LAB),
        ("avvia sessione lab\nvoglio analizzare il DB", LAB),
        ("avviamo la sessione", None),
        ("parliamo di avvia sessione lab domani", None),
        # Frontiere: una parola che COMINCIA per «lab» non e' il comando.
        ("avvia sessione laboratorio", None),
        # Una parola qualsiasi dopo «sessione» non fa match: torna None, e il
        # chiamante applica `canonical`. E' il fail-safe — mai un varco.
        ("avvia sessione qualsiasicosa", None),
    ]:
        got = parse_start_command(text)
        if got == expected:
            ok += 1
        else:
            bad += 1
            failures.append((f"parse {text!r}", expected, got, "parser"))

    for desc, exp, got, reason in failures:
        print(f"  FALLITO  {desc}: atteso={exp} ottenuto={got} :: {reason}")
    print(f"selftest: {ok} ok, {bad} falliti  (repo={REPO})")
    return 0 if bad == 0 else 1


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "prompt-hook":
        return cmd_prompt_hook()
    if cmd == "stop-gate":
        return cmd_stop_gate()
    if cmd == "lab-guard":
        return cmd_lab_guard()
    if cmd == "mode":
        return cmd_mode(rest)
    if cmd == "set":
        if len(rest) < 2:
            print(f"uso: set <session_id> <{'|'.join(MODI)}>", file=sys.stderr)
            return 1
        if rest[1] not in MODI:
            print(f"modalita' sconosciuta: {rest[1]} (ammesse: {', '.join(MODI)})",
                  file=sys.stderr)
            return 1
        set_mode(rest[0], rest[1])
        print(get_mode(rest[0]))
        return 0
    if cmd == "gc":
        # `hook.sh gc [giorni] [--prova]` — esplicito su cosa cancella, e con una
        # soglia che si passa invece di subirla cablata (#128).
        prova = "--prova" in rest
        arg = next((a for a in rest if a.isdigit()), None)
        giorni = int(arg) if arg else 14
        tolti = gc(giorni, esegui=not prova)
        verbo = "cancellerebbe" if prova else "rimossi"
        print(f"soglia {giorni} giorni — {len(tolti)} marcatori {verbo}")
        for t in tolti:
            print(f"  {t}")
        if not tolti:
            print("  (nessuno: la storia resta intera)")
        return 0
    if cmd == "storico":
        righe = storico()
        if not righe:
            print("nessuna sessione registrata")
            return 0
        print(f"{'inizio':<26} {'modalita':<10} {'durata':>8}  sessione")
        for r in righe:
            d = f"{r['durata_min']:.0f}m" if r["durata_min"] is not None else "  —"
            m = r["mode"] + ("*" if r.get("implicita") else "")
            print(f"{(r['set_at'] or '?'):<26} {m:<10} {d:>8}  {r['session_id']}")
        impl = sum(1 for r in righe if r.get("implicita"))
        print(f"\n{len(righe)} sessioni · {impl} senza comando esplicito (*) · "
              "nessuna cancellazione automatica")
        return 0
    if cmd == "selftest":
        return cmd_selftest()
    print(f"sottocomando sconosciuto: {cmd}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
