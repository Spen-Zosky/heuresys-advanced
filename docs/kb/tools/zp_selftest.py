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
from zp_state import (RADICE, ZPDIR, carica_config, carica_piano, candidati,  # noqa: E402
                      verifica, precondizioni_classe_c, gruppo_parallelo, in_conflitto)
from zp_gate import coppia_ammessa  # noqa: E402

ESITI = []


def prova(nome: str, condizione: bool, dettaglio: str = '') -> None:
    ESITI.append((nome, condizione, dettaglio))


def da_fare_a_mano(nome: str, come: str) -> None:
    ESITI.append((nome, None, come))


def prove_su_fixture() -> list:
    """Comportamenti verificati su un piano SINTETICO, con l'atteso deciso a mano.

    Serve perche' i test sui dati vivi non possono fallire: se `effort` smettesse di essere
    letto, o il budget di filtrare, l'esito resterebbe verde. Dimostrato in review — quattro
    regressioni iniettate su cinque non venivano rilevate.
    """
    import shutil
    esiti = []
    base = ZPDIR / 'selftest'
    base.mkdir(parents=True, exist_ok=True)
    piano = base / 'piano-finto.md'
    piano.write_text("""# finto

## W1 — igiene (3)

### test (3)

- [ ] **Z-801** (3.0h) — cluster grosso
  - *chiuso quando*: comando
- [ ] **Z-802** (0.5h) — cluster piccolo
  - *chiuso quando*: comando
- [ ] **Z-803** (1.0h · **esterno**) — bloccato su un input esterno
  - *chiuso quando*: comando
""", encoding='utf-8')
    rel = piano.relative_to(RADICE).as_posix()
    cfg = {'meta': {'plan': rel},
           'lanes': {'safe': ['A', 'B'], 'full': ['A', 'B', 'C']},
           'clusters': {'Z-801': {'classe': 'B'}, 'Z-802': {'classe': 'B'},
                        'Z-803': {'classe': 'E'}},
           'interrupt_resume': {'max_failures_per_cluster': 2}}
    cl = carica_piano(cfg)
    per_id = {c.id: c for c in cl}

    # 11 - l'effort viene letto davvero dal piano
    ok = per_id['Z-801'].effort == 3.0 and per_id['Z-802'].effort == 0.5
    esiti.append(('11 effort letto dal piano', ok,
                  f"Z-801={per_id['Z-801'].effort}h Z-802={per_id['Z-802'].effort}h (attesi 3.0 e 0.5)"))

    # 12 - il tetto di effort per giro filtra
    con_budget = {c.id for c in candidati(cl, cfg, 'safe', budget_ore=1.0)}
    ok = 'Z-802' in con_budget and 'Z-801' not in con_budget
    esiti.append(('12 budget-ore filtra', ok,
                  f'con budget 1.0h resta {sorted(con_budget)} (atteso solo Z-802)'))

    # 13 - il marcatore di blocco su Enzo e' riconosciuto dal PIANO (non dalla config)
    ok = per_id['Z-803'].bloccato_su_enzo == 'esterno' and not per_id['Z-803'].eseguibile_da_solo
    tutti = {c.id for c in candidati(cl, cfg, 'full')}
    esiti.append(('13 blocco su Enzo dal piano', ok and 'Z-803' not in tutti,
                  f"marcatore='{per_id['Z-803'].bloccato_su_enzo}', eleggibile={'Z-803' in tutti}"))

    # 14 - il contatore dei fallimenti ferma il cluster
    interrotti = ZPDIR / 'interrupted.json'
    salvato = interrotti.read_text(encoding='utf-8') if interrotti.is_file() else None
    try:
        interrotti.write_text(json.dumps({'Z-802': {'fallimenti': 2}}), encoding='utf-8')
        dopo = {c.id for c in candidati(cl, cfg, 'safe')}
        ok = 'Z-802' not in dopo
        esiti.append(('14 contatore fallimenti ferma', ok,
                      f'dopo 2 fallimenti resta {sorted(dopo)} (atteso senza Z-802)'))
    finally:
        if salvato is not None:
            interrotti.write_text(salvato, encoding='utf-8')
        elif interrotti.is_file():
            interrotti.unlink()
    shutil.rmtree(base, ignore_errors=True)
    return esiti


