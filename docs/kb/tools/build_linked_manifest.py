#!/usr/bin/env python3
"""
build_linked_manifest.py — Costruisce il linked_sources.yaml (prosa high-value) per il
vault heuresys-advanced-wiki, attingendo a docs/kb/index_paths.yaml.

Subset "prosa high-value" (decisione Enzo S939): ADR + doc-canonical live, ESCLUSI i raw
source bundle (docs/source_bundle/, docs/brownfield raw) e i generati graphify-out.
Niente codice/test/schemi (quelli vanno a graphify).

Usage: python build_linked_manifest.py [out.yaml]
Default out: la variabile HEURESYS_LINKED_MANIFEST (nessun percorso fisso)
"""
import os
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
INDEX = os.path.join(ROOT, "docs", "kb", "index_paths.yaml")
DEFAULT_OUT = os.environ.get("HEURESYS_LINKED_MANIFEST", "")

PROSE_CATEGORIES = {"ADR", "doc-canonical"}
EXCLUDE_SUBSTRINGS = [
    "docs/source_bundle/",
    "docs/brownfield/_inspection",
    "graphify-out",
    "docs/kb/tools/",   # tooling, not prose
    "docs/github/",      # corso GitHub generico, non dominio heuresys (resta in indice+graphify)
]


def main(argv):
    out = argv[1] if len(argv) > 1 else DEFAULT_OUT
    if not out:
        print("uso: build_linked_manifest.py <out.yaml> (o HEURESYS_LINKED_MANIFEST)", file=sys.stderr)
        return 2
    with open(INDEX, "r", encoding="utf-8") as f:
        idx = yaml.safe_load(f)

    selected = []
    for e in idx.get("files", []):
        if e.get("category") not in PROSE_CATEGORIES:
            continue
        if e.get("status") != "live":
            continue
        p = e.get("path", "")
        pn = p.replace("\\", "/")
        if any(s in pn for s in EXCLUDE_SUBSTRINGS):
            continue
        if not p.lower().endswith((".md", ".txt")):
            continue
        selected.append({
            "path": p,
            "category": e.get("category"),
            "provenance": e.get("provenance", ""),
        })

    selected.sort(key=lambda x: x["path"])
    doc = {
        "meta": {
            "vault": "heuresys-advanced-wiki",
            "source_mode": "linked",
            "subset": "prose-high-value (ADR + doc-canonical live, excl. source_bundle/tooling/generated)",
            "source_index": INDEX,
            "total": len(selected),
        },
        "files": selected,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        yaml.safe_dump(doc, f, allow_unicode=True, sort_keys=False, width=4096)
    print(f"OK: {len(selected)} prose sources -> {out}")
    cats = {}
    for s in selected:
        cats[s["category"]] = cats.get(s["category"], 0) + 1
    print("by category:", cats)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
