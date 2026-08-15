#!/usr/bin/env python3
"""
check_istruzioni.py — I FILE CHE ISTRUISCONO NON DEVONO MENTIRE.

Nasce dal ciclo di autocoscienza del 2026-08-15 (.programmi/mandato-autocoscienza-redenzione.md),
dai pattern P1 e P5 misurati sulle ultime dieci sessioni:

  P1  «non misuro cio' che varia, e lo cristallizzo»  — 5 occorrenze
  P5  «correggo in un posto e non negli altri»        — 3 occorrenze

Il progetto ha gia' molti cancelli, e sono buoni: guardiano, verify_gate, handoff_lint,
check_exposure, check_no_legacy_ingest, check_tenant_contamination, db_health, ci-rehearsal.
Guardano tutti il CODICE e i DATI. **Nessuno guarda le ISTRUZIONI** — le skill, le regole,
il README, l'indice delle memorie: cioe' proprio i file che dicono a chi arriva come lavorare.
Un'istruzione stale non fa fallire nulla: fa lavorare male, in silenzio, e la prossima sessione
la segue perche' e' scritta.

Caso che ha prodotto lo strumento, misurato il 2026-08-15: tre skill di QUESTO repo
(multi-tenant-validator, dashboards-jobs, consolida-pagina) istruiscono sul progetto legacy
heuresys-evo — Prisma (assente), tabelle rbp_* (0 nel database), services/frontend (inesistente),
Docker per il prodotto (vietato da I13) — e una raccomanda **di abilitare RLS**, che l'invariante
I5 vieta in tutto il progetto.

Ogni controllo confronta l'istruzione con la REALTA' MISURATA, non con un elenco scritto a mano:
se domani Prisma entrasse davvero nel repo, C1 smetterebbe da solo di segnalarlo.

    python docs/kb/tools/check_istruzioni.py             # esito binario, exit 1 se rosso
    python docs/kb/tools/check_istruzioni.py --elenco    # dettaglio riga per riga
    python docs/kb/tools/check_istruzioni.py --selftest  # inietta i difetti e pretende il rosso

Le deroghe vivono in docs/kb/tools/istruzioni_waivers.txt, una per riga, con il motivo
sulla stessa riga dopo '#'. Una deroga senza motivo viene ignorata di proposito.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WAIVERS = Path(__file__).resolve().parent / "istruzioni_waivers.txt"


# --------------------------------------------------------------------------- utilita'

def _leggi(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _waivers() -> set[str]:
    """Deroghe attive. Una riga senza '#' e senza motivo NON e' una deroga."""
    attive = set()
    if not WAIVERS.exists():
        return attive
    for riga in _leggi(WAIVERS).splitlines():
        riga = riga.strip()
        if not riga or riga.startswith("#"):
            continue
        if "#" not in riga:
            continue  # nessun motivo dichiarato -> ignorata di proposito
        chiave = riga.split("#", 1)[0].strip()
        if chiave:
            attive.add(chiave)
    return attive


def file_di_istruzione(root: Path) -> list[Path]:
    """I file che dicono come si lavora. Non il codice, non lo stato."""
    out: list[Path] = []
    for pat in (".claude/skills/*/SKILL.md", ".claude/skills/*/references/*.md",
                ".claude/rules/*.md"):
        out.extend(sorted(root.glob(pat)))
    for nome in ("README.md", "CLAUDE.md"):
        p = root / nome
        if p.exists():
            out.append(p)
    return out


def _righe_con(testo: str, rx: re.Pattern) -> list[tuple[int, str]]:
    return [(i, l.strip()[:160]) for i, l in enumerate(testo.splitlines(), 1) if rx.search(l)]


# --------------------------------------------------------------------------- realta' misurata

def prisma_nel_repo(root: Path) -> bool:
    """Misurato, non assunto: Prisma compare in un package.json di questo repo?"""
    for p in root.rglob("package.json"):
        if "node_modules" in p.parts:
            continue
        if "prisma" in _leggi(p).lower():
            return True
    return False


def path_esiste(root: Path, rel: str) -> bool:
    return (root / rel).exists()


# --------------------------------------------------------------------------- i controlli

