"""Converte i CSV ESCO IT in TSV puliti (per \\copy in psql).
Rimuove tab/newline dai campi testo. Uso: py esco_csv_to_tsv.py <dir_esco>
"""
import csv
import sys
import os

D = sys.argv[1]
csv.field_size_limit(10_000_000)


def clean(s):
    return (s or "").replace("\t", " ").replace("\r", " ").replace("\n", " ").strip()


def convert(infile, outfile, cols):
    n = 0
    with open(os.path.join(D, infile), encoding="utf-8", newline="") as f, \
         open(os.path.join(D, outfile), "w", encoding="utf-8", newline="") as o:
        r = csv.DictReader(f)
        for row in r:
            vals = [clean(row.get(c, "")) for c in cols]
            if not vals[0]:
                continue
            o.write("\t".join(vals) + "\n")
            n += 1
    print(f"{outfile}: {n} righe")


# skills: uri, label, description
convert("skills_it.csv", "skills_it.tsv", ["conceptUri", "preferredLabel", "description"])
# skill groups: uri, label, description, code
convert("skillGroups_it.csv", "skillgroups_it.tsv", ["conceptUri", "preferredLabel", "description", "code"])
# broader relations: child uri, child type, broader uri, broader type
convert("broaderRelationsSkillPillar_it.csv", "broader_it.tsv",
        ["conceptUri", "conceptType", "broaderUri", "broaderType"])
