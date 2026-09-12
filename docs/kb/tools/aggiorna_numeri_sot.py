#!/usr/bin/env python
"""aggiorna_numeri_sot.py — la headline di `SOT_STATE.md` §0 si RI-DERIVA, non si ricopia.

Nasce da una open-Q rimasta aperta per tre sessioni (S1094-S1096): «la headline delle
migrazioni in SOT_STATE.md si ri-deriva a mano a ogni chiusura. Uno script o un hook?».
A mano vuol dire: aprire un paragrafo da 12.000 caratteri, trovare sette numeri con la loro
forma esatta, e riscriverli senza sbagliarne uno — a ogni chiusura. Il controllo di staleness
(`status_dashboard.py`) li LEGGE gia' con la forma qualificata («1015 map», «2 tenant»); qui
si SCRIVONO con la stessa forma, cosi' i due strumenti non possono divergere sulla grammatica.

⭐ IL PUNTO FISSO: un dato che varia si misura prima di prenderlo per buono. Ogni numero qui
viene dal database vivo (via `status_dashboard.sec_db`, la stessa query del boot) o dal disco
(`ls db/migrations`). Niente e' ricordato.

Che cosa riscrive — SOLO nella §0 (dall'intestazione «## 0.» alla successiva), SOLO le forme
elencate in FORME. Tutto il resto del file — i Delta datati, le cronache — e' evidenza di quel
momento e non si tocca (CLAUDE.md, «unica eccezione»).

Uso:
  python docs/kb/tools/aggiorna_numeri_sot.py            # riscrive; stampa cosa e' cambiato
  python docs/kb/tools/aggiorna_numeri_sot.py --check    # non scrive; exit 1 se riscriverebbe
  python docs/kb/tools/aggiorna_numeri_sot.py --selftest # prova a esiti opposti su un fixture

Esce 0 se la §0 e' allineata (o lo e' diventata), 1 se `--check` trova drift, 2 se una forma
attesa NON e' stata trovata nella §0 (NON MISURATO: si dichiara, non si tace), 3 se il
database non risponde.
"""
from __future__ import annotations

import io
import os
import re
import sys
import contextlib
from datetime import date

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOT = os.path.join(REPO, "docs", "kb", "SOT_STATE.md")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ogni forma: (nome, regex con UN gruppo per ogni numero, funzione live -> tupla di stringhe).
# La regex deve combaciare col testo di §0 COM'E' SCRITTO OGGI: se la grammatica cambia, la
# forma non combacia e lo strumento esce 2 invece di scrivere altrove. E' il comportamento
# voluto: meglio un «non trovato» dichiarato di una sostituzione a caso.
FORME = [
    ("utenti",
     r"\*\*(\d+) utenti = (\d+) persone \+ \*\*(\d+) utenze di collaudo",
     lambda L: (str(L["users"]), str(L["users"] - L["service"]), str(L["service"]))),
    ("rbac",
     r"RBAC (\d+) ruoli/(\d+) perm/(\d+) map \(misurati (\d{4}-\d{2}-\d{2})\)",
     lambda L: (str(L["roles"]), str(L["permissions"]), str(L["maps"]), L["oggi"])),
    ("tenant",
     r"(\d+) tenant ACTIVE;",
     lambda L: (str(L["tenants"]),)),
    ("tabelle",
     r"(\d+) tabelle `sys\.\*`",
     lambda L: (str(L["tables"]),)),
    ("migrazioni",
     r"(\d+) file migration `000001\.\.000(\d{3})`",
     lambda L: (str(L["migrations_disk"]), "%03d" % L["migration_max"])),
    ("skill",
     r"skill catalogo (\d+)",
     lambda L: (str(L["skills"]),)),
]

EXTRA_SQL = (
    "select (select count(*) from sys.sys_users where user_type='SERVICE'),"
    " (select count(*) from information_schema.tables where table_schema='sys' and table_type='BASE TABLE')"
)


def sezione_zero(md):
    """(inizio, fine) della §0: dall'intestazione «## 0.» alla PROSSIMA intestazione."""
    m = re.search(r"^## 0\..*$", md, re.M)
    if not m:
        return None
    n = re.search(r"^#{1,6} ", md[m.end():], re.M)
    fine = m.end() + n.start() if n else len(md)
    return m.start(), fine


def _sostituisci(gruppi_nuovi, m):
    """Riscrive SOLO i gruppi catturati, lasciando intatto il testo attorno."""
    s, pos = "", m.start()
    for i, nuovo in enumerate(gruppi_nuovi, start=1):
        s += m.string[pos:m.start(i)] + nuovo
        pos = m.end(i)
    return s + m.string[pos:m.end()]


