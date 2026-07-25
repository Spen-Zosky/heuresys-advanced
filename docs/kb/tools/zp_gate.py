#!/usr/bin/env python3
"""zp_gate - i controlli, e il rifiuto meccanico delle prove omogenee.

Due lavori distinti.

1) AREE E CONTROLLI. Deriva dal diff reale quali aree sono state toccate e quali
   controlli servono. Un'area toccata e non mappata in zp.config.yaml e' un errore
   bloccante: significa che nessuno ha deciso come verificare quelle modifiche.

2) COPPIA DI PROVE. Verifica che le due prove dichiarate per chiudere un cluster siano
   di natura diversa. Chi scrive il codice ha un punto cieco su cio' che il codice fa:
   due prove della stessa natura lo condividono, due di natura diversa no. Il rifiuto
   e' meccanico apposta - se fosse una raccomandazione, sotto pressione verrebbe aggirata.

Sottocomandi
    aree                     quali aree tocca il diff, e quali controlli servono
    esegui [--dry-run]       esegue i controlli eseguibili delle aree toccate
    prove A B                 la coppia e' ammessa? esce 1 se omogenea
    tipi                     elenca i tipi di prova riconosciuti
"""
from __future__ import annotations

import argparse
import fnmatch
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import RADICE, carica_config  # noqa: E402

# Ogni tipo di prova ha una NATURA. Due prove sono ammesse se le nature differiscono,
# perche' e' la diversita' di natura che rompe il punto cieco condiviso.
NATURA = {
    'integration': 'automatica',      # test d'integrazione sul DB reale
    'unit':        'automatica',      # unit test
    'e2e':         'automatica',      # Playwright con login reale
    'staticcheck': 'statica',         # typecheck + lint
    'live':        'osservazione',    # prova live: comando, output, path, timestamp
    'psql':        'osservazione',    # query sul DB che conferma la mutazione
    'runtime':     'osservazione',    # comportamento verificato a runtime
    'migrate2':    'idempotenza',     # migrazione applicata due volte, diff pg_dump vuoto
    'dbvalidate':  'struttura',       # pnpm db:validate, le 7 viste: coerenza dello schema
}

# L'unica coppia di pari natura ammessa, e per una ragione precisa: non differiscono per
# natura ma per RAGGIUNGIBILITA' - l'unit test copre il ramo che l'integrazione non tocca.
ECCEZIONI = {frozenset({'integration', 'unit'})}

DESCRIZIONE = {
    'integration': "test d'integrazione contro il DB reale via tunnel",
    'unit': "unit test sul ramo che l'integrazione non raggiunge",
    'e2e': 'Playwright end-to-end con login di una persona reale',
    'staticcheck': 'typecheck e lint verdi',
    'live': 'prova live con comando, output, path assoluto e timestamp',
    'psql': 'query psql che conferma la mutazione lato database',
    'runtime': 'comportamento verificato a runtime su endpoint o pagina',
    'migrate2': 'migrazione applicata due volte con diff pg_dump vuoto',
    'dbvalidate': 'pnpm db:validate, le 7 viste',
}


def file_toccati(base: str | None = None) -> list:
    cmd = ['git', 'diff', '--name-only']
    if base:
        cmd.append(base)
    fuori = subprocess.run(cmd, cwd=RADICE, capture_output=True, text=True)
    nomi = [r.strip() for r in fuori.stdout.split('\n') if r.strip()]
    stato = subprocess.run(['git', 'status', '--porcelain'], cwd=RADICE,
                           capture_output=True, text=True)
    for riga in stato.stdout.split('\n'):
        if len(riga) > 3:
            nomi.append(riga[3:].strip().strip('"'))
    return sorted(set(nomi))


def aree_toccate(cfg: dict, nomi: list) -> tuple[dict, list]:
    """Restituisce (area -> controlli, file non coperti da nessuna area)."""
    mappa = cfg.get('gates') or {}
    trovate, scoperti = {}, []
    for nome in nomi:
        colpito = False
        for pattern, controlli in mappa.items():
            if fnmatch.fnmatch(nome, pattern) or nome.startswith(pattern.rstrip('*').rstrip('/')):
                trovate.setdefault(pattern, list(controlli))
                colpito = True
        if not colpito:
            scoperti.append(nome)
    return trovate, scoperti


