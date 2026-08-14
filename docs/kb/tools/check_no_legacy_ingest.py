#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Il rubinetto del brownfield e' chiuso — e questo controllo lo tiene chiuso.

ADR-0038 (2026-08-14, Enzo): *«Nessun dato riferito al brownfield deve essere rimesso
in circolo. Tutto va ricostruito con il DBMS attuale.»*

PERCHE' UNO STRUMENTO E NON UN PARAGRAFO
----------------------------------------
Una regola che vive solo in un documento viene aggirata per distrazione, non per scelta:
fra sei mesi qualcuno scrive uno script di estrazione perche' «serviva un dato» e nessuno
se ne accorge. Questo controllo rende la regola meccanica. Non vieta di LEGGERE il legacy
per capire un dominio: vieta che compaia un artefatto NUOVO che ne prende le righe.

COSA CONTROLLA
--------------
Gli artefatti storici che nominano il database legacy sono **congelati** in
`legacy_ingest_allowlist.txt`. Se un file nuovo lo nomina, questo esce **1** e dice quale.
L'elenco si allarga solo modificando quel file — cioe' con una decisione esplicita.

COSA NON E'
-----------
- **Non tocca `reference_sync`**: ISTAT, ATECO, ESCO, NACE sono classificazioni ufficiali
  esterne, non il brownfield. Confonderli e' l'errore piu' facile leggendo l'ADR.
- **Non rimuove nulla**: gli artefatti storici restano: la catena si ri-applica per intero
  a ogni deploy (ADR-0034) e cancellarli riscriverebbe la provenienza dei dati (ADR-0035).

USO
---
    python docs/kb/tools/check_no_legacy_ingest.py             # exit 1 su artefatto nuovo
    python docs/kb/tools/check_no_legacy_ingest.py --elenco    # stampa cio' che e' noto
    python docs/kb/tools/check_no_legacy_ingest.py --selftest  # prove che possono fallire
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

RADICE = Path(__file__).resolve().parents[3]
ALLOWLIST = Path(__file__).resolve().parent / "legacy_ingest_allowlist.txt"

# I nomi che identificano il database LEGACY come sorgente. Non `brownfield` da solo:
# quello schema e' stato ritirato (#164 F4) e la parola compare in decine di documenti
# storici — cercarla produrrebbe rumore invece che un cancello.
SPIE = re.compile(r"(heuresys_evo_platform_db|heuresys_platform)")

ESTENSIONI = {".ts", ".tsx", ".sql", ".sh", ".ps1", ".mjs", ".js", ".py"}
CARTELLE = ("apps", "db", "scripts", "packages", "docs/kb/tools")
IGNORA = ("node_modules", ".next", "dist", ".git", "extracted",
          "_inspection_artifacts", "source_bundle")

# Questo file contiene i nomi del legacy perche' e' LUI a cercarli: escluderlo e'
# autoriferimento, non una deroga. Alla prima corsa il cancello ha infatti segnalato
# se stesso — la prova migliore che funziona. Va tolto qui e non messo in allowlist,
# perche' l'allowlist elenca la STORIA dell'ingestione e questo strumento non ne fa parte.
SE_STESSO = {"docs/kb/tools/check_no_legacy_ingest.py"}


def leggi_allowlist(percorso: Path | None = None) -> set[str]:
    p = percorso or ALLOWLIST
    if not p.is_file():
        return set()
    fuori = set()
    for riga in p.read_text(encoding="utf-8").splitlines():
        riga = riga.split("#", 1)[0].strip()
        if riga:
            fuori.add(riga.replace("\\", "/"))
    return fuori


def scansiona(radice: Path | None = None) -> list[str]:
    """I file che nominano il DB legacy, in percorso relativo con barre normali."""
    r = radice or RADICE
    trovati = []
    for cartella in CARTELLE:
        base = r / cartella
        if not base.is_dir():
            continue
        for f in base.rglob("*"):
            if not f.is_file() or f.suffix not in ESTENSIONI:
                continue
            rel = f.relative_to(r).as_posix()
            if any(x in rel for x in IGNORA) or rel in SE_STESSO:
                continue
            try:
                if SPIE.search(f.read_text(encoding="utf-8", errors="ignore")):
                    trovati.append(rel)
            except Exception:
                continue
    return sorted(trovati)


def verifica(radice: Path | None = None, allow: Path | None = None) -> tuple[list[str], list[str]]:
    """Ritorna (nuovi, spariti). `nuovi` non vuoto = il cancello e' rosso."""
    presenti = set(scansiona(radice))
    noti = leggi_allowlist(allow)
    return sorted(presenti - noti), sorted(noti - presenti)


