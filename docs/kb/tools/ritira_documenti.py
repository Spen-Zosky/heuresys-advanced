#!/usr/bin/env python3
"""ritira_documenti.py — toglie dal repo un lotto di documenti superati, senza perderli.

Voce R5 del piano `docs/piani/PIANO_riordino-documentazione_20261125.md`.

Per ogni documento dell'elenco:
  1. guardia: è nel censimento come `superato` (o `da accorpare` con --anche-accorpare)
     e la mappa dei rimandi, ricalcolata ADESSO, lo dà libero (nessun documento vivo,
     codice, workflow o migrazione lo nomina). Se un solo documento non passa, il lotto
     non parte;
  2. copia in <cestino>/<repo>/<path> e confronto dell'impronta SHA-256;
  3. `git rm` del file (il contenuto resta nella storia di git);
  4. una riga nel registro dei ritiri: path, sha256, commit da cui si recupera, lotto, data.

Il commit di recupero è l'antenato comune con origin/main, dove il file deve esistere
identico. Ritorno indietro di un file: `git checkout <commit> -- <path>` con il commit del registro,
oppure la copia nel cestino. Non fa commit: li fa chi lo lancia, dopo i controlli.

Uso:
  python3 docs/kb/tools/ritira_documenti.py --elenco <txt> --censimento <tsv> \
      --registro <tsv> --cestino <dir> --lotto <nome> [--anche-accorpare] [--prova]
"""
import argparse
import csv
import datetime
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile


def sha(p: str) -> str:
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--elenco", required=True)
    ap.add_argument("--censimento", required=True)
    ap.add_argument("--registro", required=True)
    ap.add_argument("--cestino", required=True)
    ap.add_argument("--lotto", required=True)
    ap.add_argument("--anche-accorpare", action="store_true")
    ap.add_argument("--prova", action="store_true", help="solo la guardia, non tocca niente")
    a = ap.parse_args()

    root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
    repo = os.path.basename(root)
    # il commit di recupero deve stare su main: un ramo unito per squash sparisce,
    # e con lui i suoi commit. Si usa l'antenato comune con origin/main, se il file
    # vi esiste con la stessa impronta; altrimenti il lotto si ferma.
    head = subprocess.check_output(["git", "merge-base", "HEAD", "origin/main"], cwd=root, text=True).strip()
    with open(a.elenco, encoding="utf-8") as f:
        elenco = [r.strip() for r in f if r.strip()]
    with open(a.censimento, encoding="utf-8") as f:
        verdetto = {r["path"]: r["verdetto"] for r in csv.DictReader(f, delimiter="\t")}

    ammessi = {"superato"} | ({"da accorpare"} if a.anche_accorpare else set())
    errori = []
    for p in elenco:
        if verdetto.get(p) not in ammessi:
            errori.append(f"{p}: verdetto «{verdetto.get(p)}», non ritirabile")
        elif not os.path.isfile(os.path.join(root, p)):
            errori.append(f"{p}: non esiste")
        else:
            r = subprocess.run(["git", "show", f"{head}:{p}"], cwd=root, capture_output=True)
            if r.returncode or hashlib.sha256(r.stdout).hexdigest() != sha(os.path.join(root, p)):
                errori.append(f"{p}: su main ({head[:9]}) manca o è diverso, il recupero non sarebbe garantito")

    # la mappa si ricalcola al momento: un rimando nato dopo il censimento ferma il lotto
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "mappa.tsv")
        subprocess.check_call([sys.executable, os.path.join(os.path.dirname(__file__), "mappa_rimandi.py"),
                               "--censimento", a.censimento, "--out", out, "--repo", root],
                              stdout=subprocess.DEVNULL)
        with open(out, encoding="utf-8") as f:
            libero = {r["path"]: r["libero"] for r in csv.DictReader(f, delimiter="\t")}
    for p in elenco:
        if libero.get(p) != "sì":
            errori.append(f"{p}: ancora citato (vedi mappa dei rimandi)")

    if errori:
        print(f"LOTTO FERMO: {len(errori)} documenti non passano la guardia")
        for e in errori[:30]:
            print("  " + e)
        return 2
    print(f"guardia: {len(elenco)} documenti ritirabili")
    if a.prova:
        return 0

    nuovo = not os.path.exists(a.registro)
    oggi = datetime.date.today().isoformat()
    with open(a.registro, "a", encoding="utf-8", newline="") as reg:
        w = csv.writer(reg, delimiter="\t", lineterminator="\n")
        if nuovo:
            w.writerow(["path", "sha256", "recupero_da_commit", "lotto", "data"])
        for p in elenco:
            src = os.path.join(root, p)
            dst = os.path.join(a.cestino, repo, p)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            h = sha(src)
            shutil.copy2(src, dst)
            if sha(dst) != h:
                print(f"COPIA DIVERSA, mi fermo: {p}")
                return 3
            subprocess.check_call(["git", "rm", "-q", "--", p], cwd=root)
            w.writerow([p, h, head, a.lotto, oggi])
    print(f"ritirati {len(elenco)} documenti; recupero da {head[:12]}; copie in {a.cestino}/{repo}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
