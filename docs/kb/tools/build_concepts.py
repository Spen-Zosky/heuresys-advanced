#!/usr/bin/env python3
"""
build_concepts.py — corpus dei CONCETTI DI DOMINIO, derivato dall'atlante.

Perche' esiste
--------------
L'agent-gateway espone un catalogo di strumenti che copre una frazione del
dominio (17 letture su 95 moduli). ADR-0033 propone di sostituirlo con pochi
strumenti generici che navigano il dominio, e il loro dizionario **non si scrive
a mano**: si deriva da `docs/kb/atlas/atlas.yaml`, che gia' mappa moduli,
endpoint, permessi e tabelle e si rigenera dal codice e dal DB vivo. Cosi' uno
schema che cambia rende l'agente capace di vedere le entita' nuove senza che
nessuno colleghi uno strumento.

Un concetto = un MODULO API
---------------------------
Non l'endpoint (569: troppo fine e ripetitivo — `GET /` e `GET /:id` dello
stesso modulo direbbero quasi la stessa cosa), non la tabella (269: nomi poveri,
e non e' cio' che l'agente chiama). Il modulo e' l'unita' che l'agente deve
SCEGLIERE per poi agire.

Il testo si deriva meccanicamente da nome, prefisso, verbi, permessi, tabelle e
volume dati: **nessun glossario scritto a mano**. Un corpus aggiustato a mano
misurerebbe la mano, non l'architettura — e la misura del 2026-08-07 (8/10 sui
primi 3, referto in `recupero-misura.json`) vale proprio perche' non lo e'.

Parser mirato invece di PyYAML: la dipendenza non e' installata e non se ne
aggiungono. `atlas.yaml` e' generato da uno strumento nostro con indentazione
fissa, quindi il parsing e' deterministico quanto il file.

Uso:
    python docs/kb/tools/build_concepts.py            # scrive docs/kb/atlas/concepts-corpus.jsonl
    python docs/kb/tools/build_concepts.py --check    # non scrive: fallisce se il corpus e' stale

Da rieseguire dopo ogni `build_atlas.py`: il corpus e' una vista dell'atlante e
invecchia con lui.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ATLAS = REPO / "docs" / "kb" / "atlas" / "atlas.yaml"
OUT = REPO / "docs" / "kb" / "atlas" / "concepts-corpus.jsonl"

VERBI = {"GET": "consultare", "POST": "creare", "PATCH": "aggiornare",
         "PUT": "aggiornare", "DELETE": "eliminare"}


def parole(s: str) -> str:
    """`career-path-steps` / `sys.sys_user_pay_slips` -> parole separate."""
    s = re.sub(r"^sys\.sys_|^sys_|^audit\.|^staging\.|^brownfield\.", "", s)
    return re.sub(r"[-_.]+", " ", s).strip()


def leggi_volumi(righe: list[str]) -> dict[str, int]:
    """Righe per tabella dalla sezione `db` (coppie `- - nome` / `- N`)."""
    volumi: dict[str, int] = {}
    in_db = False
    ultima = None
    for ln in righe:
        if re.match(r"^db:$", ln):
            in_db = True
            continue
        if in_db and re.match(r"^[a-z_]+:$", ln):
            break
        if not in_db:
            continue
        m = re.match(r"^\s+- - (\S+)$", ln)
        if m:
            ultima = m.group(1)
            continue
        m = re.match(r"^\s+- (\d+)$", ln)
        if m and ultima:
            volumi[ultima] = int(m.group(1))
            ultima = None
    return volumi


def leggi_moduli(righe: list[str]) -> dict[str, dict]:
    moduli: dict[str, dict] = {}
    in_api = False
    mod = None
    campo = None
    for ln in righe:
        if re.match(r"^api:$", ln):
            in_api = True
            continue
        if in_api and re.match(r"^[a-z_]+:$", ln):
            break
        if not in_api:
            continue
        m = re.match(r"^  ([a-z0-9][a-z0-9-]*):$", ln)
        if m:
            mod = m.group(1)
            moduli[mod] = {"prefixes": [], "methods": [], "permissions": [], "tables": []}
            campo = None
            continue
        if mod is None:
            continue
        m = re.match(r"^    ([a-z]+):", ln)
        if m:
            campo = m.group(1)
            continue
        if campo == "prefixes":
            m = re.match(r"^      - (\S+)$", ln)
            if m:
                moduli[mod]["prefixes"].append(m.group(1))
        elif campo == "routes":
            m = re.match(r"^      - method: (\S+)$", ln)
            if m:
                moduli[mod]["methods"].append(m.group(1))
            m = re.match(r'^        permission: "?([^"\s]+)"?$', ln)
            if m and m.group(1) != "null":
                moduli[mod]["permissions"].append(m.group(1))
        elif campo == "tables":
            m = re.match(r"^      - (\S+)$", ln)
            if m:
                moduli[mod]["tables"].append(m.group(1))
    return moduli


def costruisci() -> list[dict]:
    righe = ATLAS.read_text(encoding="utf-8").splitlines()
    volumi = leggi_volumi(righe)
    moduli = leggi_moduli(righe)

    corpus = []
    for nome, d in sorted(moduli.items()):
        verbi = sorted({VERBI.get(m, m.lower()) for m in d["methods"]})
        permessi = sorted(set(d["permissions"]))
        risorse = sorted({p.split(":")[0] for p in permessi})
        tabelle = sorted(set(d["tables"]))
        parti = [
            f"{parole(nome)}.",
            f"Permette di {', '.join(verbi)}." if verbi else "",
            f"Risorse: {', '.join(parole(r) for r in risorse)}." if risorse else "",
            f"Dati: {', '.join(parole(t) for t in tabelle[:8])}." if tabelle else "",
            f"Indirizzo {' '.join(d['prefixes'])}." if d["prefixes"] else "",
        ]
        corpus.append({
            "id": nome,
            "text": " ".join(p for p in parti if p),
            "prefixes": d["prefixes"],
            "permissions": permessi,
            "tables": tabelle,
            "n_routes": len(d["methods"]),
            "n_rows": sum(volumi.get(t, 0) for t in tabelle),
        })
    return corpus


def main() -> int:
    ap = argparse.ArgumentParser(description="Corpus dei concetti di dominio (sola lettura sull'atlante).")
    ap.add_argument("--check", action="store_true",
                    help="non scrive: esce 1 se il corpus su disco non combacia con l'atlante")
    args = ap.parse_args()

    if not ATLAS.exists():
        print(f"[ERRORE] atlante assente: {ATLAS} — esegui prima build_atlas.py", file=sys.stderr)
        return 2

    corpus = costruisci()
    testo = "\n".join(json.dumps(c, ensure_ascii=False) for c in corpus) + "\n"

    if args.check:
        attuale = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if attuale != testo:
            print(f"[STALE] {OUT.name} non combacia con l'atlante: rieseguire senza --check", file=sys.stderr)
            return 1
        print(f"corpus allineato all'atlante: {len(corpus)} concetti")
        return 0

    OUT.write_text(testo, encoding="utf-8")
    print(f"concetti     : {len(corpus)}")
    print(f"file         : {OUT.relative_to(REPO)}")
    print(f"senza tabelle: {sum(1 for c in corpus if not c['tables'])}")
    print(f"testo (car.) : min {min(len(c['text']) for c in corpus)} · "
          f"media {sum(len(c['text']) for c in corpus) // len(corpus)} · "
          f"max {max(len(c['text']) for c in corpus)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
