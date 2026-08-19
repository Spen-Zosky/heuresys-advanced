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
RAGIONE = "ragione-scritta"
DA_RISOLVERE = "da-risolvere"

DESCRIZIONE = {
    ARCHIVIO: "archivio di righe gia' cancellate — una FK le renderebbe incancellabili",
    POLIMORFO: "riferimento polimorfo — punta a tabelle diverse secondo il tipo, la FK e' impossibile",
    ESTERNO: "identificativo di un sistema esterno — non esiste un referente locale da agganciare",
    LAVORAZIONE: "tabella di transito (staging) — porta le chiavi della provenienza (#69)",
    MODELLO_IA: "nome di un modello di IA, non una riga — non c'e' tabella da agganciare",
    RAGIONE: "il commento della colonna dichiara PERCHE' non ha un referente (#218 F3/F4)",
    DA_RISOLVERE: "PROMETTE un referente locale e non lo aggancia — e' la materia di #218",
}

# Nomi di colonna che dichiarano apertamente un riferimento polimorfo.
#
# ⚠ IL NOME E' IL SEGNALE DEBOLE, E LA GEMELLA E' QUELLO FORTE — corretto in F2, misurando.
#   Questa lista riconosceva `..._resource_id` e simili, ma **5 delle 11** voci che il primo
#   censimento dava «da risolvere» erano polimorfe e si chiamavano altrimenti:
#   `capability_score_lineage_child_id`, `..._parent_id`, `action_plan_source_id`,
#   `reference_translations.entity_id`, `user_timeline_event_source_id`.
#   Il segnale che le accomuna non e' come si chiamano: e' che accanto hanno una **colonna
#   gemella che ne dichiara il tipo** (`..._type`, `..._table`). Quella e' una proprieta' dello
#   SCHEMA, verificabile dal database, e non un elenco di nomi da tenere aggiornato a mano —
#   cioe' esattamente la differenza fra un criterio meccanico e una convenzione.
POLIMORFE = re.compile(r"_(resource|subject|source_entity|reference|target_record|source_record)_id$")

# Identificativi che nascono fuori da questo sistema.
ESTERNE = re.compile(r"(external_code$|_credential_id$|_tax_id$|_family_id$)")


