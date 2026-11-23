#!/usr/bin/env python3
"""Porta in un giro nuovo i verdetti già dati in un giro vecchio, per chiave.

Uso: eredita-verdetti.py <registro-nuovo> <registro-vecchio> [--scrivi]
Chiave: controllo, esito_auto, nodo_tipo, nodo_nome, dettaglio. Si eredita solo se tutte le
righe giudicate del giro vecchio con quella chiave hanno lo stesso verdetto e la stessa causa
(altrimenti la riga resta da giudicare). Senza --scrivi conta soltanto. La riga ereditata porta
da='ereditato' e la causa originale: nessun verdetto nasce senza traccia.
"""
import sqlite3, sys
from datetime import datetime, timezone

nuovo, vecchio = sys.argv[1], sys.argv[2]
scrivi = '--scrivi' in sys.argv
old = sqlite3.connect(f'file:{vecchio}?mode=ro', uri=True)
K = lambda r: (r[0], r[1], r[2], r[3], r[4])
note = {}
for *k, v, c in old.execute("select controllo,esito_auto,nodo_tipo,nodo_nome,dettaglio,verdetto,causa from verifica where esito_auto='GIUDIZIO' and verdetto is not null"):
    note.setdefault(tuple(k), set()).add((v, c or ''))
unici = {k: next(iter(v)) for k, v in note.items() if len(v) == 1}
db = sqlite3.connect(nuovo)
ora = datetime.now(timezone.utc).isoformat()
righe = db.execute("select id,controllo,esito_auto,nodo_tipo,nodo_nome,dettaglio from verifica where verdetto is null and esito_auto='GIUDIZIO'").fetchall()
n = 0
for r in righe:
    e = unici.get(tuple(r[1:]))
    if e:
        n += 1
        if scrivi:
            db.execute("update verifica set verdetto=?, causa=?, da='ereditato', quando=? where id=?", (e[0], (e[1] + ' [ereditato dal giro vecchio]').strip() if e[0] != 'OK' else None, ora, r[0]))
if scrivi: db.commit()
print(f'{nuovo}: da giudicare {len(righe)}, ereditabili {n}, restano {len(righe)-n}' + (' (scritto)' if scrivi else ''))
