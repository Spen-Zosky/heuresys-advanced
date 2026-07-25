#!/usr/bin/env python3
"""
check_module_test_coverage.py — incrocia i moduli API con i file di test che li coprono.

Nasce dal cluster Z-125 del piano «zero pendenze»: ogni censimento automatico precedente
dichiarava `notifications` SCOPERTO, perche' cercava `test/<modulo>*.test.ts` e i suoi test
si chiamano `notification-*.test.ts` (singolare). Era un falso positivo: il modulo e'
coperto da 4 file. Un censimento che mente su un modulo toglie fiducia agli altri 89.

CONVENZIONE (deliberata): il nome del file di test descrive **cosa verifica**, non
necessariamente la directory del modulo. `notification-digest` verifica il digest, che vive
in `src/lib/notifications/`, non in `src/modules/notifications/`. Percio' il match non e'
solo lessicale.

Un modulo M e' COPERTO se esiste almeno un file `apps/api/test/*.test.ts` che:

  1. **nome-file** — il basename inizia con M o con una sua variante singolare/plurale, E M
     e' il modulo con il match PIU' LUNGO fra tutti. Il vincolo del match piu' lungo non e'
     un dettaglio: senza, la variante singolare `skill` di `skills` fa match su
     `skill-aliases.integration.test.ts` e cinque test di ALTRI moduli finiscono per
     "coprire" `skills` — che risulterebbe verde anche cancellando i suoi due test veri.
     Verificato in review adversarial (S1030).
  2. **contenuto** — il file esercita davvero il modulo: una rotta `/v1/M` dentro una
     chiamata (`inject`/`fetch`/`url:`) oppure un `import` da `modules/M/`. I commenti sono
     rimossi prima del match, perche' altrimenti un `// TODO: il modulo X non ha test`
     conteggia come copertura di X — letteralmente il contrario di cio' che afferma.

Uscita: 0 se ogni modulo e' coperto, 1 altrimenti (elenco degli scoperti su stderr).

Uso:
    python docs/kb/tools/check_module_test_coverage.py            # riassunto + exit code
    python docs/kb/tools/check_module_test_coverage.py --verbose  # mappa modulo -> test
    python docs/kb/tools/check_module_test_coverage.py --json     # output machine-readable
    python docs/kb/tools/check_module_test_coverage.py --self-test # esercita i casi noti

I casi che lo strumento DEVE saper distinguere sono in `--self-test`, che gira su fixture
sintetiche in una directory temporanea e non tocca il repo. Fa parte del file di proposito:
un controllo di copertura senza un controllo di se stesso e' una dichiarazione, non una
misura.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULES_DIR = REPO_ROOT / "apps" / "api" / "src" / "modules"
TEST_DIR = REPO_ROOT / "apps" / "api" / "test"

# `//…` a fine riga e blocchi `/*…*/`. Non e' un parser TS: basta a togliere la prosa.
_LINE_COMMENT = re.compile(r"//[^\n]*")
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def strip_comments(text: str) -> str:
    """Rimuove i commenti: una menzione in prosa non e' copertura."""
    return _LINE_COMMENT.sub("", _BLOCK_COMMENT.sub("", text))


def name_variants(module: str) -> set[str]:
    """Varianti lessicali plausibili del nome di un modulo, per il match sul basename."""
    variants = {module}
    if module.endswith("ies"):
        variants.add(module[:-3] + "y")
    elif module.endswith("sses"):
        variants.add(module[:-2])
    elif module.endswith("s") and not module.endswith("ss"):
        variants.add(module[:-1])
    else:
        variants.add(module + "s")
    for v in list(variants):
        variants.add(v.replace("-", "_"))
        variants.add(v.replace("_", "-"))
    return variants


def filename_match_len(stem: str, module: str) -> int:
    """Lunghezza della variante piu' lunga che fa match sul basename; 0 se nessuna."""
    best = 0
    for variant in name_variants(module):
        if stem == variant or re.match(rf"^{re.escape(variant)}([-_.]|$)", stem):
            best = max(best, len(variant))
    return best


