#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
censimento_riferimenti_orfani.py — le colonne che PROMETTONO un riferimento e non lo mantengono.
(#218 F1 · Enzo, 2026-08-19: «i residui del legacy senza referente vanno RISOLTI, uno per uno»)

CHE COSA CERCA, in una frase: una colonna il cui **nome dichiara di puntare a qualcosa**
(`..._id`, `..._external_code`) e che **nessun vincolo aggancia** a un referente. È il criterio
meccanico che `#218` F1 chiede — si interroga `pg_constraint` e `information_schema`, non si va
a memoria.

⚠ IL CRITERIO GREZZO NON BASTA, E LA MISURA LO DIMOSTRA. Applicato senza distinzioni trova
**317** colonne, e la stragrande maggioranza non è un difetto:

  · le **VISTE** non hanno vincoli per costruzione — una `v_*` che espone `user_id` non ha
    perso nessun riferimento, sta solo proiettando una colonna che altrove è agganciata;
  · gli **ARCHIVI** (`audit.*_archive`) conservano righe già cancellate: una FK verso l'origine
    le renderebbe incancellabili, cioè romperebbe la ragione per cui esistono;
  · i riferimenti **POLIMORFI** (`approval_request_resource_id`, `notification_resource_id`)
    puntano a tabelle diverse a seconda del tipo: una FK è **impossibile**, non mancante;
  · le tabelle di **LAVORAZIONE** (`staging.*`) sono per definizione dati in transito, con le
    chiavi del sistema di provenienza — sono il bersaglio di `#69`, non di questa voce.

Un censimento che li mescolasse tutti darebbe un numero grande e inservibile, e «privilegiare la
bonifica» resterebbe un'intenzione invece di diventare una decisione. Quindi qui ogni colonna
esce **con la sua classe**, e solo una di quelle classi è materia di bonifica.

⭐ IL PUNTO FISSO: i numeri NON stanno in questo file. Stanno nel database, e questo strumento
li ri-deriva a ogni esecuzione. Un conteggio scritto in un documento è vero il giorno in cui lo
scrivi e falso poco dopo, senza che chi lo rilegge se ne accorga.

USO
  python docs/kb/tools/censimento_riferimenti_orfani.py            # il censimento, per classe
  python docs/kb/tools/censimento_riferimenti_orfani.py --elenco   # ogni colonna, una per riga
  python docs/kb/tools/censimento_riferimenti_orfani.py --da-risolvere  # solo la classe che conta
  python docs/kb/tools/censimento_riferimenti_orfani.py --selftest # le prove del classificatore
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
MIGRAZIONI = REPO / "db" / "migrations"

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-tA", "-F", "\t", "-c"]

# ── Le classi, in ordine di severita' crescente ───────────────────────────────
# L'ordine conta: una colonna prende la PRIMA classe che la riconosce, quindi le regole
# piu' specifiche stanno prima. Cambiare l'ordine cambia il censimento.
ARCHIVIO = "archivio"
POLIMORFO = "polimorfo"
ESTERNO = "esterno"
LAVORAZIONE = "lavorazione"
MODELLO_IA = "modello-ia"
DA_RISOLVERE = "da-risolvere"

DESCRIZIONE = {
    ARCHIVIO: "archivio di righe gia' cancellate — una FK le renderebbe incancellabili",
    POLIMORFO: "riferimento polimorfo — punta a tabelle diverse secondo il tipo, la FK e' impossibile",
    ESTERNO: "identificativo di un sistema esterno — non esiste un referente locale da agganciare",
    LAVORAZIONE: "tabella di transito (staging) — porta le chiavi della provenienza (#69)",
    MODELLO_IA: "nome di un modello di IA, non una riga — non c'e' tabella da agganciare",
    DA_RISOLVERE: "PROMETTE un referente locale e non lo aggancia — e' la materia di #218",
}

# Nomi di colonna che dichiarano apertamente un riferimento polimorfo.
POLIMORFE = re.compile(r"_(resource|subject|source_entity|reference|target_record|source_record)_id$")
# Identificativi che nascono fuori da questo sistema.
ESTERNE = re.compile(r"(external_code$|_credential_id$|_tax_id$|_family_id$)")


def classifica(schema: str, tabella: str, colonna: str) -> str:
    """La classe di una colonna. Prima regola che riconosce, vince."""
    if schema == "audit" or tabella.endswith("_archive"):
        return ARCHIVIO
    if schema == "staging":
        return LAVORAZIONE
    if colonna == "model_id" or colonna.endswith("_ai_model_id"):
        return MODELLO_IA
    if ESTERNE.search(colonna):
        return ESTERNO
    if POLIMORFE.search(colonna):
        return POLIMORFO
    return DA_RISOLVERE


def interroga(sql: str) -> list[list[str]]:
    r = subprocess.run(PSQL + [sql], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        print(f"[errore] psql: {r.stderr.strip()[:400]}", file=sys.stderr)
        sys.exit(2)
    return [ln.split("\t") for ln in r.stdout.strip().split("\n") if ln.strip()]


SQL_CENSIMENTO = r"""
WITH col AS (
  SELECT c.table_schema AS sch, c.table_name AS tab, c.column_name AS col, c.data_type AS tipo
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema IN ('sys','staging','reference_sync','audit')
    -- ⚠ SOLO TABELLE VERE: una vista non ha vincoli per costruzione, quindi ogni sua
    --    colonna sarebbe un falso positivo. Senza questa riga il censimento conta 34 viste.
    AND t.table_type = 'BASE TABLE'
    AND (c.column_name LIKE '%\_id' OR c.column_name LIKE '%external%')
), vincolate AS (
  SELECT cl.relnamespace::regnamespace::text AS sch, cl.relname AS tab, a.attname AS col
  FROM pg_constraint pc
  JOIN pg_class cl ON cl.oid = pc.conrelid
  JOIN unnest(pc.conkey) AS k(attnum) ON true
  JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = k.attnum
  WHERE pc.contype IN ('f','p')
)
SELECT col.sch, col.tab, col.col, col.tipo
  FROM col
 WHERE NOT EXISTS (SELECT 1 FROM vincolate v
                    WHERE v.sch = col.sch AND v.tab = col.tab AND v.col = col.col)
 ORDER BY col.sch, col.tab, col.col;
"""


def righe_e_popolate(schema: str, tabella: str, colonna: str) -> tuple[int, int]:
    """Quante righe ha la tabella, e su quante la colonna e' valorizzata."""
    out = interroga(
        f'SELECT count(*), count("{colonna}") FROM "{schema}"."{tabella}";'
    )
    if not out or len(out[0]) < 2:
        return (-1, -1)
    return (int(out[0][0]), int(out[0][1]))


def migrazione_che_la_crea(colonna: str) -> str:
    """Il primo file di migrazione che nomina questa colonna. '' se nessuno."""
    if not MIGRAZIONI.is_dir():
        return ""
    for f in sorted(MIGRAZIONI.glob("*.sql")):
        try:
            if colonna in f.read_text(encoding="utf-8", errors="replace"):
                return f.name
        except OSError:
            continue
    return ""


def selftest() -> int:
    """Il classificatore deve poter sbagliare, e queste prove lo mettono alla prova."""
    casi = [
        # (schema, tabella, colonna, classe attesa, perche')
        ("audit", "skills_junk_archive", "skill_id", ARCHIVIO, "schema audit"),
        ("sys", "qualcosa_archive", "cosa_id", ARCHIVIO, "nome che finisce per _archive"),
        ("staging", "wave1_job_roles", "staging_target_record_id", LAVORAZIONE, "schema staging"),
        ("sys", "sys_skill_embeddings", "model_id", MODELLO_IA, "nome di un modello, non una riga"),
        ("sys", "sys_source_lineage_records", "source_lineage_sdbi_ai_model_id", MODELLO_IA, "modello di IA"),
        ("sys", "sys_users", "user_external_code", ESTERNO, "codice di un sistema esterno"),
        ("sys", "sys_user_demographics", "user_demographics_tax_id", ESTERNO, "codice fiscale, non una FK"),
        ("sys", "sys_auth_refresh_tokens", "auth_refresh_token_family_id", ESTERNO, "raggruppamento, non una riga"),
        ("sys", "sys_approval_requests", "approval_request_resource_id", POLIMORFO, "risorsa di tipo variabile"),
        ("sys", "sys_inbox_notifications", "notification_resource_id", POLIMORFO, "idem"),
        ("sys", "sys_visualization_nodes", "node_source_entity_id", POLIMORFO, "entita' di origine variabile"),
        ("sys", "sys_organization_unit_templates", "organization_unit_template_blueprint_id", DA_RISOLVERE,
         "IL CASO CHE HA APERTO LA VOCE: promette un blueprint e non lo aggancia"),
        ("sys", "sys_nine_box_grid", "user_id", DA_RISOLVERE, "promette un utente locale"),
        ("sys", "sys_esco_isco_resolved", "isco_classification_id", DA_RISOLVERE, "promette una classificazione locale"),
    ]
    # Casi NEGATIVI: cose che NON devono finire in `da-risolvere`. Senza questi, un
    # classificatore che restituisse sempre DA_RISOLVERE passerebbe meta' della batteria.
    negativi = [c for c in casi if c[3] != DA_RISOLVERE]
    if len(negativi) < 6:
        print("[selftest] la batteria ha troppi pochi casi negativi per essere una prova")
        return 1

    rossi = 0
    for sch, tab, col, atteso, perche in casi:
        avuto = classifica(sch, tab, col)
        ok = avuto == atteso
        if not ok:
            rossi += 1
        print(f"  {'OK ' if ok else 'NO '} {sch}.{tab}.{col} → {avuto} (atteso {atteso}) — {perche}")

    # Una prova in piu': l'ordine delle regole conta, e va dimostrato invece che promesso.
    # Una colonna polimorfa dentro un archivio dev'essere ARCHIVIO, non POLIMORFO.
    ordine = classifica("audit", "user_self_service_actions", "action_resource_id")
    ok_ordine = ordine == ARCHIVIO
    if not ok_ordine:
        rossi += 1
    print(f"  {'OK ' if ok_ordine else 'NO '} l'ordine delle regole: archivio batte polimorfo → {ordine}")

    print(f"\n[selftest] {len(casi) + 1 - rossi}/{len(casi) + 1} — {'VERDE' if rossi == 0 else 'ROSSO'}")
    return 0 if rossi == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--elenco", action="store_true", help="ogni colonna, una per riga")
    ap.add_argument("--da-risolvere", action="store_true", help="solo la classe che e' materia di #218")
    ap.add_argument("--selftest", action="store_true", help="prova il classificatore")
    ap.add_argument("--con-righe", action="store_true", help="conta anche le righe (una query per colonna: lento)")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    trovate = interroga(SQL_CENSIMENTO)
    per_classe: dict[str, list[tuple[str, str, str, str]]] = {}
    for sch, tab, col, tipo in trovate:
        per_classe.setdefault(classifica(sch, tab, col), []).append((sch, tab, col, tipo))

    print("CENSIMENTO DEI RIFERIMENTI SENZA REFERENTE (#218 F1) — ri-derivato adesso dal database\n")
    print(f"  colonne che dichiarano un riferimento e non hanno alcun vincolo: {len(trovate)}")
    print("  (solo tabelle vere: le viste non hanno vincoli per costruzione e sarebbero falsi positivi)\n")

    for classe in (DA_RISOLVERE, POLIMORFO, ESTERNO, MODELLO_IA, ARCHIVIO, LAVORAZIONE):
        voci = per_classe.get(classe, [])
        marca = "⛔" if classe == DA_RISOLVERE else "  "
        print(f"{marca} {classe:<14} {len(voci):>4}  — {DESCRIZIONE[classe]}")

    if a.da_risolvere or a.elenco:
        classi = [DA_RISOLVERE] if a.da_risolvere else list(per_classe.keys())
        for classe in classi:
            voci = per_classe.get(classe, [])
            if not voci:
                continue
            print(f"\n── {classe} ({len(voci)}) ──")
            for sch, tab, col, tipo in voci:
                riga = f"  {sch}.{tab}.{col} [{tipo}]"
                if a.con_righe:
                    tot, pop = righe_e_popolate(sch, tab, col)
                    riga += f" · righe {tot} · valorizzate {pop}"
                    if tot > 0 and pop == 0:
                        riga += "  ← MAI USATA"
                    mig = migrazione_che_la_crea(col)
                    if mig:
                        riga += f" · creata da {mig}"
                print(riga)

    print("\n  --elenco per vederle tutte · --da-risolvere per la sola classe che conta"
          " · --con-righe per contare (lento) · --selftest per provare il classificatore")
    return 0


if __name__ == "__main__":
    sys.exit(main())
