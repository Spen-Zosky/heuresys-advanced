#!/usr/bin/env python
"""zp_review — i verdetti dei tre revisori adversarial, su disco invece che in un workflow.

PERCHE' ESISTE
--------------
`references/adversarial.md` dice da sempre che «i revisori scrivono il verdetto in un
file». Era una frase in un documento, non un meccanismo: nulla la imponeva, e il
lavoratore lanciava i tre revisori via Workflow tool restando in attesa del valore di
ritorno.

Misurato in S1052, DUE corse su due sullo stesso cluster (`Z-112`): la sessione finisce
per budget prima che i verdetti tornino, il workflow resta orfano, e la sessione
successiva **non puo' piu' leggerli**. Il piano del lavoratore lo diceva con parole sue:

    | P5 | tre revisori adversarial | NON concluso — verdetti non tornati |

Il costo non e' il denaro sprecato: e' che **nessun lavoratore puo' chiudere un cluster
da solo**, perche' il passo 3 del protocollo non e' mai ripartibile. Il loop resta
dipendente da un presidio, che e' l'opposto del suo scopo.

Questo progetto ha gia' stabilito il principio altrove, in testa a `session_mode.py`:
una modalita' «non e' una promessa del modello, e' uno stato su disco». Vale identico per
un verdetto.

COME SI USA
-----------
    # il lavoratore, PRIMA di lanciare i revisori: c'e' gia' qualcosa da riprendere?
    python docs/kb/tools/zp_review.py stato Z-112

    # ogni revisore, appena conclude (o chi lo orchestra, con il suo output):
    python docs/kb/tools/zp_review.py registra Z-112 --lente correttezza --json verdetto.json
    ... | python docs/kb/tools/zp_review.py registra Z-112 --lente isolamento --json -

    # il cancello: le tre lenti hanno risposto e i rilievi gravi sono chiusi?
    python docs/kb/tools/zp_review.py valida Z-112     # exit 1 se no, e dice cosa manca

    # un rilievo corretto si dichiara chiuso, con COME (mai solo «fatto»)
    python docs/kb/tools/zp_review.py risolvi Z-112 --lente correttezza --rilievo 0 \\
        --come "aggiunto il caso limite in drift-check.ts:88, test 5/5"

La radice si impone con `ZP_ROOT`, come per `zp_evidence`: gov istruisce dal repo
principale e deve poter leggere i verdetti scritti nell'albero del lavoratore.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_state import RADICE, ZPDIR  # noqa: E402

# Le tre lenti di `adversarial.md`. Elenco CHIUSO: tre revisori identici sono un
# revisore con piu' varianza, e una lente inventata al volo non copre niente di nuovo.
LENTI = ("correttezza", "isolamento", "riproducibilita")

# Un rilievo di questa severita' su questi temi vale anche DA SOLO, senza maggioranza:
# il costo dello sbaglio non e' simmetrico (adversarial.md, "Regola di maggioranza").
GRAVI = ("alta",)

REVISORI = ZPDIR / "revisori"


def _file(cluster: str, lente: str) -> Path:
    REVISORI.mkdir(parents=True, exist_ok=True)
    return REVISORI / f"{cluster}-{lente}.json"


def _leggi(cluster: str, lente: str) -> dict | None:
    p = _file(cluster, lente)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def cmd_registra(a) -> int:
    if a.lente not in LENTI:
        print(f"lente sconosciuta: {a.lente}. Ammesse: {', '.join(LENTI)}")
        return 2
    grezzo = sys.stdin.read() if a.json == "-" else Path(a.json).read_text(encoding="utf-8")
    try:
        d = json.loads(grezzo)
    except ValueError as e:
        print(f"il verdetto non e' JSON valido: {e}")
        return 2
    if "rilievi" not in d:
        print("il verdetto non porta 'rilievi': non e' un verdetto, e' un commento")
        return 2

    # Un rilievo senza `come_si_riproduce` non e' un rilievo, e' un sospetto
    # (adversarial.md). Si rifiuta qui, non si discute dopo.
    senza = [i for i, r in enumerate(d["rilievi"]) if not str(r.get("come_si_riproduce", "")).strip()]
    if senza:
        print(f"rilievi senza 'come_si_riproduce' (indici {senza}): sono sospetti, non rilievi")
        return 2

    d["lente"] = a.lente
    d["cluster"] = a.cluster
    _file(a.cluster, a.lente).write_text(
        json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    n = len(d["rilievi"])
    print(f"{a.cluster}/{a.lente}: verdetto registrato, {n} rilievo/i")
    return 0


def _sintesi(cluster: str) -> tuple[list, list, list]:
    """(lenti presenti, lenti mancanti, rilievi gravi ancora aperti)."""
    presenti, mancanti, aperti = [], [], []
    for lente in LENTI:
        d = _leggi(cluster, lente)
        if d is None:
            mancanti.append(lente)
            continue
        presenti.append(lente)
        for i, r in enumerate(d.get("rilievi", [])):
            if str(r.get("severita", "")).lower() in GRAVI and not r.get("risolto_come"):
                aperti.append((lente, i, str(r.get("cosa", ""))[:90]))
    return presenti, mancanti, aperti


def cmd_stato(a) -> int:
    presenti, mancanti, aperti = _sintesi(a.cluster)
    if not presenti:
        print(f"{a.cluster}: nessun verdetto registrato — i revisori non sono ancora girati")
        return 1
    print(f"{a.cluster}: {len(presenti)}/3 lenti hanno risposto ({', '.join(presenti)})")
    if mancanti:
        print(f"  MANCANO: {', '.join(mancanti)} — vanno lanciate solo QUESTE, non tutte e tre")
    for lente, i, cosa in aperti:
        print(f"  rilievo grave aperto [{lente}#{i}]: {cosa}")
    return 0


def cmd_valida(a) -> int:
    presenti, mancanti, aperti = _sintesi(a.cluster)
    if mancanti:
        print(f"{a.cluster}: mancano le lenti {', '.join(mancanti)} "
              f"({len(presenti)}/3 hanno risposto)")
        return 1
    if aperti:
        print(f"{a.cluster}: {len(aperti)} rilievo/i di severita' alta ancora aperti:")
        for lente, i, cosa in aperti:
            print(f"  [{lente}#{i}] {cosa}")
        return 1
    print(f"{a.cluster}: tre lenti su tre, nessun rilievo grave aperto")
    return 0


def cmd_risolvi(a) -> int:
    d = _leggi(a.cluster, a.lente)
    if d is None:
        print(f"nessun verdetto per {a.cluster}/{a.lente}")
        return 2
    try:
        r = d["rilievi"][a.rilievo]
    except (KeyError, IndexError):
        print(f"rilievo {a.rilievo} inesistente per {a.cluster}/{a.lente}")
        return 2
    if not a.come.strip():
        print("serve il COME: «risolto» da solo non e' una risoluzione")
        return 2
    r["risolto_come"] = a.come
    _file(a.cluster, a.lente).write_text(
        json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{a.cluster}/{a.lente}#{a.rilievo}: dichiarato risolto")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("registra", help="salva il verdetto di una lente")
    r.add_argument("cluster")
    r.add_argument("--lente", required=True, choices=LENTI)
    r.add_argument("--json", required=True, help="file del verdetto, oppure - per stdin")

    s = sub.add_parser("stato", help="quali lenti hanno risposto, quali mancano")
    s.add_argument("cluster")

    v = sub.add_parser("valida", help="cancello: 3 lenti su 3 e nessun rilievo grave aperto")
    v.add_argument("cluster")

    x = sub.add_parser("risolvi", help="dichiara chiuso un rilievo, dicendo COME")
    x.add_argument("cluster")
    x.add_argument("--lente", required=True, choices=LENTI)
    x.add_argument("--rilievo", type=int, required=True)
    x.add_argument("--come", required=True)

    a = p.parse_args()
    return {"registra": cmd_registra, "stato": cmd_stato,
            "valida": cmd_valida, "risolvi": cmd_risolvi}[a.cmd](a)


if __name__ == "__main__":
    raise SystemExit(main())
