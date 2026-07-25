#!/usr/bin/env python3
"""
check_module_test_coverage.py — incrocia i moduli API con i file di test che li coprono.

Nasce dal cluster Z-004/Z-125 del piano «zero pendenze»: ogni censimento automatico
precedente dichiarava `notifications` SCOPERTO, perche' cercava `test/<modulo>*.test.ts`
e i suoi test si chiamano `notification-*.test.ts` (singolare). Era un falso positivo:
il modulo e' coperto da 4 file. Un censimento che mente su un modulo mente su tutti —
da qui uno strumento unico, con criterio di match esplicito.

CONVENZIONE (deliberata, non un ripiego): il nome del file di test descrive **cosa
verifica**, non necessariamente la directory del modulo. `notification-digest` verifica
il digest, che vive in `src/lib/notifications/`, non in `src/modules/notifications/`.
Percio' il match non e' solo lessicale: un test conta se referenzia la rotta o il
sorgente del modulo. Rinominare i file per compiacere un glob sarebbe stato il rimedio
sbagliato al problema giusto.

Un modulo M (directory in apps/api/src/modules/) e' COPERTO se esiste almeno un file
in apps/api/test/*.test.ts che soddisfa uno di questi criteri:

  1. nome-file  — il basename inizia con M, o con una sua variante singolare/plurale
                  (notifications -> notification-, skills -> skill-, ...);
  2. contenuto  — il file cita la rotta `/v1/M` oppure importa `modules/M/`.

Uscita: 0 se ogni modulo e' coperto, 1 altrimenti (elenco degli scoperti su stderr).

Uso:
    python docs/kb/tools/check_module_test_coverage.py            # riassunto + exit code
    python docs/kb/tools/check_module_test_coverage.py --verbose  # mappa modulo -> test
    python docs/kb/tools/check_module_test_coverage.py --json     # output machine-readable
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULES_DIR = REPO_ROOT / "apps" / "api" / "src" / "modules"
TEST_DIR = REPO_ROOT / "apps" / "api" / "test"


def name_variants(module: str) -> set[str]:
    """Varianti lessicali plausibili del nome di un modulo, per il match sul basename."""
    variants = {module}
    # plurale -> singolare: notifications -> notification, policies -> policy
    if module.endswith("ies"):
        variants.add(module[:-3] + "y")
    elif module.endswith("sses"):
        variants.add(module[:-2])
    elif module.endswith("s") and not module.endswith("ss"):
        variants.add(module[:-1])
    else:
        # singolare -> plurale (caso simmetrico: un modulo singolare con test al plurale)
        variants.add(module + "s")
    # separatori intercambiabili: assessment-results <-> assessment_results
    for v in list(variants):
        variants.add(v.replace("-", "_"))
        variants.add(v.replace("_", "-"))
    return variants


def matches_by_filename(stem: str, module: str) -> bool:
    """Il basename del test inizia con una variante del modulo, su confine di token."""
    for variant in name_variants(module):
        if stem == variant or re.match(rf"^{re.escape(variant)}([-_.]|$)", stem):
            return True
    return False


def matches_by_content(text: str, module: str) -> bool:
    """Il test cita la rotta del modulo o ne importa il sorgente."""
    return f"/v1/{module}" in text or f"modules/{module}/" in text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verbose", action="store_true", help="stampa la mappa modulo -> test")
    parser.add_argument("--json", action="store_true", dest="as_json", help="output JSON")
    args = parser.parse_args()

    if not MODULES_DIR.is_dir():
        print(f"ERRORE: directory moduli non trovata: {MODULES_DIR}", file=sys.stderr)
        return 2
    if not TEST_DIR.is_dir():
        print(f"ERRORE: directory test non trovata: {TEST_DIR}", file=sys.stderr)
        return 2

    modules = sorted(p.name for p in MODULES_DIR.iterdir() if p.is_dir())
    tests = sorted(TEST_DIR.glob("*.test.ts"))
    test_texts = {p: p.read_text(encoding="utf-8", errors="replace") for p in tests}

    coverage: dict[str, dict[str, list[str]]] = {}
    for module in modules:
        by_name: list[str] = []
        by_content: list[str] = []
        for path, text in test_texts.items():
            stem = path.name.replace(".test.ts", "")
            if matches_by_filename(stem, module):
                by_name.append(path.name)
            elif matches_by_content(text, module):
                by_content.append(path.name)
        coverage[module] = {"by_name": by_name, "by_content": by_content}

    uncovered = [m for m, hit in coverage.items() if not hit["by_name"] and not hit["by_content"]]

    if args.as_json:
        print(json.dumps({
            "modules": len(modules),
            "test_files": len(tests),
            "uncovered": uncovered,
            "coverage": coverage,
        }, indent=2))
        return 1 if uncovered else 0

    if args.verbose:
        for module in modules:
            hit = coverage[module]
            files = hit["by_name"] + [f"{f} (contenuto)" for f in hit["by_content"]]
            mark = "OK " if files else "MISS"
            print(f"[{mark}] {module}: {', '.join(files) if files else '-- nessun test --'}")
        print()

    only_content = sum(1 for h in coverage.values() if not h["by_name"] and h["by_content"])
    print(f"moduli: {len(modules)} · file di test: {len(tests)} · scoperti: {len(uncovered)}")
    print(f"  di cui coperti solo per contenuto (nome-file divergente): {only_content}")

    if uncovered:
        print("\nMODULI SCOPERTI:", file=sys.stderr)
        for module in uncovered:
            print(f"  - {module}", file=sys.stderr)
        return 1

    print("verdetto: ogni modulo ha almeno un test che lo copre")
    return 0


if __name__ == "__main__":
    sys.exit(main())
