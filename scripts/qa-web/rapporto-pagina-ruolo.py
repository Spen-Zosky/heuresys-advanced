#!/usr/bin/env python3
"""Rapporto di un ciclo qa-web: una riga per pagina e ruolo, con i verdetti contati.

Uso: rapporto-pagina-ruolo.py <uscita.tsv> <registro1.sqlite> [<registro2.sqlite> ...]
Una riga per (pagina, persona): pagina con gli identificativi sostituiti da <id>, e i conteggi
di verifiche OK, DIFETTO, NON-APPLICABILE, BLOCCATO e senza verdetto, in tutte le lingue e i
formati dei giri indicati. Non scrive nei registri.
"""
import collections, re, sqlite3, sys

uscita, registri = sys.argv[1], sys.argv[2:]
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
conta = collections.defaultdict(collections.Counter)
for r in registri:
    c = sqlite3.connect(f'file:{r}?mode=ro', uri=True)
    q = """select u.url, u.persona, coalesce(v.verdetto,'SENZA') from verifica v join unita u on u.id=v.unita_id"""
    for url, persona, verdetto in c.execute(q):
        pagina = UUID.sub('<id>', url.split('?')[0])
        conta[(pagina, persona)][verdetto] += 1
colonne = ['OK', 'DIFETTO', 'NON-APPLICABILE', 'BLOCCATO', 'SENZA']
with open(uscita, 'w') as f:
    f.write('pagina\tpersona\t' + '\t'.join(colonne) + '\ttotale\n')
    for (pagina, persona), k in sorted(conta.items()):
        f.write(f'{pagina}\t{persona}\t' + '\t'.join(str(k[x]) for x in colonne) + f'\t{sum(k.values())}\n')
print(f'{len(conta)} coppie pagina-persona, {sum(sum(k.values()) for k in conta.values())} verifiche')
