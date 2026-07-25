#!/usr/bin/env python3
"""zp_selftest - i test di accettazione del zero-pending-loop (design §11).

Verifica i comportamenti, non che i pezzi rispondano: quello lo fa lo smoke test.
Idempotente e senza effetti: crea i suoi artefatti in .zp/selftest e li rimuove.

Quattro dei nove test richiedono una sessione claude viva (bootstrap che non ri-censisce,
freno a meta' lavoro, troncamento da budget, frontiere della description). Vengono
elencati come DA-FARE-A-MANO invece di essere finti verdi: un test che non gira e non lo
dice e' peggio di un test assente.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import RADICE, ZPDIR, carica_config, carica_piano, candidati, verifica  # noqa: E402
from zp_gate import coppia_ammessa  # noqa: E402

ESITI = []


def prova(nome: str, condizione: bool, dettaglio: str = '') -> None:
    ESITI.append((nome, condizione, dettaglio))


def da_fare_a_mano(nome: str, come: str) -> None:
    ESITI.append((nome, None, come))


def main() -> int:
    cfg = carica_config()
    clusters = carica_piano(cfg)
    aperti = [c for c in clusters if not c.chiuso]

    # 1 - il piano e' integro
    rilievi = [r for r in verifica(clusters, cfg) if 'senza classe' not in r]
    prova('1 piano integro', not rilievi,
          'nessun rilievo' if not rilievi else f'{len(rilievi)} rilievi')

    # 2 - ogni cluster aperto ha una classe
    senza = [c.id for c in aperti if not c.classe]
    prova('2 tutti classificati', not senza,
          'tutti' if not senza else f'{len(senza)} senza classe: {senza[:3]}')

    # 3 - il rifiuto delle prove omogenee
    casi = [(('integration', 'integration'), False), (('integration', 'e2e'), False),
            (('live', 'psql'), False), (('integration', 'psql'), True),
            (('integration', 'unit'), True), (('migrate2', 'dbvalidate'), True)]
    sbagliati = [c for c, atteso in casi if coppia_ammessa(*c)[0] != atteso]
    prova('3 coppie di prove', not sbagliati,
          f'{len(casi)} casi, tutti corretti' if not sbagliati else f'sbagliati: {sbagliati}')

    # 4 - la classe D non entra in corsia safe
    d_aperti = [c for c in aperti if c.classe == 'D']
    scelti = {c.id for c in candidati(clusters, cfg, 'safe')}
    intrusi = [c.id for c in d_aperti if c.id in scelti]
    prova('4 classe D fuori da safe', not intrusi,
          f'{len(d_aperti)} cluster D, nessuno eleggibile' if not intrusi
          else f'INTRUSI: {intrusi}')

    # 5 - la classe C entra in full ma non in safe
    c_aperti = [c for c in aperti if c.classe == 'C']
    in_full = {x.id for x in candidati(clusters, cfg, 'full')}
    fuori_safe = all(c.id not in scelti for c in c_aperti)
    dentro_full = any(c.id in in_full for c in c_aperti) if c_aperti else True
    prova('5 classe C solo in full', fuori_safe and dentro_full,
          f'{len(c_aperti)} cluster C: fuori da safe={fuori_safe}, dentro full={dentro_full}')

    # 6 - la corsia safe produce candidati veri, tutti A o B
    classi_scelte = {c.classe for c in candidati(clusters, cfg, 'safe')}
    prova('6 safe seleziona solo A e B', classi_scelte <= {'A', 'B'} and classi_scelte,
          f'classi selezionate: {sorted(classi_scelte) or "nessuna"}')

    # 7 - la classe E non e' mai eleggibile, in nessuna corsia
    e_ids = {c.id for c in aperti if c.classe == 'E'}
    prova('7 classe E mai eleggibile', not (e_ids & (scelti | in_full)),
          f'{len(e_ids)} cluster nel vassoio, nessuno selezionato')

    # 8 - le dipendenze aperte bloccano
    chiusi = {c.id for c in clusters if c.chiuso}
    violazioni = [c.id for c in candidati(clusters, cfg, 'full')
                  if [d for d in c.dipende_da if d not in chiusi]]
    prova('8 dipendenze rispettate', not violazioni,
          'nessun candidato con dipendenze aperte' if not violazioni else str(violazioni))

    # 9 - il primo candidato appartiene all'ondata piu' bassa disponibile
    lista = candidati(clusters, cfg, 'safe')
    if lista:
        onde = sorted({c.onda for c in lista})
        prova('9 ordine per ondata', lista[0].onda == onde[0],
              f'primo: {lista[0].id} ({lista[0].onda}); ondate disponibili: {onde}')
    else:
        prova('9 ordine per ondata', False, 'nessun candidato in safe')

    # 10 - la condizione di fine non e' raggiunta (c'e' ancora lavoro)
    r = subprocess.run([sys.executable, 'docs/kb/tools/zp_zero_check.py', '--no-net', '--no-db'],
                       cwd=RADICE, capture_output=True, text=True)
    prova('10 condizione di fine non raggiunta', r.returncode == 1,
          f'exit {r.returncode} (1 = c\'e ancora lavoro, corretto)')

    da_fare_a_mano('bootstrap non ri-censisce', 'serve una sessione viva: /zero-pending-loop bootstrap')
    da_fare_a_mano('freno a meta lavoro', 'serve una corsa vera: zp ferma mentre gira')
    da_fare_a_mano('troncamento da budget', 'serve una corsa vera con --max-budget-usd basso')
    da_fare_a_mano('frontiere della description', 'servono le 8 esche di evals/trigger-eval.json')

    larghezza = max(len(n) for n, _, _ in ESITI)
    passati = falliti = 0
    for nome, esito, dett in ESITI:
        if esito is None:
            print(f'[a mano ] {nome:<{larghezza}}  {dett}')
        elif esito:
            passati += 1
            print(f'[PASSA  ] {nome:<{larghezza}}  {dett}')
        else:
            falliti += 1
            print(f'[FALLISCE] {nome:<{larghezza}}  {dett}')
    print(f'\n{passati} passati, {falliti} falliti, 4 da fare a mano con una sessione viva')
    return 1 if falliti else 0


if __name__ == '__main__':
    raise SystemExit(main())