def prove_perimetri() -> list:
    """15-21 — chi puo' girare insieme (modalita' gov, #173).

    Su piano finto, con l'atteso scritto a mano: sui dati veri nessun cluster ha
    ancora un perimetro, quindi un test «vivo» direbbe sempre «zero in parallelo»
    e resterebbe verde anche col confronto rotto.
    """
    import shutil
    esiti = []
    base = ZPDIR / 'selftest-gov'
    base.mkdir(parents=True, exist_ok=True)
    piano = base / 'piano-finto.md'
    piano.write_text("""# finto

## W1 — igiene (6)

### test (6)

- [ ] **Z-901** (1.0h) — tocca il modulo A
  - *chiuso quando*: comando
- [ ] **Z-902** (1.0h) — tocca il modulo B, disgiunto da A
  - *chiuso quando*: comando
- [ ] **Z-903** (1.0h) — tocca tutto apps/api, quindi anche il modulo A
  - *chiuso quando*: comando
- [ ] **Z-904** (1.0h) — nessun perimetro dichiarato
  - *chiuso quando*: comando
- [ ] **Z-905** (1.0h) — tocca apps/api2, che NON e' apps/api
  - *chiuso quando*: comando
- [ ] **Z-906** (1.0h) — perimetro jolly: la radice
  - *chiuso quando*: comando
""", encoding='utf-8')
    rel = piano.relative_to(RADICE).as_posix()
    cfg = {
        'meta': {'plan': rel},
        'lanes': {'safe': ['A', 'B']},
        'gov': {'lavoratori_default': 2, 'lavoratori_max': 3},
        'clusters': {
            'Z-901': {'classe': 'B', 'perimetro': ['apps/api/src/modules/a/**']},
            'Z-902': {'classe': 'B', 'perimetro': ['apps/api/src/modules/b/**']},
            'Z-903': {'classe': 'B', 'perimetro': ['apps/api/**']},
            'Z-904': {'classe': 'B'},
            'Z-905': {'classe': 'B', 'perimetro': ['apps/api2/**']},
            'Z-906': {'classe': 'B', 'perimetro': ['**']},
        },
        'interrupt_resume': {'max_failures_per_cluster': 2},
    }
    cl = carica_piano(cfg)
    per_id = {c.id: c for c in cl}

    # 15 - senza perimetro non si va mai in parallelo (decisione 3)
    ok = per_id['Z-904'].parallelizzabile is False and per_id['Z-901'].parallelizzabile is True
    esiti.append(('15 senza perimetro non e parallelizzabile', ok,
                  f"Z-904={per_id['Z-904'].parallelizzabile} Z-901={per_id['Z-901'].parallelizzabile}"))

    # 16 - due perimetri disgiunti girano insieme
    g = gruppo_parallelo(cl, cfg, 'safe', lavoratori=2)
    scelti = [c['id'] for c in g['parallelo']]
    esiti.append(('16 perimetri disgiunti in parallelo', scelti == ['Z-901', 'Z-902'],
                  f'scelti {scelti} (attesi Z-901 e Z-902)'))

    # 17 - un perimetro che CONTIENE l'altro e' un conflitto
    ok = bool(in_conflitto(per_id['Z-901'], per_id['Z-903']))
    esiti.append(('17 perimetro contenuto = conflitto', ok,
                  f"apps/api/src/modules/a vs apps/api -> conflitto={ok} (atteso True)"))

    # 18 - ma il confronto e' per segmento: apps/api2 NON e' dentro apps/api
    ok = not in_conflitto(per_id['Z-903'], per_id['Z-905'])
    esiti.append(('18 apps/api2 non e dentro apps/api', ok,
                  f"conflitto={not ok} (atteso False: bloccherebbe lavoro buono)"))

    # 19 - il jolly sulla radice confligge con chiunque
    ok = (bool(in_conflitto(per_id['Z-906'], per_id['Z-901']))
          and bool(in_conflitto(per_id['Z-906'], per_id['Z-905'])))
    esiti.append(('19 il jolly sulla radice tocca tutto', ok,
                  f"'**' vs due perimetri distinti -> conflitto={ok} (atteso True)"))

    # 20 - chi confligge finisce fra gli scartati, e con il MOTIVO
    g3 = gruppo_parallelo(cl, cfg, 'safe', lavoratori=3)
    scartati = {s['id']: s for s in g3['scartati']}
    ok = ('Z-903' in scartati and scartati['Z-903']['perche'] == 'perimetro sovrapposto'
          and any(c['id'] == 'Z-901' for c in scartati['Z-903'].get('con', [])))
    esiti.append(('20 lo scarto dice con chi confligge', ok,
                  f"Z-903 -> {scartati.get('Z-903', {}).get('perche', 'ASSENTE')}"))

    # 21 - il numero di lavoratori e' un tetto: 9 richiesti, 3 concessi (decisione 4)
    g9 = gruppo_parallelo(cl, cfg, 'safe', lavoratori=9)
    ok = g9['lavoratori'] == 3 and len(g9['parallelo']) <= 3
    esiti.append(('21 lavoratori: il tetto vince sulla richiesta', ok,
                  f"chiesti 9, concessi {g9['lavoratori']} (atteso 3)"))

    shutil.rmtree(base, ignore_errors=True)
    return esiti


