# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-05 (S966).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare del sistema** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Entrambe le viste (rapida + granulare) sono governate dalla skill `handoff` — **domini disgiunti, nessun numero duplicato qui**.

## Last session brief (S966 — ultracode)

**D-15 risolto end-to-end + deploy PROD.** D-15 NON era un problema upstream come diceva il DEBT: era un pnpm **stale virtual-store** (orphan `@types/react@19.2.14` lasciato dal flip override S965 *senza clean install*; il source `.tsx` di `@heuresys/ui/brand/candidates` cadeva sul hoist-root stale → "two unrelated types"). **Fix locale** (override `@types/react`→19.2.16 + clean install) + **hardening upstream**: `@heuresys/ui@0.1.3` dichiara `@types/react`/`-dom` come optional peerDep (**pubblicato su npm**, consumato `^0.1.3`). Pulito anche `tsconfig.tsbuildinfo` tracked in `ux-design-shared`. **Mac + VM allineati a `c4c6363`**, **deploy PROD eseguito** (`vm-deploy.sh`: build api+web verdi, web/login 200, `https://www.heuresys.com` live). CI 6/6 verde. (Numeri esatti → `docs/kb/SOT_STATE.md`.)

## Top priorities (next session)

1. **next 16** (B-23 / PR #21) — **STAND-BY** fino a un driver (feature/perf next16 o EOL linea 15). ~2-3h.
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); poi voyage-3.5 person→occupation + skill→skill. ~3-4h.
3. **F7 split/extract** (decisione Enzo) — split `SystemHealthDashboard` / extract `DashboardShell` (lib-owned → upstream `ux-design-shared`). ~2h.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- next 16: quale driver per uscire da STAND-BY?
- F7 split/extract: procedere o lasciare on-brand com'è?

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline      # vuoto = synced
cd apps/showcase && pnpm exec tsc -p tsconfig.json --noEmit       # verde (D-15 chiuso)
gh run list --limit 6                                            # main CI verde
```
