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
  storico     archivi e registri chiusi (STORICI): la citazione è storia, non uso
  workflow    .github/**
  generato    indici e viste rigenerati da uno script (si rigenerano dopo)
  codice      sorgenti, script, SQL, configurazione
  documento   ogni altro file tracciato

Uso:
  python3 docs/kb/tools/mappa_rimandi.py --censimento <tsv> --out <tsv> [--repo <dir>] [--citanti <tsv>]
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
    "esecuzione/_misure/CENSIMENTO_DOCUMENTI_", "esecuzione/_misure/MAPPA_RIMANDI_",
    "esecuzione/piani/124_PIANO_IL_RIORDINO",
    # censimento dei documenti del ciclo DREAM del 2026-08-25: un inventario datato
    # che elenca ogni file del repo di allora, come il censimento di oggi
    "docs/vision/DREAM_2026-08-25/_raccolta/",
)
# Una citazione da qui è storia: non trattiene il documento, che resta recuperabile
# dal registro dei ritiri (commit e copia). Decisione del 2026-11-25 nel piano.
STORICI = (
    "docs/archive/", "docs/kb/COWORK_INBOX.md", "qa_artifacts/", "cowork_reserved/",
    "docs/source_bundle/extracted_bootstrap/",
    # heuresys-datastore: misure, posta con Cowork, stato archiviato, materiale congelato
    "esecuzione/_misure/", "cowork_exchange/_outbox_cowork/", "cowork_exchange/_inbox_cowork/",
    "esecuzione/STATO_CORRENTE_ARCHIVIO.md", "_recupero_20260716/", "_originali_consegnati/",
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
    if citante.startswith(STORICI):
        return "storico"
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
    ap.add_argument("--uscenti", help="elenco dei soli file che escono adesso: le citazioni "
                    "da un superato che resta allora contano (altrimenti il suo link si romperebbe)")
    ap.add_argument("--link-vincolanti", action="store_true",
                    help="un link markdown trattiene il documento anche da un citante storico "
                    "(serve dove un controllo verifica i link di tutti i file, come nel datastore)")
    ap.add_argument("--citanti", help="tsv con ogni citazione: bersaglio, classe, citante:riga")
    a = ap.parse_args()
    root = subprocess.check_output(["git", "-C", a.repo, "rev-parse", "--show-toplevel"], text=True).strip()

    with open(a.censimento, encoding="utf-8") as f:
        righe = list(csv.DictReader(f, delimiter="\t"))
    verdetto = {r["path"]: r["verdetto"] for r in righe}
    bersagli = [p for p, v in verdetto.items() if v in DA_TOGLIERE]
    uscenti = set(bersagli)
    if a.uscenti:
        with open(a.uscenti, encoding="utf-8") as f:
            uscenti = {r.strip() for r in f if r.strip()}

    tracciati = subprocess.check_output(["git", "-C", root, "ls-files"], text=True).splitlines()
    # il nome da solo vale come citazione solo se nessun altro file tracciato lo porta
    nomi = collections.Counter(os.path.basename(p) for p in set(bersagli) | set(tracciati))
    # un rimando Obsidian ([[NOME]], [[cartella/NOME|testo]]) omette l'estensione:
    # si riconosce solo dentro le doppie quadre, perché fuori un nome come
    # sys_job_roles è una tabella e non un documento
    steli = collections.defaultdict(list)
    for p in bersagli:
        if p.endswith(".md"):
            steli[os.path.basename(p)[:-3]].append(p)
    # un link markdown relativo ([x](../y/README.md)) si risolve dalla cartella del citante:
    # i suoi suffissi da soli non bastano quando il nome è generico
    link_re = re.compile(r"\]\(([^)\s#]+)")
    wiki_re = re.compile(r"\[\[([^\]|#]+)")
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
    citazioni = collections.defaultdict(lambda: collections.defaultdict(list))
    tracciati_set = set(tracciati)
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
            for dest in link_re.findall(riga):
                t = os.path.normpath(os.path.join(os.path.dirname(citante), dest)).replace(os.sep, "/")
                for p in chiavi.get(t, []):
                    if p != citante:
                        k = "documento" if a.link_vincolanti and classe(citante) in ("storico", "generato") else classe(citante)
                        citazioni[p][k].append(f"{citante}:{num}")
            for link in wiki_re.findall(riga):
                nome = link.strip().split("/")[-1]
                if nome.endswith(".md"):
                    nome = nome[:-3]
                for p in steli.get(nome, []):
                    if p != citante:
                        citazioni[p][classe(citante)].append(f"{citante}:{num}")
            for tok in token_re.findall(riga):
                parti = tok.split("/")
                trovati = set()
                for i in range(len(parti)):
                    suff = "/".join(parti[i:])
                    # un percorso completo di un altro file tracciato non è una citazione
                    # del bersaglio che ne condivide solo il nome
                    if suff in tracciati_set and suff not in chiavi:
                        break
                    if suff in chiavi:
                        trovati.update(chiavi[suff])
                        break
                for p in trovati:
                    if p != citante:
                        citazioni[p][classe(citante)].append(f"{citante}:{num}")

    classi = ["documento", "codice", "workflow", "migrazione", "storico", "generato"]
    vincolanti = 3  # documento, codice, workflow; migrazioni, storici e generati non trattengono
    with open(a.out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["path", "verdetto"] + classi + ["libero", "esempi"])
        for p in sorted(bersagli):
            c = citazioni.get(p, {})
            n = [len(set(c.get(k, []))) for k in classi]
            libero = "sì" if sum(n[:vincolanti]) == 0 else "no"
            esempi = []
            for k in classi[:vincolanti]:
                esempi += sorted(set(c.get(k, [])))[:2]
            w.writerow([p, verdetto[p]] + n + [libero, " ".join(esempi[:6])])

    if a.citanti:
        with open(a.citanti, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter="\t", lineterminator="\n")
            w.writerow(["bersaglio", "classe", "citante"])
            for p in sorted(citazioni):
                for k in classi:
                    for c in sorted(set(citazioni[p].get(k, []))):
                        w.writerow([p, k, c])

    tot = collections.Counter()
    for p in bersagli:
        c = citazioni.get(p, {})
        if not any(c.get(k) for k in classi[:vincolanti]):
            tot["liberi"] += 1
        for k in classi:
            if c.get(k):
                tot[k] += 1
    print(f"documenti da togliere: {len(bersagli)}")
    print(f"  liberi (nessun documento, codice o workflow vivo lo cita): {tot['liberi']}")
    for k in classi:
        print(f"  citati da {k}: {tot[k]}")
    print(f"dettaglio: {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
