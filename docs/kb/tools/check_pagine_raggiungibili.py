#!/usr/bin/env python3
"""
check_pagine_raggiungibili.py — il cancello delle PAGINE SENZA PORTA (#99 F8).

REGOLA. Una pagina autenticata che non e' nel menu, non e' una scheda dentro
un'altra pagina e non ha una deroga motivata, e' **indistinguibile da una
dimenticanza**. Non e' un difetto di sicurezza — l'API risponde comunque
secondo RBAC — ma e' lavoro costruito che nessuno puo' raggiungere, e nessuno
se ne accorge finche' qualcuno non conta i file a mano.

PERCHE' ESISTE. #125 conto' **22** pagine orfane il 2026-08-04 e ne chiuse 12
(tutte quelle dell'area personale). Il conteggio pero' viveva in un file di
appunti fuori dal repo: un mese dopo nessuno sapeva dire se fossero ancora 22,
10 o 40 senza rifare il censimento a mano. Misurato il 2026-08-16: **10**, e
nove di esse sono raggiungibili **per disegno** dalla barra a schede introdotta
da S1009 («le altre diventano tab dentro la pagina principale» — regola di
Enzo). La conoscenza c'era; quello che mancava era un modo per accorgersi del
giorno in cui smette di valere.

TRE PORTE AMMESSE, in quest'ordine:
  1. una voce di `sys.sys_ui_interfaces` attiva che punta a quella rotta;
  2. una scheda in un gruppo di `apps/web/src/components/section-tabs.tsx`;
  3. una deroga in `pagine_waivers.txt`, **con il motivo sulla stessa riga**.
Una deroga senza motivo viene ignorata di proposito: non e' una decisione.

⚠ COSA NON CONTROLLA, e va detto invece di lasciarlo intendere: che la pagina
sia raggiungibile DAVVERO da chi ha i permessi. Quella e' la derivazione M1 di
#99 F7, provata altrove. Qui si guarda solo che una porta esista.

Uso:
    python docs/kb/tools/check_pagine_raggiungibili.py
    python docs/kb/tools/check_pagine_raggiungibili.py --elenco
    python docs/kb/tools/check_pagine_raggiungibili.py --selftest

Esce 1 se resta una pagina senza porta e senza motivo.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PAGINE_DIR = REPO / "apps" / "web" / "src" / "app" / "(authenticated)"
SECTION_TABS = REPO / "apps" / "web" / "src" / "components" / "section-tabs.tsx"
WAIVERS = Path(__file__).resolve().parent / "pagine_waivers.txt"

RE_HREF = re.compile(r"""href:\s*["'](?P<rotta>/[^"']*)["']""")


def rotte_delle_pagine(radice: Path | None = None) -> set[str]:
    """Le rotte autenticate, dedotte dai `page.tsx`.

    I gruppi di rotta di Next — le cartelle fra parentesi — non compaiono
    nell'URL e vanno tolti. Le pagine di dettaglio (`[id]`) si raggiungono da
    un elenco per costruzione e non sono orfane: si escludono qui, non con una
    deroga, perche' non e' una decisione da rinegoziare ogni volta.
    """
    base = radice or PAGINE_DIR
    if not base.is_dir():
        return set()
    out = set()
    for p in base.rglob("page.tsx"):
        rel = p.relative_to(base).parent.as_posix()
        rel = re.sub(r"\([^)]*\)/?", "", rel).strip("/")
        rotta = "/" + rel if rel else "/"
        if "[" in rotta:
            continue
        out.add(rotta)
    return out


def rotte_del_menu(no_db: bool = False) -> tuple[set[str], str]:
    """Le rotte dichiarate dal menu, dal database vivo. Mai da una lista qui."""
    if no_db:
        return set(), "saltato (--no-db)"
    sql = "select ui_interface_route from sys.sys_ui_interfaces where ui_interface_is_active"
    cmd = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
           "-p", os.environ.get("PGPORT", "5433"),
           "-U", os.environ.get("PGUSER", "heuresys"),
           "-d", os.environ.get("PGDATABASE", "heuresys_advanced"), "-Atc", sql]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            return set(), f"NON MISURABILE ({r.stderr.strip()[:60]})"
        # `psql` su Windows chiude le righe con CRLF: senza `strip` il confronto
        # fallisce in silenzio e OGNI pagina risulta orfana. Successo davvero.
        return {x.strip() for x in r.stdout.splitlines() if x.strip()}, "letto dal database"
    except Exception as e:  # noqa: BLE001
        return set(), f"NON MISURABILE ({type(e).__name__})"


def rotte_delle_schede(file: Path | None = None) -> set[str]:
    """Le rotte raggiungibili come scheda dentro un'altra pagina (S1009)."""
    f = file or SECTION_TABS
    if not f.is_file():
        return set()
    return {m.group("rotta") for m in RE_HREF.finditer(f.read_text(encoding="utf-8"))}


def deroghe(file: Path | None = None) -> dict[str, str]:
    """Le deroghe con motivo. Una riga senza `#` non vale."""
    f = file or WAIVERS
    if not f.is_file():
        return {}
    out = {}
    for riga in f.read_text(encoding="utf-8").splitlines():
        riga = riga.strip()
        if not riga or riga.startswith("#") or "#" not in riga:
            continue
        rotta, motivo = riga.split("#", 1)
        if rotta.strip() and motivo.strip():
            out[rotta.strip()] = motivo.strip()
    return out


