#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""La sentinella del canale Cowork → CLI: da quanti giorni ci sono voci che nessuno ha riconciliato?

PERCHE' ESISTE
--------------
Il canale fra Cowork e la CLI su questo progetto e' uno solo: Cowork appende in fondo a
`docs/kb/COWORK_INBOX.md`, la CLI legge, riconcilia nelle SoT e **marca la voce**
`stato: [RICONCILIATA <commit>]` (protocollo scritto in testa al file dal 2026-06). Il
2026-09-14 un'indagine di mezza giornata ha misurato che il canale era fermo dall'8 agosto
e che cinque decisioni di metodo erano rimaste fuori dal repository. Questa riga avrebbe
detto «37 giorni» a ogni avvio. Una misura che bisogna ricordarsi di lanciare non la lancia
nessuno: la dashboard di avvio la stampa.

COSA MISURA, ESATTAMENTE
------------------------
Una **voce** e' un'intestazione `##`/`###` che apre con una data ISO (anche dopo il prefisso
`[COWORK → CLI] `); le sotto-intestazioni senza data (D1, Obiettivo, #250…) appartengono
alla voce che le contiene. Una voce e' **riconciliata** quando nel suo corpo c'e' una riga
che inizia con `stato:` e contiene `[RICONCILIATA`. Non basta che sia committata: S1100
ha riconciliato e committato le voci del 2026-09-14 senza marcarle, e il commit non dice se
la voce e' stata letta. Il marcatore si'.

Stampa: quante voci non riconciliate, e i giorni dalla piu' vecchia (rispetto a oggi).
**Nessuna soglia**: come `v_persona_senza_secondo_fattore`, il numero si vede e chi legge
giudica. Se Enzo vorra' una soglia, sara' una sua decisione.

COSA NON VEDE, DICHIARATO
-------------------------
- Cio' che Cowork **non ha scritto** nel canale (il materiale rimasto nel workspace): la
  sentinella misura il canale, non il mondo fuori dal canale.
- Una voce marcata senza essere stata davvero recepita: il marcatore e' una dichiarazione
  della CLI, e vale quanto chi l'ha scritta.

USO
---
    python docs/kb/tools/check_canale_cowork.py             # il numero, exit 0 sempre (vista, non gate)
    python docs/kb/tools/check_canale_cowork.py --elenco    # una riga per voce non riconciliata
    python docs/kb/tools/check_canale_cowork.py --selftest  # prove a esiti opposti
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

RADICE = Path(__file__).resolve().parents[3]
INBOX = RADICE / "docs" / "kb" / "COWORK_INBOX.md"

# Un'intestazione di voce: `## ` o `### `, poi (opzionale) `[COWORK → CLI] `, poi una data ISO.
# Il template in testa al file (`### YYYY-MM-DD | <tipo> | <titolo>`) non ha cifre: non combacia.
RE_VOCE = re.compile(r"^#{2,3}\s+(?:\[COWORK\s*(?:→|->)\s*CLI\]\s+)?(?P<data>\d{4}-\d{2}-\d{2})\b(?P<titolo>.*)$")
RE_INTESTAZIONE = re.compile(r"^#{1,3}\s")
RE_RICONCILIATA = re.compile(r"^\s*stato:\s*.*\[RICONCILIATA", re.I)


@dataclass
class Voce:
    riga: int
    data: date
    titolo: str
    riconciliata: bool


def voci(testo: str) -> list[Voce]:
    """Le voci del canale, nell'ordine del file. Un `##`/`###` senza data non apre una voce:
    resta dentro quella che lo precede (sono i paragrafi D1, Obiettivo, #250…)."""
    out: list[Voce] = []
    for n, riga in enumerate(testo.splitlines(), 1):
        m = RE_VOCE.match(riga)
        if m:
            try:
                d = date.fromisoformat(m.group("data"))
            except ValueError:
                continue  # `2026-13-45` non e' una data: non e' una voce
            out.append(Voce(n, d, m.group("titolo").strip(" |—-"), False))
            continue
        if out and RE_RICONCILIATA.match(riga):
            out[-1].riconciliata = True
    return out


def misura(testo: str, oggi: date) -> tuple[int, int | None, list[Voce]]:
    """(quante non riconciliate, giorni dalla piu' vecchia o None, l'elenco)."""
    aperte = [v for v in voci(testo) if not v.riconciliata]
    if not aperte:
        return 0, None, []
    piu_vecchia = min(v.data for v in aperte)
    return len(aperte), (oggi - piu_vecchia).days, aperte


def riga_dashboard(testo: str | None = None, oggi: date | None = None) -> str:
    """La riga per `session_start.py`. Non alza mai: e' una vista."""
    oggi = oggi or date.today()
    if testo is None:
        if not INBOX.is_file():
            return "  [? ] canale      COWORK_INBOX.md assente: NON MISURABILE"
        testo = INBOX.read_text(encoding="utf-8")
    n, giorni, _ = misura(testo, oggi)
    if n == 0:
        return "  [OK] canale      Cowork→CLI: 0 voci non riconciliate"
    return (f"  [!!] canale      Cowork→CLI: {n} voci non riconciliate, la piu' vecchia da "
            f"{giorni} giorni — `python docs/kb/tools/check_canale_cowork.py --elenco`")


# --- prove che possono fallire -----------------------------------------------------------

_ALLINEATO = """# COWORK_INBOX
## Entries
### YYYY-MM-DD | <tipo> | <titolo>
### 2026-06-15 | nota | una voce vecchia
corpo
stato: [RICONCILIATA abc1234] — CLI
## [COWORK → CLI] 2026-08-07 — decisioni
### D1 — un paragrafo
testo
stato: [RICONCILIATA 2026-08-07, CLI]
"""

_CON_VOCI_VECCHIE = _ALLINEATO + """
## [COWORK → CLI] 2026-08-08 — proposta mai marcata
### Obiettivo
testo senza marcatore
### 2026-09-14 — consegna
altro testo
"""

# Un marcatore che sta FUORI dalla riga `stato:` (citato nel corpo, in una frase) non conta:
# la voce resta non riconciliata. Se contasse, basterebbe nominare il protocollo per chiuderla.
_MARCATORE_FUORI_POSTO = _ALLINEATO + """
### 2026-08-20 | nota | una voce che cita il rito
il rito dice di scrivere [RICONCILIATA sha] ma nessuno lo ha fatto
"""


def selftest() -> int:
    oggi = date(2026, 9, 14)
    casi = [
        ("canale allineato → 0", misura(_ALLINEATO, oggi)[:2], (0, None)),
        ("due voci vecchie → 2, 37 giorni dall'8 agosto", misura(_CON_VOCI_VECCHIE, oggi)[:2], (2, 37)),
        ("marcatore fuori dalla riga stato: non conta → 1, 25 giorni", misura(_MARCATORE_FUORI_POSTO, oggi)[:2], (1, 25)),
        ("il template YYYY-MM-DD non e' una voce", len(voci(_ALLINEATO)), 2),
        ("riga dashboard verde", riga_dashboard(_ALLINEATO, oggi).startswith("  [OK]"), True),
        ("riga dashboard rossa col numero", "37 giorni" in riga_dashboard(_CON_VOCI_VECCHIE, oggi), True),
    ]
    rossi = 0
    for nome, avuto, atteso in casi:
        ok = avuto == atteso
        rossi += not ok
        print(f"  [{'OK' if ok else '!!'}] {nome}" + ("" if ok else f" — atteso {atteso!r}, avuto {avuto!r}"))
    # Controprova sul file VERO: il parser deve trovare voci, o e' cieco (un file cambiato di
    # forma darebbe «0 non riconciliate» per costruzione, cioe' il verde peggiore).
    if INBOX.is_file():
        n_voci = len(voci(INBOX.read_text(encoding="utf-8")))
        ok = n_voci >= 10
        rossi += not ok
        print(f"  [{'OK' if ok else '!!'}] il file vero ha voci riconoscibili ({n_voci})")
    print("selftest: " + ("verde" if rossi == 0 else f"ROSSO, {rossi} caso/i"))
    return 1 if rossi else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Voci del canale Cowork→CLI non riconciliate, e da quanti giorni.")
    ap.add_argument("--elenco", action="store_true", help="una riga per voce non riconciliata")
    ap.add_argument("--selftest", action="store_true", help="prove a esiti opposti")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not INBOX.is_file():
        print(riga_dashboard())
        return 0
    testo = INBOX.read_text(encoding="utf-8")
    print(riga_dashboard(testo))
    if args.elenco:
        for v in misura(testo, date.today())[2]:
            print(f"    riga {v.riga:>4}  {v.data}  {v.titolo[:90]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
