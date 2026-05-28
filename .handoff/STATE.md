# heuresys-advanced — STATE

**Updated**: 2026-05-28 (S944 — ADR-0021 tunnel hands-off; handoff completato in S945 dopo interruzione API a fine S944).
**Branch**: `main` — HEAD `ec1e277`, push in corso. CI verde. **0 alert Dependabot**.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

- **ADR-0021 hands-off DB tunnel landed** (`ec1e277`): tunnel SSH `localhost:5433 → oracle-vm-default:5432` (unico path al PostgreSQL live, ADR-0010) ora si rialza da solo cross-reboot, senza passphrase, senza step manuali. Chiave service-account ristretta (no shell, `permitopen=127.0.0.1:5432` + forced command), scheduled task At-Logon, hook `session-boot.ps1`. **B-31/CW-B62 chiusi.**
- Bug risolti in corsa: `permitopen` `localhost` vs `127.0.0.1` su OpenSSH 9.6; append `authorized_keys` bloccato da flag immutabile VM; `ssh-keygen` passphrase vuota su PowerShell 5.1.
- **Nota**: S944 troncata da `API Error 400` (thinking blocks) prima della chiusura → push + handoff completati a inizio S945.

## Top priorities (next session)

1. **B-10 SDBI Phase 2** (~6-10h, sbloccato da zod4; dati brownfield già mirrorati sulla VM via `sync-gitignored-to-vm.sh`). Definire scope per-area (stack completo Zod+repo+service+routes+test per area).
2. (Opzionale) Teardown stack evo sulla VM → libera 8012/3012 + riduce esposizione pubblica.

## Open questions

- **Teardown evo sulla VM**: fase deliberata backup+decommission (3 systemd `/home/ubuntu/heuresys-evo/services/*` + 9-container compose `/home/ubuntu/heuresys.com.evo/infra`, DB docker :5433). Non pianificata.
- Esposizione pubblica VM: grafana/prometheus/pg-exporter raggiungibili da Internet (Docker bypassa ufw) — sanare col teardown evo.

## Stack snapshot

- HEAD `ec1e277` = origin (post-push). CI 6 workflow verdi + showcase deploy.
- Versioni: zod 4.4.3 · ftpz 6.1.0 · react-i18next 17 · i18next 26 · next 15.5.18 · Node 22 (VM nvm).
- **Deploy**: `scripts/` + `deploy/README.md`. **Tunnel DB Windows**: hands-off cross-reboot (ADR-0021); scheduled task `HeuresysTunnel5433` + hook `session-boot.ps1`. **Mac dev**: `DB_PORT=5434` (Docker tiene :5433). `@heuresys/ui` da **npm registry**.
- **SoT viva**: `docs/kb/`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || powershell Start-ScheduledTask HeuresysTunnel5433   # tunnel auto cross-reboot (ADR-0021); hook session-boot.ps1 lo copre comunque
git log origin/main..HEAD --oneline   # empty = synced
curl -s http://80.225.82.207:8013/healthz   # advanced live on VM
gh run list --limit 4                 # CI green
```
