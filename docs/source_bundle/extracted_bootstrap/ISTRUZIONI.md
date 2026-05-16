# ISTRUZIONI.md — Idempotent Bundle Usage

## Objective

Install or update the banking HRMS/BPM blueprint bundle without creating duplicate process numbers, overwriting changed files without backup, or losing canonical structure.

## Recommended Use

1. Extract the ZIP.
2. Open a terminal inside the extracted folder.
3. Run the idempotent installer against your target repository or documentation folder.

### Windows PowerShell

```powershell
./scripts/apply_bundle.ps1 -Target "C:\path\to\your\blueprint-folder"
```

### Linux / macOS / WSL

```bash
./scripts/apply_bundle.sh /path/to/your/blueprint-folder
```

### Direct Python

```bash
python scripts/apply_bundle.py --target /path/to/your/blueprint-folder
```

## What the Installer Does

- Creates missing folders.
- Copies canonical files.
- Checks SHA-256 hashes.
- Leaves unchanged files untouched.
- Backs up existing changed files before replacing them.
- Writes `.bundle_install_manifest.json` in the target folder.

## Validation

Run:

```bash
python scripts/validate_bundle.py
```

Expected result:

```json
{
  "status": "OK",
  "process_count": 23
}
```

## Important

The process files are already renumbered canonically:

- `00` = Enterprise Typing.
- `01–17` = banking BPM.
- `18–22` = HRMS intelligence extension.

Do not manually merge old `14–18` extension files into the root without renumbering, otherwise duplicate numeric prefixes will reappear.
