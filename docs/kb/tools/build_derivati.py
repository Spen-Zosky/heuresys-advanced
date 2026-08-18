#!/usr/bin/env python3
"""build_derivati.py — #217 I6: GLI ARTEFATTI DERIVATI ENTRANO NEL CICLO.

IL DIFETTO, misurato e non supposto. Cinque generatori esistevano e nessuno li
chiamava: ne' la chiusura, ne' una cascata. Rigenerando `concepts-corpus.jsonl`
il 2026-08-18 sono comparsi **6 concetti nuovi** (`tenant-blueprints`,
`performance-reviews`, `review-cycles`, `calibration-sessions`, `delegations`,
`generated-origins`) e ne sono spariti **4** (`brownfield-*`, cioe' lo schema
RITIRATO da #164 F4 settimane prima). L'artefatto descriveva un progetto che non
esiste piu'. Non e' un rischio teorico: era gia' successo.

CHE COSA E' UNA CASCATA, qui. Due dei tre non derivano dal codice ma
dall'**atlante**:

    codice  ->  build_atlas       ->  atlas.yaml  ->  build_agent_operations
                                                  ->  build_concepts
    docs/architecture/adr/*.md    ->  build_adr_index

Quindi rigenerare l'atlante e fermarsi li' lascia indietro i suoi due figli, e il
giorno dopo misurano il passato senza saperlo — lo stesso identico difetto che la
regola di Enzo sull'atlante voleva impedire (`#195`), un anello piu' in la'.

DUE DEI CINQUE NON ENTRANO, e va detto invece di tacerlo:
`build_linked_manifest.py` e `build_graph_hub.py` scrivono in
`C:\\Users\\enzospenuso\\wiki-space\\...`, che esiste **solo sulla macchina
Windows**. Metterli in chiusura li farebbe fallire su VM e linux-pc, dove la
chiusura gira davvero. Restano affidati a `docs/kb/tools/sync.sh`. In piu'
portano quel path assoluto **cablato nel sorgente**, che e' una violazione della
regola «niente path assoluti nei file versionati»: e' un rilievo a se', non
qualcosa da sistemare di passaggio.

USO
    python docs/kb/tools/build_derivati.py              # rigenera i tre, in ordine
    python docs/kb/tools/build_derivati.py --controlla  # non scrive: dice chi e' superato
                                                        # exit 1 se almeno uno lo e', 2 se cieco

COME SI MISURA LA FRESCHEZZA — e la prima versione era ROTTA, in un modo che
merita di restare scritto. Confrontava il timestamp dell'ultimo commit
dell'artefatto con quello delle sue fonti. Sembra ragionevole e non lo e': se il
generatore gira e produce un contenuto IDENTICO, git non ha niente da
committare, quindi il timestamp dell'artefatto non avanza — e il controllo
continua a gridare «superato» per sempre. Misurato subito dopo il commit di I6:
due artefatti su tre erano corretti e restavano rossi. Un allarme che non si puo'
spegnere facendo la cosa giusta e' esattamente il difetto di `#194`: insegna a
non guardarlo.

La cura e' il meccanismo che l'atlante usa gia': si REGISTRA il commit da cui la
generazione e' partita (`docs/kb/atlas/derivati.json`) e si chiede a git *dei
file-fonte, ne e' cambiato qualcuno DOPO quel commit?* — che e' la stessa domanda
di `atlas_freshness()`, parola per parola. Il registro e' versionato, cosi' la
risposta e' la stessa su ogni macchina; se manca, la risposta e' NON MISURABILE,
mai un «fresco» dato per buono.
"""
import io
import json
import os
import subprocess
import sys

def _repo() -> str:
    """La radice del repo. Prima si chiede a git, che e' l'unico a saperlo davvero; il
    ripiego risale i QUATTRO livelli di docs/kb/tools/<file>. La prima stesura ne
    risaliva tre e si fermava su `docs/`: ogni percorso era sbagliato, e la
    rigenerazione dichiarava «assente — salto» su generatori che esistono.

    `DERIVATI_REPO` la scavalca: serve alla batteria per puntare a una radice vuota e
    verificare che la rigenerazione esca 1 invece del vecchio, silenzioso 0."""
    forzata = os.environ.get("DERIVATI_REPO")
    if forzata:
        return forzata
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                             cwd=os.path.dirname(os.path.abspath(__file__)),
                             capture_output=True, text=True, timeout=15)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))))


REPO = _repo()

# artefatto -> (generatore, [fonti da cui deriva])
DERIVATI = {
    "docs/kb/atlas/agent-operations.json": (
        "build_agent_operations.py", ["docs/kb/atlas/atlas.yaml"]),
    "docs/kb/atlas/concepts-corpus.jsonl": (
        "build_concepts.py", ["docs/kb/atlas/atlas.yaml"]),
    "docs/architecture/ADR_INDEX.md": (
        "build_adr_index.py", ["docs/architecture/adr"]),
}

