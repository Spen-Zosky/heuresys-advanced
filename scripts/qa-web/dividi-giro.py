#!/usr/bin/env python3
"""Divide un giro qa-web in giri indipendenti per persona, per lavorarli in parallelo.

Uso: dividi-giro.py <giro-origine> <cartella-destinazione> <persona>[,<persona>...]
Copia profilo e registro, toglie dal registro ogni unità (e le sue verifiche e righe di rete)
delle persone non indicate. Il giro nuovo è autonomo: `qa-web esegui` e `qa-web stato` lo
trattano come un giro a parte. Non cancella niente nel giro di origine.
"""
import os, shutil, sqlite3, sys

origine, dest, persone = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
os.makedirs(dest, exist_ok=True)
shutil.copy(os.path.join(origine, 'profilo.json'), dest)
db = os.path.join(dest, 'registro.sqlite')
shutil.copy(os.path.join(origine, 'registro.sqlite'), db)
c = sqlite3.connect(db)
q = ','.join('?' * len(persone))
fuori = f'(select id from unita where persona not in ({q}))'
c.execute(f'delete from verifica where unita_id in {fuori}', persone)
c.execute(f'delete from rete where unita_id in {fuori}', persone)
c.execute(f'delete from unita where persona not in ({q})', persone)
c.commit()
c.execute('vacuum')
n = c.execute("select count(*), sum(stato='da-fare') from unita").fetchone()
print(f'{dest}: {n[0]} unità, {n[1]} in coda')
