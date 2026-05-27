# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S938 CLI — S937 housekeeping CLOSED + 3 tail chiusi).
**Branch**: `main` — HEAD `c2f95ad` (synced origin). Tutti i workflow CI verdi su HEAD.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`). Prev: `v0.4.0-mvp4-ready`.

## Last session brief

S937 housekeeping CLOSED via CLI (SSH blocker caduto): CK-2 runner OCI VM registrato+online, CK-3 CW-B60-A live (observability ok), CK-6 tutti e 6 i workflow self-hosted verdi, CK-7 tag v0.4.1. Poi chiusura 3 tail: Dependabot (7 major deferiti `defer-major`, #17 gruppo merged + fix regressione lint eslint 9.39), Tail-2 drift = non-issue, **CW-B59/DEFER-F RESOLVED** (fix `ssr:false` in `apps/web/src/app/showcase/_ui-client.tsx` → /showcase riabilitato; showcase deploy verde dal primo dal 20/05). Dettaglio in HANDOFF.md §2026-05-27 (×2).

## Top priorities (next session)

1. **MVP-4 stream 2.4 SDBI Phase 2** (~6-10h kickoff) — entry point `cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md` (deciso da Enzo S937). Full context `cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md`.
2. **Dependabot 7 major deferiti** — audit breaking-changes per merge (zod4 legato a stream 2.4, fastify-type-provider-zod6, react-i18next17, next, 3 CI-action). Triage doc `docs/github/dependabot-triage-2026-05-26.md`.

## Open questions

- PR Dependabot deferite auto-rebasano → ri-triggerano CI ad ogni move di main (churn runner singolo). Candidata: condition `skip defer-major` nei 6 workflow.
- Backup runner Windows (DEFERRED da S935-F) — solo OCI VM runner attivo oggi.

## Stack snapshot

- **HEAD**: `c2f95ad`. **Tag**: `v0.4.1-housekeeping-closed`.
- **CI**: 6 workflow self-hosted su OCI VM runner (`oracle-vm-default-runner` online) — typecheck/lint/test-integration/build-web/playwright/i18n tutti verdi + showcase deploy (GitHub Pages) verde. EnvironmentFile `/etc/heuresys-runner.env` (JWT `\\n` double-escape, ADMIN_ORIGIN/web :3100 vs Grafana :3000, NEXT_PUBLIC_API_BASE_URL).
- **Bias**: 62 catalogued (CW-B17→B63, B57 withdrawn), CW-B59 RESOLVED, deferred-fix 0. Next CW-B64.
- **Deps**: post #17 → eslint 9.39.4, typescript-eslint 8.60. `@heuresys/ui ^0.1.1` npm. ux-design-shared `dfa2e81`.
- **/showcase**: riabilitato (apps/web `app/showcase` via `_ui-client` ssr:false; `_disabled_showcase_X18` rimosso).

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'   # key in agent? else load manually
nc -z localhost 5433 && echo tunnel-up             # else: ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                # empty = synced
pnpm install -r && pnpm --filter @heuresys/web build   # exit 0
gh run list --limit 6                              # main CI green
```

## Note operative

- Tunnel SSH 5433 attivo solo da Windows namespace (bash WSL2 = Connection refused, atteso).
- OCI VM runner host ha Grafana su :3000 → web E2E gira su :3100 (playwright.config `PLAYWRIGHT_WEB_PORT`).
- systemd EnvironmentFile fa shell-unescape: PEM/segreti multi-char con backslash vanno `\\` raddoppiati.
- Git push autonomi: nuova sessione riparte da default "ask".
