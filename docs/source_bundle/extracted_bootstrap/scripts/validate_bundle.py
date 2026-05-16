#!/usr/bin/env python3
"""
Validation script for canonical numbering and required files.
"""
from pathlib import Path
import json, re, sys, hashlib

root = Path(__file__).resolve().parents[1]
registry = json.loads((root / "config" / "process_registry.json").read_text(encoding="utf-8"))
process_dir = root / "industry_blueprints" / "FIN_BANKING" / "processes"

errors = []
files = sorted([p.name for p in process_dir.glob("*.md")])
expected = [p["file"] for p in registry["processes"]]

if files != expected:
    errors.append({"type": "process_file_sequence_mismatch", "expected": expected, "actual": files})

prefixes = [f.split("_", 1)[0] for f in files]
if len(prefixes) != len(set(prefixes)):
    errors.append({"type": "duplicate_numeric_prefixes", "prefixes": prefixes})

for f in files:
    if not re.match(r"^\d{2}_.+\.md$", f):
        errors.append({"type": "invalid_filename", "file": f})

if errors:
    print(json.dumps({"status": "FAILED", "errors": errors}, indent=2))
    sys.exit(1)

print(json.dumps({"status": "OK", "process_count": len(files), "files": files}, indent=2))