def classifica(schema: str, tabella: str, colonna: str, gemelle: set[str] | None = None,
               commento: str | None = None) -> str:
    """
    La classe di una colonna. Prima regola che riconosce, vince.

    `gemelle` e' l'insieme delle altre colonne della stessa tabella: serve alla regola piu'
    forte del classificatore — una colonna con accanto la sua `..._type` o `..._table` **dichiara
    il proprio bersaglio riga per riga**, quindi una FK non le manca, le e' impossibile. Se non
    viene passato, quella regola non si applica e la colonna puo' finire in `da-risolvere`: e'
    un default prudente, che sbaglia verso il «da guardare» invece che verso il silenzio.
    """
    # ⚠ LA REGOLA CHE RENDE QUESTO STRUMENTO UNA CURA E NON UNA FOTOGRAFIA (#218 F4).
    #   Una colonna il cui COMMENTO dichiara perche' non ha un referente e' gia' stata guardata
    #   e decisa: farla ricomparire a ogni censimento costringerebbe a rifare l'indagine, e chi
    #   la rifa' la seconda volta non sa che la prima e' avvenuta. La ragione deve pero' stare
    #   NEL DATABASE — una scritta dentro un file di migrazione non la vede chi interroga il
    #   database, ed e' esattamente il difetto che F3 ha corretto.
    #   Il segnale e' il rimando alla voce che ha deciso: un commento qualunque non basta, o
    #   qualsiasi descrizione diventerebbe un lasciapassare.
    if commento and "#218" in commento:
        return RAGIONE
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
    if gemelle and colonna.endswith("_id"):
        radice = colonna[: -len("_id")]
        if f"{radice}_type" in gemelle or f"{radice}_table" in gemelle:
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
    """
    Il classificatore deve poter sbagliare, e queste prove lo mettono alla prova.

    ⚠ UNA SOLA LISTA E UN SOLO CONTATORE, ed e' una correzione di S1072. La prima stesura
    teneva tre gruppi di casi con tre cicli separati, e il totale finale sommava le lunghezze
    a mano: eseguiva **22** casi e ne dichiarava **14**. Peggio ancora, due dei tre cicli
    giravano PRIMA che il contatore dei rossi esistesse — un caso fallito li avrebbe fatti
    morire con un `NameError` invece di dire ROSSO. Uno strumento che misura male se' stesso
    e' il difetto piu' pericoloso che possa avere, perche' il suo verde non significa niente.

    Ogni caso e': (schema, tabella, colonna, gemelle, commento, classe attesa, perche').
    """
    G = None  # nessuna gemella
    C = None  # nessun commento
    casi = [
        # ── le classi che si riconoscono da dove vive la colonna ──
        ("audit", "skills_junk_archive", "skill_id", G, C, ARCHIVIO, "schema audit"),
        ("sys", "qualcosa_archive", "cosa_id", G, C, ARCHIVIO, "nome che finisce per _archive"),
        ("staging", "wave1_job_roles", "staging_target_record_id", G, C, LAVORAZIONE, "schema staging"),
        # ── quelle che si riconoscono dal nome ──
        ("sys", "sys_skill_embeddings", "model_id", G, C, MODELLO_IA, "nome di un modello, non una riga"),
        ("sys", "sys_source_lineage_records", "source_lineage_sdbi_ai_model_id", G, C, MODELLO_IA, "modello di IA"),
        ("sys", "sys_users", "user_external_code", G, C, ESTERNO, "codice di un sistema esterno"),
        ("sys", "sys_user_demographics", "user_demographics_tax_id", G, C, ESTERNO, "codice fiscale, non una FK"),
        ("sys", "sys_auth_refresh_tokens", "auth_refresh_token_family_id", G, C, ESTERNO, "raggruppamento, non una riga"),
        ("sys", "sys_approval_requests", "approval_request_resource_id", G, C, POLIMORFO, "risorsa di tipo variabile"),
        ("sys", "sys_inbox_notifications", "notification_resource_id", G, C, POLIMORFO, "idem"),
        ("sys", "sys_visualization_nodes", "node_source_entity_id", G, C, POLIMORFO, "entita' di origine variabile"),
        # ── quelle che restano da guardare ──
        ("sys", "sys_organization_unit_templates", "organization_unit_template_blueprint_id", G, C, DA_RISOLVERE,
         "IL CASO CHE HA APERTO LA VOCE: promette un blueprint e non lo aggancia"),
        ("sys", "sys_esco_isco_resolved", "isco_classification_id", G, C, DA_RISOLVERE,
         "promette una classificazione locale"),

        # ── LA REGOLA DELLA GEMELLA, che il nome da solo non vede (trovata in F2) ──
        ("sys", "sys_capability_score_lineage", "capability_score_lineage_child_id",
         {"capability_score_lineage_child_type"}, C, POLIMORFO, "ha accanto la sua _type"),
        ("sys", "sys_user_timeline_events", "user_timeline_event_source_id",
         {"user_timeline_event_source_table"}, C, POLIMORFO, "ha accanto la sua _table"),
        ("sys", "sys_reference_translations", "entity_id", {"entity_table"}, C, POLIMORFO,
         "gemella con un nome corto"),
        ("sys", "sys_organization_unit_templates", "organization_unit_template_blueprint_id",
         {"organization_unit_template_code", "organization_unit_template_name"}, C, DA_RISOLVERE,
         "NEGATIVO: nessuna gemella, la regola non deve assolverla"),
        ("sys", "sys_source_lineage_records", "source_lineage_import_run_id",
         {"source_lineage_source_table"}, C, DA_RISOLVERE,
         "NEGATIVO: la gemella e' di un'altra colonna"),

        # ── LA REGOLA DEL COMMENTO, che rende lo strumento una cura e non una fotografia (F4) ──
        ("sys", "sys_source_lineage_records", "source_lineage_import_run_id", G,
         "Metadato di ESECUZIONE ... Censito e deciso in #218 F2.", RAGIONE,
         "il commento rimanda alla voce che ha deciso"),
        ("sys", "sys_source_lineage_records", "source_lineage_import_run_id", G,
         "La corsa di importazione che ha prodotto questa riga.", DA_RISOLVERE,
         "NEGATIVO: un commento qualunque non e' un lasciapassare"),
        ("sys", "sys_organization_unit_templates", "organization_unit_template_blueprint_id", G, C,
         DA_RISOLVERE, "NEGATIVO: nessun commento, nessuna assoluzione"),

        # ── L'ORDINE DELLE REGOLE, che e' una scelta e va dimostrata ──
        ("audit", "user_self_service_actions", "action_resource_id", G, C, ARCHIVIO,
         "archivio batte polimorfo"),
        ("sys", "sys_source_lineage_records", "source_lineage_table_mapping_id", G,
         "Metadato di ESECUZIONE ... #218 F2.", RAGIONE,
         "la ragione scritta batte tutto: e' la prima regola"),
    ]

    # ⚠ Senza abbastanza casi NEGATIVI la batteria non e' una prova: un classificatore che
    #   rispondesse sempre `da-risolvere` ne passerebbe una fetta, e il censimento tornerebbe
    #   a essere il mucchio da 317 che F1 esisteva per evitare.
    negativi = [c for c in casi if c[5] != DA_RISOLVERE]
    if len(negativi) < 10:
        print(f"[selftest] solo {len(negativi)} casi negativi: la batteria non e' una prova")
        return 1

    rossi = 0
    for sch, tab, col, gem, com, atteso, perche in casi:
        avuto = classifica(sch, tab, col, gem, com)
        ok = avuto == atteso
        if not ok:
            rossi += 1
        print(f"  {'OK ' if ok else 'NO '} {tab}.{col} → {avuto} (atteso {atteso}) — {perche}")

    print("")
    print(f"[selftest] {len(casi) - rossi}/{len(casi)} — {'VERDE' if rossi == 0 else 'ROSSO'}")
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

    # Le colonne di ogni tabella, per la regola della gemella. Una query sola: chiederlo
    # tabella per tabella sarebbe una raffica di round-trip da 86 ms l'uno.
    tutte = interroga(
        "SELECT table_schema, table_name, column_name FROM information_schema.columns "
        "WHERE table_schema IN ('sys','staging','reference_sync','audit');"
    )
    per_tabella: dict[tuple[str, str], set[str]] = {}
    for sch, tab, col in tutte:
        per_tabella.setdefault((sch, tab), set()).add(col)

    # I commenti di colonna, una query sola. Un `col_description` per colonna sarebbe una
    # raffica di round-trip, e attraverso il tunnel ognuno costa ~86 ms.
    commenti_righe = interroga(
        "SELECT n.nspname, c.relname, a.attname, coalesce(d.description,'') "
        "FROM pg_attribute a "
        "JOIN pg_class c ON c.oid = a.attrelid "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum "
        "WHERE n.nspname IN ('sys','staging','reference_sync','audit') AND a.attnum > 0 "
        "AND NOT a.attisdropped AND d.description IS NOT NULL;"
    )
    commenti = {(r[0], r[1], r[2]): r[3] for r in commenti_righe if len(r) >= 4}

    per_classe: dict[str, list[tuple[str, str, str, str]]] = {}
    for sch, tab, col, tipo in trovate:
        classe = classifica(sch, tab, col, per_tabella.get((sch, tab)), commenti.get((sch, tab, col)))
        per_classe.setdefault(classe, []).append((sch, tab, col, tipo))

    print("CENSIMENTO DEI RIFERIMENTI SENZA REFERENTE (#218 F1) — ri-derivato adesso dal database\n")
    print(f"  colonne che dichiarano un riferimento e non hanno alcun vincolo: {len(trovate)}")
    print("  (solo tabelle vere: le viste non hanno vincoli per costruzione e sarebbero falsi positivi)\n")

    for classe in (DA_RISOLVERE, RAGIONE, POLIMORFO, ESTERNO, MODELLO_IA, ARCHIVIO, LAVORAZIONE):
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
