#!/usr/bin/env python3
"""Censimento delle attese che bloccano in apps/web (regola `.claude/rules/attese-bloccanti.md`).

Legge i sorgenti del frontend, in sola lettura, e per ogni pagina dice:
- se ha un'attesa che blocca (una scrittura `useMutation` il cui stato in corso ferma un controllo);
- se una di queste è un lavoro lungo (un giro, un'applicazione, una costruzione, un'importazione,
  una generazione, o una pagina che rilegge da sé mentre un lavoro gira: `refetchInterval`);
- se il lavoro lungo ha il riquadro `WorkInProgress`.

Ogni attesa che blocca è coperta dalla barra globale (`apps/web/src/components/attesa-globale.tsx`,
montata in `AppProviders`): il censimento lo verifica una volta per tutte, non pagina per pagina.

Uso:
  python docs/kb/tools/censimento_attese.py            # tabella in markdown
  python docs/kb/tools/censimento_attese.py --json     # elenco in JSON
  python docs/kb/tools/censimento_attese.py --check    # rosso se un lavoro lungo non ha il riquadro
                                                       # e non è nel registro dei debiti
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps" / "web" / "src"
APP = WEB / "app"
DEBITI = Path(__file__).with_name("attese_debiti.json")
GLOBALE = WEB / "components" / "attesa-globale.tsx"
PROVIDERS = WEB / "providers" / "AppProviders.tsx"

MUTATION = re.compile(r"\buseMutation\s*\(")
FERMA = re.compile(r"disabled=\{[^}]*(isPending|occupat|fermo|busy|saving|pending|running)", re.I)
PENDING = re.compile(r"\.isPending\b")
POLLING = re.compile(r"\brefetchInterval\s*:\s*\(")  # rilettura condizionata: un lavoro gira
# Endpoint che avviano un lavoro lungo: giri dell'agente, applicazioni in blocco, costruzioni,
# importazioni, generazioni, ricalcoli. Si legge il percorso scritto nel sorgente.
LUNGO = re.compile(
    r"['\"`]/v1/[^'\"`]*(/run\b|/runs\b|giri|giro|/apply\b|/applica|/prova|build|import|generat|"
    r"propose|recompute|refresh|rebuild|materializ|sync|esegui)[^'\"`]*['\"`]",
    re.I,
)
RIQUADRO = re.compile(r"\b(WorkInProgress|LavoroInCorso)\b")


def rotta(p: Path) -> str:
    """Il percorso della pagina a cui appartiene un file sotto app/ (gruppi e cartelle private tolti)."""
    rel = p.relative_to(APP).parts
    parti = []
    for x in rel[:-1]:
        if x.startswith("(") and x.endswith(")"):
            continue
        if x.startswith("_"):
            break
        parti.append(x)
    return "/" + "/".join(parti)


def leggi(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def censisci() -> list[dict]:
    pagine: dict[str, dict] = {}
    for p in sorted(APP.rglob("*.tsx")):
        if ".test." in p.name or ".spec." in p.name:
            continue
        s = leggi(p)
        if not MUTATION.search(s) and not PENDING.search(s):
            continue
        blocca = bool(MUTATION.search(s) and (FERMA.search(s) or PENDING.search(s)))
        if not blocca:
            continue
        r = rotta(p)
        v = pagine.setdefault(r, {"pagina": r, "file": [], "lavoro_lungo": False, "motivi": [], "riquadro": False})
        v["file"].append(str(p.relative_to(ROOT)))
        lunghi = sorted({m.group(0).strip("'\"`") for m in LUNGO.finditer(s)})
        if lunghi:
            v["lavoro_lungo"] = True
            v["motivi"].extend(f"endpoint {e}" for e in lunghi)
        if POLLING.search(s):
            v["lavoro_lungo"] = True
            v["motivi"].append(f"rilettura periodica ({p.name})")
        if RIQUADRO.search(s):
            v["riquadro"] = True
    out = list(pagine.values())
    for v in out:
        v["motivi"] = sorted(set(v["motivi"]))
    return sorted(out, key=lambda x: x["pagina"])


def barra_globale() -> dict:
    g = leggi(GLOBALE)
    pr = leggi(PROVIDERS)
    return {
        "componente": GLOBALE.exists() and "TopProgress" in g and "useIsMutating" in g,
        "montata": "AttesaGlobale" in pr,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    righe = censisci()
    bg = barra_globale()
    debiti = set(json.loads(DEBITI.read_text(encoding="utf-8"))["pagine"]) if DEBITI.exists() else set()
    for v in righe:
        v["debito"] = v["pagina"] in debiti

    if a.json:
        print(json.dumps({"barra_globale": bg, "pagine": righe}, ensure_ascii=False, indent=2))
    else:
        lunghi = [v for v in righe if v["lavoro_lungo"]]
        print(f"Barra globale: componente {'sì' if bg['componente'] else 'NO'}, montata {'sì' if bg['montata'] else 'NO'}")
        print(f"Pagine con un'attesa che blocca: {len(righe)}; con un lavoro lungo: {len(lunghi)}; "
              f"con il riquadro: {sum(1 for v in lunghi if v['riquadro'])}")
        print()
        print("| pagina | lavoro lungo | riquadro | perché | file |")
        print("|---|---|---|---|---|")
        for v in righe:
            print(f"| `{v['pagina']}` | {'sì' if v['lavoro_lungo'] else 'no'} | "
                  f"{'sì' if v['riquadro'] else ('debito' if v['debito'] else ('no' if v['lavoro_lungo'] else '—'))} | "
                  f"{'; '.join(v['motivi']) or '—'} | {len(v['file'])} |")

    if a.check:
        rossi = []
        if not (bg["componente"] and bg["montata"]):
            rossi.append("barra globale assente o non montata in AppProviders")
        for v in righe:
            if v["lavoro_lungo"] and not v["riquadro"] and not v["debito"]:
                rossi.append(f"{v['pagina']}: lavoro lungo senza WorkInProgress e senza debito registrato")
            if v["riquadro"] and v["debito"]:
                rossi.append(f"{v['pagina']}: ha il riquadro, togli il debito da {DEBITI.name}")
        for d in sorted(debiti - {v["pagina"] for v in righe}):
            rossi.append(f"{d}: debito registrato per una pagina che non ha più attese che bloccano")
        if rossi:
            print("\nROSSO:", *rossi, sep="\n- ", file=sys.stderr)
            return 1
        print("\nVERDE: ogni attesa ha la barra globale; ogni lavoro lungo ha il riquadro o un debito registrato.",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
