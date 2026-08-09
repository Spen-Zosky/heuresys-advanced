#!/usr/bin/env python3
"""zp_triage — quanto e' invecchiato il censimento, e quali premesse sono cambiate.

Il problema che risolve
-----------------------
Il piano zero-pendenze e' stato classificato contro uno stato preciso del repo, e si
aggiorna solo quando una corsa chiude un cluster. Ma il progetto lavora anche FUORI
dal loop (batch canonici, consegne lab, fix d'urgenza): il piano accumula cluster
«aperti» gia' risolti per altra via, e le stime d'effort invecchiano.

Rifare il censimento e' l'operazione piu' cara dell'impianto (bootstrap.md lo dice
esplicitamente). Questo strumento e' il controllo ECONOMICO che si rilancia quando
si vuole, e dice se il censimento vale ancora **prima** di pagarlo.

Storia (perche' e' qui e non altrove)
-------------------------------------
E' nato come strumento di laboratorio (`heuresys-design-lab/tools/`), come gia'
`zp_panel.py` prima della sua promozione. Non era mai stato committato: il pannello
lo invocava e falliva con FileNotFoundError, e l'ultimo triage utile restava un .md
del 2026-08-03 non rigenerabile. Promosso e rivisto il 2026-08-09 (S1052), su
segnalazione di Enzo.

Cosa e' cambiato nella revisione, e perche' contava
---------------------------------------------------
La versione del lab aveva tre premesse CABLATE nel sorgente — lo sha del censimento,
il percorso del piano, e un parser dei cluster tutto suo. Tutte e tre lo avrebbero
fatto mentire in silenzio proprio quando serve: dopo un censimento nuovo, che scrive
un piano datato diverso e una sha diversa, avrebbe continuato a misurare contro il
mondo vecchio dando numeri plausibili e sbagliati. Ora le legge da `zp.config.yaml`
e riusa `zp_state.carica_piano()`, che e' il parser di riferimento — quello con la
rete di sicurezza sulle righe che nominano un cluster senza essere lette.

Aggiunto anche cio' che mancava del tutto: **nessun punto del codice confrontava
`meta.classified_against_sha` con l'HEAD corrente**. Ora il verdetto sull'eta' del
censimento e' la prima cosa che si legge.

Tutto in lettura. Non scrive nulla nel repo se non il report che gli si chiede.

Uso:  python docs/kb/tools/zp_triage.py [--md <file>] [--json]
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import RADICE, carica_config, carica_piano, percorso_piano  # noqa: E402

REGISTRI = [RADICE / 'docs' / 'kb' / 'SOT_BACKLOG.md',
            RADICE / 'docs' / 'kb' / 'DEBT_REGISTER.md']
CHIUSURA = re.compile(r'chius|risolt|eliminat|\bdone\b|\bfatto\b', re.I)
ZID = re.compile(r'Z-\d+')

# Esiti verificati A MANO in sessione lab, con evidenza e data. Sono fatti, non
# stime: restano terminali salvo regressione, e per questo vivono nel sorgente
# dello strumento invece che in un file che si rigenera.
VERIFICHE_MANUALI = {
    'Z-261': ('GIA-RISOLTO', 'chiuso S1033 a register («7 fattori eliminati dai 3 database, '
              'ok Enzo, 0 residui») — casella del piano mai spuntata (verifica lab 2026-08-03)'),
    'Z-034': ('PREMESSA-MUTATA', '2 componenti su 3 risolte in S1033 (secret plaintext eliminati, '
              'MFA_ENCRYPTION_KEY sul runner); resta la fixture nel repo (residuo TP1)'),
    'Z-047': ('PREMESSA-MUTATA', 'il censimento contava 9.278 refresh token vivi; misura lab '
              '2026-08-03: 2.399 — criterio da ri-misurare'),
    'Z-028': ('PREMESSA-MUTATA', 'pulizia disco 2026-08-03: pg_dump_snapshots 2,9G -> 1,3G, '
              'scheduled eliminata con archivio linux-pc verificato'),
    'Z-250': ('PREMESSA-MUTATA', 'la «prima corsa presidiata» e\' avvenuta (S1032, Z-203 chiuso '
              'con protocollo completo); da ridefinire il residuo reale del cluster'),
    'Z-085': ('PREMESSA-MUTATA', 'riquadrato dal lab (#91): degli 248 FK, 112 su colonne vuote e '
              '9 utili; SQL generato in L2-bonifica-strutturale.sql — effort 6h -> ~30min'),
    'Z-050': ('PREMESSA-MUTATA', 'MFA TOTP e\' ATTIVA (190 fattori, misura lab 2026-08-03); '
              'il residuo vero e\' solo il multi-kind mai verificato'),
    'Z-089': ('VALIDO-CONDIZIONALE', 'soglia dichiarata 50M righe; oggi 93.632 — per definizione '
              'non e\' una pendenza finche\' la soglia e\' lontana'),
}

ORDINE = ('GIA-RISOLTO', 'PREMESSA-MUTATA', 'VALIDO-CONDIZIONALE',
          'RISOLTO-A-REGISTRO?', 'LAVORATO-DOPO', 'VALIDO-PROVVISORIO')


def git(*args) -> str:
    r = subprocess.run(['git', '-C', str(RADICE), *args], capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    return r.stdout.strip() if r.returncode == 0 else ''


def eta_censimento(cfg: dict) -> dict:
    """Quanto e' vecchio il censimento. Nessuno lo misurava: il campo esisteva in
    configurazione e non era letto da nessuna riga di codice del repo."""
    meta = cfg.get('meta') or {}
    sha = str(meta.get('classified_against_sha') or '')
    quando = str(meta.get('classified_at') or '')
    head = git('rev-parse', '--short', 'HEAD')

    esito = {'sha_censimento': sha, 'classificato_il': quando, 'head': head,
             'commit_dopo': None, 'giorni': None, 'sha_raggiungibile': False}

    if sha and git('cat-file', '-t', sha) == 'commit':
        esito['sha_raggiungibile'] = True
        conta = git('rev-list', '--count', f'{sha}..HEAD')
        esito['commit_dopo'] = int(conta) if conta.isdigit() else None
    if quando:
        try:
            esito['giorni'] = (datetime.date.today()
                               - datetime.date.fromisoformat(quando)).days
        except ValueError:
            pass
    return esito


def cluster_aperti(cfg: dict) -> dict:
    """Dal parser di riferimento, non da uno tutto nostro: `carica_piano` e' anche
    l'unico che segnala le righe che nominano un cluster senza essere lette."""
    return {c.id: c.descrizione for c in carica_piano(cfg) if not c.chiuso}


