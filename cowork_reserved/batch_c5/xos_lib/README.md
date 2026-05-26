# xos_lib — Cross-OS Pipeline Library (CW-B28 mitigation)

**Author**: Cowork batch C5.3
**Date**: 2026-05-21
**Status**: ready for CLI X5 commit + adoption in SDBI extract scripts

---

## §1 — Purpose

`cross_os_pipeline.sh` è una libreria **sourceable** bash che generalizza il pattern CW-B28 (cross-OS pg_dump filtering) in funzioni riutilizzabili per qualsiasi futuro extract SDBI da `heuresys_platform` (OCI VM, PG 16+) verso `heuresys_advanced.legacy_mirror` (locale Windows / Mac / VM).

Sostituisce la duplicazione del pattern grep/sed cross-script che ha causato CW-B28 in `db/scripts/extract_users_employees_legacy.sh` (C3 batch).

## §2 — Quando usarla

OGNI volta che un nuovo extract SDBI deve copiare tabelle `public.*` di `heuresys_platform` in `legacy_mirror.*` di `heuresys_advanced`. Pattern target: macro-aree SDBI #1-#11 (Performance, Recruiting, Time/Leave, Compensation, Skills/Learning, Engagement, Workflow, Governance/Audit, Industry/ESCO, AI/Embeddings, Cross-tenant).

## §3 — API

| Funzione | Scopo |
|---|---|
| `xos_init` | Setup obbligatorio: SSH host + remote DB + local DB URL. Verifica reachability ssh+psql. |
| `xos_log` / `xos_die` | Logging strutturato (timestamp + prefix). |
| `xos_dump_schema` | Dump DDL filtrato (no `\restrict`, vector→text, uuid_generate→gen_random, no FK/index). |
| `xos_dump_data` | Dump COPY filtrato (no `\restrict`, public→target schema rewrite). |
| `xos_ensure_schema` | `CREATE SCHEMA IF NOT EXISTS` idempotente. |
| `xos_restore_legacy_mirror` | Pipeline end-to-end: schema + dati + verifica row count. Opzione `--truncate-first` per rerun. |
| `xos_run_sql_file` | Apply file `.sql` locale via psql con `ON_ERROR_STOP=1`. |

Flag globali su `xos_init`: `--dry-run` (no side effects, solo log), `--verbose`.

## §4 — Esempio uso (template per future scripts)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source the library (path relative to script location)
source "$(dirname "$0")/../../cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh"

# Init
xos_init \
  --ssh-host oracle-vm-default \
  --remote-db heuresys_platform \
  --local-db-url "${DATABASE_URL:-postgresql://heuresys:****@localhost:5433/heuresys_advanced}"

# Pipeline: copy Time/Leave source tables to legacy_mirror
xos_restore_legacy_mirror \
  --schema legacy_mirror \
  --tables "leave_requests leave_types overtime_records time_off_balances holidays" \
  --truncate-first

xos_log "Time/Leave legacy_mirror staging complete"
```

## §5 — Cross-OS verification matrix

| OS | Bash | Notes |
|---|---|---|
| Windows 11 + Git Bash | 4.4+ | psql in PATH (PostgreSQL installer). DB URL uses forward-slash paths only. |
| macOS Sonoma+ | 3.2 (default) / 5.x (brew) | psql via `brew install libpq` + add to PATH. SSH host alias from `~/.ssh/config`. |
| Ubuntu 24.04 (VM) | 5.1 | psql native. Use `SSH_HOST=localhost` to skip SSH layer. |

Verified cross-platform pattern: extract_users_employees_legacy.sh (C3 fixed manually by CLI X3 — this lib formalizes the same fix).

## §6 — Adoption plan (X5+)

1. **CLI X5 commit**: add this directory under repo (chosen path: `cowork_reserved/batch_c5/xos_lib/` since it's batch-authored — promotion to `db/scripts/lib/` deferred to dedicated tooling sprint).
2. **Block B (Time/Leave + sys_users re-trigger)**: prossimi extract scripts MUST source this lib invece di duplicare grep/sed inline.
3. **Existing `extract_users_employees_legacy.sh`**: refactor opzionale post-X5 (out-of-scope X5 — già funzionante).
4. **Per macro-area SDBI #1-#11**: ogni extract script per Performance / Recruiting / Compensation / ecc. sourcerà questa lib.

## §7 — Self-test

```bash
# From repo root:
bash cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh
# Emits: bash version + OS + available xos_* functions + usage example
```

Smoke-test only — non esegue side effects.

## §8 — Acceptance criteria

1. ✅ File `cross_os_pipeline.sh` source-able su Windows Git Bash + Mac + VM
2. ✅ Self-test execution = no error exit
3. ⚠️ Adoption by next SDBI extract script (Time/Leave or sys_users re-trigger) = X5 deliverable
4. ⚠️ All future SDBI extracts use this lib (enforcement via PROMPT pattern memo §X update post-X5)

## §9 — Risk + rollback

**Risk**: LOW. La lib è additiva — non tocca script esistenti. Refactor `extract_users_employees_legacy.sh` può essere differito.

**Rollback**: rimuovere `cowork_reserved/batch_c5/xos_lib/` directory. Nessuna dipendenza inversa.

---

*End xos_lib README*