def matches_by_content(code: str, module: str) -> bool:
    """Il test esercita la rotta del modulo o ne importa il sorgente (commenti gia' tolti)."""
    if f"modules/{module}/" in code:
        return True
    # la rotta deve comparire dentro una chiamata, non in una stringa qualsiasi
    route = re.escape(f"/v1/{module}")
    return bool(re.search(rf"(inject|fetch|url\s*:|method\s*:)[^\n]{{0,120}}{route}", code)
                or re.search(rf"{route}[^\n]{{0,120}}(inject|method\s*:)", code))


def is_real_test(code: str) -> bool:
    """Un file conta come test solo se contiene almeno un caso eseguibile.

    Senza questo, 217 file VUOTI producono lo stesso identico output di 217 file pieni:
    il match sul nome basta a dichiarare coperto ogni modulo. Dimostrato in review
    adversarial (S1030) replicando la struttura del repo con file da 0 byte. Non rende lo
    strumento una misura di qualita' — resta un censimento di esistenza — ma almeno
    distingue un test da un file che si chiama come un test.
    """
    clean = strip_comments(code)
    return bool(re.search(r"\b(it|test)\s*(\.\w+)?\s*\(", clean))


def compute(modules: list[str], tests: dict[Path, str]) -> dict[str, dict[str, list[str]]]:
    """Mappa modulo -> {by_name, by_content}. Ogni test va al modulo col match piu' lungo."""
    tests = {p: c for p, c in tests.items() if is_real_test(c)}
    # 1) assegnazione per nome-file, vince il match piu' lungo (niente furti di prefisso)
    owner: dict[Path, tuple[str, int]] = {}
    for path in tests:
        stem = path.name.replace(".test.ts", "")
        for module in modules:
            n = filename_match_len(stem, module)
            if n and n > owner.get(path, ("", 0))[1]:
                owner[path] = (module, n)

    coverage = {m: {"by_name": [], "by_content": []} for m in modules}
    for path, (module, _) in owner.items():
        coverage[module]["by_name"].append(path.name)

    # 2) contenuto: vale per QUALSIASI modulo esercitato, anche se il file e' di un altro
    for path, code in tests.items():
        clean = strip_comments(code)
        for module in modules:
            if path.name in coverage[module]["by_name"]:
                continue
            if matches_by_content(clean, module):
                coverage[module]["by_content"].append(path.name)

    for hit in coverage.values():
        hit["by_name"].sort()
        hit["by_content"].sort()
    return coverage


def run(modules_dir: Path, test_dir: Path, verbose: bool, as_json: bool) -> int:
    if not modules_dir.is_dir():
        print(f"ERRORE: directory moduli non trovata: {modules_dir}", file=sys.stderr)
        return 2
    if not test_dir.is_dir():
        print(f"ERRORE: directory test non trovata: {test_dir}", file=sys.stderr)
        return 2

    modules = sorted(p.name for p in modules_dir.iterdir() if p.is_dir())
    tests = {p: p.read_text(encoding="utf-8", errors="replace") for p in sorted(test_dir.glob("*.test.ts"))}
    coverage = compute(modules, tests)
    uncovered = [m for m, hit in coverage.items() if not hit["by_name"] and not hit["by_content"]]

    if as_json:
        print(json.dumps({"modules": len(modules), "test_files": len(tests),
                          "uncovered": uncovered, "coverage": coverage}, indent=2))
        return 1 if uncovered else 0

    if verbose:
        for module in modules:
            hit = coverage[module]
            files = hit["by_name"] + [f"{f} (contenuto)" for f in hit["by_content"]]
            print(f"[{'OK ' if files else 'MISS'}] {module}: {', '.join(files) if files else '-- nessun test --'}")
        print()

    only_content = sum(1 for h in coverage.values() if not h["by_name"] and h["by_content"])
    print(f"moduli: {len(modules)} · file di test: {len(tests)} · scoperti: {len(uncovered)}")
    print(f"  di cui coperti SOLO per contenuto (nome-file divergente): {only_content}")

    if uncovered:
        print("\nMODULI SCOPERTI:", file=sys.stderr)
        for module in uncovered:
            print(f"  - {module}", file=sys.stderr)
        return 1

    print("verdetto: ogni modulo ha almeno un test che lo esercita")
    return 0