# L'ORDINE E' LA SOSTANZA: i primi due leggono atlas.yaml, quindi l'atlante va rigenerato
# PRIMA (lo fa la skill allo Step 3d) e loro subito dopo. Invertire significherebbe
# ricostruirli sull'atlante vecchio, cioe' fare il lavoro e conservare il difetto.
ORDINE = ["build_agent_operations.py", "build_concepts.py", "build_adr_index.py"]


REGISTRO = "docs/kb/atlas/derivati.json"


def _git(*args):
    try:
        out = subprocess.run(["git", "-C", REPO, *args],
                             capture_output=True, text=True, timeout=30)
    except Exception:
        return None
    return out.stdout.strip() if out.returncode == 0 else None


def _commit_generazione():
    """Il commit da cui e' partita l'ultima rigenerazione. None = mai registrato."""
    try:
        with io.open(os.path.join(REPO, REGISTRO), encoding="utf-8") as fh:
            return (json.load(fh) or {}).get("generato_da_commit") or None
    except Exception:
        return None


def stato():
    """La MISURA, senza stampare niente: la usa anche il boot (status_dashboard).

    Ritorna [(artefatto, esito, dettaglio)] con esito in {fresco, superato, cieco}.

    Il criterio e' volutamente CONSERVATIVO: confronta i timestamp dei commit, non i
    contenuti. Puo' quindi dire «superato» a un artefatto il cui contenuto non
    cambierebbe (misurato: due dei tre, il 2026-08-18) — ma non puo' mai dire «fresco»
    a uno superato davvero. Sbagliare verso il lavoro in piu' e' l'unico verso
    accettabile per un controllo di freschezza.
    """
    esiti = []
    da = _commit_generazione()
    for artefatto, (_gen, fonti) in sorted(DERIVATI.items()):
        if da is None:
            esiti.append((artefatto, "cieco", f"{REGISTRO} assente: nessuna generazione registrata"))
            continue
        cambiati = _git("diff", "--name-only", f"{da}..HEAD", "--", *fonti)
        if cambiati is None:
            esiti.append((artefatto, "cieco", f"git non sa rispondere su {da[:8]}..HEAD"))
        elif cambiati:
            prime = ", ".join(cambiati.splitlines()[:2])
            esiti.append((artefatto, "superato", f"cambiato dopo {da[:8]}: {prime}"))
        else:
            esiti.append((artefatto, "fresco", ""))
    return esiti


def controlla() -> int:
    esiti = stato()
    segno = {"fresco": "[OK]", "superato": "[!!]", "cieco": "[? ]"}
    for artefatto, esito, dettaglio in esiti:
        coda = f" — {esito.upper()}: {dettaglio}" if dettaglio else " — fresco"
        print(f"  {segno[esito]} {artefatto}{coda}")
    superati = [a for a, e, _d in esiti if e == "superato"]
    if superati:
        print(f"\n  {len(superati)} artefatto/i superato/i → python docs/kb/tools/build_derivati.py")
        return 1
    if any(e == "cieco" for _a, e, _d in esiti):
        return 2
    return 0


def rigenera() -> int:
    # `fatti` esiste per un falso verde vero, colto alla prima esecuzione: con la radice
    # del repo sbagliata TUTTI i generatori risultavano «assente — salto» e la funzione
    # usciva **0**, cioe' dichiarava fatto un lavoro che non aveva nemmeno tentato.
    # Un esito verde che non ha eseguito niente e' peggio di un rosso.
    esito, fatti = 0, 0
    for gen in ORDINE:
        percorso = os.path.join(REPO, "docs", "kb", "tools", gen)
        if not os.path.isfile(percorso):
            print(f"  [--] {gen} assente — salto")
            continue
        fatti += 1
        r = subprocess.run([sys.executable, percorso], cwd=REPO,
                           capture_output=True, text=True)
        if r.returncode == 0:
            print(f"  [OK] {gen}")
        else:
            esito = 1
            print(f"  [!!] {gen} exit={r.returncode}")
            coda = (r.stderr or r.stdout or "").strip().splitlines()[-3:]
            for riga in coda:
                print(f"       {riga}")
    if fatti == 0:
        print(f"  [!!] nessun generatore eseguito — radice presunta: {REPO}")
        return 1
    # Il registro si scrive SOLO se tutto e' andato bene: registrare dopo un fallimento
    # dichiarerebbe fresco un artefatto che non e' stato ricostruito, ed e' il modo piu'
    # diretto di trasformare un controllo in una bugia.
    if esito == 0:
        head = _git("rev-parse", "HEAD") or ""
        try:
            with io.open(os.path.join(REPO, REGISTRO), "w", encoding="utf-8", newline="\n") as fh:
                json.dump({"generato_da_commit": head,
                           "artefatti": sorted(DERIVATI)}, fh, indent=2, ensure_ascii=False)
                fh.write("\n")
            print(f"  [OK] registro aggiornato ({REGISTRO}, da {head[:8]})")
        except Exception as exc:
            print(f"  [!!] registro non scritto: {type(exc).__name__}")
            return 1
    return esito


if __name__ == "__main__":
    sys.exit(controlla() if "--controlla" in sys.argv else rigenera())