def riscrivi(md, live):
    """Ritorna (md_nuovo, cambiamenti, forme_non_trovate)."""
    sz = sezione_zero(md)
    if sz is None:
        return md, [], ["§0 (intestazione «## 0.» assente)"]
    a, b = sz
    testo = md[a:b]
    cambi, mancanti = [], []
    for nome, rx, nuovi in FORME:
        m = re.search(rx, testo)
        if not m:
            mancanti.append(nome)
            continue
        vecchi = m.groups()
        nn = nuovi(live)
        if tuple(vecchi) != tuple(nn):
            testo = testo[:m.start()] + _sostituisci(nn, m) + testo[m.end():]
            cambi.append((nome, vecchi, nn))
    return md[:a] + testo + md[b:], cambi, mancanti


def misura():
    """I numeri vivi, dalla stessa query del boot piu' due che il boot non fa."""
    import status_dashboard as sd
    with contextlib.redirect_stdout(io.StringIO()):
        _, live = sd.sec_db(no_db=False)
    if not live:
        return None
    extra = sd.q(EXTRA_SQL, timeout=30)
    if extra is None:
        return None
    svc, tables = (int(v) for v in extra.replace("\n", "|").split("|")[:2])
    live = dict(live, service=svc, tables=tables, oggi=date.today().isoformat())
    return live


FIXTURE = (
    "# x\n\n## 0. Snapshot\n\nDB (**150 utenti = 148 persone + **2 utenze di collaudo `SERVICE`** (S1)); "
    "1 tenant ACTIVE; RBAC 13 ruoli/200 perm/900 map (misurati 2026-01-01); 240 tabelle `sys.*`; "
    "400 file migration `000001..000403`**, gap; skill catalogo 14000 — S1077.\n\n"
    "## 1. Delta\n\nmigrazioni su disco **400** (max `000403`) — cronaca, non si tocca.\n"
)
LIVE_FIX = dict(users=164, service=3, tenants=2, roles=14, permissions=231, maps=1015,
                tables=245, migrations_disk=404, migration_max=407, skills=14031,
                oggi="2026-09-12")


def selftest():
    ok = True

    def caso(nome, cond):
        nonlocal ok
        print(("  [OK] " if cond else "  [FAIL] ") + nome)
        ok = ok and cond

    nuovo, cambi, mancanti = riscrivi(FIXTURE, LIVE_FIX)
    caso("un fixture stantio viene riscritto: 6 forme cambiate", len(cambi) == 6 and not mancanti)
    caso("il numero riscritto e' quello vivo («164 utenti = 161 persone + **3 utenze»)",
         "**164 utenti = 161 persone + **3 utenze" in nuovo)
    caso("la forma qualificata che il boot legge e' presente («1015 map», «2 tenant»)",
         re.search(r"\b1015 map", nuovo) and re.search(r"\b2 tenant", nuovo))
    caso("il range delle migrazioni e' «000001..000407»", "`000001..000407`" in nuovo)
    caso("il Delta datato FUORI dalla §0 NON e' stato toccato",
         "**400** (max `000403`) — cronaca" in nuovo)
    nuovo2, cambi2, _ = riscrivi(nuovo, LIVE_FIX)
    caso("idempotente: la seconda passata non cambia nulla", nuovo2 == nuovo and not cambi2)
    # contro-prova: una forma assente si DICHIARA, non si inventa altrove
    rotto = FIXTURE.replace("tenant ACTIVE;", "tenant attivi;")
    _, _, mancanti3 = riscrivi(rotto, LIVE_FIX)
    caso("una forma assente esce come NON TROVATA («tenant»)", mancanti3 == ["tenant"])
    # contro-prova: senza «## 0.» non si scrive niente
    _, cambi4, mancanti4 = riscrivi("# x\n\n## 1. altro\n\n2 tenant ACTIVE;", LIVE_FIX)
    caso("senza §0 non si riscrive nulla e lo si dice", not cambi4 and mancanti4)
    print("SELFTEST", "VERDE" if ok else "ROSSO")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    check = "--check" in argv
    live = misura()
    if live is None:
        print("NON MISURABILE: il database non risponde (tunnel :5433?) — la §0 non si tocca")
        return 3
    md = open(SOT, encoding="utf-8").read()
    nuovo, cambi, mancanti = riscrivi(md, live)
    for nome, v, n in cambi:
        print(f"  [{'drift' if check else 'riscritto'}] {nome}: {' / '.join(v)} → {' / '.join(n)}")
    for nome in mancanti:
        print(f"  [NON TROVATA] forma «{nome}»: la grammatica della §0 e' cambiata, adegua FORME")
    if not cambi and not mancanti:
        print("  [OK] §0 allineata col vivo: utenti, RBAC, tenant, tabelle, migrazioni, skill")
    if mancanti:
        return 2
    if cambi and not check:
        open(SOT, "w", encoding="utf-8", newline="\n").write(nuovo)
        print(f"  [OK] {SOT} riscritto ({len(cambi)} forme)")
    return 1 if (check and cambi) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
