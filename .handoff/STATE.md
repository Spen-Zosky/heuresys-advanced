# heuresys-advanced — STATE

**Updated**: 2026-05-28 (S942 — zod4+ftpz6 landed; advanced live sulla VM; toolkit bootstrap cross-OS B-44).
**Branch**: `main` — HEAD `945398b` synced origin (0/0). CI verde. **0 alert Dependabot**.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

- **B-20/B-21 zod4+ftpz6 ESEGUITO e merged** (`17fad36`): causa-radice = `packages/shared` rimasto su zod-3 (lo spike aveva bumpato solo api/web) → ftpz6 non inferiva i tipi. Fix = bump shared→4.4.3 + `ZodError.errors`→`.issues` + 1 fix test (zod4 `z.uuid()` RFC-strict). 302→0 tc error, suite 345/5/0, CI verde. PR Dependabot #3/#5 chiuse.
- **heuresys-advanced gira LIVE sulla VM** (pubblico `:8013` API / `:3013` web, systemd dev-mode, Node 22 via nvm, DB locale :5432) **accanto** allo stack evo legacy.
- **B-44 toolkit bootstrap idempotente cross-OS**: `scripts/{vm-bootstrap.sh, dev-bootstrap.sh, dev-bootstrap.ps1, sync-gitignored-to-vm.sh}` + `deploy/`. Verificati live VM-arm64 + Windows. 2 bug cross-platform fixati (filtro `--filter` single→double quote; nvm non-safe sotto `set -euo`).

## Top priorities (next session)

1. **Verifica live Mac** di `dev-bootstrap.sh` (path Darwin brew/BSD-sed) — Mac era spento. Eseguire via `mac-local` quando online. Riconciliare IP Mac CLAUDE.md (`.4` vs `.7`). (~30min)
2. **B-10 SDBI Phase 2** (~6-10h, sbloccato da zod4; dati brownfield ora già mirrorati sulla VM via `sync-gitignored-to-vm.sh`). Definire scope per-area.
3. **B-31** ADR ssh-agent persistence (decisione security). B-40/41/42 deferiti.

## Open questions

- **Teardown stack evo sulla VM** per liberare 8012/3012 + ridurre l'esposizione pubblica (grafana/prometheus/pg-exporter raggiungibili da Internet via Docker-ufw bypass): fase deliberata backup+decommission, non ancora pianificata.
- B-10 SDBI: una macro-area è "fatta" solo con stack completo (Zod+repo+service+routes+test) — scope per-area da definire.

## Stack snapshot

- HEAD `945398b` = origin. CI 6 workflow verdi + showcase deploy.
- Versioni: **zod 4.4.3 · ftpz 6.1.0** (merged) · react-i18next 17.0.8 · i18next 26.3.0 · next 15.5.18 · Node 22 (VM via nvm).
- **Deploy**: `scripts/` + `deploy/README.md` — vedi B-44. Worktree zod4 rimosso (ff-merged).
- **SoT viva**: `docs/kb/` (SOT_STATE/SOT_BACKLOG/DEBT_REGISTER).

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline   # empty = synced
curl -s http://80.225.82.207:8013/healthz   # advanced live on VM
gh run list --limit 4                 # CI green
```
