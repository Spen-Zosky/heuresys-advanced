# heuresys-advanced — STATE

**Updated**: 2026-06-04 (S962). Baseline **v1.0.0 GA**. main synced (`6a1897f`), **migration `000068`**, CI **6/6 verde** (incl. Playwright-smoke prod + i18n-parity riarmato).

## Last session brief (S962 — ultracode, multi-workflow, 8 commit)

- **① BI Analytics P2** ✅ — 3 viste full-stack `/v1/analytics/{attendance,compensation,skills}` (schema→repo SQL scope-filtered→route `analytics:view`→integration test→page `@heuresys/ui` EChartsCard→nav mig `000066/067/068`→E2E live). **Verifica adversarial 3/3 PASS** (scope-isolation I5, employee-centric, SQL). Commit `e1b74df`/`73a69ca`/`8983788`.
- **CI bug fix**: `i18n-parity` puntava a `src/i18n/**` (dir inesistente) → **gate cieco**; repointato a `src/locales/**` (`6573a17`), ora attivo+verde.
- **Milestone i18n avviata** (IT default + EN): design spec `docs/superpowers/specs/2026-06-04-i18n-milestone-design.md`. Scope misurato (~600 chiavi/50 pagine, showcase escluso; **RSC eliminato**, E2E coupling basso). **Fase 0a ✅** (`be5c1ab`): i18n 7-namespace client-only + cookie locale + `LanguageSwitcher` IT/EN + shell estratta (`layout.tsx`+`data-table-panel.tsx`). + `sync-showcase` fix (prune react-i18next, `6a1897f`).

## Top priorities (next session)

1. **i18n Fase 0b + Fase 1 pilota** (~M): locale in `sys_user_preferences` + `/v1/me/preferences` + `PreferencesApplier` + ESLint `no-literal-string` guardrail; poi pilota **analytics** (5 pagine, refactor echarts-option `t`). Design: spec sopra; piano 7-fasi.
2. **② AI semantic-matching P1** (~L): backfill Voyage (person→ESCO occ + skill→skill, voyage-3.5, USER-scope). **Gated su `VOYAGE_API_KEY` nel `.env`**. Substrate pgvector già live.
3. **① BI P3** (~M): org-network. **6 proposte F7** (render-affecting, decisione Enzo).

## Open questions

- **`VOYAGE_API_KEY`** nel `.env` → sblocca ② P1 (unico gate). Costo ~$0.05.
- i18n: confermare default del design (plurali ICU sui count-badge, EN AI-assisted) — già locked salvo obiezione.
- Quali 6 proposte F7 applicare?

## Stack snapshot

- **migration `000068`** (`000066/067/068` = analytics-{attendance,compensation,skills} sidebar nav). **~284 endpoint** (+`/v1/analytics/{attendance,compensation,skills}`). API suite 650 pass / 6 skip.
- **i18n**: 7 namespace (`common/shell/analytics/admin/blueprints/hr/ess`), client-only, switcher IT/EN cookie-persisted; `common`+`shell` estratti, `analytics`+4 aree = scaffold vuoti. Reconciliation invariato **112/147 POPULATED**.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
cd apps/web && pnpm i18n:check                                 # parity 58 keys x2 x7 ns
cd apps/api && pnpm exec vitest run test/analytics.integration  # 16 green (P1+P2)
```
