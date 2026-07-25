#!/usr/bin/env python3
"""zp_classify - assegna a ogni cluster la classe di raggio d'impatto (A..E).

La domanda a cui risponde non e' "quanto costa" ne' "quanto e' urgente", ma: se va storto
mentre nessuno guarda, quanto male fa e quanto ci vuole a tornare indietro?

    A  documenti, spec, register, test aggiunti      revert, zero conseguenze
    B  codice senza schema ne' contratti pubblici    git revert del commit
    C  schema e dati                                 restore dal dump
    D  produzione viva                               puo' servire intervento manuale
    E  serve una decisione o un input di Enzo        non si parte

Perche' uno script e non una lista scritta a mano: una lista invecchia al primo censimento
nuovo, una regola no. E la regola e' ispezionabile — ogni assegnazione porta la parola che
l'ha decisa, quindi si puo' contestare.

Nel dubbio fra due classi si prende LA PIU' ALTA: trattare un B come C costa mezz'ora,
l'errore opposto costa la produzione giu' di notte.

    proponi          stampa la classificazione proposta, con il motivo
    dubbi            solo i casi in cui la regola non e' netta
    scrivi           inserisce la classificazione in zp.config.yaml
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import CONFIG, carica_config, carica_piano  # noqa: E402

# L'ordine conta: si valuta D, poi C, poi B. La prima che aggancia vince.
SEGNALI_D = [
    r'\bdeploy\b', r'vm-deploy', r'scripts/vm-', r'\bsystemd\b', r'\.service\b', r'\.timer\b',
    r'\brestart\b', r'\briavvi', r'\bPROD\b', r'\bproduzione\b(?!.*documenta)',
    r'\.env\b', r'\.secrets', r'\bsegreti?\b', r'\bsecret\b', r'\brotazion',
    r'\bbackup\b', r'\bretention\b', r'\brestore\b', r'\bdr-drill\b', r'\bdisco\b',
    r'\balerting\b', r'\bprometheus\b', r'\balertmanager\b', r'\bcertificat',
    r'\bnginx\b', r'\bfirewall\b', r'\bsudo\b', r'\bcrontab\b', r'\bAIDE\b',
    r'\bTOTP\b', r'\bMFA_ENCRYPTION_KEY\b', r'\bJWT\b.*\bchiav', r'\bIdP\b',
]
SEGNALI_C = [
    r'db/migrations', r'\bmigration\b', r'\bmigrazion', r'\bschema\b', r'\bsys_[a-z]+',
    r'\bseed\b', r'\bbrownfield\b', r'\bpg_dump\b', r'\bTRUNCATE\b', r'\bDDL\b',
    r'\bindic[ei]\b', r'\bforeign key\b', r'\bFK\b', r'\bvista material',
    r'\btabell[ae]\b', r'\bcolonn[ae]\b', r'\bingestion\b', r'\bpopolament',
    r'\bdb:migrate\b', r'\bdb:validate\b', r'\bpsql\b.*\bINSERT\b',
]
SEGNALI_B = [
    r'apps/api', r'apps/web', r'apps/showcase', r'packages/', r'\bendpoint\b', r'\broute\b',
    r'\bcomponent', r'\bpagina\b', r'\bhook\b', r'\bmiddleware\b', r'\bRBAC\b',
    r'\bhandler\b', r'\bservizio\b', r'\brepository\b', r'\bzod\b', r'\bi18n\b',
    r'\bfrontend\b', r'\bAPI\b', r'\bUI\b', r'\bcodice\b', r'\brefactor',
    r'\blint\b', r'\btypecheck\b', r'\bplaywright\b', r'\bvitest\b', r'\btest\b',
    r'\bCI\b', r'\bworkflow\b', r'\.github/workflows',
]
SEGNALI_A = [
    r'\bdocs?/', r'\bADR\b', r'\bREADME\b', r'\bdocumentazion', r'\bregistro\b',
    r'\bDEBT_REGISTER\b', r'\bSOT_\w+', r'\bspec\b', r'\bpiano\b', r'\bglossario\b',
    r'\bcommento\b', r'\bnaming\b', r'\brinomina\b.*\bdoc',
]


# Revisione a mano del 2026-07-25: tutti i 24 cluster proposti D sono stati letti uno per
# uno. Questi 14 erano falsi positivi — la regola agganciava una parola che nel testo
# compare per ragioni innocue. Gli override restano validi anche quando la regola gira di
# nuovo su un piano nuovo, e ognuno porta il motivo per cui e' stato deciso.
OVERRIDE = {
    'Z-254': ('B', 'tag e versioning della lib: "deploy" e nel discorso, non nel lavoro'),
    'Z-239': ('A', 'indice della memoria Claude: "disco" era 55 nodi su disco'),
    'Z-150': ('C', 'scrive righe in sys_leads: e un lavoro sui dati, non sul runtime'),
    'Z-153': ('B', 'asset statici dello showcase (favicon, webmanifest)'),
    'Z-008': ('B', 'spec axe/smoke in CI: "prod" veniva da test:e2e:prod'),
    'Z-033': ('B', 'CI di qualita del design system upstream'),
    'Z-057': ('B', 'tocca .env.example versionato, non il .env reale'),
    'Z-007': ('B', 'gate E2E in CI: "prod" veniva da test:e2e:prod'),
    'Z-105': ('B', 'unit test: "secret" agganciato da una parola nel done-when'),
    'Z-113': ('B', 'spec E2E mancanti: codice di test'),
    'Z-119': ('B', 'test per apps/showcase: "deploy" e contesto, non azione'),
    'Z-089': ('C', 'partitioning di una tabella: schema, non runtime di produzione'),
    'Z-059': ('C', 'drop delle staging.wave1_*: schema e dati'),
    'Z-055': ('B', 'store condiviso per il rate-limit: codice applicativo'),
}


# ---------------------------------------------------------------- pavimento per AZIONE
#
# Il difetto che questi pattern chiudono (review S1030): la classe si decideva sul testo
# complessivo, e gli OVERRIDE a mano vincevano su tutto — ma erano stati scelti leggendo la
# DESCRIZIONE, che dice di cosa parla il lavoro, non cosa fa. L'azione sta nel *chiuso
# quando*, che e' l'unica riga verificabile con un comando. Cosi' `Z-153` era marcato B
# («asset statici dello showcase») mentre si chiude con `curl -sI https://www.heuresys.com/
# favicon.ico` — cioe' pretende un deploy sul sito pubblico. Con lui finivano in corsia non
# presidiata un backfill di ~14k skill sul DB reale (Z-070), un import di 139k archi
# (Z-186), PATCH reali su /v1/me/* (Z-048).
#
# Questi segnali cercano nel SOLO done-when e impongono un PAVIMENTO: la classe finale non
# puo' scendere sotto, nemmeno con un override. Un override resta libero di correggere un
# falso positivo lessicale (alzare, o abbassare entro il pavimento); non puo' dichiarare
# innocuo cio' che si chiude toccando la produzione.
AZIONE_D = [
    (r'curl\s[^\n]*https?://(www\.)?heuresys\.com', 'il criterio interroga il dominio pubblico'),
    (r'\bssh\s+(oracle-vm|linux-pc|vm\b)', 'il criterio esegue comandi su un host reale'),
    (r'\bsystemctl\b', 'il criterio ispeziona o muove unita di sistema'),
    (r'vm-deploy|close-propagate|align-clones', 'il criterio passa da un deploy'),
    (r'\bgh-pages\b|GitHub Pages', 'il criterio riguarda il sito pubblicato'),
    (r'\bwww\.heuresys\.com\b', 'il criterio nomina la produzione'),
    (r'\.env\b|\.secrets/', 'il criterio tocca segreti o configurazione di macchina'),
    (r'\b(della|sulla|nella|su)\s+VM\b|\bVM\s+OCI\b',
     'il criterio si misura sulla VM di produzione'),
    (r'\bheadroom\b.*\b(RAM|CPU)\b', 'il criterio consuma risorse di un host reale'),
]
AZIONE_C = [
    (r'\bpsql\b', 'il criterio esegue una query sul database'),
    (r'\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b', 'il criterio scrive nello schema o nei dati'),
    (r'\bpg_dump\b|\bpg_restore\b', 'il criterio passa da dump o restore'),
    (r'\bmigration\b|db/migrations', 'il criterio introduce o applica una migration'),
    (r'\b\d{3,}(\.\d{3})*\s*(righe|record|nodi|archi|skill|utenti|voci)\b',
     'il criterio conta migliaia di righe: e un carico sui dati'),
    (r'\bbackfill\b|\bimport(a|ati|are)?\b.*\b\d{3,}', 'il criterio importa in massa'),
    (r'\bPATCH\b|\bPOST\b.*/v1/', 'il criterio esegue scritture via API'),
    # «a scala 47k», «full-scale 139k»: la taglia si scrive spesso abbreviata, senza la
    # parola «righe» accanto. Un run a quella scala e' un carico sui dati, non un test.
    (r'\b(a scala|scala|full[- ]scale)\s*\d+\s*k\b|\b\d+\s*k\b\s*(righe|record|nodi)?',
     'il criterio esercita un volume dell ordine delle migliaia'),
    (r'\bPostgreSQL\s*\d+\s*(nativo|locale)|\bprovisioning\b|\binstalla(re|zione)?\b',
     'il criterio installa o provisiona software di sistema'),
]


def pavimento_azione(chiuso_quando: str) -> tuple[str, str]:
    """Classe MINIMA imposta da cio' che il criterio di chiusura fa davvero.

    Restituisce ('', '') se il criterio non descrive nessuna azione riconosciuta.
    """
    if not chiuso_quando:
        return '', ''
    for pattern, perche in AZIONE_D:
        if re.search(pattern, chiuso_quando, flags=re.IGNORECASE):
            return 'D', perche
    for pattern, perche in AZIONE_C:
        if re.search(pattern, chiuso_quando, flags=re.IGNORECASE):
            return 'C', perche
    return '', ''


ORDINE = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4}


def _agganci(testo: str, segnali: list) -> list:
    trovati = []
    for s in segnali:
        m = re.search(s, testo, flags=re.IGNORECASE)
        if m:
            trovati.append(m.group(0))
    return trovati


def classifica(c) -> tuple[str, str, bool]:
    """Restituisce (classe, motivo, dubbio)."""
    if c.bloccato_su_enzo:
        return 'E', f'bloccato su Enzo: {c.bloccato_su_enzo}', False

    # Il pavimento imposto dall'AZIONE viene prima di tutto il resto, override inclusi.
    minimo, perche = pavimento_azione(c.chiuso_quando)

    if c.id in OVERRIDE:
        classe, motivo = OVERRIDE[c.id]
        if minimo and ORDINE[minimo] > ORDINE[classe]:
            return minimo, (f'{minimo} per azione ({perche}); '
                            f'override "{motivo}" respinto: guardava la descrizione'), False
        return classe, f'rivisto a mano: {motivo}', False

    testo = f'{c.descrizione} {c.chiuso_quando}'
    d = _agganci(testo, SEGNALI_D)
    cc = _agganci(testo, SEGNALI_C)
    b = _agganci(testo, SEGNALI_B)
    a = _agganci(testo, SEGNALI_A)

    def esito(classe: str, motivo: str, dubbio: bool) -> tuple[str, str, bool]:
        """Applica il pavimento dell'azione a qualunque classe dedotta dal testo."""
        if minimo and ORDINE[minimo] > ORDINE[classe]:
            return minimo, f'{minimo} per azione ({perche}); il testo suggeriva {classe}', dubbio
        return classe, motivo, dubbio

    if d:
        # dubbio se anche segnali piu' bassi sono forti: potrebbe essere un B che
        # semplicemente NOMINA la produzione invece di toccarla
        dubbio = len(b) + len(a) > 2 * len(d)
        return esito('D', 'produzione viva: ' + ', '.join(sorted(set(d))[:3]), dubbio)
    if cc:
        dubbio = len(b) + len(a) > 2 * len(cc)
        return esito('C', 'schema e dati: ' + ', '.join(sorted(set(cc))[:3]), dubbio)
    if b:
        dubbio = bool(a) and len(a) > len(b)
        return esito('B', 'codice: ' + ', '.join(sorted(set(b))[:3]), dubbio)
    if a:
        return esito('A', 'inerte: ' + ', '.join(sorted(set(a))[:3]), False)
    # Nessun segnale: non si indovina. Si dichiara il dubbio e si alza la classe.
    return esito('C', 'nessun segnale riconosciuto - alzata per prudenza', True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    for n in ('proponi', 'dubbi'):
        p = sub.add_parser(n)
        p.add_argument('--classe', default=None, help='filtra per classe, es. D')
    sub.add_parser('scrivi')
    a = ap.parse_args()

    cfg = carica_config()
    clusters = carica_piano(cfg)
    aperti = [c for c in clusters if not c.chiuso]
    esiti = {c.id: classifica(c) for c in aperti}

    if a.cmd in ('proponi', 'dubbi'):
        conta = Counter(v[0] for v in esiti.values())
        for c in aperti:
            classe, motivo, dubbio = esiti[c.id]
            if a.cmd == 'dubbi' and not dubbio:
                continue
            if getattr(a, 'classe', None) and classe != a.classe.upper():
                continue
            segno = ' ?' if dubbio else '  '
            print(f'{c.id:8}{segno} {classe}  {c.onda:3} {c.effort:5.1f}h  '
                  f'{c.descrizione[:66]}')
            print(f'            {motivo}')
        print()
        print('proposta: ' + '  '.join(f'{k}={conta[k]}' for k in 'ABCDE' if conta[k]))
        print(f'da rivedere a mano: {sum(1 for v in esiti.values() if v[2])}')
        return 0

    # scrivi
    righe = ['clusters:']
    for c in sorted(aperti, key=lambda x: x.id):
        classe, motivo, dubbio = esiti[c.id]
        # json.dumps: i motivi contengono virgolette (es. "prod") che spezzerebbero
        # lo scalare YAML. Con l'escape corretto il file resta leggibile.
        m = json.dumps(motivo, ensure_ascii=False)
        righe.append(f'  {c.id}: {{classe: {classe}, perche: {m}'
                     + (', rivisto: false}' if dubbio else '}'))
    blocco = '\n'.join(righe)

    testo = CONFIG.read_text(encoding='utf-8')
    nuovo = re.sub(r'(?ms)^clusters:.*?(?=\n#|\nadaptive:|\Z)', blocco + '\n\n', testo)
    if nuovo == testo:
        print('non ho trovato la sezione clusters: in zp.config.yaml', file=sys.stderr)
        return 1

    # Uno scrittore che puo' corrompere la config DEVE verificare prima di scrivere.
    # Senza questo controllo il file resta rotto e il driver dice "non classificati",
    # che e' vero ma per la ragione sbagliata.
    try:
        prova = yaml.safe_load(nuovo)
        assert isinstance(prova.get('clusters'), dict) and prova['clusters']
    except Exception as err:
        print(f'RIFIUTO DI SCRIVERE: il risultato non sarebbe YAML valido - {err}',
              file=sys.stderr)
        return 1

    CONFIG.write_text(nuovo, encoding='utf-8')
    conta = Counter(v[0] for v in esiti.values())
    print(f'scritti {len(aperti)} cluster in zp.config.yaml')
    print('  ' + '  '.join(f'{k}={conta[k]}' for k in 'ABCDE' if conta[k]))
    print(f'  da rivedere a mano: {sum(1 for v in esiti.values() if v[2])}')
    print('\nmeta.clusters_classified resta false: va alzata a mano dopo la revisione.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
