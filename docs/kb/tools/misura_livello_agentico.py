#!/usr/bin/env python3
"""Misura del livello agentico di Heuresys da un comando (voce M1 del piano AI-driven, ADR-0063).

Solo lettura, senza database e senza rete. Fonti, tutte nel deposito:
  - le rotte dell'API: `docs/kb/atlas/atlas.yaml` (sezione `api`), per metodo;
  - le operazioni raggiungibili dall'assistente tramite il catalogo generico:
    `docs/kb/atlas/agent-operations.json` (concetti e operazioni);
  - gli strumenti con nome proprio e la loro classe: `CLASSI_STRUMENTI` in
    `apps/agent-gateway/src/classi-azioni.ts` (le B e le C sono scritture);
  - le pagine web: `atlas.yaml` (sezione `web`) e `apps/web/src/lib/agente/pagine-idonee.generated.ts`;
  - segnalatori, scenari, batteria: contano ciò che esiste nel deposito (file e cartelle dichiarati dal
    piano, voci F3b, F4a, F6a); finché non esistono valgono zero e lo strumento lo dice;
  - uso in produzione: non si ricava dal deposito (voce M0, query sul database), e lo strumento lo dichiara.

Uscita: 0 misura fatta; 2 una fonte manca o non si legge. `--json` stampa i numeri; `--selftest` prova
lo strumento su un catalogo sporcato apposta (una voce tolta deve far scendere la copertura).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True,
                             cwd=Path(__file__).parent).stdout.strip() or ".")
ATLANTE = RADICE / "docs/kb/atlas/atlas.yaml"
CATALOGO = RADICE / "docs/kb/atlas/agent-operations.json"
CLASSI = RADICE / "apps/agent-gateway/src/classi-azioni.ts"
PAGINE_IDONEE = RADICE / "apps/web/src/lib/agente/pagine-idonee.generated.ts"
SCENARI = RADICE / "apps/api/src/modules/scenari"
BATTERIA = RADICE / "apps/agent-gateway/test/batteria"
SEGNALATORI = list((RADICE / "db/migrations").glob("*sys_agent_signals*.sql"))


def rotte_per_metodo(testo: str) -> dict[str, int]:
    """Conta le rotte dell'API per metodo nella sezione `api:` dell'atlante (senza dipendenze esterne)."""
    conteggio: dict[str, int] = {}
    nella_api = False
    for riga in testo.splitlines():
        if re.match(r"^\S", riga):
            nella_api = riga.startswith("api:")
            continue
        if nella_api:
            m = re.match(r"^      - method: ([A-Z]+)\s*$", riga)
            if m:
                conteggio[m.group(1)] = conteggio.get(m.group(1), 0) + 1
    return conteggio


def pagine_web(testo: str) -> int:
    """Le pagine della sezione `web:` dell'atlante: un indirizzo per riga a due spazi."""
    n, nel_web = 0, False
    for riga in testo.splitlines():
        if re.match(r"^\S", riga):
            nel_web = riga.startswith("web:")
            continue
        if nel_web and re.match(r"^  \S.*:\s*$", riga):
            n += 1
    return n


def classi_strumenti(testo: str) -> dict[str, int]:
    i = testo.index("CLASSI_STRUMENTI")
    corpo = testo[i:testo.index("});", i)]
    conteggio = {"A": 0, "B": 0, "C": 0}
    for m in re.finditer(r'^\s*hrx_\w+:\s*"([ABC])"', corpo, re.M):
        conteggio[m.group(1)] += 1
    return conteggio


