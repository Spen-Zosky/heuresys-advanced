# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-09 (S979).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S979 — linux-pc gemello PROD autonomo + dottrina full-alignment v1+v2)

Provisionato **`linux-pc`** (192.168.1.11, Zorin x86_64, user enzo, `/home/enzo`) come **gemello PROD autonomo** della VM, **ISOLATO** da align-clones: server completo **LAN-accessible** (api :8013 / web :3013 su 0.0.0.0) con **DB PostgreSQL 16 locale = clone 1:1 del DB reale VM** (1.1GB, `clone-vm-db.sh` ri-lanciabile), **runtime indipendente dalla VM**. + ecosistema Claude clonato da Windows (overwrite+backup 1.9G, auth locale preservata, 211 plugin). Entrypoint on-demand **`provision-linux-pc.sh`** (+ `setup-local-pg.sh`). Deps post-align: pgvector, libpq-dev. Dettaglio → memoria `reference_linux_pc_prod_twin`. Prima nella stessa sessione: **dottrina full-alignment v1+v2** (`align-clones` + delta close-flow automatizzato nel `handoff` Step 4b, E2E live verde PC=Mac=VM) + fix `/doctor` MCP. Priorità di prodotto invariate (sotto).

## Top priorities (next session)

1. **cap④ CMS P3 residuo** — BPM cross-link (content↔blueprint) + search-UI box su `/content` (API full-text già live). Media object-store ⛔ decisione infra/costo (PM). ~M.
2. **MFA §2.5 residuo** (WEBAUTHN `@simplewebauthn` + ceremony · session-enum UI `/me/security/sessions` · mandatory-MFA policy; SMS_OTP ⛔ provider+costo PM) · **WCAG §2.7 tail** (axe per-route + mobile sweep, multi-sessione; critical=0 già gated) · **cap⑤ 2ª sorgente** ISTAT/ATECO (⛔ ToS). Multi-sessione.
3. **Integrare `linux-pc` nelle regole di align/deploy** (oggi isolato per scelta — "aggiusteremo dopo il primo cloning", Enzo): decidere se/come `align-clones` lo include come 3° target PROD-locale (semantica diversa da mac dev e vm prod). ~M. Vedi `reference_linux_pc_prod_twin`.

## Open questions

- **Media object-store** (cap④ P3): dove archiviare i media (S3/MinIO/disk) — decisione infra/costo PM.
- **SMS_OTP** (MFA §2.5): scelta provider + costo — decisione PM.
- **cap⑤ 2ª sorgente**: sign-off ToS ISTAT/ATECO.
- **linux-pc nelle regole align/deploy**: come integrarlo (target PROD-locale isolato vs nel flusso) — decisione Enzo.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
for h in oracle-vm-default mac-local; do MSYS_NO_PATHCONV=1 ssh $h 'cd ~/heuresys-advanced 2>/dev/null || cd /home/ubuntu/heuresys-advanced; git rev-parse --short HEAD'; done  # mac+vm == PC
curl -s -o /dev/null -w 'VM %{http_code}\n' http://80.225.82.207:8013/readyz          # 200 = VM PROD
curl -s -o /dev/null -w 'linux-pc %{http_code}\n' http://192.168.1.11:8013/readyz      # 200 = twin autonomo (isolato)
```
