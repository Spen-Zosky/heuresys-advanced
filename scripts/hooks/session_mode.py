#!/usr/bin/env python3
"""session_mode.py — le modalita' di sessione di heuresys-advanced.

    avvia sessione        -> modalita' `canonical`  (sviluppo, comportamento storico)
    avvia sessione lab    -> modalita' `lab`        (analisi, sola lettura sul prodotto)
    avvia sessione gov    -> modalita' `gov`        (orchestrazione, #173)

Una quarta esiste ma NON si digita: `worker`, l'etichetta che il driver mette
addosso alle sessioni-lavoratore che apre, insieme al cluster assegnato. Se fosse
digitabile, una sessione umana potrebbe presentarsi come lavoratore di un cluster
che nessuno le ha dato.

`gov` e `worker` NON sono permessi: sono etichette. Solo `lab` allenta il cancello
di verifica, perche' e' l'unica che non scrive nel repo. `gov` ha una guardia
propria e piu' stretta di `canonical` su una cosa sola — non scrive codice di
prodotto (apps/, packages/, db/), perche' quello e' nelle mani dei lavoratori
mentre girano.

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
GOV = "gov"          # orchestratore di #173: assegna, verifica, lancia, consolida
WORKER = "worker"    # sessione-lavoratore aperta dal driver, non digitabile a mano
MODI = (CANONICAL, LAB, GOV, WORKER)
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


def set_mode(session_id: str, mode: str, cluster: str | None = None,
             lavoratore: int | None = None) -> None:
    STORE.mkdir(parents=True, exist_ok=True)
    payload_marcatore = {
        "mode": mode,
        "session_id": session_id,
        "repo": str(REPO),
        "set_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    # Solo per i lavoratori: senza questi due campi le plance vedono N sessioni
    # identiche e non sanno dire chi sta facendo cosa (gap segnalato da Cowork).
    if cluster:
        payload_marcatore["cluster"] = cluster
    if lavoratore is not None:
        payload_marcatore["lavoratore"] = lavoratore
    marker(session_id).write_text(
        json.dumps(payload_marcatore, indent=2), encoding="utf-8")


# --- che cosa comporta una modalita' -------------------------------------
#
# DUE PREDICATI, NON UNA CATENA DI `if` SPARSI. Sono la risposta a una domanda che
# le etichette nuove rendono facile sbagliare: `gov` e `worker` NON sono permessi.
# Solo `lab` e' esente dal cancello di verifica, perche' e' l'unica modalita' che
# non scrive nel repo. Tutte le altre ci passano, `gov` compresa.


def guardia_si_applica(mode: str) -> bool:
    """Vero se la guardia sulle chiamate va consultata in questa modalita'.

    `lab` e `gov` hanno perimetri DIVERSI e non vanno confusi: `lab` non scrive
    nel repo, `gov` non scrive **codice di prodotto**. Vedi `_decide_gov`."""
    return mode in (LAB, GOV)


def cancello_di_verifica_si_applica(mode: str) -> bool:
    """Vero se il cancello di verifica deve girare a fine turno."""
    return mode != LAB


def gc() -> int:
    removed = 0
    if not STORE.is_dir():
        return 0
    now = time.time()
    for f in STORE.glob("*.json"):
        try:
            if now - f.stat().st_mtime > MAX_MARKER_AGE_S:
                f.unlink()
                removed += 1
        except OSError:
            pass
    return removed


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

# `worker` non compare qui apposta: e' un'etichetta che il driver assegna ai figli
# che apre, non un comando che si digita. Se fosse digitabile, una sessione umana
# potrebbe presentarsi come lavoratore di un cluster che nessuno le ha assegnato.
_CMD_RE = re.compile(r"^\s*avvia\s+sessione(?:\s+(lab|gov))?\s*[.!:]?\s*$", re.IGNORECASE)


def parse_start_command(prompt: str):
    """-> 'lab' | 'gov' | 'canonical' | None. Riconosce il comando anche come
    prima riga di un messaggio piu' lungo."""
    if not prompt:
        return None
    first = prompt.strip().splitlines()[0] if prompt.strip() else ""
    for candidate in (prompt, first):
        m = _CMD_RE.match(candidate)
        if m:
            if not m.group(1):
                return CANONICAL
            return LAB if m.group(1).lower() == LAB else GOV
    return None


CANONICAL_BRIEF = """\
[modalita' sessione: CANONICA — sviluppo]

Questa sessione e' marcata `canonical`: valgono tutte le regole abituali del
progetto (CLAUDE.md), cancello di verifica compreso.

Adesso, in un solo giro:
  python docs/kb/tools/session_start.py
Poi presenta il menu delle azioni e chiedi: "Scegli #, aggrega (es. 1+4), o nuovo."
Non iniziare a lavorare prima della scelta.
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

Contratto completo: <padre del repo>/heuresys-design-lab/README.md
Apri leggendo quel README e lo STATO.md accanto, poi chiedi da dove partire.
Non presentare il menu delle azioni di sviluppo: non e' una sessione di sviluppo.
"""


