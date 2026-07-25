#!/usr/bin/env python3
"""zp_zero_check - la condizione di fine del loop, valutata da uno script e non da un giudizio.

Esce 0 SOLO se tutti i criteri passano. Altrimenti esce 1 e stampa cosa manca.

La condizione non e' "zero pendenze": quella non e' raggiungibile in autonomia, perche'
30 cluster su 253 dipendono da una decisione, un input esterno o un segreto che solo Enzo
puo' dare. La condizione vera e': zero cluster eseguibili da solo ancora aperti, piu' un
vassoio esplicito di cio' che aspetta lui.

    --no-net   salta CI, alert di sicurezza e sonde sugli host
    --no-db    salta i controlli che richiedono il tunnel
    --json     output per il driver
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import (RADICE, carica_config, carica_piano, leggi_interrotti,  # noqa: E402
                      percorso_piano, righe_perse)


def _bash() -> str | None:
    """Git Bash, dalla config. Serve perche' su Windows subprocess(shell=True) usa
    cmd.exe, che non conosce ne' `VAR=valore comando` ne' gli apici singoli: i comandi
    POSIX (ssh con MSYS_NO_PATHCONV, gh con --jq '...') non partono proprio."""
    try:
        p = ((carica_config().get('runtime') or {}).get('bash')) or ''
    except SystemExit:
        p = ''
    return p if p and Path(p).is_file() else None


def _sh(cmd: str, timeout: int = 90) -> tuple[int, str]:
    sh = _bash()
    try:
        if sh:
            r = subprocess.run([sh, '-lc', cmd], cwd=RADICE, capture_output=True,
                               text=True, timeout=timeout)
        else:
            r = subprocess.run(cmd, cwd=RADICE, shell=True, capture_output=True,
                               text=True, timeout=timeout)
        return r.returncode, (r.stdout or '') + (r.stderr or '')
    except subprocess.TimeoutExpired:
        return 124, 'timeout'
    except OSError as e:
        return 125, str(e)


class Esito:
    def __init__(self):
        self.criteri = []

    def aggiungi(self, nome, passa, dettaglio='', saltato=False):
        self.criteri.append({'criterio': nome, 'passa': bool(passa),
                             'saltato': saltato, 'dettaglio': dettaglio})

    @property
    def raggiunta(self) -> bool:
        return all(c['passa'] for c in self.criteri if not c['saltato'])

    @property
    def saltati(self) -> list:
        """Criteri non valutati. Servono a NON dire «finito» quando meta' non e' stata guardata."""
        return [c['criterio'] for c in self.criteri if c['saltato']]


def controlla(no_net: bool, no_db: bool) -> Esito:
    e = Esito()
    cfg = carica_config()
    clusters = carica_piano(cfg)

    # 0 - il piano e' interamente leggibile? (S1030, rilievo B1 della review)
    # Questo criterio viene PRIMA di ogni altro perche' e' l'unico che parla di cio' che
    # manca dall'analisi: tutti gli altri ragionano sui cluster letti, e su una riga che il
    # parser non ha visto non direbbero nulla. Senza, una checkbox APERTA scritta in formato
    # non conforme e' invisibile e questo strumento dichiara «zero pendenze» con lavoro
    # dentro. Non e' teorico: Z-110 e' stato letto 253 su 254 per giorni, e la segnalazione
    # su stderr non basta — il driver reindirizza stderr a /dev/null.
    perse = righe_perse(percorso_piano(cfg).read_text(encoding='utf-8'), clusters)
    e.aggiungi('piano interamente leggibile', not perse,
               'ogni voce e stata letta' if not perse else
               f'{len(perse)} riga/e ignorate dal parser: ' +
               ', '.join(f'{zid}@{n}' for zid, n, _ in perse[:5]))

    # 1 - cluster autonomi ancora aperti
    aperti = [c for c in clusters if not c.chiuso and c.eseguibile_da_solo]
    interrotti = leggi_interrotti()
    e.aggiungi('nessun cluster autonomo aperto', len(aperti) == 0,
               f'{len(aperti)} aperti, {sum(c.effort for c in aperti):.0f}h stimate'
               if aperti else 'nessuno')
    if interrotti:
        e.aggiungi('nessun cluster lasciato a meta', False,
                   ', '.join(f"{k} ({v.get('fallimenti', 1)}x)" for k, v in interrotti.items()))
    else:
        e.aggiungi('nessun cluster lasciato a meta', True)

    # 2 - working tree pulito e allineato a origin
    _, sporco = _sh('git status --porcelain')
    e.aggiungi('working tree pulito', not sporco.strip(),
               f'{len(sporco.strip().splitlines())} file' if sporco.strip() else 'pulito')
    if not no_net:
        _sh('git fetch origin', timeout=60)
    _, conteggio = _sh('git rev-list --left-right --count origin/main...HEAD')
    dietro_avanti = conteggio.split()
    allineato = dietro_avanti == ['0', '0'] if len(dietro_avanti) == 2 else False
    e.aggiungi('allineato a origin/main', allineato, conteggio.strip() or 'non determinabile')

    # 3 - il linter dello stato
    codice, out = _sh('python docs/kb/tools/handoff_lint.py' + (' --no-db' if no_db else ''),
                      timeout=180)
    e.aggiungi('handoff_lint verde', codice == 0,
               out.strip().splitlines()[-1][:160] if out.strip() else f'exit {codice}')

    # 4 - CI verde su ogni workflow
    if no_net:
        e.aggiungi('CI verde', True, 'saltato (--no-net)', saltato=True)
    else:
        codice, out = _sh(
            'gh run list --limit 40 --json name,conclusion,status,headBranch,event', 120)
        if codice != 0:
            e.aggiungi('CI verde', False, 'gh non disponibile o non autenticato')
        else:
            try:
                runs = json.loads(out or '[]')
            except json.JSONDecodeError:
                runs = []
            # Solo cio' che gira su main per un push nostro. I run sui branch di
            # Dependabot non sono la CI del progetto: un security-update che non si
            # puo' applicare (D-75, rischio accettato) resta rosso per sempre e
            # farebbe fallire la condizione di fine in eterno.
            ultimo = {}
            for r in runs:
                if r.get('headBranch') != 'main':
                    continue
                if r.get('event') not in ('push', 'schedule', 'workflow_dispatch'):
                    continue
                ultimo.setdefault(r.get('name'), r)
            rossi = [n for n, r in ultimo.items()
                     if r.get('status') == 'completed' and r.get('conclusion') != 'success']
            aperti_ci = [n for n, r in ultimo.items() if r.get('status') != 'completed']
            # Zero workflow valutati NON e' «tutti verdi» (S1030, rilievo S2): con una
            # finestra piena di run Dependabot, o con `gh` che risponde `[]`, il dizionario
            # resta vuoto e `not rossi and not aperti_ci` era vero. Peggio: `--limit 40` su
            # 12 workflow definiti restituisce 18 nomi distinti, alcuni con un solo run
            # nella finestra — un workflow rosso da due settimane poteva restare fuori.
            # Percio' si pretende di aver visto almeno i workflow che il repo dichiara.
            codice_wf, out_wf = _sh("gh workflow list --json name --jq '.[].name'", 60)
            attesi = {r.strip() for r in out_wf.split('\n') if r.strip()} if codice_wf == 0 else set()
            non_visti = sorted(attesi - set(ultimo)) if attesi else []
            e.aggiungi('CI verde', bool(ultimo) and not rossi and not aperti_ci and not non_visti,
                       (f"rossi: {', '.join(rossi)}" if rossi else '') +
                       (f" in corso: {', '.join(aperti_ci)}" if aperti_ci else '') +
                       (f" mai valutati: {', '.join(non_visti[:4])}" if non_visti else '') or
                       (f'{len(ultimo)} workflow, tutti verdi' if ultimo else
                        'nessun run valutabile nella finestra: non posso dire che sia verde'))

    # 5 - alert di sicurezza aperti
    if no_net:
        e.aggiungi('nessun alert di sicurezza aperto', True, 'saltato (--no-net)', saltato=True)
    else:
        codice, out = _sh(
            'gh api repos/{owner}/{repo}/dependabot/alerts --paginate '
            '--jq ".[]|select(.state==\\"open\\")|.dependency.package.name"', 120)
        if codice != 0:
            e.aggiungi('alert di sicurezza sotto controllo', False,
                       'gh api non raggiungibile: ' + out.strip().splitlines()[-1][:90]
                       if out.strip() else 'gh api non raggiungibile')
        else:
            pacchetti = sorted({r.strip() for r in out.split('\n') if r.strip()})
            # Un alert che non si puo' chiudere non e' una pendenza aperta se il rischio
            # e' stato accettato per iscritto nel registro debiti (es. D-75). Senza questa
            # distinzione la condizione di fine non sarebbe raggiungibile mai.
            #
            # MA il riconoscimento dev'essere STRUTTURATO (S1030, rilievo B4). Cercare il
            # nome del pacchetto come sottostringa in 92.000 caratteri di prosa promuoveva a
            # «rischio accettato» 12 nomi su 30 per pura coincidenza lessicale: `tar` dentro
            # «riparate», `ip` dentro «riparate», `path` dentro «path d'origine», e con loro
            # ws, semver, glob, cookie, next, vite, ms, request, ejs — cioe' proprio le
            # transitive che compaiono piu' spesso negli advisory. Ora il nome deve stare in
            # backtick o come cella di tabella: forme che si scrivono apposta, non per caso.
            reg = RADICE / 'docs' / 'kb' / 'DEBT_REGISTER.md'
            testo = reg.read_text(encoding='utf-8', errors='replace') if reg.is_file() else ''

            def registrato(pkg: str) -> bool:
                import re as _re
                p = _re.escape(pkg)
                return bool(_re.search(rf'`{p}`|`{p}@|\|\s*{p}\s*\||\b{p}@\d', testo))

            non_registrati = [p for p in pacchetti if not registrato(p)]
            e.aggiungi('alert di sicurezza sotto controllo', not non_registrati,
                       (f"{len(non_registrati)} non nel registro debiti: "
                        f"{', '.join(non_registrati[:5])}") if non_registrati else
                       (f'{len(pacchetti)} aperti, tutti con rischio accettato nel registro'
                        if pacchetti else 'nessun alert aperto'))

    # 6 - servizi e sonde sugli host
    if no_net:
        e.aggiungi('servizi PROD sani', True, 'saltato (--no-net)', saltato=True)
    else:
        # `systemctl is-failed` risponde alla domanda sbagliata (S1030, rilievo S1):
        # dice «inactive» — e quindi «non failed» — sia per un servizio FERMO sia per
        # un'unita' che non esiste (nome cambiato, typo). Verificato sulla VM: con l'API
        # spenta l'output era `inactive active` e il criterio passava. Un'API di produzione
        # ferma non e' un servizio sano.
        # Ora: `is-active` deve dire `active` per OGNI unita' attesa, e sopra ci va una
        # sonda HTTP — l'unica prova che il servizio non solo gira, ma risponde.
        host = (cfg.get('hosts') or {}).get('vm', 'oracle-vm-default')
        unita = ['heuresys-advanced-api', 'heuresys-advanced-web']
        codice, out = _sh(
            f"MSYS_NO_PATHCONV=1 ssh {host} 'systemctl is-active {' '.join(unita)} || true'", 90)
        stati = [r.strip() for r in out.strip().split('\n') if r.strip()]
        attivi = len(stati) == len(unita) and all(s == 'active' for s in stati)
        e.aggiungi('servizi PROD attivi', attivi,
                   f"{' '.join(stati) or f'exit {codice}'}"
                   f"{'' if len(stati) == len(unita) else f' (attese {len(unita)} risposte, ne sono arrivate {len(stati)})'}")

        url = (cfg.get('hosts') or {}).get('prod_url', 'https://www.heuresys.com')
        codice, out = _sh(f"curl -s -o /dev/null -w '%{{http_code}}' -m 20 {url}/api/readyz", 40)
        e.aggiungi('PROD risponde', out.strip() == '200', f'/api/readyz -> {out.strip() or codice}')

    return e


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--no-net', action='store_true')
    ap.add_argument('--no-db', action='store_true')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    e = controlla(a.no_net, a.no_db)

    if a.json:
        # Il driver legge SOLO l'exit code di questo ramo. `raggiunta` da sola direbbe di si'
        # anche con meta' dei criteri non eseguiti: la fine del programma si dichiara solo
        # quando tutto e' stato davvero guardato.
        certa = e.raggiunta and not e.saltati
        print(json.dumps({'raggiunta': certa, 'criteri_passati': e.raggiunta,
                          'saltati': e.saltati, 'criteri': e.criteri}, ensure_ascii=False))
        return 0 if certa else 1

    larghezza = max(len(c['criterio']) for c in e.criteri)
    for c in e.criteri:
        segno = 'saltato' if c['saltato'] else ('OK     ' if c['passa'] else 'MANCA  ')
        print(f"[{segno}] {c['criterio']:<{larghezza}}  {c['dettaglio']}")
    print()
    if e.raggiunta and e.saltati:
        # Meta' dei criteri non guardati non e' «tutto a posto». Con --no-net saltano CI,
        # alert di sicurezza e sonde sugli host: dichiarare comunque la fine del programma
        # sarebbe la stessa classe di bugia del parser che scarta in silenzio.
        print('NON DETERMINABILE: i criteri valutati passano, ma ' + str(len(e.saltati)) +
              ' non sono stati eseguiti (' + ', '.join(e.saltati) + ').')
        print('Rilancia senza --no-net/--no-db per una risposta vera.')
        return 1
    if e.raggiunta:
        print('CONDIZIONE RAGGIUNTA: niente altro da fare in autonomia.')
        print('Cio che resta aspetta Enzo: vedi  zp vassoio  e  zp lotto')
    else:
        print('Non ancora: c e ancora lavoro. Il driver puo proseguire.')
    return 0 if e.raggiunta else 1


if __name__ == '__main__':
    raise SystemExit(main())
