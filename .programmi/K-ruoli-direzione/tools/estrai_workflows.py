#!/usr/bin/env python3
"""estrai_workflows.py — F0.7: copia in workflows/ i blocchi ```js del mandato, ESATTAMENTE come sono
scritti, uno per file, col nome che il mandato assegna a ciascuno (dal campo meta.name).
Non inventa nulla: se un blocco non ha un nome noto, si ferma e lo dice (exit 1)."""
from __future__ import annotations

import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
MANDATO = os.path.join(os.path.dirname(RADICE_K), "mandati", "K-mandato-v2.md")
OUT = os.path.join(RADICE_K, "workflows")
NOMI = {
    "k-w0-censimento": "W0_censimento.js",
    "k-w1-indagini": "W1_indagini.js",
    "k-w2-classificazione": "W2_classificazione.js",
    "k-w3-confutazione-adr": "W3_confutazione_adr.js",
    "k-w4-audit-ruolo": "W4_audit_ruolo.js",
}


def main() -> int:
    testo = open(MANDATO, encoding="utf-8").read().replace("\r\n", "\n")
    blocchi = re.findall(r"^```js\n(.*?)^```", testo, flags=re.S | re.M)
    os.makedirs(OUT, exist_ok=True)
    scritti = []
    for b in blocchi:
        m = re.search(r"name:\s*'([^']+)'", b)
        if not m or m.group(1) not in NOMI:
            print(f"blocco senza nome noto: {b[:80]!r}")
            return 1
        p = os.path.join(OUT, NOMI[m.group(1)])
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(b)
        scritti.append((NOMI[m.group(1)], b.count("\n")))
    for n, r in scritti:
        print(f"{n:<28} {r} righe")
    print(f"{len(scritti)} blocchi su {len(NOMI)} attesi")
    return 0 if len(scritti) == len(NOMI) else 1


if __name__ == "__main__":
    sys.exit(main())
