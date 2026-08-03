#!/usr/bin/env python3
"""
check_tenant_contamination.py — guardia contro il ritorno della contaminazione
da tenant legacy mai migrati (register #89).

Perche' esiste
--------------
Il seed Goal-003 Wave-1 convoglio' tutti e quattro i tenant legacy dentro RTL
Bank e la riconciliazione Wave-2 per SmartFood ed EcoNova non avvenne mai. Il
risultato: ~7.000 righe di due aziende inesistenti in questo prodotto, esposte
in produzione fra i percorsi formativi, gli obiettivi e i cataloghi globali.
La migrazione 000235 le ha rimosse. Questo script verifica che non tornino.

Criterio, uno solo e verificabile: si contano gli oggetti che nominano
un'entita' che in questo prodotto non esiste (SmartFood, EcoNova) o che sono
chiavi-macchina di import (OLDDB::). NON si contano ESCO, ATECO, i CCNL di
settore, le sigle sindacali e i job_roles PROTO-*: sono classificazioni di
riferimento reali, descrivono il mondo del lavoro e non un tenant fantasma.
Confonderli con la contaminazione fu il primo errore da evitare.

Esito binario: exit 1 se una classe torna sopra zero.

Uso:
    python docs/kb/tools/check_tenant_contamination.py
    python docs/kb/tools/check_tenant_contamination.py --json <file>
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"), "-At", "-F", "\t"]

# (classe, descrizione, SQL che conta il residuo). Attesa: zero ovunque.
CENSIMENTO: list[tuple[str, str, str]] = [
    ("B", "percorsi con chiave macchina OLDDB::",
     "SELECT count(*) FROM sys.sys_learning_paths WHERE learning_path_code LIKE 'OLDDB::%'"),
    ("B", "moduli con chiave macchina OLDDB::",
     "SELECT count(*) FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'OLDDB::%'"),
    ("B", "bande retributive OLDDB",
     "SELECT count(*) FROM sys.sys_compensation_bands WHERE compensation_band_code LIKE 'OLDDB%'"),
    ("A", "percorsi con slug di tenant inesistente",
     "SELECT count(*) FROM sys.sys_learning_paths "
     "WHERE learning_path_code ~ '^CRS-(econova|smartfood)-'"),
    ("A", "moduli con slug di tenant inesistente",
     "SELECT count(*) FROM sys.sys_learning_modules "
     "WHERE learning_module_code ~ '^CRS-(econova|smartfood)-'"),
    # La 000235 cercava la chiave-macchina nel CODICE e mancava le righe che ce
    # l'hanno nel NOME: dieci `PATH-econova-*`/`PATH-smartfood-*` avevano codice
    # pulito e nome `OLDDB::learning_paths::<uuid>`. Trovate solo quando Enzo ha
    # chiesto di rimuovere il catalogo alimentare/energetico (000241). Una guardia
    # che guarda una colonna sola non e' una guardia: qui si controllano entrambe.
    ("A", "percorsi con slug di tenant inesistente nel codice PATH-",
     "SELECT count(*) FROM sys.sys_learning_paths "
     "WHERE learning_path_code ~ '^PATH-(econova|smartfood)-'"),
    ("B", "percorsi con chiave macchina nel NOME anziche' nel codice",
     "SELECT count(*) FROM sys.sys_learning_paths p "
     "WHERE p.learning_path_name LIKE 'OLDDB::%' "
     "  AND p.learning_path_code ~ '^PATH-(econova|smartfood)-'"),
    ("A", "percorsi Heuresys rimasti nel tenant RTL",
     "SELECT count(*) FROM sys.sys_learning_paths p JOIN sys.sys_tenancies t "
     "ON t.tenant_id = p.learning_path_tenant_id "
     "WHERE p.learning_path_code ~ '^CRS-heuresys-' AND t.tenant_code = 'RTL_BANK'"),
    ("C", "obiettivi senza soggetto",
     "SELECT count(*) FROM sys.sys_goals WHERE goal_subject_user_id IS NULL"),
    ("C", "aggiornamenti su obiettivi senza soggetto",
     "SELECT count(*) FROM sys.sys_goal_updates WHERE update_goal_id IN "
     "(SELECT goal_id FROM sys.sys_goals WHERE goal_subject_user_id IS NULL)"),
    ("D", "famiglie professionali di aziende inesistenti",
     "SELECT count(*) FROM sys.sys_job_families WHERE job_family_code ~ '^JF-(SMA|ECO)-'"),
    ("D", "definizioni KPI di aziende inesistenti",
     "SELECT count(*) FROM sys.sys_kpi_definitions WHERE kpi_definition_code ~ '^BP-(SF|EN)-'"),
    ("E", "record di provenienza verso utenti rimossi",
     "SELECT count(*) FROM sys.sys_source_lineage_records "
     "WHERE source_lineage_metadata::text ~* '(smartfood|econova)'"),
]


def conta(sql: str) -> int:
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True)
    if e.returncode != 0:
        sys.exit(f"psql ha fallito: {e.stderr.strip()}")
    return int(e.stdout.strip() or 0)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json")
    a = p.parse_args()

    esiti, residuo = [], 0
    print("CONTAMINAZIONE DA TENANT LEGACY  (atteso: zero ovunque)")
    for classe, descrizione, sql in CENSIMENTO:
        n = conta(sql)
        residuo += n
        print(f"  [{'!!' if n else 'ok'}] {classe}  {descrizione:52s} {n:6d}")
        esiti.append({"classe": classe, "descrizione": descrizione, "righe": n})

    print()
    if residuo:
        print(f"ESITO: {residuo} righe contaminate sono tornate. "
              f"Ricontrollare l'import che le ha reintrodotte.")
    else:
        print("ESITO: nessuna contaminazione residua")

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"classi": esiti, "residuo": residuo}, f, indent=2, ensure_ascii=False)
    return 1 if residuo else 0


if __name__ == "__main__":
    sys.exit(main())