GOV_BRIEF = """\
[modalita' sessione: GOV — orchestrazione del loop zero-pendenze]

Sei l'ORCHESTRATORE, non un lavoratore. Assegni, verifichi i perimetri, lanci,
consolidi. Il codice lo scrivono le sessioni-lavoratore che apri.

Vincoli attivi, imposti anche da una guardia automatica:
  · NON scrivi in apps/, packages/, db/ — e' codice di prodotto, ed e' nelle mani
    dei lavoratori mentre girano. Tutto il resto (stato .zp/, piani, config del
    loop, commit di consolidamento) e' tuo.
  · LETTURA senza limiti, come sempre.
  · Il cancello di verifica si applica: `gov` e' un'etichetta, non un permesso.
  · Il freno `meta.autorizzato_non_presidiato` NON si tocca da qui.

Adesso, in un solo giro:
  python docs/kb/tools/session_start.py
Poi presenta il menu e chiedi da dove partire. Il piano della modalita' e'
docs/superpowers/plans/2026-08-09-modalita-gov.md.
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

    for segment in SEGMENT_SPLIT.split(cmd):
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
        r = _check_redirect(seg)
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


def _check_redirect(seg: str):
    for m in REDIRECT_RE.finditer(seg):
        target = m.group(1).strip("\"'")
        if target.startswith("/dev/") or target in {"nul", "NUL", "$null"}:
            continue
        cand = target if os.path.isabs(target) else str(REPO / target)
        if is_inside(cand, REPO) and not any(is_inside(cand, r) for r in write_roots()):
            return (f"modalita' lab: redirezione verso {target}, dentro il repo. "
                    f"Scrivi in {LAB_DIR}.")
    return None


# In `gov` si vieta UNA cosa sola: scrivere codice di prodotto. E' la decisione 6
# di Enzo (#173) resa esecutiva invece che promessa — «gov assegna, verifica,
# lancia, consolida», altrimenti diventa un quarto scrittore mentre 2-3 lavoratori
# hanno le mani sugli stessi file.
#
# Divieto minimo, non lista di permessi: #121 ha misurato che una guardia larga
# rifiuta lavoro legittimo, e lo fa in silenzio. Qui l'orchestratore deve poter
# scrivere il suo stato, i piani, la config del loop, e committare il consolidamento.
GOV_VIETATI = ("apps/", "packages/", "db/")


def _decide_gov(tool_name: str, tool_input: dict):
    if tool_name not in {"Write", "Edit", "NotebookEdit", "MultiEdit"}:
        return True, ""
    fp = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not fp:
        return True, ""
    try:
        rel = os.path.relpath(norm(fp), norm(REPO)).replace("\\", "/")
    except ValueError:
        return True, ""                      # altro volume: fuori dal repo
    if rel.startswith(".."):
        return True, ""                      # fuori dal repo
    if rel.startswith(GOV_VIETATI):
        return False, (
            f"modalita' gov: `{rel}` e' codice di prodotto. L'orchestratore assegna, "
            "verifica, lancia e consolida — il codice lo scrivono i lavoratori, "
            "altrimenti sono due mani sullo stesso file (#173, decisione 6).")
    return True, ""


def decide(tool_name: str, tool_input: dict, mode: str = LAB):
    """Decisione della guardia.
    -> (True, "") se permesso, (False, motivo) se vietato.

    Impostazione: LISTA DI DIVIETI. Tutto cio' che non e' esplicitamente
    vietato passa, perche' il perimetro di lettura e' totale."""
    tool_input = tool_input or {}

    if mode == GOV:
        return _decide_gov(tool_name, tool_input)

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
    data = payload()
    record_shape("UserPromptSubmit", data)
    sid = data.get("session_id") or ""
    mode = parse_start_command(data.get("prompt") or "")
    if mode is None:
        return 0
    set_mode(sid, mode)
    gc()
    sys.stdout.write({LAB: LAB_BRIEF, GOV: GOV_BRIEF}.get(mode, CANONICAL_BRIEF))
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


def _casi_gov():
    """Casi della guardia in modalita' `gov` (#173, decisione 6 di Enzo).

    Il divieto e' UNO SOLO — scrivere codice di prodotto — e la lista dei
    permessi non esiste apposta: #121 ha mostrato che una guardia larga
    rifiuta lavoro legittimo, e lo fa in silenzio."""
    repo = str(REPO)
    return [
        ("gov: scrittura in apps/", "Write", {"file_path": f"{repo}/apps/api/src/x.ts"}, False),
        ("gov: modifica in apps/web", "Edit", {"file_path": f"{repo}/apps/web/src/app/page.tsx"}, False),
        ("gov: scrittura in packages/", "Write", {"file_path": f"{repo}/packages/shared/src/i.ts"}, False),
        ("gov: migrazione in db/", "Write", {"file_path": f"{repo}/db/migrations/000303_x.sql"}, False),
        ("gov: scrittura in .zp/", "Write", {"file_path": f"{repo}/.zp/w1/cursor.json"}, True),
        ("gov: scrittura di un piano", "Write", {"file_path": f"{repo}/docs/superpowers/plans/x.md"}, True),
        ("gov: aggiorna la config del loop", "Write",
         {"file_path": f"{repo}/.claude/skills/zero-pending-loop/references/zp.config.yaml"}, True),
        ("gov: lancio del driver", "Bash",
         {"command": "bash scripts/zero-pending-driver.sh --lavoratori 2 --dry-run"}, True),
        ("gov: consolidamento", "Bash", {"command": "python docs/kb/tools/zp_state.py stato-gov"}, True),
        ("gov: commit", "Bash", {"command": 'git commit -m "chore(zp): consolidamento"'}, True),
        ("gov: lettura del codice di prodotto", "Read", {"file_path": f"{repo}/apps/api/src/server.ts"}, True),
        ("gov: psql in lettura", "Bash", {"command": 'psql -c "SELECT count(*) FROM sys.sys_users"'}, True),
    ]


def cmd_selftest() -> int:
    ok = bad = 0
    failures = []
    for desc, tool, inp, expected in _cases():
        allowed, reason = decide(tool, inp)
        if allowed == expected:
            ok += 1
        else:
            bad += 1
            failures.append((desc, expected, allowed, reason))

    for desc, tool, inp, expected in _casi_gov():
        allowed, reason = decide(tool, inp, GOV)
        if allowed == expected:
            ok += 1
        else:
            bad += 1
            failures.append((desc, expected, allowed, reason))

    # Le etichette non sono permessi. Questa tabella e' il punto in cui
    # `gov` puo' essere scambiata per una modalita' piu' permissiva: se
    # qualcuno la esentasse dal cancello, qui diventa rosso.
    for mode, guardia, cancello in [
        (LAB, True, False),
        (CANONICAL, False, True),
        (GOV, True, True),
        (WORKER, False, True),
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
        set_mode(probe_sid, GOV)
        checks.append(("marcatore gov riletto", get_mode(probe_sid) == GOV))
        set_mode(probe_sid, WORKER, cluster="Z-004", lavoratore=2)
        checks.append(("marcatore worker riletto", get_mode(probe_sid) == WORKER))
        checks.append(("il lavoratore porta il cluster assegnato",
                       leggi_marcatore(probe_sid).get("cluster") == "Z-004"))
        marker(probe_sid).write_text(
            json.dumps({"mode": "pippo", "session_id": probe_sid}), encoding="utf-8")
        checks.append(("modo ignoto -> canonical", get_mode(probe_sid) == CANONICAL))
        marker(probe_sid).write_text("{ non json", encoding="utf-8")
        checks.append(("marcatore corrotto -> canonical", get_mode(probe_sid) == CANONICAL))
        marker(probe_sid).unlink()
        checks.append(("marcatore assente -> canonical", get_mode(probe_sid) == CANONICAL))
        checks.append(("session_id vuoto -> canonical", get_mode("") == CANONICAL))
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
        ("avvia sessione gov", GOV),
        ("Avvia Sessione Gov", GOV),
        ("  avvia sessione gov  ", GOV),
        ("avvia sessione gov\nraggruppa le pendenze in due cluster", GOV),
        # frontiere: una parola che COMINCIA per gov non e' il comando
        ("avvia sessione govern", None),
        ("avvia sessione governance", None),
        # `worker` lo assegna il driver, non si digita: come comando non esiste
        ("avvia sessione worker", None),
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
            print(f"uso: set <session_id> <{'|'.join(MODI)}> [cluster] [lavoratore]",
                  file=sys.stderr)
            return 1
        if rest[1] not in MODI:
            print(f"modalita' sconosciuta: {rest[1]} (ammesse: {', '.join(MODI)})",
                  file=sys.stderr)
            return 1
        lavoratore = None
        if len(rest) > 3:
            try:
                lavoratore = int(rest[3])
            except ValueError:
                print(f"il numero del lavoratore non e' un numero: {rest[3]}", file=sys.stderr)
                return 1
        set_mode(rest[0], rest[1], cluster=(rest[2] if len(rest) > 2 else None),
                 lavoratore=lavoratore)
        print(get_mode(rest[0]))
        return 0
    if cmd == "gc":
        print(f"{gc()} marcatori rimossi")
        return 0
    if cmd == "selftest":
        return cmd_selftest()
    print(f"sottocomando sconosciuto: {cmd}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