def segnali_git(sha: str) -> dict:
    if not sha:
        return {}
    testo = git('log', f'{sha}..HEAD', '--format=%s%n%b')
    conta: dict = {}
    for zid in ZID.findall(testo):
        conta[zid] = conta.get(zid, 0) + 1
    return conta


def segnali_registri() -> dict:
    out = {}
    for path in REGISTRI:
        if not path.is_file():
            continue
        testo = path.read_text(encoding='utf-8', errors='replace')
        for m in ZID.finditer(testo):
            zid = m.group(0)
            if zid in out:
                continue
            ctx = testo[max(0, m.start() - 60):m.end() + 120].replace('\n', ' ')
            if CHIUSURA.search(ctx):
                out[zid] = f'{path.name}: …{ctx[40:150].strip()}…'
    return out


def triage(cfg: dict) -> dict:
    eta = eta_censimento(cfg)
    aperti = cluster_aperti(cfg)
    reg = segnali_registri()
    gitsig = segnali_git(eta['sha_censimento'])

    classi = {c: [] for c in ORDINE}
    for zid, titolo in sorted(aperti.items()):
        if zid in VERIFICHE_MANUALI:
            cl, ev = VERIFICHE_MANUALI[zid]
            classi[cl].append((zid, titolo, ev))
        elif zid in reg:
            classi['RISOLTO-A-REGISTRO?'].append((zid, titolo, reg[zid]))
        elif zid in gitsig:
            classi['LAVORATO-DOPO'].append(
                (zid, titolo, f"{gitsig[zid]} commit dopo il censimento"))
        else:
            classi['VALIDO-PROVVISORIO'].append((zid, titolo, ''))
    return {'eta': eta, 'aperti': len(aperti), 'piano': str(percorso_piano(cfg).name),
            'classi': classi}