def _selftest() -> int:
    import tempfile
    esiti: list[tuple[str, bool]] = []

    def prova(nome, cond):
        esiti.append((nome, bool(cond)))

    with tempfile.TemporaryDirectory() as td:
        r = Path(td)
        (r / "db" / "scripts").mkdir(parents=True)
        (r / "apps").mkdir(parents=True)
        allow = r / "allow.txt"

        # storico noto
        (r / "db" / "scripts" / "storico.sh").write_text(
            "psql -d heuresys_platform -c 'select 1'\n", encoding="utf-8")
        allow.write_text("# storici\ndb/scripts/storico.sh\n", encoding="utf-8")
        nuovi, spariti = verifica(r, allow)
        prova("lo storico in allowlist non e' un difetto", nuovi == [])
        prova("nessun file dichiarato ma assente", spariti == [])

        # artefatto NUOVO -> deve scattare
        (r / "db" / "scripts" / "nuovo_import.sh").write_text(
            "pg_dump -d heuresys_platform > /tmp/x.sql\n", encoding="utf-8")
        nuovi, _ = verifica(r, allow)
        prova("un artefatto nuovo fa scattare il cancello",
              nuovi == ["db/scripts/nuovo_import.sh"])

        # il nome dell'altro container
        (r / "apps" / "svc.ts").write_text(
            'const host = "heuresys_evo_platform_db";\n', encoding="utf-8")
        nuovi, _ = verifica(r, allow)
        prova("anche il nome del container fa scattare", "apps/svc.ts" in nuovi)

        # CONTROLLO NEGATIVO: reference_sync non deve far scattare nulla
        (r / "db" / "scripts" / "sync_istat.sh").write_text(
            "psql -c 'INSERT INTO reference_sync.source_exports ...' # ATECO/ESCO\n",
            encoding="utf-8")
        nuovi, _ = verifica(r, allow)
        prova("reference_sync (ISTAT/ATECO/ESCO) NON fa scattare il cancello",
              "db/scripts/sync_istat.sh" not in nuovi)

        # CONTROLLO NEGATIVO: la parola 'brownfield' da sola non basta
        (r / "db" / "scripts" / "nota.sql").write_text(
            "-- residuo brownfield, ritirato da #164 F4\n", encoding="utf-8")
        nuovi, _ = verifica(r, allow)
        prova("la sola parola 'brownfield' non fa scattare",
              "db/scripts/nota.sql" not in nuovi)

        # estensione fuori elenco (un .md non e' un artefatto eseguibile)
        (r / "db" / "scritto.md").write_text("heuresys_platform\n", encoding="utf-8")
        nuovi, _ = verifica(r, allow)
        prova("un documento .md non e' un artefatto di ingestione",
              "db/scritto.md" not in nuovi)

        # un file dichiarato ma sparito viene segnalato (allowlist stantia)
        allow.write_text("db/scripts/storico.sh\ndb/scripts/mai-esistito.sh\n", encoding="utf-8")
        _, spariti = verifica(r, allow)
        prova("un file in allowlist ma assente viene segnalato",
              spariti == ["db/scripts/mai-esistito.sh"])

        # allowlist mancante: tutto e' nuovo (fail-safe, non fail-open)
        nuovi, _ = verifica(r, r / "non-esiste.txt")
        prova("senza allowlist il cancello e' CHIUSO, non aperto", len(nuovi) >= 3)

    for nome, ok in esiti:
        print(f"  [{'OK' if ok else '!!'}] {nome}")
    verdi = sum(1 for _, ok in esiti if ok)
    print(f"\n{verdi}/{len(esiti)} verdi")
    if verdi == len(esiti):
        print("SELFTEST VERDE")
        return 0
    print("SELFTEST ROSSO")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Il rubinetto del brownfield e' chiuso (ADR-0038): nessun artefatto NUOVO "
                    "puo' prendere righe dal database legacy.")
    ap.add_argument("--elenco", action="store_true", help="stampa gli artefatti storici noti")
    ap.add_argument("--selftest", action="store_true", help="prove che possono fallire")
    args = ap.parse_args()

    if args.selftest:
        return _selftest()

    if args.elenco:
        noti = sorted(leggi_allowlist())
        print(f"{len(noti)} artefatti storici noti (congelati da ADR-0038):")
        for n in noti:
            print(f"  {n}")
        return 0

    nuovi, spariti = verifica()

    for s in spariti:
        print(f"  [..] in allowlist ma non piu' presente: {s}  (elenco da ripulire)")

    if not nuovi:
        noti = leggi_allowlist()
        print(f"OK — nessun artefatto nuovo prende righe dal legacy "
              f"({len(noti)} storici noti, congelati da ADR-0038).")
        return 0

    print("ROSSO — artefatti NUOVI che nominano il database legacy come sorgente:\n")
    for n in nuovi:
        print(f"  [!!] {n}")
    print("\nADR-0038: il rubinetto e' chiuso. Cio' che manca si costruisce dal DBMS attuale.")
    print("Se questo file e' legittimo (p.es. una lettura di soli CONCETTI), va aggiunto a")
    print(f"  {ALLOWLIST.relative_to(RADICE).as_posix()}  con il motivo scritto accanto.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
