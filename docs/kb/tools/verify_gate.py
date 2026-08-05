#!/usr/bin/env python3
"""
verify_gate.py — cancello di verifica per heuresys-advanced.

Principio: il verdetto e' funzione dello STATO OSSERVABILE, mai della
conversazione. Non chiede "hai verificato?", legge il working tree e gli
exit code. Se lo stato cambia, il verdetto scade da solo.

Freschezza PER SUITE (S1045)
----------------------------
Ogni suite porta l'impronta dei SOLI file che la instradano, presa sul
contenuto:

    scope(suite) = sha256( contenuto dei file modificati che instradano suite )

Prima l'impronta era una sola per tutto (HEAD + status + diff): correggere una
pagina di `apps/web` scadeva anche i 37 minuti di `test-api`, e modificare
questo stesso file — che non instrada alcuna suite — azzerava il verdetto. Con
una suite cosi' lunga il ciclo «correggi -> verifica» non converge: ogni
correzione suggerita dal verdetto invalida il verdetto, e l'hook Stop rimanda
all'inizio. Da qui la granularita' per suite, e `run` che riesegue solo cio'
che serve.

Conseguenza voluta: `git commit` non scade piu' niente — il contenuto
verificato e' lo stesso, cambia solo dove e' scritto.

Rieseguire e' idempotente: stesso stato -> stesso verdetto, nessun effetto
collaterale.

Sottocomandi
------------
  route   stampa quali suite servono per il diff corrente (deterministico)
  run     esegue le suite scadute o rosse e scrive .zp/verify-verdict.json;
          quelle gia' verdi sullo stesso contenuto si riusano
          --all   riesegui tutto, anche cio' che e' gia' verde
  check   confronta impronte ed exit code — exit 0 se verde e fresco
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
    ("db/migrations/",   ["migrate-idempotent", "db-health", "no-contamination"]),
    ("db/",              ["typecheck", "db-health", "no-contamination"]),
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
    # Cruscotto DBMS e guardia anti-contaminazione: instradati su db/** dal
    # momento in cui il loro esito e' verde (2026-08-03, chiusura #89/#91).
    # Un gate che nasce rosso insegna soltanto ad aggirarlo.
    "db-health":          ("L2", "python docs/kb/tools/db_health.py"),
    "no-contamination":   ("L2", "python docs/kb/tools/check_tenant_contamination.py"),
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


# --- Freschezza PER SUITE (S1045) ---------------------------------------
# Prima la freschezza era UN hash solo: HEAD + status + diff dell'intero albero.
# Conseguenza misurata in S1045: corretta una pagina di `apps/web`, scadevano
# anche i 37 minuti di `test-api` che quella pagina non tocca — e persino
# modificare QUESTO file, che non instrada alcuna suite, azzerava tutto. Con una
# suite cosi' lunga il ciclo «correggi -> verifica» non converge: ogni correzione
# nata dal verdetto invalida il verdetto stesso, e l'hook Stop rimanda all'inizio.
#
# Ora ogni suite porta l'impronta dei SOLI file che la instradano, presa sul
# CONTENUTO. Due conseguenze volute:
#   * toccare `apps/web` scade `typecheck`/`lint`, non `test-api`;
#   * `git commit` non scade niente — il contenuto verificato e' lo stesso, e
#     cambia solo dove e' scritto (prima HEAD entrava nell'hash: committare i
#     file appena verificati li rendeva da riverificare).
# Cio' che NON cambia: una suite si considera passata solo se e' stata eseguita
# davvero su quel contenuto. Nessuna scorciatoia, granularita' diversa.

def files_for_suite(suite: str, files: list[str]) -> list[str]:
    """I file modificati che instradano QUESTA suite (primo prefisso che vince)."""
    out: list[str] = []
    for f in files:
        norm = f.replace("\\", "/")
        for prefix, names in ROUTES:
            if norm.startswith(prefix):
                if suite in names:
                    out.append(f)
                break
    return sorted(out)


def content_hash(paths: list[str]) -> str:
    """Impronta del CONTENUTO dei file indicati (non del loro stato git)."""
    h = hashlib.sha256()
    for p in paths:
        h.update(p.encode())
        fp = REPO / p
        try:
            if fp.is_dir():
                # `git status --porcelain` collassa una directory non tracciata in
                # una voce sola (es. `?? .zp/`): non c'e' un contenuto da leggere,
                # e il nome basta perche' nessuna directory simile instrada suite.
                h.update(b"<dir>")
            elif fp.exists():
                h.update(hashlib.sha256(fp.read_bytes()).hexdigest().encode())
            else:
                h.update(b"<deleted>")
        except OSError as exc:
            # Illeggibile != invariato: si marca in modo che l'impronta cambi.
            h.update(f"<unreadable:{exc}>".encode())
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

def run_suites(names: list[str], with_e2e: bool, files: list[str],
               keep: list[dict] | None = None) -> dict:
    results = list(keep or [])
    plan = [(n, *SUITES[n]) for n in names]
    if with_e2e:
        plan.append(("e2e", *E2E))
    for name, level, cmd in plan:
        t0 = time.time()
        # encoding esplicito: senza, su Windows `text=True` usa il codec di sistema
        # (cp1252) e su un output UTF-8 solleva UnicodeDecodeError. L'effetto non era
        # un errore visibile ma una PERDITA: stdout e stderr restavano None e il
        # cancello riportava «nessun output catturato» proprio quando l'output
        # serviva — cioe' quando una suite falliva. Misurato in S1043 su test-api.
        proc = subprocess.run(cmd, shell=True, cwd=REPO,
                              capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        # `capture_output` puo' restituire None se il processo muore in modo anomalo
        # (ucciso dall'esterno, pipe chiusa): sommare due None faceva esplodere il
        # cancello con un TypeError invece di riportare la suite come fallita.
        # Un cancello che CRASHA non dice «rosso», non dice niente — ed e' il modo
        # peggiore di fallire per uno strumento il cui mestiere e' dare un verdetto.
        tail = ((proc.stdout or "") + (proc.stderr or "")).strip().splitlines()[-15:]
        if not tail and proc.returncode != 0:
            tail = [f"(nessun output catturato; il processo e' uscito con {proc.returncode})"]
        results.append({
            "suite": name,
            "level": level,
            "cmd": cmd,
            "exit": proc.returncode,
            "duration_s": round(time.time() - t0, 1),
            # L'impronta dei file che instradano questa suite, presa DOPO l'esecuzione:
            # se qualcuno modifica quei file mentre la suite gira, l'impronta registrata
            # e' quella finale e al giro dopo risultera' scaduta. Sbagliare per eccesso
            # di prudenza e' l'unico verso accettabile per un cancello.
            "scope": content_hash(files_for_suite(name, files)),
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

def load_verdict() -> dict:
    if not VERDICT.exists():
        return {}
    try:
        return json.loads(VERDICT.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def triage(files: list[str], needed: list[str]) -> tuple[list[str], list[str], list[str]]:
    """(fresche_verdi, scadute, rosse) fra le suite richieste dal diff corrente."""
    prev = {r["suite"]: r for r in load_verdict().get("results", [])}
    fresh, stale, red = [], [], []
    for s in needed:
        r = prev.get(s)
        # Un verdetto scritto prima di S1045 non ha "scope": si tratta come scaduto,
        # cioe' si riverifica. Un formato vecchio non deve poter passare per fresco.
        if not r or r.get("scope") != content_hash(files_for_suite(s, files)):
            stale.append(s)
        elif r["exit"] != 0:
            red.append(s)
        else:
            fresh.append(s)
    return fresh, stale, red


def check() -> tuple[bool, str]:
    """(ok, motivo). ok=True significa: si puo' chiudere il turno."""
    if BRAKE.exists():
        return True, "freno tirato (.zp/verify-off)"

    files = changed_files()
    needed = route(files)
    if not needed:
        return True, "nessuna modifica che richieda verifica"

    fresh, stale, red = triage(files, needed)

    if red:
        return False, (
            f"l'ultima verifica e' ROSSA su: {', '.join(red)}. "
            f"Correggi e riesegui: python docs/kb/tools/verify_gate.py run "
            f"(rieseguira' SOLO le suite da rifare). "
            f"Dettaglio in {VERDICT.relative_to(REPO)}"
        )

    if stale:
        verificate = f" · gia' verdi e ancora valide: {', '.join(fresh)}" if fresh else ""
        return False, (
            f"da verificare: {', '.join(stale)} — i file che instradano queste suite "
            f"sono cambiati dopo l'ultima esecuzione{verificate}. "
            f"Esegui: python docs/kb/tools/verify_gate.py run "
            f"(rieseguira' SOLO {', '.join(stale)})"
        )

    return True, f"verdetto verde e fresco su {', '.join(fresh)}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["route", "run", "check"])
    ap.add_argument("--hook", action="store_true",
                    help="check: emetti il JSON per l'hook Stop")
    ap.add_argument("--with-e2e", action="store_true",
                    help="run: aggiungi la suite Playwright (L3, minuti)")
    ap.add_argument("--all", action="store_true",
                    help="run: riesegui tutte le suite instradate, anche quelle "
                         "gia' verdi sullo stesso contenuto")
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
        # Si rieseguono SOLO le suite scadute o rosse; quelle gia' verdi sullo stesso
        # contenuto si portano avanti. E' il pezzo che fa convergere il ciclo
        # «correggi -> verifica»: correggere una pagina web non ricompra 37 minuti
        # di test API. `--all` forza la riesecuzione integrale.
        fresh, stale, red = triage(files, needed)
        prev = {r["suite"]: r for r in load_verdict().get("results", [])}
        if args.all:
            to_run, keep = needed, []
        else:
            to_run = [s for s in needed if s in stale or s in red]
            keep = [prev[s] for s in fresh]
        print(f"{len(files)} file modificati → suite: {', '.join(needed)}")
        if keep:
            print(f"  riuso (verdi, contenuto invariato): {', '.join(fresh)}")
        if not to_run and not args.with_e2e:
            print("  niente da rieseguire")
        verdict = run_suites(to_run, args.with_e2e, files, keep)
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
