#!/usr/bin/env python3
"""Genera J5_esco_etichette_it.sql: riempie `sys.sys_esco_occupation_mappings.esco_occupation_mapping_esco_label_it`
con l'etichetta italiana ESCO (preferredLabel di occupations_it.csv), per URI di professione.

Il database di produzione ha la colonna vuota su tutte le righe, e `etichettaOccupazioneSql`
(apps/api/src/modules/semantic-matching/etichetta.ts) ripiega allora sull'inglese del vettore.

Uso (lo zip della libreria ESCO italiana si passa come argomento: nessun percorso assoluto nel file versionato):
    python3 genera_J5_esco_etichette_it.py "<libreria>/ESCO dataset - v1.2.1 - classification - it - csv.zip" > J5_esco_etichette_it.sql
Con --mancanti elenca gli URI presenti nei vettori ma senza etichetta nello zip (servono gli URI su stdin, uno per riga).
"""
import csv
import hashlib
import io
import re
import sys
import zipfile
from pathlib import Path

CSV = "occupations_it.csv"


def sql_text(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def leggi(zpath: Path) -> list[tuple[str, str]]:
    with zipfile.ZipFile(zpath) as z, z.open(CSV) as f:
        rows = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", newline=""))
        out: dict[str, str] = {}
        for r in rows:
            uri = (r.get("conceptUri") or "").strip()
            lab = (r.get("preferredLabel") or "").strip()
            if uri and lab and uri not in out:
                out[uri] = lab
    return sorted(out.items())


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    zpath = Path(args[0])
    voci = leggi(zpath)
    if "--mancanti" in sys.argv:
        presenti = {u for u, _ in voci}
        for riga in sys.stdin:
            u = riga.strip()
            if u and u not in presenti:
                print(u)
        return
    sha = hashlib.sha256(zpath.read_bytes()).hexdigest()
    m = re.search(r"v(\d+(?:\.\d+)+)", zpath.name)
    versione = m.group(1) if m else "?"
    p = print
    p(f"-- J5 (2026-11-19): etichette italiane ESCO delle professioni, da `{CSV}` dello zip «{zpath.name}» (ESCO v{versione}).")
    p(f"-- Fonte: sha256 dello zip = {sha}; {len(voci)} professioni con etichetta italiana. GENERATO da genera_J5_esco_etichette_it.py: non si modifica a mano.")
    p("-- Cosa fa: scrive esco_occupation_mapping_esco_label_it SOLO dove e' vuota (NULL o spazi) e l'URI e' nella fonte. Non cambia mai un'etichetta gia' piena.")
    p("-- Giornale: staging.esco_etichette_it_undo (mapping_id, vecchio). Rollback: UPDATE sys.sys_esco_occupation_mappings m SET esco_occupation_mapping_esco_label_it = u.vecchio")
    p("--   FROM staging.esco_etichette_it_undo u WHERE m.esco_occupation_mapping_id = u.mapping_id AND m.esco_occupation_mapping_esco_label_it = u.nuovo.")
    p("-- Idempotente: la seconda corsa trova la colonna gia' piena e non tocca niente.")
    p("\\set ON_ERROR_STOP on")
    p("BEGIN;")
    p("CREATE TABLE IF NOT EXISTS staging.esco_etichette_it_undo (salvato_il timestamptz NOT NULL DEFAULT now(), mapping_id uuid PRIMARY KEY, vecchio text, nuovo text NOT NULL);")
    p("CREATE TEMP TABLE fonte(uri text PRIMARY KEY, etichetta text NOT NULL) ON COMMIT DROP;")
    p("INSERT INTO fonte VALUES")
    righe = [f"({sql_text(u)},{sql_text(e)})" for u, e in voci]
    p(",\n".join(righe) + ";")
    p("-- Guardia: tabella e colonna esistono, la fonte e' quella attesa, la tabella ha le righe attese (un database diverso o vuoto non si tocca).")
    p("DO $$ BEGIN")
    p("  IF (SELECT count(*) FROM fonte) < 3000 THEN RAISE EXCEPTION 'J5: la fonte ha meno di 3000 professioni, si ferma'; END IF;")
    p("  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='sys' AND table_name='sys_esco_occupation_mappings' AND column_name='esco_occupation_mapping_esco_label_it') THEN RAISE EXCEPTION 'J5: manca la colonna esco_occupation_mapping_esco_label_it, si ferma'; END IF;")
    p("  IF (SELECT count(*) FROM sys.sys_esco_occupation_mappings) < 1000 THEN RAISE EXCEPTION 'J5: la tabella delle mappature non ha i dati attesi, si ferma'; END IF;")
    p("END $$;")
    p("-- Misura prima: righe totali, righe gia' piene (con la loro impronta), righe da riempire.")
    p("CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT")
    p("  (SELECT count(*) FROM sys.sys_esco_occupation_mappings) totale,")
    p("  (SELECT count(*) FROM sys.sys_esco_occupation_mappings WHERE nullif(btrim(esco_occupation_mapping_esco_label_it),'') IS NOT NULL) piene,")
    p("  (SELECT count(*) FROM sys.sys_esco_occupation_mappings m JOIN fonte f ON f.uri = m.esco_occupation_mapping_esco_uri WHERE nullif(btrim(m.esco_occupation_mapping_esco_label_it),'') IS NULL) da_riempire;")
    p("CREATE TEMP TABLE piene_prima ON COMMIT DROP AS SELECT esco_occupation_mapping_id id, esco_occupation_mapping_esco_label_it etichetta FROM sys.sys_esco_occupation_mappings WHERE nullif(btrim(esco_occupation_mapping_esco_label_it),'') IS NOT NULL;")
    p("SELECT 'J5 prima' fase, totale, piene, da_riempire FROM prima;")
    p("INSERT INTO staging.esco_etichette_it_undo (mapping_id, vecchio, nuovo)")
    p("  SELECT m.esco_occupation_mapping_id, m.esco_occupation_mapping_esco_label_it, f.etichetta FROM sys.sys_esco_occupation_mappings m JOIN fonte f ON f.uri = m.esco_occupation_mapping_esco_uri")
    p("   WHERE nullif(btrim(m.esco_occupation_mapping_esco_label_it),'') IS NULL ON CONFLICT DO NOTHING;")
    p("UPDATE sys.sys_esco_occupation_mappings m SET esco_occupation_mapping_esco_label_it = f.etichetta FROM fonte f")
    p(" WHERE f.uri = m.esco_occupation_mapping_esco_uri AND nullif(btrim(m.esco_occupation_mapping_esco_label_it),'') IS NULL;")
    p("-- Post-condizione: stesso numero di righe; le gia' piene non sono cambiate; nessuna riga con URI in fonte resta vuota; piene dopo = piene prima + riempite.")
    p("DO $$ DECLARE p prima%ROWTYPE; tot bigint; piene bigint; cambiate bigint; vuote bigint; BEGIN")
    p("  SELECT * INTO p FROM prima;")
    p("  SELECT count(*) INTO tot FROM sys.sys_esco_occupation_mappings;")
    p("  IF tot <> p.totale THEN RAISE EXCEPTION 'J5: la tabella ha cambiato numero di righe (% -> %)', p.totale, tot; END IF;")
    p("  SELECT count(*) INTO cambiate FROM piene_prima pp JOIN sys.sys_esco_occupation_mappings m ON m.esco_occupation_mapping_id = pp.id WHERE m.esco_occupation_mapping_esco_label_it IS DISTINCT FROM pp.etichetta;")
    p("  IF cambiate > 0 THEN RAISE EXCEPTION 'J5: % etichette gia'' piene sono cambiate, si ferma', cambiate; END IF;")
    p("  SELECT count(*) INTO vuote FROM sys.sys_esco_occupation_mappings m JOIN fonte f ON f.uri = m.esco_occupation_mapping_esco_uri WHERE nullif(btrim(m.esco_occupation_mapping_esco_label_it),'') IS NULL;")
    p("  IF vuote > 0 THEN RAISE EXCEPTION 'J5: restano % righe vuote con URI in fonte', vuote; END IF;")
    p("  SELECT count(*) INTO piene FROM sys.sys_esco_occupation_mappings WHERE nullif(btrim(esco_occupation_mapping_esco_label_it),'') IS NOT NULL;")
    p("  IF piene <> p.piene + p.da_riempire THEN RAISE EXCEPTION 'J5: le righe piene dopo (%) non tornano: prima % + riempite %', piene, p.piene, p.da_riempire; END IF;")
    p("END $$;")
    p("COMMIT;")
    p("SELECT 'J5 ok' esito, (SELECT count(*) FROM staging.esco_etichette_it_undo) voci_nel_giornale,")
    p("  (SELECT count(*) FROM sys.sys_esco_occupation_mappings WHERE nullif(btrim(esco_occupation_mapping_esco_label_it),'') IS NULL) ancora_vuote;")


main()
