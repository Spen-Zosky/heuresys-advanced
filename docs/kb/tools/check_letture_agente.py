#!/usr/bin/env python3
"""Controllo delle letture dell'assistente per ogni voce della barra laterale.

Piano dell'assistente nelle interfacce, blocco I3 (logica L5, da mod-platform F11): l'assistente
in una pagina deve poter leggere ciò che la pagina mostra, con la sessione della persona. Una voce
del menu passa quando almeno uno dei moduli dell'API che la sua pagina chiama (`/v1/<modulo>/…`)
è leggibile dall'assistente, cioè:
  - ha uno strumento dedicato nel gateway (`rd("hrx_…", "/<modulo>…")` in mcp-tools.ts), oppure
  - è un concetto del catalogo generico con almeno un'operazione GET
    (`docs/kb/atlas/agent-operations.json`, letto da hrx_entity_query).
Oppure ha un'ECCEZIONE scritta, con la ragione, in `letture_agente_eccezioni.json`.

Fonti, tutte nel deposito e senza database:
  - le voci: la mappa della migrazione 000484 (`INSERT INTO barra_mappa`);
  - la pagina: `apps/web/src/app/(authenticated)/<rotta>/page.tsx`, e i file locali che importa
    (un livello, più `lib/api/*`), dove si cercano le stringhe `/v1/<modulo>`.

Uscita: 0 tutto coperto; 1 ci sono voci scoperte; 2 una fonte manca o non si legge.
`--json` stampa il dettaglio per voce.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True,
                             cwd=Path(__file__).parent).stdout.strip() or ".")
MIGRAZIONE = RADICE / "db/migrations/000484_la_barra_laterale_per_funzione.sql"
STRUMENTI = RADICE / "apps/agent-gateway/src/mcp-tools.ts"
CATALOGO = RADICE / "docs/kb/atlas/agent-operations.json"
ECCEZIONI = Path(__file__).with_name("letture_agente_eccezioni.json")
PAGINE = RADICE / "apps/web/src/app/(authenticated)"
WEB_SRC = RADICE / "apps/web/src"

# Il percorso intero dopo /v1: segmenti fissi, segnaposto `${…}` o `:x`, fino alla querystring.
V1 = re.compile(r"""["'`]/v1/([a-z0-9](?:[^"'`?\s$]|\$\{[^}]*\})*)""")
IMPORT = re.compile(r"""from\s+["']((?:\.{1,2}|@)/[^"']+)["']""")


def voci_del_menu() -> list[str]:
    testo = MIGRAZIONE.read_text(encoding="utf-8")
    blocco = re.search(r"INSERT INTO barra_mappa.*?;", testo, re.S)
    if not blocco:
        raise SystemExit(2)
    return re.findall(r"^\s*\('(/[^']*)'", blocco.group(0), re.M)


def segmenti(percorso: str) -> list[str]:
    """`users/${id}/dossier` e `users/:id/dossier` diventano ['users', '*', 'dossier']."""
    out = []
    for s in percorso.strip("/").split("/"):
        out.append("*" if (s.startswith(":") or "${" in s) else s)
    return out


def letture_dell_assistente() -> list[tuple[list[str], str]]:
    """Le GET che l'assistente sa fare: (segmenti del percorso sotto /v1, strumento)."""
    out: list[tuple[list[str], str]] = []
    strumenti = STRUMENTI.read_text(encoding="utf-8")
    for nome, percorso in re.findall(r'\brd\(\s*"(hrx_[a-z_]+)",\s*"(/[a-z0-9/-]+)"', strumenti):
        out.append((segmenti(percorso), nome))
    for nome, percorso in re.findall(r'\brdQ\(\s*"(hrx_[a-z_]+)",\s*"[^"]*",\s*"(/[a-z0-9/-]+)"', strumenti):
        out.append((segmenti(percorso), nome))
    for nome, percorso in re.findall(r'\brdId\(\s*"(hrx_[a-z_]+)",\s*"(/[a-z0-9/-]+)"', strumenti):
        out.append((segmenti(percorso) + ["*"], nome))
    for c, voce in json.loads(CATALOGO.read_text(encoding="utf-8")).get("concepts", {}).items():
        for o in ((voce or {}).get("operations") or {}).values():
            if (o or {}).get("method") == "GET":
                resto = [] if o.get("path", "/") == "/" else segmenti(o["path"])
                out.append(([c, *resto], "hrx_entity_query"))
    return out


def combacia(a: list[str], b: list[str]) -> bool:
    return len(a) == len(b) and all(x == y or "*" in (x, y) for x, y in zip(a, b))


def risolvi(base: Path, spec: str) -> Path | None:
    p = (WEB_SRC / spec[2:]) if spec.startswith("@/") else (base.parent / spec).resolve()
    for cand in (p, p.with_suffix(".ts"), p.with_suffix(".tsx"), p / "index.ts", p / "index.tsx"):
        if cand.is_file():
            return cand
    return None


def trova_pagina(rotta: str) -> Path | None:
    """La pagina della rotta, anche quando un segmento è dinamico (`dashboard/[famiglia]`)."""
    cartella = PAGINE
    for seg in rotta.strip("/").split("/"):
        if (cartella / seg).is_dir():
            cartella = cartella / seg
            continue
        dinamiche = sorted(d for d in cartella.iterdir() if d.is_dir() and d.name.startswith("[") and not d.name.startswith("[..."))
        if not dinamiche:
            return None
        cartella = dinamiche[0]
    pagina = cartella / "page.tsx"
    return pagina if pagina.is_file() else None


def chiamate_della_pagina(rotta: str) -> tuple[Path | None, set[str]]:
    pagina = trova_pagina(rotta)
    if pagina is None:
        return None, set()
    # La pagina e ciò che importa dai file del deposito, fino a tre livelli: le chiamate stanno
    # spesso in un hook di lib/api o in un componente della stessa cartella.
    file, coda = {pagina}, [(pagina, 0)]
    while coda:
        f, liv = coda.pop()
        if liv >= 3:
            continue
        for spec in IMPORT.findall(f.read_text(encoding="utf-8")):
            r = risolvi(f, spec)
            if r and WEB_SRC in r.parents and r not in file and "agente" not in r.parts:
                file.add(r)
                coda.append((r, liv + 1))
    chiamate: set[str] = set()
    for f in file:
        chiamate.update(V1.findall(f.read_text(encoding="utf-8")))
    # Le chiamate di servizio di ogni pagina (sessione, permessi, menu) non dicono che cosa mostra.
    # Lo stesso per l'origine dei dati che ogni tabella mostra (EntityTable): provenienza e
    # origini sono una nota sulla tabella, non ciò che la pagina è.
    servizio = {"auth", "me/permissions", "me/interfaces", "me/preferences", "meta/data-origins", "provenance"}
    proprie = {c.rstrip("/") for c in chiamate if c.rstrip("/") not in servizio and not c.startswith("auth/")}
    # La pagina della provenienza è la sola che mostra la provenienza come dato suo.
    if rotta == "/provenance":
        proprie |= {c for c in chiamate if c.startswith("provenance")}
    return pagina, proprie


def autoprova() -> int:
    """Le regole del confronto, viste fallire e passare senza toccare il deposito."""
    casi = [
        (combacia(segmenti("users/${id}/dossier"), ["users", "*", "dossier"]), True),
        (combacia(segmenti("users"), ["users", "*"]), False),
        (combacia(segmenti("capability/composition/vrio"), segmenti("/capability/composition")), False),
        (trova_pagina("/questa-voce-non-esiste") is None, True),
        (trova_pagina("/dashboard/hr") is not None, True),  # segmento dinamico [famiglia]
    ]
    rotti = [i for i, (vale, atteso) in enumerate(casi) if vale is not atteso]
    print("AUTOPROVA " + ("VERDE" if not rotti else f"ROSSA, casi {rotti}"))
    return 1 if rotti else 0


def main() -> int:
    if "--selftest" in sys.argv:
        return autoprova()
    for f in (MIGRAZIONE, STRUMENTI, CATALOGO, ECCEZIONI):
        if not f.is_file():
            print(f"FONTE MANCANTE: {f.relative_to(RADICE)}")
            return 2
    eccezioni: dict[str, str] = json.loads(ECCEZIONI.read_text(encoding="utf-8")).get("voci", {})
    letture = letture_dell_assistente()
    righe, scoperte = [], []
    for rotta in voci_del_menu():
        pagina, moduli = chiamate_della_pagina(rotta)
        letti = {}
        for c in sorted(moduli):
            for seg, strumento in letture:
                if combacia(segmenti(c), seg):
                    letti[c] = strumento
                    break
        if letti:
            stato = "letta"
        elif rotta in eccezioni:
            stato = "eccezione"
        else:
            stato = "scoperta"
            scoperte.append(rotta)
        righe.append({"rotta": rotta, "stato": stato, "pagina": bool(pagina), "moduli": sorted(moduli),
                      "letti": letti, **({"ragione": eccezioni[rotta]} if stato == "eccezione" else {})})
    inutili = sorted(r for r in eccezioni if any(x["rotta"] == r and x["stato"] == "letta" for x in righe))
    if "--json" in sys.argv:
        print(json.dumps(righe, ensure_ascii=False, indent=1))
    conti = {s: sum(1 for r in righe if r["stato"] == s) for s in ("letta", "eccezione", "scoperta")}
    print(f"VOCI {len(righe)}: lette {conti['letta']}, eccezioni {conti['eccezione']}, scoperte {conti['scoperta']}")
    for r in righe:
        if r["stato"] == "scoperta":
            print(f"  SCOPERTA {r['rotta']}  chiamate: {', '.join(r['moduli']) or '(nessuna chiamata /v1 trovata)'}")
    for r in inutili:
        print(f"  ECCEZIONE SUPERFLUA {r}: la voce ora si legge, togli l'eccezione")
    return 1 if scoperte or inutili else 0


if __name__ == "__main__":
    sys.exit(main())