def verdetto(t: dict) -> str:
    """Una frase sola, in italiano, che dice se il censimento regge.

    Le soglie sono dichiarate qui e non altrove perche' sono un GIUDIZIO, e chi
    legge deve poterlo contestare: sono commit e giorni, non una misura fisica."""
    eta = t['eta']
    sospetti = len(t['classi']['GIA-RISOLTO']) + len(t['classi']['PREMESSA-MUTATA']) \
        + len(t['classi']['RISOLTO-A-REGISTRO?'])
    quota = (sospetti / t['aperti'] * 100) if t['aperti'] else 0
    if not eta['sha_raggiungibile']:
        return ('lo sha del censimento non esiste piu\' in questo repo: '
                'il confronto non e\' possibile, il censimento va rifatto.')
    if quota >= 25 or (eta['commit_dopo'] or 0) >= 500:
        return (f'censimento SUPERATO: {quota:.0f}% dei cluster aperti ha un segnale di '
                f'stale, {eta["commit_dopo"]} commit dopo. Un censimento nuovo si ripaga.')
    if quota >= 10 or (eta['commit_dopo'] or 0) >= 200:
        return (f'censimento INVECCHIATO ma utile: {quota:.0f}% con segnali di stale su '
                f'{t["aperti"]} aperti, {eta["commit_dopo"]} commit dopo. Conviene ancora '
                f'ri-verificare i singoli cluster prima di lavorarci, non ri-censire tutto.')
    return (f'censimento REGGE: solo {quota:.0f}% dei cluster aperti mostra segnali di '
            f'stale ({eta["commit_dopo"]} commit dopo). Non serve ri-censire.')


def come_markdown(t: dict) -> str:
    eta = t['eta']
    # L'intestazione e' un CONTRATTO, non un titolo: `zp_panel` ne estrae data e HEAD
    # con un'espressione regolare. Riscrivendola nella revisione del 2026-08-09 avevo
    # tolto la parola «generato», e la plancia mostrava «generato ? su HEAD ?» pur
    # avendo davanti un report giusto. Il lettore ora tollera entrambe le forme, ma
    # chi produce resta sulla forma attesa: e' gratis, e vale per i lettori vecchi.
    righe = [
        f"# Triage dei cluster zero-pendenze — generato {datetime.date.today()} "
        f"su HEAD {eta['head']}",
        '',
        f"**{verdetto(t)}**",
        '',
        f"- piano: `{t['piano']}` · {t['aperti']} cluster aperti",
        f"- censimento: `{eta['sha_censimento']}` del {eta['classificato_il']} "
        f"({eta['giorni']} giorni fa, {eta['commit_dopo']} commit fa)",
        '- rilanciabile quando si vuole: `python docs/kb/tools/zp_triage.py --md .zp/zp_triage.md`',
    ]
    for cl in ORDINE[:-1]:
        gruppo = t['classi'][cl]
        righe += ['', f'## {cl} — {len(gruppo)}', '']
        for zid, titolo, ev in gruppo:
            righe.append(f'- **{zid}** — {titolo[:110]}')
            righe.append(f'  - evidenza: {ev}')
    validi = t['classi']['VALIDO-PROVVISORIO']
    righe += ['', f'## VALIDO-PROVVISORIO — {len(validi)} (nessun segnale di stale)', '',
              ' '.join(z for z, _, _ in validi)]
    return '\n'.join(righe) + '\n'


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--md', help='scrive il report in questo file')
    p.add_argument('--json', action='store_true')
    a = p.parse_args()

    t = triage(carica_config())
    if a.json:
        serializzabile = {**t, 'classi': {k: [list(x) for x in v]
                                          for k, v in t['classi'].items()},
                          'verdetto': verdetto(t)}
        print(json.dumps(serializzabile, ensure_ascii=False, indent=2))
        return 0

    eta = t['eta']
    print(verdetto(t))
    print(f"  piano {t['piano']} · {t['aperti']} aperti · censimento {eta['sha_censimento']} "
          f"({eta['giorni']}gg, {eta['commit_dopo']} commit fa) · HEAD {eta['head']}")
    print('  ' + ' · '.join(f"{cl.lower()} {len(t['classi'][cl])}" for cl in ORDINE))
    if a.md:
        dest = Path(a.md)
        if not dest.is_absolute():
            dest = RADICE / dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(come_markdown(t), encoding='utf-8')
        print(f'  report: {dest}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
