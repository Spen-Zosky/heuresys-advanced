#!/usr/bin/env python3
"""gov_worker_guard — il recinto e il diario di una sessione-lavoratore (#173, fase 2).

Perche' esiste
--------------
Nella quarta corsa presidiata un lavoratore ha dichiarato il perimetro
`apps/api/test/**` e ha committato quattro file in `apps/web/`. Non aveva
disobbedito a una regola: la regola non c'era. Il perimetro era una dichiarazione
letta dal driver per decidere chi poteva correre insieme, e nessuno la imponeva a
chi lavorava.

Da li' i quattro rilievi di Enzo, che sono lo stesso difetto visto da quattro
lati: governo debole, nessun registro delle azioni, si puo' uscire dal perimetro,
e la decisione «questi due possono correre insieme» poggia su un'informazione che
nessuno verifica.

Il rimedio non e' scrivere «resta nel perimetro» nel prompt. Questo progetto ha
gia' stabilito, in testa a `session_mode.py`, che una modalita' «non e' una
promessa del modello, e' uno stato su disco». Qui vale identico:

  · RECINTO (PreToolUse)  — una scrittura fuori perimetro viene RIFIUTATA.
  · DIARIO  (PostToolUse) — ogni azione finisce in un giornale append-only che
                            il lavoratore non controlla e non puo' spegnere.

Come sa di essere un lavoratore
-------------------------------
Dal file `.zp/incarico.json` che il driver scrive nel suo albero PRIMA di aprire
la sessione. Senza quel file questi hook non fanno nulla: una sessione normale
non e' toccata.

    {"cluster": "Z-112", "lavoratore": 2, "perimetro": ["apps/api/test", ...]}

Fallimento sicuro, e qui va nella direzione SEVERA
--------------------------------------------------
Se l'incarico c'e' ma e' illeggibile, il recinto **blocca** invece di lasciar
passare: un lavoratore che non sa qual e' il suo perimetro non deve scrivere. E'
l'opposto della scelta fatta per `lab`, e per una ragione: li' il dubbio riguarda
*quanto e' permissiva* una sessione umana; qui riguarda *cosa tocca* un processo
non presidiato.

Sottocomandi
------------
  recinto   PreToolUse  — rifiuta le scritture fuori perimetro
  diario    PostToolUse — annota l'azione nel giornale
  leggi     stampa il giornale di un albero (per il consuntivo di gov)
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

SCRITTURE = {"Write", "Edit", "NotebookEdit", "MultiEdit"}


def radice() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and Path(env).is_dir():
        return Path(env).resolve()
    return Path(__file__).resolve().parents[2]


REPO = radice()
INCARICO = REPO / ".zp" / "incarico.json"
DIARIO = REPO / ".zp" / "diario.ndjson"


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


def incarico() -> dict | None:
    """L'incarico, o None se questa non e' una sessione-lavoratore.

    Distingue tre casi, e il terzo e' quello che conta:
      · file assente   -> None, non e' un lavoratore, gli hook non fanno nulla;
      · file leggibile -> l'incarico;
      · file rotto     -> un dizionario SENZA perimetro, che il recinto tratta
                          come «non so cosa posso toccare» e quindi blocca.
    """
    if not INCARICO.is_file():
        return None
    try:
        d = json.loads(INCARICO.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {"illeggibile": True}
    except (OSError, ValueError):
        return {"illeggibile": True}


def normalizza(voci) -> list[str]:
    fuori = []
    for v in voci or []:
        s = str(v).replace("\\", "/").strip().rstrip("*").strip("/")
        if s:
            fuori.append(s)
    return fuori


def dentro_perimetro(percorso: str, perimetro: list[str]) -> bool:
    """Vero se il percorso cade dentro uno dei rami dichiarati.

    Confronto per SEGMENTO, come in `zp_state`: `apps/api` non contiene
    `apps/api2`. Un perimetro vuoto non autorizza niente — chi non ha dichiarato
    dove lavora non scrive.
    """
    if not perimetro:
        return False
    try:
        rel = os.path.relpath(os.path.realpath(percorso), os.path.realpath(REPO))
    except (OSError, ValueError):
        return False
    rel = rel.replace("\\", "/")
    if rel.startswith(".."):
        return True                       # fuori dal repo: non e' affar nostro
    for p in perimetro:
        if rel == p or rel.startswith(p + "/"):
            return True
    return False


# Cio' che un lavoratore puo' sempre toccare, perche' e' il SUO stato e non il
# prodotto: senza queste, non potrebbe nemmeno dire com'e' andata.
SEMPRE_CONCESSI = (".zp/", ".handoff/session-journal.ndjson")


def concesso_comunque(percorso: str) -> bool:
    try:
        rel = os.path.relpath(os.path.realpath(percorso), os.path.realpath(REPO)).replace("\\", "/")
    except (OSError, ValueError):
        return False
    return any(rel.startswith(p) for p in SEMPRE_CONCESSI)


def annota(voce: dict) -> None:
    """Scrive nel giornale. Append puro, una riga per azione, mai riscritto."""
    try:
        DIARIO.parent.mkdir(parents=True, exist_ok=True)
        voce["quando"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        with DIARIO.open("a", encoding="utf-8") as f:
            f.write(json.dumps(voce, ensure_ascii=False) + "\n")
    except OSError:
        pass                              # il diario non deve mai fermare il lavoro


def cmd_recinto() -> int:
    d = payload()
    inc = incarico()
    if inc is None:
        return 0                          # non e' un lavoratore

    strumento = d.get("tool_name") or ""
    ingresso = d.get("tool_input") or {}

    if inc.get("illeggibile"):
        if strumento in SCRITTURE:
            sys.stderr.write(
                "recinto gov: l'incarico di questo lavoratore e' illeggibile, quindi non "
                "si sa quale sia il suo perimetro. Una sessione non presidiata che non sa "
                "cosa puo' toccare non scrive. Rigenerare .zp/incarico.json.\n")
            annota({"azione": "rifiutata", "strumento": strumento, "perche": "incarico illeggibile"})
            return 2
        return 0

    if strumento not in SCRITTURE:
        return 0

    percorso = ingresso.get("file_path") or ingresso.get("notebook_path") or ""
    if not percorso:
        return 0
    if concesso_comunque(percorso):
        return 0

    perimetro = normalizza(inc.get("perimetro"))
    if dentro_perimetro(percorso, perimetro):
        return 0

    cluster = inc.get("cluster") or "?"
    sys.stderr.write(
        f"recinto gov: «{percorso}» e' fuori dal perimetro dichiarato per {cluster}.\n"
        f"Perimetro: {', '.join(perimetro) if perimetro else '(vuoto)'}\n"
        "Il perimetro non e' un suggerimento: e' cio' su cui il driver ha deciso che questo "
        "cluster poteva girare INSIEME a un altro. Uscirne significa poter pestare i piedi a "
        "un lavoratore che sta lavorando adesso. Se il lavoro richiede davvero questo file, "
        "fermati e scrivi outcome «blocked» dicendo quale perimetro servirebbe.\n")
    annota({"azione": "rifiutata", "strumento": strumento, "percorso": percorso,
            "cluster": cluster, "perche": "fuori perimetro"})
    return 2


def cmd_diario() -> int:
    d = payload()
    if incarico() is None:
        return 0

    strumento = d.get("tool_name") or ""
    ingresso = d.get("tool_input") or {}
    voce: dict = {"azione": "eseguita", "strumento": strumento}

    # Si annota COSA e' stato fatto, non il contenuto: un diario che copia i corpi
    # dei file diventa illeggibile e puo' catturare segreti.
    if strumento in SCRITTURE:
        voce["percorso"] = ingresso.get("file_path") or ingresso.get("notebook_path") or ""
    elif strumento in ("Bash", "PowerShell"):
        comando = (ingresso.get("command") or "").strip().replace("\n", " ⏎ ")
        voce["comando"] = comando[:400]
    elif strumento in ("Read", "Grep", "Glob"):
        voce["oggetto"] = str(ingresso.get("file_path") or ingresso.get("pattern") or "")[:200]
    annota(voce)
    return 0


def cmd_leggi(argv) -> int:
    percorso = Path(argv[0]) if argv else DIARIO
    if percorso.is_dir():
        percorso = percorso / ".zp" / "diario.ndjson"
    if not percorso.is_file():
        print(f"nessun diario in {percorso}")
        return 1
    scritture = comandi = rifiuti = 0
    for riga in percorso.read_text(encoding="utf-8").splitlines():
        if not riga.strip():
            continue
        try:
            v = json.loads(riga)
        except ValueError:
            continue
        if v.get("azione") == "rifiutata":
            rifiuti += 1
            print(f"  {v.get('quando','')}  RIFIUTATA  {v.get('strumento','')}  "
                  f"{v.get('percorso','')}  ({v.get('perche','')})")
        elif "comando" in v:
            comandi += 1
            print(f"  {v.get('quando','')}  $ {v['comando'][:120]}")
        elif "percorso" in v:
            scritture += 1
            print(f"  {v.get('quando','')}  scrive   {v['percorso']}")
    print(f"\n{scritture} scritture · {comandi} comandi · {rifiuti} azioni rifiutate")
    return 0


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == "recinto":
        return cmd_recinto()
    if cmd == "diario":
        return cmd_diario()
    if cmd == "leggi":
        return cmd_leggi(rest)
    print(f"sottocomando sconosciuto: {cmd}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
