#!/usr/bin/env python3
"""
Inspect a db-export.zip file and produce a table/file inventory.

Usage:
  python brownfield_adaptation/scripts/inspect_db_export.py --zip /path/to/db-export.zip --out docs/brownfield
"""
import argparse, json, zipfile
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.zip, "r") as z:
        files = z.namelist()
    inventory = {"zip": args.zip, "file_count": len(files), "files": files}
    (out / "brownfield_export_inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    print(json.dumps({"status": "OK", "file_count": len(files), "out": str(out)}, indent=2))

if __name__ == "__main__":
    main()
