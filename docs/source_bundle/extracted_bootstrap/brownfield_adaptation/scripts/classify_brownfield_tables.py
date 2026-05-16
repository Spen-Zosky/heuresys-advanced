#!/usr/bin/env python3
"""
Classify brownfield tables using conservative name-based rules.
Human review is mandatory.
"""
import argparse, json, re
from pathlib import Path

EXCLUDE_PATTERNS = ["payroll", "medical", "attendance", "benefit", "bank_detail", "pay_stub", "sap_", "session", "rls"]
IMPORT_PATTERNS = ["esco", "skill", "course", "learning_path", "business_process", "process_kpi", "job_template", "job_family"]

def classify(name: str):
    n = name.lower()
    if any(p in n for p in EXCLUDE_PATTERNS):
        return "EXCLUDE"
    if any(p in n for p in IMPORT_PATTERNS):
        return "IMPORT"
    if "user" in n or "employee" in n or "tenant_job" in n or "org_chart" in n:
        return "TRANSFORM"
    return "REFERENCE_ONLY"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory-json", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    inv = json.loads(Path(args.inventory_json).read_text(encoding="utf-8"))
    candidates = []
    for f in inv.get("files", []):
        base = Path(f).name
        if base.endswith(".md") or base.endswith(".json") or base.endswith(".sql"):
            candidates.append({"source_file": f, "classification": classify(base)})
    Path(args.out).write_text(json.dumps(candidates, indent=2), encoding="utf-8")
    print(f"Wrote {args.out}")

if __name__ == "__main__":
    main()
