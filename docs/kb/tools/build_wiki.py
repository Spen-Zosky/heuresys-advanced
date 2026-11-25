#!/usr/bin/env python3
"""build_wiki.py — rigenera le parti generate del wiki di `docs/wiki/` (voci R10-R11).

Piano `docs/piani/PIANO_riordino-documentazione_20261125.md`, sezioni 3-4 (modello llm-wiki).

Il wiki ha pagine scritte a mano (le sezioni di testo delle pagine di dominio e di concetto)
e parti che si ricavano dai file e quindi non si scrivono a mano, perché invecchierebbero:

  docs/wiki/index.md               una riga per pagina viva, con dominio, sintesi e data
  docs/wiki/indice-analitico.md    concetto -> pagine che lo trattano (dai metadati `concetti`)
  blocco «decisioni» di ogni pagina di dominio
                                   gli ADR del dominio con lo Status scritto nel loro file
                                   (mappa in docs/wiki/adr_domini.tsv)
  blocco «storia» di ogni pagina di dominio
                                   quanti documenti del dominio il riordino ha ritirato, con
                                   lotti e commit di recupero (registro dei ritiri + censimento)

Un blocco generato sta fra `<!-- generato:NOME -->` e `<!-- /generato -->`.

Uso:
  python3 docs/kb/tools/build_wiki.py           # riscrive
  python3 docs/kb/tools/build_wiki.py --check   # esce 1 se qualcosa non è aggiornato
"""
import argparse
import collections
import csv
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_documenti import DOMINI, metadati  # noqa: E402

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
WIKI = os.path.join(ROOT, "docs/wiki")
ADR_DIR = os.path.join(ROOT, "docs/architecture/adr")
REGISTRO = os.path.join(ROOT, "docs/piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv")
CENSIMENTO = os.path.join(ROOT, "docs/piani/riordino-documentazione_20261125/CENSIMENTO_advanced.tsv")
BLOCCO = re.compile(r"(<!-- generato:(\w+) -->\n)(.*?)(<!-- /generato -->)", re.S)
TESTA = ("> **Generato** da `docs/kb/tools/build_wiki.py`: non si edita a mano. "
         "Si rigenera con `python3 docs/kb/tools/build_wiki.py`.\n")


def adr():
    """num -> (file, titolo, status breve), come li legge build_adr_index.py."""
    import build_adr_index as b
    return {v["num"]: (v["file"], v["titolo"], v["stato"]) for v in b.leggi_adr()}


def pagine():
    out = {}
    for base, _, files in os.walk(WIKI):
        for f in files:
            if f.endswith(".md"):
                p = os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, "/")
                with open(os.path.join(ROOT, p), encoding="utf-8") as fh:
                    out[p] = fh.read()
    return out


def blocco_decisioni(dominio, mappa, voci):
    nums = sorted(n for n, d in mappa if d == dominio)
    if not nums:
        return "Nessun ADR assegnato a questo dominio in `docs/wiki/adr_domini.tsv`.\n"
    righe = ["| ADR | Decisione | Status nel file |", "|---|---|---|"]
    for n in nums:
        if n not in voci:
            righe.append(f"| {n} | *(file assente)* | — |")
            continue
        f, t, s = voci[n]
        righe.append(f"| [{n}](../../architecture/adr/{f}) | {t.replace('|', '/')} | {s} |")
    return "\n".join(righe) + "\n"


def blocco_storia(dominio, ritiri, dom_cens):
    mie = [r for r in ritiri if dom_cens.get(r["path"]) == dominio]
    if not mie:
        return "Il riordino del 2026-11-25 non ha ancora ritirato documenti di questo dominio.\n"
    lotti = collections.Counter(r["lotto"] for r in mie)
    commit = sorted({r["recupero_da_commit"][:9] for r in mie})
    cartelle = collections.Counter(os.path.dirname(r["path"]) or "." for r in mie)
    testo = (f"Il riordino del 2026-11-25 ha ritirato **{len(mie)}** documenti di questo dominio "
             f"(lotti: {', '.join(f'{k} {v}' for k, v in sorted(lotti.items()))}). "
             f"Si recuperano con `git show <commit>:<percorso>` dai commit {', '.join(commit)}, "
             "oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel "
             "[registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).\n\n"
             "Da dove venivano: " + ", ".join(f"`{k}` {v}" for k, v in cartelle.most_common(8)) + ".\n")
    return testo