# ----------------------------------------------------------------------------- self-test

def _fixture(root: Path, modules: list[str], tests: dict[str, str]) -> tuple[Path, Path]:
    mdir, tdir = root / "modules", root / "test"
    mdir.mkdir(parents=True), tdir.mkdir(parents=True)
    for m in modules:
        (mdir / m).mkdir()
    for name, body in tests.items():
        (tdir / name).write_text(body, encoding="utf8")
    return mdir, tdir


def self_test() -> int:
    """I casi che questo strumento deve saper distinguere. Nessun file del repo e' toccato."""
    cases = []

    def case(label, modules, tests, expect_uncovered):
        with tempfile.TemporaryDirectory() as tmp:
            mdir, tdir = _fixture(Path(tmp), modules, tests)
            ts = {p: p.read_text(encoding="utf8") for p in sorted(tdir.glob("*.test.ts"))}
            cov = compute(modules, ts)
            got = sorted(m for m, h in cov.items() if not h["by_name"] and not h["by_content"])
            ok = got == sorted(expect_uncovered)
            cases.append((label, ok, got, sorted(expect_uncovered)))

    # 1. il caso fondativo: plurale/singolare
    case("notifications coperto da notification-*", ["notifications"],
         {"notification-broadcast.integration.test.ts": "it('x', async () => { await app.inject({url:'/v1/notifications'}) })"}, [])
    # 2. furto di prefisso: skill-aliases NON copre skills
    case("skills senza test propri NON e' coperto da skill-aliases",
         ["skills", "skill-aliases"],
         {"skill-aliases.integration.test.ts": "describe('skill-aliases', () => { it('a', () => {}) })"}, ["skills"])
    # 3. ...e con i suoi test veri torna coperto, senza rubare quelli di skill-aliases
    case("skills coperto dai propri test", ["skills", "skill-aliases"],
         {"skills.integration.test.ts": "describe('skills', () => { it('a', () => {}) })",
          "skill-aliases.integration.test.ts": "describe('skill-aliases', () => { it('b', () => {}) })"}, [])
    # 4. un commento che dice il contrario non e' copertura
    case("commento che nomina il modulo NON copre", ["payroll-exports"],
         {"unrelated.integration.test.ts": "// TODO: /v1/payroll-exports non ha ancora test\ndescribe('x')"},
         ["payroll-exports"])
    # 5. la rotta dentro una inject copre
    case("rotta esercitata copre", ["payroll-exports"],
         {"unrelated.integration.test.ts": "it('x', async () => { await app.inject({ method:'GET', url:'/v1/payroll-exports' }) })"}, [])
    # 6. modulo senza alcun riferimento
    case("modulo orfano risulta scoperto", ["ghost"], {"other.integration.test.ts": "it('other', () => {})"}, ["ghost"])
    # 7. un file VUOTO non copre, nemmeno se porta esattamente il nome del modulo
    case("file vuoto col nome del modulo NON copre", ["billing"],
         {"billing.integration.test.ts": ""}, ["billing"])
    # 8. ...e nemmeno un file con il solo commento
    case("file con solo commenti NON copre", ["billing"],
         {"billing.integration.test.ts": "// it('todo') — da scrivere"}, ["billing"])

    failed = [c for c in cases if not c[1]]
    for label, ok, got, exp in cases:
        print(f"[{'ok  ' if ok else 'FAIL'}] {label}")
        if not ok:
            print(f"        scoperti attesi={exp} ottenuti={got}")
    print(f"\nself-test: {len(cases) - len(failed)}/{len(cases)} passati")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verbose", action="store_true", help="stampa la mappa modulo -> test")
    parser.add_argument("--json", action="store_true", dest="as_json", help="output JSON")
    parser.add_argument("--self-test", action="store_true", help="esercita i casi noti su fixture sintetiche")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return run(MODULES_DIR, TEST_DIR, args.verbose, args.as_json)


if __name__ == "__main__":
    sys.exit(main())