def analizza(no_db: bool = False) -> tuple[list[str], dict[str, str], str]:
    pagine = rotte_delle_pagine()
    menu, fonte = rotte_del_menu(no_db)
    schede = rotte_delle_schede()
    der = deroghe()
    senza_porta = sorted(p for p in pagine if p not in menu and p not in schede and p not in der)
    return senza_porta, der, fonte


def main() -> int:
    ap = argparse.ArgumentParser(description="Pagine autenticate senza alcuna porta.")
    ap.add_argument("--elenco", action="store_true", help="stampa tutte le pagine e la loro porta")
    ap.add_argument("--no-db", action="store_true", help="senza tunnel (il menu non si legge)")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return _selftest()

    pagine = rotte_delle_pagine()
    menu, fonte = rotte_del_menu(a.no_db)
    schede = rotte_delle_schede()
    der = deroghe()

    print("=" * 74)
    print(" CANCELLO DELLE PAGINE SENZA PORTA (#99 F8)")
    print("=" * 74)
    print(f"  pagine autenticate      : {len(pagine)}  (escluse quelle di dettaglio [id])")
    print(f"  nel menu                : {len(pagine & menu)}   ({fonte})")
    print(f"  schede di un'altra pagina: {len(pagine & schede)}")
    print(f"  deroghe motivate        : {len(pagine & set(der))}")

    if a.elenco:
        print("\n  ── dettaglio ──")
        for p in sorted(pagine):
            if p in menu:
                porta = "menu"
            elif p in schede:
                porta = "scheda"
            elif p in der:
                porta = f"deroga — {der[p]}"
            else:
                porta = "NESSUNA"
            print(f"    {p:<44} {porta}")

    senza = sorted(p for p in pagine if p not in menu and p not in schede and p not in der)
    print()
    if not menu and not a.no_db:
        print("  [!] il menu non e' stato letto: l'esito non e' un verde, e' un NON MISURABILE.")
        return 1
    if senza:
        print(f"  SENZA PORTA: {len(senza)}")
        for p in senza:
            print(f"    - {p}")
        print("\n  Per ciascuna: metterla nel menu, farne una scheda, oppure motivarla in")
        print(f"  {WAIVERS.relative_to(REPO)} — una pagina senza porta e senza motivo e' una dimenticanza.")
        return 1
    print("  Ogni pagina autenticata ha una porta.")
    return 0


# --------------------------------------------------------------------------- selftest
def _selftest() -> int:
    """Le prove devono poter fallire: ogni caso costruisce lo stato che vuole vedere."""
    import tempfile

    esiti: list[tuple[str, bool]] = []

    def prova(nome: str, cond: bool) -> None:
        esiti.append((nome, bool(cond)))

    with tempfile.TemporaryDirectory() as d:
        base = Path(d) / "(authenticated)"
        (base / "users").mkdir(parents=True)
        (base / "users" / "page.tsx").write_text("x", encoding="utf-8")
        (base / "users" / "[id]").mkdir()
        (base / "users" / "[id]" / "page.tsx").write_text("x", encoding="utf-8")
        (base / "(gruppo)" / "nascosta").mkdir(parents=True)
        (base / "(gruppo)" / "nascosta" / "page.tsx").write_text("x", encoding="utf-8")

        rotte = rotte_delle_pagine(base)
        prova("trova la pagina semplice", "/users" in rotte)
        prova("scarta la pagina di dettaglio [id]", "/users/[id]" not in rotte)
        prova("toglie il gruppo di rotta fra parentesi", "/nascosta" in rotte)

        tabs = Path(d) / "section-tabs.tsx"
        tabs.write_text('const G = [{ href: "/a" , key: "k"}, { href: \'/b\', key: "k2" }];',
                        encoding="utf-8")
        s = rotte_delle_schede(tabs)
        prova("legge le schede con virgolette doppie", "/a" in s)
        prova("legge le schede con apici singoli", "/b" in s)

        w = Path(d) / "waivers.txt"
        w.write_text("# commento\n/muta\n/parlante   # ha un motivo\n", encoding="utf-8")
        dd = deroghe(w)
        prova("la deroga motivata vale", dd.get("/parlante") == "ha un motivo")
        prova("la deroga MUTA non vale", "/muta" not in dd)
        prova("il commento non diventa una deroga", "# commento" not in dd)

        # Il caso che conta: una pagina senza nessuna delle tre porte deve emergere.
        senza = sorted(p for p in rotte_delle_pagine(base)
                       if p not in {"/users"} and p not in s and p not in dd)
        prova("una pagina senza porta viene vista", "/nascosta" in senza)
        prova("una pagina nel menu non viene vista", "/users" not in senza)

    ok = sum(1 for _, c in esiti if c)
    for nome, c in esiti:
        print(f"  [{'ok' if c else 'NO'}] {nome}")
    print(f"\n  selftest: {ok}/{len(esiti)}")
    return 0 if ok == len(esiti) else 1


if __name__ == "__main__":
    sys.exit(main())
