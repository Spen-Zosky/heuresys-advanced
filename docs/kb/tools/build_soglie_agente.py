#!/usr/bin/env python3
"""Le MISURE da cui si ri-derivano le soglie dell'agente (ADR-0040 §3, voce `#251`).

⭐ QUESTO FILE NON SCRIVE LE SOGLIE. Scrive le **misure**.

Le soglie in persone distinte (25 / 40 al 2026-09-14 su RTL Bank) **non sono costanti**: sono
valori iniziali del tenant piu' grande. Un numero del genere scritto come fatto e' vero il
giorno in cui lo scrivi e falso poco dopo, e chi lo rilegge non ha modo di accorgersene
(⭐ IL PUNTO FISSO del progetto). Percio' la catena e' questa, e il numero non compare mai
da nessuna parte come letterale:

    docs/kb/xtras/soglie-agente-persone-distinte.sql   ← le tre misure, in SQL
             │  (questo strumento le esegue sul database dichiarato)
             ▼
    docs/kb/agent-soglie-persone.json                  ← le MISURE, datate, col comando
             │  (il gateway lo legge e ri-deriva le soglie a ogni caricamento)
             ▼
    apps/agent-gateway/src/soglie-persone.ts           ← il CRITERIO, in codice

Conseguenza voluta: se il tenant piu' grande cambia, si rilancia questo strumento e le soglie
seguono. Se il file non si rigenera, il gateway lo dice (`non-misurato`) invece di indovinare.

IL CRITERIO, che vive nel TypeScript e non qui (una sola casa per la regola):
  · soglia alta  = l'unita' piu' grande del tenant, arrotondata per eccesso al multiplo di 5
  · soglia bassa = il p90 delle persone distinte per catena, idem
La ragione della scelta fra le tre misure sta in `.programmi/251-contatore-persone-distinte.md`
(decisione D1) e nell'ADR §3.

Uso:
    python docs/kb/tools/build_soglie_agente.py            # scrive il JSON
    python docs/kb/tools/build_soglie_agente.py --stampa   # misura e stampa, non scrive
    python docs/kb/tools/build_soglie_agente.py --selftest  # prova, con un caso negativo

⚠ Sola lettura sul database: nessuna DDL, nessuna DML. Le tre interrogazioni sono `select`.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

REPO = Path(__file__).resolve().parents[3]
USCITA = REPO / "docs" / "kb" / "agent-soglie-persone.json"
SQL_DICHIARATO = "docs/kb/xtras/soglie-agente-persone-distinte.sql"

# Le stesse tre misure del file SQL dichiarato dall'ADR, in forma interrogabile una per una
# (il file e' fatto per un umano davanti a `psql`: stampa tre tabelle con `\echo`).
# Restano IDENTICHE nella sostanza: se un giorno divergessero, il selftest non lo vedrebbe —
# per questo il JSON porta il nome del file SQL come fonte, e chi lo modifica passa da qui.
Q_POSIZIONI_PER_UNITA = """
select t.tenant_code, max(n) as massimo
from (select position_tenant_id tid, position_organization_unit_id ou, count(*) n
      from sys.sys_positions group by 1,2) x
join sys.sys_tenancies t on t.tenant_id = x.tid
group by 1 order by 2 desc
"""

Q_P90_CATENE = """
with recursive ou as (
  select organization_unit_id id, organization_unit_parent_id parent from sys.sys_organization_units
), sub as (
  select id as radice, id as nodo from ou
  union all
  select s.radice, o.id from sub s join ou o on o.parent = s.nodo
), p as (
  select pos.position_organization_unit_id ou, a.user_position_assignment_user_id uid
  from sys.sys_user_position_assignments a
  join sys.sys_positions pos on pos.position_id = a.user_position_assignment_position_id
  join sys.sys_users u on u.user_id = a.user_position_assignment_user_id
  where a.user_position_assignment_status='ACTIVE' and u.user_status='ACTIVE' and u.user_type<>'SERVICE'
), c as (
  select s.radice, count(distinct p.uid) n from sub s join p on p.ou = s.nodo group by 1
)
select round(percentile_cont(0.9) within group (order by n)::numeric, 2) as p90,
       max(n) as massimo, count(*) as catene
