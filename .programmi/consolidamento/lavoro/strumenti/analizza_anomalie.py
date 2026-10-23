#!/usr/bin/env python3
"""
analizza_anomalie.py — rilievi strutturali sui due schemi ricostruiti da estrai_schema.py.

Uso:
    python3 analizza_anomalie.py --lavoro <cartella con C_schema_*.json> \
        --advanced <repo advanced> --datastore <repo datastore>

Produce in <lavoro>:
    C_anomalie.tsv           un rilievo per riga (id, progetto, classe, oggetto, colonna, evidenza)
    C_riferimenti_codice.tsv per ogni tabella/vista/funzione VIVA: occorrenze testuali nel codice
    C_tipi_omologhi.tsv      colonne omologhe (stessa chiave naturale) e i loro tipi nei due progetti

Limiti: tutto è letto dalle migrazioni (schema ricostruito, non misurato sul DB);
le occorrenze nel codice sono testuali (parola intera): l'assenza non prova
l'inutilizzo (nomi composti a runtime, accesso da script o da altri repository),
la presenza non prova l'uso (commenti, prove).
"""
import argparse
import csv
import json
import os
import re
from collections import defaultdict

CODE_EXT = (".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".sql", ".sh", ".json")
SKIP_DIRS = {"node_modules", "dist", ".next", ".turbo", "coverage", ".git", "playwright-report", "test-results"}


def load(lavoro, p):
    with open(os.path.join(lavoro, f"C_schema_{p}.json"), encoding="utf-8") as fh:
        return json.load(fh)["oggetti"]


def tokens_in(roots):
    """parola -> insieme di file (relativi) in cui compare."""
    idx = defaultdict(set)
    for root, label in roots:
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
            for f in files:
                if not f.endswith(CODE_EXT):
                    continue
                path = os.path.join(d, f)
                try:
                    with open(path, encoding="utf-8", errors="replace") as fh:
                        txt = fh.read()
                except OSError:
                    continue
                rel = label + "/" + os.path.relpath(path, root)
                for w in set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", txt)):
                    idx[w.lower()].add(rel)
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lavoro", required=True)
    ap.add_argument("--advanced", required=True)
    ap.add_argument("--datastore", required=True)
    a = ap.parse_args()

    adv = [o for o in load(a.lavoro, "advanced") if o["drop"] is None]
    dst = [o for o in load(a.lavoro, "datastore") if o["drop"] is None]
    rows = []
    n = defaultdict(int)

    def add(proj, cls, obj, col, ev):
        n[cls] += 1
        rows.append([f"{cls}-{n[cls]:03d}", proj, cls, obj, col, ev])

    # --- A. ENUM di PostgreSQL ------------------------------------------------
    for proj, objs in (("advanced", adv), ("datastore", dst)):
        for o in objs:
            if o["tipo"] == "TYPE ENUM":
                add(proj, "ENUM", f'{o["schema"]}.{o["oggetto"]}', "", f'creato in {o["crea"]}: ' + ",".join(o["extra"].get("valori", [])))
            for c, t in o["colonne"].items():
                pass

    # --- B. tabelle senza chiave primaria -------------------------------------
    for proj, objs in (("advanced", adv), ("datastore", dst)):
        for o in objs:
            if o["tipo"] == "TABLE" and not o["pk"] and not o["extra"].get("partition_of"):
                add(proj, "SENZA_PK", f'{o["schema"]}.{o["oggetto"]}', "",
                    f'crea {o["crea"]}; unique: {" | ".join(o["unique"]) or "nessuno"}; '
                    + ("CREATE TABLE AS; " if o["extra"].get("create_as") else "") + f'{len(o["colonne"])} colonne')

    # --- C. legami non formalizzati (advanced) --------------------------------
    pk_of = {}
    for o in adv:
        if o["tipo"] == "TABLE" and len(o["pk"]) == 1 and o["schema"] == "sys":
            pk_of[o["pk"][0]] = f'{o["schema"]}.{o["oggetto"]}'
    # alias noti: colonne che nominano un catalogo con un nome diverso dalla PK
    alias = {"tenant_id": "sys.sys_tenancies", "user_id": "sys.sys_users",
             "kpi_id": "sys.sys_kpi_definitions", "position_id": "sys.sys_positions"}
    for o in adv:
        if o["tipo"] != "TABLE" or o["schema"] not in ("sys",):
            continue
        fkcols = {c for f in o["fk"] for c in f["colonne"]}
        for c, t in o["colonne"].items():
            if c in o["pk"] or c in fkcols or not c.endswith("_id") or t not in ("uuid",) or o["oggetto"].endswith("_embeddings") and c == "model_id":
                continue
            target = None
            for pkc in sorted(pk_of, key=len, reverse=True):
                if c == pkc or c.endswith("_" + pkc):
                    target = pk_of[pkc]; break
            if target is None:
                for suf, tg in alias.items():
                    if c.endswith("_" + suf) or c == suf:
                        target = tg; break
            if target and target != f'sys.{o["oggetto"]}':
                add("advanced", "FK_MANCANTE", f'{o["schema"]}.{o["oggetto"]}', c,
                    f"uuid senza FK; il nome indica {target}")
            elif target is None:
                add("advanced", "RIFERIMENTO_SENZA_FK", f'{o["schema"]}.{o["oggetto"]}', c,
                    "uuid senza FK: riferimento polimorfico o verso un oggetto non dichiarato")
    # riferimenti per codice verso cataloghi (fuori dal contenuto di modello, che si lega per codice per disegno)
    code_pat = re.compile(r"(esco_uri|skill_code|skill_uri|ateco_code|nace_code|isco_code|cp2021_code|ccnl_code|ccnl_type|ccnl_level|occupation_code|occupation_uri|kpi_code|apqc_code|pcf_code|industry_code)$")
    for o in adv:
        if o["tipo"] != "TABLE" or o["schema"] != "sys":
            continue
        for c, t in o["colonne"].items():
            if code_pat.search(c):
                bc = o["oggetto"].startswith("sys_blueprint_content_")
                add("advanced", "LEGAME_PER_CODICE" if not bc else "LEGAME_PER_CODICE_MODELLO",
                    f'{o["schema"]}.{o["oggetto"]}', c, f"{t}; nessuna FK possibile verso un catalogo per codice" + (" (contenuto di modello: per disegno, C1 del DISEGNO onda 2)" if bc else ""))
    # datastore: *_concept_id senza FK
    for o in dst:
        if o["tipo"] != "TABLE":
            continue
        fkcols = {c for f in o["fk"] for c in f["colonne"]}
        for c, t in o["colonne"].items():
            if (c.endswith("_concept_id") or c == "concept_id") and c not in fkcols and c not in o["pk"]:
                add("datastore", "FK_MANCANTE", f'{o["schema"]}.{o["oggetto"]}', c, f"{t} senza FK verso datastore_core.datastore_concept")
            if re.search(r"(skill_code|uri|ateco|isco|esco|occupation_code|pcf|apqc|kpi_code|metric_code)$", c) and o["schema"] == "datastore_model" and c not in fkcols:
                add("datastore", "LEGAME_PER_CODICE", f'{o["schema"]}.{o["oggetto"]}', c, f"{t}; nessuna FK verso il catalogo")

    # --- D. riferimenti nel codice -------------------------------------------
    adv_idx = tokens_in([(os.path.join(a.advanced, "apps"), "apps"), (os.path.join(a.advanced, "packages"), "packages")])
    dst_idx = tokens_in([(os.path.join(a.datastore, "apps"), "apps"), (os.path.join(a.datastore, "src"), "src")])
    adv_other = tokens_in([(os.path.join(a.advanced, "db", "scripts"), "db/scripts"), (os.path.join(a.advanced, "db", "seeds"), "db/seeds"),
                           (os.path.join(a.advanced, "scripts"), "scripts"), (os.path.join(a.advanced, "docs", "kb", "tools"), "docs/kb/tools")])
    dst_other = tokens_in([(os.path.join(a.datastore, "scripts"), "scripts"), (os.path.join(a.datastore, "tests"), "tests")])
    ref_rows = []
    for proj, objs, idx, oth in (("advanced", adv, adv_idx, adv_other), ("datastore", dst, dst_idx, dst_other)):
        for o in objs:
            if o["tipo"] not in ("TABLE", "VIEW", "MATERIALIZED VIEW", "FUNCTION", "PROCEDURE"):
                continue
            name = o["oggetto"].lower()
            files = sorted(idx.get(name, ()))
            others = sorted(oth.get(name, ()))
            ref_rows.append([proj, o["schema"], o["oggetto"], o["tipo"], len(files), len(others), "; ".join(files[:6])])
            # sentinelle sys.v_*: si leggono per prefisso da db_health.py, non per nome
            sentinel = proj == "advanced" and o["tipo"] == "VIEW" and o["oggetto"].startswith("v_")
            if not files and o["tipo"] in ("TABLE", "VIEW", "MATERIALIZED VIEW") and o["schema"] not in ("staging",) and not sentinel:
                add(proj, "NESSUN_RIFERIMENTO_NEL_CODICE", f'{o["schema"]}.{o["oggetto"]}', "",
                    f'{o["tipo"]}; 0 file in apps/' + ("+packages/" if proj == "advanced" else "+src/")
                    + f'; altrove (script/seed/prove): {len(others)}')

    # --- E. tipi delle colonne omologhe --------------------------------------
    groups = {
        "URI ESCO (competenza/occupazione)": r"(esco_uri|esco_occupation_uri|skill_uri|occupation_uri|concept_uri|_uri)$",
        "codice ATECO/NACE/attività": r"(ateco|nace|activity_code|activity_classification_code|industry_code)",
        "codice ISCO": r"isco",
        "codice CP2021": r"cp2021",
        "codice CCNL / livello": r"(ccnl|agreement_code|agreement_level_code)",
        "codice competenza": r"(skill_code)$",
        "codice indicatore/metrica": r"(kpi_code|kpi_definition_code|metric_code)$",
        "codice processo (APQC/PCF)": r"(process_code|pcf_code|apqc)",
        "codice posizione": r"(position_code)$",
        "codice unità": r"(unit_code)$",
        "codice ruolo": r"(job_role_code|role_code)$",
        "lingua": r"(language|lang|_locale)$",
        "impronta di contenuto": r"(content_hash|source_hash|_sha256|_hash)$",
        "codice fascia dimensionale": r"(size_band_code|size_class|size_class_code)$",
    }
    homo = []
    for g, pat in groups.items():
        r_ = re.compile(pat)
        for proj, objs in (("advanced", adv), ("datastore", dst)):
            types = defaultdict(list)
            for o in objs:
                if o["tipo"] != "TABLE":
                    continue
                for c, t in o["colonne"].items():
                    if r_.search(c):
                        types[t].append(f'{o["oggetto"]}.{c}')
            for t, cols in sorted(types.items(), key=lambda x: -len(x[1])):
                homo.append([g, proj, t, len(cols), "; ".join(cols[:8])])

    with open(os.path.join(a.lavoro, "C_anomalie.tsv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["id", "progetto", "classe", "oggetto", "colonna", "evidenza"])
        w.writerows(rows)
    with open(os.path.join(a.lavoro, "C_riferimenti_codice.tsv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["progetto", "schema", "oggetto", "tipo", "file_codice", "file_script_seed_prove", "primi_file_codice"])
        w.writerows(ref_rows)
    with open(os.path.join(a.lavoro, "C_tipi_omologhi.tsv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow(["gruppo", "progetto", "tipo", "n_colonne", "esempi"])
        w.writerows(homo)
    for k, v in sorted(n.items()):
        print(f"{k:32s} {v}")


if __name__ == "__main__":
    main()
