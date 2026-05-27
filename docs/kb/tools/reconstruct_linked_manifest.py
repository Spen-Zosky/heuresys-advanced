#!/usr/bin/env python3
"""
reconstruct_linked_manifest.py — Ricostruisce manifest.yaml (sources[]) di un vault
source_mode: linked scansionando le pagine wiki/sources/*.md e leggendo il loro
frontmatter `source_path` (path assoluto esterno). Calcola SHA-256 + size sul file
esterno. Idempotente: eseguibile dopo qualsiasi batch di ingestion (no race manifest).

Usage: python reconstruct_linked_manifest.py <vault-path>
"""
import hashlib
import os
import sys
import glob
from datetime import datetime, timezone

import yaml

NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(65536), b""):
            h.update(c)
    return h.hexdigest()


def front(path):
    """estrae il blocco frontmatter YAML (tra --- iniziali)."""
    with open(path, "r", encoding="utf-8") as f:
        t = f.read()
    if not t.startswith("---"):
        return {}
    end = t.find("\n---", 3)
    if end < 0:
        return {}
    try:
        return yaml.safe_load(t[3:end]) or {}
    except Exception:
        return {}


def main(argv):
    if len(argv) != 2:
        print("usage: reconstruct_linked_manifest.py <vault-path>", file=sys.stderr)
        return 1
    vault = argv[1]
    mpath = os.path.join(vault, "manifest.yaml")
    m = {}
    if os.path.exists(mpath):
        with open(mpath, "r", encoding="utf-8") as f:
            m = yaml.safe_load(f) or {}

    sources = []
    missing = []
    for page in sorted(glob.glob(os.path.join(vault, "wiki", "sources", "*.md"))):
        fm = front(page)
        if fm.get("type") != "source":
            continue
        ap = fm.get("source_path") or (fm.get("sources") or [None])[0]
        rel_page = "wiki/sources/" + os.path.basename(page)
        if not ap or not os.path.exists(ap):
            missing.append((rel_page, ap))
            continue
        sources.append({
            "source_abs_path": ap,
            "hash_sha256": sha256(ap),
            "file_size_bytes": os.path.getsize(ap),
            "ingested_at": fm.get("created", NOW) and NOW,
            "source_page": rel_page,
            "touched_pages": [rel_page],
            "status": "current",
        })

    # conteggi pagine
    def count(sub):
        return len(glob.glob(os.path.join(vault, "wiki", sub, "*.md")))

    m["source_mode"] = "linked"
    m["sources"] = sources
    m.setdefault("stats", {})
    m["stats"]["sources"] = count("sources")
    m["stats"]["concepts"] = count("concepts")
    m["stats"]["entities"] = count("entities")
    m["stats"]["syntheses"] = count("syntheses")
    m["last_session"] = NOW

    with open(mpath, "w", encoding="utf-8") as f:
        yaml.safe_dump(m, f, allow_unicode=True, sort_keys=False, width=4096)

    print(f"OK: manifest ricostruito — {len(sources)} sources linked, "
          f"pagine: {m['stats']['sources']}s/{m['stats']['concepts']}c/"
          f"{m['stats']['entities']}e/{m['stats']['syntheses']}y")
    if missing:
        print(f"WARN: {len(missing)} pagine source senza source_path valido:", file=sys.stderr)
        for rp, ap in missing[:20]:
            print(f"  {rp} -> {ap}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
