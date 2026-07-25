#!/usr/bin/env python3
"""zp_evidence - il blocco di evidenza live richiesto da ADR-0026.

Nessun cluster si chiude perche' i test sono verdi: serve una dimostrazione su dati
reali. Questo script esegue il comando, ne cattura l'output davvero prodotto, e scrive
il blocco canonico con comando, output, path assoluto e timestamp. Non si puo' scrivere
a memoria un blocco che questo script non ha generato: l'output e' quello vero.

Sottocomandi
    registra   esegue un comando e registra la prova per un cluster
    mostra     stampa le prove registrate per un cluster
    valida     verifica che il cluster abbia due prove su livelli diversi
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import RADICE, ZPDIR  # noqa: E402
from zp_gate import LIVELLO, coppia_ammessa  # noqa: E402

PROVE = ZPDIR / 'prove'
MAX_OUTPUT = 2000


def _file_cluster(cluster: str) -> Path:
    PROVE.mkdir(parents=True, exist_ok=True)
    return PROVE / f'{cluster}.json'


# Il tipo di prova deve corrispondere a cio' che il comando FA (review S1030). Prima era
# autodichiarato e mai confrontato: `--tipo e2e --comando "echo login reale: OK"` veniva
# accettato, e due `echo` bastavano a soddisfare la Definition of Done. Il docstring
# prometteva l'opposto («non si puo' scrivere a memoria un blocco che questo script non ha
# generato»): era vero per l'output, falso per l'etichetta.
IMPRONTE = {
    'e2e':         r'playwright|test:e2e|\bcypress\b',
    'integration': r'vitest|pnpm\s+test|jest|--run\b.*test',
    'unit':        r'vitest|pnpm\s+test|jest|unittest|pytest',
    'staticcheck': r'typecheck|tsc\b|eslint|\blint\b|mypy|ruff',
    'psql':        r'\bpsql\b|\bpg_dump\b|\bpsql\.exe\b',
    'live':        r'\bcurl\b|\bhttp\b|\bgh\b\s|\bssh\b|\bsystemctl\b|\bjournalctl\b',
    'runtime':     r'\bcurl\b|\bssh\b|\bsystemctl\b|\bjournalctl\b|\bdocker\b|\bps\b\s',
    'build':       r'\bbuild\b|\bnext build\b|\btsup\b|\bpnpm\s+build\b',
}
# `echo`, `printf`, `true`, `:` non sono prove di nulla, con nessuna etichetta.
FINTE = r'^\s*(echo|printf|true|:|cat\s+<<)\b'


def _impronta_ok(tipo: str, comando: str) -> tuple[bool, str]:
    if re.search(FINTE, comando.strip(), flags=re.IGNORECASE):
        return False, ('il comando non esegue niente (echo/printf/true): '
                       'non e una prova, con nessuna etichetta')
    attesa = IMPRONTE.get(tipo)
    if not attesa:
        return True, ''
    if re.search(attesa, comando, flags=re.IGNORECASE):
        return True, ''
    return False, (f'il comando non somiglia a una prova di tipo "{tipo}" '
                   f'(attesi indizi: {attesa}). Usa il tipo giusto o il comando giusto.')


def registra(cluster: str, tipo: str, comando: str, path_rif: str, cwd: str | None) -> int:
    if tipo not in LIVELLO:
        print(f'tipo di prova sconosciuto: {tipo}. Vedi `zp_gate.py tipi`', file=sys.stderr)
        return 2
    ok, perche = _impronta_ok(tipo, comando)
    if not ok:
        print(f'PROVA RIFIUTATA: {perche}', file=sys.stderr)
        return 2
    dove = Path(cwd).resolve() if cwd else RADICE
    inizio = datetime.now()
    # encoding esplicito: senza, i sottoprocessi ereditano cp1252 su Windows e un semplice
    # apice tipografico nell'output di pnpm/vitest/psql faceva morire il reader-thread —
    # la prova finiva registrata VERDE e VUOTA, che e' il peggior esito possibile.
    esito = subprocess.run(comando, cwd=dove, shell=True, capture_output=True,
                           text=True, encoding='utf-8', errors='replace')
    uscita = (esito.stdout or '') + (('\n[stderr]\n' + esito.stderr) if esito.stderr else '')
    uscita = uscita.strip()
    if not uscita:
        print('PROVA RIFIUTATA: il comando non ha prodotto output. '
              'Una prova senza output non dimostra nulla.', file=sys.stderr)
        return 2
    troncato = len(uscita) > MAX_OUTPUT
    if troncato:
        uscita = uscita[:MAX_OUTPUT] + f'\n... [troncato, {len(uscita)} caratteri in tutto]'

    prova = {
        'tipo': tipo,
        'livello': LIVELLO[tipo],
        'comando': comando,
        'cwd': str(dove),
        'path': str(Path(path_rif).resolve()) if path_rif else '',
        'exit': esito.returncode,
        'timestamp': inizio.isoformat(timespec='seconds'),
        'durata_s': round((datetime.now() - inizio).total_seconds(), 1),
        'output': uscita,
    }

    f = _file_cluster(cluster)
    dati = json.loads(f.read_text(encoding='utf-8')) if f.is_file() else {'cluster': cluster, 'prove': []}
    dati['prove'] = [p for p in dati['prove'] if p['tipo'] != tipo] + [prova]
    f.write_text(json.dumps(dati, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(blocco(prova))
    if esito.returncode != 0:
        print(f'\nATTENZIONE: il comando e uscito con {esito.returncode}. '
              f'Una prova rossa non chiude niente: e un errore da correggere.')
    return esito.returncode


def blocco(p: dict) -> str:
    righe = ['verified-by:',
             f"  tipo:      {p['tipo']} (livello: {p.get('livello', '?')})",
             f"  comando:   {p['comando']}",
             f"  cwd:       {p['cwd']}"]
    if p.get('path'):
        righe.append(f"  path:      {p['path']}")
    righe.append(f"  exit:      {p['exit']}")
    righe.append(f"  timestamp: {p['timestamp']}")
    estratto = [r for r in (p.get('output') or '').split('\n') if r.strip()][-6:]
    righe.append('  output:')
    for r in estratto:
        righe.append(f'    {r[:160]}')
    return '\n'.join(righe)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    pr = sub.add_parser('registra')
    pr.add_argument('cluster')
    pr.add_argument('--tipo', required=True)
    pr.add_argument('--comando', required=True)
    pr.add_argument('--path', default='')
    pr.add_argument('--cwd', default=None)

    pm = sub.add_parser('mostra'); pm.add_argument('cluster')
    pv = sub.add_parser('valida'); pv.add_argument('cluster')

    a = ap.parse_args()

    if a.cmd == 'registra':
        return registra(a.cluster, a.tipo, a.comando, a.path, a.cwd)

    f = _file_cluster(a.cluster)
    if not f.is_file():
        print(f'nessuna prova registrata per {a.cluster}')
        return 1
    dati = json.loads(f.read_text(encoding='utf-8'))

    if a.cmd == 'mostra':
        for p in dati['prove']:
            print(blocco(p)); print()
        return 0

    prove = dati['prove']
    if len(prove) < 2:
        print(f'{a.cluster}: solo {len(prove)} prova. Ne servono due, su livelli diversi.')
        return 1
    rosse = [p for p in prove if p['exit'] != 0]
    if rosse:
        print(f"{a.cluster}: {len(rosse)} prove rosse. Vanno corrette, non ignorate.")
        return 1
    tipi = [p['tipo'] for p in prove]
    for i in range(len(tipi)):
        for j in range(i + 1, len(tipi)):
            ok, motivo = coppia_ammessa(tipi[i], tipi[j])
            if ok:
                print(f'{a.cluster}: coppia valida - {motivo}')
                print(f"prove registrate: {', '.join(tipi)}")
                return 0
    print(f"{a.cluster}: RIFIUTATO - nessuna coppia su livelli diversi fra {', '.join(tipi)}")
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
