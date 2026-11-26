#!/usr/bin/env python3
"""
check_metro_adr0063.py — ogni ADR e ogni piano nuovo dichiara il suo metro (ADR-0063 D10, voce Z5).

ADR-0063 D10: «Ogni ADR, piano, programma e voce di backlog nuovo dichiara quale asse e quale
criterio di D1 serve». Questo controllo lo rende inaggirabile in CI (state-lint.yml).

Che cosa e' «nuovo»:
  - un ADR `docs/architecture/adr/NNNN_*.md` con NNNN >= 64;
  - un piano `docs/piani/**/PIANO_*_AAAAMMGG.md` con data nel nome >= 20261126
    (esente il piano fondante `PIANO_heuresys-ai-driven_20261126.md`, che e' il metro stesso).
Tutto cio' che e' precedente non si tocca: lo riesamina la voce Z4.

La dichiarazione e' una riga che comincia con «Metro ADR-0063» (anche in grassetto, in
un elenco o in una citazione):

    Metro ADR-0063: asse 3, 4; criterio 1
    Metro ADR-0063: asse nessuno (solo infrastruttura di CI); criterio nessuno (idem)

  - asse: uno o piu' numeri da 1 a 12 (i dodici assi della sezione 3 del piano);
  - criterio: uno o piu' numeri da 1 a 7 (i sette criteri di ADR-0063 D1);
  - «nessuno» e' ammesso solo con una ragione fra parentesi di almeno 15 caratteri.

Uso:
  python3 docs/kb/tools/check_metro_adr0063.py            # controlla il repo
  python3 docs/kb/tools/check_metro_adr0063.py --selftest # prova lo strumento su un repo finto
Uscita: 0 verde, 1 almeno una dichiarazione mancante o malformata.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

ASSI = range(1, 13)
CRITERI = range(1, 8)
DATA_MINIMA = 20261126
ADR_MINIMO = 64
ESENTI = {"PIANO_heuresys-ai-driven_20261126.md"}

RIGA = re.compile(r"^[\s>*\-_#]*Metro ADR-0063[\s*_]*:(.*)$", re.IGNORECASE | re.MULTILINE)
CAMPO = re.compile(r"\b(asse|assi|criterio|criteri)\b\s*[:=]?\s*([^;]*)", re.IGNORECASE)
NESSUNO = re.compile(r"^\s*nessuno\s*\(([^)]{15,})\)", re.IGNORECASE)


def radice() -> Path:
    return Path(__file__).resolve().parents[3]


def file_nuovi(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in sorted((root / "docs/architecture/adr").glob("[0-9][0-9][0-9][0-9]_*.md")):
        if int(p.name[:4]) >= ADR_MINIMO:
            out.append(p)
    for p in sorted((root / "docs/piani").rglob("PIANO_*.md")):
        m = re.search(r"_(\d{8})\.md$", p.name)
        if m and int(m.group(1)) >= DATA_MINIMA and p.name not in ESENTI:
            out.append(p)
    return out


def valuta(testo: str) -> str | None:
    """None se la dichiarazione e' valida, altrimenti il motivo del rosso."""
    righe = RIGA.findall(testo)
    if not righe:
        return "manca la riga «Metro ADR-0063: asse N; criterio N»"
    resto = righe[0]
    trovati: dict[str, str] = {}
    for nome, valore in CAMPO.findall(resto):
        trovati["asse" if nome.lower().startswith("ass") else "criterio"] = valore.strip()
    for chiave, ammessi in (("asse", ASSI), ("criterio", CRITERI)):
        v = trovati.get(chiave)
        if v is None:
            return f"nella riga Metro manca il campo «{chiave}»"
        if NESSUNO.match(v):
            continue
        if re.match(r"^\s*nessuno\b", v, re.IGNORECASE):
            return f"«{chiave} nessuno» vuole una ragione fra parentesi di almeno 15 caratteri"
        numeri = [int(n) for n in re.findall(r"\d+", v)]
        if not numeri:
            return f"«{chiave}» senza numeri"
        fuori = [n for n in numeri if n not in ammessi]
        if fuori:
            return f"«{chiave}» fuori dall'intervallo {ammessi.start}-{ammessi.stop - 1}: {fuori}"
    return None


def controlla(root: Path) -> list[str]:
    rossi = []
    for p in file_nuovi(root):
        motivo = valuta(p.read_text(encoding="utf-8", errors="replace"))
        if motivo:
            rossi.append(f"{p.relative_to(root)}: {motivo}")
    return rossi


def selftest() -> int:
    ok_riga = "Metro ADR-0063: asse 3, 4; criterio 1\n"
    casi = [  # (percorso, contenuto, atteso_rosso)
        ("docs/architecture/adr/0064_buono.md", "# ADR\n\n**Metro ADR-0063**: asse 3, 4; criterio 1\n", False),
        ("docs/architecture/adr/0065_senza.md", "# ADR\nniente\n", True),
        ("docs/architecture/adr/0066_asse_fuori.md", "Metro ADR-0063: asse 13; criterio 1\n", True),
        ("docs/architecture/adr/0067_criterio_manca.md", "Metro ADR-0063: asse 2\n", True),
        ("docs/architecture/adr/0068_nessuno_ok.md",
         "- Metro ADR-0063: asse nessuno (solo infrastruttura di CI); criterio nessuno (idem: nessun effetto sugli agenti)\n", False),
        ("docs/architecture/adr/0069_nessuno_muto.md", "Metro ADR-0063: asse nessuno; criterio 1\n", True),
        ("docs/architecture/adr/0050_vecchio.md", "senza dichiarazione ma anteriore\n", False),
        ("docs/piani/PIANO_finto_20261127.md", "# Piano finto senza dichiarazione\n", True),
        ("docs/piani/PIANO_finto_ok_20261127.md", ok_riga, False),
        ("docs/piani/PIANO_vecchio_20261120.md", "anteriore\n", False),
        ("docs/piani/PIANO_heuresys-ai-driven_20261126.md", "esente: e' il metro\n", False),
        ("docs/piani/sotto/PIANO_annidato_20261128.md", "niente\n", True),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for rel, contenuto, _ in casi:
            f = root / rel
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(contenuto, encoding="utf-8")
        rossi = {r.split(":")[0] for r in controlla(root)}
    attesi = {rel for rel, _, rosso in casi if rosso}
    ok = rossi == attesi
    print(f"selftest: rossi {sorted(rossi)}")
    if not ok:
        print(f"  attesi {sorted(attesi)}", file=sys.stderr)
    print(f"selftest: {len(attesi)} rossi attesi, {len(rossi)} trovati -> {'OK' if ok else 'FALLITO'}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--selftest", action="store_true", help="prova lo strumento su un repo finto")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    root = radice()
    nuovi = file_nuovi(root)
    rossi = controlla(root)
    for r in rossi:
        print(f"ROSSO {r}", file=sys.stderr)
    print(f"check_metro_adr0063: {len(nuovi)} file nuovi controllati, {len(rossi)} senza metro valido")
    return 1 if rossi else 0


if __name__ == "__main__":
    sys.exit(main())