from c
"""


def psql(sql: str) -> list[list[str]]:
    """Esegue una `select` e restituisce le righe. Alza se il database non risponde."""
    cmd = [
        "psql",
        "-h", os.environ.get("POSTGRES_HOST", "localhost"),
        "-p", os.environ.get("POSTGRES_PORT", "5433"),
        "-U", os.environ.get("POSTGRES_USER", "heuresys"),
        "-d", os.environ.get("POSTGRES_DB", "heuresys_advanced"),
        # `-w`: MAI chiedere la password. Senza, il caso negativo del selftest (database
        # inesistente, quindi fuori da `.pgpass`) apre un prompt interattivo e resta appeso —
        # misurato: 120 s di attesa invece di un errore. Un controllo che si appende non e' un
        # controllo, e in una corsa non presidiata nessuno vede la domanda.
        "-w",
        "-tAF", "|", "-c", " ".join(sql.split()),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                         errors="replace", timeout=120)
    if out.returncode != 0:
        raise RuntimeError(f"psql exit {out.returncode}: {out.stderr.strip()[:400]}")
    return [r.split("|") for r in out.stdout.splitlines() if r.strip()]


def misura() -> dict[str, object]:
    posizioni = psql(Q_POSIZIONI_PER_UNITA)
    if not posizioni:
        raise RuntimeError("nessun tenant: la misura delle posizioni per unita' e' vuota")
    # Il tenant PIU' GRANDE, non uno scelto per nome: la prima riga dell'ordinamento.
    tenant, massimo_unita = posizioni[0][0], int(posizioni[0][1])
    catene = psql(Q_P90_CATENE)
    if not catene:
        raise RuntimeError("nessuna catena: la misura per sottoalbero e' vuota")
    p90, massimo_catena, quante = float(catene[0][0]), int(catene[0][1]), int(catene[0][2])
    return {
        "_": "GENERATO da docs/kb/tools/build_soglie_agente.py — NON si modifica a mano. "
             "Contiene le MISURE, non le soglie: le soglie le ri-deriva il codice "
             "(apps/agent-gateway/src/soglie-persone.ts) applicando il criterio di ADR-0040 §3.",
        "misuratoIl": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "comando": f"python docs/kb/tools/build_soglie_agente.py  (le stesse tre misure di {SQL_DICHIARATO})",
        "tenantPiuGrande": tenant,
        "massimoPosizioniPerUnita": massimo_unita,
        "p90PersonePerCatena": p90,
        "massimoPersonePerCatena": massimo_catena,
        "catene": quante,
    }


def selftest() -> int:
    """Prova il generatore, con un caso NEGATIVO: un database inesistente deve ALZARE."""
    errori: list[str] = []

    vecchio = os.environ.get("POSTGRES_DB")
    os.environ["POSTGRES_DB"] = "zqxwvu_db_inesistente_251"
    try:
        misura()
        errori.append("negativo: un database inesistente NON ha alzato (il generatore mente)")
        print("  [ROSSO] database inesistente: nessun errore")
    except Exception:
        print("  [ok ] database inesistente: alza, non inventa")
    finally:
        if vecchio is None:
            os.environ.pop("POSTGRES_DB", None)
        else:
            os.environ["POSTGRES_DB"] = vecchio

    try:
        m = misura()
        for chiave in ("massimoPosizioniPerUnita", "p90PersonePerCatena", "tenantPiuGrande"):
            if not m.get(chiave):
                errori.append(f"positivo: {chiave} assente o zero")
        print(f"  [ok ] misura sul database vivo: {m['tenantPiuGrande']} "
              f"unita_max={m['massimoPosizioniPerUnita']} p90_catene={m['p90PersonePerCatena']}")
    except Exception as e:  # noqa: BLE001 — il database puo' essere giu': si DICHIARA
        print(f"  [NON MISURATO] il database non risponde: {e}")
        print("  ⚠ il caso positivo non e' stato provato: non e' un verde, e' un buio")
        errori.append("positivo: NON MISURATO (database non raggiungibile)")

    if errori:
        print("\nSELFTEST — ROSSO: " + " · ".join(errori))
        return 1
    print("\nSELFTEST — verde (un caso positivo sul vivo, uno negativo che deve alzare)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stampa", action="store_true", help="misura e stampa, non scrive il file")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    m = misura()
    testo = json.dumps(m, ensure_ascii=False, indent=2) + "\n"
    if a.stampa:
        sys.stdout.write(testo)
        return 0
    USCITA.write_text(testo, encoding="utf-8", newline="\n")
    print(f"scritto {USCITA.relative_to(REPO).as_posix()}")
    print(f"  tenant piu' grande      {m['tenantPiuGrande']}")
    print(f"  unita' piu' grande      {m['massimoPosizioniPerUnita']}")
    print(f"  p90 persone per catena  {m['p90PersonePerCatena']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
