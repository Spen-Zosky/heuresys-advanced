# heuresys-advanced — STATE

**Updated**: 2026-05-23 GMT+2 (X13 close)
**Branch**: `main` — local commit pending push (X13 bundle staged, NO push without explicit ask)
**Last tag**: `v0.4.0-brand-v1`

## Last session brief

Sprint **X13 MVP-2a Coverage Hardening** completato in ~1h CLI (sotto il 4-5h estimate del PROMPT 017): chiude i residuali §5 NEXT_SESSION_MVP_2A.md. Pre-flight CW-B52 mitigation PASS (live state matches baseline). Block A coverage matrix (43-route × 17→18 spec) ha identificato **1 sola NONE route** (`/system-health`). Block B authoring (`system-health.spec.ts` + a11y axe extension) chiude il gap. Block C.1 `pnpm i18n:check` verde (17 keys × 2 locales × 1 namespace). Block C.2 ruleset esteso, full live run deferred (richiede dev servers up). Block D HANDOFF refresh (root + Cowork-side + questo STATE). Tunnel SSH 5433 si era spento dopo logout, recuperato al primo retry.

## Top priorities (next session)

1. **Resume brainstorming SDBI closure da Q4** (~30min poi spec authoring ~1h) — Q1+Q2+Q3 locked. Q4 open: data flow AI-synth (a/b/c/d). Mia racc: **(a) Full brownfield engine** con `source_table_classification='SYNTHETIC_AI_GENERATED'` flag — riusa engine senza scrivere codice nuovo.
2. **MVP-2a final live validation** (~30min, richiede dev servers) — eseguire `pnpm --filter @heuresys/web exec playwright test` full suite + `pnpm build apps/web` per certificare i 2 acceptance items deferred-executable di X13 (`pnpm test` totale + `pnpm build` no errori).
3. **C14 batch authoring** (Cowork) — direzione MVP-3 finalization vs MVP-2b ESS hardening vs SDBI closure parallel batch, da scegliere post C14 PROMPT.

## Open questions

- **Q4 brainstorming**: data flow AI-synth → sys.* — (a) full engine / (b) staging-skip / (c) direct INSERT / (d) new engine variant. Decisione fondamentale: tutto il design SDBI closure dipende da questa scelta.
- **C14 direction**: post-X13 outlook PROMPT 017 §10 lista 3 opzioni (MVP-3 kickoff / MVP-2b hardening / SDBI residue) — Cowork decide.

## Stack snapshot (deltas vs S929/X12)

- **sys.* populated**: 60/134 (unchanged)
- **sys_users**: 433 (R-A2 SAFE, unchanged)
- **Migrations**: 42 (unchanged)
- **Bias catalog**: 52 → **53** (+CW-B53 acceptance-criterion ambiguity "≥40 Playwright spec" strict-vs-functional)
- **E2E spec files**: 17 → **18** (+ `system-health.spec.ts`)
- **`test()` runtime calls** (`playwright --list`): ~108 → **125** (+17)
- **axe sweep platformAdmin routes**: 4 → **5** (+`/system-health`)
- **NONE coverage gaps**: 1 → **0** (`/system-health` closed)
- **i18n parity**: confirmed green (17 keys × 2 locales × 1 namespace)
- **`@heuresys/ui` symlink**: verified `/d/ux-design-shared/ui`
- **Tunnel SSH 5433**: required at session start (auto-down post-logout, 1 reconnect sufficient)

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
cd D:/heuresys-advanced && git log --oneline -3                # 0d81a57 handoff S929, 8bbaa0a X12, 996d0d9 X11 (pre-X13 commit); post-X13 will add 1 commit
source .env && PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_users' k, COUNT(*) FROM sys.sys_users
UNION ALL SELECT 'sys_skills', COUNT(*) FROM sys.sys_skills
ORDER BY 1;"                                                   # 433, 20048
ls cowork_code_exchange/.inbox/cli/pending/                    # post-X13: no inbox notify by design (watchdog off)
pnpm --filter @heuresys/web exec playwright test --list | tail -3   # confirm 125 tests / 19 files
```

## Resume protocol

1. Read STATE + check `.inbox/cli/pending/` for new PROMPT 018 (Cowork C14 expected post manual poll).
2. If no PROMPT 018 → resume SDBI brainstorming from Q4 (priority #1) OR run priority #2 live MVP-2a validation.
3. X13 bundle is committed locally on `main`, **not pushed** — `git push origin main` requires explicit ask from Enzo.
4. Cron loop dormant since session S929 — re-launch only if Cowork batches in flight expected.
