#!/usr/bin/env python3
"""
check_exposure.py — il cancello di ESPOSIZIONE.

Regola (Enzo, 2026-07-28, vincolante e retroattiva su tutti i cluster):
un dato che nessuna API espone non è nel prodotto, è solo nel database. Alla
chiusura di ogni cluster del programma storia36 — e di qualunque lavoro che
popoli tabelle — le lacune di esposizione vanno colmate: endpoint, schema
condiviso, query, wiring.

Questo strumento rende la regola VERIFICABILE invece che augurabile: deriva
dal repository quali tabelle il programma scrive e quali di quelle nessun
modulo dell'API legge, e fallisce (exit 1) se ne resta anche una sola.

Non contiene liste scritte a mano: le tabelle scritte si ricavano dai seed, le
letture dal sorgente dell'API, i conteggi dal database vivo.

Uso:
    python docs/kb/tools/check_exposure.py            # con conteggi live
    python docs/kb/tools/check_exposure.py --no-db    # senza tunnel
    python docs/kb/tools/check_exposure.py --json     # esito per altri strumenti

Deroghe: una tabella può restare non esposta solo se dichiarata in
`docs/kb/tools/exposure_waivers.txt` con una motivazione sulla stessa riga
(formato `nome_tabella  # motivo`). Una deroga senza motivo non è una deroga.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import subprocess
import sys

RADICE = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                        capture_output=True, text=True).stdout.strip()
SEEDS = os.path.join(RADICE, "db", "seeds", "storia36")
API = os.path.join(RADICE, "apps", "api", "src")
DEROGHE = os.path.join(RADICE, "docs", "kb", "tools", "exposure_waivers.txt")

CLUSTER_DA_PREFISSO = {"00": "C0", "01": "C1", "02": "C2", "03": "C3", "04": "C4",
                       "05": "C5", "06": "C6", "07": "C7", "08": "C8", "09": "C9",
                       "10": "C10", "11": "C11", "12": "C12"}


def tabelle_scritte() -> dict[str, set[str]]:
    """Le tabelle che i seed del programma scrivono, con i cluster che le toccano."""
    esito: dict[str, set[str]] = collections.defaultdict(set)
    if not os.path.isdir(SEEDS):
        return esito
    for nome in sorted(os.listdir(SEEDS)):
        if not nome.endswith(".sql"):
            continue
        cluster = CLUSTER_DA_PREFISSO.get(nome[:2], "?")
        testo = open(os.path.join(SEEDS, nome), encoding="utf-8", errors="replace").read()
        for m in re.finditer(r"\b(?:INSERT\s+INTO|UPDATE)\s+sys\.(sys_\w+)", testo, re.I):
            esito[m.group(1)].add(cluster)
    return esito


def tabelle_lette() -> dict[str, set[str]]:
    """Le tabelle che il sorgente dell'API legge, col modulo che le legge."""
    esito: dict[str, set[str]] = collections.defaultdict(set)
    for base, _dirs, files in os.walk(API):
        for f in files:
            if not f.endswith(".ts"):
                continue
            p = os.path.join(base, f)
            rel = os.path.relpath(p, API).replace("\\", "/")
            modulo = rel.split("/")[1] if rel.startswith("modules/") else rel.split("/")[0]
            testo = open(p, encoding="utf-8", errors="replace").read()
            for m in re.finditer(r"\b(?:FROM|JOIN)\s+sys\.(sys_\w+)", testo, re.I):
                esito[m.group(1)].add(modulo)
    return esito


def deroghe() -> dict[str, str]:
    """Tabelle esplicitamente esentate, con il motivo. Senza motivo non vale."""
    esito: dict[str, str] = {}
    if not os.path.exists(DEROGHE):
        return esito
    for riga in open(DEROGHE, encoding="utf-8"):
        riga = riga.strip()
        if not riga or riga.startswith("#"):
            continue
        if "#" not in riga:
            continue  # deroga senza motivo: ignorata di proposito
        tabella, motivo = riga.split("#", 1)
        if tabella.strip():
            esito[tabella.strip()] = motivo.strip()
    return esito


def conteggi(tabelle: list[str]) -> dict[str, int]:
    if not tabelle:
        return {}
    sql = " UNION ALL ".join(
        f"SELECT '{t}' AS t, count(*)::text AS n FROM sys.{t}" for t in tabelle)
    try:
        out = subprocess.run(
            ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys",
             "-d", "heuresys_advanced", "-X", "-tA", "-F", "|", "-c", sql],
            capture_output=True, text=True, timeout=120)
    except Exception:
        return {}
    esito = {}
    for r in out.stdout.strip().splitlines():
        if "|" in r:
            t, n = r.split("|", 1)
            try:
                esito[t] = int(n)
            except ValueError:
                pass
    return esito


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-db", action="store_true", help="salta i conteggi live")
    ap.add_argument("--json", action="store_true", help="esito in JSON")
    args = ap.parse_args()

    scritte = tabelle_scritte()
    lette = tabelle_lette()
    esentate = deroghe()
    tab = sorted(scritte)
    righe = {} if args.no_db else conteggi(tab)

    scoperte, coperte, con_deroga = [], [], []
    for t in tab:
        voce = {"tabella": t, "cluster": sorted(scritte[t]),
                "righe": righe.get(t), "moduli": sorted(lette.get(t, []))}
        if voce["moduli"]:
            coperte.append(voce)
        elif t in esentate:
            voce["deroga"] = esentate[t]
            con_deroga.append(voce)
        else:
            scoperte.append(voce)

    if args.json:
        print(json.dumps({"scoperte": scoperte, "con_deroga": con_deroga,
                          "coperte": len(coperte)}, indent=2, ensure_ascii=False))
        return 1 if scoperte else 0

    print("=" * 84)
    print(" CANCELLO DI ESPOSIZIONE — cosa il programma scrive e cosa l'API espone")
    print("=" * 84)
    print(f"\n  tabelle scritte dal programma : {len(tab)}")
    print(f"  lette da almeno un modulo API : {len(coperte)}")
    print(f"  esentate con motivo dichiarato: {len(con_deroga)}")
    print(f"  NON ESPOSTE                   : {len(scoperte)}\n")

    for v in con_deroga:
        r = "?" if v["righe"] is None else v["righe"]
        print(f"  [deroga] {v['tabella']:44} {r:>8} righe — {v['deroga']}")
    if con_deroga:
        print()

    for v in scoperte:
        r = "?" if v["righe"] is None else v["righe"]
        print(f"  [SCOPERTA] {v['tabella']:42} {','.join(v['cluster']):8} {r:>8} righe")

    if scoperte:
        print("\n  Servono endpoint, schema condiviso, query e wiring — oppure una deroga")
        print(f"  motivata in {os.path.relpath(DEROGHE, RADICE)}.\n")
        return 1

    print("  Nessuna lacuna di esposizione.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
