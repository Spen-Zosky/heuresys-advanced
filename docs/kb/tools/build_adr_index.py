#!/usr/bin/env python3
"""
build_adr_index.py — ricostruisce `docs/architecture/ADR_INDEX.md` dai file ADR.

Perche' esiste
--------------
L'indice era manutenuto a mano, e infatti il 2026-08-07 risultava fermo al
**26 maggio**: 12 ADR assenti (`0021`, `0023`-`0033`) e per giunta un `ADR-0000`
citato che sul disco non esiste — indietro E disallineato in avanti. Fra i
mancanti c'erano `0026`, `0027` e `0032`, cioe' decisioni che `CLAUDE.md` cita
come invarianti: chi avesse cercato la mappa nell'indice avrebbe concluso che non
esistono.

Un indice che si scrive a mano invecchia; questo si ri-deriva, quindi non puo'.

Cosa preserva
-------------
Le **descrizioni curate** delle righe gia' presenti nel vecchio indice: sono
scritte da una persona, spesso valgono piu' del titolo, e rigenerare non
significa buttarle. Per gli ADR mancanti la descrizione si ricava dal titolo,
ed e' dichiarata come tale (nessuna finzione di curatela). Anche la sezione
`## Conventions` in coda viene riportata intatta: e' contenuto, non struttura.

Due formati di header convivono nel repo e sono gestiti entrambi:
  `**Status**: ACCEPTED`  (ADR recenti)   ·   `- **Status:** Accepted`  (ADR 0001-0018)
I file usano anche trattini Unicode (`‑`, U+2011) nei titoli e nelle date.

Uso:
    python docs/kb/tools/build_adr_index.py            # riscrive l'indice
    python docs/kb/tools/build_adr_index.py --check    # esce 1 se l'indice e' stale
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ADR_DIR = REPO / "docs" / "architecture" / "adr"
INDEX = REPO / "docs" / "architecture" / "ADR_INDEX.md"

# I file usano sia il trattino ASCII sia U+2011 (non-breaking hyphen).
TRATTINI = str.maketrans({"‑": "-", "–": "-", "—": "-"})


def norm(s: str) -> str:
    return s.translate(TRATTINI).strip()


def campo(testa: str, nome: str) -> str:
    """Legge un campo dell'header nei DUE formati in uso."""
    for pat in (rf"^\*\*{nome}\*\*:\s*(.+)$", rf"^-\s*\*\*{nome}:\*\*\s*(.+)$"):
        m = re.search(pat, testa, re.MULTILINE | re.IGNORECASE)
        if m:
            return norm(m.group(1))
    return ""


def leggi_adr() -> list[dict]:
    voci = []
    for f in sorted(ADR_DIR.glob("*.md")):
        num = f.name[:4]
        if not num.isdigit():
            continue
        testo = f.read_text(encoding="utf-8")
        testa = "\n".join(testo.splitlines()[:12])
        titolo = ""
        m = re.search(r"^#\s*ADR[‑\-–—]?0*\d+\s*[—\-–]\s*(.+)$", testa, re.MULTILINE)
        if m:
            titolo = norm(m.group(1))
        else:  # titolo senza il prefisso ADR-NNNN
            m = re.search(r"^#\s*(.+)$", testa, re.MULTILINE)
            titolo = norm(m.group(1)) if m else f.stem
        stato = campo(testa, "Status") or "—"
        # lo stato porta spesso una parentesi esplicativa: nella tabella basta la prima parola
        stato_breve = stato.split("(")[0].split("—")[0].strip() or "—"
        voci.append({
            "num": num, "file": f.name, "titolo": titolo,
            "stato": stato_breve, "data": campo(testa, "Date") or "—",
        })
    return voci


def descrizioni_esistenti() -> dict[str, str]:
    """Recupera le descrizioni curate dal vecchio indice, per non buttarle."""
    if not INDEX.exists():
        return {}
    fuori = {}
    for ln in INDEX.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*\[(\d{4})\]\([^)]*\)\s*\|([^|]*)\|([^|]*)\|(.*)\|([^|]*)\|\s*$", ln)
        if m:
            desc = m.group(4).strip()
            if desc:
                fuori[m.group(1)] = desc
    return fuori


def coda_conventions() -> str:
    """La sezione finale e' contenuto curato: si riporta intatta."""
    if not INDEX.exists():
        return ""
    testo = INDEX.read_text(encoding="utf-8")
    i = testo.find("## Conventions")
    return testo[i:].rstrip() + "\n" if i != -1 else ""


def genera() -> str:
    voci = leggi_adr()
    curate = descrizioni_esistenti()
    righe = [
        "# ADR Index",
        "",
        "> **GENERATO** da `docs/kb/tools/build_adr_index.py` — non editare la tabella a mano.",
        "> Le descrizioni gia' curate sono preservate a ogni rigenerazione; per gli ADR che non",
        "> ne avevano una, la colonna riporta il titolo ed e' marcata *(dal titolo)*.",
        "",
        f"**{len(voci)} ADR** in `docs/architecture/adr/`.",
        "",
        "| # | Titolo | Status | Descrizione | Data |",
        "|---|---|---|---|---|",
    ]
    for v in voci:
        desc = curate.get(v["num"]) or f"{v['titolo']} *(dal titolo)*"
        titolo = v["titolo"].replace("|", "\\|")
        desc = desc.replace("\n", " ")
        righe.append(f"| [{v['num']}](adr/{v['file']}) | {titolo} | {v['stato']} | {desc} | {v['data']} |")
    righe.append("")
    coda = coda_conventions()
    if coda:
        righe.append(coda)
    return "\n".join(righe)


def main() -> int:
    ap = argparse.ArgumentParser(description="Ricostruisce l'indice ADR dai file (sola lettura sugli ADR).")
    ap.add_argument("--check", action="store_true", help="non scrive: esce 1 se l'indice e' stale")
    args = ap.parse_args()

    if not ADR_DIR.is_dir():
        print(f"[ERRORE] directory ADR assente: {ADR_DIR}", file=sys.stderr)
        return 2

    nuovo = genera()
    if args.check:
        attuale = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
        if attuale != nuovo:
            mancanti = sorted({v["num"] for v in leggi_adr()} - set(descrizioni_esistenti()))
            print(f"[STALE] l'indice non combacia con i file. Non elencati: {', '.join(mancanti) or '(solo differenze di forma)'}",
                  file=sys.stderr)
            return 1
        print(f"indice allineato: {len(leggi_adr())} ADR")
        return 0

    # Le descrizioni si contano PRIMA di scrivere: dopo, `descrizioni_esistenti()`
    # rileggerebbe il file appena generato e direbbe che sono tutte curate.
    voci = leggi_adr()
    curate = descrizioni_esistenti()
    preservate = sum(1 for v in voci if v["num"] in curate)

    INDEX.write_text(nuovo, encoding="utf-8")
    print(f"ADR indicizzati    : {len(voci)}  ({voci[0]['num']}..{voci[-1]['num']})")
    print(f"descrizioni        : {preservate} curate preservate · "
          f"{len(voci) - preservate} ricavate dal titolo")
    print(f"file               : {INDEX.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
