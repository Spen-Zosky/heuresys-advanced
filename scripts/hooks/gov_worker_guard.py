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
COMANDI = {"Bash", "PowerShell"}

# I divieti stanno in un modulo a parte (`gov_divieti.py`): un elenco di regole si
# legge, si discute e si estende meglio quando non e' annegato nella logica che lo
# applica.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gov_divieti import bersagli_di_scrittura, divieto_assoluto  # noqa: E402


def radice() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and Path(env).is_dir():
        return Path(env).resolve()
    return Path(__file__).resolve().parents[2]


REPO = radice()
INCARICO = REPO / ".zp" / "incarico.json"

# IL DIARIO NON VIVE NELL'ALBERO DEL SORVEGLIATO
# ----------------------------------------------
# Finche' stava in `<albero>/.zp/diario.ndjson`, il giornale delle azioni era custodito
# da chi quelle azioni le compie. Non e' mai stato cancellabile per comando — il recinto
# lo impedisce, ed e' provato — ma un registro tenuto dal sorvegliato resta una sua
# dichiarazione, non una prova. Ora vive ACCANTO agli alberi, in una cartella che nessun
# perimetro di lavoratore contiene.
#
# `DIARIO_VECCHIO` resta noto in sola lettura: i diari gia' scritti non si perdono, e
# l'istruttoria di un lavoratore che ha girato prima di oggi continua a leggerli.
DIARIO_VECCHIO = REPO / ".zp" / "diario.ndjson"


def diario_percorso() -> Path:
    fuori = os.environ.get("GOV_DIARI")
    base = Path(fuori) if fuori else REPO.parent.parent / "heuresys-gov-diari"
    return base / f"{REPO.name}.ndjson"


DIARIO = diario_percorso()


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


def assoluto(percorso: str) -> str:
    """Un percorso relativo si risolve sull'albero del lavoratore, MAI sulla cartella
    corrente del processo.

    `os.path.realpath` di un percorso relativo usa la cwd, che per un hook non e'
    garantita: `sed -i ... apps/api/test/x.ts` finiva risolto altrove e un file
    DENTRO il perimetro veniva rifiutato. Un falso rifiuto e' meno grave di una
    scrittura non vista, ma resta un difetto — e un recinto che rifiuta a caso viene
    aggirato in fretta da chi lo subisce.
    """
    if not percorso:
        return ""
    return percorso if os.path.isabs(percorso) else str(REPO / percorso)


def dentro_perimetro(percorso: str, perimetro: list[str]) -> bool:
    """Vero se il percorso cade dentro uno dei rami dichiarati.

    Confronto per SEGMENTO, come in `zp_state`: `apps/api` non contiene
    `apps/api2`. Un perimetro vuoto non autorizza niente — chi non ha dichiarato
    dove lavora non scrive.
    """
    if not perimetro:
        return False
    try:
        rel = os.path.relpath(os.path.realpath(assoluto(percorso)), os.path.realpath(REPO))
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
        rel = os.path.relpath(os.path.realpath(assoluto(percorso)), os.path.realpath(REPO)).replace("\\", "/")
    except (OSError, ValueError):
        return False
    return any(rel.startswith(p) for p in SEMPRE_CONCESSI)


def annota(voce: dict) -> None:
    """Scrive nel giornale. Append puro, una riga per azione, mai riscritto.

    Si prova prima FUORI dall'albero (il posto giusto: il sorvegliato non custodisce
    il proprio registro). Se quel disco non e' scrivibile si ripiega DENTRO, perche'
    un diario nel posto sbagliato vale piu' di nessun diario: lo spostamento non deve
    poter far sparire la registrazione in silenzio.
    """
    voce["quando"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    riga = json.dumps(voce, ensure_ascii=False) + "\n"
    for dove in (DIARIO, DIARIO_VECCHIO):
        try:
            dove.parent.mkdir(parents=True, exist_ok=True)
            with dove.open("a", encoding="utf-8") as f:
                f.write(riga)
            return
        except OSError:
            continue                      # il diario non deve mai fermare il lavoro


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

    perimetro = normalizza(inc.get("perimetro"))
    cluster = inc.get("cluster") or "?"

    # --- I COMANDI. Fino al 2026-08-09 il recinto guardava solo gli strumenti di
    # scrittura, e `sed -i`, `cat >`, `echo >`, `git checkout -- .` e `rm -rf`
    # passavano tutti e cinque, provati: fermava il modo educato di uscire dal
    # perimetro, non quello efficace. Prima i divieti che non dipendono dal
    # perimetro (pubblicare, toccare main, distruggere), poi i bersagli fuori recinto.
    if strumento in COMANDI:
        comando = ingresso.get("command") or ""
        colpo = divieto_assoluto(comando)
        if colpo:
            sys.stderr.write("recinto gov: " + colpo[1] + "\n")
            annota({"azione": "rifiutata", "strumento": strumento,
                    "comando": comando[:300], "cluster": cluster,
                    "perche": "divieto assoluto"})
            return 2
        for bersaglio in bersagli_di_scrittura(comando):
            if concesso_comunque(bersaglio) or dentro_perimetro(bersaglio, perimetro):
                continue
            sys.stderr.write(
                "recinto gov: il comando scriverebbe su «" + bersaglio + "», fuori dal "
                "perimetro di " + cluster + " (" + (", ".join(perimetro) or "vuoto") + ").\n"
                "Vale per i comandi come per gli strumenti di scrittura: il perimetro e' "
                "cio' su cui il driver ha deciso che potevi girare insieme a un altro.\n")
            annota({"azione": "rifiutata", "strumento": strumento,
                    "comando": comando[:300], "bersaglio": bersaglio,
                    "cluster": cluster, "perche": "scrittura fuori perimetro"})
            return 2
        return 0

    if strumento not in SCRITTURE:
        return 0

    percorso = ingresso.get("file_path") or ingresso.get("notebook_path") or ""
    if not percorso:
        return 0
    if concesso_comunque(percorso):
        return 0

    if dentro_perimetro(percorso, perimetro):
        return 0

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
        # Un albero passato per nome: si cerca PRIMA il diario esterno (quello di oggi),
        # poi quello interno (i lavoratori che hanno girato prima dello spostamento).
        albero = percorso
        fuori = os.environ.get("GOV_DIARI")
        base = Path(fuori) if fuori else albero.parent.parent / "heuresys-gov-diari"
        esterno = base / f"{albero.name}.ndjson"
        percorso = esterno if esterno.is_file() else albero / ".zp" / "diario.ndjson"
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
