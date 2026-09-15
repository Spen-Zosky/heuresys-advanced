#!/usr/bin/env python3
"""controlli_per_nome.py — I-C passo 15/16 e baseline del cricchetto S-5.

Conta, per file sotto apps/api/src (esclusi lib/scope/ e config/), le occorrenze di
  (1) predicati per nome:  isPlatformAdmin( | isTenantAdmin( | isHrmsManager( | isPlatform(
  (2) stringhe di codice ruolo fra apici singoli o doppi (i 14 codici del baseline F0.3)
  (3) .roles.includes(
Scrive:
  --baseline <path.json>   il JSON {file: {predicati, stringhe_ruolo, roles_includes, totale}} ordinato per file
  --siti [moduli...]       l'elenco file:riga:testo dei siti nei moduli indicati (o in tutti), per la classificazione
Legge il codice con la stessa disciplina di rg --no-ignore --hidden (cammina il filesystem, non l'indice git).
"""
from __future__ import annotations

import json
import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(QUI)))
SRC = os.path.join(REPO, "apps", "api", "src")
ESCLUSI = (os.path.join("lib", "scope") + os.sep, "config" + os.sep)
RUOLI = ["PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER", "USER",
         "READ_ONLY", "CEO", "TEAM_LEADER", "TEAM_MEMBER", "ORG_DIRECTOR", "WHISTLEBLOWING_CUSTODIAN", "BRANCH_MANAGER"]
RE_PRED = re.compile(r"\b(isPlatformAdmin|isTenantAdmin|isHrmsManager|isPlatform)\(")
RE_RUOLO = re.compile(r"""['"](""" + "|".join(RUOLI) + r""")['"]""")
RE_INCL = re.compile(r"\.roles\.includes\(")


def file_ts():
    for radice, _, nomi in os.walk(SRC):
        for n in nomi:
            if n.endswith(".ts"):
                p = os.path.join(radice, n)
                rel = os.path.relpath(p, SRC).replace("\\", "/")
                if rel.startswith("lib/scope/") or rel.startswith("config/"):
                    continue
                yield rel, p


def conta(testo: str) -> dict:
    return {"predicati": len(RE_PRED.findall(testo)), "stringhe_ruolo": len(RE_RUOLO.findall(testo)),
            "roles_includes": len(RE_INCL.findall(testo))}


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1
    if argv[0] == "--baseline":
        base = {}
        for rel, p in file_ts():
            c = conta(open(p, encoding="utf-8").read())
            c["totale"] = c["predicati"] + c["stringhe_ruolo"] + c["roles_includes"]
            if c["totale"]:
                base[rel] = c
        base = dict(sorted(base.items()))
        open(argv[1], "w", encoding="utf-8", newline="\n").write(json.dumps(base, indent=1, ensure_ascii=False) + "\n")
        tot = {k: sum(v[k] for v in base.values()) for k in ("predicati", "stringhe_ruolo", "roles_includes", "totale")}
        print(f"{len(base)} file con almeno un controllo per nome · {tot}")
        return 0
    if argv[0] == "--siti":
        moduli = argv[1:]
        n = 0
        for rel, p in file_ts():
            if moduli and not any(rel.startswith(f"modules/{m}/") or rel.startswith(m) for m in moduli):
                continue
            for i, riga in enumerate(open(p, encoding="utf-8").read().split("\n"), 1):
                if RE_PRED.search(riga) or RE_RUOLO.search(riga) or RE_INCL.search(riga):
                    print(f"apps/api/src/{rel}:{i}: {riga.strip()[:150]}")
                    n += 1
        print(f"-- {n} siti")
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
