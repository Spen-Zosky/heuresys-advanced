#!/usr/bin/env python3
"""
chi_sorveglia.py — prima di toccare un oggetto, chi lo sorveglia gia'?

    python docs/kb/tools/chi_sorveglia.py sys_auth_mfa_factors
    python docs/kb/tools/chi_sorveglia.py auth_mfa_factor_secret
    python docs/kb/tools/chi_sorveglia.py seed-test-admin
    python docs/kb/tools/chi_sorveglia.py --selftest

PERCHE' ESISTE
--------------
Enzo, 2026-09-08: *«i risultati del tuo lavoro sono sempre aleatori e raramente hanno lo
stesso esito quando ripetuti. Evidentemente quando lavori non verifichi tutta l'intera catena
delle azioni e degli oggetti che tocchi, cosi' succede che a una correzione si crea un nuovo
errore nello stesso contesto.»*

La contestazione e' fondata, e la prova e' dello stesso giorno. Ho modificato
`seed-test-admin.ts` perche' scrivesse i segreti TOTP in chiaro. Funzionava. Ma esisteva dal
2026-08-08 una sentinella, `v_mfa_secrets_in_cleartext`, che pretende **zero** segreti in
chiaro: e' scattata un'ora dopo, durante la prova generale, e solo perche' nel frattempo
avevo toccato *anche* una migrazione. Non l'avevo cercata. Ho guardato il pezzo che stavo
cambiando, non la catena in cui il pezzo sta.

Cercarla era una domanda meccanica da un minuto. Questo strumento la rende **una riga**.

COSA RISPONDE
-------------
Dato il nome di una tabella, una colonna, una vista, un file o uno script:

  ① SENTINELLE  — le viste `sys.v_*` che lo interrogano. Sono le guardie che escono ROSSE
                  da sole: se ne accendi una, il difetto e' gia' successo.
  ② CANCELLI    — gli strumenti in `docs/kb/tools/` che lo nominano, cioe' chi puo' fermarti.
  ③ TEST        — chi asserisce su di lui: cambiarlo cambia il loro esito.
  ④ SCRITTORI   — script e seed che lo modificano: sono gli altri che gli mettono le mani
                  addosso, e la ragione per cui il tuo stato di partenza non e' mai lo stesso.
  ⑤ MIGRAZIONI  — chi lo crea e chi lo emenda. La catena si ri-applica per intero a ogni
                  deploy (ADR-0035): il file che CREA e' quello da emendare, non l'ultimo.
  ⑥ CI          — i workflow che lo nominano.

⚠ LA TRAPPOLA CHE QUESTO STRUMENTO EVITA PER COSTRUZIONE
--------------------------------------------------------
ripgrep salta i file **gitignored**, e il tool `Grep` lo eredita. Uno strumento che chiede
«chi tocca questo oggetto» e non guarda i file ignorati nasce cieco **proprio dove il difetto
si nasconde** — un artefatto generato, un `.env`, un file di stato. Qui si cerca sempre con
`--no-ignore`, e i riscontri in file ignorati sono **marcati**, non taciuti.

NON DICE SE PUOI TOCCARLO
-------------------------
Dice **chi guarda**. La decisione resta tua: lo scopo e' che sia presa sapendo, invece che
scoprendo un'ora dopo. Un elenco vuoto e' un'informazione (nessuno sorveglia), non un
permesso — e se il database non risponde lo dichiara **NON MISURATO**, perche' «non ho potuto
guardare» non e' «non c'e' niente».

Uscite: 0 sempre (e' una vista, non un cancello) · 1 solo se il selftest fallisce.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

REPO = Path(__file__).resolve().parents[3]

# Dove si cerca, e sotto quale titolo compare il riscontro. L'ordine e' quello in cui una
# sessione ha bisogno di sapere le cose: prima chi ti fa uscire rosso, poi chi ti ferma,
# poi chi asserisce, poi chi ti cambia lo stato sotto i piedi.
AREE: list[tuple[str, str, list[str]]] = [
    ("① SENTINELLE (viste sys.v_* che lo interrogano)", "sentinelle", ["db/migrations"]),
    ("② CANCELLI (strumenti che possono fermarti)",     "cancelli",   ["docs/kb/tools", "scripts/test"]),
    ("③ TEST (chi asserisce su di lui)",                "test",       ["apps/api/test", "apps/web/tests",
                                                                      "apps/agent-gateway/test"]),
    ("④ SCRITTORI (script e seed che lo modificano)",   "scrittori",  ["db/scripts", "db/seeds"]),
    ("⑤ MIGRAZIONI (chi lo crea, chi lo emenda)",       "migrazioni", ["db/migrations"]),
    ("⑥ CI (workflow che lo nominano)",                 "ci",         [".github/workflows"]),
    ("⑦ CODICE (moduli che lo leggono o scrivono)",     "codice",     ["apps/api/src", "apps/web/src",
                                                                      "packages"]),
]

ESCLUSI = ("node_modules", ".next", "dist", "__pycache__", ".git/", "graphify-out",
           "docs/source_bundle", "_inspection_artifacts",
           # ⭐ QUESTO FILE. Non sorveglia niente: e' il cercatore, e i termini che
           # cerca vivono nel suo stesso testo. Senza questa esclusione comparirebbe
           # fra i «cancelli» di ogni oggetto interrogato — rumore che somiglia a un
           # riscontro. L'ha trovato il selftest al primo colpo, cercando un termine
           # inventato in `docs/kb/tools/` e trovandolo: dentro di se'.
           "chi_sorveglia.py")


def _rg() -> str | None:
    return shutil.which("rg")


def cerca(termine: str, radici: list[str]) -> list[tuple[str, int]]:
    """File che nominano `termine` sotto `radici`, col numero di riscontri.

    ⚠ `--no-ignore`: un file gitignored e' esattamente dove un difetto si nasconde, e
    saltarlo renderebbe questo strumento cieco proprio dove serve.
    """
    presenti = [r for r in radici if (REPO / r).exists()]
    if not presenti:
        return []

    rg = _rg()
    if rg:
        cmd = [rg, "--no-ignore", "--hidden", "-c", "-F", "-i", termine, *presenti]
        for e in ESCLUSI:
            cmd[1:1] = ["--glob", f"!**/{e}/**"]
        try:
            out = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True,
                                 encoding="utf-8", errors="replace", timeout=60)
        except (subprocess.TimeoutExpired, OSError):
            return []
        risultati = []
        for riga in out.stdout.splitlines():
            if ":" not in riga:
                continue
            path, _, n = riga.rpartition(":")
            if any(e in path.replace("\\", "/") for e in ESCLUSI):
                continue
            try:
                risultati.append((path.replace("\\", "/"), int(n)))
            except ValueError:
                continue
        return sorted(risultati, key=lambda t: (-t[1], t[0]))

    # Ripiego senza ripgrep: piu' lento, stesso esito. Non si rinuncia alla misura.
    risultati = []
    ago = termine.lower()
    for radice in presenti:
        for p in (REPO / radice).rglob("*"):
            if not p.is_file() or any(e in str(p).replace("\\", "/") for e in ESCLUSI):
                continue
            try:
                testo = p.read_text(encoding="utf-8", errors="ignore").lower()
            except OSError:
                continue
            n = testo.count(ago)
            if n:
                risultati.append((str(p.relative_to(REPO)).replace("\\", "/"), n))
    return sorted(risultati, key=lambda t: (-t[1], t[0]))


def ignorato(path: str) -> bool:
    """Il file e' gitignored? Un riscontro li' va marcato, non taciuto."""
    try:
        r = subprocess.run(["git", "check-ignore", "-q", path], cwd=REPO,
                           capture_output=True, timeout=10)
        return r.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def viste_dal_database(termine: str) -> tuple[list[str], str]:
    """Le viste `sys.v_*` la cui DEFINIZIONE nomina il termine — letta dal database vivo.

    E' la fonte autoritativa: una vista puo' essere stata creata da una migrazione e poi
    rimpiazzata da un'altra, e il testo sul disco non lo sa. Se il database non risponde si
    dichiara NON MISURATO e si ripiega sulle migrazioni, dicendolo.
    """
    sql = ("SELECT viewname FROM pg_views WHERE schemaname='sys' "
           "AND definition ILIKE '%%%s%%' ORDER BY 1" % termine.replace("'", "''"))
    env = {**os.environ, "PGCONNECT_TIMEOUT": "8"}
    try:
        r = subprocess.run(
            ["psql", "-h", os.environ.get("POSTGRES_HOST", "localhost"),
             "-p", os.environ.get("POSTGRES_PORT", "5433"),
             "-U", os.environ.get("POSTGRES_USER", "heuresys"),
             "-d", os.environ.get("POSTGRES_DB", "heuresys_advanced"),
             "-t", "-A", "-c", sql],
            capture_output=True, text=True, timeout=30, env=env,
            encoding="utf-8", errors="replace")
    except (subprocess.TimeoutExpired, OSError):
        return [], "NON MISURATO (il database non ha risposto entro 30 s)"
    if r.returncode != 0:
        return [], "NON MISURATO (il database ha rifiutato la connessione)"
    return [v for v in r.stdout.split() if v], "letto dal database vivo"


def rapporto(termine: str) -> None:
    print("=" * 88)
    print(f" CHI SORVEGLIA  «{termine}»")
    print(" prima di toccarlo, chi lo guarda gia'? — la domanda che stamattina non mi sono fatto")
    print("=" * 88)

    viste, provenienza = viste_dal_database(termine)
    print(f"\n① SENTINELLE — viste sys.v_* che lo interrogano   [{provenienza}]")
    if viste:
        for v in viste:
            marchio = "  ⚠ BLOCCANTE" if v.startswith("v_") else ""
            print(f"    sys.{v}{marchio}")
        print("    ▸ una sentinella che si accende NON si allarga per farla tacere:")
        print("      o si toglie il dato, o si chiude il perimetro.")
    elif "NON MISURATO" in provenienza:
        print("    (non ho potuto guardare — e questo NON vuol dire «nessuna»)")
    else:
        print("    nessuna")

    for titolo, _chiave, radici in AREE:
        if titolo.startswith("①"):
            continue
        trovati = cerca(termine, radici)
        print(f"\n{titolo}")
        if not trovati:
            print("    nessuno")
            continue
        for path, n in trovati[:12]:
            nota = "  [gitignored]" if ignorato(path) else ""
            print(f"    {path:<62} {n:>3} riscontri{nota}")
        if len(trovati) > 12:
            print(f"    … e altri {len(trovati) - 12} file")

    print("\n" + "-" * 88)
    print(" Questo elenco dice CHI GUARDA, non se puoi toccarlo: la decisione resta tua.")
    print(" Ma se la prendi senza averlo letto, la stai prendendo al buio.")
    print("-" * 88)


# --- selftest -------------------------------------------------------------
# Deve poter fallire: un cercatore che trova sempre tutto e uno che non trova mai niente
# si assomigliano moltissimo quando l'esito atteso e' «poco».
CASI: list[tuple[str, str, bool]] = [
    # (termine, area da interrogare, deve trovare qualcosa?)
    ("auth_mfa_factor_secret", "db/scripts",     True),   # il caso reale di stamattina
    ("sys_auth_mfa_factors",   "db/migrations",  True),
    ("seed-test-admin",        ".github/workflows", True),
    # negativi: un termine inventato non deve produrre riscontri, o lo strumento mente
    ("zqxwvu_oggetto_inesistente_123", "db/migrations", False),
    # ⚠ Il caso negativo NON si mette su `docs/kb/tools`: un termine inventato e' scritto
    # qui dentro, quindi la ricerca lo troverebbe SEMPRE, e il rosso accuserebbe il
    # cercatore invece del difetto. Lo sbaglio l'ho fatto davvero: il primo selftest e'
    # uscito rosso proprio cosi', e la lezione e' che un caso negativo va posto dove la
    # risposta «zero» e' possibile.
    ("zqxwvu_oggetto_inesistente_123", "db/scripts", False),
    ("zqxwvu_oggetto_inesistente_123", "apps/api/test", False),
]


def selftest() -> int:
    errori: list[str] = []
    for termine, radice, atteso in CASI:
        trovati = cerca(termine, [radice])
        ok = bool(trovati) == atteso
        stato = "ok " if ok else "ROSSO"
        print(f"  [{stato}] «{termine}» in {radice}: "
              f"{len(trovati)} file (atteso {'≥1' if atteso else '0'})")
        if not ok:
            errori.append(f"{termine} in {radice}")

    # La controprova del cercatore stesso: deve DISCRIMINARE, non rispondere.
    tanti = cerca("sys_users", ["db/migrations"])
    nessuno = cerca("zqxwvu_oggetto_inesistente_123", ["db/migrations"])
    if not tanti:
        errori.append("controprova: non trova nemmeno `sys_users` nelle migrazioni")
    if nessuno:
        errori.append("controprova: trova un termine inventato")

    if errori:
        print(f"\nSELFTEST — ROSSO ({len(errori)}): " + " · ".join(errori))
        return 1
    print(f"\nSELFTEST — verde ({len(CASI)} casi, positivi e negativi, piu' la controprova "
          f"che il cercatore discrimini)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("termine", nargs="?", help="tabella, colonna, vista, file o script")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()
    if not a.termine:
        ap.print_help()
        return 0
    rapporto(a.termine)
    return 0


if __name__ == "__main__":
    sys.exit(main())
