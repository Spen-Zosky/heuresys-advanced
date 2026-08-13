#!/usr/bin/env python3
"""
check_pagine_orfane.py — nessuna pagina autenticata senza voce di menu NE' motivo scritto.

IL PROBLEMA (#125)
------------------
Il frontend ha 90 pagine autenticate; il menu guidato dal database ne dichiarava 52.
Delle 38 di differenza, 16 sono pagine di dettaglio (`[id]`) raggiunte da un elenco: le
orfane vere erano **22**, e **dieci** erano pagine del portale personale — profilo,
sicurezza, documenti, certificazioni — cioe' esattamente cio' che l'invariante **I17**
garantisce a ogni persona. Una garanzia che non si puo' esercitare non e' una garanzia.

Il difetto peggiore non e' la pagina irraggiungibile: e' che **una pagina senza voce e
senza motivo e' indistinguibile da una dimenticanza**. Questo strumento toglie
l'indistinguibilita': ogni pagina deve stare in una di tre categorie, e la terza pretende
che il motivo sia scritto qui dentro.

LE TRE CATEGORIE
----------------
  1. NEL MENU        — c'e' una riga in `sys.sys_ui_interfaces` che punta a quella rotta.
  2. COLLEGATA       — una pagina la linka (schede di sezione, elenchi, pulsanti). E' un
                       fatto verificabile nel sorgente, non una dichiarazione d'intenti.
  3. DICHIARATA      — non e' raggiungibile e va bene cosi', per una ragione scritta in
                       `FUORI_DAL_MENU` qui sotto. Una riga senza motivo non e' ammessa.

Tutto il resto e' un difetto, e questo strumento esce **1**.

USO
---
    python docs/kb/tools/check_pagine_orfane.py           # rapporto + exit code
    python docs/kb/tools/check_pagine_orfane.py --elenco  # anche le pagine a posto
    python docs/kb/tools/check_pagine_orfane.py --no-db   # senza database (solo disco+link)

Exit: 0 tutto coperto · 1 almeno una pagina scoperta · 2 non misurabile (e NON e' un ok).
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
APP = REPO / "apps" / "web" / "src" / "app" / "(authenticated)"
SORGENTI = REPO / "apps" / "web" / "src"

# ---------------------------------------------------------------------------------------
# Le pagine che NON stanno nel menu e non devono starci. Il motivo e' obbligatorio:
# e' la differenza fra una scelta e una dimenticanza, che e' tutto il punto di #125.
# ---------------------------------------------------------------------------------------
FUORI_DAL_MENU: dict[str, str] = {
    "/dev/agent":
        "console di sviluppo dell'agente, dietro NEXT_PUBLIC_ENABLE_AGENT_DEV. Senza la "
        "variabile la pagina mostra un avviso di funzione disattivata invece di un 404, "
        "quindi la rotta esiste ma non e' un ingresso di prodotto. Non va nel menu.",
}


def rotte_su_disco() -> tuple[set[str], set[str]]:
    """(navigabili, di dettaglio). I gruppi `(xxx)` non fanno parte della rotta."""
    navigabili: set[str] = set()
    dettaglio: set[str] = set()
    if not APP.is_dir():
        return navigabili, dettaglio
    for radice, _, files in os.walk(APP):
        if "page.tsx" not in files:
            continue
        r = str(Path(radice)).replace("\\", "/").replace(str(APP).replace("\\", "/"), "")
        r = re.sub(r"/\([^)]+\)", "", r) or "/"
        (dettaglio if "[" in r else navigabili).add(r)
    return navigabili, dettaglio


def rotte_nel_menu() -> set[str] | None:
    """Le rotte attive del menu. `None` se il database non risponde — che NON e' un ok."""
    try:
        out = subprocess.run(
            ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys",
             "-d", "heuresys_advanced", "-X", "-q", "-tA", "-c",
             "SELECT ui_interface_route FROM sys.sys_ui_interfaces WHERE ui_interface_is_active"],
            capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return {r.strip() for r in out.stdout.split() if r.strip()}


def rotte_collegate(candidate: set[str]) -> dict[str, list[str]]:
    """Chi linka che cosa. Un link e' un FATTO nel sorgente, non una dichiarazione."""
    testi: list[tuple[str, str]] = []
    for radice, _, files in os.walk(SORGENTI):
        for f in files:
            if not f.endswith((".tsx", ".ts")):
                continue
            p = Path(radice) / f
            try:
                testi.append((str(p), p.read_text(encoding="utf-8", errors="replace")))
            except OSError:
                pass
    fuori: dict[str, list[str]] = {}
    for rotta in candidate:
        da: list[str] = []
        for percorso, testo in testi:
            pp = percorso.replace("\\", "/")
            if pp.endswith(f"(authenticated){rotta}/page.tsx"):
                continue                       # la pagina non collega se stessa
            if f'"{rotta}"' in testo or f"'{rotta}'" in testo or f"`{rotta}`" in testo:
                da.append(pp.split("/src/")[-1])
        if da:
            fuori[rotta] = sorted(set(da))
    return fuori


def main() -> int:
    ap = argparse.ArgumentParser(description="Nessuna pagina senza voce ne' motivo (#125).")
    ap.add_argument("--elenco", action="store_true", help="mostra anche le pagine a posto")
    ap.add_argument("--no-db", action="store_true", help="salta il menu (solo disco + link)")
    a = ap.parse_args()

    navigabili, dettaglio = rotte_su_disco()
    if not navigabili:
        print(f"[!!] nessuna pagina trovata sotto {APP} — NON MISURABILE, non 'tutto a posto'")
        return 2

    menu = set() if a.no_db else rotte_nel_menu()
    if menu is None:
        print("[!!] il menu non e' interrogabile (database irraggiungibile).")
        print("     NON MISURABILE: senza il menu ogni pagina sembrerebbe orfana.")
        return 2

    scoperte = navigabili - menu
    collegate = rotte_collegate(scoperte)
    dichiarate = {r for r in scoperte if r in FUORI_DAL_MENU}
    orfane = sorted(scoperte - set(collegate) - dichiarate)

    print("=" * 78)
    print(" PAGINE AUTENTICATE — voce di menu, collegamento, o motivo scritto (#125)")
    print("=" * 78)
    print(f"  sul disco    {len(navigabili):>4} navigabili + {len(dettaglio)} di dettaglio [id]")
    print(f"  nel menu     {len(navigabili & menu):>4}")
    print(f"  collegate    {len(collegate):>4}  (link verificato nel sorgente)")
    print(f"  dichiarate   {len(dichiarate):>4}  (motivo scritto in FUORI_DAL_MENU)")
    print(f"  SCOPERTE     {len(orfane):>4}")

    if a.elenco:
        for r in sorted(collegate):
            print(f"    [link] {r:<38} da {collegate[r][0]}")
        for r in sorted(dichiarate):
            print(f"    [dich] {r:<38} {FUORI_DAL_MENU[r][:44]}...")

    if orfane:
        print("-" * 78)
        print("  Queste pagine non hanno voce di menu, nessuno le collega, e nessuno ha")
        print("  scritto perche'. Una di queste tre cose deve diventare vera:")
        for r in orfane:
            print(f"    · {r}")
        print("=" * 78)
        return 1

    # Le pagine di dettaglio non si verificano qui: si raggiungono da un elenco per
    # costruzione. Dirlo esplicitamente evita che qualcuno le creda controllate.
    print(f"  (le {len(dettaglio)} pagine [id] non sono verificate: si raggiungono da un elenco)")
    print("  Nessuna pagina scoperta.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