def c1_entita_inesistenti(root: Path) -> list[str]:
    """C1 — un'istruzione nomina una tecnologia o un path che in questo repo NON esiste."""
    rilievi: list[str] = []
    sonde: list[tuple[str, re.Pattern, bool]] = []

    if not prisma_nel_repo(root):
        sonde.append(("prisma", re.compile(r"\bprisma\b", re.I), True))
    for rel in ("services/frontend", "services/api-gateway"):
        if not path_esiste(root, rel):
            sonde.append((rel, re.compile(re.escape(rel)), True))

    # tabelle del legacy: reali la' , inesistenti qui (verificato: 0 nel database)
    sonde.append(("rbp_* (tabelle legacy)", re.compile(r"\brbp_(pages|dashboards|roles|role_permissions|dashboard_nav_items)\b"), True))
    sonde.append(("admin_component_registry (tabella legacy)", re.compile(r"\badmin_component_registry\b"), True))
    sonde.append(("heuresys_evo_platform_db come runtime", re.compile(r"docker\s+exec\s+.*heuresys_evo_platform_db"), True))

    dero = _waivers()
    for f in file_di_istruzione(root):
        rel = f.relative_to(root).as_posix()
        if rel in dero:
            continue
        testo = _leggi(f)
        for nome, rx, _ in sonde:
            for n, riga in _righe_con(testo, rx):
                rilievi.append(f"{rel}:{n} — nomina «{nome}», che in questo repo non esiste · {riga}")
    return rilievi


def c2_rls_raccomandato(root: Path) -> list[str]:
    """C2 — I5 vieta RLS in tutto il progetto. Un'istruzione non puo' RACCOMANDARLO.

    Nominare RLS per vietarlo e' corretto e frequente (il CLAUDE.md lo fa, ADR-0032 lo fa):
    quello che il controllo cerca e' un verbo di ADOZIONE senza una negazione accanto.
    Distinguere i due casi e' tutto il valore del controllo — un controllo che segnala
    anche i divieti verrebbe spento entro una settimana.
    """
    RLS = re.compile(r"(\brls\b|row[\s-]?level[\s-]security)", re.I)
    ADOTTA = re.compile(r"\b(enabl\w*|abilit\w*|consider\w*|adopt\w*|attiv\w*|us(e|are|iamo)|"
                        r"valutare|introdur\w*)\b", re.I)
    NEGA = re.compile(r"\b(never|mai|non|no|senza|vietat\w+|esclus\w+|exclude[sd]?|"
                      r"not\s+used|nessun\w*|disabilit\w*)\b", re.I)
    rilievi, dero = [], _waivers()
    for f in file_di_istruzione(root):
        rel = f.relative_to(root).as_posix()
        if rel in dero:
            continue
        for n, riga in enumerate(_leggi(f).splitlines(), 1):
            if not RLS.search(riga) or not ADOTTA.search(riga):
                continue
            if NEGA.search(riga):
                continue  # lo nomina per vietarlo: e' l'uso corretto
            rilievi.append(f"{rel}:{n} — raccomanda RLS, vietato dall'invariante I5 · "
                           f"{riga.strip()[:160]}")
    return rilievi


def c3_credenziali_in_chiaro(root: Path) -> list[str]:
    """C3 — un'istruzione non porta password in chiaro, nemmeno «di prova»."""
    rx = re.compile(r"""(password['"]?\s*[:=]\s*['"][^'"\s]{3,}['"]|"""
                    r"""\|\s*\w+\s*\|\s*\w+\s*\|\s*(sysadmin\d+|password)\s*\|)""", re.I)
    rilievi, dero = [], _waivers()
    for f in file_di_istruzione(root):
        rel = f.relative_to(root).as_posix()
        if rel in dero:
            continue
        for n, riga in _righe_con(_leggi(f), rx):
            rilievi.append(f"{rel}:{n} — credenziale in chiaro in un file di istruzione · {riga}")
    return rilievi


def c4_memorie_non_indicizzate(root: Path) -> list[str]:
    """C4 — P5: una memoria che non e' nell'indice non viene caricata, quindi non esiste."""
    mem = Path(os.path.expanduser("~/.claude/projects/D--heuresys-advanced/memory"))
    idx = mem / "MEMORY.md"
    if not mem.is_dir() or not idx.exists():
        return []  # ambiente senza albero di memoria: si degrada, non si inventa
    indicizzate = set(re.findall(r"\(([a-z0-9_]+\.md)\)", _leggi(idx)))
    su_disco = {p.name for p in mem.glob("*.md") if p.name != "MEMORY.md"}
    orfane = sorted(su_disco - indicizzate)
    return [f"memory/{n} — sul disco ma non in MEMORY.md: non viene caricata, quindi non vale"
            for n in orfane]


CONTROLLI = [
    ("C1 entita' inesistenti", c1_entita_inesistenti),
    ("C2 RLS raccomandato (I5)", c2_rls_raccomandato),
    ("C3 credenziali in chiaro", c3_credenziali_in_chiaro),
    ("C4 memorie non indicizzate", c4_memorie_non_indicizzate),
]


