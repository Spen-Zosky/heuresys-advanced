#!/usr/bin/env python3
"""
completezza_tenant.py — il metro strutturale di un tenant, derivato da RTL Bank.

Perche' esiste
--------------
Decisione E18 di Enzo (2026-08-16, epica Tenant Builder P3): il popolamento
iniziale di un tenant nuovo deve "coprire tutte le relazioni tra i dati/tabelle
di un tenant", e **RTL e' il riferimento strutturale**.

Detta cosi' e' un'aspirazione. Questo script la rende una misura: ricava dal
catalogo quali tabelle di `sys` appartengono a un tenant, quali RTL popola
davvero, e quali **relazioni** (chiavi esterne fra due tabelle entrambe
popolate) RTL realizza. Il risultato e' il metro: un tenant nuovo e' completo
quando copre lo stesso insieme, o dichiara una per una le assenze.

Niente e' scritto a mano: tabelle, colonne di tenant e relazioni si ri-derivano
dal catalogo a ogni corsa (IL PUNTO FISSO del CLAUDE.md — un dato che puo'
variare si misura).

Le prove devono poter fallire
-----------------------------
`--autoprova` esegue due controlli che hanno esito noto e opposto:
  A1  RTL contro se' stesso  -> copertura 100%, zero mancanze  (se fallisce, il
      metro e' rotto: sta misurando qualcosa che non e' cio' che dice)
  A2  Heuresys contro RTL    -> mancanze > 0                   (se non ne trova,
      il metro non sa dire di no, e un metro che non sa dire di no non misura)
Esce 1 se una delle due non da' l'esito atteso.

Uso:
    python completezza_tenant.py                      # il metro: cosa definisce RTL
    python completezza_tenant.py --contro HEURESYS    # cosa manca a un tenant
    python completezza_tenant.py --autoprova
    python completezza_tenant.py --json <file>
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

PSQL = ["psql",
        "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-At", "-F", "\t"]

RIFERIMENTO = "RTL_BANK"


def q(sql: str) -> list[list[str]]:
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True)
    if e.returncode != 0:
        sys.stderr.write(f"psql fallito:\n{e.stderr}\n")
        sys.exit(2)
    return [r.split("\t") for r in e.stdout.strip().split("\n") if r.strip()]


def tenant_id(code: str) -> str:
    r = q(f"select tenant_id from sys.sys_tenancies where tenant_code = '{code}'")
    if not r:
        sys.stderr.write(f"tenant '{code}' inesistente\n")
        sys.exit(2)
    return r[0][0]


def tabelle_di_tenant() -> dict[str, str]:
    """Tabella -> colonna di tenant. Ri-derivata dal catalogo, mai scritta a mano.

    Il criterio e' strutturale: una tabella appartiene a un tenant se ha una
    colonna che termina in `tenant_id` con una chiave esterna verso
    sys_tenancies. La sola convenzione sul nome non basterebbe -- e' proprio il
    genere di scorciatoia che fa misurare l'ambiente invece dell'oggetto.
    """
    righe = q("""
        select c.relname, a.attname
          from pg_constraint con
          join pg_class c      on c.oid = con.conrelid
          join pg_namespace n  on n.oid = c.relnamespace
          join pg_attribute a  on a.attrelid = con.conrelid
                              and a.attnum = con.conkey[1]
         where con.contype = 'f'
           and n.nspname = 'sys'
           and array_length(con.conkey, 1) = 1
           and con.confrelid = 'sys.sys_tenancies'::regclass
           and a.attname like '%tenant_id'
         order by 1
    """)
    return {r[0]: r[1] for r in righe}


def relazioni(fra: set[str]) -> list[tuple[str, str, str]]:
    """Chiavi esterne (origine, colonna, destinazione) fra tabelle dell'insieme.

    Esclude i riferimenti a sys_tenancies: quello e' il legame di appartenenza,
    non una relazione fra dati del tenant, e contarlo gonfierebbe ogni misura
    di esattamente una relazione per tabella.
    """
    righe = q("""
        select c.relname, a.attname, f.relname
          from pg_constraint con
          join pg_class c      on c.oid = con.conrelid
          join pg_class f      on f.oid = con.confrelid
          join pg_namespace n  on n.oid = c.relnamespace
          join pg_attribute a  on a.attrelid = con.conrelid
                              and a.attnum = con.conkey[1]
         where con.contype = 'f'
           and n.nspname = 'sys'
           and f.relname <> 'sys_tenancies'
         order by 1, 2
    """)
    return [(o, col, d) for o, col, d in righe if o in fra and d in fra]


def conteggi(tab_col: dict[str, str], tid: str) -> dict[str, int]:
    """Righe per tabella per quel tenant, in UNA query (il tunnel e' lento)."""
    if not tab_col:
        return {}
    rami = [f"select '{t}' as t, count(*) as n from sys.{t} where {c} = '{tid}'"
            for t, c in sorted(tab_col.items())]
    righe = q(" union all ".join(rami))
    return {r[0]: int(r[1]) for r in righe}


def misura(tab_col: dict[str, str], tid: str) -> dict:
    n = conteggi(tab_col, tid)
    popolate = {t for t, c in n.items() if c > 0}
    rel = relazioni(popolate)
    return {"conteggi": n, "popolate": popolate, "relazioni": rel}


def confronta(rif: dict, altro: dict) -> dict:
    tab_mancanti = sorted(rif["popolate"] - altro["popolate"])
    rel_rif = {(o, c, d) for o, c, d in rif["relazioni"]}
    rel_alt = {(o, c, d) for o, c, d in altro["relazioni"]}
    rel_mancanti = sorted(rel_rif - rel_alt)
    return {
        "tabelle_riferimento": len(rif["popolate"]),
        "tabelle_coperte": len(rif["popolate"] & altro["popolate"]),
        "tabelle_mancanti": tab_mancanti,
        "relazioni_riferimento": len(rel_rif),
        "relazioni_coperte": len(rel_rif & rel_alt),
        "relazioni_mancanti": rel_mancanti,
    }


def stampa_metro(tab_col: dict[str, str], rif: dict) -> None:
    print("=" * 72)
    print(f" IL METRO — derivato da {RIFERIMENTO}, il riferimento strutturale (E18)")
    print("=" * 72)
    print(f"  tabelle che appartengono a un tenant   {len(tab_col):>5}")
    print(f"  di cui {RIFERIMENTO} popola            {len(rif['popolate']):>5}")
    print(f"  mai popolate da {RIFERIMENTO}          {len(tab_col) - len(rif['popolate']):>5}")
    print(f"  relazioni fra tabelle popolate         {len(rif['relazioni']):>5}")
    print()
    print("  Un tenant nuovo e' strutturalmente completo quando copre queste")
    print("  tabelle e queste relazioni, o dichiara una per una le assenze.")
    vuote = sorted(set(tab_col) - rif["popolate"])
    if vuote:
        print()
        print(f"  Le {len(vuote)} tabelle che nemmeno {RIFERIMENTO} popola NON entrano nel metro:")
        print("  sono la parte di piattaforma che nessun tenant ha mai usato.")
        for t in vuote[:8]:
            print(f"    · {t}")
        if len(vuote) > 8:
            print(f"    … e altre {len(vuote) - 8}")
    print("=" * 72)


def stampa_confronto(codice: str, d: dict) -> None:
    tp = 100.0 * d["tabelle_coperte"] / d["tabelle_riferimento"] if d["tabelle_riferimento"] else 0.0
    rp = 100.0 * d["relazioni_coperte"] / d["relazioni_riferimento"] if d["relazioni_riferimento"] else 0.0
    print("-" * 72)
    print(f" {codice} CONTRO IL METRO")
    print("-" * 72)
    print(f"  tabelle    {d['tabelle_coperte']:>4} / {d['tabelle_riferimento']:<4}  ({tp:5.1f}%)   mancanti: {len(d['tabelle_mancanti'])}")
    print(f"  relazioni  {d['relazioni_coperte']:>4} / {d['relazioni_riferimento']:<4}  ({rp:5.1f}%)   mancanti: {len(d['relazioni_mancanti'])}")
    if d["tabelle_mancanti"]:
        print()
        print("  Tabelle che il riferimento popola e questo tenant no:")
        for t in d["tabelle_mancanti"][:15]:
            print(f"    · {t}")
        if len(d["tabelle_mancanti"]) > 15:
            print(f"    … e altre {len(d['tabelle_mancanti']) - 15}")
    print("-" * 72)


def autoprova(tab_col: dict[str, str], rif: dict) -> int:
    """Due controlli a esito noto e opposto. Un metro che non sa dire di no non misura."""
    print("=" * 72)
    print(" AUTOPROVA — due controlli, esiti attesi opposti")
    print("=" * 72)
    guasti = 0

    a1 = confronta(rif, rif)
    ok1 = not a1["tabelle_mancanti"] and not a1["relazioni_mancanti"]
    print(f"  A1  {RIFERIMENTO} contro se' stesso -> attese 0 mancanze")
    print(f"      tabelle mancanti {len(a1['tabelle_mancanti'])} · relazioni mancanti {len(a1['relazioni_mancanti'])}"
          f"   {'OK' if ok1 else 'GUASTO'}")
    if not ok1:
        guasti += 1

    altro = misura(tab_col, tenant_id("HEURESYS"))
    a2 = confronta(rif, altro)
    ok2 = len(a2["tabelle_mancanti"]) > 0
    print(f"  A2  HEURESYS contro {RIFERIMENTO} -> attese mancanze > 0")
    print(f"      tabelle mancanti {len(a2['tabelle_mancanti'])} · relazioni mancanti {len(a2['relazioni_mancanti'])}"
          f"   {'OK' if ok2 else 'GUASTO — il metro non sa dire di no'}")
    if not ok2:
        guasti += 1

    print("=" * 72)
    print(f"  {'AUTOPROVA SUPERATA (2/2)' if guasti == 0 else f'AUTOPROVA FALLITA — {guasti} guasti'}")
    print("=" * 72)
    return 1 if guasti else 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--contro", metavar="TENANT_CODE", help="confronta un tenant col metro")
    p.add_argument("--autoprova", action="store_true")
    p.add_argument("--json", metavar="FILE")
    a = p.parse_args()

    tab_col = tabelle_di_tenant()
    rif = misura(tab_col, tenant_id(RIFERIMENTO))

    uscita = 0
    fuori: dict = {
        "riferimento": RIFERIMENTO,
        "tabelle_di_tenant": len(tab_col),
        "tabelle_popolate": sorted(rif["popolate"]),
        "relazioni": [list(r) for r in rif["relazioni"]],
    }

    if a.autoprova:
        uscita = autoprova(tab_col, rif)
    elif a.contro:
        stampa_metro(tab_col, rif)
        d = confronta(rif, misura(tab_col, tenant_id(a.contro)))
        stampa_confronto(a.contro, d)
        fuori["confronto"] = {a.contro: {k: (v if not isinstance(v, list) else v) for k, v in d.items()}}
    else:
        stampa_metro(tab_col, rif)

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(fuori, f, ensure_ascii=False, indent=2, default=list)
        print(f"  scritto {a.json}")
    return uscita


if __name__ == "__main__":
    sys.exit(main())
