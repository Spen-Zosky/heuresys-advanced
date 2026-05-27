#!/usr/bin/env python3
"""
build_graph_mirror.py — Costruisce un mirror di SYMLINK dell'indice dominio per graphify,
SENZA copiare file (Developer Mode ON). Il mirror vive FUORI dal repo → repo resta pulito,
nessun graphify-out da gitignorare nel repo.

Attinge a docs/kb/index_paths.yaml. Include i file rilevanti per un knowledge graph
(codice, docs, db, config, schemi); esclude i puri log/binari. Ricrea la struttura rel
sotto il mirror per preservare la risoluzione AST; i file Claude Desktop sotto _claude_desktop/.

Usage: python build_graph_mirror.py [mirror_dir]
Default mirror: C:\\Users\\enzospenuso\\wiki-space\\heuresys-advanced-graph\\src-mirror
"""
import os
import sys

import yaml

INDEX = r"D:\heuresys-advanced\docs\kb\index_paths.yaml"
DEFAULT_MIRROR = r"C:\Users\enzospenuso\wiki-space\heuresys-advanced-graph\src-mirror"

# categorie utili al grafo (codice + prosa + db + config); esclusi log puri
INCLUDE_CATEGORIES = {
    "api-module", "api-core", "shared-schema", "shared-pkg", "web-source",
    "showcase-source", "db-migration", "db-script", "db-seed", "config",
    "doc-canonical", "ADR", "ci", "test", "script",
}


def main(argv):
    mirror = argv[1] if len(argv) > 1 else DEFAULT_MIRROR
    with open(INDEX, "r", encoding="utf-8") as f:
        idx = yaml.safe_load(f)

    # reset mirror
    if os.path.isdir(mirror):
        for root, dirs, files in os.walk(mirror, topdown=False):
            for n in files:
                try:
                    os.unlink(os.path.join(root, n))
                except OSError:
                    pass
            for d in dirs:
                p = os.path.join(root, d)
                try:
                    (os.unlink if os.path.islink(p) else os.rmdir)(p)
                except OSError:
                    pass
    os.makedirs(mirror, exist_ok=True)

    linked, skipped, errors = 0, 0, 0
    for e in idx.get("files", []):
        if e.get("category") not in INCLUDE_CATEGORIES:
            skipped += 1
            continue
        src = e.get("path")
        rel = e.get("rel", "")
        if e.get("root") == "claude-desktop":
            dest_rel = os.path.join("_claude_desktop", rel.replace("/", os.sep))
        else:
            dest_rel = rel.replace("/", os.sep)
        dest = os.path.join(mirror, dest_rel)
        if not os.path.exists(src):
            errors += 1
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            if not os.path.lexists(dest):
                os.symlink(src, dest)
            linked += 1
        except OSError:
            errors += 1

    print(f"OK: {linked} symlink, {skipped} skipped (cat), {errors} errors -> {mirror}")


if __name__ == "__main__":
    sys.exit(main(sys.argv))
