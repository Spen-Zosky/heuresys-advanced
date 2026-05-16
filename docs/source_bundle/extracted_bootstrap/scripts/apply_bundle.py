#!/usr/bin/env python3
"""
Idempotent installer for the Banking HRMS/BPM Blueprint Bundle.

Usage:
  python scripts/apply_bundle.py --target /path/to/target-folder

What it does:
- creates the target folder if missing;
- copies bundle files into the target using the canonical structure;
- backs up target files only when content differs;
- writes an install manifest with checksums;
- can be re-run safely.
"""
import argparse, hashlib, json, shutil
from pathlib import Path
from datetime import datetime

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def copy_if_changed(src: Path, dst: Path, backup_dir: Path, changes: list):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        if sha256(src) == sha256(dst):
            changes.append({"status": "unchanged", "file": str(dst)})
            return
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / dst.relative_to(dst.parents[len(dst.parents)-1] if False else dst.anchor).as_posix().replace("/", "__")
        # simpler stable backup name
        backup_path = backup_dir / str(dst).replace(":", "").replace("\\", "__").replace("/", "__")
        shutil.copy2(dst, backup_path)
        changes.append({"status": "backup_created", "file": str(dst), "backup": str(backup_path)})
    shutil.copy2(src, dst)
    changes.append({"status": "copied", "file": str(dst)})

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True, help="Target folder to install/update")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    bundle_root = Path(__file__).resolve().parents[1]
    target = Path(args.target).resolve()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = target / "_backup" / f"bundle_update_{timestamp}"

    include_dirs = [
        "industry_blueprints",
        "universal_hrms_framework",
        "tenant_blueprints",
        "config",
        "schemas",
    ]
    include_files = [
        "README.md",
        "INDEX.md",
        "ISTRUZIONI.md",
        "LOGICAL_DATA_MODEL_ADDENDUM.md",
        "manifest.json",
    ]

    sources = []
    for d in include_dirs:
        p = bundle_root / d
        if p.exists():
            sources.extend([x for x in p.rglob("*") if x.is_file()])
    for f in include_files:
        p = bundle_root / f
        if p.exists():
            sources.append(p)

    changes = []
    if args.dry_run:
        for src in sources:
            dst = target / src.relative_to(bundle_root)
            changes.append({"status": "would_copy_or_check", "file": str(dst)})
    else:
        target.mkdir(parents=True, exist_ok=True)
        for src in sources:
            dst = target / src.relative_to(bundle_root)
            copy_if_changed(src, dst, backup_dir, changes)

        manifest = {
            "installed_at": datetime.now().isoformat(),
            "bundle_version": "2.1-idempotent",
            "files": []
        }
        for src in sources:
            dst = target / src.relative_to(bundle_root)
            if dst.exists():
                manifest["files"].append({
                    "path": str(dst.relative_to(target)),
                    "sha256": sha256(dst)
                })
        (target / ".bundle_install_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps({"target": str(target), "dry_run": args.dry_run, "changes": changes}, indent=2))

if __name__ == "__main__":
    main()
