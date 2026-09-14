#!/usr/bin/env python3
"""q.py — l'UNICA via al database per gli agenti dei workflow del mandato K (F0.5, V10).

Uso:  python .programmi/K-ruoli-direzione/tools/q.py "<select ...>"
      python .programmi/K-ruoli-direzione/tools/q.py --file <percorso.sql>   (una sola query nel file)

Guardia in tre strati, e il primo NON basta da solo:
  1. sintassi: tolti spazi e commenti, la query deve cominciare con `select` o `with`; un `;`
     seguito da altro testo e' rifiutato. Esito: exit 3, messaggio `SOLO SELECT`.
  2. server: la query gira dentro `BEGIN; SET TRANSACTION READ ONLY; SET LOCAL statement_timeout='30s'`
     e la transazione finisce SEMPRE con ROLLBACK. Anche una funzione che scrive fallisce
     («cannot execute ... in a read-only transaction»): e' Postgres a rifiutare, non questo file.
  3. ruolo: NESSUNO. `heuresys` non ha CREATEROLE (misurato 2026-09-14) e `heuresys_ro`, che
     esiste, e' NOLOGIN, non e' concesso a `heuresys`, e ha sys_user_pay_slips REVOCATA — una
     tabella di D6 che I-E deve contare. Quindi: agenti in sola lettura PER COSTRUZIONE DELLO
     STRUMENTO (transazione read-only imposta dal server), non per privilegio del ruolo. Un
     agente che aggira q.py e apre psql da solo non e' fermato dal database: e' fermato dal
     suo prompt (V10) e dallo scarto dell'intero esito del workflow.

Stampa CSV (intestazione + righe). Codici d'uscita: 0 ok · 3 rifiutata · 1 errore SQL · 4 database muto.
"""
from __future__ import annotations

import csv
import os
import re
import sys

DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"


def pulisci(q: str) -> str:
    q = re.sub(r"/\*.*?\*/", " ", q, flags=re.S)
    q = re.sub(r"--[^\n]*", " ", q)
    return q.strip()


def ammessa(q: str) -> tuple[bool, str]:
    p = pulisci(q)
    if not p:
        return False, "SOLO SELECT: query vuota"
    if not re.match(r"^(select|with)\b", p, flags=re.I):
        return False, "SOLO SELECT: la query non comincia con select/with"
    corpo = p[:-1] if p.endswith(";") else p
    if ";" in corpo:
        return False, "SOLO SELECT: un `;` seguito da altro testo non e' ammesso"
    return True, corpo


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "--file":
        with open(argv[1], encoding="utf-8") as fh:
            q = fh.read()
    elif len(argv) == 1:
        q = argv[0]
    else:
        print("uso: q.py \"<select ...>\"  oppure  q.py --file <percorso.sql>", file=sys.stderr)
        return 3
    ok, esito = ammessa(q)
    if not ok:
        print(esito, file=sys.stderr)
        return 3
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 non installato", file=sys.stderr)
        return 4
    try:
        con = psycopg2.connect(DSN, connect_timeout=8)
    except Exception as e:  # noqa: BLE001
        print(f"database non raggiungibile: {str(e).strip().splitlines()[0]}", file=sys.stderr)
        return 4
    con.autocommit = True                       # BEGIN/ROLLBACK li scriviamo noi, espliciti
    cur = con.cursor()
    codice = 0
    try:
        cur.execute("BEGIN")
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute("SET LOCAL statement_timeout = '30s'")
        cur.execute(esito)
        w = csv.writer(sys.stdout, lineterminator="\n")
        if cur.description:
            w.writerow([d[0] for d in cur.description])
            for riga in cur:
                w.writerow(["" if v is None else v for v in riga])
    except Exception as e:  # noqa: BLE001
        print(f"ERRORE SQL: {str(e).strip().splitlines()[0]}", file=sys.stderr)
        codice = 1
    finally:
        try:
            cur.execute("ROLLBACK")
        except Exception:  # noqa: BLE001
            pass
        con.close()
    return codice


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
