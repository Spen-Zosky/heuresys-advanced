# heuresys-advanced — STATE

**Updated**: 2026-06-05 (S964). Baseline **v1.0.0 GA**. main synced (`55b2728`), migration `000069`. **PROD live `https://www.heuresys.com` (TLS) — non toccata da questa sessione.**

## Last session brief (S964 — i18n Fase 0b+1 + dependabot sweep + monoblock prep)

- **i18n Fase 0b + Fase 1 ✅** (`92b7773` / `1950817`, CI verde): locale persistente in `sys_user_preferences` (mig `000069`) + guardrail globale `no-literal-string` (warn su tutto `app/**`) + 5 pagine analytics it+en. Parity 131×2×7.
- **Dependabot sweep**: pino 10 + upload-artifact v7 applicati, #26 minor-group merged; **next16/ts6/vite8 DEFERITI** (`defer-major`, ogni PR con commento di valutazione). 0 alert.
- **nginx conf versionata** (`deploy/nginx/`). **Monoblocco preparato** per la prossima sessione.

## Top priorities (next session)

**▶ MONOBLOCK (apri con `ultracode`)**: esegui **`docs/superpowers/plans/2026-06-05-i18n-monoblock-execution-plan.md`** → chiude **i18n Fasi 2–5 + EN gate** (~45 pagine, fan-out 4 namespace) + guardrail flip `warn`→`error` + bundle (**next 16** pre-validato verde, **① BI P3** org-network, **F7**). Tutti i parziali/invarianti sono dettagliati nel piano + `SOT_BACKLOG.md`.

## Open questions

- **`VOYAGE_API_KEY`** nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- **Gated su upstream** (non chiudibili per effort): typescript 6 (typescript-eslint TS6-ready), vite 8 (vitest vite8-ready).

## Stack snapshot

- PROD = `https://www.heuresys.com` → nginx TLS → web `:3013` → api `:8013`. `COOKIE_SECURE=true`. nginx conf versionata `deploy/nginx/`. Deploy = `scripts/vm-deploy.sh` (non tocca nginx/.env).
- migration `000069`, ~284 endpoint, API suite **653/6**. i18n 3 ns popolati (common/shell/analytics); admin/blueprints/hr/ess scaffoldati vuoti. Reconciliation 112/147.
- Deps post-sweep: pino 10.3.1, upload-artifact v7, react 19.2.7, vitest 4.1.8. DEFER: next 15.5.18, typescript 5.7.2, vite 6.4.2.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline               # vuoto = synced
cd apps/web && pnpm i18n:check                                            # parity 131 x2 x7
pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string           # debt ~848 (→0 a fine milestone)
```
