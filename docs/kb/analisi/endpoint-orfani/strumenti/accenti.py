#!/usr/bin/env python3
"""accenti.py - sostituisce l'apostrofo usato come accento (e', puo', piu', ...) con la vocale accentata vera.
Lista chiusa di parole: non tocca le elisioni (dell'API, l'utente, un'altra) ne' il codice tra apice."""
import re
PAROLE = {"e": "è", "E": "È", "puo": "può", "piu": "più", "Piu": "Più", "cosi": "così", "Cosi": "Così", "perche": "perché", "Perche": "Perché", "gia": "già", "Gia": "Già",
          "cio": "ciò", "Cio": "Ciò", "ne": "né", "pero": "però", "Pero": "Però", "giu": "giù", "ando": "andò"}
RE = re.compile(r"(?<![\w`/.\-\"])([A-Za-z]+)'(?![A-Za-z0-9`])")
def accenta(s):
    def sost(m):
        w = m.group(1)
        if w in PAROLE: return PAROLE[w]
        if re.search(r"[a-z]{3,}ta$", w) or w in ("Severita", "Raggiungibilita", "citta", "unita", "Unita", "attivita", "Attivita", "universita", "identita", "Identita", "eta", "qualita", "Qualita"):
            return w[:-1] + "à"
        return m.group(0)
    return RE.sub(sost, s)
