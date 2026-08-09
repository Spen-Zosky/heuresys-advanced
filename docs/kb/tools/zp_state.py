#!/usr/bin/env python3
"""zp_state — lettura del piano zero-pendenze, selezione del prossimo cluster, cursore.

E' la fondazione: zp_gate, zp_evidence e zp_zero_check importano da qui.

Sottocomandi
    piano        statistiche del piano (totale, chiusi, aperti, per ondata, bloccati)
    verifica     integrita': dipendenze risolte, done-when presenti, classi in config
    prossimo     seleziona il prossimo cluster eseguibile nella corsia data
    todo         scrive .zp/todo.json con i candidati ordinati
    cursore      legge o scrive .zp/cursor.json
    interrotto   registra o elenca i cluster interrotti
    progress     rigenera .zp/PROGRESS.md
    perimetri    quali cluster possono girare INSIEME (modalita' gov, #173)

Uso tipico dal driver e dalla skill:
    python docs/kb/tools/zp_state.py prossimo --lane safe --json
    python docs/kb/tools/zp_state.py interrotto Z-042 --ragione "..." --riprendi-da "passo 3"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path

try:
    import yaml
except ImportError:
    print('serve pyyaml: pip install pyyaml', file=sys.stderr)
    raise SystemExit(2)

# La radice si puo' IMPORRE. Derivandola solo da dove sta questo file, uno strumento
# lanciato dal repo principale cerca le prove di un lavoratore in `<repo>/.zp/prove/`,
# mentre il lavoratore le ha scritte nel PROPRIO albero: misurato il 2026-08-09,
# `zp_evidence valida Z-230` diceva «nessuna prova registrata» con il file di prove
# presente e valido, e l'istruttoria di gov non poteva vederle. Senza ZP_ROOT nulla
# cambia: e' lo stesso rimedio gia' applicato al lucchetto della suite.
RADICE = Path(os.environ.get("ZP_ROOT") or Path(__file__).resolve().parents[3])
CONFIG = RADICE / '.claude' / 'skills' / 'zero-pending-loop' / 'references' / 'zp.config.yaml'
ZPDIR = RADICE / '.zp'

# - [x] **Z-015** (6.0h) — descrizione
# - [ ] **Z-245** (8.0h · dipende da Z-026 · **esterno**) — descrizione
RIGA_CLUSTER = re.compile(
    r'^\s*-\s*\[(?P<box>[ xX])\]\s*\*\*(?P<id>Z-\d+)\*\*\s*\((?P<meta>[^)]*)\)\s*[—-]\s*(?P<desc>.*)$'
)
RIGA_ONDATA = re.compile(r'^##\s*(?P<onda>W\d)\s*[—-]\s*(?P<titolo>.+?)\s*\(')
RIGA_AREA = re.compile(r'^###\s*(?P<area>[^(]+?)\s*\(')
RIGA_DONEWHEN = re.compile(r'^\s*-\s*\*chiuso quando\*:\s*(?P<crit>.+)$')
RIGA_CHIUSURA = re.compile(r'^\s*-\s*✅\s*\*\*(?P<nota>.+)$')
BLOCCANTI = ('esterno', 'decisione-business', 'segreto')

# Rete di sicurezza sul parser (S1030). RIGA_CLUSTER pretende `(meta)` subito dopo l'id:
# una voce scritta in modo appena diverso NON matcha e sparisce **in silenzio**
# dall'universo del motore. Non e' ipotesi: `Z-110` (chiuso WON'T-DO, titolo barrato e
# senza il campo ore) veniva letto 253 su 254 senza che nulla lo segnalasse. Oggi era
# innocuo perche' terminale; su un cluster APERTO sarebbe lavoro invisibile — e
# `zp_zero_check` potrebbe dichiarare «zero pendenze» con del lavoro ancora da fare.
# Questa regex e' volutamente larga: riconosce QUALUNQUE checkbox che nomini uno Z-id.
# Cio' che intercetta lei ma non RIGA_CLUSTER e' una riga persa, e va detto ad alta voce.
RIGA_SOSPETTA = re.compile(r'^\s*-\s*\[[ xX]\]\s*.*?\*\*(?P<id>Z-\d+)\*\*')


@dataclass
class Cluster:
    id: str
    onda: str = ''
    area: str = ''
    effort: float = 0.0
    chiuso: bool = False
    dipende_da: list = field(default_factory=list)
    bloccato_su_enzo: str = ''      # '' | esterno | decisione-business | segreto
    descrizione: str = ''
    chiuso_quando: str = ''
    nota_chiusura: str = ''
    riga: int = 0
    classe: str = ''                # assegnata dalla config, non dal piano
    perimetro: list = field(default_factory=list)   # idem: si dichiara, non si deduce

    @property
    def eseguibile_da_solo(self) -> bool:
        return not self.bloccato_su_enzo

    @property
    def parallelizzabile(self) -> bool:
        """Senza perimetro dichiarato un cluster non entra MAI in parallelo.

        Decisione 3 di Enzo (#173): perimetro assente o ambiguo => quel cluster
        torna sequenziale, senza bloccare gli altri. Il fail-safe e' lo stesso di
        `get_mode`: nel dubbio, il comportamento di sempre."""
        return bool(_normalizza_perimetro(self.perimetro))


# --- perimetri: quali cluster possono girare insieme ----------------------
#
# Il perimetro si DICHIARA in zp.config.yaml, accanto alla classe di rischio e per
# la stessa ragione: dedurlo dalla prosa della descrizione e' esattamente l'errore
# che la classificazione a mano ha gia' evitato una volta.
#
#   Z-004: {classe: B, perche: "...", perimetro: [apps/api/src/modules/x/**]}


def _normalizza_perimetro(voci) -> list:
    """Da ['apps/api/src/x/**', 'db/'] a ['apps/api/src/x', 'db'].

    Toglie i jolly finali e le barre di contorno, cosi' il confronto e' fra
    percorsi e non fra glob. `**` e `/` diventano stringa vuota, cioe' LA RADICE:
    e' il caso limite che deve risultare in conflitto con chiunque, non in
    «nessuna sovrapposizione»."""
    fuori = []
    for v in voci or []:
        s = str(v).replace('\\', '/').strip()
        if not s:
            continue
        s = re.sub(r'/?\*+$', '', s)          # /** e /* finali
        s = s.strip('/')
        fuori.append(s)
    return fuori


def _si_sovrappongono(a: str, b: str) -> bool:
    """Vero se due percorsi normalizzati si toccano.

    Il confronto e' per SEGMENTO, non per prefisso di stringa: `apps/api` e
    `apps/api2` sono due cose diverse, e un `startswith` nudo li direbbe in
    conflitto bloccando lavoro che poteva girare in parallelo."""
    if a == '' or b == '':
        return True                            # la radice tocca tutto
    if a == b:
        return True
    return a.startswith(b + '/') or b.startswith(a + '/')


def in_conflitto(c1, c2) -> list:
    """Le coppie di percorsi che mettono due cluster in conflitto. Vuota = disgiunti."""
    p1, p2 = _normalizza_perimetro(c1.perimetro), _normalizza_perimetro(c2.perimetro)
    return [(a, b) for a in p1 for b in p2 if _si_sovrappongono(a, b)]


def gruppo_parallelo(clusters: list, cfg: dict, corsia: str, lavoratori: int | None = None,
                     budget_ore: float | None = None, offline: bool = True) -> dict:
    """Chi puo' girare INSIEME, chi resta in coda, e perche'.

    Selezione golosa sull'ordine dei candidati, che e' gia' quello di priorita':
    si prende il primo, e ogni successivo entra solo se disgiunto da TUTTI quelli
    gia' presi. Deterministica — a parita' di piano dà sempre lo stesso esito.
    """
    conf_gov = (cfg.get('gov') or {})
    massimo = conf_gov.get('lavoratori_max') or 3
    if lavoratori is None:
        lavoratori = conf_gov.get('lavoratori_default') or 2
    lavoratori = max(1, min(int(lavoratori), int(massimo)))

    in_corsa = candidati(clusters, cfg, corsia, budget_ore=budget_ore, offline=offline)
    scelti, sequenziali, scartati = [], [], []
    for c in in_corsa:
        if not c.parallelizzabile:
            sequenziali.append({'id': c.id, 'perche': 'nessun perimetro dichiarato'})
            continue
        if len(scelti) >= lavoratori:
            scartati.append({'id': c.id, 'perche': f'i {lavoratori} posti sono gia occupati'})
            continue
        collisioni = [(altro.id, in_conflitto(c, altro)) for altro in scelti
                      if in_conflitto(c, altro)]
        if collisioni:
            scartati.append({
                'id': c.id,
                'perche': 'perimetro sovrapposto',
                'con': [{'id': i, 'percorsi': [f'{a} ~ {b}' for a, b in cp]}
                        for i, cp in collisioni],
            })
            continue
        scelti.append(c)

    return {
        'corsia': corsia,
        'lavoratori': lavoratori,
        'lavoratori_max': massimo,
        'parallelo': [{'id': c.id, 'classe': c.classe, 'effort': c.effort,
                       'perimetro': _normalizza_perimetro(c.perimetro),
                       'descrizione': c.descrizione} for c in scelti],
        'sequenziali': sequenziali,
        'scartati': scartati,
    }


def carica_config(percorso: Path = CONFIG) -> dict:
    if not percorso.is_file():
        raise SystemExit(f'config assente: {percorso}')
    return yaml.safe_load(percorso.read_text(encoding='utf-8')) or {}


def percorso_piano(cfg: dict) -> Path:
    rel = (cfg.get('meta') or {}).get('plan')
    if not rel:
        raise SystemExit('meta.plan non impostato in zp.config.yaml')
    p = RADICE / rel
    if not p.is_file():
        raise SystemExit(f'piano assente: {p}')
    return p


def _analizza_meta(meta: str) -> tuple[float, list, str]:
    """Da '8.0h · dipende da Z-026 · **esterno**' a (8.0, ['Z-026'], 'esterno')."""
    effort, dipendenze, blocco = 0.0, [], ''
    for pezzo in meta.split('·'):
        pezzo = pezzo.strip()
        m = re.match(r'^([\d.]+)\s*h$', pezzo)
        if m:
            effort = float(m.group(1))
            continue
        if pezzo.lower().startswith('dipende da'):
            dipendenze = re.findall(r'Z-\d+', pezzo)
            continue
        nudo = pezzo.strip('*').strip().lower()
        if nudo in BLOCCANTI:
            blocco = nudo
    return effort, dipendenze, blocco


def carica_piano(cfg: dict | None = None) -> list[Cluster]:
    cfg = cfg or carica_config()
    testo = percorso_piano(cfg).read_text(encoding='utf-8')
    classi = (cfg.get('clusters') or {})
    onda_corrente, area_corrente = '', ''
    clusters: list[Cluster] = []

    for n, riga in enumerate(testo.split('\n'), start=1):
        mo = RIGA_ONDATA.match(riga)
        if mo:
            onda_corrente = mo.group('onda')
            area_corrente = ''
            continue
        ma = RIGA_AREA.match(riga)
        if ma:
            area_corrente = ma.group('area').strip()
            continue
        mc = RIGA_CLUSTER.match(riga)
        if mc:
            effort, dip, blocco = _analizza_meta(mc.group('meta'))
            voce = classi.get(mc.group('id')) or {}
            clusters.append(Cluster(
                id=mc.group('id'),
                onda=onda_corrente,
                area=area_corrente,
                effort=effort,
                chiuso=mc.group('box').lower() == 'x',
                dipende_da=dip,
                bloccato_su_enzo=blocco,
                descrizione=mc.group('desc').strip(),
                riga=n,
                classe=(voce.get('classe') or '').upper(),
                perimetro=list(voce.get('perimetro') or []),
            ))
            continue
        if clusters:
            md = RIGA_DONEWHEN.match(riga)
            if md:
                clusters[-1].chiuso_quando = md.group('crit').strip()
                continue
            mk = RIGA_CHIUSURA.match(riga)
            if mk:
                clusters[-1].nota_chiusura = mk.group('nota').strip()

    perse = righe_perse(testo, clusters)
    if perse:
        print(f'ATTENZIONE: {len(perse)} riga/e del piano nominano uno Z-id ma NON sono state '
              f'lette (formato non conforme). Il motore le ignora — correggi il piano:',
              file=sys.stderr)
        for zid, n, testo_riga in perse:
            print(f'  riga {n}: {zid} — {testo_riga[:90]}', file=sys.stderr)

    return clusters


def righe_perse(testo: str, clusters: list) -> list:
    """Righe che nominano uno Z-id in una checkbox ma che il parser NON ha letto.

    Il valore sta qui: un parser che scarta in silenzio e' peggio di uno che rifiuta, perche'
    il lavoro perso non lascia traccia. Restituisce (id, numero_riga, testo).
    """
    letti = {c.id for c in clusters}
    fuori = []
    for n, riga in enumerate(testo.split('\n'), start=1):
        ms = RIGA_SOSPETTA.match(riga)
        if ms and ms.group('id') not in letti:
            fuori.append((ms.group('id'), n, riga.strip()))
    return fuori


# ---------------------------------------------------------------- stato runtime

def _leggi_json(p: Path, default):
    if not p.is_file():
        return default
    try:
        return json.loads(p.read_text(encoding='utf-8') or 'null') or default
    except json.JSONDecodeError:
        return default


def _scrivi_json(p: Path, dati) -> None:
    ZPDIR.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dati, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def leggi_cursore() -> dict:
    return _leggi_json(ZPDIR / 'cursor.json', {})


def leggi_interrotti() -> dict:
    return _leggi_json(ZPDIR / 'interrupted.json', {})


def cluster_lockati() -> dict:
    """I cluster che un lavoratore vivo ha in mano -> {id: pid}.

    RETE DI SICUREZZA della modalita' gov (#173). Il driver assegna e prende i
    lucchetti prima di aprire le sessioni, ma se una sessione ignorasse la sua
    assegnazione e chiedesse «qual e' il prossimo» si riprenderebbe il lavoro di
    un altro. Qui i lucchetti vivi escono direttamente dall'universo dei candidati.

    Un lucchetto di un processo MORTO non conta: e' un orfano, e ignorarlo
    trasformerebbe il primo crollo in un blocco permanente."""
    fuori = {}
    dir_lock = ZPDIR / 'locks'
    if not dir_lock.is_dir():
        return fuori
    for f in dir_lock.glob('*.lock'):
        try:
            pid = int(f.read_text(encoding='utf-8').splitlines()[0].strip())
        except (OSError, ValueError, IndexError):
            continue
        try:
            os.kill(pid, 0)
        except OSError:
            continue                      # morto: orfano, non blocca nessuno
        except Exception:
            pass
        fuori[f.stem] = pid
    return fuori


def leggi_autorizzazioni() -> set:
    """ID di classe D autorizzati a voce singola da `zp lotto ok N`."""
    f = ZPDIR / 'autorizzazioni.txt'
    if not f.is_file():
        return set()
    ids = set()
    for riga in f.read_text(encoding='utf-8', errors='replace').split('\n'):
        m = re.match(r'^\s*(Z-\d+)\s*\|', riga)
        if m:
            ids.add(m.group(1))
    return ids


# ---------------------------------------------------------------- selezione

def classi_ammesse(cfg: dict, corsia: str) -> list:
    lanes = cfg.get('lanes') or {}
    if corsia not in lanes:
        raise SystemExit(f"corsia sconosciuta: {corsia}. Disponibili: {', '.join(lanes)}")
    return [c.upper() for c in lanes[corsia]]


def precondizioni_classe_c(cfg: dict, offline: bool = False) -> tuple[bool, list]:
    """Le precondizioni che `class_c_preconditions` DICHIARA, finalmente verificate.

    Erano scritte in zp.config.yaml e non lette da nessuna riga di codice (review S1030):
    dump verificato di fresco, host di prova raggiungibile, doppia esecuzione, diff pg_dump
    vuoto erano prosa. Un cluster di classe C tocca schema e dati — se qualcosa va storto si
    torna indietro solo da un dump, quindi il dump deve ESISTERE ed essere recente.

    Le prime due si verificano qui (sono fatti sul mondo); le ultime due sono proprieta' del
    lavoro e restano in carico al gate delle prove. Restituisce (tutte_ok, dettagli).
    """
    pre = cfg.get('class_c_preconditions') or {}
    esiti = []
    # `bash` nudo su Windows risolve allo stub WSL senza distribuzioni: la config dichiara
    # il Git Bash reale, e va usato quello (stessa trappola gia' annotata in runtime.bash).
    shell = ((cfg.get('runtime') or {}).get('bash')) or 'bash'
    archivio = pre.get('archive_dir') or '~/heuresys-backups/prod'
    if not pre:
        return True, [('nessuna precondizione dichiarata', True, 'sezione assente in config')]

    max_ore = pre.get('verified_dump_max_age_hours')
    host = pre.get('rehearsal_host')

    if offline:
        esiti.append(('verifica saltata (offline)', False,
                      'senza rete non si puo dire che il dump esista: la classe C resta esclusa'))
        return False, esiti

    if max_ore:
        # Il dump piu' recente sull'archivio off-host, in ore.
        # `-n` (stdin da /dev/null) non e' cosmetico: senza, ssh eredita lo stdin del padre
        # e se il padre muore per timeout il figlio resta appeso. Visto sul campo — un
        # `ssh linux-pc true` orfano per 20 minuti con la sua catena di shell.
        cmd = (f"MSYS_NO_PATHCONV=1 ssh -n -o BatchMode=yes -o ConnectTimeout=10 {host} "
               f"'ls -t {archivio}/*.dump 2>/dev/null | head -1 | xargs -r stat -c %Y'")
        try:
            r = subprocess.run([shell, '-lc', cmd], capture_output=True, text=True,
                               encoding='utf-8', errors='replace', timeout=45, cwd=RADICE)
            ts = (r.stdout or '').strip()
            if ts.isdigit():
                import time
                eta = (time.time() - int(ts)) / 3600
                ok = eta <= float(max_ore)
                esiti.append((f'dump verificato piu recente di {max_ore}h', ok,
                              f'ultimo dump: {eta:.1f}h fa'))
            else:
                esiti.append((f'dump verificato piu recente di {max_ore}h', False,
                              'nessun dump trovato sull archivio off-host'))
        except (OSError, subprocess.SubprocessError) as err:
            esiti.append(('dump verificato', False, f'controllo non eseguibile: {err}'))

    if host:
        try:
            r = subprocess.run([shell, '-lc',
                                f'MSYS_NO_PATHCONV=1 ssh -n -o BatchMode=yes -o ConnectTimeout=10 {host} true'],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace', timeout=30, cwd=RADICE)
            esiti.append((f'host di prova ({host}) raggiungibile', r.returncode == 0,
                          'ok' if r.returncode == 0 else 'non risponde'))
        except (OSError, subprocess.SubprocessError) as err:
            esiti.append((f'host di prova ({host})', False, str(err)))

    return all(ok for _, ok, _ in esiti), esiti


def candidati(clusters: list, cfg: dict, corsia: str, budget_ore: float | None = None,
              offline: bool = True) -> list:
    """I 6 filtri di references/selection.md, applicati in ordine.

    Restituisce la lista ordinata: il primo elemento e' il prossimo da fare.
    `offline=True` (default) non interroga la rete: in quel caso la classe C e' esclusa,
    perche' le sue precondizioni non sono verificabili — e non verificate significa assenti.
    """
    ammesse = classi_ammesse(cfg, corsia)
    autorizzati = leggi_autorizzazioni()
    interrotti = leggi_interrotti()
    lockati = cluster_lockati()
    max_fall = ((cfg.get('interrupt_resume') or {}).get('max_failures_per_cluster')) or 2
    # Un id e' «chiuso» solo se lo sono TUTTE le sue occorrenze. Con un id duplicato — una
    # riga spuntata e una no — il set costruito sui soli chiusi sbloccava le dipendenze di
    # chi aspettava il lavoro NON fatto (review S1030). `verifica` segnala il duplicato, ma
    # nessuno la esegue prima di selezionare.
    aperti_per_id = {c.id for c in clusters if not c.chiuso}
    chiusi = {c.id for c in clusters if c.chiuso} - aperti_per_id

    # Se la corsia ammette la classe C, le sue precondizioni vanno soddisfatte: e' la
    # differenza fra «posso tornare indietro» e «spero di non doverlo fare».
    c_ok, c_dettagli = (True, [])
    if 'C' in ammesse:
        c_ok, c_dettagli = precondizioni_classe_c(cfg, offline=offline)

    def ammesso(c: Cluster) -> tuple[bool, str]:
        if c.chiuso:
            return False, 'gia chiuso'
        if c.id in lockati:
            return False, f'in mano a un altro lavoratore (pid {lockati[c.id]})'
        if not c.eseguibile_da_solo:
            return False, f'bloccato su Enzo: {c.bloccato_su_enzo}'
        if not c.classe:
            return False, 'senza classe in zp.config.yaml'
        if c.classe not in ammesse and c.id not in autorizzati:
            return False, f'classe {c.classe} fuori dalla corsia {corsia}'
        if c.classe == 'C' and not c_ok and c.id not in autorizzati:
            manca = '; '.join(f'{n}: {d}' for n, ok, d in c_dettagli if not ok)
            return False, f'precondizioni di classe C non soddisfatte ({manca})'
        mancanti = [d for d in c.dipende_da if d not in chiusi]
        if mancanti:
            return False, 'dipendenze aperte: ' + ', '.join(mancanti)
        stato = interrotti.get(c.id) or {}
        if stato.get('fallimenti', 0) >= max_fall:
            return False, f"interrotto {stato.get('fallimenti')} volte, si cambia oggetto"
        if budget_ore is not None and c.effort > budget_ore:
            return False, f'effort {c.effort}h oltre il budget del giro'
        return True, ''

    ok = [c for c in clusters if ammesso(c)[0]]

    def chiave(c: Cluster):
        return (
            0 if c.id in interrotti else 1,   # 1. interrotto a meta: priorita' assoluta
            c.onda or 'W9',                   # 2-3. ondata corrente prima
            c.effort,                         # 6. a parita', l'effort minore
            c.id,
        )

    return sorted(ok, key=chiave)


def motivi_esclusione(clusters: list, cfg: dict, corsia: str) -> dict:
    ammesse = classi_ammesse(cfg, corsia)
    autorizzati = leggi_autorizzazioni()
    chiusi = {c.id for c in clusters if c.chiuso}
    fuori = {}
    for c in clusters:
        if c.chiuso:
            continue
        if not c.eseguibile_da_solo:
            fuori[c.id] = f'vassoio ({c.bloccato_su_enzo})'
        elif not c.classe:
            fuori[c.id] = 'senza classe'
        elif c.classe not in ammesse and c.id not in autorizzati:
            fuori[c.id] = f'classe {c.classe}'
        elif [d for d in c.dipende_da if d not in chiusi]:
            fuori[c.id] = 'dipendenze aperte'
    return fuori


# ---------------------------------------------------------------- verifica

def verifica(clusters: list, cfg: dict) -> list:
    """Integrita' del piano. Restituisce la lista dei rilievi; vuota = tutto bene."""
    rilievi = []
    ids = {c.id for c in clusters}
    # Prima di tutto: il piano contiene voci che il parser non vede? (S1030)
    # Va in cima perche' e' l'unico rilievo che parla di cio' che MANCA dall'analisi:
    # tutti gli altri esaminano i cluster letti, e su una riga persa non direbbero nulla.
    for zid, n, riga in righe_perse(percorso_piano(cfg).read_text(encoding='utf-8'), clusters):
        rilievi.append(f'{zid} (riga {n}): NON letta dal parser — formato non conforme, '
                       f'il motore la ignora: {riga[:70]}')
    visti = {}
    for c in clusters:
        if c.id in visti:
            rilievi.append(f'{c.id}: duplicato (righe {visti[c.id]} e {c.riga})')
        visti[c.id] = c.riga
        for d in c.dipende_da:
            if d not in ids:
                rilievi.append(f'{c.id} (riga {c.riga}): dipende da {d} che non esiste')
        if not c.chiuso and not c.chiuso_quando:
            rilievi.append(f'{c.id} (riga {c.riga}): aperto ma senza *chiuso quando*')
        if c.chiuso and not c.nota_chiusura:
            rilievi.append(f'{c.id} (riga {c.riga}): chiuso ma senza nota di chiusura')
        if not c.chiuso and c.eseguibile_da_solo and not c.classe:
            rilievi.append(f'{c.id}: senza classe di rischio in zp.config.yaml')
    return rilievi


# ---------------------------------------------------------------- stato gov

def alberi_lavoratori(cfg: dict) -> list:
    """Le cartelle di lavoro dei lavoratori, se esistono. Fuori dal repo."""
    base = os.environ.get('GOV_WORKTREE_BASE') or str(RADICE.parent / 'heuresys-gov-workers')
    b = Path(base)
    if not b.is_dir():
        return []
    return sorted(d for d in b.iterdir() if d.is_dir() and (d / '.git').exists())


def stato_gov(cfg: dict) -> dict:
    """Chi sta lavorando a cosa, da quanto, e quanto si e' speso.

    E' il consolidamento MANUALE della decisione 1 di Enzo: si guarda quando si
    vuole, e non riapre niente. Sola lettura.

    Un lavoratore si dice vivo dal PID, non dalla freschezza di un file: la
    plancia ha gia' imparato che un file scritto di recente non prova che una
    sessione sia ancora aperta."""
    fuori = {'lavoratori': [], 'spesa_usd': 0.0, 'giri': 0,
             'config_bloccata_da': None, 'freno_inserito': None}

    meta = cfg.get('meta') or {}
    aut = meta.get('autorizzato_non_presidiato')
    fuori['freno_inserito'] = not (aut is True or str(aut).lower() == 'true')

    lockati = cluster_lockati()
    conf = ZPDIR / 'config.lock'
    if conf.is_file():
        try:
            pid = int(conf.read_text(encoding='utf-8').splitlines()[0].strip())
            os.kill(pid, 0)
            fuori['config_bloccata_da'] = pid
        except (OSError, ValueError, IndexError):
            pass

    for albero in alberi_lavoratori(cfg):
        esito = albero / '.zp' / 'last-outcome.json'
        voce = {'albero': albero.name, 'percorso': str(albero),
                'cluster': None, 'esito': None, 'quando': None}
        for cid, pid in lockati.items():
            voce.setdefault('pid', None)
            if voce['cluster'] is None:
                voce['cluster'], voce['pid'] = cid, pid
                break
        if esito.is_file():
            try:
                d = json.loads(esito.read_text(encoding='utf-8'))
                voce['esito'] = d.get('outcome')
            except (OSError, ValueError):
                voce['esito'] = 'illeggibile'
            voce['quando'] = _quando(esito)
        fuori['lavoratori'].append(voce)

    giornale = ZPDIR / 'runs.ndjson'
    if giornale.is_file():
        for riga in giornale.read_text(encoding='utf-8').splitlines():
            if not riga.strip():
                continue
            try:
                fuori['spesa_usd'] += float(json.loads(riga).get('costo_usd') or 0)
                fuori['giri'] += 1
            except (ValueError, TypeError):
                continue
    fuori['spesa_usd'] = round(fuori['spesa_usd'], 2)
    fuori['in_mano'] = lockati
    return fuori


def _quando(p: Path) -> str:
    import datetime
    try:
        return datetime.datetime.fromtimestamp(p.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
    except OSError:
        return ''


# ---------------------------------------------------------------- rapporto

def scrivi_progress(clusters: list, cfg: dict, corsia: str = 'safe') -> Path:
    from datetime import datetime
    piano = percorso_piano(cfg)
    eta = datetime.fromtimestamp(piano.stat().st_mtime)
    aperti = [c for c in clusters if not c.chiuso]
    autonomi = [c for c in aperti if c.eseguibile_da_solo]
    vassoio = [c for c in aperti if not c.eseguibile_da_solo]
    interrotti = leggi_interrotti()
    prossimi = candidati(clusters, cfg, corsia)[:5]
    giri = (ZPDIR / 'runs.ndjson')
    spesa, n_giri = 0.0, 0
    if giri.is_file():
        for riga in giri.read_text(encoding='utf-8').split('\n'):
            riga = riga.strip()
            if not riga:
                continue
            try:
                spesa += float(json.loads(riga).get('costo_usd') or 0)
                n_giri += 1
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
    tetto = ((cfg.get('budget') or {}).get('hard_stop_usd_total')) or 0

    r = []
    r.append('# zero-pending — a che punto siamo\n')
    r.append(f'Piano: `{piano.name}` del {eta:%Y-%m-%d}\n')
    r.append(f'**{len(clusters) - len(aperti)} chiusi su {len(clusters)}.** '
             f'Restano {len(autonomi)} pezzi che posso fare da solo '
             f'e {len(vassoio)} che aspettano te.\n')

    per_onda = {}
    for c in autonomi:
        per_onda.setdefault(c.onda or '—', []).append(c)
    if per_onda:
        r.append('## Cosa resta, per ondata\n')
        for onda in sorted(per_onda):
            n = len(per_onda[onda])
            ore = sum(x.effort for x in per_onda[onda])
            r.append(f'- **{onda}** — {n} pezzi, circa {ore:.0f} ore')
        r.append('')

    if interrotti:
        r.append('## Lasciati a metà\n')
        for cid, dati in interrotti.items():
            r.append(f"- **{cid}** — {dati.get('ragione', 'senza ragione registrata')} "
                     f"(riprende da: {dati.get('riprendi_da', '?')})")
        r.append('')

    if vassoio:
        r.append('## Aspettano te\n')
        for c in sorted(vassoio, key=lambda x: (x.bloccato_su_enzo, x.id)):
            r.append(f'- **{c.id}** ({c.bloccato_su_enzo}) — {c.descrizione[:110]}')
        r.append('')

    if prossimi:
        r.append('## I prossimi cinque\n')
        for c in prossimi:
            r.append(f'- **{c.id}** ({c.onda}, {c.effort}h, classe {c.classe}) — {c.descrizione[:100]}')
        r.append('')

    r.append('## Spesa\n')
    r.append(f'{n_giri} giri, circa {spesa:.2f} dollari su un tetto di {tetto}.\n')
    ZPDIR.mkdir(parents=True, exist_ok=True)
    dest = ZPDIR / 'PROGRESS.md'
    dest.write_text('\n'.join(r), encoding='utf-8')
    return dest


# ---------------------------------------------------------------- riga di comando

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    sub.add_parser('piano', help='statistiche del piano')
    sub.add_parser('verifica', help='integrita del piano')

    # Esiste perche' il driver gira in Git Bash, dove i path assoluti sono in forma
    # MSYS (/d/...) che Python su Windows non sa aprire. Qui il path se lo calcola
    # zp_state da solo, a partire da __file__: niente path da passare, niente trappola.
    pg = sub.add_parser('config', help='stampa un valore della config, es. meta.clusters_classified')
    pg.add_argument('chiave')

    for nome in ('prossimo', 'todo'):
        p = sub.add_parser(nome)
        p.add_argument('--lane', default='safe')
        p.add_argument('--budget-ore', type=float, default=None)
        p.add_argument('--json', action='store_true')

    pc = sub.add_parser('cursore')
    pc.add_argument('--set', metavar='JSON', help='scrive il cursore (oggetto JSON)')

    pi = sub.add_parser('interrotto')
    pi.add_argument('cluster', nargs='?')
    pi.add_argument('--ragione', default='')
    pi.add_argument('--riprendi-da', default='')
    pi.add_argument('--pulisci', action='store_true', help='toglie il cluster dagli interrotti')

    pp = sub.add_parser('progress')
    pp.add_argument('--lane', default='safe')

    sub.add_parser('stato-gov', help='chi sta lavorando a cosa, da quanto, e quanto si e speso')

    pj = sub.add_parser('perimetro-json', help='il perimetro di UN cluster, come lista JSON')
    pj.add_argument('cluster')

    pm = sub.add_parser('perimetri', help='chi puo girare insieme, chi resta in coda, e perche')
    pm.add_argument('--lane', default='safe')
    pm.add_argument('--lavoratori', type=int, default=None)
    pm.add_argument('--budget-ore', type=float, default=None)
    pm.add_argument('--json', action='store_true')

    a = ap.parse_args()
    cfg = carica_config()

    if a.cmd == 'config':
        d = cfg
        for k in a.chiave.split('.'):
            d = d.get(k) if isinstance(d, dict) else None
        print('' if d is None else d)
        return 0

    clusters = carica_piano(cfg)

    if a.cmd == 'piano':
        aperti = [c for c in clusters if not c.chiuso]
        autonomi = [c for c in aperti if c.eseguibile_da_solo]
        print(f'cluster totali .......... {len(clusters)}')
        print(f'chiusi .................. {len(clusters) - len(aperti)}')
        print(f'aperti .................. {len(aperti)}')
        print(f'  di cui autonomi ....... {len(autonomi)}  ({sum(c.effort for c in autonomi):.0f}h)')
        print(f'  di cui su Enzo ........ {len(aperti) - len(autonomi)}')
        for b in BLOCCANTI:
            n = len([c for c in aperti if c.bloccato_su_enzo == b])
            if n:
                print(f'      {b:20} {n}')
        print('per ondata (solo aperti autonomi):')
        per_onda = {}
        for c in autonomi:
            per_onda.setdefault(c.onda or '—', []).append(c)
        for onda in sorted(per_onda):
            v = per_onda[onda]
            print(f'  {onda}  {len(v):3} pezzi  {sum(x.effort for x in v):6.0f}h')
        senza_classe = [c for c in autonomi if not c.classe]
        if senza_classe:
            print(f'ATTENZIONE: {len(senza_classe)} cluster autonomi senza classe di rischio '
                  f'(la compila T1). Nessuno di questi e eleggibile.')
        return 0

    if a.cmd == 'verifica':
        rilievi = verifica(clusters, cfg)
        # La classe mancante non e' un difetto del piano: e' T1 non ancora fatto.
        # Tenerla separata evita che 182 righe identiche nascondano i rilievi veri.
        mancanti = [r for r in rilievi if 'senza classe' in r]
        veri = [r for r in rilievi if 'senza classe' not in r]

        if veri:
            print(f'{len(veri)} rilievi di integrita:')
            for r in veri[:40]:
                print('  -', r)
            if len(veri) > 40:
                print(f'  ... e altri {len(veri) - 40}')
        else:
            print(f'INTEGRITA OK: {len(clusters)} cluster, nessun rilievo.')
            print('  dipendenze tutte risolte, ogni aperto ha il suo *chiuso quando*,')
            print('  ogni chiuso ha la sua nota di chiusura.')

        if mancanti:
            print(f'\nIn attesa di T1: {len(mancanti)} cluster senza classe di rischio.')
            print('  Non e un difetto del piano: e la classificazione non ancora fatta.')
            print('  Finche manca, nessuno di questi e eleggibile.')
        return 1 if veri else 0

    if a.cmd in ('prossimo', 'todo'):
        lista = candidati(clusters, cfg, a.lane, a.budget_ore)
        if a.cmd == 'prossimo':
            if not lista:
                fuori = motivi_esclusione(clusters, cfg, a.lane)
                if a.json:
                    print(json.dumps({'cluster': None, 'motivo': 'nessun candidato',
                                      'esclusi': len(fuori)}, ensure_ascii=False))
                else:
                    print(f'nessun candidato nella corsia {a.lane}. Esclusi: {len(fuori)}')
                return 1
            c = lista[0]
            print(json.dumps(asdict(c), ensure_ascii=False, indent=None if a.json else 2))
            return 0
        _scrivi_json(ZPDIR / 'todo.json',
                     {'corsia': a.lane, 'candidati': [asdict(c) for c in lista]})
        print(f'{len(lista)} candidati scritti in .zp/todo.json')
        for c in lista[:10]:
            print(f'  {c.id}  {c.onda}  {c.effort:5.1f}h  classe {c.classe or "?"}  {c.descrizione[:70]}')
        return 0

    if a.cmd == 'cursore':
        if a.set:
            _scrivi_json(ZPDIR / 'cursor.json', json.loads(a.set))
            print('cursore scritto')
            return 0
        print(json.dumps(leggi_cursore(), ensure_ascii=False, indent=2))
        return 0

    if a.cmd == 'interrotto':
        stato = leggi_interrotti()
        if not a.cluster:
            print(json.dumps(stato, ensure_ascii=False, indent=2))
            return 0
        if a.pulisci:
            stato.pop(a.cluster, None)
            _scrivi_json(ZPDIR / 'interrupted.json', stato)
            print(f'{a.cluster} tolto dagli interrotti')
            return 0
        if not a.ragione:
            print('serve --ragione: una ragione verificata, non un impressione', file=sys.stderr)
            return 2
        voce = stato.get(a.cluster) or {'fallimenti': 0}
        voce['fallimenti'] = voce.get('fallimenti', 0) + 1
        voce['ragione'] = a.ragione
        voce['riprendi_da'] = a.riprendi_da
        stato[a.cluster] = voce
        _scrivi_json(ZPDIR / 'interrupted.json', stato)
        print(f"{a.cluster} interrotto ({voce['fallimenti']} volte): {a.ragione}")
        return 0

    if a.cmd == 'progress':
        dest = scrivi_progress(clusters, cfg, a.lane)
        print(f'scritto {dest}')
        return 0

    if a.cmd == 'perimetro-json':
        # Serve al driver per scrivere l'incarico del lavoratore. Scrittura BINARIA
        # per la ragione gia' pagata una volta: print() su Windows aggiunge un
        # ritorno a capo che finisce dentro il dato.
        voce = (cfg.get('clusters') or {}).get(a.cluster) or {}
        sys.stdout.buffer.write(
            json.dumps(_normalizza_perimetro(voce.get('perimetro')), ensure_ascii=False).encode())
        return 0

    if a.cmd == 'stato-gov':
        st = stato_gov(cfg)
        print(f"freno {'INSERITO' if st['freno_inserito'] else 'tolto'} · "
              f"{st['giri']} giri registrati · spesa ${st['spesa_usd']}")
        if st['config_bloccata_da']:
            print(f"  ATTENZIONE: la configurazione e' in scrittura (pid {st['config_bloccata_da']}): "
                  f"un censimento sta girando, non lanciare lavoratori adesso")
        if not st['lavoratori']:
            print('  nessuna cartella di lavoro: nessun lavoratore e mai partito '
                  '(si preparano con --prepara-alberi N)')
        for l in st['lavoratori']:
            in_mano = l.get('cluster') or '-'
            print(f"  {l['albero']:6s} cluster {in_mano:8s} "
                  f"ultimo esito {l['esito'] or '-':20s} {l['quando'] or ''}")
        if st['in_mano']:
            print('  in mano adesso: ' + ', '.join(f'{k} (pid {v})' for k, v in st['in_mano'].items()))
        else:
            print('  nessun cluster in mano a nessuno')
        return 0

    if a.cmd == 'perimetri':
        esito = gruppo_parallelo(clusters, cfg, a.lane, a.lavoratori, a.budget_ore)
        if a.json:
            print(json.dumps(esito, ensure_ascii=False, indent=2))
            return 0
        print(f"corsia {esito['corsia']} · {esito['lavoratori']} lavoratori "
              f"(tetto {esito['lavoratori_max']})")
        if not esito['parallelo']:
            print('\nIN PARALLELO: nessuno.')
        else:
            print(f"\nIN PARALLELO ({len(esito['parallelo'])}):")
            for c in esito['parallelo']:
                print(f"  {c['id']}  [{c['classe']}] {c['effort']}h  {c['descrizione'][:56]}")
                print(f"      perimetro: {', '.join(c['perimetro'])}")
        if esito['scartati']:
            print(f"\nFUORI da questo giro ({len(esito['scartati'])}):")
            for s in esito['scartati'][:10]:
                riga = f"  {s['id']}  {s['perche']}"
                for c in s.get('con', []):
                    riga += f" con {c['id']} ({'; '.join(c['percorsi'])})"
                print(riga)
        if esito['sequenziali']:
            print(f"\nSEQUENZIALI ({len(esito['sequenziali'])}) — nessun perimetro "
                  f"dichiarato, girano da soli come sempre:")
            print('  ' + ', '.join(s['id'] for s in esito['sequenziali'][:20])
                  + (' ...' if len(esito['sequenziali']) > 20 else ''))
        return 0

    return 2


if __name__ == '__main__':
    raise SystemExit(main())
