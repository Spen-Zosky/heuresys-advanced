# heuresys-advanced — STATE

**Updated**: 2026-06-05 (S965). Baseline **v1.0.0 GA**. main synced (`e7e9de3`), migration `000070`, CI verde. PROD `https://www.heuresys.com` (TLS) — non toccata da questa sessione.

> **SoT unica**: questo file è l'**unica** SoT di stato (governance: `CLAUDE.md §Source of Truth`). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · storici → `docs/archive/`.

## Last session brief (S965 — ultracode)

**i18n milestone CHIUSA**: 45 pagine / 4 namespace (ess/admin/hr/blueprints) + shell + EN gate + guardrail `no-literal-string` `error` + € locale-aware; parity 802×2×7, E2E prod verde. **BI ① P3 org-network** full-stack (`GET /v1/analytics/org-network`, span/depth/reach, mig 000070, E2E live). **F7** valutato (tokenize già completo; split SystemHealthDashboard + extract DashboardShell segnalati). **next 15.5.18→15.5.19** (backport, opzione A). **react/react-dom override riconciliato** 19.2.5→19.2.7. **SoT unificata**: questo file è l'unica SoT-stato, 4 file storici archiviati in `docs/archive/`, governance in CLAUDE.md. Tutto pushato, CI verde.

## Top priorities (next session)

1. **next 16** (B-23 / PR #21) — **STAND-BY** fino a un driver (feature/perf next16 o EOL linea 15). Quando: rimuovi `eslint` key da `next.config.js` + `eslint-config-next@16` + `middleware`→`proxy` + full E2E re-validation prod-mode. ~2-3h.
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); poi voyage-3.5 person→occupation + skill→skill, USER-scope. ~3-4h.
3. **F7 split/extract** (decisione Enzo) — split `SystemHealthDashboard` (344 righe demo) / extract `DashboardShell` (lib-owned → upstream `ux-design-shared`). ~2h.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- Deploy PROD di S965? (`scripts/vm-deploy.sh`, step separato — PROD è su HEAD precedente).
- Debito minore `@types/react` (override 19.2.14; fix upstream `ux-design-shared`). Gated upstream: typescript 6 (#22) / vite 8 (#20).

## Stack snapshot

- PROD = nginx TLS → web `:3013` → api `:8013`. Deploy = `scripts/vm-deploy.sh` (non tocca nginx/.env).
- migration `000070`, ~285 endpoint. i18n 7 ns IT+EN (parity 802×2×7, guardrail `error`). Deps: next **15.5.19**, react 19.2.7, pino 10.3.1, vitest 4.1.8 (next 16 stand-by).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline      # vuoto = synced
cd apps/web && pnpm i18n:check                                   # parity 802 x2 x7
pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string  # 0 (guardrail error)
```
