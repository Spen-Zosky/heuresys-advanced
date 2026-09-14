#!/usr/bin/env python3
"""stato.py — aggiorna UNA riga di STATO.md con un comando corto (V2: niente heredoc).

Uso:
  python tools/stato.py <voce> campo=valore [campo=valore ...]
  campi: stato presa_da presa_il ultimo_passo_chiuso prossimo_passo migrazione_prenotata evidenza nota
  valori speciali: `ora` per presa_il (= adesso, ISO ai minuti) · `sid` per presa_da (= .handoff/session-id) · `-` per svuotare
  --appendi-nota "testo": accoda alla nota invece di sostituirla
Esce 1 se la voce non esiste o un campo non e' fra i nove. Riscrive solo quella riga.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
REPO = os.path.dirname(os.path.dirname(RADICE_K))
STATO = os.path.join(RADICE_K, "STATO.md")
CAMPI = ["voce", "stato", "presa_da", "presa_il", "ultimo_passo_chiuso", "prossimo_passo",
         "migrazione_prenotata", "evidenza", "nota"]


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    voce, mods = argv[0], {}
    appendi = None
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--appendi-nota":
            appendi = argv[i + 1]
            i += 2
            continue
        if "=" not in a:
            print(f"argomento non riconosciuto: {a}")
            return 1
        k, v = a.split("=", 1)
        if k not in CAMPI[1:]:
            print(f"campo sconosciuto: {k} (ammessi: {', '.join(CAMPI[1:])})")
            return 1
        if v == "ora":
            v = datetime.now().astimezone().isoformat(timespec="minutes")
        elif v == "sid":
            with open(os.path.join(REPO, ".handoff", "session-id"), encoding="utf-8") as fh:
                v = fh.read().strip()
        elif v == "-":
            v = ""
        mods[k] = v
        i += 1
    with open(STATO, encoding="utf-8") as fh:
        righe = fh.read().split("\n")
    trovata = False
    for n, r in enumerate(righe):
        if not r.startswith("| "):
            continue
        celle = [c.strip() for c in r.strip().strip("|").split("|")]
        if len(celle) != 9 or celle[0] != voce:
            continue
        d = dict(zip(CAMPI, celle))
        d.update(mods)
        if appendi:
            d["nota"] = (d["nota"] + "; " if d["nota"] else "") + appendi
        righe[n] = "| " + " | ".join(d[c] for c in CAMPI) + " |"
        trovata = True
        print(righe[n])
        break
    if not trovata:
        print(f"voce non trovata in STATO.md: {voce}")
        return 1
    with open(STATO, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(righe))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
