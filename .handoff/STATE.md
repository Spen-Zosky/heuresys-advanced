# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-05 (S965).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare del sistema** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Entrambe le viste (rapida + granulare) sono governate dalla skill `handoff` — **domini disgiunti, nessun numero duplicato qui**.

## Last session brief (S965 — ultracode)

i18n milestone **CHIUSA** (45 pagine / 4 namespace + EN gate + guardrail `error` + € locale-aware) · **BI ① P3 org-network** full-stack · **F7** valutato (tokenize fatto; split/extract segnalati) · **next** bump backport (next 16 stand-by) · **react override riconciliato** · **SoT v2 + meta**: due viste disgiunte (STATE rapida + SOT_STATE granulare) + **session-start action-menu** (CLAUDE.md `## Session start`) + **handoff v4** (scrive STATE+SOT_STATE+backlog+debt). Tutto pushato, CI verde. (Numeri esatti → `docs/kb/SOT_STATE.md`.)

## Top priorities (next session)

1. **next 16** (B-23 / PR #21) — **STAND-BY** fino a un driver (feature/perf next16 o EOL linea 15). ~2-3h.
2. **② AI P1 backfill** — gated su `VOYAGE_API_KEY` nel `.env` VM (azione Enzo); poi voyage-3.5 person→occupation + skill→skill. ~3-4h.
3. **F7 split/extract** (decisione Enzo) — split `SystemHealthDashboard` / extract `DashboardShell` (lib-owned → upstream `ux-design-shared`). ~2h.

## Open questions

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- Deploy PROD di S965? (`scripts/vm-deploy.sh`, step separato — PROD su HEAD precedente).
- Debito minore `@types/react` (fix upstream `ux-design-shared`). Gated upstream: typescript 6 (#22) / vite 8 (#20).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline      # vuoto = synced
cd apps/web && pnpm i18n:check                                   # parity OK (numero in SOT_STATE)
pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string  # 0 (guardrail error)
```
