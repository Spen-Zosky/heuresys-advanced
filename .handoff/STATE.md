# heuresys-advanced — STATE

**Updated**: 2026-05-28 (S943 — toolkit bootstrap cross-OS COMPLETO, Mac T1 verificato).
**Branch**: `main` — HEAD `b13e64e` (push in corso) synced origin. CI verde. **0 alert Dependabot**.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

- **zod 4 + ftpz 6 (B-20/B-21) landed** (`17fad36`): root cause = `packages/shared` su zod-3. CI verde, PR Dependabot #3/#5 chiuse.
- **heuresys-advanced gira LIVE sulla VM** (pubblico `:8013` API / `:3013` web, systemd dev-mode, Node 22 nvm, DB locale :5432) accanto a evo.
- **B-44 toolkit bootstrap idempotente cross-OS COMPLETO**: `scripts/{vm-bootstrap.sh, dev-bootstrap.sh, dev-bootstrap.ps1, sync-gitignored-to-vm.sh}` + `deploy/`. **Matrice verificata live: Linux-arm64 ✅ · Windows ✅ · Mac/Darwin ✅** (amd64 by-construction). 3 bug cross-platform fixati: filtro `--filter` single→double quote; nvm non-safe sotto `set -euo`; tunnel "already up" ingannato da listener estraneo (Docker su :5433 sul Mac).

## Top priorities (next session)

1. **B-10 SDBI Phase 2** (~6-10h, sbloccato da zod4; dati brownfield già mirrorati sulla VM via `sync-gitignored-to-vm.sh`). Definire scope per-area (stack completo Zod+repo+service+routes+test per area).
2. ~~B-31 ADR ssh-agent persistence~~ **CHIUSO 2026-05-28 via ADR-0021** — tunnel DB `:5433` hands-off cross-reboot (service-account key ristretta no-passphrase + scheduled task + hook session-boot). B-40/41/42 deferiti.
3. (Opzionale) Teardown stack evo sulla VM → libera 8012/3012 + riduce esposizione pubblica.

## Open questions

- **Teardown evo sulla VM**: fase deliberata backup+decommission (3 systemd `/home/ubuntu/heuresys-evo/services/*` + 9-container compose `/home/ubuntu/heuresys.com.evo/infra`, DB docker :5433). Non pianificata.
- Esposizione pubblica VM: grafana/prometheus/pg-exporter raggiungibili da Internet (Docker bypassa ufw) — sanare col teardown evo.

## Stack snapshot

- HEAD `b13e64e` = origin. CI 6 workflow verdi + showcase deploy.
- Versioni: zod 4.4.3 · ftpz 6.1.0 · react-i18next 17 · i18next 26 · next 15.5.18 · Node 22 (VM nvm).
- **Deploy**: `scripts/` + `deploy/README.md`. **Mac dev**: usare `DB_PORT=5434` (Docker tiene :5433). `@heuresys/ui` da **npm registry** (`ux-design-shared` NON serve per operare; solo per sviluppo UI lib).
- **SoT viva**: `docs/kb/`. Worktree zod4 rimosso.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || powershell Start-ScheduledTask HeuresysTunnel5433   # tunnel auto cross-reboot (ADR-0021); hook session-boot.ps1 lo copre comunque
git log origin/main..HEAD --oneline   # empty = synced
curl -s http://80.225.82.207:8013/healthz   # advanced live on VM
gh run list --limit 4                 # CI green
```
