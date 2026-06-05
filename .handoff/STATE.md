# heuresys-advanced — STATE

**Updated**: 2026-06-05 (S965). Baseline **v1.0.0 GA**. main synced (`7c2f4ee`), migration `000070`, **CI 6/6 verde**. **PROD live `https://www.heuresys.com` (TLS) — non toccata da questa sessione.**

## Last session brief (S965 — milestone i18n CHIUSA + BI ① P3 org-network, ultracode)

- **Milestone i18n CHIUSA ✅** (8 commit `bef1750`..`b6a08cd`): Fasi 2-5 fan-out ultracode 4 agenti (ess 16 / admin 17 / hr 7 / blueprints 5 = **45 pagine**, namespace separati, **IT byte-identico** + EN) + shell brand (`shell:brand`) + **EN gate** (`i18n-en.spec.ts`, 6 ns flip via server-pref locale, 11/11) + **guardrail `no-literal-string` `warn→error`** (`showcase/**` escluso §10) + **€ locale-aware** (`compensation/page.tsx`, it-IT/en-US). Parity finale **802×2×7**, eslint authenticated=0.
- **BI ① P3 org-network ✅** (`7c2f4ee`): full-stack `GET /v1/analytics/org-network` (span-of-control / depth / reach via recursive CTE su `position_reports_to_position_id`, scope position-centric, mig `000070` nav order 39), schema+repo+service+route + integration **20/20** + page i18n + E2E live. Anchor PLATFORM: **162 pos / 3 root / 28 mgr / span 5.68 / depth 4** (sanity verificato indipendente via psql).
- **F7**: 3 candidati valutati evidence-based → tokenize colori **GIÀ completo** (0 colori raw in app+components); split `SystemHealthDashboard` (344 righe demo fixture) + extract `DashboardShell` (lib-owned `@heuresys/ui`) **SEGNALATI** ("the rest", decisione Enzo).
- **Push** (autorizzato sessione): 9 commit `5897409..7c2f4ee` su origin/main; **CI 6/6 verde** (typecheck/api-test/playwright-smoke/build/lint/i18n-parity). Secret-scan pre-push pulito.
- **react override riconciliato ✅**: `pnpm.overrides` react/react-dom 19.2.5→**19.2.7** (0 peer-warning react, typecheck verde). Residuo minore `@types/react` (forzarlo rompe il typecheck via lib — fix upstream `ux-design-shared`).
- **SoT unificata ✅** (S965, spec `docs/superpowers/specs/2026-06-05-sot-unification-design.md`): `.handoff/STATE.md` è l'**unica** SoT-stato; `SOT_STATE.md`/`HANDOFF.md`/`NEXT_GENERATION_ENTRY_POINT.md`/`NEXT_SESSION_MVP_2A.md` archiviati in `docs/archive/`; governance anti-deriva in `CLAUDE.md §Source of Truth` (non creare nuovi file di stato). Backlog→`SOT_BACKLOG.md`, debiti→`DEBT_REGISTER.md`.

## Top priorities (next session)

- **next 16** (B-23, #21 — **STAND-BY**, decisione Enzo S965): bump dedicato SOLO quando emerge un driver (feature/perf next 16 necessaria, o EOL/abbandono backport linea 15). Opzione A già applicata: patch **15.5.18→15.5.19** (backport). Quando si farà B: rimuovi `eslint` key da `next.config.js` + `eslint-config-next@16` + decisione `middleware.ts`→`proxy.ts` + rebuild + **full E2E re-validation prod-mode** + prod smoke (pre-validato verde-in-isolamento S964, da ri-validare col codice i18n attuale).
- **② AI P1 backfill**: sbloccato da `VOYAGE_API_KEY` nel `.env` VM (azione Enzo) → voyage-3.5 person→occupation + skill→skill, USER-scope.
- **F7 split/extract** (decisione Enzo): split `SystemHealthDashboard` / extract pattern `DashboardShell` (quest'ultimo è lib-owned → va in repo `ux-design-shared`, non qui).

## Open questions / gated

- `VOYAGE_API_KEY` nel `.env` VM → sblocca ② AI P1 (azione Enzo).
- **Gated upstream** (non chiudibili per effort): typescript 6 (#22, typescript-eslint TS6 + tsconfig `baseUrl`), vite 8 (#20, peer `@vitest/mocker` vuole vite ^6).
- **Deploy PROD**: S965 NON deployata in PROD (PROD resta su HEAD precedente). `scripts/vm-deploy.sh` è step separato monitorato, a tua scelta.

## Stack snapshot

- PROD = `https://www.heuresys.com` → nginx TLS → web `:3013` → api `:8013`. `COOKIE_SECURE=true`. nginx conf versionata `deploy/nginx/`. Deploy = `scripts/vm-deploy.sh` (non tocca nginx/.env).
- migration `000070`, ~285 endpoint (+org-network), API suite verde. i18n **7 namespace popolati** (common/shell/analytics/admin/blueprints/hr/ess) IT+EN, parity 802×2×7, **guardrail `error`** (showcase escluso). Deps: pino 10.3.1, react 19.2.7, vitest 4.1.8, next **15.5.19** (backport S965; next 16 = stand-by).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline               # vuoto = synced
cd apps/web && pnpm i18n:check                                            # parity 802 x2 x7
pnpm exec eslint "src/app/**/*.tsx" | grep -c no-literal-string           # 0 (guardrail error; showcase escluso dal blocco)
```
