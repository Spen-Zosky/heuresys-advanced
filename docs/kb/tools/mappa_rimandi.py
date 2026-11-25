#!/usr/bin/env python3
"""mappa_rimandi.py — chi cita ancora un documento che il censimento vuole togliere?

Voce R2 del piano `docs/piani/PIANO_riordino-documentazione_20261125.md`.

Prima di spostare un documento superato bisogna sapere chi lo nomina: un
documento vivo, uno script, un workflow, una migrazione già applicata. Questo
strumento legge il censimento (una riga per documento, colonne `path` e
`verdetto`), prende i documenti `superato` e `da accorpare`, e cerca nel repo
ogni file tracciato che ne nomina il percorso completo o il nome del file
(quando il nome è abbastanza distintivo). Le citazioni che vengono da un altro
documento superato non contano: escono insieme.

Classi del citante:
  migrazione  db/migrations/** (non si modifica: cambierebbe l'impronta)
  workflow    .github/**
  generato    indici e viste rigenerati da uno script (si rigenerano dopo)
  codice      sorgenti, script, SQL, configurazione
  documento   ogni altro file tracciato

Uso:
  python3 docs/kb/tools/mappa_rimandi.py --censimento <tsv> --out <tsv> [--repo <dir>]
Esce 0 e stampa un riepilogo; il dettaglio va in --out, una riga per documento.
Funziona su qualunque repo git (lo stesso file serve al datastore).
"""
import argparse
import collections
import csv
import os
import re
import subprocess
import sys

DA_TOGLIERE = {"superato", "da accorpare"}
NOMI_GENERICI = {
    "readme.md", "leggimi.md", "index.md", "plan.md", "report.md", "prompt.md",
    "00_indice.md", "state.md", "notes.md", "changelog.md", "todo.md", "esito.md",
    "stato.md", "piano.md", "spec.md", "design.md", "summary.md", "agents.md",
}
# il censimento e la mappa nominano per forza ogni documento: non contano
IGNORATI = (
    "docs/piani/riordino-documentazione_", "docs/piani/PIANO_riordino-documentazione_",
    "esecuzione/_misure/CENSIMENTO_DOCUMENTI_", "esecuzione/piani/124_PIANO_IL_RIORDINO",
)
GENERATI = (
    "docs/kb/INDEX_PATHS.md", "docs/kb/index_paths.yaml", "docs/kb/atlas/",
    "docs/architecture/ADR_INDEX.md", "docs/_meta/CHANGELOG.md",
)
CODICE = (".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".sh", ".ps1", ".sql",
          ".json", ".yaml", ".yml", ".toml", ".cmd", ".bat")


def classe(citante: str) -> str:
    if "db/migrations/" in citante:
        return "migrazione"
    if citante.startswith(".github/"):
        return "workflow"
    if citante.startswith(GENERATI):
        return "generato"
    if citante.endswith(CODICE):
        return "codice"
    return "documento"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--censimento", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--repo", default=".")
    a = ap.parse_args()
    root = subprocess.check_output(["git", "-C", a.repo, "rev-parse", "--show-toplevel"], text=True).strip()

    with open(a.censimento, encoding="utf-8") as f:
        righe = list(csv.DictReader(f, delimiter="\t"))
    verdetto = {r["path"]: r["verdetto"] for r in righe}
    bersagli = [p for p, v in verdetto.items() if v in DA_TOGLIERE]
    uscenti = set(bersagli)

    nomi = collections.Counter(os.path.basename(p) for p in bersagli)
    chiavi = {}  # stringa cercata -> bersagli che rappresenta
    for p in bersagli:
        chiavi.setdefault(p, []).append(p)
        b = os.path.basename(p)
        if len(b) >= 12 and b.lower() not in NOMI_GENERICI and nomi[b] == 1:
            chiavi.setdefault(b, []).append(p)

    # Si leggono i file una volta e si confrontano i "token" che hanno forma di
    # percorso con l'insieme delle chiavi: un percorso citato come ../x/y.md o
    # docs/x/y.md#sez si riconosce dai suoi suffissi. (git grep con duemila
    # modelli fissi impiega minuti; cosi' bastano pochi secondi.)
    token_re = re.compile(r"[A-Za-z0-9_.\-/\u00C0-\u017F]+")
    tracciati = subprocess.check_output(["git", "-C", root, "ls-files"], text=True).splitlines()
    citazioni = collections.defaultdict(lambda: collections.defaultdict(list))
    for citante in tracciati:
        if citante in uscenti or citante.startswith(IGNORATI):
            continue
        pieno = os.path.join(root, citante)
        try:
            if os.path.getsize(pieno) > 5_000_000:
                continue
            with open(pieno, "rb") as f:
                grezzo = f.read()
        except OSError:
            continue
        if b"\0" in grezzo[:8000]:
            continue
        for num, riga in enumerate(grezzo.decode("utf-8", "replace").splitlines(), 1):
            for tok in token_re.findall(riga):
                parti = tok.split("/")
                trovati = set()
                for i in range(len(parti)):
                    suff = "/".join(parti[i:])
                    if suff in chiavi:
                        trovati.update(chiavi[suff])
                        break
                for p in trovati:
                    if p != citante:
                        citazioni[p][classe(citante)].append(f"{citante}:{num}")

    classi = ["documento", "codice", "workflow", "migrazione", "generato"]
    with open(a.out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["path", "verdetto"] + classi + ["libero", "esempi"])
        for p in sorted(bersagli):
            c = citazioni.get(p, {})
            n = [len(set(c.get(k, []))) for k in classi]
            libero = "sì" if sum(n[:4]) == 0 else "no"
            esempi = []
            for k in classi[:4]:
                esempi += sorted(set(c.get(k, [])))[:2]
            w.writerow([p, verdetto[p]] + n + [libero, " ".join(esempi[:6])])

    tot = collections.Counter()
    for p in bersagli:
        c = citazioni.get(p, {})
        if not any(c.get(k) for k in classi[:4]):
            tot["liberi"] += 1
        for k in classi:
            if c.get(k):
                tot[k] += 1
    print(f"documenti da togliere: {len(bersagli)}")
    print(f"  liberi (nessun citante vivo fuori dai generati): {tot['liberi']}")
    for k in classi:
        print(f"  citati da {k}: {tot[k]}")
    print(f"dettaglio: {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
