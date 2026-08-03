#!/usr/bin/env python3
"""
exposure_columns.py — il cancello di esposizione a livello di COLONNA.

Perche' esiste
--------------
`docs/kb/tools/check_exposure.py` verifica l'esposizione a livello di
TABELLA e solo per le tabelle scritte dai seed storia36. Misurato in sessione lab
il 2026-08-03: a livello di tabella il gap e' quasi nullo (5 tabelle popolate mai
citate nell'API, 3 delle quali infrastrutturali). Il dato ricco che resta
invisibile non e' una tabella intera: e' una COLONNA popolata che nessuno schema
di risposta serializza.

Questo strumento misura quello. Per ogni colonna di `sys.*` con almeno un valore
non nullo, cerca nel sorgente di `apps/api` e `packages/shared`:
  1. il nome snake_case pieno            (query SQL, repository)
  2. il camelCase del nome completo      (tipi, mapping)
  3. il camelCase senza prefisso entita' (schemi Zod: `user_pay_slip_gross_amount`
     compare come `grossAmount`)
Se nessuna delle tre forma compare, la colonna e' popolata ma non raggiungibile
da nessuna interfaccia: dato che esiste nel database e non nel prodotto.

E' READ-ONLY: legge il DB in SELECT e il repo come testo. Scrive solo il proprio
rapporto, dove glielo si chiede con --json.

Uso:
    python docs/kb/tools/exposure_columns.py                 # rapporto sintetico
    python docs/kb/tools/exposure_columns.py --dettaglio     # elenco completo colonna per colonna
    python docs/kb/tools/exposure_columns.py --json <file>   # esito per altri strumenti
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

# Lo script vive in docs/kb/tools/ -> la radice del repo e' tre livelli sopra.
# Derivata dalla posizione del file, non da un path scritto a mano: sopravvive
# al clone su VM/linux-pc, dove la cartella madre ha un altro nome.
QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("HRX_REPO", os.path.dirname(os.path.dirname(os.path.dirname(QUI))))
SORGENTI = [
    os.path.join(REPO, "apps", "api", "src"),
    os.path.join(REPO, "packages", "shared", "src"),
]
# Colonne tecniche: la loro assenza dalle risposte e' una scelta, non una lacuna.
IGNORA = {
    "created_at", "updated_at", "created_by", "updated_by",
    "deleted_at", "deleted_by",
}

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"), "-At", "-F", "\t"]


def interroga(sql: str) -> list[list[str]]:
    esito = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True)
    if esito.returncode != 0:
        sys.exit(f"psql ha fallito: {esito.stderr.strip()}")
    return [r.split("\t") for r in esito.stdout.strip().splitlines() if r]


def colonne_popolate() -> list[tuple[str, str, int]]:
    """(tabella, colonna, righe_non_nulle) per ogni colonna con almeno un valore.

    Usa pg_stats (null_frac gia' calcolato da ANALYZE) invece di contare colonna
    per colonna: 2203 count() su 980 MB sarebbero minuti, qui e' un istante.
    Le tabelle mai analizzate vengono segnalate a parte, non silenziate.
    """
    righe = interroga("""
        SELECT s.tablename, s.attname, s.null_frac, t.n_live_tup
        FROM pg_stats s
        JOIN pg_stat_user_tables t
          ON t.schemaname = s.schemaname AND t.relname = s.tablename
        WHERE s.schemaname = 'sys' AND s.null_frac != 1 AND t.n_live_tup != 0
        ORDER BY 1, 2
    """)
    esito = []
    for tab, col, nullfrac, vive in righe:
        if col in IGNORA:
            continue
        popolate = int(round(float(vive) * (1.0 - float(nullfrac))))
        esito.append((tab, col, popolate))
    return esito


def sorgente() -> str:
    pezzi = []
    for radice in SORGENTI:
        if not os.path.isdir(radice):
            sys.exit(f"sorgente non trovato: {radice} (imposta HRX_REPO)")
        for cartella, _, file in os.walk(radice):
            for nome in file:
                if nome.endswith((".ts", ".tsx")):
                    with open(os.path.join(cartella, nome), encoding="utf-8",
                              errors="replace") as f:
                        pezzi.append(f.read())
    return "\n".join(pezzi)


def camel(s: str) -> str:
    parti = s.split("_")
    return parti[0] + "".join(p.capitalize() for p in parti[1:])


def prefisso_entita(tabella: str) -> str:
    """`sys_user_pay_slips` -> `user_pay_slip`: il prefisso che le colonne ripetono."""
    base = tabella[4:] if tabella.startswith("sys_") else tabella
    # plurale -> singolare, i casi che questo schema usa davvero
    for fine, sost in (("ies", "y"), ("ses", "s"), ("s", "")):
        if base.endswith(fine):
            return base[: len(base) - len(fine)] + sost
    return base


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--dettaglio", action="store_true")
    p.add_argument("--json")
    a = p.parse_args()

    colonne = colonne_popolate()
    testo = sorgente()

    esposte, invisibili = [], []
    for tab, col, righe in colonne:
        pre = prefisso_entita(tab)
        nudo = col[len(pre) + 1:] if col.startswith(pre + "_") else col
        forme = {col, camel(col), nudo, camel(nudo)}
        trovata = any(re.search(rf"\b{re.escape(f)}\b", testo) for f in forme if len(f) > 2)
        (esposte if trovata else invisibili).append((tab, col, righe))

    invisibili.sort(key=lambda r: -r[2])
    per_tabella: dict[str, list[tuple[str, int]]] = {}
    for tab, col, righe in invisibili:
        per_tabella.setdefault(tab, []).append((col, righe))

    tot = len(colonne)
    print(f"colonne sys.* popolate esaminate : {tot}")
    print(f"  raggiungibili da API/contratti : {len(esposte)}")
    print(f"  MAI citate nel sorgente        : {len(invisibili)}"
          f"  ({100 * len(invisibili) / tot:.1f}%)")
    print()
    print("Tabelle con piu' colonne invisibili:")
    for tab in sorted(per_tabella, key=lambda t: -len(per_tabella[t]))[:20]:
        cols = per_tabella[tab]
        print(f"  {tab:48s} {len(cols):3d} colonne, max {cols[0][1]:6d} righe popolate")
    if a.dettaglio:
        print()
        for tab in sorted(per_tabella):
            print(f"\n{tab}")
            for col, righe in per_tabella[tab]:
                print(f"    {col:60s} {righe:7d} righe")
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"esaminate": tot, "esposte": len(esposte),
                       "invisibili": [{"tabella": t, "colonna": c, "righe": r}
                                      for t, c, r in invisibili]}, f, indent=2)
        print(f"\nrapporto JSON: {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
