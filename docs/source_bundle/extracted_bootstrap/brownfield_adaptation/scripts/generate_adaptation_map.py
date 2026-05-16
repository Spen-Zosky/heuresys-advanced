#!/usr/bin/env python3
"""
Generate a first-pass brownfield adaptation map template.
This script is intentionally conservative and must be reviewed by humans.
"""
import argparse, csv
from pathlib import Path

DEFAULT_RULES = [
    ("tenants", "sys.sys_tenancies", "IMPORT", "IN_SCOPE"),
    ("users", "sys.sys_users + sys.sys_auth_*", "TRANSFORM", "PARTIALLY_IN_SCOPE"),
    ("esco_skills", "sys.sys_skills", "IMPORT", "IN_SCOPE"),
    ("esco_occupations", "sys.sys_esco_occupations", "IMPORT", "IN_SCOPE"),
    ("courses", "sys.sys_learning_modules", "IMPORT", "IN_SCOPE"),
    ("learning_paths", "sys.sys_learning_paths", "IMPORT", "IN_SCOPE"),
    ("employees_payroll", "", "EXCLUDE", "OUT_OF_SCOPE"),
    ("medical_certificates", "", "EXCLUDE", "OUT_OF_SCOPE"),
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source_table","target_table","classification","scope_status","notes"])
        for row in DEFAULT_RULES:
            w.writerow([row[0], row[1], row[2], row[3], "First-pass rule; review required"])
    print(f"Wrote {out}")

if __name__ == "__main__":
    main()