def esegui(root: Path) -> dict[str, list[str]]:
    return {nome: fn(root) for nome, fn in CONTROLLI}


# --------------------------------------------------------------------------- selftest

def _selftest() -> int:
    """Le prove devono poter fallire: si inietta il difetto e si pretende il rosso."""
    casi = [
        ("C1 entita' inesistenti", ".claude/rules/_selftest.md",
         "Per le query usare prisma.user.findMany() e la tabella rbp_pages.\n"),
        ("C2 RLS raccomandato (I5)", ".claude/rules/_selftest.md",
         "Consider enabling RLS on every tenant table.\n"),
        # valore volutamente inventato: replicare qui una credenziale vera, anche del legacy,
        # significherebbe propagarla in un file versionato — il difetto che C3 esiste per trovare
        ("C3 credenziali in chiaro", ".claude/rules/_selftest.md",
         'Entra con password: "VALORE-FINTO-DEL-SELFTEST" dal pannello.\n'),
    ]
    ok = 0
    with tempfile.TemporaryDirectory() as td:
        finto = Path(td)
        (finto / ".claude" / "rules").mkdir(parents=True)
        (finto / ".claude" / "skills").mkdir(parents=True)
        (finto / "package.json").write_text('{"name":"x","dependencies":{}}', encoding="utf-8")

        # 1) albero pulito -> tutti i controlli sul filesystem devono essere VERDI
        pulito = {n: fn(finto) for n, fn in CONTROLLI if n != "C4 memorie non indicizzate"}
        if any(pulito.values()):
            print("  [ROSSO] su un albero pulito un controllo ha segnalato: %s" % pulito)
        else:
            ok += 1
            print("  [ok] albero pulito -> nessun rilievo (il controllo non spara a caso)")

        # 2) ogni difetto iniettato DEVE far scattare il suo controllo, e solo quello
        for nome, rel, corpo in casi:
            f = finto / rel
            f.write_text(corpo, encoding="utf-8")
            esiti = {n: fn(finto) for n, fn in CONTROLLI if n != "C4 memorie non indicizzate"}
            f.unlink()
            if esiti.get(nome):
                ok += 1
                print(f"  [ok] {nome}: difetto iniettato -> intercettato")
            else:
                print(f"  [ROSSO] {nome}: difetto iniettato ma NON intercettato")

        # 3) i casi NEGATIVI: nominare RLS per VIETARLO non deve far scattare nulla.
        #    Senza questa prova, C2 sarebbe rosso su meta' del CLAUDE.md e verrebbe spento.
        for etichetta, corpo in (
            ("divieto in inglese", "Tenant isolation = FK + middleware. NEVER use RLS.\n"),
            ("divieto in italiano", "Postgres RLS non e' usato da nessuna parte: mai abilitarlo.\n"),
        ):
            f = finto / ".claude" / "rules" / "_selftest.md"
            f.write_text(corpo, encoding="utf-8")
            esiti = c2_rls_raccomandato(finto)
            f.unlink()
            if not esiti:
                ok += 1
                print(f"  [ok] C2 falso positivo evitato ({etichetta}): il divieto non e' un rilievo")
            else:
                print(f"  [ROSSO] C2 ha segnalato un DIVIETO di RLS ({etichetta}): {esiti}")

    atteso = 1 + len(casi) + 2
    print(f"\nselftest: {ok}/{atteso}")
    return 0 if ok == atteso else 1


# --------------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description="I file che istruiscono non devono mentire.")
    ap.add_argument("--elenco", action="store_true", help="dettaglio riga per riga")
    ap.add_argument("--selftest", action="store_true", help="inietta i difetti e pretende il rosso")
    a = ap.parse_args()

    if a.selftest:
        return _selftest()

    esiti = esegui(ROOT)
    totale = sum(len(v) for v in esiti.values())

    print("=" * 74)
    print(" ISTRUZIONI — i file che dicono come si lavora, confrontati col reale")
    print("=" * 74)
    for nome, rilievi in esiti.items():
        stato = "[OK]" if not rilievi else "[!!]"
        print(f"  {stato}  {nome:<34} {len(rilievi)}")
        if a.elenco:
            for r in rilievi:
                print(f"          · {r}")
    print("-" * 74)
    if totale:
        print(f"  {totale} rilievi. `--elenco` per il dettaglio.")
        print("  Una deroga motivata va in docs/kb/tools/istruzioni_waivers.txt")
    else:
        print("  nessun rilievo: le istruzioni combaciano col progetto reale.")
    print("=" * 74)
    return 1 if totale else 0


if __name__ == "__main__":
    sys.exit(main())
