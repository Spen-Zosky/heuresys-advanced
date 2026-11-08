#!/usr/bin/env python3
"""check_anagrafe_agenti.py: l'anagrafe degli agenti coincide con il codice, nei due sensi.

Piano dei principi agentici, voce T5b; principio P22 («ogni agente ha un nome e una scheda, in
un'anagrafe unica che un controllo automatico confronta con il codice»).

L'anagrafe è `docs/architecture/agenti/ANAGRAFE_agenti.md`, una riga per agente fra i segni
`<!-- anagrafe:inizio -->` e `<!-- anagrafe:fine -->`. Nel codice ogni agente porta, in un
commento del file indicato nella sua riga, il segno `@agente <codice>`.

Che cosa è un agente, per questo controllo (il modo di riconoscerlo è scritto qui e non altrove):
  · in heuresys-advanced, un file sotto `apps/*/src/` o `packages/*/src/` che importa la funzione
    `query` di `@anthropic-ai/claude-agent-sdk`, cioè che avvia un giro del modello;
  · in heuresys-datastore, un file sotto `src/`, `apps/*/src/` o `scripts/` che chiama
    `creaModello(`, cioè che consegna un modello a chi lo fa pensare.

Rosso se:
  1. un file che avvia il modello non porta nessun segno `@agente`;
  2. un segno nomina un codice che l'anagrafe non ha;
  3. una riga dell'anagrafe non trova il suo segno nel file che dichiara;
  4. due righe hanno lo stesso codice, o una riga ha un repository o uno stato fuori elenco.

Il datastore si cerca in `--datastore <percorso>`, poi nella variabile HEURESYS_DATASTORE_DIR,
poi accanto a questo repository (`../heuresys-datastore`). Se non c'è (in CI, per esempio), le
sue righe si dichiarano NON VERIFICATE: l'uscita resta 0, ma la riga lo dice, e con `--pieno`
l'assenza è un rosso.

Uscita: 0 verde (o datastore non verificato senza --pieno), 1 rosso, 2 anagrafe illeggibile.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ANAGRAFE = Path("docs/architecture/agenti/ANAGRAFE_agenti.md")
REPOSITORY = ("heuresys-advanced", "heuresys-datastore")
STATI = ("attivo", "sospeso", "ritirato")
SEGNO = re.compile(r"@agente\s+([a-z0-9][a-z0-9-]*)")

# Come si riconosce un file che avvia il modello, per repository.
AVVIO = {
    "heuresys-advanced": (
        re.compile(r'import\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*"@anthropic-ai/claude-agent-sdk"'),
        re.compile(r"^(apps|packages)/[^/]+/src/.+\.(ts|tsx|mts|js|mjs)$"),
    ),
    "heuresys-datastore": (
        re.compile(r"\bcreaModello\("),
        re.compile(r"^(src/|apps/[^/]+/src/|scripts/).+\.(ts|tsx|mts|js|mjs)$"),
    ),
}
# La definizione della funzione non è un avvio.
NON_AVVIO = re.compile(r"function\s+creaModello\(")


@dataclass(frozen=True)
class Riga:
    codice: str
    repository: str
    file: str
    stato: str


def leggi_anagrafe(testo: str) -> list[Riga]:
    try:
        corpo = testo.split("<!-- anagrafe:inizio -->", 1)[1].split("<!-- anagrafe:fine -->", 1)[0]
    except IndexError as e:
        raise ValueError("segni anagrafe:inizio / anagrafe:fine non trovati") from e
    righe: list[Riga] = []
    for linea in corpo.splitlines():
        linea = linea.strip()
        if not linea.startswith("|") or set(linea) <= set("|-: "):
            continue
        celle = [c.strip().strip("`") for c in linea.strip("|").split("|")]
        if celle[0].lower() == "codice":
            continue
        if len(celle) < 8:
            raise ValueError(f"riga con {len(celle)} colonne invece di 8: {linea}")
        righe.append(Riga(codice=celle[0], repository=celle[2], file=celle[3], stato=celle[7].lower()))
    return righe


def file_tracciati(radice: Path) -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(radice), "ls-files"], capture_output=True, text=True,
        encoding="utf-8", errors="replace", check=True,
    ).stdout
    return [r for r in out.splitlines() if r]


def scandisci(radice: Path, repository: str) -> tuple[dict[str, set[str]], set[str]]:
    """(segni per file, file che avviano il modello) nel repository."""
    avvio, ambito = AVVIO[repository]
    segni: dict[str, set[str]] = {}
    avviano: set[str] = set()
    for rel in file_tracciati(radice):
        if not ambito.match(rel) or "/test/" in rel or ".test." in rel:
            continue
        try:
            testo = (radice / rel).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        trovati = set(SEGNO.findall(testo))
        if trovati:
            segni[rel] = trovati
        if avvio.search(NON_AVVIO.sub("", testo)):
            avviano.add(rel)
    return segni, avviano


def confronta(righe: list[Riga], repository: str, segni: dict[str, set[str]], avviano: set[str]) -> list[str]:
    errori: list[str] = []
    mie = [r for r in righe if r.repository == repository]
    codici = {r.codice for r in mie}
    for f in sorted(avviano):
        if f not in segni:
            errori.append(f"{repository}: {f} avvia il modello e non porta nessun segno @agente")
    for f, cs in sorted(segni.items()):
        for c in sorted(cs - codici):
            errori.append(f"{repository}: {f} porta @agente {c}, che l'anagrafe non ha")
    for r in mie:
        if r.stato == "ritirato":
            continue
        if r.codice not in segni.get(r.file, set()):
            errori.append(f"{repository}: la riga {r.codice} dichiara {r.file}, che non porta @agente {r.codice}")
    return errori


def controlla_forma(righe: list[Riga]) -> list[str]:
    errori: list[str] = []
    visti: set[str] = set()
    for r in righe:
        if r.codice in visti:
            errori.append(f"codice ripetuto nell'anagrafe: {r.codice}")
        visti.add(r.codice)
        if r.repository not in REPOSITORY:
            errori.append(f"{r.codice}: repository fuori elenco ({r.repository})")
        if r.stato not in STATI:
            errori.append(f"{r.codice}: stato fuori elenco ({r.stato})")
        if not SEGNO.fullmatch(f"@agente {r.codice}"):
            errori.append(f"{r.codice}: codice non valido (minuscole, cifre, trattini)")
    return errori


def trova_datastore(radice: Path, indicato: str | None) -> Path | None:
    for c in (indicato, os.environ.get("HEURESYS_DATASTORE_DIR"), str(radice.parent / "heuresys-datastore")):
        if c and (Path(c) / ".git").exists():
            return Path(c)
    return None


def selftest() -> int:
    righe = [Riga("a-uno", "heuresys-advanced", "apps/x/src/a.ts", "attivo"),
             Riga("a-vecchio", "heuresys-advanced", "apps/x/src/v.ts", "ritirato")]
    casi = [
        ("coerente", {"apps/x/src/a.ts": {"a-uno"}}, {"apps/x/src/a.ts"}, 0),
        ("avvio senza segno", {"apps/x/src/a.ts": {"a-uno"}}, {"apps/x/src/a.ts", "apps/x/src/b.ts"}, 1),
        ("segno senza riga", {"apps/x/src/a.ts": {"a-uno", "a-due"}}, {"apps/x/src/a.ts"}, 1),
        ("riga senza segno", {}, set(), 1),
    ]
    falliti = 0
    for nome, segni, avviano, attesi in casi:
        n = len(confronta(righe, "heuresys-advanced", segni, avviano))
        ok = n == attesi
        falliti += not ok
        print(f"  [{'ok' if ok else 'NO'}] {nome}: {n} errori (attesi {attesi})")
    forma = controlla_forma(righe + [Riga("a-uno", "altro", "f", "boh")])
    ok = len(forma) == 3
    falliti += not ok
    print(f"  [{'ok' if ok else 'NO'}] forma: {len(forma)} errori (attesi 3)")
    try:
        leggi_anagrafe("niente segni")
        print("  [NO] anagrafe senza segni accettata")
        falliti += 1
    except ValueError:
        print("  [ok] anagrafe senza segni rifiutata")
    print("SELFTEST " + ("VERDE" if not falliti else f"ROSSO ({falliti})"))
    return 0 if not falliti else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--datastore", help="percorso del repository heuresys-datastore")
    ap.add_argument("--pieno", action="store_true", help="il datastore non trovato è un rosso")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()

    radice = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True,
                                 text=True, check=True).stdout.strip())
    try:
        righe = leggi_anagrafe((radice / ANAGRAFE).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"ANAGRAFE ILLEGGIBILE: {e}")
        return 2

    errori = controlla_forma(righe)
    segni, avviano = scandisci(radice, "heuresys-advanced")
    errori += confronta(righe, "heuresys-advanced", segni, avviano)
    print(f"heuresys-advanced: {len(avviano)} file avviano il modello, "
          f"{sum(len(s) for s in segni.values())} segni, "
          f"{sum(1 for r in righe if r.repository == 'heuresys-advanced')} righe")

    ds = trova_datastore(radice, a.datastore)
    non_verificato = False
    if ds is None:
        non_verificato = True
        n = sum(1 for r in righe if r.repository == "heuresys-datastore")
        print(f"heuresys-datastore: NON VERIFICATO (repository non trovato), {n} righe non confrontate")
    else:
        segni, avviano = scandisci(ds, "heuresys-datastore")
        errori += confronta(righe, "heuresys-datastore", segni, avviano)
        print(f"heuresys-datastore: {len(avviano)} file avviano il modello, "
              f"{sum(len(s) for s in segni.values())} segni, "
              f"{sum(1 for r in righe if r.repository == 'heuresys-datastore')} righe")

    for e in errori:
        print(f"  ROSSO  {e}")
    if errori:
        print(f"ANAGRAFE NON ALLINEATA: {len(errori)} differenze")
        return 1
    if non_verificato and a.pieno:
        print("ANAGRAFE: datastore non verificato e --pieno chiesto")
        return 1
    print("ANAGRAFE ALLINEATA" + (" (datastore non verificato)" if non_verificato else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
