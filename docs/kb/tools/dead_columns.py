#!/usr/bin/env python3
"""
dead_columns.py — triage delle colonne dichiarate e mai riempite.

Una colonna sempre NULL puo' essere due cose molto diverse, e vanno separate
prima di decidere che farne:

  A. FUNZIONE MAI IMPLEMENTATA — la colonna esiste nello schema, e nessuna riga
     di codice la nomina. Nessuno la scrive, nessuno la legge. Candidata a
     essere rimossa da una migrazione, o a diventare una funzionalita' vera.

  B. LACUNA DI POPOLAMENTO — il codice la conosce (la seleziona, la mappa, la
     tipizza) ma nel database e' vuota. Qui il difetto e' nei dati o nel flusso
     che dovrebbe riempirla: l'interfaccia mostra un campo perennemente vuoto.

Il criterio e' misurabile, non a occhio: la presenza del nome nel sorgente di
`apps/api` e `packages/shared`, nelle stesse tre forme usate da exposure_columns.py.

Uso:
    python docs/kb/tools/dead_columns.py             # sintesi + elenco per classe
    python docs/kb/tools/dead_columns.py --json <f>
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

# docs/kb/tools/ -> la radice del repo e' tre livelli sopra (derivata, non scritta).
QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("HRX_REPO", os.path.dirname(os.path.dirname(os.path.dirname(QUI))))
SORGENTI = [os.path.join(REPO, "apps", "api", "src"),
            os.path.join(REPO, "packages", "shared", "src")]
IGNORA = {"created_at", "updated_at", "created_by", "updated_by", "deleted_at", "deleted_by"}

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"), "-At", "-F", "\t"]


def colonne_morte() -> list[tuple[str, str, int]]:
    e = subprocess.run(PSQL + ["-c", """
        SELECT s.tablename, s.attname, t.n_live_tup
        FROM pg_stats s
        JOIN pg_stat_user_tables t ON t.schemaname=s.schemaname AND t.relname=s.tablename
        WHERE s.schemaname='sys' AND s.null_frac=1 AND t.n_live_tup != 0
        ORDER BY t.n_live_tup DESC, 1, 2
    """], capture_output=True, text=True)
    if e.returncode != 0:
        sys.exit(f"psql ha fallito: {e.stderr.strip()}")
    out = []
    for riga in e.stdout.strip().splitlines():
        tab, col, righe = riga.split("\t")
        if col not in IGNORA:
            out.append((tab, col, int(righe)))
    return out


def sorgente() -> str:
    pezzi = []
    for radice in SORGENTI:
        for cartella, _, file in os.walk(radice):
            for nome in file:
                if nome.endswith((".ts", ".tsx")):
                    with open(os.path.join(cartella, nome), encoding="utf-8",
                              errors="replace") as f:
                        pezzi.append(f.read())
    return "\n".join(pezzi)


def camel(s: str) -> str:
    p = s.split("_")
    return p[0] + "".join(x.capitalize() for x in p[1:])


def prefisso(tabella: str) -> str:
    base = tabella[4:] if tabella.startswith("sys_") else tabella
    for fine, sost in (("ies", "y"), ("ses", "s"), ("s", "")):
        if base.endswith(fine):
            return base[: len(base) - len(fine)] + sost
    return base


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json")
    a = p.parse_args()

    morte, testo = colonne_morte(), sorgente()
    mai_implementate, lacune = [], []
    for tab, col, righe in morte:
        pre = prefisso(tab)
        nudo = col[len(pre) + 1:] if col.startswith(pre + "_") else col
        forme = {col, camel(col), nudo, camel(nudo)}
        nota = any(re.search(rf"\b{re.escape(f)}\b", testo) for f in forme if len(f) > 2)
        (lacune if nota else mai_implementate).append((tab, col, righe))

    print(f"colonne sempre NULL su tabelle popolate : {len(morte)}")
    print(f"  A. funzione mai implementata (ignota al codice) : {len(mai_implementate)}")
    print(f"  B. lacuna di popolamento (il codice la conosce) : {len(lacune)}")
    for titolo, gruppo in (("A. FUNZIONE MAI IMPLEMENTATA", mai_implementate),
                           ("B. LACUNA DI POPOLAMENTO", lacune)):
        print(f"\n{titolo}")
        for tab, col, righe in gruppo:
            print(f"  {tab:46s} {col:52s} {righe:7d} righe")
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"mai_implementate": [{"tabella": t, "colonna": c, "righe": r}
                                            for t, c, r in mai_implementate],
                       "lacune_popolamento": [{"tabella": t, "colonna": c, "righe": r}
                                              for t, c, r in lacune]}, f, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
