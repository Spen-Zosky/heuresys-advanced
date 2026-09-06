#!/usr/bin/env python3
"""Ripara le righe del .env a cui manca l'a-capo.

Una riga che contiene DUE assegnazioni ha inglobato la variabile successiva dentro il
valore della prima: il file resta sintatticamente accettabile — nessun parser protesta —
e la variabile inglobante porta un valore sbagliato. Sul gemello questo ha reso invalida
la chiave del fornitore di embedding (HTTP 401), e ha fatto sparire del tutto la variabile
inglobata.

⚠ Non stampa MAI un valore: solo i NOMI delle variabili separate. Un file di ambiente
contiene segreti, e un rapporto che li mostra è peggio del difetto che descrive.
"""
import re
import sys

p = sys.argv[1] if len(sys.argv) > 1 else ".env"
s = open(p, encoding="utf-8").read()

righe_prima = s.count("\n")
nomi = []


def spezza(m):
    nomi.append(m.group(2).rstrip("="))
    return m.group(1) + "\n" + m.group(2)


# una assegnazione, poi del testo, poi UN'ALTRA assegnazione sulla stessa riga
s2 = re.sub(r"(?m)^([A-Z_][A-Z0-9_]*=[^\n]*?)([A-Z_][A-Z0-9_]{2,}=)", spezza, s)

if s2 == s:
    print("nessuna riga da riparare")
else:
    open(p, "w", encoding="utf-8").write(s2)
    print(f"righe: {righe_prima} -> {s2.count(chr(10))}")
    print("variabili liberate:", ", ".join(nomi))