def genera():
    voci = adr()
    with open(os.path.join(WIKI, "adr_domini.tsv"), encoding="utf-8") as f:
        mappa = [(r["adr"], r["dominio"]) for r in csv.DictReader(f, delimiter="\t")]
    ritiri, dom_cens = [], {}
    if os.path.exists(REGISTRO):
        with open(REGISTRO, encoding="utf-8") as f:
            ritiri = list(csv.DictReader(f, delimiter="\t"))
    if os.path.exists(CENSIMENTO):
        with open(CENSIMENTO, encoding="utf-8") as f:
            dom_cens = {r["path"]: r["dominio"] for r in csv.DictReader(f, delimiter="\t")}

    nuovi = {}
    pag = pagine()
    for p, testo in pag.items():
        if not p.startswith("docs/wiki/domini/"):
            continue
        dominio = os.path.basename(p)[:-3]

        def sost(m):
            nome = m.group(2)
            if nome == "decisioni":
                corpo = blocco_decisioni(dominio, mappa, voci)
            elif nome == "storia":
                corpo = blocco_storia(dominio, ritiri, dom_cens)
            else:
                return m.group(0)
            return m.group(1) + corpo + m.group(4)

        nuovo = BLOCCO.sub(sost, testo)
        if nuovo != testo:
            nuovi[p] = nuovo
        pag[p] = nuovo

    # index.md e indice analitico, dai metadati delle pagine
    righe_dom, righe_con, concetti = [], [], collections.defaultdict(list)
    for p in sorted(pag):
        if p in ("docs/wiki/index.md", "docs/wiki/indice-analitico.md", "docs/wiki/log.md"):
            continue
        m = metadati(pag[p]) or {}
        if "dominio" not in m:
            continue
        rel = os.path.relpath(p, "docs/wiki").replace(os.sep, "/")
        nome = os.path.basename(p)[:-3]
        riga = f"| [{nome}]({rel}) | {m.get('dominio')} | {m.get('sintesi', '')} | {m.get('aggiornato_il', '')} |"
        (righe_dom if p.startswith("docs/wiki/domini/") else righe_con).append(riga)
        for c in m.get("concetti") or []:
            concetti[c].append((nome, rel))
    mancanti = sorted(DOMINI - {os.path.basename(p)[:-3] for p in pag if p.startswith("docs/wiki/domini/")})
    idx = ["# Indice del wiki", "", TESTA, "Il wiki segue il modello llm-wiki: fonti grezze (codice, ADR, registri), "
           "pagine di dominio e di concetto che le sintetizzano con i rimandi, e uno schema che dice come si "
           "tengono (`docs/wiki/LEGGIMI.md`). Le pagine si controllano con `python3 docs/kb/tools/check_documenti.py`.", "",
           "## Domini", "", "| Pagina | Dominio | Sintesi | Aggiornata il |", "|---|---|---|---|", *righe_dom, ""]
    if mancanti:
        idx += ["Domini ancora senza pagina: " + ", ".join(mancanti) + ".", ""]
    idx += ["## Concetti e schema", ""]
    idx += (["| Pagina | Dominio | Sintesi | Aggiornata il |", "|---|---|---|---|", *righe_con] if righe_con
            else ["Nessuna pagina di concetto ancora: l'indice analitico elenca intanto i concetti delle pagine di dominio."])
    idx += ["", "## Altro", "", "- [Indice analitico](indice-analitico.md): concetto → pagine.",
            "- [Registro delle operazioni](log.md): ingest, lint, ritiri, in sola aggiunta.", ""]
    ana = ["# Indice analitico", "", TESTA, "Ogni concetto rimanda alle pagine che lo dichiarano nei metadati (`concetti`).", "",
           "| Concetto | Pagine |", "|---|---|"]
    for c in sorted(concetti):
        ana.append(f"| {c} | " + ", ".join(f"[{n}]({r})" for n, r in sorted(set(concetti[c]))) + " |")
    ana.append("")
    for p, t in (("docs/wiki/index.md", "\n".join(idx)), ("docs/wiki/indice-analitico.md", "\n".join(ana))):
        if pag.get(p) != t:
            nuovi[p] = t
    return nuovi


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    nuovi = genera()
    if a.check:
        for p in sorted(nuovi):
            print(f"  [!!] {p}: da rigenerare (python3 docs/kb/tools/build_wiki.py)")
        print(f"build_wiki: {len(nuovi)} file da rigenerare")
        return 1 if nuovi else 0
    for p, t in nuovi.items():
        with open(os.path.join(ROOT, p), "w", encoding="utf-8", newline="\n") as f:
            f.write(t)
    print(f"build_wiki: {len(nuovi)} file riscritti")
    return 0


if __name__ == "__main__":
    sys.exit(main())
