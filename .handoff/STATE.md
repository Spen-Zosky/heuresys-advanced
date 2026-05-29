# heuresys-advanced — STATE

**Updated**: 2026-05-29 (S947 — brand-fidelity migration Phase 0→3 shipped).
**Branch**: `main` — HEAD `ae69699` = origin (pushed). **Last tag**: `v0.4.1-housekeeping-closed`.
**CI**: ⚠ deploy Pages/showcase ✅; Playwright/test/build/lint ❌/⏸ — **runner OCI VM offline (OOM)**, non codice. Re-run pendente.

## Last session brief

- **Brand-fidelity migration Phase 0→3**: 29 pagine reali `(authenticated)/*` portate a fedeltà canonica `@heuresys/ui` per tipologia (1 dashboard API-first + 19 liste + 9 detail). Nuovi componenti condivisi: `components/{data-table-panel(DataTablePanel+EntityTable),status-pill,detail-panel(FieldGrid)}`; contract in `docs/architecture/brand-component-contract.md`. 6 commit (`0f74a0e`→`ae69699`), tutti verdi in **build di produzione** (typecheck+build+~70 Playwright+60 a11y+6 API).
- Foundation A: anomalia `/me`-light era **dev-only** (cold-compile), no bug prod. Regression guard `tests/e2e/theme-propagation.spec.ts`.
- **F7 cleanup ROLLBACKato**: `apps/web/src/app/showcase` è la SORGENTE di `apps/showcase` (via `sync-showcase.sh`), NON ridondante → rimuoverlo rompe deploy Pages. F7 vero = refactor (vedi memoria).

## Top priorities (next session)

1. **Re-run CI** (~5min): `gh run rerun` dei 4 workflow self-hosted quando il runner OCI VM è di nuovo online (auto-recovery OOM o riavvio console OCI). Verificare verde.
2. **Brand-fidelity F4-F6** (~6-10h): F4 charts (compensation/visualizations/career/org-chart → EChartsCard/gauges — ⚠ verificare `next build` per CW-B59 con echarts/three); F5 ESS `/me/*` (~10 pagine); F6 admin (`/admin/roles`→RbacMatrix). Pattern+componenti già pronti.
3. **F7-refactor** (richiede ok Enzo): spostare sorgente showcase in apps/showcase + aggiornare sync-showcase.sh/showcase.yml/middleware.

## Open questions

- **Runner CI infra**: ARM free-tier sottodimensionato per Playwright/Chromium (causa OOM S947). Spostare playwright-smoke su ubuntu-hosted, o +swap/+limiti sul runner?
- B-10 SDBI Phase 2 (~6-10h, sbloccato da zod4) ancora aperto — priorità vs brand-fidelity F4-F6.

## Stack snapshot

- HEAD `ae69699` = origin. `@heuresys/ui` ^0.1.1 (npm). next 15.5.18 · zod 4.4.3 · Node 22 (VM).
- **Web dev locale prod-verify**: `pnpm --filter @heuresys/web build` + `next start -p 3000` (API :3001); E2E SEMPRE in prod build (mai `next dev` — falsi negativi). Riavvio :3000 su Windows: `Stop-Process` su PID porta (TaskStop lascia il child Node → EADDRINUSE).
- **Tunnel DB**: hands-off cross-reboot (ADR-0021). **SoT viva**: `docs/kb/` + memoria `project-brand-fidelity-migration`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'   # se timeout: VM ancora in OOM da S947
nc -z localhost 5433                                # tunnel (ADR-0021)
git log origin/main..HEAD --oneline                 # empty = synced
gh run list --limit 6                               # se rosso runner-offline: gh run rerun <id>
```