def prove_triage() -> list:
    """22-26 — il verdetto sull'eta' del censimento sa dire cose DIVERSE.

    Un verdetto che dicesse sempre la stessa frase sembrerebbe funzionare per
    mesi: e' il caso in cui uno strumento misura se stesso. Qui le quattro
    situazioni sono costruite a mano, con le soglie messe alla prova ai bordi.
    """
    from zp_triage import verdetto            # noqa: E402
    esiti = []

    def situazione(sha_ok: bool, commit: int, quota: float) -> str:
        n = round(quota * 219 / 100)
        return verdetto({
            'aperti': 219,
            'eta': {'sha_raggiungibile': sha_ok, 'commit_dopo': commit},
            'classi': {'GIA-RISOLTO': [0] * n, 'PREMESSA-MUTATA': [],
                       'RISOLTO-A-REGISTRO?': [], 'LAVORATO-DOPO': [],
                       'VALIDO-CONDIZIONALE': [], 'VALIDO-PROVVISORIO': []},
        })

    casi = [
        ('22 sha sparito -> censimento da rifare', situazione(False, 349, 4), 'non esiste piu'),
        ('23 molti stale -> superato', situazione(True, 50, 30), 'SUPERATO'),
        ('24 molti commit -> superato', situazione(True, 600, 4), 'SUPERATO'),
        ('25 pochi stale, molti commit -> invecchiato', situazione(True, 349, 4), 'INVECCHIATO'),
        ('26 poco di tutto -> regge', situazione(True, 20, 1), 'REGGE'),
    ]
    for nome, ottenuto, atteso in casi:
        esiti.append((nome, atteso in ottenuto, f'«{ottenuto[:64]}…»'))
    return esiti


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
    # L'elenco era troncato a 3 SENZA dirlo, accanto a un conteggio che diceva 4:
    # chi leggeva «4 senza classe: [tre id]» andava a classificarne tre e restava col
    # test rosso. Un taglio che non si dichiara fa sembrare completo un elenco che non
    # lo e'. Ora si mostra fino a 8 e, se ce ne sono altri, lo si scrive.
    prova('2 tutti classificati', not senza,
          'tutti' if not senza
          else f'{len(senza)} senza classe: {senza[:8]}'
               + (f' e altri {len(senza) - 8}' if len(senza) > 8 else ''))

    # 3 - il rifiuto delle prove omogenee
    # Aspettative riscritte sulla Definition of Done del progetto (S1030): le prime due
    # coppie sono quelle che CLAUDE.md e ADR-0026 impongono, e la vecchia regola le
    # rifiutava; `staticcheck` non vale come meta' prova.
    casi = [(('integration', 'e2e'), True),          # DoD: integration verde + Playwright verde
            (('psql', 'runtime'), True),             # ADR-0026: mutazione confermata + comportamento
            (('integration', 'unit'), True),
            (('migrate2', 'dbvalidate'), True),
            (('integration', 'integration'), False), # la stessa prova due volte
            (('psql', 'dbvalidate'), False),         # stesso livello: stesso punto cieco
            (('live', 'runtime'), False),
            (('staticcheck', 'e2e'), False),         # un typecheck non e' meta' evidenza
            (('staticcheck', 'integration'), False)]
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

    # 5 - la classe C: mai in safe, e in full SOLO con le precondizioni soddisfatte.
    # La seconda meta' e' la regola introdotta col punto 2 della review S1030: dump recente
    # verificato + host di prova raggiungibile. Non verificate = assenti, quindi C esclusa.
    c_aperti = [c for c in aperti if c.classe == 'C']
    in_full = {x.id for x in candidati(clusters, cfg, 'full')}          # offline: C fuori
    fuori_safe = all(c.id not in scelti for c in c_aperti)
    fuori_full_offline = all(c.id not in in_full for c in c_aperti)
    prova('5a classe C fuori da safe e da full-offline', fuori_safe and fuori_full_offline,
          f'{len(c_aperti)} cluster C: fuori da safe={fuori_safe}, '
          f'esclusi offline dalla full={fuori_full_offline}')

    pre_ok, dettagli = precondizioni_classe_c(cfg, offline=False)
    if pre_ok:
        in_full_rete = {x.id for x in candidati(clusters, cfg, 'full', offline=False)}
        dentro = any(c.id in in_full_rete for c in c_aperti) if c_aperti else True
        prova('5b classe C entra in full con le precondizioni ok', dentro,
              f'precondizioni soddisfatte, {len(in_full_rete)} candidati in full')
    else:
        da_fare_a_mano('5b classe C in full',
                       'precondizioni non soddisfatte ora: ' +
                       '; '.join(f'{n}: {d}' for n, ok, d in dettagli if not ok))

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

    # 11-14 - le quattro regressioni che la suite NON vedeva (review S1030): i test 4-9
    # girano sui dati vivi e sono tautologici — verificano che la funzione faccia cio' che
    # fa, non che faccia la cosa giusta. Qui l'atteso e' scritto a mano su un piano finto.
    for nome, esito, dett in prove_su_fixture():
        ESITI.append((nome, esito, dett))

    # 15-21 - i perimetri della modalita' gov (#173), anch'essi su piano finto
    for nome, esito, dett in prove_perimetri():
        ESITI.append((nome, esito, dett))

    # 22-26 - il verdetto sull'eta' del censimento (zp_triage)
    for nome, esito, dett in prove_triage():
        ESITI.append((nome, esito, dett))

    da_fare_a_mano('bootstrap non ri-censisce', 'serve una sessione viva: /zero-pending-loop bootstrap')
    da_fare_a_mano('freno a meta lavoro', 'serve una corsa vera: zp ferma mentre gira')
    da_fare_a_mano('troncamento da budget', 'serve una corsa vera con --max-budget-usd basso')
    # Il numero delle esche si CONTA dal file invece di essere scritto qui: diceva «8»
    # mentre il file ne porta 20 (10 che devono innescare, 10 che non devono). Un numero
    # scritto a mano accanto a un file che cresce mente appena qualcuno aggiunge una riga.
    try:
        _f = Path(RADICE) / '.claude' / 'skills' / 'zero-pending-loop' / 'evals' / 'trigger-eval.json'
        _esche = json.loads(_f.read_text(encoding='utf-8'))
        _no = sum(1 for e in _esche if not e.get('should_trigger'))
        _det = (f'servono le {len(_esche)} righe di evals/trigger-eval.json '
                f'({_no} che NON devono innescare)')
    except Exception as _e:
        _det = f'evals/trigger-eval.json non leggibile ({_e})'
    da_fare_a_mano('frontiere della description', _det)

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
    # anche questo si conta invece di essere scritto: aggiungere una prova presidiata
    # senza toccare il letterale avrebbe prodotto un riepilogo che contraddice l'elenco
    # stampato due righe sopra.
    a_mano = sum(1 for _, e, _ in ESITI if e is None)
    print(f'\n{passati} passati, {falliti} falliti, {a_mano} da fare a mano con una sessione viva')
    return 1 if falliti else 0


if __name__ == '__main__':
    raise SystemExit(main())