def _ignorabile(nome: str) -> bool:
    return (nome.startswith('.zp/') or nome.startswith('docs/superpowers/')
            or nome.startswith('.claude/skills/') or nome.endswith('.md'))


def esegui_controlli(controlli: list, dry: bool) -> tuple[int, list]:
    """Esegue i controlli che sono comandi veri. Gli altri li segnala al chiamante."""
    esiti, a_giudizio = [], []
    for c in controlli:
        if not c.split()[0] in ('pnpm', 'python', 'bash', 'npx', 'node'):
            a_giudizio.append(c)
            continue
        if dry:
            print(f'  [dry-run] {c}')
            esiti.append(0)
            continue
        print(f'  > {c}')
        r = subprocess.run(c, cwd=RADICE, shell=True)
        esiti.append(r.returncode)
        if r.returncode != 0:
            print(f'  ROSSO ({r.returncode}): {c}')
    return (max(esiti) if esiti else 0), a_giudizio


def coppia_ammessa(a: str, b: str) -> tuple[bool, str]:
    if a not in NATURA:
        return False, f"tipo di prova sconosciuto: {a}. Usa `zp_gate.py tipi`"
    if b not in NATURA:
        return False, f"tipo di prova sconosciuto: {b}. Usa `zp_gate.py tipi`"
    if a == b:
        return False, (f'coppia omogenea: due volte {a}. Servono due prove di natura '
                       f'diversa - non due esecuzioni della stessa.')
    if frozenset({a, b}) in ECCEZIONI:
        return True, (f'{a} + {b}: stessa natura ma raggiungibilita diversa, '
                      f'ammessa esplicitamente')
    if NATURA[a] == NATURA[b]:
        return False, (f'coppia omogenea: {a} e {b} sono entrambe di natura '
                       f'"{NATURA[a]}". Condividono lo stesso punto cieco.')
    return True, f'{a} ({NATURA[a]}) + {b} ({NATURA[b]}): nature diverse, ammessa'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    pa = sub.add_parser('aree'); pa.add_argument('--base', default=None)
    pe = sub.add_parser('esegui')
    pe.add_argument('--base', default=None)
    pe.add_argument('--dry-run', action='store_true')
    pp = sub.add_parser('prove'); pp.add_argument('a'); pp.add_argument('b')
    sub.add_parser('tipi')
    a = ap.parse_args()

    if a.cmd == 'tipi':
        print('tipo         natura         cosa e')
        for t, n in NATURA.items():
            print(f'{t:12} {n:14} {DESCRIZIONE[t]}')
        print('\nDue prove sono ammesse se le nature differiscono.')
        print('Unica eccezione: integration + unit (raggiungibilita diversa).')
        return 0

    if a.cmd == 'prove':
        ok, motivo = coppia_ammessa(a.a, a.b)
        print(('AMMESSA - ' if ok else 'RIFIUTATA - ') + motivo)
        return 0 if ok else 1

    cfg = carica_config()
    nomi = [n for n in file_toccati(a.base) if not _ignorabile(n)]
    if not nomi:
        print('niente di rilevante toccato: nessun controllo da eseguire')
        return 0
    trovate, scoperti = aree_toccate(cfg, nomi)

    print(f'{len(nomi)} file toccati, {len(trovate)} aree coinvolte')
    for pattern, controlli in trovate.items():
        print(f'\n[{pattern}]')
        for c in controlli:
            print(f'  - {c}')

    if scoperti:
        print(f'\nERRORE BLOCCANTE: {len(scoperti)} file in aree senza controlli mappati '
              f'in zp.config.yaml.')
        for s in scoperti[:15]:
            print(f'  {s}')
        print('Nessuno ha deciso come verificare queste modifiche: mappa l area '
              'prima di proseguire.')
        return 2

    if a.cmd == 'aree':
        return 0

    peggiore, a_giudizio = 0, []
    for pattern, controlli in trovate.items():
        print(f'\n[{pattern}]')
        codice, giudizio = esegui_controlli(controlli, a.dry_run)
        peggiore = max(peggiore, codice)
        a_giudizio.extend(giudizio)
    if a_giudizio:
        print('\nDa eseguire a giudizio (non sono comandi diretti):')
        for g in a_giudizio:
            print(f'  - {g}')
    print(f'\nesito controlli eseguibili: {"VERDE" if peggiore == 0 else "ROSSO"}')
    return peggiore


if __name__ == '__main__':
    raise SystemExit(main())