def misura(catalogo_override: dict | None = None) -> dict:
    atlante = ATLANTE.read_text(encoding="utf-8")
    metodi = rotte_per_metodo(atlante)
    catalogo = catalogo_override if catalogo_override is not None else json.loads(CATALOGO.read_text(encoding="utf-8"))
    op_gen = {"GET": 0, "SCRITTURA": 0}
    for concetto in catalogo["concepts"].values():
        for op in concetto["operations"].values():
            op_gen["GET" if op["method"] == "GET" else "SCRITTURA"] += 1
    classi = classi_strumenti(CLASSI.read_text(encoding="utf-8"))
    letture_tot = metodi.get("GET", 0)
    scritture_tot = sum(n for m, n in metodi.items() if m != "GET")
    scritture_raggiunte = op_gen["SCRITTURA"] + classi["B"] + classi["C"]
    pagine_tot = pagine_web(atlante)
    pagine_idonee = len(re.findall(r'^\s+"/[^"]*",?\s*$', PAGINE_IDONEE.read_text(encoding="utf-8"), re.M))
    n_batteria = len([p for p in BATTERIA.rglob("*") if p.is_file()]) if BATTERIA.is_dir() else 0
    n_scenari = len([p for p in SCENARI.rglob("*.ts") if p.is_file()]) if SCENARI.is_dir() else 0

    def quota(a: int, b: int) -> float:
        return round(100 * a / b, 1) if b else 0.0

    return {
        "letture": {"raggiungibili": op_gen["GET"], "totali": letture_tot, "quota": quota(op_gen["GET"], letture_tot),
                    "obiettivo": 98},
        "scritture": {"raggiungibili": scritture_raggiunte, "nel_catalogo_generico": op_gen["SCRITTURA"],
                      "strumenti_con_nome_B": classi["B"], "strumenti_con_nome_C": classi["C"],
                      "totali": scritture_tot, "quota": quota(scritture_raggiunte, scritture_tot), "obiettivo": 70},
        "pagine": {"con_assistente": pagine_idonee, "totali": pagine_tot, "quota": quota(pagine_idonee, pagine_tot)},
        "segnalatori": {"migrazioni_sys_agent_signals": len(SEGNALATORI), "attivi": "non misurabile dal deposito (M0)"},
        "scenari": {"file_modulo_scenari": n_scenari},
        "batteria": {"file_batteria": n_batteria},
        "uso_in_produzione": "non si ricava dal deposito: voce M0, query docs/piani/ai-driven_20261126/misura-uso.sql",
    }


def stampa(m: dict) -> None:
    r, s, p = m["letture"], m["scritture"], m["pagine"]
    print(f"letture      {r['raggiungibili']}/{r['totali']} = {r['quota']}% (obiettivo {r['obiettivo']}%)")
    print(f"scritture    {s['raggiungibili']}/{s['totali']} = {s['quota']}% (obiettivo {s['obiettivo']}%); "
          f"generico {s['nel_catalogo_generico']} + strumenti B {s['strumenti_con_nome_B']} + C {s['strumenti_con_nome_C']}")
    print(f"pagine       {p['con_assistente']}/{p['totali']} = {p['quota']}%")
    print(f"segnalatori  migrazioni sys_agent_signals: {m['segnalatori']['migrazioni_sys_agent_signals']}")
    print(f"scenari      file nel modulo scenari: {m['scenari']['file_modulo_scenari']}")
    print(f"batteria     file in test/batteria: {m['batteria']['file_batteria']}")
    print(f"uso          {m['uso_in_produzione']}")


def selftest() -> int:
    base = misura()
    catalogo = json.loads(CATALOGO.read_text(encoding="utf-8"))
    primo = next(k for k, v in catalogo["concepts"].items() if any(o["method"] == "GET" for o in v["operations"].values()))
    ops = catalogo["concepts"][primo]["operations"]
    chiave = next(k for k, o in ops.items() if o["method"] == "GET")
    del ops[chiave]
    sporco = misura(catalogo)
    if sporco["letture"]["raggiungibili"] != base["letture"]["raggiungibili"] - 1:
        print("SELFTEST ROSSO: togliendo una lettura dal catalogo la copertura non scende di una")
        return 1
    print(f"selftest verde: letture {base['letture']['raggiungibili']} -> {sporco['letture']['raggiungibili']} togliendo {primo}/{chiave}")
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    try:
        m = misura()
    except (OSError, KeyError, ValueError) as e:
        print(f"fonte mancante o illeggibile: {e}", file=sys.stderr)
        return 2
    if "--json" in sys.argv:
        print(json.dumps(m, ensure_ascii=False, indent=2))
    else:
        stampa(m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
