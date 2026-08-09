#!/usr/bin/env python3
"""gov_rientro — il punto di rientro di una sessione gov.

Perche' esiste (Enzo, 2026-08-09)
---------------------------------
    «se adesso ci fermiamo ed esco con /exit, poi posso aprire una fresh session
     gov che riprende da dove abbiamo interrotto e riparte a lavorare fino al
     termine? forse devi prima crearti un punto di rientro... e' il meccanismo che
     una sessione canonica gia' ha, ma le attivita' di una sessione gov sono
     definite al suo interno.»

Ha ragione su entrambe le cose. Una sessione canonica ha il suo rientro — la skill
`handoff` riscrive `.handoff/STATE.md` e il register. Ma quel meccanismo governa lo
stato del PROGETTO: non sa quali alberi di lavoro esistono, quale cluster ha in mano
chi, quale verdetto e' pendente, ne' a che punto era il ciclo verifica-correggi di
gov quando la sessione si e' chiusa.

Sono due domini diversi, e per questo il rientro e' separato. Non e' un file di
stato nuovo nel senso che il CLAUDE.md vieta: vive in `.zp/` come `PROGRESS.md`,
cioe' fra lo stato di RUNTIME del motore, ed e' una vista derivata — si rigenera
leggendo il mondo, non lo sostituisce.

Cosa risponde, e in quest'ordine
--------------------------------
  1. dove eravamo      — la fase, e cosa e' gia' chiuso
  2. cosa e' in volo   — lavoratori, alberi, rami, verdetti pendenti
  3. cosa e' rotto     — i difetti noti e non ancora chiusi
  4. cosa fare adesso  — la prossima azione, scritta come comando

Il punto 4 e' quello che conta: un rientro che descrive lo stato senza dire il
prossimo comando costringe chi arriva a ricostruirlo, ed e' il momento in cui si
perde tempo o si sbaglia.

    python docs/kb/tools/gov_rientro.py            # stampa il rientro
    python docs/kb/tools/gov_rientro.py --scrivi   # lo salva in .zp/RIENTRO-GOV.md
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[3]
ZP = RADICE / ".zp"
RIENTRO = ZP / "RIENTRO-GOV.md"
ALBERI = Path(os.environ.get("GOV_WORKTREE_BASE") or (RADICE.parent / "heuresys-gov-workers"))


def git(*args, cwd=None) -> str:
    try:
        r = subprocess.run(["git", "-C", str(cwd or RADICE), *args],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=30)
        return r.stdout.strip() if r.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def freno() -> str:
    cfg = RADICE / ".claude" / "skills" / "zero-pending-loop" / "references" / "zp.config.yaml"
    try:
        for riga in cfg.read_text(encoding="utf-8").splitlines():
            if riga.strip().startswith("autorizzato_non_presidiato:"):
                return "INSERITO" if "false" in riga.lower() else "TOLTO"
    except OSError:
        pass
    return "non leggibile"


def lavoratori() -> list[dict]:
    fuori = []
    if not ALBERI.is_dir():
        return fuori
    for albero in sorted(d for d in ALBERI.iterdir() if (d / ".git").exists()):
        n = albero.name
        inc = albero / ".zp" / "incarico.json"
        esito = albero / ".zp" / "last-outcome.json"
        diario = albero / ".zp" / "diario.ndjson"
        voce = {"albero": n, "percorso": str(albero)}
        try:
            voce["cluster"] = json.loads(inc.read_text(encoding="utf-8")).get("cluster")
        except (OSError, ValueError):
            voce["cluster"] = None
        try:
            voce["esito_proposto"] = json.loads(esito.read_text(encoding="utf-8")).get("outcome")
        except (OSError, ValueError):
            voce["esito_proposto"] = None
        voce["azioni_registrate"] = sum(1 for _ in diario.open(encoding="utf-8")) if diario.is_file() else 0
        base = git("rev-parse", "main")
        voce["commit_propri"] = len(git("rev-list", f"{base}..HEAD", cwd=albero).splitlines()) if base else 0
        voce["file_non_committati"] = len(git("status", "--porcelain", cwd=albero).splitlines())
        voce["ramo"] = git("rev-parse", "--abbrev-ref", "HEAD", cwd=albero)
        fuori.append(voce)
    return fuori


def rami_con_lavoro() -> list[str]:
    fuori = []
    for riga in git("branch", "--list", "gov/*", "--format=%(refname:short)").splitlines():
        r = riga.strip()
        if not r:
            continue
        n = len(git("rev-list", f"main..{r}").splitlines())
        if n:
            fuori.append(f"{r} ({n} commit non in main)")
    return fuori


def verdetti() -> list[str]:
    d = ZP / "verdetti"
    if not d.is_dir():
        return []
    fuori = []
    for f in sorted(d.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:5]:
        try:
            v = json.loads(f.read_text(encoding="utf-8"))
            parziale = " (PARZIALE)" if v.get("istruttoria_parziale") else ""
            fuori.append(f"{f.name}: {v.get('verdetto','?').upper()}{parziale} — "
                         f"{len(v.get('rilievi') or [])} rilievi")
        except (OSError, ValueError):
            fuori.append(f"{f.name}: illeggibile")
    return fuori


def componi() -> str:
    r = ["# RIENTRO GOV — dove eravamo, e cosa fare adesso", ""]
    r.append(f"**Generato**: {subprocess.run(['date', '+%Y-%m-%d %H:%M'], capture_output=True, text=True).stdout.strip()}"
             f" · **HEAD**: `{git('rev-parse', '--short', 'HEAD')}` · **freno**: {freno()}")
    r += ["", "> Questo file risponde a una sessione gov che si apre da zero. Non sostituisce",
          "> `.handoff/STATE.md`, che governa lo stato del PROGETTO: qui c'e' lo stato del",
          "> PROCESSO gov — lavoratori, alberi, verdetti, e il prossimo comando.", ""]

    r += ["## 1. I piani, e a che punto sono", ""]
    for p in sorted((RADICE / "docs" / "superpowers" / "plans").glob("2026-08-09-gov*.md")):
        r.append(f"- `{p.relative_to(RADICE)}`")
    p1 = RADICE / "docs" / "superpowers" / "plans" / "2026-08-09-modalita-gov.md"
    if p1.is_file():
        r.append(f"- `{p1.relative_to(RADICE)}` (fase 1)")
    r.append("")

    r += ["## 2. I lavoratori, adesso", ""]
    ls = lavoratori()
    if not ls:
        r.append("Nessun albero di lavoro. Si preparano con "
                 "`bash scripts/zero-pending-driver.sh --prepara-alberi 2`.")
    else:
        r.append("| albero | ramo | cluster | esito proposto | azioni | commit | non committati |")
        r.append("|---|---|---|---|---|---|---|")
        for v in ls:
            r.append(f"| {v['albero']} | `{v['ramo']}` | {v['cluster'] or '—'} | "
                     f"{v['esito_proposto'] or '—'} | {v['azioni_registrate']} | "
                     f"{v['commit_propri']} | {v['file_non_committati']} |")
    r.append("")

    rl = rami_con_lavoro()
    if rl:
        r += ["**Rami che contengono lavoro non ancora su main** (e non ci vanno da soli):", ""]
        r += [f"- `{x}`" for x in rl] + [""]

    vd = verdetti()
    r += ["## 3. Verdetti", ""]
    r += ([f"- {x}" for x in vd] if vd else ["Nessun verdetto scritto."]) + [""]

    r += ["## 4. Cosa fare adesso", "",
          "Le voci aperte stanno nel file `.zp/GOV-DA-FARE.md`, che si scrive a mano ed e'",
          "l'unica parte di questo rientro che una macchina non puo' dedurre. Se manca,",
          "la sessione che si apre deve chiederlo prima di lavorare.", ""]
    dafare = ZP / "GOV-DA-FARE.md"
    if dafare.is_file():
        r += ["```", dafare.read_text(encoding="utf-8").strip(), "```", ""]
    else:
        r += ["> **`.zp/GOV-DA-FARE.md` non esiste.** Nessuna sessione puo' riprendere senza.", ""]
    return "\n".join(r) + "\n"


def main() -> int:
    testo = componi()
    if "--scrivi" in sys.argv:
        ZP.mkdir(parents=True, exist_ok=True)
        RIENTRO.write_text(testo, encoding="utf-8")
        print(f"scritto {RIENTRO}")
    else:
        print(testo)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
