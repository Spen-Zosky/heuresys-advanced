#!/usr/bin/env python3
"""
verify_gate.py — cancello di verifica per heuresys-advanced.

Principio: il verdetto e' funzione dello STATO OSSERVABILE, mai della
conversazione. Non chiede "hai verificato?", legge il working tree e gli
exit code. Se lo stato cambia, il verdetto scade da solo.

    input_hash = sha256( HEAD + git status --porcelain + git diff HEAD )

Rieseguire e' idempotente: stesso stato -> stesso verdetto, nessun effetto
collaterale.

Sottocomandi
------------
  route   stampa quali suite servono per il diff corrente (deterministico)
  run     esegue le suite instradate e scrive .zp/verify-verdict.json
  check   confronta hash e verdetto — exit 0 se verde e fresco, 1 altrimenti
          --hook  emette il JSON per l'hook Stop invece del testo

Freno
-----
  .zp/verify-off   se il file esiste, il cancello e' sempre verde.

Il routing riusa i trigger dei workflow CI, cosi' cancello locale e CI non
divergono mai.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VERDICT = REPO / ".zp" / "verify-verdict.json"
BRAKE = REPO / ".zp" / "verify-off"

# --- Layer 1: il router --------------------------------------------------
# prefisso di path -> suite da eseguire. Primo match che vince, in ordine.
ROUTES: list[tuple[str, list[str]]] = [
    ("apps/api/",        ["typecheck", "test-api"]),
    ("packages/shared/", ["typecheck", "test-api"]),
    ("apps/web/",        ["typecheck", "lint"]),
    ("apps/showcase/",   ["typecheck", "lint"]),
    ("db/migrations/",   ["migrate-idempotent"]),
    ("db/",              ["typecheck"]),
    ("scripts/",         ["shell-tests"]),
    # solo i file di stato governati dall'handoff, non i tool sotto docs/kb/tools/
    ("docs/kb/SOT_",     ["handoff-lint"]),
    ("docs/kb/DEBT_",    ["handoff-lint"]),
    ("docs/kb/tools/handoff_lint.py", ["handoff-lint"]),
    (".handoff/",        ["handoff-lint"]),
]

# suite -> (livello, comando). I livelli seguono la piramide del playbook:
# L0 statica · L1 contratto · L2 integrazione su dati reali · L3 end-to-end.
SUITES: dict[str, tuple[str, str]] = {
    "typecheck":          ("L0", "pnpm typecheck"),
    "lint":               ("L0", "pnpm lint"),
    "test-api":           ("L2", "pnpm --filter @heuresys/api test"),
    "migrate-idempotent": ("L2", "pnpm db:migrate:sh && pnpm db:migrate:sh"),
    "shell-tests":        ("L1", "bash scripts/test/run-shell-tests.sh"),
    "handoff-lint":       ("L1", "python docs/kb/tools/handoff_lint.py"),
    # Cruscotto DBMS: definito qui, instradato su db/** solo quando l'esito e'
    # verde (fine della bonifica #89/#91). Un gate che nasce rosso insegna solo
    # ad aggirarlo: si accende quando puo' passare.
    "db-health":          ("L2", "python docs/kb/tools/db_health.py"),
}

# L3 (Playwright) NON e' instradato automaticamente: costa minuti e va
# chiesto esplicitamente con `run --with-e2e`. Vedi Definition of Done —
# la prova live resta obbligatoria per chiudere un work-item, ma non e'
# il cancello di fine turno.
E2E = ("L3", "cd apps/web && pnpm test:e2e:prod:node22")


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO), *args],
        capture_output=True, text=True, check=False,
    ).stdout


def changed_files() -> list[str]:
    """File toccati rispetto a HEAD, tracciati e non."""
    out: set[str] = set()
    for line in git("status", "--porcelain").splitlines():
        p = line[3:].strip().strip('"')
        if p:
            out.add(p.split(" -> ")[-1])
    for p in git("diff", "HEAD", "--name-only").splitlines():
        if p.strip():
            out.add(p.strip())
    return sorted(out)


def input_hash() -> str:
    h = hashlib.sha256()
    h.update(git("rev-parse", "HEAD").encode())
    h.update(git("status", "--porcelain").encode())
    h.update(git("diff", "HEAD").encode())
    return h.hexdigest()


def route(files: list[str]) -> list[str]:
    suites: list[str] = []
    for f in files:
        norm = f.replace("\\", "/")
        for prefix, names in ROUTES:
            if norm.startswith(prefix):
                for n in names:
                    if n not in suites:
                        suites.append(n)
                break
    return suites


# --- Layer 2: il collector ----------------------------------------------

def run_suites(names: list[str], with_e2e: bool) -> dict:
    results = []
    plan = [(n, *SUITES[n]) for n in names]
    if with_e2e:
        plan.append(("e2e", *E2E))
    for name, level, cmd in plan:
        t0 = time.time()
        proc = subprocess.run(cmd, shell=True, cwd=REPO,
                              capture_output=True, text=True)
        tail = (proc.stdout + proc.stderr).strip().splitlines()[-15:]
        results.append({
            "suite": name,
            "level": level,
            "cmd": cmd,
            "exit": proc.returncode,
            "duration_s": round(time.time() - t0, 1),
            "tail": tail,
        })
        print(f"  [{level}] {name:<20} exit={proc.returncode} "
              f"({results[-1]['duration_s']}s)")
    return {
        "input_hash": input_hash(),
        "head": git("rev-parse", "HEAD").strip(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "routed": names + (["e2e"] if with_e2e else []),
        "results": results,
        "verdict": "green" if all(r["exit"] == 0 for r in results) else "red",
    }


# --- Layer 3: il gate ----------------------------------------------------

def check() -> tuple[bool, str]:
    """(ok, motivo). ok=True significa: si puo' chiudere il turno."""
    if BRAKE.exists():
        return True, "freno tirato (.zp/verify-off)"

    files = changed_files()
    needed = route(files)
    if not needed:
        return True, "nessuna modifica che richieda verifica"

    if not VERDICT.exists():
        return False, (
            f"{len(files)} file modificati richiedono le suite "
            f"{', '.join(needed)}, ma non esiste ancora un verdetto. "
            f"Esegui: python docs/kb/tools/verify_gate.py run"
        )

    try:
        v = json.loads(VERDICT.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return False, f"verdetto illeggibile ({exc}). Riesegui: verify_gate.py run"

    if v.get("input_hash") != input_hash():
        return False, (
            "il verdetto e' scaduto: lo stato del working tree e' cambiato "
            "dopo l'ultima verifica. Riesegui: "
            "python docs/kb/tools/verify_gate.py run"
        )

    if v.get("verdict") != "green":
        failed = [r["suite"] for r in v.get("results", []) if r["exit"] != 0]
        return False, (
            f"l'ultima verifica e' ROSSA su: {', '.join(failed)}. "
            f"Correggi e riesegui verify_gate.py run. "
            f"Dettaglio in {VERDICT.relative_to(REPO)}"
        )

    return True, "verdetto verde e fresco"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["route", "run", "check"])
    ap.add_argument("--hook", action="store_true",
                    help="check: emetti il JSON per l'hook Stop")
    ap.add_argument("--with-e2e", action="store_true",
                    help="run: aggiungi la suite Playwright (L3, minuti)")
    args = ap.parse_args()

    if args.cmd == "route":
        files = changed_files()
        needed = route(files)
        print(f"{len(files)} file modificati")
        for f in files[:30]:
            print(f"  · {f}")
        if len(files) > 30:
            print(f"  … e altri {len(files) - 30}")
        print(f"\nsuite instradate: {', '.join(needed) if needed else '(nessuna)'}")
        for n in needed:
            lvl, cmd = SUITES[n]
            print(f"  [{lvl}] {n:<20} {cmd}")
        return 0

    if args.cmd == "run":
        files = changed_files()
        needed = route(files)
        if not needed and not args.with_e2e:
            print("nessuna modifica che richieda verifica — niente da eseguire")
            VERDICT.parent.mkdir(parents=True, exist_ok=True)
            VERDICT.write_text(json.dumps({
                "input_hash": input_hash(),
                "head": git("rev-parse", "HEAD").strip(),
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "routed": [], "results": [], "verdict": "green",
            }, indent=2, ensure_ascii=False), encoding="utf-8")
            return 0
        print(f"{len(files)} file modificati → suite: {', '.join(needed)}")
        verdict = run_suites(needed, args.with_e2e)
        VERDICT.parent.mkdir(parents=True, exist_ok=True)
        VERDICT.write_text(json.dumps(verdict, indent=2, ensure_ascii=False),
                           encoding="utf-8")
        print(f"\nverdetto: {verdict['verdict'].upper()} → "
              f"{VERDICT.relative_to(REPO)}")
        return 0 if verdict["verdict"] == "green" else 1

    ok, reason = check()
    if args.hook:
        if not ok:
            print(json.dumps({"decision": "block", "reason": reason},
                             ensure_ascii=False))
        return 0          # l'hook non usa exit 2: il blocco viaggia nel JSON
    print(("VERDE  — " if ok else "BLOCCO — ") + reason)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
